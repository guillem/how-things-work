<script lang="ts">
	/**
	 * A 1 eV electron packet sent at a rectangular barrier, solved with the
	 * split-step integrator (`tunnel`), drawn on an energy diagram: the
	 * barrier's height is its potential energy, the packet's |ψ|² is drawn on
	 * the line of its energy (1 eV), as textbooks do.
	 *
	 * Phases (`step.hints.phase`):
	 *   barrier     — the packet comes in, splits, and the two parts leave; an
	 *                 inset magnifies |ψ| across the barrier at the moment of
	 *                 the hit (log scale, so the exponential decay inside is a
	 *                 straight line). Readouts: transmitted and reflected
	 *                 probability from the simulation, and the plane-wave T.
	 *   exponential — T against barrier width on a log axis: the packet
	 *                 average (solid) and the plane wave at exactly 1 eV
	 *                 (dashed), with the simulated value at the chosen width.
	 *   measure     — after each run one of two detectors clicks, at random
	 *                 with the tunnelled probability (seeded); the other part
	 *                 of the wave vanishes, and the counts build up. `fast`:
	 *                 25 electrons a second, counts only.
	 *   stm         — a tip above a surface; the gap is a 4.5 eV barrier above
	 *                 the electrons' energy (1 eV electron, 5.5 eV barrier),
	 *                 and the current is T(gap) relative to T(0.5 nm), on a
	 *                 log plot.
	 *
	 * Animation: 1 s = 4 fs (8 fs on the measure step); the run lasts until the
	 * two parts are back where the packet started, then holds and repeats.
	 * The run is recomputed (≈ 40 ms) only when the height or width change.
	 * Reduced motion: the frame after the split; on the measure step, the
	 * counts of 400 electrons.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { barrierT, outcomes, packetT, snapWidth, tunnel } from '../quantum';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'barrier'));
	const isStm = $derived(phase === 'stm');
	const isExp = $derived(phase === 'exponential');
	const isMeasure = $derived(phase === 'measure');

	const E = 1;
	const SIGMA = 1.5;
	const V0 = $derived(clamp(Number(params.height ?? 2), 0, 3));
	const a = $derived(snapWidth(clamp(Number(params.width ?? 0.25), 0.05, 1)));
	const fast = $derived(isMeasure && Boolean(params.fast ?? false));

	// ---- the run --------------------------------------------------------------------------
	const run = $derived(isStm ? null : tunnel({ E, V0, a, sigma: SIGMA, every: 0.12 }));
	const FS_PER_S = $derived(isMeasure ? 8 : 4);
	const runS = $derived(run ? ((run.frames.length - 1) * run.dt) / FS_PER_S : 1); // seconds
	const HOLD = 1.6;
	const cycleS = $derived(runS + HOLD);

	// The run restarts when the barrier or the mode changes (start time remembered, as in
	// the double slit).
	const runKey = $derived(`${phase}|${V0}|${a}|${fast}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});
	const cycleIdx = $derived(reduced ? 0 : Math.floor(elapsed / cycleS));
	const inCycle = $derived(reduced ? runS + HOLD * 0.5 : elapsed - cycleIdx * cycleS);
	const frameIdx = $derived(
		run ? Math.min(run.frames.length - 1, Math.round((inCycle * FS_PER_S) / run.dt)) : 0
	);
	const simT = $derived(run ? frameIdx * run.dt : 0);
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, inCycle));
	const fadeOut = $derived(reduced ? 1 : 1 - smoothstep(cycleS - 0.35, cycleS, inCycle));

	// ---- geometry ---------------------------------------------------------------------------
	const XMIN = -14;
	const XMAX = 14;
	const PX0 = 60;
	const PX1 = 650;
	const sx = (x: number) => PX0 + ((x - XMIN) / (XMAX - XMIN)) * (PX1 - PX0);
	const EY0 = 500; // energy 0
	const EPX = 115; // px per eV
	const ey = (e: number) => EY0 - e * EPX;
	const PROB_PX = 75 / (1 / (Math.sqrt(2 * Math.PI) * SIGMA)); // px per unit |ψ|² (initial peak → 75 px)

	// ---- measurement -------------------------------------------------------------------------
	const verdicts = $derived(run ? outcomes(run.transmitted, 4000, 5) : []);
	/** 0 → 1 over the click: the losing part of the wave fades, the winner shrinks to a dot. */
	const collapse = $derived(
		isMeasure && !fast && !reduced ? smoothstep(runS, runS + 0.5, inCycle) : 0
	);
	const done = $derived.by(() => {
		if (!isMeasure) return 0;
		if (reduced) return 400;
		if (fast) return Math.min(4000, Math.floor(elapsed * 25));
		return Math.min(4000, cycleIdx + (collapse > 0.5 ? 1 : 0));
	});
	const rightCount = $derived(verdicts.slice(0, done).filter(Boolean).length);
	const verdict = $derived(isMeasure && !fast && !reduced ? verdicts[cycleIdx % 4000] : null);

	// ---- the drawn wave -------------------------------------------------------------------------
	const waveLine = $derived.by(() => {
		if (!run || isExp) return { left: '', right: '', re: '' };
		const f = run.frames[frameIdx];
		const g = run.g;
		const j0 = Math.round(XMIN / g.dx) + g.n / 2;
		const j1 = Math.round(XMAX / g.dx) + g.n / 2;
		const jb = g.n / 2; // the barrier's first cell
		const base = ey(E);
		const gainL = verdict === true ? 1 - collapse : 1;
		const gainR = verdict === false ? 1 - collapse : 1;
		let left = `M${sx(XMIN).toFixed(1)} ${base}`;
		let right = `M${sx(run.right).toFixed(1)} ${base}`;
		let re = '';
		for (let j = j0; j <= j1; j++) {
			const x = g.x[j];
			const p = f.re[j] * f.re[j] + f.im[j] * f.im[j];
			const X = sx(x).toFixed(1);
			const side = j < jb + Math.round(run.a / g.dx) ? gainL : gainR;
			if (j < jb + Math.round(run.a / g.dx))
				left += `L${X} ${(base - p * PROB_PX * side).toFixed(1)}`;
			else right += `L${X} ${(base - p * PROB_PX * side).toFixed(1)}`;
			const amp = Math.sqrt(PROB_PX * 75) * side; // Re ψ scaled so the start peaks at 120 px too
			re += `${re ? 'L' : 'M'}${X} ${(base - f.re[j] * amp * 0.5).toFixed(1)}`;
		}
		left += `L${sx(run.right).toFixed(1)} ${base}Z`;
		right += `L${sx(XMAX).toFixed(1)} ${base}Z`;
		return { left, right, re };
	});

	// ---- inset: |ψ| across the barrier, log scale, at the frame where the most is inside --------
	const inset = $derived.by(() => {
		if (!run || isExp || isStm || isMeasure) return null;
		const g = run.g;
		const jb = g.n / 2;
		const cells = Math.round(run.a / g.dx);
		// the frame where |ψ|² at the barrier's entrance peaks
		let best = 0;
		let bestV = -1;
		for (let k = 0; k < run.frames.length; k++) {
			const f = run.frames[k];
			const v = f.re[jb] * f.re[jb] + f.im[jb] * f.im[jb];
			if (v > bestV) {
				bestV = v;
				best = k;
			}
		}
		const f = run.frames[best];
		const lo = jb - Math.round(1 / g.dx);
		const hi = jb + cells + Math.round(1 / g.dx);
		const xs0 = run.left - 1;
		const xs1 = run.right + 1;
		const W = 210;
		const H = 110;
		const X0 = 700;
		const Y0 = 320;
		const ix = (x: number) => X0 + ((x - xs0) / (xs1 - xs0)) * W;
		// log10 |ψ|² from −6 to 0 (relative to the peak at the entrance)
		const ref = bestV > 0 ? bestV : 1;
		let d = '';
		for (let j = lo; j <= hi; j++) {
			const p = (f.re[j] * f.re[j] + f.im[j] * f.im[j]) / ref;
			const l = clamp(Math.log10(Math.max(p, 1e-4)), -4, 1);
			d += `${d ? 'L' : 'M'}${ix(g.x[j]).toFixed(1)} ${(Y0 + H - ((l + 4) / 5) * H).toFixed(1)}`;
		}
		return { d, X0, Y0, W, H, bx0: ix(run.left), bx1: ix(run.right) };
	});

	// ---- T against width (exponential) ------------------------------------------------------------
	const LP = { x0: 90, x1: 640, y0: 70, y1: 470 }; // log plot frame
	const DECADES = 6; // 1 … 10⁻⁶
	const ly = (T: number) =>
		LP.y0 + (clamp(-Math.log10(Math.max(T, 1e-9)), 0, DECADES) / DECADES) * (LP.y1 - LP.y0);
	const lx = (w: number, w0: number, w1: number) =>
		LP.x0 + ((w - w0) / (w1 - w0)) * (LP.x1 - LP.x0);
	const expCurves = $derived.by(() => {
		if (!isExp) return { packet: '', plane: '' };
		let packet = '';
		let plane = '';
		for (let i = 0; i <= 80; i++) {
			const w = (i / 80) * 1;
			const X = lx(w, 0, 1).toFixed(1);
			packet += `${i ? 'L' : 'M'}${X} ${ly(packetT(E, SIGMA, V0, w)).toFixed(1)}`;
			plane += `${i ? 'L' : 'M'}${X} ${ly(barrierT(E, V0, w)).toFixed(1)}`;
		}
		return { packet, plane };
	});

	// ---- STM ----------------------------------------------------------------------------------------
	const WORK = 4.5;
	const gap = $derived(clamp(Number(params.gap ?? 0.5), 0.3, 1));
	const stmT = (d: number) => barrierT(E, E + WORK, d);
	const current = $derived(stmT(gap) / stmT(0.5));
	const per01 = $derived(stmT(gap) / stmT(gap + 0.1));
	const stmCurve = $derived.by(() => {
		if (!isStm) return '';
		let d = '';
		for (let i = 0; i <= 70; i++) {
			const w = 0.3 + (i / 70) * 0.7;
			d += `${i ? 'L' : 'M'}${lx(w, 0.3, 1).toFixed(1)} ${sy(stmT(w) / stmT(0.5)).toFixed(1)}`;
		}
		return d;
	});
	/** STM plot: relative current from 10³ (top) to 10⁻³ (bottom). */
	const SP = { y0: 300, y1: 560 };
	const sy = (r: number) => SP.y0 + ((2 - clamp(Math.log10(r), -5, 2)) / 7) * (SP.y1 - SP.y0);

	const pct = (p: number) =>
		p === 0
			? '0%'
			: p >= 0.1
				? `${(p * 100).toFixed(0)}%`
				: p >= 0.001
					? `${(p * 100).toFixed(1)}%`
					: `${(p * 100).toFixed(3)}%`;
	const PL = 700;
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]))
			.join('');
	const fmtRel = (r: number) =>
		r >= 10
			? `${Math.round(r)}×`
			: r >= 0.1
				? `${r.toFixed(2)}×`
				: `1/${Math.round(1 / r).toLocaleString('en-US')}`;
