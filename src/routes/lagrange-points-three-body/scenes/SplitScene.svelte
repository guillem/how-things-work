<script lang="ts">
	/**
	 * Two Earth–Moon probes: A starts 0.8 of the way from Earth to the Moon, moving at right angles
	 * to the line with the energy halfway between the L1 and L2 gates; B starts the `nudge` farther
	 * out with the same velocity. A year, revealed over 30 s: the last month of each path, the
	 * forbidden region of A's energy, and on the right their distance apart on a log scale.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SYSTEMS, criticalC, daysPerUnit, omega, separation, type State } from '../model';
	import Pair from './Pair.svelte';
	import {
		C,
		MAIN,
		fmtKm,
		forbiddenCached,
		pathD,
		radii,
		runCached,
		sx,
		sy,
		type Picked
	} from './shared';

	let { t, params, reduced }: StageProps = $props();

	const S = SYSTEMS['earth-moon'];
	const P: Picked = { sys: S, mu: S.mu, name: S.name, big: S.big, small: S.small };
	const mu = S.mu;
	const crit = criticalC(mu);
	const Cj = (crit.L1 + crit.L2) / 2;
	const X0 = 0.8;
	const V0 = Math.sqrt(2 * omega(mu, X0, 0) - Cj);
	const DAYS = 365;
	const tEnd = DAYS / daysPerUnit(S);
	/** Samples per day (smooth paths); day d is sample d × SPD. */
	const SPD = 6;
	const N = DAYS * SPD + 1;
	const opts = { ...radii(P), far: 3 };

	const nudgeKm = $derived(10 ** clamp(Math.round(Number(params.nudge ?? 0)), -3, 3));
	const a = runCached(mu, [X0, 0, 0, V0], tEnd, N, opts);
	const b = $derived(runCached(mu, [X0 + nudgeKm / S.a, 0, 0, V0] as State, tEnd, N, opts));
	const sep = $derived(separation(a, b));

	const RUN_SECONDS = 30;
	const now = $derived(reduced ? N - 1 : Math.floor(clamp((t - 0.5) / RUN_SECONDS) * (N - 1)));
	const day = $derived(Math.floor(now / SPD));
	const iA = $derived(Math.min(now, a.n - 1));
	const iB = $derived(Math.min(now, b.n - 1));
	const TRAIL = 30 * SPD;
	const zvc = forbiddenCached(mu, Cj, MAIN, 6);

	/** First day the two are more than 10,000 km apart. */
	const splitDay = $derived.by(() => {
		for (let i = 0; i < sep.length; i++) if (sep[i] * S.a > 10_000) return Math.floor(i / SPD);
		return -1;
	});
	const apartNow = $derived(sep[Math.min(now, sep.length - 1)] * S.a);

	// ---- chart --------------------------------------------------------------------
	const R = { x0: 712, x1: 930, y0: 120, y1: 380 };
	const sxD = scale([0, DAYS], [R.x0, R.x1]);
	const syL = scale([-3, 6], [R.y1, R.y0]);
	const yFmt = (lv: number) =>
		lv < 0 ? `${10 ** (lv + 3)} m` : lv < 6 ? `${(10 ** lv).toLocaleString('en-US')} km` : '10⁶ km';
	const series = $derived(
		Array.from({ length: Math.ceil(Math.min(now + 1, sep.length) / 2) }, (_, j) => ({
			d: (2 * j) / SPD,
			v: clamp(Math.log10(Math.max(1e-6, sep[2 * j] * S.a)), -3, 6)
		}))
	);
	const nudgeText = $derived(nudgeKm < 1 ? `${Math.round(nudgeKm * 1000)} m` : fmtKm(nudgeKm));
	/** What a probe hit, once the reveal has reached that moment. */
	const fate = (p: typeof a) =>
		p.end && now >= p.n - 1
			? p.end === 'hit-small'
				? 'Moon'
				: p.end === 'hit-big'
					? 'Earth'
					: null
			: null;
</script>

