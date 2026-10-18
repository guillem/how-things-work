<script lang="ts">
	/**
	 * A population of the seven strategies over 100 generations (../model.ts `evolve`, on the
	 * points per round of a `tournament` with 20 games per pairing): the shares stacked against
	 * the generation, drawn eight generations a second (reduced motion: all of them), and the
	 * current shares listed on the right.
	 *
	 * Focus (`step.hints.focus`): 'equal' (equal shares, 200-round games, no mistakes), 'few'
	 * (`start` and `rounds`) or 'noise' (equal shares, 200 rounds, `noise`).
	 */
	import { Axes, Label, areaPath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CLASSIC, STRATEGIES, evolve, tournament, type StrategyId } from '../model';
	import { pts, strategyColor } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'equal'));
	/** Axelrod's payoffs (only the payoff table and the tournament edit them). */
	const p = CLASSIC;
	const rounds = $derived(focus === 'few' ? Math.round(Number(params.rounds ?? 200)) : 200);
	const noise = $derived(focus === 'noise' ? Number(params.noise ?? 0.05) : 0);
	const cheats = $derived(focus === 'few' && params.start !== 'equal');
	/** Bottom to top: the strategies that cheat first, then the nice ones. */
	const STACK: StrategyId[] = ['alld', 'random', 'allc', 'grim', 'tft', 'tf2t', 'gtft'];
	const G = 100;
	const run = $derived.by(() => {
		const t0 = tournament(STACK, { rounds, payoffs: p, noise, repeats: 20 });
		const start = STACK.map((id) => (cheats ? (id === 'alld' ? 0.9 : 0.1 / 6) : 1));
		return evolve(t0, start, G);
	});
	const gen = $derived(reduced ? G : Math.min(G, Math.floor(t * 8)));
	const now = $derived(run.shares[gen]);
	const meanScore = $derived(now.reduce((a, x, i) => a + x * run.fitness[gen][i], 0));
	const name = (id: StrategyId) => STRATEGIES.find((s) => s.id === id)?.name ?? id;

	// ---- chart ---------------------------------------------------------------------------------
	const X0 = 90;
	const X1 = 700;
	const sx = scale([0, G], [X0, X1]);
	const sy = scale([0, 100], [500, 96]);
	const cum = $derived(
		run.shares.slice(0, gen + 1).map((x, g) => {
			const c = [0];
			for (const v of x) c.push(c[c.length - 1] + v * 100);
			return { g, c };
		})
	);
	const bands = $derived(
		STACK.map((_, k) =>
			areaPath(
				cum,
				(d) => d.g,
				(d) => d.c[k],
				(d) => d.c[k + 1],
				sx,
				sy
			)
		)
	);
	const pct = (v: number) => (v >= 0.995 ? '100 %' : v < 0.0005 ? '0 %' : `${pts(v * 100, 1)} %`);
	const order = $derived(STACK.map((_, i) => i).sort((a, b) => now[b] - now[a]));
	const lead = $derived(order[0]);
	const setup = $derived(
		[
			cheats ? 'start: 90 % always cheat' : 'start: equal shares',
			`games of ${rounds} round${rounds === 1 ? '' : 's'}`,
			noise > 0 ? `${Math.round(noise * 100)} % of moves come out wrong` : 'no mistakes'
		].join(' · ')
	);
</script>

<g>
	<Readout id="title" order={1} label="Generation" value="{gen} of {G}">
		<Label
			x={24}
			y={34}
			text="A population over {G} generations · generation {gen}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="setup" order={2} label="Setup" value={setup}>
		<Label x={24} y={56} text={setup} size={12} anchor="start" muted />
	</Readout>

	<Axes {sx} {sy} xLabel="generation" yTicks={[0, 25, 50, 75, 100]} yFormat={(v) => `${v} %`} />
	<Label x={X0} y={84} text="share of the population" size={11} anchor="start" muted />
	{#each bands as d, k (STACK[k])}
		<path
			{d}
			fill={strategyColor(STACK[k])}
			opacity="0.82"
			stroke="var(--stage-bg)"
			stroke-width="0.6"
		/>
	{/each}
	<line
		x1={sx(gen)}
		x2={sx(gen)}
		y1={sy(0)}
		y2={sy(100)}
		stroke="var(--stage-ink)"
		stroke-width="1"
		opacity={gen < G ? 0.5 : 0}
	/>

	<!-- shares now, biggest first -->
	<Label x={730} y={104} text="shares now" size={11} anchor="start" muted />
	{#each order as i, k (STACK[i])}
		{@const id = STACK[i]}
		{@const y = 132 + k * 34}
		<rect x={730} y={y - 11} width="14" height="14" rx="3" fill={strategyColor(id)} />
		<Label x={752} {y} text={name(id)} size={12} anchor="start" weight={600} />
		<Label x={936} {y} text={pct(now[i])} size={12} anchor="end" tabular muted={now[i] < 0.0005} />
	{/each}
	<Readout id="mean" order={3} label="Average score" value="{pts(meanScore)} points a round">
		<Label
			x={730}
			y={132 + 7 * 34 + 8}
			text="average score: {pts(meanScore)} a round"
			size={12}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="lead"
		order={4}
		label="Commonest"
		value="{name(STACK[lead])}, {pct(now[lead])}"
		color={strategyColor(STACK[lead])}
	/>
</g>
