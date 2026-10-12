// Runs real programs on the CPU explainer's machine and checks what they compute,
// the order of the fetch–decode–execute cycle and the assembler's errors. Node only.
import { expect, test } from '@playwright/test';
import {
	MAX_INSTRUCTIONS,
	PROGRAMS,
	assemble,
	decode,
	maxProgram,
	run,
	type Run
} from '../src/routes/cpu/cpu';

function exec(source: string): Run & { labels: Record<string, number> } {
	const a = assemble(source);
	if (!a.ok) throw new Error(JSON.stringify(a.errors));
	return { ...run(a.memory), labels: a.labels };
}
const at = (r: ReturnType<typeof exec>, label: string) => r.final.mem[r.labels[label]];

test('the first program adds 7 and 5', () => {
	const r = exec(PROGRAMS.first);
	expect(r.stop).toBe('halt');
	expect(at(r, 'sum')).toBe(12);
	expect(r.instructions).toBe(5);
});

test('sum of 1 to 10 is 55', () => {
	const r = exec(PROGRAMS.sum);
	expect(r.stop).toBe('halt');
	expect(at(r, 'sum')).toBe(55);
	// 3 set-up instructions, 10 passes through the loop (the last one leaves at JZ), STORE, HALT.
	expect(r.instructions).toBe(3 + 9 * 4 + 3 + 2);
});

test('the countdown writes 5, 4, 3, 2, 1 and stops at 0', () => {
	const r = exec(PROGRAMS.countdown);
	expect(r.stop).toBe('halt');
	const out = r.labels.out;
	const written = r.phases.filter((p) => p.memWrite.includes(out)).map((p) => p.after.mem[out]);
	expect(written).toEqual([5, 4, 3, 2, 1, 0]);
});

test('6 × 7 by repeated addition is 42', () => {
	expect(at(exec(PROGRAMS.multiply), 'out')).toBe(42);
});

test('the conditional jump takes either branch depending on the data', () => {
	for (const [a, b] of [
		[23, 42],
		[42, 23],
		[9, 9],
		[0, 255],
		[255, 0]
	]) {
		const r = exec(maxProgram(a, b));
		expect(at(r, 'max'), `${a} ${b}`).toBe(Math.max(a, b));
		const jc = r.phases.find((p) => p.kind === 'execute' && p.instr?.op === 'JC');
		expect(Boolean(jc?.jumped)).toBe(a > b);
	}
});

test('every instruction goes fetch, decode, execute, and fetch reads where the PC pointed', () => {
	const r = exec(PROGRAMS.sum);
	expect(r.phases.length).toBe(3 * r.instructions);
	r.phases.forEach((p, i) => {
		expect(p.kind).toBe(['fetch', 'decode', 'execute'][i % 3]);
		const pcBefore = i === 0 ? r.initial.pc : r.phases[i - 1].after.pc;
		if (p.kind === 'fetch') {
			expect(p.memRead).toEqual([pcBefore, pcBefore + 1]);
			expect(p.after.ir).toEqual([p.after.mem[pcBefore], p.after.mem[pcBefore + 1]]);
			// The PC already points at the next instruction after fetch.
			expect(p.after.pc).toBe(pcBefore + 2);
		} else {
			expect(p.at).toBe(r.phases[i - (p.kind === 'decode' ? 1 : 2)].at);
		}
		// Decode changes nothing but understanding.
		if (p.kind === 'decode') expect(p.after).toEqual(r.phases[i - 1].after);
	});
	// The loop's JMP sends the PC back to the loop's first instruction.
	const back = r.phases.find((p) => p.kind === 'execute' && p.instr?.op === 'JMP');
	expect(back?.after.pc).toBe(r.labels.loop);
});

test('registers are 8 bits: 255 + 1 wraps to 0 with a carry, 0 − 1 to 255 with a borrow', () => {
	const r = exec(`LDI R0, 255
LDI R1, 1
ADD R0, R1
STORE R0, [x]
LDI R2, 0
SUB R2, R1
HALT
x: DATA 9`);
	const add = r.phases.find((p) => p.alu?.op === 'ADD')!.alu!;
	expect(add).toMatchObject({ result: 0, z: true, c: true });
	const sub = r.phases.find((p) => p.alu?.op === 'SUB')!.alu!;
	expect(sub).toMatchObject({ result: 255, z: false, c: true });
	expect(at(r, 'x')).toBe(0);
});

