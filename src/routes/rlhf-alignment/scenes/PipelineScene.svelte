<script lang="ts">
	/**
	 * The RLHF recipe at full size (InstructGPT): base model → supervised fine-tuning →
	 * comparisons → reward model → RL with a KL penalty → assistant, with DPO's shortcut from the
	 * comparisons straight to the policy, and what this page stands in for each stage. DPO's dashes
	 * march (a pure function of t); under reduced motion they stand still.
	 */
	import { Label } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const W = 136;
	const H = 74;
	const Y = 150;
	const boxes = [
		{ id: 'base', x: 24, title: 'Base model', sub: 'pre-trained on text', page: 'GPT-2 small' },
		{ id: 'sft', x: 178, title: 'Fine-tuned', sub: 'on written answers', page: 'skipped here' },
		{
			id: 'cmp',
			x: 332,
			title: 'Comparisons',
			sub: 'people pick the better',
			page: 'a written rule'
		},
		{
			id: 'rm',
			x: 486,
			title: 'Reward model',
			sub: 'Bradley–Terry fit',
			page: 'linear, 48 features'
		},
		{ id: 'rl', x: 640, title: 'RL on a leash', sub: 'PPO, KL penalty', page: 'exact optimum' },
		{
			id: 'out',
			x: 794,
			title: 'Assistant',
			sub: 'the tuned policy',
			page: '64 reweighted answers'
		}
	];
	// DPO: from the comparisons straight to the policy, under the reward model and RL
	const dpo = `M ${332 + W / 2} ${Y + H} C ${332 + W / 2} ${Y + H + 90}, ${794 + W / 2} ${Y + H + 90}, ${794 + W / 2} ${Y + H + 4}`;
</script>

<g>
	<Label
		anchor="start"
		x={24}
		y={52}
		text="The recipe at full size (InstructGPT, 2022)"
		size={16}
		weight={700}
	/>
	<Label
		anchor="start"
		x={24}
		y={76}
		text="and what this page puts in each place"
		size={13}
		muted
	/>

	<!-- the arrows between boxes -->
	{#each boxes.slice(0, -1) as b (b.id)}
		<line
			x1={b.x + W + 2}
			x2={b.x + W + 14}
			y1={Y + H / 2}
			y2={Y + H / 2}
			stroke="var(--stage-line)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
	{/each}
	{#each boxes as b (b.id)}
		<rect
			x={b.x}
			y={Y}
			width={W}
			height={H}
			rx="10"
			fill="var(--surface)"
			stroke={b.id === 'rm' || b.id === 'rl' ? 'var(--rl-reward)' : 'var(--border)'}
			stroke-width={b.id === 'rm' || b.id === 'rl' ? 2 : 1}
		/>
		<Label
			x={b.x + W / 2}
			y={Y + 30}
			text={b.title}
			size={13}
			weight={700}
			anchor="middle"
			halo={false}
		/>
		<Label x={b.x + W / 2} y={Y + 52} text={b.sub} size={11} muted anchor="middle" halo={false} />
		<Label
			x={b.x + W / 2}
			y={Y - 14}
			text={b.page}
			size={11}
			anchor="middle"
			color="var(--rl-policy)"
		/>
	{/each}
	<Label anchor="start" x={24} y={Y - 36} text="on this page:" size={11} muted />

	<!-- DPO -->
	<path
		d={dpo}
		fill="none"
		stroke="var(--rl-gold)"
		stroke-width="2.5"
		stroke-dasharray="7 5"
		stroke-dashoffset={reduced ? 0 : -t * 12}
		marker-end="url(#arrowhead)"
	/>
	<Label
		x={(332 + 794 + W) / 2}
		y={Y + H + 86}
		text="DPO: the comparisons train the policy directly"
		size={13}
		weight={600}
		anchor="middle"
		color="var(--rl-gold)"
	/>
	<Label
		x={(332 + 794 + W) / 2}
		y={Y + H + 106}
		text="r(y) = β ln(π(y)/π_ref(y)) + constant"
		size={12}
		anchor="middle"
		mono
	/>

	<!-- three limits -->
	{#each [{ title: 'A proxy', text: 'The reward model learns the raters’ choices, with mistakes of its own.' }, { title: 'A leash', text: 'The policy stays close to the base model it started from.' }, { title: 'One tool', text: 'Alignment also means deciding what to want, and checking it.' }] as c, k (c.title)}
		{@const x = 24 + k * 312}
		<rect
			{x}
			y="380"
			width="290"
			height="112"
			rx="10"
			fill="var(--rl-card)"
			stroke="var(--border)"
		/>
		<Label anchor="start" x={x + 16} y={410} text={c.title} size={14} weight={700} halo={false} />
		{#each c.text.match(/.{1,40}(\s|$)/g) ?? [] as line, j (j)}
			<Label anchor="start" x={x + 16} y={436 + j * 19} text={line.trim()} size={12} halo={false} />
		{/each}
	{/each}
</g>
