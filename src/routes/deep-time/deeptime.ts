/**
 * The model behind the deep-time explainer: the geological time scale (ICS International
 * Chronostratigraphic Chart v2024/12), the temperature and oxygen records (see `data/records.ts`),
 * what is known of the Precambrian air and ice ages, a dated list of life's major groups and
 * events (each with its source), radiometric dating with uranium-238, the Sun's slow brightening,
 * and the mapping of Earth's history onto one calendar year.
 *
 * Ages are in Ma (millions of years before the present) throughout.
 */
import { GMST, O2 } from './data/records';

// ------------------------------------------------------------------ the time scale

/**
 * Start of Earth's history, Ma: the age of the oldest solids of the Solar System (Connelly et al.
 * 2012, Science 338, 651: 4,567.30 ± 0.16 Ma), which the ICS chart uses as the base of the Hadean.
 */
export const EARTH_AGE = 4567;

export type Rank = 'eon' | 'era' | 'period';
export interface Unit {
	name: string;
	rank: Rank;
	/** Younger and older boundary, Ma. */
	top: number;
	base: number;
	/** The chart's colour (Commission for the Geological Map of the World). */
	color: string;
}

const u = (rank: Rank, name: string, top: number, base: number, color: string): Unit => ({
	name,
	rank,
	top,
	base,
	color
});

/** Eons, ICS chart v2024/12. */
export const EONS: Unit[] = [
	u('eon', 'Phanerozoic', 0, 538.8, '#9AD9DD'),
	u('eon', 'Proterozoic', 538.8, 2500, '#F73563'),
	u('eon', 'Archean', 2500, 4031, '#F0047F'),
	u('eon', 'Hadean', 4031, 4567, '#AE027E')
];

/** Eras, ICS chart v2024/12 (the Hadean has none). */
export const ERAS: Unit[] = [
	u('era', 'Cenozoic', 0, 66, '#F2F91D'),
	u('era', 'Mesozoic', 66, 251.902, '#67C5CA'),
	u('era', 'Paleozoic', 251.902, 538.8, '#99C08D'),
	u('era', 'Neoproterozoic', 538.8, 1000, '#FEB342'),
	u('era', 'Mesoproterozoic', 1000, 1600, '#FDB462'),
	u('era', 'Paleoproterozoic', 1600, 2500, '#F74370'),
	u('era', 'Neoarchean', 2500, 2800, '#F99BC1'),
	u('era', 'Mesoarchean', 2800, 3200, '#F768A9'),
	u('era', 'Paleoarchean', 3200, 3600, '#F444A9'),
	u('era', 'Eoarchean', 3600, 4031, '#DA037F')
];

/** Periods of the Neoproterozoic and the Phanerozoic, ICS chart v2024/12. */
export const PERIODS: Unit[] = [
	u('period', 'Quaternary', 0, 2.58, '#F9F97F'),
	u('period', 'Neogene', 2.58, 23.04, '#FFE619'),
	u('period', 'Paleogene', 23.04, 66, '#FD9A52'),
	u('period', 'Cretaceous', 66, 143.1, '#7FC64E'),
	u('period', 'Jurassic', 143.1, 201.4, '#34B2C9'),
	u('period', 'Triassic', 201.4, 251.902, '#812B92'),
	u('period', 'Permian', 251.902, 298.9, '#F04028'),
	u('period', 'Carboniferous', 298.9, 358.86, '#67A599'),
	u('period', 'Devonian', 358.86, 419.62, '#CB8C37'),
	u('period', 'Silurian', 419.62, 443.1, '#B3E1B6'),
	u('period', 'Ordovician', 443.1, 486.85, '#009270'),
	u('period', 'Cambrian', 486.85, 538.8, '#7FA056'),
	u('period', 'Ediacaran', 538.8, 635, '#FED96A'),
	u('period', 'Cryogenian', 635, 720, '#FECC5C'),
	u('period', 'Tonian', 720, 1000, '#FEBF4E')
];

/** The unit of a list that contains `age` (the younger one on a boundary). */
export const unitAt = (list: Unit[], age: number): Unit | undefined =>
	list.find((x) => age >= x.top && (age < x.base || (age === x.base && x.base === EARTH_AGE)));

