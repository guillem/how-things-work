<script lang="ts">
	/**
	 * The machine, looking along its shaft: two magnet poles (N left, S right,
	 * field to the right), the coil's two long sides a and b seen end-on, the
	 * forces on them, and on the right the commutator or slip rings enlarged,
	 * with the battery, voltmeter or lamp. A trace along the bottom.
	 *
	 * Phases (`step.hints.phase`):
	 *   hold    — the reader holds the coil at `params.angle` (drag the crank or
	 *             use the slider) with `params.current` in it: side forces, lever
	 *             arms, torque, and torque against angle.
	 *   stuck   — battery through slip rings: the motor model (`MotorRun`) from
	 *             rest; it rocks to a dead point.
	 *   spin    — the same with `params.connection` (commutator by default) and
	 *             `params.start`.
	 *   backemf — commutator, with `params.load`; the trace is the battery's
	 *             current against the current it would draw held still.
	 *   crank, ac, dc — a voltmeter on the brushes; the coil turns steadily at
	 *             `params.speed` turns/s (θ = 2π f t) or by hand (`mg:crank`,
	 *             radians, unwrapped); the trace is the voltage.
	 *   same    — `params.role`: the motor (commutator, `params.voltage`) or the
	 *             generator turned at 1 turn/s lighting a lamp, whose current
	 *             makes forces that oppose the turning.
	 *
	 * Motor runs are pure functions of the time since they started. When the
	 * battery, the connection or the load changes, a new run starts from the
	 * coil's state at that moment (so the coil never jumps); a step change,
	 * "Start again" or a new start position starts from rest.
	 *
	 * Sanctioned exception (scene guide): turned by hand, the coil's speed is the
	 * frame-to-frame change of the crank angle over the change of t, smoothed
	 * over ~0.08 s, and the voltage trace is a short history of it. Both ignore
	 * dt ≤ 0 (pause, step reset) and stay still under reduced motion.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import Contacts from './Contacts.svelte';
	import {
		MACHINE,
		MotorRun,
		NBA,
		angleDelta,
		coilCurrent,
		coilEmf,
		coilForces,
		coilTorque,
		generatorLoad,
		peakEmf,
		sense,
		steadyAngle,
		terminalVoltage,
		type Connection,
		type MotorState
	} from '../machine';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- layout -------------------------------------------------------------------------------------
	const C = { x: 250, y: 290 };
	const RC = 100; // px from the shaft to each side (the coil is 10 cm across)
	const PX_PER_N = 10; // force arrows (at most 50 px long)
	const K = { x: 690, y: 232 }; // contacts
	const DEV_Y = 372; // battery / meter / lamp
	const PLOT = { x0: 96, x1: 904, top: 482, bottom: 568 };
	const CARD = { x: 16, y: 16, w: 600, h: 62 };
	const LAMP_R = 10; // Ω, coil + lamp, for the generator in 'same'
	const GEN_SPEED = 2; // turns/s, the generator in 'same'
	const WIN_M = 6; // s of motor trace
	const WIN_G = 4; // s of generator trace

	// ---- what the step shows -----------------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'hold'));
	const role = $derived(String(params.role ?? 'motor'));
	const isHold = $derived(phase === 'hold');
	const isMotor = $derived(
		phase === 'stuck' ||
			phase === 'spin' ||
			phase === 'backemf' ||
			(phase === 'same' && role === 'motor')
	);
	const isGen = $derived(!isHold && !isMotor);
	const lamp = $derived(phase === 'same' && role === 'generator');
	const conn = $derived<Connection>(
		step.hints?.connection === 'slip' || step.hints?.connection === 'commutator'
			? step.hints.connection
			: phase === 'spin' || phase === 'dc'
				? (String(params.connection ?? 'commutator') as Connection)
				: phase === 'hold'
					? 'slip'
					: 'commutator'
	);
	const V = $derived(Number(params.voltage ?? 3));
	const load = $derived(phase === 'backemf' ? Number(params.load ?? 0) : 0);
	const startUpright = $derived(phase === 'spin' && String(params.start ?? 'flat') === 'upright');
	const restarts = $derived(Number(params.restart ?? 0));
	const hand = $derived(isGen && !lamp && String(params.turning ?? 'steady') === 'hand');
	const f = $derived(lamp ? GEN_SPEED : Number(params.speed ?? 1));

	/** Animation time: under reduced motion, a frame late enough to show a full trace. */
	const tm = $derived(reduced ? 6 : t);

	// ---- motor runs ----------------------------------------------------------------------------------
	interface Seg {
		t0: number;
		run: MotorRun;
	}
	let segs: Seg[] = [];
	let hardKey = '';
	let softKey = '';
	let lastTm = -1;
	const motor = $derived.by(() => {
		if (!isMotor) {
			segs = [];
			hardKey = '';
			lastTm = -1;
			return { segs, now: tm };
		}
		const now = tm;
		const p = { V, connection: conn, load };
		const hard = `${phase}|${startUpright}|${restarts}`;
		const soft = `${V}|${conn}|${load}`;
		const startState: MotorState = { theta: startUpright ? 0 : Math.PI / 2, omega: 0 };
		if (!segs.length || hard !== hardKey || now < lastTm || reduced) {
			// From rest: at the step's start (t ≈ 0), or now for "Start again".
			const t0 = reduced || !segs.length || now < lastTm ? 0 : now;
			segs = [{ t0, run: new MotorRun(p, startState) }];
		} else if (soft !== softKey || now - segs[segs.length - 1].t0 > 60) {
			const last = segs[segs.length - 1];
			const kept = segs.filter((_, i) => i === segs.length - 1 || segs[i + 1].t0 > now - WIN_M);
			segs = [...kept, { t0: now, run: new MotorRun(p, last.run.at(now - last.t0)) }];
		}
		hardKey = hard;
		softKey = soft;
		lastTm = now;
		return { segs, now };
	});
	/** Readings of the motor at time s (null before the run started). */
	function motorAt(s: number) {
		const list = motor.segs;
		for (let i = list.length - 1; i >= 0; i--) {
			if (s >= list[i].t0) return list[i].run.readings(s - list[i].t0);
		}
		return null;
	}
	const mNow = $derived(isMotor ? motorAt(motor.now) : null);

	// ---- generator turned by hand ----------------------------------------------------------------------
	const crankAngle = $derived(Number(params['mg:crank'] ?? 0));
	let last = { t: -1, a: 0, w: 0 };
	let history: { t: number; v: number; e: number }[] = [];
	const handOmega = $derived.by(() => {
		const a = crankAngle;
		if (!hand) {
			last = { t: -1, a, w: 0 };
			history = [];
			return 0;
		}
		const now = t;
		if (last.t < 0 || now < last.t) {
			last = { t: now, a, w: 0 };
			history = [];
			return 0;
		}
		const dt = now - last.t;
		if (dt <= 0 || reduced) return last.w;
		// A long gap, or a jump of the crank set from outside (switching to "You turn it"),
		// is not turning.
		const raw = dt > 0.5 || Math.abs(a - last.a) > 1 ? 0 : (a - last.a) / dt;
		const w = last.w + (raw - last.w) * Math.min(1, dt / 0.08);
		last = { t: now, a, w: Math.abs(w) < 1e-3 ? 0 : w };
		history.push({ t: now, v: terminalVoltage(a, last.w, conn), e: coilEmf(a, last.w) });
		while (history.length && history[0].t < now - WIN_G) history.shift();
		return last.w;
	});

	// ---- the state drawn now ---------------------------------------------------------------------------
	const holdDeg = $derived(Number(params.angle ?? 60));
	/** The slider's current is positive into the page in side a (the motor's forward push). */
	const holdI = $derived(-Number(params.current ?? 0.75));
	const theta = $derived(
		isHold
			? (holdDeg * Math.PI) / 180
			: isMotor
				? (mNow?.theta ?? Math.PI / 2)
				: hand
					? crankAngle
					: steadyAngle(tm, f)
	);
	const omega = $derived(
		isHold ? 0 : isMotor ? (mNow?.omega ?? 0) : hand ? handOmega : 2 * Math.PI * f
	);
	/** Current in the coil (A, positive: out of the page in side a). */
	const coilI = $derived(
		isHold
			? holdI
			: isMotor
				? coilCurrent(theta, mNow?.I ?? 0, conn)
				: lamp
					? generatorLoad(theta, omega, LAMP_R).current
					: 0
	);
	const torque = $derived(coilTorque(theta, coilI));
	const emf = $derived(coilEmf(theta, omega));
	const vOut = $derived(terminalVoltage(theta, omega, conn));
	/** Current in the leads: positive in at the left brush (the battery's +). */
	const leadI = $derived(isMotor ? (mNow?.I ?? 0) : lamp ? -sense(theta, conn) * coilI : 0);

	// ---- geometry ------------------------------------------------------------------------------------------
	const sideA = $derived({ x: C.x - RC * Math.sin(theta), y: C.y - RC * Math.cos(theta) });
	const sideB = $derived({ x: C.x + RC * Math.sin(theta), y: C.y + RC * Math.cos(theta) });
	const forces = $derived(coilForces(coilI));
	/** With the voltmeter, the marks show which way the induced voltage pushes. */
	const markSign = $derived(
		isGen && !lamp
			? Math.abs(emf) > 0.05
				? Math.sign(emf)
				: 0
			: Math.abs(coilI) > 0.01
				? Math.sign(coilI)
				: 0
	);
	const KNOB = 74;
	const knob = $derived({ x: C.x + KNOB * Math.cos(theta), y: C.y - KNOB * Math.sin(theta) });
	const showCrank = $derived(isHold || isGen);
	const showForces = $derived(isHold || isMotor || lamp);

	// Pole faces: arcs of radius 150 about the shaft, from 105 px above it to 105 below.
	const POLE_R = 150;
	const POLE_H = 105;
	const faceX = (y: number) => Math.sqrt(POLE_R * POLE_R - (y - C.y) * (y - C.y));
	const fieldYs = [195, 225, 258, 290, 322, 355, 385];

	// ---- turning arrows (above the coil) ---------------------------------------------------------------
	const TAU_MAX = 0.5;
	function turnArrow(r: number, amount: number) {
		const span = (clamp(Math.abs(amount), 0, 1) * 32 * Math.PI) / 180;
		if (span < 0.02) return null;
		const dir = Math.sign(amount); // + anticlockwise
		const P = (p: number, rr = r) => ({ x: C.x + rr * Math.cos(p), y: C.y - rr * Math.sin(p) });
		const p0 = Math.PI / 2 - dir * span;
		const p1 = Math.PI / 2 + dir * span;
		const a = P(p0);
		const b = P(p1);
		const sweep = dir > 0 ? 0 : 1;
		const tip = P(p1 + dir * 0.07);
		const l = P(p1 - dir * 0.03, r - 7);
		const rr = P(p1 - dir * 0.03, r + 7);
		return {
			d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 0 ${sweep} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
			head: `M${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${l.x.toFixed(1)} ${l.y.toFixed(1)} L${rr.x.toFixed(1)} ${rr.y.toFixed(1)} Z`
		};
	}
	const torqueArrow = $derived(showForces ? turnArrow(160, torque / TAU_MAX) : null);
	const spinArrow = $derived(
		isGen && Math.abs(omega) > 0.05 ? turnArrow(186, Math.sign(omega) * 0.8) : null
	);

	// ---- interaction: the crank ------------------------------------------------------------------------------
	function moveCrank(p: { x: number; y: number }) {
		const a = Math.atan2(C.y - p.y, p.x - C.x);
		if (isHold) {
			setParam('angle', Math.round((((a * 180) / Math.PI) % 360) + 360) % 360);
			return;
		}
		const base = hand ? crankAngle : theta;
		if (!hand) setParam('turning', 'hand');
		setParam('mg:crank', base + angleDelta(base, a));
	}
	function keyCrank(by: number | 'start' | 'end') {
		if (isHold) {
			const next = by === 'start' ? 0 : by === 'end' ? 360 : clamp(holdDeg + by * 5, 0, 360);
			setParam('angle', next);
			return;
		}
		if (typeof by !== 'number') return;
		const base = hand ? crankAngle : theta;
		if (!hand) setParam('turning', 'hand');
		setParam('mg:crank', base + (by * 5 * Math.PI) / 180);
	}
	// Choosing "You turn it" from the select leaves the crank where the coil is.
	let seenTurning = untrack(() => String(params.turning ?? 'steady'));
	$effect(() => {
		const v = String(params.turning ?? 'steady');
		if (v === seenTurning) return;
		seenTurning = v;
		untrack(() => {
			if (v === 'hand' && isGen) setParam('mg:crank', steadyAngle(tm, f));
		});
	});

	// ---- trace ---------------------------------------------------------------------------------------------
	const mid = (PLOT.top + PLOT.bottom) / 2;
	const traceKind = $derived(
		isHold ? 'angle' : phase === 'backemf' ? 'current' : isMotor || lamp ? 'torque' : 'voltage'
	);
	const yMax = $derived.by(() => {
		if (traceKind === 'angle' || traceKind === 'torque') return 0.5;
		if (traceKind === 'current') return V / MACHINE.R > 1 ? 2 : 1;
		if (hand) return 10;
		const pk = peakEmf(f);
		return [1, 2, 5, 10].find((r) => r >= pk * 1.05) ?? 10;
	});
	const zeroY = $derived(traceKind === 'current' ? PLOT.bottom : mid);
	const sy = $derived((v: number) =>
		traceKind === 'current'
			? PLOT.bottom - clamp(v / yMax, -0.05, 1.05) * (PLOT.bottom - PLOT.top)
			: mid - clamp(v / yMax, -1.08, 1.08) * ((PLOT.bottom - PLOT.top) / 2)
	);
	const win = $derived(isMotor ? WIN_M : WIN_G);
	const sx = $derived((s: number) => PLOT.x1 - ((tm - s) / win) * (PLOT.x1 - PLOT.x0));
	const ax = (deg: number) => PLOT.x0 + (deg / 360) * (PLOT.x1 - PLOT.x0);

	const traces = $derived.by(() => {
		const n = 240;
		let main = '';
		let ghost = '';
		if (traceKind === 'angle') {
			for (let i = 0; i <= n; i++) {
				const d = (i / n) * 360;
				const v = coilTorque((d * Math.PI) / 180, holdI);
				main += `${i ? 'L' : 'M'}${ax(d).toFixed(1)} ${sy(v).toFixed(1)}`;
			}
			return { main, ghost, n: 0 };
		}
		if (isMotor) {
			const first = motor.segs[0]?.t0 ?? tm;
			const s0 = Math.max(first, tm - win);
			for (let i = 0; i <= n; i++) {
				const s = s0 + ((tm - s0) * i) / n;
				const r = motorAt(s);
				if (!r) continue;
				const v = traceKind === 'current' ? r.I : r.torque;
				main += `${main ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(v).toFixed(1)}`;
			}
			return { main, ghost, n: 0 };
		}
		if (hand) {
			void handOmega;
			history.forEach((h, i) => {
				main += `${i ? 'L' : 'M'}${sx(h.t).toFixed(1)} ${sy(h.v).toFixed(1)}`;
				ghost += `${i ? 'L' : 'M'}${sx(h.t).toFixed(1)} ${sy(h.e).toFixed(1)}`;
			});
			return { main, ghost, n: history.length };
		}
		const w = 2 * Math.PI * f;
		const s0 = Math.max(0, tm - win);
		for (let i = 0; i <= n; i++) {
			const s = s0 + ((tm - s0) * i) / n;
			const th = steadyAngle(s, f);
			const v = lamp ? generatorLoad(th, w, LAMP_R).torque : terminalVoltage(th, w, conn);
			main += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(v).toFixed(1)}`;
			ghost += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(coilEmf(th, w)).toFixed(1)}`;
		}
		return { main, ghost, n: 0 };
	});
	const showGhost = $derived(isGen && !lamp && conn === 'commutator');
	const traceColor = $derived(
		traceKind === 'voltage'
			? 'var(--em-field)'
			: traceKind === 'current'
				? 'var(--em-current)'
				: 'var(--em-force)'
	);
	const traceTitle = $derived(
		traceKind === 'angle'
			? `torque on the coil (N·m) at every angle, with ${Math.abs(holdI).toFixed(2)} A`
			: traceKind === 'current'
				? 'current from the battery (A)'
				: traceKind === 'torque'
					? lamp
						? 'torque from the lamp’s current (N·m): always against the turning'
						: 'torque on the coil (N·m)'
					: conn === 'commutator'
						? 'voltage at the brushes (V)'
						: 'voltage at the brushes (V): alternating'
	);

	// ---- fade in on a change of phase --------------------------------------------------------------------
	const focus = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		void phase;
		untrack(() => {
			focus.set(0.4, { duration: 0 });
			focus.set(1, { duration: reduced ? 0 : 700 });
		});
	});

	// ---- readouts ------------------------------------------------------------------------------------------
	const signed = (v: number, digits: number) => {
		const s = (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
		return s.replace('-', '−');
	};
	const turnSym = (v: number) => (Math.abs(v) < 0.005 ? '' : v > 0 ? ' ↺' : ' ↻');
	const cards = $derived.by(() => {
		if (isHold) {
			return [
				{ id: 'angle', label: 'angle of the coil', value: `${Math.round(holdDeg)}°` },
				{
					id: 'force',
					label: 'force on each side',
					value: `${Math.abs(forces.a.y).toFixed(2)} N`,
					color: 'var(--em-force)'
				},
				{
					id: 'torque',
					label: 'torque (turning effect)',
					value: `${Math.abs(torque).toFixed(2)} N·m${turnSym(torque)}`,
					color: 'var(--em-force)'
				}
			];
		}
		const speed = {
			id: 'speed',
			label: 'speed',
			value: `${signed(omega / (2 * Math.PI), 2)} turns/s`,
			color: undefined as string | undefined
		};
		if (isMotor) {
			const I = mNow?.I ?? 0;
			const third =
				phase === 'backemf' || phase === 'same'
					? {
							id: 'back',
							label: 'back emf',
							value: `${signed(mNow?.backEmf ?? 0, 2)} V`,
							color: 'var(--em-field)'
						}
					: {
							id: 'torque',
							label: 'torque',
							value: `${Math.abs(torque).toFixed(2)} N·m${turnSym(torque)}`,
							color: 'var(--em-force)'
						};
			return [
				speed,
				{
					id: 'current',
					label: 'current from the battery',
					value: `${signed(I, 2)} A`,
					color: 'var(--em-current)'
				},
				third
			];
		}
		if (lamp) {
			return [
				speed,
				{
					id: 'current',
					label: 'current to the lamp',
					value: `${Math.abs(leadI).toFixed(2)} A`,
					color: 'var(--em-current)'
				},
				{
					id: 'torque',
					label: 'torque on the coil',
					value: `${Math.abs(torque).toFixed(2)} N·m${turnSym(torque)}`,
					color: 'var(--em-force)'
				}
			];
		}
		return [
			speed,
			{
				id: 'voltage',
				label: 'voltage at the brushes',
				value: `${signed(vOut, 2)} V`,
				color: 'var(--em-field)'
			},
			{
				id: 'peak',
				label: 'peak, N·B·A·ω',
				value: `${(NBA * Math.abs(omega)).toFixed(2)} V`,
				color: undefined
			}
		];
	});

	// Voltmeter needle (zero in the middle, ±60°) and the lamp's glow.
	const meterNeedle = $derived(clamp(vOut / yMax, -1.05, 1.05) * (Math.PI / 3));
	const glow = $derived(clamp(leadI * leadI * LAMP_R, 0, 1));
	const reversing = $derived(
		conn === 'commutator' && !isHold && Math.abs(Math.sin(theta)) < 0.16 && Math.abs(omega) > 0.3
	);
	const lever = $derived(
		[sideA, sideB].filter((p) => Math.abs(p.x - C.x) > 6).map((p, i) => ({ ...p, i }))
	);
	const stall = $derived(V / MACHINE.R);
	/** Mean battery current over the last 2 s of the run (back-emf trace). */
	const avgI = $derived.by(() => {
		if (traceKind !== 'current') return null;
		const first = motor.segs[0]?.t0 ?? tm;
		if (tm - first < 2) return null;
		let sum = 0;
		for (let i = 0; i < 200; i++) sum += motorAt(tm - 2 + (i + 0.5) / 100)?.I ?? 0;
		return sum / 200;
	});
	const torqueLabel = $derived(
		phase === 'same'
			? lamp
				? 'the forces on the coil oppose the turning'
				: 'the forces on the coil drive the turning'
			: 'torque'
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet arrow(x: number, y: number, dy: number, color: string)}
	{#if Math.abs(dy) > 4}
		{@const s = Math.sign(dy)}
		<line
			x1={x}
			y1={y}
			x2={x}
			y2={y + dy - s * 8}
			stroke={color}
			stroke-width="3.5"
			stroke-linecap="round"
		/>
		<path d="M{x} {y + dy} L{x - 7} {y + dy - s * 11} L{x + 7} {y + dy - s * 11} Z" fill={color} />
	{/if}
{/snippet}

{#snippet side(p: { x: number; y: number }, color: string, mark: number)}
	<circle cx={p.x} cy={p.y} r="15" fill={color} stroke="var(--stage-bg)" stroke-width="2" />
	{#if mark > 0}
		<circle cx={p.x} cy={p.y} r="4" fill="#fff" />
	{:else if mark < 0}
		<path
			d="M{p.x - 6} {p.y - 6} L{p.x + 6} {p.y + 6} M{p.x + 6} {p.y - 6} L{p.x - 6} {p.y + 6}"
			stroke="#fff"
			stroke-width="2.6"
			stroke-linecap="round"
		/>
	{/if}
{/snippet}

<g opacity={focus.current}>
	<!-- field lines between the pole faces -->
	{#each fieldYs as y (y)}
		{@const half = faceX(y)}
		<line
			x1={C.x - half}
			x2={C.x + half}
			y1={y}
			y2={y}
			stroke="var(--em-bfield)"
			stroke-width="1.4"
			opacity="0.45"
		/>
		<path d="M{C.x + half - 26} {y} l-9 -4.5 v9 z" fill="var(--em-bfield)" opacity="0.6" />
	{/each}
	{@render txt(36, C.y + POLE_H + 22, 'magnetic field, 0.25 T →', 12, {
		color: 'var(--em-bfield)',
		weight: 600
	})}

	<!-- the magnet's poles -->
	<path
		d="M36 {C.y - POLE_H} H{C.x - faceX(C.y - POLE_H)} A{POLE_R} {POLE_R} 0 0 0 {C.x -
			faceX(C.y + POLE_H)} {C.y + POLE_H} H36 Z"
		fill="var(--em-north)"
	/>
	<path
		d="M{2 * C.x - 36} {C.y - POLE_H} H{C.x + faceX(C.y - POLE_H)} A{POLE_R} {POLE_R} 0 0 1 {C.x +
			faceX(C.y + POLE_H)} {C.y + POLE_H} H{2 * C.x - 36} Z"
		fill="var(--em-south)"
	/>
	<text
		x="62"
		y={C.y + 8}
		text-anchor="middle"
		font-weight="800"
		style:font-size="22px"
		style:fill="#fff">N</text
	>
	<text
		x={2 * C.x - 62}
		y={C.y + 8}
		text-anchor="middle"
		font-weight="800"
		style:font-size="22px"
		style:fill="#fff">S</text
	>

	<!-- where the coil stands across the field: the dead points -->
	<line
		x1={C.x}
		x2={C.x}
		y1={C.y - RC - 30}
		y2={C.y + RC + 30}
		stroke="var(--stage-grid)"
		stroke-dasharray="4 5"
	/>

	<!-- lever arms (hold): from the shaft, square to the vertical forces -->
	{#if isHold}
		{#each lever as p (p.i)}
			<line
				x1={C.x}
				x2={p.x}
				y1={C.y}
				y2={C.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<line
				x1={p.x}
				x2={p.x}
				y1={p.y}
				y2={C.y}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 4"
			/>
		{/each}
	{/if}

	<!-- the coil: its near end crossing the shaft, and the two long sides end-on -->
	<line
		x1={sideA.x}
		y1={sideA.y}
		x2={C.x}
		y2={C.y}
		stroke="var(--mg-a)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<line
		x1={sideB.x}
		y1={sideB.y}
		x2={C.x}
		y2={C.y}
		stroke="var(--mg-b)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<circle
		cx={C.x}
		cy={C.y}
		r="11"
		fill="var(--surface)"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
	/>
	{#if showCrank}
		<line
			x1={C.x}
			y1={C.y}
			x2={knob.x}
			y2={knob.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="7"
			stroke-linecap="round"
		/>
	{/if}

	{@render side(sideA, 'var(--mg-a)', markSign)}
	{@render side(sideB, 'var(--mg-b)', -markSign)}
	{@render txt(sideA.x + (C.x - sideA.x) * 0.3 + 10, sideA.y + (C.y - sideA.y) * 0.3 - 8, 'a', 14, {
		weight: 800,
		color: 'var(--mg-a)'
	})}
	{@render txt(sideB.x + (C.x - sideB.x) * 0.3 + 10, sideB.y + (C.y - sideB.y) * 0.3 - 8, 'b', 14, {
		weight: 800,
		color: 'var(--mg-b)'
	})}

	<!-- forces on the sides: always at right angles to the field -->
	{#if showForces}
		{@render arrow(
			sideA.x,
			sideA.y - Math.sign(forces.a.y) * 16,
			clamp(-forces.a.y * PX_PER_N, -50, 50),
			'var(--em-force)'
		)}
		{@render arrow(
			sideB.x,
			sideB.y - Math.sign(forces.b.y) * 16,
			clamp(-forces.b.y * PX_PER_N, -50, 50),
			'var(--em-force)'
		)}
		{#if isHold && Math.abs(forces.a.y) > 0.3}
			{@render txt(
				sideA.x + 12,
				sideA.y - forces.a.y * PX_PER_N * 0.6,
				`${Math.abs(forces.a.y).toFixed(2)} N`,
				12,
				{ color: 'var(--em-force)', weight: 600 }
			)}
			{@render txt(
				sideB.x + 12,
				sideB.y - forces.b.y * PX_PER_N * 0.6,
				`${Math.abs(forces.b.y).toFixed(2)} N`,
				12,
				{ color: 'var(--em-force)', weight: 600 }
			)}
		{/if}
	{/if}

	{#if showCrank}
		<Handle
			x={knob.x}
			y={knob.y}
			r={10}
			label={isHold
				? 'Coil angle: drag the crank, or use the arrow keys'
				: 'Crank: drag it round, or use the arrow keys, to turn the coil'}
			value={isHold ? Math.round(holdDeg) : Math.round((theta * 180) / Math.PI)}
			min={isHold ? 0 : -100000}
			max={isHold ? 360 : 100000}
			valuetext={`${Math.round(isHold ? holdDeg : ((((theta * 180) / Math.PI) % 360) + 360) % 360)} degrees`}
			onmove={moveCrank}
			onkey={keyCrank}
		/>
	{/if}

	<!-- the turning effect (torque) and the direction of turning, above the coil -->
	{#if spinArrow}
		<path d={spinArrow.d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2.5" />
		<path d={spinArrow.head} fill="var(--stage-ink-muted)" />
		{@render txt(C.x + 84, C.y - 190, hand || lamp ? 'you turn it' : 'turning', 12, {
			muted: true,
			weight: 600
		})}
	{/if}
	{#if torqueArrow}
		<path d={torqueArrow.d} fill="none" stroke="var(--em-force)" stroke-width="3" />
		<path d={torqueArrow.head} fill="var(--em-force)" />
	{/if}
	{#if showForces}
		{@render txt(C.x - 96, C.y - 150, 'torque', 12, {
			anchor: 'end',
			color: 'var(--em-force)',
			weight: 600,
			opacity: torqueArrow ? 1 : 0.5
		})}
	{/if}
	{#if (isHold || isMotor) && !torqueArrow && Math.abs(Math.sin(theta)) < 0.05}
		{@render txt(C.x + 22, C.y - RC - 44, 'dead point: no torque', 13, {
			weight: 700
		})}
	{/if}
</g>

<!-- the connection, enlarged, with the battery, the voltmeter or the lamp -->
<g opacity={focus.current}>
	{@render txt(
		K.x,
		K.y - 78,
		conn === 'commutator' ? 'commutator, seen along the shaft' : 'slip rings, seen from the side',
		12,
		{ anchor: 'middle', weight: 600 }
	)}
	<Contacts x={K.x} y={K.y} {theta} kind={conn} leadY={DEV_Y} flow={leadI} />
	{#if phase === 'same'}
		{@render txt(
			K.x,
			DEV_Y + 74,
			lamp ? 'motion → electrical energy' : 'electrical energy → motion',
			14,
			{ anchor: 'middle', weight: 700 }
		)}
		{@render txt(K.x, K.y - 100, torqueLabel, 13, {
			anchor: 'middle',
			weight: 700,
			color: 'var(--em-force)'
		})}
	{/if}
	{#if reversing}
		{@render txt(K.x, K.y + 72, 'brushes cross the gaps: current reverses', 12, {
			anchor: 'middle',
			weight: 700,
			color: 'var(--em-current)'
		})}
	{/if}
	<line
		x1={K.x - 80}
		x2={K.x - 36}
		y1={DEV_Y}
		y2={DEV_Y}
		stroke="var(--em-copper)"
		stroke-width="2"
	/>
	<line
		x1={K.x + 36}
		x2={K.x + 80}
		y1={DEV_Y}
		y2={DEV_Y}
		stroke="var(--em-copper)"
		stroke-width="2"
	/>
	{#if isHold || isMotor}
		<!-- battery: + (long plate) on the left -->
		<line
			x1={K.x - 36}
			x2={K.x - 6}
			y1={DEV_Y}
			y2={DEV_Y}
			stroke="var(--em-copper)"
			stroke-width="2"
		/>
		<line
			x1={K.x + 6}
			x2={K.x + 36}
			y1={DEV_Y}
			y2={DEV_Y}
			stroke="var(--em-copper)"
			stroke-width="2"
		/>
		<line
			x1={K.x - 6}
			x2={K.x - 6}
			y1={DEV_Y - 20}
			y2={DEV_Y + 20}
			stroke="var(--stage-ink)"
			stroke-width="3"
		/>
		<line
			x1={K.x + 6}
			x2={K.x + 6}
			y1={DEV_Y - 11}
			y2={DEV_Y + 11}
			stroke="var(--stage-ink)"
			stroke-width="6"
		/>
		{@render txt(K.x - 20, DEV_Y - 14, '+', 14, { anchor: 'middle', weight: 700 })}
		{@render txt(
			K.x,
			DEV_Y + 40,
			isHold ? `battery: ${Math.abs(holdI).toFixed(2)} A` : `battery, ${V.toFixed(1)} V`,
			12,
			{ anchor: 'middle', weight: 600 }
		)}
	{:else if lamp}
		<circle cx={K.x} cy={DEV_Y} r="34" fill="var(--mg-lamp)" opacity={0.1 + 0.6 * glow} />
		<circle
			cx={K.x}
			cy={DEV_Y}
			r="18"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<path
			d="M{K.x - 36} {DEV_Y} H{K.x - 18} M{K.x + 18} {DEV_Y} H{K.x + 36}"
			stroke="var(--em-copper)"
			stroke-width="2"
		/>
		<path
			d="M{K.x - 12} {DEV_Y + 3} q3 -10 6 0 t6 0 t6 0 t6 0"
			fill="none"
			stroke="var(--mg-lamp)"
			stroke-width="2.5"
			opacity={0.4 + 0.6 * glow}
		/>
		{@render txt(K.x, DEV_Y + 50, 'lamp', 12, { anchor: 'middle', weight: 600 })}
	{:else}
		<!-- voltmeter, zero in the middle -->
		<circle
			cx={K.x}
			cy={DEV_Y}
			r="34"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		{#each [-1, 0, 1] as k (k)}
			{@const a = (k * Math.PI) / 3}
			<line
				x1={K.x + Math.sin(a) * 21}
				y1={DEV_Y + 10 - Math.cos(a) * 21}
				x2={K.x + Math.sin(a) * 27}
				y2={DEV_Y + 10 - Math.cos(a) * 27}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.4"
			/>
		{/each}
		<line
			x1={K.x}
			y1={DEV_Y + 10}
			x2={K.x + Math.sin(meterNeedle) * 26}
			y2={DEV_Y + 10 - Math.cos(meterNeedle) * 26}
			stroke="var(--em-field)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={K.x} cy={DEV_Y + 10} r="3.5" fill="var(--stage-ink)" />
		{@render txt(K.x, DEV_Y + 27, 'V', 11, { anchor: 'middle', weight: 700, muted: true })}
		{@render txt(K.x - 46, DEV_Y - 10, '+', 14, { anchor: 'middle', weight: 700 })}
		{@render txt(K.x, DEV_Y + 52, 'voltmeter', 12, { anchor: 'middle', weight: 600 })}
	{/if}
</g>

<!-- trace -->
<g style:pointer-events="none">
	<line x1={PLOT.x0} x2={PLOT.x1} y1={zeroY} y2={zeroY} stroke="var(--stage-line)" />
	<line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.top} y2={PLOT.bottom} stroke="var(--stage-line)" />
	<line x1={PLOT.x0} x2={PLOT.x1} y1={sy(yMax)} y2={sy(yMax)} stroke="var(--stage-grid)" />
	{#if traceKind === 'current'}
		<line
			x1={PLOT.x0}
			x2={PLOT.x1}
			y1={sy(stall)}
			y2={sy(stall)}
			stroke="var(--em-current)"
			stroke-dasharray="6 5"
			opacity="0.7"
		/>
		{@render txt(PLOT.x1 - 4, sy(stall) - 6, `held still: ${stall.toFixed(2)} A`, 11, {
			anchor: 'end',
			color: 'var(--em-current)',
			weight: 600
		})}
		{#if avgI !== null}
			<line
				x1={PLOT.x0}
				x2={PLOT.x1}
				y1={sy(avgI)}
				y2={sy(avgI)}
				stroke="var(--stage-ink)"
				stroke-dasharray="2 4"
				opacity="0.7"
			/>
			{@render txt(PLOT.x0 + 6, sy(avgI) - 6, `average, last 2 s: ${avgI.toFixed(2)} A`, 11, {
				weight: 600
			})}
		{/if}
	{:else}
		<line x1={PLOT.x0} x2={PLOT.x1} y1={sy(-yMax)} y2={sy(-yMax)} stroke="var(--stage-grid)" />
		{@render txt(PLOT.x0 - 8, sy(-yMax) + 4, `−${yMax}`, 11, { anchor: 'end', muted: true })}
	{/if}
	{@render txt(PLOT.x0 - 8, zeroY + 4, '0', 11, { anchor: 'end', muted: true })}
	{@render txt(PLOT.x0 - 8, sy(yMax) + 4, `${traceKind === 'current' ? '' : '+'}${yMax}`, 11, {
		anchor: 'end',
		muted: true
	})}

	{#if traceKind === 'angle'}
		{#each [0, 90, 180, 270, 360] as d (d)}
			<line
				x1={ax(d)}
				x2={ax(d)}
				y1={PLOT.top}
				y2={PLOT.bottom}
				stroke="var(--stage-grid)"
				stroke-dasharray={d % 180 === 0 ? '3 4' : undefined}
			/>
			{@render txt(ax(d), PLOT.bottom + 15, `${d}°`, 11, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt(ax(180) + 6, PLOT.top + 12, 'dead point', 11, { muted: true })}
		<circle
			cx={ax(holdDeg)}
			cy={sy(torque)}
			r="6"
			fill="var(--em-force)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{:else}
		{@render txt(PLOT.x1, PLOT.bottom + 15, `last ${win} seconds`, 11, {
			anchor: 'end',
			muted: true
		})}
	{/if}
	{#if showGhost && traces.ghost}
		<path
			d={traces.ghost}
			fill="none"
			stroke="var(--em-field)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
			opacity="0.6"
		/>
	{/if}
	{#if traces.main}
		<path
			d={traces.main}
			fill="none"
			stroke={traceColor}
			stroke-width="2.4"
			stroke-linejoin="round"
		/>
	{/if}
	{@render txt(PLOT.x0, PLOT.top - 12, traceTitle, 12, { weight: 600, color: traceColor })}
	{#if showGhost}
		{@render txt(PLOT.x1, PLOT.top - 12, 'dashed: the coil’s own voltage', 11, {
			anchor: 'end',
			color: 'var(--em-field)'
		})}
	{/if}
	{#if hand && traces.n < 2}
		{@render txt(
			(PLOT.x0 + PLOT.x1) / 2,
			mid - 12,
			reduced
				? 'Reduced motion is on: choose “Turns steadily” to see the voltage'
				: 'Grab the crank and turn it',
			13,
			{ anchor: 'middle', muted: true }
		)}
	{/if}
</g>

<!-- readout card -->
<g style:pointer-events="none">
	<rect
		x={CARD.x}
		y={CARD.y}
		width={CARD.w}
		height={CARD.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#each cards as c, i (c.id)}
		{@const w = CARD.w / cards.length}
		{@const x = CARD.x + 16 + i * w}
		{#if i > 0}
			<line
				x1={CARD.x + i * w}
				x2={CARD.x + i * w}
				y1={CARD.y + 14}
				y2={CARD.y + CARD.h - 14}
				stroke="var(--border)"
			/>
		{/if}
		<text {x} y={CARD.y + 24} class="muted" style:font-size="12px">{c.label}</text>
		<text {x} y={CARD.y + 49} font-weight="700" style:font-size="18px" style:fill={c.color}
			>{c.value}</text
		>
	{/each}
</g>
