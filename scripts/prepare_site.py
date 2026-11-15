"""Assemble the GitHub Pages bundle from the public shell and the ciphertext vault.

The output directory receives only:
  index.html
  cv-access.js
  private/registers.enc.json
  .nojekyll
  assets/studies/*.webp          personal component illustrations
  assets/fonts/*                 self-hosted UI fonts and their licenses

Register HTML, register translations, and the access code are refused.
The battery study is the exploded view without the upper housing cover.
"""
from pathlib import Path
import re
import shutil
import subprocess
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
# The gateway must stay a decryptor. The daily code is applied only while
# sealing the Pages bundle, never by comparing a typed value in the browser.
FRONTEND_FORBIDDEN = (
    "Ben_",
    "Asia/Shanghai",
    "DDMMYYYY",
    "sealedFor",
    "Intl.DateTimeFormat",
)
STUDIES = (
    "assets/studies/m177-crankcase.webp",
    "assets/studies/m276-crankcase.webp",
    "assets/studies/om642-crankcase.webp",
    "assets/studies/hv-battery-exploded.webp",
    "assets/studies/mma-battery-4module.webp",
    "assets/studies/eats-20-cutaway.webp",
    "assets/studies/mma-rear-edu.webp",
)
FONTS = (
    "assets/fonts/outfit-400.woff2",
    "assets/fonts/outfit-500.woff2",
    "assets/fonts/outfit-600.woff2",
    "assets/fonts/ibm-plex-mono-400.woff2",
    "assets/fonts/ibm-plex-mono-500.woff2",
    "assets/fonts/Outfit-OFL.txt",
    "assets/fonts/IBMPlexMono-OFL.txt",
)


def fail(message):
    raise SystemExit(message)


def scan(label, text):
    for marker in FORBIDDEN:
        if marker in text:
            fail(f"{label} still contains private marker: {marker}")


def scan_gateway(label, text):
    scan(label, text)
    for marker in FRONTEND_FORBIDDEN:
        if marker in text:
            fail(f"{label} contains vault-seal logic: {marker}")


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
    referenced = set(re.findall(r"assets/studies/[a-z0-9-]+\.webp", index))
    if referenced != set(STUDIES):
        fail("Illustration allowlist does not match index.html: " + ", ".join(sorted(referenced.symmetric_difference(STUDIES))))
    if "04_" in index or "ohne_Deckel" in index or "mit_Deckel" in index:
        fail("index.html references a source battery filename instead of the published study")
    if '"sealedFor"' not in vault:
        fail("Source vault is missing sealedFor, so Pages cannot open it")
    scan_gateway("index.html", index)
    scan_gateway("cv-access.js", script)
    scan("private/registers.enc.json", vault)

    if out.exists():
        shutil.rmtree(out)
    (out / "private").mkdir(parents=True)
    (out / "index.html").write_text(index, encoding="utf-8")
    (out / "cv-access.js").write_text(script, encoding="utf-8")
    (out / "private" / "registers.enc.json").write_text(vault, encoding="utf-8")
    (out / ".nojekyll").touch()
    subprocess.run(
        ["node", str(ROOT / "scripts" / "private_vault.mjs"), "write-public-vault", str(out / "private" / "registers.enc.json")],
        check=True,
        cwd=ROOT,
    )
    for rel in STUDIES + FONTS:
        src = ROOT / rel
        if not src.is_file() or src.stat().st_size < 40:
            fail("Missing public asset " + rel)
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)

    published = []
    for path in out.rglob("*"):
        if path.is_file():
            published.append(path.relative_to(out).as_posix())
            if path.suffix in {".html", ".js", ".json", ".txt", ".md"} or path.name == ".nojekyll":
                text = path.read_text(encoding="utf-8")
                rel = path.relative_to(out).as_posix()
                scan(rel, text)
                if path.suffix in {".html", ".js"}:
                    scan_gateway(rel, text)
                if rel == "private/registers.enc.json" and '"sealedFor"' in text:
                    fail("public vault still carries the source seal date")
    expected = {"index.html", "cv-access.js", "private/registers.enc.json", ".nojekyll", *STUDIES, *FONTS}
    if set(published) != expected:
        fail("Public bundle has unexpected files: " + ", ".join(sorted(published)))
    print("Prepared public site with encrypted registers only.")


if __name__ == "__main__":
    main()
