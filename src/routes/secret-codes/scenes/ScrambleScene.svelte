<script lang="ts">
	/**
	 * The scrambled alphabet: the ordinary alphabet, and under each letter its secret partner
	 * (`scramble` in the model; "Scramble again" makes a new one and the partners slide to their
	 * new places). The reader's message is written with it one letter at a time, and at the bottom
	 * is how many ways there are to scramble 26 letters, and how long a computer would need to try
	 * them all (`orderings`, `yearsToTryAll`).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ALPHABET, encode, letterIndex, orderings, yearsToTryAll } from '../model';
	import { keyOf, messageOf } from '../state';
	import Letters from './Letters.svelte';

	let { t, params }: StageProps = $props();

	const key = $derived(keyOf(params));
	const msg = $derived(messageOf(params));
	const secret = $derived(encode(msg, key));

	// ---- the two rows -------------------------------------------------------------------------------
	const X0 = 52;
	const CW = 34.4;
	const colX = (i: number) => X0 + i * CW;
	/** Column of each secret letter, A to Z (where it sits under the alphabet). */
	const columns = $derived(ALPHABET.split('').map((ch) => key.indexOf(ch)));
	const slide = Tween.of(() => columns, { duration: 800, easing: cubicInOut });

	// ---- the letter being written now ------------------------------------------------------------------
	const PACE = 1.1;
	const letterAt = $derived([...msg].flatMap((ch, i) => (letterIndex(ch) >= 0 ? [i] : [])));
	const cursor = $derived(letterAt.length ? letterAt[Math.floor(t / PACE) % letterAt.length] : -1);
	const col = $derived(cursor >= 0 ? letterIndex(msg[cursor]) : -1);

	const ways = orderings().toLocaleString('en-GB');
	const years = Math.round(yearsToTryAll(1e9) / 1e9);
</script>

<g class="scramble">
	<Readout id="scr-title">
		<Label
			x={24}
			y={40}
			text="Your scrambled alphabet: the key"
			anchor="start"
			size={16}
			muted
			halo={false}
		/>
	</Readout>
	<rect
		x={24}
		y={58}
		width={912}
		height={128}
		rx="14"
		fill="var(--sc-ring-outer)"
		stroke="var(--stage-line)"
	/>
	{#if col >= 0}
		<rect
			x={colX(col) - 16}
			y={64}
			width={32}
			height={116}
			rx="9"
			fill="var(--sc-hi)"
			opacity="0.6"
		/>
	{/if}
	{#each ALPHABET as ch, i (ch)}
		<text
			x={colX(i)}
			y={100}
			text-anchor="middle"
			font-size="26"
			font-weight="700"
			fill="var(--stage-ink)">{ch}</text
		>
		<path
			d="M{colX(i)},110 v14 m-4,-5 l4,5 l4,-5"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.6"
		/>
	{/each}
	{#each ALPHABET as ch, j (ch)}
		<text
			x={X0 + slide.current[j] * CW}
			y={164}
			text-anchor="middle"
			font-size="26"
			font-weight="700"
			fill="var(--sc-secret)">{ch}</text
		>
	{/each}

	<Readout id="scr-msg" order={1} label="Your message" value={msg || '–'}>
		<Label x={24} y={232} text="Your message" anchor="start" size={16} muted halo={false} />
		<Letters x={24} y={272} text={msg} width={36} size={28} mark={cursor} />
	</Readout>
	<Readout id="scr-secret" order={2} label="Secret message" value={secret || '–'}>
		<Label x={24} y={322} text="Secret message" anchor="start" size={16} muted halo={false} />
		<Letters
			x={24}
			y={362}
			text={secret}
			width={36}
			size={28}
			color="var(--sc-secret)"
			mark={cursor}
		/>
	</Readout>

	<Readout id="scr-ways" order={3} label="Ways to scramble 26 letters" value={ways}>
		<text
			x={480}
			y={470}
			text-anchor="middle"
			font-size="34"
			font-weight="800"
			fill="var(--stage-ink)"
			style:font-variant-numeric="tabular-nums">{ways}</text
		>
		<Label
			x={480}
			y={506}
			text="ways to scramble 26 letters"
			anchor="middle"
			size={18}
			muted
			halo={false}
		/>
	</Readout>
	<Readout
		id="scr-years"
		order={4}
		label="Trying a billion every second"
		value="about {years} billion years"
	>
		<Label
			x={480}
			y={560}
			text="Trying a billion every second: about {years} billion years"
			anchor="middle"
			size={20}
			weight={700}
			color="var(--sc-hi-ink)"
			halo={false}
		/>
	</Readout>
</g>
