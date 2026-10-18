<script lang="ts">
	/**
	 * The chosen pair in the frame that turns with it, with an inset round the small body (wide
	 * enough for L1 and L2, so that Sun–Earth's points, 0.01 of the separation from Earth, show).
	 * `focus` 'frame': the turning frame on or off (from the stars the two bodies circle their centre
	 * of mass and the frame's axis turns with them; in the frame they stand still and the stars
	 * wheel round). 'points': the five points on contours of the effective potential. 'zvc' and
	 * 'gates': the region a probe of the slider's energy may not enter, and a probe launched
	 * between the large body and L1 tracing its path inside what is left (in 'gates' with the
	 * critical values of C in the panel).
	 */
	import { untrack } from 'svelte';
	import { Label, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ROUTH, criticalC, lagrangePoints, omega, type State } from '../model';
	import Pair from './Pair.svelte';
	import {
		C,
		INSET_BOX,
		MAIN,
		fmtDist,
		fmtMu,
		fmtTime,
		forbiddenCached,
		gatesOf,
		insetView,
		jacobiOfLevel,
		oneIn,
		pathD,
		pick,
		presetLogMu,
		radii,
		runCached,
		sx,
		sy
	} from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'points'));
	const P = $derived(pick(params));
	const mu = $derived(P.mu);

	// a preset keeps the (disabled) μ slider showing its value
	const presetLm = $derived(P.sys ? presetLogMu(P.sys.mu) : null);
	$effect(() => {
		const lm = presetLm;
		if (lm !== null) untrack(() => setParam('logmu', lm));
	});

	const L = $derived(lagrangePoints(mu));
	const crit = $derived(criticalC(mu));
	const gamma = $derived(L.L2.x - (1 - mu));
	const inset = $derived(insetView(mu, gamma));
	const zvc = $derived(focus === 'zvc' || focus === 'gates');

	// ---- the frame (focus 'frame') -------------------------------------------
	const rotating = $derived(params.rotating !== false);
	const TURN = 14; // seconds per turn on the stage
	const phase = $derived(reduced ? 0.11 : t / TURN);
	const rot = $derived(focus === 'frame' && !rotating ? 2 * Math.PI * phase : 0);
	const starRot = $derived(focus === 'frame' && rotating ? -2 * Math.PI * phase : 0);
	const stars = Array.from({ length: 60 }, (_, i) => {
		const a = i * 2.39996;
		const r = 0.25 + 1.25 * Math.sqrt(((i * 7919) % 60) / 60);
		return { i, a, r, s: 0.8 + ((i * 31) % 5) * 0.25 };
	});
	const starPts = $derived(
		stars
			.map((s) => ({
				i: s.i,
				s: s.s,
				X: sx(MAIN, s.r * Math.cos(s.a + starRot)),
				Y: sy(MAIN, s.r * Math.sin(s.a + starRot))
			}))
			.filter((s) => s.X > MAIN.x0 && s.X < MAIN.x1 && s.Y > MAIN.y0 && s.Y < MAIN.y1)
	);
	const axisEnd = $derived({
		x1: sx(MAIN, -1.2 * Math.cos(rot)),
		y1: sy(MAIN, -1.2 * Math.sin(rot)),
		x2: sx(MAIN, 1.2 * Math.cos(rot)),
		y2: sy(MAIN, 1.2 * Math.sin(rot))
	});

	// ---- energy and forbidden regions ----------------------------------------
	const level = $derived(clamp(Number(params.energy ?? 0.5), 0, 4.5));
	const Cj = $derived(jacobiOfLevel(mu, level));
	const mainZ = $derived(zvc ? forbiddenCached(mu, Cj, MAIN, 6) : null);
	const insetZ = $derived(zvc ? forbiddenCached(mu, Cj, inset, 4) : null);
	/** The landscape: contours of 2Ω through L1, L2, L3, and a few more. */
	const levels = $derived([
		crit.L1 + 0.6 * (crit.L1 - crit.L3),
		crit.L1 + 0.2 * (crit.L1 - crit.L3),
		crit.L1,
		crit.L2,
		crit.L3,
		3 + 0.35 * (crit.L3 - 3)
	]);
	const mainContours = $derived(
		focus === 'points' ? levels.map((c) => forbiddenCached(mu, c, MAIN, 6).edge) : []
	);
	const insetContours = $derived(
		focus === 'points' ? levels.slice(0, 4).map((c) => forbiddenCached(mu, c, inset, 4).edge) : []
	);
	const digits = $derived(
		clamp(Math.ceil(-Math.log10(Math.max(1e-12, crit.L1 - crit.L2))) + 2, 4, 8)
	);

	// ---- the probe (zvc, gates) ----------------------------------------------
	const xStart = $derived((-mu + L.L1.x) / 2);
	const v2 = $derived(2 * omega(mu, xStart, 0) - Cj);
	const TURNS = 12;
	const probe = $derived.by(() => {
		if (!zvc || v2 <= 0) return null;
		const s0: State = [xStart, 0, 0, Math.sqrt(v2)];
		return runCached(mu, s0, 2 * Math.PI * TURNS, 1201, { ...radii(P), far: 3 });
	});
	const RUN_SECONDS = 30;
	const shown = $derived(
		probe ? (reduced ? probe.n : Math.max(2, Math.ceil(clamp(t / RUN_SECONDS) * probe.n))) : 0
	);
	const head = $derived(
		probe && shown > 0
			? { X: sx(MAIN, probe.xy[2 * (shown - 1)]), Y: sy(MAIN, probe.xy[2 * (shown - 1) + 1]) }
			: null
	);
	const headInset = $derived(
		probe && shown > 0
			? { X: sx(inset, probe.xy[2 * (shown - 1)]), Y: sy(inset, probe.xy[2 * (shown - 1) + 1]) }
			: null
	);
	const insetHas = (p: { X: number; Y: number } | null) =>
		p !== null &&
		p.X > INSET_BOX.x0 &&
		p.X < INSET_BOX.x1 &&
		p.Y > INSET_BOX.y0 &&
		p.Y < INSET_BOX.y1;

	// ---- small-body marker on the main map ------------------------------------
	const halfPx = $derived(((INSET_BOX.x1 - INSET_BOX.x0) / 2 / inset.k) * MAIN.k);
	const sX = $derived(sx(MAIN, 1 - mu));
	const sY = $derived(sy(MAIN, 0));
	const bigR = $derived(clamp(9 + 8 * (1 - mu), 9, 16));
	const smallR = $derived(clamp(4 + 14 * Math.cbrt(mu), 4, 14));

	const periodText = $derived(
		P.sys
			? P.sys.period < 400
				? `${P.sys.period.toFixed(1)} days`
				: fmtTime(P, 2 * Math.PI)
			: 'one turn'
	);
