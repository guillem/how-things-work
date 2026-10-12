// Checks the optics model behind the light-optics explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	IMAGE_LENS,
	MATERIALS,
	acceptanceAngle,
	ball,
	block,
	chain,
	concaveLens,
	convexLens,
	criticalAngle,
	dir,
	exitDirection,
	fibre,
	imageDistance,
	mirror,
	polygon,
	prismCorners,
	rainbowAngle,
	reflectance,
	refractAngle,
	speedIn,
	thinLensFocal,
	toDeg,
	trace,
	type RayPath,
	type Vec
} from '../src/routes/light-optics/optics';

const { water, crown, flint, diamond, silica } = MATERIALS;
const angleBetween = (a: Vec, b: Vec) =>
	toDeg(Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))));
/** Where the last leg of a path crosses the line y = 0. */
const axisCrossing = (p: RayPath) => {
	const l = p.legs[p.legs.length - 1];
	const d = exitDirection(p);
	return l.a.x + (-l.a.y / d.y) * d.x;
};

test('published refractive indices at the sodium D line (589 nm)', () => {
	expect(water.n(589.3)).toBeCloseTo(1.333, 3);
	expect(crown.n(587.6)).toBeCloseTo(1.5168, 4); // SCHOTT N-BK7, n_d
	expect(flint.n(587.6)).toBeCloseTo(1.7847, 4); // SCHOTT N-SF11, n_d
	expect(diamond.n(589.3)).toBeCloseTo(2.417, 3);
	expect(silica.n(589.3)).toBeCloseTo(1.458, 3);
	// Normal dispersion: every material bends blue light (486 nm) more than red (656 nm).
	for (const m of [water, crown, flint, diamond, silica])
		expect(m.n(486.1)).toBeGreaterThan(m.n(656.3));
	// Crown glass's Abbe number, (n_d − 1)/(n_F − n_C), is 64.2 in the data sheet; flint's 25.7.
	const abbe = (m: typeof crown) => (m.n(587.6) - 1) / (m.n(486.1) - m.n(656.3));
	expect(abbe(crown)).toBeCloseTo(64.2, 0);
	expect(abbe(flint)).toBeCloseTo(25.7, 0);
});

test('light in glass is a third slower: about 200,000 km/s', () => {
	expect(speedIn(crown.n(589.3)) / 1000).toBeCloseTo(197_700, -3);
	expect(speedIn(water.n(589.3)) / 1000).toBeCloseTo(225_000, -3);
	expect(speedIn(diamond.n(589.3)) / 1000).toBeCloseTo(124_000, -3);
});

test("a traced ray obeys Snell's law at a flat boundary, and the reflection law", () => {
	const glass = block('g', { x: 0, y: 500 }, 4000, 1000, 0, crown.n); // top face at y = 0
	for (const theta of [10, 30, 45, 60, 80]) {
		const d = dir(90 - theta); // heading down, θ from the vertical normal
		const paths = trace([glass], { x: -100 * d.x, y: -100 * d.y }, d, { minPower: 0 });
		const inside = paths[0].legs[1];
		const out = { x: (inside.b.x - inside.a.x) / 1, y: 0 };
		out.x /= Math.hypot(inside.b.x - inside.a.x, inside.b.y - inside.a.y);
		const theta2 = toDeg(Math.asin(out.x));
		expect(Math.sin((theta * Math.PI) / 180)).toBeCloseTo(
			crown.n(589.3) * Math.sin((theta2 * Math.PI) / 180),
			6
		);
		expect(theta2).toBeCloseTo(refractAngle(1, crown.n(589.3), theta)!, 6);
		// The partial reflection leaves at the same angle on the other side of the normal.
		const back = exitDirection(paths[1]);
		expect(back.y).toBeLessThan(0);
		expect(toDeg(Math.asin(back.x))).toBeCloseTo(theta, 6);
	}
	// A mirror at 45° turns a horizontal ray through 90°.
	const m = mirror('m', { x: 0, y: 0 }, 100, 45);
	const p = trace([m], { x: -100, y: 0 }, { x: 1, y: 0 }, { box: [-200, -200, 200, 200] })[0];
	expect(p.events).toEqual(['mirror']);
	expect(exitDirection(p).y).toBeCloseTo(1, 9); // +y is down the screen
});

