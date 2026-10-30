/**
 * Salt on ice: the measured freezing point of salty water, and the heat that melting takes.
 *
 * Salt dissolved in water lowers the temperature at which that water freezes. Ice touching salty
 * water melts until the water is just dilute enough to freeze at the temperature it is at; then
 * melting and freezing balance. Two cases:
 *
 * - **A path** is held at the weather's temperature by the ground and the air, which supply the
 *   heat that melting needs. A gram of salt melts ice until the salty water has the saltiness
 *   that freezes at that temperature (`iceMeltedBy`).
 * - **A bowl** of ice and salt gets the heat for melting from itself: as ice melts, the bowl
 *   cools, until the salty water's freezing point is reached (`bath`). It cannot cool below the
 *   lowest freezing point of salty water, −21.1 °C (the eutectic), whatever the amount of salt.
 *   A bag of cream in the bowl gives up its heat to the ice and freezes (`simulateBath`).
 *
 * Grams and degrees Celsius throughout; heat in joules. The salt is sodium chloride (table or
 * rock salt). The small heat that salt itself takes as it dissolves is left out (about a
 * twentieth of the heat the melting takes at the eutectic).
 */

/**
 * Freezing point of sodium chloride solutions against salt content: grams of salt in 100 g of
 * salty water, °C. CRC Handbook of Chemistry and Physics, "Concentrative properties of aqueous
 * solutions", as tabulated in Wikipedia's "Saline water"; the same curve as the brine table of
 * FHWA-RD-95-202, Appendix B. The last row is the eutectic: no saltier water stays liquid colder.
 */
export const BRINE: readonly { salt: number; freezes: number }[] = [
	{ salt: 0, freezes: 0 },
	{ salt: 1, freezes: -0.59 },
	{ salt: 2, freezes: -1.19 },
	{ salt: 3, freezes: -1.79 },
	{ salt: 4, freezes: -2.41 },
	{ salt: 5, freezes: -3.05 },
	{ salt: 6, freezes: -3.7 },
	{ salt: 7, freezes: -4.38 },
	{ salt: 8, freezes: -5.08 },
	{ salt: 9, freezes: -5.81 },
	{ salt: 10, freezes: -6.56 },
	{ salt: 11, freezes: -7.35 },
	{ salt: 12, freezes: -8.18 },
	{ salt: 13, freezes: -9.04 },
	{ salt: 14, freezes: -9.94 },
	{ salt: 15, freezes: -10.89 },
	{ salt: 16, freezes: -11.89 },
	{ salt: 17, freezes: -12.94 },
	{ salt: 18, freezes: -14.04 },
	{ salt: 19, freezes: -15.21 },
	{ salt: 20, freezes: -16.46 },
	{ salt: 21, freezes: -17.78 },
	{ salt: 22, freezes: -19.18 },
	{ salt: 23.3, freezes: -21.1 }
];

/** The lowest point of the curve: below this temperature salty water of any strength freezes. */
export const EUTECTIC = BRINE[BRINE.length - 1];

/** Heat to melt a gram of ice at 0 °C, J/g. */
export const MELT_HEAT = 334;
/** Specific heats, J/(g·K): ice, and salty water (about 3.3 for strong brine). */
export const CP_ICE = 2.1;
export const CP_BRINE = 3.3;
/** ...and plain water. */
export const CP_WATER = 4.18;

/** A level tablespoon of table salt, g. */
export const SPOON = 18;

/** Temperature at which water with `salt` g of salt per 100 g of salty water starts to freeze. */
export function freezingPoint(salt: number): number {
	if (salt <= 0) return 0;
	if (salt >= EUTECTIC.salt) return EUTECTIC.freezes;
	let i = 1;
	while (BRINE[i].salt < salt) i++;
	const a = BRINE[i - 1];
	const b = BRINE[i];
	return a.freezes + ((salt - a.salt) / (b.salt - a.salt)) * (b.freezes - a.freezes);
}

/**
 * How salty water must be (g of salt per 100 g) to stay liquid at `temp` beside ice: the
 * saltiness at which ice and salty water balance. 0 at or above 0 °C; `null` below the eutectic,
 * where no salty water stays liquid.
 */
export function saltinessAt(temp: number): number | null {
	if (temp >= 0) return 0;
	if (temp < EUTECTIC.freezes) return null;
	let i = 1;
	while (BRINE[i].freezes > temp) i++;
	const a = BRINE[i - 1];
	const b = BRINE[i];
	return a.salt + ((temp - a.freezes) / (b.freezes - a.freezes)) * (b.salt - a.salt);
}

/**
 * Grams of ice that `salt` g of salt melts on a path held at `temp` (below 0 °C), out of `ice`
 * g. The ice melts until the salty water is just weak enough to freeze at `temp`; nothing melts
 * below the eutectic.
 */
export function iceMeltedBy(salt: number, temp: number, ice = Infinity): number {
	if (salt <= 0 || temp >= 0) return 0;
	const c = saltinessAt(temp);
	if (c === null) return 0;
	return Math.min(ice, (salt * (100 - c)) / c);
}

// ---- a bowl of ice and salt -----------------------------------------------------------------

/** What is in the bowl at a moment. */
export interface BathState {
	temp: number;
	/** Ice that has melted, g (of `water` in all). */
	melted: number;
}

/**
 * Heat content of a bowl holding `water` g of water (ice or liquid) and `salt` g of salt at
 * temperature `temp`, with `melted` g liquid, in J, counted from everything frozen at 0 °C.
 */
function heat(water: number, salt: number, temp: number, melted: number): number {
	const liquid = melted > 0 ? melted + salt : 0;
	return MELT_HEAT * melted + temp * (CP_ICE * (water - melted) + CP_BRINE * liquid);
}

