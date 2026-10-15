<script lang="ts">
	/**
	 * Steps 1–2: half a litre of air in a cylinder under a free piston, a plate
	 * underneath that heats (flame) or cools (cold water) it, and the gas's path
	 * on a pressure–volume chart.
	 *
	 * Phases (`step.hints.phase`):
	 *   push — `params.heatQ` joules go in at constant pressure over the first
	 *          2.3 s; the area under the line is the work.
	 *   loop — the rectangular cycle of `boxCycle(params.back)`, 2.5 s per leg.
	 *          'cold': heat at constant volume, heat at constant pressure,
	 *          cool at constant volume, cool at constant pressure (a loop);
	 *          'same': back along the same two lines (no area).
	 */
	import { Axes, Label, scale, smoothstep, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BOX, P_ATM, boxCycle, boxMass, pushAtConstantPressure } from '../engine';
	import Card from './Card.svelte';
	import Gas from './Gas.svelte';
	import { fmt } from './colors';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'push'));
	const tm = $derived(reduced ? 2.5 : t);

	// ---- layout ---------------------------------------------------------------------------
	const CYL = { x: 120, w: 170, bottom: 452 };
	const PX_PER_L = 290;
	const PISTON = 16;
	const sx = scale([0, 1.2], [470, 900]);
	const sy = scale([0, 2.5], [430, 90]);

	// ---- the gas now ---------------------------------------------------------------------
	const q = $derived(Number(params.heatQ ?? 100));
	const push = $derived(pushAtConstantPressure(q));
	const pushU = $derived(smoothstep(0.3, 2.3, tm));

	const back = $derived(String(params.back ?? 'cold') === 'same' ? 'same' : 'cold');
	const cyc = $derived(boxCycle(back));
	const LEG = 2.5;
	const legNow = $derived(Math.floor((tm % (4 * LEG)) / LEG));
	const legU = $derived(smoothstep(0.15, 0.85, ((tm % (4 * LEG)) % LEG) / LEG));
	/** The path in order: 'cold' goes round the four corners; 'same' goes out and back. */
	const route = $derived(
		back === 'cold'
			? [0, 1, 2, 3, 0].map((i) => cyc.corners[i])
			: [0, 1, 2, 1, 0].map((i) => (i === 2 ? cyc.corners[2] : cyc.corners[i]))
	);

	interface Gas {
		P: number;
		V: number;
		T: number;
	}
	const gas: Gas = $derived.by(() => {
		if (phase === 'push') {
			const V = BOX.V + (push.v2 - BOX.V) * pushU;
			return { P: BOX.P, V, T: (BOX.T * V) / BOX.V };
		}
		const a = route[legNow];
		const b = route[legNow + 1];
		const P = a.P + (b.P - a.P) * legU;
		const V = a.V + (b.V - a.V) * legU;
		return { P, V, T: (P * V) / (boxMass() * 287) };
	});

	/** What the plate under the cylinder is doing: +1 heating, −1 cooling, 0 nothing. */
	const plate = $derived.by(() => {
		if (phase === 'push') return pushU > 0 && pushU < 1 ? 1 : 0;
		if (back === 'cold') return legNow < 2 ? 1 : -1;
		// Back the way it came: the heat goes back into the hot plate.
		return legNow < 2 ? 1 : 2;
	});
	const flicker = $derived(0.75 + 0.25 * wave(tm, 0.6));

	const gasH = $derived(gas.V * 1000 * PX_PER_L);
	const pistonY = $derived(CYL.bottom - gasH - PISTON);

	// ---- chart paths ------------------------------------------------------------------------
	const P = (g: { P: number; V: number }) =>
		`${sx(g.V * 1000).toFixed(1)} ${sy(g.P / P_ATM).toFixed(1)}`;
	const loopPath = $derived(
		back === 'cold'
			? `M${cyc.corners.map(P).join(' L')} Z`
			: `M${P(cyc.corners[0])} L${P(cyc.corners[1])} L${P(cyc.corners[2])}`
	);
	const pushLine = $derived(`M${P({ P: BOX.P, V: BOX.V })} L${P(gas)}`);
	const pushArea = $derived(
		`M${sx(BOX.V * 1000)} ${sy(0)} L${P({ P: BOX.P, V: BOX.V })} L${P(gas)} L${sx(gas.V * 1000)} ${sy(0)} Z`
	);

	// ---- readouts -----------------------------------------------------------------------------
	const pushRows = $derived([
		{ id: 'q', label: 'Heat in', value: `${fmt(q * pushU)} J`, color: 'var(--he-hot)' },
		{
			id: 'w',
			label: 'Work: pushing the piston',
			value: `${fmt(push.work * pushU)} J`,
			color: 'var(--he-work)'
		},
		{
			id: 'u',
			label: 'Kept by the gas (it gets hotter)',
			value: `${fmt(push.warming * pushU)} J`
		},
		{ id: 'tg', label: 'Gas temperature', value: `${fmt(gas.T)} K` }
	]);
	const loopRows = $derived([
		{
			id: 'wout',
			label: 'Work out (expanding)',
			value: `${fmt(cyc.workOut)} J`,
			color: 'var(--he-work)'
		},
		{
			id: 'win',
			label: 'Work back in (compressing)',
			value: `${fmt(cyc.workIn)} J`,
			color: 'var(--he-hot)'
		},
		{ id: 'net', label: 'Net work per cycle', value: `${fmt(cyc.net)} J`, strong: true },
		{ id: 'qout', label: 'Heat in / heat out', value: `${fmt(cyc.qIn)} J / ${fmt(cyc.qOut)} J` }
	]);
	const legNames = $derived(
		back === 'cold'
			? [
					'heating, piston held',
					'heating, piston free',
					'cooling, piston held',
					'cooling, piston free'
				]
			: [
					'heating, piston held',
					'heating, piston free',
					'pushed back: heat returns',
					'pushed back: heat returns'
				]
	);
	const legText = $derived(
		phase === 'push' ? (pushU < 1 ? 'heating' : 'heated') : legNames[legNow]
	);
