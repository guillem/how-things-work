/**
 * Fixed colours for molecules and particles. These are chosen to read well on
 * both the light and the dark stage background; theme-dependent colours
 * (membranes, compartments, ink) are CSS custom properties in `app.css`.
 */
export const colors = {
	carbon: '#4b5563',
	carbonEdge: '#1f2937',
	oxygen: '#e5484d',
	oxygenEdge: '#b3262b',
	hydrogen: '#f3f4f6',
	hydrogenEdge: '#9ca3af',
	nitrogen: '#3b82f6',
	phosphate: '#f59e0b',
	phosphateEdge: '#b45309',

	electron: '#22d3ee',
	electronEdge: '#0891b2',
	proton: '#f472b6',
	protonEdge: '#be185d',
	photon: '#fbbf24',

	atp: '#f97316',
	adp: '#fdba74',
	nadph: '#8b5cf6',
	nadp: '#c4b5fd',
	sugar: '#10b981',
	sugarEdge: '#047857',

	chlorophyllA: '#2f9e5d',
	chlorophyllB: '#7ccb5a',
	carotenoid: '#f59e0b',

	psii: '#5b8def',
	psi: '#9d6bff',
	cytb6f: '#e0a04a',
	atpSynthase: '#ef7a5a',
	rubisco: '#5aa37a'
} as const;

/**
 * Approximate sRGB colour of monochromatic light of the given wavelength (nm).
 * Based on Dan Bruton's classic algorithm, with a gentle gamma.
 */
export function wavelengthToColor(nm: number): string {
	let r = 0;
	let g = 0;
	let b = 0;
	if (nm >= 380 && nm < 440) {
		r = -(nm - 440) / (440 - 380);
		b = 1;
	} else if (nm >= 440 && nm < 490) {
		g = (nm - 440) / (490 - 440);
		b = 1;
	} else if (nm >= 490 && nm < 510) {
		g = 1;
		b = -(nm - 510) / (510 - 490);
	} else if (nm >= 510 && nm < 580) {
		r = (nm - 510) / (580 - 510);
		g = 1;
	} else if (nm >= 580 && nm < 645) {
		r = 1;
		g = -(nm - 645) / (645 - 580);
	} else if (nm >= 645 && nm <= 780) {
		r = 1;
	}
	// Intensity falls off at the ends of the visible range.
	let f = 1;
	if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
	else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / (780 - 700);
	const gamma = 0.8;
	const c = (v: number) => Math.round(255 * Math.pow(Math.max(0, v * f), gamma));
	return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/**
 * Relative absorbance (0–1) of the main leaf pigments at a wavelength, as a
 * smooth approximation of the textbook absorption spectra (in solvent).
 */
export function absorbance(nm: number) {
	const peak = (center: number, width: number, height: number) =>
		height * Math.exp(-((nm - center) ** 2) / (2 * width * width));
	const chlA = Math.min(1, peak(430, 14, 1) + peak(410, 18, 0.55) + peak(662, 11, 0.8));
	const chlB = Math.min(1, peak(453, 14, 0.9) + peak(642, 10, 0.45));
	const car = Math.min(1, peak(450, 22, 0.7) + peak(480, 14, 0.55) + peak(425, 14, 0.5));
	return { chlA, chlB, car, total: Math.min(1, 0.6 * chlA + 0.25 * chlB + 0.25 * car) };
}
