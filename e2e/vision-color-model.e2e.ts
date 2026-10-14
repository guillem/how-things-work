// Checks the models behind the vision-color explainer: the Gullstrand–Emsley schematic eye
// (eye.ts) and colour from the three cone types (colour.ts, CVRL cone fundamentals). Runs in
// Node; no browser.
import { expect, test } from '@playwright/test';
import {
	EYES,
	N_WATER,
	NORMAL_LENGTH,
	SHARP,
	arrivingVergence,
	bestShape,
	corneaPower,
	defocus,
	eyePower,
	imageZ,
	lensPower,
	nearPoint,
	prescription,
	traceRay
} from '../src/routes/vision-color/eye';
import {
	PRIMARIES,
	TARGETS,
	afterimage,
	bestMatch,
	cones,
	conesOfRGB,
	cssColour,
	matchFor,
	mismatch,
	mixture,
	opponent,
	peak,
	response,
	toXYZ
} from '../src/routes/vision-color/colour';
import { LMS, NM0, XYZ } from '../src/routes/vision-color/cone-data';
import { AFTER_DISCS, afterimageOf } from '../src/routes/vision-color/scenes/ui';

// ------------------------------------------------------------------ the eye

test('the schematic eye has the published Gullstrand–Emsley powers and length', () => {
	// Bennett & Rabbetts: +60.48 D relaxed, +69.72 D accommodated, axial length 23.89 mm.
	expect(eyePower(0)).toBeCloseTo(60.48, 2);
	expect(eyePower(1)).toBeCloseTo(69.72, 2);
	expect(NORMAL_LENGTH).toBeCloseTo(23.89, 1);
});

test('the cornea does about two-thirds of the focusing, and almost none under water', () => {
	expect(corneaPower()).toBeCloseTo(42.7, 1);
	expect(corneaPower() / eyePower(0)).toBeGreaterThan(0.65);
	expect(corneaPower() / eyePower(0)).toBeLessThan(0.75);
	// Water has nearly the index of the eye's humour: the cornea stops bending light.
	expect(Math.abs(corneaPower(N_WATER))).toBeLessThan(0.1);
	expect(eyePower(0, N_WATER)).toBeLessThan(25);
	// A distant object is then about 40 D out of focus, far beyond what the lens can make up.
	expect(defocus(0, 1, NORMAL_LENGTH, 0, N_WATER)).toBeLessThan(-30);
});

test('the lens alone is about 21.8 D; rounded, it raises the eye by 9.2 D, about 8.6 D by the near point', () => {
	expect(lensPower(0)).toBeCloseTo(21.8, 1);
	expect(eyePower(1) - eyePower(0)).toBeCloseTo(9.2, 1);
	// Amplitude of accommodation as clinicians measure it: 1 ÷ the near point in metres.
	expect(100 / nearPoint(NORMAL_LENGTH)).toBeCloseTo(8.6, 1);
});

test('each extra millimetre of eye length adds about −2.7 D of short sight', () => {
	expect(prescription(NORMAL_LENGTH + 1)).toBeGreaterThan(-2.8);
	expect(prescription(NORMAL_LENGTH + 1)).toBeLessThan(-2.6);
});

test('a normal eye focuses far away relaxed, and as close as about 12 cm with a rounded lens', () => {
	expect(Math.abs(defocus(0, 0, NORMAL_LENGTH))).toBeLessThan(0.001);
	// An object at 25 cm is 4 D out of focus for the relaxed eye, behind the retina…
	expect(defocus(-4, 0, NORMAL_LENGTH)).toBeCloseTo(-4, 5);
	expect(imageZ(-4, 0)).toBeGreaterThan(NORMAL_LENGTH);
	// …and a rounder lens brings it onto the retina.
	const s = bestShape(-4, NORMAL_LENGTH);
	expect(s).toBeGreaterThan(0);
	expect(s).toBeLessThan(1);
	expect(Math.abs(defocus(-4, s, NORMAL_LENGTH))).toBeLessThan(0.01);
	expect(nearPoint(NORMAL_LENGTH)).toBeGreaterThan(11);
	expect(nearPoint(NORMAL_LENGTH)).toBeLessThan(12);
	// At 10 cm even the roundest lens can't: the light still meets behind the retina.
	expect(defocus(-10, 1, NORMAL_LENGTH)).toBeLessThan(-SHARP);
});

test('every traced ray from a point meets at the image the readouts use, upside down', () => {
	// An object 50 cm away, 40 mm above the axis; rays through the 5 mm pupil.
	const zObj = -500;
	const yObj = 40;
	const zImg = imageZ(-2, 0.3);
	const heights = [-2.5, -1, 0, 1, 2.5].map((h) => {
		const nu = (h - yObj) / -zObj; // aimed at the cornea at height h
		const path = traceRay({ z: zObj, y: yObj, nu, n: 1 }, 0.3, 0, zImg);
		return path[path.length - 1].y;
	});
	for (const y of heights) expect(y).toBeCloseTo(heights[0], 6);
	expect(heights[0]).toBeLessThan(0); // inverted
});

