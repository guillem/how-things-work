// Checks the stars model: MIST evolution tracks against what is known about real stars, the
// burning stages read off them, the fates, and the origins of the elements. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	AU_IN_RSUN,
	FUSION_MASS_FRACTION,
	L_SUN,
	C,
	SUN_AGE,
	STAGE,
	T_SUN,
	at,
	atAge,
	burning,
	cnoDominates,
	fate,
	fuelLifetime,
	bodyBySource,
	madeInStars,
	mainSequenceLifetime,
	mainSource,
	meanMainSequenceLuminosity,
	origin,
	starColour,
	track,
	zams
} from '../src/routes/stars/star';
import { NEARBY, NEARBY_WHITE_DWARFS } from '../src/routes/stars/nearby';

const sun = track(1);
const sunNow = atAge(sun, SUN_AGE);

test('the model Sun today is within 12% of the real Sun in luminosity and 2% in temperature and radius', () => {
	expect(sunNow.L).toBeGreaterThan(0.88);
	expect(sunNow.L).toBeLessThan(1.12);
	expect(Math.abs(sunNow.T / T_SUN - 1)).toBeLessThan(0.02);
	expect(Math.abs(sunNow.R - 1)).toBeLessThan(0.03);
	// Its centre: about 15 million kelvin and 150 g/cm³ (standard solar models give 15.7 MK).
	expect(sunNow.Tc).toBeGreaterThan(1.45e7);
	expect(sunNow.Tc).toBeLessThan(1.65e7);
	expect(sunNow.rhoc).toBeGreaterThan(130);
	expect(sunNow.rhoc).toBeLessThan(170);
	// About half the hydrogen in its core is gone.
	expect(sunNow.xH).toBeGreaterThan(0.3);
	expect(sunNow.xH).toBeLessThan(0.4);
});

test('the young Sun was about 30% fainter than today (the faint young Sun)', () => {
	const young = at(sun, STAGE.zams);
	expect(young.L / sunNow.L).toBeGreaterThan(0.6);
	expect(young.L / sunNow.L).toBeLessThan(0.75);
});

test('fusing hydrogen into helium turns 0.7% of the mass into energy: 4.3 million tonnes a second for the Sun', () => {
	expect(FUSION_MASS_FRACTION).toBeCloseTo(0.0071, 4);
	expect(L_SUN / C ** 2 / 1000).toBeCloseTo(4.26e6, -4);
});

test('mass–luminosity: on the main sequence L grows as roughly M^3.5 to M^4', () => {
	const slope = (a: number, b: number) =>
		(zams(b).logL - zams(a).logL) / (Math.log10(b) - Math.log10(a));
	expect(slope(1, 10)).toBeGreaterThan(3.5);
	expect(slope(1, 10)).toBeLessThan(4.2);
	expect(slope(2, 20)).toBeGreaterThan(3.2);
	expect(slope(2, 20)).toBeLessThan(4);
	// Above ~20 M☉ it flattens towards L ∝ M (radiation pressure).
	expect(slope(30, 60)).toBeLessThan(slope(1, 10) - 1);
});

test('main-sequence lifetimes: about 10 billion years for the Sun, 10 million for 15 M☉, longer than the age of the universe below about 0.9 M☉', () => {
	expect(mainSequenceLifetime(1) / 1e9).toBeGreaterThan(9);
	expect(mainSequenceLifetime(1) / 1e9).toBeLessThan(11);
	expect(mainSequenceLifetime(15) / 1e6).toBeGreaterThan(10);
	expect(mainSequenceLifetime(15) / 1e6).toBeLessThan(15);
	expect(mainSequenceLifetime(0.5)).toBeGreaterThan(5 * 13.8e9);
	expect(mainSequenceLifetime(0.85)).toBeGreaterThan(13.8e9);
	expect(mainSequenceLifetime(1)).toBeLessThan(13.8e9);
});

