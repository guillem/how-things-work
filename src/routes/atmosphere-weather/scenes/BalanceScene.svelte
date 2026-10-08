<script lang="ts">
	/**
	 * The globe in sunlight and its energy budget, latitude by latitude.
	 *
	 * Phases (`step.hints.phase`), cross-faded with a tween:
	 *   sunlight  — parallel sunbeams light the globe from the left; two
	 *               highlighted beams of the same width show the short footprint
	 *               at the equator and the long, slanted one near 60°. The chart
	 *               shows the sunlight arriving at the top of the atmosphere
	 *               (dotted), the sunlight absorbed and the heat radiated, for
	 *               today's climate (D = D_EARTH, whatever the slider says), with
	 *               the surplus and deficit shaded.
	 *   transport — the `transport` control (a multiple of D_EARTH, 0–2) sets
	 *               the heat carried polewards: ribbons over the globe whose
	 *               width follows `northward`, a smaller radiation chart, and a
	 *               temperature-by-latitude chart with the no-transport climate
	 *               dashed for comparison.
	 *
	 * The globe is seen side-on at equinox (axis vertical), so latitude φ sits at
	 * height R·sin φ, and the charts' x axis is sin φ, which spaces latitudes by
	 * the area of the Earth between them.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		areaPath,
		clamp,
		cycle,
		lerp,
		linePath,
		scale,
		smoothstep
	} from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { D_EARTH, climate, insolation, tempAt } from '../atmosphere';

	let { step, t, params, reduced }: StageProps = $props();

	const rad = (d: number) => (d * Math.PI) / 180;
	const deg = (r: number) => (r * 180) / Math.PI;

	// ---- phase and transport, tweened ----------------------------------------------
	const isTransport = $derived(step.hints?.phase === 'transport');
	const D = $derived(isTransport ? clamp(Number(params.transport ?? 1), 0, 2) * D_EARTH : D_EARTH);
	const ease = { duration: 800, easing: cubicInOut };
	const ph = new Tween(
		untrack(() => (isTransport ? 1 : 0)),
		ease
	);
	const dTw = new Tween(
		untrack(() => D),
		ease
	);
	$effect(() => {
		const v = isTransport ? 1 : 0;
		untrack(() => ph.set(v, { duration: reduced ? 0 : 800 }));
	});
	$effect(() => {
		const v = D;
		untrack(() => dTw.set(v, { duration: reduced ? 0 : 700 }));
	});

	const P = $derived(ph.current);
	const c = $derived(climate(dTw.current));
	const flat = climate(0); // each latitude on its own
	const strength = $derived(smoothstep(0, 0.12, dTw.current / D_EARTH)); // 0 = no transport
	const peak = $derived.by(() => {
		let m = 0;
		let at = 0;
		c.northward.forEach((f, i) => {
			if (f > m) {
				m = f;
				at = c.edges[i];
			}
		});
		return { pw: m / 1e15, lat: at };
	});
	/** Heat flow across latitude φ (W, poleward, absolute). */
	function flowAt(lat: number) {
		const { edges, northward } = c;
		const a = Math.abs(lat);
		let i = edges.length - 1;
		while (i > 0 && edges[i] > a) i--;
		const j = Math.min(edges.length - 1, i + 1);
		const u = edges[j] === edges[i] ? 0 : clamp((a - edges[i]) / (edges[j] - edges[i]));
		return Math.abs(lerp(northward[i], northward[j], u));
	}

	// ---- temperature colour scale: cold → neutral (0 °C) → warm ----------------------
	// The same scale colours the globes of CellsScene and CoriolisScene.
	function tempColor(T: number) {
		const u = clamp(T / 35, -1, 1);
		const p = Math.round(Math.abs(u) * 100);
		return u < 0
			? `color-mix(in oklab, var(--atm-cold) ${p}%, var(--atm-neutral))`
			: `color-mix(in oklab, var(--atm-warm) ${p}%, var(--atm-neutral))`;
	}

	// ---- globe -------------------------------------------------------------------
	const GX = 292;
	const GY = 318;
	const R = 160;
	const BEAM_X0 = 24;
	const BEAM_W = 34;
	const latY = (lat: number) => GY - R * Math.sin(rad(lat));
	const limbX = (y: number) => GX - Math.sqrt(Math.max(0, R * R - (y - GY) ** 2));

	const STOPS = 33;
	const stops = Array.from({ length: STOPS }, (_, i) => {
		const off = i / (STOPS - 1);
		return { i, off, lat: deg(Math.asin(clamp(1 - 2 * off, -1, 1))) };
	});

	// Two highlighted beams of the same width, centred on 0° and 60°.
	function beam(latC: number) {
		const yc = latY(latC);
		const y1 = yc - BEAM_W / 2;
		const y2 = yc + BEAM_W / 2;
		const x1 = limbX(y1).toFixed(1);
		const x2 = limbX(y2).toFixed(1);
		return {
			poly: `M${BEAM_X0} ${y1} L${x1} ${y1} A${R} ${R} 0 0 0 ${x2} ${y2} L${BEAM_X0} ${y2} Z`,
			arc: `M${x1} ${y1} A${R} ${R} 0 0 0 ${x2} ${y2}`,
			y1,
			y2,
			yc,
			xc: limbX(yc)
		};
	}
	const beamEq = beam(0);
	const beam60 = beam(60);

	// Background rays with photons flowing in (static dashes under reduced motion).
	const RAYS = 13;
	const rays = Array.from({ length: RAYS }, (_, i) => {
		const y = GY - R + 12 + (i * (2 * R - 24)) / (RAYS - 1);
		return { i, y, x1: limbX(y) - 2 };
	});
	const photons = $derived(
		rays.flatMap((r) =>
			[0, 1, 2].map((k) => {
				const len = r.x1 - 8 - BEAM_X0;
				const u = cycle(t, 3.2, k / 3 + r.i * 0.137);
				const x = BEAM_X0 + 8 + u * len;
				return {
					key: `${r.i}-${k}`,
					x,
					y: r.y,
					o: reduced ? 1 : smoothstep(0, 0.1, u) * (1 - smoothstep(0.88, 1, u))
				};
			})
		)
	);

	// Heat radiated to space: wavy arrows leaving the right limb, length ∝ emitted.
	const EMIT_LATS = [-60, -30, 0, 30, 60];
	const emitArrows = $derived(
		EMIT_LATS.map((lat) => {
			const e = emittedAt(lat);
			const len = 8 + e * 0.1;
			const a = rad(lat);
			const ux = Math.cos(a);
			const uy = -Math.sin(a);
			const x0 = GX + R * ux + 4;
			const y0 = GY + R * uy;
			const n = 16;
			let d = '';
			for (let i = 0; i <= n; i++) {
				const s = (i / n) * len;
				const w = Math.sin(s / 2.6) * 3;
				d += `${i ? 'L' : 'M'}${(x0 + s * ux - w * uy).toFixed(1)} ${(y0 + s * uy + w * ux).toFixed(1)}`;
			}
			const hx = x0 + len * ux;
			const hy = y0 + len * uy;
			const head = `M${(hx + ux * 6).toFixed(1)} ${(hy + uy * 6).toFixed(1)} L${(hx - uy * 4).toFixed(1)} ${(hy + ux * 4).toFixed(1)} L${(hx + uy * 4).toFixed(1)} ${(hy - ux * 4).toFixed(1)} Z`;
			return { lat, d, head };
		})
	);
	function emittedAt(lat: number) {
		let best = 0;
		c.lat.forEach((l, i) => {
			if (Math.abs(l - lat) < Math.abs(c.lat[best] - lat)) best = i;
		});
		return c.emitted[best];
	}

	// Poleward heat flow: ribbons along three meridians in each hemisphere.
	const MERIDIANS = [-48, 0, 48];
	const PW_REF = 7e15; // a ribbon RIB px wide carries PW_REF watts
	const RIB = 20;
	const RIB_LATS = Array.from({ length: 25 }, (_, i) => 2 + (i / 24) * 68);
	const ribbons = $derived(
		MERIDIANS.flatMap((lon) =>
			[1, -1].map((h) => {
				const pt = (lat: number) => ({
					x: GX + R * Math.cos(rad(lat)) * Math.sin(rad(lon)),
					y: GY - h * R * Math.sin(rad(lat))
				});
				const wOf = (lat: number) => (RIB * flowAt(lat)) / PW_REF;
				const left: string[] = [];
				const right: string[] = [];
				for (const lat of RIB_LATS) {
					const p = pt(lat);
					const w = wOf(lat) / 2;
					left.push(`${(p.x - w).toFixed(1)} ${p.y.toFixed(1)}`);
					right.unshift(`${(p.x + w).toFixed(1)} ${p.y.toFixed(1)}`);
				}
				const end = pt(70);
				const tip = pt(80);
				const hw = Math.max(wOf(70) / 2 + 5, 7);
				return {
					key: `${lon}-${h}`,
					lon,
					h,
					body: `M${left.join(' L')} L${right.join(' L')} Z`,
					head: `M${(end.x - hw).toFixed(1)} ${end.y.toFixed(1)} L${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${(end.x + hw).toFixed(1)} ${end.y.toFixed(1)} Z`,
					pt
				};
			})
		)
	);
	const heatDots = $derived(
		ribbons.flatMap((r) =>
			[0, 1, 2].map((k) => {
				const u = cycle(t, 4, k / 3 + (r.lon + 48) / 300 + (r.h > 0 ? 0 : 0.17));
				const lat = 4 + u * 64;
				const p = r.pt(lat);
				const fade = reduced ? 1 : smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u));
				return {
					key: `${r.key}-${k}`,
					x: p.x,
					y: p.y,
					o: fade * clamp(flowAt(lat) / 2e15)
				};
			})
		)
	);

	// ---- charts ------------------------------------------------------------------
	const CX0 = 556;
	const CX1 = 928;
	const sx = scale([-1, 1], [CX0, CX1]);
	const xTicks = [-60, -30, 0, 30, 60].map((d) => Math.sin(rad(d)));
	const xFormat = (v: number) => {
		const d = Math.round(deg(Math.asin(clamp(v, -1, 1))));
		return d === 0 ? '0°' : `${Math.abs(d)}°${d < 0 ? 'S' : 'N'}`;
	};
	const top1 = $derived(lerp(84, 52, P));
	const bot1 = $derived(lerp(496, 268, P));
	const sy1 = $derived(scale([0, 500], [bot1, top1]));
	const sy2 = scale([-60, 60], [530, 372]);

	interface Row {
		x: number;
		a: number;
		e: number;
		T: number;
	}
	const rows = $derived<Row[]>(
		c.lat.map((l, i) => ({
			x: Math.sin(rad(l)),
			a: c.absorbed[i],
			e: c.emitted[i],
			T: c.T[i]
		}))
	);
	const flatRows = flat.lat.map((l, i) => ({ x: Math.sin(rad(l)), T: flat.T[i] }));
	const insol = Array.from({ length: 81 }, (_, i) => {
		const x = -1 + i / 40;
		return { x, v: insolation(deg(Math.asin(clamp(x, -1, 1)))) };
	});
	const surplus = $derived(
		areaPath(
			rows,
			(r) => r.x,
			(r) => r.e,
			(r) => Math.max(r.a, r.e),
			sx,
			sy1
		)
	);
	const deficit = $derived(
		areaPath(
			rows,
			(r) => r.x,
			(r) => r.a,
			(r) => Math.max(r.a, r.e),
			sx,
			sy1
		)
	);
	const eqRow = $derived(rows[45]);
	const nRow = $derived(rows[86]); // ≈ 70° N, where the deficit label sits
	const tEq = $derived(tempAt(c, 0));
	const tPole = $derived(c.T[c.T.length - 1]);
	const fmtT = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(Math.round(v))} °C`;

	const pulse = $derived(reduced ? 0 : t);
	const KEY_STOPS = [-35, -17.5, 0, 17.5, 35];
	const KEY_W = 180;
</script>

<g>
	<defs>
		<linearGradient
			id="balance-temp-grad"
			gradientUnits="userSpaceOnUse"
			x1="0"
			x2="0"
			y1={GY - R}
			y2={GY + R}
		>
			{#each stops as st (st.i)}
				<stop offset={st.off} style:stop-color={tempColor(tempAt(c, st.lat))} />
			{/each}
		</linearGradient>
		<linearGradient id="balance-temp-key" x1="0" x2="1" y1="0" y2="0">
			{#each KEY_STOPS as T, i (i)}
				<stop offset={i / (KEY_STOPS.length - 1)} style:stop-color={tempColor(T)} />
			{/each}
		</linearGradient>
	</defs>

	<!-- temperature key -->
	<g transform="translate({BEAM_X0} 40)">
		{@render txt(0, 0, 'surface temperature, yearly average', 11, { muted: true })}
		<rect y="8" width={KEY_W} height="8" rx="2" fill="url(#balance-temp-key)" />
		{#each [-30, 0, 30] as T (T)}
			{@render txt(((T + 35) / 70) * KEY_W, 31, fmtT(T), 11, {
				anchor: 'middle',
				muted: true
			})}
		{/each}
	</g>

	<!-- ============================== globe ============================== -->
	<g>
		<!-- sunlight rays and photons -->
		{#each rays as r (r.i)}
			<line
				x1={BEAM_X0}
				x2={r.x1}
				y1={r.y}
				y2={r.y}
				stroke="var(--atm-sun)"
				stroke-opacity="0.35"
				stroke-width="1"
			/>
		{/each}
		{#each photons as p (p.key)}
			<line
				x1={p.x - 7}
				x2={p.x + 7}
				y1={p.y}
				y2={p.y}
				stroke="var(--atm-sun)"
				stroke-width="2.5"
				stroke-linecap="round"
				opacity={p.o}
			/>
		{/each}
		{@render txt(BEAM_X0, GY - R - 26, 'sunlight →', 13, {
			color: 'var(--atm-sun)',
			weight: 600
		})}

		<!-- surface coloured by temperature -->
		<circle cx={GX} cy={GY} r={R} fill="url(#balance-temp-grad)" />
		{#each [-60, -30, 0, 30, 60] as lat (lat)}
			{@const y = latY(lat)}
			{@const hw = R * Math.cos(rad(lat))}
			<line
				x1={GX - hw}
				x2={GX + hw}
				y1={y}
				y2={y}
				stroke="var(--stage-ink)"
				stroke-opacity={lat === 0 ? 0.35 : 0.2}
				stroke-dasharray={lat === 0 ? undefined : '3 4'}
			/>
		{/each}
		<circle cx={GX} cy={GY} r={R} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />

		<!-- heat radiated to space -->
		{#each emitArrows as a (a.lat)}
			<path
				d={a.d}
				fill="none"
				stroke="var(--atm-emit)"
				stroke-width="1.8"
				stroke-dasharray="5 3"
				stroke-dashoffset={-pulse * 8}
			/>
			<path d={a.head} fill="var(--atm-emit)" />
		{/each}
		{@render txt(GX + R * 0.78 + 30, GY - R + 2, 'infrared out', 12, {
			color: 'var(--atm-emit)',
			weight: 600,
			anchor: 'middle'
		})}

		<!-- the two highlighted beams and their footprints -->
		<g opacity={1 - 0.75 * P}>
			{#each [beamEq, beam60] as b, i (i)}
				<path
					d={b.poly}
					fill="var(--atm-sun)"
					fill-opacity="0.22"
					stroke="var(--atm-sun)"
					stroke-width="1"
				/>
				<path
					d={b.arc}
					fill="none"
					stroke="var(--atm-sun)"
					stroke-width="5"
					stroke-linecap="round"
				/>
			{/each}
		</g>
		<g opacity={1 - P}>
			{@render txt(beamEq.xc + 14, beamEq.yc - 26, 'straight down:', 12, { weight: 600 })}
			{@render txt(beamEq.xc + 14, beamEq.yc - 11, 'a short strip', 12, {})}
			{@render txt(beam60.xc - 6, beam60.y2 + 18, 'at a slant: the same beam', 12, {
				weight: 600
			})}
			{@render txt(beam60.xc - 6, beam60.y2 + 33, 'is spread over twice the length', 12, {})}
		</g>

		<!-- poleward heat flow -->
		<g opacity={P * strength}>
			{#each ribbons as r (r.key)}
				<path
					d={r.body}
					fill="var(--atm-warm)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
				<path
					d={r.head}
					fill="var(--atm-warm)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			{/each}
			{#each heatDots as d (d.key)}
				<circle cx={d.x} cy={d.y} r="2.4" fill="var(--stage-bg)" opacity={d.o} />
			{/each}
		</g>
		{#each [60, 30, 0, -30, -60] as lat (lat)}
			{@render txt(
				GX + R * Math.cos(rad(lat)) - 8,
				latY(lat) - 4,
				lat === 0 ? 'equator' : `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}`,
				11,
				{ anchor: 'end', muted: true }
			)}
		{/each}
		<g opacity={P}>
			{@render txt(
				GX,
				GY + R + 30,
				strength > 0.5
					? `peak heat flow ≈ ${peak.pw.toFixed(1)} PW at ${Math.round(peak.lat)}°, each hemisphere`
					: 'no heat carried: each latitude balances its own books',
				13,
				{ anchor: 'middle', weight: 600 }
			)}
			{@render txt(GX, GY + R + 48, 'arrow width ∝ heat flow · 1 PW = 10¹⁵ W', 11, {
				anchor: 'middle',
				muted: true,
				opacity: strength
			})}
		</g>
	</g>

	<!-- ============================== radiation chart ============================== -->
	<Axes
		{sx}
		sy={sy1}
		{xTicks}
		{xFormat}
		yTicks={P > 0.5 ? [0, 200, 400] : [0, 100, 200, 300, 400, 500]}
		xLabel={P > 0.5 ? undefined : 'latitude (spaced by area)'}
		yLabel="W/m², yearly average"
	/>
	<path d={surplus} fill="var(--atm-sun)" fill-opacity="0.22" />
	<path d={deficit} fill="var(--atm-emit)" fill-opacity="0.16" />
	<path
		d={linePath(
			insol,
			(d) => d.x,
			(d) => d.v,
			sx,
			sy1
		)}
		fill="none"
		stroke="var(--atm-sun)"
		stroke-width="1.6"
		stroke-dasharray="1.5 4"
		stroke-linecap="round"
	/>
	<path
		d={linePath(
			rows,
			(r) => r.x,
			(r) => r.a,
			sx,
			sy1
		)}
		fill="none"
		stroke="var(--atm-sun)"
		stroke-width="2.6"
	/>
	<path
		d={linePath(
			rows,
			(r) => r.x,
			(r) => r.e,
			sx,
			sy1
		)}
		fill="none"
		stroke="var(--atm-emit)"
		stroke-width="2.6"
		stroke-dasharray={strength < 0.05 ? '7 5' : undefined}
	/>
	<!-- direct labels -->
	{@render txt(
		sx(0),
		sy1(insolation(0)) - 8,
		`arriving at the top of the atmosphere: ${Math.round(insolation(0))} W/m²`,
		12,
		{ anchor: 'middle', color: 'var(--atm-sun)' }
	)}
	<g opacity={1 - P}>
		<line
			x1={CX0 + 6}
			x2={CX0 + 6}
			y1={sy1(insolation(-90)) - 4}
			y2={sy1(352)}
			stroke="var(--atm-sun)"
			stroke-dasharray="1.5 3"
		/>
		{@render txt(CX0 + 12, sy1(380), `${Math.round(insolation(90))} W/m²`, 12, {
			color: 'var(--atm-sun)'
		})}
		{@render txt(CX0 + 12, sy1(380) + 15, 'at the poles', 12, { color: 'var(--atm-sun)' })}
	</g>
	{@render txt(sx(0), sy1(eqRow.a) - 8, 'absorbed (the rest is reflected)', 12, {
		anchor: 'middle',
		color: 'var(--atm-sun)',
		weight: 600
	})}
	{@render txt(
		sx(0),
		lerp(sy1(240), sy1(Math.min(eqRow.a, eqRow.e)) + 22, strength),
		'heat radiated to space',
		12,
		{
			anchor: 'middle',
			color: 'var(--atm-emit)',
			weight: 600
		}
	)}
	<g opacity={strength}>
		{@render txt(sx(0), (sy1(eqRow.a) + sy1(eqRow.e)) / 2 + 4, 'surplus: heat to export', 12, {
			anchor: 'middle',
			weight: 600,
			opacity: smoothstep(16, 26, sy1(eqRow.e) - sy1(eqRow.a))
		})}
		{@render txt(CX1, sy1(nRow.a) + 18, 'deficit: heat imported', 12, {
			anchor: 'end',
			weight: 600
		})}
		{@render txt(CX0 + 10, sy1(nRow.a) + 18, 'deficit', 12, { weight: 600 })}
	</g>
	<g opacity={P * (1 - strength)}>
		{@render txt(sx(0), sy1(175), 'absorbed = radiated at every latitude', 11, {
			anchor: 'middle',
			muted: true
		})}
	</g>

	<!-- ============================== temperature chart ============================== -->
	{#if P > 0.01}
		<g opacity={P}>
			<Axes
				{sx}
				sy={sy2}
				{xTicks}
				{xFormat}
				yTicks={[-60, -30, 0, 30, 60]}
				yLabel="temperature (°C)"
				xLabel="latitude (spaced by area)"
			/>
			<path
				d={linePath(
					flatRows,
					(r) => r.x,
					(r) => r.T,
					sx,
					sy2
				)}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
				stroke-dasharray="6 5"
			/>
			<path
				d={linePath(
					rows,
					(r) => r.x,
					(r) => r.T,
					sx,
					sy2
				)}
				fill="none"
				stroke="var(--atm-warm)"
				stroke-width="2.6"
			/>
			<g opacity={strength}>
				{@render txt(
					sx(0),
					sy2(tempAt(flat, 0)) - 8,
					`${fmtT(tempAt(flat, 0))} with no transport`,
					11,
					{ anchor: 'middle', muted: true }
				)}
				{@render txt(sx(0.86), sy2(-54), fmtT(flat.T[89]), 11, {
					anchor: 'end',
					muted: true
				})}
			</g>
			{@render txt(
				tEq > 45 ? sx(0.14) : sx(0),
				sy2(tEq) + (tEq > 45 ? 4 : 20),
				`equator ${fmtT(tEq)}`,
				12,
				{
					anchor: tEq > 45 ? 'start' : 'middle',
					weight: 600
				}
			)}
			{@render txt(sx(0.97), sy2(tPole) + (tPole > -35 ? 22 : -14), `pole ${fmtT(tPole)}`, 12, {
				anchor: 'end',
				weight: 600
			})}
		</g>
	{/if}
</g>

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
		style:fill={opts.color}>{text}</text
	>
{/snippet}
