/**
 * Light & optics: the model behind the explainer.
 *
 * 1. Materials. The refractive index n(λ) of each material comes from a
 *    published Sellmeier fit, n² = 1 + Σ Bᵢ λ² ÷ (λ² − Cᵢ), λ in micrometres
 *    (sources next to each set of coefficients). Air is taken as n = 1
 *    (really 1.0003 at sea level, which moves the angles quoted on the page
 *    by less than 0.1°, except rays leaving just short of the critical
 *    angle, which skim the surface).
 * 2. Light in a material travels at v = c ÷ n; its frequency doesn't change,
 *    so its wavelength inside is λ ÷ n.
 * 3. A 2-D ray tracer. Glass, water and so on are "bodies": intersections of
 *    half-planes and discs (or the outside of a disc), so lens surfaces are
 *    exact circular arcs, not polygons. Mirrors are line segments. At every
 *    boundary a ray obeys Snell's law, n₁ sin θ₁ = n₂ sin θ₂, and the Fresnel
 *    equations (unpolarised light) decide how much is reflected; past the
 *    critical angle it is all reflected (total internal reflection). Partial
 *    reflections become new branches while they carry enough light.
 *
 * Units: lengths are whatever the caller uses (the scenes use stage pixels);
 * angles in the API are degrees unless named `…Rad`.
 */

/** Speed of light in vacuum, m/s (exact, by the definition of the metre). */
export const C = 299_792_458;

// ---------------------------------------------------------------- materials

export type MaterialId = 'air' | 'water' | 'silica' | 'crown' | 'flint' | 'diamond';

interface Material {
	id: MaterialId;
	name: string;
	/** Refractive index at the wavelength `nm` (nanometres). */
	n: (nm: number) => number;
}

/** n(λ) from Sellmeier coefficients B, C (C in µm²). */
function sellmeier(B: number[], Cs: number[]) {
	return (nm: number) => {
		const l2 = (nm / 1000) ** 2;
		let n2 = 1;
		for (let i = 0; i < B.length; i++) n2 += (B[i] * l2) / (l2 - Cs[i]);
		return Math.sqrt(n2);
	};
}

export const MATERIALS: Record<MaterialId, Material> = {
	// Air at sea level is n ≈ 1.0003; taken as 1 (see the header).
	air: { id: 'air', name: 'Air', n: () => 1 },
	// Water at 20 °C: M. Daimon & A. Masumura, Appl. Opt. 46, 3811 (2007), four-term
	// Sellmeier fit, valid 0.18–1.13 µm (via refractiveindex.info). n(589 nm) = 1.333.
	water: {
		id: 'water',
		name: 'Water',
		n: sellmeier(
			[5.684027565e-1, 1.726177391e-1, 2.086189578e-2, 1.130748688e-1],
			[5.101829712e-3, 1.821153936e-2, 2.620722293e-2, 1.069792721e1]
		)
	},
	// Fused silica (the glass of optical fibre): I. H. Malitson, J. Opt. Soc. Am. 55, 1205
	// (1965). n(589 nm) = 1.458.
	silica: {
		id: 'silica',
		name: 'Fused silica',
		n: sellmeier([0.6961663, 0.4079426, 0.8974794], [0.0684043 ** 2, 0.1162414 ** 2, 9.896161 ** 2])
	},
	// Crown glass, SCHOTT N-BK7 data sheet (Sellmeier coefficients). n_d (587.6 nm) = 1.5168.
	crown: {
		id: 'crown',
		name: 'Crown glass',
		n: sellmeier([1.03961212, 0.231792344, 1.01046945], [0.00600069867, 0.0200179144, 103.560653])
	},
	// Dense flint glass, SCHOTT N-SF11 data sheet. n_d = 1.7847.
	flint: {
		id: 'flint',
		name: 'Flint glass',
		n: sellmeier([1.73759695, 0.313747346, 1.89878101], [0.013188707, 0.0623068142, 155.23629])
	},
	// Diamond: F. Peter, Z. Phys. 15, 358 (1923), two-term Sellmeier fit (via
	// refractiveindex.info). n(589 nm) = 2.417.
	diamond: {
		id: 'diamond',
		name: 'Diamond',
		n: sellmeier([4.3356, 0.3306], [0.106 ** 2, 0.175 ** 2])
	}
};

