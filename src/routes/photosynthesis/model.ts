/**
 * The photosynthesis rate model behind the "What limits the rate?" step: how
 * fast a leaf makes sugar and releases oxygen for a given light intensity,
 * light colour, CO₂ level and temperature.
 *
 * Two published models, chained:
 *
 * 1. **Leaf optics — PROSPECT-D** (Féret, Gitelson, Noble & Jacquemoud 2017,
 *    Remote Sensing of Environment 193:204–215). A leaf is a pile of N
 *    absorbing plates; from its pigment contents the model gives the fraction
 *    of light of each wavelength that the leaf reflects, transmits and absorbs.
 *    The specific absorption coefficients below are the published ones
 *    (`dataSpec_PDB`, 16 January 2017, as shipped in the `prosail` Python
 *    package), resampled every 5 nm over 400–700 nm and interpolated
 *    linearly in between. Water and anthocyanins are left out: neither absorbs
 *    noticeably in a green leaf's visible range.
 *
 * 2. **Leaf biochemistry — Farquhar, von Caemmerer & Berry (1980)**, the
 *    standard model of C₃ photosynthesis, in the form of von Caemmerer (2000,
 *    "Biochemical models of leaf photosynthesis"). Net CO₂ uptake is the
 *    smaller of two potential rates, minus the leaf's own respiration:
 *    - Wc, limited by RuBisCO and the CO₂ supply (the Calvin cycle);
 *    - Wj, limited by the electron transport that makes ATP and NADPH (light).
 *    Kinetic constants and their temperature responses are from Bernacchi
 *    et al. 2001 (Plant Cell Environ. 24:253–259); Vcmax and Jmax fall off at
 *    high temperature as in Kattge & Knorr 2007 (Plant Cell Environ.
 *    30:1176–1190), for leaves grown at 25 °C.
 *
 * Simplifications, stated on the page:
 * - one typical C₃ leaf (not C₄ or CAM), at steady state;
 * - the CO₂ inside the leaf is a fixed 70% of the air's (the stomata are
 *   not modelled);
 * - every photon the leaf absorbs counts the same, whatever its colour (in
 *   reality blue photons absorbed by carotenoids are used less efficiently:
 *   McCree 1972);
 * - the triose-phosphate-use limit is ignored;
 * - net O₂ released equals net CO₂ fixed (a photosynthetic quotient of 1),
 *   and sugar is counted as glucose: six CO₂ per glucose.
 */

// ---- leaf optics: PROSPECT-D -------------------------------------------------

/** First wavelength of the tables, their spacing and their last wavelength (nm). */
const NM0 = 400;
const DNM = 5;
const NM1 = 700;

/** Refractive index of the leaf material. */
const NR = [
	1.5115, 1.5115, 1.5081, 1.5055, 1.5032, 1.5016, 1.5002, 1.499, 1.498, 1.4966, 1.4955, 1.4945,
	1.4937, 1.4929, 1.4923, 1.4916, 1.491, 1.4903, 1.4896, 1.4889, 1.488, 1.4871, 1.4861, 1.4849,
	1.4836, 1.4822, 1.4807, 1.4791, 1.4774, 1.4757, 1.4739, 1.4721, 1.4701, 1.4681, 1.4662, 1.4643,
	1.4624, 1.4605, 1.4588, 1.4573, 1.4559, 1.4545, 1.4533, 1.4521, 1.451, 1.45, 1.4492, 1.4485,
	1.448, 1.4476, 1.4473, 1.4471, 1.4468, 1.4467, 1.4464, 1.4462, 1.4458, 1.4455, 1.4451, 1.4448,
	1.4444
];
/** Specific absorption coefficient of chlorophyll a + b (cm² µg⁻¹). */
const K_CHL = [
	0.06488, 0.07133, 0.07149, 0.07113, 0.06982, 0.07053, 0.07245, 0.07454, 0.07379, 0.06757, 0.05877,
	0.04957, 0.04387, 0.0413, 0.03973, 0.03852, 0.03678, 0.03391, 0.02966, 0.02452, 0.01905, 0.01398,
	0.009701, 0.006387, 0.004334, 0.003612, 0.004069, 0.005273, 0.006786, 0.008208, 0.009309, 0.01021,
	0.01105, 0.01207, 0.0136, 0.01536, 0.01695, 0.01832, 0.01942, 0.0202, 0.02085, 0.02176, 0.02318,
	0.02492, 0.02653, 0.02752, 0.02798, 0.02885, 0.03125, 0.0351, 0.03901, 0.04211, 0.04749, 0.05676,
	0.06611, 0.07099, 0.06892, 0.05275, 0.03367, 0.02014, 0.01224
];
/** Specific absorption coefficient of carotenoids (cm² µg⁻¹); none beyond 560 nm. */
const K_CAR = [
	0.1673, 0.1676, 0.1659, 0.1662, 0.1672, 0.1685, 0.1676, 0.168, 0.1696, 0.1698, 0.1674, 0.1598,
	0.1517, 0.1435, 0.137, 0.1344, 0.1333, 0.1292, 0.1207, 0.1101, 0.099, 0.08754, 0.07595, 0.06443,
	0.05321, 0.0425, 0.03252, 0.02348, 0.0156, 0.009101, 0.004189, 0.001083
];
/** Specific absorption coefficient of dry matter (cm² g⁻¹). */
const K_DRY = [
	109.7, 82.31, 63, 47.23, 35.67, 26.79, 20.24, 14.81, 10.96, 8.508, 6.66, 5.573, 4.575, 3.945,
	3.462, 3.051, 2.803, 2.679, 2.573, 2.486, 2.417, 2.365, 2.328, 2.307, 2.3
];

