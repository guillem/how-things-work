/**
 * Ions across the membrane of the squid giant axon, and the voltages they set.
 *
 * Source: A. L. Hodgkin & B. Katz, "The effect of sodium ions on the
 * electrical activity of the giant axon of the squid", J. Physiol.
 * 108:37–77 (1949), pp. 30–33 and Table 7 of the Physiological Society's
 * reprint (https://static.physoc.org/app/uploads/2019/04/12150238/H-K1.pdf):
 *
 *   inside (axoplasm): K⁺ 345, Na⁺ 72, Cl⁻ 61 mM — the values they adopted
 *     from Steinbach (1941) and Steinbach & Spiegelman (1943);
 *   outside (sea water): K⁺ 10, Na⁺ 455, Cl⁻ 540 mM;
 *   relative permeabilities PK : PNa : PCl = 1 : 0.04 : 0.45 at rest and
 *     1 : 20 : 0.45 at the peak of the action potential, which with their
 *     equation 4 (the Goldman equation) gave −59 mV at rest and an action
 *     potential of 97 mV.
 *
 * Their experiments ran at room temperature (18–23 °C) and they use 58 mV per
 * tenfold change of concentration (RT/F ln 10 at about 19 °C); this page uses
 * 20 °C. Activities are taken equal to concentrations, as in the paper.
 */

/** Faraday constant, C/mol, and gas constant, J/(mol·K) (CODATA 2018). */
export const FARADAY = 96485.33212;
export const GAS = 8.314462618;

export type Ion = 'K' | 'Na' | 'Cl';

export const ION_INFO: Record<Ion, { name: string; symbol: string; z: number }> = {
	K: { name: 'potassium', symbol: 'K⁺', z: 1 },
	Na: { name: 'sodium', symbol: 'Na⁺', z: 1 },
	Cl: { name: 'chloride', symbol: 'Cl⁻', z: -1 }
};

/** Concentrations in mM (Hodgkin & Katz 1949). */
export const SQUID: Record<Ion, { inside: number; outside: number }> = {
	K: { inside: 345, outside: 10 },
	Na: { inside: 72, outside: 455 },
	Cl: { inside: 61, outside: 540 }
};

/** Relative permeabilities (Hodgkin & Katz 1949). */
export const P_REST: Record<Ion, number> = { K: 1, Na: 0.04, Cl: 0.45 };
export const P_PEAK: Record<Ion, number> = { K: 1, Na: 20, Cl: 0.45 };

/** Temperature used on the page, °C. */
export const ROOM = 20;

/** RT/F in mV at temperature T (°C). */
export function rtf(T: number = ROOM): number {
	return ((GAS * (T + 273.15)) / FARADAY) * 1000;
}

/**
 * Nernst equilibrium potential (mV, inside relative to outside) of an ion of
 * charge z: the voltage at which its electrical pull balances its diffusion.
 */
export function nernst(z: number, outside: number, inside: number, T: number = ROOM): number {
	return (rtf(T) / z) * Math.log(outside / inside);
}

export function nernstOf(ion: Ion, conc = SQUID, T: number = ROOM): number {
	return nernst(ION_INFO[ion].z, conc[ion].outside, conc[ion].inside, T);
}

/**
 * Goldman–Hodgkin–Katz voltage equation (Hodgkin & Katz's equation 4): the
 * membrane voltage at which the currents of K⁺, Na⁺ and Cl⁻ add up to zero.
 */
export function ghk(P: Record<Ion, number>, conc = SQUID, T: number = ROOM): number {
	const num = P.K * conc.K.outside + P.Na * conc.Na.outside + P.Cl * conc.Cl.inside;
	const den = P.K * conc.K.inside + P.Na * conc.Na.inside + P.Cl * conc.Cl.outside;
	return rtf(T) * Math.log(num / den);
}

/**
 * How many ions must cross to charge the membrane by ΔV (mV): Q = C·ΔV, per
 * cm² of membrane with C = 1 µF/cm², in moles of monovalent ions.
 */
export function ionsToCharge(dV: number, C = 1): number {
	return (C * 1e-6 * dV * 1e-3) / FARADAY;
}

/** Avogadro constant, per mol. */
export const AVOGADRO = 6.02214076e23;
