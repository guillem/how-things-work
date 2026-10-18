// Checks the diffusion, osmosis and transport models against what is measured or follows from
// physical law: water's viscosity against the tabulated values, Stokes–Einstein's "faster when
// warmer", the random walk's √t spreading (mean square displacement 4Dt in two dimensions), a
// profile that flattens, net flow as the difference of two counts, van 't Hoff's osmotic
// pressure balancing a column of water, a piston that stops and reverses the flow, red blood
// cells bursting where the clinical osmotic-fragility test finds them, a walled cell that firms
// up in pure water, and a pump that holds a gradient only while it has ATP. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ATP_ENERGY,
	RHO_G,
	Tank,
	Walkers,
	dyeBox,
	dyeD,
	gradientWork,
	potatoCell,
	profile,
	pumpBox,
	rbcBursts,
	rbcVolume,
	rmsFromCorner,
	rmsTheory,
	saltOsm,
	spreadTime,
	sugarOsm,
	vantHoff,
	waterColumn,
	waterViscosity
} from '../src/routes/diffusion-osmosis/model';

test("water's viscosity matches the tabulated values from 0 to 100 °C", () => {
	// CRC Handbook of Chemistry and Physics, viscosity of liquid water, mPa·s
	const table: [number, number][] = [
		[0, 1.792],
		[20, 1.002],
		[40, 0.653],
		[60, 0.467],
		[80, 0.355],
		[100, 0.282]
	];
	for (const [c, mpas] of table)
		expect(Math.abs(waterViscosity(c) * 1000 - mpas) / mpas).toBeLessThan(0.03);
});

test('dye diffuses faster when warmer: over three times faster at 80 °C than at 20 °C', () => {
	expect(dyeD(25)).toBeCloseTo(425, 0); // fluorescein, measured at 25 °C
	const ratio = dyeD(80) / dyeD(20);
	// T/η from the tabulated viscosities: (353.15/293.15)·(1.002/0.355) = 3.40
	expect(ratio).toBeGreaterThan(3.2);
	expect(ratio).toBeLessThan(3.6);
});

test('a random walk spreads as √t: the mean square displacement is 4Dt in two dimensions', () => {
	const D = 400;
	const s = new Walkers({ n: 4000, w: 1e6, h: 1e6, D, seed: 11, start: () => [5e5, 5e5] });
	for (const t of [1, 4, 16]) {
		const k = s.at(t * s.fps);
		let sum = 0;
		for (let i = 0; i < s.n; i++) sum += (s.xs[k][i] - 5e5) ** 2 + (s.ys[k][i] - 5e5) ** 2;
		expect(Math.abs(sum / s.n / (4 * D * t) - 1)).toBeLessThan(0.05);
	}
});

test('dye from the corner spreads as √(4Dt), then fills the box evenly', () => {
	const s = dyeBox(20);
	const k = s.at(20); // 2 s: the far walls are still out of reach
	expect(Math.abs(rmsFromCorner(s, k) / rmsTheory(s.D, 2) - 1)).toBeLessThan(0.08);
	const early = profile(s, s.at(30), 10);
	expect(early[0]).toBeGreaterThan(0.2);
	expect(early[9]).toBeLessThan(0.02);
	const late = profile(s, s.at(1200), 10);
	for (const share of late) expect(Math.abs(share - 0.1)).toBeLessThan(0.05);
});

test('the net flow across a line is just the difference of two counts', () => {
	const s = dyeBox(20, 7, true);
	const k = s.at(400);
	expect(s.toRight[k]).toBeGreaterThan(100);
	expect(s.toLeft[k]).toBeGreaterThan(50);
	expect(s.toRight[k] - s.toLeft[k]).toBe(s.right[k] - s.right[0]);
});

test('spreading time grows as the square of the distance: 10 µm in a blink, 1 m in decades', () => {
	const D = dyeD(20);
	expect(spreadTime(10, D)).toBeLessThan(0.2);
	expect(spreadTime(1000, D) / 60).toBeGreaterThan(15); // over a quarter of an hour for 1 mm
	expect(spreadTime(1e6, D) / (365.25 * 86400)).toBeGreaterThan(30);
});

