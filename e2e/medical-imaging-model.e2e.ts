// Checks the X-ray, CT, ultrasound and MRI physics behind the medical-imaging explainer.
// Runs in Node.
import { expect, test } from '@playwright/test';
import { TISSUE } from '../src/routes/medical-imaging/tissues';
import {
	BODY,
	CT_KEV,
	DOSES_MSV,
	POINT,
	SHEPP_LOGAN,
	backgroundDays,
	bodySlice,
	discMean,
	fittedError,
	echoes,
	gradientEcho,
	halfValueLayer,
	hounsfield,
	kHzPerCm,
	larmorMHz,
	mu,
	partScale,
	radiographAt,
	reconstruct,
	relativeError,
	scan,
	spinEcho,
	transmitted,
	truth
} from '../src/routes/medical-imaging/imaging';

const muW = mu('water', CT_KEV);
const HU = (v: number) => hounsfield(v, muW);

test.describe('X-ray attenuation (NIST coefficients)', () => {
	test('μ of water reproduces the NIST table at its own energies', () => {
		expect(mu('water', 60)).toBeCloseTo(0.2059, 4);
		expect(mu('water', 100)).toBeCloseTo(0.1707, 4);
		// Bone: 0.3148 cm²/g × 1.92 g/cm³.
		expect(mu('bone', 60)).toBeCloseTo(0.6044, 3);
	});

	test('half the photons cross one half-value layer, a quarter two', () => {
		const m = mu('soft', 60);
		const hvl = halfValueLayer(m);
		expect(hvl).toBeCloseTo(3.19, 2); // ≈ 3.2 cm of soft tissue at 60 keV
		expect(transmitted(m, hvl)).toBeCloseTo(0.5, 12);
		expect(transmitted(m, 2 * hvl)).toBeCloseTo(0.25, 12);
	});

	test('bone stops low-energy X-rays far better than soft tissue; the gap closes at high energy', () => {
		const ratio = (e: number) => mu('bone', e) / mu('soft', e);
		expect(ratio(30)).toBeGreaterThan(6);
		// At 150 keV what is left is mostly bone's higher density (1.92 against 1.06).
		expect(ratio(150)).toBeLessThan(2);
		expect(ratio(30)).toBeGreaterThan(ratio(60));
	});

	test('CT numbers: water 0, air ≈ −1000, fat and lung negative, bone far above', () => {
		expect(HU(muW)).toBe(0);
		expect(HU(mu('air', 60))).toBeCloseTo(-999, 0);
		expect(HU(mu('fat', 60))).toBeGreaterThan(-120);
		expect(HU(mu('fat', 60))).toBeLessThan(-60);
		expect(HU(mu('soft', 60))).toBeGreaterThan(30);
		expect(HU(mu('soft', 60))).toBeLessThan(80);
		expect(HU(mu('lung', 60))).toBeLessThan(-500);
		expect(HU(mu('bone', 60))).toBeGreaterThan(1000);
	});
});

test.describe('the body phantom', () => {
	test('parts stay inside their parents and never overlap their siblings', () => {
		const inside = (id: string, x: number, y: number, z: number) => {
			const p = BODY.find((q) => q.id === id)!;
			const s = partScale(p, z);
			if (s <= 0) return false;
			return ((x - p.x0) / (p.a * s)) ** 2 + ((y - p.y0) / (p.b * s)) ** 2 <= 1;
		};
		let bad = 0;
		for (let z = -20; z <= 20; z += 2)
			for (let x = -17; x <= 17; x += 0.5)
				for (let y = -12; y <= 12; y += 0.5)
					for (const p of BODY) {
						if (!inside(p.id, x, y, z)) continue;
						if (p.parent && !inside(p.parent, x, y, z)) bad++;
						for (const q of BODY)
							if (q.id !== p.id && q.parent === p.parent && inside(q.id, x, y, z)) bad++;
					}
		expect(bad).toBe(0);
	});

	test('a plain X-ray of a soft-tissue path equals μ × thickness of what it crosses', () => {
		// Through the middle of the torso below the chest (z = 19, no organs but spine):
		// fat (2 × 1.2 cm), muscle (2 × 9.8 cm − spine), spine 4 cm of bone with 2.4 cm marrow.
		const p = radiographAt(0, 19);
		const expected =
			mu('fat', 60) * 2 * (11 - 9.8) +
			mu('soft', 60) * (2 * 9.8 - 4.0 + 2.4) +
			mu('bone', 60) * (4.0 - 2.4) -
			mu('air', 60) * 2 * 11; // measured against the same path through air
		expect(p).toBeCloseTo(expected, 6);
	});
});

