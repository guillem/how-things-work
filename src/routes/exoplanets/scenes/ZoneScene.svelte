<script lang="ts">
	/**
	 * The habitable zone (step zone). Left: the star seen from above with its
	 * zone (Kopparapu et al. 2014: conservative band, paler optimistic edges) and
	 * the reader's planet, dragged in and out (`dist`). For the Sun, the orbits of
	 * Mercury to Mars for reference. Right: the classic chart of starlight
	 * received against the star's temperature, with the zone's band and real
	 * planets from the archive. The planet glints round its orbit as a pure
	 * function of t (one turn per ORBIT_S s); the handle sits on the planet.
	 */
	import { Handle, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HZ_TEFF_RANGE,
		archivePlanet,
		habitableZone,
		hzFlux,
		insolation,
		periodDays,
		zoneOf,
		type HzLimit
	} from '../exoplanets';
	import { STARS, type StarId } from '../exoplanets';
	import { distValue, fmtAU, readerSystem } from '../systems';
	import Card from './Card.svelte';
	import T from './T.svelte';
	import { duration, sig, starColor } from './ui';

	let { t, params, reduced, setParam }: StageProps = $props();

	const ORBIT_S = 14;

	// ---- left: top view -------------------------------------------------------------
	const TX = 243;
	const TY = 210;
	const TR = 178; // px for the drawn range
	const sys = $derived(readerSystem(params));
	const st = $derived(sys.star);
	const pl = $derived(sys.planet);
	const starId = $derived(
		(String(params.star ?? 'sun') in STARS ? String(params.star ?? 'sun') : 'sun') as StarId
	);
	const hz = $derived(habitableZone(st));
	const range = $derived(hz.optimisticOuter * 1.3); // AU at the edge of the drawing
	const pxPerAU = $derived(TR / range);
	const S = $derived(insolation(st, pl));
	const zone = $derived(zoneOf(S, st.teff));
	const P = $derived(periodDays(st, pl));
	const color = $derived(starColor(st.teff));
	const ang = $derived(-Math.PI / 5 + (reduced ? 0 : (2 * Math.PI * t) / ORBIT_S));
	const rPx = $derived(Math.min(TR, pl.a * pxPerAU));
	const beyond = $derived(pl.a * pxPerAU > TR);
	const planetXY = $derived({ x: TX + rPx * Math.cos(ang), y: TY + rPx * Math.sin(ang) });
	const SOLAR = [
		{ id: 'mercury', label: 'Mercury', a: 0.387 },
		{ id: 'venus', label: 'Venus', a: 0.723 },
		{ id: 'earth', label: 'Earth', a: 1.0 },
		{ id: 'mars', label: 'Mars', a: 1.524 }
	];
	const zoneColor = $derived(
		zone === 'habitable zone'
			? 'var(--ex-hz-edge)'
			: zone === 'optimistic'
				? 'var(--ex-hz-edge)'
				: zone === 'too hot'
					? 'var(--ex-red)'
					: 'var(--ex-blue)'
	);
	const verdict = $derived(
		zone === 'habitable zone'
			? 'in the habitable zone'
			: zone === 'optimistic'
				? 'at the edge (optimistic zone)'
				: zone === 'too hot'
					? 'too close: too hot'
					: 'too far: too cold'
	);

	function setFrom(p: Point) {
		const a = Math.hypot(p.x - TX, p.y - TY) / pxPerAU;
		const v = Math.round(distValue(Math.min(5.2, Math.max(0.01, a))) * 100) / 100;
		setParam('dist', v);
	}
	function onkey(s: number | 'start' | 'end') {
		const cur = distValue(pl.a);
		const v = s === 'start' ? -2 : s === 'end' ? Math.log10(5.2) : cur + s * 0.01;
		setParam('dist', Math.round(Math.min(Math.log10(5.2), Math.max(-2, v)) * 100) / 100);
	}

	// ---- right: the chart ------------------------------------------------------------
	const CX0 = 548;
	const CX1 = 926;
	const CY0 = 70;
	const CY1 = 470;
	const S_HI = 4; // left edge (hotter)
	const S_LO = 0.15; // right edge
	const T_LO = 2400;
	const T_HI = 7300;
	const lx = scale([Math.log10(S_HI), Math.log10(S_LO)], [CX0, CX1]);
	const sxS = (s: number) => lx(Math.log10(Math.min(S_HI, Math.max(S_LO, s))));
	const syT = scale([T_LO, T_HI], [CY1, CY0]);
	const band = (lo: HzLimit, hi: HzLimit) => {
		const pts: string[] = [];
		const [t0, t1] = HZ_TEFF_RANGE;
		for (let i = 0; i <= 40; i++) {
			const T = t0 + ((t1 - t0) * i) / 40;
			pts.push(`${i ? 'L' : 'M'}${sxS(hzFlux(lo, T)).toFixed(1)} ${syT(T).toFixed(1)}`);
		}
		for (let i = 40; i >= 0; i--) {
			const T = t0 + ((t1 - t0) * i) / 40;
			pts.push(`L${sxS(hzFlux(hi, T)).toFixed(1)} ${syT(T).toFixed(1)}`);
		}
		return pts.join(' ') + 'Z';
	};
	const optBand = band('recentVenus', 'earlyMars');
	const consBand = band('runawayGreenhouse', 'maximumGreenhouse');
	const S_TICKS = [4, 2, 1, 0.5, 0.25];
	const T_TICKS = [3000, 4000, 5000, 6000, 7000];

	// Real planets: the archive's insolation and star temperature. Solar System: 1/a².
	const REAL = [
		{ id: 'venus', label: 'Venus', s: 1 / 0.723 ** 2, teff: 5772, dx: 8, dy: -8, anchor: 'start' },
		{ id: 'earth', label: 'Earth', s: 1, teff: 5772, dx: 0, dy: -12, anchor: 'middle' },
		{ id: 'mars', label: 'Mars', s: 1 / 1.524 ** 2, teff: 5772, dx: 0, dy: -12, anchor: 'middle' },
		...(
			[
				['Kepler-22 b', 8, 16, 'start'],
				['Kepler-186 f', 8, 4, 'start'],
				['Proxima Cen b', 9, -2, 'start'],
				['TRAPPIST-1 e', 9, 12, 'start']
			] as const
		).map(([name, dx, dy, anchor]) => {
			const p = archivePlanet(name);
			return { id: name, label: name, s: p.insolation ?? NaN, teff: p.star.teff, dx, dy, anchor };
		})
	] as const;
	const youXY = $derived({ x: sxS(S), y: syT(Math.min(T_HI, Math.max(T_LO, st.teff))) });
	const offChart = $derived(S > S_HI ? 'left' : S < S_LO ? 'right' : '');
