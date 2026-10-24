/**
 * Why a light bulb glows: the tungsten wire of an old-style 60 W, 230 V bulb, heated by the
 * electricity squeezing through it, and where that electricity ends up.
 *
 * The wire. In the steady state the electricity going in (the push squared over the wire's
 * resistance) equals what the hot wire radiates (its emissivity × Stefan-Boltzmann × its area ×
 * the fourth power of its temperature, less what it gets back from the room). Tungsten's
 * resistivity and its total emissivity both rise with temperature: published tables, below. The
 * wire's length and thickness are set so that the bulb takes 60 W at the full 230 V with the wire
 * at 2700 K, the usual filament temperature of a household bulb; everything else follows from the
 * tables. The model leaves out the heat the wire loses to the gas in the bulb and to its support
 * wires (in a real 60 W bulb, roughly a tenth), and treats the wire as a grey body: it glows with
 * the shape of a perfect glower's (black body's) spectrum, scaled by its total emissivity.
 * Real tungsten glows a little more strongly in visible light than in infrared, which roughly
 * makes up for the gas's share: the model's 60 W bulb gives about 740 lumens, a real one 700 to
 * 800.
 *
 * The light. "Light" is counted as the eye counts it: the spectrum weighted by the eye's daylight
 * sensitivity V(λ) (the CIE 1931 ȳ), in lumens; 683 lumens is one watt of the yellow-green light
 * the eye sees best. The rest of the electricity is counted as heat. The colour of the glow is the
 * spectrum's CIE 1931 XYZ, turned into sRGB (IEC 61966-2-1) and balanced so that the bulb at full
 * looks white, as it does to eyes (or a camera) that have got used to its light.
 *
 * The LED bulb: a typical white LED bulb gives 100 lumens per watt of electricity (an 806-lumen
 * bulb on 8 W).
 */
import { CMF, CMF_NM0, CMF_STEP } from './cie-data';

// ------------------------------------------------------------------ tungsten

/**
 * Resistivity of tungsten, [K, μΩ·cm]: the table of the CRC Handbook of Chemistry and Physics
 * (from Jones & Langmuir 1927 and Forsythe & Worthing 1925), read from the copy in
 * T. W. Zerda, "Stefan-Boltzmann Law" (Texas Christian University, 2001).
 */
export const RESISTIVITY: readonly (readonly [number, number])[] = [
	[300, 5.65],
	[400, 8.06],
	[600, 13.23],
	[800, 19.0],
	[1000, 24.93],
	[1200, 30.98],
	[1400, 37.19],
	[1500, 40.36],
	[1600, 43.55],
	[1800, 50.05],
	[2000, 56.67],
	[2200, 63.48],
	[2400, 70.39],
	[2500, 73.91],
	[2600, 77.49],
	[2700, 81.04],
	[2800, 84.7],
	[3000, 92.04],
	[3200, 99.54],
	[3400, 107.2]
];

/**
 * Total emissivity of tungsten, [K, ε]: Forsythe & Adams, "Radiating characteristics of tungsten
 * and tungsten lamps", J. Opt. Soc. Am. 35, 108 (1945), Table I. Below 1200 K the page takes
 * the emissivity in proportion to the temperature (a metal's total emissivity falls about that
 * way as it cools), which matters only before the wire glows.
 */
export const EMISSIVITY: readonly (readonly [number, number])[] = [
	[1200, 0.138],
	[1500, 0.192],
	[1800, 0.236],
	[2000, 0.259],
	[2200, 0.278],
	[2500, 0.301],
	[2600, 0.309],
	[2700, 0.315],
	[2800, 0.321],
	[2900, 0.329],
	[3000, 0.334],
	[3200, 0.341],
	[3400, 0.348]
];

function interp(table: readonly (readonly [number, number])[], x: number): number {
	if (x <= table[0][0]) return table[0][1];
	for (let i = 1; i < table.length; i++) {
		const [x1, y1] = table[i];
		if (x <= x1) {
			const [x0, y0] = table[i - 1];
			return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
		}
	}
	return table[table.length - 1][1];
}

/** Resistivity of tungsten at `kelvin`, in ohm metres. */
export const resistivity = (kelvin: number) => interp(RESISTIVITY, kelvin) * 1e-8;

/** Total emissivity of tungsten at `kelvin`. */
export const emissivity = (kelvin: number) =>
	kelvin < EMISSIVITY[0][0]
		? (EMISSIVITY[0][1] * kelvin) / EMISSIVITY[0][0]
		: interp(EMISSIVITY, kelvin);

