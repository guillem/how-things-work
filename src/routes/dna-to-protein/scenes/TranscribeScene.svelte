<script lang="ts">
	/**
	 * Transcription of the chosen gene. The polymerase stays in the middle of the stage while
	 * the DNA slides through it (20 letters a second, 1,200 a minute, within the measured range
	 * of human RNA polymerase II): the strands open into a bubble, each template letter gets
	 * its RNA partner, and the RNA peels away behind. For HBB the RNA letters are marked as
	 * exon or intron. Everything is a function of `t`, unless the reader takes over with the
	 * `copied` slider: then "Copy by itself" (`copy-auto`) goes off and a Tween carries the
	 * polymerase to the chosen letter. Turning "Copy by itself" off by hand leaves the slider
	 * where the animation was, so the picture does not jump.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { complement, rnaPartner } from '../genetics';
	import { geneOf, ownOf } from '../genes';
	import GeneInput from './GeneInput.svelte';
	import { baseColor, int } from './shared';

	let { t, params, setParam, reduced }: StageProps = $props();

	const RATE = 20; // letters per second
	const DX = 22;
	const PX = 520; // x of the letter being copied
	const Y_CODING = 226;
	const Y_TEMPLATE = 318;
	const Y_RNA = 380;
	const Y_TAIL = 470;

	const gene = $derived(geneOf(params, true));
	const seq = $derived(gene.transcribed);
	const n = $derived(seq.length);
	const auto = $derived(params['copy-auto'] !== false);
	const raw = $derived(Number(params.copied ?? 0));
	const target = $derived(clamp(Math.round(raw), 0, n));
	/** Letters copied by the animation; a short lead-in so the polymerase is seen arriving. */
	const played = (tt: number, len: number) => clamp(tt * RATE - 4, 0, len);
	const pos = new Tween(0, { easing: cubicInOut });
	let lastRaw: number | null = null;
	let lastAuto: boolean | null = null;
	$effect(() => {
		const v = raw;
		const a = auto;
		const to = target;
		const len = n;
		const quick = reduced;
		untrack(() => {
			// `t` is read untracked, once per change of a control: where the animation is now
			const now = played(t, len);
			let manual = !a;
			if (a && lastRaw !== null && v !== lastRaw) {
				// the slider moved: it takes over from where the animation was
				pos.set(now, { duration: 0 });
				setParam('copy-auto', false);
				manual = true;
			} else if (!a && lastAuto) {
				// switched off by hand: the slider jumps to the letter being copied
				const here = Math.floor(now);
				pos.set(here, { duration: 0 });
				if (here !== v) setParam('copied', here);
			}
			lastRaw = v;
			lastAuto = !manual;
			if (manual) {
				// keep the slider inside the chosen gene (a shorter gene than the last one)
				if (v > len) setParam('copied', len);
				const d = Math.abs(to - pos.current);
				pos.set(to, { duration: quick ? 0 : Math.min(1500, 250 + 3 * d) });
			}
		});
	});

	// letters copied so far
	const p = $derived(auto ? played(t, n) : clamp(pos.current, 0, n));
	const done = $derived(p >= n);
	/** The last letter copied (0-based), whose exon or intron the readout names. */
	const k = $derived(Math.max(0, Math.ceil(p) - 1));

	// After the copy, the camera eases back so that a short RNA sits in the middle; a copy
	// stepped by hand stays where the reader left it.
	const cam = $derived.by(() => {
		if (!done || !auto) return p;
		const settle = smoothstep(0, 1.2, t - (n + 4) / RATE);
		return p - settle * (p - Math.min(p, n / 2 + 1.5));
	});
	const x = (i: number) => PX + (i - cam) * DX;
	const edge = (xx: number) => smoothstep(100, 150, xx) * (1 - smoothstep(880, 930, xx));

	const exonOf = (i: number) => gene.exons.findIndex((e) => i >= e.start && i < e.end);

	/** How far the double helix is opened at letter i (1 inside the bubble). */
	const open = (i: number) => (done ? 0 : 1 - smoothstep(4, 6.5, Math.abs(i - (p - 3.5))));

	const visible = $derived.by(() => {
		const out: number[] = [];
		const c = Math.floor(cam);
		for (let i = Math.max(0, c - 20); i < Math.min(n, c + 20); i++) out.push(i);
		return out;
	});

	/** Where RNA letter i sits: paired to the template in the bubble, then peeling down. */
	function rnaPos(i: number) {
		const d = done ? 99 : p - 8 - i;
		const peel = smoothstep(0, 7, d);
		return { x: x(i), y: Y_RNA + (Y_TAIL - Y_RNA) * peel };
	}

	const where = $derived.by(() => {
		if (!gene.eukaryote) return '';
		const e = exonOf(Math.min(n - 1, k));
		if (e >= 0) return `exon ${e + 1}`;
		const before = gene.exons.filter((x) => x.end <= k).length;
		return `intron ${before}`;
	});
	const bodyX = $derived(PX - 3.5 * DX);
