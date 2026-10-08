/**
 * The models behind the ocean currents & El Niño explainer. Each is a classic,
 * deliberately simple model from the textbooks; the simplifications are stated
 * on the page.
 *
 * 1. Wind-driven gyres: Stommel (1948). A flat-bottomed rectangular ocean
 *    basin (6000 km wide, 15°N–65°N) driven by a zonal wind stress that varies
 *    with latitude (trade winds and westerlies), with linear bottom friction
 *    and the "β-effect" (the Coriolis parameter grows northwards, on a β-plane
 *    with β taken at 40°N). The steady depth-integrated flow obeys
 *        r ∇²ψ + β ∂ψ/∂x = curl τ / ρ
 *    for the transport streamfunction ψ (m³/s; eastward transport −∂ψ/∂y,
 *    northward ∂ψ/∂x), with ψ = 0 on the coasts. It is solved exactly: the
 *    wind-stress curl is expanded in a sine series in latitude and each mode
 *    has a closed-form solution in longitude. Without β the gyres are
 *    symmetric; with it they are squeezed against the western coast (the
 *    Gulf Stream). Away from that coast the flow obeys Sverdrup's balance
 *    β·(northward transport) = curl τ / ρ.
 *    The wind's push on the sea comes from the bulk formula τ = ρ_air C_D U²,
 *    and the Ekman transport — the net drift of the wind-blown surface layer,
 *    at right angles to the wind — is τ / (ρ f).
 * 2. The deep overturning: Stommel's (1961) two-box model in the form with
 *    fixed temperatures and a freshwater flux ("mixed boundary conditions"),
 *    plus a small salt exchange by the wind-driven gyres (as in Cessi 1994).
 *    An equatorial and a polar box of Atlantic water; the overturning q is
 *    proportional to their density difference (linear equation of state):
 *        q = k (α ΔT − β_S ΔS)
 *    and the salinity difference ΔS evolves under the fresh water added to
 *    the polar box (rain, rivers, melting ice) and the salt brought back by q:
 *        V dΔS/dt = 2 (F S₀ − (|q| + K) ΔS).
 *    k and F are calibrated so that today's state has q = 17 Sv (the observed
 *    Atlantic overturning at 26°N) with a 1 psu salinity contrast and a 20 °C
 *    temperature contrast. The model has two stable states (strong overturning
 *    or a weak, reversed one) over a range of freshwater input: a tipping
 *    point with hysteresis.
 * 3. El Niño: the recharge oscillator of Jin (1997), in his non-dimensional
 *    units and with his standard parameters, for the anomalies of the eastern
 *    Pacific sea surface temperature T_E and the western thermocline depth h_W;
 *    the zonal wind anomaly over the equator responds to T_E (the Bjerknes
 *    feedback) and a burst of westerly wind can be added. The mean state —
 *    the thermocline sloping up to the east under the trade winds — comes from
 *    the zonal momentum balance of a reduced-gravity ocean,
 *        g′ H ∂h/∂x = τ / ρ.
 */

export const RHO = 1025; // kg/m³, sea water
export const RHO_AIR = 1.2; // kg/m³
export const CD = 1.3e-3; // drag coefficient of the sea surface
export const OMEGA = 7.292e-5; // rad/s
export const EARTH_RADIUS = 6.371e6; // m
export const SV = 1e6; // m³/s: one sverdrup
const rad = (d: number) => (d * Math.PI) / 180;

/** Coriolis parameter f = 2Ω sin φ (1/s). */
export const coriolis = (lat: number) => 2 * OMEGA * Math.sin(rad(lat));

/** Wind stress (N/m²) of a wind of speed U (m/s): bulk formula ρ_air C_D U|U|. */
export const windStress = (U: number) => RHO_AIR * CD * U * Math.abs(U);

// ------------------------------------------------------------ 1. gyres

export const BASIN = {
	lat0: 15,
	lat1: 65,
	/** East–west width (m). */
	width: 6.0e6
};
/** North–south extent (m). */
export const BASIN_HEIGHT = rad(BASIN.lat1 - BASIN.lat0) * EARTH_RADIUS;
/** df/dy at 40°N (1/(m·s)). */
export const BETA = (2 * OMEGA * Math.cos(rad(40))) / EARTH_RADIUS;
/**
 * Bottom-friction rate (1/s): chosen so that Stommel's western boundary layer
 * has a width r/β of 100 km.
 */
