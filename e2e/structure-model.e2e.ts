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
	faceSign,
	faceStresses,
	isAnchor,
	jointAt,
	memberBetween,
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
	// The numbers the page quotes: the beam at "about 1.3 times" its limit, the truss's busiest
	// member at "about a quarter" of its strength, "five times better used".
	expect(worst.beam).toBeGreaterThan(1.25);
	expect(worst.beam).toBeLessThan(1.35);
	expect(worst.truss).toBeGreaterThan(0.22);
	expect(worst.truss).toBeLessThan(0.3);
	expect(worst.truss / worst.beam).toBeCloseTo(0.2, 1);
});

test('to match the truss, the beam needs about five times the steel', () => {
	const truss = envelope(DESIGNS.truss, size(DESIGNS.truss)).worst;
	const beam = (k: number) => envelope(DESIGNS.beam, size(DESIGNS.beam, k * BUDGET)).worst;
	expect(beam(4)).toBeGreaterThan(truss);
	expect(beam(6)).toBeLessThan(truss);
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
		(m) => m.mode === 'tension' || m.mode === 'compression' || m.mode === 'buckling'
	).length;
	expect(axialShare).toBeGreaterThan(0.8 * t.members.length);
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
	// At its springings (on the gap's walls, 10 m down) the rib pushes into the rock: leftwards
	// on the left wall, rightwards on the right one.
	const push = (x: number) =>
		a.members.reduce((sum, m, i) => {
			const r = sol.members[i];
			const at = (j: number) => a.joints[j].x === x && a.joints[j].y === -10;
			return sum + (at(m.a) ? r.endA[0] : 0) + (at(m.b) ? r.endB[0] : 0);
		}, 0);
	expect(push(0)).toBeLessThan(0);
	expect(push(40)).toBeGreaterThan(0);
});

test('the thin steel rib is squeezed all through under its own weight, but a truck on one side stretches one face', () => {
	const a = DESIGNS.arch;
	const areas = size(a);
	const rib = a.members.flatMap((m, i) =>
		a.joints[m.a].y < -0.1 && a.joints[m.b].y < -0.1 ? [i] : []
	);
	const faces = (truck: number | null) => {
		const sol = solve(a, truck, areas);
		return rib.flatMap((i) => {
			const f = faceStresses(sol.members[i], areas[i]);
			return [faceSign(f.plus), faceSign(f.minus)];
		});
	};
	expect(faces(null).some((v) => v < 0)).toBe(true);
	expect(faces(null).every((v) => v <= 0)).toBe(true);
	expect(faces(10).some((v) => v > 0)).toBe(true);
});

test('the arch holds the road on its posts: they are pushed, and the truck loads them', () => {
	const a = DESIGNS.arch;
	const areas = size(a);
	const posts = a.members.map((m, i) => ({ m, i })).filter(({ m }) => m.kind === 'post');
	expect(posts).toHaveLength(7);
	// The road's weight reaches the rib through the posts (a rigidly framed deck
	// would span between the banks and leave them idle): every post pushed, none bent.
	const dead = solve(a, null, areas);
	for (const { i } of posts) {
		expect(dead.members[i].axial).toBeLessThan(-10_000);
		expect(dead.members[i].moment).toBe(0);
	}
	// A truck at midspan more than doubles the push on the posts around it.
	const live = solve(a, 20, areas);
	for (const { m, i } of posts)
		if (Math.abs(a.joints[m.b].x - 20) <= 5)
			expect(live.members[i].axial).toBeLessThan(2 * dead.members[i].axial);
});

test('a member drawn through a joint is split and joined there', () => {
	// A long beam over the whole road replaces the pieces without duplicating them.
	const s = addMember(beam(8), 'beam', { x: 0, y: 0 }, { x: 40, y: 0 });
	expect(s.members).toHaveLength(8);
	// A pier to the middle of a single long beam splits it and holds it.
	const t = addMember(beam(1), 'beam', { x: 20, y: 0 }, { x: 20, y: -12.5 });
	const at = (x: number, y: number) => jointAt(t, { x, y });
	expect(memberBetween(t, at(0, 0), at(40, 0))).toBe(-1);
	expect(memberBetween(t, at(0, 0), at(20, 0))).toBeGreaterThanOrEqual(0);
	expect(memberBetween(t, at(20, 0), at(40, 0))).toBeGreaterThanOrEqual(0);
	expect(memberBetween(t, at(20, 0), at(20, -12.5))).toBeGreaterThanOrEqual(0);
});

test('the ground carries the bridge: the pushes on the banks add up to the whole load', () => {
	const s = DESIGNS.beam;
	const areas = size(s);
	const sol = solve(s, 20, areas);
	let fx = 0;
	let fy = 0;
	s.joints.forEach((j, ji) => {
		if (!isAnchor(j)) return;
		s.members.forEach((m, i) => {
			if (m.a !== ji && m.b !== ji) return;
			const e = m.a === ji ? sol.members[i].endA : sol.members[i].endB;
			fx += e[0];
			fy += e[1];
		});
	});
	const load = steelMass(s, areas) * G + P;
	expect(-fy / load).toBeCloseTo(1, 3);
	expect(Math.abs(fx) / load).toBeLessThan(0.01);
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
	// "beyond about 1.4 m here" the post buckles before it crushes.
	expect(pushLimit(1.35)).toBe(yieldLoad());
	expect(pushLimit(1.45)).toBeLessThan(yieldLoad());
});
