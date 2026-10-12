/**
 * Real phase diagrams of water and carbon dioxide, from the reference
 * equations of state's auxiliary equations for the phase boundaries.
 *
 * Water (H₂O):
 *   - triple point 273.16 K, 611.657 Pa; critical point 647.096 K, 22.064 MPa
 *     (IAPWS R6-95(2018), the IAPWS-95 formulation);
 *   - liquid–vapour line: Wagner & Pruß, J. Phys. Chem. Ref. Data 22, 783
 *     (1993), eq. 2.5, as adopted in IAPWS-95;
 *   - melting (ice Ih) and sublimation lines: IAPWS R14-08(2011), "Revised
 *     release on the pressure along the melting and sublimation curves of
 *     ordinary water substance", eqs. 1 and 6. The ice Ih melting line is valid
 *     from the triple point down to 251.165 K and up to 208.566 MPa (where
 *     ice III takes over), beyond the 100 MPa this page shows.
 *   - densities: ice Ih at 0 °C and 1 atm 0.9167 g/cm³ (IAPWS R10-06(2009),
 *     the equation of state for ice Ih: 916.72 kg/m³); liquid water at 0 °C
 *     0.9998 g/cm³ (IAPWS-95: 999.84 kg/m³).
 *
 * Carbon dioxide (CO₂): Span & Wagner, J. Phys. Chem. Ref. Data 25, 1509
 * (1996): triple point 216.592 K, 0.51795 MPa; critical point 304.1282 K,
 * 7.3773 MPa; vapour pressure (eq. 3.13), melting pressure (eq. 3.10) and
 * sublimation pressure (eq. 3.12).
 *
 * Temperatures are in kelvin, pressures in pascals.
 */

export type Substance = 'co2' | 'water';
export type Phase = 'solid' | 'liquid' | 'gas' | 'supercritical';

export interface Point {
	T: number;
	P: number;
}

export interface SubstanceData {
	name: string;
	formula: string;
	triple: Point;
	critical: Point;
}

/** 0 °C in kelvin, and one standard atmosphere in pascals. */
export const KELVIN = 273.15;
export const ATM = 101325;

export const SUBSTANCES: Record<Substance, SubstanceData> = {
	water: {
		name: 'water',
		formula: 'H₂O',
		// IAPWS R6-95(2018)
		triple: { T: 273.16, P: 611.657 },
		critical: { T: 647.096, P: 22.064e6 }
	},
	co2: {
		name: 'carbon dioxide',
		formula: 'CO₂',
		// Span & Wagner (1996), section 3.2
		triple: { T: 216.592, P: 0.51795e6 },
		critical: { T: 304.1282, P: 7.3773e6 }
	}
};

/** Densities in g/cm³ at 0 °C and 1 atm (IAPWS R10-06 for ice Ih, IAPWS-95 for water). */
export const DENSITY = { ice: 0.91672, water: 0.99984 } as const;

// ------------------------------------------------------------------ boundary lines

/** Liquid–vapour (boiling) pressure at T, from the triple to the critical point. */
export function vaporPressure(sub: Substance, T: number): number {
	const { critical } = SUBSTANCES[sub];
	const tau = 1 - T / critical.T;
	if (sub === 'water') {
		// Wagner & Pruß (1993), eq. 2.5
		const a = [-7.85951783, 1.84408259, -11.7866497, 22.6807411, -15.9618719, 1.80122502];
		const s =
			a[0] * tau +
			a[1] * tau ** 1.5 +
			a[2] * tau ** 3 +
			a[3] * tau ** 3.5 +
			a[4] * tau ** 4 +
			a[5] * tau ** 7.5;
		return critical.P * Math.exp((critical.T / T) * s);
	}
	// Span & Wagner (1996), eq. 3.13
	const s = -7.0602087 * tau + 1.9391218 * tau ** 1.5 - 1.6463597 * tau ** 2 - 3.2995634 * tau ** 4;
	return critical.P * Math.exp((critical.T / T) * s);
}

/** Solid–vapour (sublimation) pressure at T, below the triple point. */
export function sublimationPressure(sub: Substance, T: number): number {
	const { triple } = SUBSTANCES[sub];
	if (sub === 'water') {
		// IAPWS R14-08(2011), eq. 6
		const th = T / triple.T;
		const a = [-0.212144006e2, 0.273203819e2, -0.61059813e1];
		const b = [0.333333333e-2, 0.120666667e1, 0.170333333e1];
		let s = 0;
		for (let i = 0; i < 3; i++) s += a[i] * th ** b[i];
		return triple.P * Math.exp(s / th);
	}
	// Span & Wagner (1996), eq. 3.12
	const u = 1 - T / triple.T;
	const s = -14.740846 * u + 2.4327015 * u ** 1.9 - 5.3061778 * u ** 2.9;
	return triple.P * Math.exp((triple.T / T) * s);
}

