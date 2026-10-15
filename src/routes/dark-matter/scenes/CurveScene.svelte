<script lang="ts">
	/**
	 * The rotation curve and its mass model (steps curve, visible, halo, others,
	 * hidden). Left: the measured speeds of a SPARC galaxy with error bars, and
	 * the model curves from `galaxies.ts` (gas, stars, all visible matter, the
	 * dark halo, the total), or, on `hidden`, the mass inside each radius
	 * (v²r/G). Right: the score of the fit (χ² per point), the masses, and a
	 * stacked bar of visible against dark mass inside the last measured point.
	 *
	 * On the halo steps the halo curve has a handle at the last measured radius:
	 * dragging it sets the halo mass (`ratio`), as the slider does. "Find the
	 * best halo" (`fitHalo`) runs `bestHalo` and writes its result back.
	 *
	 * Motion: the points appear outwards at the start of the step; a cursor then
	 * sweeps the radius (pingpong, SWEEP s each way) and the card reads the
	 * speeds under it. Reduced motion parks the cursor on the last point.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		Label,
		niceMax,
		pingpong,
		type Point,
		scale,
		smoothstep
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		G,
		RATIO_MAX,
		bestHalo,
		curve,
		fit,
		galaxy,
		haloMass,
		haloSpeed,
		keplerSpeed,
		visibleMass
	} from '../galaxies';
	import Card from './Card.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	type Phase = 'curve' | 'visible' | 'halo' | 'others' | 'hidden';
	const phase = $derived(String(step.hints?.phase ?? 'curve') as Phase);
	const withHalo = $derived(Boolean(step.hints?.halo));
	const massMode = $derived(Boolean(step.hints?.mass));
	const picks = $derived(phase === 'others' || phase === 'hidden');
	const g = $derived(galaxy(picks ? String(params.galaxy ?? 'NGC3198') : 'NGC3198'));

	const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
	const mlTarget = $derived(phase === 'curve' ? 0.5 : num(params.ml, 0.5));
	const ratioTarget = $derived(withHalo ? num(params.ratio, 0) : 0);
	const coreTarget = $derived(num(params.core, 4));

	// Smooth reactions to the sliders (instant while the halo handle is dragged).
	let dragging = $state(false);
	const tw = new Tween({ ml: 0.5, ratio: 0, core: 4 }, { duration: 500, easing: cubicInOut });
	$effect(() => {
		const v = { ml: mlTarget, ratio: ratioTarget, core: coreTarget };
		untrack(() => tw.set(v, { duration: reduced || dragging ? 0 : 500 }));
	});
	const ml = $derived(tw.current.ml);
	const halo = $derived(withHalo ? { ratio: tw.current.ratio, core: tw.current.core } : null);

	// "Find the best halo": only when the button count changes after mount.
	const fitCount = $derived(num(params.fitHalo, 0));
	let lastFit = untrack(() => fitCount);
	$effect(() => {
		const c = fitCount;
		untrack(() => {
			if (c === lastFit) return;
			lastFit = c;
			const best = bestHalo(g, mlTarget);
			setParam('ratio', Math.round(best.ratio * 10) / 10);
			setParam('core', Math.round(best.core * 10) / 10);
		});
	});

	// ---- the model ----------------------------------------------------------------
	const model = $derived(curve(g, ml, halo));
	const score = $derived(
		fit(g, mlTarget, withHalo ? { ratio: ratioTarget, core: coreTarget } : null)
	);
	const vm = $derived(visibleMass(g, ml));
	const last = $derived(g.points[g.points.length - 1]);
	const darkLast = $derived(halo ? haloMass(g, halo, ml, g.rLast) : 0);
	const keplerLast = $derived(keplerSpeed(vm.total, g.rLast));

	// ---- layout -------------------------------------------------------------------
	const X0 = 78;
	const X1 = 640;
	const Y0 = 90;
	const Y1 = 486;
	const CX = 664;
	const CW = 280;
	/** Rounds up to a multiple of a round step about a fifth of the value. */
	const niceUp = (v: number) => {
		const st = niceMax(v / 5);
		return Math.ceil(v / st - 1e-9) * st;
	};
	const xMax = $derived(niceUp(g.rLast * 1.04));
	const vMax = $derived(niceUp(Math.max(...g.points.map((p) => p.v + p.e)) * 1.18));
	const massOf = (v: number, r: number) => (Math.max(0, v) ** 2 * r) / G / 1e10;
	const mMax = $derived(niceUp(massOf(last.v + last.e, g.rLast) * 1.08));
	const sx = $derived(scale([0, xMax], [X0, X1]));
	const sy = $derived(scale([0, massMode ? mMax : vMax], [Y1, Y0]));

	const y = (v: number) => sy(Math.max(0, v));
	const path = (vals: { r: number; v: number }[]) =>
		vals.map((q, i) => `${i ? 'L' : 'M'}${sx(q.r).toFixed(1)} ${y(q.v).toFixed(1)}`).join('');
	const series = (f: (m: (typeof model)[number]) => number) => {
		const pts = [
			{ r: 0, v: 0 },
			...model.map((m) => ({ r: m.r, v: massMode ? massOf(f(m), m.r) : f(m) }))
		];
		return path(pts);
	};
	const haloPath = $derived.by(() => {
		if (!halo) return '';
		const pts = Array.from({ length: 81 }, (_, i) => {
			const r = (g.rLast * i) / 80;
			return { r, v: massMode ? haloMass(g, halo, ml, r) / 1e10 : haloSpeed(g, halo, ml, r) };
		});
		return path(pts);
	});
	const keplerPath = $derived.by(() => {
		// Starts where the curve enters the chart.
		const r0 = Math.max(0.2, (G * vm.total) / (vMax * vMax));
		const pts = Array.from({ length: 61 }, (_, i) => {
			const r = r0 + ((xMax - r0) * i) / 60;
			return { r, v: keplerSpeed(vm.total, r) };
		});
		return path(pts);
	});

	// ---- what is shown on which step ------------------------------------------------
	const show = $derived({
		kepler: phase === 'curve' || phase === 'visible',
		parts: phase !== 'curve',
		halo: withHalo
	});

	// ---- motion -------------------------------------------------------------------
	const SWEEP = 9;
	const tt = $derived(reduced ? 2.5 : t);
	const appear = (r: number) => (reduced ? 1 : smoothstep(0.15, 0.45, tt - (1.2 * r) / g.rLast));
	const curvesIn = $derived(reduced ? 1 : smoothstep(1.0, 1.8, tt));
	const cursorU = $derived(
		reduced ? 1 : smoothstep(1.6, 2.4, tt) * pingpong(Math.max(0, tt - 2.4) + SWEEP, 2 * SWEEP)
	);
	const cursorIdx = $derived(Math.round(cursorU * (g.points.length - 1)));
	const cur = $derived(g.points[cursorIdx]);
	const curM = $derived(model[cursorIdx]);
	const cursorOn = $derived(reduced || tt > 1.6);

	// ---- the halo handle ------------------------------------------------------------
	const handleV = $derived(halo ? haloSpeed(g, halo, ml, g.rLast) : 0);
	const ratioFromSpeed = (v: number) =>
		Math.min(RATIO_MAX, Math.max(0, (Math.max(0, v) ** 2 * g.rLast) / G / vm.total));
	function onHandle(p: Point) {
		const v = sy.invert(p.y);
		setParam('ratio', Math.round(ratioFromSpeed(v) * 10) / 10);
	}
	function onHandleKey(s: number | 'start' | 'end') {
		const r = s === 'start' ? 0 : s === 'end' ? RATIO_MAX : ratioTarget + s * 0.1;
		setParam('ratio', Math.round(Math.min(RATIO_MAX, Math.max(0, r)) * 10) / 10);
	}

	// ---- formatting -----------------------------------------------------------------
	const e10 = (m: number) => {
		const v = m / 1e10;
		return v < 0.1 ? v.toPrecision(2) : v < 1 ? v.toFixed(2) : v.toFixed(1);
	};
	const chiText = (c: number) => (c >= 100 ? c.toFixed(0) : c >= 10 ? c.toFixed(1) : c.toFixed(2));
	const verdict = $derived(
		score.reduced < 3
			? 'fits within the errors'
			: score.reduced < 20
				? 'close, not quite'
				: 'a poor fit'
	);
	const BAR_X = CX + 16;
	const BAR_W = CW - 32;
	const barTotal = $derived(vm.total + darkLast);
	const visW = $derived((BAR_W * vm.total) / Math.max(barTotal, 1));

	const LEGEND = $derived(
		[
			{ id: 'data', label: 'measured', color: 'var(--dm-data)', dot: true, on: true },
			{
				id: 'kep',
				label: massMode ? '' : 'Kepler, mass at the centre',
				color: 'var(--dm-kepler)',
				dash: true,
				on: show.kepler && !massMode
			},
			{ id: 'gas', label: 'gas', color: 'var(--dm-gas)', on: show.parts && !massMode },
			{ id: 'stars', label: 'stars', color: 'var(--dm-stars)', on: show.parts && !massMode },
			{ id: 'vis', label: 'visible matter', color: 'var(--dm-visible)', on: show.parts },
			{ id: 'halo', label: 'dark halo', color: 'var(--dm-halo)', on: show.halo },
			{ id: 'tot', label: 'total', color: 'var(--dm-model)', on: show.halo }
		].filter((l) => l.on)
	);
	const legendX = $derived.by(() => {
		let x = X0;
		return LEGEND.map((l) => {
			const at = x;
			x += 30 + l.label.length * 6.3 + 12;
			return at;
		});
	});
