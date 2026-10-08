<script lang="ts">
	/**
	 * The food web (steps `web` and `newcomer`). Left: who eats whom — willow at
	 * the bottom, the animals that browse it above, wolves on top — with arrows
	 * from food to eater and nodes sized by the current population. Right: each
	 * species' numbers over time as small multiples, with a marker wherever the
	 * reader switched a species on or off. Bottom left: a one-line summary of
	 * what the change did once the web has settled.
	 *
	 * Switching a species does not restart the run: the web carries on from
	 * the populations of that moment with the new set of species (one
	 * "segment" per change, each integrated once with `eco.ts`). About one
	 * simulated year passes per second of animation.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { scale, linePath, niceMax, smoothstep, clamp } from '#lib/draw/index.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { EATS, SPECIES, WEB_START, foodWeb, run, type Species, type State } from '../eco';

	let { step, t, params, reduced }: StageProps = $props();

	/** Simulated years per segment (deer need ~45 years to push the elk out); then the web holds. */
	const SEG = 60;
	/** Sampling interval of the runs, in years. */
	const SAMPLE = 0.25;
	/** Simulated years per second of animation. */
	const YEARS_PER_S = 1;
	/** Population a species starts from when it is switched on (back) with none left. */
	const SEED = 5;
	/** Segments kept on the chart (older ones scroll off). */
	const KEEP = 10;

	const IDX: Record<Species, number> = { willow: 0, elk: 1, beaver: 2, wolf: 3, deer: 4 };
	const PLURAL: Record<Species, string> = {
		willow: 'willow',
		elk: 'elk',
		beaver: 'beavers',
		wolf: 'wolves',
		deer: 'deer'
	};
	const COLOR: Record<Species, string> = {
		willow: 'var(--eco-willow)',
		elk: 'var(--eco-elk)',
		beaver: 'var(--eco-beaver)',
		wolf: 'var(--eco-wolf)',
		deer: 'var(--eco-deer)'
	};
	// Rising and falling populations (no dedicated tokens yet; a ▲/▼ glyph and a solid or
	// dashed ring back up the colour).
	const RISE = 'var(--eco-rise)';
	const FALL = 'var(--eco-fall)';
	const RIPPLE = 'var(--accent)';
	/** Node size reference: the starting population (deer, absent at the start, use the elk's). */
	const REF = [WEB_START[0], WEB_START[1], WEB_START[2], WEB_START[3], WEB_START[1]];
	/** "Settled" tolerance per species: 2% of its usual size (absolute, so a species heading to 0 settles). */
	const TOL = REF.map((v) => 0.02 * Math.max(v, 10));

	const newcomer = $derived(step.id === 'newcomer');
	const present = $derived([
		true,
		params.elk !== false,
		params.beavers !== false,
		params.wolves !== false,
		newcomer && params.deer === true
	]);
	const presentKey = $derived(present.map((p) => (p ? 1 : 0)).join(''));

	// ---- the segments ----------------------------------------------------------------

	interface Segment {
		/** Clock reading when the change happened. */
		t0: number;
		/** Simulated year at which the segment starts. */
		year0: number;
		present: boolean[];
		/** Species whose presence changed at the start of this segment (the ripple's sources). */
		sources: number[];
		/** Population samples every SAMPLE years for SEG years. */
		run: State[];
		/** Years after which every species stays close to its final value. */
		settle: number;
		/** Hops through the web from the changed species to each species. */
		dist: number[];
	}

	function settleTime(r: State[]) {
		const end = r[r.length - 1];
		let i = r.length - 1;
		while (i > 0 && r[i - 1].every((v, k) => Math.abs(v - end[k]) <= TOL[k])) i--;
		return i * SAMPLE;
	}

	/** Hops from the changed species through the web (only through species present). */
	function distances(pres: boolean[], sources: number[]) {
		const dist = SPECIES.map(() => Infinity);
		const queue = [...sources];
		for (const s of sources) dist[s] = 0;
		while (queue.length) {
			const a = queue.shift()!;
			for (const [c, r] of EATS) {
				const [i, j] = [IDX[c], IDX[r]];
				const other = i === a ? j : j === a ? i : -1;
				if (other >= 0 && pres[other] && dist[other] === Infinity) {
					dist[other] = dist[a] + 1;
					queue.push(other);
				}
			}
		}
		return dist;
	}

	function makeSegment(
		t0: number,
		year0: number,
		start: State,
		prev: boolean[],
		pres: boolean[]
	): Segment {
		const sources = SPECIES.map((_, i) => i).filter((i) => pres[i] !== prev[i]);
		// Removed species drop to 0; a species switched on with none left starts at SEED.
		const y0 = start.map((v, i) => (!pres[i] ? 0 : !prev[i] && v < 0.5 ? SEED : v));
		const r = run(foodWeb(pres), y0, SEG, SAMPLE);
		return {
			t0,
			year0,
			present: [...pres],
			sources,
			run: r,
			settle: settleTime(r),
			dist: distances(pres, sources)
		};
	}

	function stateAt(seg: Segment, years: number): State {
		const f = clamp(years, 0, SEG) / SAMPLE;
		const i = Math.min(seg.run.length - 2, Math.floor(f));
		const u = f - i;
		return seg.run[i].map((v, k) => v + (seg.run[i + 1][k] - v) * u);
	}

	/** Years elapsed in a segment at clock reading `clock`; under reduced motion the whole run after a change (a short stretch of the unchanged start). */
	const elapsed = (seg: Segment, clock: number) =>
		reduced ? (seg.sources.length ? SEG : 10) : clamp((clock - seg.t0) * YEARS_PER_S, 0, SEG);

	// The list of segments is a frame-to-frame memo inside a $derived (the scene guide's
	// sanctioned accumulator): a toggle continues the run from the populations of that
	// moment, which a pure function of t cannot know. It restarts from the starting
	// community on a step change or when the clock is reset (t goes back). Under reduced
	// motion every segment is shown complete and the next one starts from its end.
	const DEFAULT_PRESENT = [true, true, true, true, false];
	let memo: { stepId: string; key: string; reduced: boolean; segs: Segment[] } = {
		stepId: '',
		key: '',
		reduced: false,
		segs: []
	};
	const segments = $derived.by(() => {
		const last = memo.segs[memo.segs.length - 1];
		if (!last || memo.stepId !== step.id || memo.reduced !== reduced || (!reduced && t < last.t0)) {
			memo = {
				stepId: step.id,
				key: presentKey,
				reduced,
				segs: [makeSegment(t, 0, WEB_START, DEFAULT_PRESENT, present)]
			};
		} else if (presentKey !== memo.key) {
			const years = elapsed(last, t);
			const seg = makeSegment(t, last.year0 + years, stateAt(last, years), last.present, present);
			memo = { ...memo, key: presentKey, segs: [...memo.segs, seg].slice(-KEEP) };
		}
		return memo.segs;
	});

	const current = $derived(segments[segments.length - 1]);
	const tau = $derived(elapsed(current, t));
	const year = $derived(current.year0 + tau);
	const pops = $derived(stateAt(current, tau));
	/** Relative rate of change per year, from the run around now. */
	const trend = $derived.by(() => {
		if (reduced) return SPECIES.map(() => 0);
		const a = stateAt(current, tau - 0.5);
		const b = stateAt(current, tau + 0.5);
		return a.map((v, i) => (current.present[i] ? (b[i] - v) / Math.max(1, pops[i]) : 0));
	});

	// ---- the web ---------------------------------------------------------------------

	// The wolf sits above the elk on `web`, above elk and deer on `newcomer`.
	const wolfX = new Tween(130, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const x = newcomer ? 200 : 130;
		untrack(() => wolfX.set(x, { duration: reduced ? 0 : 800 }));
	});
	const POS: Record<Species, [number, number]> = {
		willow: [270, 430],
		elk: [130, 275],
		beaver: [410, 275],
		wolf: [130, 138],
		deer: [270, 275]
	};
	const pos = (s: Species): [number, number] => (s === 'wolf' ? [wolfX.current, 138] : POS[s]);
	const shown = $derived(SPECIES.filter((s) => s !== 'deer' || newcomer));

	type NodeState = 'live' | 'gone' | 'off' | 'notyet';
	const nodes = $derived(
		shown.map((s) => {
			const i = IDX[s];
			const n = pops[i];
			const state: NodeState = !current.present[i]
				? s === 'deer'
					? 'notyet'
					: 'off'
				: n < 0.5
					? 'gone'
					: 'live';
			const r = state === 'live' ? clamp(30 * Math.sqrt(n / REF[i]), 7, 46) : 18;
			const [x, y] = pos(s);
			const rate = trend[i];
			const halo = state === 'live' ? smoothstep(0.004, 0.03, Math.abs(rate)) : 0;
			return { s, i, x, y, r, n, state, rate, halo };
		})
	);
	const nodeOf = (s: Species) => nodes.find((d) => d.s === s);

	/** Ripple brightness on a link `hop` steps from the change (0 when not glowing). */
	function glowAt(hop: number) {
		if (reduced || !isFinite(hop) || hop < 1) return { k: 0, u: 0 };
		const s = (hop - 1) * 1.3 + 0.3;
		const k = smoothstep(s, s + 0.3, tau) * (1 - smoothstep(s + 1.6, s + 2.4, tau));
		return { k, u: clamp((tau - s) / 1.4, 0, 1) };
	}

	const links = $derived(
		EATS.map(([consumer, food]) => {
			const a = nodeOf(food);
			const b = nodeOf(consumer);
			if (!a || !b) return null;
			const live = a.state === 'live' && b.state === 'live';
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy) || 1;
			const [ux, uy] = [dx / len, dy / len];
			const x1 = a.x + ux * (a.r + 5);
			const y1 = a.y + uy * (a.r + 5);
			const x2 = b.x - ux * (b.r + 8);
			const y2 = b.y - uy * (b.r + 8);
			// The ripple travels from the end nearer the change to the farther one.
			const [da, db] = [current.dist[a.i], current.dist[b.i]];
			const involved = (current.present[a.i] || da === 0) && (current.present[b.i] || db === 0);
			const g = involved ? glowAt(Math.max(da, db)) : { k: 0, u: 0 };
			const u = da <= db ? g.u : 1 - g.u;
			return {
				id: `${food}-${consumer}`,
				d: `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`,
				live,
				glow: g.k,
				dot: [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u] as [number, number]
			};
		}).filter((l) => l !== null)
	);

	// ---- the summary -----------------------------------------------------------------

	const fmtPct = (p: number) => `${p >= 0 ? '+' : '−'}${Math.abs(Math.round(p * 100))}%`;
	const nameList = (xs: string[]) =>
		xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

	const summary = $derived.by(() => {
		const seg = current;
		if (seg.sources.length === 0) {
			return {
				line: newcomer
					? 'In balance. Switch the deer on and watch for a few decades.'
					: 'In balance: nothing changes until a species is switched off.',
				sub: 'Each species is held in check by its food and its predators.'
			};
		}
		if (tau < seg.settle) {
			const order = SPECIES.map((_, i) => i)
				.filter((i) => isFinite(seg.dist[i]))
				.sort((a, b) => seg.dist[a] - seg.dist[b])
				.map((i) => PLURAL[SPECIES[i]]);
			return {
				line: `Following the ripples: ${order.join(' → ')}…`,
				sub: `${Math.floor(tau)} years since the change`
			};
		}
		const removed = [IDX.wolf, IDX.elk, IDX.beaver].filter((i) => !seg.present[i]);
		const added = seg.present[IDX.deer];
		const prefix = [
			added ? 'With deer' : '',
			removed.length
				? `${added ? 'without' : 'Without'} ${nameList(removed.map((i) => PLURAL[SPECIES[i]]))}`
				: ''
		]
			.filter(Boolean)
			.join(', ');
		const end = seg.run[seg.run.length - 1];
		const parts = SPECIES.map((s, i) => ({ s, i }))
			.filter(({ s, i }) => seg.present[i] && s !== 'deer')
			.map(({ s, i }) => {
				const gone = end[i] < 1;
				const p = end[i] / WEB_START[i] - 1;
				return {
					p: gone ? -1.01 : p,
					text: gone ? `${PLURAL[s]} gone` : `${PLURAL[s]} ${fmtPct(p)}`
				};
			})
			.filter((d) => Math.abs(d.p) >= 0.03)
			.sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
		const body = parts.length
			? parts.map((d) => d.text).join(', ')
			: 'back to the starting balance';
		return {
			line: `${prefix || 'Everyone back'}: ${body}`,
			sub:
				parts.length >= 2 && prefix
					? `The change rippled through ${parts.length} other species · settled after about ${Math.max(1, Math.round(seg.settle))} years · % vs the start`
					: `Settled after about ${Math.max(1, Math.round(seg.settle))} years · compared with the starting numbers`
		};
	});

	// ---- the chart -------------------------------------------------------------------

	const CX0 = 588;
	const CX1 = 928;
	const CY0 = 96;
	const CY1 = 516;
	const rows = $derived(
		(['wolf', 'elk', 'deer', 'beaver', 'willow'] as Species[]).filter(
			(s) => s !== 'deer' || newcomer
		)
	);
	const xDomain = $derived<[number, number]>([
		segments[0].year0,
		Math.max(segments[0].year0 + SEG, current.year0 + SEG)
	]);
	const sx = $derived(scale(xDomain, [CX0, CX1]));
	const rowH = $derived((CY1 - CY0) / rows.length);

	/** Everything that only changes with a toggle: scales and the full path of each run. */
	const chart = $derived(
		rows.map((s, k) => {
			const i = IDX[s];
			let max = WEB_START[i] || 10;
			for (const seg of segments) for (const y of seg.run) max = Math.max(max, y[i]);
			const top = CY0 + k * rowH + 24;
			const bottom = CY0 + (k + 1) * rowH - 6;
			const yMax = niceMax(max * 1.05);
			const sy = scale([0, yMax], [bottom, top]);
			const paths = segments.map((seg, j) => ({
				j,
				d: linePath(
					seg.run.map((y, n) => [seg.year0 + n * SAMPLE, y[i]] as const),
					(d) => d[0],
					(d) => d[1],
					sx,
					sy
				),
				absent: !seg.present[i]
			}));
			return { s, i, top, bottom, yMax, sy, paths };
		})
	);

	/** Where each segment's curve is cut: at the next change, or at "now" for the last one. */
	const clips = $derived(
		segments.map((seg, j) => {
			const endYear = j < segments.length - 1 ? segments[j + 1].year0 : year;
			return { j, x: sx(seg.year0), w: Math.max(0, sx(endYear) - sx(seg.year0)) };
		})
	);

	const markers = $derived.by(() => {
		let lastX = -Infinity;
		let lastW = 0;
		let row = 0;
		return segments
			.map((seg, j) => ({ seg, j }))
			.filter(({ seg }) => seg.sources.length > 0 && seg.year0 > xDomain[0] + 1e-9)
			.map(({ seg, j }) => {
				const x = sx(seg.year0);
				const text = seg.sources
					.map((i) => `${PLURAL[SPECIES[i]]} ${seg.present[i] ? 'in' : 'out'}`)
					.join(', ');
				row = x - lastX < lastW ? (row + 1) % 2 : 0;
				lastX = x;
				lastW = text.length * 6.2 + 10;
				return { j, x, text, row };
			});
	});

	const yearTicks = $derived.by(() => {
		const [a, b] = xDomain;
		const every = b - a > 120 ? 40 : 20;
		const out: number[] = [];
		for (let v = Math.ceil(a / every) * every; v <= b + 1e-9; v += every) out.push(v);
		return out;
	});

	const LEVELS = [
		{ y: 138, label: 'hunters' },
		{ y: 275, label: 'plant eaters' },
		{ y: 430, label: 'plants' }
	];
