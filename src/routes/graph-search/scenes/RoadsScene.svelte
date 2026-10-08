<script lang="ts">
	/**
	 * From grids to roads: Dijkstra or A* (`params.roadAlgo`) on the REGION road
	 * map, from Ashford to Juniper.
	 *
	 * The search is replayed from `route()`'s `order`: one town is settled every
	 * STEP seconds (a pure function of t). A settled town is filled and labelled
	 * with its distance from Ashford; the road it was reached by is drawn
	 * thicker (the tree of shortest roads grows); towns found but not settled
	 * are ringed (the frontier). For A*, the straight-line estimate from the
	 * town just settled to Juniper is a dashed line with its length, and the
	 * readout adds them up. At the end the route is drawn in `--gs-path` with its
	 * length and both methods' town counts; then the replay loops.
	 *
	 * Every number shown comes from `route()` and the map; the estimate is
	 * rounded first, so the displayed sum always adds up.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { REGION, route } from '../search';

	let { t, params, reduced }: StageProps = $props();

	const FROM = 0;
	const TO = REGION.towns.length - 1;
	const towns = REGION.towns;
	const roads = REGION.roads;
	const algo = $derived(params.roadAlgo === 'astar' ? 'astar' : 'dijkstra');
	const NAME = { dijkstra: 'Dijkstra', astar: 'A*' } as const;
	const results = {
		dijkstra: route(REGION, FROM, TO, 'dijkstra'),
		astar: route(REGION, FROM, TO, 'astar')
	};
	const res = $derived(results[algo]);

	// ---- geometry: one scale for both axes, so straight lines are true to length -----
	const S = 1.95;
	const X = (x: number) => 480 + (x - 200) * S;
	const Y = (y: number) => 80 + (y - 30) * S;
	const P = towns.map((p) => ({ x: X(p.x), y: Y(p.y) }));
	const crow = (i: number) =>
		Math.round(Math.hypot(towns[i].x - towns[TO].x, towns[i].y - towns[TO].y));

	// Town labels: [dx, dy, anchor], hand-placed away from the roads.
	const LABEL: [number, number, 'start' | 'middle' | 'end'][] = [
		[-15, 5, 'end'], // Ashford
		[-12, -8, 'end'], // Brookley
		[0, 30, 'middle'], // Carwick
		[14, 22, 'start'], // Dunmore
		[0, -15, 'middle'], // Elmstead
		[0, 30, 'middle'], // Fenwick
		[17, 5, 'start'], // Glenholm
		[14, 24, 'start'], // Harrow End
		[17, 5, 'start'], // Ivybridge
		[24, 33, 'middle'] // Juniper
	];

	// ---- time ----------------------------------------------------------------------------
	const LEAD = 0.8;
	const STEP = 0.9;
	const tEnd = $derived(LEAD + (res.order.length - 1) * STEP);
	const period = $derived(tEnd + 6.5);
	const tt = $derived(reduced ? Infinity : ((t % period) + period) % period);
	const settledCount = $derived(
		Math.max(0, Math.min(res.order.length, Math.floor((tt - LEAD) / STEP) + 1))
	);
	const done = $derived(settledCount >= res.order.length);
	const routeIn = $derived(reduced ? 1 : smoothstep(tEnd + 0.4, tEnd + 1, tt));
	// The town just settled fades in.
	const fresh = $derived(reduced ? 1 : smoothstep(0, 0.3, tt - LEAD - (settledCount - 1) * STEP));

	const settledAt = $derived.by(() => {
		const at = new Array<number>(towns.length).fill(Infinity);
		res.order.slice(0, settledCount).forEach((v, i) => (at[v] = i));
		return at;
	});
	const current = $derived(settledCount > 0 ? res.order[settledCount - 1] : -1);

	// The road each settled town was reached by (its last link on a shortest route).
	const viaRoad = $derived(
		res.order.map((v) =>
			v === FROM
				? -1
				: roads.findIndex(
						(r) =>
							(r.a === v || r.b === v) &&
							res.dist[r.a === v ? r.b : r.a] + r.km === res.dist[v] &&
							res.order.indexOf(r.a === v ? r.b : r.a) < res.order.indexOf(v)
					)
		)
	);
	const tree = $derived(new Set(viaRoad.slice(0, settledCount).filter((r) => r >= 0)));
	const frontier = $derived.by(() => {
		const f: number[] = [];
		for (const r of roads) {
			const aIn = settledAt[r.a] < Infinity;
			const bIn = settledAt[r.b] < Infinity;
			if (aIn && !bIn) f.push(r.b);
			if (bIn && !aIn) f.push(r.a);
		}
		return new Set(f);
	});
	const routeRoads = $derived(
		new Set(
			res.path.slice(1).map((v, i) => {
				const u = res.path[i];
				return roads.findIndex((r) => (r.a === u && r.b === v) || (r.a === v && r.b === u));
			})
		)
	);
	const routeD = $derived(res.path.map((v, i) => `${i ? 'L' : 'M'}${P[v].x} ${P[v].y}`).join(''));

	// ---- words ------------------------------------------------------------------------------
	const plural = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'}`;
	const line1 = $derived.by(() => {
		if (done)
			return `Shortest route: ${res.path.map((v) => towns[v].name).join(' → ')} = ${res.km} km`;
		if (current < 0) return 'Start at Ashford. Which town is settled next?';
		const n = towns[current].name;
		const d = res.dist[current];
		if (current === FROM)
			return algo === 'astar'
				? `Ashford: 0 km so far + ${crow(FROM)} km straight to Juniper = ${crow(FROM)}`
				: 'Ashford: 0 km from Ashford';
		return algo === 'astar'
			? `${n}: ${d} km so far + ${crow(current)} km straight to Juniper = ${d + crow(current)}, the lowest total`
			: `${n}: ${d} km from Ashford, the nearest town not yet settled`;
	});
	const TAKEAWAY =
		'A route is a systematic exploration of a graph — and a good estimate lets the search skip part of it.';
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; data?: string } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		data-readout={opts.data}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet pill(x: number, y: number, text: string, size: number, color?: string)}
	{@const w = text.length * size * 0.58 + 10}
	<rect
		x={x - w / 2}
		y={y - size / 2 - 4}
		width={w}
		height={size + 8}
		rx={(size + 8) / 2}
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<text
		{x}
		y={y + size * 0.36}
		text-anchor="middle"
		class:muted={!color}
		style:font-size="{size}px"
		style:fill={color}>{text}</text
	>
{/snippet}

<g opacity={fadeIn}>
	<!-- header -->
	{@render txt(24, 36, 'Ashford → Juniper', 17, { weight: 600 })}
	{@render txt(
		936,
		36,
		algo === 'astar'
			? 'A*: km so far + straight line to Juniper'
			: "Dijkstra's algorithm: nearest first",
		14,
		{ anchor: 'end', muted: true }
	)}

	<!-- roads -->
	{#each roads as r, i (i)}
		<line
			x1={P[r.a].x}
			y1={P[r.a].y}
			x2={P[r.b].x}
			y2={P[r.b].y}
			stroke={tree.has(i) ? 'var(--gs-visited-far)' : 'var(--stage-line)'}
			stroke-width={tree.has(i) ? 4 : 2}
			stroke-linecap="round"
			opacity={tree.has(i) ? 0.75 : 0.8}
		/>
	{/each}

	<!-- the route -->
	{#if done}
		<g opacity={routeIn}>
			<path
				d={routeD}
				fill="none"
				stroke="var(--stage-bg)"
				stroke-width="10"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			<path
				d={routeD}
				fill="none"
				stroke="var(--gs-path)"
				stroke-width="5"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		</g>
	{/if}

	<!-- road lengths -->
	{#each roads as r, i (i)}
		{@render pill(
			(P[r.a].x + P[r.b].x) / 2,
			(P[r.a].y + P[r.b].y) / 2,
			`${r.km}`,
			11,
			done && routeRoads.has(i) && routeIn > 0.5 ? 'var(--gs-path)' : undefined
		)}
	{/each}

	<!-- A*: the straight-line estimate from the town just settled -->
	{#if algo === 'astar' && current >= 0 && current !== TO && !done}
		{@const a = P[current]}
		{@const b = P[TO]}
		<g opacity={fresh}>
			<line
				x1={a.x}
				y1={a.y}
				x2={b.x}
				y2={b.y}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
			/>
			<!-- the line's length, just above the goal (every estimate line ends there; on the
			     line itself it would cover towns and road lengths) -->
			{@render pill(b.x + 44, b.y - 39, `${crow(current)} km straight`, 12, 'var(--stage-ink)')}
		</g>
	{/if}

	<!-- towns -->
	{#each towns as town, i (town.name)}
		{@const p = P[i]}
		{@const settled = settledAt[i] < Infinity}
		{@const isNew = i === current && !done}
		{@const [dx, dy, anchor] = LABEL[i]}
		{#if frontier.has(i)}
			<circle cx={p.x} cy={p.y} r="13" fill="none" stroke="var(--gs-frontier)" stroke-width="3" />
		{/if}
		{#if isNew}
			<circle
				cx={p.x}
				cy={p.y}
				r="15"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				opacity={fresh}
			/>
		{/if}
		<circle
			cx={p.x}
			cy={p.y}
			r="8"
			fill={i === FROM ? 'var(--gs-start)' : i === TO ? 'var(--gs-goal)' : 'var(--stage-bg)'}
			stroke={i === FROM
				? 'var(--gs-start)'
				: i === TO
					? 'var(--gs-goal)'
					: 'var(--stage-ink-muted)'}
			stroke-width="2"
		/>
		{#if settled && i !== FROM && i !== TO}
			<circle cx={p.x} cy={p.y} r="8" fill="var(--gs-visited-far)" opacity={isNew ? fresh : 1} />
		{/if}
		<text
			x={p.x + dx}
			y={p.y + dy}
			class="halo"
			text-anchor={anchor}
			font-weight="600"
			style:font-size="13px"
			>{town.name}{#if settled}<tspan
					font-weight="500"
					opacity={isNew ? fresh : 1}
					style:fill="var(--gs-visited-far)"
				>
					{`\u00a0${res.dist[i]} km`}</tspan
				>{/if}</text
		>
	{/each}
	{@render txt(P[FROM].x, P[FROM].y - 16, 'start', 12, {
		anchor: 'middle',
		color: 'var(--gs-start)',
		weight: 600
	})}
	{@render txt(P[TO].x, P[TO].y - 16, 'goal', 12, {
		anchor: 'middle',
		color: 'var(--gs-goal)',
		weight: 600
	})}
	{#if done}
		<g opacity={routeIn}>
			{@render pill(592, 434, `${res.km} km`, 15, 'var(--gs-path)')}
		</g>
	{/if}

	<!-- readout -->
	<rect
		x={16}
		y={494}
		width={928}
		height={90}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(36, 519, line1, 15, {
		weight: 600,
		color: done ? 'var(--gs-path)' : undefined
	})}
	{#if done}
		{@render txt(36, 544, `${NAME[algo]} looked at ${plural(res.order.length, 'town')}`, 13, {
			weight: 600,
			data: 'looked'
		})}
		{@render txt(
			924,
			544,
			`towns looked at: ${results.dijkstra.order.length} (Dijkstra) / ${results.astar.order.length} (A*)`,
			13,
			{ anchor: 'end', muted: true, data: 'both' }
		)}
	{:else}
		{@render txt(36, 544, `${NAME[algo]}: ${settledCount} of ${towns.length} towns looked at`, 13, {
			muted: true
		})}
		{#if algo === 'astar'}
			{@render txt(924, 544, 'the estimate is never too high: no road beats a straight line', 13, {
				anchor: 'end',
				muted: true
			})}
		{/if}
	{/if}
	{@render txt(36, 569, TAKEAWAY, 13, { weight: done ? 600 : 500, muted: !done, data: 'takeaway' })}
</g>