</script>

<g>
	<defs>
		<clipPath id="curve-clip">
			<rect x={X0 - 4} y={Y0 - 8} width={X1 - X0 + 12} height={Y1 - Y0 + 12} />
		</clipPath>
	</defs>
	<!-- ---- chart ---- -->
	<Readout
		id="c-title"
		order={1}
		label={g.name}
		value="{g.kind}, {Math.round(g.distance * 3.2616)} million light years away"
	>
		<Label
			anchor="start"
			x={24}
			y={34}
			text="{g.name}: {massMode ? 'mass inside each radius' : 'rotation curve'}"
			size={16}
			weight={700}
		/>
		<Label
			anchor="start"
			x={24}
			y={54}
			text="{g.kind} · {Math.round(g.distance * 3.2616)} million light years away"
			size={12}
			muted
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xLabel="distance from the centre (kpc)"
		yLabel={massMode ? 'mass inside (10¹⁰ Suns)' : 'orbital speed (km/s)'}
	/>

	<g clip-path="url(#curve-clip)">
		{#if show.kepler && !massMode}
			<path
				d={keplerPath}
				fill="none"
				stroke="var(--dm-kepler)"
				stroke-width="2"
				stroke-dasharray="6 5"
				opacity={curvesIn}
			/>
		{/if}
		{#if show.parts}
			<g opacity={curvesIn}>
				{#if !massMode}
					<path
						d={series((m) => m.gas)}
						fill="none"
						stroke="var(--dm-gas)"
						stroke-width="1.6"
						opacity="0.9"
					/>
					<path
						d={series((m) => m.stars)}
						fill="none"
						stroke="var(--dm-stars)"
						stroke-width="1.6"
						opacity="0.9"
					/>
				{/if}
				<path
					d={series((m) => m.total)}
					fill="none"
					stroke="var(--dm-visible)"
					stroke-width="2.6"
				/>
				{#if halo}
					<path
						d={haloPath}
						fill="none"
						stroke="var(--dm-halo)"
						stroke-width="2.2"
						stroke-dasharray={halo.ratio > 0 ? undefined : '2 4'}
					/>
					<path d={series((m) => m.model)} fill="none" stroke="var(--dm-model)" stroke-width="3" />
				{/if}
			</g>
		{/if}
	</g>

	<!-- measured points -->
	{#each g.points as p, i (i)}
		{@const o = appear(p.r)}
		{@const lo = massMode ? massOf(p.v - p.e, p.r) : p.v - p.e}
		{@const hi = massMode ? massOf(p.v + p.e, p.r) : p.v + p.e}
		{@const mid = massMode ? massOf(p.v, p.r) : p.v}
		<g opacity={o}>
			<line
				x1={sx(p.r)}
				x2={sx(p.r)}
				y1={y(lo)}
				y2={Math.max(Y0, y(hi))}
				stroke="var(--dm-data)"
				stroke-width="1"
				opacity="0.45"
			/>
			<circle cx={sx(p.r)} cy={y(mid)} r="3" fill="var(--dm-data)" />
		</g>
	{/each}

	<!-- cursor -->
	{#if cursorOn}
		<g opacity={reduced ? 1 : smoothstep(1.6, 2.2, tt)}>
			<line
				x1={sx(cur.r)}
				x2={sx(cur.r)}
				y1={Y0}
				y2={Y1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 4"
			/>
			<circle
				cx={sx(cur.r)}
				cy={y(cur.v)}
				r="6"
				fill="none"
				stroke="var(--dm-data)"
				stroke-width="2"
			/>
			{#if show.parts}
				<circle
					cx={sx(cur.r)}
					cy={y(massMode ? massOf(curM.total, cur.r) : curM.total)}
					r="5"
					fill="var(--dm-visible)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
			{#if halo}
				<circle
					cx={sx(cur.r)}
					cy={y(massMode ? massOf(curM.model, cur.r) : curM.model)}
					r="5"
					fill="var(--dm-model)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
			{#if show.kepler && !massMode}
				<circle
					cx={sx(cur.r)}
					cy={y(keplerSpeed(vm.total, cur.r))}
					r="4.5"
					fill="var(--dm-kepler)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		</g>
	{/if}

	{#if halo && !massMode}
		<Handle
			x={sx(g.rLast)}
			y={Math.max(Y0, y(handleV))}
			label="Mass of the dark halo"
			value={ratioTarget}
			min={0}
			max={RATIO_MAX}
			valuetext="{ratioTarget.toFixed(1)} times the visible mass"
			color="var(--dm-halo)"
			onmove={onHandle}
			onkey={onHandleKey}
			ondragstart={() => (dragging = true)}
			ondragend={() => (dragging = false)}
		/>
	{/if}

	<!-- legend -->
	<Readout id="legend">
		{#each LEGEND as l, i (l.id)}
			{#if l.dot}
				<circle cx={legendX[i] + 12} cy={548} r="3.5" fill={l.color} />
			{:else}
				<line
					x1={legendX[i]}
					x2={legendX[i] + 24}
					y1={548}
					y2={548}
					stroke={l.color}
					stroke-width="3"
					stroke-dasharray={l.dash ? '6 4' : undefined}
				/>
			{/if}
			<Label anchor="start" x={legendX[i] + 30} y={552} text={l.label} size={12} muted />
		{/each}
	</Readout>

	<!-- ---- card ---- -->
	<Card x={CX} y={16} w={CW} h={568} />
	{#if phase === 'curve'}
		<Label
			anchor="start"
			x={CX + 16}
			y={44}
			text="At the last point, {g.rLast.toFixed(0)} kpc out"
			size={14}
			weight={700}
		/>
		<Readout id="r-meas" order={2} label="Measured speed" value="{last.v.toFixed(0)} km/s">
			<Label anchor="start" x={CX + 16} y={74} text="measured speed" size={12.5} muted />
			<Label
				x={CX + CW - 16}
				y={74}
				text="{last.v.toFixed(0)} km/s"
				size={14}
				weight={700}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="r-kep"
			order={3}
			label="Kepler, from the visible mass"
			value="{keplerLast.toFixed(0)} km/s"
			color="var(--dm-kepler)"
		>
			<Label anchor="start" x={CX + 16} y={100} text="Kepler, visible mass" size={12.5} muted />
			<Label
				x={CX + CW - 16}
				y={100}
				text="{keplerLast.toFixed(0)} km/s"
				size={14}
				weight={700}
				anchor="end"
				color="var(--dm-kepler)"
			/>
		</Readout>
		<Label
			anchor="start"
			x={CX + 16}
			y={124}
			text="visible mass: {e10(vm.total)} × 10¹⁰ Suns"
			size={11.5}
			muted
		/>
		<line x1={CX + 16} x2={CX + CW - 16} y1={142} y2={142} stroke="var(--border)" />
		<Readout
			id="r-need"
			order={4}
			label="Mass needed"
			value="({last.v.toFixed(0)}/{keplerLast.toFixed(0)})² = {((last.v / keplerLast) ** 2).toFixed(
				1
			)} × the visible mass"
		>
			<Label anchor="start" x={CX + 16} y={168} text="mass the orbit needs" size={12.5} muted />
			<Label
				x={CX + CW - 16}
				y={196}
				text="({last.v.toFixed(0)} ÷ {keplerLast.toFixed(0)})² = {(
					(last.v / keplerLast) **
					2
				).toFixed(1)} ×"
				size={16}
				weight={700}
				anchor="end"
			/>
			<Label x={CX + CW - 16} y={216} text="the visible mass" size={12.5} anchor="end" />
		</Readout>
		<Readout id="r-kepnote">
			<Label
				anchor="start"
				x={CX + 16}
				y={262}
				text="The dashed curve falls as 1/√r, like"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={CX + 16}
				y={280}
				text="the planets round the Sun: what an"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={CX + 16}
				y={298}
				text="orbit would do if all the visible"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={CX + 16}
				y={316}
				text="mass sat at the centre. The stars"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={CX + 16}
				y={334}
				text="far out are much too fast for it."
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Label
			anchor="start"
			x={CX + 16}
			y={44}
			text="How well the model fits"
			size={14}
			weight={700}
		/>
		<Readout
			id="r-chi"
			order={2}
			label="χ² per point"
			value="{chiText(score.reduced)} ({verdict})"
			color={score.reduced < 3 ? 'var(--dm-model)' : 'var(--dm-visible)'}
		>
			<Label anchor="start" x={CX + 16} y={74} text="χ² per point" size={12.5} muted />
			<Label
				x={CX + CW - 16}
				y={74}
				text={chiText(score.reduced)}
				size={18}
				weight={700}
				anchor="end"
				color={score.reduced < 3 ? 'var(--dm-model)' : 'var(--dm-visible)'}
			/>
			<Label x={CX + CW - 16} y={94} text={verdict} size={12} anchor="end" muted />
		</Readout>
		<Readout
			id="r-miss"
			order={3}
			label="Typical miss"
			value="{score.rmsKms.toFixed(0)} km/s ({score.rmsSigma.toFixed(1)} error bars)"
		>
			<Label anchor="start" x={CX + 16} y={118} text="typical miss" size={12.5} muted />
			<Label
				x={CX + CW - 16}
				y={118}
				text="{score.rmsKms.toFixed(0)} km/s, {score.rmsSigma.toFixed(1)} error bars"
				size={12.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<line x1={CX + 16} x2={CX + CW - 16} y1={134} y2={134} stroke="var(--border)" />
		<Readout id="m-masses">
			<Label
				anchor="start"
				x={CX + 16}
				y={158}
				text="Visible matter (measured)"
				size={13}
				weight={700}
				color="var(--dm-visible)"
			/>
			<Label
				anchor="start"
				x={CX + 16}
				y={180}
				text="stars, Υ = {mlTarget.toFixed(2)}"
				size={12.5}
				muted
			/>
			<Label x={CX + CW - 16} y={180} text="{e10(vm.stars)} × 10¹⁰ Suns" size={12.5} anchor="end" />
			<Label anchor="start" x={CX + 16} y={200} text="gas (hydrogen + helium)" size={12.5} muted />
			<Label x={CX + CW - 16} y={200} text="{e10(vm.gas)} × 10¹⁰ Suns" size={12.5} anchor="end" />
			{#if withHalo}
				<Label
					anchor="start"
					x={CX + 16}
					y={232}
					text="Dark halo (your guess)"
					size={13}
					weight={700}
					color="var(--dm-halo)"
				/>
				<Label
					anchor="start"
					x={CX + 16}
					y={254}
					text="mass inside {g.rLast.toFixed(0)} kpc"
					size={12.5}
					muted
				/>
				<Label
					x={CX + CW - 16}
					y={254}
					text="{e10(darkLast)} × 10¹⁰ Suns"
					size={12.5}
					anchor="end"
				/>
				<Label anchor="start" x={CX + 16} y={274} text="core radius" size={12.5} muted />
				<Label
					x={CX + CW - 16}
					y={274}
					text="{coreTarget.toFixed(1)} kpc"
					size={12.5}
					anchor="end"
				/>
			{/if}
		</Readout>
		{#if withHalo}
			<line x1={CX + 16} x2={CX + CW - 16} y1={294} y2={294} stroke="var(--border)" />
			<Label
				anchor="start"
				x={CX + 16}
				y={318}
				text="Mass inside {g.rLast.toFixed(0)} kpc"
				size={13}
				weight={700}
			/>
			<rect x={BAR_X} y={332} width={BAR_W} height={26} rx="5" fill="none" stroke="var(--border)" />
			<rect x={BAR_X} y={332} width={visW} height={26} rx="5" fill="var(--dm-visible)" />
			{#if darkLast > 0}
				<rect
					x={BAR_X + visW}
					y={332}
					width={BAR_W - visW}
					height={26}
					rx="5"
					fill="var(--dm-halo)"
					opacity="0.85"
				/>
			{/if}
			<Readout id="m-bar">
				<Label
					anchor="start"
					x={BAR_X}
					y={376}
					text="visible"
					size={11.5}
					color="var(--dm-visible)"
					weight={650}
				/>
				<Label
					x={BAR_X + BAR_W}
					y={376}
					text="dark"
					size={11.5}
					anchor="end"
					color="var(--dm-halo)"
					weight={650}
				/>
			</Readout>
			<Readout
				id="r-ratio"
				order={4}
				label="Dark ÷ visible"
				value="{(darkLast / vm.total).toFixed(1)} ×"
				color="var(--dm-halo)"
			>
				<Label anchor="start" x={CX + 16} y={412} text="dark ÷ visible" size={13} muted />
				<Label
					x={CX + CW - 16}
					y={414}
					text="{(darkLast / vm.total).toFixed(1)} ×"
					size={24}
					weight={700}
					anchor="end"
					color="var(--dm-halo)"
				/>
			</Readout>
		{:else}
			<Readout id="m-nohalo">
				<Label anchor="start" x={CX + 16} y={236} text="No halo: the visible matter" size={12.5} />
				<Label
					anchor="start"
					x={CX + 16}
					y={254}
					text="alone has to hold the orbits."
					size={12.5}
				/>
			</Readout>
		{/if}
	{/if}

	{#if cursorOn && !massMode}
		<line x1={CX + 16} x2={CX + CW - 16} y1={448} y2={448} stroke="var(--border)" />
		<Readout id="r-cursor">
			<Label
				anchor="start"
				x={CX + 16}
				y={472}
				text="Under the cursor, {cur.r.toFixed(1)} kpc out"
				size={12.5}
				weight={650}
			/>
			<Label anchor="start" x={CX + 16} y={494} text="measured" size={12} muted />
			<Label
				x={CX + CW - 16}
				y={494}
				text="{cur.v.toFixed(0)} ± {cur.e.toFixed(0)} km/s"
				size={12}
				anchor="end"
			/>
			{#if show.parts}
				<Label anchor="start" x={CX + 16} y={514} text="visible matter" size={12} muted />
				<Label
					x={CX + CW - 16}
					y={514}
					text="{Math.max(0, curM.total).toFixed(0)} km/s"
					size={12}
					anchor="end"
					color="var(--dm-visible)"
				/>
			{/if}
			{#if halo}
				<Label anchor="start" x={CX + 16} y={534} text="visible + halo" size={12} muted />
				<Label
					x={CX + CW - 16}
					y={534}
					text="{curM.model.toFixed(0)} km/s"
					size={12}
					anchor="end"
					color="var(--dm-model)"
				/>
			{:else if show.kepler}
				<Label anchor="start" x={CX + 16} y={534} text="Kepler" size={12} muted />
				<Label
					x={CX + CW - 16}
					y={534}
					text="{keplerSpeed(vm.total, cur.r).toFixed(0)} km/s"
					size={12}
					anchor="end"
					color="var(--dm-kepler)"
				/>
			{/if}
		</Readout>
	{:else if massMode}
		<line x1={CX + 16} x2={CX + CW - 16} y1={448} y2={448} stroke="var(--border)" />
		<Readout id="r-massnote">
			<Label
				anchor="start"
				x={CX + 16}
				y={472}
				text={halo && halo.ratio > 0 ? 'The dark halo keeps growing' : 'Add a halo to see its mass'}
				size={12.5}
				weight={650}
			/>
			{#if halo && halo.ratio > 0}
				<Label
					anchor="start"
					x={CX + 16}
					y={492}
					text="where the stars and gas run out;"
					size={12}
					muted
				/>
				<Label
					anchor="start"
					x={CX + 16}
					y={510}
					text="the measurements stop, the halo"
					size={12}
					muted
				/>
				<Label
					anchor="start"
					x={CX + 16}
					y={528}
					text="almost certainly does not."
					size={12}
					muted
				/>
			{:else}
				<Label
					anchor="start"
					x={CX + 16}
					y={492}
					text="with the slider, or “Find the best"
					size={12}
					muted
				/>
				<Label anchor="start" x={CX + 16} y={510} text="halo” below the chart." size={12} muted />
			{/if}
		</Readout>
	{/if}
</g>
