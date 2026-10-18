<script lang="ts">
	/**
	 * A live 64 × 64 catalyst surface (left) beside a panel (right, `step.hints.panel`):
	 *   - `trace`: the run's CO₂ rate (averaged over 10 MCS) and its CO and O coverages over the
	 *     last MCS;
	 *   - `curves`: the measured steady-state rate and coverages against the CO fraction y for
	 *     the step's desorption k (solid), with the mean-field rate equations (dashed).
	 *
	 * Hints: `y`/`yParam`, `k`/`kParam`, `start` (`empty` or `co`), `restartParam`,
	 * `reducedUpdates`.
	 *
	 * The run is a `LiveRun` advanced to ⌊(t − t₀)·RATE⌋ MCS; it carries on from its current state
	 * when y or k changes (so the reader watches it respond, and a dead surface stays dead), and
	 * starts again when the step or the restart count changes, or t goes back. The run object,
	 * its start time and the last t are plain variables inside a `$derived` (as in the Ising
	 * lattice). Reduced motion: a fresh run per setting, shown after the step's `reducedUpdates`
	 * MCS, enough for its point (a dead surface on the dead-end steps, a recovered one on the last).
	 */
	import { Axes, Label, linePath, scale, type Scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CO, O, Y1, Y2 } from '../zgb';
	import { LiveRun, RATE, speciesPath } from '../live';
	import { K_VALUES, at, curve, type Quantity } from '../curves';
	import { fmt, fmtK, numberFrom } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const panel = $derived(String(step.hints?.panel ?? 'trace'));
	const y = $derived(numberFrom(step, params, 'y', 0.5));
	const k = $derived.by(() => {
		const v = numberFrom(step, params, 'k', 0);
		return (K_VALUES as readonly number[]).includes(v) ? v : 0;
	});
	const start = $derived<'empty' | 'co'>(step.hints?.start === 'co' ? 'co' : 'empty');
	const restarts = $derived(
		step.hints?.restartParam ? Number(params[String(step.hints.restartParam)] ?? 0) : 0
	);
	const reducedUpdates = $derived(Number(step.hints?.reducedUpdates ?? 200));

	// ---- the run -----------------------------------------------------------------------------
	const L = 64;
	let run: LiveRun | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, LiveRun>();

	const make = (restartCount: number) => new LiveRun(L, 1 + 7919 * restartCount, start);

	const current = $derived.by((): { run: LiveRun; n: number } => {
		const time = t;
		const key = `${step.id}|${restarts}`;
		if (reduced) {
			const rk = `${key}|${y}|${k}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = make(restarts);
				r.advance(reducedUpdates, y, k, Infinity);
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(rk, r);
			}
			return { run: r, n: r.done };
		}
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = make(restarts);
			runKey = key;
			t0 = time;
		}
		lastT = time;
		run.advance(Math.floor((time - t0) * RATE), y, k);
		return { run, n: run.done };
	});

	// ---- the surface ---------------------------------------------------------------------------
	const LX = 32;
	const LY = 92;
	const LS = 448;
	const cell = LS / L;
	const paths = $derived.by(() => {
		void current.n;
		const s = current.run.s;
		return { co: speciesPath(s, CO, LX, LY, cell), o: speciesPath(s, O, LX, LY, cell) };
	});
	const cov = $derived.by(() => {
		void current.n;
		return current.run.s.coverage();
	});
	const rateNow = $derived(current.n > 0 ? current.run.smoothRate(current.n - 1) : 0);
	const perSite = $derived.by(() => {
		void current.n;
		return current.run.perSite();
	});
	/** A dead surface: full of O, or full of CO with no desorption to free a site. */
	const status = $derived(
		cov.o === 1
			? 'Dead: oxygen on every site'
			: cov.co === 1 && k === 0
				? 'Dead: CO on every site'
				: ''
	);

	// ---- panels --------------------------------------------------------------------------------
	const PX0 = 600;
	const PX1 = 916;
	const TOP: [number, number] = [262, 112];
	const BOTTOM: [number, number] = [520, 370];
	const R_MAX = 0.3;
	const syRate = scale([0, R_MAX], TOP);
	const syCov = scale([0, 1], BOTTOM);

	// trace
	const WINDOW = 400;
	const traceStart = $derived(Math.max(0, current.n - WINDOW));
	const sxTrace = $derived(scale([traceStart, traceStart + WINDOW], [PX0, PX1]));
	function trace(q: 'rate' | 'co' | 'o', sy: Scale) {
		const r = current.run;
		const pts: [number, number][] = [];
		for (let i = traceStart; i < current.n; i++)
			pts.push([i + 1, q === 'rate' ? Math.min(R_MAX, r.smoothRate(i)) : r[q][i]]);
		return linePath(
			pts,
			(p) => p[0],
			(p) => p[1],
			sxTrace,
			sy
		);
	}
	const traces = $derived.by(() => {
		void current.n;
		return { rate: trace('rate', syRate), co: trace('co', syCov), o: trace('o', syCov) };
	});

	// curves
	const YX: [number, number] = [0.2, 0.8];
	const sxY = scale(YX, [PX0, PX1]);
	const c = $derived(curve(k));
	function curvePath(q: Quantity, sy: (v: number) => number, cap = Infinity) {
		let d = '';
		for (let i = 0; i < c.y.length; i++) {
			const yy = c.y[i];
			if (yy < YX[0] || yy > YX[1]) continue;
			d += `${d === '' ? 'M' : 'L'}${sxY(yy).toFixed(1)} ${sy(Math.min(cap, c[q][i])).toFixed(1)}`;
		}
		return d;
	}
	const markX = $derived(sxY(Math.min(YX[1], Math.max(YX[0], y))));
	const measured = $derived({
		rate: at(c, 'rate', y),
		co: at(c, 'co', y),
		o: at(c, 'o', y),
		mf: at(c, 'mfRate', y)
	});
	const LEGEND_Y = 568;
</script>

<g>
	<!-- ---------------------------------------------------------------- the surface -->
	<Readout id="surface" order={1} label="64 × 64 sites" value="y = {y.toFixed(3)} · k = {fmtK(k)}">
		<Label
			anchor="start"
			x={LX}
			y={LY - 34}
			text="64 × 64 sites · CO fraction y = {y.toFixed(3)} · desorption k = {fmtK(k)}"
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={LX}
			y={LY - 14}
			text="MCS {current.n.toLocaleString('en-US')} · CO₂ made per site so far: {perSite.toFixed(
				1
			)}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<rect
		x={LX}
		y={LY}
		width={LS}
		height={LS}
		fill="var(--sc-empty)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={paths.o} fill="var(--sc-o)" />
	<path d={paths.co} fill="var(--sc-co)" />
	{#if status}
		<Readout id="status" order={2} label="Surface" value={status}>
			<Label x={LX + LS / 2} y={LY + LS / 2 + 5} text={status} size={15} weight={600} pill />
		</Readout>
	{/if}
	<Readout id="key" label="O red, CO grey, empty pale">
		{#each [{ fill: 'var(--sc-o)', text: 'O' }, { fill: 'var(--sc-co)', text: 'CO' }, { fill: 'var(--sc-empty)', text: 'empty' }] as item, i (item.text)}
			<rect
				x={LX + i * 74}
				y={LEGEND_Y - 11}
				width="14"
				height="14"
				rx="3"
				fill={item.fill}
				stroke="var(--stage-line)"
				stroke-width="0.8"
			/>
			<Label
				anchor="start"
				x={LX + i * 74 + 20}
				y={LEGEND_Y}
				text={item.text}
				size={12}
				halo={false}
			/>
		{/each}
		<Label
			x={LX + LS}
			y={LEGEND_Y}
			text="θ_CO = {fmt(cov.co, 2)} · θ_O = {fmt(cov.o, 2)}"
			size={12}
			anchor="end"
			tabular
			halo={false}
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- panel: trace -->
	{#if panel === 'trace'}
		<Readout id="rate" order={3} label="CO₂ rate (per site per MCS)" value={fmt(rateNow)}>
			<Label
				anchor="start"
				x={PX0}
				y={80}
				text="CO₂ made per site per MCS"
				size={13}
				weight={600}
			/>
			<Label
				x={PX1}
				y={80}
				text={fmt(rateNow)}
				size={14}
				anchor="end"
				tabular
				weight={600}
				color="var(--sc-rate)"
			/>
		</Readout>
		<Axes sx={sxTrace} sy={syRate} yTicks={[0, 0.1, 0.2, 0.3]} xTicks={[]} />
		<path d={traces.rate} fill="none" stroke="var(--sc-rate)" stroke-width="2" />

		<Readout id="cov" order={4} label="Coverage" value="O {fmt(cov.o, 2)} · CO {fmt(cov.co, 2)}">
			<Label
				anchor="start"
				x={PX0}
				y={338}
				text="fraction of sites covered"
				size={13}
				weight={600}
			/>
			<Label
				x={PX1 - 70}
				y={338}
				text="O {fmt(cov.o, 2)}"
				size={13}
				anchor="end"
				tabular
				weight={600}
				color="var(--sc-o-text)"
			/>
			<Label
				x={PX1}
				y={338}
				text="CO {fmt(cov.co, 2)}"
				size={13}
				anchor="end"
				tabular
				weight={600}
				color="var(--sc-co-text)"
			/>
		</Readout>
		<Axes sx={sxTrace} sy={syCov} yTicks={[0, 0.5, 1]} xLabel="MCS" />
		<path d={traces.o} fill="none" stroke="var(--sc-o)" stroke-width="1.8" />
		<path d={traces.co} fill="none" stroke="var(--sc-co)" stroke-width="1.8" />
	{/if}

	<!-- ---------------------------------------------------------------- panel: curves -->
	{#if panel === 'curves'}
		<Label
			anchor="start"
			x={PX0}
			y={80}
			text="steady CO₂ rate (per site per MCS)"
			size={13}
			weight={600}
		/>
		<Axes sx={sxY} sy={syRate} yTicks={[0, 0.1, 0.2, 0.3]} xTicks={[]} />
		{#if k === 0}
			<!-- the dead ends of the lattice without desorption -->
			<rect
				x={PX0}
				y={TOP[1]}
				width={sxY(Y1) - PX0}
				height={TOP[0] - TOP[1]}
				fill="var(--sc-o)"
				opacity="0.1"
			/>
			<rect
				x={sxY(Y2)}
				y={TOP[1]}
				width={PX1 - sxY(Y2)}
				height={TOP[0] - TOP[1]}
				fill="var(--sc-co)"
				opacity="0.12"
			/>
			<Readout id="dead" label="Shaded: the lattice's dead ends (all O left, all CO right)">
				<Label x={(PX0 + sxY(Y1)) / 2} y={TOP[1] + 18} text="O dead" size={11} muted />
				<Label x={(sxY(Y2) + PX1) / 2} y={TOP[1] + 18} text="CO dead" size={11} muted />
			</Readout>
		{/if}
		<path
			d={curvePath('mfRate', syRate, R_MAX)}
			fill="none"
			stroke="var(--sc-rate)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
		/>
		<path d={curvePath('rate', syRate)} fill="none" stroke="var(--sc-rate)" stroke-width="2.4" />

		<Label anchor="start" x={PX0} y={338} text="steady coverage" size={13} weight={600} />
		<Axes sx={sxY} sy={syCov} yTicks={[0, 0.5, 1]} xLabel="CO fraction y" />
		<path
			d={curvePath('mfO', syCov)}
			fill="none"
			stroke="var(--sc-o)"
			stroke-width="1.4"
			stroke-dasharray="6 4"
		/>
		<path
			d={curvePath('mfCo', syCov)}
			fill="none"
			stroke="var(--sc-co)"
			stroke-width="1.4"
			stroke-dasharray="6 4"
		/>
		<path d={curvePath('o', syCov)} fill="none" stroke="var(--sc-o)" stroke-width="2.2" />
		<path d={curvePath('co', syCov)} fill="none" stroke="var(--sc-co)" stroke-width="2.2" />

		{#each [TOP, BOTTOM] as r, j (j)}
			<line
				x1={markX}
				x2={markX}
				y1={r[1]}
				y2={r[0]}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
		{/each}
		<circle
			cx={markX}
			cy={syRate(measured.rate)}
			r="5"
			fill="var(--sc-rate)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={markX}
			cy={syRate(Math.min(R_MAX, measured.mf))}
			r="4"
			fill="var(--stage-bg)"
			stroke="var(--sc-rate)"
			stroke-width="1.8"
		/>
		<Readout
			id="steady"
			order={3}
			label="Steady rate: lattice · mean field"
			value="{fmt(measured.rate)} · {fmt(measured.mf)}"
			color="var(--sc-rate)"
		>
			<Label
				x={PX1}
				y={98}
				text="lattice {fmt(measured.rate)} · mean field {fmt(measured.mf)}"
				size={12}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
		<Readout
			id="steadycov"
			order={4}
			label="Steady coverage (lattice)"
			value="O {fmt(measured.o, 2)} · CO {fmt(measured.co, 2)}"
		>
			<Label
				x={PX1}
				y={356}
				text="O {fmt(measured.o, 2)} · CO {fmt(measured.co, 2)}"
				size={12}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
		<Readout id="legend" label="Solid: the 64 × 64 lattice; dashed: mean field">
			<line
				x1={PX0 + 60}
				x2={PX0 + 84}
				y1={LEGEND_Y - 4}
				y2={LEGEND_Y - 4}
				stroke="var(--stage-ink)"
				stroke-width="2.4"
			/>
			<Label anchor="start" x={PX0 + 90} y={LEGEND_Y} text="lattice" size={12} halo={false} />
			<line
				x1={PX0 + 160}
				x2={PX0 + 184}
				y1={LEGEND_Y - 4}
				y2={LEGEND_Y - 4}
				stroke="var(--stage-ink)"
				stroke-width="1.6"
				stroke-dasharray="6 4"
			/>
			<Label anchor="start" x={PX0 + 190} y={LEGEND_Y} text="mean field" size={12} halo={false} />
		</Readout>
	{/if}
</g>
