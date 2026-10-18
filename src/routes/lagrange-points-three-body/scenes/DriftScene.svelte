<script lang="ts">
	/**
	 * A probe dropped at rest 1,000 km off L1 or L2 (a thousandth of the distance to the small body
	 * for a pair set on the slider), in a window round the small body. Its path, revealed over
	 * about 16 s, runs until it is well clear of the point; on the right, its distance from the
	 * point on a logarithmic scale against time: a straight line while the growth is exponential,
	 * with the e-folding time of the linearised motion.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { growthRate, lagrangePoints, restingAt } from '../model';
	import Pair from './Pair.svelte';
	import {
		C,
		fmtDist,
		fmtTime,
		insetView,
		pathD,
		pick,
		presetLogMu,
		radii,
		runCached,
		sx,
		sy
	} from './shared';

	let { t, params, reduced, setParam }: StageProps = $props();

	const P = $derived(pick(params));
	const mu = $derived(P.mu);
	const presetLm = $derived(P.sys ? presetLogMu(P.sys.mu) : null);
	$effect(() => {
		const lm = presetLm;
		if (lm !== null) untrack(() => setParam('logmu', lm));
	});

	const which = $derived(params.drop === 'L2' ? 'L2' : 'L1');
	const L = $derived(lagrangePoints(mu));
	const pt = $derived(L[which]);
	const gamma = $derived(L.L2.x - (1 - mu));
	const BOX = { x0: 24, y0: 24, x1: 620, y1: 576 };
	const v = $derived(insetView(mu, gamma * 0.95, BOX));

	const lambda = $derived(growthRate(mu, pt));
	/** The offset: 1,000 km for a real pair, a thousandth of L1's distance otherwise. */
	const delta = $derived(P.sys ? 1000 / P.sys.a : 1e-3 * (1 - mu - L.L1.x));
	const dir = $derived(which === 'L1' ? 1 : -1); // towards the small body
	const tEnd = $derived(Math.min(4 * Math.PI, (Math.log((1.6 * gamma) / delta) + 0.8) / lambda));
	const N = 481;
	const path = $derived(
		runCached(mu, restingAt(pt, dir * delta, 0), tEnd, N, { ...radii(P), far: 4 })
	);

	const RUN_SECONDS = 16;
	const shown = $derived(
		reduced ? path.n : Math.max(2, Math.ceil(clamp((t - 0.5) / RUN_SECONDS) * path.n))
	);
	const iNow = $derived(Math.max(0, shown - 1));
	const dist = (i: number) => Math.hypot(path.xy[2 * i] - pt.x, path.xy[2 * i + 1] - pt.y);
	const dNow = $derived(dist(iNow));
	const head = $derived({ X: sx(v, path.xy[2 * iNow]), Y: sy(v, path.xy[2 * iNow + 1]) });

	// ---- distance against time ----------------------------------------------------
	const R = { x0: 712, x1: 930, y0: 120, y1: 400 };
	const sxT = $derived(scale([0, tEnd], [R.x0, R.x1]));
	/** Distances are charted in km for a real pair, in separations otherwise. */
	const unit = $derived(P.sys ? P.sys.a : 1);
	const lg = (d: number) => Math.log10(Math.max(1e-15, d * unit));
	const dMin = $derived(Math.floor(lg(delta)) - 0.2);
	const dMax = $derived(Math.ceil(lg(Math.max(2 * gamma, delta * 10))));
	const syD = $derived(scale([dMin, dMax], [R.y1, R.y0]));
	const yTicks = $derived(
		Array.from(
			{ length: Math.floor(dMax) - Math.ceil(dMin) + 1 },
			(_, i) => Math.ceil(dMin) + i
		).filter((_, i, a) => a.length <= 6 || i % 2 === (a.length - 1) % 2)
	);
	const SUP: Record<string, string> = {
		'-': '⁻',
		'0': '⁰',
		'1': '¹',
		'2': '²',
		'3': '³',
		'4': '⁴',
		'5': '⁵',
		'6': '⁶',
		'7': '⁷',
		'8': '⁸',
		'9': '⁹'
	};
	const yFmt = (lv: number) => {
		if (!P.sys) return `10${String(lv).replace(/./g, (c) => SUP[c] ?? c)}`;
		const km = 10 ** lv;
		if (km >= 1e6) return `${km / 1e6}M km`;
		return `${km.toLocaleString('en-US')} km`;
	};
	const xTicks = $derived(Array.from({ length: 5 }, (_, i) => (tEnd * i) / 4));
	const series = $derived(
		Array.from({ length: shown }, (_, i) => ({
			t: path.t[i],
			d: Math.log10(Math.max(1e-15, dist(i)))
		}))
	);
	/** The linear theory: δ e^{λt}. */
	const theory = $derived([
		{ t: 0, d: lg(delta) },
		{ t: tEnd, d: lg(delta) + (lambda * tEnd) / Math.LN10 }
	]);
	const eFold = $derived(fmtTime(P, 1 / lambda));
