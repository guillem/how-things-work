<script lang="ts">
	/**
	 * Step "yield": the ATP ledger of one glucose, from the model's
	 * `atpYield(count, shuttle)`. One row per source (substrate-level ATP,
	 * GTP, each pool of NADH and FADH₂), each drawn as orange ATP tiles —
	 * fractional P/O ratios give part-filled tiles — that fill in one after
	 * another, then the total and the share of glucose's energy it keeps.
	 * Fermentation's 2 ATP sit underneath for scale.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, clamp } from '#lib/draw/index.ts';
	import {
		DG_ATP_CELL,
		FERMENTATION_ATP,
		atpYield,
		efficiency,
		type Count,
		type Shuttle
	} from '../model';

	let { t, params, reduced }: StageProps = $props();
	const count = $derived(String(params.count ?? 'measured') as Count);
	const shuttle = $derived(String(params.shuttle ?? 'malate') as Shuttle);
	const y = $derived(atpYield(count, shuttle));

	const TILE = 17;
	const GAP = 3;
	const X0 = 452;
	const ROW0 = 80;
	const DY = 58;
	/** Tiles drawn so far: they appear at 6 per second, row after row. */
	const shown = $derived(reduced ? 99 : t * 6);
	const rowStart = $derived(
		y.rows.map((_, i) => y.rows.slice(0, i).reduce((a, r) => a + Math.ceil(r.atp - 1e-9), 0))
	);
	const fmt = (v: number) =>
		Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : v.toFixed(1);
	const totalShown = $derived(Math.min(y.total, shown));
	const done = $derived(shown >= y.total);
	const countNote = $derived(
		count === 'measured'
			? 'measured P/O: 2.5 per NADH, 1.5 per FADH₂ (Hinkle 2005)'
			: count === 'ring'
				? 'c₈ ring, no leak: 10 ÷ 3.7 ≈ 2.7 and 6 ÷ 3.7 ≈ 1.6 (an upper limit)'
				: 'old whole numbers, 3 and 2: before the protons were counted (outdated)'
	);
	const ty = $derived(ROW0 + y.rows.length * DY);
	const breakdown = $derived(y.rows.map((r) => fmt(r.atp)).join(' + '));
	const effStd = $derived(Math.round(100 * efficiency(y.total)));
	const effCell = $derived(Math.round(100 * efficiency(y.total, DG_ATP_CELL)));
</script>

<g class="ledger-scene">
	<Readout id="head">
		<Label x={24} y={36} text="ATP from one glucose" anchor="start" size={15} weight={700} />
	</Readout>
	<Readout id="note" order={0} label="Counting" value={countNote}>
		<Label x={936} y={36} text={countNote} anchor="end" size={11} muted />
	</Readout>

	{#each y.rows as r, i (r.id)}
		{@const ry = ROW0 + i * DY}
		{@const tiles = Math.ceil(r.atp - 1e-9)}
		<text x="24" y={ry + 4} font-size="12" font-weight="600">{r.label}</text>
		<text x="24" y={ry + 20} font-size="11" class="muted"
			>{r.id.endsWith('-atp') ? `${r.n} made directly` : `${r.n} × ${fmt(r.per)} ATP each`}</text
		>
		{#each Array.from({ length: tiles }, (_, k) => k) as k (k)}
			{@const f = clamp(r.atp - k)}
			{@const vis = clamp(shown - rowStart[i] - k)}
			<rect
				x={X0 + k * (TILE + GAP)}
				y={ry - 6}
				width={TILE}
				height={TILE}
				rx="4"
				fill="none"
				stroke="#f97316"
				stroke-width="1"
				opacity={0.5 * vis}
			/>
			<rect
				x={X0 + k * (TILE + GAP)}
				y={ry - 6}
				width={TILE * f}
				height={TILE}
				rx="4"
				fill="#f97316"
				opacity={vis}
			/>
		{/each}
		<text x="936" y={ry + 8} font-size="14" font-weight="700" text-anchor="end">{fmt(r.atp)}</text>
	{/each}

	<!-- total -->
	<line x1="24" y1={ty - 18} x2="936" y2={ty - 18} stroke="var(--border)" />
	<Readout
		id="total"
		order={2}
		label="Total per glucose"
		value="{breakdown} = {fmt(y.total)} ATP"
		note="keeps {effStd}% of glucose's energy at −30.5 kJ per ATP, {effCell}% at a cell's ≈ 50 kJ"
	>
		<text x="24" y={ty + 8} font-size="15" font-weight="700">total per glucose</text>
		<text x="936" y={ty + 10} font-size="22" font-weight="800" text-anchor="end" fill="#f97316"
			>{fmt(done ? y.total : Math.floor(totalShown))} ATP</text
		>
	</Readout>
	<Readout id="eff">
		<text x="24" y={ty + 32} font-size="12" class="muted" opacity={done ? 1 : 0.3}
			>keeps {effStd}% of glucose's 2,840 kJ/mol at the standard −30.5 kJ per ATP, {effCell}% at the
			≈ 50 kJ an ATP is worth in a cell</text
		>
	</Readout>

	<!-- fermentation for scale -->
	<g opacity={done ? 1 : 0.3}>
		<text x="24" y={ty + 70} font-size="12" font-weight="600">without oxygen (fermentation)</text>
		{#each Array.from({ length: FERMENTATION_ATP }, (_, k) => k) as k (k)}
			<rect
				x={X0 + k * (TILE + GAP)}
				y={ty + 58}
				width={TILE}
				height={TILE}
				rx="4"
				fill="#f97316"
			/>
		{/each}
		<Readout id="ferm" order={3} label="Without oxygen" value="{FERMENTATION_ATP} ATP">
			<text x="936" y={ty + 74} font-size="14" font-weight="700" text-anchor="end"
				>{FERMENTATION_ATP}</text
			>
		</Readout>
	</g>
</g>
