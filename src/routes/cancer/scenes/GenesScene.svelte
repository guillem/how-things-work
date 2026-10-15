<script lang="ts">
	/**
	 * The two kinds of driver gene. Top: the real start of KRAS (codons 1–20, RefSeq
	 * NM_004985.5) read by the genetic code, with codon 12 changed by `params.kras`.
	 * Bottom left: the KRAS switch, flicking on and off in a normal cell and jammed on in a
	 * mutant. Bottom right: TP53, a brake with two copies: it fails only when both are hit.
	 */
	import { Label, Flow, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { amino } from '../../dna-to-protein/genetics';
	import { KRAS_CODON12, krasWith, type KrasChange } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const change = $derived(String(params.kras ?? 'G12D') as KrasChange);
	const normal = krasWith('none');
	const mutant = $derived(krasWith(change));
	const mutated = $derived(change !== 'none');

	// ---- the gene ----------------------------------------------------------------------
	const BX = 40;
	const BW = 44;
	const BY = 70;
	const codons = $derived(
		Array.from({ length: 20 }, (_, i) => {
			const c = mutant.dna.slice(3 * i, 3 * i + 3);
			const before = normal.dna.slice(3 * i, 3 * i + 3);
			return {
				i,
				x: BX + i * BW,
				letters: [...c].map((b, j) => ({ b, changed: b !== before[j], j })),
				aa: amino(mutant.protein[i]).three,
				changed: c !== before
			};
		})
	);
	const c12 = KRAS_CODON12 / 3;
	const aaBefore = amino(normal.protein[c12]);
	const aaAfter = $derived(amino(mutant.protein[c12]));

	// ---- the switch --------------------------------------------------------------------
	const tt = $derived(reduced ? 1.2 : t);
	/** Normal KRAS: a signal arrives, the switch is on for a while, then turns itself off. */
	const phase = $derived(cycle(tt, 4));
	const onNormal = $derived(smoothstep(0.12, 0.2, phase) * (1 - smoothstep(0.5, 0.58, phase)));
	const signal = $derived(1 - smoothstep(0.1, 0.18, phase));
	const ROWS = [
		{ id: 'normal', y: 330, label: 'normal KRAS' },
		{ id: 'mutant', y: 470, label: '' }
	];
	const mutantLabel = $derived(mutated ? `${change}: stuck on` : 'unchanged KRAS');
	const onOf = (id: string) => (id === 'mutant' && mutated ? 1 : onNormal);

	// ---- the brakes --------------------------------------------------------------------
	const COLS = [
		{ id: 'none', x: 560, hits: 0, title: 'both copies work', brake: 'brake works' },
		{ id: 'one', x: 700, hits: 1, title: 'one copy hit', brake: 'brake still works' },
		{ id: 'two', x: 840, hits: 2, title: 'both copies hit', brake: 'no brake' }
	];
</script>

<g class="genes-scene">
	<!-- ===================== the gene ===================== -->
	<Readout id="gene-title">
		<text x={BX} y={40} font-size="15" font-weight="600"
			>KRAS, the start of the gene: codons 1–20</text
		>
	</Readout>
	{#each codons as c (c.i)}
		<g>
			<text x={c.x + BW / 2} y={BY - 6} text-anchor="middle" font-size="10" class="muted"
				>{c.i + 1}</text
			>
			<rect
				x={c.x + 2}
				y={BY}
				width={BW - 4}
				height={30}
				rx="5"
				fill="var(--surface)"
				stroke={c.i === c12 ? 'var(--ca-cancer)' : 'var(--border)'}
				stroke-width={c.i === c12 ? 2 : 1}
			/>
			{#each c.letters as l (l.j)}
				<text
					x={c.x + BW / 2 + (l.j - 1) * 11}
					y={BY + 20}
					text-anchor="middle"
					font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
					font-weight={l.changed ? 700 : 500}
					font-size="14"
					style:fill={l.changed ? 'var(--ca-cancer)' : undefined}>{l.b}</text
				>
			{/each}
			<text
				x={c.x + BW / 2}
				y={BY + 50}
				text-anchor="middle"
				font-size="12"
				font-weight={c.changed ? 700 : 400}
				style:fill={c.changed ? 'var(--ca-cancer)' : 'var(--stage-ink-muted)'}>{c.aa}</text
			>
		</g>
	{/each}
	<Readout
		id="codon12"
		order={1}
		label="Codon 12"
		value={mutated
			? `${normal.codon12} → ${mutant.codon12}: ${aaBefore.name} → ${aaAfter.name}`
			: `${normal.codon12}: ${aaBefore.name}`}
		color="var(--ca-cancer)"
	>
		<Label
			x={BX + c12 * BW + BW / 2}
			y={BY + 82}
			text={mutated
				? `codon 12: ${normal.codon12} → ${mutant.codon12} · ${aaBefore.name} → ${aaAfter.name}`
				: `codon 12: ${normal.codon12} · ${aaBefore.name}`}
			color="var(--ca-cancer)"
			weight={600}
		/>
	</Readout>
	<Readout id="gene-note">
		<text x={BX} y={BY + 112} font-size="12" class="muted"
			>{mutated
				? 'One letter of 567 changed; the rest of the protein is the same.'
				: 'The normal gene (RefSeq NM_004985.5). Pick a change of codon 12.'}</text
		>
	</Readout>

	<line x1={24} x2={936} y1={208} y2={208} stroke="var(--stage-line)" />

	<!-- ===================== the accelerator ===================== -->
	<Readout id="acc-title">
		<text x={40} y={242} font-size="15" font-weight="600">Accelerator: an oncogene</text>
	</Readout>
	<Readout id="acc-sub">
		<text x={40} y={262} font-size="12" class="muted">one hit switches it on for good</text>
	</Readout>
	{#each ROWS as row (row.id)}
		{@const on = onOf(row.id)}
		{@const sig = row.id === 'mutant' && mutated ? 0 : signal}
		<g>
			<!-- growth signal arriving -->
			<Flow
				d="M60 {row.y} L156 {row.y}"
				color="var(--stage-ink-muted)"
				width={2}
				arrow
				opacity={0.25 + 0.75 * sig}
			/>
			<text x={60} y={row.y - 14} font-size="12" class="muted">“divide” signal</text>
			<!-- the switch -->
			<circle
				cx={200}
				cy={row.y}
				r={30}
				fill={on > 0.5 ? 'var(--ca-kras)' : 'var(--surface)'}
				stroke="var(--ca-kras)"
				stroke-width="2.5"
			/>
			<text
				x={200}
				y={row.y - 2}
				text-anchor="middle"
				font-size="12"
				font-weight="600"
				style:fill={on > 0.5 ? '#2a1f1c' : undefined}>KRAS</text
			>
			<text
				x={200}
				y={row.y + 14}
				text-anchor="middle"
				font-size="11"
				style:fill={on > 0.5 ? '#2a1f1c' : undefined}>{on > 0.5 ? 'ON' : 'off'}</text
			>
			<!-- onward to division -->
			<Flow
				d="M236 {row.y} L334 {row.y}"
				color="var(--ca-kras)"
				width={3}
				arrow
				dash={6}
				t={tt}
				opacity={0.15 + 0.85 * on}
			/>
			<text
				x={350}
				y={row.y + 5}
				font-size="13"
				font-weight={on > 0.5 ? 600 : 400}
				opacity={0.35 + 0.65 * on}>divide</text
			>
			<Readout
				id="row-{row.id}"
				order={2 + (row.id === 'mutant' ? 1 : 0)}
				label={row.id === 'mutant' ? 'KRAS' : undefined}
				value={row.id === 'mutant'
					? mutated
						? `normal: on, then off · ${change}: always on`
						: 'on after each signal, then off'
					: undefined}
			>
				<text x={60} y={row.y + 48} font-size="12" font-weight="600"
					>{row.id === 'mutant' ? mutantLabel : row.label}</text
				>
				<text x={60} y={row.y + 64} font-size="11" class="muted"
					>{row.id === 'mutant' && mutated
						? 'on even without a signal'
						: 'switches itself off after each signal'}</text
				>
			</Readout>
		</g>
	{/each}

	<line x1={470} x2={470} y1={226} y2={580} stroke="var(--stage-line)" />

	<!-- ===================== the brakes ===================== -->
	<Readout id="brake-title">
		<text x={500} y={242} font-size="15" font-weight="600"
			>Brakes: a tumour suppressor (TP53, RB1)</text
		>
	</Readout>
	<Readout id="brake-sub">
		<text x={500} y={262} font-size="12" class="muted"
			>two copies, and one working copy is enough</text
		>
	</Readout>
	{#each COLS as col (col.id)}
		<g>
			<text x={col.x} y={300} text-anchor="middle" font-size="12" font-weight="600"
				>{col.title}</text
			>
			{#each [0, 1] as k (k)}
				{@const x = col.x - 18 + k * 36}
				{@const hit = k < col.hits}
				<rect
					{x}
					y={320}
					width={14}
					height={150}
					rx={7}
					fill="var(--protein)"
					stroke="var(--protein-edge)"
				/>
				<rect
					{x}
					y={380}
					width={14}
					height={16}
					fill={hit ? 'var(--ca-cancer)' : 'var(--ca-p53)'}
					opacity={hit ? 1 : 0.9}
				/>
				{#if hit}
					<path
						d="M{x - 6} {374} L{x + 20} {402} M{x + 20} {374} L{x - 6} {402}"
						stroke="var(--ca-cancer)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{/if}
			{/each}
			<text x={col.x} y={498} text-anchor="middle" font-size="11" class="muted"
				>TP53 on each copy</text
			>
			<Readout
				id="brake-{col.id}"
				order={5}
				label={col.hits === 2 ? 'TP53' : undefined}
				value={col.hits === 2 ? 'the brake fails only when both copies are hit' : undefined}
			>
				<Label
					x={col.x}
					y={530}
					text={col.brake}
					pill
					color={col.hits === 2 ? 'var(--ca-cancer)' : undefined}
					weight={600}
				/>
			</Readout>
		</g>
	{/each}
</g>
