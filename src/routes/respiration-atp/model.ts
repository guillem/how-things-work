/**
 * Cellular respiration: the bookkeeping of one glucose molecule and a small
 * kinetic model of the electron transport chain and ATP synthase.
 *
 * Bookkeeping (exact stoichiometry): glycolysis, the pyruvate dehydrogenase
 * ("link") reaction and the citric acid cycle, enzyme by enzyme, as in any
 * biochemistry text (Lehninger, Principles of Biochemistry, 7th ed., ch. 14,
 * 16; Berg et al., Biochemistry).
 *
 * Energetics: standard midpoint potentials at pH 7 (Lehninger Table 19-2):
 * NAD⁺/NADH −0.320 V, fumarate/succinate +0.031 V, ubiquinone/ubiquinol
 * +0.045 V, cytochrome c (Fe³⁺/Fe²⁺) +0.254 V, ½O₂/H₂O +0.816 V.
 * Proton pumping per pair of electrons: complex I 4, complex III 4 (released
 * on the intermembrane side by the Q-cycle), complex IV 2 (plus 2 taken from
 * the matrix to make water); complex II pumps none. So 10 H⁺ per NADH and
 * 6 per FADH₂ (Hinkle, BBA 1706:1, 2005).
 *
 * ATP synthase: one rotation of the c-ring moves one proton per c-subunit and
 * makes 3 ATP. The cow's ring has 8 subunits (Watt et al., PNAS 107:16823,
 * 2010; PDB 6ZPO has 8 c chains), so 8/3 ≈ 2.7 H⁺ per ATP, plus about one
 * more H⁺ to bring phosphate in and swap ADP for ATP across the inner
 * membrane. Hinkle's measured P/O ratios, 2.5 (NADH) and 1.5 (succinate),
 * correspond to 4 H⁺ per ATP; the gap to the c₈ maximum is usually put down
 * to protons leaking back across the membrane without making ATP.
 */

/** Faraday constant, C/mol. */
export const F = 96485;
/** Gas constant, J/(mol·K). */
export const R = 8.314;
/** Body temperature, K. */
export const T_BODY = 310.15;
/** F/RT at body temperature, 1/V. */
export const F_RT = F / (R * T_BODY);

/** Standard free energy of glucose + 6 O₂ → 6 CO₂ + 6 H₂O, kJ/mol (Lehninger). */
export const DG_GLUCOSE = -2840;
/** Standard free energy of ATP hydrolysis, kJ/mol. */
export const DG_ATP_STANDARD = -30.5;
/** Free energy of ATP hydrolysis in a living cell, kJ/mol (the phosphorylation potential is −50 to −65). */
export const DG_ATP_CELL = -50;

/** Midpoint potentials at pH 7, volts. */
export const E = {
	nad: -0.32,
	succinate: 0.031,
	q: 0.045,
	cytc: 0.254,
	o2: 0.816
} as const;

/** Protons moved to the intermembrane space per pair of electrons, by complex. */
export const PUMPED = { I: 4, II: 0, III: 4, IV: 2 } as const;
export const H_PER_NADH = PUMPED.I + PUMPED.III + PUMPED.IV;
export const H_PER_FADH2 = PUMPED.II + PUMPED.III + PUMPED.IV;

/** Free energy released when two electrons drop from potential `from` to `to`, kJ/mol (positive = released). */
export const dropKJ = (from: number, to: number, n = 2) => (n * F * (to - from)) / 1000;

/** Energy one proton stores crossing a membrane with proton-motive force `dp` volts, kJ/mol. */
export const protonKJ = (dp: number) => (F * dp) / 1000;

// ---- the pathway, enzyme by enzyme -----------------------------------------

export interface Reaction {
	enzyme: string;
	/** Product (per molecule going through; glycolysis after the split runs twice). */
	product: string;
	/** Carbon atoms in the product. */
	carbons: number;
	/** Phosphate groups on the product. */
	phosphates?: number;
	/** ATP (or GTP) made (+) or spent (−) per molecule going through. */
	atp?: number;
	nadh?: number;
	fadh2?: number;
	co2?: number;
	/** How many times this step runs per glucose. */
	times: 1 | 2;
}

