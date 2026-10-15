<script lang="ts">
	/**
	 * The race: the same job for one fast core and for N slow lanes in warps of 32.
	 *
	 * Modes (`step.hints.mode`):
	 *   solo   — the fast core alone, shading the image row by row, with the
	 *            shader's listing beside it (the side of the branch the current
	 *            pixel takes is highlighted)
	 *   race   — both machines on the pixel job, one above the other
	 *   matrix — both machines on the matrix product C = A·B
	 *
	 * Both runs come from the model (`runFast`, `runLanes`); the picture shows,
	 * for the shared tick count, which tasks each machine has finished (and
	 * which a warp is working on). The tick count is a pure function of t:
	 * linear until the lanes finish (LANES_T s), then a fast-forward that grows
	 * exponentially so that the fast core finishes FF_T s later, whatever the
	 * ratio. Reduced motion shows the finished race.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import Label from './Txt.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		FAST_IPC,
		IMAGE,
		MATRIX_N,
		SHADER,
		WARP,
		efficiency,
		matrixJob,
		pixelJob,
		runFast,
		runLanes,
		type Path
	} from '../gpu';
	import { productImage, shadedImage } from './pictures';

	let { step, t, params, reduced }: StageProps = $props();

	type Mode = 'solo' | 'race' | 'matrix';
	const mode = $derived(String(step.hints?.mode ?? 'race') as Mode);
	const lanesControl = $derived(step.controls?.find((c) => c.id.startsWith('lanes')));
	const lanes = $derived.by(() => {
		const c = lanesControl;
		const v = c ? Number(params[c.id] ?? c.default) : 10;
		return 2 ** clamp(Math.round(v), 5, 14);
	});

	const job = $derived(mode === 'matrix' ? matrixJob() : pixelJob());
	const fast = $derived(runFast(job));
	const slow = $derived(runLanes(job, lanes));
	/** Group ends in increasing order, for counting finished groups. */
	const ends = $derived(Float64Array.from(slow.end).sort());

	// ---- the shared clock -----------------------------------------------------------
	const LEAD = 0.6;
	const LANES_T = 4;
	const FF_T = 7;
	const SOLO_T = 14;
	const ticks = $derived.by(() => {
		if (reduced) return fast.cycles;
		const tau = t - LEAD;
		if (tau <= 0) return 0;
		if (mode === 'solo') return fast.cycles * clamp(tau / SOLO_T);
		const G = slow.cycles;
		const F = fast.cycles;
		if (tau <= LANES_T) return (G * tau) / LANES_T;
		const k = Math.log(Math.max(1.0001, F / G)) / FF_T;
		return Math.min(F, G * Math.exp(k * (tau - LANES_T)));
	});
	/** How much faster than at first the clock now runs (1 until the lanes finish). */
	const pace = $derived.by(() => {
		if (reduced || mode === 'solo') return 1;
		const tau = t - LEAD - LANES_T;
		if (tau <= 0 || ticks >= fast.cycles) return 1;
		const k = Math.log(Math.max(1.0001, fast.cycles / slow.cycles)) / FF_T;
		return Math.exp(k * tau);
	});

	/** Number of entries of a sorted array that are ≤ v. */
	function upTo(a: Float64Array, v: number): number {
		let lo = 0;
		let hi = a.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (a[mid] <= v + 1e-9) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}
	const fastDone = $derived(upTo(fast.done, ticks));
	const groupsDone = $derived(upTo(ends, ticks));
	const slowDone = $derived(Math.min(job.tasks, groupsDone * WARP));
	const fastFinished = $derived(fastDone >= job.tasks);
	const slowFinished = $derived(groupsDone >= slow.end.length);

	// ---- layout -------------------------------------------------------------------
	const solo = $derived(mode === 'solo');
	const cols = $derived(job.perRow);
	const rows = $derived(job.tasks / job.perRow);
	/** Drawing size of one task. */
	const cell = $derived(solo ? 2 : mode === 'matrix' ? 200 / MATRIX_N : 320 / IMAGE.w);
	const picW = $derived(cols * cell);
	const picH = $derived(rows * cell);
	const picX = $derived(solo ? 40 : mode === 'matrix' ? 100 : 40);
	const panels = $derived(
		solo
			? [{ id: 'fast' as const, y: 96 }]
			: [
					{ id: 'fast' as const, y: 82 },
					{ id: 'slow' as const, y: 342 }
				]
	);
	const picture = $derived(mode === 'matrix' ? productImage() : shadedImage());

	/**
	 * Task ranges [a, b) of the groups that pass `keep`, merged where groups are
	 * consecutive. Groups finish out of order (a sky group is quicker than an edge
	 * group), so the finished part of the picture is not a prefix.
	 */
	function groupRuns(keep: (g: number) => boolean): [number, number][] {
		const out: [number, number][] = [];
		const G = slow.end.length;
		for (let g = 0; g < G; g++) {
			if (!keep(g)) continue;
			const a = g;
			while (g + 1 < G && keep(g + 1)) g++;
			out.push([a * WARP, Math.min(job.tasks, (g + 1) * WARP)]);
		}
		return out;
	}
	const slowDoneRuns = $derived(groupRuns((g) => slow.end[g] <= ticks + 1e-9));
	const slowBusyRuns = $derived(
		slowFinished ? [] : groupRuns((g) => slow.start[g] <= ticks && ticks < slow.end[g] - 1e-9)
	);

	interface Box {
		x: number;
		y: number;
		w: number;
		h: number;
	}
	/** Rectangles covering tasks [a, b) of a picture laid out in rows. */
	function span(a: number, b: number, y0: number): Box[] {
		if (b <= a) return [];
		const out: Box[] = [];
		const ra = Math.floor(a / cols);
		const ca = a % cols;
		const rb = Math.floor(b / cols);
		const cb = b % cols;
		if (ra === rb)
			return [{ x: picX + ca * cell, y: y0 + ra * cell, w: (cb - ca) * cell, h: cell }];
		out.push({ x: picX + ca * cell, y: y0 + ra * cell, w: (cols - ca) * cell, h: cell });
		if (rb > ra + 1)
			out.push({ x: picX, y: y0 + (ra + 1) * cell, w: picW, h: (rb - ra - 1) * cell });
		if (cb > 0) out.push({ x: picX, y: y0 + rb * cell, w: cb * cell, h: cell });
		return out;
	}

	const spans = (runs: [number, number][], y0: number) => runs.flatMap(([a, b]) => span(a, b, y0));

	const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
	const pct = (v: number) => {
		const p = 100 * v;
		if (p > 0 && p < 0.1) return '<0.1%';
		return p > 0 && p < 1 ? `${p.toFixed(1)}%` : `${Math.floor(p)}%`;
	};
	const nicePace = (v: number) => {
		if (v < 1.5) return '';
		const mag = 10 ** Math.floor(Math.log10(v));
		const m = [1, 2, 5, 10].findLast((s) => s * mag <= v) ?? 1;
		return `fast-forward ×${fmt(m * mag)}`;
	};

	// ---- the shader listing (solo) ------------------------------------------------
	const current = $derived(Math.min(job.tasks - 1, fastDone));
	const onBall = $derived(job.on ? job.on[current] === 1 : false);
	const pathOn = (p: Path) =>
		p === 'all' || p === 'end' || (p === 'sphere' && onBall) || (p === 'sky' && !onBall);
	const LIST_X = 610;
	const LIST_Y = 108;
	const LINE = 16.4;
	const pathColor: Record<Path, string> = {
		all: 'var(--stage-ink-muted)',
		sphere: 'var(--gpu-ball)',
		sky: 'var(--gpu-sky)',
		end: 'var(--stage-ink-muted)'
	};
	const curX = $derived(picX + ((current % cols) + 0.5) * cell);
	const curY = $derived(96 + (Math.floor(current / cols) + 0.5) * cell);

	const showCursor = $derived(solo && !fastFinished && !reduced);
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const speedup = $derived(fast.cycles / slow.cycles);
</script>

