<script lang="ts">
	/**
	 * Two ways to agree, side by side: voting among known servers (Raft; Byzantine variants)
	 * and proof-of-work among strangers. Static cards that fade in one row at a time.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';

	let { t, reduced }: StageProps = $props();
	const tv = $derived(reduced ? 100 : t);

	const rows: { k: string; a: string; a2?: string; b: string }[] = [
		{ k: 'Who takes part', a: 'a known list of servers', b: 'anyone, under any name' },
		{
			k: 'How they decide',
			a: 'a majority votes for each entry',
			b: 'the chain with the most work wins'
		},
		{
			k: 'Failures survived',
			a: 'crashes: fewer than half',
			a2: 'liars: fewer than a third (BFT)',
			b: 'cheats with under half the power'
		},
		{ k: 'When it is final', a: 'at once, once committed', b: 'ever more likely with each block' },
		{ k: 'What it costs', a: 'a few messages per entry', b: 'a vast amount of hashing' },
		{ k: 'Used by', a: 'databases, cluster managers', b: 'Bitcoin and other blockchains' }
	];
	const COL = { k: 40, a: 250, b: 610 };
	const Y0 = 150;
	const ROWH = 52;
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Takeaway"
		value="voting among known machines; work among strangers"
	>
		<Txt
			x={480}
			y={44}
			text="Two ways to agree on one history"
			size={18}
			weight={700}
			anchor="middle"
		/>
	</Readout>
	<rect
		x={COL.a - 16}
		y={Y0 - 58}
		width="340"
		height={rows.length * ROWH + 66}
		rx="14"
		fill="var(--cb-follower)"
		fill-opacity="0.08"
		stroke="var(--cb-follower)"
	/>
	<rect
		x={COL.b - 16}
		y={Y0 - 58}
		width="340"
		height={rows.length * ROWH + 66}
		rx="14"
		fill="var(--cb-work)"
		fill-opacity="0.08"
		stroke="var(--cb-work)"
	/>
	<Txt
		x={COL.a}
		y={Y0 - 26}
		text="Voting among known servers"
		size={15}
		weight={700}
		color="var(--cb-follower)"
	/>
	<Txt
		x={COL.b}
		y={Y0 - 26}
		text="Proof-of-work among strangers"
		size={15}
		weight={700}
		color="var(--cb-work)"
	/>
	{#each rows as r, i (i)}
		{@const y = Y0 + i * ROWH + (i > 2 ? 22 : 0)}
		<g opacity={smoothstep(0.3 + i * 0.35, 0.7 + i * 0.35, tv)}>
			<Readout
				id="row-{i}"
				order={2 + i}
				label={r.k}
				value="{r.a}{r.a2 ? `, ${r.a2}` : ''} · {r.b}"
			>
				<Txt x={COL.k} y={y + 14} text={r.k} size={12} weight={700} muted />
				<Txt x={COL.a} y={y + 14} text={r.a} size={14} />
				{#if r.a2}
					<Txt x={COL.a} y={y + 36} text={r.a2} size={14} />
				{/if}
				<Txt x={COL.b} y={y + 14} text={r.b} size={14} />
			</Readout>
		</g>
	{/each}
	<g opacity={smoothstep(3, 3.6, tv)}>
		<Readout
			id="moral"
			order={20}
			label="In one line"
			value="agreement is hard; votes handle failures, work handles strangers"
		>
			<Txt
				x={480}
				y={560}
				text="Votes handle failures among machines you know; work lets strangers agree, if no one controls half of it."
				size={13}
				weight={600}
				anchor="middle"
			/>
		</Readout>
	</g>
</g>
