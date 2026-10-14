/**
 * A Turing machine simulator, the classic machines the explainer runs, a
 * parser for the reader's own rule tables, the halting-problem table, the
 * busy beavers and the travelling-salesman search.
 *
 * Conventions (those of Radó and the Busy Beaver Challenge):
 * - one step applies one rule: write a symbol, move the head one cell left or
 *   right, change state. The transition into a halting state counts as a step;
 * - the machine stops when it reaches a state that has no rule for the symbol
 *   under the head (for the busy beavers, the state is called H, "halt");
 * - the tape is unbounded in both directions and starts blank except for the
 *   input, which is written from cell 0 rightwards; the head starts on cell 0.
 */

export type Move = 'L' | 'R';

const NAME = /^[A-Za-z][A-Za-z0-9]*$/;

export interface Rule {
	write: string;
	move: Move;
	next: string;
}

export interface Machine {
	/** Symbol of a blank cell. Every other cell of the starting tape holds the input. */
	blank: string;
	/** Tape symbols, the blank included, in the order the rule table lists them. */
	symbols: string[];
	/** States that have rules, the start state first. */
	states: string[];
	start: string;
	/** rules[state][symbol]; a missing entry means "stop". */
	rules: Record<string, Record<string, Rule | undefined>>;
}

/** Build a machine from `state symbol -> write move next` lines. */
export function machine(lines: string[], blank = '_'): Machine {
	const p = parseMachine(lines.join('\n'), blank);
	if (!p.ok) throw new Error(p.errors.map((e) => `${e.line}: ${e.message}`).join('; '));
	return p.machine;
}

// ---- classic machines ---------------------------------------------------------

/**
 * Add one to a binary number. The head starts on the leftmost digit, walks to
 * the right end, then carries leftwards: 1 becomes 0 and the carry moves on,
 * until a 0 (or a blank, left of the number) becomes 1.
 */
export const INCREMENT_SOURCE = `right 0 -> 0 R right
right 1 -> 1 R right
right _ -> _ L carry
carry 1 -> 0 L carry
carry 0 -> 1 L done
carry _ -> 1 L done`;

/** The reader's first exercise: the same walk, but borrow instead of carry. */
export const DECREMENT_SOURCE = `right 0 -> 0 R right
right 1 -> 1 R right
right _ -> _ L borrow
borrow 0 -> 1 L borrow
borrow 1 -> 0 L done`;

/**
 * Is the string of 0s and 1s a palindrome? Erase the first symbol and
 * remember it in the state, run to the right end, compare the last symbol and
 * erase it, run back, repeat. Halts in `yes` or `no`.
 */
export const PALINDROME_SOURCE = `start 0 -> _ R have0
start 1 -> _ R have1
start _ -> _ R yes
have0 0 -> 0 R have0
have0 1 -> 1 R have0
have0 _ -> _ L last0
have1 0 -> 0 R have1
have1 1 -> 1 R have1
have1 _ -> _ L last1
last0 0 -> _ L back
last0 1 -> 1 L no
last0 _ -> _ R yes
last1 1 -> _ L back
last1 0 -> 0 L no
last1 _ -> _ R yes
back 0 -> 0 L back
back 1 -> 1 L back
back _ -> _ R start`;

export const INCREMENT = machine(INCREMENT_SOURCE.split('\n'));
export const DECREMENT = machine(DECREMENT_SOURCE.split('\n'));
export const PALINDROME = machine(PALINDROME_SOURCE.split('\n'));

/**
 * The busy beavers: for n states and two symbols, the halting machines that run
 * the longest from a blank tape (S(n)). In the Busy Beaver Challenge's text
 * format: for each state A, B, … the rules for reading 0 and 1, as write, move,
 * next state; Z is halt. Champions from https://wiki.bbchallenge.org/wiki/Champions
 * (BB(2) Radó 1962; BB(3) proved by Lin 1963; BB(4) Brady 1983; BB(5)
 * Marxen & Buntrock 1989, proved the champion by the bbchallenge
 * Collaboration, "Determination of the fifth Busy Beaver value",
 * arXiv:2509.12337, 2025, announced 2 July 2024).
 */