// ------------------------------------------------------------------ the bulb

/** The mains push, volts (Europe, the UK). */
export const VOLTS = 230;
/** The bulb's power at full, watts. */
export const WATTS = 60;
/** The wire's temperature at full, kelvin. */
export const T_FULL = 2700;
/** The room, kelvin (20 °C). */
export const T_ROOM = 293;
/** Stefan-Boltzmann constant, W m⁻² K⁻⁴. */
const SIGMA = 5.670374e-8;

/** The wire's resistance hot, at full (ohms). */
const R_FULL = (VOLTS * VOLTS) / WATTS;
/** The wire's surface area (m²): it radiates the full 60 W at 2700 K. */
const AREA = WATTS / (emissivity(T_FULL) * SIGMA * (T_FULL ** 4 - T_ROOM ** 4));
/** The wire's length over its cross-section (m⁻¹), from its hot resistance. */
const L_OVER_S = R_FULL / resistivity(T_FULL);
/** The wire's thickness (m): area = π d L and L / (π d² / 4) = L_OVER_S. */
export const WIRE_DIAMETER = Math.cbrt((4 * AREA) / (Math.PI * Math.PI * L_OVER_S));
/** The wire's length, uncoiled (m). */
export const WIRE_LENGTH = AREA / (Math.PI * WIRE_DIAMETER);

/** Electricity the wire takes at `kelvin` with the push `volts` (W). */
const powerIn = (volts: number, kelvin: number) =>
	(volts * volts) / (resistivity(kelvin) * L_OVER_S);
/** What the wire radiates at `kelvin`, less what it gets back from the room (W). */
export const radiated = (kelvin: number) =>
	emissivity(kelvin) * SIGMA * AREA * (kelvin ** 4 - T_ROOM ** 4);

/**
 * The wire's steady temperature (K) with the dimmer at `dimmer` (0 off, 1 full: the share of the
 * full push it lets through).
 */
