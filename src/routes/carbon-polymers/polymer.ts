/**
 * Chains and polymers: the n-alkane series from gas to wax, and the stiffness of a rubber
 * network built from chains of a given length with a given number of cross-links.
 *
 * Melting of long chains. Measured NIST melting points of the n-alkanes C1–C44 come from
 * `compounds.ts`. Above C44 the page uses Broadhurst's fit, which he gives as a correct
 * description of all n-paraffins above n-C44H90:
 *   Tm = 414.3 K · (n − 1.5)/(n + 5.0)
 * (M. G. Broadhurst, "An analysis of the solid phase behavior of the normal paraffins",
 * J. Res. Natl. Bur. Stand. 66A, 241–249 (1962), https://doi.org/10.6028/jres.066A.024).
 * Its limit, 414.3 K (141.1 °C), is the melting point of an infinitely long chain:
 * polyethylene. (Broadhurst's 1966 re-analysis, J. Res. NBS 70A, 481, raises the limit to
 * 144.7 °C and notes that real extended-chain polyethylene crystals melt near 139 °C.)
 *
 * Rubber stiffness. The statistical theory of rubber elasticity for an ideal network: each
 * strand between two cross-links is an entropic spring, giving the shear modulus
 *   G = ρRT/Mc · (1 − 2Mc/Mn)
 * where Mc is the molar mass between cross-linked units and Mn that of the chains before
 * cross-linking; the bracket (Flory) removes the loose chain ends, which carry no load. When
 * Mn ≤ 2Mc the chains are not tied into one network and G = 0: the material flows. This is
 * the form used by L. A. Wood, "Modulus of natural rubber cross-linked by dicumyl peroxide.
 * III", J. Res. Natl. Bur. Stand. 80A, 451–463 (1976), eq. 3.3.1,
 * https://doi.org/10.6028/jres.080A.051, whose values for natural rubber are used here:
 * specific volume 1.1074 cm³/g (density 0.9030 g/cm³), molar mass of the uncured rubber
 * 193 000 g/mol, at 298.15 K. Under a stretch λ the nominal (engineering) stress of such a
 * network is σ = G(λ − 1/λ²) (neo-Hookean); for small stretches Young's modulus E = 3G.
 * Simplifications: an ideal network (no entanglements trapped by the cross-links, every
 * cross-link joining two chains), one chain length, and stretches up to about 3, beyond which
 * real rubber stiffens as its strands run out of slack.
 */
import { MASS } from './molecule.ts';
import { ALKANES } from './compounds.ts';

const R = 8.314462618; // J/(mol·K)
const ROOM = 298.15; // K
export const toC = (k: number) => k - 273.15;

// ------------------------------------------------------------------ the alkane series

/** Broadhurst (1962) melting point of the n-paraffin with n carbons (K); for n > 44. */
export const broadhurst = (n: number) => (414.3 * (n - 1.5)) / (n + 5.0);
export const PE_LIMIT = 414.3;
export const BROADHURST_FROM = 44;

/** Molar mass of CₙH₂ₙ₊₂ (g/mol). */
export const alkaneMass = (n: number) => n * MASS.C + (2 * n + 2) * MASS.H;

/** Measured melting point (≤ C44) or Broadhurst's fit (above), in K. */
export function alkaneMelting(n: number): { k: number; measured: boolean } | null {
	if (n > BROADHURST_FROM) return { k: broadhurst(n), measured: false };
	const row = ALKANES.find((a) => a.n === n);
	return row?.tm != null ? { k: row.tm, measured: true } : null;
}
export function alkaneBoiling(n: number): number | null {
	return ALKANES.find((a) => a.n === n)?.tb ?? null;
}

export type State = 'gas' | 'liquid' | 'solid';
/** State at 25 °C and 1 atm from the boiling and melting points (K). */
export function stateAt(tb: number | null | undefined, tm: number | null | undefined, T = ROOM) {
	if (tb != null && tb < T) return 'gas' as State;
	if (tm != null && tm > T) return 'solid' as State;
	if (tb != null && tm != null) return 'liquid' as State;
	return null;
}

/**
 * State of the n-alkane at 25 °C. Where NIST lists no boiling or melting point, it is inferred
 * from the trend: boiling points rise with n (C₁₆ already boils at 281 °C), and melting points
 * rise beyond C₁₈ (already above 25 °C), so a missing one is taken to be higher still.
 */
export function alkaneState(n: number): State | null {
	return stateAt(
		alkaneBoiling(n) ?? (n > 16 ? Infinity : null),
		alkaneMelting(n)?.k ?? (n > 18 ? Infinity : null)
	);
}

// ------------------------------------------------------------------ rubber

/** Natural rubber (cis-1,4-polyisoprene), Wood (1976). */
export const RUBBER = {
	/** kg/m³ (1 / 1.1074 cm³/g). */
	density: 1000 / 1.1074,
	/** g/mol, the uncured rubber. */
	chainMass: 193000,
	/** g/mol, one isoprene unit C₅H₈. */
	unitMass: 5 * MASS.C + 8 * MASS.H
};

/**
 * Molar mass between cross-linked units (g/mol) for `x` cross-links per 100 monomer units:
 * each cross-link ties two units, so 2x of every 100 units are cross-linked.
 */
export const strandMass = (x: number, unit = RUBBER.unitMass) =>
	x > 0 ? (100 * unit) / (2 * x) : Infinity;

/** Shear modulus G (Pa) of the network: ρRT/Mc · (1 − 2Mc/Mn), 0 if there is no network. */
export function shearModulus(Mn: number, Mc: number, density = RUBBER.density, T = ROOM) {
	if (!Number.isFinite(Mc) || Mc <= 0) return 0;
	const loose = (2 * Mc) / Mn;
	if (loose >= 1) return 0;
	return ((density * R * T) / (Mc / 1000)) * (1 - loose);
}

/** The fraction of strands left dangling (loose ends): 2Mc/Mn, capped at 1. */
export const looseFraction = (Mn: number, Mc: number) =>
	Number.isFinite(Mc) ? Math.min(1, (2 * Mc) / Mn) : 1;

/**
 * Cross-links per 100 units at which Flory's ideal-network modulus reaches zero (Mn = 2Mc); a
 * gel first forms at about half this.
 */
export const gelPoint = (Mn: number, unit = RUBBER.unitMass) => (100 * unit) / Mn;

/** Nominal stress (Pa) at stretch λ: G(λ − 1/λ²). */
export const stress = (G: number, lambda: number) => G * (lambda - 1 / (lambda * lambda));

/** Young's modulus (Pa) for small stretches. */
export const youngs = (G: number) => 3 * G;
