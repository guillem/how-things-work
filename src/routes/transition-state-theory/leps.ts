/**
 * Three atoms on a line, X–Y–Z, on a London–Eyring–Polanyi–Sato (LEPS) potential-energy
 * surface: the energy as a function of the two bond lengths r₁ = X–Y and r₂ = Y–Z.
 *
 * Units: energy in eV, distance in ångström, mass in unified atomic mass units (u), time in
 * femtoseconds. One eV/(u·Å) of force per mass is an acceleration of 0.0096485 Å/fs².
 *
 * Each pair of atoms is a Morse oscillator (its bonding singlet curve) with an "anti-Morse"
 * triplet curve; Sato's overlap parameter Δ mixes them into the Coulomb integral Q and the
 * exchange integral J, and London's formula combines the three pairs:
 *
 *   V = ΣQᵢ/(1+Δᵢ) − √(½ Σ (Jᵢ/(1+Δᵢ) − Jⱼ/(1+Δⱼ))²)
 *   Q = (D/4)[(3+Δ)e^{−2β(r−rₑ)} − (2+6Δ)e^{−β(r−rₑ)}]
 *   J = (D/4)[(1+3Δ)e^{−2β(r−rₑ)} − (6+2Δ)e^{−β(r−rₑ)}]
 *
 * The zero of energy is the three atoms far apart.
 */

/** Morse constants of one atom pair and its Sato parameter. */
export interface Pair {
	/** Well depth Dₑ (eV). */
	D: number;
	/** Morse range parameter β (1/Å). */
	beta: number;
	/** Equilibrium bond length rₑ (Å). */
	re: number;
	/** Sato overlap parameter Δ. */
	sato: number;
}

/** A surface for the collinear X–Y–Z: the pairs X–Y (r₁), Y–Z (r₂) and X–Z (r₁ + r₂). */
export interface Surface {
	id: 'h3' | 'fh2';
	xy: Pair;
	yz: Pair;
	xz: Pair;
}

/** Atomic masses (u): ¹H, ²H (D) and ¹⁹F. */
export const MASS = { H: 1.00782503, D: 2.01410178, F: 18.99840316 } as const;
export type Atom = keyof typeof MASS;

/** eV/(u·Å) → Å/fs². */
export const ACC = 0.0096485332;
/** ħ in eV·fs. */
export const HBAR = 0.6582119569;
/** Speed of light in cm/fs (for wavenumbers). */
const C_CM_FS = 2.99792458e-5;
/** Boltzmann constant (eV/K) and Planck constant (eV·s). */
export const KB = 8.617333262e-5;
export const H_PLANCK = 4.135667696e-15;

/**
 * H₂: Morse constants from the spectroscopic Dₑ = 4.7466 eV, ωₑ = 4401 cm⁻¹ and rₑ = 0.7417 Å
 * (Huber & Herzberg, via the NIST Chemistry WebBook). The Sato parameter of the H₃ surface,
 * 0.134, puts its pass at the accurate ab initio barrier, 0.42 eV (9.8 kcal/mol, Liu–Siegbahn,
 * Truhlar–Horowitz 1978).
 */
const HH_H3: Pair = { D: 4.7466, beta: 1.9426, re: 0.7417, sato: 0.134 };
/** F + H₂: Muckerman's surface V (1971–1981), whose pass is 1.06 kcal/mol high. */
const HH_FH2: Pair = { D: 4.7466, beta: 1.9426, re: 0.7417, sato: 0.106 };
const HF_FH2: Pair = { D: 6.122, beta: 2.2187, re: 0.917, sato: 0.167 };

export const SURFACES: Record<Surface['id'], Surface> = {
	h3: { id: 'h3', xy: HH_H3, yz: HH_H3, xz: HH_H3 },
	/** X = F, Y = H, Z = H: r₁ is the F–H distance, r₂ the H–H one. */
	fh2: { id: 'fh2', xy: HF_FH2, yz: HH_FH2, xz: HF_FH2 }
};

function qj(p: Pair, r: number): { q: number; j: number; dq: number; dj: number } {
	const e = Math.exp(-p.beta * (r - p.re));
	const e2 = e * e;
	const s = p.D / 4 / (1 + p.sato);
	const a = 3 + p.sato,
		b = 2 + 6 * p.sato,
		c = 1 + 3 * p.sato,
		d = 6 + 2 * p.sato;
	return {
		q: s * (a * e2 - b * e),
		j: s * (c * e2 - d * e),
		dq: s * p.beta * (-2 * a * e2 + b * e),
		dj: s * p.beta * (-2 * c * e2 + d * e)
	};
}

/** The energy (eV) at bond lengths r₁, r₂ (Å). */
export function energy(s: Surface, r1: number, r2: number): number {
	const a = qj(s.xy, r1),
		b = qj(s.yz, r2),
		c = qj(s.xz, r1 + r2);
	const x = a.j - b.j,
		y = b.j - c.j,
		z = c.j - a.j;
	return a.q + b.q + c.q - Math.sqrt(0.5 * (x * x + y * y + z * z));
}

