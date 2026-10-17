/**
 * The model behind the GPS explainer.
 *
 * - Satellite positions from the broadcast almanac (`almanac.ts`), with the algorithm of the
 *   GPS interface specification (IS-GPS-200, table 20-IV): Kepler's equation for the orbit,
 *   then a rotation into the Earth-fixed frame.
 * - Positioning: each measured range ("pseudorange") is the true distance plus the speed of
 *   light times the receiver's clock error. Gauss–Newton least squares solves for the
 *   position (2 or 3 coordinates) and, optionally, the clock error.
 * - Dilution of precision from the geometry of the satellites.
 * - The relativistic rate of the satellite clocks, after N. Ashby, "Relativity in the Global
 *   Positioning System", Living Reviews in Relativity 6, 1 (2003).
 *
 * Units: metres and seconds throughout (a clock error is often carried as a length, c·b).
 */
import { ALMANAC, ALMANAC_TOA, type AlmanacEntry } from './almanac';
import { rng } from '#lib/draw/math.ts';

// ---- constants ------------------------------------------------------------------------------

/** Speed of light (m/s), exact. */
export const C = 299_792_458;
/** Earth's gravitational parameter as GPS uses it (IS-GPS-200), m³/s². */
export const MU = 3.986005e14;
/** Earth's rotation rate (WGS 84), rad/s. */
const OMEGA_E = 7.2921151467e-5;
/** WGS 84 ellipsoid: equatorial radius (m) and flattening. */
const WGS84_A = 6_378_137;
const WGS84_F = 1 / 298.257223563;
/** Earth's oblateness coefficient J₂ (WGS 84). */
const J2 = 1.08263e-3;
/** Relativistic eccentricity constant F = −2√μ/c² (IS-GPS-200), s/√m. */
const F_REL = (-2 * Math.sqrt(MU)) / (C * C);
export const DAY = 86_400;
/** Mean radius of the Earth (IUGG), m. */
export const R_EARTH = 6_371_000;

export type Vec = number[];

const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
const norm = (a: Vec) => Math.hypot(...a);
const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);

// ---- the constellation --------------------------------------------------------------------

interface SatState {
	prn: number;
	/** Position (m) in the Earth-fixed frame (ECEF). */
	ecef: Vec;
	/** Position (m) in a frame that does not turn with the Earth, lined up with ECEF at t = 0. */
	eci: Vec;
	/** Eccentric anomaly (rad), for the relativistic eccentricity term. */
	E: number;
}

/** Solves Kepler's equation M = E − e sin E by Newton's method. */
function eccentricAnomaly(M: number, e: number): number {
	let E = M;
	for (let k = 0; k < 20; k++) {
		const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		E -= d;
		if (Math.abs(d) < 1e-14) break;
	}
	return E;
}

/**
 * Where satellite `s` is, `tk` seconds after the almanac's time of applicability
 * (IS-GPS-200 table 20-IV, without the ephemeris's small harmonic corrections).
 */
export function satellite(s: AlmanacEntry, tk: number): SatState {
	const A = s.sqrtA * s.sqrtA;
	const n = Math.sqrt(MU / (A * A * A));
	const E = eccentricAnomaly(s.m0 + n * tk, s.e);
	const nu = Math.atan2(Math.sqrt(1 - s.e * s.e) * Math.sin(E), Math.cos(E) - s.e);
	const phi = nu + s.w;
	const r = A * (1 - s.e * Math.cos(E));
	const xo = r * Math.cos(phi);
	const yo = r * Math.sin(phi);
	const ci = Math.cos(s.i0);
	const si = Math.sin(s.i0);
	const place = (node: number): Vec => [
		xo * Math.cos(node) - yo * ci * Math.sin(node),
		xo * Math.sin(node) + yo * ci * Math.cos(node),
		yo * si
	];
	// The node's longitude is counted from Greenwich at the start of the GPS week; the Earth
	// turns under it at OMEGA_E.
	const nodeEcef = s.omega0 + (s.omegaDot - OMEGA_E) * tk - OMEGA_E * ALMANAC_TOA;
	return { prn: s.prn, ecef: place(nodeEcef), eci: place(nodeEcef + earthAngle(tk)), E };
}

/** Angle the Earth has turned (rad) since the frame of `eci` was lined up with it. */
export const earthAngle = (tk: number) => OMEGA_E * (ALMANAC_TOA + tk);

export const constellation = (tk: number, almanac: readonly AlmanacEntry[] = ALMANAC) =>
	almanac.map((s) => satellite(s, tk));