export function wireTemperature(dimmer: number): number {
	const volts = Math.min(1, Math.max(0, dimmer)) * VOLTS;
	if (volts <= 0) return T_ROOM;
	let lo = T_ROOM + 1e-6;
	let hi = 3600;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (powerIn(volts, mid) > radiated(mid)) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ------------------------------------------------------------------ the glow

const H = 6.62607015e-34;
const C = 299792458;
const K = 1.380649e-23;

/** A black body's spectral radiance at `nm` and `kelvin` (W m⁻² sr⁻¹ per nm). */
export function planck(nm: number, kelvin: number): number {
	const l = nm * 1e-9;
	const x = (H * C) / (l * K * kelvin);
	if (x > 700) return 0;
	return (2 * H * C * C) / l ** 5 / Math.expm1(x) / 1e9;
}

/** What the whole wire sends out at `nm` when it is at `kelvin`, W per nm. */
export const wireSpectrum = (nm: number, kelvin: number) =>
	emissivity(kelvin) * AREA * Math.PI * planck(nm, kelvin);

/** A black body's radiance over all wavelengths (W m⁻² sr⁻¹). */
const total = (kelvin: number) => (SIGMA * kelvin ** 4) / Math.PI;

/** CIE X, Y, Z of a black body's glow at `kelvin` (per unit radiance). */
function xyzOf(kelvin: number): [number, number, number] {
	const out: [number, number, number] = [0, 0, 0];
	CMF.forEach((c, i) => {
		const p = planck(CMF_NM0 + i * CMF_STEP, kelvin) * CMF_STEP;
		for (let k = 0; k < 3; k++) out[k] += p * c[k];
	});
	return out;
}

/** Chromaticity (x, y) of a black body's glow at `kelvin`. */
export function chromaticity(kelvin: number): [number, number] {
	const [X, Y, Z] = xyzOf(kelvin);
	return [X / (X + Y + Z), Y / (X + Y + Z)];
}

/** Share of a glow at `kelvin` that counts as light, weighted by the eye's sensitivity (0–1). */
export const lightShare = (kelvin: number) => xyzOf(kelvin)[1] / total(kelvin);

/** Share of a glow at `kelvin` beyond the red end of the rainbow (past 780 nm): infrared. */
export function infraredShare(kelvin: number): number {
	let visible = 0;
	for (let nm = 100; nm < 780; nm += 1) visible += planck(nm + 0.5, kelvin);
	return 1 - visible / total(kelvin);
}

/** Lumens per watt of light the eye sees best (555 nm). */
export const LM_PER_W = 683;

export interface Bulb {
	/** Dimmer setting, 0–1. */
	dimmer: number;
	/** Wire temperature, kelvin. */
	kelvin: number;
	/** Electricity in, watts. */
	watts: number;
	/** Light out, lumens. */
	lumens: number;
	/** The light as watts of the light the eye sees best (lumens / 683). */
	light: number;
	/** The rest, watts. */
	heat: number;
}

/** The old bulb with the dimmer at `dimmer`. */
export function bulb(dimmer: number): Bulb {
	const kelvin = wireTemperature(dimmer);
	const watts = dimmer <= 0 ? 0 : radiated(kelvin);
	const lumens = LM_PER_W * watts * lightShare(kelvin);
	const light = lumens / LM_PER_W;
	return { dimmer, kelvin, watts, lumens, light, heat: watts - light };
}

/** The old bulb at full. */
export const FULL = bulb(1);

/** A typical white LED bulb, lumens per watt of electricity. */
export const LED_EFFICACY = 100;

/** An LED bulb giving `lumens`. */
export function led(lumens: number): Bulb {
	const watts = lumens / LED_EFFICACY;
	const light = lumens / LM_PER_W;
	return { dimmer: 1, kelvin: T_ROOM, watts, lumens, light, heat: watts - light };
}

// ------------------------------------------------------------------ on the screen

/** IEC 61966-2-1 (sRGB): XYZ → linear R, G, B. */
const toLinear = ([X, Y, Z]: readonly number[]): [number, number, number] => [
	3.2406 * X - 1.5372 * Y - 0.4986 * Z,
	-0.9689 * X + 1.8758 * Y + 0.0415 * Z,
	0.0557 * X - 0.204 * Y + 1.057 * Z
];

/** Linear sRGB of the bulb at full: the white the glow's colours are balanced to. */
const WHITE = toLinear(xyzOf(T_FULL));

/** Balanced linear R, G, B of the glow at `kelvin`, brightest channel 1 (its hue, at full brightness). */
export function glowRGB(kelvin: number): [number, number, number] {
	const rgb = toLinear(xyzOf(kelvin)).map((v, k) => Math.max(0, v / WHITE[k]));
	const hi = Math.max(1e-30, ...rgb);
	return [rgb[0] / hi, rgb[1] / hi, rgb[2] / hi];
}

const encode = (v: number) => {
	const x = Math.min(1, Math.max(0, v));
	return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

/** The glow's colour at `kelvin` as CSS, at its full brightness. */
export function glowColour(kelvin: number): string {
	const h = (v: number) => Math.round(encode(v) * 255);
	const [r, g, b] = glowRGB(kelvin);
	return `rgb(${h(r)}, ${h(g)}, ${h(b)})`;
}

/** The Draper point: the temperature at which hot things start to glow a dim red in the dark (798 K). */
export const DRAPER = 798;

/** How bright the wire's glow looks per bit of surface (CIE Y × emissivity). */
const surfaceBrightness = (kelvin: number) => emissivity(kelvin) * xyzOf(kelvin)[1];
const DRAPER_Y = surfaceBrightness(DRAPER);
const FULL_Y = surfaceBrightness(T_FULL);

/**
 * How strongly to draw the glow, 0–1: 0 at the Draper point and below, 1 at full, in between on
 * a logarithmic scale (the eye judges brightness by ratios, and adapts to light a millionfold).
 */
export function glow(kelvin: number): number {
	if (kelvin <= DRAPER) return 0;
	const g = Math.log(surfaceBrightness(kelvin) / DRAPER_Y) / Math.log(FULL_Y / DRAPER_Y);
	return Math.min(1, Math.max(0, g));
}

/** A name for the glow's colour, from how it shows on the screen. */
export function glowName(kelvin: number): string {
	if (kelvin <= DRAPER) return 'no glow';
	const [, g, b] = glowRGB(kelvin).map(encode);
	if (b >= 0.85) return 'white';
	if (b >= 0.4) return 'yellowish white';
	if (g >= 0.75) return 'yellow';
	if (g >= 0.4) return 'orange';
	return kelvin < 1000 ? 'dull red' : 'red';
}

/** Celsius for the reader: to the nearest 50 above 500 °C, else to the nearest 10. */
export function celsius(kelvin: number): number {
	const c = kelvin - 273.15;
	return c >= 500 ? Math.round(c / 50) * 50 : Math.round(c / 10) * 10;
}
