/**
 * How your ear hears, at level 0: the middle ear's push concentration and the cochlea's
 * place-by-pitch map, in words and counts a beginner reads.
 *
 * The cochlea is the level-3 page's model (`cochlea-hearing/model.ts`): a one-dimensional
 * transmission-line basilar membrane on Greenwood's human place map, with its active, compressive
 * amplifier, solved for each steady tone. This page draws the same responses, so a note's bump,
 * its place and the way it grows with loudness are the model's, not a picture of them.
 *
 * The middle ear (textbook values, as in Pickles, "An Introduction to the Physiology of Hearing",
 * 4th ed. 2012, ch. 2, after Wever & Lawrence 1954 and von Békésy 1960): the eardrum's effective
 * area is about 55 mm², the stirrup's footplate in the oval window about 3.2 mm², so the same
 * force lands on an area about 17 times smaller; the hammer's arm is about 1.3 times the anvil's,
 * a small lever. Together they make the push on each bit of the window (the pressure) about 22
 * times the air's push on each bit of the eardrum. Real middle ears fall short of this ideal at
 * many frequencies (the eardrum does not move as a stiff piston); the page quotes the ideal ratio.
 *
 * Without the middle ear, sound in air meeting water head on: the share of its energy that passes
 * into the water is 4 Z₁ Z₂ / (Z₁ + Z₂)², with the characteristic impedances of air
 * (1.204 kg/m³ × 343 m/s at 20 °C) and of water (1000 kg/m³ × 1480 m/s), about 1 part in 900.
 */
import {
	LENGTH_MM,
	PLACES,
	SECTIONS,
	dbRe,
	excitation,
	peakWidth,
	respond,
	type Response
} from '../cochlea-hearing/model.ts';

export { LENGTH_MM, PLACES, SECTIONS, dbRe, respond, type Response };

// ------------------------------------------------------------------------------- the middle ear
/** Effective vibrating area of the eardrum, mm². */
export const EARDRUM_AREA = 55;
/** Area of the stirrup's footplate in the oval window, mm². */
export const WINDOW_AREA = 3.2;
/** The bones' lever: the hammer's arm over the anvil's. */
export const LEVER = 1.3;

/** What pushes on the oval window on the middle-ear step. */
export type MiddleEar = 'ear' | 'small' | 'none';

/**
 * The push on each bit of the oval window, as a multiple of the air's push on each bit of the
 * eardrum (a pressure ratio): the real ear (a big eardrum and the bones' lever), an eardrum shrunk
 * to the window's size (the lever alone), or no eardrum and no bones (the air on the window).
 */
export function windowPush(m: MiddleEar): number {
	if (m === 'ear') return (EARDRUM_AREA / WINDOW_AREA) * LEVER;
	if (m === 'small') return LEVER;
	return 1;
}

/** How many times bigger the eardrum's area is than the window's. */
export const AREA_RATIO = EARDRUM_AREA / WINDOW_AREA;

const Z_AIR = 1.204 * 343;
const Z_WATER = 1000 * 1480;
/** The share of a sound's energy that passes from air straight into water (head on). */
export const AIR_TO_WATER = (4 * Z_AIR * Z_WATER) / (Z_AIR + Z_WATER) ** 2;

/** Decibels by which a pressure ratio raises a sound's level. */
export const gainDb = (ratio: number) => 20 * Math.log10(ratio);

// ------------------------------------------------------------------------------- pitch
/** The pitch slider counts octaves above 31.25 Hz: 0 → 31.25 Hz, 5 → 1 kHz, 9 → 16 kHz. */
export function pitchHz(octaves: number): number {
	return 31.25 * Math.pow(2, octaves);
}

/** A frequency as "1,000 times a second", rounded to what a reader would say aloud. */
export function shakes(f: number): string {
	const digits = f < 100 ? 1 : f < 1000 ? 2 : f < 10000 ? 2 : 3;
	const p = Math.pow(10, Math.floor(Math.log10(f)) - digits + 1);
	const r = Math.round(f / p) * p;
	return `${r.toLocaleString('en-GB')} times a second`;
}

/** An everyday sound of about this pitch (the note's main shake rate). */
export function soundsLike(f: number): string {
	if (f < 80) return 'a deep rumble, lower than any voice';
	if (f < 180) return 'as low as a man’s speaking voice';
	if (f < 350) return 'as high as a woman’s or a child’s speaking voice';
	if (f < 1100) return 'a high note, like a soprano singing';
	if (f < 4200) return 'a whistle or a bird’s chirp';
	if (f < 9000) return 'very high, like the hiss in an “s”';
	return 'a thin whine many grown-ups can no longer hear';
}

