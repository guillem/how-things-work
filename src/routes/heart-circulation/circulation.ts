/**
 * The heart and circulation as a closed loop of elastic chambers and pipes
 * (a "lumped-parameter" or Windkessel model, the standard textbook model of
 * the cardiovascular system).
 *
 * Eight compartments, in the order blood visits them:
 *   right atrium → right ventricle → lung arteries → lung veins →
 *   left atrium → left ventricle → body arteries → body veins → (back)
 *
 * - A heart chamber is an elastic bag whose stiffness rises when its muscle
 *   contracts: P = E(t)·(V − V₀), E(t) = E_min + (E_max − E_min)·a(t), with
 *   a(t) ∈ [0, 1] the muscle's activation (time-varying elastance, Suga &
 *   Sagawa). Blood vessels are elastic tubes: P = V / C (C = compliance;
 *   volumes are "stressed" volumes, the blood that actually stretches them).
 * - Blood flows from high to low pressure through resistances: Q = ΔP / R.
 * - Valves are one-way: a valve conducts forward (small resistance) and is
 *   shut backwards. A leaky valve also lets blood back through a hole of area
 *   A (cm²) at the speed given by Bernoulli's law, ΔP = 4v² (mmHg, m/s), as
 *   cardiologists measure it: Q = 50·A·√ΔP mL/s.
 * - A narrowed artery follows Poiseuille's law: resistance ∝ 1 / radius⁴.
 * - One electrical clock sets the beat: the sinus node fires (P wave), the
 *   atria contract, the AV node delays the signal (PR interval), then the
 *   ventricles are activated (QRS) and relax as they recover (end of T). The
 *   ventricles stay activated for the QT interval, which shortens at faster
 *   rates (Bazett: QT = 0.40 s · √RR); PR scales the same way.
 * - Oxygen: blood leaves the lungs 98% saturated; the body takes 250 mL of
 *   O₂ a minute at rest, so by Fick's principle the blood returning has lost
 *   VO₂ / (cardiac output × O₂ capacity), with 15 g/dL haemoglobin carrying
 *   1.34 mL O₂ per gram.
 *
 * Simplifications: no reflexes (the nervous system does not adjust the
 * vessels or the heart's strength), no blood inertia, the ECG is drawn from
 * standard wave shapes placed by the same clock that drives the muscle, the
 * lungs always saturate the blood fully, and only one valve leaks at a time.
 *
 * The model is integrated with fourth-order Runge–Kutta (0.5 ms steps), beat
 * after beat, until each beat repeats the last one (a steady rhythm); one
 * such beat is returned, sampled every `SAMPLE` seconds.
 */

export const SAMPLE = 0.002;
const DT = 0.0005;

/** Compartment order in the state vector. */
export const RA = 0;
export const RV = 1;
export const PA = 2;
export const PV = 3;
export const LA = 4;
export const LV = 5;
export const SA = 6;
export const SV = 7;

export type Valve = 'mitral' | 'aortic';

export interface Settings {
	/** Heart rate (beats per minute). */
	hr: number;
	/** Radius of the body's small arteries as a fraction of normal (1 = healthy). */
	width: number;
	/** Which valve leaks. */
	valve: Valve;
	/** Area of the hole in the leaking valve (cm²); 0 = no leak. */
	leak: number;
}

export const NORMAL: Settings = { hr: 75, width: 1, valve: 'mitral', leak: 0 };

interface Chamber {
	emin: number;
	emax: number;
	v0: number;
}

/** Chamber stiffness (mmHg/mL) relaxed and fully contracted, unstressed volume (mL). */
export const CHAMBERS = {
	ra: { emin: 0.1, emax: 0.25, v0: 4 },
	rv: { emin: 0.05, emax: 0.55, v0: 10 },
	la: { emin: 0.12, emax: 0.3, v0: 4 },
	lv: { emin: 0.08, emax: 2.9, v0: 10 }
} satisfies Record<string, Chamber>;

