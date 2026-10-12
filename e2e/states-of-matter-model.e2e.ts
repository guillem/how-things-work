// Checks the phase diagrams (real data for water and carbon dioxide) and the box of simulated
// molecules behind the states-of-matter explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ATM,
	DENSITY,
	SUBSTANCES,
	meltingPressure,
	phaseAt,
	solidLimit,
	sublimationPressure,
	vaporLimit,
	vaporPressure
} from '../src/routes/states-of-matter/phase';
import { BoxRun, FPS, FREEZE_FRAMES, stats, type Model } from '../src/routes/states-of-matter/md';
import { MODEL_OF, setpointFor } from '../src/routes/states-of-matter/mapping';

const C = (celsius: number) => celsius + 273.15;

test.describe('phase diagrams', () => {
	test('water at 1 atm: ice at −10 °C, liquid at 25 °C, steam at 110 °C', () => {
		expect(phaseAt('water', C(-10), ATM)).toBe('solid');
		expect(phaseAt('water', C(25), ATM)).toBe('liquid');
		expect(phaseAt('water', C(110), ATM)).toBe('gas');
	});

	test('water melts at 0 °C and boils at 100 °C at 1 atm', () => {
		expect(solidLimit('water', ATM) - 273.15).toBeCloseTo(0, 2);
		expect(vaporLimit('water', ATM) - 273.15).toBeCloseTo(99.97, 1);
	});

	test('the curves match the reference check values', () => {
		// IAPWS-95: saturation pressure at 300 K is 3.536 81 kPa
		expect(vaporPressure('water', 300) / 1e3).toBeCloseTo(3.53681, 3);
		// IAPWS R14-08 check values: ice Ih melts at 138.268 MPa at 260 K; sublimation 8.947 35 Pa at 230 K
		expect(meltingPressure('water', 260) / 1e6).toBeCloseTo(138.268, 2);
		expect(sublimationPressure('water', 230)).toBeCloseTo(8.94735, 3);
		// Span & Wagner: CO₂ boils at 3.4851 MPa at 0 °C
		expect(vaporPressure('co2', C(0)) / 1e6).toBeCloseTo(3.4851, 3);
	});

	test('the lines meet at the triple point and the boiling line ends at the critical point', () => {
		for (const sub of ['water', 'co2'] as const) {
			const { triple, critical } = SUBSTANCES[sub];
			expect(vaporPressure(sub, triple.T) / triple.P).toBeCloseTo(1, 3);
			expect(sublimationPressure(sub, triple.T) / triple.P).toBeCloseTo(1, 3);
			expect(meltingPressure(sub, triple.T) / triple.P).toBeCloseTo(1, 6);
			expect(vaporPressure(sub, critical.T) / critical.P).toBeCloseTo(1, 6);
		}
	});

	test('dry ice sublimes at 1 atm, at −78.5 °C, and liquid CO₂ needs over 5 atm', () => {
		expect(phaseAt('co2', C(-100), ATM)).toBe('solid');
		expect(phaseAt('co2', C(-70), ATM)).toBe('gas');
		expect(vaporLimit('co2', ATM) - 273.15).toBeCloseTo(-78.46, 1);
		// no liquid at 1 atm at any temperature
		for (let c = -120; c <= 60; c += 1) expect(phaseAt('co2', C(c), ATM)).not.toBe('liquid');
		expect(SUBSTANCES.co2.triple.P / ATM).toBeCloseTo(5.11, 2);
		expect(phaseAt('co2', C(-20), 5e6)).toBe('liquid');
	});

	test('above the critical point there is no boiling, only a supercritical fluid', () => {
		expect(phaseAt('co2', C(50), 10e6)).toBe('supercritical');
		expect(phaseAt('water', C(400), 25e6)).toBe('supercritical');
		expect(phaseAt('water', C(400), 10e6)).toBe('gas');
	});

	test("squeezing ice lowers water's melting point; squeezing dry ice raises CO₂'s", () => {
		// The density anomaly (ice lighter than water) and the backward-leaning melting line go
		// together (Clausius–Clapeyron).
		expect(DENSITY.ice).toBeLessThan(DENSITY.water);
		expect(solidLimit('water', 100e6)).toBeLessThan(solidLimit('water', ATM));
		expect(solidLimit('water', 100e6) - 273.15).toBeCloseTo(-8.9, 1);
		expect(solidLimit('co2', 100e6)).toBeGreaterThan(solidLimit('co2', 1e6));
	});

	test('water boils at about 72 °C at the top of Mount Everest (33.7 kPa)', () => {
		expect(vaporLimit('water', 33.7e3) - 273.15).toBeCloseTo(71.8, 0);
	});
});

const SEEDS = [1, 2, 3, 4, 5];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Averages of the measured quantities over frames from..to (seconds), every quarter second. */
function measure(run: BoxRun, from: number, to: number) {
	let order = 0;
	let free = 0;
	let area = 0;
	let n = 0;
	for (let f = from * FPS; f <= to * FPS; f += FPS / 4) {
		const s = stats(run, run.frame(f));
		order += s.order;
		free += s.free;
		area += s.areaPerMolecule;
		n++;
	}
	return { order: order / n, free: free / n, area: area / n };
}

