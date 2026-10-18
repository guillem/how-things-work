<script lang="ts">
	/**
	 * The token count, merge after merge, as a share of the bytes: of the text learned from and of
	 * a sentence it never saw (the next line of the speech), cut with the merges learned so far in
	 * rank order. The marker is at k merges (the slider, or played); below, that sentence's tokens.
	 */
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { trained } from '../bpe-train';
	import { corpusOf, SAMPLE } from '../steps';
	import { chipWidth, FILLS, flow, show } from './shared';

	let { t, params, setParam }: StageProps = $props();

	const tr = $derived(trained(corpusOf(params)));
	const N = $derived(tr.merges.length);

	const TICK = 0.8;
	const playing = $derived(params.play === true);
	const played = $derived.by(() => {
		if (!playing) return null;
		const period = (N + 4) * TICK;
		return Math.min(N, Math.floor((t % period) / TICK));
	});
	$effect(() => {
		const v = played;
		if (v !== null) untrack(() => setParam('k', v));
	});
	const k = $derived(played ?? Math.max(0, Math.min(N, Math.round(Number(params.k ?? 1)) || 0)));

	const sampleBytes = new TextEncoder().encode(SAMPLE).length;
	const sampleCounts = $derived(Array.from({ length: N + 1 }, (_, j) => tr.count(SAMPLE, j)));

	const X0 = 110;
	const X1 = 820;
	const sx = $derived(scale([0, Math.max(1, N)], [X0, X1]));
	const sy = scale([0, 100], [380, 70]);
	const xTicks = $derived.by(() => {
		const stepN = N <= 10 ? 1 : N <= 25 ? 5 : N <= 60 ? 10 : N <= 150 ? 25 : 50;
		const out: number[] = [];
		for (let v = 0; v <= N; v += stepN) out.push(v);
		return out;
	});
	const reveal = $derived(smoothstep(0, 1.6, t));
	const path = (vals: number[], base: number) => {
		const last = Math.max(1, Math.round(reveal * (vals.length - 1)));
		return vals
			.slice(0, last + 1)
			.map((v, j) => `${j ? 'L' : 'M'}${sx(j).toFixed(1)} ${sy((100 * v) / base).toFixed(1)}`)
			.join(' ');
	};
	const corpusPath = $derived(path(tr.total, tr.total[0]));
	const samplePath = $derived(path(sampleCounts, sampleBytes));
	const pc = (v: number, base: number) => Math.round((100 * v) / base);
	const cNow = $derived(tr.total[k]);
	const sNow = $derived(sampleCounts[k]);

	// the sentence's tokens with k merges
	const chips = $derived(
		flow(
			tr
				.encode(SAMPLE, k)
				.flatMap((p) => p.tokens)
				.map((id, i) => {
					const text = show(tr.text(id));
					return { i, text, id, w: chipWidth(text, 15, 18) };
				}),
			40,
			880,
			3,
			34
		)
	);
	const latest = $derived(k > 0 ? 255 + k : -1);
</script>

<g>
	<Readout id="title">
		<Label
			anchor="start"
			x={24}
			y={32}
			size={15}
			weight={650}
			text="Tokens left, as a share of the bytes"
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		{xTicks}
		yTicks={[0, 25, 50, 75, 100]}
		yFormat={(v: number) => `${v}%`}
		xLabel="merges"
	/>
	<path
		d={corpusPath}
		fill="none"
		stroke="var(--tk-corpus)"
		stroke-width="2.5"
		stroke-linejoin="round"
	/>
	<path
		d={samplePath}
		fill="none"
		stroke="var(--tk-sample)"
		stroke-width="2.5"
		stroke-linejoin="round"
		stroke-dasharray="7 4"
	/>
	{#if reveal > 0.98}
		<Readout id="end-corpus">
			<Label
				anchor="start"
				x={X1 + 10}
				y={sy(pc(tr.total[N], tr.total[0])) + 4}
				size={12}
				weight={650}
				color="var(--tk-corpus)"
				text="your text"
			/>
		</Readout>
		<Readout id="end-sample">
			<Label
				anchor="start"
				x={X1 + 10}
				y={sy(pc(sampleCounts[N], sampleBytes)) + 4}
				size={12}
				weight={650}
				color="var(--tk-sample)"
				text="new sentence"
			/>
		</Readout>
	{/if}

	<!-- the marker at k merges -->
	<line
		x1={sx(k)}
		x2={sx(k)}
		y1={sy(100) - 6}
		y2={sy(0)}
		stroke="var(--tk-hot)"
		stroke-width="1.5"
		stroke-dasharray="3 3"
	/>
	<circle cx={sx(k)} cy={sy(pc(cNow, tr.total[0]))} r="5" fill="var(--tk-corpus)" />
	<circle cx={sx(k)} cy={sy(pc(sNow, sampleBytes))} r="5" fill="var(--tk-sample)" />

	<Readout
		id="k"
		order={1}
		label="After {k} merge{k === 1 ? '' : 's'}"
		value="vocabulary {256 + k}"
	>
		<Label
			x={936}
			y={32}
			anchor="end"
			size={13}
			weight={650}
			tabular
			text="{k} merge{k === 1 ? '' : 's'} · vocabulary {256 + k}"
		/>
	</Readout>
	<Readout
		id="corpus-count"
		order={2}
		label="Your text"
		value="{tr.total[0]} bytes → {cNow} tokens ({pc(cNow, tr.total[0])}%)"
		color="var(--tk-corpus)"
	>
		<Label
			x={936}
			y={54}
			anchor="end"
			size={12}
			tabular
			color="var(--tk-corpus)"
			text="your text: {tr.total[0]} bytes → {cNow} tokens ({pc(cNow, tr.total[0])}%)"
		/>
	</Readout>

	<!-- the new sentence -->
	<Readout
		id="sample-count"
		order={3}
		label="New sentence"
		value="{sampleBytes} bytes → {sNow} tokens ({pc(sNow, sampleBytes)}%)"
		color="var(--tk-sample)"
	>
		<Label
			anchor="start"
			x={40}
			y={452}
			size={13}
			weight={650}
			tabular
			color="var(--tk-sample)"
			text="New sentence, never seen in training: {sampleBytes} bytes → {sNow} tokens"
		/>
	</Readout>
	{#each chips as c (c.i)}
		{@const hot = c.id === latest}
		<rect
			x={c.x}
			y={468 + c.y}
			width={c.w}
			height="26"
			rx="5"
			fill={hot ? 'color-mix(in oklab, var(--tk-hot) 30%, var(--surface))' : FILLS[c.i % 5]}
			stroke={hot ? 'var(--tk-hot)' : 'var(--border)'}
			stroke-width={hot ? 2 : 1}
		/>
		<text
			x={c.x + c.w / 2}
			y={468 + c.y + 18}
			text-anchor="middle"
			font-size="15"
			style:font-family="var(--font-mono)"
			style:fill="var(--stage-ink)">{c.text}</text
		>
	{/each}
</g>
