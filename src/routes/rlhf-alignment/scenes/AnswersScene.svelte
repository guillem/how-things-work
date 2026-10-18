<script lang="ts">
	/**
	 * GPT-2's 64 answers to the picked question: the prompt, a few answers in full (a window that
	 * moves along the sample over time), and the 64 equal tiles that are the base model's
	 * distribution on the set (1/64 each). In the rater step the tiles take the stand-in rater's
	 * score colours and the listed answers show how the rule scored them.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { promptOf, scoreColor, wrap } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const prompt = $derived(promptOf(params));
	const rater = $derived(step.hints?.mode === 'rater');

	const SHOWN = 4;
	const PERIOD = 7;
	// the window of listed answers moves along the sample; frozen at t = 2.5 under reduced motion
	const page = $derived(Math.floor((reduced ? 0 : t) / PERIOD) % 16);
	const fade = $derived(reduced ? 1 : Math.min(1, ((t % PERIOD) / 0.5) ** 2));
	const shown = $derived(
		Array.from({ length: SHOWN }, (_, k) => {
			const i = page * SHOWN + k;
			const a = prompt.answers[i];
			return { i, a, lines: wrap(a.text, 64, 2) };
		})
	);
	const shownSet = $derived(new Set(shown.map((s) => s.i)));

	const GRID = { x: 616, y: 132, cell: 38, gap: 4 };
	const tiles = $derived(
		prompt.answers.map((a, i) => ({
			i,
			x: GRID.x + (i % 8) * (GRID.cell + GRID.gap),
			y: GRID.y + Math.floor(i / 8) * (GRID.cell + GRID.gap),
			score: a.score
		}))
	);

	const PART_NAMES = ['useful words', 'finished', 'ends on a question', 'about itself', 'repeats'];
	function breakdown(parts: number[], used: string[]): string {
		const bits: string[] = [];
		parts.forEach((v, k) => {
			if (!v) return;
			const sign = v > 0 ? '+' : '−';
			bits.push(
				k === 0
					? `${sign}${Math.abs(v)} (${used.slice(0, 3).join(', ')})`
					: `${sign}${Math.abs(v)} ${PART_NAMES[k]}`
			);
		});
		return bits.length ? bits.join(' · ') : 'no points';
	}

	const mean = $derived(prompt.answers.reduce((s, a) => s + a.score, 0) / 64);
	const counts = $derived(
		[-1, 0, 1, 2, 3, 4]
			.map((s) => ({
				s,
				n: prompt.answers.filter((a) => (s === -1 ? a.score <= -1 : a.score === s)).length
			}))
			.filter((c) => c.n > 0)
	);
</script>

<g>
	<!-- the prompt -->
	<rect
		x="24"
		y="24"
		width="552"
		height="74"
		rx="10"
		fill="var(--rl-card)"
		stroke="var(--border)"
	/>
	<Label
		anchor="start"
		x={40}
		y={48}
		text="Prompt given to GPT-2 small"
		size={11}
		muted
		halo={false}
	/>
	<Label
		anchor="start"
		x={40}
		y={70}
		text="Q: {prompt.question}"
		size={15}
		weight={600}
		mono
		halo={false}
	/>
	<Label anchor="start" x={40} y={89} text="A: …" size={13} mono muted halo={false} />

	<!-- the listed answers -->
	<Label
		anchor="start"
		x={24}
		y={128}
		text={rater ? 'Answers, and how the rule scores them' : 'Some of its 64 answers'}
		size={13}
		weight={600}
	/>
	{#each shown as s, k (s.i)}
		{@const y = 146 + k * (rater ? 100 : 86)}
		<g opacity={fade}>
			<rect
				x="24"
				{y}
				width="552"
				height={rater ? 88 : 74}
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect
				x="24"
				{y}
				width="6"
				height={rater ? 88 : 74}
				rx="3"
				fill={rater ? scoreColor(s.a.score) : 'var(--rl-policy)'}
			/>
			<Label
				anchor="start"
				x={42}
				y={y + 20}
				text="#{s.i + 1}"
				size={11}
				muted
				halo={false}
				tabular
			/>
			{#each s.lines as line, j (j)}
				<Label anchor="start" x={78} y={y + 22 + j * 19} text={line} size={13} halo={false} />
			{/each}
			{#if rater}
				<Label
					anchor="start"
					x={78}
					y={y + 74}
					text={breakdown(s.a.parts, s.a.used)}
					size={11}
					muted
					halo={false}
				/>
				<Label
					x={562}
					y={y + 74}
					text="score {s.a.score < 0 ? '−' : ''}{Math.abs(s.a.score)}"
					size={12}
					weight={700}
					anchor="end"
					color={scoreColor(s.a.score)}
					halo={false}
				/>
			{:else}
				<Label
					x={562}
					y={y + 62}
					text="{s.a.tokens} tokens"
					size={11}
					muted
					anchor="end"
					halo={false}
					tabular
				/>
			{/if}
		</g>
	{/each}

	<!-- the 64 tiles -->
	<Readout
		id="tiles"
		order={1}
		label="GPT-2's 64 answers"
		value={rater ? `average score ${mean.toFixed(2)}` : '1/64 each'}
	>
		<Label
			anchor="start"
			x={GRID.x}
			y={GRID.y - 30}
			text={rater ? 'The 64 answers, coloured by score' : 'The base model on this set: 1/64 each'}
			size={13}
			weight={600}
		/>
	</Readout>
	{#each tiles as tile (tile.i)}
		<rect
			x={tile.x}
			y={tile.y}
			width={GRID.cell}
			height={GRID.cell}
			rx="5"
			fill={rater ? scoreColor(tile.score) : 'var(--rl-policy)'}
			fill-opacity={rater ? 0.9 : shownSet.has(tile.i) ? 0.85 : 0.28}
			stroke={shownSet.has(tile.i) ? 'var(--stage-ink)' : 'none'}
			stroke-width="2"
		/>
	{/each}
	{#if rater}
		{#each counts as c, k (c.s)}
			{@const x = GRID.x + k * 66}
			<rect {x} y={GRID.y + 344} width="14" height="14" rx="3" fill={scoreColor(c.s)} />
			<Label
				anchor="start"
				x={x + 19}
				y={GRID.y + 356}
				text="{c.s < 0 ? '≤−1' : c.s}: {c.n}"
				size={11}
				halo={false}
				tabular
			/>
		{/each}
		<Readout id="mean" order={2} label="Average score" value={mean.toFixed(2)}>
			<Label
				anchor="start"
				x={GRID.x}
				y={GRID.y + 392}
				text="average score of GPT-2's answers: {mean.toFixed(2)}"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Readout id="note" order={2} label="Sampling" value="top-k 40, temperature 1">
			<Label
				anchor="start"
				x={GRID.x}
				y={GRID.y + 356}
				text="64 seeds · top-k 40 · temperature 1"
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>
