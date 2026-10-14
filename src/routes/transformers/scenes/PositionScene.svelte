<script lang="ts">
	/**
	 * GPT-2's learned position embeddings, positions 0–63. Left: the cosine similarity of every
	 * pair (bright = the two vectors point the same way). Right: one row of it as a curve, for the
	 * position chosen with the slider, and the length of each position vector.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { pingpong } from '#lib/draw/index.ts';
	import { gpt2 } from '../gpt2';
	import { bands, fix, num } from './shared';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const P = gpt2.positions;
	const N = P.n;
	const pos = $derived(Math.max(0, Math.min(N - 1, Math.round(num(params.pos, 10)))));

	// ---- the matrix
	const M = { x: 64, y: 104, cell: 6 };
	const lo = Math.floor(Math.min(...P.cos.flat()) * 10) / 10;
	const shade = (c: number) => (c - lo) / (1 - lo);
	const cells = bands(N, N, (i, j) => shade(P.cos[i][j]), M.x, M.y, M.cell, M.cell, 16, 0);
	const ticks = [0, 16, 32, 48, 63];

	// ---- the curve of the chosen row
	const C = { x: 540, y: 104, w: 380, h: 250 };
	const cx = (j: number) => C.x + (j / (N - 1)) * C.w;
	const cy = (c: number) => C.y + C.h - shade(c) * C.h;
	const curve = $derived(
		P.cos[pos].map((c, j) => `${j ? 'L' : 'M'}${cx(j).toFixed(1)} ${cy(c).toFixed(1)}`).join('')
	);
	// A probe sweeps along the curve (parked at its far end under reduced motion).
	const probe = $derived(reduced ? N - 1 : Math.round(pingpong(t, 10) * (N - 1)));
	const probeC = $derived(P.cos[pos][probe]);

	// ---- the lengths
	const L = { x: 540, y: 430, w: 380, h: 80 };
	const maxNorm = Math.max(...P.norms);
	const restMin = Math.min(...P.norms.slice(1));
	const restMax = Math.max(...P.norms.slice(1));
	const lenBars = P.norms
		.map((v, j) => {
			if (j === 0) return '';
			const h = (v / maxNorm) * L.h;
			const bw = L.w / N;
			return `M${(L.x + j * bw).toFixed(1)} ${(L.y + L.h - h).toFixed(1)}h${(bw * 0.75).toFixed(2)}v${h.toFixed(1)}h${(-bw * 0.75).toFixed(2)}Z`;
		})
		.join('');
	const zeroH = (P.norms[0] / maxNorm) * L.h;

	const near = $derived(pos < N - 1 ? pos + 1 : pos - 1);
	const far = $derived(pos + 20 < N ? pos + 20 : pos - 20);
</script>

<g>
	<!-- the cosine matrix -->
	<Txt x={M.x} y={M.y - 36} size={14} weight={650} text="Cosine between position vectors, 0–63" />
	<rect x={M.x} y={M.y} width={N * M.cell} height={N * M.cell} fill="var(--tf-cell)" />
	{#each cells as b (b.key)}
		<path d={b.d} fill="var(--tf-att)" opacity={0.08 + 0.92 * b.level} />
	{/each}
	<rect
		x={M.x - 1}
		y={M.y + pos * M.cell - 1}
		width={N * M.cell + 2}
		height={M.cell + 2}
		fill="none"
		stroke="var(--tf-sel)"
		stroke-width="2"
	/>
	{#each ticks as k (k)}
		<Txt
			x={M.x + (k + 0.5) * M.cell}
			y={M.y - 8}
			anchor="middle"
			size={11}
			muted
			text={String(k)}
		/>
		<Txt
			x={M.x - 8}
			y={M.y + (k + 0.5) * M.cell + 4}
			anchor="end"
			size={11}
			muted
			text={String(k)}
		/>
	{/each}
	<Readout id="legend">
		<Txt
			x={M.x}
			y={M.y + N * M.cell + 24}
			size={12}
			muted
			text="pale: cos {fix(lo, 1)} · bright: cos 1 (the same direction)"
		/>
		<Txt
			x={M.x}
			y={M.y + N * M.cell + 42}
			size={12}
			muted
			text="row and column: position in the text"
		/>
	</Readout>

	<!-- the chosen row as a curve -->
	<Txt
		x={C.x}
		y={C.y - 36}
		size={14}
		weight={650}
		text="Position {pos} compared with every other"
	/>
	<line x1={C.x} y1={C.y + C.h} x2={C.x + C.w} y2={C.y + C.h} stroke="var(--stage-line)" />
	<line x1={C.x} y1={C.y} x2={C.x} y2={C.y + C.h} stroke="var(--stage-line)" />
	{#each [lo, (lo + 1) / 2, 1] as v (v)}
		<line x1={C.x} y1={cy(v)} x2={C.x + C.w} y2={cy(v)} stroke="var(--stage-grid)" />
		<Txt x={C.x - 6} y={cy(v) + 4} anchor="end" size={11} muted text={fix(v, 1)} />
	{/each}
	{#each ticks as k (k)}
		<Txt x={cx(k)} y={C.y + C.h + 18} anchor="middle" size={11} muted text={String(k)} />
	{/each}
	<path d={curve} fill="none" stroke="var(--tf-att)" stroke-width="2.5" stroke-linejoin="round" />
	<circle cx={cx(pos)} cy={cy(1)} r="5" fill="var(--tf-sel)" />
	<line
		x1={cx(probe)}
		y1={C.y + C.h}
		x2={cx(probe)}
		y2={cy(probeC)}
		stroke="var(--tf-att)"
		stroke-dasharray="3 3"
		opacity="0.7"
	/>
	<circle cx={cx(probe)} cy={cy(probeC)} r="4" fill="var(--tf-att)" />
	<Readout id="probe">
		<Txt
			x={Math.min(C.x + C.w - 4, Math.max(C.x + 60, cx(probe)))}
			y={C.y - 10}
			anchor="middle"
			size={12}
			text="with {probe}: {fix(probeC)}"
		/>
	</Readout>
	<Readout id="near" order={1} label="cos(position {pos}, {near})" value={fix(P.cos[pos][near], 3)}>
		<Txt
			x={C.x + C.w}
			y={C.y + C.h + 40}
			anchor="end"
			size={13}
			text="next door, {near}: {fix(P.cos[pos][near], 3)} · 20 away, {far}: {fix(P.cos[pos][far])}"
		/>
	</Readout>
	<Readout id="far" order={2} label="cos(position {pos}, {far})" value={fix(P.cos[pos][far])}
		><g></g></Readout
	>

	<!-- the lengths -->
	<Txt x={L.x} y={L.y - 16} size={13} weight={600} text="Length of each position vector" />
	<path d={lenBars} fill="var(--tf-q)" opacity="0.65" />
	<rect x={L.x} y={L.y + L.h - zeroH} width={(L.w / N) * 0.75} height={zeroH} fill="var(--tf-q)" />
	<line x1={L.x} y1={L.y + L.h} x2={L.x + L.w} y2={L.y + L.h} stroke="var(--stage-line)" />
	<Readout
		id="len"
		order={3}
		label="Lengths"
		value="position 0: {fix(P.norms[0], 1)}; positions 1–63: {fix(restMin, 1)}–{fix(restMax, 1)}"
	>
		<Txt
			x={L.x + 10}
			y={L.y + 10}
			size={12}
			text="position 0: {fix(P.norms[0], 1)}"
			color="var(--tf-q)"
			weight={600}
		/>
		<Txt
			x={L.x + L.w}
			y={L.y + L.h + 18}
			anchor="end"
			size={12}
			muted
			text="positions 1–63: {fix(restMin, 1)} to {fix(restMax, 1)}"
		/>
	</Readout>
</g>