<g>
	<defs>
		<clipPath id="lg-split-clip">
			<rect x={MAIN.x0} y={MAIN.y0} width={MAIN.x1 - MAIN.x0} height={MAIN.y1 - MAIN.y0} rx="12" />
		</clipPath>
	</defs>
	<g clip-path="url(#lg-split-clip)">
		<path
			d={zvc.fill}
			fill={C.forbidden}
			stroke={C.forbidden}
			stroke-width="0.8"
			shape-rendering="crispEdges"
			opacity="0.7"
		/>
		<path d={zvc.edge} fill="none" stroke={C.forbiddenEdge} stroke-width="1.2" opacity="0.7" />
		<path
			d={pathD(MAIN, b, iB - TRAIL, iB + 1)}
			fill="none"
			stroke={C.probeB}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<path
			d={pathD(MAIN, a, iA - TRAIL, iA + 1)}
			fill="none"
			stroke={C.probe}
			stroke-width="2"
			stroke-linejoin="round"
			stroke-dasharray={splitDay >= 0 && day >= splitDay ? 'none' : '6 6'}
		/>
		<Pair
			v={MAIN}
			{mu}
			big={P.big}
			small={P.small}
			rBig={15}
			rSmall={6}
			pointLabels={false}
			focus={['L1']}
		/>
		<circle
			cx={sx(MAIN, b.xy[2 * iB])}
			cy={sy(MAIN, b.xy[2 * iB + 1])}
			r="6"
			fill={C.probeB}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={sx(MAIN, a.xy[2 * iA])}
			cy={sy(MAIN, a.xy[2 * iA + 1])}
			r="5"
			fill={C.probe}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	</g>
	<rect
		x={MAIN.x0}
		y={MAIN.y0}
		width={MAIN.x1 - MAIN.x0}
		height={MAIN.y1 - MAIN.y0}
		rx="12"
		fill="none"
		stroke="var(--stage-line)"
	/>
	<Readout id="split-day" order={1} label="Day" value={String(day)}>
		<Label
			x={MAIN.x0 + 14}
			y={MAIN.y0 + 24}
			anchor="start"
			text="Earth–Moon, turning frame · day {day}"
			size={13}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="split-key">
		<Label
			x={MAIN.x0 + 14}
			y={MAIN.y1 - 14}
			anchor="start"
			text="lines: the last 30 days of each path; shaded: forbidden to both"
			size={11}
			muted
		/>
	</Readout>

	<!-- chart -->
	<Label
		x={R.x0 - 60}
		y={70}
		anchor="start"
		text="how far apart A and B are"
		size={13}
		weight={700}
	/>
	<Readout id="split-start" order={2} label="B starts" value="{nudgeText} from A">
		<Label
			x={R.x0 - 60}
			y={90}
			anchor="start"
			text="B started {nudgeText} from A, same velocity"
			size={11}
			muted
		/>
	</Readout>
	<Axes
		sx={sxD}
		sy={syL}
		xTicks={[0, 100, 200, 300]}
		yTicks={[-3, 0, 3, 6]}
		yFormat={yFmt}
		xLabel="days"
	/>
	<path
		d={linePath(
			series,
			(p) => p.d,
			(p) => p.v,
			sxD,
			syL
		)}
		fill="none"
		stroke={C.probeB}
		stroke-width="2.5"
	/>
	<line
		x1={R.x0}
		x2={R.x1}
		y1={syL(4)}
		y2={syL(4)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		stroke-dasharray="3 4"
	/>
	<Readout id="split-line">
		<Label x={R.x1} y={syL(4) - 6} anchor="end" text="10,000 km" size={11} muted />
	</Readout>
	<Readout
		id="split-apart"
		order={3}
		label="Apart now"
		value={apartNow < 1 ? `${Math.round(apartNow * 1000)} m` : fmtKm(apartNow)}
		color={C.probeB}
	>
		<Label
			x={R.x0 - 60}
			y={432}
			anchor="start"
			text="apart now: {apartNow < 1 ? `${Math.round(apartNow * 1000)} m` : fmtKm(apartNow)}"
			size={14}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="split-when"
		order={4}
		label="Split (10,000 km apart)"
		value={splitDay >= 0 ? `day ${splitDay}` : 'not within the year'}
	>
		<Label
			x={R.x0 - 60}
			y={456}
			anchor="start"
			text={splitDay >= 0
				? `10,000 km apart on day ${splitDay}`
				: 'still within 10,000 km after a year'}
			size={13}
			tabular
		/>
	</Readout>
	{#if fate(a) || fate(b)}
		<Readout
			id="split-fate"
			order={5}
			label="Crash"
			value="{fate(a) ? `A hit the ${fate(a)}` : ''}{fate(a) && fate(b) ? ', ' : ''}{fate(b)
				? `B hit the ${fate(b)}`
				: ''}"
		>
			<Label
				x={R.x0 - 60}
				y={480}
				anchor="start"
				text="{fate(a) ? `A hit the ${fate(a)} on day ${Math.floor((a.n - 1) / SPD)}` : ''}{fate(
					a
				) && fate(b)
					? ', '
					: ''}{fate(b) ? `B hit the ${fate(b)} on day ${Math.floor((b.n - 1) / SPD)}` : ''}"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}
	<Readout id="split-ab">
		<circle cx={R.x0 - 54} cy={514} r="5" fill={C.probe} />
		<Label
			x={R.x0 - 44}
			y={518}
			anchor="start"
			text="A"
			size={12}
			weight={700}
			color={C.probeText}
		/>
		<circle cx={R.x0 - 14} cy={514} r="5" fill={C.probeB} />
		<Label
			x={R.x0 - 4}
			y={518}
			anchor="start"
			text="B (under A while together)"
			size={12}
			weight={700}
			color={C.probeBText}
		/>
	</Readout>
</g>
