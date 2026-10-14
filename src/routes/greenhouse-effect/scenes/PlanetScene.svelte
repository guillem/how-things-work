<script lang="ts">
	/**
	 * The planet's energy budget in a cross-section: the Sun at the top left,
	 * space above, the ground and ocean below. Flows are drawn as bands whose
	 * width is the flow (0.25 scene units per W/m²).
	 *
	 * - view "sun": sunlight arriving, reflected and absorbed (AR6 Fig. 7.2).
	 * - view "bare": no air. The surface temperature is integrated frame to frame
	 *   (the scene guide's sanctioned accumulator: it is the integral of the
	 *   imbalance, which the albedo slider changes), from a cold start, until the
	 *   infrared given off (σT⁴) balances the sunlight absorbed.
	 * - view "real": the measured flows with the atmosphere (AR6 Fig. 7.2).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, Photon, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { band } from '../../carbon-cycle/scenes/geometry';
	import {
		INCOMING,
		OCEAN,
		SOLAR,
		absorbedSunlight,
		bareTemperature,
		emission,
		toCelsius
	} from '../climate';
	import { irPhoton, sunPhoton } from './ir';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'sun'));
	const K = 0.25; // scene units per W/m²
	const GROUND = 420;
	const TOA = 120;

	const show = new Tween({ air: 1, bare: 0, real: 0 }, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = view;
		untrack(() =>
			show.set(
				{ air: v === 'bare' ? 0 : 1, bare: v === 'bare' ? 1 : 0, real: v === 'real' ? 1 : 0 },
				{ duration: reduced ? 0 : 700 }
			)
		);
	});

	// ---- albedo (bare view only; elsewhere the real 29%)
	const albedo = $derived(view === 'bare' ? Number(params.albedo ?? 29.4) / 100 : 100 / 340);
	const asr = $derived(absorbedSunlight(albedo));
	const reflected = $derived(INCOMING - asr);
	const tEq = $derived(bareTemperature(albedo));

	// ---- bare planet: temperature integrated frame to frame (1 s = 1 year)
	const T_START = 200;
	const YEARS_PER_S = 1;
	const C = OCEAN.mixed; // W yr m⁻² K⁻¹
	const advance = (T: number, years: number, sun: number) => {
		const n = Math.max(1, Math.ceil(years / 0.02));
		for (let i = 0; i < n; i++) T += ((sun - emission(T)) / C) * (years / n);
		return T;
	};
	let acc = { t: 0, T: T_START, trail: [{ yr: 0, T: T_START }] };
	const sim = $derived.by(() => {
		if (view !== 'bare' || reduced) return null;
		const dt = t - acc.t;
		if (dt < 0) acc = { t, T: T_START, trail: [{ yr: 0, T: T_START }] };
		else if (dt > 0 && dt < 0.5) {
			const T = advance(acc.T, dt * YEARS_PER_S, asr);
			const yr = t * YEARS_PER_S;
			const last = acc.trail[acc.trail.length - 1];
			const trail = yr - last.yr >= 0.1 ? [...acc.trail, { yr, T }].slice(-400) : acc.trail;
			acc = { t, T, trail };
		} else if (dt !== 0) acc = { ...acc, t };
		return acc;
	});
	/** The settling curve from a cold start, for the reduced-motion frame. */
	const settled = $derived.by(() => {
		const out = [{ yr: 0, T: T_START }];
		let T = T_START;
		for (let yr = 0.25; yr <= 20; yr += 0.25) out.push({ yr, T: (T = advance(T, 0.25, asr)) });
		return out;
	});
	const Tnow = $derived(sim ? sim.T : tEq);
	const trail = $derived(sim ? sim.trail : settled);
	const glow = $derived(emission(Tnow));
	const imbalance = $derived(asr - glow);

	// ---- geometry of the sunlight bands
	const X0 = 150;
	const sunBands = $derived.by(() => {
		const wRef = reflected * K;
		const wAir = view === 'bare' ? 0 : 80 * K;
		const wSurf = asr * K - wAir;
		const xr = X0 + wRef / 2;
		const xa = X0 + wRef + wAir / 2;
		const xs = X0 + wRef + wAir + wSurf / 2;
		const gap = Math.max(44, wRef + 22);
		const ref = band(
			[
				{ x: xr, y: 26 },
				{ x: xr, y: 150 },
				{ x: xr - gap / 2, y: 150 + gap / 2 },
				{ x: xr - gap, y: 150 },
				{ x: xr - gap, y: 90 }
			],
			Math.max(1, wRef)
		);
		const air =
			wAir > 0
				? band(
						[
							{ x: xa, y: 26 },
							{ x: xa, y: 250 }
						],
						wAir
					)
				: null;
		const surf = band(
			[
				{ x: xs, y: 26 },
				{ x: xs, y: GROUND - 2 }
			],
			wSurf
		);
		return { ref, air, surf, xr, xa, xs, wRef, wAir, wSurf, gap };
	});

	// ---- infrared bands
	const IRX = 380;
	const irBare = $derived(
		band(
			[
				{ x: IRX, y: GROUND - 2 },
				{ x: IRX, y: 40 }
			],
			Math.max(1, glow * K)
		)
	);
	// Measured flows (AR6 WG1 Fig. 7.2).
	const real = {
		up: band(
			[
				{ x: 345, y: GROUND - 2 },
				{ x: 345, y: 190 }
			],
			398 * K
		),
		down: band(
			[
				{ x: 510, y: 190 },
				{ x: 510, y: GROUND - 2 }
			],
			342 * K
		),
		out: band(
			[
				{ x: 425, y: 180 },
				{ x: 425, y: 40 }
			],
			239 * K
		)
	};

	const tt = $derived(reduced ? 2.5 : t);
	const SUN_N = 9;
	const sunPhotons = $derived(
		Array.from({ length: SUN_N }, (_, i) => {
			const p = sunPhoton(i, SUN_N, tt, 30, GROUND - 6);
			const xs = sunBands.xs + (((i * 37) % 9) / 9 - 0.5) * sunBands.wSurf * 0.7;
			return { ...p, x: xs };
		})
	);
	const IR_N = 12;
	const irPhotons = $derived(
		Array.from({ length: IR_N }, (_, i) =>
			irPhoton(i, IR_N, tt, {
				x0: view === 'real' ? 310 : IRX - 18,
				x1: view === 'real' ? 545 : IRX + 18,
				ground: GROUND - 6,
				top: 36,
				airTop: TOA + 30,
				airBottom: 320,
				absorb: view === 'real' ? 0.85 : 0
			})
		)
	);

	// ---- the chart of the bare planet's temperature
	const CX0 = 640;
	const CX1 = 930;
	const sx = scale([0, 20], [CX0, CX1]);
	const sy = scale([150, 300], [560, 400]);
	const trailWindow = $derived(trail.filter((p) => p.yr <= 20));
	const trailPath = $derived(
		linePath(
			trailWindow,
			(p) => p.yr,
			(p) => Math.max(150, p.T),
			sx,
			sy
		)
	);
	const fmtW = (v: number) => v.toFixed(0);
	const degC = (k: number) =>
		`${toCelsius(k) < -0.5 ? '−' : ''}${Math.abs(toCelsius(k)).toFixed(0)} °C`;
	const surfaceFill = $derived(view === 'bare' ? albedo : 0.12);
