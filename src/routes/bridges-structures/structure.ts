/**
 * Bridges as 2-D steel frames, solved by the stiffness method.
 *
 * - Joints sit on a 2.5 m grid. A joint on solid ground (an anchor point) is
 *   pinned: it cannot move, but members may turn about it — except the road's
 *   right-hand end, which sits on a sliding bearing (`isRoller`).
 * - A **beam** is a straight steel member, rigidly joined to the others at its
 *   ends: it can pull, push and bend (a 2-D frame element with axial and
 *   bending stiffness). Its cross-section is a square steel box whose walls
 *   are a tenth of its width.
 * - A **cable** is a steel wire rope: it can only pull. A cable that the
 *   solution says would push goes slack and is removed, and the frame is
 *   solved again until no cable pushes.
 * - Every design gets the same mass of steel, shared out among its members
 *   by `size` (more steel where the forces are larger, as an engineer would).
 * - Loads: the weight of the steel itself (a uniform load along each member)
 *   and a truck, a point load on the deck (the beams at road level).
 * - "How close to failure" is the utilisation: 1 means the member is at its
 *   limit. For a beam it is the larger of (stress from pulling or pushing +
 *   stress from bending) ÷ yield stress and, when it is pushed, push ÷ the
 *   Euler buckling load + bending stress ÷ yield stress. For a cable, pull ÷
 *   breaking load.
 *
 * Simplifications, stated on the page: no safety factors, no dynamic effects
 * of the moving truck, static linear-elastic behaviour (small deflections),
 * each member a single straight element, buckling of each member on its own
 * with pinned ends.
 */

export const E = 200e9; // Pa, steel
export const YIELD = 250e6; // Pa, structural steel
export const CABLE_STRENGTH = 1500e6; // Pa, high-strength steel wire
export const DENSITY = 7850; // kg/m³
export const G = 9.81;
export const GRID = 2.5; // m

/** The gap: road level is y = 0, the banks are at x ≤ 0 and x ≥ SPAN. */
export const SPAN = 40;
/** How far the banks reach on each side (for anchors and towers). */
export const BANK = 12.5;
/** Depth of the gap below the road. */
export const DEPTH = 12.5;
/** Steel available for every design (kg). */
export const BUDGET = 25_000;
/** The truck: 30 tonnes. */
export const TRUCK_MASS = 30_000;

export type MemberKind = 'beam' | 'cable';

export interface Joint {
	x: number;
	y: number;
}

export interface Member {
	kind: MemberKind;
	a: number;
	b: number;
}

