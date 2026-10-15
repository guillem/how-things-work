<script lang="ts">
	/**
	 * The simulator: one virtual adult over six and a half hours, from half an
	 * hour before a meal (minute 0) to six hours after it.
	 *
	 * Right: three stacked charts sharing the time axis — blood glucose (with
	 * the hypoglycaemia band and the step's reference lines), insulin and
	 * glucagon. A faint copy of each curve shows the comparison day (no run,
	 * or a healthy body). Left: the blood drawn as a tank whose level is the
	 * glucose at the cursor, with glucose flowing in from the gut and the liver
	 * and out into cells and urine; pipe widths are the current rates.
	 *
	 * The scenario is simulated once per change of the step or a control (a
	 * few milliseconds); a cursor then sweeps the whole window in SWEEP
	 * seconds, a pure function of t, and holds the finished picture. The dots
	 * in the pipes sit at the integral of each flow up to the cursor, so their
	 * speed is the flow. Under reduced motion the finished picture is shown.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { MMOL_PER_MGDL, THRESHOLDS, at, extremes, type Sample } from '../model';
	import { FROM, TO, run, setup } from '../scenario';

	let { step, t, params, reduced }: StageProps = $props();

	const LEAD = 0.8; // seconds before the cursor starts
	const SWEEP = 14; // seconds for the cursor to cross the window

	const cfg = $derived(setup(step, params));
	const lines = $derived(String(step.hints?.lines ?? ''));
	const series = $derived(run(cfg.scenario));
	const ghost = $derived(cfg.ghostLabel ? run(cfg.ghost) : null);

	// ---- the cursor ---------------------------------------------------------------
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const done = $derived(u >= 1);
	const minute = $derived(FROM + u * (TO - FROM));
	const now = $derived(at(series, minute));
	const shown = $derived(series.filter((p) => p.t <= minute));

	// ---- scales ---------------------------------------------------------------------
	const X0 = 384;
	const X1 = 928;
	const G = { y0: 84, y1: 300 };
	const I = { y0: 352, y1: 434 };
	const C = { y0: 486, y1: 548 };
	const sx = scale([FROM, TO], [X0, X1]);
	/** The three chart areas, for lines that run through all of them but not across their titles. */
	const panels = [G, I, C];
	const peakOf = (s: readonly Sample[] | null, f: (p: Sample) => number) =>
		s ? Math.max(...s.map(f)) : 0;
	const gTop = Tween.of(
		() =>
			Math.max(
				250,
				Math.ceil(
					Math.max(
						peakOf(series, (p) => p.g),
						peakOf(ghost, (p) => p.g)
					) / 50
				) * 50
			),
		{ duration: 700, easing: cubicInOut }
	);
	const iTop = Tween.of(
		() => {
			const m = Math.max(
				peakOf(series, (p) => p.i),
				peakOf(ghost, (p) => p.i),
				40
			);
			return m <= 100 ? Math.ceil(m / 20) * 20 : Math.ceil(m / 50) * 50;
		},
		{ duration: 700, easing: cubicInOut }
	);
	const syG = $derived(scale([0, gTop.current], [G.y1, G.y0]));
	const syI = $derived(scale([0, iTop.current], [I.y1, I.y0]));
	const syC = scale([0, 3], [C.y1, C.y0]);
	const gTicks = $derived.by(() => {
		const stepG = gTop.target > 400 ? 200 : 100;
		const out: number[] = [];
		for (let v = 0; v <= gTop.current + 1e-6; v += stepG) out.push(v);
		return out;
	});
	const iTicks = $derived.by(() => {
		const top = iTop.target;
		const stepI = top <= 60 ? 20 : top <= 120 ? 40 : 100;
		const out: number[] = [];
		for (let v = 0; v <= iTop.current + 1e-6; v += stepI) out.push(v);
		return out;
	});
	const hours = [0, 60, 120, 180, 240, 300, 360];
	const hourText = (m: number) => `${m / 60} h`;

	const path = (s: readonly Sample[], f: (p: Sample) => number, sy: typeof syG) =>
		linePath(s, (p) => p.t, f, sx, sy);

	// ---- events -----------------------------------------------------------------------
	const sc = $derived(cfg.scenario);
	const runSpan = $derived(
		sc.intensity > 8 ? { a: sc.runAt, b: Math.min(TO, sc.runAt + sc.runFor) } : null
	);
	const runLabel = $derived(sc.intensity >= 60 ? 'run' : 'easy exercise');

	// ---- readouts -----------------------------------------------------------------------
	const fmtMin = (m: number) => {
		const a = Math.round(Math.abs(m));
		const h = Math.floor(a / 60);
		const mm = a % 60;
		const txt = h > 0 ? `${h} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
		if (sc.carbs <= 0) return `time: ${m < 0 ? '−' : ''}${txt}`;
		return m < 0 ? `${txt} before the meal` : a === 0 ? 'the meal' : `${txt} after the meal`;
	};
	/**
	 * Zones (mg/dL): below 54 level 2 and below 70 level 1 hypoglycaemia (ADA);
	 * 70–180 the target range and above 250 level 2 hyperglycaemia of the
	 * international consensus on time in range (Battelino et al., Diabetes
	 * Care 42:1593, 2019).
	 */
	function zone(g: number) {
		if (g < THRESHOLDS.hypoLevel2)
			return { text: 'dangerously low', color: 'var(--hm-hypo)', strong: true };
		if (g < THRESHOLDS.hypo)
			return { text: 'low: hypoglycaemia', color: 'var(--hm-hypo)', strong: true };
		if (g <= 140) return { text: 'normal range', color: 'var(--stage-ink)', strong: false };
		if (g <= 180) return { text: 'raised', color: 'var(--stage-ink)', strong: false };
		if (g <= 250) return { text: 'high', color: 'var(--hm-glucose)', strong: true };
		return { text: 'very high', color: 'var(--hm-glucose)', strong: true };
	}
	const z = $derived(zone(now.g));
	const mmol = (g: number) => (g * MMOL_PER_MGDL).toFixed(1);

	/** The step's key result, shown once the cursor has passed the moment it is read. */
	const verdict = $derived.by(() => {
		const fast = at(series, -1).g;
		const ext = extremes(series, 0, TO);
		switch (cfg.kind) {
			case 'meal': {
				if (sc.carbs <= 0) return { at: TO, text: 'No meal: nothing to correct', ok: true };
				const g2 = at(series, 120).g;
				return {
					at: 120,
					text: `2 hours after: ${Math.round(g2)} mg/dL`,
					sub: g2 < THRESHOLDS.twoHourNormal ? 'normal (under 140)' : 'above the normal 140',
					ok: g2 < THRESHOLDS.twoHourNormal
				};
			}
			case 'run': {
				const g = ghost ? extremes(ghost, 0, TO) : ext;
				return {
					at: TO,
					text: `Highest ${Math.round(ext.hi.g)}, lowest ${Math.round(ext.lo.g)} mg/dL`,
					sub: `without exercise: ${Math.round(g.hi.g)} and ${Math.round(g.lo.g)}`,
					ok: ext.lo.g >= THRESHOLDS.hypo
				};
			}
			case 'type1':
			case 'type2':
				return {
					at: FROM,
					text: `Fasting: ${Math.round(fast)} mg/dL`,
					// The healthy adult sits at Topp et al.'s reference value, 100 mg/dL,
					// which is where the ADA's prediabetes range begins: say it is the
					// model's reference rather than give it a clinical class by rounding.
					sub:
						sc.production === 1 && sc.sensitivity === 1
							? "the model's healthy reference"
							: fast >= THRESHOLDS.fastingDiabetes
								? 'diabetes range (126 or more)'
								: fast >= THRESHOLDS.fastingNormal
									? 'prediabetes range (100–125)'
									: 'normal (under 100)',
					ok: fast < THRESHOLDS.fastingDiabetes
				};
			default: {
				const lo = ext.lo.g;
				const hi = ext.hi.g;
				const sub =
					lo < THRESHOLDS.hypoLevel2
						? 'level 2 hypoglycaemia: dangerous'
						: lo < THRESHOLDS.hypo
							? 'level 1 hypoglycaemia'
							: hi > 250
								? 'very high'
								: hi > 180
									? 'above the 70–180 target'
									: 'within 70–180 throughout';
				return {
					at: TO,
					text: `Lowest ${Math.round(lo)}, highest ${Math.round(hi)} mg/dL`,
					sub,
					ok: lo >= THRESHOLDS.hypo && hi <= 180
				};
			}
		}
	});
	const verdictShow = $derived(reduced || done ? 1 : smoothstep(0, 8, minute - verdict.at));

	// ---- the tank ----------------------------------------------------------------------------
	const TX = 128;
	const TW = 100;
	const TY0 = 178;
	const TY1 = 396;
	const GUT_Y = 216;
	const LIVER_Y = 338;
	const CELLS_Y = 280;
	const TANK_MAX = 300; // mg/dL at the brim (higher values fill it to the top)
	const level = $derived(TY1 - (TY1 - TY0) * clamp(now.g / TANK_MAX));
	const tankY = (g: number) => TY1 - ((TY1 - TY0) * g) / TANK_MAX;

	/** Cumulative glucose moved by each flow, mg/dL, per minute of the series. */
	const cums = $derived.by(() => {
		const keys = ['gut', 'liver', 'uptake', 'urine'] as const;
		const out: Record<(typeof keys)[number], number[]> = {
			gut: [],
			liver: [],
			uptake: [],
			urine: []
		};
		for (const k of keys) {
			let sum = 0;
			for (const p of series) {
				sum += p[k];
				out[k].push(sum);
			}
		}
		return out;
	});
	const idx = $derived(Math.min(series.length - 1, Math.max(0, Math.round(minute - FROM))));
	const UNIT = 40; // mg/dL between two dots
	const SPACING = 18;
	const width = (rate: number) => 3 + 15 * clamp(rate / 5);
	const pipes = $derived(
		[
			{
				id: 'gut',
				label: 'from the gut',
				color: 'var(--hm-gut)',
				rate: now.gut,
				pts: [
					[24, GUT_Y],
					[TX - 4, GUT_Y]
				],
				lx: 24,
				ly: GUT_Y - 12,
				anchor: 'start'
			},
			{
				id: 'liver',
				label: 'from the liver',
				color: 'var(--hm-liver)',
				rate: now.liver,
				pts: [
					[24, LIVER_Y],
					[TX - 4, LIVER_Y]
				],
				lx: 24,
				ly: LIVER_Y - 12,
				anchor: 'start'
			},
			{
				id: 'uptake',
				label: 'into cells',
				color: 'var(--hm-muscle)',
				rate: now.uptake,
				pts: [
					[TX + TW + 4, CELLS_Y],
					[318, CELLS_Y]
				],
				lx: 318,
				ly: CELLS_Y - 12,
				anchor: 'end'
			},
			{
				id: 'urine',
				label: 'into urine',
				color: 'var(--hm-urine)',
				rate: now.urine,
				pts: [
					[TX + TW / 2, TY1 + 4],
					[TX + TW / 2, 446]
				],
				lx: TX + TW / 2 + 14,
				ly: 424,
				anchor: 'start'
			}
		].map((p) => {
			const pts = p.pts as [number, number][];
			const segs = pts.slice(1).map((b, k) => {
				const a = pts[k];
				return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
			});
			const total = segs.reduce((s, g) => s + g.len, 0);
			const moved = cums[p.id as keyof typeof cums][idx] / UNIT;
			const frac = moved - Math.floor(moved);
			const n = Math.ceil(total / SPACING) + 1;
			const active = smoothstep(0.02, 0.15, p.rate) * (done ? 0 : 1);
			const dots = Array.from({ length: n }, (_, k) => {
				let d = (k + frac) * SPACING;
				for (const s of segs) {
					if (d <= s.len) {
						const f = d / s.len;
						const o =
							smoothstep(0, 10, (k + frac) * SPACING) *
							(1 - smoothstep(total - 14, total - 2, (k + frac) * SPACING));
						return {
							k,
							x: s.a[0] + (s.b[0] - s.a[0]) * f,
							y: s.a[1] + (s.b[1] - s.a[1]) * f,
							o: o * active
						};
					}
					d -= s.len;
				}
				return { k, x: 0, y: 0, o: 0 };
			}).filter((d) => d.o > 0.01);
			return {
				...p,
				d: pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' '),
				w: p.id === 'urine' && p.rate < 0.005 ? 0 : width(p.rate),
				dots
			};
		})
	);
	const fmtRate = (r: number) => (r < 0.05 ? '0' : r < 9.95 ? r.toFixed(1) : String(Math.round(r)));
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- ===================== left: the readout and the tank ===================== -->
	<Label x={24} y={36} text={fmtMin(minute)} size={13} anchor="start" muted />
	<text x={24} y={76} font-size="30" font-weight="600" style:fill={z.color}
		>{Math.round(now.g)}<tspan font-size="14" font-weight="500" dx="6">mg/dL</tspan></text
	>
	<text x={24} y={100} class="muted"
		>{mmol(now.g)} mmol/L ·<tspan
			dx="4"
			font-weight={z.strong ? 600 : 400}
			style:fill={z.strong ? z.color : undefined}>{z.text}</tspan
		></text
	>

	<!-- pipes under the tank so that their ends tuck behind its walls -->
	{#each pipes as p (p.id)}
		{#if p.w > 0}
			<path
				d={p.d}
				fill="none"
				stroke={p.color}
				stroke-width={p.w}
				stroke-linejoin="round"
				opacity="0.35"
			/>
			{#each p.dots as d (d.k)}
				<circle cx={d.x} cy={d.y} r="3" fill={p.color} opacity={d.o} />
			{/each}
		{/if}
	{/each}

	<!-- the tank: the blood, filled to the glucose level -->
	<rect
		x={TX}
		y={TY0}
		width={TW}
		height={TY1 - TY0}
		rx="10"
		fill="var(--hm-blood)"
		stroke="var(--hm-blood-edge)"
		stroke-width="1.5"
	/>
	<rect
		x={TX + 6}
		y={tankY(70)}
		width={TW - 12}
		height={tankY(0) - tankY(70) - 4}
		rx="5"
		fill="var(--hm-hypo-bg)"
	/>
	<rect
		x={TX + 6}
		y={level}
		width={TW - 12}
		height={Math.max(0, TY1 - 4 - level)}
		rx="5"
		fill="var(--hm-glucose)"
		opacity="0.45"
	/>
	<line
		x1={TX + 6}
		x2={TX + TW - 6}
		y1={level}
		y2={level}
		stroke="var(--hm-glucose)"
		stroke-width="2.5"
	/>
	{#each [70, 180] as g (g)}
		<line
			x1={TX + TW - 16}
			x2={TX + TW - 6}
			y1={tankY(g)}
			y2={tankY(g)}
			stroke="var(--stage-ink-muted)"
		/>
		<text x={TX + TW - 19} y={tankY(g) + 4} font-size="10" class="muted halo" text-anchor="end"
			>{g}</text
		>
	{/each}
	<Label x={TX + TW / 2} y={TY0 - 10} text="glucose in the blood" size={12} weight={600} />

	{#each pipes as p (p.id)}
		{@const anchor = p.anchor as 'start' | 'end'}
		<g opacity={p.id === 'urine' && p.w === 0 ? 0.45 : 1}>
			<text x={p.lx} y={p.ly} font-weight="600" text-anchor={anchor} style:fill={p.color}
				>{p.label}</text
			>
			<text
				x={p.lx}
				y={p.id === 'urine' ? p.ly + 16 : p.ly + 34}
				font-size="11"
				class="muted"
				text-anchor={anchor}>{fmtRate(p.rate)} mg/dL/min</text
			>
		</g>
	{/each}

	<!-- hormones now -->
	<g>
		<circle cx={30} cy={496} r="5" fill="var(--hm-insulin)" />
		<text x={42} y={500} font-size="13"
			>insulin <tspan font-weight="600">{now.i.toFixed(now.i < 10 ? 1 : 0)}</tspan><tspan
				class="muted"
				font-size="11"
				dx="4">µU/mL</tspan
			></text
		>
		<circle cx={30} cy={520} r="5" fill="var(--hm-glucagon)" />
		<text x={42} y={524} font-size="13"
			>glucagon <tspan font-weight="600">×{now.gcg.toFixed(1)}</tspan><tspan
				class="muted"
				font-size="11"
				dx="4">fasting level</tspan
			></text
		>
	</g>

	<!-- the step's key result -->
	<g opacity={verdictShow}>
		<text x={24} y={560} font-size="14" font-weight="600">{verdict.text}</text>
		{#if verdict.sub}
			<text
				x={24}
				y={578}
				font-size="12"
				font-weight={verdict.ok ? 400 : 600}
				style:fill={verdict.ok ? 'var(--stage-ink-muted)' : 'var(--hm-hypo)'}>{verdict.sub}</text
			>
		{/if}
	</g>

	<!-- ===================== right: the three charts ===================== -->
	<!-- exercise and the meal, behind everything -->
	{#if runSpan}
		<rect
			x={sx(runSpan.a)}
			y={G.y0}
			width={sx(runSpan.b) - sx(runSpan.a)}
			height={C.y1 - G.y0}
			fill="var(--hm-muscle)"
			opacity="0.08"
		/>
		<Label
			x={(sx(runSpan.a) + sx(runSpan.b)) / 2}
			y={G.y0 + 30}
			text={runLabel}
			size={11}
			weight={600}
			color="var(--hm-muscle)"
		/>
	{/if}

	<!-- glucose -->
	<rect
		x={X0}
		y={syG(THRESHOLDS.hypo)}
		width={X1 - X0}
		height={G.y1 - syG(THRESHOLDS.hypo)}
		fill="var(--hm-hypo-bg)"
	/>
	<Axes {sx} sy={syG} xTicks={[]} yTicks={gTicks} yLabel="blood glucose, mg/dL" />
	<text
		x={sx(0) + 6}
		y={syG(lines === 'hypo' ? 54 : THRESHOLDS.hypo) + 13}
		font-size="11"
		class="halo"
		style:fill="var(--hm-hypo)"
		>{lines === 'hypo'
			? 'below 70: hypoglycaemia · below 54 (dashed): dangerous'
			: 'below 70: hypoglycaemia'}</text
	>
	{#if lines === 'ogtt'}
		<line
			x1={X0}
			x2={X1}
			y1={syG(140)}
			y2={syG(140)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<line
			x1={sx(120)}
			x2={sx(120)}
			y1={G.y0 + 22}
			y2={G.y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 3"
		/>
	{:else if lines === 'diagnosis'}
		<line
			x1={X0}
			x2={X1}
			y1={syG(126)}
			y2={syG(126)}
			stroke="var(--hm-glucose)"
			stroke-dasharray="5 4"
		/>
	{:else if lines === 'hypo'}
		<rect
			x={X0}
			y={syG(180)}
			width={X1 - X0}
			height={syG(70) - syG(180)}
			fill="var(--hm-glucagon)"
			opacity="0.07"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={syG(54)}
			y2={syG(54)}
			stroke="var(--hm-hypo)"
			stroke-dasharray="5 4"
		/>
	{/if}

	<!-- meal and injection markers -->
	{#if sc.carbs > 0}
		{#each panels as pn (pn.y0)}
			<line x1={sx(0)} x2={sx(0)} y1={pn.y0} y2={pn.y1} stroke="var(--hm-gut)" stroke-width="1.2" />
		{/each}
		<Label
			x={sx(0) + 5}
			y={G.y0 + 12}
			text="meal: {sc.carbs} g"
			size={11}
			weight={600}
			anchor="start"
		/>
	{/if}
	{#if sc.dose > 0}
		{@const dx = sx(sc.doseAt)}
		<path d="M{dx - 6} {I.y0} h12 l-6 10 Z" fill="var(--hm-insulin)" />
		<Label
			x={dx + 9}
			y={I.y0 + 10}
			text="{sc.dose} U injected"
			size={11}
			weight={600}
			anchor="start"
		/>
	{/if}

	{#if ghost}
		<path
			d={path(ghost, (p) => p.g, syG)}
			fill="none"
			stroke="var(--hm-glucose)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={path(shown, (p) => p.g, syG)}
		fill="none"
		stroke="var(--hm-glucose)"
		stroke-width="2.6"
		stroke-linejoin="round"
	/>

	<!-- reference-line labels, above the curves so that their halo keeps them legible -->
	{#if lines === 'ogtt'}
		<Label
			x={X1 - 4}
			y={syG(140) - 6}
			text="140: normal limit 2 h after"
			size={11}
			anchor="end"
			muted
		/>
	{/if}
	{#if lines === 'diagnosis'}
		<Label
			x={X1 - 4}
			y={syG(126) - 6}
			text="126: diabetes if fasting"
			size={11}
			anchor="end"
			color="var(--hm-glucose)"
		/>
	{/if}
	{#if lines === 'hypo'}
		<Label x={X1 - 4} y={syG(180) - 6} text="target 70–180" size={11} anchor="end" muted />
	{/if}

	<!-- insulin -->
	<Axes {sx} sy={syI} xTicks={[]} yTicks={iTicks} yLabel="insulin, µU/mL" />
	{#if ghost}
		<path
			d={path(ghost, (p) => p.i, syI)}
			fill="none"
			stroke="var(--hm-insulin)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={path(shown, (p) => p.i, syI)}
		fill="none"
		stroke="var(--hm-insulin)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>

	<!-- glucagon -->
	<Axes
		{sx}
		sy={syC}
		xTicks={hours}
		yTicks={[0, 1, 2, 3]}
		xFormat={hourText}
		yFormat={(v) => `×${v}`}
		xLabel={sc.carbs > 0 ? 'time after the meal' : 'time'}
		yLabel="glucagon, × fasting level"
	/>
	{#if ghost}
		<path
			d={path(ghost, (p) => p.gcg, syC)}
			fill="none"
			stroke="var(--hm-glucagon)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={path(shown, (p) => p.gcg, syC)}
		fill="none"
		stroke="var(--hm-glucagon)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>

	<!-- legend for the faint curves -->
	{#if ghost}
		<line
			x1={X1 - 150}
			x2={X1 - 128}
			y1={36}
			y2={36}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
		/>
		<text x={X1 - 122} y={40} font-size="12" class="muted">{cfg.ghostLabel}</text>
	{/if}

	<!-- cursor -->
	{#if !done}
		{#each panels as pn (pn.y0)}
			<line
				x1={sx(minute)}
				x2={sx(minute)}
				y1={pn.y0}
				y2={pn.y1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
				opacity="0.7"
			/>
		{/each}
		<circle cx={sx(minute)} cy={syG(now.g)} r="4" fill="var(--hm-glucose)" />
		<circle cx={sx(minute)} cy={syI(now.i)} r="3.5" fill="var(--hm-insulin)" />
		<circle cx={sx(minute)} cy={syC(Math.min(3, now.gcg))} r="3.5" fill="var(--hm-glucagon)" />
	{/if}
</g>
