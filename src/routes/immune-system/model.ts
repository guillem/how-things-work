/**
 * The within-host model behind the explainer: a flu virus infecting the
 * lining of the airways, the innate response that slows it, and the B and T
 * cells that clear it and remember it.
 *
 * It is the model of Cao, Wang, Yan, McVernon, Xu, Heffernan, Kedzierska &
 * McCaw, "On the role of CD8+ T cells in determining recovery time from
 * influenza virus infection", Frontiers in Immunology 7:611 (2016),
 * arXiv:1609.05977, with every parameter value from its Table 1 (the authors
 * calibrated it to the viral load, CD8⁺ T cells and IgM/IgG antibodies that
 * Miao et al., J. Virol. 84:6687, 2010, measured in mice infected with an
 * H3N2 flu virus). Its equations, in the paper's notation (time in days):
 *
 *   dV/dt  = pV·I − δV·V − κS·V·AS − κL·V·AL − β·V·T     free virus
 *   dT/dt  = gT·(T+R)·(1 − (T+R+I)/T0) − β′·V·T + ρ·R − φ·F·T
 *                                                     healthy target cells
 *   dI/dt  = β′·V·T − δI·I − κN·I·F − κE·I·(E + Em)   infected cells
 *   dF/dt  = pF·I − δF·F                              interferon (innate alarm)
 *   dR/dt  = φ·F·T − ρ·R                              cells made resistant by it
 *   dCn/dt = −βCn·V/(V+hC)·Cn                         naive CD8⁺ T cells recruited
 *   dE/dt  = βCn·V′/(V′+hC)·Cn′·e^(pC·τC) − δE·E       effector (killer) T cells
 *   dBn/dt = −βBn·V/(V+hB)·Bn                         naive B cells recruited
 *   dP/dt  = βBn·V″/(V″+hB)·Bn″·e^(pB·τB) − δP·P       plasma cells
 *   dAS/dt = pS·P − δS·AS                             short-lived antibody (IgM)
 *   dAL/dt = pL·P − δL·AL                             long-lived antibody (IgG, IgA)
 *
 * where ′ means "τC days earlier" and ″ "τB days earlier": a cell recruited
 * today joins the fight as e^(p·τ) effector or plasma cells τ days later, the
 * time it takes to divide, mature and travel to the lung. The innate response
 * works through interferon: it makes healthy cells resistant (φ, ρ) and
 * activates natural killer cells that kill infected ones (κN).
 *
 * Memory (Cao et al., section "Dependence of the recovery time on the level of
 * memory CD8+ T cells", eqs. 12–13 and Supplementary 0.3): at a second
 * infection memory CD8⁺ T cells Cm respond like naive ones but a day sooner
 * (τCm = 5 d) and multiply faster (pCm = 1.5·pC), and their number is 5% of
 * the peak number of effector T cells in the first infection (the share that
 * survives as memory: Harty & Badovinac, Nat. Rev. Immunol. 8:107, 2008).
 *
 * OUR EXTENSION, stated on the page: Cao et al. model memory only for T cells.
 * We give B cells memory by the same rules (a day shorter delay, 1.5× the
 * production rate, and memory cells outnumbering the naive precursors by the
 * same factor as the T cells), so that the second antibody response can be
 * compared with the first. The textbook observation it should reproduce —
 * a second response that starts sooner and climbs higher — is checked by the
 * model test, not built in.
 *
 * Simplifications, stated on the page: the parameters describe flu in mice,
 * not people (human flu runs a similar course: see `HUMAN_FLU`); one virus
 * strain, so a second infection meets exactly the same virus; no CD4⁺ helper
 * T cells, no fever, no symptoms; the cells are well mixed (no space); every
 * naive cell that fits responds the same way; antibody decay is the rate the
 * authors fitted over the first weeks (half-life ≈ 46 days), carried on for
 * months, whereas in people long-lived plasma cells keep antibody levels up
 * for years.
 *
 * Units: virus in EID₅₀/mL (the dose that infects half of a set of hen's eggs,
 * per mL of lung fluid); cells in numbers; interferon dimensionless;
 * antibodies in pg/mL.
 */

// ---------------------------------------------------------------- parameters

