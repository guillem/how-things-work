<script lang="ts">
	/**
	 * The gap between sequences and shapes: one orange dot for the structures measured in the
	 * PDB against the grey dots of UniProt's sequences, at the real ratio (about 575 to 1).
	 * The dots are one path, so the picture stays a handful of SVG nodes.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PDB_ENTRIES, UNIPROT_SEQUENCES } from '../folding';
	import Label from './Text.svelte';

	let { t, reduced }: StageProps = $props();

	const RATIO = Math.round(UNIPROT_SEQUENCES / PDB_ENTRIES);
	const COLS = 25;
	const GAP = 17;
	const X0 = 60;
	const Y0 = 120;
	const R = 6;
	const rows = Math.ceil(RATIO / COLS);
	const dot = (i: number) => ({ x: X0 + (i % COLS) * GAP, y: Y0 + Math.floor(i / COLS) * GAP });
	const circle = (x: number, y: number) =>
		`M${x - R} ${y}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`;

	/** Rows of grey dots shown so far: they fill in over the first three seconds. */
	const shown = $derived(reduced ? rows : Math.round(rows * smoothstep(0.6, 3.4, t)));
	const grey = $derived.by(() => {
		let d = '';
		for (let i = 1; i < Math.min(RATIO, shown * COLS); i++) {
			const p = dot(i);
			d += circle(p.x, p.y);
		}
		return d;
	});
	const first = dot(0);
	const n = (v: number) => v.toLocaleString('en-US');
</script>

<g style:font-variant-numeric="tabular-nums">
	<Readout id="title" order={1} label="Every dot" value="about {n(PDB_ENTRIES)} proteins">
		<Label
			x={X0 - 6}
			y={64}
			text="Each dot stands for about {n(PDB_ENTRIES)} proteins"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<path d={grey} fill="var(--stage-ink-muted)" opacity="0.45" />
	<circle
		cx={first.x}
		cy={first.y}
		r={R + 1.5}
		fill="var(--pf-h)"
		stroke="var(--pf-h-edge)"
		stroke-width="1.5"
	/>

	<Readout
		id="pdb"
		order={2}
		label="Shape measured"
		value="{n(PDB_ENTRIES)} structures in the PDB"
		color="var(--pf-h)"
	>
		<circle
			cx="560"
			cy="134"
			r="8"
			fill="var(--pf-h)"
			stroke="var(--pf-h-edge)"
			stroke-width="1.5"
		/>
		<Label x={578} y={130} text="shape measured" size={14} weight={600} anchor="start" />
		<Label
			x={578}
			y={148}
			text="{n(PDB_ENTRIES)} structures in the PDB"
			size={12}
			anchor="start"
			muted
		/>
		<Label x={578} y={164} text="(many of the same protein)" size={12} anchor="start" muted />
	</Readout>
	<Readout
		id="seq"
		order={3}
		label="Only the sequence known"
		value="{n(UNIPROT_SEQUENCES)} in UniProt"
		color="var(--stage-ink-muted)"
	>
		<circle cx="560" cy="210" r="7" fill="var(--stage-ink-muted)" opacity="0.45" />
		<Label x={578} y={206} text="only the sequence known" size={14} weight={600} anchor="start" />
		<Label
			x={578}
			y={224}
			text="{n(UNIPROT_SEQUENCES)} sequences in UniProt"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
	<Readout id="ratio" order={4} label="Ratio" value="1 shape measured for every {RATIO} sequences">
		<Label x={560} y={290} text="1 for every {RATIO}" size={26} weight={700} anchor="start" />
		<Label x={560} y={314} text="sequences are cheap to read;" size={13} anchor="start" />
		<Label x={560} y={332} text="shapes take months to measure" size={13} anchor="start" />
	</Readout>
	<Readout id="src">
		<Label x={560} y={520} text="RCSB PDB, October 2026" size={11} anchor="start" muted />
		<Label x={560} y={536} text="UniProtKB release 2026_03" size={11} anchor="start" muted />
	</Readout>
</g>
