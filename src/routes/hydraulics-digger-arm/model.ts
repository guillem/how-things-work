/**
 * Hydraulics: a small piston and a big one joined by a pipe full of oil, and the three cylinders of a
 * digger's arm.
 *
 * The press. Oil is trapped between the two pistons, so the push on every square centimetre of it is
 * the same (Pascal's principle): the big piston, with n times the area, gets n times the push and
 * moves 1/n as far. The oil itself squashes a little (a bulk modulus of about 1.6 GPa, typical of
 * mineral hydraulic oil); a bubble of air in the pipe squashes a lot (Boyle's law, at constant
 * temperature): the hand's piston then has to squash the bubble until its pressure can hold the
 * load before the big piston moves at all, which is what a spongy brake pedal is.
 *
 * The digger. A 20-tonne excavator's arm drawn from the side: boom, arm (the "stick") and bucket,
 * each swung by one cylinder. The scoop is a sequence of six moves, each made by one cylinder alone.
 * The geometry is a plausible simplification (straight boom, the bucket cylinder pinned straight to
 * the bucket instead of through its linkage); the cylinder size and oil pressure are real: 120 mm
 * boom cylinders on a Komatsu PC200, a 34.3 MPa main relief valve on a Caterpillar 320C.
 *
 * Units: metres, kilograms, pascals inside; the scenes turn them into centimetres and kilograms of
 * push ("a push as strong as lifting 20 kg").
 */

export const G = 9.81;
/** Air pressure around us, Pa. */
export const ATM = 101_325;
/** How hard oil is to squash (its bulk modulus), Pa: 1.5 to 1.7 GPa for mineral hydraulic oil. */
export const OIL_STIFFNESS = 1.6e9;

/** The hand's piston: 2 cm across, pushed up to 30 cm, with a push as strong as lifting 20 kg. */
export const HAND = { width: 0.02, stroke: 0.3, pushKg: 20 };
/** Oil in the pipe and under the pistons, m³ (half a litre). */
export const OIL_VOLUME = 0.5e-3;

/** Things to lift, kg. */
export const LOADS = { crate: 100, car: 1200, boulder: 3000 } as const;

export const area = (width: number) => (Math.PI * width * width) / 4;

/** How many times the big piston's area is the small one's (and so how many times the push). */
export const ratio = (bigWidth: number, smallWidth = HAND.width) =>
	area(bigWidth) / area(smallWidth);

/** The widest big piston that the hand's push can still lift `kg` with, m. */
export const widthToLift = (kg: number, pushKg = HAND.pushKg, smallWidth = HAND.width) =>
	smallWidth * Math.sqrt(kg / pushKg);

export interface PressInput {
	/** Width of the big piston, m. */
	big: number;
	/** How far the hand has pushed its piston, m. */
	push: number;
	/** Mass resting on the big piston, kg (0 for none). */
	loadKg?: number;
	/** Air trapped in the pipe, m³ measured at ordinary air pressure. */
	air?: number;
	/** Width of the hand's piston, m. */
	small?: number;
}

export interface PressState {
	/** Times the big piston's area is the small one's. */
	ratio: number;
	/** Oil pressure needed to hold the load up, Pa above the air around. */
	holdPressure: number;
	/** Oil pressure now, Pa above the air around. */
	pressure: number;
	/** The hand's push now, as kg it could lift. */
	handKg: number;
	/** How far the big piston has risen, m. */
	rise: number;
	/** Hand travel spent squashing air (and oil) before the big piston moved, m. */
	wasted: number;
	/** The air bubble's volume now, m³. */
	bubble: number;
	/** The big piston's push, as kg. */
	bigKg: number;
	/** Work done by the hand and on the load, J. */
	workIn: number;
	workOut: number;
}

/**
 * The press after the hand has pushed `push` metres. Before the oil's pressure reaches what the load
 * needs, the pushed oil only squashes the air bubble (and, very slightly, the oil); after that, all
 * further oil goes under the big piston.
 */
