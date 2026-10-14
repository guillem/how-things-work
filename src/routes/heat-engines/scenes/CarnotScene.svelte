<script lang="ts">
	/**
	 * Step 8: the Carnot cycle of `carnotDemo(params.carnotHot,
	 * params.carnotCold)` on a pressure–volume chart (left, axes scaled to
	 * the loop) and a temperature–entropy chart (right, temperature from 0 so
	 * that areas are heats: the rectangle is the work, the band under it the
	 * heat given to the cold side). A dot goes round both, 3 s per leg.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { along, carnotDemo, loop } from '../engine';
	import Card from './Card.svelte';
	import { bar, fmt, niceUp, pct } from './colors';

	let { t, params, reduced }: StageProps = $props();
	const tm = $derived(reduced ? 4.5 : t);

	const tHot = $derived(Number(params.carnotHot ?? 600));
	const tCold = $derived(Number(params.carnotCold ?? 300));
	const c = $derived(carnotDemo(tHot, tCold));

	// ---- axes that follow the loop --------------------------------------------------------------
	const ax = new Tween({ p: 10, v: 1, T: 700 }, { duration: 700, easing: cubicInOut });
	const target = $derived({
		p: niceUp(bar(c.states[1].P) * 1.05),
		v: niceUp(c.states[3].V * 1000 * 1.05),
		T: Math.ceil((tHot * 1.12) / 250) * 250
	});
	$effect(() => {
		const v = target;
		untrack(() => ax.set(v, { duration: reduced ? 0 : 700 }));
	});
	const sxP = $derived(scale([0, ax.current.v], [80, 440]));
	const syP = $derived(scale([0, ax.current.p], [400, 96]));
	const S_MAX = 0.18;
	const sxT = scale([-0.02, S_MAX], [540, 905]);
	const syT = $derived(scale([0, ax.current.T], [400, 96]));

	const pts = $derived(loop(c, 80));
	const pvPath = $derived(
		pts
			.map((p, i) => `${i ? 'L' : 'M'}${sxP(p.V * 1000).toFixed(1)} ${syP(bar(p.P)).toFixed(1)}`)
			.join(' ') + 'Z'
	);
	const [s1, s2, s3, s4] = $derived(c.states);
	const rect = $derived(
		`M${sxT(s1.S)} ${syT(tCold)} L${sxT(s2.S)} ${syT(tHot)} L${sxT(s3.S)} ${syT(tHot)} L${sxT(s4.S)} ${syT(tCold)} Z`
	);
	const under = $derived(
		`M${sxT(s1.S)} ${syT(0)} L${sxT(s1.S)} ${syT(tCold)} L${sxT(s4.S)} ${syT(tCold)} L${sxT(s4.S)} ${syT(0)} Z`
	);

	// ---- the dot -----------------------------------------------------------------------------------
	const LEG = 3;
	const leg = $derived(Math.floor((tm % (4 * LEG)) / LEG));
	const legU = $derived(smoothstep(0.1, 0.9, ((tm % (4 * LEG)) % LEG) / LEG));
	const g = $derived(along(c, leg, legU));
	const legText = [
		'1 → 2: squeezed with no heat flow, it warms to Th',
		'2 → 3: expands touching the hot side, taking in heat at Th',
		'3 → 4: expands with no heat flow, it cools to Tc',
		'4 → 1: squeezed touching the cold side, giving out heat at Tc'
	];
	const legShort = [
		'heating by squeezing',
		'heat in at Th',
		'cooling by expanding',
		'heat out at Tc'
	];

	const rows = $derived([
		{ id: 'qin', label: 'Heat in, all at Th', value: `${fmt(c.qIn, 1)} J`, color: 'var(--he-hot)' },
		{
			id: 'qout',
			label: 'Heat out, all at Tc',
			value: `${fmt(c.qOut, 1)} J`,
			color: 'var(--he-cold)'
		},
		{ id: 'eff', label: 'Efficiency = 1 − Tc/Th', value: pct(c.efficiency, 1), strong: true },
		{
			id: 'squeeze',
			label: 'Squeeze to reach Th, peak pressure',
			value: `${fmt(s1.V / s2.V)} : 1, ${fmt(bar(s2.P))} bar`
		}
	]);
</script>

<g>
	<Readout id="now" order={0} label="Now" value={legShort[leg]}>
		<Label x={480} y={42} text={legText[leg]} size={14} weight={600} />
	</Readout>

	<!-- P–V -->
	<Axes
		sx={sxP}
		sy={syP}
		xLabel="volume (litres)"
		yLabel="pressure (bar)"
		xTicks={[0, ax.current.v / 2, ax.current.v]}
		yTicks={[0, ax.current.p / 2, ax.current.p]}
		xFormat={(v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3 })}
		yFormat={(v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 })}
	/>
	<path
		d={pvPath}
		fill="var(--he-carnot-fill)"
		stroke="var(--he-carnot)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	<circle
		cx={sxP(g.V * 1000)}
		cy={syP(bar(g.P))}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	<!-- T–S -->
	<Axes
		sx={sxT}
		sy={syT}
		xLabel="entropy of the gas (J/K)"
		yLabel="temperature (K)"
		xTicks={[0, 0.05, 0.1, 0.15]}
		xFormat={(v: number) => fmt(v, 2)}
	/>
	<path d={under} fill="var(--he-cold)" opacity="0.18" />
	<path
		d={rect}
		fill="var(--he-carnot-fill)"
		stroke="var(--he-carnot)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	<line
		x1={sxT(-0.02)}
		x2={sxT(S_MAX)}
		y1={syT(tHot)}
		y2={syT(tHot)}
		stroke="var(--he-hot)"
		stroke-dasharray="4 4"
	/>
	<line
		x1={sxT(-0.02)}
		x2={sxT(S_MAX)}
		y1={syT(tCold)}
		y2={syT(tCold)}
		stroke="var(--he-cold)"
		stroke-dasharray="4 4"
	/>
	<Readout id="ts-labels">
		<Label
			x={sxT(S_MAX) - 4}
			y={syT(tHot) - 8}
			text="Th = {fmt(tHot)} K"
			anchor="end"
			size={12}
			color="var(--he-hot)"
		/>
		<Label
			x={sxT(S_MAX) - 4}
			y={syT(tCold) - 8}
			text="Tc = {fmt(tCold)} K"
			anchor="end"
			size={12}
			color="var(--he-cold)"
		/>
		<Label
			x={(sxT(s1.S) + sxT(s4.S)) / 2}
			y={(syT(tHot) + syT(tCold)) / 2 + 5}
			text="work"
			size={13}
			weight={600}
			color="var(--he-carnot)"
		/>
		{#if syT(0) - syT(tCold) > 26}
			<Label
				x={(sxT(s1.S) + sxT(s4.S)) / 2}
				y={(syT(tCold) + syT(0)) / 2 + 5}
				text="heat out"
				size={12}
				color="var(--he-cold)"
			/>
		{/if}
	</Readout>
	<circle
		cx={sxT(g.S)}
		cy={syT(g.T)}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	<Card x={270} y={452} w={420} {rows} order={1} />
</g>
