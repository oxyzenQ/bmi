#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
"""Local proof harness for the AXP1-ZnQ probe laws (night-learning-
into-darkness-1). Serves a fake InRelease with a frozen 2020 Date
header, then asserts the verdict paths against real code:

  1. STALE: the frozen index is refused by the refresher law
     (--max-age-days), never written back as a survivor;
  2. exit-1 loud: a catalog with no live address makes the resolver
     fail (never a dead default), exit 1;
  3. PASS: a fresh Date header passes and the resolver picks it.

Run: python3 scripts/dev/axp1znq_edge_proof.py   (binds 127.0.0.1 only)
"""
import http.server
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FROZEN_DATE = "Mon, 01 Jan 2020 00:00:00 GMT"
FRESH_DATE = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())

BODY = b"-----BEGIN PGP SIGNED MESSAGE-----\nfake InRelease for the local probe proof\n"


class FrozenHandler(http.server.BaseHTTPRequestHandler):
    date = FROZEN_DATE

    def do_GET(self):
        # send_response_only: the stock send_response injects its own
        # current-time Date header, which would shadow the frozen one
        # this harness exists to test.
        self.send_response_only(200)
        self.send_header("Date", self.date)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(BODY)))
        self.end_headers()
        self.wfile.write(BODY)

    def log_message(self, *args):
        pass


def run_resolver(catalog: Path, extra=()):
    return subprocess.run(
        [sys.executable, str(REPO / "scripts/ci/axp1znq_resolve.py"),
         "--file", str(catalog), "--attempts", "1", "--total-timeout", "4",
         *extra],
        capture_output=True, text=True, timeout=120,
    )


def run_refresher(catalog: Path, tmp_root: Path, extra=()):
    (tmp_root / "repos-for-ci").mkdir(parents=True, exist_ok=True)
    target = tmp_root / "repos-for-ci" / "edge.txt"
    target.write_text(catalog.read_text())
    return subprocess.run(
        [sys.executable, str(REPO / "scripts/ci/axp1znq_refresh.py"),
         "--root", str(tmp_root / "repos-for-ci"),
         "--attempts", "1", "--total-timeout", "4", *extra],
        capture_output=True, text=True, timeout=180,
    ), target


def main() -> int:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), FrozenHandler)
    port = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    tmp = Path("/tmp/axp1-edge-proof")
    tmp.mkdir(exist_ok=True)
    failures = []

    # 1. STALE law: the frozen index must be refused as a survivor.
    #    The never-empty guard keeps a 0-alive catalog untouched (the
    #    address line stays, no tombstone is written) and the lane
    #    escalates CALL THE OWNER.
    stale_catalog = tmp / "stale.txt"
    stale_catalog.write_text(f"http://127.0.0.1:{port}\n")
    refresh, target = run_refresher(stale_catalog, tmp / "t1",
                                    extra=["--max-age-days", "14"])
    body = target.read_text()
    ok = ("1 stale" in refresh.stdout and "CALL THE OWNER" in refresh.stdout
          and body.lstrip().startswith("http")  # untouched, never erased
          and "# down" not in body)
    print(f"TEST stale-refusal: {'PASS' if ok else 'FAIL'}")
    print(f"  refresher: {refresh.stdout.strip().splitlines()[-1:]}")
    if not ok:
        failures.append("stale refusal")

    # 2. Resolver on the frozen index with the age policy rides too:
    #    the resolver reports freshness but never blocks the pick, so
    #    the pick stands; assert it prints the address, exit 0.
    resolve = run_resolver(stale_catalog)
    ok = resolve.returncode == 0 and f"127.0.0.1:{port}" in resolve.stdout
    print(f"TEST resolver-pick-despite-reported-age: {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures.append("resolver pick despite age")

    # 3. Exit-1 loud: a catalog of dead addresses must exit 1.
    dead_catalog = tmp / "dead.txt"
    dead_catalog.write_text("https://192.0.2.1/ubuntu\n")
    resolve = run_resolver(dead_catalog, extra=["--first"])
    ok = resolve.returncode == 1
    print(f"TEST all-dead-exit-1: {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures.append("all-dead exit 1")

    # 4. PASS path: flip the handler to a fresh Date, the refresher
    #    keeps the address as a survivor and the resolver picks it.
    FrozenHandler.date = FRESH_DATE
    fresh_catalog = tmp / "fresh.txt"
    fresh_catalog.write_text(f"http://127.0.0.1:{port}\n")
    refresh, target = run_refresher(fresh_catalog, tmp / "t4",
                                    extra=["--max-age-days", "14"])
    body = target.read_text()
    ok = ("1 alive" in refresh.stdout and body.lstrip().startswith("http"))
    print(f"TEST fresh-kept-as-survivor: {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures.append("fresh survivor kept")

    server.shutdown()
    if failures:
        print(f"EDGE PROOF: FAIL ({failures})")
        return 1
    print("EDGE PROOF: all four laws hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
