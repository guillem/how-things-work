/**
 * The model behind the Shazam explainer: Avery Wang's audio search algorithm (Wang 2003, "An
 * Industrial-Strength Audio Search Algorithm", ISMIR 2003) at toy scale, on clips synthesized
 * here (no recordings are shipped or used).
 *
 *   1. synthesize a dozen short tunes (melody, bass and a picked accompaniment, each with its
 *      own tempo, key and instrument) as 8 kHz mono samples, the rate Wang's tests used (§3.1);
 *   2. a short-time Fourier transform: 512-sample Hann windows (64 ms) every 256 samples
 *      (32 ms), 256 frequency bins of 15.6 Hz from 0 to 4 kHz;
 *   3. spectrogram peaks: a point louder than every neighbour in a box around it, kept only if
 *      it is among the loudest few near it in time (Wang's density criterion, §2.1), so the
 *      constellation covers the clip evenly;
 *   4. combinatorial hashes (§2.2): every peak is an anchor, paired with the first F = 10 peaks
 *      of a target zone just after it; the hash packs the two frequency bins (8 bits each) and
 *      the gap in frames (6 bits) into one 22-bit number, stored with the anchor's time and the
 *      clip's number;
 *   5. search and scoring (§2.3): every hash of a recording is looked up; each hit gives a time
 *      pair (time in the recording, time in the clip) and the difference δt = t_clip − t_rec;
 *      a histogram of δt per clip, and the score is the number of time pairs in its tallest
 *      bin and the two next to it (a 32 ms tolerance either way).
 *
 * The verdict (MIN_SCORE, MIN_RATIO) is this page's own rule, set from the scores the wrong
 * clips reach here; Wang (§2.3.1) sets the threshold from the distribution of wrong-track
 * scores and an acceptable false-positive rate.
 *
 * Everything is deterministic: the tunes and the recording's noise come from seeded generators.
 */
import { rng } from '#lib/draw/math.ts';

// ================================================================================ constants

/** Samples per second (Wang 2003, §3.1: "8KHz, mono, 16-bit samples"). */
export const SAMPLE_RATE = 8000;
/** Samples per analysis window (64 ms). */
export const WINDOW = 512;
/** Samples between successive windows (32 ms). */
export const HOP = 256;
/** Seconds per spectrogram frame. */
export const FRAME_S = HOP / SAMPLE_RATE;
/** Frequency bins kept (0 to just under 4 kHz). */
export const BINS = WINDOW / 2;
/** Hz per frequency bin. */
export const BIN_HZ = SAMPLE_RATE / WINDOW;
/** Length of each clip in the database, in seconds. */
export const CLIP_S = 12;

/** Peak picking: a peak is louder than everything within ± these many bins and frames. */
export const PEAK_DF = 6;
export const PEAK_DT = 4;
/** Density: a peak is kept if fewer than this many stronger peaks lie within ± DENSITY_DT. */
export const DENSITY_K = 10;
export const DENSITY_DT = 8;
/** ... and none nearby is more than this many dB louder (faint peaks are the first to drown). */
export const DENSITY_DB = 25;
/** Target zone: from 2 to 40 frames after the anchor (64 ms to 1.28 s), within ± 48 bins. */
export const ZONE_DT0 = 2;
export const ZONE_DT1 = 40;
export const ZONE_DF = 48;
/** Fan-out: pairs per anchor (Wang's example value, §2.2). */
export const FAN_OUT = 10;
/** Bits of the hash: first frequency, second frequency, gap. */
export const BITS_F = 8;
export const BITS_DT = 6;
export const HASH_BITS = 2 * BITS_F + BITS_DT;

/** The verdict: a match needs at least this many aligned hashes ... */
export const MIN_SCORE = 13;
/** ... and a spike at least this many times taller than the best spike of any other clip. */
export const MIN_RATIO = 3;
/** The score counts the time pairs within ± this many frames of the best offset. */
export const CLUSTER = 1;

// ================================================================================ the tunes

export interface ClipInfo {
	/** 0 to 11 are in the database; 12 is the tune that is not. */
	id: number;
	name: string;
	/** Beats per minute. */
	bpm: number;
	/** Key, e.g. "D minor". */
	key: string;
	instrument: string;
}

