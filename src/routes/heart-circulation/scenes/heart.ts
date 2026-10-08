/**
 * Shared helpers for the heart scenes: settings from the controls, the beat
 * clock, and the geometry of the heart drawing (local 460 × 480 box,
 * anatomical view: the heart's right side on the viewer's left).
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { NORMAL, sampleAt, type Beat, type Flow, type Settings } from '../circulation';

/** Settings for a step: each control only acts on the steps that offer it. */
export function settingsFor(step: Step, params: Params): Settings {
	const ids = new Set((step.controls ?? []).map((c) => c.id));
	const num = (id: string, fallback: number) => {
		const v = Number(params[id]);
		return ids.has(id) && Number.isFinite(v) ? v : fallback;
	};
	return {
		hr: Math.round(num('hr', NORMAL.hr)),
		width: num('width', 100) / 100,
		valve: ids.has('valve') && params.valve === 'aortic' ? 'aortic' : 'mitral',
		leak: Math.round(num('leak', 0) * 100) / 100
	};
}

/**
 * Beat clock: the number of beats since the scene started, integrated from
 * the heart rate frame by frame so that a change of rate does not make the
 * heart jump to another moment of its beat (the scene guide's sanctioned
 * accumulator: it ignores dt ≤ 0 and big jumps).
 */
export function beatClock() {
	let last = 0;
	let beats = 0;
	return (t: number, rr: number) => {
		const dt = t - last;
		last = t;
		if (dt > 0 && dt < 0.25) beats += dt / rr;
		return beats;
	};
}

/** Time (s) into the beat for a beat count. */
export const tauOf = (beat: Beat, beats: number) => (beats - Math.floor(beats)) * beat.timing.rr;

/** Volume (mL) passed through a flow since the start, for a beat count: drives the flow dashes. */
export function passedAt(beat: Beat, flow: Flow, beats: number) {
	const series = beat.passed[flow];
	const perBeat = series[series.length - 1];
	const { i, f } = sampleAt(beat, tauOf(beat, beats));
	return Math.floor(beats) * perBeat + series[i] + (series[i + 1] - series[i]) * f;
}

/** Linear interpolation of a sampled series at a beat count. */
export function at(beat: Beat, series: Float64Array, beats: number) {
	const { i, f } = sampleAt(beat, tauOf(beat, beats));
	return series[i] + (series[i + 1] - series[i]) * f;
}

// ------------------------------------------------------------ heart geometry

export const VP = 250; // the valve plane: atria above, ventricles below
export const HEART_W = 460;
export const HEART_H = 480;

/** Reference (full) volumes in mL of the healthy resting heart, for drawing scales. */
export const REF = { ra: 61, rv: 126, la: 76, lv: 127 };

/** Drawing scale of a chamber for its volume (exaggerated a little, clamped). */
export const sizeOf = (v: number, ref: number) => Math.min(1.25, Math.max(0.45, (v / ref) ** 0.45));

/**
 * Cavity of a ventricle: its top on the valve plane from the septum (x `xs`)
 * outwards (`dir` −1 to the left, +1 to the right), its apex below.
 */
export function ventriclePath(xs: number, dir: number, w: number, depth: number, s: number) {
	const sx = 0.82 + 0.18 * s;
	const ox = xs + dir * w * sx;
	const ry = depth * s;
	const ax = xs + dir * w * 0.3 * sx;
	const ay = VP + ry;
	return (
		`M${xs} ${VP} L${ox.toFixed(1)} ${VP}` +
		` C${ox.toFixed(1)} ${(VP + 0.6 * ry).toFixed(1)} ${(ax + dir * 0.42 * w * sx).toFixed(1)} ${ay.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}` +
		` C${(ax - dir * 0.16 * w * sx).toFixed(1)} ${ay.toFixed(1)} ${xs} ${(VP + 0.62 * ry).toFixed(1)} ${xs} ${VP} Z`
	);
}

