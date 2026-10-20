<script lang="ts">
	/**
	 * The pressure-enthalpy diagram of the chosen refrigerant (pressure on a log scale): the
	 * saturation dome and the cycle 1 -> 2 -> 3 -> 4 drawn on it, with the COPs and the Carnot COP
	 * for the same temperatures. CO2 runs transcritical, with the gas cooler above the dome.
	 */
	import { Label, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, dome, FLUIDS, satAtP, type Fluid } from '../model';

	let { step, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'idea'));
	const fluid: Fluid = $derived(
		phase === 'co2'
			? 'co2'
			: phase === 'fluids'
				? (String(params.fluid ?? 'r134a') as Fluid)
				: 'r134a'
	);
	const K = (c: number) => c + 273.15;
	const tEvap = $derived(K(Number(params.tevap ?? 0)));
	const losses = $derived(phase === 'losses');
	const c = $derived(
		cycle({
			fluid,
			tEvap,
			high:
				phase === 'co2'
					? { p: Number(params.pgc ?? 9), tOut: K(Number(params.tout ?? 35)) }
					: { tCond: K(Number(params.tcond ?? 40)) },
			eta: losses ? Number(params.eta ?? 0.75) : phase === 'co2' ? 0.75 : 1,
			superheat: losses ? Number(params.superheat ?? 5) : 0,
			subcool: losses ? Number(params.subcool ?? 5) : 0
		})
	);
	const leg = $derived(phase === 'legs' ? String(params.leg ?? 'compress') : '');
	/** For CO2: the gas cooler pressure (7.5-12 MPa, 0.1 MPa steps) with the highest heating COP. */
	const bestP = $derived.by(() => {
		if (phase !== 'co2') return null;
		let best = { p: 7.5, cop: 0 };
		for (let p = 7.5; p <= 12.0001; p += 0.1) {
			const cop = cycle({
				fluid: 'co2',
				tEvap,
				high: { p, tOut: K(Number(params.tout ?? 35)) },
				eta: 0.75
			}).copHeating;
			if (cop > best.cop) best = { p, cop };
		}
		return best;
	});

	// ---- axes: h across, log p up ------------------------------------------------------------------
	const X0 = 90;
	const X1 = 640;
	const Y0 = 60;
	const Y1 = 520;
	const domePts = $derived(dome(fluid));
	const RANGES: Record<Fluid, { p: [number, number]; h: [number, number] }> = {
		r134a: { p: [0.05, 5], h: [140, 480] },
		propane: { p: [0.1, 6], h: [50, 750] },
		co2: { p: [0.8, 15], h: [60, 560] }
	};
	const range = $derived(RANGES[fluid]);
	const PX = $derived(
		(h: number) => X0 + ((h - range.h[0]) / (range.h[1] - range.h[0])) * (X1 - X0)
	);
	const PY = $derived(
		(p: number) => Y1 - (Math.log(p / range.p[0]) / Math.log(range.p[1] / range.p[0])) * (Y1 - Y0)
	);
	const domePath = $derived(
		domePts.map((d, i) => `${i ? 'L' : 'M'}${PX(d.h).toFixed(1)} ${PY(d.p).toFixed(1)}`).join(' ')
	);
	const pTicks = $derived(
		[0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10].filter((p) => p >= range.p[0] && p <= range.p[1])
	);
	const hTicks = $derived(
		Array.from({ length: 20 }, (_, i) => Math.ceil(range.h[0] / 100) * 100 + i * 100).filter(
			(h) => h <= range.h[1]
		)
	);
	const pts = $derived(c.points.map((q) => ({ x: PX(q.h), y: PY(q.p) })));
	const C = (T: number) => `${Math.round(T - 273.15)} °C`;
	const legs = [
		{ id: 'compress', from: 0, to: 1, color: 'var(--hp-work)' },
		{ id: 'condense', from: 1, to: 2, color: 'var(--hp-hot)' },
		{ id: 'expand', from: 2, to: 3, color: 'var(--hp-valve)' },
		{ id: 'evaporate', from: 3, to: 0, color: 'var(--hp-cold)' }
	];
	// ---- dragging the two pressure lines -----------------------------------------------------
	const draggable = $derived(phase === 'idea' || phase === 'cop' || phase === 'fluids');
	const LIMITS: Record<string, [number, number]> = { tevap: [-30, 15], tcond: [25, 70] };
	function setTemp(id: string, celsius: number) {
		const [lo, hi] = LIMITS[id];
		setParam(id, Math.round(Math.min(hi, Math.max(lo, celsius))));
	}
	/** The boiling temperature at the pressure under screen height y. */
	function tempAt(y: number) {
		const p = range.p[0] * Math.exp(((Y1 - y) / (Y1 - Y0)) * Math.log(range.p[1] / range.p[0]));
		return satAtP(fluid, p).T - 273.15;
	}
	function drag(e: PointerEvent, id: string) {
		startDrag(e, (q) => setTemp(id, tempAt(q.y)));
	}
	function key(e: KeyboardEvent, id: string) {
		const d =
			e.key === 'ArrowUp' || e.key === 'ArrowRight'
				? 1
				: e.key === 'ArrowDown' || e.key === 'ArrowLeft'
					? -1
					: 0;
		if (!d) return;
		e.preventDefault();
		setTemp(id, Number(params[id] ?? (id === 'tevap' ? 0 : 40)) + d);
	}
	const NAMES: Record<Fluid, string> = { r134a: 'R-134a', propane: 'propane', co2: 'CO₂' };
	const PANEL = 670;
