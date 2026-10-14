<script lang="ts">
	/**
	 * How the work grows with the number of cities, on a logarithmic scale:
	 * n log₂ n and n² (from the sorting explainer), Held–Karp's n² 2ⁿ, and the
	 * (n − 1)!/2 tours of brute force. A marker at the chosen n reads off the
	 * counts and the time at a billion operations a second; dashed lines mark a
	 * second, a year and the age of the universe at that rate.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Axes, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { tourCount } from '../turing';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const n = $derived(clamp(Math.round(Number(params.growthN ?? 20)), 3, 30));
	const nT = new Tween(20, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const v = n;
		const instant = reduced;
		untrack(() => void nT.set(v, instant ? { duration: 0 } : undefined));
	});

	const RATE = 1e9;
	const YEAR = 365.25 * 24 * 3600;
	/** Age of the universe, 13.8 billion years (Planck 2018: 13.787 ± 0.020 Gyr). */
	const UNIVERSE = 13.8e9 * YEAR;
	const SERIES = [
		{
			id: 'nlogn',
			label: 'n log₂ n (merge sort)',
			f: (x: number) => x * Math.log2(x),
			color: 'var(--tm-desc)'
		},
		{ id: 'n2', label: 'n² (bubble sort)', f: (x: number) => x * x, color: 'var(--tm-head)' },
		{
			id: 'hk',
			label: 'n² 2ⁿ (Held–Karp)',
			f: (x: number) => x * x * 2 ** x,
			color: 'var(--tm-greedy)'
		},
		{ id: 'bf', label: '(n − 1)!/2 tours (brute force)', f: tourCount, color: 'var(--tm-loop)' }
	];

	const X0 = 96;
	const X1 = 600;
	const Y0 = 520;
	const Y1 = 100;
	const sx = scale([3, 30], [X0, X1]);
	const sy = scale([0, 32], [Y0, Y1]);
	const lg = (v: number) => Math.log10(Math.max(1, v));
	const xs = Array.from({ length: 28 }, (_, i) => i + 3);
	const paths = SERIES.map((s) => ({
		...s,
		d: linePath(
			xs,
			(x) => x,
			(x) => clamp(lg(s.f(x)), 0, 32),
			sx,
			sy
		)
	}));
	const LINES = [
		{ v: RATE, label: '1 second' },
		{ v: RATE * YEAR, label: '1 year' },
		{ v: RATE * UNIVERSE, label: 'age of the universe' }
	];

	const fmtTime = (ops: number) => {
		const s = ops / RATE;
		if (s < 1e-3) return 'under a millisecond';
		if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
		if (s < 120) return `${s.toFixed(s < 10 ? 1 : 0)} seconds`;
		if (s < 7200) return `${(s / 60).toFixed(0)} minutes`;
		if (s < 2 * 86400) return `${(s / 3600).toFixed(0)} hours`;
		if (s < YEAR) return `${(s / 86400).toFixed(0)} days`;
		const y = s / YEAR;
		if (y < 1e3) return `${y.toPrecision(2)} years`;
		if (y < 1e6) return `${(y / 1e3).toPrecision(2)} thousand years`;
		if (y < 1e9) return `${(y / 1e6).toPrecision(2)} million years`;
		return `${y < 1e11 ? (y / 1e9).toPrecision(2) : Math.round(y / 1e9).toLocaleString('en')} billion years${s > UNIVERSE ? ' (longer than the universe has existed)' : ''}`;
	};
	const fmtCount = (v: number) =>
		v < 1e6
			? Math.round(v).toLocaleString('en')
			: `${(v / 10 ** Math.floor(Math.log10(v))).toFixed(1)} × 10^${Math.floor(Math.log10(v))}`;
	const sup = (s: string) =>
		s.replace(/\^(\d+)/, (_, d: string) => [...d].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]).join(''));

	const tours = $derived(tourCount(n));
	const hk = $derived(n * n * 2 ** n);
	const mx = $derived(sx(nT.current));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const draw = $derived(reduced ? 1 : smoothstep(0.2, 1.6, t));
</script>

