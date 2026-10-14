/**
 * The Standard Model explainer's model: the 17 particles, the rules for building hadrons
 * from quarks, the conservation laws a decay must respect, and a few processes drawn as
 * exchanges of force carriers.
 *
 * - Hadrons: quarks carry charge +2/3 or −1/3 e and baryon number 1/3; antiquarks the
 *   opposite. Each quark carries one of three colour charges, each antiquark an anticolour.
 *   Only colourless combinations exist on their own: three quarks (one of each colour), three
 *   antiquarks, or a quark and an antiquark (a colour and its anticolour). In general the
 *   number of quarks minus the number of antiquarks must be a multiple of 3. The builder
 *   takes at most three, so it offers baryons, antibaryons and mesons; the colour rule alone
 *   also allows tetraquarks (qq q̄q̄) and pentaquarks (qqqq q̄), which have been observed.
 * - The particle a combination makes is looked up in the PDG data (`pdg.ts`): the lightest
 *   known hadron with that quark content. Combinations with a top quark make nothing: the top
 *   decays (τ ≈ 5 × 10⁻²⁵ s) before the strong force can bind it.
 * - Decays: charge, baryon number and lepton numbers must be the same before and after; the
 *   products must weigh less than the parent (energy); the number of half-integer-spin
 *   particles must stay odd or even (angular momentum); and a particle at rest cannot turn
 *   into a single other particle (energy and momentum together). Passing every check means
 *   "not forbidden by these laws", not "seen": other rules (C-parity, for example) and plain
 *   rarity also matter. Neutrino masses are below 0.45 eV and taken as 0 here.
 * - Processes: each stage lists the particles present at that moment; the ledger adds up
 *   their charge, baryon number and lepton numbers, so conservation at every vertex is a
 *   result of the particle properties, not a typed-in claim.
 *
 * Data: PDG Review of Particle Physics, 2026 edition (see `pdg.ts`).
 */
import { fundamental, hadrons, modes, type HadronData, type ModeData, type Quantity } from './pdg';

export { fundamental, hadrons, modes, neutrinoMassLimit, kaonLives, protonRadius } from './pdg';
export { protonToPositronPion, source } from './pdg';
export type { HadronData, ModeData, Quantity } from './pdg';

/** Reduced Planck constant, MeV·s (CODATA; exact in the SI since 2019). */
export const HBAR = 6.582119569e-22;
/** ħc in MeV·fm (CODATA 2018). */
export const HBARC = 197.3269804;

// ---------------------------------------------------------------- the 17 particles

export type Family = 'quark' | 'lepton' | 'gauge' | 'scalar';
export type Force = 'strong' | 'em' | 'weak';

export interface Fundamental {
	key: string;
	symbol: string;
	name: string;
	family: Family;
	/** 1–3 for matter particles. */
	generation?: 1 | 2 | 3;
	/** Charge in thirds of the elementary charge e. */
	charge3: number;
	/** Spin J as PDG writes it ("1/2", "1", "0"). */
	spin: string;
	mass?: Quantity;
	life?: Quantity;
	/** The forces it feels (gravity aside); for a carrier, also the force it carries. */
	feels: Force[];
	/** The force this particle carries, if it is a gauge boson. */
	carries?: Force;
}

const F = fundamental;
const fermion = (
	key: string,
	symbol: string,
	name: string,
	family: 'quark' | 'lepton',
	generation: 1 | 2 | 3
): Fundamental => {
	const d = F[key];
	const charged = d.charge3 !== 0;
	return {
		key,
		symbol,
		name,
		family,
		generation,
		charge3: d.charge3,
		spin: d.spin,
		mass: d.mass,
		life: d.life,
		feels:
			family === 'quark'
				? ['strong', 'em', 'weak']
				: charged
					? ['em', 'weak']
					: (['weak'] as Force[])
	};
};

/**
 * The 17 particles, counted the usual way: the W⁺ and W⁻ as one entry, the eight gluons as
 * one, and no antiparticles.
 */
