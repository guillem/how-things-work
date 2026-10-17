/**
 * The model behind the stars explainer.
 *
 * Everything a star does here comes from published stellar models and catalogues:
 * - evolution tracks: MIST v1.2 at solar metallicity (`tracks.ts`, see its header);
 * - the last burning stages of a massive star, after the MIST tracks stop: Heger, Woosley,
 *   Fryer & Langer 2003, "Massive star evolution through the ages" (astro-ph/0211062), Table 1;
 * - which remnant a massive star leaves: the same paper, and Heger et al. 2003, ApJ 591, 288;
 * - where each element was made: Johnson 2017 (`origins.ts`);
 * - the real stars on the HR diagram: Gaia within 50 pc (`nearby.ts`).
 * The colour of a star is the colour of a black body at its surface temperature, computed with
 * the CIE 2012 colour-matching functions from the vision-color explainer.
 */
import { tracks as TRACKS, grid as GRID, stages } from './tracks';
import { origins as ORIGINS } from './origins';
import { blackBody, cssColour, exposureFor, response } from '../vision-color/colour';

// ------------------------------------------------------------------ constants

/** Nominal solar values (IAU 2015 Resolution B3). */
export const L_SUN = 3.828e26; // W
const R_SUN = 6.957e8; // m
export const T_SUN = 5772; // K
const M_SUN = 1.98841e30; // kg
export const C = 299_792_458; // m/s
const YEAR = 3.15576e7; // s (Julian year)
/** Age of the Sun (Bouvier & Wadhwa 2010) and of the universe (Planck 2018), years. */
export const SUN_AGE = 4.57e9;
export const UNIVERSE_AGE = 13.8e9;
/** One astronomical unit in solar radii (Earth's orbit). */
export const AU_IN_RSUN = 149_597_870.7e3 / R_SUN;

/** Fraction of the mass of four hydrogen nuclei turned into energy when they become helium. */
export const FUSION_MASS_FRACTION = (4 * 1.007825 - 4.002603) / (4 * 1.007825);

// ------------------------------------------------------------------ tracks

export interface Track {
	/** Initial mass, M☉. */
	initial: number;
	age: readonly number[];
	M: readonly number[];
	logL: readonly number[];
	logT: readonly number[];
	logR: readonly number[];
	heCore: readonly number[];
	cCore: readonly number[];
	xH: readonly number[];
	xHe: readonly number[];
	xC: readonly number[];
	xO: readonly number[];
	xNe: readonly number[];
	logTc: readonly number[];
	logRhoc: readonly number[];
	logLH: readonly number[];
	logLHe: readonly number[];
	logLZ: readonly number[];
	phase: readonly number[];
}

const tracks: readonly Track[] = TRACKS;
export const TRACK_MASSES = tracks.map((t) => t.initial);

export function track(mass: number): Track {
	let best = tracks[0];
	for (const t of tracks)
		if (Math.abs(Math.log(t.initial / mass)) < Math.abs(Math.log(best.initial / mass))) best = t;
	return best;
}

/** Row index where each stage starts: the rows are evenly spread within each stage. */
export const STAGE = stages;

export const lastIndex = (t: Track) => t.age.length - 1;

/** One moment of a track, at a fractional row index (linear between rows). */
interface Moment {
	index: number;
	age: number;
	M: number;
	L: number;
	T: number;
	R: number;
	logL: number;
	logT: number;
	heCore: number;
	cCore: number;
	xH: number;
	xHe: number;
	xC: number;
	xO: number;
	xNe: number;
	Tc: number;
	rhoc: number;
	logLH: number;
	logLHe: number;
	logLZ: number;
	phase: number;
}

