// Checks the MRI k-space page's model against exact results: J₁ against its tabulated values;
// the analytic transform of the head against a finely sampled one; the 2-D Fourier transform's
// round trip; the k-space centre as the image's total signal; a uniform region reconstructed at its
// own value; a single k-space sample spread over every pixel; wrap-around (a disc beyond half the
// field of view reappears exactly one field of view away) and the fold of a scan that skips every
// other line; the centre carrying the contrast; the spin echo's height e^(−TE/T2); the slice
// thickness bandwidth / (γG); and the tissue values against the literature. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	GAMMA_HZ_T,
	acquire,
	besselJ1,
	centreOnly,
	dft2,
	edgesOnly,
	everyNthLine,
	gradientAreaFor,
	lorentzSpread,
	magnitude,
	netSignal,
	objectFT,
	pixelAt,
	reconstruct,
	singleSample,
	sliceThicknessMm,
	slicePositionMm,
	spinEchoState,
	swapCentre,
	tipAt,
	firstLines,
	type KSpace
} from '../src/routes/mri-k-space/model';
import {
	LANDMARKS,
	head,
	spinEchoSignal,
	t1Ms,
	t2Ms,
	valueAt,
	WEIGHTINGS,
	type Ellipse
} from '../src/routes/mri-k-space/phantom';

const N = 128;
const FOV = 24;
const t2 = head('t2');
const t1 = head('t1');
const kT2 = acquire(t2, N, N, FOV, FOV);
const kT1 = acquire(t1, N, N, FOV, FOV);
const mag = (k: KSpace) => {
	const img = reconstruct(k);
	return { img, m: magnitude(img) };
};
const full = mag(kT2);
const at = (r: ReturnType<typeof mag>, p: { x: number; y: number }) =>
	pixelAt(r.img, r.m, p.x, p.y);

test('J₁ matches its tables', () => {
	// Abramowitz & Stegun, Table 9.1, and the first zero j₁,₁ = 3.8317060
	expect(besselJ1(1)).toBeCloseTo(0.4400505857, 7);
	expect(besselJ1(2.5)).toBeCloseTo(0.4970941025, 7);
	expect(besselJ1(5)).toBeCloseTo(-0.3275791376, 7);
	expect(besselJ1(10)).toBeCloseTo(0.0434727462, 7);
	expect(Math.abs(besselJ1(3.831706))).toBeLessThan(1e-6);
});

test('the analytic transform of the head equals a finely sampled one', () => {
	// Riemann sum of f(r) e^(−2πi k·r) on a 0.05 cm grid
	const h = 0.05;
	const ks: [number, number][] = [
		[0, 0],
		[0.1, 0],
		[0, 0.2],
		[-0.15, 0.25]
	];
	for (const [kx, ky] of ks) {
		let re = 0;
		let im = 0;
		for (let x = -10 + h / 2; x < 10; x += h) {
			for (let y = -10 + h / 2; y < 10; y += h) {
				const v = valueAt(t2, x, y);
				if (!v) continue;
				const a = -2 * Math.PI * (kx * x + ky * y);
				re += v * Math.cos(a) * h * h;
				im += v * Math.sin(a) * h * h;
			}
		}
		const [ar, ai] = objectFT(t2, kx, ky);
		const scale = Math.abs(objectFT(t2, 0, 0)[0]);
		expect(Math.abs(ar - re) / scale).toBeLessThan(2e-3);
		expect(Math.abs(ai - im) / scale).toBeLessThan(2e-3);
	}
});

test('the 2-D Fourier transform and its inverse give back the image', () => {
	for (const [nx, ny] of [
		[16, 16],
		[16, 12],
		[8, 9]
	]) {
		const re = Float64Array.from({ length: nx * ny }, (_, i) => Math.sin(i * 1.3) + (i % 5));
		const im = Float64Array.from({ length: nx * ny }, (_, i) => Math.cos(i * 0.7));
		const f = dft2(re, im, nx, ny, -1);
		const b = dft2(f.re, f.im, nx, ny, 1);
		for (let i = 0; i < re.length; i++) {
			expect(b.re[i] / (nx * ny)).toBeCloseTo(re[i], 10);
			expect(b.im[i] / (nx * ny)).toBeCloseTo(im[i], 10);
		}
	}
});

