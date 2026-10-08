<script lang="ts">
	/**
	 * Training and test error against flexibility (polynomial degree 0…12), with a
	 * small inset of the examples and the fitted curves. One scene, two phases:
	 * - `curve`: one set of examples (21 examples, noise 0.15 unless the step
	 *   offers those controls), fitted to its solid (training) points and scored on
	 *   its hollow (test) points;
	 * - `data`: the same, responding to `count` and `noise`, with the error curves
	 *   averaged over AVERAGE random sets of examples so that the trend is stable.
	 *   The average is taken on the log scale (a geometric mean): an arithmetic
	 *   mean of squared errors is dominated by the odd set where a degree-12 curve
	 *   swings to 10⁴, which would hide the typical behaviour.
	 *
	 * Seeding (shared with FitScene): the set of examples shown is
	 * `makeData(count, noise, 1 + fresh)`, where `fresh` counts presses of
	 * "New examples". The averaged sets are seeds `1 + fresh + 1000·k`,
	 * k = 0…AVERAGE − 1, so k = 0 is the set drawn in the inset. When that set is
	 * FitScene's (21 examples, noise 0.15), the examples the reader dragged there
	 * (`params.pts`, same format as in FitScene) are applied to it, so both
	 * scenes show the same examples and the same errors.
	 *
	 * Degrees above (training examples − 1) have more settings than examples:
	 * the least-squares fit is not unique there (fit.ts picks one with a tiny
	 * ridge). Those degrees are shaded, their errors are not drawn (the test
	 * error of that particular fit is an artefact of the choice and can even dip,
	 * which would contradict the step) and they are never the sweet spot.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, easeInOut, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { errorCurve, fitPolynomial, makeData } from '../fit';

	let { step, t, params, reduced }: StageProps = $props();

	const MAX_DEGREE = 12;
	const degreeName = (d: number) => `degree ${d}`;
	const AVERAGE = 40;
	const DEGREES = Array.from({ length: MAX_DEGREE + 1 }, (_, d) => d);

	// ---- inputs ------------------------------------------------------------------------
	type Phase = 'curve' | 'data';
	const phase = $derived((step.hints?.phase === 'data' ? 'data' : 'curve') as Phase);
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const count = $derived(
		offered.has('count') ? Math.round(clamp(Number(params.count ?? 21), 8, 80)) : 21
	);
	const noise = $derived(offered.has('noise') ? clamp(Number(params.noise ?? 0.15), 0, 0.4) : 0.15);
	const fresh = $derived(Number(params.fresh ?? 0) || 0);
	const degree = $derived(Math.round(clamp(Number(params.degree ?? 3), 0, MAX_DEGREE)));
	const seed = $derived(1 + fresh);
	/** FitScene's set of examples: the only one the reader can have dragged. */
	const moved = $derived.by(() => {
		const out: Record<number, { x: number; y: number }> = {};
		if (count !== 21 || noise !== 0.15) return out;
		const raw = typeof params.pts === 'string' ? params.pts : '';
		const [s, list] = raw.split('|');
		if (Number(s) !== seed || !list) return out;
		for (const item of list.split(';')) {
			const [id, xy] = item.split(':');
			const [x, y] = (xy ?? '').split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) out[Number(id)] = { x, y };
		}
		return out;
	});

	// ---- the data and the error curves ---------------------------------------------------
	const lg = (v: number) => Math.log10(Math.max(v, 1e-30));

	interface Curves {
		train: number[]; // log10 of the mean squared error, per degree
		test: number[];
		maxD: number; // highest degree with no more settings than training examples
		best: number;
	}
	type Data = ReturnType<typeof makeData>;
	/** Error curves; `first` is the set for k = 0 (the one in the inset). */
	function curvesFor(ph: Phase, n: number, sd: number, sd0: number, first: Data): Curves {
		const sets = ph === 'data' ? AVERAGE : 1;
		const train = new Array(MAX_DEGREE + 1).fill(0);
		const test = new Array(MAX_DEGREE + 1).fill(0);
		let nTrain = 0;
		for (let k = 0; k < sets; k++) {
			const pts = k === 0 ? first : makeData(n, sd, sd0 + 1000 * k);
			const tr = pts.filter((p) => !p.test);
			nTrain = tr.length;
			errorCurve(
				tr,
				pts.filter((p) => p.test),
				MAX_DEGREE
			).forEach((e, d) => {
				train[d] += lg(e.train) / sets;
				test[d] += lg(e.test) / sets;
			});
		}
		const maxD = Math.min(MAX_DEGREE, nTrain - 1);
		let best = 0;
		for (let d = 1; d <= maxD; d++) if (test[d] < test[best]) best = d;
		return { train, test, maxD, best };
	}
	const data = $derived(
		makeData(count, noise, seed).map((p) => ({ ...p, ...(moved[p.id] ?? {}) }))
	);
	const curves = $derived(curvesFor(phase, count, noise, seed, data));

	const trainPts = $derived(data.filter((p) => !p.test));
	const testPts = $derived(data.filter((p) => p.test));
	const model = $derived(fitPolynomial(trainPts, degree));
	const sweetModel = $derived(fitPolynomial(trainPts, curves.best));

	// ---- smooth reactions to controls and phase -------------------------------------------
	const opts = { duration: 700, easing: cubicInOut };
	const init = untrack(() => curves);
	const trainT = new Tween<number[]>(init.train, opts);
	const testT = new Tween<number[]>(init.test, opts);
	const bestT = new Tween(init.best, opts);
	const maxDT = new Tween(init.maxD, opts);
	const dataW = new Tween(
		untrack(() => (phase === 'data' ? 1 : 0)),
		opts
	);
	$effect(() => {
		const c = curves;
		const w = phase === 'data' ? 1 : 0;
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			trainT.set(c.train, o);
			testT.set(c.test, o);
			bestT.set(c.best, o);
			maxDT.set(c.maxD, o);
			dataW.set(w, o);
		});
	});
	const degreeT = new Tween(
		untrack(() => degree),
		opts
	);
	$effect(() => {
		const d = degree;
		untrack(() => degreeT.set(d, { duration: reduced ? 0 : 700 }));
	});

	// ---- chart geometry --------------------------------------------------------------------
	const CX0 = 104;
	const CX1 = 600;
	const CY0 = 146;
	const LEGEND_Y = 86;
	const CY1 = 476;
	const LOG_LO = -4; // 0.0001
	const LOG_HI = 1; // 10
	const xOf = (d: number) => CX0 + ((CX1 - CX0) * d) / MAX_DEGREE;
	const yOf = (l: number) =>
		CY1 - ((clamp(l, LOG_LO, LOG_HI) - LOG_LO) / (LOG_HI - LOG_LO)) * (CY1 - CY0);
	const Y_TICKS = [
		{ l: 1, text: '10' },
		{ l: 0, text: '1' },
		{ l: -1, text: '0.1' },
		{ l: -2, text: '0.01' },
		{ l: -3, text: '0.001' },
		{ l: -4, text: '0.0001' }
	];

	/** Lines draw in over ~2 s, then hold. */
	const reveal = $derived(reduced ? 1 : easeInOut(clamp((t - 0.3) / 2)));
	const head = $derived(reveal * MAX_DEGREE);
	const after = $derived(reduced ? 1 : smoothstep(2.1, 2.7, t));

	function linePath(vals: number[], from: number, to: number) {
		let d = '';
		const end = Math.min(to, head);
		for (let i = from; i <= Math.floor(end); i++)
			d += `${d ? 'L' : 'M'}${xOf(i).toFixed(1)} ${yOf(vals[i]).toFixed(1)}`;
		const i0 = Math.floor(end);
		if (end > i0 && i0 + 1 <= to && i0 >= from) {
			const u = end - i0;
			const l = vals[i0] + (vals[i0 + 1] - vals[i0]) * u;
			d += `L${(xOf(i0) + (xOf(i0 + 1) - xOf(i0)) * u).toFixed(1)} ${yOf(l).toFixed(1)}`;
		}
		return d;
	}
	const maxD = $derived(curves.maxD);
	const series = $derived([
		{ key: 'train', vals: trainT.current, color: 'var(--fit-train)' },
		{ key: 'test', vals: testT.current, color: 'var(--fit-test)' }
	]);

	const sweetX = $derived(xOf(bestT.current));
	const PILL_H = 22;
	const pillW = (text: string) => text.length * 6.6 + 18;
	/**
	 * Where the sweet-spot pill goes: candidate spots above and below its dot
	 * (and a little to either side); the one whose box covers the fewest dots
	 * and points along the drawn error curves wins, nearer spots first.
	 */
	const sweetPill = $derived.by(() => {
		const b = curves.best;
		const w = pillW(`sweet spot: ${degreeName(b)}`);
		const x0 = xOf(b);
		const y0 = yOf(curves.test[b]);
		const pts: { x: number; y: number; dot: boolean }[] = [];
		for (const vals of [curves.train, curves.test])
			for (let d = 0; d <= curves.maxD; d++) {
				pts.push({ x: xOf(d), y: yOf(vals[d]), dot: true });
				if (d < curves.maxD)
					for (let k = 1; k < 8; k++)
						pts.push({
							x: xOf(d + k / 8),
							y: yOf(vals[d] + ((vals[d + 1] - vals[d]) * k) / 8),
							dot: false
						});
			}
		let spot = { x: x0, y: y0 - 30, score: Infinity };
		for (const dy of [-30, 30, -48, 48, -66, 66])
			for (const dx of [0, -0.3 * w, 0.3 * w]) {
				const x = clamp(x0 + dx, CX0 + w / 2 + 4, CX1 - w / 2);
				const y = y0 + dy;
				if (y - PILL_H / 2 < CY0 + 4 || y + PILL_H / 2 > CY1 - 4) continue;
				let score = Math.abs(dy) / 30 + Math.abs(x - x0) / 60;
				for (const q of pts) {
					const pad = q.dot ? 7 : 3;
					if (Math.abs(q.x - x) < w / 2 + pad && Math.abs(q.y - y) < PILL_H / 2 + pad)
						score += q.dot ? 6 : 2;
				}
				if (score < spot.score) spot = { x, y, score };
			}
		return spot;
	});
	/** Tweened with the dot, so the pill does not jump when the sweet spot moves. */
	const pillX = Tween.of(() => sweetPill.x, opts);
	const pillY = Tween.of(() => sweetPill.y, opts);
	const best = $derived(curves.best);
	const offChart = $derived(
		DEGREES.filter((d) => d <= head && d <= maxD && curves.test[d] > LOG_HI).map(
			(d) => curves.test[d]
		)
	);
	const atFloor = $derived(
		DEGREES.some(
			(d) => d <= head && d <= maxD && (curves.train[d] < LOG_LO || curves.test[d] < LOG_LO)
		)
	);

	// ---- formatting ------------------------------------------------------------------------
	/** Same format as FitScene's readouts, so both scenes show the same numbers. */
	function fmtErr(l: number) {
		if (l < LOG_LO) return 'below 0.0001';
		const v = 10 ** l;
		return v >= 10 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(3) : v.toFixed(4);
	}

	// ---- inset: the examples and the fitted curves -----------------------------------------
	const IX0 = 652;
	const IX1 = 928;
	const IY0 = 120;
	const IY1 = 318;
	const ixOf = (x: number) => IX0 + 12 + ((x + 1) / 2) * (IX1 - IX0 - 24);
	const iyOf = (y: number) => (IY0 + IY1) / 2 - (y / 1.3) * ((IY1 - IY0) / 2 - 10);
	function curvePath(predict: (x: number) => number) {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const x = -0.97 + (1.94 * i) / 120;
			const y = clamp(predict(x), -3, 3);
			d += `${i ? 'L' : 'M'}${ixOf(x).toFixed(1)} ${iyOf(y).toFixed(1)}`;
		}
		return d;
	}
	const modelPath = $derived(curvePath(model.predict));
	const sweetPath = $derived(curvePath(sweetModel.predict));

	// Readouts at the current degree (the averaged values in the `data` phase).
	const atDegree = $derived({
		train: curves.train[degree],
		test: curves.test[degree],
		underdetermined: degree > maxD
	});
	const nTrain = $derived(trainPts.length);
	const modelText = $derived(`your model: ${degreeName(degree)}`);
	const nTest = $derived(testPts.length);