</script>

<g>
	<defs>
		<clipPath id="lg-map-clip">
			<rect x={MAIN.x0} y={MAIN.y0} width={MAIN.x1 - MAIN.x0} height={MAIN.y1 - MAIN.y0} rx="12" />
		</clipPath>
		<clipPath id="lg-inset-clip">
			<rect
				x={INSET_BOX.x0}
				y={INSET_BOX.y0}
				width={INSET_BOX.x1 - INSET_BOX.x0}
				height={INSET_BOX.y1 - INSET_BOX.y0}
				rx="10"
			/>
		</clipPath>
	</defs>

	<!-- ===================================================== main map -->
	<g clip-path="url(#lg-map-clip)">
		{#if focus === 'frame'}
			{#each starPts as s (s.i)}
				<circle cx={s.X} cy={s.Y} r={s.s} fill={C.star} />
			{/each}
		{/if}
		{#if mainZ}
			<path
				d={mainZ.fill}
				fill={C.forbidden}
				stroke={C.forbidden}
				stroke-width="0.8"
				shape-rendering="crispEdges"
			/>
			<path d={mainZ.edge} fill="none" stroke={C.forbiddenEdge} stroke-width="1.5" />
		{/if}
		{#each mainContours as d, i (i)}
			<path
				{d}
				fill="none"
				stroke={i >= 2 && i <= 4 ? C.point : 'var(--stage-ink-muted)'}
				stroke-width={i >= 2 && i <= 4 ? 1.3 : 1}
				opacity={i >= 2 && i <= 4 ? 0.7 : 0.45}
			/>
		{/each}
		<!-- the small body's orbit and the axis through the two bodies -->
		<circle
			cx={sx(MAIN, 0)}
			cy={sy(MAIN, 0)}
			r={(1 - mu) * MAIN.k}
			fill="none"
			stroke={C.orbit}
			stroke-width="1"
			stroke-dasharray="4 5"
		/>
		{#if focus === 'frame'}
			<circle
				cx={sx(MAIN, 0)}
				cy={sy(MAIN, 0)}
				r={mu * MAIN.k}
				fill="none"
				stroke={C.orbit}
				stroke-width="1"
				stroke-dasharray="4 5"
			/>
			<line
				x1={axisEnd.x1}
				y1={axisEnd.y1}
				x2={axisEnd.x2}
				y2={axisEnd.y2}
				stroke={C.point}
				stroke-width="1.3"
				opacity="0.7"
			/>
		{/if}
		{#if probe && shown > 1}
			<path
				d={pathD(MAIN, probe, 0, shown)}
				fill="none"
				stroke={C.probe}
				stroke-width="1.2"
				opacity="0.75"
				stroke-linejoin="round"
			/>
		{/if}
		<Pair
			v={MAIN}
			{mu}
			big={P.big}
			small={P.small}
			points={focus !== 'frame'}
			{rot}
			rBig={bigR}
			rSmall={smallR}
		/>
		{#if focus === 'frame'}
			<circle
				cx={sx(MAIN, 0)}
				cy={sy(MAIN, 0)}
				r="2.5"
				fill="var(--stage-bg)"
				stroke="var(--stage-ink)"
				stroke-width="1.2"
			/>
			<line
				x1={sx(MAIN, 0) - 2}
				y1={sy(MAIN, 0) - 3}
				x2={sx(MAIN, 0) - 10}
				y2={sy(MAIN, 0) - 22}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
			/>
		{/if}
		{#if head}
			<circle
				cx={head.X}
				cy={head.Y}
				r="5"
				fill={C.probe}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
		{#if focus !== 'frame' && halfPx < 60}
			<rect
				x={sX - Math.max(6, halfPx)}
				y={sY - Math.max(6, halfPx) * 0.875}
				width={2 * Math.max(6, halfPx)}
				height={1.75 * Math.max(6, halfPx)}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
		{/if}
	</g>
	<rect
		x={MAIN.x0}
		y={MAIN.y0}
		width={MAIN.x1 - MAIN.x0}
		height={MAIN.y1 - MAIN.y0}
		rx="12"
		fill="none"
		stroke="var(--stage-line)"
	/>
	{#if focus === 'frame'}
		<Readout
			id="frame-mode"
			order={1}
			label="View"
			value={rotating ? 'turning with the pair' : 'from the stars'}
		>
			<Label
				x={MAIN.x0 + 14}
				y={MAIN.y0 + 24}
				anchor="start"
				text={rotating
					? 'turning with the two bodies: they stand still'
					: 'from the stars: the two circle their centre of mass'}
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout id="frame-com">
			<Label
				x={sx(MAIN, 0) - 4}
				y={sy(MAIN, 0) - 26}
				anchor="end"
				text="centre of mass"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<Readout id="map-title">
			<Label
				x={MAIN.x0 + 14}
				y={MAIN.y0 + 24}
				anchor="start"
				text="{P.name} · turning frame"
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- ===================================================== right panel -->
	{#if focus === 'frame'}
		<g>
			<rect
				x={INSET_BOX.x0}
				y={INSET_BOX.y0}
				width={INSET_BOX.x1 - INSET_BOX.x0}
				height="250"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Readout id="frame-pair" order={2} label="Pair" value="{P.name}, μ = {fmtMu(mu)}">
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 28}
					anchor="start"
					text={P.name}
					size={15}
					weight={700}
				/>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 50}
					anchor="start"
					text="μ = {fmtMu(mu)} ({oneIn(mu)} of the mass)"
					size={12}
					muted
					tabular
				/>
			</Readout>
			<Readout id="frame-period" order={3} label="One turn of the frame" value={periodText}>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 84}
					anchor="start"
					text="one turn: {periodText}"
					size={13}
					tabular
				/>
			</Readout>
			<Readout id="frame-forces">
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 120}
					anchor="start"
					text="in the turning frame a probe feels"
					size={12}
					muted
				/>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 140}
					anchor="start"
					text="both gravities, plus"
					size={12}
					muted
				/>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 164}
					anchor="start"
					text="centrifugal: away from the axis"
					size={12}
					weight={600}
				/>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 186}
					anchor="start"
					text="Coriolis: sideways to its motion"
					size={12}
					weight={600}
				/>
				<Label
					x={INSET_BOX.x0 + 14}
					y={INSET_BOX.y0 + 220}
					anchor="start"
					text="bodies not to scale"
					size={11}
					muted
				/>
			</Readout>
		</g>
	{:else}
		<!-- inset round the small body -->
		<g clip-path="url(#lg-inset-clip)">
			<rect
				x={INSET_BOX.x0}
				y={INSET_BOX.y0}
				width={INSET_BOX.x1 - INSET_BOX.x0}
				height={INSET_BOX.y1 - INSET_BOX.y0}
				fill="var(--stage-bg)"
			/>
			{#if insetZ}
				<path
					d={insetZ.fill}
					fill={C.forbidden}
					stroke={C.forbidden}
					stroke-width="0.8"
					shape-rendering="crispEdges"
				/>
				<path d={insetZ.edge} fill="none" stroke={C.forbiddenEdge} stroke-width="1.5" />
			{/if}
			{#each insetContours as d, i (i)}
				<path
					{d}
					fill="none"
					stroke={i >= 2 ? C.point : 'var(--stage-ink-muted)'}
					stroke-width={i >= 2 ? 1.3 : 1}
					opacity={i >= 2 ? 0.7 : 0.45}
				/>
			{/each}
			<line
				x1={INSET_BOX.x0}
				x2={INSET_BOX.x1}
				y1={inset.cy}
				y2={inset.cy}
				stroke={C.orbit}
				stroke-width="1"
				stroke-dasharray="4 5"
			/>
			{#if probe && shown > 1}
				<path
					d={pathD(inset, probe, 0, shown)}
					fill="none"
					stroke={C.probe}
					stroke-width="1.2"
					opacity="0.75"
				/>
			{/if}
			<Pair v={inset} {mu} big={P.big} small={P.small} rSmall={9} bodyLabels={false} />
			{#if headInset && insetHas(headInset)}
				<circle
					cx={headInset.X}
					cy={headInset.Y}
					r="5"
					fill={C.probe}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		</g>
		<rect
			x={INSET_BOX.x0}
			y={INSET_BOX.y0}
			width={INSET_BOX.x1 - INSET_BOX.x0}
			height={INSET_BOX.y1 - INSET_BOX.y0}
			rx="10"
			fill="none"
			stroke="var(--stage-line)"
		/>
		<Readout id="inset-title">
			<Label
				x={INSET_BOX.x0 + 4}
				y={INSET_BOX.y0 - 12}
				anchor="start"
				text="round the {P.small}, {(INSET_BOX.x1 - INSET_BOX.x0) / inset.k < 0.1
					? 'zoomed in'
					: 'closer'}"
				size={12}
				weight={600}
			/>
		</Readout>
		<Readout id="inset-label">
			<Label
				x={INSET_BOX.x1 - 10}
				y={INSET_BOX.y0 + 20}
				anchor="end"
				text={P.small}
				size={12}
				weight={600}
			/>
		</Readout>

		{#if focus === 'points'}
			<Readout
				id="pt-l1"
				order={2}
				label="L1 from the {P.small}"
				value={fmtDist(P, 1 - mu - L.L1.x)}
			>
				<Label
					x={INSET_BOX.x0}
					y={360}
					anchor="start"
					text="L1: {fmtDist(P, 1 - mu - L.L1.x)} from the {P.small}"
					size={13}
					tabular
				/>
			</Readout>
			<Readout id="pt-l2" order={3} label="L2 beyond the {P.small}" value={fmtDist(P, gamma)}>
				<Label
					x={INSET_BOX.x0}
					y={384}
					anchor="start"
					text="L2: {fmtDist(P, gamma)} beyond it"
					size={13}
					tabular
				/>
			</Readout>
			<Readout id="pt-l3" order={4} label="L3 from the {P.big}" value={fmtDist(P, -mu - L.L3.x)}>
				<Label
					x={INSET_BOX.x0}
					y={408}
					anchor="start"
					text="L3: {fmtDist(P, -mu - L.L3.x)} from the {P.big}"
					size={13}
					tabular
				/>
			</Readout>
			<Readout
				id="pt-l45"
				order={5}
				label="L4 and L5"
				value="60° ahead and behind{mu < ROUTH ? '' : ', unstable'}"
			>
				<Label
					x={INSET_BOX.x0}
					y={432}
					anchor="start"
					text="L4, L5: 60° ahead and behind"
					size={13}
				/>
			</Readout>
			<Readout id="pt-mu">
				<Label
					x={INSET_BOX.x0}
					y={466}
					anchor="start"
					text="μ = {fmtMu(mu)} · {oneIn(mu)}"
					size={12}
					muted
					tabular
				/>
				<Label
					x={INSET_BOX.x0}
					y={488}
					anchor="start"
					text="lines: contours of the potential energy"
					size={11}
					muted
				/>
				<Label
					x={INSET_BOX.x0}
					y={506}
					anchor="start"
					text="bold: the contours through L1, L2, L3"
					size={11}
					muted
				/>
				<Label x={INSET_BOX.x0} y={524} anchor="start" text="bodies not to scale" size={11} muted />
			</Readout>
		{:else}
			<Readout id="zvc-c" order={2} label="Jacobi constant" value="C = {Cj.toFixed(digits)}">
				<Label
					x={INSET_BOX.x0}
					y={360}
					anchor="start"
					text="C = {Cj.toFixed(digits)}"
					size={15}
					weight={700}
					tabular
				/>
			</Readout>
			<Readout id="zvc-gates" order={3} label="Gates" value={gatesOf(level)}>
				<Label
					x={INSET_BOX.x0}
					y={384}
					anchor="start"
					text={gatesOf(level)}
					size={13}
					weight={600}
					color={C.forbiddenEdge}
				/>
			</Readout>
			{#if focus === 'gates'}
				{#each [{ id: 'L1', c: crit.L1, y: 418 }, { id: 'L2', c: crit.L2, y: 440 }, { id: 'L3', c: crit.L3, y: 462 }, { id: 'L4, L5', c: 3, y: 484 }] as g (g.id)}
					<Readout id="crit-{g.id}">
						<Label
							x={INSET_BOX.x0}
							y={g.y}
							anchor="start"
							text="C at {g.id} = {g.c.toFixed(digits)} · {Cj < g.c ? 'open' : 'shut'}"
							size={12}
							muted={Cj >= g.c}
							weight={Cj < g.c ? 600 : 400}
							tabular
						/>
					</Readout>
				{/each}
			{:else}
				<Readout id="zvc-key">
					<Label
						x={INSET_BOX.x0}
						y={418}
						anchor="start"
						text="shaded: 2Ω < C, where v² would be negative"
						size={11}
						muted
					/>
					<Label
						x={INSET_BOX.x0}
						y={436}
						anchor="start"
						text="edge: the zero-velocity curve"
						size={11}
						muted
					/>
				</Readout>
			{/if}
			<Readout
				id="zvc-probe"
				order={4}
				label="Probe"
				value={probe
					? probe.end
						? 'crashed'
						: `flying, ${fmtTime(P, probe.t[Math.max(0, shown - 1)])}`
					: 'cannot start here'}
			>
				<Label
					x={INSET_BOX.x0}
					y={518}
					anchor="start"
					text={probe
						? probe.end === 'hit-big' || probe.end === 'hit-small'
							? `probe hit the ${probe.end === 'hit-big' ? P.big : P.small} after ${fmtTime(P, probe.t[probe.n - 1])}`
							: `probe: ${fmtTime(P, probe.t[Math.max(0, shown - 1)])} of flight`
						: 'the launch point is forbidden at this energy'}
					size={12}
					color={C.probeText}
					tabular
				/>
			</Readout>
		{/if}
	{/if}
</g>