export interface Structure {
	joints: Joint[];
	members: Member[];
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * Is a point on solid ground? The top of each bank (y = 0, outside the gap),
 * the faces of the gap (x = 0 or x = SPAN, down to DEPTH) — where an arch
 * can push against the rock — and the floor of the gap, where a pier can stand.
 */
export function isAnchor(p: Joint) {
	if (
		near(p.y, 0) &&
		(p.x <= 1e-6 || p.x >= SPAN - 1e-6) &&
		p.x >= -BANK - 1e-6 &&
		p.x <= SPAN + BANK + 1e-6
	)
		return true;
	if ((near(p.x, 0) || near(p.x, SPAN)) && p.y <= 1e-6 && p.y >= -DEPTH - 1e-6) return true;
	// The floor of the gap: where a pier (a support) can stand.
	if (near(p.y, -DEPTH) && p.x >= -1e-6 && p.x <= SPAN + 1e-6) return true;
	return false;
}

/**
 * The road's right-hand end (x = SPAN, y = 0) rests on a sliding bearing, as
 * real bridges do so that they can expand and contract with temperature: it
 * holds the bridge up but lets it move sideways.
 */
export const isRoller = (p: Joint) => near(p.x, SPAN) && near(p.y, 0);

export const memberLength = (s: Structure, m: Member) =>
	Math.hypot(s.joints[m.b].x - s.joints[m.a].x, s.joints[m.b].y - s.joints[m.a].y);

export const totalLength = (s: Structure) => s.members.reduce((t, m) => t + memberLength(s, m), 0);

/** Cross-section area every member gets if the steel budget is shared out equally by length (m²). */
export const sectionArea = (s: Structure, budget = BUDGET) =>
	budget / DENSITY / Math.max(1e-9, totalLength(s));

export const equalAreas = (s: Structure, budget = BUDGET) =>
	s.members.map(() => sectionArea(s, budget));

/** Mass of steel in a structure with these member areas (kg). */
export const steelMass = (s: Structure, areas: readonly number[]) =>
	s.members.reduce((t, m, i) => t + areas[i] * memberLength(s, m) * DENSITY, 0);

/**
 * Shares the steel budget out among the members the way an engineer would:
 * more steel where the forces are larger. Starting from equal sections, each
 * member's area is repeatedly scaled by its utilisation under the bridge's own
 * weight and the truck at several places, then all are rescaled to use
 * exactly the budget. Members that carry almost nothing keep a minimum size.
 */
export function size(s: Structure, budget = BUDGET, rounds = 8): number[] {
	let areas = equalAreas(s, budget);
	if (!s.members.length) return areas;
	const minArea = sectionArea(s, budget) * 0.1;
	// Own weight alone, and the truck every 2.5 m (over every joint and midway between them).
	const positions: (number | null)[] = [null];
	for (let x = GRID; x < SPAN; x += GRID) positions.push(x);
	for (let r = 0; r < rounds; r++) {
		const need = s.members.map(() => 0);
		for (const x of positions) {
			const sol = solve(s, x, areas);
			if (sol.unstable) return areas;
			sol.members.forEach((m, i) => (need[i] = Math.max(need[i], m.utilisation)));
		}
		areas = areas.map((a, i) => Math.max(minArea, a * Math.pow(Math.max(need[i], 0.02), 0.6)));
		const k = budget / steelMass(s, areas);
		areas = areas.map((a) => a * k);
	}
	return areas;
}

/** Square box section of area A with walls a tenth of its width: width and second moment of area. */
export function boxSection(A: number) {
	const w = Math.sqrt(A / 0.36); // A = w² − (0.8w)² = 0.36 w²
	const I = (w ** 4 - (0.8 * w) ** 4) / 12;
	return { w, I };
}

// ------------------------------------------------------------ editing

/** Index of the joint at a point, or −1. */
export const jointAt = (s: Structure, p: Joint) =>
	s.joints.findIndex((j) => near(j.x, p.x) && near(j.y, p.y));

export const memberBetween = (s: Structure, a: number, b: number) =>
	s.members.findIndex((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a));

/** Snaps a point to the grid. */
export const snap = (p: Joint): Joint => ({
	x: Math.round(p.x / GRID) * GRID,
	y: Math.round(p.y / GRID) * GRID
});

/** Adds a member between two points (creating joints as needed); replaces an existing one. */
export function addMember(s: Structure, kind: MemberKind, p: Joint, q: Joint): Structure {
	const P = snap(p);
	const Q = snap(q);
	if (near(P.x, Q.x) && near(P.y, Q.y)) return s;
	const joints = [...s.joints];
	const idx = (pt: Joint) => {
		const i = joints.findIndex((j) => near(j.x, pt.x) && near(j.y, pt.y));
		if (i >= 0) return i;
		joints.push(pt);
		return joints.length - 1;
	};
	const a = idx(P);
	const b = idx(Q);
	const members = s.members.filter((m) => !((m.a === a && m.b === b) || (m.a === b && m.b === a)));
	return { joints, members: [...members, { kind, a, b }] };
}

/** Removes member i and any joint left without members. */
export function removeMember(s: Structure, i: number): Structure {
	const members = s.members.filter((_, k) => k !== i);
	return prune({ joints: s.joints, members });
}

function prune(s: Structure): Structure {
	const used = new Set(s.members.flatMap((m) => [m.a, m.b]));
	const map = new Map<number, number>();
	const joints: Joint[] = [];
	s.joints.forEach((j, i) => {
		if (used.has(i)) {
			map.set(i, joints.length);
			joints.push(j);
		}
	});
	return { joints, members: s.members.map((m) => ({ ...m, a: map.get(m.a)!, b: map.get(m.b)! })) };
}

// ------------------------------------------------------------ text form (for params)

/** `x,y;x,y|b a b;c a b` (beams `b`, cables `c`), coordinates in metres. */
export function serializeStructure(s: Structure): string {
	const j = s.joints.map((p) => `${+p.x.toFixed(2)},${+p.y.toFixed(2)}`).join(';');
	const m = s.members.map((x) => `${x.kind === 'beam' ? 'b' : 'c'} ${x.a} ${x.b}`).join(';');
	return `${j}|${m}`;
}

export function parseStructure(str: unknown): Structure | null {
	if (typeof str !== 'string' || !str.includes('|')) return null;
	const [js, ms] = str.split('|');
	const joints: Joint[] = [];
	for (const item of js ? js.split(';') : []) {
		const [x, y] = item.split(',').map(Number);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		joints.push({ x, y });
	}
	const members: Member[] = [];
	for (const item of ms ? ms.split(';') : []) {
		const [k, a, b] = item.split(' ');
		if ((k !== 'b' && k !== 'c') || !((+a) in joints) || !((+b) in joints) || +a === +b)
			return null;
		members.push({ kind: k === 'b' ? 'beam' : 'cable', a: +a, b: +b });
	}
	return { joints, members };
}

// ------------------------------------------------------------ solving

export interface MemberResult {
	/** Axial force (N), positive = tension (pulling), negative = compression (pushing). */
	axial: number;
	/** Largest bending moment along the member (N·m, magnitude). */
	moment: number;
	/** Bending moment at the member's ends and at sample points (N·m, sagging positive), for drawing. */
	momentAt: { u: number; m: number }[];
	/** 0 = idle, 1 = at its limit, > 1 = would fail. */
	utilisation: number;
	/** Which limit governs. */
	mode: 'tension' | 'compression' | 'buckling' | 'bending' | 'slack' | 'none';
	/** A cable that went slack (would push, so carries nothing). */
	slack: boolean;
	/** Not connected to the ground through other members: carries nothing. */
	unsupported: boolean;
}

export interface Solution {
	/** Joint displacements (m), [dx, dy] per joint. */
	displacement: [number, number][];
	members: MemberResult[];
	/** Highest utilisation of any member. */
	worst: number;
	/** The frame cannot carry the load at all (a mechanism: it would fold up). */
	unstable: boolean;
	/** Largest joint movement (m), from the linear solution. */
	maxDeflection: number;
	/** Some part of the road is not carried by any member (the truck would fall in). */
	gapInDeck: boolean;
	/** Cross-section area (m²) and box width (m) of every member. */
	areas: number[];
	widths: number[];
}

/** Solves A·x = b (Gaussian elimination with partial pivoting); null when singular. */
function solveLinear(A: Float64Array[], b: Float64Array): Float64Array | null {
	const n = b.length;
	let scale = 0;
	for (let i = 0; i < n; i++) scale = Math.max(scale, Math.abs(A[i][i]));
	for (let c = 0; c < n; c++) {
		let piv = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
		if (Math.abs(A[piv][c]) < scale * 1e-13) return null;
		[A[c], A[piv]] = [A[piv], A[c]];
		[b[c], b[piv]] = [b[piv], b[c]];
		const d = A[c][c];
		for (let r = c + 1; r < n; r++) {
			const f = A[r][c] / d;
			if (f === 0) continue;
			const Ar = A[r];
			const Ac = A[c];
			for (let k = c; k < n; k++) Ar[k] -= f * Ac[k];
			b[r] -= f * b[c];
		}
	}
	const x = new Float64Array(n);
	for (let r = n - 1; r >= 0; r--) {
		let s = b[r];
		for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
		x[r] = s / A[r][r];
	}
	return x;
}

/** Deck members: beams lying along the road (y = 0) inside the gap. */
export const isDeck = (s: Structure, m: Member) =>
	m.kind === 'beam' && near(s.joints[m.a].y, 0) && near(s.joints[m.b].y, 0);

/** Is every point of the road across the gap carried by a deck beam? */
export function deckComplete(s: Structure) {
	const spans = s.members
		.filter((m) => isDeck(s, m))
		.map((m) => [
			Math.min(s.joints[m.a].x, s.joints[m.b].x),
			Math.max(s.joints[m.a].x, s.joints[m.b].x)
		])
		.sort((p, q) => p[0] - q[0]);
	let reach = 0;
	for (const [lo, hi] of spans) {
		if (lo > reach + 1e-6) break;
		reach = Math.max(reach, hi);
	}
	return reach >= SPAN - 1e-6;
}

/** The deck member under the road at x (inside the gap), or −1. */
export function deckMemberAt(s: Structure, x: number) {
	return s.members.findIndex((m) => {
		if (!isDeck(s, m)) return false;
		const lo = Math.min(s.joints[m.a].x, s.joints[m.b].x);
		const hi = Math.max(s.joints[m.a].x, s.joints[m.b].x);
		return x >= lo - 1e-9 && x <= hi + 1e-9;
	});
}

/**
 * Solves the structure with the truck at `truckX` (metres from the left
 * edge of the gap; outside [0, SPAN] the truck is on solid ground and only
 * the bridge's own weight acts). `truckX = null`: own weight only.
 */
export function solve(
	s: Structure,
	truckX: number | null = null,
	areas: readonly number[] = equalAreas(s)
): Solution {
	// Members not connected to the ground carry nothing and would leave the
	// equations without a solution: solve only the parts joined to an anchor.
	const parent = s.joints.map((_, i) => i);
	const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
	for (const m of s.members) parent[find(m.a)] = find(m.b);
	const grounded = new Set(s.joints.flatMap((j, i) => (isAnchor(j) ? [find(i)] : [])));
	const keep = s.members.map((m) => grounded.has(find(m.a)));
	if (keep.some((k) => !k)) {
		const sub = s.members.flatMap((m, i) => (keep[i] ? [i] : []));
		// Keep only the joints the grounded members use (a joint with nothing attached
		// would leave the equations without a solution).
		const used = [...new Set(sub.flatMap((i) => [s.members[i].a, s.members[i].b]))];
		const index = new Map(used.map((j, k) => [j, k]));
		const part = solveConnected(
			{
				joints: used.map((j) => s.joints[j]),
				members: sub.map((i) => ({
					...s.members[i],
					a: index.get(s.members[i].a)!,
					b: index.get(s.members[i].b)!
				}))
			},
			truckX,
			sub.map((i) => areas[i])
		);
		const members: MemberResult[] = s.members.map(() => ({ ...IDLE, unsupported: true }));
		sub.forEach((i, k) => (members[i] = part.members[k]));
		return {
			...part,
			displacement: s.joints.map((_, j) =>
				index.has(j) ? part.displacement[index.get(j)!] : ([0, 0] as [number, number])
			),
			members,
			areas: [...areas],
			widths: areas.map((a) => boxSection(a).w),
			gapInDeck: !deckComplete(s)
		};
	}
	return solveConnected(s, truckX, areas);
}

const IDLE: MemberResult = {
	axial: 0,
	moment: 0,
	momentAt: [],
	utilisation: 0,
	mode: 'none',
	slack: false,
	unsupported: false
};

/** `solve` for a structure whose members all connect to an anchor. */
function solveConnected(s: Structure, truckX: number | null, areas: readonly number[]): Solution {
	const nJ = s.joints.length;
	const sections = areas.map((A) => ({ A, ...boxSection(A) }));
	const empty: Solution = {
		displacement: s.joints.map(() => [0, 0]),
		members: [],
		worst: 0,
		unstable: false,
		maxDeflection: 0,
		gapInDeck: !deckComplete(s),
		areas: [...areas],
		widths: sections.map((x) => x.w)
	};
	if (!s.members.length) return { ...empty, unstable: true };

	const truck = truckX !== null && truckX > 0 && truckX < SPAN ? deckMemberAt(s, truckX) : -1;
	const P = TRUCK_MASS * G;

	let active = s.members.map(() => true); // cables that are not slack
	let result: Solution | null = null;
	for (let iter = 0; iter < 12; iter++) {
		const n = 3 * nJ;
		const K = Array.from({ length: n }, () => new Float64Array(n));
		const F = new Float64Array(n);
		/** Equivalent nodal loads per member in local coordinates (for recovering end forces). */
		const feq: Float64Array[] = [];
		const geo = s.members.map((m) => {
			const p = s.joints[m.a];
			const q = s.joints[m.b];
			const L = Math.hypot(q.x - p.x, q.y - p.y);
			return { L, c: (q.x - p.x) / L, s: (q.y - p.y) / L };
		});
		s.members.forEach((m, k) => {
			const { L, c, s: sn } = geo[k];
			const { A, I } = sections[k];
			const EA = active[k] ? E * A : E * A * 1e-9; // a slack cable: next to nothing
			const EI = m.kind === 'beam' ? E * I : 0;
			const weightPerMetre = A * DENSITY * G;
			const kl = localStiffness(EA, EI, L);
			const T = transform(c, sn);
			const kg = mul(transpose(T), mul(kl, T));
			const dofs = [3 * m.a, 3 * m.a + 1, 3 * m.a + 2, 3 * m.b, 3 * m.b + 1, 3 * m.b + 2];
			for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) K[dofs[i]][dofs[j]] += kg[i][j];

			// Loads in local coordinates: own weight (uniform, straight down) and the truck.
			// Gravity (0, −w) in local axes: along = −w·s, across = −w·c.
			const f = new Float64Array(6);
			const qx = -weightPerMetre * sn;
			const qy = -weightPerMetre * c;
			f[0] += (qx * L) / 2;
			f[3] += (qx * L) / 2;
			f[1] += (qy * L) / 2;
			f[4] += (qy * L) / 2;
			if (m.kind === 'beam') {
				f[2] += (qy * L * L) / 12;
				f[5] -= (qy * L * L) / 12;
			}
			if (k === truck) {
				const xa = s.joints[m.a].x;
				const a = Math.abs(truckX! - xa); // distance from joint a along the member (deck is level)
				const b = L - a;
				const Px = -P * sn; // deck is level: s = 0, so all across
				const Py = -P * c;
				f[0] += (Px * b) / L;
				f[3] += (Px * a) / L;
				if (m.kind === 'beam') {
					f[1] += (Py * b * b * (3 * a + b)) / L ** 3;
					f[4] += (Py * a * a * (a + 3 * b)) / L ** 3;
					f[2] += (Py * a * b * b) / (L * L);
					f[5] -= (Py * a * a * b) / (L * L);
				}
			}
			feq.push(f);
			const fg = mulVec(transpose(T), f);
			for (let i = 0; i < 6; i++) F[dofs[i]] += fg[i];
		});

		// Supports: anchors are pinned. Every joint gets a tiny rotational spring,
		// so a joint where only cables meet is still defined (it changes nothing else).
		const fixed = new Set<number>();
		s.joints.forEach((j, i) => {
			if (isAnchor(j)) {
				if (!isRoller(j)) fixed.add(3 * i);
				fixed.add(3 * i + 1);
			}
			K[3 * i + 2][3 * i + 2] += 1;
		});
		const free = [...Array(n).keys()].filter((i) => !fixed.has(i));
		const Kf = free.map((i) => Float64Array.from(free.map((j) => K[i][j])));
		const Ff = Float64Array.from(free.map((i) => F[i]));
		const xf = free.length ? solveLinear(Kf, Ff) : new Float64Array(0);
		if (!xf) return { ...empty, unstable: true };
		const d = new Float64Array(n);
		free.forEach((dof, i) => (d[dof] = xf[i]));

		// A mechanism shows up as enormous movement held only by the tiny springs.
		const maxMove = Math.max(0, ...s.joints.map((_, i) => Math.hypot(d[3 * i], d[3 * i + 1])));
		const unstable = !Number.isFinite(maxMove) || maxMove > SPAN / 4;

		const members: MemberResult[] = s.members.map((m, k) => {
			const { L, c, s: sn } = geo[k];
			const { A, I, w: width } = sections[k];
			const EA = active[k] ? E * A : E * A * 1e-9; // a slack cable: next to nothing
			const EI = m.kind === 'beam' ? E * I : 0;
			const weightPerMetre = A * DENSITY * G;
			const T = transform(c, sn);
			const dg = [3 * m.a, 3 * m.a + 1, 3 * m.a + 2, 3 * m.b, 3 * m.b + 1, 3 * m.b + 2].map(
				(i) => d[i]
			);
			const dl = mulVec(T, dg);
			const kd = mulVec(localStiffness(EA, EI, L), dl);
			const fe = kd.map((v, i) => v - feq[k][i]); // forces on the member at its ends
			// Tension positive: the pull at end b along +x, averaged with end a's.
			const axial = (fe[3] - fe[0]) / 2;
			if (m.kind === 'cable') {
				const slack = !active[k];
				return {
					axial: slack ? 0 : axial,
					moment: 0,
					momentAt: [],
					utilisation: slack ? 0 : Math.max(0, axial) / (A * CABLE_STRENGTH),
					mode: slack ? 'slack' : 'tension',
					slack,
					unsupported: false
				};
			}
			// Bending moment along the beam (sagging positive), from end a's forces and the loads.
			const qy = -weightPerMetre * c;
			const tA = k === truck ? Math.abs(truckX! - s.joints[m.a].x) : -1;
			const Py = -P * c;
			const M = (x: number) =>
				-fe[2] + fe[1] * x + (qy * x * x) / 2 + (tA >= 0 && x > tA ? Py * (x - tA) : 0);
			const samples = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((u) => u * L);
			if (tA >= 0) samples.push(tA);
			samples.sort((p, q) => p - q);
			const momentAt = samples.map((x) => ({ u: x / L, m: M(x) }));
			const moment = Math.max(...momentAt.map((p) => Math.abs(p.m)));
			const bendStress = (moment * (width / 2)) / I;
			const axialStress = Math.abs(axial) / A;
			const strength = (axialStress + bendStress) / YIELD;
			const buckling =
				axial < 0 ? -axial / ((Math.PI ** 2 * E * I) / (L * L)) + bendStress / YIELD : 0;
			const utilisation = Math.max(strength, buckling);
			const mode: MemberResult['mode'] =
				utilisation < 1e-6
					? 'none'
					: buckling > strength
						? 'buckling'
						: bendStress > axialStress
							? 'bending'
							: axial < 0
								? 'compression'
								: 'tension';
			return { axial, moment, momentAt, utilisation, mode, slack: false, unsupported: false };
		});

		result = {
			displacement: s.joints.map((_, i) => [d[3 * i], d[3 * i + 1]]),
			members,
			worst: Math.max(0, ...members.map((r) => r.utilisation)),
			unstable,
			maxDeflection: maxMove,
			gapInDeck: !deckComplete(s),
			areas: [...areas],
			widths: sections.map((x) => x.w)
		};
		// Slacken cables that would push; stop when nothing changes.
		let changed = false;
		s.members.forEach((m, k) => {
			if (m.kind === 'cable' && active[k] && members[k].axial < -1e-6) {
				active = active.map((v, i) => (i === k ? false : v));
				changed = true;
			}
		});
		if (!changed) break;
	}
	return result!;
}

