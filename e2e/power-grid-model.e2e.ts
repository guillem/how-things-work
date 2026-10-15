// Checks the power-grid model: the frequency after a trip against the rules Continental
// Europe's grid is designed to (ENTSO-E), the real day of Spanish data against REE's own
// totals, the island game, and the losses of a transmission line. Runs in Node.
import { expect, test } from '@playwright/test';
import { DAY } from '../src/routes/power-grid/day';
import {
	CE,
	R_PER_KM,
	UNDER_TRIP,
	at,
	autopilot,
	dailyEnergy,
	demandExtremes,
	gridAt,
	island,
	line,
	realDispatch,
	settledDeviation,
	trip,
	unlisted
} from '../src/routes/power-grid/grid';

const sampleAt = (r: ReturnType<typeof trip>, t: number) => r.samples.find((s) => s.t >= t)!;

test('the reference incident: 3,000 MW lost is held above 49.2 Hz and settles 167 mHz low', () => {
	const r = trip({ lost: CE.reference });
	// the CE design limits: 800 mHz instantaneous, 200 mHz steady state
	expect(r.nadir).toBeGreaterThan(49.2);
	expect(r.nadir).toBeCloseTo(49.71, 2);
	expect(settledDeviation(CE.reference)).toBeCloseTo(-0.167, 3);
	expect(r.final).toBeCloseTo(49.83, 2);
	expect(r.steps).toBe(0);
});

test('the primary reserve is half deployed within 15 s and all of it within 30 s', () => {
	const r = trip({ lost: CE.reference });
	// the trip happens at t = 1 s; the deviation passes 200 mHz in the first seconds
	expect(sampleAt(r, 16).fcr).toBeGreaterThan(0.5 * CE.fcr);
	const full = trip({ lost: 6000, ufls: false });
	expect(sampleAt(full, 31).fcr).toBeGreaterThan(0.98 * CE.fcr);
});

test('the frequency falls at 50 Hz × ΔP / 2E: 0.071 Hz/s at 30% solar and wind, 3.5 times faster at 80%', () => {
	const a = trip({ lost: 3000, inverterShare: 0.3 });
	expect(a.kinetic).toBe(1_050_000);
	expect(a.rocof).toBeCloseTo(-0.0714, 4);
	// the integrated trace has that slope just after the trip
	const slope = (sampleAt(a, 1.5).f - sampleAt(a, 1).f) / 0.5;
	expect(slope).toBeCloseTo(a.rocof, 2);
	const b = trip({ lost: 3000, inverterShare: 0.8 });
	expect(b.rocof / a.rocof).toBeCloseTo(3.5, 5);
	expect(b.nadir).toBeLessThan(a.nadir);
});

test('with no controls at all, 3,000 MW too little leaves the frequency a whole hertz low', () => {
	const r = trip({ lost: 3000, fcr: false, ufls: false, duration: 120 });
	expect(r.final).toBeCloseTo(49.0, 2);
	expect(trip({ lost: -3000, fcr: false, ufls: false, duration: 120 }).final).toBeGreaterThan(50.2);
});

test('secondary control brings the frequency back to 50 Hz within five minutes, well inside 15', () => {
	const r = trip({ lost: 3000, afrr: true, duration: 900 });
	const back = r.samples.find((s) => s.t > 60 && Math.abs(s.f - 50) < 0.01)!;
	expect(back.t).toBeLessThan(300);
	const end = r.samples.at(-1)!;
	expect(end.afrr).toBeCloseTo(3000, -1);
	expect(Math.abs(end.fcr)).toBeLessThan(10);
});

test('losing 20,000 MW: shedding at 49.0 Hz saves the grid; without it, it falls past 47.5 Hz', () => {
	const r = trip({ lost: 20000 });
	expect(r.steps).toBe(1);
	expect(r.nadir).toBeGreaterThan(48.9);
	expect(r.nadir).toBeLessThan(49.0);
	// generators turn down above 50.2 Hz, so the overshoot stays far from the 51.5 Hz trip
	expect(r.zenith).toBeLessThan(50.5);
	expect(r.blackoutAt).toBeNull();
	const off = trip({ lost: 20000, ufls: false });
	expect(off.blackoutAt).not.toBeNull();
	expect(off.samples.at(-1)!.f).toBeLessThan(UNDER_TRIP);
	// the worst case on the slider is still caught before generators trip on over-frequency
	expect(trip({ lost: 30000 }).zenith).toBeLessThan(51.5);
});

test('the day: Spanish mainland demand on 9 April 2025 agrees with REE’s final daily figure', () => {
	expect(DAY).toHaveLength(24);
	// REData (apidatos.ree.es, demanda/evolucion, peninsular): 626,185 MWh for the day
	expect(dailyEnergy('demand') / 626_185).toBeGreaterThan(0.98);
	expect(dailyEnergy('demand') / 626_185).toBeLessThan(1.0);
	expect(Math.round(dailyEnergy('demand') / 1000)).toBe(620);
	const { max, min } = demandExtremes();
	expect(max.hour).toBe(21);
	expect(Math.round(max.demand / 100) * 100).toBe(31300);
	expect(min.hour).toBe(4);
	expect(Math.round(min.demand / 100) * 100).toBe(21300);
	// the listed sources cover the demand to within 1.5% every hour
	for (const h of DAY) {
		const gap = unlisted(h.hour + 0.5);
		expect(gap).toBeGreaterThan(0);
		expect(gap / h.demand).toBeLessThan(0.015);
	}
});

