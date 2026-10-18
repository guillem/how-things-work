<script lang="ts">
	/**
	 * The van Deemter curve: the plate height of compound 2 measured from simulated peaks
	 * (../model.ts `sweep`) at eleven flow speeds (dots), the least-squares fit
	 * H = A + B/u + C·u (solid) and its three terms (dashed), on a log axis of flow speed; the
	 * reader's flow speed as a vertical line, and on the right the peak measured at that speed.
	 *
	 * Hints: `focus` 'terms' (the three terms labelled) | 'best' (the best flow speed marked,
	 * and the fitted curves of the other particle sizes, faint). Static apart from the
	 * controls, so reduced motion needs nothing special.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { elute, fitVanDeemter, peak, sweep, type Compound } from '../model';
	import { K2, density, setup, thousands } from '../look';

	let { step, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'terms'));
	const s = $derived(setup(step, params));
	const cmp: Compound = { k: K2 };
	const L = 50;
	const N_POINT = 1000;

	// plain caches of simulations, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const sweeps = new Map<
		number,
		{ points: { u: number; H: number }[]; fit: ReturnType<typeof fitVanDeemter> }
	>();
	const sweepFor = (dp: number) => {
		let hit = sweeps.get(dp);
		if (!hit) {
			const points = sweep(cmp, dp, L, N_POINT, 4242);
			hit = { points, fit: fitVanDeemter(points) };
			sweeps.set(dp, hit);
		}
		return hit;
	};
	const cur = $derived(sweepFor(s.c.dp));
	const others = $derived(
		focus === 'best'
			? [10, 5, 3, 2].filter((d) => d !== s.c.dp).map((d) => ({ dp: d, ...sweepFor(d) }))
			: []
	);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const runs = new Map<string, ReturnType<typeof elute>>();
	const here = $derived.by(() => {
		const k = `${s.c.u}|${s.c.dp}`;
		let r = runs.get(k);
		if (!r) {
			r = elute({ L, u: s.c.u, dp: s.c.dp }, cmp, 2000, 777);
			if (runs.size > 40) runs.clear();
			runs.set(k, r);
		}
		return { ...r, peak: peak(r.times, L) };
	});

	// ---- the chart ---------------------------------------------------------------------------
	const PX0 = 100;
	const PX1 = 590;
	const PY0 = 80;
	const PY1 = 470;
	const HMAX = 40;
	const sx = scale([-1, 1], [PX0, PX1]);
	const sy = scale([0, HMAX], [PY1, PY0]);
	const ux = (u: number) => sx(Math.log10(u));
	const hy = (H: number) => sy(Math.min(HMAX * 1.02, H * 1000));
	const U_TICKS = [0.1, 0.2, 0.5, 1, 2, 5, 10];
	const curve = (f: (u: number) => number) => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const u = 10 ** (-1 + i / 60);
			const H = f(u);
			if (H * 1000 > HMAX * 1.02) {
				if (d && !d.endsWith('!')) d += '!';
				continue;
			}
			d += `${d === '' || d.endsWith('!') ? 'M' : 'L'}${ux(u).toFixed(1)} ${hy(H).toFixed(1)}`;
		}
		return d.replaceAll('!', '');
	};
	const fitPath = (f: { A: number; B: number; C: number }) => curve((u) => f.A + f.B / u + f.C * u);
	const terms = $derived([
		{ id: 'A', d: curve(() => cur.fit.A), text: 'A, uneven paths' },
		{ id: 'B', d: curve((u) => cur.fit.B / u), text: 'B/u, diffusion' },
		{ id: 'C', d: curve((u) => cur.fit.C * u), text: 'C·u, slow exchange' }
	]);
	const termH = (id: string, u: number) =>
		id === 'A' ? cur.fit.A : id === 'B' ? cur.fit.B / u : cur.fit.C * u;
	const fitH = (f: { A: number; B: number; C: number }, u: number) => f.A + f.B / u + f.C * u;
	/** Top of the legend in the right-hand panel. */
	const LY = 462;
	const fmtU = (u: number) => `${Number(u.toPrecision(2))} mm/s`;
	const um = (H: number) => `${(H * 1000).toFixed(1)} µm`;

	// ---- the peak panel ----------------------------------------------------------------------
	const QX0 = 660;
	const QX1 = 930;
	const QY0 = 120;
	const QY1 = 330;
	const SPAN = 0.08;
	const BINS = 160;
	const qx = scale([-SPAN * 100, SPAN * 100], [QX0, QX1]);
	const peakShape = $derived.by(() => {
		const tR = here.peak.mean;
		const rel = Array.from(here.times, (v) => ((v - tR) / tR) * 100);
		return density(rel, -SPAN * 100, SPAN * 100, BINS, 2);
	});
	const qmax = $derived(Math.max(0.4, ...peakShape) * 1.1);
	const qy = $derived(scale([0, qmax], [QY1, QY0]));
	const peakPath = $derived.by(() => {
		const w = (2 * SPAN * 100) / BINS;
		let d = `M${QX0} ${QY1}`;
		for (let b = 0; b < BINS; b++)
			d += `L${qx(-SPAN * 100 + (b + 0.5) * w).toFixed(1)} ${qy(peakShape[b]).toFixed(1)}`;
		return `${d}L${QX1} ${QY1}Z`;
	});
