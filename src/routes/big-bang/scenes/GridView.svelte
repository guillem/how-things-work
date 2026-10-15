<script lang="ts">
	/**
	 * One window onto the endless lattice of galaxies, centred on a viewpoint. The lattice is an
	 * SVG pattern (so it fills the window at any density, with no edge), used as a mask over a
	 * radial gradient that colours every galaxy by the redshift of the light reaching the
	 * viewpoint from it (computed by `redshiftSeen` at a few radii). Galaxies keep their size;
	 * only the spacing follows the scale factor a. Arrows show recession speeds, v = H × d,
	 * relative to the viewpoint.
	 */
	import type { Point } from '#lib/draw/index.ts';
	import { redshiftSeen } from '../cosmology';
	import { ARROW_TIME, NAMED, S, TILE, galaxy, nearest, sample } from './grid';
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		/** Unique prefix for this view's ids. */
		id: string;
		x: number;
		y: number;
		w: number;
		h: number;
		/** Camera position, comoving Gly (eases between viewpoints). */
		cam: Point;
		/** Lattice index of the viewpoint galaxy. */
		vi: number;
		vj: number;
		a: number;
		/** Minimum spacing between arrows, px. */
		gap?: number;
		arrows?: boolean;
		/** Animation time, s: the arrows' dashes march outwards. */
		t?: number;
		/** Called with a lattice index when the reader clicks a galaxy. */
		onpick?: (i: number, j: number) => void;
	}
	let { id, x, y, w, h, cam, vi, vj, a, gap = 52, arrows = true, t = 0, onpick }: Props = $props();

	const CX = $derived(x + w / 2);
	const CY = $derived(y + h / 2);
	const px = $derived(S * a); // px per comoving Gly
	const r = $derived(Math.max(1.4, Math.min(3.2, 0.24 * px)));

	// The pattern tile: TILE × TILE galaxies, the tile's corner at comoving (−½, −½).
	const tile = $derived(
		Array.from({ length: TILE * TILE }, (_, k) => {
			const i = k % TILE;
			const j = Math.floor(k / TILE);
			const g = galaxy(i, j);
			return { k, x: (g.x + 0.5) * px, y: (g.y + 0.5) * px };
		})
	);
	const ox = $derived(CX + (-0.5 - cam.x) * px);
	const oy = $derived(CY + (-0.5 - cam.y) * px);

	// Redshift colours, by distance from the viewpoint.
	const R = $derived(Math.hypot(w, h) / 2 + 8);
	const ZMAX = 1.5;
	const stops = $derived(
		Array.from({ length: 13 }, (_, k) => {
			const f = k / 12;
			const z = redshiftSeen((f * R) / px, a);
			const seen = Number.isFinite(z);
			const m = seen ? Math.min(1, Math.log1p(z) / Math.log1p(ZMAX)) : 1;
			const mid = m < 0.5 ? m * 2 : 1;
			const color =
				m < 0.5
					? `color-mix(in srgb, var(--bb-mid) ${Math.round(mid * 100)}%, var(--bb-gal))`
					: `color-mix(in srgb, var(--bb-red) ${Math.round((m - 0.5) * 200)}%, var(--bb-mid))`;
			return { k, f, color, opacity: seen ? 1 : 0.5 };
		})
	);

	// Arrows: speed × ARROW_TIME/H, i.e. where each galaxy would be after 0.3 of the
	// Hubble time at its present speed (v = H d), so the arrows are ARROW_TIME × d long.
	const shown = $derived(arrows ? sample(vi, vj, cam, a, w / 2, h / 2, gap) : []);
	const arrowList = $derived(
		shown
			.filter((s) => s.d * S > 14)
			.map((s) => {
				const len = ARROW_TIME * s.d * S;
				const ux = s.dx / (s.d * S);
				const uy = s.dy / (s.d * S);
				const x0 = CX + s.dx + ux * (r + 3);
				const y0 = CY + s.dy + uy * (r + 3);
				return { key: s.key, x0, y0, x1: x0 + ux * len, y1: y0 + uy * len, ux, uy };
			})
	);

	// Named galaxies on screen.
	const named = $derived(
		Object.entries(NAMED).map(([key, n]) => {
			const g = galaxy(n.i, n.j);
			return {
				key,
				name: n.name,
				X: CX + (g.x - cam.x) * px,
				Y: CY + (g.y - cam.y) * px,
				isView: n.i === vi && n.j === vj
			};
		})
	);
	const viewG = $derived(galaxy(vi, vj));
	const VX = $derived(CX + (viewG.x - cam.x) * px);
	const VY = $derived(CY + (viewG.y - cam.y) * px);

	function click(e: MouseEvent) {
		if (!onpick) return;
		const svg = (e.currentTarget as SVGElement).ownerSVGElement;
		const ctm = svg?.getScreenCTM();
		if (!svg || !ctm) return;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		const n = nearest(cam.x + (p.x - CX) / px, cam.y + (p.y - CY) / px);
		onpick(n.i, n.j);
	}
