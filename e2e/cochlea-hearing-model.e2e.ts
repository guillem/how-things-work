// Checks the cochlea model against measurements: the travelling wave peaks where Greenwood's
// place map puts each frequency; the live cochlea's tuning (Q10 of 4–15 at low levels, falling
// to below 2 at high levels) and its best frequency shifting down by about half an octave at high
// levels (Robles & Ruggero 2001, Physiol. Rev. 81:1305); a dead (passive) cochlea peaks well
// basal of the live one; the amplifier's response grows compressively and joins the passive one
// at very high levels; lost outer hair cells near the 5 kHz place give an audiogram notch at
// 3–6 kHz with better hearing at 2 and 8 kHz (the notch criteria of Lie et al. 2017); soft tones
// vanish while loud ones reach the same excitation (recruitment). Then the implant: a vowel's
// spectrum peaks at its formants; band edges are equally spaced along the cochlea; the noise
// vocoder keeps each band's level; few bands blur the formants. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	AUDIOGRAM_FREQS,
	HEALTHY,
	LENGTH_MM,
	NOISE_DAMAGED,
	PASSIVE,
	PLACES,
	audiogram,
	bestPlace,
	cfAt,
	dbRe,
	placeOf,
	respond
} from '../src/routes/cochlea-hearing/model';
import {
	BAND_HI,
	BAND_LO,
	RATE,
	VOWELS,
	bandEdges,
	bandLevels,
	electrodePlaces,
	vocode,
	vowelHarmonics,
	vowelSound
} from '../src/routes/cochlea-hearing/implant';

/** Q10 of the place tuned to f0: best frequency over its 10-dB bandwidth, at `level` dB SPL. */
function tuning(f0: number, level: number) {
	const j = bestPlace(f0);
	const fs: number[] = [];
	const v: number[] = [];
	for (let k = -96; k <= 48; k++) {
		const f = f0 * Math.pow(2, k / 48);
		fs.push(f);
		v.push(respond(f, level).mag[j]);
	}
	let b = 0;
	for (let i = 0; i < v.length; i++) if (v[i] > v[b]) b = i;
	const floor = v[b] / Math.sqrt(10);
	let a = b;
	let c = b;
	while (a > 0 && v[a - 1] >= floor) a--;
	while (c < v.length - 1 && v[c + 1] >= floor) c++;
	return { bf: fs[b], q10: fs[b] / (fs[c] - fs[a]) };
}

/** Peak excitation (dB re threshold) of a tone across the whole membrane. */
const peakDb = (f: number, level: number, ear = HEALTHY) => {
	const r = respond(f, level, ear);
	return dbRe(r.mag[r.peak]);
};

test("Greenwood's map runs from about 20 Hz at the apex to about 20 kHz at the base", () => {
	expect(cfAt(LENGTH_MM)).toBeCloseTo(19.8, 0);
	expect(cfAt(0) / 1000).toBeCloseTo(20.7, 1);
	// and about 5 mm per octave in the middle
	expect(placeOf(1000) - placeOf(2000)).toBeGreaterThan(4);
	expect(placeOf(1000) - placeOf(2000)).toBeLessThan(6);
});

test('a soft tone peaks within half a millimetre of its place on the map', () => {
	for (const f of [125, 250, 500, 1000, 2000, 4000, 8000, 12000]) {
		const r = respond(f, 20);
		expect(r.converged).toBe(true);
		expect(Math.abs(PLACES[r.peak] - placeOf(f))).toBeLessThan(0.5);
	}
	// higher tones peak nearer the base
	expect(PLACES[respond(4000, 20).peak]).toBeLessThan(PLACES[respond(500, 20).peak]);
});

test('the live cochlea is sharply tuned at low levels and broadly at high levels', () => {
	for (const f of [1000, 4000]) {
		const soft = tuning(f, 10);
		const loud = tuning(f, 90);
		expect(soft.q10).toBeGreaterThan(4);
		expect(soft.q10).toBeLessThan(15);
		expect(loud.q10).toBeLessThan(2);
		// the best frequency moves down by about half an octave (here 0.4–1)
		const shift = Math.log2(soft.bf / loud.bf);
		expect(shift).toBeGreaterThan(0.4);
		expect(shift).toBeLessThan(1);
	}
});

test('without the amplifier the peak is lower, broader and further towards the base', () => {
	const live = respond(4000, 20);
	const dead = respond(4000, 20, PASSIVE);
	expect(dbRe(live.mag[live.peak]) - dbRe(dead.mag[dead.peak])).toBeGreaterThan(20);
	expect(placeOf(4000) - PLACES[dead.peak]).toBeGreaterThan(2);
});

test('the response grows compressively and meets the passive one at very high levels', () => {
	// passive: 1 dB per dB; live: well under 1 dB per dB between 40 and 80 dB SPL
	expect(peakDb(4000, 80, PASSIVE) - peakDb(4000, 40, PASSIVE)).toBeCloseTo(40, 1);
	const growth = (peakDb(4000, 80) - peakDb(4000, 40)) / 40;
	expect(growth).toBeLessThan(0.6);
	expect(growth).toBeGreaterThan(0.2);
	// at low levels it grows linearly
	expect(peakDb(4000, 20) - peakDb(4000, 10)).toBeCloseTo(10, 0);
	expect(Math.abs(peakDb(4000, 110) - peakDb(4000, 110, PASSIVE))).toBeLessThan(1);
});

