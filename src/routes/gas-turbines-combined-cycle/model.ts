/**
 * A combined-cycle power plant: a gas turbine (Brayton cycle) whose exhaust boils water in a
 * heat-recovery steam generator (HRSG) for a steam turbine (Rankine cycle).
 *
 * Gas turbine, per mole of dry air (N2 78.08%, O2 20.95%, Ar 0.93%) drawn in at 15 °C: a
 * compressor of pressure ratio r and isentropic efficiency 0.88; a combustor burning methane
 * (CH4 + 2 O2 -> CO2 + 2 H2O) to the turbine inlet temperature, with a 3% pressure loss; a
 * turbine expanding the products back to the ambient pressure with isentropic efficiency 0.90.
 * Gas properties from NASA polynomials (`data.ts`), which include each species' heat of
 * formation, so the combustor's energy balance needs no separate heating value. The turbine is
 * uncooled: real ones bleed compressor air to cool their blades, so a real machine needs a
 * higher firing temperature for the same result.
 *
 * HRSG: one, two or three pressure levels in series along the gas path, each a superheater and an
 * evaporator (whose gas-side outlet sits a pinch-point difference above the boiling point) and an
 * economizer that heats the water of its own level and of the levels above it up to its boiling
 * point; the condensate enters the coldest economizer. The superheated steam comes out 25 K
 * below the gas that heats it (at most 600 °C). Steam properties: NIST, IAPWS-95 (`data.ts`).
 *
 * Steam turbine: each level's steam expands to a condenser at 33 °C with isentropic efficiency
 * 0.88; pumps lift the condensate back. No reheat, no deaerator.
 */
import { ISOBARS, NASA, SAT_P, SAT_T } from './data';

export const R = 8.314462618e-3; // kJ/(mol K)
export const T0 = 288.15;
export const T_REF = 298.15;
const ETA_C = 0.88;
const ETA_T = 0.9;
const COMBUSTOR_LOSS = 0.03;
const ETA_ST = 0.88;
/** Superheated steam leaves this much colder than the gas entering its superheater (K). */
export const APPROACH = 25;
export const T_STEAM_MAX = 873.15;
export const T_COND = 306.15;
/** Pressures of the second and third levels (MPa), when present. */
export const P_IP = 2.5;
export const P_LP = 0.4;
const M_CH4 = 16.043e-3; // kg/mol

// ---- gas ------------------------------------------------------------------------------------

type Mix = Partial<Record<keyof typeof NASA, number>>;

const coeffs = (sp: string, T: number) => {
	const c = NASA[sp];
	return T < c.tMid ? c.low : c.high;
};
/** Molar enthalpy (kJ/mol, including the heat of formation) and standard entropy (kJ/(mol K)). */
export function hSpecies(sp: string, T: number) {
	const a = coeffs(sp, T);
	return (
		R *
		T *
		(a[0] +
			(a[1] * T) / 2 +
			(a[2] * T * T) / 3 +
			(a[3] * T ** 3) / 4 +
			(a[4] * T ** 4) / 5 +
			a[5] / T)
	);
}
export function sSpecies(sp: string, T: number) {
	const a = coeffs(sp, T);
	return (
		R *
		(a[0] * Math.log(T) +
			a[1] * T +
			(a[2] * T * T) / 2 +
			(a[3] * T ** 3) / 3 +
			(a[4] * T ** 4) / 4 +
			a[6])
	);
}
export function cpSpecies(sp: string, T: number) {
	const a = coeffs(sp, T);
	return R * (a[0] + a[1] * T + a[2] * T * T + a[3] * T ** 3 + a[4] * T ** 4);
}
const sum = (mix: Mix, f: (sp: string) => number) =>
	Object.entries(mix).reduce((acc, [sp, n]) => acc + (n ?? 0) * f(sp), 0);
export const hMix = (mix: Mix, T: number) => sum(mix, (sp) => hSpecies(sp, T));
/** Entropy of a mixture at 1 atm, without the mixing term (which a fixed composition carries along unchanged). */
export const sMix = (mix: Mix, T: number) => sum(mix, (sp) => sSpecies(sp, T));
const moles = (mix: Mix) => Object.values(mix).reduce<number>((a, n) => a + (n ?? 0), 0);

