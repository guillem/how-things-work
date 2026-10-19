// Checks the radar-sonar model against what radar and sonar are known to do: an echo's delay is
// the round trip at the speed of light; its power falls as 1/R⁴, so doubling the range costs
// 12 dB; a plain pulse resolves two targets only when they are farther apart than cτ/2, and
// shortening it costs energy at a fixed peak power; a chirp through its matched filter keeps
// the long pulse's energy and compresses to a peak about 1/B wide, resolving c/(2B); the echo's
// phase turns from pulse to pulse at the Doppler shift 2v/λ, and only the radial speed counts;
// the range-Doppler map lifts a moving target off the clutter that hides it in one pulse;
// seawater's sound speed matches Mackenzie's published check value; sound absorption climbs
// steeply with frequency; radio dies within metres in seawater. Seeded, so every number replays.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	C,
	RADAR,
	countEchoes,
	detections,
	dopplerShift,
	echo,
	maxSpeed,
	plateRcs,
	radialSpeed,
	rangeDoppler,
	rangeOf,
	skinDepth,
	slowTime,
	snrDb,
	soundAbsorption,
	soundSpeed,
	spectrum,
	type Waveform
} from '../src/routes/radar-sonar/model';

const FS = 40e6; // 3.75 m per sample
const maxOf = (y: ArrayLike<number>) => {
	let best = 0;
	for (let i = 1; i < y.length; i++) if (y[i] > y[best]) best = i;
	return best;
};
/** Width (m) of the peak at `i` where it falls `drop` dB below its top. */
const width = (y: ArrayLike<number>, i: number, drop: number, dr: number) => {
	let a = i;
	let b = i;
	while (a > 0 && y[a] > y[i] - drop) a--;
	while (b < y.length - 1 && y[b] > y[i] - drop) b++;
	return (b - a) * dr;
};

test('an echo heard t after the pulse left comes from c·t/2, and sits where the trace peaks', () => {
	expect(rangeOf(66.7e-6)).toBeCloseTo(10_000, -1); // 10 km is a 66.7 µs round trip
	const tr = echo({ kind: 'plain', duration: 1e-6 }, [{ r: 4200, rcs: 10 }], 0, 8000, FS);
	// the matched filter peaks where the echo begins: at the target's range
	expect(Math.abs(tr.range[maxOf(tr.out)] - 4200)).toBeLessThan(10);
});

test('the echo weakens as 1/R⁴: twice as far is 12 dB down', () => {
	const w: Waveform = { kind: 'plain', duration: 2e-6 };
	const near = echo(w, [{ r: 3000, rcs: 50 }], 2000, 4000, FS, { seed: 3 });
	const far = echo(w, [{ r: 6000, rcs: 50 }], 5000, 7000, FS, { seed: 3 });
	const drop = near.out[maxOf(near.out)] - far.out[maxOf(far.out)];
	expect(drop).toBeGreaterThan(11);
	expect(drop).toBeLessThan(13);
	// and the peak above the noise is the radar equation's signal-to-noise ratio
	expect(near.out[maxOf(near.out)]).toBeCloseTo(snrDb(3000, 50, 2e-6), 0);
});

test('a plain pulse of length τ resolves two targets only beyond cτ/2', () => {
	const tau = 2e-6; // cτ/2 = 300 m
	const two = (gap: number) =>
		echo(
			{ kind: 'plain', duration: tau },
			[
				{ r: 5000, rcs: 20 },
				{ r: 5000 + gap, rcs: 20, phase: Math.PI / 2 }
			],
			4000,
			6500,
			FS,
			{ seed: 5 }
		);
	expect(countEchoes(two(450).out, 10)).toBe(2);
	expect(countEchoes(two(200).out, 10)).toBe(1);
});

