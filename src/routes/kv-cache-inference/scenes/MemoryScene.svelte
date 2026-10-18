<script lang="ts">
	/**
	 * The KV cache of a real model in a real GPU's memory.
	 *
	 * Top: the GPU's memory as a bar, holding the weights (purple) and one cache per conversation
	 * of the batch (orange, one segment each while they are wide enough to see); what does not
	 * fit spills past the capacity mark, hatched red. Middle: the size of one token's keys and
	 * values, factor by factor. Bottom: the attention heads, 32 query heads over their key/value
	 * heads, one each (Llama 2 7B) or one per group of four (Mistral 7B, grouped-query attention).
	 *
	 * Focus (`step.hints.focus`): `size` (the bar and the formula) or `gqa` (the heads).
	 * Controls: model, context (log₂ tokens), batch (log₂), GPU. Changes tween in 700 ms.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GPUS, MODELS, BYTES_16 } from '../specs';
	import { cacheBytes, headDim, kvBytesPerToken, maxBatch, weightBytes } from '../serving';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'size') as 'size' | 'gqa');
	const model = $derived(MODELS.find((m) => m.id === params.model) ?? MODELS[0]);
	const gpu = $derived(GPUS.find((g) => g.id === params.gpu) ?? GPUS[0]);
	const context = $derived(2 ** Math.round(Number(params.context ?? 10)));
	const batch = $derived(2 ** Math.round(Number(params.batch ?? 0)));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const gb = (v: number) => `${fmt(v / 1e9, v < 10e9 ? 2 : 1)} GB`;

	const weights = $derived(weightBytes(model));
	const perSeq = $derived(cacheBytes(model, context, 1));
	const cache = $derived(cacheBytes(model, context, batch));
	const fitN = $derived(maxBatch(gpu, model, context));

	// ---- the memory bar (tweened in bytes) -------------------------------------------------
	const BX = 60;
	const BW = 840;
	const BY = 78;
	const BH = 50;
	const tw = { duration: 700, easing: cubicInOut };
	const wT = new Tween(
		untrack(() => weights),
		tw
	);
	const cT = new Tween(
		untrack(() => cache),
		tw
	);
	const mT = new Tween(
		untrack(() => gpu.memory),
		tw
	);
	$effect(() => {
		const a = weights;
		const b = cache;
		const c = gpu.memory;
		const d = untrack(() => (reduced ? 0 : 700));
		untrack(() => {
			wT.set(a, { duration: d });
			cT.set(b, { duration: d });
			mT.set(c, { duration: d });
		});
	});
	/** Pixels per byte: the whole bar is the memory, or everything asked for if more. */
	const k = $derived(BW / Math.max(mT.current, wT.current + cT.current));
	const wx = $derived(BX + wT.current * k);
	const cEnd = $derived(BX + (wT.current + cT.current) * k);
	const capX = $derived(BX + mT.current * k);
	const segW = $derived(perSeq * k);
	const over = $derived(weights + cache > gpu.memory);
	const grow = $derived(reduced ? 1 : smoothstep(0.2, 1.2, t));

	// ---- the formula -----------------------------------------------------------------------
	const factors = $derived([
		{ id: 'kv', v: '2', note: 'key and value' },
		{ id: 'layers', v: String(model.layers), note: 'layers' },
		{ id: 'heads', v: String(model.kvHeads), note: 'KV heads' },
		{ id: 'dim', v: String(headDim(model)), note: 'numbers each' },
		{ id: 'bytes', v: String(BYTES_16), note: 'bytes (BF16)' }
	]);
	const FY = 236;

	// ---- the heads -------------------------------------------------------------------------
	const HX = 112;
	const HW = 22.5;
	const QY = 372;
	const KY = 452;
	const group = $derived(model.heads / model.kvHeads);
	const gqaT = Tween.of(() => group, { duration: 700, easing: cubicInOut });
	/** Queries 0…31; their key/value head's x, morphing between 1:1 and 4:1. */
	const qx = (i: number) => HX + i * HW + HW / 2;
	const kvx = (i: number) => {
		const g = gqaT.current;
		const j = Math.floor(i / g);
		return HX + (j * g + g / 2) * HW;
	};
	const queries = Array.from({ length: 32 }, (_, i) => i);
	const headsOpacity = $derived(focus === 'gqa' ? 1 : 0.5);
	const sizeOpacity = $derived(focus === 'size' ? 1 : 0.55);
