<script lang="ts">
	/**
	 * A palm-sized drone over a field, seen by a camera that follows it, and the same drone seen
	 * from above with a speed bar on each rotor. Each rotor shows its spin (blue clockwise, orange
	 * anticlockwise) and its push (green arrow); the weight is the grey arrow. The twist step and
	 * the turn step add each rotor's twist on the body and the twist left over.
	 *
	 * Everything that moves comes from the simulated drone (`../model`): its position, its tilt and
	 * heading, the four rotor speeds. The drone is advanced frame by frame (the scene guide's
	 * sanctioned accumulator: its motion is the integral of what the controls change), from a fresh
	 * start at each step. Under reduced motion it is run afresh to the frozen time whenever a
	 * control changes. The camera turns between steps so that each tilt is seen side on. The
	 * rotors' blades are drawn turning sixty times slower than they spin.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Drone,
		HOLD_HEIGHT,
		HOVER_RPM,
		KF,
		KM,
		MAX_RPM,
		PROP_RADIUS,
		ROTORS,
		angles,
		bodySpeed,
		hover,
		kmh,
		lift,
		matrix,
		netTwist,
		tilt,
		turnRate,
		type Settings,
		type Speeds
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'drone'));
	const num = (id: string, d: number) => {
		const v = Number(params[id]);
		return Number.isFinite(v) ? v : d;
	};
	const settings = $derived.by((): Settings => {
		switch (phase) {
			case 'throttle': {
				const r = num('throttle', 0) * 60;
				return { mode: 'manual', rpm: [r, r, r, r] };
			}
			case 'twist':
				return { ...hover, sameWay: params.sameWay === true };
			case 'forward':
				return { ...hover, forward: num('forward', 0) };
			case 'sideways':
				return { ...hover, right: num('right', 0) };
			case 'turn':
				return { ...hover, turn: num('turn', 0) };
			case 'hands':
				return {
					mode: 'manual',
					rpm: [num('fl', 241), num('fr', 241), num('br', 241), num('bl', 241)].map(
						(v) => v * 60
					) as Speeds
				};
			default:
				return hover;
		}
	});
	const sameWay = $derived(settings.mode === 'assisted' && settings.sameWay === true);
	const start = $derived(phase === 'throttle' ? { height: 0, rpm: 0 } : { height: HOLD_HEIGHT });

	// ---- the simulated drone (frame-to-frame accumulator) --------------------------------------
	let drone = new Drone(
		untrack(() => settings),
		untrack(() => start)
	);
	let lastT = 0;
	let key = '';
	let last = '';
	/** The blades' drawn angles (sixty times slower than the rotors). */
	const blades = [0.3, 1.1, 0.7, 1.6];
	const sim = $derived.by(() => {
		const s = settings;
		const js = JSON.stringify(s);
		const k = reduced ? `${phase}:${js}` : phase;
		if (k !== key || t < lastT - 1e-6) {
			key = k;
			drone = new Drone(s, start);
			lastT = 0;
		} else if (js !== last) drone.set(s);
		last = js;
		const dt = t - lastT;
		if (dt > 0) {
			drone.run(t);
			if (!reduced)
				drone.state.rpm.forEach((r, i) => {
					blades[i] += ((dt * r) / 3600) * 2 * Math.PI * (sameWay ? -1 : ROTORS[i].spin);
				});
		}
		lastT = t;
		const st = drone.state;
		return {
			pos: [...st.pos] as [number, number, number],
			q: [...st.q] as [number, number, number, number],
			rpm: [...st.rpm] as Speeds,
			w: [...st.w],
			vel: [...st.vel],
			blades: [...blades],
			onGround: st.onGround,
			crashed: st.crashedAt !== null,
			peaks: { ...drone.peaks },
			state: st
		};
	});

	// ---- the camera ----------------------------------------------------------------------------
	const view = $derived.by(() => {
		switch (phase) {
			case 'forward':
				return { look: 90, el: 15 };
			case 'sideways':
				return { look: 0, el: 15 };
			case 'turn':
				return { look: 25, el: 50 };
			default:
				return { look: 35, el: 28 };
		}
	});
	const look = new Tween(
		untrack(() => view.look),
		{ duration: 900, easing: cubicInOut }
	);
	const elev = new Tween(
		untrack(() => view.el),
		{ duration: 900, easing: cubicInOut }
	);
	$effect(() => {
		const v = view;
		untrack(() => {
			const o = reduced ? { duration: 0 } : undefined;
			void look.set(v.look, o);
			void elev.set(v.el, o);
		});
	});

	/** The main view: its window and the camera's lens. */
	const VW = { x: 16, y: 16, w: 600, h: 568 };
	const CX = 316;
	const CY = 262;
	const FOCAL = 1100;
	const DIST = 0.4;
	const NEAR = 0.05;

	type V3 = [number, number, number];
	const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const cam = $derived.by(() => {
		const lk = (look.current * Math.PI) / 180;
		const el = (elev.current * Math.PI) / 180;
		const fwd: V3 = [Math.cos(el) * Math.cos(lk), Math.cos(el) * Math.sin(lk), -Math.sin(el)];
		const right: V3 = [Math.sin(lk), -Math.cos(lk), 0];
		const up: V3 = [
			right[1] * fwd[2] - right[2] * fwd[1],
			right[2] * fwd[0] - right[0] * fwd[2],
			right[0] * fwd[1] - right[1] * fwd[0]
		];
		const p = sim.pos;
		const c: V3 = [p[0] - DIST * fwd[0], p[1] - DIST * fwd[1], p[2] - DIST * fwd[2]];
		return { fwd, right, up, c, el };
	});
	/** Camera coordinates of a world point. */
	const camOf = (x: V3): V3 => {
		const r: V3 = [x[0] - cam.c[0], x[1] - cam.c[1], x[2] - cam.c[2]];
		return [dot(r, cam.right), dot(r, cam.up), dot(r, cam.fwd)];
	};
	const screen = (c: V3) => ({ x: CX + (FOCAL * c[0]) / c[2], y: CY - (FOCAL * c[1]) / c[2] });
	const proj = (x: V3) => screen(camOf(x));
	/** A world segment, cut at the camera's near plane; null when it is all behind. */
	function segment(a: V3, b: V3) {
		let ca = camOf(a);
		let cb = camOf(b);
		if (ca[2] < NEAR && cb[2] < NEAR) return null;
		const cut = (p: V3, q: V3): V3 => {
			const u = (NEAR - p[2]) / (q[2] - p[2]);
			return [p[0] + u * (q[0] - p[0]), p[1] + u * (q[1] - p[1]), NEAR];
		};
		if (ca[2] < NEAR) ca = cut(ca, cb);
		else if (cb[2] < NEAR) cb = cut(cb, ca);
		const p = screen(ca);
		const q = screen(cb);
		return { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
	}
	const f1 = (v: number) => v.toFixed(1);
	const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ');
	const path = (ps: { x: number; y: number }[]) =>
		ps.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)},${f1(p.y)}`).join(' ');

	// ---- the field -----------------------------------------------------------------------------
	const horizon = $derived(CY - FOCAL * Math.tan(cam.el));
	const grid = $derived.by(() => {
		const h = Math.max(0, sim.pos[2]);
		const s = 2 ** Math.max(0, Math.ceil(Math.log2((h + 0.5) / 2)));
		const R = 14 * s;
		const gx = (Math.round(sim.pos[0] / s - 0.5) + 0.5) * s;
		const gy = (Math.round(sim.pos[1] / s - 0.5) + 0.5) * s;
		const lines: { k: string; x1: number; y1: number; x2: number; y2: number }[] = [];
		for (let i = -14; i <= 14; i++) {
			const a = segment([gx + i * s, gy - R, 0], [gx + i * s, gy + R, 0]);
			if (a) lines.push({ k: `x${Math.round((gx + i * s) / s - 0.5)}`, ...a });
			const b = segment([gx - R, gy + i * s, 0], [gx + R, gy + i * s, 0]);
			if (b) lines.push({ k: `y${Math.round((gy + i * s) / s - 0.5)}`, ...b });
		}
		return lines;
	});
	/** The landing pad: a 30 cm square with an H, at the start. */
	const pad = $derived.by(() => {
		const c = camOf([0, 0, 0]);
		if (c[2] < 0.2) return null;
		const sq = [
			[0.15, 0.15],
			[0.15, -0.15],
			[-0.15, -0.15],
			[-0.15, 0.15]
		].map(([x, y]) => proj([x, y, 0]));
		const h = [
			[
				[0.08, 0.06],
				[-0.08, 0.06]
			],
			[
				[0.08, -0.06],
				[-0.08, -0.06]
			],
			[
				[0, 0.06],
				[0, -0.06]
			]
		].map(([a, b]) => segment([a[0], a[1], 0], [b[0], b[1], 0]));
		return { sq: pts(sq), h };
	});
	/** Trees on a loose lattice, kept away from the lines the drone flies along. */
	const trees = $derived.by(() => {
		const S = 7;
		const out: { k: string; x: number; y: number; top: number; r: number; d: number }[] = [];
		const i0 = Math.round(sim.pos[0] / S);
		const j0 = Math.round(sim.pos[1] / S);
		for (let i = i0 - 4; i <= i0 + 4; i++)
			for (let j = j0 - 4; j <= j0 + 4; j++) {
				const hsh = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
				if (hsh < 0.45) continue;
				const x = i * S + (hsh - 0.5) * 4;
				const y = j * S + ((hsh * 7) % 1) * 3 - 1.5;
				if (Math.abs(x) < 2.5 || Math.abs(y) < 2.5) continue;
				const base = camOf([x, y, 0]);
				if (base[2] < 3) continue;
				const height = 3 + hsh * 3;
				const b = screen(base);
				const top = screen(camOf([x, y, height]));
				out.push({
					k: `${i}:${j}`,
					x: b.x,
					y: b.y,
					top: top.y,
					r: (FOCAL * 1.1) / base[2],
					d: base[2]
				});
			}
		return out.sort((a, b) => b.d - a.d);
	});
	const shadow = $derived.by(() => {
		const c = camOf([sim.pos[0], sim.pos[1], 0]);
		if (c[2] < NEAR) return null;
		const p = screen(c);
		const rx = (FOCAL * 0.06) / c[2];
		const camH = Math.max(0.05, cam.c[2]);
		const ry = rx * Math.min(1, camH / Math.hypot(camH, c[2]));
		return { ...p, rx, ry, o: 0.35 / (1 + sim.pos[2] / 2) };
	});

	// ---- the drone -----------------------------------------------------------------------------
	const R = $derived(matrix(sim.q));
	const world = (b: V3): V3 => [
		sim.pos[0] + R[0][0] * b[0] + R[0][1] * b[1] + R[0][2] * b[2],
		sim.pos[1] + R[1][0] * b[0] + R[1][1] * b[1] + R[1][2] * b[2],
		sim.pos[2] + R[2][0] * b[0] + R[2][1] * b[1] + R[2][2] * b[2]
	];
	const pb = (b: V3) => proj(world(b));
	const scale = $derived(FOCAL / Math.max(NEAR, camOf(sim.pos)[2]));
	const HOVER_THRUST = KF * HOVER_RPM * HOVER_RPM;
	/** Arrow lengths: 2.2 cm of drawing for each rotor’s hovering push, so 8.8 cm for the weight. */
	const ARROW = 0.022;
	const ROTOR_Z = 0.012;
	const spinOf = (i: number) => (sameWay ? -1 : ROTORS[i].spin);
	const spinColor = (s: number) => (s < 0 ? 'var(--dr-cw)' : 'var(--dr-ccw)');
	/** An arc in the body's plane, around (cx, cy) at height z, from angle a0 turning by `sweep`. */
	function arc(cx: number, cy: number, z: number, r: number, a0: number, sweep: number, n = 12) {
		const out = [];
		for (let k = 0; k <= n; k++) {
			const a = a0 + (sweep * k) / n;
			out.push(pb([cx + r * Math.cos(a), cy + r * Math.sin(a), z]));
		}
		return path(out);
	}
	const rotors = $derived(
		ROTORS.map((r, i) => {
			const rpm = sim.rpm[i];
			const s = spinOf(i);
			const disc = Array.from({ length: 20 }, (_, k) => {
				const a = (k / 20) * 2 * Math.PI;
				return pb([r.x + PROP_RADIUS * Math.cos(a), r.y + PROP_RADIUS * Math.sin(a), ROTOR_Z]);
			});
			const b = sim.blades[i];
			const bx = Math.cos(b) * PROP_RADIUS * 0.92;
			const by = Math.sin(b) * PROP_RADIUS * 0.92;
			const b1 = pb([r.x + bx, r.y + by, ROTOR_Z]);
			const b2 = pb([r.x - bx, r.y - by, ROTOR_Z]);
			const hub = pb([r.x, r.y, ROTOR_Z]);
			const push = (KF * rpm * rpm) / HOVER_THRUST;
			const tip = pb([r.x, r.y, ROTOR_Z + ARROW * push]);
			const twist = (KM * rpm * rpm) / (KM * HOVER_RPM * HOVER_RPM);
			return {
				id: r.id,
				s,
				disc: pts(disc),
				blade: { x1: b1.x, y1: b1.y, x2: b2.x, y2: b2.y },
				hub,
				motor: pb([r.x, r.y, 0]),
				arm: pb([r.x, r.y, 0]),
				push,
				tip,
				spinArc: arc(r.x, r.y, ROTOR_Z, PROP_RADIUS * 0.7, s > 0 ? -2.2 : 2.2, s * 3.6),
				twistArc: arc(r.x, r.y, 0, PROP_RADIUS * 1.3, s > 0 ? 1.2 : -1.2, -s * 2.2),
				twist
			};
		})
	);
	const body = $derived({
		top: pts(
			[
				[0.019, 0.011],
				[0.019, -0.011],
				[-0.019, -0.011],
				[-0.019, 0.011]
			].map(([x, y]) => pb([x, y, 0.004]))
		),
		bottom: pts(
			[
				[0.019, 0.011],
				[0.019, -0.011],
				[-0.019, -0.011],
				[-0.019, 0.011]
			].map(([x, y]) => pb([x, y, -0.004]))
		),
		nose: pb([0.021, 0, 0.002]),
		centre: pb([0, 0, 0])
	});
	const weightTip = $derived(proj([sim.pos[0], sim.pos[1], sim.pos[2] - 4 * ARROW]));
	/** The four pushes added up, and the part of it that points along the ground. */
	const pushAll = $derived.by(() => {
		const l = lift(sim.state);
		const up = world([0, 0, 4 * ARROW * l]);
		const along: V3 = [
			sim.pos[0] + R[0][2] * 4 * ARROW * l,
			sim.pos[1] + R[1][2] * 4 * ARROW * l,
			sim.pos[2]
		];
		return { tip: proj(up), along: proj(along), size: Math.hypot(R[0][2], R[1][2]) * l };
	});
	/** Twist left over (positive anticlockwise), as a share of one hovering rotor's twist. */
	const ONE_TWIST = KM * HOVER_RPM * HOVER_RPM;
	const twistLeft = $derived(netTwist(sim.state, sameWay) / ONE_TWIST);
	const twistSweep = $derived(Math.sign(twistLeft) * Math.min(5.2, Math.abs(twistLeft) * 40));
	const spinRate = $derived(turnRate(sim.state));
	const whirl = $derived(Math.min(1, Math.max(0, (Math.abs(spinRate) - 2) / 6)));

	// ---- the view from above -------------------------------------------------------------------
	const TX = 790;
	const TY = 178;
	const TK = 68 / (ROTORS[0].x || 1);
	const top = (r: { x: number; y: number }) => ({ x: TX - r.y * TK, y: TY - r.x * TK });
	const BAR_H = 70;
	const mean = $derived(sim.rpm.reduce((a, b) => a + b, 0) / 4 / 60);
	const panel = $derived(
		ROTORS.map((r, i) => {
			const p = top(r);
			const turns = sim.rpm[i] / 60;
			const diff = turns - mean;
			const left = r.y > 0;
			const s = spinOf(i);
			return {
				id: r.id,
				...p,
				s,
				turns,
				diff,
				barX: left ? p.x - 62 : p.x + 50,
				fill: (sim.rpm[i] / MAX_RPM) * BAR_H,
				// The spin arrow on screen: from above, anticlockwise is anticlockwise.
				arrow: `M${f1(p.x + 26 * Math.cos(-0.5))},${f1(p.y + 26 * Math.sin(-0.5))} A26,26 0 1,${s < 0 ? 1 : 0} ${f1(p.x + 26 * Math.cos(-0.5 + (s < 0 ? 4.2 : -4.2)))},${f1(p.y + 26 * Math.sin(-0.5 + (s < 0 ? 4.2 : -4.2)))}`
			};
		})
	);
	const HOVER_BAR = (HOVER_RPM / MAX_RPM) * BAR_H;

	// ---- what each step says -------------------------------------------------------------------
	const height = $derived(Math.max(0, sim.pos[2]));
	const heightText = $derived(
		height < 0.005
			? 'on the ground'
			: height < 10
				? `${height.toFixed(1)} m`
				: `${Math.round(height)} m`
	);
	const ang = $derived(angles(sim.q));
	const tiltDeg = $derived(tilt(sim.state));
	const bs = $derived(bodySpeed(sim.state));
	const liftNow = $derived(lift(sim.state));
	const throttleTurns = $derived(Math.round(num('throttle', 0)));
	const liftText = $derived(
		throttleTurns === 0
			? 'rotors stopped'
			: Math.abs(liftNow - 1) < 0.004
				? 'pushes: just about the weight'
				: liftNow < 1
					? 'pushes: less than the weight'
					: 'pushes: more than the weight'
	);
	const vz = $derived(sim.vel[2]);
	const climbText = $derived(
		sim.onGround
			? 'sitting on the pad'
			: Math.abs(vz) < 0.02
				? 'hovering'
				: `${vz > 0 ? 'climbing' : 'sinking'} at ${Math.abs(vz).toFixed(1)} m a second`
	);
	const speedOf = (v: number) => Math.round(kmh(Math.abs(v)));
	const tipText = (k: 'pitch' | 'roll' | 'yaw', pos: string, neg: string) => {
		const v = sim.peaks[k];
		if (Math.abs(v) < 0.3) return 'all four the same';
		return `${v > 0 ? pos : neg}: +${Math.max(1, Math.round(Math.abs(v)))} turns a second`;
	};
	const forwardRows = $derived([
		{
			id: 'tilt',
			label: 'Tilt',
			value:
				tiltDeg < 0.5 ? 'level' : `${Math.round(tiltDeg)}° nose ${ang.pitch > 0 ? 'down' : 'up'}`
		},
		{
			id: 'speed',
			label: 'Speed',
			value:
				speedOf(bs.forward) === 0
					? 'standing still'
					: `${speedOf(bs.forward)} km/h ${bs.forward > 0 ? 'forward' : 'backwards'}`
		},
		{
			id: 'tip',
			label: 'For a moment, to tip it',
			value: tipText('pitch', 'back pair', 'front pair')
		}
	]);
	const sidewaysRows = $derived([
		{
			id: 'tilt',
			label: 'Tilt',
			value:
				tiltDeg < 0.5
					? 'level'
					: `${Math.round(tiltDeg)}° to the ${ang.roll > 0 ? 'right' : 'left'}`
		},
		{
			id: 'speed',
			label: 'Speed',
			value:
				speedOf(bs.right) === 0
					? 'standing still'
					: `${speedOf(bs.right)} km/h to the ${bs.right > 0 ? 'right' : 'left'}`
		},
		{
			id: 'tip',
			label: 'For a moment, to tip it',
			value: tipText('roll', 'left pair', 'right pair')
		}
	]);
	const turnDeg = $derived(Math.round(spinRate * 360));
	const turnRows = $derived([
		{
			id: 'turning',
			label: 'Turning',
			value:
				turnDeg === 0
					? 'not turning'
					: `${turnDeg > 0 ? 'left' : 'right'}, ${Math.abs(turnDeg)}° a second`
		},
		{
			id: 'lift',
			label: 'Lift',
			value: Math.abs(liftNow - 1) < 0.002 ? 'the same: it holds its height' : 'changing'
		},
		{
			id: 'tip',
			label: 'For a moment, to turn it',
			value: tipText('yaw', 'clockwise pair', 'anticlockwise pair')
		}
	]);
	const twistRows = $derived([
		{
			id: 'twists',
			label: 'Twists',
			value: sameWay ? 'all four the same way' : 'two each way: they cancel'
		},
		{
			id: 'body',
			label: 'Body',
			value:
				Math.abs(spinRate) < 0.02
					? 'not turning'
					: `whirling ${spinRate > 0 ? 'anticlockwise' : 'clockwise'}, ${Math.abs(spinRate) < 10 ? Math.abs(spinRate).toFixed(1) : Math.round(Math.abs(spinRate))} turns a second`
		}
	]);
	const handsStatus = $derived(
		sim.crashed
			? 'crashed! back on its feet in a moment'
			: sim.onGround
				? 'on the ground'
				: tiltDeg > 20
					? 'tipping over!'
					: tiltDeg > 1
						? 'tipping…'
						: Math.abs(vz) < 0.02
							? 'level, hovering'
							: `level, ${vz > 0 ? 'climbing' : 'sinking'}`
	);
	const rows = $derived.by(() => {
		switch (phase) {
			case 'throttle':
				return [
					{ id: 'push', label: 'Lift', value: liftText.replace('pushes: ', '') },
					{ id: 'height', label: 'Height', value: heightText },
					{ id: 'climb', label: 'Now', value: climbText }
				];
			case 'twist':
				return twistRows;
			case 'forward':
				return forwardRows;
			case 'sideways':
				return sidewaysRows;
			case 'turn':
				return turnRows;
			case 'hands':
				return [
					{ id: 'status', label: 'Drone', value: handsStatus },
					{ id: 'tilt', label: 'Tilt', value: tiltDeg < 0.5 ? 'level' : `${Math.round(tiltDeg)}°` },
					{ id: 'height', label: 'Height', value: heightText }
				];
			default:
				return [
					{ id: 'rotors', label: 'Each rotor', value: `${Math.round(mean)} turns a second` },
					{ id: 'push', label: 'Four pushes', value: 'hold up the weight' },
					{ id: 'height', label: 'Height', value: heightText }
				];
		}
	});
	const showTwist = $derived(phase === 'twist' || phase === 'turn');
	const showSplit = $derived(phase === 'forward' || phase === 'sideways');
	const splitWord = $derived(phase === 'forward' ? 'forward' : 'sideways');
</script>

<g>
	<defs>
		<clipPath id="dr-view">
			<rect x={VW.x} y={VW.y} width={VW.w} height={VW.h} rx="14" />
		</clipPath>
	</defs>

	<!-- ============================================================ the field and the drone -->
	<g clip-path="url(#dr-view)">
		<rect x={VW.x} y={VW.y} width={VW.w} height={VW.h} fill="var(--dr-ground)" />
		{#if horizon > VW.y}
			<rect x={VW.x} y={VW.y} width={VW.w} height={horizon - VW.y} fill="var(--dr-sky)" />
		{/if}
		{#each grid as g (g.k)}
			<line {...g} stroke="var(--dr-grid)" stroke-width="1" />
		{/each}
		{#if pad}
			<polygon
				points={pad.sq}
				fill="var(--dr-pad)"
				stroke="var(--dr-pad-edge)"
				stroke-width="1.5"
			/>
			{#each pad.h as s, i (i)}
				{#if s}
					<line
						{...s}
						stroke="var(--dr-pad-edge)"
						stroke-width={Math.max(3, scale * 0.012)}
						stroke-linecap="round"
					/>
				{/if}
			{/each}
		{/if}
		{#each trees as tr (tr.k)}
			<line
				x1={tr.x}
				y1={tr.y}
				x2={tr.x}
				y2={tr.top + tr.r * 0.6}
				stroke="var(--dr-trunk)"
				stroke-width={Math.max(1.5, tr.r * 0.22)}
			/>
			<circle cx={tr.x} cy={tr.top + tr.r * 0.6} r={tr.r} fill="var(--dr-tree)" opacity="0.9" />
		{/each}
		{#if shadow}
			<ellipse
				cx={shadow.x}
				cy={shadow.y}
				rx={shadow.rx}
				ry={shadow.ry}
				fill="var(--dr-shadow)"
				opacity={shadow.o}
			/>
		{/if}

		<!-- the weight, down from the middle -->
		{#if phase !== 'turn'}
			<line
				x1={body.centre.x}
				y1={body.centre.y}
				x2={weightTip.x}
				y2={weightTip.y}
				stroke="var(--dr-weight)"
				stroke-width="5"
				marker-end="url(#arrowhead)"
				opacity={sim.crashed ? 0 : 0.85}
			/>
		{/if}

		<!-- the drone: body and arms, then the rotors above them -->
		<g opacity={1 - 0.75 * whirl}>
			<polygon points={body.bottom} fill="var(--dr-body-edge)" />
			{#each rotors as r (r.id)}
				<line
					x1={body.centre.x}
					y1={body.centre.y}
					x2={r.arm.x}
					y2={r.arm.y}
					stroke="var(--dr-arm)"
					stroke-width={Math.max(3, scale * 0.006)}
					stroke-linecap="round"
				/>
				<line
					x1={r.motor.x}
					y1={r.motor.y}
					x2={r.hub.x}
					y2={r.hub.y}
					stroke="var(--dr-motor)"
					stroke-width={Math.max(4, scale * 0.006)}
					stroke-linecap="round"
				/>
			{/each}
			<polygon
				points={body.top}
				fill="var(--dr-body)"
				stroke="var(--dr-body-edge)"
				stroke-width="1.5"
			/>
			<circle
				cx={body.nose.x}
				cy={body.nose.y}
				r={Math.max(3, scale * 0.005)}
				fill="var(--dr-nose)"
			/>
			{#each rotors as r (r.id)}
				<polygon
					points={r.disc}
					fill={spinColor(r.s)}
					fill-opacity="0.22"
					stroke={spinColor(r.s)}
					stroke-width="1.5"
				/>
				{#if r.push > 0.01}
					<line {...r.blade} stroke={spinColor(r.s)} stroke-width="3" stroke-linecap="round" />
				{/if}
				<path
					d={r.spinArc}
					fill="none"
					stroke={spinColor(r.s)}
					stroke-width="2.5"
					marker-end="url(#arrowhead)"
				/>
				{#if showTwist && r.push > 0.01}
					<path
						d={r.twistArc}
						fill="none"
						stroke="var(--dr-twist)"
						stroke-width={1.5 + 1.5 * r.twist}
						marker-end="url(#arrowhead)"
						opacity="0.9"
					/>
				{/if}
			{/each}
		</g>
		{#if whirl > 0}
			<polygon
				points={pts(
					Array.from({ length: 24 }, (_, k) => {
						const a = (k / 24) * 2 * Math.PI;
						return proj([
							sim.pos[0] + 0.055 * Math.cos(a),
							sim.pos[1] + 0.055 * Math.sin(a),
							sim.pos[2]
						]);
					})
				)}
				fill="var(--dr-arm)"
				opacity={0.2 * whirl}
			/>
		{/if}
		<!-- the pushes -->
		{#if !sim.crashed}
			{#each rotors as r (r.id)}
				{#if r.push > 0.03}
					<line
						x1={r.hub.x}
						y1={r.hub.y}
						x2={r.tip.x}
						y2={r.tip.y}
						stroke="var(--dr-push)"
						stroke-width="4"
						marker-end="url(#arrowhead)"
					/>
				{/if}
			{/each}
		{/if}
		{#if showSplit && pushAll.size > 0.01}
			<line
				x1={body.centre.x}
				y1={body.centre.y}
				x2={pushAll.along.x}
				y2={pushAll.along.y}
				stroke="var(--dr-along)"
				stroke-width="5"
				marker-end="url(#arrowhead)"
			/>
			<Readout id="alongLabel">
				<Label
					x={pushAll.along.x + (pushAll.along.x > body.centre.x ? 10 : -10)}
					y={pushAll.along.y + 44}
					text="part of the push: {splitWord}"
					anchor={pushAll.along.x > body.centre.x ? 'start' : 'end'}
					size={14}
					weight={600}
					color="var(--dr-along-ink)"
				/>
			</Readout>
		{/if}
		{#if showTwist && Math.abs(twistSweep) > 0.5}
			<path
				d={arc(0, 0, 0, 0.06, -twistSweep / 2 - Math.PI / 2, twistSweep, 24)}
				fill="none"
				stroke="var(--dr-twist)"
				stroke-width="5"
				marker-end="url(#arrowhead)"
			/>
		{/if}

		<!-- labels on the drone -->
		{#if phase === 'drone' || phase === 'next'}
			<Readout id="pushLabel">
				<Label
					x={rotors[1].tip.x + 12}
					y={rotors[1].tip.y + 4}
					text="push"
					size={15}
					weight={600}
					color="var(--dr-push-ink)"
				/>
			</Readout>
			<Readout id="weightLabel">
				<Label
					x={weightTip.x + 14}
					y={weightTip.y - 6}
					text="weight"
					size={15}
					weight={600}
					color="var(--dr-weight-ink)"
				/>
			</Readout>
			<Readout id="frontLabel">
				<Label x={body.nose.x + 12} y={body.nose.y + 34} text="front" size={14} muted />
			</Readout>
		{/if}
		{#if sim.crashed}
			<Label
				x={body.centre.x}
				y={body.centre.y - 100}
				text="crash!"
				size={18}
				weight={700}
				anchor="middle"
				color="var(--dr-nose)"
			/>
		{/if}
		{#if phase === 'twist' && sameWay}
			<Label
				x={body.centre.x}
				y={VW.y + 40}
				text="nothing cancels the twist: the body whirls the other way"
				size={15}
				weight={600}
				anchor="middle"
				color="var(--dr-twist-ink)"
			/>
		{/if}
	</g>
	<rect
		x={VW.x}
		y={VW.y}
		width={VW.w}
		height={VW.h}
		rx="14"
		fill="none"
		stroke="var(--border)"
		stroke-width="1.5"
	/>

	<!-- ============================================================ seen from above -->
	<rect
		x="632"
		y="16"
		width="312"
		height="318"
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	<Label
		x={788}
		y={42}
		text="seen from above"
		size={15}
		weight={600}
		anchor="middle"
		halo={false}
	/>
	<Label x={TX} y={TY - 98} text="front ▲" size={12} muted anchor="middle" halo={false} />
	{#each panel as p (p.id)}
		<line
			x1={TX}
			y1={TY}
			x2={p.x}
			y2={p.y}
			stroke="var(--dr-arm)"
			stroke-width="7"
			stroke-linecap="round"
		/>
	{/each}
	<rect
		x={TX - 14}
		y={TY - 22}
		width="28"
		height="44"
		rx="5"
		fill="var(--dr-body)"
		stroke="var(--dr-body-edge)"
		stroke-width="1.5"
	/>
	<circle cx={TX} cy={TY - 26} r="5" fill="var(--dr-nose)" />
	{#each panel as p (p.id)}
		<circle cx={p.x} cy={p.y} r="34" fill="var(--surface)" />
		<circle
			cx={p.x}
			cy={p.y}
			r="34"
			fill={spinColor(p.s)}
			fill-opacity="0.18"
			stroke={spinColor(p.s)}
			stroke-width="2"
		/>
		<path
			d={p.arrow}
			fill="none"
			stroke={spinColor(p.s)}
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<text x={p.x} y={p.y + 5} text-anchor="middle" font-size="15" font-weight="700" class="tab"
			>{Math.round(p.turns)}</text
		>
		<!-- the speed bar -->
		<rect
			x={p.barX}
			y={p.y - BAR_H / 2}
			width="12"
			height={BAR_H}
			rx="3"
			fill="none"
			stroke="var(--border)"
			stroke-width="1.2"
		/>
		<rect
			x={p.barX}
			y={p.y + BAR_H / 2 - p.fill}
			width="12"
			height={p.fill}
			rx="3"
			fill={p.diff > 0.4
				? 'var(--dr-faster)'
				: p.diff < -0.4
					? 'var(--dr-slower)'
					: 'var(--dr-bar)'}
		/>
		<line
			x1={p.barX - 3}
			y1={p.y + BAR_H / 2 - HOVER_BAR}
			x2={p.barX + 15}
			y2={p.y + BAR_H / 2 - HOVER_BAR}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="3 2"
		/>
		{#if Math.abs(p.diff) > 0.4}
			<text
				x={p.barX + 6}
				y={p.diff > 0 ? p.y - BAR_H / 2 - 6 : p.y + BAR_H / 2 + 16}
				text-anchor="middle"
				font-size="14"
				font-weight="700"
				fill={p.diff > 0 ? 'var(--dr-faster)' : 'var(--dr-slower)'}>{p.diff > 0 ? '▲' : '▼'}</text
			>
		{/if}
	{/each}
	<Readout id="kCw" order={20} label="Clockwise" color="var(--dr-cw)">
		<circle cx="660" cy="314" r="6" fill="var(--dr-cw)" />
		<Label x={672} y={318} text="clockwise" size={13} halo={false} anchor="start" />
	</Readout>
	<Readout id="kCcw" order={21} label="Anticlockwise" color="var(--dr-ccw)">
		<circle cx="770" cy="314" r="6" fill="var(--dr-ccw)" />
		<Label x={782} y={318} text="anticlockwise" size={13} halo={false} anchor="start" />
	</Readout>
	<Label x={928} y={TY + 120} text="turns a second" size={11} muted anchor="end" halo={false} />

	<!-- ============================================================ the readouts -->
	<!-- (on phones the rows leave for the panel under the stage, and the empty card goes too) -->
	<Readout id="card">
		<rect
			x="632"
			y="350"
			width="312"
			height="234"
			rx="14"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
	</Readout>
	{#each rows as row, i (row.id)}
		<Readout id={row.id} order={i + 1} label={row.label} value={row.value}>
			<Label
				x={652}
				y={384 + i * 52}
				text={row.label}
				size={12}
				muted
				halo={false}
				anchor="start"
			/>
			<Label
				x={652}
				y={406 + i * 52}
				text={row.value}
				size={15}
				weight={600}
				halo={false}
				anchor="start"
				tabular
			/>
		</Readout>
	{/each}
</g>

<style>
	.tab {
		font-variant-numeric: tabular-nums;
		fill: var(--stage-ink);
	}
</style>
