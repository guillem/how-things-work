<script lang="ts">
	/**
	 * The logistic map x → r·x·(1 − x).
	 *
	 * Phases (`step.hints.phase`), cross-faded with a tween:
	 *   cobweb      — left, next year's x against this year's x: the parabola, the
	 *                 diagonal and the cobweb from x0 = 0.2 drawn two steps a second
	 *                 (a pure function of t; 40 steps, a hold, then it loops). Right,
	 *                 the same orbit year by year, with the full 40 years drawn faint
	 *                 so that dragging the slider gives instant feedback. Control
	 *                 `params.rate`; a change restarts the cobweb (TrackScene's memo).
	 *   bifurcation — the bifurcation diagram (r 2.5–4), rendered once into a canvas
	 *                 and used as an SVG luminance mask over a rect filled with
	 *                 `--chaos-curve`, so it follows the theme with no recompute. A
	 *                 marker at `params.rateCascade` (draggable, or click the diagram)
	 *                 highlights that r's attractor; a zoom of the period-3 window
	 *                 shows a small copy of the cascade; a mini time series runs
	 *                 through the attractor year by year.
	 *
	 * The behaviour readout does not trust `period(r)` near the splits (it converges
	 * very slowly there): below the onset of chaos the period is 2^(number of
	 * `DOUBLINGS` passed); above it, a positive Lyapunov exponent is chaos, otherwise
	 * `period(r)` ("many values" for a long cycle still being approached).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, smoothstep, startDrag } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { CHAOS_ONSET, DOUBLINGS, attractor, logistic, lyapunov, orbit, period } from '../chaos';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const R_MIN = 2.5;
	const R_MAX = 4;
	const X0 = 0.2; // the starting population
	const minus = (s: string) => s.replace('-', '−');
	const r3 = (v: number) => Math.round(v * 1000) / 1000;
	/**
	 * The r used for iterating: at exactly r = 4 rounding can land an orbit on x = 0.5,
	 * then 1, then 0 for ever (a floating-point artefact, not the map's behaviour).
	 */
	const rIter = (r: number) => Math.min(r, 3.9999);

	// ---- phase cross-fade --------------------------------------------------------------
	const phase = $derived(step.hints?.phase === 'bifurcation' ? 1 : 0);
	const mix = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		untrack(() => mix.set(p, { duration: reduced ? 0 : 700 }));
	});
	const showCobweb = $derived(mix.current < 0.99);
	const showCascade = $derived(mix.current > 0.01);

	// ---- behaviour of the map at r -------------------------------------------------------
	interface Behaviour {
		n: number; // number of values visited for ever; Infinity = chaos
		lyap: number;
		text: string;
	}
	function behaviour(r: number): Behaviour {
		const lyap = lyapunov(r);
		let n: number;
		if (r < CHAOS_ONSET) n = 2 ** DOUBLINGS.filter((d) => r > d).length;
		else {
			const p = period(r);
			// A long cycle still being approached counts as many values, not chaos.
			n = lyap > 0.005 ? Infinity : Number.isFinite(p) ? p : 65;
		}
		const text =
			n === 1
				? `settles at ${(1 - 1 / r).toFixed(3)}`
				: n === 2
					? 'alternates between 2 values'
					: n > 64 && Number.isFinite(n)
						? 'cycles through many values'
						: Number.isFinite(n)
							? `cycles through ${n} values`
							: 'never settles: chaos';
		return { n, lyap, text };
	}

	// =============================================================== cobweb
	const rate = $derived(r3(clamp(Number(params.rate ?? 2.8), R_MIN, R_MAX)));
	const STEPS = 40;
	const SPEED = 2; // cobweb steps per second
	const LEAD = 0.6;
	const HOLD = 4;
	const FADE = 0.8;
	const LOOP = LEAD + STEPS / SPEED + HOLD + FADE;

	const xs = $derived(orbit(rIter(rate), X0, STEPS + 1));
	const info = $derived(behaviour(rate));

	// Time since the rate last changed: the cobweb restarts then (a frame-to-frame
	// memo inside a $derived, as in TrackScene).
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${rate}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const tau = $derived(reduced ? LEAD + STEPS / SPEED : since % LOOP);
	const s = $derived(clamp((tau - LEAD) * SPEED, 0, STEPS)); // steps drawn (fractional)
	const webFade = $derived(reduced ? 1 : 1 - smoothstep(LOOP - FADE, LOOP, tau));

	// Left plot
	const S = 380;
	const CL = 78;
	const CT = 74;
	const cx = (v: number) => CL + v * S;
	const cy = (v: number) => CT + (1 - v) * S;

	const parabola = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 80; i++) {
			const v = i / 80;
			d += `${i ? 'L' : 'M'}${cx(v).toFixed(1)} ${cy(logistic(rate, v)).toFixed(1)}`;
		}
		return d;
	});

	/** Cobweb vertices: (x0, 0), then for each step k: up to the curve, across to the diagonal. */
	const web = $derived.by(() => {
		const pts: [number, number][] = [[xs[0], 0]];
		for (let k = 0; k < STEPS; k++) {
			pts.push([xs[k], xs[k + 1]]);
			pts.push([xs[k + 1], xs[k + 1]]);
		}
		return pts;
	});
	/** The cobweb from segment `from` up to `u` segments (two per step, fractional). */
	function webPath(u: number, from = 0) {
		const pts = web;
		const whole = Math.floor(u);
		const f = u - whole;
		const start = Math.max(0, Math.floor(from));
		let d = `M${cx(pts[start][0]).toFixed(1)} ${cy(pts[start][1]).toFixed(1)}`;
		for (let i = start + 1; i <= whole && i < pts.length; i++)
			d += `L${cx(pts[i][0]).toFixed(1)} ${cy(pts[i][1]).toFixed(1)}`;
		if (f > 0 && whole + 1 < pts.length) {
			const a = pts[whole];
			const b = pts[whole + 1];
			d += `L${cx(a[0] + (b[0] - a[0]) * f).toFixed(1)} ${cy(a[1] + (b[1] - a[1]) * f).toFixed(1)}`;
		}
		return d;
	}
	const segs = $derived(s * 2);
	const webAll = $derived(webPath(segs));
	const webTail = $derived(webPath(segs, Math.max(0, segs - 2)));
	const head = $derived.by(() => {
		const whole = Math.floor(segs);
		const f = segs - whole;
		const a = web[Math.min(whole, web.length - 1)];
		const b = web[Math.min(whole + 1, web.length - 1)];
		return { x: cx(a[0] + (b[0] - a[0]) * f), y: cy(a[1] + (b[1] - a[1]) * f) };
	});

	// Right: the same orbit, year by year
	const SL = 590;
	const SR = 928;
	const ST = 236;
	const SB = CT + S;
	const sx = (j: number) => SL + (j / STEPS) * (SR - SL);
	const sy = (v: number) => SB - v * (SB - ST);
	const ghost = $derived(xs.map((v, j) => `${j ? 'L' : 'M'}${sx(j)} ${sy(v).toFixed(1)}`).join(''));
	/** Year j appears when the cobweb reaches the curve with it (year 0 at the start). */
	const yearAlpha = (j: number) => (j === 0 ? 1 : clamp((s - (j - 0.5)) * 4));
	const shown = $derived(Math.min(STEPS, Math.floor(s + 0.5)));
	const seriesPath = $derived.by(() => {
		let d = '';
		for (let j = 0; j <= shown; j++) d += `${j ? 'L' : 'M'}${sx(j)} ${sy(xs[j]).toFixed(1)}`;
		const next = shown + 1;
		const f = clamp((s - (next - 0.5)) * 4);
		if (next <= STEPS && f > 0) {
			const a = xs[shown];
			const b = xs[next];
			d += `L${(sx(shown) + (sx(next) - sx(shown)) * f).toFixed(1)} ${sy(a + (b - a) * f).toFixed(1)}`;
		}
		return d;
	});
	/** Levels the orbit keeps visiting (short cycles only), as dashed guides. */
	const levels = $derived(
		info.n === 1
			? [1 - 1 / rate]
			: Number.isFinite(info.n) && info.n <= 8
				? orbit(rate, orbit(rate, X0, 20000)[19999], info.n)
				: []
	);

	// =============================================================== bifurcation
	const rc = $derived(r3(clamp(Number(params.rateCascade ?? 3.5), R_MIN, R_MAX)));
	const infoC = $derived(behaviour(rc));

	const DL = 74;
	const DR = 654;
	const DT = 74;
	const DB = 464;
	const DW = DR - DL; // 580
	const DH = DB - DT; // 390
	const dx = (r: number) => DL + ((r - R_MIN) / (R_MAX - R_MIN)) * DW;
	const dy = (v: number) => DT + (1 - v) * DH;
	const rOf = (px: number) => R_MIN + ((px - DL) / DW) * (R_MAX - R_MIN);

	// Zoom of the period-3 window: the middle branch, which splits like the whole.
	const Z = { r0: 3.841, r1: 3.857, x0: 0.44, x1: 0.56 };
	const ZL = 708;
	const ZR = 936;
	const ZT = 90;
	const ZB = 230;

	/** Bifurcation picture as a white-on-transparent image (for a luminance mask). */
	function raster(
		W: number,
		H: number,
		r0: number,
		r1: number,
		v0: number,
		v1: number,
		transient: number,
		keep: number,
		full: number
	) {
		if (typeof document === 'undefined') return '';
		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = H;
		const ctx = canvas.getContext('2d');
		if (!ctx) return '';
		const counts = new Uint16Array(W * H);
		for (let i = 0; i < W; i++) {
			const r = r0 + ((i + 0.5) / W) * (r1 - r0);
			let x = X0;
			for (let k = 0; k < transient; k++) x = logistic(r, x);
			for (let k = 0; k < keep; k++) {
				x = logistic(r, x);
				if (x < v0 || x >= v1) continue;
				const row = Math.floor(((v1 - x) / (v1 - v0)) * H);
				if (row >= 0 && row < H && counts[row * W + i] < 65000) counts[row * W + i]++;
			}
		}
		const img = ctx.createImageData(W, H);
		for (let k = 0; k < counts.length; k++) {
			if (!counts[k]) continue;
			img.data[4 * k] = 255;
			img.data[4 * k + 1] = 255;
			img.data[4 * k + 2] = 255;
			img.data[4 * k + 3] = Math.round(255 * Math.min(1, 0.42 + counts[k] / full));
		}
		ctx.putImageData(img, 0, 0);
		return canvas.toDataURL();
	}
	// Computed once (no reactive inputs), and only in the browser.
	const mainURL = $derived(raster(DW, DH, R_MIN, R_MAX, 0, 1, 1000, 200, 6));
	const zoomURL = $derived(
		raster((ZR - ZL) * 2, (ZB - ZT) * 2, Z.r0, Z.r1, Z.x0, Z.x1, 3000, 3000, 12)
	);

	// Marker: this r's attractor, and a year-by-year run through it.
	const attr = $derived(attractor(rIter(rc), 2000, 256, X0));
	const attrPath = $derived(
		attr.map((v) => `M${dx(rc).toFixed(1)} ${dy(v).toFixed(1)}h0`).join('')
	);
	const MINI = 30;
	const mini = $derived.by(() => {
		let x = X0;
		for (let k = 0; k < 1000; k++) x = logistic(rIter(rc), x);
		return orbit(rIter(rc), x, MINI);
	});
	const ML = 708;
	const MR = 936;
	const MT = 312;
	const MB = 396;
	const mx = (j: number) => ML + (j / (MINI - 1)) * (MR - ML);
	const my = (v: number) => MB - v * (MB - MT);
	const miniPath = $derived(
		mini.map((v, j) => `${j ? 'L' : 'M'}${mx(j)} ${my(v).toFixed(1)}`).join('')
	);
	const year = $derived(reduced ? 3 : Math.floor(t * SPEED) % MINI);

	const doublingMarks = [
		{ r: DOUBLINGS[0], text: '2' },
		{ r: DOUBLINGS[1], text: '4' },
		{ r: DOUBLINGS[2], text: '8' }
	];

	function setRate(v: number) {
		setParam('rateCascade', r3(clamp(v, R_MIN, R_MAX)));
	}
	function onDiagramDown(event: PointerEvent) {
		startDrag(event, (p) => setRate(rOf(p.x)));
	}