/** "Cambrian period, Paleozoic era, Phanerozoic eon": the finest named units at `age`. */
export function placeIn(age: number): { eon?: Unit; era?: Unit; period?: Unit } {
	return { eon: unitAt(EONS, age), era: unitAt(ERAS, age), period: unitAt(PERIODS, age) };
}

// ------------------------------------------------------------------ temperature

export interface Temperature {
	stage: string;
	top: number;
	base: number;
	p05: number;
	p16: number;
	p50: number;
	p84: number;
	p95: number;
}

/** PhanDA's stages, youngest first. */
export const STAGES: Temperature[] = GMST.map(([stage, top, base, p05, p16, p50, p84, p95]) => ({
	stage,
	top,
	base,
	p05,
	p16,
	p50,
	p84,
	p95
}));

/** Oldest age with a temperature estimate (base of PhanDA's oldest stage), Ma. */
export const TEMPERATURE_START = STAGES[STAGES.length - 1].base;

/** Global mean surface temperature of the stage containing `age` (PhanDA), or null before it. */
export const temperatureAt = (age: number): Temperature | null =>
	STAGES.find((s) => age >= s.top && age < s.base) ?? (age === 0 ? STAGES[0] : null);

/** Warmest and coldest stages of the record (median estimate). */
export const TEMPERATURE_EXTREMES = (() => {
	let hot = STAGES[0];
	let cold = STAGES[0];
	for (const s of STAGES) {
		if (s.p50 > hot.p50) hot = s;
		if (s.p50 < cold.p50) cold = s;
	}
	return { hot, cold };
})();

/**
 * Ice ages before the temperature record, each with its source. The Precambrian has no global
 * temperature curve; these are the times when ice is known to have reached low latitudes.
 */
export const GLACIATIONS = [
	{
		id: 'paleoproterozoic',
		name: 'Ice ages during the rise of oxygen',
		top: 2220,
		base: 2430,
		source: 'Poulton et al. 2021, Nature 592, 232'
	},
	{
		id: 'sturtian',
		name: 'Sturtian “Snowball Earth”',
		top: 660,
		base: 717,
		source: 'Rooney et al. 2015, Geology 43, 459'
	},
	{
		id: 'marinoan',
		name: 'Marinoan “Snowball Earth”',
		top: 635,
		base: 639,
		source: 'Prave et al. 2016, Geology 44, 631 (at least 4 Myr, ending 635 Ma)'
	}
] as const;

/**
 * Brightness of the Sun `age` Ma ago relative to today (Gough 1981, Solar Physics 74, 21:
 * L/L☉ = 1 / (1 + 2/5 · (1 − t/t☉)), with t☉ the Sun's present age, here 4,567 Myr).
 */
export const sunBrightness = (age: number) =>
	1 / (1 + 0.4 * (Math.min(age, EARTH_AGE) / EARTH_AGE));

// ------------------------------------------------------------------ oxygen

/** Today's share of O₂ in dry air, % by volume. */
export const O2_TODAY = 20.95;

export interface Oxygen {
	/** % of the air by volume: best guess, and the ends of the uncertainty window. */
	mid: number;
	min: number;
	max: number;
}

/** Oldest age of the Phanerozoic oxygen curve, Ma. */
export const OXYGEN_START = O2[O2.length - 1][0];

/** Atmospheric O₂ at `age` (Mills et al. 2023, linearly interpolated), or null before the curve. */
export function oxygenAt(age: number): Oxygen | null {
	if (age < 0 || age > OXYGEN_START) return null;
	const i = Math.min(O2.length - 2, Math.floor(age));
	const [a0, m0, lo0, hi0] = O2[i];
	const [a1, m1, lo1, hi1] = O2[i + 1];
	const f = (age - a0) / (a1 - a0);
	return {
		mid: m0 + (m1 - m0) * f,
		min: lo0 + (lo1 - lo0) * f,
		max: hi0 + (hi1 - hi0) * f
	};
}

/** Highest best-guess O₂ of the curve, and when. */
export const OXYGEN_PEAK = O2.reduce((b, r) => (r[1] > b[1] ? r : b), O2[0]);

