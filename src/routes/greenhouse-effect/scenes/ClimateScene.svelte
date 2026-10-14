<script lang="ts">
	/**
	 * The planet with adjustable CO₂ and feedbacks. Left: sunlight absorbed and
	 * infrared escaping, as bands to scale (0.25 scene units per W/m²), CO₂ and
	 * water molecules in the air, sea ice on the surface. Right: the two flows,
	 * the imbalance between them (magnified), the warming and its settling curve.
	 *
	 * The warming ΔT is the integral of the imbalance N = F + λΔT over the ocean's
	 * mixed layer (dΔT/dt = N / C): a frame-to-frame accumulator (the scene
	 * guide's sanctioned exception), stepped exactly (exponential relaxation),
	 * ignoring dt ≤ 0, static at equilibrium under reduced motion. Two years of
	 * planet time pass per second. Moving between the climate steps keeps the
	 * planet's warming, so a feedback switched on warms it further from there.
	 */
	import { Label, Photon, colors, hash, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { band } from '../../carbon-cycle/scenes/geometry';
	import {
		ECS_BEST,
		ECS_LIKELY,
		ECS_VERY_LIKELY,
		FEEDBACK,
		OCEAN,
		budget,
		co2Forcing,
		equilibriumWarming,
		lambda,
		sensitivity,
		type Feedbacks
	} from '../climate';
	import { irPhoton, signed, sunPhoton } from './ir';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- what this step offers: a control not on the step is off (feedbacks) or 560 ppm
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const on = (id: string) => offered.has(id) && params[id] !== false;
	const ppm = $derived(offered.has('co2') ? Number(params.co2 ?? 560) : 560);
	const fb: Feedbacks = $derived({ water: on('water'), ice: on('ice'), clouds: on('clouds') });
	const F = $derived(co2Forcing(ppm, 280));
	const lam = $derived(lambda(fb));
	const Teq = $derived(equilibriumWarming(F, fb));
	const perDoubling = $derived(sensitivity(fb));
	const mode = $derived(String(step.hints?.mode ?? 'co2'));

	// ---- the planet's warming, integrated frame to frame
	const YEARS_PER_S = 2;
	const relax = (T: number, years: number) =>
		Teq + (T - Teq) * Math.exp((lam * years) / OCEAN.mixed);
	let acc = { t: 0, T: 0, yr: 0, trail: [{ yr: 0, T: 0 }] };
	const sim = $derived.by(() => {
		if (reduced) return null;
		const dt = t - acc.t;
		if (dt < 0) acc = { t, T: acc.T, yr: 0, trail: [{ yr: 0, T: acc.T }] };
		else if (dt > 0 && dt < 0.5) {
			const yr = acc.yr + dt * YEARS_PER_S;
			const T = relax(acc.T, dt * YEARS_PER_S);
			const last = acc.trail[acc.trail.length - 1];
			const trail = yr - last.yr >= 0.2 ? [...acc.trail, { yr, T }].slice(-300) : acc.trail;
			acc = { t, T, yr, trail };
		} else if (dt !== 0) acc = { ...acc, t };
		return acc;
	});
	const dT = $derived(sim ? sim.T : Teq);
	const years = $derived(sim ? sim.yr : 40);
	const trail = $derived(
		sim
			? sim.trail
			: Array.from({ length: 81 }, (_, i) => ({
					yr: i / 2,
					T: Teq * (1 - Math.exp((lam * (i / 2)) / OCEAN.mixed))
				}))
	);
	const b = $derived(budget(F, dT, fb));
	const settled = $derived(Math.abs(b.imbalance) < 0.05);

	// ---- drawing: air, molecules, ice
	const TOA = 100;
	const SURF = 450;
	const K = 0.25;
	const POOL = Array.from({ length: 60 }, (_, i) => ({
		id: i,
		x: 40 + hash(i, 11) * 540,
		y: TOA + 24 + hash(i, 12) * (SURF - TOA - 60)
	}));
	const nCO2 = $derived(Math.round(ppm / 40));
	const vapour = $derived(fb.water ? 1.07 ** dT : 1);
	const nH2O = $derived(Math.round(10 * vapour));
	const iceW = $derived(fb.ice ? Math.min(400, 220 * Math.max(0, 1 - dT / 6)) : 220);

	const sunBand = $derived(
		band(
			[
				{ x: 150, y: 30 },
				{ x: 150, y: SURF - 2 }
			],
			b.sunlight * K
		)
	);
	const irBand = $derived(
		band(
			[
				{ x: 440, y: SURF - 2 },
				{ x: 440, y: 36 }
			],
			b.infrared * K
		)
	);
	const tt = $derived(reduced ? 2.5 : t);
	const sunP = $derived(
		Array.from({ length: 7 }, (_, i) => ({
			...sunPhoton(i, 7, tt, 30, SURF - 6),
			x: 140 + (i % 3) * 10
		}))
	);
	const IR_N = 14;
	const absorb = $derived(Math.min(0.95, 0.72 + 0.08 * Math.log2(ppm / 280)));
	const irP = $derived(
		Array.from({ length: IR_N }, (_, i) =>
			irPhoton(i, IR_N, tt, {
				x0: 230,
				x1: 580,
				ground: SURF - 6,
				top: 58,
				airTop: TOA + 20,
				airBottom: SURF - 60,
				absorb,
				salt: 5
			})
		)
	);

	// ---- panel
	const PX = 632;
	const meter = scale([-8, 8], [PX + 40, PX + 296]);
	const imbClamped = $derived(Math.max(-8, Math.min(8, b.imbalance)));
	const warmColor = $derived(dT >= 0 ? 'var(--gh-warm)' : 'var(--gh-cool)');
	const yMax = $derived(Math.max(2, Math.ceil(Math.max(Teq, dT, ...trail.map((p) => p.T)) + 0.5)));
	const yMin = $derived(Math.min(0, Math.floor(Math.min(Teq, ...trail.map((p) => p.T)))));
	const x0 = $derived(Math.max(0, years - 40));
	const sx = $derived(scale([x0, x0 + 40], [PX + 20, 930]));
	const sy = $derived(scale([yMin, yMax], [566, 410]));
	const path = $derived(
		linePath(
			trail.filter((p) => p.yr >= x0),
			(p) => p.yr,
			(p) => p.T,
			sx,
			sy
		)
	);
	const gauge = scale([0, 6], [PX + 20, 920]);
	const chips = $derived([
		{ id: 'water', name: 'water vapour', on: fb.water, v: FEEDBACK.water },
		{ id: 'ice', name: 'ice', on: fb.ice, v: FEEDBACK.ice },
		{ id: 'clouds', name: 'clouds', on: fb.clouds, v: FEEDBACK.clouds }
	]);
	const fmt1 = (v: number) => v.toFixed(1);
	const chipW = (c: { name: string; on: boolean }) => (c.name.length + 4) * 6.6 + 14;
</script>

<g>
	<!-- space, air, surface -->
	<rect x="16" y="16" width="590" height={SURF - 16} rx="10" fill="var(--gh-space)" />
	<rect x="16" y={TOA} width="590" height={SURF - TOA} fill="var(--gh-air)" opacity="0.9" />
	<line x1="16" x2="606" y1={TOA} y2={TOA} stroke="var(--gh-air-edge)" stroke-dasharray="4 4" />
	<rect x="16" y={SURF} width="590" height="118" rx="4" fill="var(--gh-ocean)" opacity="0.75" />
	<rect
		x="16"
		y={SURF}
		width={iceW}
		height="26"
		rx="3"
		fill="var(--gh-ice)"
		stroke="var(--gh-ice-edge)"
	/>
	<Readout id="labels">
		<Label x={596} y={84} text="space" anchor="end" size={12} muted />
		<Label x={596} y={TOA + 20} text="air" anchor="end" size={12} muted />
		<Label x={24} y={SURF + 44} text="sea ice" anchor="start" size={12} weight={600} />
		<Label
			x={24}
			y={SURF + 60}
			text={fb.ice ? 'melts as it warms' : 'feedback off: stays'}
			anchor="start"
			size={11}
			muted
		/>
		<Label x={596} y={SURF + 44} text="ocean" anchor="end" size={12} weight={600} />
	</Readout>

	<!-- molecules -->
	{#each POOL.slice(0, nCO2) as m (m.id)}
		<g transform="translate({m.x} {m.y})">
			<circle r="4.5" fill="var(--carbon)" />
			<circle cx="-8" r="4" fill={colors.oxygen} />
			<circle cx="8" r="4" fill={colors.oxygen} />
		</g>
	{/each}
	{#each POOL.slice(30, 30 + nH2O) as m (m.id)}
		<g transform="translate({m.x} {m.y})">
			<circle r="5" fill={colors.oxygen} />
			<circle
				cx="-6"
				cy="4.5"
				r="3"
				fill={colors.hydrogen}
				stroke={colors.hydrogenEdge}
				stroke-width="0.8"
			/>
			<circle
				cx="6"
				cy="4.5"
				r="3"
				fill={colors.hydrogen}
				stroke={colors.hydrogenEdge}
				stroke-width="0.8"
			/>
		</g>
	{/each}

	<!-- flows -->
	<circle cx="56" cy="52" r="24" fill="var(--gh-sun)" filter="url(#glow)" />
	<path d={sunBand.d} fill="var(--gh-sun)" fill-opacity="0.55" />
	<path d={irBand.d} fill="var(--gh-ir)" fill-opacity="0.5" />
	{#each sunP as p (p.key)}
		<Photon x={p.x} y={p.y} angle={90} length={26} opacity={p.opacity * 0.9} />
	{/each}
	{#each irP as p (p.key)}
		{#if p.flash}
			<circle
				cx={p.flash.x}
				cy={p.flash.y}
				r="7"
				fill="var(--gh-ir)"
				opacity={p.flash.opacity * 0.6}
			/>
		{/if}
		<Photon
			x={p.x}
			y={p.y}
			angle={p.angle}
			length={24}
			amplitude={3}
			color="var(--gh-ir)"
			opacity={p.opacity}
		/>
	{/each}
	<Readout id="band-labels">
		<Label x={186} y={36} text="sunlight absorbed" anchor="start" size={12} weight={600} />
		<Label
			x={476}
			y={36}
			text="infrared to space"
			anchor="start"
			size={12}
			weight={600}
			color="var(--gh-ir)"
		/>
	</Readout>

	<!-- panel: CO₂ and the two flows -->
	<Readout
		id="co2"
		order={0}
		label="CO₂"
		value="{ppm} ppm · forcing {signed(F, 1)} W/m²"
		color="var(--gh-co2)"
	>
		<Label x={PX} y={40} text="CO₂ {ppm} ppm" anchor="start" size={16} weight={700} />
		<Label
			x={PX}
			y={60}
			text={F >= 0
				? `cuts the infrared escaping by ${fmt1(F)} W/m² (forcing)`
				: `lets ${fmt1(-F)} W/m² more infrared escape (forcing)`}
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	<Label x={PX} y={96} text="sunlight in" anchor="start" size={12} />
	<rect
		x={PX + 96}
		y={84}
		width={b.sunlight * 0.6}
		height="15"
		rx="3"
		fill="var(--gh-sun)"
		opacity="0.8"
	/>
	<Label x={PX} y={120} text="infrared out" anchor="start" size={12} />
	<rect
		x={PX + 96}
		y={108}
		width={b.infrared * 0.6}
		height="15"
		rx="3"
		fill="var(--gh-ir)"
		opacity="0.8"
	/>
	<Readout id="flows">
		<Label
			x={PX + 102 + b.sunlight * 0.6}
			y={96}
			text={fmt1(b.sunlight)}
			anchor="start"
			size={12}
			weight={700}
		/>
		<Label
			x={PX + 102 + b.infrared * 0.6}
			y={120}
			text={fmt1(b.infrared)}
			anchor="start"
			size={12}
			weight={700}
		/>
	</Readout>

	<!-- imbalance meter (magnified) -->
	<line
		x1={meter(-8)}
		x2={meter(8)}
		y1={160}
		y2={160}
		stroke="var(--stage-line)"
		stroke-width="6"
		stroke-linecap="round"
		opacity="0.5"
	/>
	<line x1={meter(0)} x2={meter(0)} y1={150} y2={170} stroke="var(--stage-ink-muted)" />
	<rect
		x={Math.min(meter(0), meter(imbClamped))}
		y={154}
		width={Math.abs(meter(imbClamped) - meter(0))}
		height="12"
		rx="3"
		fill={b.imbalance >= 0 ? 'var(--gh-warm)' : 'var(--gh-cool)'}
	/>
	<Readout
		id="imbalance"
		order={1}
		label="Imbalance"
		value="{signed(b.imbalance, 1)} W/m² · {settled
			? 'balanced'
			: b.imbalance > 0
				? 'warming'
				: 'cooling'}"
		color={settled ? undefined : b.imbalance > 0 ? 'var(--gh-warm)' : 'var(--gh-cool)'}
	>
		<Label
			x={PX}
			y={144}
			text={settled
				? 'in balance: in = out'
				: `imbalance ${signed(b.imbalance, 1)} W/m²: ${b.imbalance > 0 ? 'more in than out, warming' : 'more out than in, cooling'}`}
			anchor="start"
			size={12}
			weight={600}
			color={settled ? undefined : b.imbalance > 0 ? 'var(--gh-warm)' : 'var(--gh-cool)'}
		/>
		<Label
			x={meter(8)}
			y={184}
			text="magnified {Math.round((meter(1) - meter(0)) / 0.6)}×"
			anchor="end"
			size={10}
			muted
		/>
	</Readout>

	<!-- warming -->
	<Readout
		id="warming"
		order={2}
		label="Warming"
		value="{signed(dT, 1)} °C, settles at {signed(Teq, 1)} °C"
		color={warmColor}
	>
		<Label
			x={PX}
			y={214}
			text="{signed(dT, 1)} °C"
			anchor="start"
			size={26}
			weight={700}
			color={warmColor}
		/>
		<Label x={PX + 124} y={204} text="warming since 280 ppm" anchor="start" size={12} muted />
		<Label
			x={PX + 124}
			y={220}
			text="settles at {signed(Teq, 1)} °C"
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>

	<!-- feedback chips -->
	{#each chips as c, i (c.id)}
		{@const x = PX + chips.slice(0, i).reduce((a, d) => a + chipW(d) + 8, 0)}
		<rect
			{x}
			y={240}
			width={chipW(c)}
			height="24"
			rx="12"
			fill={c.on ? 'var(--gh-warm)' : 'none'}
			fill-opacity={c.on ? 0.15 : 0}
			stroke={c.on ? 'var(--gh-warm)' : 'var(--stage-line)'}
			stroke-dasharray={c.on ? undefined : '3 3'}
		/>
		<Readout id="chip-{c.id}">
			<Label
				x={x + chipW(c) / 2}
				y={256}
				text="{c.name} {c.on ? 'on' : 'off'}"
				size={11}
				weight={c.on ? 700 : 500}
				muted={!c.on}
			/>
		</Readout>
	{/each}
	{#if fb.water}
		<Readout id="vapour">
			<Label
				x={PX}
				y={282}
				text="water vapour in the air: {signed((vapour - 1) * 100, 0)}%"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- per doubling, and the AR6 range on the last step -->
	<Readout
		id="doubling"
		order={3}
		label="Doubled CO₂"
		value="{signed(perDoubling, 1)} °C once settled{mode === 'all'
			? ` (AR6: ${ECS_BEST} °C, likely ${ECS_LIKELY[0]}–${ECS_LIKELY[1]})`
			: ''}"
	>
		<Label
			x={PX}
			y={312}
			text="doubled CO₂: {signed(perDoubling, 1)} °C once settled"
			anchor="start"
			size={13}
			weight={700}
		/>
	</Readout>
	{#if mode === 'all'}
		<rect
			x={gauge(ECS_VERY_LIKELY[0])}
			y={326}
			width={gauge(ECS_VERY_LIKELY[1]) - gauge(ECS_VERY_LIKELY[0])}
			height="14"
			fill="var(--gh-warm)"
			opacity="0.15"
		/>
		<rect
			x={gauge(ECS_LIKELY[0])}
			y={326}
			width={gauge(ECS_LIKELY[1]) - gauge(ECS_LIKELY[0])}
			height="14"
			fill="var(--gh-warm)"
			opacity="0.3"
		/>
		<line
			x1={gauge(ECS_BEST)}
			x2={gauge(ECS_BEST)}
			y1={322}
			y2={344}
			stroke="var(--gh-warm)"
			stroke-width="2"
		/>
		<circle
			cx={gauge(Math.min(6, perDoubling))}
			cy={333}
			r="6"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{#each [0, 1, 2, 3, 4, 5, 6] as v (v)}
			<Readout id="g-{v}">
				<Label x={gauge(v)} y={358} text={String(v)} size={10} muted />
			</Readout>
		{/each}
		<Readout id="gauge-key">
			<Label
				x={PX}
				y={376}
				text="IPCC: likely 2.5–4 °C (dark), very likely 2–5 (light)"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- warming through time -->
	<line x1={PX + 20} x2={930} y1={sy(0)} y2={sy(0)} stroke="var(--stage-line)" />
	<line x1={PX + 20} x2={PX + 20} y1={410} y2={566} stroke="var(--stage-line)" />
	<line
		x1={PX + 20}
		x2={930}
		y1={sy(Teq)}
		y2={sy(Teq)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 3"
	/>
	<path d={path} fill="none" stroke={warmColor} stroke-width="2.5" />
	<Readout id="chart">
		<Label x={PX + 26} y={404} text="warming, °C" anchor="start" size={11} muted />
		<Label x={PX + 14} y={sy(yMax) + 4} text={String(yMax)} anchor="end" size={11} muted />
		<Label x={PX + 14} y={sy(0) + 4} text="0" anchor="end" size={11} muted />
		<Label x={930} y={584} text="years →" anchor="end" size={11} muted />
		<Label x={930} y={sy(Teq) - 6} text="balance" anchor="end" size={11} muted />
	</Readout>
</g>
