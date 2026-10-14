<script lang="ts" module>
	import { waters } from '../molecular';

	/** One tile of water molecules at their measured density (55 mol/L), seen as a thin slice. */
	const TILE = 7;
	const tile = waters(TILE, TILE, () => false, 0.3, 17);
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
