<script lang="ts">
	/**
	 * Links as votes, on the six-page EXAMPLE web.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   web      — the pages appear and their links draw in; a search box over the
	 *              web and a card "6 pages, 11 links: a link ≈ a recommendation"
	 *   count    — each page's incoming links counted as a vote badge; the incoming
	 *              arrows of one page at a time light up (cycling, a pure function
	 *              of t) and the card ranks the pages by vote count (ties grouped)
	 *   weighted — the pages grow to their PageRank; each link is as thick as the
	 *              share of its source's rank it passes on (rank ÷ out-degree), with
	 *              dots flowing along it; the card re-sorts by PageRank, and callouts
	 *              contrast A (one vote, from C) with B (four small votes)
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { EXAMPLE, inCount, outLinks, pageName, pagerank } from '../pagerank';
	import { linkGeometry, pageRadius } from '../geometry';

	let { step, t, reduced }: StageProps = $props();

	// ---- the model (static: the example web never changes here) ---------------------
	const web = EXAMPLE;
	const N = web.pages.length;
	const votes = inCount(web);
	const outs = outLinks(web);
	const rank = pagerank(web).rank;
	const EQUAL_R = pageRadius(1 / N, N);
	const rankR = rank.map((r) => pageRadius(r, N));
	/** Share of its source's rank that each link passes on. */
	const share = web.links.map(([a]) => rank[a] / outs[a].length);
	const MAX_SHARE = Math.max(...share);
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
	const voteText = (v: number) => `${v} vote${v === 1 ? '' : 's'}`;

	const A = 0;
	const B = 1;
	const C = 2;
	/** The C → A link and B's incoming links: the contrast the weighted step is about. */
	const keyLink = web.links.map(([a, b]) => (a === C && b === A) || b === B);

	// Rankings for the card.
	const byVotes = [...Array(N).keys()].sort((p, q) => votes[q] - votes[p] || p - q);
	const byRank = [...Array(N).keys()].sort((p, q) => rank[q] - rank[p]);
	/** Groups of pages tied on votes, in ranking order (for the tie boxes and shared place). */
	const voteGroups = (() => {
		const groups: { pages: number[]; place: number; first: number }[] = [];
		byVotes.forEach((p, k) => {
			const last = groups[groups.length - 1];
			if (last && votes[last.pages[0]] === votes[p]) last.pages.push(p);
			else groups.push({ pages: [p], place: k + 1, first: k });
		});
		return groups;
	})();
	const placeByVotes = Array.from(
		{ length: N },
		(_, p) => voteGroups.find((g) => g.pages.includes(p))!.place
	);
	/** Pages that get votes, in vote order: the count step lights up their incoming links in turn. */
	const pulseOrder = byVotes.filter((p) => votes[p] > 0);
	const PULSE = 2.4;

	// ---- layout --------------------------------------------------------------------------
	const CL = 660; // card
	const CR = 944;
	const CT = 92;
	const CB = 520;
	const ROW0 = 214;
	const ROW = 46;
	const BAR_L = 800;
	const BAR_R = 866;

	// ---- phases ---------------------------------------------------------------------------
	const phases = ['web', 'count', 'weighted'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'web') as Phase);

	const ease = { duration: 800, easing: cubicInOut };
	const w = Object.fromEntries(phases.map((p) => [p, new Tween(0, ease)])) as Record<
		Phase,
		Tween<number>
	>;
	/** 0 = equal page sizes, 1 = sized by PageRank. */
	const grow = new Tween(0, { duration: 1100, easing: cubicInOut });
	/** Each page's row in the card (in rows, 0 = top). */
	const rowPos = Array.from({ length: N }, (_, p) => new Tween(byVotes.indexOf(p), ease));
	$effect(() => {
		const current = phase;
		untrack(() => {
			const d = reduced ? 0 : undefined;
			for (const p of phases) w[p].set(p === current ? 1 : 0, { duration: d });
			grow.set(current === 'weighted' ? 1 : 0, { duration: reduced ? 0 : 1100 });
			const order = current === 'weighted' ? byRank : byVotes;
			for (let p = 0; p < N; p++) rowPos[p].set(order.indexOf(p), { duration: d });
		});
	});

	const wWeb = $derived(w.web.current);
	const wCount = $derived(w.count.current);
	const wWeighted = $derived(w.weighted.current);
	/** Vote badges show in the count and weighted steps. */
	const wBadges = $derived(clamp(wCount + wWeighted));

	// ---- the drawing, a function of t ---------------------------------------------------
	/** Staggered reveal in the first step (complete by ~3 s; immediate under reduced motion). */
	const revealing = $derived(phase === 'web' && !reduced);
	const pageIn = (i: number) => (revealing ? smoothstep(0.1 + i * 0.15, 0.5 + i * 0.15, t) : 1);
	const linkIn = (k: number) => (revealing ? smoothstep(1.2 + k * 0.13, 1.7 + k * 0.13, t) : 1);

	const radii = $derived(rankR.map((r) => lerp(EQUAL_R, r, grow.current)));
	const geoms = $derived(web.links.map(([a, b]) => linkGeometry(web, a, b, radii[a], radii[b])));

	// Count step: which page's incoming links are lit, and how strongly.
	const pulse = $derived.by(() => {
		if (reduced) return { page: pulseOrder[0], env: 1, u: -1 };
		const k = Math.floor(Math.max(0, t) / PULSE);
		const local = cycle(Math.max(0, t), PULSE);
		return {
			page: pulseOrder[k % pulseOrder.length],
			env: smoothstep(0, 0.12, local) * (1 - smoothstep(0.88, 1, local)),
			u: smoothstep(0.08, 0.62, local)
		};
	});
	/** How strongly a page's badge "receives" its votes as the travelling dots arrive. */
	const pop = (p: number) =>
		p === pulse.page ? pulse.env * (reduced ? 1 : smoothstep(0.5, 0.65, pulse.u)) : 0;

	// Weighted step: dots flowing along every link, as many as the share it carries.
	const flowDots = $derived.by(() => {
		if (wWeighted < 0.01) return [];
		const dots: { key: string; x: number; y: number; r: number; o: number }[] = [];
		web.links.forEach(([a, b], k) => {
			const s = share[k] / MAX_SHARE;
			const count = Math.max(1, Math.round(share[k] * 26));
			const period = lerp(3.6, 2.2, s);
			for (let j = 0; j < count; j++) {
				const u = cycle(t, period, j / count + k * 0.137);
				const p = geoms[k].at(u * 0.96);
				const fade = smoothstep(0, 0.08, u) * (1 - smoothstep(0.88, 0.98, u));
				dots.push({
					key: `${a}-${b}-${j}`,
					x: p.x,
					y: p.y,
					r: 2 + 2 * Math.sqrt(s),
					o: fade * (keyLink[k] ? 1 : 0.55)
				});
			}
		});
		return dots;
	});

	const linkWidth = (k: number) => lerp(1.5, (keyLink[k] ? 1.8 : 1.2) + 14 * share[k], wWeighted);
	const linkColor = (k: number) => {
		const [, b] = web.links[k];
		if (wCount > 0.01 && b === pulse.page) return 'var(--rank-page)';
		if (keyLink[k] && wWeighted > 0.01)
			return `color-mix(in srgb, var(--stage-ink) ${Math.round(70 * wWeighted)}%, var(--stage-ink-muted))`;
		return 'var(--stage-ink-muted)';
	};
	const linkOpacity = (k: number) => {
		const [, b] = web.links[k];
		const lit = b === pulse.page ? pulse.env : 0;
		const inCountStep = lerp(0.55, 1, lit);
		const inWeighted = keyLink[k] ? 1 : 0.3;
		return wWeb * 0.85 + wCount * inCountStep + wWeighted * inWeighted;
	};
	const pageOpacity = (p: number) => {
		const inWeighted = p === A || p === B || p === C ? 1 : 0.75;
		return wWeb + wCount + wWeighted * inWeighted;
	};
	const rowOpacity = (p: number) => {
		const lit = p === pulse.page ? pulse.env : 0;
		const inCountStep = lerp(0.8, 1, lit);
		const inWeighted = p === A || p === B ? 1 : 0.6;
		return wCount * inCountStep + wWeighted * inWeighted;
	};
	const rowY = (p: number) => ROW0 + rowPos[p].current * ROW;

	// Late in the count step: the question that leads to the next step.
	const askIn = $derived(reduced ? 1 : smoothstep(6, 7.5, t));
