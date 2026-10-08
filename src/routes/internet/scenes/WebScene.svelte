<script lang="ts">
	/**
	 * A first visit to https://example.org as a sequence diagram: one column
	 * per machine, one row per message, from the name lookup (DNS) to the page.
	 * The messages and their times come from `webRequest` (round trip to the web
	 * server from `params.rtt`, resolver cache from `params.cached`).
	 *
	 * Playback is 100× slower than real time, so a longer round trip visibly
	 * takes longer; the bar below is drawn to a fixed scale in milliseconds.
	 * Reduced motion shows the finished diagram.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { clamp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { webRequest, type Lane, type Phase } from '../network';

	let { t, params, reduced }: StageProps = $props();

	const rtt = $derived(clamp(Number(params.rtt ?? 80), 10, 300));
	const cached = $derived(params.cached === true);
	const req = $derived(webRequest({ rtt, cached }));

	/** Seconds of animation per millisecond of real time. */
	const SLOW = 0.01;
	const LEAD = 0.6;
	const HOLD = 3.5;
	const period = $derived(LEAD + req.total * SLOW + HOLD);
	const ms = $derived(reduced ? Infinity : ((t % period) - LEAD) / SLOW);

	const LANES: { id: Lane; x: number; title: string; sub: string }[] = [
		{ id: 'browser', x: 70, title: 'Your browser', sub: '' },
		{ id: 'resolver', x: 214, title: 'DNS resolver', sub: '' },
		{ id: 'root', x: 340, title: 'Root', sub: 'name server' },
		{ id: 'tld', x: 460, title: '.org', sub: 'name server' },
		{ id: 'auth', x: 580, title: 'example.org', sub: 'name server' },
		{ id: 'server', x: 760, title: 'Web server', sub: 'example.org' }
	];
	const laneX = (id: Lane) => LANES.find((l) => l.id === id)!.x;

	const PHASES: Record<Phase, { name: string; color: string }> = {
		dns: { name: 'Find the address (DNS)', color: 'var(--net-dns)' },
		tcp: { name: 'Connect (TCP)', color: 'var(--net-tcp)' },
		tls: { name: 'Agree keys (TLS)', color: 'var(--net-tls)' },
		http: { name: 'Ask for the page (HTTP)', color: 'var(--net-http)' }
	};

	const TOP = 118;
	const ROW = $derived(Math.min(30, 316 / req.msgs.length));
	/** Extra space between the phases, so their bands do not touch. */
	const GAP = 12;
	const ORDER: Phase[] = ['dns', 'tcp', 'tls', 'http'];
	const rows = $derived(
		req.msgs.map((m, i) => {
			const x1 = laneX(m.from);
			const x2 = laneX(m.to);
			const y1 = TOP + i * ROW + ORDER.indexOf(m.phase) * GAP;
			// Shallow arrows, labelled above their start, so a label never touches the
			// arrow before it (the DNS rows are close together).
			const y2 = y1 + ROW * 0.5;
			const p = clamp((ms - m.t0) / (m.t1 - m.t0));
			return { ...m, i, x1, x2, y1, y2, p };
		})
	);
	const bands = $derived(
		req.phases.map((ph) => {
			const inPhase = rows.filter((r) => r.phase === ph.phase);
			return {
				...ph,
				y0: inPhase[0].y1 - 16,
				y1: inPhase[inPhase.length - 1].y2 + 4,
				active: ms >= ph.t0 && ms < ph.t1,
				done: ms >= ph.t1
			};
		})
	);
	const BOTTOM = $derived(rows[rows.length - 1].y2 + 6);

	// Time bar
	const BAR_X = 70;
	const BAR_W = 820;
	const BAR_Y = 498;
	const MAX_MS = 1100;
	const bx = (v: number) => BAR_X + (Math.min(v, MAX_MS) / MAX_MS) * BAR_W;
	const now = $derived(Math.max(0, Math.min(ms, req.total)));
	const TICKS = [0, 200, 400, 600, 800, 1000];
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
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