</script>

<g>
	<!-- title -->
	{@render txt(48, 42, 'Error against flexibility', 16, { weight: 600 })}
	{@render txt(
		48,
		64,
		'Mean squared error on a log scale: each gridline up is ten times bigger.',
		13,
		{ muted: true }
	)}

	<!-- grid and axes -->
	{#each Y_TICKS as tk (tk.l)}
		<line
			x1={CX0}
			x2={CX1}
			y1={yOf(tk.l)}
			y2={yOf(tk.l)}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		{@render txt(CX0 - 10, yOf(tk.l) + 4, tk.text, 11, { anchor: 'end', muted: true })}
	{/each}
	{#each DEGREES as d (d)}
		<line x1={xOf(d)} x2={xOf(d)} y1={CY1} y2={CY1 + 5} stroke="var(--stage-line)" />
		{@render txt(xOf(d), CY1 + 19, String(d), 11, { anchor: 'middle', muted: true })}
	{/each}
	<line x1={CX0} x2={CX0} y1={CY0} y2={CY1} stroke="var(--stage-line)" stroke-width="1" />
	<line x1={CX0} x2={CX1} y1={CY1} y2={CY1} stroke="var(--stage-line)" stroke-width="1" />
	{@render txt((CX0 + CX1) / 2, 572, 'flexibility: degree of the curve', 12, {
		anchor: 'middle',
		muted: true
	})}

	<!-- degrees with more settings than training examples -->
	{#if maxDT.current < MAX_DEGREE - 0.01}
		{@const rx = xOf(maxDT.current + 0.5)}
		<rect
			x={rx}
			y={CY0}
			width={Math.max(0, CX1 + 8 - rx)}
			height={CY1 - CY0}
			fill="var(--stage-grid)"
			opacity={clamp(MAX_DEGREE - maxDT.current)}
		/>
		{#if maxD < MAX_DEGREE}
			{@render txt((rx + CX1) / 2, CY1 - 44, 'more settings than', 11, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt((rx + CX1) / 2, CY1 - 30, `training examples (${nTrain})`, 11, {
				anchor: 'middle',
				muted: true
			})}
		{/if}
	{/if}

	<!-- the current degree -->
	<line
		x1={xOf(degreeT.current)}
		x2={xOf(degreeT.current)}
		y1={CY0 - 4}
		y2={CY1}
		stroke="var(--fit-model)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	{@render pill(
		clamp(xOf(degreeT.current), CX0 + pillW(modelText) / 2 - 30, CX1 - pillW(modelText) / 2 + 20),
		CY0 - 22,
		modelText,
		'var(--fit-model)'
	)}

	<!-- the two error curves -->
	{#each series as s (s.key)}
		<path
			d={linePath(s.vals, 0, maxD)}
			fill="none"
			stroke={s.color}
			stroke-width="2.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		{#each DEGREES as d (d)}
			{#if d <= head + 0.001 && d <= maxD}
				{@const l = s.vals[d]}
				<circle
					cx={xOf(d)}
					cy={yOf(l)}
					r={d === degree ? 5.5 : 4}
					fill={l < LOG_LO || l > LOG_HI ? 'var(--stage-bg)' : s.color}
					stroke={s.color}
					stroke-width="1.5"
				/>
				{#if l > LOG_HI}
					<path
						d="M{xOf(d) - 5} {CY0 - 2} L{xOf(d)} {CY0 - 9} L{xOf(d) + 5} {CY0 - 2}"
						fill="none"
						stroke={s.color}
						stroke-width="1.5"
					/>
				{/if}
			{/if}
		{/each}
	{/each}

	<!-- legend, above the chart (inside it, the curves can run through it) -->
	<g opacity={clamp(reveal * 3)}>
		{#each [{ x: CX0, color: 'var(--fit-test)', text: 'test error: examples held back' }, { x: CX0 + 232, color: 'var(--fit-train)', text: 'training error: examples it was fitted to' }] as row (row.x)}
			<line
				x1={row.x}
				x2={row.x + 20}
				y1={LEGEND_Y - 4}
				y2={LEGEND_Y - 4}
				stroke={row.color}
				stroke-width="2.5"
			/>
			<circle cx={row.x + 10} cy={LEGEND_Y - 4} r="4" fill={row.color} />
			{@render txt(row.x + 28, LEGEND_Y, row.text, 12)}
		{/each}
		{#if offChart.length || atFloor}
			{@render txt(
				CX0 + 28,
				LEGEND_Y + 16,
				offChart.length && atFloor
					? `hollow dots: off the chart at the top (up to ${fmtErr(Math.max(...offChart))}), below 0.0001 at the bottom`
					: offChart.length
						? `hollow dot at the top: off the chart (up to ${fmtErr(Math.max(...offChart))})`
						: 'hollow dot at the bottom: below 0.0001, almost zero',
				11,
				{ muted: true }
			)}
		{/if}
	</g>

	<!-- the sweet spot -->
	<g opacity={after}>
		<circle
			cx={sweetX}
			cy={yOf(testT.current[best])}
			r="10"
			fill="none"
			stroke="var(--fit-test)"
			stroke-width="2"
		/>
		{@render pill(
			pillX.current,
			pillY.current,
			`sweet spot: ${degreeName(best)}`,
			'var(--fit-test)'
		)}
	</g>

	<!-- regions under the axis, split at the sweet spot -->
	<g opacity={after}>
		{#if best > 0}
			{@const x1 = sweetX - 8}
			<path
				d="M{CX0} {CY1 + 30} V{CY1 + 36} H{x1} V{CY1 + 30}"
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			{@render txt(x1, CY1 + 54, '← too stiff', 12, { anchor: 'end' })}
			{@render txt(x1, CY1 + 68, '(underfitting)', 11, {
				anchor: 'end',
				muted: true
			})}
		{/if}
		{#if best < maxD && xOf(maxD) - xOf(best) >= 70}
			{@const x0 = sweetX + 8}
			{@const x1 = xOf(maxD)}
			<path
				d="M{x0} {CY1 + 30} V{CY1 + 36} H{Math.max(x0, x1)} V{CY1 + 30}"
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			{@render txt(x0, CY1 + 54, 'too flexible →', 12)}
			{@render txt(x0, CY1 + 68, '(overfitting)', 11, { muted: true })}
		{/if}
	</g>

	<!-- inset: what each point of the chart looks like -->
	{@render txt(IX0, IY0 - 10, 'The examples and the fitted curves', 12, { weight: 600 })}
	<rect
		x={IX0}
		y={IY0}
		width={IX1 - IX0}
		height={IY1 - IY0}
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<clipPath id="curve-inset-clip">
		<rect x={IX0 + 1} y={IY0 + 1} width={IX1 - IX0 - 2} height={IY1 - IY0 - 2} rx="7" />
	</clipPath>
	<g clip-path="url(#curve-inset-clip)">
		{#if best !== degree}
			<path
				d={sweetPath}
				fill="none"
				stroke="var(--fit-test)"
				stroke-width="2"
				stroke-dasharray="5 4"
				opacity="0.7"
			/>
		{/if}
		<path d={modelPath} fill="none" stroke="var(--fit-model)" stroke-width="2.5" />
		{#each trainPts as p (p.id)}
			<circle cx={ixOf(p.x)} cy={iyOf(p.y)} r="3.5" fill="var(--fit-train)" />
		{/each}
		{#each testPts as p (p.id)}
			<circle
				cx={ixOf(p.x)}
				cy={iyOf(p.y)}
				r="3.5"
				fill="var(--surface)"
				stroke="var(--fit-test)"
				stroke-width="1.5"
			/>
		{/each}
	</g>
	<line
		x1={IX0 + 4}
		x2={IX0 + 24}
		y1={IY1 + 20}
		y2={IY1 + 20}
		stroke="var(--fit-model)"
		stroke-width="2.5"
	/>
	{@render txt(
		IX0 + 32,
		IY1 + 24,
		best === degree
			? `your model, ${degreeName(degree)} = sweet spot`
			: `your model, ${degreeName(degree)}`,
		12
	)}
	{#if best !== degree}
		<line
			x1={IX0 + 4}
			x2={IX0 + 24}
			y1={IY1 + 40}
			y2={IY1 + 40}
			stroke="var(--fit-test)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
		{@render txt(IX0 + 32, IY1 + 44, `sweet spot, ${degreeName(best)}`, 12)}
	{/if}
	{@render txt(
		IX0,
		IY1 + 66,
		`fitted to the ${nTrain} solid dots, tested on the ${nTest} hollow ones`,
		11,
		{ muted: true }
	)}

	<!-- readouts -->
	<g>
		{@render txt(IX0, 420, `At ${degreeName(degree)}:`, 13, { weight: 600 })}
		{#if atDegree.underdetermined}
			{@render txt(IX0, 440, 'training error: zero (through every dot)', 13, {
				color: 'var(--fit-train)'
			})}
			{@render txt(IX0, 460, 'test error: not charted', 13, { color: 'var(--fit-test)' })}
			{@render txt(IX0, 478, 'more settings than examples: many curves fit them', 11, {
				muted: true
			})}
		{:else}
			{@render txt(IX0, 440, `training error ${fmtErr(atDegree.train)}`, 13, {
				color: 'var(--fit-train)'
			})}
			{@render txt(IX0, 460, `test error ${fmtErr(atDegree.test)}`, 13, {
				color: 'var(--fit-test)'
			})}
		{/if}
	</g>
	<g opacity={dataW.current}>
		{@render txt(
			IX0,
			506,
			`With ${count} examples, noise ${noise === 0 ? 'none' : noise.toFixed(2)}:`,
			13,
			{ weight: 600 }
		)}
		{@render txt(IX0, 526, `best ${degreeName(best)}`, 13, { color: 'var(--fit-test)' })}
		{#if noise === 0}
			{@render txt(IX0 + 96, 526, '(no noise: nothing to overfit)', 11, { muted: true })}
		{/if}
		{@render txt(IX0, 546, `errors averaged over ${AVERAGE} random sets of`, 11, { muted: true })}
		{@render txt(IX0, 560, 'examples (on the log scale); the inset shows one', 11, {
			muted: true
		})}
	</g>
</g>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; halo?: boolean } = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo ?? true}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet pill(x: number, y: number, text: string, color: string)}
	{@const w = pillW(text)}
	<rect
		x={x - w / 2}
		y={y - 11}
		width={w}
		height="22"
		rx="11"
		fill="var(--stage-bg)"
		stroke={color}
		stroke-width="1.5"
	/>
	{@render txt(x, y + 4, text, 12, { anchor: 'middle', halo: false, weight: 600 })}
{/snippet}