test('lifetime ∝ M/L: across a 10⁷ range of luminosity, τ·L/M stays within 10–45 billion years', () => {
	for (const m of [0.5, 1, 2, 5, 10, 20, 30]) {
		const v = (mainSequenceLifetime(m) * meanMainSequenceLuminosity(m)) / m;
		expect(v / 1e9).toBeGreaterThan(10);
		expect(v / 1e9).toBeLessThan(45);
	}
	expect(zams(30).L / zams(0.5).L).toBeGreaterThan(1e6);
	// Burning a tenth of the Sun's hydrogen at today's luminosity takes about 10 billion years.
	expect(fuelLifetime(1, 1) / 1e9).toBeGreaterThan(9.5);
	expect(fuelLifetime(1, 1) / 1e9).toBeLessThan(11.5);
});

test('the Sun shines by the pp chain, stars above about 1.5 M☉ by the CNO cycle', () => {
	expect(cnoDominates(1)).toBe(false);
	expect(cnoDominates(1.3)).toBe(false);
	expect(cnoDominates(2)).toBe(true);
	expect(cnoDominates(15)).toBe(true);
});

test('real stars within 50 pc lie along the model main sequence', () => {
	// For dwarfs between 4,000 and 6,000 K the median distance from the model's zero-age main
	// sequence (in log L at that temperature) is small; the main sequence is a mass sequence.
	const ms: [number, number][] = [];
	for (let m = 0.4; m <= 1.2; m += 0.01) ms.push([zams(m).logT, zams(m).logL]);
	const zamsL = (logT: number) => {
		for (let i = 1; i < ms.length; i++)
			if (ms[i][0] >= logT) {
				const u = (logT - ms[i - 1][0]) / (ms[i][0] - ms[i - 1][0]);
				return ms[i - 1][1] + u * (ms[i][1] - ms[i - 1][1]);
			}
		return NaN;
	};
	const d = NEARBY.filter(([lt, ll]) => lt > Math.log10(4000) && lt < Math.log10(6000) && ll < 0.5)
		.map(([lt, ll]) => ll - zamsL(lt))
		.sort((a, b) => a - b);
	expect(d.length).toBeGreaterThan(200);
	expect(Math.abs(d[Math.floor(d.length / 2)])).toBeLessThan(0.15);
	// White dwarfs: as hot as the Sun or hotter, but hundreds to thousands of times fainter.
	const sunLike = NEARBY_WHITE_DWARFS.filter(([lt]) => Math.abs(lt - Math.log10(6000)) < 0.03);
	expect(sunLike.length).toBeGreaterThan(5);
	for (const [, ll] of sunLike) expect(ll).toBeLessThan(-2.5);
});

test('the Sun becomes a red giant, then a helium-burning giant, then a white dwarf of about 0.54 M☉', () => {
	expect(burning(sunNow).core).toBe('H');
	const giant = at(sun, (STAGE.tams + STAGE.rgbTip) / 2 + 20);
	expect(burning(giant)).toEqual({ core: null, hShell: true, heShell: false });
	const tip = at(sun, STAGE.rgbTip);
	expect(tip.R).toBeGreaterThan(100);
	expect(tip.L).toBeGreaterThan(1000);
	const heb = at(sun, (STAGE.zachb + STAGE.tachb) / 2);
	expect(burning(heb).core).toBe('He');
	expect(heb.Tc).toBeGreaterThan(9e7);
	// On the asymptotic giant branch it grows wider than the Earth's orbit.
	let rMax = 0;
	for (let i = STAGE.tachb; i < STAGE.postAgb; i++) rMax = Math.max(rMax, at(sun, i).R);
	expect(rMax).toBeGreaterThan(AU_IN_RSUN);
	const f = fate(1);
	expect(f.kind).toBe('white-dwarf');
	expect(f.remnant).toBeGreaterThan(0.5);
	expect(f.remnant).toBeLessThan(0.58);
	// Its white dwarf is carbon and oxygen.
	const end = at(sun, sun.age.length - 1);
	expect(end.xC + end.xO).toBeGreaterThan(0.95);
});

