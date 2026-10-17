/**
 * Transistors and chipmaking: the model behind the explainer.
 *
 * Sources:
 * - MOSFET parameters: the "typical 0.18 µm CMOS process" of A. S. Sedra and K. C. Smith,
 *   Microelectronic Circuits (7th ed., Oxford 2015, Table 5.1 / Appendix K): t_ox = 4.08 nm,
 *   C_ox = 8.6 fF/µm², µₙC_ox = 387 µA/V², µₚC_ox = 86 µA/V², V_t = 0.5 V (|V_t| for the
 *   pMOS), V_DD = 1.8 V, L = 0.18 µm.
 * - Drain current: Sedra & Smith's square law, i_D = k′(W/L)[(v_GS − V_t)v_DS − v_DS²/2] in
 *   triode and ½k′(W/L)(v_GS − V_t)² in saturation, without channel-length modulation.
 *   It is joined smoothly to the exponential "subthreshold" current below V_t with the
 *   interpolation of the EKV model (C. C. Enz, F. Krummenacher and E. A. Vittoz, Analog
 *   Integrated Circuits and Signal Processing 8, 83 (1995)):
 *   i_D = ½k′(W/L)·[F(v_GS − V_t) − F(v_GS − V_t − v_DS)], F(v) = (2nVₜ)² ln²(1 + e^(v/2nVₜ)),
 *   which is exactly the square law well above V_t and falls ten times for every
 *   n·Vₜ·ln 10 below it (the subthreshold slope). n = 1.5 is a typical slope factor
 *   (Sedra & Smith; Tsividis, Operation and Modeling of the MOS Transistor).
 *   Short-channel effects (velocity saturation, drain-induced barrier lowering) are left out.
 * - Channel charge: the inversion layer holds C_ox(v_GS − V_t) of charge per unit area above
 *   threshold (Sedra & Smith eq. 5.2), smoothed below V_t the same way.
 * - Lithography tools (ASML product pages, fetched 2026-10-14):
 *   TWINSCAN NXT:870, KrF 248 nm, NA up to 0.80, "at and below 110 nm resolution";
 *   TWINSCAN NXT:2000i, ArF immersion 193 nm, NA 1.35, "38 nm (dipole)";
 *   NXE systems, EUV 13.5 nm, NA 0.33, "resolution of 13 nm";
 *   TWINSCAN EXE:5000, High-NA EUV, NA 0.55, "8 nm resolution".
 *   Full exposure field 26 mm × 33 mm (NXT:2000i, NXE:3600D pages).
 * - Imaging: the Rayleigh criterion for half-pitch, hp = k₁λ/NA, and its Abbe derivation:
 *   a grating of pitch p diffracts light into orders at sin θ = mλ/p, and the lens (of
 *   numerical aperture NA) forms an image only if it collects at least two of them. The
 *   aerial image of a binary line/space mask is computed by Abbe's method (sum over
 *   source points of |Σ cₘ e^(2πimx/p)|² over the orders the pupil passes), for an ideal,
 *   in-focus lens with dipole illumination. No resist chemistry, no aberrations.
 * - Gross dies per wafer: the standard approximation N = πr²/S − πd/√(2S) (e.g. Hennessy &
 *   Patterson, Computer Architecture, ch. 1), without yield.
 * - Apple M1: 16 billion transistors (Apple Newsroom, 10 Nov 2020); die area about
 *   119 mm² (TechInsights measurement, as quoted by WikiChip).
 */
import { KT } from '../semiconductors/model';

export { KT };
/** Elementary charge (C). */
const Q = 1.602176634e-19;

// ------------------------------------------------------------------ MOSFET

/** Supply voltage of the 0.18 µm process (V). */
export const VDD = 1.8;
/** Gate-oxide capacitance per area (F/µm²). */
export const COX = 8.6e-15;
/** Gate-oxide thickness (nm). */
export const TOX_NM = 4.08;
/** Subthreshold slope factor. */
const N_SLOPE = 1.5;

interface Device {
	kind: 'n' | 'p';
	/** Process transconductance µC_ox (A/V²). */
	kp: number;
	/** |V_t| (V). */
	vt: number;
	/** Channel width and length (µm). */
	w: number;
	l: number;
}

export const NMOS: Device = { kind: 'n', kp: 387e-6, vt: 0.5, w: 0.36, l: 0.18 };
/** The pMOS is made µₙ/µₚ = 4.5 times wider, so that it drives the same current. */
export const PMOS: Device = { kind: 'p', kp: 86e-6, vt: 0.5, w: 1.62, l: 0.18 };

