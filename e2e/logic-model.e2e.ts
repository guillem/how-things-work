// Checks the circuit evaluator behind the logic-gates explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	BLANK,
	FULL_ADDER,
	HALF_ADDER,
	evaluate,
	makesLoop,
	pairsRight,
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
	for (let a = 0; a < 16; a++)
		for (let b = 0; b < 16; b++) {
			expect(ripple4(a, b).value).toBe(a + b);
			expect(ripple4(a, b, true).value).toBe(a + b + 1);
		}
	expect(ripple4(15, 1).carryOut).toBe(true);
});

test('4-bit adder: adds every pair only once all three carries are connected', () => {
	expect(pairsRight([true, true, true])).toBe(256);
	for (let k = 0; k < 3; k++) {
		const links = [true, true, true];
		links[k] = false;
		expect(pairsRight(links)).toBeLessThan(256);
	}
	// unconnected carries: 1 + 1 loses its carry and comes out 0
	expect(ripple4(1, 1, false, [false, false, false]).value).toBe(0);
});

test('NAND alone makes NOT, AND and OR', () => {
	const n = (id: string, kind: 'in' | 'out' | 'NAND', y = 0, label?: string) => ({
		id,
		kind,
		x: 0,
		y,
		...(label ? { label } : {})
	});
	const w = (from: string, to: string, slot = 0) => ({ from, to, slot });
	const a = n('a', 'in', 0, 'A');
	const b = n('b', 'in', 1, 'B');
	const q = n('q', 'out', 0, 'Out');
	const not = { nodes: [a, n('g', 'NAND'), q], wires: [w('a', 'g'), w('a', 'g', 1), w('g', 'q')] };
	const and = {
		nodes: [a, b, n('g', 'NAND'), n('h', 'NAND'), q],
		wires: [w('a', 'g'), w('b', 'g', 1), w('g', 'h'), w('g', 'h', 1), w('h', 'q')]
	};
	const or = {
		nodes: [a, b, n('na', 'NAND'), n('nb', 'NAND'), n('g', 'NAND'), q],
		wires: [
			w('a', 'na'),
			w('a', 'na', 1),
			w('b', 'nb'),
			w('b', 'nb', 1),
			w('na', 'g'),
			w('nb', 'g', 1),
			w('g', 'q')
		]
	};
	expect(outs(not)).toEqual(outs(singleGate('NOT')));
	expect(outs(and)).toEqual(outs(singleGate('AND')));
	expect(outs(or)).toEqual(outs(singleGate('OR')));
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
