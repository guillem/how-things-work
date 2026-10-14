/**
 * The power-grid model: how the frequency of an AC grid answers an imbalance between
 * generation and demand (the swing equation, with primary and secondary control and
 * under-frequency load shedding), one real day of Spanish demand and generation, and the
 * losses of a transmission line.
 *
 * References:
 * - ENTSO-E rules for the synchronous area of Continental Europe (CE), from Commission
 *   Regulation (EU) 2017/1485 (System Operation Guideline, SOGL), Annex III and Art. 154:
 *   nominal 50 Hz; standard frequency range ±50 mHz; maximum instantaneous deviation 800 mHz;
 *   maximum steady-state deviation 200 mHz; reference incident 3 000 MW; FCR fully activated
 *   at a deviation of 200 mHz, at least half of it within 15 s and all of it within 30 s;
 *   frequency restored within 15 minutes.
 * - Commission Regulation (EU) 2017/2196 (Emergency and Restoration code), Annex: automatic
 *   under-frequency load shedding in CE starts at 49.0 Hz and ends at 48.0 Hz, removing 45 %
 *   of the load in at least 6 steps, none over 10 %.
 * - Commission Regulation (EU) 2016/631 (Requirements for Generators, RfG): limited
 *   frequency-sensitive mode for over-frequency (LFSM-O) from 50.2 Hz, droop 2–12 % (5 %
 *   here).
 * - ENTSO-E Operation Handbook, Policy 1: self-regulation of load 1 %/Hz.
 * - P. Kundur, Power System Stability and Control (1994), Table 3.2: inertia constants H of
 *   thermal units 2.5–10 s, hydro units 2–4 s.
 */
import { DAY, type Hour } from './day';

// ---------------------------------------------------------------- frequency, rules

/** Nominal frequency, Hz. */
export const F0 = 50;
/** Deviation at which primary reserve (FCR) is fully used, and the operating band, Hz. */
export const BAND = 0.2;
/** Self-regulation of load: demand falls 1 % for each hertz the frequency falls. */
export const LOAD_DAMPING = 0.01;
/** First-order lag of the primary response (governors and turbines), s: half of it is in
 * within 4.2 s and 99 % within 28 s, inside the 15 s and 30 s that the CE rules ask for. */
export const FCR_LAG = 6;
/** LFSM-O: above 50.2 Hz every generator turns down along a 5 % droop. */
export const LFSM_O = { from: 0.2, droop: 0.05 };
/** Under-frequency load shedding: six steps of 7.5 % of the load (45 % in all). */
export const UFLS_STEPS = [49.0, 48.8, 48.6, 48.4, 48.2, 48.0];
export const UFLS_SHARE = 0.075;
/** Generators may disconnect to protect themselves above this frequency, Hz. */
export const OVER_TRIP = 51.5;

/** Continental Europe, the synchronous area Spain belongs to. */
export const CE = {
	/** Demand at the moment of the trip, MW (an average hour, ~2 800 TWh a year). */
	load: 300_000,
	/** Reference incident: the largest loss the area is designed for, MW. */
	reference: 3000,
	/** Primary reserve (FCR), MW: equal to the reference incident. */
	fcr: 3000,
	/** Secondary reserve (aFRR) available to replace the lost plant, MW. */
	afrr: 6000,
	/** Integral time of the secondary controller, s. */
	afrrTime: 90,
	/** Inertia constant of the spinning (synchronous) generators, s, on their output. */
	H: 5
};

export interface TripInput {
	/** Generation lost at t = 1 s, MW (negative: demand lost instead). */
	lost: number;
	/** Demand, MW. */
	load?: number;
	/** Share of the demand supplied by solar and wind (inverters, no spinning mass). */
	inverterShare?: number;
	/** Inertia constant of the spinning generators, s. */
	H?: number;
	fcr?: boolean;
	afrr?: boolean;
	ufls?: boolean;
	/** Over-frequency response of all generators (LFSM-O). */
	lfsmo?: boolean;
	/** Simulated time, s. */
	duration?: number;
}

