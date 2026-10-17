// Checks the circuit evaluator behind the logic-gates explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	ADDER4,
	ADDER4_BLANK,
	BLANK,
	FULL_ADDER,
	HALF_ADDER,
	adder4Inputs,
	adder4Reading,
	checkAdder4,
	evaluate,
	isFullAdder,
	makesLoop,
	pairsRight,
	parseCircuit,
	ripple4,
	serializeCircuit,
	singleGate,
	truthTable
} from '../src/routes/logic-gates/logic';

const outs = (c: Parameters<typeof truthTable>[0], blocks?: Parameters<typeof truthTable>[1]) =>
	truthTable(c, blocks).rows.map((r) => r.outputs.map(Number).join(''));

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
	for (const c of [HALF_ADDER, FULL_ADDER, BLANK, ADDER4])
		expect(serializeCircuit(parseCircuit(serializeCircuit(c))!)).toBe(serializeCircuit(c));
	// a block's carry out (its second output) survives the text form
	expect(parseCircuit(serializeCircuit(ADDER4))!.wires).toContainEqual({
		from: 'f0',
		port: 1,
		to: 'f1',
		slot: 2
	});
});

/** One full-adder block with its own three switches and two lamps. */
const ONE_BLOCK = {
	nodes: [
		{ id: 'a', kind: 'in' as const, x: 0, y: 0, label: 'A' },
		{ id: 'b', kind: 'in' as const, x: 0, y: 1, label: 'B' },
		{ id: 'ci', kind: 'in' as const, x: 0, y: 2, label: 'Carry in' },
		{ id: 'f', kind: 'FA' as const, x: 1, y: 1 },
		{ id: 's', kind: 'out' as const, x: 2, y: 0, label: 'Sum' },
		{ id: 'co', kind: 'out' as const, x: 2, y: 1, label: 'Carry out' }
	],
	wires: [
		{ from: 'a', to: 'f', slot: 0 },
		{ from: 'b', to: 'f', slot: 1 },
		{ from: 'ci', to: 'f', slot: 2 },
		{ from: 'f', to: 's', slot: 0 },
		{ from: 'f', port: 1, to: 'co', slot: 0 }
	]
};

test('a full-adder block adds like the circuit inside it, which takes three gate delays', () => {
	expect(isFullAdder(FULL_ADDER)).toBe(true);
	expect(isFullAdder(HALF_ADDER)).toBe(false);
	expect(isFullAdder(ONE_BLOCK)).toBe(false); // without its circuit a block outputs 0
	const blocks = { FA: FULL_ADDER };
	expect(outs(ONE_BLOCK, blocks)).toEqual(outs(FULL_ADDER));
	// A → XOR → AND → OR reaches the carry out; the carry in passes only AND → OR
	const { portDepth } = evaluate(ONE_BLOCK, { a: true, b: true, ci: true }, blocks);
	expect(portDepth.get('f')).toEqual([2, 3]);
});

test('in the 4-bit chain the carry ripples: two more gate delays for every block it crosses', () => {
	const { depth } = evaluate(ADDER4, adder4Inputs(15, 1, false), { FA: FULL_ADDER });
	// carry out of bit 0 after 3 gates, then 2 per block: 5, 7, 9
	expect(depth.get('co')).toBe(9);
	// bit 3's sum waits for the carry into it (7) and one XOR
	expect(depth.get('s3')).toBe(8);
	expect(depth.get('s0')).toBe(2);
});

test('four full-adder blocks in a chain add every pair of 4-bit numbers, with either carry in', () => {
	const check = checkAdder4(ADDER4, { FA: FULL_ADDER });
	expect(check.right).toBe(512);
	expect(check.total).toBe(512);
	expect(check.firstWrong).toBeNull();
	const { value } = evaluate(ADDER4, adder4Inputs(11, 6, false), { FA: FULL_ADDER });
	expect(adder4Reading(value)).toBe(17);
	// with the blank canvas (no blocks, no wires) only 0 + 0 + 0 comes out right
	expect(checkAdder4(ADDER4_BLANK, { FA: FULL_ADDER }).right).toBe(1);
});

test('the 4-bit checker catches a missing carry wire and crossed sum lamps', () => {
	const blocks = { FA: FULL_ADDER };
	const noCarry = {
		nodes: ADDER4.nodes,
		wires: ADDER4.wires.filter((w) => !(w.from === 'f1' && w.to === 'f2'))
	};
	const missing = checkAdder4(noCarry, blocks);
	expect(missing.right).toBeLessThan(512);
	expect(missing.right).toBeGreaterThan(0);
	const fw = missing.firstWrong!;
	expect(fw.got).not.toBe(fw.a + fw.b + (fw.carryIn ? 1 : 0));
	// a pair whose bit 1 carries (2 + 2) loses that carry; one with no carry (1 + 2) still adds
	expect(adder4Reading(evaluate(noCarry, adder4Inputs(2, 2, false), blocks).value)).not.toBe(4);
	expect(adder4Reading(evaluate(noCarry, adder4Inputs(1, 2, false), blocks).value)).toBe(3);
	const crossed = {
		nodes: ADDER4.nodes,
		wires: ADDER4.wires.map((w) =>
			w.to === 's0' ? { ...w, to: 's1' } : w.to === 's1' ? { ...w, to: 's0' } : w
		)
	};
	expect(checkAdder4(crossed, blocks).right).toBeLessThan(512);
});
