<script lang="ts">
	/**
	 * Levinthal's paradox: how the number of shapes grows with chain length, on a ten-fold
	 * (log) scale. Two curves: the HP grid (exact by enumeration up to 14 beads, then the
	 * long-chain law of self-avoiding walks) and 3ⁿ (three positions per amino acid, the
	 * figure of Zwanzig, Szabo & Bagchi). A horizontal line marks how many shapes could be
	 * tried since the Big Bang at 10¹³ a second. `params.length` picks the chain length.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { walkCount, walkCountEstimate } from '../hp';
	import { SECONDS_PER_YEAR, UNIVERSE_AGE_YEARS, searchYears } from '../folding';
	import Label from './Text.svelte';

	let { t, params, reduced }: StageProps = $props();

	const RATE = 1e13;
	const EXACT = 14;
	// distinct shapes (up to rotation and mirror image) of n beads: (c(n − 1) + 4) / 8
	const exact = Array.from({ length: EXACT + 1 }, (_, n) =>
		n < 2 ? 1 : (walkCount(n - 1) + 4) / 8
	);
	const C13 = walkCount(EXACT - 1);
	const gridAt = (n: number) =>
		n <= EXACT ? exact[n] : walkCountEstimate(n - 1, EXACT - 1, C13) / 8;
	/** Shapes on the grid; between whole lengths (the marker sliding), log-linear in between. */
	const gridShapes = (n: number) => {
		const lo = Math.floor(n);
		if (lo === n) return gridAt(n);
		const u = n - lo;
		return 10 ** ((1 - u) * Math.log10(gridAt(lo)) + u * Math.log10(gridAt(lo + 1)));
	};
	const log3 = Math.log10(3);

	const N0 = 4;
	const N1 = 150;
	const sx = scale([N0, N1], [92, 610]);
	const sy = scale([0, 80], [520, 70]);
	const series = Array.from({ length: N1 - N0 + 1 }, (_, k) => N0 + k);
	const gridExact = linePath(
		series.filter((n) => n <= EXACT),
		(n) => n,
		(n) => Math.log10(gridShapes(n)),
		sx,
		sy
	);
	const gridLong = linePath(
		series.filter((n) => n >= EXACT),
		(n) => n,
		(n) => Math.log10(gridShapes(n)),
		sx,
		sy
	);
	const threeN = linePath(
		series,
		(n) => n,
		(n) => n * log3,
		sx,
		sy
	);
	const universe = Math.log10(RATE * UNIVERSE_AGE_YEARS * SECONDS_PER_YEAR);

	const n = $derived(Math.round(Number(params.length ?? 14)));
	const nT = Tween.of(() => n, { duration: 400, easing: cubicInOut });
	const nx = $derived(sx(nT.current));
	const draw = $derived(reduced ? 1 : smoothstep(0.2, 1.6, t));

	const SUP: Record<string, string> = {
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹',
		'-': '⁻'
	};
	const sup = (k: number) => String(k).replace(/./g, (c) => SUP[c] ?? c);
	/** 3.8 × 10⁴¹, or the plain number when it is small. */
	function sci(v: number): string {
		if (v < 1e6) return Math.round(v).toLocaleString('en-US');
		const e = Math.floor(Math.log10(v));
		const m = v / 10 ** e;
		return `${m.toFixed(1)} × 10${sup(e)}`;
	}
	/** Two significant figures, written out (no exponent). */
	const two = (v: number) => Number(v.toPrecision(2)).toLocaleString('en-US');
	function duration(years: number): string {
		const s = years * SECONDS_PER_YEAR;
		if (s < 1e-6) return `${two(s * 1e9)} nanoseconds`;
		if (s < 1e-3) return `${two(s * 1e6)} microseconds`;
		if (s < 1) return `${two(s * 1e3)} milliseconds`;
		if (s < 3600) return `${two(s)} seconds`;
		if (years < 1) return `${two(s / 86400)} days`;
		return years < 1e6 ? `${two(years)} years` : `${sci(years)} years`;
	}

	const grid = $derived(gridShapes(n));
	const three = $derived(3 ** n);
	const years = $derived(searchYears(three, RATE));
	const ages = $derived(years / UNIVERSE_AGE_YEARS);
</script>

