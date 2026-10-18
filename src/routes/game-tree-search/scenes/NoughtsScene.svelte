<script lang="ts">
	/**
	 * Noughts and crosses against a full minimax search. The game lives in `params.tttGame` (the
	 * squares played, in order, as digits); whoever starts (`params.tttFirst`) plays X. When it is
	 * the computer's turn, an effect plays its move at once (`analyse` in ../noughts.ts, memoised,
	 * so even the empty board answers instantly). On the right: the computer's last decision,
	 * every move it could make with the outcome a perfect game from there gives it, and the
	 * number of positions a plain minimax search examines to find that out.
	 *
	 * The squares are buttons (Tab, then Enter or Space).
	 */
	import { untrack } from 'svelte';
	import { Label, clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		analyse,
		fromMoves,
		isOver,
		play,
		toMove,
		winner,
		winningLine,
		type Mark
	} from '../noughts';
	import MiniBoard from './MiniBoard.svelte';
	import {
		fmt,
		onKey,
		outcomeColor,
		outcomeOf,
		outcomeText,
		pressWatcher,
		type Outcome
	} from './shared';

	let { t, params, setParam, reduced }: StageProps = $props();

	const first = $derived(params.tttFirst === 'computer' ? 'computer' : 'you');
	const computer = $derived<Mark>(first === 'computer' ? 'X' : 'O');
	const you = $derived<Mark>(computer === 'X' ? 'O' : 'X');

	/** The squares played, kept only while every move is legal. */
	const squares = $derived.by(() => {
		const s = String(params.tttGame ?? '');
		const list = [...s].map(Number);
		try {
			fromMoves(list);
			return list;
		} catch {
			return [];
		}
	});
	const game = $derived(squares.join(''));
	const board = $derived(fromMoves(squares));
	const over = $derived(isOver(board));
	const computersTurn = $derived(!over && toMove(board) === computer);

	// The computer moves as soon as it is its turn.
	$effect(() => {
		if (!computersTurn) return;
		const g = game;
		const b = board;
		untrack(() => setParam('tttGame', g + String(analyse(b).best)));
	});

	// A new game: the button, or a change of who starts.
	const fresh = pressWatcher(untrack(() => Number(params.tttNew ?? 0)));
	let lastFirst = untrack(() => first);
	$effect(() => {
		const presses = Number(params.tttNew ?? 0);
		const f = first;
		untrack(() => {
			const changed = f !== lastFirst;
			lastFirst = f;
			if (fresh(presses) || changed) setParam('tttGame', '');
		});
	});

	/** The computer's last decision: the position before its last move. */
	const decision = $derived.by(() => {
		const offset = computer === 'X' ? 0 : 1;
		let k = -1;
		for (let i = offset; i < squares.length; i += 2) k = i;
		if (k < 0) return null;
		const before = fromMoves(squares.slice(0, k));
		const a = analyse(before);
		return { before, ...a, played: squares[k] };
	});

	function move(sq: number) {
		if (over || computersTurn || board[sq] !== '.') return;
		setParam('tttGame', game + String(sq));
	}

	// ---- layout -----------------------------------------------------------------
	const BX = 64;
	const BY = 128;
	const CELL = 112;
	const B = CELL * 3;
	const cx = (i: number) => BX + (i % 3) * CELL + CELL / 2;
	const cy = (i: number) => BY + Math.floor(i / 3) * CELL + CELL / 2;

	const line = $derived(winningLine(board));
	const w = $derived(winner(board));
	const status = $derived(
		w === you
			? 'You win!'
			: w === computer
				? 'The computer wins'
				: over
					? 'A draw'
					: computersTurn
						? 'The computer is thinking…'
						: `Your turn: you play ${you}`
	);
	const lastSquare = $derived(squares.length ? squares[squares.length - 1] : -1);
	// The newest mark fades in (a pure function of t: the step clock restarts on a new step only,
	// so this is a gentle pulse on the last mark rather than a timed animation).
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.cos(t * 3));

	// The panel: the computer's options as small boards, three to a row.
	const PX = 520;
	const PY = 132;
	const MINI = 72;
	const option = (k: number) => ({ x: PX + (k % 3) * 140, y: PY + Math.floor(k / 3) * 128 });
	const label: Record<Outcome, string> = { win: 'it wins', draw: 'a draw', loss: 'it loses' };
	const appear = $derived(reduced ? 1 : smoothstep(0, 0.6, t));
</script>

