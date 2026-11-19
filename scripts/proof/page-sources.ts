// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The in-page JavaScript sources for the runtime proof harness
 * (night-frontier-Z4 extraction: the page-side probes are plain JS
 * strings evaluated by the CDP client; keeping them in their own module
 * keeps run-proof.ts under the 1000-line hard cap as the claim set
 * grows). Every export is a self-contained page-context function
 * source; the harness imports them verbatim.
 */

/** Injected before any page script: collect LCP/CLS/longtask evidence. */
export const COLLECTOR_SOURCE = `(() => {
  window.__bmiProof = { vitals: {}, longTasks: [], lastExportBlobText: null };
  try {
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      try {
        if (obj instanceof Blob)
          obj.text().then((t) => {
            if (t.includes('bmi-encrypted-v3')) window.__bmiProof.lastExportBlobText = t;
          });
      } catch (e) {}
      return origCreate(obj);
    };
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      const es = l.getEntries();
      const last = es[es.length - 1];
      for (const e of es) {
        if (window.__bmiProof.vitals.firstLcp === undefined) {
          // First candidate = the paint that carries the initial content.
          window.__bmiProof.vitals.firstLcp = e.startTime;
        }
        window.__bmiProof.vitals.lastLcp = e.startTime;
        const el = e.element;
        window.__bmiProof.vitals.lastLcpEl = el
          ? String(el.className || el.tagName || '').slice(0, 80)
          : '';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) window.__bmiProof.vitals.cls = (window.__bmiProof.vitals.cls || 0) + e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__bmiProof.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
})();`;

// ── In-page helpers (evaluated inside the page) ──
export const FILL_AND_CALC = `async ({ age, height, weight }) => {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) throw new Error('missing input #' + id);
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('age', String(age));
  set('height', String(height));
  set('weight', String(weight));
  await new Promise((r) => setTimeout(r, 150));
  const btn = document.querySelector('form button[type="submit"].btn-primary');
  if (!btn) throw new Error('missing calculate button');
  btn.click();
  return true;
}`;

export const CLICK_RADIO = `({ groupAria, index, text }) => {
  const group = [...document.querySelectorAll('[role="radiogroup"]')].find(
    (g) => (g.getAttribute('aria-label') || '') === groupAria
  );
  if (!group) throw new Error('missing radiogroup: ' + groupAria);
  const radios = [...group.querySelectorAll('[role="radio"]')];
  let target = null;
  if (typeof index === 'number') target = radios[index];
  if (text) {
    target = radios.find((r) => (r.textContent || '').trim().toLowerCase().includes(text.toLowerCase()));
  }
  if (!target) throw new Error('missing radio in ' + groupAria);
  target.click();
  return true;
}`;

export const READ_RESULTS = `() => {
  const value = document.querySelector('.bmi-value')?.textContent?.trim() ?? '';
  const category = document.querySelector('.bmi-category')?.textContent?.trim() ?? '';
  const prime = document.querySelector('.stat-number')?.textContent?.trim() ?? '';
  return { value, category, prime };
}`;

export const READ_LONGTASKS = `() => window.__bmiProof.longTasks.map((t) => t.dur)`;

export const READ_VITALS = `() => window.__bmiProof.vitals`;

export const READ_STORAGE = `async () => {
  const lsKeys = Object.keys(localStorage).sort();
  const storeNames = await new Promise((resolve) => {
    const open = indexedDB.open('bmi-calculator');
    open.onsuccess = () => {
      const names = [...open.result.objectStoreNames];
      open.result.close();
      resolve(names);
    };
    open.onerror = () => resolve([]);
  });
  let opfsFiles = null;
  try {
    const root = await navigator.storage.getDirectory();
    const names = [];
    for await (const [name] of root.entries()) names.push(name);
    opfsFiles = names.sort();
  } catch (e) {
    opfsFiles = null;
  }
  return { lsKeys, storeNames: storeNames.sort(), opfsFiles };
}`;

