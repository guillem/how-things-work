/**
 * Electromagnetism: the model behind the explainer. SI units throughout
 * (metres, seconds, coulombs, amperes, newtons, teslas, webers, volts).
 *
 * 1. Electric field of point charges (Coulomb's law, superposed):
 *      E(r) = Σ k qᵢ (r − rᵢ) / |r − rᵢ|³,   F = q E.
 *    The charges sit in one plane and we draw the field in that plane; the
 *    field is the real 3-D one, but the density of the drawn field lines in a
 *    flat slice is only qualitative (in 3-D it is the lines per area that
 *    measure the field).
 * 2. Magnetic field of a long straight wire: B = μ₀ I / (2π r), circling the
 *    wire (right-hand rule). A compass needle lines up with the sum of the
 *    wire's field and the horizontal part of the Earth's field.
 * 3. Circular current loops, exactly (complete elliptic integrals K, E):
 *    the field (B_z, B_ρ) anywhere in a plane through the axis, and the flux
 *    through a second coaxial loop (the mutual inductance). A coil is a stack
 *    of loops; a uniformly magnetised bar magnet is exactly a coil of surface
 *    current K = M = B_r/μ₀ (Ampère's equivalence), modelled with 40 loops.
 * 4. Induction (Faraday): emf = −dΦ/dt, from the flux through the pickup coil
 *    as the magnet moves (dΦ/dz · v) or as the current in a neighbouring coil
 *    changes (M dI/dt). The current is emf / R: the pickup coil's own
 *    inductance is neglected (ωL ≪ R at these slow, hand-made frequencies).
 * 5. A plane electromagnetic wave switched on at t = 0 by a source at x = 0:
 *    E_y = E₀ sin(ω(t − x/c)) behind the front, B_z = E_y / c, in phase;
 *    c = 1/√(μ₀ε₀).
 */

export const K_E = 8.9875517923e9; // Coulomb constant, N·m²/C²
export const MU0 = 1.25663706212e-6; // vacuum permeability, T·m/A
export const EPS0 = 8.8541878128e-12; // vacuum permittivity, F/m
/** Speed of light from Maxwell's constants, 1/√(μ₀ε₀) ≈ 2.998 × 10⁸ m/s. */
export const C = 1 / Math.sqrt(MU0 * EPS0);
/** Horizontal part of the Earth's magnetic field in much of Europe, ≈ 20 µT. */
export const EARTH_H = 20e-6;

export interface Vec {
	x: number;
	y: number;
}

// ---------------------------------------------------------------- 1. charges

export interface Charge {
	x: number;
	y: number;
	/** Charge in coulombs. */
	q: number;
}

/** Electric field (N/C) at (x, y) from the charges; zero inside a charge's own core. */
export function fieldAt(charges: readonly Charge[], x: number, y: number, core = 0): Vec {
	let ex = 0;
	let ey = 0;
	for (const c of charges) {
		const dx = x - c.x;
		const dy = y - c.y;
		const r2 = dx * dx + dy * dy;
		if (r2 <= core * core || r2 === 0) continue;
		const s = (K_E * c.q) / (r2 * Math.sqrt(r2));
		ex += s * dx;
		ey += s * dy;
	}
	return { x: ex, y: ey };
}

/** Force (N) on a test charge q at (x, y): F = q E. */
export function forceOn(charges: readonly Charge[], test: Charge): Vec {
	const e = fieldAt(charges, test.x, test.y);
	return { x: test.q * e.x, y: test.q * e.y };
}

/** Electric potential (V) at (x, y): Σ k q / r. */
export function potentialAt(charges: readonly Charge[], x: number, y: number) {
	let v = 0;
	for (const c of charges) v += (K_E * c.q) / Math.hypot(x - c.x, y - c.y);
	return v;
}

export interface FieldLineOptions {
	/** Lines leaving a charge of `unit` coulombs (more for bigger charges). */
	linesPerUnit: number;
	unit: number;
	/** Region to trace in; lines stop when they leave it. */
	bounds: { x0: number; y0: number; x1: number; y1: number };
	/** Step length and the radius around a charge where a line starts or ends. */
	step: number;
	radius: number;
	/** Longest line, in steps. */
	maxSteps?: number;
}

