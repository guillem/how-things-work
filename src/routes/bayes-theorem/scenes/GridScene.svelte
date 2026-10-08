<script lang="ts">
	/**
	 * A crowd of 1,000 people as a 40 × 25 grid, coloured by who is ill and who
	 * tests positive, with a readout card on the right. One <path> per group keeps
	 * the node count tiny. Cells are filled row by row in the order false
	 * negatives, true positives, false positives, true negatives: the ill stay one
	 * block (the first `sick` cells) and so do the positives (the next run), so
	 * each can be outlined as a single shape.
	 *
	 * Phases (step.hints.phase): crowd (ill vs healthy), test (a sweep colours the
	 * four groups), positives (negatives fade, positives outlined, readout), sliders
	 * and formula (live numbers from the controls).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { EXAMPLE, counts, ppv, secondTest, type Test } from '../bayes';

	let { step, t, params, reduced }: StageProps = $props();

	const COLS = 40;
	const ROWS = 25;
	const N = COLS * ROWS;
	const PITCH = 15;
	const CELL = 12;
	const GX = 30;
	const GY = 96;
	const GH = ROWS * PITCH - (PITCH - CELL);
	const CX = 648;
	const CW = 292;
	const CY = GY;
	const CH = GH;

	type Group = 'tp' | 'fn' | 'fp' | 'tn';
	type Layer = Group | 'sn' | 'hn';
	const COLOR: Record<Group, string> = {
		tp: 'var(--bay-tp)',
		fn: 'var(--bay-fn)',
		fp: 'var(--bay-fp)',
		tn: 'var(--bay-tn)'
	};

	// One rounded square per person, as a path fragment (built once).
	const cellPath = Array.from({ length: N }, (_, i) => {
		const x = GX + (i % COLS) * PITCH;
		const y = GY + Math.floor(i / COLS) * PITCH;
		return `M${x + 2} ${y}h8q2 0 2 2v8q0 2-2 2h-8q-2 0-2-2v-8q0-2 2-2z`;
	});

	const phase = $derived(String(step.hints?.phase ?? 'crowd'));
	const live = $derived(phase === 'sliders' || phase === 'formula');
	const test: Test = $derived(
		live
			? {
					prevalence: Number(params.prevalence ?? EXAMPLE.prevalence),
					sensitivity: Number(params.sensitivity ?? EXAMPLE.sensitivity),
					specificity: Number(params.specificity ?? EXAMPLE.specificity)
				}
			: EXAMPLE
	);
	const c = $derived(counts(test, N));

	/** Group of cell i, in the block order fn, tp, fp, tn. */
	const groupOf = (i: number): Group =>
		i < c.falseNeg
			? 'fn'
			: i < c.falseNeg + c.truePos
				? 'tp'
				: i < c.falseNeg + c.truePos + c.falsePos
					? 'fp'
					: 'tn';

	// The test sweeps across the grid column by column (only in the test step).
	const SWEEP_START = 0.6;
	const SWEEP_TIME = 4;
	const sweep = $derived(
		phase === 'crowd'
			? 0
			: phase !== 'test' || reduced
				? COLS + 1
				: clamp((t - SWEEP_START) / SWEEP_TIME) * (COLS + 1)
	);
	const sweepDone = $derived(sweep >= COLS);

	/** Path data per group, plus the not-yet-tested ill ("sn") and healthy ("hn"). */
	const paths = $derived.by(() => {
		const out: Record<Layer, string[]> = { tp: [], fn: [], fp: [], tn: [], sn: [], hn: [] };
		const tally: Record<Group, number> = { tp: 0, fn: 0, fp: 0, tn: 0 };
		for (let i = 0; i < N; i++) {
			const g = groupOf(i);
			if (i % COLS < sweep) {
				out[g].push(cellPath[i]);
				tally[g]++;
			} else out[i < c.sick ? 'sn' : 'hn'].push(cellPath[i]);
		}
		const d = {} as Record<Layer, string>;
		for (const k of Object.keys(out) as Layer[]) d[k] = out[k].join('');
		return { d, tally };
	});

	// Negatives fade once we look only at the positives (fully in "positives").
	const dimTarget = $derived(phase === 'positives' ? 1 : live ? 0.55 : 0);
	const dim = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = dimTarget;
		const instant = reduced;
		untrack(() => dim.set(v, { duration: instant ? 0 : 800 }));
	});
	const negOpacity = $derived(1 - 0.65 * dim.current);

	/** Outline of the row-major run of cells [a, b), on the half-gap boundaries. */
	function outline(a: number, b: number) {
		if (b <= a) return '';
		const ra = Math.floor(a / COLS);
		const ca = a % COLS;
		const rb = Math.floor((b - 1) / COLS);
		const cb = ((b - 1) % COLS) + 1;
		const h = (PITCH - CELL) / 2;
		const X = (col: number) => GX - h + col * PITCH;
		const Y = (row: number) => GY - h + row * PITCH;
		if (ra === rb) return `M${X(ca)} ${Y(ra)}H${X(cb)}V${Y(ra + 1)}H${X(ca)}Z`;
		return (
			`M${X(ca)} ${Y(ra)}H${X(COLS)}V${Y(rb)}H${X(cb)}V${Y(rb + 1)}H${X(0)}` +
			`V${Y(ra + 1)}H${X(ca)}Z`
		);
	}
	const ring = $derived(
		phase === 'crowd'
			? outline(0, c.sick)
			: phase === 'test'
				? ''
				: outline(c.falseNeg, c.falseNeg + c.positives)
	);
	const ringDraw = $derived(reduced ? 1 : smoothstep(0.4, 1.8, t));

	const fmt = (n: number) => n.toLocaleString('en-US');
	/** Percentage with `digits` decimals. */
	const pct = (v: number, digits: number) =>
		Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '—';
	/** Short percentage for prose: whole numbers, one decimal below 1%. */
	const pp = (v: number) => `${+(v * 100).toFixed(v < 0.01 ? 1 : 0)}%`;
	const share = $derived(c.positives ? c.truePos / c.positives : NaN);
	const exact = $derived(ppv(test));
	const second = $derived(secondTest(test));

	const header = $derived(
		phase === 'crowd'
			? `1,000 people · ${fmt(c.sick)} ill, ${fmt(c.healthy)} healthy`
			: phase === 'test'
				? 'Everyone takes the test'
				: `Outlined: the ${fmt(c.positives)} who tested positive`
	);

	const legend = $derived(
		phase === 'crowd'
			? [
					{ key: 'sn', color: 'var(--stage-ink)', text: `ill ${fmt(c.sick)}` },
					{ key: 'hn', color: 'var(--stage-line)', text: `healthy ${fmt(c.healthy)}` }
				]
			: [
					{ key: 'tp', color: COLOR.tp, text: `true positive ${fmt(paths.tally.tp)}` },
					{ key: 'fn', color: COLOR.fn, text: `false negative ${fmt(paths.tally.fn)}` },
					{ key: 'fp', color: COLOR.fp, text: `false positive ${fmt(paths.tally.fp)}` },
					{ key: 'tn', color: COLOR.tn, text: `true negative ${fmt(paths.tally.tn)}` }
				]
	);

	// Bar of the positives: true (ill) vs false (healthy).
	const BAR_X = CX + 20;
	const BAR_W = CW - 40;
	const barTp = $derived(c.positives ? (c.truePos / c.positives) * BAR_W : 0);
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
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet bar(y: number)}
	<rect x={BAR_X} {y} width={BAR_W} height="14" rx="3" fill={COLOR.fp} />
	<rect x={BAR_X} {y} width={Math.max(2, barTp)} height="14" rx="3" fill={COLOR.tp} />
	{@render txt(BAR_X, y + 32, `${fmt(c.truePos)} ill`, 12, { color: COLOR.tp, weight: 600 })}
	{@render txt(BAR_X + BAR_W, y + 32, `${fmt(c.falsePos)} healthy`, 12, {
		anchor: 'end',
		color: COLOR.fp,
		weight: 600
	})}
{/snippet}

