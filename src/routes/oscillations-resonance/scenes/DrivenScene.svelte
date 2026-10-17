<script lang="ts">
	/**
	 * The spring of the first steps (1 kg on `params.stiffness`, 39 N/m by
	 * default: f₀ ≈ 0.99 Hz) pushed by a hand at the top moving up and down at
	 * `params.pushFreq`, with friction `params.damping`. A 1 N push is the same
	 * as moving the top of the spring by F₀/k (2.6 cm at 39 N/m), so hand and
	 * mass are drawn at one scale: at resonance the mass swings far more than
	 * the hand. Both driven steps offer the stiffness control, so neither runs on
	 * a value set out of sight.
	 *
	 * Phases (`step.hints.phase`):
	 *   push  — the build-up from rest on a 30 s trace, the predicted steady
	 *           swing dashed; below, bars compare the hand's and the mass's swing
	 *   curve — the bars give way to the resonance curve (steady swing against
	 *           push frequency, fixed scale) with the current push marked, and a
	 *           dot for every push frequency tried on these steps at the swing the
	 *           simulation settled to (cleared when the spring or friction change)
	 *
	 * The motion (`springMotion` with the push, 90 s, from rest) is precomputed per
	 * setting and replayed in real time; a slider change restarts it (the clock
	 * memo of newtons-laws/TrackScene, the guide's sanctioned exception). Past
	 * 90 s the last push periods repeat. Reduced motion: the complete 30 s trace.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { naturalFrequency, peakFrequency, springMotion, steadyAmplitude } from '../oscillator';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import {
		COL_X,
		PLOT_X0,
		PLOT_X1,
		SAMPLE,
		coilPath,
		fmtLen,
		loopTime,
		settleSeconds,
		valueAt,
		type Cell
	} from './osc';

	let { step, t, params, reduced }: StageProps = $props();

	const F0 = 1; // N: a gentle push
	const W = 30; // s of trace
	const CEIL = 34;
	const HAND = 70; // y of the hand at rest
	const REST = 330; // y of the mass's centre at rest
	const PXM = 260; // px per metre for the drawing
	const XMAX = 0.6; // m drawn; beyond this the drawing stops at the edge
	const TR = { top: 150, bottom: 336, max: 0.65 }; // the trace
	const CV = { top: 424, bottom: 552, max: 0.6 }; // the resonance curve
	const SIZE = 46;

	const phase = $derived(String(step.hints?.phase ?? 'push'));
	const f = $derived(Math.max(0.05, Number(params.pushFreq ?? 0.6)));
	const c = $derived(Math.max(0, Number(params.damping ?? 0.3)));
	const k = $derived(Math.min(160, Math.max(10, Number(params.stiffness ?? 39))));
	const spring = $derived({ m: 1, k, c });
	const END = $derived(settleSeconds(1, c, 90));
	const f0 = $derived(naturalFrequency(spring));
	const hand = $derived(F0 / k); // m: how far the top moves for the same force
	const A = $derived(steadyAmplitude(spring, { F0, f }));
	const motion = $derived(springMotion(spring, 0, 0, END, { F0, f }, SAMPLE));

	// ---- clock ------------------------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${f}|${c}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const tau = $derived(reduced ? W : since);
	const loopP = $derived(1 / f);
	const xAt = (s: number) => valueAt(motion.x, loopTime(s, END, loopP));
	const now = $derived(xAt(tau));
	const pushNow = $derived(Math.cos(2 * Math.PI * f * loopTime(tau, END, loopP)));
	// Size of the swing over the last push (or second).
	const swing = $derived.by(() => {
		const span = Math.max(1 / f, 1 / f0);
		let a = 0;
		for (let s = Math.max(0, tau - span); s <= tau; s += SAMPLE) a = Math.max(a, Math.abs(xAt(s)));
		return a;
	});
	// Without friction the start-up never dies away: there is no steady swing.
	const growing = $derived(c === 0 || !Number.isFinite(A) || A > 50);

	// ---- the drawing ----------------------------------------------------------------------
	const yHand = $derived(HAND + hand * pushNow * PXM);
	const yMass = $derived(REST + Math.max(-XMAX, Math.min(XMAX, now)) * PXM);
	const offScale = $derived(swing > XMAX);
	const coil = $derived(coilPath(COL_X, yHand + 8, yMass - SIZE / 2, 12, 26));

	// ---- trace ---------------------------------------------------------------------------
	const ws = $derived(Math.max(0, tau - W));
	const sx = $derived(scale([ws, ws + W], [PLOT_X0, PLOT_X1]));
	const sy = scale([-TR.max, TR.max], [TR.top, TR.bottom]);
	const xTicks = $derived(
		Array.from({ length: 7 }, (_, i) => Math.ceil(ws / 5) * 5 + i * 5).filter((v) => v <= ws + W)
	);
	const tracePath = $derived.by(() => {
		let d = '';
		const n = Math.max(1, Math.round((tau - ws) / SAMPLE));
		for (let i = 0; i <= n; i++) {
			const s = ws + ((tau - ws) * i) / n;
			d += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(xAt(s)).toFixed(1)}`;
		}
		return d;
	});

	// ---- resonance curve -------------------------------------------------------------------
	const fp = $derived(c > 0 ? peakFrequency(spring) : f0);
	const Ap = $derived(c > 0 ? steadyAmplitude(spring, { F0, f: fp }) : Infinity);
	const cx = scale([0.2, 2.5], [PLOT_X0, PLOT_X1]);
	const cy = scale([0, CV.max], [CV.bottom, CV.top]);
	const curvePath = $derived.by(() => {
		const fs: number[] = [];
		for (let i = 0; i <= 230; i++) fs.push(0.2 + i * 0.01);
		for (let i = -40; i <= 40; i++) fs.push(fp + i * 0.0025);
		fs.sort((a, b) => a - b);
		let d = '';
		let first = true;
		for (const ff of fs) {
			if (ff < 0.2 || ff > 2.5) continue;
			const a = Math.min(CV.max + 0.05, steadyAmplitude(spring, { F0, f: ff }));
			d += `${first ? 'M' : 'L'}${cx(ff).toFixed(1)} ${cy(a).toFixed(1)}`;
			first = false;
		}
		return d;
	});
	// With a lot of friction (ζ near or above 1/√2) the peak slides towards 0 Hz and
	// flattens out: there is no peak left on this axis.
	const noPeak = $derived(fp < 0.25);
	const peakText = $derived(
		noPeak
			? 'no peak: this much friction smothers it'
			: !Number.isFinite(Ap)
				? `peak at ${fp.toFixed(2)} Hz · grows without limit`
				: Ap > CV.max
					? `peak at ${fp.toFixed(2)} Hz · ${fmtLen(Ap)} ↑`
					: `peak at ${fp.toFixed(2)} Hz · ${fmtLen(Ap)}`
	);
	// Right on the peak: the steady swing within 10% of the peak's (the peak's half-width
	// is only ζ·f₀, about 0.02 Hz at the default friction).
	const atPeak = $derived(
		!noPeak && (Number.isFinite(Ap) ? A >= 0.9 * Ap : Math.abs(f - fp) < 0.01)
	);
	const peakLabel = $derived(
		noPeak
			? { x: PLOT_X0 + 14, y: CV.top + 40 }
			: {
					x: Math.min(PLOT_X1 - peakText.length * 6.6, cx(fp) + 12),
					y: Math.max(CV.top + 14, Math.min(CV.bottom - 44, cy(Math.min(CV.max, Ap)) - 10))
				}
	);
	// Without friction there is no steady swing to mark on the curve: the marker sits on the
	// frequency axis instead.
	const marker = $derived({ x: cx(f), y: c === 0 ? CV.bottom : cy(Math.min(CV.max, A)) });

	// ---- the pushes tried: where the simulation settled -------------------------------------
	// The swing over the last push (or natural) period of the computed motion, after the
	// start-up has died away: the simulation's own steady swing, not the formula's.
	const settled = $derived.by(() => {
		const n = motion.x.length;
		const span = Math.ceil(Math.max(1 / f, 1 / f0) / SAMPLE);
		let a = 0;
		for (let i = Math.max(0, n - span); i < n; i++) a = Math.max(a, Math.abs(motion.x[i]));
		return a;
	});
	let tried = $state<{ f: number; a: number }[]>([]);
	let triedFor = '';
	$effect(() => {
		const key = `${k}|${c}`;
		const point = { f: Math.round(f * 100) / 100, a: settled };
		const skip = growing;
		untrack(() => {
			const kept = key === triedFor ? tried.filter((p) => p.f !== point.f) : [];
			triedFor = key;
			tried = skip ? kept : [...kept, point].slice(-60);
		});
	});

	// ---- bars: how far each one moves -------------------------------------------------------
	const bx = scale([0, CV.max], [PLOT_X0, PLOT_X1 - 90]);

	const barText = $derived(`${fmtLen(swing)} · ${(swing / hand).toFixed(1)}× your hand`);
	// Right of the bar, or right-aligned above it when that would run off the stage.
	const barLabel = $derived.by(() => {
		const end = Math.min(bx(CV.max), Math.max(bx(swing), !growing && A < CV.max ? bx(A) : 0)) + 8;
		return end + barText.length * 6.6 > 944
			? { x: PLOT_X1, y: CV.top + 72, anchor: 'end' }
			: { x: end, y: CV.top + 91, anchor: 'start' };
	});

	// ---- focus: the curve fades in on its step ----------------------------------------------
	const curveOn = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const on = phase === 'curve' ? 1 : 0;
		untrack(() => curveOn.set(on, { duration: reduced ? 0 : 800 }));
	});

	// ---- readouts --------------------------------------------------------------------------------
	const cells: Cell[] = $derived([
		{
			id: 'f',
			label: 'push',
			value: `${f.toFixed(2)} Hz`,
			sub: 'a gentle 1 N push',
			color: 'var(--osc-push)'
		},
		{ id: 'f0', label: 'natural frequency', value: `${f0.toFixed(2)} Hz`, sub: `1 kg on ${k} N/m` },
		{
			id: 'now',
			label: 'swing now',
			value: fmtLen(swing),
			sub: 'each way from rest',
			color: 'var(--osc-trace)'
		},
		{
			id: 'A',
			label: 'steady swing',
			value: growing ? 'none' : fmtLen(A),
			sub: growing ? 'never settles' : 'predicted'
		}
	]);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="driven-trace">
			<rect x={PLOT_X0} y={TR.top} width={PLOT_X1 - PLOT_X0 + 4} height={TR.bottom - TR.top} />
		</clipPath>
		<clipPath id="driven-curve">
			<rect x={PLOT_X0} y={CV.top - 6} width={PLOT_X1 - PLOT_X0} height={CV.bottom - CV.top + 6} />
		</clipPath>
	</defs>

	<!-- ceiling with a slot for the hand's rod -->
	<rect
		x={COL_X - 80}
		y={CEIL - 12}
		width="160"
		height="12"
		rx="3"
		fill="var(--stage-line)"
		opacity="0.5"
	/>
	<line
		x1={COL_X - 80}
		x2={COL_X + 80}
		y1={CEIL}
		y2={CEIL}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<line
		x1={COL_X}
		x2={COL_X}
		y1={CEIL - 14}
		y2={yHand}
		stroke="var(--osc-push)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	<!-- the hand: a block moving ±F₀/k, and the push arrow -->
	<rect
		x={COL_X - 28}
		y={yHand - 8}
		width="56"
		height="16"
		rx="5"
		fill="var(--osc-push)"
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>
	<Readout id="label-1">
		{@render txt(COL_X - 38, HAND - 2, 'your push', 12, {
			anchor: 'end',
			weight: 600,
			color: 'var(--osc-push)'
		})}
	</Readout>
	<Readout id="label-2">
		{@render txt(COL_X - 38, HAND + 13, `${f.toFixed(2)} Hz`, 11, { anchor: 'end', muted: true })}
	</Readout>
	{#if !reduced}
		{@const len = 26 * pushNow}
		{#if Math.abs(len) > 3}
			<line
				x1={COL_X + 46}
				x2={COL_X + 46}
				y1={HAND}
				y2={HAND + len}
				stroke="var(--osc-push)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d="M{COL_X + 40} {HAND + len - Math.sign(len) * 2} L{COL_X + 46} {HAND +
					len +
					Math.sign(len) * 7} L{COL_X + 52} {HAND + len - Math.sign(len) * 2} Z"
				fill="var(--osc-push)"
			/>
		{/if}
	{/if}

	<!-- rest mark -->
	<line
		x1={COL_X - 70}
		x2={COL_X + 70}
		y1={REST}
		y2={REST}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 5"
		opacity="0.6"
	/>
	<Readout id="label-3">
		{@render txt(COL_X - 76, REST + 4, 'rest', 12, { anchor: 'end', muted: true })}
	</Readout>

	<!-- spring and mass -->
	<path
		d={coil}
		fill="none"
		stroke="var(--osc-spring)"
		stroke-width="2.5"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	<rect
		x={COL_X - SIZE / 2}
		y={yMass - SIZE / 2}
		width={SIZE}
		height={SIZE}
		rx="7"
		fill="var(--osc-mass)"
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>
	<Readout id="mass-label">
		<text
			x={COL_X}
			y={yMass + 5}
			text-anchor="middle"
			font-weight="700"
			font-size="13"
			style:fill="#fff">1 kg</text
		>
	</Readout>
	{#if offScale}
		<Readout id="label-4">
			{@render txt(COL_X, 566, 'swing larger than drawn', 11, { anchor: 'middle', muted: true })}
		</Readout>
	{/if}

	<!-- trace -->
	<Plot
		{sx}
		{sy}
		{xTicks}
		yTicks={[-0.5, 0, 0.5]}
		xFormat={(v) => `${v} s`}
		yFormat={(v) => (v === 0 ? 'rest' : v < 0 ? '50 cm ↑' : '50 cm ↓')}
	/>
	<Readout id="label-5">
		{@render txt(PLOT_X0, TR.top - 12, 'position of the mass, from rest', 12, { muted: true })}
	</Readout>
	{#if !growing && (A * (TR.bottom - TR.top)) / (2 * TR.max) > 12 && A < TR.max}
		{#each [-A, A] as a (a)}
			<line
				x1={PLOT_X0}
				x2={PLOT_X1}
				y1={sy(a)}
				y2={sy(a)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="5 5"
			/>
		{/each}
		<Readout id="label-6">
			{@render txt(PLOT_X1, sy(-A) - 6, 'steady swing, predicted', 11, {
				anchor: 'end',
				muted: true
			})}
		</Readout>
	{/if}
	<g clip-path="url(#driven-trace)">
		<path
			d={tracePath}
			fill="none"
			stroke="var(--osc-trace)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
	</g>
	<circle
		cx={sx(tau)}
		cy={sy(Math.max(-TR.max, Math.min(TR.max, now)))}
		r="4.5"
		fill="var(--osc-trace)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- push step: how far the hand and the mass move -->
	{#if curveOn.current < 0.99}
		<g opacity={1 - curveOn.current}>
			<Readout id="label-7">
				{@render txt(PLOT_X0, CV.top - 14, 'How far each one moves, each way from rest', 12, {
					muted: true
				})}
			</Readout>
			<Readout id="label-8">
				{@render txt(PLOT_X0, CV.top + 18, 'the top of the spring (your push)', 12, {
					weight: 600
				})}
			</Readout>
			<rect
				x={PLOT_X0}
				y={CV.top + 26}
				width={bx(CV.max) - PLOT_X0}
				height="12"
				rx="6"
				fill="var(--stage-grid)"
			/>
			<rect
				x={PLOT_X0}
				y={CV.top + 26}
				width={bx(hand) - PLOT_X0}
				height="12"
				rx="6"
				fill="var(--osc-push)"
			/>
			<Readout id="label-9">
				{@render txt(bx(hand) + 8, CV.top + 37, fmtLen(hand), 12, { weight: 600 })}
			</Readout>
			<Readout id="label-10">
				{@render txt(PLOT_X0, CV.top + 72, 'the mass', 12, { weight: 600 })}
			</Readout>
			<rect
				x={PLOT_X0}
				y={CV.top + 80}
				width={bx(CV.max) - PLOT_X0}
				height="12"
				rx="6"
				fill="var(--stage-grid)"
			/>
			<rect
				x={PLOT_X0}
				y={CV.top + 80}
				width={Math.min(bx(CV.max), bx(swing)) - PLOT_X0}
				height="12"
				rx="6"
				fill="var(--osc-mass)"
			/>
			{#if !growing && A < CV.max}
				<line
					x1={bx(A)}
					x2={bx(A)}
					y1={CV.top + 74}
					y2={CV.top + 98}
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					stroke-dasharray="3 2"
				/>
			{/if}
			<Readout id="label-11">
				{@render txt(barLabel.x, barLabel.y, barText, 12, { weight: 600, anchor: barLabel.anchor })}
			</Readout>
			{#if !growing && A < CV.max}
				<Readout id="label-12">
					{@render txt(PLOT_X0, CV.top + 120, '┆ the steady swing it settles at', 11, {
						muted: true
					})}
				</Readout>
			{/if}
		</g>
	{/if}

	<!-- curve step: the resonance curve -->
	{#if curveOn.current > 0.01}
		<g opacity={curveOn.current}>
			<Plot
				sx={cx}
				sy={cy}
				xTicks={[0.5, 1, 1.5, 2, 2.5]}
				yTicks={[0, 0.2, 0.4, 0.6]}
				xFormat={(v) => (v === 2.5 ? '2.5 Hz' : String(v))}
				yFormat={(v) => `${Math.round(v * 100)} cm`}
			/>
			<Readout id="label-13">
				{@render txt(PLOT_X1, CV.top - 14, 'steady swing against push frequency', 12, {
					anchor: 'end',
					muted: true
				})}
			</Readout>
			<g clip-path="url(#driven-curve)">
				<path
					d={curvePath}
					fill="none"
					stroke="var(--osc-curve)"
					stroke-width="2.5"
					stroke-linejoin="round"
				/>
				{#each tried as p (p.f)}
					<circle
						class="tried"
						cx={cx(p.f)}
						cy={cy(Math.min(CV.max, p.a))}
						r="3.5"
						fill="var(--stage-bg)"
						stroke="var(--osc-trace)"
						stroke-width="2"
					/>
				{/each}
			</g>
			{#if tried.length}
				<Readout id="tried" label="○ pushes tried: the swing each settled to">
					<circle
						cx={PLOT_X0 + 5}
						cy={CV.top - 18}
						r="3.5"
						fill="var(--stage-bg)"
						stroke="var(--osc-trace)"
						stroke-width="2"
					/>
					{@render txt(PLOT_X0 + 14, CV.top - 14, 'pushes tried, as simulated', 12, {
						muted: true
					})}
				</Readout>
			{/if}
			<line
				x1={marker.x}
				x2={marker.x}
				y1={marker.y}
				y2={CV.bottom}
				stroke="var(--osc-push)"
				stroke-dasharray="3 3"
			/>
			<circle
				cx={marker.x}
				cy={marker.y}
				r="5.5"
				fill="var(--osc-push)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{#if c === 0 && !atPeak}
				<!-- on the axis: the label sits just above it, on the side away from the peak (and
				     from the stage's right edge) -->
				{@const left = f < fp || f > 1.9}
				<Readout id="label-14">
					{@render txt(
						marker.x + (left ? -10 : 10),
						CV.bottom - 24,
						'your push: never settles',
						12,
						{
							anchor: left ? 'end' : 'start',
							weight: 600,
							color: 'var(--osc-push)'
						}
					)}
				</Readout>
			{:else if !atPeak}
				<Readout id="label-15">
					{@render txt(
						marker.x + (f > 1.6 ? -10 : 10),
						Math.min(marker.y - 10, CV.bottom - 24),
						'your push',
						12,
						{
							anchor: f > 1.6 ? 'end' : 'start',
							weight: 600,
							color: 'var(--osc-push)'
						}
					)}
				</Readout>
			{/if}
			<Readout id="label-16">
				{@render txt(peakLabel.x, peakLabel.y, peakText, 12, {
					weight: 600,
					color: 'var(--osc-curve)'
				})}
			</Readout>
			{#if atPeak}
				<Readout id="label-17">
					{@render txt(peakLabel.x, peakLabel.y + 15, 'your push is right on it', 12, {
						weight: 600,
						color: 'var(--osc-push)'
					})}
				</Readout>
			{/if}
		</g>
	{/if}

	<!-- phones: the bars' and the curve's key numbers -->
	<Readout
		id="mass-moves"
		order={10}
		label="The mass moves"
		value="{(swing / hand).toFixed(1)}× your hand"
		color="var(--osc-trace)"
		opacity={1 - curveOn.current}
	/>
	<Readout
		id="peak"
		order={10}
		label="Resonance"
		value={peakText}
		note={atPeak ? 'your push is right on it' : undefined}
		opacity={curveOn.current}
	/>
	<Card {cells} />
</g>
