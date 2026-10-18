<script lang="ts">
	/**
	 * Held-out text the machine never counted (the last tenth of Tiny Shakespeare). A window of
	 * `n` sweeps over a passage and marks every letter whose window never occurs in the training
	 * text. Below, the share of such windows over the whole held-out text, for n = 1 … 10.
	 * Phase "heldout": one curve (all the training text). Phase "sizes": the curves for 10,000,
	 * 100,000 and 1,003,854 letters of training text, the selected one in front.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { chars, unseenMarks } from '../ngram';
	import { SIZE_OPTIONS, type SizeId } from '../steps';
	import TextBlock from './TextBlock.svelte';
	import {
		fmt,
		modelFor,
		pct,
		shakespeare,
		sizeOf,
		unseenFor,
		visible,
		windowOf,
		type Kind,
		type Shakespeare
	} from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const sizes = $derived(step.hints?.phase === 'sizes');

	let data = $state<Shakespeare | null>(null);
	let failed = $state(false);
	$effect(() => {
		shakespeare().then(
			(d) => (data = d),
			() => (failed = true)
		);
	});

	const n = $derived(windowOf(params));
	const size = $derived<SizeId>(sizes ? sizeOf(params) : '1m');

	/** A passage of the held-out text: Petruchio introduces himself to Baptista. */
	const PASSAGE_START = 'PETRUCHIO:\nYou wrong me';
	const PASSAGE_LENGTH = 330;
	const passage = $derived.by(() => {
		if (!data) return '';
		const i = Math.max(0, data.heldOut.indexOf(PASSAGE_START));
		return chars(data.heldOut.slice(i, i + PASSAGE_LENGTH * 2))
			.slice(0, PASSAGE_LENGTH)
			.join('');
	});
	const cs = $derived(chars(passage));
	const marks = $derived(data ? unseenMarks(modelFor(data, size), passage, n) : []);
	const marked = $derived(marks.filter(Boolean).length);

	// ---- the sweep: 30 letters a second, then hold
	const RATE = 30;
	const period = $derived(cs.length / RATE + 4);
	const tt = $derived(reduced ? period : t % period);
	const pos = $derived(Math.min(cs.length, Math.floor(tt * RATE)));
	const sweeping = $derived(pos < cs.length);
	const kind = (j: number): Kind => {
		if (sweeping && j === pos) return 'next';
		if (sweeping && j >= pos - n && j < pos) return 'window';
		if (j < pos && marks[j]) return 'unseen';
		return j < pos ? 'plain' : 'muted';
	};

	// ---- the chart
	const sx = scale([1, 10], [110, 880]);
	const sy = scale([0, 1], [552, 352]);
	const SERIES = $derived(
		(sizes ? (['10k', '100k', '1m'] as SizeId[]) : (['1m'] as SizeId[])).map((id) => ({
			id,
			values: data ? unseenFor(data, id) : [],
			label: SIZE_OPTIONS.find((o) => o.value === id)?.label ?? id
		}))
	);
	const cur = $derived(data ? unseenFor(data, size)[n] : 0);
	const total = $derived(data ? data.heldOut.length - n : 0);
	const readout = $derived(
		`window of ${n}: ${pct(cur)} of the ${fmt(total)} held-out windows were never seen`
	);
	const pts = (vs: number[]) => vs.slice(1).map((v, i) => ({ n: i + 1, v }));
</script>

<g>
	<rect
		x="24"
		y="16"
		width="912"
		height="290"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if !data}
		<Label
			x={480}
			y={160}
			size={14}
			muted
			text={failed ? 'Tiny Shakespeare could not be loaded.' : 'Loading Tiny Shakespeare (1.1 MB)…'}
		/>
	{:else}
		<Readout
			id="head"
			order={1}
			label="Held-out text"
			value="The Taming of the Shrew, never counted"
		>
			<Label
				anchor="start"
				x={44}
				y={42}
				size={11.5}
				muted
				halo={false}
				text="held-out text (The Taming of the Shrew), never counted · marked: the {n} letter{n ===
				1
					? ''
					: 's'} before it never appear in the training text"
			/>
		</Readout>
		<TextBlock x={44} y={72} w={872} chars={cs} {kind} size={15} lineH={24} maxLines={10} />
		<Readout
			id="passage"
			order={2}
			label="In this passage"
			value="{marked} of {cs.length - n} letters come after an unseen window"
		>
			<Label
				anchor="end"
				tabular
				x={916}
				y={292}
				size={12}
				weight={600}
				color="var(--ng-unseen)"
				halo={false}
				opacity={sweeping ? 0 : 1}
				text="{marked} of {cs.length - n} letters here come after a window never seen"
			/>
		</Readout>

		<Axes
			{sx}
			{sy}
			xTicks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
			yTicks={[0, 0.25, 0.5, 0.75, 1]}
			yFormat={(v) => `${Math.round(v * 100)}%`}
			xLabel="window (letters)"
		/>
		<line
			x1={sx(n)}
			x2={sx(n)}
			y1={sy(1)}
			y2={sy(0)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
		/>
		{#each SERIES as s (s.id)}
			{@const front = s.id === size}
			<path
				d={linePath(
					pts(s.values),
					(d) => d.n,
					(d) => d.v,
					sx,
					sy
				)}
				fill="none"
				stroke="var(--ng-unseen)"
				stroke-width={front ? 3 : 1.5}
				opacity={front ? 1 : 0.45}
				stroke-linejoin="round"
			/>
			{#if sizes}
				<Readout id="label-{s.id}">
					<Label
						anchor="end"
						x={sx(5) - 8}
						y={sy(s.values[5]) - 10}
						size={11.5}
						weight={front ? 650 : 500}
						muted={!front}
						text="{s.label}{s.id === '100k' ? ' letters' : ''}"
					/>
				</Readout>
			{/if}
			<circle
				cx={sx(n)}
				cy={sy(s.values[n])}
				r={front ? 5.5 : 3.5}
				fill="var(--ng-unseen)"
				opacity={front ? 1 : 0.45}
			/>
		{/each}
		<Readout id="readout" order={3} label="Held-out windows never seen" value={readout}>
			<Label
				anchor="start"
				tabular
				x={sx(1) + 4}
				y={sy(1) - 14}
				size={13.5}
				weight={650}
				text={readout}
			/>
		</Readout>
		<Readout id="ylabel">
			<Label x={44} y={sy(0.5)} size={11} muted rotate={-90} text="never seen" />
		</Readout>
		{#if sweeping && pos >= n}
			<Readout id="now">
				<Label
					anchor="end"
					x={916}
					y={292}
					size={12}
					muted
					halo={false}
					text="window “{visible(cs.slice(pos - n, pos).join(''))}” → {marks[pos]
						? 'never seen'
						: 'seen'}"
				/>
			</Readout>
		{/if}
	{/if}
</g>