export interface TripSample {
	t: number;
	/** Frequency, Hz. */
	f: number;
	/** Primary reserve delivered, MW. */
	fcr: number;
	/** Secondary reserve delivered, MW. */
	afrr: number;
	/** Demand shed by UFLS, MW. */
	shed: number;
	/** Demand that disappeared with the frequency (self-regulation), MW. */
	damping: number;
	/** Power drawn from the spinning mass (positive when it slows), MW. */
	inertia: number;
}

export interface TripResult {
	samples: TripSample[];
	/** Kinetic energy stored in the spinning machines, MW·s. */
	kinetic: number;
	/** Initial rate of change of frequency, Hz/s (negative when generation is lost). */
	rocof: number;
	nadir: number;
	nadirAt: number;
	zenith: number;
	/** Frequency at the end of the run. */
	final: number;
	/** UFLS steps that tripped. */
	steps: number;
	/** When the frequency fell below 47.5 Hz and the generators disconnected, s (or null). */
	blackoutAt: number | null;
}

/** Below this frequency generators disconnect to protect themselves (RfG), Hz. */
export const UNDER_TRIP = 47.5;

/** Kinetic energy of the spinning generators, MW·s: H times their output. */
export function kineticEnergy(load: number, inverterShare: number, H = CE.H): number {
	return H * load * (1 - inverterShare);
}

/** Initial rate of change of frequency after losing `lost` MW, Hz/s (the swing equation). */
export function rocof(lost: number, kinetic: number): number {
	return (-F0 * lost) / (2 * kinetic);
}

/**
 * The frequency of a grid after it suddenly loses `lost` MW of generation, integrated with
 * the swing equation, (2 E / f₀) df/dt = P_generated − P_demanded, where E is the kinetic
 * energy of every machine spinning in step with the grid.
 */
export function trip(input: TripInput): TripResult {
	const L = input.load ?? CE.load;
	const share = input.inverterShare ?? 0.3;
	const E = kineticEnergy(L, share, input.H ?? CE.H);
	const sync = L * (1 - share);
	const R = CE.fcr * (L / CE.load);
	const lambda = R / BAND + LOAD_DAMPING * L;
	const { lost, duration = 60 } = input;
	const fcrOn = input.fcr ?? true;
	const afrrOn = input.afrr ?? false;
	const uflsOn = input.ufls ?? true;
	const lfsmoOn = input.lfsmo ?? true;
	const dt = 0.01;
	const every = Math.max(1, Math.round(duration / 600 / dt));
	let df = 0;
	let pFcr = 0;
	let pO = 0;
	let pA = 0;
	let shed = 0;
	let steps = 0;
	let nadir = F0;
	let nadirAt = 0;
	let zenith = F0;
	let blackoutAt: number | null = null;
	const samples: TripSample[] = [];
	const n = Math.round(duration / dt);
	for (let i = 0; i <= n; i++) {
		const t = i * dt;
		const out = t >= 1 ? lost : 0;
		const damping = -LOAD_DAMPING * (L - shed) * df;
		const imbalance = -out + pFcr + pO + pA + shed + damping;
		if (i % every === 0) {
			samples.push({ t, f: F0 + df, fcr: pFcr + pO, afrr: pA, shed, damping, inertia: -imbalance });
		}
		if (i === n) break;
		// the controls, each lagging behind the frequency it measures
		const fcrTarget = fcrOn ? -Math.max(-1, Math.min(1, df / BAND)) * R : 0;
		pFcr += ((fcrTarget - pFcr) * dt) / FCR_LAG;
		const oTarget =
			lfsmoOn && df > LFSM_O.from ? (-(df - LFSM_O.from) / (LFSM_O.droop * F0)) * sync : 0;
		pO += ((oTarget - pO) * dt) / FCR_LAG;
		if (afrrOn) {
			pA += ((-lambda * df) / CE.afrrTime) * dt;
			const cap = CE.afrr * (L / CE.load);
			pA = Math.max(-cap, Math.min(cap, pA));
		}
		if (uflsOn) {
			while (steps < UFLS_STEPS.length && F0 + df <= UFLS_STEPS[steps]) {
				shed += UFLS_SHARE * L;
				steps++;
			}
		}
		df += (F0 / (2 * E)) * imbalance * dt;
		if (F0 + df < nadir) {
			nadir = F0 + df;
			nadirAt = t;
		}
		zenith = Math.max(zenith, F0 + df);
		if (F0 + df < UNDER_TRIP) {
			blackoutAt = t;
			samples.push({ t, f: F0 + df, fcr: pFcr, afrr: pA, shed, damping, inertia: -imbalance });
			break;
		}
	}
	return {
		samples,
		kinetic: E,
		rocof: rocof(lost, E),
		nadir,
		nadirAt,
		zenith,
		final: F0 + df,
		steps,
		blackoutAt
	};
}

