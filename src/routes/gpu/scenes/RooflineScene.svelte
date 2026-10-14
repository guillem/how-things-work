<script lang="ts">
	/**
	 * The real chips, and the roofline model.
	 *
	 * Modes (`step.hints.mode`):
	 *   chips — the i9-14900K and the RTX 4090 side by side: a schematic of
	 *           each (8 big + 16 small cores; 128 SMs of 4 × 32 lanes) over a
	 *           table of their published figures. With `hints.takeaway`, the
	 *           table gives way to the three conditions under which the GPU wins.
	 *   roof  — log-log roofline of both chips: attainable FLOP/s against
	 *           arithmetic intensity, with the chosen job (`params.workload`, or
	 *           `hints.job`) and, for the matrix product, the tile width
	 *           (`params.tile`, a power of two).
	 *
	 * Motion: the roofs draw in, then the job's marker drops onto them (pure
	 * functions of t); a change of job or tile slides the marker (Tween).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Label from './Txt.svelte';
	import {
		CHIPS,
		VECTOR_ADD_INTENSITY,
		attainable,
		cpuLanesPerCore,
		matmulIntensity,
		memoryBound,
		ridge,
		shaderIntensity,
		type Chip
	} from '../gpu';
	import { I9_14900K, RTX_4090 } from '../specs';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'chips') as 'chips' | 'roof');
	const takeaway = $derived(Boolean(step.hints?.takeaway));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const [cpu, gpu] = CHIPS;

	// ---- chips ------------------------------------------------------------------------
	const CARD_Y = 64;
	const CARD_H = 262;
	const pCores = Array.from({ length: I9_14900K.performanceCores }, (_, i) => ({
		i,
		x: 66 + (i % 4) * 58,
		y: CARD_Y + 58 + Math.floor(i / 4) * 64
	}));
	const eCores = Array.from({ length: I9_14900K.efficientCores }, (_, i) => ({
		i,
		x: 312 + (i % 4) * 34 + Math.floor((i % 8) / 4) * 0,
		y: CARD_Y + 58 + Math.floor(i / 4) * 32
	}));
	const sms = Array.from({ length: RTX_4090.sms }, (_, i) => ({
		i,
		x: 516 + (i % 16) * 25,
		y: CARD_Y + 58 + Math.floor(i / 16) * 23
	}));
	const rowsTable = [
		{
			id: 'cores',
			label: 'Cores (each fetches its own instructions)',
			cpu: `${I9_14900K.cores}`,
			gpu: `${RTX_4090.sms} SMs`,
			ratio: ''
		},
		{
			id: 'lanes',
			label: '32-bit multiply-adds per tick (CPU: from Intel’s figure)',
			cpu: `${fmt(I9_14900K.cores * cpuLanesPerCore)}`,
			gpu: fmt(RTX_4090.cudaCores),
			ratio: `×${fmt(RTX_4090.cudaCores / (I9_14900K.cores * cpuLanesPerCore))}`
		},
		{
			id: 'clock',
			label: 'Clock in the peak figure',
			cpu: `${I9_14900K.baseGHz} GHz (base)`,
			gpu: `${RTX_4090.boostGHz} GHz (boost)`,
			ratio: `×${fmt(RTX_4090.boostGHz / I9_14900K.baseGHz, 2)}`
		},
		{
			id: 'peak',
			label: 'Peak arithmetic (32-bit)',
			cpu: `${fmt(cpu.peak / 1000, 1)} TFLOP/s*`,
			gpu: `${fmt(gpu.peak / 1000, 1)} TFLOP/s`,
			ratio: `×${fmt(gpu.peak / cpu.peak)}`
		},
		{
			id: 'bw',
			label: 'Memory bandwidth',
			cpu: `${fmt(cpu.bandwidth, 1)} GB/s`,
			gpu: `${fmt(gpu.bandwidth)} GB/s`,
			ratio: `×${fmt(gpu.bandwidth / cpu.bandwidth)}`
		}
	];
	const TABLE_Y = 372;
	const conditions = [
		{ id: 'many', title: 'Many pieces', text: 'enough to keep thousands of lanes busy' },
		{ id: 'same', title: 'Identical', text: 'the same instructions, so warps don’t diverge' },
		{ id: 'indep', title: 'Independent', text: 'no piece waits for another, nothing in sequence' }
	];

	// ---- roofline ---------------------------------------------------------------------
	type Work = 'add' | 'shade' | 'matmul';
	const work = $derived(String(step.hints?.job ?? params.workload ?? 'add') as Work);
	const tileExp = $derived(clamp(Math.round(Number(params.tile ?? 0)), 0, 9));
	const SHADE_I = shaderIntensity();
	const intensityOf = (w: Work, b: number) =>
		w === 'add' ? VECTOR_ADD_INTENSITY : w === 'shade' ? SHADE_I : matmulIntensity(2 ** b);
	const intensity = $derived(intensityOf(work, tileExp));
	const X0 = -5; // log2 of 1/32 FLOP per byte
	const X1 = 10; // log2 of 1024
	const Y0 = 0; // log10 of 1 GFLOP/s
	const Y1 = 5.3; // log10 of 200,000 GFLOP/s
	const PLOT = { x0: 100, x1: 610, y0: 78, y1: 500 };
	const sx = scale([X0, X1], [PLOT.x0, PLOT.x1]);
	const sy = scale([Y0, Y1], [PLOT.y1, PLOT.y0]);
	/** Angle of the sloping roofs on the page, degrees. */
	const SLOPE =
		(-Math.atan2(
			(PLOT.y1 - PLOT.y0) / (Y1 - Y0),
			(PLOT.x1 - PLOT.x0) / ((X1 - X0) * Math.log10(2))
		) *
			180) /
		Math.PI;
	const lx = (i: number) => sx(Math.log2(i));
	const ly = (g: number) => sy(Math.log10(g));
	const xTicks = [-5, -3, -1, 1, 3, 5, 7, 9];
	const xFmt = (v: number) => (v < 0 ? `1/${fmt(2 ** -v)}` : fmt(2 ** v));
	const yTicks = [0, 1, 2, 3, 4, 5];
	const yFmt = (v: number) => ['1 G', '10 G', '100 G', '1 T', '10 T', '100 T'][v] ?? '';

	const logI = new Tween(
		untrack(() => Math.log2(intensity)),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const target = Math.log2(intensity);
		const duration = untrack(() => (reduced ? 0 : 800));
		untrack(() => logI.set(target, { duration }));
	});
	const shownI = $derived(2 ** logI.current);

	const draw = $derived(reduced ? 1 : smoothstep(0.3, 1.5, t));
	const drop = $derived(reduced ? 1 : smoothstep(1.5, 2.3, t));
	function roof(c: Chip): string {
		const r = ridge(c);
		const a = 2 ** X0;
		const b = 2 ** X1;
		return `M${lx(a)} ${ly(c.bandwidth * a)} L${lx(r)} ${ly(c.peak)} L${lx(b)} ${ly(c.peak)}`;
	}
	const chipColor = { cpu: 'var(--gpu-fast)', gpu: 'var(--gpu-lane)' };
	const others = $derived(
		(['add', 'shade', 'matmul'] as Work[])
			.filter((w) => w !== work)
			.map((w) => ({ w, i: intensityOf(w, w === 'matmul' ? tileExp : 0) }))
	);
	const workName: Record<Work, string> = {
		add: 'adding two lists',
		shade: 'the pixel shader',
		matmul: 'matrix multiply'
	};
	const pctPeak = (c: Chip, i: number) => {
		const p = (100 * attainable(c, i)) / c.peak;
		return p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
	};
	const rate = (g: number) => (g >= 1000 ? `${fmt(g / 1000, 1)} TFLOP/s` : `${fmt(g)} GFLOP/s`);
	const iText = (i: number) => (i < 1 ? `1/${fmt(1 / i)}` : fmt(i, i < 10 ? 1 : 0));