</script>

<g>
	<!-- the cylinder -->
	<g>
		<Gas x={CYL.x} y={pistonY + PISTON} w={CYL.w} h={gasH} T={gas.T} {t} {reduced} n={30} />
		<path
			d="M{CYL.x} {CYL.bottom - 350} L{CYL.x} {CYL.bottom} L{CYL.x + CYL.w} {CYL.bottom} L{CYL.x +
				CYL.w} {CYL.bottom - 350}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<!-- piston and rod -->
		<rect
			x={CYL.x + 2}
			y={pistonY}
			width={CYL.w - 4}
			height={PISTON}
			rx="3"
			fill="var(--he-metal)"
			stroke="var(--he-metal-edge)"
		/>
		<rect
			x={CYL.x + CYL.w / 2 - 6}
			y={pistonY - 60}
			width="12"
			height="60"
			fill="var(--he-metal)"
			stroke="var(--he-metal-edge)"
		/>
		{#if phase === 'loop' && (legNow === 0 || legNow === 2) && back === 'cold'}
			<!-- stops hold the piston while the volume stays fixed -->
			{#each [CYL.x - 10, CYL.x + CYL.w] as sxp (sxp)}
				<rect x={sxp} y={pistonY - 8} width="10" height="8" rx="2" fill="var(--stage-ink-muted)" />
			{/each}
		{/if}
		<Readout id="atm">
			<Label x={CYL.x + CYL.w / 2} y={44} text="air outside: 1 atm" muted size={12} />
		</Readout>

		<!-- the plate underneath -->
		<rect
			x={CYL.x - 20}
			y={CYL.bottom + 6}
			width={CYL.w + 40}
			height="22"
			rx="6"
			fill={plate === -1
				? 'var(--he-cold-soft)'
				: plate === 0
					? 'var(--surface)'
					: 'var(--he-hot-soft)'}
			stroke={plate === -1 ? 'var(--he-cold)' : plate === 0 ? 'var(--border)' : 'var(--he-hot)'}
		/>
		{#if plate !== 0}
			{#each [0, 1, 2] as k (k)}
				{@const ax = CYL.x + 35 + k * 50}
				<path
					d={plate === 1
						? `M${ax} ${CYL.bottom + 4} l0 -22 m-6 8 l6 -8 l6 8`
						: `M${ax} ${CYL.bottom - 20} l0 22 m-6 -8 l6 8 l6 -8`}
					fill="none"
					stroke={plate === -1 ? 'var(--he-cold)' : 'var(--he-hot)'}
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity={plate === 1 ? flicker : 0.9}
				/>
			{/each}
		{/if}
		<Readout id="plate" order={0} label="Now" value={legText}>
			<Label
				x={CYL.x + CYL.w / 2}
				y={CYL.bottom + 52}
				text={plate === -1
					? 'cold water: heat out'
					: plate === 2
						? 'heat back out, as hot as it came in'
						: plate === 1
							? 'flame: heat in'
							: 'flame off'}
				color={plate === -1 ? 'var(--he-cold)' : plate === 0 ? undefined : 'var(--he-hot)'}
				size={13}
			/>
			<Label x={CYL.x + CYL.w / 2} y={CYL.bottom + 72} text={legText} muted size={12} />
		</Readout>
	</g>

	<!-- the chart -->
	<Axes
		{sx}
		{sy}
		xLabel="volume (litres)"
		yLabel="pressure (atm)"
		xTicks={[0, 0.25, 0.5, 0.75, 1]}
		yTicks={[0, 1, 2]}
		yFormat={(v: number) => fmt(v)}
		xFormat={(v: number) => fmt(v, 2)}
	/>
	{#if phase === 'push'}
		<path d={pushArea} fill="var(--he-work)" opacity="0.22" />
		<path
			d={pushLine}
			fill="none"
			stroke="var(--he-loop)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{#if pushU > 0.3}
			<Readout id="area">
				<Label
					x={sx((BOX.V * 1000 + gas.V * 1000) / 2)}
					y={sy(0.5)}
					text="area = work"
					color="var(--he-work)"
					opacity={smoothstep(0.3, 0.6, pushU)}
				/>
			</Readout>
		{/if}
	{:else}
		{#if back === 'cold'}
			<path d={loopPath} fill="var(--he-loop-fill)" stroke="none" />
		{/if}
		<path
			d={loopPath}
			fill="none"
			stroke="var(--he-loop)"
			stroke-width="3"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		{#each route.slice(0, 4) as c, i (i)}
			{@const n = route[i + 1]}
			{@const mx = (sx(c.V * 1000) + sx(n.V * 1000)) / 2}
			{@const my = (sy(c.P / P_ATM) + sy(n.P / P_ATM)) / 2}
			{@const ang = Math.atan2(sy(n.P / P_ATM) - sy(c.P / P_ATM), sx(n.V * 1000) - sx(c.V * 1000))}
			{#if !(back === 'same' && i >= 2)}
				<path
					d="M-7 -6 L4 0 L-7 6"
					transform="translate({mx} {my}) rotate({(ang * 180) / Math.PI})"
					fill="none"
					stroke="var(--he-loop)"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}
		{/each}
		<Readout id="area">
			<Label
				x={sx(0.75)}
				y={sy(1.5) + 4}
				text={back === 'cold' ? 'net work = area inside' : 'no area: no net work'}
				color={back === 'cold' ? 'var(--he-loop)' : undefined}
			/>
		</Readout>
	{/if}
	<circle
		cx={sx(gas.V * 1000)}
		cy={sy(gas.P / P_ATM)}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	<Card x={470} y={476} w={430} rows={phase === 'push' ? pushRows : loopRows} />
</g>