test('at a fixed peak power a shorter pulse carries less energy, and its echo sinks into the noise', () => {
	const target = [{ r: 9000, rcs: 0.1 }];
	const long = echo({ kind: 'plain', duration: 20e-6 }, target, 8000, 10000, FS / 4, { seed: 2 });
	const short = echo({ kind: 'plain', duration: 0.2e-6 }, target, 8000, 10000, FS / 4, { seed: 2 });
	// 100 times shorter, 20 dB less signal-to-noise
	expect(snrDb(9000, 0.1, 20e-6) - snrDb(9000, 0.1, 0.2e-6)).toBeCloseTo(20, 6);
	expect(long.out[maxOf(long.out)]).toBeGreaterThan(18);
	expect(countEchoes(short.out, 13)).toBe(0);
});

test('a chirp through its matched filter keeps the long pulse’s energy and compresses to ~1/B', () => {
	const B = 5e6;
	const T = 20e-6;
	const dr = C / (2 * FS);
	const one = [{ r: 9000, rcs: 0.1 }];
	const chirp = echo({ kind: 'chirp', duration: T, bandwidth: B }, one, 8500, 9500, FS, {
		seed: 4
	});
	const plainLong = echo({ kind: 'plain', duration: T }, one, 8500, 9500, FS, { seed: 4 });
	const plainShort = echo({ kind: 'plain', duration: 1 / B }, one, 8500, 9500, FS, { seed: 4 });
	const ic = maxOf(chirp.out);
	// the same peak signal-to-noise as a plain pulse of the same length (the same energy)...
	expect(Math.abs(chirp.out[ic] - plainLong.out[maxOf(plainLong.out)])).toBeLessThan(1.5);
	expect(chirp.out[ic] - plainShort.out[maxOf(plainShort.out)]).toBeGreaterThan(15);
	// ...and a main lobe about c/(2B) = 30 m wide at −4 dB (1/B in time), like the short pulse
	const wc = width(chirp.out, ic, 4, dr);
	expect(wc).toBeGreaterThan(20);
	expect(wc).toBeLessThan(42);
	const wl = width(plainLong.out, maxOf(plainLong.out), 4, dr);
	expect(wl).toBeGreaterThan(20 * wc); // the long plain pulse's triangle is kilometres wide
	// two targets 45 m apart (more than c/(2B) = 30 m) come out as two
	const pair = echo(
		{ kind: 'chirp', duration: T, bandwidth: B },
		[
			{ r: 9000, rcs: 1 },
			{ r: 9045, rcs: 1, phase: Math.PI / 2 }
		],
		8500,
		9500,
		FS,
		{ seed: 4 }
	);
	// (counting peaks within 10 dB of the top: a chirp's range sidelobes sit 13 dB down)
	expect(countEchoes(pair.out, pair.out[maxOf(pair.out)] - 10)).toBe(2);
	// the raw echoes overlap completely: 3 km long each
	expect(countEchoes(pair.raw, 15, 6)).toBeLessThanOrEqual(1);
});

test('pulse to pulse the echo’s phase turns at the Doppler shift 2v/λ', () => {
	expect(dopplerShift(30, RADAR.lambda)).toBeCloseTo(2001, -1); // 30 m/s at 10 GHz: 2 kHz
	for (const v of [-37.5, 0, 11.25, 30]) {
		const spec = spectrum(slowTime(6000, v), 128);
		const f = -RADAR.prf / 2 + (maxOf(spec) * RADAR.prf) / 128;
		expect(Math.abs(f - (2 * v) / RADAR.lambda)).toBeLessThanOrEqual(RADAR.prf / 128);
	}
	// faster than λ·prf/4 (60 m/s here) the shift wraps round and reads as the wrong speed
	expect(maxSpeed()).toBeCloseTo(59.96, 1);
	const wrapped = spectrum(slowTime(6000, 80), 128);
	const fw = -RADAR.prf / 2 + (maxOf(wrapped) * RADAR.prf) / 128;
	expect(Math.abs(fw - dopplerShift(80))).toBeGreaterThan(RADAR.prf / 2);
});

