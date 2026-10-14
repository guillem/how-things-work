#!/usr/bin/env node
/**
 * Builds `src/routes/standard-model/pdg.ts`: masses, lifetimes, charges and spins of the
 * 17 Standard Model particles and of the hadrons the explainer can build, plus the decay
 * modes its decay checker knows, from the Particle Data Group's database file.
 *
 *   curl -L -o /tmp/pdg/pdg-2026.0.sqlite https://pdg.lbl.gov/2026/api/pdg-2026.0.sqlite
 *   node scripts/data/standard-model/build.mjs /tmp/pdg/pdg-2026.0.sqlite
 *
 * Source: Particle Data Group, Review of Particle Physics, 2026 edition, through the PDG
 * API database file (https://pdg.lbl.gov/2026/api/, data release 2026-05-30). Citation:
 * F. Takahashi et al. (Particle Data Group), Int. J. Mod. Phys. A 41, 2630011 (2026).
 * Licence: CC BY 4.0 (attribution: the citation above).
 *
 * Subset: for each particle below, the Summary Table values named by their PDG
 * identifier (mass; mean life, or width, converted to a mean life with τ = ħ/Γ; limits kept
 * as limits) and, from the particle table, its charge and spin J. The numeric `value`
 * column is used and normalised to MeV and seconds; `value_text` is only used for the
 * Δ(1232) estimates ("1230 TO 1232 TO 1234"), which have no number. Quark content is
 * derived from the Monte Carlo particle number (PDG numbering scheme), and the script
 * checks that it adds up to the PDG charge. Decay modes are matched by their PDG
 * description, so a renamed or missing mode stops the build. Uses only Node's built-in
 * `node:sqlite` (Node 22.5 or later).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = process.argv[2];
if (!file) {
	console.error('usage: node scripts/data/standard-model/build.mjs <pdg-2026.0.sqlite>');
	process.exit(1);
}
const OUT = path.resolve(import.meta.dirname, '../../../src/routes/standard-model/pdg.ts');
const db = new DatabaseSync(file, { readOnly: true });
const HBAR = 6.582119569e-22; // MeV s (CODATA, exact by the 2019 SI)
const YEAR = 365.25 * 86400; // the PDG's "years" are Julian years

const info = Object.fromEntries(
	db
		.prepare('select name, value from pdginfo')
		.all()
		.map((r) => [r.name, r.value])
);
if (info.edition !== '2026') throw new Error(`expected the 2026 edition, got ${info.edition}`);

const TO_MEV = { eV: 1e-6, keV: 1e-3, MeV: 1, GeV: 1e3 };
const TO_S = { s: 1, yr: YEAR, years: YEAR };

/** The Summary Table row for a PDG identifier (the first by PDG's own sort order). */
function summary(id) {
	const rows = db
		.prepare(
			'select value, value_text, unit_text, limit_type, error_positive, error_negative, value_type from pdgdata where pdgid = ? and in_summary_table = 1 order by sort'
		)
		.all(id);
	if (!rows.length) throw new Error(`no summary value for ${id}`);
	return rows[0];
}

/** A value in MeV or s: { v, err?, limit?: '<' | '>', estimate? }. */
function quantity(id, units) {
	const r = summary(id);
	const k = units[r.unit_text];
	if (k === undefined) throw new Error(`${id}: unexpected unit ${r.unit_text}`);
	let v = r.value;
	let estimate = r.value_type === 'E';
	if (v === null) {
		const m = /^\s*\S+ TO (\S+) TO \S+\s*$/.exec(r.value_text);
		if (!m) throw new Error(`${id}: no value in "${r.value_text}"`);
		v = Number(m[1]);
		estimate = true;
	}
	const q = { v: v * k };
	if (r.limit_type === 'U') q.limit = '<';
	else if (r.limit_type === 'L') q.limit = '>';
	else if (r.error_positive !== null && !estimate) {
		q.err = (Math.max(r.error_positive, r.error_negative ?? 0) * k).toPrecision(2) * 1;
	}
	if (estimate) q.estimate = true;
	return q;
}
const mass = (id) => quantity(id, TO_MEV);
/** Mean life in s, from a mean-life id ("…T…") or a width id (τ = ħ/Γ). */
function life(id) {
	const r = summary(id);
	if (TO_S[r.unit_text] !== undefined) return quantity(id, TO_S);
	const w = quantity(id, TO_MEV);
	const q = { v: HBAR / w.v, fromWidth: true };
	if (w.limit) q.limit = w.limit === '<' ? '>' : '<';
	if (w.err) q.err = Number(((HBAR / w.v) * (w.err / w.v)).toPrecision(2));
	if (w.estimate) q.estimate = true;
	return q;
}

