/**
 * The carbonate system of seawater, solved the way CO2SYS solves it.
 *
 * Seawater of fixed salinity S and total alkalinity AT, at temperature T, in equilibrium with air
 * holding a given mole fraction of CO₂. The unknown is the hydrogen ion concentration [H⁺]; once
 * the dissolved CO₂ is fixed by the air, the charge balance (the alkalinity) gives one equation in
 * [H⁺], solved by bisection on pH. Everything else follows from the equilibrium constants.
 *
 * Constants, all at 1 atm (surface water), retyped from the original papers (the same choices as
 * CO2SYS's defaults and the Guide to Best Practices, Dickson, Sabine & Christian 2007):
 *
 * - K0, CO₂ solubility: Weiss, R. F. (1974), Marine Chemistry 2, 203–215, with his fugacity
 *   correction (virial coefficient B and δ).
 * - K1, K2 of carbonic acid, total pH scale: Lueker, Dickson & Keeling (2000), Marine Chemistry
 *   70, 105–119 (a refit of Mehrbach et al. 1973).
 * - KB of boric acid, total scale: Dickson (1990), Deep-Sea Research 37, 755–766; total boron
 *   0.0004157 × S/35 mol/kg: Uppström (1974), Deep-Sea Research 21, 161–162.
 * - KW of water: Millero (1995), Geochimica et Cosmochimica Acta 59, 661–677 (seawater scale,
 *   converted to the total scale here).
 * - KS of HSO₄⁻: Dickson (1990), J. Chem. Thermodynamics 22, 113–127; total sulfate: Morris &
 *   Riley (1966). KF of HF: Dickson & Riley (1979), Marine Chemistry 7, 89–99; total fluoride:
 *   Riley (1965). These only matter for converting between pH scales and a few µmol/kg of
 *   alkalinity.
 * - Calcite and aragonite solubility: Mucci (1983), American Journal of Science 283, 780–799;
 *   calcium 0.02128/40.087 × S/1.80655 mol/kg: Riley & Tongudai (1967), Chemical Geology 2,
 *   263–269.
 * - Water vapour pressure over seawater: Weiss & Price (1980), Marine Chemistry 8, 347–359.
 *
 * Simplifications: no phosphate, silicate or other minor bases in the alkalinity; surface
 * pressure only; the water is in full equilibrium with the air above it.
 *
 * Units: concentrations are returned in µmol per kg of seawater; pressures in µatm; pH on the
 * total scale.
 */

const R_GAS = 83.14462618; // cm³ bar / (mol K)

export interface Water {
	/** Temperature, °C. */
	T: number;
	/** Practical salinity. */
	S: number;
	/** Total alkalinity, µmol/kg. */
	AT: number;
}

/** Today's average open-ocean surface water, as in Orr et al. (2015): AT 2300 µmol/kg, S 35. */
export const SEAWATER: Water = { T: 18, S: 35, AT: 2300 };

export interface Constants {
	/** CO₂ solubility, mol kg⁻¹ atm⁻¹. */
	K0: number;
	/** Dissociation constants (total scale), mol/kg. */
	K1: number;
	K2: number;
	KB: number;
	KW: number;
	/** Free scale. */
	KS: number;
	KF: number;
	/** Solubility products, (mol/kg)². */
	Kcal: number;
	Kar: number;
	/** Totals, mol/kg. */
	BT: number;
	ST: number;
	FT: number;
	Ca: number;
	/** Fugacity over partial pressure for CO₂ at 1 atm. */
	fug: number;
	/** Water vapour pressure over seawater, atm. */
	vapour: number;
}

