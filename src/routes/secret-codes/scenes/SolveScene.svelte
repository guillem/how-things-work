<script lang="ts">
	/**
	 * Solving by hand: the long letter written with the reader's scramble, each secret line with
	 * the spy's reading under it ('_' where a letter has no guess yet). The spy starts from the
	 * three tallest bars guessed as E, T and A (`startGuess`); the reader picks a secret letter in
	 * the row of guesses and then the letter it stands for (a click on the row below, or a key),
	 * which swaps guesses when that letter was already used (`assign`). Words read right turn
	 * green. "Fix one letter for me" (`params.hint`, a press count) puts in the right letter for
	 * the commonest secret letter still wrong (`hint`).
	 *
	 * The guesses live in `params.guess` (with `params.guessKey`, the scramble they belong to), so
	 * they survive a trip to another step; a new scramble starts again from E, T and A.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ALPHABET,
		assign,
		barsOf,
		encode,
		hint,
		LETTER,
		letterIndex,
		NO_GUESS,
		readWith,
		startGuess,
		wrongLetters,
		type Guess
	} from '../model';
	import { keyOf } from '../state';
	import Letters from './Letters.svelte';

	let { params, setParam }: StageProps = $props();

	const seed = $derived(Math.round(Number(params.scramble ?? 0)) || 0);
	const key = $derived(keyOf(params));
	const secret = $derived(encode(LETTER, key));
	const guess = $derived<Guess>(
		typeof params.guess === 'string' && params.guess.length === 26 && params.guessKey === seed
			? params.guess
			: startGuess(secret)
	);
	function save(g: Guess) {
		setParam('guess', g);
		setParam('guessKey', seed);
	}

	const reading = $derived(readWith(secret, guess));
	const wrong = $derived(wrongLetters(secret, guess, key));
	const solved = $derived(wrong.length === 0);

	/** Index → whether its word is read right (all its letters guessed, and correctly). */
	const rightWord = $derived.by(() => {
		const ok = new Array<boolean>(secret.length).fill(false);
		for (const m of secret.matchAll(/[A-Z]+/g)) {
			const a = m.index;
			const b = a + m[0].length;
			if (reading.slice(a, b) === LETTER.slice(a, b)) for (let i = a; i < b; i++) ok[i] = true;
		}
		return ok;
	});

	// ---- "Fix one letter for me" ------------------------------------------------------------------------
	const presses = $derived(Math.round(Number(params.hint ?? 0)) || 0);
	let seen = untrack(() => presses);
	$effect(() => {
		const p = presses;
		untrack(() => {
			if (p === seen) return;
			seen = p;
			save(hint(secret, guess, key));
		});
	});

	// ---- picking ---------------------------------------------------------------------------------------------
	/** The secret letters of the letter, A to Z. */
	const used = $derived(byLetter(secret));
	function byLetter(text: string): string[] {
		return barsOf(text)
			.filter((b) => b.count > 0)
			.map((b) => b.letter);
	}
	let picked = $state<string | null>(null);
	function put(plain: string) {
		if (!picked) return;
		save(assign(guess, picked, plain));
	}
	function onColumnKey(e: KeyboardEvent, s: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			picked = picked === s ? null : s;
			return;
		}
		const k = e.key.toUpperCase();
		if (k.length === 1 && letterIndex(k) >= 0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
			e.preventDefault();
			picked = s;
			save(assign(guess, s, k));
		}
	}

	// ---- layout -------------------------------------------------------------------------------------------------
	const WIDTH = 62;
	const SIZE = 22;
	const LX = 26;
	const COLW = 38;
	const colX = $derived((i: number) => 480 + (i - (used.length - 1) / 2) * COLW);
	const ROW_S = 472;
	const ROW_G = 512;
	const ROW_P = 572;
	const PICK_W = 34.4;
	const pickX = (i: number) => 50 + i * PICK_W;
	const reads = $derived(rightWord.filter(Boolean).length);
	const pickedIdx = $derived(picked ? letterIndex(picked) : -1);
</script>

