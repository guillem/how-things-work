<script lang="ts">
	/**
	 * The map of routers: Ada's computer on the left, Ben's on the right, eight
	 * routers between. The whole run is simulated up front by `simulate` (a
	 * `$derived` of the controls, never of t) and this scene only samples it at
	 * the run time `s`: packets on links or waiting in queues, losses (✕), the
	 * news of a failed link (rings), each router's own next hop towards Ben
	 * (arrows), Ada's outbox and Ben's reassembly buffer.
	 *
	 * The run replays in a loop. When a control changes, the run restarts from
	 * that moment (the restart pattern of logic-gates' RippleScene), so a cut
	 * chosen by clicking a link is seen from the start. Reduced motion shows
	 * the run at `hints.still` seconds.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BUFFER,
		BUSY,
		CUT_AT,
		HORIZON,
		LINKS,
		NODES,
		ROUTERS,
		addressBits,
		linkById,
		nextHop,
		nodeById,
		simulate,
		tableOf,
		whereAt,
		type Packet
	} from '../network';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const hints = $derived(step.hints ?? {});
	const useCut = $derived(!!hints.useCut);
	const useLoss = $derived(!!hints.useLoss);
	const useLoad = $derived(!!hints.useLoad);
	const showAcks = $derived(!!hints.acks);
	const showArrows = $derived(!!hints.arrows);
	const panel = $derived(String(hints.panel ?? 'stats'));

	const cut = $derived(
		useCut && params.cut && params.cut !== 'none' && linkById.has(String(params.cut))
			? String(params.cut)
			: null
	);
	const loss = $derived(useLoss ? Number(params.loss ?? 0) / 100 : 0);
	const load = $derived(useLoad ? Number(params.load ?? 0) / 100 : 0);
	const seed = $derived(1 + Number(params.send ?? 0));
	const sim = $derived(simulate({ cut, loss, load, seed }));
	const period = $derived(
		Math.min(HORIZON, Math.max(12, (Number.isFinite(sim.done) ? sim.done : HORIZON) + 3.5))
	);

	// ---- run time: restarts when the scenario changes ----------------------------------
	let lastKey = '';
	let t0 = 0;
	const s = $derived.by(() => {
		const key = `${step.id}|${cut}|${loss}|${load}|${seed}`;
		if (key !== lastKey) {
			t0 = lastKey === '' || lastKey.split('|')[0] !== step.id ? 0 : t;
			lastKey = key;
		}
		if (t < t0) t0 = 0;
		if (reduced) return Number(hints.still ?? 2.5);
		return (t - t0) % period;
	});
	/** Fades the moving things in at the start of a run and out at its end. */
	const runFade = $derived(
		reduced ? 1 : smoothstep(0, 0.35, s) * (1 - smoothstep(period - 0.7, period - 0.1, s))
	);

	// ---- geometry -----------------------------------------------------------------------
	const P = (id: string) => nodeById.get(id)!;
	const R_ROUTER = 18;
	/** Point at fraction u from `from` to `to`, shifted `off` to the right of travel. */
	/** Packets travel between the edges of the shapes, so they never hide a router's name. */
	const radius = (id: string) => (P(id).kind === 'host' ? 34 : R_ROUTER + 8);
	function onLink(from: string, to: string, u: number, off = 7) {
		const a = P(from);
		const b = P(to);
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len = Math.hypot(dx, dy) || 1;
		const ra = radius(from);
		const d = ra + (len - ra - radius(to)) * u;
		return {
			x: a.x + (dx / len) * d - (dy / len) * off,
			y: a.y + (dy / len) * d + (dx / len) * off
		};
	}
	// A router's queue is a column of packets beside it (below G, whose upper side is
	// crowded with links; above the others). Slot 0 is the packet being sent.
	const QUEUE_DY = 16;
	const QUEUE_0 = 26;
	const qDir = (node: string) => (node === BUSY ? 1 : -1);
	const queuePos = (node: string, slot: number) => {
		const n = P(node);
		const full = slot > BUFFER;
		return {
			x: n.x - (full ? 24 : 0),
			y: n.y + qDir(node) * (QUEUE_0 + slot * QUEUE_DY)
		};
	};

	const cutDown = $derived(cut !== null && s >= CUT_AT);
	const knows = (r: string) => s >= (sim.learn.get(r) ?? Infinity);

	// Each router's own next hop towards Ben, before and after it hears of the cut.
	const arrowsBefore = new Map(ROUTERS.map((r) => [r, nextHop(r, 'ben')]));
	const arrowsAfter = $derived(
		new Map(ROUTERS.map((r) => [r, nextHop(r, 'ben', new Set(cut ? [cut] : []))]))
	);
	const arrows = $derived(
		ROUTERS.map((r) => {
			const nh = (knows(r) ? arrowsAfter : arrowsBefore).get(r) ?? null;
			const dead = nh !== null && cutDown && linkById.get([r, nh].sort().join('-'))?.id === cut;
			return { r, nh, dead };
		})
	);

	// ---- packets at time s --------------------------------------------------------------
	interface Drawn {
		uid: number;
		kind: Packet['kind'];
		seq: number;
		attempt: number;
		x: number;
		y: number;
	}
	const drawn = $derived.by(() => {
		const out: Drawn[] = [];
		for (const p of sim.packets) {
			if (p.kind === 'ack' && !showAcks) continue;
			if (p.segments.length === 0 || s < p.segments[0].t0 || s >= p.end) continue;
			const w = whereAt(p, s);
			if (!w) continue;
			const pos =
				w.kind === 'link'
					? onLink(w.from, w.to, w.u, p.kind === 'other' ? 0 : 7)
					: queuePos(w.node, w.slot);
			out.push({ uid: p.uid, kind: p.kind, seq: p.seq, attempt: p.attempt, ...pos });
		}
		// Data on top of acknowledgements on top of other traffic.
		const rank = { other: 0, ack: 1, data: 2 };
		return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
	});

	const LOST_SHOW = 1.6;
	const losses = $derived.by(() => {
		const out: { uid: number; x: number; y: number; o: number; kind: Packet['kind'] }[] = [];
		for (const p of sim.packets) {
			if (!p.fate || p.fate === 'delivered' || !p.endAt) continue;
			if (p.kind === 'ack' && !showAcks) continue;
			if (p.kind === 'other' && !useLoad) continue;
			const age = s - p.end;
			const keep = reduced ? 3 : LOST_SHOW;
			if (age < 0 || age > keep) continue;
			const pos =
				'node' in p.endAt
					? queuePos(p.endAt.node, BUFFER + 1)
					: onLink(p.endAt.from, p.endAt.to, p.endAt.u, p.kind === 'other' ? 0 : 7);
			out.push({
				uid: p.uid,
				...pos,
				o: reduced ? 1 : 1 - smoothstep(LOST_SHOW * 0.5, LOST_SHOW, age),
				kind: p.kind
			});
		}
		return out;
	});

	// ---- the two ends -------------------------------------------------------------------
	const sentCount = $derived(sim.sends.map((list) => list.filter((x) => x <= s).length));
	const ackedNow = $derived(sim.acked.map((a) => a <= s));
	const gotNow = $derived(sim.received.map((r) => r <= s));
	const complete = $derived(gotNow.every(Boolean));
	const missingFirst = $derived(gotNow.findIndex((g) => !g));
	const lostSoFar = $derived(
		sim.packets.filter((p) => p.kind === 'data' && p.fate && p.fate !== 'delivered' && p.end <= s)
			.length
	);
	const resentSoFar = $derived(sentCount.reduce((n, c) => n + Math.max(0, c - 1), 0));
	const outOfOrder = $derived.by(() => {
		// Has a later packet arrived before an earlier one (so far)?
		let latest = -1;
		for (const i of sim.received
			.map((r, i) => [r, i] as const)
			.filter(([r]) => r <= s)
			.sort((a, b) => a[0] - b[0])
			.map(([, i]) => i)) {
			if (i < latest) return true;
			latest = Math.max(latest, i);
		}
		return false;
	});

	// The packet whose header is shown (step 1): the one most recently sent.
	const headerSeq = $derived.by(() => {
		let best = 0;
		let bestT = -Infinity;
		sim.sends.forEach((list, i) => {
			for (const x of list) if (x <= s && x > bestT) [best, bestT] = [i, x];
		});
		return best;
	});
	const ADA = P('ada');
	const BEN = P('ben');
	const benBits = addressBits(BEN.address!);

	// Router table (step 2)
	const selected = $derived(ROUTERS.includes(String(params.router)) ? String(params.router) : 'D');
	const table = $derived(tableOf(selected));
	const tableRows = $derived(
		['ben', 'ada', ...ROUTERS.filter((r) => r !== selected)].map((d) => ({
			d,
			label: P(d).label,
			nh: table.get(d) ?? null
		}))
	);

	// ---- interaction --------------------------------------------------------------------
	function toggleCut(id: string) {
		setParam('cut', cut === id ? 'none' : id);
	}
	function keyActivate(e: KeyboardEvent, fn: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fn();
		}
	}

	const linkLabel = (id: string) => id.replace('-', '–');
	const PANEL_Y = 452;
	const SLOT = 30;
	const LEFT_X = 40;
	const RIGHT_X = 672;
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
		mono?: boolean;
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
		style:font-family={opts.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet laptop(x: number, y: number)}
	<rect
		x={x - 24}
		y={y - 22}
		width="48"
		height="32"
		rx="4"
		fill="var(--net-host)"
		stroke="var(--net-router-edge)"
		stroke-width="1.5"
	/>
	<path
		d="M{x - 32} {y + 12} H{x + 32} L{x + 28} {y + 18} H{x - 28} Z"
		fill="var(--net-router-edge)"
		opacity="0.8"
	/>
{/snippet}