export const PARTICLES: Fundamental[] = [
	fermion('u', 'u', 'up', 'quark', 1),
	fermion('d', 'd', 'down', 'quark', 1),
	fermion('c', 'c', 'charm', 'quark', 2),
	fermion('s', 's', 'strange', 'quark', 2),
	fermion('t', 't', 'top', 'quark', 3),
	fermion('b', 'b', 'bottom', 'quark', 3),
	fermion('e', 'e⁻', 'electron', 'lepton', 1),
	fermion('nue', 'νe', 'electron neutrino', 'lepton', 1),
	fermion('mu', 'μ⁻', 'muon', 'lepton', 2),
	fermion('numu', 'νμ', 'muon neutrino', 'lepton', 2),
	fermion('tau', 'τ⁻', 'tau', 'lepton', 3),
	fermion('nutau', 'ντ', 'tau neutrino', 'lepton', 3),
	{
		key: 'g',
		symbol: 'g',
		name: 'gluon',
		family: 'gauge',
		charge3: 0,
		spin: F.g.spin,
		feels: ['strong'],
		carries: 'strong'
	},
	{
		key: 'gamma',
		symbol: 'γ',
		name: 'photon',
		family: 'gauge',
		charge3: 0,
		spin: F.gamma.spin,
		mass: F.gamma.mass,
		feels: [],
		carries: 'em'
	},
	{
		key: 'Z',
		symbol: 'Z⁰',
		name: 'Z boson',
		family: 'gauge',
		charge3: 0,
		spin: F.Z.spin,
		mass: F.Z.mass,
		life: F.Z.life,
		feels: ['weak'],
		carries: 'weak'
	},
	{
		key: 'W',
		symbol: 'W±',
		name: 'W boson',
		family: 'gauge',
		charge3: F.W.charge3,
		spin: F.W.spin,
		mass: F.W.mass,
		life: F.W.life,
		feels: ['em', 'weak'],
		carries: 'weak'
	},
	{
		key: 'H',
		symbol: 'H',
		name: 'Higgs boson',
		family: 'scalar',
		charge3: 0,
		spin: F.H.spin,
		mass: F.H.mass,
		life: F.H.life,
		feels: ['weak']
	}
];
export const particle = (key: string) => {
	const p = PARTICLES.find((q) => q.key === key);
	if (!p) throw new Error(`no particle ${key}`);
	return p;
};

// ---------------------------------------------------------------- quarks and hadrons

export type Flavour = 'u' | 'd' | 's' | 'c' | 'b' | 't';
export const FLAVOURS: Flavour[] = ['u', 'd', 's', 'c', 'b', 't'];
/** A quark ("u") or an antiquark ("~u"). */
export type Token = `${'' | '~'}${Flavour}`;
export const TOKENS: Token[] = [...FLAVOURS, ...FLAVOURS.map((f) => `~${f}` as Token)];

export const isAnti = (t: Token) => t.startsWith('~');
export const flavourOf = (t: Token) => (isAnti(t) ? t.slice(1) : t) as Flavour;
export const quarkCharge3 = (f: Flavour) => F[f].charge3;
/** Charge of a quark or antiquark, in thirds of e. */
export const charge3Of = (t: Token) => (isAnti(t) ? -1 : 1) * quarkCharge3(flavourOf(t));
/** Quark mass in MeV (u, d, s: MS-bar at 2 GeV; c, b: MS-bar at their own mass; t: direct). */
export const quarkMass = (f: Flavour) => F[f].mass?.v ?? 0;
/** Displayed symbol: "u", "ū". */
export const symbolOf = (t: Token) => (isAnti(t) ? `${flavourOf(t)}̄` : t);

/** Parses "u,u,d" or "u,~d" (unknown entries are dropped). */
export function parseTokens(s: string): Token[] {
	return s
		.split(',')
		.map((x) => x.trim())
		.filter((x): x is Token => (TOKENS as string[]).includes(x));
}

export type Colour = 'r' | 'g' | 'b';
export const COLOURS: Colour[] = ['r', 'g', 'b'];

export type BuildKind = 'empty' | 'coloured' | 'baryon' | 'antibaryon' | 'meson';

export interface Build {
	tokens: Token[];
	kind: BuildKind;
	/** Colourless: it can exist on its own. */
	neutral: boolean;
	/** Colour of each token for the drawing (an antiquark carries the anticolour). */
	colours: Colour[];
	/** Total charge in thirds of e. */
	charge3: number;
	/** Total baryon number in thirds. */
	baryon3: number;
	/** Sum of the quark masses, MeV. */
	quarkMass: number;
	/** What it makes: a known hadron, an allowed but unobserved one, or nothing (top). */
	status: 'none' | 'known' | 'unobserved' | 'top';
	hadron?: Hadron;
}

