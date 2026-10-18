<script lang="ts">
	/**
	 * A batch culture on glucose and lactose (../model.ts `culture`, `pause`), started from cells
	 * grown on glucose: three charts against time, the density (OD₆₀₀, log scale), the two sugars
	 * left (mM) and the lac expression (% of full). The diauxic pause is shaded across all three.
	 * Controls: `g0`, `l0` (mM at the start) on the first step; `strain` on the second, where the
	 * wild type stays as a faint dashed reference. The charts draw themselves at SPEED hours per
	 * second and then hold; reduced motion shows the whole run.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { culture, pauseWindow, type CulturePoint, type Strain } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const offers = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const g0 = $derived(offers('g0') ? Number(params.g0 ?? 1) : 1);
	const l0 = $derived(offers('l0') ? Number(params.l0 ?? 2) : 2);
	const strain = $derived((offers('strain') ? String(params.strain ?? 'wild') : 'wild') as Strain);

	const HOURS = 10;
	const SPEED = 0.5;
	const run = (s: Strain) => culture({ glucose: g0, lactose: l0, hours: HOURS, strain: s });
	const trace = $derived(run(strain));
	const wild = $derived(strain === 'wild' ? null : run('wild'));
	const now = $derived(reduced ? HOURS : Math.min(HOURS, t * SPEED));
	const shown = $derived(trace.filter((p) => p.t <= now + 1e-9));
	const last = $derived(shown.at(-1) ?? trace[0]);

	// ---- the pause --------------------------------------------------------------------------
	const gone = $derived(trace.find((p) => p.glucose < 0.001));
	/** The shaded pause. */
	const band = $derived(pauseWindow(trace));
	const fmtMin = (h: number) => `${Math.round(h * 60)} min`;

	// ---- layout -------------------------------------------------------------------------------
	const X0 = 100;
	const X1 = 760;
	const VX = X1 + 14;
	const sx = scale([0, HOURS], [X0, X1]);
	const syOD = scale([-2, 0.4], [230, 70]);
	const sugarTop = $derived(Math.max(1, Math.ceil(Math.max(g0, l0))));
	const syS = $derived(scale([0, sugarTop], [400, 290]));
	const syY = scale([0, 100], [540, 450]);

	const odPath = (pts: readonly CulturePoint[]) =>
		linePath(
			pts,
			(p) => p.t,
			(p) => Math.log10(p.od),
			sx,
			syOD
		);
	const gPath = (pts: readonly CulturePoint[]) =>
		linePath(
			pts,
			(p) => p.t,
			(p) => p.glucose,
			sx,
			syS
		);
	const lPath = (pts: readonly CulturePoint[]) =>
		linePath(
			pts,
			(p) => p.t,
			(p) => p.lactose,
			sx,
			syS
		);
	const yPath = (pts: readonly CulturePoint[]) =>
		linePath(
			pts,
			(p) => p.t,
			(p) => Math.min(100, p.y),
			sx,
			syY
		);

	const strainName: Record<Strain, string> = {
		wild: 'wild type',
		uv5: 'promoter blind to CAP-cAMP',
		lacI: 'no repressor',
		noexcl: 'permease glucose cannot block'
	};
	const showBand = $derived(band !== null && now >= band.start);
	const odFmt = (v: number) => String(Number((10 ** v).toPrecision(1)));
</script>