export function at(t: Track, index: number): Moment {
	const n = lastIndex(t);
	const x = Math.min(n, Math.max(0, index));
	const i = Math.min(n - 1, Math.floor(x));
	const u = n === 0 ? 0 : x - i;
	const f = (a: readonly number[]) => a[i] + u * (a[i + 1] - a[i]);
	const logL = f(t.logL);
	const logT = f(t.logT);
	return {
		index: x,
		age: f(t.age),
		M: f(t.M),
		L: 10 ** logL,
		T: 10 ** logT,
		R: 10 ** f(t.logR),
		logL,
		logT,
		heCore: f(t.heCore),
		cCore: f(t.cCore),
		xH: f(t.xH),
		xHe: f(t.xHe),
		xC: f(t.xC),
		xO: f(t.xO),
		xNe: f(t.xNe),
		Tc: 10 ** f(t.logTc),
		rhoc: 10 ** f(t.logRhoc),
		logLH: f(t.logLH),
		logLHe: f(t.logLHe),
		logLZ: f(t.logLZ),
		phase: t.phase[u < 0.5 ? i : i + 1]
	};
}

/** The moment of a track at a given age (years since the star began to form). */
export function atAge(t: Track, age: number): Moment {
	const a = t.age;
	if (age <= a[0]) return at(t, 0);
	for (let i = 1; i < a.length; i++)
		if (a[i] >= age) return at(t, i - 1 + (age - a[i - 1]) / (a[i] - a[i - 1]));
	return at(t, lastIndex(t));
}

// ------------------------------------------------------------------ what is burning

type Fuel = 'H' | 'He' | 'C';
interface Burning {
	/** What the centre is fusing, if anything. */
	core: Fuel | null;
	/** Hydrogen burning in a shell round a helium core. */
	hShell: boolean;
	/** Helium burning in a shell round a carbon–oxygen core. */
	heShell: boolean;
}

/**
 * Which fuels are burning where, read off the model: the central abundances say what is left
 * at the centre, the luminosities from hydrogen, helium and heavier burning say where energy
 * is being made. A source counts when it makes at least 3% of the star's light (5% for carbon,
 * whose luminosity column also holds the helium-burning captures that turn carbon into oxygen).
 */
export function burning(m: Moment): Burning {
	const strong = (logLx: number, share: number) => logLx > m.logL + Math.log10(share);
	const coreH = m.xH > 1e-4 && strong(m.logLH, 0.03);
	const coreHe = !coreH && m.xHe > 1e-3 && m.xH < 1e-3 && strong(m.logLHe, 0.03);
	const coreC = !coreH && !coreHe && m.xHe < 1e-3 && m.Tc > 6e8 && strong(m.logLZ, 0.05);
	return {
		core: coreH ? 'H' : coreHe ? 'He' : coreC ? 'C' : null,
		hShell: m.xH < 1e-3 && m.heCore > 0 && strong(m.logLH, 0.03),
		heShell: m.xHe < 1e-3 && m.cCore > 0 && strong(m.logLHe, 0.03)
	};
}

export const FUEL_PRODUCTS: Record<Fuel, string> = {
	H: 'hydrogen → helium',
	He: 'helium → carbon, oxygen',
	C: 'carbon → neon, magnesium'
};

/** A plain name for the stage a star is in. */
export function stageName(t: Track, m: Moment): string {
	const b = burning(m);
	const massive = t.initial >= 8;
	if (m.phase === 0) return 'main sequence';
	if (m.phase === 9) return 'Wolf–Rayet star';
	if (b.core === 'He') return massive ? 'supergiant, burning helium' : 'giant, burning helium';
	if (b.core === 'C') return 'supergiant, burning carbon';
	if (m.phase === 2) return massive ? 'becoming a supergiant' : 'red giant';
	if (m.phase === 3) return m.xHe > 0.5 ? 'helium flash' : 'giant, burning helium';
	if (m.phase === 4 || m.phase === 5) return massive ? 'red supergiant' : 'asymptotic giant';
	if (m.phase === 6) {
		if (m.R > 1) return 'shedding its envelope';
		return m.L > 10 ? 'planetary nebula' : 'white dwarf';
	}
	return 'giant';
}

// ------------------------------------------------------------------ fates

type Fate = 'not-yet' | 'white-dwarf' | 'neutron-star' | 'black-hole';

/**
 * How a star of this initial mass ends, for a single star of solar composition. Below about
 * 8 M☉ the MIST tracks themselves end on the white-dwarf cooling track (the white dwarf's mass
 * is the model's final mass). Above, the tracks stop after carbon burning and the outcome is
 * taken from Heger et al. (2003): up to about 20–25 M☉ the core collapses to a neutron star
 * in a supernova; above, enough of the star falls back that the remnant becomes a black hole.
 * Both boundaries are uncertain, and stars in close pairs can end differently.
 */