export interface FieldLine {
	points: Vec[];
	/** Index of the charge the line starts from (its + end), or −1 (from the edge). */
	from: number;
	/** Index of the charge it ends on (its − end), or −1 (it leaves the region). */
	to: number;
}

/**
 * Field lines of a set of point charges. Each charge sends out (or takes in)
 * a number of lines proportional to |q|. Lines are traced forward along E
 * from the positive charges; then each negative charge gets backward-traced
 * lines for the share that no positive charge supplied, at angles away from
 * the lines that already arrive. Lines always run from + to − (or to/from the
 * edge of the region) and never cross.
 */
export function fieldLines(charges: readonly Charge[], o: FieldLineOptions): FieldLine[] {
	const lines: FieldLine[] = [];
	const count = (q: number) => Math.max(0, Math.round((Math.abs(q) / o.unit) * o.linesPerUnit));
	const arrivals: number[][] = charges.map(() => []);

	const trace = (start: Vec, dir: 1 | -1, from: number) => {
		const pts: Vec[] = [start];
		let p = start;
		let hit = -1;
		const maxSteps = o.maxSteps ?? 2000;
		const unitField = (q: Vec): Vec | null => {
			const e = fieldAt(charges, q.x, q.y);
			const m = Math.hypot(e.x, e.y);
			if (!(m > 0) || !Number.isFinite(m)) return null;
			return { x: (dir * e.x) / m, y: (dir * e.y) / m };
		};
		for (let i = 0; i < maxSteps; i++) {
			// Smaller steps near charges, where the field turns fastest.
			let near = Infinity;
			for (const c of charges) near = Math.min(near, Math.hypot(p.x - c.x, p.y - c.y));
			const h = Math.max(o.step * 0.25, Math.min(o.step, near * 0.25));
			const k1 = unitField(p);
			if (!k1) break;
			const k2 = unitField({ x: p.x + (h / 2) * k1.x, y: p.y + (h / 2) * k1.y });
			if (!k2) break;
			const k3 = unitField({ x: p.x + (h / 2) * k2.x, y: p.y + (h / 2) * k2.y });
			if (!k3) break;
			const k4 = unitField({ x: p.x + h * k3.x, y: p.y + h * k3.y });
			if (!k4) break;
			p = {
				x: p.x + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
				y: p.y + (h / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)
			};
			pts.push(p);
			const { x0, y0, x1, y1 } = o.bounds;
			if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) break;
			let done = false;
			charges.forEach((c, j) => {
				if (done || j === from) return;
				// A line ends on a charge of the opposite kind to where it heads.
				if (Math.sign(c.q) !== -dir) return;
				const d = Math.hypot(p.x - c.x, p.y - c.y);
				if (d < o.radius) {
					hit = j;
					done = true;
				}
			});
			if (done) {
				const c = charges[hit];
				pts.push({
					x: c.x + ((p.x - c.x) * o.radius * 0.5) / Math.hypot(p.x - c.x, p.y - c.y),
					y: c.y + ((p.y - c.y) * o.radius * 0.5) / Math.hypot(p.x - c.x, p.y - c.y)
				});
				break;
			}
		}
		return { pts, hit };
	};

	charges.forEach((c, i) => {
		if (c.q <= 0) return;
		const n = count(c.q);
		for (let k = 0; k < n; k++) {
			const a = ((k + 0.5) / n) * 2 * Math.PI;
			const start = { x: c.x + o.radius * Math.cos(a), y: c.y + o.radius * Math.sin(a) };
			const { pts, hit } = trace(start, 1, i);
			if (hit >= 0) {
				const h = charges[hit];
				const last = pts[pts.length - 2] ?? pts[0];
				arrivals[hit].push(Math.atan2(last.y - h.y, last.x - h.x));
			}
			lines.push({ points: pts, from: i, to: hit });
		}
	});

	charges.forEach((c, i) => {
		if (c.q >= 0) return;
		const n = count(c.q);
		const missing = n - arrivals[i].length;
		if (missing <= 0) return;
		const gap = (2 * Math.PI) / n;
		// Candidate angles evenly spaced; keep those furthest from the arrivals.
		const cands: { a: number; d: number }[] = [];
		const m = n * 4;
		for (let k = 0; k < m; k++) {
			const a = ((k + 0.5) / m) * 2 * Math.PI;
			let d = Infinity;
			for (const b of arrivals[i]) {
				const diff = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
				d = Math.min(d, diff);
			}
			cands.push({ a, d });
		}
		const chosen: number[] = [];
		for (let k = 0; k < missing; k++) {
			let best = -1;
			let bestD = -1;
			cands.forEach((cd, j) => {
				let d = cd.d;
				for (const b of chosen) {
					const diff = Math.abs(Math.atan2(Math.sin(cd.a - b), Math.cos(cd.a - b)));
					d = Math.min(d, diff);
				}
				if (d > bestD + 1e-9) {
					bestD = d;
					best = j;
				}
			});
			if (best < 0 || bestD < gap * 0.35) break;
			chosen.push(cands[best].a);
		}
		for (const a of chosen) {
			const start = { x: c.x + o.radius * Math.cos(a), y: c.y + o.radius * Math.sin(a) };
			const { pts } = trace(start, -1, i);
			// Stored from the + end (the edge) to the − charge.
			lines.push({ points: pts.reverse(), from: -1, to: i });
		}
	});
	return lines;
}

