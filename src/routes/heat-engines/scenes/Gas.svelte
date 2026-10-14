<script lang="ts">
	/**
	 * Gas in a rectangle: a fill coloured by temperature and molecules that fly
	 * back and forth, faster when hotter (speed ∝ √T, as in the entropy
	 * explainer). Each molecule bounces between the walls on a triangle wave
	 * of a shared phase, so they stay inside however the rectangle is resized.
	 *
	 * Sanctioned exception (scene guide): the phase is the integral of a speed
	 * that changes with the temperature, so it is accumulated frame to frame. It
	 * ignores dt ≤ 0 (pause, step reset) and long gaps, and is still under
	 * reduced motion.
	 */
	import { hash, pingpong } from '#lib/draw/index.ts';
	import { tempMix } from './colors';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		/** Gas temperature, K. */
		T: number;
		t: number;
		n?: number;
		/** Burnt gas (exhaust): greyer molecules. */
		burnt?: boolean;
		opacity?: number;
		reduced?: boolean;
	}
	let { x, y, w, h, T, t, n = 26, burnt = false, opacity = 1, reduced = false }: Props = $props();

	const R = 3.2;
	const speed = $derived(Math.sqrt(Math.max(T, 50) / 300));
	let phase = 0;
	let last = -1;
	const clock = $derived.by(() => {
		const now = t;
		if (reduced) return phase;
		const dt = now - last;
		if (last >= 0 && dt > 0 && dt < 0.5) phase += dt * speed;
		last = now;
		return phase;
	});
	const dots = $derived(
		Array.from({ length: n }, (_, i) => {
			const px = 2.2 + 2.5 * hash(i, 1);
			const py = 1.9 + 2.3 * hash(i, 2);
			const u = pingpong(clock, px, hash(i, 3));
			const v = pingpong(clock, py, hash(i, 4));
			return {
				i,
				cx: x + R + u * Math.max(0, w - 2 * R),
				cy: y + R + v * Math.max(0, h - 2 * R)
			};
		})
	);
</script>

<g {opacity}>
	<rect {x} {y} width={w} height={Math.max(0, h)} fill={tempMix(T)} opacity="0.32" />
	{#each dots as d (d.i)}
		<circle
			cx={d.cx}
			cy={d.cy}
			r={R}
			fill={burnt ? 'var(--he-metal-edge)' : tempMix(T)}
			opacity="0.9"
		/>
	{/each}
</g>
