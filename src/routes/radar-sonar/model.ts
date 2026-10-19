/**
 * Model of the radar-sonar explainer: pulse-echo ranging, the radar equation, plain pulses
 * against a chirp and its matched filter, the Doppler shift across a train of pulses, a
 * range-Doppler map with ground clutter and noise, and the numbers that make sonar slow and
 * low-frequency (the speed of sound in seawater, the absorption of sound, the skin depth of
 * radio in seawater).
 *
 * The radar is notional: an X-band set at 10 GHz with 1 kW of peak power, a 35 dBi antenna and a
 * 3 dB noise figure, chosen for round numbers, not copied from a real system. Echoes are
 * simulated as complex baseband samples (the carrier removed, as a receiver does), with seeded
 * complex Gaussian noise, so every trace replays exactly.
 *
 * Sources: the radar range equation and matched filtering, M. I. Skolnik, Introduction to Radar
 * Systems (3rd ed., 2001), ch. 2 and 5; the speed of sound in seawater, K. V. Mackenzie, J.
 * Acoust. Soc. Am. 70, 807 (1981), whose stated check value is 1550.744 m/s at 25 °C, 35 ‰ and
 * 1000 m; sound absorption, W. H. Thorp, J. Acoust. Soc. Am. 42, 270 (1967); the conductivity
 * of seawater, about 4 S/m.
 */
import { rng } from '#lib/draw/math.ts';

/** Speed of light in vacuum (m/s), close enough in air. */
export const C = 299_792_458;
const K_BOLTZMANN = 1.380649e-23;
const MU0 = 4e-7 * Math.PI;

/** The notional radar. */
export const RADAR = {
	f0: 10e9,
	lambda: C / 10e9,
	peakPower: 1000,
	gainDb: 35,
	noiseFigureDb: 3,
	/** Pulses per second on the range-Doppler steps. */
	prf: 8000,
	/** Pulses in one look (coherent processing interval). */
	pulses: 32
};

const db = (x: number) => 10 * Math.log10(x);
const undb = (x: number) => Math.pow(10, x / 10);

/** Round-trip time of an echo from range `r` (m) at wave speed `c`. */
export const echoDelay = (r: number, c = C) => (2 * r) / c;
/** Range of an echo heard `t` seconds after the pulse left. */
export const rangeOf = (t: number, c = C) => (c * t) / 2;

/** Received echo power (W) from the radar equation: Pt G² λ² σ / ((4π)³ R⁴). */
export function echoPower(r: number, rcs: number, radar = RADAR) {
	const g = undb(radar.gainDb);
	return (radar.peakPower * g * g * radar.lambda ** 2 * rcs) / ((4 * Math.PI) ** 3 * r ** 4);
}

/** Noise power spectral density kTF (W/Hz) at 290 K. */
export const noiseDensity = (radar = RADAR) => K_BOLTZMANN * 290 * undb(radar.noiseFigureDb);

/** Signal-to-noise ratio (dB) after a matched filter: echo energy over noise density. */
export const snrDb = (r: number, rcs: number, duration: number, extraNoiseDb = 0) =>
	db((echoPower(r, rcs) * duration) / noiseDensity()) - extraNoiseDb;

/**
 * Radar cross-section (m²) of a square flat plate of side `a` seen `tiltDeg` off its normal, by
 * physical optics: 4πA²/λ² face on, then the sinc² pattern of the plate. Off the main lobe the
 * sidelobe envelope (1/x²) is used rather than the exact pattern, whose nulls are knife-edge.
 */
export function plateRcs(a: number, tiltDeg: number, lambda = RADAR.lambda) {
	const th = (tiltDeg * Math.PI) / 180;
	const peak = (4 * Math.PI * a ** 4) / lambda ** 2;
	const x = ((2 * Math.PI) / lambda) * a * Math.sin(th);
	const pattern = x === 0 ? 1 : Math.abs(x) < Math.PI ? (Math.sin(x) / x) ** 2 : 1 / (x * x);
	return peak * Math.cos(th) ** 2 * pattern;
}

// ------------------------------------------------------------------ waveforms

export type Waveform =
	{ kind: 'plain'; duration: number } | { kind: 'chirp'; duration: number; bandwidth: number };

/** Bandwidth (Hz) a waveform occupies: about 1/τ for a plain pulse, B for a chirp. */
export const bandwidthOf = (w: Waveform) => (w.kind === 'chirp' ? w.bandwidth : 1 / w.duration);