// ---------------------------------------------------------------- 2. a straight wire

/** Field (T) at distance r (m) from a long straight wire carrying I (A): μ₀I/(2πr). */
export const wireField = (I: number, r: number) => (MU0 * I) / (2 * Math.PI * r);

/**
 * Field (T) at (x, y) (m, y pointing north) next to a wire through the origin
 * carrying I amperes out of the page (I < 0: into the page), plus the Earth's
 * horizontal field `earth` pointing north. Out of the page, the wire's field
 * circles anticlockwise seen from above.
 */
export function compassField(I: number, x: number, y: number, earth = EARTH_H): Vec {
	const r2 = x * x + y * y;
	const s = (MU0 * I) / (2 * Math.PI * r2);
	return { x: -s * y, y: s * x + earth };
}

// ---------------------------------------------------------------- 3. current loops

/** Complete elliptic integrals of the first and second kind, K(m) and E(m), m = k². */
export function ellipticKE(m: number): { K: number; E: number } {
	if (m >= 1) return { K: Infinity, E: 1 };
	let a = 1;
	let b = Math.sqrt(1 - m);
	let c = Math.sqrt(m);
	let sum = 0.5 * c * c;
	let pow = 0.5;
	for (let i = 0; i < 40 && Math.abs(c) > 1e-15; i++) {
		const an = (a + b) / 2;
		const bn = Math.sqrt(a * b);
		c = (a - b) / 2;
		pow *= 2;
		sum += pow * c * c;
		a = an;
		b = bn;
	}
	const K = Math.PI / (2 * a);
	return { K, E: K * (1 - sum) };
}

/** A circular current loop around the z axis: radius a (m), at height z0 (m), current I (A). */
export interface Loop {
	a: number;
	z: number;
	I: number;
}

/** Field (T) of one loop at (ρ, z) in a plane through its axis: { z: B_z, rho: B_ρ }. */
export function loopField(loop: Loop, rho: number, z: number): { z: number; rho: number } {
	const { a, I } = loop;
	const dz = z - loop.z;
	const r = Math.abs(rho);
	const q = (a + r) ** 2 + dz * dz;
	const d = (a - r) ** 2 + dz * dz;
	if (d < 1e-18) return { z: 0, rho: 0 };
	const m = (4 * a * r) / q;
	const { K, E } = ellipticKE(m);
	const pre = (MU0 * I) / (2 * Math.PI * Math.sqrt(q));
	const bz = pre * (K + ((a * a - r * r - dz * dz) / d) * E);
	// B_ρ → 0 on the axis; use the leading term there to avoid 0/0.
	let br: number;
	if (r < 1e-9 * a) br = 0;
	else br = ((pre * dz) / r) * (-K + ((a * a + r * r + dz * dz) / d) * E);
	return { z: bz, rho: rho < 0 ? -br : br };
}

