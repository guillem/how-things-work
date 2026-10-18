// Checks the aperture-synthesis page's model against known results: an east–west baseline
// traces an ellipse of axis ratio sin δ centred on the origin, and any baseline an ellipse of the
// same ratio centred at v = (Z/λ) cos δ (Thompson, Moran & Swenson, eq. 4.3); a north–south
// baseline at transit is foreshortened by cos(δ − latitude); a source that never climbs 8° gives
// no samples; the sampling is its own mirror image, so the beam is real and peaks at 1; full
// coverage returns the sky exactly; a point source's dirty image is its flux times the beam; with
// no zero spacing the dirty image holds no total flux; two dishes make fringes λ/b apart; one dish
// has its Airy pattern (first null at 1.22 λ/D) and resolution about λ/D; an array's resolution is
// about λ/B_max; a double of equal points vanishes at u = 1/(2s); CLEAN recovers point sources; a
// spread array loses the disc a compact one keeps; and the real VLA D configuration's facts.
// Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ARCMIN,
	DU,
	HOUR,
	LAMBDA,
	LAT,
	N,
	PIX,
	cell,
	cleanBeam,
	cleanRun,
	cleanStart,
	convolve,
	dirtyBeam,
	dirtyImage,
	dishSampling,
	gaussianImage,
	grid,
	hourAngles,
	peak,
	pixel,
	restore,
	toEquatorial,
	total,
	tracks,
	uvw,
	visibilities,
	visibility1D,
	type Sampling
} from '../src/routes/aperture-synthesis/model';
import { DISC_CENTRE, layout, scaled, sky, spacings } from '../src/routes/aperture-synthesis/sky';
import { VLA_D } from '../src/routes/aperture-synthesis/vla';

const deg = Math.PI / 180;
const fullDay = Array.from({ length: 97 }, (_, i) => (-12 + i / 4) * HOUR);

test('an east–west baseline traces an ellipse of axis ratio sin δ', () => {
	const b = 400;
	for (const d of [20, 45, 70, 90]) {
		const dec = d * deg;
		const L = toEquatorial(b, 0, 0);
		const B = b / LAMBDA;
		let umax = 0;
		let vmax = 0;
		for (const H of fullDay) {
			const { u, v } = uvw(L, H, dec);
			expect((u / B) ** 2 + (v / (B * Math.sin(dec))) ** 2).toBeCloseTo(1, 9);
			umax = Math.max(umax, Math.abs(u));
			vmax = Math.max(vmax, Math.abs(v));
		}
		expect(vmax / umax).toBeCloseTo(Math.sin(dec), 6);
	}
	// at the celestial equator the track collapses to a line along u
	const eq = toEquatorial(b, 0, 0);
	for (const H of fullDay) expect(uvw(eq, H, 0).v).toBeCloseTo(0, 9);
});

test('any baseline traces an ellipse of ratio sin δ centred at v = (Z/λ) cos δ', () => {
	const L = toEquatorial(220, 310, 0);
	const dec = 35 * deg;
	const v0 = (L.Z / LAMBDA) * Math.cos(dec);
	const r2 = (L.X ** 2 + L.Y ** 2) / LAMBDA ** 2;
	for (const H of fullDay) {
		const { u, v } = uvw(L, H, dec);
		expect(u ** 2 + ((v - v0) / Math.sin(dec)) ** 2).toBeCloseTo(r2, 3);
	}
	// toward the pole the track is a circle about the origin
	for (const H of fullDay) {
		const { u, v } = uvw(L, H, 90 * deg);
		expect(Math.hypot(u, v)).toBeCloseTo(Math.sqrt(r2), 6);
	}
});

test('a north–south baseline at transit is foreshortened by cos(δ − latitude)', () => {
	const b = 500;
	const L = toEquatorial(0, b, 0);
	for (const d of [-20, 10, 34.08, 60]) {
		const s = uvw(L, 0, d * deg);
		expect(s.u).toBeCloseTo(0, 9);
		expect(s.v).toBeCloseTo((b / LAMBDA) * Math.cos(d * deg - LAT), 6);
	}
	// a source overhead sees the whole baseline, and no delay (w = 0)
	const z = uvw(L, 0, LAT);
	expect(z.v).toBeCloseTo(b / LAMBDA, 6);
	expect(z.w).toBeCloseTo(0, 6);
});