/** Complex envelope of the waveform at time `t` from its start (unit amplitude). */
export function envelope(w: Waveform, t: number): [number, number] {
	if (t < 0 || t >= w.duration) return [0, 0];
	if (w.kind === 'plain') return [1, 0];
	// linear frequency sweep from −B/2 to +B/2: phase π (B/T) (t − T/2)²
	const u = t - w.duration / 2;
	const ph = (Math.PI * w.bandwidth * u * u) / w.duration;
	return [Math.cos(ph), Math.sin(ph)];
}

export interface Target {
	/** Range (m). */
	r: number;
	/** Radar cross-section (m²). */
	rcs: number;
	/** Radial speed (m/s), positive when approaching. */
	v?: number;
	/**
	 * Phase of its echo (radians). A real target's is set by how its many reflecting parts add
	 * up, and changes with a millimetre of movement; here it is held fixed, so that dragging a
	 * target doesn't make two overlapping echoes flicker between adding and cancelling.
	 */
	phase?: number;
}

export interface Trace {
	/** Range of each output sample (m). */
	range: Float64Array;
	/** The raw echo's magnitude in dB above the noise of one sample. */
	raw: Float64Array;
	/** The matched filter's output in dB above its own noise floor. */
	out: Float64Array;
}

/**
 * One pulse's echo from `targets`, sampled at `fs` over ranges [r0, r1], with seeded receiver
 * noise (`extraNoiseDb` above thermal), and its matched filter: the correlation of what came
 * back with a copy of what was sent. Amplitudes follow the radar equation, so the output's peak
 * above its noise floor is the target's SNR.
 */
export function echo(
	w: Waveform,
	targets: readonly Target[],
	r0: number,
	r1: number,
	fs: number,
	{ seed = 1, extraNoiseDb = 0 } = {}
): Trace {
	const n = Math.round(((r1 - r0) * 2 * fs) / C) + 1;
	const ns = Math.max(1, Math.round(w.duration * fs));
	const m = n + ns; // received samples cover the window plus one pulse length
	const t0 = (2 * r0) / C;
	const noise = undb(extraNoiseDb);
	const rand = rng(seed);
	const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
	const re = new Float64Array(m);
	const im = new Float64Array(m);
	for (let i = 0; i < m; i++) {
		re[i] = gauss() * Math.sqrt(noise / 2);
		im[i] = gauss() * Math.sqrt(noise / 2);
	}
	// per-sample amplitude: received power over the noise in one sample's bandwidth (kTF·fs)
	const n0fs = noiseDensity() * fs;
	for (const tg of targets) {
		const a = Math.sqrt(echoPower(tg.r, tg.rcs) / n0fs);
		const ph = tg.phase ?? 0;
		const [cp, sp] = [Math.cos(ph), Math.sin(ph)];
		const td = (2 * tg.r) / C - t0;
		const i0 = Math.max(0, Math.floor(td * fs));
		const i1 = Math.min(m - 1, Math.ceil((td + w.duration) * fs));
		for (let i = i0; i <= i1; i++) {
			const [er, ei] = envelope(w, i / fs - td);
			re[i] += a * (er * cp - ei * sp);
			im[i] += a * (er * sp + ei * cp);
		}
	}
	const sr = new Float64Array(ns);
	const si = new Float64Array(ns);
	for (let k = 0; k < ns; k++) [sr[k], si[k]] = envelope(w, k / fs);
	const range = new Float64Array(n);
	const raw = new Float64Array(n);
	const out = new Float64Array(n);
	for (let j = 0; j < n; j++) {
		range[j] = r0 + (j * C) / (2 * fs);
		raw[j] = db(Math.max(1e-6, re[j] ** 2 + im[j] ** 2) / noise);
		let yr = 0;
		let yi = 0;
		for (let k = 0; k < ns; k++) {
			const xr = re[j + k];
			const xi = im[j + k];
			yr += xr * sr[k] + xi * si[k];
			yi += xi * sr[k] - xr * si[k];
		}
		// thermal noise floor of the output: ns samples of unit-variance noise
		out[j] = db(Math.max(1e-6, yr * yr + yi * yi) / ns);
	}
	return { range, raw, out };
}

/** Local maxima of `y` above `threshold`, at least `minGap` samples apart (strongest first). */
export function peaks(y: ArrayLike<number>, threshold: number, minGap = 1) {
	const found: number[] = [];
	for (let i = 1; i < y.length - 1; i++)
		if (y[i] > threshold && y[i] >= y[i - 1] && y[i] > y[i + 1]) found.push(i);
	found.sort((a, b) => y[b] - y[a]);
	const kept: number[] = [];
	for (const i of found) if (kept.every((k) => Math.abs(k - i) >= minGap)) kept.push(i);
	return kept.sort((a, b) => a - b);
}

