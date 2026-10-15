<script lang="ts">
	/**
	 * Lewis diagrams of eight elements, laid out as their part of the periodic table
	 * (groups 1, 14–18; periods 1–3). Each element's valence electrons (from the element
	 * data, via `valence()` in ../model.ts) appear one by one around its symbol, one per side
	 * before any side gets a second, as Lewis diagrams are drawn. Unpaired electrons (which
	 * can bond) glow in the electron colour; paired ones (lone pairs) are ink. Under each
	 * card: how many bonds the atom makes (`capacity()`), or "full shell" for neon.
	 *
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { capacity, data, valence, type Sym } from '../model';
	import { ATOM } from '../look';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);

	const COL: Record<number, number> = { 1: 96, 14: 296, 15: 424, 16: 552, 17: 680, 18: 808 };
	const ROW: Record<number, number> = { 1: 132, 2: 300, 3: 468 };
	const CARD_W = 116;
	const CARD_H = 150;

	const SYMS: Sym[] = ['H', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Cl'];
	// Sides: top, right, bottom, left. One electron per side first, then pairs.
	const SIDES = [
		[0, -1],
		[1, 0],
		[0, 1],
		[-1, 0]
	];
	const cards = SYMS.map((sym, order) => {
		const e = data(sym);
		const v = valence(sym);
		const perSide = SIDES.map((_, s) => (v > s ? 1 : 0) + (v > s + 4 ? 1 : 0));
		const dots: { x: number; y: number; paired: boolean; k: number }[] = [];
		SIDES.forEach(([dx, dy], s) => {
			const n = perSide[s];
			for (let j = 0; j < n; j++) {
				const off = n === 2 ? (j === 0 ? -6 : 6) : 0;
				dots.push({
					x: dx * 32 + (dy !== 0 ? off : 0),
					y: dy * 32 + (dx !== 0 ? off : 0),
					paired: n === 2,
					// order of appearance: first pass one per side, then the second electrons
					k: j === 0 ? s : 4 + s
				});
			}
		});
		const cap = capacity(sym);
		return {
			sym,
			name: e.name,
			x: COL[e.group ?? 1],
			y: ROW[e.period],
			v,
			dots,
			cap,
			lone: (v - cap) / 2,
			start: 0.3 + order * 0.25
		};
	});
	const shown = (c: (typeof cards)[number], k: number) =>
		smoothstep(0, 0.25, time - c.start - k * 0.12);
	const pulse = $derived(reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3));
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- group and period labels -->
	{#each Object.entries(COL) as [g, x] (g)}
		{@render txt(x, 44, `group ${g}`, 11, { muted: true })}
	{/each}
	{#each Object.entries(ROW) as [p, y] (p)}
		{@render txt(28, y + 4, `${p}`, 11, { muted: true })}
	{/each}
	{@render txt(28, 44, 'period', 11, { muted: true })}

	{#each cards as c (c.sym)}
		{@const appear = smoothstep(0, 0.3, time - c.start + 0.3)}
		<g opacity={0.25 + 0.75 * appear}>
			<rect
				x={c.x - CARD_W / 2}
				y={c.y - 62}
				width={CARD_W}
				height={CARD_H}
				rx="12"
				fill="var(--surface)"
				stroke={c.cap === 0 ? 'var(--stage-ink-muted)' : 'var(--border-strong)'}
				stroke-dasharray={c.cap === 0 ? '5 4' : undefined}
			/>
			<text
				x={c.x}
				y={c.y + 12}
				text-anchor="middle"
				font-weight="700"
				font-size="34"
				style:fill={c.sym === 'H' || c.sym === 'Ne'
					? 'var(--stage-ink)'
					: c.sym === 'C'
						? 'var(--carbon)'
						: ATOM[c.sym].fill}>{c.sym}</text
			>
			{#each c.dots as d (d.k)}
				{@const o = shown(c, d.k)}
				{#if !d.paired}
					<circle
						cx={c.x + d.x}
						cy={c.y + d.y}
						r={6 + 2.5 * pulse}
						fill="var(--atom-electron)"
						opacity={0.25 * o}
					/>
				{/if}
				<circle
					cx={c.x + d.x}
					cy={c.y + d.y}
					r="4"
					fill={d.paired ? 'var(--stage-ink)' : 'var(--atom-electron)'}
					opacity={o}
				/>
			{/each}
			{@render txt(
				c.x,
				c.y + 60,
				c.cap === 0
					? 'full shell'
					: c.sym === 'Na'
						? 'gives 1 away'
						: `${c.cap} bond${c.cap > 1 ? 's' : ''}`,
				14,
				{
					weight: 700
				}
			)}
			{@render txt(c.x, c.y + 77, `${c.v} outer e⁻`, 11, { muted: true })}
		</g>
	{/each}

	<!-- legend, in the empty corner of the table -->
	<g transform="translate(300 74)" opacity={clamp(time - 0.3)}>
		<rect
			x="-10"
			y="-6"
			width="560"
			height="104"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<circle cx="12" cy="20" r={6 + 2.5 * pulse} fill="var(--atom-electron)" opacity="0.25" />
		<circle cx="12" cy="20" r="4" fill="var(--atom-electron)" />
		{@render txt(28, 24, 'unpaired electron: ready to pair up in a bond', 13, { anchor: 'start' })}
		<circle cx="7" cy="48" r="4" fill="var(--stage-ink)" />
		<circle cx="17" cy="48" r="4" fill="var(--stage-ink)" />
		{@render txt(28, 52, 'lone pair: stays on the atom', 13, { anchor: 'start' })}
		{@render txt(0, 82, 'Bonds = electrons short of a full shell (8; for hydrogen, 2)', 13, {
			anchor: 'start',
			weight: 600
		})}
	</g>
	{@render txt(96, 578, 'Na: one electron, easier to lose', 11, { muted: true })}
	{@render txt(680, 578, 'Cl: one short of eight', 11, { muted: true })}
</g>
