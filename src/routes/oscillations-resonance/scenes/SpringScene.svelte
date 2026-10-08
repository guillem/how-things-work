<script lang="ts">
	/**
	 * A mass hanging on a coil spring, released 15 cm below its resting place,
	 * with a live trace of its position (a chart recorder: the pen is level with
	 * the mass, so the trace's vertical scale is the drawing's).
	 *
	 * Phases (`step.hints.phase`):
	 *   spring  — no friction (c = 0): a steady wave; the period is marked between
	 *             two crests; mass and stiffness from the sliders
	 *   damping — friction `params.damping`: the swing dies away inside a dashed
	 *             envelope; damping ratio in plain words and the energy left
	 *
	 * The motion is precomputed per setting (`springMotion`, 120 s) and replayed
	 * in real time from the moment of release. Changing a slider or pressing
	 * "Release again" restarts it: the clock reading at that moment is remembered
	 * in a frame-to-frame memo inside a $derived (the scene guide's sanctioned
	 * exception, as in newtons-laws/TrackScene). Reduced motion: the complete
	 * 10 s trace, the mass at its end.
	 */
	import { scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		dampedFrequency,
		dampingRatio,
		naturalFrequency,
		springEnergy,
		springMotion
	} from '../oscillator';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import {
		COL_X,
		PLOT_X0,
		PLOT_X1,
		SAMPLE,
		coilPath,
		crests,
		lastTwo,
		loopTime,
		type Cell
	} from './osc';

	let { step, t, params, reduced }: StageProps = $props();

	const X0 = 0.15; // m below rest at release
	const END = 120; // s computed
	const W = 10; // s of trace on screen
	const HOLD = 0.6; // s held at the release point
	const REST = 300; // y of the mass's centre at rest
	const PXM = 800; // px per metre (the swing is drawn ×8)
	const CEIL = 40;
	const YMAX = 0.18; // m, half the trace's height

	const phase = $derived(String(step.hints?.phase ?? 'spring'));
	const damped = $derived(phase === 'damping');
	const m = $derived(Math.max(0.05, Number(params.mass ?? 1)));
	const k = $derived(Math.max(1, Number(params.stiffness ?? 39)));
	const c = $derived(damped ? Math.max(0, Number(params.damping ?? 0.3)) : 0);
	const spring = $derived({ m, k, c });
	const f0 = $derived(naturalFrequency(spring));
	const zeta = $derived(dampingRatio(spring));
	const fd = $derived(dampedFrequency(spring));
	const period = $derived(fd > 0 ? 1 / fd : 0);

	const motion = $derived(springMotion(spring, X0, 0, END, undefined, SAMPLE));
	// The mass at its highest: minima of x (x is measured downwards).
	const tops = $derived(zeta < 1 ? crests(motion.x, -1) : []);

	// ---- clock: time since release ------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${m}|${k}|${c}|${params.release ?? 0}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const tau = $derived(reduced ? W : Math.max(0, since - HOLD));
	const xAt = (s: number) => {
		const u = loopTime(s, END, period);
		const f = Math.max(0, u / SAMPLE);
		const i = Math.min(motion.x.length - 2, Math.floor(f));
		const a = f - i;
		return {
			x: motion.x[i] + (motion.x[i + 1] - motion.x[i]) * a,
			v: motion.v[i] + (motion.v[i + 1] - motion.v[i]) * a
		};
	};
	const now = $derived(xAt(tau));

	// ---- the drawing ----------------------------------------------------------------
	const size = $derived(34 + 16 * Math.sqrt(m));
	const yMass = $derived(REST + Math.max(-YMAX, Math.min(YMAX, now.x)) * PXM);
	const coil = $derived(coilPath(COL_X, CEIL + 4, yMass - size / 2, 12, 26));

	// ---- the trace ----------------------------------------------------------------------
	const ws = $derived(Math.max(0, tau - W));
	const sx = $derived(scale([ws, ws + W], [PLOT_X0, PLOT_X1]));
	const sy = scale([-YMAX, YMAX], [REST - YMAX * PXM, REST + YMAX * PXM]);
	const xTicks = $derived(
		Array.from({ length: 6 }, (_, i) => Math.ceil(ws / 2) * 2 + i * 2).filter((v) => v <= ws + W)
	);
	const tracePath = $derived.by(() => {
		let d = '';
		const n = Math.max(1, Math.round((tau - ws) / SAMPLE));
		for (let i = 0; i <= n; i++) {
			const s = ws + ((tau - ws) * i) / n;
			d += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(xAt(s).x).toFixed(1)}`;
		}
		return d;
	});
	// Dashed envelope of the damped swing: X0/√(1−ζ²)·e^(−ζω₀t), drawn up to now.
	const envelope = $derived.by(() => {
		if (!damped || zeta >= 1 || c === 0) return null;
		const w0 = 2 * Math.PI * f0;
		const a0 = X0 / Math.sqrt(1 - zeta * zeta);
		let up = '';
		let down = '';
		const n = 80;
		for (let i = 0; i <= n; i++) {
			const s = ws + ((tau - ws) * i) / n;
			const a = Math.min(YMAX, a0 * Math.exp(-zeta * w0 * s));
			up += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(-a).toFixed(1)}`;
			down += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(a).toFixed(1)}`;
		}
		return { up, down };
	});
	// Period bracket over the last two crests on screen.
	const bracket = $derived.by(() => {
		const pair = lastTwo(tops, tau, END, period);
		if (!pair || pair[0] < ws) return null;
		const [c1, c2] = pair;
		// Only over clearly visible swings (not the last ripples of a damped one).
		if (Math.min(-xAt(c1).x, -xAt(c2).x) < 0.012) return null;
		const y = Math.min(sy(xAt(c1).x), sy(xAt(c2).x)) - 12;
		const p = c2 - c1;
		return {
			x1: sx(c1),
			x2: sx(c2),
			y,
			text: `period ${p.toFixed(2)} s → ${(1 / p).toFixed(2)} Hz`
		};
	});

	// ---- readouts ---------------------------------------------------------------------------
	const E0 = $derived(springEnergy(spring, X0, 0));
	const energyLeft = $derived(springEnergy(spring, now.x, now.v) / E0);
	const words = $derived(
		zeta >= 1 ? 'creeps back, no swing' : zeta < 0.1 ? 'rings on' : 'settles quickly'
	);
	const cells: Cell[] = $derived(
		damped
			? [
					{ id: 'c', label: 'friction', value: `${c.toFixed(2)} N·s/m`, sub: 'damping' },
					{
						id: 'z',
						label: 'damping ratio',
						value: zeta.toFixed(zeta < 0.1 ? 3 : 2),
						sub: words,
						color: 'var(--osc-trace)'
					},
					{
						id: 'e',
						label: 'energy left',
						value: `${Math.round(Math.max(0, Math.min(1, energyLeft)) * 100)}%`,
						bar: energyLeft
					},
					{
						id: 'f',
						label: 'swings at',
						value: fd > 0 ? `${fd.toFixed(2)} Hz` : 'no swing',
						sub: fd > 0 ? `natural ${f0.toFixed(2)} Hz` : undefined
					}
				]
			: [
					{ id: 'm', label: 'mass', value: `${m.toFixed(2)} kg` },
					{ id: 'k', label: 'stiffness', value: `${k.toFixed(0)} N/m` },
					{
						id: 'f',
						label: 'natural frequency',
						value: `${f0.toFixed(2)} Hz`,
						sub: '(1/2π)·√(k/m)',
						color: 'var(--osc-trace)'
					},
					{ id: 'p', label: 'period', value: `${(1 / f0).toFixed(2)} s`, sub: 'one full swing' }
				]
	);
	const held = $derived(!reduced && since < HOLD);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="spring-plot">
			<rect
				x={PLOT_X0}
				y={REST - YMAX * PXM - 30}
				width={PLOT_X1 - PLOT_X0 + 2}
				height={YMAX * PXM * 2 + 30}
			/>
		</clipPath>
	</defs>

	<!-- ceiling -->
	<rect
		x={COL_X - 80}
		y={CEIL - 12}
		width="160"
		height="12"
		rx="3"
		fill="var(--stage-line)"
		opacity="0.5"
	/>
	<line
		x1={COL_X - 80}
		x2={COL_X + 80}
		y1={CEIL}
		y2={CEIL}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>

	<!-- rest and release marks -->
	<line
		x1={COL_X - 70}
		x2={PLOT_X0 - 46}
		y1={REST}
		y2={REST}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 5"
		opacity="0.6"
	/>
	{@render txt(COL_X - 76, REST + 4, 'rest', 12, { anchor: 'end', muted: true })}
	<line
		x1={COL_X - 70}
		x2={COL_X - 40}
		y1={REST + X0 * PXM}
		y2={REST + X0 * PXM}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	{@render txt(COL_X - 76, REST + X0 * PXM - 4, 'let go', 12, { anchor: 'end', muted: true })}
	{@render txt(COL_X - 76, REST + X0 * PXM + 11, '15 cm below', 11, { anchor: 'end', muted: true })}

	<!-- spring and mass -->
	<path
		d={coil}
		fill="none"
		stroke="var(--osc-spring)"
		stroke-width="2.5"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	<rect
		x={COL_X - size / 2}
		y={yMass - size / 2}
		width={size}
		height={size}
		rx="7"
		fill="var(--osc-mass)"
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>
	<text
		x={COL_X}
		y={yMass + 5}
		text-anchor="middle"
		font-weight="700"
		style:font-size={m < 1 ? '11px' : '13px'}
		style:fill="#fff">{m.toFixed(m < 1 ? 2 : 1)} kg</text
	>
	{#if held}
		{@render txt(COL_X + size / 2 + 12, yMass + 4, 'hold… let go', 12, { weight: 600 })}
	{/if}

	<!-- trace -->
	<Plot
		{sx}
		{sy}
		{xTicks}
		yTicks={[-0.1, 0, 0.1]}
		xFormat={(v) => `${v} s`}
		yFormat={(v) => (v === 0 ? 'rest' : v < 0 ? '10 cm ↑' : '10 cm ↓')}
	/>
	{@render txt(PLOT_X0, REST - YMAX * PXM - 14, 'position of the mass', 12, { muted: true })}
	<g clip-path="url(#spring-plot)">
		{#if envelope}
			<path
				d={envelope.up}
				fill="none"
				stroke="var(--osc-trace)"
				stroke-width="1.3"
				stroke-dasharray="5 5"
				opacity="0.7"
			/>
			<path
				d={envelope.down}
				fill="none"
				stroke="var(--osc-trace)"
				stroke-width="1.3"
				stroke-dasharray="5 5"
				opacity="0.7"
			/>
		{/if}
		<path
			d={tracePath}
			fill="none"
			stroke="var(--osc-trace)"
			stroke-width="2.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</g>
	<!-- pen: level with the mass -->
	<line
		x1={COL_X + size / 2 + 4}
		x2={sx(tau)}
		y1={yMass}
		y2={yMass}
		stroke="var(--osc-trace)"
		stroke-dasharray="2 4"
		opacity="0.55"
	/>
	<circle
		cx={sx(tau)}
		cy={yMass}
		r="5"
		fill="var(--osc-trace)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	{#if bracket}
		<g stroke="var(--stage-ink)" stroke-width="1.3">
			<line x1={bracket.x1} x2={bracket.x2} y1={bracket.y} y2={bracket.y} />
			<line x1={bracket.x1} x2={bracket.x1} y1={bracket.y - 5} y2={bracket.y + 5} />
			<line x1={bracket.x2} x2={bracket.x2} y1={bracket.y - 5} y2={bracket.y + 5} />
		</g>
		{@render txt(
			Math.min(PLOT_X1 - 80, Math.max(PLOT_X0 + 80, (bracket.x1 + bracket.x2) / 2)),
			bracket.y - 8,
			bracket.text,
			12,
			{ anchor: 'middle', weight: 600 }
		)}
	{/if}

	{#if damped}
		{#if envelope}
			{@render txt(
				PLOT_X1,
				REST + YMAX * PXM + 36,
				'dashed: the size of the swing, shrinking a little every second',
				11,
				{
					anchor: 'end',
					muted: true
				}
			)}
		{:else}
			{@render txt(
				PLOT_X1,
				REST + YMAX * PXM + 36,
				'too much friction to swing: it creeps back to rest',
				11,
				{
					anchor: 'end',
					muted: true
				}
			)}
		{/if}
	{:else}
		{@render txt(PLOT_X1, REST + YMAX * PXM + 36, 'heavier → slower · stiffer → faster', 11, {
			anchor: 'end',
			muted: true
		})}
	{/if}

	<Card {cells} />
</g>