</script>

<g>
	<Readout id="title" order={1} label="Compound 2, column 50 mm" value="{s.c.dp} µm particles">
		<Label
			x={PX0 - 60}
			y={36}
			text="plate height of compound 2 against flow speed · {s.c.dp} µm particles"
			size={14}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xLabel="flow speed (mm/s)"
		yLabel="plate height H (µm)"
		xTicks={U_TICKS.map((u) => Math.log10(u))}
		xFormat={(v) => String(Number((10 ** v).toPrecision(1)))}
	/>

	{#each others as o (o.dp)}
		<path
			d={fitPath(o.fit)}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			opacity="0.6"
		/>
		{@const end =
			[10, 5, 2, 1, 0.5, 0.2].find(
				(u) => (o.fit.A + o.fit.B / u + o.fit.C * u) * 1000 < HMAX - 2
			) ?? 0.2}
		<Readout id="other-{o.dp}">
			<Label
				x={ux(end) + 6}
				y={hy(o.fit.A + o.fit.B / end + o.fit.C * end) - 8}
				text="{o.dp} µm"
				size={11}
				muted
				anchor="start"
			/>
		</Readout>
	{/each}

	{#each terms as tm (tm.id)}
		<path
			d={tm.d}
			fill="none"
			stroke="var(--ch-term-{tm.id})"
			stroke-width={focus === 'terms' ? 2 : 1.4}
			stroke-dasharray="6 5"
			opacity={focus === 'terms' ? 1 : 0.6}
		/>
	{/each}
	<path d={fitPath(cur.fit)} fill="none" stroke="var(--ch-c2)" stroke-width="2.5" />
	{#each cur.points as p (p.u)}
		<circle
			cx={ux(p.u)}
			cy={hy(p.H)}
			r="5"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
		/>
	{/each}

	<!-- the best flow speed -->
	{#if focus === 'best' && Number.isFinite(cur.fit.uOpt)}
		<path d="M{ux(cur.fit.uOpt)} {PY1 - 2} l-7 -12 l14 0 Z" fill="var(--ch-c2)" />
	{/if}
	{#if focus === 'best'}
		{@const end = [10, 5, 2, 1].find((u) => fitH(cur.fit, u) * 1000 < HMAX - 2) ?? 1}
		<Readout id="current-dp">
			<Label
				x={ux(end) + 6}
				y={hy(fitH(cur.fit, end)) - 8}
				text="{s.c.dp} µm"
				size={12}
				weight={600}
				color="var(--ch-c2)"
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- the reader's flow speed -->
	<line
		x1={ux(s.c.u)}
		x2={ux(s.c.u)}
		y1={PY0}
		y2={PY1}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-dasharray="2 4"
	/>
	<circle
		cx={ux(s.c.u)}
		cy={hy(here.peak.H)}
		r="7"
		fill="var(--ch-c2)"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
	/>

	<!-- the peak at this flow -->
	<Readout id="peak-title" order={2} label="Flow speed" value={fmtU(s.c.u)}>
		<Label
			x={(QX0 + QX1) / 2}
			y={QY0 - 34}
			text="the peak at {fmtU(s.c.u)}"
			size={13}
			weight={600}
		/>
	</Readout>
	<path
		d={peakPath}
		fill="var(--ch-c2)"
		fill-opacity="0.35"
		stroke="var(--ch-c2)"
		stroke-width="1.5"
	/>
	<line x1={QX0} x2={QX1} y1={QY1} y2={QY1} stroke="var(--stage-line)" stroke-width="1" />
	<Readout id="peak-axis">
		<Label x={QX0} y={QY1 + 18} text="−8 %" size={11} muted />
		<Label x={(QX0 + QX1) / 2} y={QY1 + 18} text="t_R" size={11} muted />
		<Label x={QX1} y={QY1 + 18} text="+8 %" size={11} muted />
	</Readout>
	<Readout id="H-here" order={5} label="Measured H" value={um(here.peak.H)}>
		<Label x={QX0} y={QY1 + 52} text="H = {um(here.peak.H)}" size={13} anchor="start" tabular />
	</Readout>
	<Readout id="N-here" order={6} label="Plate count N (50 mm)" value={thousands(here.peak.N)}>
		<Label
			x={QX0}
			y={QY1 + 74}
			text="N = {thousands(here.peak.N)} plates"
			size={13}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="t-here"
		order={7}
		label="Retention time"
		value="{Math.round(here.peak.mean)} s ± {here.peak.sd.toFixed(1)} s"
	>
		<Label
			x={QX0}
			y={QY1 + 96}
			text="t_R = {Math.round(here.peak.mean)} s, σ = {here.peak.sd.toFixed(1)} s"
			size={13}
			anchor="start"
			tabular
		/>
	</Readout>
	{#if focus === 'terms'}
		{#each terms as tm, i (tm.id)}
			<Readout
				id="term-{tm.id}"
				order={8 + i}
				label={tm.text}
				value={um(termH(tm.id, s.c.u))}
				color="var(--ch-term-{tm.id})"
			>
				<line
					x1={QX0}
					x2={QX0 + 26}
					y1={LY + i * 22 - 4}
					y2={LY + i * 22 - 4}
					stroke="var(--ch-term-{tm.id})"
					stroke-width="2"
					stroke-dasharray="6 5"
				/>
				<Label
					x={QX0 + 34}
					y={LY + i * 22}
					text="{tm.text}: {um(termH(tm.id, s.c.u))}"
					size={12}
					weight={600}
					color="var(--ch-term-{tm.id})"
					anchor="start"
					tabular
				/>
			</Readout>
		{/each}
	{:else if Number.isFinite(cur.fit.uOpt)}
		<Readout
			id="uopt"
			order={8}
			label="Best flow speed"
			value="{fmtU(cur.fit.uOpt)}, H = {um(cur.fit.Hmin)}"
		>
			<path d="M{QX0 + 7} {LY + 2} l-7 -12 l14 0 Z" fill="var(--ch-c2)" />
			<Label
				x={QX0 + 22}
				y={LY}
				text="best: {fmtU(cur.fit.uOpt)}, H = {um(cur.fit.Hmin)}"
				size={13}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}
	<Readout id="dots-key">
		<Label
			x={QX0}
			y={LY + 76}
			text="dots: H measured from simulated peaks"
			size={11}
			anchor="start"
			muted
		/>
		<Label
			x={QX0}
			y={LY + 94}
			text="line: the fit H = A + B/u + C·u"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