// Particles the PDG table lists without a Monte Carlo number: MC id → [PDG id, PDG name].
const NO_MCID = { 4422: ['S068', 'Xi_cc()++'] };
function particle(mcid) {
	const r = NO_MCID[mcid]
		? db
				.prepare(
					'select pdgid, name, charge, quantum_j from pdgparticle where pdgid = ? and name = ?'
				)
				.get(...NO_MCID[mcid])
		: db.prepare('select pdgid, name, charge, quantum_j from pdgparticle where mcid = ?').get(mcid);
	if (!r) throw new Error(`no particle with MC id ${mcid}`);
	return r;
}
const thirds = (charge) => Math.round(charge * 3);

// ---- the 17 particles of the Standard Model ---------------------------------------------
// [key, MC id, mass id (null: no measured value), mean-life or width id (null: none)]
const FUNDAMENTAL = [
	['u', 2, 'Q002M', null],
	['d', 1, 'Q001M', null],
	['s', 3, 'Q003M', null],
	['c', 4, 'Q004M', null],
	['b', 5, 'Q005M', null],
	['t', 6, 'Q007TP', 'Q007W'],
	['e', 11, 'S003M', 'S003T'],
	['mu', 13, 'S004M', 'S004T'],
	['tau', 15, 'S035M', 'S035T'],
	['nue', 12, null, null],
	['numu', 14, null, null],
	['nutau', 16, null, null],
	['g', 21, null, null],
	['gamma', 22, 'S000M', null],
	['Z', 23, 'S044M', 'S044W'],
	['W', 24, 'S043M', 'S043W'],
	['H', 25, 'S126M', 'S126W']
];
const fundamental = {};
for (const [key, mcid, m, l] of FUNDAMENTAL) {
	const p = particle(mcid);
	fundamental[key] = {
		pdgid: p.pdgid,
		charge3: thirds(p.charge),
		spin: p.quantum_j,
		...(m ? { mass: mass(m) } : {}),
		...(l ? { life: life(l) } : {})
	};
}
// One limit for all three neutrinos: the direct (KATRIN-based) limit on the electron
// antineutrino's effective mass. Mass splittings are far smaller, so it bounds all three.
const neutrinoMassLimit = mass('S066MAE');

// ---- hadrons -----------------------------------------------------------------------------
// [MC id, name shown, mass id, mean-life or width id]
const HADRONS = [
	[2212, 'proton', 'S016M', 'S016T'],
	[2112, 'neutron', 'S017M', 'S017T'],
	[2224, 'Δ⁺⁺', 'B033M', 'B033W'],
	[1114, 'Δ⁻', 'B033M', 'B033W'],
	[3122, 'Λ⁰', 'S018M', 'S018T'],
	[3212, 'Σ⁰', 'S021M', 'S021T'],
	[3222, 'Σ⁺', 'S019M', 'S019T'],
	[3112, 'Σ⁻', 'S020M', 'S020T'],
	[3322, 'Ξ⁰', 'S023M', 'S023T'],
	[3312, 'Ξ⁻', 'S022M', 'S022T'],
	[3334, 'Ω⁻', 'S024M', 'S024T'],
	[4122, 'Λc⁺', 'S033M', 'S033T'],
	[4222, 'Σc⁺⁺', 'B104M++', 'B104W++'],
	[4112, 'Σc⁰', 'B104M0', 'B104W0'],
	[4232, 'Ξc⁺', 'S045M', 'S045T'],
	[4132, 'Ξc⁰', 'S048M', 'S048T'],
	[4332, 'Ωc⁰', 'S047M', 'S047T'],
	[4422, 'Ξcc⁺⁺', 'S068M', 'S068T'],
	[5122, 'Λb⁰', 'S040M', 'S040T'],
	[5222, 'Σb⁺', 'S026M+', 'S026W+'],
	[5112, 'Σb⁻', 'S026M-', 'S026W-'],
	[5232, 'Ξb⁰', 'S070M0', 'S070T0'],
	[5132, 'Ξb⁻', 'S069M-', 'S069T-'],
	[5332, 'Ωb⁻', 'S063M', 'S063T'],
	[211, 'π⁺', 'S008M', 'S008T'],
	[111, 'π⁰', 'S009M', 'S009T'],
	[321, 'K⁺', 'S010M', 'S010T'],
	[311, 'K⁰', 'S011M', null],
	[411, 'D⁺', 'S031M', 'S031T'],
	[421, 'D⁰', 'S032M', 'S032T'],
	[431, 'Ds⁺', 'S034M', 'S034T'],
	[521, 'B⁺', 'S041M', 'S041T'],
	[511, 'B⁰', 'S042M', 'S042T'],
	[531, 'Bs⁰', 'S086M', 'S086T'],
	[541, 'Bc⁺', 'S091M', 'S091T'],
	[333, 'φ', 'M004M', 'M004W'],
	[441, 'ηc', 'M026M', 'M026W'],
	[443, 'J/ψ', 'M070M', 'M070W'],
	[551, 'ηb', 'M171M', 'M171W']
];
const FLAVOURS = ['', 'd', 'u', 's', 'c', 'b', 't'];
const QCHARGE3 = { d: -1, u: 2, s: -1, c: 2, b: -1, t: 2 };