interface Note {
	t: number;
	dur: number;
	midi: number;
	voice: 'melody' | 'bass' | 'chord';
}

interface Timbre {
	/** Partial k has amplitude (1/k)^tilt. */
	tilt: number;
	/** Exponential decay time of a note, seconds. */
	decay: number;
	/** Odd partials only (a clarinet-like sound). */
	odd: boolean;
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const INSTRUMENTS: [string, Timbre][] = [
	['marimba', { tilt: 2.2, decay: 0.25, odd: false }],
	['vibraphone', { tilt: 1.6, decay: 0.5, odd: false }],
	['square-wave pluck', { tilt: 1.1, decay: 0.4, odd: true }],
	['plucked guitar', { tilt: 1.4, decay: 0.45, odd: false }],
	['electric piano', { tilt: 1.8, decay: 0.6, odd: false }],
	['harp', { tilt: 1.2, decay: 0.5, odd: false }]
];
const TITLES = [
	'Harbour Lights',
	'Paper Kites',
	'Slow Orbit',
	'Copper Rain',
	'The Long Field',
	'Night Bus',
	'Glass Garden',
	'Hollow Hill',
	'Saltwater',
	'Second Spring',
	'Lantern Walk',
	'Blue Static',
	'Unknown Tune'
];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

/** Number of clips in the database. */
export const DB_SIZE = 12;
/** The id of the tune that is not in the database. */
export const UNKNOWN = 12;

interface Score {
	info: ClipInfo;
	notes: Note[];
	timbre: Timbre;
}

/** The score of tune `id`: its notes and timbre, all drawn from a generator seeded by `id`. */
function score(id: number): Score {
	const r = rng(1009 * (id + 1) + 77);
	const bpm = Math.round(88 + r() * 56);
	const beat = 60 / bpm;
	const root = 50 + Math.floor(r() * 12);
	const minor = r() < 0.5;
	const scale = minor ? MINOR : MAJOR;
	const [instrument, timbre] = INSTRUMENTS[Math.floor(r() * INSTRUMENTS.length)];
	const notes: Note[] = [];
	const total = CLIP_S + 2;
	// melody: a random walk on the scale, two octaves above the bass, eighths to half notes
	let deg = 7 + Math.floor(r() * 4);
	for (let t = 0; t < total;) {
		const dur = beat * [0.5, 0.5, 1, 1, 1.5, 2][Math.floor(r() * 6)];
		deg = Math.max(2, Math.min(15, deg + Math.floor(r() * 5) - 2));
		const midi = root + 12 + 12 * Math.floor(deg / 7) + scale[deg % 7];
		if (r() > 0.08) notes.push({ t, dur, midi, voice: 'melody' });
		t += dur;
	}
	// bass: a chord root every two beats, drawn from I, IV, V and vi so no bar repeats exactly;
	// an accompaniment picks the chord's notes in eighths, an octave above the bass
	const roots = [0, 3, 4, 5];
	for (let i = 0; i * 2 * beat < total; i++) {
		const d = i === 0 ? 0 : roots[Math.floor(r() * roots.length)];
		notes.push({ t: i * 2 * beat, dur: 2 * beat, midi: root - 12 + scale[d], voice: 'bass' });
		for (let j = 1; j < 4; j++) {
			if (r() < 0.25) continue;
			const c = d + [0, 2, 4, 7][Math.floor(r() * 4)];
			const midi = root + 12 * Math.floor(c / 7) + scale[c % 7];
			notes.push({ t: (i * 2 + j * 0.5) * beat, dur: 0.5 * beat, midi, voice: 'chord' });
		}
	}
	const key = `${NOTE_NAMES[root % 12]} ${minor ? 'minor' : 'major'}`;
	return { info: { id, name: TITLES[id], bpm, key, instrument }, notes, timbre };
}

/** The tunes: twelve in the database, then the one that is not. */
export const CLIPS: ClipInfo[] = Array.from({ length: DB_SIZE + 1 }, (_, i) => score(i).info);

/** How a tune is played: the original, a semitone or more higher, or another band's version. */
export type Version = 'original' | 'higher' | 'cover';

/** The cover band plays 8% slower. */
export const COVER_TEMPO = 0.92;

/**
 * Renders tune `id` to samples, `seconds` long. `version` 'higher' plays every note
 * `semitones` higher with the same timing; 'cover' is the same tune played by another band:
 * another instrument, 8% slower, each note a few milliseconds early or late as people play.
 */
export function render(
	id: number,
	seconds = CLIP_S,
	version: Version = 'original',
	semitones = 1
): Float32Array {
	const sc = score(id);
	const n = Math.round(seconds * SAMPLE_RATE);
	const out = new Float32Array(n);
	const stretch = version === 'cover' ? 1 / COVER_TEMPO : 1;
	const shift = version === 'higher' ? semitones : 0;
	const timbre: Timbre =
		version === 'cover'
			? {
					tilt: sc.timbre.tilt > 1.3 ? 0.9 : 2,
					decay: sc.timbre.decay > 0.45 ? 0.3 : 0.7,
					odd: !sc.timbre.odd
				}
			: sc.timbre;
	const human = rng(31 * id + 5);
	for (const note of sc.notes) {
		const jitter = version === 'cover' ? (human() - 0.5) * 0.04 : 0;
		const t0 = note.t * stretch + jitter;
		if (t0 < 0 || t0 >= seconds) continue;
		const i0 = Math.round(t0 * SAMPLE_RATE);
		const dur = note.dur * stretch;
		const amp = note.voice === 'melody' ? 0.5 : note.voice === 'bass' ? 0.32 : 0.2;
		const decay = note.voice === 'bass' ? Math.max(0.5, timbre.decay) : timbre.decay;
		const f0 = 440 * 2 ** ((note.midi + shift - 69) / 12);
		const len = Math.min(n - i0, Math.round((dur + 0.03) * SAMPLE_RATE));
		const att = 0.008 * SAMPLE_RATE;
		const rel = 0.03 * SAMPLE_RATE;
		const endHold = dur * SAMPLE_RATE;
		const kd = Math.exp(-1 / (decay * SAMPLE_RATE));
		for (let k = 1; k * f0 < 3800; k += timbre.odd ? 2 : 1) {
			const a = amp * (1 / k) ** timbre.tilt;
			if (a < 0.004) break;
			// a sine by rotation: (c, s) turns by the partial's phase step each sample
			const w = (2 * Math.PI * k * f0) / SAMPLE_RATE;
			const cw = Math.cos(w);
			const sw = Math.sin(w);
			let c = 1;
			let s = 0;
			let env = 1;
			for (let i = 0; i < len; i++) {
				const shape = i < att ? i / att : i > endHold ? Math.max(0, 1 - (i - endHold) / rel) : 1;
				out[i0 + i] += a * env * shape * s;
				const c2 = c * cw - s * sw;
				s = s * cw + c * sw;
				c = c2;
				env *= kd;
			}
		}
	}
	return out;
}

// ================================================================================ recording

export interface Recording {
	/** Which tune is playing (0–12). */
	clip: number;
	version: Version;
	/** Semitones up for the 'higher' version. */
	semitones: number;
	/** Where in the tune the recording starts, seconds. */
	start: number;
	/** Length of the recording, seconds. */
	seconds: number;
	/** Signal-to-noise ratio of the added white noise, dB (Infinity: none). */
	snrDb: number;
	/** Add a cough. */
	cough: boolean;
	/** Seed of the noise and of the cough's place. */
	seed: number;
}

export const DEFAULT_RECORDING: Recording = {
	clip: 4,
	version: 'original',
	semitones: 1,
	start: 4.3,
	seconds: 5,
	snrDb: 5,
	cough: true,
	seed: 1
};

/** Gaussian noise from a seeded uniform generator (Box–Muller). */
function gauss(r: () => number) {
	return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

export interface Recorded {
	samples: Float32Array;
	/** The cough's start and end in the recording, seconds (null when there is none). */
	cough: [number, number] | null;
}

/** A recording: an excerpt of a tune, with white noise and a cough added. */
export function record(rec: Recording): Recorded {
	const full = render(
		rec.clip,
		Math.min(CLIP_S, rec.start + rec.seconds) + 0.01,
		rec.version,
		rec.semitones
	);
	const i0 = Math.round(rec.start * SAMPLE_RATE);
	const n = Math.round(rec.seconds * SAMPLE_RATE);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = full[i0 + i] ?? 0;
	let power = 0;
	for (let i = 0; i < n; i++) power += out[i] * out[i];
	const rms = Math.sqrt(power / Math.max(1, n));
	const r = rng(7919 * rec.seed + 17);
	let cough: [number, number] | null = null;
	if (rec.cough) {
		// a cough: 0.4 s of noise, low-passed, with a sharp start and a decay, several times
		// louder than the music
		const c0 = (0.2 + r() * Math.max(0, rec.seconds - 0.8)) * SAMPLE_RATE;
		const len = 0.4 * SAMPLE_RATE;
		let lp = 0;
		for (let i = 0; i < len && c0 + i < n; i++) {
			lp += 0.25 * (gauss(r) - lp);
			const env = Math.min(1, i / 40) * Math.exp(-i / (0.12 * SAMPLE_RATE));
			out[Math.floor(c0) + i] += 3 * rms * env * lp;
		}
		cough = [c0 / SAMPLE_RATE, (c0 + len) / SAMPLE_RATE];
	}
	if (Number.isFinite(rec.snrDb)) {
		const sigma = rms / 10 ** (rec.snrDb / 20);
		for (let i = 0; i < n; i++) out[i] += sigma * gauss(r);
	}
	return { samples: out, cough };
}

// ================================================================================ spectrogram

/** In-place radix-2 FFT of a complex signal of power-of-two length. */
function fft(re: Float64Array, im: Float64Array) {
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
				const tr = re[b] * cr - im[b] * ci;
				const ti = re[b] * ci + im[b] * cr;
				re[b] = re[a] - tr;
				im[b] = im[a] - ti;
				re[a] += tr;
				im[a] += ti;
				const c2 = cr * wr - ci * wi;
				ci = cr * wi + ci * wr;
				cr = c2;
			}
		}
	}
}

