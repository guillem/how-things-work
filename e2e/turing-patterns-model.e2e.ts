// Checks the Turing-pattern simulations against linear stability theory (Turing 1952; Murray,
// Mathematical Biology II, ch. 2): with equal diffusion the uniform state is stable; ripples grow
// only above the critical diffusion ratio, which for the plain Gierer–Meinhardt model is
// (3 + 2√2)·ν/μ; a small ripple grows at the rate the dispersion relation gives; the pattern's
// spacing is the fastest-growing wavelength and grows as √D at a fixed ratio; saturation turns
// spots into stripes; a strip narrower than the transverse cut-off makes bands; and a growing
// strip inserts new peaks between the old ones. All runs start from seeded noise. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEFAULTS,
	DT,
	Field,
	GROWTH,
	RATES,
	SHAPE_RATIO,
	Strip,
	TAIL,
	TAIL_PARAMS,
	bandColumns,
	bandWidth,
	criticalRatio,
	dish,
	dominantWavelength,
	fastestMode,
	growthRate,
	patches,
	tail,
	uniformState
} from '../src/routes/turing-patterns/model';

test("the plain Gierer–Meinhardt model's critical ratio is (3 + 2√2)·ν/μ", () => {
	for (const nu of [1.5, 2, 3]) {
		const p = { ...RATES, s: 0, kappa: 0, nu };
		expect(criticalRatio(p)).toBeCloseTo((3 + 2 * Math.SQRT2) * nu, 6);
		// its uniform state: a = ν/μ, h = ρν/μ²
		expect(uniformState(p).a).toBeCloseTo(nu, 6);
	}
});

test('with equal diffusion the noise fades: the uniform state is stable', () => {
	const f = new Field(64, 64, { ...DEFAULTS, d: 1 }, 3);
	const start = f.contrast();
	f.runTo(30);
	expect(f.contrast()).toBeLessThan(start / 20);
});

test('ripples grow only when the inhibitor spreads faster than the critical ratio', () => {
	const dc = criticalRatio(DEFAULTS);
	// the page's rates: the narrative quotes about 21
	expect(Math.round(dc)).toBe(21);
	const below = new Field(64, 64, { ...DEFAULTS, d: 0.85 * dc }, 5);
	const above = new Field(64, 64, { ...DEFAULTS, d: 1.25 * dc }, 5);
	const start = below.contrast();
	below.runTo(120);
	above.runTo(120);
	expect(below.contrast()).toBeLessThan(start / 3);
	expect(above.contrast()).toBeGreaterThan(0.3);
});

test('a small ripple grows at the rate the dispersion relation predicts', () => {
	// one row of cells, seeded with one cosine mode near the fastest-growing wavenumber
	const p = DEFAULTS;
	const { k: kMax } = fastestMode(p);
	const n = 12;
	const L = Math.round((n * Math.PI) / kMax);
	const k = (n * Math.PI) / L;
	const f = new Field(L, 1, p, 1);
	const st = uniformState(p);
	const mode = (x: number) => Math.cos(k * (x + 0.5));
	for (let x = 0; x < L; x++) {
		f.a[x] = st.a * (1 + 1e-4 * mode(x));
		f.inh[x] = st.h;
	}
	const amp = () => {
		let s = 0;
		for (let x = 0; x < L; x++) s += (f.a[x] - st.a) * mode(x);
		return s;
	};
	f.runTo(5);
	const a1 = amp();
	f.runTo(15);
	const a2 = amp();
	const measured = Math.log(a2 / a1) / 10;
	expect(Math.abs(measured / growthRate(p, k) - 1)).toBeLessThan(0.05);
	// and a ripple outside the unstable band shrinks
	expect(growthRate(p, 3 * kMax)).toBeLessThan(0);
});

test('the settled spacing is the fastest-growing wavelength, and grows as √Dₐ', () => {
	const measure = (Da: number) => {
		const f = dish({ ...DEFAULTS, Da }, 2);
		f.runTo(200);
		return dominantWavelength(f.a, f.w);
	};
	const l1 = measure(1);
	const predicted = fastestMode(DEFAULTS).wavelength;
	expect(predicted).toBeGreaterThan(12);
	expect(predicted).toBeLessThan(13);
	expect(Math.abs(l1 / predicted - 1)).toBeLessThan(0.08);
	// a quarter of the diffusion of both (same ratio) halves the spacing
	const ratio = l1 / measure(0.25);
	expect(ratio).toBeGreaterThan(1.8);
	expect(ratio).toBeLessThan(2.2);
});

test('saturating the activator turns spots into stripes', () => {
	const shape = (kappa: number) => {
		const p = { ...DEFAULTS, kappa, d: SHAPE_RATIO };
		const f = dish(p, 4);
		f.runTo(300);
		return patches(f, 1.2 * fastestMode(p).wavelength);
	};
	const spots = shape(0);
	expect(spots.stripeShare).toBe(0);
	expect(spots.spots).toBeGreaterThan(40);
	const stripes = shape(0.15);
	expect(stripes.stripeShare).toBeGreaterThan(0.9);
	// every shape on the slider still forms a pattern at this ratio
	expect(criticalRatio({ ...RATES, kappa: 0.15 })).toBeLessThan(SHAPE_RATIO);
});

test('a tail narrower than the transverse cut-off makes bands; a wider one keeps spots', () => {
	const cut = bandWidth(TAIL_PARAMS);
	expect(cut).toBeGreaterThan(3);
	expect(cut).toBeLessThan(6);
	const tailCols = (tip: number) => {
		const f = tail(TAIL_PARAMS, tip, 1);
		f.runTo(200);
		return bandColumns(f).slice(TAIL.taper + 4);
	};
	const narrow = tailCols(4).filter((b) => b !== null);
	expect(narrow.length).toBeGreaterThan(10);
	expect(narrow.every((b) => b === true)).toBe(true);
	const wide = tailCols(12).filter((b) => b !== null);
	expect(wide.filter((b) => b === false).length).toBeGreaterThan(wide.length / 2);
});

test('a growing strip inserts new peaks between the old ones, keeping its spacing', () => {
	const s = new Strip(GROWTH, 1);
	const lam = fastestMode(GROWTH).wavelength;
	s.runTo(s.settle);
	const first = s.peaks();
	expect(Math.abs(first.length - s.L0 / lam)).toBeLessThanOrEqual(1.5);
	let before = first;
	let inserted = false;
	while (s.time < s.total - 1e-9) {
		s.step(Math.round(10 / DT));
		const now = s.peaks();
		if (now.length > before.length && !inserted && before.length >= 3) {
			// every old peak is still there, and each new one sits between two old ones
			const near = (x: number, list: number[]) => list.some((y) => Math.abs(x - y) < 0.04);
			expect(before.every((x) => near(x, now))).toBe(true);
			const fresh = now.filter((x) => !near(x, before));
			expect(fresh.length).toBeGreaterThan(0);
			for (const x of fresh) {
				const left = Math.max(...before.filter((y) => y < x));
				const right = Math.min(...before.filter((y) => y > x));
				expect(Math.abs(x - (left + right) / 2)).toBeLessThan(0.05);
			}
			inserted = true;
		}
		before = now;
	}
	expect(inserted).toBe(true);
	// five times longer, about five times as many peaks: the spacing stays within 2× of λ
	const spacing = s.L1 / (before.length - 1);
	expect(spacing).toBeGreaterThan(0.8 * lam);
	expect(spacing).toBeLessThan(2.2 * lam);
});
