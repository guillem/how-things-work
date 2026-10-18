// Checks the wind-turbine page's models against what is known of them: momentum theory's
// actuator disc takes at most 16/27 of the wind's power, when it slows the air at the disc by a
// third and in the far wake to a third of the wind speed, and nothing at either end (no slowing,
// or no air through the disc); the measured (Glauert–Buhl) thrust joins momentum theory at
// a = 0.4 and reaches 2 at a = 1; the blade-element-momentum model of the NREL 5-MW reference
// turbine stays below the Betz limit at every tip-speed ratio and pitch (even without drag or
// tip losses), peaks near the reference design's optimal tip-speed ratio of 7.55 with a power
// coefficient near its published 0.48, stalls at low tip-speed ratio and reaches the
// high-induction state outboard at high tip-speed ratio; operated in the wind, its power grows
// with the cube of the wind speed below rated and is held at 5 MW by pitching the blades
// between rated wind and cut-out. The numbers the narrative quotes too.
import { expect, test } from '@playwright/test';
import {
	bem,
	bestLambda,
	BETZ,
	disc,
	operate,
	ratedWindSpeed,
	isStalled,
	optimalBand,
	stallAngle,
	thrustCorrected,
	TURBINE,
	windPower
} from '../src/routes/wind-turbine-aerodynamics/model';

test('the actuator disc takes at most 16/27 of the power, at a = 1/3', () => {
	let best = { a: 0, cp: 0 };
	for (let i = 0; i <= 5000; i++) {
		const a = (0.5 * i) / 5000;
		const { cp } = disc(a);
		if (cp > best.cp) best = { a, cp };
	}
	expect(best.cp).toBeCloseTo(16 / 27, 6);
	expect(best.a).toBeCloseTo(1 / 3, 3);
	// At the optimum the air passes the disc at two-thirds of the wind speed and leaves at a third.
	const d = disc(1 / 3);
	expect(d.uDisc).toBeCloseTo(2 / 3, 9);
	expect(d.uWake).toBeCloseTo(1 / 3, 9);
	// The same mass of air per second: the stream tube's cross-section is two-thirds of the disc
	// far upstream and twice the disc far downstream, three times as much where it is three
	// times slower.
	expect(d.areaUp).toBeCloseTo(2 / 3, 9);
	expect(d.areaWake).toBeCloseTo(2, 9);
	expect(d.ct).toBeCloseTo(8 / 9, 9);
});

test('a disc that takes nothing, or lets nothing through, gets no power', () => {
	expect(disc(0).cp).toBe(0);
	expect(disc(1).cp).toBe(0);
});

test('the power in the wind grows with the cube of its speed', () => {
	// 10 m/s through one square metre at sea-level density: 612.5 W.
	expect(windPower(1, 10)).toBeCloseTo(612.5, 6);
	expect(windPower(1, 20) / windPower(1, 10)).toBeCloseTo(8, 9);
});

test('the measured thrust joins momentum theory at a = 0.4 and reaches 2 at a = 1', () => {
	expect(thrustCorrected(0.4)).toBeCloseTo(disc(0.4).ct, 9);
	expect(thrustCorrected(0.4 + 1e-6)).toBeCloseTo(disc(0.4).ct, 4);
	expect(thrustCorrected(1)).toBeCloseTo(2, 9);
	// Above a = 1/2 momentum theory has thrust falling; the measurements keep rising.
	expect(thrustCorrected(0.7)).toBeGreaterThan(thrustCorrected(0.5));
	expect(disc(0.7).ct).toBeLessThan(disc(0.5).ct);
});

test('the BEM rotor stays below the Betz limit at every tip-speed ratio and pitch', () => {
	for (let lambda = 1; lambda <= 14; lambda += 0.5) {
		for (let pitch = -5; pitch <= 25; pitch += 2.5) {
			expect(bem(lambda, pitch).cp).toBeLessThan(BETZ);
			// An ideal blade (no drag, no tip loss) still loses the swirl of its wake.
			expect(bem(lambda, pitch, { drag: false, tipLoss: false }).cp).toBeLessThan(BETZ);
		}
	}
});

test('the NREL 5-MW rotor peaks near its design tip-speed ratio, near Cp = 0.48', () => {
	const best = bestLambda(0);
	expect(Math.abs(best.lambda - TURBINE.lambdaOpt)).toBeLessThan(0.5);
	expect(best.cp).toBeGreaterThan(0.46);
	expect(best.cp).toBeLessThan(0.51);
	// The narrative quotes 0.49 at about 7.7.
	expect(best.cp.toFixed(2)).toBe('0.49');
	expect(best.lambda.toFixed(1)).toBe('7.7');
	// Far from the optimum the power coefficient falls off on both sides.
	expect(bem(4, 0).cp).toBeLessThan(0.3);
	expect(bem(13, 0).cp).toBeLessThan(0.36);
	// Pitching the blades toward feather lowers the best power coefficient.
	expect(bestLambda(5).cp).toBeLessThan(best.cp - 0.05);
});

