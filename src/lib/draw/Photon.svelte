<script lang="ts">
	/**
	 * A photon drawn as a short wavy line with a bright head, pointing in the
	 * direction `angle` (degrees, clockwise from +x). Colour defaults to a warm
	 * sunlight yellow; pass `wavelength` to colour it by wavelength.
	 */
	import { colors, wavelengthToColor } from './palette';
	import { wavePath } from './math';

	interface Props {
		x: number;
		y: number;
		angle?: number;
		length?: number;
		amplitude?: number;
		wavelength?: number;
		color?: string;
		opacity?: number;
		/** Phase offset (0–1) so the wave appears to travel. */
		phase?: number;
	}
	let {
		x,
		y,
		angle = 0,
		length = 42,
		amplitude = 4,
		wavelength,
		color,
		opacity = 1,
		phase = 0
	}: Props = $props();

	const stroke = $derived(color ?? (wavelength ? wavelengthToColor(wavelength) : colors.photon));
	const lambda = $derived(wavelength ? 8 + (wavelength - 400) / 25 : 14);
	const d = $derived(wavePath(length, amplitude, lambda));
</script>

<g transform="translate({x} {y}) rotate({angle})" {opacity} style:pointer-events="none">
	<path
		{d}
		fill="none"
		{stroke}
		stroke-width="2.2"
		stroke-linecap="round"
		transform="translate({-length} 0)"
		stroke-dasharray="{lambda * 0.7} {lambda * 0.3}"
		stroke-dashoffset={-phase * lambda}
	/>
	<circle r="4" fill={stroke} />
	<circle r="7" fill={stroke} opacity="0.35" />
</g>