/**
 * What is known of O₂ before the Phanerozoic curve, as bounds in PAL (fractions of the present
 * atmospheric level). `lo`/`hi` are absent where the evidence gives no bound.
 */
export const PRECAMBRIAN_O2 = [
	{
		id: 'anoxic',
		top: 2430,
		base: EARTH_AGE,
		hi: 1e-5,
		text: 'less than 0.001% of today’s level',
		source: 'Pavlov & Kasting 2002, Astrobiology 2, 27; Poulton et al. 2021'
	},
	{
		id: 'goe',
		top: 2220,
		base: 2430,
		text: 'rising above 0.001% of today’s level and falling back, until about 2,220 Ma',
		source: 'Poulton et al. 2021, Nature 592, 232'
	},
	{
		id: 'boring',
		top: 800,
		base: 1800,
		lo: 1e-3,
		hi: 4e-2,
		text: 'disputed: estimates run from under 0.1% to over 4% of today’s level',
		source: 'Planavsky et al. 2014, Science 346, 635; Zhang et al. 2016, PNAS 113, 1731'
	},
	{
		id: 'oxic',
		top: OXYGEN_START,
		base: 2220,
		lo: 1e-5,
		text: 'permanently above 0.001% of today’s level',
		source: 'Poulton et al. 2021, Nature 592, 232'
	}
] as const;

// ------------------------------------------------------------------ life

export interface LifeGroup {
	id: string;
	name: string;
	/** First good fossil evidence, Ma. */
	from: number;
	/** Extinction, Ma (absent: still living). */
	to?: number;
	/** The evidence, for the readout. */
	evidence: string;
	source: string;
}

/** Life's major groups, oldest first, from the first widely accepted fossils. */
export const LIFE: LifeGroup[] = [
	{
		id: 'microbes',
		name: 'Single-celled life',
		from: 3480,
		evidence: 'microbial mats in hot springs, Dresser Formation, Australia',
		source: 'Djokic et al. 2017, Nature Communications 8, 15263'
	},
	{
		id: 'eukaryotes',
		name: 'Complex cells',
		from: 1635,
		evidence: 'many-celled filaments, Chuanlinggou Formation, China',
		source: 'Miao et al. 2024, Science Advances 10, eadk3208'
	},
	{
		id: 'animals',
		name: 'Animals',
		from: 571,
		evidence: 'large Ediacaran fossils, Newfoundland',
		source: 'Pu et al. 2016, Geology 44, 955'
	},
	{
		id: 'vertebrates',
		name: 'Fish (vertebrates)',
		from: 518,
		evidence: 'Myllokunmingia, Chengjiang, China (Early Cambrian, about 518 Ma)',
		source: 'Shu et al. 1999, Nature 402, 42'
	},
	{
		id: 'plants',
		name: 'Land plants',
		from: 472,
		evidence: 'spores of land plants, Argentina',
		source: 'Rubinstein et al. 2010, New Phytologist 188, 365'
	},
	{
		id: 'tetrapods',
		name: 'Four-legged animals',
		from: 390,
		evidence: 'footprints, Zachełmie, Poland',
		source: 'Niedźwiedzki et al. 2010, Nature 463, 43'
	},
	{
		id: 'dinosaurs',
		name: 'Dinosaurs',
		from: 230,
		to: 66,
		evidence: 'Eoraptor and kin, Ischigualasto, Argentina; birds are the survivors',
		source: 'Martinez et al. 2011, Science 331, 206'
	},
	{
		id: 'mammals',
		name: 'Mammals',
		from: 205.7,
		evidence: 'early mammal relatives of the Late Triassic',
		source: 'Sulej et al. 2020, PNAS 117, 26861'
	},
	{
		id: 'flowers',
		name: 'Flowering plants',
		from: 135,
		evidence: 'pollen of the Valanginian stage',
		source: 'Coiro et al. 2019, New Phytologist 223, 83'
	},
	{
		id: 'hominins',
		name: 'Human family',
		from: 7,
		evidence: 'Sahelanthropus, Chad, 6.8–7.2 Ma',
		source: 'Lebatard et al. 2008, PNAS 105, 3226'
	},
	{
		id: 'sapiens',
		name: 'Homo sapiens',
		from: 0.315,
		evidence: 'Jebel Irhoud, Morocco, 315,000 ± 34,000 years',
		source: 'Richter et al. 2017, Nature 546, 293'
	}
];

