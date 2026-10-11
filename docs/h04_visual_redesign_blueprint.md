# CV H04 — Visual-first redesign blueprint
**Status:** Concept prototype / private review only  
**Date:** 2026-10-11  
**Target:** `development` → separate review → approved `main` release  
**Source content:** 2026 CV, 2024 Gen-5 Talent Pitch, seven user-supplied workplace photographs.

## Objective
Replace the text-heavy sequential CV with a visual executive portfolio where authentic evidence, simplified engineering graphics and progressive disclosure communicate value. Keep two-path landing navigation and preview password gate, but do not treat JavaScript password prompts as security.

## Screen design
1. **Landing / experience chooser:** Photo-led editorial hero, two visitor routes, compact profile snapshot, trilingual selector (English, German, Simplified Chinese), access-code request mailto. Photo of Gen-5 presentation in the **private prototype only**.
2. **Featured projects:** Gen-5 battery, eATS2.0 eDrive, automated V8 manufacturing, digital and AI engineering. 16:9 image/diagram-led tiles, one-line value proposition, open detail on demand.
3. **Gen-5 case:** production reality → locally planned engineering concept → team mobilisation → transferable learning. Display a carefully curated real-photo story only after clearance. Avoid internal investment, OEE, supplier and detailed process/layout data in public.
4. **Skills:** four visual capability clusters — manufacturing/equipment, industrial engineering, leadership/integration, digital/AI. Avoid fabricated proficiency percentages.
5. **Leadership:** photo-supported stakeholder communication, team collaboration, facilitation and coaching, with concise image captions.
6. **AI and planning future:** an explanatory 3-stage retrieval → governed agent → visual decision architecture; demo visualisation is clearly *conceptual*, not a real-data dashboard.
7. **Recognition:** AI Transformation, Digitalization Pioneer, Talent of the Year. Connect award cards to underlying evidence and initiatives; add scans only when cleared.

## User-supplied image inventory and proposed use (not publication approval)
| Asset | Private concept usage | Disclosure concern | Status |
|---|---|---|---|
| `IMG_5856.jpeg` | Leadership / stakeholder exchange | Multiple third-party faces and branding | Permission needed |
| `ead9cec919b0b247c402c4c5ce7e90d4.jpeg` | Gen-5 presentation / landing candidate | Visible internal presentation and branding | Permission and slide-content review needed |
| `IMG_0018.jpeg` | Team/leadership card | Multiple third-party faces | Permission needed |
| `IMG_3409.jpeg` | Planning workshop | Whiteboard/process content and third-party faces | Clearance/redaction review needed |
| `IMG_4745.jpeg` | Collaboration | Colleague present | Permission needed |
| `IMG_0476.jpeg` | Workshop/facilitation | Whiteboard and colleagues | Clearance/redaction review needed |
| `IMG_0128.jpeg` | Gen-5 manufacturing reality | Industrial installation/process/layout details | Company publication approval needed |

**Important:** The repository is public, including the `development` branch. Uploading these photographs to that branch makes them publicly retrievable. No provided photos are committed here.

## Internationalization — mandatory final release check
- English (`en`), German (`de`), Simplified Chinese (`zh-CN`).
- Language selector visible from the landing page, mobile-friendly and keyboard accessible; language names accompany requested flag icons.
- All content including dialogs, buttons, navigation, image alt text, email-request subject/body, badges, notices, diagrams and expandable descriptions must be translated. No mixed-language release unless clearly labelled.
- Save language preference locally and update `document.documentElement.lang`.
- Trilingual content parity testing is a release gate.
- Keep all language versions evidence-equivalent: never amplify a claim through translation.

## Responsive and accessibility QA
- 320/390/768/1440 px widths, no horizontal overflow, 44px target sizing, accessible focus and modal behavior.
- Responsive source images, explicit dimensions, lazy-load offscreen assets, substantive `alt` text, contrast/reduced-motion checks, optional image lightbox after clearance.
- Never publish project screenshots that reveal confidential product data, supplier information or unauthorized faces.

## Acceptance criteria before deployment
- [x] Create a private self-contained H04 concept preview using seven provided photographs.
- [x] Local prototype includes EN/DE/zh-CN language switching and persisted preference (90 translated keys).
- [x] Concept includes photo-led projects, Gen-5 story, skills map, leadership mosaic and AI architecture.
- [ ] User validates photo rights and engineering-information disclosure.
- [ ] Integrate selected approved imagery into the actual GitHub site.
- [ ] Translate all existing H03 CV text (the H04 standalone preview only translates its own revised content).
- [ ] Automated cross-device, navigation, performance and localization regression checks.
- [ ] Explicit release approval, then merge and deploy.

**Prototype delivery:** `CV_BKirchhof_H04_Private_Visual_Preview.html` is a local conversation artifact, not committed to GitHub and not the live website.

## References / source of design standards
- W3C: language should be identified using text rather than flags alone; language attributes use standard tags.
- web.dev: responsive images, alt text, intrinsic dimensions and lazy loading for offscreen photos.