/** Compliances (mL/mmHg) of the vessels. */
export const COMPLIANCE = { pa: 4, pv: 12, sa: 1.3, sv: 70 };

/** Resistances (mmHg·s/mL). */
export const RESISTANCE = {
	tricuspid: 0.004,
	pulmonary: 0.006,
	lungs: 0.08,
	lungVeins: 0.01,
	mitral: 0.004,
	aortic: 0.006,
	body: 1.0,
	bodyVeins: 0.03
};

/** Stressed blood volume (mL) spread over the eight compartments. */
export const BLOOD = 1100;

/** Oxygen. */
export const O2 = {
	/** Saturation of blood leaving the lungs. */
	arterial: 0.98,
	/** Oxygen used by the body at rest (mL O₂ per minute). */
	use: 250,
	/** Haemoglobin (g/dL) × 1.34 mL O₂/g → mL O₂ per litre of fully saturated blood. */
	capacity: 15 * 1.34 * 10
};

/** Body resistance for a given artery radius (fraction of normal): Poiseuille, R ∝ 1/r⁴. */
export const bodyResistance = (width: number) => RESISTANCE.body / width ** 4;

// ------------------------------------------------------------ the electrical clock

export interface Timing {
	/** Seconds per beat. */
	rr: number;
	/** Start of the P wave = start of the beat (s). */
	p: number;
	/** PR interval: start of P to start of QRS (s). */
	pr: number;
	/** QT interval: start of QRS to end of T (s). */
	qt: number;
	/** Atrial activation start and duration (s). */
	atria: number;
	atriaDur: number;
	/** Ventricular activation start, rise and fall durations (s). */
	ventricles: number;
	rise: number;
	fall: number;
}

export function timing(hr: number): Timing {
	const rr = 60 / hr;
	const s = Math.sqrt(rr);
	const pr = 0.16 * s;
	const qt = 0.4 * s;
	return {
		rr,
		p: 0,
		pr,
		qt,
		atria: pr - 0.04 * s,
		atriaDur: 0.13 * s,
		ventricles: pr + 0.03,
		rise: 0.68 * qt,
		fall: 0.32 * qt
	};
}

/** Atrial activation (0–1) at time τ into the beat. */
export function atrialActivation(T: Timing, tau: number) {
	const u = (tau - T.atria) / T.atriaDur;
	return u > 0 && u < 1 ? 0.5 * (1 - Math.cos(2 * Math.PI * u)) : 0;
}

/** Ventricular activation (0–1) at time τ into the beat: half-cosine rise, faster fall. */
export function ventricularActivation(T: Timing, tau: number) {
	const t = tau - T.ventricles;
	if (t <= 0) return 0;
	if (t < T.rise) return 0.5 * (1 - Math.cos((Math.PI * t) / T.rise));
	if (t < T.rise + T.fall) return 0.5 * (1 + Math.cos((Math.PI * (t - T.rise)) / T.fall));
	return 0;
}

const gauss = (t: number, c: number, s: number) => Math.exp(-0.5 * ((t - c) / s) ** 2);

/**
 * Surface ECG (mV, lead II-like) at time τ into the beat: P, Q, R, S and T
 * waves as smooth bumps, timed by the same clock that activates the muscle.
 */
export function ecg(T: Timing, tau: number) {
	const s = Math.sqrt(T.rr);
	const q = T.pr;
	return (
		0.15 * gauss(tau, 0.05, 0.022) -
		0.12 * gauss(tau, q + 0.012, 0.008) +
		1.2 * gauss(tau, q + 0.035, 0.011) -
		0.3 * gauss(tau, q + 0.06, 0.011) +
		0.3 * gauss(tau, q + T.qt - 0.09 * s, 0.04 * s)
	);
}

/** Centres of the ECG waves (s into the beat), for labelling. */
export function ecgWaves(T: Timing) {
	const s = Math.sqrt(T.rr);
	return { p: 0.05, r: T.pr + 0.035, t: T.pr + T.qt - 0.09 * s };
}

// ------------------------------------------------------------ the circulation

