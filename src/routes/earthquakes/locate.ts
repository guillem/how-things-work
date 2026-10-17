/**
 * Finding an epicentre from three seismograms: the S − P time at each station gives its
 * distance from the earthquake (through the ak135 travel times, `earth.ts`), and the epicentre
 * lies on a circle of that radius round each station, drawn on the sphere. The real recordings
 * of the 2015 Gorkha earthquake are in `data/seismograms.ts`.
 */
import { DEG, arrivalOf, distanceFromSMinusP, sMinusP } from './earth';
import { ORIGIN, RECORDINGS, type Recording } from './data/seismograms';

export { ORIGIN, RECORDINGS, type Recording };

const RAD = 1 / DEG;

/** Great-circle distance between two points, degrees. */
export function gcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const [p1, p2, dl] = [lat1 * RAD, lat2 * RAD, (lon2 - lon1) * RAD];
	const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
	return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/** The point `dist` degrees from (lat, lon) in the direction `az` (degrees clockwise from north). */
function destination(lat: number, lon: number, az: number, dist: number): [number, number] {
	const [p1, l1, a, d] = [lat * RAD, lon * RAD, az * RAD, dist * RAD];
	const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(a));
	const l2 =
		l1 +
		Math.atan2(Math.sin(a) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
	return [((((l2 * DEG + 180) % 360) + 360) % 360) - 180, p2 * DEG];
}

/** The circle of all points `radius` degrees from (lat, lon), as [lon, lat] points. */
export const smallCircle = (lat: number, lon: number, radius: number, n = 180) =>
	Array.from({ length: n + 1 }, (_, i) => destination(lat, lon, (360 * i) / n, radius));

/** Earthquake depth used for locating, km (the USGS depth of the Gorkha earthquake). */
const DEPTH = ORIGIN.depth;

interface Station {
	rec: Recording;
	/** True distance from the epicentre, degrees. */
	dist: number;
	/** S − P that ak135 predicts at that distance, s. */
	lag: number;
	/** P arrival that ak135 predicts, s after the origin. */
	pModel: number;
}

export const stations: Station[] = RECORDINGS.map((rec) => {
	const dist = gcDistance(ORIGIN.lat, ORIGIN.lon, rec.lat, rec.lon);
	return {
		rec,
		dist,
		lag: sMinusP(dist, DEPTH) ?? NaN,
		pModel: arrivalOf('P', dist, DEPTH) ?? NaN
	};
});

/** Distance in degrees for a measured S − P time (s). */
export const distanceFor = (lag: number) => distanceFromSMinusP(lag, DEPTH);

/**
 * The point whose distances to the stations best match `radii` (degrees), by least squares
 * over a 0.1° grid around the best point of a coarse 2° grid. Also returns the root-mean-square
 * miss, degrees.
 */
export function bestFit(points: { lat: number; lon: number }[], radii: number[]) {
	const miss = (lat: number, lon: number) =>
		Math.sqrt(
			points.reduce((s, p, i) => s + (gcDistance(lat, lon, p.lat, p.lon) - radii[i]) ** 2, 0) /
				points.length
		);
	let best = { lat: 0, lon: 0, rms: Infinity };
	for (let lat = -88; lat <= 88; lat += 2)
		for (let lon = -180; lon < 180; lon += 2) {
			const rms = miss(lat, lon);
			if (rms < best.rms) best = { lat, lon, rms };
		}
	const c = best;
	for (let lat = c.lat - 2; lat <= c.lat + 2; lat += 0.1)
		for (let lon = c.lon - 2; lon <= c.lon + 2; lon += 0.1) {
			const rms = miss(lat, lon);
			if (rms < best.rms) best = { lat, lon, rms };
		}
	return best;
}
