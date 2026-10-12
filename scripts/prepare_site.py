from pathlib import Path
import sys, shutil
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1] if len(sys.argv)>1 else ".").resolve()
out.mkdir(parents=True,exist_ok=True)
html=(root/"index.html").read_text(encoding="utf-8")
assert "H05 Triple Register Portfolio" in html
assert all(k in html for k in ('id="view-cv"','id="view-projects"','id="view-private"','id="protectedArea"','const translations'))
if out!=root:
    shutil.copy2(root/"index.html",out/"index.html")
    (out/"assets").mkdir(exist_ok=True)
for name in ("present","workshop","team","coach","collab","factory"):
    p=root/"assets"/(name+".webp")
    assert p.exists() and p.stat().st_size>1000,"Missing redacted asset: "+name
    if out!=root: shutil.copy2(p,out/"assets"/p.name)
(out/".nojekyll").touch()
print("Prepared H05 triple register portfolio with redacted workplace assets.")