/**
 * Quark content from the PDG Monte Carlo number: baryons n_q1 n_q2 n_q3 n_J (three quarks),
 * mesons n_q2 n_q3 n_J (a quark and an antiquark; for the positive code the heavier
 * flavour is the quark when it is up-type, c, and the antiquark when it is down-type).
 * Antiquarks are written with a leading "~".
 */
function content(mcid) {
	const digits = String(mcid).padStart(4, '0').split('').map(Number);
	const [q1, q2, q3] = digits;
	if (q1 > 0) return [FLAVOURS[q1], FLAVOURS[q2], FLAVOURS[q3]];
	const heavy = FLAVOURS[q2];
	const light = FLAVOURS[q3];
	if (q2 === q3) return [heavy, `~${heavy}`];
	return q2 % 2 === 0 ? [heavy, `~${light}`] : [light, `~${heavy}`];
}

const hadrons = HADRONS.map(([mcid, name, m, l]) => {
	const p = particle(mcid);
	const q = content(mcid);
	const sum = q.reduce((s, f) => s + (f[0] === '~' ? -QCHARGE3[f.slice(1)] : QCHARGE3[f]), 0);
	if (sum !== thirds(p.charge)) throw new Error(`${name}: quarks ${q} do not add to ${p.charge}`);
	return {
		mcid,
		pdgid: p.pdgid,
		name,
		quarks: q,
		charge3: thirds(p.charge),
		spin: p.quantum_j,
		mass: mass(m),
		...(l ? { life: life(l) } : {})
	};
});

// The two neutral kaons that K⁰ and its antiparticle mix into.
const kaonLives = { short: life('S012T'), long: life('S013T') };
const protonRadius = summary('S016CR'); // fm

// ---- decay modes ---------------------------------------------------------------------------
// [PDG id, PDG description (checked), parent, products]: observed modes and searched-for
// limits. Product keys are the decay checker's own.
const MODES = [
	['S017.1', 'n --> p e- nubar_e', 'n', ['p', 'e-', 'nubar_e']],
	['S017.2', 'n --> p nu_e nubar_e', 'n', ['p', 'nu_e', 'nubar_e']],
	['S004.1', 'mu- --> e- nubar_e nu_mu', 'mu-', ['e-', 'nubar_e', 'nu_mu']],
	['S004.4', 'mu- --> e- gamma', 'mu-', ['e-', 'gamma']],
	['S004.5', 'mu- --> e- e+ e-', 'mu-', ['e-', 'e+', 'e-']],
	['S008.1', 'pi+ --> mu+ nu_mu', 'pi+', ['mu+', 'nu_mu']],
	['S008.2', 'pi+ --> e+ nu_e', 'pi+', ['e+', 'nu_e']],
	['S009.1', 'pi0 --> 2gamma', 'pi0', ['gamma', 'gamma']],
	['S009.2', 'pi0 --> e+ e- gamma', 'pi0', ['e+', 'e-', 'gamma']],
	['S009.4', 'pi0 --> 3gamma', 'pi0', ['gamma', 'gamma', 'gamma']],
	['S018.1', 'Lambda --> p pi-', 'Lambda', ['p', 'pi-']],
	['S018.2', 'Lambda --> n pi0', 'Lambda', ['n', 'pi0']],
	['S018.6', 'Lambda --> n gamma', 'Lambda', ['n', 'gamma']],
	['S018.4', 'Lambda --> p e- nubar_e', 'Lambda', ['p', 'e-', 'nubar_e']],
	['S018.3', 'Lambda --> p mu- nubar_mu', 'Lambda', ['p', 'mu-', 'nubar_mu']],
	['S010.1', 'K+ --> mu+ nu_mu', 'K+', ['mu+', 'nu_mu']],
	['S010.2', 'K+ --> pi+ pi0', 'K+', ['pi+', 'pi0']],
	['S010.3', 'K+ --> pi+ pi+ pi-', 'K+', ['pi+', 'pi+', 'pi-']],
	['S010.4', 'K+ --> pi+ pi0 pi0', 'K+', ['pi+', 'pi0', 'pi0']],
	['S010.6', 'K+ --> pi0 e+ nu_e', 'K+', ['pi0', 'e+', 'nu_e']],
	['S010.5', 'K+ --> pi0 mu+ nu_mu', 'K+', ['pi0', 'mu+', 'nu_mu']],
	['S010.11', 'K+ --> e+ nu_e', 'K+', ['e+', 'nu_e']]
];
const modes = MODES.map(([id, desc, parent, products]) => {
	const d = db.prepare('select description from pdgid where pdgid = ?').get(id);
	if (d?.description !== desc)
		throw new Error(`${id}: expected "${desc}", got "${d?.description}"`);
	const r = summary(id);
	if (r.value === null) {
		if (!['~100E-2', '(100)E-2'].includes(r.value_text.trim()))
			throw new Error(`${id}: no value in ${r.value_text}`);
	}
	const fraction = r.value === null ? 1 : r.value;
	return {
		id,
		parent,
		products,
		fraction,
		...(r.limit_type === 'U' ? { limit: '<' } : {}),
		...(r.value === null ? { approx: true } : {})
	};
});
// Proton decay: a partial mean life limit (τ/B), in units of 10³⁰ years, for the bound
// proton ("p") in N → e⁺π. The text is "> 5300 n, > 24000 p".
const pe = summary('S016.6').value_text;
const pm = /> ?(\d+) p/.exec(pe);
if (!pm) throw new Error(`S016.6: cannot read "${pe}"`);
const protonToPositronPion = { years: Number(pm[1]) * 1e30, limit: '>' };

