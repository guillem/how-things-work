// Checks the Standard Model explainer's model against real particle data and the
// conservation laws (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	PARTICLES,
	PRESETS,
	PROCESSES,
	TOKENS,
	charge3Of,
	checkDecay,
	colourCount,
	combine,
	hadrons,
	ledger,
	lifeText,
	mainMode,
	massText,
	modes,
	neutronQ,
	quarkShare,
	reach,
	thirds,
	type Token
} from '../src/routes/standard-model/particles';

test('the Standard Model table has 17 entries: 6 quarks, 6 leptons, 4 carriers and the Higgs', () => {
	expect(PARTICLES).toHaveLength(17);
	expect(PARTICLES.filter((p) => p.family === 'quark')).toHaveLength(6);
	expect(PARTICLES.filter((p) => p.family === 'lepton')).toHaveLength(6);
	expect(PARTICLES.filter((p) => p.carries).map((p) => p.symbol)).toEqual(['g', 'γ', 'Z⁰', 'W±']);
	// Matter particles have spin 1/2, carriers spin 1, the Higgs spin 0.
	for (const p of PARTICLES) {
		expect(p.spin).toBe(p.family === 'gauge' ? '1' : p.family === 'scalar' ? '0' : '1/2');
	}
	// Each generation is heavier than the one before.
	const m = (k: string) => PARTICLES.find((p) => p.key === k)?.mass?.v ?? 0;
	expect(m('u') < m('c') && m('c') < m('t')).toBe(true);
	expect(m('e') < m('mu') && m('mu') < m('tau')).toBe(true);
});

test('PDG values the narrative quotes', () => {
	const p = (k: string) => PARTICLES.find((x) => x.key === k);
	expect(massText(p('e')?.mass?.v ?? 0)).toBe('511 keV');
	expect(massText(p('W')?.mass?.v ?? 0)).toBe('80.36 GeV');
	expect(massText(p('Z')?.mass?.v ?? 0)).toBe('91.19 GeV');
	expect(massText(p('H')?.mass?.v ?? 0)).toBe('125.1 GeV');
	expect(massText(p('t')?.mass?.v ?? 0)).toBe('172.6 GeV');
	expect(lifeText(p('mu')?.life)).toBe('2.2 μs');
	const n = hadrons.find((h) => h.name === 'neutron');
	expect(lifeText(n?.life)).toBe('878 s');
	// The neutron's decay releases 0.782 MeV (m_n − m_p − m_e).
	expect(neutronQ()).toBeCloseTo(0.7823, 3);
});

test('quark contents add up to every hadron’s measured charge', () => {
	for (const h of hadrons) {
		const q = (h.quarks as Token[]).reduce((s, t) => s + charge3Of(t), 0);
		expect(q, h.name).toBe(h.charge3);
	}
});

test('uud is a proton and udd a neutron, with charges +1 and 0 and baryon number 1', () => {
	const p = combine(PRESETS.proton);
	expect(p.kind).toBe('baryon');
	expect(p.hadron?.name).toBe('proton');
	expect(thirds(p.charge3)).toBe('+1');
	expect(p.baryon3).toBe(3);
	const n = combine(['d', 'u', 'd']);
	expect(n.hadron?.name).toBe('neutron');
	expect(n.charge3).toBe(0);
});

test('only colourless combinations exist, and they always have a whole charge', () => {
	expect(combine(['u', 'd']).neutral).toBe(false);
	expect(combine(['u']).neutral).toBe(false);
	expect(combine(['u', 'u', '~d']).neutral).toBe(false);
	expect(combine(['u', '~u']).neutral).toBe(true);
	expect(combine(['~u', '~u', '~d']).kind).toBe('antibaryon');
	// Every one- to three-token combination: colourless ⇔ (quarks − antiquarks) divisible by 3,
	// and every colourless one has an integer charge.
	const light = TOKENS.filter((t) => !t.endsWith('t'));
	const all: Token[][] = [];
	for (const a of light) {
		all.push([a]);
		for (const b of light) {
			all.push([a, b]);
			for (const c of light) all.push([a, b, c]);
		}
	}
	for (const tokens of all) {
		const b = combine(tokens);
		if (b.neutral) expect(b.charge3 % 3 === 0, tokens.join(' ')).toBe(true);
		// Baryon number is a whole number exactly when the combination is colourless.
		expect(b.baryon3 % 3 === 0, tokens.join(' ')).toBe(b.neutral);
	}
});

