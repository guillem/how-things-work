<script lang="ts">
	/**
	 * One warp of 32 lanes going through the shader in lockstep.
	 *
	 * Modes (`step.hints.mode`):
	 *   lockstep   — a warp of 32 pixels of the ball, on the shaded image
	 *   divergence — the warp chosen with `params.warp` (sky, ball, or across
	 *                the edge), on the map of what every warp costs
	 *
	 * Right: one row per tick, in the order the warp runs them, one cell per
	 * lane: lit when the lane does work on that tick, grey when it is switched
	 * off because its pixel takes the other side of the branch. Rows appear one
	 * per ROW_T seconds (a pure function of t), then the finished table holds.
	 */
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FAST_IPC, IMAGE, PIXEL_COST, SHADER, WARP, pixelJob, shade, type Path } from '../gpu';
	import { shadedImage, warpMap } from './pictures';

	let { step, t, params, reduced, dark }: StageProps = $props();

	type Mode = 'lockstep' | 'divergence';
	type Kind = 'sky' | 'ball' | 'edge';
	const mode = $derived(String(step.hints?.mode ?? 'lockstep') as Mode);
	const kind = $derived((mode === 'lockstep' ? 'ball' : String(params.warp ?? 'edge')) as Kind);

	const job = pixelJob();
	const perRow = IMAGE.w / WARP;
	const MIXED = Math.max(...job.warpCost);
	const onCount = (w: number) => {
		let c = 0;
		for (let k = w * WARP; k < (w + 1) * WARP; k++) c += job.on![k];
		return c;
	};
	/** The warps shown: the top-left sky warp, one in the middle of the ball, and one across its edge. */
	const PICKS: Record<Kind, number> = (() => {
		const row = 78; // the ball's centre row
		let ball = row * perRow;
		while (onCount(ball) < WARP) ball++;
		let edge = 0;
		let best = WARP;
		for (let w = 60 * perRow; w < 61 * perRow; w++) {
			const d = Math.abs(onCount(w) - WARP / 2);
			if (onCount(w) > 0 && onCount(w) < WARP && d < best) {
				best = d;
				edge = w;
			}
		}
		return { sky: 0, ball, edge };
	})();
	const warp = $derived(PICKS[kind]);
	const lanes = $derived(
		Array.from({ length: WARP }, (_, i) => {
			const k = warp * WARP + i;
			const x = k % IMAGE.w;
			const y = Math.floor(k / IMAGE.w);
			const s = shade(x, y);
			return { i, on: s.on, rgb: s.rgb };
		})
	);
	const anyOn = $derived(lanes.some((l) => l.on));
	const anyOff = $derived(lanes.some((l) => !l.on));
	/** The instructions the warp runs, in order, and which lanes do work on each. */
	const rows = $derived(
		SHADER.flatMap((ins, k) => {
			if (ins.path === 'sphere' && !anyOn) return [];
			if (ins.path === 'sky' && !anyOff) return [];
			return [{ k, ins, active: (on: boolean) => activeOn(ins.path, on) }];
		})
	);
	function activeOn(p: Path, on: boolean) {
		return p === 'all' || p === 'end' || (p === 'sphere' ? on : !on);
	}
	const useful = $derived(
		rows.reduce((sum, r) => sum + lanes.filter((l) => r.active(l.on)).length, 0)
	);
	const own = $derived(
		lanes.reduce((sum, l) => sum + SHADER.filter((s) => activeOn(s.path, l.on)).length, 0)
	);

	// ---- time ----------------------------------------------------------------------
	const LEAD = 0.8;
	const ROW_T = 0.32;
	const shown = $derived(
		reduced ? rows.length : clamp(Math.floor((t - LEAD) / ROW_T) + 1, 0, rows.length)
	);

	// ---- layout --------------------------------------------------------------------
	const MAP = { x: 40, y: 92, s: 1.25 };
	const mapW = IMAGE.w * MAP.s;
	const mapH = IMAGE.h * MAP.s;
	const warpBox = $derived({
		x: MAP.x + ((warp * WARP) % IMAGE.w) * MAP.s,
		y: MAP.y + Math.floor((warp * WARP) / IMAGE.w) * MAP.s
	});
	const LX = 410; // listing
	const GX = 620; // lane grid
	const CW = 8.4;
	const GAP = 0.6;
	const GY = 92;
	const RH = Math.min(17.5, 450 / 26);
	const connector = $derived.by(() => {
		const x0 = warpBox.x + WARP * MAP.s + 2;
		const y0 = warpBox.y + 1;
		return `M${x0} ${y0} C ${x0 + 40} ${GY - 40}, ${LX - 60} ${GY - 14}, ${GX - 6} ${GY - 14}`;
	});
	const picture = $derived(mode === 'divergence' ? warpMap(dark) : shadedImage());
	/** Runs of neighbouring lanes that are all on or all off on a row. */
	function runsOf(r: { active: (on: boolean) => boolean }) {
		const out: { a: number; b: number; active: boolean }[] = [];
		for (const l of lanes) {
			const active = r.active(l.on);
			const last = out.at(-1);
			if (last && last.active === active) last.b = l.i + 1;
			else out.push({ a: l.i, b: l.i + 1, active });
		}
		return out;
	}
	const gaps = $derived.by(() => {
		let d = '';
		for (let i = 1; i < WARP; i++) {
			const x = GX + i * (CW + GAP) - GAP / 2;
			d += `M${x.toFixed(2)} ${GY} V${(GY + shown * RH).toFixed(1)}`;
		}
		return d;
	});
	const pathTint: Record<Path, string> = {
		all: 'var(--gpu-lane)',
		end: 'var(--gpu-lane)',
		sphere: 'var(--gpu-ball)',
		sky: 'var(--gpu-sky)'
	};
	const pct = (v: number) => `${Math.round(100 * v)}%`;
	const kindText: Record<Kind, string> = {
		sky: '32 pixels of sky',
		ball: '32 pixels of the ball',
		edge: '32 pixels across the edge'
	};
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const done = $derived(shown >= rows.length);
	const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(255 * v)).join(',')})`;
</script>

<g opacity={fadeIn}>
	<!-- the picture, with the warp's 32 pixels outlined -->
	<Readout id="map-title">
		<Label
			x={MAP.x}
			y={MAP.y - 18}
			anchor="start"
			size={14}
			weight={700}
			text={mode === 'divergence' ? 'What each warp costs' : 'One warp = 32 pixels side by side'}
		/>
	</Readout>
	{#if picture}
		<image
			href={picture}
			x={MAP.x}
			y={MAP.y}
			width={mapW}
			height={mapH}
			preserveAspectRatio="none"
			style:image-rendering="pixelated"
		/>
	{/if}
	<rect x={MAP.x} y={MAP.y} width={mapW} height={mapH} fill="none" stroke="var(--border)" />
	<rect
		x={warpBox.x - 2}
		y={warpBox.y - 3}
		width={WARP * MAP.s + 4}
		height={MAP.s + 6}
		rx="2"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<path
		d={connector}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="3 3"
	/>

	{#if mode === 'divergence'}
		{@const items = [
			{ id: 'sky', label: `all sky: ${PIXEL_COST.sky} ticks`, fill: dark ? '#29333f' : '#dbe6f2' },
			{
				id: 'ball',
				label: `all ball: ${PIXEL_COST.sphere} ticks`,
				fill: dark ? '#734d29' : '#fac78c'
			},
			{ id: 'edge', label: `across the edge: ${MIXED} ticks`, fill: dark ? '#fa6b6b' : '#d92633' }
		]}
		{#each items as it, i (it.id)}
			<Readout id="key-{it.id}">
				<rect
					x={MAP.x}
					y={MAP.y + mapH + 18 + i * 22}
					width="14"
					height="14"
					rx="2"
					fill={it.fill}
					stroke="var(--border)"
				/>
				<Label
					x={MAP.x + 22}
					y={MAP.y + mapH + 30 + i * 22}
					anchor="start"
					size={12}
					text={it.label}
				/>
			</Readout>
		{/each}
	{/if}

	<!-- the warp: one row per tick, one column per lane -->
	<Readout id="warp-title" order={0} label="This warp" value={kindText[kind]}>
		<Label
			x={GX}
			y={GY - 52}
			anchor="start"
			size={14}
			weight={700}
			text="This warp: {kindText[kind]}"
		/>
	</Readout>
	<Readout id="lane-head">
		<Label
			x={GX}
			y={GY - 30}
			anchor="start"
			size={11}
			muted
			text="32 lanes, each with its own pixel"
		/>
	</Readout>
	{#each lanes as l (l.i)}
		<rect
			x={GX + l.i * (CW + GAP)}
			y={GY - 20}
			width={CW}
			height="12"
			rx="1.5"
			fill={rgb(l.rgb)}
			stroke="var(--border)"
			stroke-width="0.5"
		/>
	{/each}
	{#each rows as r, j (r.k)}
		{@const y = GY + j * RH}
		{@const on = j < shown}
		{@const now = j === shown - 1 && !done}
		{#if on}
			<text
				x={LX}
				y={y + RH * 0.72}
				font-size="12"
				font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
				font-weight={now ? 700 : 400}>{r.ins.text}</text
			>
			<rect x={LX - 10} y={y + 1} width="4" height={RH - 2} rx="1" fill={pathTint[r.ins.path]} />
			{#each runsOf(r) as run (run.a)}
				<rect
					x={GX + run.a * (CW + GAP)}
					y={y + 1}
					width={(run.b - run.a) * (CW + GAP) - GAP}
					height={RH - 2}
					rx="1.5"
					fill={run.active ? pathTint[r.ins.path] : 'var(--gpu-idle)'}
					opacity={run.active ? (now ? 1 : 0.8) : 1}
				/>
			{/each}
		{/if}
	{/each}
	<!-- the gaps between lanes, drawn once over all the rows -->
	{#if shown > 0}
		<path d={gaps} stroke="var(--stage-bg)" stroke-width={GAP + 0.6} />
	{/if}
	<Readout id="tick-label">
		<Label
			x={LX - 16}
			y={GY + Math.max(0, shown - 1) * RH + RH * 0.72}
			size={11}
			muted
			opacity={shown > 0 ? 1 : 0}
			anchor="end"
			text="tick {shown}"
		/>
	</Readout>

	<!-- totals -->
	<Readout
		id="ticks"
		order={1}
		label="Ticks for the warp"
		value="{rows.length}{anyOn && anyOff ? ': both sides of the branch' : ''}"
	>
		<Label
			x={MAP.x}
			y={mode === 'divergence' ? 432 : 360}
			anchor="start"
			size={15}
			weight={700}
			opacity={done ? 1 : 0.35}
			text="{rows.length} ticks for all 32 pixels{anyOn && anyOff ? ': both sides run' : ''}"
		/>
	</Readout>
	<Readout id="busy" order={2} label="Lanes doing work" value={pct(useful / (rows.length * WARP))}>
		<Label
			x={MAP.x}
			y={mode === 'divergence' ? 456 : 384}
			anchor="start"
			size={13}
			opacity={done ? 1 : 0.35}
			text="lanes doing work: {pct(useful / (rows.length * WARP))} of the lane-ticks"
		/>
	</Readout>
	<Readout
		id="fastcore"
		order={3}
		label="The fast core, for the same 32 pixels"
		value="{Math.round(own / FAST_IPC)} ticks"
	>
		<Label
			x={MAP.x}
			y={mode === 'divergence' ? 480 : 408}
			anchor="start"
			size={12}
			muted
			opacity={done ? 1 : 0.35}
			text="the fast core, same 32 pixels: {Math.round(own / FAST_IPC)} ticks"
		/>
	</Readout>
	{#if anyOn && anyOff}
		<Readout id="legend-paths">
			<Label
				x={MAP.x}
				y={512}
				anchor="start"
				size={12}
				color="var(--gpu-ball)"
				text="orange: the ball’s side"
			/>
			<Label
				x={MAP.x + 160}
				y={512}
				anchor="start"
				size={12}
				color="var(--gpu-sky)"
				text="blue: the sky’s side"
			/>
			<Label x={MAP.x} y={532} anchor="start" size={12} muted text="grey: lane switched off" />
		</Readout>
	{/if}
</g>