test('a short-sighted eye 25 mm long needs −3.00 D glasses', () => {
	const e = EYES.short;
	expect(e.length).toBeCloseTo(25.0, 2);
	expect(prescription(e.length)).toBeCloseTo(-3, 6);
	// Uncorrected, distant light focuses in front of the retina, and relaxing can't fix it.
	expect(defocus(0, 0, e.length)).toBeGreaterThan(2.5);
	expect(imageZ(0, 0)).toBeLessThan(e.length);
	// With the glasses on, a distant object is sharp on the retina.
	expect(Math.abs(imageZ(arrivingVergence(0, -3), 0) - e.length)).toBeLessThan(0.001);
	// Without them it still sees near things well: its far point is about 35 cm away.
	expect(Math.abs(defocus(-1 / 0.345, 0, e.length))).toBeLessThan(0.05);
});

test('a long-sighted eye works its lens for distant things and cannot focus a book at 20 cm', () => {
	const e = EYES.long;
	expect(prescription(e.length)).toBeCloseTo(4, 6);
	expect(e.length).toBeLessThan(NORMAL_LENGTH - 1);
	// Relaxed, distant light would focus behind the retina…
	expect(defocus(0, 0, e.length)).toBeLessThan(-SHARP);
	// …but rounding the lens brings it in.
	expect(Math.abs(defocus(0, bestShape(0, e.length), e.length))).toBeLessThan(0.01);
	// Its nearest sharp point is about 24 cm, so a book at 20 cm stays blurred.
	expect(nearPoint(e.length)).toBeGreaterThan(22);
	expect(nearPoint(e.length)).toBeLessThan(26);
	expect(defocus(-5, 1, e.length)).toBeLessThan(-SHARP);
	// +4.00 D glasses bring the near point back to about 13 cm.
	expect(nearPoint(e.length, 4)).toBeLessThan(14);
	expect(Math.abs(defocus(-5, bestShape(-5, e.length, 4), e.length, 4))).toBeLessThan(0.01);
});

// ------------------------------------------------------------------ the cones

test('the measured cone curves peak at 570, 543 and 442 nm, and L and M overlap', () => {
	// Stockman & Sharpe (2000) 2° fundamentals, linear energy.
	expect(peak(0)).toBe(570);
	expect(peak(1)).toBe(543);
	expect(peak(2)).toBe(442);
	// L peaks in the yellow-green, not the red; L and M are both strong across 530–570 nm.
	for (const nm of [530, 550, 570]) {
		expect(cones(nm)[0]).toBeGreaterThan(0.75);
		expect(cones(nm)[1]).toBeGreaterThan(0.75);
	}
	// S barely responds beyond 560 nm.
	expect(cones(580)[2]).toBeLessThan(0.001);
});

test('the CIE 170-2 matrix turns the cone curves into CVRL’s 2012 XYZ functions', () => {
	let worst = 0;
	LMS.forEach((row, i) => {
		const xyz = toXYZ([row[0], row[1], row[2]]);
		for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(xyz[k] - XYZ[i][k]));
	});
	expect(worst).toBeLessThan(1e-4);
	// ȳ (brightness) peaks near 555 nm.
	const yPeak = XYZ.reduce((b, r, i) => (r[1] > XYZ[b][1] ? i : b), 0) + NM0;
	expect(Math.abs(yPeak - 555)).toBeLessThanOrEqual(2);
});

test('one kind of cone cannot tell a colour from a brightness', () => {
	// The M cone gives the same signal to 500 nm light and to a dimmer 543 nm light…
	const m500 = cones(500)[1];
	const dim543 = response([{ nm: 543, power: m500 / cones(543)[1] }]);
	expect(dim543[1]).toBeCloseTo(m500, 9);
	// …but the L and S cones respond to them quite differently.
	expect(Math.abs(dim543[0] - cones(500)[0])).toBeGreaterThan(0.05);
	expect(Math.abs(dim543[2] - cones(500)[2])).toBeGreaterThan(0.05);
});

const target = (id: string) => {
	const t = TARGETS.find((x) => x.id === id);
	if (!t) throw new Error(id);
	return { ...t, c: response(t.lines) };
};

test('three laser lines match sunlight exactly: different light, same cone signals, same colour', () => {
	const sun = target('sun');
	const w = matchFor(sun.c);
	expect(w.every((v) => v > 0)).toBe(true);
	expect(bestMatch(sun.c).mismatch).toBeLessThan(0.005);
	// The exact mix gives identical pixels to the continuous spectrum.
	expect(cssColour(response(mixture(...w)), 0.01)).toBe(cssColour(sun.c, 0.01));
	// Yet the spectra share nothing: the mix is three lines, sunlight covers every wavelength.
	expect(sun.lines.length).toBeGreaterThan(300);
	expect(mixture(...w).map((l) => l.nm)).toEqual(PRIMARIES.map((p) => p.nm));
});

