<script lang="ts">
	/**
	 * The faint young Sun: 4.5 billion years of the Sun's brightening (Gough 1981), and the
	 * thermostat's balance for each moment, with volcanoes `early` × today's 4.5 billion years
	 * ago declining to today's. Three aligned charts against time: sunlight; CO₂ (log scale);
	 * the temperature with the thermostat (solid) and with CO₂ held at 280 ppm (dashed), the
	 * stretches where each is frozen shaded. A cursor sweeps from 4.5 billion years ago to
	 * today in SWEEP seconds, then holds; the history is recomputed when the control moves.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { celsiusText, co2Text, history, toC, type HistoryPoint } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const LEAD = 0.6;
	const SWEEP = 10;
	const early = $derived(Number(params.early ?? 3));
	const points = $derived(history(early, 4.5, 90));

	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const ga = $derived(4.5 * (1 - u));
	const now = $derived(points[Math.round(u * (points.length - 1))]);

	const X0 = 110;
	const X1 = 720;
	const sx = scale([4.5, 0], [X0, X1]);
	const sSun = scale([70, 100], [150, 84]);
	const sc = scale([2, 6], [320, 190]);
	const st = scale([-70, 30], [530, 370]);
	const lg = (v: number) => Math.log10(v);

	const upTo = $derived(points.filter((p) => p.ga >= ga - 1e-9));
	const sunPath = $derived(
		linePath(
			upTo,
			(p) => p.ga,
			(p) => p.sun * 100,
			sx,
			sSun
		)
	);
	/** Pieces of the thermostat's open history (it has none where no open balance exists). */
	const openPieces = $derived.by(() => {
		const out: HistoryPoint[][] = [];
		let cur: HistoryPoint[] = [];
		for (const p of upTo) {
			if (p.ppm === null) {
				if (cur.length) out.push(cur);
				cur = [];
			} else cur.push(p);
		}
		if (cur.length) out.push(cur);
		return out;
	});
	const co2Paths = $derived(
		openPieces.map((c) =>
			linePath(
				c,
				(p) => p.ga,
				(p) => lg(p.ppm!),
				sx,
				sc
			)
		)
	);
	const tPaths = $derived(
		openPieces.map((c) =>
			linePath(
				c,
				(p) => p.ga,
				(p) => toC(p.k!),
				sx,
				st
			)
		)
	);
	/** Fixed-CO₂ history, split where it jumps from frozen to open. */
	const fixedPieces = $derived.by(() => {
		const out: HistoryPoint[][] = [];
		let cur: HistoryPoint[] = [];
		for (const p of upTo) {
			if (cur.length && toC(cur[cur.length - 1].fixedK) < -20 !== toC(p.fixedK) < -20) {
				out.push(cur);
				cur = [];
			}
			cur.push(p);
		}
		if (cur.length) out.push(cur);
		return out;
	});
	const fixedPaths = $derived(
		fixedPieces.map((c) =>
			linePath(
				c,
				(p) => p.ga,
				(p) => toC(p.fixedK),
				sx,
				st
			)
		)
	);
	/** Where the thermostat's planet has no open balance: frozen. */
	const frozenSpans = $derived.by(() => {
		const out: { a: number; b: number }[] = [];
		let a: number | null = null;
		for (const p of upTo) {
			if (p.ppm === null && a === null) a = p.ga;
			if (p.ppm !== null && a !== null) {
				out.push({ a, b: p.ga });
				a = null;
			}
		}
		if (a !== null) out.push({ a, b: ga });
		return out;
	});
	const gaText = $derived(ga < 0.01 ? 'today' : `${ga.toFixed(1)} billion years ago`);
	const fmtPpm = (v: number) =>
		v >= 1e6 ? '1 bar' : v >= 1e4 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
</script>

