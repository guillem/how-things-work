<script lang="ts">
	/**
	 * The double slit: an electron source (left), a wall with two slits, the
	 * wave between the wall and the screen (a map of |ψ|², computed), the
	 * screen where each electron lands as one dot, a histogram of the landing
	 * places beside it with the predicted probability, and a panel (right).
	 *
	 * Lengths are in units of the slit separation d (slits at y = ±½, width ¼);
	 * the screen shows |y| ≤ 4.5. The model (`slits`) propagates each slit's
	 * wave to the screen; `pattern(a, b, γ)` gives the landing probability with
	 * a which-slit record of overlap γ (γ = 1: no record).
	 *
	 * Phases (`step.hints.phase`):
	 *   dots       — electrons one at a time; with ≤ 8 per second each one is
	 *                followed: a packet to the wall, then its wave spreading
	 *                to the screen, then one dot. Predicted curve after 60 dots.
	 *   amplitudes — a probe point on the screen (`params.probe`, draggable),
	 *                the two paths to it, and the two complex amplitudes added
	 *                head to tail in the panel
	 *   one-slit   — `params.slit` closes a slit; dashed: the two single-slit
	 *                patterns added
	 *   detector   — a light beam behind the slits records the slit (perfect
	 *                record: each electron goes through one slit, at random,
	 *                and lands by that slit's wave alone); `params.reading`
	 *                colours the dots by slit and lists the record, and
	 *                changes nothing else
	 *   partial    — `params.record` = distinguishability D, γ = √(1 − D²)
	 *
	 * The run: electron i lands at a place drawn from the pattern with a seeded
	 * generator, released (i − PRE)/rate seconds after the run started. The
	 * steps after the first start with PRE = 300 dots already on the screen,
	 * so the pattern shows at once. The run restarts when the pattern, the
	 * rate or the restart count change; its start time is the only remembered
	 * value (as in the Galton board of central-limit-theorem). Reduced motion:
	 * the whole run (5000 dots) has landed.
	 *
	 * The wave map and the dots are painted into canvases shown as `<image>`s
	 * (thousands of dots would be too many SVG nodes); colours are read from
	 * the theme when it changes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Handle, Label, type Point, smoothstep } from '#lib/draw/index.ts';
	import { rng } from '#lib/draw/math.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { pattern, sample, slits, visibility, type Wave } from '../quantum';
	import { cssColor, ramp, rgb, type RGB } from './paint';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	const COUNT = 5000;
	const W = 0.25; // slit width, in units of the separation

	const phase = $derived(String(step.hints?.phase ?? 'dots'));
	const isAmp = $derived(phase === 'amplitudes');
	const ampAmt = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = isAmp ? 1 : 0;
		untrack(() => ampAmt.set(v, { duration: reduced ? 0 : 700 }));
	});

	// ---- settings ----------------------------------------------------------------------
	const lambdaL = $derived(clamp(Number(params.wavelength ?? 1), 0.6, 1.5));
	const rate = $derived(clamp(Math.round(Number(params.rate ?? 4)), 1, 400));
	const restarts = $derived(Number(params.restart ?? 0));
	const open = $derived(phase === 'one-slit' ? String(params.slit ?? 'both') : 'both');
	const detectorOn = $derived(phase === 'detector' && Boolean(params.detector ?? false));
	const reading = $derived(detectorOn && Boolean(params.reading ?? false));
	/** Distinguishability of the record: 1 for the detector, the slider on the partial step. */
	const D = $derived(
		phase === 'partial' ? clamp(Number(params.record ?? 50) / 100) : detectorOn ? 1 : 0
	);
	const gamma = $derived(Math.sqrt(Math.max(0, 1 - D * D)));
	const showSum = $derived(phase === 'one-slit' || phase === 'detector' || phase === 'partial');

	// ---- the waves ---------------------------------------------------------------------
	const field = $derived(slits({ w: W, lambdaL, columns: 120, window: 6 }));
	const zero = (w: Wave): Wave => ({
		re: new Float64Array(w.re.length),
		im: new Float64Array(w.re.length)
	});
	const waveA = $derived(open === 'bottom' ? zero(field.a) : field.a);
	const waveB = $derived(open === 'top' ? zero(field.b) : field.b);
	/** Landing probability density on the model's cells. */
	const P = $derived(pattern(waveA, waveB, open === 'both' ? gamma : 0));
	const Psum = $derived(pattern(field.a, field.b, 0));
	const g = $derived(field.g);
	const c0 = $derived(g.n / 2);

	// ---- geometry ----------------------------------------------------------------------
	const Y0 = 300;
	const PX = 56; // px per d
	const YMAX = 4.5;
	const Y = (y: number) => Y0 - y * PX;
	const SRC_X = 46;
	const WALL_X = 178;
	const MAP_X = 184;
	const SCREEN_X = 528;
	const SCREEN_W = 64;
	const HIST_X = SCREEN_X + SCREEN_W + 10;
	const HIST_W = 96;
	const PL = 742;
	const slitTop = { y0: Y(0.5 + W / 2), y1: Y(0.5 - W / 2) };
	const slitBot = { y0: Y(-0.5 + W / 2), y1: Y(-0.5 - W / 2) };

	// ---- the run -----------------------------------------------------------------------
	const PRE = $derived(phase === 'dots' ? 0 : 300);
	const runKey = $derived(`${phase}|${lambdaL}|${open}|${D}|${rate}|${restarts}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e9;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0; // a new step started
		return Math.max(0, t - t0);
	});
	const follow = $derived(rate <= 8 && !reduced && (phase === 'dots' || phase === 'detector'));
	/** Seconds from leaving the source to landing: one electron in flight at a time. */
	const flight = $derived(follow ? Math.min(1, 0.95 / rate) : 0);
	const released = $derived(Math.min(COUNT, PRE + Math.floor(elapsed * rate) + 1));
	const landed = $derived(
		elapsed < flight ? PRE : Math.min(COUNT, PRE + Math.floor((elapsed - flight) * rate) + 1)
	);

	/** Where each electron lands (y, in d) and, with a record, its slit (1 top, 2 bottom). */
	const hits = $derived.by(() => {
		const seed = 11 + restarts;
		const ys = new Float32Array(COUNT);
		const slitOf = new Uint8Array(COUNT);
		const jitter = rng(seed + 1000);
		if (D === 1) {
			// A perfect record: each electron goes through one slit, at random, and lands by
			// that slit's wave alone.
			const pa = pattern(waveA, zero(waveB), 0);
			const pb = pattern(zero(waveA), waveB, 0);
			const ha = sample(pa, COUNT, seed);
			const hb = sample(pb, COUNT, seed + 500);
			const coin = rng(seed + 2000);
			for (let i = 0; i < COUNT; i++) {
				const top = coin() < 0.5;
				slitOf[i] = top ? 1 : 2;
				ys[i] = g.x[top ? ha[i] : hb[i]] + (jitter() - 0.5) * g.dx;
			}
		} else {
			const h = sample(P, COUNT, seed);
			for (let i = 0; i < COUNT; i++) ys[i] = g.x[h[i]] + (jitter() - 0.5) * g.dx;
		}
		const xs = new Float32Array(COUNT);
		const rx = rng(seed + 3000);
		for (let i = 0; i < COUNT; i++) xs[i] = 4 + rx() * (SCREEN_W - 8);
		return { ys, xs, slitOf };
	});

	// ---- histogram and predicted curves ---------------------------------------------------
	const NB = 60;
	const BIN = (2 * YMAX) / NB;
	const counts = $derived.by(() => {
		const c = new Array<number>(NB).fill(0);
		for (let i = 0; i < landed; i++) {
			const b = Math.floor((hits.ys[i] + YMAX) / BIN);
			if (b >= 0 && b < NB) c[b]++;
		}
		return c;
	});
	/** Probability per bin width, as a function of cell j. */
	const total = (p: Float64Array) => p.reduce((s, v) => s + v, 0);
	const peakMass = $derived.by(() => {
		const per = BIN / g.dx;
		let m = 0;
		const tp = total(P);
		const ts = total(Psum);
		for (let j = 0; j < g.n; j++) m = Math.max(m, (P[j] / tp) * per, (Psum[j] / ts) * per);
		return m;
	});
	/** Pixels per expected electron in a bin, so that the tallest expected bin is HIST_W long. */
	const scale = $derived((HIST_W - 4) / Math.max(6, landed * peakMass));
	const histPath = $derived(
		counts
			.map((c, b) => {
				const y0 = Y(-YMAX + b * BIN);
				const y1 = Y(-YMAX + (b + 1) * BIN);
				const x = HIST_X + Math.min(HIST_W + 8, c * scale);
				return `M${HIST_X} ${y1.toFixed(1)}H${x.toFixed(1)}V${y0.toFixed(1)}H${HIST_X}Z`;
			})
			.join('')
	);
	function curve(p: Float64Array) {
		const per = BIN / g.dx;
		const tp = total(p);
		const half = Math.round(YMAX / g.dx);
		let d = '';
		for (let j = c0 - half; j <= c0 + half; j += 2) {
			const x = HIST_X + (p[j] / tp) * per * landed * scale;
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${Y(g.x[j]).toFixed(1)}`;
		}
		return d;
	}
	const curveAmt = $derived(phase === 'dots' ? smoothstep(40, 80, landed) : 1);
	const curvePath = $derived(curve(P));
	const sumPath = $derived(showSum ? curve(Psum) : '');

	// ---- visibility of the fringes (centre ± half a fringe) ---------------------------------
	const vis = $derived.by(() => {
		const half = Math.round(lambdaL / 2 / g.dx);
		return visibility(P, c0 - half, c0 + half);
	});

	/** The residual below 0.05 with a perfect record is the single-slit envelope's own slope. */
	const visText = $derived(vis < 0.05 ? '≈ 0' : vis.toFixed(2));

	// ---- colours ---------------------------------------------------------------------------
	let colours = $state.raw<{ map: RGB[]; dot: RGB; top: RGB; bot: RGB } | null>(null);
	$effect(() => {
		void dark;
		colours = {
			map: ramp(cssColor('--qm-map-lo'), cssColor('--qm-map-hi')),
			dot: cssColor('--qm-dot'),
			top: cssColor('--qm-top'),
			bot: cssColor('--qm-bottom')
		};
	});

	// ---- the wave map -----------------------------------------------------------------------
	const MAP_ROWS = 288; // canvas rows over |y| ≤ 4.5 (2 model cells each)
	const mapImage = $derived.by(() => {
		if (typeof document === 'undefined' || !colours) return '';
		const cols = field.colsTop.length;
		const cv = document.createElement('canvas');
		cv.width = cols;
		cv.height = MAP_ROWS;
		const ctx = cv.getContext('2d');
		if (!ctx) return '';
		const img = ctx.createImageData(cols, MAP_ROWS);
		const off = Math.round((6 - YMAX) / g.dx); // window rows above |y| = 4.5
		const useA = open !== 'bottom';
		const useB = open !== 'top';
		const gm = open === 'both' ? gamma : 0;
		const col = new Float32Array(MAP_ROWS);
		for (let c = 0; c < cols; c++) {
			const A = field.colsTop[c];
			const B = field.colsBot[c];
			let mx = 1e-12;
			for (let r = 0; r < MAP_ROWS; r++) {
				let s = 0;
				for (const k of [0, 1]) {
					// window row: top of the canvas is +4.5, the window runs from −6 upwards
					const w = field.rows - off - (2 * r + k);
					const ar = useA ? A[2 * w] : 0;
					const ai = useA ? A[2 * w + 1] : 0;
					const br = useB ? B[2 * w] : 0;
					const bi = useB ? B[2 * w + 1] : 0;
					s += ar * ar + ai * ai + br * br + bi * bi + 2 * gm * (ar * br + ai * bi);
				}
				col[r] = s;
				mx = Math.max(mx, s);
			}
			for (let r = 0; r < MAP_ROWS; r++) {
				const v = Math.pow(col[r] / mx, 0.55);
				const k = colours.map[Math.min(255, Math.round(v * 255))];
				const p = 4 * (r * cols + c);
				img.data[p] = k[0];
				img.data[p + 1] = k[1];
				img.data[p + 2] = k[2];
				img.data[p + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		return cv.toDataURL();
	});

	// ---- the dots on the screen (painted incrementally) -------------------------------------
	const DOT_SCALE = 2;
	let dotCanvas: HTMLCanvasElement | null = null;
	let drawn = 0;
	let drawnFor: unknown = null;
	let drawnColour = '';
	const dotsImage = $derived.by(() => {
		if (typeof document === 'undefined' || !colours) return '';
		const colourKey = `${reading}|${colours.dot.join()}|${colours.top.join()}`;
		if (!dotCanvas) dotCanvas = document.createElement('canvas');
		const ctx = dotCanvas.getContext('2d');
		if (!ctx) return '';
		if (drawnFor !== hits || drawnColour !== colourKey || landed < drawn) {
			dotCanvas.width = SCREEN_W * DOT_SCALE;
			dotCanvas.height = 2 * YMAX * PX * DOT_SCALE;
			ctx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);
			drawn = 0;
			drawnFor = hits;
			drawnColour = colourKey;
		}
		const r = landed > 1500 ? 1.2 : 1.7;
		for (let i = drawn; i < landed; i++) {
			const s = hits.slitOf[i];
			ctx.fillStyle = rgb(reading && s ? (s === 1 ? colours.top : colours.bot) : colours.dot, 0.85);
			ctx.beginPath();
			ctx.arc(
				hits.xs[i] * DOT_SCALE,
				(YMAX - hits.ys[i]) * PX * DOT_SCALE,
				r * DOT_SCALE,
				0,
				2 * Math.PI
			);
			ctx.fill();
		}
		drawn = landed;
		return dotCanvas.toDataURL();
	});

	// ---- the electron in flight -------------------------------------------------------------
	const current = $derived.by(() => {
		if (!follow || released <= PRE) return null;
		const i = released - 1;
		const age = elapsed - (i - PRE) / rate;
		const u = age / flight;
		if (u >= 1) return null;
		return { i, u };
	});
	const blob = $derived(
		current && current.u < 0.3
			? {
					x: SRC_X + 14 + ((WALL_X - SRC_X - 14) * current.u) / 0.3,
					o: smoothstep(0, 0.06, current.u)
				}
			: null
	);
	const front = $derived(
		current && current.u >= 0.3 ? MAP_X + (SCREEN_X - MAP_X) * smoothstep(0.3, 1, current.u) : null
	);
	/** The last dot to land, ringed for 0.4 s. */
	const flash = $derived.by(() => {
		if (!follow || landed <= PRE) return null;
		const i = landed - 1;
		const age = elapsed - flight - (i - PRE) / rate;
		if (age > 0.45 || age < 0) return null;
		return {
			x: SCREEN_X + hits.xs[i],
			y: Y(hits.ys[i]),
			o: 1 - age / 0.45,
			r: 4 + age * 18
		};
	});
	/** The photon scattered at the slit (detector): flies off up or down to the left. */
	const photon = $derived.by(() => {
		if (!detectorOn || !current || current.u < 0.3) return null;
		const s = hits.slitOf[current.i];
		const u = smoothstep(0.3, 0.75, current.u);
		const y0 = s === 1 ? Y(0.5) : Y(-0.5);
		return {
			x: 191 - 70 * u,
			y: y0 + (s === 1 ? -1 : 1) * 150 * u,
			o: 1 - smoothstep(0.65, 0.8, current.u),
			slit: s
		};
	});

	// ---- amplitudes at the probe --------------------------------------------------------------
	const probeY = $derived(clamp(Number(params.probe ?? 0.5), -4, 4));
	const probeCell = $derived(c0 + Math.round(probeY / g.dx));
	const amax = $derived.by(() => {
		let m = 1e-12;
		for (let j = 0; j < g.n; j++) m = Math.max(m, Math.hypot(field.a.re[j], field.a.im[j]));
		return m;
	});
	const AC = { x: PL + 100, y: 236 };
	const AR = 46; // px for the largest single-slit amplitude
	const amp = $derived.by(() => {
		const j = probeCell;
		const a = { re: field.a.re[j] / amax, im: field.a.im[j] / amax };
		const b = { re: field.b.re[j] / amax, im: field.b.im[j] / amax };
		const s = { re: a.re + b.re, im: a.im + b.im };
		const pmax = Math.max(...Array.from({ length: 41 }, (_, k) => P[c0 - 20 + k]));
		return { a, b, s, rel: P[j] / pmax };
	});
	const pt = (z: { re: number; im: number }, from = { re: 0, im: 0 }) => ({
		x: AC.x + (z.re + from.re) * AR,
		y: AC.y - (z.im + from.im) * AR
	});
	function arrow(x1: number, y1: number, x2: number, y2: number) {
		const L = Math.hypot(x2 - x1, y2 - y1);
		if (L < 1) return '';
		const ux = (x2 - x1) / L;
		const uy = (y2 - y1) / L;
		const h = Math.min(9, L * 0.4);
		const bx = x2 - ux * h;
		const by = y2 - uy * h;
		return `M${x1} ${y1}L${bx} ${by}M${x2} ${y2}L${bx - uy * h * 0.5} ${by + ux * h * 0.5}L${bx + uy * h * 0.5} ${by - ux * h * 0.5}Z`;
	}

	// ---- labels ------------------------------------------------------------------------------
	const fmt = (n: number) => n.toLocaleString('en-US');
	const record = $derived.by(() => {
		if (!detectorOn) return '';
		const n = Math.min(12, landed);
		const out: string[] = [];
		for (let i = landed - n; i < landed; i++) out.push(hits.slitOf[i] === 1 ? 'T' : 'B');
		return out.join(' ');
	});
	const mapOpacity = $derived(phase === 'dots' ? 0.45 : 0.8);
</script>

<g>
	<!-- source -->
	<rect
		x={SRC_X - 30}
		y={Y0 - 22}
		width="44"
		height="44"
		rx="8"
		fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<circle cx={SRC_X - 8} cy={Y0} r="7" fill="var(--qm-dot)" opacity="0.8" />
	<Readout id="source">
		<Label x={SRC_X - 8} y={Y0 + 42} text="electron" size={12} anchor="middle" muted />
		<Label x={SRC_X - 8} y={Y0 + 57} text="source" size={12} anchor="middle" muted />
	</Readout>
	<line
		x1={SRC_X + 14}
		x2={WALL_X - 4}
		y1={Y0}
		y2={Y0}
		stroke="var(--stage-line)"
		stroke-dasharray="3 5"
		opacity="0.7"
	/>

	<!-- the wave between the wall and the screen -->
	{#if mapImage}
		<image
			href={mapImage}
			x={MAP_X}
			y={Y(YMAX)}
			width={SCREEN_X - MAP_X}
			height={2 * YMAX * PX}
			preserveAspectRatio="none"
			opacity={front !== null ? mapOpacity * 0.45 : mapOpacity}
		/>
		{#if front !== null}
			<clipPath id="slit-front">
				<rect x={MAP_X} y={Y(YMAX)} width={front - MAP_X} height={2 * YMAX * PX} />
			</clipPath>
			<image
				href={mapImage}
				x={MAP_X}
				y={Y(YMAX)}
				width={SCREEN_X - MAP_X}
				height={2 * YMAX * PX}
				preserveAspectRatio="none"
				clip-path="url(#slit-front)"
				opacity={0.95}
			/>
			<line
				x1={front}
				x2={front}
				y1={Y(YMAX)}
				y2={Y(-YMAX)}
				stroke="var(--qm-prob)"
				stroke-width="1.5"
				opacity="0.5"
			/>
		{/if}
	{/if}
	<rect
		x={MAP_X}
		y={Y(YMAX)}
		width={SCREEN_X - MAP_X}
		height={2 * YMAX * PX}
		fill="none"
		stroke="var(--stage-line)"
		opacity="0.5"
	/>

	<!-- detector: a light beam just behind the slits -->
	{#if detectorOn}
		<rect
			x={MAP_X + 2}
			y={Y(YMAX)}
			width="12"
			height={2 * YMAX * PX}
			fill="var(--qm-barrier)"
			opacity="0.35"
		/>
		<Readout id="beam">
			<Label
				anchor="start"
				x={MAP_X + 22}
				y={Y(YMAX) + 18}
				text="light beam: records the slit"
				size={12}
				color="var(--stage-ink)"
			/>
		</Readout>
	{/if}
	{#if photon}
		<g opacity={photon.o}>
			<path
				d="M{photon.x} {photon.y} l-6 {photon.slit === 1 ? 6 : -6}"
				stroke="var(--qm-barrier)"
				stroke-width="2"
			/>
			<circle cx={photon.x} cy={photon.y} r="4.5" fill="var(--qm-barrier)" />
		</g>
	{/if}

	<!-- the wall with two slits -->
	<g fill="var(--qm-wall)">
		<rect x={WALL_X - 4} y={Y(YMAX) - 6} width="8" height={slitTop.y0 - Y(YMAX) + 6} rx="2" />
		<rect x={WALL_X - 4} y={slitTop.y1} width="8" height={slitBot.y0 - slitTop.y1} rx="2" />
		<rect x={WALL_X - 4} y={slitBot.y1} width="8" height={Y(-YMAX) + 6 - slitBot.y1} rx="2" />
		{#if open === 'bottom'}
			<rect x={WALL_X - 4} y={slitTop.y0 - 1} width="8" height={slitTop.y1 - slitTop.y0 + 2} />
		{/if}
		{#if open === 'top'}
			<rect x={WALL_X - 4} y={slitBot.y0 - 1} width="8" height={slitBot.y1 - slitBot.y0 + 2} />
		{/if}
	</g>
	<Readout id="slit-labels">
		<Label x={WALL_X - 12} y={Y(0.5) + 4} text="top" size={11} anchor="end" color="var(--qm-top)" />
		<Label
			x={WALL_X - 12}
			y={Y(-0.5) + 4}
			text="bottom"
			size={11}
			anchor="end"
			color="var(--qm-bottom)"
		/>
	</Readout>

	<!-- the electron on its way to the wall -->
	{#if blob}
		<circle cx={blob.x} cy={Y0} r="9" fill="var(--qm-prob)" opacity={0.25 * blob.o} />
		<circle cx={blob.x} cy={Y0} r="4.5" fill="var(--qm-prob)" opacity={blob.o} />
	{/if}

	<!-- the screen -->
	<rect
		x={SCREEN_X}
		y={Y(YMAX)}
		width={SCREEN_W}
		height={2 * YMAX * PX}
		fill="var(--qm-screen)"
		stroke="var(--stage-line)"
	/>
	{#if dotsImage}
		<image
			href={dotsImage}
			x={SCREEN_X}
			y={Y(YMAX)}
			width={SCREEN_W}
			height={2 * YMAX * PX}
			preserveAspectRatio="none"
		/>
	{/if}
	{#if flash}
		<circle
			cx={flash.x}
			cy={flash.y}
			r={flash.r}
			fill="none"
			stroke="var(--qm-prob)"
			stroke-width="2"
			opacity={flash.o}
		/>
	{/if}

	<!-- histogram and predicted curves -->
	<line
		x1={HIST_X}
		x2={HIST_X}
		y1={Y(YMAX)}
		y2={Y(-YMAX)}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={histPath} fill="var(--qm-dot)" opacity="0.35" />
	{#if showSum}
		<path
			d={sumPath}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity="0.75"
		/>
	{/if}
	{#if curveAmt > 0.01}
		<path d={curvePath} fill="none" stroke="var(--qm-prob)" stroke-width="2.2" opacity={curveAmt} />
	{/if}
	<Readout id="axes-labels">
		<Label
			x={SCREEN_X + SCREEN_W / 2}
			y={Y(-YMAX) + 22}
			text="screen"
			size={12}
			anchor="middle"
			muted
		/>
		<Label anchor="start" x={HIST_X + 4} y={Y(-YMAX) + 22} text="count" size={12} muted />
		<Label
			x={(MAP_X + SCREEN_X) / 2}
			y={Y(-YMAX) + 22}
			text="|ψ|² between the slits and the screen"
			size={12}
			anchor="middle"
			muted
		/>
	</Readout>

	<!-- the probe (amplitudes) -->
	{#if ampAmt.current > 0.01}
		<g opacity={ampAmt.current}>
			<line
				x1={WALL_X}
				y1={Y(0.5)}
				x2={SCREEN_X}
				y2={Y(probeY)}
				stroke="var(--qm-top)"
				stroke-width="2"
			/>
			<line
				x1={WALL_X}
				y1={Y(-0.5)}
				x2={SCREEN_X}
				y2={Y(probeY)}
				stroke="var(--qm-bottom)"
				stroke-width="2"
			/>
			<line
				x1={SCREEN_X}
				x2={HIST_X + HIST_W}
				y1={Y(probeY)}
				y2={Y(probeY)}
				stroke="var(--stage-ink)"
				stroke-width="1"
				stroke-dasharray="2 3"
			/>
		</g>
		{#if isAmp}
			<Handle
				x={SCREEN_X + SCREEN_W / 2}
				y={Y(probeY)}
				r={7}
				label="Point on the screen"
				value={probeY}
				min={-4}
				max={4}
				valuetext="y = {probeY.toFixed(2)} d"
				color="var(--qm-prob)"
				onmove={(p: Point) =>
					setParam('probe', Math.round(clamp((Y0 - p.y) / PX, -4, 4) * 20) / 20)}
				onkey={(s) =>
					setParam(
						'probe',
						s === 'start'
							? -4
							: s === 'end'
								? 4
								: Math.round(clamp(probeY + s * 0.05, -4, 4) * 20) / 20
					)}
			/>
		{/if}
	{/if}

	<!-- panel -->
	<Readout id="count" order={1} label="Electrons landed" value={fmt(landed)}>
		<Label anchor="start" x={PL} y={56} text="electrons landed" size={13} muted />
		<Label anchor="start" x={PL} y={88} text={fmt(landed)} size={28} weight={600} />
		<Label anchor="start" x={PL} y={110} text="each dot is one electron" size={12} muted />
	</Readout>

	{#if phase === 'dots'}
		<Readout
			id="legend-curve"
			order={2}
			label="Purple curve"
			value="the predicted pattern"
			opacity={curveAmt}
		>
			<g opacity={curveAmt}>
				<line x1={PL} x2={PL + 24} y1={150} y2={150} stroke="var(--qm-prob)" stroke-width="2.2" />
				<Label anchor="start" x={PL + 32} y={154} text="predicted pattern" size={12} />
			</g>
		</Readout>
		<Readout id="one-at-a-time" order={3} label="In flight" value="one electron at a time">
			<Label anchor="start" x={PL} y={190} text="only one electron is in the" size={12} muted />
			<Label anchor="start" x={PL} y={207} text="apparatus at a time" size={12} muted />
		</Readout>
	{/if}

	{#if isAmp}
		<g opacity={ampAmt.current}>
			<circle cx={AC.x} cy={AC.y} r={2 * AR} fill="none" stroke="var(--stage-line)" opacity="0.6" />
			<line
				x1={AC.x - 2 * AR - 6}
				x2={AC.x + 2 * AR + 6}
				y1={AC.y}
				y2={AC.y}
				stroke="var(--stage-grid)"
			/>
			<line
				x1={AC.x}
				x2={AC.x}
				y1={AC.y - 2 * AR - 6}
				y2={AC.y + 2 * AR + 6}
				stroke="var(--stage-grid)"
			/>
			{#each [{ z: amp.a, from: { re: 0, im: 0 }, c: 'var(--qm-top)' }, { z: amp.b, from: amp.a, c: 'var(--qm-bottom)' }, { z: amp.s, from: { re: 0, im: 0 }, c: 'var(--qm-prob)' }] as v, k (k)}
				{@const p0 = pt({ re: 0, im: 0 }, v.from)}
				{@const p1 = pt(v.z, v.from)}
				<path
					d={arrow(p0.x, p0.y, p1.x, p1.y)}
					stroke={v.c}
					fill={v.c}
					stroke-width={k === 2 ? 3 : 2}
					stroke-linejoin="round"
				/>
			{/each}
		</g>
		<Readout id="amp-key" order={2} label="Amplitudes" value="ψtop + ψbottom = ψ">
			<Label
				anchor="start"
				x={PL}
				y={150}
				text="ψtop"
				size={13}
				weight={600}
				color="var(--qm-top)"
			/>
			<Label anchor="start" x={PL + 40} y={150} text="+" size={13} />
			<Label
				anchor="start"
				x={PL + 56}
				y={150}
				text="ψbottom"
				size={13}
				weight={600}
				color="var(--qm-bottom)"
			/>
			<Label anchor="start" x={PL + 118} y={150} text="=" size={13} />
			<Label
				anchor="start"
				x={PL + 134}
				y={150}
				text="ψ"
				size={13}
				weight={600}
				color="var(--qm-prob)"
			/>
		</Readout>
		<Readout
			id="amp-prob"
			order={3}
			label="|ψ|² at this point"
			value="{Math.round(amp.rel * 100)}% of the brightest fringe"
		>
			<Label anchor="start" x={PL} y={366} text="|ψ|² here" size={13} muted />
			<Label
				anchor="start"
				x={PL}
				y={392}
				text="{Math.round(amp.rel * 100)}% of the brightest"
				size={16}
				weight={600}
			/>
			<Label
				anchor="start"
				x={PL}
				y={412}
				text={amp.rel < 0.05
					? 'the arrows cancel: no electrons'
					: amp.rel > 0.8
						? 'the arrows line up: bright'
						: 'partly cancelling'}
				size={12}
				muted
			/>
		</Readout>
	{/if}

	{#if showSum}
		<Readout
			id="legend-solid"
			order={2}
			label="Curves"
			value="solid: these settings · dashed: top alone + bottom alone"
		>
			<line x1={PL} x2={PL + 24} y1={150} y2={150} stroke="var(--qm-prob)" stroke-width="2.2" />
			<Label anchor="start" x={PL + 32} y={154} text="probability, these settings" size={12} />
		</Readout>
		<Readout id="legend-dashed">
			<line
				x1={PL}
				x2={PL + 24}
				y1={176}
				y2={176}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<Label anchor="start" x={PL + 32} y={180} text="top alone + bottom alone" size={12} />
		</Readout>
	{/if}

	{#if phase === 'detector' || phase === 'partial'}
		<Readout id="visibility" order={4} label="Fringe visibility" value={visText}>
			<Label anchor="start" x={PL} y={226} text="fringe visibility" size={13} muted />
			<Label anchor="start" x={PL} y={254} text={visText} size={24} weight={600} />
			<Label anchor="start" x={PL} y={274} text="1 = perfect fringes, 0 = none" size={12} muted />
		</Readout>
	{/if}

	{#if phase === 'detector'}
		<Readout
			id="record"
			order={5}
			label="Record"
			value={detectorOn ? (reading ? record : 'made, unread') : 'none'}
		>
			<Label anchor="start" x={PL} y={316} text="which-slit record" size={13} muted />
			{#if !detectorOn}
				<Label anchor="start" x={PL} y={340} text="none: the detector is off" size={13} />
			{:else if reading}
				<Label anchor="start" x={PL} y={340} text={record} size={14} weight={600} />
				<Label
					anchor="start"
					x={PL}
					y={360}
					text="T top · B bottom (latest last)"
					size={11}
					muted
				/>
			{:else}
				<Label anchor="start" x={PL} y={340} text="made, but nobody reads it" size={13} />
				<Label
					anchor="start"
					x={PL}
					y={360}
					text="the photons fly off into the room"
					size={11}
					muted
				/>
			{/if}
		</Readout>
	{/if}

	{#if phase === 'partial'}
		<Readout
			id="dist"
			order={5}
			label="Record tells the slits apart"
			value="D = {Math.round(D * 100)}%"
			note="overlap γ = {gamma.toFixed(2)}"
		>
			<Label anchor="start" x={PL} y={316} text="record tells the slits apart" size={13} muted />
			<Label
				anchor="start"
				x={PL}
				y={342}
				text="D = {Math.round(D * 100)}%"
				size={18}
				weight={600}
			/>
			<Label anchor="start" x={PL} y={366} text="overlap of the two photon" size={12} muted />
			<Label
				anchor="start"
				x={PL}
				y={382}
				text="states: γ = √(1 − D²) = {gamma.toFixed(2)}"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
