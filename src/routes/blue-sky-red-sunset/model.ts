/**
 * Why the sky is blue and sunsets red: sunlight scattered by air, worked out colour by colour.
 *
 * Sunlight above the air is a Planck spectrum at the Sun's effective temperature, 5772 K (the IAU
 * 2015 nominal value), sampled every 5 nm from 380 to 780 nm. Air scatters it with Rayleigh's
 * fourth-power law: the vertical optical depth of the whole atmosphere at sea level is the fit of
 * Hansen & Travis (1974), 0.0973 at 550 nm (Bodhaine et al. 1999 give 0.0973 too). Haze or smoke
 * adds an aerosol optical depth with Ångström's law (exponent 1.3, the typical value he found),
 * scattering mostly forwards (Henyey-Greenstein, g = 0.7) and absorbing a tenth of what it meets
 * (single-scattering albedo 0.9).
 *
 * The air is flat and layered (every scatterer with the same vertical profile), and light is
 * scattered once: a view direction's light is the sunlight scattered into it at every height,
 * dimmed on the way down from the top of the air to that height and on the way from there to the
 * eye. The amount of air on a slanted path, relative to straight up, is the air mass of Kasten &
 * Young (1989), which follows the Earth's curve near the horizon (about 38 at the horizon). Light
 * scattered twice or more, ozone and the ground's reflection are left out.
 *
 * Colours: the spectrum → CIE 1931 XYZ with the multi-lobe analytic fit of Wyman, Sloan & Shirley
 * (JCGT 2013) → linear sRGB (IEC 61966-2-1), white-balanced so that sunlight above the air is
 * white (the eye adapts to daylight), then the sRGB curve.
 */

// ------------------------------------------------------------------ sunlight

/** Wavelengths sampled, nm. */
export const NM: readonly number[] = Array.from({ length: 81 }, (_, i) => 380 + 5 * i);

/** The Sun's effective temperature, K (IAU 2015 Resolution B3). */
export const SUN_K = 5772;

/** Planck's law: spectral radiance of a black body at T kelvin at `nm` (arbitrary scale). */
export function planck(nm: number, T = SUN_K): number {
	const l = nm * 1e-9;
	const h = 6.62607015e-34;
	const c = 299792458;
	const k = 1.380649e-23;
	return 1 / (l ** 5 * (Math.exp((h * c) / (l * k * T)) - 1));
}

const PLANCK_550 = planck(550);
/** Sunlight above the air, 1 at 550 nm. */
export const sunlight = (nm: number) => planck(nm) / PLANCK_550;

// ------------------------------------------------------------------ air and haze

/**
 * Rayleigh optical depth of the whole atmosphere straight up from sea level (Hansen & Travis
 * 1974, eq. 2.29): the share of light at `nm` that a vertical crossing scatters away is
 * 1 − e^(−depth).
 */
export function rayleighDepth(nm: number): number {
	const um = nm / 1000;
	return 0.008569 * um ** -4 * (1 + 0.0113 * um ** -2 + 0.00013 * um ** -4);
}

/** Ångström exponent of the haze (Ångström's typical value). */
export const ANGSTROM = 1.3;
/** Haze scatters mostly forwards (Henyey-Greenstein asymmetry). */
const HAZE_G = 0.7;
/** Share of the light a haze or smoke particle meets that it scatters rather than absorbs. */
const HAZE_ALBEDO = 0.9;

/**
 * Optical depth of haze straight up at `nm`, for `smoke` = its optical depth at 550 nm (0 for
 * clean air; about 0.1 is ordinary haze, 1 thick wildfire smoke).
 */
export const hazeDepth = (nm: number, smoke: number) => smoke * (nm / 550) ** -ANGSTROM;

/** Rayleigh phase function (per steradian) for a scattering angle `theta` (radians). */
const rayleighPhase = (theta: number) => (3 / (16 * Math.PI)) * (1 + Math.cos(theta) ** 2);
/** Henyey-Greenstein phase function (per steradian). */
const hgPhase = (theta: number, g = HAZE_G) =>
	(1 - g * g) / (4 * Math.PI * (1 + g * g - 2 * g * Math.cos(theta)) ** 1.5);

// ------------------------------------------------------------------ geometry

/**
 * How much air a path crosses towards something `elevation` degrees above the horizon, relative
 * to straight up (Kasten & Young 1989). 1 overhead, about 2 at 30°, about 38 at the horizon.
 */
export function airMass(elevation: number): number {
	const e = Math.max(0, Math.min(90, elevation));
	const z = 90 - e;
	return 1 / (Math.cos((z * Math.PI) / 180) + 0.50572 * (96.07995 - z) ** -1.6364);
}

