<script lang="ts">
	/**
	 * Radians: the radius laid around its own circle.
	 *
	 * The animation (a pure function of t, ~13 s, then it holds): a copy of the
	 * radius appears at 0°, pivots on its outer end until it is tangent to the
	 * circle, then bends onto the circumference — its curvature grows from 0 to
	 * 1/R, so it keeps its length while it rolls on. Six copies fit, one after
	 * the other (ticks at 1, 2 … 6 radians); a seventh only fits 0.28 of the way
	 * before reaching the start, and the rest of it fades away: 2π ≈ 6.28.
	 *
	 * The reader's angle θ (`params.angle`, degrees, shared with the slider) is
	 * drawn on top: a draggable point, the sector and its arc on the inside
	 * edge of the circle. Its readout and the conversion table live in the
	 * panel on the right, so the laid radii keep their labels outside the
	 * circle to themselves.
	 *
	 * Under reduced motion t is frozen at 2.5 s, so the scene uses the end of
	 * the animation instead: all six radii laid and the leftover marked.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { Handle, easeInOut, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { angleParam, degText, num, radText, screenAngle, toRad } from '../trig';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------
	const CX = 312;
	const CY = 300;
	const R = 210; // one unit, in stage units
	const AX = 262; // half-length of the drawn axes
	const TAU = Math.PI * 2;
	const LEFTOVER = TAU - 6; // ≈ 0.283

	/** Screen position of the circle point at `a` radians, at distance `r` from the centre. */
	const at = (a: number, r = R) => ({ x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) });

	/** Anticlockwise arc (screen sweep 0) from a0 to a1 radians at radius r; a1 − a0 < π. */
	const arc = (a0: number, a1: number, r = R) => {
		const p = at(a0, r);
		const q = at(a1, r);
		return `M${p.x.toFixed(2)} ${p.y.toFixed(2)} A${r} ${r} 0 0 0 ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
	};

	// Two alternating oranges, so neighbouring radii stay distinguishable; both
	// read on the light and the dark stage. Labels use the deeper one.
	const ORANGE = ['#f59f00', '#e8590c'];
	const INK_ORANGE = '#e8590c';

	// ---- timeline ----------------------------------------------------------
	// Piece k (0–6) starts at T0 + k·PIECE; within its window:
	//   0–0.2 fade in along the radius at angle k · 0.2–0.9 pivot to the tangent ·
	//   0.35–1.3 bend onto the circle (overlapping the pivot, so the piece curls as
	//   it turns and stays well inside the frame) · 1.3–1.6 rest.
	const T0 = 0.8;
	const PIECE = 1.6;
	const TRIM = T0 + 7 * PIECE; // 12.0 s: the 7th piece's overhang fades away
	const END = TRIM + 1.2;

	const tt = $derived(reduced ? END + 1 : t);
	const local = (k: number) => tt - (T0 + k * PIECE);
	/** Number of pieces (0–7) that have settled on the circle. */
	const settled = $derived(Math.max(0, Math.min(7, Math.floor((tt - T0 - 1.3) / PIECE) + 1)));
	/** The piece in motion, if any. */
	const moving = $derived.by(() => {
		for (let k = 0; k < 7; k++) {
			const u = local(k);
			if (u >= 0 && u < 1.3) return k;
		}
		return -1;
	});
	const trim = $derived(smoothstep(TRIM, TRIM + 0.9, tt));
	const done = $derived(smoothstep(TRIM + 0.3, END, tt));

	/**
	 * Points of the moving piece: a straight radius-length segment that starts
	 * on the circle at angle a0, pivots from pointing at the centre to pointing
	 * along the tangent, then bends with growing curvature onto the arc.
	 */
	const SAMPLES = 32;
	const piece = $derived.by(() => {
		if (moving < 0) return null;
		const k = moving;
		const u = local(k);
		const a0 = k;
		const S = at(a0);
		const N = { x: -Math.cos(a0), y: Math.sin(a0) }; // towards the centre
		const T = { x: -Math.sin(a0), y: -Math.cos(a0) }; // anticlockwise tangent
		const pivot = easeInOut(smoothstep(0.2, 0.9, u));
		const bend = easeInOut(smoothstep(0.35, 1.3, u));
		const fade = smoothstep(0, 0.2, u);
		const alpha = (pivot * Math.PI) / 2;
		const d = {
			x: N.x * Math.cos(alpha) + T.x * Math.sin(alpha),
			y: N.y * Math.cos(alpha) + T.y * Math.sin(alpha)
		};
		// the side it curls towards: d turned a quarter towards the centre (T → N)
		const n = { x: d.y, y: -d.x };
		const pointAt = (s: number): Point => {
			if (bend < 1e-4) return { x: S.x + d.x * s * R, y: S.y + d.y * s * R };
			const phi = bend * s;
			const along = (Math.sin(phi) / bend) * R;
			const inward = ((1 - Math.cos(phi)) / bend) * R;
			return { x: S.x + d.x * along + n.x * inward, y: S.y + d.y * along + n.y * inward };
		};
		// The 7th piece is split where it reaches the start again (2π).
		const cut = k === 6 ? LEFTOVER : 1;
		const toD = (s0: number, s1: number) => {
			const count = Math.max(2, Math.round(SAMPLES * (s1 - s0)));
			let out = '';
			for (let i = 0; i <= count; i++) {
				const p = pointAt(s0 + ((s1 - s0) * i) / count);
				out += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
			}
			return out;
		};
		return {
			k,
			fade,
			main: toD(0, cut),
			over: cut < 1 ? toD(cut, 1) : '',
			// while still straight it is drawn thinner, like the radius it copies
			width: 2.4 + 4.6 * smoothstep(0.35, 1.0, u)
		};
	});

	// Settled arcs (static), the ticks at whole radians and their labels.
	const ARCS = Array.from({ length: 7 }, (_, k) => ({
		k,
		d: arc(k, k + (k === 6 ? LEFTOVER : 1)),
		color: ORANGE[k % 2]
	}));
	// The overhang of the 7th piece, lying over the first radius until it fades.
	const OVERHANG = arc(TAU, 7);
	const TICKS = [1, 2, 3, 4, 5, 6].map((n) => {
		const a = n;
		const inner = at(a, R - 5);
		const outer = at(a, R + 10);
		const lab = at(a, R + 24);
		const cos = Math.cos(a);
		const sin = Math.sin(a);
		return {
			n,
			inner,
			outer,
			x: lab.x,
			y: lab.y + (sin < -0.3 ? 12 : sin > 0.3 ? 0 : 5),
			anchor: cos > 0.25 ? 'start' : cos < -0.25 ? 'end' : 'middle',
			text: n === 1 ? '1 radian ≈ 57.3°' : `${n}`
		};
	});

	// ---- the reader's angle -------------------------------------------------------
	const theta = $derived(angleParam(step, params));
	const rad = $derived(toRad(theta));
	const P = $derived(at(rad));

	function setAngle(deg: number) {
		setParam('angle', Math.max(0, Math.min(360, Math.round(deg))));
	}
	function onmove(p: Point) {
		const raw = screenAngle(CX, CY, p.x, p.y);
		// Crossing the 0° seam from above lands on 360° (a full turn), not 0°.
		setAngle(raw < 0.5 && Number(params.angle) > 180 ? 360 : raw);
	}
	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') return setAngle(0);
		if (k === 'end') return setAngle(360);
		// Arrow keys wrap around: past 360° back to 1°, below 0° to 359°.
		const v = theta + k;
		setAngle(v > 360 ? v - 360 : v < 0 ? v + 360 : v);
	}

	/** Anticlockwise arc from 0 to θ at radius r (a full circle at 360°). */
	function thetaArc(r: number, sector = false) {
		if (theta <= 0.01) return '';
		const start = `${CX + r} ${CY}`;
		if (theta >= 359.99) {
			const ring = `M${start} A${r} ${r} 0 1 0 ${CX - r} ${CY} A${r} ${r} 0 1 0 ${start}`;
			return sector ? `${ring} Z` : ring;
		}
		const e = at(rad, r);
		const large = theta > 180 ? 1 : 0;
		const a = `A${r} ${r} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
		return sector ? `M${CX} ${CY} L${start} ${a} Z` : `M${start} ${a}`;
	}
	const BAND = R - 11; // the θ arc runs just inside the circle
	const sectorPath = $derived(thetaArc(R, true));
	const bandPath = $derived(thetaArc(BAND));
	const arcR = 34;
	const smallArc = $derived(thetaArc(arcR));
	// Halfway round the arc, but at least 14° away from the y- and x-axes (at
	// 180° and 360° halfway is on an axis); small angles keep the true halfway.
	const thetaLabel = $derived.by(() => {
		const m = theta / 2;
		const axis = Math.round(m / 90) * 90;
		const deg = axis === 0 || Math.abs(m - axis) >= 14 ? m : axis - 14;
		return at(toRad(deg), arcR + 18);
	});

	// Inviting pulse on the handle at the start of the step.
	// Labels round the circle fade while the reader's point sits on them.
	const clearOf = (x: number, y: number) =>
		0.15 + 0.85 * smoothstep(16, 26, Math.hypot(P.x - x, P.y - (y - 5)));

	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	// ---- readout panel ------------------------------------------------------------
	const PX = 626;
	const exactRad = $derived(radText(theta).includes('π'));
	const radLine = $derived(
		theta === 0
			? '= 0 radians'
			: exactRad
				? `= ${radText(theta)} ≈ ${num(rad)} radians`
				: `≈ ${num(rad)} radians`
	);
	const arcLine = $derived(
		theta === 0 ? 'No turn: the arc has no length' : `The arc is about ${num(rad)} radii long`
	);

	// The circumference unrolled into a ruler, measured in radii.
	const RU = 46; // px per radius
	const RULER_Y = 214;
	const filled = $derived.by(() => {
		const out: { k: number; w: number }[] = [];
		for (let k = 0; k < 7; k++) {
			const len = k === 6 ? LEFTOVER : 1;
			const p = smoothstep(0.35, 1.3, local(k));
			if (p > 0) out.push({ k, w: len * p });
		}
		return out;
	});

	const TABLE = [
		{ deg: 30, rad: 'π/6' },
		{ deg: 45, rad: 'π/4' },
		{ deg: 90, rad: 'π/2' },
		{ deg: 180, rad: 'π' },
		{ deg: 360, rad: '2π' }
	];
	const TABLE_Y = 324;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
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

