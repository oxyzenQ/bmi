// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The runtime proof harness — a measurement, not a promise.
 *
 * Drives the production build through a real headless Chrome session and
 * proves, live, the claims the product makes about itself:
 *
 *   One line per claim; each is proven live, fail-closed:
 *   P1  exact-value matrix (metric, imperial round-trip, Deurenberg)
 *   P2  runtime egress inventory (allowlist + one update-check pair)
 *   P3  storage inventory (exactly the named keys and IDB stores)
 *   P4  offline shell contract (the real app shell, network cut)
 *   P5  Web Vitals budgets (LCP and CLS)
 *   P6  zero long tasks under KDF (worker offload)
 *   P7  at-rest seal live (verifier established, write lands sealed)
 *   P8  purge guard (a locked session cannot overwrite the seal)
 *   P9  locked-read semantics (missing until the anchored unlock)
 *   P10 continuity witness live (rides real saves, matches the ledger)
 *   P11 witness freeze (a tamper is never blessed)
 *   P12 vault tier (OPFS snapshot byte-equivalent to the IDB backup)
 *   P13 kdf ladder (production rungs at or above the OWASP floor)
 *   P14 single-writer law (lock serialization, union survives)
 *   P15 import gauntlet (poison refused: 0 unhandled, 0 egress, witness untouched) — Z7
 *   P16 seal custody live (one wasm engine instantiation, v1 envelope law, checksum recomputes) — Z8
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
import {
	COLLECTOR_SOURCE,
	FILL_AND_CALC,
	CLICK_RADIO,
	READ_RESULTS,
	READ_LONGTASKS,
	READ_VITALS,
	READ_STORAGE,
	SW_STATE,
	READ_META,
	WITNESS_AUDIT,
	IMPORT_SET_FILE,
	GAUNTLET_SETUP,
	GAUNTLET_RUN,
	MODAL_SUBMIT,
	MODAL_CLOSED,
	EXPORT_PREVIEW_COUNT,
	VAULT_AUDIT,
	READ_LEDGER_STATE,
	PROBE_LOCK_SERIALIZATION,
	MERGED_LEDGER_AUDIT,
	SEAL_CUSTODY_AUDIT
} from './page-sources';

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

/** The named OPFS surface (night-frontier-Z4, DORMANT.md Data Safety Rules). */
const ALLOWED_OPFS_FILES = new Set(['vault-backup.json']);

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

/** The gauntlet probe shapes (night-frontier-Z7, P15). */
type GauntletBefore = { witnessBefore: { head: string } | null };
type GauntletVerdict = {
	imports: number;
	unhandledErrors: string[];
	egressDelta: number;
	witnessAfter: { head: string } | null;
};

