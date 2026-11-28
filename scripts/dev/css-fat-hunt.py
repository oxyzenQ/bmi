#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
"""CSS fat hunt: find selectors with zero literal references in the source tree.

Conservative: a selector class is only reported when its literal token appears
NOWHERE outside src/styles/ (svelte/ts/html sources). Dynamic classes survive
because they are still built from literal strings somewhere.
"""

import os
import re
import sys

ROOT = "/home/z/my-project/bmi"
STYLES = os.path.join(ROOT, "src", "styles")

# Gather source corpus (everything except styles + node_modules + build dirs)
corpus_lines = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [
        d for d in dirnames
        if d not in {"node_modules", ".git", ".svelte-kit", ".vercel", "dist", "build", "coverage", "scripts", "docs", "assets", "download", "repos-for-ci", "engine"}
    ]
    for fn in filenames:
        if fn.endswith((".svelte", ".ts", ".js", ".html", ".py", ".sh")):
            p = os.path.join(dirpath, fn)
            try:
                with open(p, encoding="utf-8", errors="ignore") as f:
                    corpus_lines.append(f.read())
            except OSError:
                pass
corpus = "\n".join(corpus_lines)

# Extract all class selectors from CSS (including inside media queries)
classes: dict[str, list[str]] = {}
for fn in sorted(os.listdir(STYLES)):
    path = os.path.join(STYLES, fn)
    text = open(path, encoding="utf-8").read()
    # strip comment lines to avoid false positives
    text_nc = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    for m in re.finditer(r"\.([A-Za-z][A-Za-z0-9_-]*)", text_nc):
        cls = m.group(1)
        classes.setdefault(cls, []).append(fn)

total = len(classes)
dead: list[tuple[str, list[str]]] = []
for cls, files in sorted(classes.items()):
    # literal occurrence outside styles (word-boundary, quote-friendly)
    if not re.search(r"(?<![\w-])" + re.escape(cls) + r"(?![\w-])", corpus):
        dead.append((cls, files))

print(f"selectors: {total}")
print(f"zero-reference candidates: {len(dead)}")
for cls, files in dead:
    print(f"  DEAD .{cls}  ({', '.join(sorted(set(files)))})")

# Also find duplicate selector blocks (same selector string appearing 2+ times
# in the SAME file at top level or in different media contexts is expected;
# report only same-selector-same-context dupes)
print("---duplicate selector keys within one file (same selector text 2+ times)---")
dupes = 0
for fn in sorted(os.listdir(STYLES)):
    path = os.path.join(STYLES, fn)
    text = open(path, encoding="utf-8").read()
    text_nc = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    # selector -> count (whole file, any context; dedupe check by selector text)
    sel_counts: dict[str, int] = {}
    for line in text_nc.splitlines():
        s = line.strip()
        if s.endswith("{") and "," not in s and ":" not in s.replace("::", "''"):
            sel = s[:-1].strip()
            sel_counts[sel] = sel_counts.get(sel, 0) + 1
    for sel, c in sorted(sel_counts.items()):
        if c > 1 and not sel.startswith("@"):
            print(f"  {fn}: '{sel}' x{c}")
            dupes += 1
print(f"dup selector-text groups: {dupes}")