const elastance = (c: Chamber, a: number) => c.emin + (c.emax - c.emin) * a;

/** Leak through a hole of `area` cm² under a pressure drop dp (mmHg), smoothed near 0. */
export const leakFlow = (area: number, dp: number) =>
	(50 * area * dp) / Math.sqrt(Math.abs(dp) + 0.25);

export interface Instant {
	/** Pressures (mmHg), indexed by compartment. */
	p: number[];
	/** Flows (mL/s) through the four valves (+ forward, − leak back) and the two beds. */
	tricuspid: number;
	pulmonary: number;
	mitral: number;
	aortic: number;
	lungs: number;
	body: number;
	venous: number;
	lungVeins: number;
}

function evaluate(s: Settings, T: Timing, rBody: number, tau: number, v: number[]): Instant {
	const aa = atrialActivation(T, tau);
	const av = ventricularActivation(T, tau);
	const { ra, rv, la, lv } = CHAMBERS;
	const p = [
		elastance(ra, aa) * (v[RA] - ra.v0),
		elastance(rv, av) * (v[RV] - rv.v0),
		v[PA] / COMPLIANCE.pa,
		v[PV] / COMPLIANCE.pv,
		elastance(la, aa) * (v[LA] - la.v0),
		elastance(lv, av) * (v[LV] - lv.v0),
		v[SA] / COMPLIANCE.sa,
		v[SV] / COMPLIANCE.sv
	];
	const valve = (from: number, to: number, r: number, leaks: boolean) => {
		const dp = p[from] - p[to];
		if (dp > 0) return dp / r;
		return leaks && s.leak > 0 ? leakFlow(s.leak, dp) : 0;
	};
	return {
		p,
		tricuspid: valve(RA, RV, RESISTANCE.tricuspid, false),
		pulmonary: valve(RV, PA, RESISTANCE.pulmonary, false),
		mitral: valve(LA, LV, RESISTANCE.mitral, s.valve === 'mitral'),
		aortic: valve(LV, SA, RESISTANCE.aortic, s.valve === 'aortic'),
		lungs: (p[PA] - p[PV]) / RESISTANCE.lungs,
		lungVeins: (p[PV] - p[LA]) / RESISTANCE.lungVeins,
		body: (p[SA] - p[SV]) / rBody,
		venous: (p[SV] - p[RA]) / RESISTANCE.bodyVeins
	};
}

function derivative(i: Instant): number[] {
	return [
		i.venous - i.tricuspid,
		i.tricuspid - i.pulmonary,
		i.pulmonary - i.lungs,
		i.lungs - i.lungVeins,
		i.lungVeins - i.mitral,
		i.mitral - i.aortic,
		i.aortic - i.body,
		i.body - i.venous
	];
}

/** The eight flows, in the order blood meets them (body veins → right atrium first). */
export const FLOWS = [
	'venous',
	'tricuspid',
	'pulmonary',
	'lungs',
	'lungVeins',
	'mitral',
	'aortic',
	'body'
] as const;
export type Flow = (typeof FLOWS)[number];

export interface Beat {
	settings: Settings;
	timing: Timing;
	/** Sample times (s into the beat), every SAMPLE. */
	t: Float64Array;
	/** Pressures (mmHg) per compartment, per sample. */
	p: Float64Array[];
	/** Volumes (mL) per compartment, per sample. */
	v: Float64Array[];
	/** Flows (mL/s) per sample: through the four valves and the pipes between them. */
	flow: Record<Flow, Float64Array>;
	/** Volume (mL) passed through each since the start of the beat (net). */
	passed: Record<Flow, Float64Array>;
	/** ECG (mV) and activations per sample. */
	ecg: Float64Array;
	atria: Float64Array;
	ventricles: Float64Array;
	/** Beats simulated before the rhythm became steady. */
	beats: number;
}

const blank = (n: number) => new Float64Array(n);

/** A sensible starting point: volumes near a healthy resting state. */
function initialVolumes(): number[] {
	const v = [60, 110, 70, 130, 55, 110, 140, 0];
	v[SV] = BLOOD - v.reduce((a, b) => a + b, 0);
	return v;
}