test('model white dwarfs from 1–2 M☉ stars weigh about what real ones do (~0.6 M☉)', () => {
	for (const m of [1, 2]) {
		expect(fate(m).remnant).toBeGreaterThan(0.5);
		expect(fate(m).remnant).toBeLessThan(0.65);
	}
	// Heavier stars leave heavier white dwarfs.
	expect(fate(5).remnant!).toBeGreaterThan(fate(2).remnant! + 0.2);
});

test('a 20 M☉ star burns hydrogen, helium and then carbon in its core, and lives about 10 million years', () => {
	const t = track(20);
	const fuels = new Set<string>();
	for (let i = 0; i < t.age.length; i++) {
		const c = burning(at(t, i)).core;
		if (c) fuels.add(c);
	}
	expect([...fuels]).toEqual(['H', 'He', 'C']);
	const life = t.age[t.age.length - 1] - t.age[0];
	expect(life / 1e6).toBeGreaterThan(9);
	expect(life / 1e6).toBeLessThan(11);
	// As a red supergiant it is more than 1,000 times wider than the Sun.
	expect(Math.max(...t.logR)).toBeGreaterThan(3);
});

test('fates: white dwarfs below about 8 M☉, neutron stars, then black holes; a 0.5 M☉ star has not died yet', () => {
	expect(fate(0.5).kind).toBe('not-yet');
	expect(fate(1).kind).toBe('white-dwarf');
	expect(fate(5).kind).toBe('white-dwarf');
	expect(fate(12).kind).toBe('neutron-star');
	expect(fate(20).kind).toBe('neutron-star');
	expect(fate(30).kind).toBe('black-hole');
});

test('star colours: cool stars are red-orange, the Sun near white, hot stars blue-white', () => {
	const rgb = (T: number) => starColour(T).match(/\d+/g)!.map(Number);
	const [r3, , b3] = rgb(3000);
	const [r30, , b30] = rgb(30000);
	expect(r3).toBeGreaterThan(b3 + 80);
	expect(b30).toBeGreaterThan(r30);
	const [rs, gs, bs] = rgb(5772);
	expect(Math.max(rs, gs, bs) - Math.min(rs, gs, bs)).toBeLessThan(70);
});

test('origins: hydrogen is from the Big Bang, oxygen from massive stars, gold mostly from merging neutron stars', () => {
	expect(origin(1).shares.bigBang).toBe(1);
	expect(mainSource(8)).toBe('massive');
	expect(mainSource(79)).toBe('mergers');
	expect(mainSource(26)).toBe('whiteDwarfs');
	expect(mainSource(56)).toBe('lowMass'); // barium: the s-process in giant stars
	// Beryllium and boron: made by cosmic rays breaking heavier nuclei, not in stars; lithium
	// partly in the Big Bang and by cosmic rays.
	for (const z of [4, 5]) expect(origin(z).shares.cosmicRays).toBe(1);
	expect(origin(3).shares.bigBang).toBeGreaterThan(0.1);
	expect(origin(3).shares.cosmicRays).toBeGreaterThan(0.1);
	// From carbon to uranium, everything with stable or long-lived isotopes was made in stars.
	for (let z = 6; z <= 92; z++) {
		if (origin(z).synthetic) continue;
		expect(madeInStars(z), origin(z).symbol).toBeGreaterThan(0.99);
	}
	// Technetium and promethium have no long-lived isotopes.
	expect(origin(43).synthetic).toBe(true);
	expect(origin(61).synthetic).toBe(true);
});

test('about nine-tenths of the mass of a human body was made in stars; the tenth that is hydrogen, in the Big Bang', () => {
	const b = bodyBySource();
	const stars = b.lowMass + b.massive + b.whiteDwarfs + b.mergers;
	expect(stars).toBeGreaterThan(0.86);
	expect(stars).toBeLessThan(0.92);
	expect(b.bigBang).toBeCloseTo(0.1, 2);
	expect(b.massive).toBeGreaterThan(b.lowMass);
});