export const BEAVERS = {
	2: '1RB1LB_1LA1RZ',
	3: '1RB1RZ_1LB0RC_1LC1LA',
	4: '1RB1LB_1LA0LC_1RZ1LD_1RD0RA',
	5: '1RB1LC_1RC1RB_1RD0LE_1LA1LD_1RZ0LA'
} as const;
export type BeaverSize = keyof typeof BEAVERS;

/** The 3-state machine that leaves the most 1s, Σ(3) = 6 (Wikipedia, "Busy beaver"). */
export const SIGMA3 = '1RB1RZ_0RC1RB_1LC1LA';

/** A machine in bbchallenge text format (`1RB1LB_1LA1RZ`), halt state H. */
export function fromStandard(text: string): Machine {
	const groups = text.split('_');
	const states = groups.map((_, i) => String.fromCharCode(65 + i));
	const rules: Machine['rules'] = {};
	groups.forEach((g, i) => {
		const r: Record<string, Rule | undefined> = {};
		for (let s = 0; s < 2; s++) {
			const [write, move, next] = g.slice(3 * s, 3 * s + 3);
			if (write === '-') continue;
			r[String(s)] = { write, move: move as Move, next: next === 'Z' ? 'H' : next };
		}
		rules[states[i]] = r;
	});
	return { blank: '0', symbols: ['0', '1'], states, start: 'A', rules };
}

// ---- running ------------------------------------------------------------------

/** A tape and head after some number of steps. Cell `i` is `cells[i - origin]`. */
export interface Frame {
	state: string;
	head: number;
	cells: string;
	origin: number;
}

export type Stop = 'halt' | 'limit';

export interface Run {
	/** frames[k]: the configuration after k steps. */
	frames: Frame[];
	/** rules[k]: the rule applied in step k + 1 (from frames[k] to frames[k + 1]). */
	applied: { state: string; read: string; rule: Rule }[];
	steps: number;
	stop: Stop;
	final: Frame;
}

export function symbolAt(f: Frame, i: number, blank: string): string {
	const j = i - f.origin;
	return j >= 0 && j < f.cells.length ? f.cells[j] : blank;
}

/** Run `m` on `input` for at most `maxSteps` steps, recording every frame. */
export function run(m: Machine, input: string, maxSteps = 2000): Run {
	const tape = new Map<number, string>();
	for (let i = 0; i < input.length; i++) if (input[i] !== m.blank) tape.set(i, input[i]);
	let state = m.start;
	let head = 0;
	let lo = 0;
	let hi = Math.max(0, input.length - 1);
	const snapshot = (): Frame => {
		let cells = '';
		for (let i = lo; i <= hi; i++) cells += tape.get(i) ?? m.blank;
		return { state, head, cells, origin: lo };
	};
	const frames = [snapshot()];
	const applied: Run['applied'] = [];
	let stop: Stop = 'halt';
	for (;;) {
		const read = tape.get(head) ?? m.blank;
		const rule = m.rules[state]?.[read];
		if (!rule) break;
		if (applied.length >= maxSteps) {
			stop = 'limit';
			break;
		}
		applied.push({ state, read, rule });
		if (rule.write === m.blank) tape.delete(head);
		else tape.set(head, rule.write);
		head += rule.move === 'R' ? 1 : -1;
		state = rule.next;
		lo = Math.min(lo, head);
		hi = Math.max(hi, head);
		frames.push(snapshot());
	}
	const final = frames[frames.length - 1];
	return { frames, applied, steps: applied.length, stop, final };
}

/** The non-blank part of a tape, trimmed of blanks at both ends. */
export function tapeText(f: Frame, blank: string): string {
	let s = f.cells;
	while (s.startsWith(blank)) s = s.slice(1);
	while (s.endsWith(blank)) s = s.slice(0, -1);
	return s;
}

/**
 * Run a two-symbol machine from a blank tape without recording anything, fast
 * enough for BB(5)'s 47 million steps. Returns the steps taken and the 1s left.
 */