/** The worst utilisation of every member as the truck crosses (sampled every 1 m), and the worst overall. */
export function envelope(s: Structure, areas: readonly number[] = equalAreas(s), step = 1) {
	const per = s.members.map(() => 0);
	let unstable = false;
	for (let x = 0; x <= SPAN + 1e-9; x += step) {
		const sol = solve(s, x, areas);
		unstable ||= sol.unstable;
		sol.members.forEach((r, i) => (per[i] = Math.max(per[i], r.utilisation)));
	}
	return { per, worst: Math.max(0, ...per), unstable };
}

// ------------------------------------------------------------ small matrices

function localStiffness(EA: number, EI: number, L: number): number[][] {
	const a = EA / L;
	const b = (12 * EI) / L ** 3;
	const c = (6 * EI) / L ** 2;
	const d = (4 * EI) / L;
	const e = (2 * EI) / L;
	return [
		[a, 0, 0, -a, 0, 0],
		[0, b, c, 0, -b, c],
		[0, c, d, 0, -c, e],
		[-a, 0, 0, a, 0, 0],
		[0, -b, -c, 0, b, -c],
		[0, c, e, 0, -c, d]
	];
}

function transform(c: number, s: number): number[][] {
	return [
		[c, s, 0, 0, 0, 0],
		[-s, c, 0, 0, 0, 0],
		[0, 0, 1, 0, 0, 0],
		[0, 0, 0, c, s, 0],
		[0, 0, 0, -s, c, 0],
		[0, 0, 0, 0, 0, 1]
	];
}

