// Checks the tsunami model against the real world: NOAA's speed of a tsunami over 4,600 m of
// water; a wind wave's speed, which hardly depends on the depth; a hump splitting into two
// halves that run at √(g h); Green's law for the growth of a wave over shallower water; and the
// 2011 Tōhoku tsunami itself, whose first crests reached three DART buoys and the Crescent City
// tide gauge within minutes of the times the model gives on the real sea floor (ETOPO 2022),
// rising first, as the records do, while the model's heights are an upper bound (a slice of the
// ocean cannot spread sideways). Runs the page's own model, in Node.
import { expect, test } from '@playwright/test';
import {
	COAST_KM,
	JAPAN_KM,
	N,
	Ocean,
	STATIONS,
	cellAt,
	firstCrest,
	floorDepths,
	kmOf,
	kmh,
	shallowSpeed,
	waveSpeed
} from '../src/routes/tsunamis/model';

test.describe.configure({ mode: 'parallel' });

/** The real floor's run, watching the stations and both coasts, to `hours`. */
function realRun(hours: number, uplift = 5) {
	const o = new Ocean(
		floorDepths(),
		uplift,
		STATIONS.map((s) => s.km)
	);
	o.advanceTo(hours * 3600);
	return o;
}

test('NOAA: about 765 km/h over 4,600 m of water', () => {
	expect(kmh(shallowSpeed(4600))).toBeCloseTo(765, -1);
});

test('a wind wave hardly notices the depth; a tsunami’s speed is set by it', () => {
	// a 10-second swell: about 56 km/h over the abyss and over a 200 m shelf alike
	expect(kmh(waveSpeed(10, 4600))).toBeCloseTo(56.2, 0);
	expect(waveSpeed(10, 200) / waveSpeed(10, 4600)).toBeCloseTo(1, 3);
	// a wave 20 minutes long goes at √(g h) over the deepest ocean: it is a shallow-water wave
	expect(waveSpeed(1200, 4600) / shallowSpeed(4600)).toBeGreaterThan(0.99);
	expect(shallowSpeed(4600) / shallowSpeed(200)).toBeCloseTo(Math.sqrt(23), 6);
});

test('a hump splits in two, each half as high, running at √(g h)', () => {
	const h = new Float64Array(N).fill(4000);
	const o = new Ocean(h, 2, []);
	o.advanceTo(3600);
	const crestKm = (from: number, to: number) => {
		let best = cellAt(from);
		for (let i = cellAt(from); i <= cellAt(to); i++) if (o.eta[i] > o.eta[best]) best = i;
		return { km: kmOf(best), height: o.eta[best] };
	};
	const east = crestKm(400, 2000);
	const speed = ((east.km - 110) * 1000) / 3600;
	expect(speed / shallowSpeed(4000)).toBeCloseTo(1, 1);
	expect(east.height).toBeGreaterThan(0.9);
	expect(east.height).toBeLessThan(1.05);
});

test('Green’s law: sixteen times shallower, twice as high', () => {
	// 4,000 m deep, a gentle 1,000 km ramp up to 250 m, then 250 m deep until the coast
	const h = Float64Array.from({ length: N }, (_, i) => {
		const km = kmOf(i);
		if (km < 1000) return 4000;
		if (km > 2000) return 250;
		return 4000 + ((250 - 4000) * (km - 1000)) / 1000;
	});
	const o = new Ocean(h, 2, []);
	o.advanceTo(7 * 3600);
	const deep = o.peak[cellAt(800)];
	const shallow = o.peak[cellAt(2050)];
	expect(shallow / deep).toBeGreaterThan(1.9);
	expect(shallow / deep).toBeLessThan(2.1);
});

test('the 2011 tsunami’s first crests arrive when the real records show them', () => {
	const o = realRun(11);
	for (const [k, s] of STATIONS.entries()) {
		const crest = firstCrest(o.records[k], 0.05);
		expect(crest, s.name).not.toBeNull();
		// within 3 % of the travel time, or 5 minutes
		const tolerance = Math.max(5, 0.03 * s.crestMin);
		expect(Math.abs(crest!.minute - s.crestMin), s.name).toBeLessThanOrEqual(tolerance);
	}
	// Crescent City: just under ten hours after the earthquake
	const cc = STATIONS.at(-1)!;
	expect(cc.name).toBe('Crescent City');
	expect(cc.crestMin).toBeGreaterThan(9.5 * 60);
	expect(cc.crestMin).toBeLessThan(10.5 * 60);
});

test('the sea rises first out in the Pacific and draws back first on the Japanese coast', () => {
	const o = realRun(1.5);
	for (const [k, s] of STATIONS.slice(0, 2).entries()) {
		const r = o.records[k];
		const first = r.find((v) => Math.abs(v) > 0.05)!;
		expect(first, s.name).toBeGreaterThan(0);
		// and so does the real record
		const real = s.record.find((v) => Math.abs(v) > 10)!;
		expect(real, s.name).toBeGreaterThan(0);
	}
	const japan = new Ocean(floorDepths(), 5, [JAPAN_KM]);
	japan.advanceTo(3600);
	const first = japan.records[0].find((v) => Math.abs(v) > 0.05)!;
	expect(first).toBeLessThan(0);
});

test('a slice of the ocean overestimates far-away heights: an upper bound', () => {
	const o = realRun(11);
	for (const [k, s] of STATIONS.entries()) {
		const crest = firstCrest(o.records[k], 0.05)!;
		expect(crest.height * 100, s.name).toBeGreaterThan(s.crestCm);
	}
});

test('the wave grows over the shelf and passes less of itself over a high ridge', () => {
	const o = new Ocean(floorDepths(), 5, [COAST_KM - 600, COAST_KM]);
	o.advanceTo(11 * 3600);
	const atSea = Math.max(...o.records[0]);
	const atCoast = Math.max(...o.records[1]);
	expect(atCoast / atSea).toBeGreaterThan(3);
	const pass = (top: number | null) => {
		const r = new Ocean(floorDepths(top === null ? {} : { ridge: { km: 3000, top } }), 5, [5000]);
		r.advanceTo(8 * 3600);
		return Math.max(...r.records[0]);
	};
	const open = pass(null);
	expect(pass(2000)).toBeGreaterThan(0.95 * open);
	expect(pass(100)).toBeLessThan(0.8 * open);
	// in a slice an island is a wall: nothing gets past it
	expect(pass(0)).toBeLessThan(0.01);
});
