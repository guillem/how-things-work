// Checks the 3D-graphics model: the projection pipeline, the rasteriser and the ray tracer
// behind the explainer, against geometry, optics and each other. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEFAULT_CAMERA,
	DEFAULT_LIGHT,
	DEFAULT_RASTER,
	DEFAULT_TRACE,
	GLASS_CENTRE,
	ID,
	buildScene,
	coverage,
	dot,
	lambert,
	lightPos,
	makeCamera,
	normalize,
	phong,
	projectPoint,
	rasterise,
	raytrace,
	reflect,
	refract,
	schlick,
	traceWorld,
	tracePixel,
	triangleCount,
	CUBE_CENTRE,
	type Vec3
} from '../src/routes/graphics-3d/render';

const W = 192;
const H = 120;
const scene = buildScene();
const cam = makeCamera(DEFAULT_CAMERA, W, H);
const light = lightPos(DEFAULT_LIGHT);
const world = traceWorld(scene);
const deg = (r: number) => (r * 180) / Math.PI;

test('the scene is 654 triangles: a floor of 2, a cube of 12 and two balls of 320', () => {
	expect(triangleCount(scene)).toBe(654);
	expect(scene.map((o) => o.mesh.tris.length / 3)).toEqual([2, 12, 320, 320]);
});

test('perspective: a point twice as far from the camera lands half as far from the centre', () => {
	const near = projectPoint(cam, [0, 0, 0]);
	// Two points the same distance sideways (along the camera's right axis), at depths d and 2d.
	const right: Vec3 = [cam.view[0], cam.view[1], cam.view[2]];
	const fwd: Vec3 = [-cam.view[8], -cam.view[9], -cam.view[10]];
	const centre = (d: number): Vec3 => [
		cam.eye[0] + fwd[0] * d,
		cam.eye[1] + fwd[1] * d,
		cam.eye[2] + fwd[2] * d
	];
	const off = (d: number) => {
		const c = centre(d);
		return projectPoint(cam, [c[0] + right[0], c[1] + right[1], c[2] + right[2]]).ndc[0];
	};
	expect(off(8) / off(4)).toBeCloseTo(0.5, 10);
	// x_ndc = (f / aspect) · x / depth, with f = 1 / tan(fov/2).
	const f = 1 / Math.tan((DEFAULT_CAMERA.fov * Math.PI) / 360);
	expect(off(5)).toBeCloseTo(((f / (W / H)) * 1) / 5, 10);
	// w carries the depth: the point straight ahead at depth 5 has w = 5.
	expect(projectPoint(cam, centre(5)).clip[3]).toBeCloseTo(5, 10);
	expect(near.ndc[2]).toBeGreaterThan(-1);
});

test('the point the camera looks at lands in the middle of the picture', () => {
	const p = projectPoint(cam, [0, 0.3, 0.2]);
	expect(p.pixel[0]).toBeCloseTo(W / 2, 6);
	expect(p.pixel[1]).toBeCloseTo(H / 2, 6);
});

test('edge functions: a triangle covers the pixel centres inside it, and tests its bounding box', () => {
	const c = coverage(
		[
			[0, 0],
			[10, 0],
			[0, 10]
		],
		10,
		10
	);
	// Centres (i + ½, j + ½) with i + j + 1 ≤ 10: 1 + 2 + … + 10 = 55 of the 100 tested.
	expect(c.covered).toBe(55);
	expect(c.tested).toBe(100);
});

test("Lambert's law: a surface turned 60° from the light gets half the light", () => {
	const n: Vec3 = [0, 1, 0];
	const l: Vec3 = [Math.sin(Math.PI / 3), Math.cos(Math.PI / 3), 0];
	expect(lambert(n, l)).toBeCloseTo(0.5, 12);
	expect(lambert(n, [1, 0, 0])).toBe(0);
	expect(lambert(n, [0, -1, 0])).toBe(0);
});

test('Phong: the highlight is brightest when the eye sits in the mirror direction of the light', () => {
	const n: Vec3 = [0, 1, 0];
	const l = normalize([-1, 1, 0]);
	expect(phong(n, l, normalize([1, 1, 0]), 50)).toBeCloseTo(1, 12);
	expect(phong(n, l, normalize([1, 1.6, 0]), 50)).toBeLessThan(0.5);
	// A higher shininess gives a smaller, sharper highlight.
	const v = normalize([1, 1.1, 0]);
	expect(phong(n, l, v, 200)).toBeLessThan(phong(n, l, v, 20));
});

test('reflection: angle in equals angle out', () => {
	const n: Vec3 = [0, 1, 0];
	const d = normalize([1, -0.4, 0.3]);
	const r = reflect(d, n);
	expect(-dot(d, n)).toBeCloseTo(dot(r, n), 12);
	expect(Math.hypot(...r)).toBeCloseTo(1, 12);
});

test("refraction follows Snell's law, with total internal reflection beyond 41.8° in glass", () => {
	const n: Vec3 = [0, 1, 0];
	const th1 = (40 * Math.PI) / 180;
	const d: Vec3 = [Math.sin(th1), -Math.cos(th1), 0];
	const t = refract(d, n, 1, 1.5)!;
	expect(Math.sin(th1)).toBeCloseTo(1.5 * Math.hypot(t[0], t[2]), 12);
	// From inside the glass out: the critical angle is asin(1/1.5) = 41.8°.
	const out = (a: number) =>
		refract([Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180), 0], n, 1.5, 1);
	expect(deg(Math.asin(1 / 1.5))).toBeCloseTo(41.8, 1);
	expect(out(41)).not.toBeNull();
	expect(out(42.5)).toBeNull();
	// Glass reflects about 4% of light falling straight on it, and nearly all at grazing angles.
	expect(schlick(1, 1, 1.5)).toBeCloseTo(0.04, 6);
	expect(schlick(0.02, 1, 1.5)).toBeGreaterThan(0.85);
});