</script>

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

<g>
	<!-- ============================ the search box (first step) ============================ -->
	{#if wWeb > 0.01}
		<g opacity={wWeb * (revealing ? smoothstep(0, 0.4, t) : 1)}>
			<rect
				x="200"
				y="22"
				width="340"
				height="34"
				rx="17"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<circle
				cx="222"
				cy="37"
				r="6"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
			/>
			<line
				x1="226.5"
				y1="41.5"
				x2="231"
				y2="46"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.8"
				stroke-linecap="round"
			/>
			{@render txt(242, 43, 'how do plants make sugar', 13, { muted: true })}
			{@render txt(370, 78, 'millions of matching pages — which first?', 12, {
				anchor: 'middle',
				muted: true
			})}
		</g>
	{/if}

	<!-- ============================ links ============================ -->
	{#each web.links as [a, b], k (`${a}>${b}`)}
		{@const g = geoms[k]}
		{@const u = linkIn(k)}
		{#if u > 0}
			<g opacity={linkOpacity(k)}>
				<path
					d={g.d}
					fill="none"
					stroke={linkColor(k)}
					stroke-width={linkWidth(k) + wCount * (b === pulse.page ? pulse.env : 0) * 1}
					stroke-linecap="round"
					pathLength="1"
					stroke-dasharray={u < 1 ? '1 1' : undefined}
					stroke-dashoffset={u < 1 ? 1 - u : undefined}
				/>
				<polygon points={g.head} fill={linkColor(k)} opacity={smoothstep(0.8, 1, u)} />
			</g>
		{/if}
	{/each}

	<!-- votes travelling to the page in focus (count step) -->
	{#if wCount > 0.01 && pulse.u > 0 && pulse.u < 1}
		{#each web.links as [a, b], k (`v${a}>${b}`)}
			{#if b === pulse.page}
				{@const p = geoms[k].at(pulse.u)}
				<circle
					cx={p.x}
					cy={p.y}
					r="4"
					fill="var(--rank-page)"
					opacity={wCount * pulse.env * (1 - smoothstep(0.85, 1, pulse.u))}
				/>
			{/if}
		{/each}
	{/if}

	<!-- rank flowing along the links (weighted step) -->
	{#each flowDots as d (d.key)}
		<circle cx={d.x} cy={d.y} r={d.r} fill="var(--rank-flow)" opacity={d.o * wWeighted} />
	{/each}

	<!-- ============================ pages ============================ -->
	{#each web.pages as pg, p (p)}
		{@const r = radii[p]}
		{@const s = pageIn(p)}
		{#if s > 0}
			{@const lit = wCount * (p === pulse.page ? pulse.env : 0)}
			<g opacity={s * pageOpacity(p)} transform="translate({pg.x} {pg.y}) scale({lerp(0.6, 1, s)})">
				<circle
					{r}
					fill="color-mix(in srgb, var(--rank-page) {18 + 14 * lit}%, var(--stage-bg))"
					stroke="var(--rank-page)"
					stroke-width={1.5 + 1.5 * lit}
				/>
				<!-- a hint of a document: two text lines under the letter -->
				{#if r > 24}
					<g stroke="var(--rank-page)" stroke-width="1.6" stroke-linecap="round" opacity="0.45">
						<line x1={-r * 0.32} x2={r * 0.32} y1={r * 0.42} y2={r * 0.42} />
						<line x1={-r * 0.32} x2={r * 0.16} y1={r * 0.58} y2={r * 0.58} />
					</g>
				{/if}
				{@render txt(0, r > 24 ? 4 : 6, pageName(p), r > 24 ? 18 : 16, {
					anchor: 'middle',
					weight: 700
				})}
			</g>
		{/if}
	{/each}

	<!-- vote badges -->
	{#if wBadges > 0.01}
		{#each web.pages as pg, p (`badge${p}`)}
			{@const r = radii[p]}
			{@const k = 1 + 0.25 * pop(p)}
			<g
				opacity={wBadges * (wCount + wWeighted * (p === A || p === B ? 1 : 0.7))}
				transform="translate({pg.x + (r + 4) * 0.72} {pg.y - (r + 4) * 0.72}) scale({k})"
			>
				<rect
					x="-11"
					y="-11"
					width="22"
					height="22"
					rx="11"
					fill="var(--surface)"
					stroke="var(--rank-page)"
					stroke-width="1.5"
				/>
				{@render txt(0, 4.5, String(votes[p]), 13, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--rank-page)'
				})}
			</g>
		{/each}
	{/if}

	<!-- callouts (weighted step) -->
	{#if wWeighted > 0.01}
		<g opacity={wWeighted * (reduced ? 1 : smoothstep(1.2, 2, t))}>
			<rect
				x="62"
				y="110"
				width="186"
				height="44"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(74, 128, `A: 1 vote, ${pct(rank[A])}`, 13, { weight: 700 })}
			{@render txt(74, 145, 'from C, with all of C’s share', 11.5, { muted: true })}
			<rect
				x="24"
				y="384"
				width="190"
				height="44"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(36, 402, `B: 4 votes, ${pct(rank[B])}`, 13, { weight: 700 })}
			{@render txt(36, 419, 'each a small, split share', 11.5, { muted: true })}
		</g>
	{/if}

	<!-- ============================ the card ============================ -->
	<rect
		x={CL}
		y={CT}
		width={CR - CL}
		height={CB - CT}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
		opacity={revealing ? smoothstep(0.2, 0.8, t) : 1}
	/>

	<!-- first step: the web in numbers -->
	{#if wWeb > 0.01}
		<g opacity={wWeb * (revealing ? smoothstep(0.4, 1.2, t) : 1)}>
			{@render txt(CL + 20, CT + 38, `${N} pages, ${web.links.length} links`, 18, {
				weight: 700
			})}
			{@render txt(CL + 20, CT + 62, 'a tiny web', 12, { muted: true })}
			<!-- a link, spelled out -->
			<g transform="translate({CL + 20} {CT + 112})">
				<circle
					cx="18"
					r="16"
					fill="color-mix(in srgb, var(--rank-page) 18%, var(--stage-bg))"
					stroke="var(--rank-page)"
					stroke-width="1.5"
				/>
				{@render txt(18, 5, 'X', 14, { anchor: 'middle', weight: 700 })}
				<line x1="38" x2="104" y1="0" y2="0" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
				<polygon points="116,0 104,-5.5 104,5.5" fill="var(--stage-ink-muted)" />
				<circle
					cx="136"
					r="16"
					fill="color-mix(in srgb, var(--rank-page) 18%, var(--stage-bg))"
					stroke="var(--rank-page)"
					stroke-width="1.5"
				/>
				{@render txt(136, 5, 'Y', 14, { anchor: 'middle', weight: 700 })}
			</g>
			{@render txt(CL + 20, CT + 162, 'X links to Y:', 13)}
			{@render txt(CL + 20, CT + 184, 'a link ≈ a recommendation', 15, {
				weight: 700,
				color: 'var(--rank-page)'
			})}
			{@render txt(CL + 20, CT + 228, 'Which pages are worth', 13, { muted: true })}
			{@render txt(CL + 20, CT + 246, 'reading first?', 13, { muted: true })}
		</g>
	{/if}

	<!-- count / weighted: the ranking -->
	{#if wCount + wWeighted > 0.01}
		<g opacity={clamp(wCount + wWeighted)}>
			<g opacity={wCount}>
				{@render txt(CL + 20, CT + 36, 'Ranked by votes', 16, { weight: 700 })}
				{@render txt(CL + 20, CT + 56, 'votes = incoming links', 12, { muted: true })}
			</g>
			<g opacity={wWeighted}>
				{@render txt(CL + 20, CT + 36, 'Ranked by PageRank', 16, { weight: 700 })}
				{@render txt(CL + 20, CT + 56, 'votes weighted by who gives them', 12, {
					muted: true
				})}
			</g>
			{@render txt(CL + 76, ROW0 - 28, 'votes', 11, { muted: true })}
			<g opacity={wWeighted}>
				{@render txt(CR - 16, ROW0 - 28, 'PageRank', 11, { muted: true, anchor: 'end' })}
			</g>

			<!-- tied pages share a place (count step) -->
			{#each voteGroups as g (g.place)}
				{#if g.pages.length > 1}
					<rect
						x={CL + 10}
						y={ROW0 + g.first * ROW - 19}
						width={CR - CL - 20}
						height={g.pages.length * ROW - 6}
						rx="8"
						fill="var(--rank-page)"
						opacity={0.08 * wCount}
					/>
				{/if}
			{/each}

			{#each byVotes as p (p)}
				{@const y = rowY(p)}
				<g opacity={rowOpacity(p)}>
					<!-- place -->
					<g opacity={wCount}>
						{@render txt(CL + 24, y + 5, `${placeByVotes[p]}`, 13, {
							anchor: 'middle',
							muted: true,
							tabular: true
						})}
					</g>
					<g opacity={wWeighted}>
						{@render txt(CL + 24, y + 5, `${byRank.indexOf(p) + 1}`, 13, {
							anchor: 'middle',
							muted: true,
							tabular: true
						})}
					</g>
					<circle
						cx={CL + 54}
						cy={y}
						r="13"
						fill="color-mix(in srgb, var(--rank-page) 18%, var(--stage-bg))"
						stroke="var(--rank-page)"
						stroke-width="1.5"
					/>
					{@render txt(CL + 54, y + 5, pageName(p), 13, { anchor: 'middle', weight: 700 })}
					<!-- votes: one ballot mark per incoming link -->
					{#each Array.from({ length: votes[p] }, (_, i) => i) as i (i)}
						<rect
							x={CL + 78 + i * 13}
							y={y - 6}
							width="9"
							height="12"
							rx="2"
							fill="var(--rank-page)"
							opacity={lerp(0.85, 0.5, wWeighted)}
						/>
					{/each}
					<g opacity={wCount}>
						{@render txt(CL + 136, y + 5, voteText(votes[p]), 13, { muted: votes[p] === 0 })}
					</g>
					<!-- PageRank bar and share -->
					<g opacity={wWeighted}>
						<rect
							x={BAR_L}
							y={y - 4}
							width={BAR_R - BAR_L}
							height="8"
							rx="4"
							fill="var(--stage-line)"
							opacity="0.35"
						/>
						<rect
							x={BAR_L}
							y={y - 4}
							width={Math.max(4, ((BAR_R - BAR_L) * rank[p]) / rank[byRank[0]])}
							height="8"
							rx="4"
							fill="var(--rank-page)"
						/>
						{@render txt(CR - 14, y + 5, pct(rank[p]), 13, {
							anchor: 'end',
							weight: 600,
							tabular: true
						})}
					</g>
				</g>
			{/each}

			<!-- footers -->
			<g opacity={wCount * askIn}>
				{@render txt(CL + 20, CB - 38, 'But should every vote', 13, { weight: 600 })}
				{@render txt(CL + 20, CB - 20, 'count the same?', 13, { weight: 600 })}
			</g>
			<g opacity={wWeighted}>
				{@render txt(CL + 20, CB - 38, 'page size = PageRank', 12, { muted: true })}
				{@render txt(CL + 20, CB - 20, 'arrow width = share it passes on', 12, {
					muted: true
				})}
			</g>
		</g>
	{/if}
</g>
