<script lang="ts">
	/**
	 * Allele frequencies in replicate Wright–Fisher populations, one line each.
	 *
	 * Phases (`step.hints.phase`):
	 *   drift — 20 neutral populations of `params.lineN` individuals, starting at
	 *           50%, for 200 generations; lines turn green when the allele is
	 *           fixed and red when it is lost; the counts follow the cursor
	 *   fate  — one new copy of an allele with advantage `params.s` in a population
	 *           of `params.fateN`, 2,000 times (`fateOfMutation`); 60 of them are
	 *           drawn on a square-root scale (so the first generations, at a
	 *           fraction of a percent, are visible); the share that fixed is
	 *           compared with Kimura's formula and with 2s (or 1/2N)
	 *
	 * Runs are computed once per setting, seeded by `params.again`. A cursor sweeps
	 * the chart in SWEEP seconds (a pure function of t) and the picture then holds.
	 */
	import { Axes, Label, clamp, linePath, niceMax, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { driftRuns, fateOfMutation, kimuraFixation, type Trajectory } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'drift'));
	const fate = $derived(phase === 'fate');
	const runs = $derived(Number(params.again ?? 0));
	const lineN = $derived(Number(params.lineN ?? 50));
	const fateN = $derived(Number(params.fateN ?? 200));
	const s = $derived(Number(params.s ?? 0.05));
	const TRIALS = 2000;
	const DRIFT_GENS = 200;

	const drift = $derived(fate ? [] : driftRuns(lineN, 0.5, 20, DRIFT_GENS, 101 + runs * 7919));
	const fates = $derived(fate ? fateOfMutation(fateN, s, TRIALS, 202 + runs * 7919, 60) : null);
	const lines: Trajectory[] = $derived(fate ? (fates?.shown ?? []) : drift);

	const X0 = 84;
	const X1 = 900;
	const Y0 = 112;
	const Y1 = 498;
	const gens = $derived(
		fate ? Math.max(50, niceMax(Math.max(...lines.map((l) => l.p.length - 1)))) : DRIFT_GENS
	);
	const sx = $derived(scale([0, gens], [X0, X1]));
	// In the fate phase the y axis is the square root of the share, so a single copy is visible.
	const sy = scale([0, 1], [Y1, Y0]);
	const yv = (p: number) => (fate ? Math.sqrt(p) : p);
	const yTicks = $derived(
		fate ? [0, 0.01, 0.1, 0.25, 0.5, 1].map(Math.sqrt) : [0, 0.25, 0.5, 0.75, 1]
	);
	const yFormat = (v: number) => {
		const p = fate ? v * v : v;
		return `${Math.round(p * 100)}%`;
	};

	const LEAD = 0.5;
	const SWEEP = 10;
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const cursor = $derived(u * gens);

	type Drawn = { d: string; colour: string; width: number; key: number };
	const drawn: Drawn[] = $derived(
		lines.map((l, i) => {
			const upto = Math.min(l.p.length - 1, Math.floor(cursor));
			const pts = l.p.slice(0, upto + 1).map((p, g) => ({ g, p }));
			const ended = upto >= l.p.length - 1 && (l.fixed || l.lost);
			const colour = ended ? (l.fixed ? 'var(--ev-fixed)' : 'var(--ev-lost)') : 'var(--ev-wander)';
			return {
				d: linePath(
					pts,
					(q) => q.g,
					(q) => yv(q.p),
					sx,
					sy
				),
				colour,
				width: ended && l.fixed ? 2.4 : 1.4,
				key: i
			};
		})
	);
	const counts = $derived.by(() => {
		let fixed = 0;
		let lost = 0;
		for (const l of lines) {
			if (cursor >= l.p.length - 1) {
				if (l.fixed) fixed++;
				else if (l.lost) lost++;
			}
		}
		return { fixed, lost, wandering: lines.length - fixed - lost };
	});
	const fmt = (v: number) => v.toLocaleString('en-GB');
	const pct = (v: number) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1)}%`;
	const expected = $derived(kimuraFixation(fateN, s));
	const done = $derived(reduced ? 1 : smoothstep(0.85, 1, u));
	const rule = $derived(
		s === 0 ? `1/2N = 1/${fmt(2 * fateN)} = ${pct(1 / (2 * fateN))}` : `2s = ${pct(2 * s)}`
	);
</script>

<g>
	<Label
		x={X0}
		y={44}
		anchor="start"
		size={14}
		weight={600}
		text={fate
			? `New copies of an allele with ${s === 0 ? 'no advantage' : `a ${Math.round(s * 100)}% advantage`}, in ${fmt(fateN)} individuals`
			: `20 populations of ${fmt(lineN)} individuals: an allele with no effect`}
	/>
	<Axes {sx} {sy} {yTicks} {yFormat} xLabel="generations" />
	<Label
		x={X0 + 8}
		y={Y0 - 10}
		anchor="start"
		text="share of gene copies carrying the allele"
		size={11}
		muted
	/>
	{#each drawn as l (l.key)}
		<path d={l.d} stroke={l.colour} stroke-width={l.width} fill="none" stroke-opacity="0.85" />
	{/each}
	{#if u < 1}
		<line
			x1={sx(cursor)}
			x2={sx(cursor)}
			y1={Y0}
			y2={Y1}
			stroke="var(--stage-line)"
			stroke-dasharray="2 4"
		/>
	{/if}

	{#if fate && fates}
		<Readout
			id="fixed"
			order={1}
			label="Took over"
			value="{fmt(fates.fixed)} of {fmt(TRIALS)} ({pct(fates.fixed / TRIALS)})"
			color="var(--ev-fixed)"
			opacity={done}
		>
			<Label
				x={X1}
				y={74}
				anchor="end"
				text="took over: {fmt(fates.fixed)} of {fmt(TRIALS)} new mutations ({pct(
					fates.fixed / TRIALS
				)})"
				size={14}
				weight={600}
				color="var(--ev-fixed)"
				opacity={done}
			/>
		</Readout>
		<Readout
			id="expected"
			order={2}
			label="Expected"
			value="{pct(expected)} (Kimura) · {rule}"
			opacity={done}
		>
			<Label
				x={X1}
				y={96}
				anchor="end"
				text="expected {pct(expected)} (Kimura’s formula) · rule of thumb {rule}"
				size={12}
				muted
				opacity={done}
			/>
		</Readout>
		<Readout
			id="drawn"
			order={3}
			label="Lines"
			value="60 of the 2,000 drawn; red: lost, green: took over"
		>
			<Label
				x={X0}
				y={74}
				anchor="start"
				text="60 of the 2,000 drawn · red: lost · green: took over"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Readout
			id="counts"
			order={1}
			label="After {Math.round(cursor)} generations"
			value="{counts.fixed} fixed, {counts.lost} lost, {counts.wandering} still varying"
		>
			<Label
				x={X1}
				y={74}
				anchor="end"
				text="{counts.fixed} fixed · {counts.lost} lost · {counts.wandering} still varying"
				size={14}
				weight={600}
			/>
		</Readout>
		<Readout id="key" order={2}>
			<Label
				x={X0}
				y={74}
				anchor="start"
				text="green: fixed (everyone has it) · red: lost"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
