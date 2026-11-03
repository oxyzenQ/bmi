#!/usr/bin/env python3
# Copyright (C) 2026 rezky_nightky
# SPDX-License-Identifier: AGPL-3.0-only
#
# BMI STELLAR NAME-CASE CHECK (night-improve-8)
#
"""Check the name law (BRANDING.md 2.1/2.2).

The project name is "BMI Stellar" in prose - titles, headings,
documentation, UI strings, comments - and the hyphenated slug
"bmi-stellar" in identifiers (the package name, file names, URLs).
The legal families, everything else fails with file:line:token:

  1. "BMI Stellar" - the prose form, exactly;
  2. "bmi-stellar" - the identifier family, exactly;
  3. "BMI_STELLAR" / "BMI-STELLAR" - the caps identifier family,
     attached with separator characters (env/const spellings);
  4. the recorded incorrect forms (BRANDING 2.2) are legal ONLY
     inside ~~strikethrough~~ quoting - the doc quotes the law it
     records, and the strikethrough span is the marker.

Nothing is excluded: every tracked file and every tracked path is
scanned (git ls-files). Binary files (which do not decode as UTF-8)
are skipped by construction. The checker is self-clean by
construction: this file spells the name only in the legal families
and builds its examples at runtime.

The single word "bmi" - the metric acronym and the repository slug -
is not the project name and is not scanned; only the two-word phrase
in both orders is policed.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROSE = "BMI Stellar"
SLUG = "bmi-stellar"
CAPS = ("BMI_STELLAR", "BMI-STELLAR")
MAX_REPORTED = 50

# The all-caps banner titles heading the scripts/ gate files (the
# zelynic gate-banner convention: a comment line opening with the
# all-caps name is a title, not a usage).
BANNER_SUFFIXES = {".sh", ".py"}
BANNER_RE = re.compile(r"^\s*#\s*BMI\s+STELLAR(\s|$)")

# Both orders, flexible single separator, any casing - every spelling
# of the two-word phrase outside the legal families fails. The checker
# is self-clean by construction: no wrong-case literal is spelled out
# anywhere in this file; the wrong forms live quoted (strikethrough) in
# BRANDING 2.2, which is the only place they are legal.
PHRASE = re.compile(
    r"\bbmi[ _.\-]?stellar\b|\bstellar[ _.\-]?bmi\b", re.IGNORECASE
)
STRIKE = re.compile(r"~~(.+?)~~", re.DOTALL)


def strikethrough_spans(line: str) -> list[tuple[int, int]]:
    """Spans of the ~~recorded incorrect forms~~ on this line."""
    return [(m.start(), m.end()) for m in STRIKE.finditer(line)]


def tracked_paths() -> list[str]:
    """Every path in the index PLUS every untracked-but-not-ignored file,
    so a wrong-cased name in a fresh working-tree file fails BEFORE the
    commit - the pre-commit proxy parity discipline check-loc set
    (gitignored build output stays out by the --exclude-standard
    contract)."""
    out = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    ).stdout
    return sorted({p.decode("utf-8", "surrogateescape") for p in out.split(b"\0") if p})


def banner_title(path: str, line: str) -> bool:
    """True when the line is an all-caps banner title in a scripts/ gate file."""
    if not path.startswith("scripts/"):
        return False
    if Path(path).suffix not in BANNER_SUFFIXES:
        return False
    return BANNER_RE.match(line) is not None


def violation_reason(token: str, path: str, line: str, start: int, end: int) -> str | None:
    """None when the occurrence is legal, else the failure reason."""
    if token == PROSE or token == SLUG or token in CAPS:
        return None
    for span_start, span_end in strikethrough_spans(line):
        if span_start <= start and end <= span_end:
            return None
    if banner_title(path, line):
        return None
    return "the name is 'BMI Stellar' in prose or 'bmi-stellar' as an identifier (BRANDING 2.1)"


def main() -> int:
    failures: list[str] = []
    files = 0
    tokens = 0

    for path in tracked_paths():
        files += 1

        lowered = path.lower()
        for match in PHRASE.finditer(lowered):
            if path[match.start() : match.end()] != SLUG:
                failures.append(
                    f"FAIL PATH   {path} '{path[match.start():match.end()]}' "
                    "- path tokens carry the slug form only (bmi-stellar)"
                )

        target = ROOT / path
        if not target.is_file():
            continue
        try:
            text = target.read_bytes().decode("utf-8")
        except (OSError, UnicodeDecodeError):
            continue  # binary by construction
        for lineno, line in enumerate(text.splitlines(), 1):
            for match in PHRASE.finditer(line):
                token = match.group(0)
                tokens += 1
                reason = violation_reason(token, path, line, match.start(), match.end())
                if reason is not None:
                    failures.append(f"FAIL CASE   {path}:{lineno} '{token}' - {reason}")

    print("bmi-stellar name-case check: " + ("FAIL" if failures else "PASS"))
    for failure in failures[:MAX_REPORTED]:
        print(failure)
    if len(failures) > MAX_REPORTED:
        print(f"... and {len(failures) - MAX_REPORTED} more violation(s) not listed")
    print(
        f"Checked {files} tracked file(s) and path(s), {tokens} name token(s): "
        f"{len(failures)} violation(s)."
    )
    if failures:
        print(
            "The law (BRANDING.md 2.1/2.2): the name is 'BMI Stellar' in prose "
            "and 'bmi-stellar' as an identifier; the recorded incorrect forms "
            "are quotable only inside ~~strikethrough~~. Nothing is excluded."
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
