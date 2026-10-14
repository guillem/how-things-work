/**
 * Wireless signals: putting bits on a carrier, sending them through noise,
 * and the limits on how fast that can go.
 *
 * Modulation. A signal is drawn as s(t) = Re{b(t)·e^{j2πf_c t}}: a carrier at
 * f_c whose amplitude and phase are set, moment by moment, by the complex
 * "baseband" b(t). Changing |b| is amplitude modulation, the angle of b is the
 * phase, and a steadily turning angle is a shift in frequency. The drawn
 * carrier is slowed down to 5 MHz with symbols of about a microsecond, so that
 * a few cycles fit in each symbol; a real 2.4 GHz Wi-Fi carrier makes about
 * 10,000 cycles per 4 µs symbol. The physics of the spectrum is the same: it is
 * the spectrum of b(t), moved up to f_c.
 *
 * Spectra are measured, not drawn from formulas: a long stream of random bits
 * is modulated, sampled at 128 MHz and averaged over 8 Hann-windowed FFTs of
 * 8192 samples (Welch's method). The occupied bandwidth is the ITU-R
 * definition (Recommendation SM.328): the width that holds 99% of the power,
 * with 0.5% left out on each side.
 *
 * Noise. The receiver sees r = s + n, where n is additive white Gaussian noise:
 * complex, with variance N₀/2 in each of the two dimensions (I and Q). Every
 * constellation is scaled to an average symbol energy Es = 1, so the SNR here
 * is Es/N₀ per symbol. Symbols are sent at the rate the channel width allows
 * (ideal Nyquist pulses: symbol rate = bandwidth), so this is also the ratio of
 * signal power to noise power in the channel. The energy per bit is
 * Eb = Es / (bits per symbol). The receiver decides each symbol by the nearest
 * constellation point (hard decisions, no error-correcting code).
 *
 * Theory. BPSK: BER = Q(√(2Eb/N₀)). Gray-coded QPSK has the same BER at the
 * same Eb/N₀. Gray-coded square M-QAM: the exact expression of Cho & Yoon,
 * "On the general BER expression of one- and two-dimensional amplitude
 * modulations", IEEE Trans. Commun. 50 (7), 2002, eq. (14)–(16).
 *
 * Link. Free-space path loss (Friis): FSPL = 20·log₁₀(4πdf/c). It grows with
 * frequency only because an isotropic antenna for a shorter wavelength is
 * smaller and catches less of the passing power, not because the air absorbs
 * more. Thermal noise: kTB at T = 290 K, −174 dBm per hertz. The receiver is
 * taken as ideal (no noise of its own) and the antennas as isotropic (0 dBi).
 *
 * Capacity. Shannon (1948): C = B·log₂(1 + S/N) bits per second, for a
 * channel B hertz wide with additive white Gaussian noise.
 *
 * Wi-Fi. 2.4 GHz channel n is centred at 2407 + 5n MHz (n = 1–13; 14 is
 * 2484 MHz, Japan only) and a Wi-Fi signal is 20 MHz wide, so neighbouring
 * channel numbers overlap. Data rates from the OFDM parameters of IEEE
 * 802.11-2020: data subcarriers × bits per subcarrier × code rate ÷ symbol
 * time (4 µs, or 3.6 µs with the short guard interval).
 */

import { rng } from '#lib/draw/math.ts';

// ---- maths -----------------------------------------------------------------------------

/**
 * Complementary error function, Chebyshev fit of Numerical Recipes ("erfcc"):
 * fractional error below 1.2 × 10⁻⁷ everywhere.
 */
