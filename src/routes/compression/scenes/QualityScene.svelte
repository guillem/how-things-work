<script lang="ts">
	/**
	 * The whole picture through JPEG at a chosen quality (`step.hints.phase`):
	 *   quality — the original and the decoded picture side by side (the decoded one is revealed
	 *             top to bottom as the step starts), with the coded size against the raw size,
	 *             the coefficients kept and the PSNR. Quality: `params.quality`.
	 *   damage  — a loupe of 4 × 4 blocks around the picked block: original, decoded and the
	 *             error made 4 times stronger (mid-grey = no error); the block grid fades in.
	 *             Quality: `params.qlow`.
	 */
	import { clamp, easeInOut } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { SIZE, bmpDataUrl, jpeg, psnr } from '../compression';
	import BlockPicker from './BlockPicker.svelte';
	import { BLOCKS, blockOf, fmt, greyUrl, imageOf, int } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'quality'));
	const tv = $derived(reduced ? 1e6 : t);

	const chosen = $derived(imageOf(params));
	const img = $derived(chosen.img);
	const block = $derived(blockOf(params, chosen.id));
	const pick = (i: number) => setParam(`block-${chosen.id}`, i);
	const quality = $derived(
		clamp(
			Math.round(Number(phase === 'damage' ? (params.qlow ?? 10) : (params.quality ?? 50))),
			1,
			100
		)
	);
	const result = $derived(jpeg(img, quality));
	const RAW = SIZE * SIZE * 8;
	const ratio = $derived(RAW / Math.max(1, result.bits));
	const db = $derived(psnr(img, result.image));
	const origUrl = $derived(bmpDataUrl(img));
	const decUrl = $derived(bmpDataUrl(result.image));

	// ---- quality --------------------------------------------------------------------------------
	const PX = 3;
	const wipe = $derived(easeInOut(clamp((tv - 0.3) / 1.6)));
	const grow = $derived(easeInOut(clamp((tv - 0.6) / 1.2)));

	// ---- damage ---------------------------------------------------------------------------------
	const L = 32; // loupe side in pixels: 4 × 4 blocks
	const lx = $derived(clamp(block.bx - 1, 0, BLOCKS - 4) * 8);
	const ly = $derived(clamp(block.by - 1, 0, BLOCKS - 4) * 8);
	const crop = (data: Uint8Array) => {
		const out: number[] = [];
		for (let y = 0; y < L; y++)
			for (let x = 0; x < L; x++) out.push(data[(ly + y) * SIZE + lx + x]);
		return out;
	};
	const loupeOrig = $derived(crop(img.data));
	const loupeDec = $derived(crop(result.image.data));
	const loupeErr = $derived(loupeDec.map((v, i) => 128 + 4 * (v - loupeOrig[i])));
	const maxErr = $derived(Math.max(...loupeDec.map((v, i) => Math.abs(v - loupeOrig[i]))));
	const ZP = 6.5; // stage units per pixel in the loupe
	const grid = $derived(clamp((tv - 1) / 1));
	const panels = $derived([
		{ x: 256, title: 'Original', url: greyUrl(L, L, loupeOrig) },
		{ x: 480, title: `Decoded at quality ${quality}`, url: greyUrl(L, L, loupeDec) },
		{ x: 704, title: 'Error × 4 (grey = none)', url: greyUrl(L, L, loupeErr) }
	]);
</script>