export interface Spectrogram {
	frames: number;
	/** Level in dB, frame-major: `db[frame * BINS + bin]`. */
	db: Float32Array;
}

const HANN = Float64Array.from(
	{ length: WINDOW },
	(_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW)
);

/** Short-time Fourier transform: a Hann window every HOP samples, the level of each bin in dB. */
export function spectrogram(x: Float32Array): Spectrogram {
	const frames = Math.max(0, Math.floor((x.length - WINDOW) / HOP) + 1);
	const db = new Float32Array(frames * BINS);
	const re = new Float64Array(WINDOW);
	const im = new Float64Array(WINDOW);
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < WINDOW; i++) {
			re[i] = x[f * HOP + i] * HANN[i];
			im[i] = 0;
		}
		fft(re, im);
		for (let b = 0; b < BINS; b++)
			db[f * BINS + b] = 10 * Math.log10(re[b] * re[b] + im[b] * im[b] + 1e-9);
	}
	return { frames, db };
}

// ================================================================================ peaks

export interface Peak {
	/** Frame index. */
	t: number;
	/** Frequency bin. */
	f: number;
	/** Level, dB. */
	db: number;
}

/** Bins below this (about 78 Hz) are ignored: nothing in the tunes lives there. */
const LOW_BIN = 5;