/** Linear interpolation in a 5-nm table; entries past its end are its last value (or 0 for carotenoids). */
function table(values: readonly number[], nm: number, after = values[values.length - 1]): number {
	const x = (Math.min(NM1, Math.max(NM0, nm)) - NM0) / DNM;
	const i = Math.floor(x);
	const at = (k: number) => (k < values.length ? values[k] : after);
	return at(i) + (at(i + 1) - at(i)) * (x - i);
}

/** Exponential integral E₁(x) for x > 0 (series below 1, continued fraction above). */
export function expint1(x: number): number {
	if (x <= 1) {
		let sum = -0.5772156649015329 - Math.log(x);
		let term = 1;
		for (let k = 1; k < 60; k++) {
			term *= -x / k;
			sum -= term / k;
		}
		return sum;
	}
	let b = x + 1;
	let c = 1e300;
	let d = 1 / b;
	let h = d;
	for (let i = 1; i < 200; i++) {
		const a = -i * i;
		b += 2;
		d = 1 / (a * d + b);
		c = b + a / c;
		const delta = c * d;
		h *= delta;
		if (Math.abs(delta - 1) < 1e-15) break;
	}
	return h * Math.exp(-x);
}

/**
 * Average transmissivity of a dielectric plane surface for isotropic light
 * within a solid angle of half-width `alpha` degrees (Stern 1964; Allen 1973).
 */
function tav(alpha: number, nr: number): number {
	const n2 = nr * nr;
	const np = n2 + 1;
	const nm = n2 - 1;
	const a = ((nr + 1) * (nr + 1)) / 2;
	const k = -((n2 - 1) * (n2 - 1)) / 4;
	const sa = Math.sin((alpha * Math.PI) / 180);
	const b1 = alpha === 90 ? 0 : Math.sqrt((sa * sa - np / 2) * (sa * sa - np / 2) + k);
	const b2 = sa * sa - np / 2;
	const b = b1 - b2;
	const ts = (k * k) / (6 * b ** 3) + k / b - b / 2 - ((k * k) / (6 * a ** 3) + k / a - a / 2);
	const tp1 = (-2 * n2 * (b - a)) / (np * np);
	const tp2 = (-2 * n2 * np * Math.log(b / a)) / (nm * nm);
	const tp3 = (n2 * (1 / b - 1 / a)) / 2;
	const tp4 =
		(16 * n2 * n2 * (n2 * n2 + 1) * Math.log((2 * np * b - nm * nm) / (2 * np * a - nm * nm))) /
		(np ** 3 * nm * nm);
	const tp5 = (16 * n2 ** 3 * (1 / (2 * np * b - nm * nm) - 1 / (2 * np * a - nm * nm))) / np ** 3;
	return (ts + tp1 + tp2 + tp3 + tp4 + tp5) / (2 * sa * sa);
}

export interface Leaf {
	/** Structure parameter: the number of plates the leaf behaves like. */
	n: number;
	/** Chlorophyll a + b content (µg cm⁻²). */
	chlorophyll: number;
	/** Carotenoid content (µg cm⁻²). */
	carotenoids: number;
	/** Dry mass per area (g cm⁻²). */
	dryMass: number;
}