</script>

<g opacity={fadeIn}>
	<!-- memory bar -->
	<g opacity={sizeOpacity}>
		<Readout id="gpu" order={0} label={gpu.name} value="{fmt(gpu.memory / 1e9)} GB of memory">
			<Label
				x={BX}
				y={46}
				anchor="start"
				size={15}
				weight={700}
				text="{gpu.name}: {fmt(gpu.memory / 1e9)} GB of memory, serving {model.name}"
			/>
		</Readout>
		<defs>
			<pattern
				id="mem-seq"
				x={wx}
				y="0"
				width={Math.max(segW, 1)}
				height="600"
				patternUnits="userSpaceOnUse"
			>
				<line x1="0" x2="0" y1="0" y2="600" stroke="var(--stage-bg)" stroke-width="1.2" />
			</pattern>
			<pattern
				id="mem-over"
				width="8"
				height="8"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(45)"
			>
				<line x1="0" x2="0" y1="0" y2="8" stroke="var(--kv-over)" stroke-width="3" />
			</pattern>
		</defs>
		<rect
			x={BX}
			y={BY}
			width={capX - BX}
			height={BH}
			rx="5"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<rect
			x={BX}
			y={BY}
			width={(wx - BX) * grow}
			height={BH}
			rx="4"
			fill="var(--kv-weights)"
			opacity="0.85"
		/>
		<rect
			x={wx}
			y={BY}
			width={Math.max(0, cEnd - wx) * grow}
			height={BH}
			fill="var(--kv-cache)"
			opacity="0.8"
		/>
		{#if segW >= 3}
			<rect x={wx} y={BY} width={Math.max(0, cEnd - wx) * grow} height={BH} fill="url(#mem-seq)" />
		{/if}
		{#if over}
			<rect
				x={capX}
				y={BY - 4}
				width={Math.max(0, cEnd - capX) * grow}
				height={BH + 8}
				fill="url(#mem-over)"
				opacity="0.7"
			/>
		{/if}
		<line
			x1={capX}
			x2={capX}
			y1={BY - 10}
			y2={BY + BH + 10}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Readout id="weights" order={1} label="Weights" value={gb(weights)} color="var(--kv-weights)">
			<Label
				x={BX + 6}
				y={BY + BH + 24}
				anchor="start"
				size={13}
				weight={600}
				color="var(--kv-weights)"
				text="weights: {gb(weights)}"
			/>
		</Readout>
		<Readout
			id="cache"
			order={2}
			label="Cache"
			value="{fmt(batch)} × {fmt(context)} tokens = {gb(cache)}"
			color="var(--kv-cache)"
		>
			<Label
				x={Math.min(Math.max(wx + 6, BX + 170), 600)}
				y={BY + BH + 24}
				anchor="start"
				size={13}
				weight={600}
				color="var(--kv-cache)"
				text="cache: {fmt(batch)} × {fmt(context)} tokens = {gb(cache)}"
			/>
		</Readout>
		<Readout
			id="fit"
			order={3}
			label="Conversations that fit"
			value={fitN === 0
				? 'none: the weights alone are too big'
				: `${fmt(fitN)} of ${fmt(context)} tokens`}
		>
			<Label
				x={BX + BW}
				y={BY + BH + 46}
				anchor="end"
				size={12}
				color={over ? 'var(--kv-over)' : undefined}
				weight={over ? 700 : 500}
				text={over
					? `does not fit: at most ${fmt(fitN)} conversations of ${fmt(context)} tokens`
					: `room for ${fmt(fitN)} conversations of ${fmt(context)} tokens`}
			/>
			<Label
				x={capX}
				y={BY - 16}
				anchor={capX > BX + BW - 60 ? 'end' : 'middle'}
				size={11}
				muted
				text="{fmt(gpu.memory / 1e9)} GB"
			/>
		</Readout>
		<Readout
			id="ratio"
			order={4}
			label="Cache ÷ weights"
			value={fmt(cache / weights, cache < 0.1 * weights ? 3 : cache < weights ? 2 : 1)}
		>
			<Label
				x={BX + 6}
				y={BY + BH + 46}
				anchor="start"
				size={12}
				muted
				text="the cache is {fmt(
					cache / weights,
					cache < 0.1 * weights ? 3 : cache < weights ? 2 : 1
				)}× the weights"
			/>
		</Readout>

		<!-- one token's keys and values -->
		<Readout id="formula-title">
			<Label
				x={BX}
				y={FY - 34}
				anchor="start"
				size={14}
				weight={700}
				text="One token’s keys and values"
			/>
		</Readout>
		{#each factors as f, i (f.id)}
			{@const x = BX + i * 128}
			<rect
				{x}
				y={FY - 16}
				width="96"
				height="32"
				rx="6"
				fill="var(--surface)"
				stroke={f.id === 'heads' ? 'var(--kv-cache)' : 'var(--border)'}
				stroke-width={f.id === 'heads' ? 2 : 1}
			/>
			<Label x={x + 48} y={FY + 6} size={16} weight={700} halo={false} text={f.v} />
			<Label x={x + 48} y={FY + 36} size={11} muted text={f.note} />
			{#if i < factors.length - 1}
				<Label x={x + 112} y={FY + 6} size={16} muted halo={false} text="×" />
			{/if}
		{/each}
		<Readout
			id="per-token"
			order={5}
			label="Per token"
			value="2 × {model.layers} × {model.kvHeads} × {headDim(model)} × 2 bytes = {fmt(
				kvBytesPerToken(model) / 1024
			)} KiB"
			color="var(--kv-cache)"
		>
			<Label x={BX + 5 * 128 - 16} y={FY + 6} size={16} muted halo={false} text="=" />
			<Label
				x={BX + 5 * 128 + 4}
				y={FY + 6}
				anchor="start"
				size={18}
				weight={700}
				color="var(--kv-cache)"
				text="{fmt(kvBytesPerToken(model) / 1024)} KiB per token"
			/>
		</Readout>
	</g>

	<!-- the heads -->
	<g opacity={headsOpacity}>
		<Readout
			id="heads"
			order={6}
			label="Heads"
			value="{model.heads} query heads, {model.kvHeads} key/value heads{group > 1
				? ` (groups of ${group})`
				: ''}"
		>
			<Label
				x={HX - 8}
				y={QY - 30}
				anchor="start"
				size={14}
				weight={700}
				text={group > 1
					? `Grouped-query attention: ${model.heads} query heads share ${model.kvHeads} key/value heads`
					: `Multi-head attention: each of ${model.heads} query heads has its own keys and values`}
			/>
			<Label x={HX - 10} y={QY + 16} anchor="end" size={12} text="queries" />
			<Label x={HX - 10} y={KY + 16} anchor="end" size={12} text="keys, values" />
		</Readout>
		{#each queries as i (i)}
			<line
				x1={qx(i)}
				x2={kvx(i)}
				y1={QY + 24}
				y2={KY}
				stroke="var(--stage-line)"
				stroke-width="1.2"
			/>
			<rect
				x={qx(i) - 8}
				y={QY}
				width="16"
				height="24"
				rx="3"
				fill="var(--kv-compute)"
				opacity="0.75"
			/>
		{/each}
		{#each queries as i (i)}
			{@const w = Math.max(16, gqaT.current * HW - 6)}
			<!-- one box per query head; a group's boxes coincide when its keys and values are shared -->
			<rect x={kvx(i) - w / 2} y={KY} width={w} height="24" rx="3" fill="var(--kv-cache)" />
		{/each}
		<Readout id="heads-note">
			<Label
				x={HX - 8}
				y={KY + 56}
				anchor="start"
				size={12}
				muted
				text="{group > 1
					? `each query head still asks its own question; groups of ${group} share the keys and values they look up`
					: 'every query head looks up its own keys and values, all of which are kept'} · {model.name}: {model.layers} layers, {fmt(
					model.dModel
				)} wide"
			/>
		</Readout>
	</g>
</g>