/**
 * Spectrogram peaks (Wang 2003, §2.1): local maxima of a box ± PEAK_DT frames × ± PEAK_DF bins,
 * kept when fewer than DENSITY_K stronger ones lie within ± DENSITY_DT frames, so that loud
 * passages don't take all the peaks and quiet ones still get some.
 */
export function peaks(s: Spectrogram): Peak[] {
	const cand: Peak[] = [];
	const { frames, db } = s;
	for (let t = 0; t < frames; t++) {
		for (let f = LOW_BIN; f < BINS - 1; f++) {
			const v = db[t * BINS + f];
			if (v < db[t * BINS + f - 1] || v < db[t * BINS + f + 1]) continue;
			let max = true;
			for (let dt = -PEAK_DT; dt <= PEAK_DT && max; dt++) {
				const tt = t + dt;
				if (tt < 0 || tt >= frames) continue;
				const row = tt * BINS;
				for (let df = -PEAK_DF; df <= PEAK_DF; df++) {
					const ff = f + df;
					if (ff < LOW_BIN || ff >= BINS || (dt === 0 && df === 0)) continue;
					const w = db[row + ff];
					// ties go to the earlier, lower point so a flat top gives one peak
					if (w > v || (w === v && (dt < 0 || (dt === 0 && df < 0)))) {
						max = false;
						break;
					}
				}
			}
			if (max) cand.push({ t, f, db: v });
		}
	}
	return cand.filter((p) => {
		let stronger = 0;
		for (const q of cand)
			if (
				Math.abs(q.t - p.t) <= DENSITY_DT &&
				q.db > p.db &&
				(++stronger >= DENSITY_K || q.db > p.db + DENSITY_DB)
			)
				return false;
		return true;
	});
}