test('critical angles: glass 41°, water 49°, diamond 24°', () => {
	expect(criticalAngle(crown.n(589.3), 1)).toBeCloseTo(41.2, 1);
	expect(criticalAngle(water.n(589.3), 1)).toBeCloseTo(48.6, 1);
	expect(criticalAngle(diamond.n(589.3), 1)).toBeCloseTo(24.4, 1);
	expect(criticalAngle(1, 1.5)).toBeNull();
	// The tracer agrees: inside glass, just under the critical angle the ray gets out,
	// just over it every bit of the light stays in.
	const glass = block('g', { x: 0, y: 500 }, 4000, 1000, 0, crown.n);
	const up = (theta: number) => dir(-90 + theta);
	const from = { x: 0, y: 400 };
	const under = trace([glass], from, up(41), { box: [-3000, -3000, 3000, 3000] });
	expect(under[0].events[0]).toBe('refract');
	const over = trace([glass], from, up(41.5), { box: [-3000, -3000, 3000, 3000] });
	expect(over[0].events[0]).toBe('tir');
	// Approaching the critical angle, the reflected share climbs to 100%.
	expect(reflectance(crown.n(589.3), 1, 0)).toBeCloseTo(0.042, 3);
	expect(reflectance(crown.n(589.3), 1, 40)).toBeGreaterThan(0.2);
	expect(reflectance(crown.n(589.3), 1, 42)).toBe(1);
	// At Brewster's angle, tan θ = n, none of the p-polarised half is reflected: 7.4% in all.
	expect(reflectance(1, 1.5, toDeg(Math.atan(1.5)))).toBeCloseTo(0.074, 3);
});

test('an optical fibre traps light by total internal reflection, until the bend is too tight', () => {
	// A silica rod in air accepts light from any angle at its flat end: NA = √(n² − 1) > 1.
	expect(acceptanceAngle(silica.n(589.3), 1)).toBe(90);
	// A beam sent in at 20° to the axis of a 40-wide silica rod with a 90° bend: the share
	// of its light that comes out of the far end face.
	const delivered = (bendR: number) => {
		const f = fibre({ x: 0, y: 0 }, 40, 300, bendR, 90, 300, silica.n);
		const end = f.centre[f.centre.length - 1];
		const d = dir(20);
		let power = 0;
		let tir = 0;
		for (const y of [-15, -8, 0, 8, 15]) {
			const paths = trace(f.pieces, { x: -50 * d.x, y: y - 50 * d.y }, d, {
				minPower: 0.01,
				maxLegs: 80
			});
			tir = Math.max(tir, paths[0].events.filter((e) => e === 'tir').length);
			// After the bend the fibre runs up the screen (−y): count the light leaving its end.
			power += paths
				.map((p) => p.legs[p.legs.length - 1])
				.filter((l) => l.a.y <= end.y + 1e-6)
				.reduce((sum, l) => sum + l.power, 0);
		}
		return { tir, power: power / 5 };
	};
	const gentle = delivered(300);
	expect(gentle.tir).toBeGreaterThan(5);
	// All of it but the ~4% reflected back at each end face.
	expect(gentle.power).toBeGreaterThan(0.85);
	// Bent round a radius smaller than its own width, most of the light leaks out.
	expect(delivered(10).power).toBeLessThan(0.5);
});

test('a convex lens focuses parallel light at the lensmaker focal length', () => {
	// Biconvex crown glass, both radii 100 mm: thin-lens f = 1/((n − 1)(2/R)) = 96.7 mm.
	const n = crown.n(587.6);
	const f = thinLensFocal(n, 100, -100);
	expect(f).toBeCloseTo(96.75, 1);
	const lens = convexLens('l', { x: 0, y: 0 }, 100, 20, crown.n);
	const focus = (y: number) =>
		axisCrossing(trace([lens], { x: -200, y }, { x: 1, y: 0 }, { nm: 587.6 })[0]);
	// Rays close to the axis cross it within 2% of the thin-lens focus (the lens is 4 mm thick).
	expect(Math.abs(focus(1) - f) / f).toBeLessThan(0.02);
	// Rays near the rim cross it sooner: spherical aberration.
	expect(focus(18)).toBeLessThan(focus(1) - 3);
	// More strongly bending glass, shorter focal length.
	const flintLens = convexLens('l', { x: 0, y: 0 }, 100, 20, flint.n);
	expect(
		axisCrossing(trace([flintLens], { x: -200, y: 1 }, { x: 1, y: 0 }, { nm: 587.6 })[0])
	).toBeLessThan(focus(1) - 25);
	// A concave lens spreads the beam: the rays leave heading away from the axis.
	const concave = concaveLens('c', { x: 0, y: 0 }, 100, 20, 2, crown.n);
	const p = trace([concave], { x: -200, y: 10 }, { x: 1, y: 0 })[0];
	expect(exitDirection(p).y).toBeGreaterThan(0.04);
	// …as if from a virtual focus about f in front of it.
	expect(axisCrossing(p)).toBeLessThan(-80);
});