export const FRICTION = BETA * 1.0e5;

/** Default winds (m/s): trade winds near 15°N and westerlies near 45°N. */
export const TRADES = 7;
export const WESTERLIES = 9;
const WIND_WIDTH = 10; // ° (1/e half-width of each wind band)

export interface Winds {
	/** Speed of the trade winds (blowing from the east), m/s. */
	trades: number;
	/** Speed of the westerlies (blowing from the west), m/s. */
	westerlies: number;
}

/** Eastward wind stress (N/m²) at latitude φ: trades near 15°N, westerlies near 45°N. */
export function stressAt(w: Winds, lat: number) {
	const g = (c: number) => Math.exp(-(((lat - c) / WIND_WIDTH) ** 2));
	return -windStress(w.trades) * g(15) + windStress(w.westerlies) * g(45);
}

/** Northward Ekman transport (m²/s) under the zonal wind at latitude φ: −τ / (ρ f). */
export const ekmanTransport = (w: Winds, lat: number) => -stressAt(w, lat) / (RHO * coriolis(lat));

/** Latitude (°) at y metres north of the basin's southern coast. */
export const latOf = (y: number) => BASIN.lat0 + (y / BASIN_HEIGHT) * (BASIN.lat1 - BASIN.lat0);

interface Mode {
	k: number;
	P: number;
	A: number;
	B: number;
	m1: number;
	m2: number;
}

export interface Gyre {
	winds: Winds;
	/** Whether the Coriolis effect grows northwards (β ≠ 0). */
	beta: boolean;
	modes: Mode[];
}

const MODES = 48;

/**
 * Stommel's solution for the given winds. `beta = false` keeps the Coriolis
 * effect the same at all latitudes (an f-plane), which removes it from the
 * depth-integrated flow entirely.
 */
export function stommel(winds: Winds, beta = true): Gyre {
	const a = BASIN.width;
	const b = BASIN_HEIGHT;
	const Bt = beta ? BETA : 0;
	const r = FRICTION;
	// curl τ / ρ = −(1/ρ) dτ/dy, sampled on a fine grid for the sine projection
	const N = 1000;
	const dy = b / N;
	const F: number[] = [];
	for (let i = 0; i <= N; i++) {
		const y = i * dy;
		const lat = latOf(y);
		const dl = 0.01;
		const dtdlat = (stressAt(winds, lat + dl) - stressAt(winds, lat - dl)) / (2 * dl);
		const dtdy = dtdlat / (rad(1) * EARTH_RADIUS);
		F.push(-dtdy / RHO);
	}
	const modes: Mode[] = [];
	for (let n = 1; n <= MODES; n++) {
		const k = (n * Math.PI) / b;
		// Simpson's rule for (2/b) ∫ F sin(ky) dy
		let s = 0;
		for (let i = 0; i <= N; i++) {
			const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
			s += w * F[i] * Math.sin(k * i * dy);
		}
		const Fn = ((2 / b) * s * dy) / 3;
		const disc = Math.sqrt(Bt * Bt + 4 * r * r * k * k);
		const m1 = (-Bt + disc) / (2 * r);
		const m2 = (-Bt - disc) / (2 * r);
		const p = Math.exp(-m1 * a);
		const q = Math.exp(m2 * a);
		const B = (p - 1) / (1 - p * q);
		const A = -1 - q * B;
		modes.push({ k, P: -Fn / (r * k * k), A, B, m1, m2 });
	}
	return { winds, beta, modes };
}

/**
 * ψ (m³/s) and its derivatives at (x, y), in metres from the south-west
 * corner. Northward transport per metre of width is ∂ψ/∂x, eastward −∂ψ/∂y.
 */
export function psiAt(g: Gyre, x: number, y: number) {
	const a = BASIN.width;
	let psi = 0;
	let px = 0;
	let py = 0;
	for (const m of g.modes) {
		const e1 = Math.exp(m.m1 * (x - a));
		const e2 = Math.exp(m.m2 * x);
		const X = m.P * (1 + m.A * e1 + m.B * e2);
		const Xp = m.P * (m.A * m.m1 * e1 + m.B * m.m2 * e2);
		const s = Math.sin(m.k * y);
		psi += X * s;
		px += Xp * s;
		py += X * m.k * Math.cos(m.k * y);
	}
	return { psi, px, py };
}