/**
 * A typical green C₃ leaf: about 40 µg cm⁻² of chlorophyll, 10 of
 * carotenoids, 90 g m⁻² of dry mass and a structure of 1.5 plates — the
 * middle of the ranges PROSPECT is calibrated on (Féret et al. 2017).
 */
export const TYPICAL_LEAF: Leaf = { n: 1.5, chlorophyll: 40, carotenoids: 10, dryMass: 0.009 };

export interface Optics {
	reflectance: number;
	transmittance: number;
	absorptance: number;
}

/** Fractions of the light of wavelength `nm` (400–700) that a leaf reflects, transmits and absorbs. */
export function leafOptics(nm: number, leaf: Leaf = TYPICAL_LEAF): Optics {
	const nr = table(NR, nm);
	const k =
		(leaf.chlorophyll * table(K_CHL, nm) +
			leaf.carotenoids * table(K_CAR, nm, 0) +
			leaf.dryMass * table(K_DRY, nm)) /
		leaf.n;
	// Transmissivity of one elementary layer (Allen et al. 1969).
	const tau = k > 0 ? (1 - k) * Math.exp(-k) + k * k * expint1(k) : 1;
	// Reflectance and transmittance of the top plate...
	const talf = tav(40, nr);
	const ralf = 1 - talf;
	const t12 = tav(90, nr);
	const r12 = 1 - t12;
	const t21 = t12 / (nr * nr);
	const r21 = 1 - t21;
	const denom = 1 - r21 * r21 * tau * tau;
	const ta = (talf * tau * t21) / denom;
	const ra = ralf + r21 * tau * ta;
	const t = (t12 * tau * t21) / denom;
	const r = r12 + r21 * tau * t;
	// ...and of the N − 1 plates below it (Stokes 1862).
	const dd = Math.sqrt((1 + r + t) * (1 + r - t) * (1 - r + t) * (1 - r - t));
	const a = (1 + r * r - t * t + dd) / (2 * r);
	const b = (1 - r * r + t * t + dd) / (2 * t);
	const bn = b ** (leaf.n - 1);
	const den2 = a * a * bn * bn - 1;
	const rsub = (a * (bn * bn - 1)) / den2;
	const tsub = (bn * (a * a - 1)) / den2;
	const d3 = 1 - rsub * r;
	const transmittance = (ta * tsub) / d3;
	const reflectance = ra + (ta * rsub * t) / d3;
	return { reflectance, transmittance, absorptance: 1 - reflectance - transmittance };
}

/** Fraction of the photons a leaf absorbs at wavelength `nm`. */
export const leafAbsorptance = (nm: number, leaf: Leaf = TYPICAL_LEAF) =>
	leafOptics(nm, leaf).absorptance;

/**
 * Fraction of the photons of white light a leaf absorbs: the average over
 * 400–700 nm, taking white light as equal numbers of photons at every
 * wavelength (a simplification of the solar spectrum, which is fairly flat
 * in photons across this range).
 */
export function whiteAbsorptance(leaf: Leaf = TYPICAL_LEAF): number {
	if (leaf === TYPICAL_LEAF && typicalWhite !== undefined) return typicalWhite;
	let sum = 0;
	let n = 0;
	for (let nm = NM0; nm <= NM1; nm += 1) {
		sum += leafAbsorptance(nm, leaf);
		n++;
	}
	if (leaf === TYPICAL_LEAF) typicalWhite = sum / n;
	return sum / n;
}
/** Cached white-light absorptance of the typical leaf (the scenes ask every frame). */
let typicalWhite: number | undefined;

// ---- leaf biochemistry: FvCB ------------------------------------------------

/** Gas constant (J mol⁻¹ K⁻¹). */
const R_GAS = 8.314;
const T25 = 298.15;
/** Oxygen in the air and in the leaf (mmol mol⁻¹). */
export const O2_AIR = 210;
/** Photosynthetically active photons in full sunlight (µmol m⁻² s⁻¹). */
export const FULL_SUN = 2000;
/** CO₂ inside the leaf as a fraction of the air's (stomata not modelled). */
export const CI_RATIO = 0.7;

/**
 * A typical C₃ leaf at 25 °C: maximum RuBisCO rate Vcmax 60 µmol m⁻² s⁻¹,
 * maximum electron transport Jmax = 1.67 Vcmax (Medlyn et al. 2002), day
 * respiration 1.5% of Vcmax (Collatz et al. 1991), curvature θ = 0.7 and a
 * 15% loss of absorbed light to other absorbers (von Caemmerer 2000).
 */
