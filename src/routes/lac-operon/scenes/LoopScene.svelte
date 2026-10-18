<script lang="ts">
	/**
	 * The steady states of the lac switch against the inducer outside the cell (../model.ts
	 * `steadyStates`, `thresholds`), log–log: stable branches solid, the tipping points dashed,
	 * the bistable range shaded. One cell, uninduced at first, follows a slow sweep of the inducer
	 * from 0.5 µM to 3 mM and back (`sweep`): its path up in one colour, down in another.
	 *
	 * Hints: `inducer` 'tmg' | 'lactose'. Control `gluc` (µM; cells on succinate) on the steps
	 * that offer it; then the curve without glucose stays as a faint reference, and on the
	 * lactose step the TMG curve does. The sweep plays in SWEEP seconds and then holds; reduced
	 * motion shows it complete.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MEASURED, steadyStates, sweep, thresholds, type Medium } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const inducer = $derived(step.hints?.inducer === 'lactose' ? 'lactose' : 'tmg');
	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const glucose = $derived(offers('gluc') ? Number(params.gluc ?? 0) : 0);

	// ---- layout ---------------------------------------------------------------------------------
	const C0 = -0.5;
	const C1 = 3.6;
	const X0 = 100;
	const X1 = 700;
	const sx = scale([C0, C1], [X0, X1]);
	const sy = scale([-1.3, 2.2], [520, 80]);
	const fmtC = (v: number) => (v === 3 ? '1000' : String(10 ** v));
	const fmtY = (v: number) => String(10 ** v);

	interface Curves {
		lower: string;
		upper: string;
		middle: string;
		range: { off: number; on: number } | null;
	}

	/** The branches of steady states as SVG paths, at one glucose level and inducer. */
	function curves(ind: Medium['inducer'], G: number): Curves {
		const range = thresholds(G, ind);
		const lower: [number, number][] = [];
		const upper: [number, number][] = [];
		const middle: [number, number][] = [];
		const N = 140;
		const cs: number[] = [];
		for (let i = 0; i <= N; i++) cs.push(C0 + ((C1 - C0) * i) / N);
		if (range) cs.push(Math.log10(range.off) + 1e-4, Math.log10(range.on) - 1e-4);
		cs.sort((a, b) => a - b);
		for (const lc of cs) {
			const ss = steadyStates({ inducer: ind, c: 10 ** lc, glucose: G });
			const pt = (y: number): [number, number] => [sx(lc), sy(Math.log10(y))];
			if (ss.length === 3) {
				lower.push(pt(ss[0].y));
				middle.push(pt(ss[1].y));
				upper.push(pt(ss[2].y));
			} else if (range && 10 ** lc >= range.on) upper.push(pt(ss[0].y));
			else lower.push(pt(ss[0].y));
		}
		const path = (p: [number, number][]) =>
			p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
		// Close each fold: the middle branch meets the outer ones where they end.
		if (middle.length) {
			middle.unshift(upper[0]);
			middle.push(lower[lower.length - 1]);
		}
		return { lower: path(lower), upper: path(upper), middle: path(middle), range };
	}

	const main = $derived(curves(inducer, glucose));
	const ghost = $derived(
		inducer === 'lactose' ? curves('tmg', 0) : glucose > 0 ? curves('tmg', 0) : null
	);

	const HOURS = 1000;
	const trace = $derived(
		sweep({ inducer, glucose, from: 10 ** C0, to: 3000, hours: HOURS, every: HOURS / 300 })
	);
	const SWEEP = 20;
	const progress = $derived(reduced ? 1 : Math.min(1, t / SWEEP));
	const k = $derived(Math.max(1, Math.round(progress * (trace.length - 1))));
	const shown = $derived(trace.slice(0, k + 1));
	const now = $derived(trace[k]);

	const pathOf = (pts: typeof trace) =>
		pts
			.map(
				(p, i) =>
					`${i ? 'L' : 'M'}${sx(Math.log10(p.c)).toFixed(1)} ${sy(Math.log10(p.y)).toFixed(1)}`
			)
			.join('');
	const upPath = $derived(pathOf(shown.filter((p) => p.up)));
	const downPath = $derived(pathOf(shown.filter((p, i) => !p.up || shown[i + 1]?.up === false)));

	/** Where the swept cell jumped: on the way up and on the way down. */
	const jumps = $derived.by(() => {
		const on = trace.find((p) => p.up && p.y > 10);
		const off = trace.find((p) => !p.up && p.y < 10);
		return { on: on?.c, off: off?.c };
	});
	const seenOn = $derived(jumps.on !== undefined && shown.some((p) => p.up && p.y > 10));
	const seenOff = $derived(jumps.off !== undefined && shown.some((p) => !p.up && p.y < 10));

	const name = $derived(inducer === 'tmg' ? 'TMG' : 'lactose');
	const fmtNum = (c: number) => String(Number(c.toPrecision(2)));
	const graded = $derived(main.range === null);
	const state = $derived(graded ? 'at' : now.y > 10 ? 'on' : 'off');
	const done = $derived(progress >= 1);
	const ox = (c: number) => sx(Math.log10(c));
</script>

