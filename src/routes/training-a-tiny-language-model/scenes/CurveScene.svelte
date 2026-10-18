<script lang="ts">
	/**
	 * The loss curve: cross-entropy on the training text's and the held-out text's measurement
	 * windows against the training step, with the smoothed bigram and trigram models' held-out
	 * scores as horizontal lines, and the sample the model wrote last beside it.
	 *
	 * Phases: `curve` and `samples` show the stored default run up to a cursor (the `at` slider,
	 * or played as a function of t while `play` is on); `live` trains the default run in a Web
	 * Worker (live.svelte.ts) and draws it over the stored one; `compare` shows the stored run of
	 * the chosen width, context and data size over the default one; `overfit` the default model
	 * on the chosen (small) data size. In `compare` and `overfit` the sample's longest stretch
	 * copied word for word from its training text is marked (found with the n-gram page's index).
	 */
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { modelFor, shakespeare } from '../../ngram-text-models/scenes/shared';
	import type { SizeId } from '../../ngram-text-models/steps';
	import { live, startLive, stopLive } from '../live.svelte';
	import {
		baselines,
		finalOf,
		minVal,
		perplexity,
		pointAt,
		runOf,
		sampleAt,
		type StoredRun
	} from '../runs';
	import { DEFAULT, SAMPLE_STEPS, STEPS, type Point } from '../train';
	import { countWeights } from '../tiny-gpt';
	import SampleCard from './SampleCard.svelte';
	import { atOf, contextOf, dataLabel, dataOf, int, nats, widthOf } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'curve'));
	const stored = $derived(phase === 'curve' || phase === 'samples' || phase === 'live');
	const width = $derived(phase === 'compare' ? widthOf(params) : DEFAULT.width);
	const context = $derived(phase === 'compare' ? contextOf(params) : DEFAULT.context);
	const size = $derived(
		phase === 'compare'
			? dataOf(params)
			: phase === 'overfit'
				? dataOf(params, 'odata', '10k')
				: DEFAULT.data
	);
	const run = $derived(runOf(width, context, size));
	const base = runOf(DEFAULT.width, DEFAULT.context, DEFAULT.data);
	const isDefault = $derived(
		width === DEFAULT.width && context === DEFAULT.context && size === DEFAULT.data
	);
	const lines = $derived(baselines(size));

	// ---- the cursor: played, scrubbed, or the live run's step
	const playing = $derived(stored && phase !== 'live' && params.play === true && !reduced);
	/** One pass of the stored run takes 25 s, then the end holds for 5 s. */
	const played = $derived(
		playing ? Math.round((Math.min(1, (t % 30) / 25) * STEPS) / 10) * 10 : null
	);
	$effect(() => {
		const v = played;
		if (v !== null) untrack(() => setParam('at', v));
	});
	$effect(() => {
		const p = playing;
		untrack(() => setParam('playing', p));
	});
	const at = $derived(
		phase === 'live'
			? live.step
			: phase === 'curve' || phase === 'samples'
				? (played ?? atOf(params))
				: STEPS
	);

	// ---- the live run's buttons
	const trainPresses = $derived(Number(params.train ?? 0));
	const stopPresses = $derived(Number(params.stop ?? 0));
	// a press is a change of the count since the scene was mounted (a count already there when
	// the reader comes back to the step is not a new press)
	let seenTrain = untrack(() => trainPresses);
	let seenStop = untrack(() => stopPresses);
	$effect(() => {
		const n = trainPresses;
		if (n === seenTrain) return;
		seenTrain = n;
		untrack(() => startLive());
	});
	$effect(() => {
		const n = stopPresses;
		if (n === seenStop) return;
		seenStop = n;
		untrack(() => stopLive());
	});
	const running = $derived(live.status === 'running' || live.status === 'loading');
	$effect(() => {
		const r = running;
		untrack(() => setParam('liveRunning', r));
	});

	// ---- what is drawn
	const shown = $derived.by((): Point[] => {
		if (phase === 'live') return live.points;
		const pts = run.points.filter((p) => p.step <= at);
		if (pts[pts.length - 1].step < at) pts.push(pointAt(run.points, at));
		return pts;
	});
	const now = $derived(shown.length ? shown[shown.length - 1] : null);
	const ghost = $derived<StoredRun | null>(
		phase === 'live' || ((phase === 'compare' || phase === 'overfit') && !isDefault) ? base : null
	);
	const sample = $derived.by(() => {
		if (phase === 'live') return live.samples.length ? live.samples[live.samples.length - 1] : null;
		return sampleAt(run.samples, at);
	});
	/** In the live run: the largest gap between its measurements and the stored run's. */
	const drift = $derived.by(() => {
		if (phase !== 'live' || live.points.length === 0) return null;
		let worst = 0;
		for (const p of live.points) {
			const s = base.points.find((q) => q.step === p.step);
			if (s) worst = Math.max(worst, Math.abs(s.val - p.val), Math.abs(s.train - p.train));
		}
		return worst;
	});

	// ---- the copied stretch (compare and overfit), found once the text has loaded
	let copy = $state<{ start: number; length: number } | null>(null);
	const copyWanted = $derived(phase === 'compare' || phase === 'overfit');
	const sizeId = $derived<SizeId>(size === 10_000 ? '10k' : size === 100_000 ? '100k' : '1m');
	const copyText = $derived(sample?.text ?? '');
	$effect(() => {
		const want = copyWanted;
		const id = sizeId;
		const text = copyText;
		untrack(() => (copy = null));
		if (!want || !text) return;
		let cancelled = false;
		shakespeare().then(
			(d) => {
				if (cancelled) return;
				const c = modelFor(d, id).longestCopy(text);
				copy = { start: c.start, length: c.length };
			},
			() => {}
		);
		return () => {
			cancelled = true;
		};
	});

	// ---- chart
	const CH = { x: 84, y: 64, w: 480, h: 424 };
	const yMax = Tween.of(() => (phase === 'overfit' || phase === 'compare' ? 5.5 : 4.5), {
		duration: 700,
		easing: cubicInOut
	});
	const sx = scale([0, STEPS], [CH.x, CH.x + CH.w]);
	const sy = $derived(scale([0, yMax.current], [CH.y + CH.h, CH.y]));
	const yTicks = $derived(yMax.current > 5 ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]);
	const trainPath = $derived(
		linePath(
			shown,
			(p) => p.step,
			(p) => p.train,
			sx,
			sy
		)
	);
	const valPath = $derived(
		linePath(
			shown,
			(p) => p.step,
			(p) => p.val,
			sx,
			sy
		)
	);
	const ghostVal = $derived(
		ghost
			? linePath(
					ghost.points,
					(p) => p.step,
					(p) => p.val,
					sx,
					sy
				)
			: ''
	);
	const ghostTrain = $derived(
		ghost && phase === 'live'
			? linePath(
					ghost.points,
					(p) => p.step,
					(p) => p.train,
					sx,
					sy
				)
			: ''
	);
	const batchDots = $derived(
		phase === 'live' ? live.losses.filter((_, i) => i % 2 === 0).slice(-300) : []
	);
	const best = $derived(phase === 'overfit' || phase === 'compare' ? minVal(run) : null);
	const showBest = $derived(best !== null && finalOf(run).val - best.val > 0.05);

	// the two baselines, labelled at the right end inside the chart
	const baseLines = $derived([
		{ key: 'n2', name: 'bigram', v: lines.n2 },
		{ key: 'n3', name: 'trigram', v: lines.n3 }
	]);

	const CARD = { x: 600, y: 64, w: 344, h: 424 };
	const sampleTitle = $derived(
		sample
			? sample.step === 0
				? 'Sample before training'
				: `Sample after ${int(sample.step)} steps`
			: 'Sample'
	);
	const configLabel = $derived(
		`width ${width} · context ${context} · ${dataLabel(size)} · ${int(
			countWeights({ vocab: 65, width, context, heads: 4, layers: 2 })
		)} weights`
	);
	const status = $derived.by(() => {
		switch (live.status) {
			case 'idle':
				return 'press Train: the stored run is drawn faintly';
			case 'loading':
				return 'loading the text…';
			case 'running':
				return `step ${int(live.step)} of ${int(STEPS)} · ${live.msPerStep.toFixed(0)} ms per step in this tab`;
			case 'stopped':
				return `stopped at step ${int(live.step)}`;
			case 'done':
				return `done: ${int(STEPS)} steps · ${live.msPerStep.toFixed(0)} ms per step`;
			default:
				return 'this browser could not start the training worker';
		}
	});