const twoNVt = 2 * N_SLOPE * KT;
/** ln(1 + eˣ) without overflow. */
const softplus = (x: number) => (x > 30 ? x : Math.log1p(Math.exp(x)));
const F = (v: number) => (twoNVt * softplus(v / twoNVt)) ** 2;

/**
 * Drain current (A) for gate–source voltage `vgs` and drain–source voltage `vds ≥ 0`
 * (for a pMOS: source–gate and source–drain voltages, the magnitudes).
 */
export function drainCurrent(dev: Device, vgs: number, vds: number): number {
	const beta = dev.kp * (dev.w / dev.l);
	const v = vgs - dev.vt;
	return 0.5 * beta * (F(v) - F(v - Math.max(0, vds)));
}

/** Overdrive voltage at which the channel pinches off at the drain: v_DS(sat) = v_GS − V_t. */
export const vdsSat = (dev: Device, vgs: number) => Math.max(0, vgs - dev.vt);

/** Electrons (or holes) in the channel per µm² of gate, at gate–source voltage `vgs`. */
export function channelDensity(dev: Device, vgs: number): number {
	// EKV's normalised inversion charge q = √(¼ + i_f) − ½ with √i_f = softplus: it falls tenfold
	// per subthreshold swing below threshold (like the current) and tends to C_ox(V_GS − V_t − nV_T)
	// above it.
	const s = softplus((vgs - dev.vt) / twoNVt);
	return (COX * twoNVt * (Math.sqrt(0.25 + s * s) - 0.5)) / Q;
}

/** Gate voltage change for a tenfold change of the subthreshold current (V/decade). */
export const SUBTHRESHOLD_SWING = N_SLOPE * KT * Math.LN10;

// ------------------------------------------------------------------ CMOS inverter

/** nMOS current minus pMOS current with input `vin` and output `vout`. */
const imbalance = (vin: number, vout: number) =>
	drainCurrent(NMOS, vin, vout) - drainCurrent(PMOS, VDD - vin, VDD - vout);

/**
 * Output voltage of the CMOS inverter: the vout at which the nMOS (pulling down) and the
 * pMOS (pulling up) carry the same current, found by bisection.
 */
export function inverterOut(vin: number): number {
	let lo = 0;
	let hi = VDD;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		// The nMOS current grows with vout and the pMOS current falls, so the imbalance rises.
		if (imbalance(vin, mid) > 0) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}

/** Current from the supply to ground through both transistors (A). */
export const inverterCurrent = (vin: number) => drainCurrent(NMOS, vin, inverterOut(vin));

