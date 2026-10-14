/**
 * The cross-section model of the plate-tectonics explainer: two plates, each carrying oceanic or
 * continental crust, moved apart, together or past each other by a given distance. Plain
 * TypeScript, no Svelte, so it can be tested in Node (`e2e/plate-tectonics-model.e2e.ts`).
 *
 * It is a kinematic model with real physics where geologists use simple physics:
 * - Isostasy (Airy): crust floats on the denser mantle, so thicker crust stands higher and has a
 *   deeper root. A 35 km continental crust stands 0.5 km above sea level; doubling it to 70 km
 *   (a collision) raises it by 35 × (1 − 2.8/3.3) ≈ 5.3 km.
 * - Ocean depth from the age of the sea floor (cooling plate): GDH1, Stein & Stein (1992),
 *   Nature 359, 123: d = 2600 + 365 √t m for t < 20 Myr, 5651 − 2473 e^(−0.0278 t) m after.
 * - Thickness of oceanic lithosphere from half-space cooling: 2.32 √(κ t), κ = 10⁻⁶ m²/s
 *   (Turcotte & Schubert, Geodynamics, eq. 4.93), capped at 125 km (the plate model's thickness).
 * - Continental rifting by uniform stretching (McKenzie 1978, EPSL 40, 25): a rift stretched by a
 *   factor β thins its crust and lithosphere to 1/β and subsides by the "initial subsidence"
 *   S = a[(ρm − ρc)(tc/a)(1 − αTm tc/2a) − αTm ρm/2](1 − 1/β) / [ρm(1 − αTm) − ρw].
 * - The bending of the sinking plate at a trench as an elastic plate (Turcotte & Schubert §3.17):
 *   w(x) = w₀ e^(−x/α) cos(x/α), which also makes the low "outer rise" seaward of the trench.
 * - Arc volcanoes sit where the top of the sinking plate is about 100 km deep (Syracuse & Abers
 *   2006, G³ 7, Q05017: 105 ± 19 km on average): there water released by the slab lowers the
 *   melting point of the mantle above it.
 *
 * Simplifications (stated on the page): the shapes of slabs, the width of mountain belts and the
 * sizes of volcanoes are schematic; the sea floor of an existing ocean plate is given one age; a
 * continent arriving at a trench is not modelled (the ocean plate is endless); erosion, sediments
 * and the later cooling of rifted margins are left out.
 *
 * Units: distances in km, x measured across the boundary (negative: the left plate), z upwards
 * from sea level; ages and times in millions of years (Myr); speeds in cm/yr (1 cm/yr = 10 km/Myr).
 */

export type Crust = 'ocean' | 'continent';

/** Densities, g/cm³. */
export const RHO = { mantle: 3.3, continent: 2.8, ocean: 2.9, water: 1.03 } as const;
/** Thickness of normal continental and oceanic crust, km. */
export const CONTINENT_CRUST = 35;
export const OCEAN_CRUST = 7;
/** Height above sea level of a continent with normal crust, km. */
export const CONTINENT_ELEVATION = 0.5;
/** Thickness of continental lithosphere, km. */
export const CONTINENT_LITHOSPHERE = 150;
/** Age of the sea floor of an existing ocean plate at the start, Myr (left older than right). */
export const OCEAN_AGE = { left: 60, right: 30 } as const;
/** Half-width of the section, km. */
export const HALF_WIDTH = 900;
/** Width of the zone that starts to stretch in a continental rift, km. */
export const RIFT_WIDTH = 80;
/** Stretching factor at which continental crust breaks and new ocean floor starts to form. */
export const BREAKUP_BETA = 4;
/** Depth of the top of the sinking plate beneath arc volcanoes, km. */
export const ARC_SLAB_DEPTH = 100;
/** Depth of the deepest earthquakes, where slabs reach the bottom of the upper mantle, km. */
export const DEEPEST_QUAKES = 700;

const KAPPA = 1e-6; // m²/s
const MYR = 3.15576e13; // s

/** Depth of the sea floor below sea level, km, for sea floor `age` Myr old (GDH1). */
export function oceanDepth(age: number): number {
	const t = Math.max(0, age);
	return (t < 20 ? 2600 + 365 * Math.sqrt(t) : 5651 - 2473 * Math.exp(-0.0278 * t)) / 1000;
}

