<script lang="ts">
	/**
	 * The Berg–Purcell argument (../model.ts `bergPurcell`): on the left, a cell 2 µm long in a
	 * gradient of attractant (shaded, rising to the right) compares its back with its front; on
	 * the right, at a smaller scale, the same cell compares where it is now with where it was
	 * after one second of swimming, 20 µm back. Underneath, on a log scale, the relative change
	 * each scheme has to detect and its counting noise, with their ratio.
	 *
	 * Controls: logc (log₁₀ of the concentration in µM) and glen (gradient length, mm). The
	 * molecules drifting about are decoration (their density does not follow the controls).
	 * Reduced motion: the frame at t = 2.5 s.
	 */
	import { Axes, Label, cycle, hash, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bergPurcell, SWIM } from '../model';

	let { t, params }: StageProps = $props();

	const c = $derived(10 ** Number(params.logc ?? 0));
	const glen = $derived(Number(params.glen ?? 1));
	const bp = $derived(bergPurcell({ c, length: glen * 1000 }));

	const pct = (v: number) => {
		const p = v * 100;
		return p >= 1 ? `${p.toFixed(1)} %` : p >= 0.1 ? `${p.toFixed(2)} %` : `${p.toFixed(3)} %`;
	};
	const ratio = (s: { signal: number; noise: number }) => s.signal / s.noise;
	const fmtRatio = (r: number) => (r >= 10 ? r.toFixed(0) : r.toFixed(1));
	const verdict = (r: number) => (r < 1 ? 'lost in the noise' : r < 3 ? 'barely' : 'clear');

	// ---- panels ----------------------------------------------------------------------------
	const PY0 = 60;
	const PY1 = 290;
	const A = { x0: 24, x1: 464 };
	const B = { x0: 496, x1: 936 };

	/** Drifting molecules: decoration, a little denser to the right. */
	const MOL = Array.from({ length: 70 }, (_, i) => ({
		i,
		u: Math.sqrt(hash(i, 1)),
		v: hash(i, 2),
		p: hash(i, 3) * 6.28
	}));
	const mols = (x0: number, x1: number) =>
		MOL.map((m) => ({
			i: m.i,
			x: x0 + 8 + (x1 - x0 - 16) * ((m.u + 0.02 * Math.sin(t * 1.3 + m.p) + 1) % 1),
			y: PY0 + 36 + (PY1 - PY0 - 46) * ((m.v + 0.03 * Math.cos(t * 1.1 + m.p * 2) + 1) % 1)
		}));
	const molsA = $derived(mols(A.x0, A.x1));
	const molsB = $derived(mols(B.x0, B.x1));

	// panel B: 14 px per µm; the run is 20 µm (v × 1 s)
	const PXB = 14;
	const runPx = SWIM.v * 1 * PXB;
	const RUN_X0 = B.x0 + 60;
	const RUN_Y = 196;
	const swimU = $derived(smoothstep(0, 0.8, cycle(t, 3.5)));
	const swimX = $derived(RUN_X0 + runPx * swimU);

	// ---- the chart ---------------------------------------------------------------------------
	const CX0 = 250;
	const CX1 = 760;
	const sx = scale([-3, 1], [CX0, CX1]);
	const lg = (v: number) => Math.log10(Math.max(1e-6, v * 100));
	const rows = $derived([
		{ id: 'spatial', name: 'front vs back (2 µm)', y: 368, s: bp.spatial },
		{ id: 'temporal', name: 'now vs 1 s ago (20 µm)', y: 456, s: bp.temporal }
	]);
	const barW = (v: number) => Math.max(1, sx(Math.min(1, lg(v))) - CX0);
</script>

