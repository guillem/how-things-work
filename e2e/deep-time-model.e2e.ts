// Checks the deep-time model against its sources: the plate model's reconstructions against the
// GPlates Web Service, the time scale against the ICS chart, the records against the numbers
// their papers quote, radiometric dating and the calendar-year figures the page quotes. Node only.
import { expect, test } from '@playwright/test';
import {
	EARTH_AGE,
	EONS,
	ERAS,
	EXTINCTIONS,
	LIFE,
	OXYGEN_PEAK,
	PERIODS,
	PRECAMBRIAN_O2,
	TEMPERATURE_EXTREMES,
	TEMPERATURE_START,
	YEARS_PER_SECOND,
	ageFromRatio,
	ageText,
	calendarText,
	leadPerUranium,
	oxygenAt,
	placeIn,
	secondsBeforeMidnight,
	sunBrightness,
	temperatureAt,
	toCalendar,
	uraniumLeft
} from '../src/routes/deep-time/deeptime';
import {
	MAX_MA,
	distanceKm,
	landAt,
	reconstruct,
	type LonLat
} from '../src/routes/deep-time/globe';

const BRAZIL: LonLat = [-35.88, -7.23]; // Campina Grande, Brazil
const GABON: LonLat = [10.24, -0.7]; // Lambaréné, Gabon
const PARIS: LonLat = [2.35, 48.86];
const SYDNEY: LonLat = [151.2, -33.87];

test('reconstructed places match the GPlates Web Service (MERDITH2021) to within 150 km', () => {
	// gws.gplates.org/reconstruct/reconstruct_points/?points=…&time=…&model=MERDITH2021,
	// queried on 2026-10-14
	const reference: [LonLat, number, LonLat][] = [
		[BRAZIL, 150, [5.9847, -11.5768]],
		[GABON, 150, [4.176, -16.1021]],
		[PARIS, 150, [31.2325, 30.1437]],
		[SYDNEY, 150, [151.1447, -76.0723]],
		[BRAZIL, 250, [1.7573, -22.5633]],
		[GABON, 250, [-0.2891, -27.048]],
		[PARIS, 250, [25.6991, 18.6045]],
		[SYDNEY, 250, [152.7527, -70.3051]],
		[BRAZIL, 600, [54.0296, -49.8485]],
		[GABON, 600, [61.4965, -50.7646]],
		[PARIS, 600, [7.0528, -19.1893]]
	];
	for (const [p, age, ref] of reference) {
		const r = reconstruct(p, age);
		expect(r, `${p.join(', ')} at ${age} Ma`).not.toBeNull();
		expect(distanceKm(r!, ref), `${p.join(', ')} at ${age} Ma`).toBeLessThan(150);
	}
	// today, every place is where it is
	expect(distanceKm(reconstruct(PARIS, 0)!, PARIS)).toBeLessThan(1);
});

test('Brazil and Gabon were neighbours before the South Atlantic opened', () => {
	expect(distanceKm(BRAZIL, GABON)).toBeGreaterThan(5000);
	expect(distanceKm(reconstruct(BRAZIL, 150)!, reconstruct(GABON, 150)!)).toBeLessThan(800);
});

test('Paris lay in the tropics when Pangaea was together, and Sydney near the South Pole', () => {
	expect(Math.abs(reconstruct(PARIS, 250)![1])).toBeLessThan(23.5);
	expect(reconstruct(SYDNEY, 150)![1]).toBeLessThan(-66.5);
});

test('the map stops where the plate model stops: no continents before a billion years', () => {
	expect(MAX_MA).toBe(1000);
	expect(landAt(999).length).toBeGreaterThan(50);
	expect(landAt(1001)).toHaveLength(0);
	expect(landAt(0).length).toBeGreaterThan(landAt(999).length);
});

test('the time scale is the ICS chart, with no gaps from the Earth’s birth to today', () => {
	for (const list of [EONS, ERAS]) {
		const sorted = [...list].sort((a, b) => a.top - b.top);
		expect(sorted[0].top).toBe(0);
		for (let i = 1; i < sorted.length; i++) expect(sorted[i].top).toBe(sorted[i - 1].base);
	}
	expect(EONS.at(-1)!.base).toBe(EARTH_AGE);
	expect(ERAS.at(-1)!.base).toBe(4031); // the Hadean has no eras
	const p = placeIn(251.902 - 0.001);
	expect([p.period?.name, p.era?.name, p.eon?.name]).toEqual([
		'Triassic',
		'Mesozoic',
		'Phanerozoic'
	]);
	expect(placeIn(100).period?.name).toBe('Cretaceous');
	expect(placeIn(1).period?.name).toBe('Quaternary');
	// the Earth's first moment is in the Hadean, which has no eras or periods
	const first = placeIn(EARTH_AGE);
	expect([first.eon?.name, first.era, first.period]).toEqual(['Hadean', undefined, undefined]);
	expect(PERIODS.find((x) => x.name === 'Cambrian')?.base).toBe(538.8);
	expect(EXTINCTIONS.map((e) => e.age)).toEqual([443.1, 372.15, 251.902, 201.4, 66]);
});

