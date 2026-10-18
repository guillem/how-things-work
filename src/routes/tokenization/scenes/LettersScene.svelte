<script lang="ts">
	/**
	 * What reaches the model: the same word typed three ways, each cut by GPT-2's tokenizer, with
	 * the token numbers the model actually receives underneath. Inside ␣strawberry (one number)
	 * the letters are not part of the input; spelled out, every letter is its own token, and the
	 * r's light up one after another.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Label } from '#lib/draw/index.ts';
	import type { Gpt2 } from '../gpt2';
	import { chipWidth, FILLS, show, tokenizer } from './shared';

	let { t, reduced }: StageProps = $props();

	let g = $state<Gpt2 | null>(null);
	let failed = $state(false);
	$effect(() => {
		tokenizer().then(
			(x) => (g = x),
			() => (failed = true)
		);
	});

	const CASES = [
		{ what: 'after a space, as in running text', text: ' strawberry' },
		{ what: 'at the start of a text', text: 'strawberry' },
		{ what: 'spelled out, letter by letter', text: ' s t r a w b e r r y' }
	];
	const F = 20;
	const rows = $derived(
		g
			? CASES.map((c, i) => {
					const ids = g!.bpe.encode(c.text);
					let x = 60;
					const chips = ids.map((id, j) => {
						const text = show(g!.bpe.text(id));
						const w = Math.max(chipWidth(text, F, 30), String(id).length * 9 + 14);
						const chip = { j, id, text, x, w };
						x += w + 6;
						return chip;
					});
					return { ...c, i, ids, chips };
				})
			: []
	);
	/** Which r of the spelled-out row is lit: the three in turn, then all three together. */
	const lit = $derived(reduced ? 3 : Math.floor(cycle(t, 4.8) * 4));
	const isR = (text: string) => text.replace('␣', '') === 'r';
	const rIndex = (row: { chips: { text: string }[] }, j: number) =>
		row.chips.slice(0, j + 1).filter((c) => isR(c.text)).length - 1;
</script>

<g>
	{#if !g}
		<Label
			x={480}
			y={300}
			anchor="middle"
			muted
			text={failed ? 'GPT-2’s tokenizer could not be loaded.' : 'Loading GPT-2’s tokenizer…'}
		/>
	{:else}
		<Readout id="title">
			<Label
				anchor="start"
				x={24}
				y={34}
				size={15}
				weight={650}
				text="One word, three inputs: what GPT-2 receives is the numbers"
			/>
		</Readout>
		{#each rows as row (row.i)}
			{@const y = 74 + row.i * 150}
			<Readout
				id="case-{row.i}"
				order={row.i + 1}
				label="“{show(row.text)}”, {row.what}"
				value="{row.ids.length} token{row.ids.length === 1 ? '' : 's'}: {row.ids.join(', ')}"
			>
				<Label
					anchor="start"
					x={24}
					y={y + 12}
					size={13}
					weight={650}
					text="“{show(row.text)}” · {row.what} · {row.ids.length} token{row.ids.length === 1
						? ''
						: 's'}"
				/>
			</Readout>
			<Readout id="text-label-{row.i}">
				<Label x={50} y={y + 52} anchor="end" size={11} muted text="text" />
				<Label x={50} y={y + 104} anchor="end" size={11} muted text="input" />
			</Readout>
			{#each row.chips as c (c.j)}
				{@const r = row.i === 2 && isR(c.text)}
				{@const on = r && (lit === 3 || rIndex(row, c.j) === lit)}
				<rect
					x={c.x}
					y={y + 28}
					width={c.w}
					height="38"
					rx="7"
					fill={on ? 'color-mix(in oklab, var(--tk-hot) 32%, var(--surface))' : FILLS[c.j % 5]}
					stroke={on ? 'var(--tk-hot)' : 'var(--border)'}
					stroke-width={on ? 2 : 1}
				/>
				<text
					x={c.x + c.w / 2}
					y={y + 54}
					text-anchor="middle"
					font-size={F}
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{c.text}</text
				>
				<path
					d="M{c.x + c.w / 2} {y + 70} v12"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
					marker-end="url(#arrowhead)"
				/>
				<rect
					x={c.x}
					y={y + 86}
					width={c.w}
					height="28"
					rx="5"
					fill="var(--surface)"
					stroke="var(--tk-next)"
					stroke-width="1.5"
				/>
				<text
					x={c.x + c.w / 2}
					y={y + 105}
					text-anchor="middle"
					font-size="15"
					font-weight="650"
					style:fill="var(--tk-next)"
					style:font-variant-numeric="tabular-nums">{c.id}</text
				>
			{/each}
		{/each}
		<Readout id="note">
			<Label
				x={936}
				y={160}
				anchor="end"
				size={12}
				muted
				text="One number: the letters inside are not in the input."
			/>
			<Label
				x={936}
				y={310}
				anchor="end"
				size={12}
				muted
				text="Three other numbers for the same word."
			/>
			<Label
				x={936}
				y={520}
				anchor="end"
				size={12}
				muted
				text="Single letters are tokens too: ␣r is token 374, wherever it comes."
			/>
		</Readout>
	{/if}
</g>