/** Thickness of oceanic lithosphere, km, at `age` Myr: half-space cooling, capped at 125 km. */
export function lithosphereThickness(age: number): number {
	const t = Math.max(0, age) * MYR;
	return Math.min(125, (2.32 * Math.sqrt(KAPPA * t)) / 1000);
}

/** Height above sea level, km, of continental crust `h` km thick (Airy isostasy). */
export function airyElevation(h: number): number {
	return CONTINENT_ELEVATION + (h - CONTINENT_CRUST) * (1 - RHO.continent / RHO.mantle);
}

// McKenzie (1978) with a 125 km lithosphere, 35 km crust, α = 3.28e-5 /K, Tm = 1333 °C.
const MCK = { a: 125, tc: CONTINENT_CRUST, rhoM: 3.33, rhoC: 2.8, alpha: 3.28e-5, Tm: 1333 };
const ALPHA_TM = MCK.alpha * MCK.Tm;
const RHO_HOT = MCK.rhoM * (1 - ALPHA_TM);

/** McKenzie's initial (water-filled) subsidence of a basin stretched by `beta`, km. */
export function mckenzieSubsidence(beta: number): number {
	const { a, tc, rhoM, rhoC } = MCK;
	const top =
		a * ((rhoM - rhoC) * (tc / a) * (1 - (ALPHA_TM * tc) / (2 * a)) - (ALPHA_TM * rhoM) / 2);
	return (top * (1 - 1 / beta)) / (RHO_HOT - RHO.water);
}

/**
 * Elevation of the floor of a rift stretched by `beta`, km: the subsidence is filled with air
 * while the floor is above sea level and with sea water below it (isostasy is linear in the load).
 */
export function riftFloorElevation(beta: number): number {
	const airFactor = (RHO_HOT - RHO.water) / RHO_HOT;
	const dropInAir = mckenzieSubsidence(beta) * airFactor;
	if (dropInAir <= CONTINENT_ELEVATION) return CONTINENT_ELEVATION - dropInAir;
	return -(dropInAir - CONTINENT_ELEVATION) / airFactor;
}

export interface P {
	x: number;
	z: number;
}

export type Kind =
	'rest' | 'ridge' | 'rift' | 'young-ocean' | 'subduction' | 'collision' | 'transform';

export type CrustKind = 'continent' | 'ocean' | 'new-ocean' | 'stretched';

/** One column of the section. */
export interface Column {
	x: number;
	/** Surface (sea floor or land) elevation, km. */
	z: number;
	/** Base of the crust (Moho), km. */
	moho: number;
	/** Base of the lithosphere, km. */
	litho: number;
	crust: CrustKind;
	/** Age of oceanic crust, Myr (NaN for continental crust). */
	age: number;
	/** Which plate the column belongs to. */
	plate: 'left' | 'right';
}

export interface Volcano {
	x: number;
	/** Height of its summit, km. */
	top: number;
	/** Height of the ground around it, km. */
	base: number;
	kind: 'arc' | 'ridge' | 'rift';
}

export interface Quake {
	x: number;
	z: number;
}

export interface Slab {
	/** Top surface of the sinking plate, from the trench down, and its base. */
	top: P[];
	base: P[];
	/** Base of its crust. */
	crustBase: P[];
	/** Which side sinks. */
	side: 'left' | 'right';
	/** Length of plate that has gone down, km. */
	length: number;
}

export interface Feature {
	id: 'ridge' | 'rift' | 'trench' | 'arc' | 'mountains' | 'transform' | 'margin';
	x: number;
	z: number;
	/** e.g. depth of a trench (km below sea level) or height of mountains (km). */
	value: number;
}

export interface SectionInput {
	left: Crust;
	right: Crust;
	/** Distance moved across the boundary, km: positive apart, negative together. */
	normal: number;
	/** Distance moved along the boundary (sideways), km. */
	slide: number;
	/** Relative speed of the plates, cm/yr. */
	speed: number;
	/** Continental crust thickness of the plates at rest (layers step), km. */
	crustThickness?: number;
}

