<script lang="ts">
	/**
	 * Step "pigments" — why leaves are green.
	 *
	 * One composition in three parts, all driven by the `wavelength` control:
	 *   (a) the visible spectrum with a marker and a readout (colour, energy);
	 *   (b) the absorption spectra of chlorophyll a, chlorophyll b and the
	 *       carotenoids, with a cursor at the current wavelength;
	 *   (c) a leaf hit by a stream of photons of that wavelength. Each photon is
	 *       either absorbed (it fades out inside the leaf with a glow) or
	 *       reflected, in proportion to the total absorbance.
	 * A caption at the bottom puts the number into words.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Photon,
		Label,
		colors,
		wavelengthToColor,
		absorbance,
		cycle,
		smoothstep,
		hash,
		lerp,
		clamp,
		smooth,
		pathFrom,
		type Point
	} from '#lib/draw/index.ts';

	let { t, params }: StageProps = $props();

	// ---- current wavelength ----------------------------------------------------
	const wavelength = $derived(clamp(Number(params.wavelength ?? 550), 400, 700));
	const abs = $derived(absorbance(wavelength));
	const energy = $derived(1239.8 / wavelength);
	const color = $derived(wavelengthToColor(wavelength));
	const band = $derived(
		wavelength < 450
			? 'violet'
			: wavelength < 485
				? 'blue'
				: wavelength < 500
					? 'cyan'
					: wavelength < 565
						? 'green'
						: wavelength < 590
							? 'yellow'
							: wavelength < 625
								? 'orange'
								: 'red'
	);
	const pct = (v: number) => `${Math.round(v * 100)}%`;

	// ---- (a) spectrum bar ------------------------------------------------------
	const BAR = { x: 80, y: 60, w: 800, h: 36 };
	const barX = (nm: number) => BAR.x + ((nm - 400) / 300) * BAR.w;
	const stops = Array.from({ length: 31 }, (_, i) => 400 + i * 10);
	const ticks = [400, 450, 500, 550, 600, 650, 700];
	const markerX = $derived(barX(wavelength));
	const readoutX = $derived(clamp(markerX, 200, 760));

	// ---- (b) absorption chart --------------------------------------------------
	const PLOT = { x: 110, y: 160, w: 500, h: 150 };
	const cx = (nm: number) => PLOT.x + ((nm - 400) / 300) * PLOT.w;
	const cy = (a: number) => PLOT.y + PLOT.h - a * PLOT.h;
	type Pigment = 'chlA' | 'chlB' | 'car' | 'total';
	const samples = Array.from({ length: 61 }, (_, i) => ({
		nm: 400 + i * 5,
		...absorbance(400 + i * 5)
	}));
	const curve = (key: Pigment) =>
		pathFrom(
			smooth(
				samples.map((s) => ({ x: cx(s.nm), y: cy(s[key]) })),
				4
			)
		);
	const pathA = curve('chlA');
	const pathB = curve('chlB');
	const pathCar = curve('car');
	const pathTotal = curve('total');
	const areaTotal = `${pathTotal} L${cx(700)} ${cy(0)} L${cx(400)} ${cy(0)} Z`;
	const legend = [
		{ key: 'chlA' as const, label: 'chlorophyll a', color: colors.chlorophyllA },
		{ key: 'chlB' as const, label: 'chlorophyll b', color: colors.chlorophyllB },
		{ key: 'car' as const, label: 'carotenoids', color: colors.carotenoid }
	];
	const cursorX = $derived(cx(wavelength));
	const cursorPillX = $derived(clamp(cursorX, PLOT.x + 60, PLOT.x + PLOT.w - 60));

	// ---- (c) leaf and photons --------------------------------------------------
	// The blade of LeafScene, scaled down and laid almost flat (tip to the right).
	const LEAF = { cx: 800, cy: 338, s: 0.53, rot: 16 };
	const ORIGIN = { x: 446, y: 284 }; // centre of the blade in LeafScene coordinates
	const cosR = Math.cos((LEAF.rot * Math.PI) / 180);
	const sinR = Math.sin((LEAF.rot * Math.PI) / 180);
	const toStage = (p: Point): Point => ({
		x: LEAF.cx + LEAF.s * (cosR * (p.x - ORIGIN.x) - sinR * (p.y - ORIGIN.y)),
		y: LEAF.cy + LEAF.s * (sinR * (p.x - ORIGIN.x) + cosR * (p.y - ORIGIN.y))
	});
	const leafTransform = `translate(${LEAF.cx} ${LEAF.cy}) rotate(${LEAF.rot}) scale(${LEAF.s}) translate(${-ORIGIN.x} ${-ORIGIN.y})`;

	// Upper edge of the blade (cubic Bézier, LeafScene coordinates).
	const E0 = { x: 200, y: 362 };
	const E1 = { x: 280, y: 222 };
	const E2 = { x: 520, y: 150 };
	const E3 = { x: 692, y: 198 };
	const bez = (u: number): Point => {
		const v = 1 - u;
		return {
			x: v * v * v * E0.x + 3 * v * v * u * E1.x + 3 * v * u * u * E2.x + u * u * u * E3.x,
			y: v * v * v * E0.y + 3 * v * v * u * E1.y + 3 * v * u * u * E2.y + u * u * u * E3.y
		};
	};
	const edge = Array.from({ length: 121 }, (_, i) => toStage(bez(i / 120)));
	const unit = (v: Point): Point => {
		const l = Math.hypot(v.x, v.y) || 1;
		return { x: v.x / l, y: v.y / l };
	};

	const N = 10;
	const PERIOD = 3.4;
	const HIT = 0.55; // fraction of the cycle spent travelling to the leaf
	const D_IN = unit({ x: -0.45, y: 1 }); // photons come from the upper right
	const L_IN = 145;
	const L_OUT = 130;
	const L_ABS = 26;
	// The upper surface is nearly flat, so every photon reflects about the same
	// (slightly tilted) normal: a clean fan going up and to the left.
	const NORMAL = unit({ x: -0.17, y: -1 });
	const R_OUT = (() => {
		const dot = D_IN.x * NORMAL.x + D_IN.y * NORMAL.y;
		return unit({ x: D_IN.x - 2 * dot * NORMAL.x, y: D_IN.y - 2 * dot * NORMAL.y });
	})();
	const deg = (v: Point) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
	const photons = Array.from({ length: N }, (_, i) => {
		// Hit points spread along the upper surface, in a shuffled order.
		const targetX = 735 + (105 * ((i * 7) % N)) / (N - 1);
		let k = 0;
		for (let j = 1; j < edge.length; j++)
			if (Math.abs(edge[j].x - targetX) < Math.abs(edge[k].x - targetX)) k = j;
		const hit = edge[k];
		const r = R_OUT;
		return {
			i,
			// Stratified thresholds: the share of absorbed photons tracks the
			// total absorbance in steps of 1/N, in a fixed pseudo-random order.
			threshold: (i + hash(i, 11)) / N,
			offset: ((i * 3) % N) / N,
			start: { x: hit.x - D_IN.x * L_IN, y: hit.y - D_IN.y * L_IN },
			hit,
			reflectEnd: { x: hit.x + r.x * L_OUT, y: hit.y + r.y * L_OUT },
			absorbEnd: { x: hit.x + D_IN.x * L_ABS, y: hit.y + D_IN.y * L_ABS },
			angleIn: deg(D_IN),
			angleOut: deg(r)
		};
	});
	const reflectLabel = (() => {
		const ends = photons.map((p) => p.reflectEnd);
		const x = ends.reduce((s, p) => s + p.x, 0) / ends.length;
		const y = Math.min(...ends.map((p) => p.y));
		return { x: x - 10, y: y - 16 };
	})();
	const absorbLabel = { x: 790, y: 414 };

	const absorbedCount = $derived(photons.filter((p) => p.threshold < abs.total).length);

	// ---- (d) caption -----------------------------------------------------------
	const dominant = $derived(
		abs.chlA >= abs.chlB && abs.chlA >= abs.car
			? 'chlorophyll a'
			: abs.chlB >= abs.car
				? 'chlorophyll b'
				: 'the carotenoids'
	);
	const caption = $derived.by(() => {
		const Colour = band[0].toUpperCase() + band.slice(1);
		if (abs.total <= 0.15) {
			return band === 'green'
				? 'Green light is mostly reflected — this is why leaves look green.'
				: `${Colour} light is mostly reflected or passed through — the pigments barely absorb it.`;
		}
		if (abs.total <= 0.45) return `${Colour} light is partly absorbed, mostly by ${dominant}.`;
		return `${Colour} light is strongly absorbed, mainly by ${dominant}.`;
	});
	const breakdown = $derived(
		`chlorophyll a ${pct(abs.chlA)} · chlorophyll b ${pct(abs.chlB)} · carotenoids ${pct(abs.car)} · ${absorbedCount} of ${N} photons absorbed`
	);
</script>

<g class="spectrum-scene">
	<defs>
		<linearGradient id="spectrum-bar" x1="0" y1="0" x2="1" y2="0">
			{#each stops as nm (nm)}
				<stop offset={(nm - 400) / 300} stop-color={wavelengthToColor(nm)} />
			{/each}
		</linearGradient>
		<clipPath id="spectrum-plot">
			<rect x={PLOT.x} y={PLOT.y - 6} width={PLOT.w} height={PLOT.h + 6} />
		</clipPath>
		<clipPath id="spectrum-blade">
			<path d="M200 362 C 280 222, 520 150, 692 198 C 575 332, 365 428, 200 362 Z" />
		</clipPath>
	</defs>

	<!-- ================= (a) visible spectrum ================= -->
	<rect
		x={BAR.x}
		y={BAR.y}
		width={BAR.w}
		height={BAR.h}
		rx="6"
		fill="url(#spectrum-bar)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{#each ticks as nm (nm)}
		<line
			x1={barX(nm)}
			y1={BAR.y + BAR.h}
			x2={barX(nm)}
			y2={BAR.y + BAR.h + 5}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		<text x={barX(nm)} y={BAR.y + BAR.h + 18} class="muted" font-size="11" text-anchor="middle">
			{nm}
		</text>
	{/each}
	<!-- marker -->
	<line
		x1={markerX}
		y1={BAR.y - 2}
		x2={markerX}
		y2={BAR.y + BAR.h + 2}
		stroke="var(--stage-bg)"
		stroke-width="4"
	/>
	<line
		x1={markerX}
		y1={BAR.y - 2}
		x2={markerX}
		y2={BAR.y + BAR.h + 2}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<path
		d="M{markerX - 6} {BAR.y - 10} L{markerX + 6} {BAR.y - 10} L{markerX} {BAR.y - 2} Z"
		fill={color}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-linejoin="round"
	/>
	<Label
		x={readoutX}
		y={BAR.y - 18}
		text="{wavelength} nm · {band} · {energy.toFixed(2)} eV"
		size={14}
		weight={600}
	/>

	<!-- ================= (b) absorption chart ================= -->
	<g class="chart">
		<!-- grid -->
		{#each [0.25, 0.5, 0.75, 1] as a (a)}
			<line
				x1={PLOT.x}
				y1={cy(a)}
				x2={PLOT.x + PLOT.w}
				y2={cy(a)}
				stroke="var(--stage-grid)"
				stroke-width="1"
			/>
		{/each}
		{#each ticks as nm (nm)}
			<line
				x1={cx(nm)}
				y1={PLOT.y}
				x2={cx(nm)}
				y2={PLOT.y + PLOT.h}
				stroke="var(--stage-grid)"
				stroke-width="1"
			/>
		{/each}
		<!-- area under the combined curve, tinted by the spectrum -->
		<g clip-path="url(#spectrum-plot)">
			<path d={areaTotal} fill="url(#spectrum-bar)" opacity="0.18" />
			<path
				d={pathTotal}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
				opacity="0.7"
			/>
			<path
				d={pathCar}
				fill="none"
				stroke={colors.carotenoid}
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<path
				d={pathB}
				fill="none"
				stroke={colors.chlorophyllB}
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<path
				d={pathA}
				fill="none"
				stroke={colors.chlorophyllA}
				stroke-width="2.2"
				stroke-linejoin="round"
			/>
		</g>
		<!-- axes -->
		<line
			x1={PLOT.x}
			y1={PLOT.y + PLOT.h}
			x2={PLOT.x + PLOT.w}
			y2={PLOT.y + PLOT.h}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		<line
			x1={PLOT.x}
			y1={PLOT.y}
			x2={PLOT.x}
			y2={PLOT.y + PLOT.h}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		{#each ticks as nm (nm)}
			<text x={cx(nm)} y={PLOT.y + PLOT.h + 18} class="muted" font-size="11" text-anchor="middle">
				{nm}
			</text>
		{/each}
		{#each [0, 0.5, 1] as a (a)}
			<text x={PLOT.x - 6} y={cy(a) + 4} class="muted" font-size="11" text-anchor="end">
				{a === 0 ? '0' : a === 1 ? '1' : '0.5'}
			</text>
		{/each}
		<text
			x={PLOT.x + PLOT.w}
			y={PLOT.y + PLOT.h + 36}
			class="muted"
			font-size="11"
			text-anchor="end"
		>
			wavelength (nm)
		</text>
		<text
			x={PLOT.x - 28}
			y={PLOT.y + PLOT.h / 2}
			class="muted"
			font-size="11"
			text-anchor="middle"
			transform="rotate(-90 {PLOT.x - 28} {PLOT.y + PLOT.h / 2})"
		>
			absorption
		</text>
		<!-- legend (sits in the green gap, where nothing is absorbed) -->
		<g transform="translate(300 196)">
			{#each legend as item, i (item.key)}
				<line
					x1="0"
					y1={i * 18}
					x2="18"
					y2={i * 18}
					stroke={item.color}
					stroke-width="2.2"
					stroke-linecap="round"
				/>
				<text x="25" y={i * 18 + 4} font-size="12">{item.label}</text>
			{/each}
			<rect x="0" y="48" width="18" height="8" rx="2" fill="url(#spectrum-bar)" opacity="0.5" />
			<line
				x1="0"
				y1="48"
				x2="18"
				y2="48"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<text x="25" y="58" font-size="12" class="muted">all pigments combined</text>
		</g>
		<!-- cursor -->
		<line
			x1={cursorX}
			y1={PLOT.y - 4}
			x2={cursorX}
			y2={PLOT.y + PLOT.h}
			stroke="var(--stage-ink)"
			stroke-width="1"
			opacity="0.55"
		/>
		<circle
			cx={cursorX}
			cy={cy(abs.total)}
			r="5"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		{#each legend as item (item.key)}
			<circle
				cx={cursorX}
				cy={cy(abs[item.key])}
				r="3.5"
				fill={item.color}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
		<Label x={cursorPillX} y={PLOT.y - 14} text="{pct(abs.total)} absorbed" size={12} pill />
	</g>

	<!-- ================= (c) leaf and photons ================= -->
	<g transform={leafTransform}>
		<path
			d="M200 362 C 280 222, 520 150, 692 198 C 575 332, 365 428, 200 362 Z"
			fill="var(--leaf)"
			stroke="var(--leaf-dark)"
			stroke-width="4"
			stroke-linejoin="round"
		/>
		<path
			d="M200 362 C 280 222, 520 150, 692 198 C 640 250, 520 290, 420 310 C 330 330, 260 350, 200 362 Z"
			fill="#fff"
			opacity="0.07"
		/>
		<path
			d="M200 362 C 380 318, 545 262, 692 198"
			fill="none"
			stroke="var(--leaf-vein)"
			stroke-width="4.5"
			stroke-linecap="round"
		/>
		<g
			fill="none"
			stroke="var(--leaf-vein)"
			stroke-width="2.4"
			stroke-linecap="round"
			opacity="0.9"
			clip-path="url(#spectrum-blade)"
		>
			<path d="M300 338 c 20 -40, 45 -75, 90 -112" />
			<path d="M380 312 c 25 -40, 60 -70, 110 -96" />
			<path d="M470 284 c 30 -35, 70 -60, 120 -74" />
			<path d="M560 254 c 30 -22, 60 -38, 95 -45" />
			<path d="M300 338 c 40 10, 85 12, 130 2" />
			<path d="M380 312 c 50 15, 100 15, 150 0" />
			<path d="M470 284 c 60 22, 110 20, 150 2" />
		</g>
	</g>

	{#each photons as p (p.i)}
		{@const u = cycle(t, PERIOD, p.offset)}
		{@const absorbed = p.threshold < abs.total}
		{#if u < HIT}
			{@const v = u / HIT}
			<Photon
				x={lerp(p.start.x, p.hit.x, v)}
				y={lerp(p.start.y, p.hit.y, v)}
				angle={p.angleIn}
				{wavelength}
				opacity={smoothstep(0, 0.12, v)}
				phase={t * 3}
			/>
		{:else if absorbed}
			{@const v = (u - HIT) / 0.22}
			{#if v < 1}
				<circle
					cx={lerp(p.hit.x, p.absorbEnd.x, v)}
					cy={lerp(p.hit.y, p.absorbEnd.y, v)}
					r={6 + 16 * v}
					fill={color}
					opacity={0.55 * (1 - v)}
					filter="url(#glow)"
				/>
				<Photon
					x={lerp(p.hit.x, p.absorbEnd.x, v)}
					y={lerp(p.hit.y, p.absorbEnd.y, v)}
					angle={p.angleIn}
					{wavelength}
					opacity={1 - smoothstep(0.2, 0.9, v)}
					phase={t * 3}
				/>
			{/if}
		{:else}
			{@const v = (u - HIT) / (1 - HIT)}
			<circle
				cx={p.hit.x}
				cy={p.hit.y}
				r={4 + 8 * v}
				fill="none"
				stroke={color}
				stroke-width="1.5"
				opacity={0.8 * (1 - smoothstep(0, 0.25, v))}
			/>
			<Photon
				x={lerp(p.hit.x, p.reflectEnd.x, v)}
				y={lerp(p.hit.y, p.reflectEnd.y, v)}
				angle={p.angleOut}
				{wavelength}
				opacity={1 - smoothstep(0.78, 1, v)}
				phase={t * 3}
			/>
		{/if}
	{/each}

	<Label x={reflectLabel.x} y={reflectLabel.y} text="reflected" size={12} muted />
	<Label x={absorbLabel.x} y={absorbLabel.y} text="absorbed" size={12} muted />

	<!-- ================= (d) caption ================= -->
	<line
		x1="80"
		y1="462"
		x2="880"
		y2="462"
		stroke="var(--stage-line)"
		stroke-width="1"
		opacity="0.7"
	/>
	<Label x={480} y={498} text={caption} size={15} />
	<Label x={480} y={524} text={breakdown} size={11} muted />
</g>
