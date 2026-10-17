/**
 * The Hodgkin–Huxley model of the squid giant axon, exactly as published:
 *
 *   A. L. Hodgkin & A. F. Huxley, "A quantitative description of membrane
 *   current and its application to conduction and excitation in nerve",
 *   J. Physiol. 117:500–544 (1952). Equations (26) and (7)–(23), the
 *   constants of Table 3, a temperature coefficient (Q₁₀) of 3 (p. 519), and
 *   the cable equation of Part III for the propagated action potential.
 *
 *   C dV/dt = I − ḡNa m³h (V − ENa) − ḡK n⁴ (V − EK) − ḡL (V − EL)
 *   dx/dt   = φ (αx (1 − x) − βx x)          for the gates x = m, h, n
 *
 * Units throughout: mV, ms, µA/cm², mS/cm², µF/cm², cm.
 *
 * Voltage convention. Hodgkin and Huxley measured voltages from the resting
 * potential, with depolarisation negative. Here voltages are absolute and
 * depolarisation positive, with the rest placed at REST = −60 mV (a
 * convention: close to the −59 mV that Hodgkin & Katz computed for the same
 * axons, see ions.ts). So ENa = REST + 115, EK = REST − 12 and EL = REST +
 * 10.613, the values of Table 3 in the new sign.
 *
 * Synapses (used for the receiving cell of the last chapter) are not part of
 * Hodgkin and Huxley's paper: they are conductances that open for a few
 * milliseconds, with reversal potentials E_EXC and E_INH. Their size and time
 * course are ILLUSTRATIVE, and the page says so.
 */

/** Resting potential, mV (convention, see above). */
export const REST = -60;

/** Table 3 of Hodgkin & Huxley (1952), in absolute mV with depolarisation positive. */
export const HH = {
	/** Membrane capacitance, µF/cm². */
	C: 1,
	/** Peak conductances, mS/cm². */
	gNa: 120,
	gK: 36,
	gL: 0.3,
	/** Reversal potentials, mV. */
	ENa: REST + 115,
	EK: REST - 12,
	EL: REST + 10.613,
	/** Temperature at which the rate constants were fitted, °C. */
	T0: 6.3,
	/** Temperature coefficient of the rates (p. 519). */
	Q10: 3
} as const;

/** The squid giant axon whose propagated spike HH computed in Part III (p. 528). */
export const SQUID_AXON = {
	/** Radius of the axis cylinder, cm (238 µm). */
	radius: 0.0238,
	/** Specific resistance of the axoplasm, Ω·cm. */
	Ri: 35.4,
	/** Temperature of the record, °C. */
	T: 18.5,
	/** Conduction velocity HH calculated (m/s) … */
	computed: 18.8,
	/** … and the one they measured on the same fibre (m/s). */
	measured: 21.2
} as const;

/** Reversal potentials of the illustrative synapses, mV: glutamate-type and GABA-type. */
export const E_EXC = 0;
export const E_INH = -75;

/** Rate factor φ at temperature T (°C). */
export function phi(T: number): number {
	return Math.pow(HH.Q10, (T - HH.T0) / 10);
}

/** x / (exp(x / 10) − 1), with its limit 10 at x = 0 (the 0/0 of αn and αm). */
function vtrap(x: number): number {
	return Math.abs(x) < 1e-6 ? 10 * (1 - x / 20) : x / (Math.exp(x / 10) - 1);
}

/** The six rate constants at 6.3 °C, ms⁻¹, at absolute voltage V (mV). Eqs. (12)–(13), (20)–(21), (23)–(24). */
function rates(V: number) {
	const u = V - REST; // depolarisation from rest, HH's −V
	return {
		an: 0.01 * vtrap(10 - u),
		bn: 0.125 * Math.exp(-u / 80),
		am: 0.1 * vtrap(25 - u),
		bm: 4 * Math.exp(-u / 18),
		ah: 0.07 * Math.exp(-u / 20),
		bh: 1 / (Math.exp((30 - u) / 10) + 1)
	};
}

/** Steady-state values of the gates at voltage V. */
function steady(V: number) {
	const r = rates(V);
	return {
		m: r.am / (r.am + r.bm),
		h: r.ah / (r.ah + r.bh),
		n: r.an / (r.an + r.bn)
	};
}

