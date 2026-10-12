// Checks the special-relativity model behind the explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	addVelocities,
	C,
	clockTicks,
	flashHits,
	gamma,
	interval,
	intervalKind,
	lightning,
	measuredLength,
	muonRange,
	strikeGap,
	tickAtRest,
	tickMoving,
	toPlatform,
	toTrain,
	TRAIN_LENGTH,
	velocity,
	type Event
} from '../src/routes/special-relativity/relativity';

const events: Event[] = [
	{ ct: 3, x: 1 },
	{ ct: 1, x: 4 },
	{ ct: -2, x: 0.5 },
	{ ct: 2.5, x: -2.5 },
	{ ct: 0, x: 7 }
];
const speeds = [0.1, 0.6, 0.8, 0.99, -0.5];

test('the Lorentz factor: 1.25 at 0.6 c, 5/3 at 0.8 c, about 7.09 at 0.99 c', () => {
	expect(gamma(0)).toBe(1);
	expect(gamma(0.6)).toBeCloseTo(1.25, 12);
	expect(gamma(0.8)).toBeCloseTo(5 / 3, 12);
	expect(gamma(0.99)).toBeCloseTo(7.0888, 4);
	// A jet airliner at 250 m/s: γ − 1 is about 3.5 × 10⁻¹³ (the narrative's figure).
	expect((gamma(250 / C) - 1) / 1e-13).toBeCloseTo(3.48, 2);
});

test('the spacetime interval is the same in every frame', () => {
	for (const beta of speeds)
		for (const e of events) {
			const s2 = interval(e);
			expect(interval(toTrain(e, beta))).toBeCloseTo(s2, 9);
		}
	expect(intervalKind(interval({ ct: 3, x: 1 }))).toBe('timelike');
	expect(intervalKind(interval({ ct: 1, x: 4 }))).toBe('spacelike');
	expect(intervalKind(interval({ ct: 2, x: -2 }))).toBe('lightlike');
});

test('light has the same speed in both frames, in both directions', () => {
	for (const beta of speeds) {
		const o = toTrain({ ct: 0, x: 0 }, beta);
		expect(velocity(o, toTrain({ ct: 5, x: 5 }, beta))).toBeCloseTo(1, 12);
		expect(velocity(o, toTrain({ ct: 5, x: -5 }, beta))).toBeCloseTo(-1, 12);
		// Adding the train's speed to light's still gives light speed.
		expect(addVelocities(1, beta)).toBeCloseTo(1, 12);
	}
	// A ball thrown forward at 0.5 c on a train at 0.6 c: 0.846 c, not 1.1 c.
	expect(addVelocities(0.5, 0.6)).toBeCloseTo(0.8462, 4);
	// At everyday speeds the old rule is right: 20 m/s on a 30 m/s train is 50 m/s.
	expect(addVelocities(20 / C, 30 / C) * C).toBeCloseTo(50, 9);
});

test('going to the train frame and back returns the same event', () => {
	for (const beta of speeds)
		for (const e of events) {
			const back = toPlatform(toTrain(e, beta), beta);
			expect(back.ct).toBeCloseTo(e.ct, 9);
			expect(back.x).toBeCloseTo(e.x, 9);
		}
});

test('a light clock with mirrors 1.5 m apart ticks every 10 ns, γ times slower when moving', () => {
	expect(tickAtRest() * 1e9).toBeCloseTo(10.007, 3);
	expect(tickMoving(0.6) / tickAtRest()).toBeCloseTo(1.25, 12);
	// The same from the Lorentz transformation: ticks on the train, timed on the platform.
	for (const beta of [0.3, 0.6, 0.9]) {
		const ticks = clockTicks(beta, 4);
		for (let k = 1; k < ticks.length; k++)
			expect(ticks[k].ct - ticks[k - 1].ct).toBeCloseTo(2 * gamma(beta), 9);
	}
});