// ================================================================================ hashes

export interface Hash {
	/** The packed fingerprint: f1 (8 bits), f2 (8 bits), Δt (6 bits). */
	hash: number;
	/** The anchor's frame. */
	t: number;
	anchor: Peak;
	target: Peak;
}

/** Packs two frequency bins and a gap in frames into one number. */
export const pack = (f1: number, f2: number, dt: number) =>
	(f1 << (BITS_F + BITS_DT)) | (f2 << BITS_DT) | dt;

/** The three fields of a packed hash. */
export const unpack = (h: number) => ({
	f1: h >>> (BITS_F + BITS_DT),
	f2: (h >>> BITS_DT) & ((1 << BITS_F) - 1),
	dt: h & ((1 << BITS_DT) - 1)
});

/** The peaks in the target zone of `anchor`, nearest in time first, at most FAN_OUT. */
export function targets(ps: Peak[], anchor: Peak): Peak[] {
	return ps
		.filter(
			(q) =>
				q.t - anchor.t >= ZONE_DT0 &&
				q.t - anchor.t <= ZONE_DT1 &&
				Math.abs(q.f - anchor.f) <= ZONE_DF
		)
		.sort((a, b) => a.t - b.t || a.f - b.f)
		.slice(0, FAN_OUT);
}

/** Every anchor paired with the first peaks of its target zone (Wang 2003, §2.2). */
export function hashes(ps: Peak[]): Hash[] {
	const sorted = [...ps].sort((a, b) => a.t - b.t || a.f - b.f);
	const out: Hash[] = [];
	for (let i = 0; i < sorted.length; i++) {
		const a = sorted[i];
		let n = 0;
		for (let j = i + 1; j < sorted.length && n < FAN_OUT; j++) {
			const b = sorted[j];
			const dt = b.t - a.t;
			if (dt > ZONE_DT1) break;
			if (dt < ZONE_DT0 || Math.abs(b.f - a.f) > ZONE_DF) continue;
			out.push({ hash: pack(a.f, b.f, dt), t: a.t, anchor: a, target: b });
			n++;
		}
	}
	return out;
}

// ================================================================================ database

export interface Fingerprinted {
	spec: Spectrogram;
	peaks: Peak[];
	hashes: Hash[];
}

/** The whole analysis of some samples. */
export function fingerprint(x: Float32Array): Fingerprinted {
	const spec = spectrogram(x);
	const ps = peaks(spec);
	return { spec, peaks: ps, hashes: hashes(ps) };
}

export interface Database {
	clips: Fingerprinted[];
	/** hash → packed entries clip * 65536 + anchor frame. */
	index: Map<number, number[]>;
}

let db: Database | null = null;

/** The database of the twelve clips, built once on first use. */
export function database(): Database {
	if (db) return db;
	const clips: Fingerprinted[] = [];
	const index = new Map<number, number[]>();
	for (let id = 0; id < DB_SIZE; id++) {
		const fp = fingerprint(render(id));
		clips.push(fp);
		for (const h of fp.hashes) {
			const list = index.get(h.hash);
			const e = id * 65536 + h.t;
			if (list) list.push(e);
			else index.set(h.hash, [e]);
		}
	}
	db = { clips, index };
	return db;
}

