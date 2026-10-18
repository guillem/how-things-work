<script lang="ts">
	/**
	 * The page's own sweep on log-log axes: each dot is one run's lowest held-out loss.
	 *
	 * Modes (`step.hints.mode`): `N` draws loss against the model's size, one line per amount of
	 * training text; `D` loss against the amount of text, one line per width; `live` is the `N`
	 * view at all the text with the smallest model retrained in a Web Worker (live.svelte.ts), its
	 * lowest held-out loss so far drawn as a ring that comes down onto the stored dot, and its
	 * curve beside the stored one in an inset. The picked line (the `size` or `width` select)
	 * is drawn in the accent colour with a power law, dashed: in the `N` view fitted to the four
	 * smallest models and extended, so the larger ones that bend away from it show; in the `D`
	 * view fitted to all five amounts of text, whose slope grows with the width.
	 */
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { STEPS } from '../../training-a-tiny-language-model/train';
	import { live, LIVE, startLive, stopLive } from '../live.svelte';
	import {
		blockWeights,
		bySize,
		byWidth,
		curveOf,
		fitPowerLaw,
		pointOf,
		powerLaw,
		SWEEP_DATA,
		SWEEP_WIDTHS,
		type SweepPoint
	} from '../sweep';
	import { int, nats, short, sizeLabel, sizeOf, sizeShort, widthOf } from './shared';

	let { step, params, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'N'));
	const byN = $derived(mode !== 'D');
	const size = $derived(mode === 'live' ? LIVE.size : sizeOf(params));
	const width = $derived(widthOf(params));

	/** How many of the picked line's first points the power law is fitted to. */
	const FIT_N = 4;
	const FIT_D = 5;

	// ---- axes
	const CH = { x: 96, y: 40, w: 520, h: 440 };
	const xDomain = $derived<[number, number]>(byN ? [3, 5.6] : [3.8, 6.2]);
	const xLo = Tween.of(() => xDomain[0], { duration: 700, easing: cubicInOut });
	const xHi = Tween.of(() => xDomain[1], { duration: 700, easing: cubicInOut });
	const sx = $derived(scale([xLo.current, xHi.current], [CH.x, CH.x + CH.w]));
	const Y_LO = Math.log10(1.55);
	const Y_HI = Math.log10(3.4);
	const sy = scale([Y_LO, Y_HI], [CH.y + CH.h, CH.y]);
	const yTicks = [1.6, 1.8, 2, 2.2, 2.5, 3].map(Math.log10);
	const xTicks = $derived(byN ? [3, 3.5, 4, 4.5, 5, 5.5] : [4, 4.5, 5, 5.5, 6]);
	const X = (p: SweepPoint) => Math.log10(byN ? p.N : p.D);
	const Y = (v: number) => Math.log10(v);

	// ---- lines: one per amount of text (N view) or per width (D view)
	const RAMP = (i: number, n: number) =>
		`var(--sl-ramp-${Math.round(2 + (i * 5) / Math.max(1, n - 1))})`;
	const lines = $derived(
		byN
			? SWEEP_DATA.map((d, i) => ({
					key: `d${d}`,
					pts: bySize(d),
					color: RAMP(i, SWEEP_DATA.length),
					label: sizeShort(d),
					on: d === size
				}))
			: SWEEP_WIDTHS.map((w, i) => ({
					key: `w${w}`,
					pts: byWidth(w),
					color: RAMP(i, SWEEP_WIDTHS.length),
					label: `width ${w}`,
					on: w === width
				}))
	);
	const picked = $derived(lines.find((l) => l.on) ?? lines[lines.length - 1]);
	const law = $derived(
		fitPowerLaw(
			picked.pts.slice(0, byN ? FIT_N : FIT_D).map((p) => ({ x: byN ? p.N : p.D, y: p.loss }))
		)
	);
	const lawPath = $derived.by(() => {
		const a = xLo.current;
		const b = xHi.current;
		const y = (lx: number) => Math.max(Y_LO, Math.min(Y_HI, Y(powerLaw(law, 10 ** lx))));
		return `M${sx(a)},${sy(y(a))}L${sx(b)},${sy(y(b))}`;
	});
	const last = $derived(picked.pts[picked.pts.length - 1]);
	const lastPredicted = $derived(powerLaw(law, byN ? last.N : last.D));
	const first = $derived(picked.pts[0]);
	const perDoubling = $derived((1 - Math.pow(2, -law.alpha)) * 100);

	// ---- the live run
	const trainPresses = $derived(Number(params.train ?? 0));
	const stopPresses = $derived(Number(params.stop ?? 0));
	// a press is a change of the count since the scene was mounted
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
	const target = pointOf(LIVE.width, LIVE.size);
	const storedCurve = curveOf(LIVE.width, LIVE.size);
	const liveBest = $derived(
		live.points.length ? live.points.reduce((a, b) => (b.val < a.val ? b : a)) : null
	);
	const liveNow = $derived(live.points.length ? live.points[live.points.length - 1] : null);
	/** The largest gap between the live run's measurements and the stored run's so far. */
	const drift = $derived.by(() => {
		let worst = 0;
		for (const p of live.points) {
			const q = storedCurve.find((s) => s.step === p.step);
			if (q) worst = Math.max(worst, Math.abs(q.val - p.val), Math.abs(q.train - p.train));
		}
		return live.points.length ? worst : null;
	});
	const status = $derived.by(() => {
		switch (live.status) {
			case 'idle':
				return 'press Train: about half a minute in this tab';
			case 'loading':
				return 'loading the text…';
			case 'running':
				return `step ${int(live.step)} of ${int(STEPS)} · ${live.msPerStep.toFixed(0)} ms a step`;
			case 'stopped':
				return `stopped at step ${int(live.step)}`;
			case 'done':
				return `done: ${int(STEPS)} steps in this tab`;
			default:
				return 'this browser could not start the training worker';
		}
	});
	const INSET = { x: 660, y: 306, w: 268, h: 120 };
	const isx = scale([0, STEPS], [INSET.x, INSET.x + INSET.w]);
	const isy = scale([1.8, 4.3], [INSET.y + INSET.h, INSET.y]);
	const storedPath = linePath(
		storedCurve,
		(p) => p.step,
		(p) => p.val,
		isx,
		isy
	);
	const livePath = $derived(
		linePath(
			live.points,
			(p) => p.step,
			(p) => p.val,
			isx,
			isy
		)
	);

	const title = $derived(
		mode === 'D'
			? `width ${width} · ${int(blockWeights(width))} weights in its blocks`
			: mode === 'live'
				? `width ${LIVE.width} retrained on ${sizeLabel(LIVE.size)}`
				: `training text: ${sizeLabel(size)}`
	);
	const fitText = $derived(
		`${byN ? 'L = k·N' : 'L = k·D'}^−${law.alpha.toFixed(3)} (${byN ? `fitted to the ${FIT_N} smallest models` : 'fitted to all five amounts'})`
	);
