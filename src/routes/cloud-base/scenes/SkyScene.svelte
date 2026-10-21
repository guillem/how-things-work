<script lang="ts">
	/**
	 * The sky over a sunny field, with a height scale from the ground to 2,000 m. On the puzzle and
	 * last steps, fair-weather clouds drift by, all with flat bottoms at the day's cloud base. On the
	 * rise and cloud steps the reader drags one bubble of air up: it swells (the dotted circle is its
	 * size on the ground), its thermometer drops, and where the model says its vapour starts to
	 * condense it turns white; a magnifying glass shows vapour or droplets inside. On the flat and
	 * humid steps bubble after bubble rises from the ground to the thermals' top, turning white at
	 * the cloud base and feeding a row of flat-bottomed clouds; the humidity moves the base, or
	 * leaves the sky clear.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, cycle, hash, smoothstep, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DAY, at, climb, cloudBase } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'puzzle'));
	const single = $derived(phase === 'rise' || phase === 'cloud');
	const many = $derived(phase === 'flat' || phase === 'humid');

	// ---- one scale: heights in metres to px --------------------------------------------------------
	const GROUND = 532;
	const TOP = DAY.thermalTop;
	const S = (GROUND - 130) / TOP;
	const Y = (z: number) => GROUND - z * S;
	const SCALE_X = 96;

	// ---- the day: the humidity step's own dampness, the page's day otherwise ----------------------
	const rh = $derived(phase === 'humid' ? Number(params.humid ?? DAY.rh * 100) / 100 : DAY.rh);
	const baseZ = $derived(cloudBase(DAY.groundC, rh));
	const baseTween = Tween.of(() => Math.min(baseZ, TOP + 150), {
		duration: 700,
		easing: cubicInOut
	});
	const base = $derived(reduced ? Math.min(baseZ, TOP + 150) : baseTween.current);
	const hasCloud = $derived(baseZ < TOP - 30);
	const cloudy = $derived(smoothstep(TOP + 20, TOP - 60, base));
	const roundTo50 = (z: number) => Math.round(z / 50) * 50;
	const fmt = (z: number) => z.toLocaleString('en-GB');

	/** The bubble's state every 10 m, for the page's day (single) or the step's dampness (many). */
	const samples = $derived(climb(DAY.groundC, rh, TOP, 10));

	// ---- the single bubble ---------------------------------------------------------------------------
	const R0 = 44;
	const BX = 400;
	const height = $derived(Math.max(0, Math.min(TOP, Number(params.height ?? 0))));
	const bubble = $derived(at(samples, height));
	const R = $derived(R0 * Math.cbrt(bubble.swell));
	/** Centre of the bubble: its bottom is at its height. */
	const BY = $derived(Y(height) - R - 2);
	const white = $derived(smoothstep(0, 0.12, bubble.droplets));
	const temp = $derived(Math.round(bubble.t));
	const grown = $derived(Math.round((bubble.swell - 1) * 100));
	const passed = $derived(phase === 'cloud' ? smoothstep(baseZ - 30, baseZ + 30, height) : 0);

	function setHeight(z: number) {
		setParam('height', Math.round(Math.max(0, Math.min(TOP, z)) / 50) * 50);
	}
	function drag(e: PointerEvent) {
		const start = height;
		let y0: number | null = null;
		startDrag(e, (p) => {
			if (y0 === null) y0 = p.y;
			setHeight(start + (y0 - p.y) / S);
		});
	}
	function key(e: KeyboardEvent) {
		const big = e.shiftKey ? 500 : 50;
		const d: Record<string, number> = {
			ArrowUp: big,
			ArrowRight: big,
			ArrowDown: -big,
			ArrowLeft: -big,
			PageUp: 500,
			PageDown: -500
		};
		if (e.key === 'Home') setHeight(0);
		else if (e.key === 'End') setHeight(TOP);
		else if (d[e.key] !== undefined) setHeight(height + d[e.key]);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// ---- the thermometer beside the bubble ---------------------------------------------------------
	const TH_X = $derived(BX + R0 + 46);
	const TH_TOP = $derived(BY - 52);
	const TH_LEN = 92;
	/** Mercury height for −5 °C to 30 °C. */
	const mercury = $derived(TH_LEN * Math.max(0.04, Math.min(1, (bubble.t + 5) / 35)));

	// ---- inside the bubble: the magnifying glass ---------------------------------------------------
	const LENS = { x: 790, y: 372, r: 88 };
	const vapourDots = Array.from({ length: 34 }, (_, i) => ({
		i,
		x: (hash(i, 1) - 0.5) * 1.6,
		y: (hash(i, 2) - 0.5) * 1.6,
		p: 3 + hash(i, 3) * 4,
		o: hash(i, 4)
	}));
	const drops = Array.from({ length: 16 }, (_, i) => ({
		i,
		x: (hash(i, 7) - 0.5) * 1.45,
		y: (hash(i, 8) - 0.5) * 1.45,
		r: 6 + hash(i, 9) * 4
	}));
	const inLens = (x: number, y: number) => x * x + y * y < 0.62;

	// ---- many bubbles feeding a row of clouds --------------------------------------------------------
	const COLS = [265, 395, 525, 655, 785, 880];
	const PERIOD = 11;
	const streams = $derived.by(() => {
		if (!many) return [];
		const out = [];
		for (let c = 0; c < COLS.length; c++) {
			for (let k = 0; k < 2; k++) {
				const u = cycle(t, PERIOD, hash(c, 11) + k / 2);
				const z = TOP * (1 - Math.pow(1 - u, 1.5));
				const b = at(samples, z);
				const r = 17 * Math.cbrt(b.swell);
				out.push({
					key: `${c}-${k}`,
					x: COLS[c] + (hash(c, 13) - 0.5) * 16,
					y: Y(z) - r,
					r,
					white: smoothstep(0, 0.12, b.droplets),
					o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.72, 0.9, u))
				});
			}
		}
		return out;
	});

	type Cloud = ReturnType<typeof heap>;

	/** A heap cloud from its flat base (px) up to `top` (px), `w` wide, centred on `x`. */
	function heap(x: number, w: number, top: number, bottom: number, seed: number) {
		const h = Math.max(4, bottom - top);
		// Rows of puffs from the flat bottom to a rounded top, a little narrower on the way up; a
		// body joining the puffs' centres fills the gaps, and the clip cuts the bottom flat.
		const r = Math.max(6, Math.min(w * 0.21, h * 0.55));
		const rows = Math.max(1, Math.round((h - r) / (r * 1.5)) + 1);
		const puffs = [];
		const left = [];
		const right = [];
		for (let k = 0; k < rows; k++) {
			const f = rows === 1 ? 0 : k / (rows - 1);
			const cy = rows === 1 ? bottom - r * 0.5 : bottom - r * 0.5 - f * (h - 1.5 * r);
			const wk = w * (1 - 0.4 * f * f) - 2 * r * 0.8;
			const m = Math.max(1, Math.round(wk / (r * 1.25)) + 1);
			for (let j = 0; j < m; j++) {
				const g = m === 1 ? 0.5 : j / (m - 1);
				const jit = (hash(seed * 31 + k, j) - 0.5) * r * 0.3;
				puffs.push({
					i: puffs.length,
					cx: x - wk / 2 + g * wk + jit,
					cy: cy + (hash(seed * 17 + k, j) - 0.5) * r * 0.3,
					r: r * (0.85 + 0.3 * hash(seed * 7 + k, j))
				});
			}
			left.push(`${(x - wk / 2).toFixed(1)} ${cy.toFixed(1)}`);
			right.push(`${(x + wk / 2).toFixed(1)} ${cy.toFixed(1)}`);
		}
		const body = `M${(x - (w * 0.5 - r * 0.8)).toFixed(1)} ${bottom} L${left.join(' L')} L${right
			.reverse()
			.join(' L')} L${(x + (w * 0.5 - r * 0.8)).toFixed(1)} ${bottom} Z`;
		return { x, w, h, bottom, puffs, body };
	}

	const rowClouds = $derived.by(() => {
		if (!many || cloudy < 0.01) return [];
		const bottom = Y(base);
		return COLS.map((x, c) =>
			heap(x, 100 + hash(c, 21) * 20, Y(TOP) - 18 - hash(c, 22) * 22, bottom, c)
		);
	});

	// ---- the drifting clouds of the puzzle and last steps --------------------------------------------
	const drift = $derived.by(() => {
		if (single || many) return [];
		const bottom = Y(cloudBase(DAY.groundC, DAY.rh));
		const span = 960 + 260;
		return [0, 1, 2, 3, 4].map((c) => {
			const x0 = 120 + c * 244 + hash(c, 31) * 60;
			const x = ((((x0 + t * 7) % span) + span) % span) - 130;
			const w = 120 + hash(c, 32) * 90;
			return { c, ...heap(x, w, Y(TOP) - 10 - hash(c, 33) * 40, bottom, c + 7) };
		});
	});
	const driftBase = Y(cloudBase(DAY.groundC, DAY.rh));

	// ---- the ground --------------------------------------------------------------------------------
	const trees = [150, 236, 290, 560, 720, 780, 860, 912].map((x, i) => ({
		i,
		x,
		s: 0.8 + hash(i, 41) * 0.5
	}));

	// ---- readouts ------------------------------------------------------------------------------------
	const headline = $derived.by(() => {
		if (single)
			return white > 0.5
				? 'white: its water has turned to droplets'
				: height === 0
					? 'a bubble of warm air on the ground'
					: 'clear: its water is invisible vapour';
		if (many) {
			if (!hasCloud) return 'too dry: no clouds today';
			return phase === 'humid'
				? `${Math.round(rh * 100)} % damp: clouds start about ${fmt(roundTo50(baseZ))} m up`
				: `every bubble turns white about ${fmt(roundTo50(baseZ))} m up`;
		}
		return phase === 'next'
			? 'rising air cools, and turns into cloud at one height'
			: 'flat bottoms, all at the same height';
	});
	const sub = $derived.by(() => {
		if (single) return height === 0 ? 'on the ground' : `${fmt(height)} m up`;
		if (many)
			return hasCloud
				? 'below: clear rising air · above: cloud'
				: 'the bubbles stop rising before they get cold enough';
		return phase === 'next' ? 'each bubble from the same ground does the same' : 'why there?';
	});
	const third = $derived(
		single
			? height === 0
				? `${DAY.groundC} °C, and lighter than the cooler air around it`
				: `swollen: ${grown} % bigger than on the ground`
			: ''
	);
