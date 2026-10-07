/**
 * Geometry of the Sun, Earth and Moon, from first principles with mean
 * orbital values. Angles in degrees unless stated.
 *
 * Simplifications (stated on the page where they matter):
 * - Earth's orbit is treated as a circle for the seasons; its real
 *   eccentricity (0.0167) only enters the "distance" step, where it is the point;
 * - the Moon's orbit is a circle inclined 5.145° to Earth's, with its nodes
 *   fixed in space (in reality they drift round once every 18.6 years);
 * - eclipse limits use mean apparent sizes and the Moon's mean parallax;
 * - tides are the "equilibrium tide": the shape the ocean would take if it
 *   could follow the tidal forces instantly (real coasts add delays and
 *   resonances).
 */

export const TILT = 23.44;
export const MOON_INCLINATION = 5.145;
export const ECCENTRICITY = 0.0167;
/** Days in a year, and from new Moon to new Moon (synodic month). */
export const YEAR = 365.2422;
export const SYNODIC_MONTH = 29.5306;
/** Day of the year (0 = 1 January) of the March equinox and of perihelion, approximately. */
export const MARCH_EQUINOX_DAY = 79;
export const PERIHELION_DAY = 3;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Equation of centre (degrees): how far ahead of uniform motion the Earth is, to first order in e. */
const centre = (day: number) =>
	deg(2 * ECCENTRICITY * Math.sin(((day - PERIHELION_DAY) / YEAR) * 2 * Math.PI));
/** Day on which the uniform ("mean") longitude is 0, chosen so the true longitude is 0 on MARCH_EQUINOX_DAY. */
const MEAN_ZERO_DAY = MARCH_EQUINOX_DAY + (centre(MARCH_EQUINOX_DAY) / 360) * YEAR;

/**
 * Sun's ecliptic longitude (0 at the March equinox, 180 at the September one)
 * on a day of the year. The Earth moves a little faster near perihelion in
 * January (Kepler's second law), so the first-order equation of centre is
 * added to uniform motion; this puts the September equinox on 22–23 September,
 * not 20.
 */
export const sunLongitude = (day: number) =>
	(((((day - MEAN_ZERO_DAY) / YEAR) * 360 + centre(day)) % 360) + 360) % 360;

/** Solar declination: the latitude where the Sun is overhead at noon. */
export const declination = (longitude: number, tilt = TILT) =>
	deg(Math.asin(Math.sin(rad(tilt)) * Math.sin(rad(longitude))));

/**
 * Hours of daylight at latitude `lat` when the solar declination is `dec`
 * (geometric: Sun's centre above the horizon, no refraction). 0 = polar
 * night, 24 = midnight Sun.
 */
export function dayLength(lat: number, dec: number) {
	const x = -Math.tan(rad(lat)) * Math.tan(rad(dec));
	if (x >= 1) return 0;
	if (x <= -1) return 24;
	return (2 * deg(Math.acos(x))) / 15;
}

/** Height of the Sun above the horizon at local noon (negative: below). */
export const noonAltitude = (lat: number, dec: number) => 90 - Math.abs(lat - dec);

/**
 * Sunlight energy reaching each square metre of flat ground, relative to
 * the Sun overhead: the same beam is spread over 1/sin(altitude) as much
 * ground. 0 when the Sun is below the horizon.
 */
export const spreading = (altitude: number) => Math.max(0, Math.sin(rad(altitude)));

/**
 * Daily total sunshine on flat ground at the top of the atmosphere, relative
 * to the equator at an equinox (standard daily-insolation formula).
 */
export function dailySunshine(lat: number, dec: number, distanceFactor = 1) {
	const p = rad(lat);
	const d = rad(dec);
	const h0 = rad((dayLength(lat, dec) * 15) / 2);
	const q = h0 * Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.sin(h0);
	return q * distanceFactor; // equator at an equinox: h0 = π/2, so q = 1
}

/** Earth–Sun distance in astronomical units on a day of the year (eccentric orbit, first order). */
export const sunDistance = (day: number) =>
	1 - ECCENTRICITY * Math.cos(((day - PERIHELION_DAY) / YEAR) * 2 * Math.PI);

// ------------------------------------------------------------------ Moon

