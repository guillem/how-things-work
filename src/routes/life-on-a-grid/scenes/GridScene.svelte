<script lang="ts">
	/**
	 * The Game of Life grid (24 × 15 squares, wrapping round). In the first two steps the reader
	 * paints squares and steps one picture at a time, with each square's count of live neighbours
	 * shown (and, under the rules, which squares are about to die or be born). Later steps play
	 * preset shapes: still lifes and blinkers, the glider, the wrong one-at-a-time update, a changed
	 * birth number, and the same seed replayed.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		at,
		CONWAY,
		decode,
		encode,
		neighbours,
		place,
		population,
		step as nextGen,
		stepInPlace,
		type Grid
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'paint'));
	const W = 24;
	const H = 15;
	const painting = $derived(phase === 'paint' || phase === 'rules');

	// ---- the starting grid of each step --------------------------------------------------------
	const PAINT_DEFAULT = place(W, H, [
		['blinker', 4, 5],
		['glider', 12, 4],
		['block', 18, 9]
	]);
	const seedGrid: Grid = $derived.by(() => {
		if (painting)
			return params.cells === undefined ? PAINT_DEFAULT : decode(String(params.cells), W, H);
		if (phase === 'still')
			return place(W, H, [
				['block', 3, 3],
				['beehive', 9, 3],
				['blinker', 17, 4],
				['toad', 4, 10],
				['blinker', 15, 11]
			]);
		if (phase === 'glider' || phase === 'next') return place(W, H, [['glider', 2, 2]]);
		if (phase === 'together')
			return place(W, H, [
				['blinker', 4, 6],
				['glider', 12, 4]
			]);
		return place(W, H, [['rpentomino', 11, 6]]);
	});
	const rule = $derived(
		phase === 'rule' ? { birth: [Number(params.birth ?? 3)], survive: [2, 3] } : CONWAY
	);
	const wrong = $derived(phase === 'together' && params.onebyone === true);
	/** Every picture from the seed, up to 240 of them. */
	const history: Grid[] = $derived.by(() => {
		const out = [seedGrid];
		for (let i = 0; i < 240; i++) {
			const g = out[out.length - 1];
			out.push(wrong ? stepInPlace(g, rule) : nextGen(g, rule));
		}
		return out;
	});

	// ---- which picture is shown ---------------------------------------------------------------
	// Painting steps: the Step button's presses since the grid was last painted.
	const presses = $derived(Number(params.step ?? 0));
	const paintedAt = $derived(Number(params.paintedat ?? 0));
	// Playing steps: three pictures a second from when the step (or its settings) started.
	let t0 = $state(0);
	$effect(() => {
		void history;
		void step.id;
		void params.again;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	const playing = $derived(phase === 'still' || phase === 'glider' ? params.play !== false : true);
	const liveGen = $derived(Math.floor(local * 3));
	let held = $state(0);
	$effect(() => {
		if (playing) held = liveGen;
	});
	const gen = $derived(
		painting
			? Math.max(0, presses - paintedAt)
			: reduced
				? 0
				: Math.min(history.length - 1, playing ? liveGen : held)
	);
	const grid = $derived(history[Math.min(history.length - 1, gen)]);

	// ---- painting -----------------------------------------------------------------------------
	const C = 34;
	const X0 = 72;
	const Y0 = 34;
	let cursor = $state({ x: 0, y: 0 });
	function toggle(x: number, y: number) {
		const g: Grid = { ...grid, cells: grid.cells.slice() };
		g.cells[y * W + x] = g.cells[y * W + x] ? 0 : 1;
		setParam('cells', encode(g) || '-');
		setParam('paintedat', presses);
	}
	function onPaint(e: PointerEvent) {
		const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement;
		const ctm = svg?.getScreenCTM();
		if (!ctm) return;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		const x = Math.floor((p.x - X0) / C);
		const y = Math.floor((p.y - Y0) / C);
		if (x < 0 || x >= W || y < 0 || y >= H) return;
		cursor = { x, y };
		toggle(x, y);
	}
	function onKey(e: KeyboardEvent) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		if (e.key in moves) {
			e.preventDefault();
			const [dx, dy] = moves[e.key];
			cursor = { x: (cursor.x + dx + W) % W, y: (cursor.y + dy + H) % H };
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle(cursor.x, cursor.y);
		}
	}
	let focused = $state(false);

	// ---- what the rules are about to do ---------------------------------------------------------
	const showCounts = $derived(painting);
	const fate = $derived.by(() => {
		if (phase !== 'rules') return null;
		const next = nextGen(grid);
		return { next };
	});
	const dying = $derived(
		fate ? grid.cells.reduce((a, c, i) => a + (c && !fate.next.cells[i] ? 1 : 0), 0) : 0
	);
	const born = $derived(
		fate ? grid.cells.reduce((a, c, i) => a + (!c && fate.next.cells[i] ? 1 : 0), 0) : 0
	);
</script>

<g class="life">
	<!-- the squares -->
	{#each Array.from({ length: H }, (_, y) => y) as y (y)}
		{#each Array.from({ length: W }, (_, x) => x) as x (x)}
			{@const alive = at(grid, x, y) === 1}
			{@const n = showCounts ? neighbours(grid, x, y) : 0}
			{@const nextAlive = fate ? fate.next.cells[y * W + x] === 1 : alive}
			<rect
				x={X0 + x * C + 1}
				y={Y0 + y * C + 1}
				width={C - 2}
				height={C - 2}
				rx="5"
				fill={alive
					? 'var(--life-live)'
					: fate && nextAlive
						? 'var(--life-born)'
						: 'var(--life-empty)'}
				stroke={fate && alive && !nextAlive ? 'var(--life-die)' : 'none'}
				stroke-width="3.5"
			/>
			{#if showCounts && n > 0}
				<text
					x={X0 + x * C + C / 2}
					y={Y0 + y * C + C / 2 + 5}
					text-anchor="middle"
					font-size="14"
					font-weight="700"
					fill={alive ? 'var(--life-on-live)' : 'var(--text-muted)'}>{n}</text
				>
			{/if}
		{/each}
	{/each}

	<!-- painting -->
	{#if painting}
		<rect
			class="life-paint"
			x={X0}
			y={Y0}
			width={W * C}
			height={H * C}
			fill="transparent"
			role="button"
			tabindex="0"
			aria-label="Paint squares: click a square to switch it on or off; arrow keys move, Enter switches"
			onpointerdown={onPaint}
			onkeydown={onKey}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
		/>
		{#if focused}
			<rect
				x={X0 + cursor.x * C}
				y={Y0 + cursor.y * C}
				width={C}
				height={C}
				rx="6"
				fill="none"
				stroke="var(--focus)"
				stroke-width="3"
			/>
		{/if}
	{/if}

	<!-- readouts -->
	<Readout
		id="life-gen"
		order={1}
		label="Picture"
		value="number {gen + 1}, {population(grid)} squares alive"
	>
		<Label
			x={X0}
			y={Y0 + H * C + 26}
			text="picture {gen + 1} · {population(grid)} squares alive"
			anchor="start"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	{#if phase === 'rules'}
		<Readout
			id="life-fate"
			order={2}
			label="Next picture"
			value="{dying} about to die, {born} about to be born"
		>
			<Label
				x={X0 + W * C}
				y={Y0 + H * C + 26}
				text="{dying} about to die (red) · {born} about to be born (green)"
				anchor="end"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>
	{/if}
	{#if phase === 'together'}
		<Readout
			id="life-mode"
			order={2}
			label="Update"
			value={wrong ? 'one square at a time: wrong' : 'all squares at once'}
		>
			<Label
				x={X0 + W * C}
				y={Y0 + H * C + 26}
				text={wrong ? 'one square at a time: the shapes break' : 'all squares at once'}
				anchor="end"
				size={15}
				weight={700}
				color={wrong ? 'var(--life-die)' : undefined}
			/>
		</Readout>
	{/if}
	{#if phase === 'rule'}
		<Readout
			id="life-rule"
			order={2}
			label="Birth"
			value="an empty square needs {rule.birth[0]} live neighbours"
		>
			<Label
				x={X0 + W * C}
				y={Y0 + H * C + 26}
				text="birth needs {rule.birth[0]} neighbours{rule.birth[0] === 3 ? ' (Conway’s rule)' : ''}"
				anchor="end"
				size={15}
				weight={700}
				tabular
			/>
		</Readout>
	{/if}
</g>

<style>
	.life-paint {
		cursor: pointer;
		outline: none;
	}
</style>
