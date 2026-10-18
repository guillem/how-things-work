// Checks the E. coli chemotaxis model (run-and-tumble swimmers, each with an MWC receptor
// cluster and methylation feedback) against what bacteria are measured to do: Berg & Brown's
// runs, tumbles and turning angle; precise adaptation to a uniform step of attractant; a
// steady activity shift during an exponential ramp (Shimizu, Tu & Berg 2010); a drift up a
// gradient that is small next to the swimming speed; no gathering without adaptation; and the
// Berg–Purcell numbers the narrative quotes. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	MWC,
	SWIM,
	Swarm,
	bergPurcell,
	dish,
	DISH,
	NEAR,
	uniformResponse
} from '../src/routes/bacterial-chemotaxis/model';

const mean = (xs: ArrayLike<number>) => {
	let s = 0;
	for (let i = 0; i < xs.length; i++) s += xs[i];
	return s / xs.length;
};

/** Tumbles per cell per second in consecutive windows of `w` seconds. */
function tumbleTrace(s: Swarm, until: number, w: number) {
	const out: number[] = [];
	while (s.t < until - 1e-9) {
		s.tumbles = 0;
		s.run(s.t + w);
		out.push(s.tumbles / s.n / w);
	}
	return out;
}

test("without attractant, cells swim like Berg & Brown's: about one tumble a second, 68° turns", () => {
	const s = new Swarm({ n: 2000, seed: 1, field: () => 0 });
	s.keepAngles = true;
	s.run(10);
	s.tumbles = 0;
	s.run(70);
	// A run of 0.86 s and a tumble of 0.14 s: one tumble per second.
	expect(s.tumbles / s.n / 60).toBeCloseTo(1 / (SWIM.run + SWIM.tumble), 1);
	const angle = (mean(s.angles) * 180) / Math.PI;
	expect(angle).toBeGreaterThan(66);
	expect(angle).toBeLessThan(70);
	expect(mean(s.angles.map(Math.cos))).toBeCloseTo(0.33, 1);
});

test('a uniform step of attractant: the tumble rate dips, then returns exactly to baseline', () => {
	const s = new Swarm({ n: 2000, seed: 2, field: (_x, _y, t) => (t < 20 ? 20 : 40) });
	const trace = tumbleTrace(s, 140, 4);
	const baseline = mean(trace.slice(0, 5));
	expect(baseline).toBeCloseTo(1, 1);
	// Within the first 8 s after the step, almost no tumbles: every cell is on a long run.
	expect(Math.max(trace[5], trace[6])).toBeLessThan(0.1 * baseline);
	// A minute or two later the rate is back where it started, though the attractant stayed.
	expect(mean(trace.slice(-5)) / baseline).toBeGreaterThan(0.93);
	expect(mean(trace.slice(-5)) / baseline).toBeLessThan(1.07);
});

test('removing attractant makes the cells tumble far more often, then they recover', () => {
	const s = new Swarm({ n: 2000, seed: 3, field: (_x, _y, t) => (t < 20 ? 100 : 20) });
	const trace = tumbleTrace(s, 140, 4);
	const baseline = mean(trace.slice(0, 5));
	expect(Math.max(trace[5], trace[6])).toBeGreaterThan(2.5 * baseline);
	expect(mean(trace.slice(-5)) / baseline).toBeGreaterThan(0.93);
	expect(mean(trace.slice(-5)) / baseline).toBeLessThan(1.07);
});

test('adaptation is precise: whatever the dose, the activity settles back at a₀', () => {
	for (const dose of [30, 100, 400, 1000]) {
		const r = uniformResponse({ c: (t) => (t < 5 ? 20 : dose), until: 400, n: 10 });
		expect(r.at(-1)!.a, `20 → ${dose} µM`).toBeCloseTo(MWC.a0, 3);
	}
	// With the methylation frozen, the activity stays where the attractant pushed it.
	const frozen = uniformResponse({ c: (t) => (t < 5 ? 20 : 100), until: 400, adapt: false });
	expect(frozen.at(-1)!.a).toBeLessThan(0.05);
	expect(mean(frozen.slice(-60).map((p) => p.rate))).toBeLessThan(0.05);
});

test('the shared-state shortcut for a flooded dish gives the same tumble rates as the swimmers', () => {
	const c = (t: number) => (t < 20 ? 20 : 40);
	const quick = uniformResponse({ c, until: 120, n: 2000, every: 4 });
	const s = new Swarm({ n: 2000, seed: 9, field: (_x, _y, t) => c(t) });
	const full = tumbleTrace(s, 120, 4);
	for (let i = 0; i < full.length; i++)
		expect(Math.abs(full[i] - quick[i].rate), `window ${i}`).toBeLessThan(0.12);
});

test('an exponential ramp shifts the activity to a steady lower level, as measured by FRET', () => {
	// c = c₀ e^{rt}: the cell keeps adapting and the activity settles at a level set by r.
	const at = (r: number, tau: number) => {
		const out = uniformResponse({ c: (t) => 50 * Math.exp(r * t), until: 300, tau, n: 1 });
		return { mid: out[199].a, late: out[299].a };
	};
	const slow = at(0.002, 29);
	expect(slow.late).toBeLessThan(MWC.a0);
	expect(Math.abs(slow.mid - slow.late)).toBeLessThan(0.003);
	// Shimizu, Tu & Berg (2010) measured Δa/Δr ≈ −30 s at 22 °C, where τ ≈ 29 s.
	const sensitivity = (slow.late - MWC.a0) / 0.002;
	expect(sensitivity).toBeGreaterThan(-45);
	expect(sensitivity).toBeLessThan(-25);
	// A faster ramp shifts it further.
	expect(at(0.004, 29).late).toBeLessThan(slow.late);
});

test('in a gradient the population drifts up it, slowly next to the swimming speed', () => {
	const drift = (tau: number) => {
		const s = new Swarm({ n: 600, seed: 4, field: (x) => 100 * Math.exp(x / 1000), tau });
		s.run(60);
		const x0 = mean(s.x);
		s.run(300);
		return (mean(s.x) - x0) / 240;
	};
	const vd = drift(10);
	expect(vd).toBeGreaterThan(0.05 * SWIM.v);
	expect(vd).toBeLessThan(0.3 * SWIM.v);
	// A memory shorter than a run can't compare much: the drift is far weaker.
	expect(drift(0.3)).toBeLessThan(0.5 * vd);
});

test('without adaptation the cells no longer gather around a drop', () => {
	// The dish: with adaptation most cells end up near the drop, without it they stay spread.
	const uniform = (Math.PI * NEAR ** 2) / (DISH.w * DISH.h);
	const on = dish({ dropX: 1300, dropY: 440 });
	expect(on.near[on.at(360)]).toBeGreaterThan(0.8);
	const off = dish({ dropX: 1300, dropY: 440, adapt: false });
	expect(Math.abs(off.near[off.at(360)] - uniform)).toBeLessThan(0.06);
});

test('Berg & Purcell: across its body a cell cannot read a gradient, along a run it can', () => {
	// 1 µM of attractant falling off over 1 mm.
	const bp = bergPurcell({ c: 1, length: 1000 });
	expect(bp.spatial.signal / bp.spatial.noise).toBeLessThan(1);
	expect(bp.temporal.signal / bp.temporal.noise).toBeGreaterThan(5);
});
