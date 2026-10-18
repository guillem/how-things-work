<script lang="ts">
	/**
	 * Dye spreading from the top-left corner of a box of water 200 µm × 120 µm (../model.ts
	 * `dyeBox`: 300 Brownian walkers, real time). Under the box, the share of the dye in each of
	 * ten slices (the concentration graph).
	 *
	 * Focus (`step.hints.focus`): 'drop' (time, temperature and D); 'count' (a dashed line down
	 * the middle, the crossings each way and the net flow, and one molecule followed with its
	 * trail); 'warm' (the spread from the corner against time, dashed at 20 °C, and how long the
	 * dye takes to spread over 10 µm … 1 m at this temperature).
	 *
	 * The walk is computed lazily as the clock advances and restarts when the temperature changes
	 * or "Drop again" is pressed: the clock reading at that moment is remembered in a
	 * frame-to-frame memo inside a `$derived` (the guide's sanctioned exception, as in
	 * bacterial-chemotaxis/DishScene). Reduced motion: the frame STILL seconds after the drop.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BOX, Walkers, dyeBox, dyeD, profile, rmsFromCorner, spreadTime } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'drop'));
	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const temp = $derived(offers('temp') ? Number(params.temp ?? 20) : 20);
	const drops = $derived(Number(params.redrop ?? 0));
	const counting = $derived(focus === 'count');

	const MAXT = 120;
	const STILL = 8;

	// ---- geometry ----------------------------------------------------------------------------
	const S = 2.6;
	const BX = 40;
	const BY = 52;
	const BW = BOX.w * S;
	const BH = BOX.h * S;
	const px = (x: number) => BX + x * S;
	const py = (y: number) => BY + y * S;

	// ---- the walk, restarted on a new setting (memo: see the header comment) -----------------
	const key = $derived(`${temp}|${drops}|${counting}`);
	let memo: { key: string; start: number; last: number; sim: Walkers | null } = {
		key: '',
		start: 0,
		last: 0,
		sim: null
	};
	let ghost: Walkers | null = null;
	let memoSeed = -1;
	const run = $derived.by(() => {
		if (memo.key !== key || t < memo.last || !memo.sim) {
			const fresh = memo.key === '' || t < memo.last;
			memo = { key, start: fresh ? 0 : t, last: t, sim: dyeBox(temp, 7 + drops, counting) };
		}
		memo.last = t;
		const sim = memo.sim!;
		const simT = reduced ? STILL : Math.min(MAXT, t - memo.start);
		const f = simT * sim.fps;
		const k = sim.at(Math.floor(f) + 1) - 1;
		const u = clamp(f - k, 0, 1);
		return { sim, simT, k, u };
	});

	// ---- the dye ------------------------------------------------------------------------------
	const R = 2.6;
	const dot = (x: number, y: number, r = R) =>
		`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	const pos = (i: number) => {
		const { sim, k, u } = run;
		const a = sim.xs[k][i];
		const b = sim.xs[k + 1][i];
		const c = sim.ys[k][i];
		const d = sim.ys[k + 1][i];
		return { x: px(a + (b - a) * u), y: py(c + (d - c) * u) };
	};
	const dyePath = $derived.by(() => {
		let d = '';
		for (let i = counting ? 1 : 0; i < run.sim.n; i++) {
			const p = pos(i);
			d += dot(p.x, p.y);
		}
		return d;
	});
	/** The followed molecule (number 0) and its last 3 s. */
	const followed = $derived.by(() => {
		if (!counting) return null;
		const { sim, k } = run;
		let d = '';
		for (let j = Math.max(0, k - 30); j <= k; j++)
			d += `${d ? 'L' : 'M'}${px(sim.xs[j][0]).toFixed(1)} ${py(sim.ys[j][0]).toFixed(1)}`;
		const p = pos(0);
		return { trail: `${d}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`, p };
	});

	// ---- the concentration graph --------------------------------------------------------------
	const BINS = 10;
	const GY0 = 548;
	const GY1 = 440;
	const gy = scale([0, 0.5], [GY0, GY1]);
	const shares = $derived(profile(run.sim, run.k + (run.u > 0.5 ? 1 : 0), BINS));

	// ---- read-outs -------------------------------------------------------------------------------
	const D = $derived(dyeD(temp));
	const kk = $derived(run.k + (run.u > 0.5 ? 1 : 0));
	const toRight = $derived(run.sim.toRight[kk]);
	const toLeft = $derived(run.sim.toLeft[kk]);
	const secs = (s: number) => `${s.toFixed(1)} s`;

	// ---- the spread chart (focus 'warm') --------------------------------------------------------
	const CX0 = 610;
	const CX1 = 920;
	const cx = scale([0, 45], [CX0, CX1]);
	const cy = scale([0, 150], [330, 150]);
	const series = (sim: Walkers, upto: number) => {
		const out: { s: number; r: number }[] = [];
		for (let j = 0; j <= Math.min(upto, 450); j += 3)
			out.push({ s: j / sim.fps, r: rmsFromCorner(sim, j) });
		return out;
	};
	const curve = $derived(
		focus === 'warm'
			? linePath(
					series(run.sim, kk),
					(d) => d.s,
					(d) => d.r,
					cx,
					cy
				)
			: ''
	);
	const ghostCurve = $derived.by(() => {
		if (focus !== 'warm') return '';
		const seed = 7 + drops;
		if (!ghost || ghost.D !== dyeD(20) || memoSeed !== seed) {
			ghost = dyeBox(20, seed);
			memoSeed = seed;
		}
		ghost.at(Math.min(450, kk));
		return linePath(
			series(ghost, kk),
			(d) => d.s,
			(d) => d.r,
			cx,
			cy
		);
	});
	const human = (s: number) => {
		if (s < 60) return s < 1 ? `${s.toFixed(2)} s` : `${s.toFixed(0)} s`;
		if (s < 3600) return `${(s / 60).toFixed(0)} min`;
		if (s < 86400 * 2) return `${(s / 3600).toFixed(0)} hours`;
		if (s < 86400 * 365) return `${(s / 86400).toFixed(1)} days`;
		return `${(s / (86400 * 365.25)).toFixed(0)} years`;
	};
	const table = $derived(
		[
			{ what: '10 µm, a cell', x: 10 },
			{ what: '1 mm', x: 1000 },
			{ what: '1 cm', x: 1e4 },
			{ what: '1 m', x: 1e6 }
		].map((r) => ({ ...r, time: human(spreadTime(r.x, D)) }))
	);
