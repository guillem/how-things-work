<script lang="ts">
	/**
	 * The simulator: one infection (or two, overlaid) over the following weeks.
	 *
	 * Right: three stacked charts on a shared time axis, all logarithmic — free
	 * virus (with the interferon alarm as a strip under it), killer T cells, and
	 * antibodies (total, with the short-lived kind dashed). Left: the day at the
	 * cursor, the state of the airway lining as a stacked bar, the current
	 * values, and the step's verdict.
	 *
	 * The run is simulated once per change of the step or a control; a cursor
	 * then sweeps the window in SWEEP seconds (a pure function of t) and holds
	 * the finished picture. Under reduced motion the finished picture is shown.
	 * On the second-infection step both infections are counted from their own
	 * day 0: the first faint, the second bold.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CAO, antibody, at, clearedDay, effectors, peak, type Sample } from '../model';
	import { count, pow10, retime, run, setup } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const LEAD = 0.8; // seconds before the cursor starts
	const SWEEP = 16; // seconds for the cursor to cross the window

	const cfg = $derived(setup(step, params));
	const raw = $derived(run(cfg.scenario));
	const r = $derived(cfg.reinfectAt);
	/** The bold series, counted from its own infection. */
	const main = $derived(r === null ? raw : retime(raw, r, cfg.span));
	/** The faint comparison: the first infection, or the full response. */
	const ghost = $derived(r !== null ? retime(raw, 0, cfg.span) : cfg.ghost ? run(cfg.ghost) : null);
	const ghostLabel = $derived(
		r !== null ? 'first infection' : cfg.ghost ? 'with both responses' : ''
	);

	// ---- the cursor ------------------------------------------------------------------
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const done = $derived(u >= 1);
	const day = $derived(u * cfg.span);
	const now = $derived(at(main, day));
	const shown = $derived(main.filter((p) => p.t <= day + 1e-9));

	// ---- scales ------------------------------------------------------------------------
	const X0 = 404;
	const X1 = 928;
	const PV = { y0: 64, y1: 214 };
	const STRIP = { y0: 226, y1: 238 };
	const PE = { y0: 290, y1: 404 };
	const PA = { y0: 456, y1: 540 };
	const sx = $derived(scale([0, cfg.span], [X0, X1]));
	const syV = scale([-1, 10], [PV.y1, PV.y0]);
	const syE = scale([0, 8], [PE.y1, PE.y0]);
	const syA = scale([0, 5], [PA.y1, PA.y0]);
	const lg = (v: number, lo: number) => (v > 0 ? Math.max(lo, Math.log10(v)) : lo);
	const days = $derived(cfg.span === 20 ? [0, 5, 10, 15, 20] : [0, 5, 10, 15, 20, 25, 30]);
	const logTicks = (hi: number, step = 2) => {
		const out: number[] = [];
		for (let n = 0; n <= hi; n += step) out.push(n);
		return out;
	};

	const pathV = (s: readonly Sample[]) =>
		linePath(
			s,
			(p) => p.t,
			(p) => lg(p.V, -1),
			sx,
			syV
		);
	const pathE = (s: readonly Sample[]) =>
		linePath(
			s,
			(p) => p.t,
			(p) => lg(effectors(p), 0),
			sx,
			syE
		);
	const pathA = (s: readonly Sample[]) =>
		linePath(
			s,
			(p) => p.t,
			(p) => lg(antibody(p), 0),
			sx,
			syA
		);
	const pathAS = (s: readonly Sample[]) =>
		linePath(
			s,
			(p) => p.t,
			(p) => lg(p.AS, 0),
			sx,
			syA
		);

	// interferon strip: one cell per half day, opacity ∝ interferon level
	const fMax = $derived(Math.max(1, ...main.map((p) => p.F)));
	const strip = $derived.by(() => {
		const out: { k: number; x: number; w: number; o: number }[] = [];
		for (let d = 0; d < cfg.span; d += 0.5) {
			if (d > day) break;
			const f = at(main, d + 0.25).F;
			out.push({ k: d, x: sx(d), w: sx(0.5) - sx(0) + 0.5, o: clamp(f / fMax) * 0.85 });
		}
		return out;
	});

	// ---- readouts ----------------------------------------------------------------------
	const fmtDay = (d: number) => (d < 10 ? d.toFixed(1) : d.toFixed(0));
	const lining = $derived.by(() => {
		const T0 = CAO.T0;
		const inf = now.I / T0;
		const res = now.R / T0;
		const lost = Math.max(0, 1 - (now.T + now.R + now.I) / T0);
		return { healthy: Math.max(0, 1 - inf - res - lost), res, inf, lost };
	});
	const pct = (v: number) => (v > 0 && v < 0.005 ? '<1' : String(Math.round(v * 100)));
	const worst = (s: readonly Sample[]) =>
		Math.max(...s.map((p) => (p.I + Math.max(0, CAO.T0 - p.T - p.R - p.I)) / CAO.T0));

	const first = $derived(r === null ? null : retime(raw, 0, cfg.span));
	const verdict = $derived.by(() => {
		if (r === null) {
			const c = clearedDay(main);
			const w = Math.round(worst(main) * 100);
			return c === null
				? {
						at: cfg.span,
						text: `Virus not cleared after ${cfg.span} days`,
						sub: `at worst ${w}% of the lining infected or lost`,
						ok: false
					}
				: {
						at: c,
						text: `Virus gone on day ${Math.round(c)}`,
						sub: `at worst ${w}% of the lining infected or lost`,
						ok: true
					};
		}
		const grew = peak(main, (p) => p.V, 0.1, cfg.span).v > CAO.V0;
		const c = clearedDay(main);
		const c1 = first ? clearedDay(first) : null;
		if (!grew)
			return {
				at: 2,
				text: 'Leftover antibodies stopped the virus at once',
				sub: 'it never grew: no illness',
				ok: true
			};
		return {
			at: c ?? cfg.span,
			text: c === null ? 'Virus not cleared' : `Virus gone after ${c.toFixed(1)} days`,
			sub: c1 === null ? '' : `first time: ${c1.toFixed(0)} days`,
			ok: true
		};
	});
	const verdictShow = $derived(reduced || done ? 1 : smoothstep(0, 0.6, day - verdict.at));

	/** First and second infection side by side (second-infection step only). */
	const compare = $derived.by(() => {
		if (r === null || !first) return null;
		const e1 = peak(first, effectors);
		const e2 = peak(main, effectors);
		const a1 = peak(first, antibody);
		const a2 = peak(main, antibody);
		const v1 = peak(first, (p) => p.V);
		const v2 = peak(main, (p) => p.V);
		return [
			{ id: 'cmp-v', label: 'virus at its peak', a: count(v1.v), b: count(v2.v) },
			{ id: 'cmp-e', label: 'killer T cells at peak', a: count(e1.v), b: count(e2.v) },
			{
				id: 'cmp-a',
				label: 'antibodies at peak (pg/mL)',
				a: `${count(a1.v)} · day ${Math.round(a1.t)}`,
				b: `${count(a2.v)} · day ${Math.round(a2.t)}`
			}
		];
	});
	const compareShow = $derived(reduced || done ? 1 : smoothstep(0, 1, day - 12));

	const rows = $derived([
		{ id: 'v', label: 'free virus', value: `${count(now.V)} /mL`, color: 'var(--im-virus)' },
		{
			id: 'f',
			label: 'interferon alarm',
			value: now.F < 0.05 ? 'off' : `${now.F.toFixed(1)}`,
			color: 'var(--im-interferon)'
		},
		{ id: 'e', label: 'killer T cells', value: count(effectors(now)), color: 'var(--im-tcell)' },
		{
			id: 'a',
			label: 'antibodies',
			value: `${count(antibody(now))} pg/mL`,
			color: 'var(--im-antibody)'
		}
	]);
