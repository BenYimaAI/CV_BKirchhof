/**
 * Password-based vault for the three private CV registers.
 *
 * The committed file private/registers.enc.json is AES-256-GCM ciphertext.
 * The key is PBKDF2-HMAC-SHA256 of the access code (600,000 iterations).
 * The access code is read from CV_ACCESS_SECRET and is never written to disk
 * by this tool except when the caller already stored it outside git.
 *
 * WebCrypto does not implement Argon2. PBKDF2 stays inside Node's crypto and
 * the browser's native WebCrypto, with the OWASP 2023 iteration count for
 * HMAC-SHA256. A future human-chosen passphrase is what the iteration count
 * is there to slow down.
 */
import {createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const AAD = 'cv-private-v1';
export const KDF = 'PBKDF2-SHA-256';
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_ITERATIONS = 100_000;
export const MAX_ITERATIONS = 2_000_000;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const vaultPath = resolve(root, 'private/registers.enc.json');
export const payloadPath = resolve(root, 'content/private/payload.json');

export function encryptBytes(plain, secret, iterations = DEFAULT_ITERATIONS) {
  if (!secret) throw new Error('missing access code');
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new Error('iteration count out of range');
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(Buffer.from(secret, 'utf8'), salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(AAD, 'utf8'));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const ciphertext = Buffer.concat([body, cipher.getAuthTag()]);
  return {
    version: 1,
    kdf: KDF,
    iterations,
    aad: AAD,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    note: 'AES-256-GCM ciphertext. The access code is not stored in this file.'
  };
}

export function decryptBytes(vault, secret) {
  if (!secret) throw new Error('missing access code');
  if (!vault || vault.version !== 1 || vault.kdf !== KDF || vault.aad !== AAD) {
    throw new Error('unsupported vault');
  }
  const iterations = vault.iterations;
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    throw new Error('unsupported vault');
  }
  const salt = Buffer.from(vault.salt, 'base64');
  const iv = Buffer.from(vault.iv, 'base64');
  const data = Buffer.from(vault.ciphertext, 'base64');
  if (salt.length !== 16 || iv.length !== 12 || data.length < 17) throw new Error('unsupported vault');
  const key = pbkdf2Sync(Buffer.from(secret, 'utf8'), salt, iterations, 32, 'sha256');
  const tag = data.subarray(data.length - 16);
  const body = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(AAD, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export function readSecret() {
  return (process.env.CV_ACCESS_SECRET || '').trim();
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function assertPayload(payload) {
  for (const id of ['cv', 'projects', 'private']) {
    const html = payload?.views?.[id];
    if (typeof html !== 'string' || !html.includes(`id="view-${id}"`)) {
      throw new Error('payload is missing register ' + id);
    }
  }
  if (!payload.translations?.en || !payload.translations?.de || !payload.translations?.zh) {
    throw new Error('payload is missing translations');
  }
}

export function encryptPayloadFile(secret) {
  if (!existsSync(payloadPath)) throw new Error('missing ' + payloadPath + ' (decrypt first, then edit)');
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
  assertPayload(payload);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const vault = encryptBytes(plain, secret);
  mkdirSync(dirname(vaultPath), {recursive: true});
  writeFileSync(vaultPath, JSON.stringify(vault));
  console.log('encrypted registers written to private/registers.enc.json');
}

export function decryptPayloadFile(secret) {
  const vault = JSON.parse(readFileSync(vaultPath, 'utf8'));
  const payload = JSON.parse(decryptBytes(vault, secret).toString('utf8'));
  assertPayload(payload);
  mkdirSync(dirname(payloadPath), {recursive: true});
  writeFileSync(payloadPath, JSON.stringify(payload, null, 2), {mode: 0o600});
  console.log('decrypted payload written to content/private/payload.json (gitignored)');
}

const PUBLIC_VALUE_FLOOR = 12;

function coveredByLongerPublicCopy(text, publicValues) {
  for (const pub of publicValues) {
    if (pub.length > text.length && pub.includes(text)) return true;
  }
  return false;
}

export function findLeaks(payload, publicBlob, publicValues) {
  const leaks = [];
  const seen = new Set();
  const consider = (label, value) => {
    if (typeof value !== 'string') return;
    const text = value.replace(/\s+/g, ' ').trim();
    if (text.length < PUBLIC_VALUE_FLOOR || publicValues.has(text) || seen.has(text)) return;
    if (coveredByLongerPublicCopy(text, publicValues)) return;
    seen.add(text);
    if (publicBlob.includes(text)) leaks.push(label);
  };
  for (const [lang, table] of Object.entries(payload.translations || {})) {
    for (const [key, value] of Object.entries(table)) consider(`${lang}.${key}`, value);
  }
  for (const [id, html] of Object.entries(payload.views || {})) {
    for (const match of html.matchAll(/>([^<]+)</g)) consider(`${id} text`, match[1]);
    for (const match of html.matchAll(/\balt="([^"]+)"/g)) consider(`${id} alt`, match[1]);
    for (const match of html.matchAll(/data:image\/webp;base64,[A-Za-z0-9+/]{80}/g)) {
      if (id === 'private' && publicBlob.includes(match[0])) leaks.push('private image');
    }
  }
  return leaks;
}

function publicValuesFromIndex(indexHtml) {
  const match = indexHtml.match(/<script id="publicCopy" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return new Set();
  const copy = JSON.parse(match[1]);
  const values = new Set();
  for (const table of Object.values(copy)) {
    for (const value of Object.values(table)) {
      if (typeof value === 'string') values.add(value.replace(/\s+/g, ' ').trim());
    }
  }
  return values;
}

export function verifyVault(secret) {
  const indexPath = resolve(root, 'index.html');
  const indexHtml = readFileSync(indexPath, 'utf8');
  const vault = JSON.parse(readFileSync(vaultPath, 'utf8'));
  let payload;
  try {
    payload = JSON.parse(decryptBytes(vault, secret).toString('utf8'));
  } catch {
    throw new Error('decryption failed; CV_ACCESS_SECRET does not open private/registers.enc.json');
  }
  assertPayload(payload);
  const publicBlob = [
    indexHtml,
    readFileSync(resolve(root, 'cv-access.js'), 'utf8'),
    readFileSync(vaultPath, 'utf8')
  ].join('\n');
  const leaks = findLeaks(payload, publicBlob, publicValuesFromIndex(indexHtml));
  if (leaks.length) {
    throw new Error('private register text is still in the public site (' + leaks.slice(0, 8).join(', ') + ')');
  }
  if (publicBlob.includes(secret)) throw new Error('access code appears in a public file');
  console.log('verified encrypted registers');
}

function main() {
  const cmd = process.argv[2];
  const secret = readSecret();
  if (!secret) {
    fail('Set CV_ACCESS_SECRET to the access code. It is not stored in the repository.');
    return;
  }
  try {
    if (cmd === 'encrypt') encryptPayloadFile(secret);
    else if (cmd === 'decrypt') decryptPayloadFile(secret);
    else if (cmd === 'verify') verifyVault(secret);
    else fail('Usage: node scripts/private_vault.mjs encrypt|decrypt|verify');
  } catch (error) {
    fail(error.message || 'vault command failed');
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
