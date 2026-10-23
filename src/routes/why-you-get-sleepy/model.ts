/**
 * When you get sleepy: Borbély's two-process model of sleep regulation.
 *
 * - Process S, the sleep pressure (the page's "tank"), rises while you are awake towards an
 *   upper asymptote μ with time constant χw, and drains while you sleep with time constant χs:
 *   awake S → μ − (μ − S)·e^(−dt/χw), asleep S → S·e^(−dt/χs).
 * - Process C, the body clock, is a 24-hour wave C(t) = sin(2π(t − α)/24). It sets two
 *   thresholds that rise and fall with it: an upper one, H⁺ = H₀⁺ + a·C, where sleep comes (S
 *   reaching it puts you to sleep), and a lower one, H⁻ = H₀⁻ + a·C, where you wake up (S falling
 *   to it ends sleep).
 *
 * Parameters: Skeldon, Dijk & Derks (2014), "Mathematical models for sleep-wake dynamics:
 * comparison of the two-process model and a mutual inhibition neuronal model", PLoS ONE 9(8):
 * e103877, Figure 1b (χw = 18.2 h, χs = 4.2 h, μ = 1, H₀⁺ = 0.60, H₀⁻ = 0.17, a = 0.10, a plain
 * sine for C), after Daan, Beersma & Borbély (1984), Am. J. Physiol. 246: R161–R178. Left alone,
 * they give a day of about 15½ hours awake and 8½ hours asleep. The clock's phase α is the
 * page's choice: it puts that free sleep at about 23:00 to 07:30. The clock never moves here; a
 * real one is shifted by light (the page says so).
 *
 * Times in hours from midnight of the first day shown; S, H⁺ and H⁻ are unitless (0 to 1).
 */

/** Time constant of the rise while awake, hours. */
export const RISE_H = 18.2;
/** Time constant of the drain while asleep, hours. */
export const DRAIN_H = 4.2;
/** Upper asymptote of S. */
export const MU = 1;
/** Mean of the upper (falling-asleep) threshold. */
export const UPPER = 0.6;
/** Mean of the lower (waking) threshold. */
export const LOWER = 0.17;
/** Amplitude of the clock's swing of both thresholds. */
export const AMP = 0.1;
/** Phase of the clock, hours: C = sin(2π(t − α)/24). Puts free sleep onset near 23:00. */
export const ALPHA = 11.4;

/** Simulation step, hours (five minutes). */
export const DT = 1 / 12;
/** The window the page shows: 06:00 on day one to noon on day four. */
export const START = 6;
export const END = 84;

/** The body clock, −1 to 1. */
export function clock(t: number): number {
	return Math.sin((2 * Math.PI * (t - ALPHA)) / 24);
}
/** The sleep line: when the tank reaches it, sleep comes. */
export function upper(t: number): number {
	return UPPER + AMP * clock(t);
}
/** The waking line: when the tank drains down to it, you wake up by yourself. */
export function lower(t: number): number {
	return LOWER + AMP * clock(t);
}

export interface Plan {
	/**
	 * 'bed': you go to bed at `bedtime` and an alarm wakes you at `wake` (you fall asleep in bed
	 * once the tank reaches the sleep line, and may wake earlier by yourself).
	 * 'free': no bedtime and no alarm: you sleep when the tank reaches the sleep line and wake
	 * when it drains to the waking line.
	 */
	mode: 'bed' | 'free';
	/** Hours after midnight, 18 to 27 (27 is 3 am). */
	bedtime: number;
	/** Hours after midnight, 4 to 12. */
	wake: number;
	/** Stay up all night through the night that starts on this day (1, 2 or 3). */
	skip?: number;
	/** A nap of this many minutes starting at `napAt` on day two. */
	napMinutes?: number;
	napAt?: number;
}

export const DEFAULT_PLAN: Plan = { mode: 'bed', bedtime: 22.5, wake: 7 };

export interface Sample {
	t: number;
	/** Sleep pressure. */
	s: number;
	asleep: boolean;
	inBed: boolean;
}

/** Days (1 = the first day shown) are counted from midnight; `t` may be negative in the warm-up. */
const dayOf = (t: number) => Math.floor(t / 24) + 1;

/** Whether the plan has you in bed at `t` (for 'bed' plans). */
function inBedAt(plan: Plan, t: number): boolean {
	// The night that started on `night` (its bedtime may be after midnight, on the next date).
	const b = plan.bedtime;
	for (const night of [dayOf(t) - 1, dayOf(t)]) {
		const from = (night - 1) * 24 + b;
		const to = night * 24 + plan.wake;
		if (t >= from && t < to) return night !== plan.skip;
	}
	return false;
}

function napping(plan: Plan, t: number): boolean {
	if (!plan.napMinutes) return false;
	const from = 24 + (plan.napAt ?? 14);
	return t >= from && t < from + plan.napMinutes / 60;
}

/** Days of the same plan, without its one-off nap or skipped night, run before the window. */
const WARMUP_DAYS = 6;

