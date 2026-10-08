<script lang="ts">
	/**
	 * The general circulation in the textbook layout: a globe seen from the
	 * equator's plane (north up, east to the right) with, on its right-hand limb,
	 * a cross-section of the atmosphere (height hugely exaggerated) showing the
	 * convection cells of each hemisphere as loops of moving chevrons. On the
	 * globe's face, arrows show the wind at the ground in each band.
	 *
	 * Phases (`step.hints.phase`):
	 *   convection — Halley's 1686 picture: spin from `hints.spin` (0), one cell
	 *                per hemisphere, wind from pole to equator everywhere.
	 *   cells      — spin from `params.spin`: `cells(spin)` bands, trade winds,
	 *                westerlies, polar easterlies.
	 *
	 * Smoothness: `cells()` changes its number of cells in jumps, so instead of
	 * tweening the spin and recomputing the cells, the cell boundaries are kept
	 * as a fixed-length array (padded with 90°) and that array is tweened: new
	 * cells grow out of the pole, vanishing ones shrink into it, and each loop
	 * fades with its width. The spin itself is tweened separately for the
	 * deflection of the surface winds.
	 *
	 * The deflection angle of the surface wind from the north–south direction is
	 * a sketch, atan(1.3 × spin): about 50° at Earth's spin (trade winds from the
	 * north-east in the north, south-east in the south), 0 without spin.
	 *
	 * The globe is coloured by today's yearly average temperature (the energy-
	 * balance model at D_EARTH), on the same cold → neutral → warm scale as
	 * BalanceScene, so the globe the reader has just seen carries on here.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, along, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { D_EARTH, cells, climate, hadleyEdge, tempAt } from '../atmosphere';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- geometry -------------------------------------------------------------------
	const CX = 362;
	const CY = 300;
	const R = 196; // globe
	const H = 62; // atmosphere shell thickness (hugely exaggerated)
	const R_IN = R + 9; // loops: inner (ground) and outer (aloft) radii
	const R_OUT = R + H - 8;
	const R_LABEL = R + H + 12;
	const MAX_B = 11; // boundaries: 0, then up to 9 cell edges at spin 3, padded with 90
	const rad = (d: number) => (d * Math.PI) / 180;
	/** Point on the right-hand limb at latitude `lat` (°) and radius `r`. */
	const limb = (lat: number, r: number): Point => ({
		x: CX + r * Math.cos(rad(lat)),
		y: CY - r * Math.sin(rad(lat))
	});
	/** Point on the globe's face (orthographic, seen from latitude 0, longitude 0). */
	const face = (lat: number, lon: number): Point => ({
		x: CX + R * Math.cos(rad(lat)) * Math.sin(rad(lon)),
		y: CY - R * Math.sin(rad(lat))
	});

	// ---- spin: the target, and its tweens --------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'cells'));
	const target = $derived(
		phase === 'convection' ? Number(step.hints?.spin ?? 0) : Number(params.spin ?? 1)
	);
	const boundsFor = (s: number) => {
		const out = [0, ...cells(s).map((c) => c.to)];
		while (out.length < MAX_B) out.push(90);
		return out.slice(0, MAX_B);
	};
	const targetBounds = $derived(boundsFor(target));
	// Cells narrower than 3° (a sliver at the pole just as a new cell appears) are not drawn, so not counted.
	const count = $derived(cells(target).filter((c) => c.to - c.from >= 3).length);
	const edge = $derived(hadleyEdge(target));

	const spinT = new Tween(
		untrack(() => target),
		{ duration: 800, easing: cubicInOut }
	);
	const boundsT = new Tween(
		untrack(() => targetBounds),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const s = target;
		const b = targetBounds;
		const d = reduced ? 0 : 800;
		untrack(() => {
			spinT.set(s, { duration: d });
			boundsT.set(b, { duration: d });
		});
	});

	// Deflection of the surface wind from the meridian (a sketch).
	const deflect = (s: number) => Math.atan(1.3 * s);

	// ---- the cells (northern hemisphere; mirrored for the south) -----------------------
	interface Band {
		k: number;
		from: number;
		to: number;
		direct: boolean;
		fade: number;
	}
	const bands = $derived.by(() => {
		const b = boundsT.current;
		const out: Band[] = [];
		for (let k = 0; k < MAX_B - 1; k++) {
			const w = b[k + 1] - b[k];
			const fade = smoothstep(2.5, 7, w);
			if (fade <= 0.001) continue;
			out.push({ k, from: b[k], to: b[k + 1], direct: k % 2 === 0, fade });
		}
		return out;
	});
	const hEdge = $derived(boundsT.current[1]); // tweened Hadley edge

	/**
	 * A loop in the shell as a rounded rectangle in (latitude, radius), traversed
	 * so that a direct cell rises at its equatorward edge, flows poleward aloft,
	 * sinks and returns along the ground; an indirect cell the other way.
	 */
	function loop(a: number, b: number, direct: boolean, south: boolean): Point[] {
		// Work in (s, r): s = arc length (px) along the middle of the shell.
		const rm = (R_IN + R_OUT) / 2;
		const inset = Math.min(1.8, 0.14 * (b - a));
		const s0 = rad(a + inset) * rm;
		const s1 = rad(b - inset) * rm;
		const r0 = R_IN;
		const r1 = R_OUT;
		const c = Math.min(10, (s1 - s0) / 2, (r1 - r0) / 2);
		const raw: [number, number][] = [];
		const edge = (sa: number, ra: number, sb: number, rb: number) => {
			const n = Math.max(1, Math.ceil(Math.hypot(sb - sa, rb - ra) / 6));
			for (let i = 0; i < n; i++) raw.push([sa + ((sb - sa) * i) / n, ra + ((rb - ra) * i) / n]);
		};
		const corner = (cs: number, cr: number, from: number) => {
			for (let i = 0; i < 6; i++) {
				const ang = rad(from + i * 15);
				raw.push([cs + c * Math.cos(ang), cr + c * Math.sin(ang)]);
			}
		};
		// Anticlockwise in (s right, r up): up the poleward side, equatorward aloft,
		// down the equatorward side, poleward along the ground — an indirect cell.
		edge(s1, r0 + c, s1, r1 - c);
		corner(s1 - c, r1 - c, 0);
		edge(s1 - c, r1, s0 + c, r1);
		corner(s0 + c, r1 - c, 90);
		edge(s0, r1 - c, s0, r0 + c);
		corner(s0 + c, r0 + c, 180);
		edge(s0 + c, r0, s1 - c, r0);
		corner(s1 - c, r0 + c, 270);
		raw.push(raw[0]);
		if (direct) raw.reverse(); // a direct cell rises at its equatorward side
		return raw.map(([sv, r]) => {
			const lat = ((sv / rm) * 180) / Math.PI;
			return limb(south ? -lat : lat, r);
		});
	}
	const pathOf = (pts: Point[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z';

	const FLOW_SPEED = 34; // px/s along the loops
	const CHEVRON_GAP = 34;
	const loops = $derived(
		bands.flatMap((band) =>
			[false, true].map((south) => {
				const pts = loop(band.from, band.to, band.direct, south);
				let len = 0;
				for (let i = 1; i < pts.length; i++)
					len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
				return { key: `${band.k}-${south ? 's' : 'n'}`, band, pts, len, d: pathOf(pts) };
			})
		)
	);
	const tt = $derived(reduced ? 2.5 : t);
	const chevrons = $derived(
		loops.flatMap((l) => {
			const n = Math.max(2, Math.floor(l.len / CHEVRON_GAP));
			return Array.from({ length: n }, (_, j) => {
				const u = (((j * l.len) / n + tt * FLOW_SPEED) % l.len) / l.len;
				const p = along(l.pts, u);
				return {
					key: `${l.key}-${j}`,
					x: p.x,
					y: p.y,
					angle: (p.angle * 180) / Math.PI,
					fade: l.band.fade
				};
			});
		})
	);

	// ---- names ---------------------------------------------------------------------------
	const EARTH_NAMES = ['Hadley cell', 'Ferrel cell', 'polar cell'];
	const EARTH_WINDS = ['trade winds', 'westerlies', 'polar easterlies'];
	const cellName = (k: number) =>
		phase === 'convection'
			? 'convection cell'
			: count === 3
				? EARTH_NAMES[k]
				: k === 0
					? 'Hadley cell'
					: `cell ${k + 1}`;
	const COMPASS = [
		'north',
		'north-north-east',
		'north-east',
		'east-north-east',
		'east',
		'east-south-east',
		'south-east',
		'south-south-east',
		'south',
		'south-south-west',
		'south-west',
		'west-south-west',
		'west',
		'west-north-west',
		'north-west',
		'north-north-west'
	];
	/** Where the wind comes from, for a wind blowing towards (east, north). */
	const fromDir = (u: number, v: number) => {
		const deg = ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
		return COMPASS[Math.round(deg / 22.5) % 16];
	};
	/** Surface wind (east, north components, unit length) in a band of a hemisphere. */
	const surfaceWind = (direct: boolean, south: boolean, s: number) => {
		const th = deflect(s);
		const u = (direct ? -1 : 1) * Math.sin(th); // easterly in direct cells, westerly in indirect
		const v = (direct ? -1 : 1) * Math.cos(th) * (south ? -1 : 1); // to / from the equator
		return { u, v };
	};
	const windName = (k: number, direct: boolean) => {
		if (target === 0) return { name: 'wind at the ground', sub: 'blows towards the equator' };
		const w = surfaceWind(direct, false, target);
		const name =
			count === 3 ? EARTH_WINDS[k] : k === 0 ? 'trade winds' : direct ? 'easterlies' : 'westerlies';
		return { name, sub: `from ${fromDir(w.u, w.v)}` };
	};

	// Labels beside the globe, greedily dropped when they would collide.
	interface Tag {
		key: string;
		x: number;
		y: number;
		text: string;
		sub?: string;
		anchor: 'start' | 'end';
		fade: number;
	}
	const box = (g: Tag) => {
		const w = Math.max(g.text.length * 12 * 0.56, (g.sub?.length ?? 0) * 11 * 0.55);
		const x0 = g.anchor === 'start' ? g.x : g.x - w;
		return [x0 - 4, g.y - 13, x0 + w + 4, g.y + (g.sub ? 18 : 4)];
	};
	const overlaps = (a: Tag, b: Tag) => {
		const [a0, a1, a2, a3] = box(a);
		const [b0, b1, b2, b3] = box(b);
		return a0 < b2 && b0 < a2 && a1 < b3 && b1 < a3;
	};
	/**
	 * Keep labels from the equator outwards and stop at the first that would
	 * collide, so the labelled bands are always consecutive (dropping one in the
	 * middle would make two easterly bands look like neighbours). A collision
	 * with the fixed equator label only skips that one tag.
	 */
	const greedy = (tags: Tag[]) => {
		const kept: Tag[] = [];
		for (const g of tags) {
			const hit = kept.filter((o) => overlaps(o, g));
			if (!hit.length) kept.push(g);
			else if (hit.some((o) => o.key !== 'eq')) break;
		}
		return kept;
	};
	const cellTags = $derived(
		greedy(
			bands
				.filter((b) => b.k < count)
				.map((b) => {
					const p = limb((b.from + b.to) / 2, R_LABEL);
					return {
						key: `c${b.k}`,
						x: p.x,
						y: p.y + 4,
						text: cellName(b.k),
						anchor: 'start' as const,
						fade: b.fade
					};
				})
		)
	);
	const windTags = $derived(
		greedy([
			{ key: 'eq', x: CX - R - 10, y: CY + 16, text: 'equator', anchor: 'end' as const, fade: 1 },
			...bands
				.filter((b) => b.k < count)
				.map((b) => {
					const m = rad((b.from + b.to) / 2);
					const wn = windName(b.k, b.direct);
					return {
						key: `w${b.k}`,
						x: CX - (R + 10) * Math.cos(m),
						y: CY - (R + 10) * Math.sin(m) - 2,
						text: wn.name,
						sub: wn.sub,
						anchor: 'end' as const,
						fade: b.fade
					};
				})
		]).filter((g) => g.key !== 'eq')
	);

	// ---- surface wind arrows on the face ---------------------------------------------------
	const LONS: Record<number, number[]> = {
		1: [-6],
		2: [-30, 26],
		3: [-50, -10, 30],
		4: [-56, -14, 24, 58]
	};
	const ARROW = 24;
	const arrows = $derived.by(() => {
		const s = spinT.current;
		const out: { key: string; x1: number; y1: number; x2: number; y2: number; op: number }[] = [];
		for (const b of bands) {
			const latA = Math.min(89, (b.from + b.to) / 2);
			const bandPx = R * (Math.sin(rad(b.to)) - Math.sin(rad(b.from)));
			const fit = smoothstep(10, 18, bandPx);
			if (fit <= 0.01) continue;
			const n = Math.max(1, Math.min(4, Math.round(4.4 * Math.cos(rad(latA)))));
			for (const south of [false, true]) {
				const lat = south ? -latA : latA;
				const { u, v } = surfaceWind(b.direct, south, s);
				LONS[n].forEach((lon, i) => {
					const c = face(lat, lon);
					// projected direction of (east u, north v) at (lat, lon)
					let dx = u * Math.cos(rad(lon)) - v * Math.sin(rad(lat)) * Math.sin(rad(lon));
					let dy = -v * Math.cos(rad(lat));
					const m = Math.hypot(dx, dy) || 1;
					dx /= m;
					dy /= m;
					const ph = reduced ? 0.5 : cycle(t, 2.6, (i * 0.37 + b.k * 0.21 + (south ? 0.5 : 0)) % 1);
					const shift = (ph - 0.5) * 10;
					const op = (0.75 + 0.25 * Math.sin(Math.PI * ph)) * b.fade * fit;
					out.push({
						key: `${b.k}-${south ? 's' : 'n'}-${i}`,
						x1: c.x + dx * (shift - ARROW / 2),
						y1: c.y + dy * (shift - ARROW / 2),
						x2: c.x + dx * (shift + ARROW / 2),
						y2: c.y + dy * (shift + ARROW / 2),
						op
					});
				});
			}
		}
		return out;
	});

	// Cell boundaries drawn across the face (between bands).
	const edges = $derived(
		bands
			.filter((b) => b.k > 0)
			.flatMap((b) =>
				[1, -1].map((sgn) => {
					const lat = sgn * b.from;
					const half = R * Math.cos(rad(lat));
					return {
						key: `${b.k}${sgn}`,
						x1: CX - half,
						x2: CX + half,
						y: CY - R * Math.sin(rad(lat)),
						op: b.fade
					};
				})
			)
	);

	// ---- weather cues ------------------------------------------------------------------------
	const CLOUD = 'M-15 2 a6 6 0 0 1 3 -10 a8 8 0 0 1 14 -3 a6 6 0 0 1 11 5 a5 5 0 0 1 2 8 Z';
	const clouds = [-34, 4, 42].map((lon) => face(0, lon));
	const rain = $derived(
		clouds.flatMap((c, i) =>
			[-6, 0, 6].map((dx, j) => {
				const ph = reduced ? 0.45 : cycle(t, 0.9, (j * 0.33 + i * 0.17) % 1);
				return {
					key: `${i}-${j}`,
					x: c.x + dx,
					y: c.y + 4 + ph * 12,
					op: Math.sin(Math.PI * ph) * 0.85
				};
			})
		)
	);
	const desertOp = $derived(smoothstep(55, 45, hEdge));
	const desertN = $derived(face(hEdge, -24));
	const desertS = $derived(face(-hEdge, -24));

	// ---- readouts ------------------------------------------------------------------------------
	const edgeText = $derived(
		edge >= 87.5
			? phase === 'convection'
				? 'One cell, equator to pole'
				: 'Hadley cell reaches the pole'
			: `Hadley cell reaches ~${Math.round(edge / 5) * 5}°`
	);
	const countText = $derived(`${count} cell${count === 1 ? '' : 's'} in each hemisphere`);
	const dayText = $derived(
		target <= 0
			? 'Day length: no spin'
			: `Day length: ${(24 / target).toFixed(target === 1 ? 0 : 1)} hours`
	);

	// ---- globe colour: today's temperatures, BalanceScene's scale ------------------------
	const earth = climate(D_EARTH);
	function tempColor(T: number) {
		const u = Math.max(-1, Math.min(1, T / 35));
		const p = Math.round(Math.abs(u) * 100);
		return u < 0
			? `color-mix(in oklab, var(--atm-cold) ${p}%, var(--atm-neutral))`
			: `color-mix(in oklab, var(--atm-warm) ${p}%, var(--atm-neutral))`;
	}
	const globeStops = Array.from({ length: 17 }, (_, i) => {
		const off = i / 16;
		const lat = (Math.asin(1 - 2 * off) * 180) / Math.PI;
		return { i, off, color: tempColor(tempAt(earth, lat)) };
	});

	const PANEL_X = 694;
	const PANEL_W = 250;

	// The shell: the right half of an annulus.
	const shell = `M${CX} ${CY - R - H} A${R + H} ${R + H} 0 0 1 ${CX} ${CY + R + H} L${CX} ${CY + R} A${R} ${R} 0 0 0 ${CX} ${CY - R} Z`;
	const sinkLabel = $derived(limb(-Math.min(hEdge, 86), R_LABEL));
	const HALLEY_NOTE = [
		'No spin: one cell in each',
		'hemisphere. Air rises at the',
		'equator and sinks at the poles; at',
		'the ground the wind blows from',
		'the pole to the equator everywhere.',
		'Hadley (1735) added the spin to',
		'explain the easterly trade winds,',
		'but still drew a single cell.'
	];
</script>

<g>
	<defs>
		<linearGradient
			id="cells-globe"
			x1="0"
			y1={CY - R}
			x2="0"
			y2={CY + R}
			gradientUnits="userSpaceOnUse"
		>
			{#each globeStops as st (st.i)}
				<stop offset={st.off} style:stop-color={st.color} />
			{/each}
		</linearGradient>
	</defs>

	<!-- atmosphere shell on the right-hand limb -->
	<path d={shell} fill="var(--atm-space)" stroke="var(--stage-line)" stroke-width="1" />

	<!-- globe -->
	<circle
		cx={CX}
		cy={CY}
		r={R}
		fill="url(#cells-globe)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#each [30, 60] as lon (lon)}
		{@const rx = R * Math.sin(rad(lon))}
		<path
			d={`M${CX} ${CY - R} A${rx} ${R} 0 0 0 ${CX} ${CY + R} M${CX} ${CY - R} A${rx} ${R} 0 0 1 ${CX} ${CY + R}`}
			fill="none"
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
	{/each}
	<line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="var(--stage-grid)" stroke-width="1" />
	{#each [-60, -30, 30, 60] as lat (lat)}
		{@const half = R * Math.cos(rad(lat))}
		<line
			x1={CX - half}
			x2={CX + half}
			y1={CY - R * Math.sin(rad(lat))}
			y2={CY - R * Math.sin(rad(lat))}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
	{/each}
	<line
		x1={CX - R}
		x2={CX + R}
		y1={CY}
		y2={CY}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.6"
	/>

	<!-- cell boundaries on the face -->
	{#each edges as e (e.key)}
		<line
			x1={e.x1}
			x2={e.x2}
			y1={e.y}
			y2={e.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="5 4"
			opacity={0.75 * e.op}
		/>
	{/each}

	<!-- rising air at the equator: clouds and rain -->
	{#each rain as d (d.key)}
		<line
			x1={d.x}
			y1={d.y}
			x2={d.x - 1.5}
			y2={d.y + 5}
			stroke="var(--atm-cold)"
			stroke-width="1.5"
			stroke-linecap="round"
			opacity={d.op}
		/>
	{/each}
	{#each clouds as c, i (i)}
		<path
			d={CLOUD}
			transform="translate({c.x} {c.y})"
			fill="var(--atm-cloud)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
	{/each}

	<!-- sinking air near the Hadley cell's edge: clear skies, deserts -->
	{#if desertOp > 0.01}
		<g opacity={desertOp}>
			{#each [desertN, desertS] as p, i (i)}
				<g transform="translate({p.x - 30} {p.y})">
					<circle r="5" fill="var(--atm-sun)" />
					{#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
						<line
							x1={7 * Math.cos(rad(a))}
							y1={7 * Math.sin(rad(a))}
							x2={10 * Math.cos(rad(a))}
							y2={10 * Math.sin(rad(a))}
							stroke="var(--atm-sun)"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					{/each}
				</g>
			{/each}
			<Label x={desertN.x - 14} y={desertN.y + 4} text="deserts" size={11} anchor="start" pill />
		</g>
	{/if}

	<!-- surface winds -->
	{#each arrows as a (a.key)}
		<line
			x1={a.x1}
			y1={a.y1}
			x2={a.x2}
			y2={a.y2}
			stroke="var(--atm-wind)"
			stroke-width="2.2"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
			opacity={a.op}
		/>
	{/each}

	<!-- the cells -->
	{#each loops as l (l.key)}
		<path
			d={l.d}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			opacity={0.55 * l.band.fade}
		/>
	{/each}
	{#each chevrons as c (c.key)}
		<path
			d="M-4 -4 L3 0 L-4 4"
			transform="translate({c.x} {c.y}) rotate({c.angle})"
			fill="none"
			stroke="var(--atm-wind)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={c.fade}
		/>
	{/each}

	<!-- labels -->
	{#each cellTags as g (g.key)}
		{@render txt(g.x, g.y, g.text, 13, { anchor: g.anchor, weight: 600, opacity: g.fade })}
	{/each}
	{#each windTags as g (g.key)}
		{@render txt(g.x, g.y, g.text, 12, { anchor: g.anchor, weight: 600, opacity: g.fade })}
		{#if g.sub}
			{@render txt(g.x, g.y + 14, g.sub, 11, { anchor: g.anchor, muted: true, opacity: g.fade })}
		{/if}
	{/each}
	{@render txt(CX - R - 10, CY + 16, 'equator', 11, { anchor: 'end', muted: true })}
	{@render txt(CX + R + H + 8, CY - 4, 'warm air', 11, { muted: true })}
	{@render txt(CX + R + H + 8, CY + 10, 'rises', 11, { muted: true })}
	{#if hEdge < 88}
		{@render txt(sinkLabel.x, sinkLabel.y + 8, 'cool, dry air sinks', 11, {
			muted: true,
			opacity: smoothstep(88, 80, hEdge)
		})}
	{/if}
	{@render txt(CX - 8, CY - R - H + 10, 'north pole', 11, { anchor: 'end', muted: true })}

	<!-- readout -->
	<g transform="translate({PANEL_X} 28)">
		<rect width={PANEL_W} height="96" rx="10" fill="var(--surface)" stroke="var(--border)" />
		{@render txt(14, 28, edgeText, 15, { weight: 600, tabular: true })}
		{@render txt(14, 54, countText, 13, { tabular: true })}
		{@render txt(14, 78, dayText, 13, { tabular: true })}
	</g>

	{#if phase === 'convection'}
		<g transform="translate({PANEL_X} 140)">
			<rect width={PANEL_W} height="198" rx="10" fill="var(--surface)" stroke="var(--border)" />
			{@render txt(14, 26, "Halley's picture, 1686", 14, { weight: 600 })}
			{#each HALLEY_NOTE as line, i (i)}
				{@render txt(14, 50 + i * 17 + (i >= 5 ? 8 : 0), line, 12, { muted: i >= 5 })}
			{/each}
		</g>
	{/if}

	<!-- legend -->
	<g transform="translate({PANEL_X} 486)">
		<path
			d="M4 8 L11 12 L4 16"
			fill="none"
			stroke="var(--atm-wind)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		{@render txt(26, 16, 'air flow in the cells', 12)}
		{@render txt(26, 31, '(height exaggerated ~50×)', 11, { muted: true })}
		<line
			x1="0"
			y1="52"
			x2="16"
			y2="52"
			stroke="var(--atm-wind)"
			stroke-width="2.2"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
		{@render txt(26, 56, 'wind at the ground', 12)}
		<path
			d={CLOUD}
			transform="translate(10 84) scale(0.65)"
			fill="var(--atm-cloud)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
		/>
		{@render txt(26, 82, 'rising air: clouds and rain', 12)}
	</g>
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
