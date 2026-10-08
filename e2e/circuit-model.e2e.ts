// Checks the circuit solver behind the electric-circuits explainer. Runs in Node.
// The battery has a small internal resistance, so readings are a fraction of a percent below
// the ideal values: compare to 2 decimals for amperes and 1 for volts, as the page shows them.
import { expect, test } from '@playwright/test';
import {
	AMMETERS,
	OHM,
	PARALLEL,
	PRESETS,
	SERIES,
	SIMPLE,
	SWITCHES,
	VOLTMETERS,
	driftSpeed,
	parseBoard,
	partAt,
	peg,
	place,
	serializeBoard,
	solve,
	update,
	type Board
} from '../src/routes/electric-circuits/circuit';

const idx = (b: Board, kind: string) =>
	b.parts.map((p, i) => (p.kind === kind ? i : -1)).filter((i) => i >= 0);

test('a single loop: Ohm’s law, and the same current everywhere', () => {
	const s = solve(SIMPLE);
	for (const i of SIMPLE.parts.keys()) expect(Math.abs(s.current[i])).toBeCloseTo(0.5, 2); // 6 V / 12 Ω
	const a = solve(AMMETERS);
	for (const i of idx(AMMETERS, 'ammeter')) expect(Math.abs(a.current[i])).toBeCloseTo(0.5, 2);
});

test('opening the switch stops the current everywhere', () => {
	const sw = idx(SIMPLE, 'switch')[0];
	const s = solve(update(SIMPLE, sw, { closed: false }));
	expect(s.current.every((i) => i === 0)).toBe(true);
	// The battery still has its 6 V, now all across the open switch.
	expect(Math.abs(s.voltage[sw])).toBeCloseTo(6, 1);
});

test('voltmeters read the battery and the bulb, and take no current', () => {
	const s = solve(VOLTMETERS);
	const [vb, vl] = idx(VOLTMETERS, 'voltmeter');
	expect(Math.abs(s.voltage[vb])).toBeCloseTo(6, 1);
	expect(Math.abs(s.voltage[vl])).toBeCloseTo(6, 1);
	expect(s.current[vb]).toBe(0);
});

test('Ohm’s law for other voltages and resistances', () => {
	const r = idx(OHM, 'resistor')[0];
	const bat = idx(OHM, 'battery')[0];
	for (const [V, R] of [
		[1.5, 3],
		[9, 18],
		[12, 4]
	]) {
		const b = update(update(OHM, r, { value: R }), bat, { value: V });
		expect(Math.abs(solve(b).current[r])).toBeCloseTo(V / R, 1);
	}
});

test('series: the voltage is shared, the current is the same and smaller', () => {
	const s = solve(SERIES);
	const bulbs = idx(SERIES, 'bulb');
	for (const i of bulbs) {
		expect(Math.abs(s.voltage[i])).toBeCloseTo(3, 1);
		expect(Math.abs(s.current[i])).toBeCloseTo(0.25, 2);
		expect(s.power[i]).toBeCloseTo(0.75, 2); // a quarter of a lone bulb's 3 W
	}
});

test('parallel: each bulb gets the full voltage, the battery supplies the sum', () => {
	const s = solve(PARALLEL);
	for (const i of idx(PARALLEL, 'bulb')) {
		expect(Math.abs(s.voltage[i])).toBeCloseTo(6, 1);
		expect(Math.abs(s.current[i])).toBeCloseTo(0.5, 2);
	}
	expect(Math.abs(s.current[idx(PARALLEL, 'battery')[0]])).toBeCloseTo(1, 2);
});

test('switches on parallel branches act independently', () => {
	const [s1, s2] = idx(SWITCHES, 'switch');
	const [l1, l2] = idx(SWITCHES, 'bulb');
	const s = solve(update(SWITCHES, s1, { closed: false }));
	expect(s.current[l1]).toBe(0);
	expect(Math.abs(s.current[l2])).toBeCloseTo(0.5, 2);
	const off = solve(update(update(SWITCHES, s1, { closed: false }), s2, { closed: false }));
	expect(off.current.every((i) => i === 0)).toBe(true);
});

test('Kirchhoff’s current law holds at every peg', () => {
	for (const b of Object.values(PRESETS)) {
		const s = solve(b);
		const net = new Array(b.cols * b.rows).fill(0);
		b.parts.forEach((p, i) => {
			net[p.a] -= s.current[i];
			net[p.b] += s.current[i];
		});
		for (const x of net) expect(Math.abs(x)).toBeLessThan(1e-6);
	}
});

test('energy: the battery delivers what the bulbs take', () => {
	for (const b of [SIMPLE, SERIES, PARALLEL]) {
		const s = solve(b);
		const total = s.power.reduce((a, p) => a + p, 0);
		expect(Math.abs(total)).toBeLessThan(1e-3);
	}
});

test('a wire straight across the battery is a short circuit', () => {
	const b = place(SIMPLE, { kind: 'wire', a: peg(SIMPLE, 0, 1), b: peg(SIMPLE, 1, 1) });
	expect(solve(b).short).toBe(false); // a dangling wire changes nothing
	const shorted = place(
		place(place(b, { kind: 'wire', a: peg(b, 0, 1), b: peg(b, 0, 2) }), {
			kind: 'wire',
			a: peg(b, 0, 2),
			b: peg(b, 1, 2)
		}),
		{ kind: 'wire', a: peg(b, 0, 2), b: peg(b, 1, 2) }
	);
	const s = solve(shorted);
	expect(s.short).toBe(true);
	// Almost no current is left for the bulb.
	expect(Math.abs(s.current[partAt(shorted, peg(b, 5, 1), peg(b, 5, 2))])).toBeLessThan(0.01);
});

test('an unconnected part sits at 0 V and nothing breaks', () => {
	const b = place(SIMPLE, { kind: 'bulb', a: peg(SIMPLE, 3, 4), b: peg(SIMPLE, 4, 4) });
	const s = solve(b);
	expect(s.current[b.parts.length - 1]).toBe(0);
	expect(s.v.every(Number.isFinite)).toBe(true);
});

test('electrons drift at a fraction of a millimetre per second', () => {
	const v = driftSpeed(0.5) * 1000; // mm/s in a 1 mm² copper wire
	expect(v).toBeGreaterThan(0.03);
	expect(v).toBeLessThan(0.05);
});

test('the text form round-trips', () => {
	for (const b of Object.values(PRESETS)) {
		const s = serializeBoard(b);
		expect(serializeBoard(parseBoard(s)!)).toBe(s);
	}
	expect(parseBoard('junk')).toBeNull();
});
