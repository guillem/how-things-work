<script lang="ts">
	/**
	 * The reactor in time: point kinetics with six groups of delayed neutrons
	 * (model.ts).
	 *
	 * Views (`step.hints.view`):
	 *   delayed — a step of +0.1% in k at time 0: the power with delayed neutrons
	 *             (prompt jump, then a 55 s period) against the same step with
	 *             every neutron prompt (a 0.1 s period, off the log chart in
	 *             under a second). The `delayed` toggle picks which is "this
	 *             reactor"; the other stays faint for comparison. Both curves
	 *             are computed once; a cursor sweeps them as a function of t.
	 *   operate — the reader's reactor, live: the `bank` slider sets the
	 *             reactivity, "Scram" drops every rod, "Start again" resets to
	 *             steady full power. The equations are integrated frame by frame
	 *             (the documented accumulator exception: the power is the
	 *             integral of a rate the reader changes), ignoring dt ≤ 0 and
	 *             capping a frame at 0.1 s; under reduced motion the frame is the
	 *             steady reactor at 100%.
	 *   decay   — decay heat after a shutdown on a log time axis, and the scale
	 *             of a 3 GW plant.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BETA,
		PLANT_EFFICIENCY,
		PLANT_HEAT,
		POWER_TRIP,
		SCRAM_REACTIVITY,
		advance,
		bankReactivity,
		decayHeat,
		fissionsPerSecond,
		inhour,
		promptOnlyRate,
		steady,
		u235PerDay,
		type Kinetics
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'delayed'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));

	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
	const fmtTime = (s: number) =>
		s < 1 ? `${fmt(s, 2)} s` : s < 120 ? `${fmt(s, s < 10 ? 1 : 0)} s` : `${fmt(s / 60, 1)} min`;

	// ---- delayed view ------------------------------------------------------------
	const STEP_RHO = 0.001;
	const D_END = 60;
	const delayedOn = $derived(offered.has('delayed') ? Boolean(params.delayed) : true);
	const withDelayed = (() => {
		const out = [{ t: 0, p: 1 }];
		let s = steady();
		const dt = 0.02;
		for (let i = 1; i <= D_END / dt; i++) {
			s = advance(s, STEP_RHO, dt);
			if (i < 10 || i % 10 === 0) out.push({ t: i * dt, p: s.power });
		}
		return out;
	})();
	const promptRate = promptOnlyRate(STEP_RHO);
	const LOG_MAX = 4; // ×10,000 at the top of the chart
	const tOff = (LOG_MAX * Math.LN10) / promptRate; // when the prompt-only curve leaves the chart
	const promptOnly = Array.from({ length: 41 }, (_, i) => {
		const tt = (i / 40) * tOff;
		return { t: tt, p: Math.exp(promptRate * tt) };
	});
	const DX0 = 110;
	const DX1 = 900;
	const DY0 = 130;
	const DY1 = 440;
	const dsx = scale([0, D_END], [DX0, DX1]);
	const dsy = scale([0, LOG_MAX], [DY1, DY0]);
	const SWEEP = 12; // seconds of animation for the 60 s shown
	const cursor = $derived(reduced ? D_END : clamp(((t - 0.6) / SWEEP) * D_END, 0, D_END));
	const pathUpTo = (pts: { t: number; p: number }[], until: number) =>
		linePath(
			pts.filter((p) => p.t <= until),
			(p) => p.t,
			(p) => Math.log10(p.p),
			dsx,
			dsy
		);
	// The prompt-only curve races off the chart in under a second of the 60.
	const promptCursor = $derived(reduced ? tOff : Math.min(tOff, cursor * 6));
	const delayedPath = $derived(pathUpTo(withDelayed, cursor));
	const promptPath = $derived(pathUpTo(promptOnly, promptCursor));
	const pAt = (sec: number) => {
		let best = withDelayed[0];
		for (const p of withDelayed) if (p.t <= sec) best = p;
		return best.p;
	};
	const periodDelayed = 1 / inhour(STEP_RHO);

	// ---- operate view -----------------------------------------------------------
	const bank = $derived(offered.has('bank') ? Number(params.bank) / 100 : 0.5);
	const scrams = $derived(Number(params.scram ?? 0));
	const restarts = $derived(Number(params.restart ?? 0));
	const HISTORY = 60; // seconds shown
	let state: Kinetics = steady();
	let simTime = 0;
	let lastT = -1;
	let scrammed = false;
	let tripped = false;
	let seenScram = -1;
	let seenRestart = -1;
	let history: { t: number; p: number }[] = [];
	const live = $derived.by(() => {
		if (view !== 'operate' || reduced) return null;
		const rho0 = scrammed ? SCRAM_REACTIVITY : bankReactivity(bank);
		if (seenRestart !== restarts || t < lastT || lastT < 0) {
			if (seenRestart !== restarts || lastT < 0 || t < lastT) {
				state = steady();
				simTime = 0;
				scrammed = false;
				tripped = false;
				history = [{ t: 0, p: 1 }];
				seenScram = scrams;
			}
			seenRestart = restarts;
			lastT = t;
		}
		if (scrams !== seenScram) {
			scrammed = true;
			seenScram = scrams;
		}
		const rho = scrammed ? SCRAM_REACTIVITY : rho0;
		const dt = Math.min(0.1, t - lastT);
		lastT = t;
		if (dt > 0) {
			state = advance(state, rho, dt);
			simTime += dt;
			if (!scrammed && state.power > POWER_TRIP) {
				scrammed = true;
				tripped = true;
			}
			const last = history[history.length - 1];
			if (simTime - last.t >= 0.2) {
				history.push({ t: simTime, p: state.power });
				if (history.length > 400) history = history.slice(-320);
			}
		}
		return { power: state.power, time: simTime, rho, scrammed, tripped, history };
	});
	const opPower = $derived(live ? live.power : 1);
	const opTime = $derived(live ? live.time : HISTORY);
	const opRho = $derived(live ? live.rho : bankReactivity(bank));
	const opHistory = $derived(
		live
			? live.history
			: [
					{ t: 0, p: 1 },
					{ t: HISTORY, p: 1 }
				]
	);
	const OX0 = 110;
	const OX1 = 700;
	const OY0 = 150;
	const OY1 = 450;
	const t0 = $derived(Math.max(0, opTime - HISTORY));
	const osx = $derived(scale([t0, t0 + HISTORY], [OX0, OX1]));
	const PMAX = 2;
	const osy = scale([0, PMAX], [OY1, OY0]);
	const opPath = $derived(
		linePath(
			opHistory.filter((h) => h.t >= t0).concat([{ t: opTime, p: opPower }]),
			(h) => h.t,
			(h) => Math.min(PMAX, h.p),
			osx,
			osy
		)
	);
	const omega = $derived(Math.abs(opRho) < 1e-7 ? 0 : inhour(opRho));
	const trend = $derived.by(() => {
		if (live?.scrammed)
			return live.tripped
				? `automatic trip at ${fmt(POWER_TRIP * 100)}%: shut down, the chain has stopped`
				: 'shut down: the chain has stopped';
		if (omega === 0) return 'steady';
		const per = Math.abs(1 / omega) * Math.LN2;
		return omega > 0
			? `rising, settling to doubling every ${fmtTime(per)}`
			: `falling, settling to halving every ${fmtTime(per)}`;
	});
	const trendColour = $derived(
		live?.scrammed
			? 'var(--fi-sub)'
			: omega > 1e-6
				? 'var(--fi-super)'
				: omega < -1e-6
					? 'var(--fi-sub)'
					: 'var(--fi-crit)'
	);
	const opXTicks = $derived(
		Array.from({ length: 7 }, (_, i) => Math.ceil(t0 / 10) * 10 + i * 10).filter(
			(v) => v <= t0 + HISTORY
		)
	);

	// ---- decay view -------------------------------------------------------------
	const KX0 = 110;
	const KX1 = 640;
	const KY0 = 140;
	const KY1 = 450;
	const LT0 = 0; // 10⁰ s
	const LT1 = Math.log10(30 * 86400);
	const ksx = scale([LT0, LT1], [KX0, KX1]);
	const ksy = scale([0, 7], [KY1, KY0]);
	const decayPts = Array.from({ length: 121 }, (_, i) => {
		const lt = LT0 + ((LT1 - LT0) * i) / 120;
		return { lt, p: 100 * decayHeat(10 ** lt) };
	});
	const decayCursor = $derived(reduced ? LT1 : LT0 + (LT1 - LT0) * clamp((t - 0.6) / 10));
	const decayPath = $derived(
		linePath(
			decayPts.filter((d) => d.lt <= decayCursor),
			(d) => d.lt,
			(d) => d.p,
			ksx,
			ksy
		)
	);
	const MARKS = [
		{ id: 's', sec: 1, label: '1 second' },
		{ id: 'h', sec: 3600, label: '1 hour' },
		{ id: 'd', sec: 86400, label: '1 day' },
		{ id: 'm', sec: 30 * 86400, label: '1 month' }
	];
	const timeTicks = [
		{ v: 0, l: '1 s' },
		{ v: Math.log10(60), l: '1 min' },
		{ v: Math.log10(3600), l: '1 h' },
		{ v: Math.log10(86400), l: '1 day' },
		{ v: Math.log10(7 * 86400), l: '1 wk' }
	];
	const mw = (share: number) => (share * PLANT_HEAT) / 1e6;
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

<g opacity={fadeIn}>
	{#if view === 'delayed'}
		<Readout id="d-title">
			<text x={DX0 - 50} y={70} style:font-size="16px" font-weight="600"
				>Power after k goes up by 0.1% (k = 1.001)</text
			>
			<text x={DX0 - 50} y={90} class="muted">relative to the power before, log scale</text>
		</Readout>
		<Axes
			sx={dsx}
			sy={dsy}
			xLabel="seconds"
			xTicks={[0, 10, 20, 30, 40, 50, 60]}
			yTicks={[0, 1, 2, 3, 4]}
			yFormat={(v) => `×${fmt(10 ** v)}`}
		/>
		<path
			d={promptPath}
			fill="none"
			stroke="var(--fi-super)"
			stroke-width={delayedOn ? 1.6 : 3}
			stroke-dasharray={delayedOn ? '5 5' : undefined}
			opacity={delayedOn ? 0.55 : 1}
		/>
		<path
			d={delayedPath}
			fill="none"
			stroke="var(--fi-crit)"
			stroke-width={delayedOn ? 3 : 1.6}
			stroke-dasharray={delayedOn ? undefined : '5 5'}
			opacity={delayedOn ? 1 : 0.55}
		/>
		{#if promptCursor >= tOff}
			<Label
				x={dsx(tOff) + 8}
				y={DY0 + 4}
				text="no delayed neutrons: off the chart after {fmtTime(tOff)} ↑"
				anchor="start"
				color="var(--fi-super)"
				opacity={delayedOn ? 0.7 : 1}
			/>
		{/if}
		<Label
			x={dsx(Math.min(Math.max(cursor, 24), 56))}
			y={dsy(Math.log10(pAt(Math.min(Math.max(cursor, 24), 56)))) - 14}
			text="with delayed neutrons"
			anchor="end"
			color="var(--fi-crit)"
			opacity={delayedOn ? 1 : 0.7}
		/>
		<Readout
			id="d-now"
			order={1}
			label="This reactor"
			value={delayedOn ? 'with delayed neutrons' : 'every neutron prompt'}
			color={delayedOn ? 'var(--fi-crit)' : 'var(--fi-super)'}
		>
			<text
				x={DX0 - 50}
				y={500}
				style:font-size="17px"
				font-weight="700"
				style:fill={delayedOn ? 'var(--fi-crit)' : 'var(--fi-super)'}
				>{delayedOn ? 'With delayed neutrons (β = 0.65%)' : 'If every neutron were prompt'}</text
			>
		</Readout>
		<Readout
			id="d-detail"
			order={2}
			label={delayedOn ? 'After 1 s' : 'After 1 s'}
			value={delayedOn
				? `×${fmt(pAt(1), 2)}; ×e every ${fmt(periodDelayed)} s`
				: `×${fmt(Math.exp(promptRate))}; ×e every ${fmt(1 / promptRate, 1)} s`}
		>
			<text x={DX0 - 50} y={526} style:font-variant-numeric="tabular-nums"
				>{delayedOn
					? `after 1 s: ×${fmt(pAt(1), 2)} (the prompt jump), then ×e (2.7) every ${fmt(periodDelayed)} s`
					: `after 1 s: ×${fmt(Math.exp(promptRate))}, ×e every ${fmt(1 / promptRate, 1)} s — far too fast to steer`}</text
			>
		</Readout>
		<Readout id="d-time" order={3} label="Time" value="{fmt(cursor, 0)} s">
			<text
				x={DX1}
				y={500}
				text-anchor="end"
				class="muted"
				style:font-variant-numeric="tabular-nums">{fmt(cursor, 0)} s · ×{fmt(pAt(cursor), 2)}</text
			>
		</Readout>
	{:else if view === 'operate'}
		<Readout id="o-title">
			<text x={OX0 - 50} y={70} style:font-size="16px" font-weight="600">Reactor power</text>
			<text x={OX0 - 50} y={90} class="muted">last 60 seconds · 100% = 3 GW of heat</text>
		</Readout>
		<Axes
			sx={osx}
			sy={osy}
			xLabel="seconds"
			xTicks={opXTicks}
			yTicks={[0, 0.5, 1, 1.5, 2]}
			yFormat={(v) => `${fmt(v * 100)}%`}
		/>
		<line
			x1={OX0}
			x2={OX1}
			y1={osy(1)}
			y2={osy(1)}
			stroke="var(--fi-crit)"
			stroke-dasharray="3 4"
			opacity="0.7"
		/>
		<path d={opPath} fill="none" stroke={trendColour} stroke-width="2.6" stroke-linejoin="round" />
		{#if opPower > PMAX}
			<Label x={OX1} y={OY0 - 10} text="above 200% ↑" anchor="end" color="var(--fi-super)" />
		{/if}

		<!-- the core and its rods -->
		<g>
			<rect
				x={760}
				y={170}
				width={150}
				height={220}
				rx="10"
				fill="var(--fi-water)"
				stroke="var(--fi-water-edge)"
			/>
			{#each [0, 1, 2, 3, 4] as i (i)}
				<rect
					x={772 + i * 28}
					y={182}
					width={14}
					height={196}
					rx="5"
					fill="var(--fi-fuel)"
					stroke="var(--fi-fuel-edge)"
				/>
			{/each}
			{#each [0, 1, 2, 3] as j (j)}
				<rect
					x={790 + j * 28}
					y={150}
					width={8}
					height={20 + 200 * (live?.scrammed ? 1 : bank)}
					rx="2"
					fill="var(--fi-rod)"
				/>
			{/each}
			<Readout
				id="rods"
				order={3}
				label="Control rods"
				value={live?.scrammed ? 'all dropped in' : `${fmt(bank * 100)}% in`}
			>
				<text x={835} y={414} text-anchor="middle" class="muted"
					>{live?.scrammed ? 'all rods dropped in' : `rods ${fmt(bank * 100)}% in`}</text
				>
			</Readout>
		</g>

		<Readout
			id="power"
			order={1}
			label="Fission power"
			value="{fmt(opPower * 100, 1)}% · {fmt((opPower * PLANT_HEAT) / 1e9, 2)} GW"
			color={trendColour}
		>
			<text
				x={OX0 - 50}
				y={508}
				style:font-size="26px"
				font-weight="700"
				style:fill={trendColour}
				style:font-variant-numeric="tabular-nums">{fmt(opPower * 100, 1)}%</text
			>
			<text x={OX0 + 120} y={508} style:font-variant-numeric="tabular-nums"
				>{fmt((opPower * PLANT_HEAT) / 1e9, 2)} GW from fission</text
			>
		</Readout>
		<Readout
			id="trend"
			order={2}
			label="Trend"
			value={trend}
			note="k − 1 ≈ {(opRho * 100).toFixed(2)}% (β = {(BETA * 100).toFixed(2)}%)"
		>
			<text x={OX0 - 50} y={536} style:fill={trendColour}>{trend}</text>
			<text
				x={OX0 - 50}
				y={558}
				class="muted"
				style:font-size="11px"
				style:font-variant-numeric="tabular-nums"
				>k − 1 ≈ {opRho >= 0 ? '+' : ''}{(opRho * 100).toFixed(2)}% · delayed neutrons β = {(
					BETA * 100
				).toFixed(2)}%</text
			>
		</Readout>
	{:else}
		<Readout id="k-title">
			<text x={KX0 - 50} y={70} style:font-size="16px" font-weight="600"
				>Decay heat after a shutdown</text
			>
			<text x={KX0 - 50} y={90} class="muted"
				>share of full power, after a year at full power (Way–Wigner)</text
			>
		</Readout>
		<Axes
			sx={ksx}
			sy={ksy}
			xLabel="time since shutdown (log scale)"
			xTicks={timeTicks.map((x) => x.v)}
			xFormat={(v) => timeTicks.find((x) => Math.abs(x.v - v) < 1e-9)?.l ?? ''}
			yTicks={[0, 1, 2, 3, 4, 5, 6, 7]}
			yFormat={(v) => `${v}%`}
		/>
		<path d={decayPath} fill="none" stroke="var(--fi-energy)" stroke-width="2.6" />
		{#each MARKS as m (m.id)}
			{@const lt = Math.log10(m.sec)}
			{@const share = decayHeat(m.sec)}
			{#if lt <= decayCursor + 1e-9}
				<circle cx={ksx(lt)} cy={ksy(100 * share)} r="4.5" fill="var(--fi-energy)" />
				<Readout
					id="mark-{m.id}"
					order={10 + MARKS.indexOf(m)}
					label="After {m.label}"
					value="{fmt(100 * share, share < 0.01 ? 2 : 1)}% · {fmt(mw(share))} MW"
				>
					<Label
						x={ksx(lt) + (m.id === 'm' ? -6 : 8)}
						y={ksy(100 * share) - 12}
						text="{fmt(100 * share, share < 0.01 ? 2 : 1)}% · {fmt(mw(share))} MW"
						anchor={m.id === 'm' ? 'end' : 'start'}
					/>
				</Readout>
			{/if}
		{/each}

		<!-- the plant -->
		<g style:font-variant-numeric="tabular-nums">
			<Readout id="plant-card"
				><rect
					x={680}
					y={130}
					width={240}
					height={250}
					rx="12"
					fill="var(--surface)"
					stroke="var(--border)"
				/></Readout
			>
			<Readout id="plant-title">
				<text x={700} y={160} font-weight="600">A large plant at full power</text>
			</Readout>
			<Readout id="heat" order={1} label="Heat" value="{fmt(PLANT_HEAT / 1e9)} GW">
				<text x={700} y={192} class="muted">heat from the core</text>
				<text x={900} y={192} text-anchor="end" font-weight="600">{fmt(PLANT_HEAT / 1e9)} GW</text>
			</Readout>
			<Readout
				id="elec"
				order={2}
				label="Electricity"
				value="≈ {fmt((PLANT_HEAT * PLANT_EFFICIENCY) / 1e9)} GW"
			>
				<text x={700} y={220} class="muted">electricity (about ⅓)</text>
				<text x={900} y={220} text-anchor="end" font-weight="600"
					>≈ {fmt((PLANT_HEAT * PLANT_EFFICIENCY) / 1e9)} GW</text
				>
			</Readout>
			<Readout
				id="fps"
				order={3}
				label="Fissions per second"
				value="{fmt(fissionsPerSecond(PLANT_HEAT) / 1e19, 1)} × 10¹⁹"
			>
				<text x={700} y={248} class="muted">fissions per second</text>
				<text x={900} y={248} text-anchor="end" font-weight="600"
					>{fmt(fissionsPerSecond(PLANT_HEAT) / 1e19, 1)} × 10¹⁹</text
				>
			</Readout>
			<Readout
				id="kg"
				order={4}
				label="Fissile nuclei split"
				value="{fmt(u235PerDay(PLANT_HEAT), 1)} kg a day"
			>
				<text x={700} y={276} class="muted">fissile nuclei split</text>
				<text x={900} y={276} text-anchor="end" font-weight="600"
					>{fmt(u235PerDay(PLANT_HEAT), 1)} kg/day</text
				>
			</Readout>
			<line x1={700} x2={900} y1={296} y2={296} stroke="var(--border)" />
			<Readout id="plant-note"
				><text x={700} y={320} class="muted" style:font-size="12px"
					>after a scram, the fragments</text
				>
				<text x={700} y={338} class="muted" style:font-size="12px"
					>still give {fmt(mw(decayHeat(1)))} MW, falling slowly:</text
				>
				<text x={700} y={356} class="muted" style:font-size="12px"
					>the core must be cooled for days</text
				></Readout
			>
		</g>
	{/if}
</g>
