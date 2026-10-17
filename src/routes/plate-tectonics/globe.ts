/**
 * The world map of the plate-tectonics explainer: real plate boundaries (Bird 2003, PB2002),
 * earthquakes (USGS ComCat, M ≥ 5.5, 2015–2024) and Holocene volcanoes (Smithsonian GVP), on an
 * equirectangular map, plus the statistics the page quotes. See `data/*.ts` for the sources and
 * `scripts/data/plate-tectonics/build.mjs` for how the subsets were made.
 */
import { BOUNDARIES, LAND, PLATES, type Boundary, type BoundaryClass } from './data/world';
import { QUAKES } from './data/quakes';
import { VOLCANOES, NAMED_VOLCANOES } from './data/volcanoes';

export { PLATES, NAMED_VOLCANOES };

export const EARTH_RADIUS = 6371;
const KM_PER_DEG = (Math.PI / 180) * EARTH_RADIUS;

interface Quake {
	lon: number;
	lat: number;
	depth: number;
	mag: number;
	/** Days since 1 January 2015. */
	day: number;
}
export type Setting = 'subduction' | 'rift' | 'intraplate' | 'unknown';
interface Volcano {
	lon: number;
	lat: number;
	setting: Setting;
}
type Group = 'divergent' | 'transform' | 'subduction' | 'convergent';
interface Line {
	name: string;
	cls: BoundaryClass;
	group: Group;
	/** +1 / −1: the overriding plate is on the left / right of the line's direction (subduction). */
	side: number;
	km: number;
	/** Mean relative speed, mm/yr, and its divergent component (negative: converging). */
	speed: number;
	divergent: number;
	/** [lon, lat] points. */
	pts: [number, number][];
}

const SETTINGS: Setting[] = ['subduction', 'rift', 'intraplate', 'unknown'];
const GROUP_OF: Record<BoundaryClass, Group> = {
	OSR: 'divergent',
	CRB: 'divergent',
	OTF: 'transform',
	CTF: 'transform',
	SUB: 'subduction',
	OCB: 'convergent',
	CCB: 'convergent'
};

const pairs = (flat: number[]): [number, number][] => {
	const out: [number, number][] = [];
	for (let i = 0; i < flat.length; i += 2) out.push([flat[i] / 10, flat[i + 1] / 10]);
	return out;
};

export const quakes: Quake[] = [];
for (let i = 0; i < QUAKES.length; i += 5)
	quakes.push({
		lon: QUAKES[i] / 10,
		lat: QUAKES[i + 1] / 10,
		depth: QUAKES[i + 2],
		mag: QUAKES[i + 3] / 10,
		day: QUAKES[i + 4]
	});

export const volcanoes: Volcano[] = [];
for (let i = 0; i < VOLCANOES.length; i += 3)
	volcanoes.push({
		lon: VOLCANOES[i] / 10,
		lat: VOLCANOES[i + 1] / 10,
		setting: SETTINGS[VOLCANOES[i + 2]]
	});

const lines: Line[] = BOUNDARIES.map(([name, cls, side, km, speed, divergent, p]: Boundary) => ({
	name,
	cls,
	group: GROUP_OF[cls],
	side,
	km,
	speed,
	divergent,
	pts: pairs(p)
}));

export const land: [number, number][][] = LAND.map(pairs);

/** Days covered by the earthquake catalogue (2015–2024). */
export const CATALOGUE_DAYS = Math.round((Date.UTC(2025, 0, 1) - Date.UTC(2015, 0, 1)) / 86400000);

/** Depth classes used by seismologists: shallow < 70 km, intermediate 70–300 km, deep > 300 km. */
export type DepthClass = 'shallow' | 'intermediate' | 'deep';
export const depthClass = (depth: number): DepthClass =>
	depth < 70 ? 'shallow' : depth <= 300 ? 'intermediate' : 'deep';

// ------------------------------------------------------------------ distances

