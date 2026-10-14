<script lang="ts">
	/**
	 * Gradient descent on a loss landscape: the landscape as a surface (or, for
	 * the line fit, the examples and the line) on the left, as a contour map on
	 * the right, and the loss after every step underneath.
	 *
	 * Hints (`step.hints`): `phase` — explore (just the draggable point),
	 * gradient (with the downhill arrows), run (one ball descends), compare
	 * (three learning rates at once); `land` — the landscape; `left` — surface
	 * or data; `lr`, `momentum`, `start` — settings the step does not offer as
	 * controls. The run is computed from the settings (never from `t`); `t` only
	 * says how many of its steps are shown, counted from when the run last
	 * changed. Under reduced motion the whole run is shown.
	 */
	import { cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { nearestMinimum } from '../descent';
	import ContourMap from './ContourMap.svelte';
	import DataPlot from './DataPlot.svelte';
	import LossPlot from './LossPlot.svelte';
	import Surface from './Surface.svelte';
	import Txt from './Txt.svelte';
	import { MAP, ballAt, clampToMap, createSince, fmt, runsFor, setup, stepsAt } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const s = $derived(setup(step, params));
	const runs = $derived(runsFor(s));
	const since = createSince();
	const tau = $derived(reduced ? Infinity : since(t, s.key));
	const kf = $derived(stepsAt(tau));

	const balls = $derived(
		runs.map((r, i) => {
			const last = r.run.path.length - 1;
			const b = ballAt(r.run, Math.min(kf, last));
			return { ...r, ...b, i, last, key: `${i}-${r.lr}` };
		})
	);
	const here = $derived(
		balls.length ? { x: balls[0].x, y: balls[0].y } : { x: s.start[0], y: s.start[1] }
	);
	const noisy = $derived(s.noise > 0 || (s.land.id === 'line' && s.batch < 21));
	const trails = $derived(
		balls.length
			? balls.map((b) => ({
					key: b.key,
					color: b.color,
					// A noisy run shows only its recent steps, so its wandering stays readable.
					points: [
						...b.run.path.slice(noisy ? Math.max(0, b.k - 40) : 0, b.k + 1),
						{ x: b.x, y: b.y }
					],
					ball: { x: b.x, y: b.y }
				}))
			: [{ key: 'still', color: 'var(--gd-ball)', points: [], ball: here }]
	);

	const exploring = $derived(s.phase === 'explore' || s.phase === 'gradient');
	const invite = $derived(exploring && !reduced && t < 6.5 ? cycle(t, 1.6) : 0);
	function move([x, y]: [number, number]) {
		const [cx, cy] = clampToMap(s.land, [x, y]);
		setParam(s.startKey, `${cx.toFixed(3)},${cy.toFixed(3)}`);
	}

	// ---- readouts ------------------------------------------------------------------
	const lossHere = $derived(s.land.f(here.x, here.y));
	const grad = $derived(s.land.grad(here.x, here.y));
	const lowest = $derived(s.land.minima[0].value);

	function verdict(b: (typeof balls)[number]) {
		const r = b.run;
		if (r.diverged && b.k >= b.last - 1) return 'diverged: flew off the map';
		if (r.diverged && b.k > 2 && r.path[b.k].loss > r.path[0].loss)
			return 'each step overshoots further';
		if (r.settledAt >= 0 && b.k >= r.settledAt) {
			const m = nearestMinimum(s.land, b.x, b.y);
			return `reached ${m.name} at step ${r.settledAt}`;
		}
		const L = s.land;
		if (b.x < L.x[0] || b.x > L.x[1] || b.y < L.y[0] || b.y > L.y[1]) return 'off the map';
		const m = nearestMinimum(L, b.x, b.y);
		if (noisy && b.k > 3) return `wandering around ${m.name}`;
		if (b.k >= b.last) return `still going after ${b.last} steps`;
		return 'going downhill…';
	}
	const xn = $derived(s.land.id === 'line' ? 'a' : 'w₁');
	const yn = $derived(s.land.id === 'line' ? 'b' : 'w₂');
	// How far the loss plot's step axis reaches: the steps taken so far; in the
	// reduced-motion frame (the whole run at once), up to a little past where it settled.
	const plotSteps = $derived.by(() => {
		const longest = Math.max(0, ...balls.map((b) => b.last));
		if (!reduced) return Math.min(kf, longest);
		const settled = balls.map((b) => (b.run.settledAt > 0 ? b.run.settledAt : b.last));
		return Math.min(longest, Math.max(20, 1.6 * Math.max(...settled)));
	});
	const RX = MAP.x;
	const RY = MAP.y + MAP.size + 56;
</script>

<g>
	{#if s.left === 'data'}
		<DataPlot a={here.x} b={here.y} showBest={s.phase === 'run'} />
	{:else}
		<Surface land={s.land} {trails} showMinima={s.phase !== 'gradient'} />
	{/if}

	<ContourMap
		land={s.land}
		start={s.start}
		{trails}
		arrows={s.phase === 'gradient'}
		showMinima={!(s.phase === 'explore' && s.left === 'data')}
		{invite}
		onmove={move}
	/>

	{#if balls.length}
		<LossPlot
			series={balls.map((b) => ({
				key: b.key,
				color: b.color,
				losses: [...b.run.path.slice(0, b.k + 1).map((p) => p.loss)]
			}))}
			top={balls[0].run.path[0].loss}
			floor={lowest}
			shown={plotSteps}
		/>
	{/if}

	<!-- readouts under the map (listed under the stage on phones) -->
	{#if s.phase === 'explore'}
		<Readout
			id="point"
			order={1}
			label="Settings"
			value="{xn} = {fmt(here.x)}, {yn} = {fmt(here.y)}"
		>
			<Txt
				x={RX}
				y={RY}
				text="{s.land.xName} = {fmt(here.x)}, {s.land.yName} = {fmt(here.y)}"
				size={13}
			/>
		</Readout>
		<Readout id="loss" order={2} label="Loss" value={fmt(lossHere)} color="var(--gd-ball)">
			<Txt
				x={RX}
				y={RY + 22}
				text="loss (mean squared error) = {fmt(lossHere)}"
				size={15}
				weight={600}
				color="var(--gd-ball)"
			/>
		</Readout>
		{#if s.left === 'surface'}
			<Readout id="lowest" order={3} label="Lowest (×)" value={fmt(lowest)}>
				<Txt
					x={RX}
					y={RY + 44}
					text="lowest possible loss, at the ×: {fmt(lowest)}"
					size={12}
					muted
				/>
			</Readout>
		{:else}
			<Readout id="drag" order={3} label="Try" value="drag the point on the map">
				<Txt
					x={RX}
					y={RY + 44}
					text="drag the point: every point of the map is one line"
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{:else if s.phase === 'gradient'}
		<Readout
			id="partials"
			order={1}
			label="Gradient ∇L"
			value="(∂L/∂{xn}, ∂L/∂{yn}) = ({fmt(grad[0])}, {fmt(grad[1])})"
		>
			<Txt
				x={RX}
				y={RY}
				text="∇L = (∂L/∂{xn}, ∂L/∂{yn}) = ({fmt(grad[0])}, {fmt(grad[1])})"
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout id="steep" order={2} label="Steepness |∇L|" value={fmt(Math.hypot(...grad))}>
			<Txt x={RX} y={RY + 20} text="steepness |∇L| = {fmt(Math.hypot(...grad))}" size={13} />
		</Readout>
		<Readout id="legend" order={3} label="Arrows" value="dashed: ∇L, uphill · solid: −∇L, downhill">
			<Txt
				x={RX}
				y={RY + 40}
				text="dashed: ∇L, uphill · solid and small: −∇L, downhill"
				size={12}
				muted
			/>
		</Readout>
	{:else if s.phase === 'compare'}
		{#each balls as b (b.key)}
			<Readout
				id="cmp-{b.i}"
				order={b.i + 1}
				label="η = {b.lr}"
				value="{b.label} · {verdict(b)}"
				color={b.color}
			>
				<circle cx={RX + 5} cy={RY + 38 * b.i - 4} r="5" fill={b.color} />
				<Txt
					x={RX + 16}
					y={RY + 38 * b.i}
					text="η = {b.lr}: {b.label}"
					size={13}
					weight={600}
					color={b.color}
				/>
				<Txt x={RX + 16} y={RY + 38 * b.i + 17} text={verdict(b)} size={12} muted />
			</Readout>
		{/each}
	{:else if balls.length}
		{@const b = balls[0]}
		<Readout
			id="step"
			order={1}
			label="Step"
			value="{b.k} · loss {fmt(b.loss)}"
			color="var(--gd-ball)"
		>
			<Txt
				x={RX}
				y={RY}
				text="step {b.k} · loss = {fmt(b.loss)}"
				size={15}
				weight={600}
				color="var(--gd-ball)"
			/>
		</Readout>
		<Readout id="verdict" order={2} label="So far" value={verdict(b)}>
			<Txt x={RX} y={RY + 21} text={verdict(b)} size={13} />
		</Readout>
		<Readout
			id="settings"
			order={3}
			label="Settings"
			value="η = {fmt(s.lr)}{s.momentum > 0 ? `, β = ${s.momentum}` : ''}{s.noise > 0
				? `, noise ${s.noise}`
				: ''}"
		>
			<Txt
				x={RX}
				y={RY + 41}
				text="η = {fmt(s.lr)}{s.momentum > 0 ? ` · momentum β = ${s.momentum}` : ''}{s.noise > 0
					? ` · noise ${s.noise}`
					: ''}{s.land.id === 'line' && s.batch < 21
					? ` · ${s.batch} example${s.batch > 1 ? 's' : ''} per step`
					: ''}"
				size={12}
				muted
			/>
		</Readout>
		{#if s.land.id === 'bowl'}
			<Readout id="factor" order={4} label="Each step" value="distance × (1 − η) = {fmt(1 - s.lr)}">
				<Txt
					x={RX}
					y={RY + 61}
					text="each step: distance to the bottom × (1 − η) = × {fmt(1 - s.lr)}"
					size={12}
					muted
				/>
			</Readout>
		{:else}
			<Readout id="hint">
				<Txt
					x={RX}
					y={RY + 61}
					text="click the map to drop the ball somewhere else"
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{/if}
</g>
