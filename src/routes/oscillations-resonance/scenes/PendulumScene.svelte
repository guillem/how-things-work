<script lang="ts">
	/**
	 * Two pendulums of the same length but very different bobs (0.2 kg and 2 kg)
	 * swinging in step, drawn to scale against a 1 m ruler, with a live trace of
	 * the angle and the measured period compared with the small-swing formula.
	 *
	 * `params.length` (m) and `params.swing` (release angle, °). The swing is
	 * precomputed (`pendulumMotion`, full sin θ, 60 s) and replayed in real time
	 * from the release; a slider change or "Release again" restarts it (the
	 * clock memo of newtons-laws/TrackScene, the guide's sanctioned exception).
	 * The drawing scale shrinks for long pendulums and wide swings so that it
	 * fits; the ruler keeps it honest. Reduced motion: the complete 10 s trace.
	 */
	import { scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { measuredPeriod, pendulumMotion, pendulumPeriod } from '../oscillator';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import {
		COL_X,
		PLOT_X0,
		PLOT_X1,
		SAMPLE,
		crests,
		lastTwo,
		loopTime,
		valueAt,
		type Cell
	} from './osc';

	let { t, params, reduced }: StageProps = $props();

	const END = 60;
	const W = 10;
	const HOLD = 0.6;
	const PIV = 52; // y of the pivots
	const GAP = 26; // half the distance between the two pivots
	const MID = 300; // trace centre line
	const HALF = 144; // trace half-height (px)
	const BOBS = [
		{ id: 'light', dx: -GAP, r: 7, label: '0.2 kg' },
		{ id: 'heavy', dx: GAP, r: 15, label: '2 kg' }
	];

	const L = $derived(Math.max(0.05, Number(params.length ?? 1)));
	const a0 = $derived(Math.max(1, Math.min(90, Number(params.swing ?? 10))));
	const rad = (deg: number) => (deg * Math.PI) / 180;

	const theta = $derived(pendulumMotion(L, a0, END, 0, SAMPLE));
	const Tm = $derived(measuredPeriod(theta, SAMPLE));
	const T0 = $derived(pendulumPeriod(L));
	const diff = $derived(Tm / T0 - 1);
	const tops = $derived(crests(theta, 1));

	// ---- clock --------------------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${L}|${a0}|${params.release ?? 0}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const tau = $derived(reduced ? W : Math.max(0, since - HOLD));
	const angleAt = (s: number) => valueAt(theta, loopTime(s, END, Tm));
	const now = $derived(angleAt(tau));

	// ---- the drawing: px per metre, capped so that the swing fits ------------------
	const R = $derived(Math.min(300 * L, 390, 158 / Math.sin(rad(a0))));
	const S = $derived(R / L);
	const bob = (dx: number, a: number) => ({
		px: COL_X + dx,
		x: COL_X + dx + R * Math.sin(a),
		y: PIV + R * Math.cos(a)
	});
	const arcR = $derived(Math.min(52, R * 0.45));
	const arc = $derived.by(() => {
		const p = COL_X - GAP;
		const a = rad(a0);
		return `M${p} ${PIV + arcR} A${arcR} ${arcR} 0 0 0 ${p + arcR * Math.sin(a)} ${PIV + arcR * Math.cos(a)}`;
	});
	const arcLabel = $derived({ x: COL_X - GAP - 6, y: PIV + arcR + 14 });

	// ---- trace ------------------------------------------------------------------------
	const amax = $derived(a0 * 1.2);
	const ws = $derived(Math.max(0, tau - W));
	const sx = $derived(scale([ws, ws + W], [PLOT_X0, PLOT_X1]));
	const sy = $derived(scale([-amax, amax], [MID + HALF, MID - HALF]));
	const xTicks = $derived(
		Array.from({ length: 6 }, (_, i) => Math.ceil(ws / 2) * 2 + i * 2).filter((v) => v <= ws + W)
	);
	const deg = (a: number) => (a * 180) / Math.PI;
	const tracePath = $derived.by(() => {
		let d = '';
		const n = Math.max(1, Math.round((tau - ws) / SAMPLE));
		for (let i = 0; i <= n; i++) {
			const s = ws + ((tau - ws) * i) / n;
			d += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(deg(angleAt(s))).toFixed(1)}`;
		}
		return d;
	});
	const bracket = $derived.by(() => {
		const pair = lastTwo(tops, tau, END, Tm);
		if (!pair || pair[0] < ws) return null;
		const [c1, c2] = pair;
		const y = sy(deg(Math.max(angleAt(c1), angleAt(c2)))) - 12;
		const p = c2 - c1;
		return { x1: sx(c1), x2: sx(c2), y, text: `period ${p.toFixed(2)} s` };
	});

	// ---- readouts ---------------------------------------------------------------------
	const pct = $derived(diff * 100);
	const cells: Cell[] = $derived([
		{ id: 'L', label: 'length', value: `${L.toFixed(2)} m` },
		{
			id: 'Tm',
			label: 'period, measured',
			value: `${Tm.toFixed(2)} s`,
			sub: 'one full swing',
			color: 'var(--osc-trace)'
		},
		{ id: 'T0', label: 'small swings', value: `${T0.toFixed(2)} s`, sub: '2π·√(L/g)' },
		{
			id: 'd',
			label: 'difference',
			value: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`,
			sub: pct < 1 ? 'same rhythm' : 'slower'
		}
	]);
	const held = $derived(!reduced && since < HOLD);
	const ruler = $derived({ x: 40, y: 568, w: S });
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
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- support: a thin beam, so that a bob swung out level with it stays clear -->
	<line
		x1={COL_X - GAP - 16}
		x2={COL_X + GAP + 16}
		y1={PIV - 6}
		y2={PIV - 6}
		stroke="var(--stage-ink)"
		stroke-width="2.5"
		stroke-linecap="round"
	/>
	{#each BOBS as b (b.id)}
		<line
			x1={COL_X + b.dx}
			x2={COL_X + b.dx}
			y1={PIV - 6}
			y2={PIV}
			stroke="var(--stage-ink)"
			stroke-width="1.6"
		/>
	{/each}
	<line
		x1={COL_X}
		x2={COL_X}
		y1={16}
		y2={PIV - 6}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>

	<!-- vertical and the release angle -->
	<line
		x1={COL_X - GAP}
		x2={COL_X - GAP}
		y1={PIV}
		y2={PIV + R + 10}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 5"
		opacity="0.6"
	/>
	<path d={arc} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.3" />
	{@render txt(arcLabel.x, arcLabel.y, `${a0}°`, 12, { anchor: 'end', weight: 600 })}

	<!-- ghosts at the release point -->
	{#each BOBS as b (b.id)}
		{@const g = bob(b.dx, rad(a0))}
		<line
			x1={g.px}
			y1={PIV}
			x2={g.x}
			y2={g.y}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			opacity="0.5"
		/>
		<circle
			cx={g.x}
			cy={g.y}
			r={b.r}
			fill="none"
			stroke="var(--osc-mass)"
			stroke-dasharray="3 3"
			opacity="0.5"
		/>
	{/each}

	<!-- the two pendulums -->
	{#each BOBS as b (b.id)}
		{@const p = bob(b.dx, now)}
		<line x1={p.px} y1={PIV} x2={p.x} y2={p.y} stroke="var(--stage-ink)" stroke-width="1.6" />
		<circle cx={p.px} cy={PIV} r="3" fill="var(--stage-ink)" />
		<circle
			cx={p.x}
			cy={p.y}
			r={b.r}
			fill="var(--osc-mass)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		{@render txt(p.x, p.y + b.r + 15, b.label, 11, { anchor: 'middle', weight: 600 })}
	{/each}
	{#if held}
		{@render txt(COL_X, PIV + R + 52, 'hold… let go', 12, { anchor: 'middle', weight: 600 })}
	{/if}

	<!-- caption and ruler -->
	{@render txt(24, 532, 'Same length, bobs of 0.2 kg and 2 kg:', 12, { muted: true })}
	{@render txt(24, 547, 'they swing in step — the mass makes no difference.', 12, {
		muted: true
	})}
	<g stroke="var(--stage-ink)" stroke-width="1.5">
		<line x1={ruler.x} x2={ruler.x + ruler.w} y1={ruler.y} y2={ruler.y} />
		<line x1={ruler.x} x2={ruler.x} y1={ruler.y - 5} y2={ruler.y + 5} />
		<line x1={ruler.x + ruler.w} x2={ruler.x + ruler.w} y1={ruler.y - 5} y2={ruler.y + 5} />
	</g>
	{@render txt(ruler.x + ruler.w + 8, ruler.y + 4, '1 m, to scale', 11, { muted: true })}

	<!-- trace -->
	<Plot
		{sx}
		{sy}
		{xTicks}
		yTicks={[-a0, 0, a0]}
		xFormat={(v) => `${v} s`}
		yFormat={(v) => (v === 0 ? '0°' : `${v > 0 ? '' : '−'}${Math.abs(v)}°`)}
	/>
	{@render txt(PLOT_X0, MID - HALF - 14, 'angle of the swing (right is up)', 12, { muted: true })}
	<path
		d={tracePath}
		fill="none"
		stroke="var(--osc-trace)"
		stroke-width="2.5"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	<circle
		cx={sx(tau)}
		cy={sy(deg(now))}
		r="5"
		fill="var(--osc-trace)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	{#if bracket}
		<g stroke="var(--stage-ink)" stroke-width="1.3">
			<line x1={bracket.x1} x2={bracket.x2} y1={bracket.y} y2={bracket.y} />
			<line x1={bracket.x1} x2={bracket.x1} y1={bracket.y - 5} y2={bracket.y + 5} />
			<line x1={bracket.x2} x2={bracket.x2} y1={bracket.y - 5} y2={bracket.y + 5} />
		</g>
		{@render txt(
			Math.min(PLOT_X1 - 50, Math.max(PLOT_X0 + 50, (bracket.x1 + bracket.x2) / 2)),
			bracket.y - 8,
			bracket.text,
			12,
			{ anchor: 'middle', weight: 600 }
		)}
	{/if}
	{@render txt(PLOT_X1, MID + HALF + 36, 'a longer pendulum swings more slowly', 11, {
		anchor: 'end',
		muted: true
	})}

	<Card {cells} />
</g>