test('only the speed toward the radar counts: crossing the beam there is no shift', () => {
	expect(radialSpeed(50, 0)).toBe(50);
	expect(radialSpeed(50, 60)).toBeCloseTo(25, 9);
	expect(Math.abs(radialSpeed(50, 90))).toBeLessThan(1e-9);
	const spec = spectrum(slowTime(6000, radialSpeed(50, 90)), 128);
	expect(-RADAR.prf / 2 + (maxOf(spec) * RADAR.prf) / 128).toBe(0);
});

const TARGETS = [
	{ r: 3500, rcs: 5, v: 25 },
	{ r: 7100, rcs: 0.5, v: 12 },
	{ r: 11_000, rcs: 3, v: -45 }
];

test('in one pulse the clutter hides a small boat; the range-Doppler map lifts it off', () => {
	const map = rangeDoppler(TARGETS);
	const hits = detections(map, 13);
	for (const tg of TARGETS) {
		const hit = hits.find((h) => Math.abs(h.r - tg.r) < 300);
		expect(hit, `target at ${tg.r} m`).toBeDefined();
		expect(Math.abs(hit!.v - tg.v)).toBeLessThan(4); // one Doppler bin is 3.75 m/s
	}
	expect(hits.length).toBe(TARGETS.length); // no false alarms
	// in a single pulse the boat's cell doesn't stand out from the clutter around it
	const cell = map.ranges.findIndex((r) => Math.abs(r - 7100) < 100);
	const around = map.pulse.slice(cell - 5, cell + 6);
	expect(map.pulse[cell]).toBeLessThan(Math.max(...around.filter((_, k) => k !== 5)));
});

test('enough noise and the targets vanish one by one, the strongest last', () => {
	const found = (noise: number) =>
		detections(rangeDoppler(TARGETS, { extraNoiseDb: noise }), 13 + noise).map((h) => h.r);
	let last = 3;
	let lastOne: number[] = [];
	for (let noise = 0; noise <= 70; noise += 2) {
		const f = found(noise);
		expect(f.length).toBeLessThanOrEqual(last);
		if (f.length === 1) lastOne = f;
		last = f.length;
	}
	expect(last).toBe(0);
	expect(lastOne).toEqual([3500]); // the car: big and near
});

test('a flat plate echoes hugely face on, and tilting it sends the echo elsewhere', () => {
	const face = plateRcs(1, 0);
	expect(face).toBeCloseTo((4 * Math.PI) / RADAR.lambda ** 2, 0); // 4πA²/λ², ~14,000 m²
	expect(10 * Math.log10(face / plateRcs(1, 30))).toBeGreaterThan(30);
});

test('seawater sound speed: Mackenzie’s check value, and faster when warmer or deeper', () => {
	expect(soundSpeed(25, 35, 1000)).toBeCloseTo(1550.744, 3); // the paper's own check value
	expect(soundSpeed(0)).toBeCloseTo(1449, 0);
	expect(soundSpeed(20)).toBeGreaterThan(soundSpeed(5));
	expect(soundSpeed(4, 35, 4000)).toBeGreaterThan(soundSpeed(4, 35, 0));
	// about 200,000 times slower than light: a 10 km echo takes 13 s instead of 67 µs
	expect((2 * 10_000) / soundSpeed(15)).toBeCloseTo(13.3, 1);
});

test('sound absorption climbs steeply with frequency; radio dies within metres', () => {
	expect(soundAbsorption(1e3)).toBeLessThan(0.1); // dB/km
	expect(soundAbsorption(10e3)).toBeGreaterThan(0.7);
	expect(soundAbsorption(10e3)).toBeLessThan(1.5);
	expect(soundAbsorption(100e3)).toBeGreaterThan(25);
	// very low frequency radio reaches a submarine a few metres down; higher ones far less
	expect(skinDepth(10e3)).toBeGreaterThan(2);
	expect(skinDepth(10e3)).toBeLessThan(3);
	expect(skinDepth(100e6)).toBeLessThan(0.03);
});
