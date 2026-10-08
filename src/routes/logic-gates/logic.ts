/**
 * Logic circuits: gates wired together on a canvas, evaluated by following
 * the wires, with a gate delay so signals can be watched propagating.
 *
 * A circuit is a set of nodes — inputs (switches), gates (AND, OR, NOT, XOR,
 * and NAND for the "one gate is enough" note) and outputs (lamps) — and
 * wires from one node's output to an input slot of another. Circuits here
 * have no loops (no feedback), so every output is a fixed function of the
 * inputs.
 */

export type GateKind = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND';
export type NodeKind = 'in' | 'out' | GateKind;

export interface LogicNode {
	id: string;
	kind: NodeKind;
	/** Position on the canvas (scene units). */
	x: number;
	y: number;
	/** Label shown on inputs and outputs (A, B, Sum…). */
	label?: string;
}

export interface Wire {
	/** Node whose output drives the wire. */
	from: string;
	/** Node and input slot (0 or 1) it feeds. */
	to: string;
	slot: number;
}

export interface Circuit {
	nodes: LogicNode[];
	wires: Wire[];
}

export const inputCount = (k: NodeKind) => (k === 'in' ? 0 : k === 'NOT' || k === 'out' ? 1 : 2);

export function gate(kind: GateKind, a: boolean, b: boolean) {
	switch (kind) {
		case 'AND':
			return a && b;
		case 'OR':
			return a || b;
		case 'NOT':
			return !a;
		case 'XOR':
			return a !== b;
		case 'NAND':
			return !(a && b);
	}
}

/** The input nodes in reading order (top to bottom, then left to right). */
export const inputsOf = (c: Circuit) =>
	c.nodes.filter((n) => n.kind === 'in').sort((p, q) => p.y - q.y || p.x - q.x);
export const outputsOf = (c: Circuit) =>
	c.nodes.filter((n) => n.kind === 'out').sort((p, q) => p.y - q.y || p.x - q.x);

/**
 * Value of every node for the given input values (by input id). A gate slot
 * with no wire reads as 0 (false). Returns also each node's "depth": how many
 * gates a signal passes through to reach it (for the propagation animation).
 * Throws if the circuit has a loop.
 */
export function evaluate(c: Circuit, inputs: Record<string, boolean>) {
	const byId = new Map(c.nodes.map((n) => [n.id, n]));
	const feeds = new Map<string, (string | undefined)[]>();
	for (const n of c.nodes) feeds.set(n.id, new Array(inputCount(n.kind)).fill(undefined));
	for (const w of c.wires) {
		const slots = feeds.get(w.to);
		if (slots && w.slot < slots.length && byId.has(w.from)) slots[w.slot] = w.from;
	}
	const value = new Map<string, boolean>();
	const depth = new Map<string, number>();
	const visiting = new Set<string>();
	const visit = (id: string): boolean => {
		if (value.has(id)) return value.get(id)!;
		if (visiting.has(id)) throw new Error('The circuit has a loop');
		visiting.add(id);
		const n = byId.get(id)!;
		let v: boolean;
		let d = 0;
		if (n.kind === 'in') v = !!inputs[id];
		else {
			const src = feeds.get(id)!;
			const vals = src.map((s) => (s ? visit(s) : false));
			d = Math.max(0, ...src.map((s) => (s ? depth.get(s)! : 0))) + (n.kind === 'out' ? 0 : 1);
			v = n.kind === 'out' ? vals[0] : gate(n.kind, vals[0], vals[1] ?? false);
		}
		visiting.delete(id);
		value.set(id, v);
		depth.set(id, d);
		return v;
	};
	for (const n of c.nodes) visit(n.id);
	return { value, depth };
}

/** True if adding this wire would close a loop. */
export function makesLoop(c: Circuit, w: Wire) {
	const next = new Map<string, string[]>();
	for (const x of [...c.wires, w]) next.set(x.from, [...(next.get(x.from) ?? []), x.to]);
	const seen = new Set<string>();
	const stack = [w.to];
	while (stack.length) {
		const id = stack.pop()!;
		if (id === w.from) return true;
		if (seen.has(id)) continue;
		seen.add(id);
		stack.push(...(next.get(id) ?? []));
	}
	return false;
}

/**
 * The truth table: every combination of the inputs (first input = most
 * significant), with the outputs for each.
 */
export function truthTable(c: Circuit) {
	const ins = inputsOf(c);
	const outs = outputsOf(c);
	const rows: { inputs: boolean[]; outputs: boolean[] }[] = [];
	for (let k = 0; k < 2 ** ins.length; k++) {
		const assign: Record<string, boolean> = {};
		const iv = ins.map((n, i) => {
			const b = ((k >> (ins.length - 1 - i)) & 1) === 1;
			assign[n.id] = b;
			return b;
		});
		const { value } = evaluate(c, assign);
		rows.push({ inputs: iv, outputs: outs.map((o) => value.get(o.id)!) });
	}
	return {
		inputs: ins.map((n) => n.label ?? n.id),
		outputs: outs.map((n) => n.label ?? n.id),
		rows
	};
}

// ------------------------------------------------------------ text form (for params)