/**
 * Number of separate echoes in a trace: peaks over `threshold` that stand `dip` dB above the
 * valley between them. With a `guard` (samples), a peak that close to one at least 6 dB
 * stronger is taken for that echo's range sidelobe, not a target of its own.
 */
export function countEchoes(y: ArrayLike<number>, threshold: number, dip = 3, guard = 0) {
	const all = peaks(y, threshold);
	const p = all.filter((i) => !all.some((j) => Math.abs(j - i) <= guard && y[j] - y[i] >= 6));
	if (p.length === 0) return 0;
	let count = 1;
	let last = p[0];
	for (let k = 1; k < p.length; k++) {
		let lo = Infinity;
		for (let i = last; i <= p[k]; i++) lo = Math.min(lo, y[i]);
		if (Math.min(y[last], y[p[k]]) - lo >= dip) {
			count++;
			last = p[k];
		} else if (y[p[k]] > y[last]) last = p[k];
	}
	return count;
}

// ------------------------------------------------------------------ Doppler

/** Doppler shift (Hz) of an echo from a target closing at radial speed `v`: 2v/λ. */
export const dopplerShift = (v: number, lambda = RADAR.lambda) => (2 * v) / lambda;

/** Radial speed (m/s) of a target moving at `speed` along a heading `headingDeg` off the line of sight. */
export const radialSpeed = (speed: number, headingDeg: number) =>
	speed * Math.cos((headingDeg * Math.PI) / 180);

/**
 * The echo's phase on each of `n` pulses of a train at `prf`, for a target at range `r` closing
 * at `v`: each pulse finds it v/prf nearer, which shortens the path by 2v/prf.
 */
export function slowTime(r: number, v: number, n = RADAR.pulses, prf = RADAR.prf) {
	const out: number[] = [];
	for (let k = 0; k < n; k++) out.push((4 * Math.PI * (v * (k / prf) - r)) / RADAR.lambda);
	return out;
}

/** |DFT|² of unit phasors with the given phases, at `bins` frequencies across ±prf/2. */
export function spectrum(phases: readonly number[], bins = phases.length, prf = RADAR.prf) {
	const out: number[] = [];
	for (let b = 0; b < bins; b++) {
		const f = -prf / 2 + (b * prf) / bins;
		let re = 0;
		let im = 0;
		for (let k = 0; k < phases.length; k++) {
			const ph = phases[k] - (2 * Math.PI * f * k) / prf;
			re += Math.cos(ph);
			im += Math.sin(ph);
		}
		out.push((re * re + im * im) / phases.length ** 2);
	}
	return out;
}

/** Fastest radial speed a pulse train at `prf` measures without wrapping round: λ·prf/4. */
export const maxSpeed = (prf = RADAR.prf, lambda = RADAR.lambda) => (lambda * prf) / 4;

// ------------------------------------------------------------------ range-Doppler map

export interface RangeDopplerMap {
	/** Range cells (m, centres) and Doppler bins (radial speed, m/s, approaching positive). */
	ranges: number[];
	speeds: number[];
	/** Power in dB above the noise floor, `cells[rangeIndex][speedIndex]`. */
	cells: number[][];
	/** One pulse on its own, before the Fourier transform: dB above the noise, per range cell. */
	pulse: number[];
}

const HANN = Array.from(
	{ length: RADAR.pulses },
	(_, k) => 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / RADAR.pulses)
);
const HANN_POWER = HANN.reduce((a, w) => a + w * w, 0);

/** The map's range cells: 75 cells of 200 m from 0 to 15 km. */
export const MAP_CELL = 200;
export const MAP_CELLS = 75;

/**
 * A range-Doppler map: each of `RADAR.pulses` pulses is compressed in range (cells of
 * `MAP_CELL`, the resolution of a chirp of bandwidth c/(2·cell)), then each range cell's samples
 * across the pulses are Fourier-transformed, so each column is a radial speed. The chirp's
 * duration sets the energy. Ground clutter (stationary scatterers at every range with a little
 * wind-blown spread) and noise are seeded.
 */