/** Liquid water in the bowl at `temp` (above the eutectic): ice melts until the balance. */
function meltedAt(water: number, salt: number, temp: number): number {
	if (temp >= 0) return water;
	return Math.min(water, iceMeltedBy(salt, temp));
}

/**
 * The bowl's temperature and melted ice for a heat content `h` (J, counted from everything
 * frozen at 0 °C). The bowl sits at a fixed temperature while heat goes into melting at the
 * eutectic (salty bowl) or at 0 °C (plain ice).
 */
export function bathFromHeat(water: number, salt: number, h: number): BathState {
	const flat = salt > 0 ? EUTECTIC.freezes : 0;
	// The two ends of the flat stretch: all frozen, and melted as far as the balance allows.
	const most = salt > 0 ? Math.min(water, iceMeltedBy(salt, flat)) : water;
	const low = heat(water, salt, flat, 0);
	const high = heat(water, salt, flat, most);
	if (h <= low) return { temp: h / (CP_ICE * water), melted: 0 };
	if (h <= high) return { temp: flat, melted: (most * (h - low)) / (high - low) };
	if (salt <= 0) return { temp: (h - MELT_HEAT * water) / (CP_WATER * water), melted: water };
	let lo = flat;
	let hi = 60;
	for (let k = 0; k < 50; k++) {
		const mid = (lo + hi) / 2;
		if (heat(water, salt, mid, meltedAt(water, salt, mid)) > h) hi = mid;
		else lo = mid;
	}
	const temp = (lo + hi) / 2;
	return { temp, melted: meltedAt(water, salt, temp) };
}

/**
 * A bowl of `ice` g of ice at 0 °C stirred with `salt` g of salt, insulated: the coldest it gets.
 * The melting takes its heat from the bowl itself.
 */
export function bath(ice: number, salt: number): BathState {
	return bathFromHeat(ice, salt, 0);
}

// ---- a bag of cream in the bowl --------------------------------------------------------------

/**
 * The ice-cream mix of Scientific American's "Making ice cream in a bag": half a cup of
 * half-and-half and a tablespoon of sugar. About 72 % of it is water; the sugar and the milk's
 * own sugars and salts make it start to freeze at about −1.3 °C (Goff's sucrose-equivalent
 * method: about 18 g of sucrose equivalent per 100 g of water, 1.1 °C, plus about 0.23 °C from
 * the milk salts; a low-sugar mix, where commercial mixes start at −1.4 to −3 °C). As water
 * freezes out the rest gets more concentrated, so the fraction of the water frozen at `temp` is
 * about 1 − (−1.3)/temp.
 */
export const CREAM = { mass: 133, water: 0.72, startsFreezing: -1.3, start: 5, cp: 3.3 } as const;

/** Fraction of the cream's water that is ice at `temp`. */
export function creamFrozen(temp: number): number {
	return temp >= CREAM.startsFreezing ? 0 : 1 - CREAM.startsFreezing / temp;
}

/** The cream is frozen like soft ice cream once half its water is ice (at −2.6 °C). */
export const SOFT = 0.5;

function creamHeat(temp: number): number {
	return CREAM.mass * CREAM.cp * temp - MELT_HEAT * CREAM.mass * CREAM.water * creamFrozen(temp);
}

function creamFromHeat(h: number): number {
	let lo = -40;
	let hi = 40;
	for (let k = 0; k < 50; k++) {
		const mid = (lo + hi) / 2;
		if (creamHeat(mid) > h) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}

/**
 * How fast heat gets in, W per degree of difference: from the kitchen through the bag and the
 * towel round it, and from the cream's bag into the shaken ice. Chosen so that the recipe's
 * bag (four cups of ice, half a cup of salt) freezes the cream in about five minutes of shaking,
 * as the recipe says.
 */
export const LEAK = { room: 0.5, cream: 3.5, kitchen: 20 } as const;

export interface BathSample {
	/** Minutes since the salt went in. */
	minute: number;
	bath: number;
	cream: number;
	/** Ice melted so far, g. */
	melted: number;
	/** Fraction of the cream's water that is ice. */
	frozen: number;
	/** Heat taken out of the cream so far, J. */
	fromCream: number;
}

/**
 * A bag of cream shaken in a bowl of `ice` g of ice at 0 °C with `salt` g of salt, for `minutes`
 * minutes, sampled every `every` minutes. The bowl stays mixed; heat flows into it from the
 * kitchen and from the cream, and melts ice.
 */
export function simulateBath(
	ice: number,
	salt: number,
	minutes: number,
	every = 0.25,
	withCream = true
): BathSample[] {
	const dt = 1;
	let h = 0;
	let hc = creamHeat(CREAM.start);
	let fromCream = 0;
	const out: BathSample[] = [];
	const steps = Math.round(minutes * 60);
	const each = Math.max(1, Math.round(every * 60));
	for (let s = 0; s <= steps; s++) {
		const b = bathFromHeat(ice, salt, h);
		const tc = withCream ? creamFromHeat(hc) : b.temp;
		if (s % each === 0)
			out.push({
				minute: s / 60,
				bath: b.temp,
				cream: tc,
				melted: b.melted,
				frozen: creamFrozen(tc),
				fromCream
			});
		const qc = withCream ? LEAK.cream * (tc - b.temp) * dt : 0;
		h += LEAK.room * (LEAK.kitchen - b.temp) * dt + qc;
		hc -= qc;
		fromCream += qc;
	}
	return out;
}

/** Minutes until the cream is frozen like soft ice cream, or `null` if it never is in `limit`. */
export function minutesToFreeze(ice: number, salt: number, limit = 30): number | null {
	const run = simulateBath(ice, salt, limit, 1 / 60);
	const hit = run.find((r) => r.frozen >= SOFT);
	return hit ? hit.minute : null;
}
