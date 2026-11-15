# CV_BKirchhof — Interactive Executive Portfolio

**Status:** H05 triple-register portfolio. The three registers are encrypted before they are published to GitHub Pages.

Earlier concept notes live in `docs/`. They describe the prototypes that led here, including the old client-side password check. That check is not the current control.

## Run locally

Unlocking a register fetches `private/registers.enc.json`. Browsers block that fetch on a `file://` page, so serve the directory:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The gateway — language switch, register cards, and the email request — works before a code is entered.

## Private registers

GitHub Pages cannot check a password on the server. Hiding a section with JavaScript left the registers and the access code in the public HTML. The registers are encrypted instead, and only ciphertext is published.

- `private/registers.enc.json` is AES-256-GCM ciphertext for the source registers.
- The key is PBKDF2-HMAC-SHA256 of the access code, 600,000 iterations, with a random salt and IV stored beside the ciphertext.
- The access code is the prefix `Ben_` immediately followed by the Asia/Shanghai calendar date as eight digits, day then month then year (`Ben_` + `DDMMYYYY`). No spaces. The code is case-sensitive. A trailing newline is ignored because the dialog trims the ends of the field. Spaces inside the code fail.
- Yesterday's code and tomorrow's code do not open the vault GitHub Pages is serving.
- The browser does not know that scheme. It derives a key from the typed string and tries to decrypt. A wrong code fails the authentication tag, and the register markup is never inserted. The code is not in `cv-access.js` or in the Pages bundle.
- Returning to the gateway removes the decrypted markup from the document.
- The public gateway keeps working without the code, including the EN / DE / 中文 switch, the Tron 2.0 layout, and the component studies.

The committed vault's `sealedFor` field is the Shanghai date that opens **that file**, written as `YYYY-MM-DD`. That field is not the access code. Every run of **GitHub Pages CV** decrypts the committed vault with the `sealedFor` date and writes a new ciphertext, sealed for the Shanghai date at deploy time, into `public-site/` only. A push to `main` does this. So does the schedule at 00:00 Asia/Shanghai, which is `0 16 * * *` UTC because Shanghai is UTC+8 all year. The schedule does not commit. GitHub can start a scheduled job late; until that job finishes, the live site still has the previous seal.

`CV_ACCESS_SECRET` is not used. A missing or different Actions secret cannot change the code the site is sealed with.

This code is easy to guess. It is still AES-256-GCM: the published files do not contain the registers or the code, and a mismatch fails the authentication tag. Anyone who knows the day's code can decrypt a copy of that day's vault. The next day's deploy is how that copy stops matching the live site. It does not revoke someone who already saved the plaintext.

WebCrypto has no Argon2. PBKDF2 at the OWASP 2023 HMAC-SHA256 iteration count stays in the browser's native crypto instead of shipping a separate password hasher.

A host with real authentication, such as Cloudflare Access, can issue per-person logins and revoke one person without re-encrypting. That needs another account, DNS in front of the site, and a home for the private HTML that is not this public repository.

### Edit a register

Plaintext is only the gitignored working file `content/private/payload.json`, created on a machine where you decrypt.

```bash
node scripts/private_vault.mjs decrypt
# edit content/private/payload.json
# views.cv, views.projects, and views.private are the register HTML.
# translations.en, translations.de, and translations.zh are the register strings.
node scripts/private_vault.mjs encrypt
node scripts/private_vault.mjs verify
```

`encrypt` seals the source for the current Shanghai day and sets `sealedFor` to that date. Commit `private/registers.enc.json` only. Do not commit `content/private/` or an access code. Pushing to `main` republishes a vault sealed for that same day.

`verify` decrypts the source with its `sealedFor` date and fails if register text or the access code has landed in `index.html` or `cv-access.js`.

### What encryption does not erase

The ciphertext replaces the registers in the current files and in the next Pages deploy. Git history, the deployment that is live until this change ships, and existing Actions artifacts still have older copies. Those copies are listed on the pull request that introduced the vault. Removing them means a history rewrite and a force-push, which this change does not do, plus deleting the old artifacts. The retired literal that used to sit in the page JavaScript is already public. The bootstrap code that sealed the first ciphertext is not in git; hyphens in that code were part of the string, and spaces around them do not open it.

## Layout

- `index.html` — public gateway and the illustrated component studies. No register bodies and no access code.
- `assets/studies/` — stylized personal illustrations used on the public page. They are not official Mercedes-Benz artwork. The high-voltage battery image is the exploded view without the upper housing cover.
- `assets/fonts/` — self-hosted Outfit and IBM Plex Mono files, with their SIL Open Font License texts.
- `cv-access.js` — language switch, access dialog, illustration lightbox, and WebCrypto decrypt.
- `private/registers.enc.json` — ciphertext for the three registers.
- `scripts/private_vault.mjs` — `encrypt`, `decrypt`, `verify`, and `write-public-vault`.
- `scripts/prepare_site.py` — writes `public-site/` from that allowlist and reseals the vault for the current Shanghai day.
- `tests/smoke.mjs` — gateway, illustration lightbox, rejected codes (including the previous and next Shanghai days), and unlock at 320, 390, 768, and 1440 CSS pixels. The test computes the day's code in the build. It does not read it from the bundle.

## Publication

`main` is deployed by `.github/workflows/pages.yml` on every push and every day at 00:00 Asia/Shanghai (`0 16 * * *` UTC). The job uploads the `public-site/` directory, not the rest of the repository. The repository is public, so a committed file is public even when Pages does not copy it. The committed source vault stays sealed for its `sealedFor` date; only the uploaded bundle is resealed for the day of the deploy.
