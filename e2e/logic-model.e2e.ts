// Checks the circuit evaluator behind the logic-gates explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BLANK,
	FULL_ADDER,
	HALF_ADDER,
	evaluate,
	makesLoop,
	parseCircuit,
	ripple4,
	serializeCircuit,
	singleGate,
	truthTable
} from '../src/routes/logic-gates/logic';

const outs = (c: Parameters<typeof truthTable>[0]) =>
	truthTable(c).rows.map((r) => r.outputs.map(Number).join(''));

test('each gate’s truth table', () => {
	expect(outs(singleGate('AND'))).toEqual(['0', '0', '0', '1']);
	expect(outs(singleGate('OR'))).toEqual(['0', '1', '1', '1']);
	expect(outs(singleGate('XOR'))).toEqual(['0', '1', '1', '0']);
	expect(outs(singleGate('NAND'))).toEqual(['1', '1', '1', '0']);
	expect(outs(singleGate('NOT'))).toEqual(['1', '0']);
});

test('half adder: sum and carry of two bits', () => {
	// rows: 00, 01, 10, 11 → (sum, carry)
	expect(outs(HALF_ADDER)).toEqual(['00', '10', '10', '01']);
});

test('full adder: adds three bits', () => {
	const t = truthTable(FULL_ADDER);
	for (const r of t.rows) {
		const n = r.inputs.filter(Boolean).length;
		expect(Number(r.outputs[0])).toBe(n % 2);
		expect(Number(r.outputs[1])).toBe(n >= 2 ? 1 : 0);
	}
});

test('4-bit adder: every pair of 4-bit numbers', () => {
	for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) expect(ripple4(a, b).value).toBe(a + b);
	expect(ripple4(15, 1).carryOut).toBe(true);
});

test('signals pass through gates in depth order', () => {
	const { depth } = evaluate(FULL_ADDER, { a: true, b: true, ci: true });
	expect(depth.get('x1')).toBe(1);
	expect(depth.get('x2')).toBe(2);
	expect(depth.get('o')).toBe(3);
});

test('loops are refused, unwired slots read 0, the text form round-trips', () => {
	expect(makesLoop(FULL_ADDER, { from: 'o', to: 'x1', slot: 0 })).toBe(true);
	expect(makesLoop(FULL_ADDER, { from: 'a', to: 'o', slot: 0 })).toBe(false);
	expect(evaluate(BLANK, { a: true, b: true }).value.get('q')).toBe(false);
	for (const c of [HALF_ADDER, FULL_ADDER, BLANK])
		expect(serializeCircuit(parseCircuit(serializeCircuit(c))!)).toBe(serializeCircuit(c));
});