export function runFast(
	m: Machine,
	maxSteps: number
): { steps: number; ones: number; halted: boolean } {
	const n = m.states.length;
	const idx = new Map(m.states.map((s, i) => [s, i]));
	// Per state and symbol: write, move (+1/−1), next (−1 = no rule, stop).
	const write = new Int8Array(2 * n);
	const move = new Int8Array(2 * n);
	const next = new Int16Array(2 * n).fill(-1);
	m.states.forEach((s, i) => {
		for (let b = 0; b < 2; b++) {
			const r = m.rules[s]?.[String(b)];
			if (!r) continue;
			write[2 * i + b] = Number(r.write);
			move[2 * i + b] = r.move === 'R' ? 1 : -1;
			next[2 * i + b] = idx.get(r.next) ?? n; // n: a state with no rules (halt)
		}
	});
	let size = 1 << 12;
	let tape = new Uint8Array(size);
	let head = size >> 1;
	let state = idx.get(m.start) ?? 0;
	let steps = 0;
	while (state < n && steps < maxSteps) {
		const k = 2 * state + tape[head];
		const nx = next[k];
		if (nx < 0) break;
		tape[head] = write[k];
		head += move[k];
		state = nx;
		steps++;
		if (head < 0 || head >= size) {
			// Grow the tape, keeping the written part in the middle.
			const bigger = new Uint8Array(size * 2);
			bigger.set(tape, size >> 1);
			head += size >> 1;
			tape = bigger;
			size *= 2;
		}
	}
	let ones = 0;
	for (let i = 0; i < size; i++) ones += tape[i];
	const halted = state >= n || next[2 * state + tape[head]] < 0;
	return { steps, ones, halted };
}

/** The 1s on the tape of a frame. */
export function countOnes(f: Frame): number {
	let c = 0;
	for (const ch of f.cells) if (ch === '1') c++;
	return c;
}

// ---- the reader's rule tables ----------------------------------------------------

export const MAX_STEPS = 500;

export interface ParseError {
	line: number;
	message: string;
}

export type Parsed = { ok: true; machine: Machine } | { ok: false; errors: ParseError[] };

/**
 * Parse a rule table, one rule per line: `state symbol -> write move next`.
 * Symbols are single characters (`_` is the blank); moves are L or R; `#` or
 * `;` starts a comment. The first rule's state is the start state.
 */