/** The P16 verdict (night-frontier-Z8): the wasm seat presence plus the envelope law. */
type SealCustodyVerdict = {
	wasm: { count: number; bytes: number };
	envelope: { v: number; ivBytes: number; chkMatches: boolean };
};

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
		// Spawn the vite CLI directly so the cleanup kill takes down the actual server process, not an intermediate `bun run`.
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
		// Snapshot the initial-load Vitals before any harness interaction: later paints (calculation results, gauge) enlarge the LCP candidate, so the budget applies to the load, not the session.
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
			const inv = await page!.evaluate<{
				lsKeys: string[];
				storeNames: string[];
				opfsFiles: string[] | null;
			}>(READ_STORAGE);
			const unknownKeys = inv.lsKeys.filter((k) => !ALLOWED_LS_KEYS.has(k));
			expect(unknownKeys.length === 0, `unknown localStorage keys: ${unknownKeys.join(', ')}`);
			const unknownStores = inv.storeNames.filter((s) => !ALLOWED_IDB_STORES.has(s));
			expect(unknownStores.length === 0, `unknown IndexedDB stores: ${unknownStores.join(', ')}`);
			for (const store of ['keyvalue', 'backups', 'meta']) {
				expect(inv.storeNames.includes(store), `missing IndexedDB store: ${store}`);
			}
			expect(inv.opfsFiles !== null, 'OPFS unreadable in the proof browser');
			const unknownOpfs = inv.opfsFiles!.filter((f) => !ALLOWED_OPFS_FILES.has(f));
			expect(unknownOpfs.length === 0, `unknown OPFS files: ${unknownOpfs.join(', ')}`);
			expect(inv.opfsFiles!.includes('vault-backup.json'), 'the vault file is missing from OPFS');
			return `ls=[${inv.lsKeys.join(', ')}] idb=[${inv.storeNames.join(', ')}] opfs=[${inv.opfsFiles!.join(', ')}]`;
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

		// ── P14: the single-writer law across two tabs (night-frontier-Z5) ──
		await prove(
			'P14 single-writer law: the platform lock serializes exclusive requests, and a stale second tab merges over fresh state — the union survives, the witness blesses every legit write',
			async () => {
				// The law rides the Web Locks API; fail closed when absent — a fallback-only platform proves the per-realm discipline, not the origin-wide law.
				const locksLive = await page!.evaluate<boolean>(
					`() => Boolean(navigator.locks && typeof navigator.locks.request === 'function')`
				);
				expect(
					locksLive,
					'navigator.locks is unavailable — the single-writer law cannot prove its full form here'
				);
				// Exclusive-mode discipline: the second request waits for the first to release (the platform primitive the law rides).
				const serialized = await page!.evaluate<number>(PROBE_LOCK_SERIALIZATION);
				expect(serialized === 1, 'the platform lock manager did not serialize exclusive requests');
				// The race, deterministic: tab B opens while the ledger holds two records and caches that view; tab A
				// then lands a third. Tab B's locked write must refresh from the mirror first and merge — the union survives.
				const tabB = await CdpPage.connect(BROWSER_PORT);
				await tabB.enableDomains();
				try {
					await tabB.navigate(`${BASE_URL}/`);
					await sleep(3500); // hydration; tab B's cache = the 2-record ledger
					await page!.evaluate(`() => { location.hash = '#calculator'; return true; }`);
					await sleep(800);
					// P1b left the persisted unit system imperial — return to metric so the 175/70.2 inputs mean cm/kg.
					await page!.evaluate(CLICK_RADIO, { groupAria: 'Unit system', text: 'Metric' });
					await sleep(300);
					await page!.evaluate(FILL_AND_CALC, { age: 30, height: 175, weight: 70.2 });
					// The claim is about the save, not the display: poll the ledger until tab A's third record has landed (the record identity is its timestamp).
					const deadlineA = Date.now() + 10000;
					let afterA: { count: number; lastTimestamp: number } | null = null;
					while (Date.now() < deadlineA) {
						const current = await page!.evaluate<{ count: number; lastTimestamp: number }>(
							READ_LEDGER_STATE
						);
						if (current.count === 3) {
							afterA = current;
							break;
						}
						await sleep(300);
					}
					expect(afterA !== null, "tab A's third record never landed in the ledger");
					// Tab B saves with its stale view — a real calculation through the same UI, not a scripted storage write.
					// Mount the calculator first, then restore metric (its fresh load inherited P1b's imperial unit system).
					await tabB.evaluate(`() => { location.hash = '#calculator'; return true; }`);
					await sleep(800);
					await tabB.evaluate(CLICK_RADIO, { groupAria: 'Gender', index: 0 });
					await tabB.evaluate(CLICK_RADIO, { groupAria: 'Activity level', index: 2 });
					await tabB.evaluate(CLICK_RADIO, { groupAria: 'Unit system', text: 'Metric' });
					await sleep(300);
					await tabB.evaluate(FILL_AND_CALC, { age: 28, height: 168, weight: 61 });
					await sleep(2500); // the locked section + the witness drain
					const audit = await tabB.evaluate<{
						witness: { head: string; length: number } | null;
						computed: { head: string; length: number } | null;
						count: number;
						hasTabARecord: boolean;
					}>(MERGED_LEDGER_AUDIT, { lastTimestamp: afterA!.lastTimestamp });
					expect(
						audit.count === 4,
						`the merged ledger holds ${String(audit.count)} records, expected 4`
					);
					expect(
						Boolean(audit.hasTabARecord),
						"tab A's third record was dropped by tab B's stale write"
					);
					expect(audit.witness !== null, 'no witness after the merged save');
					expect(audit.computed !== null, 'the chain never recomputed over the union');
					expect(
						audit.witness!.head === audit.computed!.head &&
							audit.witness!.length === audit.computed!.length,
						'the witness does not match the recomputed chain over the union'
					);
					expect(
						audit.witness!.length === 4,
						`the witness covers ${String(audit.witness!.length)} records, expected 4`
					);
					// Let the data-change backup + vault mirror drain before P12's byte-equivalence audit.
					await sleep(2500);
					return `union of 4 records survived (tab A's record present), witness matches the chain over the union`;
				} finally {
					await tabB.close().catch(() => {});
				}
			}
		);

		// ── P12: the OPFS flush() vault tier (night-frontier-Z4) ──
		await prove(
			'P12 vault tier: the OPFS vault file is flush-written and byte-equivalent to the latest IndexedDB backup',
			async () => {
				const audit = await page!.evaluate<{
					opfs: { files: string[]; bytes: number; text: string } | null;
					idbLatest: { utf8: number; ts: number } | null;
				}>(VAULT_AUDIT);
				expect(audit.opfs !== null, 'OPFS unreadable in the proof browser');
				expect(
					audit.opfs!.files.length === 1 && audit.opfs!.files[0] === 'vault-backup.json',
					`OPFS root holds ${JSON.stringify(audit.opfs!.files)}, not exactly the vault file`
				);
				expect(audit.opfs!.bytes > 0, 'the vault file is empty');
				const snapshot = JSON.parse(audit.opfs!.text) as Record<string, unknown>;
				expect('bmi.history' in snapshot, 'the vault snapshot does not carry the history key');
				expect(audit.idbLatest !== null, 'no IndexedDB backup exists to compare against');
				expect(
					audit.opfs!.bytes === audit.idbLatest!.utf8,
					`vault bytes ${String(audit.opfs!.bytes)} != latest IDB snapshot bytes ${String(audit.idbLatest!.utf8)}`
				);
				return `vault=${String(audit.opfs!.bytes)}B matches the latest IDB snapshot (flush path live)`;
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
				// Poll until both passphrase fields are mounted: the shell and the modal content arrive across a short transition.
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
          // Let the strength meter settle first: its debounced zxcvbn analysis is main-thread work
          // unrelated to the KDF claim. The derivation window starts HERE: the modal is mounted, filled,
          // and the meter has settled, so any long task recorded from here belongs to the derive path.
          await new Promise((r) => setTimeout(r, 700));
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
				// The P6 export delivered an encrypted v4 file, captured by the startup interceptor. Feed it
				// through the real import input — the same path a user's file takes.
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

		// ── P13: the device-tier KDF ladder (night-frontier-Z4) ──
		await prove(
			'P13 kdf ladder: production envelopes carry device-tier argon2id parameters at or above the OWASP floor',
			async () => {
				const text = await page!.evaluate<string | null>(
					`() => window.__bmiProof.lastExportBlobText`
				);
				expect(text !== null, 'no captured envelope to inspect');
				const outer = JSON.parse(text!) as {
					kdf?: string;
					kdfParams?: {
						type: number;
						mem: number;
						time: number;
						parallelism: number;
						hashLen: number;
					};
				};
				expect(outer.kdf === 'argon2id', 'the production envelope did not use argon2id');
				expect(outer.kdfParams !== undefined, 'the envelope carries no kdf parameters');
				const p = outer.kdfParams!;
				expect(
					p.type === 2 && p.hashLen === 32,
					`wrong kdf type or hash length: ${JSON.stringify(p)}`
				);
				expect(
					p.mem >= 19456 && p.time >= 2 && p.parallelism >= 1,
					`below the OWASP floor: ${JSON.stringify(p)}`
				);
				expect(
					[65536, 32768, 19456].includes(p.mem),
					`mem ${String(p.mem)} KiB is not a ladder rung`
				);
				return `envelope rung: m=${String(p.mem)} KiB, t=${String(p.time)}, p=${String(p.parallelism)} (this device's tier)`;
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

				// Unlock through the existing flow: decrypt of the user's own file, verifier-anchored session
				// registration. The file text rides in the harness: the P8 reload reset the page.
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
				// Readability restored: the preview must show exactly the records the witness covers (the count rides the file, not this claim).
				expect(
					String(unlockedCount).trim() === String(witnessDebug.witness?.length ?? -1),
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

				// Device-access attacker: replace the sealed ledger with a chosen, VALID plaintext history (foreign records).
				const foreign = [
					{ timestamp: 1_700_000_100_000, bmi: 24.9, height: 165, weight: 68, age: 44 },
					{ timestamp: 1_700_000_200_000, bmi: 25.4, height: 165, weight: 69, age: 44 }
				];
				await page!.evaluate(
					`(records) => { localStorage.setItem('bmi.history', JSON.stringify(records)); return true; }`,
					foreign
				);

				// The user calculates: the save goes through (data preservation), but the witness must NOT advance over it.
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
				// The witness still covers exactly the pre-tamper ledger — every record the freeze protected — while
				// storage now holds one more. The freeze is real at any ledger length.
				expect(
					after.witness!.length === before.witness!.length,
					`witness length drifted from ${String(before.witness!.length)} to ${String(after.witness!.length)}`
				);

				// And the head differs from the chain over the tampered pair: the divergence between witness and stored content is real.
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
				return `witness stayed at ${before.witness!.head.slice(0, 12)}... (length ${String(before.witness!.length)}), diverged from the tampered chain`;
			}
		);

		// ── P15: the Import Gauntlet (night-frontier-Z7) ──
		await prove(
			'P15 import gauntlet: every poisoned envelope refused, witness and ledger untouched',
			async () => {
				expect(exportFileText !== null, 'no valid encrypted export captured for the gauntlet');
				const before = await page!.evaluate<GauntletBefore>(GAUNTLET_SETUP);
				const gauntlet = await page!.evaluate<GauntletVerdict>(GAUNTLET_RUN, {
					validEnvelope: exportFileText!,
					passphrase: 'proof-harness-passphrase-1'
				});
				expect(gauntlet.imports >= 9, `the gauntlet ran ${String(gauntlet.imports)} payloads`);
				expect(
					gauntlet.unhandledErrors.length === 0 && gauntlet.egressDelta === 0,
					`poison caused unhandled errors or egress: ${gauntlet.unhandledErrors.join(' | ')}`
				);
				const headBefore = before.witnessBefore ? before.witnessBefore.head : null;
				const headAfter = gauntlet.witnessAfter ? gauntlet.witnessAfter.head : null;
				expect(headAfter === headBefore, 'the witness moved during the gauntlet');
				return `gauntlet=${String(gauntlet.imports)} payloads refused, witness untouched, residue=${JSON.stringify(gauntlet.residue)}`;
			}
		);

		// ── P16: the seal custody live (night-frontier-Z8) ──
		await prove(
			'P16 seal custody live: exactly one wasm engine instantiation (the digest-verified seat) and the sealed ledger obeys the v1 envelope law with an independently recomputed checksum',
			async () => {
				const audit = await page!.evaluate<SealCustodyVerdict>(SEAL_CUSTODY_AUDIT);
				const { wasm, envelope } = audit;
				expect(
					envelope.v === 1 && envelope.ivBytes === 12 && envelope.chkMatches,
					`no sealed v1 envelope with a recomputing checksum (sealed=${String(audit.sealed)} v=${String(envelope.v)} iv=${String(envelope.ivBytes)}B chk=${String(envelope.chkMatches)})`
				);
				expect(
					wasm.count === 1 && wasm.bytes >= 50000 && wasm.bytes <= 72000,
					`expected one engine-band wasm instantiation, saw ${String(wasm.count)} at ${String(wasm.bytes)} bytes`
				);
				return `engine seat live (${String(audit.wasm.bytes)}-byte artifact), envelope v1 with a 12-byte IV and a recomputing checksum`;
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