/**
 * Simulates beats until the rhythm is steady (volumes at the start of a beat
 * change by less than 0.02 mL) and returns the last beat.
 */
export function simulate(settings: Settings, maxBeats = 120): Beat {
	const T = timing(settings.hr);
	const rBody = bodyResistance(settings.width);
	const steps = Math.round(T.rr / DT);
	const h = T.rr / steps;
	const every = Math.max(1, Math.round(SAMPLE / h));
	const n = Math.floor(steps / every) + 1;
	let v = initialVolumes();
	const beat: Beat = {
		settings,
		timing: T,
		t: blank(n),
		p: Array.from({ length: 8 }, () => blank(n)),
		v: Array.from({ length: 8 }, () => blank(n)),
		flow: Object.fromEntries(FLOWS.map((k) => [k, blank(n)])) as Record<Flow, Float64Array>,
		passed: Object.fromEntries(FLOWS.map((k) => [k, blank(n)])) as Record<Flow, Float64Array>,
		ecg: blank(n),
		atria: blank(n),
		ventricles: blank(n),
		beats: 0
	};
	const add = (a: number[], b: number[], k: number) => a.map((x, i) => x + k * b[i]);
	for (let b = 0; b < maxBeats; b++) {
		const start = v.slice();
		const passed = Object.fromEntries(FLOWS.map((k) => [k, 0])) as Record<Flow, number>;
		for (let j = 0; j <= steps; j++) {
			const tau = j * h;
			const now = evaluate(settings, T, rBody, tau, v);
			if (j % every === 0) {
				const i = j / every;
				beat.t[i] = tau;
				for (let c = 0; c < 8; c++) {
					beat.p[c][i] = now.p[c];
					beat.v[c][i] = v[c];
				}
				for (const k of FLOWS) {
					beat.flow[k][i] = now[k];
					beat.passed[k][i] = passed[k];
				}
				beat.ecg[i] = ecg(T, tau);
				beat.atria[i] = atrialActivation(T, tau);
				beat.ventricles[i] = ventricularActivation(T, tau);
			}
			if (j === steps) break;
			// RK4
			const k1 = derivative(now);
			const i2 = evaluate(settings, T, rBody, tau + h / 2, add(v, k1, h / 2));
			const k2 = derivative(i2);
			const i3 = evaluate(settings, T, rBody, tau + h / 2, add(v, k2, h / 2));
			const k3 = derivative(i3);
			const i4 = evaluate(settings, T, rBody, tau + h, add(v, k3, h));
			const k4 = derivative(i4);
			for (const k of FLOWS) passed[k] += (h / 6) * (now[k] + 2 * i2[k] + 2 * i3[k] + i4[k]);
			v = v.map((x, c) => x + (h / 6) * (k1[c] + 2 * k2[c] + 2 * k3[c] + k4[c]));
		}
		beat.beats = b + 1;
		const change = Math.max(...v.map((x, c) => Math.abs(x - start[c])));
		if (change < 0.02 && b > 4) break;
	}
	return beat;
}

// ------------------------------------------------------------ summaries

const max = (a: Float64Array) => a.reduce((m, x) => Math.max(m, x), -Infinity);
const min = (a: Float64Array) => a.reduce((m, x) => Math.min(m, x), Infinity);
const mean = (a: Float64Array) => a.reduce((s, x) => s + x, 0) / a.length;

export interface Summary {
	hr: number;
	/** Left ventricle: volume when full and after squeezing (mL). */
	edv: number;
	esv: number;
	/** Blood the left ventricle squeezes out per beat, all ways (mL). */
	ejected: number;
	/** Blood sent on to the body per beat, net (mL): the stroke volume. */
	stroke: number;
	/** Blood the right ventricle sends to the lungs per beat, net (mL). */
	strokeRight: number;
	/** Blood that went the wrong way through the leaking valve per beat (mL). */
	backflow: number;
	/** Ejection fraction (ejected / edv). */
	ef: number;
	/** Cardiac output (L/min): net forward flow. */
	output: number;
	/** Pressures (mmHg). */
	lvMax: number;
	aorta: { sys: number; dia: number; mean: number };
	lungArtery: { sys: number; dia: number; mean: number };
	rvMax: number;
	laMean: number;
	raMean: number;
	/** O₂ saturation of blood returning from the body (0–1). */
	venousO2: number;
	arterialO2: number;
}

