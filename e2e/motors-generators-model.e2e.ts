// Checks the model behind the motors-generators explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	MACHINE,
	MotorRun,
	NBA,
	coilTorque,
	fluxLinkage,
	generatorLoad,
	meanTorque,
	motorTorque,
	peakEmf,
	steadyAngle,
	steadyRunning,
	terminalVoltage,
	torqueFromForces,
	coilForces,
	wrap
} from '../src/routes/motors-generators/machine';

const deg = Math.PI / 180;

test('force on each side is N·B·I·L, at right angles to the field, opposite on the two sides', () => {
	const f = coilForces(0.75);
	// 200 turns × 0.25 T × 0.75 A × 0.1 m = 3.75 N.
	expect(f.a.y).toBeCloseTo(3.75, 10);
	expect(f.a.x).toBe(0);
	expect(f.b.y).toBeCloseTo(-3.75, 10);
});

test('torque: zero at the dead points, N·B·I·A when the coil lies along the field', () => {
	const I = 0.75;
	for (const theta of [0, Math.PI, 2 * Math.PI]) {
		expect(Math.abs(torqueFromForces(theta, I))).toBeLessThan(1e-12);
	}
	// The couple of the two side forces is the moment-times-field torque, at every angle.
	for (let a = 0; a < 360; a += 15) {
		expect(torqueFromForces(a * deg, I)).toBeCloseTo(coilTorque(a * deg, I), 12);
	}
	const peak = MACHINE.turns * MACHINE.B * I * MACHINE.L * MACHINE.w;
	expect(Math.abs(coilTorque(90 * deg, I))).toBeCloseTo(peak, 12);
	expect(peak).toBeCloseTo(0.375, 12);
	// Half the peak at 30° from a dead point (sin 30° = ½).
	expect(Math.abs(coilTorque(30 * deg, I))).toBeCloseTo(peak / 2, 12);
});

test('over a whole turn the torque averages out without a commutator, and pushes on with one', () => {
	const I = 1;
	expect(Math.abs(meanTorque(I, 'slip'))).toBeLessThan(1e-9);
	// With the commutator: (2/π)·N·B·A·I, always in the same direction.
	expect(meanTorque(I, 'commutator')).toBeCloseTo((2 / Math.PI) * NBA * I, 5);
	for (let a = 0; a < 360; a += 5)
		expect(motorTorque(a * deg, I, 'commutator')).toBeGreaterThanOrEqual(0);
	// Slip rings: the same push for half a turn, then a pull back for the other half.
	expect(motorTorque(90 * deg, I, 'slip')).toBeGreaterThan(0);
	expect(motorTorque(270 * deg, I, 'slip')).toBeLessThan(0);
});

test('a motor with a commutator keeps turning; with slip rings it rocks and stops at a dead point', () => {
	const spun = new MotorRun({ V: 3, connection: 'commutator' });
	expect(spun.at(20).theta - spun.at(10).theta).toBeGreaterThan(10 * 2 * Math.PI * 0.5);
	const stuck = new MotorRun({ V: 3, connection: 'slip' });
	const end = stuck.at(20);
	expect(Math.abs(end.omega)).toBeLessThan(0.01);
	// It overshoots the dead point and rocks back: it swings well past 180° and crosses it
	// several times before it settles.
	let maxTheta = 0;
	let crossings = 0;
	let prev = stuck.at(0).theta;
	for (let t = 0.01; t <= 20; t += 0.01) {
		const th = stuck.at(t).theta;
		maxTheta = Math.max(maxTheta, th);
		if ((prev - Math.PI) * (th - Math.PI) < 0) crossings++;
		prev = th;
	}
	expect(maxTheta).toBeGreaterThan(Math.PI + 10 * deg);
	expect(crossings).toBeGreaterThanOrEqual(3);
	// It comes to rest with its plane across the field (θ = 180°): no torque there.
	expect(Math.abs(wrap(end.theta) - Math.PI)).toBeLessThan(2 * deg);
	// Started at a dead point, even the commutator motor never moves.
	const dead = new MotorRun({ V: 3, connection: 'commutator' }, { theta: 0, omega: 0 });
	expect(dead.at(10).theta).toBe(0);
});