/** Where the frequency settles with primary control alone: Δf = −ΔP / λ (Hz). */
export function settledDeviation(lost: number, load = CE.load): number {
	const R = CE.fcr * (load / CE.load);
	return -lost / (R / BAND + LOAD_DAMPING * load);
}

// ---------------------------------------------------------------- the day

export type Source = Exclude<keyof Hour, 'hour'>;

/** Linear interpolation of the hourly means (each placed at the middle of its hour). */
export function at(hour: number, key: Source): number {
	const x = Math.max(0.5, Math.min(23.5, hour)) - 0.5;
	const i = Math.min(22, Math.floor(x));
	const u = x - i;
	return DAY[i][key] * (1 - u) + DAY[i + 1][key] * u;
}

/** Demand, MW, at a time of day (hours, 0–24). */
export const demandAt = (hour: number) => at(hour, 'demand');

/** The sources nobody dispatches in the game: they run as they did on the day. */
export const FIXED: Source[] = ['nuclear', 'coal', 'wind', 'solarPV', 'solarThermal', 'other'];

/** Peak and lowest hour of the day's demand. */
export function demandExtremes() {
	let max = DAY[0];
	let min = DAY[0];
	for (const h of DAY) {
		if (h.demand > max.demand) max = h;
		if (h.demand < min.demand) min = h;
	}
	return { max, min };
}

/** Energy over the day, MWh. */
export function dailyEnergy(key: Source): number {
	return DAY.reduce((s, h) => s + h[key], 0);
}

/** Plants with spinning generators locked to the grid (solar PV and wind feed it through
 * inverters), and their inertia constants H (s, on their output). Pumping motors spin too. */
export const SPINNING: Partial<Record<Source, number>> = {
	nuclear: 5,
	coal: 5,
	gas: 5,
	solarThermal: 5,
	other: 3,
	hydro: 3,
	pumping: -3
};

/** Kinetic energy of the machines spinning in step with the grid at an hour of the day, MW·s. */
export function dayKinetic(hour: number): number {
	let e = 0;
	for (const [k, H] of Object.entries(SPINNING)) e += H * at(hour, k as Source);
	return e;
}

/** Share of the demand met by solar PV and wind at an hour of the day. */
export const inverterShareAt = (hour: number) =>
	(at(hour, 'solarPV') + at(hour, 'wind')) / demandAt(hour);

// ---------------------------------------------------------------- the island game
//
// The game treats the mainland as if its links abroad carried exactly the scheduled flows
// (the day's real exchanges), so any imbalance stays at home and shows up in its own
// frequency, as on an island. Nuclear, coal, wind, solar and cogeneration run as they did on
// the day; the reader dispatches gas, hydro and storage. One simulated hour passes in a few
// seconds, so the governors settle "instantly": the frequency is the one primary control
// holds (`island`), and only the reader — or the autopilot — plays the secondary control.

/** Seconds of animation per simulated hour in the game. */
export const SECONDS_PER_HOUR = 6;

export interface Dispatch {
	gas: number;
	hydro: number;
	/** Pumped storage and batteries: negative while charging, MW. */
	storage: number;
}

/** What the plants really did at an hour of the day. */
export const realDispatch = (hour: number): Dispatch => ({
	gas: at(hour, 'gas'),
	hydro: at(hour, 'hydro'),
	storage: at(hour, 'pumping')
});

