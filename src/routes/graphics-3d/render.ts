/**
 * The model behind the 3D-graphics explainer: one small scene, and the two ways a computer turns
 * it into a picture.
 *
 * - **Rasterisation** (`rasterise`): every triangle goes through the model, view and projection
 *   matrices (4 × 4, homogeneous coordinates), the perspective divide and the viewport transform;
 *   then the pixels whose centres lie inside it are found with edge functions, depth-tested
 *   against a z-buffer, and shaded (Lambert diffuse + Phong specular, with perspective-correct
 *   interpolation of normals and texture coordinates). This is the OpenGL pipeline, done on the
 *   CPU in plain TypeScript.
 * - **Ray tracing** (`raytrace`): for every pixel a ray leaves the eye through the pixel's centre,
 *   is tested against the very same triangles (Möller–Trumbore), and from the nearest hit a shadow
 *   ray goes to the light and, on the mirror and the glass, reflected and refracted rays are
 *   followed, up to a bounce limit (Whitted-style ray tracing, 1980).
 *
 * Both use the same camera, the same triangles and the same shading function, so with no shadows
 * and no bounces they see the same object in every pixel.
 *
 * The scene is generated here (no external model): an 8 × 8 floor with a checkerboard texture, a
 * cube, a mirror ball and a glass ball (icospheres: an icosahedron whose faces are split in four
 * twice and pushed out onto the sphere).
 *
 * Simplifications (stated on the page): one point light with no fall-off with distance and a
 * constant ambient term; shadow rays treat glass as opaque (real glass focuses light into
 * caustics, which needs light traced forward from the lamp); a ray that reaches the bounce limit
 * returns black; triangles that reach behind the camera are dropped rather than clipped (it never
 * happens here: the camera stays farther from the centre than any corner of the floor); colours are computed in linear light and encoded
 * with a 2.2 gamma.
 */

// ---------------------------------------------------------------- vectors
export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
	const l = length(a) || 1;
	return [a[0] / l, a[1] / l, a[2] / l];
};

/** Mirror reflection of direction `d` about unit normal `n`: r = d − 2(d·n)n (angle in = angle out). */
export const reflect = (d: Vec3, n: Vec3): Vec3 => sub(d, scale(n, 2 * dot(d, n)));

/**
 * Refraction of unit direction `d` through a surface with unit normal `n` (facing against `d`),
 * from index n1 to n2, by Snell's law n1 sin θ1 = n2 sin θ2. Null for total internal reflection.
 */
export function refract(d: Vec3, n: Vec3, n1: number, n2: number): Vec3 | null {
	const eta = n1 / n2;
	const cosi = -dot(d, n);
	const k = 1 - eta * eta * (1 - cosi * cosi);
	if (k < 0) return null;
	return add(scale(d, eta), scale(n, eta * cosi - Math.sqrt(k)));
}

/** Schlick's approximation of the share of light a glass surface reflects (Fresnel). */
export function schlick(cosi: number, n1: number, n2: number): number {
	const r0 = ((n1 - n2) / (n1 + n2)) ** 2;
	return r0 + (1 - r0) * (1 - cosi) ** 5;
}

// ---------------------------------------------------------------- 4 × 4 matrices
/** A 4 × 4 matrix, row-major: m[4 * row + col]. Points are columns [x, y, z, 1]. */
type Mat4 = number[];

const identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
	const m = new Array<number>(16).fill(0);
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 4; c++) {
			let s = 0;
			for (let k = 0; k < 4; k++) s += a[4 * r + k] * b[4 * k + c];
			m[4 * r + c] = s;
		}
	return m;
}

const translation = (x: number, y: number, z: number): Mat4 => [
	1,
	0,
	0,
	x,
	0,
	1,
	0,
	y,
	0,
	0,
	1,
	z,
	0,
	0,
	0,
	1
];

const scaling = (s: number): Mat4 => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];

/** Rotation by `a` radians about the vertical (y) axis, counter-clockwise seen from above. */
function rotationY(a: number): Mat4 {
	const c = Math.cos(a);
	const s = Math.sin(a);
	return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

/** [x y z w] = M · [p, w]. */
export function transform4(m: Mat4, p: Vec3, w = 1): [number, number, number, number] {
	return [
		m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3] * w,
		m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7] * w,
		m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11] * w,
		m[12] * p[0] + m[13] * p[1] + m[14] * p[2] + m[15] * w
	];
}
export const transformPoint = (m: Mat4, p: Vec3): Vec3 => transform4(m, p, 1).slice(0, 3) as Vec3;
const transformDir = (m: Mat4, p: Vec3): Vec3 => transform4(m, p, 0).slice(0, 3) as Vec3;

/**
 * The view matrix: moves and turns the world so that the camera sits at the origin looking down
 * −z, with y up (the OpenGL `lookAt`).
 */
function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
	const f = normalize(sub(target, eye));
	const r = normalize(cross(f, up));
	const u = cross(r, f);
	return [
		r[0],
		r[1],
		r[2],
		-dot(r, eye),
		u[0],
		u[1],
		u[2],
		-dot(u, eye),
		-f[0],
		-f[1],
		-f[2],
		dot(f, eye),
		0,
		0,
		0,
		1
	];
}

