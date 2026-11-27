#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
# SPDX-License-Identifier: AGPL-3.0-only OR Commercial
# PLATFORM: the CI runners (Linux); any Python 3 host with stdlib works.
#
# BMI STELLAR AXP1-ZNQ PROBE CORE - the shared reachability probe behind
# the repos-for-ci catalog (Architect's eXecution Protocol 1)
#
"""The one probe both AXP1-ZnQ (Architect's eXecution Protocol 1)
commands ride (night-learning-into-darkness-1): the failover resolver
(scripts/ci/axp1znq_resolve.py) walks a catalog serially and stops at
the first live address, and the Sunday refresher
(scripts/ci/axp1znq_refresh.py) probes the whole catalog concurrently
and rewrites it around the survivors. One probe shape keeps the two
verdicts comparable - a mirror the resolver picks and a mirror the
refresher keeps are measured the same way, so the failover pick never
contradicts the weekly catalog.

The catalog law (repos-for-ci/*.txt):

  - one address per line; the address IS the whole trimmed line, so a
    trailing comment on the same line would corrupt the address -
    comments occupy their own line and start with '#';
  - a line with a scheme (https://archive.ubuntu.com/ubuntu) is an
    HTTP(S) address - probed with a real GET, TLS verified with the
    runner's own CA store (a cert failure is DOWN, never ignored);
  - a bare host:port (dns.example.com:53) is a TCP address - probed
    with a socket connect (the DNS-resolver catalog rides this kind
    when its lane adopts the resolver);
  - a bare hostname is accepted and defaults to https (defensive for
    an owner-authored line, never used by the shipped catalog);
  - stdlib only (urllib, socket, concurrent.futures) - no third-party
    dependency joins the maintenance surface, the LTS law.

Every function here is thread-safe and allocation-quiet: the refresher
probes a whole catalog on a thread pool, so nothing in this module
touches shared state.
"""

from __future__ import annotations

import socket
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

VERDICT_PASS = "PASS"
VERDICT_STALE = "STALE"
VERDICT_DOWN = "DOWN"


@dataclass(frozen=True)
class CatalogEntry:
    """One active address line, parsed."""

    lineno: int
    raw: str
    kind: str  # 'http' or 'tcp'
    target: str  # the full URL, or host:port


@dataclass(frozen=True)
class ProbeResult:
    """The verdict for one catalog entry, shared by both commands."""

    verdict: str  # VERDICT_PASS / VERDICT_STALE / VERDICT_DOWN
    latency_ms: Optional[int]  # the successful attempt's round trip
    age_days: Optional[int]  # index age for probed repo paths, else None
    detail: str  # the human reason, written into dated catalog comments


def parse_catalog(text: str) -> List[CatalogEntry]:
    """Parse a catalog body into its active address lines, in order."""
    entries: List[CatalogEntry] = []
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "://" in line:
            entries.append(CatalogEntry(lineno, raw, "http", line))
        elif ":" in line:
            entries.append(CatalogEntry(lineno, raw, "tcp", line))
        else:
            entries.append(CatalogEntry(lineno, raw, "http", f"https://{line}"))
    return entries