test('the 200 m train measures 160 m on the platform at 0.6 c, and the platform 160 m on the train', () => {
	expect(measuredLength(0.6)).toBeCloseTo(160, 9);
	// Measured at any platform time, the answer is the same.
	expect(measuredLength(0.6, 200, 37)).toBeCloseTo(160, 9);
	// Reciprocity: the platform's ends (x = ±100 m, at rest on the platform), taken at the
	// same train time t′ = 0, are 160 m apart in the train frame.
	const ends = [-100, 100].map((x) => toTrain({ ct: 0.6 * x, x }, 0.6));
	for (const e of ends) expect(e.ct).toBeCloseTo(0, 9);
	expect(ends[1].x - ends[0].x).toBeCloseTo(160, 9);
	// The front and back ends, taken at the same train time, are 200 m apart again.
	const l = lightning(0.6);
	expect(toTrain(l.front, 0.6).x - toTrain(l.back, 0.6).x).toBeCloseTo(200, 9);
});

test('strikes simultaneous on the platform are not simultaneous on the train: the front comes first', () => {
	for (const beta of [0.2, 0.6, 0.99]) {
		const l = lightning(beta);
		expect(l.back.ct).toBe(l.front.ct);
		const back = toTrain(l.back, beta);
		const front = toTrain(l.front, beta);
		expect(front.ct).toBeLessThan(back.ct);
		// The gap is β·L0 in light units.
		expect(back.ct - front.ct).toBeCloseTo(beta * 200, 9);
	}
	// 200 m train at 0.6 c: the front strike is 400 ns earlier on the train's clocks.
	expect(strikeGap(0.6) * 1e9).toBeCloseTo(400.3, 1);
});

test('both frames agree on where the flashes meet; each observer is consistent with c', () => {
	const beta = 0.6;
	const l = lightning(beta);
	// The two flashes meet at the platform observer: a single event on both flashes' paths.
	expect(velocity(l.back, l.platformMeets)).toBeCloseTo(1, 12);
	expect(velocity(l.front, l.platformMeets)).toBeCloseTo(-1, 12);
	// The same event in the train frame is still on both flashes' paths, at c.
	const meet = toTrain(l.platformMeets, beta);
	expect(velocity(toTrain(l.back, beta), meet)).toBeCloseTo(1, 12);
	expect(velocity(toTrain(l.front, beta), meet)).toBeCloseTo(-1, 12);
	// The passenger (middle of the train, x′ = 0) meets the front flash first, in both frames.
	expect(l.passengerFront.ct).toBeLessThan(l.passengerBack.ct);
	const pf = toTrain(l.passengerFront, beta);
	const pb = toTrain(l.passengerBack, beta);
	expect(pf.x).toBeCloseTo(0, 9);
	expect(pb.x).toBeCloseTo(0, 9);
	// On the train each flash travelled half the train (100 m) at c: allowing for that,
	// the front struck 0.6 × 200 m of light-travel earlier than the back.
	expect(pf.ct - toTrain(l.front, beta).ct).toBeCloseTo(100, 9);
	expect(pb.ct - toTrain(l.back, beta).ct).toBeCloseTo(100, 9);
});

test('a muon at 0.99 c lives about 15.6 µs on Earth clocks and goes about 4.6 km, not 650 m', () => {
	const r = muonRange(0.99);
	expect(r.naive).toBeCloseTo(652, 0);
	expect(r.dilated / 1000).toBeCloseTo(4.62, 2);
	expect(r.lifetime * 1e6).toBeCloseTo(15.57, 2);
});

test('a flash from mid-carriage reaches both ends together on the train, the back end first on the platform', () => {
	const beta = 0.6;
	const half = TRAIN_LENGTH / 2 / gamma(beta); // the moving carriage, measured on the platform
	const hits = flashHits(half, beta);
	expect(hits.back).toBeLessThan(hits.front);
	// The light (at c) and each wall (at β) are at the same place at the hit.
	expect(hits.front).toBeCloseTo(half + beta * hits.front, 9);
	expect(-hits.back).toBeCloseTo(-half + beta * hits.back, 9);
	// In the train frame the two hits happen at the same time, 100 m from the lamp.
	const front = toTrain({ ct: hits.front, x: hits.front }, beta);
	const back = toTrain({ ct: hits.back, x: -hits.back }, beta);
	expect(front.ct).toBeCloseTo(back.ct, 9);
	expect(front.ct).toBeCloseTo(100, 9);
	expect(front.x - back.x).toBeCloseTo(TRAIN_LENGTH, 9);
	// At rest: half the carriage at c, both ways.
	expect(flashHits(100, 0)).toEqual({ front: 100, back: 100 });
});