</script>

<g>
	<!-- title -->
	<Readout id="config" order={0} label="Run" value={configLabel}>
		<Label x={CH.x - 60} y={34} anchor="start" size={13} weight={650} text={configLabel} />
	</Readout>

	<Axes
		{sx}
		{sy}
		xLabel="training step"
		yLabel="cross-entropy (nats per character)"
		xTicks={[0, 500, 1000, 1500, 2000, 2500, 3000]}
		{yTicks}
	/>

	<!-- baselines -->
	{#each baseLines as b (b.key)}
		<line
			x1={CH.x}
			x2={CH.x + CH.w}
			y1={sy(b.v)}
			y2={sy(b.v)}
			stroke="var(--ttlm-baseline)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<Readout id={b.key} order={5} label="Smoothed {b.name}" value="{nats(b.v)} nats">
			<Label
				x={CH.x + CH.w - 6}
				y={sy(b.v) - 6}
				anchor="end"
				size={11}
				color="var(--ttlm-baseline)"
				text="smoothed {b.name}, {nats(b.v)}"
			/>
		</Readout>
	{/each}

	<!-- sample steps along the x axis -->
	{#if phase === 'samples'}
		{#each SAMPLE_STEPS as s (s)}
			<circle
				cx={sx(s)}
				cy={CH.y + CH.h}
				r={sample && sample.step === s ? 5 : 3}
				fill={sample && sample.step === s ? 'var(--ttlm-pick)' : 'var(--stage-ink-muted)'}
			/>
		{/each}
	{/if}

	<!-- the default run behind another one -->
	{#if ghost}
		<path d={ghostVal} fill="none" stroke="var(--ttlm-ghost)" stroke-width="2" />
		{#if ghostTrain}
			<path
				d={ghostTrain}
				fill="none"
				stroke="var(--ttlm-ghost)"
				stroke-width="2"
				stroke-dasharray="5 3"
			/>
		{/if}
	{/if}
	{#each batchDots as [s, l] (s)}
		<circle cx={sx(s)} cy={sy(l)} r="1.4" fill="var(--ttlm-train)" opacity="0.35" />
	{/each}

	<path d={trainPath} fill="none" stroke="var(--ttlm-train)" stroke-width="2.5" />
	<path d={valPath} fill="none" stroke="var(--ttlm-val)" stroke-width="2.5" />
	{#if now}
		<circle cx={sx(now.step)} cy={sy(now.train)} r="4.5" fill="var(--ttlm-train)" />
		<circle cx={sx(now.step)} cy={sy(now.val)} r="4.5" fill="var(--ttlm-val)" />
	{/if}
	{#if showBest && best}
		<circle
			cx={sx(best.step)}
			cy={sy(best.val)}
			r="6"
			fill="none"
			stroke="var(--ttlm-val)"
			stroke-width="2"
		/>
		<Readout
			id="best"
			order={4}
			label="Lowest held-out loss"
			value="{nats(best.val)} at step {int(best.step)}"
		>
			<Label
				x={sx(best.step) + 10}
				y={sy(best.val) + 18}
				anchor="start"
				size={11}
				color="var(--ttlm-val)"
				text="lowest held-out, step {int(best.step)}"
			/>
		</Readout>
	{/if}

	<!-- legend and read-outs -->
	<g>
		<line
			x1={CH.x + 14}
			x2={CH.x + 40}
			y1={CH.y + 14}
			y2={CH.y + 14}
			stroke="var(--ttlm-train)"
			stroke-width="2.5"
		/>
		<line
			x1={CH.x + 14}
			x2={CH.x + 40}
			y1={CH.y + 34}
			y2={CH.y + 34}
			stroke="var(--ttlm-val)"
			stroke-width="2.5"
		/>
		<Readout
			id="train"
			order={1}
			label="Training text"
			value={now ? `${nats(now.train)} nats` : '—'}
			color="var(--ttlm-train)"
		>
			<Label
				x={CH.x + 48}
				y={CH.y + 18}
				anchor="start"
				size={12}
				tabular
				text="training text{now ? `: ${nats(now.train)}` : ''}"
			/>
		</Readout>
		<Readout
			id="val"
			order={2}
			label="Held-out text"
			value={now ? `${nats(now.val)} nats · perplexity ${perplexity(now.val).toFixed(1)}` : '—'}
			color="var(--ttlm-val)"
		>
			<Label
				x={CH.x + 48}
				y={CH.y + 38}
				anchor="start"
				size={12}
				tabular
				text="held-out text{now
					? `: ${nats(now.val)} · perplexity ${perplexity(now.val).toFixed(1)}`
					: ''}"
			/>
		</Readout>
		{#if ghost}
			<line
				x1={CH.x + 14}
				x2={CH.x + 40}
				y1={CH.y + 54}
				y2={CH.y + 54}
				stroke="var(--ttlm-ghost)"
				stroke-width="2"
			/>
			<Readout
				id="ghost"
				order={6}
				label={phase === 'live' ? 'Faint' : 'Grey'}
				value={phase === 'live' ? 'the stored run' : 'the default run, held-out'}
			>
				<Label
					x={CH.x + 48}
					y={CH.y + 58}
					anchor="start"
					size={12}
					muted
					text={phase === 'live' ? 'the stored run (dashed: training)' : 'default run, held-out'}
				/>
			</Readout>
		{/if}
	</g>

	{#if phase === 'live'}
		<Readout id="status" order={3} label="Training in this tab" value={status}>
			<Label x={CH.x} y={CH.y + CH.h + 66} anchor="start" size={12} tabular text={status} />
		</Readout>
		{#if drift !== null}
			<Readout
				id="drift"
				order={4}
				label="Largest gap from the stored run"
				value="{drift.toFixed(4)} nats"
			>
				<Label
					x={CH.x}
					y={CH.y + CH.h + 86}
					anchor="start"
					size={11}
					muted
					tabular
					text="largest gap from the stored run: {drift.toFixed(4)} nats"
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the sample -->
	{#if sample}
		<SampleCard
			x={CARD.x}
			y={CARD.y}
			w={CARD.w}
			h={CARD.h}
			title={sampleTitle}
			note={copyWanted && copy
				? `bold: ${copy.length} characters copied from its training text`
				: 'drawn at random from its probabilities, same seed each time'}
			text={sample.text}
			copy={copyWanted ? copy : null}
		/>
	{:else}
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label
			x={CARD.x + 16}
			y={CARD.y + 26}
			anchor="start"
			size={13}
			muted
			text="press Train: its samples appear here"
		/>
	{/if}
</g>
