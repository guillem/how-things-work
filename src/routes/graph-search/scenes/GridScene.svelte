<script lang="ts">
	/**
	 * The editable grid map, searched by breadth-first search, Dijkstra's
	 * algorithm or A* and replayed one expanded square at a time.
	 *
	 * The search is recorded once (`search` in ../search.ts) whenever the map,
	 * the algorithm or the estimate weight changes, and replayed with the
	 * sorting topic's `createPlayback`: position k means "k squares expanded";
	 * after the last expansion, a few more positions trace the route back from
	 * G to S, one square each. The replay then holds on the finished search.
	 *
	 * Drawing budget: ONE rect per cell, whose fill says everything about the
	 * cell (ground, mud, wall, visited shaded by its cost so far, frontier); mud
	 * texture, frontier outlines and routes are one path each. Dijkstra's cost
	 * numbers use one <text> per row and per colour, each glyph placed with its
	 * own x (every absolutely placed glyph is its own text chunk, so
	 * `text-anchor: middle` centres each digit on its x).
	 *
	 * Editing: the reader's map lives in `params['map:' + step.id]` as
	 * `serializeGrid`. Click or drag on the map to paint with `params.brush`
	 * (a drag paints every square it crosses; starting on a square that already
	 * has the brush's terrain clears instead); S and G can be dragged or moved
	 * with the arrow keys; the map cursor (Tab to it) moves with the arrow keys
	 * and paints with Space or Enter. Painting is only offered where the step
	 * offers the brush (not on `estimate`); S and G move on every step.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, startDrag, toSvg, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '../../sorting/playback';
	import {
		PRESETS,
		cellCost,
		manhattan,
		parseGrid,
		search,
		serializeGrid,
		type Algorithm,
		type Cell,
		type Grid
	} from '../search';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- the map ------------------------------------------------------------------
	const COLS = 22;
	const ROWS = 11;
	const CS = 36;
	const GX = 84;
	const GY = 110;
	const GW = COLS * CS;
	const GH = ROWS * CS;
	const N = COLS * ROWS;

	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const mapKey = $derived('map:' + step.id);
	const preset = $derived(PRESETS[String(step.hints?.map ?? 'open')] ?? PRESETS.open);
	const grid = $derived.by<Grid>(() => {
		const g = parseGrid(params[mapKey]);
		return g && g.cols === COLS && g.rows === ROWS ? g : preset;
	});
	const serial = $derived(serializeGrid(grid));
	const algoHint = $derived(String(step.hints?.algo ?? 'none'));
	const algo = $derived<Algorithm | null>(
		algoHint === 'bfs' || algoHint === 'dijkstra' || algoHint === 'astar' ? algoHint : null
	);
	const phase = $derived(String(step.hints?.phase ?? ''));
	const canPaint = $derived(offered.has('brush'));
	const brush = $derived<Cell>(params.brush === 'mud' ? 1 : params.brush === 'ground' ? 0 : 2);
	const weight = $derived(offered.has('estimate') ? Number(params.estimate ?? 1) : 1);
	const pace = $derived(offered.has('pace') ? Number(params.pace ?? 24) : 24);
	const playing = $derived(!offered.has('play') || params.play !== false);

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

	// ---- the search, recorded once per map / algorithm / weight -----------------------
	const result = $derived(algo ? search(grid, algo, weight) : null);
	// The cheapest route, for comparison (the marsh, and an over-trusted estimate).
	const cheapest = $derived(
		algo && (phase === 'mud' || phase === 'estimate') ? search(grid, 'dijkstra') : null
	);

	/**
	 * Per cell: the step at which it was expanded and first found, the history
	 * of its cost so far (Dijkstra and A* can lower it while it waits on the
	 * frontier), and — for breadth-first search — its number of steps from the
	 * start (its ring).
	 */
	const timeline = $derived.by(() => {
		const expandedAt = new Array<number>(N).fill(Infinity);
		const foundAt = new Array<number>(N).fill(Infinity);
		const adds: { s: number; g: number }[][] = Array.from({ length: N }, () => []);
		const depth = new Array<number>(N).fill(0);
		if (!result) return { expandedAt, foundAt, adds, depth, vmax: 1 };
		foundAt[grid.start] = -1;
		adds[grid.start].push({ s: -1, g: 0 });
		result.steps.forEach((st, s) => {
			expandedAt[st.current] = s;
			for (const a of st.added) {
				if (foundAt[a] === Infinity) foundAt[a] = s;
				depth[a] = depth[st.current] + 1;
				adds[a].push({ s, g: result.dist[st.current] + cellCost(grid.cells[a]) });
			}
		});
		let vmax = 1;
		for (const c of result.order) {
			vmax = Math.max(vmax, result.algorithm === 'bfs' ? depth[c] : result.dist[c]);
		}
		return { expandedAt, foundAt, adds, depth, vmax };
	});

	const nSteps = $derived(result?.steps.length ?? 0);
	const route = $derived(result?.path ?? []);
	const total = $derived(nSteps + route.length);
	const runKey = $derived(`${step.id}|${algo}|${weight}|${serial}`);

	// ---- playback (as in the sorting topic's BarsScene) ------------------------------
	const position = createPlayback();
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	// The last position shown, kept for the freeze below (set here rather than
	// in an effect: effects must not read anything that changes every frame).
	let lastK = 0;
	const k = $derived.by(() => {
		if (!result) return 0;
		// Reduced motion: the finished search, unless the reader is stepping through it.
		const v = reduced
			? playing
				? total
				: clamp(manual, 0, total)
			: position(t, { key: runKey, playing, pace, manual, total });
		if (playing) lastK = v;
		return v;
	});

	// Turning "Run by itself" off freezes the replay where it is (see BarsScene).
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.round(lastK));
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

	// ---- "Start again": react to a new press only -------------------------------------
	let seenReset = untrack(() => Number(params.resetMap ?? 0));
	$effect(() => {
		const presses = Number(params.resetMap ?? 0);
		untrack(() => {
			if (presses > seenReset) setParam(mapKey, serializeGrid(preset));
			seenReset = presses;
		});
	});

	// ---- the frame ---------------------------------------------------------------------
	const index = $derived(Math.min(nSteps, Math.floor(k)));
	const traced = $derived(clamp(Math.floor(k) - nSteps, 0, route.length));
	const finished = $derived(!!result && k >= total);
	const current = $derived(index > 0 && result ? result.steps[index - 1].current : -1);

	/** The cost so far of a cell as known after `index` expansions (Infinity if not found). */
	function gAt(c: number): number {
		let g = Infinity;
		for (const a of timeline.adds[c]) if (a.s < index) g = a.g;
		return g;
	}
	type State = 'none' | 'frontier' | 'visited';
	const stateOf = (c: number): State =>
		!result
			? 'none'
			: timeline.expandedAt[c] < index
				? 'visited'
				: timeline.foundAt[c] < index
					? 'frontier'
					: 'none';

	const BANDS = 8;
	/**
	 * 0–100: how far towards `--gs-visited-far` a visited cell is: by steps for
	 * breadth-first search (its rings), by cost so far otherwise. In bands, so the
	 * rings read as rings.
	 */
	function shadeOf(c: number): number {
		const v = algo === 'bfs' ? timeline.depth[c] : (result?.dist[c] ?? 0);
		const size = Math.max(1, Math.ceil(timeline.vmax / BANDS));
		const top = Math.max(1, Math.floor(timeline.vmax / size));
		return (Math.min(top, Math.floor(v / size)) * 100) / top;
	}

	const cells = $derived.by(() => {
		const out: { i: number; fill: string; wall: boolean }[] = [];
		for (let i = 0; i < N; i++) {
			const kind = grid.cells[i];
			let fill = kind === 2 ? 'var(--gs-wall)' : kind === 1 ? 'var(--gs-mud)' : 'var(--gs-ground)';
			if (kind !== 2) {
				const s = stateOf(i);
				if (s === 'visited') {
					const shade = `color-mix(in srgb, var(--gs-visited-far) ${shadeOf(i).toFixed(0)}%, var(--gs-visited))`;
					fill = kind === 1 ? `color-mix(in srgb, ${shade} 55%, var(--gs-mud))` : shade;
				} else if (s === 'frontier') {
					fill = `color-mix(in srgb, var(--gs-frontier) ${kind === 1 ? 45 : dark ? 40 : 60}%, ${fill})`;
				}
			}
			out.push({ i, fill, wall: kind === 2 });
		}
		return out;
	});

	const frontier = $derived.by(() => {
		const f: number[] = [];
		if (!result) return f;
		for (let i = 0; i < N; i++) if (stateOf(i) === 'frontier') f.push(i);
		return f;
	});
	const frontierPath = $derived(
		frontier
			.map((i) => {
				const x = GX + colOf(i) * CS + 2;
				const y = GY + rowOf(i) * CS + 2;
				return `M${x} ${y}h${CS - 4}v${CS - 4}h${4 - CS}Z`;
			})
			.join('')
	);
	const mudPath = $derived(
		grid.cells
			.map((c, i) => {
				if (c !== 1) return '';
				const x = GX + colOf(i) * CS;
				const y = GY + rowOf(i) * CS;
				return `M${x + 7} ${y + 23}q4 -4 8 0t8 0t8 0M${x + 11} ${y + 30}q4 -4 8 0t8 0`;
			})
			.join('')
	);
	const linePath = (cs: number[]) => cs.map((c, j) => `${j ? 'L' : 'M'}${cx(c)} ${cy(c)}`).join('');
	// The route is traced back from the goal: the last `traced` cells of the path.
	const routePath = $derived(traced > 1 ? linePath(route.slice(route.length - traced)) : '');
	const showCheapest = $derived(
		finished && !!cheapest && !!result && cheapest.path.length > 0 && cheapest.cost < result.cost
	);

	// Dijkstra: the cost so far written in each square found (one <text> per row and colour).
	const numbers = $derived.by(() => {
		if (algo !== 'dijkstra' || !result) return [];
		const rows: { key: string; y: number; xs: string; s: string; color: string }[] = [];
		for (let r = 0; r < ROWS; r++) {
			const groups: Record<string, { xs: number[]; s: string }> = {
				ink: { xs: [], s: '' },
				bg: { xs: [], s: '' }
			};
			for (let c = 0; c < COLS; c++) {
				const i = r * COLS + c;
				const st = stateOf(i);
				if (st === 'none' || i === grid.start) continue;
				const g = st === 'visited' ? result.dist[i] : gAt(i);
				if (!isFinite(g)) continue;
				const text = String(g);
				const onDark = st === 'visited' && shadeOf(i) > 50 && grid.cells[i] !== 1;
				const grp = groups[onDark ? 'bg' : 'ink'];
				const x0 = GX + c * CS + 11;
				[...text].forEach((ch, j) => {
					grp.xs.push(x0 + (j - (text.length - 1) / 2) * 6);
					grp.s += ch;
				});
			}
			for (const [name, grp] of Object.entries(groups)) {
				if (grp.s)
					rows.push({
						key: `${r}-${name}`,
						y: GY + r * CS + 14,
						xs: grp.xs.map((x) => x.toFixed(1)).join(' '),
						s: grp.s,
						color: name === 'bg' ? 'var(--stage-bg)' : 'var(--stage-ink)'
					});
			}
		}
		return rows;
	});

	// ---- hover (pointer over the map) ----------------------------------------------------
	let hover = $state<number | null>(null);

	// ---- editing ---------------------------------------------------------------------------
	function write(next: Grid) {
		setParam(mapKey, serializeGrid(next));
	}

	/** The cells crossed going from a to b, 4-connected (no diagonal gaps in a painted wall). */
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
			// Step along the axis that lags behind the straight line.
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
		const g = grid;
		const work = g.cells.slice();
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
				if (c === g.start || c === g.goal || work[c] === value) continue;
				work[c] = value;
				changed = true;
			}
			if (changed) write({ ...g, cells: work.slice() });
		});
	}

	function onhover(event: PointerEvent) {
		hover = cellAt(toSvg(event, event.currentTarget as Element));
	}

	type Which = 'start' | 'goal';
	function canHold(which: Which, at: number) {
		const other = which === 'start' ? grid.goal : grid.start;
		return at !== other && grid.cells[at] !== 2;
	}
	function moveMarker(which: Which, at: number | null) {
		if (at === null || at === grid[which] || !canHold(which, at)) return;
		write({ ...grid, [which]: at });
	}
	const DIRS: Record<string, [number, number]> = {
		ArrowUp: [0, -1],
		ArrowDown: [0, 1],
		ArrowLeft: [-1, 0],
		ArrowRight: [1, 0]
	};
	/** The next square from `from` in a direction that `ok` accepts (skipping the others), or null. */
	function nextCell(from: number, key: string, ok: (i: number) => boolean): number | null {
		const d = DIRS[key];
		let c = colOf(from);
		let r = rowOf(from);
		for (;;) {
			c += d[0];
			r += d[1];
			if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
			const i = r * COLS + c;
			if (ok(i)) return i;
		}
	}
	function markerKey(which: Which, event: KeyboardEvent) {
		if (!DIRS[event.key]) return;
		event.preventDefault();
		moveMarker(
			which,
			nextCell(grid[which], event.key, (i) => canHold(which, i))
		);
	}
	function markerDown(which: Which, event: PointerEvent) {
		startDrag(event, (p) => moveMarker(which, cellAt(p)));
	}

	// The keyboard map cursor: starts on the square to the right of S on every step.
	let cursor = $state(0);
	$effect(() => {
		void step.id;
		const s = untrack(() => grid.start);
		untrack(() => (cursor = colOf(s) < COLS - 1 ? s + 1 : s - 1));
	});
	function cursorKey(event: KeyboardEvent) {
		if (DIRS[event.key]) {
			event.preventDefault();
			cursor = nextCell(cursor, event.key, () => true) ?? cursor;
		} else if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			if (cursor === grid.start || cursor === grid.goal) return;
			const cells = grid.cells.slice();
			cells[cursor] = cells[cursor] === brush ? 0 : brush;
			write({ ...grid, cells });
		}
	}
	const TERRAIN = ['ground', 'mud', 'wall'];
	const where = (i: number) => `column ${colOf(i) + 1}, row ${rowOf(i) + 1}`;
	const describe = (i: number) =>
		`${where(i)}: ${
			i === grid.start ? 'the start' : i === grid.goal ? 'the goal' : TERRAIN[grid.cells[i]]
		}`;

	// ---- words -------------------------------------------------------------------------------
	const NAMES: Record<Algorithm, string> = {
		bfs: 'Breadth-first search',
		dijkstra: 'Dijkstra’s algorithm',
		astar: 'A*'
	};
	const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
	const title = $derived(
		algo
			? NAMES[algo] + (algo === 'astar' && weight !== 1 ? ` · estimate × ${fmt(weight)}` : '')
			: 'The map'
	);
	const plural = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'}`;
	const summary = (r: { path: number[]; cost: number }) =>
		`${plural(r.path.length - 1, 'step')} · cost ${r.cost}`;
	const stats = $derived(
		result
			? `${plural(index, 'square')} visited · ${frontier.length} on the frontier`
			: `${N} squares, each joined to its neighbours`
	);

	/** The line under the title: what is happening now ('' when the result is shown). */
	const words = $derived.by(() => {
		if (!result || !algo) return 'Paint walls, drag S and G';
		if (hover !== null && stateOf(hover) !== 'none') {
			const g = stateOf(hover) === 'visited' ? result.dist[hover] : gAt(hover);
			const base =
				algo === 'bfs'
					? `This square: ${plural(timeline.depth[hover], 'step')} from the start`
					: `This square: cost so far ${g}`;
			if (algo !== 'astar') return base;
			const h = manhattan(grid, hover, grid.goal);
			return `${base} + estimate ${weight === 1 ? h : `${fmt(weight)} × ${h}`} = ${fmt(g + weight * h)}`;
		}
		if (finished) return '';
		if (traced > 0) return 'Goal reached: trace back where each square was reached from';
		if (current < 0) return 'The frontier holds only the start';
		if (algo === 'bfs') {
			const d = timeline.depth[current];
			return `Ring ${d}: the squares ${plural(d, 'step')} from the start`;
		}
		const g = result.dist[current];
		if (algo === 'dijkstra')
			return `Expanding the cheapest square on the frontier: cost so far ${g}`;
		const h = manhattan(grid, current, grid.goal);
		const est = weight === 1 ? `${h}` : `${fmt(weight)} × ${h}`;
		return `Lowest total: cost so far ${g} + estimate ${est} = ${fmt(g + weight * h)}`;
	});

	// ---- timeline ----------------------------------------------------------------------------
	const TL0 = 120;
	const TL1 = 840;
	const TLY = 540;
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? Math.min(k, total) / total : 0));
	function onmove(p: Point) {
		scrubTo(((p.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(s: number | 'start' | 'end') {
		const base = playing ? Math.round(lastK) : Math.round(manual);
		scrubTo(s === 'start' ? 0 : s === 'end' ? total : base + s);
	}
	const progressText = $derived(
		`${index} of ${plural(nSteps, 'square')} visited${traced > 0 ? ` · route traced back ${plural(Math.max(0, traced - 1), 'step')} of ${route.length - 1}` : ''}`
	);

	// The map step: the hovered square as a node, with edges to its neighbours. Without a
	// hover, the node hops from S towards G, a square every 1.2 s, until something is in the
	// way (by a wall, an edge goes missing); reduced motion keeps it on S.
	const walk = $derived.by(() => {
		const out = [grid.start];
		const dir = colOf(grid.goal) >= colOf(grid.start) ? 1 : -1;
		for (let c = colOf(grid.start) + dir; c >= 0 && c < COLS; c += dir) {
			const i = rowOf(grid.start) * COLS + c;
			if (grid.cells[i] === 2 || i === grid.goal) break;
			out.push(i);
		}
		return out;
	});
	const focusCell = $derived(
		hover !== null && grid.cells[hover] !== 2
			? hover
			: reduced
				? grid.start
				: walk[Math.floor(t / 1.2) % walk.length]
	);
	const around = $derived.by(() => {
		if (algo) return { d: '', dots: [] as number[] };
		const i = focusCell;
		const nb = [
			rowOf(i) > 0 ? i - COLS : -1,
			colOf(i) < COLS - 1 ? i + 1 : -1,
			rowOf(i) < ROWS - 1 ? i + COLS : -1,
			colOf(i) > 0 ? i - 1 : -1
		].filter((j) => j >= 0 && grid.cells[j] !== 2);
		return {
			d: nb.map((j) => `M${cx(i)} ${cy(i)}L${cx(j)} ${cy(j)}`).join(''),
			dots: [i, ...nb]
		};
	});
	const LEGEND = [
		{ l: 'ground: costs 1', f: 'var(--gs-ground)' },
		{ l: 'mud: costs 5', f: 'var(--gs-mud)' },
		{ l: 'wall', f: 'var(--gs-wall)' }
	];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet swatch(x: number, y: number, dashed: boolean)}
	<line
		x1={x}
		x2={x + 26}
		y1={y}
		y2={y}
		stroke={dashed ? 'var(--stage-ink)' : 'var(--gs-path)'}
		stroke-width={dashed ? 3 : 6}
		stroke-linecap="round"
		stroke-dasharray={dashed ? '1 7' : undefined}
		opacity={dashed ? 0.8 : 0.9}
	/>
{/snippet}

{#snippet marker(which: Which, letter: string, color: string, label: string)}
	{@const i = grid[which]}
	<g
		class="marker"
		role="button"
		tabindex="0"
		aria-label="{label}, at {where(i)}. Drag it, or use the arrow keys to move it"
		onpointerdown={(e) => markerDown(which, e)}
		onkeydown={(e) => markerKey(which, e)}
	>
		<circle cx={cx(i)} cy={cy(i)} r="20" fill="transparent" />
		<circle
			class="ring"
			cx={cx(i)}
			cy={cy(i)}
			r="17"
			fill="none"
			stroke="var(--focus)"
			stroke-width="2.5"
		/>
		<circle cx={cx(i)} cy={cy(i)} r="13" fill={color} stroke="var(--stage-bg)" stroke-width="2" />
		<text
			x={cx(i)}
			y={cy(i) + 5}
			text-anchor="middle"
			font-weight="700"
			style:font-size="14px"
			style:fill="var(--stage-bg)">{letter}</text
		>
	</g>
{/snippet}

<g>
	<!-- readout card -->
	<rect
		x="16"
		y="16"
		width="928"
		height="80"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(36, 46, title, 17, { weight: 600 })}
	{@render txt(924, 46, stats, 14, { anchor: 'end', weight: 600, muted: !result })}
	{#if result && words === ''}
		{#if result.path.length === 0}
			{@render txt(36, 76, 'No route: walls cut the goal off from the start', 14, {
				color: 'var(--gs-goal)',
				weight: 600
			})}
		{:else if showCheapest && cheapest}
			{@render swatch(38, 71, false)}
			{@render txt(
				74,
				76,
				`${algo === 'bfs' ? 'Fewest steps' : 'A* route'}: ${summary(result)}`,
				14,
				{ weight: 600 }
			)}
			{@render swatch(316, 71, true)}
			{@render txt(352, 76, `Cheapest: ${summary(cheapest)}`, 14, { weight: 600 })}
			{#if phase === 'estimate'}
				{@render txt(
					924,
					76,
					`estimate × ${fmt(weight)} can be too high → missed the cheapest route`,
					13,
					{ anchor: 'end', color: 'var(--gs-goal)', weight: 600 }
				)}
			{/if}
		{:else}
			{@render swatch(38, 71, false)}
			{@render txt(74, 76, `Route found: ${summary(result)}`, 14, { weight: 600 })}
			{#if cheapest}
				{@render txt(316, 76, '— also the cheapest route', 13, { muted: true })}
			{/if}
			{#if algo === 'astar'}
				{@render txt(924, 76, 'point at a square: cost so far + estimate', 13, {
					anchor: 'end',
					muted: true
				})}
			{/if}
		{/if}
	{:else}
		{@render txt(36, 76, words, 14, { muted: !result })}
	{/if}

	<!-- the map: one rect per square -->
	{#each cells as c (c.i)}
		<rect
			x={GX + colOf(c.i) * CS}
			y={GY + rowOf(c.i) * CS}
			width={CS}
			height={CS}
			style:fill={c.fill}
			stroke={c.wall ? 'none' : 'var(--stage-grid)'}
		/>
	{/each}
	<path
		d={mudPath}
		fill="none"
		stroke="var(--stage-bg)"
		stroke-width="1.4"
		stroke-linecap="round"
		opacity="0.45"
	/>
	<rect x={GX} y={GY} width={GW} height={GH} fill="none" stroke="var(--stage-line)" rx="2" />

	{#each numbers as n (n.key)}
		<text
			x={n.xs}
			y={n.y}
			text-anchor="middle"
			opacity="0.85"
			style:font-size="10px"
			style:fill={n.color}
			style:font-variant-numeric="tabular-nums">{n.s}</text
		>
	{/each}

	{#if frontierPath}
		<path d={frontierPath} fill="none" stroke="var(--gs-frontier)" stroke-width="2" />
	{/if}
	{#if current >= 0 && traced === 0}
		<rect
			x={GX + colOf(current) * CS + 1.5}
			y={GY + rowOf(current) * CS + 1.5}
			width={CS - 3}
			height={CS - 3}
			rx="3"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
	{/if}

	<!-- the map step: a square and its neighbours, as a node and its edges -->
	{#if !algo}
		<path
			d={around.d}
			stroke="var(--explainer-accent)"
			stroke-width="2.5"
			stroke-linecap="round"
			opacity="0.8"
		/>
		{#each around.dots as d (d)}
			<circle cx={cx(d)} cy={cy(d)} r={d === focusCell ? 5 : 4} fill="var(--explainer-accent)" />
		{/each}
	{/if}

	<!-- routes -->
	{#if showCheapest && cheapest}
		<path
			d={linePath(cheapest.path)}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-dasharray="1 7"
			opacity="0.8"
		/>
	{/if}
	{#if routePath}
		<path
			d={routePath}
			fill="none"
			stroke="var(--gs-path)"
			stroke-width="6"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.9"
		/>
	{/if}

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

	{@render marker('start', 'S', 'var(--gs-start)', 'Start (S)')}
	{@render marker('goal', 'G', 'var(--gs-goal)', 'Goal (G)')}

	{#if canPaint}
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

	<!-- below the map -->
	{#if result}
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
		{@render txt(TL0 - 24, TLY + 4, 'start', 11, { anchor: 'end', muted: true })}
		{@render txt(TL1 + 24, TLY + 4, 'end', 11, { muted: true })}
		{@render txt(
			(TL0 + TL1) / 2,
			TLY + 30,
			`${progressText}${playing && !reduced ? '' : playing ? ' · drag or use ← → to step through' : ' · paused: drag or use ← →'}`,
			12,
			{ anchor: 'middle', muted: true }
		)}
		<Handle
			x={tlx}
			y={TLY}
			r={8}
			label="Replay position"
			value={Math.floor(k)}
			min={0}
			max={total}
			valuetext={progressText}
			{onmove}
			{onkey}
		/>
	{:else}
		{#each LEGEND as item, j (item.l)}
			<rect
				x={GX + j * 170}
				y="530"
				width="16"
				height="16"
				rx="3"
				style:fill={item.f}
				stroke="var(--stage-line)"
			/>
			{@render txt(GX + 24 + j * 170, 543, item.l, 13, { muted: true })}
		{/each}
		{@render txt(GX + GW, 543, 'moves: up, down, left or right — never through a wall', 13, {
			anchor: 'end',
			muted: true
		})}
	{/if}
</g>

<style>
	.paint.can {
		cursor: crosshair;
		touch-action: none;
	}
	.marker {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.marker .ring,
	.cursor rect {
		opacity: 0;
	}
	.marker:focus-visible .ring,
	.cursor:focus-visible rect {
		opacity: 1;
	}
	.cursor {
		outline: none;
		pointer-events: none;
	}
</style>