</script>

<g>
	<clipPath id="do-box-clip">
		<rect x={BX} y={BY} width={BW} height={BH} rx="6" />
	</clipPath>
	<!-- the box of water -->
	<rect x={BX} y={BY} width={BW} height={BH} rx="6" fill="var(--do-water)" />
	<g clip-path="url(#do-box-clip)">
		{#if counting}
			<line
				x1={px(BOX.w / 2)}
				y1={BY + 4}
				x2={px(BOX.w / 2)}
				y2={BY + BH - 4}
				stroke="var(--stage-ink)"
				stroke-dasharray="6 5"
				stroke-width="1.5"
				opacity="0.7"
			/>
		{/if}
		<path d={dyePath} fill="var(--do-dye)" opacity={counting ? 0.55 : 0.85} />
		{#if followed}
			<path
				d={followed.trail}
				fill="none"
				stroke="var(--do-trace)"
				stroke-width="1.8"
				stroke-linejoin="round"
				opacity="0.85"
			/>
			<circle
				cx={followed.p.x}
				cy={followed.p.y}
				r="6"
				fill="var(--do-trace)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
	</g>
	<rect
		x={BX}
		y={BY}
		width={BW}
		height={BH}
		rx="6"
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Readout id="box-title">
		<Label
			x={BX}
			y={BY - 14}
			text="a box of water, 0.2 mm wide, seen from above"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- the concentration graph -->
	<Axes
		sx={scale([0, BOX.w], [BX, BX + BW])}
		sy={gy}
		xTicks={[0, 50, 100, 150, 200]}
		yTicks={[0, 0.1, 0.2, 0.3, 0.4, 0.5]}
		yFormat={(v) => `${Math.round(v * 100)}%`}
		xLabel="µm from the left"
	/>
	{#each shares as s, i (i)}
		<rect
			x={BX + (i * BW) / BINS + 3}
			y={gy(Math.min(s, 0.5))}
			width={BW / BINS - 6}
			height={GY0 - gy(Math.min(s, 0.5))}
			rx="2"
			fill="var(--do-dye)"
			opacity="0.75"
		/>
	{/each}
	<line
		x1={BX}
		x2={BX + BW}
		y1={gy(0.1)}
		y2={gy(0.1)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
		stroke-width="1.2"
	/>
	<Readout id="graph-key">
		<Label
			x={BX + BW}
			y={GY1 - 10}
			text="share of the dye in each slice · dashed: evened out"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>

	<!-- right-hand panel -->
	<Readout id="time" order={1} label="Time since the drop" value={secs(run.simT)}>
		<Label
			x={610}
			y={64}
			text="{secs(run.simT)} since the drop"
			size={16}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	{#if focus === 'drop'}
		<Readout id="temp" order={2} label="Water" value="{temp} °C">
			<Label x={610} y={96} text="water at {temp} °C" size={13} anchor="start" />
		</Readout>
		<Readout id="d" order={3} label="Dye spreads at" value="D = {(D / 1e6).toFixed(5)} mm²/s">
			<Label
				x={610}
				y={120}
				text="diffusion coefficient D = {(D / 1e6).toFixed(5)} mm²/s"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
		<Readout id="drop-key">
			<Label x={610} y={160} text="green dots: dye molecules" size={12} anchor="start" />
			<Label
				x={610}
				y={180}
				text="(each dot stands for very many)"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else if focus === 'count'}
		<Readout id="right" order={2} label="Crossed the line →" value={String(toRight)}>
			<Label
				x={610}
				y={110}
				text="crossed the line → : {toRight}"
				size={14}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="left" order={3} label="Crossed the line ←" value={String(toLeft)}>
			<Label
				x={610}
				y={136}
				text="crossed the line ← : {toLeft}"
				size={14}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="net"
			order={4}
			label="Net flow to the right"
			value={String(toRight - toLeft)}
			color="var(--do-dye-text)"
		>
			<Label
				x={610}
				y={168}
				text="net flow to the right: {toRight - toLeft}"
				size={15}
				weight={600}
				anchor="start"
				color="var(--do-dye-text)"
				tabular
			/>
		</Readout>
		<Readout id="follow-key">
			<Label
				x={610}
				y={210}
				text="blue: one molecule and its last 3 s"
				size={12}
				anchor="start"
				color="var(--do-trace)"
			/>
			<Label
				x={610}
				y={230}
				text="each step: left or right, equally likely"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else}
		<Readout id="temp" order={2} label="Water" value="{temp} °C">
			<Label x={610} y={94} text="water at {temp} °C" size={13} anchor="start" />
		</Readout>
		<Axes sx={cx} sy={cy} xTicks={[0, 15, 30, 45]} yTicks={[0, 50, 100, 150]} xLabel="s" />
		<Readout id="chart-key">
			<Label
				x={CX0}
				y={128}
				text="spread from the corner (µm) · dashed: 20 °C"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
		{#if temp !== 20}
			<path
				d={ghostCurve}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}
		<path d={curve} fill="none" stroke="var(--do-dye-text)" stroke-width="2.2" />
		<Readout id="table-title">
			<Label
				x={CX0}
				y={392}
				text="time to spread by diffusion, at {temp} °C:"
				size={13}
				weight={600}
				anchor="start"
			/>
		</Readout>
		{#each table as r, i (r.what)}
			<Readout id="row-{i}" order={3 + i} label={r.what} value={r.time}>
				<Label x={CX0} y={420 + i * 24} text={r.what} size={13} anchor="start" />
				<Label x={CX1} y={420 + i * 24} text={r.time} size={13} anchor="end" weight={600} tabular />
			</Readout>
		{/each}
	{/if}
</g>
