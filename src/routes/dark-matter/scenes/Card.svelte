<script lang="ts">
	/** A rounded card behind a block of readouts. */
	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		opacity?: number;
	}
	let { x, y, w, h, opacity = 1 }: Props = $props();
</script>

<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" {opacity} />
