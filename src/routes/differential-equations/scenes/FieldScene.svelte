<script lang="ts">
	/**
	 * The slope field of one rule dy/dt = f(t, y) in the plane of time against
	 * the quantity, with solution curves traced through it from starting
	 * points: the presets of the step, plus any the reader drops by clicking
	 * the plot or with "Add a curve". The newest start is a handle (drag it, or
	 * arrow keys move it up and down).
	 *
	 * Phases (`step.hints.phase`):
	 *   field    — the dashes and one curve; the panel reads the slope
	 *   follow   — curves with the exact formula dashed over them, the gap
	 *   level    — the equilibria as level lines, labelled stable / unstable
	 *   sign     — the same, with the strip of arrows and the chart of f
	 *   cross    — many curves; the panel counts crossings
	 *   harvest  — the fish stock: level lines, f lowered by H, the threshold
	 *   collapse — the same past rK/4: no level line, when each stock is gone
	 *   formula  — dy/dt = t − y², which has no elementary formula; the dividing curve
	 *
	 * The rule is `hints.rule`, or the param it names (`signRule`, `crossRule`);
	 * the harvest is the param `hints.H` names (`H` or `H2`). A new curve is
	 * traced over 1.6 s from its start (complete at once under reduced motion).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Handle, Label, clamp, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import { toSvg } from '#lib/draw/pointer.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULTS,
		crossings,
		equilibria,
		gapToExact,
		riccatiDivider,
		rules,
		trace,
		valueAt,
		type RuleId,
		type RuleParams,
		type Trace
	} from '../ode';
	import {
		CHART,
		COLLAPSE,
		DENSE,
		F_RANGE,
		PANEL,
		PLOT,
		PRESETS,
		STRIP,
		TEXT,
		fixed,
		small
	} from './plot';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'field'));
	const ruleId = $derived.by((): RuleId => {
		const h = String(step.hints?.rule ?? 'growth');
		const id = h in rules ? h : String(params[h] ?? 'logistic');
		return (id in rules ? id : 'logistic') as RuleId;
	});
	const rule = $derived(rules[ruleId]);
	const text = $derived(TEXT[ruleId]);
	const hId = $derived(String(step.hints?.H ?? 'H'));
	const p = $derived<RuleParams>({
		r: Number(params.r ?? DEFAULTS.r),
		room: Number(params.room ?? DEFAULTS.room),
		H: Number(params[hId] ?? DEFAULTS.H)
	});

	// ---- scales -------------------------------------------------------------------------
	const sx = $derived(scale(rule.t, [PLOT.left, PLOT.right]));
	const sy = $derived(scale(rule.y, [PLOT.bottom, PLOT.top]));
	const ySpan = $derived(rule.y[1] - rule.y[0]);

	// ---- the starts -----------------------------------------------------------------------
	interface Start {
		t: number;
		y: number;
		/** Scene time when it was dropped (0 for the presets). */
		born: number;
	}
	const MAX = 12;
	/** Starts the reader has changed, per step and rule; otherwise the presets. */
	let custom = $state<Record<string, Start[]>>({});
	const key = $derived(`${step.id}:${ruleId}`);
	const presets = $derived(
		(phase === 'cross'
			? DENSE[ruleId]
			: phase === 'collapse' && ruleId === 'harvest'
				? COLLAPSE
				: PRESETS[ruleId]
		)
			.slice(0, phase === 'field' ? 1 : undefined)
			.map(([t0, y0]) => ({ t: t0, y: y0, born: 0 }))
	);
	const starts = $derived(custom[key] ?? presets);

	const roundT = (v: number) => Math.round(v * 100) / 100;
	const roundY = (v: number) => Math.round(v * 1000) / 1000;
	function put(list: Start[]) {
		custom[key] = list.slice(-MAX);
	}
	function drop(t0: number, y0: number, born: number) {
		put([
			...starts,
			{
				t: roundT(clamp(t0, rule.t[0], rule.t[1])),
				y: roundY(clamp(y0, rule.y[0], rule.y[1])),
				born
			}
		]);
	}
	function moveNewest(t0: number, y0: number) {
		const last = starts[starts.length - 1];
		if (!last) return;
		put([
			...starts.slice(0, -1),
			{
				t: roundT(clamp(t0, rule.t[0], rule.t[1])),
				y: roundY(clamp(y0, rule.y[0], rule.y[1])),
				born: -Infinity
			}
		]);
	}
	/** "Add a curve": at the left edge, in the middle of the widest gap between the curves there. */
	function addInGap(born: number) {
		const t0 = rule.t[0];
		const ys = traces
			.map((tr) => valueAt(tr, t0))
			.filter((v) => Number.isFinite(v) && v >= rule.y[0] && v <= rule.y[1]);
		const edges = [rule.y[0], ...ys, rule.y[1]].sort((a, b) => a - b);
		let best = { lo: edges[0], hi: edges[0] };
		for (let i = 1; i < edges.length; i++)
			if (edges[i] - edges[i - 1] > best.hi - best.lo) best = { lo: edges[i - 1], hi: edges[i] };
		drop(t0, (best.lo + best.hi) / 2, born);
	}

	function onPlotClick(event: MouseEvent) {
		const pt = toSvg(event, event.currentTarget as Element);
		drop(sx.invert(pt.x), sy.invert(pt.y), reduced ? -Infinity : t);
	}

	// Action buttons: apply the presses since the last counts seen.
	const counts = $derived({ add: Number(params.add ?? 0), clear: Number(params.clear ?? 0) });
	let seen: { add: number; clear: number } | null = null;
	$effect(() => {
		const c = counts;
		untrack(() => {
			if (seen && c.clear > seen.clear) delete custom[key];
			if (seen && c.add > seen.add) addInGap(reduced ? -Infinity : t);
			seen = { ...c };
		});
	});

	// ---- the curves ---------------------------------------------------------------------------
	const traces = $derived(starts.map((s) => trace(rule, p, s.t, s.y)));
	const showExact = $derived(
		!!rule.exact &&
			params.exact !== false &&
			(phase === 'follow' || phase === 'level' || phase === 'field')
	);
	const DRAW = 1.6;
	/** How much of a curve is drawn: 0 → 1 over DRAW seconds after its start was dropped. */
	const progress = (born: number) => (reduced || t < born ? 1 : clamp((t - born) / DRAW, 0, 1));

	/** The path of a trace, from its start outwards, the fraction u of each side. */
	function tracePath(tr: Trace, u: number): string {
		const n = tr.t.length;
		const i0 = Math.max(0, Math.floor(tr.start - u * tr.start));
		const i1 = Math.min(n - 1, Math.ceil(tr.start + u * (n - 1 - tr.start)));
		const lo = rule.y[0] - ySpan;
		const hi = rule.y[1] + ySpan;
		let d = '';
		for (let i = i0; i <= i1; i++) {
			const y = clamp(tr.y[i], lo, hi);
			d += `${i === i0 ? 'M' : 'L'}${sx(tr.t[i]).toFixed(1)} ${sy(y).toFixed(1)}`;
		}
		return d;
	}
	function exactPath(s: Start): string {
		if (!rule.exact) return '';
		const ex = rule.exact(p, s.t, s.y);
		const lo = rule.y[0] - ySpan;
		const hi = rule.y[1] + ySpan;
		let d = '';
		let pen = false;
		for (let i = 0; i <= 200; i++) {
			const tt = rule.t[0] + ((rule.t[1] - rule.t[0]) * i) / 200;
			const v = ex(tt);
			if (!Number.isFinite(v) || v < lo || v > hi) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${sx(tt).toFixed(1)} ${sy(v).toFixed(1)}`;
			pen = true;
		}
		return d;
	}
	const curves = $derived(
		starts.map((s, i) => ({
			key: `${i}:${s.t}:${s.y}`,
			s,
			tr: traces[i],
			newest: i === starts.length - 1,
			exact: showExact ? exactPath(s) : ''
		}))
	);

	// ---- the slope field ------------------------------------------------------------------------
	const COLS = 22;
	const ROWS = 16;
	const DASH = 15;
	const fieldPath = $derived.by(() => {
		const w = PLOT.right - PLOT.left;
		const h = PLOT.bottom - PLOT.top;
		/** Screen units per unit of y, over screen units per unit of t. */
		const aspect = h / ySpan / (w / (rule.t[1] - rule.t[0]));
		let d = '';
		for (let i = 0; i < COLS; i++)
			for (let j = 0; j < ROWS; j++) {
				const x = PLOT.left + ((i + 0.5) * w) / COLS;
				const y = PLOT.top + ((j + 0.5) * h) / ROWS;
				const slope = rule.f(sx.invert(x), sy.invert(y), p) * aspect;
				const len = Math.hypot(1, slope);
				const dx = (DASH / 2) * (1 / len);
				const dy = (DASH / 2) * (slope / len);
				d += `M${(x - dx).toFixed(1)} ${(y + dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y - dy).toFixed(1)}`;
			}
		return d;
	});

	/** For dy/dt = t − y²: the curve y² = t, on which the slope is 0. */
	const nullcline = $derived.by(() => {
		if (ruleId !== 'riccati') return '';
		const pts = Array.from({ length: 61 }, (_, i) => (rule.t[1] * i) / 60);
		const branch = (sign: number) =>
			pts
				.map(
					(tt, i) => `${i ? 'L' : 'M'}${sx(tt).toFixed(1)} ${sy(sign * Math.sqrt(tt)).toFixed(1)}`
				)
				.join('');
		return branch(1) + branch(-1);
	});

	/** For dy/dt = t − y²: the dividing solution Ai′(t)/Ai(t). */
	const dividerPath = $derived.by(() => {
		if (ruleId !== 'riccati') return '';
		const tr = riccatiDivider();
		return tr.t
			.map((tt, i) => `${i ? 'L' : 'M'}${sx(tt).toFixed(1)} ${sy(tr.y[i]).toFixed(1)}`)
			.join('');
	});

	// ---- equilibria -----------------------------------------------------------------------------
	const eqs = $derived(equilibria(rule, p));
	const showEq = $derived(phase !== 'field' && phase !== 'formula');
	const showStrip = $derived(
		rule.autonomous && (phase === 'sign' || phase === 'harvest' || phase === 'collapse')
	);
	const stripArrows = $derived.by(() => {
		if (!rule.autonomous) return [];
		const cuts = [rule.y[0], ...eqs.map((e) => e.y), rule.y[1]];
		const out: { y: number; up: boolean }[] = [];
		for (let i = 1; i < cuts.length; i++) {
			const a = cuts[i - 1];
			const b = cuts[i];
			if (sy(a) - sy(b) < 30) continue;
			const mid = (a + b) / 2;
			const v = rule.f(0, mid, p);
			if (v !== 0) out.push({ y: mid, up: v > 0 });
		}
		return out;
	});
	const eqColor = (s: string) =>
		s === 'stable'
			? 'var(--de-stable)'
			: s === 'unstable'
				? 'var(--de-unstable)'
				: 'var(--de-semi)';

	/**
	 * Labels of the level lines: over or under the line, at the left or the right end,
	 * wherever the curves on the plot leave the most room (a box about 120 × 14 units).
	 */
	const eqLabels = $derived(
		eqs
			.filter((e) => e.y > rule.y[0] + 1e-9)
			.map((e) => {
				const text = `${TEXT[ruleId].sym} = ${eqNum(e.y)}: ${e.stability}`;
				const w = text.length * 6.6;
				const y0 = sy(e.y);
				const spots = [
					{ x: PLOT.left + 20, ty: y0 - 8, anchor: 'start' as const, x0: PLOT.left + 20 },
					{ x: PLOT.right - 10, ty: y0 + 18, anchor: 'end' as const, x0: PLOT.right - 10 - w },
					{ x: PLOT.left + 20, ty: y0 + 18, anchor: 'start' as const, x0: PLOT.left + 20 },
					{ x: PLOT.right - 10, ty: y0 - 8, anchor: 'end' as const, x0: PLOT.right - 10 - w }
				];
				const room = (s: (typeof spots)[number]) => {
					let best = Infinity;
					for (const tr of traces)
						for (let i = 0; i < tr.t.length; i += 3) {
							const px = sx(tr.t[i]);
							const py = sy(tr.y[i]);
							const dx = Math.max(s.x0 - px, 0, px - (s.x0 + w));
							const dy = Math.max(s.ty - 13 - py, 0, py - (s.ty + 2));
							best = Math.min(best, Math.hypot(dx, dy));
						}
					return best;
				};
				// The first spot with 6 units of room, else the roomiest.
				const scored = spots.map((s) => ({ ...s, room: room(s) }));
				const pick =
					scored.find((s) => s.room >= 6) ?? scored.reduce((a, b) => (b.room > a.room ? b : a));
				return {
					y: e.y,
					stability: e.stability,
					text,
					x: pick.x,
					ty: pick.ty,
					anchor: pick.anchor
				};
			})
	);

	// ---- the chart of f ------------------------------------------------------------------------
	const showChart = $derived(showStrip);
	const fx = $derived(scale(rule.y, [CHART.left, CHART.right]));
	const fy = $derived(scale(F_RANGE[ruleId], [CHART.bottom, CHART.top]));
	const fPath = $derived.by(() => {
		if (!rule.autonomous) return '';
		const [lo, hi] = F_RANGE[ruleId];
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const y = rule.y[0] + (ySpan * i) / 120;
			const v = clamp(rule.f(0, y, p), lo - (hi - lo), hi + (hi - lo));
			d += `${i ? 'L' : 'M'}${fx(y).toFixed(1)} ${fy(v).toFixed(1)}`;
		}
		return d;
	});

	// ---- cross-fades -----------------------------------------------------------------------------
	const wChart = new Tween(0, { duration: 700, easing: cubicInOut });
	const wEq = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const c = showChart;
		const e = showEq;
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			wChart.set(c ? 1 : 0, o);
			wEq.set(e ? 1 : 0, o);
		});
	});

	// ---- the panel -------------------------------------------------------------------------------
	const newest = $derived(starts[starts.length - 1]);
	const newestTrace = $derived(traces[traces.length - 1]);
	const nf = (v: number) => fixed(v, Math.abs(v) >= 10 ? 1 : 2);
	const startText = $derived(
		newest
			? `t₀ = ${nf(newest.t)}${text.tUnit ? ' ' + text.tUnit : ''}, ${text.sym}₀ = ${nf(newest.y)}${
					text.unit ? ' ' + text.unit : ''
				}`
			: 'none'
	);
	const gap = $derived(
		showExact && traces.length ? Math.max(...traces.map((tr) => gapToExact(rule, p, tr))) : NaN
	);
	/** An equilibrium's value: whole when it is (0, 20, 100), else one decimal. */
	const eqNum = (v: number) =>
		Math.abs(v - Math.round(v)) < 0.005 ? fixed(Math.round(v), 0) : fixed(v, 1);
	const eqText = $derived(
		eqs.length ? eqs.map((e) => `${text.sym} = ${eqNum(e.y)} ${e.stability}`).join(', ') : 'none'
	);
	const crossCount = $derived(phase === 'cross' ? crossings(rule, traces) : 0);
	const fateText = $derived.by(() => {
		const tr = newestTrace;
		if (!tr) return '';
		if (tr.collapse !== undefined)
			return `stock gone after ${fixed(tr.collapse - tr.t[tr.start], 1)} years`;
		const end = tr.t[tr.t.length - 1];
		const v = valueAt(tr, end);
		return `at year ${fixed(end, 0)}: N = ${fixed(v, 1)}`;
	});
	const slopeText = $derived(
		ruleId === 'growth'
			? p.r > 0
				? `doubles every ln 2 / r = ${fixed(Math.log(2) / p.r, 2)} h`
				: `halves every ln 2 / |r| = ${fixed(Math.log(2) / -p.r, 2)} h`
			: ''
	);
	/** When a trace first drops below the plot (it goes on to −∞ later). */
	const exitTime = (tr: Trace) => {
		const i = tr.y.findIndex((v, k) => k > tr.start && v < rule.y[0]);
		return i < 0 ? tr.t[tr.t.length - 1] : tr.t[i];
	};
	const riccatiText = $derived.by(() => {
		const tr = newestTrace;
		if (!tr || ruleId !== 'riccati') return '';
		const end = tr.t[tr.t.length - 1];
		return end >= rule.t[1] - 1e-9
			? `newest curve at t = 6: y = ${fixed(valueAt(tr, 6), 2)} (√6 = 2.45)`
			: `newest curve leaves the plot downwards at t = ${fixed(exitTime(tr), 2)}`;
	});
	const critical = $derived((0.5 * 100) / 4);
</script>

<g>
	<defs>
		<clipPath id="de-plot-clip">
			<rect
				x={PLOT.left}
				y={PLOT.top}
				width={PLOT.right - PLOT.left}
				height={PLOT.bottom - PLOT.top}
			/>
		</clipPath>
		<clipPath id="de-chart-clip">
			<rect
				x={CHART.left}
				y={CHART.top}
				width={CHART.right - CHART.left}
				height={CHART.bottom - CHART.top}
			/>
		</clipPath>
	</defs>

	<!-- ================================================================ the plot -->
	<Axes {sx} {sy} xLabel={text.tLabel} yLabel={text.yLabel} yFormat={(v: number) => fixed(v, 0)} />
	<!-- clicking anywhere drops a start -->
	<rect
		x={PLOT.left}
		y={PLOT.top}
		width={PLOT.right - PLOT.left}
		height={PLOT.bottom - PLOT.top}
		fill="transparent"
		class="de-drop"
		role="presentation"
		onclick={onPlotClick}
	/>
	<g clip-path="url(#de-plot-clip)" pointer-events="none">
		<path d={fieldPath} stroke="var(--de-field)" stroke-width="1.6" stroke-linecap="round" />
		{#if wEq.current > 0.01}
			<g opacity={wEq.current}>
				{#each eqs as e (e.y)}
					<line
						x1={PLOT.left}
						x2={PLOT.right}
						y1={sy(e.y)}
						y2={sy(e.y)}
						stroke={eqColor(e.stability)}
						stroke-width="2.2"
						stroke-dasharray={e.stability === 'stable' ? undefined : '8 6'}
					/>
				{/each}
			</g>
		{/if}
		{#if ruleId === 'riccati'}
			<!-- where the dashes are flat: t − y² = 0 -->
			<path
				d={dividerPath}
				fill="none"
				stroke="var(--de-unstable)"
				stroke-width="2"
				stroke-dasharray="8 6"
			/>
			<path
				d={nullcline}
				fill="none"
				stroke="var(--de-f)"
				stroke-width="1.8"
				stroke-dasharray="2 5"
			/>
		{/if}
		{#each curves as c (c.key)}
			{@const u = progress(c.s.born)}
			<path
				d={tracePath(c.tr, u)}
				fill="none"
				stroke={c.newest ? 'var(--de-new)' : 'var(--de-curve)'}
				stroke-width={c.newest ? 3 : 2.2}
				stroke-linejoin="round"
			/>
			{#if c.exact}
				<path
					d={c.exact}
					fill="none"
					stroke="var(--de-exact)"
					stroke-width="1.5"
					stroke-dasharray="6 5"
					opacity={smoothstep(0.85, 1, u)}
				/>
			{/if}
			{#if !c.newest}
				<circle
					cx={sx(c.s.t)}
					cy={sy(c.s.y)}
					r="4"
					fill="var(--de-curve)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		{/each}
	</g>
	{#if wEq.current > 0.01 && phase !== 'cross'}
		<Readout id="eq-labels">
			<!-- a level line on the bottom axis (0 for a population) is left to the panel -->
			{#each eqLabels as l (l.y)}
				<Label
					x={l.x}
					y={l.ty}
					text={l.text}
					anchor={l.anchor}
					size={12}
					weight={600}
					color={eqColor(l.stability)}
					opacity={wEq.current}
				/>
			{/each}
		</Readout>
	{/if}
	{#if ruleId === 'riccati'}
		<Readout id="divider">
			<Label
				x={sx(1.25)}
				y={sy(-1.35) + 24}
				text="dividing curve"
				size={12}
				weight={600}
				color="var(--de-unstable)"
			/>
		</Readout>
		<Readout id="nullcline">
			<Label
				x={sx(4.3)}
				y={sy(-Math.sqrt(4.3)) - 14}
				text="dashes flat on y² = t"
				size={12}
				weight={600}
				color="var(--de-f)"
			/>
		</Readout>
	{/if}
	{#if newest}
		<Handle
			x={sx(newest.t)}
			y={sy(newest.y)}
			label="Start of the newest curve"
			value={newest.y}
			min={rule.y[0]}
			max={rule.y[1]}
			valuetext="{text.sym} = {nf(newest.y)} at t = {nf(newest.t)}"
			color="var(--de-new)"
			r={7}
			onmove={(pt: Point) => moveNewest(sx.invert(pt.x), sy.invert(pt.y))}
			onkey={(s) =>
				moveNewest(
					newest.t,
					s === 'start' ? rule.y[0] : s === 'end' ? rule.y[1] : newest.y + (s * ySpan) / 100
				)}
		/>
	{/if}

	<!-- ================================================================ the strip of arrows -->
	{#if wChart.current > 0.01}
		<g opacity={wChart.current}>
			<line
				x1={(STRIP.left + STRIP.right) / 2}
				x2={(STRIP.left + STRIP.right) / 2}
				y1={PLOT.top}
				y2={PLOT.bottom}
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			{#each stripArrows as a (a.y)}
				{@const cx = (STRIP.left + STRIP.right) / 2}
				{@const cy = sy(a.y)}
				<path
					d={a.up
						? `M${cx} ${cy + 10}L${cx} ${cy - 10}M${cx - 6} ${cy - 3}L${cx} ${cy - 10}L${cx + 6} ${cy - 3}`
						: `M${cx} ${cy - 10}L${cx} ${cy + 10}M${cx - 6} ${cy + 3}L${cx} ${cy + 10}L${cx + 6} ${cy + 3}`}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/each}
			{#each eqs as e (e.y)}
				<circle
					cx={(STRIP.left + STRIP.right) / 2}
					cy={sy(e.y)}
					r="6"
					fill={e.stability === 'stable' ? eqColor(e.stability) : 'var(--stage-bg)'}
					stroke={eqColor(e.stability)}
					stroke-width="2.2"
				/>
			{/each}
		</g>
	{/if}

	<!-- ================================================================ the panel -->
	<Readout id="rule" order={1} label={text.title} value={text.formula(p)}>
		<Label x={PANEL} y={56} text={text.title} anchor="start" size={15} weight={600} />
		<Label x={PANEL} y={82} text={text.formula(p)} anchor="start" size={14} tabular />
	</Readout>

	{#if phase === 'field'}
		<Readout id="dash" order={2} label="Each dash" value="the slope r·y at its point">
			<Label x={PANEL} y={116} text="each dash: the slope r·y" anchor="start" size={13} muted />
			<Label x={PANEL} y={136} text="at its point of the plane" anchor="start" size={13} muted />
		</Readout>
		<Readout id="slope50" order={3} label="At y = 50" value="slope {fixed(p.r * 50, 1)} thousand/h">
			<Label
				x={PANEL}
				y={166}
				text="at y = 50: slope {fixed(p.r * 50, 1)} thousand/h"
				anchor="start"
				size={13}
				tabular
			/>
			<Label
				x={PANEL}
				y={186}
				text="at y = 10: slope {fixed(p.r * 10, 1)} thousand/h"
				anchor="start"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="doubling" order={4} label="The colony" value={slopeText}>
			<Label x={PANEL} y={216} text={slopeText} anchor="start" size={13} weight={600} tabular />
		</Readout>
	{:else}
		<Readout id="start" order={2} label="Newest start" value={startText} color="var(--de-new)">
			<circle cx={PANEL + 6} cy={112} r="5" fill="var(--de-new)" />
			<Label x={PANEL + 18} y={116} text="newest start:" anchor="start" size={13} muted />
			<Label x={PANEL} y={138} text={startText} anchor="start" size={13} tabular />
		</Readout>
		{#if showExact}
			<Readout id="gap" order={3} label="Traced vs exact formula" value="largest gap {small(gap)}">
				<Label
					x={PANEL}
					y={168}
					text="solid: traced · dashed: exact"
					anchor="start"
					size={12}
					muted
				/>
				<Label
					x={PANEL}
					y={190}
					text="largest gap: {small(gap)}"
					anchor="start"
					size={13}
					weight={600}
					tabular
				/>
			</Readout>
		{/if}
		{#if showEq && rule.autonomous && phase !== 'harvest' && phase !== 'collapse'}
			<Readout id="eqs" order={4} label="Level lines" value={eqText}>
				<Label
					x={PANEL}
					y={showExact ? 220 : 168}
					text="level lines: {eqText}"
					anchor="start"
					size={13}
					tabular
				/>
			</Readout>
		{/if}
		{#if phase === 'cross'}
			<Readout
				id="crossings"
				order={5}
				label="Curves on the plot"
				value="{starts.length}, crossings found: {crossCount}"
			>
				<Label
					x={PANEL}
					y={198}
					text="{starts.length} curves on the plot"
					anchor="start"
					size={13}
					tabular
				/>
				<Label
					x={PANEL}
					y={220}
					text="crossings found: {crossCount}"
					anchor="start"
					size={14}
					weight={600}
					tabular
				/>
			</Readout>
		{/if}
		{#if phase === 'harvest' || phase === 'collapse'}
			<Readout
				id="harvest-eq"
				order={4}
				label="Level lines"
				value={eqs.length ? eqText : `none: H > rK/4 = ${fixed(critical, 1)}`}
			>
				<Label
					x={PANEL}
					y={168}
					text={eqs.length ? `level lines: ${eqText}` : 'no level line at all'}
					anchor="start"
					size={13}
					weight={600}
					color={eqs.length ? undefined : 'var(--de-unstable)'}
					tabular
				/>
				<Label
					x={PANEL}
					y={190}
					text="catch {p.H > critical ? 'above' : p.H === critical ? 'at' : 'below'} rK/4 = {fixed(
						critical,
						1
					)} % of K a year"
					anchor="start"
					size={13}
					muted
					tabular
				/>
			</Readout>
			<Readout id="fate" order={5} label="Newest curve" value={fateText} color="var(--de-new)">
				<Label
					x={PANEL}
					y={220}
					text="newest: {fateText}"
					anchor="start"
					size={13}
					weight={600}
					color="var(--de-new)"
					tabular
				/>
			</Readout>
		{/if}
		{#if phase === 'formula'}
			<Readout
				id="noformula"
				order={3}
				label="Formula"
				value="no elementary formula; traced numerically"
			>
				<Label
					x={PANEL}
					y={168}
					text="no elementary formula: each curve"
					anchor="start"
					size={13}
					muted
				/>
				<Label
					x={PANEL}
					y={188}
					text="traced numerically, in 3000 RK4 steps"
					anchor="start"
					size={13}
					muted
				/>
			</Readout>
			<Readout id="riccati" order={4} label="Newest curve" value={riccatiText}>
				<Label x={PANEL} y={218} text={riccatiText} anchor="start" size={13} tabular />
			</Readout>
		{/if}
	{/if}

	<!-- ================================================================ the chart of f -->
	{#if wChart.current > 0.01}
		<g opacity={wChart.current}>
			<Axes
				sx={fx}
				sy={fy}
				xLabel={text.sym}
				yLabel="f({text.sym})"
				yFormat={(v: number) => fixed(v, 0)}
			/>
			<g clip-path="url(#de-chart-clip)">
				<line
					x1={CHART.left}
					x2={CHART.right}
					y1={fy(0)}
					y2={fy(0)}
					stroke="var(--stage-ink)"
					stroke-width="1.2"
				/>
				<path d={fPath} fill="none" stroke="var(--de-f)" stroke-width="2.5" />
			</g>
			{#each eqs as e (e.y)}
				<circle
					cx={fx(e.y)}
					cy={fy(0)}
					r="5.5"
					fill={e.stability === 'stable' ? eqColor(e.stability) : 'var(--stage-bg)'}
					stroke={eqColor(e.stability)}
					stroke-width="2.2"
				/>
			{/each}
		</g>
	{/if}
</g>

<style>
	.de-drop {
		cursor: crosshair;
	}
</style>