<g style:font-variant-numeric="tabular-nums">
	<Axes
		{sx}
		{sy}
		xLabel="chain length (amino acids)"
		yLabel="number of shapes"
		xTicks={[4, 25, 50, 75, 100, 125, 150]}
		yTicks={[0, 10, 20, 30, 40, 50, 60, 70, 80]}
		yFormat={(v: number) => (v === 0 ? '1' : `10${sup(v)}`)}
	/>

	<!-- the age of the universe, searched at 10¹³ shapes a second -->
	<line
		x1={sx(N0)}
		x2={sx(N1)}
		y1={sy(universe)}
		y2={sy(universe)}
		stroke="var(--pf-clash)"
		stroke-width="1.5"
		stroke-dasharray="6 5"
	/>
	<Readout
		id="universe"
		order={5}
		label="Dashed: all tries since the Big Bang"
		color="var(--pf-clash)"
	>
		<Label
			x={sx(N0) + 6}
			y={sy(universe) - 24}
			text="all the shapes tried since"
			size={12}
			anchor="start"
			color="var(--pf-clash)"
		/>
		<Label
			x={sx(N0) + 6}
			y={sy(universe) - 8}
			text="the Big Bang, 10¹³ a second"
			size={12}
			anchor="start"
			color="var(--pf-clash)"
		/>
	</Readout>

	<g opacity={draw}>
		<path d={threeN} fill="none" stroke="var(--pf-helix)" stroke-width="3" />
		<path d={gridExact} fill="none" stroke="var(--pf-bar)" stroke-width="3.5" />
		<path
			d={gridLong}
			fill="none"
			stroke="var(--pf-bar)"
			stroke-width="2.5"
			stroke-dasharray="7 5"
		/>
		<Readout id="k3" order={6} label="Red: 3 positions each" color="var(--pf-helix)">
			<Label
				x={sx(136)}
				y={sy(136 * log3) - 14}
				text="3 positions each: 3ⁿ"
				size={13}
				anchor="end"
				color="var(--pf-helix)"
			/>
		</Readout>
		<Readout id="kgrid" order={7} label="Purple: the HP grid" color="var(--pf-bar)">
			<Label
				x={sx(140)}
				y={sy(Math.log10(gridShapes(140))) + 26}
				text="on the grid"
				size={13}
				anchor="end"
				color="var(--pf-bar)"
			/>
		</Readout>
	</g>

	<!-- the chosen length -->
	<line x1={nx} x2={nx} y1={sy(0)} y2={sy(80)} stroke="var(--stage-ink-muted)" stroke-width="1" />
	<circle
		cx={nx}
		cy={sy(nT.current * log3)}
		r="6"
		fill="var(--pf-helix)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<circle
		cx={nx}
		cy={sy(Math.log10(gridShapes(nT.current)))}
		r="6"
		fill="var(--pf-bar)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<Readout id="n" order={1} label="Chain" value="{n} amino acids">
		<Label x={650} y={92} text="{n} amino acids" size={18} weight={700} anchor="start" />
	</Readout>
	<Readout
		id="grid"
		order={2}
		label="Shapes on the grid"
		value={n <= EXACT ? sci(grid) : `≈ ${sci(grid)}`}
		color="var(--pf-bar)"
	>
		<Label
			x={650}
			y={130}
			text="on the grid ({n <= EXACT ? 'counted' : 'estimated'})"
			size={12}
			anchor="start"
			muted
		/>
		<Label
			x={650}
			y={152}
			text="{n <= EXACT ? '' : '≈ '}{sci(grid)} shapes"
			size={15}
			weight={600}
			anchor="start"
			color="var(--pf-bar)"
		/>
	</Readout>
	<Readout
		id="three"
		order={3}
		label="3 positions each"
		value="3{sup(n)} ≈ {sci(three)}"
		color="var(--pf-helix)"
	>
		<Label x={650} y={190} text="3 positions per amino acid" size={12} anchor="start" muted />
		<Label
			x={650}
			y={212}
			text="3{sup(n)} ≈ {sci(three)} shapes"
			size={15}
			weight={600}
			anchor="start"
			color="var(--pf-helix)"
		/>
	</Readout>
	<Readout
		id="time"
		order={4}
		label="Trying 10¹³ a second"
		value={duration(years)}
		note={ages >= 1 ? `${sci(ages)} × the age of the universe` : ''}
	>
		<Label x={650} y={258} text="trying 10¹³ of them a second:" size={12} anchor="start" muted />
		<Label x={650} y={280} text={duration(years)} size={15} weight={600} anchor="start" />
		{#if ages >= 1}
			<Label
				x={650}
				y={300}
				text="{sci(ages)} × the age of the universe"
				size={12}
				anchor="start"
			/>
		{/if}
	</Readout>
	<Readout id="real" order={8} label="A real protein" value="folds in microseconds to seconds">
		<Label x={650} y={350} text="a real protein folds in" size={12} anchor="start" muted />
		<Label x={650} y={370} text="microseconds to seconds" size={15} weight={600} anchor="start" />
	</Readout>
</g>