/**
 * The vault audit (night-frontier-Z4): lists the OPFS root, reads the
 * vault file's bytes and text, and reads the latest IndexedDB backup
 * snapshot's byte length (UTF-8) for the equivalence check.
 */
export const VAULT_AUDIT = `async () => {
  let files = [];
  let bytes = 0;
  let text = null;
  try {
    const root = await navigator.storage.getDirectory();
    for await (const [name] of root.entries()) files.push(name);
    const handle = await root.getFileHandle('vault-backup.json');
    const file = await handle.getFile();
    bytes = file.size;
    text = await file.text();
  } catch (e) {
    return { opfs: null, idbLatest: null };
  }
  const idbLatest = await new Promise((resolve) => {
    const open = indexedDB.open('bmi-calculator');
    open.onsuccess = () => {
      const db = open.result;
      try {
        const idx = db.transaction('backups', 'readonly').objectStore('backups').index('timestamp');
        const req = idx.openCursor(null, 'prev');
        req.onsuccess = () => {
          const c = req.result;
          const out = c ? { utf8: new TextEncoder().encode(c.value.data).length, ts: c.value.timestamp } : null;
          db.close();
          resolve(out);
        };
        req.onerror = () => { db.close(); resolve(null); };
      } catch (e) {
        db.close();
        resolve(null);
      }
    };
    open.onerror = () => resolve(null);
  });
  return { opfs: { files: files.sort(), bytes, text }, idbLatest };
}`;

export const SW_STATE = `async () => {
  if (!('serviceWorker' in navigator)) return { supported: false, controlled: false };
  const reg = await navigator.serviceWorker.getRegistration();
  return { supported: true, controlled: navigator.serviceWorker.controller !== null };
}`;

/** In-page IndexedDB meta reader, interpolated into the seal-claim probes. */
export const READ_META = `(key) => new Promise((res) => {
  const open = indexedDB.open('bmi-calculator');
  open.onsuccess = () => {
    const db = open.result;
    const req = db.transaction('meta', 'readonly').objectStore('meta').get(key);
    req.onsuccess = () => { db.close(); res(req.result ? req.result.value : null); };
    req.onerror = () => { db.close(); res(null); };
  };
  open.onerror = () => res(null);
})`;

/**
 * In-page continuity witness audit (night-frontier-Z3): reads the sealed
 * head from the IndexedDB meta store and recomputes the chain over the
 * raw stored history with an independent reference implementation of the
 * construction (genesis seed, canonical fixed-key serialization,
 * ascending stable order).
 */
export const WITNESS_AUDIT = `async () => {
  const readMeta = ${READ_META};
  const enc = new TextEncoder();
  const dig = async (t) => {
    const b = await crypto.subtle.digest('SHA-256', enc.encode(t).buffer);
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
  const raw = localStorage.getItem('bmi.history');
  let link = await dig('bmi-stellar-ledger-v4-genesis');
  let n = 0;
  const sealed = Boolean(raw && raw.startsWith('bmi-at-rest-v1:'));
  if (raw && !sealed) {
    const arr = JSON.parse(raw);
    arr.sort((a, b) => a.timestamp - b.timestamp);
    for (const r of arr) {
      const c = JSON.stringify({ timestamp: r.timestamp, bmi: r.bmi, height: r.height, weight: r.weight, age: r.age });
      link = await dig(link + ':' + c);
      n++;
    }
  }
  const witnessRaw = await readMeta('__history_chain_head');
  return {
    witness: witnessRaw ? JSON.parse(witnessRaw) : null,
    computed: sealed ? null : { head: link, length: n },
    rawIsSealed: sealed
  };
}`;

/** Feed a file through the real import input (the standard upload route). */
export const IMPORT_SET_FILE = `async (content) => {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('missing import file input');
  const file = new File([content], 'proof-import.json', { type: 'application/json' });
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}`;