/** Cao et al. (2016), Table 1, and the authors' MATLAB code in the Supplementary Material. */
export const CAO = {
	/** Initial viral load, EID₅₀/mL. */
	V0: 1e4,
	/** Epithelial (target) cells in the upper respiratory tract of a mouse (Petrie et al. 2013). */
	T0: 7e7,
	/** Regrowth of healthy cells, /day. */
	gT: 0.8,
	/** Virus produced per infected cell, EID₅₀/mL per cell per day. */
	pV: 210,
	/** Interferon produced per infected cell, per day. */
	pF: 1e-5,
	/** Effector CD8⁺ T cells produced per day, per naive cell, during the delay (Bocharov & Romanyukha 1994). */
	pC: 1.2,
	/** Plasma cells produced per day, per naive B cell, during the delay. */
	pB: 0.52,
	/** Antibody secreted per plasma cell, pg/mL per day: short-lived (IgM) and long-lived (IgG/IgA). */
	pS: 12,
	pL: 4,
	/** Clearance of free virus, /day (Baccam et al. 2006). */
	dV: 5,
	/** Death of infected cells without help, /day (Bocharov & Romanyukha 1994). */
	dI: 2,
	/** Interferon decay, /day (Pawelek et al. 2012). */
	dF: 2,
	/** Death of effector T cells, /day (Veiga-Fernandes et al. 2000). */
	dE: 0.57,
	/** Death of plasma cells, /day. */
	dP: 0.5,
	/** Decay of short-lived and long-lived antibody, /day. */
	dS: 2,
	dL: 0.015,
	/** Virus used up by binding to cells, per cell per day. */
	beta: 5e-7,
	/** Infection of target cells, per EID₅₀/mL per day. */
	betaP: 3e-8,
	/** Interferon turns healthy cells resistant (φ), and they recover (ρ), /day (Pawelek et al. 2012). */
	phi: 0.33,
	rho: 2.6,
	/** Neutralisation of virus by short- and long-lived antibody, per pg/mL per day. */
	kS: 0.8,
	kL: 0.4,
	/** Killing of infected cells by interferon-activated NK cells, /day (Pawelek et al. 2012). */
	kN: 2.5,
	/** Killing of infected cells by effector T cells, per cell per day. */
	kE: 5e-5,
	/** Maximum rate at which virus recruits naive CD8⁺ T cells (Wherry & Ahmed 2004) and B cells, /day. */
	betaCn: 1,
	betaBn: 0.03,
	/** Viral load for half-maximal recruitment, EID₅₀/mL. */
	hC: 1e4,
	hB: 1e4,
	/** Days from recruitment to effector T cells (Lawrence et al. 2005) and to plasma cells. */
	tauC: 6,
	tauB: 4,
	/** Naive CD8⁺ T and B cells that fit the virus at the start ("of order 100"). */
	Cn0: 100,
	Bn0: 100
} as const;

/** Memory cells at a second infection (Cao et al., Supplementary 0.3). */
export const MEMORY = {
	/** Memory T cells start a day sooner than naive ones. */
	tauCm: 5,
	/** …and produce effectors 1.5 times faster. */
	pCm: 1.5 * CAO.pC,
	/** Share of the first infection's peak effector T cells that remain as memory (5–10%). */
	share: 0.05,
	/** OUR EXTENSION for B cells, by the same rules. */
	tauBm: CAO.tauB - 1,
	pBm: 1.5 * CAO.pB
} as const;

/**
 * Human flu, for comparison (Baccam, Beauchemin, Macken, Hayden & Perelson,
 * J. Virol. 80:7590, 2006, Table 1: nasal washes of six volunteers infected
 * with H1N1). Virus peaks on day 2–3 and is undetectable by day 7.
 */
export const HUMAN_FLU = { peakDay: [2, 3], goneByDay: 7 } as const;

/** Viral load at which the model counts the virus as cleared (Cao et al.'s recovery threshold), EID₅₀/mL. */
export const CLEARED = 1;

// ---------------------------------------------------------------- simulation

export interface Scenario {
	/** Infecting dose, EID₅₀/mL. */
	dose: number;
	/** The interferon response (resistant cells, NK killing). */
	innate: boolean;
	/** CD8⁺ (killer) T cells. */
	tcells: boolean;
	/** B cells and antibodies. */
	bcells: boolean;
	/** Day of a second infection with the same virus and dose, or null. */
	reinfectAt: number | null;
	/** Days simulated. */
	days: number;
}

const DEFAULT: Scenario = {
	dose: CAO.V0,
	innate: true,
	tcells: true,
	bcells: true,
	reinfectAt: null,
	days: 30
};

export interface Sample {
	/** Day. */
	t: number;
	V: number;
	T: number;
	I: number;
	R: number;
	F: number;
	/** Naive and memory T cells still waiting to be recruited. */
	Cn: number;
	Cm: number;
	/** Effector T cells from naive and from memory cells. */
	E: number;
	Em: number;
	Bn: number;
	Bm: number;
	/** Plasma cells from naive and from memory B cells. */
	P: number;
	Pm: number;
	AS: number;
	AL: number;
}