export interface Section {
	kind: Kind;
	columns: Column[];
	slab: Slab | null;
	volcanoes: Volcano[];
	quakes: Quake[];
	features: Feature[];
	/** Time the movement took at `speed`, Myr. */
	myr: number;
	/** How far each plate's surface has moved along x (for markers), km. */
	shift: { left: number; right: number };
	/** Stretching factor of a continental rift (1 if none). */
	beta: number;
	/** Width of new ocean floor made since the start, km. */
	newOcean: number;
}

const STEP = 5;

/** Time the plates take to move `km` at `speed` cm/yr, Myr. */
export const myrFor = (km: number, speed: number) => Math.abs(km) / (speed * 10);

const smooth01 = (u: number) => {
	const v = Math.min(1, Math.max(0, u));
	return v * v * (3 - 2 * v);
};

/** A deterministic pseudo-random number in [0, 1). */
function rand(i: number, salt: number) {
	let x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	x -= Math.floor(x);
	return x;
}

function restColumn(x: number, crust: Crust, age: number, h: number, plate: 'left' | 'right') {
	if (crust === 'continent') {
		const z = airyElevation(h);
		return { x, z, moho: z - h, litho: -CONTINENT_LITHOSPHERE, crust, age: NaN, plate } as Column;
	}
	const z = -oceanDepth(age);
	return {
		x,
		z,
		moho: z - OCEAN_CRUST,
		litho: z - lithosphereThickness(age),
		crust,
		age,
		plate
	} as Column;
}

/** A column of oceanic crust made at a ridge `age` Myr ago. */
function newOceanColumn(x: number, age: number, slowRidge: boolean): Column {
	let z = -oceanDepth(age);
	// Slow ridges (< ~5 cm/yr) have a rift valley along their crest, fast ones a smooth rise
	// (Macdonald 1982); drawn as a 1 km deep, ~20 km wide notch.
	if (slowRidge) z -= 1 * Math.exp(-((x / 10) ** 2));
	return {
		x,
		z,
		moho: z - OCEAN_CRUST,
		litho: z - Math.max(OCEAN_CRUST + 1, lithosphereThickness(age)),
		crust: 'new-ocean',
		age,
		plate: x < 0 ? 'left' : 'right'
	};
}

function xs(): number[] {
	const out: number[] = [];
	for (let x = -HALF_WIDTH; x <= HALF_WIDTH + 1e-9; x += STEP) out.push(x);
	return out;
}

/** Top surface of a slab: from the trench at (0, z0) going down under positive x. */
function slabTop(length: number, z0: number): P[] {
	const pts: P[] = [{ x: 0, z: z0 }];
	let x = 0;
	let z = z0;
	const ds = 5;
	for (let s = ds; s <= length + 1e-9; s += ds) {
		// Dip steepens from 10° at the trench to 50° once the slab is ~250 km long.
		const dip = ((10 + 40 * smooth01((s - 20) / 250)) * Math.PI) / 180;
		x += ds * Math.cos(dip);
		z -= ds * Math.sin(dip);
		pts.push({ x, z });
		if (z < -DEEPEST_QUAKES) break;
	}
	return pts;
}

/** Points offset from a polyline by `d` km to its lower side. */
function offsetBelow(line: P[], d: number): P[] {
	return line.map((p, i) => {
		const a = line[Math.max(0, i - 1)];
		const b = line[Math.min(line.length - 1, i + 1)];
		const dx = b.x - a.x;
		const dz = b.z - a.z;
		const len = Math.hypot(dx, dz) || 1;
		// normal pointing down-and-back: (dz, -dx) rotated so that z decreases
		return { x: p.x + (dz / len) * d, z: p.z - (dx / len) * d };
	});
}

/** z of a polyline (monotonic in x) at x, or null outside it. */
function zAt(line: P[], x: number): number | null {
	for (let i = 1; i < line.length; i++) {
		const a = line[i - 1];
		const b = line[i];
		if ((x >= a.x && x <= b.x) || (x <= a.x && x >= b.x)) {
			const u = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
			return a.z + u * (b.z - a.z);
		}
	}
	return null;
}

