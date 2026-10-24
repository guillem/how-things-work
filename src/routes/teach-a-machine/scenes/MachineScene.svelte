<script lang="ts">
	/**
	 * The machine that learns from examples: a pile of labelled drawings, a drawing pad, the
	 * 10 × 10 squares a drawing is shrunk to, two drawings compared square by square, the three
	 * nearest stored drawings voting, a tiny pile tested on new drawings, the reader's own
	 * teaching, a pile where every cat sits at the top, and a fish it must call cat or house.
	 * Every count and vote comes from the model.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		GRID,
		decode,
		encode,
		guess,
		inked,
		squares,
		type Doodle,
		type Example,
		type Guess,
		type Label as Kind,
		type Point
	} from '../model';
	import { MIXED, PILE, READY, TESTS, TRAP } from '../doodles';
	import { count, doodlePath, gridPath, labelColor } from './draw';
	import Pad from './Pad.svelte';
	import PadButton from './PadButton.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'pile'));
	const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

	// ---- the drawing on the pad ----------------------------------------------------------------
	/** Which control picks the pad's drawing on this step, and its default. */
	const picker = $derived(
		phase === 'teach'
			? { id: 'ready', fallback: 'mine' }
			: phase === 'trap' || phase === 'varied'
				? { id: 'trial', fallback: 'catLow' }
				: { id: 'doodle', fallback: 'cat' }
	);
	const choice = $derived(String(params[picker.id] ?? picker.fallback));
	const mine = $derived(decode(String(params.mine ?? '')));
	const pad: Doodle = $derived(
		phase === 'fish' ? READY.fish.doodle : choice === 'mine' ? mine : (READY[choice]?.doodle ?? [])
	);
	const padCells = $derived(squares(pad));
	/** Strokes and points kept at most, so that the drawing stays a small parameter. */
	const MAX_STROKES = 40;
	function addStroke(stroke: Point[]) {
		if (choice !== 'mine') {
			// Drawing over a ready drawing starts a new one of the reader's own.
			setParam(picker.id, 'mine');
			setParam('mine', encode([stroke]));
		} else if (mine.length < MAX_STROKES) {
			setParam('mine', encode([...mine, stroke]));
		}
	}
	function clearPad() {
		setParam(picker.id, 'mine');
		setParam('mine', '');
	}

	// ---- the reader's own teaching -------------------------------------------------------------
	const MAX_TAUGHT = 16;
	const taught: Example[] = $derived(
		String(params.taught ?? '')
			.split('/')
			.filter(Boolean)
			.map((s) => ({ label: s[0] === 'c' ? 'cat' : 'house', doodle: decode(s.slice(2)) }))
	);
	function teach(label: Kind) {
		if (padCells.every((c) => !c) || taught.length >= MAX_TAUGHT) return;
		const entry = `${label[0]}:${encode(pad)}`;
		setParam('taught', [String(params.taught ?? ''), entry].filter(Boolean).join('/'));
		clearPad();
	}

	// ---- which pile the machine compares with --------------------------------------------------
	const n = $derived(Math.round(Number(params.examples ?? 1)));
	const mixed = $derived(params.mixed === true);
	const examples: Example[] = $derived(
		phase === 'teach'
			? taught
			: phase === 'trap'
				? TRAP
				: phase === 'varied'
					? mixed
						? [...TRAP, ...MIXED]
						: TRAP
					: phase === 'few'
						? PILE.slice(0, 2 * n)
						: PILE
	);
	const verdict: Guess = $derived(guess(pad, examples));
	const voters = $derived(new Set(verdict.voters.map((v) => v.index)));
	const differs = $derived(new Map(verdict.ranked.map((r) => [r.index, r.differ])));

	// ---- time since the last change worth animating ---------------------------------------------
	const key = $derived(
		`${phase}|${choice === 'mine' ? 'mine' : choice}|${n}|${mixed}|${String(params.against)}`
	);
	let t0 = $state(0);
	$effect(() => {
		void key;
		t0 = untrack(() => t);
	});
	const since = $derived(reduced ? 99 : Math.max(0, t - t0));

	// ---- layout ---------------------------------------------------------------------------------
	const PAD = { x: 36, y: 96, size: 300 };
	const padPhases = ['squares', 'compare', 'vote', 'teach', 'trap', 'varied', 'fish'];
	const showPad = $derived(padPhases.includes(phase));
	const interactive = $derived(showPad && phase !== 'fish');
	/** The 4 × 4 grid of stored drawings on the right. */
	const CARD = { w: 134, h: 100, gx: 11, gy: 12, x: 372, y: 104 };
	const cardAt = (i: number) => ({
		x: CARD.x + (i % 4) * (CARD.w + CARD.gx),
		y: CARD.y + Math.floor(i / 4) * (CARD.h + CARD.gy)
	});
	const cardPhases = ['vote', 'teach', 'trap', 'varied', 'fish'];
	const showCards = $derived(cardPhases.includes(phase));
	/** The cards' differences show one after another, then the votes. */
	const shownUpTo = $derived(Math.floor((since - 0.2) / 0.1));
	const votesIn = $derived(clamp01((since - 0.3 - examples.length * 0.1) / 0.4));
	const mixedIn = Tween.of(() => (mixed ? 1 : 0), { duration: 700, easing: cubicInOut });
	const cards = $derived(
		phase === 'varied'
			? [...TRAP, ...MIXED].map((e, i) => ({
					e,
					i,
					opacity: i < TRAP.length ? 1 : 0.15 + 0.85 * mixedIn.current
				}))
			: examples.map((e, i) => ({ e, i, opacity: 1 }))
	);

	// ---- squares --------------------------------------------------------------------------------
	const BIG = { x: 440, y: 96, size: 300 };
	const gridIn = $derived(clamp01(since / 0.6));
	const cellsIn = $derived(Math.floor(clamp01((since - 0.6) / 1.6) * GRID * GRID));
	const inkCount = $derived(inked(padCells));

	// ---- compare --------------------------------------------------------------------------------
	const AGAINST: Record<string, { name: string; index: number }> = {
		cat: { name: 'a stored cat', index: 2 },
		sitting: { name: 'the sitting cat', index: 0 },
		long: { name: 'the long, low house', index: 1 },
		house: { name: 'a stored house', index: 3 }
	};
	const other = $derived(AGAINST[String(params.against ?? 'cat')] ?? AGAINST.cat);
	const otherEx = $derived(PILE[other.index]);
	const otherCells = $derived(squares(otherEx.doodle));
	const diffCells = $derived(padCells.map((c, i) => c !== otherCells[i]));
	const SMALL = 170;
	const GX = [370, 570, 770];
	const GY = 132;
	/** The differing squares light up one after another, row by row. */
	const diffIn = $derived(Math.floor(clamp01((since - 0.4) / 1.4) * GRID * GRID));
	const diffShown = $derived(diffCells.filter((d, i) => d && i < diffIn).length);

	// ---- few examples ----------------------------------------------------------------------------
	const testGuesses = $derived(TESTS.map((x) => guess(x.doodle, PILE.slice(0, 2 * n))));
	const right = $derived(testGuesses.filter((g, i) => g.label === TESTS[i].label).length);
	const testIn = (i: number) => clamp01((since - 0.3 - i * 0.2) / 0.3);
	const TCARD = { w: 134, h: 190, gx: 11, gy: 14, x: 372, y: 112 };
	const MINI = { s: 70, g: 6, x: 36, y: 112 };

	// ---- words ------------------------------------------------------------------------------------
	function tally(g: Guess): string {
		if (g.voters.length === 1) return `Its nearest drawing is a ${g.voters[0].label}`;
		return `Nearest three: ${count(g.votes.cat, 'cat')}, ${count(g.votes.house, 'house')}`;
	}
	const answerLine = $derived.by(() => {
		if (inked(padCells) === 0) return { top: 'The pad is empty', big: 'Draw something' };
		if (examples.length === 0)
			return { top: 'It has nothing to compare with yet', big: 'Teach it first' };
		return { top: tally(verdict), big: `It says: ${verdict.label}` };
	});
	const pileTitle = $derived(
		phase === 'teach'
			? taught.length
				? `What you taught it: ${count(taught.filter((e) => e.label === 'cat').length, 'cat')}, ${count(taught.filter((e) => e.label === 'house').length, 'house')}`
				: 'What you taught it: nothing yet'
			: phase === 'trap'
				? 'A sneaky pile: cats at the top, houses at the bottom'
				: phase === 'varied'
					? mixed
						? 'The sneaky pile, with cats low and houses high'
						: 'The sneaky pile: cats at the top, houses at the bottom'
					: 'The pile it learned from'
	);
	const pileIn = (i: number) => (reduced ? 1 : clamp01((t - i * 0.12) / 0.4));
