/**
 * The models behind the atmosphere & weather explainer. Each is a standard,
 * simplified textbook model; the simplifications are stated on the page.
 *
 * 1. Uneven heating and heat transport: a one-dimensional energy-balance
 *    model (Budyko 1969, Sellers 1969, in the form of North 1975). Each
 *    latitude absorbs sunlight, radiates heat to space (more when warmer),
 *    and passes heat to cooler neighbours at a rate set by a "transport"
 *    coefficient standing for the winds and ocean currents.
 * 2. The width of the Hadley cell on a spinning planet: Held & Hou (1980).
 * 3. The Coriolis effect: an air parcel moving freely over a rotating planet
 *    (local horizontal plane, with the Coriolis parameter f = 2Ω sin φ
 *    changing with latitude).
 * 4. Winds around highs and lows: the geostrophic wind (pressure force
 *    balanced by the Coriolis force), turned towards low pressure and slowed
 *    near the ground by friction.
 * 5. Fronts: a north–south temperature contrast carried round by the winds
 *    of a low (kinematic advection).
 * 6. Hurricanes: the empirical maximum potential intensity over a given sea
 *    surface temperature (DeMaria & Kaplan 1994) and the usual conditions for
 *    a storm to form.
 */

export const EARTH_RADIUS = 6.371e6; // m
export const OMEGA = 7.292e-5; // rad/s, Earth's rotation (sidereal day)
export const SOLAR_CONSTANT = 1361; // W/m²
export const G = 9.81;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

// ------------------------------------------------------------ 1. energy balance

/** Second Legendre polynomial. */
const P2 = (x: number) => (3 * x * x - 1) / 2;

/**
 * Yearly-average sunlight arriving at the top of the atmosphere at latitude
 * φ (W/m²), North's fit S0/4 · (1 − 0.482 P2(sin φ)): ~418 at the equator,
 * ~173 at the poles, 340 on average.
 */
export const insolation = (lat: number) =>
	(SOLAR_CONSTANT / 4) * (1 - 0.482 * P2(Math.sin(rad(lat))));

/**
 * Fraction of sunlight reflected (albedo): more towards the poles (snow, ice,
 * cloud and the low Sun): 0.23 at the equator, 0.56 at the poles, chosen with
 * D_EARTH so that the model's climate resembles today's (about 28 °C at the
 * equator, a global mean near 14 °C and a peak poleward heat flow near 6 PW).
 */
export const albedo = (lat: number) => 0.34 + 0.22 * P2(Math.sin(rad(lat)));

/** Sunlight absorbed at latitude φ (W/m²). */
export const absorbed = (lat: number) => insolation(lat) * (1 - albedo(lat));

/** Outgoing heat radiation to space at temperature T (°C): A + B·T (North et al. 1981's fit to satellite data, after Budyko). */
export const OLR_A = 203.3; // W/m²
export const OLR_B = 2.09; // W/m² per °C
export const emitted = (T: number) => OLR_A + OLR_B * T;

/** Heat-transport coefficient (W/m² per °C) that roughly matches today's climate. */
export const D_EARTH = 0.7;

export interface Climate {
	/** Latitudes of the bands (°), south to north. */
	lat: number[];
	/** Surface temperature of each band (°C). */
	T: number[];
	/** Absorbed sunlight and emitted heat (W/m²). */
	absorbed: number[];
	emitted: number[];
	/** Heat carried northward across the boundary between band i and i + 1 (W). */
	northward: number[];
	/** Latitudes of those boundaries (°). */
	edges: number[];
}

/**
 * Steady state of the energy-balance model: for every band, sunlight absorbed
 * = heat radiated + heat carried away to neighbours, with the transport
 * D·d/dx[(1 − x²) dT/dx] in x = sin φ. Solved exactly (tridiagonal system).
 */
