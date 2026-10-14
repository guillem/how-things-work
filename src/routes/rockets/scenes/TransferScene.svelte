<script lang="ts">
	/**
	 * Raising an orbit with two burns (params.burn1, params.burn2, km/s), drawn to scale round
	 * the Earth: the 200 km orbit hugs the planet, the geostationary orbit is the dashed ring.
	 * The craft laps the low orbit once, fires burn 1 (forwards), coasts half the new ellipse to
	 * its farthest point, fires burn 2 and flies the orbit that results; then the loop repeats.
	 * Time is compressed differently in each part (the mission clock on the card shows real
	 * time). Orbits are Kepler orbits from `twoBurns()` in `space.ts`.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { massRatio } from '../rockets';
	import { at, circular, MU_EARTH, R_EARTH, R_GEO, R_LEO, twoBurns, type Conic } from '../space';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const PANEL = { x: 16, y: 16, w: 584, h: 568 };
	const CARD = { x: 616, y: 16, w: 328, h: 568 };
	const CL = CARD.x + 20;
	const CR = CARD.x + CARD.w - 20;
	const CX = 320;
	const CY = 300;
	const K = 262 / R_GEO; // px per m, to scale
	const toS = (r: { x: number; y: number }) => ({ x: CX + r.x * K, y: CY - r.y * K });

	const dv1 = $derived(clamp(Number(params.burn1 ?? 1.2), 0, 3.2) * 1000);
	const dv2 = $derived(clamp(Number(params.burn2 ?? 0), 0, 2) * 1000);
	const plan = $derived(twoBurns(dv1, dv2));

	/** The closed (or open) orbit as an SVG path, sampled in time. */
	function orbitPath(o: Conic, t0 = 0, span = o.period, n = 160) {
		let d = '';
		for (let i = 0; i <= n; i++) {
			const p = toS(at(o, t0 + (i / n) * span).r);
			if (Math.abs(p.x) > 4000 || Math.abs(p.y) > 4000) break;
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d;
	}
	const geoRing = `M${CX + R_GEO * K} ${CY} A${R_GEO * K} ${R_GEO * K} 0 1 0 ${CX - R_GEO * K} ${CY} A${R_GEO * K} ${R_GEO * K} 0 1 0 ${CX + R_GEO * K} ${CY}`;
	const leoPath = $derived(orbitPath(plan.first));
	const transferPath = $derived(
		plan.second.e < 1 ? orbitPath(plan.second) : orbitPath(plan.second, 0, 3 * 86400, 200)
	);
	const finalOrbit = $derived(plan.third);
	const finalPath = $derived(finalOrbit ? orbitPath(finalOrbit) : '');

	// ---- timeline (screen seconds) -----------------------------------------------------------
	const A = 3; // the first lap of the low orbit
	const B = 5; // coasting to the far point
	const C = 7; // the final orbit, once round
	const HOLD = 1.5;
	const PERIOD = A + B + C + HOLD;
	const local = $derived(reduced ? A + B + C * 0.35 : t % PERIOD);
	const coastTime = $derived(plan.burn2?.t ?? 0);
	const finalPeriod = $derived(
		finalOrbit && Number.isFinite(finalOrbit.period) ? finalOrbit.period : 86400
	);
	/** Where the craft is and the real mission time (s). */
	const craft = $derived.by(() => {
		if (local < A) {
			const tm = (local / A) * plan.first.period;
			return { r: at(plan.first, tm), part: 0, clock: tm };
		}
		const lap = plan.first.period;
		if (local < A + B || !finalOrbit) {
			const span = coastTime > 0 ? coastTime : plan.second.period / 2;
			const f = Math.min(1, (local - A) / B);
			const tm = f * (Number.isFinite(span) ? span : 86400);
			return { r: at(plan.second, tm), part: 1, clock: lap + tm };
		}
		const f = Math.min(1, (local - A - B) / C);
		const tm = f * finalPeriod;
		return { r: at(finalOrbit, tm), part: 2, clock: lap + coastTime + tm };
	});
	const cs = $derived(toS(craft.r.r));
	const speedNow = $derived(Math.hypot(craft.r.v.x, craft.r.v.y));
	const heading = $derived((Math.atan2(-craft.r.v.y, craft.r.v.x) * 180) / Math.PI);
	const flash1 = $derived(
		reduced ? 0 : smoothstep(A - 0.05, A, local) * (1 - smoothstep(A + 0.5, A + 0.9, local))
	);
	const flash2 = $derived(
		reduced || !plan.burn2 || dv2 <= 0
			? 0
			: smoothstep(A + B - 0.05, A + B, local) * (1 - smoothstep(A + B + 0.5, A + B + 0.9, local))
	);
	const burn1At = toS({ x: R_LEO, y: 0 });
	const burn2At = $derived(plan.burn2 ? toS(plan.burn2.r) : null);

	// ---- readouts -----------------------------------------------------------------------------
	const km = (m: number) => Math.round((m - R_EARTH) / 1000).toLocaleString('en-US');
	const fmt = (v: number, d = 2) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const total = $derived((dv1 + dv2) / 1000);
	const orbitNow = $derived(
		craft.part === 0 ? plan.first : craft.part === 1 ? plan.second : (finalOrbit ?? plan.second)
	);
	const orbitText = $derived(
		orbitNow.e >= 1
			? 'escaping the Earth'
			: orbitNow.e < 0.002
				? `round, ${km(orbitNow.peri)} km up`
				: `${km(orbitNow.peri)} × ${km(orbitNow.apo)} km`
	);
	const isGeo = $derived(
		!!finalOrbit &&
			Math.abs(finalOrbit.peri - R_GEO) < 0.01 * R_GEO &&
			Math.abs(finalOrbit.apo - R_GEO) < 0.01 * R_GEO
	);
	const verdict = $derived(
		plan.second.e >= 1
			? 'Burn 1 alone escapes the Earth'
			: isGeo
				? 'Geostationary: round, one turn a day'
				: dv2 === 0
					? 'No second burn: it falls back to the low point'
					: finalOrbit && finalOrbit.e < 0.002
						? `Round again, ${km(finalOrbit.peri)} km up`
						: 'An ellipse: not yet round'
	);
	const clock = (s: number) => {
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `${h} h ${String(m).padStart(2, '0')} min`;
	};
	const share = $derived(1 - 1 / massRatio(total, 3));
</script>

<g>
	<defs>
		<clipPath id="transfer-panel">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#transfer-panel)">
		<path
			d={geoRing}
			fill="none"
			stroke="var(--rk-spin)"
			stroke-width="1.4"
			stroke-dasharray="6 6"
			opacity="0.8"
		/>
		<path d={leoPath} fill="none" stroke="var(--rk-orbit)" stroke-width="1.2" opacity="0.6" />
		<path
			d={transferPath}
			fill="none"
			stroke="var(--rk-path)"
			stroke-width="2"
			stroke-dasharray={craft.part === 0 ? '4 5' : undefined}
			opacity={craft.part === 0 ? 0.5 : 0.9}
		/>
		{#if finalOrbit && dv2 > 0}
			<path
				d={finalPath}
				fill="none"
				stroke="var(--rk-speed)"
				stroke-width="2.4"
				stroke-dasharray={craft.part < 2 ? '4 5' : undefined}
				opacity={craft.part < 2 ? 0.45 : 0.95}
			/>
		{/if}
		<!-- the Earth, to scale -->
		<circle cx={CX} cy={CY} r={R_EARTH * K} fill="var(--sky-ocean)" />
		<circle cx={CX} cy={CY} r={R_EARTH * K} fill="none" stroke="var(--stage-line)" />
		<!-- burn markers -->
		<circle
			cx={burn1At.x}
			cy={burn1At.y}
			r="4"
			fill="none"
			stroke="var(--rk-flame)"
			stroke-width="1.5"
		/>
		{#if burn2At && dv2 > 0}
			<circle
				cx={burn2At.x}
				cy={burn2At.y}
				r="4"
				fill="none"
				stroke="var(--rk-flame)"
				stroke-width="1.5"
			/>
		{/if}
		<!-- the craft, with its flame during a burn -->
		<g transform="translate({cs.x} {cs.y}) rotate({heading})">
			{#if flash1 + flash2 > 0.02}
				<path
					d="M-5 -3 L-{8 + 14 * (flash1 + flash2)} 0 L-5 3 Z"
					fill="var(--rk-flame)"
					opacity={flash1 + flash2}
				/>
			{/if}
			<rect x="-5" y="-3" width="10" height="6" rx="1.5" fill="var(--stage-ink)" />
			<rect x="-2" y="-9" width="4" height="18" rx="1" fill="var(--rk-payload)" opacity="0.8" />
		</g>
	</g>
	<Readout id="labels">
		<T
			x={CX}
			y={CY - R_GEO * K - 10}
			text="geostationary orbit, 35,786 km up"
			size={12}
			anchor="middle"
			color="var(--rk-spin)"
		/>
		<T
			x={burn1At.x + 10}
			y={burn1At.y + 22}
			text="burn 1"
			size={12}
			weight={600}
			color="var(--rk-flame)"
		/>
		<T
			x={PANEL.x + 20}
			y={PANEL.y + PANEL.h - 30}
			text="to scale: the 200 km orbit hugs the Earth"
			size={11}
			muted
		/>
		<T
			x={PANEL.x + 20}
			y={PANEL.y + PANEL.h - 14}
			text="dashed: the path still to come"
			size={11}
			muted
		/>
		{#if burn2At && dv2 > 0 && burn2At.x > PANEL.x + 40 && burn2At.y > PANEL.y + 20}
			<T
				x={burn2At.x + 10}
				y={burn2At.y - 10}
				text="burn 2"
				size={12}
				weight={600}
				color="var(--rk-flame)"
			/>
		{/if}
	</Readout>

	<Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />
	<Readout id="title">
		<T x={CL} y={CARD.y + 32} text="Two burns, forwards" size={16} weight={700} />
		<T x={CL} y={CARD.y + 50} text="from a round orbit 200 km up" size={11} muted />
	</Readout>
	<Readout id="clock">
		<T x={CL} y={CARD.y + 84} text="Mission time" size={12} muted />
		<T x={CR} y={CARD.y + 84} text={clock(craft.clock)} size={13} weight={600} anchor="end" />
	</Readout>
	<Readout id="orbit" order={2} label="Orbit now" value={orbitText}>
		<T x={CL} y={CARD.y + 108} text="Orbit now" size={12} muted />
		<T x={CR} y={CARD.y + 108} text={orbitText} size={13} weight={600} anchor="end" />
	</Readout>
	<Readout
		id="speed"
		order={3}
		label="Speed now"
		value="{fmt(speedNow / 1000)} km/s"
		color="var(--rk-speed)"
	>
		<T x={CL} y={CARD.y + 132} text="Speed now" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 132}
			text="{fmt(speedNow / 1000)} km/s"
			size={14}
			weight={700}
			anchor="end"
			color="var(--rk-speed)"
		/>
	</Readout>

	<line x1={CL} x2={CR} y1={CARD.y + 152} y2={CARD.y + 152} stroke="var(--border)" />
	<Readout id="budget-title">
		<T x={CL} y={CARD.y + 176} text="Δv budget" size={13} weight={700} />
	</Readout>
	{#each [{ id: 'b1', label: 'burn 1', v: dv1 }, { id: 'b2', label: 'burn 2', v: dv2 }] as b, i (b.id)}
		{@const y = CARD.y + 202 + i * 26}
		<rect
			x={CL + 70}
			y={y - 11}
			width={Math.max(1, (b.v / 4000) * (CARD.w - 150))}
			height="14"
			rx="3"
			fill="var(--rk-flame)"
			opacity="0.8"
		/>
		<Readout id="row-{b.id}">
			<T x={CL} {y} text={b.label} size={12} muted />
			<T x={CR} {y} text="{fmt(b.v / 1000)} km/s" size={12} weight={600} anchor="end" />
		</Readout>
	{/each}
	<Readout id="total" order={1} label="Δv used" value="{fmt(total)} km/s" color="var(--rk-flame)">
		<T x={CL} y={CARD.y + 262} text="total" size={12} weight={700} />
		<T
			x={CR}
			y={CARD.y + 262}
			text="{fmt(total)} km/s"
			size={14}
			weight={700}
			anchor="end"
			color="var(--rk-flame)"
		/>
	</Readout>
	<Readout id="share">
		<T
			x={CL}
			y={CARD.y + 286}
			text="propellant: {Math.round(share * 100)}% of the craft's mass"
			size={11}
			muted
		/>
		<T x={CL} y={CARD.y + 301} text="(rocket equation, 3 km/s exhaust)" size={11} muted />
	</Readout>

	<line x1={CL} x2={CR} y1={CARD.y + 320} y2={CARD.y + 320} stroke="var(--border)" />
	<Readout
		id="verdict"
		order={4}
		label="Result"
		value={verdict}
		color={isGeo ? 'var(--rk-spin)' : undefined}
	>
		<T
			x={CL}
			y={CARD.y + 346}
			text={verdict}
			size={13}
			weight={700}
			color={isGeo ? 'var(--rk-spin)' : undefined}
		/>
	</Readout>
	<Readout id="hint">
		<T x={CL} y={CARD.y + 380} text="Hohmann to geostationary orbit:" size={11} muted />
		<T x={CL} y={CARD.y + 396} text="2.45 + 1.48 km/s" size={11} muted />
		<T
			x={CL}
			y={CARD.y + 424}
			text="Speed in the low orbit: {fmt(circular(MU_EARTH, R_LEO) / 1000)} km/s"
			size={11}
			muted
		/>
		<T
			x={CL}
			y={CARD.y + 440}
			text="Speed in geostationary orbit: {fmt(circular(MU_EARTH, R_GEO) / 1000)} km/s"
			size={11}
			muted
		/>
		<T x={CL} y={CARD.y + 466} text="Higher orbits are slower: the burns pay" size={11} muted />
		<T x={CL} y={CARD.y + 482} text="for climbing away from the Earth." size={11} muted />
		<T x={CL} y={CARD.y + 520} text="Burns drawn as instant kicks; time sped up," size={11} muted />
		<T x={CL} y={CARD.y + 536} text="more in some parts than others." size={11} muted />
	</Readout>
</g>