test("van 't Hoff: 1 mmol of sugar per litre pushes with 2.4 kPa, as hard as 25 cm of water", () => {
	expect(vantHoff(1) / 1000).toBeCloseTo(2.44, 2);
	expect(waterColumn(vantHoff(1)) * 100).toBeCloseTo(24.9, 0);
	// a sweet drink's 0.3 mol/L would hold up some 75 m of water
	expect(waterColumn(vantHoff(300))).toBeGreaterThan(70);
});

test('water rises on the sugary side until the extra height pushes back as hard as the sugar', () => {
	const s = new Tank(1, 0).settled();
	expect(s.hL).toBeGreaterThan(s.hR);
	expect(RHO_G * (s.hL - s.hR)).toBeCloseTo(vantHoff(s.cL) - vantHoff(s.cR), 0);
	// sugar on both sides: water goes to the side with more, and equal amounts move nothing
	const both = new Tank(1.5, 0.5).settled();
	expect(both.hL).toBeGreaterThan(both.hR);
	const equal = new Tank(1, 1).settled();
	expect(Math.abs(equal.hL - equal.hR)).toBeLessThan(1e-6);
});

test('pressing on the sugary side as hard as the sugar pushes stops the flow; harder reverses it', () => {
	const press = vantHoff(1);
	const stop = new Tank(1, 0, press);
	expect(Math.abs(stop.at(0).flow)).toBeLessThan(1e-12);
	expect(Math.abs(stop.at(10).hL - 0.3)).toBeLessThan(1e-9);
	const reverse = new Tank(1, 0, 2 * press);
	expect(reverse.at(5).hL).toBeLessThan(0.3); // reverse osmosis: water leaves the sugar
});

test('red blood cells hold in 0.9 % salt, shrink in 3 %, and burst near 0.4 %', () => {
	expect(saltOsm(0.9)).toBeGreaterThan(280);
	expect(saltOsm(0.9)).toBeLessThan(300);
	expect(Math.abs(rbcVolume(saltOsm(0.9)) - 1)).toBeLessThan(0.02);
	expect(rbcVolume(saltOsm(3))).toBeLessThan(0.7);
	expect(rbcBursts(0)).toBe(true);
	// the osmotic-fragility test: cells start to burst below about 0.45 %, all have by 0.30–0.35 %
	let onset = 0;
	for (let p = 100; p > 0; p--)
		if (rbcBursts(saltOsm(p / 100))) {
			onset = p / 100;
			break;
		}
	expect(onset).toBeGreaterThan(0.35);
	expect(onset).toBeLessThanOrEqual(0.45);
});

test('a potato cell firms up in pure water instead of bursting, and loses water in strong sugar', () => {
	const water = potatoCell(0);
	expect(water.v).toBeGreaterThan(1.05);
	expect(water.v).toBeLessThan(1.2);
	expect(water.turgor).toBeGreaterThan(0.5); // MPa: firm
	// no change somewhere in the classroom's range, about 0.2–0.4 mol/L sucrose
	expect(potatoCell(sugarOsm(0.2)).v).toBeGreaterThan(1);
	expect(potatoCell(sugarOsm(0.4)).v).toBeLessThan(1);
	const strong = potatoCell(sugarOsm(1));
	expect(strong.v).toBeLessThan(0.8);
	expect(strong.turgor).toBe(0); // plasmolysed: the protoplast pulls away from the wall
});

test('a pump builds a gradient while it has ATP; without ATP the gradient leaks away', () => {
	const s = pumpBox();
	const n = s.n;
	const k = s.at(300);
	const inside = s.right[k];
	expect(inside / (n - inside)).toBeGreaterThan(3);
	expect(s.atp[k]).toBeLessThan(s.atp[0]);
	const off = pumpBox();
	off.pumpOn = false;
	const k2 = off.at(300);
	expect(Math.abs(off.right[k2] - n / 2)).toBeLessThan(15);
	// once the store is empty, the leak evens things out again
	const end = s.at(3000);
	expect(s.atp[end]).toBe(0);
	expect(Math.abs(s.right[end] - n / 2)).toBeLessThan(15);
});

test('the least work to hold a ten-fold gradient is a small part of one ATP', () => {
	const w = gradientWork(1, 10);
	expect(w / 1000).toBeCloseTo(5.9, 1);
	expect(w).toBeLessThan(ATP_ENERGY / 5);
});
