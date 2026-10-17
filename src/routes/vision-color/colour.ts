/**
 * Colour from the three cone types: measured cone sensitivities, mixtures of lights, the
 * opponent channels, and how to show a light's colour on a screen.
 *
 * Cone sensitivities: Stockman & Sharpe (2000) 2° cone fundamentals (CIE 170-1:2006), from CVRL,
 * in linear energy units, each normalised to a peak of 1 (cone-data.ts). A light is a list of
 * spectral lines (wavelength, power); a cone's response is the sum of power × sensitivity.
 *
 * Display: L, M, S → CIE 2012 2° XYZ with the matrix of CIE 170-2:2015 (checked against CVRL's
 * XYZ table in the model tests) → linear sRGB with the IEC 61966-2-1 matrix → the sRGB curve.
 * sRGB is defined on the 1931 XYZ functions, so feeding it 2012 XYZ is an approximation, used
 * only to choose pixel colours. Colours outside the screen's range are brought into it (negative
 * channels are set to zero), the same way for every light, so two lights with equal cone responses always
 * get identical pixels.
 */
import { LMS, NM0, NM1 } from './cone-data';

export type Cones = [number, number, number];
export interface Line {
	nm: number;
	power: number;
}

/** Cone sensitivities at a wavelength (linear between the 1 nm rows; 0 outside 390–780 nm). */
export function cones(nm: number): Cones {
	if (!(nm >= NM0 && nm <= NM1)) return [0, 0, 0];
	const i = Math.min(Math.floor(nm - NM0), NM1 - NM0 - 1);
	const f = nm - NM0 - i;
	const a = LMS[i];
	const b = LMS[i + 1];
	return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
}

/** Cone responses to a light made of spectral lines. */
export function response(lines: readonly Line[]): Cones {
	const out: Cones = [0, 0, 0];
	for (const { nm, power } of lines) {
		const c = cones(nm);
		for (let k = 0; k < 3; k++) out[k] += power * c[k];
	}
	return out;
}

/** Wavelength of each cone's peak sensitivity, nm. */
export function peak(k: 0 | 1 | 2): number {
	let best = NM0;
	for (let nm = NM0; nm <= NM1; nm++) if (LMS[nm - NM0][k] > LMS[best - NM0][k]) best = nm;
	return best;
}

// ------------------------------------------------------------------ display

/** CIE 170-2:2015: the 2012 2° XYZ functions as combinations of the 2006 2° L, M, S. */
export const LMS_TO_XYZ = [
	[1.94735469, -1.41445123, 0.36476327],
	[0.68990272, 0.34832189, 0],
	[0, 0, 1.93485343]
] as const;
/** IEC 61966-2-1 (sRGB): XYZ → linear R, G, B. */
const XYZ_TO_RGB = [
	[3.2406, -1.5372, -0.4986],
	[-0.9689, 1.8758, 0.0415],
	[0.0557, -0.204, 1.057]
] as const;

const apply = (m: readonly (readonly number[])[], v: readonly number[]): Cones => [
	m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
	m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
	m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
];

export const toXYZ = (c: Cones): Cones => apply(LMS_TO_XYZ, c);

/** Linear sRGB of cone responses (unclipped: may be negative or above 1). */
export const linearRGB = (c: Cones): Cones => apply(XYZ_TO_RGB, toXYZ(c));

