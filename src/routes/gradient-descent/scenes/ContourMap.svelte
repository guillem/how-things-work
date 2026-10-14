<script lang="ts">
	/**
	 * The contour map of a landscape: rings of equal loss, the minima, the
	 * balls' trails and the start point the reader drags (or drops by clicking
	 * anywhere on the map). Optionally the field of downhill arrows (−∇L) and,
	 * at the start point, the gradient and the downhill direction.
	 */
	import { VectorHandle, startDrag, type Point } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Landscape } from '../descent';
	import { MAP, contours, contourColor, fromMap, mapX, mapY } from './shared';
	import Txt from './Txt.svelte';

	interface Trail {
		key: string;
		color: string;
		/** Visited points (parameter space), up to the current step. */
		points: { x: number; y: number }[];
		ball: { x: number; y: number };
	}
	interface Props {
		land: Landscape;
		start: [number, number];
		trails: Trail[];
		arrows: boolean;
		showMinima: boolean;
		/** Pulse inviting a drag (0–1). */
		invite: number;
		onmove: (p: [number, number]) => void;
	}
	let { land, start, trails, arrows, showMinima, invite, onmove }: Props = $props();

	const levels = $derived(contours(land));
	const X = (x: number) => mapX(land, x);
	const Y = (y: number) => mapY(land, y);
	const inside = (p: { x: number; y: number }) =>
		p.x >= land.x[0] && p.x <= land.x[1] && p.y >= land.y[0] && p.y <= land.y[1];
	const clampPx = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	// Downhill arrows on a grid, length proportional to the slope (the longest 26 px).
	const field = $derived.by(() => {
		if (!arrows) return { d: '', scale: 0 };
		const n = 11;
		const pts: { px: number; py: number; gx: number; gy: number }[] = [];
		let gmax = 0;
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				const x = land.x[0] + ((land.x[1] - land.x[0]) * (i + 0.5)) / n;
				const y = land.y[0] + ((land.y[1] - land.y[0]) * (j + 0.5)) / n;
				const [gx, gy] = land.grad(x, y);
				gmax = Math.max(gmax, Math.hypot(gx, gy));
				pts.push({ px: X(x), py: Y(y), gx, gy });
			}
		}
		const scale = 26 / gmax;
		let d = '';
		for (const p of pts) d += arrowPath(p.px, p.py, -p.gx * scale, p.gy * scale, 4);
		return { d, scale };
	});

	/** An arrow from (x, y) by (dx, dy) screen units, with a head of size h. */
	function arrowPath(x: number, y: number, dx: number, dy: number, h: number) {
		const len = Math.hypot(dx, dy);
		if (len < 1.5) return '';
		const ux = dx / len;
		const uy = dy / len;
		const ex = x + dx;
		const ey = y + dy;
		const hh = Math.min(h, len * 0.6);
		const ax = ex - ux * hh - uy * hh * 0.6;
		const ay = ey - uy * hh + ux * hh * 0.6;
		const bx = ex - ux * hh + uy * hh * 0.6;
		const by = ey - uy * hh - ux * hh * 0.6;
		const f = (v: number) => v.toFixed(1);
		return `M${f(x)} ${f(y)}L${f(ex)} ${f(ey)}M${f(ax)} ${f(ay)}L${f(ex)} ${f(ey)}L${f(bx)} ${f(by)}`;
	}

	// The gradient at the start point: uphill (dashed) and downhill (solid), twice the field's scale.
	const local = $derived.by(() => {
		if (!arrows) return null;
		const [gx, gy] = land.grad(start[0], start[1]);
		const k = 2 * field.scale;
		const px = X(start[0]);
		const py = Y(start[1]);
		return {
			up: arrowPath(px, py, gx * k, -gy * k, 9),
			down: arrowPath(px, py, -gx * k, gy * k, 9),
			upEnd: { x: px + gx * k, y: py - gy * k },
			downEnd: { x: px - gx * k, y: py + gy * k }
		};
	});

	const trailPaths = $derived(
		trails.map((tr) => {
			let line = '';
			let dots = '';
			tr.points.forEach((p, i) => {
				const px = X(p.x).toFixed(1);
				const py = Y(p.y).toFixed(1);
				line += `${i ? 'L' : 'M'}${px} ${py}`;
				if (i > 0) dots += `M${px} ${py}m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0`;
			});
			const off = !inside(tr.ball);
			return {
				key: tr.key,
				color: tr.color,
				line,
				dots,
				off,
				bx: clampPx(X(tr.ball.x), MAP.x, MAP.x + MAP.size),
				by: clampPx(Y(tr.ball.y), MAP.y, MAP.y + MAP.size)
			};
		})
	);

	const ticks = $derived.by(() => {
		const out: { v: number; label: string }[] = [];
		for (let v = Math.ceil(land.x[0]); v <= land.x[1]; v++)
			out.push({ v, label: String(v).replace('-', '−') });
		return out;
	});

	function drop(event: PointerEvent) {
		startDrag(event, (p: Point) => onmove(fromMap(land, p.x, p.y)));
	}
	const keyStep = $derived((land.x[1] - land.x[0]) / 60);