/** The equilibrium constants and totals at temperature `T` (°C) and salinity `S`. */
export function constants(T: number, S: number): Constants {
	const TK = T + 273.15;
	const lnT = Math.log(TK);
	const sqrtS = Math.sqrt(S);

	// Weiss 1974, mol kg⁻¹ atm⁻¹
	const T100 = TK / 100;
	const K0 = Math.exp(
		-60.2409 +
			93.4517 / T100 +
			23.3585 * Math.log(T100) +
			S * (0.023517 - 0.023656 * T100 + 0.0047036 * T100 * T100)
	);

	// Lueker et al. 2000, total scale
	const pK1 = 3633.86 / TK - 61.2172 + 9.6777 * lnT - 0.011555 * S + 0.0001152 * S * S;
	const pK2 = 471.78 / TK + 25.929 - 3.16967 * lnT - 0.01781 * S + 0.0001122 * S * S;
	const K1 = 10 ** -pK1;
	const K2 = 10 ** -pK2;

	// Dickson 1990, total scale
	const lnKB =
		(-8966.9 - 2890.53 * sqrtS - 77.942 * S + 1.728 * sqrtS * S - 0.0996 * S * S) / TK +
		148.0248 +
		137.1942 * sqrtS +
		1.62142 * S +
		(-24.4344 - 25.085 * sqrtS - 0.2474 * S) * lnT +
		0.053105 * sqrtS * TK;
	const KB = Math.exp(lnKB);

	// ionic strength (DOE 1994), sulfate and fluoride: free scale
	const I = (19.924 * S) / (1000 - 1.005 * S);
	const sqrtI = Math.sqrt(I);
	const lnKS =
		-4276.1 / TK +
		141.328 -
		23.093 * lnT +
		(-13856 / TK + 324.57 - 47.986 * lnT) * sqrtI +
		(35474 / TK - 771.54 + 114.723 * lnT) * I +
		(-2698 / TK) * sqrtI * I +
		(1776 / TK) * I * I;
	const KS = Math.exp(lnKS) * (1 - 0.001005 * S);
	const KF = Math.exp(1590.2 / TK - 12.641 + 1.525 * sqrtI) * (1 - 0.001005 * S);

	const BT = (0.0004157 * S) / 35;
	const ST = ((0.14 / 96.062) * S) / 1.80655;
	const FT = ((0.000067 / 18.998) * S) / 1.80655;
	const Ca = ((0.02128 / 40.087) * S) / 1.80655;

	// Millero 1995, seawater scale → total scale
	const KWsws = Math.exp(
		148.9802 -
			13847.26 / TK -
			23.6521 * lnT +
			(-5.977 + 118.67 / TK + 1.0495 * lnT) * sqrtS -
			0.01615 * S
	);
	const swsToTot = (1 + ST / KS) / (1 + ST / KS + FT / KF);
	const KW = KWsws * swsToTot;

	// Mucci 1983
	const log10T = Math.log10(TK);
	const logKcal =
		-171.9065 -
		0.077993 * TK +
		2839.319 / TK +
		71.595 * log10T +
		(-0.77712 + 0.0028426 * TK + 178.34 / TK) * sqrtS -
		0.07711 * S +
		0.0041249 * sqrtS * S;
	const logKar =
		-171.945 -
		0.077993 * TK +
		2903.293 / TK +
		71.595 * log10T +
		(-0.068393 + 0.0017276 * TK + 88.135 / TK) * sqrtS -
		0.10018 * S +
		0.0059415 * sqrtS * S;

	// Weiss 1974 fugacity at 1 atm = 1.01325 bar
	const B = -1636.75 + 12.0408 * TK - 0.0327957 * TK * TK + 3.16528e-5 * TK ** 3;
	const delta = 57.7 - 0.118 * TK;
	const fug = Math.exp(((B + 2 * delta) * 1.01325) / (R_GAS * TK));

	// Weiss & Price 1980, atm
	const vapour =
		Math.exp(24.4543 - 67.4509 * (100 / TK) - 4.8489 * Math.log(TK / 100)) *
		Math.exp(-0.000544 * S);

	return {
		K0,
		K1,
		K2,
		KB,
		KW,
		KS,
		KF,
		Kcal: 10 ** logKcal,
		Kar: 10 ** logKar,
		BT,
		ST,
		FT,
		Ca,
		fug,
		vapour
	};
}

/** Shares of dissolved inorganic carbon in each form at a given pH (total scale): the Bjerrum plot. */
export function fractions(pH: number, k: Pick<Constants, 'K1' | 'K2'>) {
	const H = 10 ** -pH;
	const d = H * H + k.K1 * H + k.K1 * k.K2;
	return { co2: (H * H) / d, hco3: (k.K1 * H) / d, co3: (k.K1 * k.K2) / d };
}

export interface State {
	water: Water;
	k: Constants;
	pH: number;
	/** µatm. */
	pCO2: number;
	fCO2: number;
	/** µmol/kg. */
	co2: number;
	hco3: number;
	co3: number;
	dic: number;
	boh4: number;
	oh: number;
	/** Free hydrogen ions, µmol/kg (the ones a "pH" counts on the free scale). */
	hFree: number;
	/** [H⁺] on the total scale, µmol/kg. */
	h: number;
	/** Saturation states [Ca²⁺][CO₃²⁻]/Ksp. */
	omegaAr: number;
	omegaCa: number;
}

/** Alkalinity (mol/kg) other than carbonate at total-scale [H⁺] = H: borate, water, sulfate, fluoride. */
function otherAlk(H: number, k: Constants): number {
	const hFree = H / (1 + k.ST / k.KS);
	const hso4 = k.ST / (1 + k.KS / hFree);
	const hf = k.FT / (1 + k.KF / hFree);
	return (k.BT * k.KB) / (k.KB + H) + k.KW / H - hFree - hso4 - hf;
}

