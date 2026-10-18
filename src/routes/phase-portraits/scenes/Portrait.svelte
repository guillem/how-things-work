<script lang="ts">
	/**
	 * A phase portrait in a rectangle of the stage: a grid of small arrows
	 * (the direction of the velocity at each point), the orbits through the
	 * seeded starts traced with RK4, and dots riding along them. The parent
	 * draws whatever goes over it (fixed points, eigenvectors, the axes) with
	 * the same scales (`scales(rect, box)`).
	 *
	 * The dots are a pure function of t: each runs along its orbit from the
	 * orbit's earliest point, looping every `loop` time units of the system,
	 * at `rate` system time units per second, fading in and out at the ends.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { at, orbit, type Box, type Field, type Orbit, type Vec } from '../phase';
	import { scales, type Rect } from './layout';

	interface Props {
		rect: Rect;
		box: Box;
		field: Field;
		starts: Vec[];
		t: number;
		/** Unique id prefix for the clip path. */
		id: string;
		/** Trace backwards from the starts too. */
		back?: boolean;
		tMax?: number;
		h?: number;
		/** Arrows per side. */
		grid?: number;
		/** System time units per second for the dots, and the length of their loop. */
		rate?: number;
		loop?: number;
		opacity?: number;
	}
	let {
		rect,
		box,
		field,
		starts,
		t,
		id,
		back = true,
		tMax = 12,
		h = 0.01,
		grid = 17,
		rate = 1.6,
		loop = 14,
		opacity = 1
	}: Props = $props();

	const sc = $derived(scales(rect, box));

	// ---- arrows -------------------------------------------------------------------
	const ARROW = 13;
	const arrows = $derived.by(() => {
		const { sx, sy } = sc;
		const w = rect.right - rect.left;
		const hgt = rect.bottom - rect.top;
		/** Stage units per data unit, across and up. */
		const kx = w / (box.x[1] - box.x[0]);
		const ky = hgt / (box.y[1] - box.y[0]);
		let d = '';
		let dots = '';
		for (let i = 0; i < grid; i++)
			for (let j = 0; j < grid; j++) {
				const px = rect.left + ((i + 0.5) * w) / grid;
				const py = rect.top + ((j + 0.5) * hgt) / grid;
				const [u, v] = field(sx.invert(px), sy.invert(py));
				const ux = u * kx;
				const uy = -v * ky;
				const n = Math.hypot(ux, uy);
				if (!(n > 1e-9)) {
					dots += `M${px.toFixed(1)} ${py.toFixed(1)}h0.01`;
					continue;
				}
				const ex = ux / n;
				const ey = uy / n;
				const x0 = px - (ex * ARROW) / 2;
				const y0 = py - (ey * ARROW) / 2;
				const x1 = px + (ex * ARROW) / 2;
				const y1 = py + (ey * ARROW) / 2;
				// arrowhead: two short strokes back from the tip
				const hx = -ex * 4.5;
				const hy = -ey * 4.5;
				d +=
					`M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}` +
					`M${(x1 + hx - ey * 3).toFixed(1)} ${(y1 + hy + ex * 3).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}` +
					`L${(x1 + hx + ey * 3).toFixed(1)} ${(y1 + hy - ex * 3).toFixed(1)}`;
			}
		return { d, dots };
	});

	// ---- orbits ---------------------------------------------------------------------
	const orbits = $derived(starts.map(([x, y]) => orbit(field, x, y, { box, tMax, h, back })));

	function path(o: Orbit): string {
		const { sx, sy } = sc;
		const mx = (box.x[1] - box.x[0]) / 4;
		const my = (box.y[1] - box.y[0]) / 4;
		const cx = (v: number) => Math.min(Math.max(v, box.x[0] - mx), box.x[1] + mx);
		const cy = (v: number) => Math.min(Math.max(v, box.y[0] - my), box.y[1] + my);
		let d = '';
		for (let i = 0; i < o.x.length; i++)
			d += `${i ? 'L' : 'M'}${sx(cx(o.x[i])).toFixed(1)} ${sy(cy(o.y[i])).toFixed(1)}`;
		return d;
	}
	const paths = $derived(orbits.map((o, i) => ({ key: i, d: path(o) })));

	// ---- dots -------------------------------------------------------------------------
	const dots = $derived(
		orbits.map((o, i) => {
			const t0 = o.t[0];
			const span = Math.min(o.t[o.t.length - 1] - t0, loop);
			if (!(span > 0.2)) return { key: i, p: null, a: 0 };
			// stagger the dots so they don't all set off together
			const phase = (t * rate + (i * 0.37 * loop) / starts.length) % span;
			const p = at(o, t0 + phase);
			const u = phase / span;
			return { key: i, p, a: smoothstep(0, 0.08, u) * (1 - smoothstep(0.88, 1, u)) };
		})
	);
</script>

<g {opacity}>
	<defs>
		<clipPath id="{id}-clip">
			<rect
				x={rect.left}
				y={rect.top}
				width={rect.right - rect.left}
				height={rect.bottom - rect.top}
			/>
		</clipPath>
	</defs>
	<g clip-path="url(#{id}-clip)" pointer-events="none">
		<path
			d={arrows.d}
			fill="none"
			stroke="var(--pp-field)"
			stroke-width="1.3"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path d={arrows.dots} stroke="var(--pp-field)" stroke-width="3" stroke-linecap="round" />
		{#each paths as p (p.key)}
			<path
				d={p.d}
				fill="none"
				stroke="var(--pp-orbit)"
				stroke-width="1.8"
				stroke-linejoin="round"
				opacity="0.9"
			/>
		{/each}
		{#each dots as dot (dot.key)}
			{#if dot.p && dot.a > 0.01}
				<circle
					cx={sc.sx(dot.p[0])}
					cy={sc.sy(dot.p[1])}
					r="4.2"
					fill="var(--pp-dot)"
					stroke="var(--stage-bg)"
					stroke-width="1.2"
					opacity={dot.a}
				/>
			{/if}
		{/each}
	</g>
</g>
