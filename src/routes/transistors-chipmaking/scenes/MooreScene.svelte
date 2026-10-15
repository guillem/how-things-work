<script lang="ts">
	/**
	 * Transistors per microprocessor, 1971–2021 (Karl Rupp's trend data, `COUNTS`), on a
	 * log scale, with the least-squares doubling line (`mooreFit`). `params.year` sets a
	 * cursor: chips after it are dimmed, and the readout compares the largest chip so far
	 * with the Intel 4004. Three points are named: the 4004 (1971, 2,300) and the two
	 * Apple chips the counts match (M1, Nov 2020, 16 billion; M1 Max, Oct 2021, 57 billion).
	 * The line is drawn out from the left over the first seconds of the step.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { sup } from '../../semiconductors/model';
	import { COUNTS } from '../counts';
	import { mooreFit } from '../model';

	let { params, t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);
	const target = $derived(clamp(Number(params.year ?? 2022), 1972, 2022));
	const Y = Tween.of(() => target, { duration: 400, easing: cubicInOut });
	const year = $derived(reduced ? target : Y.current);

	const fit = mooreFit(COUNTS);
	const sx = scale([1970, 2023], [120, 900]);
	const sy = scale([3, 11], [520, 80]);
	const lg = (n: number) => Math.log10(n);
	const draw = $derived(smoothstep(0.3, 3, time));
	const lineEnd = $derived(1971 + 50 * draw);
	const NAMES: Record<number, string> = { 3: '1 thousand', 6: '1 million', 9: '1 billion' };

	const sofar = $derived(COUNTS.filter(([y]) => y <= year));
	const best = $derived(sofar.reduce((a, b) => (b[1] > a[1] ? b : a), COUNTS[0]));
	const ratio = $derived(best[1] / COUNTS[0][1]);
	const fmt = (n: number) =>
		n >= 1e9
			? `${Number((n / 1e9).toPrecision(2))} billion`
			: n >= 1e6
				? `${Number((n / 1e6).toPrecision(2))} million`
				: n >= 1e3
					? `${Number(n.toPrecision(2)).toLocaleString('en-US')}`
					: String(Math.round(n));
	const named = [
		{ y: 1971.88, n: 2300, label: 'Intel 4004: 2,300', anchor: 'start', dx: 10, dy: -10 },
		{ y: 2020.9, n: 16e9, label: 'Apple M1: 16 billion', anchor: 'end', dx: -10, dy: 18 },
		{ y: 2021.8, n: 57e9, label: 'M1 Max: 57 billion', anchor: 'end', dx: -12, dy: -10 }
	];
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
	<Axes
		{sx}
		{sy}
		xTicks={[1970, 1980, 1990, 2000, 2010, 2020]}
		yTicks={[3, 4, 5, 6, 7, 8, 9, 10, 11]}
		xFormat={(v: number) => String(v)}
		yFormat={(v: number) => NAMES[v] ?? `10${sup(v)}`}
		yLabel="transistors per chip"
	/>
	<!-- the fitted doubling line -->
	<line
		x1={sx(1971)}
		y1={sy(lg(fit.at(1971)))}
		x2={sx(lineEnd)}
		y2={sy(lg(fit.at(lineEnd)))}
		stroke="var(--tc-die)"
		stroke-width="2.5"
		stroke-dasharray="7 5"
		opacity={0.4 + 0.6 * draw}
	/>
	{#each COUNTS as [y, n], i (i)}
		<circle
			cx={sx(y)}
			cy={sy(lg(n))}
			r="5"
			fill="var(--tc-curve)"
			stroke="var(--stage-bg)"
			opacity={y <= year ? 0.9 : 0.3}
		/>
	{/each}
	{#each named as c (c.y)}
		<circle
			cx={sx(c.y)}
			cy={sy(lg(c.n))}
			r="7"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			opacity={c.y <= year ? 1 : 0.3}
		/>
		<Readout id="name-{c.y}">
			{@render txt(sx(c.y) + c.dx, sy(lg(c.n)) + c.dy, c.label, 12, {
				anchor: c.anchor,
				weight: 700
			})}
		</Readout>
	{/each}
	<!-- year cursor -->
	<line
		x1={sx(year)}
		x2={sx(year)}
		y1={sy(3)}
		y2={sy(11)}
		stroke="var(--explainer-accent, var(--accent))"
		stroke-width="1.5"
	/>
	<Readout id="year" order={1} label="Year" value={String(Math.round(year))}>
		{@render txt(sx(year), sy(11) - 8, String(Math.round(year)), 13, {
			weight: 700,
			color: 'var(--explainer-accent, var(--accent))'
		})}
	</Readout>

	<Readout id="fit" order={3} label="Fitted doubling time" value="{fit.doubling.toFixed(1)} years">
		<g>
			<rect
				x="140"
				y="96"
				width="330"
				height="70"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(156, 122, `doubles every ${fit.doubling.toFixed(1)} years`, 15, {
				anchor: 'start',
				weight: 700,
				color: 'var(--tc-die)'
			})}
			{@render txt(156, 144, `least-squares fit to all ${COUNTS.length} chips (dashed)`, 12, {
				anchor: 'start',
				muted: true
			})}
		</g>
	</Readout>
	<Readout
		id="best"
		order={2}
		label="Largest chip so far"
		value="{fmt(best[1])} transistors, {fmt(ratio)} × the 4004"
	>
		{@render txt(156, 190, `largest by ${Math.round(year)}: ${fmt(best[1])} transistors`, 13, {
			anchor: 'start',
			weight: 700
		})}
		{@render txt(156, 210, `${fmt(ratio)} times the 4004`, 12, { anchor: 'start', muted: true })}
	</Readout>
</g>
