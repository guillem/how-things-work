<script lang="ts">
	/**
	 * Steps "message" and "modified": the vaccine's mRNA.
	 *
	 * Top (both steps): the message as a bar, its parts in proportion to their
	 * real lengths in BNT162b2 (5′ untranslated region 54 letters, coding
	 * sequence 1,273 codons, 3′ region about 300, poly(A) tail about 110).
	 *
	 * "parts": the first 13 codons as the virus and the vaccine spell them
	 * (real sequences, `SEQUENCE`), letters that differ highlighted, and the
	 * amino acids both give; a reading frame sweeps along them.
	 *
	 * "psi": the letter U and its replacement N1-methylpseudouridine (schematic
	 * rings), and a message in the cytoplasm: with ordinary U, RNA sensors bind
	 * it and raise the alarm and the ribosomes stall; with the modified letter
	 * the sensors stay idle and the ribosomes run and release spikes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, cycle, smoothstep } from '#lib/draw/index.ts';
	import Tag from './Tag.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { codonToAmino } from '../../dna-to-protein/genetics';
	import { SEQUENCE } from '../data';

	let { step, t, params, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'parts'));
	const time = $derived(reduced ? 2.5 : t);

	const mix = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = view === 'psi' ? 1 : 0;
		untrack(() => mix.set(v, { duration: reduced ? 0 : 800 }));
	});
	const mod = $derived(params.modified !== false);
	const modT = Tween.of(() => (mod ? 1 : 0), { duration: 700, easing: cubicInOut });
	const m = $derived(modT.current);

	// ---- the bar ---------------------------------------------------------------------
	const TAIL = 110; // A30 + 10-letter linker + A70 (Jeong et al.)
	const parts = [
		{ id: 'utr5', label: '5′ lead-in', n: SEQUENCE.utr5 },
		{ id: 'cds', label: 'coding sequence: 1,273 codons for the spike', n: SEQUENCE.codons * 3 },
		{ id: 'utr3', label: '3′ tail section', n: SEQUENCE.utr3 },
		{ id: 'polya', label: 'poly(A) tail', n: TAIL }
	];
	const TOTAL = parts.reduce((s, p) => s + p.n, 0);
	const BX0 = 56;
	const BX1 = 920;
	const BY = 112;
	const segs = (() => {
		let x = BX0;
		return parts.map((p) => {
			const w = ((BX1 - BX0) * p.n) / TOTAL;
			const s = { ...p, x, w };
			x += w;
			return s;
		});
	})();
	const fillOf = (id: string) =>
		id === 'cds' ? 'var(--mv-mrna)' : id === 'polya' ? 'var(--mv-lnp-edge)' : 'var(--stage-line)';

	// ---- the codon table ----------------------------------------------------------------
	const CX0 = 150;
	const CW = 58;
	const codons = SEQUENCE.startVirus.map((v, i) => {
		const w = SEQUENCE.startVaccine[i];
		return {
			i,
			virus: v,
			vaccine: w,
			aa: codonToAmino(w.replace(/U/g, 'T')),
			diff: [0, 1, 2].map((j) => v[j] !== w[j])
		};
	});
	const reading = $derived(Math.floor(cycle(time, 13 * 0.9) * 13));

	// ---- psi: the cytoplasm panel ---------------------------------------------------------
	const PY = 372; // the strand
	const PX0 = 470;
	const PX1 = 910;
	const RIBOS = [0, 1, 2];
	/** Ribosome positions: running when modified, stalled (barely moving) when not. */
	const ribo = (k: number) => {
		const speed = 0.06 + 0.94 * m;
		const u = cycle(time * speed, 6, k / 3);
		return { x: PX0 + 30 + u * (PX1 - PX0 - 60), u };
	};
	const SENSORS = [
		{ k: 0, x: 540 },
		{ k: 1, x: 700 },
		{ k: 2, x: 850 }
	];
	const alarm = $derived(1 - m);
	const pulse = $derived(cycle(time, 1.6));
	const strandPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 60; i++) {
			const x = PX0 + (i / 60) * (PX1 - PX0);
			const y = PY + Math.sin(i * 0.5 + time * 1.5) * 3;
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});
	/** Spike chains released by the running ribosomes (fade out as they rise). */
	const released = $derived.by(() =>
		RIBOS.map((k) => {
			const r = ribo(k);
			const rise = smoothstep(0.7, 1, r.u);
			return { k, x: r.x, y: PY - 40 - rise * 60, o: m * (1 - rise) * smoothstep(0.1, 0.3, r.u) };
		})
	);
