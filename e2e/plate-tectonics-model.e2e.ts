// Checks the models behind the plate-tectonics explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BREAKUP_BETA,
	CONTINENT_ELEVATION,
	RIFT_WIDTH,
	airyElevation,
	feature,
	lithosphereThickness,
	mckenzieSubsidence,
	oceanDepth,
	section,
	type Crust,
	type SectionInput
} from '../src/routes/plate-tectonics/section';
import {
	PLATES,
	QUOTED,
	EARTH_RADIUS,
	areaFractionNear,
	distanceToBoundary,
	fractionNear,
	meanAlong,
	quakes,
	settingShares,
	volcanoes
} from '../src/routes/plate-tectonics/globe';

const at = (left: Crust, right: Crust, normal: number, slide = 0, speed = 5): SectionInput => ({
	left,
	right,
	normal,
	slide,
	speed
});
const surfaceAt = (s: ReturnType<typeof section>, x: number) =>
	s.columns.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));

test('sea floor deepens with age as it cools (GDH1), and its lithosphere thickens', () => {
	expect(oceanDepth(0)).toBeCloseTo(2.6, 2); // ridge crests ~2.5–2.7 km deep
	expect(oceanDepth(100)).toBeGreaterThan(5.3);
	expect(oceanDepth(100)).toBeLessThan(5.7);
	for (let t = 1; t < 150; t += 7) expect(oceanDepth(t + 7)).toBeGreaterThan(oceanDepth(t));
	// GDH1 is continuous at 20 Myr.
	expect(Math.abs(oceanDepth(19.999) - oceanDepth(20.001))).toBeLessThan(0.03);
	// Half-space cooling: ~100 km of lithosphere at 60 Myr, ∝ √age.
	expect(lithosphereThickness(60)).toBeGreaterThan(95);
	expect(lithosphereThickness(60)).toBeLessThan(105);
	expect(lithosphereThickness(40) / lithosphereThickness(10)).toBeCloseTo(2, 5);
});

test('isostasy: doubling the crust to 70 km lifts it about 5 km, over a root 5.6 times deeper', () => {
	expect(airyElevation(70) - airyElevation(35)).toBeCloseTo(35 * (1 - 2.8 / 3.3), 6);
	expect(airyElevation(70)).toBeGreaterThan(5);
	expect(airyElevation(70)).toBeLessThan(6.5);
	const flat = section(at('continent', 'continent', 0));
	const peak = section(at('continent', 'continent', -800));
	const rise = surfaceAt(peak, 0).z - surfaceAt(flat, 0).z;
	const root = surfaceAt(flat, 0).moho - surfaceAt(peak, 0).moho;
	expect(root / rise).toBeCloseTo(2.8 / (3.3 - 2.8), 6);
});

test('stretching a rift (McKenzie): subsidence grows as 1 − 1/β, about 2 km for β = 2', () => {
	expect(mckenzieSubsidence(1)).toBeCloseTo(0, 9);
	expect(mckenzieSubsidence(2)).toBeGreaterThan(1.7);
	expect(mckenzieSubsidence(2)).toBeLessThan(2.5);
	expect(mckenzieSubsidence(4) / mckenzieSubsidence(2)).toBeCloseTo(0.75 / 0.5, 6);
});

test('it takes 20 million years to move 1000 km at 5 cm a year', () => {
	expect(section(at('ocean', 'ocean', 1000)).myr).toBeCloseTo(20, 6);
	expect(section(at('ocean', 'ocean', 0, 1000, 2)).myr).toBeCloseTo(50, 6);
});

test('ocean meets continent: the ocean plate sinks into a deep trench, volcanoes rise inland', () => {
	for (const [left, right, side] of [
		['ocean', 'continent', 'left'],
		['continent', 'ocean', 'right']
	] as const) {
		const s = section(at(left, right, -800));
		expect(s.kind).toBe('subduction');
		expect(s.slab?.side).toBe(side);
		const trench = feature(s, 'trench')!;
		expect(trench.value).toBeGreaterThan(7); // ocean trenches are 7–11 km deep
		expect(trench.value).toBeLessThan(11);
		// The page: "typically 100–300 km inland"; the model's arc sits 150–300 km from the trench, on the continent, above the slab at ~100 km.
		const arc = s.volcanoes.find((v) => v.kind === 'arc')!;
		expect(Math.abs(arc.x)).toBeGreaterThan(150);
		expect(Math.abs(arc.x)).toBeLessThan(300);
		expect(Math.sign(arc.x)).toBe(side === 'left' ? 1 : -1);
		expect(arc.top).toBeGreaterThan(CONTINENT_ELEVATION + 2);
		// Earthquakes follow the sinking plate deep into the mantle.
		expect(Math.min(...s.quakes.map((q) => q.z))).toBeLessThan(-200);
	}
});

