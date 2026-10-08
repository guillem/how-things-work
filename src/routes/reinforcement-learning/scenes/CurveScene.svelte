<script lang="ts">
	/**
	 * The learning curve: how many moves each of the 300 episodes took (one
	 * training run, the same `train` as the grid scene), with two episodes picked
	 * on it — an early one and a late one — replayed side by side on small maps.
	 *
	 * The picks live in `params.early` / `params.late` (1-based episode numbers),
	 * set by dragging the two handles under the chart (or their arrow keys).
	 * The curve is drawn in over the first seconds of the step; each small map's
	 * agent walks its episode's path on a loop, a pure function of t.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { PENALTY, REWARD, SMALL, WALL, distances, train, type Cell } from '../qlearning';
	import { setup } from '../run';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const cfg = $derived(setup(step, params));
	const world = $derived(cfg.world);
	// Retrain only when the map or a setting changes, not on every scrub or pick.
	const runKey = $derived(cfg.key);
	const run = $derived.by(() => {
		void runKey;
		return untrack(() => train(cfg.world, cfg.settings));
	});
	const E = $derived(run.episodes.length);
	const lengths = $derived(run.episodes.map((e) => e.length));
	const shortest = $derived.by(() => {
		const d = distances(world);
		let best = Infinity;
		world.cells.forEach((c, i) => {
			if (c === REWARD) best = Math.min(best, d[i]);
		});
		return isFinite(best) ? best : null;
	});

	// ---- the chart ---------------------------------------------------------------------------
	const X0 = 112;
	const X1 = 900;
	const Y0 = 120;
	const Y1 = 318;
	const LO = 8;
	const HI = 400;
	const ex = (e: number) => X0 + ((X1 - X0) * (e + 0.5)) / E;
	const ly = (n: number) =>
		Y1 - ((Math.log(clamp(n, LO, HI)) - Math.log(LO)) / (Math.log(HI) - Math.log(LO))) * (Y1 - Y0);
	const TICKS = [10, 20, 50, 100, 200, 400];

	const reveal = $derived(reduced ? 1 : smoothstep(0, 4, t));
	const raw = $derived(
		lengths.map((n, e) => `${e ? 'L' : 'M'}${ex(e).toFixed(1)} ${ly(n).toFixed(1)}`).join('')
	);
	// A moving average over 10 episodes, to see the trend through the noise.
	const smooth = $derived.by(() => {
		let d = '';
		for (let e = 0; e < E; e++) {
			const from = Math.max(0, e - 9);
			let s = 0;
			for (let j = from; j <= e; j++) s += lengths[j];
			d += `${e ? 'L' : 'M'}${ex(e).toFixed(1)} ${ly(s / (e - from + 1)).toFixed(1)}`;
		}
		return d;
	});
	// Episodes that ended in a pit: a red tick each, under the chart.
	const pits = $derived(
		run.episodes
			.map((e, j) => (e.end === PENALTY ? `M${ex(j).toFixed(1)} ${Y1 + 6}v8` : ''))
			.join('')
	);

	// ---- the two picked episodes -----------------------------------------------------------------
	const early = $derived(clamp(Math.round(Number(params.early ?? 1)), 1, E));
	const late = $derived(clamp(Math.round(Number(params.late ?? E)), 1, E));
	const HY = Y1 + 32;
	const pick = (p: Point) => clamp(Math.floor(((p.x - X0) / (X1 - X0)) * E) + 1, 1, E);
	const nudge = (v: number, s: number | 'start' | 'end') =>
		s === 'start' ? 1 : s === 'end' ? E : clamp(v + s, 1, E);

	const CS = 28;
	const COLS = 10;
	const MY = 400;
	const panels = $derived(
		[
			{ id: 'early', e: early, x: 32 },
			{ id: 'late', e: late, x: 496 }
		].map((p) => {
			const ep = run.episodes[p.e - 1];
			const pts = [run.moves[ep.first].s];
			for (let j = ep.first; j < ep.first + ep.length; j++) {
				const n = run.moves[j].next;
				if (n !== pts[pts.length - 1]) pts.push(n);
			}
			const gx = p.x + 16;
			const at = (s: number) => ({
				x: gx + (s % COLS) * CS + CS / 2,
				y: MY + Math.floor(s / COLS) * CS + CS / 2
			});
			const d = pts.map((s, j) => `${j ? 'L' : 'M'}${at(s).x} ${at(s).y}`).join('');
			// The agent walks the path on a loop, about 15 squares a second, resting a moment at the end.
			const period = pts.length / 15 + 1.2;
			const u = reduced ? 1 : Math.min(1, cycle(t, period) * (period / (period - 1.2)));
			const pos = u * (pts.length - 1);
			const j = Math.min(pts.length - 2, Math.floor(pos));
			const f = pos - j;
			const a = at(pts[Math.max(0, j)]);
			const b = at(pts[Math.min(pts.length - 1, j + 1)]);
			const agent = pts.length > 1 ? { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f } : a;
			const end =
				ep.end === REWARD
					? 'reached the +10'
					: ep.end === SMALL
						? 'reached the +1'
						: ep.end === PENALTY
							? 'fell into a pit'
							: 'cut off after 400 moves';
			return { ...p, ep, d, gx, agent, end, at };
		})
	);
	const fill = (c: Cell) =>
		c === WALL
			? 'var(--rl-wall)'
			: c === REWARD
				? 'var(--rl-reward)'
				: c === SMALL
					? 'var(--rl-small)'
					: c === PENALTY
						? 'var(--rl-pit)'
						: 'var(--rl-floor)';
	const avg = (from: number, to: number) => {
		const xs = lengths.slice(from, to);
		return xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
	};
	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="curve-reveal">
			<rect x={X0 - 4} y={Y0 - 10} width={(X1 - X0 + 8) * reveal} height={Y1 - Y0 + 40} />
		</clipPath>
	</defs>
	<!-- readout card -->
	<rect
		x="16"
		y="16"
		width="928"
		height="76"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(36, 45, `Moves per episode, ${E} episodes`, 17, { weight: 600 })}
	{@render txt(924, 45, `random moves: ${pct(cfg.settings.epsilon)}`, 14, {
		anchor: 'end',
		weight: 600
	})}
	{@render txt(
		36,
		75,
		`First 10 episodes: ${avg(0, 10).toFixed(0)} moves on average · episodes 51–100: ${avg(50, 100).toFixed(1)} · last 100: ${avg(E - 100, E).toFixed(1)}`,
		14,
		{ muted: true }
	)}

	<!-- axes -->
	{#each TICKS as v (v)}
		<line x1={X0} x2={X1} y1={ly(v)} y2={ly(v)} stroke="var(--stage-grid)" />
		{@render txt(X0 - 10, ly(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
	{/each}
	{@render txt(X0 - 44, (Y0 + Y1) / 2, 'moves', 12, { anchor: 'end', muted: true })}
	<line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke="var(--stage-line)" />
	{#if shortest !== null}
		<line
			x1={X0}
			x2={X1}
			y1={ly(shortest)}
			y2={ly(shortest)}
			stroke="var(--stage-ink)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		{@render txt(X1 - 4, ly(shortest) + 16, `shortest possible: ${shortest}`, 12, {
			anchor: 'end',
			weight: 600
		})}
	{/if}

	<g clip-path="url(#curve-reveal)">
		<path d={raw} fill="none" stroke="var(--rl-agent)" stroke-width="1" opacity="0.45" />
		<path
			d={smooth}
			fill="none"
			stroke="var(--rl-agent)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<path d={pits} stroke="var(--rl-pit)" stroke-width="1.5" />
	</g>
	{@render txt(
		(X0 + X1) / 2,
		Y1 + 58,
		`episodes 1 to ${E} · thick line: average of 10 episodes · red ticks: ended in a pit`,
		11,
		{ anchor: 'middle', muted: true }
	)}

	<!-- the two picks -->
	{#each panels as p (p.id)}
		<line
			x1={ex(p.e - 1)}
			x2={ex(p.e - 1)}
			y1={Y0}
			y2={HY}
			stroke="var(--explainer-accent)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<circle cx={ex(p.e - 1)} cy={ly(p.ep.length)} r="4.5" fill="var(--explainer-accent)" />
	{/each}
	<Handle
		x={ex(early - 1)}
		y={HY}
		r={8}
		label="Early episode"
		value={early}
		min={1}
		max={E}
		valuetext="episode {early}"
		onmove={(p) => setParam('early', pick(p))}
		onkey={(s) => setParam('early', nudge(early, s))}
	/>
	<Handle
		x={ex(late - 1)}
		y={HY}
		r={8}
		label="Late episode"
		value={late}
		min={1}
		max={E}
		valuetext="episode {late}"
		onmove={(p) => setParam('late', pick(p))}
		onkey={(s) => setParam('late', nudge(late, s))}
	/>

	<!-- the two episodes, replayed -->
	{#each panels as p (p.id)}
		<rect
			x={p.x}
			y={MY - 16}
			width="432"
			height="200"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each world.cells as c, j (j)}
			<rect
				x={p.gx + (j % COLS) * CS}
				y={MY + Math.floor(j / COLS) * CS}
				width={CS}
				height={CS}
				style:fill={fill(c)}
				stroke="var(--stage-grid)"
			/>
		{/each}
		<path
			d={p.d}
			fill="none"
			stroke="var(--rl-agent)"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			opacity="0.45"
		/>
		<circle
			cx={p.at(world.start).x}
			cy={p.at(world.start).y}
			r="9"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-dasharray="3 2"
		/>
		<circle
			cx={p.agent.x}
			cy={p.agent.y}
			r="7"
			fill="var(--rl-agent)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{@render txt(p.gx + COLS * CS + 14, MY + 14, `Episode ${p.e}`, 16, { weight: 600 })}
		{@render txt(p.gx + COLS * CS + 14, MY + 40, `${p.ep.length} moves`, 14)}
		{@render txt(p.gx + COLS * CS + 14, MY + 62, p.end, 12, {
			color:
				p.ep.end === PENALTY ? 'var(--rl-bad)' : p.ep.end === REWARD ? 'var(--rl-good)' : undefined,
			weight: 600
		})}
		{@render txt(
			p.gx + COLS * CS + 14,
			MY + 150,
			p.id === 'early' ? 'drag the left' : 'drag the right',
			11,
			{
				muted: true
			}
		)}
		{@render txt(p.gx + COLS * CS + 14, MY + 166, 'handle to pick', 11, { muted: true })}
	{/each}
</g>