/** A passing cloud shades a quarter of the country's solar farms, cutting their output by
 * about 70 %: 17.5 % of all solar PV, faded in and out over 15 minutes, for an hour. */
export const CLOUD = { depth: 0.175, ramp: 0.25, hold: 0.5 };
export function cloudShade(sinceHours: number): number {
	const { depth, ramp, hold } = CLOUD;
	if (sinceHours < 0) return 0;
	const u =
		sinceHours < ramp
			? sinceHours / ramp
			: sinceHours < ramp + hold
				? 1
				: Math.max(0, 1 - (sinceHours - ramp - hold) / ramp);
	return depth * u;
}

export interface GridState {
	hour: number;
	demand: number;
	/** Output of each source, MW (exchange: net imports; storage: negative while charging). */
	sources: Record<
		| 'nuclear'
		| 'coal'
		| 'wind'
		| 'solarPV'
		| 'solarThermal'
		| 'other'
		| 'exchange'
		| 'gas'
		| 'hydro'
		| 'storage',
		number
	>;
	supply: number;
	/** Generation minus demand, MW. */
	surplus: number;
	grid: Island;
}

export interface Events {
	/** Hour at which the largest unit tripped, or null. */
	trip?: number | null;
	/** Hour at which the cloud arrived, or null. */
	cloud?: number | null;
}

/** The island at an hour with a given dispatch and events. */
export function gridAt(hour: number, d: Dispatch, ev: Events = {}): GridState {
	const shade = ev.cloud == null ? 0 : cloudShade(hour - ev.cloud);
	const tripped = ev.trip != null && hour >= ev.trip ? LARGEST_UNIT : 0;
	const sources = {
		nuclear: at(hour, 'nuclear') - tripped,
		coal: at(hour, 'coal'),
		wind: at(hour, 'wind'),
		solarPV: at(hour, 'solarPV') * (1 - shade),
		solarThermal: at(hour, 'solarThermal'),
		other: at(hour, 'other') + unlisted(hour),
		exchange: at(hour, 'exchange'),
		gas: d.gas,
		hydro: d.hydro,
		storage: d.storage
	};
	const supply = Object.values(sources).reduce((a, b) => a + b, 0);
	const demand = demandAt(hour);
	const sync =
		sources.nuclear +
		sources.coal +
		sources.gas +
		sources.solarThermal +
		sources.other +
		sources.hydro;
	return {
		hour,
		demand,
		sources,
		supply,
		surplus: supply - demand,
		grid: island(supply - demand, demand, sync)
	};
}

/** Every source in the day's data that adds to the supply. */
const LISTED: Source[] = [
	'nuclear',
	'gas',
	'coal',
	'hydro',
	'pumping',
	'wind',
	'solarPV',
	'solarThermal',
	'other',
	'exchange'
];

/**
 * Demand that the listed sources do not cover in REE's provisional real-time data (53–378 MW
 * in the hourly means). The game counts it as part of "other", so the real schedule balances.
 */
export function unlisted(hour: number): number {
	return demandAt(hour) - LISTED.reduce((s, k) => s + at(hour, k), 0);
}

/** The operator's answer to a trip or a cloud: reserves called up over a few minutes. */
export const OPERATOR_LAG = 5 / 60;

/**
 * The autopilot: the real schedule, plus gas called up to replace what a trip or a cloud
 * took away, with a lag of a few minutes (`OPERATOR_LAG`, in hours).
 */
export function autopilot(hour: number, ev: Events = {}): Dispatch {
	const d = realDispatch(hour);
	let missing = 0;
	const lagged = (since: number) => 1 - Math.exp(-since / OPERATOR_LAG);
	if (ev.trip != null && hour >= ev.trip) missing += LARGEST_UNIT * lagged(hour - ev.trip);
	if (ev.cloud != null && hour >= ev.cloud) {
		// the cloud's shadow seen through the same lag: the convolution of the lost solar
		// power with an exponential of time constant OPERATOR_LAG, summed over 6 time constants
		const N = 24;
		let lost = 0;
		for (let k = 0; k < N; k++) {
			const s = hour - ev.cloud - ((k + 0.5) * (OPERATOR_LAG * 6)) / N;
			lost += (cloudShade(s) * at(hour, 'solarPV') * Math.exp(-((k + 0.5) * 6) / N) * 6) / N;
		}
		missing += lost;
	}
	return { ...d, gas: d.gas + missing };
}

