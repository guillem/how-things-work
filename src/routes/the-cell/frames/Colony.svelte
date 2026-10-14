<script lang="ts" module>
	/**
	 * E. coli cells ≈ 1 µm wide and 1.6–3 µm long, in micrometres (bacterium.ts),
	 * with their flagella: 20 nm thick (drawn as hairlines, a true width of 0.6 px
	 * at this scale), 5–9 µm long, helices 0.5 µm across with a 2.5 µm pitch.
	 * The flagella turn: the wave runs along them (slowed down: real flagella turn
	 * about 100 times a second).
	 */
	import { colony, flagellumPath } from '../bacterium';
	import { capsulePath, polyline } from './types';

	const cells = colony();
	const bodies = cells.map((c) => capsulePath(c.x, c.y, c.a, c.b, c.angle)).join('');
</script>

<script lang="ts">
	import Part from './Part.svelte';
	import type { FrameProps } from './types';

	let { ppu, t, reduced, sel, pick, interactive }: FrameProps = $props();
	// a slow travelling wave (µm per second along the flagellum)
	const shift = $derived(reduced ? 0 : t * 0.6);
	const flagella = $derived(
		cells.flatMap((c) => c.flagella.map((f) => polyline(flagellumPath(c, f, shift, 0.08)))).join('')
	);
</script>

<g>
	<rect x="-40" y="-30" width="80" height="60" fill="var(--tc-medium)" />
	<Part id="flagellum" {sel} {pick} {interactive}>
		<path
			d={flagella}
			fill="none"
			stroke="var(--tc-flagellum)"
			stroke-width={Math.max(0.02, 0.9 / ppu)}
			stroke-linecap="round"
		/>
	</Part>
	<Part id="ecoli" {sel} {pick} {interactive}>
		<path
			d={bodies}
			fill="var(--tc-ecoli)"
			stroke="var(--tc-envelope-b)"
			stroke-width={Math.max(0.026, 1.2 / ppu)}
		/>
	</Part>
</g>
