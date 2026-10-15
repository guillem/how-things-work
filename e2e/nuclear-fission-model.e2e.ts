// Checks the fission model against nuclear data and textbook reactor physics
// (definition of done #5 in docs/TOPICS.md), and every number the narrative
// quotes. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	AVOGADRO,
	BANK_WORTH,
	BETA,
	DESIGN,
	FISSION_ENERGY,
	GENERATION_TIME,
	METHANE_J_PER_KG,
	NATURAL,
	MEV,
	SCRAM_REACTIVITY,
	SPLITS,
	U235,
	advance,
	bankReactivity,
	bindingCurve,
	chainRun,
	collisions,
	criticalRods,
	decayHeat,
	eta,
	expectedChain,
	factors,
	fissionsPerSecond,
	heatPerKgU235,
	inhour,
	massLost,
	peak,
	perNucleon,
	promptOnlyRate,
	promptQ,
	reactivity,
	slowDown,
	splitById,
	steady,
	totalQ,
	u235PerDay,
	waterXi,
	xi
} from '../src/routes/nuclear-fission/model';
import {
	CHAIN_GENERATIONS,
	CHAIN_N0,
	CHAIN_SEED,
	buildTree
} from '../src/routes/nuclear-fission/chain';

test('binding energy per nucleon peaks near iron and is lower for uranium', () => {
	const top = peak();
	expect(top.element).toBe('Ni');
	expect(top.A).toBe(62);
	expect(top.b).toBeCloseTo(8.795, 3);
	expect(perNucleon('Fe56')).toBeCloseTo(8.79, 2);
	expect(perNucleon('U235')).toBeCloseTo(7.591, 3);
	expect(perNucleon('He4')).toBeCloseTo(7.074, 3);
	// Fission fragments sit 0.7–1 MeV per nucleon higher than uranium.
	for (const s of SPLITS) {
		for (const f of [s.light, s.heavy]) {
			const gain = perNucleon(f) - perNucleon('U235');
			expect(gain).toBeGreaterThan(0.69);
			expect(gain).toBeLessThan(1.01);
		}
	}
	// The curve covers light to heaviest measured nuclei.
	expect(bindingCurve[0].A).toBe(2);
	expect(bindingCurve.at(-1)!.A).toBeGreaterThan(250);
});

test('a split releases about 170–185 MeV at once and about 200 MeV in all', () => {
	const bakr = splitById('bakr');
	expect(promptQ(bakr)).toBeCloseTo(173.3, 1);
	expect(totalQ(bakr)).toBeCloseTo(199.2, 1);
	expect(promptQ(splitById('xesr'))).toBeCloseTo(184.7, 1);
	expect(totalQ(splitById('xesr'))).toBeCloseTo(208.2, 1);
	expect(promptQ(splitById('csrb'))).toBeCloseTo(172.7, 1);
	expect(totalQ(splitById('csrb'))).toBeCloseTo(197.9, 1);
	for (const s of SPLITS) {
		// Charge and nucleons are conserved.
		expect(s.neutrons === 2 || s.neutrons === 3).toBe(true);
		// About 0.09% of the mass is converted.
		expect(massLost(s)).toBeGreaterThan(0.00085);
		expect(massLost(s)).toBeLessThan(0.00096);
	}
});

test('the heat per fission accounts for the escaping antineutrinos and the captured neutrons', () => {
	const e = FISSION_ENERGY;
	expect(e.total - e.neutrinos - e.pending + e.capture).toBeCloseTo(e.heat, 1);
	expect(e.heat).toBeGreaterThan(195);
	expect(e.heat).toBeLessThan(205);
	// The average total (over all splits) is close to the single splits from the masses.
	expect(e.total).toBeGreaterThan(totalQ(splitById('csrb')));
	expect(e.total).toBeLessThan(totalQ(splitById('xesr')));
});

test('a kilogram of uranium-235 gives over a million times the heat of a kilogram of gas', () => {
	expect(heatPerKgU235()).toBeCloseTo(8.3e13, -12);
	expect(METHANE_J_PER_KG).toBeCloseTo(55.5e6, -5);
	const ratio = heatPerKgU235() / METHANE_J_PER_KG;
	expect(ratio).toBeGreaterThan(1.4e6);
	expect(ratio).toBeLessThan(1.6e6);
});

test('η: 1.35 neutrons per absorption in natural uranium, 1.9 at 4%', () => {
	expect(U235.nu).toBeCloseTo(2.425, 3);
	expect(eta(NATURAL)).toBeCloseTo(1.35, 2);
	expect(eta(4)).toBeCloseTo(1.9, 2);
	expect(eta(100)).toBeCloseTo((U235.nu * U235.fission) / (U235.fission + U235.capture), 9);
});

test('water slows a fission neutron to thermal in about 20 collisions', () => {
	expect(xi(1)).toBe(1);
	// ξ of carbon is about 0.158 (textbook value), so graphite needs about 115 collisions.
	expect(xi(12)).toBeCloseTo(0.158, 3);
	expect(collisions(2e6, 0.0253, xi(1))).toBeCloseTo(18.2, 1);
	expect(waterXi()).toBeCloseTo(0.93, 2);
	expect(Math.round(collisions(2e6, 0.0253, waterXi()))).toBe(20);
	expect(Math.round(collisions(2e6, 0.0253, xi(12)))).toBe(115);
});

