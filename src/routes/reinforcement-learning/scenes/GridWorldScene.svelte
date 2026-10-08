<script lang="ts">
	/**
	 * The grid world: an agent learning by Q-learning, replayed move by move.
	 *
	 * The whole training run (300 episodes) is recorded once by `train` whenever
	 * the map or a setting changes (../run.ts builds the key), and replayed with
	 * the sorting topic's `createPlayback`: position k means "k moves made", and
	 * the estimates shown are `qAt(run, k)`. Between two whole positions the
	 * agent slides from one square to the next, so the frame is a function of t.
	 *
	 * Drawing budget: one rect per square; the estimates are four triangles per
	 * square, quantised into colour bands and drawn as one path per band; the
	 * best-move chevrons are one path; numbers are one <text> per row.
	 *
	 * Editing (steps that offer the brush): the map lives in
	 * `params['map:' + step.id]` (`serializeWorld`). Click or drag to paint, as
	 * in the graph-search topic's GridScene (starting on a square that already
	 * has the brush's kind clears instead); S is dragged or moved with the arrow
	 * keys; the map cursor (Tab to it) moves with the arrow keys and paints with
	 * Space or Enter.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, easeInOut, startDrag, toSvg, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '../../sorting/playback';
	import {
		MOVES,
		MOVE_NAMES,
		PENALTY,
		REWARD,
		SMALL,
		WALL,
		bestValue,
		distances,
		episodeAt,
		epsilonAt,
		greedyPath,
		isEnd,
		qAt,
		serializeWorld,
		train,
		valueIteration,
		type Cell,
		type World
	} from '../qlearning';
	import { setup } from '../run';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------------------
	const COLS = 10;
	const ROWS = 6;
	const CS = 56;
	const GX = 32;
	const GY = 108;
	const GW = COLS * CS;
	const GH = ROWS * CS;
	const N = COLS * ROWS;
	const PX = 616;
	const PW = 328;
	const colOf = (i: number) => i % COLS;
	const rowOf = (i: number) => Math.floor(i / COLS);
	const cx = (i: number) => GX + colOf(i) * CS + CS / 2;
	const cy = (i: number) => GY + rowOf(i) * CS + CS / 2;
	function cellAt(p: Point): number | null {
		const c = Math.floor((p.x - GX) / CS);
		const r = Math.floor((p.y - GY) / CS);
		if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
		return r * COLS + c;
	}

	// ---- the run -------------------------------------------------------------------------
	const cfg = $derived(setup(step, params));
	const world = $derived(cfg.world);
	const phase = $derived(String(step.hints?.phase ?? 'world'));
	const canPaint = $derived(cfg.offered.has('brush'));
	// Retrain only when the map or a setting changes, not on every scrub or pick.
	const runKey = $derived(cfg.key);
	const run = $derived.by(() => {
		void runKey;
		return untrack(() => train(cfg.world, cfg.settings));
	});
	const total = $derived(run.moves.length);
	const E = $derived(run.episodes.length);
	const exact = $derived(phase === 'values' ? valueIteration(cfg.world, cfg.settings.gamma) : null);

	/** Per episode, how many of the episodes before it ended where (cumulative counts). */
	const tally = $derived.by(() => {
		const big = [0];
		const small = [0];
		const pit = [0];
		const cut = [0];
		const reward = [0];
		run.episodes.forEach((e, j) => {
			big.push(big[j] + (e.end === REWARD ? 1 : 0));
			small.push(small[j] + (e.end === SMALL ? 1 : 0));
			pit.push(pit[j] + (e.end === PENALTY ? 1 : 0));
			cut.push(cut[j] + (e.end === null ? 1 : 0));
			reward.push(reward[j] + e.reward);
		});
		return { big, small, pit, cut, reward };
	});

	/** Fewest moves from S to the nearest reward (+10, else +1), or null. */
	const shortest = $derived.by(() => {
		const d = distances(world);
		let best = Infinity;
		for (const kind of [REWARD, SMALL]) {
			for (let i = 0; i < N; i++) if (world.cells[i] === kind) best = Math.min(best, d[i]);
			if (isFinite(best)) return best;
		}
		return null;
	});

	// ---- playback -------------------------------------------------------------------------
	const position = createPlayback();
	const playing = $derived(!cfg.offered.has('play') || params.play !== false);
	const manual = $derived(params.positionKey === cfg.key ? Number(params.position ?? 0) : 0);
	let lastK = 0;

	/*
	 * Credit step: early on, almost no move changes an estimate (they are all 0
	 * and stay 0 until the agent first reaches the +10), and the first credits
	 * are hundreds of moves apart. So that the step shows them at a readable
	 * pace, the replay skips through the dull stretches 20 times faster: a move
	 * plays at the chosen speed only within a few moves of a change. The
	 * playback runs on this warped clock; `toV`/`fromV` convert positions.
	 */
	const SKIP = 20;
	const warp = $derived.by(() => {
		if (phase !== 'credit') return null;
		const n = run.moves.length;
		// A change visible in the card's two decimals.
		const changed = (j: number) => Math.abs(run.moves[j].after - run.moves[j].before) >= 0.005;
		const len = new Float64Array(n).fill(1 / SKIP);
		let next = Infinity;
		for (let j = n - 1; j >= 0; j--) {
			if (changed(j)) next = j;
			if (next - j <= 6) len[j] = 1;
		}
		let prev = -Infinity;
		for (let j = 0; j < n; j++) {
			if (j - prev <= 3) len[j] = 1;
			if (changed(j)) prev = j;
		}
		/** For each move, the latest move up to it that changed an estimate (−1: none). */
		const last = new Int32Array(n);
		let l = -1;
		for (let j = 0; j < n; j++) {
			if (changed(j)) l = j;
			last[j] = l;
		}
		const cum = new Float64Array(n + 1);
		for (let j = 0; j < n; j++) cum[j + 1] = cum[j] + len[j];
		return { len, cum, last };
	});
	function toV(kk: number): number {
		if (!warp) return kk;
		const j = clamp(Math.floor(kk), 0, total);
		return j >= total ? warp.cum[total] : warp.cum[j] + (kk - j) * warp.len[j];
	}
	function fromV(v: number): number {
		if (!warp) return v;
		const c = warp.cum;
		if (v >= c[total]) return total;
		let lo = 0;
		let hi = total - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (c[mid] <= v) lo = mid;
			else hi = mid - 1;
		}
		return lo + (v - c[lo]) / warp.len[lo];
	}

	const k = $derived.by(() => {
		// Reduced motion: the end of the first episode (world), or the finished training.
		const done = phase === 'world' ? run.episodes[0].length - 0.001 : total;
		const v = reduced
			? playing
				? done
				: clamp(manual, 0, total)
			: fromV(
					position(t, {
						key: cfg.key,
						playing,
						pace: cfg.pace,
						manual: toV(manual),
						total: toV(total)
					})
				);
		if (playing) lastK = v;
		return v;
	});

	// Turning "Run by itself" off freezes the replay where it is (as in graph-search).
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.round(lastK));
			wasPlaying = now;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', cfg.key);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		lastK = clamp(Math.round(v), 0, total);
		if (playing && cfg.offered.has('play')) setParam('play', false);
		setPosition(v);
	}

	// ---- "Start again": react to a new press only -----------------------------------------
	let seenReset = untrack(() => Number(params.resetMap ?? 0));
	$effect(() => {
		const presses = Number(params.resetMap ?? 0);
		untrack(() => {
			if (presses > seenReset) setParam(cfg.mapKey, serializeWorld(cfg.preset));
			seenReset = presses;
		});
	});

	// ---- the frame ------------------------------------------------------------------------
	const i = $derived(Math.min(total, Math.floor(k)));
	const frac = $derived(i >= total ? 0 : k - i);
	/** The episode under way (E once training is over). */
	const ep = $derived(episodeAt(run, i));
	const q = $derived(qAt(run, i));
	const current = $derived(i < total ? run.moves[i] : null);
	const latest = $derived(i > 0 ? run.moves[i - 1] : null);
	/** Credit step: the latest move that changed an estimate, and how many moves ago it was. */
	const lastChange = $derived.by(() => {
		if (!warp || i === 0) return null;
		const j = warp.last[i - 1];
		return j < 0 ? null : { m: run.moves[j], ago: i - 1 - j };
	});
	/** Credit step, playing through a stretch where nothing changes. */
	const skipping = $derived(!!warp && playing && !reduced && i < total && warp.len[i] < 1);
	/** The previous move ended an episode: show its payoff popping up. */
	const ended = $derived(
		latest && isEnd(world, latest.next) && (current === null || ep !== episodeAt(run, i - 1))
			? latest
			: null
	);
	const movesIn = $derived(ep < E ? i - run.episodes[ep].first : 0);
	const fast = $derived(cfg.pace >= 100 && !reduced);

	const agent = $derived.by(() => {
		if (!current) return { x: cx(world.start), y: cy(world.start), dir: 1 };
		const u = easeInOut(frac);
		const [dc, dr] = MOVES[current.a];
		if (current.next === current.s) {
			// A bump into a wall or the edge: nudge towards it and back.
			const b = 0.22 * Math.sin(Math.PI * frac) * CS;
			return { x: cx(current.s) + dc * b, y: cy(current.s) + dr * b, dir: current.a };
		}
		return {
			x: cx(current.s) + (cx(current.next) - cx(current.s)) * u,
			y: cy(current.s) + (cy(current.next) - cy(current.s)) * u,
			dir: current.a
		};
	});

	// The trail of the episode under way (or of the one that just ended), last 60 moves.
	const trail = $derived.by(() => {
		if (phase !== 'world' && phase !== 'credit') return '';
		const e = movesIn === 0 && ep > 0 ? ep - 1 : ep;
		if (e >= E) return '';
		const first = run.episodes[e].first;
		const last = e === ep ? i : first + run.episodes[e].length;
		const from = Math.max(first, last - 60);
		if (last <= from) return '';
		const pts = [run.moves[from].s];
		for (let j = from; j < last; j++) {
			const n = run.moves[j].next;
			if (n !== pts[pts.length - 1]) pts.push(n);
		}
		let d = pts.map((p, j) => `${j ? 'L' : 'M'}${cx(p)} ${cy(p)}`).join('');
		if (e === ep && current && current.next !== current.s) d += `L${agent.x} ${agent.y}`;
		return d;
	});

	// ---- estimates as colour bands ------------------------------------------------------------
	const POS = 6;
	const NEG = 4;
	function band(v: number): number {
		if (v > 0.005) return Math.ceil(Math.sqrt(Math.min(1, v / 10)) * POS);
		if (v < -0.005) return -Math.ceil(Math.sqrt(Math.min(1, -v / 10)) * NEG);
		return 0;
	}
	// The faintest band starts further from the floor colour in dark mode, where a
	// light mix of green or red on near-black is hard to see.
	const lo = $derived(dark ? 48 : 30);
	const bandFill = (b: number) =>
		b > 0
			? `color-mix(in srgb, var(--rl-good) ${lo + (b - 1) * ((100 - lo) / 5)}%, var(--rl-floor))`
			: `color-mix(in srgb, var(--rl-bad) ${lo + (-b - 1) * ((100 - lo) / 3)}%, var(--rl-floor))`;
	function tri(s: number, a: number): string {
		const x = GX + colOf(s) * CS;
		const y = GY + rowOf(s) * CS;
		const m = `L${x + CS / 2} ${y + CS / 2}Z`;
		const o = 1.5;
		if (a === 0) return `M${x + o} ${y + o}L${x + CS - o} ${y + o}${m}`;
		if (a === 1) return `M${x + CS - o} ${y + o}L${x + CS - o} ${y + CS - o}${m}`;
		if (a === 2) return `M${x + CS - o} ${y + CS - o}L${x + o} ${y + CS - o}${m}`;
		return `M${x + o} ${y + CS - o}L${x + o} ${y + o}${m}`;
	}
	const bands = $derived.by(() => {
		const d: Record<number, string> = {};
		for (let s = 0; s < N; s++) {
			if (world.cells[s] === WALL || isEnd(world, s)) continue;
			for (let a = 0; a < 4; a++) {
				const b = band(q[s * 4 + a]);
				if (b !== 0) d[b] = (d[b] ?? '') + tri(s, a);
			}
		}
		return Object.entries(d).map(([b, path]) => ({ b: Number(b), d: path }));
	});

	/** Index of the best move in square s, or -1 if nothing positive has been learnt there. */
	function best(s: number): number {
		const v = bestValue(q, s);
		if (v <= 0.005) return -1;
		for (let a = 0; a < 4; a++) if (q[s * 4 + a] === v) return a;
		return -1;
	}
	const chevrons = $derived.by(() => {
		let d = '';
		for (let s = 0; s < N; s++) {
			if (world.cells[s] === WALL || isEnd(world, s)) continue;
			const a = best(s);
			if (a < 0) continue;
			const [dx, dy] = MOVES[a];
			const tipx = cx(s) + dx * 25;
			const tipy = cy(s) + dy * 25;
			const bx = cx(s) + dx * 18;
			const by = cy(s) + dy * 18;
			d += `M${bx - dy * 6} ${by + dx * 6}L${tipx} ${tipy}L${bx + dy * 6} ${by - dx * 6}`;
		}
		return d;
	});

	// Numbers (values step): the best estimate in each square, one <text> per row.
	const fmtV = (v: number) =>
		Math.abs(v) >= 9.95 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2);
	const numbers = $derived.by(() => {
		if (phase !== 'values') return [];
		const rows: { r: number; xs: string; s: string }[] = [];
		for (let r = 0; r < ROWS; r++) {
			const xs: number[] = [];
			let s = '';
			for (let c = 0; c < COLS; c++) {
				const cell = r * COLS + c;
				if (world.cells[cell] === WALL || isEnd(world, cell)) continue;
				const v = bestValue(q, cell);
				if (v <= 0.005) continue;
				const text = fmtV(v);
				const x0 = GX + c * CS + CS / 2;
				[...text].forEach((ch, j) => {
					xs.push(x0 + (j - (text.length - 1) / 2) * 6.4);
					s += ch;
				});
			}
			if (s) rows.push({ r, xs: xs.map((x) => x.toFixed(1)).join(' '), s });
		}
		return rows;
	});

	// The route the agent would take now: always its best-looking move.
	const route = $derived(greedyPath(world, q));
	const routeEnd = $derived(world.cells[route[route.length - 1]]);
	const routeOk = $derived(route.length > 1 && isEnd(world, route[route.length - 1]));
	const showRoute = $derived(phase === 'explore' || phase === 'paint');
	const routePath = $derived(
		routeOk
			? route
					.map((p, j) => {
						// The last leg stops at the edge of the ending square, clear of its label.
						const last = j === route.length - 1;
						const x = last ? (cx(p) + cx(route[j - 1])) / 2 : cx(p);
						const y = last ? (cy(p) + cy(route[j - 1])) / 2 : cy(p);
						return `${j ? 'L' : 'M'}${x} ${y}`;
					})
					.join('')
			: ''
	);

	// ---- hover, painting, the start marker, the keyboard cursor ------------------------------
	let hover = $state<number | null>(null);
	function onhover(event: PointerEvent) {
		hover = cellAt(toSvg(event, event.currentTarget as Element));
	}
	function write(next: World) {
		setParam(cfg.mapKey, serializeWorld(next));
	}
	const BRUSH: Record<string, Cell> = { wall: 1, reward: 2, small: 3, penalty: 4, floor: 0 };
	const brush = $derived<Cell>(BRUSH[String(params.brush ?? 'wall')] ?? WALL);

	/** The squares crossed going from a to b, 4-connected (as in graph-search). */
	function cellsBetween(a: number, b: number): number[] {
		const out: number[] = [];
		let c = colOf(a);
		let r = rowOf(a);
		const dc = Math.abs(colOf(b) - c);
		const dr = Math.abs(rowOf(b) - r);
		const sc = Math.sign(colOf(b) - c);
		const sr = Math.sign(rowOf(b) - r);
		let mc = 0;
		let mr = 0;
		for (let s = 0; s < dc + dr; s++) {
			if (mr >= dr || (mc < dc && (mc + 0.5) * dr < (mr + 0.5) * dc)) {
				c += sc;
				mc++;
			} else {
				r += sr;
				mr++;
			}
			out.push(r * COLS + c);
		}
		return out;
	}
	function onpaintdown(event: PointerEvent) {
		if (!canPaint) return;
		const w = world;
		const work = w.cells.slice();
		let last: number | null = null;
		let value: Cell | null = null;
		startDrag(event, (p) => {
			const at = cellAt(p);
			if (at === null) return;
			if (value === null) value = work[at] === brush ? 0 : brush;
			const todo = last === null ? [at] : cellsBetween(last, at);
			last = at;
			let changed = false;
			for (const c of todo) {
				if (c === w.start || work[c] === value) continue;
				work[c] = value;
				changed = true;
			}
			if (changed) write({ ...w, cells: work.slice() });
		});
	}
	const DIRS: Record<string, [number, number]> = {
		ArrowUp: [0, -1],
		ArrowDown: [0, 1],
		ArrowLeft: [-1, 0],
		ArrowRight: [1, 0]
	};
	function nextCell(from: number, key: string, ok: (i: number) => boolean): number | null {
		const d = DIRS[key];
		let c = colOf(from);
		let r = rowOf(from);
		for (;;) {
			c += d[0];
			r += d[1];
			if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
			const j = r * COLS + c;
			if (ok(j)) return j;
		}
	}
	const canStart = (j: number) => world.cells[j] === 0;
	function moveStart(at: number | null) {
		if (at === null || at === world.start || !canStart(at)) return;
		write({ ...world, start: at });
	}
	function startKey(event: KeyboardEvent) {
		if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
		if (!DIRS[event.key]) return;
		event.preventDefault();
		moveStart(nextCell(world.start, event.key, canStart));
	}
	let cursor = $state(0);
	$effect(() => {
		void step.id;
		const s = untrack(() => world.start);
		untrack(() => (cursor = colOf(s) < COLS - 1 ? s + 1 : s - 1));
	});
	function cursorKey(event: KeyboardEvent) {
		if (DIRS[event.key]) {
			event.preventDefault();
			cursor = nextCell(cursor, event.key, () => true) ?? cursor;
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (cursor === world.start) return;
			const cells = world.cells.slice();
			cells[cursor] = cells[cursor] === brush ? 0 : brush;
			write({ ...world, cells });
		}
	}
	const KIND = ['open floor', 'wall', 'reward +10', 'small reward +1', 'pit −10'];
	const where = (j: number) => `column ${colOf(j) + 1}, row ${rowOf(j) + 1}`;
	const describe = (j: number) =>
		`${where(j)}: ${j === world.start ? 'the start' : KIND[world.cells[j]]}`;

	// ---- words ------------------------------------------------------------------------------
	const sq = (j: number) => `(${colOf(j) + 1}, ${rowOf(j) + 1})`;
	const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2));
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
	const sup = (n: number) => [...String(n)].map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('');
	const eps = $derived(epsilonAt(cfg.settings, Math.min(ep, E - 1)));
	const unsure = (s: number) => {
		const v = q[s * 4];
		return q[s * 4 + 1] === v && q[s * 4 + 2] === v && q[s * 4 + 3] === v;
	};
	const happening = $derived.by(() => {
		if (!current) return 'Training over: 300 episodes';
		if (fast) return `Fast-forward: ${cfg.pace} moves a second`;
		if (skipping) return 'Skipping ahead to the next move that changes an estimate…';
		const name = MOVE_NAMES[current.a];
		const kind = world.cells[current.next];
		const why = current.explored
			? `random move ${name} (exploring)`
			: unsure(current.s)
				? `no idea yet: a guess, ${name}`
				: `best-looking move: ${name}`;
		if (kind === REWARD) return `${why} → the reward, +10!`;
		if (kind === SMALL) return `${why} → the small reward, +1`;
		if (kind === PENALTY) return `${why} → into a pit, −10`;
		if (current.next === current.s)
			return `${why} → bumped into ${world.cells[move1(current)] === WALL ? 'a wall' : 'the edge'}`;
		return why;
	});
	function move1(m: { s: number; a: number }): number {
		const c = colOf(m.s) + MOVES[m.a][0];
		const r = rowOf(m.s) + MOVES[m.a][1];
		if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return m.s;
		return r * COLS + c;
	}
	// Episodes finished (the one under way counts once its last move is half made).
	const done = $derived(
		Math.min(E, ep + (current && isEnd(world, current.next) && frac >= 0.5 ? 1 : 0))
	);
	const title = $derived(
		current ? `Episode ${ep + 1} of ${E} · move ${movesIn + 1}` : `${E} episodes, ${total} moves`
	);
	const stat = $derived.by(() => {
		const s = cfg.settings;
		if (phase === 'credit') return `learning rate α = ${s.alpha.toFixed(2)}`;
		if (phase === 'values') return `discount factor γ = ${s.gamma.toFixed(2)}`;
		if (phase === 'explore')
			return `random moves: ${pct(eps)}${s.decay ? ` (from ${pct(s.epsilon)}, falling)` : ''}`;
		if (phase === 'paint')
			return `α ${s.alpha.toFixed(2)} · γ ${s.gamma.toFixed(2)} · random ${pct(eps)}`;
		return `${tally.big[done]} at the reward · ${tally.pit[done]} in a pit`;
	});

	// Average reward per episode over the last (up to) 50 finished episodes.
	const recent = $derived.by(() => {
		const from = Math.max(0, done - 50);
		const n = done - from;
		return n > 0 ? (tally.reward[done] - tally.reward[from]) / n : null;
	});
	const routeWords = $derived(
		!routeOk
			? 'nowhere yet'
			: routeEnd === REWARD
				? `the +10, in ${plural(route.length - 1, 'move')}`
				: routeEnd === SMALL
					? `the +1, in ${plural(route.length - 1, 'move')}`
					: `a pit, in ${plural(route.length - 1, 'move')}`
	);
	const hasSmall = $derived(world.cells.includes(SMALL));

	// ---- the episode bar ----------------------------------------------------------------------
	const TL0 = 96;
	const TL1 = 864;
	const TLY = 552;
	const SB = 524;
	const SH = 52;
	const ex = (e: number) => TL0 + ((TL1 - TL0) * e) / Math.max(1, E);
	const ly = (n: number) => SB - (Math.log(Math.max(1, n)) / Math.log(400)) * SH;
	const tlx = $derived(
		ep >= E ? TL1 : ex(ep + (run.episodes[ep].length ? movesIn / run.episodes[ep].length : 0))
	);
	const spark = $derived.by(() => {
		const upto = Math.min(E, ep + 1);
		let d = '';
		for (let e = 0; e < upto; e++) {
			const n = e === ep ? movesIn : run.episodes[e].length;
			if (e === ep && n === 0) break;
			d += `${d ? 'L' : 'M'}${(ex(e) + ex(e + 1)) / 2} ${ly(n).toFixed(1)}`;
		}
		return d;
	});
	const head = $derived(
		ep < E && movesIn > 0 ? { x: (ex(ep) + ex(ep + 1)) / 2, y: ly(movesIn) } : null
	);
	function onmove(p: Point) {
		const e = Math.floor(((p.x - TL0) / (TL1 - TL0)) * E);
		scrubTo(e >= E ? total : run.episodes[Math.max(0, e)].first);
	}
	function onkey(s: number | 'start' | 'end') {
		if (s === 'start') return scrubTo(0);
		if (s === 'end') return scrubTo(total);
		const base = playing ? Math.round(lastK) : Math.round(manual);
		const e = episodeAt(run, clamp(base, 0, total));
		// Within an episode, the left arrow goes back to its start first.
		const at = e < E ? run.episodes[e].first : total;
		const target = s < 0 && base > at ? e + s + 1 : e + s;
		scrubTo(target >= E ? total : run.episodes[clamp(target, 0, E - 1)].first);
	}
	const barText = $derived(
		`${current ? `Episode ${ep + 1} of ${E}` : 'All episodes done'}${playing && !reduced ? '' : ' · drag or use ← → to pick an episode'}`
	);

	const LEGEND = [
		{ k: REWARD, l: 'reward +10', f: 'var(--rl-reward)' },
		{ k: SMALL, l: 'small reward +1', f: 'var(--rl-small)' },
		{ k: PENALTY, l: 'pit −10: the episode ends', f: 'var(--rl-pit)' },
		{ k: WALL, l: 'wall', f: 'var(--rl-wall)' }
	];
	/** The legend lists what is on the map (the reward always, so the agent's goal is named). */
	const legend = $derived(
		LEGEND.filter((item) => item.k === REWARD || world.cells.includes(item.k as Cell))
	);
	const ly0 = $derived(GY + 50 + legend.length * 28);
	const terminalLabel = (c: Cell) => (c === REWARD ? '+10' : c === SMALL ? '+1' : '−10');
	const terminalFill = (c: Cell) =>
		c === REWARD ? 'var(--rl-reward)' : c === SMALL ? 'var(--rl-small)' : 'var(--rl-pit)';
	const SCALE = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
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
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet scale(y: number)}
	{@render txt(PX + 20, y, 'Estimates: four per square, one per move', 12, { muted: true })}
	{#each SCALE as b, j (b)}
		<rect
			x={PX + 20 + j * 28.8}
			y={y + 10}
			width="28.8"
			height="12"
			style:fill={bandFill(b)}
			stroke="var(--stage-grid)"
			stroke-width="0.5"
		/>
	{/each}
	{@render txt(PX + 20, y + 38, '−10', 11, { muted: true })}
	{@render txt(PX + 20 + 4 * 28.8, y + 38, '0', 11, { muted: true, anchor: 'middle' })}
	{@render txt(PX + PW - 20, y + 38, '+10', 11, { muted: true, anchor: 'end' })}
{/snippet}

<g>
	<!-- readout card -->
	<rect
		x="16"
		y="16"
		width="928"
		height="76"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(36, 45, title, 17, { weight: 600 })}
	{@render txt(924, 45, stat, 14, { anchor: 'end', weight: 600 })}
	{@render txt(36, 75, happening, 14, {
		color: current?.explored && !fast ? 'var(--rl-explore)' : undefined,
		muted: !current?.explored || fast
	})}

	<!-- the squares -->
	{#each world.cells as c, j (j)}
		<rect
			x={GX + colOf(j) * CS}
			y={GY + rowOf(j) * CS}
			width={CS}
			height={CS}
			style:fill={c === WALL ? 'var(--rl-wall)' : c === 0 ? 'var(--rl-floor)' : terminalFill(c)}
			stroke="var(--stage-grid)"
		/>
	{/each}
	{#each bands as b (b.b)}
		<path d={b.d} style:fill={bandFill(b.b)} />
	{/each}
	<path
		d={chevrons}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		opacity="0.7"
	/>
	{#each numbers as n (n.r)}
		<text
			x={n.xs}
			y={GY + n.r * CS + CS / 2 + 4}
			text-anchor="middle"
			font-weight="600"
			class="halo"
			style:font-size="11px"
			style:font-variant-numeric="tabular-nums">{n.s}</text
		>
	{/each}
	{#each world.cells as c, j (j)}
		{#if c >= 2}
			<text
				x={cx(j)}
				y={cy(j) + 5}
				text-anchor="middle"
				font-weight="700"
				style:font-size="15px"
				style:fill={c === SMALL ? 'var(--rl-on-small)' : 'var(--rl-on-cell)'}
				>{terminalLabel(c)}</text
			>
		{/if}
	{/each}
	<rect x={GX} y={GY} width={GW} height={GH} fill="none" stroke="var(--stage-line)" rx="2" />

	<!-- the latest update (credit step) -->
	{#if phase === 'credit' && latest && !fast}
		<path
			d={tri(latest.s, latest.a)}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- the learnt route, the trail, the agent -->
	{#if showRoute && routePath}
		<path
			d={routePath}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-dasharray="1 7"
			opacity="0.75"
		/>
	{/if}
	{#if trail}
		<path
			d={trail}
			fill="none"
			stroke="var(--rl-agent)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={dark ? 0.55 : 0.35}
		/>
	{/if}
	<!-- S: the start square -->
	<rect
		x={GX + colOf(world.start) * CS + 3}
		y={GY + rowOf(world.start) * CS + 3}
		width={CS - 6}
		height={CS - 6}
		rx="6"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-dasharray="4 3"
		opacity="0.7"
	/>
	<text
		x={GX + colOf(world.start) * CS + 8}
		y={GY + rowOf(world.start) * CS + 18}
		font-weight="700"
		style:font-size="13px">S</text
	>
	{#if ended && current && !fast}
		{@render txt(
			cx(ended.next),
			cy(ended.next) - 40 - frac * 14,
			ended.r > 0 ? `+${ended.r}` : `−${-ended.r}`,
			18,
			{
				anchor: 'middle',
				weight: 700,
				color: ended.r > 0 ? 'var(--rl-good)' : 'var(--rl-bad)',
				opacity: 1 - frac * frac
			}
		)}
	{/if}
	<g transform="translate({agent.x} {agent.y})" style="pointer-events: none">
		{#if current?.explored && !fast}
			<circle r="17" fill="none" stroke="var(--rl-explore)" stroke-width="2.5" />
		{/if}
		<circle r="12" fill="var(--rl-agent)" stroke="var(--stage-bg)" stroke-width="2" />
		<circle
			cx={MOVES[agent.dir][0] * 5 - MOVES[agent.dir][1] * 4}
			cy={MOVES[agent.dir][1] * 5 - MOVES[agent.dir][0] * 4}
			r="2.4"
			fill="var(--stage-bg)"
		/>
		<circle
			cx={MOVES[agent.dir][0] * 5 + MOVES[agent.dir][1] * 4}
			cy={MOVES[agent.dir][1] * 5 + MOVES[agent.dir][0] * 4}
			r="2.4"
			fill="var(--stage-bg)"
		/>
	</g>

	{#if hover !== null}
		<rect
			x={GX + colOf(hover) * CS + 0.5}
			y={GY + rowOf(hover) * CS + 0.5}
			width={CS - 1}
			height={CS - 1}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- painting and hovering -->
	<rect
		x={GX}
		y={GY}
		width={GW}
		height={GH}
		fill="transparent"
		class="paint"
		class:can={canPaint}
		role="presentation"
		onpointerdown={onpaintdown}
		onpointermove={onhover}
		onpointerleave={() => (hover = null)}
	/>
	{#if canPaint}
		<!-- the start marker: drag it, or Tab to it and use the arrow keys -->
		<g
			class="start"
			role="button"
			tabindex="0"
			aria-label="Start (S), at {where(world.start)}. Drag it, or use the arrow keys to move it"
			onpointerdown={(e) => startDrag(e, (p) => moveStart(cellAt(p)))}
			onkeydown={startKey}
		>
			<rect
				x={GX + colOf(world.start) * CS}
				y={GY + rowOf(world.start) * CS}
				width={CS}
				height={CS}
				rx="6"
				fill="transparent"
			/>
			<rect
				class="ring"
				x={GX + colOf(world.start) * CS}
				y={GY + rowOf(world.start) * CS}
				width={CS}
				height={CS}
				rx="6"
				fill="none"
				stroke="var(--focus)"
				stroke-width="3"
			/>
		</g>
		<g
			class="cursor"
			role="button"
			tabindex="0"
			aria-label="Map editor: arrow keys move the cursor, Space paints. Cursor at {describe(
				cursor
			)}"
			onkeydown={cursorKey}
		>
			<rect
				x={GX + colOf(cursor) * CS - 1}
				y={GY + rowOf(cursor) * CS - 1}
				width={CS + 2}
				height={CS + 2}
				rx="4"
				fill="none"
				stroke="var(--focus)"
				stroke-width="3"
			/>
		</g>
	{/if}

	<!-- the side panel -->
	<rect x={PX} y={GY} width={PW} height={GH} rx="10" fill="var(--surface)" stroke="var(--border)" />
	{#if hover !== null && world.cells[hover] !== WALL && !isEnd(world, hover)}
		{@const h = hover}
		{@render txt(
			PX + 20,
			GY + 32,
			`Square ${sq(h)}${h === world.start ? ' — the start' : ''}`,
			15,
			{
				weight: 600
			}
		)}
		{@render txt(PX + 20, GY + 54, 'what the agent expects from each move', 12, { muted: true })}
		{#each [0, 1, 2, 3] as a (a)}
			{@const ox = PX + PW / 2 + MOVES[a][0] * 78}
			{@const oy = GY + 150 + MOVES[a][1] * 56}
			<rect
				x={ox - 38}
				y={oy - 20}
				width="76"
				height="40"
				rx="6"
				style:fill={band(q[h * 4 + a]) === 0 ? 'var(--rl-floor)' : bandFill(band(q[h * 4 + a]))}
				stroke={best(h) === a ? 'var(--stage-ink)' : 'var(--stage-grid)'}
				stroke-width={best(h) === a ? 2 : 1}
			/>
			{@render txt(ox, oy - 4, MOVE_NAMES[a], 11, { anchor: 'middle', muted: true })}
			{@render txt(ox, oy + 13, f2(q[h * 4 + a]), 14, { anchor: 'middle', weight: 600 })}
		{/each}
		{@render txt(PX + PW / 2, GY + 154, '●', 14, { anchor: 'middle', color: 'var(--rl-agent)' })}
		{@render txt(PX + 20, GY + 290, 'Each number is the reward it expects in the end,', 12, {
			muted: true
		})}
		{@render txt(PX + 20, GY + 308, 'discounted by how many moves away it is.', 12, {
			muted: true
		})}
	{:else if phase === 'credit'}
		{@render txt(PX + 20, GY + 32, 'The latest change', 15, { weight: 600 })}
		{#if lastChange && !fast}
			{@const u = lastChange.m}
			{@render txt(
				PX + PW - 20,
				GY + 32,
				lastChange.ago === 0 ? 'just now' : `${plural(lastChange.ago, 'move')} ago`,
				12,
				{ muted: true, anchor: 'end' }
			)}
			{@const target = u.r + cfg.settings.gamma * u.bestNext}
			{@render txt(
				PX + 20,
				GY + 56,
				`square ${sq(u.s)}, move ${MOVE_NAMES[u.a]}${u.explored ? ' (random)' : ''}`,
				13,
				{ muted: true }
			)}
			{@render txt(PX + 20, GY + 86, `reward for this move: ${u.r}`, 13)}
			{@render txt(PX + 20, GY + 108, `best estimate where it landed: ${f2(u.bestNext)}`, 13)}
			{@render txt(
				PX + 20,
				GY + 134,
				`target = ${u.r} + ${cfg.settings.gamma.toFixed(2)} × ${f2(u.bestNext)} = ${f2(target)}`,
				13,
				{ weight: 600 }
			)}
			{@render txt(
				PX + 20,
				GY + 160,
				`old ${f2(u.before)} + ${cfg.settings.alpha.toFixed(2)} × (${f2(target)} − ${f2(u.before)})`,
				13
			)}
			{@render txt(PX + 20, GY + 188, `estimate: ${f2(u.before)} → ${f2(u.after)}`, 16, {
				weight: 700,
				color:
					u.after > u.before + 0.005
						? 'var(--rl-good)'
						: u.after < u.before - 0.005
							? 'var(--rl-bad)'
							: undefined
			})}
		{:else}
			{@render txt(
				PX + 20,
				GY + 60,
				fast ? 'Too fast to follow: slow down to read' : 'Nothing has changed yet: every move so',
				13,
				{ muted: true }
			)}
			{@render txt(
				PX + 20,
				GY + 80,
				fast ? 'each update.' : 'far paid 0 and led to a square worth 0.',
				13,
				{ muted: true }
			)}
		{/if}
		{@render scale(GY + 250)}
	{:else if phase === 'values'}
		{@render txt(PX + 20, GY + 32, 'What S is worth', 15, { weight: 600 })}
		{@render txt(PX + 20, GY + 64, `learnt so far: ${f2(bestValue(q, world.start))}`, 14)}
		{#if exact && shortest !== null}
			{@render txt(PX + 20, GY + 90, `exact: ${f2(bestValue(exact, world.start))}`, 14, {
				weight: 600
			})}
			{@render txt(
				PX + 20,
				GY + 112,
				`the +10 is ${shortest} moves away: 10 × ${cfg.settings.gamma.toFixed(2)}${sup(shortest - 1)}`,
				12,
				{ muted: true }
			)}
		{/if}
		{@render txt(PX + 20, GY + 150, 'Numbers: the best estimate in each square.', 12, {
			muted: true
		})}
		{@render txt(PX + 20, GY + 168, 'Arrows: the best move in each square;', 12, { muted: true })}
		{@render txt(PX + 20, GY + 186, 'follow them from S to reach the reward.', 12, { muted: true })}
		{@render scale(GY + 250)}
	{:else if phase === 'explore' || phase === 'paint'}
		{@render txt(PX + 20, GY + 32, 'How it is doing', 15, { weight: 600 })}
		{@render txt(PX + 20, GY + 60, 'Following its best moves, from S it goes to', 12, {
			muted: true
		})}
		{@render txt(PX + 20, GY + 82, routeWords, 15, {
			weight: 700,
			color: routeOk
				? routeEnd === REWARD
					? 'var(--rl-good)'
					: routeEnd === PENALTY
						? 'var(--rl-bad)'
						: undefined
				: undefined
		})}
		{@render txt(PX + 20, GY + 114, 'Average reward per episode, last 50:', 12, { muted: true })}
		{@render txt(PX + 20, GY + 136, recent === null ? '—' : recent.toFixed(2), 15, {
			weight: 700
		})}
		{@render txt(
			PX + 20,
			GY + 168,
			`Episodes ended at +10: ${tally.big[done]}${hasSmall ? ` · at +1: ${tally.small[done]}` : ''}`,
			12,
			{ muted: true }
		)}
		{@render txt(
			PX + 20,
			GY + 186,
			`in a pit: ${tally.pit[done]} · cut off after 400 moves: ${tally.cut[done]}`,
			12,
			{ muted: true }
		)}
		{@render txt(PX + 20, GY + 216, 'Point at a square to see its estimates.', 12, { muted: true })}
		{@render scale(GY + 250)}
	{:else}
		{@render txt(PX + 20, GY + 32, 'The world', 15, { weight: 600 })}
		{#each legend as item, j (item.l)}
			<rect
				x={PX + 20}
				y={GY + 50 + j * 28}
				width="18"
				height="18"
				rx="3"
				style:fill={item.f}
				stroke="var(--stage-line)"
			/>
			{@render txt(PX + 48, GY + 64 + j * 28, item.l, 13)}
		{/each}
		<circle cx={PX + 29} cy={ly0 + 9} r="9" fill="var(--rl-agent)" />
		{@render txt(PX + 48, ly0 + 14, 'the agent; S: where it starts', 13)}
		{@render txt(PX + 20, ly0 + 52, 'Moves: up, down, left or right.', 12, { muted: true })}
		{@render txt(PX + 20, ly0 + 70, 'Into a wall or the edge: it stays put.', 12, { muted: true })}
		{@render txt(PX + 20, ly0 + 114, 'Episodes so far', 12, { muted: true })}
		{@render txt(
			PX + 20,
			ly0 + 138,
			`${hasSmall ? `${tally.big[done]} at the +10 · ${tally.small[done]} at the +1` : `${tally.big[done]} reached the reward`} · ${tally.pit[done]} ${hasSmall ? 'in a pit' : 'fell in a pit'}${tally.cut[done] ? ` · ${tally.cut[done]} cut off` : ''}`,
			13,
			{ weight: 600 }
		)}
	{/if}

	<!-- the episode bar, with the moves each episode took -->
	{@render txt(TL0 - 12, SB - SH + 4, '400', 10, { anchor: 'end', muted: true })}
	{@render txt(TL0 - 12, SB + 4, '1', 10, { anchor: 'end', muted: true })}
	{@render txt(TL0 - 30, SB - SH / 2 + 4, 'moves', 11, {
		anchor: 'end',
		muted: true
	})}
	<line x1={TL0} x2={TL1} y1={SB} y2={SB} stroke="var(--stage-grid)" />
	{#if shortest !== null}
		<line
			x1={TL0}
			x2={TL1}
			y1={ly(shortest)}
			y2={ly(shortest)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.7"
		/>
		{@render txt(TL1 + 10, ly(shortest) + 4, `shortest: ${shortest}`, 11, { muted: true })}
	{/if}
	{#if spark}
		<path
			d={spark}
			fill="none"
			stroke="var(--rl-agent)"
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
	{/if}
	{#if head}
		<circle cx={head.x} cy={head.y} r="2.5" fill="var(--rl-agent)" />
	{/if}
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
	{@render txt(TL0 - 12, TLY + 4, 'episode 1', 11, { anchor: 'end', muted: true })}
	{@render txt(TL1 + 10, TLY + 4, `${E}`, 11, { muted: true })}
	{@render txt((TL0 + TL1) / 2, TLY + 30, barText, 12, { anchor: 'middle', muted: true })}
	<Handle
		x={tlx}
		y={TLY}
		r={8}
		label="Episode"
		value={Math.min(ep + 1, E)}
		min={1}
		max={E}
		valuetext={barText}
		{onmove}
		{onkey}
	/>
</g>

<style>
	.paint.can {
		cursor: crosshair;
		touch-action: none;
	}
	.start {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.start .ring,
	.cursor rect {
		opacity: 0;
	}
	.start:focus-visible .ring,
	.cursor:focus-visible rect {
		opacity: 1;
	}
	.cursor {
		outline: none;
		pointer-events: none;
	}
</style>
