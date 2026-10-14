<script lang="ts" module>
	import { WATER_PER_NM3 } from '../molecular';
	import { rng } from '../random';

	/**
	 * One tile of water molecules at their measured density (55 mol/L), seen as a
	 * slice 0.3 nm thick, packed at random at least 0.24 nm apart in projection,
	 * with wrap-around so that the tiles join without seams.
	 */
	const TILE = 7;
	const tile: { x: number; y: number; angle: number }[] = (() => {
		const r = rng(17);
		const want = Math.round(WATER_PER_NM3 * 0.3 * TILE * TILE);
		const out: { x: number; y: number; angle: number }[] = [];
		const d2 = (a: number, b: number) => {
			const d = Math.abs(a - b);
			return Math.min(d, TILE - d) ** 2;
		};
		for (let tries = 0; tries < want * 80 && out.length < want; tries++) {
			const x = r.range(0, TILE);
			const y = r.range(0, TILE);
			if (out.some((p) => d2(p.x, x) + d2(p.y, y) < 0.24 * 0.24)) continue;
			out.push({ x, y, angle: r.range(0, Math.PI * 2) });
		}
		// copies across the edges so that molecules cut by the tile's border stay whole
		return out.flatMap((p) =>
			[-TILE, 0, TILE].flatMap((ox) =>
				[-TILE, 0, TILE]
					.filter(
						(oy) =>
							(ox === 0 && oy === 0) ||
							(p.x + ox > -0.3 && p.x + ox < TILE + 0.3 && p.y + oy > -0.3 && p.y + oy < TILE + 0.3)
					)
					.map((oy) => ({ x: p.x + ox, y: p.y + oy, angle: p.angle }))
			)
		);
	})();
	const O = 0.096;
	const half = (104.5 / 2) * (Math.PI / 180);
	const oxygen = tile
		.map((w) => `M${w.x - 0.152} ${w.y}a0.152 0.152 0 1 0 0.304 0a0.152 0.152 0 1 0 -0.304 0Z`)
		.join('');
	const hydrogen = tile
		.flatMap((w) =>
			[-1, 1].map((s) => {
				const hx = w.x + O * Math.cos(w.angle + s * half);
				const hy = w.y + O * Math.sin(w.angle + s * half);
				return `M${hx - 0.12} ${hy}a0.12 0.12 0 1 0 0.24 0a0.12 0.12 0 1 0 -0.24 0Z`;
			})
		)
		.join('');
</script>

<script lang="ts">
	/**
	 * Water as a repeating texture, in nanometres: every speck is one molecule,
	 * at the real spacing. Used behind the molecule-scale views.
	 */
	interface Props {
		id: string;
		x0: number;
		y0: number;
		w: number;
		h: number;
		opacity?: number;
	}
	let { id, x0, y0, w, h, opacity = 1 }: Props = $props();
</script>

<defs>
	<pattern id="water-{id}" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
		<path d={hydrogen} fill="var(--tc-water)" opacity="0.6" />
		<path d={oxygen} fill="var(--tc-water)" />
	</pattern>
</defs>
<rect x={x0} y={y0} width={w} height={h} fill="url(#water-{id})" {opacity} />
