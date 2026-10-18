<script lang="ts">
	/**
	 * One request in eleven languages, each cut by GPT-2's tokenizer: one block per token, so the
	 * bar's length is the cost and its blocks show how fragmented the text is. Characters and
	 * UTF-8 bytes under each sentence.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { LANGUAGES, type Gpt2 } from '../gpt2';
	import { tokenizer } from './shared';

	let { t }: StageProps = $props();

	let g = $state<Gpt2 | null>(null);
	let failed = $state(false);
	$effect(() => {
		tokenizer().then(
			(x) => (g = x),
			() => (failed = true)
		);
	});

	const enc = new TextEncoder();
	const rows = $derived(
		g
			? LANGUAGES.map((l) => ({
					...l,
					tokens: g!.bpe.encode(l.text).length,
					chars: [...l.text].length,
					bytes: enc.encode(l.text).length
				}))
			: []
	);
	const english = $derived(rows[0]?.tokens ?? 1);
	const BX = 430;
	const BW = 420;
	const TOP = 66;
	const RH = 47;
	const unit = $derived(BW / Math.max(1, ...rows.map((r) => r.tokens)));
	const grow = $derived(smoothstep(0.1, 2.2, t));
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
				y={30}
				size={15}
				weight={650}
				text="“I would like a cup of coffee, please” in GPT-2’s tokens"
			/>
			<Label anchor="start" x={BX} y={52} size={11} muted text="one block per token" />
		</Readout>
		{#each rows as r, i (r.lang)}
			{@const y = TOP + i * RH}
			{@const n = Math.ceil(r.tokens * grow)}
			<Readout
				id="lang-{i}"
				order={i}
				label={r.lang}
				value="{r.tokens} tokens{i ? ` (×${(r.tokens / english).toFixed(1)})` : ''}"
			>
				<Label anchor="start" x={24} y={y + 14} size={13} weight={650} text={r.lang} />
				<Label
					x={BX - 14}
					y={y + 14}
					anchor="end"
					size={11}
					muted
					tabular
					text="{r.chars} characters, {r.bytes} bytes"
				/>
				<Label anchor="start" x={24} y={y + 35} size={14} text={r.text} />
				{#each Array.from({ length: n }, (_, j) => j) as j (j)}
					<rect
						x={BX + j * unit}
						y={y + 6}
						width={Math.max(1, unit - 1.5)}
						height="26"
						rx="2"
						fill={j % 2 ? 'var(--tk-bar)' : 'var(--tk-bar-alt)'}
					/>
				{/each}
				<Label
					anchor="start"
					x={BX + n * unit + 8}
					y={y + 24}
					size={13}
					weight={650}
					tabular
					text={String(n)}
				/>
				{#if i > 0 && n === r.tokens}
					<Label
						anchor="start"
						x={BX + n * unit + 8 + String(n).length * 8 + 6}
						y={y + 24}
						size={11}
						muted
						tabular
						text="×{(r.tokens / english).toFixed(1)}"
					/>
				{/if}
			</Readout>
		{/each}
	{/if}
</g>