</script>

<g>
	<!-- ---- top view ---- -->
	<rect
		x={16}
		y={16}
		width={454}
		height={404}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<Readout id="top-title">
		<T x={32} y={42} text="{STARS[starId].name} from above" size={14} weight={700} />
		<T x={32} y={60} text="green: the habitable zone · to scale" size={11.5} muted />
	</Readout>
	<circle cx={TX} cy={TY} r={hz.optimisticOuter * pxPerAU} fill="var(--ex-hz-opt)" />
	<circle cx={TX} cy={TY} r={hz.outer * pxPerAU} fill="var(--ex-hz)" />
	<circle cx={TX} cy={TY} r={hz.inner * pxPerAU} fill="var(--ex-hz-opt)" />
	<circle cx={TX} cy={TY} r={hz.optimisticInner * pxPerAU} fill="var(--ex-space)" />
	{#if starId === 'sun'}
		{#each SOLAR as o (o.id)}
			<circle
				cx={TX}
				cy={TY}
				r={o.a * pxPerAU}
				fill="none"
				stroke="var(--ex-orbit)"
				stroke-dasharray="2 4"
				opacity="0.6"
			/>
			<T x={TX} y={TY - o.a * pxPerAU - 4} text={o.label} size={10.5} anchor="middle" muted />
		{/each}
	{/if}
	<circle
		cx={TX}
		cy={TY}
		r={rPx}
		fill="none"
		stroke="var(--ex-planet)"
		stroke-width="1.2"
		opacity="0.5"
	/>
	<circle cx={TX} cy={TY} r={Math.max(4, Math.min(10, st.radius * 7))} fill={color} />
	<Handle
		x={planetXY.x}
		y={planetXY.y}
		label="Planet’s distance from its star"
		value={pl.a}
		min={0.01}
		max={5.2}
		valuetext="{fmtAU(pl.a)} AU"
		color="var(--ex-measure)"
		r={7}
		onmove={setFrom}
		{onkey}
	/>
	{#if beyond}
		<T
			x={planetXY.x}
			y={planetXY.y + 24}
			text="further out: {fmtAU(pl.a)} AU"
			size={11.5}
			anchor="middle"
			weight={600}
		/>
	{/if}
	<Readout
		id="zone-range"
		order={3}
		label="Habitable zone"
		value="{fmtAU(hz.inner)}–{fmtAU(hz.outer)} AU"
	>
		<T
			x={32}
			y={404}
			text="zone: {fmtAU(hz.inner)}–{fmtAU(hz.outer)} AU (optimistic {fmtAU(
				hz.optimisticInner
			)}–{fmtAU(hz.optimisticOuter)})"
			size={11.5}
			muted
		/>
	</Readout>

	<!-- ---- readouts ---- -->
	<Card x={16} y={432} w={454} h={152} />
	<Readout
		id="star"
		order={0}
		label="Star"
		value="{STARS[starId].type}, {Math.round(st.teff)} K, {sig(st.lum, 2)} × the Sun’s light"
	>
		<T
			x={32}
			y={458}
			text="{STARS[starId].type} · {Math.round(st.teff).toLocaleString('en-US')} K · {sig(
				st.lum,
				2
			)} × the Sun’s light"
			size={12}
			muted
		/>
	</Readout>
	<Readout
		id="light"
		order={1}
		label="Starlight on the planet"
		value="{sig(S, 2)} × what the Earth gets"
	>
		<T x={32} y={486} text="Planet at {fmtAU(pl.a)} AU gets" size={12.5} muted />
		<T
			x={454}
			y={486}
			text="{sig(S, 2)} × the Earth’s sunlight"
			size={13.5}
			weight={650}
			anchor="end"
		/>
	</Readout>
	<Readout id="verdict" order={2} label="So it is" value={verdict} color={zoneColor}>
		<T x={32} y={516} text={verdict} size={15} weight={700} color={zoneColor} />
	</Readout>
	<Readout id="year" order={4} label="Its year" value={duration(P)}>
		<T x={454} y={516} text="year: {duration(P)}" size={12.5} anchor="end" muted />
	</Readout>
	<Readout
		id="m-pitfall"
		order={9}
		label="Note"
		value="In the zone, water could be liquid on a planet with the right air; it doesn’t mean anyone lives there."
	>
		<T
			x={32}
			y={546}
			text="In the zone, water could be liquid on a planet with"
			size={11.5}
			muted
		/>
		<T x={32} y={564} text="the right air. It doesn’t mean anyone lives there." size={11.5} muted />
	</Readout>

	<!-- ---- the chart ---- -->
	<rect
		x={486}
		y={16}
		width={458}
		height={568}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="chart-title">
		<T x={502} y={42} text="Real planets on the map" size={14} weight={700} />
	</Readout>
	<path d={optBand} fill="var(--ex-hz-opt)" />
	<path d={consBand} fill="var(--ex-hz)" />
	{#each S_TICKS as s (s)}
		<line x1={sxS(s)} x2={sxS(s)} y1={CY0} y2={CY1} stroke="var(--stage-grid)" />
		<text x={sxS(s)} y={CY1 + 17} text-anchor="middle" font-size="11" class="muted">{s}</text>
	{/each}
	{#each T_TICKS as v (v)}
		<line x1={CX0} x2={CX1} y1={syT(v)} y2={syT(v)} stroke="var(--stage-grid)" />
		<text x={CX0 - 7} y={syT(v) + 4} text-anchor="end" font-size="11" class="muted"
			>{v.toLocaleString('en-US')}</text
		>
	{/each}
	<line x1={CX0} x2={CX1} y1={CY1} y2={CY1} stroke="var(--stage-line)" />
	<line x1={CX0} x2={CX0} y1={CY0} y2={CY1} stroke="var(--stage-line)" />
	<T
		x={CX1}
		y={CY1 + 36}
		text="starlight received (Earth = 1) → less"
		size={11}
		anchor="end"
		muted
	/>
	<T x={CX0} y={CY0 - 10} text="star’s temperature (K)" size={11} muted />
	{#each REAL as r (r.id)}
		<circle cx={sxS(r.s)} cy={syT(r.teff)} r="4.5" fill="var(--stage-ink)" />
		<T x={sxS(r.s) + r.dx} y={syT(r.teff) + r.dy} text={r.label} size={11} anchor={r.anchor} />
	{/each}
	<!-- the reader's planet -->
	<circle
		cx={youXY.x}
		cy={youXY.y}
		r="7"
		fill="var(--ex-measure)"
		stroke="var(--surface)"
		stroke-width="2"
	/>
	<T
		x={offChart === 'left' ? CX0 + 8 : offChart === 'right' ? CX1 - 8 : youXY.x - 10}
		y={youXY.y + (offChart ? 40 : 18)}
		text={offChart ? `yours: ${sig(S, 2)}× (off the chart)` : 'yours'}
		size={11.5}
		weight={700}
		anchor={offChart === 'left' ? 'start' : 'end'}
		color="var(--ex-measure)"
	/>
	<Readout id="chart-note">
		<T x={502} y={528} text="Planets: NASA Exoplanet Archive. Zone: Kopparapu" size={11} muted />
		<T
			x={502}
			y={544}
			text="et al. 2014, for stars of 2 600–7 200 K (TRAPPIST-1,"
			size={11}
			muted
		/>
		<T x={502} y={560} text="2 566 K, is just below the fitted range)." size={11} muted />
	</Readout>
</g>
