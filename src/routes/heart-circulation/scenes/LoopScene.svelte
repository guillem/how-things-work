<script lang="ts">
	/**
	 * The whole circulation: the heart (small, centre) with the lung circuit
	 * above and the body circuit below. Blood cells travel round both loops,
	 * moved by the volume each ventricle pumps (so they surge with every beat),
	 * and change colour as they cross the lungs (picking up oxygen) and the
	 * body (giving it up). Saturations and pressures from the model.
	 *
	 * Phases (`step.hints.phase`):
	 *   loop    — at rest; a panel with the volume each pump sends per beat
	 *   summary — heart rate from the slider; a small ECG strip: one signal,
	 *             both pumps
	 *
	 * Time: the beat clock (`beatClock`); reduced motion freezes mid-ejection.
	 */
	import { along, pathFrom, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { steadyBeat, valveEvents } from '../circulation';
	import Heart from './Heart.svelte';
	import { at, beatClock, passedAt, settingsFor } from './heart';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'loop'));
	const settings = $derived(settingsFor(step, params));
	const current = $derived(steadyBeat(settings));
	const beat = $derived(current.beat);
	const m = $derived(current.summary);
	const T = $derived(beat.timing);

	const clock = beatClock();
	const frozen = $derived.by(() => {
		const { open, close } = valveEvents(beat, 'aortic');
		return 3 + ((open[0] ?? 0) + (close[0] ?? 0)) / 2 / T.rr;
	});
	const beats = $derived(reduced ? frozen : clock(t, T.rr));

	// ---- layout ------------------------------------------------------------------
	const HX = 337;
	const HY = 160;
	const HS = 0.62;
	const X = (lx: number) => HX + HS * lx;
	const Y = (ly: number) => HY + HS * ly;

	const LUNGS = { x: 300, y: 24, w: 380, h: 100 };
	const BODY = { x: 250, y: 474, w: 510, h: 104 };

	const wavy = (x0: number, x1: number, base: number, rise: number, n = 48): Point[] =>
		Array.from({ length: n + 1 }, (_, i) => {
			const u = i / n;
			const s = Math.sin(Math.PI * u);
			return { x: x0 + (x1 - x0) * u, y: base - rise * s + 9 * Math.sin(7 * Math.PI * u) * s };
		});

	// Lung circuit: lung artery → capillaries → lung veins.
	const lungPre: Point[] = [
		{ x: X(194), y: Y(40) },
		{ x: X(194), y: 136 },
		{ x: 352, y: 136 },
		{ x: 340, y: 112 }
	];
	const lungBed = wavy(340, 640, 112, 54);
	const lungPost: Point[] = [
		{ x: 640, y: 112 },
		{ x: 652, y: 136 },
		{ x: 700, y: 136 },
		{ x: 700, y: Y(221) },
		{ x: X(452), y: Y(221) }
	];
	// Body circuit: aorta → capillaries → veins → superior vena cava.
	const AY = 268;
	const bodyPre: Point[] = [
		{ x: X(418), y: Y(138) },
		{ x: X(418), y: AY },
		{ x: 744, y: AY },
		{ x: 744, y: 498 },
		{ x: 726, y: 506 }
	];
	const bodyBed = wavy(726, 286, 506, -40);
	const bodyPost: Point[] = [
		{ x: 286, y: 506 },
		{ x: 214, y: 506 },
		{ x: 214, y: 150 },
		{ x: X(95), y: 150 },
		{ x: X(95), y: Y(34) }
	];

	const len = (p: Point[]) =>
		p.slice(1).reduce((s, q, i) => s + Math.hypot(q.x - p[i].x, q.y - p[i].y), 0);
	function loop(pre: Point[], bed: Point[], post: Point[]) {
		const all = [...pre, ...bed.slice(1), ...post.slice(1)];
		const total = len(all);
		return { all, total, a: len(pre) / total, b: (len(pre) + len(bed)) / total };
	}
	const lung = loop(lungPre, lungBed, lungPost);
	const body = loop(bodyPre, bodyBed, bodyPost);

	// ---- blood cells ----------------------------------------------------------------
	const PX_PER_ML = 1.4;
	const NL = 16;
	const NB = 30;
	function cells(l: typeof lung, n: number, moved: number, oxyFirst: boolean) {
		const shift = (moved * PX_PER_ML) / l.total;
		return Array.from({ length: n }, (_, i) => {
			let u = (i / n + shift) % 1;
			if (u < 0) u += 1;
			const p = along(l.all, u);
			// Oxygen picked up (lungs) or given up (body) across the capillary bed.
			const k = Math.min(1, Math.max(0, (u - l.a) / (l.b - l.a)));
			const oxy = oxyFirst ? 1 - k : k;
			return { i, x: p.x, y: p.y, oxy };
		});
	}
	const lungCells = $derived(cells(lung, NL, passedAt(beat, 'pulmonary', beats), false));
	const bodyCells = $derived(cells(body, NB, passedAt(beat, 'aortic', beats), true));
	const mix = (oxy: number) =>
		`color-mix(in oklab, var(--hc-oxy) ${Math.round(oxy * 100)}%, var(--hc-deoxy))`;

	// ---- ECG strip (summary) ---------------------------------------------------------------
	const E = { x0: 24, x1: 190, top: 330, bottom: 400 };
	const W = 2.4;
	const ecgPath = $derived.by(() => {
		let d = '';
		const n = 160;
		for (let i = 0; i <= n; i++) {
			const ago = (W * i) / n;
			const v = at(beat, beat.ecg, beats - ago / T.rr);
			const x = E.x1 - ((E.x1 - E.x0) * ago) / W;
			const y = E.bottom - 12 - ((v + 0.4) / 1.7) * (E.bottom - E.top - 14);
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});

	const bp = (s: { sys: number; dia: number }) => `${Math.round(s.sys)}/${Math.round(s.dia)}`;
	const rows = $derived([
		{
			id: 'r',
			label: 'right pump → lungs',
			value: `${Math.round(m.strokeRight)} mL`,
			color: 'var(--hc-deoxy)'
		},
		{
			id: 'l',
			label: 'left pump → body',
			value: `${Math.round(m.stroke)} mL`,
			color: 'var(--hc-oxy)'
		}
	]);
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

{#snippet chip(x: number, y: number, text: string, color: string)}
	<rect
		x={x - 4}
		y={y - 15}
		width={text.length * 7 + 14}
		height="22"
		rx="11"
		fill="var(--surface)"
		stroke={color}
		stroke-width="1.5"
	/>
	<text x={x + 3} {y} font-weight="700" style:font-size="12px" style:fill={color}>{text}</text>
{/snippet}

<g>
	<defs>
		<linearGradient
			id="loop-lung-grad"
			gradientUnits="userSpaceOnUse"
			x1="340"
			x2="640"
			y1="0"
			y2="0"
		>
			<stop offset="0" stop-color="var(--hc-deoxy)" />
			<stop offset="1" stop-color="var(--hc-oxy)" />
		</linearGradient>
		<linearGradient
			id="loop-body-grad"
			gradientUnits="userSpaceOnUse"
			x1="726"
			x2="286"
			y1="0"
			y2="0"
		>
			<stop offset="0" stop-color="var(--hc-oxy)" />
			<stop offset="1" stop-color="var(--hc-deoxy)" />
		</linearGradient>
	</defs>

	<!-- lungs and body -->
	<rect
		x={LUNGS.x}
		y={LUNGS.y}
		width={LUNGS.w}
		height={LUNGS.h}
		rx="40"
		fill="var(--hc-lung)"
		stroke="var(--border)"
	/>
	{@render txt(LUNGS.x + 24, LUNGS.y + 26, 'lungs', 14, { weight: 700 })}
	{@render txt(LUNGS.x + LUNGS.w - 24, LUNGS.y + 26, 'O₂ in, CO₂ out', 12, {
		anchor: 'end',
		muted: true
	})}
	<rect
		x={BODY.x}
		y={BODY.y}
		width={BODY.w}
		height={BODY.h}
		rx="40"
		fill="var(--hc-tissue)"
		stroke="var(--border)"
	/>
	{@render txt(BODY.x + 26, BODY.y + BODY.h - 14, 'the rest of the body', 14, { weight: 700 })}
	{@render txt(BODY.x + BODY.w - 26, BODY.y + BODY.h - 14, 'organs use O₂', 12, {
		anchor: 'end',
		muted: true
	})}

	<!-- vessels (pale, so the blood cells in them stand out) -->
	<g fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.45">
		<path d={pathFrom(lungPre)} stroke="var(--hc-deoxy)" stroke-width="12" />
		<path d={pathFrom(lungBed)} stroke="url(#loop-lung-grad)" stroke-width="6" />
		<path d={pathFrom(lungPost)} stroke="var(--hc-oxy)" stroke-width="12" />
		<path d={pathFrom(bodyBed)} stroke="url(#loop-body-grad)" stroke-width="6" />
		<path d={pathFrom(bodyPost)} stroke="var(--hc-deoxy)" stroke-width="12" />
		<path d="M{X(30)} {BODY.y + 4} L{X(30)} {Y(466)}" stroke="var(--hc-deoxy)" stroke-width="12" />
	</g>
	<!-- the aorta passes over the lung veins -->
	<path
		d={pathFrom(bodyPre)}
		fill="none"
		stroke="var(--stage-bg)"
		stroke-width="20"
		stroke-linejoin="round"
	/>
	<path
		d={pathFrom(bodyPre)}
		fill="none"
		stroke="var(--hc-oxy)"
		stroke-width="12"
		stroke-linejoin="round"
		opacity="0.45"
	/>

	<Heart {beat} {beats} x={HX} y={HY} scale={HS} signal={0} vessels={false} />
	<text
		x={X(126)}
		y={Y(318)}
		text-anchor="middle"
		font-weight="700"
		style:font-size="11px"
		style:fill="var(--surface)">right</text
	>
	<text
		x={X(126)}
		y={Y(318) + 13}
		text-anchor="middle"
		font-weight="700"
		style:font-size="11px"
		style:fill="var(--surface)">pump</text
	>
	<text
		x={X(312)}
		y={Y(318)}
		text-anchor="middle"
		font-weight="700"
		style:font-size="11px"
		style:fill="var(--surface)">left</text
	>
	<text
		x={X(312)}
		y={Y(318) + 13}
		text-anchor="middle"
		font-weight="700"
		style:font-size="11px"
		style:fill="var(--surface)">pump</text
	>

	<!-- blood cells -->
	{#each lungCells as c (c.i)}
		<circle cx={c.x} cy={c.y} r="6" fill={mix(c.oxy)} stroke="var(--stage-bg)" stroke-width="1.5" />
	{/each}
	{#each bodyCells as c (c.i)}
		<circle cx={c.x} cy={c.y} r="6" fill={mix(c.oxy)} stroke="var(--stage-bg)" stroke-width="1.5" />
	{/each}

	<!-- saturations and pressures -->
	{@render chip(708, 214, `${Math.round(m.arterialO2 * 100)}% O₂`, 'var(--hc-oxy)')}
	{@render chip(222, 330, `${Math.round(m.venousO2 * 100)}% O₂`, 'var(--hc-deoxy)')}
	{@render txt(X(194) + 12, 158, `lung artery ${bp(m.lungArtery)} mmHg`, 12, { muted: true })}
	{@render txt(752, 330, 'aorta', 12, { muted: true })}
	{@render txt(752, 346, `${bp(m.aorta)} mmHg`, 12, { muted: true })}

	<!-- each pump, each beat -->
	{@render txt(776, 52, 'Every beat', 15, { weight: 700 })}
	{#each rows as r, i (r.id)}
		{@const y = 80 + i * 52}
		{@render txt(776, y, r.label, 12, { muted: true })}
		{@render txt(776, y + 24, r.value, 20, { weight: 700, color: r.color })}
	{/each}
	{@render txt(776, 200, `${m.hr} beats/min →`, 12, { muted: true })}
	{@render txt(776, 224, `${m.output.toFixed(1)} L/min each`, 18, { weight: 700 })}

	{#if phase === 'summary'}
		{@render txt(E.x0, E.top - 22, 'one signal, both pumps', 13, {
			weight: 600,
			color: 'var(--hc-ecg)'
		})}
		<rect
			x={E.x0}
			y={E.top - 8}
			width={E.x1 - E.x0}
			height={E.bottom - E.top + 8}
			rx="6"
			fill="var(--stage-grid)"
			opacity="0.35"
		/>
		<path d={ecgPath} fill="none" stroke="var(--hc-ecg)" stroke-width="2" stroke-linejoin="round" />
	{:else}
		{@render txt(24, 60, 'In series:', 13, { weight: 700 })}
		{@render txt(24, 80, 'every drop goes', 12, { muted: true })}
		{@render txt(24, 96, 'through both pumps,', 12, { muted: true })}
		{@render txt(24, 112, 'one after the other.', 12, { muted: true })}
	{/if}
</g>
