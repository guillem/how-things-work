// Checks the feedback-control model: the car, drone, balancing pole and arm under PID
// control, and the numbers the narrative quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	CAR,
	DRONE,
	G,
	KMH,
	balance,
	carLinear,
	carUltimate,
	criticalDelay,
	drive,
	droneDamping,
	fly,
	fullForce,
	holdingTorque,
	joints,
	mean,
	moveArm,
	overshoot,
	pOffset,
	pSettles,
	peak,
	reach,
	swings,
	throttleToHold,
	zieglerNichols,
	type Gains,
	type Run
} from '../src/routes/feedback-control/control';

/** Car gains as the page shows them: % throttle per km/h (and per km/h per second). */
const car = (kp: number, ki = 0, kd = 0): Gains => ({
	kp: (kp / 100) * 3.6,
	ki: (ki / 100) * 3.6,
	kd: (kd / 100) * 3.6
});
const kmh = (v: number) => v / KMH;
const range = (r: Run, t0 = 0) => {
	let lo = Infinity;
	let hi = -Infinity;
	for (let i = Math.round(t0 / r.sample); i < r.y.length; i++) {
		lo = Math.min(lo, r.y[i]);
		hi = Math.max(hi, r.y[i]);
	}
	return [kmh(lo), kmh(hi)];
};

// ------------------------------------------------------------ the car

test("the car: Åström & Murray's numbers, about a quarter throttle to hold 90 km/h", () => {
	// Feedback Systems §4.1: 1600 kg, torque 190 N·m peak, top gear αₙ = 10
	expect(fullForce(CAR.wm / CAR.alpha)).toBeCloseTo(1900, 6);
	expect(throttleToHold(90 * KMH)).toBeCloseTo(0.264, 3);
	// a fixed throttle doesn't hold the speed over hills of ±2.5%
	const open = drive({ road: 'hills', gains: car(0), fixed: throttleToHold(25), v0: 25 });
	const [lo, hi] = range(open);
	expect(lo).toBeLessThan(82);
	expect(lo).toBeGreaterThan(80);
	expect(hi).toBeGreaterThan(92);
	expect(hi).toBeLessThan(93);
});

test('P control leaves an error: the throttle it needs divided by Kp', () => {
	for (const kp of [5, 10, 20, 40]) {
		const run = drive({ road: 'flat', gains: car(kp), seconds: 90 });
		const v = mean(run, run.y, 80, 90);
		// at rest the throttle Kp·e is exactly what holds the speed
		expect(car(kp).kp * (25 - v)).toBeCloseTo(throttleToHold(v), 3);
		expect(v).toBeCloseTo(pSettles(car(kp).kp, 25), 3);
	}
	// 10% per km/h: settles 2.6 km/h short; twice the gain, about half the error
	expect(90 - kmh(pSettles(car(10).kp, 25))).toBeCloseTo(2.56, 2);
	expect(90 - kmh(pSettles(car(20).kp, 25))).toBeCloseTo(1.3, 1);
	expect(90 - kmh(pSettles(car(5).kp, 25))).toBeCloseTo(4.96, 2);
});

test('near a cruising speed, the P error follows Δr / (1 + K·G(0))', () => {
	const kp = car(10).kp;
	const r1 = 25;
	const v1 = pSettles(kp, r1);
	const lin = carLinear(v1);
	const dr = 0.5 * KMH;
	// settled at v1, the target is raised by half a km/h
	const run = drive({ road: 'flat', gains: { kp, ki: 0, kd: 0 }, v0: v1, target: r1 + dr });
	const dv = mean(run, run.y, 80, 90) - v1;
	const de = dr - dv;
	expect(de / pOffset(kp, lin.g0, dr)).toBeCloseTo(1, 2);
	// G(0) is huge (the car is barely held back near 90 km/h), so most of the step is followed
	expect(lin.g0).toBeGreaterThan(50);
});

