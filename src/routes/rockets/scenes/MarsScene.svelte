<script lang="ts">
	/**
	 * The trip to Mars, seen from above the Sun (the Earth's orbit to scale).
	 * - hohmann: circular orbits at the mean distances. The craft leaves on the Hohmann ellipse
	 *   while Mars starts `params.lead` degrees ahead of the Earth; both planets move at their
	 *   real rates for the 259-day flight, so Mars is either there on arrival or not.
	 * - window: the real planets (JPL elements, flattened into one plane) on the date
	 *   `params.depart` (days after 1 January 2026), with a transfer of `params.flight` days
	 *   from Lambert's problem (`marsTrip()` in `space.ts`). The card plots the cost of the
	 *   trip against the departure date for that flight time: the launch windows are the dips.
	 * Each flight lasts 8 s on screen, then the arrival is held and the flight repeats.
	 */
	import { clamp, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { at, conic, marsHohmann, marsTrip, MU_SUN, planet, type Vec } from '../space';
	import { WINDOW_DAYS, WINDOW_START, dateOf } from '../steps';
	import { AU, DAY } from '../vehicles';
	import Card from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'hohmann'));
	const PANEL = { x: 16, y: 16, w: 584, h: 568 };
	const CARD = { x: 616, y: 16, w: 328, h: 568 };
	const CL = CARD.x + 20;
	const CR = CARD.x + CARD.w - 20;
	const CX = 308;
	const CY = 300;
	const K = 150 / AU; // px per m: 1 AU = 150 px
	const toS = (r: Vec) => ({ x: CX + r.x * K, y: CY - r.y * K });

	const FLY = 8;
	const HOLD = 3;
	const local = $derived(reduced ? FLY + 1 : t % (FLY + HOLD));
	const u = $derived(clamp(local / FLY));
	const arrived = $derived(local >= FLY);

	const fmt = (v: number, d = 1) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const dateText = (days: number) =>
		dateOf(days).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});

	// ---- hohmann ------------------------------------------------------------------------------
	const H = marsHohmann();
	const nE = Math.sqrt(MU_SUN / H.r1 ** 3);
	const nM = Math.sqrt(MU_SUN / H.r2 ** 3);
	const E0 = (200 * Math.PI) / 180; // the Earth's direction at departure
	const transfer = conic(
		MU_SUN,
		{ x: H.r1 * Math.cos(E0), y: H.r1 * Math.sin(E0) },
		{
			x: -Math.sin(E0) * (Math.sqrt(MU_SUN / H.r1) + H.dv1),
			y: Math.cos(E0) * (Math.sqrt(MU_SUN / H.r1) + H.dv1)
		}
	);
	const lead = $derived((clamp(Number(params.lead ?? 15), -60, 120) * Math.PI) / 180);
	const leadNeeded = H.lead;
	const tH = $derived(u * H.time);
	const earthH = $derived({ x: H.r1 * Math.cos(E0 + nE * tH), y: H.r1 * Math.sin(E0 + nE * tH) });
	const marsAng = (s: number) => E0 + lead + nM * s;
	const marsH = $derived({ x: H.r2 * Math.cos(marsAng(tH)), y: H.r2 * Math.sin(marsAng(tH)) });
	const craftH = $derived(at(transfer, tH).r);
	const missDeg = $derived(((lead - leadNeeded) * 180) / Math.PI);
	const missKm = $derived(2 * H.r2 * Math.abs(Math.sin((lead - leadNeeded) / 2)));
	const hit = $derived(Math.abs(missDeg) < 2.5);
	const transferPathH = (() => {
		let d = '';
		for (let i = 0; i <= 80; i++) {
			const p = toS(at(transfer, (i / 80) * H.time).r);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d;
	})();
	const arrivalPoint = toS(at(transfer, H.time).r);
	const departPoint = toS(at(transfer, 0).r);

	// ---- window -------------------------------------------------------------------------------
	const departDay = $derived(WINDOW_START + clamp(Number(params.depart ?? 120), 0, WINDOW_DAYS));
	const flightDays = $derived(clamp(Number(params.flight ?? 260), 120, 400));
	const trip = $derived(phase === 'window' ? marsTrip(departDay, flightDays) : null);
	const orbitOf = (name: 'earth' | 'mars', days: number) => {
		const period = name === 'earth' ? 365.25 : 687;
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const p = toS(planet(name, days + (i / 120) * period).r);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d + 'Z';
	};
	const EARTH_ORBIT = orbitOf('earth', WINDOW_START);
	const MARS_ORBIT = orbitOf('mars', WINDOW_START);
	const nowDay = $derived(departDay + u * flightDays);
	const earthW = $derived(planet('earth', nowDay).r);
	const marsW = $derived(planet('mars', nowDay).r);
	const craftW = $derived(trip ? at(trip.orbit, u * flightDays * DAY).r : null);
	const tripPath = $derived.by(() => {
		if (!trip) return '';
		let d = '';
		for (let i = 0; i <= 80; i++) {
			const p = toS(at(trip.orbit, (i / 80) * flightDays * DAY).r);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d;
	});

	// The cost curve against the departure date, for this flight time.
	const CH = { x: CL + 26, y: CARD.y + 300, w: CARD.w - 66, h: 150 };
	const cx = scale([0, WINDOW_DAYS], [CH.x, CH.x + CH.w]);
	const cy = scale([5, 20], [CH.y + CH.h, CH.y]);
	const curve = $derived.by(() => {
		const lows: { day: number; total: number }[] = [];
		if (phase !== 'window') return { d: '', min: 0, lows };
		let d = '';
		let min = Infinity;
		let pen = false;
		const totals: number[] = [];
		for (let day = 0; day <= WINDOW_DAYS; day += 5) {
			const tr = marsTrip(WINDOW_START + day, flightDays);
			totals.push(tr ? tr.total : Infinity);
			if (!tr) {
				pen = false;
				continue;
			}
			min = Math.min(min, tr.total);
			const y = cy(Math.min(20, tr.total / 1000));
			d += `${pen ? 'L' : 'M'}${cx(day).toFixed(1)} ${y.toFixed(1)}`;
			pen = true;
		}
		// The bottom of each window: the windows differ in cost, so each is judged on its own.
		for (let i = 0; i < totals.length; i++)
			if (
				Number.isFinite(totals[i]) &&
				totals[i] <= (totals[i - 1] ?? Infinity) &&
				totals[i] <= (totals[i + 1] ?? Infinity)
			)
				lows.push({ day: i * 5, total: totals[i] });
		return { d, min, lows };
	});
	const YEARS = [2027, 2028, 2029, 2030, 2031].map((y) => ({
		y,
		day: (Date.UTC(y, 0, 1) - Date.UTC(2026, 0, 1)) / (DAY * 1000)
	}));
	const inWindow = $derived.by(() => {
		if (!trip) return false;
		const day = departDay - WINDOW_START;
		let near: { day: number; total: number } | null = null;
		for (const low of curve.lows)
			if (!near || Math.abs(low.day - day) < Math.abs(near.day - day)) near = low;
		return !!near && Math.abs(near.day - day) < 90 && trip.total <= 1.1 * near.total;
	});
	const verdictW = $derived(
		!trip
			? 'No orbit gets there that fast'
			: inWindow
				? 'In a launch window'
				: `${fmt(trip.total / curve.min, 1)} times the cheapest for this flight time`
	);

	const sun = toS({ x: 0, y: 0 });
	const show = (p: Vec) => toS(p);
</script>

<g>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>
	<!-- the Sun -->
	<circle cx={sun.x} cy={sun.y} r="13" fill="var(--orb-star)" />

	{#if phase === 'hohmann'}
		<circle
			cx={CX}
			cy={CY}
			r={H.r1 * K}
			fill="none"
			stroke="var(--sky-ocean)"
			stroke-width="1.2"
			opacity="0.7"
		/>
		<circle
			cx={CX}
			cy={CY}
			r={H.r2 * K}
			fill="none"
			stroke="var(--rk-mars)"
			stroke-width="1.2"
			opacity="0.7"
		/>
		<path
			d={transferPathH}
			fill="none"
			stroke="var(--rk-path)"
			stroke-width="2"
			stroke-dasharray="5 5"
			opacity="0.8"
		/>
		<!-- where Mars was at departure, and the line-up angle -->
		{@const m0 = show({ x: H.r2 * Math.cos(E0 + lead), y: H.r2 * Math.sin(E0 + lead) })}
		<circle cx={m0.x} cy={m0.y} r="6" fill="none" stroke="var(--rk-mars)" stroke-dasharray="2 2" />
		<line
			x1={sun.x}
			y1={sun.y}
			x2={departPoint.x}
			y2={departPoint.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.5"
		/>
		<line
			x1={sun.x}
			y1={sun.y}
			x2={m0.x}
			y2={m0.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.5"
		/>
		<circle
			cx={arrivalPoint.x}
			cy={arrivalPoint.y}
			r="9"
			fill="none"
			stroke="var(--rk-path)"
			stroke-width="1.2"
			opacity="0.7"
		/>
		{@const e = show(earthH)}
		{@const m = show(marsH)}
		{@const c = show(craftH)}
		<circle cx={e.x} cy={e.y} r="7" fill="var(--sky-ocean)" />
		<circle cx={m.x} cy={m.y} r="6" fill="var(--rk-mars)" />
		<circle
			cx={c.x}
			cy={c.y}
			r="4"
			fill="var(--stage-ink)"
			stroke="var(--orb-space)"
			stroke-width="1"
		/>
		<Readout id="h-labels">
			<Label anchor="start" x={e.x + 10} y={e.y + 16} text="Earth" size={12} />
			<Label anchor="start" x={m.x + 9} y={m.y - 8} text="Mars" size={12} color="var(--rk-mars)" />
			<Label
				x={m0.x < CX ? m0.x + 10 : m0.x - 10}
				y={m0.y < CY ? m0.y + 20 : m0.y - 12}
				text="Mars at departure"
				size={11}
				muted
				anchor={m0.x < CX ? 'start' : 'end'}
			/>
			<Label
				x={departPoint.x - 10}
				y={departPoint.y + 18}
				text="leave"
				size={11}
				muted
				anchor="end"
			/>
			<Label
				anchor="start"
				x={arrivalPoint.x + 12}
				y={arrivalPoint.y + 4}
				text="arrive"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	{#if phase === 'window'}
		<path d={EARTH_ORBIT} fill="none" stroke="var(--sky-ocean)" stroke-width="1.2" opacity="0.7" />
		<path d={MARS_ORBIT} fill="none" stroke="var(--rk-mars)" stroke-width="1.2" opacity="0.7" />
		{#if trip}
			<path
				d={tripPath}
				fill="none"
				stroke="var(--rk-path)"
				stroke-width="2"
				stroke-dasharray="5 5"
				opacity="0.85"
			/>
			{@const a = show(trip.mars1)}
			{@const d0 = show(trip.earth0)}
			<circle
				cx={a.x}
				cy={a.y}
				r="9"
				fill="none"
				stroke="var(--rk-path)"
				stroke-width="1.2"
				opacity="0.7"
			/>
			<circle
				cx={d0.x}
				cy={d0.y}
				r="9"
				fill="none"
				stroke="var(--sky-ocean)"
				stroke-width="1.2"
				opacity="0.7"
			/>
		{/if}
		{@const e = show(earthW)}
		{@const m = show(marsW)}
		<circle cx={e.x} cy={e.y} r="7" fill="var(--sky-ocean)" />
		<circle cx={m.x} cy={m.y} r="6" fill="var(--rk-mars)" />
		{#if craftW}
			{@const c = show(craftW)}
			<circle
				cx={c.x}
				cy={c.y}
				r="4"
				fill="var(--stage-ink)"
				stroke="var(--orb-space)"
				stroke-width="1"
			/>
		{/if}
		<Readout id="w-labels">
			<Label anchor="start" x={e.x + 10} y={e.y + 16} text="Earth" size={12} />
			<Label anchor="start" x={m.x + 9} y={m.y - 8} text="Mars" size={12} color="var(--rk-mars)" />
			<Label
				anchor="start"
				x={PANEL.x + 20}
				y={PANEL.y + PANEL.h - 14}
				text="real orbits (JPL elements), in one plane; seen from the north"
				size={11}
				muted
			/>
		</Readout>
	{/if}
	<Readout id="scale">
		<Label
			anchor="start"
			x={PANEL.x + 20}
			y={PANEL.y + 30}
			text="1 AU = 150 million km"
			size={11}
			muted
		/>
		<line
			x1={PANEL.x + 20}
			x2={PANEL.x + 170}
			y1={PANEL.y + 40}
			y2={PANEL.y + 40}
			stroke="var(--stage-ink-muted)"
		/>
		<Label
			anchor="start"
			x={PANEL.x + 20}
			y={PANEL.y + 62}
			text={phase === 'window'
				? dateText(nowDay)
				: `day ${Math.round((u * H.time) / DAY)} of ${Math.round(H.time / DAY)}`}
			size={14}
			weight={700}
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- card -->
	<Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />
	{#if phase === 'hohmann'}
		<Readout id="h-title">
			<Label anchor="start" x={CL} y={CARD.y + 32} text="The Hohmann trip" size={16} weight={700} />
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 50}
				text="circular orbits, mean distances"
				size={11}
				muted
			/>
		</Readout>
		<Readout
			id="h-lead"
			order={1}
			label="Mars at departure"
			value="{fmt((lead * 180) / Math.PI, 0)}° ahead (needs {fmt(
				(leadNeeded * 180) / Math.PI,
				0
			)}°)"
		>
			<Label anchor="start" x={CL} y={CARD.y + 84} text="Mars ahead of the Earth" size={12} muted />
			<Label
				x={CR}
				y={CARD.y + 84}
				text="{fmt((lead * 180) / Math.PI, 0)}°"
				size={14}
				weight={700}
				anchor="end"
			/>
			<Label anchor="start" x={CL} y={CARD.y + 106} text="needed for this trip" size={12} muted />
			<Label
				x={CR}
				y={CARD.y + 106}
				text="{fmt((leadNeeded * 180) / Math.PI, 0)}°"
				size={14}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout id="h-time" order={2} label="Flight" value="{Math.round(H.time / DAY)} days">
			<Label anchor="start" x={CL} y={CARD.y + 128} text="Flight time" size={12} muted />
			<Label
				x={CR}
				y={CARD.y + 128}
				text="{Math.round(H.time / DAY)} days"
				size={13}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<line x1={CL} x2={CR} y1={CARD.y + 148} y2={CARD.y + 148} stroke="var(--border)" />
		<Readout id="h-budget-title">
			<Label anchor="start" x={CL} y={CARD.y + 172} text="Δv budget" size={13} weight={700} />
		</Readout>
		<Readout
			id="h-budget"
			order={3}
			label="Δv"
			value="{fmt(H.burnDepart / 1000, 2)} + {fmt(H.burnArrive / 1000, 2)} km/s"
		>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 196}
				text="leave a 200 km Earth orbit"
				size={12}
				muted
			/>
			<Label
				x={CR}
				y={CARD.y + 196}
				text="{fmt(H.burnDepart / 1000, 2)} km/s"
				size={12}
				weight={600}
				anchor="end"
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 218}
				text="slow into a 200 km Mars orbit"
				size={12}
				muted
			/>
			<Label
				x={CR}
				y={CARD.y + 218}
				text="{fmt(H.burnArrive / 1000, 2)} km/s"
				size={12}
				weight={600}
				anchor="end"
			/>
			<Label anchor="start" x={CL} y={CARD.y + 242} text="total" size={12} weight={700} />
			<Label
				x={CR}
				y={CARD.y + 242}
				text="{fmt((H.burnDepart + H.burnArrive) / 1000, 2)} km/s"
				size={14}
				weight={700}
				anchor="end"
				color="var(--rk-flame)"
			/>
		</Readout>
		<line x1={CL} x2={CR} y1={CARD.y + 262} y2={CARD.y + 262} stroke="var(--border)" />
		<Readout
			id="h-verdict"
			order={4}
			label="On arrival"
			value={!arrived
				? 'on the way…'
				: hit
					? 'Mars is there'
					: `missed: Mars ${missDeg > 0 ? 'ahead' : 'behind'} by ${fmt(missKm / 1e9, 0)} million km`}
			color={arrived && hit ? 'var(--rk-spin)' : undefined}
		>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 290}
				text={!arrived ? 'On the way…' : hit ? 'Mars is there: arrival!' : 'Missed!'}
				size={15}
				weight={700}
				muted={!arrived}
				color={arrived ? (hit ? 'var(--rk-spin)' : 'var(--rk-gravity)') : undefined}
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 312}
				text={arrived && !hit
					? `Mars is ${fmt(missKm / 1e9, 0)} million km ${missDeg > 0 ? 'further on' : 'behind'}`
					: ''}
				size={12}
				muted
			/>
		</Readout>
		<Readout id="h-note">
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 360}
				text="In {Math.round(H.time / DAY)} days Mars moves {fmt(
					(nM * H.time * 180) / Math.PI,
					0
				)}° round the Sun,"
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 376}
				text="so it must start {fmt((leadNeeded * 180) / Math.PI, 0)}° ahead to meet the craft"
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 392}
				text="half an orbit from where it left."
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 424}
				text="That line-up comes back every {Math.round(H.synodic / DAY)} days"
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 440}
				text="(about 26 months): the launch window."
				size={11}
				muted
			/>
		</Readout>
	{/if}

	{#if phase === 'window'}
		<Readout id="w-title">
			<Label anchor="start" x={CL} y={CARD.y + 32} text="Pick a date" size={16} weight={700} />
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 50}
				text="the orbit that meets Mars on the arrival day"
				size={11}
				muted
			/>
		</Readout>
		<Readout
			id="w-dates"
			order={1}
			label="Leave → arrive"
			value="{dateText(departDay)} → {dateText(departDay + flightDays)}"
		>
			<Label anchor="start" x={CL} y={CARD.y + 82} text="Leave" size={12} muted />
			<Label
				x={CR}
				y={CARD.y + 82}
				text={dateText(departDay)}
				size={13}
				weight={600}
				anchor="end"
			/>
			<Label anchor="start" x={CL} y={CARD.y + 102} text="Arrive" size={12} muted />
			<Label
				x={CR}
				y={CARD.y + 102}
				text="{dateText(departDay + flightDays)} ({flightDays} days)"
				size={13}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<line x1={CL} x2={CR} y1={CARD.y + 120} y2={CARD.y + 120} stroke="var(--border)" />
		<Readout id="w-budget-title">
			<Label anchor="start" x={CL} y={CARD.y + 144} text="Δv budget" size={13} weight={700} />
		</Readout>
		{#if trip}
			<Readout id="w-legs">
				<Label
					anchor="start"
					x={CL}
					y={CARD.y + 168}
					text="leave a 200 km Earth orbit"
					size={12}
					muted
				/>
				<Label
					x={CR}
					y={CARD.y + 168}
					text="{fmt(trip.burnDepart / 1000, 2)} km/s"
					size={12}
					weight={600}
					anchor="end"
				/>
				<Label
					anchor="start"
					x={CL}
					y={CARD.y + 190}
					text="slow into a 200 km Mars orbit"
					size={12}
					muted
				/>
				<Label
					x={CR}
					y={CARD.y + 190}
					text="{fmt(trip.burnArrive / 1000, 2)} km/s"
					size={12}
					weight={600}
					anchor="end"
				/>
			</Readout>
		{/if}
		<Readout
			id="w-total"
			order={2}
			label="Δv"
			value={trip ? `${fmt(trip.total / 1000, 2)} km/s` : '—'}
			color="var(--rk-flame)"
		>
			<Label anchor="start" x={CL} y={CARD.y + 214} text="total" size={12} weight={700} />
			<Label
				x={CR}
				y={CARD.y + 214}
				text={trip ? `${fmt(trip.total / 1000, 2)} km/s` : '—'}
				size={14}
				weight={700}
				anchor="end"
				color="var(--rk-flame)"
			/>
		</Readout>
		<Readout
			id="w-verdict"
			order={3}
			label="Verdict"
			value={verdictW}
			color={inWindow ? 'var(--rk-spin)' : undefined}
		>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 244}
				text={verdictW}
				size={13}
				weight={700}
				color={inWindow ? 'var(--rk-spin)' : 'var(--rk-gravity)'}
			/>
		</Readout>
		<!-- cost against departure date -->
		<Readout id="w-chart-title">
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 284}
				text="Δv for a {flightDays}-day trip, by departure date"
				size={11}
				muted
			/>
		</Readout>
		{#each [5, 10, 15, 20] as v (v)}
			<line x1={CH.x} x2={CH.x + CH.w} y1={cy(v)} y2={cy(v)} stroke="var(--stage-grid)" />
			<Readout id="w-tick-{v}">
				<Label x={CH.x - 6} y={cy(v) + 4} text={String(v)} size={10} muted anchor="end" />
			</Readout>
		{/each}
		{#each YEARS as y (y.y)}
			<line
				x1={cx(y.day)}
				x2={cx(y.day)}
				y1={CH.y + CH.h}
				y2={CH.y + CH.h + 4}
				stroke="var(--stage-line)"
			/>
			<Readout id="w-year-{y.y}">
				<Label
					x={cx(y.day)}
					y={CH.y + CH.h + 16}
					text={String(y.y)}
					size={10}
					muted
					anchor="middle"
				/>
			</Readout>
		{/each}
		<line x1={CH.x} x2={CH.x + CH.w} y1={CH.y + CH.h} y2={CH.y + CH.h} stroke="var(--stage-line)" />
		<path d={curve.d} fill="none" stroke="var(--rk-flame)" stroke-width="2" />
		{@const mx = cx(departDay - WINDOW_START)}
		<line
			x1={mx}
			x2={mx}
			y1={CH.y}
			y2={CH.y + CH.h}
			stroke="var(--stage-ink)"
			stroke-dasharray="3 3"
		/>
		{#if trip}
			<circle
				cx={mx}
				cy={cy(Math.min(20, trip.total / 1000))}
				r="5"
				fill="var(--rk-flame)"
				stroke="var(--surface)"
				stroke-width="1.5"
			/>
		{/if}
		<Readout id="w-chart-note">
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 494}
				text="km/s, capped at 20. The dips are the launch"
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 510}
				text="windows, about 26 months apart."
				size={11}
				muted
			/>
			<Label
				anchor="start"
				x={CL}
				y={CARD.y + 536}
				text="Costs from and into 200 km circular orbits."
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>