const mirror = (s: Section): Section => ({
	...s,
	columns: s.columns
		.map((c) => ({
			...c,
			x: -c.x,
			plate: (c.plate === 'left' ? 'right' : 'left')
		}))
		.reverse(),
	slab: s.slab && {
		...s.slab,
		side: s.slab.side === 'left' ? 'right' : 'left',
		top: s.slab.top.map((p) => ({ x: -p.x, z: p.z })),
		base: s.slab.base.map((p) => ({ x: -p.x, z: p.z })),
		crustBase: s.slab.crustBase.map((p) => ({ x: -p.x, z: p.z }))
	},
	volcanoes: s.volcanoes.map((v) => ({ ...v, x: -v.x })),
	quakes: s.quakes.map((q) => ({ ...q, x: -q.x })),
	features: s.features.map((f) => ({ ...f, x: -f.x })),
	shift: { left: -s.shift.right, right: -s.shift.left }
});

/** Adds a volcanic cone to the columns. */
function addCone(cols: Column[], x: number, relief: number, halfWidth: number) {
	for (const c of cols) {
		const u = 1 - Math.abs(c.x - x) / halfWidth;
		if (u > 0) c.z += relief * u ** 1.6;
	}
}

function base(myr: number): Omit<Section, 'kind' | 'columns'> {
	return {
		slab: null,
		volcanoes: [],
		quakes: [],
		features: [],
		myr,
		shift: { left: 0, right: 0 },
		beta: 1,
		newOcean: 0
	};
}

/** Plates at rest side by side (also the transform case). */
function rest(input: SectionInput, myr: number): Section {
	const h = input.crustThickness ?? CONTINENT_CRUST;
	const columns = xs().map((x) =>
		x < 0
			? restColumn(x, input.left, OCEAN_AGE.left + myr, h, 'left')
			: restColumn(x, input.right, OCEAN_AGE.right + myr, h, 'right')
	);
	// Soften the step between two different plates over ~60 km (a continental margin).
	if (input.left !== input.right) blendAcross(columns, 0, 60);
	return { kind: 'rest', columns, ...base(myr) };
}

function blendAcross(cols: Column[], x0: number, w: number) {
	const i0 = cols.findIndex((c) => c.x >= x0);
	if (i0 < 1) return;
	const L = cols[Math.max(0, i0 - Math.round(w / STEP))];
	const R = cols[Math.min(cols.length - 1, i0 + Math.round(w / STEP))];
	for (const c of cols) {
		const u = (c.x - (x0 - w)) / (2 * w);
		if (u <= 0 || u >= 1) continue;
		const s = smooth01(u);
		c.z = L.z + (R.z - L.z) * s;
		c.moho = L.moho + (R.moho - L.moho) * s;
		c.litho = L.litho + (R.litho - L.litho) * s;
	}
}

