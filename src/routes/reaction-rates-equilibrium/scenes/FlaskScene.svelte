<script lang="ts">
	/**
	 * The flask: a box of molecules (left), the energy profile (top right) and a
	 * plot (bottom right), all from one run of the rate law (../model.ts).
	 *
	 * The run: `simulate` from the step's starting mixture under its conditions,
	 * plus the changes the reader makes while it runs (on the `heat` step the
	 * temperature and catalyst apply at once; "Add / Take out H₂" presses on the
	 * `add` and `heat` steps). Any other control restarts the run. The run's start
	 * time, the starting conditions and the times of those changes are the only
	 * remembered values, kept in plain variables inside `$derived`s (as in the gas
	 * box of the entropy explainer). One second of animation is `lapse` seconds in
	 * the flask (from the step's hints, or chosen from the half-life when 'auto').
	 *
	 * The box (../box.ts) replays real meetings of its molecules and lets as many
	 * react as the run says; flashes mark the reactions (forward orange, reverse
	 * pink). Iodine vapour is violet: the box's tint follows [I₂].
	 *
	 * Plots (`hints.plot`): 'conc' concentrations over time with the equilibrium
	 * level of HI; 'rates' the forward and reverse rates; 'log' [HI] over a
	 * powers-of-ten time axis, with the uncatalysed run faint behind.
	 *
	 * Reduced motion: a fixed moment per step (the half-life, or equilibrium), and
	 * any change the reader makes applies at 1 s and the frame shows its outcome.
	 */
	import { Axes, Label, linePath, niceMax, scale, thin, ticks } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Profile from '../parts/Profile.svelte';
	import { BOX_H, BOX_W, BoxRun, FLASH_FOR, position, startSpecies, type Dose } from '../box';
	import { ATOM, atoms, circ, fmtPow, fmtTime, niceLapse, sig } from '../look';
	import {
		DH,
		EA_F,
		GOLD_LOWERING,
		START,
		START_HI,
		START_TOTAL,
		equilibriumConstant,
		equilibriumMix,
		halfLife,
		hiShare,
		kForward,
		mixAt,
		quotient,
		sampleAt,
		simulate,
		type Change,
		type Mix
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const UNIT = START_TOTAL / 60; // mol/L per drawn molecule
	const WINDOW = 150; // seconds of animation simulated per run
	const MAX_ADDS = 3;

	const focus = $derived(String(step.hints?.focus ?? 'rate'));
	const plot = $derived(String(step.hints?.plot ?? 'conc'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const live = $derived(focus === 'heat');

	// ---- conditions from the controls --------------------------------------------------
	const clampT = (v: number) => Math.min(781, Math.max(556, v));
	const temp = $derived(
		offered.has('tRate')
			? clampT(Number(params.tRate ?? 700))
			: offered.has('tHeat')
				? clampT(Number(params.tHeat ?? 700))
				: 700
	);
	const low = $derived(
		offered.has('lowering')
			? Math.min(80, Math.max(0, Number(params.lowering ?? 0))) * 1000
			: offered.has('gold') && params.gold === true
				? GOLD_LOWERING
				: 0
	);
	const h2Factor = $derived(offered.has('h2Start') ? Number(params.h2Start ?? 30) / 30 : 1);
	const fromHI = $derived(offered.has('from') && params.from === 'hi');
	const restarts = $derived(Number(params.restart ?? 0));
	const adds = $derived(Number(params.addH2 ?? 0));
	const removes = $derived(Number(params.removeH2 ?? 0));

	/** What restarts the run: everything except the live controls of the heat step. */
	const runKey = $derived(
		[step.id, restarts, h2Factor, fromHI, live ? '' : temp, live ? '' : low].join('|')
	);

	// ---- run clock ----------------------------------------------------------------
	const REDUCED_AT: Record<string, number> = {
		rate: 3,
		concentration: 3,
		temperature: 4,
		catalyst: 4,
		reverse: 12,
		equilibrium: 45,
		fromhi: 45,
		catalysteq: 45,
		add: 10,
		heat: 10
	};
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0; // a new step started (t went back to 0)
		if (reduced) return REDUCED_AT[focus] ?? 10;
		return Math.max(0, t - t0);
	});

	// ---- the run's start and the changes made during it ---------------------------------
	interface Log {
		T0: number;
		low0: number;
		changes: { tau: number; T?: number; lowering?: number; dose?: number }[];
	}
	let log: Log = { T0: 700, low0: 0, changes: [] };
	let logKey = '';
	let seen = { T: 0, low: 0, adds: 0, removes: 0 };
	let lastEl = 0;
	const events = $derived.by(() => {
		const el = elapsed;
		const now = { T: temp, low, adds, removes };
		if (runKey !== logKey || el < lastEl - 1e-9) {
			logKey = runKey;
			log = { T0: temp, low0: low, changes: [] };
			seen = now;
		}
		lastEl = el;
		const at = reduced ? 1 : el;
		const added: Log['changes'] = [];
		if (live && now.T !== seen.T) added.push({ tau: at, T: now.T });
		if (live && now.low !== seen.low) added.push({ tau: at, lowering: now.low });
		let made = log.changes.filter((c) => (c.dose ?? 0) > 0).length;
		for (let k = 0; k < now.adds - seen.adds && made < MAX_ADDS; k++, made++)
			added.push({ tau: at, dose: 10 });
		for (let k = 0; k < now.removes - seen.removes; k++) added.push({ tau: at, dose: -5 });
		seen = now;
		if (added.length) log = { ...log, changes: [...log.changes, ...added] };
		return log;
	});
	const changed = $derived(events.changes.length > 0);
	const shownAt = $derived(reduced && changed ? 45 : elapsed);

	// ---- the starting mixture and the time-lapse ----------------------------------------
	const start = $derived.by((): Mix => {
		if (step.hints?.start === 'equilibrium') return equilibriumMix(START, events.T0);
		if (fromHI) return START_HI;
		return { ...START, h2: START.h2 * h2Factor };
	});
	const lapse = $derived.by(() => {
		const h = step.hints?.lapse;
		if (typeof h === 'number') return h;
		return niceLapse(halfLife(start, { T: events.T0, lowering: events.low0 }) / 2.5);
	});

	const run = $derived.by(() => {
		const changes: Change[] = events.changes.map((c) => ({
			at: c.tau * lapse,
			T: c.T,
			lowering: c.lowering,
			addH2: c.dose !== undefined ? c.dose * UNIT : undefined
		}));
		return simulate(
			start,
			{ T: events.T0, lowering: events.low0 },
			changes,
			WINDOW * lapse,
			lapse / 20
		);
	});
	const now = $derived(sampleAt(run, Math.min(WINDOW, shownAt) * lapse));

	// ---- the box -------------------------------------------------------------------
	const startCounts = $derived.by(() => {
		const nhi = 2 * Math.round(start.hi / UNIT / 2);
		const h = Math.round((2 * start.h2 + start.hi) / UNIT);
		const i = Math.round((2 * start.i2 + start.hi) / UNIT);
		return { h2: (h - nhi) / 2, i2: (i - nhi) / 2, hi: nhi };
	});
	const box = $derived.by(() => {
		const r = run;
		const doses: Dose[] = events.changes
			.filter((c) => c.dose !== undefined)
			.map((c) => ({ t: c.tau, n: c.dose ?? 0 }));
		return new BoxRun(
			startSpecies(startCounts.h2, startCounts.i2, startCounts.hi),
			(tau) => {
				const s = sampleAt(r, Math.min(WINDOW, tau) * lapse);
				return { forward: s.done / UNIT, reverse: s.undone / UNIT };
			},
			doses
		);
	});
	const snap = $derived.by(() => {
		const st = box.stateAt(shownAt);
		return {
			species: [...st.species],
			since: [...st.since],
			before: [...st.before],
			flashes: reduced ? [] : st.flashes.map((f) => ({ ...f })),
			counts: { ...st.counts }
		};
	});

	const BX = 24;
	const BY = 58;
	const IN = 8; // inner padding of the box frame
	const molecules = $derived.by(() => {
		let h = '';
		let i = '';
		const fading: { k: number; h: string; i: string; o: number }[] = [];
		for (let k = 0; k < snap.species.length; k++) {
			const s = snap.species[k];
			const age = shownAt - snap.since[k];
			const p = position(k, shownAt);
			const x = BX + IN + p.x;
			const y = BY + IN + p.y;
			if (s === 'none') {
				// A hydrogen molecule just taken out fades away.
				if (snap.before[k] === 'h2' && age < 0.6 && !reduced) {
					let fh = '';
					for (const [ax, ay, r] of atoms('h2', x, y, p.angle)) fh += circ(ax, ay, r);
					fading.push({ k, h: fh, i: '', o: 1 - age / 0.6 });
				}
				continue;
			}
			const list = atoms(s, x, y, p.angle);
			if (snap.before[k] === 'none' && age < 0.6 && !reduced) {
				let fh = '';
				for (const [ax, ay, r] of list) fh += circ(ax, ay, r);
				fading.push({ k, h: fh, i: '', o: age / 0.6 });
				continue;
			}
			for (const [ax, ay, r, isI] of list) {
				if (isI) i += circ(ax, ay, r);
				else h += circ(ax, ay, r);
			}
		}
		return { h, i, fading };
	});
	const tint = $derived(Math.min(0.24, (0.2 * now.i2) / START.i2));

	// ---- numbers -------------------------------------------------------------------
	const K = $derived(equilibriumConstant(now.T));
	const Q = $derived(quotient(now));
	const eqNow = $derived(equilibriumMix(now, now.T));
	const micro = (v: number) => v * 1e6; // mol L⁻¹ s⁻¹ → µmol L⁻¹ s⁻¹
	const fmtRate = (v: number) =>
		v >= 1000
			? Math.round(Number(v.toPrecision(2))).toLocaleString('en-US')
			: v >= 10
				? sig(v, 3)
				: v >= 0.01
					? sig(v, 2)
					: fmtPow(v);
	const fmtQ = (q: number) =>
		!isFinite(q) ? '∞' : q >= 1000 ? fmtPow(q) : q >= 10 ? q.toFixed(0) : sig(q, 2);
	const kText = $derived(`${Math.round(now.T)} K (${Math.round(now.T - 273.15)} °C)`);
	const catText = $derived(
		now.lowering > 0.5e3
			? Math.abs(now.lowering - GOLD_LOWERING) < 1
				? 'gold catalyst'
				: `catalyst: barrier −${Math.round(now.lowering / 1000)} kJ/mol`
			: ''
	);

	// ---- plot ----------------------------------------------------------------------
	const PL = { x: 528, y: 300, w: 392, h: 196 };
	const nowT = $derived(now.t);
	const span = $derived(Math.max(30 * lapse, nowT * 1.08));
	const unit = $derived(
		span > 3 * 3600
			? { div: 3600, name: 'h' }
			: span > 180
				? { div: 60, name: 'min' }
				: span > 3
					? { div: 1, name: 's' }
					: { div: 1e-3, name: 'ms' }
	);
	const sx = $derived(scale([0, span / unit.div], [PL.x, PL.x + PL.w]));
	const shown = $derived.by(() => {
		const out = [];
		for (const s of run) {
			if (s.t > nowT) break;
			out.push(s);
		}
		out.push(now);
		return thin(out, 300);
	});
	const cMax = $derived(
		niceMax(
			Math.max(start.h2, start.i2, start.hi, ...run.map((s) => Math.max(s.h2, s.hi))) * 1000 * 1.02
		)
	);
	const syC = $derived(scale([0, cMax], [PL.y + PL.h, PL.y]));
	const rMax = $derived(
		niceMax(micro(Math.max(...run.map((s) => Math.max(s.forward, s.reverse)))))
	);
	const syR = $derived(scale([0, rMax], [PL.y + PL.h, PL.y]));
	const tx = (s: { t: number }) => s.t / unit.div;
	const series = $derived.by(() => {
		if (plot === 'rates')
			return [
				{
					id: 'forward',
					d: linePath(shown, tx, (s) => micro(s.forward), sx, syR),
					color: 'var(--rr-forward)'
				},
				{
					id: 'reverse',
					d: linePath(shown, tx, (s) => micro(s.reverse), sx, syR),
					color: 'var(--rr-reverse)'
				}
			];
		return [
			{ id: 'h2', d: linePath(shown, tx, (s) => s.h2 * 1000, sx, syC), color: 'var(--rr-h2)' },
			{ id: 'i2', d: linePath(shown, tx, (s) => s.i2 * 1000, sx, syC), color: 'var(--rr-i2)' },
			{ id: 'hi', d: linePath(shown, tx, (s) => s.hi * 1000, sx, syC), color: 'var(--rr-hi)' }
		];
	});

	// Powers-of-ten time axis: 10⁻⁴ s to 10⁵ s.
	const LG = [-4, 5] as const;
	const lx = scale([LG[0], LG[1]], [PL.x, PL.x + PL.w]);
	const logCurve = (lowering: number) => {
		const pts: { x: number; y: number }[] = [];
		for (let k = 0; k <= 120; k++) {
			const e = LG[0] + ((LG[1] - LG[0]) * k) / 120;
			pts.push({ x: e, y: mixAt(start, { T: events.T0, lowering }, 10 ** e).hi * 1000 });
		}
		return linePath(
			pts,
			(p) => p.x,
			(p) => p.y,
			lx,
			syC
		);
	};
	const logNow = $derived(plot === 'log' ? logCurve(events.low0) : '');
	const logGhost = $derived(plot === 'log' && events.low0 > 0.5e3 ? logCurve(0) : '');
	const logDot = $derived.by(() => {
		const e = Math.log10(Math.max(10 ** LG[0], nowT));
		return { x: lx(Math.min(LG[1], e)), y: syC(now.hi * 1000) };
	});
	const logFmt = (v: number) => {
		const labels: Record<number, string> = {
			[-3]: '1 ms',
			[-1]: '0.1 s',
			0: '1 s',
			1: '10 s',
			2: '100 s',
			3: '17 min',
			4: '2.8 h',
			5: '28 h'
		};
		return labels[v] ?? '';
	};
	const timeTicks = $derived(ticks(0, span / unit.div, 5));

	// ---- what each step's readouts say ---------------------------------------------------
	const halfNow = $derived(halfLife(start, { T: events.T0, lowering: events.low0 }));
	const kRel = $derived(kForward(now.T, now.lowering) / kForward(700));
	const profileOpacity = $derived(['add', 'fromhi', 'concentration'].includes(focus) ? 0.55 : 1);
	const showReverse = $derived(
		!['rate', 'concentration', 'temperature', 'catalyst'].includes(focus)
	);
	const full = $derived(events.changes.filter((c) => (c.dose ?? 0) > 0).length >= MAX_ADDS);
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- title -->
	<Readout id="cond" order={1} label="Flask" value={catText ? `${kText}, ${catText}` : kText}>
		<text x={BX} y={40} style:font-size="16px" font-weight="600"
			>The flask · {kText}{#if catText}<tspan fill="var(--rr-cat)" font-size="14">
					· {catText}</tspan
				>{/if}</text
		>
	</Readout>

	<!-- the box -->
	<rect
		x={BX}
		y={BY}
		width={BOX_W + 2 * IN}
		height={BOX_H + 2 * IN}
		rx="14"
		fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<rect
		x={BX}
		y={BY}
		width={BOX_W + 2 * IN}
		height={BOX_H + 2 * IN}
		rx="14"
		fill="var(--rr-vapour)"
		opacity={tint}
	/>
	<path d={molecules.i} fill={ATOM.i} stroke={ATOM.iEdge} stroke-width="1" />
	<path d={molecules.h} fill={ATOM.h} stroke={ATOM.hEdge} stroke-width="1" />
	{#each molecules.fading as f (f.k)}
		<path d={f.h} fill={ATOM.h} stroke={ATOM.hEdge} stroke-width="1" opacity={f.o} />
	{/each}
	{#each snap.flashes as f (f.t * 1000 + f.x)}
		{@const age = (shownAt - f.t) / FLASH_FOR}
		<circle
			cx={BX + IN + f.x}
			cy={BY + IN + f.y}
			r={8 + 22 * age}
			fill="none"
			stroke={f.kind === 'forward' ? 'var(--rr-forward)' : 'var(--rr-reverse)'}
			stroke-width="3"
			opacity={Math.max(0, 1 - age)}
		/>
	{/each}

	<!-- under the box -->
	<Readout
		id="counts"
		order={2}
		label="In the box"
		value="H₂ {snap.counts.h2} · I₂ {snap.counts.i2} · HI {snap.counts.hi}"
	>
		{#each [{ k: 'h2' as const, x: 40, name: 'H₂', color: 'var(--rr-h2)' }, { k: 'i2' as const, x: 170, name: 'I₂', color: 'var(--rr-i2)' }, { k: 'hi' as const, x: 300, name: 'HI', color: 'var(--rr-hi)' }] as m (m.k)}
			{@const list = atoms(m.k, m.x + 10, 486, 0)}
			{#each list as [ax, ay, r, isI], j (j)}
				<circle
					cx={ax}
					cy={ay}
					{r}
					fill={isI ? ATOM.i : ATOM.h}
					stroke={isI ? ATOM.iEdge : ATOM.hEdge}
				/>
			{/each}
			<text x={m.x + 30} y={491} style:font-size="14px" font-weight="600" style:fill={m.color}
				>{m.name} {snap.counts[m.k]}</text
			>
		{/each}
	</Readout>
	<Readout
		id="clock"
		order={3}
		label="Time in the flask"
		value={fmtTime(now.t)}
		note="1 s here = {fmtTime(lapse)}"
	>
		<text x={BX} y={526} style:font-size="14px"
			>time in the flask: <tspan font-weight="600">{fmtTime(now.t)}</tspan></text
		>
		<text x={BX} y={546} style:font-size="12px" class="muted"
			>time-lapse: 1 s here = {fmtTime(lapse)}</text
		>
	</Readout>
	<Readout id="flash-key">
		<circle cx={BX + 6} cy={570} r="5" fill="none" stroke="var(--rr-forward)" stroke-width="2.5" />
		<text x={BX + 16} y={574} style:font-size="12px">H₂ + I₂ → 2 HI</text>
		{#if showReverse}
			<circle
				cx={BX + 146}
				cy={570}
				r="5"
				fill="none"
				stroke="var(--rr-reverse)"
				stroke-width="2.5"
			/>
			<text x={BX + 156} y={574} style:font-size="12px">2 HI → H₂ + I₂</text>
		{/if}
	</Readout>
	{#if full && focus === 'add'}
		<Readout id="full">
			<Label
				x={BX + BOX_W / 2 + IN}
				y={BY + 24}
				text="the box is full: start again to add more"
				size={12}
				pill
			/>
		</Readout>
	{/if}

	<!-- energy profile -->
	<Profile
		x={476}
		y={20}
		w={460}
		h={236}
		ea={EA_F / 1000}
		dh={DH / 1000}
		lowering={now.lowering / 1000}
		reverse={showReverse}
		opacity={profileOpacity}
		id="flask-profile"
	/>

	<!-- the plot -->
	{#if plot === 'log'}
		<Axes
			sx={lx}
			sy={syC}
			xTicks={[-3, -1, 1, 3, 5]}
			xFormat={logFmt}
			yLabel="HI, mmol/L"
			xLabel="time in the flask (powers of ten)"
		/>
		{#if logGhost}
			<path
				d={logGhost}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<Readout id="ghost">
				<Label
					x={lx(3.4)}
					y={syC(eqNow.hi * 1000 * 0.45)}
					text="no catalyst"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
		<path d={logNow} fill="none" stroke="var(--rr-hi)" stroke-width="2.6" />
		<line
			x1={PL.x}
			x2={PL.x + PL.w}
			y1={syC(eqNow.hi * 1000)}
			y2={syC(eqNow.hi * 1000)}
			stroke="var(--rr-hi)"
			stroke-dasharray="2 4"
			opacity="0.7"
		/>
		<circle
			cx={logDot.x}
			cy={logDot.y}
			r="5"
			fill="var(--rr-hi)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{:else}
		<Axes
			{sx}
			sy={plot === 'rates' ? syR : syC}
			xTicks={timeTicks}
			xLabel="time in the flask, {unit.name}"
			yLabel={plot === 'rates' ? 'rate, µmol L⁻¹ s⁻¹' : 'mmol/L'}
		/>
		{#if plot === 'conc'}
			<line
				x1={PL.x}
				x2={PL.x + PL.w}
				y1={syC(eqNow.hi * 1000)}
				y2={syC(eqNow.hi * 1000)}
				stroke="var(--rr-hi)"
				stroke-dasharray="2 4"
				opacity="0.7"
			/>
			<Readout id="eq-line">
				<Label
					x={PL.x + PL.w}
					y={syC(eqNow.hi * 1000) - 7}
					text="HI at equilibrium"
					size={11}
					anchor="end"
					color="var(--rr-hi)"
				/>
			</Readout>
		{/if}
		{#each series as s (s.id)}
			<path
				d={s.d}
				fill="none"
				stroke={s.color}
				stroke-width="2.4"
				stroke-linejoin="round"
				stroke-dasharray={s.id === 'i2' || s.id === 'reverse' ? '7 5' : 'none'}
			/>
		{/each}
	{/if}
	<Readout id="legend">
		{#if plot === 'rates'}
			<text x={PL.x + PL.w} y={PL.y - 12} text-anchor="end" style:font-size="12px"
				><tspan fill="var(--rr-forward)" font-weight="600">forward</tspan>
				<tspan fill="var(--rr-reverse)" font-weight="600">reverse</tspan></text
			>
		{:else if plot === 'conc'}
			<text x={PL.x + PL.w} y={PL.y - 12} text-anchor="end" style:font-size="12px"
				><tspan fill="var(--rr-h2)" font-weight="600">H₂</tspan>
				<tspan fill="var(--rr-i2)" font-weight="600">I₂</tspan>
				<tspan fill="var(--rr-hi)" font-weight="600">HI</tspan></text
			>
		{/if}
	</Readout>

	<!-- the step's numbers -->
	{#if focus === 'rate' || focus === 'concentration'}
		<Readout
			id="rate"
			order={4}
			label="Rate now"
			value="{fmtRate(micro(now.forward))} µmol L⁻¹ s⁻¹"
			color="var(--rr-forward)"
		>
			<text x={PL.x - 4} y={556} style:font-size="14px"
				>rate = k[H₂][I₂] = <tspan font-weight="600" fill="var(--rr-forward)"
					>{fmtRate(micro(now.forward))}</tspan
				> µmol L⁻¹ s⁻¹</text
			>
		</Readout>
		<Readout
			id="rate2"
			order={5}
			label={focus === 'rate' ? 'Half of the H₂ gone after' : 'Rate at the start'}
			value={focus === 'rate' ? fmtTime(halfNow) : `${fmtRate(micro(run[0].forward))} µmol L⁻¹ s⁻¹`}
		>
			<text x={PL.x - 4} y={580} style:font-size="13px" class="muted"
				>{focus === 'rate'
					? `k = ${sig(kForward(now.T))} L mol⁻¹ s⁻¹ · half of the H₂ gone after ${fmtTime(halfNow)}`
					: `at the start: ${fmtRate(micro(run[0].forward))} µmol L⁻¹ s⁻¹`}</text
			>
		</Readout>
	{:else if focus === 'temperature' || focus === 'catalyst'}
		<Readout
			id="k"
			order={4}
			label="Rate constant k"
			value="{fmtRate(kForward(now.T, now.lowering))} L mol⁻¹ s⁻¹"
			note="{sig(kRel, 2)} × the value at 700 K without a catalyst"
		>
			<text x={PL.x - 4} y={556} style:font-size="14px"
				>k = <tspan font-weight="600">{fmtRate(kForward(now.T, now.lowering))}</tspan> L mol⁻¹ s⁻¹ ·
				<tspan font-weight="600" fill="var(--rr-forward)"
					>×{kRel >= 1000 ? fmtPow(kRel) : sig(kRel, 2)}</tspan
				>
				vs 700 K{focus === 'catalyst' ? ', no catalyst' : ''}</text
			>
		</Readout>
		<Readout id="half" order={5} label="Half of the H₂ gone after" value={fmtTime(halfNow)}>
			<text x={PL.x - 4} y={580} style:font-size="13px" class="muted"
				>half of the H₂ gone after {fmtTime(halfNow)}</text
			>
		</Readout>
	{:else if focus === 'reverse'}
		<Readout
			id="rates"
			order={4}
			label="Forward · reverse"
			value="{fmtRate(micro(now.forward))} · {fmtRate(micro(now.reverse))} µmol L⁻¹ s⁻¹"
		>
			<text x={PL.x - 4} y={556} style:font-size="14px"
				><tspan fill="var(--rr-forward)" font-weight="600"
					>forward {fmtRate(micro(now.forward))}</tspan
				>
				·
				<tspan fill="var(--rr-reverse)" font-weight="600"
					>reverse {fmtRate(micro(now.reverse))}</tspan
				> µmol L⁻¹ s⁻¹</text
			>
		</Readout>
	{:else}
		<Readout
			id="qk"
			order={4}
			label="Q now · K"
			value="{fmtQ(Q)} · {sig(K, 2)}"
			note={Math.abs(Q / K - 1) < 0.03
				? 'at equilibrium'
				: Q < K
					? 'Q < K: the forward reaction wins'
					: 'Q > K: the reverse reaction wins'}
		>
			<text x={PL.x - 4} y={556} style:font-size="14px"
				>Q = [HI]²/[H₂][I₂] = <tspan font-weight="600">{fmtQ(Q)}</tspan><tspan dx="14">K =</tspan
				><tspan dx="5" font-weight="600">{sig(K, 2)}</tspan><tspan
					dx="14"
					class="muted"
					fill="var(--stage-ink-muted)"
					>{Math.abs(Q / K - 1) < 0.03
						? 'at equilibrium'
						: Q < K
							? 'Q < K: forward wins'
							: 'Q > K: reverse wins'}</tspan
				></text
			>
		</Readout>
		<Readout
			id="share"
			order={5}
			label="Iodine in HI"
			value="{Math.round(hiShare(now) * 100)} %"
			note="forward {fmtRate(micro(now.forward))} · reverse {fmtRate(
				micro(now.reverse)
			)} µmol L⁻¹ s⁻¹"
		>
			<text x={PL.x - 4} y={580} style:font-size="13px" class="muted"
				>iodine in HI: {Math.round(hiShare(now) * 100)} % · rates:
				<tspan fill="var(--rr-forward)">{fmtRate(micro(now.forward))}</tspan>
				/ <tspan fill="var(--rr-reverse)">{fmtRate(micro(now.reverse))}</tspan> µmol L⁻¹ s⁻¹</text
			>
		</Readout>
	{/if}
</g>