/** Depth-integrated velocity (m²/s): eastward u, northward v. */
export function flowAt(g: Gyre, x: number, y: number) {
	const { px, py } = psiAt(g, x, y);
	return { u: -py, v: px };
}

/**
 * The strongest clockwise (subtropical, ψ > 0) and anticlockwise (subpolar,
 * ψ < 0) circulation, found on a grid fine enough near the west coast to
 * resolve the boundary current.
 */
export function gyreExtremes(g: Gyre) {
	let max = { psi: 0, x: 0, y: 0 };
	let min = { psi: 0, x: 0, y: 0 };
	const xs: number[] = [];
	for (let i = 1; i < 40; i++) xs.push(i * 15e3);
	for (let i = 1; i < 60; i++) xs.push(600e3 + (i / 60) * (BASIN.width - 600e3));
	for (let j = 1; j < 100; j++) {
		const y = (j / 100) * BASIN_HEIGHT;
		for (const x of xs) {
			const { psi } = psiAt(g, x, y);
			if (psi > max.psi) max = { psi, x, y };
			if (psi < min.psi) min = { psi, x, y };
		}
	}
	return { max, min };
}

/**
 * Western intensification: the fastest northward or southward flow within
 * 600 km of the west coast against the fastest in the open ocean east of it,
 * along the latitude of the subtropical gyre's centre.
 */
export function westEastSpeeds(g: Gyre, y: number) {
	let west = 0;
	let interior = 0;
	for (let x = 2e3; x < BASIN.width - 2e3; x += 4e3) {
		const v = Math.abs(flowAt(g, x, y).v);
		if (x < 600e3) west = Math.max(west, v);
		else interior = Math.max(interior, v);
	}
	return { west, interior, ratio: interior > 0 ? west / interior : Infinity };
}

export interface Streamline {
	/** Points (m). */
	x: number[];
	y: number[];
	/** Cumulative "travel time" at each point: ∫ ds / |transport| (s/m). */
	time: number[];
	/** The ψ value of this line (m³/s). */
	level: number;
}

/**
 * Traces the closed streamline of ψ through (x0, y0) by following the flow
 * (midpoint rule in arc length, finer steps near the west coast), until it
 * comes back to its start. Also records the travel time along it, for
 * particles that move with the flow.
 */
export function traceStreamline(g: Gyre, x0: number, y0: number, maxSteps = 4000): Streamline {
	const xs = [x0];
	const ys = [y0];
	const time = [0];
	const level = psiAt(g, x0, y0).psi;
	let x = x0;
	let y = y0;
	let travelled = 0;
	let T = 0;
	const dir = (px: number, py: number) => {
		const f = flowAt(g, px, py);
		const s = Math.hypot(f.u, f.v) || 1e-12;
		return { dx: f.u / s, dy: f.v / s, s };
	};
	for (let i = 0; i < maxSteps; i++) {
		const ds = Math.min(60e3, Math.max(4e3, 0.15 * x));
		const d1 = dir(x, y);
		const mx = x + (d1.dx * ds) / 2;
		const my = y + (d1.dy * ds) / 2;
		const d2 = dir(mx, my);
		x += d2.dx * ds;
		y += d2.dy * ds;
		// keep inside the basin
		x = Math.min(BASIN.width - 1, Math.max(1, x));
		y = Math.min(BASIN_HEIGHT - 1, Math.max(1, y));
		travelled += ds;
		T += ds / d2.s;
		xs.push(x);
		ys.push(y);
		time.push(T);
		if (travelled > 3 * ds && travelled > 500e3 && Math.hypot(x - x0, y - y0) < ds * 0.75) {
			break;
		}
	}
	// close the loop exactly
	const last = Math.hypot(xs[0] - x, ys[0] - y);
	xs.push(x0);
	ys.push(y0);
	time.push(T + last / Math.max(1e-12, dir(x0, y0).s));
	return { x: xs, y: ys, time, level };
}

/**
 * Nested streamlines of one gyre: from its centre eastwards, the points where
 * ψ falls to each fraction of its extreme value, each traced round.
 */
