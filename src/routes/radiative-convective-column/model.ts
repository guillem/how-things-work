/**
 * A one-dimensional radiative-convective column (Pierrehumbert, Principles of Planetary Climate,
 * ch. 4; Manabe & Wetherald 1967 for the convective adjustment).
 *
 * - Sunlight: the absorbed solar flux, (1 − albedo) S₀ / 4, is all absorbed at the surface (the
 *   air is transparent to it).
 * - Infrared: a fraction `window` of the Planck emission σT⁴ lies in a spectral window the air
 *   does not absorb at all; the rest lies in a grey band with optical depth τ∞ from the top of the
 *   atmosphere to the surface. The absorber is well mixed and its lines are pressure-broadened (the
 *   absorption per kilogram of air grows in proportion to pressure), so τ(p) = τ∞ (p / pₛ)²
 *   (Pierrehumbert ch. 4). The band is solved with the hemi-isotropic two-stream equations
 *   dU/dτ = U − B, dD/dτ = B − D (τ counted downward, the diffusivity factor folded into τ), on
 *   isothermal layers with the exact transmission e^{−Δτ} of each.
 * - Convection: when it is on, any part of the column (the surface included) steeper than the
 *   chosen lapse rate Γ is mixed back to exactly Γ, conserving its enthalpy.
 *
 * Plain TypeScript, no Svelte: the Node tests import it.
 */

export const SIGMA = 5.670374419e-8; // W m⁻² K⁻⁴
export const S0 = 1361; // W m⁻², total solar irradiance (Kopp & Lean 2011)
export const ALBEDO = 0.3; // Earth's Bond albedo, rounded
export const G = 9.81; // m s⁻²
export const R_AIR = 287.05; // J kg⁻¹ K⁻¹, dry air
export const CP = 1004; // J kg⁻¹ K⁻¹, dry air
export const PS = 1000; // hPa, surface pressure
/** Heat capacity of the surface in the time runs: a 50 m ocean mixed layer, J m⁻² K⁻¹. */
export const C_SURFACE = 1025 * 3990 * 50;

/**
 * The page's column: a window holding a tenth of the Planck emission (at 288 K that lets about
 * 39 W m⁻² escape from the surface, close to the 40 W m⁻² of the observed atmospheric window in
 * Trenberth, Fasullo & Kiehl 2009), and a band optical depth chosen so that the surface comes out
 * near today's 288 K with a lapse rate of 6.5 K/km.
 */
export const WINDOW = 0.1;
export const TAU_REF = 3.5;
export const LAPSE_REF = 6.5;
/** Steepest lapse rate offered: the dry adiabat, g / cₚ. */
export const DRY_LAPSE = (1000 * G) / CP;

/** Sunlight absorbed per square metre of the planet, averaged over day, night and latitude. */
export const absorbedSolar = (s0 = S0, albedo = ALBEDO) => ((1 - albedo) * s0) / 4;
/** The temperature a blackbody needs to emit a flux F: T = (F/σ)^¼. */
export const emissionTemp = (flux: number) => (flux / SIGMA) ** 0.25;

export interface Settings {
	/** Optical depth of the whole column in the grey band (the greenhouse-gas amount). */
	tau: number;
	/** Fraction of the Planck emission in the window, 0 for a fully grey gas. */
	window: number;
	/** Lapse rate convection adjusts to, K/km. */
	lapse: number;
	convection: boolean;
	/** Absorbed sunlight, W m⁻²; defaults to `absorbedSolar()`. */
	solar?: number;
}

export interface Grid {
	/** Interface pressures (hPa) from the surface up; the last is 0, the top of the air. */
	ph: number[];
	/** Layer mid pressures (hPa); layer k lies between ph[k] and ph[k + 1]. */
	p: number[];
}

/**
 * The layers: 15 hPa thick near the ground, then evenly spaced in ln p (at most 0.07, about
 * 0.5 km) up to 1 hPa, and one last layer from 1 hPa to the top. `refine` divides every layer.
 */
export function makeGrid(refine = 1): Grid {
	const dp = 15 / refine;
	const dlnp = 0.07 / refine;
	const ph = [PS];
	let p = PS;
	while (p > 1) {
		p = Math.max(1, p - dp, p * Math.exp(-dlnp));
		ph.push(p);
	}
	ph.push(0);
	const mid = ph.slice(0, -1).map((lo, k) => (ph[k + 1] > 0 ? Math.sqrt(lo * ph[k + 1]) : lo / 2));
	return { ph, p: mid };
}

export const GRID = makeGrid();