/** Wait for the encryption modal, fill every password field, submit. */
export const MODAL_SUBMIT = `async ({ passphrase }) => {
  const deadline = Date.now() + 8000;
  let dialog = null;
  while (Date.now() < deadline) {
    dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('form'));
    if (dialog && dialog.querySelectorAll('input[type="password"]').length >= 1) break;
    await new Promise((r) => setTimeout(r, 300));
    dialog = null;
  }
  if (!dialog) throw new Error('encryption modal never opened');
  for (const input of dialog.querySelectorAll('input[type="password"]')) {
    input.value = passphrase;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Let the debounced strength meter settle before the derivation window.
  await new Promise((r) => setTimeout(r, 700));
  dialog.querySelector('form').requestSubmit();
  return true;
}`;

export const MODAL_CLOSED = `() => !document.querySelector('[role="dialog"] form')`;

/** Open the export modal and read the record-count preview row. */
export const EXPORT_PREVIEW_COUNT = `async () => {
  const btn = [...document.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') || '') === 'Export BMI history'
  );
  if (!btn) throw new Error('missing export button');
  btn.click();
  const deadline = Date.now() + 8000;
  let val = null;
  while (Date.now() < deadline) {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('form'));
    const row = dialog ? dialog.querySelector('.bmi-export-summary__val') : null;
    if (row) { val = (row.textContent || '').trim(); break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  const cancel = [...(document.querySelectorAll('[role="dialog"] .btn-cancel') || [])][0];
  if (cancel) cancel.click();
  // The next probe must not mistake this closing modal for its own
  // target: wait until no modal form remains before returning.
  const deadlineClose = Date.now() + 5000;
  while (Date.now() < deadlineClose) {
    if (!document.querySelector('[role="dialog"] form')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (val === null) throw new Error('export summary record count never rendered');
  return val;
}`;

// ── night-frontier-Z5: the single-writer law probes ──

/** The ledger view the race claims poll: record count plus the newest timestamp. */
export const READ_LEDGER_STATE = `() => {
  const raw = JSON.parse(localStorage.getItem('bmi.history') || '[]');
  return { count: raw.length, lastTimestamp: raw.length ? raw[raw.length - 1].timestamp : 0 };
}`;

/**
 * Exclusive-mode serialization probe: two requests on one named lock,
 * the second gated behind the first's release. Returns 1 when the
 * platform granted them strictly in order (a-start, a-end, b-start).
 */
export const PROBE_LOCK_SERIALIZATION = `async () => {
  const events = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const first = navigator.locks.request('bmi-proof-probe', { mode: 'exclusive' }, async () => {
    events.push('a-start');
    await gate;
    events.push('a-end');
  });
  const second = navigator.locks.request('bmi-proof-probe', { mode: 'exclusive' }, async () => {
    events.push('b-start');
  });
  await new Promise((r) => setTimeout(r, 150));
  release();
  await first;
  await second;
  return events.join(',') === 'a-start,a-end,b-start' ? 1 : 0;
}`;

/**
 * The merged-ledger audit (the Z5 race verdict, read from tab B): the
 * continuity witness against an independent recomputation over the raw
 * stored history, the record count, and whether tab A's record —
 * identified by its exact timestamp — survived tab B's stale write.
 */
export const MERGED_LEDGER_AUDIT = `async ({ lastTimestamp }) => {
  const audit = await (${WITNESS_AUDIT})();
  const raw = JSON.parse(localStorage.getItem('bmi.history') || '[]');
  return {
    witness: audit.witness,
    computed: audit.computed,
    count: raw.length,
    hasTabARecord: raw.some((r) => r.timestamp === lastTimestamp)
  };
}`;

// ── night-frontier-Z7 (B2): the Import Gauntlet ──
// P15 drives poisoned envelopes through the REAL import UI and demands
// three verdicts: zero unhandled errors, zero egress delta, and a
// witness + ledger that never move (no poison is a legit write).

