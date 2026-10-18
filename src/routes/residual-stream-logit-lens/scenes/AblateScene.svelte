<script lang="ts">
	/**
	 * Zero-ablation. Phase `grid`: the logit-lens grid of the run with the chosen component (the
	 * `block` and `part` controls, switched off by `off`) replaced by zeros; cells whose guess
	 * differs from the clean run are outlined, a line marks where the switched-off block sits (the
	 * rows above it cannot change), and the card compares the final next-token guesses with and
	 * without it. Phase `effects`: all 24 single-component runs as bars, the change in the answer's
	 * probability for each, block 1 in grey (a large effect on every prompt); a click picks a bar.
	 *
	 * Motion: the changed cells' outlines breathe (a function of t), the bars grow in over the
	 * first two seconds; reduced motion shows the finished frame.
	 */
	import { Label, smoothstep, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		componentName,
		effects,
		finalAt,
		grid,
		nextTokens,
		pAnswer,
		ROWS,
		words,
		type Component
	} from '../lens';
	import { blockOf, partOf } from '../steps';
	import LensGrid from './LensGrid.svelte';
	import { pct, promptOf, q, short, signed } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(step.hints?.phase === 'effects' ? 'effects' : 'grid');
	const p = $derived(promptOf(params));
	const ws = $derived(words(p));
	const answers = $derived(ws.map((_, i) => finalAt(p, i)));
	const chosen = $derived<Component>({ block: blockOf(params), part: partOf(params) });
	const isOff = $derived(phase === 'effects' || params.off !== false);
	const offC = $derived(isOff ? chosen : null);
	const clean = $derived(grid(p));
	const cells = $derived(grid(p, offC));
	const changed = $derived(cells.map((row, r) => row.map((c, i) => c.token !== clean[r][i].token)));
	const nChanged = $derived(changed.flat().filter(Boolean).length);
	const before = $derived(nextTokens(p));
	const after = $derived(nextTokens(p, offC));
	const answer = $derived(before[0].token);
	const breathe = $derived(reduced ? 1 : 0.75 + 0.25 * wave(t, 2.4));

	// ---- grid phase layout
	const GRID = { x: 112, y: 66, w: 832, rowH: 24 };
	const CARD = { x: 16, y: 396, w: 928, h: 192 };
	const lineY = $derived(GRID.y + chosen.block * GRID.rowH);

	// ---- effects phase layout
	const all = $derived(effects(p));
	const CHART = { x: 96, y: 70, w: 840, zero: 140, scale: 3.2 };
	const slot = CHART.w / 12;
	const grow = $derived(reduced ? 1 : smoothstep(0, 2, t));
	const barX = (block: number, part: string) =>
		CHART.x + (block - 1) * slot + (part === 'attn' ? 8 : slot / 2 + 1);
	const barW = slot / 2 - 9;
	const barColor = (block: number, part: string) =>
		block === 1 ? 'var(--rs-grey)' : part === 'attn' ? 'var(--rs-attn)' : 'var(--rs-mlp)';
	const yOf = (change: number) => CHART.zero - change * 100 * CHART.scale * grow;
	const sel = $derived(all.find((e) => e.block === chosen.block && e.part === chosen.part)!);
	const worst = $derived(
		all.filter((e) => e.block > 1).reduce((a, b) => (b.change < a.change ? b : a))
	);

	function pick(c: Component) {
		setParam('block', c.block);
		setParam('part', c.part);
	}
	const list = (gs: { token: string; p: number }[]) =>
		gs
			.slice(0, 3)
			.map((g) => `${q(g.token)} ${pct(g.p)}`)
			.join(', ');
</script>