export interface Hadron {
	name: string;
	/** The PDG entry: for an antiparticle, the particle's (same mass and lifetime). */
	data: HadronData;
	anti: boolean;
	charge3: number;
	/** Another, heavier hadron with the same quarks (in spin 3/2 or 1), if well known. */
	sibling?: string;
	/** A note on the identification (mixtures). */
	note?: string;
}

/** Content key: quark flavours sorted, then antiquark flavours sorted. */
function keyOf(tokens: Token[]): string {
	const q = tokens.filter((t) => !isAnti(t)).map(flavourOf);
	const a = tokens.filter(isAnti).map(flavourOf);
	const order = (x: Flavour) => FLAVOURS.indexOf(x);
	q.sort((x, y) => order(x) - order(y));
	a.sort((x, y) => order(x) - order(y));
	return `${q.join('')}|${a.join('')}`;
}
const conjugate = (tokens: Token[]): Token[] =>
	tokens.map((t) => (isAnti(t) ? flavourOf(t) : (`~${t}` as Token)));

const BY_CONTENT = new Map<string, HadronData>();
for (const h of hadrons) {
	const k = keyOf(h.quarks as Token[]);
	const prev = BY_CONTENT.get(k);
	if (!prev || h.mass.v < prev.mass.v) BY_CONTENT.set(k, h);
}
// π⁰ is a mixture of uū and dd̄ (PDG lists it once).
const PI0 = hadrons.find((h) => h.name === 'π⁰');
if (PI0) BY_CONTENT.set('u|u', PI0);

const SIBLINGS: Record<string, string> = {
	'uud|': 'Δ⁺ (spin 3/2)',
	'udd|': 'Δ⁰ (spin 3/2)',
	'uds|': 'Σ⁰',
	'u|d': 'ρ⁺ (spin 1)',
	'u|s': 'K*⁺ (spin 1)',
	'c|c': 'J/ψ (spin 1)',
	'b|b': 'Υ (spin 1)'
};
const NOTES: Record<string, string> = {
	'u|u': 'a mixture of uū and dd̄',
	'd|d': 'a mixture of uū and dd̄',
	's|s': 'almost pure ss̄; the lighter η and η′ mix uū, dd̄ and ss̄'
};

const SUPERS: Record<string, string> = { '⁺': '⁻', '⁻': '⁺' };
/** Name of the antiparticle: flips the charge marks; neutral ones get a bar or "anti-". */
function antiName(h: HadronData): string {
	const baryon = h.quarks.length === 3;
	const flipped = h.name.replace(/[⁺⁻]/g, (c) => SUPERS[c]);
	if (h.name === 'proton') return 'antiproton';
	if (h.name === 'neutron') return 'antineutron';
	if (baryon) return `anti-${h.name}`;
	if (h.charge3 !== 0) return flipped;
	// A neutral meson: a bar over its first letter (K̄⁰, D̄⁰, B̄⁰).
	return `${h.name[0]}̄${h.name.slice(1)}`;
}

const antiSibling = (sib: string, baryon: boolean) =>
	baryon ? `anti-${sib}` : sib.replace(/[⁺⁻]/g, (c) => SUPERS[c]);

/** Colour assignment for display; a colourless set gets one of each colour, or a colour and its anticolour. */
function assignColours(tokens: Token[]): Colour[] {
	const q = tokens.filter((t) => !isAnti(t)).length;
	const a = tokens.length - q;
	if (q > 0 && a > 0) {
		// Pair quarks with antiquarks colour by colour; the rest get the remaining colours.
		let qi = 0;
		let ai = 0;
		return tokens.map((t) => COLOURS[isAnti(t) ? ai++ % 3 : qi++ % 3]);
	}
	return tokens.map((_, i) => COLOURS[i % 3]);
}