</script>

<g>
	<!-- ===== the web ===== -->
	{@render txt(32, 40, 'Who eats whom', 16, { weight: 600 })}
	{@render txt(32, 60, 'Arrows: food → eater · circle size: population', 11, { muted: true })}

	{#each LEVELS as lv (lv.label)}
		<line
			x1="32"
			x2="530"
			y1={lv.y}
			y2={lv.y}
			stroke="var(--stage-grid)"
			stroke-width="1"
			stroke-dasharray="2 5"
		/>
		{@render txt(530, lv.y - 6, lv.label, 11, { muted: true, anchor: 'end' })}
	{/each}

	{#each links as l (l.id)}
		{#if l.glow > 0.01}
			<path
				d={l.d}
				fill="none"
				stroke={RIPPLE}
				stroke-width="9"
				stroke-linecap="round"
				opacity={0.28 * l.glow}
			/>
		{/if}
		<path
			d={l.d}
			fill="none"
			stroke={l.glow > 0.3 ? RIPPLE : 'var(--stage-line)'}
			stroke-width={l.live ? 2 : 1.5}
			stroke-dasharray={l.live ? undefined : '4 4'}
			opacity={l.live ? 0.9 : 0.3}
			marker-end="url(#arrowhead)"
		/>
		{#if l.glow > 0.01}
			<circle cx={l.dot[0]} cy={l.dot[1]} r="5" fill={RIPPLE} opacity={l.glow} />
		{/if}
	{/each}

	{#each nodes as n (n.s)}
		{@const up = n.rate > 0}
		<g>
			{#if n.halo > 0.01}
				<circle
					cx={n.x}
					cy={n.y}
					r={n.r + 7 + 2 * Math.sin(t * 2 * Math.PI)}
					fill="none"
					stroke={up ? RISE : FALL}
					stroke-width="4"
					stroke-dasharray={up ? undefined : '6 4'}
					opacity={0.75 * n.halo}
				/>
				{@render txt(n.x + n.r * 0.75 + 12, n.y - n.r * 0.75 - 4, up ? '▲' : '▼', 13, {
					color: up ? RISE : FALL,
					anchor: 'middle',
					opacity: n.halo
				})}
			{/if}
			{#if n.state === 'live'}
				<circle
					cx={n.x}
					cy={n.y}
					r={n.r}
					style:fill="color-mix(in oklab, {COLOR[n.s]} 28%, var(--stage-bg))"
					style:stroke={COLOR[n.s]}
					stroke-width="2.5"
				/>
				{#if n.r >= 14}
					{@render txt(
						n.x,
						n.y + Math.min(22, n.r * 0.8) * 0.36,
						n.s[0].toUpperCase(),
						Math.min(22, n.r * 0.8),
						{
							anchor: 'middle',
							color: COLOR[n.s],
							weight: 700
						}
					)}
				{/if}
			{:else}
				<circle
					cx={n.x}
					cy={n.y}
					r={n.r}
					fill="var(--stage-bg)"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="4 3"
					opacity={n.state === 'notyet' ? 0.6 : 0.85}
				/>
				{#if n.state === 'off'}
					<path
						d="M{n.x - 8} {n.y - 8} L{n.x + 8} {n.y + 8} M{n.x + 8} {n.y - 8} L{n.x - 8} {n.y + 8}"
						stroke="var(--stage-ink-muted)"
						stroke-width="2"
						stroke-linecap="round"
					/>
				{/if}
			{/if}
			{@render txt(
				n.x,
				n.s === 'wolf' ? n.y - n.r - 10 : n.y + n.r + 17,
				n.state === 'live'
					? `${PLURAL[n.s]} · ${Math.round(n.n)}`
					: n.state === 'gone'
						? `${PLURAL[n.s]} · gone`
						: n.state === 'off'
							? `${PLURAL[n.s]} · switched off`
							: 'deer · not here yet',
				12,
				{
					anchor: 'middle',
					muted: n.state !== 'live',
					weight: n.state === 'live' ? 600 : 500,
					tabular: true
				}
			)}
		</g>
	{/each}

	<!-- the readout -->
	<rect
		x="24"
		y="510"
		width="512"
		height="70"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
		stroke-width="1"
	/>
	{@render txt(40, 538, summary.line, 14, { weight: 600 })}
	{@render txt(40, 562, summary.sub, 11, { muted: true })}

	<!-- ===== the chart ===== -->
	{@render txt(CX0 - 28, 40, 'Numbers over time', 16, { weight: 600 })}
	{@render txt(CX0 - 28, 60, `Year ${Math.floor(year)} · 1 second ≈ 1 year`, 11, {
		muted: true,
		tabular: true
	})}

	<defs>
		{#each clips as c (c.j)}
			<clipPath id="web-clip-{c.j}">
				<rect x={c.x - 1} y={CY0} width={c.w + 1} height={CY1 - CY0} />
			</clipPath>
		{/each}
	</defs>

	{#each chart as row (row.s)}
		<line
			x1={CX0}
			x2={CX1}
			y1={row.bottom}
			y2={row.bottom}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
		{#if WEB_START[row.i] > 0}
			<line
				x1={CX0}
				x2={CX1}
				y1={row.sy(WEB_START[row.i])}
				y2={row.sy(WEB_START[row.i])}
				stroke="var(--stage-grid)"
				stroke-width="1"
				stroke-dasharray="3 4"
			/>
		{/if}
		{@render txt(CX0 + 4, row.top - 9, PLURAL[row.s], 12, { color: COLOR[row.s], weight: 600 })}
		{@render txt(CX0 - 6, row.bottom + 4, '0', 11, { muted: true, anchor: 'end' })}
		{@render txt(CX0 - 6, row.top + 4, String(row.yMax), 11, {
			muted: true,
			anchor: 'end'
		})}
		{#each row.paths as p (p.j)}
			{#if !p.absent && clips[p.j].w > 0}
				<path
					d={p.d}
					fill="none"
					style:stroke={COLOR[row.s]}
					stroke-width="2"
					stroke-linejoin="round"
					clip-path="url(#web-clip-{p.j})"
				/>
			{/if}
		{/each}
		{#if current.present[row.i]}
			<circle
				cx={sx(year)}
				cy={row.sy(pops[row.i])}
				r="3.5"
				style:fill={COLOR[row.s]}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		{@render txt(
			CX1,
			row.top - 9,
			current.present[row.i]
				? pops[row.i] < 0.5
					? 'gone'
					: String(Math.round(pops[row.i]))
				: newcomer && row.s === 'deer'
					? 'not here yet'
					: 'switched off',
			12,
			{ anchor: 'end', tabular: true, muted: !current.present[row.i], weight: 600 }
		)}
	{/each}

	<!-- markers where the reader switched a species -->
	{#each markers as m (m.j)}
		<line
			x1={m.x}
			x2={m.x}
			y1={CY0 - 12 - m.row * 13}
			y2={CY1}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="3 3"
		/>
		{@render txt(m.x + 4, CY0 - 4 - m.row * 13, m.text, 11, { muted: true })}
	{/each}

	{#each yearTicks as v (v)}
		{@render txt(sx(v), CY1 + 16, String(Math.round(v)), 11, { muted: true, anchor: 'middle' })}
	{/each}
	{@render txt(CX1, CY1 + 32, 'years', 11, { muted: true, anchor: 'end' })}
</g>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
