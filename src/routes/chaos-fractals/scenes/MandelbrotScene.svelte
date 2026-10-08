<script lang="ts">
	/**
	 * The Mandelbrot set, drawn pixel by pixel into a canvas and shown as an SVG
	 * `<image>` (left, 720 × 560), with a panel of readouts on the right.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   set  — the whole set with real and imaginary axes. A point c tours a loop
	 *          (a pure function of t: it rests inside the main cardioid, just
	 *          outside in seahorse valley, inside the period-2 bulb, then far
	 *          outside), and its orbit z₀ = 0, z₁, … (first 20) is drawn as linked
	 *          dots. Reduced motion: one bounded and one escaping orbit, static.
	 *   zoom — explore: drag to pan, wheel / + − buttons / keys to zoom, arrows to
	 *          pan; `params.place` jumps to a `TOUR` view with an animated zoom.
	 *          The view is kept in `params['view:zoom']` as "x,y,width" (full
	 *          precision), so it survives step changes. Width is capped at 3e-13
	 *          (a pixel is then about two steps of double precision near x = −1.75).
	 *          On the near-whole view, an inset magnifies the tiny copy of the set on
	 *          the antenna; when the whole view is inside the set, a hint says so. A hand-made move clears
	 *          `params.place`, so choosing the same place again flies back there.
	 *
	 * Rendering is NOT tied to t: an `$effect` that depends only on the displayed
	 * view and the theme colours draws a small preview synchronously (its size
	 * shrinks as the repetitions grow, so it stays within a few milliseconds), then (after a
	 * short debounce, so a drag or a zoom animation does not restart it every frame)
	 * the full-resolution picture row by row in chunks of ~10 ms spread over timeouts.
	 * The topic brief explicitly allows splitting this work across frames; these
	 * timers schedule computation only, never motion. Nothing renders while the
	 * view is still.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, easeInOut, lerp, smoothstep, startDrag, toSvg } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { escape, iterationsFor, TOUR } from '../chaos';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- geometry ---------------------------------------------------------------------
	const IMG = { x: 20, y: 20, w: 720, h: 560 };
	const CX = IMG.x + IMG.w / 2;
	const CY = IMG.y + IMG.h / 2;
	const PL = 764; // panel left
	const PR = 944; // panel right
	// Canvas resolutions: full (1:1 with the stage units) and the widest instant preview.
	const FW = 720;
	const FH = 560;
	const PW = 120;
	/** Repetitions allowed for the synchronous preview (a few ms even if all inside). */
	const PREVIEW_BUDGET = 1.5e6;
	function previewSize(max: number) {
		const w = Math.round(clamp(Math.sqrt(((PREVIEW_BUDGET / max) * IMG.w) / IMG.h), 24, PW));
		return { w, h: Math.max(1, Math.round((w * IMG.h) / IMG.w)) };
	}
	// Mini-map of the whole set, same shape as the image.
	const MM = { x: PL, y: 420, w: PR - PL, h: Math.round(((PR - PL) * IMG.h) / IMG.w) };

	interface View {
		x: number;
		y: number;
		width: number;
	}
	const WHOLE: View = TOUR[0];
	// The set step: a little wider than the tour's whole view, so that 1 and ±i fit.
	const SET_VIEW: View = { x: -0.62, y: 0, width: 3.6 };
	const MIN_W = 3e-13;
	const MAX_W = 4;
	const atLimit = (v: View) => v.width <= MIN_W * 1.0001;

	const clampView = (v: View): View => ({
		x: clamp(v.x, -3, 2),
		y: clamp(v.y, -2, 2),
		width: clamp(v.width, MIN_W, MAX_W)
	});
	function parseView(raw: unknown): View | null {
		if (typeof raw !== 'string') return null;
		const [x, y, width] = raw.split(',').map(Number);
		if (![x, y, width].every(Number.isFinite) || width <= 0) return null;
		return clampView({ x, y, width });
	}

	// ---- phases ---------------------------------------------------------------------------
	const zoomOn = $derived(step.hints?.phase === 'zoom');
	const wSet = new Tween(1, { duration: 700, easing: cubicInOut });
	const wZoom = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const z = zoomOn;
		untrack(() => {
			wSet.set(z ? 0 : 1, { duration: reduced ? 0 : 700 });
			wZoom.set(z ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const show = (v: number) => smoothstep(0.5, 1, v);

	// ---- the view and its animation ------------------------------------------------------
	/**
	 * The view part-way (u, 0–1) from a to b: the log of the width changes
	 * steadily (zooming out first when the two places are far apart), and the
	 * centre moves in step with the width, so the destination stays in view.
	 */
	function viewAt(a: View, b: View, u: number): View {
		const d = Math.hypot(b.x - a.x, b.y - a.y);
		const wp = Math.max(a.width, b.width, Math.min(MAX_W, 1.6 * d));
		const L0 = Math.log(a.width);
		const L1 = Math.log(b.width);
		const Lp = Math.log(wp);
		const A = Lp - L0;
		const B = Lp - L1;
		if (A + B < 1e-9) return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), width: a.width };
		const m = A < 1e-9 ? a : B < 1e-9 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
		const s = u * (A + B);
		if (s < A) {
			const w = Math.exp(L0 + s);
			const f = (w - a.width) / (wp - a.width);
			return { x: lerp(a.x, m.x, f), y: lerp(a.y, m.y, f), width: w };
		}
		const w = Math.exp(Lp - (s - A));
		const f = B < 1e-9 ? 1 : (wp - w) / (wp - b.width);
		return { x: lerp(m.x, b.x, f), y: lerp(m.y, b.y, f), width: w };
	}

	let from = $state.raw<View>(SET_VIEW);
	let to = $state.raw<View>(SET_VIEW);
	const prog = new Tween(1, { easing: cubicInOut });
	const view = $derived(prog.current >= 1 ? to : viewAt(from, to, prog.current));

	function go(v: View, ms: number) {
		from = untrack(() => view);
		to = v;
		if (ms <= 0 || reduced) prog.set(1, { duration: 0 });
		else {
			prog.set(0, { duration: 0 });
			prog.set(1, { duration: ms });
		}
	}
	/** Moves the zoom view (and remembers it in the params). */
	function setView(v: View, ms = 0) {
		const c = clampView(v);
		setParam('view:zoom', `${c.x},${c.y},${c.width}`);
		go(c, ms);
	}
	const tourView = (id: unknown): View => TOUR.find((p) => p.id === id) ?? WHOLE;

	// Step changes: back to the whole set, or to the remembered zoom view.
	let mounted = false;
	$effect(() => {
		const z = zoomOn;
		untrack(() => {
			const ms = mounted ? 900 : 0;
			mounted = true;
			if (!z) go(SET_VIEW, ms);
			else go(parseView(params['view:zoom']) ?? tourView(params.place), ms);
		});
	});
	// A new choice of place: fly there.
	let lastPlace: string | undefined;
	$effect(() => {
		const p = String(params.place ?? '');
		untrack(() => {
			if (lastPlace !== undefined && p !== lastPlace && zoomOn && TOUR.some((q) => q.id === p))
				setView(tourView(p), 1500);
			lastPlace = p;
		});
	});
	/** A hand-made move: the place buttons no longer describe the view. */
	function moved() {
		if (params.place !== '') setParam('place', '');
	}

	// ---- mapping between the stage and the complex plane ------------------------------
	const sx = (re: number, v: View) => CX + ((re - v.x) / v.width) * IMG.w;
	const sy = (im: number, v: View) => CY - ((im - v.y) / v.width) * IMG.w;
	const re = (x: number, v: View) => v.x + ((x - CX) / IMG.w) * v.width;
	const im = (y: number, v: View) => v.y - ((y - CY) / IMG.w) * v.width;

	// ---- colours ----------------------------------------------------------------------------
	// Cyclic palette of fixed hues (they read on both backgrounds), indexed by the
	// square root of the smooth escape count so deep zooms keep their bands; the
	// far field fades into the stage background, the inside is `--chaos-set`.
	const STOPS: [number, string][] = [
		[0, '#5f3dc4'],
		[0.28, '#4dabf7'],
		[0.5, '#e7f5ff'],
		[0.74, '#f06595'],
		[1, '#5f3dc4']
	];
	type RGB = [number, number, number];
	interface Palette {
		bg: RGB;
		inside: number;
		lut: RGB[];
		ramp: number;
	}
	const LUT = 512;
	const pack = ([r, g, b]: RGB) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
	function toRgb(css: string, ctx: CanvasRenderingContext2D): RGB {
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000';
		ctx.fillStyle = css.trim() || '#000';
		ctx.fillRect(0, 0, 1, 1);
		const d = ctx.getImageData(0, 0, 1, 1).data;
		return [d[0], d[1], d[2]];
	}
	function readPalette(isDark: boolean): Palette {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const ctx = cv.getContext('2d', { willReadFrequently: true })!;
		const cs = getComputedStyle(document.documentElement);
		const bg = toRgb(cs.getPropertyValue('--stage-bg'), ctx);
		const set = toRgb(cs.getPropertyValue('--chaos-set'), ctx);
		const stops = STOPS.map(([u, c]) => [u, toRgb(c, ctx)] as const);
		const lut: RGB[] = [];
		for (let k = 0; k < LUT; k++) {
			const u = k / LUT;
			let i = 0;
			while (stops[i + 1][0] < u) i++;
			const [u0, c0] = stops[i];
			const [u1, c1] = stops[i + 1];
			const f = easeInOut((u - u0) / (u1 - u0));
			lut.push([0, 1, 2].map((j) => Math.round(lerp(c0[j], c1[j], f))) as RGB);
		}
		return { bg, inside: pack(set), lut, ramp: isDark ? 9 : 7 };
	}
	function colour(n: number, p: Palette) {
		const s = Math.sqrt(Math.max(0, n));
		const k = Math.floor((((((s - 1) * 0.3) % 1) + 1) % 1) * LUT) % LUT;
		const c = p.lut[k];
		const a = smoothstep(0, p.ramp, n);
		return pack([
			Math.round(lerp(p.bg[0], c[0], a)),
			Math.round(lerp(p.bg[1], c[1], a)),
			Math.round(lerp(p.bg[2], c[2], a))
		]);
	}

	let palette = $state.raw<Palette | null>(null);
	$effect(() => {
		palette = readPalette(dark);
	});

	// ---- rendering --------------------------------------------------------------------------
	/** Paints rows [r0, r1) of a w × h picture of view v. */
	function paint(
		px32: Uint32Array,
		w: number,
		h: number,
		v: View,
		max: number,
		p: Palette,
		r0 = 0,
		r1 = h
	) {
		const d = v.width / w;
		const x0 = v.x - (w / 2 - 0.5) * d;
		const y0 = v.y + (h / 2 - 0.5) * d;
		for (let j = r0; j < r1; j++) {
			const cy = y0 - j * d;
			for (let i = 0; i < w; i++) {
				const cx = x0 + i * d;
				// Inside the main cardioid or the period-2 bulb: in the set, no need to iterate.
				const q = (cx - 0.25) * (cx - 0.25) + cy * cy;
				const known =
					q * (q + cx - 0.25) <= 0.25 * cy * cy || (cx + 1) * (cx + 1) + cy * cy <= 0.0625;
				const n = known ? max : escape(cx, cy, max);
				px32[j * w + i] = n >= max ? p.inside : colour(n, p);
			}
		}
	}
	function canvas(w: number, h: number) {
		const cv = document.createElement('canvas');
		cv.width = w;
		cv.height = h;
		const ctx = cv.getContext('2d')!;
		const data = ctx.createImageData(w, h);
		return { cv, ctx, data, px32: new Uint32Array(data.data.buffer) };
	}
	const keyOf = (v: View) => `${v.x},${v.y},${v.width}`;

	let previewUrl = $state('');
	let fullUrl = $state('');
	let fullKey = $state('');
	let busy = $state(false);
	let minimapUrl = $state('');
	let allInside = $state(false);
	let copyUrl = $state('');

	$effect(() => {
		const v = view;
		const p = palette;
		if (!p) return;
		const max = iterationsFor(v.width);
		const key = keyOf(v);
		// Instant preview (small enough to draw within a frame, even deep down).
		const ps = previewSize(max);
		const pre = canvas(ps.w, ps.h);
		paint(pre.px32, ps.w, ps.h, v, max, p);
		pre.ctx.putImageData(pre.data, 0, 0);
		previewUrl = pre.cv.toDataURL();
		allInside = pre.px32.every((c) => c === p.inside);
		// Full resolution, in chunks, once the view has been still for a moment.
		let timer: ReturnType<typeof setTimeout> | undefined;
		let cancelled = false;
		const start = () => {
			const job = canvas(FW, FH);
			let row = 0;
			let shown = performance.now();
			busy = true;
			const chunk = () => {
				if (cancelled) return;
				const t0 = performance.now();
				while (row < FH && performance.now() - t0 < 10) {
					paint(job.px32, FW, FH, v, max, p, row, row + 1);
					row++;
				}
				const done = row >= FH;
				if (done || performance.now() - shown > 250) {
					job.ctx.putImageData(job.data, 0, 0);
					fullUrl = job.cv.toDataURL();
					fullKey = key;
					shown = performance.now();
				}
				if (done) busy = false;
				else timer = setTimeout(chunk, 0);
			};
			chunk();
		};
		timer = setTimeout(start, 90);
		return () => {
			cancelled = true;
			clearTimeout(timer);
			busy = false;
		};
	});

	// The mini-map: the whole set, drawn once per theme.
	$effect(() => {
		const p = palette;
		if (!p) return;
		const mm = canvas(MM.w, MM.h);
		paint(mm.px32, MM.w, MM.h, WHOLE, 160, p);
		mm.ctx.putImageData(mm.data, 0, 0);
		minimapUrl = mm.cv.toDataURL();
	});

	// The magnifier on the near-whole view: the tiny copy of the set on the
	// antenna, drawn once per theme (small, so it costs a few milliseconds).
	const COPY = TOUR.find((q) => q.id === 'minibrot') ?? WHOLE;
	const INSET = { x: 40, y: 64, w: 176, h: Math.round((176 * IMG.h) / IMG.w) };
	$effect(() => {
		const p = palette;
		if (!p) return;
		const c = canvas(INSET.w, INSET.h);
		paint(c.px32, INSET.w, INSET.h, COPY, iterationsFor(COPY.width), p);
		c.ctx.putImageData(c.data, 0, 0);
		copyUrl = c.cv.toDataURL();
	});
	const insetOn = $derived(show(wZoom.current) * smoothstep(1.6, 2.6, view.width));

	// ---- the orbit (set phase) -------------------------------------------------------------
	interface Orbit {
		c: { x: number; y: number };
		pts: { x: number; y: number }[];
		/** Steps until |z| > 2, or Infinity if it stays bounded (1000 steps). */
		steps: number;
	}
	function orbitOf(cx: number, cy: number): Orbit {
		const pts = [{ x: 0, y: 0 }];
		let x = 0;
		let y = 0;
		let steps = Infinity;
		for (let i = 1; i <= 1000; i++) {
			const nx = x * x - y * y + cx;
			y = 2 * x * y + cy;
			x = nx;
			if (i <= 20) pts.push({ x, y });
			if (x * x + y * y > 4) {
				steps = i;
				// One more point, to show it flying off.
				if (i < 20) pts.push({ x: x * x - y * y + cx, y: 2 * x * y + cy });
				break;
			}
		}
		return { c: { x: cx, y: cy }, pts, steps };
	}

	// The tour of c: rest at each stop, glide between them.
	const STOPS_C = [
		{ x: -0.12, y: 0.62 }, // inside the main cardioid: spirals in to one value
		{ x: -0.75, y: 0.15 }, // seahorse valley, just outside: escapes after 22 steps
		{ x: -1.02, y: 0.08 }, // inside the period-2 bulb: settles into 2 values
		{ x: -0.9, y: 0.55 } // far outside: escapes after 5 steps
	];
	const DWELL = 3;
	const TRAVEL = 2.5;
	const LOOP = STOPS_C.length * (DWELL + TRAVEL);
	function tourAt(time: number) {
		const s = ((time % LOOP) + LOOP) % LOOP;
		const k = Math.floor(s / (DWELL + TRAVEL));
		const f = clamp((s - k * (DWELL + TRAVEL) - DWELL) / TRAVEL);
		const a = STOPS_C[k];
		const b = STOPS_C[(k + 1) % STOPS_C.length];
		const e = easeInOut(f);
		return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) };
	}

	const orbits = $derived.by((): Orbit[] => {
		if (wSet.current < 0.01) return [];
		if (reduced) return [orbitOf(STOPS_C[0].x, STOPS_C[0].y), orbitOf(STOPS_C[3].x, STOPS_C[3].y)];
		const c = tourAt(t);
		return [orbitOf(c.x, c.y)];
	});
	// Stage coordinates for an orbit, cut short where it leaves the picture.
	function orbitPath(o: Orbit, v: View) {
		const out: { x: number; y: number }[] = [];
		for (const p of o.pts) {
			const q = { x: sx(p.x, v), y: sy(p.y, v) };
			const off = q.x < IMG.x || q.x > IMG.x + IMG.w || q.y < IMG.y || q.y > IMG.y + IMG.h;
			out.push({ x: clamp(q.x, -2000, 3000), y: clamp(q.y, -2000, 3000) });
			if (off) break;
		}
		return out;
	}
	const legendY = $derived(reduced ? 290 : 222);

	// ---- text helpers -----------------------------------------------------------------------
	const minus = (s: string) => s.replace(/^-/, '−');
	const complex = (x: number, y: number, digits = 2) =>
		`${minus(x.toFixed(digits))} ${y < 0 ? '−' : '+'} ${Math.abs(y).toFixed(digits)}i`;
	const cName = (k: number) => (reduced ? `c${k ? '₂' : '₁'}` : 'c');
	function magnification(width: number) {
		const m = WHOLE.width / width;
		const two = (v: number) => Number(v.toPrecision(2));
		if (m < 1e6) return `× ${two(m).toLocaleString('en-US')}`;
		if (m < 1e9) return `× ${two(m / 1e6)} million`;
		if (m < 1e12) return `× ${two(m / 1e9)} billion`;
		return `× ${two(m / 1e12)} trillion`;
	}
	// Readouts show where the view is going, not every frame of the flight.
	const target = $derived(zoomOn ? to : view);
	const centreDigits = $derived(clamp(Math.ceil(-Math.log10(target.width)) + 2, 3, 15));

	// ---- interaction (zoom phase) -------------------------------------------------------
	function zoomBy(f: number, ms: number) {
		moved();
		setView({ ...to, width: to.width * f }, ms);
	}
	function panBy(dx: number, dy: number) {
		moved();
		setView({ x: to.x + dx * to.width, y: to.y + dy * to.width, width: to.width });
	}
	const zoomIn = () => {
		if (!atLimit(to)) zoomBy(0.5, 350);
	};
	const zoomOut = () => {
		if (to.width < MAX_W) zoomBy(2, 350);
	};
	function onkeydown(e: KeyboardEvent) {
		if (!zoomOn || e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key;
		const d = e.shiftKey ? 0.3 : 0.1;
		if (k === 'ArrowLeft') panBy(-d, 0);
		else if (k === 'ArrowRight') panBy(d, 0);
		else if (k === 'ArrowUp') panBy(0, d);
		else if (k === 'ArrowDown') panBy(0, -d);
		else if (k === '+' || k === '=') zoomIn();
		else if (k === '-' || k === '_' || k === '−') zoomOut();
		else return;
		e.preventDefault();
	}
	let dragging = $state(false);
	function onpointerdown(e: PointerEvent) {
		if (!zoomOn) return;
		let start: { x: number; y: number } | null = null;
		go(to, 0); // stop any running zoom animation
		const v0 = to;
		dragging = true;
		startDrag(
			e,
			(p) => {
				if (!start) {
					start = p;
					return;
				}
				if (Math.hypot(p.x - start.x, p.y - start.y) < 2) return;
				moved();
				setView({
					x: v0.x - ((p.x - start.x) / IMG.w) * v0.width,
					y: v0.y + ((p.y - start.y) / IMG.w) * v0.width,
					width: v0.width
				});
			},
			() => (dragging = false)
		);
	}
	// Wheel: zoom about the point under the pointer. A non-passive listener, so
	// the page does not scroll while the pointer is over the picture.
	function wheel(node: SVGGElement) {
		const onwheel = (e: WheelEvent) => {
			if (!zoomOn) return;
			e.preventDefault();
			const p = toSvg(e, node);
			const v = to;
			const f = clamp(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), 0.25, 4);
			const w = clamp(v.width * f, MIN_W, MAX_W);
			const g = w / v.width;
			const cx = re(p.x, v);
			const cy = im(p.y, v);
			moved();
			setView({ x: cx + (v.x - cx) * g, y: cy + (v.y - cy) * g, width: w });
		};
		node.addEventListener('wheel', onwheel, { passive: false });
		return () => node.removeEventListener('wheel', onwheel);
	}
	function buttonKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}

	// ---- mini-map -----------------------------------------------------------------------
	const mini = $derived.by(() => {
		const v = view;
		const s = MM.w / WHOLE.width;
		const w = v.width * s;
		return {
			x: MM.x + MM.w / 2 + (v.x - WHOLE.x) * s,
			y: MM.y + MM.h / 2 - (v.y - WHOLE.y) * s,
			w,
			h: (w * IMG.h) / IMG.w
		};
	});

	// Axis ticks for the set phase.
	const REAL_TICKS = [-2, -1, 0, 1];
	const IM_TICKS = [
		{ v: 1, label: 'i' },
		{ v: -1, label: '−i' }
	];
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
		tabular?: boolean;
		italic?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-style={opts.italic ? 'italic' : undefined}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet zbutton(x: number, label: string, glyph: string, act: () => void, disabled: boolean)}
	<g
		class="zbtn"
		role="button"
		tabindex={zoomOn ? 0 : -1}
		aria-label={label}
		aria-disabled={disabled}
		opacity={disabled ? 0.4 : 1}
		onclick={act}
		onkeydown={(e) => buttonKey(e, act)}
	>
		<rect class="ring" x={x - 3} y="223" width="62" height="42" rx="11" />
		<rect
			{x}
			y="226"
			width="56"
			height="36"
			rx="8"
			fill="var(--surface)"
			stroke="var(--stage-line)"
		/>
		{@render txt(x + 28, 252, glyph, 24, { anchor: 'middle', weight: 600 })}
	</g>
{/snippet}

