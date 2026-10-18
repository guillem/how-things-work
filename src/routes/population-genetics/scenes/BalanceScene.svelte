<script lang="ts">
	/**
	 * The chance that a new mutation (one copy, additive) is eventually fixed, as a multiple of a
	 * neutral one's 1/2N, against N × s on a ×10 scale: Kimura's curve for the chosen N, the band
	 * where chance rules (N|s| < ¼), the chosen N and s as a dot, and the share fixed in 4,000
	 * simulated runs as a ring. The curve draws itself from left to right over the first two
	 * seconds; reduced motion shows it whole.
	 */
	import { Axes, Label, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { mutationFates, newMutationFixes } from '../model';
	import { hinted, percent } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const num = (key: string, fallback: number) => {
		const v = Number(hinted(step, params, key, fallback));
		return Number.isFinite(v) ? v : fallback;
	};
	const N = $derived(Math.max(2, Math.round(num('N', 100))));
	const s = $derived(Math.round(num('s', -0.005) * 1e6) / 1e6);
	const TRIALS = 4000;

	const PX0 = 150;
	const PX1 = 900;
	const PY0 = 480;
	const PY1 = 130;
	const XMAX = 3;
	const sx = scale([-XMAX, XMAX], [PX0, PX1]);
	const YLO = -4.3;
	const YHI = 1.3;
	const sy = scale([YLO, YHI], [PY0, PY1]);
	const yOf = (ratio: number) => sy(clamp(Math.log10(Math.max(ratio, 1e-12)), YLO, YHI));
	const Y_NAMES: Record<number, string> = {
		[-4]: '1/10,000',
		[-3]: '1/1,000',
		[-2]: '1/100',
		[-1]: '1/10',
		0: '1',
		1: '10'
	};

	/** The fixation chance of a new mutation, as a multiple of the neutral 1/2N. */
	const ratio = (n: number, sel: number) => newMutationFixes(n, sel, 0.5) * 2 * n;

	const reveal = $derived(reduced ? 1 : smoothstep(0.2, 2.2, t));
	const curve = $derived.by(() => {
		let d = '';
		const steps = 240;
		for (let i = 0; i <= steps * reveal; i++) {
			const x = -XMAX + (2 * XMAX * i) / steps;
			d += `${d ? 'L' : 'M'}${sx(x).toFixed(1)} ${yOf(ratio(N, x / N)).toFixed(1)}`;
		}
		return d;
	});

	const ns = $derived(N * s);
	const u = $derived(newMutationFixes(N, s, 0.5));
	const r = $derived(u * 2 * N);
	const off = $derived(Math.abs(ns) > XMAX);
	const dot = $derived({ x: sx(clamp(ns, -XMAX, XMAX)), y: yOf(r) });

	const sim = $derived(mutationFates(N, s, 0.5, TRIALS, 31 + N));
	const simRatio = $derived((sim.fixed / TRIALS) * 2 * N);

	const signed = (v: number, digits = 2) => {
		const a = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: digits });
		return v < -1e-12 ? `−${a}` : a;
	};
	const sPct = $derived(
		s === 0
			? 'none'
			: `${s > 0 ? '+' : '−'}${Math.abs(s * 100).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
	);
	const times = (v: number) =>
		v >= 10
			? `${Math.round(v)}×`
			: v >= 0.1
				? `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}×`
				: v > 0
					? `1/${Math.round(1 / v).toLocaleString('en-US')} of`
					: '0 ×';
</script>

<g>
	<!-- the band where chance rules -->
	<rect
		x={sx(-0.25)}
		y={PY1}
		width={sx(0.25) - sx(-0.25)}
		height={PY0 - PY1}
		fill="var(--popgen-band)"
	/>
	<Readout id="band" label="Shaded band" value="N|s| < ¼: chance rules">
		<Label
			x={sx(0)}
			y={PY1 + 18}
			text="chance rules"
			size={12}
			weight={700}
			color="var(--popgen-band-text)"
		/>
	</Readout>
	<Readout id="sides">
		<Label x={sx(-2)} y={PY1 + 18} text="selection: harmful ones lost" size={12} muted />
		<Label x={sx(2.1)} y={PY0 - 14} text="selection: beneficial ones favoured" size={12} muted />
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={[-3, -2, -1, 0, 1, 2, 3]}
		yTicks={[-4, -3, -2, -1, 0, 1]}
		xFormat={(v: number) => signed(v)}
		yFormat={(v: number) => Y_NAMES[v] ?? ''}
		xLabel="N × s"
	/>
	<Readout id="ytitle" label="Up: chance of fixing, × a neutral mutation's (each line ×10)">
		<Label
			anchor="start"
			x={PX0 - 70}
			y={PY1 - 16}
			text="chance a new mutation is fixed, × a neutral one’s 1/2N (each line ×10)"
			size={12}
			muted
		/>
	</Readout>

	<!-- neutral reference -->
	<line
		x1={PX0}
		x2={PX1}
		y1={sy(0)}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="4 4"
	/>
	<Readout id="neutral">
		<Label x={sx(-2.9)} y={sy(0) - 8} text="neutral: 1/2N" size={11} anchor="start" muted />
	</Readout>

	<path d={curve} fill="none" stroke="var(--popgen-trace)" stroke-width="2.8" />
	<Readout id="curve-name">
		<Label
			x={sx(1.3)}
			y={yOf(ratio(N, 1.3 / N)) + 26}
			text="Kimura, N = {N.toLocaleString('en-US')}"
			size={12}
			anchor="start"
			color="var(--popgen-trace)"
			weight={600}
		/>
	</Readout>

	<!-- the chosen N and s -->
	{#if reveal >= 1}
		{#if sim.fixed > 0 && !off}
			<circle
				cx={dot.x}
				cy={yOf(simRatio)}
				r="10"
				fill="none"
				stroke="var(--popgen-mean)"
				stroke-width="2.4"
			/>
		{/if}
		<circle
			cx={dot.x}
			cy={dot.y}
			r="6"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		{#if off}
			<Label
				x={dot.x + (ns > 0 ? -12 : 12)}
				y={dot.y + (ns > 0 ? 46 : -16)}
				text="N × s = {signed(ns)}: off the chart"
				size={11}
				anchor={ns > 0 ? 'end' : 'start'}
				muted
			/>
		{/if}
	{/if}

	<!-- read-outs -->
	<Readout
		id="setting"
		order={0}
		label="N, s"
		value="{N.toLocaleString('en-US')}, {sPct} per copy: N × s = {signed(ns)}"
	>
		<Label
			x={PX0 - 70}
			y={44}
			anchor="start"
			text="N = {N.toLocaleString('en-US')}, s = {sPct} per copy: N × s = {signed(ns)}"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="chance"
		order={1}
		label="Kimura: a new mutation fixes"
		value="{percent(u)}, {times(r)} a neutral one"
	>
		<Label
			x={PX0 - 70}
			y={70}
			anchor="start"
			text="Kimura: a new mutation fixes with chance {percent(u)}, {times(r)} a neutral one’s"
			size={13}
			tabular
		/>
	</Readout>
	<Readout
		id="simulated"
		order={2}
		label="Simulated (ring)"
		value="{sim.fixed.toLocaleString('en-US')} of {TRIALS.toLocaleString('en-US')} fixed"
		color="var(--popgen-mean)"
	>
		<Label
			x={PX0 - 70}
			y={94}
			anchor="start"
			text="simulated (ring): {sim.fixed.toLocaleString('en-US')} of {TRIALS.toLocaleString(
				'en-US'
			)} fixed ({percent(sim.fixed / TRIALS)})"
			size={13}
			color="var(--popgen-mean)"
			tabular
		/>
	</Readout>
</g>
