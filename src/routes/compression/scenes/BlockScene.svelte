<script lang="ts">
	/**
	 * One 8 × 8 block of the chosen picture, the JPEG way (`step.hints.phase`):
	 *   pixels — the picture with its block grid, the picked block (BlockPicker) and that block
	 *            magnified with its 64 brightness values, revealed in reading order.
	 *   dct    — the block, its 64 DCT coefficients (blue positive, red negative, the zigzag
	 *            path drawn over them) and the block rebuilt from the first `params.terms`
	 *            patterns in zigzag order, which are added one by one over the first seconds;
	 *            the pattern added last is shown on its own.
	 *   quant  — coefficients ÷ the quantisation table for `params.quality` = rounded values;
	 *            one cell at a time is worked through in zigzag order. Below: the original and
	 *            decoded block, how many coefficients survive and the zigzag sequence.
	 * The picture and small blocks are grey BMP images (one SVG node each).
	 */
	import { clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		N,
		ZIGZAG,
		basis,
		blockAt,
		dct,
		dequantise,
		idct,
		qualityTable,
		quantise,
		bmpDataUrl
	} from '../compression';
	import BlockPicker from './BlockPicker.svelte';
	import { BLOCKS, blockOf, fmt, greyUrl, imageOf } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'pixels'));
	const tv = $derived(reduced ? 1e6 : t);

	const chosen = $derived(imageOf(params));
	const img = $derived(chosen.img);
	const url = $derived(bmpDataUrl(img));
	const block = $derived(blockOf(params, chosen.id));
	const pick = (i: number) => setParam(`block-${chosen.id}`, i);
	const pixels = $derived(blockAt(img, block.bx, block.by));
	const coef = $derived(dct(pixels));
	const maxAbs = $derived(Math.max(1, ...coef.slice(1).map(Math.abs)));

	const cells = Array.from({ length: N * N }, (_, i) => ({ i, r: Math.floor(i / N), c: i % N }));
	const zz = new Map(ZIGZAG.map((idx, k) => [idx, k]));
	const ink = (v: number) => (v < 128 ? '#ffffff' : '#111111');
	const grey = (v: number) => {
		const g = Math.round(clamp(v, 0, 255));
		return `rgb(${g},${g},${g})`;
	};
	/** Cell colour of a coefficient: blue positive, red negative, stronger when larger. */
	const coefFill = (v: number, i: number) =>
		i === 0 ? 'var(--cmp-pick)' : v >= 0 ? 'var(--cmp-pos)' : 'var(--cmp-neg)';
	const coefOpacity = (v: number, i: number) =>
		i === 0 ? 0.35 : 0.06 + 0.8 * Math.sqrt(Math.min(1, Math.abs(v) / maxAbs));

	// ---- pixels -------------------------------------------------------------------------------
	const PX = 3; // stage units per pixel of the big picture
	const reveal = $derived(clamp(tv / 1.6) * 64);

	// ---- dct ----------------------------------------------------------------------------------
	const terms = $derived(clamp(Math.round(Number(params.terms ?? 64)), 1, 64));
	const shown = $derived(Math.max(1, Math.ceil(terms * clamp(tv / 6))));
	const partial = $derived.by(() => {
		const c = new Array<number>(64).fill(0);
		for (let k = 0; k < shown; k++) c[ZIGZAG[k]] = coef[ZIGZAG[k]];
		return idct(c);
	});
	const partialErr = $derived(Math.max(...partial.map((v, i) => Math.abs(v - pixels[i]))));
	const lastIdx = $derived(ZIGZAG[shown - 1]);
	const lastPattern = $derived(basis(lastIdx % N, Math.floor(lastIdx / N)));
	const zigPath = (x: number, y: number, cell: number, upto: number) =>
		ZIGZAG.slice(0, upto)
			.map(
				(idx, k) =>
					`${k ? 'L' : 'M'}${x + (idx % N) * cell + cell / 2} ${y + Math.floor(idx / N) * cell + cell / 2}`
			)
			.join(' ');

	// ---- quant --------------------------------------------------------------------------------
	const quality = $derived(clamp(Math.round(Number(params.quality ?? 50)), 1, 100));
	const table = $derived(qualityTable(quality));
	const q = $derived(quantise(coef, table));
	const kept = $derived(q.filter((v) => v !== 0).length);
	const decoded = $derived(idct(dequantise(q, table)));
	const lastNonZero = $derived(ZIGZAG.reduce((m, idx, k) => (q[idx] !== 0 ? k : m), 0));
	const sequence = $derived.by(() => {
		const vals = ZIGZAG.slice(0, lastNonZero + 1).map((idx) => q[idx]);
		const shownVals = vals.slice(0, 22).join('  ');
		return vals.length > 22 ? `${shownVals}  … (${vals.length} values)` : shownVals;
	});
	const work = $derived(reduced ? -1 : ZIGZAG[Math.floor(tv / 0.6) % 64]);
	const fmtSigned = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));