test('red and green laser light match a sodium lamp’s yellow to within a fraction of a per cent', () => {
	const na = target('sodium');
	// Matching it exactly would need a little negative blue (blue light added to the lamp).
	const w = matchFor(na.c);
	expect(w[2]).toBeLessThan(0);
	expect(w[2]).toBeGreaterThan(-0.01);
	const best = bestMatch(na.c);
	expect(best.rgb[2]).toBe(0);
	expect(best.mismatch).toBeGreaterThan(0.0025); // "about 0.3%"
	expect(best.mismatch).toBeLessThan(0.0035);
	// The only difference left is in the S cones.
	const mix = response(mixture(...best.rgb));
	const d = [0, 1, 2].map((k) => Math.abs(mix[k] - na.c[k]));
	expect(d[2]).toBeGreaterThan(d[0]);
	expect(d[2]).toBeGreaterThan(d[1]);
});

test('no mixture of the three lasers matches the 490 nm blue-green laser', () => {
	const cyan = target('cyan');
	expect(matchFor(cyan.c)[0]).toBeLessThan(-0.1); // it would need negative red
	expect(bestMatch(cyan.c).mismatch).toBeGreaterThan(0.045); // "5% off"
	expect(bestMatch(cyan.c).mismatch).toBeLessThan(0.055);
});

test('the opponent channels: white is neutral, red, green, blue and yellow on their sides', () => {
	const white = response(mixture(1, 1, 1));
	expect(Math.abs(opponent(white).redGreen)).toBeLessThan(1e-9);
	expect(Math.abs(opponent(white).blueYellow)).toBeLessThan(1e-9);
	expect(opponent(cones(650)).redGreen).toBeGreaterThan(0.5);
	expect(opponent(cones(520)).redGreen).toBeLessThan(-0.1);
	expect(opponent(cones(450)).blueYellow).toBeGreaterThan(0.5);
	expect(opponent(cones(580)).blueYellow).toBeLessThan(-0.5);
	// Yellow is not a reddish green: it sits near neutral on the red–green channel.
	expect(Math.abs(opponent(cones(578)).redGreen)).toBeLessThan(0.1);
});

test('brightness is mostly L: it peaks near 555 nm, like the eye’s daylight sensitivity', () => {
	let top = 400;
	for (let nm = 400; nm <= 700; nm++)
		if (opponent(cones(nm)).bright > opponent(cones(top)).bright) top = nm;
	expect(Math.abs(top - 555)).toBeLessThanOrEqual(3);
});

test('the plain L-against-M channel reads blue light greenish, greener than green light', () => {
	for (const nm of [440, 460, 475, 490]) expect(opponent(cones(nm)).redGreen).toBeLessThan(-0.1);
	expect(opponent(cones(460)).redGreen).toBeLessThan(opponent(cones(520)).redGreen);
});

test('the afterimage scene’s predicted swatches lean the way its labels say', () => {
	const channel = { reddish: 0, greenish: 1, bluish: 2 } as const;
	for (const d of AFTER_DISCS) {
		const rgb = cssColour(afterimageOf(d.rgb)).match(/\d+/g)!.map(Number);
		const k = channel[d.after];
		for (let j = 0; j < 3; j++) if (j !== k) expect(rgb[k], d.id).toBeGreaterThan(rgb[j] + 10);
	}
});

test('after staring at a colour, a grey looks like its opposite', () => {
	const grey = response(mixture(0.5, 0.5, 0.5));
	const cyan = response(mixture(0, 0.6, 0.6));
	expect(opponent(afterimage(cyan, grey, 0.6)).redGreen).toBeGreaterThan(0.05); // reddish
	const yellow = response(mixture(0.6, 0.6, 0));
	expect(opponent(afterimage(yellow, grey, 0.6)).blueYellow).toBeGreaterThan(0.05); // bluish
	// Staring at the grey itself changes nothing.
	expect(mismatch(afterimage(grey, grey, 1), grey)).toBeLessThan(1e-12);
});

test('screen pixels turn into cone signals and back into the same pixels', () => {
	for (const [r, g, b] of [
		[128, 128, 128],
		[0, 190, 190],
		[230, 200, 0],
		[200, 40, 200]
	]) {
		expect(cssColour(conesOfRGB(r, g, b))).toBe(`rgb(${r}, ${g}, ${b})`);
	}
	// A screen's grey is close to neutral on the red–green channel.
	const grey = opponent(conesOfRGB(128, 128, 128));
	expect(Math.abs(grey.redGreen)).toBeLessThan(0.05);
});