/** Runs the plan from a settled routine and returns the window START to END in DT steps. */
export function simulate(plan: Plan): Sample[] {
	const base: Plan = { mode: plan.mode, bedtime: plan.bedtime, wake: plan.wake };
	let s = 0.3;
	let asleep = false;
	const out: Sample[] = [];
	const n0 = Math.round((START - WARMUP_DAYS * 24) / DT);
	const n1 = Math.round(END / DT);
	for (let i = n0; i <= n1; i++) {
		const t = i * DT;
		const p = t < START ? base : plan;
		const bed = p.mode === 'bed' ? inBedAt(p, t) : true;
		const nap = napping(p, t);
		if (nap) asleep = true;
		else if (napping(p, t - DT)) asleep = false;
		else if (p.mode === 'bed' && !bed) asleep = false;
		else if (!asleep && s >= upper(t)) asleep = true;
		else if (asleep && s <= lower(t)) asleep = false;
		if (t >= START - 1e-9) out.push({ t, s, asleep, inBed: bed || nap });
		s = asleep ? s * Math.exp(-DT / DRAIN_H) : MU - (MU - s) * Math.exp(-DT / RISE_H);
	}
	return out;
}

/** The sample nearest `t`. */
export function at(series: readonly Sample[], t: number): Sample {
	const i = Math.round((t - START) / DT);
	return series[Math.max(0, Math.min(series.length - 1, i))];
}

/** How far the tank is above the sleep line (negative: below it). */
export function gap(x: Sample): number {
	return x.s - upper(x.t);
}

export type Feeling =
	| 'asleep'
	| 'wide awake'
	| 'awake'
	| 'a bit tired'
	| 'sleepy'
	| 'very sleepy'
	| 'can hardly keep your eyes open';

/** A word for how sleepy you feel at `x`: the gap between the tank and the sleep line. */
export function feeling(x: Sample): Feeling {
	if (x.asleep) return 'asleep';
	const g = gap(x);
	if (g < -0.3) return 'wide awake';
	if (g < -0.15) return 'awake';
	if (g < -0.04) return 'a bit tired';
	if (g < 0.08) return 'sleepy';
	if (g < 0.18) return 'very sleepy';
	return 'can hardly keep your eyes open';
}

export interface Night {
	/** When you got into bed (or, free, fell asleep), when you fell asleep, when you woke. */
	bed: number;
	onset: number;
	wake: number;
	/** The tank as you fell asleep and as you woke. */
	sAtOnset: number;
	sAtWake: number;
	/** Whether you woke by yourself rather than by the alarm. */
	natural: boolean;
}

/** The main sleeps of the window (sleeps over 3 hours), in order. */
export function nights(series: readonly Sample[], plan: Plan): Night[] {
	const out: Night[] = [];
	let i = 0;
	while (i < series.length) {
		if (!series[i].asleep) {
			i++;
			continue;
		}
		let j = i;
		while (j + 1 < series.length && series[j + 1].asleep) j++;
		const onset = series[i].t;
		const wakeT = series[j].t + DT;
		if (wakeT - onset >= 3 && i > 0 && j < series.length - 1) {
			let b = i;
			while (b > 0 && series[b - 1].inBed && !series[b - 1].asleep) b--;
			const after = series[j + 1];
			out.push({
				bed: plan.mode === 'bed' ? series[b].t : onset,
				onset,
				wake: wakeT,
				sAtOnset: series[i].s,
				sAtWake: after.s,
				natural: plan.mode === 'free' || after.inBed
			});
		}
		i = j + 1;
	}
	return out;
}

/** "23:05" for hours after midnight (any day). */
export function clockText(t: number): string {
	const m = Math.round((((t % 24) + 24) % 24) * 60) % (24 * 60);
	return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

// ---- one night, inside ----------------------------------------------------------------

/** About how long one round of light, deep and dreaming sleep takes, hours. */
export const CYCLE_H = 1.5;

export interface Round {
	from: number;
	to: number;
	/** Hours of deep sleep in this round. */
	deep: number;
	/** Hours of dreaming (REM) sleep at the round's end. */
	dream: number;
}

/**
 * A sketch of the rounds of one night (not part of the two-process model): rounds of about
 * ninety minutes from sleep onset. Deep sleep is where the pressure drains fastest (process S
 * was fitted to the slow waves of deep sleep), so each round's deep sleep is drawn in proportion
 * to how full the tank is at its start, over the waking line; dreaming sleep fills the rest of
 * the round's end and grows through the night, as in real recordings.
 */
export function rounds(series: readonly Sample[], night: Night): Round[] {
	const out: Round[] = [];
	const n = Math.max(1, Math.round((night.wake - night.onset) / CYCLE_H));
	const len = (night.wake - night.onset) / n;
	const first = at(series, night.onset).s - lower(night.onset);
	for (let k = 0; k < n; k++) {
		const from = night.onset + k * len;
		const fill = Math.max(0, (at(series, from).s - lower(from)) / Math.max(first, 1e-6));
		const deep = len * 0.45 * fill * fill;
		const dream = len * (0.12 + (0.3 * k) / Math.max(1, n - 1));
		out.push({ from, to: from + len, deep, dream });
	}
	return out;
}
