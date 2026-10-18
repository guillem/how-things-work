/**
 * Wind-turbine aerodynamics: actuator-disc momentum theory and blade-element momentum (BEM)
 * theory on the NREL 5-MW reference turbine.
 *
 * Actuator disc (Rankine, Froude, Betz 1920): the rotor is a thin disc that takes energy out of
 * a stream tube. With the axial induction factor a, the air passes the disc at (1 − a)V and
 * leaves far downstream at (1 − 2a)V; mass conservation widens the tube. Then the thrust
 * coefficient is CT = 4a(1 − a) and the power coefficient CP = 4a(1 − a)², which peaks at
 * 16/27 for a = 1/3 (Hansen, Aerodynamics of Wind Turbines, 3rd ed. 2015, ch. 4; Burton et al.,
 * Wind Energy Handbook, 2nd ed. 2011, §3.2).
 *
 * BEM (Glauert 1935): each annulus of the rotor obeys momentum theory, with the forces given by
 * the blade sections' lift and drag at their local angle of attack. Solved with Ning's (2014)
 * one-variable residual in the inflow angle φ, which always has a bracketed root ("A simple
 * solution method for the blade element momentum equations with guaranteed convergence",
 * Wind Energy 17:1327), with Prandtl's tip and hub losses and Buhl's (2005, NREL/TP-500-36834)
 * form of the Glauert correction above a = 0.4, as in NREL's AeroDyn and CCBlade.
 *
 * Turbine: NREL 5-MW reference (Jonkman et al. 2009, NREL/TP-500-38060): three blades, rotor
 * radius 63 m, hub radius 1.5 m, rated 5 MW electrical at 11.4 m/s and 12.1 rpm, cut-in 3 m/s,
 * cut-out 25 m/s, generator and drivetrain efficiency 94.4 %, optimal tip-speed ratio 7.55.
 */

import { AIRFOILS, BLADE, type PolarRow } from './nrel5mw.ts';

export const BETZ = 16 / 27;
export const RHO = 1.225;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- actuator disc

export interface Disc {
	a: number;
	/** Power and thrust coefficients. */
	cp: number;
	ct: number;
	/** Speeds as fractions of the wind speed V: at the disc, and far downstream. */
	uDisc: number;
	uWake: number;
	/** Cross-section of the stream tube as fractions of the disc area: far upstream and far downstream. */
	areaUp: number;
	areaWake: number;
}

/** Momentum theory for an actuator disc with axial induction factor a (0 ≤ a < 1/2). */
export function disc(a: number): Disc {
	const uDisc = 1 - a;
	const uWake = 1 - 2 * a;
	return {
		a,
		cp: 4 * a * (1 - a) ** 2,
		ct: 4 * a * (1 - a),
		uDisc,
		uWake,
		areaUp: uDisc,
		areaWake: uWake > 0 ? uDisc / uWake : Infinity
	};
}

/**
 * Thrust coefficient measured on rotors in the turbulent-wake state, as Buhl's (2005) form of
 * Glauert's empirical correction: equal to momentum theory's 4aF(1 − a) up to a = 0.4 and
 * joined to it smoothly, reaching 2 at a = 1 (with F = 1).
 */
export function thrustCorrected(a: number, F = 1): number {
	if (a <= 0.4) return 4 * a * F * (1 - a);
	return 8 / 9 + (4 * F - 40 / 9) * a + (50 / 9 - 4 * F) * a * a;
}

/** Power in the wind through an area A (m²) at speed v (m/s), in watts: ½ρAv³. */
export const windPower = (area: number, v: number) => 0.5 * RHO * area * v ** 3;

// ---------------------------------------------------------------- the reference turbine

export const TURBINE = {
	blades: 3,
	radius: 63,
	hubRadius: 1.5,
	/** Rated electrical power (W). */
	rated: 5e6,
	/** Generator and drivetrain efficiency (Jonkman et al. 2009, §5.1). */
	efficiency: 0.944,
	cutIn: 3,
	cutOut: 25,
	/** Rated wind speed (m/s) in Jonkman et al. (2009). */
	ratedWind: 11.4,
	/** Rotor speeds (rpm): rated, and the lowest the controller allows. */
	rpmRated: 12.1,
	rpmMin: 6.9,
	/** Tip-speed ratio the variable-speed controller holds below rated (Jonkman et al. 2009). */
	lambdaOpt: 7.55
} as const;