/**
 * Solid–liquid (melting) pressure at T. For CO₂ the line rises to the right
 * of the triple point; for water (ice Ih) it rises to the left: squeezing ice
 * lowers its melting point.
 */
export function meltingPressure(sub: Substance, T: number): number {
	const { triple } = SUBSTANCES[sub];
	const th = T / triple.T;
	if (sub === 'water') {
		// IAPWS R14-08(2011), eq. 1 (ice Ih)
		const a = [0.119539337e7, 0.808183159e5, 0.33382686e4];
		const b = [0.3e1, 0.2575e2, 0.10375e3];
		let s = 1;
		for (let i = 0; i < 3; i++) s += a[i] * (1 - th ** b[i]);
		return triple.P * s;
	}
	// Span & Wagner (1996), eq. 3.10
	return triple.P * (1 + 1955.539 * (th - 1) + 2055.4593 * (th - 1) ** 2);
}

/** Solves f(T) = P for T in [lo, hi] by bisection, f monotonic. */
function solveT(f: (T: number) => number, P: number, lo: number, hi: number) {
	const rising = f(hi) > f(lo);
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (f(mid) > P === rising) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}

/** Lowest temperature of the melting line this module covers (ice Ih ends at 251.165 K). */
const MELT_RANGE: Record<Substance, [number, number]> = {
	water: [251.165, 273.16],
	co2: [216.592, 400]
};

/**
 * Temperature at which the substance melts at pressure P (P ≥ triple
 * pressure), or sublimes (P < triple pressure).
 */
export function solidLimit(sub: Substance, P: number): number {
	const { triple } = SUBSTANCES[sub];
	if (P < triple.P) return solveT((T) => sublimationPressure(sub, T), P, 20, triple.T);
	const [lo, hi] = MELT_RANGE[sub];
	return solveT((T) => meltingPressure(sub, T), P, lo, hi);
}

/**
 * Temperature at which the liquid boils at pressure P (between the triple and
 * critical pressures), or the solid sublimes (below the triple pressure).
 * Above the critical pressure there is no boiling: returns the critical
 * temperature.
 */
export function vaporLimit(sub: Substance, P: number): number {
	const { triple, critical } = SUBSTANCES[sub];
	if (P < triple.P) return solidLimit(sub, P);
	if (P >= critical.P) return critical.T;
	return solveT((T) => vaporPressure(sub, T), P, triple.T, critical.T);
}

/** The phase that is stable at temperature T and pressure P. */
export function phaseAt(sub: Substance, T: number, P: number): Phase {
	const { triple, critical } = SUBSTANCES[sub];
	if (P < triple.P) {
		return T < triple.T && P > sublimationPressure(sub, T) ? 'solid' : 'gas';
	}
	if (T < solidLimit(sub, P)) return 'solid';
	if (T >= critical.T) return P >= critical.P ? 'supercritical' : 'gas';
	return P > vaporPressure(sub, T) ? 'liquid' : 'gas';
}

/**
 * The phase boundaries as polylines of (T, P) points between the given
 * temperature and pressure limits, for drawing the diagram.
 */
export function boundaries(sub: Substance, tMin: number, tMax: number, pMax: number) {
	const { triple, critical } = SUBSTANCES[sub];
	const steps = 80;
	const sample = (a: number, b: number, f: (T: number) => number) =>
		Array.from({ length: steps + 1 }, (_, i) => {
			const T = a + ((b - a) * i) / steps;
			return { T, P: f(T) };
		});
	const sublimation = sample(Math.max(tMin, 120), triple.T, (T) => sublimationPressure(sub, T));
	const vapour = sample(triple.T, critical.T, (T) => vaporPressure(sub, T));
	// The melting line, from the triple point up to pMax (sampled in pressure,
	// because water's line is almost vertical).
	const melting = Array.from({ length: steps + 1 }, (_, i) => {
		const P = triple.P * (pMax / triple.P) ** (i / steps);
		return { T: solidLimit(sub, P), P };
	}).filter((p) => p.T >= tMin && p.T <= tMax);
	return { sublimation, vapour, melting };
}

export const toCelsius = (T: number) => T - KELVIN;
export const toKelvin = (c: number) => c + KELVIN;