</script>

<g>
	<defs>
		<clipPath id="{id}-clip">
			<rect {x} {y} width={w} height={h} rx="12" />
		</clipPath>
		<pattern
			id="{id}-pat"
			patternUnits="userSpaceOnUse"
			width={TILE * px}
			height={TILE * px}
			patternTransform="translate({ox} {oy})"
		>
			{#each tile as g (g.k)}
				<circle cx={g.x} cy={g.y} {r} fill="#fff" />
			{/each}
		</pattern>
		<mask id="{id}-mask" maskUnits="userSpaceOnUse" {x} {y} width={w} height={h}>
			<rect {x} {y} width={w} height={h} fill="url(#{id}-pat)" />
		</mask>
		<radialGradient id="{id}-z" gradientUnits="userSpaceOnUse" cx={VX} cy={VY} r={R}>
			{#each stops as s (s.k)}
				<stop offset={s.f} style:stop-color={s.color} stop-opacity={s.opacity} />
			{/each}
		</radialGradient>
	</defs>
	<rect {x} {y} width={w} height={h} rx="12" fill="var(--bb-space)" stroke="var(--border)" />
	<g clip-path="url(#{id}-clip)">
		<rect {x} {y} width={w} height={h} fill="url(#{id}-z)" mask="url(#{id}-mask)" />
		{#each arrowList as s (s.key)}
			<line
				x1={s.x0}
				y1={s.y0}
				x2={s.x1 - s.ux * 3}
				y2={s.y1 - s.uy * 3}
				stroke="var(--bb-arrow)"
				stroke-width="1.6"
				stroke-dasharray="7 3"
				stroke-dashoffset={-((t * 14) % 10)}
				opacity="0.85"
			/>
			<path
				d="M{s.x1} {s.y1} L{s.x1 - s.ux * 6 - s.uy * 3.2} {s.y1 - s.uy * 6 + s.ux * 3.2} L{s.x1 -
					s.ux * 6 +
					s.uy * 3.2} {s.y1 - s.uy * 6 - s.ux * 3.2} Z"
				fill="var(--bb-arrow)"
				opacity="0.85"
			/>
		{/each}
		<!-- the named galaxies -->
		{#each named as n (n.key)}
			{#if !n.isView}
				<circle
					cx={n.X}
					cy={n.Y}
					r={r + 2.5}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.2"
				/>
				{#if px > 26}
					{@const right = n.X > x + w - 90}
					<Label
						x={right ? n.X - r - 6 : n.X + r + 6}
						y={n.Y - r - 4}
						text={n.name}
						size={12}
						weight={650}
						anchor={right ? 'end' : 'start'}
					/>
				{/if}
			{/if}
		{/each}
		<!-- the viewpoint -->
		<circle cx={VX} cy={VY} r={r + 2} fill="var(--bb-view)" />
		<circle cx={VX} cy={VY} r={r + 7} fill="none" stroke="var(--bb-view)" stroke-width="1.5" />
		{#if !named.some((n) => n.isView)}
			<Label
				anchor="start"
				x={VX + r + 10}
				y={VY - r - 6}
				text="you"
				size={12.5}
				weight={700}
				color="var(--bb-view)"
			/>
		{/if}
		{#each named as n (n.key)}
			{#if n.isView}
				<Label
					anchor="start"
					x={n.X + r + 10}
					y={n.Y - r - 6}
					text="{n.name} (you)"
					size={12.5}
					weight={700}
					color="var(--bb-view)"
				/>
			{/if}
		{/each}
	</g>
	{#if onpick}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<rect {x} {y} width={w} height={h} fill="transparent" style:cursor="pointer" onclick={click} />
	{/if}
</g>