test('instructions are bytes in the same memory as the data', () => {
	const a = assemble(PROGRAMS.first);
	if (!a.ok) throw new Error('did not assemble');
	expect(decode(a.memory[4], a.memory[5])).toMatchObject({ op: 'ADD', r: 0, s: 1 });
	// ADD R0, R1 is 0100 00 01: opcode 4, registers 0 and 1.
	expect(a.memory[4]).toBe(0b0100_00_01);
});

test('a program that never halts is stopped, not left to hang', () => {
	const r = exec('loop: JMP loop');
	expect(r.stop).toBe('limit');
	expect(r.instructions).toBe(MAX_INSTRUCTIONS);
});

test('running into data that is not an instruction stops the machine', () => {
	// Data byte 255 has opcode 15, which does not exist.
	const r = exec('LDI R0, 1\nx: DATA 255');
	expect(r.stop).toBe('bad-opcode');
});

test('labels may use any valid name, even ones JavaScript objects inherit', () => {
	const r = exec('JMP constructor\nLDI R0, 1\nconstructor: HALT');
	expect(r.stop).toBe('halt');
	expect(r.final.regs[0]).toBe(0);
});

test('bad programs give errors with line numbers instead of crashing', () => {
	const cases: [string, number, RegExp][] = [
		['', 1, /no instructions/],
		['; only a comment\n\n', 1, /no instructions/],
		['LDI R0, 1\nADDD R0, R1', 2, /Unknown instruction "ADDD"/],
		['JMP nowhere', 1, /Unknown label "nowhere"/],
		['LDI R0, 256', 1, /fit in a byte/],
		['LDI R0, -1', 1, /fit in a byte/],
		['LDI R4, 1', 1, /not a register/],
		['LOAD R0, [40]', 1, /outside memory/],
		['JMP 99', 1, /outside memory/],
		['ADD R0', 1, /takes 2 operands/],
		['HALT R0', 1, /takes no operands/],
		['a: HALT\na: HALT', 2, /defined twice/],
		['LDI R0, banana!', 1, /not a number or a label/],
		['JMP constructor', 1, /Unknown label "constructor"/],
		['LDI R0, R1', 1, /"R1" is a register/],
		['x: DATA [5]', 1, /Expected a number, not an address/],
		[Array.from({ length: 17 }, () => 'HALT').join('\n'), 17, /needs 34 bytes/]
	];
	for (const [src, line, message] of cases) {
		const a = assemble(src);
		expect(a.ok, src).toBe(false);
		if (a.ok) continue;
		expect(a.errors[0].line, src).toBe(line);
		expect(a.errors[0].message, src).toMatch(message);
	}
	// Comments, blank lines, labels on their own line and any letter case are fine.
	const ok = assemble('; hello\n\nstart:\n  ldi r0, 0x0A ; ten\n  jz START\n  halt');
	expect(ok.ok).toBe(true);
});

test('the addresses and bytes the narrative quotes', () => {
	const first = exec(PROGRAMS.first);
	expect(first.labels.sum).toBe(10);
	const fetchAdd = first.phases.find((p) => p.kind === 'fetch' && p.instr?.op === 'ADD')!;
	expect(fetchAdd.at).toBe(4);
	expect(fetchAdd.after.ir).toEqual([65, 0]);
	expect(fetchAdd.after.pc).toBe(6);
	const countdown = exec(PROGRAMS.countdown);
	expect([countdown.labels.loop, countdown.labels.done, countdown.labels.out]).toEqual([4, 12, 16]);
	const sum = exec(PROGRAMS.sum);
	expect(sum.labels.sum).toBe(18);
	expect(sum.phases.length).toBe(132);
	const max = exec(maxProgram(1, 2));
	expect([max.labels.a, max.labels.b]).toEqual([16, 17]);
	// Editing the sum: up to 22 the total fits in a byte; 1 + … + 23 = 276 wraps to 20.
	expect(at(exec(PROGRAMS.sum.replace('R1, 10', 'R1, 22')), 'sum')).toBe(253);
	expect(at(exec(PROGRAMS.sum.replace('R1, 10', 'R1, 23')), 'sum')).toBe(20);
	// 23 − 42 borrows and leaves 237 in the register.
	const sub = exec(maxProgram(42, 23)).phases.find((p) => p.alu)!.alu!;
	expect(sub).toMatchObject({ a: 23, b: 42, result: 237, c: true });
});
