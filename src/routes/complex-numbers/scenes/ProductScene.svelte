<script lang="ts">
	/**
	 * Two draggable numbers z and w and their product zw.
	 *
	 * The picture of "lengths multiply, angles add":
	 *   - the triangle 0, 1, z (shaded in z's colour) and its image 0, w, zw
	 *     (shaded in the product's colour): multiplying by w turns it by w's
	 *     angle and scales it by w's length;
	 *   - a ghost of that triangle travels from one to the other, turning and
	 *     growing steadily (0, wˢ, z·wˢ for s going 0 → 1, a function of t;
	 *     hidden under reduced motion, where the dotted paths of 1 → w and
	 *     z → zw stay);
	 *   - an inner arc with w's angle, and an outer arc for the product's angle
	 *     made of z's angle followed by w's (a spiral, so sums past 360° show).
	 *
	 * z and w live in `params.zLen`, `zAng`, `wLen`, `wAng` (the sliders): the
	 * handles write them rounded to the slider steps (0.05 and 1°), so the
	 * readouts "1.40 × 1.25 = 1.75" and "20° + 45° = 65°" are exact.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { abs, c, fmt, fromPolar, mul, num, reduce, toDeg, type Complex } from '../complex';
	import PointHandle from './PointHandle.svelte';

	let { t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ------------------------------------------------------------------
	const CX = 292;
	const CY = 300;
	const U = 104; // one unit, in stage units
	const LIM = 2.6; // the drawn plane: −2.6 … 2.6 (the product is at most 1.6² = 2.56)
	const E = LIM * U;
	const sx = (re: number) => CX + re * U;
	const sy = (im: number) => CY - im * U;
	const S = (z: Complex) => ({ x: sx(z.re), y: sy(z.im) });
	const PX = 612; // readout panel

	const MIN_LEN = 0.2;
	const MAX_LEN = 1.6;
	const roundLen = (v: number) => clamp(Math.round(v * 20) / 20, MIN_LEN, MAX_LEN);
	const roundAng = (v: number) => clamp(Math.round(v), 0, 360);

	// ---- the numbers -------------------------------------------------------------------
	const zLen = $derived(roundLen(Number(params.zLen ?? 1.4)));
	const zAng = $derived(roundAng(Number(params.zAng ?? 20)));
	const wLen = $derived(roundLen(Number(params.wLen ?? 1.25)));
	const wAng = $derived(roundAng(Number(params.wAng ?? 45)));
	const z = $derived(fromPolar(zLen, zAng));
	const w = $derived(fromPolar(wLen, wAng));
	const zw = $derived(mul(z, w)); // the model's product, from the a + bi rule
	const Z = $derived(S(z));
	const W = $derived(S(w));
	const ZW = $derived(S(zw));
	const sum = $derived(zAng + wAng);

	function polarOf(p: Point) {
		const re = (p.x - CX) / U;
		const im = (CY - p.y) / U;
		return { len: roundLen(Math.hypot(re, im)), ang: roundAng(reduce(toDeg(Math.atan2(im, re)))) };
	}
	const wrap = (a: number) => (a > 360 ? a - 360 : a < 0 ? a + 360 : a);
	function mover(name: 'z' | 'w') {
		return {
			onmove(p: Point) {
				const q = polarOf(p);
				// Crossing the 0° seam from above lands on 360°, not 0°.
				const prev = name === 'z' ? zAng : wAng;
				setParam(`${name}Len`, q.len);
				setParam(`${name}Ang`, q.ang === 0 && prev > 180 ? 360 : q.ang);
			},
			// ← → turn by 1° (5° with Shift), ↑ ↓ stretch by 0.05 (0.25).
			onkey(dx: number, dy: number) {
				const len = name === 'z' ? zLen : wLen;
				const ang = name === 'z' ? zAng : wAng;
				if (dx) setParam(`${name}Ang`, wrap(ang + dx));
				if (dy) setParam(`${name}Len`, roundLen(len + dy * 0.05));
			}
		};
	}
	const zMove = mover('z');
	const wMove = mover('w');

	// ---- drawing helpers -------------------------------------------------------------------
	/** w raised to a fractional power s, along the turning-and-growing path: |w|ˢ at angle s·φ_w. */
	const wPow = (s: number) => fromPolar(Math.pow(wLen, s), s * wAng);
	/** Dotted path of p·wˢ for s from 0 to 1. */
	function trail(p: Complex) {
		const pts: string[] = [];
		for (let k = 0; k <= 40; k++) {
			const q = S(mul(p, wPow(k / 40)));
			pts.push(`${k ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`);
		}
		return pts.join(' ');
	}
	/** A spiral arc from angle a0 to a1 (degrees), radius r0 growing 9 px per turn. */
	function spiral(r0: number, a0: number, a1: number) {
		if (a1 - a0 < 0.5) return '';
		const n = Math.max(2, Math.ceil((a1 - a0) / 4));
		const pts: string[] = [];
		for (let k = 0; k <= n; k++) {
			const a = a0 + ((a1 - a0) * k) / n;
			const r = r0 + (9 * a) / 360;
			const rad = (a * Math.PI) / 180;
			pts.push(
				`${k ? 'L' : 'M'}${(CX + r * Math.cos(rad)).toFixed(1)} ${(CY - r * Math.sin(rad)).toFixed(1)}`
			);
		}
		return pts.join(' ');
	}

	// The ghost triangle: 3 s out (turning and growing), a rest, then it starts again.
	const ghostS = $derived(smoothstep(0.6, 3.6, t % 6));
	const ghostOpacity = $derived(
		reduced ? 0 : smoothstep(0, 0.4, t % 6) * (1 - smoothstep(4.6, 5.6, t % 6))
	);
	const ghost = $derived.by(() => {
		const g = wPow(ghostS);
		return { a: S(g), b: S(mul(z, g)) };
	});

	// Inviting pulse on the handles at the start of the step.
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	// Labels of the points sit outside them, away from 0.
	const outside = (p: Complex, d = 22) => {
		const len = abs(p) || 1;
		return { x: sx(p.re) + (d * p.re) / len, y: sy(p.im) - (d * p.im) / len + 5 };
	};
	// Near the top or bottom edge the product's name goes beside it instead.
	const zwLabel = $derived.by(() => {
		const o = outside(zw, 24);
		if (o.y >= 34 && o.y <= 590) return o;
		return { x: ZW.x + (zw.re >= 0 ? 26 : -26), y: ZW.y + 6 };
	});

	const lenText = $derived(`${num(zLen)} × ${num(wLen)} = ${num(zLen * wLen)}`);
	const angText = $derived(`${zAng}° + ${wAng}° = ${sum}°`);
	const turnsNote = $derived(
		sum < 360
			? ''
			: sum === 720
				? 'two full turns: the same direction as 0°'
				: `${sum === 360 ? 'a full turn' : 'past a full turn'}: the same direction as ${sum - 360}°`
	);
	// "≈" only where the a + bi form had to be rounded.
	const approx = (v: Complex) =>
		[v.re, v.im].some((x) => Math.abs(x * 100 - Math.round(x * 100)) > 1e-6) ? '≈' : '=';
	const one = S(c(1));
	// Axis names fade out while a point or its label sits on them.
	const clearOf = (x: number, y: number) =>
		0.1 +
		0.9 * smoothstep(36, 56, Math.min(...[Z, W, ZW].map((p) => Math.hypot(p.x - x, p.y - y))));
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
		italic?: boolean;
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
		style:font-style={opts.italic ? 'italic' : undefined}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- grid, axes, unit circle -->
	{#each [-2, -1, 1, 2] as g (g)}
		<line x1={sx(g)} x2={sx(g)} y1={CY - E} y2={CY + E} stroke="var(--stage-grid)" />
		<line x1={CX - E} x2={CX + E} y1={sy(g)} y2={sy(g)} stroke="var(--stage-grid)" />
		{@render txt(sx(g), CY + 18, num(g, 0), 12, { anchor: 'middle', muted: true })}
		{@render txt(CX - 8, sy(g) + 4, g === 1 ? 'i' : g === -1 ? '−i' : `${num(g, 0)}i`, 12, {
			anchor: 'end',
			muted: true
		})}
	{/each}
	<line x1={CX - E} x2={CX + E} y1={CY} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={CX} x2={CX} y1={CY - E} y2={CY + E} stroke="var(--stage-line)" stroke-width="1.5" />
	{@render txt(CX + E, CY - 8, 'real', 12, {
		anchor: 'end',
		muted: true,
		opacity: clearOf(CX + E - 14, CY - 12)
	})}
	{@render txt(CX + 8, CY - E + 10, 'imaginary', 12, {
		muted: true,
		opacity: clearOf(CX + 34, CY - E + 6)
	})}
	<circle
		cx={CX}
		cy={CY}
		r={U}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 5"
		opacity="0.8"
	/>

	<!-- the triangle 0, 1, z and its image 0, w, zw -->
	<path
		d="M{CX} {CY} L{one.x} {one.y} L{Z.x} {Z.y} Z"
		fill="var(--cx-z)"
		fill-opacity="0.12"
		stroke="var(--cx-z)"
		stroke-opacity="0.5"
		stroke-linejoin="round"
	/>
	<path
		d="M{CX} {CY} L{W.x} {W.y} L{ZW.x} {ZW.y} Z"
		fill="var(--cx-prod)"
		fill-opacity="0.12"
		stroke="var(--cx-prod)"
		stroke-opacity="0.5"
		stroke-linejoin="round"
	/>

	<!-- the paths of 1 → w and z → zw under "turn by w's angle, stretch by w's length" -->
	<path
		d={trail(c(1))}
		fill="none"
		stroke="var(--cx-w)"
		stroke-width="1.5"
		stroke-dasharray="2 4"
	/>
	<path d={trail(z)} fill="none" stroke="var(--cx-w)" stroke-width="1.5" stroke-dasharray="2 4" />

	<!-- the ghost triangle on its way -->
	{#if ghostOpacity > 0.01}
		<path
			d="M{CX} {CY} L{ghost.a.x} {ghost.a.y} L{ghost.b.x} {ghost.b.y} Z"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.4"
			stroke-dasharray="5 4"
			stroke-linejoin="round"
			opacity={0.7 * ghostOpacity}
		/>
		<circle
			cx={ghost.b.x}
			cy={ghost.b.y}
			r="4"
			fill="var(--stage-ink)"
			opacity={0.7 * ghostOpacity}
		/>
	{/if}

	<!-- angle arcs: w's angle (inner); the product's = z's then w's (outer) -->
	<path d={spiral(30, 0, wAng)} fill="none" stroke="var(--cx-w)" stroke-width="2.4" />
	<path d={spiral(52, 0, zAng)} fill="none" stroke="var(--cx-z)" stroke-width="3" />
	<path d={spiral(52, zAng, sum)} fill="none" stroke="var(--cx-w)" stroke-width="3" />

	<!-- the three numbers as arrows from 0 -->
	{#each [{ id: 'z', p: Z, color: 'var(--cx-z)' }, { id: 'w', p: W, color: 'var(--cx-w)' }, { id: 'zw', p: ZW, color: 'var(--cx-prod)' }] as v (v.id)}
		<line
			x1={CX}
			y1={CY}
			x2={v.p.x}
			y2={v.p.y}
			stroke={v.color}
			stroke-width={v.id === 'zw' ? 3 : 2.4}
			stroke-linecap="round"
		/>
	{/each}
	<circle cx={CX} cy={CY} r="3.5" fill="var(--stage-ink)" />
	<circle cx={one.x} cy={one.y} r="4" fill="var(--stage-ink)" />

	<!-- the product -->
	<circle
		cx={ZW.x}
		cy={ZW.y}
		r="9"
		fill="var(--cx-prod)"
		stroke="var(--stage-bg)"
		stroke-width="2.5"
	/>
	{@render txt(zwLabel.x, zwLabel.y, 'zw', 17, {
		anchor: 'middle',
		weight: 700,
		italic: true,
		color: 'var(--cx-prod)'
	})}

	<!-- the handles -->
	{#if pulse > 0.01}
		{#each [{ id: 'z', p: Z, color: 'var(--cx-z)' }, { id: 'w', p: W, color: 'var(--cx-w)' }] as h (h.id)}
			<circle
				cx={h.p.x}
				cy={h.p.y}
				r={16 + 10 * pulse}
				fill="none"
				stroke={h.color}
				stroke-width="2"
				opacity={0.5 * pulse}
			/>
		{/each}
	{/if}
	{#each [{ id: 'z', p: z, P: Z, len: zLen, ang: zAng, color: 'var(--cx-z)', m: zMove }, { id: 'w', p: w, P: W, len: wLen, ang: wAng, color: 'var(--cx-w)', m: wMove }] as h (h.id)}
		{@const o = outside(h.p, 20)}
		<PointHandle
			x={h.P.x}
			y={h.P.y}
			label="The point {h.id}"
			value={h.ang}
			valuetext="{h.id}: length {num(h.len)}, angle {h.ang} degrees"
			color={h.color}
			name={h.id}
			nameDx={o.x - h.P.x}
			nameDy={o.y - h.P.y}
			onmove={h.m.onmove}
			onkey={h.m.onkey}
		/>
	{/each}

	<!-- ================= readout panel ================= -->
	<g>
		{#each [{ id: 'z', v: z, len: zLen, ang: zAng, color: 'var(--cx-z)', y: 92 }, { id: 'w', v: w, len: wLen, ang: wAng, color: 'var(--cx-w)', y: 158 }, { id: 'zw', v: zw, len: zLen * wLen, ang: sum, color: 'var(--cx-prod)', y: 224 }] as row (row.id)}
			{@render txt(PX, row.y, `${row.id} ${approx(row.v)} ${fmt(row.v)}`, 19, {
				weight: 700,
				color: row.color
			})}
			{@render txt(PX, row.y + 22, `length ${num(row.len)}, angle ${row.ang}°`, 13, {
				muted: true
			})}
		{/each}

		<line x1={PX} x2={PX + 320} y1={278} y2={278} stroke="var(--border)" />
		{@render txt(PX, 312, 'lengths multiply', 13, { muted: true })}
		{@render txt(PX, 338, `|zw| = ${lenText}`, 18, { weight: 700 })}
		{@render txt(PX, 384, 'angles add', 13, { muted: true })}
		{@render txt(PX, 410, angText, 18, { weight: 700 })}
		{#if turnsNote}
			{@render txt(PX, 432, turnsNote, 12, { color: 'var(--explainer-accent)' })}
		{/if}

		<line x1={PX} x2={PX + 320} y1={458} y2={458} stroke="var(--border)" />
		{@render txt(PX, 490, `Multiplying by w turns by ${wAng}°`, 14, {
			weight: 600,
			color: 'var(--cx-w)'
		})}
		{@render txt(PX, 512, `and stretches by ${num(wLen)}:`, 14, {
			weight: 600,
			color: 'var(--cx-w)'
		})}
		{@render txt(PX, 536, 'triangle 0, 1, z  →  triangle 0, w, zw', 13, { muted: true })}
	</g>
</g>