<g>
	<!-- phase bands -->
	{#each bands as b (b.phase)}
		<rect
			x="24"
			y={b.y0}
			width="912"
			height={b.y1 - b.y0}
			rx="8"
			fill={PHASES[b.phase].color}
			opacity={b.active ? 0.13 : 0.06}
		/>
		{@render txt(932, b.y0 + 16, PHASES[b.phase].name, 12, {
			anchor: 'end',
			weight: 600,
			color: PHASES[b.phase].color
		})}
		{@render txt(932, b.y0 + 31, `${Math.round(b.t1 - b.t0)} ms`, 11, {
			anchor: 'end',
			muted: true,
			opacity: b.done || reduced ? 1 : 0.5
		})}
	{/each}

	<!-- lanes -->
	{#each LANES as l (l.id)}
		{@const dim = cached && (l.id === 'root' || l.id === 'tld' || l.id === 'auth')}
		<g opacity={dim ? 0.4 : 1}>
			{@render txt(l.x, 62, l.title, 13, { anchor: 'middle', weight: 700 })}
			{#if l.sub}
				{@render txt(l.x, 78, l.sub, 11, { anchor: 'middle', muted: true })}
			{/if}
			<line
				x1={l.x}
				x2={l.x}
				y1="92"
				y2={BOTTOM}
				stroke="var(--stage-line)"
				stroke-width="1.5"
				stroke-dasharray="4 5"
				opacity="0.6"
			/>
			<rect x={l.x - 7} y="88" width="14" height="6" rx="2" fill="var(--net-router-edge)" />
		</g>
	{/each}

	<!-- messages -->
	{#each rows as r (r.id)}
		{@const color = PHASES[r.phase].color}
		{@const xm = r.x1 + (r.x2 - r.x1) * r.p}
		{@const ym = r.y1 + (r.y2 - r.y1) * r.p}
		{@const lx = (r.x1 + r.x2) / 2}
		{@const ly = r.y1 - 4}
		<line
			x1={r.x1}
			y1={r.y1}
			x2={r.x2}
			y2={r.y2}
			stroke={color}
			stroke-width="1.5"
			stroke-dasharray="3 4"
			opacity={r.p >= 1 ? 0 : 0.35}
		/>
		{#if r.p > 0}
			<line
				x1={r.x1}
				y1={r.y1}
				x2={xm}
				y2={ym}
				stroke={color}
				stroke-width="2.5"
				marker-end={r.p >= 1 ? 'url(#arrowhead)' : undefined}
			/>
		{/if}
		{#if r.p > 0 && r.p < 1}
			<circle cx={xm} cy={ym} r="6" fill={color} stroke="var(--stage-bg)" stroke-width="1.5" />
		{/if}
		{@render txt(lx, ly, r.label, 12, {
			anchor: 'middle',
			weight: r.p > 0 ? 600 : 500,
			opacity: r.p > 0 ? 1 : 0.45
		})}
	{/each}

	<!-- time bar -->
	{@render txt(BAR_X, BAR_Y - 16, 'Time from pressing Enter (real milliseconds)', 12, {
		muted: true,
		weight: 600
	})}
	<rect
		x={BAR_X}
		y={BAR_Y}
		width={BAR_W}
		height="18"
		rx="5"
		fill="var(--stage-grid)"
		opacity="0.6"
	/>
	{#each req.phases as ph (ph.phase)}
		{@const x0 = bx(ph.t0)}
		{@const x1 = bx(Math.min(ph.t1, now))}
		{#if x1 > x0}
			<rect
				x={x0}
				y={BAR_Y}
				width={x1 - x0}
				height="18"
				fill={PHASES[ph.phase].color}
				opacity="0.85"
			/>
		{/if}
		<line
			x1={bx(ph.t1)}
			x2={bx(ph.t1)}
			y1={BAR_Y - 3}
			y2={BAR_Y + 21}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}
	{#each TICKS as v (v)}
		<line x1={bx(v)} x2={bx(v)} y1={BAR_Y + 20} y2={BAR_Y + 25} stroke="var(--stage-line)" />
		{@render txt(bx(v), BAR_Y + 38, `${v}`, 11, { anchor: 'middle', muted: true })}
	{/each}
	{@render txt(BAR_X + BAR_W + 8, BAR_Y + 38, 'ms', 11, { muted: true })}
	{@render txt(
		BAR_X,
		BAR_Y + 66,
		now >= req.total
			? `Page arrives after ${Math.round(req.total)} ms: ${cached ? 'a quick lookup' : 'a full lookup'} + 3 round trips of ${rtt} ms`
			: `${Math.round(now)} ms …`,
		14,
		{ weight: 700 }
	)}
</g>