interface Gates {
	m: number;
	h: number;
	n: number;
}

/** Ionic current densities (µA/cm², outward positive) at V with the gates g. */
function currents(V: number, g: Gates, block: Block = {}) {
	// A blocker removes the voltage-gated part of a conductance; the small conductance open at
	// rest is kept as a fixed leak, so that a blocked membrane still rests at REST (without it a
	// full K⁺ block lets the cell fire on its own and stick near +4 mV).
	const nb = block.na ?? 1;
	const kb = block.k ?? 1;
	const gNa = HH.gNa * (nb * g.m ** 3 * g.h + (1 - nb) * RESTING.m ** 3 * RESTING.h);
	const gK = HH.gK * (kb * g.n ** 4 + (1 - kb) * RESTING.n ** 4);
	return {
		gNa,
		gK,
		iNa: gNa * (V - HH.ENa),
		iK: gK * (V - HH.EK),
		iL: HH.gL * (V - HH.EL)
	};
}

/**
 * Fractions of the voltage-gated channels left working (1 = none blocked). TTX blocks Na⁺, TEA
 * blocks K⁺. Only the voltage-dependent opening is blocked; the conductance open at rest stays.
 */
interface Block {
	na?: number;
	k?: number;
}

/** A conductance that opens at `at` (ms) with peak `g` (mS/cm²) and time constant `tau` (ms): an alpha function. */
export interface SynEvent {
	at: number;
	g: number;
	tau: number;
	/** Reversal potential, mV. */
	E: number;
}

function synG(e: SynEvent, t: number): number {
	const s = (t - e.at) / e.tau;
	return s <= 0 ? 0 : e.g * s * Math.exp(1 - s);
}

interface PointRun {
	/** Length of the run, ms. */
	tEnd: number;
	/** Injected current density (µA/cm², inward positive as HH's stimulus) at time t. */
	current?: (t: number) => number;
	synapses?: readonly SynEvent[];
	block?: Block;
	/** Temperature, °C (default: HH's 6.3 °C). */
	T?: number;
	/** Integration step, ms. */
	dt?: number;
	/** Keep one sample every `every` ms. */
	every?: number;
}

export interface Sample {
	t: number;
	V: number;
	m: number;
	h: number;
	n: number;
	gNa: number;
	gK: number;
	/** Injected current, µA/cm². */
	I: number;
	/** Synaptic conductances, mS/cm². */
	gE: number;
	gI: number;
}

/** A pulse of current `amp` (µA/cm²) from `start` lasting `dur` (ms). */
export function pulse(amp: number, start: number, dur: number) {
	return (t: number) => (t >= start && t < start + dur ? amp : 0);
}

/** The steady state at rest (no current): the resting gates. */
const RESTING: Gates = steady(REST);

/**
 * Integrates one patch of membrane (a space-clamped axon, as in HH's
 * "membrane action potential") with the 4th-order Runge–Kutta method.
 */
export function simulate(run: PointRun): Sample[] {
	const dt = run.dt ?? 0.01;
	const every = run.every ?? 0.05;
	const f = phi(run.T ?? HH.T0);
	const block = run.block ?? {};
	const syn = run.synapses ?? [];
	const cur = run.current ?? (() => 0);
	const synCur = (V: number, t: number) => {
		let gE = 0;
		let gI = 0;
		let i = 0;
		for (const e of syn) {
			const g = synG(e, t);
			if (e.E >= REST) gE += g;
			else gI += g;
			i += g * (V - e.E);
		}
		return { i, gE, gI };
	};
	const deriv = (t: number, y: readonly number[]) => {
		const [V, m, h, n] = y;
		const r = rates(V);
		const c = currents(V, { m, h, n }, block);
		const s = synCur(V, t);
		return [
			(cur(t) - c.iNa - c.iK - c.iL - s.i) / HH.C,
			f * (r.am * (1 - m) - r.bm * m),
			f * (r.ah * (1 - h) - r.bh * h),
			f * (r.an * (1 - n) - r.bn * n)
		];
	};
	let y = [REST, RESTING.m, RESTING.h, RESTING.n];
	const out: Sample[] = [];
	const keep = Math.max(1, Math.round(every / dt));
	const steps = Math.round(run.tEnd / dt);
	for (let k = 0; k <= steps; k++) {
		const t = k * dt;
		if (k % keep === 0) {
			const [V, m, h, n] = y;
			const c = currents(V, { m, h, n }, block);
			const s = synCur(V, t);
			out.push({ t, V, m, h, n, gNa: c.gNa, gK: c.gK, I: cur(t), gE: s.gE, gI: s.gI });
		}
		const k1 = deriv(t, y);
		const k2 = deriv(
			t + dt / 2,
			y.map((v, i) => v + (dt / 2) * k1[i])
		);
		const k3 = deriv(
			t + dt / 2,
			y.map((v, i) => v + (dt / 2) * k2[i])
		);
		const k4 = deriv(
			t + dt,
			y.map((v, i) => v + dt * k3[i])
		);
		y = y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
	}
	return out;
}

