// The transect of the tsunamis explainer: the great circle through the epicentre of the 2011
// Tōhoku earthquake and the Crescent City tide gauge, shared by fetch.mjs and build.mjs.

const R = 6371.0;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** USGS epicentre of the 11 March 2011 Mw 9.1 Tōhoku earthquake (event usp000hvnu). */
export const EPICENTRE = { lat: 38.297, lon: 142.373 };
/** NOAA CO-OPS station 9419750, Crescent City, California. */
export const CRESCENT_CITY = { lat: 41.745, lon: -124.184 };
/** Spacing of the profile, km. */
export const DX_KM = 2;
/** The track runs from FROM_KM (west of the epicentre, inland) to TO_KM (inland in California). */
export const FROM_KM = -300;
export const TO_KM = 7600;

const xyz = ({ lat, lon }) => [
	Math.cos(rad(lat)) * Math.cos(rad(lon)),
	Math.cos(rad(lat)) * Math.sin(rad(lon)),
	Math.sin(rad(lat))
];
const cross = (a, b) => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => {
	const n = Math.sqrt(dot(a, a));
	return a.map((x) => x / n);
};

const E = xyz(EPICENTRE);
const C = xyz(CRESCENT_CITY);
const N = unit(cross(E, C));
const T = cross(N, E);

/** Great-circle distance from the epicentre to Crescent City, km. */
export const CC_KM = Math.acos(dot(E, C)) * R;

/** The point `km` along the track from the epicentre (negative: towards Japan). */
export function at(km) {
	const a = km / R;
	const v = [0, 1, 2].map((i) => Math.cos(a) * E[i] + Math.sin(a) * T[i]);
	return { lat: deg(Math.atan2(v[2], Math.hypot(v[0], v[1]))), lon: deg(Math.atan2(v[1], v[0])) };
}

/** A place's distance along the track from the epicentre and off it (to the north), km. */
export function project(p) {
	const v = xyz(p);
	const off = Math.asin(dot(v, N)) * R;
	const q = unit(v.map((x, i) => x - dot(v, N) * N[i]));
	const along = Math.atan2(dot(cross(E, q), N), dot(E, q)) * R;
	return { along, off };
}
