<script lang="ts">
	/**
	 * The whole genetic code. Until the reader clicks a codon, a callout tours a few telling
	 * ones (start, the single-codon amino acids, a six-codon one, the sickle-cell pair, a stop);
	 * a click (or Enter on a focused codon) keeps that codon, stored in `params.pick`.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CODE, amino, codonsFor } from '../genetics';
	import CodeTable from './CodeTable.svelte';
	import { KIND_COLOR, KIND_LABEL, rna } from './shared';
	import Txt from './Txt.svelte';

	let { t, params, setParam, reduced }: StageProps = $props();

	const TOUR = ['ATG', 'TGG', 'CTG', 'GAG', 'GTG', 'TAA', 'AAG', 'TTT'];
	const picked = $derived(
		typeof params.pick === 'string' && CODE.has(params.pick) ? params.pick : ''
	);
	const codon = $derived(picked || (reduced ? 'ATG' : TOUR[Math.floor(t / 2.4) % TOUR.length]));
	const aa = $derived(CODE.get(codon) ?? '?');
	const info = $derived(amino(aa));
	const syn = $derived(codonsFor(aa));
	const KINDS = ['nonpolar', 'polar', 'positive', 'negative', 'stop'] as const;
	const PX = 700;
</script>

<g>
	<Readout id="title">
		<Txt x={24} y={24} text="The standard genetic code (RNA letters)" size={14} weight={700} />
		<Txt x={680} y={24} text="2nd letter →" size={11} muted anchor="end" />
	</Readout>
	<CodeTable
		x={24}
		y={34}
		w={656}
		h={540}
		{codon}
		pick={aa}
		size={13.5}
		margin={30}
		quiet
		onpick={(c: string) => setParam('pick', c)}
	/>
	<Readout id="first">
		<Txt
			x={22}
			y={590}
			text="↑ 1st letter · 3rd letter: the lines in each box (U C A G)"
			size={11}
			muted
		/>
	</Readout>

	<!-- the codon in focus -->
	<Readout id="card">
		<rect
			x={PX}
			y={40}
			width="244"
			height="214"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="codon"
		order={1}
		label={rna(codon)}
		value={info.kind === 'stop' ? 'stop' : `${info.three}, ${info.name}`}
		note={syn.length === 1 ? 'its only codon' : `${syn.length} codons: ${syn.map(rna).join(' ')}`}
		color={KIND_COLOR[info.kind]}
	>
		<text
			x={PX + 122}
			y={92}
			text-anchor="middle"
			style:font-size="38px"
			style:font-weight="700"
			style:font-family="var(--font-mono)"
			style:letter-spacing="0.08em">{rna(codon)}</text
		>
		<Txt
			x={PX + 122}
			y={126}
			text={info.kind === 'stop' ? 'stop: end of the protein' : `${info.three} · ${info.name}`}
			size={15}
			weight={700}
			anchor="middle"
		/>
		<rect x={PX + 70} y={140} width="104" height="22" rx="11" fill={KIND_COLOR[info.kind]} />
		<Txt
			x={PX + 122}
			y={155}
			text={KIND_LABEL[info.kind]}
			size={11.5}
			weight={600}
			anchor="middle"
			halo={false}
		/>
		<Txt
			x={PX + 122}
			y={190}
			text={syn.length === 1 ? 'its only codon' : `${syn.length} codons for it:`}
			size={12}
			anchor="middle"
			muted
		/>
		<Txt
			x={PX + 122}
			y={212}
			text={syn.length === 1 ? (aa === 'M' ? 'also the start signal' : '') : syn.map(rna).join(' ')}
			size={12.5}
			anchor="middle"
			mono
		/>
	</Readout>
	<Readout id="hint">
		<Txt
			x={PX + 122}
			y={240}
			text={picked ? 'click another codon' : 'click any codon'}
			size={11}
			anchor="middle"
			muted
		/>
	</Readout>

	<!-- key and counts -->
	<Readout
		id="kinds"
		order={3}
		label="Colours"
		value="side chains"
		note="yellow water-repelling · green water-loving · blue charged + · red charged − · grey stop"
	>
		{#each KINDS as k, i (k)}
			<rect x={PX + 4} y={290 + i * 28} width="22" height="18" rx="4" fill={KIND_COLOR[k]} />
			<Txt x={PX + 34} y={304 + i * 28} text={KIND_LABEL[k]} size={12.5} />
		{/each}
	</Readout>
	<Readout id="counts" order={2} label="64 codons" value="61 for amino acids · 3 stop">
		<Txt x={PX + 4} y={454} text="64 codons:" size={13} weight={700} />
		<Txt x={PX + 4} y={474} text="61 for the 20 amino acids," size={12.5} />
		<Txt x={PX + 4} y={492} text="3 for stop (UAA, UAG, UGA)." size={12.5} />
		<Txt x={PX + 4} y={518} text="AUG (Met) also means start." size={12.5} />
		<Txt x={PX + 4} y={544} text="Same colour box = same" size={12} muted />
		<Txt x={PX + 4} y={560} text="amino acid, often only the" size={12} muted />
		<Txt x={PX + 4} y={576} text="3rd letter differs." size={12} muted />
	</Readout>
</g>