test('the best tip-speed ratio is found over the whole range, even at high pitch', () => {
	for (const pitch of [20, 25, 30]) {
		const best = bestLambda(pitch);
		for (let lambda = 1; lambda <= 14; lambda += 0.25) {
			expect(bem(lambda, pitch).cp).toBeLessThanOrEqual(best.cp + 1e-3);
		}
	}
	// At 25° the peak lies below λ = 3, at a positive power coefficient.
	expect(bestLambda(25).lambda).toBeLessThan(3);
	expect(bestLambda(25).cp).toBeGreaterThan(0.05);
});

test('a section driven to large negative angles of attack stalls too', () => {
	// At λ = 14 with the blades pitched 30°, the outer NACA 64 sections see α ≈ −25°, beyond
	// their most negative lift (near −16° in the shipped table).
	const tip = bem(14, 30).elements.filter((e) => e.af === 7);
	for (const e of tip) {
		expect(e.alpha).toBeLessThan(-16);
		expect(isStalled(e.af, e.alpha)).toBe(true);
	}
	expect(isStalled(7, 4)).toBe(false);
});

test('tip losses and drag each cost power', () => {
	const real = bestLambda(0).cp;
	expect(bestLambda(0, { tipLoss: false }).cp).toBeGreaterThan(real + 0.02);
	expect(bestLambda(0, { drag: false }).cp).toBeGreaterThan(real + 0.02);
});

test('near the optimum the outer blade slows the air by about a third', () => {
	const sol = bem(TURBINE.lambdaOpt, 0);
	const mid = sol.elements.filter((e) => e.r > 25 && e.r < 55);
	for (const e of mid) {
		expect(e.a).toBeGreaterThan(0.24);
		expect(e.a).toBeLessThan(0.4);
	}
	// The tip loss factor drops toward the tip.
	const tip = sol.elements[sol.elements.length - 1];
	expect(tip.F).toBeLessThan(0.7);
});

test('at a low tip-speed ratio the blade stalls; at a high one it blocks the flow', () => {
	const slow = bem(3, 0);
	for (const e of slow.elements) {
		if (Number.isFinite(stallAngle(e.af))) expect(isStalled(e.af, e.alpha)).toBe(true);
	}
	const fast = bem(12, 0);
	const outer = fast.elements.filter((e) => e.r > 50);
	for (const e of outer) expect(e.a).toBeGreaterThan(0.4);
	// …with angles of attack near zero, where the sections make little lift for their drag.
	for (const e of fast.elements.filter((e) => e.r > 25)) expect(Math.abs(e.alpha)).toBeLessThan(2);
});

test('below rated wind the power grows with the cube of the wind speed', () => {
	// The controller holds λ at its optimum between about 6.0 and 10.6 m/s.
	const band = optimalBand();
	expect(band.from.toFixed(1)).toBe('6.0');
	expect(band.to.toFixed(1)).toBe('10.6');
	expect(operate(5).region).toBe('min-speed');
	const p7 = operate(7);
	const p10 = operate(10);
	expect(p7.region).toBe('below-rated');
	expect(p10.region).toBe('below-rated');
	expect(p10.lambda).toBeCloseTo(TURBINE.lambdaOpt, 6);
	expect(p10.electric / p7.electric).toBeCloseTo((10 / 7) ** 3, 6);
});

test('pitch control holds 5 MW from rated wind to cut-out', () => {
	const vr = ratedWindSpeed();
	// Jonkman et al. give 11.4 m/s; this model reaches rated at about 11.2.
	expect(vr).toBeGreaterThan(10.8);
	expect(vr).toBeLessThan(11.8);
	let pitch = 0;
	for (let v = Math.ceil(vr * 2) / 2; v <= 25; v += 0.5) {
		const o = operate(v);
		expect(o.region).toBe('rated');
		expect(o.electric).toBeCloseTo(5e6, -3);
		expect(o.pitch).toBeGreaterThan(pitch);
		pitch = o.pitch;
	}
	// At cut-out the blades are pitched about 23° (Jonkman et al.: 23.5°).
	expect(pitch).toBeGreaterThan(21);
	expect(pitch).toBeLessThan(26);
	expect(operate(2.5).electric).toBe(0);
	expect(operate(25.5).electric).toBe(0);
});
