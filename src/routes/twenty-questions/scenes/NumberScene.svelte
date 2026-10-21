<script lang="ts">
	/**
	 * Guess my number, and the halving ladder.
	 *
	 * - `game`: the reader thinks of a number from 1 to 100 and answers "Is it bigger than …?" with
	 *   the Yes and No buttons. The bar holds the hundred numbers; those an answer rules out go
	 *   dark (`afterAnswers` in the model). The answers are kept in `params.ans` ('y' and 'n'), so
	 *   they survive a visit to another step; "Start again" (`params.restart`) clears them.
	 * - `ladder`: for 100 to a million numbers (`params.many`), one row per question, each bar the
	 *   most numbers that can still be left after it (`ladder`), written out one row after another.
	 * - `next`: the million ladder, as the page's summary.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import { afterAnswers, ladder } from '../model';
	import Button from './Button.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const readouts = useReadouts();
	const narrow = $derived(readouts?.out ?? false);
	const phase = $derived(String(step.hints?.phase ?? 'game'));

	// ---- the game ------------------------------------------------------------------------------
	const answers = $derived(
		[...String(params.ans ?? '')].filter((c) => c === 'y' || c === 'n').map((c) => c === 'y')
	);
	const game = $derived(afterAnswers(answers));
	const asked = $derived(Math.min(answers.length, 7));
	const done = $derived(game.mid === null);

	const presses = $derived(Math.round(Number(params.restart ?? 0)) || 0);
	let seen = untrack(() => presses);
	$effect(() => {
		const p = presses;
		untrack(() => {
			if (p === seen) return;
			seen = p;
			setParam('ans', '');
		});
	});
	function answer(yes: boolean) {
		if (done) return;
		setParam('ans', String(params.ans ?? '') + (yes ? 'y' : 'n'));
	}

	// The lit part of the bar slides to its new ends.
	const tw = { duration: 700, easing: cubicInOut };
	const lo = Tween.of(
		() => game.lo,
		untrack(() => (reduced ? { duration: 0 } : tw))
	);
	const hi = Tween.of(
		() => game.hi,
		untrack(() => (reduced ? { duration: 0 } : tw))
	);

	const BAR_X = 30;
	const CELL = 9;
	const BAR_Y = $derived(narrow ? 150 : 140);
	const BAR_H = $derived(narrow ? 110 : 80);
	const cellX = (n: number) => BAR_X + (n - 1) * CELL;
	const lit = (n: number) => (clamp(n - lo.current + 1) * clamp(hi.current - n + 1) > 0.5 ? 1 : 0);
	const bob = $derived(reduced ? 0 : 4 * wave(t, 1.6));

	// ---- the ladder ----------------------------------------------------------------------------
	const many = $derived(phase === 'next' ? 1_000_000 : Number(params.many ?? 100) || 100);
	const rows = $derived(ladder(many));
	const fmt = (n: number) => n.toLocaleString('en-US');
	const nice = (n: number) => (n === 1_000_000 ? 'A million' : fmt(n));
	let since = $state(0);
	let lastMany = untrack(() => many);
	$effect(() => {
		const m = many;
		untrack(() => {
			if (m !== lastMany) {
				lastMany = m;
				since = t;
			}
		});
	});
	const local = $derived(reduced ? 99 : Math.max(0, t - since));
	const ROW_TOP = 96;
	const pitch = $derived(Math.min(54, 430 / rows.length));
	const shown = (i: number) => clamp((local - 0.3 - i * 0.28) / 0.25);
	const LAD_X = 150;
	const LAD_W = 640;
</script>

<g class="number">
	{#if phase === 'game'}
		<Readout id="nb-title">
			<Label
				x={480}
				y={60}
				text={done ? 'Got it!' : 'Think of a number from 1 to 100'}
				size={26}
				weight={700}
				halo={false}
			/>
		</Readout>

		<!-- the hundred numbers -->
		{#each { length: 100 }, i (i)}
			{@const n = i + 1}
			{@const on = lit(n)}
			<rect
				x={cellX(n) + 0.5}
				y={BAR_Y}
				width={CELL - 1}
				height={BAR_H}
				rx="2"
				fill={on ? 'var(--tq-live)' : 'var(--tq-gone)'}
				opacity={on ? 1 : 0.6}
			/>
		{/each}
		{#each [1, 25, 50, 75, 100] as n (n)}
			<Label
				x={cellX(n) + CELL / 2}
				y={BAR_Y + BAR_H + (narrow ? 34 : 22)}
				text={String(n)}
				size={narrow ? 26 : 14}
				muted
				halo={false}
			/>
		{/each}
		{#if !done && game.mid !== null}
			<!-- a pointer at the middle of what is left -->
			<path d="M {cellX(game.mid) + CELL} {BAR_Y - 6 - bob} l -9 -14 h 18 Z" fill="var(--tq-hot)" />
		{/if}

		<Readout
			id="nb-left"
			order={2}
			label="Could still be"
			value={done ? String(game.lo) : `${game.lo} to ${game.hi}`}
		>
			<Label
				x={480}
				y={BAR_Y - 30}
				text={done
					? `${game.lo}`
					: `Still possible: ${game.lo} to ${game.hi} (${game.hi - game.lo + 1} numbers)`}
				size={16}
				weight={600}
				halo={false}
				opacity={done ? 0 : 1}
			/>
		</Readout>

		{#if done}
			<Readout
				id="nb-found"
				order={1}
				label="Your number"
				value="{game.lo}, found in {asked} questions"
				color="var(--tq-good)"
			>
				<text
					x={480}
					y={BAR_Y + BAR_H + 130}
					text-anchor="middle"
					font-size="56"
					font-weight="800"
					fill="var(--tq-good)">{game.lo}</text
				>
				<Label
					x={480}
					y={BAR_Y + BAR_H + 172}
					text="Your number, found with {asked} questions"
					size={20}
					weight={700}
					halo={false}
				/>
			</Readout>
			<Readout
				id="nb-one"
				order={3}
				label="One at a time"
				value="“Is it 1? Is it 2? …” takes {game.lo}"
			>
				<Label
					x={480}
					y={BAR_Y + BAR_H + 206}
					text="Asking “Is it 1? Is it 2? …” one at a time would take {game.lo} {game.lo === 1
						? 'question'
						: 'questions'}."
					size={16}
					muted
					halo={false}
				/>
			</Readout>
		{:else if game.mid !== null}
			<Readout id="nb-q" order={1} label="The question" value="Is it bigger than {game.mid}?">
				<Label
					x={480}
					y={BAR_Y + BAR_H + 82}
					text="Is your number bigger than {game.mid}?"
					size={24}
					weight={700}
					halo={false}
				/>
			</Readout>
			<Button
				x={narrow ? 250 : 320}
				y={BAR_Y + BAR_H + (narrow ? 110 : 104)}
				w={narrow ? 210 : 140}
				h={narrow ? 90 : 52}
				size={narrow ? 36 : 20}
				anchor="middle"
				text="Yes"
				label="Yes, bigger than {game.mid}"
				fill="var(--tq-live)"
				stroke="var(--tq-live-edge)"
				onpress={() => answer(true)}
			/>
			<Button
				x={narrow ? 500 : 500}
				y={BAR_Y + BAR_H + (narrow ? 110 : 104)}
				w={narrow ? 210 : 140}
				h={narrow ? 90 : 52}
				size={narrow ? 36 : 20}
				anchor="middle"
				text="No"
				label="No, not bigger than {game.mid}"
				onpress={() => answer(false)}
			/>
		{/if}

		<!-- the counter: seven places -->
		{@const cy = narrow ? 560 : 540}
		<Readout id="nb-count" order={4} label="Questions asked" value="{asked} (never more than 7)">
			<Label
				x={300}
				y={cy + 6}
				text="Questions asked: {asked}"
				size={17}
				weight={600}
				anchor="end"
				halo={false}
			/>
			{#each { length: 7 }, i (i)}
				<circle
					cx={330 + i * 34}
					{cy}
					r="11"
					fill={i < asked ? 'var(--tq-hot)' : 'none'}
					stroke={i < asked ? 'var(--tq-hot)' : 'var(--stage-line)'}
					stroke-width="2"
				/>
			{/each}
			<Label
				x={330 + 6 * 34 + 26}
				y={cy + 6}
				text="never more than seven"
				size={15}
				muted
				anchor="start"
				halo={false}
			/>
		</Readout>
	{:else}
		<!-- the ladder -->
		<Readout
			id="nb-ladder"
			order={1}
			label="Halving {fmt(many)} numbers"
			value="{rows.length - 1} questions"
			color="var(--tq-hot)"
		>
			<Label
				x={480}
				y={44}
				text={phase === 'next'
					? 'A million things, twenty questions'
					: `${nice(many)} numbers: ${rows.length - 1} questions`}
				size={26}
				weight={700}
				halo={false}
			/>
		</Readout>
		<Readout id="nb-ladder-head">
			<Label
				x={LAD_X - 16}
				y={ROW_TOP - 18}
				text="question"
				size={13}
				muted
				anchor="end"
				halo={false}
			/>
			<Label
				x={LAD_X}
				y={ROW_TOP - 18}
				text="the most numbers still left"
				size={13}
				muted
				anchor="start"
				halo={false}
			/>
		</Readout>
		{#each rows as n, i (i)}
			{@const y = ROW_TOP + i * pitch}
			{@const h = Math.max(6, pitch * 0.62)}
			{@const w = Math.max(3, (LAD_W * n) / many)}
			{@const fs = Math.min(17, Math.max(12, pitch * 0.55))}
			<g opacity={shown(i)}>
				<text
					x={LAD_X - 16}
					y={y + h / 2 + fs * 0.36}
					text-anchor="end"
					font-size={fs}
					fill="var(--stage-ink-muted)"
					style:font-variant-numeric="tabular-nums">{i === 0 ? 'start' : i}</text
				>
				<rect
					x={LAD_X}
					{y}
					width={w}
					height={h}
					rx="3"
					fill={n === 1 ? 'var(--tq-good)' : 'var(--tq-live)'}
				/>
				<text
					x={LAD_X + w + 10}
					y={y + h / 2 + fs * 0.36}
					font-size={fs}
					font-weight={n === 1 ? 800 : 600}
					fill={n === 1 ? 'var(--tq-good)' : 'var(--stage-ink)'}
					style:font-variant-numeric="tabular-nums">{n === 1 ? '1: found!' : fmt(n)}</text
				>
			</g>
		{/each}
		<Readout id="nb-compare" order={2} label="One at a time" value="up to {fmt(many)} questions">
			<Label
				x={480}
				y={580}
				text="Asking one at a time: up to {fmt(many)} questions. Halving: {rows.length - 1}."
				size={17}
				weight={600}
				halo={false}
				opacity={shown(rows.length - 1)}
			/>
		</Readout>
	{/if}
</g>
