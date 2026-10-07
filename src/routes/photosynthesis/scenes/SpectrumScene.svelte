<script lang="ts">
	/**
	 * Step "pigments" — why leaves are green.
	 *
	 * One composition in three parts, all driven by the `wavelength` control:
	 *   (a) the visible spectrum with a marker and a readout (colour, photon energy);
	 *   (b) the absorption spectra of chlorophyll a, chlorophyll b and the
	 *       carotenoids, with a cursor at the current wavelength and a legend
	 *       that doubles as a live readout of the three curves;
	 *   (c) a leaf hit by a stream of photons of that wavelength. Each photon is
	 *       absorbed (it fades out just inside the leaf with a glow), reflected,
	 *       or passes through the leaf, in proportion to the combined absorption.
	 * A caption at the bottom puts the drawn numbers into words: its wording
	 * follows the "N% absorbed" pill, the legend readout and the photon count.
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

	/**
	 * Abundance weights of the three pigments — the same ones `absorbance().total`
	 * in palette.ts uses to mix the curves (chlorophyll a : b : carotenoids ≈ 3 : 1 : 1).
	 */
	const WEIGHTS = { chlA: 0.6, chlB: 0.25, car: 0.25 };
	/**
	 * Fraction of the light of a given wavelength that the leaf absorbs. The
	 * palette's `total` is the weighted mixture kept below 1 for plotting; a leaf
	 * is thick enough to absorb essentially all the light at chlorophyll a's main
	 * peak, so the same mixture is rescaled to saturate there.
	 */
	const combined = (nm: number) => Math.min(1, absorbance(nm).total / WEIGHTS.chlA);
	const absorbed = $derived(combined(wavelength));

	// ---- (a) spectrum bar ------------------------------------------------------
	const BAR = { x: 80, y: 70, w: 800, h: 36 };
	const barX = (nm: number) => BAR.x + ((nm - 400) / 300) * BAR.w;
	const stops = Array.from({ length: 31 }, (_, i) => 400 + i * 10);
	const ticks = [400, 450, 500, 550, 600, 650, 700];
	const markerX = $derived(barX(wavelength));
	// The readout follows the marker but stays inside the bar at either end.
	const readoutX = $derived(clamp(markerX, BAR.x + 150, BAR.x + BAR.w - 150));

	// ---- (b) absorption chart --------------------------------------------------
	// The chart runs down to the axis title at y ≈ 460, so that it spans the same
	// height as the leaf demo on the right (the caption rule is at y = 504).
	const PLOT = { x: 110, y: 164, w: 500, h: 260 };
	const cx = (nm: number) => PLOT.x + ((nm - 400) / 300) * PLOT.w;
	const cy = (a: number) => PLOT.y + PLOT.h - a * PLOT.h;
	type Pigment = 'chlA' | 'chlB' | 'car';
	const samples = Array.from({ length: 61 }, (_, i) => ({
		nm: 400 + i * 5,
		...absorbance(400 + i * 5),
		leaf: combined(400 + i * 5)
	}));
	const curve = (key: Pigment | 'leaf') =>
		pathFrom(
			smooth(
				samples.map((s) => ({ x: cx(s.nm), y: cy(s[key]) })),
				4
			)
		);
	const pathA = curve('chlA');
	const pathB = curve('chlB');
	const pathCar = curve('car');
	const pathLeaf = curve('leaf');
	const areaLeaf = `${pathLeaf} L${cx(700)} ${cy(0)} L${cx(400)} ${cy(0)} Z`;
	const legend: { key: Pigment; label: string; color: string }[] = [
		{ key: 'chlA', label: 'chlorophyll a', color: colors.chlorophyllA },
		{ key: 'chlB', label: 'chlorophyll b', color: colors.chlorophyllB },
		{ key: 'car', label: 'carotenoids', color: colors.carotenoid }
	];
	// The legend sits in the green gap of the chart (≈ 497–641 nm), where no
	// curve rises above 0.5 (its bottom edge is at 0.65); it has an opaque
	// backing so the cursor line passes cleanly behind it.
	const LEGEND = { x: 272, y: PLOT.y + 6, w: 240, h: 84, row: 18, pad: 14 };
	const legendY = (i: number) => LEGEND.pad + i * LEGEND.row;
	const cursorX = $derived(cx(wavelength));
	const cursorPillX = $derived(clamp(cursorX, PLOT.x + 56, PLOT.x + PLOT.w - 56));
	/**
	 * The three pigment dots on the cursor line. Where two curves cross (or one
	 * coincides with the combined curve) the dots would hide each other, so a dot
	 * is pushed a few pixels to the side when its spot is already taken; a dot may
	 * still sit inside the combined ring when the two values coincide exactly.
	 */
	const dots = $derived.by(() => {
		const ringY = cy(absorbed);
		const placed: { y: number; dx: number }[] = [];
		let ringTaken = false;
		return legend
			.map((item) => ({ key: item.key, color: item.color, y: cy(abs[item.key]) }))
			.sort((a, b) => a.y - b.y)
			.map((d) => {
				let dx = 0;
				for (const cand of [0, -8, 8, -16, 16]) {
					const nearRing = cand === 0 && Math.abs(d.y - ringY) < 8;
					const inRing = nearRing && Math.abs(d.y - ringY) < 2.5 && !ringTaken;
					const clash =
						(nearRing && !inRing) || placed.some((p) => p.dx === cand && Math.abs(p.y - d.y) < 8);
					if (!clash) {
						dx = cand;
						if (inRing) ringTaken = true;
						break;
					}
				}
				placed.push({ y: d.y, dx });
				return { ...d, dx };
			});
	});

	// ---- (c) leaf and photons --------------------------------------------------
	// The blade of LeafScene, scaled down and laid almost flat (tip to the right).
	const LEAF = { cx: 800, cy: 365, s: 0.53, rot: 16 };
	const ORIGIN = { x: 446, y: 284 }; // centre of the blade in LeafScene coordinates
	const cosR = Math.cos((LEAF.rot * Math.PI) / 180);
	const sinR = Math.sin((LEAF.rot * Math.PI) / 180);
	const toStage = (p: Point): Point => ({
		x: LEAF.cx + LEAF.s * (cosR * (p.x - ORIGIN.x) - sinR * (p.y - ORIGIN.y)),
		y: LEAF.cy + LEAF.s * (sinR * (p.x - ORIGIN.x) + cosR * (p.y - ORIGIN.y))
	});
	const leafTransform = `translate(${LEAF.cx} ${LEAF.cy}) rotate(${LEAF.rot}) scale(${LEAF.s}) translate(${-ORIGIN.x} ${-ORIGIN.y})`;
	const BLADE = 'M200 362 C 280 222, 520 150, 692 198 C 575 332, 365 428, 200 362 Z';

	// The two cubic Béziers of the blade outline (LeafScene coordinates).
	const bezier = (a: Point, b: Point, c: Point, d: Point) => (u: number) => {
		const v = 1 - u;
		return {
			x: v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * d.x,
			y: v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * d.y
		};
	};
	const upper = bezier(
		{ x: 200, y: 362 },
		{ x: 280, y: 222 },
		{ x: 520, y: 150 },
		{ x: 692, y: 198 }
	);
	const lower = bezier(
		{ x: 692, y: 198 },
		{ x: 575, y: 332 },
		{ x: 365, y: 428 },
		{ x: 200, y: 362 }
	);
	const edge = Array.from({ length: 121 }, (_, i) => toStage(upper(i / 120)));
	const outline = [
		...Array.from({ length: 60 }, (_, i) => toStage(upper(i / 60))),
		...Array.from({ length: 60 }, (_, i) => toStage(lower(i / 60)))
	];
	const insideBlade = (p: Point) => {
		let inside = false;
		for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
			const a = outline[i];
			const b = outline[j];
			if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
				inside = !inside;
		}
		return inside;
	};
	const unit = (v: Point): Point => {
		const l = Math.hypot(v.x, v.y) || 1;
		return { x: v.x / l, y: v.y / l };
	};

	const N = 10;
	const PERIOD = 2.8;
	const HIT = 0.55; // fraction of the cycle spent travelling to the leaf
	const D_IN = unit({ x: -0.45, y: 1 }); // photons come from the upper right
	const L_IN = 120;
	const L_OUT = 130;
	const L_ABS = 26;
	const L_EMERGE = 64; // how far a transmitted photon travels after leaving the leaf
	// Share of a transmitted photon's remaining cycle spent (unseen) inside the
	// blade; after that it emerges at the same speed as the incoming beam.
	const INSIDE = 0.35;
	// The upper surface is nearly flat, so every photon reflects about the same
	// (slightly tilted) normal: a clean fan going up and to the left.
	const NORMAL = unit({ x: -0.17, y: -1 });
	const R_OUT = (() => {
		const dot = D_IN.x * NORMAL.x + D_IN.y * NORMAL.y;
		return unit({ x: D_IN.x - 2 * dot * NORMAL.x, y: D_IN.y - 2 * dot * NORMAL.y });
	})();
	const deg = (v: Point) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
	/** Where a ray entering at `hit` along D_IN leaves the blade again. */
	const exitOf = (hit: Point): Point => {
		for (let s = 8; s < 320; s += 2) {
			const q = { x: hit.x + D_IN.x * s, y: hit.y + D_IN.y * s };
			if (!insideBlade(q)) return q;
		}
		return hit;
	};
	const photons = Array.from({ length: N }, (_, i) => {
		// Hit points spread along the upper surface, in a shuffled order.
		const targetX = LEAF.cx - 65 + (105 * ((i * 7) % N)) / (N - 1);
		let k = 0;
		for (let j = 1; j < edge.length; j++)
			if (Math.abs(edge[j].x - targetX) < Math.abs(edge[k].x - targetX)) k = j;
		const hit = edge[k];
		const exit = exitOf(hit);
		const insideLen = Math.hypot(exit.x - hit.x, exit.y - hit.y);
		// Transmitted photons stay fully visible for most of the emerging run and
		// fade over its last quarter, just above the "passed through" label.
		const fadeLen = insideLen + 0.75 * L_EMERGE;
		return {
			i,
			offset: ((i * 3) % N) / N,
			start: { x: hit.x - D_IN.x * L_IN, y: hit.y - D_IN.y * L_IN },
			hit,
			reflectEnd: { x: hit.x + R_OUT.x * L_OUT, y: hit.y + R_OUT.y * L_OUT },
			absorbEnd: { x: hit.x + D_IN.x * L_ABS, y: hit.y + D_IN.y * L_ABS },
			exit,
			insideLen,
			fadeLen,
			throughEnd: { x: exit.x + D_IN.x * L_EMERGE, y: exit.y + D_IN.y * L_EMERGE },
			throughLen: insideLen + L_EMERGE,
			angleIn: deg(D_IN),
			angleOut: deg(R_OUT)
		};
	});
	// A fixed pseudo-random order in which photons get absorbed as the
	// absorption rises, so that the absorbed ones are spread over the surface
	// and over time rather than clustered. (The salt is chosen so that the frozen
	// reduced-motion frame at t = 2.5 s shows all three fates at 550 nm.)
	const rank: number[] = [];
	Array.from({ length: N }, (_, i) => i)
		.sort((a, b) => hash(a, 38) - hash(b, 38))
		.forEach((i, r) => (rank[i] = r));
	// One photon in ten is the finest split the demo can show, so the extremes
	// are kept for the model's extremes: all ten absorbed only when essentially
	// everything is (the chart pill would otherwise read 96% beside "10 of 10"),
	// none only when essentially nothing is.
	const absorbedCount = $derived(
		absorbed >= 0.995
			? N
			: absorbed <= 0.005
				? 0
				: Math.min(N - 1, Math.max(1, Math.round(absorbed * N)))
	);
	type Fate = 'absorb' | 'reflect' | 'through';
	const fates: Fate[] = $derived.by(() => {
		const out: Fate[] = photons.map(() => 'absorb');
		// The escaping photons alternate between passing through and bouncing off
		// in the order they arrive, so that both streams are evenly spaced in time
		// rather than clustered. (Passing through goes first so that the frozen
		// reduced-motion frame at t = 2.5 s shows all three fates at 550 nm.)
		photons
			.filter((p) => rank[p.i] >= absorbedCount)
			.sort((a, b) => a.offset - b.offset)
			.forEach((p, j) => (out[p.i] = j % 2 === 0 ? 'through' : 'reflect'));
		return out;
	});
	const reflectedCount = $derived(fates.filter((f) => f === 'reflect').length);
	const throughCount = $derived(N - absorbedCount - reflectedCount);

	const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
	// "reflected" just beyond the tips of the reflected fan.
	const reflectLabel = {
		x: mean(photons.map((p) => p.reflectEnd.x)) - 4,
		y: Math.min(...photons.map((p) => p.reflectEnd.y)) - 10
	};
	// The count sits in the lower half of the blade, below the hits and their glows.
	const absorbLabel = { x: LEAF.cx, y: Math.max(...photons.map((p) => p.hit.y)) + 50 };
	// "passed through" just beyond the end of the emerging stream, mirroring
	// "reflected": the photons fade out right above its text.
	const throughLabel = {
		x: mean(photons.map((p) => p.throughEnd.x)) - 4,
		y: Math.max(...photons.map((p) => p.throughEnd.y)) + 16
	};

	// ---- (d) caption -----------------------------------------------------------
	// Which pigment(s) the chart shows absorbing most at this wavelength, read
	// off the plotted (unweighted) curves so that the words agree with the legend
	// readout; curves within 0.1 of the highest are named together.
	const dominant = $derived.by(() => {
		const top = Math.max(abs.chlA, abs.chlB, abs.car);
		const names = legend
			.filter((item) => abs[item.key] >= top - 0.1)
			.map((item) => (item.key === 'car' ? 'the carotenoids' : item.label));
		return names.length === 3 ? 'all three pigments' : names.join(' and ');
	});
	// The bands follow the drawn fraction (the "N% absorbed" pill and the photon
	// count), not the real leaf: at 680 nm the model gives about a half.
	const caption = $derived.by(() => {
		const Colour = band[0].toUpperCase() + band.slice(1);
		if (absorbed <= 0.2) {
			if (band === 'green')
				return 'Green light is absorbed only weakly — more of it is reflected or passed through, so leaves look green.';
			if (wavelength > 662)
				return `At ${wavelength} nm we are past chlorophyll's red peak — most of this light is reflected or passed through.`;
			return `${Colour} light falls between the pigments' peaks — most of it is reflected or passed through.`;
		}
		if (absorbed <= 0.4) return `${Colour} light is partly absorbed, mainly by ${dominant}.`;
		if (absorbed <= 0.6)
			return `At ${wavelength} nm about half of the light is absorbed, mainly by ${dominant}.`;
		if (absorbed <= 0.8) return `${Colour} light is mostly absorbed, mainly by ${dominant}.`;
		return `${Colour} light is strongly absorbed, mainly by ${dominant}.`;
	});
	const CAPTION_Y = 504;
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
			<path d={BLADE} />
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
		<Label x={barX(nm)} y={BAR.y + BAR.h + 17} text={String(nm)} size={11} muted />
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
		text="{wavelength} nm · {band} · {energy.toFixed(2)} eV per photon"
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
			<path d={areaLeaf} fill="url(#spectrum-bar)" opacity="0.16" />
			<path
				d={pathLeaf}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="3 3"
				opacity="0.9"
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
			<Label x={cx(nm)} y={PLOT.y + PLOT.h + 18} text={String(nm)} size={11} muted />
		{/each}
		{#each [0, 0.5, 1] as a (a)}
			<Label
				x={PLOT.x - 6}
				y={cy(a) + 4}
				text={a === 0 ? '0' : a === 1 ? '1' : '0.5'}
				size={11}
				anchor="end"
				muted
			/>
		{/each}
		<Label
			x={PLOT.x + PLOT.w}
			y={PLOT.y + PLOT.h + 36}
			text="wavelength (nm)"
			size={11}
			anchor="end"
			muted
		/>
		<Label x={PLOT.x - 28} y={PLOT.y + PLOT.h / 2} text="absorption" size={11} rotate={-90} muted />
		<!-- cursor (drawn before the legend so that it passes behind it) -->
		<line
			x1={cursorX}
			y1={PLOT.y - 4}
			x2={cursorX}
			y2={PLOT.y + PLOT.h}
			stroke="var(--stage-ink)"
			stroke-width="1"
			opacity="0.55"
		/>
		<!-- legend, doubling as a readout of the three curves at the cursor -->
		<g transform="translate({LEGEND.x} {LEGEND.y})">
			<rect
				width={LEGEND.w}
				height={LEGEND.h}
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{#each legend as item, i (item.key)}
				{@const y = legendY(i)}
				<line
					x1="10"
					y1={y}
					x2="28"
					y2={y}
					stroke={item.color}
					stroke-width="2.2"
					stroke-linecap="round"
				/>
				<Label x={35} y={y + 4} text={item.label} size={12} anchor="start" />
				<Label x={LEGEND.w - 12} y={y + 4} text={pct(abs[item.key])} size={12} anchor="end" />
			{/each}
			<rect
				x="10"
				y={legendY(3)}
				width="18"
				height="7"
				rx="2"
				fill="url(#spectrum-bar)"
				opacity="0.5"
			/>
			<line
				x1="10"
				y1={legendY(3)}
				x2="28"
				y2={legendY(3)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="3 3"
			/>
			<!-- the dashed curve is the leaf's absorbed fraction, not an average of the three -->
			<Label
				x={35}
				y={legendY(3) + 4}
				text="whole leaf (all three combined)"
				size={12}
				anchor="start"
				muted
			/>
		</g>
		<!-- cursor markers: a ring on the combined curve, a dot on each pigment curve -->
		<circle
			cx={cursorX}
			cy={cy(absorbed)}
			r="5"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		{#each dots as d (d.key)}
			<circle
				cx={cursorX + d.dx}
				cy={d.y}
				r="3.5"
				fill={d.color}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
		<!-- 4 px clear of the cursor ring when the combined curve is at 1 -->
		<Label x={cursorPillX} y={PLOT.y - 18} text="{pct(absorbed)} absorbed" size={12} pill />
	</g>

	<!-- ================= (c) leaf and photons ================= -->
	<!-- photons passing through the leaf travel behind it -->
	{#each photons as p (p.i)}
		{@const u = cycle(t, PERIOD, p.offset)}
		{#if fates[p.i] === 'through' && u >= HIT}
			{@const w = (u - HIT) / (1 - HIT)}
			{@const s =
				w < INSIDE
					? (w / INSIDE) * p.insideLen
					: p.insideLen + ((w - INSIDE) / (1 - INSIDE)) * L_EMERGE}
			<Photon
				x={p.hit.x + D_IN.x * s}
				y={p.hit.y + D_IN.y * s}
				angle={p.angleIn}
				{wavelength}
				opacity={1 - smoothstep(p.fadeLen, p.throughLen, s)}
				phase={t * 3}
			/>
		{/if}
	{/each}

	<g transform={leafTransform}>
		<path
			d={BLADE}
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
		{@const fate = fates[p.i]}
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
		{:else if fate === 'absorb'}
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
		{:else if fate === 'reflect'}
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

	<Label
		x={reflectLabel.x}
		y={reflectLabel.y}
		text="reflected"
		size={12}
		muted
		opacity={reflectedCount ? 1 : 0.45}
	/>
	<Label
		x={absorbLabel.x}
		y={absorbLabel.y}
		text="{absorbedCount} of {N} absorbed"
		size={12}
		pill
	/>
	<Label
		x={throughLabel.x}
		y={throughLabel.y}
		text="passed through"
		size={12}
		muted
		opacity={throughCount ? 1 : 0.45}
	/>

	<!-- ================= (d) caption ================= -->
	<line
		x1="80"
		y1={CAPTION_Y}
		x2="880"
		y2={CAPTION_Y}
		stroke="var(--stage-line)"
		stroke-width="1"
		opacity="0.7"
	/>
	<Label x={480} y={CAPTION_Y + 34} text={caption} size={14} />
</g>
