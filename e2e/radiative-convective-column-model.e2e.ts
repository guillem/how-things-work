// Checks the radiative-convective column against the textbook results of grey radiative transfer
// (Pierrehumbert, Principles of Planetary Climate, ch. 4): Earth's absorbed sunlight gives an
// emission temperature of about 255 K; pure grey radiative equilibrium follows the analytic
// σT⁴ = (OLR/2)(1 + τ), with a skin temperature 2^(−1/4) of the emission temperature, the
// emission level (τ = 1) at exactly that temperature and a surface warmer than the air above it;
// energy is conserved; convection removes the jump and the unstable lower layers. Then the page's
// claims: more absorber raises the emission level, the tropopause and the surface temperature,
// even when the band is already saturated at the surface; in a fully grey gas the stratosphere
// does not cool, with the window it does; a column given more absorber first sends out less
// infrared and then warms until it is back in balance. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DRY_LAPSE,
	LAPSE_REF,
	SIGMA,
	TAU_REF,
	WINDOW,
	absorbedSolar,
	diagnose,
	emissionTemp,
	equilibrium,
	evolve,
	instantOLR,
	makeGrid,
	temperatureAt,
	type Settings
} from '../src/routes/radiative-convective-column/model';

const grey = (tau: number, convection = false): Settings => ({
	tau,
	window: 0,
	lapse: LAPSE_REF,
	convection
});
const earth = (tau = TAU_REF, extra: Partial<Settings> = {}): Settings => ({
	tau,
	window: WINDOW,
	lapse: LAPSE_REF,
	convection: true,
	...extra
});

test('Earth absorbs about 238 W/m² of sunlight, an emission temperature of about 255 K', () => {
	// S₀ = 1361 W/m², albedo 0.3: (1 − 0.3) × 1361 / 4
	expect(absorbedSolar()).toBeCloseTo(238.2, 1);
	expect(emissionTemp(absorbedSolar())).toBeCloseTo(254.6, 1);
});

test('grey radiative equilibrium follows σT⁴ = (OLR/2)(1 + τ)', () => {
	const grid = makeGrid(2);
	for (const tau of [1, 4, 10]) {
		const c = equilibrium(grey(tau), grid);
		const d = diagnose(c);
		c.T.forEach((T, k) => {
			const tauHere = tau * (grid.p[k] / 1000) ** 2;
			// within 0.2%: the layers are isothermal, a first-order approximation of the profile
			expect(Math.abs((SIGMA * T ** 4) / ((d.olr / 2) * (1 + tauHere)) - 1)).toBeLessThan(0.002);
		});
		// the surface: σTs⁴ = (OLR/2)(2 + τ∞)
		expect(Math.abs((SIGMA * c.ts ** 4) / ((d.olr / 2) * (2 + tau)) - 1)).toBeLessThan(0.002);
	}
});

test('the skin temperature is 2^(−1/4) of the emission temperature, whatever τ', () => {
	const skin = 2 ** -0.25 * emissionTemp(absorbedSolar());
	expect(skin).toBeCloseTo(214.1, 1);
	for (const tau of [0.5, 3.5, 12]) {
		const c = equilibrium(grey(tau));
		expect(c.T[c.T.length - 1]).toBeCloseTo(skin, 1);
	}
});

test('in grey radiative equilibrium the emission level (τ = 1) is at the emission temperature', () => {
	for (const tau of [2, 6]) {
		const d = diagnose(equilibrium(grey(tau), makeGrid(2)));
		expect(d.emissionT!).toBeCloseTo(emissionTemp(absorbedSolar()), 0);
	}
});

test('energy is conserved: the infrared leaving equals the sunlight absorbed', () => {
	for (const convection of [false, true])
		for (const window of [0, WINDOW, 0.3])
			for (const tau of [0.5, 3.5, 12]) {
				const d = diagnose(equilibrium({ tau, window, lapse: LAPSE_REF, convection }));
				expect(d.olr).toBeCloseTo(absorbedSolar(), 1);
				// and the shares of where it leaves from add up to all of it
				const total = d.share.reduce((a, b) => a + b, 0) + d.shareSurfaceBand + d.shareWindow;
				expect(total).toBeCloseTo(1, 6);
			}
});

test('radiative equilibrium is unstable near the ground; convection fixes it', () => {
	const rad = equilibrium(earth(TAU_REF, { convection: false }));
	const d = diagnose(rad);
	// the surface is several kelvin warmer than the air touching it
	expect(rad.ts - rad.T[0]).toBeGreaterThan(10);
	// and the lowest kilometres cool with height faster than even dry air can stay stable
	const lapse = (rad.T[0] - rad.T[4]) / (d.z[4] - d.z[0]);
	expect(lapse).toBeGreaterThan(DRY_LAPSE);

	const conv = equilibrium(earth());
	const dc = diagnose(conv);
	expect(conv.ts - conv.T[0]).toBeLessThan(1);
	const lapseC = (conv.T[0] - conv.T[10]) / (dc.z[10] - dc.z[0]);
	expect(lapseC).toBeCloseTo(LAPSE_REF, 1);
	// convection carries heat up: the surface is cooler than in radiative equilibrium
	expect(conv.ts).toBeLessThan(rad.ts - 15);
});

