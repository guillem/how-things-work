// Checks the Kalman filter model against what the filter is known to do: Bayes' rule for two
// Gaussian guesses gives the gain-weighted blend, narrower than either; the scalar random walk's
// gain settles, from any start, to the fixed point of the Riccati equation (1/φ ≈ 0.618 when the
// two noises are equal); the filter's real error variance is the P it reports, so the truth sits
// in its 95 % ellipse 95 % of the time; with no process noise and a diffuse prior it is the
// running mean; it beats the raw measurements and any fixed-window average; its innovations are
// white when its model is right and correlated when it is wrong, and a wrong model is wrong
// with confidence; an accelerometer fused with GPS beats either alone. Seeded, so every number
// replays exactly. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	accelerometer,
	autocorrelation,
	blend,
	draws,
	fixErrors,
	gpsFixes,
	inside95,
	movingAverage,
	positionErrors,
	randomWalk,
	rms,
	runningMean,
	scalarFilter,
	steadyGain,
	swerve,
	SWERVE,
	track,
	wander
} from '../src/routes/kalman-filter/model';

const mean = (x: readonly number[]) => x.reduce((s, v) => s + v, 0) / x.length;

test('two Gaussian guesses combine by Bayes rule into one narrower than either', () => {
	// multiply the two densities on a fine grid and read the product's mean and variance
	const [mp, sp, z, sr] = [10, 3, 16, 2];
	const pdf = (x: number, m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s * s));
	let w = 0;
	let m1 = 0;
	let m2 = 0;
	for (let x = -20; x <= 50; x += 0.001) {
		const p = pdf(x, mp, sp) * pdf(x, z, sr);
		w += p;
		m1 += p * x;
		m2 += p * x * x;
	}
	const gridMean = m1 / w;
	const gridVar = m2 / w - gridMean ** 2;
	const b = blend(mp, sp * sp, z, sr * sr);
	expect(b.mean).toBeCloseTo(gridMean, 4);
	expect(b.variance).toBeCloseTo(gridVar, 4);
	expect(b.variance).toBeLessThan(sr * sr);
	expect(b.variance).toBeLessThan(sp * sp);
	// equal trust: halfway, with half the variance
	expect(blend(0, 4, 10, 4)).toMatchObject({ mean: 5, variance: 2, K: 0.5 });
});

test('the gain settles from any starting uncertainty to the Riccati fixed point', () => {
	const z = draws(200, 1);
	for (const [q, r] of [
		[1, 1],
		[0.5, 2],
		[2, 0.3]
	]) {
		const fromSure = scalarFilter(z, q, r, 0, 1e-6);
		const fromDiffuse = scalarFilter(z, q, r, 0, 1e12);
		const K = fromDiffuse[199].K;
		expect(fromSure[199].K).toBeCloseTo(K, 10);
		expect(K).toBeCloseTo(steadyGain(q, r).K, 10);
		// the fixed point: one more predict-update cycle leaves P unchanged
		const P = fromDiffuse[199].variance;
		const Pm = P + q * q;
		expect((Pm * r * r) / (Pm + r * r)).toBeCloseTo(P, 10);
	}
	// equal process and measurement noise: the steady gain is 1/φ, the golden ratio's inverse
	expect(steadyGain(1, 1).K).toBeCloseTo(2 / (1 + Math.sqrt(5)), 12);
});

test('the error variance the filter reports is the one it has', () => {
	// 4,000 seeded random walks; at step 30 the squared errors average to P
	const [q, r] = [0.5, 2];
	const errs: number[] = [];
	let P = 0;
	let innovRatio = 0;
	for (let s = 0; s < 4000; s++) {
		const { truth, z } = randomWalk(31, q, r, 100 + s, 5);
		const f = scalarFilter(z, q, r);
		errs.push(f[30].est - truth[30]);
		P = f[30].variance;
		innovRatio += f[30].innov ** 2 / f[30].S;
	}
	const mse = mean(errs.map((e) => e * e));
	expect(mse / P).toBeGreaterThan(0.94);
	expect(mse / P).toBeLessThan(1.06);
	// and the innovations' spread is the S it predicted
	expect(innovRatio / 4000).toBeGreaterThan(0.94);
	expect(innovRatio / 4000).toBeLessThan(1.06);
	// more certain than any single measurement
	expect(P).toBeLessThan(r * r);
});

