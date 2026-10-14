/**
 * The model behind the vaccine charts: the immune response of the
 * immune-system explainer (Cao et al. 2016, see `../immune-system/model.ts`),
 * met first by a vaccine instead of a virus.
 *
 * Everything about the response is that page's model, with the same
 * equations and every parameter from Cao et al.'s Table 1: naive B and T
 * cells that fit the antigen are recruited at a rate that rises with the
 * amount of antigen (a Hill function, half-maximal at hC = hB = 10⁴), each
 * recruited cell turns into e^(p·τ) plasma or killer T cells τ days later,
 * plasma cells make a short- and a long-lived antibody, and memory cells
 * left from an earlier response start a day sooner and multiply 1.5 times
 * faster (Cao et al.'s memory rule; our extension to B cells, as on the
 * immune-system page).
 *
 * WHAT IS NEW HERE, stated on the page:
 *
 * 1. The vaccine's antigen. Cells that took up the vaccine translate its
 *    mRNA, and the spike protein they make is what the B and T cells see.
 *    Translation fades as the cells break the mRNA down: after an injection
 *    into the muscle, protein production from nucleoside-modified mRNA in
 *    lipid nanoparticles falls with a half-life of 20.6 hours (Pardi et al.,
 *    J. Control. Release 217:345, 2015, Table 1, in mice). We take the
 *    antigen the immune cells see to be proportional to that production:
 *        A(t) = A₀ · e^(−δM·(t − t_dose)),   δM = ln 2 / 20.6 h
 *    for each dose, and add it to the virus in the recruitment terms
 *    (V → V + A). Antigen below one unit counts as gone, as the virus does.
 *    The vaccine's antigen does not multiply, infects no cell and raises no
 *    interferon alarm.
 *
 * 2. The size of a dose, A₀, in the model's units of virus. It is the one
 *    parameter we fit: chosen so that two doses leave a peak of antibody
 *    2.8 times the peak after the model's infection. In the phase 1 trial of
 *    the BioNTech/Pfizer vaccine, neutralising antibody 7–14 days after the
 *    second dose was 1.7 to 4.6 times that of people who had recovered from
 *    COVID-19 (Walsh et al., N. Engl. J. Med. 383:2439, 2020, adults
 *    18–55); 2.8 is the geometric middle. Everything else (one dose against
 *    two, the second dose's boost, a later infection) follows from the model.
 *
 * 3. Memory over several meetings. Cao et al. give memory for one second
 *    infection. Here, at each new meeting (a dose or an infection) the
 *    memory T cells waiting are 5% of the largest number of killer T cells
 *    of any earlier response, and the memory B cells outnumber the naive
 *    ones by the same factor (the rule of the immune-system page, applied
 *    to every meeting).
 *
 * Simplifications, stated on the page: the response's parameters are those
 * of flu in mice, so the infection is that page's flu virus and the vaccine
 * makes its surface protein; the antibody's decay (half-life ≈ 46 days) is
 * Cao et al.'s, carried on for months; one strain, so the virus that comes
 * later is exactly the one the vaccine copied; no helper T cells, no
 * germinal centres (antibodies don't improve between doses).
 */
import { CAO, CLEARED, MEMORY, type Sample } from '../immune-system/model';

export { CLEARED };

/** Translation of the vaccine's mRNA after injection into the muscle (Pardi et al. 2015). */
export const MRNA = {
	/** Half-life of protein production from m1Ψ-mRNA in lipid nanoparticles, intramuscular, hours. */
	halfLifeHours: 20.6,
	/** Loss rate, per day. */
	rate: Math.LN2 / (20.6 / 24),
	/** Expression detectable "for up to 8 days" after an intramuscular injection. */
	detectableDays: 8
} as const;

/**
 * Antigen per dose, in the model's units of virus (EID₅₀/mL). Fitted so that
 * two doses 21 days apart leave 2.8 times the antibody peak of an infection
 * (see the header; `fitDose` recomputes it, and the model test checks it).
 */
export const DOSE = 8.2e3;

/** The target of the fit: two doses against recovered people (Walsh et al. 2020, ages 18–55). */
export const WALSH = { low: 1.7, high: 4.6, target: Math.sqrt(1.7 * 4.6) } as const;

/** Days between the two doses of the BioNTech/Pfizer vaccine (Comirnaty) as authorised. */
export const INTERVAL = 21;

