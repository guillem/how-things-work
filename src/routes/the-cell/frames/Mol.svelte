<script lang="ts">
	/**
	 * A small molecule atom by atom (shapes.ts), in nanometres: each atom a disc
	 * of its van der Waals radius (Bondi 1964), back to front, in the usual
	 * chemistry colours.
	 */
	import { SMALL_MOLECULES } from '../shapes';
	import { colors } from '#lib/draw/index.ts';

	interface Props {
		id: keyof typeof SMALL_MOLECULES;
		x: number;
		y: number;
		angle?: number;
		/** Swap x and y before turning (to lay a vertical molecule down). */
		lay?: boolean;
		/** DNA: colour each atom by its base (A, T, C, G) or as backbone. */
		byBase?: boolean;
	}
	let { id, x, y, angle = 0, lay = false, byBase = false }: Props = $props();
	const BASE: Record<string, string> = {
		A: '#f76707',
		T: '#fab005',
		C: '#40c057',
		G: '#228be6',
		b: '#adb5bd'
	};

	const RADIUS: Record<string, number> = {
		H: 0.12,
		C: 0.17,
		N: 0.155,
		O: 0.152,
		P: 0.18,
		MG: 0.173
	};
	const FILL: Record<string, string> = {
		H: colors.hydrogen,
		C: 'var(--carbon)',
		N: colors.nitrogen,
		O: colors.oxygen,
		P: colors.phosphate,
		MG: '#40c057'
	};
	const atoms = $derived(SMALL_MOLECULES[id].atoms);
</script>

<g transform="translate({x} {y}) rotate({(angle * 180) / Math.PI})">
	{#each atoms as [el, ax, ay, , tag], i (i)}
		<circle
			cx={lay ? ay : ax}
			cy={lay ? -ax : ay}
			r={RADIUS[el] ?? 0.17}
			fill={byBase && tag ? BASE[tag] : (FILL[el] ?? '#a0a')}
			stroke="var(--stage-ink)"
			stroke-opacity="0.45"
			stroke-width="0.012"
		/>
	{/each}
</g>