export interface Column {
	settings: Settings;
	grid: Grid;
	/** Surface temperature, K. */
	ts: number;
	/** Layer temperatures, K, from the bottom. */
	T: number[];
}

export interface Diagnostics {
	/** Outgoing infrared at the top, W m⁻², and its parts. */
	olr: number;
	olrBand: number;
	olrWindow: number;
	/** Infrared up and down in the band at each interface (W m⁻²), from the surface up. */
	up: number[];
	down: number[];
	/** Net radiative heating of each layer, W m⁻², and of the surface. */
	heating: number[];
	surfaceHeating: number;
	/** Altitude of each interface and of each layer's middle, km. */
	zh: number[];
	z: number[];
	/** Share of the outgoing infrared that leaves from each layer (fractions of olr). */
	share: number[];
	/** Shares leaving from the surface through the band and through the window. */
	shareSurfaceBand: number;
	shareWindow: number;
	/** The level where the band's optical depth from the top is 1 (hPa, km); null if τ∞ < 1. */
	emissionP: number | null;
	emissionZ: number | null;
	/** Temperature of the air at the emission level, K. */
	emissionT: number | null;
	/** Highest layer in the convecting region (index), -1 if none. */
	tropopause: number;
	tropopauseZ: number | null;
	tropopauseT: number | null;
}

/** Optical depth from the top down to each interface. */
/** τ ∝ p^TAU_N; 2 for a well-mixed, pressure-broadened absorber. */
export const TAU_N = 2;
const tauAt = (grid: Grid, tau: number) => grid.ph.map((p) => tau * (p / PS) ** TAU_N);

function fluxes(c: Column) {
	const { grid, settings, T, ts } = c;
	const n = T.length;
	const band = 1 - settings.window;
	const tauI = tauAt(grid, settings.tau);
	const trans = new Array<number>(n);
	const emis = new Array<number>(n);
	const B = new Array<number>(n);
	for (let k = 0; k < n; k++) {
		trans[k] = Math.exp(-(tauI[k] - tauI[k + 1]));
		emis[k] = 1 - trans[k];
		B[k] = band * SIGMA * T[k] ** 4;
	}
	const up = new Array<number>(n + 1);
	const down = new Array<number>(n + 1);
	up[0] = band * SIGMA * ts ** 4;
	for (let k = 0; k < n; k++) up[k + 1] = up[k] * trans[k] + emis[k] * B[k];
	down[n] = 0;
	for (let k = n - 1; k >= 0; k--) down[k] = down[k + 1] * trans[k] + emis[k] * B[k];
	const heating = new Array<number>(n);
	for (let k = 0; k < n; k++) heating[k] = up[k] - up[k + 1] + down[k + 1] - down[k];
	const solar = settings.solar ?? absorbedSolar();
	const surfaceHeating = solar + down[0] - SIGMA * ts ** 4;
	return { up, down, heating, surfaceHeating, trans, emis, B, tauI };
}

/** κ of the neutral profile T ∝ p^κ for a lapse rate Γ (K/km): κ = R Γ / g. */
const kappaOf = (lapse: number) => (R_AIR * lapse) / 1000 / G;

/**
 * Convective adjustment: mixes every part of the column steeper than Γ back to exactly Γ,
 * conserving Σ Cₖ Tₖ (the surface is level 0). Neutral means T/p^κ the same all the way up, so
 * stability is "T/p^κ never decreases upward", and the mixing is the pool-adjacent-violators
 * algorithm on θ = T/(p/pₛ)^κ with weights C π. Returns the index of the top level of the group
 * that contains the surface (0 if the surface does not convect).
 */
function adjust(ts: number, T: number[], cs: number, C: number[], p: number[], lapse: number) {
	const kappa = kappaOf(lapse);
	const n = T.length;
	const pi = [1, ...p.map((x) => (x / PS) ** kappa)];
	const cap = [cs, ...C];
	const temp = [ts, ...T];
	// blocks of [start, end, Σ C T, Σ C π]
	const start: number[] = [];
	const end: number[] = [];
	const ct: number[] = [];
	const cp: number[] = [];
	for (let j = 0; j <= n; j++) {
		start.push(j);
		end.push(j);
		ct.push(cap[j] * temp[j]);
		cp.push(cap[j] * pi[j]);
		// an upper block colder (in θ) than the one below it is unstable: merge
		while (ct.length > 1) {
			const m = ct.length - 1;
			// a tiny tolerance stops round-off from merging a neutral column back and forth
			if (ct[m] / cp[m] >= (ct[m - 1] / cp[m - 1]) * (1 - 1e-12)) break;
			ct[m - 1] += ct[m];
			cp[m - 1] += cp[m];
			end[m - 1] = end[m];
			start.pop();
			end.pop();
			ct.pop();
			cp.pop();
		}
	}
	for (let b = 0; b < start.length; b++) {
		if (start[b] === end[b]) continue;
		const theta = ct[b] / cp[b];
		for (let j = start[b]; j <= end[b]; j++) temp[j] = theta * pi[j];
	}
	return { ts: temp[0], T: temp.slice(1), top: end[0] };
}