/**
 * The perspective projection matrix (OpenGL convention): vertical field of view `fovY` (radians),
 * width/height `aspect`, near and far planes. It copies −z (the distance in front of the camera)
 * into w, so that the perspective divide x/w, y/w shrinks far things.
 */
function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
	const f = 1 / Math.tan(fovY / 2);
	return [
		f / aspect,
		0,
		0,
		0,
		0,
		f,
		0,
		0,
		0,
		0,
		(far + near) / (near - far),
		(2 * far * near) / (near - far),
		0,
		0,
		-1,
		0
	];
}

// ---------------------------------------------------------------- the scene
type Material = 'floor' | 'matte' | 'mirror' | 'glass';

interface Mesh {
	name: string;
	material: Material;
	/** Linear-light base colour. */
	color: Vec3;
	positions: Vec3[];
	normals: Vec3[];
	uvs: [number, number][];
	/** Vertex indices, three per triangle, counter-clockwise seen from outside. */
	tris: number[];
}

interface SceneObject {
	id: number;
	mesh: Mesh;
	model: Mat4;
}

function cubeMesh(): Mesh {
	const positions: Vec3[] = [];
	const normals: Vec3[] = [];
	const uvs: [number, number][] = [];
	const tris: number[] = [];
	const faces: { n: Vec3; u: Vec3; v: Vec3 }[] = [
		{ n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
		{ n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
		{ n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
		{ n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
		{ n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
		{ n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
	];
	for (const f of faces) {
		const base = positions.length;
		for (const [a, b] of [
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		]) {
			positions.push(add(scale(f.n, 0.5), add(scale(f.u, a * 0.5), scale(f.v, b * 0.5))));
			normals.push(f.n);
			uvs.push([(a + 1) / 2, (b + 1) / 2]);
		}
		tris.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	return {
		name: 'cube',
		material: 'matte',
		color: [0.72, 0.1, 0.07],
		positions,
		normals,
		uvs,
		tris
	};
}

/** A unit icosphere: an icosahedron with each face split into four `level` times. */
function icosphere(level: number): { positions: Vec3[]; tris: number[] } {
	const t = (1 + Math.sqrt(5)) / 2;
	const positions: Vec3[] = (
		[
			[-1, t, 0],
			[1, t, 0],
			[-1, -t, 0],
			[1, -t, 0],
			[0, -1, t],
			[0, 1, t],
			[0, -1, -t],
			[0, 1, -t],
			[t, 0, -1],
			[t, 0, 1],
			[-t, 0, -1],
			[-t, 0, 1]
		] as Vec3[]
	).map(normalize);
	let tris = [
		0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1,
		8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
	];
	for (let l = 0; l < level; l++) {
		const mid = new Map<string, number>();
		const m = (a: number, b: number) => {
			const key = a < b ? `${a},${b}` : `${b},${a}`;
			let i = mid.get(key);
			if (i === undefined) {
				i = positions.length;
				positions.push(normalize(scale(add(positions[a], positions[b]), 0.5)));
				mid.set(key, i);
			}
			return i;
		};
		const next: number[] = [];
		for (let i = 0; i < tris.length; i += 3) {
			const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
			const ab = m(a, b);
			const bc = m(b, c);
			const ca = m(c, a);
			next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
		}
		tris = next;
	}
	return { positions, tris };
}

function sphereMesh(name: string, material: Material, color: Vec3): Mesh {
	const { positions, tris } = icosphere(2);
	return {
		name,
		material,
		color,
		positions,
		normals: positions.map((p) => [...p] as Vec3),
		uvs: positions.map(() => [0, 0] as [number, number]),
		tris
	};
}

export const FLOOR_HALF = 4;
/** Checkerboard tiles along each side of the floor (each 1 unit wide). */
export const FLOOR_TILES = 8;

function floorMesh(): Mesh {
	const h = FLOOR_HALF;
	return {
		name: 'floor',
		material: 'floor',
		color: [0.8, 0.8, 0.8],
		positions: [
			[-h, 0, h],
			[h, 0, h],
			[h, 0, -h],
			[-h, 0, -h]
		],
		normals: [
			[0, 1, 0],
			[0, 1, 0],
			[0, 1, 0],
			[0, 1, 0]
		],
		uvs: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		],
		tris: [0, 1, 2, 0, 2, 3]
	};
}

export const CUBE_CENTRE: Vec3 = [-1.4, 0.6, 0.5];
export const CUBE_SIZE = 1.2;
export const MIRROR_CENTRE: Vec3 = [1.1, 0.85, -0.8];
export const MIRROR_R = 0.85;
export const GLASS_CENTRE: Vec3 = [0.7, 0.55, 1.5];
export const GLASS_R = 0.55;
/** Refractive index of the glass ball (ordinary crown glass, as in the light-and-optics page). */
const GLASS_N = 1.5;

/** Object ids, also the values of the id buffers (0 = sky). */
export const ID = { sky: 0, floor: 1, cube: 2, mirror: 3, glass: 4 } as const;
export const OBJECT_NAMES = ['sky', 'floor', 'cube', 'mirror ball', 'glass ball'];

/** The cube's model matrix: scale it, turn it by `turn` radians, move it into place. */
export function cubeModel(turn: number): Mat4 {
	return multiply(translation(...CUBE_CENTRE), multiply(rotationY(turn), scaling(CUBE_SIZE)));
}

const meshes = {
	floor: floorMesh(),
	cube: cubeMesh(),
	mirror: sphereMesh('mirror ball', 'mirror', [0.55, 0.57, 0.6]),
	glass: sphereMesh('glass ball', 'glass', [0.7, 0.82, 0.92])
};

/** The scene's objects in drawing order (the order a rasteriser without a z-buffer paints them). */
export function buildScene(cubeTurn = (25 * Math.PI) / 180): SceneObject[] {
	return [
		{ id: ID.floor, mesh: meshes.floor, model: identity() },
		{ id: ID.cube, mesh: meshes.cube, model: cubeModel(cubeTurn) },
		{
			id: ID.mirror,
			mesh: meshes.mirror,
			model: multiply(translation(...MIRROR_CENTRE), scaling(MIRROR_R))
		},
		{
			id: ID.glass,
			mesh: meshes.glass,
			model: multiply(translation(...GLASS_CENTRE), scaling(GLASS_R))
		}
	];
}

export const triangleCount = (scene: SceneObject[]) =>
	scene.reduce((s, o) => s + o.mesh.tris.length / 3, 0);

// ---------------------------------------------------------------- camera and light
export interface CameraSpec {
	/** Degrees round the vertical axis, 0 = on the +z side, counter-clockwise seen from above. */
	az: number;
	/** Degrees above the floor. */
	el: number;
	/** Distance from the centre of the scene. */
	dist: number;
	/** Vertical field of view, degrees. */
	fov: number;
}
export const DEFAULT_CAMERA: CameraSpec = { az: 20, el: 26, dist: 7, fov: 45 };
/** Where the camera looks: a little above the centre of the floor. */
export const TARGET: Vec3 = [0, 0.3, 0.2];
export const NEAR = 0.1;
export const FAR = 50;

export function eyeOf(c: CameraSpec): Vec3 {
	const az = (c.az * Math.PI) / 180;
	const el = (c.el * Math.PI) / 180;
	return [
		TARGET[0] + c.dist * Math.cos(el) * Math.sin(az),
		TARGET[1] + c.dist * Math.sin(el),
		TARGET[2] + c.dist * Math.cos(el) * Math.cos(az)
	];
}

export interface LightSpec {
	/** Degrees round the vertical axis (as for the camera). */
	az: number;
	/** Degrees above the floor, seen from the centre. */
	el: number;
}
export const DEFAULT_LIGHT: LightSpec = { az: -45, el: 40 };
export const LIGHT_DIST = 6;
export function lightPos(l: LightSpec): Vec3 {
	const az = (l.az * Math.PI) / 180;
	const el = (l.el * Math.PI) / 180;
	return [
		LIGHT_DIST * Math.cos(el) * Math.sin(az),
		LIGHT_DIST * Math.sin(el),
		LIGHT_DIST * Math.cos(el) * Math.cos(az)
	];
}

interface Camera {
	eye: Vec3;
	view: Mat4;
	proj: Mat4;
	viewProj: Mat4;
	width: number;
	height: number;
	fovY: number;
}

export function makeCamera(c: CameraSpec, width: number, height: number): Camera {
	const eye = eyeOf(c);
	const fovY = (c.fov * Math.PI) / 180;
	const view = lookAt(eye, TARGET);
	const proj = perspective(fovY, width / height, NEAR, FAR);
	return { eye, view, proj, viewProj: multiply(proj, view), width, height, fovY };
}

/**
 * A point's journey through the pipeline: world → view (camera) space → clip space → after the
 * perspective divide (normalised device coordinates, −1…1) → pixel.
 */
export function projectPoint(cam: Camera, p: Vec3) {
	const view = transformPoint(cam.view, p);
	const clip = transform4(cam.proj, view, 1);
	const ndc: Vec3 = [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]];
	const pixel: [number, number] = [((ndc[0] + 1) / 2) * cam.width, ((1 - ndc[1]) / 2) * cam.height];
	return { view, clip, ndc, pixel };
}

// ---------------------------------------------------------------- shading
/** The floor's texture: an 8 × 8 checkerboard of texels, looked up by (u, v) in 0…1. */
function floorTexture(u: number, v: number): number {
	const i = Math.floor(u * FLOOR_TILES);
	const j = Math.floor(v * FLOOR_TILES);
	return (i + j) % 2 === 0 ? 0.82 : 0.18;
}

export type Shading = 'none' | 'lambert' | 'phong';

interface ShadeOptions {
	shading: Shading;
	texture: boolean;
}

export const AMBIENT = 0.12;
const SPECULAR: Record<Material, [number, number]> = {
	floor: [0.08, 16],
	matte: [0.3, 24],
	mirror: [0.8, 90],
	glass: [0.9, 120]
};

/** Albedo of a surface point (texture lookup for the floor). */
function albedo(mesh: Mesh, uv: [number, number], texture: boolean): Vec3 {
	if (mesh.material === 'floor') {
		const g = texture ? floorTexture(uv[0], uv[1]) : 0.5;
		return [g, g, g * 0.96];
	}
	return mesh.color;
}

/** Lambert's cosine law: the brightness of a matte surface, max(0, n · l). */
export const lambert = (n: Vec3, l: Vec3) => Math.max(0, dot(n, l));

/** Phong's highlight: (r · v)^shininess, r the light's mirror direction, v towards the eye. */
export function phong(n: Vec3, l: Vec3, v: Vec3, shininess: number): number {
	if (dot(n, l) <= 0) return 0;
	const r = reflect(scale(l, -1), n);
	return Math.max(0, dot(r, v)) ** shininess;
}

/**
 * Local shading of a surface point: ambient + Lambert diffuse + Phong highlight, the light's part
 * multiplied by `lit` (0 in shadow). Linear light.
 */
function shade(
	mesh: Mesh,
	p: Vec3,
	n: Vec3,
	uv: [number, number],
	eye: Vec3,
	light: Vec3,
	opts: ShadeOptions,
	lit = 1
): Vec3 {
	const a = albedo(mesh, uv, opts.texture);
	if (opts.shading === 'none') return a;
	const l = normalize(sub(light, p));
	const d = AMBIENT + lit * lambert(n, l);
	const s = highlight(mesh, p, n, eye, light, opts, lit);
	return [a[0] * d + s, a[1] * d + s, a[2] * d + s];
}

/** The Phong highlight part of `shade` alone (0 unless shading is 'phong'). */
function highlight(
	mesh: Mesh,
	p: Vec3,
	n: Vec3,
	eye: Vec3,
	light: Vec3,
	opts: ShadeOptions,
	lit = 1
): number {
	if (opts.shading !== 'phong') return 0;
	const [ks, shin] = SPECULAR[mesh.material];
	return lit * ks * phong(n, normalize(sub(light, p)), normalize(sub(eye, p)), shin);
}

/** Sky colour seen along unit direction `d` (linear light): pale at the horizon, bluer above. */
function sky(d: Vec3): Vec3 {
	const k = Math.max(0, Math.min(1, d[1] * 1.6 + 0.15));
	return [0.62 - 0.42 * k, 0.72 - 0.34 * k, 0.86 - 0.1 * k];
}

const encode = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x)) ** (1 / 2.2));

/** The direction of the ray from the eye through the centre of pixel (px, py) (fractional ok). */
function pixelRay(cam: Camera, px: number, py: number): Vec3 {
	const tanY = Math.tan(cam.fovY / 2);
	const x = ((2 * px) / cam.width - 1) * tanY * (cam.width / cam.height);
	const y = (1 - (2 * py) / cam.height) * tanY;
	// Camera axes are the rows of the view matrix.
	const v = cam.view;
	const r: Vec3 = [v[0], v[1], v[2]];
	const u: Vec3 = [v[4], v[5], v[6]];
	const b: Vec3 = [v[8], v[9], v[10]];
	return normalize(add(add(scale(r, x), scale(u, y)), scale(b, -1)));
}

// ---------------------------------------------------------------- images
export interface Image {
	width: number;
	height: number;
	/** RGBA, 8 bits per channel, gamma-encoded, ready for a canvas `ImageData`. */
	rgba: Uint8ClampedArray;
	/** Which object each pixel shows (`ID`). */
	ids: Uint8Array;
}

function newImage(w: number, h: number): Image {
	return {
		width: w,
		height: h,
		rgba: new Uint8ClampedArray(w * h * 4),
		ids: new Uint8Array(w * h)
	};
}

function put(img: Image, i: number, c: Vec3) {
	img.rgba[4 * i] = encode(c[0]);
	img.rgba[4 * i + 1] = encode(c[1]);
	img.rgba[4 * i + 2] = encode(c[2]);
	img.rgba[4 * i + 3] = 255;
}

function fillSky(img: Image, cam: Camera) {
	for (let j = 0; j < img.height; j++) {
		const c = sky(pixelRay(cam, img.width / 2, j + 0.5));
		for (let i = 0; i < img.width; i++) put(img, j * img.width + i, c);
	}
}

// ---------------------------------------------------------------- rasterisation
export interface RasterOptions extends ShadeOptions {
	zbuffer: boolean;
	/** Divide interpolated attributes by w (true) or interpolate them flat across the screen. */
	perspectiveCorrect: boolean;
	/** Stop after this many triangles (to show the picture being built); all by default. */
	limit?: number;
}
export const DEFAULT_RASTER: RasterOptions = {
	shading: 'phong',
	texture: true,
	zbuffer: true,
	perspectiveCorrect: true
};

interface RasterResult extends Image {
	/** Depth of each pixel's surface, 0 (near plane) … 1 (far plane); 1 where only sky. */
	depth: Float32Array;
	/** Texture coordinates (u, v) used at each pixel, two numbers per pixel. */
	uv: Float32Array;
	stats: {
		triangles: number;
		/** Triangles dropped because a corner was behind the camera. */
		dropped: number;
		/** Pixel centres tested against a triangle's edges (its bounding box). */
		pixelTests: number;
		/** Tested pixels that were inside a triangle (fragments). */
		fragments: number;
		/** Fragments that lost the depth test. */
		hidden: number;
		/** Pixels shaded (fragments that were drawn). */
		shaded: number;
	};
}

/** Twice the signed area of triangle (a, b, p): which side of edge a→b the point p is on. */
export const edge = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
	(bx - ax) * (py - ay) - (by - ay) * (px - ax);

/**
 * Which pixel centres of a w × h grid lie inside the screen-space triangle (x0,y0)…(x2,y2):
 * the edge-function test a GPU makes (without the tie-breaking fill rule a GPU adds for pixels
 * exactly on a shared edge), over the triangle's bounding box.
 */
export function coverage(
	pts: [number, number][],
	w: number,
	h: number
): { inside: Uint8Array; tested: number; covered: number; box: [number, number, number, number] } {
	const [[x0, y0], [x1, y1], [x2, y2]] = pts;
	const inside = new Uint8Array(w * h);
	const area = edge(x0, y0, x1, y1, x2, y2);
	const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
	const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
	const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
	const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
	let tested = 0;
	let covered = 0;
	if (area !== 0) {
		const s = Math.sign(area);
		for (let j = minY; j <= maxY; j++)
			for (let i = minX; i <= maxX; i++) {
				const px = i + 0.5;
				const py = j + 0.5;
				tested++;
				if (
					s * edge(x1, y1, x2, y2, px, py) >= 0 &&
					s * edge(x2, y2, x0, y0, px, py) >= 0 &&
					s * edge(x0, y0, x1, y1, px, py) >= 0
				) {
					inside[j * w + i] = 1;
					covered++;
				}
			}
	}
	return { inside, tested, covered, box: [minX, minY, maxX, maxY] };
}

export function rasterise(
	scene: SceneObject[],
	cam: Camera,
	light: Vec3,
	opts: RasterOptions = DEFAULT_RASTER
): RasterResult {
	const W = cam.width;
	const H = cam.height;
	const img = newImage(W, H);
	const depth = new Float32Array(W * H).fill(1);
	const uvBuf = new Float32Array(W * H * 2);
	fillSky(img, cam);
	const stats = { triangles: 0, dropped: 0, pixelTests: 0, fragments: 0, hidden: 0, shaded: 0 };
	const sx = new Float64Array(3);
	const sy = new Float64Array(3);
	const sz = new Float64Array(3);
	const iw = new Float64Array(3);
	for (const obj of scene) {
		const { mesh, model } = obj;
		const world = mesh.positions.map((p) => transformPoint(model, p));
		const normals = mesh.normals.map((n) => normalize(transformDir(model, n)));
		const clip = world.map((p) => transform4(cam.viewProj, p));
		for (let t = 0; t < mesh.tris.length; t += 3) {
			if (opts.limit !== undefined && stats.triangles >= opts.limit) break;
			stats.triangles++;
			const v = [mesh.tris[t], mesh.tris[t + 1], mesh.tris[t + 2]];
			if (v.some((k) => clip[k][3] < NEAR)) {
				stats.dropped++;
				continue;
			}
			for (let k = 0; k < 3; k++) {
				const c = clip[v[k]];
				iw[k] = 1 / c[3];
				sx[k] = ((c[0] * iw[k] + 1) / 2) * W;
				sy[k] = ((1 - c[1] * iw[k]) / 2) * H;
				sz[k] = (c[2] * iw[k] + 1) / 2;
			}
			const area = edge(sx[0], sy[0], sx[1], sy[1], sx[2], sy[2]);
			if (area === 0) continue;
			const sgn = Math.sign(area);
			const minX = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
			const maxX = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
			const minY = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
			const maxY = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
			for (let j = minY; j <= maxY; j++) {
				for (let i = minX; i <= maxX; i++) {
					stats.pixelTests++;
					const px = i + 0.5;
					const py = j + 0.5;
					const e0 = sgn * edge(sx[1], sy[1], sx[2], sy[2], px, py);
					const e1 = sgn * edge(sx[2], sy[2], sx[0], sy[0], px, py);
					const e2 = sgn * edge(sx[0], sy[0], sx[1], sy[1], px, py);
					if (e0 < 0 || e1 < 0 || e2 < 0) continue;
					stats.fragments++;
					const b0 = e0 / (sgn * area);
					const b1 = e1 / (sgn * area);
					const b2 = e2 / (sgn * area);
					const z = b0 * sz[0] + b1 * sz[1] + b2 * sz[2];
					const idx = j * W + i;
					if (opts.zbuffer && z >= depth[idx]) {
						stats.hidden++;
						continue;
					}
					depth[idx] = z;
					// Attribute weights: perspective-correct (divide by w, then renormalise) or affine.
					let w0 = b0;
					let w1 = b1;
					let w2 = b2;
					if (opts.perspectiveCorrect) {
						w0 *= iw[0];
						w1 *= iw[1];
						w2 *= iw[2];
						const s = w0 + w1 + w2;
						w0 /= s;
						w1 /= s;
						w2 /= s;
					}
					const P = interp3(world[v[0]], world[v[1]], world[v[2]], w0, w1, w2);
					const N = normalize(interp3(normals[v[0]], normals[v[1]], normals[v[2]], w0, w1, w2));
					const ua = mesh.uvs[v[0]];
					const ub = mesh.uvs[v[1]];
					const uc = mesh.uvs[v[2]];
					const uv: [number, number] = [
						w0 * ua[0] + w1 * ub[0] + w2 * uc[0],
						w0 * ua[1] + w1 * ub[1] + w2 * uc[1]
					];
					// Facing away (the inside of a sphere seen without a z-buffer): flip the normal.
					const Nf = dot(N, sub(cam.eye, P)) < 0 ? scale(N, -1) : N;
					put(img, idx, shade(mesh, P, Nf, uv, cam.eye, light, opts));
					img.ids[idx] = obj.id;
					uvBuf[2 * idx] = uv[0];
					uvBuf[2 * idx + 1] = uv[1];
					stats.shaded++;
				}
			}
		}
	}
	return { ...img, depth, uv: uvBuf, stats };
}

function interp3(a: Vec3, b: Vec3, c: Vec3, w0: number, w1: number, w2: number): Vec3 {
	return [
		w0 * a[0] + w1 * b[0] + w2 * c[0],
		w0 * a[1] + w1 * b[1] + w2 * c[1],
		w0 * a[2] + w1 * b[2] + w2 * c[2]
	];
}

// ---------------------------------------------------------------- ray tracing
interface WorldTri {
	obj: number;
	mesh: Mesh;
	p0: Vec3;
	e1: Vec3;
	e2: Vec3;
	n0: Vec3;
	n1: Vec3;
	n2: Vec3;
	uv0: [number, number];
	uv1: [number, number];
	uv2: [number, number];
}
interface Bound {
	c: Vec3;
	r2: number;
	tris: WorldTri[];
}

/** The scene's triangles in world space, grouped per object with a bounding sphere each. */
interface TraceWorld {
	bounds: Bound[];
	triangles: number;
}

export function traceWorld(scene: SceneObject[]): TraceWorld {
	const bounds: Bound[] = [];
	let triangles = 0;
	for (const obj of scene) {
		const { mesh, model } = obj;
		const world = mesh.positions.map((p) => transformPoint(model, p));
		const normals = mesh.normals.map((n) => normalize(transformDir(model, n)));
		const tris: WorldTri[] = [];
		for (let t = 0; t < mesh.tris.length; t += 3) {
			const [a, b, c] = [mesh.tris[t], mesh.tris[t + 1], mesh.tris[t + 2]];
			tris.push({
				obj: obj.id,
				mesh,
				p0: world[a],
				e1: sub(world[b], world[a]),
				e2: sub(world[c], world[a]),
				n0: normals[a],
				n1: normals[b],
				n2: normals[c],
				uv0: mesh.uvs[a],
				uv1: mesh.uvs[b],
				uv2: mesh.uvs[c]
			});
		}
		triangles += tris.length;
		const c = scale(
			world.reduce((s, p) => add(s, p), [0, 0, 0] as Vec3),
			1 / world.length
		);
		const r2 = Math.max(...world.map((p) => dot(sub(p, c), sub(p, c)))) * 1.0001;
		bounds.push({ c, r2, tris });
	}
	return { bounds, triangles };
}

export interface TraceOptions extends ShadeOptions {
	shadows: boolean;
	/** How many reflections or refractions a ray may follow after it first hits something. */
	bounces: number;
}
export const DEFAULT_TRACE: TraceOptions = {
	shading: 'phong',
	texture: true,
	shadows: true,
	bounces: 3
};

interface TraceStats {
	/** Rays from the eye, one per pixel. */
	primary: number;
	/** Rays from a surface point towards the light. */
	shadow: number;
	/** Reflected and refracted rays. */
	secondary: number;
	/** Ray–triangle intersection tests. */
	triangleTests: number;
}

interface Hit {
	t: number;
	tri: WorldTri;
	u: number;
	v: number;
}

const EPS = 1e-4;

/** Möller–Trumbore ray–triangle intersection: distance along the ray, or −1. */
function hitTri(o: Vec3, d: Vec3, tri: WorldTri, out: { u: number; v: number }): number {
	const { e1, e2, p0 } = tri;
	const px = d[1] * e2[2] - d[2] * e2[1];
	const py = d[2] * e2[0] - d[0] * e2[2];
	const pz = d[0] * e2[1] - d[1] * e2[0];
	const det = e1[0] * px + e1[1] * py + e1[2] * pz;
	if (det > -1e-12 && det < 1e-12) return -1;
	const inv = 1 / det;
	const tx = o[0] - p0[0];
	const ty = o[1] - p0[1];
	const tz = o[2] - p0[2];
	const u = (tx * px + ty * py + tz * pz) * inv;
	if (u < 0 || u > 1) return -1;
	const qx = ty * e1[2] - tz * e1[1];
	const qy = tz * e1[0] - tx * e1[2];
	const qz = tx * e1[1] - ty * e1[0];
	const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv;
	if (v < 0 || u + v > 1) return -1;
	const t = (e2[0] * qx + e2[1] * qy + e2[2] * qz) * inv;
	out.u = u;
	out.v = v;
	return t;
}

function hitsBound(o: Vec3, d: Vec3, b: Bound, maxT: number): boolean {
	const oc = sub(o, b.c);
	const bq = dot(oc, d);
	const c = dot(oc, oc) - b.r2;
	if (c <= 0) return true; // starts inside
	if (bq > 0) return false;
	const disc = bq * bq - c;
	if (disc < 0) return false;
	return -bq - Math.sqrt(disc) < maxT;
}

const uvTmp = { u: 0, v: 0 };
function nearest(
	world: TraceWorld,
	o: Vec3,
	d: Vec3,
	stats: TraceStats,
	maxT = Infinity
): Hit | null {
	let best: Hit | null = null;
	let bestT = maxT;
	for (const b of world.bounds) {
		if (!hitsBound(o, d, b, bestT)) continue;
		for (const tri of b.tris) {
			stats.triangleTests++;
			const t = hitTri(o, d, tri, uvTmp);
			if (t > EPS && t < bestT) {
				bestT = t;
				best = { t, tri, u: uvTmp.u, v: uvTmp.v };
			}
		}
	}
	return best;
}

/** Distance to the first thing between `o` and `maxT` along `d`, or −1 if nothing is in the way. */
function blocked(world: TraceWorld, o: Vec3, d: Vec3, maxT: number, stats: TraceStats): number {
	for (const b of world.bounds) {
		if (b.tris[0].mesh.material === 'floor') continue; // the floor can't shade itself
		if (!hitsBound(o, d, b, maxT)) continue;
		for (const tri of b.tris) {
			stats.triangleTests++;
			const t = hitTri(o, d, tri, uvTmp);
			if (t > EPS && t < maxT) return t;
		}
	}
	return -1;
}

/** One straight piece of a traced ray, for drawing. */
export interface Segment {
	from: Vec3;
	to: Vec3;
	kind: 'eye' | 'reflect' | 'refract' | 'shadow' | 'lit';
	/** Depth of the ray: 0 for the eye ray, 1 after the first bounce… */
	depth: number;
	/** Missed everything (`to` is just a point far along the ray). */
	escaped?: boolean;
	/** Id of the object hit at `to`, for eye, reflected and refracted rays. */
	obj?: number;
}

interface TraceCtx {
	world: TraceWorld;
	eye: Vec3;
	light: Vec3;
	opts: TraceOptions;
	stats: TraceStats;
	segments?: Segment[];
}

function surface(h: Hit, o: Vec3, d: Vec3) {
	const { tri, u, v } = h;
	const w = 1 - u - v;
	const p = add(o, scale(d, h.t));
	const n = normalize(add(add(scale(tri.n0, w), scale(tri.n1, u)), scale(tri.n2, v)));
	const g = normalize(cross(tri.e1, tri.e2));
	const uv: [number, number] = [
		w * tri.uv0[0] + u * tri.uv1[0] + v * tri.uv2[0],
		w * tri.uv0[1] + u * tri.uv1[1] + v * tri.uv2[1]
	];
	return { p, n, g, uv };
}

function trace(
	ctx: TraceCtx,
	o: Vec3,
	d: Vec3,
	depth: number,
	weight: number,
	kind: Segment['kind']
): { c: Vec3; id: number } {
	const { world, light, opts, stats } = ctx;
	const h = nearest(world, o, d, stats);
	if (!h) {
		ctx.segments?.push({ from: o, to: add(o, scale(d, 12)), kind, depth, escaped: true });
		return { c: sky(d), id: ID.sky };
	}
	const { p, n, g, uv } = surface(h, o, d);
	ctx.segments?.push({ from: o, to: p, kind, depth, obj: h.tri.obj });
	const mesh = h.tri.mesh;
	const front = dot(d, g) < 0;
	const nf = front ? n : scale(n, -1);
	// Local shading with a shadow ray (the eye position is where this ray came from).
	let lit = 1;
	// (Not needed inside the glass, where no local light is added.)
	if (opts.shadows && opts.shading !== 'none' && (front || mesh.material !== 'glass')) {
		const toL = sub(light, p);
		const dist = length(toL);
		const ld = scale(toL, 1 / dist);
		if (dot(ld, nf) > 0) {
			stats.shadow++;
			const o2 = add(p, scale(nf, EPS * 10));
			const tb = blocked(world, o2, ld, dist, stats);
			lit = tb < 0 ? 1 : 0;
			ctx.segments?.push({
				from: p,
				to: tb < 0 ? light : add(o2, scale(ld, tb)),
				kind: tb < 0 ? 'lit' : 'shadow',
				depth
			});
		} else lit = 0;
	}
	const local = shade(mesh, p, nf, uv, o, light, opts, lit);
	if (mesh.material === 'mirror') {
		const R = 0.85;
		let refl: Vec3 = [0, 0, 0];
		if (depth < opts.bounces && weight * R > 0.01) {
			stats.secondary++;
			const rd = normalize(reflect(d, nf));
			refl = trace(ctx, add(p, scale(nf, EPS * 10)), rd, depth + 1, weight * R, 'reflect').c;
		}
		return { c: add(scale(local, 1 - R), scale(refl, R)), id: h.tri.obj };
	}
	if (mesh.material === 'glass') {
		const [n1, n2] = front ? [1, GLASS_N] : [GLASS_N, 1];
		const cosi = Math.min(1, -dot(d, nf));
		const T = refract(d, nf, n1, n2);
		// Fresnel: the share reflected, from the angle on the less dense (air) side.
		const F = T ? schlick(n1 <= n2 ? cosi : -dot(normalize(T), nf), n1, n2) : 1;
		// Its own highlight on the outside; the rest of its colour comes from the rays followed.
		const spec = front ? highlight(mesh, p, nf, o, light, opts, lit) : 0;
		let c: Vec3 = [spec, spec, spec];
		if (depth < opts.bounces) {
			if (F > 0.01 && weight * F > 0.01) {
				stats.secondary++;
				const rd = normalize(reflect(d, nf));
				const rc = trace(ctx, add(p, scale(nf, EPS * 10)), rd, depth + 1, weight * F, 'reflect').c;
				c = add(c, scale(rc, F));
			}
			if (T && weight * (1 - F) > 0.01) {
				stats.secondary++;
				const tc = trace(
					ctx,
					add(p, scale(nf, -EPS * 10)),
					normalize(T),
					depth + 1,
					weight * (1 - F),
					'refract'
				).c;
				c = add(c, scale(mul(tc, mesh.color), 1 - F));
			}
		}
		return { c, id: h.tri.obj };
	}
	return { c: local, id: h.tri.obj };
}

const mul = (a: Vec3, b: Vec3): Vec3 => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

interface TraceResult extends Image {
	stats: TraceStats;
}

export function raytrace(
	world: TraceWorld,
	cam: Camera,
	light: Vec3,
	opts: TraceOptions = DEFAULT_TRACE
): TraceResult {
	const W = cam.width;
	const H = cam.height;
	const img = newImage(W, H);
	const stats: TraceStats = { primary: 0, shadow: 0, secondary: 0, triangleTests: 0 };
	const ctx: TraceCtx = { world, eye: cam.eye, light, opts, stats };
	for (let j = 0; j < H; j++)
		for (let i = 0; i < W; i++) {
			stats.primary++;
			const d = pixelRay(cam, i + 0.5, j + 0.5);
			const r = trace(ctx, cam.eye, d, 0, 1, 'eye');
			put(img, j * W + i, r.c);
			img.ids[j * W + i] = r.id;
		}
	return { ...img, stats };
}

/** Every ray traced for one pixel (eye ray, shadow rays, bounces), for drawing. */
export function tracePixel(
	world: TraceWorld,
	cam: Camera,
	light: Vec3,
	px: number,
	py: number,
	opts: TraceOptions = DEFAULT_TRACE
): { segments: Segment[]; id: number; stats: TraceStats } {
	const stats: TraceStats = { primary: 1, shadow: 0, secondary: 0, triangleTests: 0 };
	const segments: Segment[] = [];
	const ctx: TraceCtx = { world, eye: cam.eye, light, opts, stats, segments };
	const r = trace(ctx, cam.eye, pixelRay(cam, px + 0.5, py + 0.5), 0, 1, 'eye');
	return { segments, id: r.id, stats };
}

/** What the eye sees through the centre of pixel (px, py): the surface point and its shading. */
export function probe(
	world: TraceWorld,
	cam: Camera,
	light: Vec3,
	px: number,
	py: number,
	opts: ShadeOptions = DEFAULT_TRACE
) {
	const stats: TraceStats = { primary: 1, shadow: 0, secondary: 0, triangleTests: 0 };
	const d = pixelRay(cam, px + 0.5, py + 0.5);
	const h = nearest(world, cam.eye, d, stats);
	if (!h) return null;
	const { p, n, uv } = surface(h, cam.eye, d);
	const l = normalize(sub(light, p));
	const nf = dot(n, d) > 0 ? scale(n, -1) : n;
	return {
		id: h.tri.obj,
		p,
		n: nf,
		uv,
		depth: h.t,
		nl: dot(nf, l),
		highlight: highlight(h.tri.mesh, p, nf, cam.eye, light, { ...opts, shading: 'phong' }),
		/** The surface's highlight strength k and shininess exponent. */
		specular: SPECULAR[h.tri.mesh.material],
		/** Angle between the normal and the lamp, degrees. */
		angle: (Math.acos(Math.max(-1, Math.min(1, dot(nf, l)))) * 180) / Math.PI
	};
}