<g>
	<Readout id="title">
		<Label
			x={X0}
			y={44}
			text="The faint young Sun and the thermostat (one model’s history, not a measured one)"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>

	{#each frozenSpans as f, i (i)}
		<rect
			x={sx(f.a)}
			y={190}
			width={Math.max(0, sx(f.b) - sx(f.a))}
			height={340}
			fill="var(--cst-frozen)"
		/>
	{/each}

	<Axes {sx} sy={sSun} xTicks={[]} yTicks={[70, 85, 100]} yFormat={(v: number) => `${v} %`} />
	<path d={sunPath} fill="none" stroke="var(--cst-sun)" stroke-width="2.5" />
	<Readout id="sunk">
		<Label
			x={X0 + 8}
			y={78}
			text="sunlight"
			anchor="start"
			size={12}
			weight={600}
			color="var(--cst-sun)"
		/>
	</Readout>

	<Axes
		{sx}
		sy={sc}
		xTicks={[]}
		yTicks={[2, 3, 4, 5, 6]}
		yFormat={(v: number) => fmtPpm(10 ** v)}
		yLabel="CO₂, ppm"
	/>
	{#each co2Paths as d, i (i)}
		<path {d} fill="none" stroke="var(--cst-co2)" stroke-width="2.5" />
	{/each}
	<line
		x1={X0}
		x2={X1}
		y1={sc(lg(280))}
		y2={sc(lg(280))}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
		opacity="0.7"
	/>

	<Axes
		{sx}
		sy={st}
		xLabel="billion years ago"
		xTicks={[4.5, 4, 3, 2, 1, 0]}
		xFormat={(v: number) => (v === 0 ? 'today' : `${v}`)}
		yLabel="°C"
		yTicks={[-60, -40, -20, 0, 20]}
		yFormat={(v: number) => (v < 0 ? `−${-v}` : `${v}`)}
	/>
	<line x1={X0} x2={X1} y1={st(0)} y2={st(0)} stroke="var(--cst-ice-edge)" stroke-dasharray="2 3" />
	{#each fixedPaths as d, i (i)}
		<path {d} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" stroke-dasharray="6 4" />
	{/each}
	{#each tPaths as d, i (i)}
		<path {d} fill="none" stroke="var(--cst-temp)" stroke-width="2.5" />
	{/each}

	<!-- cursor -->
	<line
		x1={sx(ga)}
		x2={sx(ga)}
		y1={84}
		y2={530}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.6"
	/>
	{#if now.ppm !== null}
		<circle
			cx={sx(ga)}
			cy={sc(lg(now.ppm))}
			r="5"
			fill="var(--cst-co2)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={sx(ga)}
			cy={st(toC(now.k!))}
			r="5"
			fill="var(--cst-temp)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}
	<circle cx={sx(ga)} cy={st(toC(now.fixedK))} r="4" fill="var(--stage-ink-muted)" />

	<!-- readouts -->
	<g>
		<Readout id="when" order={1} label="When" value={gaText}>
			<Label x={748} y={120} text={gaText} anchor="start" size={15} weight={700} />
		</Readout>
		<Readout
			id="sun"
			order={2}
			label="Sunlight"
			value="{Math.round(now.sun * 100)} % of today’s"
			color="var(--cst-sun)"
		>
			<Label
				x={748}
				y={146}
				text="Sun {Math.round(now.sun * 100)} % of today’s"
				anchor="start"
				weight={600}
				color="var(--cst-sun)"
				tabular
			/>
		</Readout>
		<Readout
			id="co2"
			order={3}
			label="Thermostat"
			value={now.ppm === null
				? 'no open balance: frozen'
				: `${co2Text(now.ppm)}, ${celsiusText(now.k!)}`}
			color="var(--cst-co2)"
		>
			<Label x={748} y={sc(4) - 10} text="with the thermostat:" anchor="start" size={12} muted />
			<Label
				x={748}
				y={sc(4) + 10}
				text={now.ppm === null ? 'frozen, no balance' : co2Text(now.ppm)}
				anchor="start"
				weight={700}
				color="var(--cst-co2)"
				tabular
			/>
			<Label
				x={748}
				y={st(5) - 6}
				text={now.ppm === null ? '' : celsiusText(now.k!)}
				anchor="start"
				weight={700}
				color="var(--cst-temp)"
				tabular
			/>
		</Readout>
		<Readout id="fixed" order={4} label="CO₂ held at 280 ppm" value={celsiusText(now.fixedK)}>
			<Label x={748} y={st(-45) - 18} text="CO₂ held at 280 ppm:" anchor="start" size={12} muted />
			<Label
				x={748}
				y={st(-45) + 2}
				text={celsiusText(now.fixedK)}
				anchor="start"
				weight={700}
				muted
				tabular
			/>
		</Readout>
	</g>
	{#if frozenSpans.length}
		<Readout id="frozen-key">
			<Label
				x={sx(frozenSpans[0].a) + 6}
				y={522}
				text="no open balance"
				anchor="start"
				size={11}
				color="var(--cst-ice-edge)"
				weight={600}
			/>
		</Readout>
	{/if}
</g>
