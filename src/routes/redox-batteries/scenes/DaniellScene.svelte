<script lang="ts">
	/**
	 * The Daniell cell: zinc in zinc sulfate (left), copper in copper sulfate (right), a
	 * salt bridge of potassium nitrate between the solutions and a wire over the top.
	 *
	 * Focus (`step.hints.focus`):
	 *   split   — a lamp and a switch in the wire (control `closed`). Closed: electrons run
	 *             along the wire, Zn²⁺ leave the zinc, Cu²⁺ plate onto the copper, NO₃⁻ and K⁺
	 *             drift through the bridge: per cycle 2 e⁻, 1 Zn²⁺, 1 Cu²⁺, 1 NO₃⁻ and 1 K⁺, so
	 *             the charge balances everywhere. Open: everything fades out together.
	 *   nernst  — a voltmeter instead of the lamp (it draws almost no current, so nothing
	 *             moves); controls `zn`, `cu` (mol/L); the panel plots E against log₁₀ Q.
	 *   rundown — the lamp again; control `used` (share of the Cu²⁺ turned into copper);
	 *             the panel plots E against the charge passed (Faraday), from `daniellAt`.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Label,
		along,
		cycle,
		linePath,
		scale,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Ion from '../parts/Ion.svelte';
	import {
		DANIELL_E0,
		DANIELL_MAX_E,
		FARADAY,
		NERNST_SLOPE,
		daniellAt,
		daniellVoltage
	} from '../model';
	import { fmtConc, fmtV, superscript } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'split'));
	const meter = $derived(focus === 'nernst');

	// ---- state ------------------------------------------------------------------------------
	const closed = $derived(focus !== 'split' || params.closed !== false);
	const usedPct = $derived(focus === 'rundown' ? Number(params.used ?? 0) : 0);
	const run = $derived(daniellAt(usedPct / 100));
	const zn = $derived(
		focus === 'nernst' ? Number(params.zn ?? 1) : focus === 'rundown' ? run.zn : 1
	);
	const cu = $derived(
		focus === 'nernst' ? Number(params.cu ?? 1) : focus === 'rundown' ? run.cu : 1
	);
	const voltage = $derived(focus === 'rundown' ? run.voltage : daniellVoltage(zn, cu));
	// Current flows through the lamp while the circuit is closed and the cell has any push.
	const flowing = $derived(!meter && closed && voltage > 0.005);
	const on = new Tween(
		untrack(() => (flowing ? 1 : 0)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const f = flowing ? 1 : 0;
		untrack(() => void on.set(f, { duration: reduced ? 0 : 700 }));
	});
	const flow = $derived(on.current);
	// The switch lever's angle: lifted while the wire is disconnected (split only).
	const lever = $derived(focus === 'split' ? (1 - on.current) * 0.55 : 0);

	// ---- geometry ----------------------------------------------------------------------------
	const LB = { x: 40, w: 250 };
	const RB = { x: 350, w: 250 };
	const TOP = 300;
	const BOT = 540;
	const LEVEL = 340;
	const ZN_X = 110;
	const CU_X = 500;
	const STRIP_W = 30;
	const WIRE_Y = 120;
	const LAMP = { x: 320, y: WIRE_Y };
	const SWITCH_X = 210;
	const wire: Point[] = [
		{ x: ZN_X + STRIP_W / 2, y: 230 },
		{ x: ZN_X + STRIP_W / 2, y: WIRE_Y },
		{ x: CU_X + STRIP_W / 2, y: WIRE_Y },
		{ x: CU_X + STRIP_W / 2, y: 230 }
	];
	const BRIDGE_L = 250;
	const BRIDGE_R = 390;
	const BRIDGE_TOP = 262;
	const BRIDGE_BOT = 420;
	const bridge: Point[] = [
		{ x: BRIDGE_L, y: BRIDGE_BOT - 10 },
		{ x: BRIDGE_L, y: BRIDGE_TOP },
		{ x: BRIDGE_R, y: BRIDGE_TOP },
		{ x: BRIDGE_R, y: BRIDGE_BOT - 10 }
	];
	const bridgePath = `M${BRIDGE_L} ${BRIDGE_BOT} V${BRIDGE_TOP} H${BRIDGE_R} V${BRIDGE_BOT}`;

	// Strips thin and thicken as the cell runs (rundown): 0.1 mol of zinc dissolves.
	const used = $derived(usedPct / 100);
	const znW = $derived(STRIP_W * (1 - 0.45 * used));
	const cuW = $derived(STRIP_W * (1 + 0.45 * used));

	// Solution tints: copper sulfate's blue follows [Cu²⁺] on a log scale (1 → full, 0.001 → faint).
	const blue = $derived(Math.max(0.08, Math.min(1, 1 + Math.log10(Math.max(cu, 1e-40)) / 3.4)));

	// ---- particles (pure functions of t) ---------------------------------------------------------
	const P = 3.2;
	const electrons = $derived(
		Array.from({ length: 10 }, (_, i) => {
			const u = cycle(t, P * 2.5, i / 10);
			return {
				i,
				...along(wire, u),
				o: flow * smoothstep(0, 0.05, u) * (1 - smoothstep(0.95, 1, u))
			};
		})
	);
	function swim(u: number, x0: number, x1: number, y: number) {
		return {
			x: x0 + (x1 - x0) * u,
			y: y + 8 * Math.sin(u * Math.PI * 2),
			o: flow * smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u))
		};
	}
	const lanes = [380, 440, 500];
	const znIons = $derived(
		lanes.map((y, k) => ({ k, ...swim(cycle(t, P * 3, k / 3), ZN_X + STRIP_W + 14, 220, y) }))
	);
	const cuIons = $derived(
		lanes.map((y, k) => ({ k, ...swim(cycle(t, P * 3, k / 3 + 0.5), 450, CU_X - 14, y) }))
	);
	const nitrate = $derived(
		[0, 1].map((k) => {
			const u = cycle(t, P * 3, k / 2);
			return {
				k,
				...along(bridge.slice().reverse(), u),
				o: flow * smoothstep(0, 0.08, u) * (1 - smoothstep(0.92, 1, u))
			};
		})
	);
	const potassium = $derived(
		[0, 1].map((k) => {
			const u = cycle(t, P * 3, k / 2 + 0.25);
			return {
				k,
				...along(bridge, u),
				o: flow * smoothstep(0, 0.08, u) * (1 - smoothstep(0.92, 1, u))
			};
		})
	);
	// Spectator sulfate ions, fixed.
	const sulfates = [
		{ x: 190, y: 470 },
		{ x: 80, y: 380 },
		{ x: 560, y: 380 },
		{ x: 430, y: 500 }
	];

	// ---- the panel -----------------------------------------------------------------------------
	const PX0 = 680;
	const PX1 = 930;
	const PY0 = 300;
	const PY1 = 500;
	// Nernst: E against log₁₀ Q from −3 to +3.
	const nx = scale([-3, 3], [PX0, PX1]);
	const ny = scale([1.0, 1.2], [PY1, PY0]);
	const logQ = $derived(Math.log10(zn / cu));
	const nernstLine = [-3, 3].map((q) => ({ q, v: DANIELL_E0 - (NERNST_SLOPE / 2) * q }));
	// Rundown: E against the charge passed.
	const maxAh = (DANIELL_MAX_E * FARADAY) / 3600;
	const rx = scale([0, 6], [PX0, PX1]);
	const ry = scale([0, 1.2], [PY1, PY0]);
	const runCurve = (() => {
		const us: number[] = [];
		for (let i = 0; i <= 100; i++) us.push(i / 100);
		us.push(0.999, 0.9999, 0.99999, 0.999999, 1);
		return us.sort((a, b) => a - b).map((u) => daniellAt(u));
	})();
	const cuText = $derived(fmtConc(cu, run.logCu));
	const status = $derived.by(() => {
		if (focus === 'split')
			return closed ? 'running: the lamp is lit' : 'wire disconnected: both halves stop';
		if (focus === 'rundown')
			return voltage < 0.005
				? 'equilibrium: E = 0, the cell is flat'
				: usedPct > 99
					? 'the last copper ions: the voltage collapses'
					: 'running';
		return 'a voltmeter draws almost no current';
	});
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- beakers and solutions -->
	{#each [LB, RB] as b, i (i)}
		<path
			d="M{b.x + 2} {LEVEL} H{b.x + b.w - 2} V{BOT - 12} Q{b.x + b.w - 2} {BOT - 2} {b.x +
				b.w -
				12} {BOT - 2} H{b.x + 12} Q{b.x + 2} {BOT - 2} {b.x + 2} {BOT - 12} Z"
			fill={i === 0 ? 'var(--rb-solution-zn)' : 'var(--rb-solution-cu)'}
			opacity={i === 0 ? 0.9 : 0.25 + 0.75 * blue}
		/>
		<path
			d="M{b.x} {TOP} V{BOT - 12} Q{b.x} {BOT} {b.x + 12} {BOT} H{b.x + b.w - 12} Q{b.x +
				b.w} {BOT} {b.x + b.w} {BOT - 12} V{TOP}"
			fill="none"
			stroke="var(--rb-glass)"
			stroke-width="2"
		/>
	{/each}

	<!-- salt bridge -->
	<path
		d={bridgePath}
		fill="none"
		stroke="var(--rb-bridge-edge)"
		stroke-width="26"
		stroke-linejoin="round"
		opacity="0.8"
	/>
	<path
		d={bridgePath}
		fill="none"
		stroke="var(--rb-bridge)"
		stroke-width="21"
		stroke-linejoin="round"
	/>
	{#each nitrate as n (n.k)}
		<Ion x={n.x} y={n.y} r={9} fill="var(--rb-anion)" opacity={n.o} />
	{/each}
	{#each potassium as k (k.k)}
		<Ion x={k.x} y={k.y} r={9} fill="var(--rb-cation)" opacity={k.o} />
	{/each}

	<!-- electrodes -->
	<rect
		x={ZN_X + (STRIP_W - znW) / 2}
		y={220}
		width={znW}
		height={300}
		rx="3"
		fill="var(--rb-zn)"
		stroke="var(--rb-zn-edge)"
	/>
	<rect
		x={CU_X + (STRIP_W - cuW) / 2}
		y={220}
		width={cuW}
		height={300}
		rx="3"
		fill="var(--rb-cu)"
		stroke="var(--rb-cu-edge)"
	/>

	<!-- ions in the solutions -->
	{#each sulfates as s, i (i)}
		<Ion x={s.x} y={s.y} r={17} fill="var(--rb-anion)" text="SO₄²⁻" size={10} opacity={0.6} />
	{/each}
	{#each znIons as z (z.k)}
		<Ion x={z.x} y={z.y} r={16} fill="var(--rb-zn-ion)" text="Zn²⁺" size={11} opacity={z.o} />
	{/each}
	{#each cuIons as c (c.k)}
		<Ion x={c.x} y={c.y} r={16} fill="var(--rb-cu-ion)" text="Cu²⁺" size={11} opacity={c.o} />
	{/each}

	<!-- wire, switch, lamp or voltmeter -->
	<path
		d="M{wire[0].x} {wire[0].y} V{WIRE_Y} H{SWITCH_X - 18} M{SWITCH_X + 18} {WIRE_Y} H{CU_X +
			STRIP_W / 2} V{wire[3].y}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2.2"
		stroke-linejoin="round"
	/>
	<!-- the switch: a lever that lifts when the wire is disconnected -->
	<circle cx={SWITCH_X - 18} cy={WIRE_Y} r="3.5" fill="var(--stage-ink)" />
	<circle cx={SWITCH_X + 18} cy={WIRE_Y} r="3.5" fill="var(--stage-ink)" />
	<line
		x1={SWITCH_X - 18}
		y1={WIRE_Y}
		x2={SWITCH_X - 18 + 36 * Math.cos(lever)}
		y2={WIRE_Y - 36 * Math.sin(lever)}
		stroke="var(--stage-ink)"
		stroke-width="2.6"
		stroke-linecap="round"
	/>
	{#each electrons as e (e.i)}
		<circle
			cx={e.x}
			cy={e.y}
			r="5"
			fill="var(--rb-electron)"
			stroke="var(--stage-bg)"
			opacity={e.o}
		/>
	{/each}
	{#if meter}
		<rect
			x={LAMP.x - 52}
			y={LAMP.y - 30}
			width="104"
			height="60"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<text x={LAMP.x} y={LAMP.y + 8} text-anchor="middle" style:font-size="22px" font-weight="700"
			>{fmtV(voltage, 3)}</text
		>
		<Label x={LAMP.x} y={LAMP.y - 40} text="voltmeter" size={12} muted />
	{:else}
		<circle
			cx={LAMP.x}
			cy={LAMP.y}
			r={30}
			fill="var(--rb-lamp)"
			opacity={0.35 * flow}
			filter="url(#glow)"
		/>
		<circle
			cx={LAMP.x}
			cy={LAMP.y}
			r={17}
			fill="var(--rb-lamp)"
			fill-opacity={0.15 + 0.85 * flow}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<path
			d="M{LAMP.x - 7} {LAMP.y + 4} l4 -9 l3 9 l3 -9 l4 9"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		<Label x={LAMP.x} y={LAMP.y - 30} text="lamp" size={12} muted />
	{/if}

	<!-- labels -->
	<Readout id="anode" order={10} label="Zinc: the anode (−)" marker={1} at={[ZN_X + 15, 200]}>
		<Label x={ZN_X + 15} y={206} text="zinc: anode (−)" size={13} weight={600} />
	</Readout>
	<Readout id="cathode" order={11} label="Copper: the cathode (+)" marker={2} at={[CU_X + 15, 200]}>
		<Label x={CU_X + 15} y={206} text="copper: cathode (+)" size={13} weight={600} />
	</Readout>
	<Readout id="sol">
		<Label
			x={LB.x + LB.w / 2}
			y={BOT + 24}
			text="zinc sulfate, ZnSO₄  ·  {fmtConc(zn)}"
			size={12}
		/>
		<Label x={RB.x + RB.w / 2} y={BOT + 24} text="copper sulfate, CuSO₄  ·  {cuText}" size={12} />
		<Label
			x={(BRIDGE_L + BRIDGE_R) / 2}
			y={BRIDGE_TOP - 22}
			text="salt bridge (K⁺ NO₃⁻)"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="flow" opacity={flow}>
		<Label
			x={LAMP.x + 100}
			y={WIRE_Y - 14}
			text="e⁻ → through the wire"
			size={12}
			color="var(--rb-electron)"
			opacity={flow}
		/>
	</Readout>

	<!-- the panel -->
	<Readout id="v" order={1} label="Cell voltage" value={fmtV(voltage, 3)}>
		<text x={PX0} y={64} style:font-size="12px" class="muted">cell voltage</text>
		<text x={PX0} y={98} style:font-size="30px" font-weight="700">{fmtV(voltage, 3)}</text>
	</Readout>
	<Readout id="status" order={2} label="Now" value={status}>
		<Label x={PX0} y={128} text={status} size={13} anchor="start" />
	</Readout>

	{#if focus === 'split'}
		<Readout id="halves" order={3} label="The two halves" value="Zn → Zn²⁺ + 2e⁻ · Cu²⁺ + 2e⁻ → Cu">
			<Label
				x={PX0}
				y={190}
				text="left: Zn → Zn²⁺ + 2e⁻"
				size={13}
				anchor="start"
				color="var(--rb-zn-ion)"
				weight={600}
			/>
			<Label x={PX0 + 14} y={210} text="oxidation, at the anode" size={11} anchor="start" muted />
			<Label
				x={PX0}
				y={246}
				text="right: Cu²⁺ + 2e⁻ → Cu"
				size={13}
				anchor="start"
				color="var(--rb-cu-ion)"
				weight={600}
			/>
			<Label x={PX0 + 14} y={266} text="reduction, at the cathode" size={11} anchor="start" muted />
		</Readout>
		<Readout id="key">
			<circle cx={PX0 + 6} cy={318} r="5" fill="var(--rb-electron)" />
			<Label x={PX0 + 20} y={322} text="electrons: only in the metal" size={12} anchor="start" />
			<circle cx={PX0 + 6} cy={344} r="7" fill="var(--rb-anion)" />
			<Label x={PX0 + 20} y={348} text="NO₃⁻ drift to the zinc side" size={12} anchor="start" />
			<circle cx={PX0 + 6} cy={370} r="7" fill="var(--rb-cation)" />
			<Label x={PX0 + 20} y={374} text="K⁺ drift to the copper side" size={12} anchor="start" />
			<Label
				x={PX0}
				y={410}
				text="every 2 e⁻ in the wire: 1 Zn²⁺ in,"
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={PX0}
				y={428}
				text="1 Cu²⁺ out, 2 charges across the bridge"
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	{:else if focus === 'nernst'}
		<Readout
			id="q"
			order={3}
			label="Q = [Zn²⁺] ÷ [Cu²⁺]"
			value={Number((zn / cu).toPrecision(3)).toString()}
		>
			<Label
				x={PX0}
				y={176}
				text="Q = [Zn²⁺] ÷ [Cu²⁺] = {fmtConc(zn, undefined, false)} ÷ {fmtConc(
					cu,
					undefined,
					false
				)} = 10{superscript(logQ)}"
				size={13}
				anchor="start"
			/>
			<Label x={PX0} y={204} text="E = 1.104 − 0.0296 × log₁₀ Q" size={13} anchor="start" />
			<Label
				x={PX0}
				y={228}
				text="  = 1.104 − 0.0296 × ({logQ.toFixed(0)}) = {fmtV(voltage, 3)}"
				size={13}
				anchor="start"
				weight={600}
			/>
		</Readout>
		<Axes
			sx={nx}
			sy={ny}
			xLabel="log₁₀ Q"
			yLabel="E (V)"
			xTicks={[-3, -2, -1, 0, 1, 2, 3]}
			yTicks={[1, 1.05, 1.1, 1.15, 1.2]}
			yFormat={(v) => v.toFixed(2)}
		/>
		<path
			d={linePath(
				nernstLine,
				(p) => p.q,
				(p) => p.v,
				nx,
				ny
			)}
			fill="none"
			stroke="var(--rb-cu-ion)"
			stroke-width="2.5"
		/>
		<circle
			cx={nx(logQ)}
			cy={ny(voltage)}
			r="7"
			fill="var(--rb-cu-ion)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<Readout id="slope">
			<Label
				x={PX0 + 10}
				y={PY1 - 14}
				text="−0.030 V for each tenfold rise of Q"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else}
		<Readout id="ah" order={3} label="Charge passed (Faraday)" value="{run.ah.toFixed(2)} Ah">
			<Label
				x={PX0}
				y={176}
				text="charge passed: {run.ah.toFixed(2)} Ah = {run.electrons.toFixed(3)} mol e⁻"
				size={13}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="ions"
			order={4}
			label="Left in the solutions"
			value="Cu²⁺ {cuText} · Zn²⁺ {fmtConc(zn)}"
		>
			<Label
				x={PX0}
				y={204}
				text="Cu²⁺ left: {cuText}"
				size={13}
				anchor="start"
				color="var(--rb-cu-ion)"
			/>
			<Label
				x={PX0}
				y={228}
				text="Zn²⁺: {fmtConc(zn)}"
				size={13}
				anchor="start"
				color="var(--rb-zn-ion)"
			/>
		</Readout>
		<Axes
			sx={rx}
			sy={ry}
			xLabel="charge passed (Ah)"
			yLabel="E (V)"
			xTicks={[0, 1, 2, 3, 4, 5, 6]}
			yTicks={[0, 0.2, 0.4, 0.6, 0.8, 1, 1.2]}
			yFormat={(v) => v.toFixed(1)}
		/>
		<path
			d={linePath(
				runCurve,
				(p) => p.ah,
				(p) => p.voltage,
				rx,
				ry
			)}
			fill="none"
			stroke="var(--rb-cu-ion)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<line
			x1={rx(maxAh)}
			x2={rx(maxAh)}
			y1={PY0}
			y2={PY1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Readout id="max">
			<Label
				x={rx(maxAh) - 4}
				y={PY0 - 8}
				text="all 0.1 mol Cu²⁺: 5.36 Ah"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
		<circle
			cx={rx(run.ah)}
			cy={ry(voltage)}
			r="7"
			fill="var(--rb-cu-ion)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/if}
</g>