<g>
	<defs>
		<clipPath id="mandelbrot-clip">
			<rect x={IMG.x} y={IMG.y} width={IMG.w} height={IMG.h} rx="10" />
		</clipPath>
		<clipPath id="mandelbrot-inset-clip">
			<rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="6" />
		</clipPath>
		<clipPath id="mandelbrot-mini-clip">
			<rect x={MM.x} y={MM.y} width={MM.w} height={MM.h} rx="6" />
		</clipPath>
		<linearGradient id="mandelbrot-key" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="var(--stage-bg)" />
			{#each STOPS as [u, c] (u)}
				<stop offset={0.15 + 0.85 * u} stop-color={c} />
			{/each}
		</linearGradient>
	</defs>

	<!-- the picture: an interactive 'application' (focusable) on the zoom step, an image before -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<g
		class="picture"
		class:zoomable={zoomOn}
		class:dragging
		role={zoomOn ? 'application' : 'img'}
		tabindex={zoomOn ? 0 : -1}
		aria-label={zoomOn
			? `The Mandelbrot set, magnified ${magnification(target.width).slice(2)} times. Drag or use the arrow keys to move; + and − to zoom.`
			: 'The Mandelbrot set in the complex plane'}
		{onkeydown}
		{onpointerdown}
		{@attach wheel}
	>
		<rect x={IMG.x} y={IMG.y} width={IMG.w} height={IMG.h} rx="10" fill="var(--stage-bg)" />
		<g clip-path="url(#mandelbrot-clip)">
			{#if previewUrl}
				<image
					href={previewUrl}
					x={IMG.x}
					y={IMG.y}
					width={IMG.w}
					height={IMG.h}
					preserveAspectRatio="none"
				/>
			{/if}
			{#if fullUrl && fullKey === keyOf(view)}
				<image
					href={fullUrl}
					x={IMG.x}
					y={IMG.y}
					width={IMG.w}
					height={IMG.h}
					preserveAspectRatio="none"
				/>
			{/if}

			<!-- zoom phase, near-whole view: magnify the tiny copy on the antenna -->
			{#if insetOn > 0.01 && copyUrl}
				{@const px = sx(COPY.x, view)}
				{@const py = sy(COPY.y, view)}
				<g opacity={insetOn} style:pointer-events="none">
					<path
						d="M{INSET.x + INSET.w / 2} {INSET.y + INSET.h} L{px} {py - 7}"
						stroke="var(--stage-bg)"
						stroke-width="4"
						opacity="0.7"
					/>
					<path
						d="M{INSET.x + INSET.w / 2} {INSET.y + INSET.h} L{px} {py - 7}"
						stroke="var(--stage-ink)"
						stroke-width="1.25"
					/>
					<circle cx={px} cy={py} r="7" fill="none" stroke="var(--stage-bg)" stroke-width="4" />
					<circle cx={px} cy={py} r="7" fill="none" stroke="var(--stage-ink)" stroke-width="1.75" />
					<rect
						x={INSET.x - 2}
						y={INSET.y - 2}
						width={INSET.w + 4}
						height={INSET.h + 4}
						rx="7"
						fill="var(--stage-bg)"
					/>
					<image
						href={copyUrl}
						x={INSET.x}
						y={INSET.y}
						width={INSET.w}
						height={INSET.h}
						preserveAspectRatio="none"
						clip-path="url(#mandelbrot-inset-clip)"
					/>
					<rect
						x={INSET.x}
						y={INSET.y}
						width={INSET.w}
						height={INSET.h}
						rx="6"
						fill="none"
						stroke="var(--stage-ink)"
						stroke-width="1.25"
					/>
					{@render txt(INSET.x, INSET.y - 10, 'A tiny copy of the whole set', 13, { weight: 600 })}
				</g>
			{/if}

			<!-- axes (set phase) -->
			{#if wSet.current > 0.01}
				{@const ax = sx(0, view)}
				{@const ay = sy(0, view)}
				<g opacity={wSet.current} style:pointer-events="none">
					<g stroke="var(--stage-bg)" stroke-width="3" opacity="0.6">
						<line x1={IMG.x} x2={IMG.x + IMG.w} y1={ay} y2={ay} />
						<line x1={ax} x2={ax} y1={IMG.y} y2={IMG.y + IMG.h} />
					</g>
					<g stroke="var(--stage-ink-muted)" stroke-width="1">
						<line x1={IMG.x} x2={IMG.x + IMG.w} y1={ay} y2={ay} />
						<line x1={ax} x2={ax} y1={IMG.y} y2={IMG.y + IMG.h} />
						{#each REAL_TICKS as v (v)}
							<line x1={sx(v, view)} x2={sx(v, view)} y1={ay - 5} y2={ay + 5} />
						{/each}
						{#each IM_TICKS as tk (tk.v)}
							<line x1={ax - 5} x2={ax + 5} y1={sy(tk.v, view)} y2={sy(tk.v, view)} />
						{/each}
					</g>
					{#each REAL_TICKS as v (v)}
						{@render txt(sx(v, view) + (v === 0 ? -6 : 0), ay + 20, minus(String(v)), 12, {
							anchor: v === 0 ? 'end' : 'middle',
							muted: true
						})}
					{/each}
					{#each IM_TICKS as tk (tk.v)}
						{@render txt(ax - 9, sy(tk.v, view) + 4, tk.label, 12, {
							anchor: 'end',
							muted: true,
							italic: true
						})}
					{/each}
					{@render txt(IMG.x + IMG.w - 10, ay - 10, 'real', 12, { anchor: 'end', muted: true })}
					{@render txt(ax + 9, IMG.y + 20, 'imaginary', 12, { muted: true })}
				</g>
			{/if}

			<!-- the orbit of c (set phase) -->
			{#if wSet.current > 0.01}
				<g opacity={wSet.current} style:pointer-events="none">
					{#each orbits as o, k (k)}
						{@const pts = orbitPath(o, view)}
						{@const d = pts
							.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
							.join(' ')}
						{@const col = o.steps === Infinity ? 'var(--chaos-a)' : 'var(--chaos-b)'}
						{@const cx = sx(o.c.x, view)}
						{@const cy = sy(o.c.y, view)}
						<path {d} fill="none" stroke="var(--stage-bg)" stroke-width="4" opacity="0.7" />
						<path {d} fill="none" stroke={col} stroke-width="1.5" stroke-linejoin="round" />
						{#each pts as p, i (i)}
							<circle
								cx={p.x}
								cy={p.y}
								r={i === 0 ? 4 : 3}
								fill={i === 0 ? 'var(--stage-ink)' : col}
								stroke="var(--stage-bg)"
								stroke-width="1.25"
								opacity={1 - (0.5 * i) / 21}
							/>
						{/each}
						<circle {cx} {cy} r="7.5" fill="none" stroke="var(--stage-bg)" stroke-width="4" />
						<circle {cx} {cy} r="7.5" fill="none" stroke="var(--stage-ink)" stroke-width="2" />
						<circle {cx} {cy} r="2.5" fill="var(--stage-ink)" />
						{@render txt(cx + 12, cy - 9, cName(k), 14, { weight: 700, italic: true })}
					{/each}
					{@render txt(sx(0, view) + 7, sy(0, view) - 8, 'z₀ = 0', 11, { muted: true })}
				</g>
			{/if}
		</g>
		<rect
			x={IMG.x}
			y={IMG.y}
			width={IMG.w}
			height={IMG.h}
			rx="10"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		<rect class="ring" x={IMG.x - 3} y={IMG.y - 3} width={IMG.w + 6} height={IMG.h + 6} rx="13" />
	</g>

	<!-- ---------------------------------------------------------------- panel -->
	{#if show(wSet.current) > 0.01}
		<g opacity={show(wSet.current)} style:pointer-events="none">
			{@render txt(PL, 46, 'z → z² + c', 20, { weight: 600 })}
			{@render txt(PL, 68, 'start at z₀ = 0, repeat', 12, { muted: true })}
			{#each orbits as o, k (k)}
				{@const y0 = 112 + k * 78}
				{@render txt(PL, y0, `${cName(k)} = ${complex(o.c.x, o.c.y)}`, 16, {
					weight: 600,
					tabular: true
				})}
				{@render txt(
					PL,
					y0 + 22,
					o.steps === Infinity
						? 'stays bounded'
						: `escapes after ${o.steps} step${o.steps === 1 ? '' : 's'}`,
					13,
					{ weight: 600, color: o.steps === Infinity ? 'var(--chaos-a)' : 'var(--chaos-b)' }
				)}
				{@render txt(
					PL,
					y0 + 40,
					o.steps === Infinity ? 'in the set' : '|z| passes 2: off to infinity',
					11,
					{ muted: true }
				)}
			{/each}

			<!-- legend -->
			<circle
				cx={PL + 8}
				cy={legendY - 4}
				r="7"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<circle cx={PL + 8} cy={legendY - 4} r="2.5" fill="var(--stage-ink)" />
			{@render txt(PL + 24, legendY, 'the point c', 12, { muted: true })}
			<circle cx={PL + 4} cy={legendY + 20} r="3" fill="var(--chaos-a)" />
			<circle cx={PL + 13} cy={legendY + 20} r="3" fill="var(--chaos-b)" />
			{@render txt(PL + 24, legendY + 24, 'z₁, z₂, … (first 20)', 12, { muted: true })}

			<rect x={PL} y={legendY + 52} width="18" height="14" rx="3" fill="var(--chaos-set)" />
			{@render txt(PL + 24, legendY + 63, 'in the set', 12, { muted: true })}
			<rect
				x={PL}
				y={legendY + 78}
				width={PR - PL}
				height="12"
				rx="3"
				fill="url(#mandelbrot-key)"
				stroke="var(--stage-line)"
				stroke-width="0.5"
			/>
			{@render txt(PL, legendY + 104, 'at once', 11, { muted: true })}
			{@render txt(PR, legendY + 104, 'more slowly →', 11, { anchor: 'end', muted: true })}
			{@render txt(PL, legendY + 126, 'outside: the colour shows', 12, { muted: true })}
			{@render txt(PL, legendY + 142, 'how quickly z escapes', 12, { muted: true })}
		</g>
	{/if}

	{#if show(wZoom.current) > 0.01}
		<g opacity={show(wZoom.current)}>
			<g style:pointer-events="none">
				{@render txt(PL, 40, 'magnification', 12, { muted: true })}
				{@render txt(PL, 70, magnification(target.width), 24, { weight: 600, tabular: true })}
				{@render txt(PL, 100, 'repetitions per point', 12, { muted: true })}
				{@render txt(PL, 122, String(iterationsFor(target.width)), 16, {
					weight: 600,
					tabular: true
				})}
				{@render txt(PL, 152, 'centre', 12, { muted: true })}
				{@render txt(PL, 172, minus(target.x.toFixed(centreDigits)), 12, { tabular: true })}
				{@render txt(
					PL,
					190,
					`${target.y < 0 ? '−' : '+'} ${Math.abs(target.y).toFixed(centreDigits)}i`,
					12,
					{ tabular: true }
				)}
			</g>
			{@render zbutton(PL, 'Zoom in', '+', zoomIn, atLimit(to))}
			{@render zbutton(PL + 66, 'Zoom out', '−', zoomOut, to.width >= MAX_W)}
			<g style:pointer-events="none">
				{#if atLimit(to)}
					{@render txt(PL, 292, 'The limit of ordinary', 12, {
						color: 'var(--chaos-b)',
						weight: 600
					})}
					{@render txt(PL, 308, 'computer numbers (about', 12, {
						color: 'var(--chaos-b)',
						weight: 600
					})}
					{@render txt(PL, 324, '16 digits): no deeper here.', 12, {
						color: 'var(--chaos-b)',
						weight: 600
					})}
				{:else if allInside}
					{@render txt(PL, 292, 'All black: you are inside', 12, { weight: 600 })}
					{@render txt(PL, 308, 'the set. Zoom out (−) or', 12, { muted: true })}
					{@render txt(PL, 324, 'drag towards an edge.', 12, { muted: true })}
				{:else}
					{@render txt(PL, 292, 'Drag the picture to move;', 12, { muted: true })}
					{@render txt(PL, 308, 'scroll, or press + and −,', 12, { muted: true })}
					{@render txt(PL, 324, 'to zoom.', 12, { muted: true })}
				{/if}

				<!-- mini-map -->
				{@render txt(PL, MM.y - 10, 'where you are', 12, { muted: true })}
				<rect x={MM.x} y={MM.y} width={MM.w} height={MM.h} rx="6" fill="var(--stage-bg)" />
				{#if minimapUrl}
					<image
						href={minimapUrl}
						x={MM.x}
						y={MM.y}
						width={MM.w}
						height={MM.h}
						preserveAspectRatio="none"
						clip-path="url(#mandelbrot-mini-clip)"
					/>
				{/if}
				<rect
					x={MM.x}
					y={MM.y}
					width={MM.w}
					height={MM.h}
					rx="6"
					fill="none"
					stroke="var(--stage-line)"
				/>
				<g clip-path="url(#mandelbrot-mini-clip)">
					{#if mini.w >= 8}
						<rect
							x={mini.x - mini.w / 2}
							y={mini.y - mini.h / 2}
							width={mini.w}
							height={mini.h}
							fill="none"
							stroke="var(--stage-bg)"
							stroke-width="3.5"
						/>
						<rect
							x={mini.x - mini.w / 2}
							y={mini.y - mini.h / 2}
							width={mini.w}
							height={mini.h}
							fill="none"
							stroke="var(--chaos-b)"
							stroke-width="1.75"
						/>
					{:else}
						<circle
							cx={mini.x}
							cy={mini.y}
							r="7"
							fill="none"
							stroke="var(--stage-bg)"
							stroke-width="3.5"
						/>
						<circle
							cx={mini.x}
							cy={mini.y}
							r="7"
							fill="none"
							stroke="var(--chaos-b)"
							stroke-width="1.75"
						/>
						<circle cx={mini.x} cy={mini.y} r="1.75" fill="var(--chaos-b)" />
					{/if}
				</g>
				{#if busy}
					{@render txt(PL, MM.y + MM.h + 22, 'drawing finer detail…', 11, { muted: true })}
				{/if}
			</g>
		</g>
	{/if}
</g>

<style>
	.picture {
		outline: none;
	}
	.picture.zoomable {
		cursor: grab;
		touch-action: none;
	}
	.picture.zoomable.dragging {
		cursor: grabbing;
	}
	.zbtn {
		cursor: pointer;
		outline: none;
	}
	.zbtn[aria-disabled='true'] {
		cursor: default;
	}
	.ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 2;
		opacity: 0;
	}
	.picture:focus-visible > .ring,
	.zbtn:focus-visible > .ring {
		opacity: 1;
	}
</style>