/** Glycolysis: glucose → 2 pyruvate, in the cytosol (10 enzymes). */
export const GLYCOLYSIS: Reaction[] = [
	{
		enzyme: 'hexokinase',
		product: 'glucose 6-phosphate',
		carbons: 6,
		phosphates: 1,
		atp: -1,
		times: 1
	},
	{
		enzyme: 'phosphoglucose isomerase',
		product: 'fructose 6-phosphate',
		carbons: 6,
		phosphates: 1,
		times: 1
	},
	{
		enzyme: 'phosphofructokinase',
		product: 'fructose 1,6-bisphosphate',
		carbons: 6,
		phosphates: 2,
		atp: -1,
		times: 1
	},
	{
		enzyme: 'aldolase',
		product: 'DHAP + glyceraldehyde 3-phosphate',
		carbons: 3,
		phosphates: 1,
		times: 1
	},
	{
		enzyme: 'triose phosphate isomerase',
		product: '2 glyceraldehyde 3-phosphate',
		carbons: 3,
		phosphates: 1,
		times: 1
	},
	{
		enzyme: 'glyceraldehyde 3-phosphate dehydrogenase',
		product: '1,3-bisphosphoglycerate',
		carbons: 3,
		phosphates: 2,
		nadh: 1,
		times: 2
	},
	{
		enzyme: 'phosphoglycerate kinase',
		product: '3-phosphoglycerate',
		carbons: 3,
		phosphates: 1,
		atp: 1,
		times: 2
	},
	{
		enzyme: 'phosphoglycerate mutase',
		product: '2-phosphoglycerate',
		carbons: 3,
		phosphates: 1,
		times: 2
	},
	{ enzyme: 'enolase', product: 'phosphoenolpyruvate', carbons: 3, phosphates: 1, times: 2 },
	{ enzyme: 'pyruvate kinase', product: 'pyruvate', carbons: 3, phosphates: 0, atp: 1, times: 2 }
];

/** Pyruvate dehydrogenase: pyruvate → acetyl-CoA, in the matrix. */
export const LINK: Reaction = {
	enzyme: 'pyruvate dehydrogenase',
	product: 'acetyl-CoA',
	carbons: 2,
	nadh: 1,
	co2: 1,
	times: 2
};

/** The citric acid cycle, one turn per acetyl-CoA (two per glucose). `carbons` counts the cycle's own molecule. */
export const CITRIC_ACID_CYCLE: Reaction[] = [
	{ enzyme: 'citrate synthase', product: 'citrate', carbons: 6, times: 2 },
	{ enzyme: 'aconitase', product: 'isocitrate', carbons: 6, times: 2 },
	{
		enzyme: 'isocitrate dehydrogenase',
		product: 'α-ketoglutarate',
		carbons: 5,
		nadh: 1,
		co2: 1,
		times: 2
	},
	{
		enzyme: 'α-ketoglutarate dehydrogenase',
		product: 'succinyl-CoA',
		carbons: 4,
		nadh: 1,
		co2: 1,
		times: 2
	},
	{ enzyme: 'succinyl-CoA synthetase', product: 'succinate', carbons: 4, atp: 1, times: 2 },
	{
		enzyme: 'succinate dehydrogenase (complex II)',
		product: 'fumarate',
		carbons: 4,
		fadh2: 1,
		times: 2
	},
	{ enzyme: 'fumarase', product: 'malate', carbons: 4, times: 2 },
	{ enzyme: 'malate dehydrogenase', product: 'oxaloacetate', carbons: 4, nadh: 1, times: 2 }
];

export interface Tally {
	atp: number;
	nadh: number;
	fadh2: number;
	co2: number;
}

/** Totals per glucose over a list of reactions. */
export function tally(reactions: Reaction[]): Tally {
	const out = { atp: 0, nadh: 0, fadh2: 0, co2: 0 };
	for (const r of reactions) {
		out.atp += (r.atp ?? 0) * r.times;
		out.nadh += (r.nadh ?? 0) * r.times;
		out.fadh2 += (r.fadh2 ?? 0) * r.times;
		out.co2 += (r.co2 ?? 0) * r.times;
	}
	return out;
}