/** Builds a hadron from up to three quarks and antiquarks and checks the rules. */
export function combine(tokens: Token[]): Build {
	const q = tokens.filter((t) => !isAnti(t)).length;
	const a = tokens.length - q;
	const charge3 = tokens.reduce((s, t) => s + charge3Of(t), 0);
	const baryon3 = q - a;
	const neutral = tokens.length > 0 && (q - a) % 3 === 0;
	const kind: BuildKind =
		tokens.length === 0
			? 'empty'
			: !neutral
				? 'coloured'
				: q === 3 && a === 0
					? 'baryon'
					: a === 3 && q === 0
						? 'antibaryon'
						: 'meson';
	const base = {
		tokens,
		kind,
		neutral,
		colours: assignColours(tokens),
		charge3,
		baryon3,
		quarkMass: tokens.reduce((s, t) => s + quarkMass(flavourOf(t)), 0)
	};
	if (!neutral) return { ...base, status: 'none' };
	if (tokens.some((t) => flavourOf(t) === 't')) return { ...base, status: 'top' };
	const k = keyOf(tokens);
	const direct = BY_CONTENT.get(k);
	const viaAnti = direct ? undefined : BY_CONTENT.get(keyOf(conjugate(tokens)));
	const data = direct ?? viaAnti;
	if (!data) return { ...base, status: 'unobserved' };
	const anti = !direct;
	const conjKey = keyOf(conjugate(tokens));
	const sib = SIBLINGS[k] ?? SIBLINGS[conjKey];
	const hadron: Hadron = {
		name: anti ? antiName(data) : data.name,
		data,
		anti,
		charge3,
		sibling: sib && anti ? antiSibling(sib, tokens.length === 3) : sib,
		note: NOTES[k]
	};
	return { ...base, status: 'known', hadron };
}

/** Ready-made combinations for the builder's presets. */
export const PRESETS: Record<string, Token[]> = {
	proton: ['u', 'u', 'd'],
	neutron: ['u', 'd', 'd'],
	delta: ['u', 'u', 'u'],
	lambda: ['u', 'd', 's'],
	omega: ['s', 's', 's'],
	pion: ['u', '~d'],
	kaon: ['u', '~s'],
	charmonium: ['c', '~c'],
	antiproton: ['~u', '~u', '~d']
};

// ---------------------------------------------------------------- decays

/** A particle the decay checker knows: quantum numbers that conservation laws track. */
export interface DecayParticle {
	key: string;
	label: string;
	/** Charge in units of e. */
	charge: number;
	/** Baryon number. */
	B: number;
	/** Electron, muon and tau lepton numbers. */
	Le: number;
	Lmu: number;
	/** Strangeness (−1 per s quark, +1 per s̄). */
	S: number;
	/** Mass in MeV (neutrinos: 0, below 0.45 eV). */
	mass: number;
	/** Half-integer spin. */
	fermion: boolean;
}

const hadronMass = (name: string) => {
	const h = hadrons.find((x) => x.name === name);
	if (!h) throw new Error(`no hadron ${name}`);
	return h.mass.v;
};
const me = F.e.mass?.v ?? 0;
const mmu = F.mu.mass?.v ?? 0;

const D = (
	key: string,
	label: string,
	charge: number,
	mass: number,
	fermion: boolean,
	q: Partial<Pick<DecayParticle, 'B' | 'Le' | 'Lmu' | 'S'>> = {}
): DecayParticle => ({
	key,
	label,
	charge,
	mass,
	fermion,
	B: q.B ?? 0,
	Le: q.Le ?? 0,
	Lmu: q.Lmu ?? 0,
	S: q.S ?? 0
});

export const DECAY_PARTICLES: DecayParticle[] = [
	D('p', 'p', 1, hadronMass('proton'), true, { B: 1 }),
	D('n', 'n', 0, hadronMass('neutron'), true, { B: 1 }),
	D('Lambda', 'Λ⁰', 0, hadronMass('Λ⁰'), true, { B: 1, S: -1 }),
	D('e-', 'e⁻', -1, me, true, { Le: 1 }),
	D('e+', 'e⁺', 1, me, true, { Le: -1 }),
	D('nu_e', 'νe', 0, 0, true, { Le: 1 }),
	D('nubar_e', 'ν̄e', 0, 0, true, { Le: -1 }),
	D('mu-', 'μ⁻', -1, mmu, true, { Lmu: 1 }),
	D('mu+', 'μ⁺', 1, mmu, true, { Lmu: -1 }),
	D('nu_mu', 'νμ', 0, 0, true, { Lmu: 1 }),
	D('nubar_mu', 'ν̄μ', 0, 0, true, { Lmu: -1 }),
	D('gamma', 'γ', 0, 0, false),
	D('pi+', 'π⁺', 1, hadronMass('π⁺'), false),
	D('pi-', 'π⁻', -1, hadronMass('π⁺'), false),
	D('pi0', 'π⁰', 0, hadronMass('π⁰'), false),
	D('K+', 'K⁺', 1, hadronMass('K⁺'), false, { S: 1 })
];
export const decayParticle = (key: string) => {
	const p = DECAY_PARTICLES.find((x) => x.key === key);
	if (!p) throw new Error(`no decay particle ${key}`);
	return p;
};