test('the design core is critical with the rods half in', () => {
	expect(factors(DESIGN).k).toBeCloseTo(1, 9);
	const f = factors(DESIGN);
	expect(f.p).toBeGreaterThan(0.7);
	expect(f.p).toBeLessThan(0.85);
	// With the rods out, a fresh core has a large excess: k ≈ 1.4.
	expect(factors({ ...DESIGN, rods: 0 }).k).toBeCloseTo(1.41, 2);
	expect(factors({ ...DESIGN, rods: 1 }).k).toBeLessThan(0.8);
});

test('natural uranium in light water never reaches k = 1', () => {
	let best = 0;
	for (let w = 0.05; w <= 6; w += 0.05)
		best = Math.max(best, factors({ enrichment: NATURAL, water: w, rods: 0 }).k);
	expect(best).toBeLessThan(0.95);
	expect(criticalRods(NATURAL, 1)).toBeNull();
	// Power-reactor fuel (3–5%) can be held critical at the design water.
	for (const e of [3, 3.5, 4, 4.5, 5]) expect(criticalRods(e, 1)).not.toBeNull();
});

test('more enrichment raises k; more rods lower it', () => {
	let last = 0;
	for (const e of [NATURAL, 1, 2, 3, 4, 5]) {
		const k = factors({ ...DESIGN, enrichment: e }).k;
		expect(k).toBeGreaterThan(last);
		last = k;
	}
	last = Infinity;
	for (let x = 0; x <= 1.0001; x += 0.05) {
		const k = factors({ ...DESIGN, rods: x }).k;
		expect(k).toBeLessThan(last);
		last = k;
	}
});

test('the core is under-moderated: losing water lowers k', () => {
	const k = (water: number) => factors({ ...DESIGN, water }).k;
	expect(k(0.9)).toBeLessThan(0.98);
	expect(k(0.5)).toBeLessThan(0.8);
	expect(k(0)).toBe(0);
	expect(k(1.1)).toBeGreaterThan(1.01);
	// The most reactive amount of water is well above the design amount.
	let bestW = 0;
	for (let w = 0.1; w <= 6; w += 0.05) if (k(w) > k(bestW)) bestW = w;
	expect(bestW).toBeGreaterThan(2);
});

test('the rods slider can hold k within ±0.001 at default fuel and water', () => {
	// 0.1% steps of rod travel (the slider's step) reach the steady band.
	let close = Infinity;
	for (let i = 0; i <= 1000; i++)
		close = Math.min(close, Math.abs(factors({ ...DESIGN, rods: i / 1000 }).k - 1));
	expect(close).toBeLessThanOrEqual(0.001);
	for (const e of [3, 5]) {
		let near = Infinity;
		for (let i = 0; i <= 1000; i++)
			near = Math.min(near, Math.abs(factors({ enrichment: e, water: 1, rods: i / 1000 }).k - 1));
		expect(near).toBeLessThanOrEqual(0.001);
	}
});

test('each neutron leads to k new ones on average', () => {
	for (const k of [0.9, 1, 1.1]) {
		const run = chainRun(k, 200_000, 1, 17);
		expect(run[1] / run[0]).toBeCloseTo(k, 2);
	}
});

test('below 1 the chain dies away, above 1 it grows, at 1 it holds', () => {
	const sub = chainRun(0.9, CHAIN_N0, CHAIN_GENERATIONS, CHAIN_SEED);
	const crit = chainRun(1, CHAIN_N0, CHAIN_GENERATIONS, CHAIN_SEED);
	const sup = chainRun(1.1, CHAIN_N0, CHAIN_GENERATIONS, CHAIN_SEED);
	expect(sub.at(-1)!).toBeLessThan(0.05 * CHAIN_N0);
	expect(sup.at(-1)!).toBeGreaterThan(15 * CHAIN_N0);
	// The page's critical run stays within ±10% of where it started.
	for (const n of crit) expect(Math.abs(n / CHAIN_N0 - 1)).toBeLessThan(0.1);
});

test('in the chain tree, lost neutrons are mostly captured: few leak out of a large core', () => {
	const lost = Array.from({ length: 200 }, (_, salt) => buildTree(1, 8, 1000, salt))
		.flatMap((tree) => tree.neutrons.flat())
		.filter((n) => n.fate !== 'fission');
	const escaped = lost.filter((n) => n.fate === 'escaped').length;
	// The core model loses 3% of all neutrons to leakage, against about 59% lost in all.
	expect(escaped / lost.length).toBeGreaterThan(0.01);
	expect(escaped / lost.length).toBeLessThan(0.12);
});