test('the arc needs the plate to reach ~100 km: no volcanoes when subduction has just begun', () => {
	expect(section(at('ocean', 'continent', -80)).volcanoes).toHaveLength(0);
	expect(section(at('ocean', 'continent', -600)).volcanoes.length).toBeGreaterThan(0);
});

test('two ocean plates: the older one sinks, and the volcanoes grow into an island arc', () => {
	const s = section(at('ocean', 'ocean', -800));
	expect(s.slab?.side).toBe('left'); // the left plate's sea floor is older
	const arc = s.volcanoes.find((v) => v.kind === 'arc')!;
	expect(arc.base).toBeLessThan(-3); // it starts on the sea floor…
	expect(arc.top).toBeGreaterThan(0); // …and breaks the surface
});

test('two continents: mountains and earthquakes, but nothing sinks and there are no volcanoes', () => {
	const s = section(at('continent', 'continent', -800));
	expect(s.kind).toBe('collision');
	expect(s.slab).toBeNull();
	expect(s.volcanoes).toHaveLength(0);
	expect(feature(s, 'mountains')!.value).toBeGreaterThan(5);
	expect(s.quakes.length).toBeGreaterThan(5);
	expect(Math.min(...s.quakes.map((q) => q.z))).toBeGreaterThan(-80);
});

test('a mid-ocean ridge: new sea floor, youngest and shallowest at the crest', () => {
	const slow = section(at('ocean', 'ocean', 600, 0, 2));
	const fast = section(at('ocean', 'ocean', 600, 0, 15));
	expect(slow.kind).toBe('ridge');
	expect(feature(fast, 'ridge')!.value).toBeCloseTo(2.6, 1);
	// Age = distance ÷ half the spreading rate: 300 km at 1 cm/yr (half of 2) is 30 Myr.
	expect(surfaceAt(slow, 300).age).toBeCloseTo(30, 6);
	expect(surfaceAt(slow, 300).z).toBeCloseTo(-oceanDepth(30), 6);
	// A fast ridge makes a broad rise; a slow one a narrow ridge with a valley along its crest.
	expect(surfaceAt(fast, 300).z).toBeGreaterThan(surfaceAt(slow, 300).z + 1);
	expect(surfaceAt(slow, 0).z).toBeLessThan(surfaceAt(slow, 30).z);
	expect(slow.volcanoes.map((v) => v.kind)).toEqual(['ridge']);
	expect(Math.min(...slow.quakes.map((q) => q.z))).toBeGreaterThan(-15);
});

test('a continent pulled apart: a rift valley, then a new ocean once the crust breaks', () => {
	const early = section(at('continent', 'continent', 40));
	expect(early.kind).toBe('rift');
	expect(early.beta).toBeCloseTo((RIFT_WIDTH + 40) / RIFT_WIDTH, 6);
	// The valley floor drops between its shoulders.
	expect(feature(early, 'rift')!.z).toBeLessThan(surfaceAt(early, 100).z - 0.5);
	// The page's East Africa stage: a dry rift valley with volcanoes, held up by its dome
	// (the step opens at 100 km).
	const young = section(at('continent', 'continent', 100));
	expect(feature(young, 'rift')!.z).toBeGreaterThan(0);
	expect(young.volcanoes.filter((v) => v.kind === 'rift')).toHaveLength(2);
	// "Keep pulling. The valley floor sinks below sea level": the Red Sea stage, before break-up.
	const breakAt = RIFT_WIDTH * (BREAKUP_BETA - 1);
	const late = section(at('continent', 'continent', breakAt - 1));
	expect(late.kind).toBe('rift');
	expect(feature(late, 'rift')!.z).toBeLessThan(0);
	const ocean = section(at('continent', 'continent', breakAt + 400));
	expect(ocean.kind).toBe('young-ocean');
	expect(ocean.newOcean).toBeCloseTo(400, 6);
	expect(surfaceAt(ocean, 0).crust).toBe('new-ocean');
	expect(surfaceAt(ocean, 800).crust).toBe('continent');
});