const out = {
	source: {
		edition: info.edition,
		release: info.data_release_timestamp,
		citation: info.citation.replace(/<\/?i>/g, ''),
		licence: info.license
	},
	fundamental,
	neutrinoMassLimit,
	hadrons,
	kaonLives,
	protonRadius: { fm: protonRadius.value, err: protonRadius.error_positive },
	modes,
	protonToPositronPion
};

const header = `/**
 * Particle data for the Standard Model explainer. GENERATED by
 * scripts/data/standard-model/build.mjs; do not edit by hand.
 *
 * Source: Particle Data Group, Review of Particle Physics, ${info.edition} edition, PDG API
 * database file https://pdg.lbl.gov/${info.edition}/api/pdg-${info.edition}.0.sqlite (data release
 * ${info.data_release_timestamp}). Citation: ${out.source.citation}.
 * Licence: ${info.license}.
 *
 * Subset: Summary Table masses (MeV) and mean lives (s; from the width as τ = ħ/Γ where PDG
 * gives a width, flagged \`fromWidth\`) of the 17 Standard Model particles and 39 hadrons,
 * their charges (in thirds of e) and spins J, quark contents derived from the PDG Monte Carlo
 * numbers, and ${modes.length} decay modes (branching fractions, or upper limits). \`limit\` marks a bound,
 * \`estimate\` a PDG estimate (Δ(1232)), \`err\` the larger of the two quoted errors.
 * Quark masses: u, d, s in the MS-bar scheme at 2 GeV, c and b at their own mass (MS-bar),
 * t from direct measurements.
 */
`;
const TYPES = `export interface Quantity {
	v: number;
	err?: number;
	limit?: '<' | '>';
	estimate?: boolean;
	fromWidth?: boolean;
}
export interface FundamentalData {
	pdgid: string;
	charge3: number;
	spin: string;
	mass?: Quantity;
	life?: Quantity;
}
export interface HadronData {
	mcid: number;
	pdgid: string;
	name: string;
	quarks: string[];
	charge3: number;
	spin: string;
	mass: Quantity;
	life?: Quantity;
}
export interface ModeData {
	id: string;
	parent: string;
	products: string[];
	fraction: number;
	limit?: '<';
	approx?: boolean;
}
`;
const TYPE_OF = {
	fundamental: 'Record<string, FundamentalData>',
	neutrinoMassLimit: 'Quantity',
	hadrons: 'HadronData[]',
	kaonLives: '{ short: Quantity; long: Quantity }',
	protonRadius: '{ fm: number; err: number }',
	modes: 'ModeData[]',
	protonToPositronPion: "{ years: number; limit: '>' }"
};
const body =
	TYPES +
	Object.entries(out)
		.map(
			([k, v]) =>
				`\nexport const ${k}${TYPE_OF[k] ? `: ${TYPE_OF[k]}` : ''} = ${JSON.stringify(v, null, '\t')};\n`
		)
		.join('');
writeFileSync(OUT, header + '\n' + body);
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