<g>
	<Readout id="ttt-status" order={1} label="Game" value={status}>
		<Label x={BX} y={88} text={status} size={18} weight={700} anchor="start" />
	</Readout>
	<Readout id="ttt-marks">
		<Label x={BX} y={110} text="You: {you} · computer: {computer}" size={12} muted anchor="start" />
	</Readout>

	<!-- the board -->
	<rect
		x={BX - 8}
		y={BY - 8}
		width={B + 16}
		height={B + 16}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<path
		d="M{BX + CELL} {BY + 8}V{BY + B - 8}M{BX + 2 * CELL} {BY + 8}V{BY + B - 8}M{BX + 8} {BY +
			CELL}H{BX + B - 8}M{BX + 8} {BY + 2 * CELL}H{BX + B - 8}"
		stroke="var(--stage-line)"
		stroke-width="3"
		stroke-linecap="round"
		fill="none"
	/>
	{#each Array.from({ length: 9 }, (_, i) => i) as i (i)}
		{@const ch = board[i]}
		{@const free = ch === '.' && !over && !computersTurn}
		<g
			class="sq"
			class:free
			role="button"
			tabindex="0"
			aria-label="Square {Math.floor(i / 3) + 1}, {(i % 3) + 1}: {ch === '.' ? 'empty' : ch}"
			aria-disabled={!free}
			onclick={() => move(i)}
			onkeydown={(e) => onKey(e, () => move(i))}
		>
			<rect
				x={BX + (i % 3) * CELL + 6}
				y={BY + Math.floor(i / 3) * CELL + 6}
				width={CELL - 12}
				height={CELL - 12}
				rx="10"
				fill="var(--stage-grid)"
				fill-opacity={free ? 0.35 : 0}
			/>
			{#if ch === 'X'}
				<path
					d="M{cx(i) - 30} {cy(i) - 30}L{cx(i) + 30} {cy(i) + 30}M{cx(i) + 30} {cy(i) - 30}L{cx(i) -
						30} {cy(i) + 30}"
					stroke="var(--gt-x)"
					stroke-width="10"
					stroke-linecap="round"
					opacity={i === lastSquare && !over ? 0.75 + 0.25 * pulse : 1}
				/>
			{:else if ch === 'O'}
				<circle
					cx={cx(i)}
					cy={cy(i)}
					r="32"
					fill="none"
					stroke="var(--gt-o)"
					stroke-width="10"
					opacity={i === lastSquare && !over ? 0.75 + 0.25 * pulse : 1}
				/>
			{/if}
		</g>
	{/each}
	{#if line}
		<line
			x1={cx(line[0])}
			y1={cy(line[0])}
			x2={cx(line[2])}
			y2={cy(line[2])}
			stroke="var(--stage-ink)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.75"
			style:pointer-events="none"
		/>
	{/if}

	<!-- the computer's mind -->
	<Readout id="ttt-head">
		<Label
			x={PX - 6}
			y={88}
			text="The computer's last choice: each move it could make"
			size={14}
			weight={700}
			anchor="start"
		/>
	</Readout>
	{#if decision}
		<Readout id="ttt-sub">
			<Label
				x={PX - 6}
				y={110}
				text="and what it leads to if both sides then play perfectly"
				size={12}
				muted
				anchor="start"
			/>
		</Readout>
		{#each decision.options as o, k (o.square)}
			{@const p = option(k)}
			{@const oc = outcomeOf(o.score)}
			{@const chosen = o.square === decision.played}
			<g opacity={clamp(appear * 1.2 - k * 0.03, 0, 1)}>
				<MiniBoard
					x={p.x}
					y={p.y}
					size={MINI}
					board={play(decision.before, o.square)}
					mark={o.square}
					outline={chosen ? 'var(--stage-ink)' : undefined}
				/>
				<rect
					x={p.x - 8}
					y={p.y + MINI + 8}
					width={MINI + 16}
					height="22"
					rx="11"
					fill={outcomeColor[oc]}
					fill-opacity="0.16"
					stroke={outcomeColor[oc]}
				/>
				<Label
					x={p.x + MINI / 2}
					y={p.y + MINI + 23}
					text={label[oc]}
					size={12}
					weight={700}
					color={outcomeText[oc]}
					halo={false}
				/>
				{#if chosen}
					<Label
						x={p.x + MINI + 10}
						y={p.y + 14}
						text="played"
						size={11}
						weight={700}
						anchor="start"
					/>
				{/if}
			</g>
		{/each}
		<Readout
			id="ttt-count"
			order={2}
			label="Positions examined"
			value="{fmt(decision.nodes)} to choose that move"
		>
			<Label
				x={PX - 6}
				y={548}
				text="To choose, a full search examines {fmt(decision.nodes)} positions"
				size={14}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
	{:else}
		<Readout id="ttt-wait" order={2} label="The computer" value="waiting for your first move">
			<Label
				x={PX - 6}
				y={150}
				text="Make your first move: the computer's options appear here."
				size={13}
				muted
				anchor="start"
			/>
		</Readout>
	{/if}
	{#if over}
		<Readout id="ttt-again">
			<Label x={BX + B / 2} y={BY + B + 48} text="Press “New game” to play again" size={12} muted />
		</Readout>
	{/if}
</g>

<style>
	.sq {
		outline: none;
	}
	.sq.free {
		cursor: pointer;
	}
	.sq:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
