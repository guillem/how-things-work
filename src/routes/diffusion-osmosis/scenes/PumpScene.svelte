<script lang="ts">
	/**
	 * A patch of membrane with a leak channel and a pump (../model.ts `pumpBox`: 120 Brownian
	 * particles; one that wanders into the pump from outside is carried in for one ATP). Outside
	 * on the left, inside the cell on the right. The ATP store is a meter; under the box, the
	 * particles on each side against time.
	 *
	 * Focus (`step.hints.focus`): 'pump' (control `pump`: switch the pump; the store is not
	 * refilled, so it drains and the gradient leaks away) or 'upkeep' (control `respire`:
	 * respiration refills the store at REFILL ATP per second). Both offer "Start again".
	 *
	 * The walk is computed lazily as the clock advances and restarts on "Start again"; the pump
	 * and respiration switches act from the moment they change (memo inside a `$derived`, the
	 * guide's sanctioned exception). Reduced motion: the frame STILL seconds in.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PUMP_BOX, Walkers, gradientWork, pumpBox } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'pump'));
	const upkeep = $derived(focus === 'upkeep');
	const pumpOn = $derived(upkeep ? true : params.pump !== false);
	const respire = $derived(upkeep ? params.respire !== false : false);
	const restarts = $derived(Number(params.restart ?? 0));

	const REFILL = 6;
	const STILL = $derived(upkeep ? 60 : 30);

	// ---- geometry ------------------------------------------------------------------------------
	const S = 4.8;
	const BX = 40;
	const BY = 60;
	const BW = PUMP_BOX.w * S;
	const BH = PUMP_BOX.h * S;
	const MX = BX + BW / 2;
	const px = (x: number) => BX + x * S;
	const py = (y: number) => BY + y * S;

	// ---- the walk (memo: see the header comment) -----------------------------------------------
	const key = $derived(
		`${restarts}|${focus}${reduced ? `|${String(pumpOn)}|${String(respire)}` : ''}`
	);
	let memo: { key: string; start: number; last: number; sim: Walkers | null } = {
		key: '',
		start: 0,
		last: 0,
		sim: null
	};
	const run = $derived.by(() => {
		if (memo.key !== key || t < memo.last || !memo.sim) {
			const fresh = memo.key === '' || t < memo.last;
			memo = { key, start: fresh ? 0 : t, last: t, sim: pumpBox(3 + restarts) };
		}
		memo.last = t;
		const sim = memo.sim!;
		sim.pumpOn = pumpOn;
		sim.refill = respire ? REFILL : 0;
		const simT = reduced ? STILL : Math.max(0, t - memo.start);
		const f = simT * sim.fps;
		const k = sim.at(Math.floor(f) + 1) - 1;
		return { sim, simT, k, u: clamp(f - k, 0, 1) };
	});

	// ---- particles -----------------------------------------------------------------------------
	const R = 3.4;
	const dot = (x: number, y: number) =>
		`M${(x - R).toFixed(1)} ${y.toFixed(1)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0`;
	const particles = $derived.by(() => {
		const { sim, k, u } = run;
		let d = '';
		const a = sim.xs[k];
		const b = sim.xs[k + 1];
		const c = sim.ys[k];
		const e = sim.ys[k + 1];
		for (let i = 0; i < sim.n; i++) {
			// a particle that crossed the membrane in this frame is drawn at its new place
			const crossed = a[i] < PUMP_BOX.w / 2 !== b[i] < PUMP_BOX.w / 2;
			const x = crossed ? (u < 0.5 ? a[i] : b[i]) : a[i] + (b[i] - a[i]) * u;
			d += dot(px(x), py(c[i] + (e[i] - c[i]) * u));
		}
		return d;
	});

	// ---- read-outs -------------------------------------------------------------------------------
	const kk = $derived(run.k + (run.u > 0.5 ? 1 : 0));
	const inside = $derived(run.sim.right[kk]);
	const outsideN = $derived(run.sim.n - inside);
	const atp = $derived(Math.floor(run.sim.atp[kk]));
	const pumped = $derived(run.sim.pumped[kk]);
	/** A pump stroke in the last half second lights the pump up. */
	const working = $derived(run.sim.pumped[kk] > run.sim.pumped[Math.max(0, kk - 5)]);
	const ratio = $derived(inside / Math.max(1, outsideN));
	const work = $derived(ratio > 1.05 ? gradientWork(1, ratio) / 1000 : 0);

	// ---- chart of the two counts --------------------------------------------------------------
	const GX0 = 70;
	const GX1 = 520;
	const tMax = $derived(Math.max(60, Math.ceil(run.simT / 30) * 30));
	const gx = $derived(scale([0, tMax], [GX0, GX1]));
	const gy = scale([0, PUMP_BOX.n], [560, 420]);
	const series = (arr: number[], upto: number, flip: boolean) => {
		const out: { s: number; v: number }[] = [];
		for (let j = 0; j <= upto; j += 5)
			out.push({ s: j / run.sim.fps, v: flip ? run.sim.n - arr[j] : arr[j] });
		out.push({ s: upto / run.sim.fps, v: flip ? run.sim.n - arr[upto] : arr[upto] });
		return out;
	};
	const inCurve = $derived(
		linePath(
			series(run.sim.right, kk, false),
			(d) => d.s,
			(d) => d.v,
			gx,
			gy
		)
	);
	const outCurve = $derived(
		linePath(
			series(run.sim.right, kk, true),
			(d) => d.s,
			(d) => d.v,
			gx,
			gy
		)
	);

	// ---- the ATP meter -----------------------------------------------------------------------------
	const MX0 = 610;
	const MW = 300;
	const atpW = $derived((atp / PUMP_BOX.atp) * MW);
</script>