export function fate(mass: number): { kind: Fate; remnant: number | null } {
	const t = track(mass);
	const n = lastIndex(t);
	if (t.age[n] > UNIVERSE_AGE && t.phase[n] <= 2) return { kind: 'not-yet', remnant: null };
	if (mass < 8) return { kind: 'white-dwarf', remnant: t.M[n] };
	if (mass <= 22) return { kind: 'neutron-star', remnant: 1.4 };
	return { kind: 'black-hole', remnant: t.heCore[n] };
}

/**
 * The last burning stages of a 20 M☉ star of solar composition (Heger et al. 2003, Table 1):
 * fuel, main products, central temperature (K) and duration (years). The MIST tracks follow
 * the first three; neon, oxygen and silicon burning take too little time to change what the
 * star looks like from outside.
 */
export const BURNING_STAGES = [
	{ fuel: 'hydrogen', products: 'helium', T: 3.7e7, years: 8.1e6 },
	{ fuel: 'helium', products: 'oxygen, carbon', T: 1.9e8, years: 1.2e6 },
	{ fuel: 'carbon', products: 'neon, magnesium', T: 8.7e8, years: 980 },
	{ fuel: 'neon', products: 'oxygen, magnesium', T: 1.6e9, years: 0.6 },
	{ fuel: 'oxygen', products: 'silicon, sulfur', T: 2.0e9, years: 1.3 },
	{ fuel: 'silicon', products: 'iron', T: 3.3e9, years: 0.031 }
] as const;

// ------------------------------------------------------------------ the main sequence

interface GridPoint {
	mass: number;
	/** [age (yr), log L, log Teff, log R] at the zero-age and terminal-age main sequence. */
	zams: readonly [number, number, number, number];
	tams: readonly [number, number, number, number];
	/** log L (L☉) of the pp chain and of the CNO cycle halfway through the main sequence. */
	midPp: number;
	midCno: number;
}
export const grid: readonly GridPoint[] = GRID;

function gridInterp(mass: number, f: (g: GridPoint) => number): number {
	const lm = Math.log10(mass);
	if (mass <= grid[0].mass) return f(grid[0]);
	for (let i = 1; i < grid.length; i++) {
		const b = grid[i];
		if (b.mass >= mass) {
			const a = grid[i - 1];
			const u = (lm - Math.log10(a.mass)) / (Math.log10(b.mass) - Math.log10(a.mass));
			return f(a) + u * (f(b) - f(a));
		}
	}
	return f(grid[grid.length - 1]);
}

/** A newly formed star of this mass, on the zero-age main sequence. */
export function zams(mass: number) {
	const logL = gridInterp(mass, (g) => g.zams[1]);
	const logT = gridInterp(mass, (g) => g.zams[2]);
	const logR = gridInterp(mass, (g) => g.zams[3]);
	return { mass, logL, logT, L: 10 ** logL, T: 10 ** logT, R: 10 ** logR };
}

/** Time spent on the main sequence (zero age to hydrogen exhaustion), years. */
export function mainSequenceLifetime(mass: number): number {
	return 10 ** gridInterp(mass, (g) => Math.log10(g.tams[0] - g.zams[0]));
}

/** Mean luminosity on the main sequence (average of its start and end), L☉. */
export function meanMainSequenceLuminosity(mass: number): number {
	return gridInterp(mass, (g) => (10 ** g.zams[1] + 10 ** g.tams[1]) / 2);
}

/**
 * The estimate behind "lifetime ∝ M/L": the time to turn a fraction `burnt` of the star's mass
 * from hydrogen into helium, releasing 0.7% of it as energy, at luminosity L. Years.
 */
export function fuelLifetime(mass: number, L: number, burnt = 0.1): number {
	return (burnt * FUSION_MASS_FRACTION * mass * M_SUN * C * C) / (L * L_SUN) / YEAR;
}

/** Whether the CNO cycle makes more energy than the pp chain halfway through the main sequence. */
export function cnoDominates(mass: number): boolean {
	return gridInterp(mass, (g) => g.midCno - g.midPp) > 0;
}