const det3 = (m: readonly (readonly number[])[]) =>
	m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
	m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
	m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const inverse3 = (m: readonly (readonly number[])[]): number[][] => {
	const d = det3(m);
	const c = (r: number, k: number) => {
		const rows = [0, 1, 2].filter((i) => i !== r);
		const cols = [0, 1, 2].filter((j) => j !== k);
		const minor =
			m[rows[0]][cols[0]] * m[rows[1]][cols[1]] - m[rows[0]][cols[1]] * m[rows[1]][cols[0]];
		return ((r + k) % 2 ? -minor : minor) / d;
	};
	return [0, 1, 2].map((i) => [0, 1, 2].map((j) => c(j, i)));
};
const RGB_TO_LMS = (() => {
	const toXYZ = inverse3(XYZ_TO_RGB);
	const toLMS = inverse3(LMS_TO_XYZ);
	return [0, 1, 2].map((i) =>
		[0, 1, 2].map(
			(j) => toLMS[i][0] * toXYZ[0][j] + toLMS[i][1] * toXYZ[1][j] + toLMS[i][2] * toXYZ[2][j]
		)
	);
})();
const decode = (v: number) => {
	const x = v / 255;
	return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
/**
 * Cone responses to a screen pixel of sRGB colour (0–255 per channel): the display pipeline run
 * backwards, so that `cssColour(conesOfRGB(r, g, b))` gives back the same pixel.
 */
export function conesOfRGB(r: number, g: number, b: number): Cones {
	return apply(RGB_TO_LMS, [decode(r), decode(g), decode(b)]);
}

/** Whether the screen can show these cone responses exactly (no negative R, G or B). */
export const onScreen = (c: Cones) => linearRGB(c).every((v) => v >= -1e-9);

const encode = (v: number) => {
	const x = Math.min(1, Math.max(0, v));
	return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

/**
 * The screen colour for cone responses, as CSS. `exposure` scales the light first; the result is
 * then brought into the screen's range: negative channels are set to zero, and a channel above 1
 * darkens all three in proportion.
 */
export function cssColour(c: Cones, exposure = 1): string {
	let rgb = linearRGB([c[0] * exposure, c[1] * exposure, c[2] * exposure]).map((v) =>
		Math.max(0, v)
	) as Cones;
	const hi = Math.max(...rgb);
	if (hi > 1) rgb = rgb.map((v) => v / hi) as Cones;
	const h = (v: number) => Math.round(encode(v) * 255);
	return `rgb(${h(rgb[0])}, ${h(rgb[1])}, ${h(rgb[2])})`;
}

/** Exposure that shows the brightest channel of these cone responses at `level` (0…1). */
export function exposureFor(c: Cones, level = 0.92): number {
	return level / Math.max(1e-9, ...linearRGB(c));
}

/** The colour of a single wavelength on the screen, at a fixed brightness. */
export function spectralColour(nm: number, level = 0.92): string {
	const c = cones(nm);
	if (c[0] + c[1] + c[2] < 1e-6) return cssColour([0, 0, 0]);
	return cssColour(c, exposureFor(c, level));
}

// ------------------------------------------------------------------ mixing lights

/** Three laser lines (the ITU-R BT.2020 primaries, 630, 532 and 467 nm). */
export const PRIMARIES = [
	{ id: 'r', nm: 630, name: 'red' },
	{ id: 'g', nm: 532, name: 'green' },
	{ id: 'b', nm: 467, name: 'blue' }
] as const;

/** Total cone response to equal energy at every wavelength 390–780 nm (1 per nm). */
const EQUAL_ENERGY: Cones = (() => {
	const out: Cones = [0, 0, 0];
	for (const row of LMS) for (let k = 0; k < 3; k++) out[k] += row[k];
	return out;
})();

const PRIMARY_CONES = PRIMARIES.map((p) => cones(p.nm));
/** Columns: cone responses of 1 W of each primary. */
const P = [0, 1, 2].map((k) => PRIMARY_CONES.map((c) => c[k]));
/** Powers of the three lasers whose mixture has the cone responses `c` (may be negative). */
function powersFor(c: Cones): Cones {
	const d = det3(P);
	return [0, 1, 2].map(
		(j) => det3(P.map((row, i) => row.map((x, col) => (col === j ? c[i] : x)))) / d
	) as Cones;
}

/**
 * One unit of each slider is the power of that laser in the mixture that matches equal-energy
 * white, scaled so that 1, 1, 1 matches a white of total power 1.
 */
export const UNIT: Cones = powersFor(EQUAL_ENERGY);

/** The light from the three lasers at slider settings r, g, b (units of `UNIT`). */
export function mixture(r: number, g: number, b: number): Line[] {
	return PRIMARIES.map((p, i) => ({ nm: p.nm, power: [r, g, b][i] * UNIT[i] }));
}

/** Slider settings that match the cone responses `c` exactly (negative: impossible). */
export function matchFor(c: Cones): Cones {
	const w = powersFor(c);
	return [w[0] / UNIT[0], w[1] / UNIT[1], w[2] / UNIT[2]];
}

/** Planck's law: spectral radiance of a black body at T kelvin, at `nm` (arbitrary scale). */
export function planck(nm: number, T: number): number {
	const l = nm * 1e-9;
	const h = 6.62607015e-34;
	const c = 299792458;
	const k = 1.380649e-23;
	return 1 / (l ** 5 * (Math.exp((h * c) / (l * k * T)) - 1));
}

/** A black body's light as 1 nm lines from 390 to 780 nm, scaled to a total power of 1. */
export function blackBody(T: number): Line[] {
	const lines: Line[] = [];
	for (let nm = NM0; nm <= NM1; nm++) lines.push({ nm, power: planck(nm, T) });
	const sum = lines.reduce((s, l) => s + l.power, 0);
	return lines.map((l) => ({ nm: l.nm, power: l.power / sum }));
}

export interface Target {
	id: string;
	label: string;
	/** The target light, scaled so its exact match needs a largest slider of 0.75. */
	lines: Line[];
	/** Shown as a spectrum: a continuous curve or single lines. */
	continuous: boolean;
}

function target(id: string, label: string, raw: Line[], continuous: boolean): Target {
	const w = matchFor(response(raw));
	const s = 0.75 / Math.max(...w);
	return { id, label, continuous, lines: raw.map((l) => ({ nm: l.nm, power: l.power * s })) };
}

/** The lights to match. */
export const TARGETS: Target[] = [
	target('sun', 'Sunlight (a 5800 K glow)', blackBody(5800), true),
	target('sodium', 'Low-pressure sodium lamp (589 nm)', [{ nm: 589, power: 1 }], false),
	target('bulb', 'Light bulb (a 2700 K glow)', blackBody(2700), true),
	target('cyan', 'Blue-green laser (490 nm)', [{ nm: 490, power: 1 }], false)
];

/**
 * How far apart two lights look to the cones: the largest difference between their responses,
 * as a fraction of the target's L + M response (a rough guide to brightness).
 */
export function mismatch(a: Cones, target: Cones): number {
	const scale = target[0] + target[1];
	return Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - target[k]))) / scale;
}
/** Below this mismatch the page calls two lights a match. */
export const MATCHED = 0.02;