/**
 * Flux (Wb) of one loop through a coaxial circle of radius b at height z:
 * Φ = 2π b A_φ(b, z), with A_φ = (μ₀ I / πk) √(a/b) [(1 − k²/2) K − E].
 * Φ / I is the mutual inductance of the two circles.
 */
export function loopFlux(loop: Loop, b: number, z: number): number {
	const { a, I } = loop;
	const dz = z - loop.z;
	const m = (4 * a * b) / ((a + b) ** 2 + dz * dz);
	if (m <= 0) return 0;
	const k = Math.sqrt(m);
	const { K, E } = ellipticKE(m);
	const Aphi = ((MU0 * I) / (Math.PI * k)) * Math.sqrt(a / b) * ((1 - m / 2) * K - E);
	return 2 * Math.PI * b * Aphi;
}

/** Field on the axis of a loop, μ₀ I a² / (2 (a² + z²)^{3/2}): the reference for tests. */
export const loopAxisField = (loop: Loop, z: number) =>
	(MU0 * loop.I * loop.a ** 2) / (2 * (loop.a ** 2 + (z - loop.z) ** 2) ** 1.5);

export interface Coil {
	/** Radius (m), length (m), centre (m), turns, current (A). */
	a: number;
	length: number;
	z: number;
	turns: number;
	I: number;
}

/**
 * A coil as `slices` loops spread evenly along its length, each carrying the
 * current of turns/slices turns (a thin winding).
 */
export function coilLoops(c: Coil, slices = 12): Loop[] {
	const n = Math.max(1, slices);
	return Array.from({ length: n }, (_, i) => ({
		a: c.a,
		z: c.z + (n === 1 ? 0 : (i / (n - 1) - 0.5) * c.length),
		I: (c.I * c.turns) / n
	}));
}

export interface BarMagnet {
	/** Radius (m), length (m), centre (m), remanence B_r (T); north pole towards +z. */
	a: number;
	length: number;
	z: number;
	Br: number;
}

/**
 * A uniformly magnetised cylinder is exactly a sheet of surface current
 * K = M = B_r/μ₀ (A/m) wrapped round it: a coil with turns·I = K·length.
 */
export const magnetLoops = (m: BarMagnet, slices = 40): Loop[] =>
	coilLoops({ a: m.a, length: m.length, z: m.z, turns: 1, I: (m.Br / MU0) * m.length }, slices);

/** Magnetic moment (A·m²) of the magnet: M × volume. */
export const magnetMoment = (m: BarMagnet) => (m.Br / MU0) * Math.PI * m.a * m.a * m.length;

/** Field (T) of a set of loops at (ρ, z). */
export function loopsField(loops: readonly Loop[], rho: number, z: number) {
	let bz = 0;
	let br = 0;
	for (const l of loops) {
		const f = loopField(l, rho, z);
		bz += f.z;
		br += f.rho;
	}
	return { z: bz, rho: br };
}

/** Total flux (Wb·turns) linked by a pickup coil: Σ over its turns of each source loop's flux. */
export function linkedFlux(sources: readonly Loop[], pickup: Coil, slices = 6): number {
	const n = Math.max(1, slices);
	let total = 0;
	for (let i = 0; i < n; i++) {
		const z = pickup.z + (n === 1 ? 0 : (i / (n - 1) - 0.5) * pickup.length);
		for (const s of sources) total += loopFlux(s, pickup.a, z);
	}
	return (total * pickup.turns) / n;
}

/** Mutual inductance (H) of two coaxial coils. */
export function mutualInductance(a: Coil, b: Coil): number {
	return linkedFlux(coilLoops({ ...a, I: 1 }, 6), b);
}

// ---------------------------------------------------------------- 4. induction