test('the mix: nuclear flat, solar peaking at noon, surplus exported and pumped, a steep evening', () => {
	for (const h of DAY) expect(Math.abs(h.nuclear - 6100)).toBeLessThan(100);
	const solarPeak = DAY.reduce((a, b) => (b.solarPV > a.solarPV ? b : a));
	expect(solarPeak.hour).toBe(12);
	expect(Math.round(solarPeak.solarPV / 100) * 100).toBe(15800);
	expect(DAY[21].solarPV).toBeLessThan(200);
	expect(Math.round(Math.min(...DAY.map((h) => h.exchange)) / 100) * 100).toBe(-6000);
	expect(Math.round(Math.min(...DAY.map((h) => h.pumping)) / 100) * 100).toBe(-3100);
	// what the controllable plants and imports supply rises by more than 12 GW from 6 to 8 p.m.
	const flexible = (h: number) => DAY[h].gas + DAY[h].hydro + DAY[h].pumping + DAY[h].exchange;
	expect(flexible(20) - flexible(18)).toBeGreaterThan(12000);
	expect(at(12.5, 'solarPV')).toBe(DAY[12].solarPV);
});

test('the island: the real schedule holds 50 Hz; a mismatch over the reserve leaves the band', () => {
	for (let h = 0; h < 24; h += 0.25) {
		expect(gridAt(h, realDispatch(h)).grid.f).toBeCloseTo(50, 6);
	}
	// at noon, curtailing a tenth of solar and wind removes about 1.8 GW: the frequency falls
	const noon = realDispatch(12.5);
	expect(gridAt(12.5, { ...noon, curtail: 0.1 }).surplus).toBeCloseTo(-0.1 * (15766 + 1972), -1);
	expect(gridAt(12.5, { ...noon, nuclear: noon.nuclear - 500 }).grid.f).toBeLessThan(50);
	expect(island(-1000, 25000).f).toBeGreaterThan(49.8);
	expect(island(-1200, 25000).f).toBeLessThan(49.8);
	expect(island(1200, 25000).f).toBeGreaterThan(50.2);
	// past the reserve the frequency falls fast; at 49.0 Hz customers are cut off
	const short = island(-2000, 25000);
	expect(short.shed).toBe(0.075 * 25000);
	expect(short.f).toBeGreaterThan(49.0);
});

test('the island loses its reactor: 49.81 Hz, then the autopilot restores 50 Hz within minutes', () => {
	const ev = { trip: 12 };
	expect(gridAt(12, realDispatch(12), ev).grid.f).toBeCloseTo(49.81, 2);
	expect(gridAt(12, realDispatch(12), ev).grid.shed).toBe(0);
	expect(gridAt(12.5, autopilot(12.5, ev), ev).grid.f).toBeCloseTo(50, 2);
	expect(gridAt(14, realDispatch(14), ev).grid.f).toBeCloseTo(49.81, 2);
});

test('a cloud at noon takes 2,800 MW of solar: unanswered, it sheds 2,000 MW of customers', () => {
	const ev = { cloud: 12 };
	const lost = at(12.5, 'solarPV') - gridAt(12.5, realDispatch(12.5), ev).sources.solarPV;
	expect(Math.round(lost / 100) * 100).toBe(2800);
	const none = gridAt(12.5, realDispatch(12.5), ev).grid;
	expect(Math.round(none.shed / 100) * 100).toBe(2000);
	// the autopilot keeps it inside the band all the way through
	for (let h = 12; h < 13.5; h += 0.02) {
		const f = gridAt(h, autopilot(h, ev), ev).grid.f;
		expect(Math.abs(f - 50)).toBeLessThan(0.2);
	}
});

test('transmission: 1,000 MW over 200 km loses 2.4% at 400 kV and 22% at 132 kV', () => {
	expect(R_PER_KM).toBeCloseTo(0.0188, 4);
	const hi = line(1000, 400, 200);
	expect(hi.current).toBeCloseTo(1443, 0);
	expect(hi.share).toBeCloseTo(0.0235, 4);
	expect(line(1000, 220, 200).share).toBeCloseTo(0.078, 3);
	const lo = line(1000, 132, 200);
	expect(lo.share).toBeCloseTo(0.216, 3);
	expect(lo.overheated).toBe(true);
	expect(lo.share / hi.share).toBeCloseTo((400 / 132) ** 2, 6);
	expect(line(1000, 20, 200).impossible).toBe(true);
	expect(Math.round(line(1000, 20, 200).current / 100) * 100).toBe(28900);
	// halving the current quarters the loss
	expect(line(500, 400, 200).loss / hi.loss).toBeCloseTo(0.25, 6);
});
