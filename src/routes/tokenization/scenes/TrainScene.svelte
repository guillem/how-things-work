<script lang="ts">
	/**
	 * Byte-pair encoding learned from the reader's text (see `bpe-train.ts`). Left: the most
	 * frequent pieces of the text, as their tokens after k merges; the pair that will be merged
	 * next is underlined, the token the last merge made is highlighted. Right: the most frequent
	 * pairs now, and the vocabulary with the latest merges. Phase "pairs": before any merge.
	 * Phase "merge": k from the slider, or played one merge per TICK seconds.
	 */
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';
	import { trained } from '../bpe-train';
	import { corpusOf, DEFAULT_CORPUS, MAX_CORPUS } from '../steps';
	import TextBox from './TextBox.svelte';
	import { chipWidth, clip, FILLS, fmt, show } from './shared';

	let { step, t, params, setParam }: StageProps = $props();

	const PRESETS = [
		{ label: 'Hamlet', value: DEFAULT_CORPUS },
		{
			label: 'low lower newest widest',
			value:
				'low low low low low lower lower newest newest newest newest newest newest widest widest widest'
		},
		{ label: 'aaabdaaabac', value: 'aaabdaaabac' }
	];

	const phase = $derived(String(step.hints?.phase ?? 'merge'));
	const corpus = $derived(corpusOf(params));
	const tr = $derived(trained(corpus));
	const N = $derived(tr.merges.length);

	// ---- which merge: none (phase pairs), the slider, or played
	const TICK = 0.8;
	const playing = $derived(phase === 'merge' && params.play === true);
	const played = $derived.by(() => {
		if (!playing) return null;
		const period = (N + 4) * TICK;
		return Math.min(N, Math.floor((t % period) / TICK));
	});
	$effect(() => {
		const v = played;
		if (v !== null) untrack(() => setParam('k', v));
	});
	const k = $derived(
		phase === 'pairs'
			? 0
			: (played ?? Math.max(0, Math.min(N, Math.round(Number(params.k ?? 1)) || 0)))
	);

	const latest = $derived(k > 0 ? tr.merges[k - 1] : null);
	const pairs = $derived(tr.pairs(k, 6));
	const next = $derived(pairs.length && pairs[0].count >= 2 ? pairs[0] : null);
	const tok = (id: number) => clip(show(tr.text(id)), 9);
	const chipText = (id: number) => clip(show(tr.text(id)), 30);

	// ---- left: the most frequent pieces
	const LX = 24;
	const LW = 540;
	const ROW = 34;
	const TOP = 186;
	const ROWS = 9;
	const F = 14;
	const CH = 24;
	const rows = $derived.by(() => {
		const words = tr.words
			.map((w, i) => ({ w, i }))
			.sort((a, b) => b.w.count - a.w.count || a.i - b.i)
			.slice(0, ROWS);
		return words.map(({ w, i }, r) => {
			const toks = tr.tokensOf(w, k);
			let x = LX + 52;
			let cut = false;
			const chips: { j: number; x: number; w: number; text: string; id: number }[] = [];
			for (let j = 0; j < toks.length; j++) {
				const text = chipText(toks[j]);
				const cw = chipWidth(text, F, 18);
				if (x + cw > LX + LW - 14) {
					cut = true;
					break;
				}
				chips.push({ j, x, w: cw, text, id: toks[j] });
				x += cw + 3;
			}
			// where the next pair sits in this piece
			const marks: { x0: number; x1: number }[] = [];
			if (next)
				for (let j = 0; j < chips.length - 1; j++)
					if (toks[j] === next.a && toks[j + 1] === next.b) {
						marks.push({ x0: chips[j].x, x1: chips[j + 1].x + chips[j + 1].w });
						j++;
					}
			return { key: i, y: TOP + r * ROW, count: w.count, chips, cut, end: x, marks };
		});
	});
	const hidden = $derived(tr.words.length - rows.length);

	// ---- right: pairs and vocabulary
	const RX = 600;
	const RW = 336;
	const maxPair = $derived(Math.max(1, ...pairs.map((p) => p.count)));
	const recent = $derived(tr.merges.slice(Math.max(0, k - 6), k).reverse());
	const tokens = $derived(tr.total[k]);
	const bytes = $derived(tr.total[0]);
	const caption = $derived(
		phase === 'pairs'
			? next
				? `Most frequent pair: ${tok(next.a)} + ${tok(next.b)}, ${next.count} times`
				: 'No pair occurs twice'
			: latest
				? `Merge no. ${k}: ${tok(latest.a)} + ${tok(latest.b)} → ${tok(latest.id)} (${latest.count} times)`
				: next
					? `No merge yet; first: ${tok(next.a)} + ${tok(next.b)}`
					: 'No pair occurs twice: nothing to merge'
	);
	const done = $derived(phase === 'merge' && k === N && !next);
	/** Training was cut short by the page's limit while pairs still repeat. */
	const capped = $derived(phase === 'merge' && k === N && next !== null);
	const ending = $derived(
		done
			? ' · no pair occurs twice any more: training stops'
			: capped
				? ` · this page stops at ${N} merges; pairs still repeat`
				: ''
	);
</script>

