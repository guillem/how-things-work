<script lang="ts">
	/**
	 * Axelrod's round robin (../model.ts `tournament`): every entrant plays every other and a copy
	 * of itself, 10 games per pairing. Left: each row's points per round against each column,
	 * filled in pairing by pairing (reduced motion: all at once). Right: the entrants ranked by
	 * their average, with the number of games each won.
	 *
	 * Focus (`step.hints.focus`): 'all' (all seven, `rounds` per game), 'pick' (the entrants
	 * switched on with the `in_<id>` toggles, 200 rounds) or 'short' (all seven, `shortRounds`).
	 */
	import { Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ALL_IDS, CLASSIC, STRATEGIES, tournament, type StrategyId } from '../model';
	import { payoffsOf, pts, strategyColor } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'all'));
	/** The reader's payoffs on the first tournament step; Axelrod's on the others. */
	const p = $derived(focus === 'all' ? payoffsOf(params) : CLASSIC);
	const rounds = $derived(
		focus === 'pick'
			? 200
			: Math.round(Number(focus === 'short' ? (params.shortRounds ?? 3) : (params.rounds ?? 200)))
	);
	const ids = $derived(
		focus === 'pick' ? ALL_IDS.filter((id) => params[`in_${id}`] !== false) : [...ALL_IDS]
	);
	const REPEATS = 10;
	const run = $derived(
		ids.length > 0 ? tournament(ids, { rounds, payoffs: p, repeats: REPEATS }) : null
	);
	const n = $derived(ids.length);
	const name = (id: StrategyId) => STRATEGIES.find((s) => s.id === id)?.name ?? id;

	// ---- reveal --------------------------------------------------------------------------------
	const clock = $derived(reduced ? 99 : t);
	/** Pairings revealed so far (row-major over the upper triangle, 4 a second). */
	const pairs = $derived((n * (n + 1)) / 2);
	const revealed = $derived(Math.min(pairs, Math.floor(clock * 4)));
	const pairIndex = (i: number, j: number) => {
		const [a, b] = i <= j ? [i, j] : [j, i];
		return a * n - (a * (a - 1)) / 2 + (b - a);
	};
	const barsIn = $derived(smoothstep(pairs / 4, pairs / 4 + 1.2, clock));

	// ---- layout --------------------------------------------------------------------------------
	const HX = 176;
	const HY = 160;
	const CELL = $derived(Math.min(46, 330 / Math.max(1, n)));
	const top = $derived(Math.max(1, p.T, p.R));
	const RX = 540;
	const BX0 = 700;
	const BX1 = 880;
	const sb = $derived(scale([0, Math.max(top * 0.6, ...(run?.score ?? [1]))], [BX0, BX1]));
	const rowY = (k: number) => HY + 8 + k * 50;
	const games = $derived((n - 1) * REPEATS);
	const winner = $derived(run ? run.ids[run.ranking[0]] : null);
	const tftIndex = $derived(ids.indexOf('tft'));
	const alldIndex = $derived(ids.indexOf('alld'));
	const place = (i: number) => (run ? run.ranking.indexOf(i) + 1 : 0);
	const ordinal = (k: number) => (k === 1 ? '1st' : k === 2 ? '2nd' : k === 3 ? '3rd' : `${k}th`);
	const left = $derived(ALL_IDS.filter((id) => !ids.includes(id)));
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Round robin"
		value="{n} strategies, {rounds}-round games, payoffs {p.T} {p.R} {p.P} {p.S}"
	>
		<Label
			x={24}
			y={34}
			text="Round robin · {n} strateg{n === 1 ? 'y' : 'ies'} · games of {rounds} round{rounds === 1
				? ''
				: 's'} · payoffs {p.T}, {p.R}, {p.P}, {p.S}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	{#if run}
		<!-- table of points per round -->
		<Label
			x={HX}
			y={HY + n * CELL + 22}
			text="points per round: row player against column player"
			size={11}
			anchor="start"
			muted
		/>
		{#each run.ids as id, j (id)}
			<Label
				x={HX + (j + 0.5) * CELL + 4}
				y={HY - 10}
				text={name(id)}
				size={11}
				anchor="start"
				rotate={-50}
				color={strategyColor(id)}
			/>
		{/each}
		{#each run.ids as id, i (id)}
			<Label
				x={HX - 8}
				y={HY + (i + 0.5) * CELL + 4}
				text={name(id)}
				size={12}
				anchor="end"
				weight={600}
				color={strategyColor(id)}
			/>
			{#each run.ids as jd, j (jd)}
				{@const v = run.perRound[i][j]}
				{@const on = pairIndex(i, j) < revealed}
				<rect
					x={HX + j * CELL + 1}
					y={HY + i * CELL + 1}
					width={CELL - 2}
					height={CELL - 2}
					rx="4"
					fill="var(--gt-heat)"
					fill-opacity={on ? 0.08 + (0.8 * Math.max(0, v)) / top : 0}
					stroke="var(--border)"
					stroke-width="0.8"
				/>
				{#if on}
					<text
						x={HX + (j + 0.5) * CELL}
						y={HY + (i + 0.5) * CELL + 4}
						text-anchor="middle"
						font-size="11"
						style="font-variant-numeric: tabular-nums"
						fill={v / top > 0.55 ? 'var(--gt-heat-ink)' : 'var(--stage-ink)'}>{pts(v, 1)}</text
					>
				{/if}
			{/each}
		{/each}

		<!-- ranking -->
		<Label x={RX} y={HY - 14} text="average points per round" size={11} anchor="start" muted />
		{#each run.ranking as i, k (run.ids[i])}
			{@const id = run.ids[i]}
			{@const y = rowY(k)}
			<Label
				x={RX}
				y={y + 6}
				text="{k + 1}. {name(id)}"
				size={13}
				weight={600}
				anchor="start"
				color={strategyColor(id)}
			/>
			<Label
				x={RX + 16}
				y={y + 22}
				text="won {run.wins[i]} of {games} games"
				size={11}
				anchor="start"
				muted
			/>
			<rect
				x={BX0}
				y={y - 8}
				width={Math.max(0, (sb(run.score[i]) - BX0) * barsIn)}
				height="18"
				rx="4"
				fill={strategyColor(id)}
				opacity="0.85"
			/>
			<Label
				x={BX0 + (sb(run.score[i]) - BX0) * barsIn + 8}
				y={y + 6}
				text={pts(run.score[i])}
				size={13}
				weight={600}
				anchor="start"
				opacity={barsIn}
				tabular
			/>
		{/each}
		{#if left.length > 0}
			<Label
				x={RX}
				y={rowY(n) + 6}
				text="not entered: {left.map(name).join(', ')}"
				size={11}
				anchor="start"
				muted
			/>
		{/if}

		<!-- phone rows -->
		{#if winner}
			<Readout
				id="winner"
				order={2}
				label="First"
				value="{name(winner)}, {pts(run.score[run.ranking[0]])} a round"
				color={strategyColor(winner)}
				opacity={barsIn}
			/>
		{/if}
		{#if tftIndex >= 0}
			<Readout
				id="tft"
				order={3}
				label="Tit for tat"
				value="{ordinal(place(tftIndex))}, won {run.wins[tftIndex]} of {games} games"
				color={strategyColor('tft')}
				opacity={barsIn}
			/>
		{/if}
		{#if alldIndex >= 0}
			<Readout
				id="alld"
				order={4}
				label="Always cheat"
				value="{ordinal(place(alldIndex))}, won {run.wins[alldIndex]} of {games} games"
				color={strategyColor('alld')}
				opacity={barsIn}
			/>
		{/if}
	{:else}
		<Label x={480} y={300} text="Switch on at least one strategy." size={15} />
	{/if}
</g>
