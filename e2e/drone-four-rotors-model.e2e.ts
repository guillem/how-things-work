// A palm-sized four-rotor drone (the Crazyflie 2.0's numbers): how its four speeds lift, tip and
// turn it, checked against its published figures and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	Drone,
	HOVER_TURNS,
	MAX_TURNS,
	RESET_AFTER,
	THRUST_TO_WEIGHT,
	angles,
	bodySpeed,
	fly,
	hover,
	kmh,
	lift,
	netTwist,
	tilt,
	turnRate,
	type Settings
} from '../src/routes/drone-four-rotors/model';

const all = (turns: number): Settings => ({
	mode: 'manual',
	rpm: [turns * 60, turns * 60, turns * 60, turns * 60]
});

test('it hovers with each rotor at about 240 turns a second (14,500 rpm), and flat out they lift 2.25 times its weight', () => {
	expect(Math.round(HOVER_TURNS)).toBe(241);
	expect(HOVER_TURNS * 60).toBeGreaterThan(14_400);
	expect(HOVER_TURNS * 60).toBeLessThan(14_550);
	expect(Math.round(MAX_TURNS)).toBe(362);
	const flatOut = fly(all(MAX_TURNS), 0.01, { height: 1 });
	expect(lift(flatOut.state)).toBeCloseTo(THRUST_TO_WEIGHT, 5);
});

test('on the pad it stays put until the rotors push harder than its weight: 241 turns a second is not quite enough, 242 lifts it', () => {
	expect(fly(all(241), 10, { height: 0 }).state.onGround).toBe(true);
	const up = fly(all(242), 10, { height: 0 }).state;
	expect(up.onGround).toBe(false);
	expect(up.pos[2]).toBeGreaterThan(1);
	expect(fly(all(0), 5, { height: 0 }).state.pos[2]).toBe(0);
});

test('at 250 turns a second, a twenty-eighth faster, it climbs at about 3 m/s; level all the way', () => {
	const d = fly(all(250), 10, { height: 0 });
	expect(d.state.vel[2]).toBeGreaterThan(2.5);
	expect(d.state.vel[2]).toBeLessThan(3.2);
	expect(tilt(d.state)).toBeLessThan(1e-6);
	// A little slower than hovering, it sinks.
	expect(fly(all(235), 2, { height: 3 }).state.vel[2]).toBeLessThan(-0.5);
});

test('forward stick: the back pair speeds up for a moment, it tips 10° in under a second and flies forward up to about 30 km/h', () => {
	const d = new Drone({ ...hover, forward: 1 });
	d.run(0.1);
	const [fl, fr, br, bl] = d.state.rpm;
	expect(br).toBeGreaterThan(fr);
	expect(bl).toBeGreaterThan(fl);
	d.run(1);
	expect(tilt(d.state)).toBeGreaterThan(9.5);
	expect(angles(d.state.q).pitch).toBeGreaterThan(0); // nose down
	// Once tipped the four speeds are even again, a little faster than hovering to keep it up.
	const t = d.state.rpm.map((r) => r / 60);
	expect(Math.max(...t) - Math.min(...t)).toBeLessThan(0.1);
	expect(t[0]).toBeGreaterThan(HOVER_TURNS + 1);
	// The back pair had to be about 5 turns a second faster than the front: 2 in a hundred.
	expect(Math.round(d.peaks.pitch)).toBe(5);
	d.run(20);
	expect(Math.round(kmh(bodySpeed(d.state).forward) / 5) * 5).toBe(30);
	expect(d.state.pos[2]).toBeCloseTo(1.5, 1);
	expect(Math.abs(bodySpeed(d.state).right)).toBeLessThan(1e-6);
});

