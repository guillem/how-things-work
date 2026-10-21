<script lang="ts">
	/**
	 * Counting letters: the bars of a secret message (written with the reader's scramble) above the
	 * bars of ordinary English (the letters of Alice in Wonderland, `ENGLISH`), both out of every
	 * 100 letters. Lined up by height, the three tallest secret letters are guessed as E, T and A
	 * (`tallestGuesses`), and each guess is checked against the key.
	 *
	 * Phases (`step.hints.phase`):
	 * - `count`: the long letter; `params.lineup` sorts both rows by height.
	 * - `short`: always lined up; `params.which` picks the one-line note or the long letter, and a
	 *   small table shows how often E is the tallest bar in pieces of the book of different lengths
	 *   (`E_TALLEST`).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { E_TALLEST } from '../english';
	import {
		ALPHABET,
		barsOf,
		byHeight,
		decode,
		encode,
		ENGLISH,
		LETTER,
		letterIndex,
		NOTE,
		tallestGuesses
	} from '../model';
	import { keyOf } from '../state';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'count'));
	const short = $derived(phase === 'short');
	const note = $derived(short && params.which !== 'letter');
	const lined = $derived(short || params.lineup === true);

	const key = $derived(keyOf(params));
	const secret = $derived(encode(note ? NOTE : LETTER, key));
	const bars = $derived(barsOf(secret));
	const total = $derived(bars.reduce((a, b) => a + b.count, 0));
	const guesses = $derived(
		[...tallestGuesses(secret)].map(([s, g]) => ({ s, g, ok: decode(s, key) === g }))
	);
	const guessOf = $derived(new Map(guesses.map((x) => [x.s, x])));

	// ---- where each bar stands: alphabetical, or tallest first -------------------------------------
	function slots(list: { letter: string }[]): number[] {
		const out = new Array<number>(26);
		list.forEach((b, i) => (out[letterIndex(b.letter)] = i));
		return out;
	}
	const topSlots = $derived(slots(lined ? byHeight(bars) : bars));
	const englishSlots = $derived(slots(lined ? byHeight(ENGLISH) : ENGLISH));
	const topX = Tween.of(() => topSlots, { duration: 800, easing: cubicInOut });
	const engX = Tween.of(() => englishSlots, { duration: 800, easing: cubicInOut });
	const englishTop3 = new Set(
		byHeight(ENGLISH)
			.slice(0, 3)
			.map((b) => b.letter)
	);

	// ---- geometry -----------------------------------------------------------------------------------------
	const X0 = 52;
	const PITCH = 23.4;
	const BW = 17;
	const PER = 8.2; // drawn height of 1 letter in every 100
	const TOP_BASE = 252;
	const ENG_BASE = 532;
	const xs = (slot: number) => X0 + slot * PITCH;

	// ---- how often E is the tallest bar, by length of the piece ------------------------------------------
	function inWords(r: number): string {
		if (r > 0.9) return 'more than 9 in 10';
		const fr: [number, string][] = [
			[1 / 4, '1 in 4'],
			[1 / 3, '1 in 3'],
			[1 / 2, '1 in 2'],
			[2 / 3, '2 in 3'],
			[3 / 4, '3 in 4'],
			[4 / 5, '4 in 5']
		];
		const best = fr.reduce((a, b) => (Math.abs(b[0] - r) < Math.abs(a[0] - r) ? b : a));
		return `about ${best[1]}`;
	}
	const pieces = E_TALLEST.map((p) => ({
		length: p.length,
		r: p.eTallest / p.count,
		words: inWords(p.eTallest / p.count)
	}));
	const PX = 672;
</script>

<g class="bars">
	<!-- the secret message's bars -->
	<Readout
		id="bars-top"
		order={1}
		label={note ? 'Secret note' : 'Secret letter'}
		value="{total} letters"
	>
		<Label
			x={40}
			y={40}
			text="{note ? 'The secret note' : 'The secret letter'}: {total} letters"
			anchor="start"
			size={17}
			weight={700}
			color="var(--sc-secret)"
			halo={false}
		/>
	</Readout>
	<line x1={38} x2={X0 + 25 * PITCH + 14} y1={TOP_BASE} y2={TOP_BASE} stroke="var(--stage-line)" />
	{#each bars as b, i (b.letter)}
		{@const x = xs(topX.current[i])}
		{@const gs = lined ? guessOf.get(b.letter) : undefined}
		<rect
			x={x - BW / 2}
			y={TOP_BASE - b.per100 * PER}
			width={BW}
			height={b.per100 * PER}
			rx="3"
			fill={gs ? 'var(--sc-hi-ink)' : 'var(--sc-secret)'}
			opacity={b.count ? 0.85 : 0}
		/>
		<text
			{x}
			y={TOP_BASE + 22}
			text-anchor="middle"
			font-size="16"
			font-weight="700"
			fill="var(--sc-secret)">{b.letter}</text
		>
		{#if gs}
			<text
				{x}
				y={TOP_BASE + 48}
				text-anchor="middle"
				font-size="18"
				font-weight="800"
				fill="var(--sc-hi-ink)">{gs.g}</text
			>
		{/if}
	{/each}

	<!-- ordinary English -->
	<Readout id="bars-eng">
		<Label
			x={40}
			y={326}
			text="Ordinary English (Alice in Wonderland)"
			anchor="start"
			size={17}
			weight={700}
			halo={false}
		/>
	</Readout>
	<line x1={38} x2={X0 + 25 * PITCH + 14} y1={ENG_BASE} y2={ENG_BASE} stroke="var(--stage-line)" />
	{#each ENGLISH as b, i (b.letter)}
		{@const x = xs(engX.current[i])}
		{@const hi = lined && englishTop3.has(b.letter)}
		<rect
			x={x - BW / 2}
			y={ENG_BASE - b.per100 * PER}
			width={BW}
			height={b.per100 * PER}
			rx="3"
			fill={hi ? 'var(--sc-hi-ink)' : 'var(--sc-english)'}
			opacity="0.85"
		/>
		<text
			{x}
			y={ENG_BASE + 22}
			text-anchor="middle"
			font-size="16"
			font-weight="700"
			fill="var(--stage-ink)">{ALPHABET[i]}</text
		>
	{/each}

	<!-- the panel on the right -->
	{#if lined}
		<Readout id="bars-guess-title">
			<Label
				x={PX}
				y={short ? 72 : 120}
				text="The spy’s guesses"
				anchor="start"
				size={17}
				weight={700}
				halo={false}
			/>
		</Readout>
		{#each guesses as gs, k (gs.s)}
			{@const y = (short ? 112 : 166) + k * 44}
			<Readout
				id="bars-guess-{k}"
				order={2 + k}
				label="{gs.s} stands for {gs.g}?"
				value={gs.ok ? 'yes ✓' : `no ✗ (it is ${decode(gs.s, key)})`}
				color={gs.ok ? 'var(--sc-good)' : 'var(--sc-bad)'}
			>
				<text
					x={PX}
					{y}
					font-size="26"
					font-weight="800"
					fill="var(--sc-secret)"
					style:font-family="var(--font-mono)">{gs.s}</text
				>
				<text x={PX + 26} {y} font-size="20" fill="var(--stage-ink-muted)">→</text>
				<text
					x={PX + 54}
					{y}
					font-size="26"
					font-weight="800"
					fill="var(--sc-hi-ink)"
					style:font-family="var(--font-mono)">{gs.g}</text
				>
				<text
					x={PX + 86}
					{y}
					font-size="18"
					font-weight="700"
					fill={gs.ok ? 'var(--sc-good)' : 'var(--sc-bad)'}
					>{gs.ok ? '✓ right' : `✗ it is ${decode(gs.s, key)}`}</text
				>
			</Readout>
		{/each}
	{:else}
		<Readout id="bars-lineup-hint">
			<Label
				x={PX}
				y={140}
				text="Line the bars up"
				anchor="start"
				size={17}
				weight={700}
				halo={false}
			/>
			<Label
				x={PX}
				y={166}
				text="by height to compare them"
				anchor="start"
				size={15}
				muted
				halo={false}
			/>
		</Readout>
	{/if}

	{#if short}
		<Readout
			id="bars-pieces-title"
			order={6}
			label="E was the tallest bar in pieces of the book of"
			value={pieces
				.map((p) => `${p.length.toLocaleString('en-GB')} letters: ${p.words}`)
				.join('; ')}
		>
			<Label
				x={PX}
				y={290}
				text="E was the tallest bar"
				anchor="start"
				size={16}
				weight={700}
				halo={false}
			/>
			<Label
				x={PX}
				y={312}
				text="in pieces of the book of…"
				anchor="start"
				size={14}
				muted
				halo={false}
			/>
		</Readout>
		{#each pieces as p, k (p.length)}
			{@const y = 352 + k * 52}
			<Readout id="bars-piece-{p.length}">
				<text x={PX} {y} font-size="15" font-weight="700" fill="var(--stage-ink)"
					>{p.length.toLocaleString('en-GB')} letters</text
				>
				<rect x={PX} y={y + 8} width={110} height={12} rx="4" fill="var(--stage-grid)" />
				<rect x={PX} y={y + 8} width={110 * p.r} height={12} rx="4" fill="var(--sc-hi-ink)" />
				<text x={PX + 120} y={y + 19} font-size="14" fill="var(--stage-ink-muted)">{p.words}</text>
			</Readout>
		{/each}
	{/if}
</g>