<g>
	<!-- outside and inside -->
	<rect x={BX} y={BY} width={BW / 2} height={BH} rx="6" fill="var(--do-water)" />
	<rect x={MX} y={BY} width={BW / 2} height={BH} rx="6" fill="var(--do-cyto)" />
	<Readout id="sides">
		<Label x={BX + 8} y={BY - 12} text="outside the cell" size={13} anchor="start" weight={600} />
		<Label x={BX + BW - 8} y={BY - 12} text="inside the cell" size={13} anchor="end" weight={600} />
	</Readout>

	<!-- membrane, leak channel and pump -->
	<line
		x1={MX}
		x2={MX}
		y1={BY}
		y2={py(PUMP_BOX.pore[0])}
		stroke="var(--do-membrane)"
		stroke-width="6"
	/>
	<line
		x1={MX}
		x2={MX}
		y1={py(PUMP_BOX.pore[1])}
		y2={py(PUMP_BOX.pump[0])}
		stroke="var(--do-membrane)"
		stroke-width="6"
	/>
	<line
		x1={MX}
		x2={MX}
		y1={py(PUMP_BOX.pump[1])}
		y2={BY + BH}
		stroke="var(--do-membrane)"
		stroke-width="6"
	/>
	<!-- the leak channel: two small walls either side of the gap -->
	<rect
		x={MX - 9}
		y={py(PUMP_BOX.pore[0]) - 8}
		width="18"
		height="8"
		rx="3"
		fill="var(--protein)"
	/>
	<rect x={MX - 9} y={py(PUMP_BOX.pore[1])} width="18" height="8" rx="3" fill="var(--protein)" />
	<!-- the pump -->
	<rect
		x={MX - 16}
		y={py(PUMP_BOX.pump[0])}
		width="32"
		height={(PUMP_BOX.pump[1] - PUMP_BOX.pump[0]) * S}
		rx="12"
		fill={pumpOn && atp > 0 ? 'var(--do-pump)' : 'var(--protein)'}
		stroke={working ? 'var(--do-atp)' : 'var(--protein-edge)'}
		stroke-width={working ? 4 : 1.5}
	/>
	<clipPath id="do-pump-clip">
		<rect x={BX} y={BY} width={BW} height={BH} rx="6" />
	</clipPath>
	<path d={particles} fill="var(--do-particle)" opacity="0.9" clip-path="url(#do-pump-clip)" />
	<Readout id="pump-label">
		<Label
			x={MX + 24}
			y={py((PUMP_BOX.pump[0] + PUMP_BOX.pump[1]) / 2) + 4}
			text={pumpOn ? (atp > 0 ? 'pump' : 'pump: no ATP') : 'pump off'}
			size={12}
			anchor="start"
			weight={600}
			pill
		/>
		{#if working}
			<Label
				x={MX - 24}
				y={py((PUMP_BOX.pump[0] + PUMP_BOX.pump[1]) / 2) + 4}
				text="ATP → ADP"
				size={11}
				anchor="end"
				color="var(--do-atp-text)"
				weight={600}
				pill
			/>
		{/if}
		<Label
			x={MX + 16}
			y={py(PUMP_BOX.pore[0]) - 12}
			text="leak channel"
			size={11}
			anchor="start"
			pill
		/>
	</Readout>
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

	<!-- chart -->
	<Axes sx={gx} sy={gy} yTicks={[0, 60, 120]} xLabel="s" />
	<path d={outCurve} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" />
	<path d={inCurve} fill="none" stroke="var(--do-particle)" stroke-width="2.2" />
	<Readout id="chart-key">
		<Label
			x={GX0}
			y={406}
			text="particles inside (pink) and outside (grey)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- right-hand panel -->
	<Readout id="time" order={1} label="Time" value="{run.simT.toFixed(0)} s">
		<Label x={MX0} y={70} text="{run.simT.toFixed(0)} s" size={14} anchor="start" muted tabular />
	</Readout>
	<Readout id="atp" order={2} label="ATP in the store" value={String(atp)} color="var(--do-atp)">
		<Label
			x={MX0}
			y={108}
			text="ATP in the store: {atp}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<rect x={MX0} y={118} width={MW} height="22" rx="5" fill="var(--stage-grid)" />
	<rect x={MX0} y={118} width={atpW} height="22" rx="5" fill="var(--do-atp)" />
	{#if upkeep}
		<Readout
			id="refill"
			order={3}
			label="Respiration"
			value={respire ? `making ${REFILL} ATP/s` : 'off'}
		>
			<Label
				x={MX0}
				y={162}
				text={respire ? `respiration making ${REFILL} ATP per second` : 'respiration off'}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
	<Readout id="pumped" order={4} label="Particles pumped in" value={String(pumped)}>
		<Label
			x={MX0}
			y={200}
			text="pumped in so far: {pumped} (one ATP each)"
			size={13}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="counts"
		order={5}
		label="Inside / outside"
		value="{inside} / {outsideN}"
		color="var(--do-particle)"
	>
		<Label
			x={MX0}
			y={240}
			text="inside {inside} · outside {outsideN}"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="ratio" order={6}>
		<Label
			x={MX0}
			y={264}
			text={ratio > 1.05
				? `inside is ${ratio.toFixed(1)} times as crowded`
				: 'about as crowded on both sides'}
			size={12}
			anchor="start"
			tabular
		/>
		{#if upkeep && work > 0}
			<Label
				x={MX0}
				y={292}
				text="least work per particle: {work.toFixed(1)} kJ/mol"
				size={12}
				anchor="start"
				tabular
			/>
			<Label x={MX0} y={312} text="one ATP gives about 50 kJ/mol" size={11} anchor="start" muted />
		{/if}
	</Readout>
</g>