test('the centre of k-space is the whole slice’s signal, and a uniform region comes back at its value', () => {
	// F(0, 0) = ∫ f: the sum of the ellipses' values × π a b
	const total = t2.reduce((s, e) => s + e.value * Math.PI * e.a * e.b, 0);
	expect(kT2.re[(N / 2) * N + N / 2]).toBeCloseTo(total, 9);
	// inside regions, the reconstruction gives the tissue's signal (Gibbs ripples aside)
	for (const p of Object.values(LANDMARKS).slice(0, 3)) {
		expect(Math.abs(at(full, p) - valueAt(t2, p.x, p.y))).toBeLessThan(0.03);
	}
});

test('a single point of k-space is a wave over the whole image, not a pixel', () => {
	const one = mag(singleSample(kT2, 5, -3));
	const first = one.m[0];
	expect(first).toBeGreaterThan(0);
	for (const v of one.m) expect(v).toBeCloseTo(first, 12);
});

test('a field of view smaller than the head wraps it round, one field of view away', () => {
	// a disc 7 cm below the centre, scanned with a 10 cm field of view in y, gives exactly the
	// samples of a disc at 7 − 10 = −3 cm: the scanner cannot tell them apart
	const disc = (y0: number): Ellipse[] => [{ x0: 0, y0, a: 1.5, b: 1.5, phi: 0, value: 1 }];
	const below = acquire(disc(7), 64, 40, 16, 10);
	const wrapped = acquire(disc(-3), 64, 40, 16, 10);
	for (let i = 0; i < below.re.length; i++) {
		expect(below.re[i]).toBeCloseTo(wrapped.re[i], 10);
		expect(below.im[i]).toBeCloseTo(wrapped.im[i], 10);
	}
	const r = mag(below);
	expect(Math.abs(pixelAt(r.img, r.m, 0, -3) - 1)).toBeLessThan(0.1);
	expect(pixelAt(r.img, r.m, 0, 3)).toBeLessThan(0.05);
	// the head (19 cm tall) in a 16 cm field of view: the top of the scalp lands 16 cm lower,
	// on top of the brain there
	const small = mag(acquire(t2, N, 85, FOV, 16));
	const y = -9.35 + 16;
	const expected = valueAt(t2, 0, y) + valueAt(t2, 0, -9.35);
	expect(Math.abs(pixelAt(small.img, small.m, 0, y) - expected)).toBeLessThan(0.08);
	expect(Math.abs(at(full, { x: 0, y }) - valueAt(t2, 0, y))).toBeLessThan(0.05);
});

test('skipping every other line folds the image onto itself at half the field of view', () => {
	const half = reconstruct(everyNthLine(kT2, 2));
	const img = reconstruct(kT2);
	// with lines 2 apart, each pixel is the mean of the image there and half a field of view away
	for (const r of [10, 40, 64, 100]) {
		for (const c of [20, 64, 90]) {
			const r2 = (r + N / 2) % N;
			expect(half.re[r * N + c]).toBeCloseTo((img.re[r * N + c] + img.re[r2 * N + c]) / 2, 9);
			expect(half.im[r * N + c]).toBeCloseTo((img.im[r * N + c] + img.im[r2 * N + c]) / 2, 9);
		}
	}
});

test('the centre of k-space carries the contrast, the edges the outlines', () => {
	const vent = LANDMARKS.ventricle;
	const centre = mag(centreOnly(kT2, 0.15));
	const edges = mag(edgesOnly(kT2, 0.15));
	// 15% of k-space keeps the ventricle's brightness within 25%; the edges keep almost none of it
	expect(Math.abs(at(centre, vent) / at(full, vent) - 1)).toBeLessThan(0.25);
	expect(at(edges, vent) / at(full, vent)).toBeLessThan(0.15);
	// the T2-weighted centre with T1-weighted edges looks T2-weighted: fluid bright
	const t1full = mag(kT1);
	const mixed = mag(swapCentre(kT2, kT1, 0.15));
	const v = at(mixed, vent);
	expect(Math.abs(v - at(full, vent))).toBeLessThan(Math.abs(v - at(t1full, vent)) / 4);
});

