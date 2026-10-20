// Fireflies as pulse-coupled clocks: no nudge, no sync; a nudge, and the whole field flashes as one.
import { expect, test } from '@playwright/test';
import { inStep, run, scramble, swarm, tick } from '../src/routes/fireflies-in-sync/model';

test('each firefly flashes about once a second on its own', () => {
	const s = swarm(50, 2);
	let flashes = 0;
	for (let k = 0; k < 600; k++) flashes += tick(s, 0).reduce((a, b) => a + b, 0);
	// Ten seconds: about ten flashes each.
	expect(flashes / 50).toBeGreaterThan(9);
	expect(flashes / 50).toBeLessThan(11);
});

test('with no nudge the meadow stays out of step', () => {
	const s = run(swarm(), 0, 60);
	expect(inStep(s)).toBeLessThan(0.3);
});

test('with a nudge, the whole field falls into step within a minute', () => {
	const s = swarm();
	expect(inStep(s)).toBeLessThan(0.3);
	run(s, 0.06, 60);
	expect(inStep(s)).toBeGreaterThan(0.95);
});

test('a stronger nudge brings them into step sooner', () => {
	const timeTo = (nudge: number) => {
		const s = swarm();
		for (let t = 0; t < 120; t += 1) {
			run(s, nudge, 1);
			if (inStep(s) > 0.95) return t + 1;
		}
		return Infinity;
	};
	expect(timeTo(0.06)).toBeLessThan(timeTo(0.04));
});

test('scramble a patch and it falls back into step', () => {
	const s = run(swarm(), 0.06, 60);
	scramble(s, 450, 230, 120, 9);
	expect(inStep(s)).toBeLessThan(0.92);
	run(s, 0.06, 30);
	expect(inStep(s)).toBeGreaterThan(0.95);
});

test('the same start always ends the same way', () => {
	const a = run(swarm(), 0.06, 20);
	const b = run(swarm(), 0.06, 20);
	expect([...a.phase]).toEqual([...b.phase]);
});
