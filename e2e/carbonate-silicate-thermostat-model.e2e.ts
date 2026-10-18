// Checks the box model behind the carbonate-silicate thermostat explainer: today's balance,
// Walker, Hays & Kasting's weathering law and rates, the climate's sensitivity, and the
// experiments the narrative describes (a knocked thermostat, a dimmer Sun, the young Sun, a
// snowball, the limits). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	AIR_PGC,
	KINETIC_EFOLD,
	P0,
	RUNOFF_EFOLD,
	SEALED_RATE,
	T_FROZEN,
	VOLCANIC_PGC,
	WEATHER_EFOLD,
	eFoldingYears,
	firstSwitch,
	frozenTemperature,
	history,
	openEquilibrium,
	openCarbon,
	openPressure,
	openTemperature,
	outerEdge,
	run,
	sunlightAgo,
	sunlightAt,
	toC,
	weathering,
	type Sample
} from '../src/routes/carbonate-silicate-thermostat/model';

test('today the planet balances at 280 ppm and 15 °C, with weathering equal to the volcanoes', () => {
	const eq = openEquilibrium(1, 1);
	expect(eq).not.toBeNull();
	expect(eq!.ppm).toBeCloseTo(280, 0);
	expect(toC(eq!.k)).toBeCloseTo(15, 0);
	expect(weathering(eq!.k, eq!.ppm)).toBeCloseTo(1, 3);
});

test('doubling CO₂ warms the open planet by about 3 °C (the IPCC AR6 best estimate)', () => {
	expect(openTemperature(2 * P0) - openTemperature(P0)).toBeCloseTo(3, 1);
});

test("WHK's weathering law: dissolution and runoff combine to a 13.7 K e-folding, doubling in about 9.5 K", () => {
	expect(1 / (1 / KINETIC_EFOLD + 1 / RUNOFF_EFOLD)).toBeCloseTo(WEATHER_EFOLD, 1);
	const k = openTemperature(P0);
	expect(weathering(k + 9.5, P0) / weathering(k, P0)).toBeCloseTo(2, 1);
	// and a frozen planet, with no rain and no runoff, does not weather at all
	expect(weathering(T_FROZEN - 10, 100_000)).toBe(0);
});

test('volcanoes release about 0.09 billion tonnes of carbon a year; frozen over, about a bar in 20–25 Myr', () => {
	expect(VOLCANIC_PGC).toBeCloseTo(0.09, 2);
	const barYears = 1e6 / SEALED_RATE;
	expect(barYears).toBeGreaterThan(20e6);
	expect(barYears).toBeLessThan(25e6);
});

test('carbon is conserved through freezing and thawing', () => {
	// frozen, the air gains exactly what the volcanoes release
	const frozen = run({ sun: 0.94, frozen: true, years: 2e6, samples: 4 });
	expect(frozen.every((x) => x.frozen)).toBe(true);
	const gained = AIR_PGC * (frozen.at(-1)!.ppm - frozen[0].ppm);
	expect(gained / (VOLCANIC_PGC * 2e6)).toBeCloseTo(1, 6);
	expect(frozen.at(-1)!.ocean).toBe(frozen[0].ocean);
	// at the thaw the air shares its carbon with the sealed ocean, and none is lost
	const air = 300_000;
	const shared = openPressure(AIR_PGC * (air - P0), air);
	expect(shared).toBeLessThan(air);
	expect(openCarbon(shared) / (AIR_PGC * (air - P0))).toBeCloseTo(1, 6);
	// through a whole snowball, the carbon budget closes: volcanoes in, weathering out (to the
	// accuracy of summing the sampled weathering through the sharp hothouse)
	const thawed = run({ sun: 0.94, frozen: true, years: 9e6, samples: 9000 });
	expect(thawed[0].frozen).toBe(true);
	const total = (x: Sample) => AIR_PGC * (x.ppm - P0) + x.ocean;
	let budget = 0;
	for (let i = 1; i < thawed.length; i++) {
		const a = thawed[i - 1];
		const b = thawed[i];
		const w = a.frozen !== b.frozen ? 0 : (a.w + b.w) / 2;
		budget += VOLCANIC_PGC * (1 - w) * (b.year - a.year);
	}
	expect(firstSwitch(thawed)).not.toBeNull();
	expect((total(thawed.at(-1)!) - total(thawed[0])) / budget).toBeCloseTo(1, 1);
});

test("the young Sun shone at about 72 % of today's 4.5 billion years ago (Gough 1981)", () => {
	expect(sunlightAgo(4.5)).toBeCloseTo(0.72, 2);
	expect(sunlightAgo(0)).toBe(1);
});

test('knocked off balance, CO₂ returns to 280 ppm over hundreds of thousands of years, not centuries', () => {
	const up = run({ ppm: 2 * P0, years: 4e6 });
	const down = run({ ppm: P0 / 2, years: 4e6 });
	expect(up.at(-1)!.ppm).toBeCloseTo(P0, -1);
	expect(down.at(-1)!.ppm).toBeCloseTo(P0, -1);
	for (const r of [up, down]) {
		const e = eFoldingYears(r, P0)!;
		expect(e).toBeGreaterThan(200e3);
		expect(e).toBeLessThan(1e6);
	}
	// a human lifetime does nothing to the excess
	const century = run({ ppm: 2 * P0, years: 100, samples: 1 });
	expect(2 * P0 - century.at(-1)!.ppm).toBeLessThan(0.2);
});

