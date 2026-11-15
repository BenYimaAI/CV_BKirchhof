/**
 * Password-based vault for the three private CV registers.
 *
 * private/registers.enc.json is AES-256-GCM ciphertext. Its sealedFor field
 * is the Asia/Shanghai calendar date (YYYY-MM-DD) that opens this source
 * file. It is not the access code. GitHub Pages decrypts that source and
 * writes a new ciphertext for the Shanghai date at deploy time. The browser
 * only derives a key from the typed string. A wrong string fails the
 * authentication tag. The access code is never stored in the vault.
 *
 * WebCrypto does not implement Argon2. PBKDF2 stays inside Node's crypto and
 * the browser's native WebCrypto, with the OWASP 2023 iteration count for
 * HMAC-SHA256.
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
export const CODE_PREFIX = 'Ben_';

const shanghaiFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  calendar: 'gregory',
  numberingSystem: 'latn'
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const vaultPath = resolve(root, 'private/registers.enc.json');
export const payloadPath = resolve(root, 'content/private/payload.json');

export function shanghaiParts(date = new Date()) {
  const parts = {};
  for (const part of shanghaiFormatter.formatToParts(date)) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') parts[part.type] = part.value;
  }
  if (!parts.year || !parts.month || !parts.day) throw new Error('Asia/Shanghai date unavailable');
  return parts;
}

export function isoDateInShanghai(date = new Date()) {
  const parts = shanghaiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function codeForIsoDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new Error('sealedFor is not a Shanghai calendar date');
  }
  const [year, month, day] = iso.split('-');
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 4, 0, 0));
  const parts = shanghaiParts(probe);
  if (parts.year !== year || parts.month !== month || parts.day !== day) {
    throw new Error('sealedFor is not a real calendar date');
  }
  return `${CODE_PREFIX}${day}${month}${year}`;
}

export function accessCodeForInstant(date = new Date()) {
  return codeForIsoDate(isoDateInShanghai(date));
}

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

function encryptClean(plain, secret) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const vault = encryptBytes(plain, secret);
    if (!JSON.stringify(vault).includes(secret)) return vault;
  }
  throw new Error('refusing to write a vault that contains the access code');
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

export function readSourceVault() {
  const vault = JSON.parse(readFileSync(vaultPath, 'utf8'));
  const secret = codeForIsoDate(vault.sealedFor);
  return {vault, secret, plain: decryptBytes(vault, secret)};
}

export function encryptPayloadFile(when = new Date()) {
  if (!existsSync(payloadPath)) throw new Error('missing ' + payloadPath + ' (decrypt first, then edit)');
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
  assertPayload(payload);
  const plain = Buffer.from(JSON.stringify(payload), 'utf8');
  const iso = isoDateInShanghai(when);
  const vault = encryptClean(plain, codeForIsoDate(iso));
  vault.sealedFor = iso;
  if (JSON.stringify(vault).includes(codeForIsoDate(iso))) {
    throw new Error('refusing to write a vault that contains the access code');
  }
  mkdirSync(dirname(vaultPath), {recursive: true});
  writeFileSync(vaultPath, JSON.stringify(vault));
  console.log('encrypted registers written to private/registers.enc.json');
}

export function decryptPayloadFile() {
  const {plain} = readSourceVault();
  const payload = JSON.parse(plain.toString('utf8'));
  assertPayload(payload);
  mkdirSync(dirname(payloadPath), {recursive: true});
  writeFileSync(payloadPath, JSON.stringify(payload, null, 2), {mode: 0o600});
  console.log('decrypted payload written to content/private/payload.json (gitignored)');
}

export function republishVault(when = new Date()) {
  const {plain, secret} = readSourceVault();
  assertPayload(JSON.parse(plain.toString('utf8')));
  const todayCode = accessCodeForInstant(when);
  const published = encryptClean(plain, todayCode);
  const packed = JSON.stringify(published);
  if (packed.includes(todayCode) || packed.includes(secret) || packed.includes('"sealedFor"')) {
    throw new Error('public vault is not clean');
  }
  return {published, plain};
}

export function writePublicVault(destPath, when = new Date()) {
  const {published, plain} = republishVault(when);
  const dest = resolve(destPath);
  mkdirSync(dirname(dest), {recursive: true});
  writeFileSync(dest, JSON.stringify(published));
  const site = dirname(dirname(dest));
  const today = accessCodeForInstant(when);
  const neighbors = [
    accessCodeForInstant(new Date(when.getTime() - 86400000)),
    accessCodeForInstant(new Date(when.getTime() + 86400000))
  ];
  for (const rel of ['index.html', 'cv-access.js', 'private/registers.enc.json']) {
    const file = resolve(site, rel);
    if (!existsSync(file)) throw new Error('public bundle is missing ' + rel);
    const text = readFileSync(file, 'utf8');
    if (text.includes(today) || neighbors.some((code) => text.includes(code))) {
      throw new Error('access code appears in the public bundle');
    }
    if (rel.endsWith('.js') || rel.endsWith('.html')) {
      for (const marker of ['Ben_', 'Asia/Shanghai', 'DDMMYYYY', 'sealedFor', 'Intl.DateTimeFormat']) {
        if (text.includes(marker)) throw new Error('public gateway contains vault-seal logic');
      }
    }
  }
  const opened = decryptBytes(published, today);
  if (!opened.equals(plain)) throw new Error('public vault did not round-trip');
  for (const bad of neighbors) {
    let openedNeighbor = false;
    try {
      decryptBytes(published, bad);
      openedNeighbor = true;
    } catch {
      openedNeighbor = false;
    }
    if (openedNeighbor) throw new Error('an adjacent Shanghai day opened the public vault');
  }
  const spaced = `${today.slice(0, CODE_PREFIX.length)} ${today.slice(CODE_PREFIX.length)}`;
  let openedSpaced = false;
  try {
    decryptBytes(published, spaced);
    openedSpaced = true;
  } catch {
    openedSpaced = false;
  }
  if (openedSpaced) throw new Error('a spaced code opened the public vault');
  console.log('public vault sealed for the current Asia/Shanghai day');
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

export function verifyVault(when = new Date()) {
  const indexPath = resolve(root, 'index.html');
  const indexHtml = readFileSync(indexPath, 'utf8');
  const script = readFileSync(resolve(root, 'cv-access.js'), 'utf8');
  const {vault, secret, plain} = readSourceVault();
  const payload = JSON.parse(plain.toString('utf8'));
  assertPayload(payload);
  const publicBlob = [indexHtml, script, JSON.stringify(vault)].join('\n');
  const leaks = findLeaks(payload, publicBlob, publicValuesFromIndex(indexHtml));
  if (leaks.length) {
    throw new Error('private register text is still in the public site (' + leaks.slice(0, 8).join(', ') + ')');
  }
  const todayCode = accessCodeForInstant(when);
  for (const code of new Set([secret, todayCode])) {
    if (publicBlob.includes(code)) throw new Error('access code appears in a public file');
  }
  for (const marker of ['Ben_', 'Asia/Shanghai', 'DDMMYYYY', 'sealedFor', 'Intl.DateTimeFormat']) {
    if (indexHtml.includes(marker) || script.includes(marker)) {
      throw new Error('public gateway contains vault-seal logic');
    }
  }
  console.log('verified encrypted registers');
}

function main() {
  const cmd = process.argv[2];
  try {
    if (cmd === 'encrypt') encryptPayloadFile();
    else if (cmd === 'decrypt') decryptPayloadFile();
    else if (cmd === 'verify') verifyVault();
    else if (cmd === 'write-public-vault') {
      const dest = process.argv[3];
      if (!dest) {
        fail('Usage: node scripts/private_vault.mjs write-public-vault <dest>');
        return;
      }
      writePublicVault(dest);
    } else fail('Usage: node scripts/private_vault.mjs encrypt|decrypt|verify|write-public-vault <dest>');
  } catch (error) {
    fail(error.message || 'vault command failed');
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
