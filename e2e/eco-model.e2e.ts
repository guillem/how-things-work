// Checks the population models behind the ecosystems explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	LV_DEFAULT,
	LV_START,
	WEB_START,
	logisticExact,
	logisticGrowth,
	lotkaVolterra,
	lvEquilibrium,
	lvInvariant,
	lvSmallPeriod,
	run,
	webRun
} from '../src/routes/ecosystems/eco';

const ALL4 = [true, true, true, true, false];

test('prey alone: logistic growth levels off at the carrying capacity', () => {
	const sim = run(logisticGrowth(1, 1000), [10], 20, 0.5);
	sim.forEach((s, i) => expect(s[0]).toBeCloseTo(logisticExact(10, 1, 1000, i * 0.5), 3));
	expect(sim.at(-1)![0]).toBeCloseTo(1000, 0);
});

test('predator and prey: cycles that close on themselves', () => {
	const sim = run(lotkaVolterra(LV_DEFAULT), LV_START, 60, 0.05);
	const v0 = lvInvariant(LV_DEFAULT, LV_START[0], LV_START[1]);
	for (const s of sim) expect(lvInvariant(LV_DEFAULT, s[0], s[1])).toBeCloseTo(v0, 5);
	// Starting at the balance point, nothing changes.
	const eq = lvEquilibrium(LV_DEFAULT);
	const still = run(lotkaVolterra(LV_DEFAULT), [eq.prey, eq.predators], 10, 0.5);
	expect(still.at(-1)![0]).toBeCloseTo(eq.prey, 6);
});

test('the predators’ peaks come after the prey’s, about every 8–9 years', () => {
	const dt = 0.05;
	const sim = run(lotkaVolterra(LV_DEFAULT), LV_START, 60, dt);
	const peaks = (k: number) =>
		sim.flatMap((s, i) =>
			i > 0 && i < sim.length - 1 && s[k] > sim[i - 1][k] && s[k] >= sim[i + 1][k] ? [i * dt] : []
		);
	const prey = peaks(0);
	const pred = peaks(1);
	const gaps = prey.slice(1).map((t, i) => t - prey[i]);
	for (const g of gaps) expect(g).toBeGreaterThan(7.5);
	for (const g of gaps) expect(g).toBeLessThan(9.5);
	expect(lvSmallPeriod(LV_DEFAULT)).toBeCloseTo(8.1, 1);
	// Each predator peak follows a prey peak by a fraction of a cycle.
	const lag = pred.find((t) => t > prey[0])! - prey[0];
	expect(lag).toBeGreaterThan(0.5);
	expect(lag).toBeLessThan(4);
});

test('food web: the starting community is a stable balance', () => {
	const end = webRun(ALL4, [110, 35, 22, 5, 0], 80).at(-1)!;
	WEB_START.forEach((v, i) => expect(end[i]).toBeCloseTo(v, 0));
});

test('removing the wolves: more elk, less willow, fewer beavers', () => {
	const end = webRun([true, true, true, false, false]).at(-1)!;
	expect(end[1]).toBeGreaterThan(WEB_START[1] * 1.3); // elk
	expect(end[0]).toBeLessThan(WEB_START[0] * 0.85); // willow
	expect(end[2]).toBeLessThan(WEB_START[2] * 0.8); // beaver — never touched by wolves
});

test('adding deer: the elk disappear, though deer never eat elk', () => {
	const end = webRun([true, true, true, true, true]).at(-1)!;
	expect(end[4]).toBeGreaterThan(20); // deer established
	expect(end[1]).toBeLessThan(1); // elk gone
	expect(end[3]).toBeGreaterThan(WEB_START[3]); // more wolves
});