export function gyreStreamlines(
	g: Gyre,
	centre: { psi: number; x: number; y: number },
	fractions = [0.15, 0.35, 0.55, 0.75, 0.92]
): Streamline[] {
	const out: Streamline[] = [];
	for (const f of fractions) {
		const target = f * centre.psi;
		// ψ goes from centre.psi at the centre to 0 at the east coast: bisect.
		let lo = centre.x;
		let hi = BASIN.width;
		for (let i = 0; i < 50; i++) {
			const mid = (lo + hi) / 2;
			const p = psiAt(g, mid, centre.y).psi;
			if ((centre.psi > 0 && p > target) || (centre.psi < 0 && p < target)) lo = mid;
			else hi = mid;
		}
		out.push(traceStreamline(g, (lo + hi) / 2, centre.y));
	}
	return out;
}

/**
 * Sverdrup's interior transport (m³/s): the northward transport across the
 * whole basin's interior at latitude φ, (curl τ / ρβ) × width.
 */
export function sverdrupTransport(winds: Winds, lat: number) {
	const dl = 0.01;
	const dtdy =
		(stressAt(winds, lat + dl) - stressAt(winds, lat - dl)) / (2 * dl) / (rad(1) * EARTH_RADIUS);
	return (-dtdy / (RHO * BETA)) * BASIN.width;
}

// ------------------------------------------------------------ 2. overturning

export const BOX = {
	/** Temperature of the warm, low-latitude box (°C). */
	Teq: 25,
	/** Thermal expansion coefficient (1/°C). */
	alpha: 1.7e-4,
	/** Haline contraction coefficient (1/psu). */
	betaS: 7.6e-4,
	/** Reference salinity (psu) and density (kg/m³). */
	S0: 35,
	rho0: 1027,
	/** Salt exchanged by the gyres, as an equivalent flow (m³/s). */
	K: 4 * SV,
	/** Volume of each box (m³): about a third of the Atlantic's. */
	V: 1.0e17,
	/** Today's state used for the calibration. */
	Tpole0: 5,
	q0: 17 * SV,
	dS0: 1.0,
	/** Heat capacity of sea water (J/(kg·°C)). */
	cp: 3990
};

/** Overturning coefficient k (m³/s per unit relative density difference), calibrated to today. */
export const K_FLOW = BOX.q0 / (BOX.alpha * (BOX.Teq - BOX.Tpole0) - BOX.betaS * BOX.dS0);
/** Today's freshwater input to the polar box (m³/s), from today's steady salt balance. */
export const F_TODAY = ((BOX.q0 + BOX.K) * BOX.dS0) / BOX.S0;

/** Overturning (m³/s; positive = sinking in the north) for a pole at Tpole and salinity contrast dS. */
export const overturning = (Tpole: number, dS: number) =>
	K_FLOW * (BOX.alpha * (BOX.Teq - Tpole) - BOX.betaS * dS);

/** Density of sea water (kg/m³), linear equation of state about 10 °C, 35 psu. */
export const density = (T: number, S: number) =>
	BOX.rho0 * (1 - BOX.alpha * (T - 10) + BOX.betaS * (S - BOX.S0));

/** Rate of change of the salinity contrast (psu/s). `fresh` is the freshwater input in multiples of today's. */
export function dSdt(dS: number, Tpole: number, fresh: number) {
	const q = overturning(Tpole, dS);
	return (2 / BOX.V) * (fresh * F_TODAY * BOX.S0 - (Math.abs(q) + BOX.K) * dS);
}

/** Heat carried north by the overturning (W): ρ c_p q ΔT. */
export const heatTransport = (Tpole: number, q: number) =>
	BOX.rho0 * BOX.cp * q * (BOX.Teq - Tpole);

export interface Equilibrium {
	dS: number;
	q: number;
	stable: boolean;
}

/**
 * Steady states for a polar temperature and freshwater input (× today's):
 * the strong (stable) and middle (unstable) states with sinking in the north,
 * and the weak reversed state, where each exists. Sorted by q, largest first.
 */
export function equilibria(Tpole: number, fresh: number): Equilibrium[] {
	const aT = BOX.alpha * (BOX.Teq - Tpole);
	if (!(aT > 0)) return [];
	const A = K_FLOW * aT;
	const K = BOX.K;
	// in x = β_S ΔS / (α ΔT): (A|1 − x| + K) x = G
	const G = (fresh * F_TODAY * BOX.S0 * BOX.betaS) / aT;
	const out: Equilibrium[] = [];
	const toEq = (x: number, stable: boolean) => {
		const dS = (x * aT) / BOX.betaS;
		return { dS, q: overturning(Tpole, dS), stable };
	};
	const disc = (A + K) ** 2 - 4 * A * G;
	if (disc >= 0) {
		const r = Math.sqrt(disc);
		const xs = (A + K - r) / (2 * A);
		const xu = (A + K + r) / (2 * A);
		if (xs >= 0 && xs < 1) out.push(toEq(xs, true));
		if (xu < 1 && xu > xs) out.push(toEq(xu, false));
	}
	const xr = (A - K + Math.sqrt((A - K) ** 2 + 4 * A * G)) / (2 * A);
	if (xr > 1) out.push(toEq(xr, true));
	return out;
}