/** Latitude of the place on the page, degrees north (Madrid, New York and Beijing are near it). */
export const LATITUDE = 40;

export interface Direction {
	/** Degrees above the horizon. */
	elevation: number;
	/** Compass bearing, degrees clockwise from north (90 east, 180 south, 270 west). */
	azimuth: number;
}

/**
 * Where the Sun is at local solar time `hour` on an equinox at `LATITUDE`: it rises due east at
 * 6, is highest in the south at noon (50° up) and sets due west at 18. The Earth turns 15° an
 * hour; the Sun's declination is 0 on an equinox.
 */
export function sunAt(hour: number): Direction {
	const h = ((hour - 12) * 15 * Math.PI) / 180;
	const f = (LATITUDE * Math.PI) / 180;
	const east = -Math.sin(h);
	const north = -Math.sin(f) * Math.cos(h);
	const up = Math.cos(f) * Math.cos(h);
	const deg = 180 / Math.PI;
	return {
		elevation: Math.asin(Math.max(-1, Math.min(1, up))) * deg,
		azimuth: (Math.atan2(east, north) * deg + 360) % 360
	};
}

/** The angle between two directions in the sky, degrees. */
export function apart(a: Direction, b: Direction): number {
	const r = Math.PI / 180;
	const c =
		Math.sin(a.elevation * r) * Math.sin(b.elevation * r) +
		Math.cos(a.elevation * r) * Math.cos(b.elevation * r) * Math.cos((a.azimuth - b.azimuth) * r);
	return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}

// ------------------------------------------------------------------ the two spectra

export interface Sky {
	/** The amount of air, relative to the Earth's (1); 0 for no air, as on the Moon. */
	air?: number;
	/** Haze or smoke: its vertical optical depth at 550 nm (0 for none). */
	smoke?: number;
}

// The sampled spectra, worked out once (the sky is drawn from a few hundred of these a frame).
const SUNLIGHT = NM.map(sunlight);
const RAYLEIGH = NM.map(rayleighDepth);
const HAZE = NM.map((nm) => hazeDepth(nm, 1));

/** Total vertical optical depth at `nm`. */
const depth = (nm: number, s: Sky) =>
	(s.air ?? 1) * rayleighDepth(nm) + hazeDepth(nm, s.smoke ?? 0);

/** Share of the light at `nm` that gets straight through the air from a Sun `elevation`° up. */
export function transmitted(nm: number, elevation: number, s: Sky = {}): number {
	if (elevation < 0) return 0;
	return Math.exp(-depth(nm, s) * airMass(elevation));
}

/** The Sun's own disc as seen from the ground: sunlight dimmed along its path through the air. */
export function sunSpectrum(elevation: number, s: Sky = {}): number[] {
	return NM.map((nm) => sunlight(nm) * transmitted(nm, elevation, s));
}

/**
 * The light from the patch of sky in direction `view`, with the Sun in direction `sun`: sunlight
 * scattered once into the line of sight at every height, per unit of sunlight above the air and
 * per steradian.
 */
export function skySpectrum(view: Direction, sun: Direction, s: Sky = {}): number[] {
	if (sun.elevation < 0) return NM.map(() => 0);
	const ms = airMass(sun.elevation);
	const mv = airMass(view.elevation);
	const theta = (apart(view, sun) * Math.PI) / 180;
	const air = s.air ?? 1;
	const smoke = s.smoke ?? 0;
	const pR = rayleighPhase(theta);
	const pH = hgPhase(theta);
	return NM.map((_, i) => {
		const tR = air * RAYLEIGH[i];
		const tH = smoke * HAZE[i];
		const tau = tR + tH;
		if (tau <= 0) return 0;
		// Scattering per unit optical depth, then the path integral along the view direction:
		// sunlight comes down `ms` times as steeply, and leaves towards the eye `mv` times.
		const scatter = (tR * pR + HAZE_ALBEDO * tH * pH) / tau;
		const d = ms - mv;
		const path =
			Math.abs(d) < 1e-6
				? mv * tau * Math.exp(-mv * tau)
				: (mv * (Math.exp(-mv * tau) - Math.exp(-ms * tau))) / d;
		return SUNLIGHT[i] * scatter * path;
	});
}

/** The patch of sky straight overhead. */
export const zenithSpectrum = (sun: Direction, s: Sky = {}) =>
	skySpectrum({ elevation: 90, azimuth: 0 }, sun, s);

// ------------------------------------------------------------------ colour

/** One lobe of the Wyman-Sloan-Shirley fit: a Gaussian with different widths on each side. */
const lobe = (x: number, mu: number, s1: number, s2: number) =>
	Math.exp(-0.5 * ((x - mu) / (x < mu ? s1 : s2)) ** 2);

