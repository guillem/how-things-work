// The ear at level 0: the middle ear's push concentration and the cochlea's place-by-pitch map
// (the level-3 cochlea model), checked against textbook and measured values.
import { expect, test } from '@playwright/test';
import {
	AIR_TO_WATER,
	AREA_RATIO,
	LEVER,
	SOFT,
	bumps,
	dbRe,
	gainDb,
	loudnessName,
	peakCm,
	pitchHz,
	respond,
	shakenMm,
	shakes,
	together,
	windowPush
} from '../src/routes/hearing-and-the-ear/model';

test('high notes peak near the entrance, low notes at the far end, 1,000 a second about 2 cm in', () => {
	const places = [125, 250, 500, 1000, 2000, 4000, 8000].map((f) => peakCm(respond(f, SOFT)));
	for (let i = 1; i < places.length; i++) expect(places[i]).toBeLessThan(places[i - 1]);
	// Greenwood's human map puts 1 kHz 21 mm from the base of a 35 mm cochlea.
	expect(peakCm(respond(1000, SOFT))).toBeCloseTo(2.1, 1);
	// The slider's ends: the lowest note near the far end, the highest within 2 mm of the entrance.
	expect(peakCm(respond(pitchHz(0), SOFT))).toBeGreaterThan(3.3);
	expect(peakCm(respond(pitchHz(9), SOFT))).toBeLessThan(0.2);
});

test('in the middle of the range each doubling of the pitch moves the peak about 4 to 5 mm', () => {
	for (const f of [500, 1000, 2000, 4000]) {
		const mm = 10 * (peakCm(respond(f, SOFT)) - peakCm(respond(2 * f, SOFT)));
		expect(mm).toBeGreaterThan(3.5);
		expect(mm).toBeLessThan(5.5);
	}
});

test('the big eardrum, not the bones, gives most of the middle ear’s boost: about 22 times', () => {
	expect(AREA_RATIO).toBeGreaterThan(15);
	expect(AREA_RATIO).toBeLessThan(20);
	expect(LEVER).toBeLessThan(1.5);
	expect(windowPush('ear')).toBeGreaterThan(20);
	expect(windowPush('ear')).toBeLessThan(25);
	// An eardrum no bigger than the window leaves only the lever's third or so.
	expect(windowPush('small')).toBe(LEVER);
	expect(windowPush('none')).toBe(1);
	// About 27 dB: the textbook "25 to 30 dB" of the middle ear's ideal pressure gain.
	expect(gainDb(windowPush('ear'))).toBeGreaterThan(25);
	expect(gainDb(windowPush('ear'))).toBeLessThan(30);
	// Without it, a talking voice pushes on the window like a whisper does.
	expect(loudnessName(60 - gainDb(windowPush('ear')))).toBe('a whisper');
});

test('sound in air meeting water head on: about 999 parts in 1,000 bounce off', () => {
	expect(AIR_TO_WATER).toBeGreaterThan(0.0009);
	expect(AIR_TO_WATER).toBeLessThan(0.0013);
});

test('two notes an octave apart make two bumps, each at its own note’s place', () => {
	for (const [a, b] of [
		[500, 1000],
		[1000, 2000],
		[2000, 4000],
		[500, 4000]
	]) {
		const ra = respond(a, SOFT);
		const rb = respond(b, SOFT);
		const two = bumps([ra, rb]);
		expect(two).toHaveLength(2);
		expect(two[0]).toBeCloseTo(peakCm(rb), 1);
		expect(two[1]).toBeCloseTo(peakCm(ra), 1);
	}
	// One note, one bump; two notes a semitone apart blur into one.
	expect(bumps([respond(1000, SOFT)])).toHaveLength(1);
	expect(bumps([respond(1000, SOFT), respond(1059, SOFT)])).toHaveLength(1);
});

test('turned up from rustling leaves to a lawnmower, the bump grows many times but moves less than an octave does', () => {
	const soft = respond(1000, 20);
	const loud = respond(1000, 90);
	const growth = dbRe(loud.mag[loud.peak]) - dbRe(soft.mag[soft.peak]);
	// The sound's push grows 70 dB (about 3,000 times); the ribbon's shake grows by much less,
	// squeezed (0.2 to 0.5 dB per dB at mid levels in measured cochleas), but still many times.
	expect(growth).toBeGreaterThan(30);
	expect(growth).toBeLessThan(70);
	// The peak creeps towards the entrance (measured: about half an octave at high levels)...
	const moved = peakCm(soft) - peakCm(loud);
	expect(moved).toBeGreaterThan(0);
	// ...but by less than one octave of pitch moves it.
	expect(moved).toBeLessThan(peakCm(respond(1000, 20)) - peakCm(respond(2000, 20)));
	// A longer stretch of ribbon shakes enough to hear as the note gets louder (more dots light).
	expect(shakenMm([loud])).toBeGreaterThan(3 * shakenMm([soft]));
	expect(shakenMm([loud])).toBeLessThan(35);
	// The narrative: across the slider's pitches the shake grows "only about 200 to 500 times".
	for (const f of [62.5, 125, 250, 500, 1000, 2000, 4000, 8000]) {
		const a = respond(f, 20);
		const b = respond(f, 90);
		const times = Math.pow(10, (dbRe(b.mag[b.peak]) - dbRe(a.mag[a.peak])) / 20);
		expect(times).toBeGreaterThan(150);
		expect(times).toBeLessThan(550);
	}
});

test('the same note twice is one note pushing twice as hard: one bump, at the same spot', () => {
	const twice = together([
		{ f: 1000, level: SOFT },
		{ f: 1000, level: SOFT }
	]);
	expect(twice).toHaveLength(1);
	expect(twice[0].level).toBeCloseTo(SOFT + 6.02, 2);
	const r = respond(twice[0].f, twice[0].level);
	expect(bumps([r])).toHaveLength(1);
	expect(peakCm(r)).toBeCloseTo(peakCm(respond(1000, SOFT)), 1);
	// Different notes stay separate.
	expect(
		together([
			{ f: 1000, level: SOFT },
			{ f: 1059, level: SOFT }
		])
	).toHaveLength(2);
});

test('the pitch slider and its words', () => {
	expect(pitchHz(5)).toBe(1000);
	expect(shakes(1000)).toBe('1,000 times a second');
	expect(shakes(pitchHz(0))).toBe('31 times a second');
	// A semitone above 1,000 is told apart from it.
	expect(shakes(pitchHz(5 + 1 / 12))).toBe('1,060 times a second');
	expect(shakes(pitchHz(9))).toBe('16,000 times a second');
});