/**
 * The best match the three lasers can make with zero or positive powers, on a 0.01 grid of the
 * sliders: the smallest `mismatch`, by trying every point of the grid (about a million
 * mixtures). Exact, with no search, for targets inside the lasers' range.
 */
export function bestMatch(c: Cones): { rgb: Cones; mismatch: number } {
	const exact = matchFor(c);
	if (exact.every((v) => v >= 0)) {
		const rgb = exact.map((v) => Math.round(v * 100) / 100) as Cones;
		return { rgb, mismatch: mismatch(response(mixture(...rgb)), c) };
	}
	let best = { rgb: [0, 0, 0] as Cones, mismatch: Infinity };
	for (let r = 0; r <= 100; r++)
		for (let g = 0; g <= 100; g++) {
			for (let b = 0; b <= 100; b++) {
				const rgb: Cones = [r / 100, g / 100, b / 100];
				const m = mismatch(response(mixture(...rgb)), c);
				if (m < best.mismatch) best = { rgb, mismatch: m };
			}
		}
	return best;
}

// ------------------------------------------------------------------ opponent channels

/**
 * The three channels the brain compares, built from the cone signals by the retina's ganglion
 * cells: brightness, mostly L and some M (the CIE luminance ȳ = 0.690·L + 0.348·M, the middle row
 * of LMS_TO_XYZ); red–green, L plus a little S (c·S) against a·M; blue–yellow, S against
 * b·(L + M). The weights a and b are set so that equal-energy white is neutral on both colour
 * channels (as in the Derrington–Krauskopf–Lennie axes). The plain L-against-M comparison of the
 * retina reads all blue light as greenish; the hues people name are not on that axis, and need
 * some S on the red side (Webster et al. 2000, JOSA A 17: 1545). Here c is set so that the
 * blue of UNIQUE_BLUE nm, which looks neither reddish nor greenish, is neutral too. Each colour
 * channel is returned as a contrast between its two sides, from −1 (all green, all yellow) to
 * +1 (all red, all blue).
 */
export const UNIQUE_BLUE = 475;
const U = cones(UNIQUE_BLUE);
const EE = EQUAL_ENERGY;
const C_RG = (U[1] * EE[0] - U[0] * EE[1]) / (U[2] * EE[1] - U[1] * EE[2]);
const A_RG = (EE[0] + C_RG * EE[2]) / EE[1];
const B_BY = EE[2] / (EE[0] + EE[1]);
export function opponent(c: Cones): { bright: number; redGreen: number; blueYellow: number } {
	const lm = c[0] + c[1];
	if (lm <= 0) return { bright: 0, redGreen: 0, blueYellow: 0 };
	const red = c[0] + C_RG * c[2];
	return {
		bright: LMS_TO_XYZ[1][0] * c[0] + LMS_TO_XYZ[1][1] * c[1],
		redGreen: (red - A_RG * c[1]) / (red + A_RG * c[1]),
		blueYellow: (c[2] - B_BY * lm) / (c[2] + B_BY * lm)
	};
}

// ------------------------------------------------------------------ afterimages

/**
 * Afterimage (a von Kries model of adaptation): staring at a colour for a while turns each
 * cone type's sensitivity down in proportion to how strongly it was stimulated. Each cone's gain
 * becomes 1 / (1 + s·(stared_k / grey_k − 1)) relative to its gain on the grey, where s (0…1)
 * says how far the adaptation has gone; then the grey is seen through those gains. Returns the
 * cone signals the grey now produces.
 */
export function afterimage(stared: Cones, grey: Cones, s: number): Cones {
	return [0, 1, 2].map((k) => {
		const ratio = grey[k] > 0 ? stared[k] / grey[k] : 1;
		return grey[k] / Math.max(0.05, 1 + s * (ratio - 1));
	}) as Cones;
}
