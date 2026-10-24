/** Early-time, perfect-contact solution of the one-dimensional heat equation for two
 * initially uniform half-spaces. Temperature is continuous and heat flux balances
 * at their interface. It describes the first touch, not a spoon held for a minute.
 * Sources: Rykaczewski, Modeling thermal contact resistance at the finger-object
 * interface (2019), Table 1, https://pmc.ncbi.nlm.nih.gov/articles/PMC6422506/;
 * PVC: NIST report https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=101567, p18;
 * loose wool: Black Mountain NatuWool technical sheet (95% wool, 5% binder),
 * https://www.intpetro.com/wp-content/uploads/2015/08/NatuWool_Technical_Sheet.pdf.
 * Wood takes the paper's lower k=0.23, with its density and heat capacity.
 * Wool is a representative loose, dry wool/air mixture, not a measured glove.
 * Published numerical facts; no source images or prose copied.
 */
export interface Material {
	id: string;
	name: string;
	object: string;
	k: number;
	rho: number;
	cp: number;
	color: string;
}

export const SKIN = { k: 0.37, rho: 1000, cp: 3770 };
export const HAND = 33;
export const materials: Material[] = [
	{
		id: 'metal',
		name: 'Aluminium',
		object: 'metal spoon',
		k: 238,
		rho: 2700,
		cp: 917,
		color: 'var(--cold-metal)'
	},
	{
		id: 'wood',
		name: 'Wood',
		object: 'wooden spoon',
		k: 0.23,
		rho: 675,
		cp: 3156,
		color: 'var(--cold-wood)'
	},
	{
		id: 'plastic',
		name: 'PVC plastic',
		object: 'plastic cup',
		k: 0.16,
		rho: 1400,
		cp: 950,
		color: 'var(--cold-plastic)'
	},
	{
		id: 'wool',
		name: 'Wool and air',
		object: 'woollen glove',
		k: 0.039,
		rho: 19,
		cp: 1700,
		color: 'var(--cold-wool)'
	}
];

/** Thermal effusivity combines conduction and heat storage. SI units. */
export function effusivity(m: Pick<Material, 'k' | 'rho' | 'cp'>): number {
	return Math.sqrt(m.k * m.rho * m.cp);
}

export function contactTemperature(m: Material, room: number, hand = HAND): number {
	const skin = effusivity(SKIN);
	const object = effusivity(m);
	return (skin * hand + object * room) / (skin + object);
}

/** Heat per unit contact area, J/m²: positive means heat leaves the hand.
 * The integrable initial flux singularity is the idealisation of instant contact.
 * Integrating flux gives a sqrt(time) dependence; no arbitrary animation rate.
 */
export function heatTransferred(m: Material, room: number, seconds: number, hand = HAND): number {
	if (seconds <= 0) return 0;
	const skin = effusivity(SKIN);
	const object = effusivity(m);
	return ((2 * skin * object) / (skin + object)) * (hand - room) * Math.sqrt(seconds / Math.PI);
}

// Abramowitz & Stegun 7.1.26, maximum absolute error about 1.5e-7.
function erfc(x: number): number {
	const a = Math.abs(x);
	const u = 1 / (1 + 0.3275911 * a);
	const y =
		((((1.061405429 * u - 1.453152027) * u + 1.421413741) * u - 0.284496736) * u + 0.254829592) *
		u *
		Math.exp(-a * a);
	return x < 0 ? 2 - y : y;
}

/** Temperature at a distance (m) from the contact; each side keeps its own depth scale. */
export function temperatureAt(
	m: Material,
	room: number,
	depth: number,
	seconds: number,
	side: 'skin' | 'object'
): number {
	const initial = side === 'skin' ? HAND : room;
	if (seconds <= 0) return initial;
	const medium = side === 'skin' ? SKIN : m;
	const alpha = medium.k / (medium.rho * medium.cp);
	return (
		initial +
		(contactTemperature(m, room) - initial) *
			erfc(Math.abs(depth) / (2 * Math.sqrt(alpha * seconds)))
	);
}

export function warmthColor(temp: number): string {
	const u = Math.max(0, Math.min(1, (temp - 20) / 13));
	const rgb = [64 + 175 * u, 139 - 11 * u, 213 - 114 * u];
	return `rgb(${rgb.map(Math.round).join(' ')})`;
}
