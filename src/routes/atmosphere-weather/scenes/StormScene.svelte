<script lang="ts">
	/**
	 * A hurricane as a heat engine run on warm sea (step `hurricane`).
	 *
	 * Left, top: the storm seen from above, over a sea coloured by its surface
	 * temperature. Its cloud bands spiral round an eye and turn anticlockwise
	 * (northern hemisphere); size, tightness, eye clarity and rotation speed
	 * follow the wind speed v (see the clock below). Below hurricane
	 * strength it is a loose cluster of thunderstorms; when the storm can't form
	 * (cool sea, or too near the equator) the clouds drift apart and fade.
	 * Left, bottom: a cross-section through the storm — evaporation, inflow,
	 * rising eyewall towers releasing heat, outflow at the top, sinking air in
	 * the eye. Right: readouts, the sea-temperature ceiling and wind vs time.
	 *
	 * The storm's history is a list of legs, one per setting of the sliders:
	 * each remembers the `t` it began, the storm's clock (hours), wind and
	 * rotation angle at that moment, and evolves from there with
	 * `stormEvolve` — so cooling the sea (or moving within 5° of the equator)
	 * makes the running storm decay from its current strength, and warming it
	 * lets it grow from there. "Start a new storm" (or rewinding t) starts a
	 * single leg from the 15 m/s seed. The legs live in a frame-to-frame memo
	 * inside a $derived — the guide's sanctioned exception for state a pure
	 * function of `t` cannot hold (see TrackScene); within a leg everything is
	 * a pure function of t. The rotation angle is the exact integral of the
	 * wind speed, so it never snaps. The clock runs for 5 days (or 2 days past
	 * the last slider change, the chart scrolling with it), then holds.
	 * Reduced motion shows a fresh storm's 72-hour state, still.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { clamp, smoothstep, cycle, hash, scale, linePath, Axes } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		GENESIS_LAT,
		GENESIS_SST,
		STORM_SEED,
		canForm,
		category,
		maxIntensity,
		stormEvolve,
		stormWindIntegral
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
	const SPAN = 120; // the chart shows 5 days
	const AFTER = 48; // after a slider change the storm is followed for 2 more days
	const REDUCED_HOURS = 72;
	/** Rotation (radians) per (m/s · second): ~0.6 rad/s at 75 m/s. */
	const SPIN = 0.008;

	/** One stretch of the storm's life under fixed sliders. */
	interface Leg {
		start: number; // t when it began (s)
		h0: number; // storm clock then (hours)
		v0: number; // wind then (m/s)
		a0: number; // rotation angle then (radians)
		sst: number;
		lat: number;
	}
	const fresh = (start: number): Leg => ({ start, h0: 0, v0: STORM_SEED, a0: 0, sst, lat });
	/** Last hour the clock runs to. */
	const endOf = (legs: Leg[]) =>
		legs.length > 1 ? Math.max(SPAN, legs[legs.length - 1].h0 + AFTER) : SPAN;
	const clockOf = (L: Leg, at: number, end: number) =>
		Math.min(end, L.h0 + Math.max(0, at - L.start) * HPS);
	const windOf = (L: Leg, h: number) => stormEvolve(L.v0, L.sst, L.lat, h - L.h0);
	function angleOf(L: Leg, at: number, end: number) {
		const h = clockOf(L, at, end);
		const held = Math.max(0, at - L.start - (end - L.h0) / HPS); // seconds since the clock stopped
		return (
			L.a0 +
			(SPIN / HPS) * stormWindIntegral(L.v0, L.sst, L.lat, h - L.h0) +
			SPIN * windOf(L, h) * held
		);
	}

	let memo: { presses: number; legs: Leg[] } = { presses: -1, legs: [] };
	const legs = $derived.by(() => {
		if (reduced) return [fresh(0)];
		const last = memo.legs[memo.legs.length - 1];
		if (presses !== memo.presses || !last || t < last.start) {
			memo = { presses, legs: [fresh(memo.presses === -1 ? 0 : t)] };
		} else if (sst !== last.sst || lat !== last.lat) {
			const end = endOf(memo.legs);
			const h0 = clockOf(last, t, end);
			let list: Leg[];
			if (h0 - last.h0 < 0.25) {
				// A slider being dragged: changes within a quarter of an hour amend the last leg.
				list = [...memo.legs.slice(0, -1), { ...last, sst, lat }];
			} else {
				const next = { start: t, h0, v0: windOf(last, h0), a0: angleOf(last, t, end), sst, lat };
				list = [...memo.legs, next];
			}
			// Forget legs that ended before the chart's window.
			const lo = endOf(list) - SPAN;
			while (list.length > 1 && list[1].h0 <= lo) list = list.slice(1);
			memo = { presses, legs: list };
		}
		return memo.legs;
	});
	const leg = $derived(legs[legs.length - 1]);
	const hEnd = $derived(endOf(legs));
	const hours = $derived(reduced ? REDUCED_HOURS : clockOf(leg, t, hEnd));
	const v = $derived(windOf(leg, hours));
	const vmax = $derived(maxIntensity(sst));
	const angle = $derived(reduced ? angleOf(leg, REDUCED_HOURS / HPS, hEnd) : angleOf(leg, t, hEnd));
	/** Wind at any hour of the storm's life so far, and projected under the current sliders. */
	function windAtHour(h: number) {
		let L = legs[0];
		for (const l of legs) if (l.h0 <= h) L = l;
		return windOf(L, h);
	}
	const weakening = $derived(v > (forms ? vmax : 0) + 0.5);

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
	// The warm side turns the long way round the hue circle (blue → turquoise, never through
	// grey or rose), so a warm sea still reads as tropical water, not land.
	const sea = $derived(
		sst < GENESIS_SST
			? `color-mix(in oklab, var(--atm-ocean), var(--atm-cold) ${Math.round(((GENESIS_SST - sst) / 6.5) * 55)}%)`
			: `color-mix(in oklch longer hue, var(--atm-ocean), var(--atm-warm-sea) ${Math.round(2 + ((sst - GENESIS_SST) / 4.5) * 22)}%)`
	);
	// Clouds: brighter than the --atm-cloud token so they read against the sea in both themes.
	const cloud = $derived(
		dark
			? 'color-mix(in oklab, var(--atm-cloud), var(--stage-ink) 45%)'
			: 'color-mix(in oklab, var(--atm-cloud), var(--atm-neutral) 80%)'
	);

	// ---- names ---------------------------------------------------------------------------
	function stateName(w: number) {
		const c = category(w);
		if (c > 0) return `Category ${c} hurricane`;
		if (w >= 17) return 'Tropical storm';
		return 'Tropical depression';
	}
	const state = $derived(
		!forms && v < 10 ? 'Dying away' : !forms && v < 17 ? 'Disturbance, fading' : stateName(v)
	);
	const reasons = $derived(
		[
			tooCool ? 'sea too cool (below 26.5 °C)' : '',
			tooNear ? 'too close to the equator (no Coriolis spin)' : ''
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
	// Between the outflow (yTop + 18) and the inflow (SURF − 26) runs of the loop.
	const condY = $derived(Math.min(518, (yTop + 18 + SURF - 26) / 2 - 2));
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

	const hLo = $derived(hEnd - SPAN);
	const sx = $derived(scale([hLo, hEnd], [636, 926]));
	const xTicks = $derived(
		Array.from({ length: 6 }, (_, k) => Math.ceil(hLo / 24) * 24 + 24 * k).filter((h) => h <= hEnd)
	);
	const sy = scale([0, 100], [548, 330]);
	const curve = $derived(
		[
			...Array.from({ length: 61 }, (_, k) => hLo + (k / 60) * SPAN),
			...legs.map((l) => l.h0).filter((h) => h > hLo)
		]
			.sort((a, b) => a - b)
			.map((h) => ({ h, v: windAtHour(h) }))
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
			<rect x="16" y="16" width="560" height="376" rx="10" />
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
		rx="10"
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
			{@const label = `${v >= 17 ? 'Weakening' : 'No hurricane'}: ${r}`}
			{@const w = label.length * 6.5 + 24}
			<g transform="translate({CX - w / 2} {360 - (reasons.length - 1 - k) * 28})">
				<rect
					width={w}
					height="22"
					rx="11"
					fill="var(--surface)"
					stroke="var(--atm-low)"
					stroke-width="1.2"
				/>
				{@render txt(w / 2, 15, label, 12, { anchor: 'middle', weight: 600 })}
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
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<path
		d="M{SX} {SURF} L{SX + SW} {SURF} L{SX + SW} {SBOT - 10} Q{SX + SW} {SBOT} {SX + SW - 10} {SBOT}
		L{SX + 10} {SBOT} Q{SX} {SBOT} {SX} {SBOT - 10} Z"
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
		tooCool ? 'cool sea: little evaporation' : 'evaporation from the warm sea',
		12
	)}
	<g opacity={smoothstep(0.05, 0.4, engine)}>
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
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(CL + 20, 46, state, 18, { weight: 700 })}
	{@render txt(CL + 20, 74, `${Math.floor(v)} m/s`, 16, { weight: 600, tabular: true })}
	{@render txt(CL + 96, 74, `· ${Math.floor(v * 3.6)} km/h sustained wind`, 13, {
		tabular: true
	})}
	{@render txt(
		CL + 20,
		94,
		`${fmtTime(hours)} after it began${weakening ? ' · weakening' : ''}`,
		12,
		{
			muted: true,
			tabular: true
		}
	)}
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
		{xTicks}
		yTicks={[0, 20, 40, 60, 80, 100]}
		xFormat={(h) => String(h / 24)}
		xLabel="days"
		yLabel="m/s"
	/>
	<!-- hurricane threshold -->
	<line
		x1={sx(hLo)}
		x2={sx(hEnd)}
		y1={sy(33)}
		y2={sy(33)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
	/>
	{@render txt(sx(hEnd) - 4, sy(33) + 14, 'hurricane: 33 m/s', 11, {
		anchor: 'end',
		muted: true
	})}
	<!-- ceiling -->
	{#if !tooCool}
		<line
			x1={sx(hLo)}
			x2={sx(hEnd)}
			y1={sy(vmax)}
			y2={sy(vmax)}
			stroke="var(--atm-warm)"
			stroke-width="1.4"
			stroke-dasharray="6 4"
			opacity={tooNear ? 0.45 : 1}
		/>
		{@render txt(sx(hEnd) - 4, sy(vmax) - 6, `max possible ${Math.floor(vmax)} m/s`, 11, {
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