/** Temperature at which a mixture has enthalpy h (bisection, 200-3000 K). */
function tAtH(mix: Mix, h: number) {
	let lo = 200;
	let hi = 3000;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (hMix(mix, mid) < h) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}
/** Temperature after an isentropic change of pressure by the factor `ratio` from T. */
function tIsentropic(mix: Mix, T: number, ratio: number) {
	const target = sMix(mix, T) + moles(mix) * R * Math.log(ratio);
	let lo = 150;
	let hi = 3500;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (sMix(mix, mid) < target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

export const AIR: Mix = { N2: 0.7808, O2: 0.2095, AR: 0.0093 };
/** Products of burning n moles of methane in one mole of air. */
export const products = (n: number): Mix => ({
	N2: 0.7808,
	O2: 0.2095 - 2 * n,
	AR: 0.0093,
	CO2: n,
	H2O: 2 * n
});

/** Lower heating value of methane at 25 °C (kJ/mol): the heat of CH4 + 2 O2 -> CO2 + 2 H2O(g). */
export const LHV_MOLAR =
	hSpecies('CH4', T_REF) +
	2 * hSpecies('O2', T_REF) -
	hSpecies('CO2', T_REF) -
	2 * hSpecies('H2O', T_REF);

export interface GasTurbine {
	/** Compressor outlet, turbine inlet and exhaust temperatures (K). */
	t2: number;
	t3: number;
	t4: number;
	/** Moles of methane burned per mole of air. */
	fuel: number;
	/** Compressor and turbine work and fuel heat, per mole of air (kJ). */
	wc: number;
	wt: number;
	q: number;
	efficiency: number;
	exhaust: Mix;
}

export function gasTurbine(ratio: number, tit: number): GasTurbine {
	const t2s = tIsentropic(AIR, T0, ratio);
	const h1 = hMix(AIR, T0);
	const h2 = h1 + (hMix(AIR, t2s) - h1) / ETA_C;
	const t2 = tAtH(AIR, h2);
	// Fuel: enough methane (entering at 25 °C) to bring the products to the turbine inlet temperature.
	let lo = 0;
	let hi = 0.1;
	for (let i = 0; i < 60; i++) {
		const n = (lo + hi) / 2;
		// Too little fuel leaves the products short of the energy they need at the turbine inlet.
		if (hMix(products(n), tit) > h2 + n * hSpecies('CH4', T_REF)) lo = n;
		else hi = n;
	}
	const fuel = (lo + hi) / 2;
	const gas = products(fuel);
	const h3 = hMix(gas, tit);
	const t4s = tIsentropic(gas, tit, 1 / (ratio * (1 - COMBUSTOR_LOSS)));
	const h4 = h3 - ETA_T * (h3 - hMix(gas, t4s));
	const t4 = tAtH(gas, h4);
	const wc = h2 - h1;
	const wt = h3 - h4;
	const q = fuel * LHV_MOLAR;
	return { t2, t3: tit, t4, fuel, wc, wt, q, efficiency: (wt - wc) / q, exhaust: gas };
}

// ---- steam ------------------------------------------------------------------------------------

function lerp(rows: readonly (readonly number[])[], x: number, col: number) {
	let i = 0;
	while (i < rows.length - 2 && rows[i + 1][col] < x) i++;
	const a = rows[i];
	const b = rows[i + 1];
	const u = (x - a[col]) / (b[col] - a[col]);
	return a.map((v, k) => v + (b[k] - v) * u);
}

/** Saturation at pressure p (MPa): T, p, hf, hg, sf, sg. */
export const satAtP = (p: number) => lerp(SAT_P, p, 1);
/** Saturation at temperature T (K). */
export const satAtT = (T: number) => lerp(SAT_T, T, 0);

/** h and s of water (liquid) or steam at (T, p), interpolated in T along the two nearest isobars and in log p between them. */
export function steamProps(T: number, p: number, phase: 0 | 1) {
	let j = 0;
	while (j < ISOBARS.length - 2 && ISOBARS[j + 1][0] < p) j++;
	const at = (k: number) => {
		const rows = ISOBARS[k][1].filter((r) => r[3] === phase);
		const r = lerp(rows, T, 0);
		return { h: r[1], s: r[2] };
	};
	const a = at(j);
	const b = at(j + 1);
	const u = Math.log(p / ISOBARS[j][0]) / Math.log(ISOBARS[j + 1][0] / ISOBARS[j][0]);
	return { h: a.h + (b.h - a.h) * u, s: a.s + (b.s - a.s) * u };
}

// ---- the HRSG and the steam turbine -------------------------------------------------------------

export interface Section {
	kind: 'superheater' | 'evaporator' | 'economizer';
	level: number;
	/** Heat taken from the gas, from the hot end (kJ per mole of air), and the temperatures at each end. */
	q0: number;
	q1: number;
	gasIn: number;
	gasOut: number;
	waterIn: number;
	waterOut: number;
}

export interface Level {
	p: number;
	tSat: number;
	tSteam: number;
	/** Steam made per mole of air (kg). */
	steam: number;
	/** Steam-turbine work from this level, after its pump (kJ per mole of air). */
	work: number;
}

export interface Plant {
	gt: GasTurbine;
	levels: Level[];
	sections: Section[];
	stack: number;
	/** Steam-turbine work and the plant's net work per mole of air (kJ), and the efficiencies. */
	wst: number;
	work: number;
	efficiency: number;
	/** Share of the exhaust's heat (cooled to 15 °C) that the HRSG recovers. */
	recovered: number;
}

export interface PlantInput {
	ratio: number;
	tit: number;
	/** Pressure of the first (high-pressure) level (MPa). */
	pHigh: number;
	/** Pinch-point difference (K). */
	pinch: number;
	/** Number of pressure levels, 1 to 3. */
	levels: number;
}

/**
 * The HRSG and steam turbine for the given pressure levels. A lower level that the gas can no
 * longer boil is reported in `dead` (the caller then leaves it out and starts again, so the levels
 * above take their water straight from the next working level).
 */
function recover(gt: GasTurbine, pressures: number[], pinch: number) {
	const gas = gt.exhaust;
	const sections: Section[] = [];
	const levels: Level[] = [];
	let dead: number | null = null;
	let tGas = gt.t4;
	let q = 0;
	const cond = satAtT(T_COND);
	const feedH = cond[2];
	pressures.forEach((p, k) => {
		const sat = satAtP(p);
		const tSat = sat[0];
		const hf = sat[2];
		const hg = sat[3];
		// The water entering this level's economizer: the next level's boiling water, or the condensate.
		const next = pressures[k + 1];
		const tWaterIn = next === undefined ? T_COND : satAtP(next)[0];
		const hIn = next === undefined ? feedH : steamProps(tWaterIn, p, 0).h;
		const tPinch = tSat + pinch;
		// A level whose evaporator the gas can no longer reach makes no steam, but its economizer
		// still heats the water on its way to the levels above.
		const boils = tGas > tPinch + 1;
		const tSteam = boils ? Math.max(tSat + 1, Math.min(T_STEAM_MAX, tGas - APPROACH)) : tSat;
		const hSteam = steamProps(Math.max(tSteam, tSat + 1), p, 1).h;
		let steam = 0;
		const liquid = (T: number, pj: number) =>
			T <= T_COND + 0.01 ? feedH + 0.001 * (pj - cond[1]) * 1000 : steamProps(T, pj, 0).h;
		if (boils) {
			// Superheater and evaporator: at most what the gas gives cooling to the pinch...
			const fromPinch = (hMix(gas, tGas) - hMix(gas, tPinch)) / (hSteam - hf);
			// ...and at most what leaves the gas above the condensate (plus a pinch) once this steam and
			// the water already bound for the levels above have been heated from the condensate.
			const owed = levels.reduce(
				(a, l) => a + l.steam * (liquid(tSat, l.p) - liquid(T_COND, l.p)),
				0
			);
			const fromColdEnd =
				(hMix(gas, tGas) - hMix(gas, T_COND + pinch) - owed) / (hSteam - liquid(T_COND, p));
			steam = Math.max(0, Math.min(fromPinch, fromColdEnd));
			const qBlock = steam * (hSteam - hf);
			const qSh = steam * (hSteam - hg);
			const tMid = tAtH(gas, hMix(gas, tGas) - qSh);
			sections.push(
				{
					kind: 'superheater',
					level: k,
					q0: q,
					q1: q + qSh,
					gasIn: tGas,
					gasOut: tMid,
					waterIn: tSat,
					waterOut: tSteam
				},
				{
					kind: 'evaporator',
					level: k,
					q0: q + qSh,
					q1: q + qBlock,
					gasIn: tMid,
					gasOut: tAtH(gas, hMix(gas, tGas) - qBlock),
					waterIn: tSat,
					waterOut: tSat
				}
			);
			q += qBlock;
			tGas = tAtH(gas, hMix(gas, tGas) - qBlock);
		}
		// Economizer: the water of this level and of every level above it, from tWaterIn up to this
		// level's boiling point (the higher levels' water goes on to their own economizers).
		let qEco = steam * (hf - hIn);
		levels.forEach((l) => {
			qEco += l.steam * (liquid(tSat, l.p) - liquid(tWaterIn, l.p));
		});
		const tAfter = tAtH(gas, hMix(gas, tGas) - qEco);
		if (qEco > 0)
			sections.push({
				kind: 'economizer',
				level: k,
				q0: q,
				q1: q + qEco,
				gasIn: tGas,
				gasOut: tAfter,
				waterIn: tWaterIn,
				waterOut: tSat
			});
		q += qEco;
		tGas = tAfter;
		if (!boils || steam <= 1e-12) {
			if (k > 0 && dead === null) dead = k;
			levels.push({ p, tSat, tSteam: tSat, steam: 0, work: 0 });
			return;
		}
		// The steam turbine: expansion to the condenser with efficiency ETA_ST, into wet steam.
		const sIn = steamProps(tSteam, p, 1).s;
		const x = Math.min(1, (sIn - cond[4]) / (cond[5] - cond[4]));
		const hOutS = cond[2] + x * (cond[3] - cond[2]);
		const hOut = hSteam - ETA_ST * (hSteam - hOutS);
		// The pump: about v dp for water (0.001 m³/kg).
		const pump = 0.001 * (p - cond[1]) * 1000;
		levels.push({ p, tSat, tSteam, steam, work: steam * (hSteam - hOut - pump) });
	});
	return { sections, levels, dead, stack: tGas, q };
}

export function plant({ ratio, tit, pHigh, pinch, levels: count }: PlantInput): Plant {
	const gt = gasTurbine(ratio, tit);
	const gas = gt.exhaust;
	let pressures = [pHigh, P_IP, P_LP].slice(0, count);
	const idle: Level[] = [];
	let r = recover(gt, pressures, pinch);
	while (r.dead !== null) {
		const p = pressures[r.dead];
		idle.push({ p, tSat: satAtP(p)[0], tSteam: satAtP(p)[0], steam: 0, work: 0 });
		pressures = pressures.filter((_, k) => k !== r.dead);
		r = recover(gt, pressures, pinch);
	}
	const levels = [...r.levels, ...idle].sort((a, b) => b.p - a.p);
	const { sections, stack: tGas, q } = r;
	const wst = levels.reduce((a, l) => a + l.work, 0);
	const work = gt.wt - gt.wc + wst;
	const available = hMix(gas, gt.t4) - hMix(gas, T0);
	return {
		gt,
		levels,
		sections,
		stack: tGas,
		wst,
		work,
		efficiency: work / gt.q,
		recovered: q / available
	};
}

/** Megajoules per kilogram of methane. */
export const LHV_MASS = LHV_MOLAR / M_CH4 / 1000;