</script>

<g>
	<!-- space, air and ground -->
	<rect x="16" y="16" width="590" height={GROUND - 16} rx="10" fill="var(--gh-space)" />
	<rect
		x="16"
		y={TOA}
		width="590"
		height={GROUND - TOA}
		fill="var(--gh-air)"
		opacity={show.current.air * 0.9}
	/>
	<line
		x1="16"
		x2="606"
		y1={TOA}
		y2={TOA}
		stroke="var(--gh-air-edge)"
		stroke-dasharray="4 4"
		opacity={show.current.air}
	/>
	<rect x="16" y={GROUND} width="590" height="80" fill="var(--gh-ground)" />
	<rect x="16" y={GROUND} width="230" height="80" fill="var(--gh-ocean)" opacity="0.7" />
	<rect
		x="16"
		y={GROUND}
		width="590"
		height="80"
		fill="var(--gh-ice)"
		opacity={surfaceFill}
		stroke="var(--gh-ice-edge)"
		stroke-opacity={surfaceFill}
	/>
	<Readout id="space">
		<Label x={590} y={40} text="space" anchor="end" size={12} muted />
		<Label
			x={590}
			y={TOA + 22}
			text="air"
			anchor="end"
			size={12}
			muted
			opacity={show.current.air}
		/>
	</Readout>

	<!-- the Sun -->
	<circle cx="58" cy="58" r="24" fill="var(--gh-sun)" filter="url(#glow)" />
	<circle cx="58" cy="58" r="20" fill="var(--gh-sun-fill)" opacity="0.6" />

	<!-- sunlight -->
	{#if sunBands.wRef > 0.5}
		<path d={sunBands.ref.d} fill="var(--gh-sun)" fill-opacity="0.35" />
	{/if}
	{#if sunBands.air}
		<path d={sunBands.air.d} fill="var(--gh-sun)" fill-opacity={0.55 * show.current.air} />
	{/if}
	<path d={sunBands.surf.d} fill="var(--gh-sun)" fill-opacity="0.6" />
	{#each sunPhotons as p (p.key)}
		<Photon x={p.x} y={p.y} angle={90} length={30} opacity={p.opacity * 0.9} />
	{/each}
	<Readout id="sun-in">
		<Label
			x={X0 + 50}
			y={22}
			text="{fmtW(INCOMING)} W/m² arrive"
			anchor="start"
			size={12}
			weight={700}
		/>
	</Readout>
	<Readout
		id="sun-ref"
		order={2}
		label={view === 'real' ? undefined : 'Reflected'}
		value="{fmtW(reflected)} W/m² ({Math.round((reflected / INCOMING) * 100)}%)"
	>
		<Label
			x={sunBands.xr - sunBands.gap / 2}
			y={174 + sunBands.gap / 2}
			text="{fmtW(reflected)} reflected"
			size={12}
		/>
	</Readout>
	{#if view !== 'bare'}
		<Readout
			id="sun-air"
			order={3}
			label={view === 'sun' ? 'Absorbed by the air' : undefined}
			value="80 W/m²"
		>
			<Label
				x={sunBands.xa + 16}
				y={232}
				text="80 absorbed"
				anchor="start"
				size={12}
				opacity={show.current.air}
			/>
			<Label
				x={sunBands.xa + 16}
				y={248}
				text="by the air"
				anchor="start"
				size={12}
				opacity={show.current.air}
			/>
		</Readout>
	{/if}
	<Readout
		id="sun-surf"
		order={4}
		label={view === 'sun' ? 'Absorbed by the ground and ocean' : undefined}
		value="{fmtW(view === 'bare' ? asr : 160)} W/m²"
	>
		<Label
			x={X0 - 8}
			y={GROUND - 32}
			text="{fmtW(view === 'bare' ? asr : 160)} absorbed"
			anchor="end"
			size={12}
			weight={600}
		/>
		<Label
			x={X0 - 8}
			y={GROUND - 16}
			text={view === 'bare' ? 'by the ground' : 'by the surface'}
			anchor="end"
			size={12}
		/>
	</Readout>

	<!-- infrared -->
	{#if view === 'bare'}
		<path d={irBare.d} fill="var(--gh-ir)" fill-opacity="0.5" />
		<Readout id="ir-bare">
			<Label
				x={IRX + (glow * K) / 2 + 8}
				y={70}
				text="{fmtW(glow)} W/m² of infrared"
				anchor="start"
				size={12}
				weight={700}
				color="var(--gh-ir)"
			/>
		</Readout>
	{:else if view === 'real'}
		<g opacity={show.current.real}>
			<path d={real.up.d} fill="var(--gh-ir)" fill-opacity="0.45" />
			<path d={real.down.d} fill="var(--gh-ir)" fill-opacity="0.3" />
			<path d={real.out.d} fill="var(--gh-ir)" fill-opacity="0.6" />
			<Readout id="r-up">
				<Label x={345} y={GROUND - 40} text="398 up" size={12} weight={700} color="var(--gh-ir)" />
			</Readout>
			<Readout id="r-down">
				<Label
					x={510}
					y={GROUND - 40}
					text="342 down"
					size={12}
					weight={700}
					color="var(--gh-ir)"
				/>
			</Readout>
			<Readout id="r-out">
				<Label
					x={425 + 38}
					y={66}
					text="239 to space"
					anchor="start"
					size={12}
					weight={700}
					color="var(--gh-ir)"
				/>
			</Readout>
		</g>
	{/if}
	{#each irPhotons as p (p.key)}
		{#if p.flash}
			<circle
				cx={p.flash.x}
				cy={p.flash.y}
				r="7"
				fill="var(--gh-ir)"
				opacity={p.flash.opacity * 0.6}
			/>
		{/if}
		{#if view !== 'sun'}
			<Photon
				x={p.x}
				y={p.y}
				angle={p.angle}
				length={26}
				amplitude={3}
				color="var(--gh-ir)"
				opacity={p.opacity}
			/>
		{/if}
	{/each}

	<!-- right-hand panel -->
	{#if view === 'sun'}
		<Readout id="disc">
			<Label x={780} y={70} text="Why a quarter?" size={15} weight={700} />
			<circle cx={720} cy={170} r={56} fill="var(--gh-ocean)" opacity="0.5" />
			<ellipse cx={720} cy={170} rx={14} ry={56} fill="var(--gh-sun)" opacity="0.55" />
			<Label x={720} y={250} text="the disc catches" size={12} />
			<Label x={720} y={265} text="π r² of sunlight" size={12} muted />
			<circle cx={860} cy={170} r={56} fill="var(--gh-sun)" opacity="0.3" />
			<circle cx={860} cy={170} r={56} fill="none" stroke="var(--gh-sun)" />
			<Label x={860} y={250} text="the sphere shares it" size={12} />
			<Label x={860} y={265} text="over 4 π r²" size={12} muted />
		</Readout>
		<Readout
			id="quarter"
			order={0}
			label="Sunlight facing the Sun"
			value="{SOLAR.toLocaleString('en-US')} W/m², ÷ 4 = {fmtW(INCOMING)} on average"
		>
			<Label
				x={780}
				y={330}
				text="{SOLAR.toLocaleString('en-US')} W/m² ÷ 4 = {fmtW(INCOMING)} W/m²"
				size={14}
				weight={700}
			/>
			<Label x={780} y={354} text="averaged over the globe, day and night" size={12} muted />
		</Readout>
	{:else}
		<Readout id="title">
			<Label
				x={636}
				y={44}
				text={view === 'bare' ? 'A planet with no air' : 'The real Earth'}
				anchor="start"
				size={15}
				weight={700}
			/>
		</Readout>
		{#if view === 'bare'}
			{@const inW = asr * 0.55}
			{@const outW = Math.min(240, glow * 0.55)}
			<Label x={636} y={84} text="sunlight in" anchor="start" size={12} />
			<rect x={720} y={72} width={inW} height={16} rx="3" fill="var(--gh-sun)" opacity="0.75" />
			<Label x={636} y={112} text="infrared out" anchor="start" size={12} />
			<rect x={720} y={100} width={outW} height={16} rx="3" fill="var(--gh-ir)" opacity="0.75" />
			<Readout
				id="balance"
				order={1}
				label="In / out"
				value="{fmtW(asr)} in, {fmtW(glow)} out W/m²"
			>
				<Label x={720 + inW + 6} y={85} text={fmtW(asr)} anchor="start" size={12} weight={700} />
				<Label x={720 + outW + 6} y={113} text={fmtW(glow)} anchor="start" size={12} weight={700} />
			</Readout>
			<Readout
				id="imb"
				order={2}
				label="Imbalance"
				value="{imbalance >= 0 ? '+' : '−'}{Math.abs(imbalance).toFixed(0)} W/m² ({Math.abs(
					imbalance
				) < 0.5
					? 'balanced'
					: imbalance > 0
						? 'warming'
						: 'cooling'})"
				color={Math.abs(imbalance) < 0.5
					? 'var(--stage-ink)'
					: imbalance > 0
						? 'var(--gh-warm)'
						: 'var(--gh-cool)'}
			>
				<Label
					x={636}
					y={150}
					text={Math.abs(imbalance) < 0.5
						? 'balanced: in = out'
						: `${imbalance > 0 ? 'more in than out: warming' : 'more out than in: cooling'} (${imbalance > 0 ? '+' : '−'}${Math.abs(imbalance).toFixed(0)} W/m²)`}
					anchor="start"
					size={13}
					weight={600}
					color={Math.abs(imbalance) < 0.5
						? 'var(--stage-ink)'
						: imbalance > 0
							? 'var(--gh-warm)'
							: 'var(--gh-cool)'}
				/>
			</Readout>
			<Readout
				id="temp"
				order={0}
				label="Surface temperature"
				value="{Tnow.toFixed(0)} K = {degC(Tnow)} (settles at {tEq.toFixed(0)} K)"
			>
				<Label
					x={636}
					y={200}
					text="{Tnow.toFixed(0)} K = {degC(Tnow)}"
					anchor="start"
					size={22}
					weight={700}
				/>
				<Label
					x={636}
					y={224}
					text="settles at {tEq.toFixed(0)} K = {degC(tEq)}"
					anchor="start"
					size={12}
					muted
				/>
			</Readout>
			<!-- temperature through time -->
			<line x1={CX0} x2={CX1} y1={560} y2={560} stroke="var(--stage-line)" />
			<line x1={CX0} x2={CX0} y1={400} y2={560} stroke="var(--stage-line)" />
			<line
				x1={CX0}
				x2={CX1}
				y1={sy(Math.min(300, Math.max(150, tEq)))}
				y2={sy(Math.min(300, Math.max(150, tEq)))}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="4 3"
			/>
			<path d={trailPath} fill="none" stroke="var(--gh-warm)" stroke-width="2.5" />
			<Readout id="balance-line">
				<Label
					x={CX1}
					y={sy(Math.min(300, Math.max(150, tEq))) - 6}
					text="balance"
					anchor="end"
					size={11}
					muted
				/>
			</Readout>
			<Readout id="axes">
				<Label x={CX0} y={392} text="temperature, K" anchor="start" size={11} muted />
				<Label x={CX1} y={576} text="years →" anchor="end" size={11} muted />
				<Label x={CX0 - 6} y={sy(300) + 4} text="300" anchor="end" size={11} muted />
				<Label x={CX0 - 6} y={sy(150) + 4} text="150" anchor="end" size={11} muted />
			</Readout>
		{:else}
			<Readout id="compare" order={1} label="Surface" value="15 °C (288 K); bare planet −18 °C">
				<Label x={636} y={92} text="surface: 15 °C (288 K)" anchor="start" size={18} weight={700} />
				<Label x={636} y={118} text="bare planet: −18 °C (255 K)" anchor="start" size={13} muted />
				<Label
					x={636}
					y={146}
					text="the air keeps it 33 °C warmer"
					anchor="start"
					size={13}
					weight={600}
					color="var(--gh-warm)"
				/>
			</Readout>
			<Readout
				id="sums"
				order={2}
				label="Infrared"
				value="398 up from the surface, 342 back down, 239 to space (W/m²)"
			>
				<Label
					x={636}
					y={200}
					text="At the top of the air:"
					anchor="start"
					size={12}
					weight={700}
				/>
				<Label x={636} y={220} text="240 sunlight in ≈ 239 infrared out" anchor="start" size={12} />
				<Label x={636} y={252} text="At the surface:" anchor="start" size={12} weight={700} />
				<Label x={636} y={272} text="160 sunlight + 342 infrared in" anchor="start" size={12} />
				<Label x={636} y={290} text="≈ 398 infrared + 103 warm air out" anchor="start" size={12} />
				<Label x={636} y={326} text="W/m², AR6 Fig. 7.2" anchor="start" size={11} muted />
			</Readout>
		{/if}
	{/if}
</g>
