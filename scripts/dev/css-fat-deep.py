#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
"""CSS fat hunt, deep pass.

1. Same-selector rules inside the SAME cascade context (top level or one media
   query) whose declaration bodies are IDENTICAL -> pure duplication, provably
   mergeable.
2. Same-selector same-context bodies that only partially overlap -> report
   (info only, cascade-order dependent).
3. Unused custom properties: a --token defined in tokens.css (or anywhere in
   styles) but never used via var(--token) anywhere.
4. CSS files never imported by src.
"""

import os
import re

ROOT = "/home/z/my-project/bmi"
STYLES = os.path.join(ROOT, "src", "styles")


def parse_blocks(text: str):
    """Yield (context, selector, body) for top-level and one-deep media blocks."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    # capture media queries first
    out = []
    consumed = [0]

    def take_top(m_start, m_end):
        return text[m_start:m_end]

    # walk with a simple scanner
    i = 0
    n = len(text)
    context_stack = []  # list of media conditions
    while i < n:
        at_m = text.find("@media", i)
        at_sup = text.find("@supports", i)
        next_at = min(x for x in (at_m, at_sup) if x != -1) if (at_m != -1 or at_sup != -1) else -1
        # find next '{' before any @media/@supports
        brace = text.find("{", i)
        if brace == -1:
            break
        if next_at != -1 and next_at < brace:
            # a media/supports block starts before this rule: skip its header,
            # then recurse by matching braces
            hdr_open = text.find("{", next_at)
            depth = 1
            j = hdr_open + 1
            while j < n and depth:
                if text[j] == "{":
                    depth += 1
                elif text[j] == "}":
                    depth -= 1
                j += 1
            cond = text[next_at:hdr_open].strip()
            inner = text[hdr_open + 1 : j - 1]
            for ctx, sel, body in parse_blocks(inner):
                out.append((cond + " & " + ctx if ctx else cond, sel, body))
            i = j
        else:
            sel = text[i:brace].strip()
            close = text.find("}", brace)
            if close == -1:
                break
            body = text[brace + 1 : close].strip()
            if sel.startswith("@"):
                # keyframes etc: treat inner as opaque, skip
                inner_close = text.find("}", close + 1) if sel.startswith("@keyframes") else close
                i = (inner_close + 1) if inner_close != -1 else close + 1
            else:
                out.append(("", sel, body))
                i = close + 1
    return out


def norm(body: str) -> str:
    decls = sorted(
        d.strip().rstrip(";").strip()
        for d in body.split(";")
        if d.strip()
    )
    return ";".join(decls)


file_rules: dict[str, list] = {}
for fn in sorted(os.listdir(STYLES)):
    text = open(os.path.join(STYLES, fn), encoding="utf-8").read()
    file_rules[fn] = parse_blocks(text)

print("=== 1. identical selector+body within the same context (pure dupes) ===")
pure = 0
for fn, rules in file_rules.items():
    seen: dict[tuple, int] = {}
    for ctx, sel, body in rules:
        key = (ctx, sel, norm(body))
        seen[key] = seen.get(key, 0) + 1
    for (ctx, sel, body), c in seen.items():
        if c > 1:
            print(f"  {fn}: [{ctx or 'top'}] {sel} {{...}} x{c}")
            pure += 1
print(f"  pure-dupe groups: {pure}")

print("=== 2. same selector repeated in the same context (partial overlap) ===")
part = 0
for fn, rules in file_rules.items():
    seen: dict[tuple, int] = {}
    for ctx, sel, _ in rules:
        key = (ctx, sel)
        seen[key] = seen.get(key, 0) + 1
    for (ctx, sel), c in seen.items():
        if c > 1:
            print(f"  {fn}: [{ctx or 'top'}] {sel} x{c}")
            part += 1
print(f"  same-context repeat groups: {part}")

print("=== 3. custom properties defined but never used ===")
all_css = "\n".join(open(os.path.join(STYLES, f), encoding="utf-8").read() for f in os.listdir(STYLES))
defined = set(re.findall(r"(--[\w-]+)\s*:", all_css))
# usage corpus: src tree (svelte/ts/html) + the css itself
corpus = all_css
for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, "src")):
    for f in filenames:
        if f.endswith((".svelte", ".ts", ".js", ".html")):
            corpus += open(os.path.join(dirpath, f), encoding="utf-8", errors="ignore").read()
for f in ["app.html", "src/app.html", "svelte.config.js", "vite.config.ts"]:
    p = os.path.join(ROOT, f)
    if os.path.isfile(p):
        corpus += open(p, encoding="utf-8", errors="ignore").read()
unused = [v for v in sorted(defined) if corpus.count(f"var({v}") == 0 and corpus.count(f"{v}:") < 2]
for v in unused:
    print(f"  UNUSED {v}")
print(f"  unused props: {len(unused)} / {len(defined)}")

print("=== 4. css import graph ===")
src_corpus = ""
for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, "src")):
    dirnames[:] = [d for d in dirnames if d != "styles"]
    for f in filenames:
        if f.endswith((".svelte", ".ts", ".js", ".html", ".css")):
            src_corpus += open(os.path.join(dirpath, f), encoding="utf-8", errors="ignore").read()
for fn in sorted(os.listdir(STYLES)):
    refs = len(re.findall(re.escape(fn), src_corpus))
    print(f"  {fn}: {refs} reference(s)")