const transpose = (m: number[][]) => m[0].map((_, j) => m.map((row) => row[j]));
const mul = (a: number[][], b: number[][]) =>
	a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
const mulVec = (a: number[][], v: ArrayLike<number>) =>
	a.map((row) => row.reduce((s, x, k) => s + x * v[k], 0));

// ------------------------------------------------------------ the designs on the page

/** A structure from members given by their end points (not snapped: designs may use curves). */
const build = (beams: [number, number][][], cables: [number, number][][] = []): Structure => {
	const joints: Joint[] = [];
	const members: Member[] = [];
	const idx = ([x, y]: [number, number]) => {
		const i = joints.findIndex((j) => near(j.x, x) && near(j.y, y));
		if (i >= 0) return i;
		joints.push({ x, y });
		return joints.length - 1;
	};
	for (const [p, q] of beams) members.push({ kind: 'beam', a: idx(p), b: idx(q) });
	for (const [p, q] of cables) members.push({ kind: 'cable', a: idx(p), b: idx(q) });
	return { joints, members };
};

/** Pairs of consecutive points along a polyline. */
const chain = (...pts: [number, number][]) => pts.slice(1).map((p, i) => [pts[i], p]);

const deckXs = Array.from({ length: SPAN / 5 + 1 }, (_, i) => i * 5);
const DECK = chain(...deckXs.map((x) => [x, 0] as [number, number]));