<g>
	<!-- the grid -->
	{@render txt(GX, GY - 22, header, 15, { weight: 600 })}
	<path d={paths.d.hn} fill="var(--stage-line)" opacity="0.45" />
	<path d={paths.d.sn} fill="var(--stage-ink)" opacity="0.85" />
	<path d={paths.d.tn} fill={COLOR.tn} opacity={negOpacity} />
	<path d={paths.d.fn} fill={COLOR.fn} opacity={negOpacity} />
	<path d={paths.d.fp} fill={COLOR.fp} />
	<path d={paths.d.tp} fill={COLOR.tp} />
	{#if ring}
		<path
			d={ring}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-linejoin="round"
			pathLength="1"
			stroke-dasharray="1 1"
			stroke-dashoffset={1 - ringDraw}
		/>
	{/if}
	{#if phase === 'test' && !sweepDone}
		{@const x = GX + Math.min(sweep, COLS) * PITCH - (PITCH - CELL) / 2}
		<line
			x1={x}
			x2={x}
			y1={GY - 8}
			y2={GY + GH + 8}
			stroke="var(--bay-tp)"
			stroke-width="2"
			stroke-linecap="round"
			opacity={smoothstep(0, 0.5, t)}
		/>
	{/if}

	<!-- legend under the grid -->
	{#each legend as l, i (l.key)}
		{@const lx = GX + i * (phase === 'crowd' ? 120 : 150)}
		<rect x={lx} y={GY + GH + 22} width="12" height="12" rx="2" fill={l.color} />
		{@render txt(lx + 18, GY + GH + 33, l.text, 12.5, { tabular: true })}
	{/each}

	<!-- readout card -->
	<rect
		x={CX}
		y={CY}
		width={CW}
		height={CH}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
		stroke-width="1"
	/>
	{#if phase === 'crowd'}
		{@render txt(CX + 20, CY + 34, 'Before anyone is tested', 13, { muted: true })}
		{@render txt(CX + 20, CY + 92, `${fmt(c.sick)} ill`, 40, { weight: 700 })}
		{@render txt(CX + 20, CY + 130, `${fmt(c.healthy)} healthy`, 22, { weight: 600, muted: true })}
		{@render txt(CX + 20, CY + 190, 'The base rate: 1 person in 100', 13)}
		{@render txt(CX + 20, CY + 210, 'has the disease.', 13)}
		{@render txt(CX + 20, CY + 260, 'Each square is one person.', 12, { muted: true })}
	{:else if phase === 'test'}
		{@render txt(CX + 20, CY + 34, 'Test results, counted', 13, { muted: true })}
		{@render txt(CX + 20, CY + 74, `Ill: ${fmt(c.sick)}`, 18, { weight: 700 })}
		{@render txt(CX + 20, CY + 100, `${fmt(paths.tally.tp)} caught (true positives)`, 13, {
			color: COLOR.tp,
			weight: 600,
			tabular: true
		})}
		{@render txt(CX + 20, CY + 122, `${fmt(paths.tally.fn)} missed (false negatives)`, 13, {
			color: COLOR.fn,
			weight: 600,
			tabular: true
		})}
		{@render txt(CX + 20, CY + 172, `Healthy: ${fmt(c.healthy)}`, 18, { weight: 700 })}
		{@render txt(CX + 20, CY + 198, `${fmt(paths.tally.fp)} flagged (false positives)`, 13, {
			color: COLOR.fp,
			weight: 600,
			tabular: true
		})}
		{@render txt(CX + 20, CY + 220, `${fmt(paths.tally.tn)} cleared (true negatives)`, 13, {
			weight: 600,
			tabular: true
		})}
		{@render txt(CX + 20, CY + 280, 'Catches 90% of the ill;', 12, { muted: true })}
		{@render txt(CX + 20, CY + 298, 'wrongly flags 9% of the healthy.', 12, { muted: true })}
	{:else}
		{@render txt(CX + 20, CY + 34, 'Of everyone who tested positive', 13, { muted: true })}
		{@render txt(CX + 20, CY + 82, `${fmt(c.truePos)} of ${fmt(c.positives)}`, 38, {
			weight: 700,
			tabular: true
		})}
		{@render txt(CX + 20, CY + 108, 'positives are ill', 15, { weight: 600 })}
		{@render txt(CX + CW - 20, CY + 108, `≈ ${pct(share, share < 0.02 ? 1 : 0)}`, 26, {
			anchor: 'end',
			weight: 700,
			color: COLOR.tp,
			tabular: true
		})}
		{@render bar(CY + 128)}
		{#if phase === 'positives'}
			{@render txt(CX + 20, CY + 210, 'A positive result is wrong', 13)}
			{@render txt(CX + 20, CY + 230, 'far more often than right:', 13)}
			{@render txt(CX + 20, CY + 250, 'the healthy far outnumber the ill.', 13)}
		{:else if phase === 'sliders'}
			{@render txt(CX + 20, CY + 212, "Exact, from Bayes' theorem", 13, { muted: true })}
			{@render txt(CX + 20, CY + 248, pct(exact, 1), 30, { weight: 700, tabular: true })}
			{@render txt(
				CX + 20,
				CY + 290,
				`${pp(test.prevalence)} ill · test catches ${pp(test.sensitivity)}`,
				12,
				{ muted: true }
			)}
			{@render txt(CX + 20, CY + 308, `and clears ${pp(test.specificity)} of the healthy`, 12, {
				muted: true
			})}
		{:else}
			{@render txt(CX + 20, CY + 206, 'true positives ÷ all positives', 12, { muted: true })}
			{@render txt(
				CX + 20,
				CY + 234,
				`${fmt(c.truePos)} ÷ (${fmt(c.truePos)} + ${fmt(c.falsePos)}) = ${pct(share, 1)}`,
				18,
				{ weight: 700, tabular: true }
			)}
			{@render txt(CX + 20, CY + 256, `exact: ${pct(exact, 1)}`, 12, { muted: true })}
			{@render txt(CX + 20, CY + 296, 'After a second positive from an', 12.5)}
			{@render txt(CX + 20, CY + 314, 'independent test:', 12.5)}
			{@render txt(CX + 20, CY + 336, `${pct(exact, 1)} → ${pct(second, 1)}`, 16, {
				weight: 700,
				color: COLOR.tp,
				tabular: true
			})}
		{/if}
	{/if}
</g>
