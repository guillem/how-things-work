<script lang="ts">
	/**
	 * The frame of the HR diagram: a night-sky panel with a decade grid, temperature ticks
	 * along the bottom (hot on the left), luminosity ticks on the left, the axis titles, a strip
	 * of star colours under the axis, and the nearby Gaia stars as dots.
	 */
	import type { Scale } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { L_TICKS, T_TICKS, dotPaths, fmtL, fmtT, type Box } from './hr';
	import { starColour } from '../star';

	interface Props {
		box: Box;
		sx: Scale;
		sy: Scale;
		/** Opacity of the nearby stars (0 hides them). */
		dots?: number;
		/** Prefix for the clip path's id, unique per scene. */
		name: string;
	}
	let { box, sx, sy, dots = 1, name }: Props = $props();

	const paths = $derived(dotPaths(sx, sy));
	const DECADES = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
	const strip = $derived(
		Array.from({ length: 40 }, (_, i) => {
			const lt = sx.domain[0] + ((sx.domain[1] - sx.domain[0]) * (i + 0.5)) / 40;
			return { i, x: box.x + (box.w * i) / 40, colour: starColour(10 ** lt) };
		})
	);
</script>

<g style:pointer-events="none">
	<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" fill="var(--st-sky)" />
	{#each DECADES as v (v)}
		<line x1={box.x} x2={box.x + box.w} y1={sy(v)} y2={sy(v)} stroke="var(--st-sky-grid)" />
	{/each}
	{#each L_TICKS as v (v)}
		<text x={box.x - 8} y={sy(v) + 4} text-anchor="end" style:font-size="11px" class="muted"
			>{fmtL(v)}</text
		>
	{/each}
	{#each T_TICKS as T (T)}
		{@const x = sx(Math.log10(T))}
		<line x1={x} x2={x} y1={box.y} y2={box.y + box.h} stroke="var(--st-sky-grid)" />
		<Readout id="tick-{T}">
			<text {x} y={box.y + box.h + 30} text-anchor="middle" style:font-size="11px" class="muted"
				>{fmtT(T)}</text
			>
		</Readout>
	{/each}
	{#each strip as s (s.i)}
		<rect x={s.x} y={box.y + box.h + 4} width={box.w / 40 + 0.5} height="8" fill={s.colour} />
	{/each}
	<text
		x={box.x + box.w}
		y={box.y + box.h + 48}
		text-anchor="end"
		style:font-size="11px"
		class="muted">surface temperature ← hotter</text
	>
	<text x={box.x - 8} y={box.y - 10} text-anchor="start" style:font-size="11px" class="muted"
		>luminosity (Sun = 1)</text
	>
	<clipPath id="{name}-hr-clip">
		<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="8" />
	</clipPath>
	{#if dots > 0.01}
		<g opacity={dots} clip-path="url(#{name}-hr-clip)">
			{#each paths as p (p.key)}
				<path d={p.d} fill={p.colour} />
			{/each}
		</g>
	{/if}
</g>
