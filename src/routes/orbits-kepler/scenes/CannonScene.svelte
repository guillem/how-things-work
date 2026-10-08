<script lang="ts">
	/**
	 * Newton's cannon: a cannon on a mountain 300 km high fires a ball sideways at
	 * `params.cannonSpeed` km/s (no air). The path comes from `cannon()` in the
	 * model (Newton's gravity, step by step) and is drawn growing over time, the
	 * ball moving at its true relative pace (fastest low down). Faint ghost paths
	 * for 5, 7, 7.9 and 10 km/s show the family of curves Newton drew.
	 *
	 * Drawing: the Earth to scale, but heights above the ground are exaggerated
	 * near the ground (the first 300 km take ~32 px instead of ~8 px; see
	 * `toScreen`) so the mountain and a low orbit are visible. Angles are true.
	 *
	 * Each flight lasts 2.5–9 s on screen (longer flights take longer), then the
	 * result is held for a moment and the flight repeats. A new speed restarts the
	 * flight (the frame-to-frame memo sanctioned by the scene guide, as in
	 * newtons-laws/scenes/TrackScene.svelte).
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { cannon, EARTH_RADIUS_KM, lowOrbitSpeed, SURFACE_G } from '../orbits';

	let { t, params, reduced }: StageProps = $props();

	// ---- geometry ---------------------------------------------------------------
	const PANEL = { x: 16, y: 16, w: 584, h: 568 };
	const CX = 308;
	const CY = 300;
	const R = 205; // Earth's radius, px
	const KM = R / EARTH_RADIUS_KM; // px per km (true scale)
	const H = 300; // mountain height, km
	const LIFT = 24; // extra px given to the first ~300 km of height
	const T1 = Math.tanh(1);
	const lift = (alt: number) => alt * KM + (LIFT * Math.tanh(alt / H)) / T1;
	const TOP = R + lift(H); // the mountain's peak, px from the centre

	interface Pt {
		x: number;
		y: number;
	}
	/** Model km (Earth's centre at the origin, y up) → screen px. */
	function toScreen(p: Pt): Pt {
		const r = Math.hypot(p.x, p.y);
		const rp = R + lift(Math.max(0, r - EARTH_RADIUS_KM));
		return { x: CX + (p.x / r) * rp, y: CY - (p.y / r) * rp };
	}
	const inPanel = (p: Pt) =>
		p.x > PANEL.x - 30 &&
		p.x < PANEL.x + PANEL.w + 30 &&
		p.y > PANEL.y - 30 &&
		p.y < PANEL.y + PANEL.h + 30;

	const GM = SURFACE_G * (EARTH_RADIUS_KM * 1000) ** 2; // m³/s²
	const R0 = (EARTH_RADIUS_KM + H) * 1000; // m
	const ESCAPE = Math.sqrt((2 * GM) / R0) / 1000; // km/s at the mountain top
	const LOW = lowOrbitSpeed();

	type Outcome = 'lands' | 'orbit' | 'loop' | 'escapes';
	interface Flight {
		v: number;
		pts: Pt[];
		/** Cumulative drawn length at each point (px). */
		len: number[];
		/** Seconds of real flight per point. */
		dt: number;
		outcome: Outcome;
		seconds: number;
		/** Closest approach to the ground for bound orbits, farthest point (km). */
		apogeeKm: number;
	}

	function fly(v: number): Flight {
		const vm = v * 1000;
		const inv = 2 / R0 - (vm * vm) / GM;
		const bound = inv > 0;
		const period = bound ? 2 * Math.PI * Math.sqrt((1 / inv) ** 3 / GM) : Infinity;
		const res = cannon(v, H, bound ? Math.min(period + 10, 40_000) : 15_000, 5);
		let rmax = 0;
		const pts: Pt[] = [];
		let leftPanel = false;
		for (const p of res.path) {
			rmax = Math.max(rmax, Math.hypot(p.x, p.y));
			const s = toScreen(p);
			pts.push(s);
			if (!inPanel(s)) {
				leftPanel = true;
				break;
			}
		}
		// Keep ≤ ~500 points for drawing (the path is redrawn every frame).
		const stride = Math.max(1, Math.ceil(pts.length / 500));
		const kept: Pt[] = [];
		for (let i = 0; i < pts.length; i += stride) kept.push(pts[i]);
		if (kept[kept.length - 1] !== pts[pts.length - 1]) kept.push(pts[pts.length - 1]);
		const len = [0];
		for (let i = 1; i < kept.length; i++)
			len.push(len[i - 1] + Math.hypot(kept[i].x - kept[i - 1].x, kept[i].y - kept[i - 1].y));
		const outcome: Outcome = res.hit ? 'lands' : !bound ? 'escapes' : leftPanel ? 'loop' : 'orbit';
		return {
			v,
			pts: kept,
			len,
			dt: res.dt * stride,
			outcome,
			seconds: (pts.length - 1) * res.dt,
			apogeeKm: rmax - EARTH_RADIUS_KM
		};
	}
	const pathD = (pts: Pt[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');

	// Ghost paths: the family Newton drew. (The mountain's right side is a steep
	// cliff so that even a 2 km/s ball, landing ~5° away, clears it.)
	const GHOSTS = [5, 7, 7.9, 10].map((v) => {
		const f = fly(v);
		// Label: at the landing point; for orbits beside the path, round the far right.
		let at = f.pts[f.pts.length - 1];
		let lx: number;
		let ly: number;
		if (f.outcome === 'lands') {
			const ang = Math.atan2(at.y - CY, at.x - CX);
			lx = at.x + Math.cos(ang) * 16;
			ly = at.y + Math.sin(ang) * 16 + 4;
		} else if (v > 9) {
			at = f.pts.find((p) => p.x > CX + 215) ?? at;
			lx = at.x;
			ly = at.y - 10;
		} else {
			at = f.pts.find((p) => Math.atan2(p.x - CX, CY - p.y) > 1.75) ?? at;
			lx = at.x + 8;
			ly = at.y + 4;
		}
		return {
			v,
			d: pathD(f.pts),
			lx,
			ly,
			anchor: v > 9 ? 'middle' : 'start'
		};
	});

	// ---- the current flight -----------------------------------------------------
	const speed = $derived(clamp(Number(params.cannonSpeed ?? 5), 2, 12));
	const flight = $derived(fly(speed));
	const flyFor = $derived(clamp(2 + 5 * Math.sqrt(flight.seconds / 5400), 2.5, 9));
	const HOLD = 2.4;

	let memo = { key: -1, start: 0 };
	const since = $derived.by(() => {
		if (memo.key !== speed || t < memo.start) memo = { key: speed, start: memo.key < 0 ? 0 : t };
		return t - memo.start;
	});
	const local = $derived(reduced ? flyFor + HOLD / 2 : since % (flyFor + HOLD));
	const u = $derived(clamp(local / flyFor));
	const landed = $derived(local - flyFor); // seconds since the flight ended (< 0: in flight)

	const ball = $derived.by(() => {
		const n = flight.pts.length;
		const f = u * (n - 1);
		const i = Math.min(n - 2, Math.floor(f));
		const w = f - i;
		const a = flight.pts[Math.max(0, i)];
		const b = flight.pts[Math.min(n - 1, i + 1)];
		return {
			x: a.x + (b.x - a.x) * w,
			y: a.y + (b.y - a.y) * w,
			drawn: flight.len[Math.max(0, i)] + (flight.len[i + 1] - flight.len[i]) * w,
			secs: f * flight.dt
		};
	});
	const total = $derived(flight.len[flight.len.length - 1]);
	const lastPt = $derived(flight.pts[flight.pts.length - 1]);

	const minutes = (s: number) =>
		s < 3600
			? `${Math.round(s / 60)} min`
			: `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`;

	const outcomeText = $derived(
		flight.outcome === 'lands'
			? `lands after ${minutes(flight.seconds)}`
			: flight.outcome === 'orbit'
				? 'falls all the way round — an orbit'
				: flight.outcome === 'loop'
					? 'a long loop: still an orbit, swinging far out'
					: 'escapes — it never comes back'
	);
	const outcomeShown = $derived(reduced || landed > 0 || flight.outcome === 'escapes' ? 1 : 0);
	const puff = $derived(flight.outcome === 'lands' && landed > 0 ? clamp(landed / 0.9) : 0);

	// Landing puff: a few small circles that swell and fade.
	const PUFF = [
		{ dx: 0, dy: 0, r: 7 },
		{ dx: -9, dy: 3, r: 5 },
		{ dx: 9, dy: 3, r: 5 },
		{ dx: -4, dy: -6, r: 5 },
		{ dx: 5, dy: -7, r: 4 }
	];
	const puffRot = $derived(Math.atan2(lastPt.y - CY, lastPt.x - CX) + Math.PI / 2);

	// Earth's land: a few soft blobs, clipped to the disc.
	const LAND = [
		{ x: -60, y: -40, rx: 70, ry: 44, rot: -20 },
		{ x: 70, y: 60, rx: 54, ry: 70, rot: 15 },
		{ x: -40, y: 110, rx: 46, ry: 28, rot: 10 },
		{ x: 95, y: -95, rx: 40, ry: 26, rot: 30 }
	];

	// Card on the right.
	const CARD = { x: 616, y: 16, w: 328, h: 568 };
	const CL = CARD.x + 20;
	const bx = (v: number) => CL + ((v - 2) / 10) * (CARD.w - 40);
	// Inset: 8 km of level line against the curving ground (drop exaggerated).
	const INSET = { x: CL + 6, y: 412, w: 268, drop: 36 };
	const insetGround = (() => {
		let d = '';
		for (let i = 0; i <= 24; i++) {
			const f = i / 24;
			d += `${i ? 'L' : 'M'}${(INSET.x + f * INSET.w).toFixed(1)} ${(INSET.y + INSET.drop * f * f).toFixed(1)}`;
		}
		return d;
	})();
</script>

<g>
	<defs>
		<clipPath id="cannon-panel">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="14" />
		</clipPath>
		<clipPath id="cannon-earth">
			<circle cx={CX} cy={CY} r={R} />
		</clipPath>
	</defs>

	<!-- space panel -->
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>

	<g clip-path="url(#cannon-panel)">
		<!-- the Earth -->
		<circle cx={CX} cy={CY} r={R} fill="var(--sky-ocean)" />
		<g clip-path="url(#cannon-earth)">
			{#each LAND as l, i (i)}
				<ellipse
					cx={CX + l.x}
					cy={CY + l.y}
					rx={l.rx}
					ry={l.ry}
					transform="rotate({l.rot} {CX + l.x} {CY + l.y})"
					fill="var(--sky-land)"
				/>
			{/each}
		</g>
		<circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--stage-line)" stroke-width="1" />

		<!-- ghost paths -->
		{#each GHOSTS as g (g.v)}
			<path
				d={g.d}
				fill="none"
				stroke="var(--orb-path)"
				stroke-width="1.2"
				stroke-dasharray="4 5"
				opacity={Math.abs(g.v - speed) < 0.05 ? 0 : 0.45}
			/>
		{/each}

		<!-- the current path, growing -->
		<path
			d={pathD(flight.pts)}
			fill="none"
			stroke="var(--orb-planet)"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-dasharray="{ball.drawn.toFixed(1)} {(total + 10).toFixed(1)}"
		/>
	</g>

	<!-- ghost labels (outside the clip so they stay whole) -->
	{#each GHOSTS as g (g.v)}
		{#if Math.abs(g.v - speed) >= 0.05 && g.ly > PANEL.y + 12 && g.ly < PANEL.y + PANEL.h - 4}
			{@render txt(g.lx, g.ly, `${g.v} km/s`, 11, {
				muted: true,
				anchor: g.anchor
			})}
		{/if}
	{/each}

	<!-- mountain and cannon -->
	<path
		d="M{CX - 60} {CY - R + 12} L{CX - 6} {CY - TOP + 3} L{CX + 5} {CY - TOP + 3} L{CX + 9} {CY -
			R +
			4} Z"
		fill="var(--sky-land)"
		stroke="var(--stage-ink-muted)"
		stroke-opacity="0.5"
		stroke-linejoin="round"
	/>
	<path
		d="M{CX - 20} {CY - TOP + 12} L{CX - 6} {CY - TOP + 3} L{CX + 4} {CY - TOP + 10}"
		fill="none"
		stroke="var(--surface)"
		stroke-width="3"
		stroke-linecap="round"
		opacity="0.7"
	/>
	<g transform="translate({CX} {CY - TOP})">
		<rect x="-9" y="-6" width="20" height="7" rx="3" fill="var(--stage-ink)" />
		<circle cx="-4" cy="2" r="4" fill="var(--stage-ink-muted)" />
	</g>
	{@render txt(CX - 52, CY - TOP + 2, 'cannon, 300 km up', 12, { anchor: 'end', muted: true })}

	<!-- landing puff -->
	{#if puff > 0 && puff < 1}
		<g
			transform="translate({lastPt.x} {lastPt.y}) rotate({(puffRot * 180) / Math.PI})"
			opacity={1 - puff}
		>
			{#each PUFF as p, i (i)}
				<circle
					cx={p.dx * (0.6 + puff)}
					cy={p.dy * (0.6 + puff) - 3}
					r={p.r * (0.5 + puff)}
					fill="var(--stage-ink-muted)"
					opacity="0.6"
				/>
			{/each}
		</g>
	{/if}

	<!-- the ball -->
	{#if !(flight.outcome === 'lands' && landed > 0.9)}
		<circle
			cx={ball.x}
			cy={ball.y}
			r="5.5"
			fill="var(--stage-ink)"
			stroke="var(--orb-space)"
			stroke-width="1.5"
			opacity={flight.outcome === 'lands' && landed > 0 ? 1 - smoothstep(0.3, 0.9, landed) : 1}
		/>
	{:else}
		<circle cx={lastPt.x} cy={lastPt.y} r="4" fill="var(--stage-ink)" opacity="0.8" />
	{/if}

	<!-- outcome label next to the end of the path -->
	{#if flight.outcome === 'lands'}
		{@const ang = Math.atan2(lastPt.y - CY, lastPt.x - CX)}
		<g opacity={outcomeShown}>
			{@render txt(
				lastPt.x + Math.cos(ang) * 22,
				lastPt.y + Math.sin(ang) * 22 - 6,
				outcomeText,
				13,
				{ weight: 600, anchor: 'start' }
			)}
		</g>
	{/if}

	<!-- card -->
	<rect
		x={CARD.x}
		y={CARD.y}
		width={CARD.w}
		height={CARD.h}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(CL, 50, "Newton's cannon", 16, { weight: 700 })}
	{@render txt(CL, 72, 'no air; Earth to scale, heights stretched', 11, { muted: true })}

	{@render txt(CL, 112, 'Firing speed', 12, { muted: true })}
	{@render txt(CARD.x + CARD.w - 20, 112, `${speed.toFixed(1)} km/s`, 16, {
		weight: 700,
		anchor: 'end',
		color: 'var(--orb-planet)',
		tabular: true
	})}
	{@render txt(CL, 140, 'Low-orbit speed (√gR)', 12, { muted: true })}
	{@render txt(CARD.x + CARD.w - 20, 140, `${LOW.toFixed(1)} km/s`, 14, {
		weight: 600,
		anchor: 'end',
		tabular: true
	})}
	{@render txt(CL, 166, 'Escape speed from 300 km', 12, { muted: true })}
	{@render txt(CARD.x + CARD.w - 20, 166, `${ESCAPE.toFixed(1)} km/s`, 14, {
		weight: 600,
		anchor: 'end',
		tabular: true
	})}

	<!-- speed bar with the two thresholds -->
	<rect x={CL} y="186" width={CARD.w - 40} height="8" rx="4" fill="var(--stage-grid)" />
	<rect
		x={CL}
		y="186"
		width={Math.max(8, bx(speed) - CL)}
		height="8"
		rx="4"
		fill="var(--orb-planet)"
	/>
	{#each [{ v: LOW, label: 'orbit' }, { v: ESCAPE, label: 'escape' }] as m (m.label)}
		<line
			x1={bx(m.v)}
			x2={bx(m.v)}
			y1="181"
			y2="199"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		{@render txt(bx(m.v), 213, m.label, 11, { muted: true, anchor: 'middle' })}
	{/each}

	{@render txt(CL, 252, 'Flight time', 12, { muted: true })}
	{@render txt(CARD.x + CARD.w - 20, 252, minutes(ball.secs), 14, {
		weight: 600,
		anchor: 'end',
		tabular: true
	})}
	{@render txt(CL, 284, outcomeShown ? outcomeText : 'in flight…', 14, {
		weight: 700,
		color: !outcomeShown
			? undefined
			: flight.outcome === 'lands'
				? 'var(--stage-ink)'
				: 'var(--orb-planet)',
		muted: !outcomeShown
	})}
	{#if flight.outcome === 'orbit' || flight.outcome === 'loop'}
		{@render txt(
			CL,
			306,
			`highest point ${Math.round(flight.apogeeKm).toLocaleString('en-US')} km up`,
			12,
			{
				muted: true
			}
		)}
	{/if}

	<!-- inset: the ground curves away about 5 m for every 8 km -->
	<line x1={CL} x2={CARD.x + CARD.w - 20} y1="340" y2="340" stroke="var(--border)" />
	{@render txt(CL, 366, 'Why about 8 km/s?', 13, { weight: 700 })}
	<line
		x1={INSET.x}
		x2={INSET.x + INSET.w}
		y1={INSET.y}
		y2={INSET.y}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<path d={insetGround} fill="none" stroke="var(--sky-land)" stroke-width="3" />
	<circle cx={INSET.x} cy={INSET.y} r="3.5" fill="var(--stage-ink)" />
	<line
		x1={INSET.x + INSET.w + 6}
		x2={INSET.x + INSET.w + 6}
		y1={INSET.y}
		y2={INSET.y + INSET.drop}
		stroke="var(--stage-ink)"
	/>
	{@render txt(INSET.x + INSET.w / 2, INSET.y - 8, 'level: 8 km', 11, {
		muted: true,
		anchor: 'middle'
	})}
	{@render txt(INSET.x + INSET.w, INSET.y + INSET.drop / 2 + 4, '5 m', 12, {
		weight: 600,
		anchor: 'end'
	})}
	{@render txt(INSET.x + 4, INSET.y + 30, 'ground', 11, { muted: true })}
	{@render txt(CL, 488, 'The ground curves away about 5 m', 12)}
	{@render txt(CL, 506, 'for every 8 km. A ball falls 5 m in its', 12)}
	{@render txt(CL, 524, 'first second — so at 8 km/s it falls', 12)}
	{@render txt(CL, 542, 'exactly as fast as the ground drops away.', 12)}
	{@render txt(CL, 566, '(drop not to scale)', 11, { muted: true })}
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
