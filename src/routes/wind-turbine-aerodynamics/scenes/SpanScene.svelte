<script lang="ts">
	/**
	 * Blade-element momentum along the NREL 5-MW blade at the chosen tip-speed ratio and pitch:
	 * the blade's planform (chord to scale, coloured by airfoil family), the angle of attack of
	 * each of its 17 elements against that section's stall angle, and the axial induction a with
	 * Betz's 1/3, the turbulent-wake threshold 0.4 and (with tip loss on) Prandtl's factor F.
	 *
	 * Motion: none needed; the drawing follows the controls (the dots ease to new values).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bem, stallAngle, TURBINE } from '../model';
	import { BLADE } from '../nrel5mw';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import { num } from './fmt';

	let { params, reduced }: StageProps = $props();

	const lambda = $derived(Number(params.lambda ?? 7.5));
	const pitch = $derived(Number(params.pitch ?? 0));
	const tipLoss = $derived(params.tipLoss !== false);
	const sol = $derived(bem(lambda, pitch, { tipLoss }));

	const sx = scale([0, 63], [90, 690]);
	const ya = scale([-10, 45], [335, 168]);
	const yi = scale([0, 1], [552, 392]);

	const alphas = Tween.of(() => sol.elements.map((e) => e.alpha), {
		duration: () => (reduced ? 0 : 350),
		easing: cubicOut
	});
	const inds = Tween.of(() => sol.elements.map((e) => e.a), {
		duration: () => (reduced ? 0 : 350),
		easing: cubicOut
	});
	const clampA = (v: number) => Math.max(-10, Math.min(45, v));
	const stalls = BLADE.map((n) => stallAngle(n.af));
	/** Elements whose section has a stall angle (not the cylinders, nor the DU40). */
	const nStallable = stalls.filter((s) => Number.isFinite(s)).length;

	// ---------------------------------------------------------------- planform
	const PY = 70;
	const CK = 9.5;
	const FAMILY = (af: number) => (af <= 1 ? 0.35 : af <= 6 ? 0.7 : 1);
	const segments = BLADE.map((n) => ({
		x0: sx(n.r - n.dr / 2),
		x1: sx(n.r + n.dr / 2),
		c: n.chord * CK,
		o: FAMILY(n.af),
		r: n.r
	}));
	const outline = (() => {
		const lead = BLADE.map((n) => `${sx(n.r).toFixed(1)} ${(PY - 0.3 * n.chord * CK).toFixed(1)}`);
		const trail = [...BLADE]
			.reverse()
			.map((n) => `${sx(n.r).toFixed(1)} ${(PY + 0.7 * n.chord * CK).toFixed(1)}`);
		return `M${sx(TURBINE.hubRadius).toFixed(1)} ${(PY - 0.3 * 3.54 * CK).toFixed(1)} L${lead.join(' L')} L${sx(63).toFixed(1)} ${PY} L${trail.join(' L')} L${sx(TURBINE.hubRadius).toFixed(1)} ${(PY + 0.7 * 3.54 * CK).toFixed(1)} Z`;
	})();

	const fPath = $derived(
		sol.elements
			.map((e, i) => `${i ? 'L' : 'M'}${sx(e.r).toFixed(1)} ${yi(e.F).toFixed(1)}`)
			.join(' ')
	);
	const aPath = $derived(
		inds.current
			.map(
				(v, i) => `${i ? 'L' : 'M'}${sx(BLADE[i].r).toFixed(1)} ${yi(Math.min(1, v)).toFixed(1)}`
			)
			.join(' ')
	);
	const alphaPath = $derived(
		alphas.current
			.map((v, i) => `${i ? 'L' : 'M'}${sx(BLADE[i].r).toFixed(1)} ${ya(clampA(v)).toFixed(1)}`)
			.join(' ')
	);
	const nStalled = $derived(
		sol.elements.filter((e, i) => Number.isFinite(stalls[i]) && e.alpha > stalls[i]).length
	);
	const nHigh = $derived(sol.elements.filter((e) => e.a > 0.4).length);
</script>