export function press({
	big,
	push,
	loadKg = 0,
	air = 0,
	small = HAND.width
}: PressInput): PressState {
	const a = area(small);
	const A = area(big);
	const n = A / a;
	const hold = (loadKg * G) / A;
	// Volume squeezed out of the air and oil by the time the pressure reaches p.
	const squeezed = (p: number) => air * (1 - ATM / (ATM + p)) + (OIL_VOLUME * p) / OIL_STIFFNESS;
	const wasted = squeezed(hold) / a;
	let pressure: number;
	let rise: number;
	if (push <= wasted) {
		rise = 0;
		pressure = pressureAfter(push * a, air);
	} else {
		pressure = hold;
		rise = ((push - wasted) * a) / A;
	}
	// Work: the hand's push integrated over its travel. The squeeze is exact for air (Boyle) and
	// linear for oil; sampled numerically, which is plenty.
	const N = 400;
	let workIn = 0;
	for (let i = 0; i < N; i++) {
		const s = (push * (i + 0.5)) / N;
		const p = s <= wasted ? pressureAfter(s * a, air) : hold;
		workIn += p * a * (push / N);
	}
	return {
		ratio: n,
		holdPressure: hold,
		pressure,
		handKg: (pressure * a) / G,
		rise,
		wasted: Math.min(push, wasted),
		bubble: (air * ATM) / (ATM + pressure),
		bigKg: (pressure * A) / G,
		workIn,
		workOut: loadKg * G * rise
	};
}

/** The pressure once `v` m³ of oil has been pushed into a closed pipe holding `air` m³ of air. */
function pressureAfter(v: number, air: number): number {
	// Solve air (1 - ATM / (ATM + p)) + OIL_VOLUME p / K = v for p by bisection.
	let lo = 0;
	let hi = 1e9;
	for (let i = 0; i < 80; i++) {
		const p = (lo + hi) / 2;
		const s = air * (1 - ATM / (ATM + p)) + (OIL_VOLUME * p) / OIL_STIFFNESS;
		if (s < v) lo = p;
		else hi = p;
	}
	return (lo + hi) / 2;
}

/** How much smaller oil gets at pressure p (a fraction): oil hardly squashes at all. */
export const oilShrink = (p: number) => p / OIL_STIFFNESS;
/** How much smaller air gets at pressure p (a fraction). */
export const airShrink = (p: number) => 1 - ATM / (ATM + p);

// ---- the digger --------------------------------------------------------------------------------------

/** A 20-tonne digger's oil pressure (main relief valve, Caterpillar 320C), Pa: 343 bar. */
export const DIGGER_PRESSURE = 34.3e6;
/** Its boom cylinders are 12 cm across inside (Komatsu PC200), and there are two of them. */
export const BOOM_BORE = 0.12;
export const BOOM_CYLINDERS = 2;
export const DIGGER_MASS = 20_000;

/** How hard one boom cylinder can push, as kg it could lift. */
export const cylinderPushKg = (bore = BOOM_BORE, pressure = DIGGER_PRESSURE) =>
	(area(bore) * pressure) / G;

export interface Point {
	x: number;
	y: number;
}

/** The arm's lengths and pins, m, with the ground at y = 0 and x pointing towards the digging. */
export const ARM = {
	/** The boom's pivot on the digger's body. */
	pivot: { x: 0.6, y: 2.0 },
	boom: 5.7,
	arm: 2.9,
	bucket: 1.4,
	/** Where the boom cylinder's bottom end is pinned on the body. */
	boomBase: { x: 1.2, y: 0.9 }
};

export type CylinderName = 'boom' | 'arm' | 'bucket';
export const CYLINDERS: CylinderName[] = ['boom', 'arm', 'bucket'];

/** Angles in degrees: the boom from level, the arm from the boom's line, the bucket from the arm's. */
export interface Pose {
	boom: number;
	arm: number;
	bucket: number;
}