export function climate(D = D_EARTH, bands = 90): Climate {
	const n = bands;
	const dx = 2 / n;
	const x = Array.from({ length: n }, (_, i) => -1 + (i + 0.5) * dx);
	const lat = x.map((v) => deg(Math.asin(v)));
	const xe = Array.from({ length: n - 1 }, (_, i) => -1 + (i + 1) * dx); // inner faces
	const k = xe.map((v) => (D * (1 - v * v)) / (dx * dx));
	// B·T_i + k_{i−1}(T_i − T_{i−1}) + k_i(T_i − T_{i+1}) = absorbed_i − A
	const lower = new Array(n).fill(0);
	const diag = new Array(n).fill(0);
	const upper = new Array(n).fill(0);
	const rhs = lat.map((l) => absorbed(l) - OLR_A);
	for (let i = 0; i < n; i++) {
		diag[i] = OLR_B;
		if (i > 0) {
			diag[i] += k[i - 1];
			lower[i] = -k[i - 1];
		}
		if (i < n - 1) {
			diag[i] += k[i];
			upper[i] = -k[i];
		}
	}
	const T = thomas(lower, diag, upper, rhs);
	const northward = xe.map(
		(v, i) => -2 * Math.PI * EARTH_RADIUS ** 2 * D * (1 - v * v) * ((T[i + 1] - T[i]) / dx)
	);
	return {
		lat,
		T,
		absorbed: lat.map(absorbed),
		emitted: T.map(emitted),
		northward,
		edges: xe.map((v) => deg(Math.asin(v)))
	};
}

/** Solves a tridiagonal system. */
function thomas(a: number[], b: number[], c: number[], d: number[]) {
	const n = d.length;
	const cp = new Array(n).fill(0);
	const dp = new Array(n).fill(0);
	cp[0] = c[0] / b[0];
	dp[0] = d[0] / b[0];
	for (let i = 1; i < n; i++) {
		const m = b[i] - a[i] * cp[i - 1];
		cp[i] = c[i] / m;
		dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
	}
	const x = new Array(n).fill(0);
	x[n - 1] = dp[n - 1];
	for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
	return x;
}

/** Temperature at a latitude from a solved climate (linear interpolation). */
export function tempAt(c: Climate, lat: number) {
	const { lat: L, T } = c;
	if (lat <= L[0]) return T[0];
	if (lat >= L[L.length - 1]) return T[T.length - 1];
	let i = 0;
	while (L[i + 1] < lat) i++;
	const u = (lat - L[i]) / (L[i + 1] - L[i]);
	return T[i] + u * (T[i + 1] - T[i]);
}

// ------------------------------------------------------------ 2. cells

/**
 * Poleward edge of the Hadley cell (°) for a planet spinning `spin` times as
 * fast as Earth, from Held & Hou (1980): φ_H = √(5/3 · gHΔ/(Ω²a²)) radians,
 * with equator-to-pole contrast Δ = 1/3 of the mean potential temperature (as
 * in the paper) and a height H = 15 km chosen here (the paper's value is lower):
 * about 35° for Earth, close to the observed 30°.
 * Capped at 90°: a slowly spinning planet has one cell from equator to pole.
 */
export function hadleyEdge(spin: number) {
	if (spin <= 0) return 90;
	const H = 15e3;
	const delta = 1 / 3;
	const W = OMEGA * spin;
	const R = (G * H * delta) / (W * W * EARTH_RADIUS ** 2);
	return Math.min(90, deg(Math.sqrt((5 / 3) * R)));
}

export interface Cell {
	/** From and to latitude (°, northern hemisphere; mirrored in the south). */
	from: number;
	to: number;
	/** Direction of the circulation: 'direct' rises at its equatorward side (Hadley-like), 'indirect' the other way. */
	sense: 'direct' | 'indirect';
	/** Surface wind direction in this band: 'east' = blowing from the east (easterlies). */
	surface: 'easterly' | 'westerly' | 'none';
}

/**
 * The cells of one hemisphere. The Hadley cell's width follows Held & Hou;
 * poleward of it, cells of alternating direction of about the same width
 * fill the rest (three in all for Earth). That rule is a sketch of what
 * rotating-tank experiments and climate models show — faster spin, more and
 * narrower bands, as on Jupiter — not a calculation. Without spin there is no
 * Coriolis force, so the surface winds blow straight towards the equator.
 */
