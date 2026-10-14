<script lang="ts">
	/**
	 * One patch of squid axon membrane under Hodgkin & Huxley's model (6.3 °C),
	 * with a current electrode inside.
	 *
	 * Left: the patch, with 4 sodium and 4 potassium channels drawn as
	 * symbols; how many are open follows the model's open probabilities
	 * (m³h for Na⁺, n⁴ for K⁺; inactivated Na⁺ channels, 1 − h, shown with
	 * their gate shut), and ions stream through the open ones. Right: the
	 * voltage, the injected current and (except in `charge`) the two
	 * conductances against time.
	 *
	 * Modes (`step.hints.mode`):
	 *   charge   — a small 0.5 ms pulse (slider `small`): the voltage jumps by
	 *              Q/C and leaks back
	 *   pulse    — a 0.5 ms pulse (slider `amp`): below or above threshold
	 *   channels — a pulse twice the threshold, with TTX / TEA toggles
	 *   pair     — two pulses twice the threshold, `gap` ms apart
	 *   steady   — a steady current (slider `steady`) from 5 ms
	 *
	 * The run is computed once per change of a control (a few ms); a cursor
	 * then sweeps it in slow motion (pure function of t), holds, and repeats.
	 * The run replays from the start when a control changes. Under reduced
	 * motion the whole trace is shown, the patch at the most telling moment.
	 */
	import { Axes, Label, clamp, cycle, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		HH,
		REST,
		firingRate,
		peak,
		pulse,
		simulate,
		spikeTimes,
		threshold,
		type Sample
	} from '../hh';
	import { replayClock } from './replay';

	let { step, t, params, reduced }: StageProps = $props();

	type Mode = 'charge' | 'pulse' | 'channels' | 'pair' | 'steady';
	const mode = $derived(String(step.hints?.mode ?? 'pulse') as Mode);
	const num = (id: string, d: number) => Number(params[id] ?? d);
	const small = $derived(num('small', 8));
	const amp = $derived(num('amp', 12));
	const gap = $derived(num('gap', 8));
	const steadyI = $derived(num('steady', 10));
	const ttx = $derived(Boolean(params.ttx));
	const tea = $derived(Boolean(params.tea));

	/** Threshold of a 0.5 ms pulse, µA/cm² (≈ 13.3), for the steps that use twice it. */
	const TH = threshold(0.5);
	const PULSE_AT = 2;

	const setup = $derived.by(() => {
		switch (mode) {
			case 'charge':
				return { tEnd: 15, current: pulse(small, PULSE_AT, 0.5), block: {} };
			case 'channels':
				return {
					tEnd: tea ? 40 : 20,
					current: pulse(2 * TH, PULSE_AT, 0.5),
					block: { na: ttx ? 0 : 1, k: tea ? 0 : 1 }
				};
			case 'pair':
				return {
					tEnd: 45,
					current: (x: number) =>
						pulse(2 * TH, PULSE_AT, 0.5)(x) + pulse(2 * TH, PULSE_AT + gap, 0.5)(x),
					block: {}
				};
			case 'steady':
				return { tEnd: 100, current: (x: number) => (x >= 5 ? steadyI : 0), block: {} };
			default:
				return { tEnd: 20, current: pulse(amp, PULSE_AT, 0.5), block: {} };
		}
	});
	const series = $derived(
		simulate({
			tEnd: setup.tEnd,
			current: setup.current,
			block: setup.block,
			every: setup.tEnd > 50 ? 0.1 : 0.05
		})
	);
	const spikes = $derived(spikeTimes(series));
	const top = $derived(peak(series));
	const rate = $derived(mode === 'steady' ? firingRate(steadyI) : 0);

	// ---- the cursor --------------------------------------------------------------------
	const LEAD = 0.6;
	const SWEEP = $derived(mode === 'charge' ? 5 : setup.tEnd > 30 ? 9 : 6);
	const HOLD = 3;
	const since = replayClock();
	const key = $derived(`${mode}|${small}|${amp}|${gap}|${steadyI}|${ttx}|${tea}`);
	const elapsed = $derived(since(key, t));
	/** Moment of the patch under reduced motion: the rising phase of the first spike, or the end. */
	const stillAt = $derived.by(() => {
		if (mode === 'charge') return PULSE_AT + 0.6;
		if (spikes.length && mode !== 'steady') return spikes[0];
		return setup.tEnd;
	});
	const u = $derived.by(() => {
		if (reduced) return 1;
		const p = elapsed % (LEAD + SWEEP + HOLD);
		return clamp((p - LEAD) / SWEEP);
	});
	const ms = $derived(reduced ? stillAt : u * setup.tEnd);
	const traceTo = $derived(reduced ? setup.tEnd : ms);
	const now = $derived.by(() => {
		const dt = series[1].t - series[0].t;
		return series[Math.min(series.length - 1, Math.max(0, Math.round(ms / dt)))];
	});
	const shown = $derived(series.filter((p) => p.t <= traceTo + 1e-9));

	// ---- charts ----------------------------------------------------------------------
	const CX0 = 400;
	const CX1 = 924;
	const VY = { y0: 64, y1: 300 };
	const IY = { y0: 340, y1: 384 };
	const GY = { y0: 438, y1: 548 };
	const sx = $derived(scale([0, setup.tEnd], [CX0, CX1]));
	/** The charge step zooms in on the few millivolts just above rest. */
	const vRange = $derived<[number, number]>(mode === 'charge' ? [-62, -52] : [-80, 60]);
	const syV = $derived(scale(vRange, [VY.y1, VY.y0]));
	const vTicks = $derived(
		mode === 'charge' ? [-62, -60, -58, -56, -54, -52] : [-80, -60, -40, -20, 0, 20, 40, 60]
	);
	const iMax = $derived(
		mode === 'charge' ? 12 : mode === 'steady' ? 30 : mode === 'pulse' ? 60 : 30
	);
	const syI = $derived(scale([0, iMax], [IY.y1, IY.y0]));
	const gMax = $derived(
		Math.max(10, Math.ceil(Math.max(...series.map((p) => Math.max(p.gNa, p.gK))) / 10) * 10)
	);
	const syG = $derived(scale([0, gMax], [GY.y1, GY.y0]));
	const xTicks = $derived(
		setup.tEnd <= 20
			? [0, 5, 10, 15, 20].filter((v) => v <= setup.tEnd)
			: setup.tEnd <= 45
				? [0, 10, 20, 30, 40]
				: [0, 20, 40, 60, 80, 100]
	);
	const showG = $derived(mode !== 'charge');
	const gFocus = $derived(mode === 'channels' ? 1 : 0.55);

	const vPath = $derived(
		linePath(
			shown,
			(p) => p.t,
			(p) => clamp(p.V, vRange[0] - 2, vRange[1] + 2),
			sx,
			syV
		)
	);
	const iPath = $derived(
		linePath(
			shown,
			(p) => p.t,
			(p) => Math.min(p.I, iMax),
			sx,
			syI
		)
	);
	const gNaPath = $derived(
		linePath(
			shown,
			(p) => p.t,
			(p) => p.gNa,
			sx,
			syG
		)
	);
	const gKPath = $derived(
		linePath(
			shown,
			(p) => p.t,
			(p) => p.gK,
			sx,
			syG
		)
	);

	// ---- the patch -------------------------------------------------------------------
	const PX0 = 24;
	const PX1 = 324;
	const OUT = { y0: 70, y1: 236 };
	const MEM = { y0: 236, y1: 278 };
	const IN = { y0: 278, y1: 470 };
	const N = 4;
	const naX = Array.from({ length: N }, (_, i) => PX0 + 42 + i * 70);
	const kX = naX.map((x) => x + 35);
	/** Gate states from the open probabilities: Na⁺ channel i is inactivated if i < N(1 − h), open by m³. */
	const naState = $derived.by(() => {
		const inact = Math.round(N * (1 - now.h));
		const open = Math.round(N * now.m ** 3 * now.h);
		return naX.map((_, i) =>
			setup.block.na === 0 ? 'blocked' : i >= N - inact ? 'inactive' : i < open ? 'open' : 'closed'
		);
	});
	const kOpen = $derived(setup.block.k === 0 ? -1 : Math.round(N * now.n ** 4));
	/** Ions streaming through open channels: Na⁺ down (in), K⁺ up (out). */
	const streams = $derived.by(() => {
		const out: { key: string; x: number; y: number; c: string; o: number }[] = [];
		const phaseT = reduced ? 2.5 : t;
		naState.forEach((s, i) => {
			if (s !== 'open') return;
			for (let k = 0; k < 3; k++) {
				const v = cycle(phaseT, 0.9, k / 3 + hash(i, 5));
				out.push({
					key: `na${i}-${k}`,
					x: naX[i],
					y: MEM.y0 - 40 + v * 120,
					c: 'var(--nr-na)',
					o: smoothstep(0, 0.15, v) * (1 - smoothstep(0.85, 1, v))
				});
			}
		});
		for (let i = 0; i < Math.max(0, kOpen); i++) {
			for (let k = 0; k < 3; k++) {
				const v = cycle(phaseT, 1.1, k / 3 + hash(i, 9));
				out.push({
					key: `k${i}-${k}`,
					x: kX[i],
					y: MEM.y1 + 40 - v * 120,
					c: 'var(--nr-k)',
					o: smoothstep(0, 0.15, v) * (1 - smoothstep(0.85, 1, v))
				});
			}
		}
		return out;
	});
	/** The charge on the inner face of the membrane: + when depolarised past 0 mV. */
	const injecting = $derived(now.I > 0.05);

	// ---- readouts ---------------------------------------------------------------------
	const fmt = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))} mV`;
	const done = $derived(reduced || u >= 1);
	const verdict = $derived.by(() => {
		switch (mode) {
			case 'charge': {
				const q = small * 0.5;
				const rise =
					Math.max(...series.filter((p) => p.t <= PULSE_AT + 0.6).map((p) => p.V)) - REST;
				return {
					at: PULSE_AT + 0.5,
					text: `charge in: ${q.toFixed(1)} nC/cm² → voltage up ${rise.toFixed(1)} mV`,
					sub: `Q ÷ C = ${q.toFixed(1)} mV, less what leaks out during the pulse`
				};
			}
			case 'pair':
				return {
					at: PULSE_AT + gap + 3,
					text: spikes.length >= 2 ? '2 pulses, 2 spikes' : '2 pulses, 1 spike',
					sub:
						spikes.length >= 2
							? 'the membrane had recovered'
							: 'the second came too soon: refractory'
				};
			case 'steady':
				return {
					at: 60,
					text:
						rate > 0
							? `${Math.round(rate)} spikes per second`
							: spikes.length
								? `${spikes.length} spike, then silence`
								: 'no spike',
					sub: rate > 0 ? 'keeps firing while the current is on' : 'too weak to keep firing'
				};
			default:
				return spikes.length
					? {
							at: top.t,
							text: `a spike: peak ${fmt(top.V)}`,
							sub:
								mode === 'channels' && tea
									? 'it cannot end quickly without K⁺ channels'
									: 'all or nothing'
						}
					: {
							at: PULSE_AT + 1,
							text: `no spike: up ${(top.V - REST).toFixed(1)} mV, back to rest`,
							sub: mode === 'channels' && ttx ? 'no sodium channels, no spike' : 'below threshold'
						};
		}
	});
	const verdictShow = $derived(done ? 1 : smoothstep(0, 0.4, ms - verdict.at));
	const titleI = $derived(
		mode === 'steady'
			? 'steady current'
			: mode === 'charge'
				? 'current pulse (0.5 ms)'
				: 'current pulses'
	);
</script>

<g class="spike">
	<!-- ===== the patch ===== -->
	<rect
		x={PX0}
		y={OUT.y0}
		width={PX1 - PX0}
		height={OUT.y1 - OUT.y0}
		rx="10"
		fill="var(--nr-outside)"
	/>
	<rect
		x={PX0}
		y={IN.y0}
		width={PX1 - PX0}
		height={IN.y1 - IN.y0}
		rx="10"
		fill="var(--nr-inside)"
	/>
	<rect x={PX0} y={MEM.y0} width={PX1 - PX0} height={MEM.y1 - MEM.y0} fill="var(--membrane)" />
	<Readout id="p-out">
		<Label x={PX0 + 12} y={OUT.y0 + 20} anchor="start" size={12} text="outside" />
	</Readout>
	<Readout id="p-in">
		<Label x={PX0 + 12} y={IN.y1 - 12} anchor="start" size={12} text="inside the axon" />
	</Readout>

	<!-- charge on the membrane faces -->
	{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
		{@const show = clamp(Math.abs(now.V) / 60) > k / 8}
		{#if show}
			<text
				x={PX0 + 22 + k * 38}
				y={MEM.y0 - 5}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				fill="var(--stage-ink)">{now.V < 0 ? '+' : '−'}</text
			>
			<text
				x={PX0 + 22 + k * 38}
				y={MEM.y1 + 14}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				fill="var(--stage-ink)">{now.V < 0 ? '−' : '+'}</text
			>
		{/if}
	{/each}

	<!-- channels -->
	{#each naX as x, i (x)}
		{@const s = naState[i]}
		<g opacity={s === 'closed' ? 0.55 : 1}>
			<rect
				x={x - 11}
				y={MEM.y0 - 8}
				width="8"
				height={MEM.y1 - MEM.y0 + 16}
				rx="3"
				fill="var(--nr-na)"
			/>
			<rect
				x={x + 3}
				y={MEM.y0 - 8}
				width="8"
				height={MEM.y1 - MEM.y0 + 16}
				rx="3"
				fill="var(--nr-na)"
			/>
			{#if s === 'closed' || s === 'blocked'}
				<rect x={x - 4} y={MEM.y0 + 10} width="8" height="6" fill="var(--nr-na)" />
			{/if}
			{#if s === 'inactive'}
				<circle
					cx={x}
					cy={MEM.y1 + 4}
					r="5"
					fill="var(--nr-na)"
					stroke="var(--stage-bg)"
					stroke-width="1"
				/>
			{/if}
			{#if s === 'blocked'}
				<circle cx={x} cy={MEM.y0 - 10} r="6" fill="var(--stage-ink-muted)" />
			{/if}
		</g>
	{/each}
	{#each kX as x, i (x)}
		{@const open = i < kOpen}
		<g opacity={open ? 1 : 0.55}>
			<rect
				x={x - 11}
				y={MEM.y0 - 8}
				width="8"
				height={MEM.y1 - MEM.y0 + 16}
				rx="3"
				fill="var(--nr-k)"
			/>
			<rect
				x={x + 3}
				y={MEM.y0 - 8}
				width="8"
				height={MEM.y1 - MEM.y0 + 16}
				rx="3"
				fill="var(--nr-k)"
			/>
			{#if !open}
				<rect x={x - 4} y={MEM.y1 - 16} width="8" height="6" fill="var(--nr-k)" />
			{/if}
			{#if kOpen < 0}
				<circle cx={x} cy={MEM.y1 + 10} r="6" fill="var(--stage-ink-muted)" />
			{/if}
		</g>
	{/each}
	{#each streams as s (s.key)}
		<circle
			cx={s.x}
			cy={s.y}
			r="4.5"
			fill={s.c}
			stroke="var(--stage-bg)"
			stroke-width="1"
			opacity={s.o}
		/>
	{/each}

	<!-- electrode -->
	<path
		d="M{PX1 - 18} {IN.y1 - 8} L{PX1 - 66} {IN.y0 + 64}"
		stroke="var(--stage-ink-muted)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<circle
		cx={PX1 - 66}
		cy={IN.y0 + 64}
		r={injecting ? 9 : 4}
		fill="var(--nr-fire)"
		opacity={injecting ? 0.9 : 0.4}
	/>
	<Readout id="electrode">
		<Label x={PX1 - 76} y={IN.y0 + 52} anchor="end" size={11} muted text="current electrode" />
	</Readout>

	<!-- patch legend -->
	<Readout id="legend-na" order={10} label="Sodium channels" color="var(--nr-na)">
		<rect x={PX0 + 4} y={500} width="10" height="12" rx="2" fill="var(--nr-na)" />
		<Label
			x={PX0 + 20}
			y={510}
			anchor="start"
			size={12}
			text="Na⁺ channels: {naState.filter((s) => s === 'open').length} open, {naState.filter(
				(s) => s === 'inactive'
			).length} inactivated"
		/>
	</Readout>
	<Readout id="legend-k" order={11} label="Potassium channels" color="var(--nr-k)">
		<rect x={PX0 + 4} y={524} width="10" height="12" rx="2" fill="var(--nr-k)" />
		<Label
			x={PX0 + 20}
			y={534}
			anchor="start"
			size={12}
			text="K⁺ channels: {Math.max(0, kOpen)} open"
		/>
	</Readout>
	<Readout id="symbols">
		<Label
			x={PX0 + 4}
			y={562}
			anchor="start"
			size={11}
			muted
			text="channels drawn as symbols; numbers follow the model"
		/>
	</Readout>

	<!-- ===== charts ===== -->
	<Axes
		{sx}
		sy={syV}
		{xTicks}
		yTicks={vTicks}
		yFormat={(v) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'))}
	/>
	<Readout id="v-title">
		<Label x={CX0} y={VY.y0 - 14} anchor="start" size={12} text="voltage inside (mV)" />
	</Readout>
	{#if mode === 'pulse'}
		<line
			x1={CX0}
			x2={CX1}
			y1={syV(REST + 6.6)}
			y2={syV(REST + 6.6)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<Readout id="th">
			<Label
				x={CX1 - 4}
				y={syV(REST + 6.6) + 15}
				anchor="end"
				size={11}
				muted
				text="threshold for a short pulse ≈ −53 mV"
			/>
		</Readout>
	{/if}
	{#if mode === 'channels'}
		{#each [{ v: HH.ENa, c: 'var(--nr-na)', l: 'Na⁺ balance +55 mV' }, { v: HH.EK, c: 'var(--nr-k)', l: 'K⁺ balance −72 mV' }] as e (e.l)}
			<line
				x1={CX0}
				x2={CX1}
				y1={syV(e.v)}
				y2={syV(e.v)}
				stroke={e.c}
				stroke-dasharray="5 4"
				opacity="0.7"
			/>
			<Readout id="e-{e.v}">
				<Label
					x={CX1 - 4}
					y={syV(e.v) + (e.v > 0 ? -6 : 15)}
					anchor="end"
					size={11}
					color={e.c}
					text={e.l}
				/>
			</Readout>
		{/each}
	{/if}
	<path d={vPath} fill="none" stroke="var(--nr-v)" stroke-width="2.5" stroke-linejoin="round" />
	{#if !reduced}
		<line
			x1={sx(ms)}
			x2={sx(ms)}
			y1={VY.y0}
			y2={GY.y1}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity={u > 0 && u < 1 ? 0.5 : 0}
		/>
	{/if}
	<Readout id="now" order={1} label="Voltage" value={fmt(now.V)} color="var(--nr-v)">
		<Label
			x={PX0 + 160}
			y={OUT.y0 - 18}
			size={15}
			weight={700}
			color="var(--nr-v)"
			text="voltage inside: {fmt(now.V)}"
		/>
	</Readout>
	<Readout
		id="verdict"
		order={2}
		label="Result"
		value={verdict.text}
		note={verdict.sub}
		opacity={verdictShow}
	>
		<g opacity={verdictShow}>
			<Label x={CX1} y={VY.y0 - 30} anchor="end" size={14} weight={700} text={verdict.text} />
			<Label x={CX1} y={VY.y0 - 12} anchor="end" size={11} muted text={verdict.sub} />
		</g>
	</Readout>

	<!-- injected current -->
	<line x1={CX0} x2={CX1} y1={IY.y1} y2={IY.y1} stroke="var(--stage-line)" />
	<path d={iPath} fill="none" stroke="var(--nr-fire)" stroke-width="2" stroke-linejoin="round" />
	<Readout id="i-title">
		<Label x={CX0} y={IY.y0 - 4} anchor="start" size={11} muted text="{titleI} (µA/cm²)" />
	</Readout>

	{#if showG}
		<g opacity={gFocus}>
			<Axes {sx} sy={syG} {xTicks} yTicks={[0, gMax / 2, gMax]} xLabel="time (ms)" />
			<path d={gNaPath} fill="none" stroke="var(--nr-na)" stroke-width="2.2" />
			<path d={gKPath} fill="none" stroke="var(--nr-k)" stroke-width="2.2" />
			<Readout id="g-title">
				<Label
					x={CX0}
					y={GY.y0 - 14}
					anchor="start"
					size={12}
					text="open channels: conductance (mS/cm²)"
				/>
				<Label x={CX1} y={GY.y0 - 14} anchor="end" size={12} color="var(--nr-na)" text="Na⁺" />
				<Label x={CX1 - 34} y={GY.y0 - 14} anchor="end" size={12} color="var(--nr-k)" text="K⁺" />
			</Readout>
		</g>
	{:else}
		<Readout id="x-title">
			<Label
				x={CX1}
				y={IY.y1 + 22}
				anchor="end"
				size={11}
				muted
				text="0 – {setup.tEnd} ms after the start"
			/>
		</Readout>
		<Readout
			id="circuit"
			order={3}
			label="Circuit"
			value="capacitor (1 µF/cm²) in parallel with the channels (resistors)"
		>
			<g transform="translate(560 440)">
				<!-- the membrane as a circuit: capacitor in parallel with a resistor and battery -->
				<path d="M0 0 H200 M0 100 H200" stroke="var(--stage-ink)" stroke-width="1.5" fill="none" />
				<path
					d="M40 0 V42 M20 42 H60 M20 58 H60 M40 58 V100"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					fill="none"
				/>
				<path
					d="M160 0 V20 L150 25 L170 32 L150 39 L170 46 L150 53 L160 58 V70 M150 70 H170 M155 78 H165 M160 78 V100"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					fill="none"
				/>
				<Label x={-8} y={54} anchor="end" size={11} muted text="membrane: C" />
				<Label x={182} y={44} anchor="start" size={11} muted text="channels: R" />
				<Label x={100} y={-10} size={11} muted text="outside" />
				<Label x={100} y={118} size={11} muted text="inside" />
			</g>
		</Readout>
	{/if}
</g>
