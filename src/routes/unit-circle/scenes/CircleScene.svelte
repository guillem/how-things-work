<script lang="ts">
	/**
	 * The unit circle with a draggable point.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   angle     — the angle θ, its arc, the compass of 90° / 180° / 270°
	 *   coords    — cos θ and sin θ as the point's coordinates (coloured segments)
	 *   triangle  — the right triangle, SOH CAH and cos²θ + sin²θ = 1
	 *   quadrants — the four quadrants with their signs, and the special angles
	 *
	 * The angle lives in `params.angle` (degrees), shared with the slider: the
	 * handle writes to it. Nothing here moves on its own except a gentle
	 * "drag me" pulse on the handle at the start of the step (a function of t).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		angleParam,
		degText,
		exact,
		num,
		radText,
		reduce,
		screenAngle,
		toRad,
		trigText
	} from '../trig';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------
	const CX = 312;
	const CY = 300;
	const R = 210; // one unit, in stage units
	const AX = 262; // half-length of the drawn axes

	const phase = $derived(String(step.hints?.phase ?? 'angle'));
	const theta = $derived(angleParam(step, params));
	const rad = $derived(toRad(theta));
	const cos = $derived(Math.cos(rad));
	const sin = $derived(Math.sin(rad));
	const P = $derived({ x: CX + R * cos, y: CY - R * sin });
	const foot = $derived({ x: P.x, y: CY });

	// ---- phase cross-fades ---------------------------------------------------
	const phases = ['angle', 'coords', 'triangle', 'quadrants'] as const;
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<(typeof phases)[number], Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived({
		angle: weights.angle.current,
		coords: weights.coords.current,
		triangle: weights.triangle.current,
		quadrants: weights.quadrants.current
	});
	// The coordinate segments stay on in the triangle and quadrant phases too.
	const segs = $derived(Math.max(w.coords, w.triangle, w.quadrants));

	// ---- interaction -----------------------------------------------------------
	const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
	const snapping = $derived(
		Boolean(params.snap) && (step.controls ?? []).some((c) => c.id === 'snap')
	);

	function setAngle(deg: number) {
		let v = Math.round(deg);
		if (snapping) v = SPECIAL.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
		// Keep 360 when dragging up to the start from above, 0 from below.
		params.angle = Math.max(0, Math.min(360, v));
	}
	function onmove(p: Point) {
		const raw = screenAngle(CX, CY, p.x, p.y);
		// Crossing the 0° seam from above lands on 360° (a full turn), not 0°.
		setAngle(raw < 0.5 && Number(params.angle) > 180 ? 360 : raw);
	}
	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') return setAngle(0);
		if (k === 'end') return setAngle(360);
		if (snapping) {
			const next =
				k > 0 ? SPECIAL.find((s) => s > theta) : [...SPECIAL].reverse().find((s) => s < theta);
			return setAngle(next ?? theta);
		}
		// Arrow keys wrap around: past 360° back to 1°, below 0° to 359°.
		const v = theta + k;
		setAngle(v > 360 ? v - 360 : v < 0 ? v + 360 : v);
	}

	// ---- drawing helpers ---------------------------------------------------------
	const arcR = 34;
	const arcPath = $derived.by(() => {
		if (theta <= 0.01) return '';
		const end = { x: CX + arcR * cos, y: CY - arcR * sin };
		const large = theta > 180 ? 1 : 0;
		if (theta >= 359.99) {
			return `M${CX + arcR} ${CY} A${arcR} ${arcR} 0 1 0 ${CX - arcR} ${CY} A${arcR} ${arcR} 0 1 0 ${CX + arcR} ${CY}`;
		}
		return `M${CX + arcR} ${CY} A${arcR} ${arcR} 0 ${large} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
	});
	const mid = $derived(toRad(theta / 2));
	const thetaLabel = $derived({
		x: CX + (arcR + 18) * Math.cos(mid),
		y: CY - (arcR + 18) * Math.sin(mid) + 5
	});

	const quadrant = $derived(theta % 90 === 0 ? 0 : Math.floor(reduce(theta) / 90) + 1);
	// Sign labels sit in the corners of the axes' square, outside the circle.
	const quadrants = [
		{ q: 1, x: CX + AX - 34, y: CY - AX + 24, signs: '(+, +)' },
		{ q: 2, x: CX - AX + 34, y: CY - AX + 24, signs: '(−, +)' },
		{ q: 3, x: CX - AX + 34, y: CY + AX - 26, signs: '(−, −)' },
		{ q: 4, x: CX + AX - 34, y: CY + AX - 26, signs: '(+, −)' }
	];

	// The point's label sits outside the circle, away from the axes.
	const pointLabel = $derived.by(() => {
		// Beside the point when there is room; above or below it near the left
		// and right edges, kept 16 px inside the frame (labels are ~110 px wide).
		const side = Math.abs(cos) < 0.75;
		const x = side ? CX + (R + 22) * cos : P.x;
		const y = side ? CY - (R + 22) * sin + 5 : P.y + (sin >= 0 ? -24 : 32);
		return {
			x: Math.min(944 - 60, Math.max(16 + 60, x)),
			y,
			anchor: side ? (cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle') : 'middle'
		} as const;
	});

	// The cos label goes on the side of the x-axis the angle arc does not cover.
	const cosBelow = $derived(theta <= 180 || theta >= 270);

	// Right-angle mark at the foot of the drop.
	const rightMark = $derived.by(() => {
		const s = 12;
		const dx = cos >= 0 ? -s : s;
		const dy = sin >= 0 ? -s : s;
		return `M${foot.x + dx} ${foot.y} L${foot.x + dx} ${foot.y + dy} L${foot.x} ${foot.y + dy}`;
	});

	// Inviting pulse on the handle at the start of a step.
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	// Readout panel.
	const PX = 606;
	const sinSq = $derived(sin * sin);
	const cosSq = $derived(cos * cos);
	const special = $derived(exact(cos) !== null && exact(sin) !== null && Number.isInteger(theta));
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
	<!-- quadrant shading (quadrants phase) -->
	{#if w.quadrants > 0.01}
		<g opacity={w.quadrants}>
			{#each quadrants as qd (qd.q)}
				<rect
					x={qd.x > CX ? CX : CX - AX}
					y={qd.y < CY ? CY - AX : CY}
					width={AX}
					height={AX}
					fill={quadrant === qd.q ? 'var(--explainer-accent)' : 'transparent'}
					opacity="0.08"
				/>
				{@render txt(qd.x, qd.y, qd.signs, 15, {
					anchor: 'middle',
					weight: 600,
					opacity: quadrant === qd.q ? 1 : 0.55
				})}
				{@render txt(qd.x, qd.y + 18, `(cos, sin)`, 11, {
					anchor: 'middle',
					muted: true,
					opacity: quadrant === qd.q ? 1 : 0.55
				})}
			{/each}
		</g>
	{/if}

	<!-- axes and the unit circle -->
	<line x1={CX - AX} x2={CX + AX} y1={CY} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={CX} x2={CX} y1={CY - AX} y2={CY + AX} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each [-1, 1] as v (v)}
		<line x1={CX + v * R} x2={CX + v * R} y1={CY - 5} y2={CY + 5} stroke="var(--stage-line)" />
		<line x1={CX - 5} x2={CX + 5} y1={CY - v * R} y2={CY - v * R} stroke="var(--stage-line)" />
		{@render txt(CX + v * R + (v > 0 ? 8 : -8), CY + 18, v > 0 ? '1' : '−1', 12, {
			anchor: v > 0 ? 'start' : 'end',
			muted: true
		})}
		{@render txt(CX - 9, CY - v * R + (v > 0 ? -6 : 16), v > 0 ? '1' : '−1', 12, {
			anchor: 'end',
			muted: true
		})}
	{/each}
	{@render txt(CX + AX - 2, CY - 9, 'x', 13, { anchor: 'end', muted: true })}
	{@render txt(CX + 9, CY - AX + 12, 'y', 13, { muted: true })}
	<circle
		cx={CX}
		cy={CY}
		r={R}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
		opacity="0.7"
	/>

	<!-- compass of whole quarter turns (angle phase) -->
	{#if w.angle > 0.01}
		<g opacity={w.angle}>
			{#each [0, 90, 180, 270] as a (a)}
				{@const r2 = toRad(a)}
				<circle
					cx={CX + R * Math.cos(r2)}
					cy={CY - R * Math.sin(r2)}
					r="3.5"
					fill="var(--stage-ink-muted)"
				/>
				{@render txt(
					CX + (R + 22) * Math.cos(r2) + (a === 0 ? 4 : a === 180 ? -4 : 12),
					CY - (R + 22) * Math.sin(r2) + (a === 90 ? -2 : a === 270 ? 12 : -8),
					a === 0 ? '0° / 360°' : `${a}°`,
					12,
					{ anchor: a === 0 ? 'start' : a === 180 ? 'end' : 'start', muted: true }
				)}
			{/each}
		</g>
	{/if}

	<!-- special angles (quadrants phase) -->
	{#if w.quadrants > 0.01}
		<g opacity={w.quadrants}>
			{#each SPECIAL.slice(0, -1) as a (a)}
				{@const r2 = toRad(a)}
				<circle
					cx={CX + R * Math.cos(r2)}
					cy={CY - R * Math.sin(r2)}
					r={a % 90 === 0 ? 3.5 : 3}
					fill="var(--stage-ink-muted)"
				/>
			{/each}
		</g>
	{/if}

	<!-- the angle arc -->
	<path d={arcPath} fill="none" stroke="var(--explainer-accent)" stroke-width="2.2" />
	{#if theta > 16}
		{@render txt(thetaLabel.x, thetaLabel.y, 'θ', 15, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--explainer-accent)'
		})}
	{/if}

	<!-- triangle fill (triangle phase) -->
	{#if w.triangle > 0.01}
		<path
			d="M{CX} {CY} L{foot.x} {foot.y} L{P.x} {P.y} Z"
			fill="var(--explainer-accent)"
			opacity={0.1 * w.triangle}
		/>
		<path
			d={rightMark}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			opacity={w.triangle}
		/>
	{/if}

	<!-- cos and sin segments -->
	{#if segs > 0.01}
		<g opacity={segs}>
			<line
				x1={P.x}
				x2={P.x}
				y1={P.y}
				y2={CY}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
			<line
				x1={P.x}
				x2={CX}
				y1={P.y}
				y2={P.y}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
				opacity={w.coords}
			/>
			<line
				x1={CX}
				x2={P.x}
				y1={CY}
				y2={CY}
				stroke="var(--trig-cos)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<line
				x1={P.x}
				x2={P.x}
				y1={CY}
				y2={P.y}
				stroke="var(--trig-sin)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			{#if Math.abs(cos) > 0.12}
				{@render txt(
					(CX + P.x) / 2,
					CY + (cosBelow ? 22 : -12),
					w.triangle > 0.5 ? 'cos θ (adjacent)' : 'cos θ',
					13,
					{ anchor: 'middle', weight: 600, color: 'var(--trig-cos)' }
				)}
			{/if}
			{#if Math.abs(sin) > 0.12}
				{@render txt(
					P.x + (cos >= 0 ? 10 : -10),
					(CY + P.y) / 2 + 4,
					w.triangle > 0.5 ? 'sin θ (opposite)' : 'sin θ',
					13,
					{ anchor: cos >= 0 ? 'start' : 'end', weight: 600, color: 'var(--trig-sin)' }
				)}
			{/if}
		</g>
	{/if}

	<!-- the radius -->
	<line
		x1={CX}
		y1={CY}
		x2={P.x}
		y2={P.y}
		stroke="var(--stage-ink)"
		stroke-width="2.4"
		stroke-linecap="round"
	/>
	{#if w.triangle > 0.01}
		{@render txt(
			CX + 0.55 * R * cos - 14 * sin * (cos >= 0 ? 1 : -1),
			CY - 0.55 * R * sin - 14 * Math.abs(cos) + 4,
			'1 (hypotenuse)',
			12,
			{ anchor: cos >= 0 ? 'end' : 'start', opacity: w.triangle }
		)}
	{/if}
	<circle cx={CX} cy={CY} r="3.5" fill="var(--stage-ink)" />

	<!-- the point's coordinates -->
	{#if segs > 0.01}
		{@render txt(pointLabel.x, pointLabel.y, `(${num(cos)}, ${num(sin)})`, 13, {
			anchor: pointLabel.anchor,
			weight: 600,
			opacity: segs
		})}
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
		{@render txt(PX, 104, `θ = ${degText(theta)}`, 30, { weight: 600 })}
		{@render txt(PX, 132, `= ${radText(theta)} radians`, 15, { muted: true })}

		{#if w.angle > 0.01}
			<g opacity={w.angle}>
				{@render txt(
					PX,
					196,
					theta === 0
						? 'Pointing right, along the x-axis'
						: theta < 90
							? 'Turned anticlockwise from the x-axis'
							: theta === 90
								? 'Straight up: a quarter turn'
								: theta < 180
									? 'Past a quarter turn'
									: theta === 180
										? 'Pointing left: a half turn'
										: theta < 270
											? 'Past a half turn'
											: theta === 270
												? 'Straight down: three quarters of a turn'
												: theta < 360
													? 'Nearly a full turn'
													: 'A full turn: back to the start',
					14
				)}
				{@render txt(PX, 222, `${num(theta / 360, 3)} of a full turn`, 13, { muted: true })}
			</g>
		{/if}

		{#if segs > 0.01}
			<g opacity={segs}>
				{#each [{ id: 'cos', v: cos, color: 'var(--trig-cos)', y: 196, label: 'cos θ', what: 'sideways position' }, { id: 'sin', v: sin, color: 'var(--trig-sin)', y: 262, label: 'sin θ', what: 'height' }] as row (row.id)}
					{@render txt(
						PX,
						row.y,
						`${row.label} = ${trigText(theta, row.id as 'sin' | 'cos')}`,
						18,
						{ weight: 600, color: row.color }
					)}
					{@render txt(PX + 300, row.y, row.what, 12, { anchor: 'end', muted: true })}
					<!-- a −1 … 1 bar -->
					<line
						x1={PX}
						x2={PX + 300}
						y1={row.y + 18}
						y2={row.y + 18}
						stroke="var(--stage-grid)"
						stroke-width="8"
						stroke-linecap="round"
					/>
					<line
						x1={PX + 150}
						x2={PX + 150}
						y1={row.y + 11}
						y2={row.y + 25}
						stroke="var(--stage-line)"
					/>
					<line
						x1={PX + 150}
						x2={PX + 150 + 150 * row.v}
						y1={row.y + 18}
						y2={row.y + 18}
						stroke={row.color}
						stroke-width="8"
						stroke-linecap="round"
					/>
					{@render txt(PX, row.y + 38, '−1', 11, { muted: true })}
					{@render txt(PX + 150, row.y + 38, '0', 11, { anchor: 'middle', muted: true })}
					{@render txt(PX + 300, row.y + 38, '1', 11, { anchor: 'end', muted: true })}
				{/each}
			</g>
		{/if}

		{#if w.triangle > 0.01}
			<g opacity={w.triangle}>
				{@render txt(PX, 350, 'sin θ = opposite ÷ hypotenuse', 13)}
				{@render txt(PX, 372, 'cos θ = adjacent ÷ hypotenuse', 13)}
				{@render txt(PX, 412, 'Pythagoras:', 13, { muted: true })}
				{@render txt(
					PX,
					436,
					`cos²θ + sin²θ = ${num(cosSq)} + ${num(sinSq)} = ${num(cosSq + sinSq)}`,
					15,
					{ weight: 600 }
				)}
				<!-- the two squares, side by side, adding up to the unit square -->
				<rect x={PX} y={456} width={300} height={22} rx="4" fill="var(--stage-grid)" />
				<rect
					x={PX}
					y={456}
					width={300 * cosSq}
					height={22}
					rx="4"
					fill="var(--trig-cos)"
					opacity="0.75"
				/>
				<rect
					x={PX + 300 * cosSq}
					y={456}
					width={300 * sinSq}
					height={22}
					rx="4"
					fill="var(--trig-sin)"
					opacity="0.75"
				/>
				{@render txt(PX, 496, 'cos²θ', 11, { color: 'var(--trig-cos)' })}
				{@render txt(PX + 300, 496, 'sin²θ', 11, { anchor: 'end', color: 'var(--trig-sin)' })}
				{@render txt(PX, 520, 'always exactly 1, whatever the angle', 12, { muted: true })}
			</g>
		{/if}

		{#if w.quadrants > 0.01}
			<g opacity={w.quadrants}>
				{@render txt(
					PX,
					350,
					quadrant === 0
						? `On an axis: ${theta % 180 === 0 ? 'sin θ = 0' : 'cos θ = 0'}`
						: `Quadrant ${['I', 'II', 'III', 'IV'][quadrant - 1]}: cos ${cos > 0 ? 'positive' : 'negative'}, sin ${sin > 0 ? 'positive' : 'negative'}`,
					14,
					{ weight: 600 }
				)}
				{@render txt(
					PX,
					376,
					special
						? 'A special angle: exact values'
						: snapping
							? ''
							: 'Turn on snap to visit the special angles',
					13,
					{ muted: !special, color: special ? 'var(--explainer-accent)' : undefined }
				)}
				{@render txt(PX, 420, 'Special angles in the first quadrant', 12, { muted: true })}
				{#each [{ a: 30, c: '√3/2', s: '½' }, { a: 45, c: '√2/2', s: '√2/2' }, { a: 60, c: '½', s: '√3/2' }] as row, i (row.a)}
					{@render txt(PX, 446 + i * 22, `${row.a}°`, 13, {
						weight: 600,
						opacity:
							reduce(theta) % 180 === row.a || 180 - (reduce(theta) % 180) === row.a ? 1 : 0.6
					})}
					{@render txt(PX + 60, 446 + i * 22, `cos ${row.c}`, 13, { color: 'var(--trig-cos)' })}
					{@render txt(PX + 170, 446 + i * 22, `sin ${row.s}`, 13, { color: 'var(--trig-sin)' })}
				{/each}
			</g>
		{/if}
	</g>
</g>
