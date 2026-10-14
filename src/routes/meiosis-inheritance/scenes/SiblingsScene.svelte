<script lang="ts">
	/**
	 * Two children of the same parents: their 22 autosome pairs at true
	 * relative length (hg38), the left chromosome of each pair from the mother
	 * and the right from the father, coloured by the grandparent each stretch
	 * came from. The crossovers are drawn by the model from the HapMap genetic
	 * map. Below: the share of the genome the two inherited identically, and
	 * where it falls among 400 simulated sibling pairs. params.again: two new
	 * siblings. The children's chromosomes grow in over the first ~2 s.
	 */
	import { Label, cycle, rng, smoothstep } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { HUMAN_AUTOSOMES } from '../human-map';
	import { human, shared, stretches, type Child } from '../model';

	let { t, params }: StageProps = $props();

	const again = $derived(Number(params.again ?? 0));
	const pair = $derived.by(() => {
		const rand = rng(31 + again * 7919);
		return [human(rand), human(rand)] as [Child, Child];
	});
	const share = $derived(shared(pair[0], pair[1]));

	// 400 other sibling pairs, for the spread (fixed).
	const BINS = 17; // 33% … 67% in 2% bins
	const others = (() => {
		const rand = rng(5);
		const counts = new Array<number>(BINS).fill(0);
		for (let i = 0; i < 400; i++) {
			const s = shared(human(rand), human(rand));
			const b = Math.min(BINS - 1, Math.max(0, Math.floor((s - 0.33) / 0.02)));
			counts[b]++;
		}
		return counts;
	})();
	const maxBin = Math.max(...others);

	const MB = 170 / 249; // px per Mb
	const X0 = 52;
	const DX = 39;
	const rowsY = [92, 324];
	const W = 7;
	const colours = [
		['var(--mi-mom)', 'var(--mi-mom-2)'],
		['var(--mi-dad-2)', 'var(--mi-dad)']
	];

	const rods = $derived(
		pair.flatMap((child, c) =>
			HUMAN_AUTOSOMES.flatMap((chr, i) =>
				[0, 1].map((side) => ({
					key: `${c}-${i}-${side}`,
					c,
					x: X0 + i * DX + (side ? W + 2 : 0),
					y: rowsY[c],
					h: chr.mb * MB,
					side,
					parts: stretches(chr, side ? child.fromFather[i] : child.fromMother[i])
				}))
			)
		)
	);
	const grow = (c: number) => smoothstep(0.2 + c * 0.7, 1.2 + c * 0.7, t);
	const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
	const HX = 560;
	const HW = 360;
	const hx = (s: number) => HX + ((s - 0.33) / (BINS * 0.02)) * HW;
</script>

<g>
	<!-- legend -->
	<Readout id="key-gm" order={1} label="Mother’s mother" color="var(--mi-mom)">
		<rect x="40" y="22" width="18" height="10" rx="3" fill="var(--mi-mom)" />
		<text x="64" y="31" font-size="12">mother’s mother</text>
	</Readout>
	<Readout id="key-gf" order={2} label="Mother’s father" color="var(--mi-mom-2)">
		<rect x="190" y="22" width="18" height="10" rx="3" fill="var(--mi-mom-2)" />
		<text x="214" y="31" font-size="12">mother’s father</text>
	</Readout>
	<Readout id="key-pm" order={3} label="Father’s mother" color="var(--mi-dad-2)">
		<rect x="560" y="22" width="18" height="10" rx="3" fill="var(--mi-dad-2)" />
		<text x="584" y="31" font-size="12">father’s mother</text>
	</Readout>
	<Readout id="key-pf" order={4} label="Father’s father" color="var(--mi-dad)">
		<rect x="710" y="22" width="18" height="10" rx="3" fill="var(--mi-dad)" />
		<text x="734" y="31" font-size="12">father’s father</text>
	</Readout>

	{#each [0, 1] as c (c)}
		<Readout id="child{c}">
			<Label
				x={X0 - 8}
				y={rowsY[c] - 14}
				text={c ? 'second child' : 'first child'}
				size={13}
				weight={600}
				anchor="start"
			/>
			{#if c === 0}<Label
					x={X0 + 104}
					y={rowsY[c] - 14}
					text="each pair: left from the mother, right from the father"
					size={11}
					muted
					anchor="start"
				/>{/if}
		</Readout>
	{/each}

	{#each rods as r (r.key)}
		{@const g = grow(r.c)}
		<g opacity={smoothstep(0, 0.2, g)}>
			{#each r.parts as p, k (k)}
				<rect
					x={r.x}
					y={r.y + p[0] * MB * g}
					width={W}
					height={Math.max(0.5, (p[1] - p[0]) * MB * g)}
					fill={colours[r.side][p[2]]}
				/>
			{/each}
		</g>
	{/each}
	{#each HUMAN_AUTOSOMES as chr, i (chr.n)}
		<Readout id="n{i}">
			{#each rowsY as y (y)}
				<text
					x={X0 + i * DX + W + 1}
					y={y + chr.mb * MB + 14}
					font-size="10"
					text-anchor="middle"
					class="muted">{chr.n}</text
				>
			{/each}
		</Readout>
	{/each}

	<!-- how much they share -->
	<Readout
		id="share"
		order={5}
		label="These two share"
		value="{pct(share)} of their genome (same piece from the same grandparent)"
	>
		<text x="40" y="540" font-size="18" font-weight="600" opacity={grow(1)}
			>These two share {pct(share)}</text
		>
		<text x="40" y="562" font-size="12" class="muted" opacity={grow(1)}
			>of their genome: same place, same grandparent</text
		>
	</Readout>
	<Readout
		id="spread"
		order={6}
		label="400 sibling pairs"
		value="about 50% on average; measured 37–62%"
	>
		{#each others as v, b (b)}
			<rect
				x={HX + (b / BINS) * HW + 1}
				y={575 - (v / maxBin) * 52}
				width={HW / BINS - 2}
				height={(v / maxBin) * 52}
				fill="var(--stage-ink-muted)"
				opacity="0.45"
			/>
		{/each}
		<line x1={HX} x2={HX + HW} y1="575" y2="575" stroke="var(--stage-line)" />
		{#each [0.35, 0.5, 0.65] as s (s)}
			<text x={hx(s)} y="590" font-size="10" text-anchor="middle" class="muted"
				>{Math.round(s * 100)}%</text
			>
		{/each}
		<text x={HX} y="514" font-size="11" class="muted">400 simulated sibling pairs</text>
		<line
			x1={hx(share)}
			x2={hx(share)}
			y1="516"
			y2="578"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="2.5"
			opacity={grow(1)}
		/>
		<circle
			cx={hx(share)}
			cy="516"
			r={4 + 8 * cycle(t, 2)}
			fill="none"
			stroke="var(--explainer-accent, var(--accent))"
			opacity={grow(1) * (1 - cycle(t, 2))}
		/>
	</Readout>
</g>