test('PhanDA: 11–36 °C, hottest in the mid-Cretaceous, coldest just before the Holocene', () => {
	// Judd et al. 2024: GMST "spanned 11° to 36°C" over the past 485 million years
	expect(TEMPERATURE_EXTREMES.cold.p50).toBeCloseTo(11.4, 1);
	expect(TEMPERATURE_EXTREMES.cold.stage).toBe('Upper Pleistocene');
	expect(TEMPERATURE_EXTREMES.hot.p50).toBeCloseTo(35.6, 1);
	expect(TEMPERATURE_EXTREMES.hot.stage).toBe('Turonian');
	expect(temperatureAt(0)!.p50).toBeCloseTo(14, 0);
	expect(temperatureAt(0.005)!.stage).toBe('Holocene');
	expect(TEMPERATURE_START).toBeCloseTo(486.85, 2);
	expect(temperatureAt(500)).toBeNull();
});

test('oxygen: 5–10% in the Cambrian, over 25% around the Permian, 21% today', () => {
	// Mills et al. 2023: "around 5–10% of the atmosphere during the Cambrian", "a further peak of
	// greater than 25% in the Permo-Carboniferous"
	for (const age of [530, 510, 495]) {
		const o = oxygenAt(age)!;
		expect(o.mid).toBeGreaterThan(4);
		expect(o.mid).toBeLessThan(13.5);
	}
	expect(OXYGEN_PEAK[1]).toBeGreaterThan(25);
	expect(OXYGEN_PEAK[0]).toBeGreaterThan(251);
	expect(OXYGEN_PEAK[0]).toBeLessThan(320);
	expect(oxygenAt(0)!.mid).toBeCloseTo(20.6, 1);
	expect(oxygenAt(600)).toBeNull();
});

test('the disputed mid-Proterozoic oxygen box spans both published estimates', () => {
	// Planavsky et al. 2014: under 0.1% of today's level; Zhang et al. 2016: over 4%
	const box = PRECAMBRIAN_O2.find((b) => b.id === 'boring')!;
	expect(box.lo).toBeLessThan(1e-3);
	expect(box.hi).toBeGreaterThan(4e-2);
	expect([box.top, box.base]).toEqual([800, 1800]);
});

test('uranium-238 dating: half of an Earth-age crystal’s uranium has turned to lead', () => {
	expect(uraniumLeft(4468)).toBeCloseTo(0.5, 6);
	expect(uraniumLeft(EARTH_AGE)).toBeCloseTo(0.492, 3);
	// the oldest zircon (Wilde et al. 2001): almost one lead atom per uranium atom
	expect(leadPerUranium(4404)).toBeCloseTo(0.98, 2);
	expect(ageFromRatio(leadPerUranium(1234))).toBeCloseTo(1234, 6);
});

test('the young Sun was about 70% as bright as today', () => {
	expect(sunBrightness(EARTH_AGE)).toBeCloseTo(0.714, 3);
	expect(sunBrightness(0)).toBe(1);
	expect(sunBrightness(500)).toBeCloseTo(0.958, 3);
});

test('one calendar year: animals in November, humans in the last half-hour', () => {
	expect(YEARS_PER_SECOND).toBeCloseTo(144.8, 1);
	expect(calendarText(EARTH_AGE)).toBe('1 January');
	expect(calendarText(538.8)).toBe('18 November');
	expect(calendarText(3480)).toBe('28 March');
	expect(calendarText(66, true)).toBe('26 December, 17:24:17');
	expect(calendarText(0.315, true)).toBe('31 December, 23:23:44');
	const c = toCalendar(0.0115);
	expect([c.month, c.day, c.hour, c.minute]).toEqual([11, 31, 23, 58]);
	expect(secondsBeforeMidnight(0.0115)).toBeCloseTo(79.4, 1);
	expect(secondsBeforeMidnight(80e-6)).toBeCloseTo(0.55, 2); // an 80-year life
	expect(calendarText(0, true)).toBe('31 December, 24:00:00'); // midnight: today
	// the other dates the narrative quotes
	expect(calendarText(4404)).toBe('14 January'); // oldest zircon
	expect(calendarText(2430)).toBe('20 June'); // oxygen
	expect(toCalendar(1635).month).toBe(7); // complex cells, late August
	expect(toCalendar(1635).day).toBeGreaterThan(20);
	expect(calendarText(571)).toBe('16 November'); // first large animals
	expect(calendarText(230)).toBe('13 December'); // first dinosaurs
});

test('the shares of Earth’s history the narrative quotes', () => {
	const pct = (age: number) => (100 * age) / EARTH_AGE;
	expect(100 - pct(PERIODS.find((x) => x.name === 'Cambrian')!.base)).toBeCloseTo(88, 0); // Precambrian
	expect(pct(PERIODS.find((x) => x.name === 'Quaternary')!.base)).toBeCloseTo(0.06, 2); // ice ages
	expect(pct(LIFE.find((l) => l.id === 'sapiens')!.from)).toBeCloseTo(0.007, 3);
	// the oldest mammal relative, Kalaallitkigun (Sulej et al. 2020): mid–late Norian, about 215 Ma
	expect(LIFE.find((l) => l.id === 'mammals')!.from).toBe(215);
});

test('the groups of life are in the order of their first fossils', () => {
	for (let i = 1; i < LIFE.length; i++) expect(LIFE[i].from).toBeLessThan(LIFE[i - 1].from);
	// the takeaway: humans are a sliver of the whole
	const sapiens = LIFE.find((l) => l.id === 'sapiens')!;
	expect(sapiens.from / EARTH_AGE).toBeLessThan(1e-4);
	expect(ageText(0.315)).toBe('315,000 years ago');
	expect(ageText(4567)).toBe('4.57 billion years ago');
	expect(ageText(251.902)).toBe('252 million years ago');
});