test.describe('CT: projections and filtered back-projection', () => {
	test('every shadow holds the same total: the integral of μ over the slice', () => {
		const s = scan(bodySlice(0), 12);
		const totals = Array.from({ length: s.angles }, (_, k) => {
			let t = 0;
			for (let j = 0; j < s.bins; j++) t += s.data[k * s.bins + j];
			return t * s.tau;
		});
		for (const t of totals) expect(t).toBeCloseTo(totals[0], 0);
		// The same integral straight from the ellipses (area × value).
		const area = bodySlice(0).ellipses.reduce((a, e) => a + Math.PI * e.a * e.b * e.value, 0);
		expect(totals[0] / area).toBeCloseTo(1, 2);
	});

	test('a uniform disc of water is rebuilt at its own μ', () => {
		const disc = {
			fov: 18,
			unit: 'cm',
			ellipses: [{ x0: 0, y0: 0, a: 10, b: 10, phi: 0, value: muW }]
		};
		const img = reconstruct(scan(disc, 180), true);
		expect(discMean(img, 18, 0, 0, 4) / muW).toBeCloseTo(1, 1);
		expect(Math.abs(HU(discMean(img, 18, 3, -2, 2)))).toBeLessThan(15);
	});

	test('the reconstruction reads the right CT numbers in the body', () => {
		const img = reconstruct(scan(bodySlice(0), 180), true);
		expect(HU(discMean(img, 18, -7.4, 0.2, 1.5))).toBeCloseTo(HU(mu('lung', 60)), -2);
		expect(Math.abs(HU(discMean(img, 18, 0.8, -3.4, 1.5)) - HU(mu('soft', 60)))).toBeLessThan(20);
		// The numbers the Hounsfield step quotes: fat about −90, bone well over +1000.
		expect(HU(discMean(img, 18, 15.4, 0, 0.4))).toBeCloseTo(-90, -1);
		expect(HU(discMean(img, 18, 0, 3.9, 0.4))).toBeGreaterThan(1000);
		expect(HU(discMean(img, 18, 0, -8.4, 0.4))).toBeGreaterThan(1000);
		// The 1.6 cm nodule stands out of the dark lung around it.
		expect(HU(discMean(img, 18, 6.4, 3.4, 0.4))).toBeGreaterThan(0);
	});

	test('a fluid cyst in the liver differs by only ~55 HU, and CT still separates them', () => {
		const img = reconstruct(scan(bodySlice(13), 180), true);
		const cyst = HU(discMean(img, 18, -7, -1.5, 0.6));
		const liver = HU(discMean(img, 18, -2, 2, 1));
		expect(liver - cyst).toBeGreaterThan(40);
		expect(liver - cyst).toBeLessThan(70); // the page quotes about 55 HU
		// On the plain X-ray the cyst changes the shadow by under 1%.
		const p0 = radiographAt(-7, 13);
		const without = p0 - 3 * (mu('water', 60) - mu('soft', 60));
		expect(Math.abs(p0 - without) / without).toBeLessThan(0.01);
	});

	test('unfiltered back-projection blurs a point as 1/r', () => {
		const img = reconstruct(scan(POINT, 180), false);
		const at = (r: number) => discMean(img, 18, 4 + r, -3, 0.2);
		expect(at(2) / at(4)).toBeCloseTo(2, 0);
		expect(at(1) / at(4)).toBeCloseTo(4, 0);
	});

	test('more angles and the ramp filter both bring the image closer to the true slice', () => {
		const ph = bodySlice(0);
		const ref = truth(ph);
		const err = (k: number, f = true) => relativeError(reconstruct(scan(ph, k), f), ref);
		expect(err(8)).toBeGreaterThan(err(32));
		expect(err(32)).toBeGreaterThan(err(180));
		expect(err(180)).toBeLessThan(0.08);
		expect(err(180, false)).toBeGreaterThan(1);
	});

	test('even scaled at its best, plain back-projection is far further from the slice than filtered', () => {
		const ph = bodySlice(0);
		const ref = truth(ph);
		const s = scan(ph, 180);
		const plain = fittedError(reconstruct(s, false), ref);
		const filtered = fittedError(reconstruct(s, true), ref);
		expect(plain).toBeGreaterThan(3 * filtered);
		expect(filtered).toBeLessThan(0.08);
	});

	test('the Shepp–Logan head comes back with its 1% features', () => {
		const img = reconstruct(scan(SHEPP_LOGAN, 180), true);
		expect(discMean(img, 1, 0, 0.6, 0.05)).toBeCloseTo(1.02, 1);
		// The ellipse at the top (y = −0.35 here) is 1.03, a 1% bump on the brain.
		expect(discMean(img, 1, 0, -0.35, 0.08)).toBeGreaterThan(discMean(img, 1, 0, 0.6, 0.05));
	});

	test('noise falls as 1/√dose', () => {
		const ph = bodySlice(0);
		const clean = reconstruct(scan(ph, 90), true);
		const sd = (n: number) => relativeError(reconstruct(scan(ph, 90, n), true), clean);
		const r = sd(1e4) / sd(4e4);
		expect(r).toBeGreaterThan(1.8);
		expect(r).toBeLessThan(2.2);
	});
});