/** A plain beam across the gap (the road itself, in 5 m pieces joined rigidly). */
export const BEAM = build(DECK);

/** A Warren-style truss: the road, a top chord 5 m up and diagonals forming triangles. */
export const TRUSS = build([
	...DECK,
	...chain(...[5, 10, 15, 20, 25, 30, 35].map((x) => [x, 5] as [number, number])),
	...deckXs
		.slice(0, -1)
		.flatMap((x) => {
			const out: [number, number][][] = [];
			if (x > 0)
				out.push([
					[x, 0],
					[x, 5]
				]);
			if (x < 20)
				out.push([
					[x, 0],
					[x + 5, 5]
				]);
			else
				out.push([
					[x, 5],
					[x + 5, 0]
				]);
			return out;
		})
		.filter(
			([p, q]) =>
				!(q[1] === 5 && (q[0] === 0 || q[0] === 40)) && !(p[1] === 5 && (p[0] === 0 || p[0] === 40))
		)
]);

/** A deck arch: an arch springing from the faces of the gap, holding up the road on posts. */
/** The arch: a parabola from the gap's faces 10 m below the road up to 2.5 m below it. */
const archY = (x: number) => -10 + 7.5 * (1 - ((x - 20) / 20) ** 2);
export const ARCH = build([
	...DECK,
	...chain(...[0, 5, 10, 15, 20, 25, 30, 35, 40].map((x) => [x, archY(x)] as [number, number])),
	...[5, 10, 15, 20, 25, 30, 35].map(
		(x) =>
			[
				[x, archY(x)],
				[x, 0]
			] as [number, number][]
	)
]);

