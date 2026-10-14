<script lang="ts">
	/**
	 * Two receivers, both with perfect clocks of their own, using satellite clocks left
	 * without the relativity rate correction (`model.scenario`): one trusts its clock, the other
	 * solves for it. A plan of the ground round the true position (±50 km) and a height strip
	 * show where each fix lands; the panel gives the numbers.
	 *
	 * `params.corrected` puts the correction back (no drift); `params.days` is how long the
	 * clocks have run uncorrected; `params.ecc` also leaves out the per-satellite eccentricity
	 * term. The days count up to `params.days` over the first 3 s of the step (a pure function
	 * of t); under reduced motion the frame shows the final state.
	 */
	import { Label, clamp, easeInOut } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, microsPerDay, A_GPS, norm, scenario } from '../model';
	import { placeById } from '../places';

	let { t, params, reduced }: StageProps = $props();

	const where = $derived(placeById(params.place));
	const hour = $derived(Number(params.hour ?? 0));
	const corrected = $derived(Boolean(params.corrected));
	const target = $derived(corrected ? 0 : Number(params.days ?? 1));
	const days = $derived(reduced ? target : target * easeInOut(clamp(t / 3)));
	const ecc = $derived(Boolean(params.ecc));

	const sc = $derived(scenario(where.lat, where.lon, hour * 3600, { days, eccentricity: ecc }));
	/** The trusting receiver's error grows in proportion to the days (same geometry). */
	const perDay = $derived(scenario(where.lat, where.lon, hour * 3600, { days: 1 }).trustingErr);
	const drift = microsPerDay(A_GPS).net;

	// ---- plan and height strip ---------------------------------------------------------------
	const PX0 = 40;
	const PY0 = 70;
	const PS = 440; // plan size: ±55 km
	const KPX = PS / 110; // units per km
	const pcx = PX0 + PS / 2;
	const pcy = PY0 + PS / 2;
	const HX = 506;
	const HW = 64;
	const H0 = PY0 + PS - 40; // height 0 on the strip
	const HK = (PS - 60) / 150; // units per km of height (0…150 km)

	const trust = $derived(sc.trustingErr ?? [0, 0, 0]);
	const solved = $derived(sc.solvedErr ?? [0, 0, 0]);
	const tp = $derived({ x: pcx + trust[0] * 1e-3 * KPX, y: pcy - trust[1] * 1e-3 * KPX });
	const sp = $derived({ x: pcx + solved[0] * 1e-3 * KPX, y: pcy - solved[1] * 1e-3 * KPX });
	const th = $derived(H0 - clamp(trust[2] * 1e-3, -15, 152) * HK);
	const shh = $derived(H0 - clamp(solved[2] * 1e-3, -15, 152) * HK);
	/** The trusting fix's path over 0…7 days (a straight line: the error grows linearly). */
	const pathEnd = $derived(
		perDay
			? { x: pcx + perDay[0] * 7e-3 * KPX, y: pcy - perDay[1] * 7e-3 * KPX }
			: { x: pcx, y: pcy }
	);

	const km = (m: number) => `${(m / 1000).toFixed(1)} km`;
	const len = (v: number[]) => norm(v);
	/** A length in km, or in metres below 1 km. */
	const size = (m: number) => (Math.abs(m) < 1000 ? `${m.toFixed(1)} m` : km(m));
	const dist = (m: number) =>
		m < 0.005 ? 'on the spot' : m < 1000 ? `${m.toFixed(m < 10 ? 1 : 0)} m off` : `${km(m)} off`;
	const gainUs = $derived(drift * days);
	const rangeKm = $derived((gainUs * 1e-6 * C) / 1000);
	const clockUs = $derived(sc.solved ? (-sc.solved.clock / C) * 1e6 : 0);

	const PANEL = 640;
	const PW = 304;
</script>

