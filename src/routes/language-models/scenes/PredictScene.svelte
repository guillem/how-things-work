<script lang="ts">
	/**
	 * GPT-2's next-token distribution for a fixed prompt, as a bar chart: the ten most likely
	 * tokens and one bar for all the others. Phases: "next" (the probabilities), "scores" (the
	 * logits beside them), "temperature" (reshaped by T, with T = 1 as a ghost), "cutoffs"
	 * (top-k and top-p: kept tokens renormalised, cut ones greyed). All computed in `lm.ts` from
	 * the stored logits and normalisers.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { smoothstep } from '#lib/draw/index.ts';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { untrack } from 'svelte';
	import { percent } from '../lm';
	import { chipWidth, flow, label, lm, num, str } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'next'));
	const pid = $derived(str(params.pr, 'capital'));
	const prompt = $derived(lm.prompt(pid));
	const node = $derived(lm.node(prompt.node));
	const T = $derived(phase === 'temperature' || phase === 'cutoffs' ? num(params.temp, 1) : 1);
	const greedy = $derived(T < 0.05);
	const d = $derived(lm.dist(node, greedy ? 0 : T));
	const base = $derived(lm.dist(node, 1));
	const k = $derived(Math.round(num(params.topk, 3)));
	const P = $derived(num(params.topp, 0.9));
	const cutK = $derived(lm.topK(d, k));
	const cutP = $derived(lm.topP(node, greedy ? 0 : T, P));
	const showCut = $derived(phase === 'cutoffs');
	const kept = $derived(d.p.map((_, i) => cutK.kept[i] && cutP.kept[i]));
	const keptN = $derived(kept.filter(Boolean).length);
	const keptMass = $derived(d.p.reduce((a, x, i) => a + (kept[i] ? x : 0), 0));
	// both cuts keep at most the 10 tokens shown (top-k ≤ 10), so the renormalised values are exact
	const renorm = $derived(d.p.map((x, i) => (kept[i] ? x / keptMass : 0)));

	// ---- bars, tweened when the prompt or a control changes
	const target = $derived([...d.p, d.rest]);
	const bars = new Tween<number[]>(
		untrack(() => target),
		{ duration: 650, easing: cubicInOut }
	);
	$effect(() => {
		const v = target;
		const r = reduced;
		untrack(() => bars.set(v, { duration: r ? 0 : 650 }));
	});

	// ---- layout
	const ROW = { y: 132, h: 33 };
	const cy = (i: number) => ROW.y + i * ROW.h + ROW.h / 2;
	const scores = $derived(phase === 'scores');
	const BX = $derived(scores ? 330 : 236);
	/** Right edge of the token labels, and of the score column. */
	const LX = $derived(scores ? 216 : BX - 14);
	const SX = 296;
	const BW = $derived(scores ? 500 : 580);
	const grow = (i: number) =>
		reduced || phase !== 'next' ? 1 : smoothstep(0.15 + i * 0.07, 0.75 + i * 0.07, t);

	const promptChips = $derived(
		flow(
			[
				...prompt.ids.slice(1).map((id, i) => ({
					key: `p${i}`,
					text: label(lm.token(id)),
					w: chipWidth(label(lm.token(id)), 12, 18),
					q: false
				})),
				{ key: 'q', text: '?', w: 30, q: true }
			],
			40,
			880,
			4,
			30
		)
	);
	const pulse = $derived(reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 3));

	const vr = $derived((bars.current[10] ?? 0) * grow(10));
	const restLabel = $derived(`all other ${d.restCount.toLocaleString('en-US')}`);
	const fmtScore = (l: number) => (l === 0 ? '0' : l.toFixed(2).replace('-', '−'));
	const nucleus = $derived(cutP.size === null ? 'more than 10' : cutP.size.toLocaleString('en-US'));
	const summary = $derived.by(() => {
		if (phase === 'temperature')
			return greedy
				? 'T = 0: all the probability on the top token (greedy)'
				: `T = ${T.toFixed(1)}: the ten shown hold ${percent(1 - d.rest)}, all others ${percent(d.rest)}`;
		if (phase === 'cutoffs')
			return `${keptN} token${keptN === 1 ? '' : 's'} kept, holding ${percent(keptMass)} before rescaling`;
		if (phase === 'scores') return 'score − best score  →  e^(difference)  →  probability';
		return `the ten most likely hold ${percent(1 - d.rest)}`;
	});
</script>

