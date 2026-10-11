# CV_BKirchhof — Interactive Executive Portfolio

**Status:** Development prototype H01 · 2026-10-11  
**Working branch:** `development` (not released to `main`)

## Run locally
Open `index.html` in any current desktop or mobile browser. The site has no external runtime dependencies, and the portrait is embedded. Alternatively:
```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Concept
The first screen offers **two visitor journeys**:
- **Public Portfolio:** interactive, responsive overview with selected experience, documented engineering achievements and introductory perspectives.
- **Leadership & Strategy:** access-information screen only. It intentionally does **not** contain private strategy files, confidential documents, internal metrics or a fake client-side login.

This H01 HTML is a **concept prototype**, not a production-ready CV. Resume details, brand wording, project metrics and photo permissions are subject to editorial verification.

## Structure
- `index.html` — standalone interactive HTML prototype, based on the H01 artifact created 2026-10-11
- `docs/concept-v0.1.md` — initial CV evaluation and portfolio concept
- `docs/concept-v0.2.md` — dual-experience UX and security requirements
- `docs/asset-and-release-register.md` — file/asset policy and pending evidence
- `tests/smoke.mjs` — automated Playwright viewport and navigation smoke checks
- `.github/workflows/development-checks.yml` — development-only tests and downloadable preview build artifact

## Branch and publication policy
`main` is kept unchanged. All implementation takes place on `development`. This repository is **private**; source-control access is not the same as a public website.

The development workflow validates the prototype and uploads a downloadable artifact **only**. It does not publish a website, expose an endpoint, enable GitHub Pages or deploy restricted content. A hosted preview requires an explicit hosting/access decision.

**Security:** A static HTML bundle cannot enforce confidentiality. Any future protected Leadership & Strategy section must have server-side authentication, authorization and media/file access controls. Do not commit confidential employee, supplier, pricing or program data or publish employer-owned imagery without approval.

## Next concept work
1. Confirm public name and desired leadership narrative.
2. Confirm metrics as achieved vs targeted; seek publication permission for project imagery.
3. Refine desktop/mobile layouts and responsive case-study experience.
4. Build data-backed project/perspective pages and approve each for publication.
5. Decide authenticated hosting for internal content; do not use GitHub Pages as a confidential file store.
