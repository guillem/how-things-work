<script lang="ts">
	/**
	 * Power iteration: rank flows round the web, round after round, until it
	 * settles on the PageRank.
	 *
	 * Round 0 gives every page an equal share. In each round's transition every
	 * page sends d·rank/out along each of its links (dots in --rank-flow, area ∝
	 * amount) and (1 − d)·rank — all of its rank if it is a dead end — to the
	 * "jump pool" (dots in --rank-jump), which then hands an equal part to every
	 * page. When the dots arrive, page sizes, numbers and bars ease from round k
	 * to round k + 1. Rounds 0–8 take 1.6 s each so the big early changes can be
	 * followed; later rounds (tiny changes) take 0.5 s with no dots; after
	 * round ROUNDS the iteration holds. "Settled" shows once every displayed
	 * value (1 decimal) equals the exact PageRank.
	 *
	 * Everything is a pure function of the time since the iteration (re)started.
	 * The damping slider restarts it from round 0: see `tr` below, the one small
	 * documented accumulator (the scene guide's sanctioned exception).
	 *
	 * Reduced motion: the settled ranks, with every link labelled with the share
	 * it carries in one round and the pool with the share each page gets.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { clamp, easeInOut, lerp, niceMax, norm, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		DAMPING,
		EXAMPLE,
		PRESETS,
		outLinks,
		pageName,
		pagerank,
		rounds,
		type Web
	} from '../pagerank';
	import { linkGeometry, pageRadius } from '../geometry';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- the web -------------------------------------------------------------------
	// Preset positions shifted up a little to leave room for the jump pool below.
	const OX = -10;
	const OY = -24;
	const web: Web = $derived.by(() => {
		const base = PRESETS[String(step.hints?.web ?? 'example')] ?? EXAMPLE;
		return { pages: base.pages.map((p) => ({ x: p.x + OX, y: p.y + OY })), links: base.links };
	});
	const n = $derived(web.pages.length);
	const out = $derived(outLinks(web));
	const POOL = { x: 440, y: 548 };

	const d = $derived(clamp(Number(params.damping ?? DAMPING), 0, 1));
	const ROUNDS = 30;
	const history = $derived(rounds(web, ROUNDS, d));
	const final = $derived(pagerank(web, d).rank);
	/** Total change |r_k − r_(k−1)| summed over pages, for k = 1…ROUNDS. */
	const change = $derived(
		history.map((r, k) =>
			k === 0 ? 0 : r.reduce((s, v, i) => s + Math.abs(v - history[k - 1][i]), 0)
		)
	);
	const changeMax = $derived(niceMax(Math.max(...change) * 100));
	const barMax = $derived(niceMax(Math.max(...history.flat(), ...final) * 100) / 100);

	// ---- time since the iteration (re)started ---------------------------------------
	// `t` does not reset when the slider moves, so this keeps t0 = the time of the
	// last damping change. Plain (non-reactive) locals updated inside a $derived:
	// a frame-to-frame accumulator as tolerated by the scene guide. A step re-entry
	// (t jumps back) moves t0 back too; reduced motion ignores it.
	let lastD = NaN;
	let t0 = 0;
	let lastT = 0;
	const tr = $derived.by(() => {
		if (d !== lastD) {
			// The first evaluation starts at 0; later changes restart from now.
			t0 = Number.isNaN(lastD) ? 0 : t;
			lastD = d;
		}
		if (t < lastT || t < t0) t0 = Math.min(t0, t, 0);
		lastT = t;
		return Math.max(0, t - t0);
	});

	// ---- the clock: which round, and how far through its transition -----------------
	const LEAD = 0.8; // round 0 is shown alone for a moment first
	const SLOW = 8; // rounds 0…SLOW−1 are animated with dots
	const P1 = 1.6;
	const P2 = 0.5;
	const clock = $derived.by(() => {
		if (reduced) return { k: ROUNDS, u: 0, slow: false };
		const s = tr - LEAD;
		if (s <= 0) return { k: 0, u: 0, slow: true };
		if (s < SLOW * P1) return { k: Math.floor(s / P1), u: (s % P1) / P1, slow: true };
		const s2 = s - SLOW * P1;
		const k = SLOW + Math.floor(s2 / P2);
		if (k >= ROUNDS) return { k: ROUNDS, u: 0, slow: false };
		return { k, u: (s2 % P2) / P2, slow: false };
	});
	/** 0 → 1 as the displayed values move from round k to round k + 1. */
	const e = $derived(
		clock.k >= ROUNDS
			? 0
			: clock.slow
				? smoothstep(0.5, 0.9, clock.u)
				: smoothstep(0.1, 0.9, clock.u)
	);
	const rank = $derived.by(() => {
		if (reduced) return final;
		const a = history[clock.k];
		const b = history[Math.min(ROUNDS, clock.k + 1)];
		return a.map((v, i) => lerp(v, b[i], e));
	});
	const shownRound = $derived(reduced ? ROUNDS : clock.k + (e >= 0.5 ? 1 : 0));
	const roundTitle = $derived(
		!reduced && e > 0 && e < 1 ? `Round ${clock.k} → ${clock.k + 1}` : `Round ${shownRound}`
	);
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
	/**
	 * First round from which every later round shows the exact PageRank to one
	 * decimal; "settled" appears from then on (never on and off again).
	 */
	const settleRound = $derived.by(() => {
		let k = ROUNDS + 1;
		while (k > 0 && history[k - 1].every((v, i) => pct(v) === pct(final[i]))) k--;
		return k;
	});
	const settled = $derived(reduced || shownRound >= settleRound);

	// ---- drawing geometry ----------------------------------------------------------
	const radii = $derived(rank.map((r) => pageRadius(r, n)));
	const links = $derived(
		web.links.map(([a, b]) => ({
			a,
			b,
			key: `${a}>${b}`,
			g: linkGeometry(web, a, b, radii[a], radii[b])
		}))
	);
	/** Radius of a dot carrying `amount` of rank (area ∝ amount). */
	const dotR = (amount: number) => 1.5 + 17 * Math.sqrt(Math.max(0, amount));
	const toPool = (q: number, r: readonly number[]) => (out[q].length ? (1 - d) * r[q] : r[q]);

	// Dots of the current transition (rounds animated with dots only).
	const LINK_U: [number, number] = [0.08, 0.7];
	const IN_U: [number, number] = [0.08, 0.38];
	const OUT_U: [number, number] = [0.42, 0.72];
	const fade = (p: number) => smoothstep(0, 0.08, p) * (1 - smoothstep(0.9, 1, p));
	const moving = $derived(!reduced && clock.slow && clock.k < ROUNDS && clock.u > 0);
	const src = $derived(history[Math.min(clock.k, ROUNDS)]);
	const poolTotal = $derived(src.reduce((s, _, q) => s + toPool(q, src), 0));
	const finalPool = $derived(final.reduce((s, _, q) => s + toPool(q, final), 0));
	const linkDots = $derived.by(() => {
		if (!moving) return [];
		const p = norm(clock.u, ...LINK_U);
		if (p <= 0 || p >= 1) return [];
		const ep = easeInOut(p);
		return links
			.filter((l) => out[l.a].length)
			.map((l) => {
				const pos = l.g.at(ep);
				return { key: l.key, ...pos, r: dotR((d * src[l.a]) / out[l.a].length), o: fade(p) };
			});
	});
	const poolDots = $derived.by(() => {
		if (!moving) return [];
		const dots: { key: string; x: number; y: number; r: number; o: number }[] = [];
		const pin = norm(clock.u, ...IN_U);
		const pout = norm(clock.u, ...OUT_U);
		for (let q = 0; q < n; q++) {
			// Dots leave and land on the page's rim, not its centre (keeps the letter clear).
			const C = web.pages[q];
			const dl = Math.hypot(POOL.x - C.x, POOL.y - C.y) || 1;
			const rim = radii[q] + 2;
			const P = { x: C.x + ((POOL.x - C.x) / dl) * rim, y: C.y + ((POOL.y - C.y) / dl) * rim };
			if (pin > 0 && pin < 1) {
				const amount = toPool(q, src);
				if (amount > 1e-6) {
					const v = easeInOut(pin);
					dots.push({
						key: `in${q}`,
						x: lerp(P.x, POOL.x, v),
						y: lerp(P.y, POOL.y, v),
						r: dotR(amount),
						o: fade(pin)
					});
				}
			}
			if (pout > 0 && pout < 1 && poolTotal > 1e-6) {
				const v = easeInOut(pout);
				dots.push({
					key: `out${q}`,
					x: lerp(POOL.x, P.x, v),
					y: lerp(POOL.y, P.y, v),
					r: dotR(poolTotal / n),
					o: fade(pout)
				});
			}
		}
		return dots;
	});
	/** How much the pool holds right now (fills as dots arrive, empties as they leave). */
	const poolFill = $derived(
		reduced
			? 0.6 * Math.sign(finalPool)
			: moving
				? smoothstep(0.75, 1, norm(clock.u, ...IN_U)) *
					(1 - smoothstep(0, 0.25, norm(clock.u, ...OUT_U)))
				: 0
	);
	const poolLines = $derived(
		// Nothing goes through the pool when every page follows its links (d = 1, no dead ends).
		(reduced ? finalPool : poolTotal) < 1e-6
			? 0
			: moving
				? smoothstep(0.02, 0.1, clock.u) * (1 - smoothstep(0.7, 0.8, clock.u))
				: reduced
					? 1
					: 0
	);

	// Reduced motion: the share each link carries in one round of the final ranks.
	const shareLabels = $derived.by(() => {
		if (!reduced) return [];
		// Each label goes at the first spot along its link that keeps clear of the
		// labels already placed, the pages and the other links' arrowheads.
		const placed: { key: string; x: number; y: number; text: string }[] = [];
		const tips = links.map((l) => ({ key: l.key, ...l.g.at(1) }));
		const strokes = links.flatMap((l) =>
			[0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((u) => ({ key: l.key, ...l.g.at(u) }))
		);
		const clearance = (key: string, x: number, y: number) =>
			Math.min(
				...placed.map((p) => Math.hypot(p.x - x, (p.y - y) * 2.2) - 44),
				...tips.filter((h) => h.key !== key).map((h) => Math.hypot(h.x - x, h.y - y) - 26),
				...strokes.filter((h) => h.key !== key).map((h) => Math.hypot(h.x - x, (h.y - y) * 2) - 30),
				...web.pages.map((P, i) => Math.hypot(P.x - x, P.y - y) - radii[i] - 16)
			);
		for (const l of links) {
			if (!out[l.a].length) continue;
			let best = { u: 0.42, c: -Infinity };
			for (const u of [0.42, 0.3, 0.55, 0.25, 0.65, 0.35, 0.5, 0.2, 0.75]) {
				const p = l.g.at(u);
				const c = clearance(l.key, p.x, p.y);
				if (c > best.c) best = { u, c };
				if (c >= 0) break;
			}
			placed.push({
				key: l.key,
				...l.g.at(best.u),
				text: pct((d * final[l.a]) / out[l.a].length)
			});
		}
		return placed;
	});

	// ---- right panel ------------------------------------------------------------------
	const PL = 648;
	const PR = 944;
	const ROW = $derived(Math.min(30, 210 / Math.max(1, n)));
	const BAR_X = 684;
	const BAR_W = 168;
	const bx = (v: number) => BAR_X + (v / barMax) * BAR_W;
	// Change chart.
	const CX0 = 694;
	const CX1 = 928;
	const CY0 = 548; // y of 0
	const CY1 = 372; // y of changeMax
	const cx = (k: number) => CX0 + (k / ROUNDS) * (CX1 - CX0);
	const cy = (v: number) => CY0 - (v / changeMax) * (CY0 - CY1);
	const changePath = $derived.by(() => {
		// Rounds revealed so far; the round in progress grows in as it happens.
		const upto = reduced ? ROUNDS : Math.min(ROUNDS, clock.k + e);
		let path = '';
		for (let k = 1; k <= Math.floor(upto); k++) {
			path += `${k === 1 ? 'M' : 'L'}${cx(k).toFixed(1)} ${cy(change[k] * 100).toFixed(1)}`;
		}
		const f = upto - Math.floor(upto);
		const k = Math.floor(upto);
		if (f > 0 && k + 1 <= ROUNDS) {
			const x = lerp(cx(Math.max(1, k)), cx(k + 1), k === 0 ? 1 : f);
			const y =
				k === 0 ? cy(change[1] * 100) : lerp(cy(change[k] * 100), cy(change[k + 1] * 100), f);
			path += `${path ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return path;
	});
	const lastChange = $derived(shownRound >= 1 ? change[shownRound] * 100 : NaN);
	const dPct = $derived(Math.round(d * 100));
	const jPct = $derived(100 - Math.round(d * 100));
</script>

<g>
	<!-- legend -->
	<circle cx={30} cy={30} r={6} fill="var(--rank-flow)" />
	{@render txt(44, 34, `${dPct}% of each page’s rank flows along its links, split equally`, 12)}
	<circle cx={30} cy={52} r={5} fill="var(--rank-jump)" />
	{@render txt(44, 56, `${jPct}% goes to the jump pool and is shared equally by all pages`, 12)}

	<!-- jump pool: faint dashed spokes to every page while it is in use -->
	{#if poolLines > 0.01}
		<g opacity={0.45 * poolLines}>
			{#each web.pages as P, q (q)}
				<line
					x1={POOL.x}
					y1={POOL.y}
					x2={P.x}
					y2={P.y}
					stroke="var(--rank-jump)"
					stroke-width="1.2"
					stroke-dasharray="3 5"
				/>
			{/each}
		</g>
	{/if}

	<!-- links -->
	{#each links as l (l.key)}
		<path d={l.g.d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.5" opacity="0.8" />
		<polygon points={l.g.head} fill="var(--stage-ink-muted)" opacity="0.8" />
	{/each}

	<!-- the pool -->
	<circle
		cx={POOL.x}
		cy={POOL.y}
		r={16 + 10 * poolFill}
		fill="color-mix(in srgb, var(--rank-jump) {8 + 22 * poolFill}%, var(--stage-bg))"
		stroke="var(--rank-jump)"
		stroke-width="1.5"
		stroke-dasharray="4 3"
	/>
	{@render txt(POOL.x + 34, POOL.y - 4, 'jump pool', 12, {
		weight: 600,
		color: 'var(--rank-jump)'
	})}
	{@render txt(
		POOL.x + 34,
		POOL.y + 12,
		reduced ? `each page gets ${pct(finalPool / n)} from it` : `shared equally by all ${n} pages`,
		11,
		{ muted: true }
	)}

	<!-- pages -->
	{#each web.pages as P, i (i)}
		{@const r = radii[i]}
		<circle
			cx={P.x}
			cy={P.y}
			{r}
			fill="color-mix(in srgb, var(--rank-page) 18%, var(--stage-bg))"
			stroke="var(--rank-page)"
			stroke-width="2"
		/>
		{#if r >= 27}
			{@render txt(P.x, P.y - 2, pageName(i), 16, { anchor: 'middle', weight: 700 })}
			{@render txt(P.x, P.y + 15, pct(rank[i]), 12, { anchor: 'middle', tabular: true })}
		{:else}
			{@render txt(P.x, P.y + 5, pageName(i), 15, { anchor: 'middle', weight: 700 })}
			{@render txt(P.x, P.y + r + 15, pct(rank[i]), 12, { anchor: 'middle', tabular: true })}
		{/if}
	{/each}

	<!-- rank in flight -->
	{#each poolDots as p (p.key)}
		<circle cx={p.x} cy={p.y} r={p.r} fill="var(--rank-jump)" opacity={0.85 * p.o} />
	{/each}
	{#each linkDots as p (p.key)}
		<circle
			cx={p.x}
			cy={p.y}
			r={p.r}
			fill="var(--rank-flow)"
			stroke="var(--stage-bg)"
			stroke-width="1"
			opacity={p.o}
		/>
	{/each}

	<!-- reduced motion: what each link carries in one round -->
	{#each shareLabels as s (s.key)}
		{@render pill(s.x, s.y + 4, s.text, 11, 'var(--rank-flow)')}
	{/each}

	<!-- right panel -->
	<rect
		x={PL}
		y={16}
		width={PR - PL}
		height={568}
		rx={12}
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(PL + 18, 48, roundTitle, 18, { weight: 700, tabular: true })}
	{#if settled}
		{@render pill(PR - 52, 43, '✓ settled', 12, 'var(--rank-flow)')}
	{:else if !reduced && !clock.slow && clock.k < ROUNDS}
		{@render txt(PR - 18, 47, 'faster now', 11, { anchor: 'end', muted: true })}
	{/if}
	{@render txt(PL + 18, 72, 'Rank of each page · tick = exact PageRank', 11, { muted: true })}

	{#each rank as v, i (i)}
		{@const y = 96 + i * ROW}
		{@render txt(PL + 18, y + ROW / 2 + 4, pageName(i), 13, { weight: 700 })}
		<rect
			x={BAR_X}
			y={y + ROW * 0.2}
			width={BAR_W}
			height={ROW * 0.6}
			rx="3"
			fill="var(--stage-grid)"
			opacity="0.6"
		/>
		<rect
			x={BAR_X}
			y={y + ROW * 0.2}
			width={Math.max(0, bx(v) - BAR_X)}
			height={ROW * 0.6}
			rx="3"
			fill="var(--rank-page)"
			opacity="0.85"
		/>
		<line
			x1={bx(final[i])}
			x2={bx(final[i])}
			y1={y + ROW * 0.08}
			y2={y + ROW * 0.92}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		{@render txt(PR - 18, y + ROW / 2 + 4, pct(v), 13, { anchor: 'end', tabular: true })}
	{/each}

	<!-- change per round -->
	{@render txt(PL + 18, 314, 'Total change in this round', 13, { weight: 600 })}
	{@render txt(
		PL + 18,
		332,
		shownRound >= 1
			? `round ${shownRound}: ${lastChange.toFixed(lastChange < 1 ? 2 : 1)}% of all rank moved`
			: 'starts with round 1',
		11,
		{ muted: true, tabular: true }
	)}
	{#each [0, changeMax / 2, changeMax] as v (v)}
		<line x1={CX0} x2={CX1} y1={cy(v)} y2={cy(v)} stroke="var(--stage-grid)" stroke-width="1" />
		{@render txt(CX0 - 6, cy(v) + 4, `${v}%`, 11, { anchor: 'end', muted: true })}
	{/each}
	{#each [0, 10, 20, 30] as k (k)}
		{@render txt(cx(k), CY0 + 16, String(k), 11, { anchor: 'middle', muted: true })}
	{/each}
	{@render txt(CX1, CY0 + 30, 'round', 11, { anchor: 'end', muted: true })}
	<path
		d={changePath}
		fill="none"
		stroke="var(--rank-flow)"
		stroke-width="2.2"
		stroke-linejoin="round"
	/>
	{#if shownRound >= 1}
		<circle cx={cx(shownRound)} cy={cy(change[shownRound] * 100)} r="3.5" fill="var(--rank-flow)" />
	{/if}
</g>

{#snippet pill(x: number, y: number, text: string, size: number, color: string)}
	{@const w = text.length * size * 0.6 + 12}
	<rect
		x={x - w / 2}
		y={y - size * 0.8 - 3}
		width={w}
		height={size + 8}
		rx={(size + 8) / 2}
		fill="var(--surface)"
		stroke={color}
		stroke-width="1"
	/>
	<text {x} {y} text-anchor="middle" font-weight="600" style:font-size="{size}px" style:fill={color}
		>{text}</text
	>
{/snippet}

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