<g>
	{#if phase === 'grid'}
		<Label
			x={16}
			y={30}
			anchor="start"
			size={15}
			weight={650}
			text={offC
				? `${componentName(chosen)} switched off: its output replaced by zeros`
				: `${componentName(chosen)} on: the clean run`}
		/>
		<LensGrid
			words={ws}
			{cells}
			{answers}
			x={GRID.x}
			y={GRID.y}
			w={GRID.w}
			rowH={GRID.rowH}
			changed={offC ? changed : null}
			rowOpacity={(r) => (offC && r < chosen.block ? 0.55 : 1)}
		/>
		{#if offC}
			<line
				x1={GRID.x - 100}
				y1={lineY}
				x2={GRID.x + GRID.w}
				y2={lineY}
				stroke="var(--rs-changed)"
				stroke-width="2"
				stroke-dasharray="6 4"
				opacity={breathe}
			/>
		{/if}

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
			id="changed"
			order={1}
			label="Cells changed"
			value="{nChanged} of {ws.length * ROWS}"
			note={offC ? `none above ${componentName(chosen)}` : 'nothing is switched off'}
		>
			<Label
				x={CARD.x + 16}
				y={CARD.y + 24}
				anchor="start"
				size={13}
				weight={650}
				halo={false}
				color={nChanged > 0 ? 'var(--rs-changed)' : undefined}
				text="{nChanged} of {ws.length *
					ROWS} guesses changed (outlined); none above the dashed line: the rows before the block never see its output"
			/>
		</Readout>
		{#each [{ id: 'clean', title: 'Clean run', gs: before, x: CARD.x + 16 }, { id: 'off', title: offC ? `With ${componentName(chosen)} off` : 'Nothing switched off', gs: after, x: CARD.x + 480 }] as col (col.id)}
			<Readout
				id="next-{col.id}"
				order={col.id === 'clean' ? 2 : 3}
				label={col.title}
				value={list(col.gs)}
			>
				<Label
					x={col.x}
					y={CARD.y + 54}
					anchor="start"
					size={12.5}
					weight={600}
					halo={false}
					text="{col.title}: next token after {q(ws[ws.length - 1])}"
				/>
				{#each col.gs.slice(0, 3) as g, k (k)}
					<Label
						x={col.x + 90}
						y={CARD.y + 82 + k * 26}
						anchor="end"
						size={12.5}
						weight={g.token === answer ? 700 : 400}
						color={g.token === answer ? 'var(--rs-answer)' : undefined}
						halo={false}
						text={short(g.token, 12)}
					/>
					<rect
						x={col.x + 100}
						y={CARD.y + 70 + k * 26}
						width={Math.max(1, g.p * 280)}
						height="16"
						rx="3"
						fill={g.token === answer ? 'var(--rs-answer)' : 'var(--rs-cell)'}
						opacity="0.7"
					/>
					<Label
						x={col.x + 106 + Math.max(1, g.p * 280)}
						y={CARD.y + 82 + k * 26}
						anchor="start"
						size={12}
						tabular
						halo={false}
						text={pct(g.p)}
					/>
				{/each}
			</Readout>
		{/each}
		{#if chosen.block === 1 && offC}
			<Readout id="artefact" order={4} label="Block 1" value="a large effect, whatever the prompt">
				<Label
					x={CARD.x + 16}
					y={CARD.y + CARD.h - 12}
					anchor="start"
					size={11}
					muted
					halo={false}
					text="block 1 is special in GPT-2 small: zeroing it changes most of the grid, whatever the prompt"
				/>
			</Readout>
		{/if}
	{:else}
		<Label
			x={16}
			y={30}
			anchor="start"
			size={15}
			weight={650}
			text="Each component switched off alone: the change in the probability of {q(answer)}"
		/>
		<!-- axis -->
		{#each [20, 0, -20, -40, -60, -80, -100] as v (v)}
			<line
				x1={CHART.x}
				y1={CHART.zero - v * CHART.scale}
				x2={CHART.x + CHART.w}
				y2={CHART.zero - v * CHART.scale}
				stroke={v === 0 ? 'var(--stage-ink-muted)' : 'var(--stage-grid)'}
				stroke-width={v === 0 ? 1.2 : 1}
			/>
			<Label
				x={CHART.x - 8}
				y={CHART.zero - v * CHART.scale + 4}
				anchor="end"
				size={10.5}
				muted
				tabular
				text="{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)}"
			/>
		{/each}
		<Readout id="y-title">
			<Label
				x={24}
				y={CHART.zero - 20 * CHART.scale - 18}
				anchor="start"
				size={10.5}
				muted
				text="points of probability"
			/>
		</Readout>
		{#each all as e (`${e.part}${e.block}`)}
			{@const y = yOf(e.change)}
			{@const on = e.block === chosen.block && e.part === chosen.part}
			<rect
				x={barX(e.block, e.part)}
				y={Math.min(y, CHART.zero)}
				width={barW}
				height={Math.max(1, Math.abs(y - CHART.zero))}
				rx="2"
				fill={barColor(e.block, e.part)}
				opacity={on ? 1 : 0.7}
				stroke={on ? 'var(--stage-ink)' : 'none'}
				stroke-width="2"
			/>
			{#if e.flips}
				<Label
					x={barX(e.block, e.part) + barW / 2}
					y={Math.max(y, CHART.zero) + 14}
					size={10}
					weight={700}
					color="var(--rs-changed)"
					text="✕"
				/>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<rect
				x={barX(e.block, e.part) - 3}
				y={CHART.y}
				width={barW + 6}
				height={CHART.zero + 100 * CHART.scale - CHART.y + 4}
				fill="transparent"
				style:cursor="pointer"
				onclick={() => pick(e)}
			/>
		{/each}
		{#each Array.from({ length: 12 }, (_, i) => i + 1) as b (b)}
			<Label
				x={CHART.x + (b - 0.5) * slot}
				y={CHART.zero + 100 * CHART.scale + 22}
				size={11.5}
				weight={b === chosen.block ? 700 : 400}
				text={String(b)}
			/>
		{/each}
		<Readout id="x-title">
			<Label
				x={CHART.x + CHART.w}
				y={CHART.zero + 100 * CHART.scale + 40}
				anchor="end"
				size={11}
				muted
				text="block (left bar: attention, right bar: MLP)"
			/>
		</Readout>
		<Readout
			id="grey-note"
			order={3}
			label="Block 1 (grey)"
			value="hurts every prompt, whatever the task"
		>
			<Label
				x={CHART.x + 4}
				y={CHART.zero + 100 * CHART.scale + 40}
				anchor="start"
				size={11}
				muted
				text="grey: block 1, which every prompt needs · ✕: the top guess changes"
			/>
		</Readout>

		<Readout
			id="sel"
			order={1}
			label={componentName(chosen)}
			value="{q(answer)} {pct(pAnswer(p))} → {pct(sel.p)} ({signed(sel.change)} points)"
			note={sel.flips ? `the top guess becomes ${q(sel.top)}` : `${q(answer)} stays the top guess`}
		>
			<Label
				x={CHART.x}
				y={572}
				anchor="start"
				size={13}
				weight={650}
				tabular
				text="{componentName(chosen)} off: {q(answer)} {pct(pAnswer(p))} → {pct(sel.p)}{sel.flips
					? `, and the top guess becomes ${q(sel.top)}`
					: `, still the top guess`}"
			/>
		</Readout>
		<Readout
			id="worst"
			order={2}
			label="Largest drop past block 1"
			value="{componentName(worst)}: {pct(worst.p)}"
		>
			<Label
				x={CHART.x + CHART.w}
				y={572}
				anchor="end"
				size={12}
				muted
				tabular
				text="largest drop past block 1: {componentName(worst)}, to {pct(worst.p)}"
			/>
		</Readout>
	{/if}
</g>