/** Carriers and ATP per glucose from each stage. */
export const STAGES = {
	glycolysis: tally(GLYCOLYSIS),
	link: tally([LINK]),
	cycle: tally(CITRIC_ACID_CYCLE)
};

/** Electrons a carrier delivers to the chain: 2 each for NADH and FADH₂. Four reduce one O₂. */
export function oxygenPerGlucose() {
	const s = Object.values(STAGES);
	const pairs = s.reduce((a, x) => a + x.nadh + x.fadh2, 0);
	return (pairs * 2) / 4;
}

// ---- the ATP yield ----------------------------------------------------------

/** c-ring sizes of real ATP synthases (subunits = protons per rotation). */
export const C_RINGS = [
	{ id: 'cow', label: 'Cow (all vertebrates)', c: 8, source: 'Watt et al. 2010, PDB 2XND' },
	{ id: 'yeast', label: 'Yeast', c: 10, source: 'Stock et al. 1999, PDB 1QO1' },
	{ id: 'ecoli', label: 'E. coli', c: 10, source: 'Jiang et al. 2001' },
	{
		id: 'spinach',
		label: 'Spinach chloroplast',
		c: 14,
		source: 'Seelert et al. 2000; Vollmar et al. 2009'
	},
	{ id: 'spirulina', label: 'Spirulina (cyanobacterium)', c: 15, source: 'Pogoryelov et al. 2005' }
] as const;

/** Protons per ATP at the synthase alone: one rotation makes 3 ATP. */
export const synthaseHPerATP = (c: number) => c / 3;

/** Protons to import one phosphate (with an H⁺) and swap ADP³⁻ in for ATP⁴⁻ out (one charge). */
export const TRANSPORT_H = 1;

/** Protons per ATP delivered to the cytosol. */
export const hPerATP = (c: number) => synthaseHPerATP(c) + TRANSPORT_H;

/** Mechanistic P/O ratio (ATP per two electrons reaching oxygen). */
export const poRatio = (protons: number, hAtp: number) => protons / hAtp;

export type Count = 'measured' | 'ring' | 'classic';
export type Shuttle = 'malate' | 'glycerol';

export interface YieldRow {
	id: string;
	label: string;
	/** Number of molecules per glucose (ATP, NADH or FADH₂). */
	n: number;
	/** ATP per molecule. */
	per: number;
	atp: number;
}

/**
 * ATP per glucose.
 * - `measured`: Hinkle's P/O of 2.5 and 1.5 (the modern textbook values).
 * - `ring`: the maximum allowed by the cow's c₈ ring, 10/3.67 and 6/3.67.
 * - `classic`: the old integers, 3 and 2, from before the proton counts were known.
 * The cytosol's NADH reaches the chain through a shuttle: malate–aspartate
 * (liver, heart, kidney) hands its electrons to matrix NAD⁺, the
 * glycerol-phosphate shuttle (muscle, brain) to ubiquinone, like FADH₂.
 */