</script>

<g>
	<Axes
		{sx}
		{sy}
		{xTicks}
		xFormat={(v) => short(10 ** v)}
		{yTicks}
		yFormat={(v) => (10 ** v).toFixed(1)}
		xLabel={byN ? 'weights in the blocks, N' : 'characters of training text, D'}
		yLabel="lowest held-out loss (nats per character)"
	/>

	<!-- every line of the sweep, the picked one last -->
	{#each lines as l (l.key)}
		{#if !l.on}
			<path
				d={linePath(l.pts, X, (p) => Y(p.loss), sx, sy)}
				fill="none"
				stroke={l.color}
				stroke-width="1.6"
			/>
			{#each l.pts as p (p.width + '-' + p.size)}
				<circle cx={sx(X(p))} cy={sy(Y(p.loss))} r="3" fill={l.color} />
			{/each}
		{/if}
	{/each}
	<path d={lawPath} fill="none" stroke="var(--sl-pick)" stroke-width="1.6" stroke-dasharray="6 4" />
	<path
		d={linePath(picked.pts, X, (p) => Y(p.loss), sx, sy)}
		fill="none"
		stroke="var(--sl-pick)"
		stroke-width="2.8"
	/>
	{#each picked.pts as p (p.width + '-' + p.size)}
		<circle
			cx={sx(X(p))}
			cy={sy(Y(p.loss))}
			r="5"
			fill="var(--sl-pick)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}
	<Readout id="pick-label">
		<Label
			x={sx(X(last)) + 10}
			y={sy(Y(last.loss)) + 4}
			anchor="start"
			size={11.5}
			weight={650}
			color="var(--sl-pick)"
			text={picked.label}
		/>
	</Readout>

	{#if mode === 'live'}
		<!-- the live run's best so far, coming down onto the stored point -->
		{#if liveBest}
			<circle
				cx={sx(Math.log10(target.N))}
				cy={sy(Y(Math.min(3.35, liveBest.val)))}
				r="10"
				fill="none"
				stroke="var(--sl-live)"
				stroke-width="2.5"
			/>
		{/if}
		{#if !liveBest}
			<circle
				cx={sx(Math.log10(target.N))}
				cy={sy(Y(target.loss))}
				r="10"
				fill="none"
				stroke="var(--sl-live)"
				stroke-width="1.5"
				stroke-dasharray="3 3"
			/>
		{/if}
	{/if}

	<!-- read-outs -->
	<Readout id="card0">
		<rect
			x="644"
			y={CH.y}
			width="300"
			height={mode === 'live' ? 414 : 200}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="title"
		order={0}
		label={mode === 'D' ? 'Width' : mode === 'live' ? 'Retrained' : 'Training text'}
		value={mode === 'N' ? sizeLabel(size) : title}
	>
		<Label x={660} y={CH.y + 24} anchor="start" size={13} weight={650} text={title} />
	</Readout>
	<Readout id="fit" order={1} label="Dashed line" value={fitText} color="var(--sl-pick)">
		<Label
			x={660}
			y={CH.y + 50}
			anchor="start"
			size={12}
			color="var(--sl-pick)"
			text="dashed: {byN ? 'L = k·N' : 'L = k·D'}^−{law.alpha.toFixed(3)}"
		/>
		<Label
			x={660}
			y={CH.y + 68}
			anchor="start"
			size={11}
			muted
			text={byN ? `fitted to the ${FIT_N} smallest models` : 'fitted to all five amounts of text'}
		/>
	</Readout>
	<Readout
		id="doubling"
		order={2}
		label="Each doubling"
		value="−{perDoubling.toFixed(1)}% loss along the line"
	>
		<Label
			x={660}
			y={CH.y + 94}
			anchor="start"
			size={12}
			tabular
			text="each doubling: −{perDoubling.toFixed(1)}% along the line"
		/>
	</Readout>
	{#if byN}
		<Readout
			id="bend"
			order={3}
			label="Largest model"
			value="{nats(last.loss)} measured, {nats(lastPredicted)} on the line"
		>
			<Label
				x={660}
				y={CH.y + 120}
				anchor="start"
				size={12}
				tabular
				text="largest model: {nats(last.loss)} measured,"
			/>
			<Label
				x={660}
				y={CH.y + 138}
				anchor="start"
				size={12}
				tabular
				text="{nats(lastPredicted)} on the line"
			/>
		</Readout>
	{:else}
		<Readout
			id="span"
			order={3}
			label="10,000 characters → all"
			value="{nats(first.loss)} → {nats(last.loss)} nats"
		>
			<Label
				x={660}
				y={CH.y + 120}
				anchor="start"
				size={12}
				tabular
				text="10,000 characters: {nats(first.loss)}"
			/>
			<Label
				x={660}
				y={CH.y + 138}
				anchor="start"
				size={12}
				tabular
				text="all the text: {nats(last.loss)}"
			/>
		</Readout>
	{/if}
	<Readout id="legend">
		<Label
			x={660}
			y={CH.y + 168}
			anchor="start"
			size={11}
			muted
			text={byN ? 'fainter lines: less text' : 'fainter lines: narrower models'}
		/>
		<Label
			x={660}
			y={CH.y + 184}
			anchor="start"
			size={11}
			muted
			text="each dot: one run's lowest held-out loss"
		/>
	</Readout>

	{#if mode === 'live'}
		<Readout id="status" order={4} label="Training in this tab" value={status}>
			<Label
				x={660}
				y={CH.y + 214}
				anchor="start"
				size={12}
				weight={650}
				color="var(--sl-live)"
				text={status}
			/>
		</Readout>
		<Readout
			id="livebest"
			order={5}
			label="Its lowest held-out loss"
			value={liveBest ? `${nats(liveBest.val)} at step ${int(liveBest.step)}` : '—'}
		>
			<Label
				x={660}
				y={CH.y + 234}
				anchor="start"
				size={12}
				tabular
				text={liveBest
					? `lowest so far: ${liveBest.val.toFixed(4)} (stored ${target.loss.toFixed(4)})`
					: `stored lowest: ${target.loss.toFixed(4)}`}
			/>
		</Readout>
		{#if drift !== null}
			<Readout
				id="drift"
				order={6}
				label="Largest gap from the stored run"
				value="{drift.toFixed(4)} nats"
			>
				<Label
					x={660}
					y={CH.y + 254}
					anchor="start"
					size={11}
					muted
					tabular
					text="largest gap from the stored run: {drift.toFixed(4)} nats"
				/>
			</Readout>
		{/if}
		<Readout id="inset">
			<rect
				x={INSET.x}
				y={INSET.y}
				width={INSET.w}
				height={INSET.h}
				fill="none"
				stroke="var(--border)"
			/>
			<path d={storedPath} fill="none" stroke="var(--sl-slice)" stroke-width="2" />
			<path d={livePath} fill="none" stroke="var(--sl-live)" stroke-width="2" />
			{#if liveNow}
				<circle cx={isx(liveNow.step)} cy={isy(liveNow.val)} r="3.5" fill="var(--sl-live)" />
			{/if}
			<Label
				x={INSET.x}
				y={INSET.y + INSET.h + 16}
				anchor="start"
				size={10.5}
				muted
				text="held-out loss against step: grey stored, orange here"
			/>
		</Readout>
	{/if}
</g>