test('the builder names real hadrons and their antiparticles', () => {
	expect(combine(['u', '~d']).hadron?.name).toBe('π⁺');
	expect(combine(['d', '~u']).hadron?.name).toBe('π⁻');
	expect(combine(['u', '~u']).hadron?.name).toBe('π⁰');
	expect(combine(['s', '~d']).hadron?.name).toBe('K̄⁰');
	expect(combine(['u', 'd', 's']).hadron?.name).toBe('Λ⁰');
	expect(combine(['s', 's', 's']).hadron?.name).toBe('Ω⁻');
	expect(combine(['u', 'u', 'u']).hadron?.data.spin).toBe('3/2');
	expect(combine(['~u', '~u', '~d']).hadron?.name).toBe('antiproton');
	expect(combine(['c', '~c']).hadron?.name).toBe('ηc');
	// Allowed but never seen; and the top quark never binds.
	expect(combine(['c', 'c', 'c']).status).toBe('unobserved');
	expect(combine(['u', '~t']).status).toBe('top');
});

test('the quarks’ own masses are about 1% of a proton, but most of a heavy meson', () => {
	expect(quarkShare(combine(PRESETS.proton))).toBeGreaterThan(0.009);
	expect(quarkShare(combine(PRESETS.proton))).toBeLessThan(0.011);
	expect(quarkShare(combine(['b', '~b']))).toBeGreaterThan(0.85);
});

test('neutron beta decay conserves everything; dropping the antineutrino breaks lepton number', () => {
	const ok = checkDecay('n', ['p', 'e-', 'nubar_e']);
	expect(ok.allowed).toBe(true);
	expect(ok.mode?.fraction).toBe(1);
	expect(ok.q).toBeCloseTo(0.782, 3);
	const bad = checkDecay('n', ['p', 'e-']);
	expect(bad.allowed).toBe(false);
	expect(bad.laws.filter((l) => !l.ok).map((l) => l.id)).toEqual(['electron', 'spin']);
});

test('the checker forbids what nature never does', () => {
	const failing = (parent: string, products: string[]) =>
		checkDecay(parent, products)
			.laws.filter((l) => !l.ok)
			.map((l) => l.id);
	// A free proton cannot beta-decay: the neutron is heavier.
	expect(failing('p', ['n', 'e+', 'nu_e'])).toEqual(['energy']);
	// Proton decay into a positron and a pion breaks baryon and lepton number.
	expect(failing('p', ['e+', 'pi0'])).toEqual(['baryon', 'electron']);
	// μ → eγ breaks electron and muon number (PDG: below 1.5 × 10⁻¹³).
	expect(failing('mu-', ['e-', 'gamma'])).toEqual(['electron', 'muon']);
	expect(checkDecay('mu-', ['e-', 'gamma']).mode?.limit).toBe('<');
	// A particle at rest cannot turn into a single other particle.
	expect(checkDecay('pi0', ['gamma']).allowed).toBe(false);
});

test('every decay PDG has observed passes every check', () => {
	for (const m of modes.filter((x) => !x.limit)) {
		const c = checkDecay(m.parent, m.products);
		expect(c.allowed, `${m.parent} → ${m.products.join(' ')}`).toBe(true);
	}
	// Each parent's starting point is its most common decay.
	expect(mainMode('pi+')).toEqual(['mu+', 'nu_mu']);
	expect(mainMode('Lambda')).toEqual(['p', 'pi-']);
	// The Λ's main decay changes strangeness: only the weak force can do that.
	const l = checkDecay('Lambda', ['p', 'pi-']).strangeness;
	expect(l.before).not.toBe(l.after);
});

test('the listed decays cover essentially every decay of each particle', () => {
	// The checker labels any allowed build missing from the list as rare: the list must not
	// leave out a common real decay (K⁺ → π⁺π⁰π⁰, 1.76 %, once was).
	const k = checkDecay('K+', ['pi+', 'pi0', 'pi0']);
	expect(k.allowed).toBe(true);
	expect(k.mode?.fraction).toBeCloseTo(0.0176, 3);
	const parents = new Set(modes.filter((m) => !m.limit).map((m) => m.parent));
	for (const parent of parents) {
		const total = modes
			.filter((m) => m.parent === parent && !m.limit)
			.reduce((s, m) => s + m.fraction, 0);
		expect(total, parent).toBeGreaterThanOrEqual(0.99);
	}
});

test('every vertex of every process conserves charge, baryon number and lepton numbers', () => {
	for (const p of Object.values(PROCESSES)) {
		const first = ledger(p.stages[0]);
		for (const s of p.stages) expect(ledger(s), `${p.id}: ${s.label}`).toEqual(first);
	}
	// The gluon carries colour: the total colour stays one red and one green.
	for (const s of PROCESSES.gluon.stages) expect(colourCount(s)).toEqual({ r: 1, g: 1, b: 0 });
});

test('the W’s mass limits the weak force to about 10⁻¹⁸ m, far inside a proton', () => {
	const w = PARTICLES.find((p) => p.key === 'W')?.mass?.v ?? 0;
	expect(reach(w)).toBeGreaterThan(2.4e-18);
	expect(reach(w)).toBeLessThan(2.5e-18);
	// A proton is about 0.84 fm across: the W's reach is a few hundred times smaller.
	expect(0.84e-15 / reach(w)).toBeGreaterThan(300);
});
