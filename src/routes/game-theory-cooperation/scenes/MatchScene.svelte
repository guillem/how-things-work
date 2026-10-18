<script lang="ts">
	/**
	 * One repeated game of 40 rounds between two strategies (../model.ts `playMatch`): each
	 * player's moves as a row of coins, revealed four rounds a second (reduced motion: all of
	 * them), and both running totals below.
	 *
	 * Focus (`step.hints.focus`): 'match' (players `matchA` and `matchB`, no mistakes) or 'echo'
	 * (two copies of `echo` with `noise`; a ring marks a move that came out wrong, and the
	 * long-run points per round of the pair are quoted from 20 games of 200 rounds).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { playMatch, strategy, tournament, type StrategyId } from '../model';
	import { moveColor, payoffsOf, pts } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const echo = $derived(step.hints?.focus === 'echo');
	const ROUNDS = 40;
	/** Seeds that show a typical game: with 5 % mistakes, one early slip and a long echo. */
	const SEED = 3;
	const ECHO_SEED = 25;
	const p = $derived(payoffsOf(params));
	const idA = $derived(
		String(echo ? (params.echo ?? 'tft') : (params.matchA ?? 'tft')) as StrategyId
	);
	const idB = $derived(echo ? idA : (String(params.matchB ?? 'alld') as StrategyId));
	const noise = $derived(echo ? Number(params.noise ?? 0.05) : 0);
	const A = $derived(strategy(idA));
	const B = $derived(strategy(idB));
	const m = $derived(
		playMatch(idA, idB, { rounds: ROUNDS, payoffs: p, noise, seed: echo ? ECHO_SEED : SEED })
	);
	/** The long run, for the echo step: points per round of the pair, over 20 games of 200 rounds. */
	const longRun = $derived(
		echo ? tournament([idA], { rounds: 200, noise, payoffs: p, repeats: 20 }).score[0] : 0
	);
	const shown = $derived(reduced ? ROUNDS : Math.min(ROUNDS, Math.floor(t * 4) + 1));
	const slipped = $derived(new Set(m.slips.map((s) => `${s.player}:${s.round}`)));

	// ---- layout --------------------------------------------------------------------------------
	const X0 = 170;
	const DX = 19.4;
	const YA = 140;
	const YB = 196;
	const CR = 8;
	const xOf = (r: number) => X0 + r * DX;
	const cumulative = (xs: number[]) => {
		const out = [0];
		for (const x of xs) out.push(out[out.length - 1] + x);
		return out;
	};
	const cumA = $derived(cumulative(m.pa));
	const cumB = $derived(cumulative(m.pb));
	/** Up to the score of a pair that cooperates every round, or higher if a player got more. */
	const yMax = $derived(
		Math.ceil(Math.max(10, p.R * ROUNDS, cumA[ROUNDS], cumB[ROUNDS]) / 20) * 20
	);
	const sx = scale([0, ROUNDS], [X0, 880]);
	const sy = $derived(scale([0, yMax], [520, 290]));
	const series = (c: number[]) => c.slice(0, shown + 1).map((v, r) => ({ r, v }));
	const pathA = $derived(
		linePath(
			series(cumA),
			(d) => d.r,
			(d) => d.v,
			sx,
			sy
		)
	);
	const pathB = $derived(
		linePath(
			series(cumB),
			(d) => d.r,
			(d) => d.v,
			sx,
			sy
		)
	);
	const sa = $derived(cumA[shown]);
	const sb = $derived(cumB[shown]);
	const same = $derived(idA === idB);
	const nameA = $derived(same ? `${A.name} 1` : A.name);
	const nameB = $derived(same ? `${B.name} 2` : B.name);
	const lead = $derived(
		sa === sb ? 'level scores' : `${sa > sb ? nameA : nameB} ahead by ${pts(Math.abs(sa - sb))}`
	);
	/** Keep the two end labels apart. */
	const labelY = $derived.by(() => {
		let ya = sy(sa) + 4;
		let yb = sy(sb) + 4;
		if (Math.abs(ya - yb) < 16) {
			const mid = (ya + yb) / 2;
			const up = sa >= sb;
			ya = mid + (up ? -8 : 8);
			yb = mid + (up ? 8 : -8);
		}
		return { ya, yb };
	});
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="One game"
		value="{nameA} vs {nameB}, round {shown} of {ROUNDS}"
	>
		<Label
			x={24}
			y={34}
			text="{A.name} vs {B.name} · round {shown} of {ROUNDS}{echo
				? ` · ${Math.round(noise * 100)} % of moves come out wrong`
				: ''}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Label x={24} y={58} text="{A.name}: {A.rule}" size={12} anchor="start" muted />
	{#if !same}
		<Label x={24} y={76} text="{B.name}: {B.rule}" size={12} anchor="start" muted />
	{/if}

	<!-- coins -->
	<Label
		x={X0 - 22}
		y={YA + 4}
		text={nameA}
		size={13}
		weight={700}
		anchor="end"
		color="var(--gt-a)"
	/>
	<Label
		x={X0 - 22}
		y={YB + 4}
		text={nameB}
		size={13}
		weight={700}
		anchor="end"
		color="var(--gt-b)"
	/>
	{#each [0, 9, 19, 29, 39] as r (r)}
		<Label x={xOf(r)} y={YA - 20} text={String(r + 1)} size={10} muted />
	{/each}
	{#each Array.from({ length: shown }, (_, r) => r) as r (r)}
		{#each [{ mv: m.a[r], y: YA, k: 0 }, { mv: m.b[r], y: YB, k: 1 }] as c (c.k)}
			<circle cx={xOf(r)} cy={c.y} r={CR} fill={moveColor(c.mv)} />
			{#if slipped.has(`${c.k}:${r}`)}
				<circle
					cx={xOf(r)}
					cy={c.y}
					r={CR + 4}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.8"
				/>
			{/if}
		{/each}
	{/each}
	<g transform="translate({X0} 238)">
		<circle cx="0" cy="0" r="6" fill="var(--gt-coop)" />
		<Label x={12} y={4} text="cooperates" size={11} anchor="start" muted />
		<circle cx="100" cy="0" r="6" fill="var(--gt-cheat)" />
		<Label x={112} y={4} text="cheats" size={11} anchor="start" muted />
		{#if echo}
			<circle cx="190" cy="0" r="8" fill="none" stroke="var(--stage-ink)" stroke-width="1.6" />
			<Label x={204} y={4} text="a move that came out wrong" size={11} anchor="start" muted />
		{/if}
	</g>

	<!-- running totals -->
	<Axes {sx} {sy} xLabel="round" xTicks={[0, 10, 20, 30, 40]} yTicks={[0, yMax / 2, yMax]} />
	<Label x={X0} y={280} text="points so far" size={11} anchor="start" muted />
	<line
		x1={sx(0)}
		y1={sy(0)}
		x2={sx(ROUNDS)}
		y2={sy(p.R * ROUNDS)}
		stroke="var(--gt-coop)"
		stroke-width="1.2"
		stroke-dasharray="5 5"
		opacity="0.8"
	/>
	<Label
		x={sx(ROUNDS) - 4}
		y={sy(p.R * ROUNDS) - 10}
		text="cooperating every round: {p.R} a round each"
		size={11}
		anchor="end"
		color="var(--gt-coop)"
	/>
	{#if !same}
		<path d={pathB} fill="none" stroke="var(--gt-b)" stroke-width="2.5" stroke-linejoin="round" />
	{/if}
	<path d={pathA} fill="none" stroke="var(--gt-a)" stroke-width="2.5" stroke-linejoin="round" />
	{#if same}
		<path
			d={pathB}
			fill="none"
			stroke="var(--gt-b)"
			stroke-width="2.5"
			stroke-dasharray="6 5"
			stroke-linejoin="round"
		/>
	{/if}
	<Readout id="a" order={2} label={nameA} value="{sa} points" color="var(--gt-a)">
		<Label
			x={sx(shown) + 10}
			y={labelY.ya}
			text={String(sa)}
			size={13}
			weight={700}
			anchor="start"
			color="var(--gt-a)"
			tabular
		/>
	</Readout>
	<Readout id="b" order={3} label={nameB} value="{sb} points" color="var(--gt-b)">
		<Label
			x={sx(shown) + 10}
			y={labelY.yb}
			text={String(sb)}
			size={13}
			weight={700}
			anchor="start"
			color="var(--gt-b)"
			tabular
		/>
	</Readout>

	<Readout
		id="summary"
		order={4}
		label="So far"
		value="{lead}; {pts(sa / shown)} and {pts(sb / shown)} points per round"
	>
		<Label
			x={24}
			y={578}
			text="{lead} · per round: {nameA} {pts(sa / shown)}, {nameB} {pts(sb / shown)}{echo
				? ` · in the long run, a pair of ${A.name.toLowerCase()} scores ${pts(longRun)} a round each (no mistakes: ${p.R})`
				: ''}"
			size={13}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
</g>
