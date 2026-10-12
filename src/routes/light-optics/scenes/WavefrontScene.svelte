<script lang="ts">
	/**
	 * Why light bends: the crests of a light wave crossing from air into a
	 * material of index `params.n`, arriving at `params.angle` from the normal.
	 *
	 * The phase of the wave is continuous across the boundary: in air
	 * φ = (p·d₁ − v₁t)/λ₁, inside φ = p·d₂/λ₂ − v₁t/λ₁ + C, with λ₂ = λ₁/n,
	 * v₂ = v₁/n and d₂ given by Snell's law (so the crests meet along the
	 * boundary). Crest k is the line φ = k on each side, so each crest is a
	 * broken line that swivels as it crosses. Every fifth crest is highlighted
	 * so that the eye can follow one. All a function of t.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { clamp } from '#lib/draw/index.ts';
	import { C, refractAngle, toRad, type Vec } from '../optics';
	import Card from './Card.svelte';
	import { fmt } from './ui';

	let { t, params }: StageProps = $props();

	const Y0 = 330; // the boundary
	const X0 = 16;
	const X1 = 944;
	const TOP = 16;
	const BOTTOM = 584;
	const LAMBDA = 54; // wavelength in air, stage units (drawn, not to scale)
	const V1 = 54; // crest speed in air, units per second (one wavelength a second)

	const n = $derived(clamp(Number(params.n ?? 1.52), 1, 2.42));
	const theta1 = $derived(clamp(Number(params.angle ?? 40), 0, 85));
	const theta2 = $derived(refractAngle(1, n, theta1) ?? 0);
	const d1 = $derived({ x: Math.sin(toRad(theta1)), y: Math.cos(toRad(theta1)) });
	const d2 = $derived({ x: Math.sin(toRad(theta2)), y: Math.cos(toRad(theta2)) });
	const lam2 = $derived(LAMBDA / n);
	// The phase offset that makes the crests meet on the boundary (y = Y0).
	const cOff = $derived((Y0 * d1.y) / LAMBDA - (Y0 * d2.y) / lam2);

	/** The part of the line {p : p·d = s} inside the box, or null. */
	function clip(
		d: Vec,
		s: number,
		x0: number,
		y0: number,
		x1: number,
		y1: number
	): [Vec, Vec] | null {
		// A point on the line and its direction.
		const p = { x: d.x * s, y: d.y * s };
		const u = { x: -d.y, y: d.x };
		let lo = -1e5;
		let hi = 1e5;
		for (const [pc, uc, a, b] of [
			[p.x, u.x, x0, x1],
			[p.y, u.y, y0, y1]
		]) {
			if (Math.abs(uc) < 1e-9) {
				if (pc < a || pc > b) return null;
				continue;
			}
			let ta = (a - pc) / uc;
			let tb = (b - pc) / uc;
			if (ta > tb) [ta, tb] = [tb, ta];
			lo = Math.max(lo, ta);
			hi = Math.min(hi, tb);
		}
		if (lo >= hi) return null;
		return [
			{ x: p.x + u.x * lo, y: p.y + u.y * lo },
			{ x: p.x + u.x * hi, y: p.y + u.y * hi }
		];
	}

	/** Range of p·d over the box corners. */
	function span(d: Vec, y0: number, y1: number) {
		const v = [X0 * d.x + y0 * d.y, X1 * d.x + y0 * d.y, X0 * d.x + y1 * d.y, X1 * d.x + y1 * d.y];
		return [Math.min(...v), Math.max(...v)];
	}

	interface Crest {
		k: number;
		a: Vec;
		b: Vec;
		hot: boolean;
	}
	const crests = $derived.by(() => {
		const out: Crest[] = [];
		const shift = (V1 * t) / LAMBDA; // phase advance, in wavelengths
		// Air: p·d₁ = (k + shift)·λ.
		const [a0, a1] = span(d1, TOP, Y0);
		for (
			let k = Math.floor(a0 / LAMBDA - shift) - 1;
			k <= Math.ceil(a1 / LAMBDA - shift) + 1;
			k++
		) {
			const seg = clip(d1, (k + shift) * LAMBDA, X0, TOP, X1, Y0);
			if (seg) out.push({ k: k * 2, a: seg[0], b: seg[1], hot: ((k % 5) + 5) % 5 === 0 });
		}
		// Inside: p·d₂ = (k + shift − C)·λ₂, the same k meeting the same crest at the boundary.
		const [b0, b1] = span(d2, Y0, BOTTOM);
		for (
			let k = Math.floor(b0 / lam2 - shift + cOff) - 1;
			k <= Math.ceil(b1 / lam2 - shift + cOff) + 1;
			k++
		) {
			const seg = clip(d2, (k + shift - cOff) * lam2, X0, Y0, X1, BOTTOM);
			if (seg) out.push({ k: k * 2 + 1, a: seg[0], b: seg[1], hot: ((k % 5) + 5) % 5 === 0 });
		}
		return out;
	});

	// The ray through the middle of the boundary.
	const O = { x: 480, y: Y0 };
	const rayIn = $derived({ x: O.x - d1.x * 250, y: O.y - d1.y * 250 });
	const rayOut = $derived({ x: O.x + d2.x * 220, y: O.y + d2.y * 220 });
	const speed = (nn: number) => Math.round(C / nn / 1000).toLocaleString('en-US');
	const name = $derived(
		(
			[
				[1, 'more air'],
				[1.33, 'water'],
				[1.46, 'fused silica'],
				[1.52, 'crown glass'],
				[1.78, 'flint glass'],
				[2.42, 'diamond']
			] as [number, string][]
		).find(([m]) => Math.abs(m - n) < 0.005)?.[1] ?? 'a material'
	);
	const glassOpacity = $derived(clamp((n - 1) / 0.4, 0, 1));