</script>

<g>
	<!-- ===================== left: the moment at the cursor ===================== -->
	<Readout
		id="day"
		order={1}
		label={r === null ? 'Day' : 'Days after the second infection'}
		value={fmtDay(day)}
	>
		<text x={24} y={52} font-size="16" font-weight="600"
			>{r === null ? 'Day' : 'Day after the 2nd infection:'}
			{fmtDay(day)}</text
		>
	</Readout>

	<Readout
		id="lining"
		order={2}
		label={r === null ? 'Airway lining' : undefined}
		value="{pct(lining.healthy)}% healthy · {pct(lining.res)}% resistant · {pct(
			lining.inf
		)}% infected · {pct(lining.lost)}% lost"
	>
		<text x={24} y={86} font-size="12" font-weight="600">the airway lining</text>
		{@const W = 300}
		{@const segs = [
			{ k: 'h', v: lining.healthy, fill: 'var(--im-cell)', edge: 'var(--im-cell-edge)' },
			{ k: 'r', v: lining.res, fill: 'var(--im-resistant)', edge: 'var(--im-resistant-edge)' },
			{ k: 'i', v: lining.inf, fill: 'var(--im-infected)', edge: 'var(--im-infected-edge)' },
			{ k: 'l', v: lining.lost, fill: 'var(--im-dead)', edge: 'var(--stage-line)' }
		]}
		{@const xs = segs.reduce<number[]>((acc, s, i) => [...acc, acc[i] + s.v * W], [24])}
		{#each segs as s, i (s.k)}
			{#if s.v > 0.0005}
				<rect
					x={xs[i]}
					y={96}
					width={Math.max(2, s.v * W)}
					height={22}
					fill={s.fill}
					stroke={s.edge}
					stroke-width="1"
				/>
			{/if}
		{/each}
		<rect x={24} y={96} width={W} height={22} rx="3" fill="none" stroke="var(--stage-line)" />
		{#each [{ k: 'h', label: 'healthy', v: lining.healthy, c: 'var(--im-cell-edge)' }, { k: 'r', label: 'resistant', v: lining.res, c: 'var(--im-resistant-edge)' }, { k: 'i', label: 'infected', v: lining.inf, c: 'var(--im-infected-edge)' }, { k: 'l', label: 'lost', v: lining.lost, c: 'var(--stage-ink-muted)' }] as item, i (item.k)}
			<circle cx={30 + (i % 2) * 150} cy={138 + Math.floor(i / 2) * 18} r="4.5" fill={item.c} />
			<text x={39 + (i % 2) * 150} y={142 + Math.floor(i / 2) * 18} font-size="11" class="muted"
				>{item.label} {pct(item.v)}%</text
			>
		{/each}
	</Readout>

	{#each rows as row, i (row.id)}
		<Readout
			id="now-{row.id}"
			order={3 + i}
			label={r !== null ? undefined : row.label}
			value={row.value}
			color={row.color}
		>
			<circle cx={30} cy={198 + i * 26} r="5" fill={row.color} />
			<text x={42} y={202 + i * 26} font-size="13"
				>{row.label}
				<tspan font-weight="600" dx="4">{row.value}</tspan></text
			>
		</Readout>
	{/each}

	<Readout id="verdict" order={8} label={verdict.text} value={verdict.sub} opacity={verdictShow}>
		<g opacity={verdictShow}>
			<text
				x={24}
				y={320}
				font-size="15"
				font-weight="600"
				style:fill={verdict.ok ? undefined : 'var(--im-virus)'}>{verdict.text}</text
			>
			{#if verdict.sub}
				<text x={24} y={340} font-size="12" class="muted">{verdict.sub}</text>
			{/if}
		</g>
	</Readout>

	{#if compare}
		<Readout id="cmp-head">
			<g opacity={compareShow}>
				<text x={24} y={378} font-size="12" class="muted">at its peak</text>
				<text x={220} y={378} font-size="12" class="muted" text-anchor="end">first</text>
				<text x={330} y={378} font-size="12" font-weight="600" text-anchor="end">second</text>
				<line x1={24} x2={330} y1={386} y2={386} stroke="var(--stage-line)" />
			</g>
		</Readout>
		{#each compare as row, i (row.id)}
			<Readout
				id={row.id}
				order={9 + i}
				label={row.label}
				value="{row.a} → {row.b}"
				opacity={compareShow}
			>
				<g opacity={compareShow}>
					<text x={24} y={408 + i * 40} font-size="12">{row.label}</text>
					<text x={220} y={426 + i * 40} font-size="12" class="muted" text-anchor="end"
						>{row.a}</text
					>
					<text x={330} y={426 + i * 40} font-size="13" font-weight="600" text-anchor="end"
						>{row.b}</text
					>
				</g>
			</Readout>
		{/each}
	{/if}

	<!-- ===================== right: the charts ===================== -->
	<!-- virus -->
	<Axes
		{sx}
		sy={syV}
		xTicks={[]}
		yTicks={logTicks(10)}
		yFormat={pow10}
		yLabel="free virus, infectious doses per mL (log scale)"
	/>
	<line
		x1={X0}
		x2={X1}
		y1={syV(0)}
		y2={syV(0)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout id="cleared-key">
		<Label x={X1 - 4} y={syV(0) - 6} text="below 1: cleared" size={11} anchor="end" muted />
	</Readout>
	{#if ghost}
		<path
			d={pathV(ghost)}
			fill="none"
			stroke="var(--im-virus)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={pathV(shown)}
		fill="none"
		stroke="var(--im-virus)"
		stroke-width="2.6"
		stroke-linejoin="round"
	/>

	<!-- interferon strip -->
	<rect
		x={X0}
		y={STRIP.y0}
		width={X1 - X0}
		height={STRIP.y1 - STRIP.y0}
		fill="none"
		stroke="var(--stage-grid)"
	/>
	{#each strip as c (c.k)}
		<rect
			x={c.x}
			y={STRIP.y0}
			width={c.w}
			height={STRIP.y1 - STRIP.y0}
			fill="var(--im-interferon)"
			opacity={c.o}
		/>
	{/each}
	<Readout id="strip-key">
		<text x={X0 - 8} y={STRIP.y1 - 2} font-size="11" class="muted" text-anchor="end"
			>interferon</text
		>
	</Readout>

	<!-- killer T cells -->
	<Axes
		{sx}
		sy={syE}
		xTicks={[]}
		yTicks={logTicks(8)}
		yFormat={pow10}
		yLabel="killer T cells (log scale)"
	/>
	{#if ghost}
		<path
			d={pathE(ghost)}
			fill="none"
			stroke="var(--im-tcell)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={pathE(shown)}
		fill="none"
		stroke="var(--im-tcell)"
		stroke-width="2.6"
		stroke-linejoin="round"
	/>

	<!-- antibodies -->
	<Axes
		{sx}
		sy={syA}
		xTicks={days}
		yTicks={logTicks(5, 1).filter((n) => n % 2 === 0 || n === 5)}
		yFormat={pow10}
		xLabel={r === null ? 'days after infection' : 'days after each infection'}
		yLabel="antibodies, pg/mL (log scale)"
	/>
	{#if ghost}
		<path
			d={pathA(ghost)}
			fill="none"
			stroke="var(--im-antibody)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.5"
		/>
	{/if}
	<path
		d={pathAS(shown)}
		fill="none"
		stroke="var(--im-antibody)"
		stroke-width="1.4"
		stroke-dasharray="2 3"
	/>
	<path
		d={pathA(shown)}
		fill="none"
		stroke="var(--im-antibody)"
		stroke-width="2.6"
		stroke-linejoin="round"
	/>
	<Readout id="as-key">
		<g opacity={smoothstep(8, 10, day)}>
			<line
				x1={X1 - 178}
				x2={X1 - 160}
				y1={PA.y0 + 4}
				y2={PA.y0 + 4}
				stroke="var(--im-antibody)"
				stroke-width="1.4"
				stroke-dasharray="2 3"
			/>
			<text x={X1 - 154} y={PA.y0 + 8} font-size="11" class="muted">short-lived kind (IgM)</text>
		</g>
	</Readout>

	<!-- legend for the faint curves -->
	{#if ghostLabel}
		<Readout id="ghost-key" label="Dashed: {ghostLabel}">
			<line
				x1={X1 - 160}
				x2={X1 - 138}
				y1={34}
				y2={34}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
			<text x={X1 - 132} y={38} font-size="12" class="muted">{ghostLabel}</text>
		</Readout>
	{/if}

	<!-- cursor -->
	{#if !done}
		{#each [PV, PE, PA] as pn (pn.y0)}
			<line
				x1={sx(day)}
				x2={sx(day)}
				y1={pn.y0}
				y2={pn.y1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
				opacity="0.7"
			/>
		{/each}
		<circle cx={sx(day)} cy={syV(lg(now.V, -1))} r="4" fill="var(--im-virus)" />
		<circle cx={sx(day)} cy={syE(lg(effectors(now), 0))} r="3.5" fill="var(--im-tcell)" />
		<circle cx={sx(day)} cy={syA(lg(antibody(now), 0))} r="3.5" fill="var(--im-antibody)" />
	{/if}
</g>
