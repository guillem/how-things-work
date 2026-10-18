<script lang="ts">
	/**
	 * Nowak & May's spatial game (../model.ts `gridStep`) on a 59 × 59 grid that wraps round, with
	 * temptation `b`: five generations a second (reduced motion: generation 200), coloured as in
	 * their paper (blue: stayed a cooperator, red: stayed a cheat, green: just became a
	 * cooperator, yellow: just became a cheat). Each colour is one path of cell squares, to keep
	 * the drawing small. Right: the share of cooperators against the generation.
	 *
	 * Focus (`step.hints.focus`): 'random' (one cell in ten a cheat at the start) or 'one' (a
	 * single cheat in the middle).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cooperatorShare, gridRun, oneDefector, randomGrid, type Grid } from '../model';
	import { pts } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const one = $derived(step.hints?.focus === 'one');
	const b = $derived(Number(params.b ?? 1.85));
	const N = 59;
	const G = 300;
	const run = $derived(gridRun(one ? oneDefector(N) : randomGrid(N, 0.9), b, G));
	const shares = $derived(run.map(cooperatorShare));
	const gen = $derived(reduced ? 200 : Math.min(G, Math.floor(t * 5)));

	// ---- the grid, four paths ------------------------------------------------------------------
	const X0 = 24;
	const Y0 = 84;
	const C = 8;
	/** 0 C→C, 1 D→D, 2 D→C, 3 C→D. */
	const KINDS = ['var(--gt-cc)', 'var(--gt-dd)', 'var(--gt-dc)', 'var(--gt-cd)'];
	function paths(now: Grid, before: Grid): string[] {
		const out = ['', '', '', ''];
		const kind = (k: number) => {
			const c = now.cells[k];
			const was = before.cells[k];
			return c ? (was ? 0 : 2) : was ? 3 : 1;
		};
		for (let y = 0; y < N; y++) {
			let x = 0;
			while (x < N) {
				const k = kind(y * N + x);
				let e = x + 1;
				while (e < N && kind(y * N + e) === k) e++;
				out[k] += `M${X0 + x * C} ${Y0 + y * C}h${(e - x) * C}v${C}h${-(e - x) * C}z`;
				x = e;
			}
		}
		return out;
	}
	const d = $derived(paths(run[gen], run[Math.max(0, gen - 1)]));

	// ---- the share of cooperators ----------------------------------------------------------------
	const sx = scale([0, G], [600, 930]);
	const sy = scale([0, 1], [380, 110]);
	const trace = $derived(
		linePath(
			shares.slice(0, gen + 1).map((v, g) => ({ g, v })),
			(q) => q.g,
			(q) => q.v,
			sx,
			sy
		)
	);
	const NM = 12 * Math.log(2) - 8;
	const regime = $derived(
		b < 1.8
			? 'b < 1.8: cooperators hold most of the grid'
			: b < 2
				? '1.8 < b < 2: neither side wins'
				: 'b > 2: cheats spread'
	);
	const legend = [
		{ c: KINDS[0], t: 'cooperator, stayed' },
		{ c: KINDS[1], t: 'cheat, stayed' },
		{ c: KINDS[2], t: 'just became a cooperator' },
		{ c: KINDS[3], t: 'just became a cheat' }
	];
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Grid"
		value="b = {b}, generation {gen}, {Math.round(shares[gen] * 100)} % cooperators"
	>
		<Label
			x={24}
			y={34}
			text="Cooperators and cheats on a grid · b = {b} · generation {gen}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Label
		x={24}
		y={58}
		text={one
			? 'started as all cooperators but one cheat in the middle'
			: 'started with one cell in ten a cheat, at random'}
		size={12}
		anchor="start"
		muted
	/>

	<rect
		x={X0 - 1}
		y={Y0 - 1}
		width={N * C + 2}
		height={N * C + 2}
		fill="none"
		stroke="var(--border)"
	/>
	{#each d as path, k (k)}
		<path d={path} fill={KINDS[k]} />
	{/each}

	<Axes
		{sx}
		{sy}
		xLabel="generation"
		xTicks={[0, 100, 200, 300]}
		yTicks={[0, 0.5, 1]}
		yFormat={(v) => `${v * 100} %`}
	/>
	<Label x={600} y={98} text="share of cooperators" size={11} anchor="start" muted />
	<line
		x1={600}
		x2={930}
		y1={sy(NM)}
		y2={sy(NM)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Label
		x={930}
		y={sy(NM) + 16}
		text="≈ 32 %, Nowak & May (1.8 < b < 2)"
		size={11}
		anchor="end"
		muted
	/>
	<path d={trace} fill="none" stroke="var(--gt-cc)" stroke-width="2.2" stroke-linejoin="round" />
	<Readout id="share" order={2} label="Cooperators" value="{pts(shares[gen] * 100, 1)} %">
		<Label
			x={600}
			y={448}
			text="cooperators now: {pts(shares[gen] * 100, 1)} %"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="regime" order={3} label="Temptation" value={regime}>
		<Label x={600} y={472} text={regime} size={12} anchor="start" muted />
	</Readout>
	{#each legend as l, i (l.t)}
		<rect
			x={600 + (i % 2) * 170}
			y={498 + Math.floor(i / 2) * 26}
			width="14"
			height="14"
			rx="2"
			fill={l.c}
		/>
		<Label
			x={620 + (i % 2) * 170}
			y={510 + Math.floor(i / 2) * 26}
			text={l.t}
			size={11}
			anchor="start"
		/>
	{/each}
</g>