/** The demonstration kit: a bar magnet, a pickup coil and its meter, a second coil. */
export const MAGNET: BarMagnet = { a: 0.005, length: 0.04, z: 0, Br: 1.2 };
export const PICKUP: Coil = { a: 0.02, length: 0.012, z: 0, turns: 200, I: 0 };
/** Resistance of the pickup coil and its meter (Ω). */
export const R_PICKUP = 10;

/** Flux linkage (Wb·turns) of the pickup when the magnet's centre is at z (north pole towards +z). */
export function magnetLinkage(z: number, turns = PICKUP.turns, magnet = MAGNET) {
	return linkedFlux(magnetLoops({ ...magnet, z }, 20), { ...PICKUP, turns });
}

/** dΦ/dz (Wb·turns per metre) for the magnet at z, by a central difference. */
export function magnetLinkageSlope(z: number, turns = PICKUP.turns, magnet = MAGNET) {
	const h = 2e-4;
	return (magnetLinkage(z + h, turns, magnet) - magnetLinkage(z - h, turns, magnet)) / (2 * h);
}

/** Induced emf (V) for the magnet at z moving at v (m/s): −dΦ/dt = −(dΦ/dz)·v. */
export const magnetEmf = (z: number, v: number, turns = PICKUP.turns, magnet = MAGNET) =>
	-magnetLinkageSlope(z, turns, magnet) * v;

/**
 * Tabulated linkage Φ(z) for fast lookups in the scene (z from −zMax to zMax),
 * with the slope, by linear interpolation.
 */
export function linkageTable(turns = PICKUP.turns, zMax = 0.2, n = 401) {
	const zs = Array.from({ length: n }, (_, i) => -zMax + (2 * zMax * i) / (n - 1));
	const phi = zs.map((z) => magnetLinkage(z, turns));
	const at = (z: number) => {
		const u = ((z + zMax) / (2 * zMax)) * (n - 1);
		if (u <= 0) return phi[0];
		if (u >= n - 1) return phi[n - 1];
		const i = Math.floor(u);
		return phi[i] + (phi[i + 1] - phi[i]) * (u - i);
	};
	const slope = (z: number) => {
		const h = (2 * zMax) / (n - 1);
		return (at(z + h) - at(z - h)) / (2 * h);
	};
	return { at, slope };
}

/**
 * The magnet swinging through the coil and back: centre at −Z cos(2π f t),
 * with top speed vMax (so f = vMax / (2π Z)). Returns position and speed.
 */
export function swing(t: number, vMax: number, Z = 0.12) {
	const w = vMax / Z;
	return { z: -Z * Math.cos(w * t), v: Z * w * Math.sin(w * t), period: (2 * Math.PI) / w };
}

/** The neighbouring coil (A) and the pickup (B), coaxial, `gap` metres apart (centre to centre). */
export const COIL_A: Coil = { a: 0.02, length: 0.012, z: 0, turns: 500, I: 0 };

/**
 * Alternating current I₀ cos(2π f t) in coil A (f = 0: a steady I₀), and the
 * emf it induces in the pickup a distance `gap` away:
 * emf = −M dI/dt = M I₀ ω sin(ω t).
 */
export function neighbour(t: number, f: number, gap: number, I0 = 2) {
	const M = mutualInductance({ ...COIL_A, z: -gap }, PICKUP);
	const w = 2 * Math.PI * f;
	return {
		M,
		I1: I0 * Math.cos(w * t),
		emf: M * I0 * w * Math.sin(w * t),
		emfPeak: M * I0 * w
	};
}

// ---------------------------------------------------------------- 5. light

/** Wavelength (m) of an electromagnetic wave of frequency f (Hz): c / f. */
export const wavelength = (f: number) => C / f;

/**
 * A wave switched on at t = 0 by a source at x = 0: E_y (V/m) and B_z (T) at
 * x, t. Ahead of the front (x > c t) both are zero. E and B are in phase.
 */
export function waveAt(x: number, t: number, f: number, E0 = 1) {
	if (x > C * t || x < 0) return { E: 0, B: 0 };
	const E = E0 * Math.sin(2 * Math.PI * f * (t - x / C));
	return { E, B: E / C };
}