{#snippet routerBody(x: number, y: number, label: string, isSel: boolean, heard: boolean)}
	<circle
		class="focus-ring"
		cx={x}
		cy={y}
		r={R_ROUTER + 6}
		fill="none"
		stroke="var(--focus)"
		stroke-width="2"
	/>
	<circle
		cx={x}
		cy={y}
		r={R_ROUTER}
		fill="var(--net-router)"
		stroke={isSel ? 'var(--net-route)' : 'var(--net-router-edge)'}
		stroke-width={isSel ? 3 : 1.5}
	/>
	{@render txt(x, y + 5, label, 14, { anchor: 'middle', weight: 700, halo: false })}
	{#if heard}
		<circle
			cx={x + 13}
			cy={y - 13}
			r="5"
			fill="var(--net-news)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}
{/snippet}

<g>
	<!-- legend and clock -->
	<g style:pointer-events="none">
		<rect x="24" y="22" width="20" height="13" rx="3" fill="var(--net-packet)" />
		{@render txt(50, 33, 'packet of the message', 12, { muted: true })}
		{#if showAcks}
			<circle cx="206" cy="28.5" r="6" fill="var(--net-ack)" />
			{@render txt(218, 33, 'acknowledgement', 12, { muted: true })}
		{/if}
		{#if useLoad && load > 0}
			<rect x="340" y="23" width="16" height="11" rx="3" fill="var(--net-other)" />
			{@render txt(362, 33, "other people's traffic", 12, { muted: true })}
		{/if}
		{#if useLoad}
			<rect
				x="510"
				y="21"
				width="12"
				height="16"
				rx="3"
				fill="none"
				stroke="var(--net-router-edge)"
				stroke-dasharray="3 3"
			/>
			{@render txt(530, 33, `G's queue (room for ${BUFFER})`, 12, { muted: true })}
		{/if}
		{@render txt(936, 33, `simulated time ${s.toFixed(1)} s (slowed down)`, 12, {
			anchor: 'end',
			muted: true
		})}
	</g>

	<!-- links -->
	{#each LINKS as l (l.id)}
		{@const a = P(l.a)}
		{@const b = P(l.b)}
		{@const down = cutDown && l.id === cut}
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			stroke={down ? 'var(--net-lost)' : 'var(--net-link)'}
			stroke-width={down ? 2.5 : 4}
			stroke-dasharray={down ? '7 6' : undefined}
			stroke-linecap="round"
		/>
		{#if down}
			{@const m = onLink(l.a, l.b, 0.5, 0)}
			<rect
				x={m.x - 24}
				y={m.y - 10}
				width="48"
				height="20"
				rx="10"
				fill="var(--surface)"
				stroke="var(--net-lost)"
				stroke-width="1.5"
			/>
			{@render txt(m.x, m.y + 4, 'failed', 11, {
				anchor: 'middle',
				weight: 700,
				color: 'var(--net-lost)',
				halo: false
			})}
		{:else if useCut && cut === l.id}
			{@const m = onLink(l.a, l.b, 0.5, 0)}
			<circle
				cx={m.x}
				cy={m.y}
				r="5"
				fill="none"
				stroke="var(--net-lost)"
				stroke-width="1.5"
				stroke-dasharray="2 2"
			/>
		{/if}
	{/each}

	<!-- each router's own choice of next hop towards Ben -->
	{#if showArrows}
		{#each arrows as ar (ar.r)}
			{#if ar.nh}
				{@const a = onLink(ar.r, ar.nh, 0.3, 0)}
				{@const b = onLink(ar.r, ar.nh, 0.5, 0)}
				{@const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}
				<g opacity={panel === 'table' && ar.r !== selected ? 0.45 : 1} style:pointer-events="none">
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke={ar.dead ? 'var(--net-lost)' : 'var(--net-route)'}
						stroke-width="3"
						stroke-linecap="round"
					/>
					<path
						d="M0 -6 L10 0 L0 6 Z"
						transform="translate({b.x} {b.y}) rotate({ang})"
						fill={ar.dead ? 'var(--net-lost)' : 'var(--net-route)'}
					/>
				</g>
			{/if}
		{/each}
	{/if}

	<!-- clickable links (cutting) -->
	{#if useCut}
		{#each LINKS.filter((l) => l.cuttable) as l (l.id)}
			{@const a = P(l.a)}
			{@const b = P(l.b)}
			<line
				class="hit"
				role="button"
				tabindex="0"
				aria-label={cut === l.id ? `Repair link ${linkLabel(l.id)}` : `Cut link ${linkLabel(l.id)}`}
				aria-pressed={cut === l.id}
				x1={a.x}
				y1={a.y}
				x2={b.x}
				y2={b.y}
				stroke="transparent"
				stroke-width="18"
				stroke-linecap="round"
				onclick={() => toggleCut(l.id)}
				onkeydown={(e) => keyActivate(e, () => toggleCut(l.id))}
			/>
		{/each}
	{/if}

	<!-- the busy router's queue: room for one being sent and BUFFER waiting -->
	{#if useLoad}
		{@const g = P(BUSY)}
		<rect
			x={g.x - 16}
			y={g.y + QUEUE_0 + 0.5 * QUEUE_DY}
			width="32"
			height={BUFFER * QUEUE_DY}
			rx="5"
			fill="none"
			stroke="var(--net-router-edge)"
			stroke-dasharray="3 3"
			opacity="0.8"
		/>
	{/if}

	<!-- computers -->
	{@render laptop(ADA.x, ADA.y)}
	{@render txt(ADA.x, ADA.y + 40, 'Ada', 13, { anchor: 'middle', weight: 700 })}
	{@render txt(ADA.x, ADA.y + 56, ADA.address!, 11, { anchor: 'middle', muted: true })}
	{@render laptop(BEN.x, BEN.y)}
	{@render txt(BEN.x, BEN.y + 40, 'Ben', 13, { anchor: 'middle', weight: 700 })}
	{@render txt(BEN.x - 6, BEN.y + 56, BEN.address!, 11, { anchor: 'middle', muted: true })}

	<!-- routers -->
	{#each NODES.filter((n) => n.kind === 'router') as n (n.id)}
		{@const learnT = sim.learn.get(n.id) ?? Infinity}
		{@const ringAge = s - learnT}
		{@const isSel = panel === 'table' && n.id === selected}
		{#if cut && ringAge >= 0 && ringAge < 1.2 && !reduced}
			<circle
				cx={n.x}
				cy={n.y}
				r={R_ROUTER + 4 + ringAge * 26}
				fill="none"
				stroke="var(--net-news)"
				stroke-width="2.5"
				opacity={1 - ringAge / 1.2}
			/>
		{/if}
		{#if panel === 'table'}
			<g
				class="router clickable"
				role="button"
				tabindex="0"
				aria-label="Show router {n.label}'s table"
				aria-pressed={isSel}
				onclick={() => setParam('router', n.id)}
				onkeydown={(e) => keyActivate(e, () => setParam('router', n.id))}
			>
				{@render routerBody(n.x, n.y, n.label, isSel, !!cut && ringAge >= 0)}
			</g>
		{:else}
			<g class="router" role="img" aria-label="Router {n.label}">
				{@render routerBody(n.x, n.y, n.label, isSel, !!cut && ringAge >= 0)}
			</g>
		{/if}
		{#if n.id === BUSY && useLoad && load > 0}
			{@render txt(n.x + 22, n.y - 18, 'busy', 11, { muted: true })}
		{/if}
	{/each}

	<!-- packets -->
	<g opacity={runFade} style:pointer-events="none">
		{#each drawn as d (d.uid)}
			{#if d.kind === 'data'}
				<rect
					x={d.x - 12}
					y={d.y - 8}
					width="24"
					height="16"
					rx="4"
					fill="var(--net-packet)"
					stroke={panel === 'header' && d.seq === headerSeq
						? 'var(--stage-ink)'
						: 'var(--stage-bg)'}
					stroke-width={panel === 'header' && d.seq === headerSeq ? 2 : 1}
				/>
				{@render txt(d.x, d.y + 4, String(d.seq + 1), 11, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--stage-bg)',
					halo: false
				})}
			{:else if d.kind === 'ack'}
				<circle
					cx={d.x}
					cy={d.y}
					r="7"
					fill="var(--net-ack)"
					stroke="var(--stage-bg)"
					stroke-width="1"
				/>
				{@render txt(d.x, d.y + 3.5, String(d.seq + 1), 9, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--stage-bg)',
					halo: false
				})}
			{:else}
				<rect x={d.x - 8} y={d.y - 6} width="16" height="12" rx="3" fill="var(--net-other)" />
			{/if}
		{/each}
		{#each losses as l (l.uid)}
			{@const r = l.kind === 'other' ? 5 : 8}
			<g opacity={l.o}>
				<circle cx={l.x} cy={l.y} r={r + 4} fill="var(--stage-bg)" opacity="0.8" />
				<path
					d="M{l.x - r} {l.y - r} L{l.x + r} {l.y + r} M{l.x + r} {l.y - r} L{l.x - r} {l.y + r}"
					stroke={l.kind === 'other' ? 'var(--net-other)' : 'var(--net-lost)'}
					stroke-width="3"
					stroke-linecap="round"
				/>
			</g>
		{/each}
	</g>

	<!-- bottom panel: Ada's outbox, the middle readout, Ben's buffer -->
	<g style:pointer-events="none">
		<rect
			x="16"
			y={PANEL_Y}
			width="928"
			height="132"
			rx="14"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<line x1="312" x2="312" y1={PANEL_Y + 16} y2={PANEL_Y + 116} stroke="var(--border)" />
		<line x1="648" x2="648" y1={PANEL_Y + 16} y2={PANEL_Y + 116} stroke="var(--border)" />

		{@render txt(LEFT_X, PANEL_Y + 26, "Ada's computer sends", 12, {
			muted: true,
			weight: 600,
			halo: false
		})}
		{#each sim.chunks.map((_c, i) => i) as i (i)}
			{@const x = LEFT_X + i * SLOT}
			{@const sent = sentCount[i] > 0}
			{@const ok = showAcks && ackedNow[i]}
			<rect
				{x}
				y={PANEL_Y + 40}
				width="25"
				height="20"
				rx="4"
				fill={ok ? 'var(--net-ack)' : sent ? 'var(--net-packet)' : 'none'}
				fill-opacity={ok ? 0.85 : sent ? 0.3 : 0}
				stroke={ok ? 'var(--net-ack)' : 'var(--net-packet)'}
				stroke-dasharray={sent ? undefined : '3 3'}
				stroke-width="1.5"
			/>
			{@render txt(x + 12.5, PANEL_Y + 54, String(i + 1), 11, {
				anchor: 'middle',
				weight: 700,
				halo: false,
				color: ok ? 'var(--stage-bg)' : undefined
			})}
			{#if sentCount[i] > 1}
				{@render txt(x + 12.5, PANEL_Y + 76, `×${sentCount[i]}`, 11, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--net-news)',
					halo: false
				})}
			{:else if ok}
				{@render txt(x + 12.5, PANEL_Y + 76, '✓', 12, {
					anchor: 'middle',
					weight: 700,
					color: 'var(--net-ack)',
					halo: false
				})}
			{/if}
		{/each}
		{@render txt(
			LEFT_X,
			PANEL_Y + 104,
			showAcks
				? `keeps a copy until ✓ · resends after ${sim.rto.toFixed(1)} s`
				: `${sentCount.reduce((a, b) => a + b, 0)} sent, one every 0.4 s`,
			11,
			{ muted: true, halo: false }
		)}

		<!-- middle -->
		{#if panel === 'header'}
			{@const k = headerSeq}
			{@render txt(330, PANEL_Y + 26, `Packet ${k + 1} of ${sim.count}: the header`, 12, {
				muted: true,
				weight: 600,
				halo: false
			})}
			{@render txt(330, PANEL_Y + 48, 'From', 12, { muted: true, halo: false })}
			{@render txt(372, PANEL_Y + 48, ADA.address!, 12, { weight: 600, halo: false })}
			{@render txt(482, PANEL_Y + 48, 'No.', 12, { muted: true, halo: false })}
			{@render txt(510, PANEL_Y + 48, `${k + 1}`, 12, { weight: 600, halo: false })}
			{@render txt(540, PANEL_Y + 48, 'Data', 12, { muted: true, halo: false })}
			{@render txt(576, PANEL_Y + 48, `“${sim.chunks[k]}”`, 12, { weight: 600, halo: false })}
			{@render txt(330, PANEL_Y + 70, 'To', 12, { muted: true, halo: false })}
			{@render txt(372, PANEL_Y + 70, BEN.address!, 12, { weight: 600, halo: false })}
			{@render txt(330, PANEL_Y + 92, 'in bits', 11, { muted: true, halo: false })}
			{@render txt(372, PANEL_Y + 92, benBits.join(' '), 11, { mono: true, halo: false })}
			{@render txt(330, PANEL_Y + 112, 'Routers read only the “To” address.', 11, {
				muted: true,
				halo: false
			})}
		{:else if panel === 'table'}
			{@render txt(330, PANEL_Y + 26, `Router ${selected}'s own table`, 12, {
				muted: true,
				weight: 600,
				halo: false
			})}
			{@render txt(630, PANEL_Y + 26, 'to → send via', 11, {
				muted: true,
				anchor: 'end',
				halo: false
			})}
			{#each tableRows as row, i (row.d)}
				{@const col = Math.floor(i / 3)}
				{@const x = 330 + col * 104}
				{@const y = PANEL_Y + 50 + (i % 3) * 22}
				{@render txt(x, y, row.label, 12, { weight: row.d === 'ben' ? 700 : 500, halo: false })}
				{@render txt(x + 38, y, `→ ${row.nh ? P(row.nh).label : '—'}`, 12, {
					weight: 700,
					color: row.d === 'ben' ? 'var(--net-route)' : undefined,
					halo: false
				})}
			{/each}
			{@render txt(330, PANEL_Y + 118, 'Each router keeps its own, worked out from its map.', 11, {
				muted: true,
				halo: false
			})}
		{:else}
			{@render txt(330, PANEL_Y + 26, 'So far', 12, { muted: true, weight: 600, halo: false })}
			{#each [{ k: 'lost', label: 'lost on the way', v: lostSoFar, c: 'var(--net-lost)' }, { k: 'again', label: 'sent again', v: resentSoFar, c: 'var(--net-news)' }, { k: 'got', label: 'arrived at Ben', v: gotNow.filter(Boolean).length, c: 'var(--net-packet)' }] as cell, i (cell.k)}
				{@const x = 330 + i * 104}
				{@render txt(x, PANEL_Y + 62, String(cell.v), 22, {
					weight: 700,
					color: cell.c,
					halo: false
				})}
				{@render txt(x, PANEL_Y + 80, cell.label, 11, { muted: true, halo: false })}
			{/each}
			{@render txt(
				330,
				PANEL_Y + 110,
				cut && s >= CUT_AT
					? `Link ${linkLabel(cut)} failed at ${CUT_AT} s${outOfOrder ? ' · packets arrived out of order' : ''}`
					: outOfOrder
						? 'Packets arrived out of order'
						: useCut && cut
							? `Link ${linkLabel(cut)} will fail at ${CUT_AT} s`
							: lostSoFar > 0
								? 'The routers will not resend what they lost'
								: 'Nothing has gone wrong yet',
				11,
				{ muted: true, halo: false }
			)}
		{/if}

		{@render txt(RIGHT_X, PANEL_Y + 26, "Ben's computer puts them in order", 12, {
			muted: true,
			weight: 600,
			halo: false
		})}
		{#each sim.chunks as chunk, i (i)}
			{@const x = RIGHT_X + i * SLOT}
			<rect
				{x}
				y={PANEL_Y + 40}
				width="25"
				height="20"
				rx="4"
				fill={gotNow[i] ? 'var(--net-packet)' : 'none'}
				fill-opacity="0.15"
				stroke="var(--net-packet)"
				stroke-dasharray={gotNow[i] ? undefined : '3 3'}
				stroke-width="1.5"
			/>
			{@render txt(
				x + 12.5,
				PANEL_Y + 54,
				gotNow[i] ? chunk.replace(' ', '␣') : String(i + 1),
				11,
				{
					anchor: 'middle',
					weight: gotNow[i] ? 700 : 500,
					muted: !gotNow[i],
					mono: gotNow[i],
					halo: false
				}
			)}
		{/each}
		{#if complete}
			{@render txt(RIGHT_X, PANEL_Y + 90, sim.chunks.join(''), 18, {
				weight: 700,
				halo: false,
				mono: true
			})}
			{@render txt(RIGHT_X, PANEL_Y + 110, 'Complete: every number is there.', 11, {
				muted: true,
				halo: false
			})}
		{:else}
			{@render txt(
				RIGHT_X,
				PANEL_Y + 90,
				gotNow.some(Boolean) ? `waiting for packet ${missingFirst + 1}…` : 'waiting…',
				12,
				{ muted: true, halo: false }
			)}
			{@render txt(RIGHT_X, PANEL_Y + 110, 'Delivers the message only when complete.', 11, {
				muted: true,
				halo: false
			})}
		{/if}
	</g>
</g>

<style>
	.hit {
		cursor: pointer;
		outline: none;
	}
	.hit:hover {
		stroke: var(--net-lost);
		stroke-opacity: 0.18;
	}
	.hit:focus-visible {
		stroke: var(--focus);
		stroke-opacity: 0.45;
	}
	.router {
		outline: none;
	}
	.router.clickable {
		cursor: pointer;
	}
	.focus-ring {
		opacity: 0;
	}
	.router:focus-visible .focus-ring {
		opacity: 1;
	}
</style>
