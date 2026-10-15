<script lang="ts">
	/**
	 * One qubit on the Bloch sphere, with its two amplitudes beside it.
	 *
	 * The state is the pair of Bloch angles in `params.theta` / `params.phi` (degrees); the
	 * overall phase is dropped, so α is always drawn real. Gates and measurements compute
	 * the new state with the state-vector model and write the angles back, so the sliders
	 * follow.
	 *
	 * Phases (`step.hints.phase`):
	 *   state   — drag the arrow's tip (front half of the sphere) or use the sliders; the
	 *             dials show α and β, the bars |α|² and |β|².
	 *   measure — "Measure it": one bit, drawn with Born's odds (seeded by the press number);
	 *             the arrow falls to that pole. "100 copies": counts of fresh copies of the
	 *             current state, adding up while the state stays the same.
	 *   gates   — X, H, Z, S, T turn the arrow about each gate's axis (shown, with the arc
	 *             swept); the circuit so far and the last gate's matrix are listed.
	 *
	 * Animation: the turn of a gate and the fall of a measurement are a `Tween` (900 ms,
	 * wall clock, 0 under reduced motion), started when an action's press count changes.
	 * Nothing else moves: the reader drives this scene.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Handle, Label, type Point, rng } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		GATES,
		GATE_TURNS,
		anglesOf,
		apply,
		bloch,
		fromAngles,
		measure,
		tally,
		turn,
		type Vec3
	} from '../qubits';
	import Sphere from './Sphere.svelte';
	import { arc, project, unproject } from './view';

	let { step, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'state'));
	const CX = 285;
	const CY = 305;
	const R = 195;
	const DEG = Math.PI / 180;
	const thetaDeg = $derived(clamp(Number(params.theta ?? 60), 0, 180));
	const phiDeg = $derived(((Number(params.phi ?? 0) % 360) + 360) % 360);
	const vState = $derived<Vec3>([
		Math.sin(thetaDeg * DEG) * Math.cos(phiDeg * DEG),
		Math.sin(thetaDeg * DEG) * Math.sin(phiDeg * DEG),
		Math.cos(thetaDeg * DEG)
	]);

	// ---- presses ------------------------------------------------------------------------
	type G = 'X' | 'H' | 'Z' | 'S' | 'T';
	const ACTIONS = [
		'gateX',
		'gateH',
		'gateZ',
		'gateS',
		'gateT',
		'reset',
		'measureOnce',
		'measureMany'
	];

	interface Anim {
		kind: 'turn' | 'fall';
		v0: Vec3;
		v1: Vec3;
		gate?: G;
		end: string; // the angles the animation ends on; a slider move cancels it
	}
	let anim = $state<Anim | null>(null);
	const prog = new Tween(1, { duration: 900, easing: cubicInOut });
	let circuit = $state<G[]>([]);
	let results = $state<number[]>([]);
	let many = $state({ key: -1, n0: 0, n1: 0 });

	const angleKey = (th: number, ph: number) => `${th.toFixed(6)}|${ph.toFixed(6)}`;

	function start(a: Anim) {
		anim = a;
		prog.set(0, { duration: 0 });
		prog.set(1, { duration: reduced ? 0 : 900 });
	}

	$effect(() => {
		const counts = ACTIONS.map((k) => Number(params[k] ?? 0));
		untrack(() => {
			const stored = String(params['qc:seen'] ?? '')
				.split(',')
				.map(Number);
			const seen = ACTIONS.map((_, i) => (Number.isFinite(stored[i]) ? stored[i] : 0));
			if (counts.every((c, i) => c === seen[i])) return;
			setParam('qc:seen', counts.join(','));
			let th = thetaDeg * DEG;
			let ph = phiDeg * DEG;
			counts.forEach((c, i) => {
				const presses = c - seen[i];
				for (let p = 0; p < presses; p++) {
					const key = ACTIONS[i];
					const s = fromAngles(th, ph);
					const v0 = bloch(s);
					if (key.startsWith('gate')) {
						const g = key.slice(4) as G;
						const a = anglesOf(apply(s, GATES[g], 0), ph);
						th = a.theta;
						ph = a.phi;
						circuit = [...circuit, g];
						const turnSpec = GATE_TURNS[g];
						start({
							kind: 'turn',
							v0,
							v1: turn(v0, turnSpec.axis, turnSpec.angle),
							gate: g,
							end: angleKey(th / DEG, ph / DEG)
						});
					} else if (key === 'reset') {
						th = 0;
						ph = 0;
						circuit = [];
						anim = null;
					} else if (key === 'measureOnce') {
						const { outcome } = measure(s, rng(7919 * (seen[i] + p + 1))());
						results = [...results.slice(-11), outcome];
						th = outcome === 0 ? 0 : Math.PI;
						start({
							kind: 'fall',
							v0,
							v1: [0, 0, outcome === 0 ? 1 : -1],
							end: angleKey(th / DEG, ph / DEG)
						});
					} else if (key === 'measureMany') {
						const k = Math.round((th / DEG) * 1e6);
						const c100 = tally(s, 100, 31 * (seen[i] + p + 1) + 5);
						const base = many.key === k ? many : { key: k, n0: 0, n1: 0 };
						many = { key: k, n0: base.n0 + c100[0], n1: base.n1 + c100[1] };
					}
				}
			});
			setParam('theta', th / DEG);
			setParam('phi', ph / DEG);
		});
	});

	// An animation stands only while the state is the one it ended on.
	const live = $derived(anim && anim.end === angleKey(thetaDeg, phiDeg) ? anim : null);
	const shown = $derived.by<Vec3>(() => {
		if (!live || prog.current >= 1) return vState;
		const u = prog.current;
		if (live.kind === 'turn' && live.gate) {
			const g = GATE_TURNS[live.gate];
			return turn(live.v0, g.axis, g.angle * u);
		}
		const m: Vec3 = [0, 1, 2].map((i) => live.v0[i] * (1 - u) + live.v1[i] * u) as Vec3;
		const l = Math.hypot(...m) || 1;
		return [m[0] / l, m[1] / l, m[2] / l];
	});
	const gateAxis = $derived(
		phase === 'gates' && live?.kind === 'turn' && live.gate ? GATE_TURNS[live.gate].axis : null
	);
	const trace = $derived(
		phase === 'gates' && live?.kind === 'turn' && live.gate
			? arc(
					CX,
					CY,
					R,
					turn,
					live.v0,
					GATE_TURNS[live.gate].axis,
					GATE_TURNS[live.gate].angle * prog.current
				)
			: ''
	);

	// ---- what the arrow means ----------------------------------------------------------
	const th = $derived(Math.acos(clamp(shown[2], -1, 1)));
	const ph = $derived(
		Math.hypot(shown[0], shown[1]) < 1e-6
			? phiDeg * DEG
			: (Math.atan2(shown[1], shown[0]) + 2 * Math.PI) % (2 * Math.PI)
	);
	const alpha = $derived(Math.cos(th / 2));
	const beta = $derived(Math.sin(th / 2));
	const p0 = $derived(alpha * alpha);
	const p1 = $derived(1 - p0);
	const phDeg = $derived(Math.round(ph / DEG) % 360);

	// ---- geometry -----------------------------------------------------------------------
	const tipP = $derived.by(() => {
		const s = project(shown);
		return { x: CX + s.x * R, y: CY + s.y * R };
	});
	function onmove(p: Point) {
		const v = unproject((p.x - CX) / R, (p.y - CY) / R);
		const t = Math.round(Math.acos(clamp(v[2], -1, 1)) / DEG);
		setParam('theta', t);
		if (t > 0 && t < 180)
			setParam('phi', Math.round((Math.atan2(v[1], v[0]) / DEG + 360) % 360) % 360);
	}
	function onkey(s: number | 'start' | 'end') {
		setParam('theta', s === 'start' ? 0 : s === 'end' ? 180 : clamp(thetaDeg + s, 0, 180));
	}

	// ---- text ---------------------------------------------------------------------------
	const f3 = (v: number) => (Math.abs(v) < 5e-4 ? '0.000' : v.toFixed(3));
	const pct = (p: number) => `${Math.round(p * 100)}%`;
	const betaText = $derived(beta < 5e-4 ? '0' : phDeg === 0 ? f3(beta) : `${f3(beta)} ∠ ${phDeg}°`);
	const betaRe = $derived(beta * Math.cos(ph));
	const betaIm = $derived(beta * Math.sin(ph));
	const ket = $derived.by(() => {
		if (beta < 5e-4) return '|ψ⟩ = |0⟩';
		if (alpha < 5e-4) return phDeg === 0 ? '|ψ⟩ = |1⟩' : `|ψ⟩ = ${paren(cplx(betaRe, betaIm))}|1⟩`;
		return `|ψ⟩ = ${f3(alpha)}|0⟩ + ${paren(cplx(betaRe, betaIm))}|1⟩`;
	});
	const paren = (z: string) => (z.includes(' ') ? `(${z})` : z);
	function cplx(re: number, im: number) {
		const r = Math.abs(re) < 5e-4 ? 0 : re;
		const i = Math.abs(im) < 5e-4 ? 0 : im;
		if (i === 0) return f3(r);
		if (r === 0) return `${f3(i)}i`;
		return `${f3(r)} ${i < 0 ? '−' : '+'} ${f3(Math.abs(i))}i`;
	}

	const GATE_TEXT: Record<G, { turn: string; m: [string, string, string, string]; pre?: string }> =
		{
			X: { turn: '180° about x: |0⟩ ↔ |1⟩', m: ['0', '1', '1', '0'] },
			H: { turn: '180° about the x–z diagonal', m: ['1', '1', '1', '−1'], pre: '1/√2' },
			Z: { turn: '180° about z: β → −β', m: ['1', '0', '0', '−1'] },
			S: { turn: '90° about z', m: ['1', '0', '0', 'i'] },
			T: { turn: '45° about z', m: ['1', '0', '0', '∠45°'] }
		};
	const lastGate = $derived(circuit.length ? circuit[circuit.length - 1] : null);
	const shownCircuit = $derived(circuit.slice(-8));

	// measurement
	const lastResult = $derived(results.length ? results[results.length - 1] : null);
	const fallen = $derived(
		lastResult !== null &&
			((lastResult === 0 && thetaDeg === 0) || (lastResult === 1 && thetaDeg === 180))
	);
	const manyHere = $derived(many.key === Math.round(thetaDeg * 1e6) ? many : { n0: 0, n1: 0 });
	const manyN = $derived(manyHere.n0 + manyHere.n1);

	const PX = 590; // panel left
</script>

{#snippet dial(
	x: number,
	y: number,
	r: number,
	mag: number,
	angle: number,
	name: string,
	color: string
)}
	<circle cx={x} cy={y} {r} fill="none" stroke="var(--stage-grid)" stroke-width="1.2" />
	<line x1={x - r} x2={x + r} y1={y} y2={y} stroke="var(--stage-grid)" />
	<line x1={x} x2={x} y1={y - r} y2={y + r} stroke="var(--stage-grid)" />
	{#if mag > 0.004}
		<line
			x1={x}
			y1={y}
			x2={x + Math.cos(angle) * mag * r}
			y2={y - Math.sin(angle) * mag * r}
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
		/>
		<circle
			cx={x + Math.cos(angle) * mag * r}
			cy={y - Math.sin(angle) * mag * r}
			r="4"
			fill={color}
		/>
	{/if}
	<circle cx={x} cy={y} r="2.5" fill="var(--stage-ink)" />
	<Label anchor="start" x={x - r} y={y - r - 10} text={name} size={13} weight={600} {color} />
{/snippet}

{#snippet bars(y: number, w: number)}
	<Readout id="p01" order={3} label="P(0) / P(1)" value="{pct(p0)} / {pct(p1)}">
		<Label
			anchor="start"
			x={PX}
			{y}
			text="P(0) = |α|² = {pct(p0)}"
			size={13}
			weight={600}
			color="var(--qc-zero)"
		/>
		<rect x={PX} y={y + 8} width={w} height="14" rx="3" fill="var(--stage-grid)" opacity="0.6" />
		<rect x={PX} y={y + 8} width={w * p0} height="14" rx="3" fill="var(--qc-zero)" />
		<Label
			anchor="start"
			x={PX}
			y={y + 46}
			text="P(1) = |β|² = {pct(p1)}"
			size={13}
			weight={600}
			color="var(--qc-one)"
		/>
		<rect x={PX} y={y + 54} width={w} height="14" rx="3" fill="var(--stage-grid)" opacity="0.6" />
		<rect x={PX} y={y + 54} width={w * p1} height="14" rx="3" fill="var(--qc-one)" />
	</Readout>
{/snippet}

<g>
	<Sphere
		id="q"
		cx={CX}
		cy={CY}
		{R}
		v={shown}
		axis={gateAxis}
		axisOpacity={1}
		{trace}
		latitude={phase === 'measure'}
	/>

	{#if phase === 'state'}
		<Handle
			x={tipP.x}
			y={tipP.y}
			label="Tip of the state arrow"
			value={Math.round(thetaDeg)}
			min={0}
			max={180}
			valuetext="theta {Math.round(thetaDeg)} degrees, phi {Math.round(phiDeg)} degrees"
			color="var(--qc-state)"
			r={10}
			{onmove}
			{onkey}
		/>
	{/if}

	<!-- ============ panel: state ============ -->
	{#if phase === 'state'}
		<Readout id="ttl">
			<Label
				anchor="start"
				x={PX}
				y={58}
				text="the two amplitudes, as arrows (β = length ∠ phase)"
				size={13}
				muted
			/>
		</Readout>
		<Readout
			id="alpha"
			order={1}
			label="α (amplitude of |0⟩)"
			value={f3(alpha)}
			color="var(--qc-zero)"
		>
			{@render dial(PX + 70, 160, 62, alpha, 0, 'α  on |0⟩', 'var(--qc-zero)')}
			<Label anchor="start" x={PX + 8} y={252} text="α = {f3(alpha)}" size={14} weight={600} />
		</Readout>
		<Readout
			id="beta"
			order={2}
			label="β (amplitude of |1⟩)"
			value={betaText}
			color="var(--qc-one)"
		>
			{@render dial(PX + 250, 160, 62, beta, ph, 'β  on |1⟩', 'var(--qc-one)')}
			<Label anchor="start" x={PX + 188} y={252} text="β = {betaText}" size={14} weight={600} />
		</Readout>
		{@render bars(300, 330)}
		<Readout id="ket" order={4} label="State" value={ket}>
			<Label anchor="start" x={PX} y={430} text={ket} size={14} weight={600} />
			<Label
				anchor="start"
				x={PX}
				y={452}
				text="θ = {Math.round(thetaDeg)}°, φ = {Math.round(phiDeg)}°"
				size={12}
				muted
			/>
		</Readout>
		<Readout id="hint">
			<Label
				anchor="start"
				x={PX}
				y={500}
				text="drag the tip, or use the sliders for the"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={PX}
				y={518}
				text="back of the sphere; only the phase"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={PX}
				y={536}
				text="difference between α and β is drawn"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- ============ panel: measure ============ -->
	{#if phase === 'measure'}
		{@render bars(58, 330)}
		<Readout
			id="once"
			order={1}
			label="Last measurement"
			value={lastResult === null
				? 'none yet'
				: `${lastResult}${fallen ? ' (state is now |' + lastResult + '⟩)' : ''}`}
			color={lastResult === 1 ? 'var(--qc-one)' : 'var(--qc-zero)'}
		>
			<Label anchor="start" x={PX} y={168} text="this qubit, measured" size={13} muted />
			{#if lastResult === null}
				<Label anchor="start" x={PX} y={200} text="press Measure it" size={16} weight={600} muted />
			{:else}
				<Label
					anchor="start"
					x={PX}
					y={204}
					text="got {lastResult}"
					size={26}
					weight={700}
					color={lastResult === 1 ? 'var(--qc-one)' : 'var(--qc-zero)'}
				/>
				<Label
					anchor="start"
					x={PX + 120}
					y={202}
					text={fallen ? `now the state is |${lastResult}⟩` : 'the state has changed since'}
					size={12}
					muted
				/>
			{/if}
			{#each results as r, i (i)}
				<rect
					x={PX + i * 27}
					y={218}
					width="22"
					height="22"
					rx="4"
					fill={r === 1 ? 'var(--qc-one)' : 'var(--qc-zero)'}
					opacity={i === results.length - 1 ? 1 : 0.55}
				/>
				<text
					x={PX + i * 27 + 11}
					y={234}
					text-anchor="middle"
					font-size="13"
					style:fill="var(--stage-bg)"
					font-weight="700">{r}</text
				>
			{/each}
		</Readout>
		<Readout
			id="many"
			order={2}
			label="Fresh copies measured"
			value={manyN ? `${manyN}: ${manyHere.n0} gave 0, ${manyHere.n1} gave 1` : 'none yet'}
		>
			<Label
				anchor="start"
				x={PX}
				y={290}
				text="fresh copies of this state, measured: {manyN}"
				size={13}
				muted
			/>
			{#each [0, 1] as k (k)}
				{@const n = k === 0 ? manyHere.n0 : manyHere.n1}
				{@const frac = manyN ? n / manyN : 0}
				{@const expect = k === 0 ? p0 : p1}
				{@const bx = PX + 40 + k * 160}
				<rect
					x={bx}
					y={300}
					width="90"
					height="200"
					fill="var(--stage-grid)"
					opacity="0.35"
					rx="3"
				/>
				<rect
					x={bx}
					y={500 - 200 * frac}
					width="90"
					height={200 * frac}
					rx="3"
					fill={k === 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
				/>
				<line
					x1={bx - 8}
					x2={bx + 98}
					y1={500 - 200 * expect}
					y2={500 - 200 * expect}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					stroke-dasharray="5 4"
				/>
				<Label x={bx + 45} y={522} text="{k}: {n}" size={14} weight={600} anchor="middle" />
				<Label
					x={bx + 45}
					y={540}
					text={manyN ? `${Math.round(frac * 100)}%` : '–'}
					size={12}
					anchor="middle"
					muted
				/>
			{/each}
			<Label
				anchor="start"
				x={PX}
				y={570}
				text="dashed: Born's rule, |α|² and |β|²"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- ============ panel: gates ============ -->
	{#if phase === 'gates'}
		<Readout
			id="circuit"
			order={1}
			label="Circuit"
			value={circuit.length ? `|0⟩ → ${circuit.join(' → ')}` : '(no gates yet)'}
		>
			<Label
				anchor="start"
				x={PX}
				y={56}
				text="the circuit so far (read left to right)"
				size={13}
				muted
			/>
			<line
				x1={PX + 34}
				x2={940}
				y1={92}
				y2={92}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
			<Label anchor="start" x={PX} y={97} text="|ψ⟩" size={14} weight={600} />
			{#if circuit.length > 8}
				<Label anchor="start" x={PX + 46} y={97} text="…" size={14} muted />
			{/if}
			{#each shownCircuit as g, i (i)}
				<rect
					x={PX + 64 + i * 36}
					y={76}
					width="30"
					height="32"
					rx="4"
					fill="var(--surface)"
					stroke={i === shownCircuit.length - 1 ? 'var(--qc-axis)' : 'var(--stage-line)'}
					stroke-width={i === shownCircuit.length - 1 ? 2 : 1.2}
				/>
				<text x={PX + 79 + i * 36} y={97} text-anchor="middle" font-weight="700" font-size="14"
					>{g}</text
				>
			{/each}
			{#if !circuit.length}
				<Label anchor="start" x={PX + 64} y={124} text="press a gate button" size={12} muted />
			{/if}
		</Readout>
		{#if lastGate}
			{@const gt = GATE_TEXT[lastGate]}
			{@const mx = PX + (gt.pre ? 44 : 6)}
			<Readout id="gate" order={2} label="Gate {lastGate}" value={gt.turn} color="var(--qc-axis)">
				<Label
					anchor="start"
					x={PX}
					y={156}
					text="{lastGate}: {gt.turn}"
					size={14}
					weight={600}
					color="var(--qc-axis)"
				/>
				{#if gt.pre}
					<Label anchor="start" x={PX} y={203} text={gt.pre} size={14} />
				{/if}
				<path
					d="M{mx + 6} 176 h-6 v42 h6 M{mx + 96} 176 h6 v42 h-6"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				{#each gt.m as e, i (i)}
					<Label
						x={mx + (i % 2 === 0 ? 26 : 72)}
						y={i < 2 ? 192 : 211}
						text={e}
						size={14}
						anchor="middle"
					/>
				{/each}
				<Label anchor="start" x={mx + 120} y={203} text="× (α, β)" size={13} muted />
			</Readout>
		{/if}
		<Readout id="alpha-g" order={3} label="α, β" value="{f3(alpha)}, {betaText}">
			{@render dial(PX + 50, 310, 44, alpha, 0, 'α', 'var(--qc-zero)')}
			{@render dial(PX + 190, 310, 44, beta, ph, 'β', 'var(--qc-one)')}
			<Label anchor="start" x={PX + 6} y={374} text="α = {f3(alpha)}" size={13} />
			<Label anchor="start" x={PX + 146} y={374} text="β = {betaText}" size={13} />
		</Readout>
		{@render bars(418, 330)}
		<Readout id="undo">
			<Label
				anchor="start"
				x={PX}
				y={520}
				text="every gate can be undone: apply H twice,"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={PX}
				y={538}
				text="or X twice, and you are back where you were"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