test('with no process noise and a diffuse prior the filter is the running mean', () => {
	const { z } = randomWalk(60, 0, 3, 11, 42);
	const f = scalarFilter(z, 0, 3);
	const m = runningMean(z);
	f.forEach((s, k) => {
		expect(s.est).toBeCloseTo(m[k], 6);
		expect(s.K).toBeCloseTo(1 / (k + 1), 6);
		expect(s.variance).toBeCloseTo(9 / (k + 1), 6);
	});
});

test('over a long run the filter beats the raw measurements and every fixed-window average', () => {
	const [q, r] = [0.5, 2];
	const { truth, z } = randomWalk(4000, q, r, 21);
	const f = scalarFilter(z, q, r);
	const kf = rms(f.map((s, k) => s.est - truth[k]).slice(20));
	const raw = rms(z.map((v, k) => v - truth[k]).slice(20));
	expect(kf).toBeLessThan(0.6 * raw);
	// the real error is the steady-state σ the filter reports
	expect(kf).toBeCloseTo(Math.sqrt(steadyGain(q, r).variance), 1);
	for (let w = 2; w <= 30; w++) {
		const ma = movingAverage(z, w);
		expect(kf).toBeLessThan(rms(ma.map((v, k) => v - truth[k]).slice(30)));
	}
	// and the running mean is hopeless on a quantity that moves
	expect(rms(runningMean(z).map((v, k) => v - truth[k]))).toBeGreaterThan(5 * raw);
});

test('when the model is right the innovations are white', () => {
	const [q, r] = [0.5, 2];
	const { z } = randomWalk(5000, q, r, 31);
	const f = scalarFilter(z, q, r).slice(10);
	const nu = f.map((s) => s.innov / Math.sqrt(s.S));
	const band = 3 / Math.sqrt(nu.length);
	for (const c of autocorrelation(nu, 10)) expect(Math.abs(c)).toBeLessThan(band);
	expect(mean(nu.map((v) => v * v))).toBeCloseTo(1, 1);
});

test('a wrong model is wrong with confidence, and its innovations show it', () => {
	// the truth drifts steadily (0.3 a step); the filter believes it barely moves (q = 0.01)
	const truth = Array.from({ length: 400 }, (_, k) => 0.3 * k);
	const noise = draws(400, 41);
	const z = truth.map((x, k) => x + 2 * noise[k]);
	const f = scalarFilter(z, 0.01, 2).slice(50);
	const err = rms(f.map((s, k) => s.est - truth[k + 50]));
	const claimed = Math.sqrt(mean(f.map((s) => s.variance)));
	expect(err).toBeGreaterThan(5 * claimed);
	const nu = f.map((s) => s.innov / Math.sqrt(s.S));
	expect(autocorrelation(nu, 1)[0]).toBeGreaterThan(0.5);
	expect(mean(nu)).toBeGreaterThan(1); // the measurements keep landing ahead of it
});

test('tracking in a plane: the truth sits in the 95 % ellipse 95 % of the time', () => {
	let inside = 0;
	let count = 0;
	let nees = 0;
	for (let s = 0; s < 200; s++) {
		const truth = wander(60, 0.3, 500 + s);
		const fixes = gpsFixes(truth, 5, 900 + s);
		const steps = track(truth, fixes, { q: 0.3, r: 5 });
		steps.forEach((st, k) => {
			if (k < 5) return;
			count++;
			if (inside95(truth.states[k], st.post)) inside++;
			const e = [0, 1].map((i) => st.post.x[i] - truth.states[k][i]);
			const [[a, b], [, d]] = [st.post.P[0].slice(0, 2), st.post.P[1].slice(0, 2)];
			nees += (d * e[0] * e[0] - 2 * b * e[0] * e[1] + a * e[1] * e[1]) / (a * d - b * b);
		});
	}
	expect(inside / count).toBeGreaterThan(0.935);
	expect(inside / count).toBeLessThan(0.965);
	expect(nees / count).toBeCloseTo(2, 0); // χ² with 2 degrees of freedom
});