test.describe('doses (RadiologyInfo)', () => {
	test('a chest X-ray is about 10 days of background; a chest CT about 2 years', () => {
		expect(backgroundDays(DOSES_MSV.chestXray)).toBeCloseTo(12, 0);
		expect(backgroundDays(DOSES_MSV.ctChest) / 365.25).toBeCloseTo(2, 0);
		expect(DOSES_MSV.ctChest / DOSES_MSV.chestXray).toBeCloseTo(61, 0);
		// Lung screening: about a quarter of a standard chest CT.
		expect(DOSES_MSV.ctLungScreening / DOSES_MSV.ctChest).toBeCloseTo(0.25, 1);
	});
});

test.describe('ultrasound', () => {
	const e = echoes(3.5);
	test('fat and muscle reflect about 1–2%; bone about a third; tissue and air all of it', () => {
		const fm = e.find((x) => x.from === 'subcutaneousFat' && x.to === 'muscle')!;
		expect(fm.R).toBeGreaterThan(0.01);
		expect(fm.R).toBeLessThan(0.025);
		const bone = e.find((x) => x.to === 'bone')!;
		expect(bone.R).toBeGreaterThan(0.3);
		expect(bone.R).toBeLessThan(0.4);
		const air = echoes(3.5, false)[0];
		expect(air.R).toBeGreaterThan(0.998);
	});

	test('sound is slower in fat (~1440 m/s) than in muscle (~1590 m/s)', () => {
		expect(TISSUE.fat.speed).toBeCloseTo(1440, -1);
		expect(TISSUE.muscle.speed).toBeCloseTo(1590, -1);
	});

	test('echoes return 13 μs per centimetre of depth', () => {
		for (const x of e) expect(x.time / x.depth).toBeGreaterThan(12.4);
		for (const x of e) expect(x.time / x.depth).toBeLessThan(14);
		for (const x of e) expect(x.shown).toBeCloseTo((1540 * x.time * 1e-6 * 100) / 2, 6);
	});

	test('without gel the deep echoes are lost; a higher frequency loses more with depth', () => {
		const deepGel = e[e.length - 1].dB;
		const deepAir = echoes(3.5, false).at(-1)!.dB;
		expect(deepGel - deepAir).toBeGreaterThan(50);
		expect(echoes(10).at(-1)!.dB).toBeLessThan(echoes(2).at(-1)!.dB - 30);
	});
});

test.describe('MRI', () => {
	test('hydrogen precesses at 42.58 MHz per tesla', () => {
		expect(larmorMHz(1)).toBeCloseTo(42.58, 2);
		expect(larmorMHz(1.5)).toBeCloseTo(63.87, 2);
		expect(larmorMHz(3)).toBeCloseTo(127.73, 2);
		expect(kHzPerCm(10)).toBeCloseTo(4.258, 3);
	});

	test('T1 weighting makes fat bright; T2 weighting makes blood (fluid) bright', () => {
		const t1w = (t: Parameters<typeof spinEcho>[0]) => spinEcho(t, 500, 15);
		const t2w = (t: Parameters<typeof spinEcho>[0]) => spinEcho(t, 4000, 100);
		for (const t of ['liver', 'spleen', 'muscle', 'blood'] as const)
			expect(t1w('subcutaneousFat')).toBeGreaterThan(t1w(t));
		for (const t of ['subcutaneousFat', 'liver', 'spleen', 'muscle'] as const)
			expect(t2w('blood')).toBeGreaterThan(t2w(t));
	});

	test('in a gradient, the spectrum of the signal is the profile of the object', () => {
		// Two tubes of water: 2 cm wide at x = −4 cm and 1 cm wide at x = +3 cm.
		const rho = (x: number) => (Math.abs(x + 4) <= 1 || Math.abs(x - 3) <= 0.5 ? 1 : 0);
		const g = gradientEcho(rho, 10);
		const at = (x: number) => g.profile[g.x.findIndex((v) => v >= x)];
		expect(at(-4)).toBeCloseTo(1, 1);
		expect(at(3)).toBeCloseTo(1, 1);
		expect(at(0)).toBeLessThan(0.1);
		expect(at(-7)).toBeLessThan(0.1);
		// Total signal at t = 0 is the amount of water: 3 cm of tube.
		expect(g.re[g.t.indexOf(0)]).toBeCloseTo(3, 1);
		// A stronger gradient spreads the same object over more frequencies: faster sampling.
		expect(gradientEcho(rho, 20).dt).toBeCloseTo(g.dt / 2, 9);
	});
});