test('a source that never climbs 8° above the VLA’s horizon gives no samples', () => {
	// it culminates at 90° − 34.08° − 50° ≈ 6°
	expect(hourAngles(12, -50 * deg)).toHaveLength(0);
	// a source at +40° is up for the whole of a 6-hour track, every 5 minutes
	expect(hourAngles(6, 40 * deg)).toHaveLength(73);
});

/** The sampling of an array over a track. */
const sample = (name: Parameters<typeof layout>[0], hours: number, dec = 40 * deg, f = 1) =>
	grid(tracks(scaled(layout(name), f), dec, hourAngles(hours, dec)));

test('the sampling is its own mirror image, so the beam is real, symmetric and peaks at 1', () => {
	const s = sample('vla12', 6);
	for (let iv = -N / 2 + 1; iv < N / 2; iv++)
		for (let iu = -N / 2 + 1; iu < N / 2; iu++) expect(s.w[cell(iu, iv)]).toBe(s.w[cell(-iu, -iv)]);
	const b = dirtyBeam(s);
	expect(b[pixel(0, 0)]).toBeCloseTo(1, 12);
	expect(peak(b).index).toBe(pixel(0, 0));
	for (const [x, y] of [
		[3, 1],
		[-7, 12],
		[20, -5]
	])
		expect(b[pixel(x, y)]).toBeCloseTo(b[pixel(-x, -y)], 12);
});

test('full coverage of the uv plane gives back the sky exactly', () => {
	const all: Sampling = {
		w: new Float64Array(N * N).fill(1),
		cells: N * N,
		samples: 0,
		outside: 0,
		uvMin: 0,
		uvMax: 0
	};
	const truth = sky('galaxy');
	const d = dirtyImage(visibilities(truth), all);
	for (let i = 0; i < d.length; i += 97) expect(d[i]).toBeCloseTo(truth[i], 10);
});

test('a point source’s dirty image is its flux times the dirty beam, centred on it', () => {
	const s = sample('vla12', 6);
	const truth = new Float64Array(N * N);
	truth[pixel(10, -6)] = 2.5;
	const d = dirtyImage(visibilities(truth), s);
	const b = dirtyBeam(s);
	expect(d[pixel(10, -6)]).toBeCloseTo(2.5, 10);
	for (const [x, y] of [
		[0, 0],
		[14, -2],
		[-30, 25]
	])
		expect(d[pixel(x, y)]).toBeCloseTo(2.5 * b[pixel(x - 10, y + 6)], 10);
});

test('without the zero spacing the dirty image holds no total flux', () => {
	const s = sample('vla27', 6);
	expect(s.w[cell(0, 0)]).toBe(0);
	const d = dirtyImage(visibilities(sky('disc')), s);
	expect(Math.abs(total(d))).toBeLessThan(1e-9);
	expect(total(sky('disc'))).toBeCloseTo(4, 10); // 3 Jy disc + 1 Jy point
});

test('two dishes make fringes λ/b apart on the sky', () => {
	const pair = [
		{ e: -200, n: 0 },
		{ e: 200, n: 0 }
	];
	// a snapshot at transit, source overhead: u = 400 m / λ, v = 0
	const s = grid(tracks(pair, LAT, [0]));
	expect(s.cells).toBe(2);
	const b = dirtyBeam(s);
	const iu = Math.round(400 / LAMBDA / DU);
	for (let x = -N / 2; x < N / 2; x++) {
		expect(b[pixel(x, 0)]).toBeCloseTo(Math.cos((2 * Math.PI * iu * x) / N), 10);
		expect(b[pixel(x, 17)]).toBeCloseTo(b[pixel(x, 0)], 10); // stripes: the same on every row
	}
	// one period of the stripes is N/iu pixels: λ/b = 1.8′
	expect((N / iu) * PIX).toBeCloseTo(LAMBDA / 400, 4);
	expect(LAMBDA / 400 / ARCMIN).toBeCloseTo(1.8, 1);
});

test('one filled dish has its Airy pattern: first null at 1.22 λ/D, half width about λ/D', () => {
	const D = 400;
	const b = dirtyBeam(dishSampling(D));
	// radial cut along l: the first minimum, near zero, at 1.22 λ/D
	let xmin = 1;
	while (b[pixel(xmin + 1, 0)] < b[pixel(xmin, 0)]) xmin++;
	expect(Math.abs(xmin * PIX - (1.22 * LAMBDA) / D)).toBeLessThan(PIX);
	expect(Math.abs(b[pixel(xmin, 0)])).toBeLessThan(0.03);
	const g = cleanBeam(dishSampling(D));
	expect(g.major / (LAMBDA / D)).toBeGreaterThan(0.95);
	expect(g.major / (LAMBDA / D)).toBeLessThan(1.15);
	expect(g.minor / g.major).toBeGreaterThan(0.97);
});