export function rangeDoppler(
	targets: readonly Target[],
	{ duration = 1e-6, extraNoiseDb = 0, clutter = true, seed = 7 } = {}
): RangeDopplerMap {
	const n = RADAR.pulses;
	const prf = RADAR.prf;
	const rand = rng(seed);
	const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
	const noise = undb(extraNoiseDb);
	const ranges = Array.from({ length: MAP_CELLS }, (_, i) => (i + 0.5) * MAP_CELL);
	const speeds = Array.from(
		{ length: n },
		(_, b) => ((-prf / 2 + (b * prf) / n) * RADAR.lambda) / 2
	);
	// per-pulse compressed amplitude, scaled so a cell's unit-variance noise is the floor
	const amp = (r: number, rcs: number) => Math.sqrt(undb(snrDb(r, rcs, duration)));
	const cells: number[][] = [];
	const pulse: number[] = [];
	for (let i = 0; i < MAP_CELLS; i++) {
		const re = new Float64Array(n);
		const im = new Float64Array(n);
		for (let k = 0; k < n; k++) {
			re[k] = gauss() * Math.sqrt(noise / 2);
			im[k] = gauss() * Math.sqrt(noise / 2);
		}
		const add = (a: number, phases: readonly number[]) => {
			for (let k = 0; k < n; k++) {
				re[k] += a * Math.cos(phases[k]);
				im[k] += a * Math.sin(phases[k]);
			}
		};
		if (clutter && ranges[i] > 300) {
			// ground clutter: the patch lit grows with range, so its echo falls as R⁻³; Rayleigh
			// strength from cell to cell and a little wind-blown spread
			const rcs = 3e-4 * ranges[i] * -Math.log(1 - rand());
			const drift = gauss() * 0.4; // m/s of sway
			add(amp(ranges[i], rcs), slowTime(ranges[i] + rand() * 50, drift, n, prf));
		}
		for (const tg of targets) {
			// the compressed pulse's main lobe, one cell wide: a target between two cells' centres
			// shows in both (its tapered sidelobes are left out)
			const w = 1 - Math.abs(tg.r - ranges[i]) / MAP_CELL;
			if (w <= 0) continue;
			add(amp(tg.r, tg.rcs) * w, slowTime(tg.r, tg.v ?? 0, n, prf));
		}
		pulse.push(db(Math.max(1e-6, (re[0] ** 2 + im[0] ** 2) / noise)) + extraNoiseDb);
		// DFT across the pulses with a Hann window (so strong clutter doesn't leak into every
		// speed); the scale keeps the noise floor at 0 dB
		const row: number[] = [];
		for (let b = 0; b < n; b++) {
			const f = -prf / 2 + (b * prf) / n;
			let yr = 0;
			let yi = 0;
			for (let k = 0; k < n; k++) {
				const ph = (-2 * Math.PI * f * k) / prf;
				const w = HANN[k];
				const [c, s] = [w * Math.cos(ph), w * Math.sin(ph)];
				yr += re[k] * c - im[k] * s;
				yi += re[k] * s + im[k] * c;
			}
			row.push(db(Math.max(1e-6, (yr * yr + yi * yi) / HANN_POWER)));
		}
		cells.push(row);
	}
	return { ranges, speeds, cells, pulse };
}

/** Cells above `threshold` dB, skipping the slow speeds where clutter sits (|v| < notch). */
export function detections(map: RangeDopplerMap, threshold: number, notch = 5) {
	const hits: { r: number; v: number; db: number }[] = [];
	map.cells.forEach((row, i) =>
		row.forEach((p, b) => {
			const v = map.speeds[b];
			if (Math.abs(v) < notch || p < threshold) return;
			const up = i > 0 ? map.cells[i - 1][b] : -Infinity;
			const dn = i < map.cells.length - 1 ? map.cells[i + 1][b] : -Infinity;
			const lt = row[(b + row.length - 1) % row.length];
			const rt = row[(b + 1) % row.length];
			if (p >= up && p >= dn && p >= lt && p >= rt) hits.push({ r: map.ranges[i], v, db: p });
		})
	);
	return hits;
}

// ------------------------------------------------------------------ water

/**
 * Speed of sound in seawater (m/s), Mackenzie (1981): temperature T (°C), salinity S (‰) and
 * depth D (m). Valid for 2–30 °C, 25–40 ‰ and 0–8000 m.
 */
export function soundSpeed(T: number, S = 35, D = 0) {
	return (
		1448.96 +
		4.591 * T -
		5.304e-2 * T * T +
		2.374e-4 * T ** 3 +
		1.34 * (S - 35) +
		1.63e-2 * D +
		1.675e-7 * D * D -
		1.025e-2 * T * (S - 35) -
		7.139e-13 * T * D ** 3
	);
}

/** Absorption of sound in seawater (dB/km) at frequency `f` (Hz), Thorp (1967). */
export function soundAbsorption(f: number) {
	const k = (f / 1000) ** 2; // f in kHz, squared
	return (0.11 * k) / (1 + k) + (44 * k) / (4100 + k) + 2.75e-4 * k + 0.003;
}

/** Skin depth (m) of radio waves of frequency `f` in seawater of conductivity σ (good conductor). */
export const skinDepth = (f: number, sigma = 4) => 1 / Math.sqrt(Math.PI * f * MU0 * sigma);
