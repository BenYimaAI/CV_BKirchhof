import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decryptBytes, encryptBytes, AAD, DEFAULT_ITERATIONS} from '../scripts/private_vault.mjs';

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

const raw = readFileSync(resolve(root, 'private/registers.enc.json'), 'utf8');
const real = JSON.parse(raw);
if (real.kdf !== 'PBKDF2-SHA-256' || real.aad !== AAD || real.iterations < DEFAULT_ITERATIONS) {
  throw new Error('committed vault does not use the required KDF');
}
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