export interface LifeEvent {
	id: string;
	name: string;
	age: number;
	source: string;
}

/** Dated moments, oldest first (life groups have their own list). */
export const EVENTS: LifeEvent[] = [
	{ id: 'earth', name: 'The Earth forms', age: EARTH_AGE, source: 'Connelly et al. 2012; ICS' },
	{
		id: 'zircon',
		name: 'Oldest mineral grain',
		age: 4404,
		source: 'Wilde et al. 2001, Nature 409, 175'
	},
	{
		id: 'rocks',
		name: 'Oldest rocks',
		age: 4030,
		source: 'Wilde et al. 2001'
	},
	{ id: 'life', name: 'First life', age: 3480, source: 'Djokic et al. 2017' },
	{ id: 'oxygen', name: 'Oxygen in the air', age: 2430, source: 'Poulton et al. 2021' },
	{ id: 'eukaryotes', name: 'Complex cells', age: 1635, source: 'Miao et al. 2024' },
	{ id: 'snowball', name: 'Snowball Earth', age: 717, source: 'Rooney et al. 2015' },
	{ id: 'animals', name: 'First large animals', age: 571, source: 'Pu et al. 2016' },
	{ id: 'cambrian', name: 'Cambrian explosion', age: 538.8, source: 'ICS' },
	{ id: 'plants', name: 'Plants on land', age: 472, source: 'Rubinstein et al. 2010' },
	{ id: 'tetrapods', name: 'Animals walk on land', age: 390, source: 'Niedźwiedzki et al. 2010' },
	{ id: 'permian', name: 'The Great Dying', age: 251.9, source: 'Burgess et al. 2014' },
	{ id: 'dinosaurs', name: 'First dinosaurs', age: 230, source: 'Martinez et al. 2011' },
	{ id: 'flowers', name: 'First flowers', age: 135, source: 'Coiro et al. 2019' },
	{ id: 'kpg', name: 'Asteroid ends the dinosaurs', age: 66, source: 'Renne et al. 2013; ICS' },
	{ id: 'hominins', name: 'Human family', age: 7, source: 'Lebatard et al. 2008' },
	{ id: 'homo', name: 'Genus Homo', age: 2.8, source: 'Villmoare et al. 2015, Science 347, 1352' },
	{ id: 'sapiens', name: 'Homo sapiens', age: 0.315, source: 'Richter et al. 2017' },
	{
		id: 'farming',
		name: 'Farming begins',
		age: 0.0115,
		source: 'Zeder 2011, Current Anthropology 52, S221'
	},
	{
		id: 'writing',
		name: 'Writing',
		age: 0.0052,
		source: 'Mesopotamia, about 3200 BCE (general history)'
	},
	{
		id: 'industry',
		name: 'Industrial Revolution',
		age: 0.00026,
		source: 'Britain, 1760s (general history)'
	}
];

/** The "big five" mass extinctions (Raup & Sepkoski 1982), dated by the ICS chart. */
export const EXTINCTIONS = [
	{ id: 'ordovician', name: 'End-Ordovician', age: 443.1 },
	{ id: 'devonian', name: 'Late Devonian', age: 372.15 },
	{ id: 'permian', name: 'End-Permian, the “Great Dying”', age: 251.902 },
	{ id: 'triassic', name: 'End-Triassic', age: 201.4 },
	{ id: 'cretaceous', name: 'End-Cretaceous', age: 66 }
] as const;

// ------------------------------------------------------------------ dating

/** Half-life of uranium-238, Myr (NNDC NuDat 3: 4.468 × 10⁹ years). */
export const U238_HALF_LIFE = 4468;

/** Share of the uranium-238 a crystal started with that is left after `age` Myr. */
export const uraniumLeft = (age: number) => 2 ** (-age / U238_HALF_LIFE);

/**
 * Atoms of lead-206 per atom of uranium-238 in a crystal that formed `age` Myr ago with no lead
 * (every decayed uranium atom ends, after a chain of quick decays, as lead-206).
 */
