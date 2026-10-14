/**
 * The heat-engine model: ideal ("air-standard") cycles of a gas in a cylinder.
 *
 * The working gas is air treated as an ideal gas with constant heat capacities
 * (γ = 1.4, R = 287 J/(kg·K), so cv = R/(γ − 1) = 717.5 and cp = γ·cv = 1004.5
 * J/(kg·K)). Every process is reversible: adiabatic legs follow P·V^γ = const,
 * isothermal legs P·V = const. Heat from burning fuel is modelled as heat put
 * in from outside, and the exhaust as heat taken out at constant volume (the
 * standard air-standard idealisation, e.g. Çengel & Boles, Thermodynamics, ch. 9).
 *
 * Units: SI (Pa, m³, K, J, J/K) unless a name says otherwise.
 */

export const GAMMA = 1.4;
/** Specific gas constant of dry air, J/(kg·K). */
export const R_AIR = 287;
export const CV = R_AIR / (GAMMA - 1);
export const CP = GAMMA * CV;
/** Standard atmosphere, Pa. */
export const P_ATM = 101325;
/** Swept volume of one cylinder: a 2-litre four-cylinder engine has 0.5 L per cylinder. */
export const SWEPT = 0.5e-3;
/** Crank geometry: crank radius and connecting-rod length (rod ratio 3.5), in units of the stroke. */
export const CRANK = 0.5;
export const ROD = 1.75;

export interface State {
	P: number;
	V: number;
	T: number;
	/** Entropy of the gas relative to state 1 (J/K). */
	S: number;
}

export interface Point {
	V: number;
	P: number;
	T: number;
	S: number;
}

export type Leg = 'adiabatic' | 'isochoric' | 'isobaric' | 'isothermal';

export interface Cycle {
	kind: 'otto' | 'diesel' | 'carnot';
	/** Mass of gas, kg. */
	m: number;
	/** The four corner states, in cycle order (1 → 2 → 3 → 4 → 1). */
	states: [State, State, State, State];
	/** The kind of process from states[i] to states[(i + 1) % 4]. */
	legs: [Leg, Leg, Leg, Leg];
	/** Heat in, heat out and net work per cycle, J. */
	qIn: number;
	qOut: number;
	work: number;
	efficiency: number;
	/** Lowest and highest temperatures reached, K. */
	tMin: number;
	tMax: number;
	/** False when the compression alone already reaches the hot temperature: no heat can go in. */
	valid: boolean;
}

/** Entropy of m kg of ideal gas at (T, V) relative to (T0, V0), J/K. */
export const entropy = (m: number, T: number, V: number, T0: number, V0: number) =>
	m * (CV * Math.log(T / T0) + R_AIR * Math.log(V / V0));

/** Largest and smallest volume of the cylinder for a compression ratio r (m³). */
export function volumes(r: number, swept = SWEPT) {
	const vMax = (swept * r) / (r - 1);
	return { vMax, vMin: vMax / r };
}

function state(m: number, T: number, V: number, ref: { T: number; V: number }): State {
	return { P: (m * R_AIR * T) / V, V, T, S: entropy(m, T, V, ref.T, ref.V) };
}

function finish(
	kind: Cycle['kind'],
	m: number,
	states: Cycle['states'],
	legs: Cycle['legs'],
	qIn: number,
	qOut: number,
	valid: boolean
): Cycle {
	const work = qIn - qOut;
	const temps = states.map((s) => s.T);
	return {
		kind,
		m,
		states,
		legs,
		qIn,
		qOut,
		work,
		efficiency: qIn > 0 ? work / qIn : 0,
		tMin: Math.min(...temps),
		tMax: Math.max(...temps),
		valid
	};
}

/**
 * The ideal Otto cycle (petrol engine): adiabatic compression by the ratio r
 * from the intake state (tCold, 1 atm), heat in at constant volume up to tHot,
 * adiabatic expansion, heat out at constant volume.
 */
