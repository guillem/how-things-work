<script lang="ts">
	/**
	 * One pattern of bits, read in different ways.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   bits     — the tiles, and how the number of patterns doubles with each bit
	 *   unsigned — place values 128 … 1, their sum, a 0–255 number line, hex
	 *   signed   — the leftmost bit worth −128; signed and unsigned side by side
	 *   text     — one character per byte, and where its code sits in the table
	 *   colour   — the bits split into red, green, blue (and alpha) channels
	 *   float    — sign | exponent | fraction, decoded; preset chips
	 *   all      — every reading at once, in cards that pulse when a bit flips
	 *
	 * State: each step keeps its own pattern in `params['bits:' + step.id]` (a
	 * string of 0s and 1s), falling back to `hints.bits`. The word size is
	 * `params.fwidth` on the float step, `params.width` on steps with the width
	 * control, 8 otherwise. A pattern of another width is resized with the
	 * model's `resize` (keeps the low bits) — except on the float step, where it
	 * is re-encoded by value, so 0.15625 stays 0.15625 in half precision.
	 * Nothing is written on entry: only a click, a key, a preset or an action
	 * button writes the pattern back.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		add,
		bitString,
		bytes,
		char,
		colour,
		float,
		float16Bits,
		float32Bits,
		hex,
		parseBits,
		placeValue,
		resize,
		signed,
		toBits,
		unsigned,
		type Bits,
		type Width
	} from '../binary';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- phases -----------------------------------------------------------------------
	const phases = ['bits', 'unsigned', 'signed', 'text', 'colour', 'float', 'all'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(
		(phases as readonly string[]).includes(String(step.hints?.phase))
			? (String(step.hints?.phase) as Phase)
			: 'bits'
	);
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);

	const ease = { duration: 700, easing: cubicInOut };
	const weights = Object.fromEntries(phases.map((p) => [p, new Tween(0, ease)])) as Record<
		Phase,
		Tween<number>
	>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived({
		bits: weights.bits.current,
		unsigned: weights.unsigned.current,
		signed: weights.signed.current,
		text: weights.text.current,
		colour: weights.colour.current,
		float: weights.float.current,
		all: weights.all.current
	});
	// Panels share space, so they swap: the old one is gone halfway through.
	const show = (v: number) => smoothstep(0.5, 1, v);

	// ---- the pattern ------------------------------------------------------------------
	const asWidth = (v: unknown): Width => (Number(v) === 16 ? 16 : Number(v) === 32 ? 32 : 8);
	const width = $derived<Width>(
		phase === 'float'
			? Number(params.fwidth) === 16
				? 16
				: 32
			: has('width')
				? asWidth(params.width)
				: 8
	);
	// Each word size of the text, colour and "all" steps keeps its own pattern
	// (8 bits under the plain key), starting from a pattern chosen for that size,
	// so that 32 bits read "Bits" rather than "NUL NUL NUL A". The float step keeps
	// one pattern and re-encodes it by value instead.
	const enc = (s: string) =>
		[...s].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join('');
	const STARTS: Partial<Record<Phase, Partial<Record<Width, string>>>> = {
		text: { 16: enc('Hi'), 32: enc('Bits') },
		all: { 16: enc('Hi'), 32: enc('Bits') },
		// The 8-bit amber (255, 182, 0) in 5-6-5, and in RGBA at 80 % opacity.
		colour: { 16: '1111110110100000', 32: '11111111101101100000000011001100' }
	};
	const perWidth = $derived(phase !== 'float' && has('width') && width !== 8);
	const key = $derived(perWidth ? `bits:${step.id}@${width}` : `bits:${step.id}`);

	/** A float pattern at another width: the nearest float of the new width. */
	function reencode(src: Bits, to: Width): Bits {
		const f = float(src);
		if (!f || to === 8) return resize(src, to);
		return to === 16 ? float16Bits(f.value) : float32Bits(f.value);
	}
	const bits = $derived.by(() => {
		const src =
			parseBits(params[key]) ??
			(perWidth ? parseBits(STARTS[phase]?.[width]) : null) ??
			parseBits(step.hints?.bits) ??
			toBits(0, 8);
		if (src.length === width) return src;
		return phase === 'float' ? reencode(src, width) : resize(src, width);
	});
	const pattern = $derived(bitString(bits));

	function write(next: Bits) {
		setParam(key, bitString(next));
	}
	function toggle(i: number) {
		write(bits.map((b, j) => (j === i ? 1 - b : b)));
	}

	// ---- action buttons: Add 1, All zeros -----------------------------------------------
	// The counts are shared by all steps; react to an increase only (never on
	// entry). Several presses batched into one update are all applied.
	type Carry = { to: string; flipped: boolean[]; carries: number[]; carryOut: number };
	let carry = $state<Carry | null>(null);
	let stagger = false; // the next flip ripples from the right (Add 1)
	const flash = new Tween(0);
	const plusCount = $derived(Number(params.plus1 ?? 0));
	const clearCount = $derived(Number(params.clear ?? 0));
	let lastPlus = untrack(() => Number(params.plus1 ?? 0));
	let lastClear = untrack(() => Number(params.clear ?? 0));
	$effect(() => {
		const n = plusCount;
		untrack(() => {
			if (n > lastPlus && has('plus1')) {
				let b = bits;
				let sum = add(b, toBits(1, width));
				let flipped = b.map((x, i) => x !== sum.bits[i]);
				for (let k = 1; k < n - lastPlus; k++) {
					b = sum.bits;
					sum = add(b, toBits(1, width));
					flipped = b.map((x, i) => x !== sum.bits[i]);
				}
				carry = {
					to: bitString(sum.bits),
					flipped,
					carries: sum.carries,
					carryOut: sum.carryOut
				};
				stagger = true;
				write(sum.bits);
				if (!reduced) {
					flash.set(1, { duration: 0 });
					flash.set(0, { delay: 1600, duration: 900 });
				}
			}
			lastPlus = n;
		});
	});
	$effect(() => {
		const n = clearCount;
		untrack(() => {
			if (n > lastClear && has('clear')) {
				carry = null;
				write(toBits(0, width));
			}
			lastClear = n;
		});
	});
	const carryOn = $derived(
		carry && carry.to === pattern && carry.flipped.length === width
			? reduced
				? 1
				: flash.current
			: 0
	);

	// ---- tile flips ---------------------------------------------------------------------
	// One tween per tile position (0 = showing 0, 1 = showing 1). A flip squashes
	// the tile vertically to nothing at the half-way point, where the face swaps.
	const flips = Array.from({ length: 32 }, () => new Tween(0, { easing: cubicInOut }));
	let prevWidth = 0;
	$effect(() => {
		const b = bits;
		const wd = width;
		untrack(() => {
			const snap = reduced || wd !== prevWidth;
			const ripple = stagger;
			stagger = false;
			prevWidth = wd;
			for (let i = 0; i < 32; i++) {
				const target = i < wd ? b[i] : 0;
				if (flips[i].target === target && !snap) continue;
				flips[i].set(target, {
					duration: snap ? 0 : 380,
					delay: ripple && !snap ? (wd - 1 - i) * 70 : 0
				});
			}
		});
	});

	// ---- card pulse (all) ---------------------------------------------------------------
	const pulse = new Tween(0);
	let lastSeen = '';
	$effect(() => {
		const k = `${step.id}|${pattern}`;
		const p = phase;
		untrack(() => {
			if (p === 'all' && !reduced && lastSeen.startsWith(`${step.id}|`) && k !== lastSeen) {
				pulse.set(1, { duration: 0 });
				pulse.set(0, { delay: 250, duration: 1100 });
			}
			lastSeen = k;
		});
	});

	// ---- geometry -----------------------------------------------------------------------
	interface Tile {
		i: number;
		x: number;
		y: number;
		row: number;
	}
	const geo = $derived.by(() => {
		const wd = width;
		const s = wd === 8 ? 64 : 46;
		const gap = wd === 8 ? 10 : 6;
		const nib = wd === 8 ? 18 : 10;
		const byteGap = 22;
		const perRow = Math.min(wd, 16);
		const off = (j: number) =>
			j * (s + gap) + Math.floor(j / 4) * nib + Math.floor(j / 8) * (byteGap - nib);
		const rowW = off(perRow - 1) + s;
		const x0 = (960 - rowW) / 2;
		const rows = wd === 8 ? [112] : wd === 16 ? [110] : [86, 182];
		const tiles: Tile[] = Array.from({ length: wd }, (_, i) => {
			const row = Math.floor(i / perRow);
			return { i, x: x0 + off(i % perRow), y: rows[row], row };
		});
		return {
			s,
			rows,
			perRow,
			tiles,
			x0,
			x1: x0 + rowW,
			font: wd === 8 ? 30 : 22,
			placeSize: wd === 8 ? 13 : 11,
			placeY: (row: number) => rows[row] + s + (wd === 8 ? 20 : 15)
		};
	});
	const nlX = (n: number, lo: number, hi: number) => 200 + ((n - lo) / (hi - lo)) * 560;
	const cx = (i: number) => geo.tiles[i].x + geo.s / 2;

	/** Bracket segments over tiles a…b (inclusive), split where they change row. */
	function bracket(a: number, b: number, label: string, color: string) {
		const segs: { key: string; x0: number; x1: number; y: number; label: string; color: string }[] =
			[];
		let start = a;
		while (start <= b) {
			const row = geo.tiles[start].row;
			let end = start;
			while (end + 1 <= b && geo.tiles[end + 1].row === row) end++;
			segs.push({
				key: `${label}-${start}`,
				x0: geo.tiles[start].x + 2,
				x1: geo.tiles[end].x + geo.s - 2,
				y: geo.rows[row] - 10,
				label: start === a ? label : `${label.split(' ')[0]} (continued)`,
				color
			});
			start = end + 1;
		}
		return segs;
	}

	// ---- formatting ---------------------------------------------------------------------
	const MINUS = '−';
	const SUP: Record<string, string> = {
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹',
		'-': '⁻'
	};
	const sup = (n: number) => [...String(n)].map((c) => SUP[c] ?? c).join('');
	const int = (n: number) =>
		(n < 0 ? MINUS : '') +
		(Math.abs(n) >= 10000 ? Math.abs(n).toLocaleString('en-US') : String(Math.abs(n)));
	const groups = (s: string, n = 4) => s.match(new RegExp(`.{1,${n}}`, 'g'))?.join(' ') ?? s;

	/** Exact decimal expansion of m × 2^e (m ≥ 0 an integer). */
	function exactDecimal(m: number, e: number): string {
		const big = BigInt(m);
		if (e >= 0) return (big * BigInt(2) ** BigInt(e)).toString();
		const p = -e;
		const digits = (big * BigInt(5) ** BigInt(p)).toString().padStart(p + 1, '0');
		const whole = digits.slice(0, digits.length - p);
		const frac = digits.slice(digits.length - p).replace(/0+$/, '');
		return frac ? `${whole}.${frac}` : whole;
	}
	/** Cuts a decimal string to n significant digits (never inside the whole part), adding "…". */
	function cut(s: string, n: number): string {
		let seen = 0;
		let started = false;
		const dot = s.indexOf('.');
		for (let k = 0; k < s.length; k++) {
			const c = s[k];
			if (c === '.') continue;
			if (c !== '0') started = true;
			if (started) seen++;
			if (seen === n) {
				const end = dot >= 0 && k < dot ? dot : k + 1;
				const rest = s.slice(end).replace('.', '');
				return /[1-9]/.test(rest) ? `${s.slice(0, end)}…` : s.slice(0, end).replace(/\.$/, '');
			}
		}
		return s;
	}
	/** Exact digits; very small or large values as d.ddd… × 10ⁿ, cut to 30 digits. */
	function longForm(s: string): string {
		if (s.length <= 42) return s;
		const [whole, frac = ''] = s.split('.');
		const lead = whole !== '0' ? 0 : frac.search(/[1-9]/);
		const k = whole !== '0' ? whole.length - 1 : -(lead + 1);
		const digits = whole !== '0' ? whole + frac : frac.slice(lead);
		const shown = cut(`${digits[0]}.${digits.slice(1)}`, 26);
		return `${shown} × 10${sup(k)}`;
	}
	/** m and e with value = ±m × 2^e, for a finite float reading. */
	function mantissa(f: NonNullable<ReturnType<typeof float>>) {
		const fb = f.split[2];
		return f.kind === 'normal'
			? { m: 2 ** fb + f.fractionBits, e: f.exponent - fb }
			: { m: f.fractionBits, e: f.exponent - fb };
	}
	function sci(v: number, digits: number) {
		const [m, e] = Math.abs(v)
			.toExponential(digits - 1)
			.split('e');
		const mm = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
		return `${v < 0 ? MINUS : ''}${mm} × 10${sup(Number(e))}`;
	}
	/** A float's value for display: exact digits when short, "…" when cut. */
	function floatText(f: NonNullable<ReturnType<typeof float>>, sig = 12) {
		if (f.kind === 'nan') return 'NaN';
		if (f.kind === 'infinity') return `${f.sign ? MINUS : '+'}∞`;
		if (f.kind === 'zero') return f.sign ? `${MINUS}0` : '0';
		const a = Math.abs(f.value);
		if (a >= 1e7 || a < 1e-4) return sci(f.value, f.split[2] === 23 ? 9 : 5);
		const { m, e } = mantissa(f);
		return (f.sign ? MINUS : '') + cut(exactDecimal(m, e), sig);
	}

	// ---- readings -----------------------------------------------------------------------
	const uValue = $derived(unsigned(bits));
	const sValue = $derived(signed(bits));
	const hexText = $derived(hex(bits));
	const byteList = $derived(bytes(bits));
	const col = $derived(colour(bits));
	const flt = $derived(float(bits));

	// Place value labels under the tiles, per phase.
	const placeLabels = $derived.by(() => {
		const wd = width;
		return bits.map((b, i) => {
			let text: string;
			if (phase === 'signed') text = i === 0 ? `${MINUS}128` : String(placeValue(i, wd));
			else if (phase === 'text') text = String(placeValue(i % 8, 8));
			else if (phase === 'colour') {
				const { start, n } = channelOf(i);
				text = String(placeValue(i - start, n));
			} else if (wd === 32) text = `2^${wd - 1 - i}`;
			else text = String(placeValue(i, wd));
			return { i, text, on: b === 1 };
		});
	});
	const placeW = $derived(1 - w.bits - w.float);

	// Accessible names: what each bit is worth in the current reading.
	function ariaName(i: number) {
		if (phase === 'float' && flt) {
			const [, eb] = flt.split;
			if (i === 0) return 'Sign bit';
			if (i <= eb) return `Exponent bit worth ${placeValue(i - 1, eb)}`;
			return `Fraction bit worth 1/${2 ** (i - eb)}`;
		}
		if (phase === 'signed' && i === 0) return `Bit worth ${MINUS}128`;
		return `Bit worth ${placeValue(i, width)}`;
	}

	// ---- colour channels ----------------------------------------------------------------
	const CHANNELS = [
		{ id: 'R', name: 'Red', color: 'var(--bit-red)' },
		{ id: 'G', name: 'Green', color: 'var(--bit-green)' },
		{ id: 'B', name: 'Blue', color: 'var(--bit-blue)' },
		{ id: 'A', name: 'Alpha', color: 'var(--stage-ink-muted)' }
	];
	function channelOf(i: number) {
		let start = 0;
		for (let c = 0; c < col.split.length; c++) {
			const n = col.split[c];
			if (i < start + n) return { c, start, n };
			start += n;
		}
		return { c: 0, start: 0, n: 8 };
	}
	const channels = $derived.by(() => {
		let start = 0;
		const values = [col.r, col.g, col.b, Math.round(col.a * 255)];
		return col.split.map((n, c) => {
			const field = bits.slice(start, start + n);
			const row = { ...CHANNELS[c], start, n, field: field.join(''), raw: unsigned(field) };
			start += n;
			return { ...row, value: values[c] };
		});
	});
	const colourCount = $derived(
		width === 8
			? '3 + 3 + 2 bits: 2⁸ = 256 colours'
			: width === 16
				? '5 + 6 + 5 bits: 2¹⁶ = 65,536 colours'
				: '8 + 8 + 8 bits: 2²⁴ = 16.7 million colours'
	);

	// ---- float fields -------------------------------------------------------------------
	const FIELD = ['var(--bit-sign)', 'var(--bit-exponent)', 'var(--bit-fraction)'];
	const fieldOf = (i: number) => (!flt ? 0 : i === 0 ? 0 : i <= flt.split[1] ? 1 : 2);

	// ---- tile colours -------------------------------------------------------------------
	function tileColor(i: number): string | null {
		if (phase === 'colour') return CHANNELS[channelOf(i).c].color;
		if (phase === 'float') return FIELD[fieldOf(i)];
		if (phase === 'signed' && i === 0) return 'var(--bit-sign)';
		return null;
	}

	// ---- step cues (pure functions of t, settled by ~4 s) ------------------------------
	const settle = $derived(reduced ? 0 : 1 - smoothstep(2.5, 4, t));
	const beat = $derived(0.5 + 0.5 * Math.sin(t * 5));
	const cueRing = $derived(reduced ? 0.85 : 0.6 + 0.4 * (settle * beat + (1 - settle)));
	const appear = (k: number, gapS = 0.35, from = 0.3) =>
		reduced ? 1 : smoothstep(from + k * gapS, from + 0.3 + k * gapS, t);

	// bits: the doubling ladder lights up one bit at a time.
	const lit = $derived(reduced ? 9 : 1 + t / 0.42);
	const litCount = $derived(Math.min(8, Math.floor(lit)));
	const ladder = $derived(
		Array.from({ length: 8 }, (_, j) => {
			const k = j + 1;
			// Height proportional to the number of patterns: the doubling is visible.
			const h = Math.max(2, (2 ** k / 256) * 214);
			return {
				k,
				cx: 480 + (k - 4.5) * 84,
				h,
				count: 2 ** k,
				on: smoothstep(k - 0.6, k, lit)
			};
		})
	);

	// unsigned / signed: the sum of the place values that are on.
	const terms = $derived(
		bits
			.map((b, i) => ({ i, b, v: phase === 'signed' && i === 0 ? -128 : placeValue(i, 8) }))
			.filter((x) => x.b === 1)
	);

	// text: the codes of the bytes.
	const chars = $derived(byteList.map((code, k) => ({ k, code, ...char(code) })));
	const caseLine = $derived.by(() => {
		const letter = (x: number) => (x >= 65 && x <= 90) || (x >= 97 && x <= 122);
		const c = byteList.find(letter);
		if (c !== undefined) {
			const other = c ^ 32;
			const [up, low] = c < other ? [c, other] : [other, c];
			return `${String.fromCharCode(up)} (${up}) and ${String.fromCharCode(low)} (${low}) differ only in the ringed bit, worth 32`;
		}
		return 'Flip the ringed bit (worth 32) of a letter: A (65) ↔ a (97)';
	});
	const strip = { x0: 96, cw: 3, y: 494, h: 18 };
	const RANGES = [
		{ a: 0, b: 31, color: 'var(--stage-line)', o: 0.55 },
		{ a: 32, b: 47, color: 'var(--stage-grid)', o: 1 },
		{ a: 48, b: 57, color: 'var(--bit-exponent)', o: 0.6 },
		{ a: 58, b: 64, color: 'var(--stage-grid)', o: 1 },
		{ a: 65, b: 90, color: 'var(--bit-on)', o: 0.6 },
		{ a: 91, b: 96, color: 'var(--stage-grid)', o: 1 },
		{ a: 97, b: 122, color: 'var(--bit-on)', o: 0.6 },
		{ a: 123, b: 126, color: 'var(--stage-grid)', o: 1 },
		{ a: 127, b: 159, color: 'var(--stage-line)', o: 0.55 },
		{ a: 160, b: 255, color: 'var(--bit-fraction)', o: 0.45 }
	];
	const RANGE_LABELS = [
		{ at: 16, text: 'control' },
		{ at: 53, text: '0–9' },
		{ at: 78, text: 'A–Z' },
		{ at: 110, text: 'a–z' },
		{ at: 144, text: 'control' },
		{ at: 208, text: 'accented letters (é = 233)' }
	];
	const sx = (code: number) => strip.x0 + (code + 0.5) * strip.cw;
	const markers = $derived.by(() => {
		const sorted = [...chars]
			.filter((c, k) => chars.findIndex((d) => d.code === c.code) === k)
			.sort((p, q) => p.code - q.code);
		let lastX = -1e9;
		let level = 0;
		return sorted.map((c) => {
			const x = sx(c.code);
			level = x - lastX < 46 ? level + 1 : 0;
			lastX = x;
			return { ...c, x, level };
		});
	});
	const keycaps = $derived.by(() => {
		const n = chars.length;
		const size = n === 1 ? 120 : n === 2 ? 112 : 100;
		const gap = 36;
		const x0 = 480 - (n * size + (n - 1) * gap) / 2;
		return { size, x: (k: number) => x0 + k * (size + gap), y: n === 1 ? 236 : 262 };
	});

	// float: presets and the decoded parts.
	const presets = $derived.by(() => {
		const list: { label: string; value: number }[] = [
			{ label: '0.15625', value: 0.15625 },
			{ label: '0.1', value: 0.1 },
			{ label: '1', value: 1 },
			{ label: `${MINUS}2`, value: -2 },
			{ label: '1/3', value: 1 / 3 },
			width === 16
				? { label: '65504 (largest)', value: 65504 }
				: { label: '3.4 × 10³⁸ (largest)', value: 3.4028234663852886e38 }
		];
		let x = 0;
		return list.map((p) => {
			const enc = width === 16 ? float16Bits(p.value) : float32Bits(p.value);
			const wpx = p.label.length * 7.6 + 26;
			const chip = { ...p, bits: enc, active: bitString(enc) === pattern, x, w: wpx };
			x += wpx + 10;
			return chip;
		});
	});
	const presetsW = $derived(presets.reduce((s, p) => s + p.w + 10, -10));
	function setPreset(b: Bits) {
		write(b);
	}
	const floatParts = $derived.by(() => {
		if (!flt) return null;
		const [, eb, fb] = flt.split;
		const bias = 2 ** (eb - 1) - 1;
		const signText = flt.sign ? MINUS : '+';
		const fracStr = bits
			.slice(1 + eb)
			.join('')
			.replace(/0+$/, '');
		const lead = flt.kind === 'normal' ? '1' : '0';
		const sigBinary = `${lead}.${fracStr || '0'}`;
		const sigDec =
			flt.kind === 'normal'
				? cut(exactDecimal(2 ** fb + flt.fractionBits, -fb), 10)
				: `${flt.fractionBits}/2${sup(fb)}`;
		let exact = '';
		if (flt.kind === 'normal' || flt.kind === 'subnormal') {
			const { m, e } = mantissa(flt);
			exact = (flt.sign ? MINUS : '') + longForm(exactDecimal(m, e));
		}
		return { eb, fb, bias, signText, sigBinary, sigDec, exact };
	});
	const floatDy = $derived(width === 16 ? -44 : 0);
	const valueShort = $derived(flt ? floatText(flt) : '');

	// all: the six cards.
	const CARD_W = 280;
	const CARD_H = 150;
	const cardPos = (k: number) => ({
		x: 40 + (k % 3) * (CARD_W + 20),
		y: 262 + Math.floor(k / 3) * 166
	});
	const range = $derived({
		u: `0 to ${int(2 ** width - 1)}`,
		s: `${int(-(2 ** (width - 1)))} to ${int(2 ** (width - 1) - 1)}`
	});

	// ---- header -------------------------------------------------------------------------
	const headers = $derived<Record<Phase, [string, string]>>({
		bits: ['One byte: 8 bits, each on (1) or off (0)', 'Click any bit to flip it.'],
		unsigned: ['Read as an unsigned whole number', 'Each bit is worth twice the bit to its right.'],
		signed: [
			'Read as a signed whole number (two’s complement)',
			`The leftmost bit is worth ${MINUS}128 instead of +128.`
		],
		text: [
			'Read as text: one character per byte',
			width === 8
				? 'The byte is the code of a character (ASCII).'
				: `${width / 8} bytes, ${width / 8} characters.`
		],
		colour: [
			'Read as a colour',
			width === 32
				? '8 bits each of red, green and blue, and 8 of opacity'
				: width === 16
					? '5 bits of red, 6 of green, 5 of blue'
					: '3 bits of red, 3 of green, 2 of blue'
		],
		float: [
			`Read as a floating-point number (${width === 32 ? 'single' : 'half'} precision)`,
			'sign × significand × 2 to the power of the exponent'
		],
		all: [
			`The same ${width} bits, read six ways`,
			'Only the bits are stored: what they mean depends on how they are read.'
		]
	});
	const carryNote = $derived.by(() => {
		if (!carry) return '';
		const n = carry.flipped.filter(Boolean).length;
		if (carry.carryOut) return `+1: all ${n} bits flipped; the last carry has nowhere to go`;
		return n === 1 ? '+1: one bit flipped' : `+1: ${n} bits flipped, carries rippling left`;
	});

	// ---- keyboard -----------------------------------------------------------------------
	function onkey(event: KeyboardEvent, act: () => void) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		act();
	}
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		mono?: boolean;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo ?? true}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-family={opts.mono
			? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
			: undefined}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet brackets(segs: ReturnType<typeof bracket>)}
	{#each segs as sg (sg.key)}
		<path
			d="M{sg.x0} {sg.y + 5} V{sg.y} H{sg.x1} V{sg.y + 5}"
			fill="none"
			stroke={sg.color}
			stroke-width="1.5"
		/>
		{@render txt((sg.x0 + sg.x1) / 2, sg.y - 6, sg.label, 12, {
			anchor: 'middle',
			color: sg.color,
			weight: 600
		})}
	{/each}
{/snippet}

{#snippet numberLine(
	y: number,
	lo: number,
	hi: number,
	ticks: number[],
	v: number,
	color: string,
	name: string,
	strong: boolean
)}
	{@const X = (n: number) => nlX(n, lo, hi)}
	{@render txt(184, y + 4, name, 13, { anchor: 'end', muted: !strong })}
	<line x1="200" x2="760" y1={y} y2={y} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each ticks as tk (tk)}
		<line x1={X(tk)} x2={X(tk)} y1={y - 4} y2={y + 4} stroke="var(--stage-line)" />
		{@render txt(X(tk), y + 20, int(tk), 11, { anchor: 'middle', muted: true })}
	{/each}
	<circle cx={X(v)} cy={y} r="6.5" fill={color} stroke="var(--stage-bg)" stroke-width="2" />
	{@render txt(X(v), y - 13, int(v), 14, { anchor: 'middle', color, weight: 700 })}
{/snippet}