/** The input at which the output crosses V_DD/2 (the switching threshold). */
export function switchingPoint(): number {
	let lo = 0;
	let hi = VDD;
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (inverterOut(mid) > VDD / 2) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/**
 * Two-input NAND: two pMOS in parallel from V_DD, two nMOS in series to ground. Returns
 * which transistors conduct and the output (true = high).
 */
export function nand(a: boolean, b: boolean) {
	const pA = !a;
	const pB = !b;
	const nA = a;
	const nB = b;
	return { pA, pB, nA, nB, out: pA || pB, pullDown: nA && nB };
}

// ------------------------------------------------------------------ lithography

interface Tool {
	id: string;
	name: string;
	light: string;
	/** Wavelength (nm). */
	lambda: number;
	na: number;
	/** The manufacturer's quoted single-exposure resolution (half-pitch, nm). */
	spec: number;
}

export const TOOLS: Tool[] = [
	{
		id: 'krf',
		name: 'TWINSCAN NXT:870',
		light: 'KrF laser, 248 nm',
		lambda: 248,
		na: 0.8,
		spec: 110
	},
	{
		id: 'arfi',
		name: 'TWINSCAN NXT:2000i',
		light: 'ArF laser, 193 nm, in water',
		lambda: 193,
		na: 1.35,
		spec: 38
	},
	{ id: 'euv', name: 'NXE EUV', light: 'EUV, 13.5 nm', lambda: 13.5, na: 0.33, spec: 13 },
	{
		id: 'hna',
		name: 'TWINSCAN EXE:5000',
		light: 'EUV, 13.5 nm',
		lambda: 13.5,
		na: 0.55,
		spec: 8
	}
];
export const toolById = (id: string) => TOOLS.find((t) => t.id === id) ?? TOOLS[1];

/** Exposure field of a scanner (mm). */
export const FIELD_MM = { w: 26, h: 33 } as const;

/** Rayleigh's k₁ for a half-pitch `hp` (nm) printed by `tool`: k₁ = hp·NA/λ. */
export const k1 = (hp: number, tool: Tool) => (hp * tool.na) / tool.lambda;
/** The half-pitch (nm) a given k₁ corresponds to: hp = k₁λ/NA. */
export const halfPitch = (k: number, tool: Tool) => (k * tool.lambda) / tool.na;

/** Dipole illumination: two poles centred at ±σ_c (fraction of NA), radius σ_r. */
export const DIPOLE = { center: 0.8, radius: 0.15 } as const;
/** Below this k₁ no source point gets two orders through the lens: k₁ = 1 / (2(1 + σ_max)). */
export const K1_CUTOFF = 1 / (2 * (1 + DIPOLE.center + DIPOLE.radius));

/** Source points of one pole (pupil coordinates, units of NA); the other is its mirror. */
const POLE = (() => {
	const pts: { sx: number; sy: number }[] = [];
	const n = 9;
	for (let i = 0; i < n; i++)
		for (let j = 0; j < n; j++) {
			const dx = ((i + 0.5) / n) * 2 - 1;
			const dy = ((j + 0.5) / n) * 2 - 1;
			if (dx * dx + dy * dy <= 1)
				pts.push({ sx: DIPOLE.center + dx * DIPOLE.radius, sy: dy * DIPOLE.radius });
		}
	return pts;
})();

/** Amplitude of diffraction order m of a 50 % line/space chrome-on-glass mask. */
const order = (m: number) => (m === 0 ? 0.5 : Math.sin((Math.PI * m) / 2) / (Math.PI * m));

/**
 * Aerial image of a line/space grating of half-pitch `hp` (nm): intensity (1 = an open,
 * unpatterned mask) at `samples` points across one pitch, starting at the centre of a clear
 * (glass) line. Also returns its contrast (Imax − Imin)/(Imax + Imin).
 */
export function aerialImage(hp: number, tool: Tool, samples = 64) {
	const p = 2 * hp;
	const f = tool.lambda / (p * tool.na); // order spacing in the pupil, units of NA
	const I = new Array<number>(samples).fill(0);
	const M = 7;
	let count = 0;
	for (const s of POLE) {
		for (const sign of [1, -1]) {
			const sx = sign * s.sx;
			const pass: number[] = [];
			for (let m = -M; m <= M; m++) {
				const ux = sx + m * f;
				if (ux * ux + s.sy * s.sy <= 1) pass.push(m);
			}
			for (let k = 0; k < samples; k++) {
				const x = k / samples; // fraction of the pitch, 0 = centre of the clear line
				let re = 0;
				let im = 0;
				for (const m of pass) {
					const a = order(m);
					re += a * Math.cos(2 * Math.PI * m * x);
					im += a * Math.sin(2 * Math.PI * m * x);
				}
				I[k] += re * re + im * im;
			}
			count++;
		}
	}
	for (let k = 0; k < samples; k++) I[k] /= count;
	const max = Math.max(...I);
	const min = Math.min(...I);
	return { I, max, min, contrast: max + min > 0 ? (max - min) / (max + min) : 0 };
}

// ------------------------------------------------------------------ wafer

/** Wafer diameter (mm). */
export const WAFER_MM = 300;
/** Gross dies of area `s` (mm²) on a wafer of diameter `d` (mm). */
export const diesPerWafer = (s: number, d = WAFER_MM) =>
	Math.floor((Math.PI * (d / 2) ** 2) / s - (Math.PI * d) / Math.sqrt(2 * s));

export const M1 = { transistors: 16e9, area: 119 } as const;

// ------------------------------------------------------------------ transistor counts

/**
 * Least-squares straight line through log₂(count) against year: the count doubles every
 * `doubling` years. `from`/`to` restrict the years used.
 */
export function mooreFit(points: readonly (readonly [number, number])[], from = 0, to = 1e4) {
	const pts = points.filter(([y]) => y >= from && y <= to);
	const n = pts.length;
	const mx = pts.reduce((s, [y]) => s + y, 0) / n;
	const my = pts.reduce((s, [, c]) => s + Math.log2(c), 0) / n;
	let sxy = 0;
	let sxx = 0;
	for (const [y, c] of pts) {
		sxy += (y - mx) * (Math.log2(c) - my);
		sxx += (y - mx) ** 2;
	}
	const slope = sxy / sxx;
	return {
		doubling: 1 / slope,
		/** Fitted count in a given year. */
		at: (year: number) => 2 ** (my + slope * (year - mx))
	};
}
