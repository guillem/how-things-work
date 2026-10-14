<script lang="ts">
	/**
	 * Efficiency against band gap (`step.hints.phase`):
	 * - limit: the Shockley–Queisser limit of the model (solid) and the ceiling left by the two
	 *   spectrum losses alone (dashed); a handle on the curve sets `params.gap`; the peak
	 *   (33.7% at 1.34 eV) is marked.
	 * - records: as limit, plus the record cells of the NLR chart. Silicon and gallium arsenide
	 *   sit at their band gaps; the others (gaps that depend on composition) and the
	 *   multi-junction cells are marks on a column at the right, on the same efficiency scale.
	 */
	import { Axes, Handle, clamp, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GAAS_GAP, GAPS, bestGap, cell, spectrumCeiling } from '../model';
	import { RECORDS } from '../records';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, params, setParam }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'limit'));
	const records = $derived(phase === 'records');
	const gap = $derived(clamp(Number(params.gap ?? GAPS.Si.gap), 0.5, 3));

	const X0 = 96;
	const X1 = 600;
	const Y0 = 70;
	const Y1 = 500;
	const sg = scale([0.5, 3], [X0, X1]);
	const se = scale([0, 50], [Y1, Y0]);
	const grid = Array.from({ length: 251 }, (_, i) => 0.5 + i * 0.01);
	const limitPts = grid.map((g) => ({ g, e: cell(g).efficiency * 100 }));
	const ceilPts = grid.map((g) => ({ g, e: spectrumCeiling(g) * 100 }));
	const pathOf = (pts: { g: number; e: number }[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${sg(p.g).toFixed(1)} ${se(p.e).toFixed(1)}`).join('');
	const limitPath = pathOf(limitPts);
	const ceilPath = pathOf(ceilPts);
	const limitArea = `${limitPath}L${X1} ${Y1}L${X0} ${Y1}Z`;
	const best = bestGap();

	const c = $derived(cell(gap));
	const eff = $derived(c.efficiency * 100);
	const ceil = $derived(spectrumCeiling(gap) * 100);

	const setGap = (g: number) => setParam('gap', Math.round(clamp(g, 0.5, 3) * 100) / 100);
	const onmove = (p: Point) => setGap(sg.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setGap(0.5) : k === 'end' ? setGap(3) : setGap(gap + k * 0.01);

	const rec = (key: string) => RECORDS.find((r) => r.key === key);
	const onGap = [
		{ key: 'si', g: GAPS.Si.gap, name: 'silicon' },
		{ key: 'gaas', g: GAAS_GAP, name: 'gallium arsenide' }
	].flatMap((o) => {
		const r = rec(o.key);
		return r ? [{ ...o, e: r.efficiency, year: r.year }] : [];
	});
	const column = [
		{ key: 'concentrator', name: '4 junctions, 665 suns', tandem: true },
		{ key: 'threeJunction', name: '3 junctions (III–V)', tandem: true },
		{ key: 'perovskiteSi', name: 'perovskite on silicon', tandem: true },
		{ key: 'perovskite', name: 'perovskite', tandem: false },
		{ key: 'cigs', name: 'CIGS', tandem: false },
		{ key: 'cdte', name: 'cadmium telluride', tandem: false }
	].flatMap((o) => {
		const r = rec(o.key);
		return r ? [{ ...o, e: r.efficiency }] : [];
	});
	/** Label heights on the column, pushed apart to at least 17 px. */
	const columnYs = (() => {
		const ys = column.map((r) => se(r.e));
		for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + 17);
		return ys;
	})();
	const CX = 680;
	const fmt = (e: number) => `${e.toFixed(1)}%`;
</script>

<g>
	<Axes
		sx={sg}
		sy={se}
		xTicks={[0.5, 1, 1.5, 2, 2.5, 3]}
		yTicks={[0, 10, 20, 30, 40, 50]}
		xFormat={(x: number) => x.toFixed(1)}
		yFormat={(y: number) => `${y}%`}
		xLabel="band gap (eV)"
		yLabel="efficiency in standard sunlight"
	/>
	<path d={limitArea} fill="var(--sc-output)" opacity="0.12" />
	<path
		d={ceilPath}
		fill="none"
		stroke="var(--sc-ceiling)"
		stroke-width="1.8"
		stroke-dasharray="7 5"
	/>
	<path d={limitPath} fill="none" stroke="var(--sc-output)" stroke-width="3" />
	<Readout
		id="ceil-label"
		order={5}
		label="Dashed: spectrum losses only"
		value="peak {fmt(Math.max(...ceilPts.map((p) => p.e)))}"
	>
		<T x={sg(1.95)} y={se(36)} text="spectrum losses only (no voltage loss)" size={12} muted />
	</Readout>
	<Readout id="limit-label">
		<T
			x={sg(2.12)}
			y={se(23)}
			text="Shockley–Queisser limit"
			size={13}
			weight={700}
			color="var(--sc-output)"
		/>
	</Readout>
	<!-- the peak -->
	<circle
		cx={sg(best.gap)}
		cy={se(best.efficiency * 100)}
		r="4.5"
		fill="var(--sc-output)"
		stroke="var(--stage-bg)"
	/>
	<Readout
		id="peak"
		order={4}
		label="Best single junction"
		value="{fmt(best.efficiency * 100)} at {best.gap.toFixed(2)} eV"
	>
		<T
			x={sg(best.gap) + 10}
			y={se(best.efficiency * 100) - 10}
			text="{fmt(best.efficiency * 100)} at {best.gap.toFixed(2)} eV"
			size={13}
			weight={700}
		/>
	</Readout>

	{#if records}
		{#each onGap as r (r.key)}
			<circle
				cx={sg(r.g)}
				cy={se(r.e)}
				r="6"
				fill="var(--sc-record)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<Readout
				id="rec-{r.key}"
				order={10}
				label="Record {r.name} ({r.year})"
				value={fmt(r.e)}
				color="var(--sc-record)"
			>
				<T
					x={sg(r.g) + (r.key === 'si' ? -10 : 10)}
					y={se(r.e) + 22}
					text="{r.name} {fmt(r.e)}"
					size={12}
					weight={600}
					anchor={r.key === 'si' ? 'end' : 'start'}
					color="var(--sc-record)"
				/>
			</Readout>
		{/each}
		<!-- the column: records whose gap is not one number -->
		<line x1={CX} x2={CX} y1={Y0} y2={Y1} stroke="var(--stage-line)" />
		<Readout id="col-title">
			<T x={CX} y={Y0 - 22} text="other records" size={12} anchor="middle" muted />
		</Readout>
		<line
			x1={CX - 8}
			x2={944}
			y1={se(best.efficiency * 100)}
			y2={se(best.efficiency * 100)}
			stroke="var(--sc-output)"
			stroke-dasharray="3 3"
			opacity="0.8"
		/>
		<Readout id="col-limit">
			<T
				x={940}
				y={se(best.efficiency * 100) + 14}
				text="one-junction limit"
				size={11}
				anchor="end"
				color="var(--sc-output)"
			/>
		</Readout>
		{#each column as r, k (r.key)}
			<circle
				cx={CX}
				cy={se(r.e)}
				r="5"
				fill={r.tandem ? 'var(--sc-tandem)' : 'var(--sc-record)'}
			/>
			<line x1={CX + 5} x2={CX + 14} y1={se(r.e)} y2={columnYs[k] - 4} stroke="var(--stage-line)" />
			<Readout
				id="col-{r.key}"
				order={11 + k}
				label={r.name}
				value={fmt(r.e)}
				color={r.tandem ? 'var(--sc-tandem)' : 'var(--sc-record)'}
			>
				<T
					x={CX + 16}
					y={columnYs[k]}
					text="{fmt(r.e)} {r.name}"
					size={12}
					weight={600}
					color={r.tandem ? 'var(--sc-tandem)' : 'var(--sc-record)'}
				/>
			</Readout>
		{/each}
		<Readout id="col-source">
			<T x={CX - 12} y={Y1 + 34} text="records: NLR (formerly NREL) chart, 2026" size={11} muted />
		</Readout>
	{:else}
		<Card x={640} y={110} w={300} h={118} />
		<Readout id="g" order={1} label="Band gap" value="{gap.toFixed(2)} eV">
			<T x={656} y={140} text="band gap {gap.toFixed(2)} eV" size={14} weight={700} />
		</Readout>
		<Readout id="e" order={2} label="Limit" value={fmt(eff)} color="var(--sc-output)">
			<T x={656} y={166} text="limit {fmt(eff)}" size={16} weight={700} color="var(--sc-output)" />
		</Readout>
		<Readout id="c" order={3} label="Spectrum losses only" value={fmt(ceil)}>
			<T x={656} y={190} text="spectrum losses only: {fmt(ceil)}" size={13} muted />
		</Readout>
		<Readout id="iv">
			<T
				x={656}
				y={212}
				text="Voc {c.voc.toFixed(2)} V · Jsc {(c.jsc / 10).toFixed(1)} mA/cm²"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<line
		x1={sg(gap)}
		x2={sg(gap)}
		y1={se(eff)}
		y2={Y1}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
	/>
	<Handle
		x={sg(gap)}
		y={se(eff)}
		label="Band gap"
		value={gap}
		min={0.5}
		max={3}
		valuetext="{gap.toFixed(2)} electron-volts, limit {fmt(eff)}"
		{onmove}
		{onkey}
	/>
</g>