export const ROTOR_AREA = Math.PI * TURBINE.radius ** 2;

/** Lift and drag coefficients of a section at angle of attack α (deg), linear in α. */
export function polar(af: number, alphaDeg: number): { cl: number; cd: number } {
	const rows: readonly PolarRow[] = AIRFOILS[af].rows;
	let al = ((((alphaDeg + 180) % 360) + 360) % 360) - 180;
	if (al < rows[0][0]) al = rows[0][0];
	let lo = 0;
	let hi = rows.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (rows[mid][0] <= al) lo = mid;
		else hi = mid;
	}
	const [a0, l0, d0] = rows[lo];
	const [a1, l1, d1] = rows[hi];
	const u = a1 === a0 ? 0 : (al - a0) / (a1 - a0);
	return { cl: l0 + (l1 - l0) * u, cd: d0 + (d1 - d0) * u };
}

/**
 * Angle of attack (deg) at which a section's lift is largest between −5° and 25°: where it
 * stalls. NaN for a section with no such peak: the root cylinders, which make no lift, and the
 * 40 %-thick DU40, whose table (corrected for rotational stall delay) keeps rising past 25°.
 */
export function stallAngle(af: number): number {
	let best = Number.NaN;
	let top = -Infinity;
	for (let al = -5; al <= 25; al += 0.25) {
		const { cl } = polar(af, al);
		if (cl > top + 1e-9) {
			top = cl;
			best = al;
		}
	}
	return top < 0.5 || best >= 25 ? Number.NaN : best;
}

/**
 * Angle of attack (deg) at which a section's lift is most negative between −25° and 0°: where it
 * stalls with the flow hitting its upper side. NaN for a section with no such trough.
 */
export function negativeStallAngle(af: number): number {
	let best = Number.NaN;
	let low = Infinity;
	for (let al = 0; al >= -25; al -= 0.25) {
		const { cl } = polar(af, al);
		if (cl < low - 1e-9) {
			low = cl;
			best = al;
		}
	}
	return low > -0.3 || best <= -25 ? Number.NaN : best;
}

/** Whether angle of attack α (deg) is past either of a section's stall angles. */
export function isStalled(af: number, alphaDeg: number): boolean {
	const pos = stallAngle(af);
	const neg = negativeStallAngle(af);
	return (Number.isFinite(pos) && alphaDeg > pos) || (Number.isFinite(neg) && alphaDeg < neg);
}

// ---------------------------------------------------------------- blade-element momentum

export interface BemOptions {
	/** Prandtl tip and hub losses (default on). */
	tipLoss?: boolean;
	/** Buhl's high-induction correction above a = 0.4 (default on). */
	highInduction?: boolean;
	/** Include drag in the induction (default on, as in AeroDyn). */
	drag?: boolean;
}

export interface Element {
	/** Radius (m) and its share of the blade (m). */
	r: number;
	dr: number;
	chord: number;
	twist: number;
	af: number;
	/** Inflow angle φ and angle of attack α (deg). */
	phi: number;
	alpha: number;
	/** Axial and tangential induction factors, and the Prandtl loss factor. */
	a: number;
	ap: number;
	F: number;
	cl: number;
	cd: number;
	/**
	 * Loads per metre of one blade at V = 1 m/s and ρ = 1: normal (thrust) and tangential
	 * (torque) force, ½·W²·c·Cn and ½·W²·c·Ct; scale by ρV² for real forces.
	 */
	fn: number;
	ft: number;
}

export interface Bem {
	lambda: number;
	pitch: number;
	elements: Element[];
	cp: number;
	ct: number;
}

