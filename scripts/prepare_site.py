from pathlib import Path
import sys

target = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
target.mkdir(parents=True, exist_ok=True)
html = Path("index.html").read_text(encoding="utf-8")
tag = '<script src="cv-access.js"></script>'
marker = '  <script>\n  (() => {'
if tag not in html:
    if marker not in html:
        raise SystemExit("Original CV navigation script not found")
    html = html.replace(marker, '  ' + tag + '\n' + marker, 1)
html = html.replace("Concept H01</title>", "Concept H02</title>")
html = html.replace("H01 / 11 OCT 2026", "H02 / 11 OCT 2026")
html = html.replace(
    "You can switch experiences at any time. Restricted material is not included in this concept preview.",
    "Both experiences ask for a preview access code. Do not share confidential project data here."
)
html = html.replace(
    "Secure access is not active in this prototype.",
    "Preview access only. This is not secure authentication."
)
(target / "index.html").write_text(html, encoding="utf-8")
(target / "cv-access.js").write_bytes(Path("cv-access.js").read_bytes())
(target / ".nojekyll").touch()
print("H02 site staged in", target)
