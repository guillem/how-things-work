<script lang="ts" module>
	/**
	 * A single small molecule, atom by atom, in nanometres from the view's centre,
	 * surrounded by water molecules at their measured density (55 mol/L, seen as a
	 * slice 0.3 nm thick). DNA is laid along the view and continues as a 2 nm band
	 * beyond its 12 traced base pairs; the chlorophyll sits inside an antenna
	 * protein, whose atoms are not drawn.
	 */
	import { SMALL_MOLECULES } from '../shapes';
	import { waters } from '../molecular';

	type MolId = keyof typeof SMALL_MOLECULES;
	const WHICH: Record<string, { id: MolId; lay: boolean; angle: number; wet: boolean }> = {
		dnaAtoms: { id: 'dna', lay: true, angle: 0, wet: true },
		atpAtoms: { id: 'atp', lay: false, angle: 0.3, wet: true },
		chlorophyllAtoms: { id: 'chlorophyll', lay: false, angle: 0, wet: false },
		glucoseAtoms: { id: 'glucose', lay: false, angle: 0.4, wet: true }
	};
	const R: Record<string, number> = { H: 0.12, C: 0.17, N: 0.155, O: 0.152, P: 0.18, MG: 0.173 };
	const W = 9;
	const Hh = 6;
	function watersFor(key: string) {
		const w = WHICH[key];
		const atoms = SMALL_MOLECULES[w.id].atoms;
		const c = Math.cos(w.angle);
		const s = Math.sin(w.angle);
		const pts = atoms.map(([el, x, y]) => {
			const [ux, uy] = w.lay ? [y, -x] : [x, y];
			return [ux * c - uy * s, ux * s + uy * c, R[el] ?? 0.17] as const;
		});
		const keep = (x: number, y: number) =>
			pts.some(([px, py, r]) => Math.hypot(px - x, py - y) < r + 0.2) ||
			(w.id === 'dna' && Math.abs(y) < 1.15);
		return waters(W, Hh, keep, 0.3, 3);
	}
	const cache: Record<string, ReturnType<typeof waters>> = {};
</script>

<script lang="ts">
	import Mol from './Mol.svelte';
	import Part from './Part.svelte';
	import type { Frame } from '../frames';
	import type { FrameProps } from './types';

	let { frame, sel, pick, interactive }: FrameProps & { frame: Frame } = $props();
	const w = $derived(WHICH[frame.id] ?? WHICH.atpAtoms);
	const ws = $derived.by(() => {
		cache[frame.id] ??= w.wet ? watersFor(frame.id) : [];
		return cache[frame.id];
	});
	const half = (104.5 / 2) * (Math.PI / 180);
</script>

<g>
	{#if w.wet}
		<Part id="water" {sel} {pick} {interactive}>
			<rect x={-W} y={-Hh} width={2 * W} height={2 * Hh} fill="var(--tc-cytosol)" />
			{#each ws as m, i (i)}
				<g transform="translate({m.x} {m.y}) rotate({(m.angle * 180) / Math.PI})">
					<circle
						cx={0.096 * Math.cos(half)}
						cy={0.096 * Math.sin(half)}
						r="0.12"
						fill="var(--tc-water)"
						opacity="0.45"
					/>
					<circle
						cx={0.096 * Math.cos(half)}
						cy={-0.096 * Math.sin(half)}
						r="0.12"
						fill="var(--tc-water)"
						opacity="0.45"
					/>
					<circle r="0.152" fill="var(--tc-water)" opacity="0.7" />
				</g>
			{/each}
		</Part>
	{:else}
		<Part id="psii" {sel} {pick} {interactive}>
			<rect x={-W} y={-Hh} width={2 * W} height={2 * Hh} fill="var(--tc-protein)" />
		</Part>
	{/if}
	{#if w.id === 'dna'}
		<!-- the double helix continues beyond the 12 traced base pairs -->
		<path
			d="M-12 -1H-2.1M2.1 -1H12M-12 1H-2.1M2.1 1H12"
			stroke="var(--tc-dna)"
			stroke-width="0.5"
			opacity="0.6"
		/>
		<rect x="-12" y="-1" width="9.9" height="2" fill="var(--tc-dna)" opacity="0.25" />
		<rect x="2.1" y="-1" width="9.9" height="2" fill="var(--tc-dna)" opacity="0.25" />
	{/if}
	<Part id={frame.focus} {sel} {pick} {interactive}>
		<Mol id={w.id} x={0} y={0} angle={w.angle} lay={w.lay} />
	</Part>
</g>
