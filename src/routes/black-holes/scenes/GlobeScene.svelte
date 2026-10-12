<script lang="ts">
	/**
	 * Straight lines on a flat sheet and on a globe. Two travellers start 2 200
	 * km apart (20° of longitude on the equator), both walking due north and
	 * never turning. On the flat sheet they stay 2 200 km apart; on the globe
	 * the gap shrinks as cos(latitude) and they meet at the pole.
	 *
	 * The walk is a pure function of t: 9 s out, 3 s at the end, then again.
	 * Under reduced motion the frame shows them most of the way up.
	 */
	import { clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { t, reduced }: StageProps = $props();

	const R_EARTH_KM = 6371; // mean radius (IUGG)
	const DLON = 20; // degrees between the travellers
	const KM_APART = (R_EARTH_KM * DLON * Math.PI) / 180; // ≈ 2 224 km

	// ---- progress of the walk (0 at the equator, 1 at the pole) ----------------------------
	const WALK = 9;
	const HOLD = 3;
	const u = $derived.by(() => {
		if (reduced) return 0.86;
		const s = cycle(t, WALK + HOLD) * (WALK + HOLD);
		return clamp(s / WALK);
	});
	const lat = $derived(u * 90);

	// ---- the globe ------------------------------------------------------------------------
	const GX = 712;
	const GY = 300;
	const GR = 200;
	const TILT = (24 * Math.PI) / 180; // the pole tipped towards the viewer
	const LON0 = -DLON / 2; // the travellers' longitudes, either side of the front
	const LON1 = DLON / 2;

	function project(latDeg: number, lonDeg: number) {
		const p = (latDeg * Math.PI) / 180;
		const l = (lonDeg * Math.PI) / 180;
		const x = Math.cos(p) * Math.sin(l);
		const y = Math.sin(p);
		const z = Math.cos(p) * Math.cos(l);
		const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
		const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
		return { X: GX + GR * x, Y: GY - GR * y2, front: z2 > 0 };
	}
	/** Path `d` of the visible (front) part of a curve on the globe. */
	function curve(pts: { X: number; Y: number; front: boolean }[]) {
		let d = '';
		let pen = false;
		for (const p of pts) {
			if (!p.front) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${p.X.toFixed(1)} ${p.Y.toFixed(1)}`;
			pen = true;
		}
		return d;
	}
	const range = (a: number, b: number, n: number) =>
		Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
	const meridians = [-80, -60, -40, -20, 0, 20, 40, 60, 80].map((lon) =>
		curve(range(-90, 90, 60).map((la) => project(la, lon)))
	);
	const parallels = [-60, -30, 30, 60].map((la) =>
		curve(range(-180, 180, 90).map((lo) => project(la, lo)))
	);
	const equator = curve(range(-180, 180, 120).map((lo) => project(0, lo)));
	const pole = project(90, 0);

	const trail = (lon: number) => curve(range(0, lat, 40).map((la) => project(la, lon)));
	const a = $derived(project(lat, LON0));
	const b = $derived(project(lat, LON1));
	const gapGlobe = $derived(KM_APART * Math.cos((lat * Math.PI) / 180));
	const met = $derived(u >= 0.999);

	// ---- the flat sheet ----------------------------------------------------------------------
	const FX0 = 32;
	const FX1 = 432;
	const FY0 = 60;
	const FY1 = 500;
	const FCX = (FX0 + FX1) / 2;
	// Same scale as the globe's equator: 20° of longitude is GR·sin(10°)·2 on screen
	// at the front; use the arc length so the walks are equally long.
	const PX_PER_KM = (GR * Math.PI) / 2 / (R_EARTH_KM * (Math.PI / 2)); // the globe's radius scale
	const FLAT_GAP = KM_APART * PX_PER_KM;
	const FLAT_LEN = R_EARTH_KM * (Math.PI / 2) * PX_PER_KM * 1.25; // the sheet is drawn larger
	const flatY = $derived(FY1 - 40 - (FLAT_LEN * u) / 1.25);
	const fa = $derived({ X: FCX - FLAT_GAP / 2, Y: flatY });
	const fb = $derived({ X: FCX + FLAT_GAP / 2, Y: flatY });
	const fy0 = FY1 - 40;

	const fadeMeet = $derived(reduced ? 0 : smoothstep(0.95, 1, u));
</script>

<g>
	<defs>
		<radialGradient id="globe-shade" cx="0.4" cy="0.35" r="0.75">
			<stop offset="0" style:stop-color="var(--sky)" stop-opacity="0.55" />
			<stop offset="1" style:stop-color="var(--sky)" stop-opacity="0.18" />
		</radialGradient>
	</defs>

	<!-- ---- flat sheet ---- -->
	<rect
		x={FX0}
		y={FY0}
		width={FX1 - FX0}
		height={FY1 - FY0}
		rx="12"
		fill="var(--bh-space)"
		stroke="var(--border)"
	/>
	{#each [1, 2, 3, 4, 5, 6, 7] as k (k)}
		<line
			x1={FX0 + (k * (FX1 - FX0)) / 8}
			x2={FX0 + (k * (FX1 - FX0)) / 8}
			y1={FY0 + 8}
			y2={FY1 - 8}
			stroke="var(--stage-grid)"
		/>
	{/each}
	{#each [1, 2, 3, 4, 5, 6, 7, 8] as k (k)}
		<line
			x1={FX0 + 8}
			x2={FX1 - 8}
			y1={FY0 + (k * (FY1 - FY0)) / 9}
			y2={FY0 + (k * (FY1 - FY0)) / 9}
			stroke="var(--stage-grid)"
		/>
	{/each}
	{#each [fa, fb] as w, i (i)}
		<line
			x1={w.X}
			x2={w.X}
			y1={fy0}
			y2={w.Y}
			stroke="var(--bh-light)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<line
			x1={w.X}
			x2={w.X}
			y1={w.Y}
			y2={FY0 + 20}
			stroke="var(--bh-light)"
			stroke-width="1.2"
			stroke-dasharray="4 5"
			opacity="0.5"
		/>
		<circle
			cx={w.X}
			cy={w.Y}
			r="7"
			fill="var(--bh-probe)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}
	<line
		x1={fa.X + 9}
		x2={fb.X - 9}
		y1={flatY}
		y2={flatY}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		marker-end="url(#arrowhead)"
		marker-start="url(#arrowhead)"
		opacity="0.7"
	/>
	<T x={FCX} y={FY0 - 18} text="On a flat sheet" size={15} weight={700} anchor="middle" />
	<T
		x={fb.X + 14}
		y={flatY + 4}
		text="{Math.round(KM_APART).toLocaleString('en').replace(/,/g, ' ')} km"
		size={12.5}
		weight={600}
	/>
	<T
		x={FCX}
		y={fy0 + 26}
		text="start: both head straight up (north)"
		size={12}
		muted
		anchor="middle"
	/>

	<!-- ---- globe ---- -->
	<T x={GX} y={FY0 - 18} text="On a globe" size={15} weight={700} anchor="middle" />
	<circle
		cx={GX}
		cy={GY}
		r={GR}
		fill="url(#globe-shade)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#each meridians as d, i (i)}
		<path {d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="0.8" opacity="0.4" />
	{/each}
	{#each parallels as d, i (i)}
		<path {d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="0.8" opacity="0.4" />
	{/each}
	<path d={equator} fill="none" stroke="var(--stage-ink)" stroke-width="1.4" opacity="0.7" />
	<circle cx={pole.X} cy={pole.Y} r="3.5" fill="var(--stage-ink)" />
	<T x={pole.X + 12} y={pole.Y + 4} text="North Pole" size={12} muted />
	<T x={GX - GR + 6} y={project(0, -80).Y + 24} text="equator" size={12} muted />

	{#each [LON0, LON1] as lon (lon)}
		<path
			d={trail(lon)}
			fill="none"
			stroke="var(--bh-light)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	{/each}
	{#each [a, b] as w, i (i)}
		<circle
			cx={w.X}
			cy={w.Y}
			r="7"
			fill="var(--bh-probe)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}
	{#if !met}
		<line
			x1={a.X + 9}
			x2={b.X - 9}
			y1={(a.Y + b.Y) / 2}
			y2={(a.Y + b.Y) / 2}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity={Math.min(0.7, (b.X - a.X - 18) / 20)}
		/>
		<T
			x={b.X + 14}
			y={b.Y + 4}
			text="{Math.round(gapGlobe).toLocaleString('en').replace(/,/g, ' ')} km"
			size={12.5}
			weight={600}
		/>
	{/if}
	{#if met || reduced}
		<T
			x={pole.X}
			y={pole.Y - 16}
			text="they meet here"
			size={13}
			weight={700}
			anchor="middle"
			opacity={reduced ? 1 : fadeMeet}
		/>
	{/if}

	<!-- ---- the point ---- -->
	<Card x={150} y={524} w={660} h={60} />
	<T
		x={480}
		y={548}
		text="Neither traveller ever turns. On the globe they meet anyway:"
		size={13.5}
		weight={600}
		anchor="middle"
	/>
	<T
		x={480}
		y={570}
		text="no force pulls them together — the surface is curved."
		size={13.5}
		anchor="middle"
	/>
</g>