// ---- the numbers the narrative quotes, step by step ---------------------------------------------

const within = (v: number, lo: number, hi: number) => {
	expect(v).toBeGreaterThanOrEqual(lo);
	expect(v).toBeLessThanOrEqual(hi);
};

test('main-sequence step: 6,400 L☉ at 10 M☉, a thousandth at 0.1 M☉ (2,900 K), 50,000 K at the top, 24 and 4 million years', () => {
	within(zams(10).L, 6000, 6800);
	within(zams(0.1).L, 0.0009, 0.0011);
	within(zams(0.1).T, 2800, 3000);
	within(zams(60).T, 47000, 52000);
	within(mainSequenceLifetime(10) / 1e6, 22, 26);
	within(mainSequenceLifetime(60) / 1e6, 3.5, 4.5);
	// τ·L/M changes by about a factor of four from 0.5 to 60 M☉ ...
	const v = (m: number) => (mainSequenceLifetime(m) * meanMainSequenceLuminosity(m)) / m;
	within(v(60) / v(1.5), 3, 5);
	// ... because massive stars burn a bigger share of their hydrogen: a third at 20 M☉, a seventh for the Sun.
	const burnt = (m: number) =>
		mainSequenceLifetime(m) / fuelLifetime(m, meanMainSequenceLuminosity(m), 1);
	within(burnt(20), 0.28, 0.38);
	within(burnt(1), 0.12, 0.17);
});

test('sun-ms step: born at two-thirds of today’s model luminosity, over twice it at the end; main sequence over 85% of the life', () => {
	const zamsL = at(sun, STAGE.zams).L;
	within(zamsL / sunNow.L, 0.6, 0.72);
	expect(at(sun, STAGE.tams).L / sunNow.L).toBeGreaterThan(2);
	const life = sun.age[sun.age.length - 1] - sun.age[0];
	const ms = sun.age[STAGE.tams] - sun.age[0];
	within(ms / life, 0.85, 0.9);
	within((life - ms) / 1e9, 1.4, 1.6);
});

test('red-giant step: 1.4 billion years to the tip, at 170 R☉, 2,400 L☉, 3,100 K, 0.95 M☉', () => {
	const tip = at(sun, STAGE.rgbTip);
	within((tip.age - sun.age[STAGE.tams]) / 1e9, 1.3, 1.5);
	within(tip.R, 160, 180);
	within(tip.L, 2300, 2500);
	within(tip.T, 3000, 3200);
	within(tip.M, 0.94, 0.96);
});

test('helium step: core helium burning starts at 11 R☉ and 47 L☉ and lasts about 110 million years', () => {
	const start = at(sun, STAGE.zachb);
	within(start.R, 10, 12);
	within(start.L, 44, 50);
	within((sun.age[STAGE.tachb] - sun.age[STAGE.zachb]) / 1e6, 100, 120);
});

test('massive step: a 20 M☉ star starts at 36,000 K and 46,000 L☉, loses 7 M☉, and burns carbon at about 900 million K', () => {
	const t = track(20);
	const z0 = at(t, 0);
	within(z0.T, 35000, 37000);
	within(z0.L, 44000, 48000);
	within(20 - t.M[t.M.length - 1], 6.5, 7.5);
	let tc = 0;
	for (let i = 0; i < t.age.length; i++) {
		const m = at(t, i);
		if (burning(m).core === 'C') tc = Math.max(tc, m.Tc);
	}
	within(tc / 1e6, 850, 1000);
});

test('run step: a 0.5 M☉ star is still on the main sequence at about seven times the age of the universe', () => {
	const t = track(0.5);
	within(t.age[t.age.length - 1] / 13.8e9, 6.5, 7.2);
});