/** Voltage that counts as a spike: an upward crossing of 0 mV. */
const SPIKE_LEVEL = 0;

/** Times (ms) at which the voltage crosses SPIKE_LEVEL upwards. */
export function spikeTimes(s: readonly Sample[]): number[] {
	const out: number[] = [];
	for (let i = 1; i < s.length; i++) {
		if (s[i - 1].V < SPIKE_LEVEL && s[i].V >= SPIKE_LEVEL) {
			const u = (SPIKE_LEVEL - s[i - 1].V) / (s[i].V - s[i - 1].V);
			out.push(s[i - 1].t + u * (s[i].t - s[i - 1].t));
		}
	}
	return out;
}

/** Highest voltage of a run, mV, and when it happens. */
export function peak(s: readonly Sample[], from = 0, to = Infinity) {
	let best = s[0];
	for (const p of s) if (p.t >= from && p.t <= to && p.V > best.V) best = p;
	return best;
}

/** The sample at time t (nearest). */
export function at(s: readonly Sample[], t: number): Sample {
	if (s.length === 0) throw new Error('empty run');
	const dt = s.length > 1 ? s[1].t - s[0].t : 1;
	return s[Math.max(0, Math.min(s.length - 1, Math.round((t - s[0].t) / dt)))];
}

/**
 * Smallest amplitude (µA/cm²) of a pulse of `dur` ms that makes the patch fire,
 * found by bisection (to 0.01 µA/cm²).
 */
export function threshold(dur: number, T: number = HH.T0): number {
	const fires = (a: number) =>
		spikeTimes(simulate({ tEnd: 20, current: pulse(a, 1, dur), T, every: 0.05 })).length > 0;
	let lo = 0;
	let hi = 400;
	while (hi - lo > 0.01) {
		const mid = (lo + hi) / 2;
		if (fires(mid)) hi = mid;
		else lo = mid;
	}
	return hi;
}

/** Firing rate (spikes per second) under a steady current I (µA/cm²), counted after the first 50 ms. */
export function firingRate(I: number, T: number = HH.T0): number {
	const s = simulate({ tEnd: 550, current: (t) => (t >= 0 ? I : 0), T, every: 0.1 });
	const late = spikeTimes(s).filter((t) => t >= 50);
	if (late.length < 2) return 0;
	return ((late.length - 1) / (late[late.length - 1] - late[0])) * 1000;
}

// ------------------------------------------------------------------- the cable

interface CableRun {
	/** Axon radius, cm. */
	radius: number;
	/** Specific resistance of the axoplasm, Ω·cm. */
	Ri: number;
	T: number;
	/** Length of the axon, cm. */
	length: number;
	/** Compartment length, cm. */
	dx: number;
	/** Integration step, ms. */
	dt: number;
	tEnd: number;
	/** Stimulus at the left end: current density (µA/cm²) for `stimDur` ms on the first `stimLen` cm. */
	stimAmp: number;
	stimDur: number;
	stimLen: number;
	/** Keep one frame every `every` ms. */
	every: number;
}

interface CableResult {
	/** Positions of the compartment centres, cm. */
	x: Float64Array;
	/** Times of the frames, ms. */
	t: number[];
	/** Voltage along the axon in each frame, mV. */
	V: Float32Array[];
	/** Sodium conductance along the axon in each frame, mS/cm². */
	gNa: Float32Array[];
	gK: Float32Array[];
	/** Time (ms) at which each compartment first crossed SPIKE_LEVEL (NaN: never). */
	arrival: Float64Array;
}