<g>
	<TextBox
		id="corpus"
		x={24}
		y={16}
		w={912}
		h={84}
		value={corpus}
		max={MAX_CORPUS}
		name="Text to learn the merges from"
		presets={PRESETS}
		{setParam}
	/>

	<!-- left: the pieces -->
	<Readout id="pieces-title">
		<Label
			anchor="start"
			x={LX}
			y={TOP - 22}
			size={13}
			weight={650}
			text="The most frequent pieces of the text, as tokens"
		/>
	</Readout>
	{#each rows as row (row.key)}
		<Label x={LX + 40} y={row.y + 17} anchor="end" size={12} muted tabular text="×{row.count}" />
		{#each row.chips as c (c.j)}
			{@const hot = latest !== null && c.id === latest.id}
			<rect
				x={c.x}
				y={row.y}
				width={c.w}
				height={CH}
				rx="5"
				fill={hot ? 'color-mix(in oklab, var(--tk-hot) 30%, var(--surface))' : FILLS[c.j % 5]}
				stroke={hot ? 'var(--tk-hot)' : 'var(--border)'}
				stroke-width={hot ? 2 : 1}
			/>
			<text
				x={c.x + c.w / 2}
				y={row.y + CH * 0.7}
				text-anchor="middle"
				font-size={F}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
		{/each}
		{#each row.marks as m, mi (mi)}
			<path
				d="M{m.x0 + 2} {row.y + CH + 3} h{m.x1 - m.x0 - 4}"
				stroke="var(--tk-next)"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		{/each}
		{#if row.cut}
			<Label anchor="start" x={row.end + 2} y={row.y + 17} size={13} muted text="…" />
		{/if}
	{/each}
	{#if hidden > 0}
		<Readout id="hidden">
			<Label
				anchor="start"
				x={LX + 52}
				y={TOP + rows.length * ROW + 14}
				size={11}
				muted
				text="and {hidden} other piece{hidden === 1 ? '' : 's'} · ␣ is a space"
			/>
		</Readout>
	{/if}

	<!-- right: the pairs -->
	<Readout id="pairs-title">
		<Label
			anchor="start"
			x={RX}
			y={TOP - 22}
			size={13}
			weight={650}
			text={phase === 'pairs' ? 'Neighbouring pairs, counted' : 'Most frequent pairs now'}
		/>
	</Readout>
	{#each pairs as p, i (p.a * 65536 + p.b)}
		{@const y = TOP + i * 26}
		{@const top = i === 0 && p.count >= 2}
		<Label
			x={RX + 118}
			y={y + 13}
			anchor="end"
			size={13}
			mono
			weight={top ? 650 : 500}
			color={top ? 'var(--tk-next)' : undefined}
			text="{tok(p.a)} + {tok(p.b)}"
		/>
		<rect
			x={RX + 128}
			y={y + 3}
			width={Math.max(2, (p.count / maxPair) * (RW - 170))}
			height="14"
			rx="3"
			fill={top ? 'var(--tk-next)' : 'var(--stage-ink-muted)'}
			opacity={top ? 0.85 : 0.35}
		/>
		<Label
			anchor="start"
			x={RX + 134 + Math.max(2, (p.count / maxPair) * (RW - 170))}
			y={y + 13}
			size={12}
			tabular
			muted={!top}
			text={String(p.count)}
		/>
	{/each}

	<!-- right: the vocabulary -->
	<Readout
		id="vocab"
		order={2}
		label="Vocabulary"
		value="256 bytes + {k} merge{k === 1 ? '' : 's'} = {256 + k}"
	>
		<Label
			anchor="start"
			x={RX}
			y={360}
			size={13}
			weight={650}
			tabular
			text="Vocabulary: 256 bytes + {k} merge{k === 1 ? '' : 's'} = {256 + k}"
		/>
	</Readout>
	{#if phase === 'pairs'}
		<Readout id="vocab-note">
			<Label
				anchor="start"
				x={RX}
				y={384}
				size={12}
				muted
				text="Every byte, 0 to 255, is a token of its own."
			/>
			<Label
				anchor="start"
				x={RX}
				y={402}
				size={12}
				muted
				text="Merges will add new tokens, numbered from 256."
			/>
		</Readout>
	{:else}
		{#each recent as m, i (m.id)}
			{@const y = 384 + i * 22}
			<Readout id="recent-{m.id}">
				<Label
					x={RX + 52}
					{y}
					anchor="end"
					size={11.5}
					tabular
					muted={i > 0}
					text="no. {m.id - 255}"
				/>
				<Label
					anchor="start"
					x={RX + 62}
					{y}
					size={12.5}
					mono
					weight={i === 0 ? 650 : 500}
					color={i === 0 ? 'var(--tk-hot)' : undefined}
					text="{tok(m.a)} + {tok(m.b)} → {tok(m.id)}"
				/>
			</Readout>
		{/each}
		{#if k === 0}
			<Label anchor="start" x={RX} y={384} size={12} muted text="No merge yet: move the slider." />
		{/if}
	{/if}

	<!-- bottom: the result -->
	<Readout id="caption" order={1} label="Now" value={caption}>
		<Label anchor="start" x={LX} y={556} size={14} weight={650} tabular text={caption} />
	</Readout>
	<Readout
		id="count"
		order={3}
		label="Your text"
		value="{fmt(bytes)} bytes → {fmt(tokens)} tokens{ending}"
	>
		<Label
			anchor="start"
			x={LX}
			y={580}
			size={12}
			muted
			tabular
			text="Your text: {fmt(bytes)} bytes → {fmt(tokens)} tokens{ending}"
		/>
	</Readout>
</g>