/** Integration step, days. Delays are whole multiples of it. */
const DT = 0.002;
/** Samples are kept every this many steps (0.05 day). */
const KEEP = 25;

type State = [
	V: number,
	T: number,
	I: number,
	F: number,
	R: number,
	Cn: number,
	E: number,
	Bn: number,
	P: number,
	AS: number,
	AL: number,
	Cm: number,
	Em: number,
	Bm: number,
	Pm: number
];

/**
 * Runs the model from day 0 (first infection) for `days`. The delayed terms
 * read the recruitment fluxes stored at earlier steps (linear interpolation
 * for the Runge–Kutta half steps), as the authors' scheme does.
 */
export function simulate(scenario: Partial<Scenario> = {}): Sample[] {
	const sc = { ...DEFAULT, ...scenario };
	const c = CAO;
	const m = MEMORY;
	const phi = sc.innate ? c.phi : 0;
	const kN = sc.innate ? c.kN : 0;
	const n = Math.round(sc.days / DT);

	// Recruitment fluxes per step (cells per day), for the delayed terms.
	const fluxC = new Float64Array(n + 2);
	const fluxB = new Float64Array(n + 2);
	const fluxCm = new Float64Array(n + 2);
	const fluxBm = new Float64Array(n + 2);
	const lag = (f: Float64Array, s: number, tau: number) => {
		const x = s - tau / DT;
		if (x < 0) return 0;
		const i = Math.floor(x);
		const u = x - i;
		return f[i] * (1 - u) + f[Math.min(i + 1, f.length - 1)] * u;
	};

	const recruitC = (V: number, Cn: number) => c.betaCn * (V / (V + c.hC)) * Cn;
	const recruitB = (V: number, Bn: number) => c.betaBn * (V / (V + c.hB)) * Bn;
	const gainC = Math.exp(c.pC * c.tauC);
	const gainB = Math.exp(c.pB * c.tauB);
	const gainCm = Math.exp(m.pCm * m.tauCm);
	const gainBm = Math.exp(m.pBm * m.tauBm);

	const deriv = (y: State, s: number): State => {
		const [V, T, I, F, R, Cn, E, Bn, P, AS, AL, Cm, Em, Bm, Pm] = y;
		const dV = c.pV * I - c.dV * V - c.kS * V * AS - c.kL * V * AL - c.beta * V * T;
		const dT =
			c.gT * (T + R) * (1 - (T + R + I) / c.T0) - c.betaP * V * T + c.rho * R - phi * F * T;
		const dI = c.betaP * V * T - c.dI * I - kN * I * F - c.kE * I * (E + Em);
		const dF = c.pF * I - c.dF * F;
		const dR = phi * F * T - c.rho * R;
		const dCn = -recruitC(V, Cn);
		const dE = lag(fluxC, s, c.tauC) * gainC - c.dE * E;
		const dBn = -recruitB(V, Bn);
		const dP = lag(fluxB, s, c.tauB) * gainB - c.dP * P;
		const dAS = c.pS * (P + Pm) - c.dS * AS;
		const dAL = c.pL * (P + Pm) - c.dL * AL;
		const dCm = -recruitC(V, Cm);
		const dEm = lag(fluxCm, s, m.tauCm) * gainCm - c.dE * Em;
		const dBm = -recruitB(V, Bm);
		const dPm = lag(fluxBm, s, m.tauBm) * gainBm - c.dP * Pm;
		return [dV, dT, dI, dF, dR, dCn, dE, dBn, dP, dAS, dAL, dCm, dEm, dBm, dPm];
	};

	const naiveT = sc.tcells ? c.Cn0 : 0;
	const naiveB = sc.bcells ? c.Bn0 : 0;
	let y: State = [sc.dose, c.T0, 0, 0, 0, naiveT, 0, naiveB, 0, 0, 0, 0, 0, 0, 0];
	const out: Sample[] = [];
	const reinfectStep = sc.reinfectAt === null ? -1 : Math.round(sc.reinfectAt / DT);
	let peakE = 0;
	// Last step at which any cells were being recruited, and the longest delay.
	let lastFlux = 0;
	const maxLag = Math.ceil(Math.max(c.tauC, c.tauB, m.tauCm, m.tauBm) / DT) + 2;

	const record = (s: number) => {
		const [V, T, I, F, R, Cn, E, Bn, P, AS, AL, Cm, Em, Bm, Pm] = y;
		out.push({ t: s * DT, V, T, I, F, R, Cn, E, Bn, P, AS, AL, Cm, Em, Bm, Pm });
	};

	for (let s = 0; s <= n; s++) {
		if (s === reinfectStep) {
			// Second infection: the same dose again, met by memory cells.
			const memT = m.share * peakE;
			const ratio = naiveT > 0 ? memT / naiveT : 0;
			y = [...y] as State;
			y[0] += sc.dose;
			y[11] = memT;
			y[13] = naiveB * ratio;
		}
		fluxC[s] = recruitC(y[0], y[5]);
		fluxB[s] = recruitB(y[0], y[7]);
		fluxCm[s] = recruitC(y[0], y[11]);
		fluxBm[s] = recruitB(y[0], y[13]);
		if (fluxC[s] + fluxB[s] + fluxCm[s] + fluxBm[s] > 0) lastFlux = s;
		if (s % KEEP === 0) record(s);
		if (s === n) break;
		peakE = Math.max(peakE, y[6] + y[12]);

		// Between infections nothing fast happens: cells and antibodies only
		// decay. Take one long step to the next sample (rates ≤ 2.6/day).
		if (
			y[0] === 0 &&
			y[2] === 0 &&
			s - lastFlux > maxLag &&
			s % KEEP === 0 &&
			s + KEEP <= n &&
			(reinfectStep < s || s + KEEP <= reinfectStep)
		) {
			y = rk4(deriv, y, s, KEEP * DT, KEEP);
			s += KEEP - 1;
			continue;
		}

		// The losses of virus and infected cells become very fast when a
		// strong immune response meets them (thousands per day); the step is
		// split so that the explicit solver stays stable.
		const [V, , I, F, , , E, , , AS, AL, , Em] = y;
		const fast =
			V > 0 || I > 0 ? Math.max(c.dV + c.kS * AS + c.kL * AL, c.dI + kN * F + c.kE * (E + Em)) : 0;
		const parts = Math.max(1, Math.ceil((fast * DT) / 0.5));
		const h = DT / parts;
		for (let j = 0; j < parts; j++) y = rk4(deriv, y, s + j / parts, h, 1 / parts);
		// Once less than one infected cell and one infectious dose are left,
		// the infection is over. (A continuous model would otherwise keep a
		// vanishing trace of virus that could regrow months later.)
		if (y[2] < 1 && y[0] < CLEARED) {
			y[0] = 0;
			y[2] = 0;
		}
	}
	return out;
}

