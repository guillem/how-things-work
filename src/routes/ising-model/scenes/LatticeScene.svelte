<script lang="ts">
	/**
	 * A live square lattice (left) beside a panel (right, `step.hints.panel`):
	 *   - `trace`: the run's magnetisation m and energy per spin over the last updates;
	 *   - `magnetisation`: the measured ⟨|m|⟩ against temperature for the four lattice sizes,
	 *     with Onsager's exact curve and T_c;
	 *   - `peaks`: the measured susceptibility (log scale) and heat capacity against temperature,
	 *     with Onsager's exact heat capacity and T_c.
	 *
	 * Hints: `t`/`tParam` (temperature), `size`/`sizeParam`, `algo`/`algoParam`, `restartParam`
	 * (an action that starts a new random lattice), `fresh` (start from random spins instead of
	 * a lattice settled at the temperature).
	 *
	 * The run is a `LiveRun` advanced to ⌊(t − t₀)·RATE⌋ updates; it carries on from its current
	 * state when the temperature or the algorithm changes (so the reader watches it respond), and
	 * starts again when the step, the size or the restart count changes, or t goes back. The run
	 * object, its start time and the last t are plain variables inside a `$derived` (as in the
	 * states-of-matter box). Reduced motion: a fresh run per setting, shown after the updates of
	 * t = 2.5 s.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TC, onsagerHeatCapacity, onsagerM } from '../ising';
	import { LiveRun, RATE, upPath, type Algorithm } from '../live';
	import { SQUARE_SIZES, at, curve, type Quantity } from '../curves';
	import { num, numberFrom, signed, sizeColour, stringFrom } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const panel = $derived(String(step.hints?.panel ?? 'trace'));
	const T = $derived(numberFrom(step, params, 't', 2));
	const L = $derived.by(() => {
		const v = Number(stringFrom(step, params, 'size', '64'));
		return (SQUARE_SIZES as readonly number[]).includes(v) ? v : 64;
	});
	const algo = $derived<Algorithm>(
		stringFrom(step, params, 'algo', 'metropolis') === 'wolff' ? 'wolff' : 'metropolis'
	);
	const fresh = $derived(step.hints?.fresh === true);
	const restarts = $derived(
		step.hints?.restartParam ? Number(params[String(step.hints.restartParam)] ?? 0) : 0
	);

	// ---- the run -----------------------------------------------------------------------------
	const REDUCED_UPDATES = Math.round(2.5 * RATE);
	let run: LiveRun | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, LiveRun>();

	function make(Lx: number, temp: number, restartCount: number, start: boolean) {
		const r = new LiveRun(Lx, Lx, 1 + Lx + 7919 * restartCount);
		if (!start) r.settle(temp, Lx >= 64 ? 150 : 300);
		return r;
	}

	const current = $derived.by((): { run: LiveRun; k: number } => {
		const time = t;
		const key = `${step.id}|${L}|${restarts}`;
		if (reduced) {
			const rk = `${key}|${T}|${algo}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = make(L, T, restarts, fresh);
				r.advance(REDUCED_UPDATES, T, algo, Infinity);
				if (reducedRuns.size > 8) reducedRuns.clear();
				reducedRuns.set(rk, r);
			}
			return { run: r, k: r.done };
		}
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = make(L, T, restarts, fresh);
			runKey = key;
			t0 = time;
		}
		lastT = time;
		run.advance(Math.floor((time - t0) * RATE), T, algo);
		return { run, k: run.done };
	});

	// ---- the lattice ---------------------------------------------------------------------------
	const LX = 32;
	const LY = 84;
	const LS = 448;
	const cell = $derived(LS / L);
	const ups = $derived.by(() => {
		void current.k;
		return upPath(current.run.lat, LX, LY, cell);
	});
	const mNow = $derived.by(() => {
		void current.k;
		return current.run.lat.magnetisation();
	});
	const eNow = $derived.by(() => {
		void current.k;
		return current.run.lat.energy();
	});
	const algoName = $derived(algo === 'wolff' ? 'Wolff clusters' : 'Metropolis');
	/**
	 * With Wolff clusters below T_c one cluster is most of the lattice, and the picture would
	 * flash between colours at every update: the drawing (only) swaps the colours while m < 0,
	 * so the majority is always orange. The traces keep the signed m.
	 */
	const swapped = $derived(algo === 'wolff' && mNow < 0);

	// ---- panels --------------------------------------------------------------------------------
	const PX0 = 600;
	const PX1 = 916;
	const TX: [number, number] = [1, 3.6];

	// trace
	const WINDOW = 600;
	const traceStart = $derived(Math.max(0, current.k - WINDOW));
	const sxTrace = $derived(scale([traceStart, traceStart + WINDOW], [PX0, PX1]));
	/** The trace shows |m| on steps with the hint `abs` (where Wolff flips the sign each update). */
	const abs = $derived(step.hints?.abs === true);
	const syM = $derived(scale(abs ? [0, 1] : [-1, 1], [262, 96]));
	const syE = scale([-2, 0], [520, 354]);
	const traceM = $derived.by(() => {
		const k = current.k;
		const m = current.run.m;
		const pts: [number, number][] = [];
		for (let i = traceStart; i < k; i++) pts.push([i + 1, abs ? Math.abs(m[i]) : m[i]]);
		return linePath(
			pts,
			(p) => p[0],
			(p) => p[1],
			sxTrace,
			syM
		);
	});
	const traceE = $derived.by(() => {
		const k = current.k;
		const e = current.run.e;
		const pts: [number, number][] = [];
		for (let i = traceStart; i < k; i++) pts.push([i + 1, e[i]]);
		return linePath(
			pts,
			(p) => p[0],
			(p) => p[1],
			sxTrace,
			syE
		);
	});

	// magnetisation and peaks
	const sxT = scale(TX, [PX0, PX1]);
	const syAbsM = scale([0, 1], [500, 96]);
	const LOG_LO = -2;
	const LOG_HI = 2;
	const syChi = scale([LOG_LO, LOG_HI], [266, 96]);
	const syC = scale([0, 2.5], [520, 354]);
	const sizeIndex = $derived((SQUARE_SIZES as readonly number[]).indexOf(L));

	function curvePath(size: number, q: Quantity, sy: (v: number) => number) {
		const c = curve(2, size);
		let d = '';
		for (let i = 0; i < c.T.length; i++) {
			let v = c[q][i];
			// χ below the log axis's floor is left out (deep in the ordered phase it is tiny)
			if (q === 'chi') {
				if (v < 10 ** LOG_LO) continue;
				v = Math.log10(v);
			}
			if (q === 'c') v = Math.min(v, 2.5);
			d += `${d === '' ? 'M' : 'L'}${sxT(c.T[i]).toFixed(1)} ${sy(v).toFixed(1)}`;
		}
		return d;
	}
	const onsagerMPath = (() => {
		let d = `M${sxT(TX[0]).toFixed(1)} ${syAbsM(onsagerM(TX[0])).toFixed(1)}`;
		for (let i = 1; i <= 260; i++) {
			const temp = TX[0] + ((TC - TX[0]) * i) / 260;
			d += `L${sxT(temp).toFixed(1)} ${syAbsM(onsagerM(temp)).toFixed(1)}`;
		}
		return d + `L${sxT(TX[1]).toFixed(1)} ${syAbsM(0).toFixed(1)}`;
	})();
	/** Onsager's c(T), clipped at the top of the plot: two branches, below and above T_c. */
	const onsagerCPath = (() => {
		const branch = (a: number, b: number) => {
			let d = '';
			const n = 200;
			for (let i = 0; i <= n; i++) {
				const temp = a + ((b - a) * i) / n;
				const v = Math.min(2.5, onsagerHeatCapacity(temp));
				d += `${i === 0 ? 'M' : 'L'}${sxT(temp).toFixed(1)} ${syC(v).toFixed(1)}`;
			}
			return d;
		};
		return branch(TX[0], TC - 1e-6) + branch(TC + 1e-6, TX[1]);
	})();

	const measured = $derived({
		m: at(curve(2, L), 'm', T),
		chi: at(curve(2, L), 'chi', T),
		c: at(curve(2, L), 'c', T)
	});
	const tcX = sxT(TC);
	const fmtChi = (v: number) =>
		v >= 10 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v.toPrecision(2);
	const markX = $derived(sxT(Math.min(TX[1], Math.max(TX[0], T))));
	const sizes = SQUARE_SIZES;
	const LEGEND_Y = 562;