const clipCache = new Map<number, Fingerprinted>();
/** One clip's analysis (the database's for 0–11; the unknown tune's computed apart). */
export function clipPrint(id: number): Fingerprinted {
	if (id < DB_SIZE) return database().clips[id];
	let fp = clipCache.get(id);
	if (!fp) {
		fp = fingerprint(render(id));
		clipCache.set(id, fp);
	}
	return fp;
}

// ================================================================================ search

export interface ClipMatch {
	clip: number;
	/** Hashes of the recording found in this clip. */
	hits: number;
	/** The distinct time pairs of those hits: [frame in the recording, frame in the clip]. */
	pairs: [number, number][];
	/** Histogram of δt = t_clip − t_rec, in frames: offset → count. */
	histogram: Map<number, number>;
	/** The tallest bin's offset, frames. */
	offset: number;
	/** Time pairs in the tallest bin and its two neighbours: the clip's score (Wang 2003, §2.3). */
	score: number;
}

export interface Search {
	recording: Fingerprinted;
	matches: ClipMatch[];
	/** Clip ids by score, best first. */
	ranking: number[];
	/** The winning clip, or null when no spike stands out. */
	winner: number | null;
	/** The best clip's score divided by the best other clip's score (≥ 1). */
	ratio: number;
}

/** Looks up every hash of a recording and scores each clip by its tallest offset bin. */
export function search(x: Float32Array): Search {
	const { index } = database();
	const recording = fingerprint(x);
	const matches: ClipMatch[] = Array.from({ length: DB_SIZE }, (_, clip) => ({
		clip,
		hits: 0,
		pairs: [],
		histogram: new Map(),
		offset: 0,
		score: 0
	}));
	const seen = matches.map(() => new Set<number>());
	for (const h of recording.hashes) {
		const list = index.get(h.hash);
		if (!list) continue;
		for (const e of list) {
			const m = matches[Math.floor(e / 65536)];
			const td = e % 65536;
			m.hits++;
			// the harmonics of two notes give several hashes with the same two times and the same
			// gap: they are one piece of evidence, not several, so they count once
			const key = (h.t * 4096 + td) * 64 + (h.hash & ((1 << BITS_DT) - 1));
			if (seen[m.clip].has(key)) continue;
			seen[m.clip].add(key);
			m.pairs.push([h.t, td]);
			const d = td - h.t;
			m.histogram.set(d, (m.histogram.get(d) ?? 0) + 1);
		}
	}
	// the score: the hashes within ± CLUSTER frames of the best offset (a peak's frame can move
	// by one when the recording starts between two frames, so a match spreads over neighbours)
	for (const m of matches)
		for (const [d, c] of m.histogram) {
			let s = c;
			for (let k = 1; k <= CLUSTER; k++)
				s += (m.histogram.get(d - k) ?? 0) + (m.histogram.get(d + k) ?? 0);
			if (s > m.score || (s === m.score && c > (m.histogram.get(m.offset) ?? 0))) {
				m.score = s;
				m.offset = d;
			}
		}
	const ranking = matches
		.map((m) => m.clip)
		.sort((a, b) => matches[b].score - matches[a].score || a - b);
	const best = matches[ranking[0]].score;
	const second = matches[ranking[1]].score;
	const ratio = best / Math.max(1, second);
	const winner = best >= MIN_SCORE && ratio >= MIN_RATIO ? ranking[0] : null;
	return { recording, matches, ranking, winner, ratio };
}

const searchCache = new Map<string, { rec: Recorded; result: Search }>();

/** Records and searches, remembering the last few results (the scenes ask often). */
export function recordAndSearch(rec: Recording): { rec: Recorded; result: Search } {
	const key = JSON.stringify(rec);
	let hit = searchCache.get(key);
	if (!hit) {
		const r = record(rec);
		hit = { rec: r, result: search(r.samples) };
		searchCache.set(key, hit);
		if (searchCache.size > 24) searchCache.delete(searchCache.keys().next().value as string);
	}
	return hit;
}
