<script lang="ts">
	/**
	 * R₀ as a transmission tree, then as exponential growth in days.
	 *
	 * Phases (`step.hints.phase`):
	 *   tree   — one case, then its generations of cases, left to right, one
	 *            generation every ~1.5 s. Each case has either ⌊R₀⌋ or ⌈R₀⌉
	 *            children, handed out in order by error diffusion so that the
	 *            running average is R₀ (see `kids`). The newest generation is
	 *            infectious (red); earlier ones have recovered (grey). A
	 *            generation too big to draw as dots is a block with its count.
	 *   growth — the early SIR curve, cases ∝ e^{rt} with r = (R₀ − 1)/D, traced
	 *            over ~9 s, with a marker at every doubling (or halving) time.
	 *
	 * Chart axes (growth): the y axis is linear and fixed at 0–1,024 cases (2¹⁰),
	 * because a linear axis shows what the narrative is about — the first
	 * doublings hug the axis and look harmless, the last ones shoot up. The x axis
	 * spans ten doubling times, so the curve always runs from 1 to 1,024 cases
	 * with its ten ×2 markers evenly spaced, for any R₀ (0.5–8) and D (2–14 days),
	 * whose doubling times range from 0.2 to ~100 days. Since that makes the
	 * curve's shape the same for every setting, the default curve (R₀ = 3,
	 * 7 days) is drawn dashed for comparison whenever the settings differ, and the
	 * axis rescales with a tween. A shrinking outbreak (R₀ < 1) starts from 1,024
	 * cases and halves ten times; at R₀ = 1 the line stays level.
	 *
	 * Everything is a pure function of `t`, except the phase cross-fade and the
	 * rescaling of the axes and columns, which are tweens.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, linear } from 'svelte/easing';
	import { Axes, Label, clamp, linePath, niceMax, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { doublingTime, growthRate } from '../model';
	import { DEFAULTS, settings } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'tree'));
	const opts = $derived(settings(step, params));
	const r0 = $derived(opts.r0);
	const days = $derived(opts.days);
	/** Pure function of `t`; under reduced motion everything is complete. */
	const clock = $derived(reduced ? 1e6 : t);
	const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

	// ---- phase cross-fade (sequential, so the two layouts never overlap) ---------
	const MIX_MS = 1000;
	const mix = new Tween(untrack(() => phase) === 'growth' ? 1 : 0, {
		duration: MIX_MS,
		easing: linear
	});
	$effect(() => {
		const target = phase === 'growth' ? 1 : 0;
		const duration = reduced ? 0 : MIX_MS;
		untrack(() => mix.set(target, { duration }));
	});
	const treeOpacity = $derived(1 - smoothstep(0, 0.5, mix.current));
	const chartOpacity = $derived(smoothstep(0.5, 1, mix.current));

	// ================================================================== the tree
	const YT = 136;
	const YB = 484;
	const YM = (YT + YB) / 2;
	const H = YB - YT;
	const X0 = 156;
	const X1 = 852;
	/** Largest generation drawn as individual dots; bigger ones are blocks. */
	const CAP = 125;
	/** Smallest spacing between dots before a generation splits into sub-columns. */
	const MIN_PITCH = 8;
	const BLOCK_W = 84;

	interface Dot {
		x: number;
		y: number;
		/** Index of the parent within the previous generation. */
		parent: number;
	}
	interface Gen {
		g: number;
		n: number;
		block: boolean;
		dots: Dot[];
		/** Dot radius. */
		r: number;
		/** Block height. */
		bh: number;
	}

	/** Positions of `n` dots (relative x, absolute y), in parent order. */
	function place(parents: number[]) {
		const n = parents.length;
		const cols = Math.max(1, Math.ceil((n * MIN_PITCH) / H));
		const rows = Math.ceil(n / cols);
		const pitch = Math.min(116, H / Math.max(1, rows));
		const dots = parents.map((parent, k) => ({
			x: ((k % cols) - (cols - 1) / 2) * pitch,
			y: YM + (Math.floor(k / cols) - (rows - 1) / 2) * pitch,
			parent
		}));
		return { dots, r: n === 1 ? 10 : clamp(pitch * 0.36, 2.4, 9) };
	}

	const gens = $derived.by(() => {
		// R₀ in tenths, so that the arithmetic is exact.
		const tenths = Math.round(r0 * 10);
		const whole = Math.floor(tenths / 10);
		const frac = tenths % 10;
		// Cumulative number of "extra" children among the first i cases, ⌈i·frac/10⌉:
		// case i has ⌊R₀⌋ + C(i+1) − C(i) children, i.e. ⌊R₀⌋ or ⌈R₀⌉, and the
		// first i cases have i·R₀ children rounded up — the average is R₀.
		const C = (i: number) => Math.floor((i * frac + 9) / 10);
		const kids = (i: number) => whole + C(i + 1) - C(i);
		const last = r0 < 1 ? 14 : 4;
		const out: Gen[] = [];
		let parents = [-1];
		let start = 0;
		let n = 1;
		for (let g = 0; ; g++) {
			const block = n > CAP;
			const { dots, r } = block ? { dots: [], r: 0 } : place(parents);
			const bh = block ? clamp(150 + 70 * Math.log10(n / CAP), 150, H) : 0;
			out.push({ g, n, block, dots, r, bh });
			if (n === 0 || g >= last) break;
			const next = whole * n + C(start + n) - C(start);
			parents = [];
			if (next <= CAP) {
				for (let j = 0; j < n; j++) {
					for (let k = kids(start + j); k > 0; k--) parents.push(j);
				}
			}
			start += n;
			n = next;
		}
		return out;
	});
	const lastGen = $derived(gens[gens.length - 1]);
	const diedOut = $derived(lastGen.n === 0);
	const totalCases = $derived(gens.reduce((s, g) => s + g.n, 0));

	// Column spacing follows the number of generations shown (5, or up to 11 for
	// a chain that dies out slowly), smoothly.
	const cols = new Tween(
		untrack(() => gens.length),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const target = gens.length;
		const duration = reduced ? 0 : 700;
		untrack(() => cols.set(target, { duration }));
	});
	const colX = (g: number) => X0 + (g * (X1 - X0)) / Math.max(1, cols.current - 1);

	// Timing: one generation every `interval` seconds (faster for long chains).
	const LEAD = 0.7;
	const interval = $derived(Math.min(1.5, 10 / Math.max(1, gens.length - 1)));
	const startOf = (g: number) => LEAD + (g - 1) * interval;
	/** How far the edges into generation g have grown, 0–1. */
	const grow = (g: number) => (g === 0 ? 1 : smoothstep(startOf(g), startOf(g) + 0.75, clock));
	/** Opacity of the cases of generation g. */
	const appear = (g: number) =>
		g === 0 ? smoothstep(0, 0.5, clock) : smoothstep(startOf(g) + 0.5, startOf(g) + 0.95, clock);
	/** 1 while generation g is the newest one shown (infectious), 0 once recovered. */
	const ill = (g: number) => appear(g) * (g + 1 < gens.length ? 1 - appear(g + 1) : 1);
	const tint = (u: number) =>
		`color-mix(in srgb, var(--sir-i) ${Math.round(u * 100)}%, var(--sir-r))`;

	/** Static geometry: edges between generations, recomputed only when the layout changes. */
	const edges = $derived.by(() => {
		const out: { id: string; g: number; d: string; w: number }[] = [];
		for (let gi = 1; gi < gens.length; gi++) {
			const gen = gens[gi];
			const prev = gens[gi - 1];
			const xa = colX(gi - 1);
			const xb = colX(gi);
			if (gen.n === 0 || prev.block) continue;
			const w = gen.n > 40 ? 0.9 : gen.n > 12 ? 1.2 : 1.6;
			if (!gen.block) {
				gen.dots.forEach((c, k) => {
					const p = prev.dots[c.parent];
					const x1 = xa + p.x + prev.r;
					const x2 = xb + c.x - gen.r;
					const mx = (x1 + x2) / 2;
					out.push({
						id: `${gi}-${k}`,
						g: gi,
						w,
						d: `M${x1.toFixed(1)} ${p.y.toFixed(1)}C${mx.toFixed(1)} ${p.y.toFixed(1)} ${mx.toFixed(1)} ${c.y.toFixed(1)} ${x2.toFixed(1)} ${c.y.toFixed(1)}`
					});
				});
			} else {
				// Every case of the previous generation feeds into the block.
				const top = YM - gen.bh / 2;
				prev.dots.forEach((p, j) => {
					const x1 = xa + p.x + prev.r;
					const x2 = xb - BLOCK_W / 2;
					const y2 = top + ((j + 0.5) / prev.n) * gen.bh;
					const mx = (x1 + x2) / 2;
					out.push({
						id: `${gi}-${j}`,
						g: gi,
						w,
						d: `M${x1.toFixed(1)} ${p.y.toFixed(1)}C${mx.toFixed(1)} ${p.y.toFixed(1)} ${mx.toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
					});
				});
			}
		}
		return out;
	});

	/** Bands between two consecutive blocks, grown from left to right. */
	const bands = $derived(
		gens
			.filter((gen, gi) => gi > 0 && gen.block && gens[gi - 1].block)
			.map((gen) => {
				const prev = gens[gen.g - 1];
				const u = grow(gen.g);
				const xa = colX(gen.g - 1) + BLOCK_W / 2;
				const xb = colX(gen.g) - BLOCK_W / 2;
				const xe = xa + (xb - xa) * u;
				const ha = prev.bh / 2;
				const he = ha + (gen.bh / 2 - ha) * u;
				const mx = (xa + xe) / 2;
				return {
					g: gen.g,
					u,
					d: `M${xa} ${YM - ha}C${mx} ${YM - ha} ${mx} ${YM - he} ${xe} ${YM - he}L${xe} ${YM + he}C${mx} ${YM + he} ${mx} ${YM + ha} ${xa} ${YM + ha}Z`
				};
			})
	);

	const revealed = $derived(gens.filter((g) => appear(g.g) > 0.5));
	const sequence = $derived(revealed.map((g) => fmt(g.n)).join(' → '));
	const isWhole = $derived(Math.round(r0 * 10) % 10 === 0);
	const treeStatus = $derived(
		r0 > 1
			? `Each generation is ${isWhole ? '' : 'about '}R₀ times the one before: ${sequence}`
			: r0 === 1
				? 'Each case is replaced by exactly one: the chain neither grows nor shrinks'
				: diedOut && appear(lastGen.g) > 0.5
					? `Fewer than one new case per case: the chain died out after ${totalCases} case${totalCases === 1 ? '' : 's'}`
					: 'Fewer than one new case per case, on average'
	);

	// ================================================================ the growth
	const PX0 = 96;
	const PX1 = 900;
	const CT = 168;
	const CB = 470;
	const TOP = 1024;
	const DOUBLINGS = 10;
	const TRACE_FROM = 1.0;
	const TRACE_FOR = 9;

	const rate = $derived(growthRate(r0, days));
	const growing = $derived(r0 > 1 + 1e-9);
	const level = $derived(Math.abs(r0 - 1) < 1e-9);
	/** Doubling time, or halving time ln 2 / |r| when shrinking. */
	const every = $derived(
		level ? Infinity : growing ? doublingTime(r0, days) : Math.LN2 / Math.abs(rate)
	);
	const start = $derived(growing ? 1 : TOP);
	const span = $derived(level ? 10 * days : DOUBLINGS * every);
	const casesAt = (d: number) => start * Math.exp(rate * d);

	/** Right end of the x axis: just past the curve's end, rounded up to a round tick step. */
	const axisEnd = (v: number) => {
		const tick = niceMax((v * 1.06) / 6);
		return Math.ceil((v * 1.06) / tick) * tick;
	};
	const xMaxT = new Tween(
		untrack(() => axisEnd(span)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const target = axisEnd(span);
		const duration = reduced ? 0 : 700;
		untrack(() => xMaxT.set(target, { duration }));
	});
	const sx = $derived(scale([0, xMaxT.current], [PX0, PX1]));
	const sy = scale([0, TOP], [CB, CT]);

	const traceU = $derived(reduced ? 1 : clamp((t - TRACE_FROM) / TRACE_FOR));
	const nowDay = $derived(span * traceU);
	const curve = $derived(
		Array.from({ length: 161 }, (_, k) => {
			const d = (nowDay * k) / 160;
			return { d, v: casesAt(d) };
		})
	);
	const curvePath = $derived(
		linePath(
			curve,
			(p) => p.d,
			(p) => p.v,
			sx,
			sy
		)
	);
	const markers = $derived(
		level
			? []
			: Array.from({ length: DOUBLINGS }, (_, i) => {
					const k = i + 1;
					return {
						k,
						d: k * every,
						v: growing ? 2 ** k : TOP / 2 ** k,
						a: smoothstep(k / DOUBLINGS - 0.025, k / DOUBLINGS, traceU),
						text: `${growing ? '×' : '÷'}${fmt(2 ** k)}`
					};
				})
	);

	// The default curve, for comparison, whenever the settings differ.
	const REF_EVERY = doublingTime(DEFAULTS.r0, DEFAULTS.days);
	const showRef = $derived(growing && (r0 !== DEFAULTS.r0 || days !== DEFAULTS.days));
	const refPath = $derived.by(() => {
		const end = Math.min(DOUBLINGS * REF_EVERY, xMaxT.current);
		const rr = growthRate(DEFAULTS.r0, DEFAULTS.days);
		const pts = Array.from({ length: 121 }, (_, k) => (end * k) / 120);
		return linePath(
			pts,
			(d) => d,
			(d) => Math.exp(rr * d),
			sx,
			sy
		);
	});

	const fmtDays = (v: number) => (v < 10 ? v.toFixed(1) : v.toFixed(0));
	const headline = $derived(
		level
			? { lead: 'Cases stay level:', value: 'no doubling, no halving' }
			: growing
				? { lead: 'Cases double every', value: `${fmtDays(every)} days` }
				: { lead: 'Cases halve every', value: `${fmtDays(every)} days` }
	);
	const formula = $derived(
		`growth rate r = (R₀ − 1) / D = (${r0.toFixed(1)} − 1) / ${days} days = ${rate.toFixed(2)} per day` +
			(level ? '' : growing ? ' · doubling time = ln 2 / r' : ' · halving time = ln 2 / |r|')
	);
	const dayText = $derived(span < 10 ? nowDay.toFixed(1) : Math.floor(nowDay).toString());
	const nowCases = $derived(casesAt(nowDay));
	const growthStatus = $derived(
		`Day ${dayText}: ${fmt(nowCases)} case${Math.round(nowCases) === 1 ? '' : 's'}` +
			(level ? '' : growing ? ', starting from 1' : ', starting from 1,024')
	);
	const xFormat = (v: number) => String(Number(v.toPrecision(3)));
</script>

<g>
	<!-- ============================================================== tree -->
	{#if treeOpacity > 0.001}
		<g opacity={treeOpacity}>
			<text x={36} y={62} font-size="16" font-weight="600"
				>Each case infects <tspan fill="var(--sir-i)">R₀ = {r0.toFixed(1)}</tspan> people on average</text
			>
			<Label x={36} y={88} text={treeStatus} size={12} anchor="start" muted />

			<!-- legend -->
			<circle cx={716} cy={58} r="5" fill="var(--sir-i)" />
			<text x={727} y={62} font-size="12">infectious now</text>
			<circle cx={838} cy={58} r="5" fill="var(--sir-r)" />
			<text x={849} y={62} font-size="12">recovered</text>

			<!-- edges, grown from parent to child -->
			{#each edges as e (e.id)}
				{@const u = grow(e.g)}
				{#if u > 0}
					<path
						d={e.d}
						fill="none"
						style:stroke={tint(ill(e.g))}
						stroke-width={e.w}
						opacity={0.6}
						pathLength="1"
						stroke-dasharray={u < 1 ? '1 1' : undefined}
						stroke-dashoffset={u < 1 ? 1 - u : undefined}
					/>
				{/if}
			{/each}
			{#each bands as b (b.g)}
				{#if b.u > 0}
					<path d={b.d} style:fill={tint(ill(b.g))} opacity={0.18} />
				{/if}
			{/each}

			<!-- cases -->
			{#each gens as gen (gen.g)}
				{@const a = appear(gen.g)}
				{@const x = colX(gen.g)}
				{@const fill = tint(ill(gen.g))}
				{#if a > 0}
					{#if gen.block}
						<g opacity={a}>
							<rect
								x={x - BLOCK_W / 2}
								y={YM - gen.bh / 2}
								width={BLOCK_W}
								height={gen.bh}
								rx="10"
								style:fill
								style:stroke={fill}
								fill-opacity="0.2"
								stroke-width="1.5"
							/>
							<text
								{x}
								y={YM + 2}
								text-anchor="middle"
								font-size="18"
								font-weight="600"
								style:font-variant-numeric="tabular-nums">{fmt(gen.n)}</text
							>
							<text {x} y={YM + 20} text-anchor="middle" font-size="11" class="muted">cases</text>
						</g>
					{:else if gen.n === 0}
						<circle
							cx={x}
							cy={YM}
							r="10"
							fill="none"
							stroke="var(--stage-ink-muted)"
							stroke-width="1.5"
							stroke-dasharray="3 3"
							opacity={a}
						/>
						<Label {x} y={YM - 22} text="died out" size={13} muted opacity={a} />
					{:else}
						<g opacity={a}>
							{#each gen.dots as d, k (k)}
								<circle cx={x + d.x} cy={d.y} r={gen.r} style:fill />
							{/each}
						</g>
					{/if}
				{/if}
			{/each}

			<!-- generation numbers and counts -->
			<text x={36} y={526} font-size="11" class="muted">generation</text>
			<text x={36} y={552} font-size="12" class="muted">cases</text>
			{#each gens as gen (gen.g)}
				{@const a = appear(gen.g)}
				<text
					x={colX(gen.g)}
					y={526}
					text-anchor="middle"
					font-size="11"
					class="muted"
					opacity={0.4 + 0.6 * a}>{gen.g}</text
				>
				<text
					x={colX(gen.g)}
					y={553}
					text-anchor="middle"
					font-size="15"
					font-weight="600"
					opacity={a}
					style:fill={gen.n > 0 && ill(gen.g) > 0.5 ? 'var(--sir-i)' : undefined}
					style:font-variant-numeric="tabular-nums">{fmt(gen.n)}</text
				>
			{/each}
		</g>
	{/if}

	<!-- ============================================================ growth -->
	{#if chartOpacity > 0.001}
		<g opacity={chartOpacity}>
			<text x={36} y={60} font-size="22" font-weight="600"
				>{headline.lead}
				<tspan fill={growing || level ? 'var(--sir-i)' : 'var(--sir-s)'}>{headline.value}</tspan
				></text
			>
			<text x={36} y={88} font-size="12" class="muted">{formula}</text>

			<!-- legend -->
			<line x1={PX0} x2={PX0 + 22} y1={120} y2={120} stroke="var(--sir-i)" stroke-width="2.6" />
			<text x={PX0 + 30} y={124} font-size="12"
				>R₀ = {r0.toFixed(1)}, infectious for {days} days</text
			>
			{#if showRef}
				<line
					x1={PX0 + 290}
					x2={PX0 + 312}
					y1={120}
					y2={120}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.6"
					stroke-dasharray="5 4"
				/>
				<text x={PX0 + 320} y={124} font-size="12" class="muted"
					>R₀ = {DEFAULTS.r0.toFixed(1)}, {DEFAULTS.days} days, for comparison</text
				>
			{/if}

			<Axes
				{sx}
				{sy}
				xLabel="days since the first case"
				yLabel="cases"
				yTicks={[0, 256, 512, 768, 1024]}
				yFormat={fmt}
				{xFormat}
			/>

			<clipPath id="tree-chart-clip">
				<rect x={PX0 - 40} y={CT - 30} width={PX1 - PX0 + 80} height={CB - CT + 40} />
			</clipPath>
			<g clip-path="url(#tree-chart-clip)">
				{#if showRef}
					<path
						d={refPath}
						fill="none"
						stroke="var(--stage-ink-muted)"
						stroke-width="1.6"
						stroke-dasharray="5 4"
						opacity="0.7"
					/>
				{/if}

				<!-- one marker per doubling (or halving) time -->
				{#each markers as m (m.k)}
					{#if m.a > 0}
						<line
							x1={sx(m.d)}
							x2={sx(m.d)}
							y1={sy(m.v)}
							y2={CB}
							stroke="var(--stage-ink-muted)"
							stroke-dasharray="2 3"
							opacity={0.55 * m.a}
						/>
					{/if}
				{/each}

				<path
					d={curvePath}
					fill="none"
					stroke="var(--sir-i)"
					stroke-width="2.6"
					stroke-linejoin="round"
				/>

				{#each markers as m (m.k)}
					{#if m.a > 0}
						<circle
							cx={sx(m.d)}
							cy={sy(m.v)}
							r="3.5"
							fill="var(--stage-bg)"
							stroke="var(--sir-i)"
							stroke-width="2"
							opacity={m.a}
						/>
						<Label
							x={growing ? sx(m.d) - 7 : sx(m.d) + 7}
							y={sy(m.v) - 9}
							text={m.text}
							size={12}
							weight={600}
							anchor={growing ? 'end' : 'start'}
							opacity={m.a}
						/>
					{/if}
				{/each}

				{#if traceU < 1}
					<circle cx={sx(nowDay)} cy={sy(nowCases)} r="5.5" fill="var(--sir-i)" />
				{/if}
			</g>

			<Label x={PX0} y={548} text={growthStatus} size={13} anchor="start" />
			<text x={PX1} y={548} font-size="11" class="muted" text-anchor="end"
				>{level
					? 'each case is replaced by exactly one'
					: `${growing ? '×2' : '÷2'} every ${fmtDays(every)} days, whatever the size`}</text
			>
		</g>
	{/if}
</g>