/**
 * Fraction of the Moon's face lit as seen from Earth, for an elongation
 * (angle Sun–Earth–Moon) in degrees: 0 at new Moon, 1 at full.
 */
export const litFraction = (elongation: number) => (1 - Math.cos(rad(elongation))) / 2;

/** Name of the phase for a phase angle (0 = new, 90 = first quarter, 180 = full, 270 = last quarter). */
export function phaseName(angle: number) {
	const a = ((angle % 360) + 360) % 360;
	if (a < 11.25 || a >= 348.75) return 'new Moon';
	if (a < 78.75) return 'waxing crescent';
	if (a < 101.25) return 'first quarter';
	if (a < 168.75) return 'waxing gibbous';
	if (a < 191.25) return 'full Moon';
	if (a < 258.75) return 'waning gibbous';
	if (a < 281.25) return 'last quarter';
	return 'waning crescent';
}

/**
 * How far the Moon is above or below the plane of Earth's orbit (ecliptic
 * latitude), given how far round it is from its ascending node.
 */
export const moonLatitude = (fromNode: number, inclination = MOON_INCLINATION) =>
	deg(Math.asin(Math.sin(rad(inclination)) * Math.sin(rad(fromNode))));

/** Mean apparent radii seen from Earth, and the Moon's mean horizontal parallax (degrees). */
export const SUN_RADIUS = 0.267;
export const MOON_RADIUS = 0.259;
export const MOON_PARALLAX = 0.951;
export const SUN_PARALLAX = 0.0024;

/**
 * Limits on the Moon's distance from the ecliptic (degrees) for an eclipse
 * at new or full Moon:
 * - solar: the Moon covers part of the Sun as seen from somewhere on Earth
 *   when the centres, seen from Earth's centre, are closer than the two radii
 *   plus the Moon's parallax (an observer can be up to one Earth radius off-centre);
 * - lunar (umbral): the Moon touches the umbra, whose radius at the Moon's
 *   distance is about 1.02 × (Moon parallax + Sun parallax − Sun radius), the
 *   2% widening accounting for Earth's atmosphere.
 */
export const SOLAR_LIMIT = SUN_RADIUS + MOON_RADIUS + MOON_PARALLAX - SUN_PARALLAX;
export const UMBRA_RADIUS = 1.02 * (MOON_PARALLAX + SUN_PARALLAX - SUN_RADIUS);
export const LUNAR_LIMIT = UMBRA_RADIUS + MOON_RADIUS;

export type Eclipse = 'solar' | 'lunar' | null;

/**
 * Whether a new Moon (phase 0) or full Moon (phase 180) at this distance from
 * the node (degrees along the Moon's orbit) makes an eclipse.
 */
export function eclipseAt(phase: number, fromNode: number): Eclipse {
	const beta = Math.abs(moonLatitude(fromNode));
	const a = ((phase % 360) + 360) % 360;
	if (Math.min(a, 360 - a) < 1e-6) return beta < SOLAR_LIMIT ? 'solar' : null;
	if (Math.abs(a - 180) < 1e-6) return beta < LUNAR_LIMIT ? 'lunar' : null;
	return null;
}

/** How close to a node (degrees, either node) a syzygy must fall for an eclipse. */
export const nodeWindow = (limit: number) =>
	deg(Math.asin(Math.sin(rad(limit)) / Math.sin(rad(MOON_INCLINATION))));

// ------------------------------------------------------------------ tides

/** The Sun's tide-raising effect relative to the Moon's (mass / distance³). */
export const SUN_TIDE_RATIO = 0.46;

/**
 * Equilibrium tide height (relative units, Moon alone = ±1) at longitude
 * `place` on the equator, with the Moon and Sun in the directions `moon` and
 * `sun` (degrees, all in the same frame).
 */
export const tideHeight = (place: number, moon: number, sun: number) =>
	Math.cos(2 * rad(place - moon)) + SUN_TIDE_RATIO * Math.cos(2 * rad(place - sun));

/** Tidal range (high − low) relative to the Moon alone, for a Moon–Sun angle. */
export function tidalRange(moonSunAngle: number) {
	const c = Math.cos(2 * rad(moonSunAngle));
	const amp = Math.sqrt(1 + SUN_TIDE_RATIO ** 2 + 2 * SUN_TIDE_RATIO * c);
	return 2 * amp;
}
