<script lang="ts">
	/**
	 * The whole loop, on GPT-2's greedy story: text → tokens → the network → a probability for
	 * every token → pick one → append it → again. A light goes round once per token, and the
	 * text grows by one token each time it comes back.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { along, Label, smooth } from '#lib/draw/index.ts';
	import { percent } from '../lm';
	import { label, lm } from './shared';
	import TextCard from './TextCard.svelte';

	let { t, reduced }: StageProps = $props();

	const prompt = lm.prompt('story');
	const run = lm.run('story', 0, 1, 0);
	const BEAT = 3.2;
	const N = run.steps.length;
	const k = $derived(reduced ? 6 : Math.floor(t / BEAT) % (N + 1));
	const u = $derived(reduced ? 0.7 : (t % BEAT) / BEAT);
	const cur = $derived(Math.min(N - 1, k));
	const s = $derived(run.steps[cur]);
	const gen = $derived(run.steps.slice(0, k).map((x) => x.pick));

	// stations of the loop
	const S = {
		text: { x: 40, y: 40, w: 420, h: 200 },
		tok: { x: 540, y: 40, w: 380, h: 120 },
		net: { x: 540, y: 250, w: 380, h: 120 },
		prob: { x: 40, y: 330, w: 420, h: 200 }
	};
	const loop = smooth([
		{ x: 470, y: 100 },
		{ x: 530, y: 100 },
		{ x: 730, y: 170 },
		{ x: 730, y: 240 },
		{ x: 610, y: 400 },
		{ x: 470, y: 440 },
		{ x: 250, y: 545 },
		{ x: 250, y: 300 },
		{ x: 250, y: 250 }
	]);
	const dot = $derived(along(loop, u));
	const lastTok = $derived([...prompt.ids.slice(1), ...gen].slice(-5));
</script>

<g>
	<path
		d={loop.length ? 'M' + loop.map((p) => `${p.x} ${p.y}`).join(' L') : ''}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="2"
		stroke-dasharray="5 5"
	/>
	{#if !reduced}
		<circle cx={dot.x} cy={dot.y} r="7" fill="var(--lm-pick)" />
	{/if}

	<!-- 1 the text -->
	<rect
		x={S.text.x}
		y={S.text.y}
		width={S.text.w}
		height={S.text.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="s-text"
		order={1}
		label="1 The text so far"
		value={lm.text([...prompt.ids.slice(1), ...gen])}
	>
		<Label
			anchor="start"
			x={S.text.x + 16}
			y={S.text.y + 24}
			size={13}
			weight={650}
			text="1  the text so far"
		/>
		<TextCard
			x={S.text.x + 16}
			y={S.text.y + 52}
			w={S.text.w - 32}
			prompt={prompt.ids.slice(1)}
			{gen}
			hot={k - 1}
			maxLines={7}
			size={13}
			lineH={19}
		/>
	</Readout>

	<!-- 2 tokens -->
	<rect
		x={S.tok.x}
		y={S.tok.y}
		width={S.tok.w}
		height={S.tok.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="s-tok"
		order={2}
		label="2 Tokens"
		value="{prompt.ids.length - 1 + k} tokens, each a number"
	>
		<Label
			anchor="start"
			tabular
			x={S.tok.x + 16}
			y={S.tok.y + 24}
			size={13}
			weight={650}
			text="2  cut into tokens ({prompt.ids.length - 1 + k})"
		/>
		{#each lastTok as id, i (i)}
			<rect
				x={S.tok.x + 16 + i * 71}
				y={S.tok.y + 50}
				width="66"
				height="26"
				rx="5"
				fill="var(--lm-t{(i % 5) + 1})"
				stroke="var(--border)"
			/>
			<text
				x={S.tok.x + 49 + i * 71}
				y={S.tok.y + 67}
				text-anchor="middle"
				style:font-size="12px"
				style:font-family="var(--font-mono)">{label(lm.token(id))}</text
			>
			<text
				x={S.tok.x + 49 + i * 71}
				y={S.tok.y + 94}
				text-anchor="middle"
				style:font-size="10.5px"
				style:fill="var(--stage-ink-muted)">{id}</text
			>
		{/each}
	</Readout>

	<!-- 3 the network -->
	<rect
		x={S.net.x}
		y={S.net.y}
		width={S.net.w}
		height={S.net.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="s-net"
		order={3}
		label="3 The network"
		value="a transformer of 124 million learned numbers scores all 50,257 tokens"
	>
		<Label
			anchor="start"
			x={S.net.x + 16}
			y={S.net.y + 24}
			size={13}
			weight={650}
			text="3  the network"
		/>
		{#each Array.from({ length: 12 }, (_, i) => i) as l (l)}
			<rect
				x={S.net.x + 16 + l * 29}
				y={S.net.y + 40}
				width="24"
				height="34"
				rx="3"
				fill="var(--lm-bar)"
				opacity={0.2 + 0.6 * (u > 0.22 + l * 0.015 && u < 0.4 + l * 0.015 ? 1 : 0)}
			/>
		{/each}
		<Label
			anchor="start"
			x={S.net.x + 16}
			y={S.net.y + 96}
			size={11.5}
			muted
			text="12 transformer blocks, 124 million learned numbers:"
		/>
		<Label
			anchor="start"
			x={S.net.x + 16}
			y={S.net.y + 111}
			size={11.5}
			muted
			text="a score for every one of the 50,257 tokens"
		/>
	</Readout>

	<!-- 4 probabilities and the pick -->
	<rect
		x={S.prob.x}
		y={S.prob.y}
		width={S.prob.w}
		height={S.prob.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="s-prob"
		order={4}
		label="4 Pick a token"
		value="{label(lm.token(s.pick))} ({percent(s.pp)}), appended to the text"
	>
		<Label
			anchor="start"
			x={S.prob.x + 16}
			y={S.prob.y + 24}
			size={13}
			weight={650}
			text="4  probabilities → pick one → append"
		/>
		{#each s.d.slice(0, 4) as [id, p], i (i)}
			{@const y = S.prob.y + 44 + i * 30}
			{@const on = id === s.pick && u > 0.62}
			<Label
				tabular
				x={S.prob.x + 120}
				y={y + 15}
				anchor="end"
				size={13}
				weight={on ? 700 : 500}
				color={on ? 'var(--lm-pick)' : undefined}
				mono
				text={label(lm.token(id))}
			/>
			<rect
				x={S.prob.x + 130}
				y={y + 2}
				width={Math.max(0.5, p * 300 * (u > 0.45 ? 1 : 0.15))}
				height="18"
				rx="3"
				fill={on ? 'var(--lm-pick)' : 'var(--lm-bar)'}
				opacity="0.85"
			/>
			<Label
				anchor="start"
				tabular
				x={S.prob.x + 138 + p * 300 * (u > 0.45 ? 1 : 0.15)}
				y={y + 15}
				size={11.5}
				muted
				text={percent(p)}
			/>
		{/each}
		<Label
			anchor="start"
			x={S.prob.x + 16}
			y={S.prob.y + 180}
			size={11.5}
			muted
			text="here greedy: always the top token"
		/>
	</Readout>

	<Readout id="moral">
		<Label x={920} y={470} anchor="end" size={15} weight={650} text="Predict one token." />
		<Label x={920} y={492} anchor="end" size={15} weight={650} text="Append it. Repeat." />
		<Label
			x={920}
			y={520}
			anchor="end"
			size={12}
			muted
			text="Stories, answers and code all come out of this loop."
		/>
	</Readout>
</g>