function inductions(
	el: { r: number; chord: number; af: number },
	phi: number,
	theta: number,
	lr: number,
	o: Required<BemOptions>
) {
	const { blades: B, radius: R, hubRadius: Rh } = TURBINE;
	const s = Math.sin(phi);
	const c = Math.cos(phi);
	const alpha = (phi - theta) / DEG;
	const { cl, cd: cd0 } = polar(el.af, alpha);
	const cd = o.drag ? cd0 : 0;
	const cn = cl * c + cd * s;
	const ctan = cl * s - cd * c;
	let F = 1;
	if (o.tipLoss) {
		const ftip =
			(2 / Math.PI) * Math.acos(Math.exp((-B / 2) * ((R - el.r) / (el.r * Math.abs(s)))));
		const fhub = (2 / Math.PI) * Math.acos(Math.exp((-B / 2) * ((el.r - Rh) / (Rh * Math.abs(s)))));
		F = Math.max(1e-6, ftip * fhub);
	}
	const sigma = (B * el.chord) / (2 * Math.PI * el.r);
	const k = (sigma * cn) / (4 * F * s * s);
	const kp = (sigma * ctan) / (4 * F * s * c);
	let a: number;
	if (phi > 0) {
		if (k <= 2 / 3 || !o.highInduction) a = k / (1 + k);
		else {
			const g1 = 2 * F * k - (10 / 9 - F);
			const g2 = Math.max(0, 2 * F * k - F * (4 / 3 - F));
			const g3 = 2 * F * k - (25 / 9 - 2 * F);
			a = Math.abs(g3) < 1e-6 ? 1 - 1 / (2 * Math.sqrt(g2)) : (g1 - Math.sqrt(g2)) / g3;
		}
	} else a = k > 1 ? k / (k - 1) : 0;
	const ap = kp / (1 - kp);
	const residual = phi > 0 ? s / (1 - a) - c / (lr * (1 + ap)) : s * (1 - k) - (c / lr) * (1 - kp);
	return { residual, a, ap, F, alpha, cl, cd, cn, ctan };
}

/** BEM solution of the whole rotor at tip-speed ratio λ and blade pitch (deg, toward feather). */
export function bem(lambda: number, pitchDeg: number, options: BemOptions = {}): Bem {
	const o: Required<BemOptions> = {
		tipLoss: options.tipLoss ?? true,
		highInduction: options.highInduction ?? true,
		drag: options.drag ?? true
	};
	const { blades: B, radius: R } = TURBINE;
	const omega = lambda / R; // rad/s at V = 1
	const elements: Element[] = [];
	let torque = 0;
	let thrust = 0;
	for (const node of BLADE) {
		const theta = (node.twist + pitchDeg) * DEG;
		const lr = (lambda * node.r) / R;
		const f = (p: number) => inductions(node, p, theta, lr, o).residual;
		const eps = 1e-6;
		let lo = eps;
		let hi = Math.PI / 2;
		if (f(lo) * f(hi) > 0) {
			if (f(-Math.PI / 4) < 0 && f(-eps) > 0) {
				lo = -Math.PI / 4;
				hi = -eps;
			} else {
				lo = Math.PI / 2;
				hi = Math.PI - eps;
			}
		}
		let flo = f(lo);
		for (let i = 0; i < 80; i++) {
			const mid = (lo + hi) / 2;
			const fm = f(mid);
			if (fm * flo <= 0) hi = mid;
			else {
				lo = mid;
				flo = fm;
			}
		}
		const phi = (lo + hi) / 2;
		const r = inductions(node, phi, theta, lr, o);
		const w2 = (1 - r.a) ** 2 + (omega * node.r * (1 + r.ap)) ** 2;
		const fn = 0.5 * w2 * node.chord * r.cn;
		const ft = 0.5 * w2 * node.chord * r.ctan;
		torque += B * ft * node.r * node.dr;
		thrust += B * fn * node.dr;
		elements.push({
			r: node.r,
			dr: node.dr,
			chord: node.chord,
			twist: node.twist,
			af: node.af,
			phi: phi / DEG,
			alpha: r.alpha,
			a: r.a,
			ap: r.ap,
			F: r.F,
			cl: r.cl,
			cd: r.cd,
			fn,
			ft
		});
	}
	const q = 0.5 * Math.PI * R * R; // ½ρAV³ and ½ρAV² at ρ = V = 1
	return { lambda, pitch: pitchDeg, elements, cp: (torque * omega) / q, ct: thrust / q };
}

/** CP against tip-speed ratio for one pitch, sampled from λ0 to λ1. */
export function cpCurve(pitchDeg: number, l0 = 1, l1 = 14, n = 66, options: BemOptions = {}) {
	return Array.from({ length: n }, (_, i) => {
		const lambda = l0 + ((l1 - l0) * i) / (n - 1);
		return { lambda, cp: bem(lambda, pitchDeg, options).cp };
	});
}