<g>
	<Readout
		id="title"
		order={1}
		label={name}
		value="{fmtNum(now.c)} µM, {done ? 'sweep done' : now.up ? 'rising' : 'falling'}"
	>
		<Label
			x={24}
			y={30}
			text="{name} {fmtNum(now.c)} µM, {done
				? 'swept up and back down'
				: now.up
					? 'rising slowly'
					: 'falling slowly'}{glucose > 0 ? ` · glucose ${glucose} µM` : ''}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- the bistable range -->
	{#if main.range}
		<rect
			x={ox(main.range.off)}
			y={80}
			width={Math.max(0, ox(main.range.on) - ox(main.range.off))}
			height={440}
			fill="var(--lo-band)"
		/>
		<Readout id="band-key">
			<Label
				x={(ox(main.range.off) + ox(main.range.on)) / 2}
				y={98}
				text="two stable states"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<Axes
		{sx}
		{sy}
		xTicks={[0, 1, 2, 3]}
		yTicks={[-1, 0, 1, 2]}
		xFormat={fmtC}
		yFormat={fmtY}
		xLabel="{name} outside, µM"
		yLabel="lac expression (% of full)"
	/>

	{#if ghost}
		<g opacity="0.35">
			<path d={ghost.lower} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
			<path d={ghost.upper} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
			<path
				d={ghost.middle}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
			/>
		</g>
		<Readout id="ghost-key">
			<Label
				x={730}
				y={345}
				text={inducer === 'lactose' ? 'grey: TMG, for comparison' : 'grey: TMG without glucose'}
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	<!-- steady states -->
	<path d={main.lower} fill="none" stroke="var(--stage-ink)" stroke-width="2.4" />
	<path d={main.upper} fill="none" stroke="var(--stage-ink)" stroke-width="2.4" />
	{#if main.middle}
		<path
			d={main.middle}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
			stroke-dasharray="5 5"
		/>
	{/if}

	<!-- Ozbudak's measured thresholds, without glucose -->
	{#if inducer === 'tmg' && glucose === 0}
		{#each [MEASURED.off, MEASURED.on] as m (m)}
			<path
				d="M{ox(m)} 528 l-6 10 h12 Z"
				fill="var(--stage-ink)"
				opacity="0.8"
				transform="translate(0 -6)"
			/>
		{/each}
		<Readout id="measured" order={6} label="Measured thresholds" value="about 3 and 30 µM TMG">
			<Label
				x={ox(MEASURED.on) + 12}
				y={505}
				text="▲ measured: 3 and 30 µM"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	<!-- the swept cell -->
	<path d={upPath} fill="none" stroke="var(--lo-up)" stroke-width="3.2" opacity="0.85" />
	<path d={downPath} fill="none" stroke="var(--lo-down)" stroke-width="3.2" opacity="0.85" />
	<circle
		cx={ox(now.c)}
		cy={sy(Math.log10(now.y))}
		r="8"
		fill={now.up ? 'var(--lo-up)' : 'var(--lo-down)'}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- side panel -->
	<Readout
		id="cell"
		order={2}
		label="The cell"
		value="{graded ? '' : `${state}, `}{now.y < 10 ? now.y.toFixed(1) : now.y.toFixed(0)} % of full"
	>
		<Label
			x={730}
			y={110}
			text={graded
				? `cell: ${now.y < 10 ? now.y.toFixed(1) : now.y.toFixed(0)} %`
				: `cell: ${state} (${now.y < 10 ? now.y.toFixed(1) : now.y.toFixed(0)} %)`}
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="up-key"
		order={3}
		label="Going up"
		color="var(--lo-up)"
		value={seenOn && jumps.on
			? graded
				? `10 % reached at ${fmtNum(jumps.on)} µM`
				: `switched on at ${fmtNum(jumps.on)} µM`
			: 'still off'}
	>
		<Label
			x={730}
			y={142}
			text={seenOn && jumps.on
				? graded
					? `up: 10 % at ${fmtNum(jumps.on)} µM`
					: `up: on at ${fmtNum(jumps.on)} µM`
				: 'up: still off'}
			size={13}
			anchor="start"
			color="var(--lo-up)"
			weight={600}
			tabular
		/>
	</Readout>
	<Readout
		id="down-key"
		order={4}
		label="Coming down"
		color="var(--lo-down)"
		value={seenOff && jumps.off
			? graded
				? `back below 10 % at ${fmtNum(jumps.off)} µM`
				: `switched off at ${fmtNum(jumps.off)} µM`
			: now.up
				? '–'
				: 'still on'}
	>
		<Label
			x={730}
			y={164}
			text={seenOff && jumps.off
				? graded
					? `down: 10 % at ${fmtNum(jumps.off)} µM`
					: `down: off at ${fmtNum(jumps.off)} µM`
				: now.up
					? 'down: –'
					: 'down: still on'}
			size={13}
			anchor="start"
			color="var(--lo-down)"
			weight={600}
			tabular
		/>
	</Readout>
	{#if done}
		<Readout id="verdict">
			<Label
				x={730}
				y={200}
				text={main.range ? 'a loop: history decides' : 'no loop: same path'}
				size={13}
				weight={600}
				anchor="start"
				pill
			/>
		</Readout>
	{/if}
	{#if main.range}
		<Readout id="range">
			<Label x={730} y={240} text="model: two states from" size={12} anchor="start" muted />
			<Label
				x={730}
				y={258}
				text="{fmtNum(main.range.off)} to {fmtNum(main.range.on)} µM"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{/if}
	<Readout id="line-key">
		<Label x={730} y={300} text="solid: stable states" size={11} anchor="start" muted />
		{#if main.range}
			<Label x={730} y={317} text="dashed: tipping points" size={11} anchor="start" muted />
		{/if}
	</Readout>
</g>
