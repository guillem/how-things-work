<script lang="ts" module>
	/** Fixed colours that read on both stage backgrounds, with white text. */
	export const CARRIER = { nadh: '#1c7ed6', fadh2: '#2f9e44', gtp: '#f97316', grey: '#6c757d' } as const;
</script>

<script lang="ts">
	/**
	 * Respiration's own electron carriers and GTP, drawn as pills in the style
	 * of the shared `<Molecule>` ATP/NADPH pills: filled when charged (NADH,
	 * FADH₂, GTP), outlined when empty (NAD⁺, FAD, GDP). Kept here, not in
	 * `src/lib/draw`, because only this explainer uses them.
	 */
	type Kind = 'NADH' | 'NAD+' | 'FADH2' | 'FAD' | 'GTP' | 'lactate' | 'pyruvate';
	interface Props {
		kind: Kind;
		x?: number;
		y?: number;
		scale?: number;
		opacity?: number;
	}
	let { kind, x = 0, y = 0, scale = 1, opacity = 1 }: Props = $props();

	const spec = $derived(
		{
			NADH: { c: CARRIER.nadh, full: true, w: 46, text: 'NADH' },
			'NAD+': { c: CARRIER.nadh, full: false, w: 46, text: 'NAD⁺' },
			FADH2: { c: CARRIER.fadh2, full: true, w: 50, text: 'FADH₂' },
			FAD: { c: CARRIER.fadh2, full: false, w: 40, text: 'FAD' },
			GTP: { c: CARRIER.gtp, full: true, w: 34, text: 'GTP' },
			lactate: { c: CARRIER.grey, full: true, w: 56, text: 'lactate' },
			pyruvate: { c: CARRIER.grey, full: false, w: 60, text: 'pyruvate' }
		}[kind]
	);
</script>

<g transform="translate({x} {y}) scale({scale})" {opacity} style:pointer-events="none">
	<rect
		x={-spec.w / 2}
		y="-9"
		width={spec.w}
		height="18"
		rx="9"
		fill={spec.full ? spec.c : 'var(--stage-bg)'}
		stroke={spec.c}
		stroke-width={spec.full ? 0 : 1.5}
	/>
	<text
		y="3.6"
		text-anchor="middle"
		font-size="9.5"
		font-weight="700"
		fill={spec.full ? '#fff' : spec.c}
		style="stroke: none">{spec.text}</text
	>
</g>
