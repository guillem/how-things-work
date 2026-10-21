<script lang="ts">
	/**
	 * The spy tries every turn: the reader's secret message (their message, coded with their turn)
	 * at the top, and under it the 25 tries, the secret message turned back by 1 to 25 places,
	 * written out one after another (`allTries` in the model). The try with the most letters in
	 * common English words is the one that reads (`bestTry`); it turns green.
	 *
	 * "Pick a new secret turn" (`params.newturn`, a press count) sets the reader's turn to another
	 * one, so the spy has a new secret to break.
	 */
	import { untrack } from 'svelte';
	import { clamp, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { allTries, bestTry, turnLetters } from '../model';
	import { messageOf, turnOf } from '../state';

	let { t, params, setParam, reduced }: StageProps = $props();

	const msg = $derived(messageOf(params));
	const turn = $derived(turnOf(params));
	const secret = $derived(turnLetters(msg, turn));
	const tries = $derived(allTries(secret));
	const best = $derived(bestTry(tries));

	// A new secret turn for each press: a different one each time, never the same as before.
	const presses = $derived(Math.round(Number(params.newturn ?? 0)) || 0);
	let seen = untrack(() => presses);
	$effect(() => {
		const p = presses;
		untrack(() => {
			if (p === seen) return;
			seen = p;
			const step = 1 + ((p * 7 + 3) % 24); // 1 to 24, so the turn always changes
			setParam('turn', ((turn - 1 + step) % 25) + 1);
		});
	});

	// The tries are written out one after another, all of them within two seconds.
	const PER = 0.075;
	/** When the reader picks a new turn, the list is written out again from the top. */
	let since = $state(0);
	let lastSecret = untrack(() => secret);
	$effect(() => {
		const s = secret;
		untrack(() => {
			if (s !== lastSecret) {
				lastSecret = s;
				since = t;
			}
		});
	});
	const local = $derived(reduced ? 99 : Math.max(0, t - since));
	const written = (k: number) => clamp((local - 0.3 - k * PER) / 0.2);
	const found = $derived(clamp((local - 0.3 - 25 * PER) / 0.3));

	// ---- layout: two columns of tries ---------------------------------------------------------------
	const COL = [24, 494];
	const ROW0 = 150;
	const PITCH = 34;
	const SIZE = 17;
	const CW = SIZE * 0.62;
	const pos = (k: number) => ({ x: COL[k < 13 ? 0 : 1], y: ROW0 + (k % 13) * PITCH });
</script>

<g class="spy">
	<Readout id="spy-secret" order={1} label="Secret message" value={secret || '–'}>
		<Label
			x={24}
			y={40}
			text="The spy’s copy of your secret message"
			anchor="start"
			size={16}
			muted
			halo={false}
		/>
		<text
			x={24}
			y={84}
			font-size="30"
			font-weight="700"
			fill="var(--sc-secret)"
			style:font-family="var(--font-mono)">{secret || '–'}</text
		>
	</Readout>
	<Readout id="spy-hint">
		<Label x={24} y={124} text="Turned back by…" anchor="start" size={14} muted halo={false} />
	</Readout>

	{#each tries as tr, k (tr.turn)}
		{@const p = pos(k)}
		{@const o = written(k)}
		{@const win = best?.turn === tr.turn}
		{#if win}
			<rect
				x={p.x - 6}
				y={p.y - 22}
				width={46 + tr.text.length * CW + 14}
				height={30}
				rx="8"
				fill="var(--sc-good)"
				opacity={0.22 * found}
			/>
		{/if}
		<g opacity={o}>
			<text
				x={p.x + 30}
				y={p.y}
				text-anchor="end"
				font-size="15"
				fill="var(--stage-ink-muted)"
				style:font-variant-numeric="tabular-nums">{tr.turn}</text
			>
			<text
				x={p.x + 44}
				y={p.y}
				font-size={SIZE}
				font-weight={win && found > 0.5 ? 800 : 500}
				fill={win && found > 0.5 ? 'var(--sc-good)' : 'var(--stage-ink-muted)'}
				style:font-family="var(--font-mono)">{tr.text}</text
			>
		</g>
	{/each}

	<Readout
		id="spy-found"
		order={2}
		label="The spy finds"
		value={best ? `turn ${best.turn}: ${best.text}` : 'nothing that reads'}
		color={best ? 'var(--sc-good)' : undefined}
		opacity={found}
	>
		<Label
			x={COL[1] + 44}
			y={ROW0 + 12 * PITCH + 2}
			text={best ? `✓ Turn ${best.turn} makes words!` : 'No line makes words'}
			anchor="start"
			size={20}
			weight={700}
			color={best ? 'var(--sc-good)' : 'var(--stage-ink-muted)'}
			halo={false}
			opacity={found}
		/>
	</Readout>
</g>
