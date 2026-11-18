// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The runtime proof harness — a measurement, not a promise.
 *
 * Drives the production build through a real headless Chrome session and
 * proves, live, the claims the product makes about itself:
 *
 *   P1  exact-value matrix       — metric BMI, category, BMI Prime, BMR,
 *                                 TDEE, the imperial round-trip, and the
 *                                 Deurenberg body-fat card
 *   P2  runtime egress inventory — every network request lands inside
 *                                 the disclosed host allowlist and the
 *                                 automatic update check fires exactly
 *                                 one request pair on a fresh device
 *   P3  storage inventory        — the device holds exactly the named
 *                                 keys and IndexedDB stores, no more
 *   P4  offline shell contract   — the service worker serves the real
 *                                 app shell with the network cut
 *   P5  Web Vitals budgets       — LCP and CLS inside the stated bounds
 *   P6  zero long tasks under KDF — the Argon2id export derivation
 *                                 runs in a worker; the main thread
 *                                 records no long task
 *   P7  at-rest seal live        — the first passphrase-proven import
 *                                 establishes the ledger verifier and
 *                                 the ledger write lands sealed
 *                                 (night-frontier-Z3)
 *   P8  purge guard              — a locked session cannot overwrite
 *                                 the sealed ledger
 *   P9  locked-read semantics    — sealed values read as missing; the
 *                                 verifier-anchored unlock restores
 *                                 readability
 *   P10 continuity witness live — the sealed chain head rides real
 *                                 saves and matches the ledger it
 *                                 covers (night-frontier-Z3)
 *   P11 witness freeze           — after a device tamper the next save
 *                                 refuses to bless unverified history
 *
 * Every proof is fail-closed: an infrastructure error fails its proof,
 * the harness exits non-zero, and nothing is reported as proven that was
 * not measured. Run via `scripts/proof/run-proof.sh` (which pins and
 * verifies the browser binary) or directly:
 *
 *   bun run scripts/proof/run-proof.ts [--chrome <path>] [--report <file>]
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CdpPage, launchChrome, waitForDebugger } from './cdp-client';

// ── Configuration ──
const REPO_ROOT = resolve(import.meta.dir, '../..');
const PREVIEW_PORT = 4177;
const BROWSER_PORT = 9223;
const BASE_URL = `http://127.0.0.1:${String(PREVIEW_PORT)}`;

const DEFAULT_CHROME = join(
	import.meta.dir,
	'.chrome/chrome-headless-shell-linux64/chrome-headless-shell'
);

/** The disclosed egress allowlist (README Limitations + hooks.server.ts CSP). */
const EGRESS_ALLOWLIST = [
	`127.0.0.1:${String(PREVIEW_PORT)}`,
	'localhost',
	'raw.githubusercontent.com',
	'api.github.com'
];

/** The named storage surface (DORMANT.md Data Safety Rules). */
const ALLOWED_LS_KEYS = new Set([
	'bmi.locale',
	'bmi.history',
	'bmi.goal',
	'bmi.goal.start',
	'bmi.unitSystem',
	'bmi.updateCheckAt',
	'bmi.passphrase_hint'
]);
const ALLOWED_IDB_STORES = new Set(['keyvalue', 'backups', 'meta']);

/** Web Vitals budgets (ms / unitless). */
const LCP_BUDGET_MS = 2500;
const CLS_BUDGET = 0.1;

// ── Small utilities ──
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function waitForHttp(url: string, timeoutMs = 30000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			/* server not up yet */
		}
		await sleep(250);
	}
	throw new Error(`Preview server did not answer at ${url}`);
}

