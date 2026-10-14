<script lang="ts">
	/**
	 * The flat map: satellites and a receiver in one plane, so distances are circles.
	 *
	 * Phases (`step.hints.phase`):
	 *   one   — one satellite, its pulses and its circle of distance
	 *   tri   — `params.nsat` satellites: two circles cross twice, three once
	 *   clock — three satellites, the receiver's clock off by `params.clockErr` ms: every
	 *           circle grows by the same c·b; the cross is the fix of a receiver that trusts
	 *           its clock (least squares for east and north only)
	 *   solve — the same, plus (with `params.solveClock`) the fix that solves for the clock:
	 *           the circles shrink back by the solved error and meet at the receiver
	 *
	 * The receiver and the satellites are dragged; their places are kept in hidden params
	 * (`gps:rx`, `gps:sats`) so they survive step changes. The map is 12 000 km across
	 * (20 km per unit). The pulses are slowed down (160 units a second instead of 15 000)
	 * and are a pure function of t; under reduced motion only the circles are drawn.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, clamp, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, pseudoranges, solve } from '../model';
	import DragPoint from './DragPoint.svelte';
	import Sat from './Sat.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'one'));

	// ---- the map ------------------------------------------------------------------------------
	const MX0 = 16;
	const MY0 = 16;
	const MW = 600;
	const MH = 568;
	const KM = 20; // km per unit
	const M = KM * 1000; // metres per unit
	const COLORS = ['var(--gps-s1)', 'var(--gps-s2)', 'var(--gps-s3)'];
	const NAMES = ['A', 'B', 'C'];

	const inMap = (p: Point): Point => ({
		x: clamp(Math.round(p.x), MX0 + 14, MX0 + MW - 14),
		y: clamp(Math.round(p.y), MY0 + 14, MY0 + MH - 14)
	});

	// ---- places (hidden params) ------------------------------------------------------------------
	const DEFAULT_SATS: Point[] = [
		{ x: 110, y: 250 },
		{ x: 560, y: 190 },
		{ x: 300, y: 545 }
	];
	const parsePt = (s: string): Point | null => {
		const [x, y] = s.split(',').map(Number);
		return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
	};
	const rx = $derived.by<Point>(() => {
		const raw = params['gps:rx'];
		return (typeof raw === 'string' && parsePt(raw)) || { x: 330, y: 340 };
	});
	const sats = $derived.by<Point[]>(() => {
		const raw = params['gps:sats'];
		if (typeof raw !== 'string') return DEFAULT_SATS;
		const pts = raw.split(';').map(parsePt);
		return pts.length === 3 && pts.every(Boolean) ? (pts as Point[]) : DEFAULT_SATS;
	});
	const fmt = (p: Point) => `${p.x},${p.y}`;
	function moveRx(p: Point) {
		setParam('gps:rx', fmt(inMap(p)));
	}
	function moveSat(i: number, p: Point) {
		const next = sats.map((s, j) => (j === i ? inMap(p) : s));
		setParam('gps:sats', next.map(fmt).join(';'));
	}

	// ---- what is measured ---------------------------------------------------------------------
	const n = $derived(
		phase === 'one' ? 1 : phase === 'tri' ? clamp(Math.round(Number(params.nsat ?? 2)), 1, 3) : 3
	);
	const clockMs = $derived(
		phase === 'clock' || phase === 'solve' ? Number(params.clockErr ?? 0) : 0
	);
	/** The clock error as a distance (units), tweened so that step changes grow the circles. */
	const bias = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const b = (clockMs * 1e-3 * C) / M;
		untrack(() => bias.set(b, { duration: reduced ? 0 : 400 }));
	});
	const solving = $derived(phase === 'solve' && Boolean(params.solveClock));
	const solveW = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const on = solving ? 1 : 0;
		untrack(() => solveW.set(on, { duration: reduced ? 0 : 900 }));
	});

	const used = $derived(sats.slice(0, n));
	const trueR = $derived(used.map((s) => Math.hypot(s.x - rx.x, s.y - rx.y)));
	const measured = $derived(trueR.map((r) => r + bias.current));

	// Fixes, in metres on the map (the solver does not care which way y points).
	const toM = (p: Point) => [p.x * M, p.y * M];
	const start = $derived.by(() => {
		const c = used.reduce((a, s) => ({ x: a.x + s.x / n, y: a.y + s.y / n }), { x: 0, y: 0 });
		return toM(c);
	});
	const ranges = $derived(pseudoranges(used.map(toM), toM(rx), clockMs * 1e-3 * C));
	const trusting = $derived(
		n === 3 ? solve(used.map(toM), ranges, { solveClock: false, start }) : null
	);
	const solved = $derived(
		n === 3 ? solve(used.map(toM), ranges, { solveClock: true, start }) : null
	);
	const ptOf = (v: number[] | undefined): Point | null => (v ? { x: v[0] / M, y: v[1] / M } : null);
	const trustPt = $derived(ptOf(trusting?.pos));
	const solvedPt = $derived(ptOf(solved?.pos));
	const kmOff = (p: Point | null) => (p ? Math.hypot(p.x - rx.x, p.y - rx.y) * KM : NaN);
	/** Circles drawn: measured, shrunk back by the solved clock error as the toggle comes on. */
	const shown = $derived(
		measured.map((r) => r - solveW.current * (solved ? solved.clock / M : bias.current))
	);

	// Two circles cross at two points (for the "two satellites" frame).
	const crossings = $derived.by<Point[]>(() => {
		if (n !== 2) return [];
		const [a, b] = used;
		const [r0, r1] = trueR;
		const d = Math.hypot(b.x - a.x, b.y - a.y);
		if (d < 1e-6 || d > r0 + r1 || d < Math.abs(r0 - r1)) return [];
		const l = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
		const h = Math.sqrt(Math.max(0, r0 * r0 - l * l));
		const ux = (b.x - a.x) / d;
		const uy = (b.y - a.y) / d;
		const mx = a.x + l * ux;
		const my = a.y + l * uy;
		return [
			{ x: mx - h * uy, y: my + h * ux },
			{ x: mx + h * uy, y: my - h * ux }
		];
	});

	// ---- pulses -----------------------------------------------------------------------------
	const V = 160; // units per second
	const PERIOD = 3.2;
	const pulses = $derived.by(() => {
		if (reduced) return [];
		const out: { i: number; k: number; r: number; o: number }[] = [];
		for (let i = 0; i < n; i++) {
			const max = trueR[i] + 60;
			for (let k = 0; k < 2; k++) {
				const age = cycle(t, PERIOD, i * 0.37 + k * 0.5) * PERIOD;
				const r = age * V;
				if (r > max) continue;
				out.push({ i, k, r, o: 0.75 * smoothstep(0, 20, r) * (1 - smoothstep(max - 60, max, r)) });
			}
		}
		return out;
	});
	/** The receiver lights up for a moment as each pulse reaches it. */
	const ping = $derived.by(() => {
		let best = 0;
		for (const p of pulses) {
			const d = p.r - trueR[p.i];
			if (d >= 0 && d < 40) best = Math.max(best, 1 - d / 40);
		}
		return best;
	});

	// ---- readouts -----------------------------------------------------------------------------
	const ms = (units: number) => ((units * M) / C) * 1e3;
	const km = (units: number) => Math.round(units * KM).toLocaleString('en-US');
	const kmText = (v: number) =>
		!Number.isFinite(v)
			? '—'
			: v < 0.5
				? 'on the spot'
				: `${Math.round(v).toLocaleString('en-US')} km off`;
	const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;

	const meetText = $derived(
		n === 1 ? 'anywhere on the circle' : n === 2 ? `${crossings.length} points` : 'one point'
	);
	const caption = $derived(
		phase === 'one'
			? 'One distance: a circle'
			: phase === 'tri'
				? n === 3
					? 'Three distances: one point'
					: n === 2
						? 'Two distances: two points'
						: 'One distance: a circle'
				: phase === 'clock'
					? clockMs === 0
						? 'Clock right: the circles meet'
						: 'Clock wrong: no common point'
					: solving
						? 'Clock solved: they meet again'
						: clockMs === 0
							? 'Clock right: the circles meet'
							: 'Clock wrong: no common point'
	);

	// The receiver's label and the trusting fix's label sit on opposite sides, along the line
	// between them, so they never overlap.
	const showTrust = $derived(
		Boolean(trustPt) && (phase === 'clock' || phase === 'solve') && clockMs !== 0
	);
	const away = $derived.by(() => {
		if (!showTrust || !trustPt) return { x: 0, y: 1 };
		const dx = trustPt.x - rx.x;
		const dy = trustPt.y - rx.y;
		const d = Math.hypot(dx, dy);
		return d < 1 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d };
	});
	// Text anchored at its start (end) runs right (left) of the point: keep it inside the map.
	const labelAt = (p: Point, dir: Point, gap: number): Point => ({
		x: clamp(
			p.x + dir.x * gap,
			MX0 + (dir.x < -0.35 ? 110 : 60),
			MX0 + MW - (dir.x > 0.35 ? 110 : 60)
		),
		y: clamp(p.y + dir.y * gap + 4, MY0 + 16, MY0 + MH - 10)
	});
	const anchorFor = (dir: Point) => (dir.x > 0.35 ? 'start' : dir.x < -0.35 ? 'end' : 'middle');
	const rxLabel = $derived(
		showTrust ? labelAt(rx, { x: -away.x, y: -away.y }, 30) : labelAt(rx, { x: 0, y: 1 }, 22)
	);
	// Clear of the solved fix's crosshair (25 units round the receiver).
	const trustLabel = $derived(
		trustPt
			? labelAt(trustPt, away, Math.max(16, 36 - Math.hypot(trustPt.x - rx.x, trustPt.y - rx.y)))
			: { x: 0, y: 0 }
	);

	// Labels for the satellites: above them unless that leaves the map.
	const satLabelY = (s: Point) => (s.y < MY0 + 40 ? s.y + 30 : s.y - 18);

	const PX = 640; // panel
	const PW = 304;
