<script lang="ts">
	/**
	 * Splicing of the HBB transcript, to scale (Ensembl ENST00000335295): the gene with its
	 * three exons and two introns; a copy drops below, its introns loop out while the exons
	 * close up into the 628-letter mRNA; the cap, the tail and the coding part are marked; in
	 * the inset the finished message leaves the nucleus through a pore and meets a ribosome.
	 */
	import { along, clamp, cycle, easeInOut, lerp, smooth, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { HBB_CDS, HBB_EXONS, HBB_GENE, HBB_MRNA } from '../genes-data';
	import { int } from './shared';
	import Txt from './Txt.svelte';

	let { t, reduced }: StageProps = $props();
	const tv = $derived(reduced ? 1e6 : t);

	const N = HBB_GENE.length;
	const X0 = 60;
	const W = 840;
	const S = W / N; // px per letter
	const M = HBB_MRNA.length;
	const XM = 480 - (M * S) / 2;

	interface Seg {
		kind: 'exon' | 'intron';
		n: number;
		len: number;
		start: number;
	}
	const segs: Seg[] = [];
	HBB_EXONS.forEach((e, i) => {
		if (i > 0) {
			const prev = HBB_EXONS[i - 1];
			segs.push({ kind: 'intron', n: i, len: e.start - prev.end, start: prev.end });
		}
		segs.push({ kind: 'exon', n: i + 1, len: e.end - e.start, start: e.start });
	});

	const drop = $derived(easeInOut(smoothstep(0.8, 2.4, tv)));
	const join = $derived(easeInOut(smoothstep(2.8, 5.2, tv)));
	const ends = $derived(smoothstep(5.4, 6.4, tv));
	const marks = $derived(smoothstep(6.4, 7.4, tv));

	const Y_GENE = 120;
	const Y_COPY = $derived(lerp(Y_GENE, 236, drop));

	/** The copy's segments at the current stage of splicing. */
	const copy = $derived.by(() => {
		let x = lerp(X0, XM, join);
		return segs.map((s) => {
			const w = s.kind === 'exon' ? s.len * S : s.len * S * (1 - join);
			const seg = { ...s, x, w };
			x += w;
			return seg;
		});
	});

	const cdsX0 = XM + HBB_CDS.start * S;
	const cdsX1 = XM + HBB_CDS.end * S;

	// inset: nucleus to cytoplasm
	const path = smooth([
		{ x: 150, y: 470 },
		{ x: 300, y: 440 },
		{ x: 452, y: 470 },
		{ x: 520, y: 470 },
		{ x: 640, y: 480 },
		{ x: 740, y: 492 }
	]);
	const u = $derived(reduced ? 0.62 : clamp(cycle(tv - 7.5, 7) * 1.25));
	const show = $derived(reduced ? 1 : smoothstep(7.2, 7.8, tv));
	const msg = $derived(along(path, u));
</script>

<g>
	<Readout id="gene-title">
		<Txt
			x={X0}
			y={Y_GENE - 34}
			text="The HBB gene as copied: {int(N)} letters (to scale)"
			size={14}
			weight={700}
		/>
	</Readout>
	<!-- the gene -->
	{#each segs as s (s.kind + s.n)}
		{@const x = X0 + s.start * S}
		<rect
			{x}
			y={Y_GENE - 8}
			width={s.len * S}
			height="16"
			fill={s.kind === 'exon' ? 'var(--dp-exon)' : 'var(--dp-intron)'}
		/>
		<Readout id="seg-{s.kind}-{s.n}">
			<Txt
				x={x + (s.len * S) / 2}
				y={Y_GENE + (s.kind === 'exon' ? 26 : 42)}
				text="{s.kind} {s.n} · {s.len}"
				size={11.5}
				anchor="middle"
				muted={s.kind === 'intron'}
				weight={s.kind === 'exon' ? 600 : 500}
			/>
		</Readout>
	{/each}
	<Txt x={X0 - 8} y={Y_GENE + 5} text="5′" size={12} weight={700} anchor="end" />
	<Txt x={X0 + W + 8} y={Y_GENE + 5} text="3′" size={12} weight={700} />

	<!-- the copy being spliced -->
	{#if drop > 0}
		{#each copy as s (s.kind + s.n)}
			{#if s.kind === 'exon'}
				<rect x={s.x} y={Y_COPY - 8} width={s.w} height="16" fill="var(--dp-exon)" />
			{:else if join < 1}
				{@const h = 26 + s.len * S * 0.16 * join}
				<path
					d="M{s.x} {Y_COPY} C {s.x - 10 * join} {Y_COPY - h}, {s.x + s.w + 10 * join} {Y_COPY -
						h}, {s.x + s.w} {Y_COPY}"
					fill={join > 0 ? 'none' : 'var(--dp-intron)'}
					stroke="var(--dp-intron)"
					stroke-width={join > 0 ? 6 : 0}
					opacity={1 - smoothstep(0.75, 1, join)}
				/>
				{#if join === 0}
					<rect x={s.x} y={Y_COPY - 8} width={s.w} height="16" fill="var(--dp-intron)" />
				{/if}
			{/if}
		{/each}
	{/if}

	<!-- cap and tail -->
	{#if ends > 0}
		<g opacity={ends}>
			<circle cx={XM - 10} cy={Y_COPY} r="8" fill="var(--dp-pol-edge)" />
			<path
				d="M{XM + M * S} {Y_COPY} q 8 -8 16 0 t 16 0 t 16 0 t 16 0"
				fill="none"
				stroke="var(--dp-a)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<Readout id="cap">
				<Txt x={XM - 22} y={Y_COPY + 5} text="cap" size={12} weight={600} anchor="end" />
				<Txt x={XM + M * S + 72} y={Y_COPY + 5} text="tail of A’s (AAAA…)" size={12} weight={600} />
			</Readout>
		</g>
	{/if}
	{#if marks > 0}
		<g opacity={marks}>
			<path
				d="M{XM} {Y_COPY + 16} v6 M{cdsX0} {Y_COPY + 16} v14 M{cdsX1} {Y_COPY + 16} v14 M{XM +
					M * S} {Y_COPY + 16} v6"
				stroke="var(--stage-ink-muted)"
				fill="none"
			/>
			<line
				x1={cdsX0}
				x2={cdsX1}
				y1={Y_COPY + 26}
				y2={Y_COPY + 26}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<Readout
				id="parts"
				order={2}
				label="mRNA"
				value="{M} letters"
				note="50 before the start · 444 coding · 134 after the stop"
			>
				<Txt
					x={(cdsX0 + cdsX1) / 2}
					y={Y_COPY + 46}
					text="coding: 444 letters, AUG … UAA"
					size={12.5}
					weight={700}
					anchor="middle"
				/>
				<Txt x={cdsX0 - 6} y={Y_COPY + 66} text="50 before" size={11} anchor="end" muted />
				<Txt x={cdsX1 + 6} y={Y_COPY + 66} text="134 after" size={11} muted />
			</Readout>
		</g>
	{/if}
	<Readout id="copy-title" opacity={drop}>
		<Txt
			x={X0}
			y={Y_COPY - 24}
			text={join < 1 ? 'The RNA copy, introns being cut out' : `Spliced mRNA: ${M} letters`}
			size={13}
			weight={700}
			opacity={drop}
			color="var(--dp-exon)"
		/>
	</Readout>

	<!-- inset: out through a nuclear pore -->
	<g opacity={show}>
		<path
			d="M 16 380 Q 400 380 470 420 L 470 452 M 470 488 L 470 560"
			fill="none"
			stroke="var(--dp-nucleus-edge)"
			stroke-width="2"
		/>
		<path
			d="M 16 372 Q 410 372 482 416 L 482 452 M 482 488 L 482 560"
			fill="none"
			stroke="var(--dp-nucleus-edge)"
			stroke-width="2"
		/>
		<path
			d="M 16 386 Q 394 386 464 424 L 464 560 L 16 560 Z"
			fill="var(--dp-nucleus)"
			opacity="0.6"
		/>
		<Readout id="nucleus">
			<Txt x={40} y={540} text="nucleus" size={12} weight={600} color="var(--dp-nucleus-edge)" />
			<Txt x={496} y={436} text="nuclear pore" size={11.5} muted />
			<Txt x={900} y={540} text="cytoplasm" size={12} weight={600} anchor="end" muted />
		</Readout>
		<!-- ribosome waiting -->
		<ellipse cx="790" cy="478" rx="44" ry="26" fill="var(--dp-ribo)" stroke="var(--dp-ribo-edge)" />
		<ellipse cx="790" cy="512" rx="36" ry="14" fill="var(--dp-ribo)" stroke="var(--dp-ribo-edge)" />
		<Readout id="ribo">
			<Txt x={790} y={444} text="ribosome" size={11.5} anchor="middle" muted />
		</Readout>
		<!-- the message -->
		<g transform="translate({msg.x} {msg.y}) rotate({(msg.angle * 180) / Math.PI})">
			<circle cx="-34" cy="0" r="5" fill="var(--dp-pol-edge)" />
			<path
				d="M -30 0 q 8 -6 16 0 t 16 0 t 16 0 t 16 0"
				fill="none"
				stroke="var(--dp-exon)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<path d="M 34 0 q 4 -4 8 0 t 8 0" fill="none" stroke="var(--dp-a)" stroke-width="3" />
		</g>
	</g>
	<Readout
		id="caption"
		order={1}
		label="Splicing"
		value="1,608 → 628 letters"
		note="introns cut out; cap and tail added"
	>
		<Txt
			x={480}
			y={588}
			text="Introns cut out, exons joined, cap and tail added: the message leaves through a pore"
			size={13.5}
			anchor="middle"
			weight={600}
		/>
	</Readout>
</g>
