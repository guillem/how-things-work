/**
 * Everything the wing drawings need from the ideal-flow model, computed once per change
 * of shape or angle (never per frame): streamlines, the outline, surface pressures and
 * the pressure map binned into a few filled paths.
 */
import {
	DEG,
	flow,
	outline,
	pressureCells,
	section,
	streamline,
	surfacePressure,
	zeroLiftAngle,
	type Cx,
	type Flow,
	type Section,
	type Streamline,
	type SurfacePoint
} from '../aero.ts';
import { LADSON } from '../naca0012.ts';

/** Angle of the NACA 0012's greatest lift (80-grit run), used as the stall angle. */
export const STALL_ANGLE = LADSON[0].rows.reduce((a, b) => (b[1] > a[1] ? b : a))[0] * DEG;

/** Streamline offsets ψ − ψ(surface): a close pair, then evenly spaced lines. */
export const OFFSETS = [0.12, ...Array.from({ length: 7 }, (_, j) => 0.4 + 0.36 * j)].flatMap(
	(d) => [d, -d]
);

export interface Field {
	sec: Section;
	f: Flow;
	streams: Streamline[];
	outline: Cx[];
	surface: SurfacePoint[];
	/** 0 for attached flow, 1 when stalled (the angle beyond the stall angle). */
	stall: number;
}

const smooth = (a: number, b: number, x: number) => {
	const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return u * u * (3 - 2 * u);
};

const cache = new Map<string, Section>();
function cachedSection(thickness: number, camber: number) {
	const key = `${thickness}:${camber}`;
	let s = cache.get(key);
	if (!s) {
		s = section(thickness, camber);
		cache.set(key, s);
	}
	return s;
}

export function field(thickness: number, camber: number, alpha: number, offsets = OFFSETS): Field {
	const sec = cachedSection(thickness, camber);
	const f = flow(sec, alpha);
	const beyond = alpha - zeroLiftAngle(sec);
	return {
		sec,
		f,
		streams: offsets.map((d) => streamline(f, d, -8, 7, 0.025)),
		outline: outline(f, 96),
		surface: surfacePressure(f, 30),
		stall: smooth(STALL_ANGLE - 0.5 * DEG, STALL_ANGLE + 0.5 * DEG, beyond)
	};
}

/** Pressure-coefficient bands: [low, high, opacity, suction?]. */
export const BANDS: readonly (readonly [number, number, number, boolean])[] = [
	[-99, -2, 0.62, true],
	[-2, -1.4, 0.52, true],
	[-1.4, -1, 0.43, true],
	[-1, -0.7, 0.35, true],
	[-0.7, -0.45, 0.27, true],
	[-0.45, -0.25, 0.19, true],
	[-0.25, -0.1, 0.11, true],
	[0.1, 0.25, 0.12, false],
	[0.25, 0.45, 0.2, false],
	[0.45, 0.7, 0.3, false],
	[0.7, 9, 0.42, false]
];

/** The pressure map as one path per band, in screen coordinates. */
export function pressureBands(f: Flow, toScreen: (p: Cx) => readonly [number, number]) {
	const paths = BANDS.map(() => '');
	const out: string[] = [...paths];
	const band = (cp: number) => BANDS.findIndex(([lo, hi]) => cp >= lo && cp < hi);
	for (const c of pressureCells(f, band)) {
		const i = band(c.cp);
		if (i < 0) continue;
		const q = c.quad.map(toScreen);
		out[i] +=
			`M${q[0][0].toFixed(1)} ${q[0][1].toFixed(1)}` +
			`L${q[1][0].toFixed(1)} ${q[1][1].toFixed(1)}` +
			`L${q[2][0].toFixed(1)} ${q[2][1].toFixed(1)}` +
			`L${q[3][0].toFixed(1)} ${q[3][1].toFixed(1)}Z`;
	}
	return out.map((d, i) => ({ d, opacity: BANDS[i][2], low: BANDS[i][3], key: i }));
}
