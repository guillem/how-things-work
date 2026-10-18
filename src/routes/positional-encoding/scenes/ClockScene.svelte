<script lang="ts">
	/**
	 * The sinusoidal encoding with d = 16: one row per pair of dimensions, a dial (the pair as a
	 * clock hand at the angle pos·ωᵢ) and, to its right, the pair's sine over the positions.
	 *
	 * Phases (`step.hints.phase`):
	 *   clocks — the hands at the chosen position (`pos`, or counted up while `play` is on)
	 *   offset — also the hands at pos + k (hollow) and the arc each one turns, k·ωᵢ
	 *   beyond — positions to 1,024: the arcs each hand swept over the trained positions 0–63
	 *            (blue) and the new angles it reaches in a longer text (`len`, red)
	 *
	 * The position line has a handle on top: dragging it sets `pos` (or `len`).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Handle, Label, type Point } from '#lib/draw/index.ts';
	import { frequencies, outsideTraining, sweep, TRAIN, wavelengths } from '../position';
	import { MAX_LEN, MAX_POS } from '../steps';
	import { arc, big, deg, num, onDial, wedge } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const D = 16;
	const W = frequencies(D);
	const WL = wavelengths(D);
	const TAU = 2 * Math.PI;

	const phase = $derived(String(step.hints?.phase ?? 'clocks'));
	const beyond = $derived(phase === 'beyond');

	// ---- the values
	const playing = $derived(phase === 'clocks' && params.play === true);
	const played = $derived(playing ? Math.floor(t * 2) % (MAX_POS + 1) : null);
	$effect(() => {
		const v = played;
		if (v !== null) untrack(() => setParam('pos', v));
	});
	const pos = $derived(played ?? Math.max(0, Math.min(MAX_POS, Math.round(num(params.pos, 10)))));
	const k = $derived(Math.max(0, Math.min(40, Math.round(num(params.k, 5)))));
	const len = $derived(Math.max(TRAIN, Math.min(MAX_LEN, Math.round(num(params.len, 256)))));
	/** The position the hands show: pos, or the last position of the text. */
	const here = $derived(beyond ? len - 1 : pos);

	// The offset's hollow hands fade in and out with the step.
	const offW = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const on = phase === 'offset' ? 1 : 0;
		untrack(() => offW.set(on, { duration: reduced ? 0 : 700 }));
	});

	// ---- layout
	const ROW0 = 96;
	const RH = 58;
	const rowY = (i: number) => ROW0 + i * RH;
	const DX = 62;
	const R = 23;
	const SX0 = 250;
	const SX1 = 924;
	const AMP = 19;
	const XMAX = $derived(beyond ? MAX_LEN : 168);
	const sx = (p: number, max: number) => SX0 + (p / max) * (SX1 - SX0);
	const X = (p: number) => sx(p, XMAX);
	const ticks = $derived(beyond ? [0, 256, 512, 768, 1024] : [0, 40, 80, 120, 160]);

	/** Each pair's sine over the positions 0…max, as a path (computed once per axis). */
	function waves(max: number) {
		const n = Math.round((SX1 - SX0) * 2);
		return W.map((w, i) => {
			let d = '';
			for (let s = 0; s <= n; s++) {
				const p = (s / n) * max;
				d += `${s ? 'L' : 'M'}${sx(p, max).toFixed(1)} ${(rowY(i) - AMP * Math.sin(p * w)).toFixed(1)}`;
			}
			return d;
		});
	}
	const WAVES_NEAR = waves(168);
	const WAVES_FAR = waves(MAX_LEN);
	const wavePaths = $derived(beyond ? WAVES_FAR : WAVES_NEAR);

	// ---- the beyond phase: the arcs swept in training and the new ones
	const seen = sweep(TRAIN, D);
	const reach = $derived(sweep(len, D));
	const fresh = $derived(W.filter((_, i) => seen[i] < TAU && reach[i] > seen[i]).length);
	const legend = $derived(
		`blue: swept over positions 0–${TRAIN - 1} · red: new angles · ${fresh} of 8 pairs reach new angles`
	);

	// ---- dragging the position line
	function onmove(p: Point) {
		const v = ((p.x - SX0) / (SX1 - SX0)) * XMAX;
		if (beyond) setParam('len', Math.max(TRAIN, Math.min(MAX_LEN, Math.round(v) + 1)));
		else setParam('pos', Math.max(0, Math.min(MAX_POS, Math.round(v))));
	}
	function onkey(s: number | 'start' | 'end') {
		if (beyond) {
			const v = s === 'start' ? TRAIN : s === 'end' ? MAX_LEN : len + s;
			setParam('len', Math.max(TRAIN, Math.min(MAX_LEN, v)));
		} else {
			const v = s === 'start' ? 0 : s === 'end' ? MAX_POS : pos + s;
			setParam('pos', Math.max(0, Math.min(MAX_POS, v)));
		}
	}

	const title = $derived(
		phase === 'offset'
			? `Positions ${pos} and ${pos + k}: every hand turns by k·ωᵢ, whatever the position`
			: beyond
				? `Trained on positions 0–${TRAIN - 1}; this text runs to ${len - 1}`
				: `The encoding of position ${pos}: eight pairs, d = 16`
	);
	const rowNote = (i: number) => {
		if (phase === 'offset') {
			const a = (k * W[i]) % TAU;
			return `k·ω turns ${deg(a, a < 0.17 ? 1 : 0)}`;
		}
		if (beyond)
			return seen[i] >= TAU
				? 'full circle swept'
				: `swept in training: ${deg(seen[i], seen[i] < 0.1 ? 1 : 0)}`;
		return `a turn every ${WL[i] < 100 ? WL[i].toFixed(1) : big(WL[i])}`;
	};
