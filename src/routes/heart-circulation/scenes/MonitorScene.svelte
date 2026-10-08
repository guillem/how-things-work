<script lang="ts">
	/**
	 * The heart beside a bedside monitor: the ECG and the pressures in the left
	 * ventricle, the aorta and the left atrium, scrolling, all from the same
	 * simulated beat, and a readout card.
	 *
	 * Phases (`step.hints.phase`):
	 *   signal   — the conduction system lit up on the heart (sinoatrial node,
	 *              AV node, bundle), P / QRS / T named on the ECG; timings
	 *   pressure — the pressure plot in focus, with the moments the aortic
	 *              valve is open (blood out) and the mitral valve is open
	 *              (filling) shaded; blood pressure readouts
	 *   rate     — heart rate from the slider; stroke volume, output, oxygen
	 *   narrow   — artery width from the slider; the healthy curves dashed
	 *   leak     — leaky valve and its gap from the controls; the backward jet
	 *              on the heart; the healthy curves dashed
	 *
	 * Time: a beat clock integrated from the rate (`beatClock`), so changing
	 * the rate never makes the heart jump; the traces are the last W seconds
	 * of that clock, drawn from the current steady beat. Reduced motion: a
	 * frozen frame in the middle of ejection.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		LA,
		LV,
		NORMAL,
		SA,
		bodyResistance,
		ecgWaves,
		steadyBeat,
		valveEvents,
		type Beat
	} from '../circulation';
	import Card from './Card.svelte';
	import Heart from './Heart.svelte';
	import { NODES, at, beatClock, settingsFor, type Cell } from './heart';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'signal'));
	const settings = $derived(settingsFor(step, params));
	const current = $derived(steadyBeat(settings));
	const beat = $derived(current.beat);
	const m = $derived(current.summary);
	const healthy = steadyBeat(NORMAL);
	const compare = $derived(phase === 'narrow' || phase === 'leak');
	const T = $derived(beat.timing);

	const clock = beatClock();
	const frozen = $derived.by(() => {
		const { open, close } = valveEvents(beat, 'aortic');
		return 3 + ((open[0] ?? 0) + (close[0] ?? 0)) / 2 / T.rr;
	});
	const beats = $derived(reduced ? frozen : clock(t, T.rr));

	// ---- layout ------------------------------------------------------------------
	const HX = 16;
	const HY = 66;
	const HS = 0.9;
	const X = (lx: number) => HX + HS * lx;
	const Y = (ly: number) => HY + HS * ly;
	const P0 = 530; // plots' left edge
	const P1 = 930; // "now"
	const W = 2.4; // seconds on screen
	const ECG = { top: 44, bottom: 150, lo: -0.45, hi: 1.3 };
	const PR = { top: 196, bottom: 430 };

	const sx = (ago: number) => P1 - ((P1 - P0) * ago) / W;
	const ey = (mv: number) =>
		ECG.bottom - ((mv - ECG.lo) / (ECG.hi - ECG.lo)) * (ECG.bottom - ECG.top);

	// Pressure axis: grows smoothly when the pressures do.
	const yMaxTarget = $derived(Math.max(140, Math.ceil((m.lvMax + 12) / 40) * 40));
	const yMax = new Tween(140, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = yMaxTarget;
		untrack(() => yMax.set(v));
	});
	const py = (mmHg: number) =>
		PR.bottom - (Math.max(0, mmHg) / yMax.current) * (PR.bottom - PR.top);
	const yTicks = $derived(
		Array.from({ length: 8 }, (_, i) => i * (yMax.current > 200 ? 80 : 40)).filter(
			(v) => v <= yMax.current
		)
	);

	// ---- traces --------------------------------------------------------------------
	const N = 360;
	function trace(b: Beat, series: Float64Array, map: (v: number) => number) {
		let d = '';
		for (let i = 0; i <= N; i++) {
			const ago = (W * i) / N;
			const v = at(b, series, beats - ago / b.timing.rr);
			d += `${i ? 'L' : 'M'}${sx(ago).toFixed(1)} ${map(v).toFixed(1)}`;
		}
		return d;
	}
	const ecgPath = $derived(trace(beat, beat.ecg, ey));
	const ecgNow = $derived(at(beat, beat.ecg, beats));
	const lvPath = $derived(trace(beat, beat.p[LV], py));
	const aoPath = $derived(trace(beat, beat.p[SA], py));
	const laPath = $derived(trace(beat, beat.p[LA], py));
	const lvHealthy = $derived(compare ? trace(healthy.beat, healthy.beat.p[LV], py) : '');
	const aoHealthy = $derived(compare ? trace(healthy.beat, healthy.beat.p[SA], py) : '');

	/** Spans of the window during which a valve lets blood forward. */
	function openSpans(flow: Float64Array) {
		const spans: { id: number; a: number; b: number }[] = [];
		let start = -1;
		for (let i = 0; i <= N; i++) {
			const ago = (W * i) / N;
			const open = at(beat, flow, beats - ago / T.rr) > 0.5;
			if (open && start < 0) start = ago;
			if ((!open || i === N) && start >= 0) {
				spans.push({ id: Math.round(start * 1000), a: start, b: ago });
				start = -1;
			}
		}
		return spans;
	}
	const ejecting = $derived(openSpans(beat.flow.aortic));
	const filling = $derived(openSpans(beat.flow.mitral));

	// ECG wave names over the most recent complete set of waves on screen.
	const waveMarks = $derived.by(() => {
		const w = ecgWaves(T);
		const frac = beats - Math.floor(beats);
		const start = frac >= w.t / T.rr ? Math.floor(beats) : Math.floor(beats) - 1;
		const out: { id: string; x: number; y: number; anchor: string }[] = [];
		for (const [id, when, mv, dx, anchor] of [
			['P', w.p, 0.15, 0, 'middle'],
			['QRS', w.r, 1.2, 7, 'start'],
			['T', w.t, 0.3, 0, 'middle']
		] as const) {
			const ago = (beats - start - when / T.rr) * T.rr;
			if (ago >= 0 && ago <= W)
				out.push({ id, x: sx(ago) + dx, y: ey(mv) + (id === 'QRS' ? 10 : -9), anchor });
		}
		return out;
	});

	// ---- readouts -----------------------------------------------------------------------
	const bp = (s: { sys: number; dia: number }) => `${Math.round(s.sys)}/${Math.round(s.dia)}`;
	const h = healthy.summary;
	const cells: Cell[] = $derived.by(() => {
		switch (phase) {
			case 'signal':
				return [
					{
						id: 'hr',
						label: 'heart rate',
						value: `${m.hr}/min`,
						sub: `a beat every ${T.rr.toFixed(2)} s`
					},
					{
						id: 'pr',
						label: 'P to QRS',
						value: `${T.pr.toFixed(2)} s`,
						sub: 'AV node delay'
					},
					{
						id: 'qt',
						label: 'QRS to end of T',
						value: `${T.qt.toFixed(2)} s`,
						sub: 'ventricles on'
					},
					{
						id: 'sync',
						label: 'two pumps',
						value: 'in step',
						sub: 'one signal',
						color: 'var(--hc-signal)'
					}
				];
			case 'pressure':
				return [
					{
						id: 'bp',
						label: 'blood pressure',
						value: bp(m.aorta),
						sub: 'systolic/diastolic',
						color: 'var(--hc-oxy)'
					},
					{
						id: 'lv',
						label: 'left ventricle',
						value: `${Math.round(m.lvMax)}`,
						sub: 'mmHg at its peak',
						color: 'var(--hc-lv)'
					},
					{
						id: 'la',
						label: 'left atrium',
						value: `${Math.round(m.laMean)}`,
						sub: 'mmHg, average',
						color: 'var(--hc-la)'
					},
					{ id: 'pa', label: 'lung artery', value: bp(m.lungArtery), sub: 'right side, mmHg' }
				];
			case 'rate':
				return [
					{ id: 'hr', label: 'heart rate', value: `${m.hr}/min`, sub: 'beats per minute' },
					{
						id: 'sv',
						label: 'stroke volume',
						value: `${Math.round(m.stroke)} mL`,
						sub: 'per beat',
						color: 'var(--hc-lv)'
					},
					{
						id: 'co',
						label: 'cardiac output',
						value: `${m.output.toFixed(1)} L/min`,
						sub: 'rate × stroke vol.',
						color: 'var(--hc-oxy)'
					},
					{
						id: 'o2',
						label: 'blood coming back',
						value: `${Math.round(m.venousO2 * 100)}% O₂`,
						sub: 'left lungs at 98%',
						color: 'var(--hc-deoxy)'
					}
				];
			case 'narrow':
				return [
					{
						id: 'r',
						label: 'resistance',
						value: `×${(bodyResistance(settings.width) / bodyResistance(1)).toFixed(2)}`,
						sub: `arteries ${Math.round(settings.width * 100)}% wide`
					},
					{
						id: 'bp',
						label: 'blood pressure',
						value: bp(m.aorta),
						sub: `healthy ${bp(h.aorta)}`,
						color: 'var(--hc-oxy)'
					},
					{
						id: 'sv',
						label: 'stroke volume',
						value: `${Math.round(m.stroke)} mL`,
						sub: `healthy ${Math.round(h.stroke)} mL`,
						color: 'var(--hc-lv)'
					},
					{
						id: 'co',
						label: 'cardiac output',
						value: `${m.output.toFixed(1)} L/min`,
						sub: `healthy ${h.output.toFixed(1)}`
					}
				];
			default: {
				const total = m.stroke + m.backflow;
				return [
					{
						id: 'back',
						label: 'leaks back',
						value: `${Math.round(m.backflow)} mL`,
						sub: total > 0 ? `${Math.round((100 * m.backflow) / total)}% of each beat` : '',
						color: 'var(--hc-leak)'
					},
					{
						id: 'sv',
						label: 'goes forward',
						value: `${Math.round(m.stroke)} mL`,
						sub: `healthy ${Math.round(h.stroke)} mL`
					},
					settings.valve === 'mitral'
						? {
								id: 'la',
								label: 'left atrium',
								value: `${m.laMean.toFixed(1)} mmHg`,
								sub: `healthy ${h.laMean.toFixed(1)}`,
								color: 'var(--hc-la)'
							}
						: {
								id: 'bp',
								label: 'blood pressure',
								value: bp(m.aorta),
								sub: `healthy ${bp(h.aorta)}`,
								color: 'var(--hc-oxy)'
							},
					{
						id: 'edv',
						label: 'ventricle fills to',
						value: `${Math.round(m.edv)} mL`,
						sub: `healthy ${Math.round(h.edv)} mL`,
						color: 'var(--hc-lv)'
					}
				];
			}
		}
	});

	const legend = $derived([
		{ id: 'poor', label: 'oxygen-poor blood', color: 'var(--hc-deoxy)' },
		{ id: 'rich', label: 'oxygen-rich blood', color: 'var(--hc-oxy)' },
		phase === 'leak'
			? { id: 'leak', label: 'blood leaking back', color: 'var(--hc-leak)' }
			: { id: 'signal', label: 'electrical signal', color: 'var(--hc-signal)' }
	]);

	const ecgFocus = $derived(phase === 'signal' ? 1 : 0.55);
	const pressureFocus = $derived(phase === 'signal' ? 0.4 : 1);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<Heart {beat} {beats} x={HX} y={HY} scale={HS} signal={phase === 'signal' ? 1 : 0.3} />

	{#if phase === 'signal'}
		<line
			x1={X(NODES.sa.x) - 5}
			y1={Y(NODES.sa.y) - 4}
			x2={X(60)}
			y2={Y(20)}
			stroke="var(--stage-ink-muted)"
		/>
		<Label x={30} y={Y(14)} text="sinoatrial node (pacemaker)" pill anchor="start" />
		<line
			x1={X(NODES.av.x) + 4}
			y1={Y(NODES.av.y) + 6}
			x2={X(222)}
			y2={Y(300)}
			stroke="var(--stage-ink-muted)"
		/>
		<Label x={X(222)} y={Y(316)} text="AV node" pill anchor="middle" />
	{/if}

	<!-- ECG -->
	<g opacity={ecgFocus}>
		{@render txt(P0, ECG.top - 16, 'ECG: the electrical signal', 13, {
			weight: 600,
			color: 'var(--hc-ecg)'
		})}
		<rect
			x={P0}
			y={ECG.top}
			width={P1 - P0}
			height={ECG.bottom - ECG.top}
			rx="6"
			fill="var(--stage-grid)"
			opacity="0.35"
		/>
		<line x1={P0} x2={P1} y1={ey(0)} y2={ey(0)} stroke="var(--stage-grid)" />
		<path d={ecgPath} fill="none" stroke="var(--hc-ecg)" stroke-width="2" stroke-linejoin="round" />
		<circle cx={P1} cy={ey(ecgNow)} r="4" fill="var(--hc-ecg)" />
		{#if phase === 'signal'}
			{#each waveMarks as w (w.id)}
				{@render txt(w.x, w.y, w.id, 12, { anchor: w.anchor, weight: 700 })}
			{/each}
		{/if}
	</g>

	<!-- pressures -->
	<g opacity={pressureFocus}>
		{@render txt(P0, PR.top - 16, 'pressure (mmHg)', 13, { weight: 600 })}
		{#each ejecting as s (s.id)}
			<rect
				x={sx(s.b)}
				y={PR.top}
				width={Math.max(0, sx(s.a) - sx(s.b))}
				height={PR.bottom - PR.top}
				fill="var(--hc-oxy)"
				opacity="0.1"
			/>
		{/each}
		{#each filling as s (s.id)}
			<rect
				x={sx(s.b)}
				y={PR.top}
				width={Math.max(0, sx(s.a) - sx(s.b))}
				height={PR.bottom - PR.top}
				fill="var(--hc-la)"
				opacity="0.1"
			/>
		{/each}
		{#each yTicks as v (v)}
			<line x1={P0} x2={P1} y1={py(v)} y2={py(v)} stroke="var(--stage-grid)" />
			<text x={P0 - 8} y={py(v) + 4} text-anchor="end" class="muted" style:font-size="11px"
				>{v}</text
			>
		{/each}
		<line x1={P0} x2={P0} y1={PR.top} y2={PR.bottom} stroke="var(--stage-line)" />
		<line x1={P0} x2={P1} y1={PR.bottom} y2={PR.bottom} stroke="var(--stage-line)" />
		{#if compare}
			<path
				d={lvHealthy}
				fill="none"
				stroke="var(--hc-lv)"
				stroke-width="1.5"
				stroke-dasharray="5 5"
				opacity="0.6"
			/>
			<path
				d={aoHealthy}
				fill="none"
				stroke="var(--hc-oxy)"
				stroke-width="1.5"
				stroke-dasharray="5 5"
				opacity="0.6"
			/>
		{/if}
		<path d={laPath} fill="none" stroke="var(--hc-la)" stroke-width="2" stroke-dasharray="6 3" />
		<path d={aoPath} fill="none" stroke="var(--hc-oxy)" stroke-width="2.5" />
		<path d={lvPath} fill="none" stroke="var(--hc-lv)" stroke-width="2.5" />
		{@render txt(P0 + 4, PR.bottom + 22, 'left ventricle', 12, {
			weight: 600,
			color: 'var(--hc-lv)'
		})}
		{@render txt(P0 + 100, PR.bottom + 22, 'aorta', 12, { weight: 600, color: 'var(--hc-oxy)' })}
		{@render txt(P0 + 146, PR.bottom + 22, 'left atrium', 12, {
			weight: 600,
			color: 'var(--hc-la)'
		})}
		{#if compare}
			{@render txt(P1, PR.bottom + 22, 'dashed: healthy heart', 12, { anchor: 'end', muted: true })}
		{:else if phase === 'pressure'}
			{@render txt(P1, PR.bottom + 22, 'shaded: valve open', 12, { anchor: 'end', muted: true })}
		{/if}
	</g>

	<!-- key to the heart drawing -->
	{#each legend as k, i (k.id)}
		{@const x = 30 + (i % 2) * 200}
		{@const y = 532 + Math.floor(i / 2) * 26}
		<rect {x} y={y - 11} width="14" height="14" rx="3" fill={k.color} />
		{@render txt(x + 22, y + 1, k.label, 12, { muted: true })}
	{/each}

	<Card x={470} y={476} w={474} h={100} {cells} />
</g>