export function cells(spin: number): Cell[] {
	const h = hadleyEdge(spin);
	const out: Cell[] = [
		{ from: 0, to: h, sense: 'direct', surface: spin > 0 ? 'easterly' : 'none' }
	];
	if (h >= 90) return out;
	// A sliver of a few degrees at the pole is not a separate cell: let the Hadley cell reach it.
	if (90 - h < 0.4 * h) return [{ ...out[0], to: 90 }];
	const count = Math.max(1, Math.round((90 - h) / (0.85 * h)));
	const w = (90 - h) / count;
	for (let k = 0; k < count; k++) {
		const direct = k % 2 === 1; // alternating: Ferrel-like (indirect), polar-like (direct), …
		out.push({
			from: h + k * w,
			to: h + (k + 1) * w,
			sense: direct ? 'direct' : 'indirect',
			surface: direct ? 'easterly' : 'westerly'
		});
	}
	return out;
}

// ------------------------------------------------------------ 3. Coriolis

/** Coriolis parameter f = 2Ω sin φ (1/s). */
export const coriolis = (lat: number, spin = 1) => 2 * OMEGA * spin * Math.sin(rad(lat));

export interface Parcel {
	/** Positions (km east, km north of the start) and latitude, every `dt` seconds. */
	x: number[];
	y: number[];
	lat: number[];
	dt: number;
}

/**
 * A parcel of air pushed off at speed `speed` (m/s) towards `heading`
 * (degrees, 0 = north, 90 = east) from latitude `lat0`, then coasting freely:
 * the only horizontal force is the Coriolis force (du/dt = f v, dv/dt = −f u),
 * with f taken at the parcel's current latitude. RK4, `steps` steps of `dt`
 * seconds.
 */
