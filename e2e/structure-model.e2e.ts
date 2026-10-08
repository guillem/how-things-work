// Checks the frame solver behind the bridges-structures explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BUDGET,
	DENSITY,
	DESIGNS,
	E,
	G,
	addMember,
	boxSection,
	bucklingLoad,
	pushLimit,
	yieldLoad,
	deckComplete,
	envelope,
	parseStructure,
	removeMember,
	serializeStructure,
	size,
	solve,
	steelMass,
	type Structure
} from '../src/routes/bridges-structures/structure';

const P = 30_000 * G;

/** A beam from (0, 0) to (40, 0) in n pieces, pinned at both ends (anchors). */
function beam(n: number): Structure {
	let s: Structure = { joints: [], members: [] };
	for (let i = 0; i < n; i++)
		s = addMember(s, 'beam', { x: (40 * i) / n, y: 0 }, { x: (40 * (i + 1)) / n, y: 0 });
	return s;
}

test('a simply supported beam: midspan moment wL²/8 + PL/4 and the textbook deflection', () => {
	const s = beam(8);
	const A = 0.05;
	const areas = s.members.map(() => A);
	const w = A * DENSITY * G;
	const sol = solve(s, 20, areas);
	const M = Math.max(...sol.members.map((m) => m.moment));
	expect(M / ((w * 40 ** 2) / 8 + (P * 40) / 4)).toBeCloseTo(1, 3);
	// Deflection at midspan: 5wL⁴/384EI + PL³/48EI.
	const { I } = boxSection(A);
	const mid = sol.displacement[s.joints.findIndex((j) => j.x === 20)][1];
	const expected = (5 * w * 40 ** 4) / (384 * E * I) + (P * 40 ** 3) / (48 * E * I);
	expect(-mid / expected).toBeCloseTo(1, 3);
});

test('two cables hanging in a V pull equally, as the triangle of forces says', () => {
	let s: Structure = { joints: [], members: [] };
	// From the left bank's edge and from a point on the right bank (not the road's sliding end).
	s = addMember(s, 'cable', { x: 0, y: 0 }, { x: 22.5, y: -10 });
	s = addMember(s, 'cable', { x: 45, y: 0 }, { x: 22.5, y: -10 });
	const sol = solve(s, null, [0.01, 0.01]);
	expect(sol.members[0].axial).toBeGreaterThan(0);
	expect(sol.members[0].axial).toBeCloseTo(sol.members[1].axial, 3);
	// Half of each cable's weight hangs on the bottom joint: w·L in all, carried by the two
	// cables' vertical pulls, T·(10/L) each. (The solver's axial force is the average along the
	// cable, a little above T at the bottom, so allow some margin.)
	const L = Math.hypot(22.5, 10);
	const w = 0.01 * DENSITY * G;
	const T = (w * L) / 2 / (10 / L);
	expect(sol.members[0].axial / T).toBeGreaterThan(0.9);
	expect(sol.members[0].axial / T).toBeLessThan(1.3);
});

test('cables only pull: a cable that would push goes slack', () => {
	for (const d of Object.values(DESIGNS)) {
		const sol = solve(d, 20, size(d));
		d.members.forEach((m, i) => {
			if (m.kind === 'cable') expect(sol.members[i].axial).toBeGreaterThanOrEqual(0);
		});
	}
});

test('every design uses the same steel, and the plain beam is the one that fails', () => {
	const worst: Record<string, number> = {};
	for (const [name, d] of Object.entries(DESIGNS)) {
		const areas = size(d);
		expect(steelMass(d, areas)).toBeCloseTo(BUDGET, 0);
		expect(deckComplete(d)).toBe(true);
		const env = envelope(d, areas);
		expect(env.unstable).toBe(false);
		worst[name] = env.worst;
	}
	expect(worst.beam).toBeGreaterThan(1);
	expect(worst.truss).toBeLessThan(0.5);
	expect(worst.arch).toBeLessThan(0.8);
	expect(worst.suspension).toBeLessThan(0.8);
});

test('truss chords: the top is pushed, the bottom pulled', () => {
	const t = DESIGNS.truss;
	const sol = solve(t, 20, size(t));
	t.members.forEach((m, i) => {
		const [p, q] = [t.joints[m.a], t.joints[m.b]];
		if (p.y === 5 && q.y === 5) expect(sol.members[i].axial).toBeLessThan(0);
		if (p.y === 0 && q.y === 0) expect(sol.members[i].axial).toBeGreaterThan(0);
	});
});

test('in a truss the members mostly pull or push; in the beam they bend', () => {
	const t = DESIGNS.truss;
	const sol = solve(t, 20, size(t));
	const axialShare = sol.members.filter(
		(m) => m.mode === 'tension' || m.mode === 'compression'
	).length;
	expect(axialShare).toBeGreaterThan(t.members.length / 3);
	const b = solve(DESIGNS.beam, 20, size(DESIGNS.beam));
	expect(b.members.every((m) => m.mode === 'bending')).toBe(true);
});

test('in the arch the curved rib is pushed (compression) and the banks are pushed outward', () => {
	const a = DESIGNS.arch;
	const sol = solve(a, null, size(a));
	const rib = a.members
		.map((m, i) => ({ m, i }))
		.filter(({ m }) => a.joints[m.a].y < -0.1 && a.joints[m.b].y < -0.1);
	expect(rib.length).toBeGreaterThan(4);
	for (const { i } of rib) expect(sol.members[i].axial).toBeLessThan(0);
});

test('a gap in the road, and a loose member', () => {
	const s = removeMember(beam(8), 3);
	expect(deckComplete(s)).toBe(false);
	// A beam floating in mid-air carries nothing and does not upset the rest.
	const loose = addMember(beam(8), 'beam', { x: 10, y: -5 }, { x: 15, y: -5 });
	const sol = solve(loose, 20);
	expect(sol.unstable).toBe(false);
	expect(sol.members.at(-1)!.unsupported).toBe(true);
});

test('the text form round-trips', () => {
	for (const d of Object.values(DESIGNS)) {
		const str = serializeStructure(d);
		expect(serializeStructure(parseStructure(str)!)).toBe(str);
	}
	expect(parseStructure('nope')).toBeNull();
});

test('the scaffolding tube: yields at about 113 kN, buckles far sooner when long', () => {
	expect(yieldLoad() / 1000).toBeGreaterThan(105);
	expect(yieldLoad() / 1000).toBeLessThan(120);
	expect(bucklingLoad(2) / 1000).toBeGreaterThan(50); // ~57 kN at 2 m
	expect(bucklingLoad(2) / 1000).toBeLessThan(65);
	expect(bucklingLoad(4) / bucklingLoad(2)).toBeCloseTo(0.25, 10); // twice as long, a quarter
	expect(pushLimit(1)).toBe(yieldLoad()); // short: crushing, not buckling
});