{#snippet keycap(
	x: number,
	y: number,
	size: number,
	c: { text: string; kind: string },
	small: boolean
)}
	<rect
		{x}
		y={y + (small ? 3 : 5)}
		width={size}
		height={size}
		rx={size * 0.14}
		fill="var(--border)"
	/>
	<rect
		{x}
		{y}
		width={size}
		height={size}
		rx={size * 0.14}
		fill="var(--surface)"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	{#if c.kind === 'control'}
		<rect
			x={x + size * 0.14}
			y={y + size * 0.3}
			width={size * 0.72}
			height={size * 0.3}
			rx={size * 0.15}
			fill="var(--stage-grid)"
		/>
		{@render txt(x + size / 2, y + size * 0.5, c.text, size * (c.text.length > 3 ? 0.15 : 0.2), {
			anchor: 'middle',
			weight: 700,
			mono: true,
			halo: false
		})}
		{#if !small}
			{@render txt(x + size / 2, y + size * 0.82, 'control code', 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
		{/if}
	{:else if c.kind === 'space'}
		{@render txt(x + size / 2, y + size * 0.55, '␣', size * 0.42, {
			anchor: 'middle',
			halo: false
		})}
		{#if !small}
			{@render txt(x + size / 2, y + size * 0.82, c.text, 12, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
		{/if}
	{:else}
		{@render txt(x + size / 2, y + size * 0.67, c.text, size * 0.5, {
			anchor: 'middle',
			weight: 600,
			halo: false
		})}
	{/if}
{/snippet}

<g>
	<defs>
		<pattern id="byte-checker" width="16" height="16" patternUnits="userSpaceOnUse">
			<rect width="16" height="16" fill="var(--surface)" />
			<rect width="8" height="8" fill="var(--stage-grid)" />
			<rect x="8" y="8" width="8" height="8" fill="var(--stage-grid)" />
		</pattern>
	</defs>

	<!-- ---------------------------------------------------------------- header -->
	<g style:pointer-events="none">
		{#each phases as p (p)}
			{#if show(w[p]) > 0.01}
				<g opacity={show(w[p])}>
					{@render txt(480, 32, headers[p][0], 17, { anchor: 'middle', weight: 650 })}
					{@render txt(480, 54, headers[p][1], p === 'all' ? 14 : 13, {
						anchor: 'middle',
						muted: p !== 'all',
						weight: p === 'all' ? 600 : 500,
						opacity: 1 - carryOn
					})}
				</g>
			{/if}
		{/each}
		{#if carryOn > 0.01}
			{@render txt(480, 54, carryNote, 13, {
				anchor: 'middle',
				color: 'var(--bit-carry)',
				weight: 600,
				opacity: carryOn
			})}
		{/if}
	</g>

	<!-- ---------------------------------------------------------------- brackets -->
	<g style:pointer-events="none">
		{#if phase === 'text' && width > 8}
			<g opacity={show(w.text)}>
				{#each chars as c (c.k)}
					{@render brackets(
						bracket(c.k * 8, c.k * 8 + 7, `byte ${c.k + 1}`, 'var(--stage-ink-muted)')
					)}
				{/each}
			</g>
		{/if}
		{#if phase === 'colour'}
			<g opacity={show(w.colour)}>
				{#each channels as ch (ch.id)}
					{@render brackets(
						bracket(ch.start, ch.start + ch.n - 1, `${ch.id} ${ch.n} bits`, ch.color)
					)}
				{/each}
			</g>
		{/if}
		{#if phase === 'float' && flt}
			<g opacity={show(w.float)}>
				{@render brackets(bracket(0, 0, 'sign', FIELD[0]))}
				{@render brackets(bracket(1, flt.split[1], `exponent ${flt.split[1]} bits`, FIELD[1]))}
				{@render brackets(
					bracket(flt.split[1] + 1, width - 1, `fraction ${flt.split[2]} bits`, FIELD[2])
				)}
			</g>
		{/if}
	</g>

	<!-- ---------------------------------------------------------------- carries (Add 1) -->
	{#if carryOn > 0.01 && carry}
		<g opacity={carryOn} style:pointer-events="none">
			{#each carry.carries.slice(0, width) as c, i (i)}
				{#if c && i + 1 < width && geo.tiles[i].row === geo.tiles[i + 1].row}
					{@const y = geo.tiles[i].y - 5}
					<path
						d="M{cx(i + 1)} {y} Q{(cx(i) + cx(i + 1)) / 2} {y - 22} {cx(i) + 6} {y - 2}"
						fill="none"
						stroke="var(--bit-carry)"
						stroke-width="2"
						marker-end="url(#arrowhead)"
					/>
				{/if}
			{/each}
			{#if carry.carryOut}
				{@const y = geo.tiles[0].y - 5}
				<path
					d="M{cx(0)} {y} Q{geo.tiles[0].x - 4} {y - 22} {geo.tiles[0].x - 26} {y + 4}"
					fill="none"
					stroke="var(--bit-overflow)"
					stroke-width="2"
					stroke-dasharray="4 3"
					marker-end="url(#arrowhead)"
				/>
			{/if}
		</g>
	{/if}

	<!-- ---------------------------------------------------------------- the tiles -->
	{#each geo.tiles as tile (tile.i)}
		{@const v = flips[tile.i].current}
		{@const face = v >= 0.5 ? 1 : 0}
		{@const k = Math.max(0.06, Math.abs(2 * v - 1))}
		{@const tint = tileColor(tile.i)}
		{@const s = geo.s}
		<g
			class="tile"
			role="switch"
			tabindex="0"
			aria-checked={bits[tile.i] === 1}
			aria-label={ariaName(tile.i)}
			transform="translate({tile.x} {tile.y})"
			onclick={() => toggle(tile.i)}
			onkeydown={(e) => onkey(e, () => toggle(tile.i))}
		>
			<rect class="ring" x="-5" y="-5" width={s + 10} height={s + 10} rx={s * 0.2 + 4} />
			<g transform="translate(0 {(s * (1 - k)) / 2}) scale(1 {k})">
				<rect
					width={s}
					height={s}
					rx={s * 0.18}
					fill={face ? (tint ?? 'var(--bit-on)') : 'var(--bit-off)'}
					stroke={face ? 'none' : (tint ?? 'var(--stage-line)')}
					stroke-width={face ? 0 : tint ? 2 : 1.25}
				/>
				{@render txt(s / 2, s / 2 + geo.font * 0.36, String(face), geo.font, {
					anchor: 'middle',
					weight: 700,
					mono: true,
					halo: false,
					color: face ? 'var(--stage-bg)' : 'var(--stage-ink-muted)'
				})}
			</g>
			{#if carryOn > 0.01 && carry?.flipped[tile.i]}
				<rect
					x="-3"
					y="-3"
					width={s + 6}
					height={s + 6}
					rx={s * 0.2 + 2}
					fill="none"
					stroke="var(--bit-carry)"
					stroke-width="2.5"
					opacity={carryOn}
				/>
			{/if}
			{#if phase === 'text' && tile.i % 8 === 2}
				<rect
					x="-4"
					y="-4"
					width={s + 8}
					height={s + 8}
					rx={s * 0.2 + 3}
					fill="none"
					stroke="var(--bit-carry)"
					stroke-width="2"
					stroke-dasharray="5 3"
					opacity={cueRing * show(w.text)}
				/>
			{/if}
			{#if phase === 'signed' && tile.i === 0}
				<rect
					x="-4"
					y="-4"
					width={s + 8}
					height={s + 8}
					rx={s * 0.2 + 3}
					fill="none"
					stroke="var(--bit-sign)"
					stroke-width="2"
					opacity={cueRing * show(w.signed)}
				/>
			{/if}
		</g>
	{/each}

	<!-- place values under the tiles -->
	{#if placeW > 0.01}
		<g opacity={placeW} style:pointer-events="none">
			{#each placeLabels as pl (pl.i)}
				{@const signBit = phase === 'signed' && pl.i === 0}
				{@const [base, exp] = pl.text.split('^')}
				<text
					x={cx(pl.i)}
					y={geo.placeY(geo.tiles[pl.i].row)}
					class="halo"
					class:muted={!pl.on && !signBit}
					text-anchor="middle"
					font-weight={pl.on ? 700 : 500}
					opacity={pl.on || signBit ? 1 : 0.8}
					style:font-size="{geo.placeSize}px"
					style:fill={signBit ? 'var(--bit-sign)' : undefined}
					>{base}{#if exp !== undefined}<tspan dy="-5" style:font-size="9px">{exp}</tspan
						>{/if}</text
				>
			{/each}
		</g>
	{/if}

	<g style:pointer-events="none">
		<!-- ------------------------------------------------------------ bits -->
		{#if show(w.bits) > 0.01}
			{@const kk = litCount}
			{@const a = geo.tiles[8 - kk]}
			{@const by = geo.rows[0] + geo.s + 12}
			<g opacity={show(w.bits)}>
				<path
					d="M{a.x + 2} {by} V{by + 6} H{geo.x1 - 2} V{by}"
					fill="none"
					stroke="var(--bit-on)"
					stroke-width="1.5"
				/>
				{@render txt(
					(a.x + geo.x1) / 2,
					by + 24,
					`${kk} bit${kk > 1 ? 's' : ''}: ${2 ** kk} patterns`,
					13,
					{
						anchor: 'middle',
						color: 'var(--bit-on)',
						weight: 600
					}
				)}
				{@render txt(480, 262, '2⁸ = 256 possible patterns', 28, { anchor: 'middle', weight: 700 })}
				{@render txt(480, 290, 'every extra bit doubles the count', 14, {
					anchor: 'middle',
					muted: true
				})}
				{#each ladder as r (r.k)}
					{@const top = 548 - r.h}
					<rect
						x={r.cx - 28}
						y={top}
						width="56"
						height={r.h}
						rx="5"
						fill="var(--bit-off)"
						stroke="var(--stage-line)"
						stroke-width="1"
					/>
					<rect
						x={r.cx - 28}
						y={top}
						width="56"
						height={r.h}
						rx="5"
						fill="var(--bit-on)"
						opacity={r.on}
					/>
					{@render txt(r.cx, top - 8, String(r.count), 16, {
						anchor: 'middle',
						weight: 700,
						opacity: 0.35 + 0.65 * r.on
					})}
					{@render txt(r.cx, 568, `${r.k} bit${r.k > 1 ? 's' : ''}`, 12, {
						anchor: 'middle',
						muted: true
					})}
					{#if r.k < 8}
						{@render txt(r.cx + 42, top - 2, '×2', 11, {
							anchor: 'middle',
							color: 'var(--bit-on)',
							weight: 600,
							opacity: ladder[r.k].on
						})}
					{/if}
				{/each}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ unsigned -->
		{#if show(w.unsigned) > 0.01}
			<g opacity={show(w.unsigned)}>
				{#each [0, 1] as nb (nb)}
					{@render txt(
						(geo.tiles[nb * 4].x + geo.tiles[nb * 4 + 3].x + geo.s) / 2,
						224,
						hexText[nb] ?? '',
						14,
						{ anchor: 'middle', mono: true, muted: true, weight: 600 }
					)}
				{/each}
				{@render txt(geo.x0 - 14, 224, 'hex', 12, { anchor: 'end', muted: true })}
				<text
					x="480"
					y="272"
					class="halo"
					text-anchor="middle"
					font-weight="600"
					style:font-size="24px"
					style:font-variant-numeric="tabular-nums"
				>
					{#if terms.length === 0}
						<tspan style:fill="var(--stage-ink-muted)">all bits off</tspan>
					{:else}
						{#each terms as tm, j (tm.i)}
							<tspan opacity={appear(j)} style:fill="var(--bit-on)">{j ? ' + ' : ''}{tm.v}</tspan>
						{/each}
					{/if}
					<tspan opacity={appear(terms.length)}> = {uValue}</tspan>
				</text>
				{@render txt(480, 356, String(uValue), 64, { anchor: 'middle', weight: 700 })}
				{@render txt(480, 384, 'as a whole number from 0 to 255', 13, {
					anchor: 'middle',
					muted: true
				})}
				{@render numberLine(462, 0, 255, [0, 64, 128, 192, 255], uValue, 'var(--bit-on)', '', true)}
				{@render txt(
					480,
					540,
					`in hexadecimal: ${hexText} (one digit for each group of 4 bits)`,
					13,
					{
						anchor: 'middle',
						muted: true
					}
				)}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ signed -->
		{#if show(w.signed) > 0.01}
			{@const uTerms = terms.map((x) => (x.v < 0 ? 128 : x.v))}
			<g opacity={show(w.signed)}>
				{#each [0, 1] as side (side)}
					{@const x = side ? 490 : 110}
					{@const isSigned = side === 0}
					{@const tone = isSigned ? 'var(--bit-sign)' : 'var(--stage-ink-muted)'}
					<rect
						{x}
						y="226"
						width="360"
						height="140"
						rx="12"
						fill="var(--surface)"
						stroke={isSigned ? 'var(--bit-sign)' : 'var(--border)'}
						stroke-width={isSigned ? 1.5 : 1}
					/>
					{@render txt(
						x + 20,
						252,
						isSigned ? 'signed (two’s complement)' : 'unsigned: the same bits',
						13,
						{
							color: tone,
							weight: 600,
							halo: false
						}
					)}
					{@render txt(
						x + 20,
						288,
						terms.length
							? (isSigned ? terms.map((tm) => int(tm.v)) : uTerms.map(String)).join(' + ')
							: 'no bits on',
						16,
						{ halo: false, muted: !isSigned }
					)}
					{@render txt(x + 20, 344, `= ${int(isSigned ? sValue : uValue)}`, 42, {
						weight: 700,
						halo: false,
						color: isSigned ? undefined : 'var(--stage-ink-muted)'
					})}
				{/each}
				{#if sValue !== uValue}
					<line
						x1={nlX(sValue, -128, 127)}
						y1="446"
						x2={nlX(uValue, 0, 255)}
						y2="506"
						stroke="var(--stage-ink-muted)"
						stroke-dasharray="3 4"
						opacity="0.7"
					/>
				{/if}
				{@render numberLine(
					440,
					-128,
					127,
					[-128, -64, 0, 64, 127],
					sValue,
					'var(--bit-sign)',
					'signed',
					true
				)}
				{@render numberLine(
					512,
					0,
					255,
					[0, 64, 128, 192, 255],
					uValue,
					'var(--stage-ink-muted)',
					'unsigned',
					false
				)}
				{@render txt(480, 572, 'Patterns that start with 1 are the negative numbers.', 13, {
					anchor: 'middle',
					muted: true
				})}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ text -->
		{#if show(w.text) > 0.01}
			<g opacity={show(w.text)}>
				{#each chars as c (c.k)}
					{@const x = keycaps.x(c.k)}
					{@render keycap(x, keycaps.y, keycaps.size, c, false)}
					{@render txt(
						x + keycaps.size / 2,
						keycaps.y + keycaps.size + 26,
						`code ${c.code} · hex ${c.code.toString(16).toUpperCase().padStart(2, '0')}`,
						13,
						{ anchor: 'middle', muted: true }
					)}
				{/each}
				{@render txt(480, 434, caseLine, 13, {
					anchor: 'middle',
					weight: 600,
					color: 'var(--bit-carry)'
				})}

				<!-- the code table, 0–255 -->
				{@render txt(strip.x0 + 64 * strip.cw, 466, 'ASCII (0–127)', 12, {
					anchor: 'middle',
					muted: true,
					weight: 600
				})}
				{@render txt(strip.x0 + 192 * strip.cw, 466, 'Latin-1 (128–255)', 12, {
					anchor: 'middle',
					muted: true,
					weight: 600
				})}
				{#each RANGES as r (r.a)}
					<rect
						x={strip.x0 + r.a * strip.cw}
						y={strip.y}
						width={(r.b - r.a + 1) * strip.cw}
						height={strip.h}
						fill={r.color}
						opacity={r.o}
					/>
				{/each}
				<rect
					x={strip.x0}
					y={strip.y}
					width={256 * strip.cw}
					height={strip.h}
					fill="none"
					stroke="var(--stage-line)"
				/>
				<line
					x1={strip.x0 + 128 * strip.cw}
					x2={strip.x0 + 128 * strip.cw}
					y1={strip.y - 6}
					y2={strip.y + strip.h + 6}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
				/>
				{#each RANGE_LABELS as rl (rl.at)}
					{@render txt(sx(rl.at), strip.y - 6, rl.text, 11, { anchor: 'middle', muted: true })}
				{/each}
				{@render txt(strip.x0 - 6, strip.y + 13, '0', 11, { anchor: 'end', muted: true })}
				{@render txt(strip.x0 + 256 * strip.cw + 6, strip.y + 13, '255', 11, { muted: true })}
				{#each markers as mk (mk.k)}
					{@const my = strip.y + strip.h + 3}
					<path
						d="M{mk.x} {my} l-5 8 h10 Z"
						fill="var(--bit-carry)"
						stroke="var(--stage-bg)"
						stroke-width="1"
					/>
					{@render txt(
						mk.x,
						my + 24 + mk.level * 16,
						`${mk.kind === 'printable' || mk.kind === 'latin1' ? mk.text : mk.kind === 'space' ? '␣' : mk.text} ${mk.code}`,
						12,
						{ anchor: 'middle', weight: 700, color: 'var(--bit-carry)' }
					)}
				{/each}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ colour -->
		{#if show(w.colour) > 0.01}
			{@const grow = reduced ? 1 : smoothstep(0.2, 1.4, t)}
			<!-- two rows of tiles at 32 bits: the panel moves down a little -->
			<g opacity={show(w.colour)} transform="translate(0 {width === 32 ? 20 : 0})">
				<rect x="130" y="276" width="200" height="200" rx="14" fill="url(#byte-checker)" />
				<rect
					x="130"
					y="276"
					width="200"
					height="200"
					rx="14"
					fill={col.css}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
				/>
				{@render txt(230, 504, col.css, 12, { anchor: 'middle', mono: true, muted: true })}
				{#each channels as ch, c (ch.id)}
					{@const y = 300 + c * 48}
					{@render txt(392, y, ch.id === 'A' ? 'Opacity' : ch.name, 15, {
						color: ch.color,
						weight: 700
					})}
					{@render txt(482, y, ch.field, 14, { mono: true, weight: 600 })}
					{@render txt(482 + ch.n * 8.6 + 10, y, `${ch.raw} of ${2 ** ch.n - 1}`, 12, {
						muted: true
					})}
					<rect x="676" y={y - 11} width="140" height="12" rx="6" fill="var(--stage-grid)" />
					<rect
						x="676"
						y={y - 11}
						width={Math.max(0, (140 * ch.value * grow) / 255)}
						height="12"
						rx="6"
						fill={ch.color}
					/>
					{@render txt(
						870,
						y,
						ch.id === 'A' ? `${Math.round((ch.value / 255) * 100)} %` : String(ch.value),
						15,
						{
							anchor: 'end',
							weight: 700
						}
					)}
				{/each}
				{@render txt(392, 300 + channels.length * 48 + 10, colourCount, 13, { muted: true })}
				{#if width === 32}
					{@render txt(
						392,
						300 + channels.length * 48 + 30,
						'× 256 levels of opacity: on a checkerboard so you can see it',
						12,
						{
							muted: true
						}
					)}
				{/if}
				{@render txt(392, 300 - 34, 'each channel: 0 (off) to 255 (full)', 12, { muted: true })}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ float -->
		{#if show(w.float) > 0.01 && flt && floatParts}
			{@const fp = floatParts}
			<g opacity={show(w.float)} transform="translate(0 {floatDy})">
				<text
					x="480"
					y="306"
					class="halo"
					text-anchor="middle"
					font-weight="700"
					style:font-size="30px"
					style:font-variant-numeric="tabular-nums"
				>
					{#if flt.kind === 'normal' || flt.kind === 'subnormal'}
						<tspan opacity={appear(0)} style:fill="var(--bit-sign)">{fp.signText}</tspan><tspan
							opacity={appear(1)}
							style:fill="var(--bit-fraction)">{fp.sigDec}</tspan
						><tspan opacity={appear(2)}>&nbsp;× 2</tspan><tspan
							opacity={appear(2)}
							style:fill="var(--bit-exponent)">{sup(flt.exponent)}</tspan
						><tspan opacity={appear(3)}>&nbsp;=&nbsp;{valueShort}</tspan>
					{:else}
						<tspan>{valueShort}</tspan>
					{/if}
				</text>
				{#if flt.kind !== 'normal'}
					{@const tag =
						flt.kind === 'zero'
							? 'zero: exponent and fraction all 0'
							: flt.kind === 'subnormal'
								? 'subnormal: exponent all 0, no hidden 1 — tiny numbers'
								: flt.kind === 'infinity'
									? 'infinity: exponent all 1, fraction 0'
									: 'NaN, “not a number”: exponent all 1, fraction not 0'}
					<rect
						x={480 - (tag.length * 7 + 28) / 2}
						y="322"
						width={tag.length * 7 + 28}
						height="26"
						rx="13"
						fill="var(--surface)"
						stroke="var(--border)"
					/>
					{@render txt(480, 340, tag, 13, { anchor: 'middle', weight: 600, halo: false })}
				{/if}

				<!-- the three fields -->
				{#each [0, 1, 2] as f (f)}
					{@const x = [170, 460, 760][f]}
					{@render txt(x, 384, ['sign', 'exponent', 'fraction'][f], 13, {
						anchor: 'middle',
						color: FIELD[f],
						weight: 700
					})}
					{#if f === 0}
						{@render txt(
							x,
							406,
							`${flt.sign} → ${fp.signText === '+' ? 'positive' : 'negative'}`,
							14,
							{
								anchor: 'middle'
							}
						)}
					{:else if f === 1}
						{@render txt(
							x,
							406,
							flt.kind === 'normal'
								? `stored ${flt.exponentBits} ${MINUS} ${fp.bias} = ${int(flt.exponent)}`
								: flt.exponentBits === 0
									? `stored 0: means ${int(flt.exponent)}, no hidden 1`
									: `stored ${flt.exponentBits}: all ones, reserved`,
							14,
							{ anchor: 'middle' }
						)}
						{@render txt(x, 426, `${fp.bias} is added before storing (the bias)`, 11, {
							anchor: 'middle',
							muted: true
						})}
					{:else}
						{@render txt(x, 406, `${fp.sigBinary} in binary`, 14, {
							anchor: 'middle',
							mono: fp.sigBinary.length > 10,
							color: undefined
						})}
						{@render txt(
							x,
							426,
							flt.kind === 'normal'
								? `= ${fp.sigDec}: the leading “1.” is not stored`
								: 'the fraction bits after the binary point',
							11,
							{ anchor: 'middle', muted: true }
						)}
					{/if}
				{/each}

				{#if fp.exact}
					{@render txt(480, 466, `stored exactly: ${fp.exact}`, 14, {
						anchor: 'middle',
						mono: true,
						weight: 600
					})}
				{/if}

				<!-- presets -->
				{@render txt(480 - presetsW / 2 - 12, 518, 'try:', 13, { anchor: 'end', muted: true })}
			</g>
		{/if}

		<!-- ------------------------------------------------------------ all -->
		{#if show(w.all) > 0.01}
			{@const cards = ['unsigned', 'signed', 'hex', 'text', 'colour', 'float']}
			<g opacity={show(w.all)}>
				<!-- one pattern feeds every reading (no room at 32 bits) -->
				{#if width !== 32}
					{@const y0 = geo.placeY(0) + 10}
					{#each [0, 1, 2] as k (k)}
						{@const x1 = cardPos(k).x + CARD_W / 2}
						<path
							d="M480 {y0} C480 {y0 + 30} {x1} {y0 + 10} {x1} 256"
							fill="none"
							stroke="var(--stage-line)"
							stroke-width="1.5"
							stroke-dasharray="4 4"
							marker-end="url(#arrowhead)"
							opacity={appear(k, 0.15, 0.1)}
						/>
					{/each}
				{/if}
				{#each cards as kind, k (kind)}
					{@const p = cardPos(k)}
					{@const o = appear(k, 0.15, 0.1)}
					{@const title =
						{
							unsigned: 'unsigned number',
							signed: 'signed number (two’s complement)',
							hex: 'hexadecimal',
							text: width === 8 ? 'text: 1 character' : `text: ${width / 8} characters`,
							colour:
								width === 8
									? 'colour (RGB 3-3-2)'
									: width === 16
										? 'colour (RGB 5-6-5)'
										: 'colour (RGBA 8-8-8-8)',
							float:
								width === 8
									? 'floating point'
									: width === 16
										? 'floating point (half)'
										: 'floating point (single)'
						}[kind] ?? ''}
					<g opacity={o}>
						<rect
							x={p.x}
							y={p.y}
							width={CARD_W}
							height={CARD_H}
							rx="12"
							fill="var(--surface)"
							stroke="var(--border)"
						/>
						<rect
							x={p.x}
							y={p.y}
							width={CARD_W}
							height={CARD_H}
							rx="12"
							fill="none"
							stroke="var(--bit-on)"
							stroke-width="2.5"
							opacity={pulse.current}
						/>
						{@render txt(p.x + 18, p.y + 28, title, 13, { muted: true, weight: 600, halo: false })}
						{#if kind === 'unsigned'}
							{@render txt(p.x + 18, p.y + 90, int(uValue), uValue >= 1e8 ? 30 : 40, {
								weight: 700,
								halo: false
							})}
							{@render txt(p.x + 18, p.y + 128, range.u, 12, { muted: true, halo: false })}
						{:else if kind === 'signed'}
							{@render txt(p.x + 18, p.y + 90, int(sValue), Math.abs(sValue) >= 1e8 ? 30 : 40, {
								weight: 700,
								halo: false,
								color: sValue < 0 ? 'var(--bit-sign)' : undefined
							})}
							{@render txt(p.x + 18, p.y + 128, range.s, 12, { muted: true, halo: false })}
						{:else if kind === 'hex'}
							{@render txt(p.x + 18, p.y + 90, groups(hexText), width === 32 ? 32 : 40, {
								weight: 700,
								mono: true,
								halo: false
							})}
							{@render txt(p.x + 18, p.y + 128, 'one digit for each 4 bits', 12, {
								muted: true,
								halo: false
							})}
						{:else if kind === 'text'}
							{#each chars as c (c.k)}
								{@const size = 52}
								{@const x0 = p.x + 18 + c.k * (size + 12)}
								{@render keycap(x0, p.y + 50, size, c, true)}
								{@render txt(x0 + size / 2, p.y + 132, String(c.code), 11, {
									anchor: 'middle',
									muted: true,
									halo: false
								})}
							{/each}
						{:else if kind === 'colour'}
							<rect
								x={p.x + 18}
								y={p.y + 44}
								width="90"
								height="90"
								rx="8"
								fill="url(#byte-checker)"
							/>
							<rect
								x={p.x + 18}
								y={p.y + 44}
								width="90"
								height="90"
								rx="8"
								fill={col.css}
								stroke="var(--stage-ink-muted)"
							/>
							{#each channels as ch, c (ch.id)}
								{@render txt(
									p.x + 128,
									p.y + 62 + c * (channels.length === 4 ? 21 : 26),
									`${ch.id === 'A' ? 'opacity' : ch.name.toLowerCase()} ${ch.id === 'A' ? `${Math.round((ch.value / 255) * 100)} %` : ch.value}`,
									13,
									{ color: ch.color, weight: 600, halo: false }
								)}
							{/each}
						{:else if flt}
							{@render txt(p.x + 18, p.y + 90, valueShort, valueShort.length > 11 ? 24 : 36, {
								weight: 700,
								halo: false
							})}
							{@render txt(
								p.x + 18,
								p.y + 128,
								width === 16 ? '1 + 5 + 10 bits, IEEE 754' : '1 + 8 + 23 bits, IEEE 754',
								12,
								{ muted: true, halo: false }
							)}
						{:else}
							{@render txt(p.x + 18, p.y + 84, 'no 8-bit float', 24, { weight: 700, halo: false })}
							{@render txt(p.x + 18, p.y + 112, 'IEEE 754 starts at 16 bits:', 12, {
								muted: true,
								halo: false
							})}
							{@render txt(p.x + 18, p.y + 128, 'choose a longer word.', 12, {
								muted: true,
								halo: false
							})}
						{/if}
					</g>
				{/each}
			</g>
		{/if}
	</g>

	<!-- float preset chips (focusable buttons) -->
	{#if show(w.float) > 0.01 && flt}
		<g opacity={show(w.float)} transform="translate(0 {floatDy})">
			{#each presets as p (p.label)}
				{@const x = 480 - presetsW / 2 + p.x}
				<g
					class="chip"
					role="button"
					tabindex="0"
					aria-label="Set the bits to {p.label}"
					aria-pressed={p.active}
					onclick={() => setPreset(p.bits)}
					onkeydown={(e) => onkey(e, () => setPreset(p.bits))}
				>
					<rect class="ring" x={x - 4} y="496" width={p.w + 8} height="40" rx="20" />
					<rect
						{x}
						y="500"
						width={p.w}
						height="32"
						rx="16"
						fill={p.active ? 'var(--bit-fraction)' : 'var(--surface)'}
						stroke={p.active ? 'none' : 'var(--border)'}
						stroke-width="1.5"
					/>
					{@render txt(x + p.w / 2, 521, p.label, 13, {
						anchor: 'middle',
						weight: 600,
						halo: false,
						color: p.active ? 'var(--stage-bg)' : undefined
					})}
				</g>
			{/each}
		</g>
	{/if}
</g>

<style>
	.tile,
	.chip {
		cursor: pointer;
		outline: none;
	}
	.ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 2.5;
		opacity: 0;
	}
	.tile:focus-visible .ring,
	.chip:focus-visible .ring {
		opacity: 1;
	}
</style>
