<script lang="ts">
	/**
	 * Why planets are hard to see (step glare). Left: a Sun-like star's glare with
	 * an Earth on its orbit, lost in it. Right: on a scale of powers of ten, the
	 * star's light against the light the Earth and Jupiter catch (an upper bound
	 * on what they reflect, (R / 2a)²) and against the dips they make when they
	 * transit, (R / R★)². The bars grow in one after another (pure function of t).
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		A_JUPITER,
		JUPITER_MASSES,
		JUPITER_RADII,
		SUN,
		interceptedFraction,
		transitDepth,
		type Planet
	} from '../exoplanets';
	import Card from './Card.svelte';
	import T from './T.svelte';
	import { sci } from './ui';

	let { t, reduced }: StageProps = $props();

	const earth: Planet = { radius: 1, mass: 1, a: 1, incl: 90 };
	const jupiter: Planet = { radius: JUPITER_RADII, mass: JUPITER_MASSES, a: A_JUPITER, incl: 90 };

	const tt = $derived(reduced ? 10 : t);

	// ---- left: the glare ------------------------------------------------------------
	const GX = 243;
	const GY = 300;
	const ORB = 120;
	const ang = $derived(-0.6 + (reduced ? 0 : (2 * Math.PI * tt) / 16));
	const ex = $derived(GX + ORB * Math.cos(ang));
	const ey = $derived(GY + ORB * 0.35 * Math.sin(ang));

	// ---- right: the ladder of brightness ---------------------------------------------
	const BX0 = 526;
	const BX1 = 924;
	const E_MIN = -10; // 10⁻¹⁰ at the left
	const bx = (v: number) => BX0 + ((Math.log10(v) - E_MIN) / -E_MIN) * (BX1 - BX0);
	const ROWS = [
		{ id: 'star', label: 'The star’s own light', v: 1, color: 'var(--ex-star-g)', kind: 'light' },
		{
			id: 'jdip',
			label: 'Dip when Jupiter transits',
			v: transitDepth(SUN, jupiter),
			color: 'var(--ex-light)',
			kind: 'dip'
		},
		{
			id: 'edip',
			label: 'Dip when the Earth transits',
			v: transitDepth(SUN, earth),
			color: 'var(--ex-light)',
			kind: 'dip'
		},
		{
			id: 'jlight',
			label: 'Light Jupiter catches (it reflects less)',
			v: interceptedFraction(jupiter),
			color: 'var(--ex-planet)',
			kind: 'light'
		},
		{
			id: 'elight',
			label: 'Light the Earth catches',
			v: interceptedFraction(earth),
			color: 'var(--ex-planet)',
			kind: 'light'
		}
	] as const;
	const ratio = (Math.round(transitDepth(SUN, earth) / interceptedFraction(earth) / 10000) * 10000)
		.toLocaleString('en-US')
		.replace(/,/g, ' ');
	const rowY = (i: number) => 132 + i * 74;
	const grow = (i: number) => smoothstep(0.6 + i * 1.1, 1.6 + i * 1.1, tt);
	const DECADES = [-10, -8, -6, -4, -2, 0];
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)]))
			.join('');
</script>

<g>
	<defs>
		<radialGradient id="glare-glow">
			<stop offset="0" style:stop-color="var(--ex-star-g)" stop-opacity="1" />
			<stop offset="0.12" style:stop-color="var(--ex-star-g)" stop-opacity="0.85" />
			<stop offset="0.45" style:stop-color="var(--ex-star-g)" stop-opacity="0.3" />
			<stop offset="1" style:stop-color="var(--ex-star-g)" stop-opacity="0" />
		</radialGradient>
	</defs>
	<rect
		x={16}
		y={16}
		width={454}
		height={568}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<Readout id="g-title">
		<T x={32} y={42} text="A Sun and an Earth, from another star" size={14} weight={700} />
		<T x={32} y={60} text="a sketch, not to scale" size={11.5} muted />
	</Readout>
	<ellipse
		cx={GX}
		cy={GY}
		rx={ORB}
		ry={ORB * 0.35}
		fill="none"
		stroke="var(--ex-orbit)"
		stroke-dasharray="3 5"
		opacity="0.5"
	/>
	<circle cx={GX} cy={GY} r="190" fill="url(#glare-glow)" />
	<circle cx={ex} cy={ey} r="2.2" fill="var(--ex-planet)" opacity="0.8" />
	<T x={ex} y={ey - 10} text="Earth" size={11.5} anchor="middle" weight={600} />
	<Readout id="g-note">
		<T x={32} y={540} text="The planet sits inside the star’s glare, and" size={12.5} />
		<T x={32} y={560} text="sends us less than a billionth as much light." size={12.5} />
	</Readout>

	<!-- ---- ladder ---- -->
	<Card x={486} y={16} w={458} h={568} />
	<Readout id="l-title">
		<T x={502} y={42} text="How much light, as a share of the star’s" size={14} weight={700} />
		<T x={502} y={60} text="each mark is 100 times the one to its left" size={11.5} muted />
	</Readout>
	{#each DECADES as e (e)}
		<line x1={bx(10 ** e)} x2={bx(10 ** e)} y1={86} y2={500} stroke="var(--stage-grid)" />
		<text x={bx(10 ** e)} y={520} text-anchor="middle" font-size="11" class="muted">
			{e === 0 ? '1' : `10${sup(e)}`}
		</text>
	{/each}
	{#each ROWS as r, i (r.id)}
		{@const g = grow(i)}
		{@const w = (bx(r.v) - BX0) * g}
		<Readout
			id="row-{r.id}"
			order={i}
			label={r.label}
			value={r.v === 1 ? '1' : sci(r.v)}
			color={r.color}
			opacity={g}
		>
			<T x={BX0} y={rowY(i) - 12} text={r.label} size={12.5} weight={600} opacity={g} />
			<rect
				x={BX0}
				y={rowY(i)}
				width={Math.max(0, w)}
				height="20"
				rx="4"
				fill={r.color}
				opacity={r.kind === 'dip' ? 0.85 : 0.9}
			/>
			<T
				x={Math.min(BX1 - 4, BX0 + w + 8)}
				y={rowY(i) + 15}
				text={r.v === 1 ? '1' : sci(r.v)}
				size={12.5}
				weight={700}
				anchor={BX0 + w + 70 > BX1 ? 'end' : 'start'}
				opacity={g}
				color={BX0 + w + 70 > BX1 ? '#212529' : undefined}
			/>
		</Readout>
	{/each}
	<T
		x={502}
		y={552}
		<Readout id="m-ratio" order={9} label="So" value="the dip a transiting Earth makes is {ratio} times all the light it could send us">
		text="The dip a transiting Earth makes is {ratio} times"
		size={12.5}
		weight={600}
	/>
	<T x={502} y={572} text="bigger than all the light it could send us." size={12.5} weight={600} />
		</Readout>
</g>
