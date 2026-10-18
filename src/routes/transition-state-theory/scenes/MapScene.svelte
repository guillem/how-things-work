<script lang="ts">
	/**
	 * The potential-energy surface as a contour map (left), the three atoms on their line (top
	 * right), the energies and the outcome (right), and a chart (bottom right): the energy along
	 * the path of least energy (`surface` view) or the two bond lengths against time.
	 *
	 * Hints (see ../steps.ts): `reaction` (`h-h2`, `f-h2`, `h-hf`), `view` (`surface`, `shot`,
	 * `pass`), `ctl` (prefix of the step's energy controls).
	 *
	 * The fan of 24 trajectories (one per phase of the molecule's swing) is computed when the
	 * reaction or the energies change; the shown shot is one of them, picked by the "Fire again"
	 * count. Its animation is a pure function of t: the trajectory's samples are played at a
	 * rate that fits it into about seven seconds, then held, then replayed. Reduced motion: the
	 * whole trajectory. In the `surface` view a point slides back and forth along the path of
	 * least energy, and the atoms follow it.
	 */
	import { Axes, Label, cycle, pingpong, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { saddleOf, type Surface } from '../leps';
	import {
		DT_SAMPLE,
		FAN,
		NEAR_PASS,
		REACTIONS,
		barrier,
		fire,
		masses,
		reactantBond,
		vibEnergy,
		type ReactionId,
		type Trajectory
	} from '../trajectory';
	import { minimumPath } from '../rate';
	import { contours, toX, toY, type MapBox } from '../contours';

	let { step, t, params, reduced }: StageProps = $props();

	const hints = $derived(step.hints ?? {});
	const rid = $derived(String(hints.reaction ?? 'h-h2') as ReactionId);
	const view = $derived(String(hints.view ?? 'shot'));
	const ctl = $derived(String(hints.ctl ?? 'h'));
	const R = $derived(REACTIONS[rid]);
	const S = $derived(R.surface);
	const DEFAULT_TRANS: Record<string, number> = { h: 0.45, f: 0.1, l: 1.6 };
	const trans = $derived(Number(params[`${ctl}Trans`] ?? DEFAULT_TRANS[ctl] ?? 0.4));
	const vib = $derived(Math.round(Number(params[`${ctl}V`] ?? 0)));
	const fires = $derived(Number(params.fire ?? 0));
	const surfaceView = $derived(view === 'surface');

	// ---- the map ---------------------------------------------------------------------
	const MAP = { x: 96, y: 40, w: 420, h: 420 };
	const boxOf = (s: Surface): MapBox => ({
		...MAP,
		r1: s.id === 'h3' ? [0.4, 3.4] : [0.6, 3.6],
		r2: [0.4, 3.4]
	});
	const box = $derived(boxOf(S));
	/** Energies are measured from the floor of the deepest valley of the surface. */
	const floorOf = (s: Surface) => -Math.max(s.xy.D, s.yz.D);
	const LEVELS: Record<Surface['id'], number[]> = {
		h3: [0.1, 0.25, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5],
		fh2: [0.15, 0.4, 0.7, 1, 1.25, 1.6, 1.8, 2.1, 2.5, 3, 3.5, 4, 4.5, 5, 5.6]
	};
	// a plain cache of computed maps, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const mapCache = new Map<
		string,
		{ lines: { level: number; d: string }[]; pass: string; path: { x: number; y: number }[] }
	>();
	const map = $derived.by(() => {
		let m = mapCache.get(S.id);
		if (!m) {
			const b = boxOf(S);
			const zero = floorOf(S);
			const sd = saddleOf(S);
			const lines = contours(S, b, LEVELS[S.id], zero);
			const [pass] = contours(S, b, [sd.v - zero], zero, 160);
			const path = minimumPath(S).map((p) => ({ x: toX(b, p.r1), y: toY(b, p.r2) }));
			m = { lines, pass: pass.d, path };
			mapCache.set(S.id, m);
		}
		return m;
	});
	const maxLevel = $derived(LEVELS[S.id][LEVELS[S.id].length - 1]);
	const lineColor = (level: number) =>
		`color-mix(in oklab, var(--tst-high) ${Math.round((level / maxLevel) * 100)}%, var(--tst-low))`;
	const pathD = $derived(
		map.path
			.filter((_, i) => i % 3 === 0)
			.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join('')
	);
	const sx = $derived(scale(box.r1, [MAP.x, MAP.x + MAP.w]));
	const sy = $derived(scale(box.r2, [MAP.y + MAP.h, MAP.y]));
	const sd = $derived(saddleOf(S));
	const sdX = $derived(toX(box, sd.r1));
	const sdY = $derived(toY(box, sd.r2));
	const unitPx = MAP.w / 3; // drawing units per Å on the map

	const names = $derived(
		S.id === 'h3'
			? { x: 'H', y: 'H', z: 'H', bottom: 'H + H₂', left: 'H₂ + H' }
			: { x: 'F', y: 'H', z: 'H', bottom: 'F + H₂', left: 'HF + H' }
	);
	const xLabel = $derived(S.id === 'h3' ? 'r₁ (Å)' : 'r₁: F–H (Å)');
	const yLabel = $derived(S.id === 'h3' ? 'r₂ (Å)' : 'r₂: H–H (Å)');

	// ---- the fan and the shot ----------------------------------------------------------
	const fan = $derived.by((): Trajectory[] => {
		if (surfaceView) return [];
		const out: Trajectory[] = [];
		for (let i = 0; i < FAN; i++) out.push(fire(R, { trans, v: vib, phase: (i + 0.5) / FAN }));
		return out;
	});
	const hits = $derived(fan.filter((f) => f.reacted).length);
	/**
	 * The shots step through the phases 7 apart; the first one starts where the outcome is the
	 * fan's majority, so the opening shot shows what usually happens.
	 */
	const firstIndex = $derived.by(() => {
		const majority = hits * 2 >= FAN;
		for (let n = 0; n < FAN; n++) {
			const i = (5 + n * 7) % FAN;
			if (fan[i]?.reacted === majority) return i;
		}
		return 5;
	});
	const shotIndex = $derived((((firstIndex + fires * 7) % FAN) + FAN) % FAN);
	const shot = $derived(fan.length ? fan[shotIndex] : null);
	const trajD = (tr: Trajectory, upTo: number, every: number) => {
		let d = '';
		for (let i = 0; i <= upTo; i += every)
			d += `${d ? 'L' : 'M'}${toX(box, tr.r1[i]).toFixed(1)} ${toY(box, tr.r2[i]).toFixed(1)}`;
		return d;
	};
	const fanPaths = $derived(
		fan.map((f, i) => ({ i, d: trajD(f, f.n - 1, 4), reacted: f.reacted }))
	);

	/** Playback: about 6 s for the whole trajectory (at least 12 fs a second), then a pause. */
	const play = $derived.by(() => {
		if (!shot) return { k: 0, done: true };
		const totalFs = (shot.n - 1) * DT_SAMPLE;
		const rate = Math.max(12, totalFs / 6);
		const runS = totalFs / rate;
		if (reduced) return { k: shot.n - 1, done: true };
		const tt = cycle(t, runS + 2.5) * (runS + 2.5);
		const k = Math.min(shot.n - 1, Math.floor((tt * rate) / DT_SAMPLE));
		return { k, done: k >= shot.n - 1 };
	});
	const k = $derived(play.k);
	const shotD = $derived(shot ? trajD(shot, k, 1) : '');
	const timeFs = $derived(k * DT_SAMPLE);
	/** Time spent within NEAR_PASS of the pass, up to the shown sample (fs). */
	const nearSoFar = $derived.by(() => {
		if (!shot) return 0;
		let c = 0;
		for (let i = 0; i <= k; i++)
			if (Math.hypot(shot.r1[i] - sd.r1, shot.r2[i] - sd.r2) < NEAR_PASS) c++;
		return c * DT_SAMPLE;
	});

	// ---- the point on the path (surface view) -------------------------------------------
	const pathData = $derived.by(() => {
		const p = minimumPath(S);
		const zero = -reactantBond(R).pair.D;
		const s: number[] = [0];
		for (let i = 1; i < p.length; i++)
			s.push(s[i - 1] + Math.hypot(p[i].r1 - p[i - 1].r1, p[i].r2 - p[i - 1].r2));
		return { p, s, e: p.map((q) => q.v - zero) };
	});
	const slide = $derived(reduced ? 0.5 : pingpong(t, 10, 0.25));
	const pathIndex = $derived.by(() => {
		const { p, s } = pathData;
		// the middle of the path is the pass: map 0.5 to the pass's index
		const top = pathData.e.indexOf(Math.max(...pathData.e));
		const target =
			slide < 0.5
				? (slide / 0.5) * s[top]
				: s[top] + ((slide - 0.5) / 0.5) * (s[s.length - 1] - s[top]);
		let i = 0;
		while (i < p.length - 1 && s[i] < target) i++;
		return i;
	});

	// ---- the current geometry --------------------------------------------------------------
	const geom = $derived.by(() => {
		if (surfaceView) {
			const q = pathData.p[pathIndex];
			return { r1: q.r1, r2: q.r2 };
		}
		if (!shot) return { r1: 3, r2: 0.74 };
		return { r1: shot.r1[k], r2: shot.r2[k] };
	});
	const STRIP = { x: 560, y: 58, w: 384, cy: 92 };
	const atomPx = 36;
	const atoms = $derived.by(() => {
		const m = masses(R);
		const M = m[0] + m[1] + m[2];
		const xs = [-geom.r1, 0, geom.r2];
		const com = (xs[0] * m[0] + xs[2] * m[2]) / M;
		const cx = STRIP.x + STRIP.w / 2;
		const el = [names.x, names.y, names.z];
		return xs.map((x, i) => ({
			i,
			x: cx + (x - com) * atomPx,
			el: el[i],
			r: el[i] === 'F' ? 15 : 10
		}));
	});
	const bonded = (r: number, re: number) => r < re * 1.45;

	// ---- energies --------------------------------------------------------------------------
	const ev = $derived(vibEnergy(R, vib));
	const pass = $derived(barrier(R));
	const passText = $derived(pass.toFixed(pass < 0.1 ? 3 : 2));
	const outcome = $derived(
		!shot ? '' : shot.reacted ? `Crossed: ${products(rid)}` : `No reaction: ${reactants(rid)}`
	);
	function products(id: ReactionId) {
		return id === 'h-h2' ? 'H₂ + H' : id === 'f-h2' ? 'HF + H' : 'H₂ + F';
	}
	function reactants(id: ReactionId) {
		return id === 'h-h2' ? 'H + H₂' : id === 'f-h2' ? 'F + H₂' : 'H + HF';
	}
	const molecule = $derived(rid === 'h-hf' ? 'HF' : 'H₂');

	// ---- the chart -------------------------------------------------------------------------
	const CHART = { x: 618, y: 340, w: 300, h: 170 };
	const profX = $derived(
		scale([0, pathData.s[pathData.s.length - 1]], [CHART.x, CHART.x + CHART.w])
	);
	const profY = $derived(
		scale(rid === 'h-h2' ? [0, 0.5] : [-1.5, 0.25], [CHART.y + CHART.h, CHART.y])
	);
	const profD = $derived.by(() => {
		const { s, e } = pathData;
		let d = '';
		for (let i = 0; i < s.length; i += 2)
			d += `${d ? 'L' : 'M'}${profX(s[i]).toFixed(1)} ${profY(e[i]).toFixed(1)}`;
		return d;
	});
	const totalFs = $derived(shot ? (shot.n - 1) * DT_SAMPLE : 100);
	const tX = $derived(scale([0, Math.max(50, totalFs)], [CHART.x, CHART.x + CHART.w]));
	const rY = scale([0, 4.5], [CHART.y + CHART.h, CHART.y]);
	const bondD = (arr: Float64Array | undefined) => {
		if (!arr) return '';
		let d = '';
		const every = Math.max(1, Math.ceil(k / 300));
		for (let i = 0; i <= k; i += every)
			d += `${d ? 'L' : 'M'}${tX(i * DT_SAMPLE).toFixed(1)} ${rY(Math.min(4.5, arr[i])).toFixed(1)}`;
		return d;
	};
	const r1D = $derived(bondD(shot?.r1));
	const r2D = $derived(bondD(shot?.r2));
</script>

<g>
	<defs>
		<clipPath id="tst-map-clip">
			<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} />
		</clipPath>
		<clipPath id="tst-strip-clip">
			<rect x={STRIP.x - 8} y={STRIP.y - 20} width={STRIP.w + 16} height="80" />
		</clipPath>
	</defs>

	<!-- ===== the map ===== -->
	<rect
		x={MAP.x}
		y={MAP.y}
		width={MAP.w}
		height={MAP.h}
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Axes {sx} {sy} {xLabel} {yLabel} xTicks={[1, 2, 3]} yTicks={[1, 2, 3]} grid={false} />
	<g clip-path="url(#tst-map-clip)">
		{#each map.lines as line (line.level)}
			<path
				d={line.d}
				fill="none"
				stroke={lineColor(line.level)}
				stroke-width="1.1"
				opacity="0.85"
			/>
		{/each}
		<path
			d={map.pass}
			fill="none"
			stroke="var(--tst-pass)"
			stroke-width="1.2"
			stroke-dasharray="4 3"
			opacity="0.7"
		/>
		<path
			d={pathD}
			fill="none"
			stroke="var(--tst-path)"
			stroke-width="1.6"
			stroke-dasharray="7 5"
			opacity={surfaceView ? 0.9 : 0.4}
		/>
		{#if view === 'pass'}
			<circle
				cx={sdX}
				cy={sdY}
				r={NEAR_PASS * unitPx}
				fill="var(--tst-region)"
				stroke="var(--tst-pass)"
				stroke-width="1"
			/>
		{/if}
		{#each fanPaths as f (f.i)}
			<path
				d={f.d}
				fill="none"
				stroke={f.reacted ? 'var(--tst-react)' : 'var(--tst-bounce)'}
				stroke-width="1"
				opacity="0.28"
			/>
		{/each}
		{#if shot}
			<path
				d={shotD}
				fill="none"
				stroke="var(--tst-shot)"
				stroke-width="2.4"
				stroke-linejoin="round"
			/>
		{/if}
		<circle
			cx={toX(box, geom.r1)}
			cy={toY(box, geom.r2)}
			r="6"
			fill="var(--tst-shot)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	</g>
	<!-- the pass -->
	<circle cx={sdX} cy={sdY} r="4" fill="var(--tst-pass)" />
	<Label
		x={sdX + 10}
		y={sdY - 10}
		text="‡ pass"
		anchor="start"
		size={13}
		weight={600}
		color="var(--tst-pass)"
	/>
	<!-- valleys -->
	<Readout id="valleys">
		<Label
			x={MAP.x + MAP.w - 10}
			y={toY(box, 0.74) - 14}
			text={names.bottom}
			anchor="end"
			weight={600}
		/>
		<Label
			x={toX(box, S.id === 'h3' ? 0.74 : 0.92) + 14}
			y={MAP.y + 20}
			text={names.left}
			anchor="start"
			weight={600}
		/>
		<Label
			x={MAP.x + MAP.w - 10}
			y={MAP.y + 20}
			text="three atoms apart"
			anchor="end"
			muted
			size={11}
		/>
		<Label
			x={MAP.x + 12}
			y={MAP.y + MAP.h - 12}
			text="atoms squeezed"
			anchor="start"
			muted
			size={11}
		/>
	</Readout>

	<!-- ===== the atoms ===== -->
	<g clip-path="url(#tst-strip-clip)">
		<line
			x1={STRIP.x}
			x2={STRIP.x + STRIP.w}
			y1={STRIP.cy}
			y2={STRIP.cy}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		{#if bonded(geom.r1, S.xy.re)}
			<line
				x1={atoms[0].x}
				x2={atoms[1].x}
				y1={STRIP.cy}
				y2={STRIP.cy}
				stroke="var(--stage-ink-muted)"
				stroke-width="4"
				stroke-linecap="round"
			/>
		{/if}
		{#if bonded(geom.r2, S.yz.re)}
			<line
				x1={atoms[1].x}
				x2={atoms[2].x}
				y1={STRIP.cy}
				y2={STRIP.cy}
				stroke="var(--stage-ink-muted)"
				stroke-width="4"
				stroke-linecap="round"
			/>
		{/if}
		{#each atoms as a (a.i)}
			<circle
				cx={a.x}
				cy={STRIP.cy}
				r={a.r}
				fill={a.el === 'F' ? 'var(--tst-f)' : 'var(--tst-h)'}
				stroke="var(--tst-h-edge)"
				stroke-width="1.2"
			/>
			<text
				x={a.x}
				y={STRIP.cy + 4.5}
				text-anchor="middle"
				font-size="12"
				font-weight="600"
				fill="#212529">{a.el}</text
			>
		{/each}
	</g>
	<Readout
		id="distances"
		order={1}
		label="Bond lengths"
		value="r₁ = {geom.r1.toFixed(2)} Å, r₂ = {geom.r2.toFixed(2)} Å"
	>
		<Label
			x={STRIP.x + STRIP.w / 2 - 12}
			y={STRIP.cy + 38}
			text="r₁ = {geom.r1.toFixed(2)} Å"
			anchor="end"
			color="var(--tst-r1)"
			tabular
		/>
		<Label
			x={STRIP.x + STRIP.w / 2 + 12}
			y={STRIP.cy + 38}
			text="r₂ = {geom.r2.toFixed(2)} Å"
			anchor="start"
			color="var(--tst-r2)"
			tabular
		/>
	</Readout>
	<Readout id="strip-title">
		<Label
			x={STRIP.x + STRIP.w / 2}
			y={STRIP.y - 26}
			text="the three atoms on their line"
			muted
			size={11}
		/>
	</Readout>

	<!-- ===== energies and outcome ===== -->
	{#if surfaceView}
		<Readout
			id="pass-height"
			order={2}
			label="The pass"
			value="{passText} eV above the valley floor"
		>
			<Label
				x={560}
				y={176}
				text="Pass: {passText} eV above the {names.bottom} valley floor"
				anchor="start"
			/>
		</Readout>
		<Readout id="slice-note">
			<Label
				x={560}
				y={202}
				text="The dot follows the dashed path of least energy:"
				anchor="start"
				muted
				size={11}
			/>
			<Label
				x={560}
				y={218}
				text="its height along the way is the energy profile below."
				anchor="start"
				muted
				size={11}
			/>
		</Readout>
	{:else}
		<Readout
			id="energies"
			order={2}
			label="Energy in"
			value="translation {trans.toFixed(2)} eV, vibration v = {vib} ({ev.toFixed(2)} eV)"
		>
			<Label
				x={560}
				y={168}
				text="Translation {trans.toFixed(2)} eV · {molecule} vibration v = {vib} ({ev.toFixed(
					2
				)} eV)"
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="pass"
			order={3}
			label="The pass"
			value="{passText} eV above the {molecule} valley floor"
		>
			<Label
				x={560}
				y={192}
				text="Pass: {passText} eV above the {molecule} valley floor"
				anchor="start"
				muted
			/>
		</Readout>
		<Readout
			id="outcome"
			order={4}
			label="This shot"
			value={play.done ? outcome : `${timeFs.toFixed(0)} fs`}
		>
			{#if play.done}
				<Label
					x={560}
					y={230}
					text={outcome}
					anchor="start"
					pill
					weight={600}
					color={shot?.reacted ? 'var(--tst-react)' : 'var(--tst-bounce)'}
				/>
			{:else}
				<Label x={560} y={230} text="t = {timeFs.toFixed(0)} fs" anchor="start" pill tabular />
			{/if}
		</Readout>
		<Readout id="fan" order={5} label="All 24 phases" value="{hits} of {FAN} cross">
			<Label
				x={560}
				y={266}
				text="Fan of {FAN} phases: {hits} cross (green), {FAN - hits} turn back (orange)"
				anchor="start"
				muted
				size={12}
			/>
		</Readout>
		{#if view === 'pass'}
			<Readout
				id="clock"
				order={6}
				label="Time within 0.2 Å of the pass"
				value="{nearSoFar.toFixed(1)} fs"
			>
				<Label
					x={560}
					y={298}
					text="Time within 0.2 Å of the pass: {nearSoFar.toFixed(1)} fs"
					anchor="start"
					weight={600}
					color="var(--tst-pass)"
					tabular
				/>
			</Readout>
		{/if}
	{/if}

	<!-- ===== the chart ===== -->
	{#if surfaceView}
		<Axes sx={profX} sy={profY} xLabel="along the path (Å)" yLabel="energy (eV)" />
		<path d={profD} fill="none" stroke="var(--tst-path)" stroke-width="2" />
		<circle
			cx={profX(pathData.s[pathIndex])}
			cy={profY(pathData.e[pathIndex])}
			r="5.5"
			fill="var(--tst-shot)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Label
			x={profX(pathData.s[pathData.e.indexOf(Math.max(...pathData.e))])}
			y={profY(pass) - 12}
			text="‡"
			color="var(--tst-pass)"
			weight={700}
			size={15}
		/>
	{:else}
		<Axes sx={tX} sy={rY} xLabel="time (fs)" yLabel="bond length (Å)" yTicks={[0, 1, 2, 3, 4]} />
		<path d={r1D} fill="none" stroke="var(--tst-r1)" stroke-width="2" />
		<path d={r2D} fill="none" stroke="var(--tst-r2)" stroke-width="2" />
		<Readout id="chart-key">
			<Label
				x={CHART.x + CHART.w - 30}
				y={CHART.y - 10}
				text="r₁"
				anchor="end"
				color="var(--tst-r1)"
				weight={700}
			/>
			<Label
				x={CHART.x + CHART.w - 4}
				y={CHART.y - 10}
				text="r₂"
				anchor="end"
				color="var(--tst-r2)"
				weight={700}
			/>
		</Readout>
	{/if}
</g>