function diverge(input: SectionInput, open: number, myr: number): Section {
	const { left, right, speed } = input;
	const half = speed * 5; // half-spreading rate, km/Myr
	const slow = speed < 5;
	if (left === 'continent' && right === 'continent') {
		const breakAt = RIFT_WIDTH * (BREAKUP_BETA - 1);
		if (open < breakAt) return rift(input, open, myr);
		// After break-up: two stretched margins drift apart, new ocean floor between them.
		const ocean = open - breakAt;
		const marginW = (RIFT_WIDTH * BREAKUP_BETA) / 2;
		const thin = CONTINENT_CRUST / BREAKUP_BETA;
		const floor = riftFloorElevation(BREAKUP_BETA);
		const tMyr = myrFor(ocean, speed);
		const columns = xs().map((x): Column => {
			const ax = Math.abs(x);
			const plate = x < 0 ? 'left' : 'right';
			if (ax < ocean / 2) return newOceanColumn(x, ax / half, slow);
			const m = ax - ocean / 2;
			if (m < marginW) {
				// stretched margin, tapering to the normal continent over its landward 40 km
				const u = smooth01((m - (marginW - 40)) / 40);
				const h = thin + (CONTINENT_CRUST - thin) * u;
				const z = floor + (CONTINENT_ELEVATION - floor) * u;
				const litho = -(MCK.a / BREAKUP_BETA) + (-CONTINENT_LITHOSPHERE + MCK.a / BREAKUP_BETA) * u;
				return { x, z, moho: z - h, litho, crust: 'stretched', age: NaN, plate };
			}
			return restColumn(x, 'continent', 0, CONTINENT_CRUST, plate);
		});
		// The old sea floor at the edges of the new ocean meets the margins smoothly.
		smoothEdges(columns, ocean / 2, 15);
		const volcanoes: Volcano[] = [
			{ x: 0, top: columns[mid(columns)].z + 0.6, base: columns[mid(columns)].z, kind: 'ridge' }
		];
		return {
			kind: 'young-ocean',
			columns,
			...base(myr),
			volcanoes,
			quakes: ridgeQuakes(),
			features: [
				{ id: 'ridge', x: 0, z: columns[mid(columns)].z, value: -columns[mid(columns)].z },
				{ id: 'margin', x: ocean / 2 + marginW / 2, z: floor, value: tMyr }
			],
			shift: { left: -open / 2, right: open / 2 },
			beta: BREAKUP_BETA,
			newOcean: ocean
		};
	}
	// A ridge between two ocean plates (steady state: all their sea floor came from it), or new
	// ocean floor between an ocean plate and a continent.
	const columns = xs().map((x): Column => {
		const ax = Math.abs(x);
		const side = x < 0 ? left : right;
		if (left === 'ocean' && right === 'ocean') return newOceanColumn(x, ax / half, slow);
		if (ax < open / 2) return newOceanColumn(x, ax / half, slow);
		const plate = x < 0 ? 'left' : 'right';
		return restColumn(
			x,
			side,
			(x < 0 ? OCEAN_AGE.left : OCEAN_AGE.right) + myr,
			CONTINENT_CRUST,
			plate
		);
	});
	if (!(left === 'ocean' && right === 'ocean')) smoothEdges(columns, open / 2, 30);
	const c0 = columns[mid(columns)];
	return {
		kind: 'ridge',
		columns,
		...base(myr),
		volcanoes: open > 1 ? [{ x: 0, top: c0.z + 0.6, base: c0.z, kind: 'ridge' }] : [],
		quakes: ridgeQuakes(),
		features: [{ id: 'ridge', x: 0, z: c0.z, value: -c0.z }],
		shift: { left: -open / 2, right: open / 2 },
		newOcean: open
	};
}

const mid = (cols: Column[]) => Math.floor(cols.length / 2);

function smoothEdges(cols: Column[], edge: number, w: number) {
	for (const sgn of [-1, 1]) blendAcross(cols, sgn * edge, w);
}

function ridgeQuakes(): Quake[] {
	return Array.from({ length: 10 }, (_, i) => ({
		x: (rand(i, 1) - 0.5) * 40,
		z: -3 - rand(i, 2) * 8
	}));
}

function rift(input: SectionInput, open: number, myr: number): Section {
	const beta = (RIFT_WIDTH + open) / RIFT_WIDTH;
	const w = (RIFT_WIDTH + open) / 2;
	const thin = CONTINENT_CRUST / beta;
	const floor = riftFloorElevation(beta);
	const columns = xs().map((x): Column => {
		const ax = Math.abs(x);
		const plate = x < 0 ? 'left' : 'right';
		const u = smooth01((ax - (w - 20)) / 40); // 0 in the rift, 1 outside
		if (u >= 1) return restColumn(x, 'continent', 0, CONTINENT_CRUST, plate);
		const h = thin + (CONTINENT_CRUST - thin) * u;
		const z = floor + (CONTINENT_ELEVATION - floor) * u;
		const litho = -(CONTINENT_LITHOSPHERE / beta) * (1 - u) - CONTINENT_LITHOSPHERE * u;
		return { x, z, moho: z - h, litho, crust: 'stretched', age: NaN, plate };
	});
	const volcanoes: Volcano[] =
		beta > 1.5
			? [-0.45, 0.3].map((f) => {
					const x = f * w;
					const c = columns[Math.round((x + HALF_WIDTH) / STEP)];
					return {
						x,
						base: c.z,
						top: c.z + 1.5 * smooth01((beta - 1.5) / 1),
						kind: 'rift' as const
					};
				})
			: [];
	for (const v of volcanoes) addCone(columns, v.x, v.top - v.base, 18);
	const quakes: Quake[] = Array.from({ length: 12 }, (_, i) => ({
		x: (rand(i, 3) - 0.5) * 2 * w,
		z: floor - 2 - rand(i, 4) * Math.max(4, thin - 4)
	}));
	return {
		kind: 'rift',
		columns,
		...base(myr),
		volcanoes,
		quakes,
		features: [{ id: 'rift', x: 0, z: floor, value: floor }],
		shift: { left: -open / 2, right: open / 2 },
		beta
	};
}