/** Orbital period (s) of a satellite with semi-major axis `a` (Kepler's third law). */
export const period = (a: number) => 2 * Math.PI * Math.sqrt((a * a * a) / MU);

// ---- places on the Earth -------------------------------------------------------------------

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const E2 = WGS84_F * (2 - WGS84_F);

/** Latitude, longitude (degrees) and height (m) on the WGS 84 ellipsoid → ECEF (m). */
export function geodeticToEcef(lat: number, lon: number, h = 0): Vec {
	const p = toRad(lat);
	const l = toRad(lon);
	const N = WGS84_A / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
	return [
		(N + h) * Math.cos(p) * Math.cos(l),
		(N + h) * Math.cos(p) * Math.sin(l),
		(N * (1 - E2) + h) * Math.sin(p)
	];
}

/** Unit vectors east, north and up at a latitude and longitude (degrees). */
function enuBasis(lat: number, lon: number): [Vec, Vec, Vec] {
	const p = toRad(lat);
	const l = toRad(lon);
	return [
		[-Math.sin(l), Math.cos(l), 0],
		[-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)],
		[Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]
	];
}

/** A vector (m) split into east, north and up at a place. */
function toEnu(v: Vec, lat: number, lon: number): Vec {
	const [e, n, u] = enuBasis(lat, lon);
	return [dot(v, e), dot(v, n), dot(v, u)];
}

/** Elevation above the horizon and azimuth from north (degrees) of `sat` seen from `rx`. */
function lookAngles(sat: Vec, rx: Vec, lat: number, lon: number) {
	const [e, n, u] = toEnu(sub(sat, rx), lat, lon);
	return {
		elevation: toDeg(Math.atan2(u, Math.hypot(e, n))),
		azimuth: (toDeg(Math.atan2(e, n)) + 360) % 360
	};
}

/** The satellites at least `mask` degrees above the horizon of a place. */
export function visible(sats: SatState[], lat: number, lon: number, mask = 10) {
	const rx = geodeticToEcef(lat, lon);
	return sats
		.map((s) => ({ ...s, ...lookAngles(s.ecef, rx, lat, lon) }))
		.filter((s) => s.elevation >= mask);
}

/**
 * Each satellite's path across the sky of a place over a day (above the horizon, sampled every
 * `stepS` seconds): its points and the indices where a new pass starts.
 */
export function skyTracks(lat: number, lon: number, stepS = 900) {
	const tracks = new Map<
		number,
		{
			prn: number;
			points: { azimuth: number; elevation: number }[];
			breaks: number[];
			last: number;
		}
	>();
	for (let k = 0; k * stepS <= DAY; k++) {
		for (const v of visible(constellation(k * stepS), lat, lon, 0)) {
			let tr = tracks.get(v.prn);
			if (!tr) tracks.set(v.prn, (tr = { prn: v.prn, points: [], breaks: [], last: -2 }));
			if (tr.last !== k - 1 && tr.points.length) tr.breaks.push(tr.points.length);
			tr.points.push({ azimuth: v.azimuth, elevation: v.elevation });
			tr.last = k;
		}
	}
	return [...tracks.values()];
}

// ---- linear algebra for the small normal equations --------------------------------------

/** Inverse of a small square matrix (Gauss–Jordan); null if it is singular. */
function inverse(m: number[][]): number[][] | null {
	const n = m.length;
	const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
	for (let c = 0; c < n; c++) {
		let p = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
		if (Math.abs(a[p][c]) < 1e-12) return null;
		[a[c], a[p]] = [a[p], a[c]];
		const d = a[c][c];
		for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = a[r][c];
			if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j];
		}
	}
	return a.map((row) => row.slice(n));
}

const normal = (H: number[][]) =>
	H[0].map((_, i) => H[0].map((_, j) => H.reduce((s, row) => s + row[i] * row[j], 0)));

// ---- positioning ---------------------------------------------------------------------------

/**
 * Measured ranges from a receiver at `rx` whose clock is off by `clock` (expressed as a
 * length, c × the clock error: positive when the receiver's clock is fast). `satErr` adds an
 * error of each satellite's own (positive: the satellite's clock is fast, which makes its
 * signal look as if it left later, and its range shorter).
 */
export function pseudoranges(sats: Vec[], rx: Vec, clock = 0, satErr: number[] = []): number[] {
	return sats.map((s, i) => norm(sub(s, rx)) + clock - (satErr[i] ?? 0));
}

