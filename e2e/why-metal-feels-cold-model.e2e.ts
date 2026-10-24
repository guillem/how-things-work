import { expect, test } from '@playwright/test';
import {
	HAND,
	SKIN,
	contactTemperature,
	heatTransferred,
	materials,
	temperatureAt
} from '../src/routes/why-metal-feels-cold/model';

const metal = materials[0];
const wood = materials[1];
const wool = materials[3];

test('first touch cools skin far more on aluminium than on wood or loose wool', () => {
	// Ideal perfect-contact limiting temperatures; real contact resistance reduces cooling.
	expect(contactTemperature(metal, 20)).toBeGreaterThan(20);
	expect(contactTemperature(metal, 20)).toBeLessThan(21);
	expect(contactTemperature(wood, 20)).toBeGreaterThan(28);
	expect(contactTemperature(wood, 20)).toBeLessThan(29);
	expect(contactTemperature(wool, 20)).toBeGreaterThan(32);
});

test('equal temperatures exchange no heat; a hotter room reverses the order', () => {
	for (const m of materials) {
		expect(contactTemperature(m, HAND)).toBeCloseTo(HAND, 10);
		expect(heatTransferred(m, HAND, 1)).toBe(0);
		expect(heatTransferred(m, 40, 1)).toBeLessThan(0);
		expect(contactTemperature(m, 40)).toBeGreaterThan(HAND);
	}
	expect(contactTemperature(metal, 40)).toBeGreaterThan(contactTemperature(wood, 40));
	expect(contactTemperature(wood, 40)).toBeGreaterThan(contactTemperature(wool, 40));
});

test('diffusion conserves energy across the contact and penetrates farther into aluminium', () => {
	// Integrate the two temperature profiles independently into stored energy per m².
	const dt = 0.001;
	const seconds = 0.1;
	for (const m of materials) {
		let intoObject = 0;
		let outOfSkin = 0;
		// Scaled coordinates cover ten diffusion lengths of each material.
		const skinScale = Math.sqrt((SKIN.k / (SKIN.rho * SKIN.cp)) * seconds);
		const objectScale = Math.sqrt((m.k / (m.rho * m.cp)) * seconds);
		for (let z = dt / 2; z < 10; z += dt) {
			intoObject +=
				m.rho *
				m.cp *
				(temperatureAt(m, 20, z * objectScale, seconds, 'object') - 20) *
				dt *
				objectScale;
			outOfSkin +=
				SKIN.rho *
				SKIN.cp *
				(HAND - temperatureAt(m, 20, z * skinScale, seconds, 'skin')) *
				dt *
				skinScale;
		}
		expect(intoObject).toBeCloseTo(heatTransferred(m, 20, seconds), 2);
		expect(outOfSkin).toBeCloseTo(intoObject, 2);
	}
	expect(temperatureAt(metal, 20, 0.002, 0.1, 'object')).toBeGreaterThan(20.3);
	expect(temperatureAt(wood, 20, 0.002, 0.1, 'object')).toBeCloseTo(20, 4);
});

test('heat storage matters as well as conductivity, and cumulative heat grows with diffusion', () => {
	const denser = { ...wood, rho: wood.rho * 4 };
	expect(contactTemperature(denser, 20)).toBeLessThan(contactTemperature(wood, 20));
	expect(heatTransferred(metal, 20, 0.4)).toBeCloseTo(2 * heatTransferred(metal, 20, 0.1), 8);
	expect(heatTransferred(metal, 20, 0)).toBe(0);
});