</script>

{#snippet cumulus(c: Cloud, id: string)}
	<clipPath id="cloud-base-{id}">
		<rect x={c.x - c.w} y="0" width={c.w * 2} height={c.bottom} />
	</clipPath>
	<g clip-path="url(#cloud-base-{id})">
		<path d={c.body} fill="var(--cld-cloud)" />
		{#each c.puffs as p (p.i)}
			<circle cx={p.cx} cy={p.cy} r={p.r} fill="var(--cld-cloud)" />
		{/each}
	</g>
	<line
		x1={c.x - c.w * 0.46}
		y1={c.bottom}
		x2={c.x + c.w * 0.46}
		y2={c.bottom}
		stroke="var(--cld-cloud-edge)"
		stroke-width="2.5"
		stroke-linecap="round"
	/>
{/snippet}

<g class="cld-sky">
	<defs>
		<linearGradient id="cloud-base-sky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--cld-sky-top)" />
			<stop offset="1" stop-color="var(--cld-sky-low)" />
		</linearGradient>
		<clipPath id="cloud-base-frame">
			<rect x={SCALE_X + 14} y="0" width={960 - SCALE_X - 14} height="600" />
		</clipPath>
	</defs>

	<!-- sky and ground -->
	<rect x="0" y="0" width="960" height={GROUND} fill="url(#cloud-base-sky)" />
	<rect x="0" y={GROUND} width="960" height={600 - GROUND} fill="var(--cld-ground)" />
	<line x1="0" y1={GROUND} x2="960" y2={GROUND} stroke="var(--cld-ground-edge)" stroke-width="2" />

	<!-- the Sun warming the ground -->
	<g transform="translate(200 62)">
		{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
			{@const a = (i / 10) * Math.PI * 2}
			<line
				x1={Math.cos(a) * 30}
				y1={Math.sin(a) * 30}
				x2={Math.cos(a) * 40}
				y2={Math.sin(a) * 40}
				stroke="var(--cld-sun)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/each}
		<circle r="23" fill="var(--cld-sun)" />
	</g>

	<!-- trees and a house on the field -->
	{#each trees as tr (tr.i)}
		<g transform="translate({tr.x} {GROUND}) scale({tr.s})">
			<rect x="-3" y="-20" width="6" height="20" fill="var(--cld-trunk)" />
			<circle cx="0" cy="-30" r="15" fill="var(--cld-tree)" />
		</g>
	{/each}
	<g transform="translate(640 {GROUND})">
		<rect x="-26" y="-34" width="52" height="34" fill="var(--cld-house)" />
		<path d="M-32 -32 L0 -56 L32 -32 Z" fill="var(--cld-roof)" />
		<rect x="-6" y="-18" width="12" height="18" fill="var(--cld-roof)" />
	</g>

	<g clip-path="url(#cloud-base-frame)">
		<!-- drifting fair-weather clouds -->
		{#each drift as d (d.c)}
			{@render cumulus(d, `drift-${d.c}`)}
		{/each}
	</g>

	{#if !single && !many}
		<line
			x1={SCALE_X + 14}
			y1={driftBase}
			x2="944"
			y2={driftBase}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="7 6"
			opacity="0.7"
		/>
		<Readout id="cld-floor">
			<Label
				x={SCALE_X + 20}
				y={driftBase + 24}
				text="the flat bottoms: about {fmt(roundTo50(cloudBase(DAY.groundC, DAY.rh)))} m up"
				anchor="start"
				size={15}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- many bubbles and the row of clouds they make -->
	{#if many}
		{#each rowClouds as c, ci (ci)}
			<g opacity={cloudy}>{@render cumulus(c, `row-${ci}`)}</g>
		{/each}
		{#each streams as b (b.key)}
			<g opacity={b.o}>
				<circle
					cx={b.x}
					cy={b.y}
					r={b.r}
					fill="var(--cld-warm)"
					fill-opacity={0.28 * (1 - b.white)}
					stroke="var(--cld-warm)"
					stroke-width="1.5"
					stroke-opacity={1 - b.white}
				/>
				<circle cx={b.x} cy={b.y} r={b.r} fill="var(--cld-cloud)" opacity={b.white} />
			</g>
		{/each}
		<line
			x1={SCALE_X + 14}
			y1={hasCloud ? Y(base) : Y(TOP)}
			x2="944"
			y2={hasCloud ? Y(base) : Y(TOP)}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="7 6"
			opacity="0.7"
		/>
		<Readout id="cld-baseline">
			<Label
				x={SCALE_X + 20}
				y={hasCloud && base < 350 ? Y(base) - 10 : (hasCloud ? Y(base) : Y(TOP)) + 24}
				text={hasCloud ? 'cloud base' : 'bubbles stop here'}
				anchor="start"
				size={15}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- the height scale -->
	<line
		x1={SCALE_X}
		y1={GROUND}
		x2={SCALE_X}
		y2={Y(TOP) - 10}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	{#each [500, 1000, 1500, 2000] as z (z)}
		<line
			x1={SCALE_X - 6}
			y1={Y(z)}
			x2={SCALE_X + 6}
			y2={Y(z)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<Label x={SCALE_X - 10} y={Y(z) + 5} text="{fmt(z)} m" anchor="end" size={14} muted tabular />
	{/each}
	<Label x={SCALE_X - 10} y={GROUND - 6} text="ground" anchor="end" size={14} muted />

	<!-- the single bubble -->
	{#if single}
		{#if passed > 0.01}
			<line
				x1={SCALE_X + 14}
				y1={Y(baseZ)}
				x2={BX + R0 + 30}
				y2={Y(baseZ)}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="7 6"
				opacity={0.7 * passed}
			/>
			<Readout id="cld-turned">
				<Label
					x={SCALE_X + 20}
					y={Y(baseZ) + 24}
					text="turned white here: {fmt(roundTo50(baseZ))} m"
					anchor="start"
					size={15}
					weight={600}
					opacity={passed}
				/>
			</Readout>
		{/if}
		{#if phase === 'cloud'}
			<line
				x1={BX + R * 0.7}
				y1={BY + R * 0.7}
				x2={LENS.x - LENS.r * 0.92}
				y2={LENS.y - LENS.r * 0.38}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
			/>
		{/if}
		<circle
			cx={BX}
			cy={BY}
			r={R}
			fill="var(--cld-warm)"
			fill-opacity={0.3 * (1 - white)}
			stroke="var(--cld-warm)"
			stroke-width="2.5"
			stroke-opacity={1 - white}
		/>
		<g opacity={white}>
			<circle cx={BX} cy={BY} r={R} fill="var(--cld-cloud)" />
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
				{@const a = (i / 8) * Math.PI * 2 + 0.3}
				<circle
					cx={BX + Math.cos(a) * R * 0.78}
					cy={BY + Math.sin(a) * R * 0.78}
					r={R * 0.34}
					fill="var(--cld-cloud)"
				/>
			{/each}
			<circle
				cx={BX}
				cy={BY}
				r={R + 4}
				fill="none"
				stroke="var(--cld-cloud-edge)"
				stroke-width="1.5"
				stroke-dasharray="2 5"
			/>
		</g>
		<!-- its size on the ground -->
		<circle
			cx={BX}
			cy={BY}
			r={R0}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="3 4"
			opacity={height > 0 ? 0.9 : 0}
		/>
		{#if height === 0 && phase === 'rise'}
			<Readout id="cld-hint">
				<Label
					x={BX}
					y={BY - R - 18}
					text="drag the bubble up"
					anchor="middle"
					size={15}
					weight={600}
				/>
			</Readout>
		{/if}

		<!-- thermometer -->
		<g>
			<rect
				x={TH_X - 8}
				y={TH_TOP}
				width="16"
				height={TH_LEN + 8}
				rx="8"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
			<rect
				x={TH_X - 4}
				y={TH_TOP + TH_LEN + 4 - mercury}
				width="8"
				height={mercury + 6}
				fill="var(--cld-hot)"
			/>
			<circle
				cx={TH_X}
				cy={TH_TOP + TH_LEN + 16}
				r="13"
				fill="var(--cld-hot)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
			<Readout id="cld-temp" order={2} label="Temperature" value="{temp} °C">
				<Label
					x={TH_X + 22}
					y={TH_TOP + TH_LEN / 2 + 8}
					text="{temp} °C"
					anchor="start"
					size={24}
					weight={700}
					tabular
				/>
			</Readout>
		</g>

		<!-- the drag target -->
		<circle
			class="cld-drag"
			cx={BX}
			cy={BY}
			r={R + 8}
			fill="transparent"
			stroke="var(--focus)"
			stroke-width="1.5"
			stroke-dasharray="5 5"
			role="slider"
			tabindex="0"
			aria-label="Bubble of air"
			aria-valuenow={height}
			aria-valuemin={0}
			aria-valuemax={TOP}
			aria-valuetext={height === 0 ? 'on the ground' : `${height} metres up`}
			onpointerdown={drag}
			onkeydown={key}
		/>

		<!-- the magnifying glass -->
		{#if phase === 'cloud'}
			<circle
				cx={LENS.x}
				cy={LENS.y}
				r={LENS.r}
				fill="var(--cld-lens)"
				stroke="var(--stage-ink-muted)"
				stroke-width="4"
			/>
			{#each vapourDots as v (v.i)}
				{@const jx = reduced ? 0 : Math.sin(t * v.p + v.o * 9) * 0.03}
				{@const jy = reduced ? 0 : Math.cos(t * v.p * 0.8 + v.o * 7) * 0.03}
				{#if inLens(v.x + jx, v.y + jy)}
					<circle
						cx={LENS.x + (v.x + jx) * LENS.r}
						cy={LENS.y + (v.y + jy) * LENS.r}
						r="2.2"
						fill="var(--cld-vapour)"
						opacity={1 - 0.6 * white}
					/>
				{/if}
			{/each}
			{#each drops as d (d.i)}
				{#if inLens(d.x, d.y)}
					{@const sink = reduced ? 0 : Math.sin(t * 0.9 + d.i) * 0.02}
					<g opacity={white}>
						<circle
							cx={LENS.x + d.x * LENS.r}
							cy={LENS.y + (d.y + sink) * LENS.r}
							r={d.r}
							fill="var(--cld-drop)"
						/>
						<circle
							cx={LENS.x + d.x * LENS.r - d.r * 0.3}
							cy={LENS.y + (d.y + sink) * LENS.r - d.r * 0.3}
							r={d.r * 0.3}
							fill="#fff"
							opacity="0.7"
						/>
					</g>
				{/if}
			{/each}
			<Readout
				id="cld-lens"
				order={4}
				label="Inside"
				value={white > 0.5 ? 'tiny droplets of water' : 'water vapour, too small to see'}
			>
				<Label
					x={LENS.x}
					y={LENS.y + LENS.r + 26}
					text={white > 0.5
						? 'inside: tiny droplets of water'
						: 'inside: water vapour, too small to see'}
					anchor="middle"
					size={15}
					weight={600}
				/>
			</Readout>
		{/if}
	{/if}

	<!-- readouts -->
	<Readout id="cld-head" order={1} label={single ? 'Now' : 'Clouds'} value={headline}>
		<Label x={944} y={single ? 44 : 40} text={headline} anchor="end" size={19} weight={700} />
	</Readout>
	<Readout id="cld-sub" order={3} label={single ? 'Height' : 'Note'} value={sub}>
		<Label x={944} y={single ? 70 : 66} text={sub} anchor="end" size={15} muted />
	</Readout>
	{#if third}
		<Readout id="cld-third" order={5} label={phase === 'cloud' ? undefined : 'Size'} value={third}>
			<Label x={944} y={94} text={third} anchor="end" size={15} muted />
		</Readout>
	{/if}
</g>

<style>
	.cld-drag {
		cursor: ns-resize;
		touch-action: none;
		outline: none;
	}
	.cld-drag:focus-visible {
		stroke-width: 3;
	}
</style>
