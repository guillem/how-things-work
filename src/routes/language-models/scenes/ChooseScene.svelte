<script lang="ts">
	/**
	 * The reader is the sampler: click one of GPT-2's candidate tokens to append it. The bars are
	 * the current context's distribution at the chosen temperature, with the top-p cut; the
	 * first four tokens of each context lead to stored contexts, three levels deep. The grey text
	 * is GPT-2's greedy continuation from the current context. The path is kept in `params.path`
	 * as "restarts|i,j,k" so that the "Start again" button (a counter) empties it.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { percent } from '../lm';
	import { label, lm, num, onkey, str } from './shared';
	import TextCard from './TextCard.svelte';
	import { Label } from '#lib/draw/index.ts';

	let { params, setParam }: StageProps = $props();

	const pid = $derived(str(params.tp, 'story'));
	const prompt = $derived(lm.prompt(pid));
	const restarts = $derived(Math.round(num(params.restart, 0)));
	const path = $derived.by(() => {
		const [r, rest] = str(params.path, '').split('|');
		const [p, ids] = (rest ?? '').split(':');
		if (Number(r) !== restarts || p !== pid || !ids) return [];
		return ids.split(',').map(Number);
	});
	const walk = $derived.by(() => {
		let node = lm.node(prompt.node);
		const chosen: number[] = [];
		for (const i of path) {
			const c = node.ch?.[i];
			if (c === undefined) break;
			chosen.push(node.k[i]);
			node = lm.node(c);
		}
		return { node, chosen };
	});
	const node = $derived(walk.node);
	const T = $derived(num(params.temp, 1));
	const P = $derived(num(params.topp, 0.9));
	const greedyT = $derived(T < 0.05);
	const d = $derived(lm.dist(node, greedyT ? 0 : T));
	const cut = $derived(lm.topP(node, greedyT ? 0 : T, P));
	const depth = $derived(walk.chosen.length);

	const save = (p: number[]) => setParam('path', `${restarts}|${pid}:${p.join(',')}`);
	const choose = (i: number) => save([...path.slice(0, depth), i]);
	const undo = () => save(path.slice(0, Math.max(0, depth - 1)));

	const ROW = { x: 250, y: 286, h: 29, w: 440 };
	const status = $derived(
		node.ch
			? `Your choice ${depth + 1} of 3: click one of the first four tokens`
			: 'Three tokens chosen: as deep as the stored predictions go'
	);
	const cutNote = $derived(
		greedyT
			? 'only the top token can be picked'
			: cut.size === null
				? `top-p ${P.toFixed(2)} keeps more than the ten shown`
				: cut.size === lm.vocab
					? 'top-p 1: every token can be picked'
					: `top-p ${P.toFixed(2)} keeps ${cut.size.toLocaleString('en-US')} token${cut.size === 1 ? '' : 's'}`
	);
	/** Bars are scaled to the most likely token (its percentage is written beside it). */
	const scale = $derived(ROW.w / Math.max(0.2, d.p[0]));
	const text = $derived(lm.text([...prompt.ids.slice(1), ...walk.chosen]));
</script>

<g>
	<Readout id="text" order={1} label="Your text" value={text}>
		<rect
			x="24"
			y="16"
			width="912"
			height="200"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<TextCard
			x={44}
			y={52}
			w={872}
			prompt={prompt.ids.slice(1)}
			gen={walk.chosen}
			ghost={node.g ?? []}
			hot={depth - 1}
			maxLines={5}
			size={17}
			lineH={27}
		/>
	</Readout>
	<Readout id="ghost-note">
		<Label
			anchor="start"
			x={44}
			y={202}
			size={11}
			muted
			text="grey: what GPT-2 would write next if it always took the top token"
		/>
	</Readout>
	{#if depth > 0}
		<g
			class="lm-btn"
			role="button"
			tabindex="0"
			aria-label="Undo the last token"
			onclick={undo}
			onkeydown={(e) => onkey(e, undo)}
		>
			<rect
				x="806"
				y="184"
				width="114"
				height="24"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<text x="863" y="200.5" text-anchor="middle" style:font-size="12px">↶ Undo last token</text>
		</g>
	{/if}

	<Readout id="status" order={2} label="Step" value={status}>
		<Label anchor="start" tabular x={44} y={250} size={14} weight={650} text={status} />
	</Readout>
	<Readout id="cut" order={3} label="Allowed" value={cutNote}>
		<Label
			tabular
			x={920}
			y={250}
			anchor="end"
			size={12}
			muted
			text="T = {greedyT ? '0' : T.toFixed(1)} · {cutNote}"
		/>
	</Readout>

	{#each d.ids as id, i (i)}
		{@const y = ROW.y + i * ROW.h}
		{@const stored = node.ch !== undefined && i < node.ch.length}
		{@const ok = cut.kept[i] && (!greedyT || i === 0)}
		{@const live = stored && ok}
		{#snippet row()}
			{#if live}
				<rect
					class="hit"
					x={60}
					y={y - 2}
					width={800}
					height={ROW.h - 2}
					rx="6"
					fill="var(--lm-bar)"
					fill-opacity="0.07"
					stroke="var(--lm-bar)"
					stroke-opacity="0.5"
				/>
			{/if}
			<Label
				tabular
				x={ROW.x - 14}
				y={y + 17}
				anchor="end"
				size={13.5}
				weight={live ? 650 : 500}
				mono
				text={label(lm.token(id))}
			/>
			<rect
				x={ROW.x}
				y={y + 4}
				width={Math.max(0.5, d.p[i] * scale)}
				height="18"
				rx="3"
				fill={ok ? 'var(--lm-bar)' : 'var(--lm-cut)'}
				opacity="0.85"
			/>
			<Label
				anchor="start"
				tabular
				x={ROW.x + d.p[i] * scale + 8}
				y={y + 17}
				size={12}
				muted
				text="{percent(d.p[i])}{ok ? '' : ' · cut'}"
			/>
			{#if live}
				<Label
					x={848}
					y={y + 17}
					anchor="end"
					size={11.5}
					color="var(--lm-bar)"
					weight={650}
					text="add ›"
				/>
			{:else if ok && node.ch}
				<Readout id="ns-{i}">
					<Label x={848} y={y + 17} anchor="end" size={11} muted text="not stored" />
				</Readout>
			{/if}
		{/snippet}
		{#if live}
			<g
				class="lm-btn"
				role="button"
				tabindex="0"
				aria-label="Add the token {label(lm.token(id))}"
				onclick={() => choose(i)}
				onkeydown={(e) => onkey(e, () => choose(i))}
			>
				{@render row()}
			</g>
		{:else}
			<g opacity={ok ? 1 : 0.45}>{@render row()}</g>
		{/if}
	{/each}
</g>

<style>
	.lm-btn {
		cursor: pointer;
		outline: none;
	}
	.lm-btn:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2.5;
	}
	.lm-btn:hover .hit {
		fill-opacity: 0.16;
	}
</style>
