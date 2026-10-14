<script lang="ts">
	/**
	 * Liver tissue, ≈ 0.3 mm across, in micrometres: plates of liver cells one cell
	 * thick with sinusoids between them carrying red blood cells (see
	 * `liverTissue()` in liver.ts for the sizes). Static.
	 */
	import { liverTissue } from '../liver';
	import Part from './Part.svelte';
	import { circlePath, polyline, type FrameProps } from './types';

	let { sel, pick, interactive }: FrameProps = $props();

	const T = liverTissue();
	const cells = T.cells.map((c) => polyline(c.outline, true)).join('');
	const nuclei = T.cells.map((c) => circlePath(c.nucleus.x, c.nucleus.y, c.nucleus.r)).join('');
	const nucleoli = T.cells.map((c) => circlePath(c.nucleus.x + 1.3, c.nucleus.y - 1, 1)).join('');
	const rbcPath = T.rbcs
		.map((b) => {
			const ca = Math.cos(b.angle);
			const sa = Math.sin(b.angle);
			return `M${b.x - b.a * ca} ${b.y - b.a * sa}A${b.a} ${b.b} ${(b.angle * 180) / Math.PI} 1 0 ${b.x + b.a * ca} ${b.y + b.a * sa}A${b.a} ${b.b} ${(b.angle * 180) / Math.PI} 1 0 ${b.x - b.a * ca} ${b.y - b.a * sa}Z`;
		})
		.join('');
	const lining = T.lining
		.map((l) => `M${l.x - 2.5} ${l.y}a2.5 0.7 0 1 0 5 0a2.5 0.7 0 1 0 -5 0Z`)
		.join('');
</script>

<g>
	<defs>
		<pattern id="liver-dots" width="1.6" height="1.6" patternUnits="userSpaceOnUse">
			<ellipse cx="0.4" cy="0.5" rx="0.45" ry="0.22" fill="var(--tc-dots)" />
			<ellipse cx="1.2" cy="1.25" rx="0.3" ry="0.2" fill="var(--tc-dots)" />
		</pattern>
	</defs>
	<Part id="sinusoid" {sel} {pick} {interactive}>
		<rect x="-320" y="-220" width="640" height="440" fill="var(--tc-plasma)" />
	</Part>
	<Part id="hepatocyte" {sel} {pick} {interactive}>
		<path
			d={cells}
			fill="var(--tc-cytosol)"
			stroke="var(--tc-cytosol-edge)"
			stroke-width="1"
			vector-effect="non-scaling-stroke"
		/>
		<path d={cells} fill="url(#liver-dots)" />
	</Part>
	<Part id="nucleus" {sel} {pick} {interactive}>
		<path
			d={nuclei}
			fill="var(--tc-nucleus)"
			stroke="var(--tc-envelope)"
			stroke-width="1"
			vector-effect="non-scaling-stroke"
		/>
		<path d={nucleoli} fill="var(--tc-nucleolus)" />
	</Part>
	<Part id="redBloodCell" {sel} {pick} {interactive}>
		<path
			d={rbcPath}
			fill="var(--tc-rbc)"
			stroke="var(--tc-rbc-edge)"
			stroke-width="0.8"
			vector-effect="non-scaling-stroke"
		/>
	</Part>
	<path d={lining} fill="var(--tc-lining)" />
</g>
