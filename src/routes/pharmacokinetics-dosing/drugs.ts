/**
 * The page's five example drugs, for a 70 kg adult with normal kidneys and liver.
 *
 * Every number comes from the drug's US prescribing information, read through the openFDA drug
 * label API (FDA, CC0 1.0, https://open.fda.gov/apis/drug/label/ ; the same labels are on
 * DailyMed), except phenytoin's saturable-elimination constants and its volume, which no label
 * states (sources below). Where a label gives a range, the page takes a value inside it; where it
 * gives the volume and the half-life but not the clearance, the clearance is CL = ln 2 · V / t½.
 * `scripts/data/pharmacokinetics-dosing/fetch-labels.mjs` prints the labels' sentences quoted
 * here. Labels read on 2026-10-18 (set id, version, effective date):
 *
 * - Theophylline: Teva tablets, 25eabefa-518b-4030-9b72-01ac8b3deba9 v4 (2022-04-01):
 *   "rapidly and completely absorbed" (immediate release), peak "1 to 2 hour after the dose";
 *   clearance in healthy non-smoking adults "0.65 (0.27 to 1.03)" mL/kg/min, half-life 8.7 h;
 *   volume "approximately 0.45 L/kg (range 0.3 L/kg to 0.7 L/kg)"; "therapeutic range (10 mcg/mL
 *   to 20 mcg/mL)", adverse reactions more frequent above 20. Hospira aminophylline injection,
 *   9a663ef3-881f-48bd-2689-3713b24545c2 v29 (2026-05-22): a loading dose of 4.6 mg/kg gives
 *   about 10 mcg/mL; an infusion of 0.4 mg/kg/h gives a steady state of about 10 mcg/mL.
 * - Digoxin: Lanoxin tablets, d91e3646-4c63-4512-ab22-db39c085c4dc v12 (2024-12-05): absolute
 *   bioavailability 60–80%, peak at 1 to 3 hours, volume "approximately 475-500 L", half-life
 *   1.5–2 days (3.5–5 days in anuric patients), levels below 0.5 ng/mL less effective and above
 *   2 ng/mL more toxic; loading 10–15 mcg/kg in divided doses; days to steady state 7 (creatinine
 *   clearance 100 mL/min) to 19 (10 mL/min).
 * - Lithium carbonate: Camber capsules, 04518b80-7563-4544-bf05-04f286223faa v9 (2022-12-26):
 *   "completely absorbed", peak 0.25 to 3 hours, volume 0.7 to 1 L/kg, half-life 18 to 36 hours,
 *   acute goal 0.8–1.2 mEq/L (a sample 12 hours after a dose) with 600 mg two to three times daily, toxic at 1.5 mEq/L and above.
 *   300 mg of lithium carbonate (Li₂CO₃, 73.9 g/mol) holds 8.12 mEq of lithium.
 * - Vancomycin: Fresenius Kabi injection, 0576803d-95de-4a48-806a-69ae3fcaf6b0 v8 (2023-08-17):
 *   plasma clearance about 0.058 L/kg/h, half-life 4 to 6 hours, volume ("distribution
 *   coefficient") 0.3 to 0.43 L/kg, 1 g infused over 60 minutes; poorly absorbed by mouth. The
 *   label states no target range.
 * - Phenytoin: Dilantin extended capsules (phenytoin sodium), Viatris,
 *   86dd27d1-9cee-48ae-b55d-e2d2f7dbc593 v3 (2023-08-21): peak 4 to 12 hours, half-life averaging
 *   22 hours (7 to 42), metabolism "saturable at high serum levels", 10 to 20 mcg/mL, usual adult
 *   maintenance one capsule three to four times a day, oral loading 1 g in three doses; the salt
 *   has about 8% less phenytoin than the free acid (salt factor 0.92). Saturable constants
 *   Vmax = 7 mg/kg/day and Km = 4 mg/L: the reference means quoted by Salehifar et al., Iranian
 *   Journal of Pharmaceutical Research 8, 37 (2009), CC BY 4.0, doi:10.22037/ijpr.2010.786.
 *   Volume 0.7 L/kg: Noval, Seung & Armahizer, Drugs in R&D 20, 17 (2020), CC BY 4.0,
 *   doi:10.1007/s40268-019-00292-1. Absorption from the capsule is taken as complete.
 *
 * Absorption rates `ka` are the page's own choice: the rate that puts the peak of a single oral
 * dose inside the label's range of peak times (checked in the model tests).
 */

export type Form = 'injection' | 'tablet' | 'drip';

export interface Drug {
	id: string;
	name: string;
	/** What one dose is called, for the palette ("300 mg tablet"). */
	what: string;
	/** Unit of an amount in the body; a concentration is amount / litre. */
	amountUnit: 'mg' | 'mcg' | 'mEq';
	/** The concentration unit as written on the label (mg/L = mcg/mL, mcg/L = ng/mL). */
	concUnit: 'mcg/mL' | 'ng/mL' | 'mEq/L';
	/** Volume of distribution, L. */
	V: number;
	/** Clearance, L/h (for a saturable drug: Vmax / Km, the clearance at low levels). */
	CL: number;
	/** Fraction of a tablet that reaches the blood (including any salt factor). */
	F: number;
	/** Absorption rate constant of a tablet, 1/h. */
	ka: number;
	/** Target range on the label, or null when it gives none. */
	window: [number, number] | null;
	/** When the label's target applies to one sample rather than the whole curve. */
	windowSample?: string;
	/** Level above which the label says toxicity becomes likely. */
	toxic: number | null;
	/** The forms the palette offers for this drug. */
	forms: Form[];
	/** One tablet (amount of the salt or drug as dosed), one injection, a drip rate per hour. */
	tablet: number;
	injection: number;
	/** Minutes over which an injection is infused (0: all at once). */
	injectionMinutes: number;
	drip: number;
	/** The usual dose and interval (h) of the page's regimens. */
	dose: number;
	doseForm: Form;
	interval: number;
	/**
	 * A loading dose from the label, or null: its form, its parts as [hours after the start,
	 * amount], and the minutes an injected one takes.
	 */
	loading: { form: Form; parts: [number, number][]; minutes: number } | null;
	/** Saturable (Michaelis–Menten) elimination: Vmax in amount/h, Km in amount/L. */
	saturable?: { Vmax: number; Km: number };
	/** Hours shown on the time axis. */
	span: number;
	/** One line for the page: where the numbers come from. */
	source: string;
}

