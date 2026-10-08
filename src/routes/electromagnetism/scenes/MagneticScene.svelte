<script lang="ts">
	/**
	 * Magnetic fields of currents, at 40 px per cm.
	 *
	 * Phases (`step.hints.phase`), cross-faded:
	 *   wire — seen from above: a straight wire through the page carrying
	 *          `params.wireCurrent` (A; + out of the page), a grid of compasses
	 *          lined up with the wire's field plus the Earth's 20 µT pointing
	 *          north (`compassField`), circles where the wire's field is 200,
	 *          100, 50 and 25 µT
	 *   coil — cut through its axis: a 200-turn coil (2 cm radius, 6 cm long)
	 *          carrying `params.coilCurrent`, or a 1.2 T bar magnet of the same
	 *          size (`params.source`), with field lines traced from the exact
	 *          loop formulas (lines per side ∝ current; the magnet, far
	 *          stronger, gets a fixed set)
	 *
	 * The compasses follow a tween of the current, so they swing round smoothly.
	 * Nothing moves with t: the field of a steady current is steady.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { EARTH_H, MU0, coilLoops, compassField, loopsField, magnetLoops, wireField } from '../em';
	import { axialLines, type Frame } from './trace';

	let { step, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'wire'));
	const ease = { duration: 700, easing: cubicInOut };

	// ---- cross-fade -----------------------------------------------------------------------
	const wireOn = new Tween(1, ease);
	$effect(() => {
		const v = phase === 'wire' ? 1 : 0;
		untrack(() => wireOn.set(v, { duration: reduced ? 0 : 700 }));
	});
	const wA = $derived(wireOn.current);

	// ---- wire ------------------------------------------------------------------------------
	const S = 4000; // px per metre
	const W = { x: 480, y: 330 };
	const CARD = { x: 16, y: 16, w: 520, h: 66 };
	const I = $derived(Number(params.wireCurrent ?? 5));
	const Itw = Tween.of(() => I, { duration: 600, easing: cubicInOut });
	const needles = $derived.by(() => {
		const out: { id: string; x: number; y: number; ang: number }[] = [];
		for (let x = 80; x <= 880; x += 80)
			for (let y = 90; y <= 570; y += 80) {
				if (x === W.x && y === W.y) continue;
				if (x < CARD.x + CARD.w + 20 && y < CARD.y + CARD.h + 20) continue;
				const b = compassField(Itw.current, (x - W.x) / S, -(y - W.y) / S);
				out.push({ id: `${x}-${y}`, x, y, ang: Math.atan2(-b.y, b.x) });
			}
		return out;
	});
	const circles = $derived(
		[200, 100, 50, 25]
			.map((uT) => ({ uT, r: ((MU0 * Math.abs(I)) / (2 * Math.PI * uT * 1e-6)) * S }))
			.filter((c) => c.r > 26 && c.r < 420)
	);
	/** A spot on the circle's upper right, as far as possible from any compass. */
	function labelSpot(r: number) {
		let best = { x: W.x + r, y: W.y, d: -1 };
		for (let a = 0.35; a <= 1.25; a += 0.05) {
			const x = W.x + r * Math.cos(a) + 4;
			const y = W.y - r * Math.sin(a) - 2;
			// distance from the label's middle (≈ 20 px right of its start) to the grid
			const gx = x + 20;
			const nx = Math.round(gx / 80) * 80;
			const ny = Math.round((y - 10) / 80) * 80 + 10;
			const d = Math.hypot(gx - nx, y - 4 - ny);
			if (d > best.d) best = { x, y, d };
		}
		return best;
	}
	const fmtB = (b: number) => {
		const u = Math.abs(b) * 1e6;
		if (u >= 1e5) return `${(u / 1e6).toFixed(2)} T`;
		return u >= 1000 ? `${(u / 1000).toFixed(2)} mT` : `${u.toFixed(u < 10 ? 1 : 0)} µT`;
	};

	// ---- coil / magnet ------------------------------------------------------------------------
	const C0 = { x: 480, y: 300 };
	const A = 0.02;
	const LEN = 0.06;
	const TURNS = 200;
	const frame: Frame = { cx: C0.x, cy: C0.y, scale: S, x0: 16, x1: 944, y0: 16, y1: 584 };
	const coilUnit = coilLoops({ a: A, length: LEN, z: 0, turns: TURNS, I: 1 }, 12);
	const magnetUnit = magnetLoops({ a: A, length: LEN, z: 0, Br: 1.2 }, 30);
	const Ic = $derived(Number(params.coilCurrent ?? 1));
	const isMagnet = $derived(String(params.source ?? 'coil') === 'magnet');
	const MAXLINES = 9;
	const count = $derived(isMagnet ? 8 : Math.round((MAXLINES * Math.abs(Ic)) / 3));
	const lines = $derived.by(() => {
		if (phase !== 'coil' && wA > 0.99) return [];
		if (count === 0) return [];
		return isMagnet
			? axialLines('magnet', magnetUnit, frame, A * 0.98, count)
			: axialLines('coil', coilUnit, frame, A * 0.92, count);
	});
	// +: field to the right (+z) inside; reversed for a reversed current.
	const sign = $derived(isMagnet ? 1 : Math.sign(Ic));
	const centreB = $derived(
		isMagnet ? loopsField(magnetUnit, 0, 0).z : loopsField(coilUnit, 0, 0).z * Ic
	);
	const paths = $derived(
		lines.map((l, i) => {
			const d = (mirror: boolean) =>
				'M' +
				l.points
					.map((p) => `${p.x.toFixed(1)} ${(mirror ? 2 * C0.y - p.y : p.y).toFixed(1)}`)
					.join('L') +
				(l.closed ? 'Z' : '');
			// Arrows: at the seed (inside) and where the line is furthest out.
			let far = 0;
			// (ignoring points at the edge of the frame, where an arrow would be cut off)
			l.points.forEach((p, k) => {
				const inside = p.y > 40 && p.x > 40 && p.x < 920;
				if (inside && (far === 0 || p.y < l.points[far].y)) far = k;
			});
			const arrowAt = (k: number) => {
				const a = l.points[Math.max(0, k - 1)];
				const b = l.points[Math.min(l.points.length - 1, k + 1)];
				return { x: l.points[k].x, y: l.points[k].y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
			};
			const seed = l.points.findIndex((p) => Math.abs(p.x - C0.x) < 2 && p.y < C0.y);
			return {
				id: i,
				up: d(false),
				down: d(true),
				arrows: [arrowAt(seed >= 0 ? seed : 0), arrowAt(far)]
			};
		})
	);
	const wireDots = Array.from({ length: 12 }, (_, i) => C0.x + (i / 11 - 0.5) * LEN * S);
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

{#snippet head(x: number, y: number, ang: number, size: number, color: string)}
	<path
		d="M{x + Math.cos(ang) * size} {y + Math.sin(ang) * size} L{x + Math.cos(ang + 2.5) * size} {y +
			Math.sin(ang + 2.5) * size} L{x + Math.cos(ang - 2.5) * size} {y +
			Math.sin(ang - 2.5) * size} Z"
		fill={color}
	/>
{/snippet}

{#snippet card(cells: { id: string; label: string; value: string; color?: string }[], w: number)}
	<g style:pointer-events="none">
		<rect
			x={CARD.x}
			y={CARD.y}
			width={w}
			height={CARD.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each cells as c, i (c.id)}
			{@const cw = w / cells.length}
			{@const x = CARD.x + 16 + i * cw}
			{#if i > 0}
				<line
					x1={CARD.x + i * cw}
					x2={CARD.x + i * cw}
					y1={CARD.y + 14}
					y2={CARD.y + CARD.h - 14}
					stroke="var(--border)"
				/>
			{/if}
			<text {x} y={CARD.y + 25} class="muted" style:font-size="12px">{c.label}</text>
			<text {x} y={CARD.y + 51} font-weight="700" style:font-size="19px" style:fill={c.color}
				>{c.value}</text
			>
		{/each}
	</g>
{/snippet}

<g>
	<!-- ============ the wire, from above ============ -->
	{#if wA > 0.01}
		<g opacity={wA}>
			{#each circles as c (c.uT)}
				<circle
					cx={W.x}
					cy={W.y}
					r={c.r}
					fill="none"
					stroke="var(--em-bfield)"
					stroke-width="1.4"
					opacity="0.7"
				/>
				<!-- direction: anticlockwise seen from above for a current out of the page -->
				{@render head(W.x + c.r, W.y, I > 0 ? -Math.PI / 2 : Math.PI / 2, 6, 'var(--em-bfield)')}
				{@render head(W.x - c.r, W.y, I > 0 ? Math.PI / 2 : -Math.PI / 2, 6, 'var(--em-bfield)')}
				{#if c.r > 60}
					{@const lp = labelSpot(c.r)}
					{@render txt(lp.x, lp.y, `${c.uT} µT`, 11, {
						anchor: 'start',
						color: 'var(--em-bfield)',
						weight: 600
					})}
				{/if}
			{/each}
			{#each needles as n (n.id)}
				<g transform="translate({n.x} {n.y}) rotate({(n.ang * 180) / Math.PI})">
					<circle r="17" fill="var(--surface)" stroke="var(--border)" />
					<path d="M0 -4 L15 0 L0 4 Z" fill="var(--em-north)" />
					<path d="M0 -4 L-15 0 L0 4 Z" fill="var(--em-needle)" />
					<circle r="2" fill="var(--stage-ink)" />
				</g>
			{/each}
			<!-- the wire -->
			<circle
				cx={W.x}
				cy={W.y}
				r="16"
				fill="var(--em-copper)"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			{#if I > 0}
				<circle cx={W.x} cy={W.y} r="4" fill="var(--stage-ink)" />
			{:else if I < 0}
				<path
					d="M{W.x - 7} {W.y - 7} L{W.x + 7} {W.y + 7} M{W.x + 7} {W.y - 7} L{W.x - 7} {W.y + 7}"
					stroke="var(--stage-ink)"
					stroke-width="2.5"
				/>
			{/if}
			{@render txt(
				W.x + 22,
				W.y + 34,
				I > 0 ? 'current out of the page' : I < 0 ? 'current into the page' : 'no current',
				12,
				{ weight: 600 }
			)}
			<!-- north -->
			<g transform="translate(905 {CARD.y + 12})">
				<line x1="0" x2="0" y1="36" y2="4" stroke="var(--stage-ink)" stroke-width="2" />
				{@render head(0, 2, -Math.PI / 2, 7, 'var(--stage-ink)')}
				{@render txt(0, 54, 'N', 13, { anchor: 'middle', weight: 700 })}
			</g>
			{@render card(
				[
					{ id: 'i', label: 'current', value: `${I.toFixed(1)} A`, color: 'var(--em-copper)' },
					{
						id: 'b',
						label: 'wire’s field 2 cm away',
						value: fmtB(wireField(I, 0.02)),
						color: 'var(--em-bfield)'
					},
					{ id: 'e', label: 'Earth’s field (north)', value: fmtB(EARTH_H) }
				],
				CARD.w
			)}
		</g>
	{/if}

	<!-- ============ the coil or magnet, cut through its axis ============ -->
	{#if wA < 0.99}
		<g opacity={1 - wA}>
			<line
				x1="40"
				x2="920"
				y1={C0.y}
				y2={C0.y}
				stroke="var(--stage-grid)"
				stroke-dasharray="6 6"
			/>
			{#if isMagnet}
				<rect
					x={C0.x - (LEN * S) / 2}
					y={C0.y - A * S}
					width={(LEN * S) / 2}
					height={2 * A * S}
					rx="6"
					fill="var(--em-south)"
					opacity="0.85"
				/>
				<rect
					x={C0.x}
					y={C0.y - A * S}
					width={(LEN * S) / 2}
					height={2 * A * S}
					rx="6"
					fill="var(--em-north)"
					opacity="0.85"
				/>
			{:else}
				<rect
					x={C0.x - (LEN * S) / 2}
					y={C0.y - A * S}
					width={LEN * S}
					height={2 * A * S}
					rx="6"
					fill="var(--em-copper)"
					opacity="0.12"
				/>
			{/if}
			{#each paths as p (p.id)}
				<path d={p.up} fill="none" stroke="var(--em-bfield)" stroke-width="1.5" />
				<path d={p.down} fill="none" stroke="var(--em-bfield)" stroke-width="1.5" />
				{#each p.arrows as a, k (k)}
					{@const ang = sign < 0 ? a.ang + Math.PI : a.ang}
					{@render head(a.x, a.y, ang, 6, 'var(--em-bfield)')}
					{@render head(a.x, 2 * C0.y - a.y, -ang, 6, 'var(--em-bfield)')}
				{/each}
			{/each}
			{#if !isMagnet}
				{#each wireDots as x, i (i)}
					{#each [-1, 1] as side (side)}
						{@const y = C0.y + side * A * S}
						<circle
							cx={x}
							cy={y}
							r="8"
							fill="var(--em-copper)"
							stroke="var(--stage-ink)"
							stroke-width="1"
						/>
						{#if Ic !== 0}
							{#if side < 0 === Ic > 0}
								<circle cx={x} cy={y} r="2.2" fill="var(--stage-ink)" />
							{:else}
								<path
									d="M{x - 3.5} {y - 3.5} L{x + 3.5} {y + 3.5} M{x + 3.5} {y - 3.5} L{x - 3.5} {y +
										3.5}"
									stroke="var(--stage-ink)"
									stroke-width="1.5"
								/>
							{/if}
						{/if}
					{/each}
				{/each}
			{/if}
			{#if isMagnet || Ic !== 0}
				{@const right = sign > 0 ? 'N' : 'S'}
				{@const left = sign > 0 ? 'S' : 'N'}
				{#each [{ x: C0.x - (LEN * S) / 2 - 26, p: left }, { x: C0.x + (LEN * S) / 2 + 26, p: right }] as pole (pole.x)}
					<text
						x={pole.x}
						y={C0.y + 7}
						class="halo"
						text-anchor="middle"
						font-weight="800"
						style:font-size="20px"
						style:fill={pole.p === 'N' ? 'var(--em-north)' : 'var(--em-south)'}>{pole.p}</text
					>
				{/each}
			{:else}
				{@render txt(C0.x, C0.y - A * S - 30, 'No current, no field', 15, {
					anchor: 'middle',
					muted: true
				})}
			{/if}
			{@render txt(
				C0.x,
				584,
				isMagnet ? 'a bar magnet, cut along its length' : 'a coil of wire, cut along its axis',
				12,
				{ anchor: 'middle', muted: true }
			)}
			{@render card(
				isMagnet
					? [
							{ id: 's', label: 'source', value: 'bar magnet', color: 'var(--em-north)' },
							{
								id: 'b',
								label: 'field in the middle',
								value: fmtB(centreB),
								color: 'var(--em-bfield)'
							}
						]
					: [
							{
								id: 'i',
								label: `current (${TURNS} turns)`,
								value: `${Ic.toFixed(1)} A`,
								color: 'var(--em-copper)'
							},
							{
								id: 'b',
								label: 'field in the middle',
								value: fmtB(centreB),
								color: 'var(--em-bfield)'
							}
						],
				360
			)}
		</g>
	{/if}
</g>