/** Primary reserve of the island in the game, MW: the size of its largest plant. */
export const ISLAND_FCR = 1000;
/** The largest plant: one nuclear reactor, MW. */
export const LARGEST_UNIT = 1000;

export interface Island {
	/** Frequency, Hz, once the governors have settled (seconds after any change). */
	f: number;
	/** Primary reserve in use, MW (positive: generating more). */
	fcr: number;
	/** Demand cut off by load shedding, MW. */
	shed: number;
	/** Generation turned down by LFSM-O, MW. */
	turnedDown: number;
}

/**
 * The island's frequency a few seconds after the balance changes, with primary control
 * alone (no secondary control: in the game, that is the reader). It solves
 * ΔP + FCR(Δf) + LFSM-O(Δf) − D·L·Δf = 0, with the shedding steps that this frequency
 * triggers. `surplus` is generation minus demand, MW.
 */
export function island(surplus: number, load: number, sync = load): Island {
	const R = ISLAND_FCR;
	const balance = (df: number, shed: number) => {
		const fcr = -Math.max(-1, Math.min(1, df / BAND)) * R;
		const down = df > LFSM_O.from ? ((df - LFSM_O.from) / (LFSM_O.droop * F0)) * sync : 0;
		return { net: surplus + shed + fcr - down - LOAD_DAMPING * (load - shed) * df, fcr, down };
	};
	const solve = (shed: number) => {
		let lo = -5;
		let hi = 5;
		for (let k = 0; k < 60; k++) {
			const mid = (lo + hi) / 2;
			if (balance(mid, shed).net > 0) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	};
	let shed = 0;
	let df = solve(0);
	for (let s = 0; s < UFLS_STEPS.length && F0 + df <= UFLS_STEPS[s]; s++) {
		shed += UFLS_SHARE * load;
		df = solve(shed);
	}
	const b = balance(df, shed);
	return { f: F0 + df, fcr: b.fcr, shed, turnedDown: b.down };
}

// ---------------------------------------------------------------- transmission

/** Resistivity of aluminium at 20 °C, Ω·m. */
export const RHO_AL = 2.82e-8;
/** Aluminium in each phase of the line: three conductors of 500 mm², m². */
export const PHASE_AREA = 3 * 500e-6;
/** Resistance of each phase, Ω per km. */
export const R_PER_KM = (RHO_AL / PHASE_AREA) * 1000;
/** Roughly the most current these conductors carry before they overheat, A. */
export const AMPACITY = 3000;

export interface Line {
	/** Current in each of the three phases, A. */
	current: number;
	/** Power turned into heat in the wires, MW. */
	loss: number;
	/** Fraction of the power sent that is lost. */
	share: number;
	/** The line cannot do it: it would lose most of the power, and the voltage collapse. */
	impossible: boolean;
	overheated: boolean;
}

/**
 * A three-phase line sending `mw` at `kv` (line-to-line) over `km`: I = P / (√3 V),
 * loss = 3 I² R. Resistive losses only (the line's inductance and capacitance are ignored).
 */
export function line(mw: number, kv: number, km: number): Line {
	const current = (mw * 1e6) / (Math.sqrt(3) * kv * 1e3);
	const loss = (3 * current ** 2 * R_PER_KM * km) / 1e6;
	const share = loss / mw;
	return {
		current,
		loss,
		share,
		impossible: share > 0.5,
		overheated: current > AMPACITY
	};
}

/** The voltages power passes through from a power station to a socket (Spain), kV. */
export const VOLTAGES = [
	{ kv: 20, where: 'generator' },
	{ kv: 400, where: 'transmission' },
	{ kv: 132, where: 'sub-transmission' },
	{ kv: 20, where: 'distribution' },
	{ kv: 0.4, where: 'street (230 V to each home)' }
];
