<script lang="ts">
	/**
	 * A logic circuit on a canvas: switches (inputs), gates, lamps (outputs),
	 * wires coloured by their value, and a live truth table on the right.
	 *
	 * Steps (`step.hints.phase`):
	 *   gates — one gate of the kind chosen in `params.gateKind`
	 *   half  — the half adder (Sum = A XOR B, Carry = A AND B)
	 *   full  — the full adder, its two half adders boxed
	 *   build — the reader's own circuit (`hints.edit`), kept in
	 *           `params['circuit:build']` as `serializeCircuit` text
	 *
	 * Switch states are a string of 0/1 in input order in `params['sw:' + step.id]`.
	 * Until the reader touches a switch, the guided steps play through the rows of
	 * the truth table on their own (one row every ROW_S seconds, a pure function of t).
	 *
	 * Propagation: when the inputs change, each node takes its new value
	 * `depth × GATE_S` seconds later (depth = gates passed, from `evaluate`), and a
	 * wire's new colour runs from its source to its end in WIRE_S. The time of the
	 * last change is kept in plain locals updated inside a `$derived` (the restart
	 * pattern of pagerank's IterateScene). Reduced motion, or a paused stage, shows
	 * the final propagated state.
	 *
	 * Circuit coordinates (as in logic.ts) are mapped onto the left part of the stage
	 * by X()/Y(); the truth table sits on the right.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, startDrag, toSvg, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BLANK,
		FULL_ADDER,
		HALF_ADDER,
		evaluate,
		inputCount,
		inputsOf,
		makesLoop,
		outputsOf,
		parseCircuit,
		serializeCircuit,
		singleGate,
		truthTable,
		type Circuit,
		type GateKind,
		type LogicNode,
		type Wire
	} from '../logic';

	let { step, t, params, setParam, reduced, playing }: StageProps = $props();

	// ---- timing ---------------------------------------------------------------------
	const GATE_S = 0.3; // per gate level
	const WIRE_S = 0.22; // time for a new value to run along a wire
	const ROW_S = 3; // guided steps: one truth-table row every ROW_S seconds

	// ---- geometry -------------------------------------------------------------------
	const X = (x: number) => 40 + (x - 60) * 0.72;
	const Y = (y: number) => y + 10;
	const IX = (sx: number) => (sx - 40) / 0.72 + 60;
	const IY = (sy: number) => sy - 10;
	const CANVAS = { x0: 16, x1: 640, y0: 16, y1: 544 };
	const PANEL = { x0: 656, x1: 944 };

	// ---- which circuit --------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'gates'));
	const edit = $derived(step.hints?.edit === true);
	const challenge = $derived(edit && params.challenge === 'half');
	const gateKind = $derived(String(params.gateKind ?? 'AND') as GateKind);

	/** Blank canvas for the half-adder challenge: inputs A, B; outputs Sum, Carry. */
	const HALF_BLANK: Circuit = {
		nodes: [
			{ id: 'a', kind: 'in', x: 100, y: 200, label: 'A' },
			{ id: 'b', kind: 'in', x: 100, y: 380, label: 'B' },
			{ id: 's', kind: 'out', x: 800, y: 200, label: 'Sum' },
			{ id: 'c', kind: 'out', x: 800, y: 380, label: 'Carry' }
		],
		wires: []
	};
	const blank = $derived(challenge ? HALF_BLANK : BLANK);
	/** A stored circuit belongs to the challenge whose outputs it has. */
	const fits = (c: Circuit, half: boolean) => {
		const outs = outputsOf(c).map((n) => n.label ?? n.id);
		return half ? outs.join() === 'Sum,Carry' : outs.join() === 'Out';
	};
	const builtCircuit = $derived.by(() => {
		const c = parseCircuit(params['circuit:build']);
		return c && fits(c, challenge) ? c : blank;
	});

	const circuit: Circuit = $derived(
		edit
			? builtCircuit
			: phase === 'half'
				? HALF_ADDER
				: phase === 'full'
					? FULL_ADDER
					: singleGate(gateKind)
	);
	const circuitKey = $derived(serializeCircuit(circuit));

	// Live position while a gate is being dragged.
	let dragPos = $state<{ id: string; x: number; y: number } | null>(null);
	const nodes = $derived(
		circuit.nodes.map((n) =>
			dragPos && dragPos.id === n.id ? { ...n, x: dragPos.x, y: dragPos.y } : n
		)
	);
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	const ins = $derived(inputsOf(circuit));

	// ---- inputs -----------------------------------------------------------------------
	const swKey = $derived('sw:' + step.id);
	const stored = $derived(params[swKey]);
	const auto = $derived(!edit && typeof stored !== 'string');
	const rows = $derived(2 ** ins.length);
	/** Current input bits as a string, one char per input. */
	const bits = $derived.by(() => {
		if (auto) {
			const k = reduced ? rows - 1 : Math.floor(Math.max(0, t) / ROW_S) % rows;
			return k.toString(2).padStart(ins.length, '0');
		}
		const s = typeof stored === 'string' ? stored : '';
		return ins.map((_, i) => (s[i] === '1' ? '1' : '0')).join('');
	});
	const assign = (b: string) =>
		Object.fromEntries(ins.map((n, i) => [n.id, b[i] === '1'])) as Record<string, boolean>;

	function flip(i: number) {
		const next = bits
			.split('')
			.map((c, j) => (j === i ? (c === '1' ? '0' : '1') : c))
			.join('');
		setParam(swKey, next);
	}

	// ---- propagation clock (restart pattern, see header) ------------------------------
	let lastBits = '';
	let lastCircuit = '';
	let prevBits = '';
	let t0 = -1e9;
	let lastT = 0;
	const clock = $derived.by(() => {
		const b = bits;
		if (circuitKey !== lastCircuit) {
			lastCircuit = circuitKey;
			lastBits = prevBits = b;
			t0 = -1e9;
		} else if (b !== lastBits) {
			prevBits = lastBits;
			lastBits = b;
			t0 = t;
		}
		if (t < lastT) t0 = Math.min(t0, t);
		lastT = t;
		const elapsed = reduced || !playing ? Infinity : t - t0;
		return { elapsed, prev: prevBits };
	});

	const safeEval = (c: Circuit, a: Record<string, boolean>) => {
		try {
			return evaluate(c, a);
		} catch {
			return { value: new Map<string, boolean>(), depth: new Map<string, number>() };
		}
	};
	const now = $derived(safeEval(circuit, assign(bits)));
	const before = $derived(safeEval(circuit, assign(clock.prev)));

	/** When node n takes its new value, in seconds after the change. */
	const changeAt = (n: LogicNode) => {
		const d = now.depth.get(n.id) ?? 0;
		return n.kind === 'in' ? 0 : n.kind === 'out' ? d * GATE_S + WIRE_S : d * GATE_S;
	};
	const shown = (n: LogicNode) =>
		clock.elapsed >= changeAt(n) ? !!now.value.get(n.id) : !!before.value.get(n.id);

	// ---- ports -------------------------------------------------------------------------
	const outPort = (n: LogicNode): Point =>
		n.kind === 'in' ? { x: X(n.x) + 26, y: Y(n.y) } : { x: X(n.x) + 40, y: Y(n.y) };
	const inPort = (n: LogicNode, slot: number): Point =>
		n.kind === 'out'
			? { x: X(n.x) - 26, y: Y(n.y) }
			: n.kind === 'NOT'
				? { x: X(n.x) - 40, y: Y(n.y) }
				: { x: X(n.x) - 40, y: Y(n.y) + (slot ? 11 : -11) };
	/** Where an input pin meets the gate's body (x offset from the centre). */
	const bodyIn: Record<string, number> = {
		AND: -26,
		NAND: -30,
		OR: -23,
		XOR: -30,
		NOT: -24,
		out: -13
	};
	const bodyOut: Record<string, number> = { AND: 26, NAND: 32, OR: 28, XOR: 28, NOT: 24 };

	// ---- wires -------------------------------------------------------------------------
	function route(a: Point, b: Point, slot: number, endX: number) {
		if (b.x < a.x + 20) {
			return {
				d: `M${a.x} ${a.y} C${a.x + 70} ${a.y} ${b.x - 70} ${b.y} ${b.x} ${b.y} H${endX}`,
				lane: NaN
			};
		}
		let lane = b.x - 16 - 14 * slot;
		if (lane < a.x + 8) lane = (a.x + b.x) / 2;
		const dy = b.y - a.y;
		if (Math.abs(dy) < 1) return { d: `M${a.x} ${a.y} H${endX}`, lane };
		const s = Math.sign(dy);
		const r = Math.min(7, Math.abs(dy) / 2);
		return {
			d:
				`M${a.x} ${a.y} H${lane - r} Q${lane} ${a.y} ${lane} ${a.y + s * r} ` +
				`V${b.y - s * r} Q${lane} ${b.y} ${lane + r} ${b.y} H${endX}`,
			lane
		};
	}

	const wires = $derived.by(() =>
		circuit.wires.flatMap((w) => {
			const src = byId.get(w.from);
			const dst = byId.get(w.to);
			if (!src || !dst || w.slot >= inputCount(dst.kind)) return [];
			const a = outPort(src);
			const b = inPort(dst, w.slot);
			const endX = X(dst.x) + (bodyIn[dst.kind] ?? -26);
			const { d, lane } = route(a, b, w.slot, endX);
			const oldV = !!before.value.get(src.id);
			const newV = !!now.value.get(src.id);
			const u = oldV === newV ? 1 : clamp((clock.elapsed - changeAt(src)) / WIRE_S, 0, 1);
			return [{ key: `${w.from}>${w.to}.${w.slot}`, w, d, lane, a, b, oldV, newV, u, ty: b.y }];
		})
	);
	/** The value a wire shows along most of its length (for junction dots). */
	const wireOn = (w: (typeof wires)[number]) => (w.u >= 0.5 ? w.newV : w.oldV);

	/** Dots where a wire branches (wires from one source sharing a lane). */
	const junctions = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch map
		const groups = new Map<string, { sy: number; lane: number; ys: number[]; on: boolean }>();
		for (const w of wires) {
			if (Number.isNaN(w.lane)) continue;
			const k = `${w.w.from}@${w.lane.toFixed(1)}`;
			const g = groups.get(k) ?? { sy: w.a.y, lane: w.lane, ys: [], on: wireOn(w) };
			g.ys.push(w.ty);
			groups.set(k, g);
		}
		const dots: { key: string; x: number; y: number; on: boolean }[] = [];
		// T-branches: a wire turning off at its lane while another wire from the same
		// source carries on further along the same horizontal run.
		for (const w of wires) {
			if (Number.isNaN(w.lane) || Math.abs(w.ty - w.a.y) < 1) continue;
			const further = wires.some(
				(v) =>
					v !== w &&
					v.w.from === w.w.from &&
					!Number.isNaN(v.lane) &&
					(Math.abs(v.ty - v.a.y) < 1 ? v.b.x : v.lane) > w.lane + 0.5
			);
			if (further) dots.push({ key: `t:${w.key}`, x: w.lane, y: w.a.y, on: wireOn(w) });
		}
		for (const [k, g] of groups) {
			if (g.ys.length < 2) continue;
			const all = [g.sy, ...g.ys];
			const lo = Math.min(...all);
			const hi = Math.max(...all);
			for (const y of new Set(all))
				if (y > lo + 0.5 && y < hi - 0.5) dots.push({ key: `${k}:${y}`, x: g.lane, y, on: g.on });
		}
		return dots;
	});

	// ---- truth table ---------------------------------------------------------------------
	const table = $derived.by(() => {
		try {
			return truthTable(circuit);
		} catch {
			return null;
		}
	});
	const rowIndex = $derived(parseInt(bits || '0', 2) || 0);
	const rowTween = Tween.of(() => rowIndex, { duration: 260, easing: cubicInOut });
	/** Target for the half-adder challenge: Sum, Carry for rows 00, 01, 10, 11. */
	const TARGET = [
		[false, false],
		[true, false],
		[true, false],
		[false, true]
	];
	const rowOk = (i: number) => !!table && table.rows[i].outputs.every((v, j) => v === TARGET[i][j]);
	const solved = $derived(
		challenge && !!table && table.rows.length === 4 && table.rows.every((_, i) => rowOk(i))
	);

	const panel = $derived.by(() => {
		if (!table) return null;
		const cols = [
			...table.inputs.map((l) => ({ l, kind: 'in' })),
			...table.outputs.map((l) => ({ l, kind: 'out' })),
			...(challenge ? ['Sum', 'Carry'].map((l) => ({ l, kind: 'want' })) : [])
		];
		const w = PANEL.x1 - PANEL.x0;
		const tickW = challenge ? 30 : 0;
		const colW = Math.min(58, (w - 24 - tickW) / cols.length);
		const twoLine = cols.some((c) => c.l.includes(' '));
		const rowH = table.rows.length > 4 ? 26 : 30;
		const titleH = challenge ? 54 : 42;
		const headH = (twoLine ? 38 : 26) + (challenge ? 14 : 0);
		const h = titleH + headH + table.rows.length * rowH + 14;
		const y0 = Math.max(24, 286 - h / 2);
		const tableW = cols.length * colW + tickW;
		const left = PANEL.x0 + (w - tableW) / 2;
		const colX = cols.map((_, i) => left + colW * (i + 0.5));
		const split = table.inputs.length;
		return {
			cols,
			colW,
			colX,
			rowH,
			y0,
			h,
			headY: y0 + titleH,
			rowsY: y0 + titleH + headH,
			divIn: left + colW * split,
			divOut: challenge ? left + colW * (split + table.outputs.length) : NaN,
			tickX: left + colW * cols.length + tickW / 2,
			twoLine
		};
	});

	// ---- labels & readouts ----------------------------------------------------------------
	const rule: Record<GateKind, string> = {
		AND: 'on only if both inputs are on',
		OR: 'on if either input (or both) is on',
		NOT: 'flips its input',
		XOR: 'on if exactly one input is on',
		NAND: 'off only if both inputs are on'
	};
	const val = (id: string) => {
		const n = byId.get(id);
		return n && shown(n) ? 1 : 0;
	};
	const settled = $derived(nodes.every((n) => shown(n) === !!now.value.get(n.id)));

	// ---- editing (build step) -------------------------------------------------------------
	type PortRef = { node: string; side: 'out' | 'in'; slot: number };
	const tool = $derived(String(params.tool ?? 'AND'));
	let msg = $state<{ text: string; at: number } | null>(null);
	const say = (text: string) => (msg = { text, at: t });
	const msgOpacity = $derived(
		msg ? (reduced || !playing ? 1 : clamp(1 - (t - msg.at - 2.6) / 0.4, 0, 1)) : 0
	);

	let wiring = $state<{ from: PortRef; x: number; y: number } | null>(null);
	let pending = $state<PortRef | null>(null);

	const commit = (c: Circuit) => setParam('circuit:build', serializeCircuit(c));

	// "Start again": react to a change of the press count.
	let seenReset = untrack(() => params.resetCanvas);
	$effect(() => {
		const n = params.resetCanvas;
		untrack(() => {
			if (n === seenReset) return;
			seenReset = n;
			commit(blank);
			setParam('sw:build', '');
			msg = null;
			pending = null;
		});
	});

	const snap = (p: Point) => ({
		x: Math.round(IX(clamp(p.x, 130, 560)) / 25) * 25,
		y: Math.round(IY(clamp(p.y, 60, 500)) / 20) * 20
	});

	function addGate(p: Point) {
		if (tool === 'erase') return;
		const at = snap(p);
		const near = circuit.nodes.some(
			(n) => Math.abs(X(n.x) - X(at.x)) < 76 && Math.abs(Y(n.y) - Y(at.y)) < 56
		);
		if (near) return say('Too close to another part: click some empty space');
		let k = 1;
		while (circuit.nodes.some((n) => n.id === `g${k}`)) k++;
		commit({
			nodes: [...circuit.nodes, { id: `g${k}`, kind: tool as GateKind, ...at }],
			wires: circuit.wires
		});
	}

	function removeNode(id: string) {
		commit({
			nodes: circuit.nodes.filter((n) => n.id !== id),
			wires: circuit.wires.filter((w) => w.from !== id && w.to !== id)
		});
	}
	function removeWire(w: Wire) {
		commit({ nodes: circuit.nodes, wires: circuit.wires.filter((x) => x !== w) });
	}

	function connect(p: PortRef, q: PortRef) {
		const [o, i] = p.side === 'out' ? [p, q] : [q, p];
		if (o.side !== 'out' || i.side !== 'in') return;
		if (o.node === i.node) return say("A gate can't feed its own input");
		const w: Wire = { from: o.node, to: i.node, slot: i.slot };
		if (makesLoop(circuit, w))
			return say("That would make a loop: here, outputs can't feed back into earlier gates");
		const replaced = circuit.wires.some((x) => x.to === w.to && x.slot === w.slot);
		commit({
			nodes: circuit.nodes,
			wires: [...circuit.wires.filter((x) => !(x.to === w.to && x.slot === w.slot)), w]
		});
		if (replaced) say('The new wire replaced the old one into that input');
	}

	const ports = $derived(
		edit
			? nodes.flatMap((n) => [
					...(n.kind === 'out'
						? []
						: [{ ref: { node: n.id, side: 'out' as const, slot: 0 }, p: outPort(n), n }]),
					...Array.from({ length: inputCount(n.kind) }, (_, s) => ({
						ref: { node: n.id, side: 'in' as const, slot: s },
						p: inPort(n, s),
						n
					}))
				])
			: []
	);
	const portKey = (r: PortRef) => `${r.node}:${r.side}:${r.slot}`;
	const nodeName = (n: LogicNode) =>
		n.kind === 'in' ? `switch ${n.label}` : n.kind === 'out' ? `lamp ${n.label}` : `${n.kind} gate`;
	const portLabel = (r: PortRef, n: LogicNode) =>
		r.side === 'out'
			? `Output of ${nodeName(n)}`
			: inputCount(n.kind) === 2
				? `Input ${r.slot + 1} of ${nodeName(n)}`
				: `Input of ${nodeName(n)}`;

	function onPortDown(e: PointerEvent, r: PortRef, p: Point) {
		if (tool === 'erase') return;
		pending = null;
		wiring = { from: r, x: p.x, y: p.y };
		startDrag(
			e,
			(q) => {
				if (wiring) wiring = { ...wiring, x: q.x, y: q.y };
			},
			() => {
				const w = wiring;
				wiring = null;
				if (!w) return;
				let best: (typeof ports)[number] | null = null;
				let bd = 22;
				for (const c of ports) {
					if (c.ref.side === r.side) continue;
					const d = Math.hypot(c.p.x - w.x, c.p.y - w.y);
					if (d < bd) [best, bd] = [c, d];
				}
				if (best) connect(r, best.ref);
			}
		);
	}

	function onPortKey(e: KeyboardEvent, r: PortRef) {
		if (e.key === 'Escape' && pending) {
			e.preventDefault();
			pending = null;
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!pending || pending.side === r.side) pending = r;
			else {
				connect(pending, r);
				pending = null;
			}
		}
	}

	function onGateDown(e: PointerEvent, n: LogicNode) {
		if (e.button !== 0) return;
		if (tool === 'erase') {
			e.preventDefault();
			removeNode(n.id);
			return;
		}
		let off: Point | null = null;
		startDrag(
			e,
			(p) => {
				if (!off) off = { x: p.x - X(n.x), y: p.y - Y(n.y) };
				dragPos = { id: n.id, ...snap({ x: p.x - off.x, y: p.y - off.y }) };
			},
			() => {
				const d = dragPos;
				dragPos = null;
				if (!d || (d.x === n.x && d.y === n.y)) return;
				commit({
					nodes: circuit.nodes.map((m) => (m.id === n.id ? { ...m, x: d.x, y: d.y } : m)),
					wires: circuit.wires
				});
			}
		);
	}

	function onGateKey(e: KeyboardEvent, n: LogicNode) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			removeNode(n.id);
			return;
		}
		// A gate has no action of its own; keep Enter/Space from reaching the explainer.
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			return;
		}
		const dir: Record<string, [number, number]> = {
			ArrowLeft: [-25, 0],
			ArrowRight: [25, 0],
			ArrowUp: [0, -20],
			ArrowDown: [0, 20]
		};
		const m = dir[e.key];
		if (!m) return;
		e.preventDefault();
		const s = snap({ x: X(n.x + m[0]), y: Y(n.y + m[1]) });
		commit({
			nodes: circuit.nodes.map((q) => (q.id === n.id ? { ...q, ...s } : q)),
			wires: circuit.wires
		});
	}

	function onSwitchKey(e: KeyboardEvent, i: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			flip(i);
		}
	}

	const hint = $derived(
		edit
			? tool === 'erase'
				? 'Eraser: click a gate or a wire to remove it'
				: `Click empty space to add ${tool === 'NOT' ? 'a' : 'an'} ${tool} gate · drag from an output dot to an input dot to wire`
			: auto
				? 'Playing through every row of the table · click a switch to take over'
				: 'Click a switch (or Tab to it and press Enter) to flip it'
	);
	const wireCol = (on: boolean) => (on ? 'var(--lg-on)' : 'var(--lg-off)');
	const HA_BOXES = [
		{ k: 'ha1', x: 164, y: 140, w: 98, h: 244 },
		{ k: 'ha2', x: 323, y: 196, w: 98, h: 238 }
	];
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
		opacity?: number;
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
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		stroke={opts.halo === false ? 'none' : undefined}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet gateShape(kind: string)}
	{#if kind === 'AND'}
		<path d="M-26 -22 H4 A22 22 0 0 1 4 22 H-26 Z" />
	{:else if kind === 'NAND'}
		<path d="M-30 -22 H0 A22 22 0 0 1 0 22 H-30 Z" />
		<circle cx="27" cy="0" r="5" />
	{:else if kind === 'OR'}
		<path d="M-28 -22 Q-14 0 -28 22 Q8 22 28 0 Q8 -22 -28 -22 Z" />
	{:else if kind === 'XOR'}
		<path d="M-28 -22 Q-14 0 -28 22 Q8 22 28 0 Q8 -22 -28 -22 Z" />
		<path d="M-35 -22 Q-21 0 -35 22" fill="none" />
	{:else if kind === 'NOT'}
		<path d="M-24 -20 L14 0 L-24 20 Z" />
		<circle cx="19" cy="0" r="5" />
	{/if}
{/snippet}

<g>
	<defs>
		<pattern id="canvas-grid" width="18" height="20" patternUnits="userSpaceOnUse">
			<circle cx="9" cy="10" r="1.1" fill="var(--stage-line)" opacity="0.6" />
		</pattern>
	</defs>

	<!-- canvas background: a click here adds a gate on the build step -->
	{#if edit}
		<rect
			x={CANVAS.x0}
			y={CANVAS.y0}
			width={CANVAS.x1 - CANVAS.x0}
			height={CANVAS.y1 - CANVAS.y0}
			rx="12"
			fill="url(#canvas-grid)"
			stroke="var(--stage-grid)"
			style:cursor={tool === 'erase' ? 'default' : 'copy'}
			role="presentation"
			onpointerdown={(e) => {
				if (e.button === 0) addGate(toSvg(e, e.currentTarget));
			}}
		/>
	{/if}

	<!-- full adder: the two half adders -->
	{#if phase === 'full' && !edit}
		{#each HA_BOXES as b (b.k)}
			<rect
				x={b.x}
				y={b.y}
				width={b.w}
				height={b.h}
				rx="12"
				fill="var(--lg-gate)"
				fill-opacity="0.35"
				stroke="var(--lg-gate-edge)"
				stroke-opacity="0.45"
				stroke-dasharray="5 4"
			/>
		{/each}
		{@render txt(213, 130, 'half adder 1', 12, { anchor: 'middle', muted: true, weight: 600 })}
		{@render txt(372, 186, 'half adder 2', 12, { anchor: 'middle', muted: true, weight: 600 })}
		{@render txt(X(690), Y(360) + 44, 'OR: either carry', 12, {
			anchor: 'middle',
			muted: true
		})}
	{/if}

	<!-- wires: the old colour underneath, the new value running along on top -->
	<g fill="none" stroke-linecap="round" stroke-linejoin="round" style:pointer-events="none">
		{#each wires as w (w.key)}
			<path
				d={w.d}
				stroke={wireCol(w.u >= 1 ? w.newV : w.oldV)}
				stroke-width={(w.u >= 1 ? w.newV : w.oldV) ? 3 : 2.5}
			/>
			{#if w.u > 0 && w.u < 1}
				<path
					d={w.d}
					pathLength="1"
					stroke-dasharray="{w.u} 2"
					stroke={wireCol(w.newV)}
					stroke-width="3"
				/>
			{/if}
		{/each}
		{#each junctions as j (j.key)}
			<circle cx={j.x} cy={j.y} r="3.6" fill={wireCol(j.on)} stroke="none" />
		{/each}
	</g>
	{#if edit && tool === 'erase'}
		{#each wires as w (w.key)}
			<path
				d={w.d}
				fill="none"
				stroke="transparent"
				stroke-width="14"
				style:cursor="pointer"
				role="presentation"
				onpointerdown={(e) => {
					e.preventDefault();
					removeWire(w.w);
				}}
			/>
		{/each}
	{/if}

	<!-- nodes -->
	{#each nodes as n (n.id)}
		{@const cx = X(n.x)}
		{@const cy = Y(n.y)}
		{@const on = shown(n)}
		{#if n.kind === 'in'}
			{@const i = ins.findIndex((m) => m.id === n.id)}
			<line x1={cx + 16} y1={cy} x2={cx + 26} y2={cy} stroke={wireCol(on)} stroke-width="3" />
			<g
				class="focusable"
				role="switch"
				tabindex="0"
				aria-checked={bits[i] === '1'}
				aria-label="Switch {n.label}"
				style:cursor="pointer"
				onclick={() => flip(i)}
				onkeydown={(e) => onSwitchKey(e, i)}
			>
				<rect x={cx - 30} y={cy - 18} width="52" height="36" rx="18" fill="transparent" />
				<rect
					class="ring"
					x={cx - 25}
					y={cy - 15}
					width="46"
					height="30"
					rx="15"
					fill="none"
					stroke="var(--focus)"
					stroke-width="2"
				/>
				<rect
					x={cx - 21}
					y={cy - 11}
					width="38"
					height="22"
					rx="11"
					fill={on ? 'var(--lg-on)' : 'var(--lg-off)'}
				/>
				<circle cx={on ? cx + 6 : cx - 10} {cy} r="8" fill="var(--stage-bg)" />
				{@render txt(on ? cx - 9 : cx + 5, cy + 4, on ? '1' : '0', 11, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--stage-bg)',
					halo: false
				})}
			</g>
			{@render txt(cx - 2, cy - 22, n.label ?? '', 14, { anchor: 'middle', weight: 700 })}
		{:else if n.kind === 'out'}
			{#if !circuit.wires.some((w) => w.to === n.id)}
				<line x1={cx - 26} y1={cy} x2={cx - 13} y2={cy} stroke="var(--lg-off)" stroke-width="2.5" />
			{/if}
			{#if on}
				<circle {cx} {cy} r="24" fill="var(--lg-lamp)" opacity="0.3" />
			{/if}
			<circle
				{cx}
				{cy}
				r="13"
				fill={on ? 'var(--lg-lamp)' : 'var(--surface)'}
				stroke={on ? 'var(--lg-on)' : 'var(--lg-off)'}
				stroke-width="2"
				role="img"
				aria-label="Lamp {n.label}: {on ? 'on' : 'off'}"
			/>
			{@render txt(cx, cy + 36, `${n.label} = ${on ? 1 : 0}`, 13, {
				anchor: 'middle',
				weight: 600
			})}
		{:else}
			{@const pinX = bodyOut[n.kind] ?? 26}
			<line x1={cx + pinX} y1={cy} x2={cx + 40} y2={cy} stroke={wireCol(on)} stroke-width="3" />
			{#each Array.from({ length: inputCount(n.kind) }, (_, s) => s) as s (s)}
				{#if !circuit.wires.some((w) => w.to === n.id && w.slot === s)}
					{@const p = inPort(n, s)}
					<line
						x1={p.x}
						y1={p.y}
						x2={cx + (bodyIn[n.kind] ?? -26)}
						y2={p.y}
						stroke="var(--lg-off)"
						stroke-width="2.5"
					/>
				{/if}
			{/each}
			{#if edit}
				<g
					transform="translate({cx} {cy})"
					fill="var(--lg-gate)"
					stroke="var(--lg-gate-edge)"
					stroke-width="2"
					stroke-linejoin="round"
					class="focusable"
					class:dragging={dragPos?.id === n.id}
					role="button"
					tabindex="0"
					aria-label="{n.kind} gate: drag or use the arrow keys to move it, Delete to remove it"
					style:cursor={tool === 'erase' ? 'not-allowed' : 'grab'}
					style:touch-action="none"
					onpointerdown={(e) => onGateDown(e, n)}
					onkeydown={(e) => onGateKey(e, n)}
				>
					<rect
						class="ring"
						x="-44"
						y="-30"
						width="88"
						height="60"
						rx="10"
						fill="none"
						stroke="var(--focus)"
						stroke-width="2"
					/>
					{@render gateShape(n.kind)}
					{@render txt(
						n.kind === 'NOT' ? -9 : n.kind === 'NAND' ? -10 : -3,
						n.kind === 'NOT' ? 3 : 4,
						n.kind,
						n.kind === 'NOT' ? 9 : 11,
						{
							anchor: 'middle',
							weight: 700,
							color: 'var(--lg-gate-edge)',
							halo: false
						}
					)}
				</g>
			{:else}
				<g
					transform="translate({cx} {cy})"
					fill="var(--lg-gate)"
					stroke="var(--lg-gate-edge)"
					stroke-width="2"
					stroke-linejoin="round"
					role="img"
					aria-label="{n.kind} gate, output {on ? 1 : 0}"
				>
					{@render gateShape(n.kind)}
					{@render txt(
						n.kind === 'NOT' ? -9 : n.kind === 'NAND' ? -10 : -3,
						n.kind === 'NOT' ? 3 : 4,
						n.kind,
						n.kind === 'NOT' ? 9 : 11,
						{
							anchor: 'middle',
							weight: 700,
							color: 'var(--lg-gate-edge)',
							halo: false
						}
					)}
				</g>
			{/if}
		{/if}
	{/each}

	<!-- wiring ports (build step) -->
	{#if edit}
		{#each ports as pt (portKey(pt.ref))}
			{@const isPending = !!pending && portKey(pending) === portKey(pt.ref)}
			<g
				class="focusable"
				role="button"
				tabindex="0"
				aria-label={portLabel(pt.ref, pt.n) +
					(pending ? ': press Enter to connect' : ': press Enter to start a wire')}
				aria-pressed={isPending}
				style:cursor={tool === 'erase' ? 'default' : 'crosshair'}
				style:touch-action="none"
				onpointerdown={(e) => onPortDown(e, pt.ref, pt.p)}
				onkeydown={(e) => onPortKey(e, pt.ref)}
			>
				<circle cx={pt.p.x} cy={pt.p.y} r="11" fill="transparent" />
				<circle
					class="ring"
					cx={pt.p.x}
					cy={pt.p.y}
					r="8"
					fill="none"
					stroke="var(--focus)"
					stroke-width="2"
				/>
				<circle
					cx={pt.p.x}
					cy={pt.p.y}
					r="4"
					fill={isPending ? 'var(--focus)' : 'var(--stage-bg)'}
					stroke="var(--lg-gate-edge)"
					stroke-width="1.5"
				/>
			</g>
		{/each}
		{#if wiring}
			{@const from = wiring.from}
			{@const src = ports.find((p) => portKey(p.ref) === portKey(from))}
			{#if src}
				<line
					x1={src.p.x}
					y1={src.p.y}
					x2={wiring.x}
					y2={wiring.y}
					stroke="var(--lg-gate-edge)"
					stroke-width="2"
					stroke-dasharray="5 4"
					style:pointer-events="none"
				/>
			{/if}
		{/if}
	{/if}

	<!-- step labels -->
	{#if !edit && phase === 'gates'}
		{@const g = byId.get('g')}
		{#if g}
			{@render txt(
				X(g.x),
				Y(g.y) + 62,
				gateKind === 'NOT' ? 'Out = NOT A' : `Out = A ${gateKind} B`,
				15,
				{ anchor: 'middle', weight: 700 }
			)}
			{@render txt(X(g.x), Y(g.y) + 82, rule[gateKind], 12, { anchor: 'middle', muted: true })}
		{/if}
	{:else if !edit && phase === 'half'}
		{@render txt(X(420), Y(200) - 38, 'Sum = A XOR B', 14, { anchor: 'middle', weight: 700 })}
		{@render txt(X(420), Y(360) + 48, 'Carry = A AND B', 14, { anchor: 'middle', weight: 700 })}
		{@render txt(X(420), 500, `${val('a')} + ${val('b')} = ${val('c')}${val('s')} in binary`, 15, {
			anchor: 'middle',
			weight: 600,
			opacity: settled ? 1 : 0.55
		})}
		{@render txt(
			X(420),
			520,
			`carry ${val('c')}, sum ${val('s')}: ${val('a') + val('b')} in decimal`,
			12,
			{
				anchor: 'middle',
				muted: true,
				opacity: settled ? 1 : 0.55
			}
		)}
	{:else if !edit && phase === 'full'}
		{@render txt(
			X(420),
			500,
			`${val('a')} + ${val('b')} + ${val('ci')} = ${val('co')}${val('s')} in binary`,
			15,
			{ anchor: 'middle', weight: 600, opacity: settled ? 1 : 0.55 }
		)}
		{@render txt(X(420), 520, `${val('a') + val('b') + val('ci')} in decimal`, 12, {
			anchor: 'middle',
			muted: true,
			opacity: settled ? 1 : 0.55
		})}
	{/if}

	<!-- truth table -->
	{#if table && panel}
		<rect
			x={PANEL.x0}
			y={panel.y0}
			width={PANEL.x1 - PANEL.x0}
			height={panel.h}
			rx="12"
			fill="var(--surface)"
			stroke={solved ? 'var(--lg-ok)' : 'var(--border)'}
			stroke-width={solved ? 2 : 1}
		/>
		{@render txt(PANEL.x0 + 16, panel.y0 + 27, 'Truth table', 15, { weight: 700, halo: false })}
		{#if challenge}
			{@render txt(
				PANEL.x0 + 16,
				panel.y0 + 46,
				solved ? '✓ Right: that is a half adder!' : 'Goal: make your columns match the target',
				12,
				{
					weight: solved ? 700 : 500,
					color: solved ? 'var(--lg-ok)' : undefined,
					muted: !solved,
					halo: false
				}
			)}
		{/if}
		<!-- current row -->
		<rect
			x={PANEL.x0 + 8}
			y={panel.rowsY + rowTween.current * panel.rowH + 1}
			width={PANEL.x1 - PANEL.x0 - 16}
			height={panel.rowH - 2}
			rx="6"
			fill="var(--lg-on)"
			opacity="0.22"
		/>
		<line
			x1={panel.divIn}
			x2={panel.divIn}
			y1={panel.headY - 2}
			y2={panel.y0 + panel.h - 10}
			stroke="var(--stage-line)"
		/>
		{#if !Number.isNaN(panel.divOut)}
			<line
				x1={panel.divOut}
				x2={panel.divOut}
				y1={panel.headY - 2}
				y2={panel.y0 + panel.h - 10}
				stroke="var(--stage-line)"
				stroke-dasharray="3 3"
			/>
		{/if}
		<line
			x1={PANEL.x0 + 12}
			x2={PANEL.x1 - 12}
			y1={panel.rowsY - 2}
			y2={panel.rowsY - 2}
			stroke="var(--stage-line)"
		/>
		{#each panel.cols as c, ci (ci)}
			{@const parts = c.l.includes(' ') ? c.l.split(' ') : [c.l]}
			{#each parts as part, pi (pi)}
				{@render txt(
					panel.colX[ci],
					panel.headY +
						(challenge ? 29 : 15) +
						pi * 14 +
						(panel.twoLine && parts.length === 1 ? 7 : 0),
					part,
					12,
					{
						anchor: 'middle',
						weight: 700,
						halo: false,
						muted: c.kind === 'want',
						color: c.kind === 'out' ? 'var(--lg-gate-edge)' : undefined
					}
				)}
			{/each}
		{/each}
		{#if challenge}
			{@render txt(
				panel.colX[panel.cols.length - 2] + panel.colW / 2,
				panel.headY + 12,
				'target',
				11,
				{ anchor: 'middle', muted: true, halo: false }
			)}
			{@render txt(
				panel.colX[panel.cols.length - 4] + panel.colW / 2,
				panel.headY + 12,
				'yours',
				11,
				{ anchor: 'middle', color: 'var(--lg-gate-edge)', halo: false }
			)}
		{/if}
		{#each table.rows as r, ri (ri)}
			{@const y = panel.rowsY + ri * panel.rowH + panel.rowH / 2 + 5}
			{@const cells = [...r.inputs, ...r.outputs, ...(challenge ? TARGET[ri] : [])]}
			{#each cells as v, ci (ci)}
				{@render txt(panel.colX[ci], y, v ? '1' : '0', 14, {
					anchor: 'middle',
					weight: v ? 700 : 500,
					muted: !v || panel.cols[ci]?.kind === 'want',
					halo: false
				})}
			{/each}
			{#if challenge}
				{@const ok = rowOk(ri)}
				{@render txt(panel.tickX, y, ok ? '✓' : '✗', 14, {
					anchor: 'middle',
					weight: 700,
					color: ok ? 'var(--lg-ok)' : undefined,
					muted: !ok,
					halo: false
				})}
			{/if}
		{/each}
	{/if}

	<!-- messages and hint -->
	{#if msg && msgOpacity > 0}
		{@render txt((CANVAS.x0 + CANVAS.x1) / 2, 528, msg.text, 13, {
			anchor: 'middle',
			weight: 600,
			opacity: msgOpacity
		})}
	{/if}
	{@render txt(24, 576, hint, 12, { muted: true })}
</g>

<style>
	.focusable {
		outline: none;
	}
	.focusable .ring {
		opacity: 0;
	}
	.focusable:focus-visible .ring {
		opacity: 1;
	}
	.dragging {
		cursor: grabbing;
	}
</style>
