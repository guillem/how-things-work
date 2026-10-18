<script lang="ts">
	/**
	 * A whole dish flooded with attractant at once (../model.ts `uniformResponse`): three plots
	 * against time, the concentration, the receptors' activity with their methylation, and the
	 * tumbles of 1000 cells counted in 2 s windows (bars) with the rate the model expects (line).
	 *
	 * Focus (`step.hints.focus`): 'flood' (20 µM, then the `dose` control from 10 s), 'stairs'
	 * (20 → 40 → 80 µM, then washed back to 20; controls `tau` and `adapt`), 'ramp' (a rise from 100 µM by
	 * `ramp` % per second from 10 s to 130 s). The plots draw themselves SPEED times faster than
	 * real time and then hold; reduced motion shows the whole run.
	 */
	import { Axes, Label, linePath, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MWC, TAU, uniformResponse } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'flood'));
	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const dose = $derived(offers('dose') ? Number(params.dose ?? 40) : 40);
	const tau = $derived(offers('tau') ? Number(params.tau ?? TAU) : TAU);
	const adapt = $derived(offers('adapt') ? params.adapt !== false : true);
	const ramp = $derived(offers('ramp') ? Number(params.ramp ?? 0.5) / 100 : 0.005);

	const plan = $derived.by(() => {
		if (focus === 'stairs')
			return {
				until: 240,
				speed: 8,
				c: (s: number) => (s < 10 ? 20 : s < 80 ? 40 : s < 150 ? 80 : 20),
				events: [
					{ at: 10, text: '→ 40 µM' },
					{ at: 80, text: '→ 80 µM' },
					{ at: 150, text: 'washed to 20 µM' }
				]
			};
		if (focus === 'ramp')
			return {
				until: 200,
				speed: 6,
				c: (s: number) => 100 * Math.exp(ramp * Math.min(120, Math.max(0, s - 10))),
				events: [
					{ at: 10, text: 'rise starts' },
					{ at: 130, text: 'rise stops' }
				]
			};
		return {
			until: 240,
			speed: 8,
			c: (s: number) => (s < 10 ? 20 : dose),
			events: [{ at: 10, text: `flooded to ${dose} µM` }]
		};
	});

	/** Every 0.5 s: concentration, activity, methylation, and tumbles (computed per setting). */
	const data = $derived(
		uniformResponse({ c: plan.c, until: plan.until, tau, adapt, n: 1000, every: 0.5 })
	);
	/** Tumbles in 2 s windows. */
	const bins = $derived.by(() => {
		const out: { t: number; rate: number }[] = [];
		for (let i = 0; i + 3 < data.length; i += 4) {
			let s = 0;
			for (let j = 0; j < 4; j++) s += data[i + j].rate;
			out.push({ t: data[i + 3].t, rate: s / 4 });
		}
		return out;
	});

	const now = $derived(reduced ? plan.until : Math.min(plan.until, t * plan.speed));
	const shown = $derived(data.filter((d) => d.t <= now));
	const shownBins = $derived(bins.filter((b) => b.t <= now));
	const last = $derived(shown.at(-1) ?? data[0]);

	// ---- layout -------------------------------------------------------------------------------
	const X0 = 90;
	const X1 = 820;
	const VX = X1 + 40;
	const sx = $derived(scale([0, plan.until], [X0, X1]));
	const cMax = $derived(Math.max(...data.map((d) => d.c)));
	const cTop = $derived(niceMax(cMax));
	const syC = $derived(scale([0, cTop], [140, 56]));
	const aTop = $derived(Math.max(...data.map((d) => d.a)) > 0.48 ? 1 : 0.5);
	const syA = $derived(scale([0, aTop], [318, 196]));
	/** Methylation on its own (right) scale, in half-steps around its range. */
	const mLo = $derived(Math.floor(2 * Math.min(...data.map((d) => d.m)) - 0.2) / 2);
	const mHi = $derived(
		Math.max(mLo + 1, Math.ceil(2 * Math.max(...data.map((d) => d.m)) + 0.2) / 2)
	);
	const syM = $derived(scale([mLo, mHi], [318, 196]));
	const rateTop = $derived(Math.max(1.5, Math.ceil(Math.max(...bins.map((b) => b.rate)) + 0.2)));
	const syR = $derived(scale([0, rateTop], [520, 380]));
	const barW = $derived(sx(2) - sx(0) - 1);

	const cPath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => d.c,
			sx,
			syC
		)
	);
	const aPath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => d.a,
			sx,
			syA
		)
	);
	const mPath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => d.m,
			sx,
			syM
		)
	);
	const ePath = $derived(
		linePath(
			shown,
			(d) => d.t,
			(d) => d.expected,
			sx,
			syR
		)
	);

	const rateNow = $derived(shownBins.at(-1)?.rate ?? 1);
	const fmtT = (s: number) => `${Math.round(s)} s`;
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="1000 cells"
		value="t = {fmtT(now)}, plotted {plan.speed}× faster"
	>
		<Label
			x={24}
			y={30}
			text="a whole dish at once · 1000 cells · t = {fmtT(
				now
			)} (plotted {plan.speed}× faster than real time)"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- events -->
	{#each plan.events as e (e.at)}
		<line
			x1={sx(e.at)}
			x2={sx(e.at)}
			y1={52}
			y2={520}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>
		<Readout id="ev-{e.at}">
			<Label x={sx(e.at) + 5} y={50} text={e.text} size={11} anchor="start" muted />
		</Readout>
	{/each}

	<!-- concentration -->
	<Axes {sx} sy={syC} xTicks={[]} yTicks={[0, cTop / 2, cTop]} />
	<path d={cPath} fill="none" stroke="var(--bc-attract)" stroke-width="2.2" />
	<Readout
		id="c"
		order={2}
		label="Attractant (MeAsp)"
		value="{last.c.toFixed(0)} µM"
		color="var(--bc-attract)"
	>
		<Label
			x={VX}
			y={syC(last.c) + 4}
			text="{last.c.toFixed(0)} µM"
			size={12}
			anchor="start"
			color="var(--bc-attract)"
			weight={600}
			tabular
		/>
		<Label x={X0 + 8} y={64} text="attractant, µM" size={11} anchor="start" muted />
	</Readout>

	<!-- activity and methylation -->
	<Axes {sx} sy={syA} xTicks={[]} yTicks={[0, aTop / 2, aTop]} />
	<Axes {sx} sy={syM} xTicks={[]} yTicks={[mLo, (mLo + mHi) / 2, mHi]} yRight grid={false} />
	<line
		x1={X0}
		x2={X1}
		y1={syA(MWC.a0)}
		y2={syA(MWC.a0)}
		stroke="var(--bc-activity)"
		stroke-dasharray="4 4"
		opacity="0.5"
	/>
	<path d={mPath} fill="none" stroke="var(--bc-methyl)" stroke-width="2" />
	<path d={aPath} fill="none" stroke="var(--bc-activity)" stroke-width="2.4" />
	<Readout
		id="a"
		order={3}
		label="Receptor activity"
		value="{last.a.toFixed(2)} (rest 0.33)"
		color="var(--bc-activity)"
	>
		<Label
			x={VX}
			y={Math.min(syA(last.a), syM(last.m) - 16) + 4}
			text="activity {last.a.toFixed(2)}"
			size={12}
			anchor="start"
			color="var(--bc-activity)"
			weight={600}
			tabular
		/>
		<Label x={X0 + 8} y={206} text="activity (dashed: at rest, ⅓)" size={11} anchor="start" muted />
	</Readout>
	<Readout
		id="m"
		order={4}
		label="Methylation"
		value="{last.m.toFixed(2)} per receptor"
		color="var(--bc-methyl)"
	>
		<Label
			x={VX}
			y={Math.max(syM(last.m), syA(last.a) + 16) + 4}
			text="methyl {last.m.toFixed(2)}"
			size={12}
			anchor="start"
			color="var(--bc-methyl)"
			weight={600}
			tabular
		/>
		<Label
			x={X0 + 8}
			y={222}
			text="methyl groups per receptor (right scale)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- tumbles -->
	<Axes {sx} sy={syR} xLabel="seconds" />
	{#each shownBins as b (b.t)}
		<rect
			x={sx(b.t - 2) + 0.5}
			y={syR(b.rate)}
			width={barW}
			height={Math.max(0, syR(0) - syR(b.rate))}
			fill="var(--bc-tumble)"
			opacity="0.55"
		/>
	{/each}
	<path d={ePath} fill="none" stroke="var(--bc-tumble)" stroke-width="2" />
	<Readout
		id="r"
		order={5}
		label="Tumbles per cell per second"
		value={rateNow.toFixed(2)}
		color="var(--bc-tumble)"
	>
		<Label
			x={VX}
			y={syR(Math.min(rateTop, rateNow)) + 4}
			text="{rateNow.toFixed(2)} /s"
			size={12}
			anchor="start"
			color="var(--bc-tumble)"
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="r-key">
		<Label
			x={X0 + 8}
			y={392}
			text="tumbles per cell per second: bars counted, line expected"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
	{#if !adapt}
		<Readout id="off" order={6} label="Methylation" value="switched off">
			<Label x={480} y={180} text="methylation switched off" size={13} weight={600} pill />
		</Readout>
	{/if}
</g>