</script>

<g>
	{#if !isExp && !isStm}
		<!-- energy axis -->
		<line x1={PX0} x2={PX0} y1={ey(3.2)} y2={EY0} stroke="var(--stage-line)" />
		{#each [0, 1, 2, 3] as e (e)}
			<line x1={PX0 - 5} x2={PX0} y1={ey(e)} y2={ey(e)} stroke="var(--stage-line)" />
			<Readout id="e-{e}">
				<T x={PX0 - 8} y={ey(e) + 4} text="{e} eV" size={11} anchor="end" muted />
			</Readout>
		{/each}
		<line x1={PX0} x2={PX1} y1={EY0} y2={EY0} stroke="var(--stage-line)" />

		<!-- the barrier -->
		{#if run}
			<rect
				x={sx(run.left)}
				y={ey(V0)}
				width={Math.max(1.5, sx(run.right) - sx(run.left))}
				height={EY0 - ey(V0)}
				fill="var(--qm-barrier-fill)"
				stroke="var(--qm-barrier)"
				stroke-width="1.5"
			/>
			<Readout
				id="barrier-label"
				label="Barrier"
				value="{V0.toFixed(1)} eV high, {a.toFixed(2)} nm wide"
			>
				<T
					x={sx(run.right) + 8}
					y={ey(V0) - 8}
					text="barrier {V0.toFixed(1)} eV"
					size={12}
					weight={600}
				/>
				<T x={sx(run.right) + 8} y={ey(V0) + 8} text="{a.toFixed(2)} nm wide" size={11} muted />
			</Readout>
		{/if}

		<!-- the electron's energy -->
		<line
			x1={PX0}
			x2={PX1}
			y1={ey(E)}
			y2={ey(E)}
			stroke="var(--qm-prob)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		<Readout id="energy-label">
			<T
				x={PX1}
				y={ey(E) + 26}
				text="electron energy 1 eV"
				size={11}
				anchor="end"
				color="var(--qm-prob)"
			/>
		</Readout>

		<!-- the wave -->
		<g opacity={fadeIn * fadeOut}>
			<path d={waveLine.re} fill="none" stroke="var(--qm-re)" stroke-width="1" opacity="0.45" />
			<path d={waveLine.left} fill="var(--qm-prob-fill)" stroke="var(--qm-prob)" stroke-width="2" />
			<path
				d={waveLine.right}
				fill="var(--qm-prob-fill)"
				stroke="var(--qm-prob)"
				stroke-width="2"
			/>
		</g>
		<Readout id="time" order={9} label="Time" value="{Math.round(simT)} fs">
			<T x={PX0 + 6} y={EY0 + 30} text="t = {Math.round(simT)} fs" size={12} muted />
		</Readout>
		<Readout id="dist">
			<T x={PX1} y={EY0 + 30} text="view: {XMAX - XMIN} nm wide" size={12} anchor="end" muted />
		</Readout>
	{/if}

	<!-- detectors (measure) -->
	{#if isMeasure}
		{#each [{ side: false, x: sx(XMIN + 0.7) }, { side: true, x: sx(XMAX - 0.7) }] as d (d.side)}
			{@const lit = verdict === d.side ? collapse * fadeOut : 0}
			<rect
				x={d.x - 12}
				y={ey(E) - 150}
				width="24"
				height="150"
				rx="6"
				fill="var(--qm-click)"
				fill-opacity={0.3 * lit}
				stroke={lit > 0.01 ? 'var(--qm-click)' : 'var(--stage-line)'}
				stroke-width={lit > 0.01 ? 2.5 : 1.5}
			/>
			<Readout id="det-{d.side}">
				<T
					x={d.side ? d.x + 12 : d.x - 12}
					y={ey(E) - 160}
					text={d.side ? 'detector R' : 'detector L'}
					size={12}
					anchor={d.side ? 'end' : 'start'}
					weight={600}
				/>
			</Readout>
			{#if lit > 0.05}
				<Readout
					id="click-{d.side}"
					label="Click"
					value={d.side ? 'right: it tunnelled' : 'left: it reflected'}
					color="var(--qm-click)"
					opacity={lit}
				>
					<T
						x={d.side ? d.x + 12 : d.x - 12}
						y={ey(E) + 46}
						text={d.side ? 'click: found on the right' : 'click: found on the left'}
						size={13}
						anchor={d.side ? 'end' : 'start'}
						weight={700}
						color="var(--qm-click)"
						opacity={lit}
					/>
				</Readout>
			{/if}
		{/each}
	{/if}

	<!-- panel: barrier and measure -->
	{#if run && !isExp}
		{#if !isMeasure}
			<Readout
				id="through"
				order={1}
				label="Got through (simulated)"
				value={pct(run.transmitted)}
				color="var(--qm-prob)"
			>
				<T x={PL} y={60} text="probability through" size={13} muted />
				<T
					x={PL}
					y={92}
					text={pct(run.transmitted)}
					size={28}
					weight={600}
					color="var(--qm-prob)"
				/>
				<T x={PL} y={114} text="reflected {pct(run.reflected)}" size={12} muted />
			</Readout>
			<Readout
				id="plane"
				order={2}
				label="Plane wave at exactly 1 eV"
				value="T = {pct(barrierT(E, V0, a))}"
			>
				<T x={PL} y={150} text="textbook T, plane wave at 1 eV" size={12} muted />
				<T x={PL} y={170} text={pct(barrierT(E, V0, a))} size={15} weight={600} />
				<T x={PL} y={190} text="the packet has a spread of energies" size={11} muted />
			</Readout>
			<Readout
				id="regime"
				order={3}
				label="Classically"
				value={V0 > E ? 'it could never get through' : 'it would always get through'}
			>
				<T x={PL} y={226} text="a ball with this energy would" size={12} muted />
				<T
					x={PL}
					y={242}
					text={V0 > E ? 'always bounce back' : 'always roll over'}
					size={12}
					weight={600}
				/>
			</Readout>
		{/if}
		{#if inset}
			<g>
				<rect
					x={inset.X0}
					y={inset.Y0}
					width={inset.W}
					height={inset.H}
					fill="var(--surface)"
					stroke="var(--border)"
					rx="4"
				/>
				<rect
					x={inset.bx0}
					y={inset.Y0}
					width={inset.bx1 - inset.bx0}
					height={inset.H}
					fill="var(--qm-barrier-fill)"
				/>
				{#each [0, 2, 4] as k (k)}
					<line
						x1={inset.X0}
						x2={inset.X0 + inset.W}
						y1={inset.Y0 + inset.H - ((4 - k) / 5) * inset.H}
						y2={inset.Y0 + inset.H - ((4 - k) / 5) * inset.H}
						stroke="var(--stage-grid)"
					/>
				{/each}
				<path d={inset.d} fill="none" stroke="var(--qm-prob)" stroke-width="2" />
				<Readout id="inset-title">
					<T
						x={inset.X0}
						y={inset.Y0 - 24}
						text="|ψ|² across the barrier, as it hits"
						size={12}
						muted
					/>
					<T
						x={inset.X0}
						y={inset.Y0 - 8}
						text="(log scale: grid lines a factor 100 apart)"
						size={11}
						muted
					/>
					<T
						x={(inset.bx0 + inset.bx1) / 2}
						y={inset.Y0 + inset.H + 16}
						text="barrier"
						size={11}
						anchor="middle"
						muted
					/>
				</Readout>
			</g>
		{/if}
		{#if isMeasure}
			<Readout id="sent" order={1} label="Electrons sent" value={String(done)}>
				<T x={PL} y={60} text="electrons sent" size={13} muted />
				<T x={PL} y={92} text={String(done)} size={28} weight={600} />
			</Readout>
			<Readout
				id="found"
				order={2}
				label="Found on the right"
				value="{rightCount} ({done ? pct(rightCount / done) : '–'})"
				color="var(--qm-click)"
			>
				<T x={PL} y={130} text="found on the right" size={13} muted />
				<T
					x={PL}
					y={156}
					text="{rightCount}  ({done ? pct(rightCount / done) : '–'})"
					size={20}
					weight={600}
					color="var(--qm-click)"
				/>
			</Readout>
			<Readout
				id="share"
				order={3}
				label="Share of |ψ|² that tunnelled"
				value={pct(run.transmitted)}
				color="var(--qm-prob)"
			>
				<T x={PL} y={196} text="share of |ψ|² that tunnelled" size={13} muted />
				<T
					x={PL}
					y={222}
					text={pct(run.transmitted)}
					size={20}
					weight={600}
					color="var(--qm-prob)"
				/>
			</Readout>
			<!-- the two fractions as bars -->
			<rect x={PL} y={244} width="220" height="12" rx="3" fill="var(--stage-grid)" />
			<rect
				x={PL}
				y={244}
				width={220 * (done ? rightCount / done : 0)}
				height="12"
				rx="3"
				fill="var(--qm-click)"
			/>
			<rect x={PL} y={262} width={220 * run.transmitted} height="6" rx="2" fill="var(--qm-prob)" />
			{#if fast}
				<Readout id="fast-note">
					<T x={PL} y={292} text="fast: counts only" size={12} muted />
				</Readout>
			{/if}
		{/if}
	{/if}

	<!-- T against width -->
	{#if isExp}
		<g>
			{#each Array.from({ length: DECADES + 1 }, (_, k) => k) as k (k)}
				<line
					x1={LP.x0}
					x2={LP.x1}
					y1={ly(10 ** -k)}
					y2={ly(10 ** -k)}
					stroke="var(--stage-grid)"
				/>
				<Readout id="dec-{k}">
					<T
						x={LP.x0 - 8}
						y={ly(10 ** -k) + 4}
						text={k === 0 ? '1' : `10${sup(-k)}`}
						size={11}
						anchor="end"
						muted
					/>
				</Readout>
			{/each}
			{#each [0, 0.2, 0.4, 0.6, 0.8, 1] as w (w)}
				<line
					x1={lx(w, 0, 1)}
					x2={lx(w, 0, 1)}
					y1={LP.y1}
					y2={LP.y1 + 6}
					stroke="var(--stage-line)"
				/>
				<Readout id="w-{w}">
					<T x={lx(w, 0, 1)} y={LP.y1 + 22} text={w.toFixed(1)} size={11} anchor="middle" muted />
				</Readout>
			{/each}
			<line x1={LP.x0} x2={LP.x1} y1={LP.y1} y2={LP.y1} stroke="var(--stage-line)" />
			<line x1={LP.x0} x2={LP.x0} y1={LP.y0} y2={LP.y1} stroke="var(--stage-line)" />
			<Readout id="exp-axes">
				<T x={LP.x1} y={LP.y1 + 44} text="barrier width (nm)" size={12} anchor="end" muted />
				<T
					x={LP.x0 - 8}
					y={LP.y0 - 18}
					text="chance of getting through (log scale)"
					size={12}
					muted
				/>
			</Readout>
			<path
				d={expCurves.plane}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity="0.7"
			/>
			<path d={expCurves.packet} fill="none" stroke="var(--qm-prob)" stroke-width="2.5" />
			{#if run}
				<circle
					cx={lx(a, 0, 1)}
					cy={ly(run.transmitted)}
					r="7"
					fill="var(--qm-barrier)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			{/if}
		</g>
		<Readout id="exp-legend-1" order={2} label="Solid" value="averaged over the packet's energies">
			<line x1={PL} x2={PL + 24} y1={150} y2={150} stroke="var(--qm-prob)" stroke-width="2.5" />
			<T x={PL + 32} y={154} text="the packet (energies averaged)" size={12} />
		</Readout>
		<Readout id="exp-legend-2" order={3} label="Dashed" value="plane wave at exactly 1 eV">
			<line
				x1={PL}
				x2={PL + 24}
				y1={174}
				y2={174}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<T x={PL + 32} y={178} text="plane wave at exactly 1 eV" size={12} />
		</Readout>
		{#if run}
			<Readout
				id="exp-sim"
				order={1}
				label="Simulated, this width"
				value={pct(run.transmitted)}
				color="var(--qm-barrier)"
			>
				<circle cx={PL + 12} cy={60} r="7" fill="var(--qm-barrier)" />
				<T x={PL + 32} y={64} text="simulated: {pct(run.transmitted)}" size={14} weight={600} />
				<T x={PL + 32} y={84} text="{V0.toFixed(1)} eV, {a.toFixed(2)} nm" size={12} muted />
			</Readout>
			{#if V0 > E}
				<Readout
					id="exp-step"
					order={4}
					label="Each extra 0.1 nm"
					value="÷ {(barrierT(E, V0, 0.8) / barrierT(E, V0, 0.9)).toFixed(1)}"
				>
					<T x={PL} y={222} text="each extra 0.1 nm (thick barrier):" size={12} muted />
					<T
						x={PL}
						y={244}
						text="chance ÷ {(barrierT(E, V0, 0.8) / barrierT(E, V0, 0.9)).toFixed(1)}"
						size={16}
						weight={600}
					/>
				</Readout>
			{/if}
		{/if}
	{/if}

	<!-- STM -->
	{#if isStm}
		{@const SX = 200}
		{@const SURF = 190}
		{@const NMPX = 110}
		<!-- surface atoms -->
		{#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
			<circle cx={60 + i * 34} cy={SURF + 22} r="16" fill="var(--qm-wall)" opacity="0.6" />
		{/each}
		<!-- tip -->
		<path
			d="M{SX - 60} 30 L{SX + 60} 30 L{SX + 6} {SURF + 6 - gap * NMPX} L{SX - 6} {SURF +
				6 -
				gap * NMPX} Z"
			fill="var(--qm-wall)"
			opacity="0.85"
		/>
		<line
			x1={SX + 70}
			x2={SX + 70}
			y1={SURF + 6 - gap * NMPX}
			y2={SURF + 6}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<path
			d="M{SX + 64} {SURF + 6 - gap * NMPX}h12M{SX + 64} {SURF + 6}h12"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Readout id="gap-label" label="Gap" value="{gap.toFixed(2)} nm">
			<T
				x={SX + 82}
				y={SURF + 10 - (gap * NMPX) / 2}
				text="gap {gap.toFixed(2)} nm"
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout id="stm-tip">
			<T x={SX - 66} y={50} text="metal tip" size={12} anchor="end" muted />
			<T x={370} y={SURF + 27} text="surface atoms" size={12} muted />
		</Readout>
		<!-- current vs gap -->
		{#each [2, 1, 0, -1, -2, -3, -4, -5] as k (k)}
			<line x1={LP.x0} x2={LP.x1} y1={sy(10 ** k)} y2={sy(10 ** k)} stroke="var(--stage-grid)" />
			<Readout id="sdec-{k}">
				<T
					x={LP.x0 - 8}
					y={sy(10 ** k) + 4}
					text={k === 0 ? '1' : `10${sup(k)}`}
					size={11}
					anchor="end"
					muted
				/>
			</Readout>
		{/each}
		{#each [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] as w (w)}
			<line
				x1={lx(w, 0.3, 1)}
				x2={lx(w, 0.3, 1)}
				y1={SP.y1}
				y2={SP.y1 + 6}
				stroke="var(--stage-line)"
			/>
			<Readout id="sw-{w}">
				<T x={lx(w, 0.3, 1)} y={SP.y1 + 20} text={w.toFixed(1)} size={11} anchor="middle" muted />
			</Readout>
		{/each}
		<line x1={LP.x0} x2={LP.x1} y1={SP.y1} y2={SP.y1} stroke="var(--stage-line)" />
		<Readout id="stm-axes">
			<T x={LP.x1} y={SP.y1 + 36} text="gap (nm)" size={12} anchor="end" muted />
			<T
				x={LP.x0 + 6}
				y={SP.y0 - 14}
				text="current, relative to a 0.5 nm gap (log scale)"
				size={12}
				muted
			/>
		</Readout>
		<path d={stmCurve} fill="none" stroke="var(--qm-prob)" stroke-width="2.5" />
		<circle
			cx={lx(gap, 0.3, 1)}
			cy={sy(current)}
			r="7"
			fill="var(--qm-barrier)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>

		<Readout
			id="stm-current"
			order={1}
			label="Current"
			value="{fmtRel(current)} the current at 0.5 nm"
			color="var(--qm-barrier)"
		>
			<T x={PL} y={60} text="tunnelling current" size={13} muted />
			<T x={PL} y={92} text={fmtRel(current)} size={28} weight={600} />
			<T x={PL} y={114} text="of the current at a 0.5 nm gap" size={12} muted />
		</Readout>
		<Readout id="stm-step" order={2} label="0.1 nm further" value="current ÷ {per01.toFixed(1)}">
			<T x={PL} y={156} text="0.1 nm further away:" size={13} muted />
			<T x={PL} y={180} text="current ÷ {per01.toFixed(1)}" size={18} weight={600} />
		</Readout>
		<Readout id="stm-work" order={3} label="Barrier" value="work function 4.5 eV (assumed)">
			<T x={PL} y={220} text="barrier: work function 4.5 eV" size={12} muted />
			<T x={PL} y={236} text="(a typical metal, assumed)" size={11} muted />
		</Readout>
	{/if}
</g>
