<script lang="ts">
	/**
	 * Step "limits" — what limits the rate of photosynthesis.
	 *
	 * Everything is driven by the leaf model in `../model.ts` (PROSPECT-D optics
	 * + the FvCB C₃ model), fed by four controls: `light` (% of full sunlight),
	 * `colour` ('white' or a wavelength in nm), `co2` (ppm) and `temp` (°C).
	 *
	 *   (a) left: a live strip chart of the last 30 s — O₂ released and sugar
	 *       made by 1 m² of leaf (µmol s⁻¹), with the current values below;
	 *   (b) top right: the leaf, with photons arriving, CO₂ going in and O₂
	 *       coming out, each stream as dense as its rate (O₂ goes in instead
	 *       when the leaf only respires);
	 *   (c) bottom right: "what sets the pace" — the CO₂ fixation the light
	 *       reactions could support (Wj) beside what RuBisCO could manage with
	 *       the CO₂ available (Wc). The smaller one is the actual rate.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Photon,
		Molecule,
		Label,
		Axes,
		colors,
		cycle,
		smoothstep,
		lerp,
		clamp,
		scale,
		linePath
	} from '#lib/draw/index.ts';
	import { rate, FULL_SUN } from '../model';

	let { t, params, reduced }: StageProps = $props();

	// ---- the model --------------------------------------------------------------
	const ppfd = $derived((clamp(Number(params.light ?? 70), 0, 100) / 100) * FULL_SUN);
	const colour = $derived(String(params.colour ?? 'white'));
	const nm = $derived(colour === 'white' ? null : clamp(Number(colour), 400, 700));
	const co2 = $derived(clamp(Number(params.co2 ?? 420), 0, 2000));
	const tempC = $derived(clamp(Number(params.temp ?? 25), -10, 50));
	const target = $derived(rate({ ppfd, light: nm ?? 'white', co2, tempC }));

	/** The drawn rates follow the model with a short wall-clock ease (the guide's sanctioned use). */
	const pick = (r: typeof target) => ({ o2: r.o2, wc: r.wc, wj: r.wj, rd: r.rd });
	const eased = new Tween(
		untrack(() => pick(target)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const next = pick(target);
		const duration = reduced ? 0 : 700;
		untrack(() => eased.set(next, { duration }));
	});
	const now = $derived(eased.current);
	const sugar = $derived(now.o2 / 6);

	// ---- (a) strip chart -------------------------------------------------------------
	const WINDOW = 30;
	const CH = { x: 84, y: 122, w: 440, h: 268 };
	const sx = scale([-WINDOW, 0], [CH.x, CH.x + CH.w]);
	const sy = scale([-5, 30], [CH.y + CH.h, CH.y]);
	/**
	 * History of the O₂ rate, sampled in t-time — the documented per-frame
	 * exception of the scene guide (a plot of the past can't be a function of
	 * the present t alone). On entering the step, after `t` restarts (dt < 0)
	 * and under reduced motion, the history is reset to a steady state: a
	 * flat line at the current rate across the whole window. A paused clock
	 * (dt = 0) records nothing new but lets the newest point follow a control
	 * moved while paused.
	 */
	interface Sample {
		t: number;
		v: number;
	}
	let hist: Sample[] = [];
	let lastT = -1;
	const history = $derived.by(() => {
		const v = now.o2;
		const dt = t - lastT;
		if (reduced || lastT < 0 || dt < 0 || hist.length === 0) {
			hist = [
				{ t: t - WINDOW, v },
				{ t, v }
			];
		} else if (dt === 0 || t - hist[hist.length - 2].t < 0.1) {
			// keep at most ten samples a second: the newest one just follows
			hist[hist.length - 1] = { t, v };
		} else {
			hist.push({ t, v });
			while (hist.length > 2 && hist[1].t <= t - WINDOW) hist.shift();
		}
		lastT = t;
		return hist.map((s) => ({ age: Math.max(-WINDOW, s.t - t), v: s.v }));
	});
	const o2Path = $derived(
		linePath(
			history,
			(s) => s.age,
			(s) => s.v,
			sx,
			sy
		)
	);
	const sugarPath = $derived(
		linePath(
			history,
			(s) => s.age,
			(s) => s.v / 6,
			sx,
			sy
		)
	);
	const gramsPerHour = $derived(sugar * 180.16 * 3600 * 1e-6);

	// ---- (b) leaf and streams --------------------------------------------------------
	const BLADE = 'M664 214 C 704 132, 812 104, 900 128 C 862 210, 760 252, 664 214 Z';
	const lightColor = $derived(nm === null ? undefined : nm);
	/** Points on the upper surface where the photons land. */
	const HITS = Array.from({ length: 10 }, (_, i) => ({
		x: 700 + i * 17,
		y: 186 - i * 6.2 + (i % 3) * 3
	}));
	const PHOTON_D = { x: 0.42, y: 1 };
	const photonsShown = $derived(Math.round((10 * ppfd) / FULL_SUN));
	const co2Shown = $derived(co2 <= 0 ? 0 : Math.max(1, Math.round((6 * co2) / 1200)));
	/** O₂ streams: up to 8 molecules for 20 µmol m⁻² s⁻¹; reversed when the leaf takes O₂ up. */
	const o2Shown = $derived(
		Math.abs(now.o2) < 0.05 ? 0 : clamp(Math.round((8 * Math.abs(now.o2)) / 20), 1, 8)
	);
	const o2Out = $derived(now.o2 >= 0);
	const fade = (u: number) => smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u));

	// ---- (c) what sets the pace ------------------------------------------------------
	const BAR = { x: 610, w: 300, h: 14 };
	const bx = scale([0, 35], [BAR.x, BAR.x + BAR.w]);
	const gross = $derived(Math.min(now.wc, now.wj));
	const lightLimited = $derived(now.wj <= now.wc);
	const verdict = $derived(
		ppfd <= 0
			? 'Dark: respiration only'
			: now.o2 < 0
				? // below the CO₂ compensation point neither supply can outpace
					// respiration, however bright the light
					Math.max(now.wc, now.wj) <= now.rd
					? 'Too little CO₂: the leaf loses carbon'
					: 'Too little light: the leaf loses carbon'
				: lightLimited
					? 'Limited by light'
					: 'Limited by RuBisCO and CO₂'
	);
	const status = $derived(
		now.o2 < 0
			? 'Net loss: the leaf respires faster than it photosynthesises.'
			: lightLimited
				? 'More light would help; more CO₂ helps only a little.'
				: 'More CO₂ would help; more light hardly does.'
	);
	const fmt = (v: number, d = 1) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