/** Parents the checker offers, and the products it may choose from. */
export const PARENTS = ['n', 'mu-', 'pi+', 'pi0', 'Lambda', 'K+', 'p'] as const;
export type Parent = (typeof PARENTS)[number];
export const PRODUCTS = [
	'p',
	'n',
	'e-',
	'e+',
	'nu_e',
	'nubar_e',
	'mu-',
	'mu+',
	'nu_mu',
	'nubar_mu',
	'gamma',
	'pi+',
	'pi-',
	'pi0'
] as const;
export const MAX_PRODUCTS = 4;

export type LawId = 'charge' | 'baryon' | 'electron' | 'muon' | 'energy' | 'spin';
export interface Law {
	id: LawId;
	label: string;
	before: number;
	after: number;
	ok: boolean;
}

export interface DecayCheck {
	laws: Law[];
	/** Energy released (parent mass − product masses), MeV; negative when too heavy. */
	q: number;
	/** At least two products. */
	enoughProducts: boolean;
	/** Not forbidden by any of the laws checked. */
	allowed: boolean;
	/** Strangeness before and after (only the weak force may change it). */
	strangeness: { before: number; after: number };
	/** The PDG entry for this exact mode, if there is one (observed, or an upper limit). */
	mode?: ModeData;
}

const sum = (ps: DecayParticle[], f: (p: DecayParticle) => number) =>
	ps.reduce((s, p) => s + f(p), 0);
const sameProducts = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');

/** Checks a proposed decay against the conservation laws. */
export function checkDecay(parentKey: string, productKeys: readonly string[]): DecayCheck {
	const parent = decayParticle(parentKey);
	const prods = productKeys.map(decayParticle);
	const law = (id: LawId, label: string, f: (p: DecayParticle) => number): Law => {
		const before = f(parent);
		const after = sum(prods, f);
		return { id, label, before, after, ok: before === after };
	};
	const productMass = sum(prods, (p) => p.mass);
	const q = parent.mass - productMass;
	const enoughProducts = prods.length >= 2;
	const fermionsBefore = parent.fermion ? 1 : 0;
	const fermionsAfter = prods.filter((p) => p.fermion).length;
	const laws: Law[] = [
		law('charge', 'Charge', (p) => p.charge),
		law('baryon', 'Baryon number', (p) => p.B),
		law('electron', 'Electron number', (p) => p.Le),
		law('muon', 'Muon number', (p) => p.Lmu),
		{
			id: 'energy',
			label: 'Energy',
			before: parent.mass,
			after: productMass,
			ok: prods.length > 0 && q > 0
		},
		{
			id: 'spin',
			label: 'Spin',
			before: fermionsBefore,
			after: fermionsAfter,
			ok: fermionsBefore % 2 === fermionsAfter % 2
		}
	];
	const mode = modes.find((m) => m.parent === parentKey && sameProducts(m.products, productKeys));
	return {
		laws,
		q,
		enoughProducts,
		allowed: enoughProducts && laws.every((l) => l.ok),
		strangeness: { before: parent.S, after: sum(prods, (p) => p.S) },
		mode
	};
}

/** The parent's most common decay (the checker's starting point). */
export function mainMode(parentKey: string): readonly string[] {
	const ms = modes.filter((m) => m.parent === parentKey && !m.limit);
	if (!ms.length) return parentKey === 'p' ? ['e+', 'pi0'] : [];
	return ms.reduce((a, b) => (b.fraction > a.fraction ? b : a)).products;
}

// ---------------------------------------------------------------- processes