<g>
	{#if phase === 'quality'}
		<Txt x={40} y={112} text="Original" size={13} weight={700} />
		<image href={origUrl} x={40} y={128} width={SIZE * PX} height={SIZE * PX} class="cmp-px" />
		<Txt x={360} y={112} text="After JPEG at quality {quality}" size={13} weight={700} />
		<defs>
			<clipPath id="quality-wipe">
				<rect x={360} y={128} width={SIZE * PX} height={SIZE * PX * wipe} />
			</clipPath>
		</defs>
		<rect
			x={360}
			y={128}
			width={SIZE * PX}
			height={SIZE * PX}
			fill="none"
			stroke="var(--border)"
			stroke-dasharray="4 4"
		/>
		<image
			href={decUrl}
			x={360}
			y={128}
			width={SIZE * PX}
			height={SIZE * PX}
			class="cmp-px"
			clip-path="url(#quality-wipe)"
		/>

		{@const bx = 680}
		{@const bw = 240}
		<Txt x={bx} y={140} text="Size" size={13} weight={700} />
		<rect
			x={bx}
			y={152}
			width={bw}
			height="20"
			rx="4"
			fill="var(--stage-ink-muted)"
			opacity="0.8"
		/>
		<Txt x={bx} y={190} text="raw: {int(RAW)} bits" size={12} muted />
		<rect
			x={bx}
			y={202}
			width={Math.max(2, (bw * result.bits) / RAW) * grow}
			height="20"
			rx="4"
			fill="var(--explainer-accent, var(--accent))"
		/>
		<Txt
			x={bx}
			y={240}
			text="JPEG: {int(result.bits)} bits"
			size={13}
			weight={700}
			color="var(--explainer-accent, var(--accent))"
		/>
		<Txt x={bx} y={296} text="{fmt(ratio, 1)} × smaller" size={22} weight={700} />
		<Txt
			x={bx}
			y={340}
			text="{int(result.kept)} of {int(result.total)} coefficients kept"
			size={13}
		/>
		<Txt
			x={bx}
			y={380}
			text="PSNR {Number.isFinite(db) ? fmt(db, 1) : '∞'} dB"
			size={15}
			weight={700}
		/>
		<Txt x={bx} y={400} text="higher = closer to the original" size={11} muted />
		<Txt
			x={40}
			y={470}
			text="Every block: DCT, divide by the table, round; then zigzag, runs of zeros and a Huffman code."
			size={13}
			muted
		/>
		<Txt
			x={40}
			y={540}
			text={quality >= 90
				? 'High quality: almost every coefficient kept, and the file grows quickly.'
				: quality >= 40
					? 'Middle quality: most fine detail dropped, and it is hard to see the difference.'
					: 'Low quality: the blocks start to show.'}
			size={15}
			weight={600}
		/>
		<Txt
			x={40}
			y={566}
			text="The size counts the coded coefficients only (no file headers or tables)."
			size={12}
			muted
		/>
	{:else}
		<Txt x={40} y={112} text="Pick where to look" size={13} weight={700} />
		<image href={origUrl} x={40} y={128} width={SIZE * 2} height={SIZE * 2} class="cmp-px" />
		<rect
			x={40 + lx * 2}
			y={128 + ly * 2}
			width={L * 2}
			height={L * 2}
			fill="none"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="2"
			stroke-dasharray="5 3"
		/>
		<BlockPicker x={40} y={128} px={2} index={block.index} onpick={pick} />

		{#each panels as p (p.x)}
			<Txt x={p.x} y={112} text={p.title} size={13} weight={700} />
			<image href={p.url} x={p.x} y={128} width={L * ZP} height={L * ZP} class="cmp-px" />
			{#each [1, 2, 3] as i (i)}
				<line
					x1={p.x + i * 8 * ZP}
					x2={p.x + i * 8 * ZP}
					y1={128}
					y2={128 + L * ZP}
					stroke="var(--cmp-pick)"
					stroke-opacity={0.8 * grid}
				/>
				<line
					x1={p.x}
					x2={p.x + L * ZP}
					y1={128 + i * 8 * ZP}
					y2={128 + i * 8 * ZP}
					stroke="var(--cmp-pick)"
					stroke-opacity={0.8 * grid}
				/>
			{/each}
		{/each}
		<Txt x={256} y={366} text="Block edges" size={11} color="var(--cmp-pick)" opacity={grid} />

		<Txt
			x={256}
			y={400}
			text="Quality {quality}: {fmt(ratio, 1)} × smaller, PSNR {Number.isFinite(db)
				? fmt(db, 1)
				: '∞'} dB, largest error here {maxErr} levels"
			size={14}
			weight={700}
		/>
		<Txt x={40} y={460} text="Blocking:" size={14} weight={700} />
		<Txt
			x={130}
			y={460}
			text="with only the slowest patterns left, each block turns into a flat or gently shaded tile."
			size={13}
		/>
		<Txt x={40} y={490} text="Ringing:" size={14} weight={700} />
		<Txt
			x={130}
			y={490}
			text="next to a sharp edge, the missing fast patterns leave ripples inside the block."
			size={13}
		/>
		<Txt
			x={40}
			y={550}
			text="Lossy formats keep what the eye notices and drop the rest, until there is too little left."
			size={15}
			weight={600}
		/>
	{/if}
</g>

<style>
	.cmp-px {
		image-rendering: pixelated;
	}
</style>