/** The tip-speed ratio of highest CP at a pitch over λ from 1 to 14, to ±0.01. */
export function bestLambda(pitchDeg: number, options: BemOptions = {}) {
	let lo = 1;
	let hi = 14;
	const cp = (l: number) => bem(l, pitchDeg, options).cp;
	while (hi - lo > 0.01) {
		const m1 = lo + (hi - lo) / 3;
		const m2 = hi - (hi - lo) / 3;
		if (cp(m1) < cp(m2)) lo = m1;
		else hi = m2;
	}
	const lambda = (lo + hi) / 2;
	return { lambda, cp: cp(lambda) };
}

// ---------------------------------------------------------------- operating the turbine

export type Region = 'parked' | 'min-speed' | 'below-rated' | 'speed-limit' | 'rated';

export interface Operating {
	v: number;
	region: Region;
	rpm: number;
	lambda: number;
	pitch: number;
	cp: number;
	/** Power taken from the wind by the rotor, and electrical output (W). */
	aero: number;
	electric: number;
	/** Power in the wind through the rotor disc (W). */
	wind: number;
	/** Rotor thrust (N). */
	thrust: number;
}

const RPM = (2 * Math.PI) / 60;

/**
 * The turbine's steady operating point at wind speed v (m/s), with a simplified version of
 * Jonkman et al.'s controller: below rated, the generator torque holds the optimal tip-speed
 * ratio (rotor speed ∝ wind speed) between the minimum and the rated rotor speed; at rated
 * rotor speed the blades stay at 0° pitch until the output reaches 5 MW; above that, the blades
 * pitch toward feather just enough to hold it. Parked below cut-in and above cut-out.
 */
export function operate(v: number): Operating {
	const { radius: R, rated, efficiency, lambdaOpt } = TURBINE;
	const wind = windPower(ROTOR_AREA, v);
	if (v < TURBINE.cutIn || v > TURBINE.cutOut) {
		return {
			v,
			region: 'parked',
			rpm: 0,
			lambda: 0,
			pitch: 90,
			cp: 0,
			aero: 0,
			electric: 0,
			wind,
			thrust: 0
		};
	}
	const omegaOpt = (lambdaOpt * v) / R;
	const omega = Math.min(TURBINE.rpmRated * RPM, Math.max(TURBINE.rpmMin * RPM, omegaOpt));
	const lambda = (omega * R) / v;
	const at = (pitch: number) => bem(lambda, pitch);
	let sol = at(0);
	let region: Region =
		omegaOpt > TURBINE.rpmRated * RPM
			? 'speed-limit'
			: omegaOpt < TURBINE.rpmMin * RPM
				? 'min-speed'
				: 'below-rated';
	const target = rated / efficiency;
	if (sol.cp * wind > target) {
		region = 'rated';
		let lo = 0;
		let hi = 40;
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2;
			if (at(mid).cp * wind > target) lo = mid;
			else hi = mid;
		}
		sol = at((lo + hi) / 2);
	}
	const aero = sol.cp * wind;
	return {
		v,
		region,
		rpm: omega / RPM,
		lambda,
		pitch: sol.pitch,
		cp: sol.cp,
		aero,
		electric: aero * efficiency,
		wind,
		thrust: sol.ct * 0.5 * RHO * ROTOR_AREA * v * v
	};
}

/** The wind speed (m/s) at which the output first reaches rated, to ±0.01 m/s. */
export function ratedWindSpeed() {
	let lo = 6;
	let hi = 20;
	while (hi - lo > 0.01) {
		const m = (lo + hi) / 2;
		if (operate(m).region === 'rated') hi = m;
		else lo = m;
	}
	return (lo + hi) / 2;
}

/**
 * The wind speeds (m/s) between which the controller holds the optimal tip-speed ratio: below
 * the first the rotor is held at its minimum speed, above the second at its rated speed.
 */
export const optimalBand = () => ({
	from: (TURBINE.rpmMin * RPM * TURBINE.radius) / TURBINE.lambdaOpt,
	to: (TURBINE.rpmRated * RPM * TURBINE.radius) / TURBINE.lambdaOpt
});