interface Seg {
	ax: number;
	ay: number;
	bx: number;
	by: number;
	minLat: number;
	maxLat: number;
	group: Group;
}
const segs: Seg[] = [];
for (const l of lines)
	for (let i = 1; i < l.pts.length; i++) {
		const [ax, ay] = l.pts[i - 1];
		const [bx, by] = l.pts[i];
		segs.push({
			ax,
			ay,
			bx,
			by,
			minLat: Math.min(ay, by),
			maxLat: Math.max(ay, by),
			group: l.group
		});
	}

const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/**
 * Distance in km from (lon, lat) to the nearest plate boundary (of the given groups), in a local
 * flat approximation around the point (good to a few per cent within a few hundred km).
 */
export function distanceToBoundary(lon: number, lat: number, groups?: Group[]): number {
	const k = Math.cos((lat * Math.PI) / 180);
	let best = Infinity;
	for (const s of segs) {
		if (groups && !groups.includes(s.group)) continue;
		const dLat = Math.max(0, s.minLat - lat, lat - s.maxLat) * KM_PER_DEG;
		if (dLat >= best) continue;
		const ax = wrap(s.ax - lon) * k * KM_PER_DEG;
		const ay = (s.ay - lat) * KM_PER_DEG;
		let bx = wrap(s.bx - lon) * k * KM_PER_DEG;
		const by = (s.by - lat) * KM_PER_DEG;
		if (Math.abs(bx - ax) > 180 * KM_PER_DEG * k) bx = ax; // a segment touching the seam
		const dx = bx - ax;
		const dy = by - ay;
		const len2 = dx * dx + dy * dy;
		const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
		const d = Math.hypot(ax + u * dx, ay + u * dy);
		if (d < best) best = d;
	}
	return best;
}

/** Fraction of `points` within `km` of a plate boundary. */
export function fractionNear(points: { lon: number; lat: number }[], km: number, groups?: Group[]) {
	let n = 0;
	for (const p of points) if (distanceToBoundary(p.lon, p.lat, groups) <= km) n++;
	return n / points.length;
}

/** Fraction of the Earth's surface within `km` of a plate boundary (a Fibonacci-sphere sample). */
export function areaFractionNear(km: number, samples = 6000) {
	const golden = Math.PI * (3 - Math.sqrt(5));
	let n = 0;
	for (let i = 0; i < samples; i++) {
		const z = 1 - (2 * (i + 0.5)) / samples;
		const lat = (Math.asin(z) * 180) / Math.PI;
		const lon = wrap(((i * golden) % (2 * Math.PI)) * (180 / Math.PI));
		if (distanceToBoundary(lon, lat) <= km) n++;
	}
	return n / samples;
}

// ------------------------------------------------------------------ map projection

/** The map on the stage: equirectangular, 928 px for 360°, latitudes 84° N to 70° S. */
export const MAP = { x: 16, y: 74, w: 928, north: 84, south: -70 } as const;
export const PX_PER_DEG = MAP.w / 360;
export const MAP_H = (MAP.north - MAP.south) * PX_PER_DEG;

/** Map x (before panning, for longitude −180…180) and y of a point. */
export const mapX = (lon: number) => MAP.x + (lon + 180) * PX_PER_DEG;
export const mapY = (lat: number) => MAP.y + (MAP.north - lat) * PX_PER_DEG;

const f1 = (v: number) => v.toFixed(1);

/** SVG path of polylines in map coordinates. */
export function linesPath(ls: [number, number][][]): string {
	let d = '';
	for (const pts of ls)
		pts.forEach(([lon, lat], i) => (d += `${i ? 'L' : 'M'}${f1(mapX(lon))} ${f1(mapY(lat))}`));
	return d;
}

/** SVG path of closed polygons. */
export const polygonsPath = (ps: [number, number][][]) =>
	ps.map((p) => linesPath([p]) + 'Z').join('');