/** A suspension bridge: towers on the banks, a main cable over them, hangers holding the road. */
/** The main cable: a parabola from the tower tops (15 m) down to 2.5 m above the road. */
const cableY = (x: number) => 2.5 + 12.5 * ((x - 20) / 20) ** 2;
export const SUSPENSION = build(
	[
		...DECK,
		[
			[0, 0],
			[0, 15]
		],
		[
			[40, 0],
			[40, 15]
		]
	],
	[
		[
			[-12.5, 0],
			[0, 15]
		],
		[
			[40, 15],
			[52.5, 0]
		],
		...chain(...[0, 5, 10, 15, 20, 25, 30, 35, 40].map((x) => [x, cableY(x)] as [number, number])),
		...[5, 10, 15, 20, 25, 30, 35].map(
			(x) =>
				[
					[x, cableY(x)],
					[x, 0]
				] as [number, number][]
		)
	]
);

export const DESIGNS: Record<string, Structure> = {
	beam: BEAM,
	truss: TRUSS,
	arch: ARCH,
	suspension: SUSPENSION
};

/** Where the reader's own bridge starts: just the road, which cannot carry the truck alone. */
export const STARTER = BEAM;

// ------------------------------------------------------------ one post (the first chapter)

/**
 * A standard steel scaffolding tube, 48.3 mm across with 3.2 mm walls: the
 * post in the first chapter. Pulled, it fails when the steel yields; pushed,
 * it buckles first unless it is short.
 */
export const TUBE = {
	diameter: 0.0483,
	wall: 0.0032,
	get area() {
		const ro = this.diameter / 2;
		const ri = ro - this.wall;
		return Math.PI * (ro * ro - ri * ri);
	},
	get I() {
		const ro = this.diameter / 2;
		const ri = ro - this.wall;
		return (Math.PI / 4) * (ro ** 4 - ri ** 4);
	}
};

/** Load (N) at which the tube yields, pulled or pushed. */
export const yieldLoad = () => TUBE.area * YIELD;

/** Euler buckling load (N) of the tube as a post of length L (m) with pinned ends. */
export const bucklingLoad = (L: number) => (Math.PI ** 2 * E * TUBE.I) / (L * L);

/** The largest push (N) a post of length L can take: the smaller of yielding and buckling. */
export const pushLimit = (L: number) => Math.min(yieldLoad(), bucklingLoad(L));