</script>

<g>
	<!-- ---------------------------------------------------------------- the lattice -->
	<Readout
		id="lattice"
		order={1}
		label="{L} × {L} spins"
		value="kT = {T.toFixed(2)} J · {algoName}"
	>
		<Label
			anchor="start"
			x={LX}
			y={LY - 30}
			text="{L} × {L} spins · kT = {T.toFixed(2)} J"
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={LX}
			y={LY - 12}
			text="{algoName}{algo === 'wolff'
				? ' (majority drawn orange)'
				: ''} · update {current.k.toLocaleString('en-US')}"
			size={12}
			muted
		/>
	</Readout>
	<rect
		x={LX}
		y={LY}
		width={LS}
		height={LS}
		fill={swapped ? 'var(--im-up)' : 'var(--im-down)'}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={ups} fill={swapped ? 'var(--im-down)' : 'var(--im-up)'} />
	<Readout
		id="key"
		order={2}
		label={algo === 'wolff' ? 'majority orange, minority blue' : 'up (+1) orange, down (−1) blue'}
	>
		<rect x={LX} y={LY + LS + 16} width="14" height="14" rx="3" fill="var(--im-up)" />
		<Label
			anchor="start"
			x={LX + 20}
			y={LY + LS + 27}
			text={algo === 'wolff' ? 'the majority' : 'up, s = +1'}
			size={12}
			halo={false}
		/>
		<rect x={LX + 112} y={LY + LS + 16} width="14" height="14" rx="3" fill="var(--im-down)" />
		<Label
			anchor="start"
			x={LX + 132}
			y={LY + LS + 27}
			text={algo === 'wolff' ? 'the minority' : 'down, s = −1'}
			size={12}
			halo={false}
		/>
		<Label
			x={LX + LS}
			y={LY + LS + 27}
			text="m = {signed(mNow)}"
			size={13}
			anchor="end"
			tabular
			halo={false}
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- panel: trace -->
	{#if panel === 'trace'}
		<Readout
			id="m"
			order={3}
			label={abs ? '|m|' : 'Magnetisation m'}
			value={abs ? Math.abs(mNow).toFixed(2) : signed(mNow)}
		>
			<Label
				anchor="start"
				x={PX0}
				y={80}
				text={abs ? 'size of the magnetisation, |m|' : 'magnetisation m'}
				size={13}
				weight={600}
			/>
			<Label
				x={PX1}
				y={80}
				text={abs ? Math.abs(mNow).toFixed(2) : signed(mNow)}
				size={14}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
		<Axes
			sx={sxTrace}
			sy={syM}
			yTicks={abs ? [0, 0.5, 1] : [-1, 0, 1]}
			xTicks={[]}
			yFormat={(v: number) => num(v, v % 1 ? 1 : 0)}
		/>
		<line x1={PX0} x2={PX1} y1={syM(0)} y2={syM(0)} stroke="var(--stage-line)" stroke-width="1" />
		<path d={traceM} fill="none" stroke="var(--im-trace)" stroke-width="1.6" />

		<Readout id="e" order={4} label="Energy per spin" value="{num(eNow)} J">
			<Label
				anchor="start"
				x={PX0}
				y={338}
				text="energy per spin, E/N (J)"
				size={13}
				weight={600}
			/>
			<Label x={PX1} y={338} text={num(eNow)} size={14} anchor="end" tabular weight={600} />
		</Readout>
		<Axes
			sx={sxTrace}
			sy={syE}
			yTicks={[-2, -1, 0]}
			xLabel="updates"
			yFormat={(v: number) => num(v, 0)}
		/>
		<path d={traceE} fill="none" stroke="var(--im-energy)" stroke-width="1.6" />
	{/if}

	<!-- ---------------------------------------------------------------- panel: ⟨|m|⟩(T) -->
	{#if panel === 'magnetisation'}
		<Label
			anchor="start"
			x={PX0}
			y={72}
			text="average |m| against temperature"
			size={13}
			weight={600}
		/>
		<Axes sx={sxT} sy={syAbsM} xLabel="kT / J" yTicks={[0, 0.25, 0.5, 0.75, 1]} />
		<line
			x1={tcX}
			x2={tcX}
			y1={96}
			y2={500}
			stroke="var(--im-tc)"
			stroke-width="1.2"
			stroke-dasharray="4 3"
		/>
		<Label anchor="start" x={tcX + 6} y={112} text="T꜀ = 2.269" size={12} color="var(--im-tc)" />
		{#each sizes as s, i (s)}
			<path
				d={curvePath(s, 'm', syAbsM)}
				fill="none"
				stroke={sizeColour(i)}
				stroke-width={s === L ? 2.6 : 1.3}
				opacity={s === L ? 1 : 0.55}
			/>
		{/each}
		<path
			d={onsagerMPath}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
		/>
		<line x1={markX} x2={markX} y1={96} y2={500} stroke="var(--stage-ink-muted)" stroke-width="1" />
		<circle
			cx={markX}
			cy={syAbsM(measured.m)}
			r="5.5"
			fill={sizeColour(sizeIndex)}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout
			id="avg"
			order={3}
			label="Measured ⟨|m|⟩, {L} × {L}"
			value={measured.m.toFixed(2)}
			color={sizeColour(sizeIndex)}
		>
			<Label
				x={PX1}
				y={72}
				text="⟨|m|⟩ = {measured.m.toFixed(2)}"
				size={14}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
		<Readout id="exact" order={4} label="Onsager, infinite lattice" value={onsagerM(T).toFixed(2)}>
			<Label
				x={PX1}
				y={92}
				text="Onsager: {onsagerM(T).toFixed(2)}"
				size={12}
				anchor="end"
				tabular
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- panel: χ and c -->
	{#if panel === 'peaks'}
		<Label
			anchor="start"
			x={PX0}
			y={80}
			text="susceptibility χ′ (log scale)"
			size={13}
			weight={600}
		/>
		<Axes
			sx={sxT}
			sy={syChi}
			xTicks={[]}
			yTicks={[-2, -1, 0, 1, 2]}
			yFormat={(v: number) => (v < 0 ? `0.${'0'.repeat(-v - 1)}1` : `${10 ** v}`)}
		/>
		<Label
			anchor="start"
			x={PX0}
			y={338}
			text="heat capacity c (per spin, k)"
			size={13}
			weight={600}
		/>
		<Axes sx={sxT} sy={syC} xLabel="kT / J" yTicks={[0, 0.5, 1, 1.5, 2, 2.5]} />
		{#each [syChi, syC] as sy, j (j)}
			<line
				x1={tcX}
				x2={tcX}
				y1={j === 0 ? 96 : 354}
				y2={j === 0 ? 266 : 520}
				stroke="var(--im-tc)"
				stroke-width="1.2"
				stroke-dasharray="4 3"
			/>
			<line
				x1={markX}
				x2={markX}
				y1={j === 0 ? 96 : 354}
				y2={j === 0 ? 266 : 520}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
			{#each sizes as s, i (s)}
				<path
					d={curvePath(s, j === 0 ? 'chi' : 'c', sy)}
					fill="none"
					stroke={sizeColour(i)}
					stroke-width={s === L ? 2.6 : 1.3}
					opacity={s === L ? 1 : 0.55}
				/>
			{/each}
		{/each}
		<Label anchor="start" x={tcX + 6} y={258} text="T꜀" size={12} color="var(--im-tc)" />
		<path
			d={onsagerCPath}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
		/>
		{#if measured.chi >= 10 ** LOG_LO}
			<circle
				cx={markX}
				cy={syChi(Math.log10(Math.max(10 ** LOG_LO, measured.chi)))}
				r="5"
				fill={sizeColour(sizeIndex)}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		<circle
			cx={markX}
			cy={syC(Math.min(2.5, measured.c))}
			r="5"
			fill={sizeColour(sizeIndex)}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout
			id="chi"
			order={3}
			label="χ′, {L} × {L}"
			value={fmtChi(measured.chi)}
			color={sizeColour(sizeIndex)}
		>
			<Label
				x={PX1}
				y={80}
				text="χ′ = {fmtChi(measured.chi)}"
				size={14}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
		<Readout
			id="c"
			order={4}
			label="c, {L} × {L}"
			value={measured.c.toFixed(2)}
			color={sizeColour(sizeIndex)}
		>
			<Label
				x={PX1}
				y={338}
				text="c = {measured.c.toFixed(2)}"
				size={14}
				anchor="end"
				tabular
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- size legend for the curve panels -->
	{#if panel !== 'trace'}
		<Readout
			id="legend"
			label="Curves: 8, 16, 32, 64 spins a side (light to dark); dashed: Onsager"
		>
			{#each sizes as s, i (s)}
				<line
					x1={PX0 + i * 62}
					x2={PX0 + i * 62 + 18}
					y1={LEGEND_Y}
					y2={LEGEND_Y}
					stroke={sizeColour(i)}
					stroke-width={s === L ? 3 : 1.6}
				/>
				<Label
					anchor="start"
					x={PX0 + i * 62 + 23}
					y={LEGEND_Y + 4}
					text={String(s)}
					size={12}
					weight={s === L ? 700 : 400}
					halo={false}
				/>
			{/each}
			<line
				x1={PX0 + 252}
				x2={PX0 + 276}
				y1={LEGEND_Y}
				y2={LEGEND_Y}
				stroke="var(--stage-ink)"
				stroke-width="1.6"
				stroke-dasharray="6 4"
			/>
			<Label anchor="start" x={PX0 + 281} y={LEGEND_Y + 4} text="exact, ∞" size={12} halo={false} />
		</Readout>
	{/if}
</g>