export interface Schedule {
	/** Days of the vaccine doses. */
	doses: readonly number[];
	/** Day of an infection with the model's virus (Cao et al.'s dose), or null. */
	infectAt: number | null;
	/** Days simulated. */
	days: number;
	/** Antigen per dose (A₀). */
	dose?: number;
}

export interface Point extends Sample {
	/** Vaccine antigen (in units of virus), and the share of a dose's mRNA still being translated. */
	A: number;
	M: number;
}

const DT = 0.002;
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

/** Share of each dose's mRNA still translated at day t, summed over the doses given. */
export function mrnaLeft(doses: readonly number[], t: number): number {
	let m = 0;
	for (const d of doses) if (t >= d) m += Math.exp(-MRNA.rate * (t - d));
	return m;
}

/** Runs the model from day 0 for `days`, with vaccine doses and an infection. */
export function simulate(schedule: Schedule): Point[] {
	const c = CAO;
	const m = MEMORY;
	const a0 = schedule.dose ?? DOSE;
	const doses = [...schedule.doses].sort((x, y) => x - y);
	const n = Math.round(schedule.days / DT);
	const antigen = (s: number) => {
		const a = a0 * mrnaLeft(doses, s * DT);
		return a < CLEARED ? 0 : a;
	};

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
	const recruitC = (X: number, Cn: number) => c.betaCn * (X / (X + c.hC)) * Cn;
	const recruitB = (X: number, Bn: number) => c.betaBn * (X / (X + c.hB)) * Bn;
	const gainC = Math.exp(c.pC * c.tauC);
	const gainB = Math.exp(c.pB * c.tauB);
	const gainCm = Math.exp(m.pCm * m.tauCm);
	const gainBm = Math.exp(m.pBm * m.tauBm);

	const deriv = (y: State, s: number): State => {
		const [V, T, I, F, R, Cn, E, Bn, P, AS, AL, Cm, Em, Bm, Pm] = y;
		const X = V + antigen(s);
		const dV = c.pV * I - c.dV * V - c.kS * V * AS - c.kL * V * AL - c.beta * V * T;
		const dT =
			c.gT * (T + R) * (1 - (T + R + I) / c.T0) - c.betaP * V * T + c.rho * R - c.phi * F * T;
		const dI = c.betaP * V * T - c.dI * I - c.kN * I * F - c.kE * I * (E + Em);
		const dF = c.pF * I - c.dF * F;
		const dR = c.phi * F * T - c.rho * R;
		const dCn = -recruitC(X, Cn);
		const dE = lag(fluxC, s, c.tauC) * gainC - c.dE * E;
		const dBn = -recruitB(X, Bn);
		const dP = lag(fluxB, s, c.tauB) * gainB - c.dP * P;
		const dAS = c.pS * (P + Pm) - c.dS * AS;
		const dAL = c.pL * (P + Pm) - c.dL * AL;
		const dCm = -recruitC(X, Cm);
		const dEm = lag(fluxCm, s, m.tauCm) * gainCm - c.dE * Em;
		const dBm = -recruitB(X, Bm);
		const dPm = lag(fluxBm, s, m.tauBm) * gainBm - c.dP * Pm;
		return [dV, dT, dI, dF, dR, dCn, dE, dBn, dP, dAS, dAL, dCm, dEm, dBm, dPm];
	};

	let y: State = [0, c.T0, 0, 0, 0, c.Cn0, 0, c.Bn0, 0, 0, 0, 0, 0, 0, 0];
	const out: Point[] = [];
	const doseSteps = new Set(doses.map((d) => Math.round(d / DT)));
	const infectStep = schedule.infectAt === null ? -1 : Math.round(schedule.infectAt / DT);
	const events = [...doseSteps, infectStep].filter((s) => s >= 0).sort((a, b) => a - b);
	let met = false;
	let peakE = 0;
	let lastFlux = -Infinity;
	const maxLag = Math.ceil(Math.max(c.tauC, c.tauB, m.tauCm, m.tauBm) / DT) + 2;

	const record = (s: number) => {
		const [V, T, I, F, R, Cn, E, Bn, P, AS, AL, Cm, Em, Bm, Pm] = y;
		const t = s * DT;
		out.push({
			t,
			V,
			T,
			I,
			F,
			R,
			Cn,
			E,
			Bn,
			P,
			AS,
			AL,
			Cm,
			Em,
			Bm,
			Pm,
			A: antigen(s),
			M: mrnaLeft(doses, t)
		});
	};

	for (let s = 0; s <= n; s++) {
		const isDose = doseSteps.has(s);
		if (isDose || s === infectStep) {
			y = [...y] as State;
			// A meeting after an earlier one: memory cells are waiting.
			if (met) {
				const memT = Math.max(y[11], m.share * peakE);
				y[11] = memT;
				y[13] = Math.max(y[13], c.Bn0 * (memT / c.Cn0));
			}
			if (s === infectStep) y[0] += c.V0;
			met = true;
		}
		const X = y[0] + antigen(s);
		fluxC[s] = recruitC(X, y[5]);
		fluxB[s] = recruitB(X, y[7]);
		fluxCm[s] = recruitC(X, y[11]);
		fluxBm[s] = recruitB(X, y[13]);
		if (fluxC[s] + fluxB[s] + fluxCm[s] + fluxBm[s] > 0) lastFlux = s;
		if (s % KEEP === 0) record(s);
		if (s === n) break;
		peakE = Math.max(peakE, y[6] + y[12]);

		// Quiet stretches (no virus, no antigen, nobody being recruited):
		// cells and antibodies only decay; one long step to the next sample.
		const next = events.find((e) => e > s) ?? Infinity;
		if (
			y[0] === 0 &&
			y[2] === 0 &&
			X === 0 &&
			s - lastFlux > maxLag &&
			s % KEEP === 0 &&
			s + KEEP <= n &&
			s + KEEP <= next
		) {
			y = rk4(deriv, y, s, KEEP * DT, KEEP);
			s += KEEP - 1;
			continue;
		}

		const [V, , I, F, , , E, , , AS, AL, , Em] = y;
		const fast =
			V > 0 || I > 0
				? Math.max(c.dV + c.kS * AS + c.kL * AL, c.dI + c.kN * F + c.kE * (E + Em))
				: 0;
		const parts = Math.max(1, Math.ceil((fast * DT) / 0.5));
		const h = DT / parts;
		for (let j = 0; j < parts; j++) y = rk4(deriv, y, s + j / parts, h, 1 / parts);
		if (y[2] < 1 && y[0] < CLEARED) {
			y[0] = 0;
			y[2] = 0;
		}
	}
	return out;
}

