// Salty water's freezing point, ice melted by salt on a cold path, and a salt-and-ice bowl that
// freezes cream.
import { expect, test } from '@playwright/test';
import {
	EUTECTIC,
	SPOON,
	bath,
	creamFrozen,
	freezingPoint,
	iceMeltedBy,
	minutesToFreeze,
	saltinessAt,
	simulateBath
} from '../src/routes/salt-and-ice/model';

test('salty water freezes colder the saltier it is, down to −21.1 °C at 23.3 % salt', () => {
	expect(freezingPoint(0)).toBe(0);
	// Sea water, about 3.5 % salt, freezes near −2 °C.
	expect(freezingPoint(3.5)).toBeCloseTo(-2.1, 1);
	expect(freezingPoint(10)).toBeCloseTo(-6.56, 2);
	expect(EUTECTIC).toEqual({ salt: 23.3, freezes: -21.1 });
	// Extra salt does not make it freeze any colder.
	expect(freezingPoint(26)).toBe(EUTECTIC.freezes);
	// The curve and its inverse agree.
	for (const temp of [-1, -5, -12, -20])
		expect(freezingPoint(saltinessAt(temp)!)).toBeCloseTo(temp, 6);
	expect(saltinessAt(-22)).toBeNull();
});

test('a pound of salt melts about 46 pounds of ice at −1 °C but only about 5 at −12 °C (MnDOT)', () => {
	// MnDOT's melting table: 46 lb of ice per lb of salt at 30 °F, 4.9 lb at 10 °F.
	expect(iceMeltedBy(1, -1.1)).toBeGreaterThan(46 * 0.85);
	expect(iceMeltedBy(1, -1.1)).toBeLessThan(46 * 1.2);
	expect(iceMeltedBy(1, -12.2)).toBeGreaterThan(4.9 * 0.9);
	expect(iceMeltedBy(1, -12.2)).toBeLessThan(4.9 * 1.1);
});

test('salt melts less ice the colder it is, and none below −21 °C', () => {
	const at = [-2, -5, -10, -15, -20, -21].map((t) => iceMeltedBy(SPOON, t));
	for (let i = 1; i < at.length; i++) expect(at[i]).toBeLessThan(at[i - 1]);
	expect(iceMeltedBy(SPOON, -21.2)).toBe(0);
	expect(iceMeltedBy(10 * SPOON, -25)).toBe(0);
	// On a path with only so much ice, extra salt stops helping once it has all melted.
	expect(iceMeltedBy(4 * SPOON, -5, 500)).toBe(500);
	expect(iceMeltedBy(8 * SPOON, -5, 500)).toBe(500);
});

test('plain ice stays at 0 °C; salt makes a bowl of ice colder, but never below −21.1 °C', () => {
	expect(bath(500, 0).temp).toBe(0);
	const temps = [5, 10, 20].map((s) => bath(500, s).temp);
	expect(temps[0]).toBeLessThan(0);
	expect(temps[1]).toBeLessThan(temps[0]);
	expect(temps[2]).toBeLessThan(temps[1]);
	for (const s of [SPOON * 2, SPOON * 8, 400]) expect(bath(500, s).temp).toBeCloseTo(-21.1, 6);
	// The cold comes from melting: the bowl melts some of its own ice to cool down.
	expect(bath(500, SPOON).melted).toBeGreaterThan(0);
});

test('the heat the cooling takes out of the bowl is what melting that ice takes', () => {
	const b = bath(500, 2 * SPOON);
	const meltHeat = 334 * b.melted;
	// Cooling about 500 g of ice by 21 °C takes roughly 2.1 J per gram per degree.
	const coolHeat = 2.1 * 500 * 21.1;
	expect(meltHeat / coolHeat).toBeGreaterThan(1);
	expect(meltHeat / coolHeat).toBeLessThan(1.4);
});

test('the cream starts to freeze below about −2 °C, and is half frozen at −4 °C', () => {
	expect(creamFrozen(0)).toBe(0);
	expect(creamFrozen(-2)).toBe(0);
	expect(creamFrozen(-4)).toBeCloseTo(0.5, 6);
	expect(creamFrozen(-16)).toBeGreaterThan(0.7);
});

test('the recipe freezes the cream in about five minutes; plain ice never does', () => {
	// Four cups of ice (about 500 g) and half a cup of salt (8 tablespoons).
	const recipe = minutesToFreeze(500, 8 * SPOON)!;
	expect(recipe).toBeGreaterThan(4);
	expect(recipe).toBeLessThan(6);
	expect(minutesToFreeze(500, 0)).toBeNull();
	const plain = simulateBath(500, 0, 30);
	expect(plain[plain.length - 1].cream).toBeGreaterThan(-0.01);
	expect(plain[plain.length - 1].bath).toBe(0);
	// One spoonful works too, but slower, and its bowl warms up as the ice melts.
	const one = minutesToFreeze(500, SPOON)!;
	expect(one).toBeGreaterThan(recipe * 1.5);
	const run = simulateBath(500, SPOON, 10);
	expect(run[run.length - 1].bath).toBeGreaterThan(run[0].bath + 5);
});

test('the heat the cream loses goes into melting ice', () => {
	const run = simulateBath(500, 8 * SPOON, 10);
	const end = run[run.length - 1];
	expect(end.fromCream).toBeGreaterThan(0);
	// The melted ice took at least the cream's heat (the kitchen adds the rest).
	expect(334 * (end.melted - run[0].melted)).toBeGreaterThan(end.fromCream);
});
