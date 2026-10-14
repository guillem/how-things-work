<script lang="ts">
	/**
	 * One letter edited (`step.hints.variant`): a real HBB variant (silent, missense, nonsense,
	 * frameshift), or the reader's own edit (lab: the edit, base, at and gene controls, or a
	 * click on a letter). Top: eleven codons of the message before and after the edit, each
	 * bracketed in its own reading frame, with the amino acids under them; after an insertion
	 * or a deletion the letters slide and the brackets regroup. Below: both whole proteins as
	 * strips, the changed residues marked, and a verdict. In the preset steps the edit happens
	 * at t ≈ 1 s and the new amino acids appear codon by codon; the lab shows it at once.
	 */
	import { clamp, smoothstep, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		STOP,
		amino,
		applyEdit,
		codonToAmino,
		compareEdit,
		editName,
		type Base,
		type Edit,
		type Effect
	} from '../genetics';
	import { HBB, HBB_VARIANTS, geneOf, ownOf } from '../genes';
	import GeneInput from './GeneInput.svelte';
	import { aminoColor, baseColor, int, rna } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const variant = $derived(String(step.hints?.variant ?? 'lab'));
	const lab = $derived(variant === 'lab');
	const preset = $derived(lab ? undefined : HBB_VARIANTS[variant as keyof typeof HBB_VARIANTS]);
	const gene = $derived(lab ? geneOf(params, true) : HBB);
	const seq = $derived(gene.mrna);

	const edit = $derived.by((): Edit | null => {
		if (preset) return preset.edit;
		const kind = String(params.edit ?? 'sub');
		if (kind === 'none' || seq.length === 0) return null;
		const at = clamp(Math.round(Number(params.at ?? 1)) - 1, 0, Math.max(0, seq.length - 1));
		const base = (['A', 'C', 'G', 'T'].includes(String(params.base)) ? params.base : 'A') as Base;
		return { kind: kind === 'ins' || kind === 'del' ? kind : 'sub', at, base };
	});
	const cmp = $derived(compareEdit(seq, edit));
	const before = $derived(cmp.before);
	const after = $derived(cmp.after);
	const mutant = $derived(edit ? applyEdit(seq, edit) : seq);
	const name = $derived(
		edit ? editName(seq, edit, before.start, before.stopped ? before.end : Infinity) : 'no edit'
	);

	const tv = $derived(reduced || lab ? 1e6 : t);
	/** The edit taking effect (letter flips, letters slide). */
	const p = $derived(smoothstep(1.0, 1.8, tv));
	const pulse = $derived(reduced ? 1 : 0.5 + 0.5 * wave(t, 1.6));

	// ---- the window of letters -----------------------------------------------------------
	const DX = 24;
	const NL = 33;
	const X0 = 480 - ((NL - 1) * DX) / 2;
	const Y1 = 140;
	const Y2 = 272;
	const ws = $derived.by(() => {
		const at = edit?.at ?? 0;
		const s = before.start;
		let w = s >= 0 ? s + 3 * Math.floor((at - s) / 3) - 15 : at - 16;
		while (w < 0) w += s >= 0 ? 3 : 1;
		return w;
	});
	const slot = (i: number) => X0 + (i - ws) * DX;

	const shift = $derived(edit?.kind === 'del' ? -1 : edit?.kind === 'ins' ? 1 : 0);
	/** Mutant letters with their (animated) slots. */
	const mutLetters = $derived.by(() => {
		const out: {
			key: string;
			x: number;
			b: string;
			o: number;
			changed: boolean;
			coding?: boolean;
		}[] = [];
		if (!edit) {
			for (let i = ws; i < Math.min(seq.length, ws + NL); i++)
				out.push({
					key: `o${i}`,
					x: slot(i),
					b: seq[i],
					o: 1,
					changed: false,
					coding: before.start >= 0 && i >= before.start && i < before.end
				});
			return out;
		}
		const at = edit.at;
		for (let i = ws - 1; i < Math.min(seq.length, ws + NL + 1); i++) {
			if (i < 0) continue;
			if (i < at) out.push({ key: `o${i}`, x: slot(i), b: seq[i], o: 1, changed: false });
			else if (i === at && edit.kind === 'sub')
				out.push({
					key: `o${i}`,
					x: slot(i),
					b: p < 0.5 ? seq[i] : edit.base!,
					o: 1,
					changed: p >= 0.5
				});
			else if (i === at && edit.kind === 'del')
				out.push({ key: `o${i}`, x: slot(i), b: seq[i], o: 1 - p, changed: true });
			else out.push({ key: `o${i}`, x: slot(i) + shift * DX * p, b: seq[i], o: 1, changed: false });
		}
		if (edit.kind === 'ins')
			out.push({ key: 'new', x: slot(at), b: edit.base!, o: p, changed: true });
		const cds = (k: string) => {
			const i = k === 'new' ? (edit?.at ?? 0) : Number(k.slice(1));
			return before.start >= 0 && i >= before.start && i < before.end;
		};
		for (const l of out) l.coding = cds(l.key);
		return out.filter((l) => l.x > X0 - DX * 0.6 && l.x < X0 + (NL - 0.4) * DX);
	});

	/** Codons of a translation inside the window, as slots (mutant ones in mutant indices). */
	function codonsIn(tr: typeof before, other: string, mut: boolean) {
		const out: { key: string; x: number; aa: string; wrong: boolean; num: number }[] = [];
		tr.codons.forEach((c, ci) => {
			const s = c.at - ws;
			if (s < -1 || s > NL - 2) return;
			const x = X0 + (s + 1) * DX;
			const wrong =
				mut &&
				(other[ci] ?? '') !== (c.aa === STOP ? '' : c.aa) &&
				!(c.aa === STOP && ci === other.length);
			out.push({ key: `${c.at}`, x, aa: c.aa, wrong, num: ci + 1 });
		});
		return out;
	}
	const codBefore = $derived(codonsIn(before, '', false));
	const codAfter = $derived(codonsIn(after, before.protein, true));
	/** The new amino acids appear one by one, left to right, after the edit. */
	const shown = (x: number) => (lab || reduced ? 1 : smoothstep(1.9, 2.1, tv - (x - X0) / 300));

	// ---- verdict ------------------------------------------------------------------------
	const WORD: Record<Effect, string> = {
		none: 'No edit',
		outside: 'Outside the instructions',
		silent: 'Silent',
		missense: 'Missense',
		nonsense: 'Nonsense',
		frameshift: 'Frameshift',
		'stop-lost': 'Stop lost',
		'start-changed': 'Start moved',
		'no-start': 'No start'
	};
	const verdict = $derived.by(() => {
		const a = before.protein;
		const b = after.protein;
		const d = cmp.firstDiff;
		const A = (x: string) => amino(x).three;
		switch (cmp.effect) {
			case 'none':
				return 'Pick an edit: change, insert or delete';
			case 'outside':
				return 'The letter is not part of the instructions: the protein is unchanged';
			case 'silent': {
				const ci = Math.floor((edit!.at - before.start) / 3);
				const c0 = before.codons[ci]?.codon ?? '';
				const c1 = mutant.slice(before.start + ci * 3, before.start + ci * 3 + 3);
				return c0 === c1
					? 'Same protein'
					: `Same protein: ${rna(c0)} and ${rna(c1)} both mean ${A(codonToAmino(c0))}`;
			}
			case 'missense':
				return `One amino acid changed: ${A(a[d])}${d + 1} → ${A(b[d])}; ${int(b.length)} amino acids as before`;
			case 'nonsense':
				return `A stop codon early: ${int(b.length)} amino acids instead of ${int(a.length)}`;
			case 'frameshift':
				return `From amino acid ${d + 1} on, ${cmp.changed} wrong${after.stopped ? `, then a stop: ${int(b.length)} instead of ${int(a.length)}` : ', and no stop: the ribosome runs off the end'}`;
			case 'stop-lost':
				return `The stop codon is gone: the ribosome reads on, ${int(b.length)} amino acids${after.stopped ? '' : ' and off the end'}`;
			case 'start-changed':
				return after.start > before.start
					? `The start codon is broken: reading begins at the next AUG, letter ${after.start + 1}: ${int(b.length)} amino acids`
					: `A new AUG earlier, at letter ${after.start + 1}: ${int(b.length)} amino acids`;
			case 'no-start':
				return 'No AUG left: no protein at all';
		}
	});
	const effectColor = $derived(
		cmp.effect === 'silent' || cmp.effect === 'outside' || cmp.effect === 'none'
			? 'var(--dp-c)'
			: cmp.effect === 'missense'
				? 'var(--dp-a)'
				: 'var(--dp-wrong)'
	);
	const reveal = $derived(lab || reduced ? 1 : smoothstep(2.6, 3.2, tv));

	// ---- strips -----------------------------------------------------------------------
	const longest = $derived(Math.max(1, before.protein.length, after.protein.length));
	const cell = $derived(Math.min(18, 860 / longest));
	const SX = $derived(480 - (longest * cell) / 2);
	const editResidue = $derived(
		edit && before.start >= 0 && edit.at >= before.start
			? Math.floor((edit.at - before.start) / 3)
			: -1
	);
