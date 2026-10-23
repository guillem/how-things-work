<script lang="ts">
	/**
	 * The comet's nucleus close up: a dark lump of ice and dust, lit by the Sun on the left. The
	 * Sun looks bigger and its light stronger as the comet comes in (one of the control's stops,
	 * from far beyond Neptune to the closest point). Once the model's water ice turns to gas, gas
	 * and dust burst out of the sunny side, a fuzzy head grows round the lump, and both are pushed
	 * back, away from the Sun.
	 */
	import { Label, clamp, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { HALLEY, darkTemperature, iceRate, sunlight } from '../model';
	import { STOPS, far, stopDays, when } from '../steps';

	let { step, t, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'warming'));
	const stop = $derived(
		phase === 'frozen'
			? Number(step.hints?.reach ?? 0)
			: clamp(Math.round(Number(params.reach ?? 0)), 0, STOPS.length - 1)
	);
	const r = $derived(STOPS[stop]);
	const light = $derived(sunlight(r));
	const rate = $derived(iceRate(r) / iceRate(HALLEY.q));
	/** Activity, 0 (frozen) to 1 (closest), on a scale that shows the first trickle. */
	const active = $derived(clamp(Math.log10(Math.max(rate, 1e-9)) / 3 + 1));

	// ---- the Sun and its light -----------------------------------------------------------------
	const SUN = { x: 64, y: 300 };
	/** The Sun's size in the sky grows as the comet comes in. */
	const sunR = $derived(clamp(26 / r, 2.5, 48));
	const glow = $derived(clamp(0.25 + 0.75 * Math.pow(light, 0.35), 0.15, 1));
	const rays = [-120, -80, -40, 0, 40, 80, 120].map((dy, i) => ({ i, dy }));

	// ---- the nucleus ---------------------------------------------------------------------------
	const NX = 470;
	const NY = 300;
	const RX = 150;
	const RY = 82;
	const outline = Array.from({ length: 64 }, (_, i) => {
		const a = (i / 64) * Math.PI * 2;
		const k = 1 + 0.07 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2) - 0.12 * Math.cos(a) ** 8;
		return {
			x: NX + RX * k * Math.cos(a),
			y: NY + RY * k * Math.sin(a) * (1 + 0.15 * Math.cos(a))
		};
	});
	const body =
		outline.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
		' Z';
	const ice = Array.from({ length: 9 }, (_, i) => ({
		i,
		x: NX - 110 + hash(i, 1) * 170,
		y: NY - 50 + hash(i, 2) * 100,
		rx: 6 + hash(i, 3) * 10,
		ry: 3 + hash(i, 4) * 4
	}));
	/** Points on the sunny (left) side where gas bursts out. */
	const vents = outline.filter((_, i) => i >= 26 && i <= 38);

	// ---- gas and dust leaving --------------------------------------------------------------------
	const N = 70;
	const bits = Array.from({ length: N }, (_, i) => {
		const v = vents[Math.floor(hash(i, 5) * vents.length)];
		const nx = v.x - NX;
		const ny = (v.y - NY) * 1.6;
		const n = Math.hypot(nx, ny);
		return {
			i,
			gas: i % 2 === 0,
			x0: v.x,
			y0: v.y,
			ux: nx / n,
			uy: ny / n,
			off: hash(i, 6),
			order: hash(i, 7)
		};
	});
	const flow = $derived(
		bits.map((b) => {
			const u = cycle(t, b.gas ? 3.2 : 4.6, b.off);
			// Out from the sunny side, spreading as it goes. (The Sun's push that turns gas and
			// dust into tails acts over thousands of kilometres, far beyond this close-up.)
			const out = b.gas ? 240 : 170;
			const push = b.gas ? 40 : 20;
			const x = b.x0 + b.ux * out * u + push * u * u;
			const y = b.y0 + b.uy * out * u * (1 + 0.5 * u);
			const shown = clamp((active * N - b.order * N) / 4 + 0.5) * smoothstep(0, 0.15, active);
			const fade = smoothstep(0, 0.08, u) * (1 - smoothstep(0.75, 1, u));
			return { i: b.i, gas: b.gas, x, y, o: shown * fade };
		})
	);

	// ---- the read-outs ---------------------------------------------------------------------------
	function times(k: number) {
		if (k >= 100) return (Math.round(k / 50) * 50).toLocaleString('en-GB');
		if (k >= 10) return String(Math.round(k));
		return k.toFixed(1).replace(/\.0$/, '');
	}
	const lightText = $derived(
		Math.abs(light - 1) < 0.05
			? 'as strong as on Earth'
			: light < 1
				? `${times(1 / light)} times weaker than on Earth`
				: `${times(light)} times stronger than on Earth`
	);
	const temp = $derived(Math.round(darkTemperature(r) / 5) * 5);
	const tempText = $derived(`${temp < 0 ? '−' : ''}${Math.abs(temp)} °C`);
	const whenText = $derived(
		stop === STOPS.length - 1 ? 'closest to the Sun' : `${when(stopDays[stop])} its closest`
	);
	const status = $derived(
		active < 0.02
			? 'frozen solid'
			: active < 0.45
				? 'ice starting to turn to gas'
				: active < 0.85
					? 'ice turning to gas'
					: 'ice turning to gas fastest'
	);
</script>

