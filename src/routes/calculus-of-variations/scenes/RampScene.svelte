<script lang="ts">
	/**
	 * Beads sliding from A to B on wires of different shapes, with their descent
	 * times. All numbers come from `../brachistochrone.ts`.
	 *
	 * Phases (`step.hints.phase`):
	 *   race     — the straight line, the circular arc and the reader's curve (four
	 *              handles) race; the chart plots each bead's speed against time
	 *   time     — the same, with a dot on each curve every 0.1 s
	 *   descend  — gradient descent bends a curve (47 free points) towards the cycloid;
	 *              the chart plots the Euler–Lagrange residual along it
	 *   cycloid  — all four race, the cycloid's bead riding the rim of a rolling wheel
	 *   snell    — sin φ / v along each curve (flat on the cycloid)
	 *   dip      — B moves across (`params.span`); the cycloid dips below B beyond
	 *              L/h = π/2; the chart plots the dip against L/h
	 *
	 * The reader's four control depths live in `params.curve` ("0.9,1.45,1.8,2"), so
	 * they survive the moves between steps. The race restarts when a curve changes
	 * (a frame-to-frame memo of the clock, the scene guide's sanctioned exception).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		Label,
		clamp,
		linePath,
		niceMax,
		scale,
		thin,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		G,
		arcPoints,
		arrivalTimes,
		cycloid,
		cycloidPoints,
		grid,
		optimise,
		passable,
		positionAt,
		residual,
		snell,
		speedAt,
		spline,
		splinePoints,
		type Pt
	} from '../brachistochrone';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const DROP = 2; // m
	const DEFAULT = [0.9, 1.45, 1.8, 2];
	const HOLD = 0.6; // s at the start before the beads are released
	const REST = 1.8; // s at the finish before the race restarts
	const ITERATIONS = 400;
	const OPT_SECONDS = 9; // the optimiser's animation
	const MIN_DEPTH = -0.4;

	const phase = $derived(String(step.hints?.phase ?? 'race'));
	const L = $derived(phase === 'dip' ? clamp(Number(params.span ?? 4), 1, 8) : 4);
	const from = $derived(String(params.from ?? 'yours'));

	// ---- the curves -------------------------------------------------------------------
	const arcLowest = (l: number) => {
		const R = (l * l + DROP * DROP) / (2 * l);
		return R <= l ? R : DROP;
	};
	/** How deep the drawing must reach for a given L (the arc or the cycloid, whichever is deeper). */
	const deepFor = (l: number) => Math.max(DROP, arcLowest(l), cycloid(l, DROP).lowest) + 0.3;
	const deepest = $derived(deepFor(L));

	const depths = $derived.by(() => {
		const raw = String(params.curve ?? '')
			.split(',')
			.map(Number);
		return raw.length === DEFAULT.length && raw.every(Number.isFinite)
			? raw.map((d) => clamp(d, MIN_DEPTH, deepest))
			: DEFAULT;
	});

	const cyc = $derived(cycloid(L, DROP));

	interface Curve {
		id: string;
		name: string;
		color: string;
		pts: Pt[];
		times: number[];
		T: number;
	}
	const make = (id: string, name: string, color: string, pts: Pt[]): Curve => {
		const times = arrivalTimes(pts);
		return { id, name, color, pts, times, T: times[times.length - 1] };
	};
	const curves = $derived.by(() => [
		make(
			'line',
			'straight line',
			'var(--cv-line)',
			Array.from({ length: 61 }, (_, i) => ({ x: (L * i) / 60, y: (DROP * i) / 60 }))
		),
		make('arc', 'circular arc', 'var(--cv-arc)', arcPoints(L, DROP, 300)),
		make('yours', 'your curve', 'var(--cv-yours)', splinePoints(L, DROP, depths, 300)),
		make('cycloid', 'cycloid', 'var(--cv-cycloid)', cycloidPoints(cyc, 300))
	]);

	/** Which curves each phase draws (1), dims (0.35) or hides (0). */
	const VISIBLE: Record<string, Record<string, number>> = {
		race: { line: 1, arc: 1, yours: 1, cycloid: 0 },
		time: { line: 1, arc: 1, yours: 1, cycloid: 0 },
		descend: { line: 0.3, arc: 0.3, yours: 0.3, cycloid: 0.9 },
		cycloid: { line: 1, arc: 1, yours: 1, cycloid: 1 },
		snell: { line: 1, arc: 1, yours: 1, cycloid: 1 },
		dip: { line: 1, arc: 1, yours: 0, cycloid: 1 }
	};
	const shown = Tween.of(() => VISIBLE[phase] ?? VISIBLE.race, {
		duration: 700,
		easing: cubicInOut
	});
	const opacity = (id: string) => shown.current[id] ?? 0;
	const racing = $derived(
		curves.filter((c) => (VISIBLE[phase]?.[c.id] ?? 0) === 1 && phase !== 'snell')
	);

	// ---- layout: one scale for both axes, so drawn slopes are true slopes ----------------
	const BOX = { cx: 352, top: 104, width: 540, height: 290 };
	// On the dip step the scale stays that of the widest trip, so that B can be dragged.
	const kTarget = $derived.by(() => {
		const l = phase === 'dip' ? 8 : L;
		return Math.min(BOX.width / l, BOX.height / deepFor(l));
	});
	const kTween = Tween.of(() => kTarget, { duration: 800, easing: cubicInOut });
	const k = $derived(kTween.current);
	const ox = $derived(BOX.cx - (k * (phase === 'dip' ? 8 : L)) / 2);
	const sx = (x: number) => ox + k * x;
	const sy = (y: number) => BOX.top + k * y;
	const pathOf = (pts: readonly Pt[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');

	// ---- the race clock ----------------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (reduced) return t;
		const key = `${phase}|${L}|${depths.join(',')}|${from}|${String(params.run ?? 0)}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const longest = $derived(
		Math.max(cyc.T, ...racing.map((c) => c.T).filter((v) => Number.isFinite(v)))
	);
	const period = $derived(HOLD + longest + REST);
	// The still frame: mid-race, or the moment the cycloid's bead arrives.
	const still = $derived(phase === 'cycloid' || phase === 'dip' ? cyc.T : 0.8);
	const tau = $derived(reduced ? still : Math.max(0, (since % period) - HOLD));

	const beads = $derived(
		racing.map((c) => {
			const p = positionAt(c.pts, c.times, tau);
			return { id: c.id, color: c.color, x: sx(p.x), y: sy(p.y), speed: speedAt(p.y) };
		})
	);

	/** Dots every 0.1 s along each racing curve (the time step). */
	const dots = $derived(
		phase === 'time'
			? racing.flatMap((c) => {
					const n = Math.floor((Number.isFinite(c.T) ? c.T : 3) / 0.1 - 1e-9);
					return Array.from({ length: Math.min(n, 40) }, (_, i) => {
						const p = positionAt(c.pts, c.times, 0.1 * (i + 1));
						return { key: `${c.id}-${i}`, color: c.color, x: sx(p.x), y: sy(p.y), big: i === 4 };
					});
				})
			: []
	);

	// ---- the optimiser -----------------------------------------------------------------
	const xs = $derived(grid(L));
	const rawStart = $derived.by(() => {
		if (from === 'line') return xs.map((x) => (DROP * x) / L);
		if (from === 'arc') {
			const R = (L * L + DROP * DROP) / (2 * L);
			return xs.map((x) => Math.sqrt(Math.max(0, R * R - (R - x) * (R - x))));
		}
		const f = spline(L, DROP, depths);
		return xs.map((x, i) => (i === 0 ? 0 : f(x)));
	});
	// The same passable start for the optimiser, the dashed start curve and its residual.
	const startYs = $derived(passable(rawStart));
	const iterates = $derived(phase === 'descend' ? optimise(xs, startYs, ITERATIONS) : []);
	const kShown = $derived(
		reduced
			? ITERATIONS
			: Math.min(ITERATIONS, Math.floor(ITERATIONS * Math.min(1, since / OPT_SECONDS) ** 2))
	);
	const current = $derived(iterates[kShown] ?? iterates[iterates.length - 1]);
	const currentPts = $derived(current ? xs.map((x, i) => ({ x, y: current.ys[i] })) : []);
	const startPts = $derived(xs.map((x, i) => ({ x, y: startYs[i] })));
	const res = $derived(current ? residual(xs, current.ys) : []);

	// ---- the wheel (cycloid step) ---------------------------------------------------------
	const wheel = $derived.by(() => {
		const phi = clamp(tau * Math.sqrt(G / cyc.r), 0, cyc.theta);
		const rim = cyc.at(phi);
		return {
			cx: sx(cyc.r * phi),
			cy: sy(cyc.r),
			r: k * cyc.r,
			rim: { x: sx(rim.x), y: sy(rim.y) }
		};
	});

	// ---- Snell: the angle from the vertical at three points of the cycloid ---------------
	const angles = $derived(
		[0.3, 0.55, 0.8].map((u) => {
			const phi = u * cyc.theta;
			const p = cyc.at(phi);
			// On a cycloid the tangent makes an angle φ/2 with the vertical.
			const a = phi / 2;
			return { key: u, x: sx(p.x), y: sy(p.y), a, deg: Math.round((a * 180) / Math.PI) };
		})
	);

	// ---- the handles -------------------------------------------------------------------
	const showHandles = $derived(phase !== 'dip');
	const handleX = (i: number) => (L * (i + 1)) / (DEFAULT.length + 1);
	const setDepth = (i: number, d: number) => {
		const next = depths.map((v, j) => (j === i ? clamp(d, MIN_DEPTH, deepest) : v));
		setParam('curve', next.map((v) => v.toFixed(2)).join(','));
	};

	// ---- the chart under the track ------------------------------------------------------
	const CH = { left: 96, right: 616, top: 456, bottom: 548 };
	const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
	const vMax = $derived(Math.ceil(speedAt(deepFor(L)) + 0.5));
	const tMax = $derived(Math.max(1.5, Math.ceil(longest * 2 + 0.2) / 2));
	const speedChart = $derived.by(() => {
		const csx = scale([0, tMax], [CH.left, CH.right]);
		const csy = scale([0, vMax], [CH.bottom, CH.top]);
		const lines = racing.map((c) => {
			const data = c.pts
				.map((p, i) => ({ t: c.times[i], v: speedAt(p.y) }))
				.filter((d) => Number.isFinite(d.t));
			return {
				id: c.id,
				color: c.color,
				d: linePath(
					thin(data, 200),
					(d) => d.t,
					(d) => d.v,
					csx,
					csy
				)
			};
		});
		return { csx, csy, lines };
	});

	const resChart = $derived.by(() => {
		const startRes = residual(xs, startYs).slice(1, -1);
		// The chart's half-height: most of the starting residual fits (the first few
		// points, where the curve starts, can be far larger; they are cut off).
		const sizes = startRes.map(Math.abs).sort((a, b) => a - b);
		const RES = niceMax(sizes[Math.floor(sizes.length * 0.8)] ?? 1);
		const csx = scale([0, L], [CH.left, CH.right]);
		const csy = scale([-RES, RES], [CH.bottom, CH.top]);
		const data = xs.slice(1, -1).map((x, i) => ({ x, r: clamp(res[i + 1] ?? 0, -RES, RES) }));
		const start = xs.slice(1, -1).map((x, i) => ({ x, r: clamp(startRes[i] ?? 0, -RES, RES) }));
		return {
			csx,
			csy,
			ticks: [-RES, 0, RES],
			d: linePath(
				data,
				(d) => d.x,
				(d) => d.r,
				csx,
				csy
			),
			start: linePath(
				start,
				(d) => d.x,
				(d) => d.r,
				csx,
				csy
			)
		};
	});

	const SN = 0.4; // s/m, the Snell chart's top
	const snellChart = $derived.by(() => {
		const csx = scale([0, L], [CH.left, CH.right]);
		const csy = scale([0, SN], [CH.bottom, CH.top]);
		const lines = curves.map((c) => {
			const pts =
				c.id === 'line'
					? Array.from({ length: 81 }, (_, i) => ({ x: (L * i) / 80, y: (DROP * i) / 80 }))
					: c.pts;
			const data = snell(pts)
				// Off the top of the chart near A (where the bead is still slow) the curve is cut.
				.filter((s) => Number.isFinite(s.value) && s.value <= SN)
				.map((s) => ({ x: s.x, v: s.value }));
			return {
				id: c.id,
				color: c.color,
				d: linePath(
					thin(data, 200),
					(d) => d.x,
					(d) => d.v,
					csx,
					csy
				)
			};
		});
		return { csx, csy, lines, level: 1 / Math.sqrt(4 * G * cyc.r) };
	});

	const dipChart = $derived.by(() => {
		const csx = scale([0.5, 4], [CH.left, CH.right]);
		const csy = scale([0, 1.2], [CH.bottom, CH.top]);
		const data = Array.from({ length: 71 }, (_, i) => {
			const ratio = 0.5 + (3.5 * i) / 70;
			const c = cycloid(ratio * DROP, DROP);
			return { ratio, dip: c.lowest - DROP };
		});
		return {
			csx,
			csy,
			d: linePath(
				data,
				(d) => d.ratio,
				(d) => d.dip,
				csx,
				csy
			)
		};
	});
	const dip = $derived(cyc.lowest - DROP);
	const lowestPt = $derived(cyc.theta > Math.PI ? cyc.at(Math.PI) : null);

	// ---- the times panel ---------------------------------------------------------------
	const PANEL = { x: 668, right: 940, top: 118 };
	const BAR_MAX = 3; // s
	const rows = $derived(
		curves
			.filter((c) => (VISIBLE[phase]?.[c.id] ?? 0) > 0)
			.map((c, i) => ({
				...c,
				y: PANEL.top + 30 + i * 50,
				dim: (VISIBLE[phase]?.[c.id] ?? 0) < 1,
				// Bars fill as the race runs.
				progress: phase === 'snell' || phase === 'descend' ? 1 : Math.min(1, tau / c.T)
			}))
	);
	const lineCurve = $derived(curves[0]);
	const margin = $derived(lineCurve.T - cyc.T);
	const percent = $derived(Math.round((lineCurve.T / cyc.T - 1) * 100));
	const resText = (v: number) => {
		if (!(v > 0)) return '0';
		const e = Math.floor(Math.log10(v));
		if (e >= -1) return v.toFixed(e >= 1 ? 0 : 2);
		const sup = String(e)
			.replace('-', '⁻')
			.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
		return `${(v / 10 ** e).toFixed(1)} × 10${sup}`;
	};

	const A: Point = $derived({ x: sx(0), y: sy(0) });
	const B: Point = $derived({ x: sx(L), y: sy(DROP) });
</script>

<g>
	<!-- the line through A, along which the wheel rolls -->
	<line
		x1={A.x - 24}
		y1={A.y}
		x2={phase === 'dip' ? sx(8) + 16 : B.x + 20}
		y2={A.y}
		stroke="var(--stage-line)"
		stroke-width="1"
		stroke-dasharray="3 5"
		opacity="0.8"
	/>
	<!-- the level of B (where the dip shows) -->
	{#if phase === 'dip'}
		<line
			x1={A.x}
			y1={B.y}
			x2={sx(8) + 16}
			y2={B.y}
			stroke="var(--stage-line)"
			stroke-width="1"
			stroke-dasharray="3 5"
		/>
	{/if}

	<!-- the rolling wheel -->
	{#if phase === 'cycloid'}
		<g opacity="0.55">
			<circle
				cx={wheel.cx}
				cy={wheel.cy}
				r={wheel.r}
				fill="none"
				stroke="var(--cv-cycloid)"
				stroke-width="1.2"
				stroke-dasharray="4 4"
			/>
			<line
				x1={wheel.cx}
				y1={wheel.cy}
				x2={wheel.rim.x}
				y2={wheel.rim.y}
				stroke="var(--cv-cycloid)"
				stroke-width="1.2"
			/>
			<circle cx={wheel.cx} cy={wheel.cy} r="2.5" fill="var(--cv-cycloid)" />
		</g>
	{/if}

	<!-- the curves -->
	{#each curves as c (c.id)}
		{#if opacity(c.id) > 0.01}
			<path
				d={pathOf(c.pts)}
				fill="none"
				stroke={c.color}
				stroke-width={c.id === 'cycloid' && phase === 'descend' ? 2 : 3}
				stroke-dasharray={c.id === 'cycloid' && phase === 'descend' ? '7 5' : undefined}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={opacity(c.id)}
			/>
		{/if}
	{/each}

	<!-- the optimiser's curve, with its 47 free points -->
	{#if phase === 'descend' && current}
		<path
			d={pathOf(startPts)}
			fill="none"
			stroke="var(--cv-opt)"
			stroke-width="1.5"
			stroke-dasharray="2 4"
			opacity="0.6"
		/>
		<path
			d={pathOf(currentPts)}
			fill="none"
			stroke="var(--cv-opt)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		{#each currentPts as p, i (i)}
			{#if i > 0 && i < currentPts.length - 1}
				<circle cx={sx(p.x)} cy={sy(p.y)} r="2.4" fill="var(--cv-opt)" />
			{/if}
		{/each}
	{/if}

	<!-- Snell: the angle from the vertical at three points -->
	{#if phase === 'snell'}
		{#each angles as a (a.key)}
			<line
				x1={a.x}
				y1={a.y}
				x2={a.x}
				y2={a.y + 46}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<line
				x1={a.x}
				y1={a.y}
				x2={a.x + 46 * Math.sin(a.a)}
				y2={a.y + 46 * Math.cos(a.a)}
				stroke="var(--cv-cycloid)"
				stroke-width="1.5"
			/>
			<path
				d="M{a.x} {a.y + 26} A26 26 0 0 0 {a.x + 26 * Math.sin(a.a)} {a.y + 26 * Math.cos(a.a)}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1"
			/>
			<Readout id="phi-{a.key}">
				<Label x={a.x - 6} y={a.y + 40} text="φ = {a.deg}°" size={11} anchor="end" />
			</Readout>
		{/each}
	{/if}

	<!-- the deepest point of the cycloid, when it dips below B -->
	{#if phase === 'dip' && lowestPt}
		<line
			x1={sx(lowestPt.x)}
			y1={B.y}
			x2={sx(lowestPt.x)}
			y2={sy(lowestPt.y)}
			stroke="var(--cv-cycloid)"
			stroke-width="1.5"
		/>
		<Readout id="dip" order={5} label="Dip below B" value="{fmt(dip * 100, 0)} cm">
			<Label
				x={PANEL.x}
				y={PANEL.top + 30 + rows.length * 50 + 64}
				text="the cycloid dips {fmt(dip * 100, 0)} cm below B"
				size={12}
				anchor="start"
				color="var(--cv-cycloid)"
				halo={false}
			/>
		</Readout>
	{:else if phase === 'dip'}
		<Readout id="dip" order={5} label="Dip below B" value="none: L/h < π/2">
			<Label
				x={PANEL.x}
				y={PANEL.top + 30 + rows.length * 50 + 64}
				text="no dip: L/h is below π/2"
				size={12}
				anchor="start"
				color="var(--cv-cycloid)"
				halo={false}
			/>
		</Readout>
	{/if}

	<!-- time dots -->
	{#each dots as d (d.key)}
		<circle
			cx={d.x}
			cy={d.y}
			r={d.big ? 4 : 2.8}
			fill={d.big ? 'var(--stage-bg)' : d.color}
			stroke={d.color}
			stroke-width={d.big ? 2 : 0}
		/>
	{/each}

	<!-- A and B -->
	<circle cx={A.x} cy={A.y} r="5" fill="var(--stage-ink)" />
	<Label x={A.x - 12} y={A.y + 4} text="A" anchor="end" weight={700} size={15} />
	{#if phase === 'dip'}
		<Handle
			x={B.x}
			y={B.y}
			label="End point B"
			value={L}
			min={1}
			max={8}
			valuetext="{L.toFixed(1)} metres across"
			color="var(--stage-ink)"
			onmove={(p: Point) => setParam('span', Math.round(clamp((p.x - ox) / k, 1, 8) * 10) / 10)}
			onkey={(s) =>
				setParam(
					'span',
					s === 'start' ? 1 : s === 'end' ? 8 : Math.round(clamp(L + s * 0.1, 1, 8) * 10) / 10
				)}
		/>
		<Label x={B.x + 14} y={B.y - 12} text="B" weight={700} size={15} anchor="start" />
	{:else}
		<circle cx={B.x} cy={B.y} r="5" fill="var(--stage-ink)" />
		<Label x={B.x + 12} y={B.y + 5} text="B" weight={700} size={15} anchor="start" />
	{/if}
	<Readout id="geometry" order={0} label="Trip" value="{L.toFixed(1)} m across, 2 m down">
		<Label
			x={A.x - 12}
			y={A.y - 18}
			text="{L.toFixed(1)} m across, 2 m down"
			size={11}
			muted
			anchor="start"
		/>
	</Readout>

	<!-- the beads -->
	{#each beads as b (b.id)}
		<circle cx={b.x} cy={b.y} r="7.5" fill={b.color} stroke="var(--stage-bg)" stroke-width="2" />
	{/each}

	<!-- the reader's handles -->
	{#if showHandles}
		{#each depths as d, i (i)}
			<Handle
				x={sx(handleX(i))}
				y={sy(d)}
				label="Control point {i + 1} of your curve"
				value={d}
				min={MIN_DEPTH}
				max={deepest}
				valuetext="{d.toFixed(2)} metres below A"
				color="var(--cv-yours)"
				r={7}
				onmove={(p: Point) => setDepth(i, (p.y - BOX.top) / k)}
				onkey={(s) => setDepth(i, s === 'start' ? MIN_DEPTH : s === 'end' ? deepest : d + s * 0.05)}
			/>
		{/each}
	{/if}

	<!-- the times -->
	<Readout id="title">
		<Label
			x={PANEL.x}
			y={PANEL.top}
			text="Descent time"
			size={15}
			weight={600}
			halo={false}
			anchor="start"
		/>
	</Readout>
	{#if phase === 'time'}
		<Readout id="dots" order={2} label="Dots" value="every 0.1 s; hollow at 0.5 s">
			<Label
				x={PANEL.x}
				y={PANEL.top + 30 + rows.length * 50}
				text="dots every 0.1 s; hollow at 0.5 s"
				size={12}
				muted
				halo={false}
				anchor="start"
			/>
		</Readout>
	{/if}
	{#each rows as r (r.id)}
		<g opacity={r.dim ? 0.55 : 1}>
			<Readout id="time-{r.id}" order={1} label={r.name} value="{fmt(r.T)} s" color={r.color}>
				<line
					x1={PANEL.x}
					y1={r.y - 4}
					x2={PANEL.x + 16}
					y2={r.y - 4}
					stroke={r.color}
					stroke-width="3"
					stroke-linecap="round"
				/>
				<Label x={PANEL.x + 24} y={r.y} text={r.name} size={13} halo={false} anchor="start" />
				<Label
					x={PANEL.right}
					y={r.y}
					text={Number.isFinite(r.T) ? `${fmt(r.T)} s` : 'never arrives'}
					size={13}
					weight={600}
					anchor="end"
					tabular
					halo={false}
				/>
			</Readout>
			<rect
				x={PANEL.x}
				y={r.y + 9}
				width={PANEL.right - PANEL.x}
				height="7"
				rx="3.5"
				fill="var(--stage-grid)"
			/>
			{#if Number.isFinite(r.T)}
				<rect
					x={PANEL.x}
					y={r.y + 9}
					width={((PANEL.right - PANEL.x) * Math.min(r.T, BAR_MAX) * r.progress) / BAR_MAX}
					height="7"
					rx="3.5"
					fill={r.color}
				/>
			{/if}
		</g>
	{/each}

	{#if phase === 'descend' && current}
		{@const y = PANEL.top + 30 + rows.length * 50}
		<Readout
			id="opt"
			order={2}
			label="Optimiser, step {current.k}"
			value="{current.T.toFixed(3)} s"
		>
			<line
				x1={PANEL.x}
				y1={y - 4}
				x2={PANEL.x + 16}
				y2={y - 4}
				stroke="var(--cv-opt)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Label
				x={PANEL.x + 24}
				{y}
				text="optimiser, step {current.k}"
				size={13}
				halo={false}
				anchor="start"
			/>
			<Label
				x={PANEL.right}
				{y}
				text="{current.T.toFixed(3)} s"
				size={13}
				weight={600}
				anchor="end"
				tabular
				halo={false}
			/>
		</Readout>
		<Readout id="worst" order={3} label="Largest residual" value="{resText(current.worst)} s/m²">
			<Label
				x={PANEL.x}
				y={y + 30}
				text="largest residual: {resText(current.worst)} s/m²"
				size={12}
				muted
				tabular
				halo={false}
				anchor="start"
			/>
		</Readout>
	{:else if VISIBLE[phase]?.cycloid === 1}
		{@const y = PANEL.top + 30 + rows.length * 50}
		<Readout id="margin" order={4} label="The line loses by" value="{fmt(margin)} s ({percent} %)">
			<Label
				x={PANEL.x}
				{y}
				text="the line loses by {fmt(margin)} s:"
				size={12}
				halo={false}
				anchor="start"
			/>
			<Label
				x={PANEL.x}
				y={y + 18}
				text="{percent} % slower than the cycloid"
				size={12}
				halo={false}
				anchor="start"
			/>
		</Readout>
	{/if}
	{#if phase === 'snell'}
		<Readout
			id="snell-level"
			order={5}
			label="sin φ / v on the cycloid"
			value="{snellChart.level.toFixed(3)} s/m"
		>
			<Label
				x={PANEL.x}
				y={PANEL.top + 30 + rows.length * 50 + 40}
				text="sin φ / v on the cycloid: {snellChart.level.toFixed(3)} s/m"
				size={12}
				color="var(--cv-cycloid)"
				halo={false}
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- the chart -->
	{#if phase === 'race' || phase === 'time' || phase === 'cycloid'}
		{@const c = speedChart}
		<Axes
			sx={c.csx}
			sy={c.csy}
			xLabel="time (s)"
			yLabel="speed (m/s)"
			yTicks={[0, 2, 4, 6, 8].filter((v) => v <= vMax)}
		/>
		<line
			x1={CH.left}
			x2={CH.right}
			y1={c.csy(speedAt(DROP))}
			y2={c.csy(speedAt(DROP))}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="4 4"
		/>
		<Readout id="end-speed" order={6} label="Speed at B" value="{speedAt(DROP).toFixed(1)} m/s">
			<Label
				x={CH.right}
				y={c.csy(speedAt(DROP)) - 6}
				text="speed at B, {speedAt(DROP).toFixed(1)} m/s"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
		{#each c.lines as l (l.id)}
			<path d={l.d} fill="none" stroke={l.color} stroke-width="2" opacity="0.9" />
		{/each}
		{#each beads as b (b.id)}
			<circle
				cx={c.csx(Math.min(tau, tMax))}
				cy={c.csy(b.speed)}
				r="4"
				fill={b.color}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
	{:else if phase === 'descend'}
		{@const c = resChart}
		<Axes
			sx={c.csx}
			sy={c.csy}
			xLabel="x (m)"
			yLabel="residual (s/m²)"
			yTicks={c.ticks}
			yFormat={(v) => String(v).replace('-', '−')}
		/>
		<path
			d={c.start}
			fill="none"
			stroke="var(--cv-opt)"
			stroke-width="1.2"
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
		<path d={c.d} fill="none" stroke="var(--cv-opt)" stroke-width="2.2" />
	{:else if phase === 'snell'}
		{@const c = snellChart}
		<Axes
			sx={c.csx}
			sy={c.csy}
			xLabel="x (m)"
			yLabel="sin φ / v (s/m)"
			yTicks={[0, 0.1, 0.2, 0.3, 0.4]}
		/>
		{#each c.lines as l (l.id)}
			<path
				d={l.d}
				fill="none"
				stroke={l.color}
				stroke-width={l.id === 'cycloid' ? 3 : 2}
				opacity={l.id === 'cycloid' ? 1 : 0.85}
			/>
		{/each}
	{:else if phase === 'dip'}
		{@const c = dipChart}
		<Axes sx={c.csx} sy={c.csy} xLabel="L / h" yLabel="dip below B (m)" yTicks={[0, 0.5, 1]} />
		<line
			x1={c.csx(Math.PI / 2)}
			x2={c.csx(Math.PI / 2)}
			y1={CH.top}
			y2={CH.bottom}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="4 4"
		/>
		<Label x={c.csx(Math.PI / 2) + 6} y={CH.top + 10} text="π/2" size={12} anchor="start" />
		<path d={c.d} fill="none" stroke="var(--cv-cycloid)" stroke-width="2.4" />
		<circle
			cx={c.csx(L / DROP)}
			cy={c.csy(Math.max(0, dip))}
			r="5.5"
			fill="var(--cv-cycloid)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout id="ratio" order={4} label="L / h" value={(L / DROP).toFixed(2)}>
			<Label
				x={c.csx(L / DROP) + 9}
				y={c.csy(Math.max(0, dip)) - 14}
				text="L/h = {(L / DROP).toFixed(2)}"
				size={12}
				tabular
				anchor="start"
			/>
		</Readout>
	{/if}
</g>