</script>

{#snippet label(
	x: number,
	y: number,
	s: string,
	o: {
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		muted?: boolean;
		color?: string;
		weight?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={o.muted}
		text-anchor={o.anchor ?? 'middle'}
		style:font-size="{o.size ?? 13}px"
		style:fill={o.color}
		font-weight={o.weight ?? 500}>{s}</text
	>
{/snippet}

<g>
	<rect
		x={X0}
		y={Y0}
		width={X1 - X0}
		height={BOTTOM - Y0}
		rx="10"
		fill="var(--lo-glass)"
		opacity={glassOpacity}
	/>
	<line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="var(--lo-glass-edge)" stroke-width="1.5" />

	{#each crests as c (c.k)}
		<line
			x1={c.a.x}
			y1={c.a.y}
			x2={c.b.x}
			y2={c.b.y}
			stroke={c.hot ? 'var(--lo-theta1)' : 'var(--lo-crest)'}
			stroke-width={c.hot ? 3 : 1.6}
			opacity={c.hot ? 0.95 : 0.55}
			stroke-linecap="round"
		/>
	{/each}

	<!-- normal and the ray through the middle -->
	<line
		x1={O.x}
		y1={Y0 - 200}
		x2={O.x}
		y2={Y0 + 200}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.4"
		stroke-dasharray="6 5"
	/>
	<line
		x1={rayIn.x}
		y1={rayIn.y}
		x2={O.x}
		y2={O.y}
		stroke="var(--lo-ray)"
		stroke-width="3.5"
		stroke-linecap="round"
	/>
	<line
		x1={O.x}
		y1={O.y}
		x2={rayOut.x}
		y2={rayOut.y}
		stroke="var(--lo-ray)"
		stroke-width="3.5"
		stroke-linecap="round"
	/>
	<path
		d="M{rayOut.x} {rayOut.y} l{-d2.x * 16 - d2.y * 8} {-d2.y * 16 + d2.x * 8} l{d2.y * 16} {-d2.x *
			16} Z"
		fill="var(--lo-ray)"
	/>
	{#if theta1 > 0.5}
		{@render label(O.x - 36, Y0 - 112, `${fmt(theta1, 0)}°`, {
			color: 'var(--lo-theta1)',
			weight: 700,
			size: 15,
			anchor: 'end'
		})}
		{@render label(O.x + 14, Y0 + 124, `${fmt(theta2, 1)}°`, {
			color: 'var(--lo-theta2)',
			weight: 700,
			size: 15,
			anchor: 'start'
		})}
	{/if}

	<!-- the two media -->
	<rect
		x="28"
		y="28"
		width="292"
		height="58"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render label(44, 52, 'Air: n = 1.00', { anchor: 'start', size: 15, weight: 700 })}
	{@render label(44, 74, 'light at 299,792 km/s · wavelength λ', {
		anchor: 'start',
		muted: true,
		size: 12
	})}
	<rect
		x="28"
		y={BOTTOM - 74}
		width="340"
		height="58"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render label(44, BOTTOM - 50, `${name[0].toUpperCase()}${name.slice(1)}: n = ${fmt(n, 2)}`, {
		anchor: 'start',
		size: 15,
		weight: 700
	})}
	{@render label(44, BOTTOM - 28, `light at ${speed(n)} km/s · wavelength λ ÷ ${fmt(n, 2)}`, {
		anchor: 'start',
		muted: true,
		size: 12
	})}

	<Card
		x={640}
		y={28}
		w={292}
		h={78}
		cells={[
			{ id: 'v', label: 'Speed inside', value: `${fmt(100 / n, 0)}%`, sub: 'of the speed in air' },
			{ id: 'f', label: 'Frequency', value: 'the same', sub: 'so the colour stays' }
		]}
	/>
</g>
