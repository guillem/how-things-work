<script lang="ts">
	/**
	 * Connect Four against a search that looks `params.depth` moves ahead (alpha-beta when
	 * `params.prune` is on, or on every step that doesn't offer the toggle), with the page's rule
	 * of thumb at the end of each line. The reader plays red.
	 *
	 * Modes (`step.hints.mode`):
	 * - 'play': a game from the empty board, in `params.c4Game` (columns played, as digits). The
	 *   computer replies as soon as it is its turn (an effect).
	 * - 'puzzle': PUZZLE, with the computer (yellow) to move, in `params.c4Puzzle`. Its choice is
	 *   shown as a dashed disc and follows the depth and pruning controls; clicking a column plays
	 *   the computer's choice and then red's disc, and shows its next choice.
	 *
	 * The panel shows the decision on the board: for each of the computer's seven moves, its
	 * score, how many positions were examined below it (a bar, ten times taller per grid line),
	 * and which of red's seven replies to it were examined at all (grey: skipped by pruning).
	 * The search runs only when the position, the depth or pruning changes; never per frame.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { COLS, FORCED, Position, ROWS, WIN, search, type SearchResult } from '../connect-four';
	import { PUZZLE } from '../presets';
	import { fmt, onKey, pressWatcher } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const mode = $derived(step.hints?.mode === 'puzzle' ? 'puzzle' : 'play');
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const prune = $derived(offered.has('prune') ? params.prune === true : true);
	const depth = $derived(
		Math.max(1, Math.min(prune ? 8 : 7, Math.round(Number(params.depth ?? 4))))
	);
	const key = $derived(mode === 'puzzle' ? 'c4Puzzle' : 'c4Game');
	const start = $derived(mode === 'puzzle' ? PUZZLE : '');

	const game = $derived.by(() => {
		const g = params[key];
		if (typeof g !== 'string') return start;
		try {
			Position.from(g);
			return g.startsWith(start) ? g : start;
		} catch {
			return start;
		}
	});
	const pos = $derived(Position.from(game));
	const over = $derived(pos.over);
	const computersTurn = $derived(!over && pos.toMove === 2);

	/** The position the computer is deciding (or last decided) in. */
	const decidingIn = $derived.by(() => {
		if (computersTurn) return game;
		// After its move: the position before it, if it made one here.
		if (game.length > start.length && game.length % 2 === 0) return game.slice(0, -1);
		return null;
	});
	const analysis = $derived<SearchResult | null>(
		decidingIn === null ? null : search(decidingIn, { depth, prune, budget: 3_000_000 })
	);
	const pending = $derived(mode === 'puzzle' && computersTurn && analysis !== null);

	// Play mode: the computer replies at once.
	$effect(() => {
		if (mode !== 'play' || !computersTurn || !analysis) return;
		const g = game;
		const best = analysis.best;
		untrack(() => setParam(key, g + String(best)));
	});

	// New game / back to the puzzle.
	const freshNew = pressWatcher(untrack(() => Number(params.c4New ?? 0)));
	const freshReset = pressWatcher(untrack(() => Number(params.c4Reset ?? 0)));
	$effect(() => {
		const a = Number(params.c4New ?? 0);
		const b = Number(params.c4Reset ?? 0);
		untrack(() => {
			const n = freshNew(a);
			const r = freshReset(b);
			if (n || r) setParam(key, start);
		});
	});

	function drop(c: number) {
		if (over) return;
		let g = game;
		if (pending && analysis) g += String(analysis.best);
		const p = Position.from(g);
		if (p.over) {
			setParam(key, g);
			return;
		}
		if (p.toMove !== 1 || !p.canPlay(c)) return;
		setParam(key, g + String(c));
	}

	// ---- layout -----------------------------------------------------------------------
	const BX = 36;
	const BY = 112;
	const CELL = 58;
	const BW = CELL * COLS;
	const BH = CELL * ROWS;
	const colX = (c: number) => BX + c * CELL + CELL / 2;
	const rowY = (r: number) => BY + BH - r * CELL - CELL / 2;

	const discs = $derived.by(() => {
		const out: { c: number; r: number; who: number; k: number }[] = [];
		const p = new Position();
		[...game].forEach((ch, k) => {
			const c = Number(ch);
			out.push({ c, r: p.heights[c], who: p.toMove, k });
			p.play(c);
		});
		return out;
	});
	const line = $derived(pos.winningLine());
	const ghost = $derived(
		pending && analysis ? { c: analysis.best, r: pos.heights[analysis.best] } : null
	);
	const pulse = $derived(reduced ? 1 : 0.65 + 0.35 * Math.cos(t * 3.2));

	const winner = $derived(pos.won ? (pos.toMove === 2 ? 'red' : 'yellow') : null);
	const status = $derived(
		winner === 'red'
			? 'You win!'
			: winner === 'yellow'
				? 'The computer wins'
				: over
					? 'A draw: the board is full'
					: pending && analysis
						? `The computer would play column ${analysis.best + 1}`
						: computersTurn
							? 'The computer is thinking…'
							: 'Your turn: you play red'
	);

	// ---- the panel ----------------------------------------------------------------------
	const PX = 516;
	const PW = 56;
	const pcx = (c: number) => PX + c * PW + PW / 2;
	const BAR_TOP = 206;
	const BAR_BOT = 330;
	const barY = (n: number) => BAR_BOT - (Math.log10(Math.max(1, n)) / 7) * (BAR_BOT - BAR_TOP);
	const REPLY_Y = 382;
	const RS = 13;

	function scoreText(s: number) {
		if (s >= FORCED) return `wins in ${WIN - s}`;
		if (s <= -FORCED) return 'loses';
		return s > 0 ? `+${s}` : s < 0 ? `−${-s}` : '0';
	}
	const scoreColor = (s: number) =>
		s >= FORCED ? 'var(--gt-win-text)' : s <= -FORCED ? 'var(--gt-loss-text)' : 'var(--stage-ink)';

	const replyCount = $derived.by(() => {
		if (!analysis) return { seen: 0, all: 0 };
		let seen = 0;
		let all = 0;
		for (const m of analysis.root)
			for (const r of m.replies)
				if (r !== null) {
					all++;
					if (r) seen++;
				}
		return { seen, all };
	});