<g class="solve">
	<!-- the letter: each secret line, with the spy's reading under it -->
	<Readout id="solve-title">
		<Label
			x={LX}
			y={30}
			text="Your scrambled letter, and what the spy reads so far"
			anchor="start"
			size={15}
			muted
			halo={false}
		/>
	</Readout>
	<Readout
		id="solve-reading"
		order={1}
		label="The spy reads"
		value={reading}
		color={solved ? 'var(--sc-good)' : undefined}
	>
		<Letters
			x={LX}
			y={64}
			text={secret}
			width={WIDTH}
			pitch={SIZE * 0.62}
			size={14}
			lineHeight={52}
			weight={600}
			color="var(--sc-secret)"
		/>
		<Letters
			x={LX}
			y={88}
			text={reading}
			width={WIDTH}
			pitch={SIZE * 0.62}
			size={SIZE}
			lineHeight={52}
			gaps
			colorAt={(i: number) =>
				rightWord[i]
					? 'var(--sc-good)'
					: pickedIdx >= 0 && secret[i] === picked
						? 'var(--sc-hi-ink)'
						: undefined}
		/>
	</Readout>

	<!-- the row of guesses: a secret letter, and the letter the spy thinks it stands for -->
	<Readout id="solve-row-label">
		<Label
			x={LX}
			y={ROW_S - 34}
			text={solved ? '' : 'Click a secret letter, then the letter it stands for (or type it)'}
			anchor="start"
			size={14}
			muted
			halo={false}
		/>
	</Readout>
	{#each used as s, i (s)}
		{@const x = colX(i)}
		{@const g = guess[letterIndex(s)]}
		{@const on = picked === s}
		<rect
			class="sc-cell"
			x={x - 16}
			y={ROW_S - 24}
			width={32}
			height={76}
			rx="8"
			fill={on ? 'var(--sc-hi)' : 'var(--surface)'}
			stroke={on ? 'var(--sc-hi-ink)' : 'var(--border)'}
			stroke-width={on ? 2.5 : 1}
			role="button"
			tabindex="0"
			aria-label="Secret letter {s}: {g === NO_GUESS ? 'no guess yet' : `guessed as ${g}`}"
			aria-pressed={on}
			onclick={() => (picked = on ? null : s)}
			onkeydown={(e) => onColumnKey(e, s)}
		/>
		<text
			{x}
			y={ROW_S}
			text-anchor="middle"
			font-size="19"
			font-weight="700"
			fill="var(--sc-secret)"
			style:pointer-events="none">{s}</text
		>
		<text
			{x}
			y={ROW_G + 4}
			text-anchor="middle"
			font-size="24"
			font-weight="800"
			fill={g === NO_GUESS ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}
			style:pointer-events="none">{g === NO_GUESS ? '?' : g}</text
		>
	{/each}

	<!-- the letters to choose from -->
	{#if picked && !solved}
		<Readout id="solve-pick">
			{#each ALPHABET as ch, i (ch)}
				{@const taken = guess.includes(ch)}
				<rect
					class="sc-cell"
					x={pickX(i) - 15}
					y={ROW_P - 24}
					width={30}
					height={34}
					rx="7"
					fill="var(--surface)"
					stroke="var(--border)"
					role="button"
					tabindex="0"
					aria-label="{picked} stands for {ch}"
					onclick={() => put(ch)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							put(ch);
						}
					}}
				/>
				<text
					x={pickX(i)}
					y={ROW_P}
					text-anchor="middle"
					font-size="19"
					font-weight="700"
					fill={taken ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}
					style:pointer-events="none">{ch}</text
				>
			{/each}
		</Readout>
	{/if}

	<Readout
		id="solve-status"
		order={2}
		label="Letters still wrong"
		value={solved ? 'none: the whole letter reads ✓' : String(wrong.length)}
		color={solved ? 'var(--sc-good)' : undefined}
	>
		{#if solved}
			<Label
				x={480}
				y={ROW_P}
				text="✓ The whole letter reads!"
				anchor="middle"
				size={24}
				weight={800}
				color="var(--sc-good)"
				halo={false}
			/>
		{:else if !picked}
			<Label
				x={480}
				y={ROW_P}
				text="{reads} of {secret.replace(/[^A-Z]/g, '').length} letters in words read right"
				anchor="middle"
				size={17}
				muted
				halo={false}
			/>
		{/if}
	</Readout>
</g>

<style>
	.sc-cell {
		cursor: pointer;
		outline: none;
	}
	.sc-cell:focus-visible {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
