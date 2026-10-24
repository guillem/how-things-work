// Wi-Fi in a house: free-space fading, wall losses from NIST IR 6055, the 802.11 ladder of ways
// of sending, two networks taking turns.
import { expect, test } from '@playwright/test';
import {
	BED_SPOT,
	DEFAULT_SETUP,
	freeSpaceLossDb,
	ladder,
	link,
	linkRung,
	materialLossDb,
	waterLossDbPerCm,
	waterPermittivity,
	type Setup
} from '../src/routes/wifi-and-walls/model';

const spots = Array.from({ length: 101 }, (_, i) => i);
const walk = (s: Setup) => spots.map((spot) => link(spot, s));

test('free space: 40 dB lost in the first metre at 2.4 GHz, 6 dB more each time the distance doubles', () => {
	expect(freeSpaceLossDb(1, '2.4')).toBeCloseTo(40.2, 1);
	expect(freeSpaceLossDb(1, '5')).toBeCloseTo(46.8, 1);
	expect(freeSpaceLossDb(8, '2.4') - freeSpaceLossDb(4, '2.4')).toBeCloseTo(6.02, 2);
});

test('the ladder: 13 to 130 Mbit/s at 2.4 GHz, 58.5 to 780 at 5 GHz, each rung needing a stronger signal', () => {
	for (const band of ['2.4', '5'] as const) {
		const rungs = ladder(band);
		for (let i = 1; i < rungs.length; i++) {
			expect(rungs[i].mbit).toBeGreaterThan(rungs[i - 1].mbit);
			expect(rungs[i].minDbm).toBeGreaterThan(rungs[i - 1].minDbm);
		}
	}
	// 802.11n, 20 MHz, two streams: MCS 8–15. 802.11ac, 80 MHz, two streams: MCS 0–9.
	expect(ladder('2.4').map((r) => r.mbit)).toEqual([13, 26, 39, 52, 78, 104, 117, 130]);
	expect(ladder('5')[0].mbit).toBe(58.5);
	expect(ladder('5').at(-1)?.mbit).toBe(780);
	// The standard's sensitivities: −82 dBm for the slowest way at 20 MHz, −51 dBm for the fastest at 80.
	expect(ladder('2.4')[0].minDbm).toBe(-82);
	expect(ladder('5').at(-1)?.minDbm).toBe(-51);
	expect(linkRung(-90, '2.4')).toBeNull();
});

test('walls: brick and concrete cost more at 5 GHz than at 2.4; glass costs little; water swallows the signal', () => {
	for (const m of ['brick', 'concrete'] as const)
		expect(materialLossDb(m, '5')).toBeGreaterThan(materialLossDb(m, '2.4'));
	expect(materialLossDb('concrete', '2.4')).toBeGreaterThan(materialLossDb('brick', '2.4'));
	expect(materialLossDb('glass', '2.4')).toBeLessThan(2);
	// Water at 25 °C, 2.45 GHz (the microwave oven's frequency): ε ≈ 77 − 9j, and the power falls
	// to a third (1/e) within about 2 cm.
	const w = waterPermittivity(2.45);
	expect(w.real).toBeGreaterThan(76);
	expect(w.real).toBeLessThan(79);
	expect(w.imag).toBeGreaterThan(8);
	expect(w.imag).toBeLessThan(11);
	const depthCm = 10 / Math.LN10 / waterLossDbPerCm(2.45);
	expect(depthCm).toBeGreaterThan(1);
	expect(depthCm).toBeLessThan(3);
	expect(materialLossDb('water', '2.4')).toBeGreaterThan(50);
});

test('an empty house: the signal fades all the way, but the laptop has full speed everywhere', () => {
	const open = walk({ ...DEFAULT_SETUP, walls: false });
	expect(open.every((l) => l.mbit === 130)).toBe(true);
	expect(open[100].dbm).toBeLessThan(open[0].dbm - 15);
});

test('with the walls: the speed falls a rung at a time, and never to nothing at 2.4 GHz', () => {
	const w = walk(DEFAULT_SETUP);
	expect(w[0].mbit).toBe(130);
	expect(w.every((l) => l.mbit > 0)).toBe(true);
	expect(w[100].mbit).toBe(39);
	expect(w[100].crossed).toHaveLength(3);
	// The speeds seen along the walk: several different rungs, not just "full" and "off".
	expect(new Set(w.map((l) => l.mbit)).size).toBeGreaterThanOrEqual(3);
});

test('5 GHz: six times faster near the router, but no link at all in the back bedroom', () => {
	const fast = walk({ ...DEFAULT_SETUP, band: '5' });
	expect(fast[0].mbit).toBe(780);
	expect(fast[0].mbit / walk(DEFAULT_SETUP)[0].mbit).toBe(6);
	expect(fast[100].mbit).toBe(0);
	expect(fast[45].mbit).toBeGreaterThan(130);
});

test('on the bed: glass barely matters, brick and concrete slow it, a fish tank or a fridge stops it', () => {
	const at = (obstacle: Setup['obstacle']) => link(BED_SPOT, { ...DEFAULT_SETUP, obstacle }).mbit;
	expect(at('none')).toBe(130);
	expect(at('glass')).toBe(117);
	expect(at('brick')).toBe(52);
	expect(at('concrete')).toBe(13);
	expect(at('tank')).toBe(0);
	expect(at('fridge')).toBe(0);
});

test('next door on the same channel: the two networks take turns, and the laptop gets half', () => {
	const kitchen = 45;
	const alone = link(kitchen, DEFAULT_SETUP);
	const same = link(kitchen, { ...DEFAULT_SETUP, neighbour: 'same' });
	const other = link(kitchen, { ...DEFAULT_SETUP, neighbour: 'other' });
	expect(same.turns.heard).toBe(true);
	expect(same.yours).toBe(alone.yours / 2);
	expect(other.yours).toBe(alone.yours);
	// The link itself is just as fast: only the time on the air is shared.
	expect(same.mbit).toBe(alone.mbit);
});