/** Install the gauntlet counters once: unhandled errors + egress taps. */
export const GAUNTLET_SETUP = `async () => {
  const w = (window.__bmiGauntlet = window.__bmiGauntlet || { errors: [], egress: 0 });
  w.errors = [];
  w.egress = 0;
  if (!w.__installed) {
    w.__installed = true;
    window.addEventListener('unhandledrejection', (e) => {
      w.errors.push(String((e.reason && e.reason.message) || e.reason));
    });
    window.addEventListener('error', (e) => {
      w.errors.push(String(e.message || e.error));
    });
    const originFetch = window.fetch;
    window.fetch = function () {
      try {
        const u = typeof arguments[0] === 'string' ? arguments[0] : String(arguments[0] && arguments[0].url);
        if (u.indexOf(location.origin) !== 0) w.egress++;
      } catch (e) {}
      return originFetch.apply(this, arguments);
    };
    const originOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
      try {
        if (String(arguments[1]).indexOf(location.origin) !== 0) w.egress++;
      } catch (e) {}
      return originOpen.apply(this, arguments);
    };
  }
  const readMeta = ${READ_META};
  const raw = await readMeta('__history_chain_head');
  return { witnessBefore: raw ? JSON.parse(raw) : null };
}`;

/**
 * The gauntlet itself: build the poisoned variants from a VALID
 * encrypted export, feed each through the real file input, submit the
 * modal when one opens, and report the three verdicts.
 */
export const GAUNTLET_RUN = `async ({ validEnvelope, passphrase }) => {
  const w = window.__bmiGauntlet;
  const flipChar = (s, i) => s.slice(0, i) + (s.charAt(i) === 'x' ? 'y' : 'x') + s.slice(i + 1);
  const outer = JSON.parse(validEnvelope);
  const dataAt = validEnvelope.indexOf('"data":"') + 9;
  const b64Mid = dataAt + Math.floor(outer.data.length / 2);
  const payloads = [
    ['garbage bytes', 'not json at all {{{'],
    ['truncated envelope', validEnvelope.slice(0, Math.floor(validEnvelope.length / 2))],
    ['flipped ciphertext byte', flipChar(validEnvelope, b64Mid)],
    ['wrong format field', JSON.stringify({ format: 'bmi-encrypted-v9', meta: outer.meta, data: outer.data })],
    ['json without records', JSON.stringify({ version: 4, source: 'bmi-calculator' })],
    ['records not an array', JSON.stringify({ version: 2, records: { tampered: true } })],
    ['invalid record values', JSON.stringify({ version: 2, records: [{ timestamp: 1700000000000, bmi: 'huge', height: -5, weight: 999999 }] })],
    ['invalid oversized array', JSON.stringify({ version: 2, records: Array.from({ length: 3000 }, (_, i) => ({ timestamp: 1700000000000 + i, bmi: 'x' + i, height: 0, weight: -1 })) })],
    ['unknown version marker', JSON.stringify({ version: 99, records: [] })]
  ];
  const setFile = (content) => {
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('missing import file input');
    const file = new File([content], 'gauntlet.json', { type: 'application/json' });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const modalOpen = () => Boolean([...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('form')));
  const waitModalGone = async () => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (!modalOpen()) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };
  for (const [label, payload] of payloads) {
    void label;
    setFile(payload);
    await new Promise((r) => setTimeout(r, 700));
    if (modalOpen()) {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('form'));
      for (const input of dialog.querySelectorAll('input[type="password"]')) {
        input.value = passphrase;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      dialog.querySelector('form').requestSubmit();
      const gone = await waitModalGone();
      if (!gone) throw new Error('gauntlet modal never closed on: ' + label);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const readMeta = ${READ_META};
  const raw = await readMeta('__history_chain_head');
  const historyRaw = localStorage.getItem('bmi.history');
  let ledgerCount = -1;
  try {
    const arr = JSON.parse(historyRaw);
    if (Array.isArray(arr)) ledgerCount = arr.length;
  } catch (e) {}
  return {
    imports: payloads.length,
    unhandledErrors: w.errors,
    egressDelta: w.egress,
    witnessAfter: raw ? JSON.parse(raw) : null,
    ledgerCount,
    ledgerSealed: Boolean(historyRaw && historyRaw.indexOf('bmi-at-rest-v1:') === 0)
  };
}`;
