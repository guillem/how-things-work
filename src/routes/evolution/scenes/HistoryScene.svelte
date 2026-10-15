<script lang="ts">
	/**
	 * Evolution measured: charts of real data against the models.
	 *
	 * Phases (`step.hints.phase`):
	 *   moth   — left: the rise of the black peppered moth in Manchester, the
	 *            model (`dominantSelection`, one generation a year) from an
	 *            assumed 2% in 1848 with the advantage `params.rise`, against the
	 *            reported 98% in 1895; the cortex mutation of
	 *            about 1819 marked. Right: the fall near Cambridge, the model
	 *            from 12% in 2001 with the disadvantage `params.fall`, against the
	 *            Madingley shares (Cook et al. 2012, table 2)
	 *   lenski — the LTEE: each population's fitness (faint, `params.each`), the
	 *            mean of the nine complete populations (dots) and our power-law
	 *            fit; Cit⁺ marked at 31,500 generations
	 *
	 * The curves are drawn from left to right between LEAD and LEAD + SWEEP
	 * seconds (a pure function of t); reduced motion shows them whole.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MADINGLEY, dominantSelection, fitMadingley } from '../model';
	import { LTEE_GENERATIONS, LTEE_GRAND_MEAN, LTEE_POPULATIONS, LTEE_POWER_LAW } from '../ltee';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'moth'));
	const LEAD = 0.5;
	const SWEEP = 4;
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

	// ---- moth: the rise
	const Y0 = 110;
	const Y1 = 470;
	const rise = $derived(Number(params.rise ?? 0.32));
	const fall = $derived(Number(params.fall ?? 0.27));
	const ax = scale([1815, 1900], [80, 440]);
	const ay = scale([0, 1], [Y1, Y0]);
	const riseCurve = $derived(
		dominantSelection(0.02, rise, 1900 - 1848).map((share, i) => ({ year: 1848 + i, share }))
	);
	const riseShown = $derived(riseCurve.slice(0, Math.max(1, Math.round(u * riseCurve.length))));
	const at1895 = $derived(riseCurve[1895 - 1848].share);

	// ---- moth: the fall
	const bx = scale([2000, 2008], [560, 910]);
	const by = scale([0, 0.15], [Y1, Y0]);
	const fallCurve = $derived(
		dominantSelection(MADINGLEY[0].share, -fall, 6).map((share, i) => ({ year: 2001 + i, share }))
	);
	const fallShown = $derived(fallCurve.slice(0, Math.max(1, Math.round(u * fallCurve.length))));
	const bestFall = fitMadingley();
	const dataShown = $derived(reduced ? 1 : smoothstep(0, 1, (t - LEAD) / 1.5));

	// ---- LTEE
	const each = $derived(params.each !== false);
	const lx = scale([0, 50000], [90, 900]);
	const ly = scale([0.8, 2.2], [Y1 + 20, Y0 - 20]);
	const upto = $derived(u * 50000);
	const popPaths = $derived(
		LTEE_POPULATIONS.map((p) => {
			const pts = LTEE_GENERATIONS.map((g, k) => ({ g, w: p.fitness[k] })).filter(
				(d): d is { g: number; w: number } => d.w !== null && d.g <= upto
			);
			return {
				key: p.population,
				d: linePath(
					pts,
					(d) => d.g,
					(d) => d.w,
					lx,
					ly
				)
			};
		})
	);
	const grand = $derived(
		LTEE_GENERATIONS.map((g, k) => ({ g, w: LTEE_GRAND_MEAN[k] })).filter((d) => d.g <= upto)
	);
	const law = (g: number) => (LTEE_POWER_LAW.b * g + 1) ** LTEE_POWER_LAW.a;
	const lawPath = $derived(
		linePath(
			Array.from({ length: 101 }, (_, i) => (i / 100) * upto),
			(g) => g,
			law,
			lx,
			ly
		)
	);
	const last = $derived(grand.at(-1));
	const fmtGen = (v: number) => v.toLocaleString('en-GB');
	const fmtFit = (v: number) => `${v.toFixed(1)}×`;
</script>

<g>
	{#if phase === 'moth'}
		<!-- ===================== the rise, Manchester -->
		<Label x={80} y={52} anchor="start" size={14} weight={600} text="The rise: Manchester" />
		<Label
			x={80}
			y={74}
			anchor="start"
			size={12}
			muted
			text="share of peppered moths that are black"
		/>
		<Axes
			sx={ax}
			sy={ay}
			xTicks={[1820, 1840, 1860, 1880, 1900]}
			xFormat={String}
			yFormat={pct}
			yTicks={[0, 0.25, 0.5, 0.75, 1]}
		/>
		<line
			x1={ax(1819)}
			x2={ax(1819)}
			y1={Y0}
			y2={Y1}
			stroke="var(--ev-r3)"
			stroke-dasharray="3 3"
		/>
		<Readout
			id="mutation"
			order={5}
			label="The mutation"
			value="most likely ≈1819, perhaps older (van’t Hof et al. 2016)"
		>
			<Label
				x={ax(1819) + 6}
				y={Y0 + 14}
				anchor="start"
				text="mutation, ≈1819"
				size={11}
				color="var(--ev-r3)"
			/>
		</Readout>
		<path
			d={linePath(
				riseShown,
				(d) => d.year,
				(d) => d.share,
				ax,
				ay
			)}
			stroke="var(--ev-r1)"
			stroke-width="2.5"
			fill="none"
		/>
		<circle
			cx={ax(1848)}
			cy={ay(0.02)}
			r="5"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Label
			x={ax(1848) + 8}
			y={ay(0.02) - 10}
			anchor="start"
			text="1848: first on record (start: 2%)"
			size={11}
			muted
		/>
		<circle cx={ax(1895)} cy={ay(0.98)} r="4.5" fill="var(--stage-ink)" opacity={dataShown} />
		<Label
			x={ax(1895) - 8}
			y={ay(0.98) + 28}
			anchor="end"
			text="1895: 98% reported"
			size={11}
			muted
			opacity={dataShown}
		/>
		<Readout
			id="rise"
			order={1}
			label="Model, 1895"
			value="{pct1(at1895)} black with a {pct(rise)} advantage"
		>
			<Label
				x={80}
				y={Y1 + 48}
				anchor="start"
				text="model: {pct1(at1895)} black in 1895 (+{pct(rise)} survival)"
				size={13}
				weight={600}
				color="var(--ev-r1)"
			/>
		</Readout>
		<Readout id="riseKey" order={6}>
			<Label
				x={80}
				y={Y1 + 68}
				anchor="start"
				text="ring: assumed start · dot: reported in 1895"
				size={11}
				muted
			/>
		</Readout>

		<!-- ===================== the fall, near Cambridge -->
		<Label x={560} y={52} anchor="start" size={14} weight={600} text="The fall: near Cambridge" />
		<Label
			x={560}
			y={74}
			anchor="start"
			size={12}
			muted
			text="share black, Madingley light-trap samples"
		/>
		<Axes
			sx={bx}
			sy={by}
			xTicks={[2000, 2002, 2004, 2006, 2008]}
			xFormat={String}
			yFormat={pct}
			yTicks={[0, 0.05, 0.1, 0.15]}
		/>
		<path
			d={linePath(
				fallShown,
				(d) => d.year,
				(d) => d.share,
				bx,
				by
			)}
			stroke="var(--ev-r1)"
			stroke-width="2.5"
			fill="none"
		/>
		{#each MADINGLEY as d (d.year)}
			<circle cx={bx(d.year)} cy={by(d.share)} r="5" fill="var(--stage-ink)" opacity={dataShown} />
		{/each}
		<Readout
			id="fall"
			order={2}
			label="Model, 2007"
			value="{pct1(fallCurve[6].share)} black (measured 1%), best fit −{pct(bestFall)}"
		>
			<Label
				x={560}
				y={Y1 + 48}
				anchor="start"
				text="model: {pct1(fallCurve[6].share)} in 2007 (measured 1%)"
				size={13}
				weight={600}
				color="var(--ev-r1)"
			/>
			<Label
				x={560}
				y={Y1 + 68}
				anchor="start"
				text="dots: measured · best fit: −{pct(bestFall)} survival"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<Label
			x={90}
			y={52}
			anchor="start"
			size={14}
			weight={600}
			text="Lenski’s 12 populations of E. coli: fitness against their ancestor"
		/>
		<Axes
			sx={lx}
			sy={ly}
			xTicks={[0, 10000, 20000, 30000, 40000, 50000]}
			xFormat={fmtGen}
			yTicks={[1, 1.2, 1.4, 1.6, 1.8, 2]}
			yFormat={fmtFit}
			xLabel="generations"
		/>
		<line
			x1={lx(0)}
			x2={lx(50000)}
			y1={ly(1)}
			y2={ly(1)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 4"
		/>
		{#if each}
			{#each popPaths as p (p.key)}
				<path
					d={p.d}
					stroke="var(--ev-wander)"
					stroke-width="1"
					fill="none"
					stroke-opacity="0.55"
				/>
			{/each}
		{/if}
		<path d={lawPath} stroke="var(--ev-fixed)" stroke-width="2.5" fill="none" />
		{#each grand as d (d.g)}
			<circle cx={lx(d.g)} cy={ly(d.w)} r="3.6" fill="var(--ev-r1)" />
		{/each}
		<line
			x1={lx(31500)}
			x2={lx(31500)}
			y1={ly(2.15)}
			y2={ly(0.85)}
			stroke="var(--ev-r3)"
			stroke-dasharray="3 3"
			opacity={upto >= 31500 ? 1 : 0}
		/>
		<Readout
			id="cit"
			order={4}
			label="Citrate eaters"
			value="evolved in one population by 31,500 generations"
			opacity={upto >= 31500 ? 1 : 0}
		>
			<Label
				x={lx(31500) + 6}
				y={ly(2.12)}
				anchor="start"
				text="one population learns to eat citrate (31,500)"
				size={11}
				color="var(--ev-r3)"
				opacity={upto >= 31500 ? 1 : 0}
			/>
		</Readout>
		{#if last}
			<Readout
				id="mean"
				order={1}
				label="Generation {fmtGen(last.g)}"
				value="{last.w.toFixed(2)}× the ancestor’s fitness (mean)"
			>
				<Label
					x={110}
					y={Y0 - 10}
					anchor="start"
					text="generation {fmtGen(last.g)}: {last.w.toFixed(2)}× the ancestor (mean)"
					size={13}
					weight={600}
					color="var(--ev-r1)"
				/>
			</Readout>
		{/if}
		<Readout
			id="key"
			order={3}
			label="Key"
			value="dots: mean of 9 populations; green: power-law fit; grey: each population"
		>
			<Label
				x={900}
				y={Y1 + 86}
				anchor="end"
				text="dots: mean · green: our power-law fit{each ? ' · grey: each population' : ''}"
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>