</script>

{#snippet thumb(d: Doodle, x: number, y: number, s: number, width = 1.6)}
	<rect
		{x}
		{y}
		width={s}
		height={s}
		rx="4"
		fill="var(--tam-pad)"
		stroke="var(--tam-pad-edge)"
		stroke-width="1"
	/>
	<path
		d={doodlePath(d, x, y, s)}
		fill="none"
		stroke="var(--tam-ink)"
		stroke-width={width}
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
{/snippet}

{#snippet cellGrid(
	cells: readonly boolean[],
	x: number,
	y: number,
	s: number,
	fill: string,
	upTo = GRID * GRID,
	opacity = 0.75
)}
	{@const c = s / GRID}
	<rect {x} {y} width={s} height={s} rx="4" fill="var(--tam-pad)" stroke="var(--tam-pad-edge)" />
	{#each cells as on, i (i)}
		{#if on && i < upTo}
			<rect
				x={x + (i % GRID) * c + 0.5}
				y={y + Math.floor(i / GRID) * c + 0.5}
				width={c - 1}
				height={c - 1}
				rx="2"
				{fill}
				{opacity}
			/>
		{/if}
	{/each}
	<path d={gridPath(x, y, s, GRID)} stroke="var(--tam-grid)" stroke-width="1" fill="none" />
{/snippet}

{#snippet answer(top: string, big: string, color: string)}
	<Readout id="answer" order={1} label="Its answer" value={big} note={top}>
		<g transform="translate({PAD.x}, 468)">
			<rect width={PAD.size} height="96" rx="12" fill="var(--surface)" stroke="var(--border)" />
			<Label x={PAD.size / 2} y={30} text={top} size={14} muted halo={false} />
			<Label x={PAD.size / 2} y={70} text={big} size={28} weight={800} {color} halo={false} />
		</g>
	</Readout>
{/snippet}

<g>
	<!-- ---------------------------------------------------------------- the pile -->
	{#if phase === 'pile'}
		<Readout
			id="pile"
			order={1}
			label="The pile"
			value="16 drawings"
			note="8 cats and 8 houses, each labelled"
		>
			<Label x={480} y={72} text="16 drawings, each with its label" size={24} weight={800} />
			<Label x={480} y={100} text="8 cats and 8 houses" size={15} muted />
		</Readout>
		{#each PILE as e, i (i)}
			{@const x = 28 + (i % 8) * 114}
			{@const y = 136 + Math.floor(i / 8) * 172}
			{@const k = pileIn(i)}
			<g opacity={k} transform="translate(0, {(1 - k) * -14})">
				<rect
					{x}
					{y}
					width="106"
					height="150"
					rx="10"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				{@render thumb(e.doodle, x + 8, y + 8, 90, 2)}
				<rect x={x + 18} y={y + 110} width="70" height="28" rx="14" fill={labelColor(e.label)} />
				<text
					x={x + 53}
					y={y + 129}
					text-anchor="middle"
					font-size="15"
					font-weight="700"
					fill="#fff">{e.label}</text
				>
			</g>
		{/each}
		<Readout id="only">
			<Label
				x={480}
				y={520}
				text="The machine learns from these, and from nothing else."
				size={17}
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- the pad -->
	{#if showPad}
		<Readout id="padtitle">
			<Label
				x={PAD.x + PAD.size / 2}
				y={78}
				text={phase === 'fish' ? 'Something new: a fish' : 'The drawing pad'}
				size={16}
				weight={700}
			/>
		</Readout>
		<Pad
			x={PAD.x}
			y={PAD.y}
			size={PAD.size}
			doodle={pad}
			{interactive}
			grid={phase === 'squares' ? gridIn : phase === 'compare' ? 0.6 : 0}
			cells={phase === 'squares' ? padCells : null}
			onstroke={addStroke}
		/>
		{#if phase === 'teach'}
			<PadButton
				id="cat"
				x={PAD.x}
				y={410}
				w={104}
				label="It’s a cat"
				color="var(--tam-cat)"
				disabled={inkCount === 0 || taught.length >= MAX_TAUGHT}
				onpress={() => teach('cat')}
			/>
			<PadButton
				id="house"
				x={PAD.x + 112}
				y={410}
				w={116}
				label="It’s a house"
				color="var(--tam-house)"
				disabled={inkCount === 0 || taught.length >= MAX_TAUGHT}
				onpress={() => teach('house')}
			/>
			<PadButton
				id="clear"
				x={PAD.x + 236}
				y={410}
				w={64}
				label="Clear"
				disabled={inkCount === 0}
				onpress={clearPad}
			/>
		{:else if interactive}
			<PadButton
				id="clear"
				x={PAD.x}
				y={410}
				w={132}
				label="Clear the pad"
				disabled={inkCount === 0}
				onpress={clearPad}
			/>
		{/if}
	{/if}

	<!-- ---------------------------------------------------------------- squares -->
	{#if phase === 'squares'}
		<path
			d="M350 246 H418"
			stroke="var(--stage-ink-muted)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
			opacity={gridIn}
		/>
		<Readout id="seen">
			<Label x={BIG.x + BIG.size / 2} y={78} text="What the machine keeps" size={16} weight={700} />
		</Readout>
		{@render cellGrid(padCells, BIG.x, BIG.y, BIG.size, 'var(--tam-square)', cellsIn)}
		<Readout
			id="inked"
			order={1}
			label="Squares inked"
			value="{inkCount} of 100"
			opacity={clamp01((since - 2.2) / 0.4)}
		>
			<g opacity={clamp01((since - 2.2) / 0.4)}>
				<Label x={850} y={226} text={String(inkCount)} size={48} weight={800} tabular />
				<Label x={850} y={256} text="squares inked" size={16} />
				<Label x={850} y={278} text="out of 100" size={14} muted />
			</g>
		</Readout>
		<Readout id="squares-note">
			<Label
				x={BIG.x + BIG.size / 2 + 60}
				y={440}
				text="A square is inked if a line passes through it."
				size={15}
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- compare -->
	{#if phase === 'compare'}
		<Readout id="compare-titles">
			<Label x={GX[0] + SMALL / 2} y={GY - 16} text="Your drawing" size={15} weight={700} />
			<Label
				x={GX[1] + SMALL / 2}
				y={GY - 16}
				text={other.name[0].toUpperCase() + other.name.slice(1)}
				size={15}
				weight={700}
				color={labelColor(otherEx.label)}
			/>
			<Label x={GX[2] + SMALL / 2} y={GY - 16} text="Squares that differ" size={15} weight={700} />
		</Readout>
		{@render cellGrid(padCells, GX[0], GY, SMALL, 'var(--tam-square)')}
		<path
			d={doodlePath(pad, GX[0], GY, SMALL)}
			fill="none"
			stroke="var(--tam-ink)"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.7"
		/>
		{@render cellGrid(otherCells, GX[1], GY, SMALL, labelColor(otherEx.label))}
		<path
			d={doodlePath(otherEx.doodle, GX[1], GY, SMALL)}
			fill="none"
			stroke="var(--tam-ink)"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.7"
		/>
		{@render cellGrid(diffCells, GX[2], GY, SMALL, 'var(--tam-differ)', diffIn, 0.9)}
		<Readout id="inks">
			<Label x={GX[0] + SMALL / 2} y={GY + SMALL + 24} text="{inkCount} inked" size={14} muted />
			<Label
				x={GX[1] + SMALL / 2}
				y={GY + SMALL + 24}
				text="{inked(otherCells)} inked"
				size={14}
				muted
			/>
		</Readout>
		<Readout id="differ" order={1} label="Squares that differ" value={String(diffShown)}>
			<Label
				x={GX[2] + SMALL / 2}
				y={GY + SMALL + 56}
				text={String(diffShown)}
				size={44}
				weight={800}
				color="var(--tam-differ)"
				tabular
			/>
			<Label x={GX[2] + SMALL / 2} y={GY + SMALL + 84} text="squares differ" size={16} />
		</Readout>
		<Readout id="compare-note">
			<Label
				x={655}
				y={470}
				text="Fewer squares different: more alike, to the machine."
				size={16}
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- the stored cards -->
	{#if showCards}
		<Readout id="piletitle">
			<Label x={CARD.x + 284} y={78} text={pileTitle} size={16} weight={700} />
		</Readout>
		{#if phase === 'teach'}
			{#each Array.from({ length: MAX_TAUGHT }, (_, i) => i).slice(taught.length) as i (i)}
				{@const p = cardAt(i)}
				<rect
					x={p.x}
					y={p.y}
					width={CARD.w}
					height={CARD.h}
					rx="10"
					fill="none"
					stroke="var(--border)"
					stroke-dasharray="5 5"
				/>
			{/each}
		{/if}
		{#each cards as c (c.i)}
			{@const p = cardAt(c.i)}
			{@const vote = voters.has(c.i) && c.i < examples.length}
			{@const d = differs.get(c.i)}
			{@const color = labelColor(c.e.label)}
			<g opacity={c.opacity}>
				<rect
					x={p.x}
					y={p.y}
					width={CARD.w}
					height={CARD.h}
					rx="10"
					fill="var(--surface)"
					stroke={vote && votesIn > 0 ? color : 'var(--border)'}
					stroke-width={vote ? 1 + 3 * votesIn : 1}
				/>
				{@render thumb(c.e.doodle, p.x + 8, p.y + 12, 76)}
				<Label
					x={p.x + 108}
					y={p.y + 30}
					text={c.e.label}
					size={14}
					weight={700}
					{color}
					halo={false}
				/>
				{#if d !== undefined && inkCount > 0 && c.i < shownUpTo}
					<Label
						x={p.x + 108}
						y={p.y + 62}
						text={String(d)}
						size={22}
						weight={800}
						tabular
						halo={false}
					/>
					<Label x={p.x + 108} y={p.y + 80} text="differ" size={11} muted halo={false} />
				{/if}
				{#if vote && inkCount > 0}
					<g opacity={votesIn}>
						<rect x={p.x + CARD.w - 46} y={p.y - 10} width="44" height="20" rx="10" fill={color} />
						<text
							x={p.x + CARD.w - 24}
							y={p.y + 4}
							text-anchor="middle"
							font-size="12"
							font-weight="700"
							fill="#fff">votes</text
						>
					</g>
				{/if}
			</g>
		{/each}
		{#if phase === 'teach' && taught.length > 0}
			<PadButton
				id="forget"
				x={CARD.x + 568 - 170}
				y={548}
				w={170}
				h={34}
				label="Forget everything"
				onpress={() => setParam('taught', '')}
			/>
		{/if}
		<g opacity={inkCount === 0 || examples.length === 0 ? 1 : votesIn}>
			{@render answer(
				answerLine.top,
				answerLine.big,
				inkCount === 0 || examples.length === 0
					? 'var(--stage-ink-muted)'
					: labelColor(verdict.label)
			)}
		</g>
		{#if phase === 'fish'}
			<Readout id="fishnote">
				<Label x={PAD.x + PAD.size / 2} y={428} text="It only knows two labels." size={15} muted />
			</Readout>
		{/if}
	{/if}

	<!-- ---------------------------------------------------------------- few examples -->
	{#if phase === 'few'}
		<Readout id="shown-title">
			<Label x={MINI.x + 149} y={78} text="What it was shown" size={16} weight={700} />
		</Readout>
		{#each PILE as e, i (i)}
			{@const x = MINI.x + (i % 4) * (MINI.s + MINI.g)}
			{@const y = MINI.y + Math.floor(i / 4) * (MINI.s + MINI.g)}
			{@const on = i < 2 * n}
			<g opacity={on ? 1 : 0.2}>
				{@render thumb(e.doodle, x, y, MINI.s, 1.3)}
				<rect
					x={x + 2}
					y={y + MINI.s - 10}
					width={MINI.s - 4}
					height="8"
					rx="4"
					fill={labelColor(e.label)}
				/>
			</g>
		{/each}
		<Readout id="shown" order={2} label="Shown" value="{count(n, 'cat')} and {count(n, 'house')}">
			<Label
				x={MINI.x + 149}
				y={440}
				text="{count(n, 'cat')} and {count(n, 'house')}"
				size={18}
				weight={700}
			/>
			<Label
				x={MINI.x + 149}
				y={464}
				text={n === 1 ? 'only two: the nearer one decides' : 'the nearest three vote'}
				size={14}
				muted
			/>
		</Readout>
		<Readout id="tests-title">
			<Label
				x={TCARD.x + 284}
				y={78}
				text="8 new drawings it has never seen"
				size={16}
				weight={700}
			/>
		</Readout>
		{#each TESTS as e, i (i)}
			{@const x = TCARD.x + (i % 4) * (TCARD.w + TCARD.gx)}
			{@const y = TCARD.y + Math.floor(i / 4) * (TCARD.h + TCARD.gy)}
			{@const g = testGuesses[i]}
			{@const ok = g.label === e.label}
			{@const k = testIn(i)}
			<g>
				<rect
					{x}
					{y}
					width={TCARD.w}
					height={TCARD.h}
					rx="10"
					fill="var(--surface)"
					stroke={k > 0.5 ? (ok ? 'var(--tam-right)' : 'var(--tam-differ)') : 'var(--border)'}
					stroke-width={k > 0.5 ? 2.5 : 1}
				/>
				{@render thumb(e.doodle, x + 12, y + 10, 110, 1.8)}
				<g opacity={k}>
					<Label
						x={x + TCARD.w / 2}
						y={y + 144}
						text="It says: {g.label}"
						size={15}
						weight={700}
						color={labelColor(g.label)}
						halo={false}
					/>
					<Label
						x={x + TCARD.w / 2}
						y={y + 170}
						text={(ok ? '✓ right' : '✗ wrong') +
							(g.voters.length === 3
								? ` · ${Math.max(g.votes.cat, g.votes.house)} to ${Math.min(g.votes.cat, g.votes.house)}`
								: '')}
						size={13}
						weight={600}
						color={ok ? 'var(--tam-right)' : 'var(--tam-differ)'}
						halo={false}
					/>
				</g>
			</g>
		{/each}
		<Readout id="score" order={1} label="Right" value="{right} of 8" opacity={testIn(TESTS.length)}>
			<Label
				x={TCARD.x + 284}
				y={548}
				text="Right: {right} of 8"
				size={24}
				weight={800}
				opacity={testIn(TESTS.length)}
				tabular
			/>
		</Readout>
	{/if}
</g>