test('plates sliding past each other: shallow earthquakes, no volcanoes, nothing made or lost', () => {
	const still = section(at('ocean', 'continent', 0));
	const slid = section(at('ocean', 'continent', 0, 300));
	expect(slid.kind).toBe('transform');
	expect(slid.volcanoes).toHaveLength(0);
	expect(slid.quakes.length).toBeGreaterThan(5);
	expect(Math.min(...slid.quakes.map((q) => q.z))).toBeGreaterThan(-25);
	expect(slid.slab).toBeNull();
	expect(slid.newOcean).toBe(0);
	slid.columns.forEach((c, i) => expect(c.crust).toBe(still.columns[i].crust));
});

// ------------------------------------------------------------------ the real data

test('the 52 plates of PB2002 tile the whole Earth', () => {
	expect(new Set(PLATES.map((p) => p.code)).size).toBe(52);
	const total = PLATES.reduce((s, p) => s + p.km2, 0);
	expect(total / (4 * Math.PI * EARTH_RADIUS ** 2)).toBeCloseTo(1, 3);
	expect(PLATES[0].name).toBe('Pacific');
});

test('most big earthquakes happen in a narrow band along the plate boundaries', () => {
	expect(quakes.length).toBe(4516); // M ≥ 5.5, 2015–2024: the number the page quotes
	// The page: "86% … within 200 km of a plate boundary, a band covering 17% of the surface".
	expect(Math.round(fractionNear(quakes, 200) * 100)).toBe(QUOTED.quakesWithin200km * 100);
	expect(Math.round(areaFractionNear(200) * 100)).toBe(QUOTED.areaWithin200km * 100);
	// And the deep ones (> 300 km) lie within 1000 km of a subduction zone, down to ~700 km.
	const deep = quakes.filter((q) => q.depth > 300);
	expect(deep.length).toBeGreaterThan(200);
	expect(fractionNear(deep, 1000, ['subduction'])).toBeGreaterThan(0.99);
	expect(Math.max(...quakes.map((q) => q.depth))).toBeGreaterThan(650);
	expect(Math.max(...quakes.map((q) => q.depth))).toBeLessThan(720);
});

test('volcanoes: most at subduction zones and rifts, a few in the middle of plates', () => {
	const s = settingShares();
	expect(volcanoes.length).toBe(1214); // the page: "the 1,214 volcanoes active since…"
	expect(s.total).toBeGreaterThan(1200);
	// The page: "69% … subduction zones, 18% … rifts, 12% … in the middle of a plate".
	expect(Math.round(s.subduction * 100)).toBe(69);
	expect(Math.round(s.rift * 100)).toBe(18);
	expect(Math.round(s.intraplate * 100)).toBe(12);
	// The page: "79% … within 300 km of a plate boundary".
	expect(Math.round(fractionNear(volcanoes, 300) * 100)).toBe(QUOTED.volcanoesWithin300km * 100);
	// The page: Hawaii is "more than 3,000 km from the nearest plate edge".
	expect(distanceToBoundary(-155.3, 19.4)).toBeGreaterThan(3000);
});

test('plate speeds: the Mid-Atlantic Ridge spreads slowly, the East Pacific Rise fast', () => {
	const mar = ['NA-EU', 'EU-NA', 'SA-AF', 'AF-SA', 'NA-AF', 'AF-NA'];
	const epr = ['PA-NZ', 'NZ-PA', 'PA-AN', 'AN-PA', 'PA-CO', 'CO-PA'];
	const rate = (names: string[]) =>
		meanAlong(
			(l) => l.cls === 'OSR' && names.includes(l.name),
			(l) => l.divergent
		) / 10; // cm/yr
	expect(rate(mar)).toBeGreaterThan(2);
	expect(rate(mar)).toBeLessThan(3); // ~2.5 cm/yr
	expect(rate(epr)).toBeGreaterThan(8);
	expect(rate(epr)).toBeLessThan(12); // ~10 cm/yr
});

test('plate speeds quoted on the page: San Andreas ~4.5 cm/yr, Nazca under South America ~7 cm/yr', () => {
	const california = (pts: [number, number][]) =>
		pts.some(([lo, la]) => la > 32 && la < 40 && lo > -125 && lo < -114);
	const sanAndreas = meanAlong(
		(l) => l.group === 'transform' && california(l.pts),
		(l) => l.speed
	);
	expect(Math.round(sanAndreas / 5) * 5).toBe(45); // mm/yr
	const nazca = -meanAlong(
		(l) => l.name === 'NZ\\SA',
		(l) => l.divergent
	);
	expect(Math.round(nazca / 10)).toBe(7); // cm/yr
});
