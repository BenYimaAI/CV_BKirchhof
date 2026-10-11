from pathlib import Path
import sys, shutil

root = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
output.mkdir(parents=True, exist_ok=True)
source = root / "index.html"
html = source.read_text(encoding="utf-8")
assert "H04.1" in html and 'id="portfolio" hidden' in html
assert 'function guardHash()' in html and "const translations=" in html
assets = ["present","factory","coach","visit","team","workshop","collab"]
for name in assets:
    original = root / "assets" / (name + ".webp")
    assert original.exists() and original.stat().st_size > 1000, "Missing " + name
    if output != root:
        (output / "assets").mkdir(exist_ok=True)
        shutil.copy2(original, output / "assets" / original.name)
if output != root:
    shutil.copy2(source, output / "index.html")
(output / ".nojekyll").touch()
print("H04.1 ready: multilingual portfolio and seven edited assets.")
