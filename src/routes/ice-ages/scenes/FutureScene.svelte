<script lang="ts">
	/**
	 * From 200,000 years ago to 100,000 years ahead: the stretch of the orbit
	 * and the 65° N summer sunshine (La2004, computed into the future), and CO₂
	 * from the ice up to 1850 plus today's value. The future part is drawn
	 * from today onwards over the first seconds of the step. The swing of the
	 * next 100,000 years and its deepest low are computed from the orbit.
	 */
	import { Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CO2, CO2_NOW, orbitSeries } from '../milankovitch';

	let { t, reduced }: StageProps = $props();

	const X0 = 110;
	const X1 = 900;
	// time in kyr, negative in the past
	const sx = scale([-200, 100], [X0, X1]);
	const ALL = orbitSeries(200, -100).map((p) => ({ k: -p.ka, e: p.o.e, s: p.summer }));
	const past = ALL.filter((p) => p.k <= 0);
	const future = ALL.filter((p) => p.k >= 0);
	const range = (a: number[]) => Math.max(...a) - Math.min(...a);
	const ratio =
		range(future.map((p) => p.s)) /
		range(ALL.filter((p) => p.k <= 0 && p.k >= -100).map((p) => p.s));
	const low = future.reduce((a, b) => (b.s < a.s ? b : a));
	const round = future.reduce((a, b) => (b.e < a.e ? b : a));

	const ey = scale([0, 0.05], [150, 74]);
	const syS = scale([425, 560], [330, 196]);
	const cy = scale([160, 440], [540, 384]);

	const until = $derived(reduced ? 100 : 100 * smoothstep(0.4, 7, t));
	const shown = $derived(future.filter((p) => p.k <= until));
	const ePast = linePath(
		past,
		(p) => p.k,
		(p) => p.e,
		sx,
		ey
	);
	const sPast = linePath(
		past,
		(p) => p.k,
		(p) => p.s,
		sx,
		syS
	);
	const eFut = $derived(
		linePath(
			shown,
			(p) => p.k,
			(p) => p.e,
			sx,
			ey
		)
	);
	const sFut = $derived(
		linePath(
			shown,
			(p) => p.k,
			(p) => p.s,
			sx,
			syS
		)
	);
	const co2 = CO2.filter((p) => p.ka <= 200).map((p) => ({ k: -p.ka, v: p.v }));
	const co2Path = linePath(
		co2,
		(p) => p.k,
		(p) => p.v,
		sx,
		cy
	);
	const done = $derived(until >= 100);
</script>

