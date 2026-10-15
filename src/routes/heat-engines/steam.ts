/**
 * The ideal steam-turbine (Rankine) cycle, from real properties of water and
 * steam (NIST, IAPWS-95; see `steam-data.ts`).
 *
 *   1 → 2  the pump pushes condensed water up to the boiler pressure
 *   2 → 3  the boiler heats it, boils it and superheats the steam (constant pressure)
 *   3 → 4  the steam expands through the turbine (adiabatic and reversible: constant entropy)
 *   4 → 1  the condenser turns the wet exhaust steam back into water (constant pressure)
 *
 * Per kilogram of water; kJ/kg, K.
 */
import { BOILER_MPA, BOILER_SAT, SATURATION, SUPERHEATED, type SatRow } from './steam-data.ts';

export { BOILER_MPA };
/** Boiling point at the boiler pressure, K. */
export const T_BOIL = BOILER_SAT[0];
export const T_STEAM_MIN = SUPERHEATED[0][0];
export const T_STEAM_MAX = SUPERHEATED[SUPERHEATED.length - 1][0];
export const T_COND_MIN = SATURATION[0][0];
export const T_COND_MAX = SATURATION[SATURATION.length - 1][0];

function lerpRows<R extends readonly number[]>(rows: readonly R[], x: number, col = 0): number[] {
	let i = 0;
	while (i < rows.length - 2 && rows[i + 1][col] < x) i++;
	const a = rows[i];
	const b = rows[i + 1];
	const u = (x - a[col]) / (b[col] - a[col]);
	return a.map((v, k) => v + (b[k] - v) * u);
}

export interface Saturation {
	T: number;
	/** MPa */
	p: number;
	vf: number;
	vg: number;
	hf: number;
	hg: number;
	sf: number;
	sg: number;
}

const sat = (r: readonly number[]): Saturation => ({
	T: r[0],
	p: r[1],
	vf: r[2],
	vg: r[3],
	hf: r[4],
	hg: r[5],
	sf: r[6],
	sg: r[7]
});

/** Saturated water and steam at temperature T (15–100 °C), interpolated in the NIST table. */
export const saturationAt = (T: number) => sat(lerpRows<SatRow>(SATURATION, T));
/** Saturation temperature at pressure p (MPa), in the range of the table. */
export const boilingPoint = (pMPa: number) => lerpRows<SatRow>(SATURATION, pMPa, 1)[0];
export const boilerSaturation = () => sat(BOILER_SAT);

/** Superheated steam at the boiler pressure: [T, v, h, s]. */
export function superheated(T: number) {
	const [, v, h, s] = lerpRows(SUPERHEATED, T);
	return { T, v, h, s };
}

export interface Rankine {
	tSteam: number;
	tCond: number;
	/** Condenser pressure, MPa. */
	pCond: number;
	h1: number;
	h2: number;
	h3: number;
	h4: number;
	s3: number;
	/** Steam quality at the turbine exit: the fraction that is still vapour. */
	x4: number;
	wPump: number;
	wTurbine: number;
	qIn: number;
	qOut: number;
	work: number;
	efficiency: number;
	/** Carnot limit between the steam and the condenser. */
	carnot: number;
	/** Average temperature at which the boiler's heat goes in: q_in / (s3 − s2), K. */
	tMeanIn: number;
}

/** The ideal Rankine cycle: steam at tSteam (K) and the boiler pressure, condenser at tCond (K). */
export function rankine(tSteam: number, tCond: number): Rankine {
	const c = saturationAt(tCond);
	const top = superheated(tSteam);
	const h1 = c.hf;
	// Liquid water is nearly incompressible: pump work = v Δp (m³/kg × MPa = MJ/kg).
	const wPump = c.vf * (BOILER_MPA - c.p) * 1000;
	const h2 = h1 + wPump;
	const x4 = (top.s - c.sf) / (c.sg - c.sf);
	const h4 = c.hf + x4 * (c.hg - c.hf);
	const wTurbine = top.h - h4;
	const qIn = top.h - h2;
	const qOut = h4 - h1;
	const work = wTurbine - wPump;
	return {
		tSteam,
		tCond,
		pCond: c.p,
		h1,
		h2,
		h3: top.h,
		h4,
		s3: top.s,
		x4,
		wPump,
		wTurbine,
		qIn,
		qOut,
		work,
		efficiency: work / qIn,
		carnot: 1 - tCond / tSteam,
		// The pump's compression is (ideally) at constant entropy, so s2 = s1.
		tMeanIn: qIn / (top.s - c.sf)
	};
}

/** Combined cycle: the steam cycle runs on the heat a gas turbine throws away. */
export const combined = (gasTurbine: number, steamShare: number) =>
	gasTurbine + (1 - gasTurbine) * steamShare;