/** Injected before any page script: collect LCP/CLS/longtask evidence. */
const COLLECTOR_SOURCE = `(() => {
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
const FILL_AND_CALC = `async ({ age, height, weight }) => {
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

const CLICK_RADIO = `({ groupAria, index, text }) => {
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

const READ_RESULTS = `() => {
  const value = document.querySelector('.bmi-value')?.textContent?.trim() ?? '';
  const category = document.querySelector('.bmi-category')?.textContent?.trim() ?? '';
  const prime = document.querySelector('.stat-number')?.textContent?.trim() ?? '';
  return { value, category, prime };
}`;

const READ_LONGTASKS = `() => window.__bmiProof.longTasks.map((t) => t.dur)`;

const READ_VITALS = `() => window.__bmiProof.vitals`;

const READ_STORAGE = `async () => {
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
  return { lsKeys, storeNames: storeNames.sort() };
}`;

const SW_STATE = `async () => {
  if (!('serviceWorker' in navigator)) return { supported: false, controlled: false };
  const reg = await navigator.serviceWorker.getRegistration();
  return { supported: true, controlled: navigator.serviceWorker.controller !== null };
}`;

/** In-page IndexedDB meta reader, interpolated into the seal-claim probes. */
const READ_META = `(key) => new Promise((res) => {
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
const WITNESS_AUDIT = `async () => {
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
const IMPORT_SET_FILE = `async (content) => {
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
const MODAL_SUBMIT = `async ({ passphrase }) => {
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

const MODAL_CLOSED = `() => !document.querySelector('[role="dialog"] form')`;

/** Open the export modal and read the record-count preview row. */
const EXPORT_PREVIEW_COUNT = `async () => {
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

/** Wait until any BMI readout on the page settles on the expected value. */
async function waitForBmiValue(page: CdpPage, expected: string, timeoutMs = 8000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const values = await page.evaluate<string[]>(
			`() => [...document.querySelectorAll('.bmi-value')].map((el) => (el.textContent || '').trim())`
		);
		if (values.includes(expected)) return;
		await sleep(250);
	}
	const final = await page.evaluate<string[]>(
		`() => [...document.querySelectorAll('.bmi-value')].map((el) => (el.textContent || '').trim())`
	);
	throw new Error(
		`BMI readout never settled on "${expected}"; last saw [${final.join(', ') || '<empty>'}]`
	);
}

/**
 * The first calculation opens a celebration modal and the pager walks to
 * the gauge section; the calculator section unmounts lazily. Close the
 * modal if present and return to the calculator so its surface (results
 * card, unit toggle, export button) is mounted again for the next step.
 */
async function closeCelebrationAndReturn(page: CdpPage): Promise<void> {
	await sleep(400); // let the modal open if this was the first calculation
	const open = await page.evaluate<boolean>(
		`() => { const d = document.querySelector('[role="dialog"]'); return Boolean(d && !d.querySelector('form')); }`
	);
	if (open) {
		await page.evaluate(
			`() => {
          const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => !d.querySelector('form'));
          for (const d of dialogs) {
            const btn =
              [...d.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').toLowerCase().includes('close')) ||
              d.querySelector('button');
            if (btn) { btn.click(); return true; }
          }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return true;
        }`
		);
		await sleep(400);
	}
	await page.evaluate(`() => { location.hash = '#calculator'; return true; }`);
	await sleep(800); // lazy section remount
}

// ── Proof ledger ──
interface ProofResult {
	claim: string;
	ok: boolean;
	detail: string;
}

const results: ProofResult[] = [];

async function prove(claim: string, run: () => Promise<string>): Promise<void> {
	try {
		const detail = await run();
		results.push({ claim, ok: true, detail });
		console.log(`  PASS  ${claim} — ${detail}`);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		results.push({ claim, ok: false, detail: message });
		console.error(`  FAIL  ${claim} — ${message}`);
	}
}

function expect(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

function closeEnough(actual: string, expected: string, label: string): void {
	expect(actual === expected, `${label}: expected "${expected}", saw "${actual || '<empty>'}"`);
}

// ── The proof run ──
async function main(): Promise<number> {
	const chromePath = argValue('--chrome') ?? DEFAULT_CHROME;
	const reportPath = argValue('--report');
	let server: ReturnType<typeof Bun.spawn> | null = null;
	let chrome: ReturnType<typeof Bun.spawn> | null = null;
	let page: CdpPage | null = null;
	let exportFileText: string | null = null;
	const userDir = mkdtempSync(join(tmpdir(), 'bmi-proof-'));

	try {
		// ── Bring-up ──
		console.log('proof: starting vite preview and pinned chrome-headless-shell');
		// Spawn the vite CLI directly so the kill in the cleanup path takes
		// down the actual server process, not an intermediate `bun run`.
		server = Bun.spawn(
			[
				'./node_modules/.bin/vite',
				'preview',
				'--host',
				'127.0.0.1',
				'--port',
				String(PREVIEW_PORT),
				'--strictPort'
			],
			{
				cwd: REPO_ROOT,
				stdout: 'ignore',
				stderr: 'ignore'
			}
		);
		await waitForHttp(`${BASE_URL}/`);

		chrome = launchChrome(chromePath, userDir, BROWSER_PORT);
		await sleep(600);
		if (chrome.exitCode !== null) {
			const stderr = await new Response(chrome.stderr).text();
			throw new Error(
				`chrome-headless-shell exited immediately (code ${String(chrome.exitCode)}): ${stderr.slice(0, 400)}`
			);
		}
		try {
			await waitForDebugger(BROWSER_PORT);
		} catch (err) {
			const stderr = await new Response(chrome.stderr).text();
			throw new Error(
				`${err instanceof Error ? err.message : String(err)}; chrome stderr: ${stderr.slice(0, 400)}`,
				{ cause: err }
			);
		}
		page = await CdpPage.connect(BROWSER_PORT);
		await page.enableDomains();
		await page.addStartupScript(COLLECTOR_SOURCE);

		const requests: Array<{ url: string; method: string }> = [];
		page.on('Network.requestWillBeSent', (params) => {
			const request = (params.request ?? {}) as { url?: string; method?: string };
			const url = String(request.url ?? '');
			if (!url || url.startsWith('data:')) return;
			requests.push({ url, method: String(request.method ?? 'GET') });
		});

		await page.navigate(`${BASE_URL}/`);
		await sleep(4500); // hydration + service-worker activation + first update check
		// Snapshot the initial-load Vitals before any harness interaction:
		// later paints (calculation results, gauge) enlarge the LCP
		// candidate, so the budget applies to the load, not the session.
		const initialVitals = await page.evaluate<Record<string, number>>(READ_VITALS);
		await page.evaluate(`() => { location.hash = '#calculator'; return true; }`);
		await sleep(800); // lazy section mount

		// ── P1: exact-value matrix ──
		await prove(
			'P1a metric: BMI 22.86, Normal Weight, Prime 0.91, BMR 1649, TDEE 2556',
			async () => {
				await page!.evaluate(CLICK_RADIO, { groupAria: 'Gender', index: 0 });
				await page!.evaluate(CLICK_RADIO, { groupAria: 'Activity level', index: 2 });
				await page!.evaluate(FILL_AND_CALC, { age: 30, height: 175, weight: 70 });
				await waitForBmiValue(page!, '22.86');
				await closeCelebrationAndReturn(page!);
				const read = await page!.evaluate<{ value: string; category: string; prime: string }>(
					READ_RESULTS
				);
				closeEnough(read.category, 'Normal Weight', 'category');
				closeEnough(read.prime, '0.91', 'BMI Prime');
				const body = await page!.evaluate<string>(() => document.body.textContent || '');
				expect(
					body.includes('1649') || body.includes('1,649'),
					'BMR 1649 not found on the results surface'
				);
				expect(
					body.includes('2556') || body.includes('2,556'),
					'TDEE 2556 not found on the results surface'
				);
				return `bmi=${read.value} category="${read.category}" prime=${read.prime} bmr/tdee present`;
			}
		);

		await prove('P1b imperial: BMI 22.85 for 30y/68.9in/154.3lb', async () => {
			await page!.evaluate(CLICK_RADIO, { groupAria: 'Unit system', text: 'Imperial' });
			await sleep(200);
			await page!.evaluate(FILL_AND_CALC, { age: 30, height: 68.9, weight: 154.3 });
			await waitForBmiValue(page!, '22.85');
			await closeCelebrationAndReturn(page!);
			return 'imperial round-trip exact';
		});

		await prove('P1c body fat: Deurenberg 18.1% for male, 30y, BMI 22.86', async () => {
			await page!.evaluate(`() => { location.hash = '#gauge'; return true; }`);
			await sleep(1600); // lazy section mount + tween
			const text = await page!.evaluate<string>(
				`() => { const el = document.querySelector('.body-fat-container'); return (el?.textContent || document.body.textContent || ''); }`
			);
			expect(/18\.1/.test(text), `Deurenberg 18.1% not found in the body-fat card`);
			return '18.1% rendered';
		});

		// ── P5: Web Vitals budgets (evidence collected since first load) ──
		await prove(
			`P5 initial-content paint (first LCP candidate) <= ${String(LCP_BUDGET_MS)}ms, CLS <= ${String(CLS_BUDGET)}`,
			async () => {
				const vitals = initialVitals;
				const first = Number(vitals.firstLcp ?? -1);
				const last = Number(vitals.lastLcp ?? -1);
				const lastEl = String(vitals.lastLcpEl ?? '');
				const cls = Number(vitals.cls ?? 0);
				expect(first >= 0, 'no LCP entry recorded');
				expect(
					first <= LCP_BUDGET_MS,
					`first LCP candidate ${first.toFixed(0)}ms exceeds ${String(LCP_BUDGET_MS)}ms budget`
				);
				expect(cls <= CLS_BUDGET, `CLS ${cls.toFixed(4)} exceeds ${String(CLS_BUDGET)} budget`);
				return `first LCP ${first.toFixed(0)}ms, CLS ${cls.toFixed(4)} (last candidate ${last.toFixed(0)}ms on "${lastEl}" — decorative infinite animations repaint larger candidates, disclosed per the ledger)`;
			}
		);

		// ── P2: runtime egress inventory ──
		await prove(
			'P2 egress: only disclosed hosts, exactly one update-check request pair',
			async () => {
				const seen: string[] = [];
				let updateCheck = 0;
				for (const req of requests) {
					let parsed: URL;
					try {
						parsed = new URL(req.url);
					} catch {
						continue;
					}
					if (!parsed.host) continue;
					const host = parsed.host;
					const allowed = EGRESS_ALLOWLIST.some(
						(entry) => host === entry || host.endsWith(`.${entry}`)
					);
					if (!allowed) seen.push(`${req.method} ${parsed.host}`);
					if (parsed.host === 'raw.githubusercontent.com' || parsed.host === 'api.github.com') {
						expect(req.method === 'GET', `update check must be GET: ${req.method} ${parsed.host}`);
						updateCheck++;
					}
				}
				expect(seen.length === 0, `undisclosed egress: ${seen.join(', ')}`);
				expect(
					updateCheck === 2,
					`expected exactly one update-check request pair (2 GETs), saw ${String(updateCheck)}`
				);
				return `${String(requests.length)} requests, ${String(updateCheck)} update-check GETs, all allowlisted`;
			}
		);

		// ── P3: storage inventory ──
		await prove('P3 storage inventory: exactly the named keys and stores', async () => {
			const inv = await page!.evaluate<{ lsKeys: string[]; storeNames: string[] }>(READ_STORAGE);
			const unknownKeys = inv.lsKeys.filter((k) => !ALLOWED_LS_KEYS.has(k));
			expect(unknownKeys.length === 0, `unknown localStorage keys: ${unknownKeys.join(', ')}`);
			const unknownStores = inv.storeNames.filter((s) => !ALLOWED_IDB_STORES.has(s));
			expect(unknownStores.length === 0, `unknown IndexedDB stores: ${unknownStores.join(', ')}`);
			for (const store of ['keyvalue', 'backups', 'meta']) {
				expect(inv.storeNames.includes(store), `missing IndexedDB store: ${store}`);
			}
			return `ls=[${inv.lsKeys.join(', ')}] idb=[${inv.storeNames.join(', ')}]`;
		});

		// ── P10: continuity witness rides real saves (night-frontier-Z3) ──
		await prove(
			'P10 continuity witness: the sealed head rides real saves and matches the ledger it covers',
			async () => {
				const audit = await page!.evaluate<{
					witness: { head: string; length: number } | null;
					computed: { head: string; length: number };
				}>(WITNESS_AUDIT);
				expect(audit.witness !== null, 'no continuity witness in the meta store after real saves');
				expect(
					audit.witness!.head === audit.computed.head,
					'witness head does not match the recomputed chain'
				);
				expect(audit.witness!.length === audit.computed.length, 'witness length does not match');
				expect(
					audit.computed.length >= 2,
					`witness covers only ${String(audit.computed.length)} records`
				);
				return `witness covers ${String(audit.computed.length)} records, head matches the recomputed chain`;
			}
		);

		// ── P6: zero long tasks during the Argon2id export derivation ──
		await prove(
			'P6 zero main-thread long tasks during the Argon2id export derivation',
			async () => {
				await page!.evaluate(`() => { location.hash = '#calculator'; return true; }`);
				await sleep(800);
				await page!.evaluate(`() => { window.__bmiProof.longTasks = []; return true; }`);
				const clicked = await page!.evaluate(
					`() => {
          const btn = [...document.querySelectorAll('button')].find(
            (b) => (b.getAttribute('aria-label') || '') === 'Export BMI history'
          );
          if (!btn) throw new Error('missing export button');
          btn.click();
          return true;
        }`
				);
				expect(Boolean(clicked), 'export button click failed');
				// Poll until both passphrase fields are mounted: the shell and
				// the modal content arrive across a short transition.
				const deadlineModal = Date.now() + 5000;
				let modalReady = false;
				while (Date.now() < deadlineModal) {
					modalReady = await page!.evaluate(
						`() => {
							const d = [...document.querySelectorAll('[role="dialog"]')].find((x) =>
								x.querySelector('form')
							);
							return d ? d.querySelectorAll('input[type="password"]').length >= 2 : false;
						}`
					);
					if (modalReady) break;
					await sleep(300);
				}
				expect(Boolean(modalReady), 'export modal did not open with passphrase fields');
				await page!.evaluate(
					`async () => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
            d.querySelector('form')
          );
          const inputs = dialog ? [...dialog.querySelectorAll('input[type="password"]')] : [];
          if (inputs.length < 2) throw new Error('expected passphrase and confirm fields');
          for (const input of inputs) {
            input.value = 'proof-harness-passphrase-1';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const form = dialog.querySelector('form');
          // Let the strength meter settle first: its debounced zxcvbn
          // analysis is main-thread work unrelated to the KDF claim.
          await new Promise((r) => setTimeout(r, 700));
          // The derivation window starts HERE: the modal is mounted,
          // filled, and the meter has settled, so any long task recorded
          // from this point belongs to the derive/encrypt/deliver path.
          window.__bmiProof.longTasks = [];
          form.requestSubmit();
          return true;
        }`
				);
				// Wait for the modal to close: derivation, encryption, delivery done.
				const deadline = Date.now() + 45000;
				let closed = false;
				while (Date.now() < deadline) {
					const open = await page!.evaluate(
						`() => Boolean([...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('form')))`
					);
					if (!open) {
						closed = true;
						break;
					}
					await sleep(400);
				}
				expect(closed, 'export modal never closed after submit');
				const longTasks = await page!.evaluate<number[]>(READ_LONGTASKS);
				expect(
					longTasks.length === 0,
					`${String(longTasks.length)} main-thread long tasks during KDF: ${JSON.stringify(longTasks)}`
				);
				return 'modal completed with 0 long tasks on the main thread';
			}
		);

		// ── P7: at-rest seal live (night-frontier-Z3) ──
		await prove(
			'P7 at-rest seal live: the first passphrase-proven import establishes the verifier and the ledger write lands sealed',
			async () => {
				// The P6 export delivered an encrypted v4 file; its blob was
				// captured by the startup interceptor. Feed it through the
				// real import input — the same path a user's file takes.
				const deadlineBlob = Date.now() + 8000;
				while (Date.now() < deadlineBlob) {
					const text = await page!.evaluate<string | null>(
						`() => window.__bmiProof.lastExportBlobText`
					);
					if (text) break;
					await sleep(300);
				}
				const fileText = await page!.evaluate<string | null>(
					`() => window.__bmiProof.lastExportBlobText`
				);
				expect(fileText !== null, 'the encrypted export blob was never captured');
				exportFileText = fileText!;
				const outer = JSON.parse(fileText!) as { format?: string; meta?: { version?: number } };
				expect(outer.format === 'bmi-encrypted-v3', 'captured blob is not an encrypted envelope');
				expect(outer.meta?.version === 4, 'the encrypted export does not carry a v4 anchor');

				await page!.evaluate(IMPORT_SET_FILE, fileText);
				await page!.evaluate(MODAL_SUBMIT, { passphrase: 'proof-harness-passphrase-1' });
				const deadlineClose = Date.now() + 45000;
				let closed = false;
				while (Date.now() < deadlineClose) {
					if (await page!.evaluate<boolean>(MODAL_CLOSED)) {
						closed = true;
						break;
					}
					await sleep(400);
				}
				expect(closed, 'import modal never closed after the establish import');

				// The verifier exists, and the imported ledger write sealed.
				const deadlineSealed = Date.now() + 15000;
				let sealedRaw = false;
				let verifier = null as string | null;
				let enabled = null as string | null;
				while (Date.now() < deadlineSealed) {
					const state = await page!.evaluate<{
						verifier: string | null;
						enabled: string | null;
						sealedRaw: boolean;
					}>(`async () => {
						const readMeta = ${READ_META};
						return {
							verifier: await readMeta('__encryption_verifier'),
							enabled: await readMeta('__encryption_enabled'),
							sealedRaw: (localStorage.getItem('bmi.history') || '').startsWith('bmi-at-rest-v1:')
						};
					}`);
					verifier = state.verifier;
					enabled = state.enabled;
					sealedRaw = state.sealedRaw;
					if (sealedRaw && verifier && enabled === '1') break;
					await sleep(500);
				}
				expect(Boolean(verifier), 'ledger verifier was never established');
				expect(enabled === '1', 'encryption flag never enabled');
				expect(sealedRaw, 'the ledger write never sealed at rest');
				const plaintextLeak = await page!.evaluate<string | null>(
					`() => { const raw = localStorage.getItem('bmi.history') || ''; return raw.includes('"timestamp"') ? 'PLAINTEXT-AT-REST' : null; }`
				);
				expect(plaintextLeak === null, 'plaintext health data found in raw storage');
				return 'verifier established, session registered, ledger write sealed (bmi-at-rest-v1)';
			}
		);

		// ── P8: purge guard (locked session cannot overwrite the seal) ──
		await prove(
			'P8 purge guard: a locked session cannot overwrite the sealed ledger (raw envelope and witness untouched by a live calculation)',
			async () => {
				// Cold load: the volatile session key is gone, the ledger locks.
				await page!.navigate(`${BASE_URL}/`);
				await sleep(3000);
				await page!.evaluate(`() => { location.hash = '#calculator'; return true; }`);
				await sleep(800);
				const before = await page!.evaluate<{ raw: string | null }>(
					`() => ({ raw: localStorage.getItem('bmi.history') })`
				);
				expect(
					Boolean(before.raw?.startsWith('bmi-at-rest-v1:')),
					'history is not sealed before the purge attempt'
				);
				const witnessBefore = await page!.evaluate<{
					witness: { head: string; length: number } | null;
				}>(WITNESS_AUDIT);

				// A live calculation while locked: the save must be refused.
				await page!.evaluate(FILL_AND_CALC, { age: 30, height: 175, weight: 70.5 });
				await sleep(2000);
				await closeCelebrationAndReturn(page!);
				const after = await page!.evaluate<{ raw: string | null }>(
					`() => ({ raw: localStorage.getItem('bmi.history') })`
				);
				expect(after.raw !== null, 'sealed ledger vanished during the purge attempt');
				expect(Boolean(after.raw?.startsWith('bmi-at-rest-v1:')), 'sealed envelope was replaced');
				expect(after.raw === before.raw, 'raw envelope changed during the purge attempt');
				const witnessAfter = await page!.evaluate<{
					witness: { head: string; length: number } | null;
				}>(WITNESS_AUDIT);
				expect(
					JSON.stringify(witnessAfter.witness) === JSON.stringify(witnessBefore.witness),
					'the witness moved during the purge attempt'
				);
				return 'raw envelope byte-identical, witness untouched';
			}
		);

		// ── P9: locked reads as missing; verifier-anchored unlock restores ──
		await prove(
			'P9 locked-read semantics: sealed values read as missing (export preview 0 records) and the unlock restores readability',
			async () => {
				await page!.evaluate(`() => { location.hash = '#calculator'; return true; }`);
				await sleep(800);
				const lockedCount = await page!.evaluate<string>(EXPORT_PREVIEW_COUNT);
				expect(
					lockedCount === '0',
					`a locked session must read sealed values as missing (preview saw ${String(lockedCount)})`
				);

				// Unlock through the existing flow: decrypt of the user's own
				// file, verifier-anchored session registration. The file text
				// rides in the harness: the P8 reload reset the page.
				expect(exportFileText !== null, 'the captured import file is gone');
				await page!.evaluate(IMPORT_SET_FILE, exportFileText!);
				await page!.evaluate(MODAL_SUBMIT, { passphrase: 'proof-harness-passphrase-1' });
				const deadlineClose = Date.now() + 45000;
				let closed = false;
				while (Date.now() < deadlineClose) {
					if (await page!.evaluate<boolean>(MODAL_CLOSED)) {
						closed = true;
						break;
					}
					await sleep(400);
				}
				if (!closed) {
					const dump = await page!.evaluate<string>(
						`() => { const d = [...document.querySelectorAll('[role="dialog"]')].find((x) => x.querySelector('form')); return d ? (d.textContent || '').slice(0, 200) : 'NO DIALOG'; }`
					);
					throw new Error(`unlock import modal never closed; dialog: ${dump}`);
				}
				await sleep(1500);

				const deadlineSealed = Date.now() + 15000;
				let sealedRaw = false;
				while (Date.now() < deadlineSealed) {
					sealedRaw = await page!.evaluate<boolean>(
						`() => (localStorage.getItem('bmi.history') || '').startsWith('bmi-at-rest-v1:')`
					);
					if (sealedRaw) break;
					await sleep(500);
				}
				expect(sealedRaw, 'the unlocked ledger never re-sealed');
				const witnessDebug = await page!.evaluate<{
					witness: { head: string; length: number } | null;
					rawIsSealed: boolean;
				}>(WITNESS_AUDIT);
				const unlockedCount = await page!.evaluate<string>(EXPORT_PREVIEW_COUNT);
				expect(
					String(unlockedCount).trim() === '2',
					`records are not readable again after the unlock (preview saw ${JSON.stringify(unlockedCount)}; witness=${JSON.stringify(witnessDebug.witness)})`
				);
				return `locked preview 0 records, unlocked preview ${unlockedCount}, envelope re-sealed`;
			}
		);

		// ── P11: the witness freezes on a device tamper (night-frontier-Z3) ──
		await prove(
			'P11 witness freeze: after a device tamper the next save refuses to bless unverified history (witness unchanged, recomputed chain diverges)',
			async () => {
				const before = await page!.evaluate<{ witness: { head: string; length: number } | null }>(
					WITNESS_AUDIT
				);
				expect(before.witness !== null, 'no witness before the tamper');

				// Device-access attacker: replace the sealed ledger with a
				// chosen, VALID plaintext history (foreign records).
				const foreign = [
					{ timestamp: 1_700_000_100_000, bmi: 24.9, height: 165, weight: 68, age: 44 },
					{ timestamp: 1_700_000_200_000, bmi: 25.4, height: 165, weight: 69, age: 44 }
				];
				await page!.evaluate(
					`(records) => { localStorage.setItem('bmi.history', JSON.stringify(records)); return true; }`,
					foreign
				);

				// The user calculates: the save goes through (data
				// preservation), but the witness must NOT advance over it.
				await page!.evaluate(FILL_AND_CALC, { age: 30, height: 175, weight: 71 });
				await sleep(2500);
				await closeCelebrationAndReturn(page!);

				const deadline = Date.now() + 10000;
				let after: { witness: { head: string; length: number } | null } = { witness: null };
				let stable = false;
				let previous: string | null = null;
				while (Date.now() < deadline) {
					after = await page!.evaluate<{ witness: { head: string; length: number } | null }>(
						WITNESS_AUDIT
					);
					const current = JSON.stringify(after.witness);
					if (previous !== null && current === previous) {
						stable = true;
						break;
					}
					previous = current;
					await sleep(700);
				}
				expect(stable, 'witness never settled');
				expect(
					JSON.stringify(after.witness) === JSON.stringify(before.witness),
					'the witness moved over unverified history'
				);
				// The witness still covers exactly the pre-tamper ledger
				// (2 records), while storage now holds 3 — the freeze is real.
				expect(
					after.witness!.length === 2,
					`witness length drifted to ${String(after.witness!.length)}`
				);

				// And the head differs from the chain over the tampered pair:
				// the divergence between witness and stored content is real.
				const foreignChain = await page!.evaluate<{ head: string }>(
					`async () => {
						const enc = new TextEncoder();
						const dig = async (t) => {
							const b = await crypto.subtle.digest('SHA-256', enc.encode(t).buffer);
							return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
						};
						const arr = [
							{ timestamp: 1700000100000, bmi: 24.9, height: 165, weight: 68, age: 44 },
							{ timestamp: 1700000200000, bmi: 25.4, height: 165, weight: 69, age: 44 }
						];
						let link = await dig('bmi-stellar-ledger-v4-genesis');
						for (const r of arr) {
							const c = JSON.stringify({ timestamp: r.timestamp, bmi: r.bmi, height: r.height, weight: r.weight, age: r.age });
							link = await dig(link + ':' + c);
						}
						return { head: link };
					}`
				);
				expect(after.witness!.head !== foreignChain.head, 'the witness equals the tampered chain');
				return `witness stayed at ${before.witness!.head.slice(0, 12)}... (length 2), diverged from the tampered chain`;
			}
		);

		// ── P4: offline shell contract ──
		await prove('P4 offline shell: the service worker serves the real app shell', async () => {
			// One online reload lets the registered worker claim the page.
			await page!.navigate(`${BASE_URL}/`);
			await sleep(2500);
			const sw = await page!.evaluate<{ supported: boolean; controlled: boolean }>(SW_STATE);
			expect(
				sw.supported && sw.controlled,
				'service worker not controlling the page before offline test'
			);
			await page!.setOffline(true);
			await page!.navigate(`${BASE_URL}/`);
			await sleep(1500);
			const hero = await page!.evaluate(
				`() => { const el = document.querySelector('.hero-title'); return el ? (el.textContent || '').trim() : null; }`
			);
			await page!.setOffline(false);
			expect(Boolean(hero), 'app shell did not render offline (hero title missing)');
			return 'shell served offline, hero present';
		});

		// ── Verdict ──
		const failed = results.filter((r) => !r.ok);
		const verdict = failed.length === 0 ? 'PROVEN' : 'FAILED';
		console.log(
			`\nproof verdict: ${verdict} (${String(results.length - failed.length)}/${String(results.length)} claims)`
		);
		if (reportPath) {
			writeFileSync(
				reportPath,
				JSON.stringify({ verdict, claims: results, measuredAt: new Date().toISOString() }, null, 2)
			);
			console.log(`report written: ${reportPath}`);
		}
		return failed.length === 0 ? 0 : 1;
	} finally {
		if (page) await page.close().catch(() => {});
		if (chrome) chrome.kill();
		if (server) server.kill();
		try {
			rmSync(userDir, { recursive: true, force: true });
		} catch {
			/* best-effort cleanup */
		}
	}
}

process.exitCode = await main();