</script>

<g class="rate-scene">
	<defs>
		<clipPath id="rate-plot">
			<rect x={CH.x} y={CH.y - 4} width={CH.w + 4} height={CH.h + 8} />
		</clipPath>
		<clipPath id="rate-blade">
			<path d={BLADE} />
		</clipPath>
	</defs>

	<!-- ================= (a) strip chart ================= -->
	<Label
		x={40}
		y={40}
		text="One square metre of leaf, the last 30 seconds"
		anchor="start"
		size={14}
		weight={600}
	/>
	<g transform="translate(40 64)">
		<line
			x1="0"
			y1="0"
			x2="22"
			y2="0"
			stroke={colors.oxygen}
			stroke-width="3"
			stroke-linecap="round"
		/>
		<Label x={30} y={4} text="O₂ released" anchor="start" size={12} />
		<line
			x1="140"
			y1="0"
			x2="162"
			y2="0"
			stroke={colors.sugar}
			stroke-width="3"
			stroke-linecap="round"
		/>
		<Label x={170} y={4} text="sugar made (as glucose)" anchor="start" size={12} />
	</g>
	<Axes
		{sx}
		{sy}
		xTicks={[-30, -20, -10, 0]}
		yTicks={[0, 5, 10, 15, 20, 25, 30]}
		xFormat={(v) => (v === 0 ? 'now' : `${v} s`)}
		yLabel="µmol per second"
	/>
	<line
		x1={CH.x}
		y1={sy(0)}
		x2={CH.x + CH.w}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.7"
	/>
	<g clip-path="url(#rate-plot)">
		<path
			d={sugarPath}
			fill="none"
			stroke={colors.sugar}
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path
			d={o2Path}
			fill="none"
			stroke={colors.oxygen}
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
	</g>
	<circle
		cx={sx(0)}
		cy={sy(clamp(now.o2, -5, 30))}
		r="4.5"
		fill={colors.oxygen}
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<circle
		cx={sx(0)}
		cy={sy(clamp(sugar, -5, 30))}
		r="4.5"
		fill={colors.sugar}
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<!-- readouts -->
	<g transform="translate(40 452)">
		<Label x={0} y={0} text="O₂ released" anchor="start" size={12} muted />
		<Label
			x={150}
			y={0}
			text="{fmt(now.o2)} µmol per m² per second"
			anchor="start"
			size={15}
			weight={600}
			color={colors.oxygen}
		/>
		<Label x={0} y={32} text="sugar made" anchor="start" size={12} muted />
		<Label
			x={150}
			y={32}
			text="{fmt(sugar, 2)} µmol glucose per m² per second"
			anchor="start"
			size={15}
			weight={600}
			color={colors.sugar}
		/>
		<Label
			x={150}
			y={54}
			text="≈ {fmt(gramsPerHour, 2)} g of sugar per m² of leaf per hour"
			anchor="start"
			size={11}
			muted
		/>
		<Label x={0} y={92} text={status} anchor="start" size={13} />
	</g>

	<!-- ================= (b) the leaf ================= -->
	<Label
		x={600}
		y={40}
		text="light: {Math.round(ppfd).toLocaleString(
			'en-US'
		)} µmol photons per m² per second · {Math.round(tempC)} °C"
		anchor="start"
		size={11}
		muted
	/>
	<!-- photons from the upper left -->
	{#each HITS as h, i (i)}
		{#if i < photonsShown}
			{@const u = cycle(t, 1.6, ((i * 7) % 10) / 10)}
			<Photon
				x={h.x - PHOTON_D.x * lerp(120, 6, u)}
				y={h.y - PHOTON_D.y * lerp(120, 6, u)}
				angle={(Math.atan2(PHOTON_D.y, PHOTON_D.x) * 180) / Math.PI}
				wavelength={lightColor}
				length={30}
				opacity={fade(u)}
				phase={t * 3}
			/>
		{/if}
	{/each}
	<path
		d={BLADE}
		fill="var(--leaf)"
		stroke="var(--leaf-dark)"
		stroke-width="2.5"
		stroke-linejoin="round"
	/>
	<g clip-path="url(#rate-blade)" fill="none" stroke="var(--leaf-vein)" stroke-linecap="round">
		<path d="M664 214 C 740 196, 820 168, 900 128" stroke-width="3" />
		<path d="M720 200 c 10 -22, 26 -40, 50 -56" stroke-width="1.6" />
		<path d="M780 182 c 12 -20, 30 -36, 56 -48" stroke-width="1.6" />
		<path d="M720 200 c 24 10, 50 12, 76 4" stroke-width="1.6" />
		<path d="M780 182 c 26 10, 50 10, 72 0" stroke-width="1.6" />
	</g>
	<!-- CO₂ drifting in from the right, under the leaf -->
	{#each [0, 1, 2, 3, 4, 5] as k (k)}
		{#if k < co2Shown}
			{@const u = cycle(t, 4.2, k / 6)}
			<Molecule
				kind="CO2"
				x={lerp(936, 820, u)}
				y={lerp(262, 206, u) + 8 * Math.sin(u * 6 + k)}
				scale={0.75}
				opacity={fade(u)}
			/>
		{/if}
	{/each}
	<Label x={930} y={290} text="CO₂ in: {Math.round(co2)} ppm" anchor="end" size={11} muted />
	<!-- O₂ leaving upwards to the right (or going in, when the leaf only respires) -->
	{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
		{#if k < o2Shown}
			{@const c = cycle(t, 3.2, k / 8)}
			{@const u = o2Out ? c : 1 - c}
			<Molecule
				kind="O2"
				x={lerp(810, 902, u) + 6 * Math.sin(u * 7 + k)}
				y={lerp(150, 62, u)}
				scale={0.75}
				opacity={fade(c)}
			/>
		{/if}
	{/each}
	<Label x={930} y={100} text={o2Out ? 'O₂ out' : 'O₂ in'} anchor="end" size={11} muted />

	<!-- ================= (c) what sets the pace ================= -->
	<Label x={600} y={330} text="What sets the pace" anchor="start" size={14} weight={600} />
	<Label
		x={600}
		y={348}
		text="CO₂ the leaf could fix, µmol per m² per second"
		anchor="start"
		size={11}
		muted
	/>
	{#each [{ key: 'light', label: 'light reactions (ATP, NADPH)', v: now.wj, c: colors.atp, y: 384, limiting: lightLimited }, { key: 'calvin', label: 'Calvin cycle (RuBisCO, CO₂)', v: now.wc, c: colors.rubisco, y: 432, limiting: !lightLimited }] as b (b.key)}
		<Label
			x={BAR.x}
			y={b.y - 8}
			text={b.label}
			anchor="start"
			size={12}
			opacity={b.limiting ? 1 : 0.6}
		/>
		<rect x={BAR.x} y={b.y} width={BAR.w} height={BAR.h} rx="4" fill="var(--stage-grid)" />
		<rect
			x={BAR.x}
			y={b.y}
			width={Math.max(0, bx(clamp(b.v, 0, 35)) - BAR.x)}
			height={BAR.h}
			rx="4"
			fill={b.c}
			opacity={b.limiting ? 0.95 : 0.35}
		/>
		<Label
			x={Math.min(bx(clamp(b.v, 0, 35)) + 6, BAR.x + BAR.w - 30)}
			y={b.y + 11}
			text={fmt(Math.max(0, b.v))}
			anchor="start"
			size={12}
			weight={b.limiting ? 600 : 500}
		/>
	{/each}
	<!-- the actual (gross) rate: the smaller of the two -->
	{#if gross > 0.3}
		<line
			x1={bx(clamp(gross, 0, 35))}
			y1={380}
			x2={bx(clamp(gross, 0, 35))}
			y2={450}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
		/>
	{/if}
	<Label
		x={600}
		y={484}
		text="actual: {fmt(Math.max(0, gross))} − respiration {fmt(now.rd)} = net {fmt(now.o2)}"
		anchor="start"
		size={12}
		muted
	/>
	<Label x={600} y={520} text={verdict} anchor="start" size={13} weight={600} pill />
</g>