test('PI control removes the error; too strong an integral overshoots', () => {
	// over the hills its error averages out, where P alone stays short of the target
	const pi = drive({ road: 'hills', gains: car(10, 2), v0: 25 });
	const p = drive({ road: 'hills', gains: car(10), v0: 25 });
	expect(Math.abs(90 - kmh(mean(pi, pi.y, 15, 90)))).toBeLessThan(0.3);
	expect(90 - kmh(mean(p, p.y, 15, 90))).toBeGreaterThan(2);
	const flat = drive({ road: 'flat', gains: car(10, 2), v0: 80 * KMH });
	expect(kmh(mean(flat, flat.y, 60, 90))).toBeCloseTo(90, 1);
	// from 80 km/h: a gentle integral just tops out, a strong one overshoots by several km/h
	const gentle = drive({ road: 'flat', gains: car(10, 0.5), v0: 80 * KMH, seconds: 40 });
	const strong = drive({ road: 'flat', gains: car(10, 10), v0: 80 * KMH, seconds: 40 });
	expect(kmh(peak(gentle, gentle.y))).toBeLessThan(91);
	expect(kmh(peak(strong, strong.y))).toBeGreaterThan(98);
});

test('integral windup: after an 8% climb at full throttle the car overshoots, unless clamped', () => {
	const wound = drive({ road: 'climb', gains: car(10, 3) });
	const clamped = drive({ road: 'climb', gains: car(10, 3), antiWindup: true });
	// the climb is too steep for the engine: full throttle, and the speed sags to ~85 km/h
	expect(peak(wound, wound.u, 20, 50)).toBe(1);
	expect(kmh(Math.min(...wound.y))).toBeLessThan(86);
	expect(kmh(peak(wound, wound.y))).toBeGreaterThan(105);
	expect(kmh(peak(clamped, clamped.y))).toBeLessThan(96);
	// the wound-up integral then swings it well below the target too
	expect(range(wound, 65)[0]).toBeLessThan(83);
});

test('too much P: the throttle starts to chatter past the ultimate gain', () => {
	const { ku, tu } = carUltimate();
	// in the page's units: about 133% throttle per km/h, a 2.1 s period
	expect((ku * 100) / 3.6).toBeCloseTo(133, 0);
	expect(tu).toBeCloseTo(2.11, 2);
	for (const [f, grows] of [
		[0.9, false],
		[1.1, true]
	] as const) {
		const kp = ku * f;
		const v = pSettles(kp, 25);
		const run = drive({ road: 'flat', gains: { kp, ki: 0, kd: 0 }, v0: v + 0.02, target: 25 });
		const s = swings(run, run.y, v, 2, 12);
		const ratio = s.at(-1)!.a / s[0].a;
		if (grows) expect(ratio).toBeGreaterThan(1.3);
		else expect(ratio).toBeLessThan(0.7);
		// and the swing has the predicted period (crest to crest on the same side)
		const period = (s.at(-1)!.t - s[0].t) / ((s.length - 1) / 2);
		expect(period).toBeCloseTo(tu, 0);
	}
});

test('Ziegler–Nichols gains: about quarter-amplitude decay, tight on the hills', () => {
	const { ku, tu } = carUltimate();
	const zn = zieglerNichols(ku, tu);
	expect(zn.kp).toBeCloseTo(0.6 * ku, 10);
	expect(zn.ki).toBeCloseTo((1.2 * ku) / tu, 10);
	expect(zn.kd).toBeCloseTo(0.075 * ku * tu, 10);
	// the page's numbers
	expect((zn.kp * 100) / 3.6).toBeCloseTo(80, 0);
	expect((zn.ki * 100) / 3.6).toBeCloseTo(76, 0);
	expect((zn.kd * 100) / 3.6).toBeCloseTo(21, 0);
	const dr = 0.5 * KMH;
	const run = drive({ road: 'flat', gains: zn, v0: 25, target: 25 + dr, seconds: 20 });
	const s = swings(run, run.y, 25 + dr, 0, 20);
	expect(s[1].a / s[0].a).toBeGreaterThan(0.2);
	expect(s[1].a / s[0].a).toBeLessThan(0.3);
	expect(s[0].a / dr).toBeGreaterThan(0.6); // a big first overshoot
	const hills = drive({ road: 'hills', gains: zn, v0: 25 });
	const [lo, hi] = range(hills);
	expect(hi - lo).toBeLessThan(0.3);
});

