<script lang="ts">
	/**
	 * The whole game of noughts and crosses, counted (TTT_COUNTS, checked against the search in
	 * the model tests): the distinct positions by number of marks on the board (left), and the
	 * complete games by the move they end on, split by who wins (right). The bars grow in over the
	 * first two seconds.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TTT_COUNTS } from '../presets';
	import { fmt } from './shared';

	let { t, reduced }: StageProps = $props();
	const grow = $derived(reduced ? 1 : smoothstep(0.2, 1.8, t));

	// Left: positions by marks.
	const L = { x: 96, y: 170, w: 330, h: 300 };
	const lsx = scale([-0.6, 9.6], [L.x, L.x + L.w]);
	const lsy = scale([0, 1600], [L.y + L.h, L.y]);
	// Right: games by length.
	const R = { x: 586, y: 170, w: 330, h: 300 };
	const rsx = scale([4.4, 9.6], [R.x, R.x + R.w]);
	const rsy = scale([0, 130_000], [R.y + R.h, R.y]);
	const kinds = [
		{ key: 'x', label: 'X wins', color: 'var(--gt-x)' },
		{ key: 'o', label: 'O wins', color: 'var(--gt-o)' },
		{ key: 'draw', label: 'draw', color: 'var(--gt-draw)' }
	] as const;
</script>

<g>
	<Readout id="count-games" order={1} label="Possible games" value={fmt(TTT_COUNTS.games)}>
		<Label
			x={48}
			y={58}
			text="{fmt(TTT_COUNTS.games)} possible games"
			size={20}
			weight={700}
			anchor="start"
		/>
	</Readout>
	<Readout
		id="count-positions"
		order={2}
		label="Different positions"
		value={fmt(TTT_COUNTS.positions)}
	>
		<Label
			x={48}
			y={86}
			text="through {fmt(TTT_COUNTS.positions)} different positions · {fmt(
				TTT_COUNTS.treeNodes
			)} in the full tree"
			size={13}
			muted
			anchor="start"
		/>
	</Readout>
	<Readout id="count-value" order={3} label="Perfect play" value="a draw">
		<rect
			x={700}
			y={36}
			width={228}
			height={58}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label x={814} y={60} text="Perfect play by both:" size={12} muted halo={false} />
		<Label
			x={814}
			y={82}
			text="a draw"
			size={18}
			weight={700}
			color="var(--gt-draw-text)"
			halo={false}
		/>
	</Readout>

	<!-- left chart -->
	<Readout id="count-left-title">
		<Label
			x={L.x}
			y={L.y - 26}
			text="Different positions, by marks on the board"
			size={13}
			weight={700}
			anchor="start"
		/>
	</Readout>
	<Axes
		sx={lsx}
		sy={lsy}
		xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
		yTicks={[0, 400, 800, 1200, 1600]}
		xLabel="marks"
		yLabel="positions"
	/>
	{#each TTT_COUNTS.positionsByMarks as n, k (k)}
		{@const h = (L.y + L.h - lsy(n)) * grow}
		<rect
			x={lsx(k) - 12}
			y={L.y + L.h - h}
			width="24"
			height={h}
			rx="3"
			fill="var(--accent)"
			opacity="0.75"
		/>
		{#if grow > 0.9}
			<Readout id="count-l-{k}">
				<Label x={lsx(k)} y={L.y + L.h - h - 7} text={fmt(n)} size={10} muted />
			</Readout>
		{/if}
	{/each}

	<!-- right chart -->
	<Readout id="count-right-title">
		<Label
			x={R.x}
			y={R.y - 26}
			text="Complete games, by the move they end on"
			size={13}
			weight={700}
			anchor="start"
		/>
	</Readout>
	<Axes
		sx={rsx}
		sy={rsy}
		xTicks={[5, 6, 7, 8, 9]}
		yTicks={[0, 25_000, 50_000, 75_000, 100_000, 125_000]}
		yFormat={(v) => (v === 0 ? '0' : `${v / 1000}k`)}
		xLabel="move"
		yLabel="games"
	/>
	{#each TTT_COUNTS.gamesByLength as row (row.moves)}
		{@const base = R.y + R.h}
		{@const hx = (base - rsy(row.x)) * grow}
		{@const ho = (base - rsy(row.o)) * grow}
		{@const hd = (base - rsy(row.draw)) * grow}
		<rect
			x={rsx(row.moves) - 20}
			y={base - hx}
			width="40"
			height={hx}
			fill="var(--gt-x)"
			opacity="0.85"
		/>
		<rect
			x={rsx(row.moves) - 20}
			y={base - hx - ho}
			width="40"
			height={ho}
			fill="var(--gt-o)"
			opacity="0.85"
		/>
		<rect
			x={rsx(row.moves) - 20}
			y={base - hx - ho - hd}
			width="40"
			height={hd}
			fill="var(--gt-draw)"
			opacity="0.85"
		/>
		{#if grow > 0.9}
			<Readout id="count-r-{row.moves}">
				<Label
					x={rsx(row.moves)}
					y={base - hx - ho - hd - 7}
					text={fmt(row.x + row.o + row.draw)}
					size={10}
					muted
				/>
			</Readout>
		{/if}
	{/each}
	{#each kinds as k, i (k.key)}
		<Readout id="count-key-{k.key}" order={10 + i} label={k.label} color={k.color}>
			<rect x={R.x + 10} y={R.y + 4 + i * 20} width="12" height="12" rx="2" fill={k.color} />
			<Label x={R.x + 30} y={R.y + 14 + i * 20} text={k.label} size={12} anchor="start" />
		</Readout>
	{/each}
	<Readout id="count-note">
		<Label
			x={L.x}
			y={556}
			text="The quickest win takes 5 moves: X's third mark. Games that fill the board end on move 9."
			size={11}
			muted
			anchor="start"
		/>
	</Readout>
</g>