interface Fix {
	/** Solved position (m). */
	pos: Vec;
	/** Solved receiver clock error, as a length c·b (m); the assumed one if not solved for. */
	clock: number;
	/** Range residuals left after the fit (m): measured minus predicted. */
	residuals: number[];
	iterations: number;
	converged: boolean;
	/** The estimate after each iteration (position, clock), starting with the first guess. */
	path: { pos: Vec; clock: number }[];
}

/**
 * Least-squares position fix (Gauss–Newton) from satellite positions and measured ranges.
 * With `solveClock` the receiver's clock error is a fourth unknown (third on a flat map);
 * without it, the receiver trusts its own clock and takes the error to be `clock`. Starts
 * from `start` (by default the centre of the Earth, as a receiver with no idea where it is).
 * Returns null when there are fewer measurements than unknowns or the geometry is singular.
 */
export function solve(
	sats: Vec[],
	ranges: number[],
	opts: { solveClock?: boolean; clock?: number; start?: Vec; maxIter?: number } = {}
): Fix | null {
	const solveClock = opts.solveClock ?? true;
	const dim = sats[0]?.length ?? 0;
	const unknowns = dim + (solveClock ? 1 : 0);
	if (sats.length < unknowns || dim === 0) return null;
	let x: Vec = [...(opts.start ?? Array.from({ length: dim }, () => 0))];
	let b = opts.clock ?? 0;
	const maxIter = opts.maxIter ?? 30;
	let residuals: number[] = [];
	const path = [{ pos: [...x], clock: b }];
	for (let it = 1; it <= maxIter; it++) {
		const H: number[][] = [];
		residuals = sats.map((s, i) => {
			const d = sub(x, s);
			const r = norm(d);
			const u = d.map((v) => v / (r || 1));
			H.push(solveClock ? [...u, 1] : u);
			return ranges[i] - (r + b);
		});
		const Q = inverse(normal(H));
		if (!Q) return null;
		const g = H[0].map((_, j) => H.reduce((s, row, i) => s + row[j] * residuals[i], 0));
		const dx = Q.map((row) => dot(row, g));
		x = x.map((v, i) => v + dx[i]);
		if (solveClock) b += dx[dim];
		path.push({ pos: [...x], clock: b });
		if (norm(dx) < 1e-6) {
			residuals = sats.map((s, i) => ranges[i] - (norm(sub(x, s)) + b));
			return { pos: x, clock: b, residuals, iterations: it, converged: true, path };
		}
	}
	return { pos: x, clock: b, residuals, iterations: maxIter, converged: false, path };
}

/** Root-mean-square of the residuals (m): how badly the circles or spheres fail to meet. */
export const rms = (r: number[]) => Math.sqrt(r.reduce((s, v) => s + v * v, 0) / (r.length || 1));

// ---- dilution of precision -----------------------------------------------------------------

interface Dop {
	gdop: number;
	pdop: number;
	hdop: number;
	vdop: number;
	tdop: number;
	/** (HᵀH)⁻¹ in east, north, up, clock. */
	Q: number[][];
	/** Least-squares gain (HᵀH)⁻¹Hᵀ: maps range errors to position and clock errors. */
	gain: number[][];
}

/**
 * Dilution of precision for satellites seen in the directions (elevation, azimuth in degrees),
 * in local east, north, up and clock (GDOP = √trace (HᵀH)⁻¹). Null for fewer than four or a
 * degenerate geometry.
 */
export function dop(dirs: { elevation: number; azimuth: number }[]): Dop | null {
	if (dirs.length < 4) return null;
	const H = dirs.map(({ elevation, azimuth }) => {
		const el = toRad(elevation);
		const az = toRad(azimuth);
		// Row: derivative of the range with respect to (east, north, up, clock).
		return [-Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), -Math.sin(el), 1];
	});
	const Q = inverse(normal(H));
	if (!Q) return null;
	const gain = Q.map((row) => H.map((h) => dot(row, h)));
	const d = (i: number) => Q[i][i];
	if (d(0) + d(1) + d(2) + d(3) > 1e8) return null;
	return {
		gdop: Math.sqrt(d(0) + d(1) + d(2) + d(3)),
		pdop: Math.sqrt(d(0) + d(1) + d(2)),
		hdop: Math.sqrt(d(0) + d(1)),
		vdop: Math.sqrt(d(2)),
		tdop: Math.sqrt(d(3)),
		Q,
		gain
	};
}