export function atpYield(count: Count, shuttle: Shuttle) {
	const h = hPerATP(8);
	const po =
		count === 'measured'
			? { nadh: 2.5, fadh2: 1.5 }
			: count === 'ring'
				? { nadh: poRatio(H_PER_NADH, h), fadh2: poRatio(H_PER_FADH2, h) }
				: { nadh: 3, fadh2: 2 };
	const g = STAGES.glycolysis;
	const rows: YieldRow[] = [
		{ id: 'gly-atp', label: 'glycolysis: ATP', n: g.atp, per: 1, atp: g.atp },
		{
			id: 'cac-atp',
			label: 'citric acid cycle: GTP',
			n: STAGES.cycle.atp,
			per: 1,
			atp: STAGES.cycle.atp
		},
		{
			id: 'gly-nadh',
			label: `glycolysis: NADH (${shuttle === 'malate' ? 'malate–aspartate' : 'glycerol-phosphate'} shuttle)`,
			n: g.nadh,
			per: shuttle === 'malate' ? po.nadh : po.fadh2,
			atp: 0
		},
		{
			id: 'link-nadh',
			label: 'pyruvate → acetyl-CoA: NADH',
			n: STAGES.link.nadh,
			per: po.nadh,
			atp: 0
		},
		{
			id: 'cac-nadh',
			label: 'citric acid cycle: NADH',
			n: STAGES.cycle.nadh,
			per: po.nadh,
			atp: 0
		},
		{
			id: 'cac-fadh2',
			label: 'citric acid cycle: FADH₂',
			n: STAGES.cycle.fadh2,
			per: po.fadh2,
			atp: 0
		}
	].map((r) => ({ ...r, atp: r.id.endsWith('-atp') ? r.atp : r.n * r.per }));
	const total = rows.reduce((a, r) => a + r.atp, 0);
	const substrate = rows[0].atp + rows[1].atp;
	return { rows, total, substrate, oxidative: total - substrate, po };
}

/** Share of glucose's free energy kept in ATP, for `atp` molecules each worth `dgAtp` kJ/mol. */
export const efficiency = (atp: number, dgAtp = DG_ATP_STANDARD) => (atp * dgAtp) / DG_GLUCOSE;

/** ATP per glucose without oxygen: glycolysis alone, its NADH recycled by making lactate. */
export const FERMENTATION_ATP = STAGES.glycolysis.atp;

// ---- the chain in motion ----------------------------------------------------

/**
 * A minimal kinetic model of the chain: three carrier pools (the matrix NAD
 * pool, the ubiquinone pool, cytochrome c), each described by the fraction
 * that is reduced, and the proton-motive force Δp across the inner membrane.
 *
 * Each complex runs forward and backward by mass action, and the ratio of the
 * two rates is set by thermodynamics: the electrons' drop in potential minus
 * the work of pushing the protons (charges) uphill against Δp. That is what
 * makes the chain slow down when the gradient is high (respiratory control)
 * and race when the membrane leaks (an uncoupler). Charges moved per pair of
 * electrons: I 4, III 2 (the other 2 of its 4 protons ride on QH₂), IV 4
 * (2 pumped plus 2 matrix protons consumed making water). ATP synthase plus
 * transport needs 8/3 + 1 protons per ATP and runs only while Δp is enough
 * to pay for ATP at its cellular value (≈ 50 kJ/mol).
 *
 * The rate constants and pool sizes are illustrative (chosen so that the
 * resting Δp is ≈ 170 mV and the pools are partly reduced); the order in
 * which the carriers back up without oxygen, and the directions of the
 * responses, follow from the potentials and are not tuned.
 */
export interface ChainState {
	/** Reduced fraction of the matrix NAD pool (NADH / total). */
	nadh: number;
	/** Reduced fraction of the ubiquinone pool (QH₂ / total). */
	q: number;
	/** Reduced fraction of cytochrome c. */
	c: number;
	/** Proton-motive force, volts. */
	dp: number;
}

export interface ChainConditions {
	oxygen: boolean;
	/** ATP synthase free to turn (false: blocked, as by oligomycin). */
	synthase: boolean;
	/** Protons leak back freely (an uncoupler such as DNP, or UCP1 in brown fat). */
	uncoupler: boolean;
}

export interface ChainFluxes {
	/** NAD⁺ reduced by the citric acid cycle. */
	supply: number;
	/** Electron pairs through complex I, II, III, IV (net, per unit time). */
	I: number;
	II: number;
	III: number;
	IV: number;
	/** ATP made per unit time. */
	atp: number;
	/** Protons pumped out and flowing back (synthase, leak). */
	pumped: number;
	throughSynthase: number;
	leak: number;
	/** O₂ consumed per unit time. */
	o2: number;
}

export const NORMAL: ChainConditions = { oxygen: true, synthase: true, uncoupler: false };
export const REST_STATE: ChainState = { nadh: 0.5, q: 0.4, c: 0.3, dp: 0.17 };