/**
 * The scoop: where each move ends, and which cylinder makes it. Each move turns exactly one joint,
 * so exactly one cylinder changes length.
 */
export const SCOOP: { pose: Pose; by: CylinderName | null; what: string }[] = [
	{ pose: { boom: 30, arm: -100, bucket: -40 }, by: null, what: 'ready' },
	{ pose: { boom: 30, arm: -35, bucket: -40 }, by: 'arm', what: 'reach out' },
	{ pose: { boom: 4, arm: -35, bucket: -40 }, by: 'boom', what: 'lower into the ground' },
	{ pose: { boom: 4, arm: -82, bucket: -40 }, by: 'arm', what: 'drag through the dirt' },
	{ pose: { boom: 4, arm: -82, bucket: -125 }, by: 'bucket', what: 'curl the bucket: scoop' },
	{ pose: { boom: 45, arm: -82, bucket: -125 }, by: 'boom', what: 'lift' },
	{ pose: { boom: 45, arm: -82, bucket: 15 }, by: 'bucket', what: 'open the bucket: dump' }
];

const smoothstep01 = (u: number) => u * u * (3 - 2 * u);

/** The pose at `u` from 0 (ready) to 1 (dumped), and the move in progress. */
export function scoopAt(u: number): { pose: Pose; move: number; within: number } {
	const moves = SCOOP.length - 1;
	const x = Math.max(0, Math.min(1, u)) * moves;
	const move = Math.min(moves - 1, Math.floor(x));
	const within = x - move;
	const a = SCOOP[move].pose;
	const b = SCOOP[move + 1].pose;
	const e = smoothstep01(within);
	const mix = (k: keyof Pose) => a[k] + (b[k] - a[k]) * e;
	return {
		pose: { boom: mix('boom'), arm: mix('arm'), bucket: mix('bucket') },
		move: move + 1,
		within
	};
}

const rad = (d: number) => (d * Math.PI) / 180;
const add = (p: Point, len: number, angle: number, side = 0): Point => ({
	x: p.x + len * Math.cos(rad(angle)) - side * Math.sin(rad(angle)),
	y: p.y + len * Math.sin(rad(angle)) + side * Math.cos(rad(angle))
});
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export interface ArmGeometry {
	pivot: Point;
	/** Boom tip (the arm's pivot), arm tip (the bucket's pivot), bucket's teeth. */
	boomTip: Point;
	armTip: Point;
	teeth: Point;
	/** The arm's short tail behind its pivot, where the arm cylinder pulls. */
	armTail: Point;
	/** Bucket's back corner, for drawing. */
	bucketBack: Point;
	/** Each cylinder's two pins. */
	cylinders: Record<CylinderName, [Point, Point]>;
}

/** Where everything is for a pose. */
export function geometry(p: Pose): ArmGeometry {
	const a1 = p.boom;
	const a2 = a1 + p.arm;
	const a3 = a2 + p.bucket;
	const pivot = ARM.pivot;
	const boomTip = add(pivot, ARM.boom, a1);
	const armTip = add(boomTip, ARM.arm, a2);
	const teeth = add(armTip, ARM.bucket, a3);
	const bucketBack = add(armTip, 0.8, a3, 0.75);
	const armTail = add(boomTip, -0.75, a2, 0.25);
	return {
		pivot,
		boomTip,
		armTip,
		teeth,
		armTail,
		bucketBack,
		cylinders: {
			boom: [ARM.boomBase, add(pivot, 2.5, a1, -0.45)],
			arm: [add(pivot, 2.9, a1, 0.55), armTail],
			bucket: [add(boomTip, 0.55, a2, 0.3), add(armTip, -0.35, a3, 0.3)]
		}
	};
}

/** Each cylinder's length (pin to pin), m. */
export function cylinderLengths(p: Pose): Record<CylinderName, number> {
	const g = geometry(p);
	return {
		boom: dist(...g.cylinders.boom),
		arm: dist(...g.cylinders.arm),
		bucket: dist(...g.cylinders.bucket)
	};
}
