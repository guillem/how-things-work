<script lang="ts">
	/**
	 * Two bodies in orbit seen from above, and the two-armed spiral of the waves
	 * they send out (crests solid, troughs dashed, of the "plus" polarisation).
	 * A crest at radius r left the pair r/c ago, so it points where the pair
	 * pointed then: φ = Ω(t − r/c) + kπ. The ratio of wavelength to orbit is the
	 * true one, λ = π·a·c/v; time is slowed so that the drawn waves move at 160 px/s.
	 *
	 * Phases (`step.hints.phase`):
	 *   ripples — two equal black holes at `params.vOrb` × c; horizons to scale
	 *   power   — `params.source`: the Earth and the Sun, the Hulse–Taylor pulsar
	 *             (its true eccentric orbit, Kepler's equation) or GW150914 near the
	 *             ISCO; the quadrupole power, and all three on a log bar of watts
	 *   summary — the ripples spread to a detector, with the size of the change
	 * Reduced motion: the frame at t = 2.5 s, which is complete.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		AU,
		G,
		GM_EARTH,
		GW150914,
		HULSE_TAYLOR,
		M_SUN,
		PLANCK_POWER,
		PROTON_RADIUS,
		YEAR,
		armDifference,
		iscoFrequency,
		periodDecay,
		powerAt,
		radiatedPower,
		semiMajorAxis
	} from '../gw';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';
	import { sci, sup } from './fmt';
	import { Readout } from '#lib/explainer/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'ripples'));
	const time = $derived(reduced ? 2.5 : t);

	// ---- layout ---------------------------------------------------------------------
	const PX0 = 16;
	const PY0 = 16;
	const PX1 = 640;
	const PY1 = 584;
	const CX = $derived(phase === 'summary' ? 210 : 328);
	const CY = 300;
	const KX = 660;
	const KW = 284;
	const CPX = 160; // drawn speed of the waves, px/s

	// ---- the orbit --------------------------------------------------------------------
	const source = $derived(String(params.source ?? 'earth'));
	const v = $derived(
		phase === 'power' ? (source === 'bbh' ? 1 / Math.sqrt(6) : 0) : Number(params.vOrb ?? 0.3)
	);
	/** Drawn separation, px. */
	const A = $derived(phase === 'summary' ? 30 : 40);
	const lambda = $derived(v > 0 ? (Math.PI * A) / v : 0);
	const omega = $derived(v > 0 ? (Math.PI * CPX) / lambda : 0.8); // rad/s, orbital
	const psi = $derived(omega * time);

	// ---- the spiral -------------------------------------------------------------------
	const BANDS = [
		[0, 90, 1],
		[90, 170, 0.75],
		[170, 260, 0.55],
		[260, 360, 0.4],
		[360, 520, 0.28]
	];
	function arm(k: number, r0: number, r1: number) {
		let d = '';
		const r00 = Math.max(r0, A * 0.6);
		for (let r = r00; r <= r1 + 0.1; r += 5) {
			const ph = psi - (omega * r) / CPX + (k * Math.PI) / 2;
			d += `${d ? 'L' : 'M'}${(CX + r * Math.cos(ph)).toFixed(1)} ${(CY - r * Math.sin(ph)).toFixed(1)}`;
		}
		return d;
	}
	const spiral = $derived(
		v > 0
			? [0, 1, 2, 3].flatMap((k) =>
					BANDS.map(([r0, r1, o], b) => ({
						key: `${k}-${b}`,
						d: arm(k, r0, r1),
						o,
						crest: k % 2 === 0
					}))
				)
			: []
	);
	const ripplesOn = $derived(phase !== 'power' || source === 'bbh');

	// two equal black holes; horizons to scale: a = M/v² in units of GM/c², rₛ = M/2·2 = M
	const rs = $derived(Math.max(3.5, A * v * v));
	const bodies = $derived.by(() => {
		if (phase === 'power' && source !== 'bbh') return [];
		const c = Math.cos(psi);
		const s = Math.sin(psi);
		return [
			{ id: 'a', x: CX + (A / 2) * c, y: CY - (A / 2) * s, r: rs },
			{ id: 'b', x: CX - (A / 2) * c, y: CY + (A / 2) * s, r: rs }
		];
	});

	// ---- the sources of the power step ----------------------------------------------------
	const ht = HULSE_TAYLOR;
	const htA = semiMajorAxis(ht.pulsar + ht.companion, ht.period);
	const powers = {
		earth: radiatedPower(M_SUN, GM_EARTH / G, AU, 0.0167),
		pulsar: radiatedPower(ht.pulsar * M_SUN, ht.companion * M_SUN, htA, ht.e),
		bbh: powerAt(GW150914.m1, GW150914.m2, iscoFrequency(GW150914.m1 + GW150914.m2))
	};
	const htDecay = -periodDecay(ht.pulsar, ht.companion, ht.period, ht.e) * YEAR * 1e6; // µs a year
	const SUN_LUMINOSITY = 3.828e26; // W (IAU nominal)

	/** Positions on the eccentric orbit (pulsar), drawn period 6 s. */
	const kepler = $derived.by(() => {
		const Mn = (2 * Math.PI * time) / 6;
		let E = Mn;
		for (let i = 0; i < 8; i++) E -= (E - ht.e * Math.sin(E) - Mn) / (1 - ht.e * Math.cos(E));
		const a = 130;
		const x = a * (Math.cos(E) - ht.e);
		const y = a * Math.sqrt(1 - ht.e ** 2) * Math.sin(E);
		const q = ht.companion / (ht.pulsar + ht.companion);
		// the ellipse's centre is offset so that the centre of mass sits at the middle
		return {
			p: { x: CX - q * x, y: CY + q * y },
			c: { x: CX + (1 - q) * x, y: CY - (1 - q) * y },
			a
		};
	});
	const earthAng = $derived((2 * Math.PI * time) / 8);

	// log bar of watts
	const LX0 = KX + 20;
	const LX1 = KX + KW - 20;
	const lw = (p: number) => LX0 + ((LX1 - LX0) * Math.log10(p)) / 53;
	const bars = $derived([
		{ id: 'earth', label: 'Earth–Sun', p: powers.earth },
		{ id: 'pulsar', label: 'pulsar', p: powers.pulsar },
		{ id: 'bbh', label: 'black holes', p: powers.bbh }
	]);

	// ---- summary ------------------------------------------------------------------------
	const dl = armDifference(GW150914.peakStrain);
	const protonFraction = Math.round((2 * PROTON_RADIUS) / dl);
	const DX = 540;