test('back emf: a free motor speeds up until its own voltage cancels over half the battery', () => {
	const free = steadyRunning({ V: 3, connection: 'commutator' });
	// Numbers the narrative quotes: about 0.84 turns a second, drawing about 0.32 A on
	// average, against the 0.75 A (3 V across 4 Ω) the battery drives through the coil held still.
	expect(free.speed).toBeCloseTo(0.84, 2);
	expect(free.current).toBeCloseTo(0.32, 2);
	expect(3 / MACHINE.R).toBe(0.75);
	expect(free.backEmf).toBeGreaterThan(1.5);
	// Twice the voltage, about twice the speed.
	const fast = steadyRunning({ V: 6, connection: 'commutator' });
	expect(fast.speed / free.speed).toBeCloseTo(2, 1);
	// A load slows it down and the current rises.
	const braked = steadyRunning({ V: 3, connection: 'commutator', load: 0.05 });
	expect(braked.speed).toBeLessThan(free.speed / 2);
	expect(braked.current).toBeGreaterThan(free.current * 1.5);
	// Energy is conserved in steady running: the battery's power goes into heat in the coil
	// and work against friction (mean V·I = mean I²R + mean friction power).
	const steady = new MotorRun({ V: 3, connection: 'commutator' });
	let battery = 0;
	let heat = 0;
	let rubbing = 0;
	const n = 2000;
	for (let i = 0; i < n; i++) {
		const r = steady.readings(15 + (i * 5) / n);
		battery += (3 * r.I) / n;
		heat += (r.I * r.I * MACHINE.R) / n;
		rubbing +=
			((MACHINE.friction * r.omega + MACHINE.dryFriction * Math.tanh(r.omega / 0.05)) * r.omega) /
			n;
	}
	expect((heat + rubbing) / battery).toBeCloseTo(1, 2);
	// With the commutator the battery's current never runs backwards, so the push never reverses.
	const run = new MotorRun({ V: 3, connection: 'commutator' });
	for (let t = 0; t < 15; t += 0.01) expect(run.readings(t).torque).toBeGreaterThanOrEqual(0);
});

test('generator: the emf is −dΦ/dt, peaking at N·B·A·ω', () => {
	const f = 1; // turns per second
	const omega = 2 * Math.PI * f;
	const h = 1e-6;
	for (const t of [0.05, 0.2, 0.4, 0.7]) {
		const dPhi =
			(fluxLinkage(steadyAngle(t + h, f)) - fluxLinkage(steadyAngle(t - h, f))) / (2 * h);
		expect(terminalVoltage(steadyAngle(t, f), omega, 'slip')).toBeCloseTo(-dPhi, 5);
	}
	let peak = 0;
	for (let i = 0; i < 1000; i++) {
		peak = Math.max(peak, terminalVoltage(steadyAngle(i / 1000, f), omega, 'slip'));
	}
	expect(peak).toBeCloseTo(NBA * omega, 4);
	expect(peakEmf(1)).toBeCloseTo(3.14, 2);
	// Twice as fast: twice the peak voltage.
	expect(peakEmf(2) / peakEmf(1)).toBeCloseTo(2, 12);
});

test('slip rings give alternating current; the commutator gives a voltage that never reverses', () => {
	const f = 2;
	const omega = 2 * Math.PI * f;
	const n = 2000;
	let mean = 0;
	let rising = 0;
	let minDc = Infinity;
	let prev = terminalVoltage(steadyAngle(0.5 / n, f), omega, 'slip');
	for (let i = 1; i <= n; i++) {
		const t = (i + 0.5) / n; // one second
		const ac = terminalVoltage(steadyAngle(t, f), omega, 'slip');
		mean += ac / n;
		if (prev < 0 && ac >= 0) rising++;
		prev = ac;
		minDc = Math.min(minDc, terminalVoltage(steadyAngle(t, f), omega, 'commutator'));
	}
	expect(Math.abs(mean)).toBeLessThan(1e-3 * NBA * omega);
	// One full cycle per turn: 2 turns per second → alternating at 2 Hz.
	expect(rising).toBe(f);
	expect(minDc).toBeGreaterThanOrEqual(0);
});

test('a generator delivering current is harder to turn (Lenz)', () => {
	const omega = 2 * Math.PI;
	for (let a = 5; a < 360; a += 10) {
		const g = generatorLoad(a * deg, omega, 10);
		// The torque on the coil opposes the (anticlockwise) turning, or is zero.
		expect(g.torque).toBeLessThanOrEqual(0);
	}
	// Averaged over a turn, the work done turning it equals the electrical energy delivered.
	let mech = 0;
	let elec = 0;
	for (let i = 0; i < 3600; i++) {
		const th = ((i + 0.5) / 3600) * 2 * Math.PI;
		const g = generatorLoad(th, omega, 10);
		mech += -g.torque * omega;
		elec += g.current * g.current * 10;
	}
	expect(mech / elec).toBeCloseTo(1, 10);
});