/** Altitudes (km) of the interfaces and layer middles, from the hydrostatic balance. */
function altitudes(grid: Grid, T: number[]) {
	const zh = [0];
	const z: number[] = [];
	const H = (t: number) => (R_AIR * t) / G / 1000;
	for (let k = 0; k < T.length; k++) {
		const lo = grid.ph[k];
		const hi = grid.ph[k + 1];
		if (hi > 0) {
			z.push(zh[k] + H(T[k]) * Math.log(lo / grid.p[k]));
			zh.push(zh[k] + H(T[k]) * Math.log(lo / hi));
		} else {
			z.push(zh[k] + H(T[k]) * Math.log(lo / grid.p[k]));
			zh.push(Infinity);
		}
	}
	return { zh, z };
}

/** Altitude (km) of pressure level p (hPa), interpolated in ln p. */
export function altitudeAt(grid: Grid, z: number[], p: number): number {
	if (p >= grid.p[0]) return (z[0] * Math.log(PS / p)) / Math.log(PS / grid.p[0]);
	for (let k = 0; k < grid.p.length - 1; k++) {
		if (p >= grid.p[k + 1]) {
			const u = Math.log(grid.p[k] / p) / Math.log(grid.p[k] / grid.p[k + 1]);
			return z[k] + u * (z[k + 1] - z[k]);
		}
	}
	return z[z.length - 1];
}

/** Temperature (K) at pressure level p, interpolated in ln p between layer middles. */
export function temperatureAt(c: Column, p: number): number {
	const { grid, T } = c;
	if (p >= grid.p[0]) return T[0];
	for (let k = 0; k < grid.p.length - 1; k++) {
		if (p >= grid.p[k + 1]) {
			const u = Math.log(grid.p[k] / p) / Math.log(grid.p[k] / grid.p[k + 1]);
			return T[k] + u * (T[k + 1] - T[k]);
		}
	}
	return T[T.length - 1];
}

export function diagnose(c: Column): Diagnostics {
	const f = fluxes(c);
	const { settings, grid, T, ts } = c;
	const n = T.length;
	const olrWindow = settings.window * SIGMA * ts ** 4;
	const olrBand = f.up[n];
	const olr = olrBand + olrWindow;
	const share = T.map((_, k) => (f.emis[k] * f.B[k] * Math.exp(-f.tauI[k + 1])) / olr);
	const shareSurfaceBand = (f.up[0] * Math.exp(-f.tauI[0])) / olr;
	const { zh, z } = altitudes(grid, T);
	const emissionP = settings.tau >= 1 ? PS * settings.tau ** (-1 / TAU_N) : null;
	let top = -1;
	if (settings.convection) {
		// the convecting region is the run of neutral layers that starts at the surface
		const kappa = kappaOf(settings.lapse);
		const th = (t: number, p: number) => t / (p / PS) ** kappa;
		const th0 = ts;
		for (let k = 0; k < n; k++) {
			if (Math.abs(th(T[k], grid.p[k]) / th0 - 1) < 1e-6) top = k;
			else break;
		}
	}
	return {
		olr,
		olrBand,
		olrWindow,
		up: f.up,
		down: f.down,
		heating: f.heating,
		surfaceHeating: f.surfaceHeating,
		zh,
		z,
		share,
		shareSurfaceBand,
		shareWindow: olrWindow / olr,
		emissionP,
		emissionZ: emissionP === null ? null : altitudeAt(grid, z, emissionP),
		emissionT: emissionP === null ? null : temperatureAt(c, emissionP),
		tropopause: top,
		tropopauseZ: top >= 0 ? zh[top + 1] : null,
		tropopauseT: top >= 0 ? T[top] : null
	};
}

/** A starting column: an isothermal 250 K atmosphere over a 288 K surface. */
export function initial(settings: Settings, grid = GRID): Column {
	return { settings, grid, ts: 288, T: grid.p.map(() => 250) };
}