export function otto(r: number, tCold: number, tHot: number, swept = SWEPT, p1 = P_ATM): Cycle {
	const { vMax, vMin } = volumes(r, swept);
	const m = (p1 * vMax) / (R_AIR * tCold);
	const ref = { T: tCold, V: vMax };
	const t2 = tCold * Math.pow(r, GAMMA - 1);
	const t3 = Math.max(tHot, t2);
	const t4 = t3 / Math.pow(r, GAMMA - 1);
	const s: Cycle['states'] = [
		state(m, tCold, vMax, ref),
		state(m, t2, vMin, ref),
		state(m, t3, vMin, ref),
		state(m, t4, vMax, ref)
	];
	return finish(
		'otto',
		m,
		s,
		['adiabatic', 'isochoric', 'adiabatic', 'isochoric'],
		m * CV * (t3 - t2),
		m * CV * (t4 - tCold),
		tHot > t2
	);
}

/**
 * The ideal Diesel cycle: the same compression of air alone, then fuel burns
 * as the piston moves, so heat goes in at constant pressure up to tHot; then
 * adiabatic expansion and heat out at constant volume.
 */
export function diesel(r: number, tCold: number, tHot: number, swept = SWEPT, p1 = P_ATM): Cycle {
	const { vMax, vMin } = volumes(r, swept);
	const m = (p1 * vMax) / (R_AIR * tCold);
	const ref = { T: tCold, V: vMax };
	const t2 = tCold * Math.pow(r, GAMMA - 1);
	// Burning at constant pressure can go on at most until the piston reaches the bottom.
	const t3 = Math.min(Math.max(tHot, t2), t2 * r);
	const v3 = (vMin * t3) / t2;
	const t4 = t3 * Math.pow(v3 / vMax, GAMMA - 1);
	const s: Cycle['states'] = [
		state(m, tCold, vMax, ref),
		state(m, t2, vMin, ref),
		state(m, t3, v3, ref),
		state(m, t4, vMax, ref)
	];
	return finish(
		'diesel',
		m,
		s,
		['adiabatic', 'isobaric', 'adiabatic', 'isochoric'],
		m * CP * (t3 - t2),
		m * CV * (t4 - tCold),
		tHot > t2
	);
}

/**
 * The Carnot cycle between tHot and tCold for m kg of gas: adiabatic
 * compression from (tCold, v1) up to tHot, isothermal expansion at tHot that
 * takes in heat (the gas's entropy grows by dS), adiabatic expansion down to
 * tCold, isothermal compression at tCold that gives heat out. Numbered like
 * the Otto cycle: state 1 is the cold, low-entropy corner.
 */
export function carnot(m: number, tCold: number, tHot: number, v1: number, dS: number): Cycle {
	const ref = { T: tCold, V: v1 };
	const v2 = v1 * Math.pow(tCold / tHot, 1 / (GAMMA - 1));
	const k = Math.exp(dS / (m * R_AIR));
	const s: Cycle['states'] = [
		state(m, tCold, v1, ref),
		state(m, tHot, v2, ref),
		state(m, tHot, v2 * k, ref),
		state(m, tCold, v1 * k, ref)
	];
	return finish(
		'carnot',
		m,
		s,
		['adiabatic', 'isothermal', 'adiabatic', 'isothermal'],
		tHot * dS,
		tCold * dS,
		tHot > tCold
	);
}

/** The Carnot limit on the efficiency of any engine working between tHot and tCold. */
export const carnotLimit = (tHot: number, tCold: number) => Math.max(0, 1 - tCold / tHot);

/** Efficiency of the ideal Otto cycle: depends on the compression ratio only. */
export const ottoEfficiency = (r: number) => 1 - Math.pow(r, 1 - GAMMA);

/** Point at fraction u (0–1) along leg i of a cycle, following the real process. */
export function along(c: Cycle, i: number, u: number): Point {
	const a = c.states[i];
	const b = c.states[(i + 1) % 4];
	const leg = c.legs[i];
	const ref = c.states[0];
	let V: number;
	let T: number;
	if (leg === 'isochoric') {
		V = a.V;
		T = a.T + (b.T - a.T) * u;
	} else if (leg === 'isobaric') {
		V = a.V + (b.V - a.V) * u;
		T = (a.T * V) / a.V;
	} else if (leg === 'isothermal') {
		V = a.V * Math.pow(b.V / a.V, u); // even steps in log V: even steps in entropy
		T = a.T;
	} else {
		V = a.V * Math.pow(b.V / a.V, u);
		T = a.T * Math.pow(a.V / V, GAMMA - 1);
	}
	return {
		V,
		T,
		P: (c.m * R_AIR * T) / V,
		S: entropy(c.m, T, V, ref.T, ref.V)
	};
}