/** Bisection on pH for an alkalinity that rises with pH. */
function solvePH(alkAt: (H: number) => number, AT: number): number {
	let lo = 3;
	let hi = 12;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (alkAt(10 ** -mid) > AT) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}

function stateAt(water: Water, k: Constants, pH: number, co2: number): State {
	const H = 10 ** -pH;
	const hco3 = (k.K1 * co2) / H;
	const co3 = (k.K1 * k.K2 * co2) / (H * H);
	const fCO2 = co2 / k.K0;
	const u = 1e6;
	return {
		water,
		k,
		pH,
		fCO2: fCO2 * u,
		pCO2: (fCO2 / k.fug) * u,
		co2: co2 * u,
		hco3: hco3 * u,
		co3: co3 * u,
		dic: (co2 + hco3 + co3) * u,
		boh4: ((k.BT * k.KB) / (k.KB + H)) * u,
		oh: (k.KW / H) * u,
		hFree: (H / (1 + k.ST / k.KS)) * u,
		h: H * u,
		omegaAr: (k.Ca * co3) / k.Kar,
		omegaCa: (k.Ca * co3) / k.Kcal
	};
}

/** Seawater whose CO₂ partial pressure is `pCO2` µatm. */
export function fromPCO2(pCO2: number, water: Water = SEAWATER): State {
	const k = constants(water.T, water.S);
	const co2 = k.K0 * k.fug * pCO2 * 1e-6;
	const AT = water.AT * 1e-6;
	const pH = solvePH(
		(H) => (k.K1 * co2) / H + (2 * k.K1 * k.K2 * co2) / (H * H) + otherAlk(H, k),
		AT
	);
	return stateAt(water, k, pH, co2);
}

/**
 * Seawater in equilibrium with air holding `ppm` of CO₂ (mole fraction in dry air) at 1 atm:
 * the water's surface air is saturated with water vapour, so pCO₂ = x × (1 atm − pH₂O).
 */
export function fromAir(ppm: number, water: Water = SEAWATER): State {
	const k = constants(water.T, water.S);
	return fromPCO2(ppm * (1 - k.vapour), water);
}

/** Seawater holding `dic` µmol/kg of dissolved inorganic carbon. */
export function fromDIC(dic: number, water: Water = SEAWATER): State {
	const k = constants(water.T, water.S);
	const CT = dic * 1e-6;
	const AT = water.AT * 1e-6;
	const pH = solvePH((H) => {
		const d = H * H + k.K1 * H + k.K1 * k.K2;
		return (CT * k.K1 * (H + 2 * k.K2)) / d + otherAlk(H, k);
	}, AT);
	const H = 10 ** -pH;
	const co2 = (CT * H * H) / (H * H + k.K1 * H + k.K1 * k.K2);
	return stateAt(water, k, pH, co2);
}

/**
 * The Revelle (buffer) factor: the relative rise of the water's CO₂ pressure over the relative
 * rise of its dissolved inorganic carbon, alkalinity held fixed. About 10 means that a 10% rise in
 * the air's CO₂ is matched by only a 1% rise in the carbon the water holds.
 */
export function revelle(pCO2: number, water: Water = SEAWATER): number {
	const e = 0.001;
	const a = fromPCO2(pCO2 * (1 - e), water);
	const b = fromPCO2(pCO2 * (1 + e), water);
	return (Math.log(b.pCO2) - Math.log(a.pCO2)) / (Math.log(b.dic) - Math.log(a.dic));
}

/** The air's CO₂ (ppm) at which aragonite (or calcite) saturation falls to `omega`; Infinity if never below 5000 ppm. */
export function ppmAtOmega(
	omega: number,
	water: Water = SEAWATER,
	mineral: 'aragonite' | 'calcite' = 'aragonite'
): number {
	const om = (ppm: number) => {
		const s = fromAir(ppm, water);
		return mineral === 'aragonite' ? s.omegaAr : s.omegaCa;
	};
	let lo = 1;
	let hi = 5000;
	if (om(lo) < omega) return 0;
	if (om(hi) > omega) return Infinity;
	for (let i = 0; i < 60; i++) {
		const mid = Math.sqrt(lo * hi);
		if (om(mid) > omega) lo = mid;
		else hi = mid;
	}
	return Math.sqrt(lo * hi);
}

/** Pre-industrial air, ppm (ice cores, about 1750). */
export const PPM_PREINDUSTRIAL = 280;
/** Global mean of 2024, ppm (NOAA Global Monitoring Laboratory: 422.8). */
export const PPM_2024 = 423;