</script>

<g>
	{#if gene.id === 'own'}
		<Readout id="own-title">
			<Label
				anchor="start"
				x={24}
				y={14}
				text="Your sequence (coding strand, 5′ → 3′)"
				size={12}
				weight={700}
			/>
		</Readout>
		<GeneInput x={24} y={22} w={640} value={ownOf(params)} {setParam} />
	{:else}
		<Readout id="title">
			<Label
				anchor="start"
				tabular
				x={24}
				y={40}
				text="{gene.name}: {int(n)} letters of DNA, {auto
					? 'shown at 1,200 letters a minute'
					: 'stepped with the slider'}"
				size={14}
				weight={700}
			/>
		</Readout>
	{/if}

	{#if n === 0}
		<Label
			x={480}
			y={300}
			text="Type some letters A, C, G, T in the box"
			size={15}
			anchor="middle"
			muted
		/>
	{:else}
		<!-- the polymerase, behind the letters -->
		{#if !done}
			<ellipse
				cx={bodyX}
				cy={(Y_CODING + Y_RNA) / 2 + 6}
				rx="170"
				ry="128"
				fill="var(--dp-pol)"
				fill-opacity="0.7"
				stroke="var(--dp-pol-edge)"
				stroke-width="1.5"
			/>
			<Readout id="pol" order={10} label="RNA polymerase" marker={1} at={[bodyX, 120]}>
				<Label
					x={bodyX}
					y={124}
					text="RNA polymerase →"
					size={13}
					weight={700}
					anchor="middle"
					color="var(--dp-pol-edge)"
				/>
			</Readout>
		{/if}

		<!-- backbones -->
		{#each visible as i (i)}
			{@const o = edge(x(i))}
			{@const op = open(i)}
			{@const yc = Y_CODING - 26 * op}
			{@const yt = Y_TEMPLATE + 14 * op}
			{@const b = seq[i]}
			{@const tb = complement(b)}
			<g opacity={o}>
				<!-- rung: drawn only where the helix is closed -->
				{#if op < 0.95}
					<line
						x1={x(i)}
						x2={x(i)}
						y1={yc + 12}
						y2={(yc + yt) / 2}
						stroke={baseColor(b)}
						stroke-width="6"
						opacity={1 - op}
					/>
					<line
						x1={x(i)}
						x2={x(i)}
						y1={(yc + yt) / 2}
						y2={yt - 12}
						stroke={baseColor(tb)}
						stroke-width="6"
						opacity={1 - op}
					/>
				{/if}
				<circle
					cx={x(i)}
					cy={yc}
					r="10"
					fill="var(--surface)"
					stroke={baseColor(b)}
					stroke-width="2"
				/>
				<text
					x={x(i)}
					y={yc + 4.5}
					text-anchor="middle"
					font-size="12.5"
					style:font-weight="700"
					style:font-family="var(--font-mono)">{b}</text
				>
				<circle
					cx={x(i)}
					cy={yt}
					r="10"
					fill="var(--surface)"
					stroke={baseColor(tb)}
					stroke-width={op > 0.5 ? 2.5 : 2}
				/>
				<text
					x={x(i)}
					y={yt + 4.5}
					text-anchor="middle"
					font-size="12.5"
					style:font-weight="700"
					style:font-family="var(--font-mono)">{tb}</text
				>
			</g>
		{/each}

		<!-- the RNA -->
		{#each visible.filter((i) => i < p) as i (i)}
			{@const r = rnaPos(i)}
			{@const o = edge(r.x) * clamp(p - i)}
			{@const rb = rnaPartner(complement(seq[i]))}
			{@const ex = !gene.eukaryote || exonOf(i) >= 0}
			<g opacity={o}>
				{#if !done && p - 8 - i < 0.5}
					<line
						x1={r.x}
						x2={r.x}
						y1={Y_TEMPLATE + 26}
						y2={r.y - 10}
						stroke="var(--stage-line)"
						stroke-dasharray="2 3"
					/>
				{/if}
				<rect
					x={r.x - 11}
					y={r.y + 12}
					width="22"
					height="5"
					fill={ex ? 'var(--dp-exon)' : 'var(--dp-intron)'}
				/>
				<circle
					cx={r.x}
					cy={r.y}
					r="10"
					fill="var(--surface)"
					stroke={baseColor(rb)}
					stroke-width="2"
				/>
				<text
					x={r.x}
					y={r.y + 4.5}
					text-anchor="middle"
					font-size="12.5"
					style:font-weight="700"
					style:font-family="var(--font-mono)"
					style:fill={rb === 'U' ? 'var(--dp-rna)' : undefined}>{rb}</text
				>
			</g>
		{/each}

		<!-- strand names in the left margin -->
		<Readout id="names">
			<Label anchor="start" x={20} y={Y_CODING + 4} text="coding 5′" size={12} weight={600} />
			<Label anchor="start" x={20} y={Y_TEMPLATE + 4} text="template 3′" size={12} weight={600} />
			<Label
				anchor="start"
				x={20}
				y={Y_TAIL + 4}
				text="RNA 5′"
				size={12}
				weight={600}
				color="var(--dp-rna)"
			/>
			<Label x={940} y={Y_CODING + 4} text="3′" size={12} weight={600} anchor="end" />
			<Label x={940} y={Y_TEMPLATE + 4} text="5′" size={12} weight={600} anchor="end" />
		</Readout>
		{#if gene.eukaryote}
			<Readout id="key">
				<rect x={640} y={Y_TAIL + 34} width="22" height="5" fill="var(--dp-exon)" />
				<Label anchor="start" x={668} y={Y_TAIL + 41} text="exon" size={11} muted />
				<rect x={716} y={Y_TAIL + 34} width="22" height="5" fill="var(--dp-intron)" />
				<Label
					anchor="start"
					x={744}
					y={Y_TAIL + 41}
					text="intron (cut out later)"
					size={11}
					muted
				/>
			</Readout>
		{/if}

		<Readout
			id="progress"
			order={1}
			label="Copied"
			value="{int(Math.min(n, Math.ceil(p)))} of {int(n)} letters"
			note={where ? `now in ${where}` : undefined}
		>
			<Label
				anchor="start"
				tabular
				x={24}
				y={548}
				text={done
					? `Copy finished: an RNA of ${int(n)} letters${gene.eukaryote ? ', introns and all' : ''}`
					: p <= 0
						? `No letters copied yet: the polymerase is at the start of the gene`
						: `Letter ${int(Math.ceil(p))} of ${int(n)} copied${where ? ` · now in ${where}` : ''}`}
				size={15}
				weight={700}
			/>
		</Readout>
		<Readout
			id="rule"
			order={2}
			label="Pairing"
			value="A→U, T→A, C→G, G→C"
			note="template DNA letter → RNA letter"
		>
			<Label
				anchor="start"
				tabular
				x={24}
				y={574}
				text={gene.id !== 'trpl'
					? 'Template A → U, T → A, C → G, G → C: the RNA spells the coding strand, with U for T'
					: 'No nucleus in a bacterium: ribosomes start reading this RNA while it is still being made'}
				size={13}
				muted
			/>
		</Readout>
	{/if}
</g>