/** The closed loop as a list of points, `n` per leg (the first point is repeated at the end). */
export function loop(c: Cycle, n = 48): Point[] {
	const out: Point[] = [];
	for (let i = 0; i < 4; i++) for (let k = 0; k < n; k++) out.push(along(c, i, k / n));
	out.push(along(c, 0, 0));
	return out;
}

/** ∮ P dV along a sampled loop by the trapezoidal rule (J): the area it encloses on a P–V chart. */
export function enclosedWork(points: readonly Point[]) {
	let w = 0;
	for (let i = 1; i < points.length; i++) {
		w += 0.5 * (points[i].P + points[i - 1].P) * (points[i].V - points[i - 1].V);
	}
	return w;
}

/**
 * Clausius sum ∮ δQ/T of a cycle, J/K. Each leg's heat is the gas's
 * ΔU + W; for a reversible cycle it is the change of the gas's entropy round
 * the loop, which is zero. What it says about the surroundings is in
 * `reservoirEntropy`.
 */
export function clausius(c: Cycle, n = 400): number {
	let sum = 0;
	for (let i = 0; i < 4; i++) {
		let prev = along(c, i, 0);
		for (let k = 1; k <= n; k++) {
			const p = along(c, i, k / n);
			const dQ = c.m * CV * (p.T - prev.T) + 0.5 * (p.P + prev.P) * (p.V - prev.V);
			sum += dQ / (0.5 * (p.T + prev.T));
			prev = p;
		}
	}
	return sum;
}

/**
 * Entropy change of the surroundings over one cycle when the heat comes from
 * a reservoir at the cycle's hottest temperature and goes to one at its
 * coldest (J/K): −Q_in/T_hot + Q_out/T_cold. Never negative; zero only for
 * the Carnot cycle.
 */
export const reservoirEntropy = (c: Cycle) => -c.qIn / c.tMax + c.qOut / c.tMin;

// ---- the entropy ledger --------------------------------------------------------------------

export interface Ledger {
	qHot: number;
	work: number;
	qCold: number;
	/** Entropy changes of the hot and cold sides, and their sum (J/K). */
	dsHot: number;
	dsCold: number;
	dsTotal: number;
	/** Whether the second law allows it (total entropy does not fall). */
	allowed: boolean;
}

/** An engine that takes qHot from a hot side at tHot, turns `share` of it into work and gives the rest to a cold side at tCold. */
export function ledger(qHot: number, share: number, tHot: number, tCold: number): Ledger {
	const work = qHot * share;
	const qCold = qHot - work;
	const dsHot = -qHot / tHot;
	const dsCold = qCold / tCold;
	const dsTotal = dsHot + dsCold;
	return { qHot, work, qCold, dsHot, dsCold, dsTotal, allowed: dsTotal >= -1e-9 * qHot };
}

// ---- the simple box cycle of the first steps -------------------------------------------------

/** The gas of the first steps: half a litre of air at 1 atm and 300 K. */
export const BOX = { V: 0.5e-3, T: 300, P: P_ATM };
export const boxMass = () => (BOX.P * BOX.V) / (R_AIR * BOX.T);

/** Heating the box gas at constant pressure by q joules: how far it pushes and how much is work. */
export function pushAtConstantPressure(q: number) {
	const m = boxMass();
	const dT = q / (m * CP);
	const v2 = (BOX.V * (BOX.T + dT)) / BOX.T;
	const work = BOX.P * (v2 - BOX.V);
	return { m, dT, t2: BOX.T + dT, v2, work, warming: q - work };
}

/**
 * A rectangular cycle: heat at constant volume to twice the pressure, heat at
 * constant pressure to twice the volume, then back. `back = 'cold'` cools it
 * at constant volume first and pushes it back at the low pressure; 'same'
 * pushes it back the way it came, at the high pressure.
 */