</script>

<g class="hp-ph">
	<!-- axes -->
	<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="none" stroke="var(--border-strong)" />
	{#each pTicks as p (p)}
		<line x1={X0} y1={PY(p)} x2={X1} y2={PY(p)} stroke="var(--border)" />
		<Readout id="hp-pt-{p}">
			<Label x={X0 - 8} y={PY(p) + 4} text={String(p)} anchor="end" size={11} muted />
		</Readout>
	{/each}
	{#each hTicks as h (h)}
		<line x1={PX(h)} y1={Y1} x2={PX(h)} y2={Y1 + 5} stroke="var(--text-muted)" />
		<Readout id="hp-ht-{h}">
			<Label x={PX(h)} y={Y1 + 20} text={String(h)} anchor="middle" size={11} muted />
		</Readout>
	{/each}
	<Label x={X0} y={Y0 - 12} text="pressure (MPa, log scale)" anchor="start" size={12} muted />
	<Label x={X1} y={Y1 + 40} text="enthalpy (kJ/kg)" anchor="end" size={12} muted />

	<!-- the dome -->
	<path d={domePath} fill="var(--surface-2)" stroke="var(--hp-dome)" stroke-width="2" />
	<Readout
		id="hp-regions"
		order={9}
		label="Regions"
		value="left of the dome liquid, inside it boiling, right of it vapour"
	>
		<Label
			x={PX(range.h[0]) + 12}
			y={PY(range.p[0]) - 40}
			text="liquid"
			anchor="start"
			size={12}
			muted
		/>
		<Label x={X1 - 12} y={PY(range.p[0]) - 40} text="vapour" anchor="end" size={12} muted />
	</Readout>

	{#if c.valid}
		<!-- the cycle -->
		{#each legs as l (l.id)}
			<line
				x1={pts[l.from].x}
				y1={pts[l.from].y}
				x2={pts[l.to].x}
				y2={pts[l.to].y}
				stroke={l.color}
				stroke-width={leg === l.id ? 7 : 4}
				opacity={leg && leg !== l.id ? 0.3 : 1}
				stroke-linecap="round"
			/>
		{/each}
		{#each pts as q, i (i)}
			<circle
				cx={q.x}
				cy={q.y}
				r="9"
				fill="var(--stage-bg)"
				stroke="var(--text)"
				stroke-width="2"
			/>
			<Label
				x={q.x}
				y={q.y + 4}
				text={String(i + 1)}
				anchor="middle"
				size={11}
				weight={700}
				halo={false}
			/>
		{/each}
		<Readout
			id="hp-temps"
			order={3}
			label="Temperatures"
			value="boils at {C(tEvap)}, compressor out {C(c.points[1].T)}, {c.transcritical
				? 'gas cooler out'
				: 'condenses at'} {C(
				c.transcritical ? c.points[2].T : c.points[2].T + Number(losses ? (params.subcool ?? 5) : 0)
			)}"
		>
			<Label
				x={(pts[3].x + pts[0].x) / 2}
				y={pts[0].y + 22}
				text="boils at {C(tEvap)}"
				anchor="middle"
				size={12}
				color="var(--hp-cold)"
				weight={600}
			/>
			<Label
				x={pts[1].x + 10}
				y={pts[1].y - 10}
				text={C(c.points[1].T)}
				anchor="start"
				size={12}
				color="var(--hp-work)"
				weight={600}
			/>
			<Label
				x={(pts[1].x + pts[2].x) / 2}
				y={pts[2].y - 14}
				text={c.transcritical
					? `gas cooler at ${c.points[1].p.toFixed(1)} MPa`
					: `condenses at ${C(c.points[2].T + (losses ? Number(params.subcool ?? 5) : 0))}`}
				anchor="middle"
				size={12}
				color="var(--hp-hot)"
				weight={600}
			/>
		</Readout>

		<!-- readouts -->
		<Readout
			id="hp-fluid"
			order={1}
			label="Refrigerant"
			value={NAMES[fluid] + (c.transcritical ? ' (transcritical)' : '')}
		>
			<Label
				x={PANEL}
				y={74}
				text="{NAMES[fluid]}{c.transcritical ? ', transcritical' : ''}"
				anchor="start"
				size={16}
				weight={700}
			/>
			<Label
				x={PANEL}
				y={94}
				text="critical point {C(FLUIDS[fluid].tc)}, {FLUIDS[fluid].pc.toFixed(2)} MPa"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
		<Readout
			id="hp-cop"
			order={2}
			label="COP"
			value="heating {c.copHeating.toFixed(2)}, cooling {c.copCooling.toFixed(
				2
			)}; Carnot reference (heating) {c.carnotHeating.toFixed(2)}"
		>
			<Label
				x={PANEL}
				y={136}
				text="heating COP {c.copHeating.toFixed(2)}"
				anchor="start"
				size={18}
				weight={700}
				color="var(--hp-hot)"
				tabular
			/>
			<Label
				x={PANEL}
				y={160}
				text="cooling COP {c.copCooling.toFixed(2)}"
				anchor="start"
				size={14}
				color="var(--hp-cold)"
				tabular
			/>
			<Label
				x={PANEL}
				y={184}
				text="Carnot reference {c.carnotHeating.toFixed(2)}"
				anchor="start"
				size={13}
				muted
				tabular
			/>
		</Readout>
		<Readout
			id="hp-energy"
			order={4}
			label="Per kilogram"
			value="work {c.work.toFixed(0)} kJ, heat delivered {c.heat.toFixed(
				0
			)} kJ, heat taken in {c.cool.toFixed(0)} kJ"
		>
			<Label x={PANEL} y={226} text="per kg of refrigerant:" anchor="start" size={12} muted />
			<Label
				x={PANEL}
				y={248}
				text="work in {c.work.toFixed(0)} kJ"
				anchor="start"
				size={13}
				color="var(--hp-work)"
				tabular
			/>
			<Label
				x={PANEL}
				y={268}
				text="heat out {c.heat.toFixed(0)} kJ"
				anchor="start"
				size={13}
				color="var(--hp-hot)"
				tabular
			/>
			<Label
				x={PANEL}
				y={288}
				text="heat in {c.cool.toFixed(0)} kJ"
				anchor="start"
				size={13}
				color="var(--hp-cold)"
				tabular
			/>
			<Label
				x={PANEL}
				y={308}
				text="vapour after the valve {Math.round(c.quality * 100)}%"
				anchor="start"
				size={13}
				color="var(--hp-valve)"
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="hp-invalid"
			order={1}
			label="No cycle"
			value="These settings don’t make the boiling cycle drawn here"
		>
			<Label
				x={PANEL}
				y={136}
				text="These settings don’t make"
				anchor="start"
				size={15}
				weight={700}
				color="var(--hp-hot)"
			/>
			<Label
				x={PANEL}
				y={158}
				text="the boiling cycle drawn here."
				anchor="start"
				size={15}
				weight={700}
				color="var(--hp-hot)"
			/>
			<Label
				x={PANEL}
				y={184}
				text="(Liquid colder than the evaporator,"
				anchor="start"
				size={12}
				muted
			/>
			<Label
				x={PANEL}
				y={202}
				text="or a valve outlet outside the dome.)"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
	{/if}
	<!-- drag the evaporating and condensing pressures on the diagram (on top, so the lines don't catch the pointer) -->
	{#if draggable && c.valid}
		{#each [{ id: 'tevap', y: pts[0].y, label: 'evaporating temperature' }, { id: 'tcond', y: pts[2].y, label: 'condensing temperature' }] as hnd (hnd.id)}
			<rect
				class="hp-drag"
				x={Math.min(pts[3].x, pts[2].x) - 10}
				y={hnd.y - 12}
				width={Math.abs(pts[1].x - pts[2].x) + 30}
				height="24"
				fill="transparent"
				role="slider"
				tabindex="0"
				aria-label="Drag the {hnd.label}"
				aria-valuenow={Number(params[hnd.id] ?? (hnd.id === 'tevap' ? 0 : 40))}
				aria-valuemin={hnd.id === 'tevap' ? -30 : 25}
				aria-valuemax={hnd.id === 'tevap' ? 15 : 70}
				onpointerdown={(e) => drag(e, hnd.id)}
				onkeydown={(e) => key(e, hnd.id)}
			/>
		{/each}
	{/if}

	{#if bestP}
		<Readout
			id="hp-best"
			order={5}
			label="Best gas cooler pressure"
			value="{bestP.p.toFixed(1)} MPa (COP {bestP.cop.toFixed(2)}), with a 75% compressor"
		>
			<Label
				x={PANEL}
				y={350}
				text="best pressure {bestP.p.toFixed(1)} MPa"
				anchor="start"
				size={14}
				weight={700}
				tabular
			/>
			<Label
				x={PANEL}
				y={370}
				text="(COP {bestP.cop.toFixed(2)}; compressor 75%)"
				anchor="start"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}
</g>

<style>
	.hp-drag {
		cursor: ns-resize;
		outline: none;
	}
	.hp-drag:focus-visible {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