export function erfc(x: number) {
	const z = Math.abs(x);
	const t = 1 / (1 + 0.5 * z);
	const ans =
		t *
		Math.exp(
			-z * z -
				1.26551223 +
				t *
					(1.00002368 +
						t *
							(0.37409196 +
								t *
									(0.09678418 +
										t *
											(-0.18628806 +
												t *
													(0.27886807 +
														t *
															(-1.13520398 +
																t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
		);
	return x >= 0 ? ans : 2 - ans;
}

/** Gaussian tail probability Q(x) = P(N(0, 1) > x). */
export const Q = (x: number) => 0.5 * erfc(x / Math.SQRT2);

export const dbToLin = (db: number) => 10 ** (db / 10);
export const linToDb = (v: number) => 10 * Math.log10(v);

/** Standard normal random numbers (Box–Muller) from a seeded uniform generator. */
export function gaussian(seed: number) {
	const u = rng(seed);
	let spare: number | null = null;
	return () => {
		if (spare !== null) {
			const s = spare;
			spare = null;
			return s;
		}
		let a = u();
		while (a <= 1e-300) a = u();
		const r = Math.sqrt(-2 * Math.log(a));
		const th = 2 * Math.PI * u();
		spare = r * Math.sin(th);
		return r * Math.cos(th);
	};
}

/** In-place radix-2 FFT of a complex array (length a power of two). */
export function fft(re: Float64Array, im: Float64Array) {
	const n = re.length;
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}
	for (let len = 2; len <= n; len <<= 1) {
		const ang = (-2 * Math.PI) / len;
		const wr = Math.cos(ang);
		const wi = Math.sin(ang);
		for (let i = 0; i < n; i += len) {
			let cr = 1;
			let ci = 0;
			for (let k = 0; k < len / 2; k++) {
				const a = i + k;
				const b = a + len / 2;
				const xr = re[b] * cr - im[b] * ci;
				const xi = re[b] * ci + im[b] * cr;
				re[b] = re[a] - xr;
				im[b] = im[a] - xi;
				re[a] += xr;
				im[a] += xi;
				const nr = cr * wr - ci * wi;
				ci = cr * wi + ci * wr;
				cr = nr;
			}
		}
	}
}

// ---- modulation of a carrier ---------------------------------------------------------------

/** The drawn carrier frequency, MHz (time is in microseconds). */
export const FC = 5;
/** Tone used as the "voice" for the analogue AM and FM examples, MHz. */
export const TONE = 0.5;
/** AM modulation depth. */
export const AM_DEPTH = 0.6;
/** FM peak frequency deviation, MHz (modulation index β = 3). */
export const FM_DEV = 1.5;
/** FSK: the two tones are the carrier ± this, MHz. */
export const FSK_DEV = 1;
/** ASK: amplitude of a 0 bit (a 1 bit has amplitude 1). */
export const ASK_LOW = 0.25;
/** Roll-off of the raised-cosine pulses used to smooth the switches. */
export const ROLLOFF = 0.5;

export type Mode = 'carrier' | 'am' | 'fm' | 'ask' | 'fsk' | 'psk' | 'qpsk';

export const bitsPerSymbolOf = (mode: Mode) => (mode === 'qpsk' ? 2 : 1);
export const isDigital = (mode: Mode) =>
	mode === 'ask' || mode === 'fsk' || mode === 'psk' || mode === 'qpsk';

/** Bits of an ASCII text, most significant bit first. */
export const textBits = (text: string) =>
	[...text].flatMap((c) => {
		const v = c.charCodeAt(0);
		return Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
	});

/** Raised-cosine pulse (roll-off α) for symbol time 1, centred at 0. */
export function raisedCosine(t: number, alpha = ROLLOFF) {
	if (Math.abs(t) < 1e-9) return 1;
	const d = 1 - (2 * alpha * t) ** 2;
	const sinc = Math.sin(Math.PI * t) / (Math.PI * t);
	if (Math.abs(d) < 1e-9) return (Math.PI / 4) * sinc; // limit at t = ±1/(2α)
	return (sinc * Math.cos(Math.PI * alpha * t)) / d;
}

/** Complex amplitude of one symbol of a digital mode (FSK: the frequency offset ±1). */
function symbolsOf(mode: Mode, bits: readonly number[]) {
	const k = bitsPerSymbolOf(mode);
	const n = Math.floor(bits.length / k);
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	for (let s = 0; s < n; s++) {
		const b0 = bits[s * k];
		if (mode === 'ask') re[s] = b0 ? 1 : ASK_LOW;
		else if (mode === 'psk' || mode === 'fsk') re[s] = b0 ? 1 : -1;
		else {
			// QPSK, Gray-coded: first bit → I sign, second → Q sign (1 → +).
			re[s] = (b0 ? 1 : -1) * Math.SQRT1_2;
			im[s] = (bits[s * k + 1] ? 1 : -1) * Math.SQRT1_2;
		}
	}
	return { re, im };
}

export interface Synth {
	/** Sample rate, MHz (samples per µs). */
	fs: number;
	/** Complex baseband b(t). */
	re: Float64Array;
	im: Float64Array;
}

/**
 * Samples the complex baseband of a modulated carrier.
 * @param mode   modulation
 * @param bits   bits for the digital modes (repeated if `duration` needs more)
 * @param rate   symbol rate, millions of symbols per second
 * @param smooth raised-cosine pulses instead of instant switches
 * @param fs     sample rate, MHz
 * @param duration µs
 */
export function synth(
	mode: Mode,
	bits: readonly number[],
	rate: number,
	smooth: boolean,
	fs: number,
	duration: number
): Synth {
	const n = Math.round(fs * duration);
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	const dt = 1 / fs;
	if (mode === 'carrier') re.fill(1);
	else if (mode === 'am') {
		for (let i = 0; i < n; i++) re[i] = 1 + AM_DEPTH * Math.cos(2 * Math.PI * TONE * i * dt);
	} else if (mode === 'fm') {
		const beta = FM_DEV / TONE;
		for (let i = 0; i < n; i++) {
			const ph = beta * Math.sin(2 * Math.PI * TONE * i * dt);
			re[i] = Math.cos(ph);
			im[i] = Math.sin(ph);
		}
	} else {
		const T = 1 / rate;
		const k = bitsPerSymbolOf(mode);
		const nSym = Math.ceil(duration / T) + 1;
		const all = Array.from({ length: nSym * k }, (_, i) => bits[i % bits.length]);
		const sym = symbolsOf(mode, all);
		/** Pulse-shaped (or rectangular) symbol stream at time t. */
		const level = (arr: Float64Array, t: number) => {
			const u = t / T - 0.5; // symbol s is centred at (s + 0.5)·T
			if (!smooth) return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(t / T)))];
			const c = Math.round(u);
			let v = 0;
			for (let s = c - 6; s <= c + 6; s++) {
				// symbols before the start repeat the first one, so the stream starts steadily
				const a = arr[Math.min(arr.length - 1, Math.max(0, s))];
				v += a * raisedCosine(u - s);
			}
			return v;
		};
		if (mode === 'fsk') {
			let phase = 0;
			for (let i = 0; i < n; i++) {
				re[i] = Math.cos(phase);
				im[i] = Math.sin(phase);
				phase += 2 * Math.PI * FSK_DEV * level(sym.re, (i + 0.5) * dt) * dt;
			}
		} else {
			for (let i = 0; i < n; i++) {
				re[i] = level(sym.re, i * dt);
				im[i] = level(sym.im, i * dt);
			}
		}
	}
	return { fs, re, im };
}

/** Random bits from a seed. */
export function randomBits(n: number, seed: number) {
	const u = rng(seed);
	return Array.from({ length: n }, () => (u() < 0.5 ? 0 : 1));
}

export interface Spectrum {
	/** Frequency of each bin, MHz (absolute: carrier + offset), ascending. */
	freq: Float64Array;
	/** Power per bin, normalised to a total of 1. */
	power: Float64Array;
	/** 99% occupied bandwidth, MHz. */
	occupied: number;
	/** Lower and upper edges of the occupied band, MHz. */
	lo: number;
	hi: number;
}

const SPEC_FS = 128;
const SPEC_N = 8192;
const SPEC_SEGMENTS = 8;

/** Measured power spectrum of a modulated carrier (Welch's method, see the header). */
export function spectrum(mode: Mode, rate: number, smooth: boolean, seed = 7): Spectrum {
	const duration = (SPEC_N * SPEC_SEGMENTS) / SPEC_FS;
	const bits = randomBits(Math.ceil(duration * rate * 2) + 8, seed);
	const sig = synth(mode, bits, rate, smooth, SPEC_FS, duration);
	const acc = new Float64Array(SPEC_N);
	const re = new Float64Array(SPEC_N);
	const im = new Float64Array(SPEC_N);
	for (let s = 0; s < SPEC_SEGMENTS; s++) {
		for (let i = 0; i < SPEC_N; i++) {
			const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SPEC_N);
			re[i] = sig.re[s * SPEC_N + i] * w;
			im[i] = sig.im[s * SPEC_N + i] * w;
		}
		fft(re, im);
		for (let i = 0; i < SPEC_N; i++) acc[i] += re[i] * re[i] + im[i] * im[i];
	}
	// reorder: negative frequencies first
	const freq = new Float64Array(SPEC_N);
	const power = new Float64Array(SPEC_N);
	let total = 0;
	for (let i = 0; i < SPEC_N; i++) total += acc[i];
	for (let j = 0; j < SPEC_N; j++) {
		const i = (j + SPEC_N / 2) % SPEC_N;
		freq[j] = FC + ((j - SPEC_N / 2) * SPEC_FS) / SPEC_N;
		power[j] = acc[i] / total;
	}
	const df = SPEC_FS / SPEC_N;
	let cum = 0;
	let lo = freq[0];
	let hi = freq[SPEC_N - 1];
	let loFound = false;
	for (let j = 0; j < SPEC_N; j++) {
		const next = cum + power[j];
		if (!loFound && next >= 0.005) {
			lo = freq[j] - df / 2 + (df * (0.005 - cum)) / power[j];
			loFound = true;
		}
		if (next >= 0.995) {
			hi = freq[j] - df / 2 + (df * (0.995 - cum)) / power[j];
			break;
		}
		cum = next;
	}
	return { freq, power, occupied: hi - lo, lo, hi };
}

// ---- constellations and the noisy channel ----------------------------------------------------

export type Scheme = 'bpsk' | 'qpsk' | 'qam16' | 'qam64' | 'qam256';
export const SCHEMES: Scheme[] = ['bpsk', 'qpsk', 'qam16', 'qam64', 'qam256'];
export const schemeBits: Record<Scheme, number> = {
	bpsk: 1,
	qpsk: 2,
	qam16: 4,
	qam64: 6,
	qam256: 8
};
export const schemeName: Record<Scheme, string> = {
	bpsk: 'BPSK',
	qpsk: 'QPSK',
	qam16: '16-QAM',
	qam64: '64-QAM',
	qam256: '256-QAM'
};

const gray = (m: number) => m ^ (m >> 1);

interface Axis {
	/** Levels per axis. */
	L: number;
	/** Bits per axis. */
	k: number;
	/** Scale that makes the average symbol energy 1. */
	scale: number;
}
function axisOf(scheme: Scheme): Axis {
	const k = schemeBits[scheme];
	if (scheme === 'bpsk') return { L: 2, k: 1, scale: 1 };
	const L = 2 ** (k / 2);
	const M = L * L;
	return { L, k: k / 2, scale: 1 / Math.sqrt((2 * (M - 1)) / 3) };
}

export interface Point {
	i: number;
	q: number;
	/** The bits this point stands for, as a string ("0110"). */
	bits: string;
}

/** The constellation points of a scheme, Gray-coded, average energy 1. */
export function constellation(scheme: Scheme): Point[] {
	const ax = axisOf(scheme);
	const lvl = (m: number) => (2 * m - ax.L + 1) * ax.scale;
	const code = (m: number) => gray(m).toString(2).padStart(ax.k, '0');
	if (scheme === 'bpsk') return [0, 1].map((m) => ({ i: lvl(m), q: 0, bits: code(m) }));
	const out: Point[] = [];
	for (let mi = 0; mi < ax.L; mi++)
		for (let mq = 0; mq < ax.L; mq++)
			out.push({ i: lvl(mi), q: lvl(mq), bits: code(mi) + code(mq) });
	return out;
}

/** The bits of the constellation point nearest to (i, q): what a receiver reads there. */
export function decide(scheme: Scheme, i: number, q: number) {
	const ax = axisOf(scheme);
	const code = (m: number) => gray(m).toString(2).padStart(ax.k, '0');
	const bi = code(slice(i, ax));
	return scheme === 'bpsk' ? bi : bi + code(slice(q, ax));
}

/** Decision boundaries on one axis (between neighbouring levels). */
export function boundaries(scheme: Scheme) {
	const ax = axisOf(scheme);
	return Array.from({ length: ax.L - 1 }, (_, m) => (2 * m - ax.L + 2) * ax.scale);
}

/** Index of the level nearest to x on an axis. */
const slice = (x: number, ax: Axis) =>
	Math.min(ax.L - 1, Math.max(0, Math.round((x / ax.scale + ax.L - 1) / 2)));

const popcount = (v: number) => {
	let c = 0;
	for (; v; v &= v - 1) c++;
	return c;
};

/**
 * A neighbouring Wi-Fi transmitter. Wi-Fi is OFDM: dozens of independently
 * modulated subcarriers, so the part of its signal inside our channel reaches
 * our receiver as practically Gaussian noise. It is modelled as such.
 */
export interface Interferer {
	/** Its power inside our channel at the receiver, relative to our signal (linear). */
	power: number;
}

export interface Transmission {
	scheme: Scheme;
	n: number;
	/** Sent and received points, interleaved I, Q. */
	sent: Float32Array;
	received: Float32Array;
	/** 1 where the receiver picked the wrong point. */
	wrong: Uint8Array;
	bits: number;
	bitErrors: number;
	symbolErrors: number;
}

/**
 * Sends `n` random symbols through additive white Gaussian noise at the given
 * SNR (Es/N₀, dB), plus optionally a neighbouring transmitter (extra Gaussian
 * noise of the given relative power, see `Interferer`), and decides each one by
 * the nearest point.
 * `keep` false skips storing the points (for long BER measurements).
 */
export function transmit(
	scheme: Scheme,
	snrDb: number,
	n: number,
	seed: number,
	interferer?: Interferer,
	keep = true
): Transmission {
	const ax = axisOf(scheme);
	const u = rng(seed);
	const g = gaussian(seed ^ 0x5bd1e995);
	const sigma = Math.sqrt(1 / dbToLin(snrDb) / 2); // per dimension: N₀/2 with Es = 1
	// the neighbour's noise has its own generator, so the thermal noise is the same with or without it
	const gi = gaussian(seed ^ 0x27d4eb2f);
	const sigmaI = interferer ? Math.sqrt(interferer.power / 2) : 0;
	const sent = new Float32Array(keep ? 2 * n : 0);
	const received = new Float32Array(keep ? 2 * n : 0);
	const wrong = new Uint8Array(keep ? n : 0);
	const lvl = (m: number) => (2 * m - ax.L + 1) * ax.scale;
	let bitErrors = 0;
	let symbolErrors = 0;
	for (let s = 0; s < n; s++) {
		const mi = Math.floor(u() * ax.L);
		const mq = scheme === 'bpsk' ? 0 : Math.floor(u() * ax.L);
		const si = lvl(mi);
		const sq = scheme === 'bpsk' ? 0 : lvl(mq);
		let ri = si + sigma * g();
		let rq = sq + sigma * g();
		if (sigmaI > 0) {
			ri += sigmaI * gi();
			rq += sigmaI * gi();
		}
		const di = slice(ri, ax);
		let e = popcount(gray(di) ^ gray(mi));
		let bad = di !== mi;
		if (scheme !== 'bpsk') {
			const dq = slice(rq, ax);
			e += popcount(gray(dq) ^ gray(mq));
			bad ||= dq !== mq;
		}
		bitErrors += e;
		if (bad) symbolErrors++;
		if (keep) {
			sent[2 * s] = si;
			sent[2 * s + 1] = sq;
			received[2 * s] = ri;
			received[2 * s + 1] = rq;
			wrong[s] = bad ? 1 : 0;
		}
	}
	return {
		scheme,
		n,
		sent,
		received,
		wrong,
		bits: n * schemeBits[scheme],
		bitErrors,
		symbolErrors
	};
}

/** Measured bit-error rate over `nBits` bits (at least). */
export function measureBer(
	scheme: Scheme,
	snrDb: number,
	nBits: number,
	seed: number,
	interferer?: Interferer
) {
	const n = Math.ceil(nBits / schemeBits[scheme]);
	const tx = transmit(scheme, snrDb, n, seed, interferer, false);
	return { bits: tx.bits, errors: tx.bitErrors, ber: tx.bitErrors / tx.bits };
}

/**
 * Theoretical bit-error rate of a scheme at an SNR (Es/N₀, dB), Gray coding,
 * nearest-point decisions, white Gaussian noise. Exact (see the header).
 */
export function berTheory(scheme: Scheme, snrDb: number) {
	const es = dbToLin(snrDb);
	if (scheme === 'bpsk') return Q(Math.sqrt(2 * es));
	if (scheme === 'qpsk') return Q(Math.sqrt(es));
	const M = 2 ** schemeBits[scheme];
	const sqM = Math.sqrt(M);
	const half = Math.log2(sqM);
	const arg = Math.sqrt((3 * es) / (2 * (M - 1)));
	let total = 0;
	for (let k = 1; k <= half; k++) {
		let pk = 0;
		const top = (1 - 2 ** -k) * sqM - 1;
		for (let i = 0; i <= top; i++) {
			const x = (i * 2 ** (k - 1)) / sqM;
			pk += (-1) ** Math.floor(x) * (2 ** (k - 1) - Math.floor(x + 0.5)) * erfc((2 * i + 1) * arg);
		}
		total += pk / sqM;
	}
	return total / half;
}

/** SNR (Es/N₀, dB) at which a scheme's theoretical BER falls to `target`. */
export function snrForBer(scheme: Scheme, target: number) {
	let lo = -10;
	let hi = 60;
	for (let it = 0; it < 80; it++) {
		const mid = (lo + hi) / 2;
		if (berTheory(scheme, mid) > target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ---- capacity ---------------------------------------------------------------------------------

/** Shannon capacity, bits per second, of a channel `bandwidth` Hz wide at linear SNR. */
export const capacity = (bandwidth: number, snr: number) => bandwidth * Math.log2(1 + snr);

/** The lowest Eb/N₀ (linear) at which a spectral efficiency η (bits/s/Hz) is possible. */
export const minEbN0 = (eta: number) => (2 ** eta - 1) / eta;

// ---- the radio link ----------------------------------------------------------------------------

export const C = 299_792_458;
export const BOLTZMANN = 1.380649e-23;

/** Free-space path loss, dB, at distance d (m) and frequency f (Hz), isotropic antennas. */
export const fsplDb = (d: number, f: number) => 20 * Math.log10((4 * Math.PI * d * f) / C);

/** Thermal noise power kTB at 290 K, dBm, in a bandwidth of `b` Hz. */
export const noiseDbm = (b: number) => 10 * Math.log10(BOLTZMANN * 290 * b * 1000);

/** Maximum transmit power of 2.4 GHz Wi-Fi in Europe, dBm e.i.r.p. (ETSI EN 300 328 §4.3.2.2.3). */
export const TX_DBM = 20;

export interface Link {
	lossDb: number;
	rxDbm: number;
	noiseDbm: number;
	snrDb: number;
}

/** Link budget: power `txDbm` from an isotropic antenna, received `d` m away, `b` Hz wide. */
export function link(d: number, f: number, b: number, txDbm = TX_DBM): Link {
	const lossDb = fsplDb(d, f);
	const rx = txDbm - lossDb;
	const nz = noiseDbm(b);
	return { lossDb, rxDbm: rx, noiseDbm: nz, snrDb: rx - nz };
}

// ---- Wi-Fi --------------------------------------------------------------------------------------

/** Centre frequency of a 2.4 GHz Wi-Fi channel, MHz. */
export const channelMHz = (n: number) => (n === 14 ? 2484 : 2407 + 5 * n);

/**
 * Fraction of a `width`-MHz signal on channel a that falls inside one on
 * channel b, taking both as flat (rectangular) spectra. Real signals have
 * sloping skirts, so a little leaks even beyond this.
 */
export function overlap(a: number, b: number, width = 20) {
	return Math.max(0, width - Math.abs(channelMHz(a) - channelMHz(b))) / width;
}

/** Data subcarriers of an 802.11n/ac OFDM channel by width (MHz). */
export const DATA_SUBCARRIERS: Record<number, number> = { 20: 52, 40: 108, 80: 234, 160: 468 };

/** Wi-Fi (802.11n/ac) data rate, Mbit/s, for one spatial stream. */
export function wifiRate(
	width: number,
	bitsPerSubcarrier: number,
	codeRate: number,
	shortGi = false
) {
	const symbolUs = shortGi ? 3.6 : 4;
	return (DATA_SUBCARRIERS[width] * bitsPerSubcarrier * codeRate) / symbolUs;
}