test('sideways stick: the left pair speeds up, it tips to the right and slides right', () => {
	const d = new Drone({ ...hover, right: 1 });
	d.run(0.1);
	const [fl, fr, br, bl] = d.state.rpm;
	expect(fl).toBeGreaterThan(fr);
	expect(bl).toBeGreaterThan(br);
	d.run(5);
	expect(angles(d.state.q).roll).toBeCloseTo((10 * Math.PI) / 180, 3);
	expect(bodySpeed(d.state).right).toBeGreaterThan(4);
	expect(Math.abs(bodySpeed(d.state).forward)).toBeLessThan(1e-6);
});

test('a tilted drone keeps moving after the stick is let go, until it tips back and the air slows it', () => {
	const d = new Drone({ ...hover, forward: 1 });
	d.run(5);
	const fast = bodySpeed(d.state).forward;
	d.set(hover);
	d.run(5.1);
	// To tip back, the front pair speeds up.
	expect(d.state.rpm[0]).toBeGreaterThan(d.state.rpm[3]);
	d.run(15);
	expect(tilt(d.state)).toBeLessThan(0.01);
	expect(bodySpeed(d.state).forward).toBeLessThan(fast / 5);
	expect(bodySpeed(d.state).forward).toBeGreaterThan(0);
});

test('turn stick left: the clockwise pair speeds up and the other pair slows, the lift stays the same and it turns anticlockwise, a quarter turn a second', () => {
	const d = new Drone({ ...hover, turn: -1 });
	d.run(0.1);
	const [fl, fr, br, bl] = d.state.rpm; // fl and br spin clockwise
	expect(fl).toBeGreaterThan(fr);
	expect(br).toBeGreaterThan(bl);
	expect(fl).toBeGreaterThan(HOVER_TURNS * 60);
	expect(fr).toBeLessThan(HOVER_TURNS * 60);
	expect(lift(d.state)).toBeCloseTo(1, 3);
	expect(d.peaks.yaw).toBeGreaterThan(4);
	d.run(3);
	expect(turnRate(d.state)).toBeCloseTo(0.25, 2);
	expect(tilt(d.state)).toBeLessThan(1e-6);
	expect(d.state.pos[2]).toBeCloseTo(1.5, 3);
	expect(Math.hypot(d.state.vel[0], d.state.vel[1])).toBeLessThan(1e-9);
	// Turning right is the mirror image.
	expect(turnRate(fly({ ...hover, turn: 1 }, 3).state)).toBeCloseTo(-0.25, 2);
});

test('with the pairs spinning opposite ways the twists cancel; all four clockwise, the body whirls anticlockwise, dozens of turns a second within a second', () => {
	const steady = fly(hover, 5);
	expect(Math.abs(netTwist(steady.state))).toBeLessThan(1e-12);
	expect(Math.abs(turnRate(steady.state))).toBeLessThan(1e-9);
	const wrong = fly({ ...hover, sameWay: true }, 1);
	expect(netTwist(wrong.state, true)).toBeGreaterThan(0);
	expect(turnRate(wrong.state)).toBeGreaterThan(20);
	// It still holds its height: the twist turns it, it doesn't drop it.
	expect(wrong.state.pos[2]).toBeCloseTo(1.5, 2);
});

test('by hand, one turn a second too fast on the back pair tips it over within two seconds; after the crash it is put back on its feet', () => {
	const r = 241 * 60;
	const d = new Drone({ mode: 'manual', rpm: [r, r, r + 60, r + 60] });
	d.run(1);
	expect(tilt(d.state)).toBeGreaterThan(30);
	d.run(2);
	expect(d.state.crashedAt).not.toBeNull();
	const at = d.state.crashedAt ?? 0;
	d.run(at + RESET_AFTER + 0.01);
	expect(d.state.crashedAt).toBeNull();
	expect(tilt(d.state)).toBeLessThan(0.1);
	// Four equal speeds keep it level, though it slowly sinks at 241 (just short of hovering).
	const even = fly({ mode: 'manual', rpm: [r, r, r, r] }, 10);
	expect(tilt(even.state)).toBeLessThan(1e-9);
	expect(even.state.vel[2]).toBeLessThan(0);
	expect(even.state.vel[2]).toBeGreaterThan(-0.2);
});
