// Checks the model behind the musical-scales-ratios explainer against known results. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	C4,
	INTERVALS,
	PURE_FIFTH,
	PURE_THIRD,
	PYTHAGOREAN_COMMA,
	beats,
	cents,
	closeFifths,
	convergents,
	etFrequency,
	fifthChain,
	fifthIn,
	lineUp,
	pairFrequencies,
	pairRoughness,
	roughness,
	roughnessCurve,
	thirdIn,
	valleys
} from '../src/routes/musical-scales-ratios/scales';

test('middle C is 261.63 Hz and an octave doubles the frequency (A4 = 440 Hz)', () => {
	expect(C4).toBeCloseTo(261.63, 2);
	expect(etFrequency(9)).toBeCloseTo(440, 9);
	expect(etFrequency(12) / etFrequency(0)).toBeCloseTo(2, 12);
	expect(cents(2)).toBeCloseTo(1200, 9);
});

test('a pure fifth is 701.96 cents and a pure major third 386.31 cents', () => {
	expect(PURE_FIFTH).toBeCloseTo(701.955, 3);
	expect(PURE_THIRD).toBeCloseTo(386.314, 3);
});

test('equal temperament: every fifth 1.96 cents flat, every major third 13.69 cents sharp', () => {
	expect(fifthIn(12)).toMatchObject({ k: 7, c: 700 });
	expect(fifthIn(12).err).toBeCloseTo(-1.955, 3);
	expect(thirdIn(12).err).toBeCloseTo(13.686, 3);
	// the pure pair puts the upper note exactly on 3:2; the equal one does not
	const [f1, f2] = pairFrequencies(0, 7, 'pure');
	expect(f2 / f1).toBeCloseTo(1.5, 12);
	const [g1, g2] = pairFrequencies(7, 0, 'equal');
	expect(cents(g2 / g1)).toBeCloseTo(700, 9);
});

test('the ladders on the divider: how far each misses the pure fifth and third', () => {
	const misses = (n: number) =>
		[fifthIn(n).err, thirdIn(n).err].map((e) => Math.round(e * 10) / 10);
	expect(misses(5)).toEqual([18, 93.7]);
	expect(misses(7)).toEqual([-16.2, -43.5]);
	expect(misses(12)).toEqual([-2, 13.7]);
	expect(misses(19)).toEqual([-7.2, -7.4]);
	expect(misses(31)).toEqual([-5.2, 0.8]);
	expect(misses(53)).toEqual([-0.1, -1.4]);
});

test('twelve is the first ladder whose fifth is within 2 cents; 5 and 7 are within 20', () => {
	expect(closeFifths(2, 53)).toEqual([12, 24, 29, 36, 41, 48, 53]);
	expect(closeFifths(20, 12)).toEqual([5, 7, 10, 12]);
	// 7/12, 24/41, 31/53 are convergents of log2(3/2), the best approximations of the fifth
	const cs = convergents(Math.log2(3 / 2), 8).map((c) => `${c.p}/${c.q}`);
	expect(cs).toEqual(expect.arrayContaining(['3/5', '7/12', '24/41', '31/53']));
});

test('twelve pure fifths overshoot seven octaves by the Pythagorean comma, 23.46 cents', () => {
	expect(PYTHAGOREAN_COMMA).toBeCloseTo(23.46, 2);
	expect(fifthChain(12)).toBeCloseTo(23.46, 2);
	// each of the first eleven lands near a different key
	const keys = Array.from({ length: 12 }, (_, k) => Math.round(fifthChain(k) / 100) % 12);
	expect(new Set(keys).size).toBe(12);
});

test('two sine tones are roughest about a quarter of a critical band apart (Plomp & Levelt)', () => {
	// at 500 Hz the critical band is ~100–120 Hz wide; the peak sits near 25 Hz apart
	let best = 0;
	let at = 0;
	for (let d = 0.5; d < 150; d += 0.5) {
		const r = pairRoughness(500, 500 + d);
		if (r > best) [best, at] = [r, d];
	}
	expect(at).toBeGreaterThan(20);
	expect(at).toBeLessThan(35);
	expect(pairRoughness(500, 500)).toBe(0);
	expect(pairRoughness(500, 750)).toBeLessThan(best * 0.05);
});

test('with harmonics, the roughness curve dips at the simple ratios', () => {
	const vs = valleys(roughnessCurve(C4, 'rich', 1250, 1));
	for (const [p, q] of [
		[6, 5],
		[5, 4],
		[4, 3],
		[3, 2],
		[5, 3],
		[2, 1]
	])
		expect(vs.some((c) => Math.abs(c - cents(p / q)) <= 3)).toBe(true);
	// the fifth and the octave are smoother than any second or seventh
	const r = (k: number) => roughness(C4, etFrequency(k), 'rich');
	for (const rough of [1, 2, 10, 11]) {
		expect(r(7)).toBeLessThan(r(rough));
		expect(r(12)).toBeLessThan(r(rough));
	}
});

test('two pure sine tones have no valley at 3:2: consonance depends on timbre', () => {
	expect(valleys(roughnessCurve(C4, 'sine', 1250, 1))).toEqual([]);
	// beyond a few semitones apart, sines barely interact at all
	expect(roughness(C4, C4 * 1.5, 'sine')).toBeLessThan(roughness(C4, C4 * 1.06, 'sine') / 10);
});

test('beats: an equal-tempered major third on C4 beats about 10 times a second, a pure one not at all', () => {
	const et = beats(etFrequency(0), etFrequency(4));
	expect(et[0]).toMatchObject({ m: 5, n: 4 });
	expect(et[0].rate).toBeCloseTo(10.4, 1);
	const [p1, p2] = pairFrequencies(0, 4, 'pure');
	expect(beats(p1, p2)).toEqual([]);
	// the equal-tempered fifth: harmonics 3 and 2 drift by under a beat a second
	expect(beats(etFrequency(0), etFrequency(7))[0].rate).toBeCloseTo(0.89, 2);
	// two sine tones a semitone apart beat 15.6 times a second
	expect(etFrequency(1) - etFrequency(0)).toBeCloseTo(15.6, 1);
});

test('how the waves line up: an octave every cycle, a fifth every two, equal temperament never exactly', () => {
	const at = (k: number) => {
		const [f1, f2] = pairFrequencies(0, k, 'pure');
		return lineUp(f1, f2);
	};
	expect(at(12)).toEqual({ p: 2, q: 1 });
	expect(at(7)).toEqual({ p: 3, q: 2 });
	expect(at(4)).toEqual({ p: 5, q: 4 });
	expect(lineUp(etFrequency(0), etFrequency(7))).toBeNull();
	expect(lineUp(etFrequency(0), etFrequency(7), 3)).toEqual({ p: 3, q: 2 });
	// every interval's pure ratio is in lowest terms and inside the octave
	for (const iv of INTERVALS) {
		expect(iv.p / iv.q).toBeGreaterThanOrEqual(1);
		expect(iv.p / iv.q).toBeLessThanOrEqual(2);
		expect(Math.abs(cents(iv.p / iv.q) - 100 * iv.semis)).toBeLessThan(20);
	}
});