<g>
	<Readout id="title" order={0} label="The next 100,000 years" value="computed from the orbit">
		<Label
			x={X0}
			y={40}
			text="200,000 years back, 100,000 ahead"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	<rect x={sx(0)} y={60} width={X1 - sx(0)} height={490} fill="var(--ia-cold)" opacity="0.4" />
	<line
		x1={sx(0)}
		x2={sx(0)}
		y1={60}
		y2={550}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		opacity="0.6"
	/>
	<Readout id="today"><Label x={sx(0)} y={572} text="today" size={12} weight={700} /></Readout>
	{#each [-200, -150, -100, -50, 50, 100] as v (v)}
		<text x={sx(v)} y={572} text-anchor="middle" font-size="11" class="muted"
			>{v < 0 ? `${-v} ka` : `+${v} kyr`}</text
		>
	{/each}

	<!-- stretch -->
	<line x1={X0} x2={X1} y1={ey(0)} y2={ey(0)} stroke="var(--stage-grid)" />
	<path d={ePast} fill="none" stroke="var(--ia-ecc)" stroke-width="1.8" />
	<path d={eFut} fill="none" stroke="var(--ia-ecc)" stroke-width="2.4" />
	<Readout id="e-name">
		<Label
			x={X0 - 10}
			y={ey(0.04)}
			text="stretch"
			anchor="end"
			size={12}
			weight={700}
			color="var(--ia-ecc)"
		/>
	</Readout>

	<!-- summer sunshine -->
	<line x1={X0} x2={X1} y1={syS(425)} y2={syS(425)} stroke="var(--stage-grid)" />
	<path d={sPast} fill="none" stroke="var(--ia-sun)" stroke-width="1.8" />
	<path d={sFut} fill="none" stroke="var(--ia-sun)" stroke-width="2.4" />
	<Readout id="s-name">
		<Label
			x={X0 - 10}
			y={syS(530)}
			text="summer"
			anchor="end"
			size={12}
			weight={700}
			color="var(--ia-sun)"
		/>
		<Label
			x={X0 - 10}
			y={syS(530) + 15}
			text="sunshine"
			anchor="end"
			size={12}
			weight={700}
			color="var(--ia-sun)"
		/>
		<Label x={X0 - 10} y={syS(530) + 30} text="65° N" anchor="end" size={10} muted />
	</Readout>

	{#if done}
		<Readout
			id="round"
			order={1}
			label="Rounder orbit"
			value="e = {round.e.toFixed(3)} in {round.k.toFixed(0)},000 years"
			color="var(--ia-ecc)"
		>
			<Label
				x={sx(round.k)}
				y={ey(round.e) + 18}
				text="nearly round: e = {round.e.toFixed(3)} in {round.k.toFixed(0)},000 years"
				size={11}
				weight={600}
				color="var(--ia-ecc)"
			/>
		</Readout>
		<Readout
			id="low"
			order={2}
			label="Next deep low"
			value="{low.s.toFixed(0)} W/m² in {low.k.toFixed(0)},000 years; swings {Math.round(
				ratio * 100
			)}% of the last 100,000 years'"
			color="var(--ia-sun)"
		>
			<circle cx={sx(low.k)} cy={syS(low.s)} r="5" fill="var(--ia-sun)" />
			<Label
				x={sx(low.k)}
				y={syS(low.s) + 22}
				text="next deep low: {low.k.toFixed(0)},000 years from now"
				size={11}
				weight={600}
				color="var(--ia-sun)"
			/>
			<Label
				x={X1}
				y={syS(560) - 6}
				text="swings {Math.round(ratio * 100)}% as large as over the last 100,000 years"
				anchor="end"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- CO₂ -->
	<line x1={X0} x2={X1} y1={cy(280)} y2={cy(280)} stroke="var(--stage-grid)" />
	<path d={co2Path} fill="none" stroke="var(--ia-co2)" stroke-width="1.8" />
	<line
		x1={sx(0)}
		x2={sx(0) + 4}
		y1={cy(280)}
		y2={cy(CO2_NOW.ppm)}
		stroke="var(--ia-now)"
		stroke-width="2.5"
	/>
	<circle
		cx={sx(0) + 4}
		cy={cy(CO2_NOW.ppm)}
		r="6"
		fill="var(--ia-now)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout id="c-name">
		<Label
			x={X0 - 10}
			y={cy(300)}
			text="CO₂"
			anchor="end"
			size={12}
			weight={700}
			color="var(--ia-co2)"
		/>
		<Label x={X0 - 10} y={cy(300) + 15} text="ppm" anchor="end" size={10} muted />
		<text x={X0 - 10} y={cy(200) + 4} text-anchor="end" font-size="10" class="muted">200</text>
		<text x={X0 - 10} y={cy(400) + 4} text-anchor="end" font-size="10" class="muted">400</text>
	</Readout>
	<Readout
		id="co2-now"
		order={3}
		label="CO₂ today"
		value="{CO2_NOW.ppm.toFixed(0)} ppm ({CO2_NOW.year})"
		color="var(--ia-now)"
	>
		<Label
			x={sx(0) + 16}
			y={cy(CO2_NOW.ppm) + 4}
			text="{CO2_NOW.ppm.toFixed(0)} ppm today, far above anything in the ice"
			anchor="start"
			size={12}
			weight={700}
			color="var(--ia-now)"
		/>
	</Readout>
	<Readout
		id="co2-pre"
		order={4}
		label="With CO₂ at 280 ppm"
		value="next glacial in about 50,000 years (models)"
	>
		<Label
			x={X1}
			y={cy(250)}
			text="with pre-industrial CO₂, the next"
			anchor="end"
			size={11}
			muted
		/>
		<Label
			x={X1}
			y={cy(250) + 15}
			text="glacial in about 50,000 years"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
