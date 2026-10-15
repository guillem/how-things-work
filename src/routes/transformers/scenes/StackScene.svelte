<script lang="ts">
	/**
	 * The whole of GPT-2 small. Left: one vertical line per token (its vector, the "residual
	 * stream") rising through 12 blocks; in each block an arc shows which earlier token the last
	 * token listens to most, averaged over that layer's 12 heads (⟨start⟩ left out), from the real
	 * weights. A light climbs the stack. Right: what one block does, with its parameter counts, and
	 * GPT-2's real top five next tokens for the sentence.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Label } from '#lib/draw/index.ts';
	import { parameterCount } from '../attention';
	import { gpt2 } from '../gpt2';
	import { fix, label, sentenceOf } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const s = $derived(sentenceOf({ s: params.stackS }, 'capital'));
	const names = $derived(s.tokens.map((tk) => label(tk)));
	const pc = parameterCount(gpt2.config);
	const fmt = (v: number) => v.toLocaleString('en-US');

	// ---- the tower
	const T = { x: 40, w: 440, top: 96, bottom: 480, block: 32 };
	const sx = (i: number) => T.x + 12 + (i / Math.max(1, s.n - 1)) * (T.w - 24);
	const by = (l: number) => T.bottom - (l + 1) * T.block;
	const last = $derived(s.n - 1);
	const arcs = $derived(
		Array.from({ length: 12 }, (_, l) => {
			const mean = new Array<number>(s.n).fill(0);
			for (let h = 0; h < 12; h++) s.row(l, h, last).forEach((w, j) => (mean[j] += w / 12));
			let j = 1;
			for (let k = 1; k < s.n - 1; k++) if (mean[k] > mean[j]) j = k;
			const y = by(l) + T.block / 2 + 4;
			const x0 = sx(last);
			const x1 = sx(j);
			const lift = 6 + Math.min(12, Math.abs(x0 - x1) / 18);
			return {
				l,
				j,
				w: mean[j],
				d: j === last ? '' : `M${x0} ${y} C${x0} ${y - lift} ${x1} ${y - lift} ${x1} ${y}`
			};
		})
	);
	// A light climbs from the embeddings to the output and starts again (all lit when reduced).
	const lit = $derived(reduced ? -2 : Math.floor(cycle(t, 7) * 15) - 1);
	const on = (l: number) => (lit === -2 || lit === l ? 1 : 0.55);

	// ---- the next token
	const next = $derived(s.next);
	const NX = { x: 640, y: 380, w: 230, h: 30 };
	const tail = $derived(names.slice(Math.max(1, s.n - 4)).join(' '));
</script>

<g>
	<!-- residual streams -->
	<Label
		anchor="start"
		x={T.x}
		y={30}
		size={15}
		weight={650}
		text="GPT-2 small: 12 blocks, one on top of the other"
	/>
	{#each names as nm, i (i)}
		<line
			x1={sx(i)}
			y1={T.bottom + 22}
			x2={sx(i)}
			y2={T.top - 26}
			stroke={i === last ? 'var(--tf-sel)' : 'var(--stage-line)'}
			stroke-width={i === last ? 2 : 1}
		/>
		<Readout id="tk-{i}">
			<text
				x={sx(i)}
				y={T.bottom + 34}
				transform="rotate(-50 {sx(i)} {T.bottom + 34})"
				text-anchor="end"
				style:font-size="11px"
				style:fill={i === last ? 'var(--stage-ink)' : 'var(--stage-ink-muted)'}
				style:font-weight={i === last ? 650 : 500}>{nm}</text
			>
		</Readout>
	{/each}
	<rect
		x={T.x}
		y={T.bottom + 4}
		width={T.w}
		height="14"
		rx="4"
		fill="var(--tf-q)"
		opacity={lit === -1 || lit === -2 ? 0.5 : 0.25}
	/>
	<Readout id="embl">
		<Label
			anchor="start"
			x={T.x + T.w + 8}
			y={T.bottom + 15}
			size={11}
			muted
			text="token + position"
		/>
	</Readout>

	{#each arcs as a (a.l)}
		<rect
			x={T.x}
			y={by(a.l) + 2}
			width={T.w}
			height={T.block - 4}
			rx="6"
			fill="var(--tf-att)"
			opacity={0.1 + 0.18 * on(a.l)}
			stroke="var(--tf-att)"
			stroke-opacity={0.3 * on(a.l)}
		/>
		{#if a.d}
			<path
				d={a.d}
				fill="none"
				stroke="var(--tf-att)"
				stroke-width={1 + 6 * a.w}
				stroke-linecap="round"
				opacity={0.4 + 0.6 * on(a.l)}
			/>
		{/if}
		<Readout id="bl-{a.l}">
			<Label
				anchor="start"
				tabular
				x={T.x + T.w + 8}
				y={by(a.l) + T.block / 2 + 4}
				size={11}
				muted={on(a.l) < 1}
				text={String(a.l + 1)}
			/>
		</Readout>
	{/each}
	<rect
		x={T.x}
		y={T.top - 40}
		width={T.w}
		height="14"
		rx="4"
		fill="var(--tf-v)"
		opacity={lit === 12 || lit === -2 ? 0.55 : 0.25}
	/>
	<Readout id="outl">
		<Label anchor="start" x={T.x + T.w + 8} y={T.top - 29} size={11} muted text="next token" />
	</Readout>
	<Readout id="arcnote">
		<Label
			anchor="start"
			tabular
			x={T.x}
			y={588}
			size={11}
			muted
			text="arc in each block: the earlier token “{names[
				last
			]}” listens to most (12-head average, itself and ⟨start⟩ left out)"
		/>
	</Readout>

	<!-- one block -->
	<Label anchor="start" x={560} y={30} size={14} weight={650} text="Inside each block" />
	{#each [{ y: 52, text: 'LayerNorm, then 12 attention heads', sub: 'tokens exchange information', c: 'var(--tf-att)' }, { y: 112, text: 'join the 12 × 64 numbers, × W_O, add', sub: `attention: ${fmt(pc.attention)} numbers`, c: 'var(--tf-att)' }, { y: 172, text: 'LayerNorm, then an MLP 768 → 3,072 → 768', sub: 'each token on its own', c: 'var(--tf-v)' }, { y: 232, text: 'add the result to the token’s vector', sub: `MLP: ${fmt(pc.mlp)} numbers`, c: 'var(--tf-v)' }] as b (b.y)}
		<rect
			x={560}
			y={b.y}
			width={384}
			height={46}
			rx="8"
			fill="var(--surface)"
			stroke={b.c}
			stroke-width="1.4"
		/>
		<Readout id="blk-{b.y}">
			<Label anchor="start" tabular x={574} y={b.y + 20} size={12} weight={600} text={b.text} />
			<Label anchor="start" tabular x={574} y={b.y + 37} size={11} muted text={b.sub} />
		</Readout>
	{/each}
	<Readout
		id="params"
		order={2}
		label="Parameters"
		value="{fmt(gpt2.config.params)} in all; {fmt(pc.perBlock)} per block"
	>
		<Label
			anchor="start"
			tabular
			x={560}
			y={306}
			size={12}
			text="× 12 blocks · {fmt(gpt2.config.params)} learned numbers in all"
		/>
	</Readout>

	<!-- the prediction -->
	<Label
		anchor="start"
		tabular
		x={560}
		y={NX.y - 26}
		size={14}
		weight={650}
		text="GPT-2’s next token after “… {tail}”"
	/>
	{#each next as nx, k (k)}
		{@const y = NX.y + k * NX.h}
		<Label
			tabular
			x={NX.x - 10}
			y={y + 15}
			anchor="end"
			size={13}
			weight={k === 0 ? 650 : 500}
			text={label(nx.token)}
		/>
		<rect
			x={NX.x}
			y={y + 2}
			width={Math.max(1, nx.p * NX.w)}
			height={NX.h - 10}
			rx="3"
			fill="var(--tf-v)"
			opacity={k === 0 ? 1 : 0.6}
		/>
		<Label
			anchor="start"
			tabular
			x={NX.x + nx.p * NX.w + 8}
			y={y + 15}
			size={12}
			text="{fix(nx.p * 100, 1)}%"
		/>
	{/each}
	{#if next.some((x) => x.token === '\n')}
		<Readout id="nl">
			<Label
				anchor="start"
				x={560}
				y={NX.y + 5 * NX.h + 16}
				size={12}
				muted
				text="↵ = a new line: the sentence ended with a full stop"
			/>
		</Readout>
	{/if}
	<Readout
		id="block"
		order={4}
		label="Each block"
		value="12 attention heads, then an MLP (768 → 3,072 → 768); each adds its result to the token’s vector"
		><g></g></Readout
	>
	<Readout
		id="next"
		order={1}
		label="Next token"
		value={next
			.slice(0, 3)
			.map((x) => `${label(x.token)} ${fix(x.p * 100, 0)}%`)
			.join(' · ')}
		color="var(--tf-v)"><g></g></Readout
	>
</g>