test('the thin-lens equation: an object at 2f makes an image at 2f; inside f, a virtual one', () => {
	expect(imageDistance(100, 200)).toBeCloseTo(200, 9);
	expect(imageDistance(100, 150)).toBeCloseTo(300, 9);
	expect(imageDistance(100, 50)).toBeLessThan(0);
});

test("the image step's traced rays meet where the thin-lens equation puts the image", () => {
	const { n, radius, halfHeight, object, fan } = IMAGE_LENS;
	const f = thinLensFocal(n, radius, -radius);
	const lens = convexLens('l', { x: 0, y: 0 }, radius, halfHeight, () => n);
	// Height (+ below the axis) at which each ray from the object's tip, or its backward
	// extension for a virtual image, crosses the image plane x = v.
	const heights = (u: number) => {
		const tip = { x: -u, y: -object };
		const v = imageDistance(f, u);
		return fan.map((h) => {
			const p = trace([lens], tip, { x: u, y: h + object }, { minPower: 0.1 })[0];
			const l = p.legs[p.legs.length - 1];
			const d = exitDirection(p);
			return l.a.y + ((v - l.a.x) / d.x) * d.y;
		});
	};
	// Real images, upside down: the rays meet within 3 units (1.5 mm) of the arrow's tip.
	for (const u of [250, 2 * f, 440]) {
		const tipY = (object * imageDistance(f, u)) / u;
		for (const y of heights(u)) expect(Math.abs(y - tipY)).toBeLessThan(3);
	}
	// Inside f, a virtual image: traced back, the rays seem to come from near its tip.
	const tipY = (object * imageDistance(f, 90)) / 90;
	expect(tipY).toBeLessThan(-object);
	for (const y of heights(90)) expect(Math.abs(y - tipY)).toBeLessThan(10);
});

test('a prism bends blue light more than red: crown glass at minimum deviation', () => {
	const prism = polygon('p', prismCorners({ x: 0, y: 0 }, 50, 0), crown.n);
	const minDeviation = (nm: number) => {
		let best = Infinity;
		for (let a = 20; a < 80; a += 0.02) {
			const d = dir(30 - a);
			const p = trace([prism], { x: -60, y: 5 }, d, { nm })[0];
			if (p.events.length !== 2 || p.events.includes('tir')) continue;
			best = Math.min(best, angleBetween(d, exitDirection(p)));
		}
		return best;
	};
	// D_min = 2·asin(n·sin 30°) − 60°: 38.6° at the D line.
	expect(minDeviation(587.6)).toBeCloseTo(38.65, 1);
	const blue = minDeviation(486.1);
	const red = minDeviation(656.3);
	expect(blue).toBeGreaterThan(red);
	// The spread from red to blue is about 0.7°.
	expect(blue - red).toBeCloseTo(0.71, 1);
});

test('rainbow: a raindrop sends red back at 42° and violet at 40.6°', () => {
	expect(rainbowAngle(water.n(656.3))).toBeCloseTo(42.3, 1);
	expect(rainbowAngle(water.n(404.7))).toBeCloseTo(40.6, 1);
	// Trace light through a drop: enter, reflect once inside (only partly), leave. The
	// largest angle back towards the sun matches Descartes' result.
	const drop = ball('d', { x: 0, y: 0 }, 1, water.n);
	const bow = (nm: number) => {
		let best = { angle: 0, legs: 0, power: 0 };
		for (let y = 0.005; y < 1; y += 0.002) {
			const paths = trace([drop], { x: -3, y }, { x: 1, y: 0 }, { nm, minPower: 0.001 });
			const i = paths.findIndex((p) => p.parent === 0 && p.from === 2);
			if (i < 0) continue;
			const legs = chain(paths, i);
			const e = exitDirection(paths[i]);
			const angle = toDeg(Math.acos(-e.x));
			if (angle > best.angle) best = { angle, legs: legs.length, power: legs[2].power };
		}
		return best;
	};
	for (const nm of [656.3, 404.7]) {
		const b = bow(nm);
		expect(b.angle).toBeCloseTo(rainbowAngle(water.n(nm)), 1);
		expect(b.legs).toBe(4);
		// That inside reflection is partial (not total): only a few per cent of the light.
		expect(b.power).toBeLessThan(0.06);
	}
});

test('light takes longer through glass: optical path is n × distance', () => {
	const glass = block('g', { x: 50, y: 0 }, 100, 100, 0, crown.n);
	const p = trace([glass], { x: -100, y: 0 }, { x: 1, y: 0 }, { box: [-100, -100, 300, 100] })[0];
	const last = p.legs[p.legs.length - 1];
	expect(last.opl).toBeCloseTo(100 + 100 * crown.n(589.3), 6);
});
