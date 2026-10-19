// Checks the model behind the Shazam explainer (Wang 2003's audio search at toy scale) against
// what the method must do: find the right clip in noise from a shifted start, at the right
// offset, and refuse what is not in the database. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BINS,
	BIN_HZ,
	CLIP_S,
	DB_SIZE,
	DEFAULT_RECORDING,
	FRAME_S,
	HASH_BITS,
	UNKNOWN,
	clipPrint,
	database,
	pack,
	record,
	render,
	search,
	spectrogram,
	unpack,
	type Recording
} from '../src/routes/shazam-audio-fingerprint/model';

const rec = (r: Partial<Recording>) => ({ ...DEFAULT_RECORDING, ...r });
const find = (r: Partial<Recording>) => search(record(rec(r)).samples);

test('the spectrogram puts a 1 kHz tone at 1 kHz', () => {
	const x = new Float32Array(8000);
	for (let i = 0; i < x.length; i++) x[i] = Math.sin((2 * Math.PI * 1000 * i) / 8000);
	const s = spectrogram(x);
	const row = s.db.subarray(10 * BINS, 11 * BINS);
	const loudest = row.indexOf(Math.max(...row));
	expect(loudest * BIN_HZ).toBeCloseTo(1000, -1);
});

test('a constellation keeps only a tiny fraction of the spectrogram', () => {
	for (let id = 0; id < DB_SIZE; id++) {
		const fp = clipPrint(id);
		const cells = fp.spec.frames * BINS;
		expect(fp.peaks.length / cells).toBeLessThan(0.005);
		// but enough of them: several peaks per second, spread over the whole clip
		expect(fp.peaks.length / CLIP_S).toBeGreaterThan(8);
		const seconds = new Set(fp.peaks.map((p) => Math.floor(p.t * FRAME_S)));
		expect(seconds.size).toBeGreaterThanOrEqual(CLIP_S - 1);
	}
});

test('a fingerprint is two pitches and a gap packed into one number, and back', () => {
	const h = pack(56, 71, 13);
	expect(h).toBeLessThan(2 ** HASH_BITS);
	expect(unpack(h)).toEqual({ f1: 56, f2: 71, dt: 13 });
	expect(pack(71, 56, 13)).not.toBe(h);
});

test('the fingerprints do not depend on where the recording starts (translation invariance)', () => {
	// an excerpt cut on a frame boundary gives the same hashes as the clip at the same places
	const start = 100 * FRAME_S;
	const clip = clipPrint(3);
	const excerpt = search(record(rec({ clip: 3, start, snrDb: Infinity, cough: false })).samples);
	const inClip = new Set(clip.hashes.map((h) => `${h.hash}@${h.t}`));
	const inner = excerpt.recording.hashes.filter((h) => h.t > 10 && h.t < 100);
	const same = inner.filter((h) => inClip.has(`${h.hash}@${h.t + 100}`)).length;
	expect(same / inner.length).toBeGreaterThan(0.9);
});

test('every clip is recognised with noise, a cough and a different start, at its true offset', () => {
	for (let clip = 0; clip < DB_SIZE; clip++)
		for (const start of [0.7, 3.3, 6.1]) {
			const r = find({ clip, start, snrDb: 5, cough: true, seed: clip + 1 });
			expect(r.winner, `clip ${clip} from ${start} s`).toBe(clip);
			// the histogram of time differences peaks where the recording began (within 50 ms)
			expect(Math.abs(r.matches[clip].offset * FRAME_S - start)).toBeLessThan(0.05);
		}
});

test('hits on the wrong clips scatter: their tallest bins stay low', () => {
	const r = find({});
	expect(r.winner).toBe(DEFAULT_RECORDING.clip);
	const right = r.matches[DEFAULT_RECORDING.clip];
	for (const m of r.matches) if (m !== right) expect(m.score * 3).toBeLessThanOrEqual(right.score);
	// some wrong clip still shares several hashes with the recording
	const wrongHits = Math.max(...r.matches.filter((m) => m !== right).map((m) => m.hits));
	expect(wrongHits).toBeGreaterThanOrEqual(5);
});

test('a tune that is not in the database gets no clear spike, wherever it is recorded', () => {
	for (const start of [0.5, 2.5, 4.5, 6.5]) {
		const r = find({ clip: UNKNOWN, start, snrDb: Infinity, cough: false });
		expect(r.winner).toBeNull();
		// it still shares hashes with the database: what fails is the alignment
		expect(r.matches.reduce((s, m) => s + m.hits, 0)).toBeGreaterThan(10);
	}
});

test('the same tune a semitone or a tone higher no longer matches', () => {
	for (const clip of [0, 4, 7, 11]) {
		const original = find({ clip, snrDb: Infinity, cough: false });
		for (const semitones of [1, 2]) {
			const r = find({ clip, version: 'higher', semitones, snrDb: Infinity, cough: false });
			expect(r.winner).toBeNull();
			expect(r.matches[clip].score * 5).toBeLessThan(original.matches[clip].score);
		}
	}
});

test('another band playing the same tune is not found', () => {
	for (const clip of [1, 4, 8]) {
		const r = find({ clip, version: 'cover', snrDb: Infinity, cough: false });
		expect(r.winner).toBeNull();
	}
});

test('turning the noise up makes the spike disappear', () => {
	const scores = [20, 5, -5, -15].map((snrDb) => find({ snrDb, cough: false }));
	expect(scores[0].winner).toBe(DEFAULT_RECORDING.clip);
	expect(scores[1].winner).toBe(DEFAULT_RECORDING.clip);
	expect(scores[3].winner).toBeNull();
	const own = scores.map((s) => s.matches[DEFAULT_RECORDING.clip].score);
	expect(own[0]).toBeGreaterThan(own[2]);
	expect(own[2]).toBeGreaterThan(own[3]);
});

test('a few seconds are enough, a fraction of a second is not', () => {
	expect(find({ seconds: 4, cough: false }).winner).toBe(DEFAULT_RECORDING.clip);
	expect(find({ seconds: 1, cough: false }).winner).toBeNull();
});

test('the recording is deterministic: the same settings give the same noise', () => {
	const a = record(rec({}));
	const b = record(rec({}));
	expect(a.samples).toEqual(b.samples);
	expect(record(rec({ seed: 2 })).samples).not.toEqual(a.samples);
	// and the database is built from the clips themselves
	expect(database().clips[2].hashes.length).toBe(clipPrint(2).hashes.length);
	expect(render(2).length).toBe(CLIP_S * 8000);
});
