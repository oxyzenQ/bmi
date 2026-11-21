// SPDX-FileCopyrightText: 2025-2026 rezky_nightky (oxyzenQ)
// SPDX-License-Identifier: AGPL-3.0-only OR Commercial

/**
 * Zero-dependency Chrome DevTools Protocol client for the runtime proof
 * harness. Bun's native WebSocket speaks CDP directly, so the proof lane
 * needs no browser automation dependency in the tree.
 *
 * Scope: one browser process, one page target. The page keeps a single
 * session across all proofs so state (history, storage, service worker)
 * carries the way a real user session carries.
 */

const CDP_HOST = 'http://127.0.0.1';

export interface CdpEvent {
	method: string;
	params: Record<string, unknown>;
}

export class CdpPage {
	private ws: WebSocket | null = null;
	private nextId = 1;
	private pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (e: Error) => void }
	>();
	private listeners = new Map<string, Array<(params: Record<string, unknown>) => void>>();
	readonly url: string;

	private constructor(url: string) {
		this.url = url;
	}

	/** Connect to a browser debugging endpoint and open a new page target. */
	static async connect(browserPort: number): Promise<CdpPage> {
		const res = await fetch(`${CDP_HOST}:${browserPort}/json/new?about:blank`, { method: 'PUT' });
		if (!res.ok) {
			throw new Error(`CDP target creation failed: ${res.status} ${await res.text()}`);
		}
		const target = (await res.json()) as { webSocketDebuggerUrl: string };
		const page = new CdpPage(target.webSocketDebuggerUrl);
		await page.open();
		return page;
	}

	private open(): Promise<void> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(this.url);
			ws.onopen = () => resolve();
			ws.onerror = () => reject(new Error('CDP WebSocket failed'));
			ws.onclose = () => {
				this.ws = null;
			};
			ws.onmessage = (event) => {
				const message = JSON.parse(String(event.data)) as {
					id?: number;
					method?: string;
					params?: Record<string, unknown>;
					error?: { message: string };
				};
				if (message.id !== undefined) {
					const entry = this.pending.get(message.id);
					if (entry) {
						this.pending.delete(message.id);
						if (message.error) {
							entry.reject(new Error(`CDP error: ${message.error.message}`));
						} else {
							// Command responses carry their payload in `result`;
							// events carry theirs in `params`.
							entry.resolve(message.result ?? message.params ?? {});
						}
					}
					return;
				}
				if (message.method) {
					for (const listener of this.listeners.get(message.method) ?? []) {
						listener(message.params ?? {});
					}
				}
			};
			this.ws = ws;
		});
	}

	private send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
		if (!this.ws) throw new Error('CDP WebSocket is closed');
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.ws!.send(JSON.stringify({ id, method, params }));
		});
	}

	on(method: string, handler: (params: Record<string, unknown>) => void): void {
		const list = this.listeners.get(method) ?? [];
		list.push(handler);
		this.listeners.set(method, list);
	}

	async enableDomains(): Promise<void> {
		await this.send('Page.enable');
		await this.send('Runtime.enable');
		await this.send('Network.enable');
	}

	/** Install a startup script that runs before any page script on load. */
	async addStartupScript(source: string): Promise<void> {
		await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
	}

	/** Navigate and wait for the load event. */
	async navigate(url: string, timeoutMs = 30000): Promise<void> {
		const loaded = this.waitForEvent('Page.loadEventFired', timeoutMs);
		await this.send('Page.navigate', { url });
		await loaded;
	}

	waitForEvent(method: string, timeoutMs = 30000): Promise<Record<string, unknown>> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.off(method, handler);
				reject(new Error(`Timed out waiting for CDP event: ${method}`));
			}, timeoutMs);
			const handler = (params: Record<string, unknown>) => {
				clearTimeout(timer);
				this.off(method, handler);
				resolve(params);
			};
			this.on(method, handler);
		});
	}

	private off(method: string, handler: (params: Record<string, unknown>) => void): void {
		const list = this.listeners.get(method) ?? [];
		const index = list.indexOf(handler);
		if (index >= 0) list.splice(index, 1);
	}

	/**
	 * Evaluate a function source in the page: the source is wrapped and
	 * invoked with the (optionally provided) JSON-serialized arguments,
	 * awaited as a promise, and returned by value.
	 */
	async evaluate<T>(fnSource: string, args?: unknown, _timeoutMs = 20000): Promise<T> {
		const call = args === undefined ? `(${fnSource})()` : `(${fnSource})(${JSON.stringify(args)})`;
		const result = (await this.send('Runtime.evaluate', {
			expression: call,
			awaitPromise: true,
			returnByValue: true
		})) as {
			result?: { value?: T; type?: string; description?: string };
			exceptionDetails?: unknown;
		};
		if (result.exceptionDetails) {
			throw new Error(`Page evaluation threw: ${JSON.stringify(result.exceptionDetails)}`);
		}
		return result.result?.value as T;
	}

	/** Emulate (or clear) offline network conditions. */
	async setOffline(offline: boolean): Promise<void> {
		await this.send('Network.emulateNetworkConditions', {
			offline,
			latency: 0,
			downloadThroughput: -1,
			uploadThroughput: -1
		});
	}

	async close(): Promise<void> {
		if (!this.ws) return;
		const closed = new Promise<void>((resolve) => {
			if (this.ws) this.ws.onclose = () => resolve();
		});
		try {
			await this.send('Target.closeTarget', {});
		} catch {
			/* the socket may drop mid-close; that is fine */
		}
		this.ws.close();
		await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 500))]);
		this.ws = null;
	}
}

/** Spawn a pinned chrome-headless-shell with a debugging port. */
export function launchChrome(
	binaryPath: string,
	userDataDir: string,
	port: number
): ReturnType<typeof Bun.spawn> {
	// CI runners and containers typically forbid unprivileged user
	// namespaces and ship a small /dev/shm, so the sandbox flags are part
	// of the contract, not a workaround: without them the process dies
	// before the debugging endpoint exists.
	return Bun.spawn(
		[
			binaryPath,
			'--headless',
			`--remote-debugging-port=${String(port)}`,
			`--user-data-dir=${userDataDir}`,
			'--no-first-run',
			'--disable-gpu',
			'--no-sandbox',
			'--disable-dev-shm-usage',
			'--window-size=1280,900',
			'about:blank'
		],
		{
			stdout: 'ignore',
			stderr: 'pipe'
		}
	);
}

/** Poll the debugging endpoint until the browser answers. */
export async function waitForDebugger(port: number, timeoutMs = 15000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${CDP_HOST}:${port}/json/version`);
			if (res.ok) return;
		} catch {
			/* browser not up yet */
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error(`Chrome debugging endpoint did not come up on port ${String(port)}`);
}
