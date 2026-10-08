<script lang="ts">
	/**
	 * The pegboard: batteries, bulbs, resistors, switches and meters on the edges
	 * between 7 × 5 pegs, solved by `solve()` in ../circuit.ts, with moving charge,
	 * glowing bulbs, live meters and a readout card for the step.
	 *
	 * Which board (`step.hints.board`): a preset, with the step's controls applied
	 * before solving (`closed` → the first switch; `s1`/`s2` → the left/right
	 * switch; `emf`/`ohms` → every battery/resistor). On `build`
	 * (`hints.edit`), the reader's board lives in `params['board:build']`
	 * (`serializeBoard`), falling back to the preset; `resetBoard` restores it.
	 *
	 * Build clicks (one focusable target per gap): the eraser removes; a switch
	 * flips and a battery turns round whatever the tool (except the eraser), as
	 * the step text says; anything else is replaced by the selected part. Each
	 * target's label says what activating it will do.
	 *
	 * Moving charge: every slot (edge) keeps a phase, the distance its dots have
	 * travelled from its lower-numbered peg towards the other, modulo the dot
	 * spacing. It is the integral of a speed that follows the current, so it is a
	 * small frame-to-frame accumulator (the sanctioned exception in
	 * docs/scene-guide.md): it ignores dt ≤ 0 (pause, step restart), clamps dt,
	 * is reset when the set of occupied slots changes (so a loop stays in step at
	 * its corners), and is fixed under reduced motion (arrowheads instead of
	 * dots). The edge length is a whole number of spacings, so equal currents
	 * line up across pegs. Parts that would carry current with every switch
	 * closed but carry none now show dim, still dots ("stopped"); parts that never
	 * can (voltmeter leads, dangling wires) show none.
	 *
	 * Look changes (bulb glow, switch lever, dot dimming, parts appearing) are
	 * cross-faded with one Tween between snapshots keyed by slot.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	// Maps and Sets here are temporaries built inside one computation, or the
	// deliberately non-reactive phase accumulator: no SvelteMap needed.
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		PRESETS,
		SHORT_CURRENT,
		brightness,
		parseBoard,
		partAt,
		place,
		removeAt,
		serializeBoard,
		solve,
		update,
		valueOf,
		type Board,
		type Part,
		type PartKind
	} from '../circuit';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------------------
	const COLS = 7;
	const ROWS = 5;
	const S = 88; // peg pitch
	const D = S / 3; // dot spacing: a whole number per edge, so dots line up across pegs
	const X0 = 64;
	const Y0 = 124;
	const BOARD = { x: 28, y: 88, w: 600, h: 424 };
	const PANEL = { x: 648, y: 88, w: 296, h: 424 };
	const PL = PANEL.x + 20;
	const PR = PANEL.x + PANEL.w - 20;

	const colOf = (id: number) => id % COLS;
	const rowOf = (id: number) => Math.floor(id / COLS);
	const pegName = (id: number) => `${String.fromCharCode(65 + colOf(id))}${rowOf(id) + 1}`;
	const keyOf = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;

	interface Edge {
		key: string;
		p: number; // lower peg id
		q: number; // higher peg id
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		cx: number;
		cy: number;
		vertical: boolean;
		/** Unit normal used for side labels: right of a vertical edge, above a horizontal one. */
		nx: number;
		ny: number;
		name: string;
	}
	const EDGES: Edge[] = [];
	for (let r = 0; r < ROWS; r++)
		for (let c = 0; c < COLS; c++) {
			const p = r * COLS + c;
			for (const q of [c < COLS - 1 ? p + 1 : -1, r < ROWS - 1 ? p + COLS : -1]) {
				if (q < 0) continue;
				const x1 = X0 + c * S;
				const y1 = Y0 + r * S;
				const x2 = X0 + colOf(q) * S;
				const y2 = Y0 + rowOf(q) * S;
				const vertical = x1 === x2;
				EDGES.push({
					key: keyOf(p, q),
					p,
					q,
					x1,
					y1,
					x2,
					y2,
					cx: (x1 + x2) / 2,
					cy: (y1 + y2) / 2,
					vertical,
					nx: vertical ? 1 : 0,
					ny: vertical ? 0 : -1,
					name: `${pegName(p)} and ${pegName(q)}`
				});
			}
		}
	const EDGE = new Map(EDGES.map((e) => [e.key, e]));
	const PEGS = Array.from({ length: COLS * ROWS }, (_, id) => ({
		id,
		x: X0 + colOf(id) * S,
		y: Y0 + rowOf(id) * S
	}));

	// ---- which board -------------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'loop'));
	const edit = $derived(step.hints?.edit === true);
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);
	const preset = $derived(PRESETS[String(step.hints?.board ?? 'simple')] ?? PRESETS.simple);

	/** Which control each switch (by part index) follows on preset steps. */
	const switchParams = $derived.by(() => {
		const out = new Map<number, string>();
		if (edit) return out;
		const sw = preset.parts
			.map((p, i) => ({ p, i }))
			.filter(({ p }) => p.kind === 'switch')
			.sort((x, y) => colOf(Math.min(x.p.a, x.p.b)) - colOf(Math.min(y.p.a, y.p.b)));
		if (has('closed') && sw.length) out.set(sw[0].i, 'closed');
		if (has('s1') && sw.length) out.set(sw[0].i, 's1');
		if (has('s2') && sw.length > 1) out.set(sw[sw.length - 1].i, 's2');
		return out;
	});

	const board = $derived.by((): Board => {
		if (edit) {
			const b = parseBoard(params['board:build']);
			return b && b.cols === COLS && b.rows === ROWS ? b : preset;
		}
		let b = preset;
		for (const [i, id] of switchParams) b = update(b, i, { closed: params[id] !== false });
		if (has('emf') || has('ohms'))
			b = {
				...b,
				parts: b.parts.map((p) =>
					p.kind === 'battery' && has('emf')
						? { ...p, value: Number(params.emf ?? 6) }
						: p.kind === 'resistor' && has('ohms')
							? { ...p, value: Number(params.ohms ?? 12) }
							: p
				)
			};
		return b;
	});
	const sol = $derived(solve(board));
	/** The same board with every switch closed: which parts can ever carry current. */
	const solClosed = $derived(
		solve({
			...board,
			parts: board.parts.map((p) => (p.kind === 'switch' ? { ...p, closed: true } : p))
		})
	);
	/**
	 * Which parts can ever carry current: with every switch closed, under all the
	 * batteries together or under any one of them alone (the others as plain
	 * wire), so a loop whose batteries push against each other still counts.
	 */
	const canFlow = $derived.by(() => {
		const closed = board.parts.map((p) => (p.kind === 'switch' ? { ...p, closed: true } : p));
		const live = closed.map((_, i) => Math.abs(solClosed.current[i]) > 1e-6);
		const bats = closed.flatMap((p, i) => (p.kind === 'battery' ? [i] : []));
		if (bats.length > 1)
			for (const k of bats) {
				const alone = closed.map((p, i): Part =>
					p.kind === 'battery' && i !== k ? { kind: 'wire', a: p.a, b: p.b } : p
				);
				solve({ ...board, parts: alone }).current.forEach((c, i) => {
					if (Math.abs(c) > 1e-6) live[i] = true;
				});
			}
		return live;
	});
	const electrons = $derived(has('charges') && params.charges === 'electrons');
	const tool = $derived(String(params.part ?? 'bulb') as PartKind | 'erase');

	// ---- the reader's board (build) ------------------------------------------------------
	const save = (b: Board) => setParam('board:build', serializeBoard(b));
	// "Start again": only a press after this scene appeared resets the board.
	let seenReset = untrack(() => Number(params.resetBoard ?? 0));
	$effect(() => {
		const n = Number(params.resetBoard ?? 0);
		if (n === seenReset) return;
		seenReset = n;
		untrack(() => save(PRESETS.starter));
	});

	const KIND_NAME: Record<PartKind, string> = {
		wire: 'wire',
		battery: 'battery',
		bulb: 'bulb',
		resistor: 'resistor',
		switch: 'switch',
		ammeter: 'ammeter',
		voltmeter: 'voltmeter'
	};
	const article = (k: string) => (/^[aeiou]/.test(k) ? 'an' : 'a');

	/** What activating a slot does on build, as a phrase ("place a bulb here"). */
	function buildAction(e: Edge): string | null {
		const i = partAt(board, e.p, e.q);
		const part = i >= 0 ? board.parts[i] : null;
		if (tool === 'erase') return part ? `remove this ${KIND_NAME[part.kind]}` : null;
		if (part?.kind === 'switch') return part.closed ? 'open the switch' : 'close the switch';
		if (part?.kind === 'battery') return 'turn the battery round';
		if (part?.kind === tool) return null;
		const what = `${article(tool)} ${KIND_NAME[tool]}`;
		return part ? `replace it with ${what}` : `place ${what} here`;
	}

	function activate(e: Edge) {
		if (edit) {
			const i = partAt(board, e.p, e.q);
			const part = i >= 0 ? board.parts[i] : null;
			if (tool === 'erase') {
				if (part) save(removeAt(board, e.p, e.q));
				return;
			}
			if (part?.kind === 'switch') return save(update(board, i, { closed: !part.closed }));
			if (part?.kind === 'battery') return save(update(board, i, { a: part.b, b: part.a }));
			if (part?.kind === tool) return;
			// New batteries point their + end up (or left), like the presets.
			const fresh: Part = { kind: tool, a: e.q, b: e.p };
			if (tool === 'switch') fresh.closed = true;
			save(place(board, fresh));
			return;
		}
		const i = board.parts.findIndex((p) => keyOf(p.a, p.b) === e.key);
		const id = switchParams.get(i);
		if (id) setParam(id, params[id] === false);
	}

	function onkey(event: KeyboardEvent, e: Edge) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		activate(e);
	}

	// ---- parts, with their solution -----------------------------------------------------------
	interface Item {
		i: number;
		part: Part;
		e: Edge;
		/** Current along the edge from its lower peg to its higher one (A). */
		ic: number;
		amps: number;
		volts: number;
		/** Can carry current (with every switch closed), so shows dots. */
		live: boolean;
		/** A voltmeter lead: drawn thin, never any dots. */
		thin: boolean;
		/** A bulb that visibly glows. */
		lit: boolean;
	}
	const items = $derived.by((): Item[] => {
		// Voltmeter leads: wires that never carry current and connect to a voltmeter.
		const reach = new Set<number>();
		for (const p of board.parts) if (p.kind === 'voltmeter') reach.add(p.a).add(p.b);
		const dead = canFlow.map((live) => !live);
		const thin = new Set<number>();
		for (let grew = true; grew;) {
			grew = false;
			board.parts.forEach((p, i) => {
				if (p.kind !== 'wire' || !dead[i] || thin.has(i)) return;
				if (reach.has(p.a) || reach.has(p.b)) {
					thin.add(i);
					reach.add(p.a).add(p.b);
					grew = true;
				}
			});
		}
		return board.parts.map((part, i) => {
			const e = EDGE.get(keyOf(part.a, part.b))!;
			const I = sol.current[i];
			return {
				i,
				part,
				e,
				ic: part.a === e.p ? I : -I,
				amps: Math.abs(I),
				volts: Math.abs(sol.voltage[i]),
				live: part.kind !== 'voltmeter' && !dead[i],
				thin: thin.has(i) || part.kind === 'voltmeter',
				lit: part.kind === 'bulb' && brightness(sol.power[i]) > 0.02
			};
		});
	});
	const byKey = $derived(new Map(items.map((it) => [it.e.key, it])));

	// ---- cross-faded looks -----------------------------------------------------------------------
	interface Look {
		kind: PartKind;
		on: number; // appears
		act: number; // charge moving (1) or stopped (0)
		glow: number; // bulb brightness
		open: number; // switch lever
		hot: number; // battery in a short circuit
	}
	const targets = $derived.by(() => {
		const m = new Map<string, Look>();
		for (const it of items)
			m.set(it.e.key, {
				kind: it.part.kind,
				on: 1,
				act: it.amps > 1e-4 ? 1 : 0,
				glow: it.part.kind === 'bulb' ? brightness(sol.power[it.i]) : 0,
				open: it.part.kind === 'switch' && !it.part.closed ? 1 : 0,
				hot: it.part.kind === 'battery' && sol.short ? 1 : 0
			});
		return m;
	});
	let prevLook = $state.raw(new Map<string, Look>());
	let curLook = $state.raw(new Map<string, Look>());
	const mix = new Tween(1, { duration: 500, easing: cubicInOut });
	function look(key: string): Look {
		const to = curLook.get(key) ?? targets.get(key);
		if (!to) return { kind: 'wire', on: 0, act: 0, glow: 0, open: 0, hot: 0 };
		const m = mix.current;
		const from = prevLook.get(key);
		if (!from || from.kind !== to.kind) return { ...to, on: m };
		return {
			kind: to.kind,
			on: lerp(from.on, to.on, m),
			act: lerp(from.act, to.act, m),
			glow: lerp(from.glow, to.glow, m),
			open: lerp(from.open, to.open, m),
			hot: lerp(from.hot, to.hot, m)
		};
	}
	$effect(() => {
		const next = targets;
		untrack(() => {
			const first = curLook.size === 0;
			const snap = new Map<string, Look>();
			for (const k of next.keys()) if (first || curLook.has(k)) snap.set(k, look(k));
			prevLook = snap;
			curLook = next;
			mix.set(0, { duration: 0 });
			mix.set(1, { duration: reduced ? 0 : 500 });
		});
	});
	const looks = $derived(new Map(items.map((it) => [it.e.key, look(it.e.key)])));

	// Wires coloured by electric potential on the voltage step.
	const potW = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const on = phase === 'voltage' ? 1 : 0;
		untrack(() => potW.set(on, { duration: reduced ? 0 : 700 }));
	});
	const maxV = $derived(Math.max(0, ...sol.v));
	const potColor = (volts: number) => {
		if (potW.current < 0.01 || maxV < 1e-6) return 'var(--circ-wire)';
		const p = Math.round(100 * clamp(volts / maxV));
		const c = `color-mix(in oklab, var(--circ-high) ${p}%, var(--circ-low))`;
		return potW.current > 0.99
			? c
			: `color-mix(in oklab, ${c} ${Math.round(100 * potW.current)}%, var(--circ-wire))`;
	};

	// ---- moving charge ------------------------------------------------------------------------------
	/** Screen speed (px/s) for a current: ≈ 60 px/s at 0.5 A, levelling off at 360 px/s. */
	const speedOf = (amps: number) => 360 * Math.tanh(amps / 3);
	const occupied = $derived(
		items
			.map((it) => it.e.key)
			.sort()
			.join(',')
	);
	const phases = new Map<string, number>();
	let phasesFor = '';
	let prevT = 0;
	const offsets = $derived.by(() => {
		const now = t;
		const dt = now - prevT;
		prevT = now;
		if (occupied !== phasesFor) {
			phases.clear();
			phasesFor = occupied;
		}
		const sign = electrons ? -1 : 1;
		const out = new Map<string, number>();
		for (const it of items) {
			if (reduced) {
				out.set(it.e.key, D / 2);
				continue;
			}
			let ph = phases.get(it.e.key) ?? 0;
			if (dt > 0) ph += sign * Math.sign(it.ic) * speedOf(it.amps) * Math.min(dt, 0.25);
			ph = ((ph % D) + D) % D;
			phases.set(it.e.key, ph);
			out.set(it.e.key, ph);
		}
		return out;
	});

	interface Dot {
		id: string;
		x: number;
		y: number;
		angle: number; // direction of motion (deg)
		opacity: number;
		moving: boolean;
		streak: boolean;
	}
	const dots = $derived.by((): Dot[] => {
		const out: Dot[] = [];
		const sign = electrons ? -1 : 1;
		for (const it of items) {
			if (!it.live) continue;
			const lk = looks.get(it.e.key)!;
			// An open switch has a gap: no charge sits in it.
			const gapOpen = it.part.kind === 'switch' ? 1 - lk.open : 1;
			const opacity = (0.3 + 0.7 * lk.act) * lk.on * gapOpen;
			if (opacity < 0.02) continue;
			const o = offsets.get(it.e.key) ?? D / 2;
			const dir = sign * Math.sign(it.ic);
			const angle = (it.e.vertical ? 90 : 0) + (dir < 0 ? 180 : 0);
			for (let k = 0; k < S / D; k++) {
				const s = (o + k * D) / S;
				out.push({
					id: `${it.e.key}:${k}`,
					x: lerp(it.e.x1, it.e.x2, s),
					y: lerp(it.e.y1, it.e.y2, s),
					angle,
					opacity,
					moving: it.amps > 1e-4,
					streak: it.amps > SHORT_CURRENT && !reduced
				});
			}
		}
		return out;
	});
	const chargeColor = $derived(electrons ? 'var(--circ-electron)' : 'var(--circ-charge)');
	/** On the voltage step the wires show potential (blue = low), so the dots go neutral. */
	const dotColor = $derived(phase === 'voltage' ? 'var(--stage-ink)' : chargeColor);

	// ---- text helpers ----------------------------------------------------------------------------------
	const fmtA = (a: number) => {
		const x = Math.abs(a) < 0.005 ? 0 : Math.abs(a);
		return `${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} A`;
	};
	const fmtV = (v: number) => `${(Math.abs(v) < 0.05 ? 0 : Math.abs(v)).toFixed(1)} V`;
	const fmtR = (r: number) => `${+r.toFixed(1)} Ω`;

	function describe(it: Item): { title: string; line: string } {
		const p = it.part;
		const title =
			p.kind === 'battery'
				? `Battery (${fmtV(valueOf(p))})`
				: p.kind === 'resistor'
					? `Resistor (${fmtR(valueOf(p))})`
					: p.kind === 'switch'
						? `Switch (${p.closed ? 'closed' : 'open'})`
						: p.kind[0].toUpperCase() + p.kind.slice(1);
		const line =
			p.kind === 'voltmeter'
				? `reads ${fmtV(it.volts)}, no current through it`
				: p.kind === 'switch' && !p.closed
					? `${fmtA(0)} through, ${fmtV(it.volts)} across the gap`
					: `${fmtA(it.amps)} through, ${fmtV(it.volts)} across`;
		return { title, line };
	}

	function ariaFor(e: Edge): string {
		const it = byKey.get(e.key);
		const where = `between pegs ${e.name}`;
		let label: string;
		if (it) {
			const d = describe(it);
			label = `${d.title}, ${where} — ${d.line}`;
		} else label = `Gap ${where}, empty`;
		if (edit) {
			const act = buildAction(e);
			if (act) label += `. Activate to ${act}`;
		} else if (it && switchParams.has(it.i))
			label += `. Activate to ${it.part.closed ? 'open' : 'close'} it`;
		return label;
	}

	// ---- hover and focus ----------------------------------------------------------------------------------
	let hovered = $state<string | null>(null);
	let focused = $state<string | null>(null);
	// A target that disappears (another step's board) takes no blur event with it.
	const focusKey = $derived(focused && (edit || byKey.has(focused)) ? focused : null);
	const tipKey = $derived(hovered ?? focusKey);
	const tip = $derived.by(() => {
		if (!tipKey) return null;
		const e = EDGE.get(tipKey)!;
		const it = byKey.get(tipKey);
		let lines: string[];
		if (it) {
			const d = describe(it);
			lines = [`${d.title} — ${d.line}`];
		} else if (edit) lines = [`Gap between pegs ${e.name}`];
		else return null;
		if (edit) {
			const act = buildAction(e);
			lines.push(
				act
					? `Click to ${act}`
					: tool === 'erase'
						? 'Nothing to erase here'
						: 'Pick another part to replace it'
			);
		} else if (it && switchParams.has(it.i))
			lines.push(`Click to ${it.part.closed ? 'open' : 'close'} it`);
		const w = Math.max(...lines.map((l, k) => l.length * (k === 0 ? 7 : 6.4))) + 24;
		const h = 14 + lines.length * 18;
		const above = e.cy - 34 - h > 20;
		return {
			lines,
			w,
			h,
			x: clamp(e.cx - w / 2, 16, 944 - w),
			y: above ? e.cy - 34 - h : e.cy + 34
		};
	});

	// ---- captions on the board, per phase ---------------------------------------------------------------
	const nth = (kind: PartKind) => items.filter((it) => it.part.kind === kind);
	const captions = $derived.by(() => {
		const out: { key: string; text: string }[] = [];
		const name = (list: Item[], names: string[]) =>
			list.forEach((it, k) => names[k] && out.push({ key: it.e.key, text: names[k] }));
		if (phase === 'current')
			name(nth('ammeter'), ['before the bulb', 'after the bulb', 'back to the battery']);
		if (phase === 'parallel') {
			name(nth('ammeter'), ['at the battery', 'branch 1', 'branch 2']);
			name(nth('bulb'), ['bulb 1', 'bulb 2']);
		}
		if (phase === 'series')
			nth('bulb').forEach((it, k) =>
				out.push({ key: it.e.key, text: `bulb ${k + 1}: ${fmtV(it.volts)}` })
			);
		if (phase === 'switches')
			nth('bulb').forEach((it, k) =>
				out.push({
					key: it.e.key,
					text: `${k ? 'right' : 'left'} bulb: ${it.lit ? 'lit' : 'off'}`
				})
			);
		return out.map((c) => {
			const e = EDGE.get(c.key)!;
			const col = colOf(e.p);
			const row = rowOf(e.p);
			if (e.vertical)
				return col <= 1
					? { ...c, x: e.cx - 30, y: e.cy + 4, anchor: 'end' }
					: { ...c, x: e.cx + 30, y: e.cy + 4, anchor: 'start' };
			return row <= 1
				? { ...c, x: e.cx, y: e.cy - 32, anchor: 'middle' }
				: { ...c, x: e.cx, y: e.cy + 42, anchor: 'middle' };
		});
	});

	// ---- readouts ---------------------------------------------------------------------------------------------
	const first = (kind: PartKind) => items.find((it) => it.part.kind === kind);
	const battery = $derived(first('battery'));
	const loopAmps = $derived(battery?.amps ?? 0);
	const theSwitch = $derived(first('switch'));
	const bulbs = $derived(nth('bulb'));
	const resistor = $derived(first('resistor'));
	const loopWire = $derived(items.find((it) => it.part.kind === 'wire' && it.live));
	const shortNow = $derived(sol.short);
	const hotPulse = $derived(reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 6));

	const TOOL_LABEL: Record<string, string> = {
		wire: 'Wire',
		battery: 'Battery',
		bulb: 'Bulb',
		resistor: 'Resistor',
		switch: 'Switch',
		ammeter: 'Ammeter',
		voltmeter: 'Voltmeter',
		erase: 'Eraser'
	};
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
		tabular?: boolean;
		halo?: string;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:stroke={opts.halo ?? 'var(--surface)'}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet row(y: number, label: string, value: string, color?: string)}
	{@render txt(PL, y, label, 13)}
	{@render txt(PR, y, value, 15, { anchor: 'end', weight: 650, tabular: true, color })}
{/snippet}