</script>

<g>
	<defs>
		<mask id="logistic-bif-mask" maskUnits="userSpaceOnUse" x={DL} y={DT} width={DW} height={DH}>
			{#if mainURL}
				<image href={mainURL} x={DL} y={DT} width={DW} height={DH} preserveAspectRatio="none" />
			{/if}
		</mask>
		<mask
			id="logistic-zoom-mask"
			maskUnits="userSpaceOnUse"
			x={ZL}
			y={ZT}
			width={ZR - ZL}
			height={ZB - ZT}
		>
			{#if zoomURL}
				<image
					href={zoomURL}
					x={ZL}
					y={ZT}
					width={ZR - ZL}
					height={ZB - ZT}
					preserveAspectRatio="none"
				/>
			{/if}
		</mask>
	</defs>

	<!-- ============================================================ cobweb -->
	{#if showCobweb}
		<g opacity={1 - mix.current}>
			<!-- frame and grid -->
			<rect x={CL} y={CT} width={S} height={S} fill="var(--surface)" stroke="var(--border)" />
			{#each [0.25, 0.5, 0.75] as g (g)}
				<line x1={cx(g)} x2={cx(g)} y1={CT} y2={CT + S} stroke="var(--stage-grid)" />
				<line x1={CL} x2={CL + S} y1={cy(g)} y2={cy(g)} stroke="var(--stage-grid)" />
			{/each}
			{#each [0, 0.5, 1] as v (v)}
				{@render txt(cx(v), CT + S + 18, String(v), 11, { anchor: 'middle', muted: true })}
				{@render txt(CL - 8, cy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{/each}
			{@render txt(CL + S / 2, CT + S + 40, "this year's x", 13, { anchor: 'middle' })}
			{@render txt(CL - 34, CT + S / 2, "next year's x", 13, { anchor: 'middle', rotate: -90 })}

			<!-- the diagonal and the rule -->
			<line
				x1={cx(0)}
				y1={cy(0)}
				x2={cx(1)}
				y2={cy(1)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.25"
				stroke-dasharray="5 4"
			/>
			{@render txt(cx(0.86) - 6, cy(0.86) - 8, 'next = this', 11, {
				anchor: 'end',
				muted: true,
				rotate: -45
			})}
			<path d={parabola} fill="none" stroke="var(--chaos-curve)" stroke-width="2.75" />
			{@render txt(cx(0.5), cy(rate / 4) - 10, 'next = r · x · (1 − x)', 13, {
				anchor: 'middle',
				color: 'var(--chaos-curve)',
				weight: 600
			})}

			<!-- the cobweb -->
			<g opacity={webFade}>
				<path
					d={webAll}
					fill="none"
					stroke="var(--chaos-b)"
					stroke-width="1.25"
					stroke-opacity="0.6"
					stroke-linejoin="round"
				/>
				<path
					d={webTail}
					fill="none"
					stroke="var(--chaos-b)"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<circle cx={cx(X0)} cy={cy(0)} r="4" fill="var(--chaos-b)" />
				{@render txt(cx(X0), CT + S - 10, 'start 0.2', 11, { anchor: 'middle', muted: true })}
				<circle
					cx={head.x}
					cy={head.y}
					r="5.5"
					fill="var(--chaos-b)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			</g>

			<!-- readout -->
			{@render txt(SL, 92, `r = ${rate.toFixed(3)}`, 16, { weight: 700, tabular: true })}
			{@render txt(SL, 122, `The population ${info.text}`, 15, {
				weight: 600,
				color: 'var(--chaos-b)'
			})}
			{@render txt(
				SL,
				146,
				info.n === 1
					? rate > 2.95
						? 'right at the split: it settles, but very slowly'
						: 'the steady level is 1 − 1/r'
					: Number.isFinite(info.n)
						? 'boom and bust, repeating exactly'
						: 'no year ever repeats an earlier one',
				12,
				{ muted: true }
			)}

			<!-- the same orbit, year by year -->
			{@render txt(SL, ST - 20, 'Population x, year by year', 13, { weight: 600 })}
			<rect
				x={SL}
				y={ST}
				width={SR - SL}
				height={SB - ST}
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<line x1={SL} x2={SR} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--stage-grid)" />
			{#each [0, 0.5, 1] as v (v)}
				{@render txt(SL - 8, sy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{/each}
			{#each [0, 10, 20, 30, 40] as j (j)}
				{@render txt(sx(j), SB + 18, String(j), 11, { anchor: 'middle', muted: true })}
			{/each}
			{@render txt((SL + SR) / 2, SB + 40, 'year', 13, { anchor: 'middle' })}
			{#each levels as v, i (i)}
				<line
					x1={SL}
					x2={SR}
					y1={sy(v)}
					y2={sy(v)}
					stroke="var(--chaos-curve)"
					stroke-width="1"
					stroke-dasharray="4 4"
					opacity="0.7"
				/>
			{/each}
			<path
				d={ghost}
				fill="none"
				stroke="var(--chaos-b)"
				stroke-width="1"
				stroke-opacity="0.22"
				stroke-linejoin="round"
			/>
			<g opacity={webFade}>
				<path
					d={seriesPath}
					fill="none"
					stroke="var(--chaos-b)"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
				{#each xs as v, j (j)}
					{#if yearAlpha(j) > 0}
						<circle cx={sx(j)} cy={sy(v)} r="3.25" fill="var(--chaos-b)" opacity={yearAlpha(j)} />
					{/if}
				{/each}
			</g>
		</g>
	{/if}

	<!-- ============================================================ bifurcation -->
	{#if showCascade}
		<g opacity={mix.current}>
			<!-- the diagram -->
			<rect x={DL} y={DT} width={DW} height={DH} fill="var(--surface)" stroke="var(--border)" />
			<line x1={DL} x2={DR} y1={dy(0.5)} y2={dy(0.5)} stroke="var(--stage-grid)" />
			{#each [...DOUBLINGS.slice(0, 3), CHAOS_ONSET] as r (r)}
				<line
					x1={dx(r)}
					x2={dx(r)}
					y1={DT}
					y2={DB}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="3 4"
					opacity="0.45"
				/>
			{/each}
			<rect
				x={DL}
				y={DT}
				width={DW}
				height={DH}
				fill="var(--chaos-curve)"
				mask="url(#logistic-bif-mask)"
			/>
			<!-- click or drag anywhere on the diagram to move the marker -->
			<rect
				x={DL}
				y={DT}
				width={DW}
				height={DH}
				fill="transparent"
				style:cursor="ew-resize"
				style:touch-action="none"
				role="presentation"
				onpointerdown={onDiagramDown}
			/>

			<!-- axes -->
			{#each [2.5, 3, 3.5, 4] as r (r)}
				{@render txt(dx(r), DB + 18, String(r), 11, { anchor: 'middle', muted: true })}
			{/each}
			{@render txt((DL + DR) / 2, DB + 40, 'growth rate r', 13, { anchor: 'middle' })}
			{#each [0, 0.5, 1] as v (v)}
				{@render txt(DL - 8, dy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{/each}
			{@render txt(DL - 34, (DT + DB) / 2, 'where the population ends up', 13, {
				anchor: 'middle',
				rotate: -90
			})}

			<!-- the splits, the onset of chaos and the window of 3 -->
			{@render txt(dx(DOUBLINGS[0]) - 10, DT - 12, 'splits into', 12, {
				anchor: 'end',
				muted: true
			})}
			{#each doublingMarks as m (m.r)}
				<line x1={dx(m.r)} x2={dx(m.r)} y1={DT - 8} y2={DT} stroke="var(--stage-ink-muted)" />
				{@render txt(dx(m.r), DT - 12, m.text, 13, { weight: 700, anchor: 'middle' })}
			{/each}
			<line x1={dx(3.83)} x2={dx(3.83)} y1={DT - 8} y2={DT} stroke="var(--stage-ink-muted)" />
			{@render txt(dx(3.83), DT - 12, 'cycle of 3', 12, { anchor: 'middle', weight: 600 })}
			{@render txt(dx(CHAOS_ONSET) - 6, DB - 14, 'chaos from r ≈ 3.5699 →', 12, {
				anchor: 'end',
				weight: 600
			})}
			{@render txt(dx(2.75), dy(0.62) + 30, '1 steady value', 12, {
				anchor: 'middle',
				muted: true
			})}

			<!-- the zoomed piece, and where it comes from -->
			<rect
				x={dx(Z.r0) - 1}
				y={dy(Z.x1)}
				width={dx(Z.r1) - dx(Z.r0) + 2}
				height={dy(Z.x0) - dy(Z.x1)}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.25"
				style:pointer-events="none"
			/>
			<path
				d="M{dx(Z.r1) + 1} {dy(Z.x1)} L{ZL} {ZT} M{dx(Z.r1) + 1} {dy(Z.x0)} L{ZL} {ZB}"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
				fill="none"
				opacity="0.7"
				style:pointer-events="none"
			/>
			{@render txt(ZL, ZT - 26, 'Zoomed in on the window of 3', 13, { weight: 600 })}
			{@render txt(ZL, ZT - 9, `r ${Z.r0} – ${Z.r1}: a small copy of the whole`, 11, {
				muted: true
			})}
			<rect
				x={ZL}
				y={ZT}
				width={ZR - ZL}
				height={ZB - ZT}
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect
				x={ZL}
				y={ZT}
				width={ZR - ZL}
				height={ZB - ZT}
				fill="var(--chaos-curve)"
				mask="url(#logistic-zoom-mask)"
			/>
			{#if rc >= Z.r0 && rc <= Z.r1}
				{@const zx = ZL + ((rc - Z.r0) / (Z.r1 - Z.r0)) * (ZR - ZL)}
				<line x1={zx} x2={zx} y1={ZT} y2={ZB} stroke="var(--chaos-b)" stroke-width="1.5" />
			{/if}

			<!-- the marker at the chosen r -->
			<line
				x1={dx(rc)}
				x2={dx(rc)}
				y1={DT}
				y2={DB}
				stroke="var(--chaos-b)"
				stroke-width="1.5"
				opacity="0.8"
				style:pointer-events="none"
			/>
			<path
				d={attrPath}
				stroke="var(--chaos-b)"
				stroke-width={attr.length > 32 ? 3.5 : 7}
				stroke-linecap="round"
				style:pointer-events="none"
			/>
			<circle
				cx={dx(rc)}
				cy={dy(mini[year])}
				r="7"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				style:pointer-events="none"
			/>
			<Handle
				x={dx(rc)}
				y={DB}
				r={7}
				color="var(--chaos-b)"
				label="Growth rate r"
				value={rc}
				min={R_MIN}
				max={R_MAX}
				valuetext={`r = ${rc.toFixed(3)}`}
				onmove={(p) => setRate(rOf(p.x))}
				onkey={(k) => setRate(k === 'start' ? R_MIN : k === 'end' ? R_MAX : rc + k * 0.005)}
			/>

			<!-- year by year at this r -->
			{@render txt(ML, MT - 22, `Year by year at r = ${rc.toFixed(3)}`, 13, {
				weight: 600,
				tabular: true
			})}
			<rect
				x={ML}
				y={MT - 6}
				width={MR - ML}
				height={MB - MT + 12}
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<path
				d={miniPath}
				fill="none"
				stroke="var(--chaos-b)"
				stroke-width="1.25"
				stroke-linejoin="round"
				opacity="0.8"
			/>
			{#each mini as v, j (j)}
				<circle cx={mx(j)} cy={my(v)} r="2.5" fill="var(--chaos-b)" />
			{/each}
			<circle
				cx={mx(year)}
				cy={my(mini[year])}
				r="5.5"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			{@render txt(ML, MB + 24, 'after the first 1000 years', 11, { muted: true })}

			<!-- readout -->
			{@render txt(ML, 452, infoC.text, 15, { weight: 600, color: 'var(--chaos-b)' })}
			{@render txt(
				ML,
				474,
				`Lyapunov exponent ${minus(infoC.lyap.toFixed(2))} ${infoC.lyap > 0.005 ? '(> 0: chaos)' : infoC.lyap > -0.01 ? '(≈ 0: at a tipping point)' : '(< 0: order)'}`,
				11,
				{ muted: true, tabular: true }
			)}
		</g>
	{/if}
</g>

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
		rotate?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		transform={opts.rotate === undefined ? undefined : `rotate(${opts.rotate} ${x} ${y})`}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
