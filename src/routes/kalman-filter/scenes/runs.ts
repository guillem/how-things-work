/**
 * The simulated runs the scenes draw, each fixed by its seeds so that a control only rescales
 * the same noise: the plane tracker's drive, the fusion drive, the corner and the long check.
 */
import {
	accelerometer,
	ellipse,
	gpsFixes,
	positionCov,
	positionErrors,
	swerve,
	track,
	wander,
	type Belief,
	type Mat
} from '../model';

/**
 * The plane: 60 s of a car under random acceleration of σ = 0.4 m/s² per axis. The GPS noise
 * seed is one whose single run shows what the model tests find on average: the real error
 * matches the σ the filter reports (within a few per cent at 1, 8 and 40 m).
 */
export const TRACK = { n: 60, sigmaA: 0.4, seed: 171, noiseSeed: 414, start: [0, 0, 5, 0] };
const trackTruth = wander(TRACK.n, TRACK.sigmaA, TRACK.seed, 1, TRACK.start);

export function trackRun(r: number) {
	const fixes = gpsFixes(trackTruth, r, TRACK.noiseSeed);
	const steps = track(trackTruth, fixes, { q: TRACK.sigmaA, r });
	return { truth: trackTruth, fixes, steps, errors: positionErrors(trackTruth, steps) };
}

/** Fusion: 90 s, GPS σ = 8 m, an accelerometer good to 0.05 m/s². */
export const FUSE = { n: 90, sigmaA: 0.4, seed: 27, r: 8, imu: 0.05 };
const fuseTruth = wander(FUSE.n, FUSE.sigmaA, FUSE.seed, 1, [0, 0, 5, 0]);
const fuseAccel = accelerometer(fuseTruth, FUSE.imu, 2701);

/** All three start from a known spot (σ 1 m) at a known velocity (σ 0.2 m/s). */
const fuseStart: Belief = {
	x: fuseTruth.states[0].slice(),
	P: [
		[1, 0, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 0.04, 0],
		[0, 0, 0, 0.04]
	]
};

export function fuseRun(every: number) {
	const fixes = gpsFixes(fuseTruth, FUSE.r, 2702, every);
	const gps = track(fuseTruth, fixes, { q: FUSE.sigmaA, r: FUSE.r, start: fuseStart });
	const dead = track(
		fuseTruth,
		fixes.map(() => null),
		{ q: FUSE.imu, r: FUSE.r, accel: fuseAccel, start: fuseStart }
	);
	const fused = track(fuseTruth, fixes, {
		q: FUSE.imu,
		r: FUSE.r,
		accel: fuseAccel,
		start: fuseStart
	});
	return {
		truth: fuseTruth,
		fixes,
		gps: { steps: gps, errors: positionErrors(fuseTruth, gps) },
		dead: { steps: dead, errors: positionErrors(fuseTruth, dead) },
		fused: { steps: fused, errors: positionErrors(fuseTruth, fused) }
	};
}

/** The corner, with GPS σ = 3 m. */
export const CORNER = { r: 3 };
const cornerTruth = swerve();
const cornerFixes = gpsFixes(cornerTruth, CORNER.r, 81);

export function swerveRun(q: number) {
	const steps = track(cornerTruth, cornerFixes, { q, r: CORNER.r });
	return {
		truth: cornerTruth,
		fixes: cornerFixes,
		steps,
		errors: positionErrors(cornerTruth, steps)
	};
}

/** The check: 200 s of the plane tracker with GPS σ = 5 m. */
export const CHECK = { n: 200, sigmaA: 0.4, seed: 52, r: 5 };
const checkTruth = wander(CHECK.n, CHECK.sigmaA, CHECK.seed, 1, [0, 0, 5, 0]);
const checkFixes = gpsFixes(checkTruth, CHECK.r, 5201);

export function checkRun(ratio: number) {
	const steps = track(checkTruth, checkFixes, { q: CHECK.sigmaA * ratio, r: CHECK.r });
	return { truth: checkTruth, steps, errors: positionErrors(checkTruth, steps) };
}

/** Bounding box of a list of points [x, y, …]. */
export function bounds(points: readonly (readonly number[])[]) {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	return {
		x0: Math.min(...xs),
		x1: Math.max(...xs),
		y0: Math.min(...ys),
		y1: Math.max(...ys)
	};
}

/**
 * A uniform map projection (metres to stage units, y up) fitting a box into a region, centred.
 */
export function fit(
	b: { x0: number; x1: number; y0: number; y1: number },
	region: { x: number; y: number; w: number; h: number },
	pad = 0
) {
	const w = b.x1 - b.x0 + 2 * pad;
	const h = b.y1 - b.y0 + 2 * pad;
	const s = Math.min(region.w / w, region.h / h);
	const cx = (b.x0 + b.x1) / 2;
	const cy = (b.y0 + b.y1) / 2;
	const ox = region.x + region.w / 2;
	const oy = region.y + region.h / 2;
	return {
		s,
		x: (m: number) => ox + (m - cx) * s,
		y: (m: number) => oy - (m - cy) * s
	};
}

/** Linear blend of two beliefs (the morph from one ellipse to the next). */
export function mix(a: Belief, b: Belief, u: number): Belief {
	return {
		x: a.x.map((v, i) => v + (b.x[i] - v) * u),
		P: a.P.map((row, i) => row.map((v, j) => v + (b.P[i][j] - v) * u))
	};
}

/** SVG attributes of the 95 % position ellipse of a belief, at scale s (y up). */
export function ellipseAttrs(P: Mat, cx: number, cy: number, s: number) {
	const e = ellipse(positionCov(P));
	return {
		cx,
		cy,
		rx: Math.max(0.5, e.a * s),
		ry: Math.max(0.5, e.b * s),
		transform: `rotate(${((-e.angle * 180) / Math.PI).toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})`
	};
}

export const fmt = (v: number, d = 1) => v.toFixed(d);

/**
 * SVG attributes of the 95 % ellipse of any 2 × 2 covariance drawn with separate scales on the
 * two axes (stage units per unit of each; the second axis drawn upwards).
 */
export function covEllipseAttrs(C: Mat, cx: number, cy: number, sx: number, sy: number) {
	const D: Mat = [
		[C[0][0] * sx * sx, C[0][1] * sx * sy],
		[C[1][0] * sx * sy, C[1][1] * sy * sy]
	];
	const e = ellipse(D);
	return {
		cx,
		cy,
		rx: Math.max(0.5, e.a),
		ry: Math.max(0.5, e.b),
		transform: `rotate(${((-e.angle * 180) / Math.PI).toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})`
	};
}

/** The covariance of position and velocity along x: state entries 0 and 2. */
export const xvCov = (P: Mat): Mat => [
	[P[0][0], P[0][2]],
	[P[2][0], P[2][2]]
];
