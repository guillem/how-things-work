<script lang="ts">
	/**
	 * A rendered 192 × 120 picture, drawn with square pixels. With `onpick` it is also a pixel
	 * picker: click or drag on it, or focus it (Tab) and move with the arrow keys (Shift: 10
	 * pixels); the picked pixel gets a ring. `reveal` (0…1) hides the rows not drawn yet, for the
	 * row-by-row ray tracer, with a scan line on the row being drawn.
	 */
	import { IMG_H, IMG_W } from './shared';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		url: string;
		label?: string;
		pick?: [number, number] | null;
		onpick?: (p: [number, number]) => void;
		reveal?: number;
		id: string;
	}
	let { x, y, w, h, url, label = 'Picture', pick = null, onpick, reveal = 1, id }: Props = $props();

	const px = $derived(w / IMG_W);
	const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));

	function pickAt(event: PointerEvent, el: SVGGraphicsElement) {
		const ctm = el.getScreenCTM();
		if (!ctm || !onpick) return;
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
		const i = clamp(Math.floor((p.x - x) / px), IMG_W);
		const j = clamp(Math.floor((p.y - y) / px), IMG_H);
		if (!pick || pick[0] !== i || pick[1] !== j) onpick([i, j]);
	}
	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || !onpick) return;
		const el = event.currentTarget as SVGGElement;
		event.preventDefault();
		el.focus();
		el.setPointerCapture?.(event.pointerId);
		pickAt(event, el);
	}
	function onpointermove(event: PointerEvent) {
		const el = event.currentTarget as SVGGElement;
		if (el.hasPointerCapture?.(event.pointerId)) pickAt(event, el);
	}
	function onkeydown(event: KeyboardEvent) {
		if (!onpick || !pick) return;
		const big = event.shiftKey ? 10 : 1;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-big, 0],
			ArrowRight: [big, 0],
			ArrowUp: [0, -big],
			ArrowDown: [0, big]
		};
		if (!(event.key in moves)) return;
		// Handled here, so the explainer does not also change step.
		event.preventDefault();
		const [dx, dy] = moves[event.key];
		onpick([clamp(pick[0] + dx, IMG_W), clamp(pick[1] + dy, IMG_H)]);
	}
	const shownRows = $derived(Math.round(Math.min(1, Math.max(0, reveal)) * IMG_H));
</script>

<g>
	<defs>
		<clipPath id="{id}-clip">
			<rect {x} {y} width={w} height={h} rx="6" />
		</clipPath>
	</defs>
	<rect {x} {y} width={w} height={h} rx="6" fill="var(--stage-grid)" />
	<g clip-path="url(#{id}-clip)">
		{#if url}
			<image
				href={url}
				{x}
				{y}
				width={w}
				height={h}
				preserveAspectRatio="none"
				style:image-rendering="pixelated"
			/>
		{/if}
		{#if shownRows < IMG_H}
			<rect
				{x}
				y={y + shownRows * px}
				width={w}
				height={h - shownRows * px}
				fill="var(--surface)"
			/>
			<rect {x} y={y + shownRows * px - 1} width={w} height="2" fill="var(--g3-eye)" />
		{/if}
	</g>
	<rect {x} {y} width={w} height={h} rx="6" fill="none" stroke="var(--border)" />
	{#if onpick && pick}
		<g
			class="g3-picker"
			role="slider"
			tabindex="0"
			aria-label="{label}: pick a pixel (arrow keys move it)"
			aria-valuenow={pick[1] * IMG_W + pick[0]}
			aria-valuemin={0}
			aria-valuemax={IMG_W * IMG_H - 1}
			aria-valuetext="pixel {pick[0] + 1} across, {pick[1] + 1} down"
			{onpointerdown}
			{onpointermove}
			{onkeydown}
		>
			<rect {x} {y} width={w} height={h} fill="transparent" />
			<rect
				class="ring"
				x={x - 4}
				y={y - 4}
				width={w + 8}
				height={h + 8}
				rx="8"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
			<rect
				x={x + pick[0] * px - 1.5}
				y={y + pick[1] * px - 1.5}
				width={px + 3}
				height={px + 3}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="3"
			/>
			<rect
				x={x + pick[0] * px - 1.5}
				y={y + pick[1] * px - 1.5}
				width={px + 3}
				height={px + 3}
				fill="none"
				stroke="var(--g3-eye)"
				stroke-width="1.6"
			/>
			<circle
				cx={x + (pick[0] + 0.5) * px}
				cy={y + (pick[1] + 0.5) * px}
				r={px * 3}
				fill="none"
				stroke="var(--g3-eye)"
				stroke-width="1.5"
				stroke-opacity="0.8"
			/>
		</g>
	{/if}
</g>

<style>
	.g3-picker {
		cursor: crosshair;
		touch-action: none;
		outline: none;
	}
	.ring {
		opacity: 0;
	}
	.g3-picker:focus-visible .ring {
		opacity: 1;
	}
</style>