/** Pixel where a world point lands. */
const pixelOf = (p: Vec3) => {
	const q = projectPoint(cam, p).pixel;
	return [Math.floor(q[0]), Math.floor(q[1])] as const;
};

test('the z-buffer keeps the nearest surface; without it, the last triangle drawn wins', () => {
	const [i, j] = pixelOf(GLASS_CENTRE);
	const withZ = rasterise(scene, cam, light);
	expect(withZ.ids[j * W + i]).toBe(ID.glass);
	expect(withZ.stats.hidden).toBeGreaterThan(0);
	const noZ = rasterise(scene, cam, light, { ...DEFAULT_RASTER, zbuffer: false });
	// The glass ball still shows, but its far side painted over its near side: the colours differ.
	let differ = 0;
	for (let k = 0; k < W * H; k++) if (noZ.rgba[4 * k] !== withZ.rgba[4 * k]) differ++;
	expect(differ).toBeGreaterThan(500);
	expect(noZ.stats.hidden).toBe(0);
});

test('with no shadows and no bounces, the ray tracer sees what the rasteriser sees, pixel by pixel', () => {
	const r = rasterise(scene, cam, light);
	const t = raytrace(world, cam, light, { ...DEFAULT_TRACE, shadows: false, bounces: 0 });
	let sameId = 0;
	let floorPx = 0;
	let floorClose = 0;
	for (let k = 0; k < W * H; k++) {
		if (r.ids[k] === t.ids[k]) sameId++;
		if (r.ids[k] === ID.floor && t.ids[k] === ID.floor) {
			floorPx++;
			if (Math.abs(r.rgba[4 * k] - t.rgba[4 * k]) <= 2) floorClose++;
		}
	}
	expect(sameId).toBe(W * H);
	// Same textured, shaded floor (perspective-correct texture coordinates = where the ray hits).
	expect(floorClose / floorPx).toBeGreaterThan(0.99);
	// Interpolating the texture coordinates flat across the screen (affine) gets the floor wrong.
	const a = rasterise(scene, cam, light, { ...DEFAULT_RASTER, perspectiveCorrect: false });
	let affineClose = 0;
	for (let k = 0; k < W * H; k++)
		if (a.ids[k] === ID.floor && Math.abs(a.rgba[4 * k] - t.rgba[4 * k]) <= 2) affineClose++;
	expect(affineClose / floorPx).toBeLessThan(0.85);
});

test('a ray tracer sends one ray per pixel and does far more work than a rasteriser', () => {
	const r = rasterise(scene, cam, light);
	const t = raytrace(world, cam, light);
	expect(t.stats.primary).toBe(W * H);
	expect(r.stats.triangles).toBe(654);
	// The rasteriser tests each pixel against only the triangles that cover it…
	expect(r.stats.pixelTests).toBeLessThan(80_000);
	// …the ray tracer tests every ray against all the triangles of every object it might hit.
	expect(t.stats.triangleTests).toBeGreaterThan(10 * r.stats.pixelTests);
});

test('a floor point behind the cube, seen from the light, is in shadow', () => {
	// Follow the line from the light through a point inside the cube (0.2 above its centre) down
	// to the floor.
	const d = normalize([
		CUBE_CENTRE[0] - light[0],
		CUBE_CENTRE[1] + 0.2 - light[1],
		CUBE_CENTRE[2] - light[2]
	]);
	const k = -light[1] / d[1];
	const p: Vec3 = [light[0] + d[0] * k, 0, light[2] + d[2] * k];
	const [i, j] = pixelOf(p);
	const lit = tracePixel(world, cam, light, i, j, { ...DEFAULT_TRACE, shadows: true });
	expect(lit.id).toBe(ID.floor);
	expect(lit.segments.some((s) => s.kind === 'shadow')).toBe(true);
	const on = raytrace(world, cam, light, DEFAULT_TRACE);
	const off = raytrace(world, cam, light, { ...DEFAULT_TRACE, shadows: false });
	expect(on.rgba[4 * (j * W + i)]).toBeLessThan(off.rgba[4 * (j * W + i)] / 2);
});

test('the mirror shows the scene only with one bounce; light gets through the glass with two', () => {
	const pixels = (opts: Partial<typeof DEFAULT_TRACE>, id: number) => {
		const t = raytrace(world, cam, light, { ...DEFAULT_TRACE, ...opts });
		let sum = 0;
		let n = 0;
		for (let k = 0; k < W * H; k++)
			if (t.ids[k] === id) {
				sum += t.rgba[4 * k] + t.rgba[4 * k + 1] + t.rgba[4 * k + 2];
				n++;
			}
		return sum / n / 3;
	};
	// No bounce: the mirror only has its own dim colour; with one it shows the sky and floor.
	expect(pixels({ bounces: 1 }, ID.mirror)).toBeGreaterThan(2 * pixels({ bounces: 0 }, ID.mirror));
	// Light through the glass enters and leaves: two refractions.
	expect(pixels({ bounces: 2 }, ID.glass)).toBeGreaterThan(1.5 * pixels({ bounces: 1 }, ID.glass));
	// The eye ray through the glass ball's middle is bent in, then out.
	const [i, j] = pixelOf(GLASS_CENTRE);
	const path = tracePixel(world, cam, light, i, j, { ...DEFAULT_TRACE, bounces: 2 });
	expect(path.segments.filter((s) => s.kind === 'refract').length).toBeGreaterThanOrEqual(2);
});