test('the reference column is Earth-like: 288 K at the surface, a tropopause near 11 km', () => {
	const d = diagnose(equilibrium(earth()));
	const c = equilibrium(earth());
	expect(c.ts).toBeGreaterThan(287);
	expect(c.ts).toBeLessThan(290);
	expect(d.tropopauseZ!).toBeGreaterThan(9);
	expect(d.tropopauseZ!).toBeLessThan(13);
	// the planet radiates from about 5 km up, where the air is near 255 K
	expect(d.emissionZ!).toBeGreaterThan(4);
	expect(d.emissionZ!).toBeLessThan(6);
	// the window lets about 40 W/m² straight out from the surface
	expect(d.olrWindow).toBeGreaterThan(35);
	expect(d.olrWindow).toBeLessThan(45);
});

test('more absorber raises the emission level and the tropopause and warms the surface', () => {
	let last = { ts: 0, em: 0, trop: 0 };
	for (const tau of [1.5, 2.5, 3.5, 5, 7, 10]) {
		const c = equilibrium(earth(tau));
		const d = diagnose(c);
		expect(c.ts).toBeGreaterThan(last.ts);
		expect(d.emissionZ!).toBeGreaterThan(last.em);
		expect(d.tropopauseZ!).toBeGreaterThan(last.trop);
		last = { ts: c.ts, em: d.emissionZ!, trop: d.tropopauseZ! };
	}
});

test('a band already saturated at the surface still warms the planet', () => {
	// at τ∞ = 8 the band lets e⁻⁸ (0.03%) of the surface's emission through: saturated
	const a = equilibrium(earth(8));
	const b = equilibrium(earth(12));
	expect(diagnose(a).shareSurfaceBand).toBeLessThan(0.001);
	expect(b.ts - a.ts).toBeGreaterThan(5);
	expect(diagnose(b).emissionZ! - diagnose(a).emissionZ!).toBeGreaterThan(1);
});

test('a steeper lapse rate makes a warmer surface for the same absorber', () => {
	const ts = [5, LAPSE_REF, 8, DRY_LAPSE].map((lapse) => equilibrium(earth(TAU_REF, { lapse })).ts);
	for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1] + 2);
});

test('in a fully grey gas the stratosphere does not cool; with the window it does', () => {
	const greyRC = [2, 3.5, 7, 12].map((tau) => equilibrium(grey(tau, true)));
	for (let i = 1; i < greyRC.length; i++) {
		// the skin stays put, and no level above 30 hPa gets colder (it warms a hair at most)
		const a = greyRC[i - 1];
		const b = greyRC[i];
		expect(b.T[b.T.length - 1]).toBeCloseTo(a.T[a.T.length - 1], 1);
		for (const p of [1, 3, 10, 30]) {
			const dT = temperatureAt(b, p) - temperatureAt(a, p);
			expect(dT).toBeGreaterThan(-0.05);
			expect(dT).toBeLessThan(1);
		}
	}
	const win = [2, 3.5, 7, 12].map((tau) => equilibrium(earth(tau)));
	for (let i = 1; i < win.length; i++) {
		const a = win[i - 1];
		const b = win[i];
		expect(b.T[b.T.length - 1]).toBeLessThan(a.T[a.T.length - 1] - 0.5);
		expect(temperatureAt(b, 10)).toBeLessThan(temperatureAt(a, 10) - 0.5);
	}
	// the skin with a window: (1 − w)σT⁴ = (OLR − wσTs⁴)/2
	const c = win[1];
	const d = diagnose(c);
	const skin = ((d.olr - d.olrWindow) / (2 * (1 - WINDOW) * SIGMA)) ** 0.25;
	expect(c.T[c.T.length - 1]).toBeCloseTo(skin, 0);
});

test('more absorber first cuts the outgoing infrared, then the column warms back to balance', () => {
	const before = equilibrium(earth());
	const after = earth(2 * TAU_REF);
	// with the temperatures held, the planet suddenly radiates from higher, colder air
	expect(instantOLR(before, after)).toBeLessThan(absorbedSolar() - 20);
	const run = evolve(before, after, 365.25 * 40, 40);
	const end = run[run.length - 1];
	const target = equilibrium(after);
	expect(end.olr).toBeCloseTo(absorbedSolar(), 0);
	expect(end.ts).toBeCloseTo(target.ts, 0);
	// the surface warms throughout; it takes years, held back by the ocean's heat capacity
	for (let i = 1; i < run.length; i++) expect(run[i].ts).toBeGreaterThanOrEqual(run[i - 1].ts);
	const half = run.find((s) => s.ts - before.ts > (target.ts - before.ts) / 2)!;
	expect(half.days).toBeGreaterThan(365);
});