/** A particle line in a process, with the quantum numbers its ledger adds up. */
export interface Line {
	key: string;
	label: string;
	/** Charge in thirds of e. */
	charge3: number;
	/** Baryon number in thirds. */
	baryon3: number;
	Le: number;
	Lmu: number;
	kind: 'fermion' | 'photon' | 'w' | 'gluon';
	/** Colour, for quarks and gluons in the strong process: "r", or "r~g" for red–antigreen. */
	colour?: string;
}

const Lq = (f: Flavour, colour?: string): Line => ({
	key: f,
	label: f,
	charge3: quarkCharge3(f),
	baryon3: 1,
	Le: 0,
	Lmu: 0,
	kind: 'fermion',
	colour
});
const Ll = (key: string, label: string, charge3: number, Le: number, Lmu: number): Line => ({
	key,
	label,
	charge3,
	baryon3: 0,
	Le,
	Lmu,
	kind: 'fermion'
});
const Lb = (key: string, label: string, charge3: number, kind: Line['kind'], colour?: string) => ({
	key,
	label,
	charge3,
	baryon3: 0,
	Le: 0,
	Lmu: 0,
	kind,
	colour
});

export interface Stage {
	/** Short label for the stage control and the diagram. */
	label: string;
	/** What is present at that moment (between vertices). */
	lines: Line[];
}

export interface Process {
	id: string;
	title: string;
	/** The force whose carrier is exchanged. */
	force: Force;
	carrier: string;
	stages: Stage[];
}

const ELECTRON = Ll('e-', 'e⁻', -3, 1, 0);
export const PROCESSES: Record<string, Process> = {
	beta: {
		id: 'beta',
		title: 'Beta decay of a neutron',
		force: 'weak',
		carrier: 'W⁻',
		stages: [
			{ label: 'A neutron: u d d', lines: [Lq('u'), Lq('d'), Lq('d')] },
			{
				label: 'd → u + W⁻',
				lines: [Lq('u'), Lq('d'), Lq('u'), Lb('W-', 'W⁻', -3, 'w')]
			},
			{
				label: 'W⁻ → e⁻ + ν̄e',
				lines: [Lq('u'), Lq('d'), Lq('u'), ELECTRON, Ll('nubar_e', 'ν̄e', 0, -1, 0)]
			}
		]
	},
	muon: {
		id: 'muon',
		title: 'Decay of a muon',
		force: 'weak',
		carrier: 'W⁻',
		stages: [
			{ label: 'A muon', lines: [Ll('mu-', 'μ⁻', -3, 0, 1)] },
			{
				label: 'μ⁻ → νμ + W⁻',
				lines: [Ll('nu_mu', 'νμ', 0, 0, 1), Lb('W-', 'W⁻', -3, 'w')]
			},
			{
				label: 'W⁻ → e⁻ + ν̄e',
				lines: [Ll('nu_mu', 'νμ', 0, 0, 1), ELECTRON, Ll('nubar_e', 'ν̄e', 0, -1, 0)]
			}
		]
	},
	pion: {
		id: 'pion',
		title: 'Decay of a charged pion',
		force: 'weak',
		carrier: 'W⁺',
		stages: [
			{
				label: 'A π⁺: u d̄',
				lines: [Lq('u'), { ...Lq('d'), key: '~d', label: 'd̄', charge3: 1, baryon3: -1 }]
			},
			{ label: 'u + d̄ → W⁺', lines: [Lb('W+', 'W⁺', 3, 'w')] },
			{
				label: 'W⁺ → μ⁺ + νμ',
				lines: [Ll('mu+', 'μ⁺', 3, 0, -1), Ll('nu_mu', 'νμ', 0, 0, 1)]
			}
		]
	},
	ee: {
		id: 'ee',
		title: 'Two electrons repel',
		force: 'em',
		carrier: 'γ',
		stages: [
			{ label: 'Two electrons approach', lines: [ELECTRON, ELECTRON] },
			{
				label: 'One emits a photon',
				lines: [ELECTRON, ELECTRON, Lb('gamma', 'γ', 0, 'photon')]
			},
			{ label: 'The other absorbs it', lines: [ELECTRON, ELECTRON] }
		]
	},
	gluon: {
		id: 'gluon',
		title: 'Two quarks swap colour',
		force: 'strong',
		carrier: 'g',
		stages: [
			{ label: 'A red u and a green d', lines: [Lq('u', 'r'), Lq('d', 'g')] },
			{
				label: 'u emits a red–antigreen gluon',
				lines: [Lq('u', 'g'), Lq('d', 'g'), Lb('g', 'g', 0, 'gluon', 'r~g')]
			},
			{ label: 'd absorbs it: now red', lines: [Lq('u', 'g'), Lq('d', 'r')] }
		]
	}
};