/** The energy and its derivatives ∂V/∂r₁, ∂V/∂r₂. */
export function energyGrad(s: Surface, r1: number, r2: number): [number, number, number] {
	const a = qj(s.xy, r1),
		b = qj(s.yz, r2),
		c = qj(s.xz, r1 + r2);
	const x = a.j - b.j,
		y = b.j - c.j,
		z = c.j - a.j;
	const root = Math.sqrt(0.5 * (x * x + y * y + z * z)) || 1e-12;
	// ∂root/∂Jₐ = (x − z)/(2 root), and likewise for b and c
	const ga = (x - z) / (2 * root),
		gb = (y - x) / (2 * root),
		gc = (z - y) / (2 * root);
	const v = a.q + b.q + c.q - root;
	const d1 = a.dq + c.dq - ga * a.dj - gc * c.dj;
	const d2 = b.dq + c.dq - gb * b.dj - gc * c.dj;
	return [v, d1, d2];
}

/** Second derivatives by central differences of the analytic gradient. */
function hessian(s: Surface, r1: number, r2: number): [number, number, number] {
	const h = 1e-4;
	const p1 = energyGrad(s, r1 + h, r2),
		m1 = energyGrad(s, r1 - h, r2);
	const p2 = energyGrad(s, r1, r2 + h),
		m2 = energyGrad(s, r1, r2 - h);
	const h11 = (p1[1] - m1[1]) / (2 * h);
	const h22 = (p2[2] - m2[2]) / (2 * h);
	const h12 = ((p1[2] - m1[2]) / (2 * h) + (p2[1] - m2[1]) / (2 * h)) / 2;
	return [h11, h12, h22];
}

export interface Saddle {
	r1: number;
	r2: number;
	/** Energy at the pass (eV, from three separate atoms). */
	v: number;
}

/** The pass: the stationary point found by Newton's method from a guess. */
export function findSaddle(s: Surface, guess: [number, number]): Saddle {
	let [r1, r2] = guess;
	for (let it = 0; it < 200; it++) {
		const [, g1, g2] = energyGrad(s, r1, r2);
		const [a, b, c] = hessian(s, r1, r2);
		const det = a * c - b * b;
		const d1 = (c * g1 - b * g2) / det;
		const d2 = (-b * g1 + a * g2) / det;
		r1 -= Math.max(-0.05, Math.min(0.05, d1));
		r2 -= Math.max(-0.05, Math.min(0.05, d2));
		if (Math.abs(d1) + Math.abs(d2) < 1e-10) break;
	}
	return { r1, r2, v: energy(s, r1, r2) };
}

const saddleCache = new Map<Surface['id'], Saddle>();
/** The pass of a surface (H₃ symmetric, F–H–H early in the F + H₂ valley). */
export function saddleOf(s: Surface): Saddle {
	let sd = saddleCache.get(s.id);
	if (!sd) {
		sd = findSaddle(s, s.id === 'h3' ? [0.93, 0.93] : [1.5, 0.77]);
		saddleCache.set(s.id, sd);
	}
	return sd;
}

// ---- diatomics -------------------------------------------------------------------------

/** Angular frequency (rad/fs) of a Morse bond with reduced mass μ (u). */
export function morseOmega(p: Pair, mu: number): number {
	return p.beta * Math.sqrt(((2 * p.D) / mu) * ACC);
}

/** Wavenumber (cm⁻¹) of an angular frequency in rad/fs. */
export const wavenumber = (omega: number) => omega / (2 * Math.PI * C_CM_FS);

/**
 * Energy of vibrational level v of a Morse bond, above the bottom of its well (eV):
 * ħω(v+½) − (ħω)²(v+½)²/(4D).
 */
export function morseLevel(p: Pair, mu: number, v: number): number {
	const hw = HBAR * morseOmega(p, mu);
	const n = v + 0.5;
	return hw * n - (hw * hw * n * n) / (4 * p.D);
}

/** The highest bound level of a Morse bond. */
export function maxLevel(p: Pair, mu: number): number {
	const hw = HBAR * morseOmega(p, mu);
	return Math.floor((2 * p.D) / hw - 0.5);
}

// ---- the pass's own vibration ------------------------------------------------------------

/**
 * The collinear normal modes at the pass for masses X, Y, Z: the bound (symmetric-stretch)
 * frequency, and the imaginary one along the reaction path (both rad/fs). Eigenvalues of G·F,
 * F the Hessian in (r₁, r₂), G the inverse-mass matrix of the two bonds.
 */
export function saddleModes(
	s: Surface,
	m: [number, number, number]
): { stretch: number; imaginary: number } {
	const sd = saddleOf(s);
	const [f11, f12, f22] = hessian(s, sd.r1, sd.r2);
	const [mx, my, mz] = m;
	const g11 = 1 / mx + 1 / my,
		g12 = -1 / my,
		g22 = 1 / my + 1 / mz;
	const a = g11 * f11 + g12 * f12,
		b = g11 * f12 + g12 * f22,
		c = g12 * f11 + g22 * f12,
		d = g12 * f12 + g22 * f22;
	const tr = a + d,
		det = a * d - b * c;
	const disc = Math.sqrt((tr * tr) / 4 - det);
	const l1 = (tr / 2 + disc) * ACC,
		l2 = (tr / 2 - disc) * ACC;
	return { stretch: Math.sqrt(l1), imaginary: Math.sqrt(-l2) };
}
