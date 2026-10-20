/**
 * The vapour-compression cycle of a heat pump or refrigerator, on real refrigerant properties
 * (NIST; `data.ts`):
 *
 *   1 -> 2  the compressor squeezes the vapour to the high pressure (isentropic efficiency eta)
 *   2 -> 3  the condenser (or, above the critical pressure, the gas cooler) gives heat away
 *   3 -> 4  the expansion valve drops the pressure at constant enthalpy, flashing some liquid
 *   4 -> 1  the evaporator boils the rest, taking heat in
 *
 * Per kilogram of refrigerant; kJ/kg, K, MPa. Subcooled liquid is taken at the saturated liquid's
 * enthalpy at its temperature (the effect of pressure on a liquid's enthalpy is small).
 */
import { FLUIDS } from './data';

export type Fluid = keyof typeof FLUIDS;
export { FLUIDS };

function lerp(rows: readonly (readonly number[])[], x: number, col: number) {
	let i = 0;
	while (i < rows.length - 2 && rows[i + 1][col] < x) i++;
	const a = rows[i];
	const b = rows[i + 1];
	const u = (x - a[col]) / (b[col] - a[col]);
	return a.map((v, k) => v + (b[k] - v) * u);
}

export interface Sat {
	T: number;
	p: number;
	hf: number;
	hg: number;
	sf: number;
	sg: number;
}
const asSat = (r: number[]): Sat => ({ T: r[0], p: r[1], hf: r[2], hg: r[3], sf: r[4], sg: r[5] });
export const satAtT = (f: Fluid, T: number) => asSat(lerp(FLUIDS[f].sat, T, 0));
export const satAtP = (f: Fluid, p: number) => asSat(lerp(FLUIDS[f].sat, p, 1));

/** Vapour (or supercritical) h and s at (p, T): along the two nearest isobars, then in log p. */
export function vapour(f: Fluid, p: number, T: number) {
	const iso = FLUIDS[f].isobars;
	let j = 0;
	while (j < iso.length - 2 && iso[j + 1][0] < p) j++;
	const at = (k: number) => {
		const r = lerp(iso[k][1], T, 0);
		return { h: r[1], s: r[2] };
	};
	const a = at(j);
	const b = at(j + 1);
	const u = Math.log(p / iso[j][0]) / Math.log(iso[j + 1][0] / iso[j][0]);
	return { h: a.h + (b.h - a.h) * u, s: a.s + (b.s - a.s) * u };
}

/** Temperature on the isobar p where the vapour's entropy (or enthalpy) has the given value. */
function vapourT(f: Fluid, p: number, value: number, key: 'h' | 's') {
	let lo = 200;
	let hi = 460;
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (vapour(f, p, mid)[key] < value) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

export interface CycleInput {
	fluid: Fluid;
	/** Evaporating temperature (K). */
	tEvap: number;
	/**
	 * The high side: condensing temperature (K) below the critical point, or, for a transcritical
	 * cycle, the gas cooler's pressure (MPa) and outlet temperature (K).
	 */
	high: { tCond: number } | { p: number; tOut: number };
	/** Compressor isentropic efficiency (0-1). */
	eta?: number;
	/** Superheat at the evaporator outlet and subcooling at the condenser outlet (K). */
	superheat?: number;
	subcool?: number;
}

export interface Point {
	p: number;
	h: number;
	T: number;
}

export interface Cycle {
	/** States 1 (compressor inlet), 2 (outlet), 3 (condenser outlet), 4 (evaporator inlet). */
	points: [Point, Point, Point, Point];
	transcritical: boolean;
	/** Work in, heat delivered at the high side, heat taken in at the low side (kJ/kg). */
	work: number;
	heat: number;
	cool: number;
	copHeating: number;
	copCooling: number;
	/** Carnot COPs for the same two temperatures (the high one being the gas cooler outlet if transcritical). */
	carnotHeating: number;
	carnotCooling: number;
	/** Vapour fraction leaving the expansion valve. */
	quality: number;
}

export function cycle({
	fluid,
	tEvap,
	high,
	eta = 1,
	superheat = 0,
	subcool = 0
}: CycleInput): Cycle {
	const low = satAtT(fluid, tEvap);
	const pe = low.p;
	const t1 = tEvap + superheat;
	const s1v = superheat > 0 ? vapour(fluid, pe, t1) : { h: low.hg, s: low.sg };
	const h1 = s1v.h;
	const transcritical = 'p' in high;
	const pc = transcritical ? high.p : satAtT(fluid, high.tCond).p;
	const t2s = vapourT(fluid, pc, s1v.s, 's');
	const h2s = vapour(fluid, pc, t2s).h;
	const h2 = h1 + (h2s - h1) / eta;
	const t2 = vapourT(fluid, pc, h2, 'h');
	let h3: number;
	let t3: number;
	let tHigh: number;
	if (transcritical) {
		t3 = high.tOut;
		h3 = vapour(fluid, pc, t3).h;
		tHigh = t3;
	} else {
		t3 = high.tCond - subcool;
		h3 = satAtT(fluid, t3).hf;
		tHigh = high.tCond;
	}
	const h4 = h3;
	const work = h2 - h1;
	return {
		points: [
			{ p: pe, h: h1, T: t1 },
			{ p: pc, h: h2, T: t2 },
			{ p: pc, h: h3, T: t3 },
			{ p: pe, h: h4, T: tEvap }
		],
		transcritical,
		work,
		heat: h2 - h3,
		cool: h1 - h4,
		copHeating: (h2 - h3) / work,
		copCooling: (h1 - h4) / work,
		carnotHeating: tHigh / (tHigh - tEvap),
		carnotCooling: tEvap / (tHigh - tEvap),
		quality: (h4 - low.hf) / (low.hg - low.hf)
	};
}

/** The saturation dome on a p-h diagram: liquid line up to the critical point and back down the vapour line. */
export function dome(f: Fluid): { p: number; h: number }[] {
	const sat = FLUIDS[f].sat;
	return [
		...sat.map((r) => ({ p: r[1], h: r[2] })),
		...[...sat].reverse().map((r) => ({ p: r[1], h: r[3] }))
	];
}