test('a healthy ear hears every audiometric tone near 0–15 dB SPL', () => {
	const hl = audiogram(HEALTHY);
	for (const p of hl) expect(Math.abs(p.hl)).toBeLessThan(0.1);
	for (const f of AUDIOGRAM_FREQS) {
		const r = respond(f, 15);
		expect(dbRe(r.mag[r.peak])).toBeGreaterThan(0);
	}
});

test('losing the outer hair cells near the 5 kHz place notches the audiogram at 3–6 kHz', () => {
	const hl = Object.fromEntries(audiogram(NOISE_DAMAGED).map((p) => [p.f, p.hl]));
	const worst = Math.max(hl[3000], hl[4000], hl[6000]);
	expect(hl[4000]).toBe(worst);
	expect(worst).toBeGreaterThan(15);
	// hearing at 2 and 8 kHz is at least 10 dB better than at the notch, and low tones are unharmed
	expect(worst - hl[2000]).toBeGreaterThan(10);
	expect(worst - hl[8000]).toBeGreaterThan(10);
	for (const f of [250, 500, 1000]) expect(hl[f]).toBeLessThan(2);
});

test('in the damaged ear soft tones vanish but loud ones excite it as much as a healthy ear', () => {
	// a 4 kHz tone at 15 dB SPL: heard by the healthy ear, not by the damaged one
	expect(peakDb(4000, 15)).toBeGreaterThan(0);
	expect(peakDb(4000, 15, NOISE_DAMAGED)).toBeLessThan(0);
	// at 100 dB SPL the two excitations are within 1 dB
	expect(Math.abs(peakDb(4000, 100) - peakDb(4000, 100, NOISE_DAMAGED))).toBeLessThan(1);
	// so the damaged ear's excitation grows faster with level: recruitment
	const healthy = peakDb(4000, 90) - peakDb(4000, 40);
	const damaged = peakDb(4000, 90, NOISE_DAMAGED) - peakDb(4000, 40, NOISE_DAMAGED);
	expect(damaged).toBeGreaterThan(healthy + 10);
});

test("a synthesized vowel's spectrum peaks at its formants", () => {
	for (const v of Object.values(VOWELS)) {
		const hs = vowelHarmonics(v);
		const top = hs.reduce((a, b) => (b.a > a.a ? b : a));
		// the strongest harmonic is the one nearest the first formant (all three are below 800 Hz)
		const nearest = hs.reduce((a, b) =>
			Math.abs(b.f - v.formants[0]) < Math.abs(a.f - v.formants[0]) ? b : a
		);
		expect(top.f).toBe(nearest.f);
	}
	// ee has a strong second formant near 2.3 kHz; oo has almost nothing there
	const at = (id: 'ee' | 'oo', f: number) =>
		vowelHarmonics(VOWELS[id]).find((h) => Math.abs(h.f - f) < 61)!.a;
	expect(20 * Math.log10(at('ee', 2280) / at('oo', 2280))).toBeGreaterThan(10);
});

test('the implant splits 200 Hz–7 kHz into bands of equal length along the cochlea', () => {
	const e = bandEdges(8);
	expect(e[0]).toBeCloseTo(BAND_LO, 6);
	expect(e[8]).toBeCloseTo(BAND_HI, 6);
	const widths = e.slice(1).map((f, i) => placeOf(e[i]) - placeOf(f));
	for (const w of widths) expect(w).toBeCloseTo(widths[0], 6);
	// the deepest electrode, which carries the lowest band, sits basal of that band's place
	const deepest = electrodePlaces(8)[0];
	expect(deepest).toBeLessThan(placeOf(e[1]));
});

/** Magnitude of a sound's spectrum at frequency f (a single DFT bin over the whole sound). */
function spectrumAt(x: Float32Array, f: number): number {
	let re = 0;
	let im = 0;
	for (let i = 0; i < x.length; i++) {
		const p = (2 * Math.PI * f * i) / RATE;
		re += x[i] * Math.cos(p);
		im += x[i] * Math.sin(p);
	}
	return Math.hypot(re, im);
}

test('the implant throws away the harmonics but keeps the shape of the spectrum', () => {
	const x = vowelSound(VOWELS.ah, 0.6);
	// the vowel: harmonics of 120 Hz stand far above the gaps between them
	const lines = (s: Float32Array) => {
		let on = 0;
		let off = 0;
		for (const f of [600, 720, 840, 960, 1080]) {
			on += spectrumAt(s, f);
			off += spectrumAt(s, f + 60);
		}
		return 20 * Math.log10(on / off);
	};
	expect(lines(x)).toBeGreaterThan(15);
	expect(lines(vocode(x, 8).sound)).toBeLessThan(6);
	// the more channels, the closer the coarse spectrum (16 bands) follows the vowel's
	const db = (a: number[]) => a.map((v) => 20 * Math.log10(v / Math.max(...a)));
	const target = db(bandLevels(x, 16));
	const error = (n: number) => {
		const got = db(bandLevels(vocode(x, n).sound, 16));
		return target.reduce((s, v, i) => s + Math.abs(got[i] - v), 0) / target.length;
	};
	expect(error(16)).toBeLessThan(error(4));
	expect(error(4)).toBeLessThan(error(1));
	// each electrode carries its band's level
	expect(vocode(x, 4).levels).toEqual(bandLevels(x, 4));
});