function subduct(input: SectionInput, close: number, myr: number): Section {
	// Work with the sinking plate on the left; mirror at the end if it is the right one.
	const sinksLeft =
		input.left === 'ocean' && (input.right === 'continent' || OCEAN_AGE.left >= OCEAN_AGE.right);
	const over: Crust = sinksLeft ? input.right : input.left;
	const subAge = (sinksLeft ? OCEAN_AGE.left : OCEAN_AGE.right) + myr;
	const overAge = (sinksLeft ? OCEAN_AGE.right : OCEAN_AGE.left) + myr;
	const g = smooth01(close / 150); // the trench deepens as subduction gets going
	const floor = -oceanDepth(subAge);
	const w0 = 3 * g; // trench deflection, km
	const alpha = 60; // flexural parameter, km
	const zTrench = floor - w0;
	const slabLen = close;
	const top = slabTop(slabLen, zTrench);
	const L = lithosphereThickness(subAge);
	const slabBase = offsetBelow(top, L);
	const slabCrust = offsetBelow(top, OCEAN_CRUST);
	const overRest = restColumn(1, over, overAge, CONTINENT_CRUST, 'right');
	const columns = xs().map((x): Column => {
		if (x < 0) {
			const z = floor - w0 * Math.exp(x / alpha) * Math.cos(x / alpha);
			return {
				x,
				z,
				moho: z - OCEAN_CRUST,
				litho: z - L,
				crust: 'ocean',
				age: subAge,
				plate: 'left'
			};
		}
		// forearc: from the trench up to the overriding plate over ~120 km
		const u = smooth01(x / 120);
		const z = overRest.z + (zTrench - overRest.z) * (1 - u) * g;
		const h = over === 'continent' ? CONTINENT_CRUST : OCEAN_CRUST;
		const st = zAt(top, x);
		let moho = z - h * (0.3 + 0.7 * u);
		let litho = overRest.litho;
		if (st !== null) {
			moho = Math.max(moho, st);
			litho = Math.max(litho, st);
		}
		return {
			x,
			z,
			moho,
			litho,
			crust: over,
			age: over === 'ocean' ? overAge : NaN,
			plate: 'right'
		};
	});
	const volcanoes: Volcano[] = [];
	const features: Feature[] = [{ id: 'trench', x: 0, z: zTrench, value: -zTrench }];
	const deep = top.findIndex((p) => p.z <= -ARC_SLAB_DEPTH);
	if (deep > 0) {
		const xArc = top[deep].x;
		// length of plate needed to reach 100 km, then the arc builds over the next 250 km
		const onset = deep * 5;
		const grow = smooth01((close - onset) / 250);
		const relief = (over === 'ocean' ? 6 : 3.5) * grow;
		const c = columns[Math.round((xArc + HALF_WIDTH) / STEP)];
		if (grow > 0.02) {
			volcanoes.push({ x: xArc, base: c.z, top: c.z + relief, kind: 'arc' });
			addCone(columns, xArc, relief, over === 'ocean' ? 45 : 35);
			features.push({ id: 'arc', x: xArc, z: c.z + relief, value: xArc });
		}
	}
	const quakes: Quake[] = [];
	const n = 34;
	for (let i = 0; i < n; i++) {
		// along the top of the slab, more of them near the surface, down to the slab's end
		const u = rand(i, 5) ** 1.6;
		const p = top[Math.min(top.length - 1, Math.floor(u * top.length))];
		if (!p) continue;
		const inside = 4 + rand(i, 6) * 18;
		quakes.push({ x: p.x + inside * 0.3, z: p.z - inside });
	}
	for (let i = 0; i < 5; i++) {
		const x = 20 + rand(i, 7) * 200;
		const c = columns[Math.round((x + HALF_WIDTH) / STEP)];
		quakes.push({ x, z: c.z - 4 - rand(i, 8) * 20 });
	}
	const s: Section = {
		kind: 'subduction',
		columns,
		...base(myr),
		slab: { top, base: slabBase, crustBase: slabCrust, side: 'left', length: slabLen },
		volcanoes,
		quakes: quakes.filter((q) => q.x <= HALF_WIDTH),
		features,
		shift: { left: close, right: 0 }
	};
	return sinksLeft ? s : mirror(s);
}