export function boxCycle(back: 'cold' | 'same') {
	const m = boxMass();
	const { P, V, T } = BOX;
	const corners = [
		{ P, V, T },
		{ P: 2 * P, V, T: 2 * T },
		{ P: 2 * P, V: 2 * V, T: 4 * T },
		back === 'cold' ? { P, V: 2 * V, T: 2 * T } : { P: 2 * P, V, T: 2 * T }
	];
	const workOut = 2 * P * V;
	const workIn = back === 'cold' ? P * V : 2 * P * V;
	const qIn = m * CV * T + m * CP * 2 * T;
	return {
		m,
		corners,
		workOut,
		workIn,
		net: workOut - workIn,
		qIn,
		qOut: qIn - (workOut - workIn)
	};
}

// ---- the four strokes ------------------------------------------------------------------------

export type Stroke = 'intake' | 'compression' | 'combustion' | 'power' | 'exhaust-open' | 'exhaust';

/**
 * The running engine at a moment: piston position from real crank-and-rod
 * kinematics over the 720° of a four-stroke cycle, the gas's state on the
 * ideal cycle, and which stroke it is in. The crank pauses for `dwell` of
 * the period at top dead centre (combustion) and bottom dead centre (exhaust
 * valve opening), which the ideal cycle treats as instantaneous.
 *
 * `u` is the phase of the cycle (0–1).
 */
export function engineAt(c: Cycle, u: number, dwell = 0.06) {
	const strokeLen = (1 - 2 * dwell) / 4;
	const marks = [
		strokeLen,
		2 * strokeLen,
		2 * strokeLen + dwell,
		3 * strokeLen + dwell,
		3 * strokeLen + 2 * dwell,
		1
	];
	const names: Stroke[] = [
		'intake',
		'compression',
		'combustion',
		'power',
		'exhaust-open',
		'exhaust'
	];
	let k = 0;
	while (k < 5 && u >= marks[k]) k++;
	const start = k === 0 ? 0 : marks[k - 1];
	const f = (u - start) / (marks[k] - start);
	const stroke = names[k];
	// Crank angle in degrees, 0 at top dead centre at the start of intake.
	const crank =
		stroke === 'intake'
			? 180 * f
			: stroke === 'compression'
				? 180 + 180 * f
				: stroke === 'combustion'
					? 360
					: stroke === 'power'
						? 360 + 180 * f
						: stroke === 'exhaust-open'
							? 540
							: 540 + 180 * f;
	const th = (crank * Math.PI) / 180;
	// Piston distance from top dead centre, in strokes (0–1).
	const x = CRANK * (1 - Math.cos(th)) + ROD - Math.sqrt(ROD * ROD - (CRANK * Math.sin(th)) ** 2);
	const [s1, s2, s3, s4] = c.states;
	const V = s2.V + (s1.V - s2.V) * x;
	let gas: Point;
	if (stroke === 'intake' || stroke === 'exhaust') {
		// Fresh air in, burnt gas out: the gas leaves the closed cycle (no entropy of its own here).
		gas = { V, P: s1.P, T: stroke === 'intake' ? s1.T : s4.T, S: stroke === 'intake' ? 0 : s4.S };
	} else if (stroke === 'compression') {
		const T = s1.T * Math.pow(s1.V / V, GAMMA - 1);
		gas = { V, T, P: (c.m * R_AIR * T) / V, S: 0 };
	} else if (stroke === 'combustion') {
		// Otto: the spark burns the mixture at top dead centre. Diesel: fuel is injected here and
		// burns while the piston moves down (below).
		gas = c.kind === 'diesel' ? { ...s2 } : along(c, 1, f);
	} else if (stroke === 'power') {
		// Diesel: the burning (constant pressure) continues while the piston moves down.
		if (c.kind === 'diesel' && V <= s3.V) {
			const T = (s2.T * V) / s2.V;
			gas = { V, T, P: s2.P, S: entropy(c.m, T, V, s1.T, s1.V) };
		} else {
			const T = s3.T * Math.pow(s3.V / V, GAMMA - 1);
			gas = { V, T, P: (c.m * R_AIR * T) / V, S: s3.S };
		}
	} else {
		gas = along(c, 3, f);
	}
	return { stroke, crank, x, V, gas, f };
}
