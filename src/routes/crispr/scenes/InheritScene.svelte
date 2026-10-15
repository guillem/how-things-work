<script lang="ts">
	/**
	 * Step "inherit": a bacterium with spacers C, B, A divides, and its
	 * daughters divide again: all four granddaughters carry the same array.
	 * Beside it, two cards compare where the memory is kept in a bacterium
	 * (in DNA, inherited) and in us (in memory cells, not inherited).
	 */
	import { Label, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import ArrayStrip from './ArrayStrip.svelte';
	import { stripWidth, type StripSpacer } from './strip';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);

	const SP: StripSpacer[] = [
		{ key: 'C', label: 'C', color: 'var(--cr-s3)' },
		{ key: 'B', label: 'B', color: 'var(--cr-s2)' },
		{ key: 'A', label: 'A', color: 'var(--cr-s1)' }
	];
	const S = 0.36;
	const SW = stripWidth(3, S);
	const CW = 128;
	const CH = 58;

	interface Cell {
		k: string;
		x: number;
		y: number;
		parent: string | null;
		gen: number;
	}
	const CELLS: Cell[] = [
		{ k: 'r', x: 300, y: 140, parent: null, gen: 0 },
		{ k: 'a', x: 160, y: 300, parent: 'r', gen: 1 },
		{ k: 'b', x: 440, y: 300, parent: 'r', gen: 1 },
		{ k: 'aa', x: 90, y: 460, parent: 'a', gen: 2 },
		{ k: 'ab', x: 230, y: 460, parent: 'a', gen: 2 },
		{ k: 'ba', x: 370, y: 460, parent: 'b', gen: 2 },
		{ k: 'bb', x: 510, y: 460, parent: 'b', gen: 2 }
	];
	const byKey = new Map(CELLS.map((c) => [c.k, c]));
	/** Generation g appears between 1.5 + 3(g−1) and 3 + 3(g−1) seconds. */
	const born = (g: number) => (g === 0 ? 1 : smoothstep(1.5 + 3 * (g - 1), 3 + 3 * (g - 1), time));
	const pos = (c: Cell): { x: number; y: number } => {
		if (!c.parent) return { x: c.x, y: c.y };
		const p = pos(byKey.get(c.parent)!);
		const u = born(c.gen);
		return { x: lerp(p.x, c.x, u), y: lerp(p.y, c.y, u) };
	};
	/** A slight drift once a cell is in place, so the frame stays alive. */
	const bob = (c: Cell, i: number) =>
		reduced ? 0 : Math.sin(time * 1.1 + i * 1.7) * 1.6 * born(c.gen);
</script>

<g>
	<Readout
		id="title"
		order={0}
		label="Division"
		value="the chromosome, array included, is copied: every daughter cell carries the same spacers"
	>
		<Label x={300} y={52} text="Every daughter inherits the array" size={16} weight={600} />
		<Label
			x={300}
			y={74}
			text="the chromosome is copied at each division, spacers and all"
			size={12}
			muted
		/>
	</Readout>

	{#each CELLS as c (c.k)}
		{#if c.parent}
			{@const p = byKey.get(c.parent)!}
			{@const q = pos(c)}
			<line
				x1={p.x}
				y1={p.y + CH / 2 + 6}
				x2={q.x}
				y2={q.y - CH / 2 - 6}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				opacity={0.6 * born(c.gen)}
			/>
		{/if}
	{/each}
	{#each CELLS as c, i (c.k)}
		{@const q0 = pos(c)}
		{@const q = { x: q0.x, y: q0.y + bob(c, i) }}
		{@const o = born(c.gen)}
		{#if o > 0.01}
			<g opacity={o}>
				<rect
					x={q.x - CW / 2}
					y={q.y - CH / 2}
					width={CW}
					height={CH}
					rx={CH / 2}
					fill="var(--cr-cell)"
					stroke="var(--cr-cell-edge)"
					stroke-width="1.5"
				/>
				<ArrayStrip x={q.x - SW / 2} y={q.y} spacers={SP} scale={S} text={0} />
			</g>
		{/if}
	{/each}
	<Readout id="gens">
		<Label x={300} y={100} text="a survivor of phages A, B and C" size={12} muted />
		<Label
			x={300}
			y={548}
			text="all its descendants: protected against A, B and C"
			size={13}
			weight={600}
			opacity={born(2)}
		/>
	</Readout>

	<!-- comparison -->
	<g>
		<rect
			x={628}
			y={120}
			width={316}
			height={160}
			rx={12}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<rect
			x={628}
			y={310}
			width={316}
			height={160}
			rx={12}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout
			id="bact"
			order={1}
			label="A bacterium’s memory"
			value="spacers in its chromosome: copied at every division, so every descendant is protected"
		>
			<Label x={648} y={152} text="A bacterium’s memory" size={15} weight={600} anchor="start" />
			<Label x={648} y={182} text="spacers, written in its DNA" size={13} anchor="start" />
			<Label x={648} y={210} text="copied at every division:" size={13} anchor="start" muted />
			<Label x={648} y={232} text="all descendants are protected" size={13} anchor="start" muted />
			<Label
				x={648}
				y={262}
				text="inherited"
				size={13}
				weight={700}
				anchor="start"
				color="var(--cr-match)"
			/>
		</Readout>
		<Readout
			id="ours"
			order={2}
			label="Our immune memory"
			value="memory B and T cells: they protect us, but our children start with a fresh immune system"
		>
			<Label x={648} y={342} text="Our immune memory" size={15} weight={600} anchor="start" />
			<Label x={648} y={372} text="memory B and T cells" size={13} anchor="start" />
			<Label x={648} y={400} text="they protect us for years," size={13} anchor="start" muted />
			<Label x={648} y={422} text="but each child starts afresh" size={13} anchor="start" muted />
			<Label
				x={648}
				y={452}
				text="not inherited"
				size={13}
				weight={700}
				anchor="start"
				color="var(--cr-mismatch)"
			/>
		</Readout>
	</g>
</g>