test.describe('the box of molecules', () => {
	test('water in the box, as the phase diagram says: ordered ice, a denser liquid, a spread-out gas', () => {
		const at = (celsius: number) => {
			const sp = setpointFor('water', C(celsius), ATM);
			return measure(new BoxRun('mb', sp.phase === 'solid' ? 'solid' : 'liquid', sp), 6, 10);
		};
		const ice = at(-10);
		const liquid = at(25);
		const gas = at(110);
		expect(ice.order).toBeGreaterThan(0.5);
		expect(liquid.order).toBeLessThan(0.15);
		expect(gas.order).toBeLessThan(0.1);
		// ice takes more room than the liquid (the density anomaly), the gas far more. One run of 80
		// molecules is too noisy for this (and chaotic, so it differs between machines): average
		// over several starts.
		const areaAt = (celsius: number, seed: number) => {
			const sp = setpointFor('water', C(celsius), ATM);
			const start = sp.phase === 'solid' ? 'solid' : 'liquid';
			return measure(new BoxRun('mb', start, sp, seed), 6, 10).area;
		};
		expect(mean(SEEDS.map((s) => areaAt(-10, s)))).toBeGreaterThan(
			mean(SEEDS.map((s) => areaAt(25, s))) * 1.04
		);
		expect(gas.free).toBeGreaterThan(0.4);
		expect(liquid.free).toBeLessThan(0.15);
	});

	test('round molecules (CO₂): ordered when solid, disordered when liquid, flying apart as a gas', () => {
		const at = (celsius: number, P: number, start: 'solid' | 'liquid' | 'gas') =>
			measure(new BoxRun('lj', start, setpointFor('co2', C(celsius), P)), 6, 12);
		const solid = at(-100, ATM, 'solid');
		const liquid = at(-20, 5e6, 'solid'); // melts from the lattice
		const gas = at(20, ATM, 'solid'); // sublimes from the lattice
		expect(solid.order).toBeGreaterThan(0.65);
		expect(liquid.order).toBeLessThan(0.5);
		expect(liquid.free).toBeLessThan(0.1);
		expect(gas.order).toBeLessThan(0.1);
		expect(gas.free).toBeGreaterThan(0.35);
	});

	test('cooling the liquid freezes it, and heating the solid melts it', () => {
		const liquid = setpointFor('co2', C(-20), 5e6);
		const solid = setpointFor('co2', C(-80), 5e6);
		const run = new BoxRun('lj', 'liquid', liquid);
		expect(measure(run, 1, 3).order).toBeLessThan(0.5);
		run.frame(3 * FPS);
		run.set(solid);
		expect(measure(run, 12, 15).order).toBeGreaterThan(0.65);
		run.set(liquid);
		expect(measure(run, 24, 27).order).toBeLessThan(0.5);
	});

	test('freezing water takes the lattice shortcut, and the ice takes more room than the liquid', () => {
		const model: Model = MODEL_OF.water;
		const t = 3 * FPS;
		const freeze = (seed: number) => {
			const run = new BoxRun(model, 'liquid', setpointFor('water', C(20), ATM), seed);
			const before = measure(run, 1, 3);
			run.frame(t);
			run.set(setpointFor('water', C(-10), ATM));
			expect(run.frame(t + 1).freezing).toBeGreaterThan(0);
			const after = measure(run, (t + FREEZE_FRAMES) / FPS + 2, (t + FREEZE_FRAMES) / FPS + 5);
			expect(before.order).toBeLessThan(0.15);
			expect(after.order).toBeGreaterThan(0.5);
			return { before: before.area, after: after.area };
		};
		// Averaged over several starts, as in the test above: one run is too noisy for the 4%.
		const runs = SEEDS.map(freeze);
		expect(mean(runs.map((r) => r.after))).toBeGreaterThan(mean(runs.map((r) => r.before)) * 1.04);
	});

	test('the box changes smoothly across the dashed line above the critical point, where no phase line is', () => {
		for (const sub of ['co2', 'water'] as const) {
			const { critical } = SUBSTANCES[sub];
			const P = critical.P * 1.4;
			const below = setpointFor(sub, critical.T - 0.01, P);
			const above = setpointFor(sub, critical.T + 0.01, P);
			expect(below.phase).toBe('liquid');
			expect(above.phase).toBe('supercritical');
			expect(Math.abs(above.T - below.T)).toBeLessThan(0.05);
			expect(Math.abs(above.P - below.P)).toBeLessThan(0.05);
		}
	});

	test('squeezing CO₂ gas at 0 °C past 34.4 atm condenses it', () => {
		const run = new BoxRun('lj', 'gas', setpointFor('co2', C(0), 20 * ATM));
		expect(measure(run, 1, 3).free).toBeGreaterThan(0.35);
		run.frame(3 * FPS);
		run.set(setpointFor('co2', C(0), 40 * ATM));
		expect(measure(run, 12, 15).free).toBeLessThan(0.1);
	});

	test('the same history gives the same frames', () => {
		const sp = setpointFor('co2', C(-20), 5e6);
		const a = new BoxRun('lj', 'liquid', sp).frame(120);
		const b = new BoxRun('lj', 'liquid', sp).frame(120);
		expect(Array.from(a.x)).toEqual(Array.from(b.x));
	});
});
