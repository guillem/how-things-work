<script lang="ts">
	/**
	 * A molecular machine drawn from its traced outline (shapes.ts), at true
	 * size in nanometres: placed at (x, y), turned by `angle` (radians) and
	 * mirrored top-to-bottom when `flip` (for the other face of a membrane).
	 * `only` draws just the named groups (to make one part of a machine pickable).
	 */
	import { MACHINES } from '../shapes';
	import { colors } from '#lib/draw/index.ts';

	interface Props {
		id: keyof typeof MACHINES;
		x: number;
		y: number;
		angle?: number;
		flip?: boolean;
		opacity?: number;
		only?: string[];
	}
	let { id, x, y, angle = 0, flip = false, opacity = 1, only }: Props = $props();

	const FILL: Record<string, string> = {
		'atpSynthase/head': colors.atpSynthase,
		'atpSynthase/ring': '#c4563a',
		'atpSynthase/stalk': '#f4a283',
		'atpSynthase/base': '#d97a62',
		'ribosome80S/rna': 'var(--tc-rna)',
		'ribosome80S/protein': 'var(--tc-rprotein)',
		'ribosome80S/sec61': '#e8b04b',
		'ribosome80S/trna': '#fab005',
		'ribosome80S/mrna': '#e64980',
		'ribosome70S/rna': 'var(--tc-rna)',
		'ribosome70S/protein': 'var(--tc-rprotein)',
		'nucleosome/histones': 'var(--tc-histone)',
		'nucleosome/dna': 'var(--tc-dna)',
		'kChannel/channel': '#38a169',
		'naKPump/pump': '#d6336c',
		'glut1/transporter': '#f59f00',
		'psii/psii': colors.psii,
		'b6f/b6f': colors.cytb6f,
		'psi/psi': colors.psi,
		'cfAtpSynthase/atp': colors.atpSynthase,
		'rubisco/rubisco': colors.rubisco,
		'groEL/groEL': '#9775fa',
		'groEL/groES': '#c0a8ff',
		'rnaPolymerase/rnap': '#e64980',
		'efTuTrna/eftu': '#20c997',
		'efTuTrna/trna': '#fab005',
		'trna/trna': '#fab005',
		'adk/adk': 'var(--tc-protein)',
		'citrateSynthase/cs': '#74c0fc',
		'ompF/porin': '#94d82d',
		'lacY/lacy': '#ffa94d'
	};
	const m = $derived(MACHINES[id]);
	const groups = $derived(only ? m.groups.filter((g) => only.includes(g.name)) : m.groups);
</script>

<g
	transform="translate({x} {y}) rotate({(angle * 180) / Math.PI}) scale(1 {flip ? -1 : 1})"
	{opacity}
>
	{#each groups as g (g.name)}
		<path
			d={g.d}
			fill={FILL[`${id}/${g.name}`] ?? 'var(--tc-protein)'}
			fill-rule="evenodd"
			stroke="var(--stage-ink)"
			stroke-opacity="0.35"
			stroke-width="0.12"
			stroke-linejoin="round"
		/>
	{/each}
</g>