</script>

<g>
	<defs>
		<clipPath id="gps-plane-clip">
			<rect x={MX0} y={MY0} width={MW} height={MH} rx="10" />
		</clipPath>
	</defs>

	<!-- the map -->
	<rect
		x={MX0}
		y={MY0}
		width={MW}
		height={MH}
		rx="10"
		fill="var(--gps-map)"
		stroke="var(--stage-line)"
	/>
	<g clip-path="url(#gps-plane-clip)">
		{#each Array.from({ length: 12 }, (_, i) => i + 1) as i (i)}
			<path d="M{MX0 + i * 50} {MY0}v{MH}" stroke="var(--stage-grid)" stroke-width="1" />
		{/each}
		{#each Array.from({ length: 11 }, (_, i) => i + 1) as i (i)}
			<path d="M{MX0} {MY0 + i * 50}h{MW}" stroke="var(--stage-grid)" stroke-width="1" />
		{/each}

		<!-- pulses: the signal spreading out from each satellite -->
		{#each pulses as p (`${p.i}-${p.k}`)}
			<circle
				cx={used[p.i].x}
				cy={used[p.i].y}
				r={p.r}
				fill="none"
				stroke={COLORS[p.i]}
				stroke-width="2"
				opacity={p.o * 0.6}
			/>
		{/each}

		<!-- the measured circles (dashed) and, when solving, the corrected ones -->
		{#each used as s, i (i)}
			{#if solveW.current > 0.01}
				<circle
					cx={s.x}
					cy={s.y}
					r={Math.max(0, measured[i])}
					fill="none"
					stroke={COLORS[i]}
					stroke-width="1.2"
					stroke-dasharray="4 5"
					opacity={0.55 * solveW.current}
				/>
			{/if}
			<circle
				cx={s.x}
				cy={s.y}
				r={Math.max(0, shown[i])}
				fill="none"
				stroke={COLORS[i]}
				stroke-width="2.2"
			/>
		{/each}
	</g>

	<!-- the two candidate points -->
	{#each crossings as c, i (i)}
		<circle
			cx={c.x}
			cy={c.y}
			r="9"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<Readout id="cand-{i}">
			<Label
				x={c.x}
				y={Math.hypot(c.x - rx.x, c.y - rx.y) < 2 ? c.y - 18 : c.y + (c.y > rx.y ? 28 : -18)}
				text={Math.hypot(c.x - rx.x, c.y - rx.y) < 2 ? 'here?' : 'or here?'}
				size={12}
			/>
		</Readout>
	{/each}

	<!-- fixes -->
	{#if trustPt && showTrust}
		<g clip-path="url(#gps-plane-clip)" style:pointer-events="none">
			<path
				d="M{trustPt.x - 8} {trustPt.y - 8}l16 16m-16 0l16 -16"
				stroke="var(--gps-trust)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d="M{rx.x} {rx.y}L{trustPt.x} {trustPt.y}"
				stroke="var(--gps-trust)"
				stroke-width="1.2"
				stroke-dasharray="2 3"
			/>
		</g>
		<Readout id="trust-tag">
			<Label
				x={trustLabel.x}
				y={trustLabel.y}
				text="trusts its clock"
				anchor={anchorFor(away)}
				size={12}
				color="var(--gps-trust)"
			/>
		</Readout>
	{/if}
	{#if solvedPt && solveW.current > 0.5}
		<g transform="translate({solvedPt.x} {solvedPt.y})" opacity={solveW.current}>
			<circle r="13" fill="none" stroke="var(--gps-fix)" stroke-width="2.5" />
			<path d="M-19 0h-6M19 0h6M0 -19v-6M0 19v6" stroke="var(--gps-fix)" stroke-width="2.5" />
		</g>
	{/if}

	<!-- satellites -->
	{#each used as s, i (i)}
		<Sat x={s.x} y={s.y} color={COLORS[i]} />
		<Readout id="sat-{i}">
			<Label x={s.x} y={satLabelY(s)} text="satellite {NAMES[i]}" size={12} color={COLORS[i]} />
		</Readout>
		<DragPoint
			x={s.x}
			y={s.y}
			label="Satellite {NAMES[i]}"
			valuetext="{km(s.x - MX0)} km east, {km(MY0 + MH - s.y)} km north"
			color={COLORS[i]}
			onmove={(p: Point) => moveSat(i, p)}
			onkey={(dx, dy) => moveSat(i, { x: s.x + dx * 5, y: s.y + dy * 5 })}
		/>
	{/each}
	{#if phase === 'one'}
		<Readout id="msg">
			<Label
				x={clamp(used[0].x, MX0 + 150, MX0 + MW - 150)}
				y={used[0].y < MY0 + 40 ? used[0].y + 52 : used[0].y + 32}
				text="“I am here, and it is 12:00:00.000 000”"
				size={12}
				pill
			/>
		</Readout>
	{/if}

	<!-- the receiver -->
	<g style:pointer-events="none">
		<circle
			cx={rx.x}
			cy={rx.y}
			r={10 + 14 * ping}
			fill="none"
			stroke="var(--gps-rx)"
			stroke-width="2"
			opacity={ping}
		/>
		<circle
			cx={rx.x}
			cy={rx.y}
			r="7"
			fill="var(--gps-rx)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	</g>
	<Readout id="rx-tag">
		<Label
			x={rxLabel.x}
			y={rxLabel.y}
			text="receiver"
			anchor={showTrust ? anchorFor({ x: -away.x, y: -away.y }) : 'middle'}
			size={12}
			color="var(--gps-rx)"
		/>
	</Readout>
	<DragPoint
		x={rx.x}
		y={rx.y}
		label="Receiver"
		valuetext="{km(rx.x - MX0)} km east, {km(MY0 + MH - rx.y)} km north"
		color="var(--gps-rx)"
		onmove={moveRx}
		onkey={(dx, dy) => moveRx({ x: rx.x + dx * 5, y: rx.y + dy * 5 })}
	/>

	<!-- scale bar -->
	<Readout id="scale">
		<path
			d="M{MX0 + 18} {MY0 + MH - 18}h100"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			style:pointer-events="none"
		/>
		<Label x={MX0 + 68} y={MY0 + MH - 26} text="2 000 km" size={11} muted />
	</Readout>

	<!-- panel (its card is hidden on phones, where the readouts move under the stage) -->
	<Readout id="panel">
		<rect
			x={PX}
			y={MY0}
			width={PW}
			height={MH}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/></Readout
	>
	<Readout id="caption" order={0} label="Now" value={caption}>
		<text x={PX + 18} y={52} style:font-size="15px" font-weight="600">{caption}</text>
	</Readout>

	{#if phase === 'one'}
		<Readout id="time" order={1} label="Signal travel time" value="{ms(trueR[0]).toFixed(1)} ms">
			<text x={PX + 18} y={96} class="muted" style:font-size="12px">Signal travel time</text>
			<text x={PX + 18} y={120} style:font-size="16px" font-weight="600"
				>{ms(trueR[0]).toFixed(1)} ms</text
			>
		</Readout>
		<Readout id="dist" order={2} label="Distance = time × speed of light" value="{km(trueR[0])} km">
			<text x={PX + 18} y={156} class="muted" style:font-size="12px"
				>Distance = time × speed of light</text
			>
			<text x={PX + 18} y={180} style:font-size="16px" font-weight="600">{km(trueR[0])} km</text>
		</Readout>
		<Readout id="hint">
			<text x={PX + 18} y={MY0 + MH - 46} class="muted" style:font-size="12px"
				>Drag the receiver or the satellite.</text
			>
			<text x={PX + 18} y={MY0 + MH - 28} class="muted" style:font-size="12px"
				>Pulses slowed down 100 000 times.</text
			>
		</Readout>
	{:else}
		{#each used.map((_, j) => j) as i (i)}
			<!-- On phones the ranges are listed only on the trilateration step (≤ 4 rows a step). -->
			<Readout
				id="range-{i}"
				order={1 + i}
				label={phase === 'tri' ? `Range to ${NAMES[i]}` : undefined}
				value={phase === 'tri' ? `${km(measured[i])} km` : undefined}
				color={COLORS[i]}
			>
				<circle cx={PX + 24} cy={92 + i * 28} r="5" fill={COLORS[i]} />
				<text x={PX + 38} y={96 + i * 28} style:font-size="13px">Range to {NAMES[i]}</text>
				<text x={PX + PW - 18} y={96 + i * 28} text-anchor="end" style:font-size="13px"
					>{km(measured[i])} km</text
				>
			</Readout>
		{/each}
		{#if phase === 'tri'}
			<Readout id="meet" order={5} label="Circles meet at" value={meetText}>
				<text x={PX + 18} y={200} class="muted" style:font-size="12px">Circles meet at</text>
				<text x={PX + 18} y={224} style:font-size="16px" font-weight="600">{meetText}</text>
			</Readout>
			<Readout id="hint">
				<text x={PX + 18} y={MY0 + MH - 28} class="muted" style:font-size="12px"
					>Drag the receiver or any satellite.</text
				>
			</Readout>
		{:else}
			<Readout id="clk" order={5}>
				<text x={PX + 18} y={200} class="muted" style:font-size="12px"
					>Receiver clock error → added to every range</text
				>
				<text x={PX + 18} y={224} style:font-size="16px" font-weight="600"
					>{clockMs === 0
						? 'exact'
						: `${signed(clockMs)} ms → ${bias.current >= 0 ? '+' : '−'}${km(Math.abs(bias.current))} km`}</text
				>
			</Readout>
			<Readout
				id="trust"
				order={6}
				label="Trusting its clock"
				value={kmText(kmOff(trustPt))}
				color="var(--gps-trust)"
			>
				<path
					d="M{PX + 19} {268}l10 10M{PX + 19} {278}l10 -10"
					stroke="var(--gps-trust)"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
				<text x={PX + 38} y={278} style:font-size="13px">Trusting its clock</text>
				<text x={PX + PW - 18} y={278} text-anchor="end" style:font-size="13px" font-weight="600"
					>{kmText(kmOff(trustPt))}</text
				>
			</Readout>
			{#if phase === 'solve'}
				<Readout
					id="solved"
					order={7}
					label="Solving for its clock"
					value={solving ? kmText(kmOff(solvedPt)) : 'off'}
					color="var(--gps-fix)"
				>
					<circle
						cx={PX + 24}
						cy={308}
						r="6"
						fill="none"
						stroke="var(--gps-fix)"
						stroke-width="2.2"
					/>
					<text x={PX + 38} y={312} style:font-size="13px">Solving for its clock</text>
					<text x={PX + PW - 18} y={312} text-anchor="end" style:font-size="13px" font-weight="600"
						>{solving ? kmText(kmOff(solvedPt)) : 'off'}</text
					>
				</Readout>
				{#if solving && solved}
					<Readout
						id="found"
						order={8}
						label="Clock error found"
						value="{signed((solved.clock / C) * 1e3)} ms"
					>
						<text x={PX + 18} y={350} class="muted" style:font-size="12px">Clock error found</text>
						<text x={PX + 18} y={374} style:font-size="16px" font-weight="600"
							>{signed((solved.clock / C) * 1e3)} ms</text
						>
					</Readout>
				{/if}
			{/if}
			<Readout id="hint">
				<text x={PX + 18} y={MY0 + MH - 28} class="muted" style:font-size="12px"
					>Drag the receiver or any satellite.</text
				>
			</Readout>
		{/if}
	{/if}
</g>