</script>

<g>
	<!-- the message, to scale -->
	<Readout
		id="bar"
		order={1}
		label="The message"
		value="about 4,300 letters: cap, lead-in, 3,819 letters of code for the spike, tail section, poly(A) tail"
	>
		<Tag
			x={BX0}
			y={52}
			text="the vaccine’s mRNA, to scale (about 4,300 letters)"
			size={15}
			weight={600}
			anchor="start"
		/>
		<circle cx={BX0 - 10} cy={BY} r="8" fill="var(--mv-ribosome)" />
		<Tag x={BX0 - 14} y={BY + 34} text="cap" size={12} anchor="start" />
		{#each segs as s (s.id)}
			<rect
				x={s.x}
				y={BY - 8}
				width={s.w}
				height="16"
				fill={fillOf(s.id)}
				stroke="var(--stage-bg)"
				stroke-width="1"
				rx="2"
			/>
		{/each}
		<Tag x={segs[0].x + 2} y={BY - 18} text={segs[0].label} size={11} anchor="start" muted />
		<Tag x={segs[1].x + segs[1].w / 2} y={BY + 34} text={segs[1].label} size={12} />
		<Tag
			x={segs[2].x + segs[2].w / 2 - 10}
			y={BY - 18}
			text={segs[2].label}
			size={11}
			anchor="end"
			muted
		/>
		<Tag x={BX1} y={BY + 34} text={segs[3].label} size={11} anchor="end" muted />
	</Readout>

	<!-- parts: the first codons -->
	<g opacity={1 - mix.current}>
		<path
			d="M{segs[1].x} {BY + 44} L{CX0} {196} M{segs[1].x + 14} {BY + 44} L{CX0 + 13 * CW} {196}"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			fill="none"
		/>
		<Tag x={CX0 + (13 * CW) / 2} y={190} text="codons 1–13, zoomed in" size={11} muted />
		{#each ['codon', 'virus', 'vaccine', 'amino acid'] as row, j (row)}
			<text
				x={CX0 - 12}
				y={236 + j * 52}
				style:font-size="13px"
				text-anchor="end"
				class:muted={j === 0}>{row}</text
			>
		{/each}
		{#each codons as c (c.i)}
			{@const x = CX0 + c.i * CW + CW / 2}
			{@const on = c.i === reading && !reduced}
			<rect
				x={x - CW / 2 + 3}
				y={210}
				width={CW - 6}
				height={196}
				rx="6"
				fill="var(--mv-mrna)"
				opacity={on ? 0.14 : 0}
			/>
			<text {x} y={236} style:font-size="11px" text-anchor="middle" class="muted">{c.i + 1}</text>
			{#each [c.virus, c.vaccine] as cod, row (row)}
				<text
					{x}
					y={288 + row * 52}
					style:font-size="17px"
					text-anchor="middle"
					font-family="ui-monospace, monospace"
				>
					{#each [0, 1, 2] as j (j)}
						<tspan
							font-weight={row === 1 && c.diff[j] ? 700 : 400}
							style:fill={row === 1 && c.diff[j] ? 'var(--mv-spike)' : undefined}>{cod[j]}</tspan
						>
					{/each}
				</text>
			{/each}
			<circle
				cx={x}
				cy={385}
				r="15"
				fill="var(--surface)"
				stroke="var(--mv-mrna)"
				stroke-width="1.5"
			/>
			<text {x} y={390} style:font-size="14px" font-weight="600" text-anchor="middle">{c.aa}</text>
		{/each}
		<Readout
			opacity={1 - mix.current}
			id="same"
			order={2}
			label="Same protein, different letters"
			value="{SEQUENCE.sameCodons} of the 1,273 codons are spelled the same"
		>
			<Tag
				x={CX0}
				y={450}
				text="Same amino acids, different letters (changed letters in orange): only {SEQUENCE.sameCodons} of the 1,273 codons are spelled the same."
				size={13}
				anchor="start"
			/>
		</Readout>
		<Readout
			opacity={1 - mix.current}
			id="gc"
			order={3}
			label="G and C letters"
			value="{Math.round(SEQUENCE.gcVirus * 100)}% in the virus’s gene, {Math.round(
				SEQUENCE.gcVaccine * 100
			)}% in the vaccine"
		>
			<Tag
				x={CX0}
				y={474}
				text="G and C letters: {Math.round(
					SEQUENCE.gcVirus * 100
				)}% of the virus’s gene, {Math.round(SEQUENCE.gcVaccine * 100)}% of the vaccine’s."
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
		<Readout id="src">
			<Tag
				x={CX0}
				y={560}
				text="Sequences: SARS-CoV-2 Wuhan-Hu-1 (GenBank NC_045512.2); BNT162b2 as sequenced from vials (Jeong et al., 2021)"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	</g>

	<!-- psi: the modified letter -->
	<g opacity={mix.current}>
		{#each [{ k: 'u', x: 130, label: 'uridine (U)', note: 'as in the cell’s RNA', on: 1 - m }, { k: 'p', x: 320, label: 'N1-methyl-pseudouridine', note: 'in the vaccine', on: m }] as b (b.k)}
			{@const cx = b.x}
			{@const cy = 300}
			{@const R = 34}
			{@const pts = [0, 1, 2, 3, 4, 5].map((i) => ({
				x: cx + R * Math.cos(((i * 60 - 90) * Math.PI) / 180),
				y: cy + R * Math.sin(((i * 60 - 90) * Math.PI) / 180)
			}))}
			<!-- ring: positions 0 top (C4), clockwise -->
			<g opacity={0.45 + 0.55 * b.on}>
				<polygon
					points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
					fill="var(--surface)"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<!-- O on C4 (top) and C2 (bottom-left) -->
				<line
					x1={pts[0].x}
					y1={pts[0].y}
					x2={pts[0].x}
					y2={pts[0].y - 18}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<text x={pts[0].x} y={pts[0].y - 22} style:font-size="13px" text-anchor="middle">O</text>
				<line
					x1={pts[4].x}
					y1={pts[4].y}
					x2={pts[4].x - 16}
					y2={pts[4].y - 9}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<text x={pts[4].x - 26} y={pts[4].y - 10} style:font-size="13px" text-anchor="middle"
					>O</text
				>
				<!-- N3 (top-left) and N1 (bottom) -->
				<text x={pts[5].x - 2} y={pts[5].y + 4} style:font-size="12px" text-anchor="end">N</text>
				{#if b.k === 'u'}
					<text x={pts[3].x} y={pts[3].y + 15} style:font-size="12px" text-anchor="middle">N</text>
					<line
						x1={pts[3].x}
						y1={pts[3].y}
						x2={pts[3].x}
						y2={pts[3].y + 40}
						stroke="var(--im-virus)"
						stroke-width="3"
					/>
					<Tag
						x={pts[3].x + 8}
						y={pts[3].y + 30}
						text="N–sugar bond"
						size={11}
						anchor="start"
						muted
					/>
				{:else}
					<!-- the sugar on C5 (top-right), N1 carries a methyl -->
					<text x={pts[3].x} y={pts[3].y + 15} style:font-size="12px" text-anchor="middle">N</text>
					<line
						x1={pts[3].x}
						y1={pts[3].y + 18}
						x2={pts[3].x}
						y2={pts[3].y + 32}
						stroke="var(--stage-ink)"
						stroke-width="1.5"
					/>
					<text
						x={pts[3].x}
						y={pts[3].y + 46}
						style:font-size="12px"
						text-anchor="middle"
						font-weight="700"
						style:fill="var(--mv-mrna)">CH₃</text
					>
					<line
						x1={pts[1].x}
						y1={pts[1].y}
						x2={pts[1].x + 30}
						y2={pts[1].y - 14}
						stroke="var(--mv-mrna)"
						stroke-width="3"
					/>
					<Tag x={pts[1].x + 34} y={pts[1].y - 18} text="C–sugar" size={11} anchor="start" muted />
				{/if}
				<Tag x={cx} y={392} text={b.label} size={13} weight={600} />
				<Tag x={cx} y={410} text={b.note} size={11} muted />
			</g>
		{/each}
		<Readout
			opacity={mix.current}
			id="letters"
			order={2}
			label="The letter"
			value={mod
				? 'N1-methylpseudouridine in place of every U: read as U, ignored by the sensors'
				: 'ordinary U: the cell’s RNA sensors recognise the message as foreign'}
		>
			<Tag
				x={225}
				y={200}
				text={mod ? 'every U replaced: still read as U' : 'ordinary U throughout'}
				size={13}
				weight={600}
			/>
			<Tag
				x={225}
				y={470}
				text="same pairing with A: the ribosome reads both as U"
				size={11}
				muted
			/>
		</Readout>

		<!-- the cytoplasm panel -->
		<rect
			x={PX0 - 20}
			y={176}
			width={PX1 - PX0 + 40}
			height={300}
			rx="16"
			fill="var(--cell)"
			stroke="var(--border)"
		/>
		<Tag x={PX0} y={200} text="in the cytoplasm" size={12} anchor="start" muted />
		<path
			d={strandPath}
			fill="none"
			stroke="var(--mv-mrna)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{#each SENSORS as s (s.k)}
			{@const bound = alarm}
			<g transform="translate({s.x} {PY + 52 - bound * 34})">
				<path
					d="M-14 10 L-14 -4 Q0 -18 14 -4 L14 10 Z"
					fill="var(--mv-alarm)"
					opacity={0.5 + 0.5 * bound}
				/>
			</g>
			{#if alarm > 0.05}
				<circle
					cx={s.x}
					cy={PY + 20}
					r={12 + pulse * 40}
					fill="none"
					stroke="var(--mv-alarm)"
					stroke-width="2"
					opacity={alarm * (1 - pulse)}
				/>
			{/if}
		{/each}
		{#each RIBOS as k (k)}
			{@const r = ribo(k)}
			<ellipse cx={r.x} cy={PY - 10} rx="22" ry="14" fill="var(--mv-ribosome)" opacity="0.85" />
			<ellipse cx={r.x} cy={PY + 10} rx="16" ry="10" fill="var(--mv-ribosome)" opacity="0.6" />
		{/each}
		{#each released as p (p.k)}
			{#if p.o > 0.02}
				<path
					d="M{p.x} {p.y + 16} q -8 -8 0 -16 q 8 -8 0 -16"
					fill="none"
					stroke="var(--mv-spike)"
					stroke-width="3"
					stroke-linecap="round"
					opacity={p.o}
				/>
			{/if}
		{/each}
		<Readout
			opacity={mix.current}
			id="alarm"
			order={3}
			label="RNA sensors"
			value={mod ? 'idle: no alarm' : 'bound: interferon alarm raised'}
			color="var(--mv-alarm)"
		>
			<Tag
				x={PX0}
				y={PY + 140}
				text={mod ? 'RNA sensors idle: no alarm' : 'RNA sensors bound: the alarm is raised'}
				size={13}
				anchor="start"
				color={mod ? undefined : 'var(--mv-alarm)'}
				weight={600}
			/>
		</Readout>
		<Readout
			opacity={mix.current}
			id="ribo"
			order={4}
			label="Ribosomes"
			value={mod ? 'running: plenty of spike made' : 'stalled: little protein made'}
		>
			<Tag
				x={PX0}
				y={PY + 164}
				text={mod
					? 'ribosomes run: plenty of spike protein'
					: 'ribosomes stalled by the alarm: little protein'}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
		<Readout id="ribo-key">
			<Tag
				x={PX1}
				y={PY - 50}
				text={clamp(m) > 0.5 ? 'spike chains' : ''}
				size={11}
				anchor="end"
				color="var(--mv-spike)"
			/>
		</Readout>
	</g>
</g>
