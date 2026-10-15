<script lang="ts">
	/**
	 * Translation of the chosen gene's mRNA (`step.hints.mode`):
	 *   manual — the reader steps with the `codon` slider; a Tween carries the ribosome from
	 *            one codon to the next, so each step plays one cycle (tRNA arrives, the chain
	 *            moves onto it, the ribosome shifts three letters, the empty tRNA leaves);
	 *   auto   — the whole message at 2.8 codons a second (half the measured 5.6 per second),
	 *            from the first AUG to the stop codon, then again after a 4 s pause; the reduced-motion
	 *            frame is the end.
	 * The position is u codons (0 … n): k = ⌊u⌋ codons are read and f = u − k is the progress
	 * of the next one. The mini code table outlines the codon being read.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { along, clamp, easeOut, Label, lerp, type Point, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { STOP, amino, anticodonOf, translate } from '../genetics';
	import { geneOf, ownOf } from '../genes';
	import CodeTable from './CodeTable.svelte';
	import GeneInput from './GeneInput.svelte';
	import { aminoColor, baseColor, int, rna } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'manual'));
	const gene = $derived(geneOf(params, true));
	const msg = $derived(gene.mrna);
	const tr = $derived(translate(msg));
	const n = $derived(tr.codons.length);
	const RATE = 2.8;

	const target = $derived(clamp(Math.round(Number(params.codon ?? 1)), 1, Math.max(1, n)));
	const pos = new Tween(0, { easing: cubicInOut });
	$effect(() => {
		const v = target;
		const quick = reduced;
		untrack(() => {
			const d = Math.abs(v - pos.current);
			pos.set(v, { duration: quick ? 0 : Math.min(2200, 300 + 700 * d) });
		});
	});
	// Keep the slider inside the chosen gene (a shorter gene than the last one).
	$effect(() => {
		const max = Math.max(1, n);
		const v = Number(params.codon ?? 1);
		if (mode === 'manual' && v > max) untrack(() => setParam('codon', max));
	});

	const u = $derived(
		n === 0
			? 0
			: mode === 'auto'
				? reduced
					? n
					: clamp((Math.max(0, t - 0.8) % (n / RATE + 4)) * RATE, 0, n)
				: clamp(pos.current, 0, n)
	);
	const k = $derived(Math.min(n, Math.floor(u)));
	const f = $derived(k >= n ? 0 : u - k);
	const done = $derived(n > 0 && u >= n);
	const arrive = $derived(easeOut(clamp(f / 0.45)));
	const bond = $derived(smoothstep(0.45, 0.6, f));
	const shift = $derived(smoothstep(0.6, 1, f));
	/** Codon index sitting in the P site (fractional while the ribosome moves). */
	const r = $derived(k === 0 ? 0 : k - 1 + shift);
	/** The codon the captions and the table describe: the one arriving, or at rest the last read. */
	const reading = $derived(tr.codons[Math.min(n - 1, f > 0 || k === 0 ? k : k - 1)]);
	const stopNext = $derived(!done && tr.codons[k]?.aa === STOP);

	// ---- geometry ------------------------------------------------------------------------
	const XP = 300; // P site
	const CW = 54; // one codon
	const Y = 334; // mRNA letters
	const TOP = 214; // amino acid on a tRNA
	const xCodon = (c: number) => XP + (c - r) * CW;
	const xLetter = (i: number) => XP + ((i - tr.start - 1) / 3 - r) * CW;
	const edge = (x: number) => smoothstep(16, 60, x) * (1 - smoothstep(900, 944, x));

	const letters = $derived.by(() => {
		if (tr.start < 0) return [];
		const out: number[] = [];
		const c = tr.start + Math.round(r * 3);
		for (let i = Math.max(0, c - 18); i < Math.min(msg.length, c + 36); i++) out.push(i);
		return out;
	});

	// the chain: from the tRNA that holds it, up the exit tunnel and away to the left
	const TRAIL: Point[] = [
		{ x: XP + 22, y: 176 },
		{ x: XP + 22, y: 124 },
		{ x: XP - 20, y: 92 },
		{ x: XP - 110, y: 84 },
		{ x: XP - 200, y: 104 },
		{ x: XP - 250, y: 160 },
		{ x: XP - 240, y: 230 }
	];
	const SP = 23;

	interface TRNA {
		key: string;
		x: number;
		y: number;
		o: number;
		codon: string;
		aa: string;
		bead: boolean;
		release: boolean;
	}
	const trnas = $derived.by(() => {
		const out: TRNA[] = [];
		if (n === 0) return out;
		const add = (c: number, dx: number, dy: number, o: number, bead: boolean) => {
			const cd = tr.codons[c];
			if (!cd || o <= 0.01) return;
			out.push({
				key: `t${c}`,
				x: xCodon(c) + dx,
				y: dy,
				o,
				codon: cd.codon,
				aa: cd.aa,
				bead,
				release: cd.aa === STOP
			});
		};
		if (done) {
			// the release factor and the last tRNA have left; a message without a stop keeps it
			if (!tr.stopped) add(n - 1, 0, 0, 1, false);
			return out;
		}
		// leaving from the E site (read two codons ago)
		if (k >= 2)
			add(
				k - 2,
				-60 * easeOut(clamp(f / 0.5)),
				-90 * easeOut(clamp(f / 0.5)),
				1 - clamp(f / 0.5),
				false
			);
		// holding the chain (until the bond moves it on)
		if (k >= 1) add(k - 1, 0, 0, 1, false);
		// arriving
		add(k, 70 * (1 - arrive), -150 * (1 - arrive), smoothstep(0, 0.15, f), true);
		return out;
	});

	/** Where the chain is attached: the top of the tRNA that holds it. */
	const anchor = $derived.by((): Point => {
		const pTop = { x: xCodon(Math.max(0, k - 1)), y: TOP };
		const aTop = { x: xCodon(k), y: TOP };
		if (k === 0) return aTop;
		if (stopNext) return pTop;
		return { x: lerp(pTop.x, aTop.x, bond), y: TOP };
	});

	/** Amino acids joined so far, newest first, with their positions. */
	const beads = $derived.by(() => {
		// The newest amino acid rides on its tRNA (drawn there); the chain of the k before it
		// slides from the P-site tRNA onto it during the bond, one bead spacing beyond.
		const m = done ? tr.protein.length : Math.min(tr.protein.length, k);
		if (m === 0) return [];
		const lift = done && tr.stopped ? -26 : 0;
		const path = [anchor, ...TRAIL];
		const offset = stopNext ? 0 : k === 0 ? 0 : bond * SP;
		const out: { i: number; x: number; y: number; aa: string; o: number }[] = [];
		const len = path.reduce(
			(s, p, i) => (i === 0 ? 0 : s + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y)),
			0
		);
		for (let j = 0; j < Math.min(m, 18); j++) {
			const i = m - 1 - j;
			const d = offset + j * SP;
			const q = along(path, Math.min(1, d / len));
			out.push({ i, x: q.x, y: q.y + lift, aa: tr.protein[i], o: 1 - smoothstep(14, 18, j) });
		}
		return out;
	});
	const made = $derived(
		done ? tr.protein.length : Math.min(tr.protein.length, k + (bond >= 0.5 && !stopNext ? 1 : 0))
	);

	// protein strip
	const total = $derived(Math.max(1, tr.protein.length));
	const cell = $derived(Math.min(22, 880 / total));
	const ribo = $derived(done ? 0.3 : 1);
	const riboLift = $derived(done && tr.stopped ? 1 : 0);