/** CIE 1931 2° colour-matching functions at `nm` (Wyman, Sloan & Shirley 2013, multi-lobe fit). */
export function cmf(nm: number): [number, number, number] {
	return [
		1.056 * lobe(nm, 599.8, 37.9, 31.0) +
			0.362 * lobe(nm, 442.0, 16.0, 26.7) -
			0.065 * lobe(nm, 501.1, 20.4, 26.2),
		0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
		1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8)
	];
}
const CMF = NM.map(cmf);

/** CIE XYZ of a spectrum sampled at `NM`. */
export function xyz(spectrum: readonly number[]): [number, number, number] {
	const out: [number, number, number] = [0, 0, 0];
	spectrum.forEach((p, i) => {
		for (let k = 0; k < 3; k++) out[k] += p * CMF[i][k] * 5;
	});
	return out;
}

/** IEC 61966-2-1 (sRGB): XYZ → linear R, G, B. */
const toLinear = ([X, Y, Z]: readonly number[]): [number, number, number] => [
	3.2406 * X - 1.5372 * Y - 0.4986 * Z,
	-0.9689 * X + 1.8758 * Y + 0.0415 * Z,
	0.0557 * X - 0.204 * Y + 1.057 * Z
];

/** Linear sRGB of sunlight above the air: the white the screen colours are balanced to. */
const WHITE = toLinear(xyz(NM.map(sunlight)));

/** White-balanced linear R, G, B of a spectrum (sunlight above the air → equal channels). */
export function balancedRGB(spectrum: readonly number[]): [number, number, number] {
	const rgb = toLinear(xyz(spectrum));
	return [rgb[0] / WHITE[0], rgb[1] / WHITE[1], rgb[2] / WHITE[2]];
}

const encode = (v: number) => {
	const x = Math.min(1, Math.max(0, v));
	return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

/**
 * Screen colour of a spectrum as CSS, scaled by `exposure`. Colours the screen cannot show are
 * brought into range: negative channels become zero, and a channel above 1 darkens all three in
 * proportion (so a dazzling light keeps its hue).
 */
export function screenColour(spectrum: readonly number[], exposure = 1): string {
	let rgb = balancedRGB(spectrum).map((v) => Math.max(0, v * exposure));
	const hi = Math.max(...rgb);
	if (hi > 1) rgb = rgb.map((v) => v / hi);
	const h = (v: number) => Math.round(encode(v) * 255);
	return `rgb(${h(rgb[0])}, ${h(rgb[1])}, ${h(rgb[2])})`;
}

/** Screen colour of a light too bright to show at its real brightness (the Sun's disc): full brightness, its own hue. */
export const glareColour = (spectrum: readonly number[]) =>
	screenColour(spectrum, 1 / Math.max(1e-12, ...balancedRGB(spectrum)));

/**
 * The sky's exposure: the clear sky overhead at noon shows its brightest channel at 0.8, so a
 * dimmer sky shows darker and a brighter one paler.
 */
export const SKY_EXPOSURE = 0.8 / Math.max(...balancedRGB(zenithSpectrum(sunAt(12))));

/** Chromaticity (x, y) of a spectrum. */
export function chromaticity(spectrum: readonly number[]): [number, number] {
	const [X, Y, Z] = xyz(spectrum);
	return [X / (X + Y + Z), Y / (X + Y + Z)];
}

/**
 * The single wavelength whose colour, mixed with white sunlight, matches the spectrum's hue (its
 * dominant wavelength), nm; NaN for a purple, which no single wavelength gives.
 */
export function dominantWavelength(spectrum: readonly number[]): number {
	const [wx, wy] = chromaticity(NM.map(sunlight));
	const [x, y] = chromaticity(spectrum);
	const angle = Math.atan2(y - wy, x - wx);
	let best = NaN;
	let bestD = Infinity;
	for (let nm = 400; nm <= 700; nm += 0.5) {
		const [X, Y, Z] = cmf(nm);
		const sx = X / (X + Y + Z);
		const sy = Y / (X + Y + Z);
		let d = Math.abs(Math.atan2(sy - wy, sx - wx) - angle);
		d = Math.min(d, 2 * Math.PI - d);
		if (d < bestD) {
			bestD = d;
			best = nm;
		}
	}
	return bestD < 0.02 ? best : NaN;
}

/** Relative brightness (CIE Y) of a spectrum. */
export const luminance = (spectrum: readonly number[]) => xyz(spectrum)[1];

/** How bright the eye finds one unit of light at `nm`, 1 at its most sensitive (the CIE 1931 ȳ). */
export const eyeSensitivity = (nm: number) => cmf(nm)[1];