/**
 * The propagated action potential: HH's membrane on a uniform cable,
 *   C ∂V/∂t = (a / 2Rᵢ) ∂²V/∂x² − I_ion,
 * with sealed ends, solved by the method of lines (explicit Euler for V,
 * exponential Euler for the gates; dt must stay below dx² Rᵢ C / a).
 */
export function cable(run: CableRun): CableResult {
	const N = Math.max(3, Math.round(run.length / run.dx));
	const dx = run.length / N;
	// µA/cm² per mV: 1000 converts (1/Ω)·mV/cm² = mA/cm² to µA/cm².
	const k = (1000 * run.radius) / (2 * run.Ri * dx * dx);
	const f = phi(run.T);
	const V = new Float64Array(N).fill(REST);
	const m = new Float64Array(N).fill(RESTING.m);
	const h = new Float64Array(N).fill(RESTING.h);
	const n = new Float64Array(N).fill(RESTING.n);
	const dV = new Float64Array(N);
	const arrival = new Float64Array(N).fill(NaN);
	const x = new Float64Array(N);
	for (let i = 0; i < N; i++) x[i] = (i + 0.5) * dx;
	const out: CableResult = { x, t: [], V: [], gNa: [], gK: [], arrival };
	const steps = Math.round(run.tEnd / run.dt);
	const keep = Math.max(1, Math.round(run.every / run.dt));
	const gate = (g: number, a: number, b: number) => {
		const tau = 1 / (f * (a + b));
		const inf = a / (a + b);
		return inf + (g - inf) * Math.exp(-run.dt / tau);
	};
	for (let s = 0; s <= steps; s++) {
		const t = s * run.dt;
		if (s % keep === 0) {
			const gn = new Float32Array(N);
			const gk = new Float32Array(N);
			for (let i = 0; i < N; i++) {
				gn[i] = HH.gNa * m[i] ** 3 * h[i];
				gk[i] = HH.gK * n[i] ** 4;
			}
			out.t.push(t);
			out.V.push(Float32Array.from(V));
			out.gNa.push(gn);
			out.gK.push(gk);
		}
		for (let i = 0; i < N; i++) {
			const left = V[i > 0 ? i - 1 : i];
			const right = V[i < N - 1 ? i + 1 : i];
			const c = currents(V[i], { m: m[i], h: h[i], n: n[i] });
			const stim = x[i] < run.stimLen && t < run.stimDur ? run.stimAmp : 0;
			dV[i] = (k * (left - 2 * V[i] + right) + stim - c.iNa - c.iK - c.iL) / HH.C;
		}
		for (let i = 0; i < N; i++) {
			const r = rates(V[i]);
			m[i] = gate(m[i], r.am, r.bm);
			h[i] = gate(h[i], r.ah, r.bh);
			n[i] = gate(n[i], r.an, r.bn);
			const before = V[i];
			V[i] += run.dt * dV[i];
			if (Number.isNaN(arrival[i]) && before < SPIKE_LEVEL && V[i] >= SPIKE_LEVEL) {
				arrival[i] = t + (run.dt * (SPIKE_LEVEL - before)) / (V[i] - before);
			}
		}
	}
	return out;
}

/** The squid axon of HH's Part III, ready to run (8 cm, 7 ms). */
export function squidCable(over: Partial<CableRun> = {}): CableRun {
	return {
		radius: SQUID_AXON.radius,
		Ri: SQUID_AXON.Ri,
		T: SQUID_AXON.T,
		length: 8,
		dx: 0.04,
		dt: 0.002,
		tEnd: 7,
		stimAmp: 400,
		stimDur: 0.15,
		stimLen: 0.3,
		every: 0.025,
		...over
	};
}

/**
 * Conduction velocity (m/s) measured in the middle of the cable, between the
 * points at 35% and 65% of its length, away from the stimulus and the far end.
 */
export function velocity(r: CableResult): number {
	const L = r.x[r.x.length - 1];
	const pick = (u: number) => {
		let best = 0;
		for (let i = 0; i < r.x.length; i++)
			if (Math.abs(r.x[i] - u * L) < Math.abs(r.x[best] - u * L)) best = i;
		return best;
	};
	const a = pick(0.35);
	const b = pick(0.65);
	const dt = r.arrival[b] - r.arrival[a];
	return ((r.x[b] - r.x[a]) / dt) * 10; // cm/ms → m/s
}