// ------------------------------------------------------------------------------- loudness
/** The loudness slider, in dB SPL, with the everyday sound of about that level. */
export const LOUDNESS: readonly { level: number; name: string }[] = [
	{ level: 20, name: 'rustling leaves' },
	{ level: 30, name: 'a whisper' },
	{ level: 40, name: 'a quiet library' },
	{ level: 50, name: 'gentle rain' },
	{ level: 60, name: 'people talking' },
	{ level: 70, name: 'a vacuum cleaner' },
	{ level: 80, name: 'a busy street' },
	{ level: 90, name: 'a lawnmower' }
];

/** The everyday name of the level nearest to `level` dB SPL. */
export function loudnessName(level: number): string {
	let best = LOUDNESS[0];
	for (const l of LOUDNESS) if (Math.abs(l.level - level) < Math.abs(best.level - level)) best = l;
	return best.name;
}

/**
 * The level of the page's notes before the loudness step, dB SPL: a soft note, about as loud as
 * a quiet library. Soft notes make the sharpest bumps (loud ones spread), so two notes half an
 * octave apart still make two.
 */
export const SOFT = 40;

// ------------------------------------------------------------------------------- the ribbon
/** Inner hair cells along one human cochlea: the sensors that signal to the brain. */
export const SENSORS = 3500;

/** The place where a response peaks, cm from the oval window. */
export function peakCm(r: Response): number {
	return PLACES[r.peak] / 10;
}

/**
 * The shake of the ribbon along its length for several notes played together, on the page's
 * squeezed drawing scale: 0 where the ribbon moves too little for any sensor to signal (the
 * threshold of hearing) up to 1 where it moves 60 dB (a thousand times) more than that.
 */
export function drawnShake(responses: readonly Response[]): Float64Array {
	const e = excitation(responses);
	return Float64Array.from(e, (db) => Math.min(1, Math.max(0, db / SQUEEZE_DB)));
}
/** The range of the squeezed drawing scale, dB above the threshold of hearing. */
export const SQUEEZE_DB = 60;

/**
 * How many of the sensors shake hard enough to signal (the ribbon there moves faster than at the
 * threshold of hearing), for several notes together.
 */
export function sensorsSignalling(responses: readonly Response[]): number {
	const e = excitation(responses);
	let n = 0;
	for (const db of e) if (db > 0) n++;
	return (n / SECTIONS) * SENSORS;
}

/** How many sensors lie under the bump's top (within 10 dB, a third, of its peak shake). */
export function sensorsUnderPeak(r: Response): number {
	return (peakWidth(r).mm / LENGTH_MM) * SENSORS;
}

/**
 * The separate bumps of several notes played together: the places (cm from the window) where the
 * combined shake has a clear local top, at least 6 dB above the lowest point between it and the
 * next top. Two notes far apart in pitch give two; two close ones merge into one.
 */
export function bumps(responses: readonly Response[]): number[] {
	const e = excitation(responses);
	const tops: number[] = [];
	// coarse grid, 0.1 mm, to skip ripples of the solution
	const step = Math.max(1, Math.round(SECTIONS / 350));
	const xs: number[] = [];
	const ys: number[] = [];
	for (let j = 0; j < SECTIONS; j += step) {
		xs.push(PLACES[j]);
		ys.push(e[j]);
	}
	for (let i = 1; i < ys.length - 1; i++) {
		if (!(ys[i] >= ys[i - 1] && ys[i] > ys[i + 1]) || ys[i] <= 0) continue;
		// prominence: the drop to the deeper of the two saddles towards higher tops (or the ends)
		// (a side that runs off the end without meeting a higher top does not count)
		const saddle = (dir: number) => {
			let low = ys[i];
			for (let k = i + dir; k >= 0 && k < ys.length; k += dir) {
				if (ys[k] > ys[i]) return low;
				low = Math.min(low, ys[k]);
			}
			return -Infinity;
		};
		const base = Math.max(saddle(-1), saddle(1));
		if (ys[i] - (base === -Infinity ? 0 : base) >= 6) tops.push(xs[i] / 10);
	}
	return tops;
}
