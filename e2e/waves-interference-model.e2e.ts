// Checks the wave model behind the waves-interference explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	A2,
	GUITAR_SCALE,
	SOUND_SPEED,
	amplitudeAt,
	dopplerAhead,
	dopplerBehind,
	farAngle,
	fundamental,
	harmonicFrequency,
	hyperbola,
	loudOrders,
	nodes,
	passBy,
	pathDifference,
	pluckAmplitude,
	pluckedString,
	quietOrders,
	speedOfSound,
	standing,
	stringWaveSpeed,
	travelling,
	travellingHalves,
	wavelength
} from '../src/routes/waves-interference/waves';

test('sound travels at 340.3 m/s at 15 °C (ISO standard atmosphere) and 343 m/s at 20 °C', () => {
	expect(speedOfSound(15)).toBeCloseTo(340.29, 1);
	expect(SOUND_SPEED).toBeCloseTo(343.2, 1);
	expect(speedOfSound(0)).toBeCloseTo(331.3, 0);
});

test('a wave covers one wavelength per period: v = f·λ', () => {
	// A 343 Hz note in air at 20 °C is about a metre long.
	expect(wavelength(SOUND_SPEED, 343)).toBeCloseTo(1, 2);
	// The rope: a point one wavelength from the hand moves in step with it,
	// half a wavelength away it moves the opposite way.
	const f = 1.5;
	const v = 2;
	const lam = wavelength(v, f);
	const t = 3.1;
	expect(travelling(lam, t, f, v)).toBeCloseTo(travelling(0, t, f, v), 10);
	expect(travelling(lam / 2, t, f, v)).toBeCloseTo(-travelling(0, t, f, v), 10);
	// Ahead of the front the rope has not moved yet.
	expect(travelling(v * t + 0.01, t, f, v)).toBe(0);
});

test('two sources 3 wavelengths apart give 6 quiet lines; closer than λ/2, none', () => {
	expect(quietOrders(3, 1)).toEqual([-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]);
	expect(quietOrders(0.4, 1)).toEqual([]);
	expect(loudOrders(3, 1)).toEqual([-2, -1, 0, 1, 2]);
	// Halving the wavelength (or doubling the spacing) roughly doubles the lines.
	expect(quietOrders(3, 0.5)).toHaveLength(12);
	// Far away the first quiet line is at sin θ = λ / 2d: 30° when d = λ.
	expect(farAngle(0.5, 1, 1)).toBeCloseTo(30, 10);
});

test('along a quiet line in the ripple tank the water is almost still', () => {
	const lambda = 2; // cm
	const s1 = { x: 0, y: -3 };
	const s2 = { x: 0, y: 3 }; // 6 cm apart: 3 wavelengths
	const single = (p: { x: number; y: number }) =>
		amplitudeAt(p, [s1], lambda).size + amplitudeAt(p, [s2], lambda).size;
	for (const order of quietOrders(6, lambda)) {
		const line = hyperbola(s1, s2, order * lambda, 2.5);
		for (const p of line) {
			// Every point of the drawn line has the path difference it should.
			expect(pathDifference(p, s1, s2)).toBeCloseTo(order * lambda, 8);
			// The two waves (with their 1/√r fall-off) nearly cancel there.
			if (Math.hypot(p.x, p.y) > 15)
				expect(amplitudeAt(p, [s1, s2], lambda).size).toBeLessThan(0.1 * single(p));
		}
	}
	// On the centre line they arrive together and the motion doubles.
	const p = { x: 20, y: 0 };
	expect(amplitudeAt(p, [s1, s2], lambda).size).toBeCloseTo(single(p), 10);
});

test("a guitar's A string: harmonics at whole multiples of 110 Hz", () => {
	const v = stringWaveSpeed(GUITAR_SCALE, A2);
	expect(v).toBeCloseTo(143, 0);
	expect(fundamental(GUITAR_SCALE, v)).toBeCloseTo(110, 10);
	expect([1, 2, 3, 4].map((n) => harmonicFrequency(n, GUITAR_SCALE, v))).toEqual([
		110, 220, 330, 440
	]);
	// Pressing the 12th fret halves the string and raises the note an octave.
	expect(fundamental(GUITAR_SCALE / 2, v)).toBeCloseTo(220, 10);
});

test('a standing wave is two travelling waves, with still points every half wavelength', () => {
	const n = 3;
	for (const u of nodes(n))
		for (const ph of [0, 1, 2.5]) expect(standing(n, u, ph)).toBeCloseTo(0, 10);
	for (const [u, ph] of [
		[0.1, 0.4],
		[0.45, 2],
		[0.8, 5]
	]) {
		const h = travellingHalves(n, u, ph);
		expect(h.left + h.right).toBeCloseTo(standing(n, u, ph), 10);
	}
});

test('a plucked string starts as a triangle and flips over every half period', () => {
	const p = 0.2;
	// At release the harmonics add up to the triangle: height 1 at the pluck point.
	expect(pluckedString(p, 0, p, 1, 400)).toBeCloseTo(1, 2);
	expect(pluckedString(0.6, 0, p, 1, 400)).toBeCloseTo((1 - 0.6) / (1 - p), 2);
	// Half a period later it is the same triangle upside down and mirrored.
	for (const u of [0.1, 0.5, 0.8])
		expect(pluckedString(u, 0.5, p, 1, 400)).toBeCloseTo(-pluckedString(1 - u, 0, p, 1, 400), 2);
});

test('plucked in the middle, a string has no even harmonics; near the end it is brighter', () => {
	for (const n of [2, 4, 6]) expect(pluckAmplitude(n, 0.5)).toBeCloseTo(0, 10);
	expect(pluckAmplitude(3, 0.5)).not.toBeCloseTo(0, 3);
	const ratio = (p: number) => Math.abs(pluckAmplitude(5, p) / pluckAmplitude(1, p));
	expect(ratio(0.5)).toBeCloseTo(1 / 25, 10);
	expect(ratio(0.1)).toBeGreaterThan(3 * ratio(0.5));
});

test('Doppler: a 440 Hz horn at 30 m/s is heard at 482 Hz ahead and 405 Hz behind', () => {
	expect(dopplerAhead(440, 30, SOUND_SPEED)).toBeCloseTo(482.1, 1);
	expect(dopplerBehind(440, 30, SOUND_SPEED)).toBeCloseTo(404.6, 1);
	// At half the speed of sound: twice the pitch ahead, two thirds behind.
	expect(dopplerAhead(440, 0.5 * 343, 343)).toBeCloseTo(880, 8);
	expect(dopplerBehind(440, 0.5 * 343, 343)).toBeCloseTo(293.33, 2);
});

test('a passing car: high, then exactly the true pitch, then low', () => {
	const c = SOUND_SPEED;
	const d = 10;
	const early = passBy(440, 30, c, d, -60).f;
	const late = passBy(440, 30, c, d, 60).f;
	expect(early).toBeCloseTo(dopplerAhead(440, 30, c), 0);
	expect(late).toBeCloseTo(dopplerBehind(440, 30, c), 0);
	// The sound sent at the closest point arrives d/c later, at the true pitch.
	const mid = passBy(440, 30, c, d, d / c);
	expect(mid.emitted).toBeCloseTo(0, 10);
	expect(mid.f).toBeCloseTo(440, 10);
	// The pitch only ever falls.
	let prev = Infinity;
	for (let t = -5; t <= 5; t += 0.05) {
		const f = passBy(440, 30, c, d, t).f;
		expect(f).toBeLessThan(prev);
		prev = f;
	}
});