export const LEAF_25 = { vcmax: 60, jmax: 100, rd: 0.9, theta: 0.7, f: 0.15 };

/** Arrhenius temperature factor, 1 at 25 °C (activation energy in J mol⁻¹). */
const arrhenius = (ea: number, tK: number) => Math.exp((ea * (tK - T25)) / (T25 * R_GAS * tK));
/** Arrhenius rise with deactivation at high temperature, 1 at 25 °C (Kattge & Knorr 2007). */
function peaked(ha: number, hd: number, ds: number, tK: number) {
	const off = (t: number) => 1 + Math.exp((t * ds - hd) / (R_GAS * t));
	return (arrhenius(ha, tK) * off(T25)) / off(tK);
}

/** Temperature-dependent constants of the FvCB model at `tempC` °C. */
export function constants(tempC: number) {
	const tK = tempC + 273.15;
	const tGrowth = 25;
	return {
		/** Michaelis constant of RuBisCO for CO₂ (µmol mol⁻¹). */
		kc: 404.9 * arrhenius(79430, tK),
		/** Michaelis constant of RuBisCO for O₂ (mmol mol⁻¹). */
		ko: 278.4 * arrhenius(36380, tK),
		/** CO₂ compensation point without day respiration, Γ* (µmol mol⁻¹). */
		gammaStar: 42.75 * arrhenius(37830, tK),
		vcmax: LEAF_25.vcmax * peaked(71513, 200000, 668.39 - 1.07 * tGrowth, tK),
		jmax: LEAF_25.jmax * peaked(49884, 200000, 659.7 - 0.75 * tGrowth, tK),
		rd: LEAF_25.rd * arrhenius(46390, tK)
	};
}

export interface Conditions {
	/** Photons reaching the leaf (µmol m⁻² s⁻¹, 400–700 nm). */
	ppfd: number;
	/** Wavelength of the light in nm, or 'white'. */
	light: number | 'white';
	/** CO₂ in the air (ppm = µmol mol⁻¹). */
	co2: number;
	/** Leaf temperature (°C). */
	tempC: number;
}

export interface Rate {
	/** Photons absorbed by the leaf (µmol m⁻² s⁻¹). */
	absorbed: number;
	/** Electron transport rate J (µmol e⁻ m⁻² s⁻¹). */
	j: number;
	/** CO₂ fixation the Calvin cycle (RuBisCO, CO₂ supply) could sustain (µmol m⁻² s⁻¹). */
	wc: number;
	/** CO₂ fixation the light reactions (ATP, NADPH supply) could sustain (µmol m⁻² s⁻¹). */
	wj: number;
	/** Day respiration (µmol CO₂ m⁻² s⁻¹). */
	rd: number;
	/** Net CO₂ uptake A (µmol m⁻² s⁻¹); negative when the leaf gives off CO₂. */
	net: number;
	/** Net O₂ released by the leaf (µmol m⁻² s⁻¹; negative when it takes O₂ up). */
	o2: number;
	/** Net sugar made, counted as glucose (µmol m⁻² s⁻¹). */
	sugar: number;
	/** Which supply sets the pace: the light reactions, or RuBisCO and CO₂. */
	limit: 'light' | 'rubisco';
}

/** Steady-state photosynthesis of a typical C₃ leaf under the given conditions. */
export function rate({ ppfd, light, co2, tempC }: Conditions): Rate {
	const c = constants(tempC);
	const absorbed =
		Math.max(0, ppfd) * (light === 'white' ? whiteAbsorptance() : leafAbsorptance(light));
	// Photons reaching photosystem II: half of those absorbed by the reaction
	// centres' pigments (the light is shared between the two photosystems).
	const i2 = (absorbed * (1 - LEAF_25.f)) / 2;
	const th = LEAF_25.theta;
	const j = (i2 + c.jmax - Math.sqrt((i2 + c.jmax) ** 2 - 4 * th * i2 * c.jmax)) / (2 * th);
	const ci = CI_RATIO * Math.max(0, co2);
	const wc = (c.vcmax * (ci - c.gammaStar)) / (ci + c.kc * (1 + O2_AIR / c.ko));
	const wj = (j * (ci - c.gammaStar)) / (4 * ci + 8 * c.gammaStar);
	const gross = Math.min(wc, wj);
	const net = gross - c.rd;
	return {
		absorbed,
		j,
		wc,
		wj,
		rd: c.rd,
		net,
		o2: net,
		sugar: net / 6,
		limit: wj <= wc ? 'light' : 'rubisco'
	};
}