test('recording only the outer lines first leaves almost no image', () => {
	const vent = LANDMARKS.ventricle;
	const quarter = mag(firstLines(kT2, N / 4, 'linear'));
	const centreFirst = mag(firstLines(kT2, N / 4, 'centre'));
	expect(at(quarter, vent)).toBeLessThan(0.1 * at(full, vent));
	expect(at(centreFirst, vent)).toBeGreaterThan(0.75 * at(full, vent));
});

test('tissue values sit in the published ranges at 1.5 T, and the weightings look as they should', () => {
	// grey matter T1 ≈ 0.9–1.1 s, white matter 0.6–0.8 s, CSF ≈ 4 s; fat-rich scalp 0.25–0.4 s
	expect(t1Ms('grey')).toBeGreaterThan(900);
	expect(t1Ms('grey')).toBeLessThan(1100);
	expect(t1Ms('white')).toBeGreaterThan(600);
	expect(t1Ms('white')).toBeLessThan(800);
	expect(t1Ms('scalp')).toBeLessThan(400);
	expect(t2Ms('csf')).toBeGreaterThan(1000);
	const s = (w: 't1' | 't2', t: Parameters<typeof spinEchoSignal>[0]) =>
		spinEchoSignal(t, WEIGHTINGS[w].tr, WEIGHTINGS[w].te);
	// T1-weighted: white matter brighter than grey, fluid dark; T2-weighted: fluid brightest
	expect(s('t1', 'white')).toBeGreaterThan(s('t1', 'grey'));
	expect(s('t1', 'csf')).toBeLessThan(s('t1', 'grey'));
	expect(s('t2', 'csf')).toBeGreaterThan(s('t2', 'grey'));
	expect(s('t2', 'grey')).toBeGreaterThan(s('t2', 'white'));
});

test('a 180° pulse refocuses the spins into an echo of height e^(−TE/T2)', () => {
	const offsets = lorentzSpread(2001, 20); // T2* much shorter than T2
	const T2 = 0.1;
	const tau = 0.025;
	const echo = netSignal(spinEchoState(offsets, 2 * tau, tau, true, 1, T2));
	expect(echo).toBeCloseTo(Math.exp((-2 * tau) / T2), 3);
	// without the pulse the signal has gone: e^(−t/T2*), 1/T2* = 1/T2 + 2π·20 Hz
	const fid = netSignal(spinEchoState(offsets, 2 * tau, tau, false, 1, T2));
	const t2star = 1 / (1 / T2 + 2 * Math.PI * 20);
	expect(fid).toBeLessThan(0.01);
	const early = netSignal(spinEchoState(offsets, 0.004, tau, false, 1, T2));
	expect(early).toBeCloseTo(Math.exp(-0.004 / t2star), 1);
});

test('the pulse tips a slice bandwidth / (γ G) thick, moved by its frequency', () => {
	const G = 10; // mT/m
	const thick = sliceThicknessMm(G);
	expect(thick).toBeCloseTo((1000 / (42.577e6 * 0.01)) * 1000, 2); // 1 kHz / 425.8 kHz/m ≈ 2.35 mm
	// full width at half the peak, from the Bloch simulation
	const zs = Array.from({ length: 801 }, (_, i) => -4 + i * 0.01);
	const tips = zs.map((z) => tipAt(z, G, 0));
	expect(Math.max(...tips)).toBeCloseTo(1, 2); // a 90° pulse at the centre
	const inside = zs.filter((_, i) => tips[i] >= 0.5);
	const fwhm = inside[inside.length - 1] - inside[0];
	expect(Math.abs(fwhm / thick - 1)).toBeLessThan(0.1);
	// far outside the slice, nothing is tipped
	expect(tipAt(3 * thick, G, 0)).toBeLessThan(0.02);
	// sending the pulse 2 kHz higher moves the slice by 2000 / (γ G)
	const shift = slicePositionMm(G, 2000);
	expect(tipAt(shift, G, 2000)).toBeCloseTo(1, 2);
	expect(shift).toBeCloseTo((2000 / (GAMMA_HZ_T * 0.01)) * 1000, 6);
});

test('phase encoding a 24 cm field of view takes about 0.1 mT/m·ms per line', () => {
	// Δk = 1/FOV; area = Δk / γ = (1/0.24 m) / 42.58 MHz/T ≈ 0.098 mT/m·ms
	expect(gradientAreaFor(1 / 24)).toBeCloseTo(0.0979, 3);
});
