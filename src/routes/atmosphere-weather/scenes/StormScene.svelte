<script lang="ts">
	/**
	 * A hurricane as a heat engine run on warm sea (step `hurricane`).
	 *
	 * Left, top: the storm seen from above, over a sea coloured by its surface
	 * temperature. Its cloud bands spiral round an eye and turn anticlockwise
	 * (northern hemisphere); size, tightness, eye clarity and rotation speed
	 * follow the wind speed v = stormIntensity(sst, lat, hours). Below hurricane
	 * strength it is a loose cluster of thunderstorms; when the storm can't form
	 * (cool sea, or too near the equator) the clouds drift apart and fade.
	 * Left, bottom: a cross-section through the storm — evaporation, inflow,
	 * rising eyewall towers releasing heat, outflow at the top, sinking air in
	 * the eye. Right: readouts, the sea-temperature ceiling and wind vs time.
	 *
	 * The storm's clock (simulated hours) restarts on "Start a new storm" and
	 * whenever a slider moves: the `t` of that moment is remembered in a
	 * frame-to-frame memo inside a $derived — the guide's sanctioned exception
	 * for state a pure function of `t` cannot hold (see TrackScene). The
	 * rotation angle is the exact integral of the wind speed over that clock,
	 * so it never snaps. Reduced motion shows the 72-hour state, still.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { clamp, smoothstep, cycle, hash, scale, linePath, Axes } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		GENESIS_LAT,
		GENESIS_SST,
		canForm,
		category,
		maxIntensity,
		stormIntensity
	} from '../atmosphere';

	let { t, params, reduced, dark }: StageProps = $props();

	// ---- controls ---------------------------------------------------------------------
	const sst = $derived(Number(params.sst ?? 29));
	const lat = $derived(Number(params.latitude ?? 15));
	const presses = $derived(Number(params.restartStorm ?? 0));
	const forms = $derived(canForm(sst, lat));
	const tooCool = $derived(sst < GENESIS_SST);
	const tooNear = $derived(Math.abs(lat) < GENESIS_LAT);

	// ---- the storm's clock --------------------------------------------------------------
	const HPS = 4; // simulated hours per second: one day ≈ 6 s
	const HMAX = 120; // the storm is followed for 5 days, then held
	const REDUCED_HOURS = 72;
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (reduced) return REDUCED_HOURS / HPS;
		const key = `${sst}|${lat}|${presses}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return Math.max(0, t - memo.start);
	});
	const hours = $derived(Math.min(HMAX, since * HPS));
	const v = $derived(stormIntensity(sst, lat, hours));
	const vmax = $derived(maxIntensity(sst));

	/** ∫₀ʰ v dh (m/s · h), exact for the model's logistic growth or decay. */
	function windIntegral(h: number) {
		const v0 = 15;
		if (!forms) return v0 * 24 * (1 - Math.exp(-h / 24));
		const r = 1 / 12;
		const A = (vmax - v0) / v0;
		return vmax * (h + Math.log((1 + A * Math.exp(-r * h)) / (1 + A)) / r);
	}
	/** Rotation (radians) per (m/s · second): ~0.6 rad/s at 75 m/s. */
	const SPIN = 0.008;
	const angle = $derived.by(() => {
		const tEnd = HMAX / HPS;
		const s = Math.min(since, tEnd);
		const base = (SPIN / HPS) * windIntegral(s * HPS);
		return base + (since > tEnd ? SPIN * stormIntensity(sst, lat, HMAX) * (since - tEnd) : 0);
	});

	// ---- what the storm looks like -----------------------------------------------------
	const strength = $derived(clamp((v - 15) / (80 - 15))); // 0 disturbance → 1 extreme
	const organised = $derived(smoothstep(20, 40, v)); // cluster → spiral
	// Under reduced motion a failed storm keeps faint remnants, so the still frame shows the fizzle.
	const alive = $derived(forms ? 1 : Math.max(reduced ? 0.45 : 0, smoothstep(1, 12, v)));
	const apart = $derived(forms ? 0 : clamp(1 - v / 15)); // fizzle: bands drift apart
	const eyeClear = $derived(smoothstep(33, 55, v) * alive);

	const CX = 296;
	const CY = 196;
	const R = $derived((95 + 70 * strength) * (1 + 0.6 * apart));
	const eyeR = $derived(16 - 6 * strength);
	const wrap = $derived(1.5 + 2.4 * strength); // radians an arm winds round
	const ARMS = 5;

	/**
	 * One spiral band as a filled outline. Following the arm outwards turns
	 * clockwise (math angle decreases), so the bands trail an anticlockwise
	 * rotation, as in a northern-hemisphere satellite image.
	 */
	function armPath(i: number) {
		const n = 22;
		const phi0 = (i * 2 * Math.PI) / ARMS + 0.4 * hash(i, 3);
		const rIn = eyeR + 10 + 8 * (1 - organised);
		const rOut = R * (0.82 + 0.25 * hash(i, 7));
		const wMax = (16 + 14 * strength) * (1 + 0.6 * (1 - organised));
		const left: string[] = [];
		const right: string[] = [];
		for (let k = 0; k <= n; k++) {
			const u = k / n;
			const r = rIn + (rOut - rIn) * Math.pow(u, 0.9);
			const phi = phi0 - wrap * u;
			const w = wMax * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) * (1 - 0.55 * u);
			const x = r * Math.cos(phi);
			const y = -r * Math.sin(phi);
			// screen-space radial unit vector (the band is thickened radially)
			const nx = Math.cos(phi);
			const ny = -Math.sin(phi);
			left.push(`${(x + nx * w * 0.5).toFixed(1)} ${(y + ny * w * 0.5).toFixed(1)}`);
			right.push(`${(x - nx * w * 0.5).toFixed(1)} ${(y - ny * w * 0.5).toFixed(1)}`);
		}
		return `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
	}
	const arms = $derived(Array.from({ length: ARMS }, (_, i) => ({ i, d: armPath(i) })));

	/** Scattered thunderstorms: the disorganised cluster (and what is left of a fizzling storm). */
	const blobs = $derived(
		Array.from({ length: 11 }, (_, i) => {
			const a = i * 2.39996 + hash(i, 1);
			const r = (25 + 105 * hash(i, 2)) * (1 + 0.9 * apart);
			return { i, x: r * Math.cos(a), y: -r * Math.sin(a), s: 9 + 11 * hash(i, 5) };
		})
	);
	const rotDeg = $derived((-angle * 180) / Math.PI); // negative: anticlockwise on screen

	// ---- colours ------------------------------------------------------------------------
	// The sea: the ocean colour, tinted cooler below the 26.5 °C threshold and warmer above it.
	const sea = $derived(
		sst < GENESIS_SST
			? `color-mix(in oklab, var(--atm-ocean), var(--atm-cold) ${Math.round(((GENESIS_SST - sst) / 6.5) * 55)}%)`
			: `color-mix(in oklab, var(--atm-ocean), var(--atm-warm) ${Math.round(18 + ((sst - GENESIS_SST) / 4.5) * 42)}%)`
	);
	// Clouds: brighter than the --atm-cloud token so they read against the sea in both themes.
	const cloud = $derived(
		dark
			? 'color-mix(in oklab, var(--atm-cloud), var(--stage-ink) 45%)'
			: 'color-mix(in oklab, var(--atm-cloud), var(--surface) 55%)'
	);

	// ---- names ---------------------------------------------------------------------------
	function stateName(w: number) {
		const c = category(w);
		if (c > 0) return `Category ${c} hurricane`;
		if (w >= 17) return 'Tropical storm';
		return 'Tropical depression';
	}
	const state = $derived(
		!forms && v < 10 ? 'Dying away' : !forms ? 'Disturbance, fading' : stateName(v)
	);
	const reasons = $derived(
		[
			tooCool ? 'sea too cool (below 26.5 °C)' : '',
			tooNear ? 'too close to the equator: no Coriolis spin' : ''
		].filter(Boolean)
	);
	const fmtTime = (h: number) => {
		const whole = Math.floor(h);
		const d = Math.floor(whole / 24);
		const hh = whole % 24;
		return d === 0 ? `${hh} h` : `${d} day${d > 1 ? 's' : ''} ${hh} h`;
	};

	// ---- cross-section ----------------------------------------------------------------------
	const SX = 16;
	const SW = 560;
	const STOP = 408;
	const SBOT = 584;
	const SURF = 556;
	const towerH = $derived((50 + 60 * strength) * (0.4 + 0.6 * alive));
	const yTop = $derived(SURF - towerH);
	const condY = $derived(clamp(yTop + 50, 498, 512)); // under the anvil, above the inflow
	const engine = $derived(organised * alive); // how strongly the loop runs
	const EYE = 22; // half-width of the eye in the section
	const WALL = 46; // outer edge of the eyewall tower base

	function towerPath(sg: number) {
		const inner = CX + sg * EYE;
		const outer = CX + sg * WALL;
		const anvil = CX + sg * (WALL + 40 + 120 * strength * organised);
		const y = yTop;
		return (
			`M${inner} ${SURF} L${inner} ${y + 12} Q${inner} ${y} ${inner + sg * 14} ${y} ` +
			`L${anvil} ${y + 2} Q${anvil + sg * 10} ${y + 6} ${anvil} ${y + 12} ` +
			`L${outer + sg * 12} ${y + 16} Q${outer} ${y + 20} ${outer} ${y + 30} L${outer} ${SURF} Z`
		);
	}
	/** The loop each side: in along the sea, up the eyewall, out along the top. */
	function loopPts(sg: number) {
		const xi = (x: number) => CX + sg * x;
		return [
			{ x: xi(262), y: SURF - 14 },
			{ x: xi(WALL + 10), y: SURF - 14 },
			{ x: xi(EYE + 12), y: SURF - 26 },
			{ x: xi(EYE + 12), y: yTop + 18 },
			{ x: xi(WALL + 30), y: yTop + 8 },
			{ x: xi(262), y: yTop + 6 }
		];
	}
	function along(pts: { x: number; y: number }[], u: number) {
		const lens: number[] = [];
		let total = 0;
		for (let k = 1; k < pts.length; k++) {
			const l = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
			lens.push(l);
			total += l;
		}
		let d = u * total;
		for (let k = 0; k < lens.length; k++) {
			if (d <= lens[k]) {
				const f = d / lens[k];
				return {
					x: pts[k].x + (pts[k + 1].x - pts[k].x) * f,
					y: pts[k].y + (pts[k + 1].y - pts[k].y) * f,
					seg: k
				};
			}
			d -= lens[k];
		}
		const last = pts[pts.length - 1];
		return { x: last.x, y: last.y, seg: lens.length - 1 };
	}
	const loops = $derived([-1, 1].map((sg) => ({ sg, pts: loopPts(sg) })));
	// Particle phase advances with the integrated wind, so it speeds up as the storm grows.
	const flowPhase = $derived(angle * 0.55);
	const parcels = $derived(
		loops.flatMap(({ sg, pts }) =>
			Array.from({ length: 5 }, (_, k) => {
				const u = cycle(flowPhase, 1, k / 5 + (sg > 0 ? 0.1 : 0));
				const p = along(pts, u);
				const fade = smoothstep(0, 0.06, u) * (1 - smoothstep(0.9, 1, u));
				return { id: `${sg}-${k}`, x: p.x, y: p.y, rising: p.seg === 3, fade };
			})
		)
	);
	const glints = $derived(
		[-1, 1].flatMap((sg) =>
			Array.from({ length: 3 }, (_, k) => {
				const u = reduced ? 0.25 + k * 0.25 : cycle(flowPhase * 1.3, 1, k / 3 + (sg > 0 ? 0.5 : 0));
				const fade = reduced ? 1 : smoothstep(0, 0.2, u) * (1 - smoothstep(0.7, 1, u));
				return {
					id: `${sg}-${k}`,
					x: CX + sg * (EYE + 6 + 14 * hash(k, sg > 0 ? 11 : 13)),
					y: SURF - 30 - u * Math.max(10, towerH - 50),
					fade
				};
			})
		)
	);
	const vapour = $derived(
		Array.from({ length: 6 }, (_, k) => {
			const x = SX + 70 + k * 30 + (k >= 3 ? 270 : 0);
			const u = cycle(flowPhase * 1.6, 1, hash(k, 21));
			return { k, x, y: SURF - 1 - u * 4, fade: Math.sin(Math.PI * u) };
		})
	);

	// ---- readout card -----------------------------------------------------------------------
	const CL = 592;
	const CR = 944;
	const sstX = scale([20, 31], [612, 924]);
	const SST_Y = 218;
	const cat5At = 30 + Math.log((70 - 28.2) / 55.8) / 0.1813; // where the ceiling reaches 70 m/s

	const sx = scale([0, HMAX], [636, 926]);
	const sy = scale([0, 100], [548, 330]);
	const curve = $derived(
		Array.from({ length: 61 }, (_, k) => {
			const h = (k / 60) * HMAX;
			return { h, v: stormIntensity(sst, lat, h) };
		})
	);
	const traced = $derived([...curve.filter((p) => p.h < hours), { h: hours, v }]);
	const fullPath = $derived(
		linePath(
			curve,
			(p) => p.h,
			(p) => p.v,
			sx,
			sy
		)
	);
	const tracedPath = $derived(
		linePath(
			traced,
			(p) => p.h,
			(p) => p.v,
			sx,
			sy
		)
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="storm-sea-clip">
			<rect x="16" y="16" width="560" height="376" rx="12" />
		</clipPath>
		<radialGradient id="storm-cdo">
			<stop offset="0" style:stop-color={cloud} stop-opacity="1" />
			<stop offset="0.55" style:stop-color={cloud} stop-opacity="0.9" />
			<stop offset="1" style:stop-color={cloud} stop-opacity="0" />
		</radialGradient>
		<radialGradient id="storm-eye">
			<stop offset="0.55" style:stop-color={sea} stop-opacity="1" />
			<stop offset="1" style:stop-color={sea} stop-opacity="0" />
		</radialGradient>
		<linearGradient id="storm-sst-grad">
			<stop offset="0" style:stop-color="var(--atm-cold)" />
			<stop offset="1" style:stop-color="var(--atm-warm)" />
		</linearGradient>
	</defs>

	<!-- ============ the storm seen from above ============ -->
	<rect
		x="16"
		y="16"
		width="560"
		height="376"
		rx="12"
		style:fill={sea}
		stroke="var(--border)"
		stroke-width="1"
	/>
	<g clip-path="url(#storm-sea-clip)">
		<g transform="translate({CX} {CY}) rotate({rotDeg})">
			<!-- loose thunderstorms -->
			{#each blobs as b (b.i)}
				<g opacity={(1 - organised * 0.85) * alive * 0.85}>
					<circle cx={b.x} cy={b.y} r={b.s} style:fill={cloud} />
					<circle cx={b.x + b.s * 0.6} cy={b.y - b.s * 0.3} r={b.s * 0.7} style:fill={cloud} />
				</g>
			{/each}
			<!-- spiral bands -->
			{#each arms as a (a.i)}
				<path
					d={a.d}
					style:fill={cloud}
					stroke="var(--stage-line)"
					stroke-width="0.6"
					stroke-opacity="0.5"
					opacity={(0.2 + 0.7 * organised) * alive}
				/>
			{/each}
			<!-- central dense overcast and the eye -->
			<circle r={eyeR + 22 + 34 * strength} fill="url(#storm-cdo)" opacity={organised * alive} />
			<circle r={eyeR * 1.5} fill="url(#storm-eye)" opacity={eyeClear} />
		</g>
	</g>
	{@render txt(32, 40, 'The storm, seen from above', 14, { weight: 600 })}
	{@render txt(32, 58, `sea surface ${sst.toFixed(1)} °C · latitude ${lat}° N`, 12, {
		muted: true
	})}
	<!-- sense of rotation -->
	<g opacity={forms ? 0.4 + 0.6 * organised : 0.3 * alive}>
		<path
			d="M{CX + 180 * Math.cos(0.3)} {CY - 180 * Math.sin(0.3)} A 180 180 0 0 0 {CX +
				180 * Math.cos(1.05)} {CY - 180 * Math.sin(1.05)}"
			fill="none"
			stroke="var(--atm-wind)"
			stroke-width="1.6"
			marker-end="url(#arrowhead)"
		/>
		{@render txt(560, 40, 'turns anticlockwise', 12, { anchor: 'end' })}
		{@render txt(560, 56, '(northern hemisphere)', 11, { anchor: 'end', muted: true })}
	</g>
	{#if eyeClear > 0.3}
		<g opacity={smoothstep(0.3, 0.7, eyeClear)}>
			<line
				x1={CX + eyeR + 2}
				y1={CY + eyeR + 2}
				x2={CX + 150}
				y2={CY + 150}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
			{@render txt(CX + 154, CY + 160, 'eye', 12)}
		</g>
	{/if}
	<!-- state / reason tags -->
	{#if reasons.length}
		{#each reasons as r, k (r)}
			{@const w = r.length * 6.4 + 96}
			<g transform="translate({CX - w / 2} {360 - (reasons.length - 1 - k) * 28})">
				<rect
					width={w}
					height="22"
					rx="11"
					fill="var(--surface)"
					stroke="var(--atm-low)"
					stroke-width="1.2"
				/>
				{@render txt(w / 2, 15, `No hurricane: ${r}`, 12, { anchor: 'middle', weight: 600 })}
			</g>
		{/each}
	{:else}
		{@const w = state.length * 7.2 + 28}
		<g transform="translate({CX - w / 2} 360)">
			<rect
				width={w}
				height="22"
				rx="11"
				fill="var(--surface)"
				stroke="var(--border)"
				stroke-width="1"
			/>
			{@render txt(w / 2, 15, state, 12, { anchor: 'middle', weight: 600 })}
		</g>
	{/if}

	<!-- ============ cross-section ============ -->
	<rect
		x={SX}
		y={STOP}
		width={SW}
		height={SBOT - STOP}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<path
		d="M{SX} {SURF} L{SX + SW} {SURF} L{SX + SW} {SBOT - 12} Q{SX + SW} {SBOT} {SX + SW - 12} {SBOT}
		L{SX + 12} {SBOT} Q{SX} {SBOT} {SX} {SBOT - 12} Z"
		style:fill={sea}
	/>
	{@render txt(32, 430, 'Cross-section: the heat engine', 13, { weight: 600 })}
	<!-- towers -->
	{#each [-1, 1] as sg (sg)}
		<path
			d={towerPath(sg)}
			style:fill={cloud}
			stroke="var(--stage-line)"
			stroke-width="1"
			opacity={0.3 + 0.7 * alive}
		/>
	{/each}
	<!-- the loop: static arrows -->
	<g opacity={0.25 + 0.6 * engine}>
		{#each loops as l (l.sg)}
			<path
				d="M{l.pts.map((p) => `${p.x} ${p.y}`).join(' L')}"
				fill="none"
				stroke="var(--atm-wind)"
				stroke-width="1.4"
				stroke-dasharray="5 4"
				stroke-linejoin="round"
				marker-end="url(#arrowhead)"
			/>
		{/each}
		<!-- sinking air in the eye -->
		<path
			d="M{CX} {yTop + 18} L{CX} {SURF - 18}"
			fill="none"
			stroke="var(--atm-wind)"
			stroke-width="1.4"
			stroke-dasharray="3 4"
			marker-end="url(#arrowhead)"
			opacity={eyeClear > 0 ? 0.4 + 0.6 * eyeClear : 0}
		/>
	</g>
	<!-- moving parcels, latent-heat glints, evaporation -->
	{#if !reduced}
		{#each parcels as p (p.id)}
			<circle
				cx={p.x}
				cy={p.y}
				r="3"
				fill={p.rising ? 'var(--atm-warm)' : 'var(--atm-wind)'}
				opacity={p.fade * engine}
			/>
		{/each}
		{#each vapour as e (e.k)}
			<path
				d="M{e.x} {e.y} q3 -4 0 -8"
				fill="none"
				stroke="var(--atm-wind)"
				stroke-width="1.2"
				opacity={e.fade * 0.8 * alive}
			/>
		{/each}
	{/if}
	{#each glints as g (g.id)}
		<circle cx={g.x} cy={g.y} r="2.6" fill="var(--atm-warm)" opacity={g.fade * engine} />
	{/each}
	<!-- labels -->
	{@render txt(
		32,
		576,
		tooCool ? 'evaporation from the cool sea: too little' : 'evaporation from the warm sea',
		12
	)}
	<g opacity={0.3 + 0.7 * engine}>
		{@render txt(CX - WALL - 12, condY, 'condensation', 12, {
			anchor: 'end'
		})}
		{@render txt(CX - WALL - 12, condY + 15, 'releases heat', 12, {
			anchor: 'end',
			color: 'var(--atm-warm)',
			weight: 600
		})}
		{@render txt(SX + SW - 16, Math.min(yTop - 4, 498), 'outflow', 12, { anchor: 'end' })}
		{@render txt(SX + SW - 16, SURF - 22, 'moist air spirals in', 12, { anchor: 'end' })}
	</g>
	{#if eyeClear > 0}
		{@render txt(CX, SBOT - 10, 'eye: sinking air', 11, {
			anchor: 'middle',
			opacity: eyeClear
		})}
	{/if}

	<!-- ============ readout card ============ -->
	<rect
		x={CL}
		y="16"
		width={CR - CL}
		height="568"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(CL + 20, 46, state, 18, { weight: 700 })}
	{@render txt(CL + 20, 74, `${Math.floor(v)} m/s`, 16, { weight: 600, tabular: true })}
	{@render txt(CL + 96, 74, `· ${Math.floor(v * 3.6)} km/h sustained wind`, 13, {
		tabular: true
	})}
	{@render txt(CL + 20, 94, `${fmtTime(hours)} after it began`, 12, {
		muted: true,
		tabular: true
	})}
	{@render txt(CL + 20, 124, 'Max possible over this sea:', 12, { muted: true })}
	{#if tooCool}
		{@render txt(CL + 20, 144, 'none — too cool for a hurricane', 14, {
			weight: 600,
			color: 'var(--atm-cold)'
		})}
	{:else}
		{@render txt(CL + 20, 144, `${Math.floor(vmax)} m/s (category ${category(vmax)})`, 14, {
			weight: 600,
			color: 'var(--atm-warm)',
			opacity: tooNear ? 0.6 : 1
		})}
		{#if tooNear}
			{@render txt(CL + 20, 162, '…but it can’t start spinning this near the equator', 12, {
				muted: true
			})}
		{/if}
	{/if}

	<!-- sea temperature scale -->
	{@render txt(CL + 20, 194, 'Sea temperature sets the ceiling', 12, { weight: 600 })}
	<rect
		x={sstX(20)}
		y={SST_Y}
		width={sstX(31) - sstX(20)}
		height="8"
		rx="4"
		fill="url(#storm-sst-grad)"
	/>
	{#each [GENESIS_SST, cat5At] as m (m)}
		<line
			x1={sstX(m)}
			x2={sstX(m)}
			y1={SST_Y - 4}
			y2={SST_Y + 12}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
	{/each}
	{@render txt((sstX(20) + sstX(GENESIS_SST)) / 2, SST_Y + 26, 'no hurricanes', 11, {
		anchor: 'middle',
		muted: true
	})}
	{@render txt((sstX(GENESIS_SST) + sstX(cat5At)) / 2, SST_Y + 26, 'cat 3–4', 11, {
		anchor: 'middle',
		muted: true
	})}
	{@render txt((sstX(cat5At) + sstX(31)) / 2, SST_Y + 26, 'cat 5', 11, {
		anchor: 'middle',
		muted: true
	})}
	{@render txt(sstX(20), SST_Y + 42, '20 °C', 11, { muted: true })}
	{@render txt(sstX(GENESIS_SST), SST_Y + 42, '26.5', 11, { anchor: 'middle' })}
	{@render txt(sstX(cat5At), SST_Y + 42, cat5At.toFixed(1), 11, { anchor: 'middle', muted: true })}
	{@render txt(sstX(31), SST_Y + 42, '31', 11, { anchor: 'end', muted: true })}
	<path d="M{sstX(sst)} {SST_Y - 1} l-5 -8 h10 z" fill="var(--stage-ink)" />

	<!-- wind vs time -->
	{@render txt(CL + 20, 300, 'Wind over 5 days', 12, { weight: 600 })}
	<Axes
		{sx}
		{sy}
		xTicks={[0, 24, 48, 72, 96, 120]}
		yTicks={[0, 20, 40, 60, 80, 100]}
		xFormat={(h) => String(h / 24)}
		xLabel="days"
		yLabel="m/s"
	/>
	<!-- hurricane threshold -->
	<line
		x1={sx(0)}
		x2={sx(HMAX)}
		y1={sy(33)}
		y2={sy(33)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
	/>
	{@render txt(sx(HMAX) - 4, sy(33) + 14, 'hurricane: 33 m/s', 11, {
		anchor: 'end',
		muted: true
	})}
	<!-- ceiling -->
	{#if !tooCool}
		<line
			x1={sx(0)}
			x2={sx(HMAX)}
			y1={sy(vmax)}
			y2={sy(vmax)}
			stroke="var(--atm-warm)"
			stroke-width="1.4"
			stroke-dasharray="6 4"
			opacity={tooNear ? 0.45 : 1}
		/>
		{@render txt(sx(HMAX) - 4, sy(vmax) - 6, `max possible ${Math.floor(vmax)} m/s`, 11, {
			anchor: 'end',
			color: 'var(--atm-warm)',
			opacity: tooNear ? 0.6 : 1
		})}
	{/if}
	<path
		d={fullPath}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		opacity="0.35"
	/>
	<path d={tracedPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.2" />
	<line
		x1={sx(hours)}
		x2={sx(hours)}
		y1={sy(0)}
		y2={sy(100)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.5"
	/>
	<circle
		cx={sx(hours)}
		cy={sy(v)}
		r="4.5"
		fill="var(--stage-ink)"
		stroke="var(--surface)"
		stroke-width="1.5"
	/>
</g>
