/**
 * Logic circuits: gates wired together on a canvas, evaluated by following
 * the wires, with a gate delay so signals can be watched propagating.
 *
 * A circuit is a set of nodes — inputs (switches), gates (AND, OR, NOT, XOR,
 * and NAND for the "one gate is enough" note), blocks and outputs (lamps) —
 * and wires from one of a node's outputs to an input slot of another.
 * Circuits here have no loops (no feedback), so every output is a fixed
 * function of the inputs.
 *
 * A block (kind 'FA', a full adder) is a circuit used as one part: the
 * circuit inside it is given separately (`Blocks`), its switches in reading
 * order are the block's input slots and its lamps in reading order are the
 * block's outputs. A full-adder block has three inputs (A, B, carry in) and
 * two outputs (port 0 the sum, port 1 the carry out).
 */

export type GateKind = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND';
export type BlockKind = 'FA';
export type NodeKind = 'in' | 'out' | GateKind | BlockKind;

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
	/** Which output of that node (a block has two); 0 if left out. */
	port?: number;
	/** Node and input slot (0 or 1; 0 to 2 on a block) it feeds. */
	to: string;
	slot: number;
}

/** The circuit inside each kind of block. */
export type Blocks = Partial<Record<BlockKind, Circuit>>;

export interface Circuit {
	nodes: LogicNode[];
	wires: Wire[];
}

export const inputCount = (k: NodeKind) =>
	k === 'in' ? 0 : k === 'NOT' || k === 'out' ? 1 : k === 'FA' ? 3 : 2;
export const outputCount = (k: NodeKind) => (k === 'out' ? 0 : k === 'FA' ? 2 : 1);

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
 * gates a signal passes through to reach it (for the propagation animation; a
 * block adds the gates on the longest path through the circuit inside it),
 * and `ports`: the value of each of a node's outputs (`value` is output 0).
 * A block whose circuit isn't given outputs 0, and so does a block inside a
 * block's circuit. Throws if the circuit has a loop.
 */
export function evaluate(c: Circuit, inputs: Record<string, boolean>, blocks: Blocks = {}) {
	const byId = new Map(c.nodes.map((n) => [n.id, n]));
	type Feed = { from: string; port: number } | undefined;
	const feeds = new Map<string, Feed[]>();
	for (const n of c.nodes)
		feeds.set(
			n.id,
			Array.from({ length: inputCount(n.kind) }, (): Feed => undefined)
		);
	for (const w of c.wires) {
		const slots = feeds.get(w.to);
		const src = byId.get(w.from);
		const port = w.port ?? 0;
		if (slots && src && w.slot < slots.length && port < outputCount(src.kind))
			slots[w.slot] = { from: w.from, port };
	}
	const ports = new Map<string, boolean[]>();
	const depth = new Map<string, number>();
	const visiting = new Set<string>();
	const visit = (id: string): boolean[] => {
		const known = ports.get(id);
		if (known) return known;
		if (visiting.has(id)) throw new Error('The circuit has a loop');
		visiting.add(id);
		const n = byId.get(id)!;
		let out: boolean[];
		let d = 0;
		if (n.kind === 'in') out = [!!inputs[id]];
		else {
			const src = feeds.get(id)!;
			const vals = src.map((s) => (s ? visit(s.from)[s.port] : false));
			d = Math.max(0, ...src.map((s) => (s ? depth.get(s.from)! : 0)));
			if (n.kind === 'out') out = [vals[0]];
			else if (n.kind === 'FA') {
				const inner = blockOutputs(blocks[n.kind], vals);
				out = inner.outputs;
				d += inner.depth;
			} else {
				out = [gate(n.kind, vals[0], vals[1] ?? false)];
				d += 1;
			}
		}
		visiting.delete(id);
		ports.set(id, out);
		depth.set(id, d);
		return out;
	};
	for (const n of c.nodes) visit(n.id);
	const value = new Map([...ports].map(([id, v]) => [id, v[0] ?? false] as const));
	return { value, depth, ports };
}

/**
 * A full-adder block's two outputs for its three input values, worked out by the
 * circuit inside it, and the number of gates on the longest path through it.
 */
