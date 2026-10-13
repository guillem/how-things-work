// Checks the readouts behind the unit-circle explainer: the exact values it prints at the
// special angles, the radian labels, and the angle of a dragged point. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	SPECIAL_ANGLES,
	radText,
	screenAngle,
	trigText,
	unwrap
} from '../src/routes/unit-circle/trig';

/** The number an exact readout such as "−√3/2 ≈ −0.87" stands for. */
function value(text: string) {
	const exact = text.split(' ≈ ')[0].replace('−', '-');
	const sign = exact.startsWith('-') ? -1 : 1;
	const body = exact.replace('-', '');
	const forms: Record<string, number> = {
		'0': 0,
		'½': 0.5,
		'√2/2': Math.SQRT1_2,
		'√3/2': Math.sqrt(3) / 2,
		'1': 1
	};
	expect(forms, `"${text}" is an exact form`).toHaveProperty(body);
	return sign * forms[body];
}

test('every special angle is shown with its exact sine and cosine', () => {
	for (const a of SPECIAL_ANGLES) {
		const r = (a * Math.PI) / 180;
		expect(value(trigText(a, 'cos'))).toBeCloseTo(Math.cos(r), 12);
		expect(value(trigText(a, 'sin'))).toBeCloseTo(Math.sin(r), 12);
	}
});

test('radians are labelled as multiples of π where they are, decimals otherwise', () => {
	expect(radText(180)).toBe('π');
	expect(radText(30)).toBe('π/6');
	expect(radText(-90)).toBe('−π/2');
	expect(radText(720)).toBe('4π');
	expect(radText(57)).toBe('0.99');
});

test('a dragged point straight above the centre is at 90°, and drags continue across 0°', () => {
	// Screen y points down.
	expect(screenAngle(100, 100, 100, 20)).toBeCloseTo(90, 9);
	expect(screenAngle(100, 100, 100, 180)).toBeCloseTo(270, 9);
	expect(unwrap(350, 10)).toBe(370);
	expect(unwrap(10, 350)).toBe(-10);
});