test('delayed neutrons: β = 0.65%, and they set the pace', () => {
	expect(BETA).toBeCloseTo(0.0065, 4);
	// A 0.1% step: the power settles into a period of about 55 s.
	expect(1 / inhour(0.001)).toBeCloseTo(55, 0);
	// Without delayed neutrons the period would be Λ / ρ = 0.1 s.
	expect(1 / promptOnlyRate(0.001)).toBeCloseTo(GENERATION_TIME / 0.001, 9);
	expect(1 / promptOnlyRate(0.001)).toBeCloseTo(0.1, 9);
});

test('point kinetics: steady stays steady, a step grows at the inhour period', () => {
	let s = steady();
	for (let i = 0; i < 600; i++) s = advance(s, 0, 1 / 60);
	expect(s.power).toBeCloseTo(1, 9);

	const run = (rho: number, seconds: number, dt: number) => {
		let st = steady();
		const out: number[] = [];
		for (let i = 0; i < Math.round(seconds / dt); i++) {
			st = advance(st, rho, dt);
			out.push(st.power);
		}
		return out;
	};
	for (const dt of [1 / 60, 1 / 240]) {
		const p = run(0.001, 300, dt);
		const at = (sec: number) => p[Math.round(sec / dt) - 1];
		const period = 100 / Math.log(at(300) / at(200));
		expect(period).toBeCloseTo(1 / inhour(0.001), 0);
	}
	// The prompt jump: within a fraction of a second the power rises to about β / (β − ρ).
	const jump = run(0.001, 0.05, 1 / 240).at(-1)!;
	expect(jump).toBeCloseTo(BETA / (BETA - 0.001), 1);
});

test('a scram drops the power at once, then it falls with an 80-second period', () => {
	let s = steady();
	s = advance(s, SCRAM_REACTIVITY, 1);
	expect(s.power).toBeLessThan(0.15);
	const a = advance(s, SCRAM_REACTIVITY, 299);
	const b = advance(a, SCRAM_REACTIVITY, 100);
	const period = 100 / Math.log(a.power / b.power);
	expect(period).toBeCloseTo(1 / 0.0124, -1);
});

test('the operating rods are worth less than β either way', () => {
	expect(bankReactivity(0.5)).toBeCloseTo(0, 12);
	expect(bankReactivity(0)).toBeCloseTo(BANK_WORTH / 2, 12);
	expect(bankReactivity(0)).toBeLessThan(BETA);
	expect(bankReactivity(1)).toBeCloseTo(-BANK_WORTH / 2, 12);
	// Fully withdrawn the power still grows with a period of seconds, not milliseconds.
	expect(1 / inhour(bankReactivity(0))).toBeGreaterThan(5);
});

test('a 3 GW reactor splits about 10²⁰ nuclei a second, about 3 kg of U-235 a day', () => {
	expect(fissionsPerSecond(3e9)).toBeCloseTo(9.25e19, -18);
	expect(u235PerDay(3e9)).toBeCloseTo(3.1, 1);
});

test('decay heat: about 6% at shutdown, 1% after an hour, under 0.5% after a day', () => {
	expect(decayHeat(1)).toBeCloseTo(0.06, 2);
	expect(decayHeat(3600)).toBeCloseTo(0.01, 3);
	expect(decayHeat(86400)).toBeLessThan(0.005);
	expect(decayHeat(86400)).toBeGreaterThan(0.004);
	// It falls all the time, and never to zero.
	expect(decayHeat(30 * 86400)).toBeGreaterThan(0.001);
	expect(decayHeat(30 * 86400)).toBeLessThan(decayHeat(86400));
});

test('a simulated neutron in water takes about 20 collisions to slow down', () => {
	let total = 0;
	const runs = 4000;
	for (let s = 1; s <= runs; s++) total += slowDown(s).energies.length - 1;
	const mean = total / runs;
	// ln(2 MeV / 0.025 eV) / ξ ≈ 19.6, plus about one for the last step past the line.
	expect(mean).toBeGreaterThan(19);
	expect(mean).toBeLessThan(22);
});

test('the numbers the narrative quotes for scale', () => {
	// 1.1⁴⁰ ≈ 45: the supercritical chain after 40 generations.
	expect(expectedChain(1.1, 1, 40)).toBeCloseTo(45.3, 1);
	// k = 1.001 with no delayed neutrons: ×e every 0.1 s, ≈ ×22,000 every second.
	expect(Math.exp(promptOnlyRate(reactivity(1.001)) * 1)).toBeGreaterThan(20_000);
	expect(Math.exp(promptOnlyRate(reactivity(1.001)) * 1)).toBeLessThan(23_000);
	// Heat per fission against one methane molecule (≈ 9.2 eV): some 20 million times.
	const perMolecule = (890.71e3 / AVOGADRO / MEV) * 1e6; // eV
	expect(perMolecule).toBeCloseTo(9.2, 1);
	expect((FISSION_ENERGY.heat * 1e6) / perMolecule / 1e6).toBeCloseTo(22, 0);
	// Decay heat at shutdown of a 3 GW plant: about 180 MW.
	expect((decayHeat(1) * 3e9) / 1e6).toBeCloseTo(180, -1);
});