<g>
	<!-- the prompt -->
	<Readout id="prompt-title">
		<Txt
			x={40}
			y={24}
			size={12}
			muted
			text="GPT-2 small reads (one chip per token) and predicts the next token:"
		/>
	</Readout>
	{#each promptChips as c (c.key)}
		<g opacity={c.q ? pulse : 1}>
			<rect
				x={c.x}
				y={36 + c.y}
				width={c.w}
				height="24"
				rx="5"
				fill={c.q ? 'none' : 'var(--surface)'}
				stroke={c.q ? 'var(--lm-bar)' : 'var(--border)'}
				stroke-width={c.q ? 2 : 1}
				stroke-dasharray={c.q ? '4 3' : undefined}
			/>
			<text
				x={c.x + c.w / 2}
				y={36 + c.y + 16.5}
				text-anchor="middle"
				style:font-size="12px"
				style:font-family="var(--font-mono)"
				style:fill={c.q ? 'var(--lm-bar)' : 'var(--stage-ink)'}
				style:font-weight={c.q ? 700 : 500}>{c.text}</text
			>
		</g>
	{/each}

	<Readout id="summary" order={1} label="Next token" value={summary}>
		<Txt x={40} y={112} size={14} weight={650} text={summary} />
	</Readout>

	<!-- column heads -->
	{#if scores}
		<Readout id="score-head">
			<Txt x={SX} y={ROW.y - 6} anchor="end" size={11} muted text="score" />
		</Readout>
	{/if}

	{#each d.ids as id, i (i)}
		{@const v = (bars.current[i] ?? 0) * grow(i)}
		{@const on = !showCut || kept[i]}
		<g opacity={on ? 1 : 0.55}>
			<Txt
				x={LX}
				y={cy(i) + 5}
				anchor="end"
				size={13}
				mono
				weight={i === 0 ? 650 : 500}
				text={label(lm.token(id))}
			/>
			{#if scores}
				<Txt x={SX} y={cy(i) + 5} anchor="end" size={12.5} muted text={fmtScore(node.l[i])} />
			{/if}
			{#if phase === 'temperature'}
				<rect
					x={BX}
					y={cy(i) - 10}
					width={Math.max(0.5, base.p[i] * BW)}
					height="20"
					rx="3"
					fill="none"
					stroke="var(--lm-ghost)"
					stroke-width="1.2"
					stroke-dasharray="3 2"
				/>
			{/if}
			<rect
				x={BX}
				y={cy(i) - 10}
				width={Math.max(0.5, v * BW)}
				height="20"
				rx="3"
				fill={on ? 'var(--lm-bar)' : 'var(--lm-cut)'}
				opacity={0.85}
			/>
			{#if showCut && kept[i]}
				<!-- the renormalised probability -->
				<line
					x1={BX + renorm[i] * BW}
					y1={cy(i) - 13}
					x2={BX + renorm[i] * BW}
					y2={cy(i) + 13}
					stroke="var(--lm-pick)"
					stroke-width="2.5"
				/>
				<Txt
					x={BX + Math.max(v, renorm[i]) * BW + 8}
					y={cy(i) + 5}
					size={12}
					color="var(--lm-pick)"
					weight={650}
					text="{percent(d.p[i])} → {percent(renorm[i])}"
				/>
			{:else}
				<Txt
					x={BX + v * BW + 8}
					y={cy(i) + 5}
					size={12}
					muted={showCut}
					text={showCut ? `${percent(d.p[i])}, cut` : percent(d.p[i])}
					opacity={grow(i)}
				/>
			{/if}
		</g>
	{/each}
	<!-- everything else -->
	<g opacity={showCut ? 0.55 : 1}>
		<Txt x={BX - 14} y={cy(10.4) + 5} anchor="end" size={12.5} text={restLabel} />
		<Txt x={BX - 14} y={cy(10.4) + 19} anchor="end" size={11} muted text="tokens together" />
		<rect
			x={BX}
			y={cy(10.4) - 10}
			width={Math.max(0.5, vr * BW)}
			height="20"
			rx="3"
			fill="var(--lm-rest)"
			opacity="0.6"
		/>
		<Txt
			x={BX + vr * BW + 8}
			y={cy(10.4) + 5}
			size={12}
			muted
			text={showCut ? `${percent(d.rest)}, cut` : percent(d.rest)}
		/>
	</g>

	<!-- axis -->
	{#each [0, 0.25, 0.5, 0.75, 1] as a (a)}
		<line
			x1={BX + a * BW}
			y1={ROW.y - 2}
			x2={BX + a * BW}
			y2={cy(10.4) + 14}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="ax-{a}">
			<Txt x={BX + a * BW} y={cy(10.4) + 34} anchor="middle" size={11} muted text="{a * 100}%" />
		</Readout>
	{/each}

	{#if showCut}
		<Readout id="cut-note" order={2} label="Top-p alone" value="{nucleus} tokens">
			<Txt
				x={920}
				y={586}
				anchor="end"
				size={11.5}
				muted
				text="top-k {k} keeps {k}; top-p {P.toFixed(
					2
				)} alone would keep {nucleus} · orange: after rescaling to 100%"
			/>
		</Readout>
	{:else if phase === 'temperature'}
		<Readout id="ghost-note">
			<Txt
				x={920}
				y={586}
				anchor="end"
				size={11.5}
				muted
				text="dashed outline: the probabilities at T = 1"
			/>
		</Readout>
	{/if}
</g>
