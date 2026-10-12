<script lang="ts">
	/**
	 * The Earth's orbit round the Sun, and round a black hole of the same mass
	 * (`params.squeeze`). The orbit, the period and the pull on the Earth do not
	 * change: outside a round mass, gravity depends only on the mass (Birkhoff's
	 * theorem). One year takes 8 s here; the Earth's angle is a pure function
	 * of t. The squeeze is tweened (the Sun shrinks to a dot).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		ARCSEC,
		AU,
		C,
		EARTH_ORBIT,
		GM_SUN,
		R_SUN,
		perihelionAdvance,
		schwarzschildRadius
	} from '../blackhole';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const PX0 = 16;
	const PY0 = 16;
	const PX1 = 640;
	const PY1 = 584;
	const CX = 660;
	const CW = 284;
	const SX = 328;
	const SY = 300;
	const ORBIT = 220; // px for 1 AU
	const YEAR_S = 8; // seconds of animation per year

	const squeeze = $derived(Boolean(params.squeeze));
	const k = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const v = squeeze ? 1 : 0;
		untrack(() => k.set(v, { duration: reduced ? 0 : 900 }));
	});

	// Real numbers for the readouts.
	const rs = schwarzschildRadius(GM_SUN); // m
	const vOrbit = Math.sqrt(GM_SUN / AU) / 1000; // km/s, circular at 1 AU
	// Extra turn of the Earth's perihelion from general relativity: per orbit
	// × 100 orbits a century (the anomalistic year is 365.26 days).
	const m = GM_SUN / (C * C);
	const earthTurn = (perihelionAdvance(EARTH_ORBIT.a / m, EARTH_ORBIT.e) * 100) / ARCSEC;

	const ang = $derived(((reduced ? 2.5 : t) / YEAR_S) * 2 * Math.PI);
	const earth = $derived({ X: SX + ORBIT * Math.cos(ang), Y: SY - ORBIT * Math.sin(ang) });
	const pull = $derived.by(() => {
		const dx = SX - earth.X;
		const dy = SY - earth.Y;
		const d = Math.hypot(dx, dy);
		const L = 56;
		const ux = dx / d;
		const uy = dy / d;
		const X1 = earth.X + ux * L;
		const Y1 = earth.Y + uy * L;
		return {
			X1,
			Y1,
			head: `${X1 + ux * 8},${Y1 + uy * 8} ${X1 - uy * 5},${Y1 + ux * 5} ${X1 + uy * 5},${Y1 - ux * 5}`,
			LX: earth.X + ux * (L + 30),
			LY: earth.Y + uy * (L + 30) + 4
		};
	});
	const sunR = $derived(26 * (1 - k.current) + 4 * k.current);
	const fmtKm = (km: number) => Math.round(km).toLocaleString('en').replace(/,/g, ' ');
</script>

{#snippet row(y: number, label: string, value: string, color?: string)}
	<T x={CX + 16} {y} text={label} size={12.5} muted />
	<T x={CX + CW - 16} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
{/snippet}

<g>
	<defs>
		<radialGradient id="swap-glow">
			<stop offset="0" style:stop-color="var(--bh-star)" stop-opacity="0.7" />
			<stop offset="0.4" style:stop-color="var(--bh-star)" stop-opacity="0.25" />
			<stop offset="1" style:stop-color="var(--bh-star)" stop-opacity="0" />
		</radialGradient>
	</defs>
	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--bh-space)"
		stroke="var(--border)"
	/>

	<!-- the orbit -->
	<circle
		cx={SX}
		cy={SY}
		r={ORBIT}
		fill="none"
		stroke="var(--bh-newton)"
		stroke-width="1.2"
		stroke-dasharray="5 6"
		opacity="0.6"
	/>

	<!-- the Sun, or the black hole -->
	<g opacity={1 - k.current}>
		<circle cx={SX} cy={SY} r={sunR * 2.4} fill="url(#swap-glow)" />
		<circle cx={SX} cy={SY} r={sunR} fill="var(--bh-star)" />
	</g>
	<g opacity={k.current}>
		<circle
			cx={SX}
			cy={SY}
			r="26"
			fill="none"
			stroke="var(--bh-star)"
			stroke-dasharray="3 4"
			opacity="0.7"
		/>
		<circle cx={SX} cy={SY} r="4" fill="var(--bh-hole)" stroke="var(--bh-horizon)" />
	</g>

	<!-- gravity on the Earth -->
	<line
		x1={earth.X}
		y1={earth.Y}
		x2={pull.X1}
		y2={pull.Y1}
		stroke="var(--bh-star)"
		stroke-width="2.5"
	/>
	<polygon points={pull.head} fill="var(--bh-star)" />
	<circle
		cx={earth.X}
		cy={earth.Y}
		r="8"
		fill="var(--bh-probe)"
		stroke="var(--bh-space)"
		stroke-width="1.5"
	/>
	<T x={earth.X} y={earth.Y - 14} text="Earth" size={12} anchor="middle" weight={600} />
	<T x={pull.LX} y={pull.LY} text="gravity" size={11.5} anchor="middle" weight={600} />

	{#if k.current < 0.5}
		<T x={SX} y={SY + 50} text="the Sun (drawn 25× too big)" size={12} anchor="middle" muted />
	{:else}
		<T
			x={SX}
			y={SY + 44}
			text="a black hole of one solar mass"
			size={12}
			anchor="middle"
			weight={600}
		/>
		<T
			x={SX}
			y={SY + 62}
			text="dashed: where the Sun’s edge was (enlarged)"
			size={11.5}
			anchor="middle"
			muted
		/>
	{/if}
	<T x={SX} y={SY - ORBIT - 10} text="the Earth’s orbit: 1 AU" size={12} anchor="middle" muted />

	<!-- readouts -->
	<Card x={CX} y={PY0} w={CW} h={228} />
	<T
		x={CX + 16}
		y={PY0 + 28}
		text={squeeze ? 'Round a black hole' : 'Round the Sun'}
		size={15}
		weight={700}
	/>
	{@render row(PY0 + 60, 'Mass', '1 Sun')}
	{@render row(
		PY0 + 88,
		'Size',
		squeeze ? `${((2 * rs) / 1000).toFixed(1)} km across` : `${fmtKm((2 * R_SUN) / 1000)} km`
	)}
	{@render row(PY0 + 116, 'Earth’s distance', '1 AU (150 million km)')}
	{@render row(PY0 + 144, 'Earth’s speed', `${vOrbit.toFixed(1)} km/s`, 'var(--bh-probe)')}
	{@render row(PY0 + 172, 'Earth’s year', '365.25 days', 'var(--bh-probe)')}
	{@render row(PY0 + 200, 'Extra turn (relativity)', `${earthTurn.toFixed(1)}″ a century`)}

	<Card x={CX} y={PY0 + 244} w={CW} h={150} />
	<T x={CX + 16} y={PY0 + 270} text="Where they differ" size={13.5} weight={700} />
	<T x={CX + 16} y={PY0 + 292} text="Only close in. Anywhere outside the" size={12.5} />
	<T
		x={CX + 16}
		y={PY0 + 312}
		text={`Sun’s surface (${fmtKm(R_SUN / 1000)} km), both pull`}
		size={12.5}
	/>
	<T x={CX + 16} y={PY0 + 332} text="the same. Below that, the Sun’s pull" size={12.5} />
	<T x={CX + 16} y={PY0 + 352} text="weakens; the black hole’s keeps growing," size={12.5} />
	<T
		x={CX + 16}
		y={PY0 + 372}
		text={`down to a horizon ${(rs / 1000).toFixed(1)} km from its centre.`}
		size={12.5}
	/>

	<Card x={CX} y={PY1 - 96} w={CW} h={96} />
	<T x={CX + 16} y={PY1 - 68} text="A black hole doesn’t suck." size={13.5} weight={700} />
	<T x={CX + 16} y={PY1 - 46} text="From far away it is just a mass," size={12.5} />
	<T x={CX + 16} y={PY1 - 26} text="orbited like any other." size={12.5} />
</g>