{#snippet lead(x1: number, y1: number, x2: number, y2: number, color: string, thin: boolean)}
	<line
		{x1}
		{y1}
		{x2}
		{y2}
		style:stroke={color}
		stroke-width={thin ? 1.5 : 3}
		stroke-linecap="round"
	/>
{/snippet}

<!-- Wires and leads (the lines under every part), coloured by potential on the voltage step. -->
{#snippet wiring(it: Item)}
	{@const e = it.e}
	{@const half =
		it.part.kind === 'wire'
			? 0
			: it.part.kind === 'switch'
				? 16
				: it.part.kind === 'resistor'
					? 20
					: it.part.kind === 'battery'
						? 7
						: it.part.kind === 'bulb'
							? 16
							: 25}
	{@const ux = e.vertical ? 0 : 1}
	{@const uy = e.vertical ? 1 : 0}
	{@const vp = sol.v[e.p]}
	{@const vq = sol.v[e.q]}
	{#if half === 0}
		{@render lead(e.x1, e.y1, e.x2, e.y2, potColor((vp + vq) / 2), it.thin)}
	{:else}
		{@render lead(e.x1, e.y1, e.cx - ux * half, e.cy - uy * half, potColor(vp), it.thin)}
		{@render lead(e.cx + ux * half, e.cy + uy * half, e.x2, e.y2, potColor(vq), it.thin)}
	{/if}
{/snippet}

<!-- The body of a part, drawn over the moving charge. -->
{#snippet body(it: Item, lk: Look)}
	{@const e = it.e}
	{@const p = it.part}
	{@const rot = e.vertical ? 90 : 0}
	{#if p.kind === 'battery'}
		{@const s = p.b === e.q ? 1 : -1}
		{@const ux = e.vertical ? 0 : 1}
		{@const uy = e.vertical ? 1 : 0}
		<g transform="translate({e.cx} {e.cy}) rotate({rot})">
			<rect
				x="-15"
				y="-19"
				width="30"
				height="38"
				rx="7"
				style:fill="color-mix(in oklab, var(--circ-battery) 14%, var(--circ-board))"
				style:stroke="var(--circ-battery)"
				stroke-width="1.5"
			/>
			<line
				x1={s * 7}
				x2={s * 7}
				y1="-14"
				y2="14"
				style:stroke="var(--circ-battery)"
				stroke-width="2.5"
			/>
			<line
				x1={-s * 7}
				x2={-s * 7}
				y1="-7"
				y2="7"
				style:stroke="var(--circ-battery)"
				stroke-width="5"
			/>
		</g>
		{@render txt(e.cx + ux * s * 9 + e.nx * 26, e.cy + uy * s * 9 + e.ny * 26 + 5, '+', 15, {
			anchor: 'middle',
			weight: 700,
			color: 'var(--circ-battery)',
			halo: 'var(--circ-board)'
		})}
		{@render txt(e.cx - ux * s * 9 + e.nx * 26, e.cy - uy * s * 9 + e.ny * 26 + 5, '−', 15, {
			anchor: 'middle',
			weight: 700,
			color: 'var(--circ-battery)',
			halo: 'var(--circ-board)'
		})}
		<!-- its voltage (on the voltage step the voltmeter beside it says it) -->
		{#if phase !== 'voltage'}
			<!-- left of a vertical battery, except in column A, where it goes right, past the + and − -->
			{@const inA = e.vertical && colOf(e.p) === 0}
			{@render txt(inA ? e.cx + 36 : e.cx - e.nx * 26, e.cy - e.ny * 30 + 4, fmtV(valueOf(p)), 12, {
				anchor: inA ? 'start' : e.vertical ? 'end' : 'middle',
				weight: 600,
				halo: 'var(--circ-board)'
			})}
		{/if}
	{:else if p.kind === 'bulb'}
		{@const g = lk.glow}
		<g transform="translate({e.cx} {e.cy}) rotate({rot})">
			<circle
				r="16"
				style:fill="color-mix(in oklab, var(--circ-glow) {Math.round(8 + 72 * g)}%,
				var(--circ-board))"
				style:stroke="var(--circ-wire)"
				stroke-width="1.5"
			/>
			<path
				d="M-16 0 L-7 -1 L-6 -7 M16 0 L7 -1 L6 -7"
				fill="none"
				style:stroke="var(--circ-wire)"
				stroke-width="1.25"
			/>
			<path
				d="M-6 -7 l2 -4 l2 4 l2 -4 l2 4 l2 -4 l2 4"
				fill="none"
				style:stroke="color-mix(in oklab, var(--circ-glow) {Math.round(100 * Math.sqrt(g))}%,
				var(--circ-wire))"
				stroke-width={1.4 + 0.8 * g}
				stroke-linejoin="round"
			/>
		</g>
	{:else if p.kind === 'resistor'}
		<g transform="translate({e.cx} {e.cy}) rotate({rot})">
			<rect
				x="-20"
				y="-8"
				width="40"
				height="16"
				rx="4"
				style:fill="color-mix(in oklab, var(--circ-wire) 16%, var(--circ-board))"
				style:stroke="var(--circ-wire)"
				stroke-width="1.5"
			/>
			{#each [-10, -3, 4] as bx (bx)}
				<rect x={bx} y="-8" width="3" height="16" style:fill="var(--circ-wire)" opacity="0.7" />
			{/each}
		</g>
		{@render txt(
			e.cx + (e.vertical ? 24 : 0),
			e.cy + (e.vertical ? 4 : -16),
			fmtR(valueOf(p)),
			12,
			{ anchor: e.vertical ? 'start' : 'middle', weight: 600, halo: 'var(--circ-board)' }
		)}
	{:else if p.kind === 'switch'}
		<g transform="translate({e.cx} {e.cy}) rotate({rot})">
			<line
				x1="-16"
				y1="0"
				x2="18"
				y2="0"
				transform="rotate({-32 * lk.open} -16 0)"
				style:stroke="var(--circ-wire)"
				stroke-width="3.5"
				stroke-linecap="round"
			/>
			<circle
				cx="-16"
				r="4"
				style:fill="var(--circ-board)"
				style:stroke="var(--circ-wire)"
				stroke-width="2"
			/>
			<circle
				cx="16"
				r="4"
				style:fill="var(--circ-board)"
				style:stroke="var(--circ-wire)"
				stroke-width="2"
			/>
		</g>
	{:else if p.kind === 'ammeter' || p.kind === 'voltmeter'}
		{@const reading = p.kind === 'ammeter' ? fmtA(it.amps) : fmtV(it.volts)}
		<circle
			cx={e.cx}
			cy={e.cy}
			r="25"
			style:fill="var(--circ-meter)"
			style:stroke="var(--circ-wire)"
			stroke-width="1.5"
		/>
		{@render txt(e.cx, e.cy - 7, p.kind === 'ammeter' ? 'A' : 'V', 11, {
			anchor: 'middle',
			weight: 700,
			muted: true,
			halo: 'var(--circ-meter)'
		})}
		{@render txt(e.cx, e.cy + 9, reading, reading.length > 6 ? 10 : 11, {
			anchor: 'middle',
			weight: 700,
			tabular: true,
			halo: 'var(--circ-meter)'
		})}
	{/if}
{/snippet}

<g>
	<defs>
		<radialGradient id="board-glow">
			<stop offset="0" stop-color="var(--circ-glow)" stop-opacity="0.85" />
			<stop offset="0.45" stop-color="var(--circ-glow)" stop-opacity="0.35" />
			<stop offset="1" stop-color="var(--circ-glow)" stop-opacity="0" />
		</radialGradient>
		<radialGradient id="board-hot">
			<stop offset="0" stop-color="var(--circ-battery)" stop-opacity="0.7" />
			<stop offset="1" stop-color="var(--circ-battery)" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="board-potential" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" stop-color="var(--circ-high)" />
			<stop offset="1" stop-color="var(--circ-low)" />
		</linearGradient>
	</defs>

	<!-- the board -->
	<rect
		x={BOARD.x}
		y={BOARD.y}
		width={BOARD.w}
		height={BOARD.h}
		rx="16"
		style:fill="var(--circ-board)"
		style:stroke="var(--border)"
		stroke-width="1"
	/>
	{#if edit}
		<g style:pointer-events="none">
			{#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
				{@render txt(X0 + c * S, BOARD.y + 20, String.fromCharCode(65 + c), 11, {
					anchor: 'middle',
					muted: true,
					halo: 'var(--circ-board)'
				})}
			{/each}
			{#each Array.from({ length: ROWS }, (_, r) => r) as r (r)}
				{@render txt(BOARD.x + 12, Y0 + r * S + 4, String(r + 1), 11, {
					anchor: 'middle',
					muted: true,
					halo: 'var(--circ-board)'
				})}
			{/each}
		</g>
	{/if}

	<g style:pointer-events="none">
		<!-- light from the bulbs, heat from a shorted battery -->
		{#each items as it (it.e.key)}
			{@const lk = looks.get(it.e.key)!}
			{#if it.part.kind === 'bulb' && lk.glow * lk.on > 0.01}
				<circle
					cx={it.e.cx}
					cy={it.e.cy}
					r={30 + 26 * lk.glow}
					fill="url(#board-glow)"
					opacity={Math.min(1, 0.25 + lk.glow) * lk.on}
				/>
			{:else if it.part.kind === 'battery' && lk.hot > 0.01}
				<circle
					cx={it.e.cx}
					cy={it.e.cy}
					r="48"
					fill="url(#board-hot)"
					opacity={lk.hot * hotPulse}
				/>
			{/if}
		{/each}

		<!-- wires and leads -->
		{#each items as it (it.e.key)}
			<g opacity={looks.get(it.e.key)!.on}>{@render wiring(it)}</g>
		{/each}

		<!-- moving charge -->
		<g style:fill={dotColor}>
			{#each dots as d (d.id)}
				{#if reduced && d.moving}
					<path
						d="M-5 -5 L5 0 L-5 5 Z"
						transform="translate({d.x} {d.y}) rotate({d.angle})"
						opacity={d.opacity}
						style:stroke="var(--circ-board)"
						stroke-width={electrons ? 2 : 1}
					/>
				{:else if d.streak}
					<line
						x1="-16"
						y1="0"
						x2="0"
						y2="0"
						transform="translate({d.x} {d.y}) rotate({d.angle})"
						style:stroke={dotColor}
						stroke-width="5"
						stroke-linecap="round"
						opacity={0.7 * d.opacity}
					/>
				{:else}
					<circle
						cx={d.x}
						cy={d.y}
						r={phase === 'voltage' ? 3 : electrons ? 4.5 : 3.5}
						opacity={d.opacity}
						style:stroke="var(--circ-board)"
						stroke-width={electrons ? 2.25 : 1.25}
					/>
				{/if}
			{/each}
		</g>

		<!-- part bodies -->
		{#each items as it (it.e.key)}
			{@const lk = looks.get(it.e.key)!}
			{#if it.part.kind !== 'wire'}
				<g opacity={lk.on}>{@render body(it, lk)}</g>
			{/if}
		{/each}

		<!-- pegs -->
		{#each PEGS as pg (pg.id)}
			<circle
				cx={pg.x}
				cy={pg.y}
				r="4"
				style:fill="var(--circ-peg)"
				style:stroke="var(--circ-board)"
				stroke-width="1.5"
			/>
		{/each}

		<!-- captions -->
		{#each captions as c (c.key)}
			{@render txt(c.x, c.y, c.text, 12, {
				anchor: c.anchor,
				weight: 600,
				halo: 'var(--circ-board)'
			})}
		{/each}

		<!-- potential labels (voltage step) -->
		{#if potW.current > 0.01 && battery}
			<g opacity={potW.current}>
				{@render txt(196, 194, `high (${fmtV(maxV)})`, 12, {
					anchor: 'middle',
					weight: 650,
					color: 'var(--circ-high)',
					halo: 'var(--circ-board)'
				})}
				{@render txt(328, 420, `low (${fmtV(0)})`, 12, {
					anchor: 'middle',
					weight: 650,
					color: 'var(--circ-low)',
					halo: 'var(--circ-board)'
				})}
				{#if theSwitch && !theSwitch.part.closed}
					{@render txt(
						theSwitch.e.cx,
						theSwitch.e.cy + 38,
						`${fmtV(theSwitch.volts)} across the gap`,
						12,
						{
							anchor: 'middle',
							weight: 650,
							halo: 'var(--circ-board)'
						}
					)}
				{/if}
			</g>
		{/if}
	</g>

	<!-- targets: every part (and, on build, every gap) can be hovered, focused and clicked -->
	{#each edit ? EDGES : items.map((it) => it.e) as e (e.key)}
		{@const it = byKey.get(e.key)}
		{@const clickable = edit || (it !== undefined && switchParams.has(it.i))}
		{@const round = it && ['bulb', 'ammeter', 'voltmeter'].includes(it.part.kind)}
		<g
			class="hit"
			class:clickable
			class:empty={edit && !it}
			role="button"
			tabindex="0"
			aria-label={ariaFor(e)}
			onclick={() => activate(e)}
			onkeydown={(ev) => onkey(ev, e)}
			onpointerenter={() => (hovered = e.key)}
			onpointerleave={() => hovered === e.key && (hovered = null)}
			onfocus={(ev) => {
				// Tooltip for keyboard focus only: a click also focuses.
				if ((ev.currentTarget as Element).matches(':focus-visible')) focused = e.key;
			}}
			onblur={() => focused === e.key && (focused = null)}
		>
			<rect
				x={e.cx - (e.vertical ? 13 : 30)}
				y={e.cy - (e.vertical ? 30 : 13)}
				width={e.vertical ? 26 : 60}
				height={e.vertical ? 60 : 26}
				fill="transparent"
			/>
			{#if round}
				<circle cx={e.cx} cy={e.cy} r="26" fill="transparent" />
			{/if}
		</g>
	{/each}

	<!-- hover and focus feedback, drawn once: a ring, and on an empty gap a faint placeholder -->
	{#snippet ring(key: string, opacity: number)}
		{@const e = EDGE.get(key)!}
		<rect
			x={e.cx - (e.vertical ? 15 : 32)}
			y={e.cy - (e.vertical ? 32 : 15)}
			width={e.vertical ? 30 : 64}
			height={e.vertical ? 64 : 30}
			rx="8"
			fill="none"
			{opacity}
			style:stroke="var(--focus)"
			stroke-width="2"
		/>
	{/snippet}
	<g style:pointer-events="none">
		{#if tipKey && edit && !byKey.has(tipKey) && tool !== 'erase'}
			{@const e = EDGE.get(tipKey)!}
			<!-- its label right of a vertical gap, except in the last column, where it would leave the board -->
			{@const left = e.vertical && colOf(e.p) === COLS - 1}
			<g opacity="0.6">
				<line
					x1={e.x1 + (e.vertical ? 0 : 10)}
					y1={e.y1 + (e.vertical ? 10 : 0)}
					x2={e.x2 - (e.vertical ? 0 : 10)}
					y2={e.y2 - (e.vertical ? 10 : 0)}
					style:stroke="var(--circ-wire)"
					stroke-width="2"
					stroke-dasharray="4 4"
				/>
				{@render txt(
					e.cx + (e.vertical ? (left ? -20 : 20) : 0),
					e.cy + (e.vertical ? 4 : -20),
					`+ ${KIND_NAME[tool]}`,
					11,
					{
						anchor: e.vertical ? (left ? 'end' : 'start') : 'middle',
						weight: 600,
						halo: 'var(--circ-board)'
					}
				)}
			</g>
		{/if}
		{#if hovered && hovered !== focusKey && (edit || switchParams.has(byKey.get(hovered)?.i ?? -1))}
			{@render ring(hovered, 0.35)}
		{/if}
		{#if focusKey}
			{@render ring(focusKey, 1)}
		{/if}
	</g>

	<!-- ------------------------------------------------------------------ readout card -->
	<g style:pointer-events="none">
		<rect
			x={PANEL.x}
			y={PANEL.y}
			width={PANEL.w}
			height={PANEL.h}
			rx="14"
			style:fill="var(--surface)"
			style:stroke="var(--border)"
		/>
		{#if phase === 'loop'}
			{@const closed = loopAmps > 1e-4}
			{@render txt(
				PL,
				124,
				closed ? 'Switch closed: a complete loop' : 'Switch open: a gap in the loop',
				15,
				{ weight: 650 }
			)}
			{@render txt(PL, 166, 'current in the loop', 13, { muted: true })}
			{@render txt(PL, 200, fmtA(loopAmps), 28, {
				weight: 650,
				tabular: true,
				color: 'var(--circ-charge)'
			})}
			{@render row(244, 'bulb', bulbs[0]?.lit ? 'lit' : 'off')}
			{#if closed}
				{@render txt(PL, 290, 'Charge flows out of the battery’s +', 13)}
				{@render txt(PL, 308, 'end, through the bulb and back', 13)}
				{@render txt(PL, 326, 'into its − end.', 13)}
			{:else}
				{@render txt(PL, 290, 'One gap stops the charge', 13)}
				{@render txt(PL, 308, 'everywhere in the loop, at once.', 13)}
			{/if}
			{@render txt(PL, 486, 'Click the switch on the board to flip it.', 12, { muted: true })}
		{:else if phase === 'current'}
			{@const ams = nth('ammeter')}
			{@render txt(PL, 124, 'Three ammeters', 15, { weight: 650 })}
			{@render txt(PL, 146, 'charge passing each second', 12, { muted: true })}
			{#each ['before the bulb', 'after the bulb', 'back to the battery'] as label, k (label)}
				{@render row(184 + k * 28, label, fmtA(ams[k]?.amps ?? 0), 'var(--circ-charge)')}
			{/each}
			{#if loopAmps > 1e-4}
				{@render txt(PL, 290, 'All the same: the bulb does not', 13)}
				{@render txt(PL, 308, 'use up current. It takes energy', 13)}
				{@render txt(PL, 326, 'from the charge passing through.', 13)}
			{:else}
				{@render txt(PL, 290, 'Switch open: no current anywhere,', 13)}
				{@render txt(PL, 308, 'so every ammeter reads zero.', 13)}
			{/if}
			{@render txt(PL, 486, 'Click the switch on the board to flip it.', 12, { muted: true })}
		{:else if phase === 'voltage'}
			{@const vms = nth('voltmeter')}
			{@render txt(PL, 124, 'Electric potential', 15, { weight: 650 })}
			<rect x={PL} y="140" width={PR - PL} height="12" rx="6" fill="url(#board-potential)" />
			{@render txt(
				PL,
				170,
				`${fmtV(maxV || valueOf(battery?.part ?? { kind: 'battery', a: 0, b: 0 }))} high`,
				12,
				{ color: 'var(--circ-high)', weight: 650 }
			)}
			{@render txt(PR, 170, 'low 0 V', 12, {
				anchor: 'end',
				color: 'var(--circ-low)',
				weight: 650
			})}
			{@render txt(PL, 210, 'The voltage (difference in potential):', 13)}
			{@render row(240, 'across the battery', fmtV(vms[0]?.volts ?? 0))}
			{@render row(268, 'across the bulb', fmtV(vms[1]?.volts ?? 0))}
			{#if theSwitch && !theSwitch.part.closed}
				{@render row(296, 'across the switch gap', fmtV(theSwitch.volts))}
				{@render txt(PL, 336, 'No current: the bulb has no voltage', 13)}
				{@render txt(PL, 354, 'across it; all 6 V sits across the gap.', 13)}
			{:else}
				{@render row(296, 'across a wire', fmtV(loopWire?.volts ?? 0))}
				{@render txt(PL, 336, 'The battery lifts each coulomb by', 13)}
				{@render txt(PL, 354, '6 joules; the bulb takes it back.', 13)}
			{/if}
		{:else if phase === 'ohm'}
			{@const V = resistor?.volts ?? 0}
			{@const R = resistor ? valueOf(resistor.part) : 1}
			{@render txt(PL, 124, 'Ohm’s law', 15, { weight: 650 })}
			{@render row(166, 'voltage across the resistor, V', fmtV(V), 'var(--circ-high)')}
			{@render row(194, 'resistance, R', fmtR(R))}
			{@render txt(PL, 240, 'current I = V ÷ R', 13, { muted: true })}
			{@render txt(PL, 268, `= ${fmtV(V)} ÷ ${fmtR(R)}`, 18, { weight: 600, tabular: true })}
			{@render txt(PL, 306, `= ${fmtA(resistor?.amps ?? 0)}`, 28, {
				weight: 650,
				tabular: true,
				color: 'var(--circ-charge)'
			})}
			{@render txt(PL, 350, 'Double the voltage: the current', 13)}
			{@render txt(PL, 368, 'doubles. Double the resistance:', 13)}
			{@render txt(PL, 386, 'it halves.', 13)}
		{:else if phase === 'series'}
			{@const sum = bulbs.reduce((s, b) => s + b.volts, 0)}
			{@render txt(PL, 124, 'Two bulbs in series', 15, { weight: 650 })}
			{@render txt(PL, 146, 'one path, so one current', 12, { muted: true })}
			{@render row(178, 'current everywhere', fmtA(loopAmps), 'var(--circ-charge)')}
			{@render txt(PL, 222, 'the battery’s voltage is shared:', 12, { muted: true })}
			{#each bulbs as b, k (b.e.key)}
				{@render row(250 + k * 28, `bulb ${k + 1}`, fmtV(b.volts), 'var(--circ-high)')}
			{/each}
			<line x1={PL} x2={PR} y1="312" y2="312" style:stroke="var(--border)" />
			{@render row(334, 'together', `${fmtV(sum)}`)}
			{@render txt(
				PL,
				378,
				`Each bulb: ${(sol.power[bulbs[0]?.i ?? 0] ?? 0).toFixed(2)} W, a quarter of`,
				13
			)}
			{@render txt(PL, 396, 'the 3 W of a bulb on its own: dim.', 13)}
		{:else if phase === 'parallel'}
			{@const ams = nth('ammeter')}
			{@render txt(PL, 124, 'Two bulbs in parallel', 15, { weight: 650 })}
			{@render txt(PL, 146, 'the current splits and joins again', 12, { muted: true })}
			{@render row(182, 'branch 1', fmtA(ams[1]?.amps ?? 0), 'var(--circ-charge)')}
			{@render row(210, 'branch 2', fmtA(ams[2]?.amps ?? 0), 'var(--circ-charge)')}
			<line x1={PL} x2={PR} y1="226" y2="226" style:stroke="var(--border)" />
			{@render row(250, 'at the battery', fmtA(ams[0]?.amps ?? 0), 'var(--circ-charge)')}
			{@render txt(PL, 274, `= ${fmtA(ams[1]?.amps ?? 0)} + ${fmtA(ams[2]?.amps ?? 0)}`, 12, {
				muted: true,
				tabular: true
			})}
			{@render txt(PL, 318, `Each bulb gets the full ${fmtV(bulbs[0]?.volts ?? 0)}`, 13)}
			{@render txt(PL, 336, 'and glows as brightly as one alone.', 13)}
			{@render txt(PL, 368, 'The battery delivers twice the', 13)}
			{@render txt(PL, 386, 'current, so it runs down twice as fast.', 13)}
		{:else if phase === 'switches'}
			{@render txt(PL, 124, 'Lights in a house', 15, { weight: 650 })}
			{@render txt(PL, 146, 'each bulb on its own branch', 12, { muted: true })}
			{#each bulbs as b, k (b.e.key)}
				{@render row(
					184 + k * 28,
					`${k ? 'right' : 'left'} bulb`,
					b.lit ? `lit, ${fmtA(b.amps)}` : 'off'
				)}
			{/each}
			{@render row(254, 'from the battery', fmtA(loopAmps), 'var(--circ-charge)')}
			{@const nLit = bulbs.filter((b) => b.lit).length}
			{@render txt(PL, 298, 'Each branch is its own loop through', 13)}
			{#if nLit === bulbs.length}
				{@render txt(PL, 316, 'the battery. Open one switch: only', 13)}
				{@render txt(PL, 334, 'its own bulb goes out.', 13)}
			{:else if nLit > 0}
				{@render txt(PL, 316, 'the battery: one switch put its bulb', 13)}
				{@render txt(PL, 334, 'out; the other is just as bright.', 13)}
			{:else}
				{@render txt(PL, 316, 'the battery: both switches are open,', 13)}
				{@render txt(PL, 334, 'so both bulbs are off.', 13)}
			{/if}
			{@render txt(PL, 486, 'Click a switch on the board to flip it.', 12, { muted: true })}
		{:else}
			{@const bats = nth('battery')}
			{@const lit = bulbs.filter((b) => b.lit).length}
			{@render txt(PL, 124, 'Your circuit', 15, { weight: 650 })}
			{@render txt(PL, 146, `tool: ${TOOL_LABEL[tool] ?? tool}`, 12, { muted: true })}
			{#if bats.length === 0}
				{@render txt(PL, 182, 'Add a battery to drive a current.', 13)}
			{:else}
				{#each bats.slice(0, 3) as b, k (b.e.key)}
					{@render row(
						182 + k * 28,
						bats.length > 1 ? `battery ${k + 1} current` : 'current from the battery',
						fmtA(b.amps),
						'var(--circ-charge)'
					)}
				{/each}
			{/if}
			{@const y0 = 182 + Math.max(1, Math.min(3, bats.length)) * 28}
			{#if bulbs.length}
				{@render row(y0, 'bulbs lit', `${lit} of ${bulbs.length}`)}
			{/if}
			{#if bats.length && !sol.current.some((c) => Math.abs(c) > 1e-4)}
				{#if solClosed.current.some((c) => Math.abs(c) > 1e-4)}
					{@render txt(PL, y0 + 34, 'A switch is open: no current.', 13)}
				{:else if canFlow.some((live, i) => live && board.parts[i].kind === 'battery')}
					{@render txt(PL, y0 + 34, 'The batteries push against each', 13)}
					{@render txt(PL, y0 + 52, 'other and cancel: no current.', 13)}
				{:else}
					{@render txt(PL, y0 + 34, 'No complete loop: no current.', 13)}
				{/if}
			{/if}
			<circle cx={PL + 5} cy="382" r="4" style:fill={chargeColor} />
			{@render txt(
				PL + 16,
				386,
				electrons ? 'electron, drifting − to +' : 'charge, as conventional current + to −',
				12,
				{ muted: true }
			)}
			{@render txt(PL, 418, 'Hover over or focus a part to read', 12, { muted: true })}
			{@render txt(PL, 434, 'its current and voltage.', 12, { muted: true })}
			{@render txt(PL, 466, 'Click a gap to place the part.', 12, { muted: true })}
			{@render txt(PL, 482, 'Click a switch to flip it, a battery', 12, { muted: true })}
			{@render txt(PL, 498, 'to turn it round.', 12, { muted: true })}
		{/if}
	</g>

	<!-- short circuit warning -->
	{#if shortNow}
		<g style:pointer-events="none">
			<rect
				x={BOARD.x + BOARD.w / 2 - 196}
				y="44"
				width="392"
				height="30"
				rx="15"
				style:fill="color-mix(in oklab, var(--circ-battery) 16%, var(--surface))"
				style:stroke="var(--circ-battery)"
				stroke-width="1.5"
			/>
			{@render txt(
				BOARD.x + BOARD.w / 2,
				64,
				'Short circuit! huge current — the battery heats up',
				13,
				{
					anchor: 'middle',
					weight: 650,
					color: 'var(--circ-battery)',
					halo: 'color-mix(in oklab, var(--circ-battery) 16%, var(--surface))'
				}
			)}
		</g>
	{/if}

	<!-- tooltip -->
	{#if tip}
		<g style:pointer-events="none">
			<rect
				x={tip.x}
				y={tip.y}
				width={tip.w}
				height={tip.h}
				rx="8"
				style:fill="var(--surface)"
				style:stroke="var(--border)"
				filter="url(#soft-shadow)"
			/>
			{#each tip.lines as line, k (k)}
				{@render txt(tip.x + 12, tip.y + 22 + k * 18, line, k === 0 ? 13 : 12, {
					weight: k === 0 ? 600 : 500,
					muted: k > 0,
					tabular: true
				})}
			{/each}
		</g>
	{/if}
</g>

<style>
	.hit {
		outline: none;
	}
	.hit.clickable {
		cursor: pointer;
	}
</style>