</script>

<!-- no message box on these steps: everything moves up to balance the stage -->
<g transform="translate(0 -44)">
	{#if phase === 'pixels'}
		{@const zx = 420}
		{@const zy = 128}
		{@const cell = 36}
		<Txt x={40} y={112} text="The picture: 96 × 96 pixels in 8 × 8 blocks" size={13} weight={700} />
		<image href={url} x={40} y={128} width={96 * PX} height={96 * PX} class="cmp-px" />
		{#each Array.from({ length: BLOCKS - 1 }, (_, i) => i + 1) as i (i)}
			<line
				x1={40 + i * 8 * PX}
				x2={40 + i * 8 * PX}
				y1={128}
				y2={128 + 96 * PX}
				stroke="var(--stage-bg)"
				stroke-opacity="0.75"
			/>
			<line
				x1={40}
				x2={40 + 96 * PX}
				y1={128 + i * 8 * PX}
				y2={128 + i * 8 * PX}
				stroke="var(--stage-bg)"
				stroke-opacity="0.75"
			/>
		{/each}
		<!-- connectors from the block to its magnified copy -->
		<path
			d="M{40 + (block.bx + 1) * 8 * PX} {128 + block.by * 8 * PX} L{zx} {zy} M{40 +
				(block.bx + 1) * 8 * PX} {128 + (block.by + 1) * 8 * PX} L{zx} {zy + 8 * cell}"
			stroke="var(--cmp-pick)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		<BlockPicker x={40} y={128} px={PX} index={block.index} onpick={pick} />
		<Txt
			x={zx}
			y={112}
			text="Block at column {block.bx + 1}, row {block.by +
				1}: 64 numbers, 0 (black) to 255 (white)"
			size={13}
			weight={700}
		/>
		{#each cells as c (c.i)}
			{@const v = pixels[c.i]}
			{@const a = clamp(reveal - c.i)}
			<g opacity={a}>
				<rect
					x={zx + c.c * cell}
					y={zy + c.r * cell}
					width={cell - 1}
					height={cell - 1}
					fill={grey(v)}
				/>
				<text
					x={zx + c.c * cell + cell / 2}
					y={zy + c.r * cell + cell / 2 + 4}
					text-anchor="middle"
					style:font-size="11.5px"
					style:font-family="var(--font-mono)"
					style:fill={ink(v)}>{v}</text
				>
			</g>
		{/each}
		<rect
			x={zx - 2}
			y={zy - 2}
			width={8 * cell + 3}
			height={8 * cell + 3}
			fill="none"
			stroke="var(--cmp-pick)"
			stroke-width="2"
		/>
		<Txt x={740} y={160} text="This block" size={13} weight={700} />
		<Txt x={740} y={184} text="64 pixels × 8 bits" size={13} />
		<Txt x={740} y={206} text="= 512 bits" size={15} weight={700} />
		<Txt x={740} y={262} text="The whole picture" size={13} weight={700} />
		<Txt x={740} y={286} text="144 blocks × 64 pixels" size={13} />
		<Txt x={740} y={308} text="= 9,216 pixels × 8 bits" size={13} />
		<Txt x={740} y={332} text="= 73,728 bits" size={15} weight={700} />
		<Txt
			x={40}
			y={470}
			text="Click or drag over the picture to pick a block (or Tab to it and use the arrow keys)."
			size={13}
			muted
		/>
		<Txt
			x={40}
			y={540}
			text="JPEG treats each 8 × 8 block on its own: 64 brightness values at a time."
			size={15}
			weight={600}
		/>
	{:else if phase === 'dct'}
		{@const bxX = 40}
		{@const cx = 270}
		{@const cell = 38}
		{@const rx = 650}
		<image href={url} x={bxX} y={128} width={96 * 1.5} height={96 * 1.5} class="cmp-px" />
		<BlockPicker x={bxX} y={128} px={1.5} index={block.index} onpick={pick} />
		<Txt x={bxX} y={112} text="Picture" size={12} weight={700} />
		<Txt x={bxX} y={306} text="The block" size={12} weight={700} />
		<image href={greyUrl(8, 8, pixels)} x={bxX} y={316} width={176} height={176} class="cmp-px" />

		<Txt x={cx} y={112} text="Its 64 DCT coefficients" size={13} weight={700} />
		{#each cells as c (c.i)}
			{@const v = coef[c.i]}
			{@const inPlay = (zz.get(c.i) ?? 99) < shown}
			<g opacity={inPlay ? 1 : 0.35}>
				<rect
					x={cx + c.c * cell}
					y={128 + c.r * cell}
					width={cell - 2}
					height={cell - 2}
					rx="3"
					fill={coefFill(v, c.i)}
					fill-opacity={coefOpacity(v, c.i)}
				/>
				<text
					x={cx + c.c * cell + cell / 2 - 1}
					y={128 + c.r * cell + cell / 2 + 3}
					text-anchor="middle"
					style:font-size="10.5px"
					style:font-family="var(--font-mono)">{fmtSigned(Math.round(v))}</text
				>
			</g>
		{/each}
		<path
			d={zigPath(cx - 1, 127, cell, shown)}
			fill="none"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="2"
			stroke-opacity="0.7"
			stroke-linejoin="round"
		/>
		<Txt x={cx} y={128 + 8 * cell + 18} text="DC: the average" size={11} muted />
		<Txt
			x={cx + 8 * cell - 2}
			y={128 + 8 * cell + 18}
			text="slow → fast patterns"
			size={11}
			anchor="end"
			muted
		/>

		<Txt
			x={rx}
			y={112}
			text="Rebuilt from {shown} pattern{shown === 1 ? '' : 's'}"
			size={13}
			weight={700}
		/>
		<image href={greyUrl(8, 8, partial)} x={rx} y={128} width={176} height={176} class="cmp-px" />
		<Txt
			x={rx}
			y={326}
			text={partialErr < 0.5
				? 'Exactly the block again'
				: `Off by up to ${Math.round(partialErr)} level${Math.round(partialErr) === 1 ? '' : 's'}`}
			size={13}
			weight={600}
			color={partialErr < 0.5 ? 'var(--cmp-h)' : undefined}
		/>
		<Txt x={rx} y={370} text="Pattern added last" size={12} weight={700} />
		<image
			href={greyUrl(
				8,
				8,
				lastPattern.map((v) => 128 + 120 * v)
			)}
			x={rx}
			y={380}
			width={96}
			height={96}
			class="cmp-px"
		/>
		<Txt
			x={rx + 108}
			y={418}
			text="× {fmtSigned(Math.round(coef[lastIdx]))}"
			size={15}
			weight={700}
		/>
		<Txt
			x={rx + 108}
			y={440}
			text="{lastIdx % N} across, {Math.floor(lastIdx / N)} down"
			size={11}
			muted
		/>
		<Txt
			x={40}
			y={540}
			text="Each coefficient says how much of one cosine pattern the block contains"
			size={15}
			weight={600}
		/>
		<Txt
			x={40}
			y={566}
			text="Added in zigzag order, from the flat average to the finest checkerboard. All 64 give the block back exactly."
			size={13}
			muted
		/>
	{:else}
		{@const cell = 30}
		{@const gy = 150}
		{@const xs = [40, 360, 680]}
		<Txt x={xs[0]} y={gy - 14} text="DCT coefficients" size={13} weight={700} />
		<Txt x={xs[1]} y={gy - 14} text="÷ table at quality {quality}" size={13} weight={700} />
		<Txt x={xs[2]} y={gy - 14} text="= rounded: {kept} of 64 kept" size={13} weight={700} />
		<Txt x={xs[1] - 30} y={gy + 126} text="÷" size={24} weight={700} anchor="middle" muted />
		<Txt x={xs[2] - 30} y={gy + 126} text="=" size={24} weight={700} anchor="middle" muted />
		{#each cells as c (c.i)}
			{@const on = c.i === work}
			{@const v = coef[c.i]}
			<rect
				x={xs[0] + c.c * cell}
				y={gy + c.r * cell}
				width={cell - 2}
				height={cell - 2}
				rx="3"
				fill={coefFill(v, c.i)}
				fill-opacity={coefOpacity(v, c.i)}
				stroke={on ? 'var(--stage-ink)' : 'none'}
				stroke-width="2"
			/>
			<text
				x={xs[0] + c.c * cell + cell / 2 - 1}
				y={gy + c.r * cell + cell / 2 + 3}
				text-anchor="middle"
				style:font-size="9.5px"
				style:font-family="var(--font-mono)">{fmtSigned(Math.round(v))}</text
			>
			<text
				x={xs[1] + c.c * cell + cell / 2 - 1}
				y={gy + c.r * cell + cell / 2 + 3}
				text-anchor="middle"
				style:font-size="11px"
				style:font-weight={on ? '800' : '500'}
				style:font-family="var(--font-mono)"
				style:fill="var(--cmp-bits)">{table[c.i]}</text
			>
			{#if q[c.i] !== 0 || on}
				<rect
					x={xs[2] + c.c * cell}
					y={gy + c.r * cell}
					width={cell - 2}
					height={cell - 2}
					rx="3"
					fill={q[c.i] === 0 ? 'none' : coefFill(q[c.i], c.i)}
					fill-opacity={q[c.i] === 0 ? 0 : 0.45}
					stroke={on ? 'var(--stage-ink)' : 'none'}
					stroke-width="2"
				/>
			{/if}
			<text
				x={xs[2] + c.c * cell + cell / 2 - 1}
				y={gy + c.r * cell + cell / 2 + 3}
				text-anchor="middle"
				class:muted={q[c.i] === 0}
				opacity={q[c.i] === 0 ? 0.5 : 1}
				style:font-size="11px"
				style:font-weight={q[c.i] === 0 ? '400' : '700'}
				style:font-family="var(--font-mono)">{fmtSigned(q[c.i])}</text
			>
		{/each}
		<rect
			x={xs[1] - 2}
			y={gy - 2}
			width={8 * cell + 2}
			height={8 * cell + 2}
			rx="4"
			fill="none"
			stroke="var(--border)"
		/>
		{#if work >= 0}
			<Txt
				x={920}
				y={112}
				text="{fmt(coef[work], 2).replace('-', '−')} ÷ {table[work]} = {fmt(
					coef[work] / table[work],
					2
				).replace('-', '−')} → {fmtSigned(q[work])}"
				size={13}
				weight={700}
				anchor="end"
			/>
		{/if}

		<Txt x={40} y={432} text="Original" size={12} weight={700} />
		<image href={greyUrl(8, 8, pixels)} x={40} y={442} width={96} height={96} class="cmp-px" />
		<Txt x={156} y={432} text="Decoded" size={12} weight={700} />
		<image href={greyUrl(8, 8, decoded)} x={156} y={442} width={96} height={96} class="cmp-px" />
		<Txt
			x={290}
			y={460}
			text="Read in zigzag order, up to the last non-zero value:"
			size={13}
			weight={600}
		/>
		<text x={290} y={486} style:font-size="13px" style:font-family="var(--font-mono)"
			>{sequence.replaceAll('-', '−')}</text
		>
		<Txt
			x={290}
			y={510}
			text={lastNonZero === 63
				? 'no zeros at the end: every value is stored'
				: `then one end-of-block symbol stands for the ${63 - lastNonZero} zero${63 - lastNonZero === 1 ? '' : 's'} that follow${63 - lastNonZero === 1 ? 's' : ''}`}
			size={13}
			muted
		/>
		<Txt
			x={290}
			y={540}
			text="{kept} of 64 coefficients kept; the decoder multiplies back, but the rounding stays"
			size={14}
			weight={600}
		/>
		<Txt
			x={290}
			y={566}
			text="Quality {quality}: steps from {Math.min(...table)} to {Math.max(
				...table
			)} (the standard table at 50)"
			size={13}
			muted
		/>
	{/if}
</g>

<style>
	.cmp-px {
		image-rendering: pixelated;
	}
</style>
