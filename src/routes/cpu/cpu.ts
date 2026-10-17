/**
 * A minimal 8-bit processor: its instruction set, an assembler and a
 * simulator that records every fetch, decode and execute phase.
 *
 * This is a teaching machine, in the spirit of the SAP-1 ("Simple As
 * Possible") computer of A. P. Malvino, *Digital Computer Electronics*
 * (McGraw-Hill) and the Little Man Computer: real enough that programs
 * are bytes in memory and every step is what a real processor does, small
 * enough to see all of it at once.
 *
 * The machine (stated on the page):
 * - one memory of 32 bytes holds the program and its data (a "von Neumann"
 *   design: instructions are just numbers in memory);
 * - four 8-bit registers R0–R3, a program counter (PC), an instruction
 *   register (IR) holding the two bytes of the current instruction, and two
 *   flags set by the arithmetic unit: Z (the result was zero) and C (carry out
 *   of an addition, or borrow in a subtraction);
 * - every instruction is two bytes: [opcode:4 | first register:2 | second
 *   register:2] then [a number or an address];
 * - arithmetic is modulo 256, like any 8-bit register (255 + 1 = 0 with the
 *   carry set; 0 − 1 = 255 with a borrow);
 * - the PC moves on to the next instruction during fetch, so a jump simply
 *   overwrites it during execute, as in real processors.
 */

export const MEM_SIZE = 32;
const REGISTERS = 4;
/** Instructions executed before a run that never halts is stopped. */
export const MAX_INSTRUCTIONS = 1000;

export type Mnemonic = 'HALT' | 'LDI' | 'LOAD' | 'STORE' | 'ADD' | 'SUB' | 'JMP' | 'JZ' | 'JC';

/** Opcode (the top four bits of an instruction's first byte) of each instruction. */
export const OPCODES: Record<Mnemonic, number> = {
	HALT: 0,
	LDI: 1,
	LOAD: 2,
	STORE: 3,
	ADD: 4,
	SUB: 5,
	JMP: 6,
	JZ: 7,
	JC: 8
};
const BY_CODE = new Map(Object.entries(OPCODES).map(([m, c]) => [c, m as Mnemonic]));

/** Operands each instruction takes: r = register, n = number, a = memory address. */
const SHAPES: Record<Mnemonic, ('r' | 'n' | 'a')[]> = {
	HALT: [],
	LDI: ['r', 'n'],
	LOAD: ['r', 'a'],
	STORE: ['r', 'a'],
	ADD: ['r', 'r'],
	SUB: ['r', 'r'],
	JMP: ['a'],
	JZ: ['a'],
	JC: ['a']
};

/** What each instruction does, in words (shown in the instruction reference). */
export const MEANINGS: Record<Mnemonic, string> = {
	LDI: 'LDI R, n — put the number n in register R',
	LOAD: 'LOAD R, [a] — copy the byte at address a into R',
	STORE: 'STORE R, [a] — copy R into memory at address a',
	ADD: 'ADD R, S — R = R + S (sets Z and C)',
	SUB: 'SUB R, S — R = R − S (sets Z and C)',
	JMP: 'JMP a — continue at address a',
	JZ: 'JZ a — jump to a if the last ADD or SUB gave zero',
	JC: 'JC a — jump to a if the last ADD or SUB carried or borrowed',
	HALT: 'HALT — stop'
};

// ---- decoding ------------------------------------------------------------------

export interface Decoded {
	op: Mnemonic;
	/** First register field (bits 3–2 of the first byte). */
	r: number;
	/** Second register field (bits 1–0). */
	s: number;
	/** The second byte: a number or an address. */
	n: number;
}

/** Splits an instruction's two bytes into its fields; `null` if the opcode is unknown. */
export function decode(b0: number, b1: number): Decoded | null {
	const op = BY_CODE.get(b0 >> 4);
	if (op === undefined) return null;
	return { op, r: (b0 >> 2) & 3, s: b0 & 3, n: b1 };
}

function encode(d: Decoded): [number, number] {
	return [(OPCODES[d.op] << 4) | (d.r << 2) | d.s, d.n & 255];
}

/** The instruction as assembly text, e.g. `ADD R0, R1`. */
export function disassemble(d: Decoded): string {
	switch (d.op) {
		case 'HALT':
			return 'HALT';
		case 'LDI':
			return `LDI R${d.r}, ${d.n}`;
		case 'LOAD':
		case 'STORE':
			return `${d.op} R${d.r}, [${d.n}]`;
		case 'ADD':
		case 'SUB':
			return `${d.op} R${d.r}, R${d.s}`;
		default:
			return `${d.op} ${d.n}`;
	}
}

// ---- assembler -----------------------------------------------------------------

interface AsmError {
	/** 1-based source line. */
	line: number;
	message: string;
}