export const leadPerUranium = (age: number) => 2 ** (age / U238_HALF_LIFE) - 1;

/** The age a measured lead-206/uranium-238 ratio gives, Myr. */
export const ageFromRatio = (ratio: number) => U238_HALF_LIFE * Math.log2(1 + ratio);

// ------------------------------------------------------------------ one calendar year

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
const YEAR_S = 365 * 86400;

/** Years of Earth's history per second of the calendar year. */
export const YEARS_PER_SECOND = (EARTH_AGE * 1e6) / YEAR_S;

export interface CalendarTime {
	/** 0–11. */
	month: number;
	/** 1–31. */
	day: number;
	hour: number;
	minute: number;
	second: number;
	/** Seconds from the start of the year. */
	t: number;
}

/** When `age` falls if Earth's history (4,567 Myr) is squeezed into one 365-day year. */
export function toCalendar(age: number): CalendarTime {
	const t = Math.max(0, Math.min(1, 1 - age / EARTH_AGE)) * YEAR_S;
	let day = Math.min(364, Math.floor(t / 86400));
	let month = 0;
	while (day >= DAYS_IN_MONTH[month]) day -= DAYS_IN_MONTH[month++];
	const s = t - Math.min(364, Math.floor(t / 86400)) * 86400;
	return {
		month,
		day: day + 1,
		hour: Math.floor(s / 3600),
		minute: Math.floor((s % 3600) / 60),
		second: Math.floor(s % 60),
		t
	};
}

const two = (n: number) => String(n).padStart(2, '0');

/** "18 November" or "31 December, 23:36:45". */
export function calendarText(age: number, withTime = false): string {
	const c = toCalendar(age);
	const date = `${c.day} ${MONTHS[c.month]}`;
	return withTime ? `${date}, ${two(c.hour)}:${two(c.minute)}:${two(c.second)}` : date;
}

/** How long before midnight on 31 December `age` falls, in calendar seconds. */
export const secondsBeforeMidnight = (age: number) => (age * 1e6) / YEARS_PER_SECOND;

// ------------------------------------------------------------------ zoom

/** The timeline's windows, from the whole history down to the last few thousand years. */
export const ZOOMS = [
	{ id: 'all', label: 'All of Earth’s history', span: EARTH_AGE },
	{ id: 'billion', label: 'The last billion years', span: 1000 },
	{ id: 'phanerozoic', label: 'Since the Cambrian', span: 538.8 },
	{ id: 'cenozoic', label: 'Since the dinosaurs', span: 66 },
	{ id: 'quaternary', label: 'The ice ages', span: 2.58 },
	{ id: 'sapiens', label: 'Our species', span: 0.4 },
	{ id: 'holocene', label: 'Since farming began', span: 0.012 }
] as const;
export type ZoomId = (typeof ZOOMS)[number]['id'];
export const zoomSpan = (id: string) => (ZOOMS.find((z) => z.id === id) ?? ZOOMS[0]).span;

// ------------------------------------------------------------------ wording

const n0 = (v: number) => Math.round(v).toLocaleString('en-GB');

/** "4.57 billion years ago", "251.9 million years ago", "315,000 years ago", "today". */
export function ageText(age: number): string {
	if (age <= 0) return 'today';
	if (age >= 1000) return `${(age / 1000).toFixed(2)} billion years ago`;
	if (age >= 100) return `${n0(age)} million years ago`;
	if (age >= 1) return `${age.toFixed(age >= 10 ? 0 : 1)} million years ago`;
	const years = age * 1e6;
	if (years >= 10000) return `${n0(Math.round(years / 1000) * 1000)} years ago`;
	if (years >= 1000) return `${n0(Math.round(years / 100) * 100)} years ago`;
	return `${n0(years)} years ago`;
}

/** Share of Earth's history since `age`, as a percentage string. */
export function shareText(age: number): string {
	const p = (age / EARTH_AGE) * 100;
	if (p <= 0) return '0%';
	if (p >= 10) return `${Math.round(p)}%`;
	if (p >= 1) return `${p.toFixed(1)}%`;
	const digits = Math.max(1, -Math.floor(Math.log10(p)));
	return `${p.toFixed(digits)}%`;
}