// ------------------------------------------------------------------ colour

const COLOUR_CACHE = new Map<number, string>();
/** The colour of a black body at T kelvin, at a fixed brightness (so only its hue shows). */
export function starColour(T: number): string {
	const key = Math.round(Math.log10(Math.min(2e5, Math.max(2000, T))) * 50) / 50;
	let c = COLOUR_CACHE.get(key);
	if (!c) {
		const cones = response(blackBody(10 ** key));
		c = cssColour(cones, exposureFor(cones, 0.96));
		COLOUR_CACHE.set(key, c);
	}
	return c;
}

// ------------------------------------------------------------------ origins of the elements

export type Source = 'bigBang' | 'cosmicRays' | 'lowMass' | 'massive' | 'whiteDwarfs' | 'mergers';
export const SOURCES: readonly Source[] = [
	'bigBang',
	'cosmicRays',
	'lowMass',
	'massive',
	'whiteDwarfs',
	'mergers'
];
export const SOURCE_NAMES: Record<Source, string> = {
	bigBang: 'Big Bang',
	cosmicRays: 'cosmic rays',
	lowMass: 'dying low-mass stars',
	massive: 'exploding massive stars',
	whiteDwarfs: 'exploding white dwarfs',
	mergers: 'merging neutron stars'
};

interface Origin {
	z: number;
	symbol: string;
	synthetic: boolean;
	shares: Partial<Record<Source, number>>;
}
export const origins: readonly Origin[] = ORIGINS;
export const origin = (z: number) => origins[z - 1];

/** The source that made most of an element's atoms (null for elements with no stable isotopes). */
export function mainSource(z: number): Source | null {
	const o = origin(z);
	let best: Source | null = null;
	for (const s of SOURCES) if ((o.shares[s] ?? 0) > (best ? (o.shares[best] ?? 0) : 0)) best = s;
	return best;
}

/** Share of an element's atoms made by stars (in their lives, explosions and collisions). */
export function madeInStars(z: number): number {
	const s = origin(z).shares;
	return (s.lowMass ?? 0) + (s.massive ?? 0) + (s.whiteDwarfs ?? 0) + (s.mergers ?? 0);
}

/**
 * Elements in the human body, share of its mass: ICRP Publication 23 (1975), "Reference Man"
 * (a 70 kg adult); the rest (0.9%) is spread over many elements.
 */
export const BODY: readonly { z: number; share: number }[] = [
	{ z: 8, share: 0.61 },
	{ z: 6, share: 0.23 },
	{ z: 1, share: 0.1 },
	{ z: 7, share: 0.026 },
	{ z: 20, share: 0.014 },
	{ z: 15, share: 0.011 }
];

/** Share of the body's mass in each source, for the elements listed in BODY. */
export function bodyBySource(): Record<Source, number> {
	const out = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
	for (const { z, share } of BODY)
		for (const s of SOURCES) out[s] += share * (origin(z).shares[s] ?? 0);
	return out;
}

// ------------------------------------------------------------------ formatting

export function years(y: number): string {
	if (y >= 1e12) return `${Number((y / 1e12).toPrecision(2))} trillion years`;
	if (y >= 1e9) return `${(y / 1e9).toFixed(y >= 1e10 ? 0 : 1)} billion years`;
	if (y >= 1e6) return `${(y / 1e6).toFixed(y >= 1e7 ? 0 : 1)} million years`;
	if (y >= 1e4) return `${Math.round(y / 1e3).toLocaleString('en-US')} thousand years`;
	if (y >= 2) return `${Math.round(y).toLocaleString('en-US')} years`;
	if (y >= 1 / 12) return `${Math.round(y * 12)} months`;
	return `${Math.round(y * 365.25)} days`;
}

/** A number with about two significant figures, grouped: 0.0042, 0.75, 18, 46,000. */
export function round2(v: number): string {
	if (v === 0) return '0';
	const d = Math.floor(Math.log10(Math.abs(v)));
	const r = Number(v.toPrecision(2));
	return d >= 3 ? r.toLocaleString('en-US') : String(Number(r.toFixed(Math.max(0, 1 - d))));
}