interface AsmItem {
	/** Address of the first byte. */
	addr: number;
	/** 1-based source line. */
	line: number;
	/** An instruction (two bytes) or a DATA byte. */
	kind: 'instr' | 'data';
}

type Assembled =
	| { ok: true; memory: number[]; items: AsmItem[]; labels: Record<string, number> }
	| { ok: false; errors: AsmError[] };

const LABEL = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The reader's text, quoted and shortened so that a message fits under the editor. */
const q = (text: string) => `"${text.length > 14 ? `${text.slice(0, 13)}…` : text}"`;

function parseNumber(text: string): number | null {
	const t = text.trim().toLowerCase();
	if (/^-?\d+$/.test(t)) return Number(t);
	if (/^0x[0-9a-f]+$/.test(t)) return parseInt(t.slice(2), 16);
	if (/^0b[01]+$/.test(t)) return parseInt(t.slice(2), 2);
	return null;
}

/**
 * Turns assembly text into the 32 bytes of memory. Never throws: anything
 * wrong is reported as errors with their line numbers.
 *
 * Syntax: one instruction per line, optionally preceded by `label:`;
 * `;` starts a comment; operands are separated by commas; registers are
 * R0–R3; numbers are decimal (or 0x… / 0b…); an address is a number or a
 * label, optionally in brackets (`[sum]`). `DATA n` reserves one byte holding n.
 */
export function assemble(source: string): Assembled {
	const errors: AsmError[] = [];
	const lines = source.split(/\r?\n/);
	type Parsed = { line: number; word: string; args: string[]; addr: number };
	const parsed: Parsed[] = [];
	const labels: Record<string, number> = Object.create(null) as Record<string, number>;
	let addr = 0;

	// Pass 1: labels and sizes.
	lines.forEach((raw, i) => {
		const line = i + 1;
		let text = raw.replace(/;.*$/, '').trim();
		const colon = text.indexOf(':');
		if (colon >= 0) {
			const name = text.slice(0, colon).trim();
			if (!LABEL.test(name)) {
				errors.push({ line, message: `${q(name)} is not a valid label name` });
				return;
			}
			if (/^r[0-3]$/i.test(name) || name.toUpperCase() in OPCODES || /^data$/i.test(name)) {
				errors.push({ line, message: `${q(name)} is a reserved word, not a label` });
				return;
			}
			if (name.toLowerCase() in labels) {
				errors.push({ line, message: `The label ${q(name)} is defined twice` });
				return;
			}
			labels[name.toLowerCase()] = addr;
			text = text.slice(colon + 1).trim();
		}
		if (!text) return;
		const m = /^(\S+)\s*(.*)$/.exec(text);
		if (!m) return;
		const word = m[1].toUpperCase();
		const args = m[2].trim() ? m[2].split(',').map((a) => a.trim()) : [];
		const size = word === 'DATA' ? 1 : 2;
		parsed.push({ line, word, args, addr });
		addr += size;
	});

	if (addr > MEM_SIZE)
		errors.push({
			line: parsed.find((p) => p.addr + (p.word === 'DATA' ? 1 : 2) > MEM_SIZE)?.line ?? 1,
			message: `The program needs ${addr} bytes but memory has only ${MEM_SIZE}`
		});

	// Pass 2: encode.
	const memory = new Array<number>(MEM_SIZE).fill(0);
	const items: AsmItem[] = [];

	function value(text: string, line: number, what: 'n' | 'a'): number | null {
		const bare = text.replace(/^\[(.*)\]$/, '$1').trim();
		if (what === 'n' && bare !== text) {
			errors.push({ line, message: `Expected a number, not an address: ${q(text)}` });
			return null;
		}
		const num = parseNumber(bare);
		if (num !== null) {
			if (what === 'n' && (num < 0 || num > 255)) {
				errors.push({ line, message: `${num} doesn't fit in a byte (0–255)` });
				return null;
			}
			if (what === 'a' && (num < 0 || num >= MEM_SIZE)) {
				errors.push({ line, message: `Address ${num} is outside memory (0–${MEM_SIZE - 1})` });
				return null;
			}
			return num;
		}
		if (/^r[0-3]$/i.test(bare)) {
			errors.push({ line, message: `${q(bare)} is a register; this needs a number or an address` });
			return null;
		}
		if (LABEL.test(bare)) {
			const at = labels[bare.toLowerCase()];
			if (at === undefined) {
				errors.push({ line, message: `Unknown label ${q(bare)}` });
				return null;
			}
			return at;
		}
		errors.push({ line, message: `${q(text)} is not a number or a label` });
		return null;
	}

	function register(text: string, line: number): number | null {
		const m = /^r([0-9]+)$/i.exec(text);
		if (m && Number(m[1]) < REGISTERS) return Number(m[1]);
		errors.push({ line, message: `${q(text)} is not a register (R0–R3)` });
		return null;
	}

	for (const p of parsed) {
		if (p.word === 'DATA') {
			if (p.args.length !== 1) {
				errors.push({ line: p.line, message: 'DATA takes one number' });
				continue;
			}
			const n = value(p.args[0], p.line, 'n');
			if (n !== null && p.addr < MEM_SIZE) memory[p.addr] = n;
			items.push({ addr: p.addr, line: p.line, kind: 'data' });
			continue;
		}
		if (!(p.word in OPCODES)) {
			errors.push({ line: p.line, message: `Unknown instruction ${q(p.word)}` });
			continue;
		}
		const op = p.word as Mnemonic;
		const shape = SHAPES[op];
		if (p.args.length !== shape.length) {
			const want =
				shape.length === 0
					? 'no operands'
					: `${shape.length} operand${shape.length > 1 ? 's' : ''}`;
			errors.push({ line: p.line, message: `${op} takes ${want}` });
			continue;
		}
		const fields = { r: 0, s: 0, n: 0 };
		let ok = true;
		shape.forEach((kind, i) => {
			const v = kind === 'r' ? register(p.args[i], p.line) : value(p.args[i], p.line, kind);
			if (v === null) ok = false;
			else if (kind === 'r') fields[i === 0 ? 'r' : 's'] = v;
			else fields.n = v;
		});
		if (!ok) continue;
		const [b0, b1] = encode({ op, ...fields });
		if (p.addr + 1 < MEM_SIZE) {
			memory[p.addr] = b0;
			memory[p.addr + 1] = b1;
		}
		items.push({ addr: p.addr, line: p.line, kind: 'instr' });
	}

	if (!errors.length && !items.some((i) => i.kind === 'instr'))
		errors.push({ line: 1, message: 'There are no instructions to run' });
	if (errors.length) {
		errors.sort((a, b) => a.line - b.line);
		return { ok: false, errors };
	}
	return { ok: true, memory, items, labels };
}

