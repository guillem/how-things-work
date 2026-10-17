<script lang="ts">
	/**
	 * The MEGA-plate: a long dish of agar in bands of antibiotic, drug-free at
	 * both ends and 3,000 × the wild type's MIC in the middle (`runPlate`).
	 * Each patch of agar is drawn as a column whose colours are the shares of
	 * its resistance classes, its height the patch's fullness (log scale, so a
	 * handful of cells already shows). Below: the most resistant class present,
	 * generation by generation.
	 *
	 * Controls: `params.steps` (intermediate bands), `params.plateMu`, `params.K`,
	 * `params.again` (seed). The run is computed once per setting and replayed at
	 * GPS generations a second; reduced motion shows the last generation.
	 */
	import { Axes, Label, clamp, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BANDS, CLASSES, PATCHES_PER_BAND, mic, runPlate } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const intermediate = $derived(params.steps !== false);
	const mu = $derived(Number(params.plateMu ?? 1e-7));
	const K = $derived(Number(params.K ?? 1e7));
	const runs = $derived(Number(params.again ?? 0));
	const GENS = 300;
	const EVERY = 2;
	const run = $derived(
		runPlate({ K, mu, intermediate, generations: GENS, seed: 5 + runs * 7919, every: EVERY })
	);

	const LEAD = 0.6;
	const GPS = 20;
	const g = $derived(reduced ? GENS : clamp(Math.floor((t - LEAD) * GPS), 0, GENS));
	const snap = $derived(run.snapshots[Math.floor(g / EVERY)]);
	const best = $derived(run.best[Math.floor(g / EVERY)]);

	// ---- the plate
	const PX0 = 24;
	const PX1 = 936;
	const PY0 = 112;
	const PY1 = 300;
	const P = $derived(run.drug.length);
	const pw = $derived((PX1 - PX0) / P);
	const classColour = (k: number) => `var(--ev-r${k})`;
	const bands = $derived.by(() => {
		const out: { x0: number; x1: number; drug: number; key: number }[] = [];
		for (let i = 0; i < P; i += PATCHES_PER_BAND) {
			out.push({
				x0: PX0 + i * pw,
				x1: PX0 + (i + PATCHES_PER_BAND) * pw,
				drug: run.drug[i],
				key: i
			});
		}
		return out;
	});
	const drugLabel = (d: number) => (d === 0 ? 'no drug' : `${d.toLocaleString('en-GB')}×`);
	const columns = $derived(
		snap.map((row, i) => {
			const total = row.reduce((s, x) => s + x, 0);
			const full = total < 1 ? 0 : clamp(Math.log10(total) / Math.log10(K));
			const h = full * (PY1 - PY0 - 16);
			let y = PY1 - 8;
			const parts: { y: number; h: number; k: number }[] = [];
			for (let k = 0; k < CLASSES; k++) {
				if (row[k] <= 0 || total <= 0) continue;
				const hk = (row[k] / total) * h;
				y -= hk;
				parts.push({ y, h: hk, k });
			}
			return { x: PX0 + i * pw + 2, parts, key: i };
		})
	);

	// ---- the chart
	const CX0 = 130;
	const CX1 = 900;
	const CY0 = 380;
	const CY1 = 520;
	const cx = scale([0, GENS], [CX0, CX1]);
	const cy = scale([0, CLASSES - 1], [CY1, CY0]);
	const bestPath = $derived.by(() => {
		let d = '';
		const n = Math.floor(g / EVERY);
		for (let i = 0; i <= n; i++) {
			const x = cx(i * EVERY).toFixed(1);
			const y = cy(run.best[i]).toFixed(1);
			d += i === 0 ? `M${x} ${y}` : `H${x} V${y}`;
		}
		return d;
	});
	const micLabel = (k: number) => `${mic(k).toLocaleString('en-GB')}×`;
	const reached = $derived.by(() => {
		let top = 0;
		snap.forEach((row, i) => {
			if (row.reduce((s, x) => s + x, 0) >= 1) top = Math.max(top, run.drug[i]);
		});
		return top;
	});
</script>

<g>
	<Label
		x={PX0}
		y={40}
		anchor="start"
		size={14}
		weight={600}
		text="A dish of agar with bands of antibiotic (× the dose that stops the original bacteria)"
	/>
	{#each bands as b (b.key)}
		<Label
			x={(b.x0 + b.x1) / 2}
			y={PY0 - 14}
			text={drugLabel(b.drug)}
			size={12}
			weight={b.drug === BANDS[BANDS.length - 1] ? 700 : 500}
		/>
	{/each}
	<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="12" fill="var(--ev-agar)" />
	{#each bands as b (b.key)}
		{#if b.drug > 0}
			<rect
				x={b.x0}
				y={PY0}
				width={b.x1 - b.x0}
				height={PY1 - PY0}
				fill="var(--ev-drug)"
				opacity={0.12 + 0.38 * (Math.log10(b.drug) / Math.log10(3000))}
			/>
		{/if}
		<line x1={b.x0} x2={b.x0} y1={PY0} y2={PY1} stroke="var(--stage-bg)" stroke-opacity="0.35" />
	{/each}
	{#each columns as c (c.key)}
		{#each c.parts as p (p.k)}
			<rect x={c.x} y={p.y} width={pw - 4} height={Math.max(0.5, p.h)} fill={classColour(p.k)} />
		{/each}
	{/each}

	<!-- key of the resistance classes -->
	<Readout
		id="key"
		order={4}
		label="Colours"
		value="grey 1×, blue 10×, green 100×, amber 1,000×, red 10,000× the original dose"
	>
		{#each Array.from({ length: CLASSES }, (_, k) => k) as k (k)}
			<rect
				x={PX0 + 6 + k * 150}
				y={PY1 + 18}
				width="14"
				height="14"
				rx="3"
				fill={classColour(k)}
			/>
			<Label
				x={PX0 + 26 + k * 150}
				y={PY1 + 30}
				anchor="start"
				text="survives {micLabel(k)}"
				size={11}
				muted
			/>
		{/each}
	</Readout>

	<Label
		x={CX0}
		y={CY0 - 18}
		anchor="start"
		size={13}
		weight={600}
		text="Most resistant bacteria on the dish"
	/>
	<Axes sx={cx} sy={cy} yTicks={[0, 1, 2, 3, 4]} yFormat={micLabel} xLabel="generations" />
	<path d={bestPath} stroke="var(--ev-r4)" stroke-width="2.5" fill="none" />
	<Readout id="gen" order={1} label="Generation" value={String(g)}>
		<Label x={CX1} y={CY0 - 18} anchor="end" text="generation {g}" size={13} weight={600} />
	</Readout>
	<Readout
		id="best"
		order={2}
		label="Most resistant"
		value="survives {micLabel(best)} the original dose"
		color={classColour(best)}
	>
		<Label
			x={CX0}
			y={576}
			anchor="start"
			text="most resistant: survives {micLabel(best)}"
			size={13}
			weight={600}
			color={classColour(best)}
		/>
	</Readout>
	<Readout
		id="reach"
		order={3}
		label="Spread to"
		value={reached === 0
			? 'only the drug-free bands'
			: `the ${reached.toLocaleString('en-GB')}× band`}
	>
		<Label
			x={CX1}
			y={576}
			anchor="end"
			text={reached === 0
				? 'stuck in the drug-free bands'
				: `spread into the ${reached.toLocaleString('en-GB')}× band`}
			size={12}
			muted
		/>
	</Readout>
</g>