/** SVG path of zero-length segments: with round caps, a dot at each point. */
export const dotsPath = (pts: { lon: number; lat: number }[]) =>
	pts.map((p) => `M${f1(mapX(p.lon))} ${f1(mapY(p.lat))}h0`).join('');

/** SVG path of small upward triangles. */
export const trianglesPath = (pts: { lon: number; lat: number }[], r: number) =>
	pts
		.map((p) => {
			const x = mapX(p.lon);
			const y = mapY(p.lat);
			return `M${f1(x)} ${f1(y - r)}L${f1(x + r * 0.9)} ${f1(y + r * 0.6)}L${f1(x - r * 0.9)} ${f1(y + r * 0.6)}Z`;
		})
		.join('');

/**
 * Teeth on the overriding side of subduction lines, as a path of small triangles, one every
 * `spacing` px.
 */
export function teethPath(spacing = 9, size = 3.2): string {
	let d = '';
	for (const l of lines) {
		if (l.group !== 'subduction' || !l.side) continue;
		let carry = spacing / 2;
		for (let i = 1; i < l.pts.length; i++) {
			const ax = mapX(l.pts[i - 1][0]);
			const ay = mapY(l.pts[i - 1][1]);
			const bx = mapX(l.pts[i][0]);
			const by = mapY(l.pts[i][1]);
			const len = Math.hypot(bx - ax, by - ay);
			if (len === 0 || len > 200) continue;
			const ux = (bx - ax) / len;
			const uy = (by - ay) / len;
			// left of the direction of travel on the globe (north up, east right) is (uy, −ux)
			// in screen coordinates (y down)
			const nx = uy * l.side;
			const ny = -ux * l.side;
			for (let s = carry; s < len; s += spacing) {
				const x = ax + ux * s;
				const y = ay + uy * s;
				d += `M${f1(x - ux * size * 0.8)} ${f1(y - uy * size * 0.8)}L${f1(x + nx * size * 1.3)} ${f1(y + ny * size * 1.3)}L${f1(x + ux * size * 0.8)} ${f1(y + uy * size * 0.8)}Z`;
				carry = s + spacing - len;
			}
			if (carry > len) carry -= len;
		}
	}
	return d;
}

/** Boundary polylines of one group. */
export const groupLines = (g: Group) => lines.filter((l) => l.group === g).map((l) => l.pts);

/** Length-weighted mean of a boundary property over lines matching `match`. */
export function meanAlong(match: (l: Line) => boolean, value: (l: Line) => number) {
	let s = 0;
	let w = 0;
	for (const l of lines)
		if (match(l)) {
			s += value(l) * l.km;
			w += l.km;
		}
	return s / w;
}

/** Share of the volcanoes in each tectonic setting. */
export function settingShares() {
	const n: Record<Setting, number> = { subduction: 0, rift: 0, intraplate: 0, unknown: 0 };
	for (const v of volcanoes) n[v.setting]++;
	const total = volcanoes.length;
	return {
		subduction: n.subduction / total,
		rift: n.rift / total,
		intraplate: n.intraplate / total,
		unknown: n.unknown / total,
		total
	};
}

/**
 * Figures the page quotes, too slow to compute in the browser (a distance from every point to
 * every boundary segment); `e2e/plate-tectonics-model.e2e.ts` recomputes them from the data.
 */
export const QUOTED = {
	/** Share of the earthquakes within 200 km of a plate boundary. */
	quakesWithin200km: 0.86,
	/** Share of the Earth's surface within 200 km of a plate boundary. */
	areaWithin200km: 0.17,
	/** Share of the volcanoes within 300 km of a plate boundary. */
	volcanoesWithin300km: 0.79
} as const;

/** Earthquakes per depth class. */
export const depthCounts = (() => {
	const n: Record<DepthClass, number> = { shallow: 0, intermediate: 0, deep: 0 };
	for (const q of quakes) n[depthClass(q.depth)]++;
	return n;
})();