<g class="nucleus">
	<defs>
		<radialGradient id="ct-nucleus-sun">
			<stop offset="0" stop-color="var(--ct-sun)" stop-opacity="0.8" />
			<stop offset="1" stop-color="var(--ct-sun)" stop-opacity="0" />
		</radialGradient>
		<radialGradient id="ct-nucleus-coma" cx="0.42" cy="0.5">
			<stop offset="0" stop-color="var(--ct-coma)" stop-opacity="0.7" />
			<stop offset="0.6" stop-color="var(--ct-coma)" stop-opacity="0.25" />
			<stop offset="1" stop-color="var(--ct-coma)" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="ct-nucleus-shade" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="var(--ct-nucleus-lit)" />
			<stop offset="0.55" stop-color="var(--ct-nucleus)" />
			<stop offset="1" stop-color="var(--ct-nucleus-dark)" />
		</linearGradient>
	</defs>

	<!-- the fuzzy head -->
	<ellipse
		cx={NX + 30}
		cy={NY}
		rx={180 + 300 * active}
		ry={130 + 170 * active}
		fill="url(#ct-nucleus-coma)"
		opacity={active}
	/>

	<!-- sunlight -->
	<circle cx={SUN.x} cy={SUN.y} r={sunR * 2.4} fill="url(#ct-nucleus-sun)" opacity={glow} />
	<circle cx={SUN.x} cy={SUN.y} r={sunR} fill="var(--ct-sun)" />
	{#each rays as ray (ray.i)}
		<line
			x1={SUN.x + 60}
			y1={SUN.y + ray.dy * 0.35}
			x2={NX - RX - 20}
			y2={NY + ray.dy * 0.55}
			stroke="var(--ct-sun)"
			stroke-width="2"
			stroke-dasharray="10 12"
			stroke-dashoffset={-t * 40}
			opacity={0.15 + 0.6 * clamp(Math.pow(light, 0.3))}
		/>
	{/each}
	<Label
		x={SUN.x + 20}
		y={SUN.y - Math.max(sunR, 12) - 16}
		text="sunlight"
		size={14}
		weight={700}
		color="var(--ct-sun-ink)"
	/>
	<Readout id="ct-sun-label">
		<Label x={SUN.x} y={SUN.y + Math.max(sunR, 12) + 22} text="Sun" size={13} weight={700} />
	</Readout>

	<!-- gas and dust, drawn behind the lump so they stream round it -->
	{#each flow as b (b.i)}
		{#if b.o > 0.01}
			<circle
				cx={b.x}
				cy={b.y}
				r={b.gas ? 3.4 : 2.4}
				fill={b.gas ? 'var(--ct-gas)' : 'var(--ct-dust)'}
				opacity={b.o}
			/>
		{/if}
	{/each}

	<!-- the lump -->
	<path d={body} fill="url(#ct-nucleus-shade)" stroke="var(--ct-nucleus-edge)" stroke-width="1.5" />
	{#each ice as p (p.i)}
		<ellipse
			cx={p.x}
			cy={p.y}
			rx={p.rx}
			ry={p.ry}
			fill="var(--ct-ice)"
			opacity={0.5 * (1 - (p.x - NX + 110) / 300)}
		/>
	{/each}

	{#if active > 0.3}
		<Label
			x={330}
			y={128}
			text="gas"
			size={14}
			weight={700}
			color="var(--ct-gas-ink)"
			opacity={smoothstep(0.3, 0.5, active)}
		/>
		<Label
			x={250}
			y={470}
			text="dust"
			size={14}
			weight={700}
			color="var(--ct-dust-ink)"
			opacity={smoothstep(0.3, 0.5, active)}
		/>
	{/if}

	<Label x={NX} y={NY + 118} text="ice mixed with dust and rock" size={14} weight={700} />
	<line
		x1={NX - 150}
		y1={NY + 140}
		x2={NX + 150}
		y2={NY + 140}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<line
		x1={NX - 150}
		y1={NY + 134}
		x2={NX - 150}
		y2={NY + 146}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<line
		x1={NX + 150}
		y1={NY + 134}
		x2={NX + 150}
		y2={NY + 146}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<Label x={NX} y={NY + 162} text="about 15 km" size={12} muted />

	{#if phase === 'warming' && active > 0.3}
		<Readout id="ct-burn">
			<Label
				x={NX}
				y={556}
				text="nothing is burning: the ice turns straight into gas"
				size={14}
				pill
				opacity={smoothstep(0.3, 0.5, active)}
			/>
		</Readout>
	{/if}

	<Readout id="ct-nucleus-card">
		<rect
			x="586"
			y="20"
			width="354"
			height="128"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity="0.92"
		/>
	</Readout>
	<Readout id="ct-nucleus-far" order={1} label="From the Sun" value={far(r)}>
		<Label x={924} y={50} text={far(r)} anchor="end" size={18} weight={700} halo={false} />
	</Readout>
	<Readout id="ct-nucleus-when" order={2} label="On Halley’s path" value={whenText}>
		<Label x={924} y={74} text={whenText} anchor="end" size={13} muted halo={false} />
	</Readout>
	<Readout id="ct-nucleus-light" order={3} label="Sunlight" value={lightText}>
		<Label x={924} y={98} text="sunlight {lightText}" anchor="end" size={13} halo={false} />
	</Readout>
	<Readout
		id="ct-nucleus-status"
		order={4}
		label="The ice"
		value="{status} (a dark lump here: {tempText})"
	>
		<Label
			x={924}
			y={128}
			text="{status} · a dark lump: {tempText}"
			anchor="end"
			size={14}
			weight={700}
			color={active < 0.02 ? 'var(--stage-ink-muted)' : 'var(--ct-gas-ink)'}
			halo={false}
		/>
	</Readout>
</g>