// ------------------------------------------------------------ the drone

test('the drone under P control bounces like a spring of stiffness Kp', () => {
	for (const kp of [1, 2, 4]) {
		const run = fly({ gains: { kp, ki: 0, kd: 0 }, seconds: 30 });
		const s = swings(run, run.y, 3, 2, 30).filter((c, i, a) => i === 0 || c.t - a[i - 1].t > 0.3);
		const above = s.filter((_, i) => i % 2 === 1);
		const period = (above.at(-1)!.t - above[0].t) / (above.length - 1);
		expect(period / (2 * Math.PI * Math.sqrt(DRONE.m / kp))).toBeCloseTo(1, 1);
		// it hardly loses or gains swing over the 30 s shown (the 1 ms hold adds a little)
		expect(s.at(-1)!.a / s[0].a).toBeCloseTo(1, 1);
	}
	expect(2 * Math.PI * Math.sqrt(1 / 4)).toBeCloseTo(3.14, 2);
});

test('D is friction: the overshoot follows the damping ratio Kd / (2√(m·Kp))', () => {
	for (const kd of [1, 2, 3]) {
		const g = { kp: 4, ki: 0, kd };
		const run = fly({ gains: g, seconds: 20 });
		expect((peak(run, run.y) - 3) / 2).toBeCloseTo(overshoot(droneDamping(g)), 1);
	}
	expect(droneDamping({ kp: 4, ki: 0, kd: 4 })).toBe(1);
	const critical = fly({ gains: { kp: 4, ki: 0, kd: 4 }, seconds: 20 });
	expect(peak(critical, critical.y)).toBeLessThan(3.001);
	expect(overshoot(0.5)).toBeCloseTo(0.163, 3);
});

test('an unexpected 300 g parcel: P and D sag by Δm·g / Kp, the integral lifts it back', () => {
	const pd = fly({ gains: { kp: 4, ki: 0, kd: 4 }, parcel: 0.3 });
	expect(3 - mean(pd, pd.y, 25, 30)).toBeCloseTo((0.3 * G) / 4, 2);
	expect((0.3 * G) / 4).toBeCloseTo(0.74, 2);
	const pid = fly({ gains: { kp: 4, ki: 1, kd: 4 }, parcel: 0.3 });
	expect(mean(pid, pid.y, 25, 30)).toBeCloseTo(3, 2);
});

test('sensor noise: the D term turns it into a shaky thrust', () => {
	const sd = (r: Run) => {
		let s = 0;
		let n = 0;
		for (let i = Math.round(20 / r.sample); i < r.u.length; i++, n++)
			s += (r.u[i] - DRONE.m * G) ** 2;
		return Math.sqrt(s / n);
	};
	const noisy = (kd: number) =>
		fly({ gains: { kp: 4, ki: 1, kd }, noise: 0.02, seconds: 30, sample: 1 / 100 });
	expect(sd(noisy(4))).toBeGreaterThan(1.2);
	expect(sd(noisy(1))).toBeLessThan(sd(noisy(4)) / 2.5);
	// the drone itself barely shakes: a 1 kg mass can't follow fast jitter
	const r = noisy(4);
	expect(Math.abs(mean(r, r.y, 20, 30) - 3)).toBeLessThan(0.02);
});

test('gusts push the drone about; feedback holds it near the target', () => {
	const run = fly({ gains: { kp: 4, ki: 1, kd: 4 }, gusts: true });
	const lo = Math.min(...run.y.slice(Math.round(10 / run.sample)));
	expect(lo).toBeGreaterThan(2.3);
	expect(peak(run, run.y, 10)).toBeLessThan(3.6);
});

