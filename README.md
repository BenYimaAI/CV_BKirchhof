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

- `private/registers.enc.json` is AES-256-GCM ciphertext.
- The key is PBKDF2-HMAC-SHA256 of the access code, 600,000 iterations, with a random salt and IV stored beside the ciphertext.
- The access code is not in git, in `cv-access.js`, or in the Pages bundle. A wrong code fails the authentication tag, and the register markup is never inserted.
- Returning to the gateway removes the decrypted markup from the document.
- The public gateway keeps working without the code, including the EN / DE / 中文 switch and the phone layout.

WebCrypto has no Argon2. PBKDF2 at the OWASP 2023 HMAC-SHA256 iteration count stays in the browser's native crypto instead of shipping a separate password hasher. A long random code is what makes an offline guess impractical. A short or common code is not enough, because anyone can download the ciphertext and try codes themselves.

This is one shared code, not a user account. Anyone who knows the code can decrypt a copy of the vault. Rotating the code and republishing the ciphertext is how access is withdrawn. It does not revoke a single visitor while leaving the old code valid.

A host with real authentication, such as Cloudflare Access, can issue per-person logins and revoke one person without re-encrypting. That needs another account, DNS in front of the site, and a home for the private HTML that is not this public repository. Encryption keeps the current Pages URL and the single code visitors already request by email, and it stops the registers shipping as plaintext.

### Set the access code

Create an Actions secret named `CV_ACCESS_SECRET`.

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

Or, from a checkout, with the GitHub CLI:

```bash
gh secret set CV_ACCESS_SECRET --repo BenYimaAI/CV_BKirchhof
```

Paste the code and nothing else. A trailing newline is ignored. The code is case-sensitive.

The Pages workflow checks the secret when it is set, and fails the deploy if that value no longer decrypts the vault. It does not write the secret into the site. If the secret is missing, ciphertext still deploys and the check is skipped.

The code that opens the vault currently in git was created when encryption was added and given to the repository owner outside the repository. Store that value as `CV_ACCESS_SECRET`, confirm a register opens, then rotate it to a code you choose so the bootstrap value is not the long-term secret.

### Rotate the code or edit a register

Plaintext is only the gitignored working file `content/private/payload.json`, created on a machine where you decrypt.

```bash
CV_ACCESS_SECRET='current-code' node scripts/private_vault.mjs decrypt
# edit content/private/payload.json
# views.cv, views.projects, and views.private are the register HTML.
# translations.en, translations.de, and translations.zh are the register strings.
CV_ACCESS_SECRET='new-code' node scripts/private_vault.mjs encrypt
CV_ACCESS_SECRET='new-code' node scripts/private_vault.mjs verify
```

Commit `private/registers.enc.json` only. Do not commit `content/private/` or the access code. Update `CV_ACCESS_SECRET` to the new code, then run **GitHub Pages CV** (a push to `main` runs it).

`verify` decrypts the vault with the secret and fails if register text has landed back in `index.html` or `cv-access.js`.

### What encryption does not erase

The ciphertext replaces the registers in the current files and in the next Pages deploy. Git history, the deployment that is live until this change ships, and existing Actions artifacts still have the old plaintext. Those copies are listed on the pull request that introduced the vault. Removing them means a history rewrite and a force-push, which this change does not do, plus deleting the old artifacts. Treat the previous access code as public.

## Layout

- `index.html` — public gateway. No register bodies and no access code.
- `cv-access.js` — language switch, access dialog, and WebCrypto decrypt.
- `private/registers.enc.json` — ciphertext for the three registers.
- `scripts/private_vault.mjs` — `encrypt`, `decrypt`, and `verify`.
- `scripts/prepare_site.py` — writes `public-site/` from that allowlist for GitHub Pages.
- `tests/smoke.mjs` — gateway, a rejected code, and, when `CV_ACCESS_SECRET` or `.access-secret` is present, unlock at 320, 390, 768, and 1440 CSS pixels.

## Publication

`main` is deployed by `.github/workflows/pages.yml`. The job uploads the `public-site/` directory, not the rest of the repository. The repository is public, so a committed file is public even when Pages does not copy it.