<g>
	<linearGradient id="bc-sense-grad" x1="0" x2="1" y1="0" y2="0">
		<stop offset="0" stop-color="var(--bc-attract)" stop-opacity="0.04" />
		<stop offset="1" stop-color="var(--bc-attract)" stop-opacity="0.22" />
	</linearGradient>

	<Readout id="title" order={1} label="Attractant" value="{Number(c.toPrecision(2))} µM">
		<Label
			x={24}
			y={32}
			text="how big a change must the cell detect? · {Number(
				c.toPrecision(2)
			)} µM, changing e-fold over {glen.toFixed(1)} mm"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- panel A: across the body -->
	<rect
		x={A.x0}
		y={PY0}
		width={A.x1 - A.x0}
		height={PY1 - PY0}
		rx="10"
		fill="url(#bc-sense-grad)"
		stroke="var(--stage-line)"
	/>
	{#each molsA as m (m.i)}
		<circle cx={m.x} cy={m.y} r="2.2" fill="var(--bc-attract)" opacity="0.55" />
	{/each}
	<rect
		x={144}
		y={150}
		width={200}
		height={100}
		rx={50}
		fill="var(--bc-cell)"
		opacity="0.9"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout id="a-title">
		<Label
			x={A.x0 + 12}
			y={PY0 + 22}
			text="across the body"
			size={13}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="a-ends">
		<Label x={168} y={274} text="back" size={12} />
		<Label x={320} y={274} text="front" size={12} />
	</Readout>
	<path d="M144 132 v-6 h200 v6" fill="none" stroke="var(--stage-ink)" stroke-width="1.2" />
	<Readout id="a-len">
		<Label x={244} y={118} text="2 µm" size={12} />
	</Readout>

	<!-- panel B: along a run -->
	<rect
		x={B.x0}
		y={PY0}
		width={B.x1 - B.x0}
		height={PY1 - PY0}
		rx="10"
		fill="url(#bc-sense-grad)"
		stroke="var(--stage-line)"
	/>
	{#each molsB as m (m.i)}
		<circle cx={m.x} cy={m.y} r="1.4" fill="var(--bc-attract)" opacity="0.45" />
	{/each}
	<rect
		x={RUN_X0 - PXB}
		y={RUN_Y - PXB / 2}
		width={2 * PXB}
		height={PXB}
		rx={PXB / 2}
		fill="none"
		stroke="var(--bc-cell)"
		stroke-width="1.5"
		stroke-dasharray="3 2"
	/>
	<line
		x1={RUN_X0 + PXB + 4}
		x2={RUN_X0 + runPx - PXB - 6}
		y1={RUN_Y}
		y2={RUN_Y}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="5 4"
		marker-end="url(#arrowhead)"
	/>
	<rect
		x={swimX - PXB}
		y={RUN_Y - PXB / 2}
		width={2 * PXB}
		height={PXB}
		rx={PXB / 2}
		fill="var(--bc-cell)"
		stroke="var(--stage-bg)"
	/>
	<Readout id="b-title">
		<Label
			x={B.x0 + 12}
			y={PY0 + 22}
			text="along a run, 1 s apart"
			size={13}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="b-ends">
		<Label x={RUN_X0} y={RUN_Y + 30} text="1 s ago" size={12} />
		<Label x={RUN_X0 + runPx} y={RUN_Y + 30} text="now" size={12} />
	</Readout>
	<path
		d="M{RUN_X0} 140 v-6 h{runPx} v6"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>
	<Readout id="b-len">
		<Label x={RUN_X0 + runPx / 2} y={126} text="20 µm (20 µm/s × 1 s)" size={12} />
	</Readout>
	<Readout id="shade">
		<Label x={B.x1 - 12} y={PY1 - 12} text="more attractant →" size={11} muted anchor="end" />
	</Readout>

	<!-- the chart -->
	<Axes
		{sx}
		sy={scale([0, 1], [500, 326])}
		xTicks={[-3, -2, -1, 0, 1]}
		yTicks={[]}
		xFormat={(v) => (v >= 0 ? `${10 ** v} %` : `${Number((10 ** v).toPrecision(1))} %`)}
		xLabel="relative change"
	/>
	{#each rows as r (r.id)}
		{@const R = ratio(r.s)}
		<Readout id="name-{r.id}">
			<Label x={CX0 - 12} y={r.y + 4} text={r.name} size={12} anchor="end" weight={600} />
		</Readout>
		<rect
			x={CX0}
			y={r.y - 22}
			width={barW(r.s.signal)}
			height="16"
			rx="2"
			fill="var(--bc-attract)"
		/>
		<rect
			x={CX0}
			y={r.y + 2}
			width={barW(r.s.noise)}
			height="16"
			rx="2"
			fill="var(--bc-noise)"
			opacity="0.75"
		/>
		<Readout
			id="snr-{r.id}"
			order={r.id === 'spatial' ? 2 : 3}
			label={r.name}
			value="change {pct(r.s.signal)}, noise {pct(r.s.noise)}: ratio {fmtRatio(R)}"
		>
			<Label
				x={CX1 + 16}
				y={r.y - 8}
				text="change {pct(r.s.signal)}"
				size={12}
				anchor="start"
				tabular
				color="var(--bc-attract)"
			/>
			<Label
				x={CX1 + 16}
				y={r.y + 12}
				text="noise ±{pct(r.s.noise)}"
				size={12}
				anchor="start"
				tabular
				muted
			/>
			<Label
				x={CX1 + 16}
				y={r.y + 32}
				text="ratio {fmtRatio(R)}: {verdict(R)}"
				size={12}
				anchor="start"
				weight={600}
				tabular
			/>
		</Readout>
	{/each}
	<Readout id="key">
		<Label
			x={24}
			y={584}
			text="noise: counting molecules for 1 s, ≈ 1/√(D·a·c·T) per reading, D = 1000 µm²/s, a = 1 µm"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