def index_age_days(date_header: str, now: datetime) -> Optional[int]:
    """Age in whole days of a repo index from its own Date header.

    The InRelease file a mirror serves carries the archive's publish
    date in the Date header - the honest freshness witness (a mirror
    that answers fast but serves a months-old index is STALE, not
    PASS). Unparsable headers return None and never fabricate an age.
    """
    if not date_header:
        return None
    cleaned = date_header.strip()
    if cleaned.endswith(" UTC"):
        cleaned = cleaned[: -len(" UTC")] + " +0000"
    try:
        published = parsedate_to_datetime(cleaned)
    except (TypeError, ValueError):
        return None
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    return max(0, int((now - published).total_seconds() // 86400))


def probe_http(
    target: str,
    probe_path: str = "",
    connect_timeout: float = 4.0,
    total_timeout: float = 15.0,
    attempts: int = 2,
    max_age_days: Optional[int] = None,
) -> ProbeResult:
    """Probe one HTTP(S) address, newest-style, TLS verified.

    The probe GETs the target (plus the probe path when the caller
    wants a repo's real index, e.g. dists/resolute/InRelease - the
    base URL answering while the index 404s is a DOWN, the lane cannot
    apt from it). A 2xx verdict reads freshness off the response's own
    Date header and hands the STALE call to the caller's policy.

    Timeout honesty: urllib rides one socket timeout, so this probe
    runs on --total-timeout alone (connect and read share it); the
    --connect-timeout flag binds the TCP kind (probe_tcp), never this
    path - the stdlib-only law keeps it that way.
    """
    url = target
    if probe_path:
        url = f"{target.rstrip('/')}/{probe_path.lstrip('/')}"
    last_detail = "no attempt made"
    for attempt in range(1, max(1, attempts) + 1):
        started = time.perf_counter()
        try:
            request = urllib.request.Request(
                url, method="GET", headers={"User-Agent": "AXP1-ZnQ-probe/1"}
            )
            with urllib.request.urlopen(request, timeout=total_timeout) as response:
                latency_ms = int((time.perf_counter() - started) * 1000)
                status = response.getcode()
                now = datetime.now(timezone.utc)
                age = index_age_days(response.headers.get("Date", ""), now)
                if 200 <= status < 300:
                    if age is not None and max_age_days is not None and age > max_age_days:
                        return ProbeResult(
                            VERDICT_STALE,
                            latency_ms,
                            age,
                            f"stale index (age {age}d > {max_age_days}d)",
                        )
                    shape = f"HTTP {status}"
                    if age is not None:
                        shape += f", index age {age}d"
                    return ProbeResult(VERDICT_PASS, latency_ms, age, shape)
                return ProbeResult(
                    VERDICT_DOWN, latency_ms, age, f"HTTP {status} on the probe path"
                )
        except urllib.error.HTTPError as why:
            last_detail = f"HTTP {why.code} on the probe path"
        except (urllib.error.URLError, socket.timeout, OSError) as why:
            reason = getattr(why, "reason", why)
            last_detail = f"unreachable ({reason})" if reason else f"unreachable ({why})"
        except ValueError as why:
            return ProbeResult(VERDICT_DOWN, None, None, f"bad address ({why})")
        if attempt < attempts:
            time.sleep(1.0)
    return ProbeResult(VERDICT_DOWN, None, None, f"{last_detail} after {attempts} attempt(s)")


def probe_tcp(
    target: str,
    connect_timeout: float = 4.0,
    attempts: int = 2,
) -> ProbeResult:
    """Probe one host:port address with a plain socket connect."""
    host, _, port_text = target.rpartition(":")
    if not host or not port_text.isdigit():
        return ProbeResult(VERDICT_DOWN, None, None, f"bad host:port ({target})")
    port = int(port_text)
    last_detail = "no attempt made"
    for attempt in range(1, max(1, attempts) + 1):
        started = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=connect_timeout):
                latency_ms = int((time.perf_counter() - started) * 1000)
                return ProbeResult(VERDICT_PASS, latency_ms, None, f"TCP {host}:{port} open")
        except OSError as why:
            last_detail = f"no connection ({why})"
        if attempt < attempts:
            time.sleep(1.0)
    return ProbeResult(VERDICT_DOWN, None, None, f"{last_detail} after {attempts} attempt(s)")


def probe_entry(
    entry: CatalogEntry,
    probe_path: str = "",
    connect_timeout: float = 4.0,
    total_timeout: float = 15.0,
    attempts: int = 2,
    max_age_days: Optional[int] = None,
) -> ProbeResult:
    """Dispatch one catalog entry to the probe its kind wants."""
    if entry.kind == "tcp":
        return probe_tcp(entry.target, connect_timeout=connect_timeout, attempts=attempts)
    return probe_http(
        entry.target,
        probe_path=probe_path,
        connect_timeout=connect_timeout,
        total_timeout=total_timeout,
        attempts=attempts,
        max_age_days=max_age_days,
    )