</script>

<g>
	<defs>
		<clipPath id="lg-drift-clip">
			<rect x={BOX.x0} y={BOX.y0} width={BOX.x1 - BOX.x0} height={BOX.y1 - BOX.y0} rx="12" />
		</clipPath>
	</defs>
	<g clip-path="url(#lg-drift-clip)">
		<line
			x1={BOX.x0}
			x2={BOX.x1}
			y1={v.cy}
			y2={v.cy}
			stroke={C.orbit}
			stroke-width="1"
			stroke-dasharray="4 5"
		/>
		<path
			d={pathD(v, path, 0, shown)}
			fill="none"
			stroke={C.probe}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<Pair {v} {mu} big={P.big} small={P.small} rSmall={12} focus={[which]} />
		<circle
			cx={head.X}
			cy={head.Y}
			r="6"
			fill={C.probe}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	</g>
	<rect
		x={BOX.x0}
		y={BOX.y0}
		width={BOX.x1 - BOX.x0}
		height={BOX.y1 - BOX.y0}
		rx="12"
		fill="none"
		stroke="var(--stage-line)"
	/>
	<Readout
		id="drift-title"
		order={1}
		label="Dropped"
		value="{fmtDist(P, delta)} off {which}, at rest"
	>
		<Label
			x={BOX.x0 + 14}
			y={BOX.y0 + 24}
			anchor="start"
			text="{P.name}: dropped {fmtDist(P, delta)} off {which}, at rest"
			size={13}
			weight={600}
		/>
	</Readout>
	<Readout id="drift-dir">
		<Label
			x={BOX.x0 + 14}
			y={BOX.y1 - 14}
			anchor="start"
			text="← towards the {P.big}"
			size={11}
			muted
		/>
	</Readout>

	<!-- chart -->
	<Label x={R.x0 - 60} y={70} anchor="start" text="distance from {which}" size={13} weight={700} />
	<Label
		x={R.x0 - 60}
		y={90}
		anchor="start"
		text="log scale: a straight line is exponential growth"
		size={11}
		muted
	/>
	<Axes
		sx={sxT}
		sy={syD}
		{xTicks}
		{yTicks}
		xFormat={(x: number) =>
			x === 0
				? '0'
				: fmtTime(P, x)
						.replace(' days', ' d')
						.replace(' months', ' mo')
						.replace(' years', ' yr')
						.replace(' turns', '')}
		yFormat={yFmt}
	/>
	<path
		d={linePath(
			theory,
			(p) => p.t,
			(p) => p.d,
			sxT,
			syD
		)}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="5 4"
	/>
	<path
		d={linePath(
			series,
			(p) => p.t,
			(p) => clamp(p.d, dMin, dMax),
			sxT,
			syD
		)}
		fill="none"
		stroke={C.probe}
		stroke-width="2.5"
	/>
	<Readout
		id="drift-now"
		order={2}
		label="After {fmtTime(P, path.t[iNow])}"
		value="{fmtDist(P, dNow)} from {which}"
		color={C.probe}
	>
		<Label
			x={R.x0 - 60}
			y={450}
			anchor="start"
			text="after {fmtTime(P, path.t[iNow])}"
			size={15}
			weight={700}
			tabular
		/>
		<Label
			x={R.x0 - 60}
			y={472}
			anchor="start"
			text="{fmtDist(P, dNow)} from {which}"
			size={13}
			color={C.probeText}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="drift-efold" order={3} label="Grows by e every" value={eFold}>
		<Label
			x={R.x0 - 60}
			y={506}
			anchor="start"
			text="dashed: the linear theory, ×e every {eFold}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	{#if path.end === 'hit-small' || path.end === 'hit-big'}
		<Readout
			id="drift-hit"
			order={4}
			label="Fate"
			value="hit the {path.end === 'hit-big' ? P.big : P.small}"
		>
			<Label
				x={R.x0 - 60}
				y={530}
				anchor="start"
				text="it hit the {path.end === 'hit-big' ? P.big : P.small}"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
