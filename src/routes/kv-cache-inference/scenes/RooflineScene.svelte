<script lang="ts">
	/**
	 * Prefill and decode on the roofline of a real GPU (log-log: attainable FLOP/s against FLOPs
	 * per byte moved), with the read-outs of the counted pass beside it.
	 *
	 * Focus (`step.hints.focus`):
	 *   prefill — the prompt's single pass (green), on the compute roof for long prompts.
	 *   decode  — one decode step at batch 1 (orange), far down the memory slope.
	 *   batch   — the decode step of the chosen batch, the trail of batches 1 … 1,024 at this
	 *             context (hollow where they don't fit in memory) and the level the cache caps
	 *             them at.
	 *   both    — prefill and the batched decode side by side, with their two speeds.
	 * Controls: model, GPU, context or prompt (log₂ tokens), batch (log₂). The dots slide (Tween).
	 *
	 * Motion: the roof draws in, then the dots drop onto it (pure functions of t).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GPUS, MODELS } from '../specs';
	import {
		attainable,
		decodeIntensityLimit,
		decodeStep,
		fits,
		intensity,
		prefill,
		ridge,
		timing,
		weightBytesRead
	} from '../serving';

	let { step, t, params, reduced }: StageProps = $props();

	type Focus = 'prefill' | 'decode' | 'batch' | 'both';
	const focus = $derived(String(step.hints?.focus ?? 'prefill') as Focus);
	const model = $derived(MODELS.find((m) => m.id === params.model) ?? MODELS[0]);
	const gpu = $derived(GPUS.find((g) => g.id === params.gpu) ?? GPUS[0]);
	const context = $derived(2 ** Math.round(Number(params.context ?? 10)));
	const batch = $derived(
		focus === 'prefill' || focus === 'decode' ? 1 : 2 ** Math.round(Number(params.batch ?? 0))
	);

	const pre = $derived(prefill(model, context, 1));
	const dec = $derived(decodeStep(model, context, batch));
	const preT = $derived(timing(gpu, pre));
	const decT = $derived(timing(gpu, dec));
	const R = $derived(ridge(gpu));
	const cap = $derived(decodeIntensityLimit(model, context));
	const trail = $derived(
		Array.from({ length: 11 }, (_, e) => {
			const b = 2 ** e;
			const i = intensity(decodeStep(model, context, b));
			return { b, i, fits: fits(gpu, model, context, b) };
		})
	);
	const decFits = $derived(fits(gpu, model, context, batch));

	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const ms = (s: number) => {
		const v = s * 1000;
		return `${fmt(v, v < 0.1 ? 3 : v < 10 ? 2 : 1)} ms`;
	};
	const rate = (v: number) => `${fmt(v, v < 10 ? 1 : 0)}`;
	const per = (i: number) => fmt(i, i < 10 ? 1 : 0);

	// ---- the chart ----------------------------------------------------------------------
	const X0 = -1;
	const X1 = 12;
	const Y0 = -0.5;
	const Y1 = 3.25;
	const PLOT = { x0: 100, x1: 590, y0: 70, y1: 500 };
	const sx = scale([X0, X1], [PLOT.x0, PLOT.x1]);
	const sy = scale([Y0, Y1], [PLOT.y1, PLOT.y0]);
	const lx = (i: number) => sx(Math.log2(i));
	/** y of a rate in FLOP/s. */
	const ly = (f: number) => sy(Math.log10(f / 1e12));
	const xTicks = [-1, 0, 2, 4, 6, 8, 10, 12];
	const xFmt = (v: number) => (v < 0 ? '½' : fmt(2 ** v));
	const yTicks = [0, 1, 2, 3];
	const yFmt = (v: number) => ['1', '10', '100', '1,000'][v] ?? '';
	const SLOPE =
		(-Math.atan2(
			(PLOT.y1 - PLOT.y0) / (Y1 - Y0),
			(PLOT.x1 - PLOT.x0) / ((X1 - X0) * Math.log10(2))
		) *
			180) /
		Math.PI;

	const tw = { duration: 800, easing: cubicInOut };
	const preI = new Tween(
		untrack(() => Math.log2(intensity(pre))),
		tw
	);
	const decI = new Tween(
		untrack(() => Math.log2(intensity(dec))),
		tw
	);
	const peakT = new Tween(
		untrack(() => gpu.peak),
		tw
	);
	const bwT = new Tween(
		untrack(() => gpu.bandwidth),
		tw
	);
	$effect(() => {
		const a = Math.log2(intensity(pre));
		const b = Math.log2(intensity(dec));
		const c = gpu.peak;
		const d = gpu.bandwidth;
		const dur = untrack(() => (reduced ? 0 : 800));
		untrack(() => {
			preI.set(a, { duration: dur });
			decI.set(b, { duration: dur });
			peakT.set(c, { duration: dur });
			bwT.set(d, { duration: dur });
		});
	});
	const roofAt = (i: number) => Math.min(peakT.current, bwT.current * i);
	const roof = $derived.by(() => {
		const r = peakT.current / bwT.current;
		const a = 2 ** X0;
		const b = 2 ** X1;
		return `M${lx(a)} ${ly(bwT.current * a)} L${lx(r)} ${ly(peakT.current)} L${lx(b)} ${ly(peakT.current)}`;
	});
	const draw = $derived(reduced ? 1 : smoothstep(0.2, 1.2, t));
	const drop = $derived(reduced ? 1 : smoothstep(1.2, 2, t));

	const showPre = $derived(focus === 'prefill' || focus === 'both' ? 1 : 0.3);
	const showDec = $derived(focus === 'prefill' ? 0.3 : 1);
	const showTrail = $derived(focus === 'batch' || focus === 'both');

	// ---- the panel ------------------------------------------------------------------------
	interface Line {
		id: string;
		label: string;
		value: string;
		color?: string;
	}
	const PX = 630;
	const preLines = $derived<Line[]>([
		{
			id: 'pre-work',
			label: `Prefill: ${fmt(context)} tokens in one pass`,
			value: `${fmt(pre.flops / 1e12, 1)} TFLOP for ${fmt(pre.bytes / 1e9, 1)} GB`,
			color: 'var(--kv-prefill)'
		},
		{
			id: 'pre-t',
			label: `${per(intensity(pre))} FLOPs per byte: ${preT.memoryBound ? 'memory-bound' : 'compute-bound'}`,
			value: `${ms(preT.seconds)} · ${fmt(pre.tokens / preT.seconds)} tokens/s`
		}
	]);
	const decLines = $derived<Line[]>([
		{
			id: 'dec-work',
			label: `Decode step: ${fmt(batch)} × 1 token, ${fmt(context)} of context`,
			value: `${dec.flops >= 1e12 ? `${fmt(dec.flops / 1e12, 2)} TFLOP` : `${fmt(dec.flops / 1e9, 1)} GFLOP`} for ${fmt(dec.bytes / 1e9, 1)} GB`,
			color: 'var(--kv-decode)'
		},
		{
			id: 'dec-bytes',
			label: 'Bytes: weights + cache',
			value: `${fmt(weightBytesRead(model) / 1e9, 1)} + ${fmt(dec.cacheBytes / 1e9, 2)} GB`
		},
		{
			id: 'dec-t',
			label: `${per(intensity(dec))} FLOPs per byte: ${decT.memoryBound ? 'memory-bound' : 'compute-bound'}`,
			value: `${ms(decT.seconds)} (${decT.memoryBound ? `arithmetic alone ${ms(decT.compute)}` : `reading alone ${ms(decT.memory)}`})`
		},
		{
			id: 'dec-rate',
			label: batch > 1 ? 'Tokens per second: each · all' : 'Tokens per second',
			value:
				batch > 1
					? `${rate(1 / decT.seconds)} · ${fmt(batch / decT.seconds)}`
					: rate(1 / decT.seconds)
		}
	]);
	const lines = $derived<Line[]>(
		focus === 'prefill'
			? preLines
			: focus === 'decode'
				? decLines
				: focus === 'batch'
					? [...decLines.filter((l) => l.id !== 'dec-bytes')]
					: [
							{
								id: 'both-pre',
								label: 'Reading the prompt (prefill)',
								value: `${fmt(pre.tokens / preT.seconds)} tokens/s`,
								color: 'var(--kv-prefill)'
							},
							{
								id: 'both-pre-b',
								label: preT.memoryBound ? 'memory-bound' : 'compute-bound',
								value: `${fmt(context)} tokens in ${ms(preT.seconds)}`
							},
							{
								id: 'both-dec',
								label: `Writing (decode), batch of ${fmt(batch)}`,
								value: `${rate(1 / decT.seconds)} tokens/s each`,
								color: 'var(--kv-decode)'
							},
							{
								id: 'both-dec-b',
								label: decT.memoryBound ? 'memory-bound' : 'compute-bound',
								value: `${fmt(batch / decT.seconds)} tokens/s in all`
							}
						]
	);
