<script lang="ts">
	/**
	 * A wind-driven ocean basin seen from above (north up): on the left, the
	 * winds blowing over it (trade winds and westerlies, arrows to scale with
	 * their push on the sea); in the middle, the basin (15°N–65°N, 6000 km wide)
	 * between the American coast and Europe/Africa; on the right, a readout card.
	 *
	 * Phases (`step.hints.phase`):
	 *   ekman   — at a grid of points, the wind (violet) and the Ekman drift it
	 *             drives (teal, at right angles to it, scaled by τ/ρf); the sea
	 *             surface "hill" (nested streamlines filled, warm) rises over the
	 *             first two seconds where the drifts converge, a dip where they
	 *             diverge
	 *   gyres   — the streamlines of Stommel's solution with particles moving
	 *             along them at the speed of the flow
	 *   western — the same, labelled: the Gulf Stream and the slow drift;
	 *             `params.spin` can switch β off (symmetric gyre)
	 *
	 * Everything comes from `stommel()`: the streamlines are traced from it,
	 * the particles move along them with the travel time ∫ds/|v| (one fixed
	 * scale for all settings, so stronger winds give faster particles).
	 * Particles are a pure function of t.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BASIN,
		BASIN_HEIGHT,
		SV,
		TRADES,
		WESTERLIES,
		ekmanTransport,
		gyreExtremes,
		gyreStreamlines,
		stommel,
		stressAt,
		westEastSpeeds,
		type Streamline
	} from '../ocean';
	import Card, { type Cell } from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- layout -----------------------------------------------------------------------
	const BX0 = 244; // basin west coast
	const BX1 = 704; // east coast
	const BYN = 40; // 65°N
	const BYS = 560; // 15°N
	const WX = 116; // wind panel axis
	const CARD = { x: 776, y: 40, w: 168 };
	const TAU_PX = 380; // px per N/m² for wind arrows in the panel
	const xPx = (x: number) => BX0 + (x / BASIN.width) * (BX1 - BX0);
	const yPx = (y: number) => BYS - (y / BASIN_HEIGHT) * (BYS - BYN);
	const latPx = (lat: number) =>
		BYS - ((lat - BASIN.lat0) / (BASIN.lat1 - BASIN.lat0)) * (BYS - BYN);

	const phase = $derived(String(step.hints?.phase ?? 'gyres'));
	const winds = $derived({
		trades: Number(params.trades ?? TRADES),
		westerlies: Number(params.westerlies ?? WESTERLIES)
	});
	const beta = $derived(phase !== 'western' || String(params.spin ?? 'earth') !== 'uniform');

	// ---- the model ---------------------------------------------------------------------
	const gyre = $derived(stommel(winds, beta));
	const ext = $derived(gyreExtremes(gyre));
	const MIN_PSI = 0.5 * SV;
	const warm = $derived(ext.max.psi > MIN_PSI ? gyreStreamlines(gyre, ext.max) : []);
	const cold = $derived(ext.min.psi < -MIN_PSI ? gyreStreamlines(gyre, ext.min) : []);
	const speeds = $derived(westEastSpeeds(gyre, ext.max.y));

	interface Loop {
		id: string;
		d: string;
		xs: number[];
		ys: number[];
		time: number[];
		len: number;
		warm: boolean;
		k: number;
	}
	function toLoop(s: Streamline, id: string, isWarm: boolean, k: number): Loop {
		const stride = Math.max(1, Math.floor(s.x.length / 260));
		const xs: number[] = [];
		const ys: number[] = [];
		const time: number[] = [];
		for (let i = 0; i < s.x.length; i += stride) {
			xs.push(xPx(s.x[i]));
			ys.push(yPx(s.y[i]));
			time.push(s.time[i]);
		}
		const n = s.x.length - 1;
		if (n % stride !== 0) {
			xs.push(xPx(s.x[n]));
			ys.push(yPx(s.y[n]));
			time.push(s.time[n]);
		}
		let d = '';
		let len = 0;
		for (let i = 0; i < xs.length; i++) {
			d += `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
			if (i) len += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
		}
		return { id, d: d + 'Z', xs, ys, time, len, warm: isWarm, k };
	}
	const loops = $derived([
		...warm.map((s, k) => toLoop(s, `w${k}`, true, k)),
		...cold.map((s, k) => toLoop(s, `c${k}`, false, k))
	]);

	// ---- particles: pure function of t ------------------------------------------------
	/** Animation seconds per unit of travel time (s/m): the default outer loop takes ~18 s. */
	const ANIM = 1.3e-5;
	const particles = $derived.by(() => {
		const out: { id: string; x: number; y: number }[] = [];
		const tt = t / ANIM;
		for (const L of loops) {
			const T = L.time[L.time.length - 1];
			if (!(T > 0)) continue;
			const n = Math.max(2, Math.round(L.len / 48));
			for (let j = 0; j < n; j++) {
				const s = (((tt + (j * T) / n) % T) + T) % T;
				let lo = 0;
				let hi = L.time.length - 1;
				while (hi - lo > 1) {
					const mid = (lo + hi) >> 1;
					if (L.time[mid] <= s) lo = mid;
					else hi = mid;
				}
				const span = L.time[hi] - L.time[lo];
				const u = span > 0 ? (s - L.time[lo]) / span : 0;
				out.push({
					id: `${L.id}-${j}`,
					x: L.xs[lo] + (L.xs[hi] - L.xs[lo]) * u,
					y: L.ys[lo] + (L.ys[hi] - L.ys[lo]) * u
				});
			}
		}
		return out;
	});

	// ---- winds panel -----------------------------------------------------------------
	const windRows = $derived(
		Array.from({ length: 11 }, (_, i) => {
			const lat = 15 + i * 5;
			const tau = stressAt(winds, lat);
			return { lat, y: latPx(lat), dx: Math.max(-74, Math.min(74, tau * TAU_PX)) };
		})
	);
	const windCurve = $derived.by(() => {
		let d = '';
		for (let lat = 15; lat <= 65.001; lat += 1) {
			const x = WX + Math.max(-74, Math.min(74, stressAt(winds, lat) * TAU_PX));
			d += `${lat === 15 ? 'M' : 'L'}${x.toFixed(1)} ${latPx(lat).toFixed(1)}`;
		}
		return d;
	});

	// ---- Ekman grid ------------------------------------------------------------------
	const EK_PX = 16; // px per m²/s of Ekman transport
	const ekman = $derived(
		[0.16, 0.39, 0.62, 0.85].flatMap((fx, c) =>
			Array.from({ length: 10 }, (_, r) => {
				const lat = 17.5 + r * 5;
				const x = BX0 + fx * (BX1 - BX0);
				const y = latPx(lat);
				const m = ekmanTransport(winds, lat);
				return {
					id: `${c}-${r}`,
					x,
					y,
					wind: Math.max(-30, Math.min(30, stressAt(winds, lat) * 200)),
					drift: Math.max(-22, Math.min(22, m * EK_PX))
				};
			})
		)
	);
	const convergence = $derived.by(() => {
		for (let lat = 16; lat < 60; lat += 0.25) {
			if (ekmanTransport(winds, lat) > 0 && ekmanTransport(winds, lat + 0.25) <= 0) return lat;
		}
		return NaN;
	});

	// ---- focus tweens ------------------------------------------------------------------
	const ekmanOn = new Tween(0, { duration: 800, easing: cubicInOut });
	const flowOn = new Tween(0, { duration: 800, easing: cubicInOut });
	const labelsOn = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		const d = reduced ? 0 : 800;
		untrack(() => {
			ekmanOn.set(p === 'ekman' ? 1 : 0, { duration: d });
			flowOn.set(p === 'ekman' ? 0 : 1, { duration: d });
			labelsOn.set(p === 'western' ? 1 : 0, { duration: d });
		});
	});
	// The hill rises over the first seconds of the ekman step (complete at t = 2.5 s).
	const hill = $derived(phase === 'ekman' ? smoothstep(0.2, 2.4, t) : 0.6);

	// ---- labels --------------------------------------------------------------------------
	const warmCentre = $derived({ x: xPx(ext.max.x), y: yPx(ext.max.y) });
	const coldCentre = $derived({ x: xPx(ext.min.x), y: yPx(ext.min.y) });
	const hasWarm = $derived(warm.length > 0);
	const hasCold = $derived(cold.length > 0);
	const fmtSv = (v: number) => `${Math.abs(v / SV).toFixed(Math.abs(v) < 10 * SV ? 1 : 0)} Sv`;

	const cells: Cell[] = $derived.by(() => {
		if (phase === 'ekman')
			return [
				{
					id: 'tr',
					label: 'push of the trades',
					value: `${Math.abs(stressAt(winds, 15)).toFixed(3)} N/m²`,
					sub: `${winds.trades.toFixed(1)} m/s from the east`,
					color: 'var(--oc-wind)'
				},
				{
					id: 'we',
					label: 'push of the westerlies',
					value: `${Math.max(0, stressAt(winds, 45)).toFixed(3)} N/m²`,
					sub: `${winds.westerlies.toFixed(1)} m/s from the west`,
					color: 'var(--oc-wind)'
				},
				{
					id: 'cv',
					label: 'water piles up at',
					value: Number.isFinite(convergence) ? `${Math.round(convergence)}°N` : '—',
					sub: 'where the drifts meet',
					color: 'var(--oc-ekman)'
				}
			];
		const out: Cell[] = [
			{
				id: 'warm',
				label: 'warm gyre carries',
				value: hasWarm ? fmtSv(ext.max.psi) : 'none',
				sub: hasWarm ? 'clockwise' : 'no wind to drive it',
				color: 'var(--oc-warm)'
			},
			{
				id: 'cold',
				label: 'cold gyre carries',
				value: hasCold ? fmtSv(ext.min.psi) : 'none',
				sub: hasCold ? 'anticlockwise' : '',
				color: 'var(--oc-cold)'
			}
		];
		if (phase === 'western')
			out.push({
				id: 'west',
				label: 'west vs open ocean',
				value: hasWarm ? `${speeds.ratio.toFixed(speeds.ratio < 10 ? 1 : 0)}× faster` : '—',
				sub: beta ? 'fastest flow in each' : 'no squeeze: symmetric',
				color: 'var(--oc-flow)'
			});
		else
			out.push({
				id: 'rivers',
				label: "all the world's rivers",
				value: '≈ 1.2 Sv',
				sub: '1 Sv = 1 million m³/s'
			});
		return out;
	});
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
		rotate?: number;
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
		transform={opts.rotate ? `rotate(${opts.rotate} ${x} ${y})` : undefined}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet arrow(x1: number, y1: number, x2: number, y2: number, color: string, w: number)}
	{@const L = Math.hypot(x2 - x1, y2 - y1)}
	{#if L > 3}
		{@const ux = (x2 - x1) / L}
		{@const uy = (y2 - y1) / L}
		{@const hs = Math.min(6, L * 0.45)}
		<line
			{x1}
			{y1}
			x2={x2 - ux * hs * 0.8}
			y2={y2 - uy * hs * 0.8}
			stroke={color}
			stroke-width={w}
			stroke-linecap="round"
		/>
		<path
			d="M{x2} {y2} L{x2 - ux * hs - uy * hs * 0.6} {y2 - uy * hs + ux * hs * 0.6} L{x2 -
				ux * hs +
				uy * hs * 0.6} {y2 - uy * hs - ux * hs * 0.6} Z"
			fill={color}
		/>
	{/if}
{/snippet}