</script>

<g>
	<defs>
		<clipPath id="gd-map-clip">
			<rect x={MAP.x} y={MAP.y} width={MAP.size} height={MAP.size} />
		</clipPath>
	</defs>

	<!-- the map: clicking (or dragging) anywhere drops the ball there -->
	<rect
		x={MAP.x}
		y={MAP.y}
		width={MAP.size}
		height={MAP.size}
		rx="4"
		fill="var(--surface)"
		stroke="var(--border)"
		style:cursor="crosshair"
		style:touch-action="none"
		role="presentation"
		onpointerdown={drop}
	/>
	<g clip-path="url(#gd-map-clip)" style:pointer-events="none">
		{#each levels as c (c.level)}
			<path
				d={c.d}
				fill="none"
				stroke={contourColor(c.u)}
				stroke-width="1.4"
				stroke-linecap="round"
			/>
		{/each}

		{#if arrows}
			<path
				d={field.d}
				fill="none"
				stroke="var(--gd-arrow)"
				stroke-width="1.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.75"
			/>
		{/if}

		{#if showMinima}
			{#each land.minima as m, i (i)}
				<path
					d="M{X(m.x) - 6} {Y(m.y) - 6}l12 12m0 -12l-12 12"
					stroke="var(--gd-min)"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
			{/each}
		{/if}

		{#each trailPaths as tr (tr.key)}
			<path d={tr.line} fill="none" stroke={tr.color} stroke-width="1.8" stroke-linejoin="round" />
			<path d={tr.dots} fill={tr.color} />
		{/each}
	</g>

	{#each trailPaths as tr (tr.key)}
		<circle
			cx={tr.bx}
			cy={tr.by}
			r="7"
			fill={tr.color}
			stroke="var(--stage-bg)"
			stroke-width="2"
			opacity={tr.off ? 0.45 : 1}
			style:pointer-events="none"
		/>
	{/each}

	{#if local}
		<g style:pointer-events="none">
			<path
				d={local.up}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				stroke-dasharray="5 4"
				stroke-linecap="round"
			/>
			<path
				d={local.down}
				fill="none"
				stroke="var(--gd-ball)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</g>
	{/if}

	<!-- the start point: drag it, or focus it and use the arrow keys -->
	{#if invite > 0}
		<circle
			cx={X(start[0])}
			cy={Y(start[1])}
			r={12 + 10 * invite}
			fill="none"
			stroke="var(--gd-ball)"
			stroke-width="2"
			opacity={0.6 * (1 - invite)}
			style:pointer-events="none"
		/>
	{/if}
	<VectorHandle
		x={X(start[0])}
		y={Y(start[1])}
		label="Starting point on the map"
		value={0}
		valuetext="{land.xName} {start[0].toFixed(2)}, {land.yName} {start[1].toFixed(2)}"
		color="var(--gd-ball)"
		r={7}
		onmove={(p: Point) => onmove(fromMap(land, p.x, p.y))}
		onkey={(dx, dy) => onmove([start[0] + dx * keyStep, start[1] + dy * keyStep])}
	/>

	<!-- axes -->
	<Readout id="map-axes">
		{#each ticks as tk (tk.v)}
			<Txt x={X(tk.v)} y={MAP.y + MAP.size + 15} text={tk.label} anchor="middle" size={11} muted />
			<Txt x={MAP.x - 7} y={Y(tk.v) + 4} text={tk.label} anchor="end" size={11} muted />
		{/each}
		<Txt
			x={MAP.x + MAP.size / 2}
			y={MAP.y + MAP.size + 32}
			text="{land.xName} →"
			anchor="middle"
			size={12}
		/>
		<Txt x={MAP.x + 6} y={MAP.y - 9} text="↑ {land.yName}" size={12} />
	</Readout>
</g>
