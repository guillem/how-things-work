<script lang="ts">
	/**
	 * 300 cells released evenly over a chamber 1.8 mm × 0.88 mm with a drop of MeAsp (../model.ts
	 * `dish`: each cell runs, tumbles and adapts on its own). The attractant is shaded, the
	 * dashed circle marks 0.3 mm around the drop, and every cell leaves a short trail (its last
	 * 2 s). The drop is a handle (and two sliders): moving it moves the attractant from that
	 * moment, and the cells, as they were, find it again. Underneath, the share of cells near the
	 * drop against time.
	 *
	 * Focus (`step.hints.focus`): 'gather'; 'runs' (cells heading towards the drop coloured, and
	 * the mean length of the runs that start towards and away from it); 'tune' (controls `speed`
	 * and `tau`, with the standard cell dashed on the chart); 'off' (control `adapt`, the same).
	 *
	 * The simulation is computed lazily as the clock advances (SPEED times real time) and restarts
	 * when another setting changes or "Release again" is pressed: the clock reading at that moment is
	 * remembered in a frame-to-frame memo inside a `$derived` (the guide's sanctioned exception,
	 * as in atmosphere-weather/CoriolisScene). Reduced motion: the state after STILL seconds.
	 */
	import { Axes, Handle, Label, clamp, linePath, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DISH, DROP, FRAME, NEAR, TAU, SWIM, dish } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'gather'));
	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const dropX = $derived(Number(params.dropX ?? 1300));
	const dropY = $derived(Number(params.dropY ?? 440));
	const speed = $derived(offers('speed') ? Number(params.speed ?? SWIM.v) : SWIM.v);
	const tau = $derived(offers('tau') ? Number(params.tau ?? TAU) : TAU);
	const adapt = $derived(offers('adapt') ? params.adapt !== false : true);
	const releases = $derived(Number(params.release ?? 0));
	const ghostOn = $derived(focus === 'tune' || focus === 'off');

	const SPEED = 6;
	const MAXT = 900;
	const STILL = 300;

	// ---- geometry ---------------------------------------------------------------------------
	const S = 0.48;
	const CX0 = 48;
	const CY0 = 40;
	const CW = DISH.w * S;
	const CH = DISH.h * S;
	const px = (x: number) => CX0 + x * S;
	const py = (y: number) => CY0 + y * S;

	// ---- the drop, dragged ------------------------------------------------------------------
	let drag = $state<{ x: number; y: number } | null>(null);
	const snap = (v: number, stepSize: number, lo: number, hi: number) =>
		clamp(Math.round(v / stepSize) * stepSize, lo, hi);
	const shownDrop = $derived(drag ?? { x: dropX, y: dropY });

	// ---- the simulation, restarted on a new setting (memo: see the header comment) ------------
	/** Moving the drop keeps the swarm, except under reduced motion (a fresh settled frame). */
	const at = $derived(reduced ? `|${dropX}|${dropY}` : '');
	const key = $derived(`${speed}|${tau}|${adapt}|${releases}${at}`);
	type Dish = ReturnType<typeof dish>;
	let memo: { key: string; start: number; last: number; sim: Dish | null; drop: string } = {
		key: '',
		start: 0,
		last: 0,
		sim: null,
		drop: ''
	};
	let ghostMemo: { key: string; sim: Dish | null; drop: string } = {
		key: '',
		sim: null,
		drop: ''
	};
	const run = $derived.by(() => {
		const drop = `${dropX}|${dropY}`;
		if (memo.key !== key || t < memo.last || !memo.sim) {
			const fresh = memo.key === '' || t < memo.last;
			memo = {
				key,
				start: fresh ? 0 : t,
				last: t,
				sim: dish({ dropX, dropY, v: speed, tau, adapt }),
				drop
			};
		}
		const sim = memo.sim!;
		if (memo.drop !== drop) {
			sim.moveDrop(dropX, dropY);
			memo.drop = drop;
		}
		memo.last = t;
		const simT = reduced ? STILL : Math.min(MAXT, (t - memo.start) * SPEED);
		const k = sim.at(simT + FRAME);
		const u = clamp(simT / FRAME - (k - 1), 0, 1);
		let ghost: number[] | null = null;
		if (ghostOn) {
			const gk = `${releases}${at}`;
			if (ghostMemo.key !== gk || !ghostMemo.sim)
				ghostMemo = { key: gk, sim: dish({ dropX, dropY }), drop };
			if (ghostMemo.drop !== drop) {
				ghostMemo.sim!.moveDrop(dropX, dropY);
				ghostMemo.drop = drop;
			}
			ghostMemo.sim!.at(simT);
			ghost = ghostMemo.sim!.near;
		}
		return { sim, simT, k: k - 1, u, ghost };
	});

	// ---- cells and trails ---------------------------------------------------------------------
	const TRAIL = 8; // frames (2 s)
	const R = 2.6;
	const dot = (x: number, y: number) =>
		`M${(x - R).toFixed(1)} ${y.toFixed(1)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`;
	const drawn = $derived.by(() => {
		const { sim, k, u } = run;
		const a = { x: sim.xs[k], y: sim.ys[k] };
		const b = { x: sim.xs[k + 1], y: sim.ys[k + 1] };
		const st = sim.states[k + 1];
		let trails = '';
		let toward = '';
		let away = '';
		let tumbling = '';
		const from = Math.max(0, k - TRAIL + 1);
		for (let i = 0; i < sim.n; i++) {
			const x = px(a.x[i] + (b.x[i] - a.x[i]) * u);
			const y = py(a.y[i] + (b.y[i] - a.y[i]) * u);
			let d = '';
			for (let j = from; j <= k; j++)
				d += `${j === from ? 'M' : 'L'}${px(sim.xs[j][i]).toFixed(1)} ${py(sim.ys[j][i]).toFixed(1)}`;
			trails += `${d}L${x.toFixed(1)} ${y.toFixed(1)}`;
			const s = st[i];
			if (s === 1) tumbling += dot(x, y);
			else if (s === 2) toward += dot(x, y);
			else away += dot(x, y);
		}
		return { trails, toward, away, tumbling };
	});

	// ---- read-outs ----------------------------------------------------------------------------
	const nearNow = $derived(run.sim.near[run.k]);
	const moved = $derived(run.sim.movedAt >= 0 && run.sim.movedAt <= run.k);
	const nearStart = $derived(run.sim.near[moved ? run.sim.movedAt : 0]);
	const since = $derived(moved ? 'when the drop moved' : 'at release');
	const runs = $derived(run.sim.runs[run.k]);
	const upMean = $derived(runs.upCount ? runs.upTime / runs.upCount : 0);
	const downMean = $derived(runs.downCount ? runs.downTime / runs.downCount : 0);
	const clock = (s: number) =>
		`${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
	const pct = (v: number) => `${Math.round(v * 100)} %`;

	// ---- the chart ----------------------------------------------------------------------------
	const GX0 = 560;
	const GX1 = 900;
	const tMax = $derived(Math.max(6, Math.ceil(run.simT / 60)));
	const gx = $derived(scale([0, tMax], [GX0, GX1]));
	const gy = scale([0, 1], [562, 500]);
	const series = (near: number[], upto: number) => {
		const out: { m: number; v: number }[] = [];
		const last = Math.min(near.length - 1, upto);
		for (let j = 0; j <= last; j += 4) out.push({ m: (j * FRAME) / 60, v: near[j] });
		return out;
	};
	const curve = $derived(
		linePath(
			series(run.sim.near, run.k),
			(d) => d.m,
			(d) => d.v,
			gx,
			gy
		)
	);
	const ghostCurve = $derived(
		run.ghost
			? linePath(
					series(run.ghost, Math.round(run.simT / FRAME)),
					(d) => d.m,
					(d) => d.v,
					gx,
					gy
				)
			: ''
	);
	/** The drop's shading: a Gaussian of its width, drawn to three widths. */
	const STOPS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1].map((f) => ({
		f,
		o: 0.3 * Math.exp(-((3 * f) ** 2) / 2)
	}));
</script>

<g>
	<radialGradient
		id="bc-dish-drop"
		gradientUnits="userSpaceOnUse"
		cx={px(shownDrop.x)}
		cy={py(shownDrop.y)}
		r={3 * DROP.width * S}
	>
		{#each STOPS as s (s.f)}
			<stop offset={s.f} stop-color="var(--bc-attract)" stop-opacity={s.o} />
		{/each}
	</radialGradient>
	<clipPath id="bc-dish-clip">
		<rect x={CX0} y={CY0} width={CW} height={CH} rx="8" />
	</clipPath>

	<rect x={CX0} y={CY0} width={CW} height={CH} rx="8" fill="var(--bc-liquid)" />
	<g clip-path="url(#bc-dish-clip)">
		<rect x={CX0} y={CY0} width={CW} height={CH} fill="url(#bc-dish-drop)" />
		<circle
			cx={px(shownDrop.x)}
			cy={py(shownDrop.y)}
			r={NEAR * S}
			fill="none"
			stroke="var(--bc-attract)"
			stroke-dasharray="5 5"
			stroke-width="1.2"
			opacity="0.8"
		/>
		{#if !drag}
			<path
				d={drawn.trails}
				fill="none"
				stroke="var(--bc-cell)"
				stroke-width="1"
				opacity="0.3"
				stroke-linejoin="round"
			/>
			<path
				d={drawn.away}
				fill={focus === 'runs' ? 'var(--stage-ink-muted)' : 'var(--bc-cell)'}
				opacity={focus === 'runs' ? 0.6 : 0.9}
			/>
			<path
				d={drawn.toward}
				fill={focus === 'runs' ? 'var(--bc-toward)' : 'var(--bc-cell)'}
				opacity="0.9"
			/>
			<path
				d={drawn.tumbling}
				fill="none"
				stroke={focus === 'runs' ? 'var(--stage-ink)' : 'var(--bc-cell)'}
				stroke-width="1.3"
			/>
		{/if}
	</g>
	<rect
		x={CX0}
		y={CY0}
		width={CW}
		height={CH}
		rx="8"
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Handle
		x={px(shownDrop.x)}
		y={py(shownDrop.y)}
		label="Drop of attractant"
		value={dropX}
		min={200}
		max={1600}
		valuetext="{(dropX / 1000).toFixed(2)} mm from the left, {(dropY / 1000).toFixed(
			2
		)} mm from the top"
		color="var(--bc-attract)"
		onmove={(p: Point) =>
			(drag = {
				x: snap((p.x - CX0) / S, 50, 200, 1600),
				y: snap((p.y - CY0) / S, 10, 150, 730)
			})}
		ondragend={() => {
			if (drag) {
				setParam('dropX', drag.x);
				setParam('dropY', drag.y);
			}
			drag = null;
		}}
		onkey={(s) => {
			if (s === 'start') setParam('dropX', 200);
			else if (s === 'end') setParam('dropX', 1600);
			else setParam('dropX', snap(dropX + 50 * s, 50, 200, 1600));
		}}
	/>
	<Readout id="drop-label">
		<Label
			x={px(shownDrop.x)}
			y={py(shownDrop.y) - 18}
			text="drop: 1 mM MeAsp"
			size={12}
			weight={600}
			color="var(--bc-attract)"
		/>
	</Readout>

	<!-- read-outs -->
	<Readout
		id="time"
		order={1}
		label="Time since release"
		value="{clock(run.simT)} ({SPEED}× real time)"
	>
		<Label
			x={CX0}
			y={CY0 + CH + 30}
			text="{clock(run.simT)} after release · {SPEED}× real time"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="near"
		order={2}
		label="Near the drop (0.3 mm)"
		value="{pct(nearNow)} of the cells ({since} {pct(nearStart)})"
		color="var(--bc-attract)"
	>
		<Label
			x={CX0}
			y={CY0 + CH + 52}
			text="within 0.3 mm of the drop: {pct(nearNow)} of the cells ({since} {pct(nearStart)})"
			size={12}
			anchor="start"
			tabular
		/>
	</Readout>
	{#if focus === 'runs'}
		<Readout
			id="runs"
			order={3}
			label="Mean run, towards / away"
			value="{upMean.toFixed(2)} s / {downMean.toFixed(2)} s"
			color="var(--bc-toward)"
		>
			<Label
				x={CX0}
				y={CY0 + CH + 74}
				text="runs starting towards the drop: {upMean.toFixed(2)} s · away: {downMean.toFixed(2)} s"
				size={12}
				anchor="start"
				weight={600}
				color="var(--bc-toward)"
				tabular
			/>
		</Readout>
		<Readout id="runs-key">
			<Label
				x={CX0}
				y={CY0 + CH + 94}
				text="orange: swimming towards the drop · grey: away · rings: tumbling"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else if focus === 'tune'}
		<Readout id="tune" order={3} label="Cells" value="{speed} µm/s, adapting in {tau} s">
			<Label
				x={CX0}
				y={CY0 + CH + 74}
				text="cells swim at {speed} µm/s and adapt in {tau} s"
				size={12}
				anchor="start"
				tabular
			/>
		</Readout>
	{:else if focus === 'off'}
		<Readout
			id="off"
			order={3}
			label="Methylation"
			value={adapt ? 'on' : 'off: stuck at one level'}
		>
			<Label
				x={CX0}
				y={CY0 + CH + 74}
				text={adapt
					? 'methylation on: cells adapt'
					: 'methylation off: tumble rate set by position only'}
				size={12}
				anchor="start"
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- chart: share near the drop -->
	<Axes sx={gx} sy={gy} yTicks={[0, 0.5, 1]} yFormat={(v) => `${v * 100}%`} xLabel="minutes" />
	{#if ghostCurve}
		<path
			d={ghostCurve}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
		/>
	{/if}
	<path d={curve} fill="none" stroke="var(--bc-attract)" stroke-width="2" />
	<Readout id="chart-key">
		<Label
			x={GX0}
			y={492}
			text={ghostCurve
				? 'near the drop (dashed: the standard cell)'
				: 'share of cells near the drop'}
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