/**
 * The equilibrium column: steps a pseudo-time in which every layer has the same radiative
 * relaxation time (heat capacities proportional to emissivity), adjusting convection after
 * every step, until nothing changes by more than `tol` kelvin. The equilibrium does not depend on
 * those capacities: in it every radiative layer has zero net heating, and the convecting region
 * (surface included) has zero net heating in total.
 */
export function equilibrium(
	settings: Settings,
	grid = GRID,
	start?: Column,
	tol = 1e-5,
	maxIter = 200000
): Column {
	let c: Column = start
		? { settings, grid, ts: start.ts, T: [...start.T] }
		: initial(settings, grid);
	const band = Math.max(0.05, 1 - settings.window);
	const tauI = tauAt(grid, settings.tau);
	const emis = c.T.map((_, k) => 1 - Math.exp(-(tauI[k] - tauI[k + 1])));
	// relaxation: a layer's emission changes by 8 band σ T³ ε per kelvin
	const k0 = 8 * band * SIGMA * 260 ** 3;
	const C = emis.map((e) => Math.max(e, 1e-9) * k0);
	const cs = 4 * SIGMA * 290 ** 3;
	const dt = 0.45;
	for (let it = 0; it < maxIter; it++) {
		const f = fluxes(c);
		let ts = c.ts + (dt * f.surfaceHeating) / cs;
		let T = c.T.map((t, k) => t + (dt * f.heating[k]) / C[k]);
		ts = Math.max(ts, 50);
		T = T.map((t) => Math.max(t, 50));
		if (settings.convection) ({ ts, T } = adjust(ts, T, cs, C, grid.p, settings.lapse));
		let change = Math.abs(ts - c.ts);
		for (let k = 0; k < T.length; k++) change = Math.max(change, Math.abs(T[k] - c.T[k]));
		c = { settings, grid, ts, T };
		if (change < tol) break;
	}
	return c;
}

/** The column's outgoing infrared after a change of settings, with its temperatures held. */
export function instantOLR(c: Column, settings: Settings): number {
	return diagnose({ ...c, settings }).olr;
}

export interface Snapshot {
	/** Days since the change. */
	days: number;
	ts: number;
	T: number[];
	olr: number;
}

/**
 * Real time: the column starts from `from` (an equilibrium) and runs with `settings`, with the
 * heat capacity of air (cₚ Δp / g) in every layer and a 50 m ocean mixed layer at the surface.
 * Returns snapshots at times evenly spaced in log time, from `firstDay` to `lastDay`.
 */
export function evolve(
	from: Column,
	settings: Settings,
	lastDay = 365.25 * 30,
	count = 120,
	firstDay = 1
): Snapshot[] {
	const grid = from.grid;
	const C = grid.ph.slice(0, -1).map((lo, k) => (CP * (lo - grid.ph[k + 1]) * 100) / G);
	let c: Column = { settings, grid, ts: from.ts, T: [...from.T] };
	const out: Snapshot[] = [{ days: 0, ts: c.ts, T: [...c.T], olr: diagnose(c).olr }];
	const targets = Array.from(
		{ length: count },
		(_, i) => firstDay * (lastDay / firstDay) ** (i / (count - 1))
	);
	const band = 1 - settings.window;
	const tauI = tauAt(grid, settings.tau);
	const emis = from.T.map((_, k) => 1 - Math.exp(-(tauI[k] - tauI[k + 1])));
	let time = 0;
	// highest convecting layer (the adjustment's top level, counting the surface as 0)
	let top = -1;
	for (const target of targets) {
		while (time < target * 86400 - 1) {
			// steps of a tenth of the time elapsed, from an hour up to five days. A radiative layer's
			// own emission is treated implicitly (linearised), which keeps long steps stable; the
			// convecting layers, mixed with the ocean's large heat capacity, step explicitly, so that
			// the convecting region still comes to rest only when its net heating is zero.
			const dt = Math.min(Math.max(3600, time / 10), 5 * 86400, target * 86400 - time);
			const f = fluxes(c);
			let ts = c.ts + (dt * f.surfaceHeating) / C_SURFACE;
			let T = c.T.map((t, k) => {
				const damp = k <= top ? 0 : dt * 8 * band * SIGMA * emis[k] * t ** 3;
				return t + (dt * f.heating[k]) / (C[k] + damp);
			});
			if (settings.convection) {
				const a = adjust(ts, T, C_SURFACE, C, grid.p, settings.lapse);
				({ ts, T } = a);
				top = a.top - 1;
			}
			c = { settings, grid, ts, T };
			time += dt;
		}
		out.push({ days: target, ts: c.ts, T: [...c.T], olr: diagnose(c).olr });
	}
	return out;
}
