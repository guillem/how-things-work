<script lang="ts">
	/**
	 * The machine trained on Tiny Shakespeare writes 600 characters with a window of `n`
	 * (typed out at a steady pace), next to three meters measured live: real words in the
	 * sample, held-out windows never seen, and the longest stretch copied word for word.
	 * Phase "copy": the copied stretch is marked in the sample and shown in its place in the
	 * plays, with the share of letters for which the machine had no choice.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';
	import { chars } from '../ngram';
	import { SIZE_OPTIONS } from '../steps';
	import Meter from './Meter.svelte';
	import TextBlock from './TextBlock.svelte';
	import {
		fmt,
		measuresFor,
		modelFor,
		pct,
		seedOf,
		shakespeare,
		sizeOf,
		unseenFor,
		windowOf,
		type Kind,
		type Shakespeare
	} from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'write'));
	const copyPhase = $derived(phase === 'copy');

	let data = $state<Shakespeare | null>(null);
	let failed = $state(false);
	$effect(() => {
		shakespeare().then(
			(d) => (data = d),
			() => (failed = true)
		);
	});

	const n = $derived(windowOf(params));
	const size = $derived(copyPhase ? sizeOf(params) : '1m');
	const seed = $derived(seedOf(params));
	const ms = $derived(data ? measuresFor(data, size, seed) : null);
	const m = $derived(ms ? ms[n - 1] : null);
	const unseen = $derived(data ? unseenFor(data, size) : null);
	const model = $derived(data ? modelFor(data, size) : null);
	const cs = $derived(m ? chars(m.sample.text) : []);

	// ---- typing out the sample: 60 characters a second, then hold
	const RATE = 60;
	const shown = $derived(reduced ? cs.length : Math.min(cs.length, Math.floor(t * RATE)));

	const copy = $derived(m?.copy ?? null);
	const kind = (i: number): Kind =>
		copyPhase && copy && i >= copy.start && i < copy.start + copy.length ? 'copy' : 'plain';

	const sizeLabel = $derived(
		size === '1m' ? '1,003,854' : SIZE_OPTIONS.find((o) => o.value === size)?.label.split(' ')[0]
	);
	const header = $derived(
		`window of ${n} letter${n === 1 ? '' : 's'} · learned from ${sizeLabel} letters of the plays · sample no. ${seed}`
	);

	// ---- the source of the longest copy, with some text around it
	const source = $derived.by(() => {
		if (!copy || !model || copy.source < 0) return null;
		const text = model.text;
		const a = Math.max(0, copy.source - 30);
		const b = Math.min(text.length, copy.source + copy.length + 60);
		const around = chars(text.slice(a, b));
		const s0 = copy.source - a;
		return { chars: around, s0, s1: s0 + copy.length, at: copy.source };
	});
	const sourceKind = (i: number): Kind =>
		source && i >= source.s0 && i < source.s1 ? 'copy' : 'muted';

	const copyMax = $derived(ms ? Math.max(100, ...ms.map((x) => x.copy.length)) : 100);
	const CARD = $derived(copyPhase ? { y: 16, h: 380 } : { y: 16, h: 568 });
</script>

<g>
	{#if !data}
		<Label
			x={332}
			y={300}
			size={14}
			muted
			text={failed ? 'Tiny Shakespeare could not be loaded.' : 'Loading Tiny Shakespeare (1.1 MB)…'}
		/>
	{:else if m && unseen}
		<Readout
			id="sample"
			order={2}
			label="The machine writes"
			value={m.sample.text.slice(0, 300) + '…'}
		>
			<rect
				x="24"
				y={CARD.y}
				width="616"
				height={CARD.h}
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<TextBlock
				x={44}
				y={CARD.y + 50}
				w={580}
				chars={cs.slice(0, shown)}
				{kind}
				size={13}
				lineH={19}
				maxLines={copyPhase ? 18 : 28}
				focus={copyPhase && copy ? copy.start : -1}
			/>
		</Readout>

		<Readout id="setting" order={1} label="Setting" value={header}>
			<Label
				anchor="start"
				tabular
				x={44}
				y={CARD.y + 26}
				size={11.5}
				muted
				text={header}
				halo={false}
			/>
		</Readout>

		{#if copyPhase && source && copy && shown >= copy.start + copy.length}
			<rect
				x="24"
				y="408"
				width="616"
				height="176"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout
				id="source"
				order={6}
				label="Copied from the plays"
				value="{copy?.length} letters, from letter {fmt(source.at)}"
			>
				<Label
					anchor="start"
					tabular
					x={44}
					y={432}
					size={11.5}
					muted
					halo={false}
					text="the marked {copy?.length} letters, word for word in the plays (letter {fmt(
						source.at
					)} of the training text):"
				/>
				<TextBlock
					x={44}
					y={458}
					w={580}
					chars={source.chars}
					kind={sourceKind}
					focus={source.s0}
					size={13}
					lineH={19}
					maxLines={6}
				/>
			</Readout>
		{/if}

		<Readout id="real" order={3} label="Real words" value={pct(m.realWords)} />
		<Meter
			id="m-real"
			x={660}
			y={16}
			w={276}
			title="Real words"
			note="share of the sample’s words found in the plays"
			value={pct(m.realWords)}
			fill={m.realWords}
			series={ms?.map((x) => x.realWords) ?? []}
			{n}
			color="var(--ng-real)"
		/>
		<Readout id="unseen" order={4} label="Held-out windows never seen" value={pct(unseen[n])} />
		<Meter
			id="m-unseen"
			x={660}
			y={204}
			w={276}
			title="Never seen"
			note="held-out windows not in the training text"
			value={pct(unseen[n])}
			fill={unseen[n]}
			series={unseen.slice(1)}
			{n}
			color="var(--ng-unseen)"
		/>
		<Readout
			id="copy"
			order={5}
			label="Longest copy"
			value="{m.copy.length} letters{copyPhase
				? ` · no choice on ${pct(m.forced)} of letters`
				: ''}"
		/>
		<Meter
			id="m-copy"
			x={660}
			y={392}
			w={276}
			title="Longest copy"
			note={copyPhase
				? `no choice on ${pct(m.forced)} of its letters`
				: 'longest stretch copied word for word'}
			value="{m.copy.length} letters"
			fill={m.copy.length / copyMax}
			series={ms?.map((x) => x.copy.length / copyMax) ?? []}
			{n}
			color="var(--ng-copy)"
		/>
	{/if}
</g>