/** The sodium D line, the wavelength at which refractive indices are usually quoted. */
export const YELLOW = 589.3;

/** Speed of light in a material of index n, m/s. */
export const speedIn = (n: number) => C / n;

/** Wavelength inside a material of index n: the frequency stays, so λ shrinks by n. */
export const wavelengthIn = (nm: number, n: number) => nm / n;

/** Rough colour name of visible light (for readouts). */
export function colourName(nm: number): string {
	if (nm < 450) return 'violet';
	if (nm < 490) return 'blue';
	if (nm < 520) return 'cyan';
	if (nm < 565) return 'green';
	if (nm < 590) return 'yellow';
	if (nm < 625) return 'orange';
	return 'red';
}

// ---------------------------------------------------------------- Snell's law

const DEG = Math.PI / 180;
export const toRad = (d: number) => d * DEG;
export const toDeg = (r: number) => r / DEG;

/** Angle of the refracted ray (degrees from the normal), or null past the critical angle. */
export function refractAngle(n1: number, n2: number, theta1: number): number | null {
	const s = (n1 / n2) * Math.sin(toRad(theta1));
	return Math.abs(s) > 1 ? null : toDeg(Math.asin(s));
}

/** Critical angle (degrees) going from n1 into a lower n2; null if n2 ≥ n1. */
export function criticalAngle(n1: number, n2: number): number | null {
	return n2 >= n1 ? null : toDeg(Math.asin(n2 / n1));
}

/**
 * Fraction of unpolarised light reflected at a boundary (Fresnel equations),
 * for an angle of incidence θ₁ in degrees. 1 past the critical angle.
 */
export function reflectance(n1: number, n2: number, theta1: number): number {
	const ci = Math.cos(toRad(theta1));
	const s = (n1 / n2) * Math.sin(toRad(theta1));
	if (s >= 1) return 1;
	const ct = Math.sqrt(1 - s * s);
	const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
	const rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
	return (rs * rs + rp * rp) / 2;
}

/**
 * Largest angle (degrees, in air) at which light entering the flat end of a
 * fibre with core index n1 and walls of index n2 is still trapped: its sine is
 * the numerical aperture √(n1² − n2²) (capped at 90°).
 */
export function acceptanceAngle(n1: number, n2: number): number {
	const na = Math.sqrt(Math.max(0, n1 * n1 - n2 * n2));
	return na >= 1 ? 90 : toDeg(Math.asin(na));
}

// ---------------------------------------------------------------- lenses

/**
 * Lensmaker's equation for a thin lens in air: 1/f = (n − 1)(1/R₁ − 1/R₂),
 * radii signed (positive when the centre of curvature is on the far side).
 */
export function thinLensFocal(n: number, r1: number, r2: number): number {
	return 1 / ((n - 1) * (1 / r1 - 1 / r2));
}

/**
 * The lens and object of the "lenses make images" step (stage units, 2 = 1 mm):
 * crown glass (n = 1.52) with faces of radius 85 mm, 50 mm tall, an object
 * 20 mm tall, and the heights on the lens (from the axis) that the fan of rays
 * from the object's tip is aimed at. Small enough that the traced rays meet
 * close to where the thin-lens equation puts the image.
 */
export const IMAGE_LENS = {
	n: 1.52,
	radius: 170,
	halfHeight: 50,
	object: 40,
	fan: [-20, -10, 0, 10, 20]
} as const;