/** The freshwater input (× today's) beyond which the strong overturning cannot exist. */
export function collapseThreshold(Tpole: number) {
	const aT = BOX.alpha * (BOX.Teq - Tpole);
	const A = K_FLOW * aT;
	const K = BOX.K;
	// the strong and middle states merge where (A + K)² = 4 A G
	const G = (A + K) ** 2 / (4 * A);
	return (G * aT) / (BOX.betaS * F_TODAY * BOX.S0);
}

/** The freshwater input (× today's) below which the reversed state cannot exist (it restarts). */
export function restartThreshold(Tpole: number) {
	const aT = BOX.alpha * (BOX.Teq - Tpole);
	// the reversed state ends at x = 1 (q = 0), where G = K
	return (BOX.K * aT) / (BOX.betaS * F_TODAY * BOX.S0);
}

export const YEAR = 365.25 * 86400;

export interface Overturn {
	/** Sample spacing (years). */
	dt: number;
	dS: Float64Array;
	/** Overturning (m³/s). */
	q: Float64Array;
	/** ∫ q dt (m³), for particles moving with the flow. */
	moved: Float64Array;
}

/** Integrates the box model from a salinity contrast dS0 for `years` years (RK4). */
export function runOverturning(
	dS0: number,
	Tpole: number,
	fresh: number,
	years: number,
	dtYears = 0.5
): Overturn {
	const n = Math.max(1, Math.round(years / dtYears));
	const h = dtYears * YEAR;
	const dS = new Float64Array(n + 1);
	const q = new Float64Array(n + 1);
	const moved = new Float64Array(n + 1);
	let s = dS0;
	dS[0] = s;
	q[0] = overturning(Tpole, s);
	const f = (v: number) => dSdt(v, Tpole, fresh);
	for (let i = 1; i <= n; i++) {
		const k1 = f(s);
		const k2 = f(s + (h / 2) * k1);
		const k3 = f(s + (h / 2) * k2);
		const k4 = f(s + h * k3);
		s += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
		dS[i] = s;
		q[i] = overturning(Tpole, s);
		moved[i] = moved[i - 1] + ((q[i - 1] + q[i]) / 2) * h;
	}
	return { dt: dtYears, dS, q, moved };
}

// ------------------------------------------------------------ 3. El Niño

/**
 * Jin's (1997) recharge oscillator, non-dimensional: time unit 2 months,
 * temperature unit 7.5 °C, thermocline-depth unit 150 m; the wind stress is
 * measured by the east–west thermocline tilt it holds up (same unit as h).
 */
export const JIN = {
	c: 1,
	gamma: 0.75,
	r: 0.25,
	alpha: 0.125,
	b0: 2.5,
	months: 2,
	degrees: 7.5,
	metres: 150
};

/** Coupling μ for "today's" feedback: a little below Jin's critical 2/3, so El Niños die away. */
export const MU_TODAY = 0.6;

/** Equatorial Pacific mean state. */
export const PACIFIC = {
	/** Width of the ocean along the equator over which the trades blow (m). */
	length: 1.6e7,
	/** Mean depth of the thermocline (m). */
	depth: 120,
	/** Reduced gravity across the thermocline (m/s²). */
	gPrime: 0.04,
	/** Mean wind stress of the trade winds over the equator (N/m², westward). */
	trades: 0.045,
	/** Mean sea surface temperatures (°C), west and east. */
	westSST: 29.5,
	eastSST: 25
};

/**
 * East-to-west rise of the thermocline (m) held up by a westward wind stress
 * τ (N/m²): the zonal momentum balance g′ H Δh / L = τ / ρ.
 */
export const thermoclineTilt = (tau: number) =>
	(tau * PACIFIC.length) / (RHO * PACIFIC.gPrime * PACIFIC.depth);