</script>

<g>
	<Axes
		{sx}
		{sy}
		{xTicks}
		{yTicks}
		xFormat={xFmt}
		yFormat={yFmt}
		xLabel="FLOPs per byte"
		yLabel="TFLOP/s"
	/>
	<defs>
		<clipPath id="kvroof-draw">
			<rect
				x={PLOT.x0}
				y={PLOT.y0 - 10}
				width={(PLOT.x1 - PLOT.x0) * draw}
				height={PLOT.y1 - PLOT.y0 + 20}
			/>
		</clipPath>
	</defs>
	<g clip-path="url(#kvroof-draw)">
		<path d={roof} fill="none" stroke="var(--kv-roof)" stroke-width="3" stroke-linejoin="round" />
		<line
			x1={lx(R)}
			x2={lx(R)}
			y1={ly(peakT.current)}
			y2={PLOT.y1}
			stroke="var(--kv-roof)"
			stroke-opacity="0.5"
			stroke-dasharray="3 4"
		/>
	</g>
	<Readout
		id="peak"
		order={0}
		label={focus === 'prefill' ? gpu.name : undefined}
		value="{fmt(gpu.peak / 1e12, 1)} TFLOP/s, {fmt(gpu.bandwidth / 1e12, 2)} TB/s"
	>
		<Label
			x={PLOT.x0 + 8}
			y={ly(peakT.current) - 10}
			anchor="start"
			size={12}
			weight={600}
			opacity={draw}
			text="{gpu.name}: {fmt(gpu.peak / 1e12, 1)} TFLOP/s"
		/>
		<Label
			x={lx(5)}
			y={ly(bwT.current * 5) + 24}
			anchor="start"
			size={12}
			rotate={SLOPE}
			opacity={draw}
			color="var(--kv-weights)"
			text="memory: {fmt(gpu.bandwidth / 1e12, 2)} TB/s"
		/>
	</Readout>
	<Readout
		id="ridge"
		order={1}
		label={focus === 'prefill' || focus === 'decode' ? 'Ridge point' : undefined}
		value="{fmt(R)} FLOPs per byte"
	>
		<Label
			x={lx(R) + 6}
			y={PLOT.y1 - 14}
			anchor="start"
			size={11}
			muted
			opacity={draw}
			text="ridge: {fmt(R)}"
		/>
	</Readout>

	<!-- the batch trail and the cache's cap -->
	{#if showTrail}
		{#each trail as p (p.b)}
			<circle
				cx={lx(p.i)}
				cy={ly(attainable(gpu, p.i))}
				r="4"
				fill={p.fits ? 'var(--kv-decode)' : 'var(--stage-bg)'}
				stroke={p.fits ? 'none' : 'var(--kv-over)'}
				stroke-width="1.5"
				opacity={0.45 * drop}
			/>
		{/each}
		{#if cap < 2 ** X1}
			<line
				x1={lx(cap)}
				x2={lx(cap)}
				y1={PLOT.y0 + 30}
				y2={PLOT.y1}
				stroke="var(--kv-cache)"
				stroke-width="1.5"
				stroke-dasharray="6 4"
				opacity={drop}
			/>
			<Readout
				id="cap"
				order={2}
				label="The cache caps decode at"
				value="{per(cap)} FLOPs per byte"
			>
				<Label
					x={lx(cap) + (cap > 600 ? -6 : 6)}
					y={PLOT.y1 - 32}
					anchor={cap > 600 ? 'end' : 'start'}
					size={11}
					color="var(--kv-cache)"
					opacity={drop}
					text="cache cap: {per(cap)}"
				/>
			</Readout>
		{/if}
		<Readout id="trail-key">
			<Label
				x={PX}
				y={560}
				anchor="start"
				size={11}
				muted
				opacity={drop}
				text="faint dots: batches of 1, 2, 4 … 1,024"
			/>
			<Label
				x={PX}
				y={576}
				anchor="start"
				size={11}
				muted
				opacity={drop}
				text="hollow: their caches don’t fit in memory"
			/>
		</Readout>
	{/if}

	<!-- prefill and decode -->
	{#each [{ id: 'pre', li: preI.current, o: showPre, color: 'var(--kv-prefill)', name: 'prefill' }, { id: 'dec', li: decI.current, o: showDec, color: 'var(--kv-decode)', name: batch > 1 ? `decode × ${fmt(batch)}` : 'decode' }] as d (d.id)}
		{@const i = 2 ** d.li}
		{@const y = ly(roofAt(i))}
		<line
			x1={lx(i)}
			x2={lx(i)}
			y1={PLOT.y1}
			y2={y}
			stroke={d.color}
			stroke-dasharray="3 3"
			opacity={d.o * drop}
		/>
		<circle
			cx={lx(i)}
			cy={PLOT.y0 + (y - PLOT.y0) * drop}
			r="8"
			fill={d.id === 'dec' && !decFits ? 'var(--stage-bg)' : d.color}
			stroke={d.id === 'dec' && !decFits ? 'var(--kv-over)' : 'var(--stage-bg)'}
			stroke-width="2"
			opacity={d.o * Math.max(0.15, drop)}
		/>
		<Label
			x={lx(i) + (i > 400 ? -12 : 12)}
			y={y + (d.id === 'pre' || i > 100 ? 24 : -12)}
			anchor={i > 400 ? 'end' : 'start'}
			size={13}
			weight={700}
			color={d.color}
			opacity={d.o * drop}
			text={d.name}
		/>
	{/each}

	<Readout id="ideal">
		<Label
			x={PX}
			y={536}
			anchor="start"
			size={11}
			muted
			text="ideal roofline bounds: activations and overheads left out"
		/>
	</Readout>

	<!-- read-outs -->
	{#each lines as l, j (l.id)}
		{@const y = 92 + j * 56}
		<Readout id={l.id} order={3 + j} label={l.label} value={l.value} color={l.color}>
			<Label x={PX} {y} anchor="start" size={12} muted text={l.label} />
			<Label
				x={PX}
				y={y + 22}
				anchor="start"
				size={15}
				weight={700}
				tabular
				color={l.color}
				text={l.value}
			/>
		</Readout>
	{/each}
	{#if (focus === 'batch' || focus === 'both') && !decFits}
		<Readout
			id="nofit"
			order={20}
			label="Memory"
			value="this batch does not fit"
			color="var(--kv-over)"
		>
			<Label
				x={PX}
				y={92 + lines.length * 56}
				anchor="start"
				size={13}
				weight={700}
				color="var(--kv-over)"
				text="this batch’s caches don’t fit in {fmt(gpu.memory / 2 ** 30)} GiB"
			/>
		</Readout>
	{/if}
</g>
