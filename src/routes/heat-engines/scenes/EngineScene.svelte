<script lang="ts">
	/**
	 * Steps 4–7: one cylinder of a four-stroke engine (valves, spark plug or
	 * injector, piston, connecting rod and crank) and its ideal cycle on a
	 * pressure–volume chart, with a dot that follows the gas.
	 *
	 * Phases (`step.hints.phase`; `step.hints.cycle` is 'otto' or 'diesel'):
	 *   strokes — the default Otto engine; the path traced so far this cycle is
	 *             drawn over the faint loop. `params.run` off: the crank
	 *             follows `params.crank` (degrees, 0–720) instead of the clock.
	 *   otto    — `params.ratio`, `params.tHot`: the loop shaded, its states
	 *             numbered, heat in, work and heat out.
	 *   ratio   — the same, plus a small chart of efficiency against ratio.
	 *   diesel  — the Diesel cycle with `params.dieselRatio`, `params.tHot`.
	 *
	 * The engine is a pure function of t: one cycle every PERIOD seconds
	 * (`engineAt` in the model gives the piston, the stroke and the gas).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CRANK, ROD, diesel, engineAt, loop, otto, ottoEfficiency, type Stroke } from '../engine';
	import Card from './Card.svelte';
	import Gas from './Gas.svelte';
	import { bar, fmt, pct, type Row } from './colors';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'strokes'));
	const kind = $derived(step.hints?.cycle === 'diesel' ? 'diesel' : 'otto');
	const r = $derived(
		phase === 'strokes'
			? 10
			: kind === 'diesel'
				? Number(params.dieselRatio ?? 18)
				: Number(params.ratio ?? 10)
	);
	const tHot = $derived(phase === 'strokes' ? 2500 : Number(params.tHot ?? 2500));
	const T_COLD = 300;
	const c = $derived(kind === 'diesel' ? diesel(r, T_COLD, tHot) : otto(r, T_COLD, tHot));

	// ---- time --------------------------------------------------------------------------------
	const PERIOD = 10;
	const running = $derived(phase !== 'strokes' || params.run !== false);
	/** Phase of the cycle (0–1) for a crank angle turned by hand. */
	function uFromCrank(deg: number) {
		const d = 0.06;
		const s = (1 - 2 * d) / 4;
		if (deg < 180) return (deg / 180) * s;
		if (deg < 360) return s + ((deg - 180) / 180) * s;
		if (deg < 540) return 2 * s + d + ((deg - 360) / 180) * s;
		if (deg < 720) return 3 * s + 2 * d + ((deg - 540) / 180) * s;
		return 0.9999;
	}
	// Reduced motion: a frame in the power stroke, with the loop complete.
	const u = $derived(
		running ? (reduced ? 0.6 : cycle(t, PERIOD)) : uFromCrank(Number(params.crank ?? 0))
	);
	const now = $derived(engineAt(c, u));

	// ---- layout --------------------------------------------------------------------------------
	const BORE = { x: 112, w: 150 };
	const CX = BORE.x + BORE.w / 2;
	const PX_PER_M3 = 280_000; // 0.5 L stroke = 140 px
	const STROKE_PX = 140;
	const A = CRANK * STROKE_PX;
	const L = ROD * STROKE_PX;
	const CRANK_Y = 488;
	const PIN_TDC = CRANK_Y - A - L;
	const PISTON_H = 34;
	const pistonTop = $derived(PIN_TDC - 14 + now.x * STROKE_PX);
	const head = $derived(PIN_TDC - 14 - c.states[1].V * PX_PER_M3);
	const th = $derived((now.crank * Math.PI) / 180);
	const crankPin = $derived({ x: CX + A * Math.sin(th), y: CRANK_Y - A * Math.cos(th) });
	const pin = $derived({ x: CX, y: pistonTop + 14 });

	// Chart.
	const pMax = $derived(kind === 'diesel' ? 100 : 150);
	const pTween = new Tween(150, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = pMax;
		untrack(() => pTween.set(v, { duration: reduced ? 0 : 700 }));
	});
	const sx = scale([0, 0.65], [452, 905]);
	const sy = $derived(scale([0, pTween.current], [400, 74]));
	const X = (V: number) => sx(V * 1000);
	const Y = (P: number) => sy(bar(P));

	const pts = $derived(loop(c, 60));
	const loopPath = $derived(
		pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.V).toFixed(1)} ${Y(p.P).toFixed(1)}`).join(' ') + 'Z'
	);
	/** Pressure on the expansion (leg 2) or compression (leg 0) curve at volume V. */
	function pAt(V: number, leg: 0 | 2) {
		const a = c.states[leg === 0 ? 0 : 2];
		return a.P * Math.pow(a.V / V, 1.4);
	}
	/** The top of the loop is too close to the axis title for a label above it. */
	const highTop = $derived(Y(c.states[2].P) - 14 < 90);
	/** Where the "work = area" pointer touches the loop: past the end of a Diesel burn. */
	const workV = $derived(Math.max(0.105e-3, c.states[2].V * 1.3));
	/** The path traced so far in this cycle (strokes phase). */
	const traced = $derived.by(() => {
		if (phase !== 'strokes') return '';
		const n = 160;
		let d = '';
		for (let k = 0; k <= n; k++) {
			const g = engineAt(c, (u * k) / n).gas;
			d += `${k ? 'L' : 'M'}${X(g.V).toFixed(1)} ${Y(g.P).toFixed(1)}`;
		}
		return d;
	});

	// ---- what is happening ----------------------------------------------------------------------
	const strokeNames: Record<Stroke, { n: number; name: string }> = $derived({
		intake: { n: 1, name: 'Intake' },
		compression: { n: 2, name: 'Compression' },
		combustion: { n: 3, name: kind === 'diesel' ? 'Fuel injected' : 'Spark: combustion' },
		power: { n: 3, name: 'Power' },
		'exhaust-open': { n: 4, name: 'Exhaust valve opens' },
		exhaust: { n: 4, name: 'Exhaust' }
	});
	const sn = $derived(strokeNames[now.stroke]);
	const intakeOpen = $derived(now.stroke === 'intake');
	const exhaustOpen = $derived(now.stroke === 'exhaust' || now.stroke === 'exhaust-open');
	const burning = $derived(
		kind === 'otto' ? now.stroke === 'combustion' : now.stroke === 'power' && now.V <= c.states[2].V
	);
	const sparkOn = $derived(kind === 'otto' && now.stroke === 'combustion');
	const injectOn = $derived(
		kind === 'diesel' && (now.stroke === 'combustion' || (now.stroke === 'power' && burning))
	);
	const burnt = $derived(
		now.stroke === 'power' ||
			now.stroke === 'exhaust' ||
			now.stroke === 'exhaust-open' ||
			(now.stroke === 'combustion' && kind === 'otto')
	);
	const valveLift = (open: boolean) => (open ? 9 : 0);

	// ---- readouts -------------------------------------------------------------------------------
	const rows: Row[] = $derived.by(() => {
		if (phase === 'strokes') {
			return [
				{ id: 'crank', label: 'Crank angle', value: `${fmt(now.crank)}°` },
				{ id: 'p', label: 'Pressure', value: `${fmt(bar(now.gas.P), 1)} bar` },
				{ id: 'T', label: 'Gas temperature', value: `${fmt(now.gas.T)} K` }
			];
		}
		const base: Row[] = [
			{ id: 'qin', label: 'Heat in (burning)', value: `${fmt(c.qIn)} J`, color: 'var(--he-hot)' },
			{ id: 'w', label: 'Work out (the area)', value: `${fmt(c.work)} J`, color: 'var(--he-loop)' },
			{
				id: 'qout',
				label: 'Heat out (exhaust)',
				value: `${fmt(c.qOut)} J`,
				color: 'var(--he-cold)'
			},
			{ id: 'eff', label: 'Efficiency', value: pct(c.efficiency), strong: true }
		];
		if (kind === 'diesel') {
			base.splice(3, 0, {
				id: 'otto-same',
				label: `Otto cycle at ${fmt(r, r % 1 ? 1 : 0)} : 1`,
				value: pct(ottoEfficiency(r))
			});
		}
		return base;
	});

	// Ratio inset.
	const IN = { x0: 700, x1: 898, y0: 98, y1: 210 };
	const ix = scale([6, 14], [IN.x0, IN.x1]);
	const iy = scale([0.4, 0.7], [IN.y1, IN.y0]);
	const effCurve = Array.from({ length: 41 }, (_, k) => 6 + (k / 40) * 8)
		.map((rr, k) => `${k ? 'L' : 'M'}${ix(rr).toFixed(1)} ${iy(ottoEfficiency(rr)).toFixed(1)}`)
		.join(' ');

	const stateLabelOffsets = [
		[12, 5],
		[-14, 4],
		[-14, 4],
		[0, -14]
	];
	const showStates = $derived(phase !== 'strokes');
	const tooHot = $derived(!c.valid);
</script>

<g>
	<!-- ===== the engine ===== -->
	<Readout id="eng-title" order={0} label="Now" value="{sn.n} {sn.name}">
		<Label x={CX} y={40} text="{sn.n} · {sn.name}" size={16} weight={600} />
	</Readout>

	<!-- intake and exhaust ports -->
	<path
		d="M{BORE.x - 70} {head - 34} L{BORE.x + 30} {head - 34} L{BORE.x + 40} {head - 6}"
		fill="none"
		stroke="var(--he-cold)"
		stroke-width="14"
		stroke-linejoin="round"
		opacity="0.25"
	/>
	<path
		d="M{BORE.x + BORE.w + 70} {head - 34} L{BORE.x + BORE.w - 30} {head - 34} L{BORE.x +
			BORE.w -
			40} {head - 6}"
		fill="none"
		stroke="var(--he-metal-edge)"
		stroke-width="14"
		stroke-linejoin="round"
		opacity="0.3"
	/>
	{#if intakeOpen}
		{#each [0, 1, 2] as k (k)}
			{@const s = cycle(t, 0.9, k / 3)}
			<circle
				cx={BORE.x - 60 + s * 95}
				cy={head - 34 + smoothstep(0.75, 1, s) * 26}
				r="3.2"
				fill="var(--he-cold)"
				opacity={1 - smoothstep(0.85, 1, s)}
			/>
		{/each}
	{/if}
	{#if exhaustOpen}
		{#each [0, 1, 2] as k (k)}
			{@const s = cycle(t, 0.9, k / 3)}
			<circle
				cx={BORE.x + BORE.w - 35 + s * 95}
				cy={head - 8 - smoothstep(0, 0.25, s) * 26}
				r="3.2"
				fill="var(--he-metal-edge)"
				opacity={smoothstep(0, 0.1, s) * (1 - smoothstep(0.85, 1, s))}
			/>
		{/each}
	{/if}
	<Readout id="ports">
		<Label x={BORE.x - 40} y={head - 50} text="air in" size={12} color="var(--he-cold)" />
		<Label x={BORE.x + BORE.w + 40} y={head - 50} text="exhaust out" size={12} muted />
	</Readout>

	<!-- the gas -->
	<Gas
		x={BORE.x}
		y={head}
		w={BORE.w}
		h={pistonTop - head}
		T={now.gas.T}
		{t}
		{reduced}
		{burnt}
		n={22}
	/>
	{#if burning}
		<rect
			x={BORE.x}
			y={head}
			width={BORE.w}
			height={pistonTop - head}
			fill="var(--he-hot)"
			opacity="0.25"
		/>
	{/if}

	<!-- cylinder walls and head -->
	<path
		d="M{BORE.x} {head - 4} L{BORE.x} {PIN_TDC + STROKE_PX + 30} M{BORE.x + BORE.w} {head -
			4} L{BORE.x + BORE.w} {PIN_TDC + STROKE_PX + 30}"
		stroke="var(--stage-ink)"
		stroke-width="3"
	/>
	<rect
		x={BORE.x - 6}
		y={head - 14}
		width={BORE.w + 12}
		height="12"
		rx="2"
		fill="var(--he-metal)"
		stroke="var(--he-metal-edge)"
	/>
	<!-- valves -->
	{#each [{ x: BORE.x + 36, open: intakeOpen }, { x: BORE.x + BORE.w - 36, open: exhaustOpen }] as vlv (vlv.x)}
		{@const lift = valveLift(vlv.open)}
		<g transform="translate(0 {lift})">
			<line
				x1={vlv.x}
				x2={vlv.x}
				y1={head - 40}
				y2={head - 4}
				stroke="var(--he-metal-edge)"
				stroke-width="3"
			/>
			<path
				d="M{vlv.x - 14} {head - 2} L{vlv.x + 14} {head - 2} L{vlv.x + 4} {head - 8} L{vlv.x -
					4} {head - 8} Z"
				fill="var(--he-metal-edge)"
			/>
		</g>
	{/each}
	<!-- spark plug or injector -->
	<rect x={CX - 5} y={head - 42} width="10" height="30" rx="2" fill="var(--stage-ink-muted)" />
	{#if sparkOn}
		<path
			d="M{CX} {head - 2} l-6 10 l8 0 l-6 12"
			fill="none"
			stroke="var(--he-hot)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<circle
			cx={CX}
			cy={head + 6}
			r={12 + 6 * smoothstep(0, 1, now.f)}
			fill="var(--he-hot)"
			opacity="0.35"
		/>
	{/if}
	{#if injectOn}
		<path
			d="M{CX} {head - 2} l-16 {Math.min(40, pistonTop - head - 4)} M{CX} {head - 2} l0 {Math.min(
				44,
				pistonTop - head - 4
			)} M{CX} {head - 2} l16 {Math.min(40, pistonTop - head - 4)}"
			stroke="var(--he-hot)"
			stroke-width="2"
			stroke-dasharray="3 3"
			opacity="0.8"
		/>
	{/if}
	<Readout id="plug">
		<Label
			x={CX}
			y={head - 50}
			text={kind === 'diesel' ? 'injector' : 'spark plug'}
			size={11}
			muted
			anchor="middle"
		/>
	</Readout>

	<!-- piston, rod and crank -->
	<rect
		x={BORE.x + 3}
		y={pistonTop}
		width={BORE.w - 6}
		height={PISTON_H}
		rx="4"
		fill="var(--he-metal)"
		stroke="var(--he-metal-edge)"
	/>
	<circle
		cx={CX}
		cy={CRANK_Y}
		r={A + 14}
		fill="none"
		stroke="var(--stage-line)"
		stroke-dasharray="3 5"
	/>
	<line
		x1={pin.x}
		y1={pin.y}
		x2={crankPin.x}
		y2={crankPin.y}
		stroke="var(--he-metal-edge)"
		stroke-width="10"
		stroke-linecap="round"
	/>
	<line
		x1={CX}
		y1={CRANK_Y}
		x2={crankPin.x}
		y2={crankPin.y}
		stroke="var(--stage-ink-muted)"
		stroke-width="14"
		stroke-linecap="round"
	/>
	<circle
		cx={CX}
		cy={CRANK_Y}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<circle
		cx={pin.x}
		cy={pin.y}
		r="4"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<circle
		cx={crankPin.x}
		cy={crankPin.y}
		r="4"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>

	<!-- ===== the chart ===== -->
	<Axes
		{sx}
		{sy}
		xLabel="volume (litres)"
		yLabel="pressure (bar)"
		xTicks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
		xFormat={(x: number) => fmt(x, 1)}
	/>
	{#if phase !== 'strokes'}
		<path d={loopPath} fill="var(--he-loop-fill)" />
	{/if}
	<path
		d={loopPath}
		fill="none"
		stroke="var(--he-loop)"
		stroke-width={phase === 'strokes' ? 1.5 : 3}
		opacity={phase === 'strokes' ? 0.35 : 1}
		stroke-linejoin="round"
	/>
	{#if phase === 'strokes'}
		<path d={traced} fill="none" stroke="var(--he-loop)" stroke-width="3" stroke-linejoin="round" />
		<Readout id="pump">
			<Label
				x={452}
				y={Y(0) + 34}
				text="intake and exhaust: along the bottom, at about 1 bar"
				size={12}
				muted
				anchor="start"
			/>
		</Readout>
	{/if}
	{#if showStates}
		{#each c.states as s, i (i)}
			<circle cx={X(s.V)} cy={Y(s.P)} r="4" fill="var(--he-loop)" />
			<Readout id="st{i}">
				<Label
					x={X(s.V) + (kind === 'diesel' && i === 2 ? 10 : stateLabelOffsets[i][0])}
					y={Y(s.P) + (kind === 'diesel' && i === 2 ? -8 : stateLabelOffsets[i][1])}
					text={String(i + 1)}
					size={13}
					weight={700}
					color="var(--he-loop)"
				/>
			</Readout>
		{/each}
		<Readout id="heat-labels">
			<Label
				x={X(c.states[1].V) +
					(kind === 'diesel' ? (X(c.states[2].V) - X(c.states[1].V)) / 2 : highTop ? 8 : 0)}
				y={highTop ? Y(c.states[2].P) + 14 : Y(c.states[2].P) - 14}
				text="heat in"
				size={12}
				color="var(--he-hot)"
				anchor={highTop && kind === 'otto' ? 'start' : 'middle'}
			/>
			<Label
				x={X(c.states[0].V) + 12}
				y={Y(c.states[3].P) - 16}
				text="heat out"
				size={12}
				color="var(--he-cold)"
				anchor="start"
			/>
			<line
				x1={X(workV)}
				y1={(Y(pAt(workV, 2)) + Y(pAt(workV, 0))) / 2}
				x2={X(0.2e-3)}
				y2={Y(0) - 114}
				stroke="var(--he-loop)"
				stroke-width="1.2"
			/>
			<circle
				cx={X(workV)}
				cy={(Y(pAt(workV, 2)) + Y(pAt(workV, 0))) / 2}
				r="2.5"
				fill="var(--he-loop)"
			/>
			<Label
				x={X(0.2e-3) + 4}
				y={Y(0) - 120}
				text="work = area inside"
				size={12}
				color="var(--he-loop)"
				anchor="start"
			/>
		</Readout>
	{/if}
	<circle
		cx={X(now.gas.V)}
		cy={Y(now.gas.P)}
		r="7"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>

	{#if phase === 'ratio'}
		<g>
			<rect
				x={IN.x0 - 44}
				y={IN.y0 - 34}
				width={IN.x1 - IN.x0 + 56}
				height={IN.y1 - IN.y0 + 58}
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout id="inset-title">
				<text x={IN.x0 - 34} y={IN.y0 - 16} font-size="12" class="muted"
					>efficiency against ratio</text
				>
			</Readout>
			{#each [0.4, 0.5, 0.6, 0.7] as e (e)}
				<line x1={IN.x0} x2={IN.x1} y1={iy(e)} y2={iy(e)} stroke="var(--stage-grid)" />
				<text x={IN.x0 - 6} y={iy(e) + 4} font-size="11" text-anchor="end" class="muted"
					>{pct(e)}</text
				>
			{/each}
			{#each [6, 10, 14] as rr (rr)}
				<text x={ix(rr)} y={IN.y1 + 16} font-size="11" text-anchor="middle" class="muted">{rr}</text
				>
			{/each}
			<path d={effCurve} fill="none" stroke="var(--he-loop)" stroke-width="2.5" />
			<circle cx={ix(r)} cy={iy(ottoEfficiency(r))} r="5" fill="var(--he-loop)" />
		</g>
	{/if}
	{#if tooHot}
		<Readout
			id="toohot"
			order={9}
			label="Note"
			value="the compression alone is already hotter than the flame"
		>
			<Label
				x={678}
				y={140}
				text="compression alone already reaches this temperature"
				pill
				size={12}
			/>
		</Readout>
	{/if}

	<Card x={560} y={448} w={330} {rows} order={1} />
</g>