<g opacity={fadeIn}>
	<defs>
		{#each panels as p (p.id)}
			<clipPath id="race-clip-{p.id}">
				{#each p.id === 'fast' ? span(0, fastDone, p.y) : spans(slowDoneRuns, p.y) as r, i (i)}
					<rect x={r.x} y={r.y} width={r.w + 0.4} height={r.h + 0.4} />
				{/each}
			</clipPath>
		{/each}
	</defs>

	{#if !solo}
		<Readout id="clock">
			<Label
				x={40}
				y={46}
				anchor="start"
				size={15}
				weight={700}
				text="Same clock for both: {fmt(ticks)} ticks"
			/>
		</Readout>
		<Readout id="pace">
			<Label
				x={920}
				y={46}
				anchor="end"
				size={13}
				color="var(--gpu-serial)"
				opacity={pace > 1.5 ? 1 : 0}
				text="{nicePace(pace)}, so that the fast core can finish"
			/>
		</Readout>
	{/if}

	{#each panels as p (p.id)}
		{@const isFast = p.id === 'fast'}
		{@const done = isFast ? fastDone : slowDone}
		{@const finished = isFast ? fastFinished : slowFinished}
		{@const color = isFast ? 'var(--gpu-fast)' : 'var(--gpu-lane)'}
		<!-- the picture: still to do (grid), done (the image), in progress (highlight) -->
		<rect
			x={picX - 1}
			y={p.y - 1}
			width={picW + 2}
			height={picH + 2}
			rx="3"
			fill="var(--stage-grid)"
			stroke={color}
			stroke-width="1.5"
		/>
		{#if picture}
			<image
				href={picture}
				x={picX}
				y={p.y}
				width={picW}
				height={picH}
				preserveAspectRatio="none"
				clip-path="url(#race-clip-{p.id})"
				style:image-rendering={mode === 'matrix' ? 'pixelated' : 'auto'}
			/>
		{/if}
		{#if !isFast && !slowFinished}
			{#each spans(slowBusyRuns, p.y) as r, i (i)}
				<rect x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--gpu-lane)" opacity="0.75" />
			{/each}
		{/if}

		<!-- the machine's card -->
		{#if !solo}
			{@const tx = picX + picW + 40}
			{@const bw = 900 - tx}
			<Readout
				id="{p.id}-name"
				order={isFast ? 2 : 4}
				label={isFast ? '1 fast core' : `${fmt(lanes)} slow lanes`}
				value={finished
					? `done in ${fmt(isFast ? fast.cycles : slow.cycles)} ticks`
					: `${pct(done / job.tasks)} done`}
				{color}
			>
				<Label
					x={tx}
					y={p.y + 20}
					anchor="start"
					size={16}
					weight={700}
					{color}
					text={isFast ? '1 fast core' : `${fmt(lanes)} slow lanes`}
				/>
				<Label
					x={tx}
					y={p.y + 42}
					anchor="start"
					size={12}
					muted
					text={isFast
						? `${FAST_IPC} instructions per tick, one ${mode === 'matrix' ? 'element' : 'pixel'} at a time`
						: `1 instruction per tick each, in ${fmt(lanes / WARP)} warp${lanes === WARP ? '' : 's'} of 32`}
				/>
				<rect x={tx} y={p.y + 64} width={bw} height="16" rx="8" fill="var(--stage-grid)" />
				<rect
					x={tx}
					y={p.y + 64}
					width={Math.max(done > 0 ? 8 : 0, (bw * done) / job.tasks)}
					height="16"
					rx="8"
					fill={color}
				/>
				<Label
					x={tx}
					y={p.y + 106}
					anchor="start"
					size={14}
					weight={600}
					text={finished
						? `done in ${fmt(isFast ? fast.cycles : slow.cycles)} ticks`
						: `${fmt(done)} of ${fmt(job.tasks)} ${mode === 'matrix' ? 'elements' : 'pixels'} (${pct(done / job.tasks)})`}
				/>
			</Readout>
			{#if !isFast}
				<Readout
					id="busy"
					order={5}
					label="Lanes kept busy"
					value={pct(efficiency(slow))}
					opacity={slowFinished ? 1 : 0}
				>
					<Label
						x={tx}
						y={p.y + 130}
						anchor="start"
						size={12}
						muted
						opacity={slowFinished ? 1 : 0}
						text="lanes kept busy: {pct(efficiency(slow))} of their ticks"
					/>
				</Readout>
				<Readout
					id="speedup"
					order={6}
					label="Lanes against the fast core"
					value="{fmt(speedup)}× faster"
					opacity={slowFinished ? 1 : 0}
				>
					<Label
						x={tx}
						y={p.y + 176}
						anchor="start"
						size={16}
						weight={700}
						color="var(--gpu-lane)"
						opacity={slowFinished ? 1 : 0}
						text="{fmt(speedup)}× faster than the fast core"
					/>
				</Readout>
			{/if}
		{/if}
	{/each}

	{#if mode === 'matrix'}
		<Readout id="what">
			<Label
				x={picX + picW / 2}
				y={330}
				size={12}
				muted
				text="C = A·B, {MATRIX_N} × {MATRIX_N}: one square per element"
			/>
		</Readout>
	{/if}

	{#if solo}
		{#if showCursor}
			<g style:pointer-events="none">
				<circle cx={curX} cy={curY} r="7" fill="none" stroke="var(--gpu-fast)" stroke-width="2" />
				<line
					x1={curX}
					y1={curY - 14}
					x2={curX}
					y2={curY - 8}
					stroke="var(--gpu-fast)"
					stroke-width="2"
				/>
				<line
					x1={curX}
					y1={curY + 8}
					x2={curX}
					y2={curY + 14}
					stroke="var(--gpu-fast)"
					stroke-width="2"
				/>
			</g>
		{/if}
		<Readout
			id="solo"
			order={1}
			label="1 fast core, {FAST_IPC} instructions per tick"
			value={fastFinished ? `done in ${fmt(fast.cycles)} ticks` : `${fmt(ticks)} ticks`}
			color="var(--gpu-fast)"
		>
			<Label
				x={40}
				y={56}
				anchor="start"
				size={16}
				weight={700}
				color="var(--gpu-fast)"
				text="1 fast core · {FAST_IPC} instructions per tick"
			/>
			<Label
				x={40}
				y={452}
				anchor="start"
				size={15}
				weight={600}
				text={fastFinished
					? `${fmt(job.tasks)} pixels, done in ${fmt(fast.cycles)} ticks`
					: `${fmt(ticks)} ticks · pixel ${fmt(current + 1)} of ${fmt(job.tasks)}`}
			/>
		</Readout>
		<Readout id="solo-note">
			<Label
				x={40}
				y={476}
				anchor="start"
				size={12}
				muted
				text="one pixel after another, row by row; each pixel’s colour depends only on its own x and y"
			/>
		</Readout>

		<!-- the shader -->
		<Readout id="listing">
			<Label
				x={LIST_X}
				y={LIST_Y - 26}
				anchor="start"
				size={14}
				weight={700}
				text="The shader: run once per pixel"
			/>
			{#each SHADER as ins, i (i)}
				{@const y = LIST_Y + i * LINE}
				{@const lit = pathOn(ins.path) && !fastFinished}
				{#if ins.path === 'sphere' || ins.path === 'sky'}
					<rect
						x={LIST_X - 12}
						y={y - 11}
						width="4"
						height={LINE}
						fill={pathColor[ins.path]}
						opacity={lit ? 1 : 0.35}
					/>
				{/if}
				{#if lit && (ins.path === 'sphere' || ins.path === 'sky')}
					<rect x={LIST_X - 6} y={y - 12} width="312" height={LINE} rx="3" fill="var(--gpu-path)" />
				{/if}
				<text
					x={LIST_X}
					{y}
					style:font-size="12.5px"
					font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
					opacity={ins.path === 'all' || ins.path === 'end' || lit || fastFinished ? 1 : 0.45}
					>{ins.text}</text
				>
			{/each}
			<Label
				x={LIST_X + 306}
				y={LIST_Y + 6 * LINE + 6.5 * LINE}
				anchor="end"
				size={12}
				color={pathColor.sphere}
				text="ball"
			/>
			<Label
				x={LIST_X + 306}
				y={LIST_Y + 21.5 * LINE}
				anchor="end"
				size={12}
				color={pathColor.sky}
				text="sky"
			/>
		</Readout>
	{/if}
</g>