<g>
	<Readout id="title" order={1} label="Culture" value="{strainName[strain]}, {last.t.toFixed(1)} h">
		<Label
			x={24}
			y={30}
			text="{strainName[strain]} · {g0.toFixed(1)} mM glucose + {l0.toFixed(
				1
			)} mM lactose · {last.t.toFixed(1)} h"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	{#if band && showBand}
		<rect
			x={sx(band.start)}
			y={60}
			width={Math.max(0, sx(Math.min(now, band.end)) - sx(band.start))}
			height={485}
			fill="var(--lo-band)"
		/>
	{/if}

	<!-- density -->
	<Axes
		{sx}
		sy={syOD}
		xTicks={[]}
		yTicks={[-2, -1, 0]}
		yFormat={odFmt}
		yLabel="cells (OD₆₀₀, log scale)"
	/>
	{#if wild}
		<path
			d={odPath(wild)}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
			opacity="0.6"
		/>
	{/if}
	<path d={odPath(shown)} fill="none" stroke="var(--stage-ink)" stroke-width="2.6" />
	<Readout id="od" order={2} label="Density" value="OD {last.od.toFixed(2)}">
		<Label
			x={VX}
			y={syOD(Math.log10(last.od)) + 4}
			text="OD {last.od.toFixed(2)}"
			size={12}
			anchor="start"
			weight={600}
			tabular
		/>
	</Readout>
	{#if band && showBand}
		<Readout id="pause" order={3} label="Diauxic pause" value={fmtMin(band.end - band.start)}>
			<Label
				x={sx(band.start) + 6}
				y={86}
				text="pause: {fmtMin(band.end - band.start)}"
				size={13}
				anchor="start"
				weight={600}
				pill
			/>
		</Readout>
	{:else if !band && gone && now > gone.t + 1}
		<Readout id="pause" order={3} label="Diauxic pause" value="none">
			<Label x={sx(gone.t) + 6} y={86} text="no pause" size={13} anchor="start" weight={600} pill />
		</Readout>
	{/if}

	<!-- sugars -->
	<Axes {sx} sy={syS} xTicks={[]} yTicks={[0, sugarTop / 2, sugarTop]} yLabel="sugar left (mM)" />
	{#if wild}
		<path
			d={gPath(wild)}
			fill="none"
			stroke="var(--lo-glucose)"
			stroke-width="1.4"
			stroke-dasharray="4 4"
			opacity="0.45"
		/>
		<path
			d={lPath(wild)}
			fill="none"
			stroke="var(--lo-lactose)"
			stroke-width="1.4"
			stroke-dasharray="4 4"
			opacity="0.45"
		/>
	{/if}
	<path d={gPath(shown)} fill="none" stroke="var(--lo-glucose)" stroke-width="2.6" />
	<path d={lPath(shown)} fill="none" stroke="var(--lo-lactose)" stroke-width="2.6" />
	<Readout
		id="glc"
		order={4}
		label="Glucose"
		value="{last.glucose.toFixed(2)} mM"
		color="var(--lo-glucose)"
	>
		<Label
			x={VX}
			y={Math.min(syS(last.glucose), syS(last.lactose) - 16) + 4}
			text="glucose {last.glucose.toFixed(2)}"
			size={12}
			anchor="start"
			color="var(--lo-glucose)"
			weight={600}
			tabular
		/>
	</Readout>
	<Readout
		id="lac"
		order={5}
		label="Lactose"
		value="{last.lactose.toFixed(2)} mM"
		color="var(--lo-lactose)"
	>
		<Label
			x={VX}
			y={Math.max(syS(last.lactose), syS(last.glucose) + 16) + 4}
			text="lactose {last.lactose.toFixed(2)}"
			size={12}
			anchor="start"
			color="var(--lo-lactose)"
			weight={600}
			tabular
		/>
	</Readout>

	<!-- lac expression -->
	<Axes {sx} sy={syY} yTicks={[0, 50, 100]} xLabel="hours" yLabel="lac expression (% of full)" />
	{#if wild}
		<path
			d={yPath(wild)}
			fill="none"
			stroke="var(--lo-lacy)"
			stroke-width="1.4"
			stroke-dasharray="4 4"
			opacity="0.45"
		/>
	{/if}
	<path d={yPath(shown)} fill="none" stroke="var(--lo-lacy)" stroke-width="2.6" />
	<Readout
		id="y"
		order={6}
		label="Lac expression"
		value="{last.y < 10 ? last.y.toFixed(1) : last.y.toFixed(0)} % of full"
		color="var(--lo-lacy)"
	>
		<Label
			x={VX}
			y={syY(Math.min(100, last.y)) + 4}
			text="lac {last.y < 10 ? last.y.toFixed(1) : last.y.toFixed(0)} %"
			size={12}
			anchor="start"
			color="var(--lo-lacy)"
			weight={600}
			tabular
		/>
	</Readout>
	{#if wild}
		<Readout id="wild-key">
			<Label x={X1} y={52} text="dashed: wild type" size={11} anchor="end" muted />
		</Readout>
	{/if}
</g>