const KG = 70;
const LN2 = Math.LN2;

const theophylline: Drug = {
	id: 'theophylline',
	name: 'theophylline',
	what: 'theophylline (asthma)',
	amountUnit: 'mg',
	concUnit: 'mcg/mL',
	V: 0.45 * KG,
	CL: (0.65 * KG * 60) / 1000,
	F: 1,
	ka: 2,
	window: [10, 20],
	toxic: 20,
	forms: ['injection', 'tablet', 'drip'],
	tablet: 300,
	injection: 320,
	injectionMinutes: 30,
	drip: 0.4 * KG,
	dose: 300,
	doseForm: 'tablet',
	interval: 8,
	loading: { form: 'injection', parts: [[0, 4.6 * KG]], minutes: 30 },
	span: 72,
	source: 'theophylline and aminophylline US labels (via openFDA)'
};

const digoxin: Drug = {
	id: 'digoxin',
	name: 'digoxin',
	what: 'digoxin (heart)',
	amountUnit: 'mcg',
	concUnit: 'ng/mL',
	V: 490,
	CL: (LN2 * 490) / 42,
	F: 0.7,
	ka: 2,
	window: [0.5, 2],
	toxic: 2,
	forms: ['injection', 'tablet'],
	tablet: 250,
	injection: 250,
	injectionMinutes: 0,
	drip: 0,
	dose: 250,
	doseForm: 'tablet',
	interval: 24,
	loading: {
		form: 'tablet',
		parts: [
			[0, 375],
			[6, 187.5],
			[12, 187.5]
		],
		minutes: 0
	},
	span: 14 * 24,
	source: 'Lanoxin US label (via openFDA)'
};

/** mEq of lithium in 300 mg of lithium carbonate (two Li⁺ per Li₂CO₃, 73.89 g/mol). */
export const LITHIUM_MEQ_PER_300MG = (300 / 73.89) * 2;

const lithium: Drug = {
	id: 'lithium',
	name: 'lithium',
	what: 'lithium (bipolar disorder)',
	amountUnit: 'mEq',
	concUnit: 'mEq/L',
	V: 0.8 * KG,
	CL: (LN2 * 0.8 * KG) / 30,
	F: 1,
	ka: 2,
	window: [0.8, 1.2],
	windowSample: '12 h after a dose',
	toxic: 1.5,
	forms: ['tablet'],
	tablet: 2 * LITHIUM_MEQ_PER_300MG,
	injection: 0,
	injectionMinutes: 0,
	drip: 0,
	dose: 2 * LITHIUM_MEQ_PER_300MG,
	doseForm: 'tablet',
	interval: 12,
	loading: null,
	span: 8 * 24,
	source: 'lithium carbonate US label (via openFDA)'
};

const vancomycin: Drug = {
	id: 'vancomycin',
	name: 'vancomycin',
	what: 'vancomycin (antibiotic, IV)',
	amountUnit: 'mg',
	concUnit: 'mcg/mL',
	V: 0.4 * KG,
	CL: 0.058 * KG,
	F: 0,
	ka: 0,
	window: null,
	toxic: null,
	forms: ['injection', 'drip'],
	tablet: 0,
	injection: 1000,
	injectionMinutes: 60,
	drip: 1000 / 12,
	dose: 1000,
	doseForm: 'injection',
	interval: 12,
	loading: null,
	span: 72,
	source: 'vancomycin injection US label (via openFDA)'
};

const VMAX = (7 * KG) / 24;
const KM = 4;
const phenytoin: Drug = {
	id: 'phenytoin',
	name: 'phenytoin',
	what: 'phenytoin (epilepsy)',
	amountUnit: 'mg',
	concUnit: 'mcg/mL',
	V: 0.7 * KG,
	CL: VMAX / KM,
	F: 0.92,
	ka: 0.3,
	window: [10, 20],
	toxic: 20,
	forms: ['tablet'],
	tablet: 100,
	injection: 0,
	injectionMinutes: 0,
	drip: 0,
	dose: 100,
	doseForm: 'tablet',
	interval: 6,
	loading: {
		form: 'tablet',
		parts: [
			[0, 400],
			[2, 300],
			[4, 300]
		],
		minutes: 0
	},
	saturable: { Vmax: VMAX, Km: KM },
	span: 28 * 24,
	source: 'Dilantin US label (via openFDA); Vmax, Km: Salehifar et al. 2009; V: Noval et al. 2020'
};

export const DRUGS: Record<string, Drug> = {
	theophylline,
	digoxin,
	lithium,
	vancomycin,
	phenytoin
};

export const DRUG_IDS = Object.keys(DRUGS);

/** Half-life of a linearly eliminated drug, h. */
export const halfLife = (d: { V: number; CL: number }) => (LN2 * d.V) / d.CL;