test('a Sun 10 % dimmer at once: CO₂ piles up and wins back about half of the sudden cooling', () => {
	const r = run({ sun: 0.9, years: 10e6 });
	const drop = toC(r[0].k) - 15;
	expect(drop).toBeLessThan(-10);
	expect(r.every((s) => !s.frozen)).toBe(true);
	const after = toC(r.at(-1)!.k) - 15;
	// the balance stays cooler than today: the thermostat droops
	expect(Math.abs(after - drop / 2)).toBeLessThan(1.5);
	expect(r.at(-1)!.ppm).toBeGreaterThan(3 * P0);
});

test('dimmed by 15 % at once, the planet freezes before the weathering can respond', () => {
	const r = run({ sun: 0.85, years: 5e6 });
	expect(r[0].frozen).toBe(true);
	expect(r.at(-1)!.frozen).toBe(true);
	// although an open balance exists for that sunlight, reached slowly
	expect(openEquilibrium(0.85, 1)).not.toBeNull();
});

test('under the brightening Sun the thermostat keeps the planet open while fixed CO₂ would freeze it', () => {
	const lively = history(3, 4.5, 45);
	// with three times today's volcanism early on, declining to today's, open throughout and
	// never below 0 °C, ending at today's 280 ppm and 15 °C
	for (const h of lively) {
		expect(h.k).not.toBeNull();
		expect(toC(h.k!)).toBeGreaterThan(0);
	}
	expect(lively.at(-1)!.ppm!).toBeCloseTo(P0, 0);
	expect(toC(lively.at(-1)!.k!)).toBeCloseTo(15, 0);
	// CO₂ falls as the Sun brightens, from tens of thousands of ppm
	expect(lively[0].ppm!).toBeGreaterThan(50_000);
	const ppms = lively.filter((p) => p.ppm !== null).map((p) => p.ppm!);
	for (let i = 1; i < ppms.length; i++) expect(ppms[i]).toBeLessThan(ppms[i - 1]);
	// with CO₂ held at 280 ppm the young planet freezes, and the ice keeps it frozen to today
	for (const h of lively) expect(toC(h.fixedK)).toBeLessThan(-30);
	// with only today's volcanism, the earliest planet has no open balance
	expect(history(1, 4.5, 9)[0].k).toBeNull();
});

test('a snowball thaws after millions of years of volcanic CO₂, into a hothouse that weathering draws down', () => {
	const r = run({ sun: 0.94, frozen: true, years: 20e6 });
	expect(r[0].frozen).toBe(true);
	expect(toC(r[0].k)).toBeLessThan(-40);
	const thaw = firstSwitch(r)!;
	expect(thaw).not.toBeNull();
	expect(thaw.year).toBeGreaterThan(3e6);
	expect(thaw.year).toBeLessThan(15e6);
	// the CO₂ that ended it: a tenth of a bar or more, hundreds of times today's; the opened
	// sea then takes up part of it
	const peak = r[r.indexOf(thaw) - 1];
	expect(peak.ppm).toBeGreaterThan(100_000);
	expect(thaw.ppm).toBeLessThan(peak.ppm);
	expect(thaw.ppm).toBeGreaterThan(peak.ppm / 3);
	expect(toC(thaw.k)).toBeGreaterThan(30);
	expect(r.at(-1)!.ppm).toBeLessThan(thaw.ppm / 2);
	expect(r.at(-1)!.frozen).toBe(false);
	// with half the volcanoes it takes about twice as long
	const slow = firstSwitch(run({ sun: 0.94, frozen: true, volcanoes: 0.5, years: 30e6 }))!;
	expect(slow.year / thaw.year).toBeGreaterThan(1.8);
	expect(slow.year / thaw.year).toBeLessThan(2.2);
});

test('without volcanoes the CO₂ is drawn down until the planet freezes, for good', () => {
	const r = run({ volcanoes: 0, years: 5e6 });
	const freeze = firstSwitch(r)!;
	expect(freeze.frozen).toBe(true);
	expect(freeze.year).toBeLessThan(1.5e6);
	expect(r.at(-1)!.frozen).toBe(true);
	expect(r.at(-1)!.ppm).toBeCloseTo(freeze.ppm, 3);
	expect(openEquilibrium(1, 0)).toBeNull();
});

test('moved outward, the planet keeps an open balance to about 1.1 AU and loses it beyond', () => {
	const near = openEquilibrium(sunlightAt(1.1), 1);
	expect(near).not.toBeNull();
	expect(near!.ppm).toBeGreaterThan(10 * P0);
	expect(openEquilibrium(sunlightAt(1.15), 1)).toBeNull();
	expect(openEquilibrium(sunlightAt(1.3), 1)).toBeNull();
	// livelier volcanoes push the limit outward
	expect(openEquilibrium(sunlightAt(1.15), 3)).not.toBeNull();
	expect(outerEdge(1)!).toBeCloseTo(1.13, 2);
	expect(outerEdge(3)!).toBeGreaterThan(outerEdge(1)!);
	expect(outerEdge(0)).toBeNull();
	// even feeble volcanoes find a balance close enough to the Sun
	expect(openEquilibrium(sunlightAt(0.98), 0.1)).not.toBeNull();
	expect(outerEdge(0.1)!).toBeGreaterThan(0.98);
});

test('a frozen planet with today’s air is a stable snowball near −45 °C', () => {
	expect(toC(frozenTemperature(P0))).toBeLessThan(-40);
	expect(toC(frozenTemperature(P0))).toBeGreaterThan(-50);
});
