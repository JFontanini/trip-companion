#!/usr/bin/env python3
"""House writing and token checks for trip-companion.

Mirrors the writing rules in fontanini-advisor-os knowledge/working-method/writing-conventions.md
as applied in catalyst-academy-site: no em or en dashes, straight quotes only. Runs on every
push in CI. Exits non-zero with file:line for each finding.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCAN = [".html", ".js", ".mjs", ".json", ".css", ".md", ".rules", ".yml"]
SKIP_DIRS = {"node_modules", "dist", ".git", "dev-dist"}
SKIP_FILES = {"package-lock.json"}
BANNED = {
    "—": "em dash: use a comma, colon or period",
    "–": "en dash: write 'to' for ranges",
    "“": "curly double quote", "”": "curly double quote",
    "‘": "curly single quote", "’": "curly apostrophe",
}

findings = []
HEX = re.compile(r"(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix not in SCAN or path.name in SKIP_FILES:
        continue
    if any(part in SKIP_DIRS for part in path.relative_to(ROOT).parts):
        continue
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for ch, why in BANNED.items():
            if ch in line:
                findings.append(f"{path.relative_to(ROOT)}:{n}: {why}")
        # CLAUDE.md: no colors outside the brand tokens. App code and styles use var(--gcc-*) only.
        rel = path.relative_to(ROOT).parts
        if rel[0] == "src" and path.suffix in (".js", ".css") and HEX.search(line):
            findings.append(f"{path.relative_to(ROOT)}:{n}: hard-coded color: use a token from brands/<brand>/tokens.css")

if findings:
    print("\n".join(findings))
    print(f"\n{len(findings)} style finding(s).")
    sys.exit(1)
print("check-style: clean")
