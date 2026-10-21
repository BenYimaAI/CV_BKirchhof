"""Assemble the GitHub Pages bundle from the public shell and the ciphertext vault.

The output directory receives only:
  index.html
  cv-access.js
  private/registers.enc.json
  .nojekyll

Register HTML, register translations, and the access code are refused.
"""
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
FORBIDDEN = (
    "const PASSWORD",
    "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    'id="view-cv"',
    'id="view-projects"',
    'id="view-private"',
    "cvHeroLead",
    "cvHeroTitle",
    "sportsText",
    "sportsTitle",
    "mindsetText",
    "mindsetTitle",
    "privateHeroLead",
    "privateHeroTitle",
    "proj1Text",
    "proj2Text",
    "proj3Text",
    "proj4Text",
    "projectsHeroLead",
    "aiVisionText",
    "motivationText",
    "leadershipText",
    "curatedNote",
    "String.fromCharCode(112,97,115,115,119,111,114,100)",
    "assets/present.webp",
    "assets/workshop.webp",
    "assets/team.webp",
    "assets/coach.webp",
    "assets/collab.webp",
    "assets/factory.webp",
    "assets/visit.webp",
)
REQUIRED = (
    'id="gateway"',
    'id="protectedArea"',
    'id="registerMount"',
    'id="publicCopy"',
    "cv-access.js",
    "PBKDF2",
)


def fail(message):
    raise SystemExit(message)


def scan(label, text):
    for marker in FORBIDDEN:
        if marker in text:
            fail(f"{label} still contains private marker: {marker}")


def output_dir(raw):
    out = Path(raw)
    if not out.is_absolute():
        out = Path.cwd() / out
    out = out.resolve()
    if out == ROOT:
        fail("Refusing to build into the repository root.")
    try:
        inside_repo = out.relative_to(ROOT)
    except ValueError:
        inside_repo = None
    if inside_repo is not None and "public-site" not in inside_repo.parts:
        fail("Refusing to build into a source directory: " + str(out))
    return out


def main():
    out = output_dir(sys.argv[1] if len(sys.argv) > 1 else "public-site")

    index = (ROOT / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "cv-access.js").read_text(encoding="utf-8")
    vault_path = ROOT / "private" / "registers.enc.json"
    if not vault_path.exists() or vault_path.stat().st_size < 1000:
        fail("Missing ciphertext vault private/registers.enc.json")
    vault = vault_path.read_text(encoding="utf-8")
    if '"kdf":"PBKDF2-SHA-256"' not in vault and '"kdf": "PBKDF2-SHA-256"' not in vault:
        fail("Vault is not a PBKDF2-SHA-256 ciphertext file")
    if '"iterations":600000' not in vault and '"iterations": 600000' not in vault:
        fail("Vault iteration count is below the required 600000")

    for key in REQUIRED:
        if key not in index and key not in script:
            fail("Public shell is missing " + key)
    scan("index.html", index)
    scan("cv-access.js", script)
    scan("private/registers.enc.json", vault)

    if out.exists():
        shutil.rmtree(out)
    (out / "private").mkdir(parents=True)
    (out / "index.html").write_text(index, encoding="utf-8")
    (out / "cv-access.js").write_text(script, encoding="utf-8")
    (out / "private" / "registers.enc.json").write_text(vault, encoding="utf-8")
    (out / ".nojekyll").touch()

    published = []
    for path in out.rglob("*"):
        if path.is_file():
            published.append(path.relative_to(out).as_posix())
            if path.suffix in {".html", ".js", ".json", ".txt", ".md"} or path.name == ".nojekyll":
                scan(path.relative_to(out).as_posix(), path.read_text(encoding="utf-8"))
    expected = {"index.html", "cv-access.js", "private/registers.enc.json", ".nojekyll"}
    if set(published) != expected:
        fail("Public bundle has unexpected files: " + ", ".join(sorted(published)))
    print("Prepared public site with encrypted registers only.")


if __name__ == "__main__":
    main()
