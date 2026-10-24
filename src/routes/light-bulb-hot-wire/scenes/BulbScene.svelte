<script lang="ts">
	/**
	 * An old-style bulb in a dim corner of a room (the left panel): glass globe, screw base, two
	 * support wires and the coiled tungsten wire between them. The wire's colour and its halo come
	 * from the model at the dimmer's setting (dark, dull red, orange, yellow, white). The right side
	 * changes with the step: a colour strip of the wire's temperature (dimmer), a magnifier on the
	 * wire with the electricity jostling its atoms (wire), the electricity split into light and heat
	 * (split), the glass cracked and the wire burning in air (burn), and the bulb swapped for an LED
	 * bulb with both bulbs' bars side by side (led). Wavy lines leaving the globe are the heat it
	 * gives off, most of it infrared.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, linear } from 'svelte/easing';
	import { Handle, Label, clamp, cycle, hash, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DRAPER,
		FULL,
		WIRE_DIAMETER,
		WIRE_LENGTH,
		bulb,
		celsius,
		glow,
		glowColour,
		glowName,
		led
	} from '../model';
	import { percent } from '../steps';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'bulb'));
	/** The id of this step's dimmer control. */
	const control = $derived(String(step.hints?.control ?? 'level'));
	const usesDimmer = $derived(phase === 'dimmer' || phase === 'split');
	const dimmer = $derived(usesDimmer ? clamp(Number(params[control] ?? 1)) : 1);
	const isLed = $derived(phase === 'led' && params.kind === 'led');
	const air = $derived(phase === 'burn' && params.air === true);

	// ---- the wire burning in air ------------------------------------------------------------------
	// The burn runs on a Tween (wall-clock), from the moment the glass is cracked; switching the
	// air off again puts in a new bulb at once.
	const burn = new Tween(0, { duration: 1800, easing: linear });
	$effect(() => {
		const on = air;
		untrack(() => void burn.set(on ? 1 : 0, on && !reduced ? undefined : { duration: 0 }));
	});
	const p = $derived(burn.current);
	/** The wire snaps 60% of the way through the burn. */
	const snapped = $derived(p >= 0.6);

	const m = $derived(bulb(dimmer));
	const kelvin = $derived(snapped ? 293 : m.kelvin);
	const g = $derived(isLed ? 0 : snapped ? 0 : glow(kelvin));
	const colour = $derived(glowColour(Math.max(kelvin, DRAPER + 1)));
	const ledOn = $derived(isLed ? 1 : 0);
	const ledGlow = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = ledOn;
		untrack(() => void ledGlow.set(v, reduced ? { duration: 0 } : undefined));
	});
	const lg = $derived(ledGlow.current);

	// ---- the layout -----------------------------------------------------------------------------
	const CX = 274;
	const GY = 228;
	const GR = 138;
	const FY = 214;
	const FX0 = 222;
	const FX1 = 326;
	const BASE_TOP = 392;
	const BASE_BOT = 476;

	/** The globe and its neck, one outline. */
	const globe = `M${CX - 58} ${BASE_TOP} C${CX - 60} ${GY + 120} ${CX - GR} ${GY + 70} ${CX - GR} ${GY}
		A${GR} ${GR} 0 1 1 ${CX + GR} ${GY}
		C${CX + GR} ${GY + 70} ${CX + 60} ${GY + 120} ${CX + 58} ${BASE_TOP} Z`;
	/** The coiled wire, seen from the side. */
	const coil = (() => {
		const pts: string[] = [];
		const N = 15;
		for (let i = 0; i <= 300; i++) {
			const u = i / 300;
			const th = u * N * Math.PI * 2;
			const x = FX0 + (FX1 - FX0) * u + 3.5 * Math.cos(th);
			const y = FY + 10 * Math.sin(th);
			pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
		}
		return pts.join(' ');
	})();
	/** The coil with a gap where it snapped. */
	const coilLeft = coil.split(' L').slice(0, 140).join(' L');
	const coilRight = 'M' + coil.split(' L').slice(160).join(' L');
	const supports = `M${FX0} ${FY} L${CX - 16} 352 M${FX1} ${FY} L${CX + 16} 352`;

	// ---- the dimmer knob --------------------------------------------------------------------------
	const TX0 = 104;
	const TX1 = 444;
	const TY = 540;
	const knobX = $derived(TX0 + (TX1 - TX0) * dimmer);
	const setDimmer = (v: number) => setParam(control, Math.round(clamp(v) * 100) / 100);

	// ---- heat leaving the bulb ---------------------------------------------------------------------
	const showHeat = $derived(phase === 'split' || phase === 'led' || phase === 'bulb');
	/** Watts of heat this bulb gives off, and how strongly to draw the waves. */
	const heatW = $derived(isLed ? led(FULL.lumens).heat : air && snapped ? 0 : m.heat);
	const heatO = $derived(clamp(heatW / 40) * (showHeat ? 1 : 0));
	const rays = Array.from({ length: 10 }, (_, i) => ({
		i,
		a: -Math.PI / 2 + ((i - 4.5) / 10) * Math.PI * 1.7,
		o: hash(i, 3)
	}));
	function wavy(a: number, r0: number, len: number): string {
		const pts: string[] = [];
		for (let k = 0; k <= 16; k++) {
			const r = r0 + (k / 16) * len;
			const w = Math.sin(k * 1.4) * 5;
			const x = CX + Math.cos(a) * r - Math.sin(a) * w;
			const y = GY + Math.sin(a) * r + Math.cos(a) * w;
			pts.push(`${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
		}
		return pts.join(' ');
	}
	const waves = $derived(
		rays.map((r) => {
			const u = reduced ? 0.45 : cycle(t, 2.6, r.o);
			const r0 = GR + 12 + u * 70;
			return {
				i: r.i,
				d: wavy(r.a, r0, 34),
				o: smoothstep(0, 0.15, u) * (1 - smoothstep(0.75, 1, u))
			};
		})
	);
	/** The LED's heat leaves from its base, sideways. */
	const baseWaves = $derived(
		[0, 1, 2, 3].map((i) => {
			const side = i % 2 === 0 ? -1 : 1;
			const u = reduced ? 0.45 : cycle(t, 2.2, i * 0.27);
			const y = BASE_TOP - 6 + (i < 2 ? 0 : 26);
			const x0 = CX + side * (66 + u * 50);
			const pts = Array.from({ length: 9 }, (_, k) => {
				const x = x0 + side * k * 4;
				return `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(y + Math.sin(k * 1.3) * 4).toFixed(1)}`;
			}).join(' ');
			return { i, d: pts, o: smoothstep(0, 0.15, u) * (1 - smoothstep(0.75, 1, u)) };
		})
	);

	// ---- the gas inside (burn step) --------------------------------------------------------------
	const specks = Array.from({ length: 16 }, (_, i) => ({
		i,
		a: hash(i, 21) * Math.PI * 2,
		r: 30 + Math.sqrt(hash(i, 22)) * 85,
		w: (hash(i, 23) - 0.5) * 0.5,
		o: hash(i, 24) * 9
	}));
	const gas = $derived(
		specks.map((s) => {
			const a = s.a + (reduced ? 0 : t * s.w);
			const jx = reduced ? 0 : Math.sin(t * 1.3 + s.o) * 6;
			return {
				i: s.i,
				x: CX + Math.cos(a) * s.r + jx,
				y: GY - 12 + Math.sin(a) * s.r * 0.85,
				// Air takes the place of the argon a speck at a time as it comes in.
				air: air && hash(s.i, 25) < Math.min(1, p * 2.5)
			};
		})
	);

	// ---- smoke when the wire burns -----------------------------------------------------------------
	const puffs = Array.from({ length: 9 }, (_, i) => ({ i, x: hash(i, 7), o: hash(i, 8) }));
	const smoke = $derived(
		puffs.map((s) => {
			const u = reduced ? 0.3 + 0.6 * s.o : cycle(t, 2.4, s.o);
			return {
				i: s.i,
				x: FX0 + 10 + s.x * 84 + Math.sin(u * 6 + s.o * 9) * 8,
				y: FY - 12 - u * 120,
				r: 6 + u * 12,
				o: 0.55 * (1 - u) * smoothstep(0.02, 0.2, p) * (1 - smoothstep(0.85, 1, p) * 0.6)
			};
		})
	);

	// ---- colour strip of temperatures (the dimmer step) -----------------------------------------
	const SX0 = 572;
	const SX1 = 932;
	const MAXC = 2500;
	const sx = (c: number) => SX0 + ((SX1 - SX0) * c) / MAXC;
	const strip = Array.from({ length: 50 }, (_, i) => {
		const c = (i + 0.5) * (MAXC / 50);
		const k = c + 273.15;
		return {
			i,
			x: sx(i * (MAXC / 50)),
			w: (SX1 - SX0) / 50 + 0.5,
			fill: glowColour(Math.max(k, DRAPER + 1)),
			o: glow(k)
		};
	});
	/** Where each colour name sits on the strip: the middle of its run of temperatures. */
	const names = (() => {
		const runs: Record<string, [number, number]> = {};
		for (let c = 0; c <= MAXC; c += 10) {
			const nm = glowName(c + 273.15)
				.replace('yellowish white', 'white')
				.replace(/^red$/, 'dull red');
			if (nm === 'no glow') continue;
			const r = runs[nm] as [number, number] | undefined;
			runs[nm] = r ? [r[0], c] : [c, c];
		}
		return Object.entries(runs).map(([name, [a, b]]) => ({
			name,
			x: sx(name === 'white' ? MAXC : (a + b) / 2)
		}));
	})();
	const markX = $derived(sx(clamp(kelvin - 273.15, 0, MAXC)));

	// ---- the bars ----------------------------------------------------------------------------------
	const PX_PER_W = 360 / 60;
	const fmtW = (w: number) =>
		w < 0.05
			? 'almost none'
			: w < 9.5
				? `${(Math.round(w * 10) / 10).toString()} W`
				: `${Math.round(w)} W`;
	const ledBulb = led(FULL.lumens);
	const timesHeat = $derived(m.light > 0.01 ? Math.round(m.heat / m.light) : 0);

	// ---- headline -----------------------------------------------------------------------------------
	const tempText = $derived(`${celsius(kelvin).toLocaleString('en-US')} °C`);
	const name = $derived(glowName(kelvin));
	const headline = $derived.by(() => {
		if (phase === 'dimmer') return dimmer <= 0 ? 'Dimmer: off' : `Dimmer: ${percent(dimmer)}`;
		if (phase === 'wire') return 'Inside the wire';
		if (phase === 'split') return `Electricity in: ${fmtW(m.watts)}`;
		if (phase === 'burn')
			return !air
				? 'No air inside the bulb'
				: snapped
					? 'The wire has snapped'
					: 'Air in: the wire burns';
		if (phase === 'led') return isLed ? `LED bulb: ${fmtW(ledBulb.watts)}` : 'Old-style bulb: 60 W';
		if (phase === 'next') return 'A wire heated until it glows';
		return 'An old-style 60 W bulb';
	});
	const sub = $derived.by(() => {
		if (phase === 'dimmer')
			return dimmer <= 0
				? 'no electricity: the wire is cold'
				: name === 'no glow'
					? 'warm, but too cool to glow'
					: `the wire glows ${name}`;
		if (phase === 'wire') return 'electricity squeezing through a thin wire';
		if (phase === 'split') return 'what comes out: light and heat';
		if (phase === 'burn')
			return !air
				? 'empty, or filled with argon: nothing to burn in'
				: snapped
					? 'the light is out'
					: 'the oxygen eats the hot wire away';
		if (phase === 'led') return 'the same light from both bulbs';
		if (phase === 'next') return 'nearly all its electricity becomes heat';
		return 'a thin wire, glowing white-hot';
	});
	const cardW = $derived(Math.max(headline.length * 10.4, sub.length * 7.4));
</script>

<g class="lbh-bulb">
	<defs>
		<radialGradient id="light-bulb-hot-wire-halo">
			<stop offset="0" stop-color={isLed ? 'var(--lbh-led-light)' : colour} stop-opacity="0.95" />
			<stop
				offset="0.35"
				stop-color={isLed ? 'var(--lbh-led-light)' : colour}
				stop-opacity="0.45"
			/>
			<stop offset="1" stop-color={isLed ? 'var(--lbh-led-light)' : colour} stop-opacity="0" />
		</radialGradient>
		<clipPath id="light-bulb-hot-wire-room">
			<rect x="24" y="24" width="500" height="552" rx="18" />
		</clipPath>
		<clipPath id="light-bulb-hot-wire-lens">
			<circle cx="748" cy="246" r="148" />
		</clipPath>
	</defs>

	<!-- a dim corner of a room, so the glow shows in both themes -->
	<rect x="24" y="24" width="500" height="552" rx="18" fill="var(--lbh-room)" />

	<!-- the glow around the wire (or the LED's lit globe) -->
	{#if g > 0 || lg > 0}
		<circle
			cx={CX}
			cy={isLed ? GY + 10 : FY}
			r={isLed ? 250 : 30 + 230 * g}
			fill="url(#light-bulb-hot-wire-halo)"
			opacity={isLed ? lg : g}
		/>
	{/if}

	<!-- the glass -->
	<path
		d={globe}
		fill={isLed ? 'var(--lbh-frost)' : 'var(--lbh-glass)'}
		stroke="var(--lbh-glass-edge)"
		stroke-width="2.5"
	/>
	{#if isLed}
		<path d={globe} fill="var(--lbh-led-light)" opacity={0.85 * lg} />
	{/if}
	{#if phase === 'burn' && air}
		<!-- cracks in the glass -->
		<path
			d="M{CX + 92} {GY - 96} l-22 30 l14 10 l-26 36 M{CX + 70} {GY - 66} l26 6 M{CX + 58} {GY -
				20} l-18 24"
			fill="none"
			stroke="var(--lbh-crack)"
			stroke-width="2"
			stroke-linecap="round"
		/>
	{/if}

	{#if !isLed}
		<!-- the glass stem and the support wires -->
		<path
			d="M{CX - 22} {BASE_TOP} L{CX - 12} 352 L{CX + 12} 352 L{CX + 22} {BASE_TOP} Z"
			fill="var(--lbh-glass-edge)"
			opacity="0.5"
		/>
		<path d={supports} fill="none" stroke="var(--lbh-support)" stroke-width="2.5" />
		<!-- the coiled wire: cold, then glowing over it -->
		{#if snapped}
			<path d={coilLeft} fill="none" stroke="var(--lbh-wire)" stroke-width="2.2" />
			<path d={coilRight} fill="none" stroke="var(--lbh-wire)" stroke-width="2.2" />
			<ellipse cx={CX} cy={FY + 8} rx="30" ry="5" fill="var(--lbh-smoke)" opacity="0.7" />
		{:else}
			<path d={coil} fill="none" stroke="var(--lbh-wire)" stroke-width="2.2" />
			<path d={coil} fill="none" stroke={colour} stroke-width="2.6" opacity={clamp(g * 1.6)} />
			{#if g > 0.6}
				<path
					d={coil}
					fill="none"
					stroke={colour}
					stroke-width="6"
					opacity={(g - 0.6) * 1.2}
					filter="url(#glow)"
				/>
			{/if}
		{/if}
		{#each smoke as s (s.i)}
			<circle cx={s.x} cy={s.y} r={s.r} fill="var(--lbh-smoke)" opacity={s.o} />
		{/each}
		{#if phase === 'burn'}
			<!-- the gas in the bulb: argon, or air rushing in through the crack -->
			{#each gas as s (s.i)}
				<circle
					cx={s.x}
					cy={s.y}
					r="4"
					fill={s.air ? 'var(--lbh-oxygen)' : 'var(--lbh-gas)'}
					opacity="0.85"
				/>
			{/each}
		{/if}
	{:else}
		<!-- the LED chips on their board -->
		<rect x={CX - 52} y="300" width="104" height="14" rx="4" fill="var(--lbh-board)" />
		{#each [0, 1, 2, 3, 4] as i (i)}
			<rect x={CX - 44 + i * 19} y="294" width="12" height="8" rx="2" fill="var(--lbh-chip)" />
		{/each}
		<path
			d="M{CX - 46} 314 L{CX - 30} 360 M{CX + 46} 314 L{CX + 30} 360"
			stroke="var(--lbh-support)"
			stroke-width="3"
		/>
	{/if}

	<!-- the base: a screw cap (and an LED bulb's finned body above it) -->
	{#if isLed}
		<path
			d="M{CX - 60} {BASE_TOP - 46} L{CX + 60} {BASE_TOP - 46} L{CX + 52} {BASE_TOP + 4} L{CX -
				52} {BASE_TOP + 4} Z"
			fill="var(--lbh-sink)"
			stroke="var(--lbh-metal-dark)"
			stroke-width="1.5"
		/>
		{#each [0, 1, 2, 3] as i (i)}
			<line
				x1={CX - 57 + i * 1.6}
				y1={BASE_TOP - 36 + i * 11}
				x2={CX + 57 - i * 1.6}
				y2={BASE_TOP - 36 + i * 11}
				stroke="var(--lbh-metal-dark)"
				stroke-width="1.5"
			/>
		{/each}
		<path
			d="M{CX - 60} {BASE_TOP - 46} L{CX + 60} {BASE_TOP - 46} L{CX + 52} {BASE_TOP + 4} L{CX -
				52} {BASE_TOP + 4} Z"
			fill="var(--lbh-heat)"
			opacity={0.45 * lg}
		/>
	{/if}
	<rect
		x={CX - 52}
		y={BASE_TOP}
		width="104"
		height={BASE_BOT - BASE_TOP}
		rx="6"
		fill="var(--lbh-metal)"
		stroke="var(--lbh-metal-dark)"
		stroke-width="1.5"
	/>
	{#each [0, 1, 2, 3] as i (i)}
		<path
			d="M{CX - 52} {BASE_TOP + 14 + i * 18} Q{CX} {BASE_TOP + 22 + i * 18} {CX + 52} {BASE_TOP +
				10 +
				i * 18}"
			fill="none"
			stroke="var(--lbh-metal-dark)"
			stroke-width="2"
		/>
	{/each}
	<path
		d="M{CX - 30} {BASE_BOT} L{CX + 30} {BASE_BOT} L{CX + 14} {BASE_BOT + 18} L{CX - 14} {BASE_BOT +
			18} Z"
		fill="var(--lbh-metal-dark)"
	/>

	<!-- heat leaving the bulb -->
	{#if heatO > 0.01}
		<g opacity={heatO} clip-path="url(#light-bulb-hot-wire-room)">
			{#if isLed}
				{#each baseWaves as w (w.i)}
					<path
						d={w.d}
						fill="none"
						stroke="var(--lbh-heat)"
						stroke-width="3"
						stroke-linecap="round"
						opacity={w.o}
					/>
				{/each}
			{:else}
				{#each waves as w (w.i)}
					<path
						d={w.d}
						fill="none"
						stroke="var(--lbh-ir)"
						stroke-width="3"
						stroke-linecap="round"
						opacity={w.o}
					/>
				{/each}
			{/if}
		</g>
	{/if}

	<!-- the dimmer knob -->
	{#if usesDimmer}
		<line
			x1={TX0}
			y1={TY}
			x2={TX1}
			y2={TY}
			stroke="var(--lbh-track)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={TX0}
			y1={TY}
			x2={knobX}
			y2={TY}
			stroke="var(--lbh-light)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<Readout id="lbh-track">
			<Label
				x={TX0 - 14}
				y={TY + 5}
				text="off"
				anchor="end"
				size={14}
				color="var(--lbh-room-ink)"
				halo={false}
			/>
			<Label
				x={TX1 + 14}
				y={TY + 5}
				text="full"
				anchor="start"
				size={14}
				color="var(--lbh-room-ink)"
				halo={false}
			/>
		</Readout>
		<Handle
			x={knobX}
			y={TY}
			r={13}
			label="Dimmer"
			value={dimmer}
			min={0}
			max={1}
			valuetext={percent(dimmer)}
			color="var(--lbh-knob)"
			onmove={(q: Point) => setDimmer((q.x - TX0) / (TX1 - TX0))}
			onkey={(s) => setDimmer(s === 'start' ? 0 : s === 'end' ? 1 : dimmer + s / 100)}
		/>
	{/if}

	<!-- ===================================================== the right-hand side, by step -->
	{#if phase === 'dimmer'}
		<Readout
			id="lbh-temp"
			order={2}
			label="The wire"
			value="{tempText}, {dimmer <= 0 ? 'cold' : name}"
		>
			<Label x={572} y={214} text={tempText} anchor="start" size={44} weight={700} tabular />
			<Label x={572} y={250} text="the wire’s temperature" anchor="start" size={16} muted />
		</Readout>
		<rect x={SX0} y="300" width={SX1 - SX0} height="30" rx="4" fill="var(--lbh-room)" />
		{#each strip as s (s.i)}
			<rect x={s.x} y="300" width={s.w} height="30" fill={s.fill} opacity={s.o} />
		{/each}
		<path d="M{markX} 296 l-9 -14 l18 0 Z" fill="var(--stage-ink)" />
		<line x1={markX} y1="298" x2={markX} y2="334" stroke="var(--stage-ink)" stroke-width="2" />
		<Readout id="lbh-names">
			{#each names as nm (nm.name)}
				<Label
					x={nm.x}
					y={356}
					text={nm.name}
					anchor={nm.name === 'white' ? 'end' : 'middle'}
					size={14}
					weight={600}
				/>
			{/each}
			<Label x={SX0} y={384} text="0 °C" anchor="start" size={13} muted />
			<Label x={SX1} y={384} text="2,500 °C" anchor="end" size={13} muted />
		</Readout>
	{:else if phase === 'wire'}
		{@const hot = glowColour(FULL.kelvin)}
		<line
			x1={FX1 + 6}
			y1={FY - 12}
			x2="640"
			y2="140"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<line
			x1={FX1 + 6}
			y1={FY + 12}
			x2="640"
			y2="352"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<circle cx="748" cy="246" r="148" fill="var(--lbh-room)" />
		<g clip-path="url(#light-bulb-hot-wire-lens)">
			<rect x="600" y="196" width="296" height="100" fill={hot} opacity="0.9" />
			{#each Array.from({ length: 30 }, (_, i) => i) as i (i)}
				{@const col = i % 10}
				{@const row = Math.floor(i / 10)}
				{@const jig = reduced ? 0 : 3.2}
				<circle
					cx={612 + col * 30 + (row % 2) * 15 + Math.sin(t * 13 + i * 2.1) * jig}
					cy={216 + row * 30 + Math.cos(t * 11 + i * 1.7) * jig}
					r="9"
					fill="var(--lbh-atom)"
				/>
			{/each}
			{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
				{@const u = reduced ? hash(i, 4) : cycle(t, 3.2, hash(i, 4))}
				<circle
					cx={600 + u * 296}
					cy={231 + (i % 2) * 30 + Math.sin(u * 20 + i) * 4}
					r="4.5"
					fill="var(--lbh-electron)"
				/>
			{/each}
		</g>
		<circle
			cx="748"
			cy="246"
			r="148"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="3"
		/>
		<Readout
			id="lbh-lens1"
			order={2}
			label="In the wire"
			value="electricity pushes through and shakes the metal’s atoms"
		>
			<Label
				x={748}
				y={176}
				text="electricity pushes through →"
				anchor="middle"
				size={15}
				weight={600}
				color="var(--lbh-room-ink)"
				halo={false}
			/>
			<Label
				x={748}
				y={326}
				text="shaken atoms: the wire is hot"
				anchor="middle"
				size={15}
				weight={600}
				color="var(--lbh-room-ink)"
				halo={false}
			/>
		</Readout>
		<!-- thinner than a hair, to scale with each other -->
		<line
			x1="660"
			y1="440"
			x2="930"
			y2="440"
			stroke="var(--lbh-hair)"
			stroke-width="23"
			stroke-linecap="round"
		/>
		<line
			x1="660"
			y1="488"
			x2="930"
			y2="488"
			stroke={hot}
			stroke-width={(23 * WIRE_DIAMETER * 1000) / 0.07}
			stroke-linecap="round"
		/>
		<line
			x1="660"
			y1="488"
			x2="930"
			y2="488"
			stroke="var(--lbh-wire-edge)"
			stroke-width={(23 * WIRE_DIAMETER * 1000) / 0.07}
			stroke-linecap="round"
			opacity="0.35"
		/>
		<Readout
			id="lbh-hair"
			order={3}
			label="Thickness"
			value="a hair 0.07 mm; the wire {(WIRE_DIAMETER * 1000).toFixed(2)} mm"
		>
			<Label x={644} y={445} text="a hair" anchor="end" size={15} weight={600} />
			<Label x={644} y={493} text="the wire" anchor="end" size={15} weight={600} />
		</Readout>
		<Readout
			id="lbh-long"
			order={4}
			label="Uncoiled"
			value="about {Math.round(WIRE_LENGTH * 10) * 10} cm long"
		>
			<Label
				x={930}
				y={540}
				text="uncoiled, the wire is about {Math.round(WIRE_LENGTH * 10) * 10} cm long"
				anchor="end"
				size={15}
				muted
			/>
		</Readout>
	{:else if phase === 'split'}
		{@const lightW = Math.max(m.watts > 0 ? 2 : 0, m.light * PX_PER_W)}
		{@const heatPx = m.heat * PX_PER_W}
		<rect
			x="572"
			y="250"
			width="360"
			height="56"
			rx="6"
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="4 5"
		/>
		<rect x="572" y="250" width={lightW} height="56" fill="var(--lbh-light)" />
		<rect x={572 + lightW} y="250" width={heatPx} height="56" fill="var(--lbh-heat)" />
		<Readout id="lbh-light" order={2} label="Light" value={fmtW(m.light)} color="var(--lbh-light)">
			<path d="M574 244 l0 -26" stroke="var(--lbh-light)" stroke-width="2.5" />
			<Label
				x={572}
				y={210}
				text="light: {fmtW(m.light)}"
				anchor="start"
				size={18}
				weight={700}
				color="var(--lbh-light-ink)"
			/>
		</Readout>
		<Readout id="lbh-heat" order={3} label="Heat" value={fmtW(m.heat)} color="var(--lbh-heat)">
			<Label
				x={572}
				y={340}
				text="heat: {fmtW(m.heat)}"
				anchor="start"
				size={18}
				weight={700}
				color="var(--lbh-heat-ink)"
			/>
		</Readout>
		{#if timesHeat >= 2}
			<Readout id="lbh-times" order={4} label="The heat is" value="{timesHeat} times the light">
				<Label
					x={572}
					y={392}
					text="the heat is {timesHeat} times the light"
					anchor="start"
					size={20}
					weight={700}
				/>
				<Label
					x={572}
					y={418}
					text="most of it leaves as invisible infrared"
					anchor="start"
					size={15}
					muted
				/>
			</Readout>
		{/if}
	{:else if phase === 'burn'}
		<circle cx="584" cy="246" r="7" fill="var(--lbh-gas)" />
		<Readout
			id="lbh-argon"
			order={2}
			label="Grey dots"
			value="argon: nothing burns in it"
			color="var(--lbh-gas)"
		>
			<Label
				x={600}
				y={252}
				text="argon: nothing burns in it"
				anchor="start"
				size={17}
				weight={600}
			/>
		</Readout>
		<circle cx="584" cy="290" r="7" fill="var(--lbh-oxygen)" opacity={air ? 1 : 0.35} />
		<Readout
			id="lbh-oxygen"
			order={3}
			label="Blue dots"
			value="oxygen from the air"
			color="var(--lbh-oxygen)"
			opacity={air ? 1 : 0}
		>
			<Label
				x={600}
				y={296}
				text="oxygen from the air"
				anchor="start"
				size={17}
				weight={600}
				muted={!air}
			/>
		</Readout>
		<Readout id="lbh-life" order={4} label="Sealed, a bulb lasts" value="about 1,000 hours">
			<Label
				x={572}
				y={360}
				text="sealed, a bulb lasts about 1,000 hours"
				anchor="start"
				size={15}
				muted
			/>
		</Readout>
	{:else if phase === 'led'}
		{#each [{ id: 'old', y: 214, b: FULL, label: 'old-style bulb' }, { id: 'led', y: 350, b: ledBulb, label: 'LED bulb' }] as row (row.id)}
			{@const on = (row.id === 'led') === isLed}
			<g opacity={on ? 1 : 0.5}>
				<rect
					x="572"
					y={row.y}
					width={row.b.light * PX_PER_W}
					height="44"
					fill="var(--lbh-light)"
				/>
				<rect
					x={572 + row.b.light * PX_PER_W}
					y={row.y}
					width={row.b.heat * PX_PER_W}
					height="44"
					fill="var(--lbh-heat)"
				/>
			</g>
			<Readout
				id="lbh-row-{row.id}"
				order={row.id === 'old' ? 2 : 3}
				label={row.label}
				value="{fmtW(row.b.watts)}: light {fmtW(row.b.light)}, heat {fmtW(row.b.heat)}"
			>
				<Label
					x={572}
					y={row.y - 14}
					text="{row.label}: {fmtW(row.b.watts)}"
					anchor="start"
					size={17}
					weight={on ? 700 : 600}
				/>
				<Label
					x={572}
					y={row.y + 68}
					text="light {fmtW(row.b.light)} · heat {fmtW(row.b.heat)}"
					anchor="start"
					size={14}
					muted
				/>
			</Readout>
		{/each}
		<Readout
			id="lbh-led-note"
			order={4}
			label="The LED's heat"
			value="about {Math.round(FULL.heat / ledBulb.heat)} times less, out through its warm base"
		>
			<Label
				x={572}
				y={490}
				text="same light: the LED’s heat is"
				anchor="start"
				size={16}
				weight={600}
			/>
			<Label
				x={572}
				y={514}
				text="about {Math.round(FULL.heat / ledBulb.heat)} times smaller, and warms its base"
				anchor="start"
				size={16}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- headline -->
	<Readout id="lbh-card">
		<rect
			x={944 - cardW - 14}
			y="14"
			width={cardW + 28}
			height="64"
			rx="10"
			fill="var(--surface)"
			opacity="0.9"
		/>
	</Readout>
	<Readout id="lbh-head" order={1} label="Now" value={headline}>
		<Label x={944} y={40} text={headline} anchor="end" size={19} weight={700} />
	</Readout>
	<Readout id="lbh-sub" order={6}>
		<Label x={944} y={66} text={sub} anchor="end" size={15} muted />
	</Readout>
</g>