export function serializeCircuit(c: Circuit) {
	const n = c.nodes
		.map((x) => `${x.id},${x.kind},${Math.round(x.x)},${Math.round(x.y)},${x.label ?? ''}`)
		.join(';');
	const w = c.wires.map((x) => `${x.from}>${x.to}.${x.slot}`).join(';');
	return `${n}|${w}`;
}

export function parseCircuit(s: unknown): Circuit | null {
	if (typeof s !== 'string' || !s.includes('|')) return null;
	const [ns, ws] = s.split('|');
	const kinds = new Set(['in', 'out', 'AND', 'OR', 'NOT', 'XOR', 'NAND']);
	const nodes: LogicNode[] = [];
	for (const item of ns ? ns.split(';') : []) {
		const [id, kind, x, y, label] = item.split(',');
		if (!id || !kinds.has(kind) || !Number.isFinite(+x) || !Number.isFinite(+y)) return null;
		nodes.push({ id, kind: kind as NodeKind, x: +x, y: +y, ...(label ? { label } : {}) });
	}
	const wires: Wire[] = [];
	for (const item of ws ? ws.split(';') : []) {
		const m = /^([^>]+)>([^.]+)\.(\d)$/.exec(item);
		if (!m) return null;
		wires.push({ from: m[1], to: m[2], slot: +m[3] });
	}
	return { nodes, wires };
}

// ------------------------------------------------------------ the circuits on the page

const node = (id: string, kind: NodeKind, x: number, y: number, label?: string): LogicNode => ({
	id,
	kind,
	x,
	y,
	...(label ? { label } : {})
});
const wire = (from: string, to: string, slot = 0): Wire => ({ from, to, slot });

/** One gate of each kind with its own two inputs and a lamp, for the first step. */
export function singleGate(kind: GateKind): Circuit {
	const two = inputCount(kind) === 2;
	return {
		nodes: [
			node('a', 'in', 120, two ? 220 : 280, 'A'),
			...(two ? [node('b', 'in', 120, 340, 'B')] : []),
			node('g', kind, 420, 280),
			node('q', 'out', 720, 280, 'Out')
		],
		wires: [wire('a', 'g', 0), ...(two ? [wire('b', 'g', 1)] : []), wire('g', 'q')]
	};
}

/** Half adder: Sum = A XOR B, Carry = A AND B. */
export const HALF_ADDER: Circuit = {
	nodes: [
		node('a', 'in', 120, 200, 'A'),
		node('b', 'in', 120, 360, 'B'),
		node('x', 'XOR', 420, 200),
		node('n', 'AND', 420, 360),
		node('s', 'out', 720, 200, 'Sum'),
		node('c', 'out', 720, 360, 'Carry')
	],
	wires: [
		wire('a', 'x', 0),
		wire('b', 'x', 1),
		wire('a', 'n', 0),
		wire('b', 'n', 1),
		wire('x', 's'),
		wire('n', 'c')
	]
};

/** Full adder: two half adders and an OR. */
export const FULL_ADDER: Circuit = {
	nodes: [
		node('a', 'in', 90, 150, 'A'),
		node('b', 'in', 90, 270, 'B'),
		node('ci', 'in', 90, 420, 'Carry in'),
		node('x1', 'XOR', 300, 180),
		node('n1', 'AND', 300, 330),
		node('x2', 'XOR', 520, 220),
		node('n2', 'AND', 520, 390),
		node('o', 'OR', 690, 360),
		node('s', 'out', 850, 220, 'Sum'),
		node('co', 'out', 850, 360, 'Carry out')
	],
	wires: [
		wire('a', 'x1', 0),
		wire('b', 'x1', 1),
		wire('a', 'n1', 0),
		wire('b', 'n1', 1),
		wire('x1', 'x2', 0),
		wire('ci', 'x2', 1),
		wire('x1', 'n2', 0),
		wire('ci', 'n2', 1),
		wire('n2', 'o', 0),
		wire('n1', 'o', 1),
		wire('x2', 's'),
		wire('o', 'co')
	]
};

/** An empty canvas with two inputs and one output, for the reader's own circuit. */
export const BLANK: Circuit = {
	nodes: [
		node('a', 'in', 100, 200, 'A'),
		node('b', 'in', 100, 380, 'B'),
		node('q', 'out', 820, 290, 'Out')
	],
	wires: []
};

/** Adds two 4-bit numbers bit by bit with a chain of full adders (what the 4-bit adder computes). */
export function ripple4(a: number, b: number, carryIn = false) {
	const sum: boolean[] = [];
	const carries: boolean[] = [carryIn];
	let carry = carryIn;
	for (let i = 0; i < 4; i++) {
		const x = ((a >> i) & 1) === 1;
		const y = ((b >> i) & 1) === 1;
		const { value } = evaluate(FULL_ADDER, { a: x, b: y, ci: carry });
		sum.push(value.get('s')!);
		carry = value.get('co')!;
		carries.push(carry);
	}
	return {
		/** Sum bits, least significant first. */
		sum,
		carries,
		carryOut: carry,
		value: sum.reduce((v, bit, i) => v + (bit ? 2 ** i : 0), 0) + (carry ? 16 : 0)
	};
}