// ---- simulator -----------------------------------------------------------------

export interface Machine {
	pc: number;
	/** The two bytes of the instruction being worked on. */
	ir: [number, number];
	regs: number[];
	z: boolean;
	c: boolean;
	mem: number[];
}

export type PhaseKind = 'fetch' | 'decode' | 'execute';

export interface Phase {
	kind: PhaseKind;
	/** How many instructions were started before this one (0-based instruction number). */
	n: number;
	/** Address of the instruction this phase belongs to. */
	at: number;
	/** The instruction (known from decode on; fetch records it too, for display). */
	instr: Decoded | null;
	/** Machine state when the phase is over. */
	after: Machine;
	/** Memory addresses read and written in this phase. */
	memRead: number[];
	memWrite: number[];
	/** Registers read and written in this phase. */
	regRead: number[];
	regWrite: number[];
	/** Arithmetic done in this phase. */
	alu?: { op: 'ADD' | 'SUB'; a: number; b: number; result: number; z: boolean; c: boolean };
	/** The PC was overwritten by a jump (execute of JMP, or of JZ/JC when taken). */
	jumped?: boolean;
	/** A conditional jump that was not taken. */
	notTaken?: boolean;
	halted?: boolean;
}

export type StopReason = 'halt' | 'limit' | 'bad-opcode' | 'bad-address' | 'end-of-memory';

export interface Run {
	initial: Machine;
	phases: Phase[];
	stop: StopReason;
	/** Instructions completed. */
	instructions: number;
	final: Machine;
}

function clone(m: Machine): Machine {
	return { pc: m.pc, ir: [m.ir[0], m.ir[1]], regs: [...m.regs], z: m.z, c: m.c, mem: [...m.mem] };
}

function boot(memory: number[]): Machine {
	return { pc: 0, ir: [0, 0], regs: [0, 0, 0, 0], z: false, c: false, mem: [...memory] };
}

/**
 * Runs the machine from address 0 until HALT (or a problem), recording each
 * phase. Stops after `max` instructions so that a program that loops forever
 * cannot hang the page.
 */
