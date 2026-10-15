<script lang="ts">
	/**
	 * Forks (`forkRun`): five miners find blocks at random, one per 600 s on average, and each
	 * block reaches the others after `params.delay` seconds. Simulated time runs RATE times
	 * faster than real. Top: the miners, each new block's news travelling to the others along
	 * arcs. Bottom: the block tree, the winning chain on the lower lane and branches that lose
	 * above it; a branch is dimmed ("orphaned") once the winning chain is two blocks past it.
	 * Under each block, a dot for every miner currently mining on it. The run replays in a
	 * loop, restarting when a control changes; reduced motion shows the end of the run.
	 */
	import { clamp, easeInOut, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type Params } from '#lib/explainer/index.ts';
	import { MINERS, forkLanes, forkRun } from '../consensus';

	interface Props {
		t: number;
		params: Params;
		reduced: boolean;
	}
	let { t, params, reduced }: Props = $props();

	const delay = $derived(clamp(Number(params.delay ?? 120), 0, 300));
	const seed = $derived(1 + Number(params.reforks ?? 0));
	const BLOCKS = 30;
	const RATE = 200;
	const run = $derived(forkRun({ delay, blocks: BLOCKS, seed }));
	const period = $derived(run.end / RATE + delay / RATE + 4);
	/** A long-run figure for this delay: 4000 more simulated blocks. */
	const longRun = $derived.by(() => {
		let stale = 0;
		let settled = 0;
		for (let k = 0; k < 10; k++) {
			const r = forkRun({ delay, blocks: 400, seed: 100 + k });
			stale += r.stale;
			settled += r.settled;
		}
		return stale / settled;
	});

	// ---- run time ---------------------------------------------------------------------------
	let lastKey = '';
	let t0 = 0;
	const sim = $derived.by(() => {
		const key = `${delay}|${seed}`;
		if (key !== lastKey) {
			t0 = lastKey === '' ? 0 : t;
			lastKey = key;
		}
		if (t < t0) t0 = 0;
		if (reduced) return run.end + delay * 2;
		return (((t - t0) % period) - 0.3) * RATE;
	});
	const fade = $derived(
		reduced ? 1 : 1 - smoothstep(period - 0.6, period - 0.05, (sim / RATE + 0.3) % period)
	);

	// ---- what is known at sim time -----------------------------------------------------------
	const found = $derived(run.tree.filter((b) => b.id === 0 || b.t <= sim));
	const top = $derived(found.reduce((m, b) => Math.max(m, b.height), 0));
	/** The tip each miner is mining on: the highest block it has heard of (first heard on ties). */
	const tips = $derived(
		MINERS.map((_, j) => {
			let best = run.tree[0];
			for (const b of found)
				if (
					b.heard[j] <= sim &&
					(b.height > best.height || (b.height === best.height && b.heard[j] < best.heard[j]))
				)
					best = b;
			return best.id;
		})
	);
	const mainTop = $derived(
		found.filter((b) => run.main.has(b.id)).reduce((m, b) => Math.max(m, b.height), 0)
	);
	const lane = $derived(forkLanes(run.tree, run.main));
	const orphaned = (id: number, height: number) => !run.main.has(id) && mainTop >= height + 2;
	const shownStale = $derived(found.filter((b) => b.id > 0 && orphaned(b.id, b.height)).length);

	// ---- geometry -------------------------------------------------------------------------------
	const MX = (j: number) => 150 + j * 165;
	const MY = 128;
	const TREE = { x: 70, y: 430, col: 58, lane: 62, w: 40, h: 30 };
	const WINDOW = 14;
	/** Horizontal scroll: keeps the newest blocks in view, easing as each new height appears. */
	const scroll = $derived.by(() => {
		const newest = found.filter((b) => b.height === top);
		const at = newest.length ? Math.min(...newest.map((b) => b.t)) : 0;
		const h = top - 1 + easeInOut(clamp((sim - at) / (0.6 * RATE)));
		return Math.max(0, h - (WINDOW - 1));
	});
	const bx = (h: number) => TREE.x + (h - scroll) * TREE.col;
	const by = (id: number) => TREE.y - (lane.get(id) ?? 0) * TREE.lane;
	const mColor = (j: number) => `var(--cb-m${j})`;
	const pools = ['A', 'B', 'C', 'D', 'E'];
	const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)} %`;

	const news = $derived(
		found.flatMap((b) =>
			b.id === 0
				? []
				: b.heard.flatMap((h, j) =>
						j === b.miner || sim < b.t || sim > h + 0.4 * RATE
							? []
							: [
									{
										key: `${b.id}-${j}`,
										from: b.miner,
										to: j,
										u: clamp((sim - b.t) / Math.max(1, h - b.t)),
										done: sim >= h
									}
								]
					)
		)
	);
	/** News of a block travels from its finder to each other miner along an arc under the row. */
	function arc(a: number, b: number, u: number) {
		const x0 = MX(a);
		const x1 = MX(b);
		const dip = 14 + Math.abs(x1 - x0) * 0.07;
		return { x: x0 + (x1 - x0) * u, y: MY + 74 + dip * 4 * u * (1 - u) };
	}
	const simMin = $derived(Math.max(0, sim) / 60);
</script>

<g opacity={fade}>
	<Readout id="title" order={1} label="Network" value="5 miners · news takes {delay} s">
		<Label
			anchor="start"
			tabular
			x={24}
			y={36}
			text="Five miners; news of a block takes {delay} s to reach the others"
			size={16}
			weight={700}
		/>
	</Readout>
	<Readout id="clock" order={2} label="Time" value="{simMin.toFixed(0)} min · {top} blocks">
		<Label
			anchor="start"
			tabular
			x={24}
			y={58}
			text="{simMin.toFixed(
				0
			)} minutes of mining (200 × faster than real) · one block every 10 min on average"
			size={12}
			muted
		/>
	</Readout>

	<!-- miners -->
	{#each MINERS as share, j (j)}
		{@const justFound = found.find((b) => b.miner === j && sim >= b.t && sim < b.t + 0.8 * RATE)}
		{#if justFound}
			{@const u = (sim - justFound.t) / (0.8 * RATE)}
			<circle
				cx={MX(j)}
				cy={MY}
				r={24 + u * 26}
				fill="none"
				stroke={mColor(j)}
				stroke-width="3"
				opacity={1 - u}
			/>
		{/if}
		<circle cx={MX(j)} cy={MY} r="24" fill={mColor(j)} />
		<text
			x={MX(j)}
			y={MY + 5}
			text-anchor="middle"
			style:font-size="14px"
			style:font-weight="700"
			style:fill="white">{pools[j]}</text
		>
		<Readout id="m-{j}">
			<Label
				tabular
				x={MX(j)}
				y={MY + 44}
				text="{pct(share)} of the power"
				size={11}
				anchor="middle"
				muted
			/>
			<Label
				tabular
				x={MX(j)}
				y={MY + 60}
				text={tips[j] === 0
					? 'mining on #0'
					: `mining on ${pools[run.tree[tips[j]].miner]}’s #${run.tree[tips[j]].height}`}
				size={11}
				anchor="middle"
				weight={600}
				color={mColor(j)}
			/>
		</Readout>
	{/each}
	{#each news as n (n.key)}
		{@const p = arc(n.from, n.to, n.u)}
		{#if !n.done}
			<circle cx={p.x} cy={p.y} r="5" fill={mColor(n.from)} />
		{/if}
	{/each}

	<!-- tree -->
	<Readout id="tree-title">
		<Label
			anchor="start"
			x={24}
			y={TREE.y - 3 * TREE.lane - 8}
			text="Blocks by height · lower row: the chain that wins · dots: who mines on which block"
			size={12}
			muted
		/>
	</Readout>
	<clipPath id="forks-clip">
		<rect
			x={TREE.x - 30}
			y={TREE.y - 3 * TREE.lane}
			width={WINDOW * TREE.col + 30}
			height={3 * TREE.lane + 60}
		/>
	</clipPath>
	<g clip-path="url(#forks-clip)">
		{#each found as b (b.id)}
			{#if b.id > 0}
				{@const p = run.tree[b.parent]}
				<path
					d="M{bx(p.height) + TREE.w / 2} {by(p.id)} C{bx(p.height) + TREE.col * 0.6} {by(
						p.id
					)}, {bx(b.height) - TREE.col * 0.4} {by(b.id)}, {bx(b.height) - TREE.w / 2} {by(b.id)}"
					fill="none"
					stroke="var(--stage-line)"
					stroke-width="1.5"
					opacity={orphaned(b.id, b.height) ? 0.4 : 1}
				/>
			{/if}
		{/each}
		{#each found as b (b.id)}
			{@const o = orphaned(b.id, b.height)}
			{@const appear = b.id === 0 ? 1 : smoothstep(b.t, b.t + 0.3 * RATE, sim)}
			<g opacity={(o ? 0.35 : 1) * appear}>
				<rect
					x={bx(b.height) - TREE.w / 2}
					y={by(b.id) - TREE.h / 2}
					width={TREE.w}
					height={TREE.h}
					rx="5"
					fill={b.miner < 0 ? 'var(--stage-ink-muted)' : mColor(b.miner)}
					stroke={o ? 'var(--cb-bad)' : 'none'}
					stroke-width="2"
					stroke-dasharray="4 3"
				/>
				<text
					x={bx(b.height)}
					y={by(b.id) + 5}
					text-anchor="middle"
					style:font-size="12px"
					style:font-weight="700"
					style:fill="white">{b.height}</text
				>
			</g>
			{#if o && lane.get(b.id) === 1 && !found.some((c) => c.height === b.height - 1 && lane.get(c.id) === 1)}
				<Readout id="orph-{b.id}">
					<Label
						x={bx(b.height)}
						y={by(b.id) - 22}
						text="orphaned"
						size={11}
						anchor="middle"
						color="var(--cb-bad)"
					/>
				</Readout>
			{/if}
		{/each}
		{#each found as b (b.id)}
			{@const miners = tips.flatMap((id, j) => (id === b.id ? [j] : []))}
			{#each miners as j, k (j)}
				<circle
					cx={bx(b.height) - (miners.length - 1) * 5 + k * 10}
					cy={by(b.id) + TREE.h / 2 + 9}
					r="4"
					fill={mColor(j)}
				/>
			{/each}
		{/each}
	</g>

	<!-- stats -->
	<Readout
		id="stats"
		order={3}
		label="Orphaned"
		value="{shownStale} of {Math.max(0, top)} so far · long run {pct(longRun)}"
	>
		<Label
			anchor="start"
			tabular
			x={24}
			y={560}
			text="Orphaned so far: {shownStale} · over 4,000 simulated blocks at this delay: {pct(
				longRun
			)}"
			size={13}
			weight={600}
		/>
	</Readout>
</g>