</script>

<g>
	<!-- what was edited -->
	<Readout
		id="what"
		order={1}
		label={lab ? 'Your edit' : (preset?.common ?? '')}
		value={name}
		note={lab ? gene.name : preset?.record}
	>
		<Txt
			x={24}
			y={30}
			text={lab ? `${gene.name}: ${name}` : `${HBB.name}: ${preset?.hgvs} · ${preset?.common}`}
			size={14}
			weight={700}
		/>
		<Txt
			x={24}
			y={50}
			text={lab
				? edit
					? `letter ${edit.at + 1} of the message${before.start >= 0 ? ` (c.1 is the A of the start codon, letter ${before.start + 1})` : ''}`
					: ''
				: (preset?.record ?? '')}
			size={12}
			muted
		/>
	</Readout>

	<!-- before -->
	<Readout id="rows">
		<Txt x={20} y={Y1 + 5} text="before" size={12} weight={700} />
		<Txt x={20} y={Y2 + 5} text="after" size={12} weight={700} color={effectColor} />
	</Readout>
	{#each Array.from({ length: Math.max(0, Math.min(NL, seq.length - ws)) }, (_, j) => ws + j) as i (i)}
		{@const x = slot(i)}
		{@const hit = edit?.at === i}
		{@const coding = i >= before.start && i < before.end && before.start >= 0}
		{#if lab}
			<g
				role="button"
				tabindex="-1"
				aria-label="Edit letter {i + 1}"
				class="dp-letter"
				onclick={() => setParam('at', i + 1)}
				onkeydown={(e) => {
					if (e.key === 'Enter') setParam('at', i + 1);
				}}
			>
				<rect
					x={x - 11}
					y={Y1 - 18}
					width="22"
					height="28"
					rx="5"
					fill="var(--surface)"
					opacity="0.01"
				/>
			</g>
		{/if}
		{#if hit}
			<rect
				x={x - 12}
				y={Y1 - 19}
				width="24"
				height="30"
				rx="6"
				fill="none"
				stroke={effectColor}
				stroke-width="2"
				opacity={pulse}
			/>
		{/if}
		<text
			{x}
			y={Y1 + 5}
			text-anchor="middle"
			opacity={coding ? 1 : 0.45}
			style:font-size="16px"
			style:font-weight="700"
			style:font-family="var(--font-mono)"
			style:fill={baseColor(seq[i])}
			style:pointer-events="none">{seq[i]}</text
		>
	{/each}
	{#each codBefore as c (c.key)}
		<path
			d="M{c.x - DX - 9} {Y1 + 14} v5 h{2 * DX + 18} v-5"
			fill="none"
			stroke="var(--stage-ink-muted)"
		/>
		<rect x={c.x - 26} y={Y1 + 26} width="52" height="20" rx="10" fill={aminoColor(c.aa)} />
		<text
			x={c.x}
			y={Y1 + 40}
			text-anchor="middle"
			style:font-size="11.5px"
			style:font-weight="700"
			style:fill={c.aa === STOP ? '#fff' : undefined}>{amino(c.aa).three}</text
		>
		<Readout id="num-b-{c.key}">
			<Txt x={c.x} y={Y1 + 62} text={String(c.num)} size={10} anchor="middle" muted />
		</Readout>
	{/each}

	<!-- after -->
	{#each mutLetters as l (l.key)}
		<text
			x={l.x}
			y={Y2 + 5}
			text-anchor="middle"
			opacity={l.o * (l.coding ? 1 : 0.45)}
			style:font-size="16px"
			style:font-weight="700"
			style:font-family="var(--font-mono)"
			style:fill={baseColor(l.b)}>{l.b}</text
		>
		{#if l.changed && l.o > 0.05}
			<circle
				cx={l.x}
				cy={Y2 - 1}
				r="14"
				fill="none"
				stroke={effectColor}
				stroke-width="2"
				opacity={l.o * pulse}
			/>
		{/if}
	{/each}
	{#each p >= 1 ? codAfter : codBefore as c (c.key + (p >= 1 ? 'a' : 'b'))}
		{@const o = p >= 1 ? shown(c.x) : 1}
		<path
			d="M{c.x - DX - 9} {Y2 + 14} v5 h{2 * DX + 18} v-5"
			fill="none"
			stroke={p >= 1 && c.wrong ? effectColor : 'var(--stage-ink-muted)'}
			stroke-width={p >= 1 && c.wrong ? 1.8 : 1}
		/>
		<g opacity={o}>
			<rect
				x={c.x - 26}
				y={Y2 + 26}
				width="52"
				height="20"
				rx="10"
				fill={aminoColor(c.aa)}
				stroke={p >= 1 && c.wrong ? effectColor : 'none'}
				stroke-width="2.5"
			/>
			<text
				x={c.x}
				y={Y2 + 40}
				text-anchor="middle"
				style:font-size="11.5px"
				style:font-weight="700"
				style:fill={c.aa === STOP ? '#fff' : undefined}>{amino(c.aa).three}</text
			>
		</g>
	{/each}

	<!-- whole proteins -->
	<g opacity={reveal}>
		{#each [{ tr: before, y: 380, label: 'before' }, { tr: after, y: 430, label: 'after' }] as row (row.label)}
			{@const mut = row.label === 'after'}
			<Readout
				id="len-{row.label}"
				order={mut ? 3 : 2}
				label="Protein {row.label}"
				value="{int(row.tr.protein.length)} amino acids"
			>
				<Txt
					x={SX}
					y={row.y - 6}
					text="Protein {row.label}: {int(row.tr.protein.length)} amino acids{mut && cmp.changed > 0
						? ` · ${cmp.changed} different`
						: ''}"
					size={12}
					weight={600}
					color={mut ? effectColor : undefined}
				/>
			</Readout>
			{#each [...row.tr.protein] as a, i (i)}
				{@const wrong = mut && before.protein[i] !== a}
				<rect
					x={SX + i * cell}
					y={row.y}
					width={Math.max(1, cell - (cell > 5 ? 1 : 0))}
					height="16"
					fill={wrong ? 'var(--dp-wrong)' : aminoColor(a)}
				/>
			{/each}
			{#if mut && after.protein.length < before.protein.length}
				<rect
					x={SX + after.protein.length * cell}
					y={row.y}
					width={(before.protein.length - after.protein.length) * cell}
					height="16"
					fill="none"
					stroke="var(--stage-line)"
					stroke-dasharray="3 3"
				/>
			{/if}
		{/each}
		{#if editResidue >= 0 && editResidue <= longest}
			<path d="M{SX + (editResidue + 0.5) * cell} 470 l -6 9 h 12 z" fill={effectColor} />
		{/if}
	</g>

	<!-- verdict -->
	<g opacity={reveal}>
		<Readout
			id="verdict"
			order={0}
			label={WORD[cmp.effect]}
			value=""
			note={verdict}
			color={effectColor}
		>
			<rect
				x={24}
				y={494}
				width={WORD[cmp.effect].length * 11 + 28}
				height="30"
				rx="15"
				fill={effectColor}
			/>
			<Txt
				x={38}
				y={514}
				text={WORD[cmp.effect]}
				size={15}
				weight={700}
				halo={false}
				color="var(--stage-bg)"
			/>
			<Txt x={WORD[cmp.effect].length * 11 + 64} y={514} text={verdict} size={14} weight={600} />
		</Readout>
	</g>

	{#if lab && gene.id === 'own'}
		<GeneInput x={24} y={548} w={560} value={ownOf(params)} {setParam} />
	{:else}
		<Readout id="key">
			<rect x={24} y={560} width="14" height="12" fill="var(--dp-wrong)" />
			<Txt x={44} y={571} text="amino acid that differs" size={11.5} muted />
			<Txt
				x={210}
				y={571}
				text="brackets: how the ribosome groups the letters into codons"
				size={11.5}
				muted
			/>
		</Readout>
	{/if}
</g>

<style>
	.dp-letter {
		cursor: pointer;
		outline: none;
	}
</style>