/** Error of the fix (east, north, up, clock in m) caused by errors `eps` in the ranges. */
export const fixError = (D: Dop, eps: number[]) => D.gain.map((row) => dot(row, eps));

// ---- reproducible noise ----------------------------------------------------------------------

/** Standard normal numbers (Box–Muller) from a uniform generator. */
export function gaussians(n: number, seed: number): number[] {
	const u = rng(seed);
	return Array.from({ length: n }, () => {
		const a = Math.max(u(), 1e-12);
		return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
	});
}

// ---- relativity --------------------------------------------------------------------------

/**
 * Effective potential on the geoid divided by c² (gravity, oblateness J₂ and the Earth's
 * rotation), the rate of a clock on the ground. Ashby (2003) gives −6.96927 × 10⁻¹⁰.
 */
export const PHI0_C2 =
	-(MU / (C * C * WGS84_A)) * (1 + J2 / 2) - (OMEGA_E * WGS84_A) ** 2 / (2 * C * C);

/**
 * Fractional rate of a clock in a circular orbit of radius `a` (m) compared with a clock on
 * the ground: `gravity` (positive: higher up, time runs faster), `speed` (negative: the
 * moving clock runs slow, v² = μ/a) and their sum.
 */
export function clockRate(a: number) {
	const gravity = -MU / (a * C * C) - PHI0_C2;
	const speed = -MU / (2 * a * C * C);
	return { gravity, speed, net: gravity + speed };
}

/** The same in microseconds gained per day. */
export function microsPerDay(a: number) {
	const r = clockRate(a);
	return { gravity: r.gravity * DAY * 1e6, speed: r.speed * DAY * 1e6, net: r.net * DAY * 1e6 };
}

/** Orbit radius (m) at which the two effects cancel: a = −3μ / (2 Φ₀). */
export const crossoverRadius = (-3 * MU) / (2 * PHI0_C2 * C * C);

/** GPS's nominal semi-major axis (m): 26 561.75 km (Ashby 2003). */
export const A_GPS = 26_561_750;

/**
 * The periodic relativistic clock term of an eccentric orbit, Δt = F e √A sin E (s); the
 * receiver corrects it satellite by satellite.
 */
export const eccentricityTerm = (s: AlmanacEntry, E: number) => F_REL * s.e * s.sqrtA * Math.sin(E);

// ---- a receiver on the Earth, all together ----------------------------------------------------

interface Scenario {
	/** Satellites in view (ECEF), with their PRN, elevation and azimuth. */
	sats: (SatState & { elevation: number; azimuth: number })[];
	rx: Vec;
	/** The fix of a receiver that solves for its own clock. */
	solved: Fix | null;
	/** The fix of a receiver that trusts its own (perfect) clock. */
	trusting: Fix | null;
	/** Errors of the two fixes, east/north/up (m). */
	solvedErr: Vec | null;
	trustingErr: Vec | null;
	dop: Dop | null;
}

/**
 * A receiver at a place, `tk` seconds after the almanac's epoch, with every satellite clock
 * left `days` days without the relativity rate correction (each runs fast by 38.6 µs a day),
 * and optionally without the eccentricity term. The receiver's own clock is perfect.
 */
export function scenario(
	lat: number,
	lon: number,
	tk: number,
	opts: { days?: number; eccentricity?: boolean; mask?: number } = {}
): Scenario {
	const days = opts.days ?? 0;
	const sats = visible(constellation(tk), lat, lon, opts.mask ?? 10);
	const rx = geodeticToEcef(lat, lon);
	const drift = microsPerDay(A_GPS).net * 1e-6 * days * C;
	const byPrn = new Map(ALMANAC.map((s) => [s.prn, s]));
	const satErr = sats.map((s) => {
		const ecc = opts.eccentricity ? eccentricityTerm(byPrn.get(s.prn)!, s.E) * C : 0;
		// A satellite clock running fast makes its range look shorter (see `pseudoranges`).
		return drift + ecc;
	});
	const pos = sats.map((s) => s.ecef);
	const ranges = pseudoranges(pos, rx, 0, satErr);
	const solved = solve(pos, ranges, { solveClock: true });
	const trusting = solve(pos, ranges, { solveClock: false, clock: 0 });
	const err = (f: Fix | null) => (f ? toEnu(sub(f.pos, rx), lat, lon) : null);
	return {
		sats,
		rx,
		solved,
		trusting,
		solvedErr: err(solved),
		trustingErr: err(trusting),
		dop: dop(sats)
	};
}

export { norm, sub, dot, toRad, toDeg };
