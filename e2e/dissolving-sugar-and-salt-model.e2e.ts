import { expect, test } from '@playwright/test';
import { glass, solubility } from '../src/routes/dissolving-sugar-and-salt/model';

test('room-temperature water takes about 204 g of sugar but only 36 g of salt (ACS measurements)', () => {
	expect(glass('sugar', 16, 20).dissolved).toBe(204);
	expect(glass('salt', 16, 20).dissolved).toBe(36);
	expect(glass('sugar', 1, 20).solid).toBe(0);
	expect(glass('salt', 2, 20).solid).toBe(4);
});

test('warming dissolves the extra sugar while salt barely changes; cooling brings sugar back', () => {
	const sugarCold = glass('sugar', 16, 0);
	const sugarWarm = glass('sugar', 16, 80);
	expect(sugarWarm.dissolved).toBe(320);
	expect(sugarCold.solid).toBe(141);
	expect(glass('salt', 16, 80).dissolved - glass('salt', 16, 0).dissolved).toBe(2.5);
	// ACS asks pupils to read the 50 °C value, about 260 g sugar and 37 g salt.
	expect(solubility('sugar', 50)).toBeCloseTo(264.5, 1);
	expect(solubility('salt', 50)).toBe(37);
});

test('evaporation conserves each solid, concentrates it, then recovers all of it', () => {
	for (const solute of ['sugar', 'salt'] as const) {
		let lastDissolved = Infinity;
		for (let dry = 0; dry <= 100; dry += 5) {
			const state = glass(solute, 10, 20, dry);
			expect(state.dissolved + state.solid).toBeCloseTo(200, 8);
			expect(state.mass + dry).toBeCloseTo(300, 8);
			expect(state.dissolved).toBeLessThanOrEqual(lastDissolved);
			lastDissolved = state.dissolved;
		}
		expect(glass(solute, 10, 20, 100).solid).toBe(200);
		expect(glass(solute, 10, 20, 100).dissolved).toBe(0);
	}
});

test('twice as much water takes twice as much before saturation, and heat does not create sugar', () => {
	expect(glass('sugar', 20, 20, 50).capacity * 2).toBe(glass('sugar', 20, 20).capacity);
	for (const temperature of [0, 20, 50, 80, 100]) {
		const s = glass('sugar', 1, temperature);
		expect(s.dissolved).toBe(20);
		expect(s.solid).toBe(0);
	}
});