/** Image distance from the thin-lens equation 1/f = 1/u + 1/v (v < 0: virtual image). */
export function imageDistance(f: number, u: number): number {
	return 1 / (1 / f - 1 / u);
}

// ---------------------------------------------------------------- rainbow

/**
 * Angle of the primary rainbow from the antisolar point (degrees), for water
 * of index n: the ray that enters a drop, reflects once inside and leaves is
 * turned by D(i) = 180° + 2i − 4r; the bow is where D is smallest, at
 * cos² i = (n² − 1) ÷ 3 (Descartes, 1637), and appears at 180° − D_min.
 */
export function rainbowAngle(n: number): number {
	const i = Math.acos(Math.sqrt((n * n - 1) / 3));
	const r = Math.asin(Math.sin(i) / n);
	return toDeg(4 * r - 2 * i);
}

// ---------------------------------------------------------------- geometry

export interface Vec {
	x: number;
	y: number;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const len = (a: Vec) => Math.hypot(a.x, a.y);
const unit = (a: Vec): Vec => mul(a, 1 / len(a));
/** Unit vector at `deg` degrees (0 = +x; screen y points down, so +90 points down). */
export const dir = (deg: number): Vec => ({ x: Math.cos(toRad(deg)), y: Math.sin(toRad(deg)) });

/** A region whose intersection with others makes a body. */
type Region =
	/** Points with (x − p)·normal ≤ 0; `normal` points out of the region. */
	| { kind: 'half'; p: Vec; normal: Vec }
	| { kind: 'disc'; c: Vec; r: number }
	| { kind: 'outside'; c: Vec; r: number };

export interface Body {
	kind: 'body';
	id: string;
	/** The body is the intersection of all its regions. */
	regions: Region[];
	/** Refractive index at a wavelength (nm). */
	n: (nm: number) => number;
}

export interface Mirror {
	kind: 'mirror';
	id: string;
	a: Vec;
	b: Vec;
}

/** A screen: a line segment that stops light (to show where it lands). */
export interface Screen {
	kind: 'screen';
	id: string;
	a: Vec;
	b: Vec;
}

export type Element = Body | Mirror | Screen;

const TOL = 1e-6;

function inRegion(r: Region, q: Vec, tol = TOL): boolean {
	if (r.kind === 'half') return dot(sub(q, r.p), r.normal) <= tol;
	const d = len(sub(q, r.c));
	return r.kind === 'disc' ? d <= r.r + tol : d >= r.r - tol;
}

/** Outward normal of a region's boundary at q. */
function normalOf(r: Region, q: Vec): Vec {
	if (r.kind === 'half') return unit(r.normal);
	const n = unit(sub(q, r.c));
	return r.kind === 'disc' ? n : mul(n, -1);
}

/** Ray parameters s where o + s·d crosses the region's boundary. */
function crossings(r: Region, o: Vec, d: Vec): number[] {
	if (r.kind === 'half') {
		const den = dot(d, r.normal);
		if (Math.abs(den) < 1e-12) return [];
		return [dot(sub(r.p, o), r.normal) / den];
	}
	const oc = sub(o, r.c);
	const b = dot(oc, d);
	const c = dot(oc, oc) - r.r * r.r;
	const disc = b * b - c;
	if (disc < 0) return [];
	const s = Math.sqrt(disc);
	return [-b - s, -b + s];
}

/** Is q inside the body (all regions)? */
function contains(body: Body, q: Vec): boolean {
	return body.regions.every((r) => inRegion(r, q, 0));
}

interface Hit {
	s: number;
	q: Vec;
	normal: Vec;
	kind: 'body' | 'mirror' | 'screen';
}

function firstHit(elements: Element[], o: Vec, d: Vec, minS: number): Hit | null {
	let best: Hit | null = null;
	for (const el of elements) {
		if (el.kind !== 'body') {
			const e = sub(el.b, el.a);
			const den = d.x * e.y - d.y * e.x;
			if (Math.abs(den) < 1e-12) continue;
			const ao = sub(el.a, o);
			const s = (ao.x * e.y - ao.y * e.x) / den;
			const u = (ao.x * d.y - ao.y * d.x) / den;
			if (s > minS && u >= 0 && u <= 1 && (!best || s < best.s)) {
				best = { s, q: add(o, mul(d, s)), normal: unit({ x: -e.y, y: e.x }), kind: el.kind };
			}
			continue;
		}
		el.regions.forEach((r, i) => {
			for (const s of crossings(r, o, d)) {
				if (s <= minS || (best && s >= best.s)) continue;
				const q = add(o, mul(d, s));
				if (el.regions.every((other, j) => j === i || inRegion(other, q))) {
					best = { s, q, normal: normalOf(r, q), kind: 'body' };
				}
			}
		});
	}
	return best;
}

/** Index of the medium at q: the last body in the list that contains it, else the ambient one. */
function indexAt(elements: Element[], q: Vec, nm: number, ambient: number): number {
	for (let i = elements.length - 1; i >= 0; i--) {
		const el = elements[i];
		if (el.kind === 'body' && contains(el, q)) return el.n(nm);
	}
	return ambient;
}

/** One straight piece of a traced ray. */
export interface Leg {
	a: Vec;
	b: Vec;
	/** Refractive index of the medium the leg runs through. */
	n: number;
	/** Fraction of the source's light carried. */
	power: number;
	/** Optical path length (Σ n × length) from the source to `a`: travel time × c. */
	opl: number;
}

/** At a boundary: bent through it, totally reflected, bounced off a mirror, or crossed
 * a join between two pieces of one material. */
export type Event = 'refract' | 'tir' | 'mirror' | 'pass';

/** One traced path: a ray or a partial reflection branching off it. */
export interface RayPath {
	legs: Leg[];
	/** What happened at the end of each leg but the last. */
	events: Event[];
	/** Depth of branching: 0 for the main ray. */
	branch: number;
	/** Index (in the traced list) of the path this one reflected off, −1 for the main ray. */
	parent: number;
	/** Number of the parent's legs before this branch splits off. */
	from: number;
	/** Why it ended: it left the box (or faded out), landed on a screen, or hit the bounce limit. */
	end: 'out' | 'screen' | 'limit';
}

interface TraceOptions {
	/** Wavelength, nm. */
	nm?: number;
	/** Index of the surrounding medium. */
	ambient?: number;
	/** Branches carrying less than this fraction of the light are dropped. */
	minPower?: number;
	/** Maximum number of legs per path. */
	maxLegs?: number;
	/** The box that ends every ray: [xmin, ymin, xmax, ymax]. */
	box?: [number, number, number, number];
}

/** Distance along d from o to the edge of the box. */
function toBox(o: Vec, d: Vec, box: [number, number, number, number]): number {
	const [x0, y0, x1, y1] = box;
	let s = Infinity;
	if (d.x > 1e-12) s = Math.min(s, (x1 - o.x) / d.x);
	if (d.x < -1e-12) s = Math.min(s, (x0 - o.x) / d.x);
	if (d.y > 1e-12) s = Math.min(s, (y1 - o.y) / d.y);
	if (d.y < -1e-12) s = Math.min(s, (y0 - o.y) / d.y);
	return Math.max(0, s);
}

/**
 * Traces a ray from `origin` in direction `direction` through the elements.
 * Returns the main path first, then every partial reflection strong enough
 * to keep (Fresnel), each as its own path.
 */
export function trace(
	elements: Element[],
	origin: Vec,
	direction: Vec,
	opts: TraceOptions = {}
): RayPath[] {
	const nm = opts.nm ?? YELLOW;
	const ambient = opts.ambient ?? 1;
	const minPower = opts.minPower ?? 0.05;
	const maxLegs = opts.maxLegs ?? 40;
	const box = opts.box ?? [-1e4, -1e4, 1e4, 1e4];
	const out: RayPath[] = [];
	// Paths still to trace (the main ray, then branches), at most 24 in all.
	const queue: {
		o: Vec;
		d: Vec;
		power: number;
		opl: number;
		branch: number;
		parent: number;
		from: number;
	}[] = [{ o: origin, d: unit(direction), power: 1, opl: 0, branch: 0, parent: -1, from: 0 }];
	while (queue.length && out.length < 24) {
		const start = queue.shift()!;
		let { o, d, power, opl } = start;
		const legs: Leg[] = [];
		const events: Event[] = [];
		let end: RayPath['end'] = 'limit';
		let n1 = indexAt(elements, add(o, mul(d, 1e-4)), nm, ambient);
		while (legs.length < maxLegs) {
			const hit = firstHit(elements, o, d, 1e-7);
			const sBox = toBox(o, d, box);
			if (!hit || hit.s > sBox) {
				legs.push({ a: o, b: add(o, mul(d, sBox)), n: n1, power, opl });
				end = 'out';
				break;
			}
			const q = hit.q;
			// The normal facing back against the ray.
			let N = hit.normal;
			if (dot(N, d) > 0) N = mul(N, -1);
			const cosi = -dot(d, N);
			const reflected = add(d, mul(N, 2 * cosi));
			if (hit.kind === 'screen') {
				legs.push({ a: o, b: q, n: n1, power, opl });
				end = 'screen';
				break;
			}
			if (hit.kind === 'mirror') {
				legs.push({ a: o, b: q, n: n1, power, opl });
				events.push('mirror');
				opl += n1 * hit.s;
				o = q;
				d = unit(reflected);
				continue;
			}
			const n2 = indexAt(elements, sub(q, mul(N, 1e-4)), nm, ambient);
			if (Math.abs(n2 - n1) < 1e-12) {
				// A join between two pieces of the same material: no bend, no reflection.
				legs.push({ a: o, b: q, n: n1, power, opl });
				events.push('pass');
				opl += n1 * hit.s;
				o = q;
				continue;
			}
			const eta = n1 / n2;
			const k = 1 - eta * eta * (1 - cosi * cosi);
			legs.push({ a: o, b: q, n: n1, power, opl });
			opl += n1 * hit.s;
			if (k < 0) {
				events.push('tir');
				o = q;
				d = unit(reflected);
				continue;
			}
			const R = reflectance(n1, n2, toDeg(Math.acos(Math.min(1, cosi))));
			if (power * R >= minPower) {
				queue.push({
					o: q,
					d: unit(reflected),
					power: power * R,
					opl,
					branch: start.branch + 1,
					parent: out.length,
					from: legs.length
				});
			}
			events.push('refract');
			power *= 1 - R;
			o = q;
			d = unit(add(mul(d, eta), mul(N, eta * cosi - Math.sqrt(k))));
			n1 = n2;
			if (power < minPower) {
				end = 'out';
				break;
			}
		}
		out.push({ legs, events, branch: start.branch, parent: start.parent, from: start.from, end });
	}
	return out;
}

/** All the legs from the source to the end of path i, through the paths it branched off. */
export function chain(paths: RayPath[], i: number): Leg[] {
	const p = paths[i];
	if (p.parent < 0) return p.legs;
	return [...chain(paths, p.parent).slice(0, p.from), ...p.legs];
}

/** Where two rays (point + direction) cross. */
export function crossing(p: Vec, u: Vec, q: Vec, v: Vec): Vec | null {
	const den = u.x * v.y - u.y * v.x;
	if (Math.abs(den) < 1e-12) return null;
	const w = sub(q, p);
	const s = (w.x * v.y - w.y * v.x) / den;
	return add(p, mul(u, s));
}

/** Direction of the last leg of a path. */
export function exitDirection(path: RayPath): Vec {
	const l = path.legs[path.legs.length - 1];
	return unit(sub(l.b, l.a));
}

// ---------------------------------------------------------------- element builders

/** A rectangle centred on c, w × h, rotated by `deg`. */
export function block(id: string, c: Vec, w: number, h: number, deg: number, n: Body['n']): Body {
	const ux = dir(deg);
	const uy = dir(deg + 90);
	return {
		kind: 'body',
		id,
		n,
		regions: [
			{ kind: 'half', p: add(c, mul(ux, w / 2)), normal: ux },
			{ kind: 'half', p: add(c, mul(ux, -w / 2)), normal: mul(ux, -1) },
			{ kind: 'half', p: add(c, mul(uy, h / 2)), normal: uy },
			{ kind: 'half', p: add(c, mul(uy, -h / 2)), normal: mul(uy, -1) }
		]
	};
}

/** Corners of a triangle prism (equilateral by default) centred on c, apex up at deg = 0. */
export function prismCorners(c: Vec, side: number, deg: number, apex = 60): Vec[] {
	// An isosceles triangle with the given apex angle and base `side`.
	const half = toRad(apex / 2);
	const h = side / 2 / Math.tan(half);
	// Centroid at c: apex 2h/3 above, base h/3 below (before rotation).
	const pts = [
		{ x: 0, y: (-2 * h) / 3 },
		{ x: side / 2, y: h / 3 },
		{ x: -side / 2, y: h / 3 }
	];
	const cs = Math.cos(toRad(deg));
	const sn = Math.sin(toRad(deg));
	return pts.map((p) => ({ x: c.x + p.x * cs - p.y * sn, y: c.y + p.x * sn + p.y * cs }));
}

/** A convex polygon body from its corners (any winding). */
export function polygon(id: string, corners: Vec[], n: Body['n']): Body {
	const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
	const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
	const regions: Region[] = corners.map((p, i) => {
		const q = corners[(i + 1) % corners.length];
		let normal = unit({ x: q.y - p.y, y: -(q.x - p.x) });
		if (dot(sub({ x: cx, y: cy }, p), normal) > 0) normal = mul(normal, -1);
		return { kind: 'half', p, normal };
	});
	return { kind: 'body', id, n, regions };
}

/**
 * A symmetric biconvex lens with its axis along x: centre c, surfaces of
 * radius R, half-height (aperture) h. Its centre thickness follows from R and h.
 */
export function convexLens(id: string, c: Vec, R: number, h: number, n: Body['n']): Body {
	const sag = R - Math.sqrt(R * R - h * h);
	// Each surface's vertex is `sag` from the centre; its centre of curvature R beyond it.
	return {
		kind: 'body',
		id,
		n,
		regions: [
			{ kind: 'disc', c: { x: c.x - sag + R, y: c.y }, r: R },
			{ kind: 'disc', c: { x: c.x + sag - R, y: c.y }, r: R }
		]
	};
}

/** Centre thickness of `convexLens(…, R, h)`. */
export const convexThickness = (R: number, h: number) => 2 * (R - Math.sqrt(R * R - h * h));

/**
 * A symmetric biconcave lens: a slab of half-height h whose faces are hollowed
 * by spheres of radius R, leaving `thin` of glass on the axis.
 */
export function concaveLens(
	id: string,
	c: Vec,
	R: number,
	h: number,
	thin: number,
	n: Body['n']
): Body {
	const sag = R - Math.sqrt(R * R - h * h);
	const half = thin / 2 + sag; // half the thickness at the rim
	return {
		kind: 'body',
		id,
		n,
		regions: [
			{ kind: 'half', p: { x: c.x, y: c.y - h }, normal: { x: 0, y: -1 } },
			{ kind: 'half', p: { x: c.x, y: c.y + h }, normal: { x: 0, y: 1 } },
			{ kind: 'half', p: { x: c.x + half, y: c.y }, normal: { x: 1, y: 0 } },
			{ kind: 'half', p: { x: c.x - half, y: c.y }, normal: { x: -1, y: 0 } },
			{ kind: 'outside', c: { x: c.x - thin / 2 - R, y: c.y }, r: R },
			{ kind: 'outside', c: { x: c.x + thin / 2 + R, y: c.y }, r: R }
		]
	};
}

/** A screen from a to b. */
export const screen = (id: string, a: Vec, b: Vec): Screen => ({ kind: 'screen', id, a, b });

/** A disc (a raindrop, a glass ball). */
export function ball(id: string, c: Vec, r: number, n: Body['n']): Body {
	return { kind: 'body', id, n, regions: [{ kind: 'disc', c, r }] };
}

/** A flat mirror centred on c, of length L, its face turned by `deg` (0 = horizontal). */
export function mirror(id: string, c: Vec, L: number, deg: number): Mirror {
	const u = dir(deg);
	return { kind: 'mirror', id, a: add(c, mul(u, -L / 2)), b: add(c, mul(u, L / 2)) };
}

/**
 * A bent optical fibre (a glass rod of width w): a straight run from `start`
 * along +x of length `L1`, a bend of `turn` degrees (positive turns towards −y,
 * up the screen) with inner radius `bendR`, then a straight run of length L2.
 * Returns the pieces (same material, so rays cross their joins unbent) and the
 * centre line for drawing.
 */
export function fibre(
	start: Vec,
	w: number,
	L1: number,
	bendR: number,
	turn: number,
	L2: number,
	n: Body['n']
): { pieces: Body[]; centre: Vec[]; outline: { inner: Vec[]; outer: Vec[] } } {
	const h = w / 2;
	const e1 = { x: start.x + L1, y: start.y };
	// Centre of the bend: above the fibre (towards −y) by bendR + h from the centre line.
	const rc = bendR + h;
	const cc = { x: e1.x, y: e1.y - rc };
	const a = toRad(turn);
	// After turning by `turn` the fibre heads along (cos a, −sin a).
	const u2 = { x: Math.cos(a), y: -Math.sin(a) };
	const e2 = { x: cc.x + rc * Math.sin(a), y: cc.y + rc * Math.cos(a) };
	const straight1 = block('fibre-1', { x: start.x + L1 / 2, y: start.y }, L1, w, 0, n);
	// The bend: between the two radial lines, inside the outer circle, outside the inner one.
	const bend: Body = {
		kind: 'body',
		id: 'fibre-bend',
		n,
		regions: [
			{ kind: 'disc', c: cc, r: bendR + w },
			{ kind: 'outside', c: cc, r: bendR },
			// Not before the first radial line (x ≥ e1.x) …
			{ kind: 'half', p: e1, normal: { x: -1, y: 0 } },
			// … and not past the second one.
			{ kind: 'half', p: e2, normal: u2 }
		]
	};
	const straight2 = block('fibre-2', add(e2, mul(u2, L2 / 2)), L2, w, -turn, n);
	const centre: Vec[] = [start];
	const inner: Vec[] = [{ x: start.x, y: start.y - h }];
	const outer: Vec[] = [{ x: start.x, y: start.y + h }];
	const steps = Math.max(2, Math.ceil(Math.abs(turn) / 5));
	for (let i = 0; i <= steps; i++) {
		const b = (a * i) / steps;
		const rad = { x: Math.sin(b), y: Math.cos(b) };
		centre.push(add(cc, mul(rad, rc)));
		inner.push(add(cc, mul(rad, bendR)));
		outer.push(add(cc, mul(rad, bendR + w)));
	}
	const end = add(e2, mul(u2, L2));
	const nrm = { x: -u2.y, y: u2.x }; // towards the outside of the bend at the end
	centre.push(end);
	inner.push(add(end, mul(nrm, -h)));
	outer.push(add(end, mul(nrm, h)));
	return { pieces: [straight1, bend, straight2], centre, outline: { inner, outer } };
}