export function run(memory: number[], max = MAX_INSTRUCTIONS): Run {
	const initial = boot(memory);
	let m = clone(initial);
	const phases: Phase[] = [];
	let stop: StopReason = 'limit';
	let n = 0;
	for (; n < max; n++) {
		const at = m.pc;
		if (at + 1 >= MEM_SIZE) {
			stop = 'end-of-memory';
			break;
		}
		// Fetch: the PC's address goes to memory, the two bytes come back into the
		// IR, and the PC moves on to the next instruction.
		const f = clone(m);
		f.ir = [m.mem[at], m.mem[at + 1]];
		f.pc = at + 2;
		const instr = decode(f.ir[0], f.ir[1]);
		phases.push({
			kind: 'fetch',
			n,
			at,
			instr,
			after: f,
			memRead: [at, at + 1],
			memWrite: [],
			regRead: [],
			regWrite: []
		});
		m = f;
		// Decode: the control unit splits the IR into its fields. Nothing changes yet.
		if (!instr) {
			stop = 'bad-opcode';
			break;
		}
		phases.push({
			kind: 'decode',
			n,
			at,
			instr,
			after: clone(m),
			memRead: [],
			memWrite: [],
			regRead: [],
			regWrite: []
		});
		// Execute.
		const e = clone(m);
		const p: Phase = {
			kind: 'execute',
			n,
			at,
			instr,
			after: e,
			memRead: [],
			memWrite: [],
			regRead: [],
			regWrite: []
		};
		const { r, s, n: v } = instr;
		const usesAddress = instr.op === 'LOAD' || instr.op === 'STORE' || instr.op[0] === 'J';
		if (usesAddress && v >= MEM_SIZE) {
			stop = 'bad-address';
			break;
		}
		switch (instr.op) {
			case 'HALT':
				p.halted = true;
				break;
			case 'LDI':
				e.regs[r] = v;
				p.regWrite = [r];
				break;
			case 'LOAD':
				e.regs[r] = m.mem[v];
				p.memRead = [v];
				p.regWrite = [r];
				break;
			case 'STORE':
				e.mem[v] = m.regs[r];
				p.regRead = [r];
				p.memWrite = [v];
				break;
			case 'ADD':
			case 'SUB': {
				const a = m.regs[r];
				const b = m.regs[s];
				const raw = instr.op === 'ADD' ? a + b : a - b;
				const result = ((raw % 256) + 256) % 256;
				e.regs[r] = result;
				e.z = result === 0;
				e.c = raw > 255 || raw < 0;
				p.regRead = r === s ? [r] : [r, s];
				p.regWrite = [r];
				p.alu = { op: instr.op, a, b, result, z: e.z, c: e.c };
				break;
			}
			case 'JMP':
				e.pc = v;
				p.jumped = true;
				break;
			case 'JZ':
			case 'JC': {
				const flag = instr.op === 'JZ' ? m.z : m.c;
				if (flag) {
					e.pc = v;
					p.jumped = true;
				} else p.notTaken = true;
				break;
			}
		}
		phases.push(p);
		m = e;
		if (p.halted) {
			stop = 'halt';
			break;
		}
	}
	const instructions = phases.filter((p) => p.kind === 'execute').length;
	return { initial, phases, stop, instructions, final: m };
}

/** The machine after the first `k` phases. */
export function stateAt(r: Run, k: number): Machine {
	return k <= 0 ? r.initial : r.phases[Math.min(k, r.phases.length) - 1].after;
}

// ---- example programs ------------------------------------------------------------

/** The programs the page loads. Each one is quoted in the narrative. */
export const PROGRAMS = {
	first: `; Add two numbers
      LDI   R0, 7
      LDI   R1, 5
      ADD   R0, R1    ; R0 = R0 + R1
      STORE R0, [sum] ; R0 to memory
      HALT
sum:  DATA  0`,
	countdown: `; Count down from 5 to 0
      LDI   R0, 5     ; the count
      LDI   R1, 1
loop: STORE R0, [out] ; show it
      SUB   R0, R1    ; Z on at 0
      JZ    done      ; 0? leave
      JMP   loop      ; go round
done: STORE R0, [out]
      HALT
out:  DATA  0`,
	sum: `; Add up 1 + 2 + ... + 10
      LDI   R0, 0     ; the total
      LDI   R1, 10    ; n
      LDI   R2, 1
loop: ADD   R0, R1    ; total + n
      SUB   R1, R2    ; n - 1
      JZ    done      ; n = 0? leave
      JMP   loop      ; go round
done: STORE R0, [sum]
      HALT
sum:  DATA  0`,
	multiply: `; Multiply 6 x 7 by adding
      LDI   R0, 0     ; the product
      LDI   R1, 6
      LDI   R2, 7     ; times
      LDI   R3, 1
loop: ADD   R0, R1
      SUB   R2, R3
      JZ    done
      JMP   loop
done: STORE R0, [out]
      HALT
out:  DATA  0`
} as const;

/** The decision example: keeps the larger of two bytes. */
export function maxProgram(a: number, b: number): string {
	return `; Keep the larger of a and b
      LOAD  R0, [a]
      LOAD  R1, [b]
      STORE R1, [max] ; guess b
      SUB   R1, R0    ; b - a
      JC    abig      ; borrow?
      HALT
abig: STORE R0, [max] ; it's a
      HALT
a:    DATA  ${a}
b:    DATA  ${b}
max:  DATA  0`;
}

export type ProgramName = keyof typeof PROGRAMS;