/** Cavity of an atrium: a dome standing on the valve plane. */
export function atriumPath(cx: number, w: number, h: number, s: number) {
	const half = (w / 2) * (0.85 + 0.15 * s);
	const top = VP - h * s;
	return (
		`M${(cx - half).toFixed(1)} ${VP}` +
		` C${(cx - half * 1.08).toFixed(1)} ${(top + 0.1 * h).toFixed(1)} ${(cx - half * 0.55).toFixed(1)} ${top.toFixed(1)} ${cx} ${top.toFixed(1)}` +
		` C${(cx + half * 0.55).toFixed(1)} ${top.toFixed(1)} ${(cx + half * 1.08).toFixed(1)} ${(top + 0.1 * h).toFixed(1)} ${(cx + half).toFixed(1)} ${VP} Z`
	);
}

export const CH = {
	ra: { cx: 108, w: 118, h: 78 },
	la: { cx: 340, w: 112, h: 70 },
	rv: { xs: 214, w: 168, depth: 158 },
	lv: { xs: 230, w: 172, depth: 190 }
};

/** Valve openings: centre and half-width; inlet valves lie on the valve plane, outlets in the tubes. */
export const VALVES = {
	tricuspid: { x: 112, y: VP, half: 30, dir: 1 }, // opens downwards (+y)
	mitral: { x: 336, y: VP, half: 30, dir: 1 },
	pulmonary: { x: 194, y: 200, half: 14, dir: -1 }, // opens upwards (−y)
	aortic: { x: 252, y: 200, half: 15, dir: -1 }
} as const;

/** Vessel centre lines (local coordinates), drawn as tubes. */
export const VESSELS = {
	svc: { d: 'M95 34 L95 196', w: 24 },
	ivc: { d: 'M30 466 L30 330 C30 280 44 250 66 236', w: 24 },
	pa: { d: `M194 ${VP + 12} L194 40`, w: 28 },
	aorta: {
		d: `M252 ${VP + 12} L252 96 C252 40 300 34 340 34 C392 34 418 62 418 110 L418 138`,
		w: 30
	},
	pv1: { d: 'M452 206 L380 212', w: 14 },
	pv2: { d: 'M452 236 L384 236', w: 14 }
};

/** The electrical system: sinoatrial node, AV node, and the paths over the atria. */
export const NODES = { sa: { x: 116, y: 186 }, av: { x: 210, y: 238 } };
export const CONDUCTION = {
	atria: 'M116 186 C150 196 176 214 210 238',
	atriaLeft: 'M116 186 C190 150 270 170 330 196'
};

const bez = (a: number, b: number, c: number, d: number, t: number) =>
	(1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;

/**
 * The bundle branch and its fibres in one ventricle, following the cavity's
 * edge (the middle of the wall) as it is now: down the septum from depth
 * `from`, round the apex and up the outer wall. Same curves as `ventriclePath`.
 */
export function fibres(xs: number, dir: number, w: number, depth: number, s: number, from: number) {
	const sx = 0.82 + 0.18 * s;
	const ox = xs + dir * w * sx;
	const ry = depth * s;
	const ax = xs + dir * w * 0.3 * sx;
	const ay = VP + ry;
	const pts: string[] = [`${xs - dir * 8} ${from.toFixed(1)}`];
	const n = 16;
	// Septum side, from the top down to the apex.
	for (let i = n; i >= 0; i--) {
		const t = i / n;
		const x = bez(ax, ax - dir * 0.16 * w * sx, xs, xs, t);
		const y = bez(ay, ay, VP + 0.62 * ry, VP, t);
		if (y > from) pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	// Outer side, from the apex up to near the top.
	for (let i = n; i >= 0; i--) {
		const t = i / n;
		const x = bez(ox, ox, ax + dir * 0.42 * w * sx, ax, t);
		const y = bez(VP, VP + 0.6 * ry, ay, ay, t);
		if (y > VP + 0.3 * ry) pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
	}
	return 'M' + pts.join(' L');
}

/** Where the names of the parts point to (local coordinates). */
export const ANCHORS = {
	ra: { x: 96, y: 214 },
	la: { x: 346, y: 220 },
	rv: { x: 120, y: 320 },
	lv: { x: 316, y: 330 },
	septum: { x: 222, y: 330 },
	svc: { x: 95, y: 34 },
	ivc: { x: 30, y: 466 },
	pa: { x: 194, y: 40 },
	aorta: { x: 418, y: 138 },
	pv: { x: 452, y: 221 }
};

/** One cell of a readout card. */
export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
}
