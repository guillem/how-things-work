<script lang="ts">
	/**
	 * A ripple tank seen from above (left, 640 × 568 at 20 px per cm) with two
	 * dippers bobbing in step, and a panel of readouts on the right.
	 *
	 * The water is computed with the model (`amplitudeAt`): circular waves from
	 * each source, falling off as 1/√r, added point by point. For every setting
	 * of the wavelength and spacing the complex amplitude (re, im) is computed
	 * once on a 256 × 227 grid; the height at phase φ is re·cos φ + im·sin φ.
	 * Frames are painted into a canvas and shown as an SVG `<image>`, cached for
	 * 32 phases per wave period and cross-faded, so after the first period no
	 * pixel is recomputed. The phase is a pure function of t: φ = 2π·f·t, with
	 * the tank's waves drawn at 2 cm/s (one wave per second at λ = 2 cm).
	 *
	 * Phases (`step.hints.phase`):
	 *   ripples — the moving water; labels at the edge mark where the calm lines
	 *             leave the tank
	 *   probe   — the calm lines (dashed hyperbolas, path difference m + ½
	 *             wavelengths) and the lines of strongest motion (thin), plus a
	 *             draggable probe (`params['probe:tank']`, "x,y"); the panel gives
	 *             r₁, r₂, their difference and traces of the two arriving waves
	 *             and their sum. Until it is dragged, the probe sits on the first
	 *             calm line.
	 *   bands   — the motion averaged over time (√(re² + im²) ÷ the two waves'
	 *             own sizes added: 1 where they always add in step, 0 where they
	 *             always cancel), with each calm line labelled by its path difference
	 *
	 * The sources are draggable anywhere in the tank: their places live in
	 * `params['sources:tank']` ("x,y;x,y", cm from the tank's top-left) once
	 * moved, with `params.spacing` (the slider, and the keyboard on a source)
	 * always kept to their actual distance, so the slider follows a drag and a
	 * drag follows the slider (which rescales the pair about its midpoint along
	 * the line joining them, moving the midpoint inwards when a source would
	 * leave the tank).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		NEAR,
		amplitudeAt,
		combinedAmplitude,
		farAngle,
		hyperbola,
		loudOrders,
		pathDifference,
		quietOrders,
		type Point
	} from '../waves';
	import { fmt, pathOf } from './ui';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------------------
	const TX = 16;
	const TY = 16;
	const TW = 640;
	const TH = 568;
	const PX = 20; // px per cm
	const SX = 100; // x of the sources
	const SY = TY + TH / 2; // midpoint between them
	const CW = 256; // canvas size
	const CH = 227;
	const PL = 680; // panel left
	const PR = 944; // panel right
	const V_TANK = 2; // cm/s: how fast the drawn ripples travel
	const NPH = 32; // cached frames per period

	const phase = $derived(String(step.hints?.phase ?? 'ripples'));
	const lam = $derived(Math.max(0.5, Number(params.lambda ?? 2)));
	const dWanted = $derived(Math.max(1, Math.min(12, Number(params.spacing ?? 6))));
	const lamPx = $derived(lam * PX);

	// ---- the sources: draggable anywhere in the tank -------------------------------------
	const clampIntoTank = (p: Point): Point => ({
		x: Math.max(TX + 12, Math.min(TX + TW - 12, p.x)),
		y: Math.max(TY + 12, Math.min(TY + TH - 12, p.y))
	});
	/** The pair stored in `params['sources:tank']` (px), or null. */
	const storedPair = $derived.by(() => {
		const raw = params['sources:tank'];
		if (typeof raw !== 'string') return null;
		const pair = raw.split(';').map((half) => half.split(',').map(Number));
		if (pair.length !== 2 || pair.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v))))
			return null;
		return pair.map((p) => clampIntoTank({ x: TX + p[0] * PX, y: TY + p[1] * PX }));
	});
	/**
	 * The pair `a`, `b` set `cm` apart along the line joining them, about their
	 * midpoint — moved inwards as far as it takes to keep both in the tank (12
	 * cm always fits).
	 */
	function fit(a: Point, b: Point, cm: number): [Point, Point] {
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		const [ux, uy] = len > 1e-6 ? [(b.x - a.x) / len, (b.y - a.y) / len] : [0, 1];
		const hx = ux * ((cm * PX) / 2);
		const hy = uy * ((cm * PX) / 2);
		const inside = (m: number, h: number, lo: number, hi: number) =>
			Math.max(lo + Math.abs(h), Math.min(hi - Math.abs(h), m));
		const mx = inside((a.x + b.x) / 2, hx, TX + 12, TX + TW - 12);
		const my = inside((a.y + b.y) / 2, hy, TY + 12, TY + TH - 12);
		return [
			{ x: mx - hx, y: my - hy },
			{ x: mx + hx, y: my + hy }
		];
	}
	/**
	 * The pair as placed — the stored pair, rescaled about its midpoint when the
	 * spacing control has moved beyond it — or, before the first drag, the
	 * slider's symmetric pair in the tank's left half.
	 */
	const pair = $derived.by<[Point, Point]>(() => {
		if (storedPair) {
			const [a, b] = storedPair;
			const dist = Math.hypot(a.x - b.x, a.y - b.y) / PX;
			if (Math.abs(dist - dWanted) < 0.26) return [a, b]; // the slider's 0.5 cm steps
			return fit(a, b, dWanted);
		}
		return [
			{ x: SX, y: SY - (dWanted * PX) / 2 },
			{ x: SX, y: SY + (dWanted * PX) / 2 }
		];
	});
	const s1 = $derived<Point>(pair[0]);
	const s2 = $derived<Point>(pair[1]);
	/** Their actual distance, cm: what the readouts and the model use. */
	const d = $derived(Math.hypot(s2.x - s1.x, s2.y - s1.y) / PX);
	/** Write a placement and its distance to the spacing control. */
	const dOf = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) / PX;
	function writePair(a: Point, b: Point) {
		const cm = (p: Point) =>
			`${Math.round(((p.x - TX) / PX) * 10) / 10},${Math.round(((p.y - TY) / PX) * 10) / 10}`;
		setParam('sources:tank', `${cm(a)};${cm(b)}`);
		setParam('spacing', Math.round(Math.max(1, Math.min(12, dOf(a, b))) * 2) / 2);
	}
	const setSpacing = (v: number) => {
		const dd = Math.round(Math.max(1, Math.min(12, v)) * 2) / 2;
		writePair(...fit(pair[0], pair[1], dd));
	};
	/**
	 * Drag source `i` anywhere in the tank, kept between 1 and 12 cm from the
	 * other (the spacing control's range — the tank allows more, the control
	 * does not).
	 */
	const dragSource = (i: 0 | 1) => (p: Point) => {
		const here = clampIntoTank(p);
		const [a, b] = pair;
		const other = i === 0 ? b : a;
		let dx = here.x - other.x;
		let dy = here.y - other.y;
		const dd = Math.hypot(dx, dy);
		if (dd < 1e-6) {
			dx = 0;
			dy = i === 0 ? -PX : PX;
		} else {
			const clamped = Math.max(PX, Math.min(12 * PX, dd));
			dx = (dx / dd) * clamped;
			dy = (dy / dd) * clamped;
		}
		const moved = { x: other.x + dx, y: other.y + dy };
		writePair(i === 0 ? moved : other, i === 0 ? other : moved);
	};
	const keySource = (k: number | 'start' | 'end') =>
		setSpacing(k === 'start' ? 1 : k === 'end' ? 12 : d + 0.5 * k);

	/** The spacing bracket: beside the pair, on the side away from the tank's centre. */
	const bracket = $derived.by(() => {
		const mx = (s1.x + s2.x) / 2;
		const my = (s1.y + s2.y) / 2;
		const ux = (s2.x - s1.x) / (d * PX || 1);
		const uy = (s2.y - s1.y) / (d * PX || 1);
		const nx = -uy;
		const ny = ux;
		const s = (TX + TW / 2 - mx) * nx + (TY + TH / 2 - my) * ny < 0 ? 1 : -1;
		const ox = s * nx;
		const oy = s * ny;
		const at = (p: Point, off: number, along: number) => ({
			x: p.x + ox * off + ux * along,
			y: p.y + oy * off + uy * along
		});
		return {
			ticks: [at(s1, 6, 0), at(s1, 34, 0), at(s2, 6, 0), at(s2, 34, 0)].map((p, i, all) => ({
				x1: i % 2 === 0 ? p.x : all[i - 1].x,
				y1: i % 2 === 0 ? p.y : all[i - 1].y,
				x2: p.x,
				y2: p.y
			})),
			a: at(s1, 30, 3),
			b: at(s2, 30, -3),
			label: at({ x: mx, y: my }, 44, 0)
		};
	});

	// cross-fade of the overlays between phases
	const wProbe = new Tween(0, { duration: 700, easing: cubicInOut });
	const wBands = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase === 'probe' ? 1 : 0;
		const b = phase === 'bands' ? 1 : 0;
		untrack(() => {
			wProbe.set(p, { duration: reduced ? 0 : 700 });
			wBands.set(b, { duration: reduced ? 0 : 700 });
		});
	});

	// ---- the field ---------------------------------------------------------------------
	/** Complex amplitude, and its size relative to the two waves added, on the canvas grid. */
	const field = $derived.by(() => {
		const re = new Float32Array(CW * CH);
		const im = new Float32Array(CW * CH);
		const rel = new Float32Array(CW * CH);
		const srcs = [s1, s2];
		const p = { x: 0, y: 0 };
		for (let j = 0; j < CH; j++) {
			p.y = TY + ((j + 0.5) * TH) / CH;
			for (let i = 0; i < CW; i++) {
				p.x = TX + ((i + 0.5) * TW) / CW;
				const a = amplitudeAt(p, srcs, lamPx);
				const k = j * CW + i;
				re[k] = a.re;
				im[k] = a.im;
				let sum = 0;
				for (const s of srcs)
					sum += 1 / Math.sqrt(Math.max(Math.hypot(p.x - s.x, p.y - s.y) / lamPx, NEAR));
				rel[k] = a.size / sum;
			}
		}
		return { re, im, rel, key: `${lam}|${d}` };
	});

	// ---- colours (read from the theme) ------------------------------------------------
	type RGB = [number, number, number];
	const LUT = 256;
	let lut = $state.raw<RGB[] | null>(null);
	function toRgb(css: string, ctx: CanvasRenderingContext2D): RGB {
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = css.trim() || '#000';
		ctx.fillRect(0, 0, 1, 1);
		const px = ctx.getImageData(0, 0, 1, 1).data;
		return [px[0], px[1], px[2]];
	}
	$effect(() => {
		void dark;
		if (typeof document === 'undefined') return;
		const c = document.createElement('canvas');
		c.width = c.height = 1;
		const ctx = c.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;
		const cs = getComputedStyle(document.documentElement);
		const trough = toRgb(cs.getPropertyValue('--wav-trough'), ctx);
		const still = toRgb(cs.getPropertyValue('--wav-still'), ctx);
		const crest = toRgb(cs.getPropertyValue('--wav-crest'), ctx);
		const out: RGB[] = [];
		for (let k = 0; k < LUT; k++) {
			const u = (k / (LUT - 1)) * 2 - 1; // −1 trough … 1 crest
			const [a, b, f] = u < 0 ? [still, trough, -u] : [still, crest, u];
			out.push([0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * f)) as RGB);
		}
		lut = out;
	});

	// ---- painting ------------------------------------------------------------------------
	let cv: HTMLCanvasElement | null = null;
	function paint(value: (k: number) => number, colours: RGB[]): string {
		if (typeof document === 'undefined') return '';
		cv ??= document.createElement('canvas');
		cv.width = CW;
		cv.height = CH;
		const ctx = cv.getContext('2d');
		if (!ctx) return '';
		const img = ctx.createImageData(CW, CH);
		const px = img.data;
		for (let k = 0; k < CW * CH; k++) {
			const u = Math.max(-1, Math.min(1, value(k)));
			const c = colours[Math.round(((u + 1) / 2) * (LUT - 1))];
			px[4 * k] = c[0];
			px[4 * k + 1] = c[1];
			px[4 * k + 2] = c[2];
			px[4 * k + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
		return cv.toDataURL();
	}
	/** Height scale: the water saturates near the sources so that the far ripples show. */
	const GAIN = 1.1;
	// A cache of painted frames, not reactive state.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	let frames = new Map<number, string>();
	let framesFor: unknown = null;
	function frame(k: number, f: typeof field, colours: RGB[]): string {
		if (framesFor !== f || frames.size > NPH) {
			frames = new Map();
			framesFor = f;
		}
		const hit = frames.get(k);
		if (hit) return hit;
		const ph = (2 * Math.PI * k) / NPH;
		const c = Math.cos(ph);
		const s = Math.sin(ph);
		const url = paint((i) => GAIN * (f.re[i] * c + f.im[i] * s), colours);
		if (url) frames.set(k, url);
		return url;
	}
	// a new palette invalidates the cache too
	const painted = $derived(lut ? { field, lut } : null);

	// Pre-warm the frame cache, a few milliseconds of painting per animation
	// frame, so the first period plays from cache: painted lazily, on a slow
	// machine each new phase janked the picture for the whole first period.
	// Not while a handle is held (a drag changes the field every move; the
	// cache fills once it is let go), nor in reduced motion (one frame shows).
	// This is a background job, not animation: the one raw requestAnimationFrame
	// in the scenes, cancelled when the field changes or the scene goes.
	let held = $state(0);
	$effect(() => {
		const p = painted;
		if (!p || held > 0 || reduced) return;
		let id = requestAnimationFrame(function fill() {
			if (framesFor !== p.field) return;
			const until = performance.now() + 4;
			const before = frames.size;
			for (let k = 0; k < NPH && performance.now() < until; k++)
				if (!frames.has(k)) frame(k, p.field, p.lut);
			if (frames.size > before && frames.size < NPH) id = requestAnimationFrame(fill);
		});
		return () => cancelAnimationFrame(id);
	});

	const freq = $derived(V_TANK / lam); // Hz, as drawn
	const tt = $derived(reduced ? 2.5 : t);
	const cyc = $derived(freq * tt);
	const ripple = $derived.by(() => {
		if (!painted) return null;
		const x = (((cyc % 1) + 1) % 1) * NPH;
		const k0 = Math.floor(x) % NPH;
		const k1 = (k0 + 1) % NPH;
		return {
			a: frame(k0, painted.field, painted.lut),
			b: frame(k1, painted.field, painted.lut),
			f: x - Math.floor(x)
		};
	});
	const bandsUrl = $derived.by(() => {
		if (!painted) return '';
		const { rel } = painted.field;
		// 0 (always cancel) → trough colour, 1 (always in step) → crest colour
		return paint((i) => 2 * rel[i] - 1, painted.lut);
	});

	// ---- calm lines and lines of strongest motion ----------------------------------------
	const inTank = (p: Point) => p.x >= TX && p.x <= TX + TW && p.y >= TY && p.y <= TY + TH;
	function line(order: number) {
		const delta = order * lamPx;
		const c = (d * PX) / 2;
		const a = Math.abs(delta) / 2;
		const b = Math.sqrt(Math.max(1e-9, c * c - a * a));
		const sMax = Math.max(Math.asinh(1100 / b), a > 0 ? Math.acosh(Math.max(1, 1100 / a)) : 0);
		const inside = hyperbola(s1, s2, delta, sMax, 240).filter(inTank);
		const right = inside.filter((p) => p.x >= SX);
		const end = right.length ? right.reduce((m, p) => (p.x > m.x ? p : m)) : null;
		return { order, d: pathOf(inside), end, pts: inside };
	}
	const quiet = $derived(quietOrders(d * PX, lamPx).map(line));
	const loud = $derived(loudOrders(d * PX, lamPx).map(line));

	/** Where a curve leaves the tank on the right (or the top/bottom), for a label. */
	function edgeLabel(end: Point | null) {
		if (!end) return null;
		const onRight = end.x > TX + TW - 12;
		return {
			x: onRight ? TX + TW - 8 : end.x,
			y: onRight ? end.y : end.y < SY ? TY + 16 : TY + TH - 10,
			anchor: onRight ? ('end' as const) : ('middle' as const)
		};
	}

	const halfFmt = (o: number) => {
		const m = Math.abs(o) - 0.5;
		return `${o < 0 ? '−' : ''}${m === 0 ? '' : m}½ λ`;
	};

	/**
	 * The labels, thinned out where lines crowd together: going round the edge
	 * (top, right, bottom), a label is kept only if it doesn't touch the last one.
	 */
	const edgeLabels = $derived.by(() => {
		const long = oBands > 0.5;
		const list = quiet.flatMap((q) => {
			const e = edgeLabel(q.end);
			if (!e) return [];
			const text = long ? `Δ = ${halfFmt(q.order)}` : 'calm';
			// position along the edge: top (left → right), right (top → bottom), bottom (right → left)
			const along =
				e.anchor === 'end' ? TW + (e.y - TY) : e.y < SY ? e.x - TX : TW + TH + (TX + TW - e.x);
			return [{ ...e, order: q.order, text, along, w: text.length * 7 + 10 }];
		});
		list.sort((a, b) => a.along - b.along);
		const kept: typeof list = [];
		for (const l of list) {
			const prev = kept.at(-1);
			const gap =
				prev && prev.anchor === l.anchor && l.anchor === 'end' ? 18 : prev ? (prev.w + l.w) / 2 : 0;
			if (!prev || l.along - prev.along >= gap) kept.push(l);
		}
		return kept;
	});

	// ---- the probe ---------------------------------------------------------------------------
	const defaultProbe = $derived.by<Point>(() => {
		const first = quiet.find((q) => q.order === 0.5);
		if (first?.pts.length) {
			let best = first.pts[0];
			for (const p of first.pts)
				if (Math.abs(p.x - (SX + 380)) < Math.abs(best.x - (SX + 380))) best = p;
			if (best.y < TY + TH - 30) return best;
		}
		return { x: SX + 380, y: SY + 90 };
	});
	const stored = $derived.by<Point | null>(() => {
		const raw = params['probe:tank'];
		if (typeof raw !== 'string') return null;
		const [x, y] = raw.split(',').map(Number);
		return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
	});
	const probe = $derived(stored ?? defaultProbe);
	function moveProbe(p: Point) {
		const x = Math.max(TX + 12, Math.min(TX + TW - 12, p.x));
		const y = Math.max(TY + 12, Math.min(TY + TH - 12, p.y));
		setParam('probe:tank', `${Math.round(x)},${Math.round(y)}`);
	}
	const r1 = $derived(Math.hypot(probe.x - s1.x, probe.y - s1.y) / lamPx);
	const r2 = $derived(Math.hypot(probe.x - s2.x, probe.y - s2.y) / lamPx);
	const delta = $derived(pathDifference(probe, s1, s2) / lamPx);
	const together = $derived(combinedAmplitude(delta, 1));
	const verdict = $derived(
		together > 0.9
			? {
					text: 'crest meets crest',
					sub: 'the water heaves: reinforcement',
					c: 'var(--wav-probe)'
				}
			: together < 0.25
				? {
						text: 'crest meets trough',
						sub: 'the water is calm: cancellation',
						c: 'var(--stage-ink)'
					}
				: { text: 'partly in step', sub: 'somewhere in between', c: 'var(--stage-ink-muted)' }
	);

	// traces of the two waves arriving at the probe, newest on the right
	const TRX0 = PL + 4;
	const TRX1 = PR - 4;
	const amps = $derived.by(() => {
		const a1 = 1 / Math.sqrt(Math.max(r1, NEAR));
		const a2 = 1 / Math.sqrt(Math.max(r2, NEAR));
		const k = 13 / Math.max(a1, a2);
		return { a1: a1 * k, a2: a2 * k };
	});
	const traces = $derived.by(() => {
		const n = 90;
		const w1: Point[] = [];
		const w2: Point[] = [];
		const sum: Point[] = [];
		const span = 2.5; // periods shown
		for (let i = 0; i <= n; i++) {
			const x = TRX0 + ((TRX1 - TRX0) * i) / n;
			const c = cyc - span * (1 - i / n);
			const y1 = amps.a1 * Math.cos(2 * Math.PI * (r1 - c));
			const y2 = amps.a2 * Math.cos(2 * Math.PI * (r2 - c));
			w1.push({ x, y: -y1 });
			w2.push({ x, y: -y2 });
			sum.push({ x, y: -(y1 + y2) });
		}
		return [
			{ y: 436, d: pathOf(w1), c: 'var(--wav-a)', l: 'wave from source 1', w: 2 },
			{ y: 482, d: pathOf(w2), c: 'var(--wav-b)', l: 'wave from source 2', w: 2 },
			{ y: 546, d: pathOf(sum), c: 'var(--wav-sum)', l: 'sum: what the water does', w: 2.5 }
		];
	});

	const nQuiet = $derived(quiet.length);
	const firstAngle = $derived(nQuiet ? farAngle(0.5, d, lam) : null);

	const oRipple = $derived(1 - wBands.current);
	const oProbe = $derived(wProbe.current);
	const oBands = $derived(wBands.current);
</script>

<g>
	<defs>
		<clipPath id="tank-clip">
			<rect x={TX} y={TY} width={TW} height={TH} rx="14" />
		</clipPath>
	</defs>

	<!-- the water -->
	<g clip-path="url(#tank-clip)">
		<rect x={TX} y={TY} width={TW} height={TH} fill="var(--wav-still)" />
		{#if oRipple > 0 && ripple}
			<g opacity={oRipple}>
				<image href={ripple.a} x={TX} y={TY} width={TW} height={TH} preserveAspectRatio="none" />
				<image
					href={ripple.b}
					x={TX}
					y={TY}
					width={TW}
					height={TH}
					preserveAspectRatio="none"
					opacity={ripple.f}
				/>
			</g>
		{/if}
		{#if oBands > 0 && bandsUrl}
			<image
				href={bandsUrl}
				x={TX}
				y={TY}
				width={TW}
				height={TH}
				preserveAspectRatio="none"
				opacity={oBands}
			/>
		{/if}

		<!-- lines of strongest motion (thin) and calm lines (dashed) -->
		{#if oProbe > 0}
			<g opacity={oProbe} style:pointer-events="none">
				{#each loud as l (l.order)}
					<path d={l.d} fill="none" stroke="var(--wav-probe)" stroke-width="1.5" opacity="0.7" />
				{/each}
				{#each quiet as q (q.order)}
					<path d={q.d} fill="none" stroke="var(--stage-bg)" stroke-width="4" opacity="0.85" />
					<path
						d={q.d}
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="2"
						stroke-dasharray="7 6"
					/>
				{/each}
			</g>
		{/if}
	</g>
	<rect
		x={TX}
		y={TY}
		width={TW}
		height={TH}
		rx="14"
		fill="none"
		stroke="var(--border)"
		stroke-width="1.5"
	/>

	<!-- labels where the calm lines reach the edge -->
	<g style:pointer-events="none">
		{#each edgeLabels as e (e.order)}
			<text
				x={e.x}
				y={e.y + 4}
				text-anchor={e.anchor}
				class="halo"
				style:font-size="12px"
				font-weight="600">{e.text}</text
			>
		{/each}
	</g>

	<!-- the spacing, measured beside the pair (outside it, whatever their angle) -->
	<g style:pointer-events="none">
		{#each bracket.ticks as tk, i (i)}
			<line
				x1={tk.x1}
				y1={tk.y1}
				x2={tk.x2}
				y2={tk.y2}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
		{/each}
		<line
			x1={bracket.a.x}
			y1={bracket.a.y}
			x2={bracket.b.x}
			y2={bracket.b.y}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			marker-start="url(#arrowhead)"
			marker-end="url(#arrowhead)"
		/>
		<text
			x={bracket.label.x}
			y={bracket.label.y}
			text-anchor="middle"
			class="halo"
			style:font-size="12px"
			font-weight="600">{fmt(d, 1)} cm</text
		>
	</g>

	<!-- the probe -->
	{#if oProbe > 0}
		<g opacity={oProbe}>
			<line
				x1={s1.x}
				y1={s1.y}
				x2={probe.x}
				y2={probe.y}
				stroke="var(--wav-a)"
				stroke-width="2.5"
				style:pointer-events="none"
			/>
			<line
				x1={s2.x}
				y1={s2.y}
				x2={probe.x}
				y2={probe.y}
				stroke="var(--wav-b)"
				stroke-width="2.5"
				style:pointer-events="none"
			/>
			{#if phase === 'probe'}
				<Handle
					x={probe.x}
					y={probe.y}
					label="Probe"
					value={Math.round(delta * 100) / 100}
					min={-d / lam}
					max={d / lam}
					valuetext="path difference {fmt(delta, 2)} wavelengths"
					color="var(--wav-probe)"
					onmove={moveProbe}
					ondragstart={() => held++}
					ondragend={() => held--}
					onkey={(k) =>
						typeof k === 'number'
							? moveProbe({ x: probe.x, y: probe.y - 4 * k })
							: moveProbe({ x: probe.x, y: k === 'start' ? TY : TY + TH })}
				/>
			{:else}
				<circle cx={probe.x} cy={probe.y} r="9" fill="var(--wav-probe)" />
			{/if}
		</g>
	{/if}

	<!-- the sources -->
	<Handle
		x={s1.x}
		y={s1.y}
		label="Source 1 (drag it anywhere in the tank)"
		value={d}
		min={1}
		max={12}
		valuetext="{fmt(d, 1)} cm apart"
		color="var(--wav-a)"
		r={8}
		onmove={dragSource(0)}
		ondragstart={() => held++}
		ondragend={() => held--}
		onkey={keySource}
	/>
	<Handle
		x={s2.x}
		y={s2.y}
		label="Source 2 (drag it anywhere in the tank)"
		value={d}
		min={1}
		max={12}
		valuetext="{fmt(d, 1)} cm apart"
		color="var(--wav-b)"
		r={8}
		onmove={dragSource(1)}
		ondragstart={() => held++}
		ondragend={() => held--}
		onkey={keySource}
	/>

	<!-- ---- panel ---- -->
	<g style:pointer-events="none">
		<text x={PL} y={40} style:font-size="16px" font-weight="700">Ripple tank</text>
		<text x={PL} y={60} class="muted" style:font-size="12px">seen from above, slowed down</text>

		<!-- legend -->
		{#if oBands < 0.5}
			<g transform="translate({PL} 84)">
				<rect width="16" height="16" rx="3" fill="var(--wav-crest)" stroke="var(--border)" />
				<text x="24" y="12" style:font-size="12px">crest (water lifted)</text>
				<rect y="24" width="16" height="16" rx="3" fill="var(--wav-still)" stroke="var(--border)" />
				<text x="24" y="36" style:font-size="12px">level water</text>
				<rect
					y="48"
					width="16"
					height="16"
					rx="3"
					fill="var(--wav-trough)"
					stroke="var(--border)"
				/>
				<text x="24" y="60" style:font-size="12px">trough</text>
			</g>
		{:else}
			<g transform="translate({PL} 84)">
				<rect width="16" height="16" rx="3" fill="var(--wav-crest)" stroke="var(--border)" />
				<text x="24" y="12" style:font-size="12px">water heaves: waves in step</text>
				<rect
					y="24"
					width="16"
					height="16"
					rx="3"
					fill="var(--wav-trough)"
					stroke="var(--border)"
				/>
				<text x="24" y="36" style:font-size="12px">calm: waves cancel</text>
			</g>
		{/if}

		<!-- readouts -->
		<g transform="translate({PL} 176)">
			<text class="muted" style:font-size="12px">Wavelength</text>
			<text y="24" style:font-size="18px" font-weight="700">{fmt(lam, 1)} cm</text>
			<text x="130" class="muted" style:font-size="12px">Spacing</text>
			<text x="130" y="24" style:font-size="18px" font-weight="700">{fmt(d, 1)} cm</text>
			<text y="50" class="muted" style:font-size="12px">= {fmt(d / lam, 2)} wavelengths apart</text>
		</g>

		{#if oProbe < 0.5}
			<g transform="translate({PL} 262)">
				<text class="muted" style:font-size="12px">Calm lines</text>
				<text y="26" style:font-size="22px" font-weight="700">{nQuiet}</text>
				<text y="48" class="muted" style:font-size="11px">one pair for each ½λ, 1½λ, 2½λ…</text>
				<text y="63" class="muted" style:font-size="11px">that is shorter than the spacing</text>
				{#if oBands > 0.5}
					<text y="98" class="muted" style:font-size="12px">First calm line, far away</text>
					<text y="122" style:font-size="18px" font-weight="700"
						>{firstAngle === null ? 'none' : `${fmt(firstAngle, 1)}° off centre`}</text
					>
					<text y="142" class="muted" style:font-size="11px">sin θ = ½ λ ÷ spacing</text>
				{/if}
			</g>
		{:else}
			<g transform="translate({PL} 262)">
				<text class="muted" style:font-size="12px">From source 1</text>
				<text y="22" style:font-size="16px" font-weight="700" style:fill="var(--wav-a)"
					>r₁ = {fmt(r1, 2)} λ</text
				>
				<text x="130" class="muted" style:font-size="12px">From source 2</text>
				<text x="130" y="22" style:font-size="16px" font-weight="700" style:fill="var(--wav-b)"
					>r₂ = {fmt(r2, 2)} λ</text
				>
				<text y="52" class="muted" style:font-size="12px">Path difference r₁ − r₂</text>
				<text y="76" style:font-size="18px" font-weight="700">{fmt(delta, 2)} λ</text>
				<text y="104" style:font-size="14px" font-weight="700" style:fill={verdict.c}
					>{verdict.text}</text
				>
				<text y="122" class="muted" style:font-size="12px">{verdict.sub}</text>
			</g>
			<!-- the waves arriving at the probe -->
			{#each traces as row (row.l)}
				<line x1={TRX0} x2={TRX1} y1={row.y} y2={row.y} stroke="var(--stage-grid)" />
				<text x={PL} y={row.y - 20} class="muted" style:font-size="11px">{row.l}</text>
				<path
					d={row.d}
					transform="translate(0 {row.y})"
					fill="none"
					stroke={row.c}
					stroke-width={row.w}
				/>
			{/each}
			<text x={TRX1} y={588} text-anchor="end" class="muted" style:font-size="11px"
				>at the probe, over time →</text
			>
		{/if}
	</g>
</g>
