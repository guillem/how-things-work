<script lang="ts">
	import { STRIP, spacerX, stripWidth, type StripSpacer } from './strip';
	/**
	 * A CRISPR array drawn as a strip: the leader, then repeat (grey diamond),
	 * spacer (coloured box), repeat, … Index 0 is next to the leader (the
	 * newest). `grow` (0–1) opens room for the first spacer and its repeat,
	 * for the insertion animation. `(x, y)` is the left end, vertically centred.
	 */
	interface Props {
		x: number;
		y: number;
		spacers: StripSpacer[];
		scale?: number;
		leader?: boolean;
		grow?: number;
		/** Label text size inside spacers (0 = no labels). */
		text?: number;
		/** "…" after the last repeat (older spacers not drawn). */
		more?: boolean;
	}
	let {
		x,
		y,
		spacers,
		scale = 1,
		leader = true,
		grow = 1,
		text = 13,
		more = false
	}: Props = $props();

	const s = $derived(scale);
	const h = $derived(STRIP.h * s);
	const repeats = $derived.by(() => {
		const out: { k: number; x: number; o: number }[] = [];
		let cx = x + ((leader ? STRIP.leader : 0) + STRIP.repeat / 2) * s;
		out.push({ k: 0, x: cx, o: 1 });
		for (let i = 0; i < spacers.length; i++) {
			const g = i === 0 ? grow : 1;
			cx += g * (STRIP.spacer + STRIP.repeat) * s;
			out.push({ k: i + 1, x: cx, o: i === 0 ? Math.min(1, grow * 1.5) : 1 });
		}
		return out;
	});
	const end = $derived(x + stripWidth(spacers.length, s, leader, grow));
	const r = $derived((STRIP.repeat / 2) * s * 0.85);
</script>

<g style:pointer-events="none">
	<line
		x1={x - 14 * s}
		x2={end + (more ? 36 : 14) * s}
		y1={y}
		y2={y}
		stroke="var(--cr-chromosome)"
		stroke-width={2 * Math.max(0.6, s)}
	/>
	{#if leader}
		<rect
			{x}
			y={y - h * 0.4}
			width={STRIP.leader * s - 2}
			height={h * 0.8}
			rx={4 * s}
			fill="var(--cr-leader)"
			opacity="0.85"
		/>
		{#if text > 0}
			<text
				x={x + (STRIP.leader * s) / 2}
				y={y + text * 0.36}
				text-anchor="middle"
				style:font-size="{text - 1}px"
				style:fill="var(--stage-bg)"
				font-weight="600">leader</text
			>
		{/if}
	{/if}
	{#each spacers as sp, i (sp.key)}
		{@const w = (i === 0 ? grow : 1) * STRIP.spacer * s}
		{@const cx = spacerX(x, i, s, leader, grow)}
		{#if w > 0.5}
			<g opacity={(sp.opacity ?? 1) * (i === 0 ? Math.min(1, grow * 1.3) : 1)}>
				<rect
					x={cx - w / 2 + 1}
					y={y - h / 2}
					width={Math.max(0, w - 2)}
					height={h}
					rx={4 * s}
					fill={sp.ghost ? 'none' : sp.color}
					stroke={sp.ghost ? 'var(--stage-ink-muted)' : 'none'}
					stroke-dasharray={sp.ghost ? '4 3' : undefined}
				/>
				{#if sp.label && text > 0 && w > text}
					<text
						x={cx}
						y={y + text * 0.36}
						text-anchor="middle"
						style:font-size="{text}px"
						style:fill={sp.ghost ? 'var(--stage-ink-muted)' : 'var(--cr-on-colour)'}
						font-weight="600">{sp.label}</text
					>
				{/if}
			</g>
		{/if}
	{/each}
	{#each repeats as rp (rp.k)}
		<rect
			x={rp.x - r}
			y={y - r}
			width={r * 2}
			height={r * 2}
			transform="rotate(45 {rp.x} {y})"
			fill="var(--cr-repeat)"
			stroke="var(--stage-bg)"
			stroke-width="1"
			opacity={rp.o}
		/>
	{/each}
	{#if more}
		<text
			x={end + 22 * s}
			y={y - 6 * s}
			text-anchor="middle"
			style:font-size="{Math.max(11, text)}px"
			style:fill="var(--stage-ink-muted)">…</text
		>
	{/if}
</g>