</script>

<g>
	<!-- ribosome, behind the tRNAs -->
	<g opacity={ribo}>
		<path
			d="M {XP - 128} {Y - 22} C {XP - 150} {Y - 120}, {XP - 70} {Y - 186}, {XP + 30} {Y -
				180} C {XP + 140} {Y - 186}, {XP + 196} {Y - 110}, {XP + 176} {Y - 22} Z"
			transform="translate(0 {-30 * riboLift})"
			fill="var(--dp-ribo)"
			fill-opacity="0.75"
			stroke="var(--dp-ribo-edge)"
			stroke-width="1.5"
		/>
		<path
			d="M {XP - 120} {Y + 16} C {XP - 120} {Y + 66}, {XP + 170} {Y + 66}, {XP + 170} {Y + 16} Z"
			transform="translate(0 {30 * riboLift})"
			fill="var(--dp-ribo)"
			fill-opacity="0.75"
			stroke="var(--dp-ribo-edge)"
			stroke-width="1.5"
		/>
		<Readout id="ribo" order={10} label="Ribosome" marker={1} at={[XP + 150, Y + 52]}>
			<Label anchor="start" x={XP + 180} y={Y + 58} text="ribosome" size={12} weight={600} muted />
		</Readout>
		{#if !done}
			<Readout id="sites">
				{#each ['E', 'P', 'A'] as s, i (s)}
					<Label
						tabular
						x={XP + (i - 1) * CW}
						y={Y + 40}
						text={s}
						size={11}
						weight={700}
						anchor="middle"
						muted
					/>
				{/each}
			</Readout>
		{/if}
	</g>

	<!-- mRNA -->
	{#if tr.start >= 0}
		<line
			x1={16}
			x2={944}
			y1={Y + 9}
			y2={Y + 9}
			stroke="var(--dp-rna)"
			stroke-width="2"
			opacity="0.5"
		/>
		{#each letters as i (i)}
			{@const x = xLetter(i)}
			{@const inside = i >= tr.start && i < tr.end}
			{@const b = rna(msg[i])}
			<text
				{x}
				y={Y + 4}
				text-anchor="middle"
				opacity={edge(x) * (inside ? 1 : 0.45)}
				font-size="15"
				style:font-weight="700"
				style:font-family="var(--font-mono)"
				style:fill={baseColor(b)}>{b}</text
			>
		{/each}
		{#each tr.codons as c, ci (c.at)}
			{@const x = xCodon(ci)}
			{#if x > 0 && x < 960}
				<path
					d="M{x - CW / 2 + 4} {Y + 14} v5 h{CW - 8} v-5"
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					opacity={edge(x)}
				/>
			{/if}
		{/each}
		<Readout id="ends">
			<Label
				anchor="start"
				x={20}
				y={Y + 32}
				text="mRNA 5′"
				size={11}
				weight={600}
				color="var(--dp-rna)"
			/>
			<Label
				x={940}
				y={Y + 32}
				text="3′"
				size={11}
				weight={600}
				anchor="end"
				color="var(--dp-rna)"
			/>
		</Readout>
	{/if}

	<!-- tRNAs and release factor -->
	{#each trnas as q (q.key)}
		<g opacity={q.o} transform="translate({q.x} {q.y})">
			{#if q.release}
				<path
					d="M -20 {Y - 16} L -20 {Y - 70} Q -20 {Y - 96} 0 {Y - 100} Q 20 {Y - 96} 20 {Y -
						70} L 20 {Y - 16} Z"
					fill="var(--dp-stop)"
					opacity="0.85"
				/>
				<Label x={0} y={Y - 108} text="release factor" size={11} weight={600} anchor="middle" />
			{:else}
				<line
					x1="0"
					x2="0"
					y1={TOP + 10}
					y2={Y - 86}
					stroke="var(--dp-trna-edge)"
					stroke-width="3"
				/>
				<path
					d="M -16 {Y - 40} L -16 {Y - 80} Q 0 {Y - 92} 16 {Y - 80} L 16 {Y - 40} Z"
					fill="var(--dp-trna)"
					stroke="var(--dp-trna-edge)"
				/>
				<rect
					x="-25"
					y={Y - 40}
					width="50"
					height="22"
					rx="5"
					fill="var(--dp-trna)"
					stroke="var(--dp-trna-edge)"
				/>
				<text
					x="0"
					y={Y - 24}
					text-anchor="middle"
					font-size="12"
					style:font-weight="700"
					style:font-family="var(--font-mono)">{anticodonOf(rna(q.codon))}</text
				>
				{#if q.bead}
					<circle
						cx="0"
						cy={TOP}
						r="12"
						fill={aminoColor(q.aa)}
						stroke="var(--stage-ink)"
						stroke-width="1"
					/>
					<text x="0" y={TOP + 4.5} text-anchor="middle" font-size="12" style:font-weight="700"
						>{q.aa}</text
					>
				{/if}
			{/if}
		</g>
	{/each}

	<!-- the chain -->
	{#each beads as b (b.i)}
		<circle
			cx={b.x}
			cy={b.y}
			r="11"
			fill={aminoColor(b.aa)}
			stroke="var(--stage-ink)"
			stroke-width="1"
			opacity={b.o}
		/>
		<text
			x={b.x}
			y={b.y + 4.5}
			text-anchor="middle"
			opacity={b.o}
			font-size="12"
			style:font-weight="700">{b.aa}</text
		>
	{/each}

	<!-- the code table, lit at the codon being read -->
	<Readout id="table">
		<CodeTable
			x={630}
			y={14}
			w={314}
			h={286}
			codon={done || !reading ? '' : reading.codon}
			pick={done || !reading ? '' : reading.aa}
			size={10}
			margin={16}
			quiet
		/>
	</Readout>

	<!-- the protein so far -->
	{#if tr.protein.length > 0 || tr.start >= 0}
		{@const x0 = 480 - (total * cell) / 2}
		<Readout
			id="strip"
			order={2}
			label="Chain"
			value="{made} of {tr.protein.length} amino acids"
			note={tr.stopped ? undefined : 'no stop codon in this frame'}
		>
			<Label
				anchor="start"
				tabular
				x={x0}
				y={432}
				text="{gene.short} protein: {made} of {int(tr.protein.length)} amino acids{tr.stopped
					? ''
					: ' (no stop codon: the ribosome would run off the end)'}"
				size={12.5}
				weight={600}
			/>
		</Readout>
		{#each [...tr.protein] as a, i (i)}
			<rect
				x={x0 + i * cell}
				y={440}
				width={Math.max(1, cell - (cell > 6 ? 1 : 0))}
				height="18"
				fill={i < made ? aminoColor(a) : 'var(--dp-same)'}
				opacity={i < made ? 1 : 0.6}
			/>
			{#if cell >= 14 && i < made}
				<text
					x={x0 + i * cell + cell / 2}
					y={453}
					text-anchor="middle"
					font-size="11"
					style:font-weight="700">{a}</text
				>
			{/if}
		{/each}
	{/if}

	<!-- captions -->
	{#if tr.start < 0}
		<Label
			x={480}
			y={300}
			text="No AUG in this sequence: a ribosome finds nowhere to start"
			size={15}
			anchor="middle"
			muted
		/>
	{:else if done}
		<Readout id="now" order={1} label="Finished" value="{tr.protein.length} amino acids">
			<Label
				anchor="start"
				tabular
				x={24}
				y={500}
				text={tr.stopped
					? `Stop codon ${rna(tr.codons[n - 1].codon)}: a release factor frees the chain of ${int(tr.protein.length)} amino acids`
					: `No stop codon: the ribosome ran off the end after ${int(tr.protein.length)} amino acids`}
				size={15}
				weight={700}
			/>
		</Readout>
	{:else if reading}
		{@const a = amino(reading.aa)}
		<Readout
			id="now"
			order={1}
			label="Codon {tr.codons.indexOf(reading) + 1} of {n}"
			value="{rna(reading.codon)} → {a.three}"
			note={reading.aa === STOP
				? 'stop: no tRNA fits'
				: `${a.name}, brought by a tRNA with anticodon ${anticodonOf(rna(reading.codon))}`}
		>
			<Label
				anchor="start"
				tabular
				x={24}
				y={500}
				text="Codon {tr.codons.indexOf(reading) + 1} of {n}: {rna(reading.codon)} → {reading.aa ===
				STOP
					? 'stop: no tRNA fits, a release factor binds'
					: `${a.three} (${a.name})`}"
				size={15}
				weight={700}
			/>
			{#if reading.aa !== STOP}
				<Label
					anchor="start"
					tabular
					x={24}
					y={522}
					text="its tRNA’s anticodon {anticodonOf(rna(reading.codon))} (3′→5′) pairs with {rna(
						reading.codon
					)}{reading === tr.codons[0] ? ': AUG, the start codon' : ''}"
					size={12.5}
					muted
				/>
			{/if}
		</Readout>
	{/if}

	{#if gene.id === 'own'}
		<GeneInput x={24} y={548} w={560} value={ownOf(params)} {setParam} />
	{:else}
		<Readout id="gene">
			<Label
				anchor="start"
				tabular
				x={24}
				y={572}
				text="{gene.name} mRNA, {int(
					msg.length
				)} letters; reading starts at the first AUG (letter {tr.start + 1})"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