</script>

<g>
	<defs>
		<clipPath id="binary-clip">
			<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>

	<!-- the waves -->
	{#if ripplesOn}
		<g clip-path="url(#binary-clip)">
			{#each spiral as s (s.key)}
				<path
					d={s.d}
					fill="none"
					stroke={s.crest ? 'var(--gw-crest)' : 'var(--gw-trough)'}
					stroke-width={s.crest ? 2.4 : 1.4}
					stroke-dasharray={s.crest ? undefined : '5 5'}
					stroke-linecap="round"
					opacity={s.o * (s.crest ? 1 : 0.8)}
				/>
			{/each}
		</g>
	{/if}

	<!-- the bodies -->
	{#if phase === 'power' && source === 'earth'}
		<circle cx={CX} cy={CY} r="190" fill="none" stroke="var(--stage-line)" stroke-dasharray="4 6" />
		<circle cx={CX} cy={CY} r="22" fill="#f59f00" />
		<circle
			cx={CX + 190 * Math.cos(earthAng)}
			cy={CY - 190 * Math.sin(earthAng)}
			r="7"
			fill="#1c7ed6"
			stroke="var(--gw-space)"
			stroke-width="1.5"
		/>
		<T x={CX} y={CY + 44} text="the Sun" anchor="middle" size={12} muted />
		<T
			x={CX + 190 * Math.cos(earthAng)}
			y={CY - 190 * Math.sin(earthAng) - 14}
			text="Earth"
			anchor="middle"
			size={12}
			weight={600}
		/>
	{:else if phase === 'power' && source === 'pulsar'}
		{@const q = ht.companion / (ht.pulsar + ht.companion)}
		<ellipse
			cx={CX - q * kepler.a * -ht.e}
			cy={CY}
			rx={q * kepler.a}
			ry={q * kepler.a * Math.sqrt(1 - ht.e ** 2)}
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="4 6"
		/>
		<ellipse
			cx={CX + (1 - q) * kepler.a * -ht.e}
			cy={CY}
			rx={(1 - q) * kepler.a}
			ry={(1 - q) * kepler.a * Math.sqrt(1 - ht.e ** 2)}
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="4 6"
		/>
		<circle cx={kepler.p.x} cy={kepler.p.y} r="7" fill="var(--gw-crest)" />
		<circle cx={kepler.c.x} cy={kepler.c.y} r="7" fill="var(--gw-horizon)" />
		<T x={kepler.p.x} y={kepler.p.y - 14} text="pulsar" anchor="middle" size={12} weight={600} />
		<T x={kepler.c.x} y={kepler.c.y - 14} text="companion" anchor="middle" size={12} muted />
	{:else}
		{#each bodies as b (b.id)}
			<circle cx={b.x} cy={b.y} r={b.r} fill="var(--gw-hole)" stroke="var(--gw-horizon)" />
		{/each}
	{/if}

	<!-- captions in the panel -->
	{#if phase === 'ripples'}
		<Readout id="bin-cap">
			<T x={PX0 + 20} y={PY1 - 40} text="solid: crests · dashed: troughs" size={12} muted />
			<T
				x={PX0 + 20}
				y={PY1 - 20}
				text="black holes and their orbit to scale; the waves move outwards at c (slowed down)"
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'power'}
		<Readout id="bin-cap">
			<T
				x={PX0 + 20}
				y={PY1 - 20}
				text={source === 'bbh'
					? 'two black holes at the innermost stable orbit, to scale, with their waves'
					: 'orbit not to scale; its waves are far too faint and long to draw'}
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<!-- a detector far away -->
		<g opacity="0.95">
			<line
				x1={DX}
				y1={CY + 40}
				x2={DX + 70}
				y2={CY + 40}
				stroke="var(--gw-laser)"
				stroke-width="3"
			/>
			<line x1={DX} y1={CY + 40} x2={DX} y2={CY - 30} stroke="var(--gw-laser)" stroke-width="3" />
			<rect x={DX - 5} y={CY + 35} width="10" height="10" fill="var(--stage-ink)" />
			<T x={DX + 35} y={CY + 64} text="a detector" anchor="middle" size={12} weight={600} />
		</g>
	{/if}

	<!-- readouts -->
	{#if phase === 'ripples'}
		<Card x={KX} y={PY0} w={KW} h={172} />
		<T x={KX + 16} y={PY0 + 28} text="The waves" size={15} weight={700} />
		<Row
			id="speed"
			order={1}
			x={KX + 16}
			y={PY0 + 60}
			w={KW - 32}
			label="Travel at"
			value="c, the speed of light"
		/>
		<Row
			id="freq"
			order={2}
			x={KX + 16}
			y={PY0 + 88}
			w={KW - 32}
			label="Wave frequency"
			value="2 × the orbit’s"
		/>
		<Row
			id="lambda"
			order={3}
			x={KX + 16}
			y={PY0 + 116}
			w={KW - 32}
			label="Wavelength"
			value="{(lambda / A).toFixed(1)} × the separation"
			color="var(--gw-crest)"
		/>
		<Row
			id="fall"
			order={4}
			x={KX + 16}
			y={PY0 + 144}
			w={KW - 32}
			label="Strength"
			value="falls as 1/distance"
		/>
	{:else if phase === 'power'}
		{@const p =
			source === 'earth' ? powers.earth : source === 'pulsar' ? powers.pulsar : powers.bbh}
		<Card x={KX} y={PY0} w={KW} h={200} />
		<T
			x={KX + 16}
			y={PY0 + 28}
			text={source === 'earth'
				? 'The Earth and the Sun'
				: source === 'pulsar'
					? 'PSR B1913+16'
					: 'GW150914 at the ISCO'}
			size={15}
			weight={700}
		/>
		<Row
			id="power"
			order={1}
			x={KX + 16}
			y={PY0 + 60}
			w={KW - 32}
			label="Power in waves"
			value="{sci(p, 2)} W"
			color="var(--gw-crest)"
		/>
		{#if source === 'earth'}
			<Row
				id="p2"
				order={2}
				x={KX + 16}
				y={PY0 + 88}
				w={KW - 32}
				label="Masses"
				value="1 Sun + 1 Earth"
			/>
			<Row
				id="p3"
				order={3}
				x={KX + 16}
				y={PY0 + 116}
				w={KW - 32}
				label="Separation"
				value="1 AU, 150 million km"
			/>
			<Row
				id="p4"
				order={4}
				x={KX + 16}
				y={PY0 + 144}
				w={KW - 32}
				label="Like"
				value="one bright light bulb"
			/>
			<Row
				id="p5"
				order={5}
				x={KX + 16}
				y={PY0 + 172}
				w={KW - 32}
				label="Orbit shrinks"
				value="unmeasurably"
			/>
		{:else if source === 'pulsar'}
			<Row
				id="p2"
				order={2}
				x={KX + 16}
				y={PY0 + 88}
				w={KW - 32}
				label="Masses"
				value="1.44 + 1.39 suns"
			/>
			<Row
				id="p3"
				order={3}
				x={KX + 16}
				y={PY0 + 116}
				w={KW - 32}
				label="Orbit"
				value="7.75 h, eccentricity 0.62"
			/>
			<Row
				id="p4"
				order={4}
				x={KX + 16}
				y={PY0 + 144}
				w={KW - 32}
				label="Period shrinks by"
				value="{htDecay.toFixed(0)} µs a year"
			/>
			<Row
				id="p5"
				order={5}
				x={KX + 16}
				y={PY0 + 172}
				w={KW - 32}
				label="Measured ÷ predicted"
				value={ht.ratio.toFixed(4)}
			/>
		{:else}
			<Row
				id="p2"
				order={2}
				x={KX + 16}
				y={PY0 + 88}
				w={KW - 32}
				label="Masses"
				value="36 + 29 suns"
			/>
			<Row
				id="p3"
				order={3}
				x={KX + 16}
				y={PY0 + 116}
				w={KW - 32}
				label="Separation"
				value="6 GM/c² ≈ 580 km"
			/>
			<Row
				id="p4"
				order={4}
				x={KX + 16}
				y={PY0 + 144}
				w={KW - 32}
				label="Measured at the peak"
				value="{sci(GW150914.peakPower, 2)} W"
			/>
			<Row
				id="p5"
				order={5}
				x={KX + 16}
				y={PY0 + 172}
				w={KW - 32}
				label="Peak ÷ the Sun’s light"
				value={sci(GW150914.peakPower / SUN_LUMINOSITY, 1)}
			/>
		{/if}

		<!-- all three on one scale of watts -->
		<Readout id="bars">
			<Card x={KX} y={PY0 + 216} w={KW} h={240} />
			<T x={KX + 16} y={PY0 + 244} text="Power, watts (log scale)" size={13.5} weight={700} />
			{#each bars as b, i (b.id)}
				{@const y = PY0 + 280 + i * 44}
				<rect
					x={LX0}
					{y}
					width={lw(b.p) - LX0}
					height="14"
					rx="3"
					fill={b.id === source ? 'var(--gw-crest)' : 'var(--stage-line)'}
					opacity={b.id === source ? 1 : 0.6}
				/>
				<T
					x={LX0}
					y={y - 5}
					text="{b.label}: {sci(b.p, 2)} W"
					size={11.5}
					muted={b.id !== source}
				/>
			{/each}
			{@const yA = PY0 + 410}
			<line x1={LX0} x2={LX1} y1={yA} y2={yA} stroke="var(--stage-line)" />
			{#each [0, 10, 20, 30, 40, 50] as e (e)}
				<line x1={lw(10 ** e)} x2={lw(10 ** e)} y1={yA} y2={yA + 5} stroke="var(--stage-line)" />
				<T x={lw(10 ** e)} y={yA + 18} text="10{sup(e)}" anchor="middle" size={11} muted />
			{/each}
			<line
				x1={lw(PLANCK_POWER)}
				x2={lw(PLANCK_POWER)}
				y1={PY0 + 268}
				y2={yA}
				stroke="var(--gw-trough)"
				stroke-dasharray="3 3"
			/>
			<T
				x={lw(PLANCK_POWER)}
				y={yA + 36}
				text="c⁵/G"
				anchor="end"
				size={11.5}
				color="var(--gw-trough)"
				weight={600}
			/>
		</Readout>
	{:else}
		<Card x={KX} y={PY0} w={KW} h={196} />
		<T x={KX + 16} y={PY0 + 28} text="When the wave arrives" size={15} weight={700} />
		<Row
			id="s1"
			order={1}
			x={KX + 16}
			y={PY0 + 60}
			w={KW - 32}
			label="Strain (GW150914)"
			value="h = 1.0 × 10⁻²¹"
		/>
		<Row id="s2" order={2} x={KX + 16} y={PY0 + 88} w={KW - 32} label="Arm length" value="4 km" />
		<Row
			id="s3"
			order={3}
			x={KX + 16}
			y={PY0 + 116}
			w={KW - 32}
			label="Change ΔL = h·L"
			value="{sci(dl, 2)} m"
			color="var(--gw-dl)"
		/>
		<Row
			id="s4"
			order={4}
			x={KX + 16}
			y={PY0 + 144}
			w={KW - 32}
			label="A proton’s width"
			value="{protonFraction} × larger"
			color="var(--gw-proton)"
		/>
		<Readout id="s5">
			<T x={KX + 16} y={PY0 + 176} text="Since 2015: hundreds of mergers heard" size={12} muted />
		</Readout>
	{/if}
</g>