/** One Runge–Kutta step of length `h` days from step index `u`, which advances by `du`. */
function rk4(deriv: (y: State, u: number) => State, y: State, u: number, h: number, du: number) {
	const k1 = deriv(y, u);
	const k2 = deriv(add(y, k1, h / 2), u + du / 2);
	const k3 = deriv(add(y, k2, h / 2), u + du / 2);
	const k4 = deriv(add(y, k3, h), u + du);
	// Counts can't go negative; tiny overshoots of the solver are clipped.
	return y.map((v, i) =>
		Math.max(0, v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
	) as State;
}

function add(y: State, k: State, h: number): State {
	return y.map((v, i) => v + h * k[i]) as State;
}

// ---------------------------------------------------------------- read-outs

/** The sample nearest to day `t`. */
export function at(series: readonly Sample[], t: number): Sample {
	const dt = series.length > 1 ? series[1].t - series[0].t : 1;
	const i = Math.round((t - series[0].t) / dt);
	return series[Math.max(0, Math.min(series.length - 1, i))];
}

/** Effector T cells (from naive and memory), antibodies (both kinds). */
export const effectors = (s: Sample) => s.E + s.Em;
export const antibody = (s: Sample) => s.AS + s.AL;

/** Peak of `f` between days `from` and `to`: its value and day. */
export function peak(
	series: readonly Sample[],
	f: (s: Sample) => number,
	from = -Infinity,
	to = Infinity
) {
	let best = { t: NaN, v: -Infinity };
	for (const s of series) {
		if (s.t < from || s.t > to) continue;
		const v = f(s);
		if (v > best.v) best = { t: s.t, v };
	}
	return best;
}

/**
 * First day after `from` (and after the virus has peaked) on which the viral
 * load falls below `CLEARED`, or null if it never does.
 */
export function clearedDay(series: readonly Sample[], from = 0, to = Infinity): number | null {
	const p = peak(series, (s) => s.V, from, to);
	for (const s of series) {
		if (s.t > p.t && s.t <= to && s.V < CLEARED) return s.t;
	}
	return null;
}

/** First day after `from` on which `f` exceeds `level`, or null. */
export function firstAbove(
	series: readonly Sample[],
	f: (s: Sample) => number,
	level: number,
	from = 0,
	to = Infinity
): number | null {
	for (const s of series) if (s.t >= from && s.t <= to && f(s) > level) return s.t;
	return null;
}

/** Share of the airway lining still healthy (target + resistant cells). */
export const healthy = (s: Sample) => (s.T + s.R) / CAO.T0;
