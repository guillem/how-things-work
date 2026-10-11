// Checks the photosynthesis rate model against measurements and the textbook
// behaviour of C₃ leaves (definition of done #5 in docs/TOPICS.md). Runs in
// Node; no browser.
import { expect, test } from '@playwright/test';
import {
	CI_RATIO,
	FULL_SUN,
	expint1,
	leafOptics,
	rate,
	whiteAbsorptance,
	type Conditions
} from '../src/routes/photosynthesis/model';

const air: Conditions = { ppfd: 1400, light: 'white', co2: 420, tempC: 25 };
const at = (o: Partial<Conditions>) => rate({ ...air, ...o });

test('the exponential integral matches tabulated values', () => {
	// Abramowitz & Stegun, table 5.1.
	expect(expint1(0.1)).toBeCloseTo(1.8229239584, 8);
	expect(expint1(1)).toBeCloseTo(0.2193839344, 8);
	expect(expint1(5)).toBeCloseTo(0.001148295591, 10);
});

test('a leaf absorbs most green light, but less than red or blue', () => {
	const green = leafOptics(550);
	// McCree 1972: 0.60–0.82 at the green dip across 22 crop species (mean 0.76);
	// Inada 1976 (via Terashima et al. 2009): 50% (lettuce) to 90% (evergreens).
	expect(green.absorptance).toBeGreaterThan(0.6);
	expect(green.absorptance).toBeLessThan(0.82);
	// Blue and red: 80–95% and more (Terashima et al. 2009).
	for (const nm of [440, 470, 640, 675]) expect(leafOptics(nm).absorptance).toBeGreaterThan(0.85);
	// Leaves look green: they send back (reflect + transmit) more green than red or blue.
	const back = (nm: number) => 1 - leafOptics(nm).absorptance;
	expect(back(550)).toBeGreaterThan(2 * back(450));
	expect(back(550)).toBeGreaterThan(2 * back(660));
	// Typical leaves absorb about 85% of white light (≈ 10% reflected, 5% transmitted).
	expect(whiteAbsorptance()).toBeGreaterThan(0.8);
	expect(whiteAbsorptance()).toBeLessThan(0.92);
});

test('in darkness the leaf only respires: it gives off CO₂ and takes up O₂', () => {
	const dark = at({ ppfd: 0 });
	expect(dark.net).toBeLessThan(0);
	expect(dark.net).toBeCloseTo(-dark.rd, 10);
	expect(dark.o2).toBeLessThan(0);
});

test('at low light, O₂ comes from water at about one per ten absorbed photons', () => {
	// Björkman & Demmig 1987: 0.106 O₂ per absorbed photon in 44 C₃ species
	// (measured without photorespiration). The model's gross O₂ evolution is
	// J/4: four electrons per O₂.
	const dim = at({ ppfd: 20 });
	expect(dim.j / 4 / dim.absorbed).toBeCloseTo(0.106, 2);
	// Eight photons per O₂ is the theoretical minimum (the Z-scheme step).
	expect(dim.j / 4 / dim.absorbed).toBeLessThan(1 / 8);
});

test('more light raises the rate until something else limits it', () => {
	const rates = [0, 100, 200, 400, 800, 1200, 1600, 2000].map((ppfd) => at({ ppfd }).net);
	for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
	// Steep at first, nearly flat in full sunlight.
	expect(rates[1] - rates[0]).toBeGreaterThan(10 * (rates[7] - rates[6]));
	expect(at({ ppfd: 100 }).limit).toBe('light');
	// In full sun at today's CO₂, a C₃ leaf is limited by RuBisCO and CO₂...
	expect(at({ ppfd: FULL_SUN }).limit).toBe('rubisco');
	// ...so extra CO₂ still helps, and then light limits again.
	expect(at({ ppfd: FULL_SUN, co2: 1000 }).net).toBeGreaterThan(at({ ppfd: FULL_SUN }).net + 3);
	expect(at({ ppfd: FULL_SUN, co2: 1000 }).limit).toBe('light');
	// Light-saturated net uptake of a typical C₃ leaf: about 10–25 µmol m⁻² s⁻¹.
	expect(at({ ppfd: FULL_SUN }).net).toBeGreaterThan(10);
	expect(at({ ppfd: FULL_SUN }).net).toBeLessThan(25);
});

test('more CO₂ raises the rate; below the compensation point the leaf loses carbon', () => {
	const rates = [100, 200, 300, 420, 600, 800, 1000, 1200].map((co2) => at({ co2 }).net);
	for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
	// Find where net uptake crosses zero.
	let lo = 0;
	let hi = 420;
	for (let k = 0; k < 50; k++) {
		const mid = (lo + hi) / 2;
		if (at({ co2: mid }).net > 0) hi = mid;
		else lo = mid;
	}
	// The CO₂ compensation point of C₃ leaves at 25 °C is about 40–60 µmol mol⁻¹
	// inside the leaf (von Caemmerer 2000, ch. 2).
	expect(CI_RATIO * hi).toBeGreaterThan(40);
	expect(CI_RATIO * hi).toBeLessThan(60);
	expect(at({ co2: 50 }).net).toBeLessThan(0);
});

test('photosynthesis has a temperature optimum', () => {
	const temps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
	const rates = temps.map((tempC) => at({ tempC }).net);
	const best = temps[rates.indexOf(Math.max(...rates))];
	// C₃ leaves grown at moderate temperatures peak around 20–35 °C.
	expect(best).toBeGreaterThanOrEqual(20);
	expect(best).toBeLessThanOrEqual(35);
	// Both cold and heat slow it down a lot.
	expect(at({ tempC: 5 }).net).toBeLessThan(0.5 * Math.max(...rates));
	expect(at({ tempC: 45 }).net).toBeLessThan(0.25 * Math.max(...rates));
});

test('green light drives photosynthesis less than red, but far from not at all', () => {
	// At limiting light, the rate follows the photons the leaf absorbs.
	const dim = (light: number) => at({ ppfd: 300, light }).net;
	expect(dim(550)).toBeLessThan(dim(660));
	expect(dim(550)).toBeGreaterThan(0.75 * dim(660));
	// In saturating light, colour hardly matters: RuBisCO sets the pace.
	const bright = (light: number) => at({ ppfd: FULL_SUN, light }).net;
	expect(bright(550)).toBeGreaterThan(0.95 * bright(660));
});