export function parseMachine(source: string, blank = '_'): Parsed {
	const errors: ParseError[] = [];
	const rules: Machine['rules'] = {};
	const states: string[] = [];
	const symbols = new Set<string>([blank]);
	source.split(/\r?\n/).forEach((raw, i) => {
		const line = i + 1;
		const fail = (message: string) => void errors.push({ line, message });
		const text = raw.replace(/[#;].*$/, '').trim();
		if (!text) return;
		const m = /^(\S+)\s+(\S+)\s*->\s*(\S+)\s+(\S+)\s+(\S+)$/.exec(text);
		if (!m) {
			return fail('expected “state symbol -> write move next”');
		}
		const [, state, read, write, mv, next] = m;
		if (!NAME.test(state)) return fail(`“${state}” is not a state name`);
		if (!NAME.test(next)) return fail(`“${next}” is not a state name`);
		if (read.length !== 1) return fail(`“${read}”: a symbol is one character`);
		if (write.length !== 1) return fail(`“${write}”: a symbol is one character`);
		const move = mv.toUpperCase();
		if (move !== 'L' && move !== 'R') return fail(`move “${mv}” must be L or R`);
		if (rules[state]?.[read]) {
			return fail(`a second rule for ${state} reading ${read}`);
		}
		if (!rules[state]) {
			rules[state] = {};
			states.push(state);
		}
		rules[state][read] = { write, move, next };
		symbols.add(read);
		symbols.add(write);
	});
	if (errors.length) return { ok: false, errors };
	if (!states.length) return { ok: false, errors: [{ line: 1, message: 'no rules yet' }] };
	const order = [...symbols].sort((a, b) => (a === blank ? 1 : b === blank ? -1 : a < b ? -1 : 1));
	return { ok: true, machine: { blank, symbols: order, states, start: states[0], rules } };
}

// ---- the halting table ---------------------------------------------------------------

/**
 * A machine's own description as a string of 0s and 1s, so that it can be the
 * input of another machine: each rule `state symbol -> write move next` as
 * 1^(state+1) 0 1^(symbol+1) 0 1^(write+1) 0 1^(move+1) 0 1^(next+1) 00, with
 * states and symbols numbered in table order (halting states after the rest).
 */
export function encode(m: Machine): string {
	const nextNames = [...m.states];
	for (const s of m.states)
		for (const r of Object.values(m.rules[s]))
			if (r && !nextNames.includes(r.next)) nextNames.push(r.next);
	const unary = (k: number) => '1'.repeat(k + 1);
	let out = '';
	for (const s of m.states)
		for (const sym of m.symbols) {
			const r = m.rules[s][sym];
			if (!r) continue;
			out += [
				unary(m.states.indexOf(s)),
				unary(m.symbols.indexOf(sym)),
				unary(m.symbols.indexOf(r.write)),
				unary(r.move === 'L' ? 0 : 1),
				unary(nextNames.indexOf(r.next))
			].join('0');
			out += '00';
		}
	return out;
}

export type Verdict = 'halts' | 'loops';

/**
 * Does `m` halt on `input`? Decided here by running it and watching for a
 * repeat: a configuration seen before (a cycle), or the head walking off into
 * blank tape in a state it already passed through there, heading the same way
 * (it will walk forever). This settles every machine in the table below, but
 * no such trick settles every machine: that is the halting problem.
 */
export function decide(m: Machine, input: string, maxSteps = 20000): Verdict | 'unknown' {
	const tape = new Map<number, string>();
	for (let i = 0; i < input.length; i++) if (input[i] !== m.blank) tape.set(i, input[i]);
	let lo = 0;
	let hi = input.length - 1;
	let state = m.start;
	let head = 0;
	const seen = new Set<string>();
	const runaway = new Set<string>();
	for (let s = 0; s < maxSteps; s++) {
		const read = tape.get(head) ?? m.blank;
		const rule = m.rules[state]?.[read];
		if (!rule) return 'halts';
		// Beyond everything written so far, heading outwards: only the state matters.
		if ((head > hi && rule.move === 'R') || (head < lo && rule.move === 'L')) {
			if (read === m.blank) {
				const key = `${rule.move}${state}`;
				if (runaway.has(key)) return 'loops';
				runaway.add(key);
			}
		} else runaway.clear();
		const key = `${state}@${head}:${[...tape.entries()].sort((a, b) => a[0] - b[0]).join()}`;
		if (seen.has(key)) return 'loops';
		seen.add(key);
		if (rule.write === m.blank) tape.delete(head);
		else tape.set(head, rule.write);
		if (rule.write !== m.blank) {
			lo = Math.min(lo, head);
			hi = Math.max(hi, head);
		}
		head += rule.move === 'R' ? 1 : -1;
		state = rule.next;
	}
	return 'unknown';
}

/** The small machines of the halting table: each is run on every one's description. */
export const TABLE_MACHINES: { name: string; source: string }[] = [
	{ name: 'Add one', source: INCREMENT_SOURCE },
	{ name: 'Palindrome?', source: PALINDROME_SOURCE },
	{
		name: 'Walk right',
		source: `go 0 -> 0 R go
go 1 -> 1 R go
go _ -> _ R go`
	},
	{
		name: 'Even length',
		source: `even 0 -> 0 R odd
even 1 -> 1 R odd
odd 0 -> 0 R even
odd 1 -> 1 R even
odd _ -> _ R odd`
	},
	{
		name: '1s ÷ 4',
		source: `a 0 -> 0 R a
a 1 -> 1 R b
b 0 -> 0 R b
b 1 -> 1 R c
c 0 -> 0 R c
c 1 -> 1 R d
d 0 -> 0 R d
d 1 -> 1 R a
b _ -> _ R b
c _ -> _ R c
d _ -> _ R d`
	},
	{
		name: 'Length ÷ 3',
		source: `a 0 -> 0 R b
a 1 -> 1 R b
b 0 -> 0 R c
b 1 -> 1 R c
c 0 -> 0 R a
c 1 -> 1 R a
b _ -> _ R b
c _ -> _ R c`
	}
];

export interface HaltingTable {
	names: string[];
	codes: string[];
	/** cells[i][j]: does machine i halt when given machine j's description? */
	cells: Verdict[][];
}

export function haltingTable(): HaltingTable {
	const ms = TABLE_MACHINES.map((t) => machine(t.source.split('\n')));
	const codes = ms.map(encode);
	const cells = ms.map((m) =>
		codes.map((c) => {
			const v = decide(m, c);
			if (v === 'unknown') throw new Error('undecided entry in the halting table');
			return v;
		})
	);
	return { names: TABLE_MACHINES.map((t) => t.name), codes, cells };
}

// ---- the travelling salesman ----------------------------------------------------------

export interface City {
	x: number;
	y: number;
}

/** Made-up cities, from a seeded generator (mulberry32), in the unit square. */
export function cities(n: number, seed = 1): City[] {
	let a = seed >>> 0;
	const rnd = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const out: City[] = [];
	while (out.length < n) {
		const c = { x: 0.06 + 0.88 * rnd(), y: 0.08 + 0.84 * rnd() };
		// Keep cities apart, so they can be told apart on the map.
		if (out.every((o) => Math.hypot(o.x - c.x, o.y - c.y) > 0.11)) out.push(c);
	}
	return out;
}

export function tourLength(cs: City[], tour: number[]): number {
	let d = 0;
	for (let i = 0; i < tour.length; i++) {
		const a = cs[tour[i]];
		const b = cs[tour[(i + 1) % tour.length]];
		d += Math.hypot(a.x - b.x, a.y - b.y);
	}
	return d;
}

/** Distinct round trips through n cities: (n − 1)!/2 (any start, either direction). */
export function tourCount(n: number): number {
	if (n < 3) return 1;
	let f = 1;
	for (let k = 2; k <= n - 1; k++) f *= k;
	return f / 2;
}

/**
 * Every distinct tour, in the order brute force tries them: city 0 first, the
 * rest in lexicographic order of permutations, keeping each tour in only one
 * direction (second city before the last). Calls `visit` for each.
 */
export function eachTour(n: number, visit: (tour: number[]) => void): void {
	if (n < 3) {
		visit([...Array(n).keys()]);
		return;
	}
	const rest = [...Array(n - 1).keys()].map((i) => i + 1);
	const permute = (k: number) => {
		if (k === rest.length) {
			if (rest[0] < rest[rest.length - 1]) visit([0, ...rest]);
			return;
		}
		for (let i = k; i < rest.length; i++) {
			[rest[k], rest[i]] = [rest[i], rest[k]];
			permute(k + 1);
			[rest[k], rest[i]] = [rest[i], rest[k]];
		}
	};
	permute(0);
}

export interface Search {
	/** The tours in the order tried (for the replay; only for small n). */
	tried: number[][];
	/** Index in `tried` of each new best tour, with its length. */
	records: { at: number; length: number }[];
	best: number[];
	bestLength: number;
}

/** Brute force: try every tour, keeping the shortest. Records the tours when n ≤ 8. */
export function bruteForce(cs: City[]): Search {
	const tried: number[][] = [];
	const records: Search['records'] = [];
	let best: number[] = [];
	let bestLength = Infinity;
	let i = 0;
	const keep = cs.length <= 8;
	eachTour(cs.length, (tour) => {
		const d = tourLength(cs, tour);
		if (keep) tried.push([...tour]);
		if (d < bestLength - 1e-12) {
			bestLength = d;
			best = [...tour];
			records.push({ at: i, length: d });
		}
		i++;
	});
	return { tried, records, best, bestLength };
}

/** The greedy guess: always go to the nearest city not yet visited. */
export function nearestNeighbour(cs: City[]): number[] {
	const tour = [0];
	const left = new Set(cs.map((_, i) => i).slice(1));
	while (left.size) {
		const here = cs[tour[tour.length - 1]];
		let pick = -1;
		let d = Infinity;
		for (const j of left) {
			const e = Math.hypot(cs[j].x - here.x, cs[j].y - here.y);
			if (e < d) {
				d = e;
				pick = j;
			}
		}
		tour.push(pick);
		left.delete(pick);
	}
	return tour;
}

/** Years to try every tour of n cities at `rate` tours per second. */
export function bruteForceYears(n: number, rate = 1e9): number {
	return tourCount(n) / rate / (365.25 * 24 * 3600);
}