<g>
	<!-- plan -->
	<rect
		x={PX0}
		y={PY0}
		width={PS}
		height={PS}
		rx="8"
		fill="var(--gps-map)"
		stroke="var(--stage-line)"
	/>
	{#each [-50, -40, -30, -20, -10, 10, 20, 30, 40, 50] as k (k)}
		<path
			d="M{pcx + k * KPX} {PY0}v{PS}M{PX0} {pcy + k * KPX}h{PS}"
			stroke="var(--stage-grid)"
			stroke-width={k % 50 === 0 ? 1.2 : 0.8}
		/>
	{/each}
	<Readout id="plan-title">
		<Label x={pcx} y={PY0 - 14} text="Seen from above (grid: 10 km)" size={13} weight={600} />
		<Label x={pcx} y={PY0 + 16} text="N" size={12} muted />
	</Readout>
	{#if !corrected}
		<path
			d="M{pcx} {pcy}L{pathEnd.x} {pathEnd.y}"
			stroke="var(--gps-trust)"
			stroke-width="1.2"
			stroke-dasharray="3 4"
			opacity="0.5"
		/>
	{/if}
	<path d="M{pcx - 9} {pcy}h18M{pcx} {pcy - 9}v18" stroke="var(--stage-ink)" stroke-width="2" />
	<circle cx={sp.x} cy={sp.y} r="10" fill="none" stroke="var(--gps-fix)" stroke-width="2.5" />
	<path
		d="M{tp.x - 7} {tp.y - 7}l14 14m-14 0l14 -14"
		stroke="var(--gps-trust)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	<Readout id="plan-key">
		<Label x={PX0 + 12} y={PY0 + PS - 14} text="+ true position" size={11} muted anchor="start" />
	</Readout>

	<!-- height strip -->
	<rect
		x={HX}
		y={PY0}
		width={HW}
		height={PS}
		rx="8"
		fill="var(--gps-map)"
		stroke="var(--stage-line)"
	/>
	{#each [0, 50, 100, 150] as h (h)}
		<path
			d="M{HX} {H0 - h * HK}h{HW}"
			stroke="var(--stage-grid)"
			stroke-width={h === 0 ? 1.5 : 0.8}
		/>
		<Readout id="h-{h}">
			<Label x={HX + HW + 8} y={H0 - h * HK + 4} text="{h} km" size={11} muted anchor="start" />
		</Readout>
	{/each}
	<Readout id="h-title">
		<Label x={HX + HW / 2} y={PY0 - 14} text="Height" size={13} weight={600} />
	</Readout>
	<path d="M{HX + 8} {H0}h{HW - 16}" stroke="var(--stage-ink)" stroke-width="2" />
	<circle cx={HX + HW / 2} cy={shh} r="8" fill="none" stroke="var(--gps-fix)" stroke-width="2.5" />
	<path
		d="M{HX + HW / 2 - 7} {th - 7}l14 14m-14 0l14 -14"
		stroke="var(--gps-trust)"
		stroke-width="3"
		stroke-linecap="round"
	/>

	<!-- panel -->
	<Readout id="panel">
		<rect
			x={PANEL}
			y={16}
			width={PW}
			height={568}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="sats"
		order={0}
		label="Satellite clocks"
		value={corrected ? 'corrected' : `+${gainUs.toFixed(1)} µs fast`}
	>
		<text x={PANEL + 18} y={50} class="muted" style:font-size="12px"
			>{corrected
				? 'Satellite clocks'
				: `Satellite clocks, after ${days.toFixed(1)} ${days.toFixed(1) === '1.0' ? 'day' : 'days'}`}</text
		>
		<text x={PANEL + 18} y={74} style:font-size="15px" font-weight="600"
			>{corrected ? 'corrected: on time' : `${gainUs.toFixed(1)} µs fast`}</text
		>
		<text x={PANEL + 18} y={96} class="muted" style:font-size="12px"
			>{corrected ? 'every range right' : `every range ${rangeKm.toFixed(1)} km short`}</text
		>
	</Readout>

	<Readout
		id="trust"
		order={1}
		label="Trusts its own clock"
		value={dist(len(trust))}
		color="var(--gps-trust)"
	>
		<path
			d="M{PANEL + 19} 140l12 12m-12 0l12 -12"
			stroke="var(--gps-trust)"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<text x={PANEL + 40} y={151} style:font-size="14px" font-weight="600">Trusts its own clock</text
		>
		<text x={PANEL + 40} y={174} style:font-size="13px">position: {dist(len(trust))}</text>
		<text x={PANEL + 40} y={194} class="muted" style:font-size="12px"
			>{len(trust) < 5
				? 'time: right'
				: `${size(Math.hypot(trust[0], trust[1]))} across, ${size(trust[2])} up`}</text
		>
	</Readout>

	<Readout
		id="solve"
		order={2}
		label="Solves for its clock"
		value="{dist(len(solved))}; time {clockUs < 0.0005
			? 'right'
			: `${clockUs.toFixed(1)} µs ahead`}"
		color="var(--gps-fix)"
	>
		<circle cx={PANEL + 25} cy={240} r="7" fill="none" stroke="var(--gps-fix)" stroke-width="2.2" />
		<text x={PANEL + 40} y={245} style:font-size="14px" font-weight="600">Solves for its clock</text
		>
		<text x={PANEL + 40} y={268} style:font-size="13px">position: {dist(len(solved))}</text>
		<text x={PANEL + 40} y={288} style:font-size="13px"
			>time: {clockUs < 0.0005 ? 'right' : `${clockUs.toFixed(1)} µs ahead`}</text
		>
	</Readout>

	<Readout id="note">
		<text x={PANEL + 18} y={524} class="muted" style:font-size="12px"
			>{sc.sats.length} satellites in view from {where.name.split(',')[0]}.</text
		>
		<text x={PANEL + 18} y={544} class="muted" style:font-size="12px"
			>Both receivers have perfect clocks.</text
		>
		<text x={PANEL + 18} y={564} class="muted" style:font-size="12px"
			>{ecc ? 'Eccentricity correction also left out.' : 'Eccentricity correction applied.'}</text
		>
	</Readout>
</g>