test('the plane tracker is more certain, and more accurate, than its GPS', () => {
	const truth = wander(400, 0.3, 61);
	const fixes = gpsFixes(truth, 5, 62);
	const steps = track(truth, fixes, { q: 0.3, r: 5 });
	const kf = rms(positionErrors(truth, steps).slice(10));
	const gps = rms(fixErrors(truth, fixes).slice(10));
	expect(kf).toBeLessThan(0.75 * gps);
	// GPS σ is 5 m per axis; the filter's settled σ is under it
	const P = steps[399].post.P;
	expect(Math.sqrt(P[0][0])).toBeLessThan(5);
	// noisier GPS: the gain on position falls (the filter leans on its model)
	const noisy = track(truth, gpsFixes(truth, 20, 62), { q: 0.3, r: 20 });
	expect(noisy[399].K![0][0]).toBeLessThan(steps[399].K![0][0]);
});

test('an accelerometer fused with GPS beats either sensor alone', () => {
	const truth = wander(120, 0.3, 71);
	const fixes = gpsFixes(truth, 5, 72);
	const acc = accelerometer(truth, 0.05, 73);
	const gpsOnly = rms(positionErrors(truth, track(truth, fixes, { q: 0.3, r: 5 })).slice(10));
	const fused = rms(
		positionErrors(truth, track(truth, fixes, { q: 0.05, r: 5, accel: acc })).slice(10)
	);
	const deadErr = positionErrors(
		truth,
		track(
			truth,
			fixes.map(() => null),
			{ q: 0.05, r: 5, accel: acc }
		)
	);
	expect(fused).toBeLessThan(0.75 * gpsOnly);
	expect(fused).toBeLessThan(rms(deadErr.slice(10)));
	// dead reckoning drifts: its error grows with time
	expect(rms(deadErr.slice(90))).toBeGreaterThan(3 * rms(deadErr.slice(10, 40)));
	// with GPS only every 5 s the fused filter still holds, the GPS-only one does worse
	const sparse = gpsFixes(truth, 5, 72, 5);
	const sparseGps = rms(positionErrors(truth, track(truth, sparse, { q: 0.3, r: 5 })).slice(10));
	const sparseFused = rms(
		positionErrors(truth, track(truth, sparse, { q: 0.05, r: 5, accel: acc })).slice(10)
	);
	expect(sparseFused).toBeLessThan(0.6 * sparseGps);
});

test('round a corner, a filter that expects straight lines lags behind, confidently', () => {
	const truth = swerve();
	const fixes = gpsFixes(truth, 3, 81);
	const corner = Array.from({ length: 14 }, (_, i) => SWERVE.straight + i);
	const run = (q: number) => {
		const steps = track(truth, fixes, { q, r: 3 });
		const err = positionErrors(truth, steps);
		return {
			worst: Math.max(...corner.map((k) => err[k])),
			outside: corner.filter((k) => !inside95(truth.states[k], steps[k].post)).length,
			sigma: Math.sqrt(steps[SWERVE.straight + 3].post.P[0][0]),
			straightErr: rms(err.slice(8, SWERVE.straight))
		};
	};
	const stiff = run(0.02);
	const loose = run(1);
	expect(stiff.worst).toBeGreaterThan(8);
	expect(stiff.worst).toBeGreaterThan(2 * loose.worst);
	expect(stiff.outside).toBeGreaterThan(8); // truth outside its 95 % ellipse most of the turn
	expect(loose.outside).toBeLessThanOrEqual(2);
	expect(stiff.sigma).toBeLessThan(loose.sigma); // and it claimed to be the surer of the two
	// the price of allowing for turns: more jitter on the straight
	expect(loose.straightErr).toBeGreaterThan(stiff.straightErr);
});
