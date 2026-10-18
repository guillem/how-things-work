<script lang="ts">
	/**
	 * The logit-lens grid of the chosen prompt (see LensGrid), with a card for the selected cell:
	 * its three best guesses, and a chart of the final answer's probability down that column, row
	 * by row. Phase `lens`: the selected column is in focus and the others dimmed. Phase `grid`:
	 * every column at full strength. Phase `caveat`: the early rows are dimmed, with the reason.
	 *
	 * A bright band sweeps down the grid, one row at a time (a function of t), to show the reading
	 * at each depth; under reduced motion there is no band and the frame is complete.
	 */
	import { untrack } from 'svelte';
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { answerAt, BLOCKS, finalAt, grid, lensAt, ROWS, tokenLabel, words } from '../lens';
	import { colOf, rowOf } from '../steps';
	import LensGrid from './LensGrid.svelte';
	import { pct, promptOf, q, rowName, short } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'grid'));
	const p = $derived(promptOf(params));
	const ws = $derived(words(p));
	const cells = $derived(grid(p));
	const answers = $derived(ws.map((_, i) => finalAt(p, i)));
	const row = $derived(rowOf(params));
	const col = $derived(colOf(params) - 1);
	// The column slider's value may sit past the end of a shorter prompt: show it where it is.
	const shownCol = $derived(Math.min(col, ws.length - 1));
	$effect(() => {
		const c = shownCol + 1;
		const raw = Number(params.col);
		untrack(() => {
			if (Number.isFinite(raw) && raw !== c) setParam('col', c);
		});
	});

	const guesses = $derived(lensAt(p, row, shownCol));
	const ans = $derived(answers[shownCol]);
	const curve = $derived(Array.from({ length: ROWS }, (_, r) => answerAt(p, r, shownCol)));

	const GRID = { x: 112, y: 74, w: 832, rowH: 27 };
	const sweep = $derived(reduced ? -1 : Math.floor(cycle(t, 13) * (ROWS + 3)));
	const rowOpacity = $derived((r: number) =>
		phase === 'caveat' ? (r <= 6 ? 0.4 : 0.4 + (0.6 * (r - 6)) / 6) : 1
	);

	// ---- the card
	const CARD = { x: 16, y: 438, w: 928, h: 150 };
	const CH = { x: 600, y: 470, w: 320, h: 84 };
	const barW = CH.w / ROWS;
</script>

<g>
	<Label
		x={16}
		y={30}
		anchor="start"
		size={15}
		weight={650}
		text={phase === 'caveat'
			? 'The early rows: a reader made for the last vector, used too early'
			: 'The logit lens: the next-token guess after every block, for every token'}
	/>

	{#if sweep >= 0 && sweep < ROWS}
		<rect
			x={GRID.x - 104}
			y={GRID.y + sweep * GRID.rowH}
			width={GRID.w + 104}
			height={GRID.rowH}
			fill="var(--rs-sweep)"
			opacity="0.5"
		/>
	{/if}

	<LensGrid
		words={ws}
		{cells}
		{answers}
		x={GRID.x}
		y={GRID.y}
		w={GRID.w}
		rowH={GRID.rowH}
		selected={{ row, col: shownCol }}
		focusCol={phase === 'lens' ? shownCol : null}
		{rowOpacity}
		onpick={(r: number, c: number) => {
			setParam('row', r);
			setParam('col', c + 1);
		}}
	/>

	<!-- the card for the selected cell -->
	<Readout id="card-bg">
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="cell"
		order={1}
		label="After {rowName(row)}, after {q(ws[shownCol])}"
		value={guesses.map((g) => `${tokenLabel(g.token)} ${pct(g.p)}`).join(' · ')}
	>
		<Label
			x={CARD.x + 16}
			y={CARD.y + 24}
			anchor="start"
			size={13}
			weight={650}
			halo={false}
			text="Read after {rowName(row)}, after {q(ws[shownCol])}:"
		/>
		{#each guesses as g, k (k)}
			<rect
				x={CARD.x + 130}
				y={CARD.y + 38 + k * 24}
				width={Math.max(1, g.p * 380)}
				height="16"
				rx="3"
				fill="var(--rs-cell)"
				opacity="0.75"
			/>
			<Label
				x={CARD.x + 120}
				y={CARD.y + 51 + k * 24}
				anchor="end"
				size={12.5}
				weight={g.token === ans ? 700 : 400}
				color={g.token === ans ? 'var(--rs-answer)' : undefined}
				halo={false}
				text={short(g.token, 14)}
			/>
			<Label
				x={CARD.x + 136 + Math.max(1, g.p * 380)}
				y={CARD.y + 51 + k * 24}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text={pct(g.p)}
			/>
		{/each}
	</Readout>
	<Readout
		id="note"
		order={2}
		label={phase === 'caveat' ? 'Dimmed' : 'Bold'}
		value={phase === 'caveat'
			? 'the early rows, where the lens is least reliable'
			: 'the guess the model finally makes there'}
	>
		<Label
			x={CARD.x + 16}
			y={CARD.y + CARD.h - 14}
			anchor="start"
			size={11}
			muted
			halo={false}
			text={phase === 'caveat'
				? 'dimmed: the early rows, which the final layer norm and unembedding were never trained to read'
				: 'bold: the model’s final guess after that token · fill: the guess’s probability'}
		/>
	</Readout>

	<!-- the final answer's probability down the selected column -->
	<Readout
		id="curve"
		order={3}
		label="{q(ans)} by row"
		value="{pct(curve[0])} at the embedding, {pct(Math.max(...curve))} at most, {pct(
			curve[BLOCKS]
		)} at the output"
	>
		<Label
			x={CH.x}
			y={CARD.y + 24}
			anchor="start"
			size={12}
			weight={600}
			halo={false}
			text="probability of {q(ans)}, the final answer, row by row"
		/>
		<line x1={CH.x} y1={CH.y + CH.h} x2={CH.x + CH.w} y2={CH.y + CH.h} stroke="var(--stage-line)" />
		{#each curve as v, r (r)}
			<rect
				x={CH.x + r * barW + 2}
				y={CH.y + CH.h - Math.max(1, v * CH.h)}
				width={barW - 4}
				height={Math.max(1, v * CH.h)}
				rx="2"
				fill="var(--rs-answer)"
				opacity={r === row ? 1 : 0.55}
			/>
		{/each}
		<Label x={CH.x + barW / 2} y={CH.y + CH.h + 14} size={10.5} muted halo={false} text="emb." />
		<Label x={CH.x + 12.5 * barW} y={CH.y + CH.h + 14} size={10.5} muted halo={false} text="12" />
		<Label
			x={CH.x + 6.5 * barW}
			y={CH.y + CH.h + 14}
			size={10.5}
			muted
			halo={false}
			text="block 6"
		/>
		<Label x={CH.x - 6} y={CH.y + 4} anchor="end" size={10.5} muted halo={false} text="100%" />
	</Readout>
</g>
