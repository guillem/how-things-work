<script lang="ts">
	/**
	 * The text as GPT-2 sees it: the sentence, its tokens (with their numbers in GPT-2's
	 * vocabulary), and for each token the two vectors that are added to make its input: the token
	 * embedding and the position embedding. For the animal sentence, "it" asks which noun it means.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Label, smoothstep } from '#lib/draw/index.ts';
	import { chipWidth, label, sentenceOf } from './shared';
	import TokenChip from './TokenChip.svelte';

	let { t, params, reduced }: StageProps = $props();

	const s = $derived(sentenceOf(params));
	const texts = $derived(s.tokens.map((tk) => label(tk, true)));

	// The row of chips, shrunk to fit 928 px if needed.
	const ROW_Y = 112;
	const GAP = 8;
	const layout = $derived.by(() => {
		const w = texts.map((tx) => chipWidth(tx));
		const total = w.reduce((a, b) => a + b, 0) + GAP * (w.length - 1);
		const k = Math.min(1, 928 / total);
		let x = 480 - (total * k) / 2;
		return w.map((wi, i) => {
			const item = { i, x, w: wi * k, cx: x + (wi * k) / 2 };
			x += (wi + GAP) * k;
			return item;
		});
	});
	const size = $derived(
		Math.max(10, Math.min(13, (13 * (layout[0]?.w ?? 26)) / chipWidth(texts[0] ?? '')))
	);

	// The column under each token: embedding + position = input.
	const COL = { emb: 196, pos: 318, x: 440, h: 86, xh: 56 };
	const it = $derived(s.id === 'animal' ? s.tokens.indexOf(' it') : -1);
	const animal = $derived(s.id === 'animal' ? s.tokens.indexOf(' animal') : -1);
	const street = $derived(s.id === 'animal' ? s.tokens.indexOf(' street') : -1);

	// A dot runs down each column in turn, from the chip to the input vector.
	const dots = $derived(
		reduced
			? []
			: layout.flatMap((c) => {
					// every token at once: the columns are computed in parallel
					const u = cycle(t, 3);
					if (u > 0.8) return [];
					const f = u / 0.8;
					const y = COL.emb + 8 + f * (COL.x + COL.xh / 2 - COL.emb - 8);
					// visible only inside the boxes, so they never cross the row labels
					const inside = [COL.emb, COL.pos, COL.x].some(
						(top, k) => y > top + 4 && y < top + (k === 2 ? COL.xh : COL.h) - 4
					);
					if (!inside) return [];
					const o = smoothstep(0, 0.1, f) * (1 - smoothstep(0.85, 1, f));
					return [{ key: c.i, x: c.cx - c.w * 0.18, y, o }];
				})
	);

	const arc = (from: number, to: number, lift: number) => {
		const a = layout[from];
		const b = layout[to];
		if (!a || !b) return '';
		return `M${a.cx} ${ROW_Y - 4} C${a.cx} ${ROW_Y - lift} ${b.cx} ${ROW_Y - lift} ${b.cx} ${ROW_Y - 4}`;
	};
	const caption = $derived(
		s.id === 'animal'
			? '“it” has the same token embedding as in any other text: nothing in those 768 numbers says “animal”.'
			: 'Each token starts as the same 768 numbers it has in any other text; only its position vector differs.'
	);
</script>

<g>
	<Readout id="text" order={1} label="Sentence" value="“{s.text}”">
		<Label tabular x={480} y={44} anchor="middle" size={17} weight={600} text="“{s.text}”" />
	</Readout>

	{#if it >= 0}
		<!-- which noun does "it" mean? -->
		<path
			d={arc(it, animal, 58)}
			fill="none"
			stroke="var(--tf-att)"
			stroke-width="1.6"
			stroke-dasharray="4 4"
		/>
		<path
			d={arc(it, street, 34)}
			fill="none"
			stroke="var(--tf-att)"
			stroke-width="1.6"
			stroke-dasharray="4 4"
		/>
		<Label
			x={(layout[it].cx + layout[animal].cx) / 2}
			y={ROW_Y - 48}
			anchor="middle"
			text="?"
			weight={700}
			color="var(--tf-att)"
		/>
		<Label
			x={(layout[it].cx + layout[street].cx) / 2}
			y={ROW_Y - 28}
			anchor="middle"
			text="?"
			weight={700}
			color="var(--tf-att)"
		/>
	{/if}

	{#each layout as c (c.i)}
		<TokenChip x={c.x} y={ROW_Y} w={c.w} h={30} text={texts[c.i]} {size} selected={c.i === it} />
		<Readout id="id-{c.i}">
			<Label
				tabular
				x={c.cx}
				y={ROW_Y + 48}
				anchor="middle"
				size={11}
				muted
				text={String(s.ids[c.i])}
			/>
		</Readout>
		<!-- token embedding + position embedding = the token's input vector -->
		<rect
			x={c.cx - c.w * 0.32}
			y={COL.emb}
			width={c.w * 0.64}
			height={COL.h}
			rx="4"
			fill="var(--tf-att)"
			opacity="0.22"
		/>
		<rect
			x={c.cx - c.w * 0.32}
			y={COL.pos}
			width={c.w * 0.64}
			height={COL.h}
			rx="4"
			fill="var(--tf-q)"
			opacity="0.22"
		/>
		<Readout id="p-{c.i}">
			<Label
				tabular
				x={c.cx}
				y={COL.pos + COL.h / 2 + 4}
				anchor="middle"
				size={11}
				text={String(c.i)}
				color="var(--tf-q)"
			/>
		</Readout>
		<rect
			x={c.cx - c.w * 0.32}
			y={COL.x}
			width={c.w * 0.64}
			height={COL.xh / 2}
			fill="var(--tf-att)"
			opacity="0.22"
		/>
		<rect
			x={c.cx - c.w * 0.32}
			y={COL.x + COL.xh / 2}
			width={c.w * 0.64}
			height={COL.xh / 2}
			fill="var(--tf-q)"
			opacity="0.22"
		/>
		<rect
			x={c.cx - c.w * 0.32}
			y={COL.x}
			width={c.w * 0.64}
			height={COL.xh}
			rx="4"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.3"
		/>
	{/each}
	{#each dots as d (d.key)}
		<circle cx={d.x} cy={d.y} r="3.5" fill="var(--tf-att)" opacity={d.o} />
	{/each}

	<!-- what each row is -->
	<Readout
		id="emb"
		order={2}
		label="Token embedding"
		value="768 numbers, looked up by the token's number (50,257 rows)"
		color="var(--tf-att)"
	>
		<Label
			anchor="start"
			x={24}
			y={COL.emb - 8}
			size={12}
			weight={600}
			color="var(--tf-att)"
			text="token embedding: 768 learned numbers per token, looked up by its number"
		/>
	</Readout>
	<Readout
		id="pos"
		order={3}
		label="Position embedding"
		value="768 numbers for position 0, 1, 2, …"
		color="var(--tf-q)"
	>
		<Label
			anchor="start"
			x={24}
			y={COL.pos - 8}
			size={12}
			weight={600}
			color="var(--tf-q)"
			text="+ position embedding: 768 learned numbers for position 0, 1, 2 …"
		/>
	</Readout>
	<Readout
		id="x"
		order={4}
		label="Input"
		value="their sum: one 768-number vector per token, ready for layer 1"
	>
		<Label
			anchor="start"
			x={24}
			y={COL.x - 8}
			size={12}
			weight={600}
			text="= the token's input vector, ready for layer 1"
		/>
	</Readout>

	<Readout id="caption" order={5} label="Note" value={caption}>
		<Label tabular x={480} y={548} anchor="middle" size={14} text={caption} />
	</Readout>
	<Readout id="count">
		<Label
			tabular
			x={480}
			y={574}
			anchor="middle"
			size={12}
			muted
			text="{s.n} tokens · ␣ marks a space · grey numbers: the token's place in GPT-2's vocabulary"
		/>
	</Readout>
</g>