function blockOutputs(def: Circuit | undefined, vals: boolean[]) {
	if (!def) return { outputs: [false, false], depth: 1 };
	const ins = inputsOf(def);
	const outs = outputsOf(def);
	const { value, depth } = evaluate(
		def,
		Object.fromEntries(ins.map((n, i) => [n.id, vals[i] ?? false]))
	);
	const outputs = [0, 1].map((k) => (outs[k] ? value.get(outs[k].id)! : false));
	return { outputs, depth: Math.max(1, ...outs.map((o) => depth.get(o.id)!)) };
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
export function truthTable(c: Circuit, blocks: Blocks = {}) {
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
		const { value } = evaluate(c, assign, blocks);
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
	// A wire from a block's second output is written `from:1>to.slot`.
	const w = c.wires
		.map((x) => `${x.from}${x.port ? `:${x.port}` : ''}>${x.to}.${x.slot}`)
		.join(';');
	return `${n}|${w}`;
}

export function parseCircuit(s: unknown): Circuit | null {
	if (typeof s !== 'string' || !s.includes('|')) return null;
	const [ns, ws] = s.split('|');
	const kinds = new Set(['in', 'out', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'FA']);
	const nodes: LogicNode[] = [];
	for (const item of ns ? ns.split(';') : []) {
		const [id, kind, x, y, label] = item.split(',');
		if (!id || !kinds.has(kind) || !Number.isFinite(+x) || !Number.isFinite(+y)) return null;
		nodes.push({ id, kind: kind as NodeKind, x: +x, y: +y, ...(label ? { label } : {}) });
	}
	const wires: Wire[] = [];
	for (const item of ws ? ws.split(';') : []) {
		const m = /^([^>:]+)(?::(\d))?>([^.]+)\.(\d)$/.exec(item);
		if (!m) return null;
		const port = m[2] ? +m[2] : 0;
		wires.push({ from: m[1], ...(port ? { port } : {}), to: m[3], slot: +m[4] });
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
		wire('n1', 'o', 0),
		wire('n2', 'o', 1),
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

/**
 * Adds two 4-bit numbers bit by bit with a chain of full adders (what the 4-bit adder computes).
 * `links[i]` says whether the carry out of bit i is wired to the carry in of bit i + 1; an
 * unwired carry in reads 0, as any unwired input does here.
 */
export function ripple4(
	a: number,
	b: number,
	carryIn = false,
	links: readonly boolean[] = [true, true, true]
) {
	const sum: boolean[] = [];
	const carries: boolean[] = [carryIn];
	const couts: boolean[] = [];
	let carry = carryIn;
	for (let i = 0; i < 4; i++) {
		const x = ((a >> i) & 1) === 1;
		const y = ((b >> i) & 1) === 1;
		const cin = i === 0 ? carryIn : links[i - 1] !== false && carry;
		if (i > 0) carries[i] = cin;
		const { value } = evaluate(FULL_ADDER, { a: x, b: y, ci: cin });
		sum.push(value.get('s')!);
		carry = value.get('co')!;
		couts.push(carry);
	}
	carries.push(carry);
	return {
		/** Sum bits, least significant first. */
		sum,
		/** carries[i]: the carry into bit i (i < 4); carries[4]: the carry out of bit 3. */
		carries,
		/** couts[i]: the carry out of bit i. */
		couts,
		carryOut: carry,
		value: sum.reduce((v, bit, i) => v + (bit ? 2 ** i : 0), 0) + (carry ? 16 : 0)
	};
}

/** How many of the 256 pairs of 4-bit numbers the chain adds correctly, with these carry links. */
export function pairsRight(links: readonly boolean[]) {
	let n = 0;
	for (let a = 0; a < 16; a++)
		for (let b = 0; b < 16; b++) if (ripple4(a, b, false, links).value === a + b) n++;
	return n;
}

// ------------------------------------------------------------ a 4-bit adder from full-adder blocks

/** True if the circuit adds like a full adder: switches A, B, carry in; lamps sum, carry out. */
export function isFullAdder(c: Circuit) {
	if (inputsOf(c).length !== 3 || outputsOf(c).length !== 2) return false;
	try {
		const want = truthTable(FULL_ADDER).rows;
		return truthTable(c).rows.every((r, i) => r.outputs.every((v, j) => v === want[i].outputs[j]));
	} catch {
		return false;
	}
}

const SUB = '₀₁₂₃';
/** The nine switches and five lamps of the 4-bit build: bit 0 at the top, as the carry ripples down. */
export const ADDER4_BLANK: Circuit = {
	nodes: [
		node('a0', 'in', 165, 30, `A${SUB[0]}`),
		node('b0', 'in', 165, 78, `B${SUB[0]}`),
		node('ci', 'in', 165, 126, 'Carry in'),
		node('a1', 'in', 165, 192, `A${SUB[1]}`),
		node('b1', 'in', 165, 240, `B${SUB[1]}`),
		node('a2', 'in', 165, 310, `A${SUB[2]}`),
		node('b2', 'in', 165, 358, `B${SUB[2]}`),
		node('a3', 'in', 165, 428, `A${SUB[3]}`),
		node('b3', 'in', 165, 476, `B${SUB[3]}`),
		...[0, 1, 2, 3].map((i) => node(`s${i}`, 'out', 840, 60 + 100 * i, `S${SUB[i]}`)),
		node('co', 'out', 840, 460, 'Carry out')
	],
	wires: []
};

/** The 4-bit ripple-carry adder: four full-adder blocks, each carry out wired to the next carry in. */
export const ADDER4: Circuit = {
	nodes: [...ADDER4_BLANK.nodes, ...[78, 216, 334, 452].map((y, i) => node(`f${i}`, 'FA', 500, y))],
	wires: [
		...[0, 1, 2, 3].flatMap((i) => [
			wire(`a${i}`, `f${i}`, 0),
			wire(`b${i}`, `f${i}`, 1),
			i === 0 ? wire('ci', 'f0', 2) : { from: `f${i - 1}`, port: 1, to: `f${i}`, slot: 2 },
			wire(`f${i}`, `s${i}`)
		]),
		{ from: 'f3', port: 1, to: 'co', slot: 0 }
	]
};

/** The switch values for A + B with this carry in, by switch id. */
export function adder4Inputs(a: number, b: number, carryIn: boolean) {
	const inputs: Record<string, boolean> = { ci: carryIn };
	for (let i = 0; i < 4; i++) {
		inputs[`a${i}`] = ((a >> i) & 1) === 1;
		inputs[`b${i}`] = ((b >> i) & 1) === 1;
	}
	return inputs;
}

/** The number the five lamps of the 4-bit build show (S₀ worth 1 … carry out worth 16). */
export const adder4Reading = (value: Map<string, boolean>) =>
	[0, 1, 2, 3].reduce((v, i) => v + (value.get(`s${i}`) ? 2 ** i : 0), 0) +
	(value.get('co') ? 16 : 0);

/**
 * Tries the 4-bit build on all 512 inputs (A and B from 0 to 15, carry in 0 or 1).
 * `ok[k]` says whether input k = carryIn·256 + A·16 + B came out as A + B + carry in;
 * `firstWrong` is the first input that didn't (in that order), with what the lamps read.
 * A circuit with a loop gets every input wrong.
 */
export function checkAdder4(c: Circuit, blocks: Blocks) {
	const ok: boolean[] = [];
	let firstWrong: { a: number; b: number; carryIn: boolean; got: number } | null = null;
	for (let k = 0; k < 512; k++) {
		const carryIn = k >= 256;
		const a = (k >> 4) & 15;
		const b = k & 15;
		let got = -1;
		try {
			got = adder4Reading(evaluate(c, adder4Inputs(a, b, carryIn), blocks).value);
		} catch {
			/* a loop: nothing adds */
		}
		const right = got === a + b + (carryIn ? 1 : 0);
		ok.push(right);
		if (!right && !firstWrong) firstWrong = { a, b, carryIn, got };
	}
	return { ok, right: ok.filter(Boolean).length, total: ok.length, firstWrong };
}
