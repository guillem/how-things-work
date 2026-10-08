<script lang="ts">
	/**
	 * Three methods, one map: breadth-first search, Dijkstra's algorithm and A*
	 * search the same grid side by side, in lock-step.
	 *
	 * The map is shared: `params['map:compare']` (`serializeGrid`), falling back
	 * to `PRESETS[hints.map]` (mixed); `params.resetMap` restores it. Painting on
	 * any panel with `params.brush` edits the shared map; dragging S or G moves
	 * them. Keyboard: focus a panel (Tab), arrows move a cursor, Enter paints,
	 * S/G move the start/goal to the cursor.
	 *
	 * Time: every search runs `pace` cells per second from the same moment, so
	 * after the lead-in all three are at step ⌊(t − LEAD)·pace⌋ (each holding
	 * when it finishes); the race loops after a HOLD once the slowest is done.
	 * Each search is recorded once per map (never per frame); per cell we keep
	 * the step at which it was expanded and the step at which it was first
	 * found, so a frame is a few comparisons per cell.
	 *
	 * Cells of one kind are drawn as ONE path per panel (visited cells in seven
	 * cost shades shared by the three panels), which keeps the node count low.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { clamp, smoothstep, startDrag, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		PRESETS,
		parseGrid,
		search,
		serializeGrid,
		type Algorithm,
		type Cell,
		type Grid
	} from '../search';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- the shared map -------------------------------------------------------------
	const KEY = 'map:compare';
	const preset = $derived(PRESETS[String(step.hints?.map ?? 'mixed')] ?? PRESETS.mixed);
	const grid = $derived.by((): Grid => {
		const g = parseGrid(params[KEY]);
		return g && g.cols === preset.cols && g.rows === preset.rows ? g : preset;
	});
	const save = (g: Grid) => setParam(KEY, serializeGrid(g));

	// "Start again": only a press after this scene appeared resets the map.
	let seenReset = untrack(() => Number(params.resetMap ?? 0));
	$effect(() => {
		const n = Number(params.resetMap ?? 0);
		if (n === seenReset) return;
		seenReset = n;
		untrack(() => save(preset));
	});

	// ---- the three searches (once per map) ------------------------------------------------
	const METHODS: { algo: Algorithm; name: string }[] = [
		{ algo: 'bfs', name: 'Breadth-first' },
		{ algo: 'dijkstra', name: 'Dijkstra' },
		{ algo: 'astar', name: 'A*' }
	];
	const runs = $derived(
		METHODS.map(({ algo, name }) => {
			const r = search(grid, algo);
			const n = grid.cells.length;
			const expandedAt = new Array<number>(n).fill(Infinity);
			const foundAt = new Array<number>(n).fill(Infinity);
			r.steps.forEach((s, i) => {
				expandedAt[s.current] = i;
				for (const a of s.added) if (foundAt[a] === Infinity) foundAt[a] = i;
			});
			return { algo, name, r, expandedAt, foundAt, total: r.steps.length };
		})
	);
	// One cost scale for the three panels, so equal shades mean equal costs.
	const maxCost = $derived(
		Math.max(
			1,
			...runs.flatMap(({ r }) => r.order.map((i) => r.dist[i]).filter((d) => d < Infinity))
		)
	);

	// ---- time -----------------------------------------------------------------------------
	const LEAD = 0.6;
	const HOLD = 4;
	const pace = $derived(Math.max(1, Number(params.pace ?? 24)));
	const longest = $derived(Math.max(1, ...runs.map((u) => u.total)));
	const k = $derived.by(() => {
		if (reduced) return Infinity;
		const period = LEAD + longest / pace + HOLD;
		const tt = ((t % period) + period) % period;
		return Math.floor(Math.max(0, tt - LEAD) * pace);
	});
	const allDone = $derived(runs.every((u) => k >= u.total));

	// ---- geometry ---------------------------------------------------------------------------
	const CELL = 13;
	const PANEL_X = [24, 337, 650];
	const GY = 62;
	const gw = $derived(grid.cols * CELL);
	const gh = $derived(grid.rows * CELL);
	const cx = (p: number, i: number) => PANEL_X[p] + (i % grid.cols) * CELL;
	const cy = (i: number) => GY + Math.floor(i / grid.cols) * CELL;
	const box = (x: number, y: number, s: number) => `M${x} ${y}h${s}v${s}h${-s}z`;

	const SHADES = 7;
	// The same colours as GridScene: visited cells from --gs-visited to
	// --gs-visited-far (here by cost so far, on one scale for the three panels);
	// visited mud keeps some of its brown; frontier cells are tinted and outlined.
	const shade = (b: number) =>
		`color-mix(in srgb, var(--gs-visited-far) ${Math.round((100 * b) / (SHADES - 1))}%, var(--gs-visited))`;
	const shadeMud = (b: number) => `color-mix(in srgb, ${shade(b)} 55%, var(--gs-mud))`;
	const frontierFill = (mud: boolean) =>
		`color-mix(in srgb, var(--gs-frontier) ${mud ? 45 : dark ? 40 : 60}%, ${mud ? 'var(--gs-mud)' : 'var(--gs-ground)'})`;

	// Per panel: the paths of this frame.
	const panels = $derived(
		runs.map((u, p) => {
			const kk = Math.min(k, u.total);
			const visited = new Array<string>(SHADES).fill('');
			const visitedMud = new Array<string>(SHADES).fill('');
			let frontier = '';
			let frontierMud = '';
			let frontierEdge = '';
			let walls = '';
			let mud = '';
			let count = 0;
			for (let i = 0; i < grid.cells.length; i++) {
				const c: Cell = grid.cells[i];
				const x = cx(p, i);
				const y = cy(i);
				if (c === 2) {
					walls += box(x, y, CELL);
					continue;
				}
				if (u.expandedAt[i] < kk) {
					count++;
					const b = clamp(Math.round(((SHADES - 1) * u.r.dist[i]) / maxCost), 0, SHADES - 1);
					if (c === 1) visitedMud[b] += box(x, y, CELL);
					else visited[b] += box(x, y, CELL);
				} else if (u.foundAt[i] < kk || (i === grid.start && kk === 0)) {
					if (c === 1) frontierMud += box(x, y, CELL);
					else frontier += box(x, y, CELL);
					frontierEdge += box(x + 1.5, y + 1.5, CELL - 3);
				} else if (c === 1) mud += box(x, y, CELL);
			}
			const done = kk >= u.total;
			const current = !done && kk > 0 ? u.r.steps[kk - 1].current : -1;
			const route = done
				? u.r.path
						.map((i, j) => `${j ? 'L' : 'M'}${cx(p, i) + CELL / 2} ${cy(i) + CELL / 2}`)
						.join('')
				: '';
			return {
				...u,
				kk,
				done,
				visited,
				visitedMud,
				frontier,
				frontierMud,
				frontierEdge,
				walls,
				mud,
				count,
				current,
				route
			};
		})
	);
	// Mud texture (as on GridScene, scaled down): a small wave in every mud cell.
	const mudTexture = $derived(
		[0, 1, 2].map((p) =>
			grid.cells
				.map((c, i) => (c === 1 ? `M${cx(p, i) + 2.5} ${cy(i) + 8.5}q2 -2 4 0t4 0` : ''))
				.join('')
		)
	);

	const gridLines = $derived(
		[0, 1, 2].map((p) => {
			let d = '';
			for (let c = 1; c < grid.cols; c++) d += `M${PANEL_X[p] + c * CELL} ${GY}v${gh}`;
			for (let r = 1; r < grid.rows; r++) d += `M${PANEL_X[p]} ${GY + r * CELL}h${gw}`;
			return d;
		})
	);

	// ---- editing ------------------------------------------------------------------------------
	const BRUSH: Record<string, Cell> = { wall: 2, mud: 1, ground: 0 };
	const brush = $derived(BRUSH[String(params.brush ?? 'wall')] ?? 2);

	function cellAt(p: number, pt: Point): number {
		const c = Math.floor((pt.x - PANEL_X[p]) / CELL);
		const r = Math.floor((pt.y - GY) / CELL);
		if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
		return r * grid.cols + c;
	}
	/** As on GridScene: painting a square that already has the brush's terrain clears it. */
	function paint(i: number) {
		if (i < 0 || i === grid.start || i === grid.goal) return;
		const cells = grid.cells.slice();
		cells[i] = cells[i] === brush ? 0 : brush;
		save({ ...grid, cells });
	}
	/** The squares crossed going from a to b, 4-connected (no diagonal gaps in a painted wall). */
	function cellsBetween(a: number, b: number): number[] {
		const W = grid.cols;
		const out: number[] = [];
		let c = a % W;
		let r = Math.floor(a / W);
		const dc = Math.abs((b % W) - c);
		const dr = Math.abs(Math.floor(b / W) - r);
		const sc = Math.sign((b % W) - c);
		const sr = Math.sign(Math.floor(b / W) - r);
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
			out.push(r * W + c);
		}
		return out;
	}
	function moveEnd(which: 'start' | 'goal', i: number) {
		const other = which === 'start' ? grid.goal : grid.start;
		if (i < 0 || i === other || grid.cells[i] === 2 || grid[which] === i) return;
		save({ ...grid, [which]: i });
	}
	function onpointerdown(e: PointerEvent, p: number) {
		let mode: 'paint' | 'start' | 'goal' | null = null;
		// Painting: the first square decides paint or clear (as on GridScene), and a
		// fast drag fills the squares between two pointer samples.
		const g = grid;
		const work = g.cells.slice();
		let value: Cell | null = null;
		let last = -1;
		startDrag(e, (pt) => {
			const i = cellAt(p, pt);
			if (mode === null) mode = i === grid.start ? 'start' : i === grid.goal ? 'goal' : 'paint';
			if (mode !== 'paint') return moveEnd(mode, i);
			if (i < 0) return;
			if (value === null) value = work[i] === brush ? 0 : brush;
			const todo = last < 0 ? [i] : cellsBetween(last, i);
			last = i;
			let changed = false;
			for (const c of todo) {
				if (c === g.start || c === g.goal || work[c] === value) continue;
				work[c] = value;
				changed = true;
			}
			if (changed) save({ ...g, cells: work.slice() });
		});
	}

	// Keyboard cursor (shared by the panels; shown on the focused one).
	let cursor = $state(-1);
	let focused = $state(-1);
	const cur = $derived(cursor < 0 ? grid.start : cursor);
	function onkeydown(e: KeyboardEvent) {
		const c = cur % grid.cols;
		const r = Math.floor(cur / grid.cols);
		const go = (dc: number, dr: number) =>
			(cursor = clamp(r + dr, 0, grid.rows - 1) * grid.cols + clamp(c + dc, 0, grid.cols - 1));
		switch (e.key) {
			case 'ArrowLeft':
				go(-1, 0);
				break;
			case 'ArrowRight':
				go(1, 0);
				break;
			case 'ArrowUp':
				go(0, -1);
				break;
			case 'ArrowDown':
				go(0, 1);
				break;
			case 'Enter':
			case ' ':
				paint(cur);
				break;
			case 's':
			case 'S':
				moveEnd('start', cur);
				break;
			case 'g':
			case 'G':
				moveEnd('goal', cur);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	// ---- readouts -------------------------------------------------------------------------------
	const plural = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'}`;
	const cheapest = $derived(Math.min(...runs.map((u) => u.r.cost)));
	const routeText = (u: (typeof panels)[number]) =>
		!u.done
			? 'searching…'
			: u.r.path.length
				? `route: ${u.r.path.length - 1} steps · cost ${u.r.cost}`
				: 'no route to the goal';

	// Summary bars.
	const SX = 40;
	const BAR0 = 176;
	const BAR1 = 640;
	const SY = 318;
	const barMax = $derived(Math.max(1, ...runs.map((u) => u.r.expanded)));
	const takeaway = $derived.by(() => {
		const [b, d, a] = runs;
		if (!a.r.path.length)
			return ['The goal cannot be reached: each method searches everything it can reach.', ''];
		const pct = Math.round((100 * a.r.expanded) / Math.max(1, d.r.expanded));
		const first = `A* looked at ${a.r.expanded} cells, ${pct}% of Dijkstra's ${d.r.expanded}, and found a route just as cheap.`;
		const second =
			b.r.cost > d.r.cost
				? `Breadth-first's route has the fewest steps (${b.r.path.length - 1}) but costs ${b.r.cost}: ${b.r.cost - d.r.cost} more than the cheapest.`
				: `Here the fewest-steps route is also the cheapest (cost ${b.r.cost}). Paint mud on it and breadth-first will wade through.`;
		return [first, second];
	});
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
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
		data?: string;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		data-readout={opts.data}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g opacity={fadeIn}>
	{#each panels as u, p (u.algo)}
		{@const X = PANEL_X[p]}
		<!-- card -->
		<rect
			x={X - 8}
			y={20}
			width={gw + 16}
			height={252}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(X, 46, u.name, 16, { weight: 600 })}
		{#if u.done}
			{@render txt(X + gw, 46, u.r.path.length ? 'goal reached' : 'no route', 12, {
				anchor: 'end',
				color: u.r.path.length ? 'var(--gs-path)' : undefined,
				muted: !u.r.path.length
			})}
		{/if}

		<!-- map -->
		<rect x={X} y={GY} width={gw} height={gh} fill="var(--gs-ground)" />
		{#each u.visited as d, b (b)}
			{#if d}<path {d} style:fill={shade(b)} />{/if}
		{/each}
		{#each u.visitedMud as d, b (b)}
			{#if d}<path {d} style:fill={shadeMud(b)} />{/if}
		{/each}
		{#if u.mud}<path d={u.mud} fill="var(--gs-mud)" />{/if}
		{#if u.frontier}<path d={u.frontier} style:fill={frontierFill(false)} />{/if}
		{#if u.frontierMud}<path d={u.frontierMud} style:fill={frontierFill(true)} />{/if}
		{#if u.walls}<path d={u.walls} fill="var(--gs-wall)" />{/if}
		<path
			d={gridLines[p]}
			fill="none"
			stroke="var(--stage-grid)"
			stroke-width="0.6"
			style:pointer-events="none"
		/>
		{#if mudTexture[p]}
			<path
				d={mudTexture[p]}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="1"
				stroke-linecap="round"
				opacity="0.45"
			/>
		{/if}
		{#if u.frontierEdge}
			<path d={u.frontierEdge} fill="none" stroke="var(--gs-frontier)" stroke-width="1.5" />
		{/if}
		{#if u.current >= 0}
			<rect
				x={cx(p, u.current) + 0.75}
				y={cy(u.current) + 0.75}
				width={CELL - 1.5}
				height={CELL - 1.5}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
		{/if}
		{#if u.route}
			<path
				d={u.route}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="5.5"
				stroke-linejoin="round"
				stroke-linecap="round"
				opacity="0.8"
			/>
			<path
				d={u.route}
				fill="none"
				stroke="var(--gs-path)"
				stroke-width="3"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{/if}
		{#each [{ i: grid.start, c: 'var(--gs-start)', l: 'S' }, { i: grid.goal, c: 'var(--gs-goal)', l: 'G' }] as m (m.l)}
			<circle
				cx={cx(p, m.i) + CELL / 2}
				cy={cy(m.i) + CELL / 2}
				r="7.5"
				fill={m.c}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<text
				x={cx(p, m.i) + CELL / 2}
				y={cy(m.i) + CELL / 2 + 3.5}
				text-anchor="middle"
				font-weight="700"
				style:font-size="10px"
				style:fill="var(--stage-bg)"
				style:pointer-events="none">{m.l}</text
			>
		{/each}
		<rect
			x={X}
			y={GY}
			width={gw}
			height={gh}
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		{#if focused === p}
			<rect
				x={cx(p, cur) - 1}
				y={cy(cur) - 1}
				width={CELL + 2}
				height={CELL + 2}
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
			<rect
				x={X - 4}
				y={GY - 4}
				width={gw + 8}
				height={gh + 8}
				rx="4"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
		{/if}
		<!-- hit area: paint, drag S/G; keyboard cursor -->
		<rect
			x={X}
			y={GY}
			width={gw}
			height={gh}
			fill="transparent"
			role="button"
			tabindex="0"
			aria-label="{u.name} map (shared by all three). Click or drag to paint; drag S or G to move them. Keys: arrows move a cursor, Enter paints, S or G moves the start or goal there."
			style:cursor="crosshair"
			style:outline="none"
			style:touch-action="none"
			onpointerdown={(e) => onpointerdown(e, p)}
			{onkeydown}
			onfocus={() => (focused = p)}
			onblur={() => (focused = -1)}
		/>

		<!-- readouts -->
		{@render txt(X, GY + gh + 30, `visited ${plural(u.count, 'cell')}`, 15, {
			weight: 600,
			color: 'var(--gs-visited-far)',
			data: 'visited'
		})}
		{@render txt(X, GY + gh + 54, routeText(u), 13, {
			muted: !u.done,
			data: u.done && u.r.path.length ? 'route' : undefined
		})}
	{/each}

	<!-- legend -->
	{#each [{ c: 'var(--gs-start)', l: 'start' }, { c: 'var(--gs-goal)', l: 'goal' }, { c: 'var(--gs-mud)', l: 'mud (costs 5)' }, { c: 'var(--gs-wall)', l: 'wall' }, { c: frontierFill(false), l: 'frontier' }, { c: 'var(--gs-path)', l: 'route' }] as item, i (item.l)}
		{@const lx = 24 + [0, 62, 120, 234, 290, 368][i]}
		<rect
			x={lx}
			y={288}
			width="12"
			height="12"
			rx={i < 2 ? 6 : 3}
			style:fill={item.c}
			stroke={item.l === 'frontier' ? 'var(--gs-frontier)' : 'none'}
			stroke-width="1.5"
		/>
		{@render txt(lx + 17, 299, item.l, 12, { muted: true })}
	{/each}
	{#each [0, 2, 4, 6] as b (b)}
		<rect x={452 + b * 7} y={288} width="7" height="12" style:fill={shade(b)} />
	{/each}
	{@render txt(506, 299, `visited: ${dark ? 'brighter' : 'darker'} = costlier to reach`, 12, {
		muted: true
	})}

	<!-- summary -->
	<rect
		x={16}
		y={SY}
		width={928}
		height={266}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(SX, SY + 32, 'Cells visited before reaching the goal', 15, { weight: 600 })}
	{@render txt(700, SY + 32, 'Route found', 15, { weight: 600 })}
	{#each panels as u, p (u.algo)}
		{@const y = SY + 74 + p * 46}
		{@const w = ((BAR1 - BAR0) * u.count) / barMax}
		{@render txt(SX, y + 5, u.name, 14, { weight: 600 })}
		<rect
			x={BAR0}
			y={y - 11}
			width={BAR1 - BAR0}
			height={22}
			rx="4"
			fill="var(--stage-grid)"
			opacity="0.5"
		/>
		<rect
			x={BAR0}
			y={y - 11}
			width={Math.max(0, w)}
			height={22}
			rx="4"
			fill="var(--gs-visited-far)"
		/>
		{@render txt(BAR0 + w + 8, y + 5, String(u.count), 14, { weight: 600 })}
		{#if u.done && u.r.path.length}
			{@render txt(700, y + 5, `cost ${u.r.cost}`, 14, {
				weight: 600,
				color: 'var(--gs-path)',
				data: 'cost'
			})}
			{@render txt(
				772,
				y + 5,
				`${u.r.path.length - 1} steps${u.r.cost === cheapest ? ' · cheapest' : ''}`,
				13,
				{ muted: true }
			)}
		{:else}
			{@render txt(700, y + 5, u.done ? 'none' : 'searching…', 14, { muted: true })}
		{/if}
	{/each}
	<line x1={SX} x2={920} y1={SY + 200} y2={SY + 200} stroke="var(--border)" />
	{#if allDone}
		{@render txt(SX, SY + 228, takeaway[0], 14)}
		{@render txt(SX, SY + 252, takeaway[1], 14)}
	{:else}
		{@render txt(
			SX,
			SY + 240,
			'The three searches run at the same speed, one cell at a time…',
			14,
			{
				muted: true
			}
		)}
	{/if}
</g>