/** Net volume (mL) passed through a valve in one beat. */
const net = (a: Float64Array) => a[a.length - 1];

export function summarize(beat: Beat): Summary {
	const lv = beat.v[LV];
	const edv = max(lv);
	const esv = min(lv);
	const stroke = net(beat.passed.aortic);
	const strokeRight = net(beat.passed.pulmonary);
	const backflow = Math.max(0, -backward(beat.flow[beat.settings.valve]));
	const output = (stroke * beat.settings.hr) / 1000;
	const venousO2 = venousSaturation(output);
	return {
		hr: beat.settings.hr,
		edv,
		esv,
		ejected: edv - esv,
		stroke,
		strokeRight,
		backflow,
		ef: (edv - esv) / edv,
		output,
		lvMax: max(beat.p[LV]),
		aorta: { sys: max(beat.p[SA]), dia: min(beat.p[SA]), mean: mean(beat.p[SA]) },
		lungArtery: { sys: max(beat.p[PA]), dia: min(beat.p[PA]), mean: mean(beat.p[PA]) },
		rvMax: max(beat.p[RV]),
		laMean: mean(beat.p[LA]),
		raMean: mean(beat.p[RA]),
		venousO2,
		arterialO2: O2.arterial
	};
}

/** Volume (mL, ≤ 0) that went backwards through a valve during the beat. */
function backward(flow: Float64Array) {
	let s = 0;
	for (let i = 1; i < flow.length; i++) {
		const q = (flow[i - 1] + flow[i]) / 2;
		if (q < 0) s += q * SAMPLE;
	}
	return s;
}

/** Fick's principle: saturation of the blood coming back for a cardiac output (L/min). */
export function venousSaturation(output: number) {
	if (output <= 0) return 0;
	return Math.max(0, O2.arterial - O2.use / (output * O2.capacity));
}

/** Index of the sample at time τ into the beat (wrapping), and the fraction to the next. */
export function sampleAt(beat: Beat, tau: number) {
	const n = beat.t.length - 1;
	const u = (((tau % beat.timing.rr) + beat.timing.rr) % beat.timing.rr) / SAMPLE;
	const i = Math.min(n - 1, Math.floor(u));
	return { i, f: Math.min(1, u - i) };
}

/** Value of a sampled series at τ (linear interpolation). */
export function valueAt(beat: Beat, series: Float64Array, tau: number) {
	const { i, f } = sampleAt(beat, tau);
	return series[i] + (series[i + 1] - series[i]) * f;
}

/** Times (s into the beat) at which a valve opens and closes (first opening, last closing). */
export function valveEvents(beat: Beat, valve: Flow) {
	const q = beat.flow[valve];
	const open: number[] = [];
	const close: number[] = [];
	for (let i = 1; i < q.length; i++) {
		if (q[i - 1] <= 0.5 && q[i] > 0.5) open.push(beat.t[i]);
		if (q[i - 1] > 0.5 && q[i] <= 0.5) close.push(beat.t[i]);
	}
	return { open, close };
}

const cache = new Map<string, { beat: Beat; summary: Summary }>();

/** The steady beat and its summary for some settings, cached (the scenes ask often). */
export function steadyBeat(s: Settings) {
	const key = `${s.hr}|${s.width}|${s.valve}|${s.leak}`;
	let hit = cache.get(key);
	if (!hit) {
		const beat = simulate(s);
		hit = { beat, summary: summarize(beat) };
		if (cache.size > 200) cache.delete(cache.keys().next().value!);
		cache.set(key, hit);
	}
	return hit;
}