/**
 * Two continents pushed together: neither sinks (continental crust is too light), so the crust
 * shortens and thickens. The thickened area equals the shortening × the crust thickness (area is
 * conserved); the crust thickens up to twice its normal thickness (beyond that it spreads
 * sideways under its own weight, making a plateau like Tibet), with 150 km wide tapering flanks.
 */
function collide(input: SectionInput, close: number, myr: number): Section {
	const area = close * CONTINENT_CRUST;
	const maxExtra = CONTINENT_CRUST;
	const taper = 150;
	let extra: number;
	let plateau: number;
	if (area <= maxExtra * taper) {
		extra = area / taper;
		plateau = 0;
	} else {
		extra = maxExtra;
		plateau = area / maxExtra - taper;
	}
	const columns = xs().map((x): Column => {
		const ax = Math.abs(x);
		const u =
			ax <= plateau / 2
				? 1
				: 0.5 * (1 + Math.cos(Math.min(1, (ax - plateau / 2) / taper) * Math.PI));
		const h = CONTINENT_CRUST + extra * u;
		const z = airyElevation(h);
		return {
			x,
			z,
			moho: z - h,
			litho: -CONTINENT_LITHOSPHERE - extra * u * 1.5,
			crust: 'continent',
			age: NaN,
			plate: x < 0 ? 'left' : 'right'
		};
	});
	const peak = Math.max(...columns.map((c) => c.z));
	const half = plateau / 2 + taper * 0.6;
	const quakes: Quake[] = Array.from(
		{ length: Math.round(8 + 14 * smooth01(close / 300)) },
		(_, i) => {
			const x = (rand(i, 9) - 0.5) * 2 * half;
			const c = columns[Math.round((x + HALF_WIDTH) / STEP)];
			return { x, z: c.z - 3 - rand(i, 10) * (c.z - c.moho - 10) };
		}
	);
	return {
		kind: 'collision',
		columns,
		...base(myr),
		quakes,
		features: [{ id: 'mountains', x: 0, z: peak, value: peak }],
		shift: { left: close / 2, right: -close / 2 }
	};
}

/** The section after the plates have moved by `normal` (and `slide`) km. */
export function section(input: SectionInput): Section {
	const { normal, slide, speed } = input;
	const myr = myrFor(Math.hypot(normal, slide), speed);
	let s: Section;
	if (normal > 0.5) s = diverge(input, normal, myr);
	else if (normal < -0.5) {
		s =
			input.left === 'continent' && input.right === 'continent'
				? collide(input, -normal, myr)
				: subduct(input, -normal, myr);
	} else s = rest(input, myr);
	if (Math.abs(slide) > 0.5) {
		// Sliding past each other: shallow earthquakes along the fault, nothing made or destroyed.
		const n = Math.round(6 + 10 * smooth01(Math.abs(slide) / 100));
		const fault = Array.from({ length: n }, (_, i) => {
			const c = s.columns[mid(s.columns)];
			return { x: (rand(i, 11) - 0.5) * 12, z: c.z - 2 - rand(i, 12) * 16 };
		});
		s = {
			...s,
			kind: s.kind === 'rest' ? 'transform' : s.kind,
			quakes: [...s.quakes, ...fault],
			features: [
				...s.features,
				{ id: 'transform', x: 0, z: s.columns[mid(s.columns)].z, value: slide }
			]
		};
	}
	return s;
}

/** The feature of a given id in a section, if it has one. */
export const feature = (s: Section, id: Feature['id']) => s.features.find((f) => f.id === id);