export interface Ledger {
	charge3: number;
	baryon3: number;
	Le: number;
	Lmu: number;
}
export function ledger(stage: Stage): Ledger {
	return stage.lines.reduce(
		(s, l) => ({
			charge3: s.charge3 + l.charge3,
			baryon3: s.baryon3 + l.baryon3,
			Le: s.Le + l.Le,
			Lmu: s.Lmu + l.Lmu
		}),
		{ charge3: 0, baryon3: 0, Le: 0, Lmu: 0 }
	);
}
/** Colour content of a stage: how many of each colour, minus anticolours (gluons carry both). */
export function colourCount(stage: Stage): Record<Colour, number> {
	const c: Record<Colour, number> = { r: 0, g: 0, b: 0 };
	for (const l of stage.lines) {
		if (!l.colour) continue;
		// "r" is a colour, "~g" an anticolour, "r~g" a gluon carrying both.
		const [col, anti] = l.colour.split('~');
		if (col) c[col as Colour]++;
		if (anti) c[anti as Colour]--;
	}
	return c;
}

// ---------------------------------------------------------------- numbers the narrative quotes

/** Energy released by a free neutron's beta decay, MeV: m(n) − m(p) − m(e). */
export const neutronQ = () => hadronMass('neutron') - hadronMass('proton') - me;

/** Reach of a force carried by a particle of mass M (MeV): ħ/(Mc), in metres. */
export const reach = (massMeV: number) => (HBARC / massMeV) * 1e-15;

/** Share of a hadron's mass that its quark masses account for. */
export const quarkShare = (b: Build) => (b.hadron ? b.quarkMass / b.hadron.data.mass.v : 0);

// ---------------------------------------------------------------- formatting

const SUP: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻'
};
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');

/** "+2/3", "−1/3", "+1", "0", "−2". */
export function thirds(n3: number): string {
	if (n3 === 0) return '0';
	const sign = n3 > 0 ? '+' : '−';
	const a = Math.abs(n3);
	return a % 3 === 0 ? `${sign}${a / 3}` : `${sign}${a}/3`;
}

/** A number in scientific notation with unicode powers: "2.6 × 10⁻⁸". */
export function sci(v: number, digits = 2): string {
	if (v === 0) return '0';
	const e = Math.floor(Math.log10(Math.abs(v)));
	if (e >= -2 && e <= 4) return Number(v.toPrecision(digits + 1)).toLocaleString('en-US');
	const m = v / 10 ** e;
	return `${m.toFixed(digits - 1)} × 10${sup(e)}`;
}

/** Mass for display: "938.3 MeV", "80.4 GeV", "2.16 MeV". */
export function massText(mev: number): string {
	if (mev >= 1000) return `${Number((mev / 1000).toPrecision(4))} GeV`;
	if (mev >= 100) return `${mev.toFixed(1)} MeV`;
	if (mev >= 1) return `${Number(mev.toPrecision(3))} MeV`;
	if (mev >= 1e-3) return `${Number((mev * 1000).toPrecision(3))} keV`;
	return `${sci(mev * 1e6)} eV`;
}

const YEAR = 365.25 * 86400;
/** Mean life for display: "878 s", "2.2 μs", "> 10²⁹ years". */
export function lifeText(q: Quantity | undefined): string {
	if (!q) return 'stable';
	const v = q.v;
	const lim = q.limit ? `${q.limit === '>' ? 'more than' : 'less than'} ` : '';
	if (v > 1e7) return `${lim}${sci(v / YEAR, 2)} years`;
	if (v >= 1) return `${lim}${Number(v.toPrecision(3))} s`;
	if (v >= 1e-3) return `${lim}${Number((v * 1e3).toPrecision(3))} ms`;
	if (v >= 1e-6) return `${lim}${Number((v * 1e6).toPrecision(3))} μs`;
	return `${lim}${sci(v, 2)} s`;
}