</script>

<g>
	<Readout id="title" order={1} label="Showing" value={title}>
		<Label x={24} y={34} anchor="start" size={15} weight={650} text={title} />
	</Readout>

	<!-- shaded spans in the beyond phase -->
	{#if beyond}
		<rect
			x={X(0)}
			y={ROW0 - 34}
			width={X(TRAIN - 1) - X(0)}
			height={RH * 8 + 8}
			fill="var(--pe-seen)"
			opacity="0.45"
		/>
		<rect
			x={X(TRAIN - 1)}
			y={ROW0 - 34}
			width={Math.max(0, X(len - 1) - X(TRAIN - 1))}
			height={RH * 8 + 8}
			fill="var(--pe-new-bg)"
			opacity="0.5"
		/>
		<Label
			x={X(TRAIN - 1) + 6}
			y={ROW0 - 40}
			anchor="start"
			size={11}
			muted
			text="training length"
		/>
	{/if}

	<!-- the axis -->
	{#each ticks as v (v)}
		<line
			x1={X(v)}
			y1={ROW0 - 30}
			x2={X(v)}
			y2={rowY(7) + 28}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Label x={X(v)} y={rowY(7) + 46} size={11} muted tabular text={String(v)} />
	{/each}
	<Readout id="axis">
		<Label x={SX1} y={rowY(7) + 64} anchor="end" size={11} muted text="position" />
	</Readout>

	{#each W as w, i (i)}
		{@const cy = rowY(i)}
		{@const a = here * w}
		{@const tip = onDial(DX, cy, R, a)}
		<!-- the dial -->
		<circle cx={DX} {cy} r={R} fill="var(--surface)" stroke="var(--border)" stroke-width="1.2" />
		{#if beyond}
			<path d={wedge(DX, cy, R, 0, Math.min(TAU, seen[i]))} fill="var(--pe-seen)" opacity="0.9" />
			{#if seen[i] < TAU && reach[i] > seen[i]}
				<path
					d={wedge(DX, cy, R, seen[i], Math.min(TAU, reach[i]))}
					fill="var(--pe-new)"
					opacity="0.55"
				/>
			{/if}
		{/if}
		<line x1={DX + R - 5} y1={cy} x2={DX + R} y2={cy} stroke="var(--stage-ink-muted)" />
		{#if offW.current > 0.01}
			{@const a2 = (here + k) * w}
			{@const tip2 = onDial(DX, cy, R - 4, a2)}
			<g opacity={offW.current}>
				<path
					d={arc(DX, cy, R - 7, a, a + ((k * w) % TAU))}
					fill="none"
					stroke="var(--pe-q)"
					stroke-width="2"
				/>
				<line
					x1={DX}
					y1={cy}
					x2={tip2.x}
					y2={tip2.y}
					stroke="var(--pe-q)"
					stroke-width="2"
					stroke-dasharray="3 2"
				/>
				<circle
					cx={tip2.x}
					cy={tip2.y}
					r="4"
					fill="var(--stage-bg)"
					stroke="var(--pe-q)"
					stroke-width="2"
				/>
			</g>
		{/if}
		<line
			x1={DX}
			y1={cy}
			x2={tip.x}
			y2={tip.y}
			stroke={beyond && outsideTraining(here, i, TRAIN, D) ? 'var(--pe-new)' : 'var(--pe-hand)'}
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<circle cx={DX} {cy} r="2.5" fill="var(--pe-hand)" />

		<!-- the row's labels -->
		<Readout id="row{i}">
			<Label x={DX + R + 14} y={cy - 4} anchor="start" size={12} weight={600} text="pair {i + 1}" />
			<Label x={DX + R + 14} y={cy + 12} anchor="start" size={11} muted tabular text={rowNote(i)} />
		</Readout>

		<!-- the wave -->
		<line
			x1={SX0}
			y1={cy}
			x2={SX1}
			y2={cy}
			stroke="var(--stage-line)"
			stroke-width="0.8"
			opacity="0.6"
		/>
		<path
			d={wavePaths[i]}
			fill="none"
			stroke="var(--pe-hand)"
			stroke-width="1.3"
			opacity="0.75"
			stroke-linejoin="round"
		/>
		<circle cx={X(here)} cy={cy - AMP * Math.sin(a)} r="4.5" fill="var(--pe-out)" />
		{#if offW.current > 0.01}
			<circle
				cx={X(here + k)}
				cy={cy - AMP * Math.sin((here + k) * w)}
				r="4.5"
				fill="var(--stage-bg)"
				stroke="var(--pe-q)"
				stroke-width="2"
				opacity={offW.current}
			/>
		{/if}
	{/each}

	<!-- the position line(s) -->
	<line
		x1={X(here)}
		y1={ROW0 - 30}
		x2={X(here)}
		y2={rowY(7) + 28}
		stroke="var(--pe-out)"
		stroke-width="1.5"
	/>
	{#if offW.current > 0.01}
		<line
			x1={X(here + k)}
			y1={ROW0 - 30}
			x2={X(here + k)}
			y2={rowY(7) + 28}
			stroke="var(--pe-q)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity={offW.current}
		/>
	{/if}
	<Handle
		x={X(here)}
		y={ROW0 - 40}
		r={8}
		color="var(--pe-out)"
		label={beyond ? 'Text length' : 'Position'}
		value={beyond ? len : pos}
		min={beyond ? TRAIN : 0}
		max={beyond ? MAX_LEN : MAX_POS}
		valuetext={beyond ? `${len} positions` : `position ${pos}`}
		{onmove}
		{onkey}
	/>

	{#if beyond}
		<Readout
			id="new"
			order={2}
			label="Pairs reaching angles not swept in training"
			value="{fresh} of 8"
			color="var(--pe-new)"
		>
			<Label x={24} y={rowY(7) + 64} anchor="start" size={12} text={legend} />
		</Readout>
	{/if}
</g>
