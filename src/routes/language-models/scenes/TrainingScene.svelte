<script lang="ts">
	/**
	 * Teacher forcing on one real sentence: under each token, the probability GPT-2 gave it
	 * before seeing it (from the tokens before it). The chosen position shows the model's own
	 * top three guesses there and the loss −ln p. Click a token or use the slider.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { smoothstep } from '#lib/draw/index.ts';
	import { crossEntropy, percent } from '../lm';
	import { chipWidth, flow, label, lm, num, onkey } from './shared';
	import TextCard from './TextCard.svelte';
	import Txt from './Txt.svelte';

	let { t, params, reduced, setParam }: StageProps = $props();

	const tr = lm.data.training;
	const n = tr.steps.length;
	const pos = $derived(Math.min(n, Math.max(1, Math.round(num(params.pos, 9)))));
	const s = $derived(tr.steps[pos - 1]);
	const actual = $derived(tr.ids[pos]);
	const loss = crossEntropy(tr.steps.map((x) => x.p));

	const BAR = 54;
	const chips = flow(
		tr.ids.slice(1).map((id, i) => ({
			i: i + 1,
			id,
			text: label(lm.token(id)),
			w: Math.max(40, chipWidth(label(lm.token(id)), 13))
		})),
		40,
		880,
		6,
		118
	);
	const Y0 = 64;
	const grow = (i: number) => (reduced ? 1 : smoothstep(0.1 + i * 0.06, 0.6 + i * 0.06, t));
	const pick = (i: number) => setParam('pos', i);

	const CY = 330;
	const context = $derived(tr.ids.slice(1, pos));
</script>

<g>
	<Readout id="title">
		<Txt
			x={40}
			y={30}
			size={13}
			muted
			text="Under each token: the probability GPT-2 small gave it, from the tokens before it alone"
		/>
	</Readout>
	{#each chips as c (c.i)}
		{@const y = Y0 + c.y}
		{@const p = tr.steps[c.i - 1].p}
		{@const sel = c.i === pos}
		<g
			class="lm-btn"
			role="button"
			tabindex="0"
			aria-label="Position {c.i}: {c.text}"
			aria-pressed={sel}
			onclick={() => pick(c.i)}
			onkeydown={(e) => onkey(e, () => pick(c.i))}
		>
			<rect
				x={c.x}
				{y}
				width={c.w}
				height="26"
				rx="6"
				fill={sel ? 'color-mix(in oklab, var(--lm-pick) 25%, var(--surface))' : 'var(--surface)'}
				stroke={sel ? 'var(--lm-pick)' : 'var(--border)'}
				stroke-width={sel ? 2 : 1}
			/>
			<text
				x={c.x + c.w / 2}
				y={y + 17.5}
				text-anchor="middle"
				style:font-size="13px"
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
			<rect
				x={c.x + c.w / 2 - 9}
				y={y + 32}
				width="18"
				height={BAR}
				fill="var(--stage-grid)"
				rx="2"
			/>
			<rect
				x={c.x + c.w / 2 - 9}
				y={y + 32 + BAR * (1 - p * grow(c.i))}
				width="18"
				height={BAR * p * grow(c.i)}
				fill={sel ? 'var(--lm-pick)' : 'var(--lm-bar)'}
				rx="2"
			/>
			<text
				x={c.x + c.w / 2}
				y={y + 32 + BAR + 14}
				text-anchor="middle"
				style:font-size="11px"
				style:fill="var(--stage-ink-muted)"
				style:font-variant-numeric="tabular-nums">{percent(p)}</text
			>
		</g>
	{/each}

	<!-- the chosen position -->
	<rect
		x="24"
		y={CY - 30}
		width="912"
		height={600 - CY + 14}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="ctx" order={1} label="GPT-2 has read" value={lm.text(context)}>
		<Txt x={44} y={CY - 6} size={12} muted text="GPT-2 has read:" />
		<TextCard
			x={150}
			y={CY - 6}
			w={770}
			prompt={context}
			gen={[]}
			maxLines={2}
			size={13}
			lineH={19}
		/>
	</Readout>
	<Readout id="guesses-title">
		<Txt x={44} y={CY + 50} size={12} muted text="its three best guesses for the next token" />
	</Readout>
	{#each s.top as [id, p], i (i)}
		{@const y = CY + 62 + i * 28}
		{@const right = id === actual}
		<Txt
			x={210}
			y={y + 15}
			anchor="end"
			size={13}
			weight={right ? 700 : 500}
			color={right ? 'var(--lm-pick)' : undefined}
			text={label(lm.token(id))}
		/>
		<rect
			x={222}
			y={y + 2}
			width={Math.max(0.5, p * 300)}
			height="18"
			rx="3"
			fill={right ? 'var(--lm-pick)' : 'var(--lm-bar)'}
			opacity="0.85"
		/>
		<Txt x={222 + p * 300 + 8} y={y + 15} size={12} muted text={percent(p)} />
	{/each}
	<Readout
		id="actual"
		order={2}
		label="Real next token"
		value="{label(lm.token(actual))}: p = {percent(s.p)}, loss −ln p = {(-Math.log(s.p)).toFixed(
			2
		)}"
	>
		<Txt x={620} y={CY + 78} size={12} muted text="the real next token" />
		<Txt
			x={620}
			y={CY + 104}
			size={18}
			weight={700}
			color="var(--lm-pick)"
			text={label(lm.token(actual))}
		/>
		<Txt x={620} y={CY + 130} size={13} text="GPT-2 gave it {percent(s.p)}" />
		<Txt
			x={620}
			y={CY + 152}
			size={13}
			text="loss here: −ln {s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)} = {(-Math.log(
				s.p
			)).toFixed(2)}"
		/>
	</Readout>
	<Readout
		id="mean"
		order={3}
		label="Average loss"
		value="{loss.toFixed(2)} (cross-entropy, in nats)"
	>
		<Txt
			x={44}
			y={584}
			size={12}
			muted
			text="average loss over the sentence (cross-entropy): {loss.toFixed(
				2
			)} · training makes this smaller, over billions of tokens"
		/>
	</Readout>
</g>

<style>
	.lm-btn {
		cursor: pointer;
		outline: none;
	}
	.lm-btn:focus-visible rect:first-child {
		stroke: var(--focus);
		stroke-width: 2.5;
	}
</style>