test('an array resolves about λ / B_max, the width of a dish as wide as the array', () => {
	const ds = layout('vla27');
	const s = sample('vla27', 6, 90 * deg);
	const g = cleanBeam(s);
	const ratio = g.major / (LAMBDA / spacings(ds).max);
	expect(ratio).toBeGreaterThan(0.6);
	expect(ratio).toBeLessThan(1.3);
	// half the size, twice the beam
	const half = cleanBeam(sample('vla27', 6, 90 * deg, 0.5));
	expect(half.major / g.major).toBeGreaterThan(1.8);
	expect(half.major / g.major).toBeLessThan(2.2);
});

test('an equal double vanishes at baselines where its fringes cancel: u = 1/(2s)', () => {
	const s = 3 * ARCMIN;
	const src = [
		{ l: -s / 2, flux: 1 },
		{ l: s / 2, flux: 1 }
	];
	const at = (u: number) => Math.hypot(visibility1D(src, u).re, visibility1D(src, u).im);
	expect(at(0)).toBeCloseTo(2, 12);
	expect(at(1 / (2 * s))).toBeCloseTo(0, 10);
	expect(at(1 / s)).toBeCloseTo(2, 10);
	// a single source keeps the same fringe height on every baseline
	for (const u of [100, 1234, 5000]) {
		const v = visibility1D([{ l: s, flux: 0.7 }], u);
		expect(Math.hypot(v.re, v.im)).toBeCloseTo(0.7, 12);
	}
});

test('CLEAN finds the point sources: flux and position', () => {
	const s = sample('vla12', 6);
	const truth = sky('points');
	const d = dirtyImage(visibilities(truth), s);
	const c = cleanRun(cleanStart(d), dirtyBeam(s), 3000, 0.1, 0.005);
	expect(total(c.model)).toBeCloseTo(total(truth), 1);
	// every true source pixel holds its flux in components within 3%
	for (let i = 0; i < truth.length; i++)
		if (truth[i] > 0) expect(Math.abs(c.model[i] - truth[i]) / truth[i]).toBeLessThan(0.03);
	expect(Math.abs(peak(c.residual).value)).toBeLessThanOrEqual(0.005);
	// restored: a point of 1 Jy reads 1 Jy/beam
	const r = restore(c, cleanBeam(s));
	expect(r[pixel(0, 0)]).toBeCloseTo(1, 1);
});

test('spreading the array loses the disc that a compact array keeps', () => {
	const truth = sky('disc');
	const V = visibilities(truth);
	const pixArcmin = PIX / ARCMIN;
	const centre = pixel(
		Math.round(DISC_CENTRE.x / pixArcmin),
		Math.round(DISC_CENTRE.y / pixArcmin)
	);
	const kept = (f: number) => {
		const s = sample('vla12', 6, 40 * deg, f);
		const ideal = convolve(truth, gaussianImage(cleanBeam(s)));
		return dirtyImage(V, s)[centre] / ideal[centre];
	};
	// at half size the shortest spacing is 50 m (λ/b = 14′) and much of the 6′ disc survives;
	// at full size it is 100 m and the disc all but disappears
	expect(kept(0.5)).toBeGreaterThan(0.35);
	expect(kept(1)).toBeLessThan(0.15);
	expect(kept(1.25)).toBeLessThan(0.15);
});

test('the VLA’s D configuration: 27 pads on three arms, longest baseline 1.03 km', () => {
	expect(VLA_D).toHaveLength(27);
	expect(spacings(VLA_D.map((p) => ({ e: p.e, n: p.n }))).max / 1000).toBeCloseTo(1.03, 2);
	// the outermost pads lie about 120° apart in azimuth
	const az = ['W09', 'E09', 'N09'].map((n) => {
		const p = VLA_D.find((q) => q.name === n)!;
		return (Math.atan2(p.e, p.n) / deg + 360) % 360;
	});
	az.sort((a, b) => a - b);
	for (const gap of [az[1] - az[0], az[2] - az[1], 360 + az[0] - az[2]]) {
		expect(Math.abs(gap - 120)).toBeLessThan(12);
	}
	// the grid holds the whole configuration, at every declination
	expect(sample('vla27', 12, 40 * deg).outside).toBe(0);
});
