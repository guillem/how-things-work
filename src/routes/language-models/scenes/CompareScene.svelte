<script lang="ts">
	/**
	 * One prompt, four texts: GPT-2's greedy continuation and the three stored runs for the
	 * chosen temperature and top-p. The texts type themselves out; in each run, the first token
	 * that differs from the greedy text is marked.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { label, lm, num, str } from './shared';
	import TextCard from './TextCard.svelte';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const pid = $derived(str(params.rp, 'story'));
	const prompt = $derived(lm.prompt(pid));
	const T = $derived(Number(str(params.rt, '0.7')));
	const topP = $derived(params.rtp === true ? 0.9 : 1);
	const greedy = $derived(lm.run(pid, 0, 1, 0));
	const runs = $derived(T === 0 ? [greedy] : [1, 2, 3].map((seed) => lm.run(pid, T, topP, seed)));
	const N = 20;
	const shown = $derived(reduced ? N : Math.min(N, Math.floor(num(t, 0) / 0.2)));
	const cards = $derived(
		[
			{ label: 'greedy', run: greedy },
			...(T === 0 ? [] : runs.map((r, i) => ({ label: `run ${i + 1}`, run: r })))
		].map((c, i) => {
			const ids = c.run.steps.map((s) => s.pick);
			const g = greedy.steps.map((s) => s.pick);
			let first = ids.findIndex((id, j) => id !== g[j]);
			if (i === 0) first = -1;
			return { ...c, i, ids, first };
		})
	);
	const CARD = { y: 74, h: 128 };
	const setting = $derived(
		T === 0
			? 'T = 0: every run is the greedy text'
			: `T = ${T}${topP < 1 ? ', top-p 0.9' : ''}: three runs`
	);
</script>

<g>
	<Readout id="prompt" order={1} label="Prompt" value={lm.text(prompt.ids.slice(1))}>
		<Txt x={40} y={30} size={12} muted text="Prompt" />
		<TextCard x={100} y={31} w={820} prompt={prompt.ids.slice(1)} gen={[]} maxLines={2} />
	</Readout>
	<Readout id="setting">
		<Txt x={920} y={62} anchor="end" size={11.5} muted text={setting} />
	</Readout>
	{#each cards as c (c.label)}
		{@const y = CARD.y + c.i * (CARD.h + 4)}
		<rect
			x="24"
			{y}
			width="912"
			height={CARD.h - 6}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout id="card-{c.i}" order={3 + c.i} label={c.label} value={lm.text(c.ids)}>
			<Txt
				x={40}
				y={y + 24}
				size={12.5}
				weight={650}
				color={c.i === 0 ? 'var(--lm-greedy)' : 'var(--lm-gen)'}
				text={c.label}
			/>
			<TextCard
				x={110}
				y={y + 24}
				w={810}
				prompt={[]}
				gen={c.ids.slice(0, shown)}
				hot={c.first < shown ? c.first : -1}
				maxLines={5}
				lineH={20}
				size={13.5}
				color={c.i === 0 ? 'var(--lm-greedy)' : 'var(--lm-gen)'}
			/>
		</Readout>
		{#if c.first >= 0 && c.first < shown}
			<Readout id="diverge-{c.i}">
				<Txt
					x={920}
					y={y + CARD.h - 16}
					anchor="end"
					size={11}
					color="var(--lm-pick)"
					text="first differs from greedy at token {c.first + 1}: {label(lm.token(c.ids[c.first]))}"
				/>
			</Readout>
		{/if}
	{/each}
</g>