/** Rise of the sea surface (m) from east to west for a thermocline tilt Δh: (g′/g) Δh. */
export const seaLevelTilt = (dh: number) => (PACIFIC.gPrime / 9.81) * dh;

/** The mean tilt in Jin's units (≈ 1). */
export const MEAN_TILT = thermoclineTilt(PACIFIC.trades) / JIN.metres;

export interface PacificState {
	/** Anomalies in Jin's units. */
	T: number;
	h: number;
	/** Wind-stress anomaly (westerly positive), in tilt units. */
	tau: number;
}

/**
 * Steady response of the ocean alone to trade winds held at `strength` × their
 * mean (no feedback on the winds): the anomalies where dT/dt = dh/dt = 0.
 */
export function steadyPacific(strength: number): PacificState {
	const { c, gamma, r, alpha } = JIN;
	const tau = (1 - strength) * MEAN_TILT;
	const h = (-alpha * tau) / r;
	const T = (gamma * (h + tau)) / c;
	return { T, h, tau };
}

/** Length of the westerly burst (non-dimensional: 3 = six months). */
export const BURST_LENGTH = 3;

/** Westerly wind burst (tilt units) at non-dimensional time s: a half-sine lasting `length`. */
export const burstAt = (s: number, amp: number, length = BURST_LENGTH) =>
	s > 0 && s < length ? amp * Math.sin((Math.PI * s) / length) : 0;

export interface Enso {
	/** Sample spacing (non-dimensional). */
	dt: number;
	T: Float64Array;
	h: Float64Array;
	tau: Float64Array;
}

/**
 * Runs the coupled recharge oscillator from rest, with a westerly burst of
 * amplitude `burst` (tilt units; MEAN_TILT ≈ 1 would switch the trades off)
 * for its first six months, and coupling μ = `mu`. RK4.
 */
export function runEnso(mu: number, burst: number, units = 48, dt = 0.02): Enso {
	const { c, gamma, r, alpha, b0 } = JIN;
	const b = mu * b0;
	const n = Math.round(units / dt);
	const T = new Float64Array(n + 1);
	const h = new Float64Array(n + 1);
	const tau = new Float64Array(n + 1);
	let x = 0;
	let y = 0;
	const f = (s: number, X: number, Y: number) => {
		const tw = b * X + burstAt(s, burst);
		return [-c * X + gamma * (Y + tw), -r * Y - alpha * tw];
	};
	for (let i = 0; i <= n; i++) {
		const s = i * dt;
		T[i] = x;
		h[i] = y;
		tau[i] = b * x + burstAt(s, burst);
		const k1 = f(s, x, y);
		const k2 = f(s + dt / 2, x + (dt / 2) * k1[0], y + (dt / 2) * k1[1]);
		const k3 = f(s + dt / 2, x + (dt / 2) * k2[0], y + (dt / 2) * k2[1]);
		const k4 = f(s + dt, x + dt * k3[0], y + dt * k3[1]);
		x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
		y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
	}
	return { dt, T, h, tau };
}

/** Growth rate (per unit time) and period (units) of the free coupled oscillation for coupling μ. */
export function ensoEigen(mu: number) {
	const { c, gamma, r, alpha, b0 } = JIN;
	const b = mu * b0;
	const R = gamma * b - c;
	const tr = R - r;
	const det = -R * r + gamma * alpha * b;
	const w2 = det - (tr / 2) ** 2;
	return { growth: tr / 2, period: w2 > 0 ? (2 * Math.PI) / Math.sqrt(w2) : Infinity };
}

/** Physical picture of a Pacific state: depths (m), SSTs (°C) and the trade winds (× mean). */
export function pacificPicture(s: PacificState) {
	const tilt = MEAN_TILT - s.tau; // tilt units, east shallower
	const hW = s.h;
	const hE = s.h + s.tau;
	const mean = PACIFIC.depth;
	// depth anomalies on top of the mean slope (centred on the mean depth)
	const westDepth = mean + (MEAN_TILT / 2) * JIN.metres + hW * JIN.metres;
	const eastDepth = mean - (MEAN_TILT / 2) * JIN.metres + hE * JIN.metres;
	return {
		westDepth,
		eastDepth,
		eastSST: PACIFIC.eastSST + s.T * JIN.degrees,
		westSST: PACIFIC.westSST,
		trades: tilt / MEAN_TILT,
		seaLevel: seaLevelTilt(westDepth - eastDepth)
	};
}