</script>

<g opacity={fadeIn}>
	{#if mode === 'chips'}
		<!-- CPU card -->
		<rect
			x="40"
			y={CARD_Y}
			width="430"
			height={CARD_H}
			rx="10"
			fill="var(--surface)"
			stroke="var(--gpu-fast)"
			stroke-width="1.5"
		/>
		<Readout id="cpu-name">
			<Label
				x={60}
				y={CARD_Y + 30}
				anchor="start"
				size={15}
				weight={700}
				color="var(--gpu-fast)"
				text="CPU: {I9_14900K.name}"
			/>
		</Readout>
		{#each pCores as c (c.i)}
			<rect
				x={c.x}
				y={c.y}
				width="50"
				height="54"
				rx="5"
				fill="var(--gpu-fast)"
				fill-opacity="0.16"
				stroke="var(--gpu-fast)"
			/>
			<rect
				x={c.x + 5}
				y={c.y + 6}
				width="40"
				height="14"
				rx="2"
				fill="var(--gpu-fast)"
				fill-opacity="0.45"
			/>
			<rect
				x={c.x + 5}
				y={c.y + 26}
				width="40"
				height="22"
				rx="2"
				fill="none"
				stroke="var(--gpu-fast)"
				stroke-opacity="0.6"
				stroke-dasharray="2 2"
			/>
		{/each}
		{#each eCores as c (c.i)}
			<rect
				x={c.x}
				y={c.y}
				width="28"
				height="26"
				rx="3"
				fill="var(--gpu-fast)"
				fill-opacity="0.12"
				stroke="var(--gpu-fast)"
				stroke-opacity="0.8"
			/>
			<rect
				x={c.x + 4}
				y={c.y + 4}
				width="20"
				height="7"
				rx="1.5"
				fill="var(--gpu-fast)"
				fill-opacity="0.4"
			/>
		{/each}
		<Readout id="cpu-key">
			<Label
				x={60}
				y={CARD_Y + 210}
				anchor="start"
				size={12}
				text="8 big cores and 16 small ones; each has its own control unit (dark strip)"
			/>
			<Label
				x={60}
				y={CARD_Y + 230}
				anchor="start"
				size={12}
				muted
				text="and spends most of its area on caches and on keeping one thread fast"
			/>
		</Readout>

		<!-- GPU card -->
		<rect
			x="490"
			y={CARD_Y}
			width="430"
			height={CARD_H}
			rx="10"
			fill="var(--surface)"
			stroke="var(--gpu-lane)"
			stroke-width="1.5"
		/>
		<Readout id="gpu-name">
			<Label
				x={510}
				y={CARD_Y + 30}
				anchor="start"
				size={15}
				weight={700}
				color="var(--gpu-lane)"
				text="GPU: {RTX_4090.name}"
			/>
		</Readout>
		<defs>
			<pattern id="roof-lanes" width="5" height="21" patternUnits="userSpaceOnUse">
				<rect x="0.6" y="5" width="3.6" height="15" fill="var(--gpu-lane)" fill-opacity="0.75" />
			</pattern>
		</defs>
		{#each sms as s (s.i)}
			<rect
				x={s.x}
				y={s.y}
				width="21"
				height="20"
				rx="2"
				fill="url(#roof-lanes)"
				stroke="var(--gpu-lane)"
				stroke-opacity="0.7"
				stroke-width="0.8"
			/>
			<rect x={s.x + 1} y={s.y + 1} width="19" height="3.5" fill="var(--gpu-lane)" />
		{/each}
		<Readout id="gpu-key">
			<Label
				x={510}
				y={CARD_Y + 254}
				anchor="start"
				size={12}
				text="128 SMs; in each, 4 warp schedulers drive 32 lanes apiece"
			/>
		</Readout>

		{#if !takeaway}
			{#each rowsTable as r, i (r.id)}
				{@const y = TABLE_Y + 26 + i * 30}
				<Readout
					id="row-{r.id}"
					order={2 + i}
					label={r.id === 'clock' ? undefined : r.label}
					value="{r.cpu} · {r.gpu}"
				>
					<Label x={40} {y} anchor="start" size={13} text={r.label} />
					<Label
						x={560}
						{y}
						anchor="end"
						size={13}
						weight={600}
						color="var(--gpu-fast)"
						text={r.cpu}
					/>
					<Label
						x={760}
						{y}
						anchor="end"
						size={13}
						weight={600}
						color="var(--gpu-lane)"
						text={r.gpu}
					/>
					<Label x={920} {y} anchor="end" size={13} weight={700} text={r.ratio} />
				</Readout>
			{/each}
			<Readout id="head">
				<Label x={560} y={TABLE_Y} anchor="end" size={12} muted text="CPU" />
				<Label x={760} y={TABLE_Y} anchor="end" size={12} muted text="GPU" />
				<Label x={920} y={TABLE_Y} anchor="end" size={12} muted text="GPU ÷ CPU" />
			</Readout>
			<line x1="40" x2="920" y1={TABLE_Y + 8} y2={TABLE_Y + 8} stroke="var(--stage-line)" />
			<Readout id="footnote">
				<Label
					x={40}
					y={TABLE_Y + 182}
					anchor="start"
					size={11}
					muted
					text="* twice Intel’s published 64-bit figure, 1,228.8 GFLOP/s (all 24 cores at 3.2 GHz; they can run up to 6 GHz): an AVX2 register holds 8 floats or 4 doubles"
				/>
			</Readout>
		{:else}
			<Readout
				id="wins"
				order={2}
				label="A GPU wins when a job splits into"
				value="many, identical, independent pieces"
			>
				<Label
					x={480}
					y={TABLE_Y}
					size={15}
					weight={700}
					text="A GPU wins when a job splits into pieces that are…"
				/>
			</Readout>
			{#each conditions as c, i (c.id)}
				{@const x = 40 + i * 300}
				<Readout id="cond-{c.id}" order={3 + i} label={c.title} value={c.text}>
					<rect
						{x}
						y={TABLE_Y + 20}
						width="280"
						height="92"
						rx="10"
						fill="var(--surface)"
						stroke="var(--gpu-lane)"
						stroke-width="1.5"
					/>
					<Label
						x={x + 140}
						y={TABLE_Y + 54}
						size={16}
						weight={700}
						color="var(--gpu-lane)"
						text={c.title}
					/>
					<Label x={x + 140} y={TABLE_Y + 84} size={12} text={c.text} />
				</Readout>
			{/each}
			<Readout id="examples">
				<Label
					x={480}
					y={TABLE_Y + 150}
					size={13}
					muted
					text="pixels of an image, elements of a matrix product: yes · a long chain of decisions: no"
				/>
			</Readout>
		{/if}
	{:else}
		<!-- roofline -->
		<Axes
			{sx}
			{sy}
			{xTicks}
			{yTicks}
			xFormat={xFmt}
			yFormat={yFmt}
			xLabel="operations per byte moved to or from memory"
			yLabel="operations per second (FLOP/s)"
		/>
		<defs>
			<clipPath id="roof-draw">
				<rect
					x={PLOT.x0}
					y={PLOT.y0 - 10}
					width={(PLOT.x1 - PLOT.x0) * draw}
					height={PLOT.y1 - PLOT.y0 + 20}
				/>
			</clipPath>
		</defs>
		<g clip-path="url(#roof-draw)">
			{#each CHIPS as c (c.id)}
				<path
					d={roof(c)}
					fill="none"
					stroke={chipColor[c.id]}
					stroke-width="3"
					stroke-linejoin="round"
				/>
				<line
					x1={PLOT.x0}
					x2={lx(ridge(c))}
					y1={ly(c.peak)}
					y2={ly(c.peak)}
					stroke={chipColor[c.id]}
					stroke-opacity="0.4"
					stroke-dasharray="2 4"
				/>
				<line
					x1={lx(ridge(c))}
					x2={lx(ridge(c))}
					y1={ly(c.peak)}
					y2={PLOT.y1}
					stroke={chipColor[c.id]}
					stroke-opacity="0.45"
					stroke-dasharray="3 4"
				/>
			{/each}
		</g>
		<Readout id="roof-gpu">
			<Label
				x={PLOT.x0 + 10}
				y={ly(gpu.peak) - 8}
				anchor="start"
				size={12}
				weight={600}
				color="var(--gpu-lane)"
				opacity={draw}
				text="RTX 4090 peak: {rate(gpu.peak)}"
			/>
		</Readout>
		<Readout id="roof-cpu">
			<Label
				x={PLOT.x0 + 10}
				y={ly(cpu.peak) - 8}
				anchor="start"
				size={12}
				weight={600}
				color="var(--gpu-fast)"
				opacity={draw}
				text="i9-14900K peak: {rate(cpu.peak)}"
			/>
		</Readout>
		<Readout id="slope">
			<Label
				x={lx(1 / 6)}
				y={ly(gpu.bandwidth / 6) + 20}
				anchor="start"
				size={12}
				color="var(--gpu-mem)"
				opacity={draw}
				rotate={SLOPE}
				text="waiting for memory: {fmt(gpu.bandwidth)} GB/s"
			/>
			<Label
				x={lx(1)}
				y={ly(cpu.bandwidth) + 20}
				anchor="start"
				size={12}
				color="var(--gpu-mem)"
				opacity={draw}
				rotate={SLOPE}
				text="{fmt(cpu.bandwidth, 1)} GB/s"
			/>
		</Readout>

		<!-- the other jobs, faint -->
		{#each others as o (o.w)}
			<line
				x1={lx(o.i)}
				x2={lx(o.i)}
				y1={PLOT.y1}
				y2={ly(attainable(gpu, o.i))}
				stroke="var(--stage-ink-muted)"
				stroke-opacity="0.35"
				stroke-dasharray="2 3"
				opacity={drop}
			/>
			<Readout id="other-{o.w}">
				<Label
					x={lx(o.i)}
					y={PLOT.y1 - (o.w === 'matmul' ? 24 : 8)}
					size={11}
					muted
					opacity={drop * 0.8}
					text={workName[o.w]}
				/>
			</Readout>
		{/each}

		<!-- the chosen job -->
		{@const ix = lx(shownI)}
		<line
			x1={ix}
			x2={ix}
			y1={PLOT.y1}
			y2={ly(attainable(gpu, shownI))}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity={drop}
		/>
		{#each CHIPS as c (c.id)}
			{@const yy = ly(attainable(c, shownI))}
			<circle
				cx={ix}
				cy={PLOT.y0 + (yy - PLOT.y0) * drop}
				r="7"
				fill={chipColor[c.id]}
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={drop}
			/>
		{/each}

		<!-- the verdicts -->
		{@const PX = 650}
		<Readout
			id="job"
			order={0}
			label="Job"
			value="{workName[work]}{work === 'matmul' ? `, tiles ${fmt(2 ** tileExp)} wide` : ''}"
		>
			<Label x={PX} y={96} anchor="start" size={15} weight={700} text="Job: {workName[work]}" />
			{#if work === 'matmul'}
				<Label
					x={PX}
					y={118}
					anchor="start"
					size={12}
					muted
					text={tileExp === 0
						? 'no tiles: 2 numbers fetched per multiply-add'
						: `tiles ${fmt(2 ** tileExp)} × ${fmt(2 ** tileExp)}: each number used ${fmt(2 ** tileExp)} times`}
				/>
			{/if}
		</Readout>
		<Readout id="intensity" order={1} label="Operations per byte" value={iText(intensity)}>
			<Label
				x={PX}
				y={148}
				anchor="start"
				size={13}
				text="{iText(intensity)} operations per byte"
			/>
		</Readout>
		{#each CHIPS as c, k (c.id)}
			{@const y = 196 + k * 110}
			{@const bound = memoryBound(c, intensity)}
			<Readout
				id="verdict-{c.id}"
				order={2 + k}
				label={c.id === 'gpu' ? 'RTX 4090' : 'i9-14900K'}
				value="{rate(attainable(c, intensity))}, {pctPeak(c, intensity)} of peak{bound
					? ', waiting for memory'
					: ''}"
				color={chipColor[c.id]}
			>
				<Label
					x={PX}
					{y}
					anchor="start"
					size={14}
					weight={700}
					color={chipColor[c.id]}
					text={c.id === 'gpu' ? 'RTX 4090' : 'i9-14900K'}
				/>
				<Label
					x={PX}
					y={y + 24}
					anchor="start"
					size={14}
					weight={600}
					text={rate(attainable(c, intensity))}
				/>
				<Label
					x={PX}
					y={y + 46}
					anchor="start"
					size={12}
					text="{pctPeak(c, intensity)} of its peak"
				/>
				<Label
					x={PX}
					y={y + 66}
					anchor="start"
					size={12}
					color={bound ? 'var(--gpu-mem)' : chipColor[c.id]}
					weight={600}
					text={bound ? 'waiting for memory' : 'full arithmetic speed'}
				/>
			</Readout>
		{/each}
	{/if}
</g>
