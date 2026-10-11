# Interactive Executive CV — Dual Experience Concept v0.2

**Revision:** v0.2 / 2026-10-11  
**Decision captured:** BOTH audience experiences, with a mandatory first-screen choice.  
**Status:** Concept and interactive HTML demonstration, **not published** or security-certified.  
**Input:** Submitted 2026 internal CV and earlier Concept v0.1.  
**Handover prototype:** `Benjamin_Interactive_CV_Dual_Experience_H01_20261011.html`

## 1. The core interaction

The root `/` of the website is always an **experience selector**. The visitor chooses their intent *before* navigating into the profile.

**First-visit message:** "Engineering what comes next. One career. Two perspectives. Choose your experience."

| Choice | User experience | Availability |
|---|---|---|
| **01 — Public Portfolio / Explore My Work** | Editorial executive overview, validated achievements, selected career timeline, approved projects, public market perspectives, contact and CV | Open, no sign-in |
| **02 — Leadership & Strategy** | Leadership philosophy, organizational impact, deeper strategic arguments, evaluated proposals, detailed case studies and approval-cleared evidence | Authentication + authorization before protected content is delivered |

The selector is not a "select account type" gate; it is a visitor journey router. Nobody should be told that restricted data is already available. A visible "Switch experience" link is available from either path. No automatic persistence of the selected route in the MVP: the default root always returns to choice. Intentional deep links to public content may bypass the selector; authorized private deep links first require login.

## 2. UX behavior & IA

### Welcome (`/`)
- Personal monogram/name; editorial introduction; two large, equally prominent choice cards.
- Choice one: bright, approachable editorial panel (accessible public profile).
- Choice two: restrained graphite executive panel with clear *access required* note.
- Desktop: two equal-width cards below a concise hero. Mobile: vertically stacked cards, with clearly readable touch targets.
- Mouse, keyboard and touch navigation. No password input directly on the chooser.

### Public portfolio (`/portfolio/`)
- Home / key differentiator: Engineering depth, international experience, leadership, AI transformation.
- Career: interactive timeline and selected CV-derived milestones.
- Impact: approved engineering case studies and verified measurable results.
- Projects: public-safe demonstrations of engineering, planning and digital projects; **no live internal data**.
- Perspectives: authored viewpoints based on dated *public* research with explicit separation between facts and interpretation.
- About and contact: editorial leadership statement and permission-cleared professional contact info.
- Downloadable version: sanitized **public** CV, once checked for release.
- Mobile: single-column hierarchy, collapsible detail, performance-minded navigation.

### Leadership & Strategy (`/leadership/`)
- Initially public-safe access introduction only: explains expected audience and content; login/identity is required.
- Authenticated entry: identity and role validation before the content response.
- Private home: individual philosophy, career motivation, management impact, executive narrative.
- Deeper portfolio: sanitized and authorized industrialization results, supplier strategy, investment/operations reasoning.
- Perspectives lab: public versus approved internal analysis clearly separated, provenance and sensitivity labels visible.
- Executive discussion: evidence-backed ideas and proposed company growth/transformation levers.
- Show the same "Switch experience" control; logging out/returning to public must not leak private responses or caches.
- **Not implemented in H01 preview:** actual account login, permission grants or internal content delivery.

### Shareable deep link and state rules
- `/` = visitor chooses.
- `/portfolio/` and `/portfolio/{case-study-slug}` = public route.
- `/leadership/` and `/leadership/{topic}` = protected route, check access on every request.
- H01 standalone demo uses `#choose`, `#public`, `#public-experience`, `#public-perspectives`, `#internal` instead of separate server routes; this is presentation-only routing.

## 3. Information classification & permissions

| Content group | Public | Restricted, after authorization | Unapproved source |
|---|---|---|---|
| CV factual milestones | Yes, scrubbed | Yes | Mark for review |
| Verified professional awards | Only with permission | Where permitted | Omit |
| Employer/supplier production photos | Only if approved | Permission-checked | Never embed |
| Internal KPIs, CAPEX, supplier quotations | No | Only explicit need-to-know / owner approval | Never embed |
| Real POS-AI dashboards/data | Only synthetic/redacted reproductions | Approval-dependent | No |
| SEVC POWER confidential working dossier | No | Only with explicit source-owner approval, if any | Withhold |
| Public market research and original commentary | Yes, cited and date-stamped | Yes | Label assumptions |