<g>
	<Readout id="title" order={0} label="Chart" value="Blade-element momentum along the blade">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={15}
			weight={700}
			text="Blade-element momentum, element by element"
		/>
	</Readout>

	<!-- planform -->
	{#each segments as s (s.r)}
		<line
			x1={s.x1}
			x2={s.x1}
			y1={PY - 0.3 * s.c}
			y2={PY + 0.7 * s.c}
			stroke="var(--stage-bg)"
			stroke-width="1"
		/>
	{/each}
	<path d={outline} fill="var(--wt-blade)" opacity="0.85" />
	{#each segments as s (s.r)}
		<line
			x1={s.x1}
			x2={s.x1}
			y1={PY - 0.3 * s.c - 1}
			y2={PY + 0.7 * s.c + 1}
			stroke="var(--stage-bg)"
			stroke-width="1"
		/>
	{/each}
	<Readout id="root">
		<Label x={sx(5.5)} y={PY + 50} text="cylinders" size={11} muted />
		<Label x={sx(26)} y={PY + 50} text="DU airfoils, 40% → 21% thick" size={11} muted />
		<Label x={sx(53)} y={PY + 38} text="NACA 64-618" size={11} muted />
	</Readout>

	<!-- angle of attack -->
	<Axes
		{sx}
		sy={ya}
		yTicks={[-10, 0, 10, 20, 30, 40]}
		xTicks={[]}
		yFormat={(v) => `${v}°`}
		yLabel="α"
	/>
	{#each BLADE as n, i (n.r)}
		{#if Number.isFinite(stalls[i])}
			<line
				x1={sx(n.r) - 9}
				x2={sx(n.r) + 9}
				y1={ya(stalls[i])}
				y2={ya(stalls[i])}
				stroke="var(--wt-stall)"
				stroke-width="2"
				opacity="0.7"
			/>
		{/if}
	{/each}
	<path d={alphaPath} fill="none" stroke="var(--wt-lift)" stroke-width="2" />
	{#each alphas.current as v, i (BLADE[i].r)}
		{@const st = Number.isFinite(stalls[i]) && sol.elements[i].alpha > stalls[i]}
		<circle
			cx={sx(BLADE[i].r)}
			cy={ya(clampA(v))}
			r="4.5"
			fill={st ? 'var(--wt-stall)' : 'var(--wt-lift)'}
			opacity={BLADE[i].af <= 1 ? 0.4 : 1}
		/>
	{/each}
	<Readout
		id="alpha-key"
		order={5}
		label="Angle of attack"
		value="dots; red dashes: each section's stall angle"
	>
		<Label
			x={sx(63)}
			y={ya(45) - 8}
			anchor="end"
			text="angle of attack · red dash: where that section stalls"
			size={11}
			muted
		/>
	</Readout>

	<!-- induction -->
	<Axes
		{sx}
		sy={yi}
		yTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
		xLabel="radius (m)"
		yFormat={(v: number) => num(v, 1)}
		yLabel="a"
	/>
	<rect
		x={sx(0)}
		y={yi(1)}
		width={sx(63) - sx(0)}
		height={yi(0.4) - yi(1)}
		fill="var(--wt-measured)"
		opacity="0.07"
	/>
	<line
		x1={sx(0)}
		x2={sx(63)}
		y1={yi(1 / 3)}
		y2={yi(1 / 3)}
		stroke="var(--wt-betz)"
		stroke-dasharray="5 4"
	/>
	<Readout id="third">
		<Label
			x={sx(1)}
			y={yi(1 / 3) + 14}
			anchor="start"
			text="a = 1/3 (Betz)"
			size={11}
			color="var(--wt-betz)"
		/>
		<Label
			x={sx(1)}
			y={yi(0.4) - 6}
			anchor="start"
			text="turbulent wake above 0.4"
			size={11}
			muted
		/>
	</Readout>
	{#if tipLoss}
		<path
			d={fPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<Readout id="f-key">
			<Label x={sx(63)} y={yi(1) + 14} anchor="end" text="tip-loss factor F" size={11} muted />
		</Readout>
	{/if}
	<path d={aPath} fill="none" stroke="var(--wt-air)" stroke-width="2.5" />
	{#each inds.current as v, i (BLADE[i].r)}
		<circle cx={sx(BLADE[i].r)} cy={yi(Math.min(1, v))} r="3.5" fill="var(--wt-air)" />
	{/each}

	<!-- readouts -->
	<Card x={720} y={150} w={220} h={200} />
	<Row
		id="lambda"
		order={1}
		x={736}
		y={180}
		w={188}
		label="Tip-speed ratio λ"
		value={lambda.toFixed(2)}
	/>
	<Row id="pitch" order={2} x={736} y={208} w={188} label="Pitch" value="{num(pitch, 1)}°" minor />
	<Row
		id="cp"
		order={3}
		x={736}
		y={236}
		w={188}
		label="Rotor CP"
		value={sol.cp.toFixed(3)}
		color="var(--wt-power)"
	/>
	<Row
		id="ct"
		order={4}
		x={736}
		y={264}
		w={188}
		label="Rotor CT"
		value={sol.ct.toFixed(3)}
		color="var(--wt-thrust)"
		minor
	/>
	<Row
		id="stalled"
		order={6}
		x={736}
		y={292}
		w={188}
		label="Elements stalled"
		value="{nStalled} of {nStallable}"
		color={nStalled ? 'var(--wt-stall)' : undefined}
	/>
	<Row
		id="high"
		order={7}
		x={736}
		y={320}
		w={188}
		label="Elements with a > 0.4"
		value="{nHigh} of 17"
		minor
	/>
	<Readout id="tip-note">
		<Label
			x={730}
			y={392}
			anchor="start"
			text={tipLoss ? 'tip loss on: three blades' : 'tip loss off: as if'}
			size={11}
			muted
		/>
		<Label
			x={730}
			y={407}
			anchor="start"
			text={tipLoss ? 'leak air round their tips' : 'infinitely many blades'}
			size={11}
			muted
		/>
	</Readout>
</g>