<g opacity={fadeIn}>
	<defs>
		<clipPath id="growth-reveal">
			<rect x={X0} y={Y1 - 10} width={(X1 - X0) * draw} height={Y0 - Y1 + 20} />
		</clipPath>
	</defs>
	<Txt x={24} y={42} text="How the work grows with the number of cities" size={18} weight={600} />
	<Txt
		x={24}
		y={68}
		text="Each grid line is ten times the one below. Times at a billion operations a second."
		size={13}
		muted
	/>

	<Axes
		{sx}
		{sy}
		xLabel="cities, n"
		yLabel="operations"
		xTicks={[5, 10, 15, 20, 25, 30]}
		yTicks={[0, 4, 8, 12, 16, 20, 24, 28, 32]}
		yFormat={(v) => sup(`10^${v}`)}
	/>
	{#each LINES as l (l.label)}
		<line
			x1={X0}
			x2={X1}
			y1={sy(lg(l.v))}
			y2={sy(lg(l.v))}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 5"
		/>
		<Txt x={X0 + 6} y={sy(lg(l.v)) - 6} text={l.label} size={11} muted />
	{/each}
	<g clip-path="url(#growth-reveal)">
		{#each paths as p (p.id)}
			<path d={p.d} fill="none" stroke={p.color} stroke-width="2.5" stroke-linejoin="round" />
		{/each}
	</g>
	<!-- the chosen n -->
	<line x1={mx} x2={mx} y1={Y1} y2={Y0} stroke="var(--stage-ink)" stroke-width="1" opacity="0.5" />
	{#each SERIES as s (s.id)}
		<circle
			cx={mx}
			cy={sy(clamp(lg(s.f(nT.current)), 0, 32))}
			r="5"
			fill={s.color}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={draw}
		/>
	{/each}

	<!-- legend and readouts -->
	{#each SERIES as s, i (s.id)}
		<Readout
			id="leg-{s.id}"
			order={10 + i}
			label={s.label}
			value={fmtCount(s.f(n))}
			color={s.color}
		>
			<line
				x1={636}
				x2={662}
				y1={112 + i * 24}
				y2={112 + i * 24}
				stroke={s.color}
				stroke-width="3"
			/>
			<Txt x={670} y={116 + i * 24} text={s.label} size={13} />
		</Readout>
	{/each}
	<Readout id="g-n" order={1} label="Cities" value={String(n)}>
		<Txt x={636} y={238} text="With {n} cities" size={15} weight={700} />
	</Readout>
	<Readout
		id="g-bf"
		order={2}
		label="Brute force"
		value="{sup(fmtCount(tours))} tours: {fmtTime(tours)}"
		color="var(--tm-loop)"
	>
		<Txt
			x={636}
			y={266}
			text="brute force: {sup(fmtCount(tours))} tours"
			size={13}
			color="var(--tm-loop)"
			weight={600}
		/>
		{#each fmtTime(tours).match(/.{1,40}(\s|$)/g) ?? [] as line, i (i)}
			<Txt x={648} y={288 + i * 20} text={line.trim()} size={13} />
		{/each}
	</Readout>
	<Readout
		id="g-hk"
		order={3}
		label="Held–Karp"
		value="{sup(fmtCount(hk))} operations: {fmtTime(hk)}"
		color="var(--tm-greedy)"
	>
		<Txt
			x={636}
			y={348}
			text="Held–Karp: {sup(fmtCount(hk))} operations"
			size={13}
			color="var(--tm-greedy)"
			weight={600}
		/>
		<Txt x={648} y={370} text={fmtTime(hk)} size={13} />
	</Readout>
	<Readout
		id="g-sort"
		order={4}
		label="n² (for comparison)"
		value="{fmtCount(n * n)}: {fmtTime(n * n)}"
	>
		<Txt
			x={636}
			y={402}
			text="n²: {fmtCount(n * n)} — {fmtTime(n * n)}"
			size={13}
			color="var(--tm-head)"
			weight={600}
		/>
	</Readout>
	<Readout id="g-note">
		<Txt x={636} y={448} text="A computer 1,000× faster lifts the time lines" size={12} muted />
		<Txt x={636} y={466} text="by three grid lines. Near 20 cities, brute force" size={12} muted />
		<Txt x={636} y={484} text="then gets only about two more cities." size={12} muted />
	</Readout>
</g>