<g>
	<!-- the reader's sector, faint -->
	<path d={sectorPath} fill="var(--explainer-accent)" opacity="0.07" />

	<!-- axes and the unit circle -->
	<line
		x1={CX - AX}
		x2={CX + AX}
		y1={CY}
		y2={CY}
		stroke="var(--stage-line)"
		stroke-width="1.5"
		opacity="0.8"
	/>
	<line
		x1={CX}
		x2={CX}
		y1={CY - AX}
		y2={CY + AX}
		stroke="var(--stage-line)"
		stroke-width="1.5"
		opacity="0.8"
	/>
	<circle
		cx={CX}
		cy={CY}
		r={R}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
		opacity="0.7"
	/>

	<!-- radii laid on the circle -->
	{#each ARCS as a (a.k)}
		{#if a.k < settled}
			<path d={a.d} fill="none" stroke={a.color} stroke-width="7" />
		{/if}
	{/each}
	{#if settled === 7 && trim < 1}
		<path
			d={OVERHANG}
			fill="none"
			stroke={ORANGE[0]}
			stroke-width="3"
			opacity={0.45 * (1 - trim)}
		/>
	{/if}

	<!-- the start, the ticks at whole radians and their labels -->
	<line
		x1={CX + R - 5}
		x2={CX + R + 10}
		y1={CY}
		y2={CY}
		stroke="var(--stage-ink)"
		stroke-width="1.6"
	/>
	{@render txt(CX + R + 12, CY - 24, '0', 12, {
		muted: true,
		opacity: (1 - done) * clearOf(CX + R + 16, CY - 24)
	})}
	{@render txt(CX + R + 12, CY - 24, '2π ≈ 6.28', 13, {
		weight: 600,
		color: INK_ORANGE,
		opacity: done * clearOf(CX + R + 16, CY - 24)
	})}
	{#each TICKS as tk (tk.n)}
		{@const on = smoothstep(1.1, 1.5, local(tk.n - 1))}
		{#if on > 0.01}
			<g opacity={on}>
				<line
					x1={tk.inner.x}
					y1={tk.inner.y}
					x2={tk.outer.x}
					y2={tk.outer.y}
					stroke="var(--stage-ink)"
					stroke-width="1.6"
				/>
				{@render txt(tk.x, tk.y, tk.text, tk.n === 1 ? 13 : 14, {
					anchor: tk.anchor,
					weight: 600,
					color: INK_ORANGE,
					opacity: clearOf(tk.x, tk.y)
				})}
			</g>
		{/if}
	{/each}
	{#if done > 0.01}
		{@const lp = at(6 + LEFTOVER / 2, R + 22)}
		{@render txt(lp.x, lp.y + 8, '+ 0.28', 12, {
			weight: 600,
			color: INK_ORANGE,
			opacity: done * clearOf(lp.x + 18, lp.y + 8)
		})}
	{/if}

	<!-- the reader's angle: its arc along the inside of the circle -->
	<path
		d={bandPath}
		fill="none"
		stroke="var(--explainer-accent)"
		stroke-width="4"
		stroke-linecap="round"
		opacity="0.9"
	/>
	<path d={smallArc} fill="none" stroke="var(--explainer-accent)" stroke-width="2.2" />
	{#if theta > 16}
		{@render txt(thetaLabel.x, thetaLabel.y + 5, 'θ', 15, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--explainer-accent)'
		})}
	{/if}
	<line
		x1={CX}
		y1={CY}
		x2={P.x}
		y2={P.y}
		stroke="var(--stage-ink)"
		stroke-width="2.4"
		stroke-linecap="round"
	/>
	<circle cx={CX} cy={CY} r="3.5" fill="var(--stage-ink)" />

	<!-- the radius copy in motion -->
	{#if piece}
		<g opacity={piece.fade}>
			<path
				d={piece.main}
				fill="none"
				stroke={ORANGE[piece.k % 2]}
				stroke-width={piece.width}
				stroke-linecap="round"
			/>
			{#if piece.over}
				<path
					d={piece.over}
					fill="none"
					stroke={ORANGE[piece.k % 2]}
					stroke-width={piece.width * 0.5}
					stroke-linecap="round"
					opacity="0.45"
				/>
			{/if}
		</g>
	{/if}

	<!-- invitation pulse, then the handle -->
	{#if pulse > 0.01}
		<circle
			cx={P.x}
			cy={P.y}
			r={16 + 10 * pulse}
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="2"
			opacity={0.5 * pulse}
		/>
	{/if}
	<Handle
		x={P.x}
		y={P.y}
		label="Point on the circle"
		value={theta}
		min={0}
		max={360}
		valuetext="{degText(theta)}, {radText(theta)} radians"
		{onmove}
		{onkey}
	/>

	<!-- ================= readout panel ================= -->
	<g>
		{@render txt(PX, 88, `θ = ${degText(theta)}`, 30, { weight: 600 })}
		{@render txt(PX, 116, radLine, 15, { muted: true })}
		{@render txt(PX, 144, arcLine, 15, { weight: 600, color: 'var(--explainer-accent)' })}

		<!-- the circumference, unrolled -->
		{@render txt(PX, RULER_Y - 20, 'The circumference, measured in radii', 12, { muted: true })}
		<rect
			x={PX}
			y={RULER_Y}
			width={TAU * RU}
			height="10"
			rx="2"
			fill="var(--stage-grid)"
			stroke="var(--stage-line)"
		/>
		{#each filled as f (f.k)}
			<rect x={PX + f.k * RU} y={RULER_Y} width={f.w * RU} height="10" fill={ORANGE[f.k % 2]} />
		{/each}
		{#each [0, 1, 2, 3, 4, 5, 6] as n (n)}
			<line
				x1={PX + n * RU}
				x2={PX + n * RU}
				y1={RULER_Y + 10}
				y2={RULER_Y + 15}
				stroke="var(--stage-ink-muted)"
			/>
			{@render txt(PX + n * RU, RULER_Y + 28, `${n}`, 11, { anchor: 'middle', muted: true })}
		{/each}
		<!-- where θ falls on it -->
		{#if theta > 0}
			{@const mx = PX + rad * RU}
			<path
				d="M{mx - 5} {RULER_Y - 9} L{mx + 5} {RULER_Y - 9} L{mx} {RULER_Y - 2} Z"
				fill="var(--explainer-accent)"
			/>
		{/if}
		{@render txt(
			PX,
			RULER_Y + 58,
			settled >= 7 ? '6 radii and a bit: 2π ≈ 6.28' : `Radii laid end to end: ${settled}`,
			settled >= 7 ? 15 : 13,
			{ weight: settled >= 7 ? 600 : 500, muted: settled < 7 }
		)}

		<!-- degrees ↔ radians -->
		{@render txt(PX, TABLE_Y, 'degrees', 12, { muted: true })}
		{@render txt(PX + 84, TABLE_Y, 'radians', 12, { muted: true })}
		{#each TABLE as row, i (row.deg)}
			{@const y = TABLE_Y + 28 + i * 26}
			{@const hit = theta === row.deg}
			{#if hit}
				<rect
					x={PX - 8}
					y={y - 18}
					width="196"
					height="25"
					rx="5"
					fill="var(--explainer-accent)"
					opacity="0.14"
				/>
			{/if}
			{@render txt(PX, y, `${row.deg}°`, 15, { weight: hit ? 700 : 500 })}
			{@render txt(PX + 54, y, '=', 15, { muted: true })}
			{@render txt(PX + 84, y, row.rad, 15, { weight: hit ? 700 : 500 })}
			{@render txt(PX + 134, y, `≈ ${num(toRad(row.deg))}`, 13, { muted: true })}
		{/each}

		<!-- the rule -->
		{@render txt(PX, TABLE_Y + 192, '180° = π radians', 18, { weight: 600 })}
		{@render txt(PX, TABLE_Y + 214, 'radians = degrees × π/180', 12, { muted: true })}
	</g>
</g>
