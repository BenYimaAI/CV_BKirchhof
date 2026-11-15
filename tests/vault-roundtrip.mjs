import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decryptBytes, encryptBytes, republishVault, accessCodeForInstant, codeForIsoDate, shanghaiParts, AAD, DEFAULT_ITERATIONS} from '../scripts/private_vault.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sampleCode = 'roundtrip-sample-code';
const payload = Buffer.from(JSON.stringify({
  views: {
    cv: '<div id="view-cv" class="regView">sample cv</div>',
    projects: '<div id="view-projects" class="regView">sample projects</div>',
    private: '<div id="view-private" class="regView">sample private</div>'
  },
  translations: {en: {cvHeroLead: 'Sample register sentence for the crypto round trip.'}, de: {cvHeroLead: 'Beispiel'}, zh: {cvHeroLead: '示例句子用于往返'}}
}), 'utf8');

const vault = encryptBytes(payload, sampleCode, DEFAULT_ITERATIONS);
const back = decryptBytes(vault, sampleCode);
if (!back.equals(payload)) throw new Error('node decrypt did not match');

const key = await webcrypto.subtle.deriveKey(
  {name: 'PBKDF2', salt: Buffer.from(vault.salt, 'base64'), iterations: vault.iterations, hash: 'SHA-256'},
  await webcrypto.subtle.importKey('raw', new TextEncoder().encode(sampleCode), 'PBKDF2', false, ['deriveKey']),
  {name: 'AES-GCM', length: 256},
  false,
  ['decrypt']
);
const plain = Buffer.from(await webcrypto.subtle.decrypt(
  {name: 'AES-GCM', iv: Buffer.from(vault.iv, 'base64'), additionalData: new TextEncoder().encode(AAD)},
  key,
  Buffer.from(vault.ciphertext, 'base64')
));
if (!plain.equals(payload)) throw new Error('WebCrypto decrypt did not match the Node ciphertext');

let rejected = false;
try {
  decryptBytes(vault, 'roundtrip-sample-code-wrong');
} catch {
  rejected = true;
}
if (!rejected) throw new Error('a wrong code decrypted the sample vault');

function expectedCode(instant) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'gregory',
    numberingSystem: 'latn'
  }).formatToParts(new Date(instant))) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') parts[part.type] = part.value;
  }
  return 'Ben_' + parts.day + parts.month + parts.year;
}

const boundarySamples = [
  '2026-11-15T15:59:59.999Z',
  '2026-11-15T16:00:00.000Z',
  '2026-01-01T15:59:59.999Z',
  '2026-01-01T16:00:00.000Z',
  '2026-12-31T15:59:59.999Z',
  '2026-12-31T16:00:00.000Z'
];
for (const sample of boundarySamples) {
  const code = accessCodeForInstant(new Date(sample));
  if (code !== expectedCode(sample)) throw new Error('access code does not follow the Shanghai calendar at ' + sample);
  if (!/^Ben_\d{8}$/.test(code)) throw new Error('access code shape mismatch');
}
if (accessCodeForInstant(new Date(boundarySamples[0])) === accessCodeForInstant(new Date(boundarySamples[1]))) {
  throw new Error('code did not change at 00:00 Asia/Shanghai');
}
let impossible = false;
try {
  codeForIsoDate('2026-02-29');
} catch {
  impossible = true;
}
if (!impossible) throw new Error('impossible seal date was accepted');
const leapParts = shanghaiParts(new Date('2024-02-29T04:00:00.000Z'));
if (codeForIsoDate('2024-02-29') !== 'Ben_' + leapParts.day + leapParts.month + leapParts.year) {
  throw new Error('leap-day seal code mismatch');
}

for (const rel of ['index.html', 'cv-access.js']) {
  const text = readFileSync(resolve(root, rel), 'utf8');
  for (const marker of ['Ben_', 'Asia/Shanghai', 'DDMMYYYY', 'sealedFor', 'Intl.DateTimeFormat', 'const PASSWORD']) {
    if (text.includes(marker)) throw new Error(rel + ' contains vault-seal logic');
  }
}

const raw = readFileSync(resolve(root, 'private/registers.enc.json'), 'utf8');
const real = JSON.parse(raw);
if (real.kdf !== 'PBKDF2-SHA-256' || real.aad !== AAD || real.iterations < DEFAULT_ITERATIONS) {
  throw new Error('committed vault does not use the required KDF');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(real.sealedFor || '')) throw new Error('committed vault is missing sealedFor');
const sealCode = codeForIsoDate(real.sealedFor);
let sourcePlain;
try {
  sourcePlain = decryptBytes(real, sealCode);
} catch {
  throw new Error('sealedFor date did not open the committed vault');
}
if (raw.includes(sealCode)) throw new Error('committed vault contains its access code');
function shiftIso(iso, days) {
  const [year, month, day] = iso.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
  probe.setUTCDate(probe.getUTCDate() + days);
  const parts = shanghaiParts(probe);
  return parts.year + '-' + parts.month + '-' + parts.day;
}
for (const neighbor of [shiftIso(real.sealedFor, -1), shiftIso(real.sealedFor, 1)]) {
  let opened = false;
  try {
    decryptBytes(real, codeForIsoDate(neighbor));
    opened = true;
  } catch {
    opened = false;
  }
  if (opened) throw new Error('an adjacent Shanghai day opened the committed vault');
}
const republished = republishVault(new Date());
const todayCode = accessCodeForInstant(new Date());
if (!decryptBytes(republished.published, todayCode).equals(republished.plain)) {
  throw new Error('republished vault did not open with the Shanghai-day code');
}
if (JSON.stringify(republished.published).includes(todayCode) || republished.published.sealedFor) {
  throw new Error('republished vault is not clean');
}
for (const bad of [
  accessCodeForInstant(new Date(Date.now() - 86400000)),
  accessCodeForInstant(new Date(Date.now() + 86400000)),
  todayCode.slice(0, 4) + ' ' + todayCode.slice(4)
]) {
  let opened = false;
  try {
    decryptBytes(republished.published, bad);
    opened = true;
  } catch {
    opened = false;
  }
  if (opened) throw new Error('a non-today code opened the republished vault');
}
if (!sourcePlain.equals(republished.plain)) throw new Error('republish changed the register bytes');
if (raw.length < 100000) throw new Error('committed vault is unexpectedly small');
for (const marker of ['id="view-private"', 'id="view-cv"', 'const PASSWORD', 'cvHeroLead', 'sportsText']) {
  if (raw.includes(marker)) throw new Error('committed vault contains plaintext marker ' + marker);
}
let opened = false;
try {
  decryptBytes(real, sampleCode);
  opened = true;
} catch {
  opened = false;
}
if (opened) throw new Error('sample code opened the real register vault');

console.log('vault roundtrip ok');
