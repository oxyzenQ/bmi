// Copyright (C) 2026 rezky_nightky
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The BMI Stellar depth signature (night-signature-1; masked in
 * night-signature-advanced-2).
 *
 * The canonical attribution string is stored here ONLY as an
 * XOR-masked hex payload, not as plain text: a bulk find-and-replace
 * rebrand cannot strip what a grep cannot find. The decoder
 * reconstructs the string at runtime, so every compiled surface still
 * prints the plain attribution:
 *
 *   - src/lib/components/sections/AboutSection.svelte  (the About UI row)
 *   - src/app.html          (author meta as numeric character references,
 *                            rendered plain by every browser)
 *   - static/manifest.json  (masked payload as a machine-readable field)
 *   - package.json          (masked payload as a machine-readable field)
 *   - scripts/build.sh      (decodes the same payload in shell, prints it
 *                            on -V/--version and in the doctor tree)
 *   - src/service-worker.ts (the offline shell footer)
 *   - scripts/gates/check-signature.ts (the fail-closed gate)
 *
 * Layered enforcement, each check independent:
 *   - the gate imports this module, decodes in memory, and pins the
 *     decode against a SHA-256 digest recorded there. The plain
 *     wording exists nowhere in the tracked tree - not even in the
 *     gate. Changing the payload without breaking the gate means
 *     editing the gate too: a visible diff in the repository history.
 *   - signature.test.ts pins the same digest and the shape without
 *     spelling the value, and cross-checks the decode against the
 *     plain package author field as an independent oracle.
 *
 * The honest limit, stated plainly: the decoder is readable by
 * design. A determined attacker can reconstruct the value from it;
 * masking raises the cost of casual theft (bulk grep-and-strip),
 * not of reading. TRADEMARK.md stays deliberately plain - the loud
 * legal layer and the silent runtime layer are different tools - and
 * the AGPL-3.0-only license makes the legal cost real either way.
 */

const SIG_MASK = [0x2f, 0x5e, 0x1d, 0x6a];

/**
 * The masked payload: the UTF-8 bytes of the canonical string, XORed
 * with SIG_MASK (repeating), hex-encoded. Never store the plain
 * string here - the gate's digest is its identity.
 */
export const BMI_STELLAR_SIGNATURE_ENC =
	'5d3b67015601730348366901567e35055727670f410f344a1d6e2f5c' as const;

function decodeSig(payload: string): string {
	let out = '';
	for (let i = 0; i < payload.length; i += 2) {
		const masked = Number.parseInt(payload.slice(i, i + 2), 16);
		const key = SIG_MASK[(i / 2) % SIG_MASK.length] ?? 0;
		out += String.fromCharCode(masked ^ key);
	}
	return out;
}

const decoded = decodeSig(BMI_STELLAR_SIGNATURE_ENC);

export const BMI_STELLAR_SIGNATURE: string = decoded;
export const BMI_STELLAR_SIGNATURE_BUILDER: string = decoded.slice(0, decoded.lastIndexOf(' '));
export const BMI_STELLAR_SIGNATURE_YEAR: string = decoded.slice(decoded.lastIndexOf(' ') + 1);