<g>
	<defs>
		<clipPath id="gyre-basin">
			<rect x={BX0} y={BYN} width={BX1 - BX0} height={BYS - BYN} />
		</clipPath>
	</defs>

	<!-- ===== wind panel ===== -->
	{@render txt(WX, BYN - 14, 'the winds', 13, { anchor: 'middle', weight: 600 })}
	<line
		x1={WX}
		x2={WX}
		y1={BYN}
		y2={BYS}
		stroke="var(--stage-line)"
		stroke-dasharray="3 4"
		opacity="0.7"
	/>
	<path d={windCurve} fill="none" stroke="var(--oc-wind)" stroke-width="1.5" opacity="0.45" />
	{#each windRows as r (r.lat)}
		{#if Math.abs(r.dx) > 3}
			<line
				x1={WX}
				x2={WX + r.dx - Math.sign(r.dx) * 5}
				y1={r.y}
				y2={r.y}
				stroke="var(--oc-wind)"
				stroke-width="2.5"
				stroke-dasharray="7 5"
				stroke-dashoffset={reduced ? 0 : -t * 14 * Math.sign(r.dx)}
				stroke-linecap="round"
			/>
			<path
				d="M{WX + r.dx} {r.y} L{WX + r.dx - Math.sign(r.dx) * 7} {r.y - 4.5} L{WX +
					r.dx -
					Math.sign(r.dx) * 7} {r.y + 4.5} Z"
				fill="var(--oc-wind)"
			/>
		{/if}
	{/each}
	{@render txt(WX + 8, latPx(19) + 4, 'trade winds', 12, {
		weight: 600,
		color: 'var(--oc-wind)'
	})}
	{@render txt(WX - 8, latPx(49) + 4, 'westerlies', 12, {
		anchor: 'end',
		weight: 600,
		color: 'var(--oc-wind)'
	})}
	{@render txt(WX, BYS + 22, '← from the east · from the west →', 11, {
		anchor: 'middle',
		muted: true
	})}

	<!-- ===== basin ===== -->
	<rect
		x={BX0 - 22}
		y={BYN - 4}
		width="22"
		height={BYS - BYN + 8}
		rx="4"
		fill="var(--oc-land)"
		stroke="var(--oc-land-edge)"
	/>
	<rect
		x={BX1}
		y={BYN - 4}
		width="22"
		height={BYS - BYN + 8}
		rx="4"
		fill="var(--oc-land)"
		stroke="var(--oc-land-edge)"
	/>
	{@render txt(BX0 - 7, (BYN + BYS) / 2, 'America', 11, {
		anchor: 'middle',
		muted: true,
		rotate: -90
	})}
	{@render txt(BX1 + 15, (BYN + BYS) / 2, 'Europe · Africa', 11, {
		anchor: 'middle',
		muted: true,
		rotate: 90
	})}
	<rect
		x={BX0}
		y={BYN}
		width={BX1 - BX0}
		height={BYS - BYN}
		fill="var(--oc-sea)"
		stroke="var(--oc-land-edge)"
	/>
	{#each [15, 25, 35, 45, 55, 65] as lat (lat)}
		<line
			x1={BX0}
			x2={BX1}
			y1={latPx(lat)}
			y2={latPx(lat)}
			stroke="var(--stage-grid)"
			opacity={lat === 15 || lat === 65 ? 0 : 0.8}
		/>
		{@render txt(BX1 + 30, latPx(lat) + 4, `${lat}°N`, 11, { muted: true })}
	{/each}
	{@render txt((BX0 + BX1) / 2, BYS + 22, '6,000 km', 11, { anchor: 'middle', muted: true })}

	<g clip-path="url(#gyre-basin)">
		<!-- the hill (and dip) of the sea surface: nested streamlines, filled -->
		{#each loops as L (L.id)}
			<path
				d={L.d}
				fill={L.warm ? 'var(--oc-hill)' : 'var(--oc-dip)'}
				opacity={(L.warm ? 0.16 : 0.12) * hill}
			/>
		{/each}

		<!-- streamlines and particles -->
		{#if flowOn.current > 0.01}
			<g opacity={flowOn.current}>
				{#each loops as L (L.id)}
					<path
						d={L.d}
						fill="none"
						stroke={L.warm ? 'var(--oc-warm)' : 'var(--oc-cold)'}
						stroke-width="1.3"
						opacity="0.55"
					/>
				{/each}
				{#each particles as p (p.id)}
					<circle
						cx={p.x}
						cy={p.y}
						r="2.8"
						fill="var(--oc-flow)"
						stroke="var(--oc-sea)"
						stroke-width="1"
					/>
				{/each}
			</g>
		{/if}

		<!-- wind and Ekman drift at a grid of points -->
		{#if ekmanOn.current > 0.01}
			<g opacity={ekmanOn.current}>
				{#each ekman as e (e.id)}
					{@render arrow(e.x - e.wind / 2, e.y, e.x + e.wind / 2, e.y, 'var(--oc-wind)', 2)}
					{@render arrow(e.x, e.y, e.x, e.y - e.drift, 'var(--oc-ekman)', 2.5)}
				{/each}
			</g>
		{/if}
	</g>

	<!-- labels on the basin -->
	{#if phase === 'ekman'}
		<g opacity={ekmanOn.current}>
			{#if hasWarm && hill > 0.3}
				{@render txt(warmCentre.x + 14, warmCentre.y - 8, 'water piles up:', 13, {
					weight: 600,
					opacity: hill
				})}
				{@render txt(warmCentre.x + 14, warmCentre.y + 8, 'a low hill', 13, {
					weight: 600,
					opacity: hill
				})}
			{/if}
			{#if hasCold && hill > 0.3}
				{@render txt(coldCentre.x + 14, coldCentre.y + 4, 'and a dip', 12, {
					muted: true,
					opacity: hill
				})}
			{/if}
			<g transform="translate({CARD.x + 12} {CARD.y + 3 * 74 + 36})">
				<rect
					x="-12"
					y="-20"
					width={CARD.w}
					height="64"
					rx="12"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				{@render arrow(4, -4, 30, -4, 'var(--oc-wind)', 2)}
				{@render txt(38, 0, 'wind', 12)}
				{@render arrow(17, 30, 17, 8, 'var(--oc-ekman)', 2.5)}
				{@render txt(38, 24, 'drift of the water', 12)}
			</g>
		</g>
	{:else}
		<g opacity={flowOn.current}>
			{#if hasWarm}
				{@render txt(Math.max(warmCentre.x + 10, BX0 + 150), warmCentre.y + 4, 'warm gyre ↻', 13, {
					weight: 600,
					color: 'var(--oc-warm)'
				})}
			{/if}
			{#if hasCold}
				{@render txt(Math.max(coldCentre.x + 10, BX0 + 150), coldCentre.y + 4, 'cold gyre ↺', 13, {
					weight: 600,
					color: 'var(--oc-cold)'
				})}
			{/if}
		</g>
		{#if labelsOn.current > 0.01 && hasWarm}
			<g opacity={labelsOn.current}>
				{#if beta}
					{@render txt(BX0 + 34, latPx(29), 'Gulf Stream:', 13, { weight: 700 })}
					{@render txt(BX0 + 34, latPx(29) + 16, 'narrow and fast', 12, { muted: true })}
					{@render arrow(BX0 + 30, latPx(24), BX0 + 30, latPx(31.5), 'var(--stage-ink)', 2)}
				{/if}
				{@render txt(
					BX0 + 0.62 * (BX1 - BX0),
					latPx(21),
					beta ? 'slow drift south' : 'the same on both sides',
					12,
					{ anchor: 'middle', weight: 600 }
				)}
				{#if beta}
					{@render arrow(
						BX0 + 0.62 * (BX1 - BX0),
						latPx(26),
						BX0 + 0.62 * (BX1 - BX0),
						latPx(22.6),
						'var(--stage-ink)',
						1.6
					)}
				{/if}
			</g>
		{/if}
	{/if}

	<Card x={CARD.x} y={CARD.y} w={CARD.w} {cells} />
</g>