test('delay: the loop survives up to its phase margin ÷ crossover frequency, then grows', () => {
	for (const g of [
		{ kp: 4, ki: 1, kd: 4 },
		{ kp: 4, ki: 1, kd: 2 }
	]) {
		const { delay } = criticalDelay(g);
		for (const [f, grows] of [
			[0.9, false],
			[1.1, true]
		] as const) {
			// a small jump (5 cm) so the thrust never reaches its limits
			const run = fly({ gains: g, delay: delay * f, target: 1.05, seconds: 60 });
			const s = swings(run, run.y, 1.05, 10, 60);
			if (grows) expect(s.at(-1)!.a).toBeGreaterThan(s[0].a);
			else expect(s.at(-1)!.a).toBeLessThan(s[0].a);
		}
	}
	expect(criticalDelay({ kp: 4, ki: 1, kd: 4 }).delay).toBeCloseTo(0.27, 2);
	// less damping, less margin… but a slower loop: here it tolerates a little more
	expect(criticalDelay({ kp: 4, ki: 1, kd: 2 }).delay).toBeCloseTo(0.31, 2);
	// with only P the drone has no margin at all: any delay makes it grow
	expect(criticalDelay({ kp: 4, ki: 0, kd: 0 }).delay).toBeLessThan(0);
});

// ------------------------------------------------------------ the pole

test('balancing: the push per radian of tilt must beat g, and needs D to settle', () => {
	const tilt = (r: Run) => (r.x[2].at(-1)! * 180) / Math.PI;
	// just below g it falls, just above it stands
	expect(balance({ gains: { kp: 0.95 * G, ki: 0, kd: 2 } }).end).toBeLessThan(20);
	const up = balance({ gains: { kp: 1.05 * G, ki: 0, kd: 2 } });
	expect(up.end).toBe(Infinity);
	expect(Math.abs(tilt(up))).toBeLessThan(0.5);
	// without D it wobbles on instead of settling (the controller's 1 ms hold even makes it
	// grow, slowly)
	const wobble = balance({ gains: { kp: 15, ki: 0, kd: 0 } });
	const s = swings(wobble, wobble.x[2], 0, 0, 20);
	expect(s.at(-1)!.a / s[0].a).toBeGreaterThan(1);
	expect(s.at(-1)!.a / s[0].a).toBeLessThan(1.1);
	const settled = balance({ gains: { kp: 15, ki: 0, kd: 3 } });
	expect(Math.abs(tilt(settled))).toBeLessThan(0.01);
});

// ------------------------------------------------------------ the arm

test('the arm: inverse kinematics puts the hand on the target', () => {
	for (const [x, y] of [
		[0.5, 0.3],
		[0.2, -0.5],
		[0.1, 0.6]
	]) {
		const q = reach(x, y);
		const j = joints(q.q1, q.q2);
		expect(j.hx).toBeCloseTo(x, 9);
		expect(j.hy).toBeCloseTo(y, 9);
		// elbow up: on the left of the line from the shoulder to the hand
		expect(x * j.ey - y * j.ex).toBeGreaterThan(0);
	}
	// out of reach: the hand stretches as far as it can towards it
	const far = reach(2, 0);
	expect(far.clamped).toBe(true);
	expect(far.x).toBeCloseTo(0.89, 6);
});

test('the arm sags under gravity with P and D; the integral brings it onto the target', () => {
	const q = reach(0.5, 0.3);
	const start: [number, number, number, number, number, number] = [-Math.PI / 2, 0, 0, 0, 0, 0];
	const pd = moveArm(start, q.q1, q.q2, { kp: 100, ki: 0, kd: 10 });
	const hand = joints(pd.q1.at(-1)!, pd.q2.at(-1)!);
	expect(Math.hypot(hand.hx - 0.5, hand.hy - 0.3)).toBeGreaterThan(0.05);
	expect(hand.hy).toBeLessThan(0.3); // it hangs below
	// the shoulder's sag is roughly the gravity torque it needs over Kp
	const sag = q.q1 - pd.q1.at(-1)!;
	expect(sag / (holdingTorque(q.q1, q.q2)[0] / 100)).toBeCloseTo(1, 0);
	const pid = moveArm(start, q.q1, q.q2, { kp: 100, ki: 100, kd: 10 });
	const end = joints(pid.q1.at(-1)!, pid.q2.at(-1)!);
	expect(Math.hypot(end.hx - 0.5, end.hy - 0.3)).toBeLessThan(0.002);
	// a gravity torque of 18.6 N·m holds the arm straight out
	expect(holdingTorque(0, 0)[0]).toBeCloseTo(18.6, 1);
});