function rk4(deriv: (y: State, u: number) => State, y: State, u: number, h: number, du: number) {
	const k1 = deriv(y, u);
	const k2 = deriv(add(y, k1, h / 2), u + du / 2);
	const k3 = deriv(add(y, k2, h / 2), u + du / 2);
	const k4 = deriv(add(y, k3, h), u + du);
	return y.map((v, i) =>
		Math.max(0, v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
	) as State;
}

function add(y: State, k: State, h: number): State {
	return y.map((v, i) => v + h * k[i]) as State;
}

// ---------------------------------------------------------------- read-outs

export { antibody, at, effectors, peak } from '../immune-system/model';
import { antibody, peak } from '../immune-system/model';

/** Peak antibody of the model's first infection (no vaccine), the yardstick of the charts. */
let infectionPeak: number | null = null;
export function infectionAntibodyPeak(): number {
	infectionPeak ??= peak(simulate({ doses: [], infectAt: 0, days: 40 }), antibody).v;
	return infectionPeak;
}

/** Antibody peak of a two-dose course, relative to an infection's, for a given A₀. */
export function twoDoseRatio(dose = DOSE): number {
	const run = simulate({ doses: [0, INTERVAL], infectAt: null, days: INTERVAL + 40, dose });
	return peak(run, antibody).v / infectionAntibodyPeak();
}

/** Bisection (on a log scale) for the A₀ at which two doses give `target` × an infection's antibody. */
export function fitDose(target: number = WALSH.target): number {
	let lo = 1e2;
	let hi = 1e9;
	for (let k = 0; k < 40; k++) {
		const mid = Math.sqrt(lo * hi);
		if (twoDoseRatio(mid) < target) lo = mid;
		else hi = mid;
	}
	return Math.sqrt(lo * hi);
}

/**
 * First day after `from` on which the virus is below `CLEARED` after having
 * peaked, or null; and whether it never grew past the dose it started from.
 */
export function infectionOutcome(series: readonly Point[], from: number) {
	const after = series.filter((s) => s.t >= from);
	const p = peak(after, (s) => s.V);
	let cleared: number | null = null;
	for (const s of after)
		if (s.t > p.t && s.V < CLEARED) {
			cleared = s.t - from;
			break;
		}
	return { peakV: p.v, peakDay: p.t - from, cleared, stopped: p.v <= CAO.V0 * 1.0001 };
}