**No client-side secrets:** authorization must be enforced on the server/edge (and on endpoints and files); a JavaScript view toggle or downloadable static HTML must never contain private data. If using Astro, keep the public pages prerendered; use an SSR adapter for the protected pages, check permissions before rendering or serving any protected response. See: <https://docs.astro.build/en/guides/authentication/> and <https://docs.astro.build/en/guides/on-demand-rendering/>. OWASP: <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>.

**Implementation caveat:** Company Microsoft Entra ID / SSO may be suitable only if approved and supported by the employer; otherwise use a separate approved access service with named, auditable viewer permissions. Hosting entirely on static GitHub Pages is not adequate for serving private content from the same public bundle.

## 4. Shared design with audience-specific emphasis

**Brand unity:** same name/logo, core typography, color tokens, biography and provenance conventions.

**Public expression:** generous white space, portrait, animated-but-reduced-motion-aware timeline, selected KPIs and research narratives.

**Private expression:** denser evidence-oriented structures, strategy briefs, explanatory charts, decision logic, evaluation matrices and approved supplemental documentation. Avoid overwhelming users on the landing page.

**Mandatory interaction:** a visible return to experience selector in both paths, keyboard focus management on route changes, support for mobile touch, clear access status, no inaccessible hover-only navigation.

## 5. Data model updates for v0.2

For every content record add:
- `audience`: `public` | `leadership`
- `classification`: `public` | `internal` | `restricted` | `confidential`
- `approval_status`: `draft` | `in_review` | `approved` | `withdrawn`
- `approval_owner`, `approval_date`, `evidence_reference`, `last_verified`
- `requires_authentication`, `authorized_roles`, `assets_classification`

**Release predicate** (concept, not actual permission code): a public record may only be published if classified public *and* approved. A leadership record additionally requires approved publication to the defined audience, server-authenticated identity and verified authorization; access to documents/media must be checked independently.

Recommended Notion databases: Projects & Evidence, Leadership Cases, Market & Strategy Articles, Asset Permissions, Publication/Approval Register. Syncing to the site requires a publication pipeline that enforces the same rules; never put private Notion tokens or full private records in client-side JS.

## 6. MVP acceptance criteria

1. Opening the root of the site shows the selection before any portfolio material.
2. Public pathway works without login and reveals only approved, public-safe content.
3. Internal pathway has a meaningful introduction but returns no restricted data without server-side authorization.
4. Switch navigation works both ways, including when using Back/Forward and direct links.
5. Responsive behavior at 320, 390, 768 and 1440 CSS-pixel widths, no accidental horizontal overflow.
6. Full keyboard navigation, logical focus order, screen-reader text, motion reduction, proper accessible feedback.
7. All public KPIs distinguish achieved versus planned values and have evidence / release status.
8. Protected documents, media URLs and APIs are not exposed to anonymous visitors, the public HTML/JS bundle or caches.
9. Standard automated browser/security QA; explicitly distinguish verified tests from unperformed tests.

## 7. H01 demonstration status (2026-10-11)

**Implemented:** two-card initial selector; click/tap navigation to public and private-introduction screens; return/switch controls; public hero, embedded CV portrait, timeline, figures and proposed article topics; private-introduction warning; responsive CSS; reduced-motion styling; self-contained HTML with no remote JS or image dependency.

**Demonstration limitation:** An actual secured leadership portal cannot be provided by a standalone HTML file. H01 therefore contains **no restricted materials** and explicitly explains that identity integration remains pending. H01 is not a deployed website and should not be treated as confidential-content security architecture.

**Source/content caveat:** Name and portrait come from the submitted CV, which is not by itself external publication approval. Exact displayed professional name, employer/award imagery, the ~9% historical gain definition and all project publication permissions still need confirmation before going live.

## 8. Next decisions

- Confirm final displayed name/brand for the two experiences.
- Define access audience for Leadership & Strategy: named individuals, company personnel via approved SSO, or invited external recruiters / executives.
- Confirm hosting, authentication and content ownership before developing the protected branch.
- Approve visual direction and content inventory, then replace editorial placeholders with sourced, publication-approved writing.