const K = {
	supply: 12,
	I: 60,
	II: 3,
	III: 80,
	IV: 30,
	atp: 12,
	leak: 10,
	leakUncoupled: 3000,
	/** Pool sizes (relative): many NAD, fewer Q, few cyt c; a small membrane capacitance. */
	nad: 6,
	qPool: 2,
	cytc: 0.6,
	cap: 400
};

const clampExp = (x: number) => Math.exp(Math.max(-40, Math.min(40, x)));

export function chainFluxes(s: ChainState, cond: ChainConditions): ChainFluxes {
	const { nadh: n, q, c, dp } = s;
	// Complex I: NADH + Q → NAD⁺ + QH₂, 4 charges out.
	const kI = clampExp(-(2 * (E.q - E.nad) - 4 * dp) * F_RT);
	const I = K.I * (n * (1 - q) - (1 - n) * q * kI);
	// Complex II: succinate + Q → fumarate + QH₂, no pumping. Succinate is
	// made by the cycle, which needs NAD⁺, so it scales with (1 − n).
	const kII = clampExp(-2 * (E.q - E.succinate) * F_RT);
	const II = K.II * (1 - n) * (1 - q - q * kII);
	// Complex III: QH₂ + 2 cyt c(ox) → Q + 2 cyt c(red), 2 charges out.
	const kIII = clampExp(-(2 * (E.cytc - E.q) - 2 * dp) * F_RT);
	const III = K.III * (q * (1 - c) ** 2 - (1 - q) * c * c * kIII);
	// Complex IV: 2 cyt c(red) + ½O₂ + 2H⁺ → H₂O, 4 charges; irreversible in practice.
	const IV = cond.oxygen ? K.IV * c * c : 0;
	// The citric acid cycle reduces NAD⁺ as long as there is NAD⁺ to reduce.
	const supply = K.supply * (1 - n);
	// ATP synthase + transport: the drive is the protons' energy minus ATP's.
	const h = hPerATP(8);
	const drive = (h * F * dp + DG_ATP_CELL * 1000) / (2 * R * T_BODY);
	// Simplification: the synthase only runs forward. (Without a gradient a
	// real one runs backwards, burning ATP, until the inhibitor IF1 stops it.)
	const atp = cond.synthase ? K.atp * Math.max(0, Math.tanh(drive)) : 0;
	const pumped = PUMPED.I * I + PUMPED.III * III + PUMPED.IV * IV;
	const throughSynthase = h * atp;
	const leak = (cond.uncoupler ? K.leakUncoupled : K.leak) * dp;
	return { supply, I, II, III, IV, atp, pumped, throughSynthase, leak, o2: IV / 2 };
}

/** Advances the chain by `dt` (model time units), in small explicit sub-steps. */
export function stepChain(s: ChainState, dt: number, cond: ChainConditions): ChainState {
	let st = { ...s };
	const h = 0.0005;
	for (let left = dt; left > 1e-9; left -= h) {
		const d = Math.min(h, left);
		const f = chainFluxes(st, cond);
		// Charges moved: 4 per pair through I, 2 through III, 4 through IV.
		const charge = 4 * f.I + 2 * f.III + 4 * f.IV - f.throughSynthase - f.leak;
		st = {
			nadh: clamp01(st.nadh + (d * (f.supply - f.I)) / K.nad),
			q: clamp01(st.q + (d * (f.I + f.II - f.III)) / K.qPool),
			c: clamp01(st.c + (d * 2 * (f.III - f.IV)) / K.cytc),
			dp: Math.max(0, st.dp + (d * charge) / K.cap)
		};
	}
	return st;
}

const clamp01 = (v: number) => Math.min(1 - 1e-6, Math.max(1e-6, v));

/** Runs the chain until it settles under `cond`. */
export function steadyChain(cond: ChainConditions, from: ChainState = REST_STATE, time = 40) {
	const s = stepChain(from, time, cond);
	return { state: s, fluxes: chainFluxes(s, cond) };
}
