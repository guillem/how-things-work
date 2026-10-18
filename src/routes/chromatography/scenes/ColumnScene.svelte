<script lang="ts">
	/**
	 * The column (top) with the molecules of the mixture moving through it, and the detector's
	 * chromatogram (bottom), drawn as the compounds come out.
	 *
	 * Hints: `focus` 'inject' | 'retention' | 'spread' | 'length' | 'tailing' (which readouts
	 * and overlays show). The conditions come from the step's controls (../look.ts).
	 *
	 * Two simulations of the same model (../model.ts), both seeded: a large population whose
	 * exit times make the chromatogram and every readout, and a smaller one whose tracks are
	 * drawn as dots. A run lasts RUN seconds of animation for the whole chromatogram, holds,
	 * and starts again; it also restarts when the conditions change (the start time is a plain
	 * variable kept inside a `$derived`, as in states-of-matter's box). Reduced motion: the bands
	 * halfway through the column, with the chromatogram drawn so far and the rest of it faint.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { elute, peak, positionAt, resolution, tracks, type Peak, type Track } from '../model';
	import { density, dotsPath, seconds, setup, thousands } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'inject'));
	const s = $derived(setup(step, params));
	const key = $derived(JSON.stringify([s.c, s.k2, s.surface]));

	const COLOR = { marker: 'var(--ch-marker)', c1: 'var(--ch-c1)', c2: 'var(--ch-c2)' };
	const NAME = { marker: 'marker', c1: 'compound 1', c2: 'compound 2' };
	/** The marker is injected in a smaller amount, so its narrow peak isn't towering. */
	const WEIGHT = { marker: 0.35, c1: 1, c2: 1 };

	// ---- the runs ------------------------------------------------------------------------
	const N_TRACE = 2000;
	const N_DRAW = { marker: 50, c1: 140, c2: 140 };

	interface Run {
		end: number;
		peaks: { id: 'marker' | 'c1' | 'c2'; times: Float64Array; peak: Peak; hops: number }[];
		drawn: { id: 'marker' | 'c1' | 'c2'; tracks: Track[] }[];
	}
	// a plain cache of runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const cache = new Map<string, Run>();
	const run = $derived.by((): Run => {
		const hit = cache.get(key);
		if (hit) return hit;
		const { c, compounds } = s;
		const peaks = compounds.map(({ id, cmp }, i) => {
			const { times, hops } = elute(c, cmp, N_TRACE, 1000 + 17 * i);
			return { id, times, peak: peak(times, c.L), hops };
		});
		// The run lasts until nearly every molecule is out (the 99.5th percentile, for tails).
		let end = 0;
		for (const p of peaks) {
			const sorted = Array.from(p.times).sort((a, b) => a - b);
			end = Math.max(end, sorted[Math.floor(sorted.length * 0.995)]);
		}
		end *= 1.06;
		const dt = end / 320;
		const drawn = compounds.map(({ id, cmp }, i) => ({
			id,
			tracks: tracks(c, cmp, N_DRAW[id], 2000 + 31 * i, dt)
		}));
		const r = { end, peaks, drawn };
		if (cache.size > 16) cache.clear();
		cache.set(key, r);
		return r;
	});

	// ---- time ------------------------------------------------------------------------------
	const RUN = 15;
	const PERIOD = 20;
	let t0 = 0;
	let lastT = 0;
	let lastKey = '';
	const local = $derived.by(() => {
		const time = t;
		const k = `${step.id}|${key}`;
		if (k !== lastKey || time < lastT - 1e-6) {
			t0 = k !== lastKey && lastKey !== '' && time > 0.1 ? time : 0;
			lastKey = k;
		}
		lastT = time;
		return Math.max(0, time - t0);
	});
	const slowest = $derived(Math.max(...run.peaks.map((p) => p.peak.mean)));
	/** Model time, s. */
	const now = $derived(reduced ? 0.5 * slowest : (Math.min(local % PERIOD, RUN) / RUN) * run.end);

	// ---- the column --------------------------------------------------------------------------
	const CX0 = 70;
	const CX1 = 850;
	const TY0 = 86;
	const TY1 = 142;
	const colX = (x: number) => CX0 + ((CX1 - CX0) * x) / s.c.L;
	const hash = (i: number) => {
		const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
		return v - Math.floor(v);
	};
	const dots = $derived(
		run.drawn.map(({ id, tracks: trs }) => {
			const xs: number[] = [];
			const ys: number[] = [];
			trs.forEach((tr, i) => {
				const x = positionAt(tr, now);
				if (x === null) return;
				xs.push(colX(x));
				ys.push(TY0 + 7 + (TY1 - TY0 - 14) * hash(i + (id === 'c1' ? 500 : id === 'c2' ? 900 : 0)));
			});
			return { id, d: dotsPath(xs, ys, 3) };
		})
	);
	/** The packing, drawn once: rows of particles across the tube. */
	const beads = Array.from({ length: 3 * 52 }, (_, i) => {
		const row = Math.floor(i / 52);
		const col = i % 52;
		return { i, x: CX0 + 8 + col * 15 + (row % 2) * 7.5, y: TY0 + 10 + row * 18 };
	});

	// ---- the chromatogram ------------------------------------------------------------------
	const GX0 = CX0;
	const GX1 = CX1;
	const GY0 = 286;
	const GY1 = 530;
	const BINS = 390;
	const curves = $derived.by(() => {
		const { end, peaks } = run;
		// Smooth each peak over a fifth of its own width (at least 1.6 bins): broad peaks of
		// 2000 molecules are otherwise jagged.
		return peaks.map((p) => ({
			id: p.id,
			y: density(p.times, 0, end, BINS, Math.max(1.6, (0.2 * p.peak.sd * BINS) / end), WEIGHT[p.id])
		}));
	});
	const total = $derived.by(() => {
		const out = new Float64Array(BINS);
		for (const c of curves) for (let b = 0; b < BINS; b++) out[b] += c.y[b];
		return out;
	});
	const ymax = $derived(Math.max(...total) * 1.18 || 1);
	const sx = $derived(scale([0, run.end], [GX0, GX1]));
	const sy = $derived(scale([0, ymax], [GY1, GY0]));
	const binX = (b: number) => sx(((b + 0.5) * run.end) / BINS);
	const upTo = $derived(Math.min(BINS, Math.floor((now / run.end) * BINS) + 1));
	const linePath = (y: Float64Array, from: number, to: number) => {
		let d = '';
		for (let b = from; b < to; b++)
			d += `${d ? 'L' : 'M'}${binX(b).toFixed(1)} ${sy(y[b]).toFixed(1)}`;
		return d;
	};
	const areaPath = (y: Float64Array, to: number) =>
		to < 2
			? ''
			: `${linePath(y, 0, to)}L${binX(to - 1).toFixed(1)} ${GY1}L${binX(0).toFixed(1)} ${GY1}Z`;
	const showGauss = $derived(focus === 'spread' || focus === 'tailing');
	const gauss = (p: Peak, w: number) => {
		let d = '';
		const n = 120;
		for (let i = 0; i <= n; i++) {
			const tt = Math.min(run.end, Math.max(0, p.mean + (i / n - 0.5) * 8 * p.sd));
			const v =
				(w / (p.sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((tt - p.mean) / p.sd) ** 2);
			d += `${d ? 'L' : 'M'}${sx(tt).toFixed(1)} ${sy(v).toFixed(1)}`;
		}
		return d;
	};
	/** Peak labels at the apex, nudged apart when two peaks are close. */
	const labels = $derived.by(() => {
		const out = run.peaks.map((p, i) => {
			const y = curves[i].y;
			let best = 0;
			for (let b = 1; b < BINS; b++) if (y[b] > y[best]) best = b;
			return {
				id: p.id,
				x: binX(best),
				y: sy(total[best]) - 12,
				text: p.id === 'marker' ? 'marker' : p.id === 'c1' ? '1' : '2',
				at: (best * run.end) / BINS
			};
		});
		const [, a, b] = out;
		if (Math.abs(a.x - b.x) < 22) {
			const mid = (a.x + b.x) / 2;
			const lo = a.x <= b.x ? a : b;
			const hi = a.x <= b.x ? b : a;
			lo.x = mid - 11;
			hi.x = mid + 11;
			lo.y = hi.y = Math.min(lo.y, hi.y);
		}
		return out;
	});
	const xTicks = $derived.by(() => {
		const raw = run.end / 6;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const stepT = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag;
		const out: number[] = [];
		for (let v = 0; v <= run.end; v += stepT) out.push(Number(v.toPrecision(10)));
		return out;
	});

	// ---- readouts ------------------------------------------------------------------------------
	const P = $derived(Object.fromEntries(run.peaks.map((p) => [p.id, p])));
	const tm = $derived(P.marker.peak.mean);
	const kMeasured = (p: Peak) => ((p.mean - tm) / tm).toFixed(2);
	const rs = $derived(resolution(P.c1.peak, P.c2.peak));
	const fmtU = (u: number) => `${u} mm/s`;
	const heading = $derived(`column ${s.c.L} mm · ${s.c.dp} µm particles · flow ${fmtU(s.c.u)}`);
	const skew = (p: Peak) => p.skew.toFixed(2).replace('-', '−');
</script>

<g>
	<Readout id="heading" order={1} label="Column" value={heading.replace('column ', '')}>
		<Label x={CX0} y={44} text={heading} size={14} weight={600} anchor="start" />
	</Readout>
	<Readout id="clock" order={2} label="Time since injection" value="{seconds(now)} s">
		<Label
			x={CX1 + 66}
			y={44}
			text="t = {seconds(now)} s"
			size={14}
			anchor="end"
			tabular
			muted={reduced}
		/>
	</Readout>

	<!-- the column -->
	<rect
		x={CX0 - 4}
		y={TY0 - 4}
		width={CX1 - CX0 + 8}
		height={TY1 - TY0 + 8}
		rx="8"
		fill="var(--ch-tube)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#each beads as b (b.i)}
		<circle cx={b.x} cy={b.y} r="6.5" fill="var(--ch-bead)" />
	{/each}
	{#each dots as d (d.id)}
		<path d={d.d} fill={COLOR[d.id]} stroke="var(--stage-bg)" stroke-width="0.6" />
	{/each}
	<!-- inlet and detector -->
	<line
		x1={CX0 - 50}
		x2={CX0 - 10}
		y1={(TY0 + TY1) / 2}
		y2={(TY0 + TY1) / 2}
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="inject-label">
		<Label x={CX0 - 30} y={TY0 - 14} text="inject" size={12} muted />
	</Readout>
	<rect
		x={CX1 + 10}
		y={TY0 - 6}
		width="56"
		height={TY1 - TY0 + 12}
		rx="6"
		fill="var(--surface)"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<path
		d="M{CX1 + 18} {TY1 - 12} l8 0 l4 -22 l4 30 l4 -8 l14 0"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout id="detector-label">
		<Label x={CX1 + 38} y={TY1 + 30} text="detector" size={12} muted />
	</Readout>
	<Readout id="scale">
		<Label x={CX0} y={TY1 + 22} text="0" size={11} muted anchor="start" />
		<Label x={CX1} y={TY1 + 22} text="{s.c.L} mm" size={11} muted anchor="end" />
	</Readout>

	<!-- readouts between the column and the chart -->
	{#if focus === 'inject' || focus === 'retention'}
		{#each ['marker', 'c1', 'c2'] as const as id, i (id)}
			<Readout
				id="tr-{id}"
				order={3 + i}
				label={id === 'marker' ? 'Marker, t_M' : `${NAME[id]}, t_R`}
				value="{seconds(P[id].peak.mean)} s{focus === 'retention' && id !== 'marker'
					? ` · k′ = ${kMeasured(P[id].peak)}`
					: ''}"
				color={COLOR[id]}
			>
				<circle cx={CX0 + 6 + i * 260} cy={218} r="5" fill={COLOR[id]} />
				<Label
					x={CX0 + 18 + i * 260}
					y={222}
					text={id === 'marker'
						? `marker: t_M = ${seconds(P[id].peak.mean)} s`
						: `${NAME[id]}: t_R = ${seconds(P[id].peak.mean)} s`}
					size={13}
					anchor="start"
					tabular
				/>
				{#if focus === 'retention' && id !== 'marker'}
					<Label
						x={CX0 + 18 + i * 260}
						y={242}
						text="k′ = (t_R − t_M)/t_M = {kMeasured(P[id].peak)}"
						size={12}
						anchor="start"
						muted
						tabular
					/>
				{/if}
			</Readout>
		{/each}
	{:else if focus === 'spread'}
		<Readout
			id="sd"
			order={3}
			label="Compound 2, peak width σ"
			value="{P.c2.peak.sd.toFixed(1)} s"
			color={COLOR.c2}
		>
			<Label
				x={CX0}
				y={222}
				text="compound 2: σ = {P.c2.peak.sd.toFixed(1)} s"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="plates" order={4} label="Plate count N" value={thousands(P.c2.peak.N)}>
			<Label
				x={CX0 + 230}
				y={222}
				text="N = (t_R/σ)² = {thousands(P.c2.peak.N)}"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="H" order={5} label="Plate height H" value="{(P.c2.peak.H * 1000).toFixed(1)} µm">
			<Label
				x={CX0 + 470}
				y={222}
				text="H = L/N = {(P.c2.peak.H * 1000).toFixed(1)} µm"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="hops"
			order={6}
			label="Stickings per molecule"
			value={thousands(Number(P.c2.hops.toPrecision(2)))}
		>
			<Label
				x={CX0}
				y={244}
				text="each molecule of compound 2 stuck about {thousands(
					Number(P.c2.hops.toPrecision(2))
				)} times"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{:else if focus === 'length'}
		<Readout id="rs" order={3} label="Resolution R_s" value={rs.toFixed(2)}>
			<Label
				x={CX0}
				y={222}
				text="resolution R_s = {rs.toFixed(2)}"
				size={15}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="plates" order={4} label="Plate count N" value={thousands(P.c2.peak.N)}>
			<Label
				x={CX0 + 260}
				y={222}
				text="N = {thousands(P.c2.peak.N)} plates"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="tr2" order={5} label="Compound 2 out at" value="{seconds(P.c2.peak.mean)} s">
			<Label
				x={CX0 + 480}
				y={222}
				text="compound 2 out at {seconds(P.c2.peak.mean)} s"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
	{:else if focus === 'tailing'}
		{#each ['c1', 'c2'] as const as id, i (id)}
			<Readout
				id="skew-{id}"
				order={3 + i}
				label="{NAME[id]}, skewness"
				value={skew(P[id].peak)}
				color={COLOR[id]}
			>
				<circle cx={CX0 + 6 + i * 260} cy={218} r="5" fill={COLOR[id]} />
				<Label
					x={CX0 + 18 + i * 260}
					y={222}
					text="{NAME[id]}: skewness {skew(P[id].peak)}"
					size={13}
					anchor="start"
					tabular
				/>
			</Readout>
		{/each}
		<Readout
			id="hops"
			order={5}
			label="Stickings per molecule"
			value={thousands(Number(P.c2.hops.toPrecision(2)))}
		>
			<Label
				x={CX0 + 520}
				y={222}
				text="stickings per molecule: {thousands(Number(P.c2.hops.toPrecision(2)))}"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}

	<!-- the chromatogram -->
	<Axes {sx} {sy} xLabel="time (s)" yLabel="detector signal" {xTicks} yTicks={[]} />
	{#if reduced}
		<path
			d={linePath(total, 0, BINS)}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
	{/if}
	{#each curves as c (c.id)}
		<path d={areaPath(c.y, upTo)} fill={COLOR[c.id]} fill-opacity="0.28" stroke="none" />
	{/each}
	<path d={linePath(total, 0, upTo)} fill="none" stroke="var(--stage-ink)" stroke-width="1.6" />
	{#if showGauss && upTo >= BINS}
		{#each run.peaks.filter((p) => p.id !== 'marker') as p (p.id)}
			<path
				d={gauss(p.peak, WEIGHT[p.id])}
				fill="none"
				stroke={COLOR[p.id]}
				stroke-width="1.6"
				stroke-dasharray="5 4"
			/>
		{/each}
	{/if}
	{#each labels as l (l.id)}
		{#if now >= l.at || reduced}
			<Label
				x={l.x}
				y={l.y}
				text={l.text}
				size={12}
				weight={600}
				color={COLOR[l.id]}
				opacity={now >= l.at ? 1 : 0.5}
			/>
		{/if}
	{/each}
	{#if reduced}
		<Readout id="reduced-note">
			<Label
				x={GX1}
				y={GY0 - 8}
				text="bands at t = {seconds(now)} s; faint: the rest of the run"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
</g>