export function parcel(
	lat0: number,
	heading: number,
	speed: number,
	spin = 1,
	steps = 400,
	dt = 600
): Parcel {
	let u = speed * Math.sin(rad(heading));
	let v = speed * Math.cos(rad(heading));
	let x = 0;
	let y = 0;
	const out: Parcel = { x: [0], y: [0], lat: [lat0], dt };
	const latOf = (yy: number) => lat0 + deg(yy / EARTH_RADIUS);
	const acc = (yy: number, uu: number, vv: number) => {
		const f = coriolis(latOf(yy), spin);
		return [f * vv, -f * uu];
	};
	for (let i = 0; i < steps; i++) {
		const [a1, b1] = acc(y, u, v);
		const [a2, b2] = acc(y + (v * dt) / 2, u + (a1 * dt) / 2, v + (b1 * dt) / 2);
		const [a3, b3] = acc(y + ((v + (b1 * dt) / 2) * dt) / 2, u + (a2 * dt) / 2, v + (b2 * dt) / 2);
		const [a4, b4] = acc(y + (v + (b2 * dt) / 2) * dt, u + a3 * dt, v + b3 * dt);
		const k1 = [u, v];
		const k2 = [u + (a1 * dt) / 2, v + (b1 * dt) / 2];
		const k3 = [u + (a2 * dt) / 2, v + (b2 * dt) / 2];
		const k4 = [u + a3 * dt, v + b3 * dt];
		x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
		y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
		u += (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
		v += (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
		out.x.push(x / 1000);
		out.y.push(y / 1000);
		out.lat.push(latOf(y));
	}
	return out;
}

/**
 * Rossby number U / (f L): how fast motion is compared with the planet's
 * turning. Much larger than 1: the Coriolis effect is negligible; about 1 or
 * less: it shapes the flow.
 */
export const rossby = (speed: number, size: number, lat = 45) =>
	speed / (Math.abs(coriolis(lat)) * size);

/** Everyday flows for the Rossby-number comparison (speed m/s, size m). */
export const SCALES = [
	{ id: 'sink', label: 'Water draining from a sink', speed: 0.1, size: 0.3 },
	{ id: 'bath', label: 'A bath emptying', speed: 0.2, size: 1 },
	{ id: 'tornado', label: 'A tornado', speed: 50, size: 300 },
	{ id: 'hurricane', label: 'A hurricane', speed: 50, size: 5e5 },
	{ id: 'cyclone', label: 'A mid-latitude low', speed: 10, size: 1e6 }
];

// ------------------------------------------------------------ 4. highs and lows

export interface System {
	kind: 'high' | 'low';
	/** Centre (km) on the map. */
	x: number;
	y: number;
	/** Pressure difference from 1013 hPa at the centre (hPa; + for highs). */
	dp: number;
	/** Radius (km). */
	r: number;
}

export const AIR_DENSITY = 1.2; // kg/m³ near the ground

/** Sea-level pressure (hPa) at (x, y) km: 1013 plus a Gaussian bump or dip per system. */
export function pressure(systems: readonly System[], x: number, y: number) {
	let p = 1013;
	for (const s of systems)
		p += s.dp * Math.exp(-((x - s.x) ** 2 + (y - s.y) ** 2) / (2 * s.r * s.r));
	return p;
}

/** Pressure gradient (Pa per m) at (x, y) km. */
export function pressureGradient(systems: readonly System[], x: number, y: number) {
	let gx = 0;
	let gy = 0;
	for (const s of systems) {
		const e = Math.exp(-((x - s.x) ** 2 + (y - s.y) ** 2) / (2 * s.r * s.r));
		// d/dx of dp·e (hPa per km) = dp·e·(−(x − sx)/r²); ×100 Pa/hPa ÷ 1000 m/km
		gx += s.dp * e * (-(x - s.x) / (s.r * s.r)) * 0.1;
		gy += s.dp * e * (-(y - s.y) / (s.r * s.r)) * 0.1;
	}
	return [gx, gy];
}

/** Angle (°) by which friction turns the near-ground wind across the isobars towards low pressure, and the slow-down. */
export const FRICTION_ANGLE = 30;
export const FRICTION_SLOWDOWN = 0.7;

/**
 * Wind (m/s, [east, north]) at (x, y) km. Aloft: the geostrophic wind
 * (1/ρf) k × ∇p, blowing along the isobars — anticlockwise round lows in the
 * northern hemisphere, clockwise in the southern. Near the ground (`surface`),
 * friction turns it by FRICTION_ANGLE towards low pressure and slows it.
 * Capped at 60 m/s (the geostrophic formula overshoots near tight centres).
 */
export function wind(
	systems: readonly System[],
	x: number,
	y: number,
	lat = 45,
	surface = true
): [number, number] {
	const f = coriolis(lat);
	const [gx, gy] = pressureGradient(systems, x, y);
	let u = -gy / (AIR_DENSITY * f);
	let v = gx / (AIR_DENSITY * f);
	if (surface) {
		// Turn towards low pressure: in the north (f > 0) that is anticlockwise from the
		// geostrophic direction... towards −∇p, i.e. rotate by +angle·sign(f).
		const a = rad(FRICTION_ANGLE) * Math.sign(f);
		const c = Math.cos(a);
		const s = Math.sin(a);
		[u, v] = [FRICTION_SLOWDOWN * (u * c - v * s), FRICTION_SLOWDOWN * (u * s + v * c)];
	}
	const sp = Math.hypot(u, v);
	if (sp > 60) {
		u *= 60 / sp;
		v *= 60 / sp;
	}
	return [u, v];
}

/**
 * Temperature (°C) at (x, y) km after `hours` of being carried by the winds
 * of `systems` (aloft, geostrophic), starting from a smooth north–south
 * contrast: warm to the south, cold to the north. Found by tracing the air
 * back to where it started (the flow is steady). Fronts appear where the
 * winds crowd warm and cold air together.
 */
export function advectedTemperature(
	systems: readonly System[],
	x: number,
	y: number,
	hours: number,
	lat = 45,
	initial = (yy: number) => 12 - 14 * Math.tanh(yy / 600)
) {
	let px = x;
	let py = y;
	const steps = Math.max(1, Math.ceil(hours / 2));
	const dt = (hours * 3600) / steps; // s
	for (let i = 0; i < steps; i++) {
		// Midpoint method, backwards in time.
		const [u1, v1] = wind(systems, px, py, lat, false);
		const mx = px - (u1 * dt) / 2000;
		const my = py - (v1 * dt) / 2000;
		const [u2, v2] = wind(systems, mx, my, lat, false);
		px -= (u2 * dt) / 1000;
		py -= (v2 * dt) / 1000;
	}
	return initial(py);
}

// ------------------------------------------------------------ 6. hurricanes

/** Sea surface temperature (°C) below which hurricanes do not form. */
export const GENESIS_SST = 26.5;
/** Hurricanes rarely form within this many degrees of the equator (f too small to start the spin). */
export const GENESIS_LAT = 5;

/**
 * Maximum potential intensity (m/s, sustained wind) over a sea surface at
 * `sst` °C: DeMaria & Kaplan (1994), fitted to Atlantic storms:
 * 28.2 + 55.8·e^(0.1813 (SST − 30)).
 */
export const maxIntensity = (sst: number) => 28.2 + 55.8 * Math.exp(0.1813 * (sst - 30));

/** Can a hurricane form here? */
export const canForm = (sst: number, lat: number) =>
	sst >= GENESIS_SST && Math.abs(lat) >= GENESIS_LAT;

/** Saffir–Simpson category for a sustained wind (m/s): 0 = below hurricane strength. */
export function category(v: number) {
	const limits = [33, 43, 50, 58, 70]; // m/s: 64, 83, 96, 113, 137 knots
	let c = 0;
	for (const l of limits) if (v >= l) c++;
	return c;
}

/** Wind (m/s) of the weak disturbance a hurricane starts from. */
export const STORM_SEED = 15;
/** Growth rate of a storm over warm sea (per hour, logistic). */
const STORM_GROWTH = 1 / 12;
/** E-folding time (hours) of a storm's decay over cool water, land or near the equator. */
export const STORM_DECAY_HOURS = 24;

/**
 * Wind speed of a storm `hours` after it had wind `v0` (m/s), if the sea
 * temperature and latitude then stay at `sst` and `lat`. Where a hurricane
 * can form, the wind grows (or, above the new ceiling, eases) towards the
 * maximum potential intensity by logistic growth at 1/12 per hour; where it
 * can't, it decays exponentially with a one-day e-folding time, as storms do
 * over cool water or land.
 * A sketch of typical intensification over 2–4 days; real storms vary a lot
 * (wind shear, dry air, the ocean cooling under them).
 */
export function stormEvolve(v0: number, sst: number, lat: number, hours: number) {
	if (v0 <= 0) return 0;
	if (!canForm(sst, lat)) return v0 * Math.exp(-hours / STORM_DECAY_HOURS);
	const vmax = maxIntensity(sst);
	return vmax / (1 + ((vmax - v0) / v0) * Math.exp(-STORM_GROWTH * hours));
}

/**
 * ∫₀ʰ stormEvolve(v0, sst, lat, h′) dh′ (m/s · hours), exact: how far the
 * storm's wind has carried the air round in those hours (used to turn it).
 */
export function stormWindIntegral(v0: number, sst: number, lat: number, hours: number) {
	if (v0 <= 0) return 0;
	if (!canForm(sst, lat))
		return v0 * STORM_DECAY_HOURS * (1 - Math.exp(-hours / STORM_DECAY_HOURS));
	const vmax = maxIntensity(sst);
	const r = STORM_GROWTH;
	const A = (vmax - v0) / v0;
	return vmax * (hours + Math.log((1 + A * Math.exp(-r * hours)) / (1 + A)) / r);
}

/**
 * Wind speed of a storm `hours` after it forms as a weak disturbance
 * (STORM_SEED, 15 m/s) at a fixed sea temperature and latitude: see
 * `stormEvolve`.
 */
export function stormIntensity(sst: number, lat: number, hours: number) {
	return stormEvolve(STORM_SEED, sst, lat, hours);
}
