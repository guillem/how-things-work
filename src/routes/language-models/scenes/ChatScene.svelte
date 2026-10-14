<script lang="ts">
	/**
	 * A base model continues text. Left: the prompt (the bare question, or framed as Q: … A:),
	 * GPT-2's real next-token probabilities, its greedy continuation and three samples at
	 * T = 0.7. Right: how a chat assistant sees a conversation, as one text with special tokens
	 * marking who speaks (a schematic of the format, no real model output).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { smoothstep } from '#lib/draw/index.ts';
	import { percent } from '../lm';
	import { label, lm, str } from './shared';
	import TextCard from './TextCard.svelte';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const pid = $derived(str(params.frame, 'question'));
	const prompt = $derived(lm.prompt(pid));
	const d = $derived(lm.dist(lm.node(prompt.node), 1));
	const outs = $derived([
		{ label: 'greedy', run: lm.run(pid, 0, 1, 0) },
		...[1, 2, 3].map((seed) => ({ label: `T 0.7, run ${seed}`, run: lm.run(pid, 0.7, 1, seed) }))
	]);
	const shown = $derived(reduced ? 20 : Math.min(20, Math.floor(t / 0.18)));
	const L = { x: 40, w: 520 };

	// the chat schematic: a reply being written, one block per beat
	const beats = $derived(reduced ? 6 : Math.floor((t % 9) / 0.9));
	const fade = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

<g>
	<Readout id="base-title">
		<Txt x={L.x} y={30} size={14} weight={650} text="GPT-2, a base model" />
	</Readout>
	<rect
		x={L.x - 12}
		y={42}
		width={L.w + 24}
		height={58}
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="prompt" order={1} label="Prompt" value={lm.text(prompt.ids.slice(1))}>
		<TextCard
			x={L.x}
			y={64}
			w={L.w}
			prompt={prompt.ids.slice(1)}
			gen={[]}
			maxLines={2}
			size={13.5}
			lineH={20}
		/>
	</Readout>
	<Readout id="next-title">
		<Txt x={L.x} y={124} size={12} muted text="its next token" />
	</Readout>
	{#each d.ids.slice(0, 4) as id, i (i)}
		{@const y = 134 + i * 22}
		<Txt x={L.x + 70} y={y + 13} anchor="end" size={12.5} mono text={label(lm.token(id))} />
		<rect
			x={L.x + 80}
			y={y + 2}
			width={Math.max(0.5, d.p[i] * 300)}
			height="15"
			rx="3"
			fill="var(--lm-bar)"
			opacity="0.85"
		/>
		<Txt x={L.x + 88 + d.p[i] * 300} y={y + 13} size={11.5} muted text={percent(d.p[i])} />
	{/each}
	<Readout
		id="next"
		order={2}
		label="Most likely next token"
		value="{label(lm.token(d.ids[0]))} ({percent(d.p[0])})"
	/>

	<Readout id="cont-title">
		<Txt x={L.x} y={244} size={12} muted text="what it writes (20 tokens each)" />
	</Readout>
	{#each outs as o, i (o.label)}
		{@const y = 256 + i * 86}
		<rect
			x={L.x - 12}
			{y}
			width={L.w + 24}
			height="80"
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout
			id="out-{i}"
			order={3 + i}
			label={i === 0 ? o.label : undefined}
			value={i === 0 ? lm.text(o.run.steps.map((s) => s.pick)) : undefined}
		>
			<Txt
				x={L.x}
				y={y + 18}
				size={11}
				weight={650}
				color={i === 0 ? 'var(--lm-greedy)' : 'var(--lm-gen)'}
				text={o.label}
			/>
			<TextCard
				x={L.x}
				y={y + 35}
				w={L.w}
				prompt={[]}
				gen={o.run.steps.slice(0, shown).map((s) => s.pick)}
				maxLines={3}
				size={12.5}
				lineH={15.5}
				color={i === 0 ? 'var(--lm-greedy)' : 'var(--lm-gen)'}
			/>
		</Readout>
	{/each}

	<!-- a chat model's view of a conversation -->
	<g opacity={fade}>
		<Readout
			id="chat-title"
			order={8}
			label="A chat assistant"
			value="the same next-token loop, after further training on conversations and on people’s preferences"
		>
			<Txt x={620} y={30} size={14} weight={650} text="A chat assistant" />
			<Txt x={620} y={50} size={11.5} muted text="sees the conversation as one text, with" />
			<Txt x={620} y={65} size={11.5} muted text="special tokens marking who speaks:" />
		</Readout>
		<rect
			x="608"
			y="80"
			width="328"
			height="244"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<g style:font-family="var(--font-mono)">
			<rect
				x="622"
				y="96"
				width="74"
				height="20"
				rx="4"
				fill="var(--lm-t3)"
				stroke="var(--border)"
			/>
			<text x="659" y="110" text-anchor="middle" style:font-size="11.5px">⟨user⟩</text>
			<text x="622" y="138" style:font-size="12.5px">What is the boiling point</text>
			<text x="622" y="156" style:font-size="12.5px">of water?</text>
			<rect
				x="622"
				y="172"
				width="104"
				height="20"
				rx="4"
				fill="var(--lm-t5)"
				stroke="var(--border)"
			/>
			<text x="674" y="186" text-anchor="middle" style:font-size="11.5px">⟨assistant⟩</text>
		</g>
		{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
			{@const on = i < beats}
			<rect
				x={622 + (i % 3) * 98}
				y={204 + Math.floor(i / 3) * 26}
				width="90"
				height="16"
				rx="3"
				fill={on ? 'var(--lm-gen)' : 'none'}
				fill-opacity="0.35"
				stroke="var(--lm-gen)"
				stroke-dasharray={on ? undefined : '3 3'}
				stroke-opacity="0.7"
			/>
		{/each}
		<Readout id="chat-note">
			<Txt x={622} y={276} size={11} muted text="the reply: generated one token at a time," />
			<Txt x={622} y={292} size={11} muted text="by the same loop as GPT-2 (format only;" />
			<Txt x={622} y={308} size={11} muted text="each product has its own special tokens)" />
		</Readout>
		<Readout id="recipe">
			<Txt x={620} y={356} size={12.5} weight={650} text="How a base model becomes one" />
			<Txt x={620} y={380} size={12} text="1. pretraining: predict the next token" />
			<Txt x={636} y={396} size={11.5} muted text="of a huge amount of text (GPT-2 stops here)" />
			<Txt x={620} y={420} size={12} text="2. instruction tuning: more training on" />
			<Txt x={636} y={436} size={11.5} muted text="example conversations written by people" />
			<Txt x={620} y={460} size={12} text="3. RLHF: training towards the answers" />
			<Txt x={636} y={476} size={11.5} muted text="people prefer" />
			<Txt
				x={620}
				y={508}
				size={12}
				weight={650}
				color="var(--lm-bar)"
				text="Still the same job at every step:"
			/>
			<Txt
				x={620}
				y={526}
				size={12}
				weight={650}
				color="var(--lm-bar)"
				text="predict the next token."
			/>
		</Readout>
	</g>
</g>
