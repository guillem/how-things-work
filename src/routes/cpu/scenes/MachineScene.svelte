<script lang="ts">
	/**
	 * The whole machine: the program listing (or, on the editor step, a text
	 * editor), the CPU (PC, IR, control unit, registers, ALU, flags) and the 32
	 * bytes of memory, joined by the address and data buses.
	 *
	 * The program is assembled and run once (`run`), recording every phase. A
	 * frame shows the machine at position `k` (in ticks, one phase per tick):
	 * phase ⌈k⌉ − 1 is under way with progress `u` (1 = done). Tokens carry
	 * numbers along the buses while a phase is under way; when it is done, the
	 * parts it read and wrote stay outlined in the phase's colour.
	 *
	 * Steps:
	 * - `tour`: the machine before it starts, with its parts highlighted in turn;
	 * - `focus` (fetch/decode/execute): one phase of `ADD R0, R1`, on a loop;
	 * - otherwise a replay driven by `createPlayback` (shared with the sorting
	 *   explainer), with a scrubber (a Handle), Step and Start-again buttons.
	 *
	 * The editor is an HTML textarea in a `foreignObject`. Its key presses are
	 * stopped from reaching the explainer's keyboard shortcuts.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Handle, along, clamp, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '../../sorting/playback';
	import {
		MAX_INSTRUCTIONS,
		MEM_SIZE,
		OPCODES,
		PROGRAMS,
		assemble,
		disassemble,
		maxProgram,
		run,
		stateAt,
		type Decoded,
		type Machine,
		type Phase,
		type ProgramName
	} from '../cpu';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const edit = $derived(Boolean(step.hints?.edit));
	const tour = $derived(Boolean(step.hints?.tour));
	const focus = $derived(step.hints?.focus as 'fetch' | 'decode' | 'execute' | undefined);
	const playing = $derived(!offered.has('play') || params.play !== false);
	const pace = $derived(offered.has('pace') ? Number(params.pace) : 2);

	// ---- the program -------------------------------------------------------------
	const example = $derived(String(params.example ?? 'sum') as ProgramName);
	const source = $derived.by(() => {
		if (edit) return typeof params.source === 'string' ? params.source : PROGRAMS[example];
		const name = String(step.hints?.program ?? 'first');
		if (name === 'max') return maxProgram(Number(params.a ?? 23), Number(params.b ?? 42));
		return PROGRAMS[name as ProgramName];
	});
	// Loading an example replaces the editor's text (only when the choice changes).
	let lastExample: string | undefined;
	$effect(() => {
		const ex = example;
		untrack(() => {
			if (lastExample !== undefined && ex !== lastExample) setParam('source', PROGRAMS[ex]);
			lastExample = ex;
		});
	});

	const asm = $derived(assemble(source));
	const rec = $derived(asm.ok ? run(asm.memory) : null);
	const total = $derived(rec ? rec.phases.length : 0);
	const title = $derived(/^\s*;\s*(.+)$/m.exec(source.split('\n')[0] ?? '')?.[1] ?? 'Your program');
	const runKey = $derived(`${source}|${Number(params.rewind ?? 0)}`);

	// ---- playback (as in the sorting explainer) ------------------------------------
	const position = createPlayback(0.5);
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	let lastK = 0;
	// Focus steps: phase 6, 7 or 8 (the fetch, decode and execute of ADD R0, R1) on a loop.
	const FOCUS_AT = { fetch: 6, decode: 7, execute: 8 } as const;
	const k = $derived.by(() => {
		if (tour) return 0;
		if (focus) {
			const v = reduced ? 1 : clamp(cycle(t, 4.2) / 2.8 - 0.08, 0.001, 1);
			return FOCUS_AT[focus] + v;
		}
		const v = reduced
			? playing
				? total
				: clamp(manual, 0, total)
			: position(t, { key: runKey, playing, pace, manual, total });
		if (playing) lastK = v;
		return v;
	});
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.floor(lastK));
			wasPlaying = now;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', runKey);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		lastK = clamp(Math.round(v), 0, total);
		if (playing) setParam('play', false);
		setPosition(v);
	}
	// "Step one tick": finish the phase under way, or do the next one.
	let lastTick: number | undefined;
	$effect(() => {
		const n = Number(params.tick ?? 0);
		untrack(() => {
			if (lastTick !== undefined && n !== lastTick) {
				const base = playing ? Math.floor(lastK) : Math.round(manual);
				scrubTo(base + 1);
			}
			lastTick = n;
		});
	});

	// ---- the frame ------------------------------------------------------------------
	/** Index of the phase under way or just done (−1 before the first). */
	const p = $derived(k <= 0 ? -1 : Math.min(total, Math.ceil(k)) - 1);
	const u = $derived(p < 0 ? 1 : clamp(k - p));
	const phase = $derived<Phase | undefined>(rec && p >= 0 ? rec.phases[p] : undefined);
	const fast = $derived(!focus && pace > 10 && playing && !reduced);
	/** The phase's effects show once it is 80% done. */
	const post = $derived(u >= 0.8 || fast);
	const blank: Machine = {
		pc: 0,
		ir: [0, 0],
		regs: [0, 0, 0, 0],
		z: false,
		c: false,
		mem: new Array<number>(MEM_SIZE).fill(0)
	};
	const before = $derived(rec ? stateAt(rec, Math.max(0, p)) : blank);
	const shown = $derived(rec ? (p < 0 ? rec.initial : post ? phase!.after : before) : blank);
	const kind = $derived(phase?.kind);
	const col = (kind: string | undefined) =>
		kind ? `var(--cpu-${kind})` : 'var(--explainer-accent)';
	const pcol = $derived(col(kind));
	const instr = $derived<Decoded | null>(phase?.instr ?? null);
	/** The instruction being worked on is known from decode on (its bytes from fetch). */
	const known = $derived(phase && (kind !== 'fetch' || post) ? phase : undefined);
	const instructionsDone = $derived(
		rec
			? rec.phases.slice(0, Math.max(0, p + (post ? 1 : 0))).filter((q) => q.kind === 'execute')
					.length
			: 0
	);
	const finished = $derived(rec !== null && p === total - 1 && post);

	// ---- geometry ---------------------------------------------------------------------
	const ADDR_Y = 104;
	const DATA_Y = 118;
	const PC = { x: 328, y: 140, w: 88, h: 46 };
	const IR = { x: 432, y: 140, w: 180, h: 46 };
	const CU = { x: 328, y: 198, w: 284, h: 80 };
	const REG_Y = [294, 340, 386, 432];
	const REG = { x: 328, w: 108, h: 38 };
	const BUS_X = 452;
	const ALU = { cx: 540, top: 316, bottom: 384 };
	const IN_A = 500;
	const IN_B = 580;
	const LANE_X = 657;
	const MEM_X = 668;
	const CELL = 32;
	const PITCH_X = 34.5;
	const ROW_Y = [158, 222, 286, 350];
	const cellPos = (a: number) => ({ x: MEM_X + (a % 8) * PITCH_X, y: ROW_Y[Math.floor(a / 8)] });
	const regMid = (r: number): Point => ({ x: REG.x + REG.w, y: REG_Y[r] + REG.h / 2 });
	const IR_BYTE2: Point = { x: IR.x + 140, y: IR.y + 30 };

	/** From the CPU along a bus to the bottom of a memory cell (through the lane under its row). */
	function toCell(start: Point[], busY: number, a: number): Point[] {
		const c = cellPos(a);
		const lane = c.y + CELL + 9;
		return [
			...start,
			{ x: LANE_X, y: busY },
			{ x: LANE_X, y: lane },
			{ x: c.x + CELL / 2, y: lane },
			{ x: c.x + CELL / 2, y: c.y + CELL }
		];
	}
	const fromPc: Point[] = [
		{ x: PC.x + PC.w / 2, y: PC.y },
		{ x: PC.x + PC.w / 2, y: ADDR_Y }
	];
	const fromIrOperand: Point[] = [
		{ x: IR_BYTE2.x, y: IR.y },
		{ x: IR_BYTE2.x, y: ADDR_Y }
	];
	const toIr: Point[] = [
		{ x: IR.x + 90, y: DATA_Y },
		{ x: IR.x + 90, y: IR.y }
	];
	const regToBus = (r: number, y: number): Point[] => [
		regMid(r),
		{ x: BUS_X, y: regMid(r).y },
		{ x: BUS_X, y }
	];
	const rev = (pts: Point[]) => [...pts].reverse();
	const aluIn = (x: number) => [
		{ x: BUS_X, y: 300 },
		{ x, y: 300 },
		{ x, y: ALU.top }
	];

	interface Token {
		id: string;
		path: Point[];
		text: string;
		from: number;
		to: number;
		color: string;
	}

	/** What travels where during the phase under way. */
	const tokens = $derived.by((): Token[] => {
		if (!phase || !rec || fast) return [];
		const m = before;
		const c = col(phase.kind);
		if (phase.kind === 'fetch') {
			return [
				{
					id: 'a',
					path: toCell(fromPc, ADDR_Y, phase.at),
					text: String(phase.at),
					from: 0,
					to: 0.38,
					color: c
				},
				{
					id: 'd',
					path: [...rev(toCell([], DATA_Y, phase.at)), ...toIr],
					text: `${m.mem[phase.at]} ${m.mem[phase.at + 1]}`,
					from: 0.4,
					to: 0.78,
					color: c
				}
			];
		}
		if (phase.kind === 'decode' || !instr) return [];
		const { r, s, n } = instr;
		const irDown = (y: number): Point[] => [
			IR_BYTE2,
			{ x: IR.x, y: IR_BYTE2.y },
			{ x: BUS_X, y: IR_BYTE2.y },
			{ x: BUS_X, y }
		];
		switch (instr.op) {
			case 'LDI':
				return [
					{
						id: 'n',
						path: [...irDown(regMid(r).y), regMid(r)],
						text: String(n),
						from: 0.1,
						to: 0.75,
						color: c
					}
				];
			case 'LOAD':
				return [
					{
						id: 'a',
						path: toCell(fromIrOperand, ADDR_Y, n),
						text: String(n),
						from: 0,
						to: 0.38,
						color: c
					},
					{
						id: 'd',
						path: [
							...rev(toCell([], DATA_Y, n)),
							{ x: BUS_X, y: DATA_Y },
							...rev(regToBus(r, DATA_Y)).slice(1)
						],
						text: String(m.mem[n]),
						from: 0.4,
						to: 0.78,
						color: c
					}
				];
			case 'STORE':
				return [
					{
						id: 'a',
						path: toCell(fromIrOperand, ADDR_Y, n),
						text: String(n),
						from: 0,
						to: 0.38,
						color: c
					},
					{
						id: 'd',
						path: toCell(regToBus(r, DATA_Y), DATA_Y, n),
						text: String(m.regs[r]),
						from: 0.4,
						to: 0.78,
						color: c
					}
				];
			case 'ADD':
			case 'SUB': {
				const res = phase.alu!;
				return [
					{
						id: 'x',
						path: [...regToBus(r, 300).slice(0, 2), ...aluIn(IN_A)],
						text: String(res.a),
						from: 0,
						to: 0.36,
						color: c
					},
					{
						id: 'y',
						path: [...regToBus(s, 300).slice(0, 2), ...aluIn(IN_B)],
						text: String(res.b),
						from: 0.04,
						to: 0.4,
						color: c
					},
					{
						id: 'z',
						path: [
							{ x: ALU.cx, y: ALU.bottom },
							{ x: ALU.cx, y: 474 },
							{ x: BUS_X, y: 474 },
							{ x: BUS_X, y: regMid(r).y },
							regMid(r)
						],
						text: String(res.result),
						from: 0.44,
						to: 0.78,
						color: c
					}
				];
			}
			case 'JMP':
			case 'JZ':
			case 'JC':
				if (!phase.jumped) return [];
				return [
					{
						id: 'j',
						path: [
							IR_BYTE2,
							{ x: IR_BYTE2.x, y: IR.y + IR.h + 4 },
							{ x: PC.x + PC.w / 2, y: IR.y + IR.h + 4 },
							{ x: PC.x + PC.w / 2, y: PC.y + PC.h }
						],
						text: String(n),
						from: 0.1,
						to: 0.75,
						color: c
					}
				];
			default:
				return [];
		}
	});
	const ease = (v: number) => v * v * (3 - 2 * v);
	const live = $derived(
		tokens.flatMap((tk) => {
			if (u <= tk.from || u >= tk.to + 0.04) return [];
			const v = clamp((u - tk.from) / (tk.to - tk.from));
			const pos = along(tk.path, ease(v));
			const o =
				smoothstep(0, 0.12, v) * (1 - smoothstep(1, 1.04, (u - tk.from) / (tk.to - tk.from)));
			return [{ ...tk, pos, o }];
		})
	);

	// ---- what the phase touched (outlined in its colour once done) -------------------------
	const touched = $derived.by(() => {
		const out = {
			mem: new Set<number>(),
			regs: new Set<number>(),
			pc: false,
			ir: false,
			alu: false,
			cu: false,
			flags: false
		};
		if (!phase) return out;
		const show = post || phase.kind === 'decode';
		if (!show) {
			// While under way: what is being read.
			phase.memRead.forEach((a) => out.mem.add(a));
			phase.regRead.forEach((r) => out.regs.add(r));
			if (phase.kind === 'fetch') out.pc = true;
			if (phase.kind === 'execute')
				out.ir = instr?.op !== 'ADD' && instr?.op !== 'SUB' && instr?.op !== 'HALT';
			return out;
		}
		[...phase.memRead, ...phase.memWrite].forEach((a) => out.mem.add(a));
		[...phase.regRead, ...phase.regWrite].forEach((r) => out.regs.add(r));
		out.pc = phase.kind === 'fetch' || Boolean(phase.jumped);
		out.ir = phase.kind === 'fetch' || phase.kind === 'decode';
		out.cu = phase.kind === 'decode';
		out.alu = Boolean(phase.alu);
		out.flags = Boolean(phase.alu) || instr?.op === 'JZ' || instr?.op === 'JC';
		return out;
	});

	// ---- memory: which bytes are code and which are data, and their labels -------------------
	const layout = $derived.by(() => {
		const kindOf = new Array<'code' | 'data' | ''>(MEM_SIZE).fill('');
		const names: Record<number, string> = {};
		if (asm.ok) {
			for (const it of asm.items) {
				kindOf[it.addr] = it.kind === 'instr' ? 'code' : 'data';
				if (it.kind === 'instr' && it.addr + 1 < MEM_SIZE) kindOf[it.addr + 1] = 'code';
			}
			for (const [name, a] of Object.entries(asm.labels)) {
				if (kindOf[a] === 'data') names[a] = name;
			}
		}
		return { kindOf, names };
	});

	const bytesUsed = $derived(
		asm.ok ? asm.items.reduce((n, it) => n + (it.kind === 'instr' ? 2 : 1), 0) : 0
	);

	// ---- the listing ---------------------------------------------------------------------------
	const listing = $derived.by(() => {
		if (!asm.ok) return [];
		const byLine = new Map(asm.items.map((it) => [it.line, it]));
		const lines = source.split(/\r?\n/);
		return lines.flatMap((raw, i) => {
			const text = raw.replace(/;.*$/, '').trimEnd();
			if (!text.trim()) return [];
			const it = byLine.get(i + 1);
			return [{ line: i + 1, text, addr: it?.addr }];
		});
	});
	/** The instruction being worked on, and where the PC points. */
	const currentAt = $derived(phase && !(phase.kind === 'fetch' && u < 0.05) ? phase.at : -1);
	const pcAt = $derived(shown.pc);
	const LIST_Y = 136;
	const LINE_H = 19;

	// ---- editor -----------------------------------------------------------------------------------
	const ED = { x: 34, y: 100, w: 266, h: 330 };
	const ED_PAD = 6;
	const ED_LINE = 18;
	let edScroll = $state(0);
	const lineOfAddr = $derived(new Map(asm.ok ? asm.items.map((it) => [it.addr, it.line]) : []));
	const edMarkY = (addr: number) => {
		const line = lineOfAddr.get(addr);
		if (line === undefined) return null;
		const y = ED.y + ED_PAD + (line - 1) * ED_LINE + ED_LINE / 2 - edScroll;
		return y > ED.y + 4 && y < ED.y + ED.h - 4 ? y : null;
	};

	// ---- words ------------------------------------------------------------------------------------
	const bin = (v: number, w: number) => v.toString(2).padStart(w, '0');
	const opBits = $derived(instr ? bin(OPCODES[instr.op], 4) : '');
	function decodeWords(d: Decoded) {
		const head = `Decode: opcode ${bin(OPCODES[d.op], 4)} is ${d.op}`;
		switch (d.op) {
			case 'LDI':
				return `${head}: put the number ${d.n} into R${d.r}`;
			case 'LOAD':
				return `${head}: copy the byte at address ${d.n} into R${d.r}`;
			case 'STORE':
				return `${head}: copy R${d.r} into memory at address ${d.n}`;
			case 'ADD':
				return `${head}: R${d.r} = R${d.r} + R${d.s}`;
			case 'SUB':
				return `${head}: R${d.r} = R${d.r} − R${d.s}`;
			case 'JMP':
				return `${head}: continue at address ${d.n}`;
			case 'JZ':
				return `${head}: jump to ${d.n} if the Z flag is on`;
			case 'JC':
				return `${head}: jump to ${d.n} if the C flag is on`;
			case 'HALT':
				return `${head}: stop the clock`;
		}
	}
	const words = $derived.by(() => {
		if (!rec) return 'The program has mistakes, so nothing can run yet.';
		if (tour) return TOUR[tourIndex].words;
		if (!phase)
			return 'Ready: the PC is 0, so the first instruction will be fetched from address 0.';
		const m = before;
		const d = phase.instr;
		if (phase.kind === 'fetch') {
			const b = `${m.mem[phase.at]} and ${m.mem[phase.at + 1]}`;
			if (!d)
				return `Fetch from address ${phase.at}: bytes ${b}, but ${m.mem[phase.at]} is not an instruction`;
			return `Fetch: the PC sends address ${phase.at} to memory, bytes ${b} come back into the IR, and the PC moves on to ${phase.at + 2}`;
		}
		if (!d) return '';
		if (phase.kind === 'decode') return decodeWords(d);
		const a = phase.alu;
		switch (d.op) {
			case 'LDI':
				return `Execute: ${d.n} goes into R${d.r}`;
			case 'LOAD':
				return `Execute: address ${d.n} goes to memory, which sends ${m.mem[d.n]} back into R${d.r}`;
			case 'STORE':
				return `Execute: R${d.r} (${m.regs[d.r]}) is written into memory at address ${d.n}`;
			case 'ADD':
			case 'SUB': {
				const raw = d.op === 'ADD' ? a!.a + a!.b : a!.a - a!.b;
				const sign = d.op === 'ADD' ? '+' : '−';
				const wrap = raw !== a!.result ? `, which wraps round to ${a!.result}` : '';
				const flags = [
					a!.z ? 'Z on (zero)' : '',
					a!.c ? (d.op === 'ADD' ? 'C on (carry)' : 'C on (borrow)') : ''
				].filter(Boolean);
				return `Execute: the ALU works out ${a!.a} ${sign} ${a!.b} = ${raw}${wrap}, into R${d.r}${flags.length ? ` · ${flags.join(', ')}` : ''}`;
			}
			case 'JMP':
				return `Execute: the PC is set to ${d.n}, so the next fetch comes from there`;
			case 'JZ':
			case 'JC': {
				const f = d.op === 'JZ' ? 'Z' : 'C';
				return phase.jumped
					? `Execute: ${f} is on, so the PC is set to ${d.n}: jump`
					: `Execute: ${f} is off, so no jump: the PC stays at ${phase.after.pc}`;
			}
			case 'HALT':
				return 'Execute: HALT. The clock stops; the program is finished';
		}
	});
	const status = $derived.by(() => {
		if (!rec) return '';
		const ins = `${rec.instructions.toLocaleString('en')} instructions, ${total.toLocaleString('en')} ticks`;
		switch (rec.stop) {
			case 'halt':
				return `Halted after ${ins}`;
			case 'limit':
				return `Stopped after ${MAX_INSTRUCTIONS.toLocaleString('en')} instructions: the program never reached HALT`;
			case 'bad-opcode':
				return `Stopped: the byte at address ${rec.phases[total - 1].at} is not an instruction`;
			case 'bad-address':
				return `Stopped: an instruction used an address outside memory`;
			case 'end-of-memory':
				return `Stopped: the PC ran off the end of memory`;
		}
	});

	// ---- tour ---------------------------------------------------------------------------------------
	const TOUR = [
		{
			part: 'mem',
			words:
				'Memory: 32 numbered boxes of one byte each. The program is stored here as bytes (blue), next to its data (orange)'
		},
		{
			part: 'pc',
			words: 'The program counter (PC) holds the address of the next instruction: 0, the start'
		},
		{
			part: 'ir',
			words:
				'The instruction register (IR) and the control unit: they hold the current instruction and work out what it means'
		},
		{
			part: 'regs',
			words: 'Four registers, R0–R3: the numbers the processor is working on right now'
		},
		{
			part: 'alu',
			words:
				'The ALU adds and subtracts, and sets the Z and C flags; the buses carry addresses and bytes to and from memory'
		}
	] as const;
	const tourIndex = $derived(reduced ? 0 : Math.floor(t / 3.6) % TOUR.length);
	const tourPart = $derived(tour && !reduced ? TOUR[tourIndex].part : '');
	const dimFor = (part: string) => (tourPart && tourPart !== part ? 0.45 : 1);

	// ---- timeline --------------------------------------------------------------------------------------
	const TL0 = 96;
	const TL1 = 864;
	const TLY = 524;
	const showTimeline = $derived(!tour && !focus);
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? Math.min(k, total) / total : 0));
	function onmove(pt: Point) {
		scrubTo(((pt.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(sk: number | 'start' | 'end') {
		const base = playing ? Math.floor(lastK) : Math.round(manual);
		scrubTo(sk === 'start' ? 0 : sk === 'end' ? total : base + sk);
	}
	const tickNow = $derived(Math.max(0, p + (post ? 1 : 0)));

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const PHASES = ['fetch', 'decode', 'execute'] as const;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		mono?: boolean;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:font-family={opts.mono ? 'var(--font-mono)' : undefined}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet box(
	x: number,
	y: number,
	w: number,
	h: number,
	on: boolean,
	color: string,
	fill = 'var(--surface)'
)}
	<rect
		{x}
		{y}
		width={w}
		height={h}
		rx="7"
		{fill}
		stroke={on ? color : 'var(--border)'}
		stroke-width={on ? 2.5 : 1.2}
	/>
{/snippet}

<g opacity={fadeIn}>
	<!-- header: program name, the three phases, the words for this phase -->
	{@render txt(16, 34, title, 16, { weight: 600 })}
	{#each PHASES as ph, i (ph)}
		{@const on = kind === ph && !tour}
		{@const x = 640 + i * 104}
		<rect
			{x}
			y="16"
			width="88"
			height="26"
			rx="13"
			fill={on ? col(ph) : 'none'}
			stroke={col(ph)}
			stroke-width="1.5"
			opacity={on ? 1 : 0.55}
		/>
		{@render txt(x + 44, 34, ph.toUpperCase(), 12, {
			anchor: 'middle',
			weight: 700,
			color: on ? '#fff' : col(ph),
			halo: false
		})}
		{#if i < 2}
			<path
				d="M{x + 91} 29 h10"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
			/>
		{/if}
	{/each}
	{@render txt(16, 70, words, 14, { color: kind && !tour ? pcol : undefined })}

	<!-- buses -->
	<g opacity={dimFor('alu')}>
		<path
			d="M{PC.x + PC.w / 2} {PC.y} V{ADDR_Y} H{LANE_X}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		<path
			d="M{IR_BYTE2.x} {IR.y} V{ADDR_Y}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		<path
			d="M{IR.x + 90} {IR.y} V{DATA_Y} M{BUS_X} {DATA_Y} H{LANE_X}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
			stroke-dasharray="6 3"
		/>
		<path
			d="M{LANE_X} {ADDR_Y} V{ROW_Y[3] + CELL + 9}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="2"
		/>
		{@render txt(470, ADDR_Y - 5, 'address bus', 10, { muted: true, anchor: 'middle' })}
		{@render txt(612, DATA_Y - 4, 'data bus', 10, { muted: true, anchor: 'end' })}
		<!-- the CPU's internal bus: IR, registers, ALU -->
		<path
			d="M{BUS_X} {DATA_Y} V474 H{ALU.cx} V{ALU.bottom}"
			fill="none"
			stroke="var(--stage-grid)"
			stroke-width="3"
		/>
		<path
			d="M{BUS_X} 300 H{IN_B} V{ALU.top} M{IN_A} 300 V{ALU.top}"
			fill="none"
			stroke="var(--stage-grid)"
			stroke-width="3"
		/>
		{#each REG_Y as y (y)}
			<path
				d="M{REG.x + REG.w} {y + REG.h / 2} H{BUS_X}"
				stroke="var(--stage-grid)"
				stroke-width="3"
			/>
		{/each}
	</g>

	<!-- the CPU -->
	<rect
		x="312"
		y="128"
		width="316"
		height="362"
		rx="12"
		fill="var(--cpu-chip)"
		stroke="var(--cpu-chip-edge)"
		stroke-width="1.5"
		opacity="0.9"
	/>
	{@render txt(620, 482, 'CPU', 13, { anchor: 'end', weight: 700, muted: true, halo: false })}

	<g opacity={dimFor('pc')}>
		{@render box(
			PC.x,
			PC.y,
			PC.w,
			PC.h,
			touched.pc || tourPart === 'pc',
			tourPart === 'pc' ? 'var(--explainer-accent)' : pcol
		)}
		{@render txt(PC.x + 8, PC.y + 15, 'PC', 10, { muted: true, weight: 600 })}
		{@render txt(PC.x + PC.w / 2, PC.y + 37, String(shown.pc), 18, {
			anchor: 'middle',
			weight: 700,
			mono: true
		})}
	</g>
	<g opacity={dimFor('ir')}>
		{@render box(
			IR.x,
			IR.y,
			IR.w,
			IR.h,
			touched.ir || tourPart === 'ir',
			tourPart === 'ir' ? 'var(--explainer-accent)' : pcol
		)}
		{@render txt(IR.x + 8, IR.y + 15, 'IR', 10, { muted: true, weight: 600 })}
		{@render txt(IR.x + 90, IR.y + 37, String(shown.ir[0]), 18, {
			anchor: 'middle',
			weight: 700,
			mono: true
		})}
		{@render txt(IR_BYTE2.x, IR.y + 37, String(shown.ir[1]), 18, {
			anchor: 'middle',
			weight: 700,
			mono: true
		})}
		{@render txt(IR.x + 90, IR.y + 15, 'byte 1', 9, { anchor: 'middle', muted: true })}
		{@render txt(IR_BYTE2.x, IR.y + 15, 'byte 2', 9, { anchor: 'middle', muted: true })}

		<!-- control unit: the first byte split into its fields -->
		{@render box(
			CU.x,
			CU.y,
			CU.w,
			CU.h,
			touched.cu || tourPart === 'ir',
			tourPart === 'ir' ? 'var(--explainer-accent)' : pcol
		)}
		{@render txt(CU.x + 8, CU.y + 15, 'Control unit', 10, { muted: true, weight: 600 })}
		{#if known && instr}
			{@const fields = [
				{ bits: opBits, label: instr.op, w: 46 },
				{ bits: bin(instr.r, 2), label: `R${instr.r}`, w: 26 },
				{ bits: bin(instr.s, 2), label: `R${instr.s}`, w: 26 },
				{ bits: bin(instr.n, 8), label: `n = ${instr.n}`, w: 86 }
			]}
			{@const used = {
				r: instr.op !== 'JMP' && instr.op !== 'JZ' && instr.op !== 'JC' && instr.op !== 'HALT',
				s: instr.op === 'ADD' || instr.op === 'SUB',
				n: instr.op !== 'ADD' && instr.op !== 'SUB' && instr.op !== 'HALT'
			}}
			{@const reveal = kind === 'decode' ? smoothstep(0.1, 0.7, u) : 1}
			{#each fields as f, i (i)}
				{@const x0 = CU.x + 12 + [0, 54, 88, 128][i]}
				{@const on = i === 0 || (i === 1 && used.r) || (i === 2 && used.s) || (i === 3 && used.n)}
				<rect
					x={x0}
					y={CU.y + 26}
					width={f.w}
					height="22"
					rx="4"
					fill={on ? 'var(--cpu-code)' : 'none'}
					stroke="var(--border)"
				/>
				{@render txt(x0 + f.w / 2, CU.y + 42, f.bits, 12, {
					anchor: 'middle',
					mono: true,
					weight: 600,
					halo: false
				})}
				<g opacity={on ? reveal : reveal * 0.5}>
					{@render txt(x0 + f.w / 2, CU.y + 66, on ? f.label : 'unused', on ? 12 : 10, {
						anchor: 'middle',
						weight: on ? 700 : 400,
						muted: !on,
						color: on ? 'var(--cpu-decode)' : undefined,
						halo: false
					})}
				</g>
			{/each}
		{:else}
			{@render txt(
				CU.x + CU.w / 2,
				CU.y + 50,
				tour ? 'waiting for the first instruction' : '—',
				12,
				{ anchor: 'middle', muted: true, halo: false }
			)}
		{/if}
	</g>

	<!-- registers -->
	<g opacity={dimFor('regs')}>
		{#each REG_Y as y, r (r)}
			{@const on = touched.regs.has(r)}
			{@render box(
				REG.x,
				y,
				REG.w,
				REG.h,
				on || tourPart === 'regs',
				tourPart === 'regs' ? 'var(--explainer-accent)' : pcol
			)}
			{@render txt(REG.x + 10, y + 24, `R${r}`, 12, { weight: 600, muted: true, halo: false })}
			{@render txt(REG.x + REG.w - 10, y + 26, String(shown.regs[r]), 18, {
				anchor: 'end',
				weight: 700,
				mono: true,
				halo: false
			})}
		{/each}
	</g>

	<!-- ALU and flags -->
	<g opacity={dimFor('alu')}>
		<path
			d="M{ALU.cx - 78} {ALU.top} H{ALU.cx - 12} L{ALU.cx} {ALU.top + 14} L{ALU.cx +
				12} {ALU.top} H{ALU.cx + 78} L{ALU.cx + 40} {ALU.bottom} H{ALU.cx - 40} Z"
			fill="var(--surface)"
			stroke={touched.alu || tourPart === 'alu'
				? tourPart === 'alu'
					? 'var(--explainer-accent)'
					: pcol
				: 'var(--border)'}
			stroke-width={touched.alu || tourPart === 'alu' ? 2.5 : 1.2}
			stroke-linejoin="round"
		/>
		{@render txt(ALU.cx, ALU.top + 40, 'ALU', 12, {
			anchor: 'middle',
			weight: 700,
			muted: true,
			halo: false
		})}
		{#if phase?.alu && kind === 'execute'}
			{@render txt(ALU.cx, ALU.top + 60, phase.alu.op === 'ADD' ? 'add' : 'subtract', 11, {
				anchor: 'middle',
				color: 'var(--cpu-execute)',
				weight: 600,
				halo: false
			})}
		{/if}
		{#each [{ f: 'Z', on: shown.z, x: 500, help: 'zero' }, { f: 'C', on: shown.c, x: 580, help: 'carry' }] as fl (fl.f)}
			<circle
				cx={fl.x}
				cy="440"
				r="11"
				fill={fl.on ? 'var(--cpu-execute)' : 'var(--surface)'}
				stroke={touched.flags ? pcol : 'var(--border)'}
				stroke-width={touched.flags ? 2.5 : 1.2}
			/>
			{@render txt(fl.x, 445, fl.f, 12, {
				anchor: 'middle',
				weight: 700,
				color: fl.on ? '#fff' : 'var(--stage-ink-muted)',
				halo: false
			})}
			{@render txt(fl.x + 16, 444, fl.help, 10, { muted: true, halo: false })}
		{/each}
	</g>

	<!-- memory -->
	<g opacity={dimFor('mem')}>
		{@render txt(MEM_X, 136, 'Memory', 13, { weight: 700, muted: true })}
		{@render txt(944, 136, 'address · value', 10, { anchor: 'end', muted: true })}
		{#each Array.from({ length: MEM_SIZE }, (_, i) => i) as a (a)}
			{@const c = cellPos(a)}
			{@const kd = layout.kindOf[a]}
			{@const on = touched.mem.has(a) || (tourPart === 'mem' && kd !== '')}
			{@const changed = shown.mem[a] !== (rec?.initial.mem[a] ?? 0)}
			<rect
				x={c.x}
				y={c.y}
				width={CELL}
				height={CELL}
				rx="5"
				fill={kd === 'code'
					? 'var(--cpu-code)'
					: kd === 'data'
						? 'var(--cpu-data)'
						: 'var(--surface)'}
				stroke={on ? (tourPart === 'mem' ? 'var(--explainer-accent)' : pcol) : 'var(--border)'}
				stroke-width={on ? 2.5 : 1}
			/>
			{@render txt(c.x + CELL / 2, c.y - 3, String(a), 8, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			{@render txt(c.x + CELL / 2, c.y + (a in layout.names ? 16 : 21), String(shown.mem[a]), 12, {
				anchor: 'middle',
				weight: changed ? 700 : 500,
				mono: true,
				muted: kd === '' && shown.mem[a] === 0,
				halo: false
			})}
			{#if a in layout.names}
				{@render txt(c.x + CELL / 2, c.y + 28, layout.names[a] ?? '', 8, {
					anchor: 'middle',
					muted: true,
					halo: false
				})}
			{/if}
		{/each}
		<rect
			x={MEM_X}
			y="404"
			width="12"
			height="12"
			rx="3"
			fill="var(--cpu-code)"
			stroke="var(--border)"
		/>
		{@render txt(MEM_X + 18, 414, 'program bytes', 11, { muted: true })}
		<rect
			x={MEM_X + 120}
			y="404"
			width="12"
			height="12"
			rx="3"
			fill="var(--cpu-data)"
			stroke="var(--border)"
		/>
		{@render txt(MEM_X + 138, 414, 'data', 11, { muted: true })}
	</g>

	<!-- the program: a listing, or the editor -->
	{#if edit}
		{@render txt(ED.x, 92, 'Program (edit me)', 12, { weight: 600, muted: true })}
		<foreignObject x={ED.x} y={ED.y} width={ED.w} height={ED.h}>
			<textarea
				class="cpu-editor"
				aria-label="Assembly program"
				spellcheck="false"
				autocomplete="off"
				wrap="off"
				value={source}
				oninput={(e) => setParam('source', e.currentTarget.value)}
				onkeydown={(e) => e.stopPropagation()}
				onscroll={(e) => (edScroll = e.currentTarget.scrollTop)}></textarea>
		</foreignObject>
		{#if rec && currentAt >= 0}
			{@const y = edMarkY(currentAt)}
			{#if y !== null}
				<path d="M18 {y - 6} L28 {y} L18 {y + 6} Z" fill={pcol} />
			{/if}
		{/if}
		{#if !asm.ok}
			{#each asm.errors.slice(0, 3) as err, i (i)}
				{@render txt(16, 452 + i * 17, `Line ${err.line}: ${err.message}`, 12, {
					color: 'var(--cpu-error)',
					weight: 600
				})}
			{/each}
			{#if asm.errors.length > 3}
				{@render txt(16, 503, `and ${asm.errors.length - 3} more`, 11, { muted: true })}
			{/if}
		{:else}
			{@render txt(16, 452, `Assembled: ${bytesUsed} of ${MEM_SIZE} bytes of memory`, 12, {
				color: 'var(--cpu-ok)',
				weight: 600
			})}
		{/if}
	{:else}
		{@render txt(16, 112, 'Program', 12, { weight: 600, muted: true })}
		{@render txt(296, 112, 'address', 10, { anchor: 'end', muted: true })}
		{#each listing as l, i (l.line)}
			{@const y = LIST_Y + i * LINE_H}
			{@const cur = l.addr !== undefined && l.addr === currentAt}
			{#if cur}
				<rect x="12" y={y - 13} width="288" height={LINE_H - 1} rx="5" fill={pcol} opacity="0.16" />
				<rect x="12" y={y - 13} width="4" height={LINE_H - 1} rx="2" fill={pcol} />
			{/if}
			{@render txt(24, y, l.text, 12, { mono: true, weight: cur ? 700 : 500, halo: false })}
			{#if l.addr !== undefined}
				{@render txt(296, y, String(l.addr), 11, {
					anchor: 'end',
					muted: true,
					mono: true,
					halo: false
				})}
			{/if}
			{#if l.addr !== undefined && l.addr === pcAt && !finished && !tour}
				{@render txt(266, y, 'PC →', 10, {
					anchor: 'end',
					weight: 700,
					color: 'var(--cpu-fetch)',
					halo: false
				})}
			{/if}
		{/each}
	{/if}

	<!-- tokens travelling along the buses -->
	{#each live as tk (tk.id)}
		{@const w = Math.max(24, tk.text.length * 8 + 12)}
		<g transform="translate({tk.pos.x} {tk.pos.y})" opacity={tk.o}>
			<rect
				x={-w / 2}
				y="-10"
				width={w}
				height="20"
				rx="10"
				fill={tk.color}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			{@render txt(0, 4.5, tk.text, 12, {
				anchor: 'middle',
				weight: 700,
				color: '#fff',
				mono: true,
				halo: false
			})}
		</g>
	{/each}

	<!-- bottom: the timeline, or a note on the step's loop -->
	{#if showTimeline && rec}
		<line
			x1={TL0}
			x2={TL1}
			y1={TLY}
			y2={TLY}
			stroke="var(--stage-grid)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={TL0}
			x2={tlx}
			y1={TLY}
			y2={TLY}
			stroke="var(--explainer-accent)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.6"
		/>
		{@render txt(TL0 - 14, TLY + 4, 'start', 11, { anchor: 'end', muted: true })}
		{@render txt(TL1 + 14, TLY + 4, 'end', 11, { muted: true })}
		{@render txt(
			(TL0 + TL1) / 2,
			TLY + 30,
			finished
				? status
				: `tick ${tickNow} of ${total} · ${instructionsDone} instruction${instructionsDone === 1 ? '' : 's'} done${playing && !reduced ? '' : ' · paused: Step, drag or use ← →'}`,
			12,
			{
				anchor: 'middle',
				muted: !finished,
				weight: finished ? 600 : 500,
				color: finished ? (rec.stop === 'halt' ? 'var(--cpu-ok)' : 'var(--cpu-error)') : undefined
			}
		)}
		<Handle
			x={tlx}
			y={TLY}
			r={8}
			label="Program position"
			value={tickNow}
			min={0}
			max={total}
			valuetext="tick {tickNow} of {total}"
			{onmove}
			{onkey}
		/>
	{:else if focus && instr}
		{@render txt(480, 540, `The ${focus} of instruction 3, ${disassemble(instr)}, on a loop`, 12, {
			anchor: 'middle',
			muted: true
		})}
	{:else if !rec}
		{@render txt(480, 540, 'Fix the program to run it', 12, { anchor: 'middle', muted: true })}
	{/if}
</g>

<style>
	.cpu-editor {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 6px 8px;
		resize: none;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 18px;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		tab-size: 4;
		user-select: text;
		-webkit-user-select: text;
		white-space: pre;
		overflow: auto;
	}
	.cpu-editor:focus {
		outline: 2px solid var(--explainer-accent, var(--accent));
		outline-offset: 1px;
	}
</style>