</script>

<g>
	<Readout id="c4-status" order={1} label="Game" value={status}>
		<Label x={BX} y={72} text={status} size={18} weight={700} anchor="start" />
	</Readout>
	<Readout id="c4-sub">
		<Label
			x={BX}
			y={94}
			text="You: red · computer: yellow · columns 1–7 from the left"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>

	<!-- the board -->
	<rect x={BX - 8} y={BY - 8} width={BW + 16} height={BH + 16} rx="14" fill="var(--gt-frame)" />
	{#each Array.from({ length: COLS * ROWS }, (_, i) => i) as i (i)}
		<circle cx={colX(Math.floor(i / ROWS))} cy={rowY(i % ROWS)} r="22" fill="var(--gt-hole)" />
	{/each}
	{#each discs as d (d.k)}
		<circle
			cx={colX(d.c)}
			cy={rowY(d.r)}
			r="22"
			fill={d.who === 1 ? 'var(--gt-red)' : 'var(--gt-yellow)'}
		/>
		{#if d.k === discs.length - 1}
			<circle
				cx={colX(d.c)}
				cy={rowY(d.r)}
				r="8"
				fill="none"
				stroke="#fff"
				stroke-width="2.5"
				opacity="0.85"
			/>
		{/if}
	{/each}
	{#if ghost}
		<circle
			cx={colX(ghost.c)}
			cy={rowY(ghost.r)}
			r="21"
			fill="var(--gt-yellow)"
			fill-opacity={0.35 * pulse}
			stroke="var(--gt-yellow)"
			stroke-width="3"
			stroke-dasharray="6 4"
		/>
	{/if}
	{#if line}
		<line
			x1={colX(Math.floor(line[0] / ROWS))}
			y1={rowY(line[0] % ROWS)}
			x2={colX(Math.floor(line[3] / ROWS))}
			y2={rowY(line[3] % ROWS)}
			stroke="var(--stage-ink)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.7"
		/>
	{/if}
	<!-- column buttons -->
	{#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
		{@const can = !over && (pending || !computersTurn) && pos.heights[c] < ROWS}
		<g
			class="col"
			class:can
			role="button"
			tabindex="0"
			aria-label="Column {c + 1}"
			aria-disabled={!can}
			onclick={() => drop(c)}
			onkeydown={(e) => onKey(e, () => drop(c))}
		>
			<rect
				x={BX + c * CELL}
				y={BY - 4}
				width={CELL}
				height={BH + 8}
				rx="8"
				fill="var(--stage-ink)"
				fill-opacity="0"
			/>
		</g>
	{/each}
	<Readout id="c4-cols">
		{#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
			<Label x={colX(c)} y={BY + BH + 30} text={String(c + 1)} size={12} muted />
		{/each}
	</Readout>

	<!-- the computer's decision -->
	<Readout id="c4-head">
		<Label
			x={PX}
			y={120}
			text={analysis
				? `Its seven moves, looking ${depth} move${depth === 1 ? '' : 's'} ahead`
				: 'Your move first'}
			size={14}
			weight={700}
			anchor="start"
		/>
	</Readout>
	{#if analysis}
		<Readout id="c4-scorelabel">
			<Label x={PX - 8} y={170} text="score" size={11} muted anchor="end" />
			<Label x={PX - 8} y={BAR_BOT - 40} text="positions" size={11} muted anchor="end" />
			<Label x={PX - 8} y={BAR_BOT - 26} text="examined" size={11} muted anchor="end" />
			{#if depth > 1}
				<Label x={PX - 8} y={REPLY_Y + 30} text="red's" size={11} muted anchor="end" />
				<Label x={PX - 8} y={REPLY_Y + 44} text="replies" size={11} muted anchor="end" />
			{/if}
		</Readout>
		<!-- bar grid: one line per factor of ten -->
		{#each [1, 2, 3, 4, 5, 6, 7] as e (e)}
			<line
				x1={PX}
				x2={PX + COLS * PW}
				y1={barY(10 ** e)}
				y2={barY(10 ** e)}
				stroke="var(--stage-grid)"
				stroke-width="1"
			/>
		{/each}
		<Readout id="c4-gridlabels">
			<Label x={PX + COLS * PW + 4} y={barY(10) + 4} text="10" size={10} muted anchor="start" />
			<Label x={PX + COLS * PW + 4} y={barY(1e3) + 4} text="1k" size={10} muted anchor="start" />
			<Label x={PX + COLS * PW + 4} y={barY(1e5) + 4} text="100k" size={10} muted anchor="start" />
			<Label x={PX + COLS * PW + 4} y={barY(1e7) + 4} text="10M" size={10} muted anchor="start" />
		</Readout>
		<line x1={PX} x2={PX + COLS * PW} y1={BAR_BOT} y2={BAR_BOT} stroke="var(--stage-line)" />
		{#each Array.from({ length: COLS }, (_, c) => c) as c (c)}
			{@const m = analysis.root.find((r) => r.col === c)}
			{@const chosen = analysis.best === c}
			{#if chosen}
				<rect
					x={pcx(c) - PW / 2 + 3}
					y={136}
					width={PW - 6}
					height={REPLY_Y + 7 * RS + 18 - 136}
					rx="10"
					fill="var(--gt-yellow)"
					fill-opacity="0.14"
					stroke="var(--gt-yellow)"
					stroke-width="2"
				/>
			{/if}
			<Label x={pcx(c)} y={152} text={String(c + 1)} size={12} weight={700} halo={false} />
			{#if m}
				<Label
					x={pcx(c)}
					y={174}
					text={(m.bound === 'upper' ? '≤ ' : '') + scoreText(m.score)}
					size={m.score >= FORCED ? 10 : 12}
					weight={700}
					color={scoreColor(m.score)}
					halo={false}
					tabular
				/>
				<rect
					x={pcx(c) - 12}
					y={barY(m.nodes)}
					width="24"
					height={BAR_BOT - barY(m.nodes)}
					rx="3"
					fill="var(--accent)"
					opacity={chosen ? 0.9 : 0.6}
				/>
				<Label
					x={pcx(c)}
					y={BAR_BOT + 16}
					text={fmt(m.nodes)}
					size={10}
					muted
					halo={false}
					tabular
				/>
				{#each m.replies as r, j (j)}
					{#if r !== null}
						<rect
							x={pcx(c) - RS / 2}
							y={REPLY_Y + j * RS}
							width={RS - 2}
							height={RS - 2}
							rx="2"
							fill={r ? 'var(--gt-red)' : 'none'}
							fill-opacity={r ? 0.75 : 0}
							stroke={r ? 'var(--gt-red)' : 'var(--gt-pruned)'}
							stroke-dasharray={r ? undefined : '2 2'}
						/>
					{/if}
				{/each}
			{:else}
				<Label x={pcx(c)} y={174} text="full" size={11} muted halo={false} />
			{/if}
		{/each}
		<Readout
			id="c4-count"
			order={2}
			label="Positions examined"
			value="{fmt(analysis.nodes)}{analysis.stopped ? ' (stopped)' : ''}"
		>
			<Label
				x={PX}
				y={540}
				text="Positions examined: {fmt(analysis.nodes)}{analysis.stopped ? ' (stopped early)' : ''}"
				size={15}
				weight={700}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="c4-setting"
			order={3}
			label="Search"
			value="{depth} moves ahead{offered.has('prune') ? ` · pruning ${prune ? 'on' : 'off'}` : ''}"
		>
			<Label
				x={PX}
				y={562}
				text="{depth} move{depth === 1 ? '' : 's'} ahead{offered.has('prune')
					? ` · pruning ${prune ? 'on' : 'off'}`
					: ''}{depth > 1 && prune && offered.has('prune')
					? ` · ${replyCount.seen} of ${replyCount.all} replies examined`
					: ''}"
				size={12}
				muted
				anchor="start"
			/>
		</Readout>
	{:else}
		<Readout id="c4-wait">
			<Label
				x={PX}
				y={150}
				text="Drop a disc: click a column. The computer's search appears here."
				size={13}
				muted
				anchor="start"
			/>
		</Readout>
	{/if}
</g>

<style>
	.col {
		outline: none;
	}
	.col.can {
		cursor: pointer;
	}
	.col.can:hover rect {
		fill-opacity: 0.06;
	}
	.col:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
