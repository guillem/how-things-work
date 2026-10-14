<script lang="ts">
	/**
	 * The Luria–Delbrück fluctuation test: 20 cultures spread on dishes with the
	 * virus, with their resistant colonies.
	 *
	 * `params.hypothesis`: 'random' (mutations at random while the cultures grow:
	 * `growCulture`, jackpots) or 'induced' (the virus makes each cell resistant
	 * with a small fixed chance: a Poisson count with the same expected mean).
	 * `params.again` grows a new set. Below: a small family tree of one culture,
	 * showing where resistance appears under each idea, and the statistics of
	 * the 20 dishes next to Luria and Delbrück's experiment 16.
	 *
	 * Colonies appear between 0.8 and 3.5 s (a pure function of t); each dish
	 * draws at most MAX_DOTS of them and writes its count underneath.
	 */
	import { Label, clamp, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fluctuation, ldMean } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const hypothesis = $derived(params.hypothesis === 'induced' ? 'induced' : 'random');
	const runs = $derived(Number(params.again ?? 0));
	// The same seed for both ideas. Seed 85 is a typical set: 11 of 20 dishes with none, one
	// jackpot of 66, like Luria and Delbrück's experiment 16.
	const result = $derived(fluctuation(hypothesis, 20, 85 + runs * 7919));

	const MAX_DOTS = 48;
	const R = 36;
	const dishes = $derived(
		result.counts.map((n, i) => ({
			n,
			x: 66 + (i % 10) * 92,
			y: 120 + Math.floor(i / 10) * 132,
			key: i
		}))
	);
	const grow = $derived(reduced ? 1 : clamp((t - 0.8) / 2.7));
	/** All the visible colonies of dish i as one path of small circles (one SVG node per dish). */
	function colonies(n: number, i: number, share: number) {
		const shown = Math.round(Math.min(n, MAX_DOTS) * share);
		let d = '';
		for (let k = 0; k < shown; k++) {
			const a = hash(k + i * 101, 1) * Math.PI * 2;
			const r = Math.sqrt(hash(k + i * 101, 2)) * (R - 7);
			const x = Math.cos(a) * r;
			const y = Math.sin(a) * r;
			d += `M${(x - 2.6).toFixed(1)} ${y.toFixed(1)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
		}
		return d;
	}
	const jackpot = $derived(Math.max(...result.counts));
	const fmt1 = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 1 });
	const ratio = $derived(result.variance / Math.max(result.mean, 1e-9));

	// ---- the family tree of one culture: 5 doublings, 32 cells at the bottom
	const LEVELS = 5;
	const TX = 64;
	const TW = 340;
	const TY = 438;
	const TDY = 25;
	const nodeX = (level: number, i: number) => TX + ((i + 0.5) / 2 ** level) * TW;
	const nodeY = (level: number) => TY + level * TDY;
	// Random idea: one mutation early (level 1, the left cell: half the culture descends from
	// it) and one late (level 4: two resistant cells); induced: three cells at the very end.
	const resistant = (level: number, i: number) =>
		hypothesis === 'random'
			? (level >= 1 && i >> (level - 1) === 0) ||
				(level === 4 && i === 13) ||
				(level === 5 && (i === 26 || i === 27))
			: level === LEVELS && [3, 17, 26].includes(i);
	const tree = $derived(
		Array.from({ length: LEVELS + 1 }, (_, level) =>
			Array.from({ length: 2 ** level }, (_, i) => ({ level, i, r: resistant(level, i) }))
		).flat()
	);
	const treeShow = $derived(reduced ? 1 : smoothstep(0.3, 1.5, t));
</script>

<g>
	<Label
		x={24}
		y={36}
		anchor="start"
		size={14}
		weight={600}
		text="20 separate cultures, each spread on a dish with the virus: resistant colonies"
	/>
	{#each dishes as d (d.key)}
		<circle
			cx={d.x}
			cy={d.y}
			r={R}
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<path transform="translate({d.x} {d.y})" d={colonies(d.n, d.key, grow)} fill="var(--ev-r3)" />
		<Label
			x={d.x}
			y={d.y + R + 18}
			text={d.n > MAX_DOTS ? `${d.n.toLocaleString('en-GB')}!` : String(d.n)}
			size={d.n > MAX_DOTS ? 13 : 12}
			weight={d.n > MAX_DOTS ? 700 : 500}
			muted={d.n === 0}
			opacity={smoothstep(0.7, 1, grow)}
		/>
	{/each}

	<!-- ===== family tree -->
	<Label
		x={24}
		y={410}
		anchor="start"
		size={13}
		weight={600}
		text={hypothesis === 'random'
			? 'One culture growing: an early mutation leaves a big family'
			: 'One culture: the virus turns a few cells resistant at the end'}
	/>
	<g opacity={treeShow}>
		{#each tree as n (`${n.level}-${n.i}`)}
			{#if n.level > 0}
				<line
					x1={nodeX(n.level - 1, n.i >> 1)}
					y1={nodeY(n.level - 1)}
					x2={nodeX(n.level, n.i)}
					y2={nodeY(n.level)}
					stroke={n.r && hypothesis === 'random' ? 'var(--ev-r3)' : 'var(--stage-line)'}
					stroke-width={n.r && hypothesis === 'random' ? 2 : 1}
				/>
			{/if}
		{/each}
		{#each tree as n (`${n.level}-${n.i}`)}
			<circle
				cx={nodeX(n.level, n.i)}
				cy={nodeY(n.level)}
				r={n.level === LEVELS ? 3.5 : 4.5}
				fill={n.r ? 'var(--ev-r3)' : 'var(--surface)'}
				stroke={n.r ? 'var(--ev-r3)' : 'var(--stage-ink-muted)'}
			/>
		{/each}
	</g>
	<Readout id="tree" order={3}>
		<Label
			x={nodeX(1, 0) - 12}
			y={nodeY(1) + 4}
			anchor="end"
			text="mutation"
			size={11}
			muted
			opacity={hypothesis === 'random' ? treeShow : 0}
		/>
	</Readout>

	<!-- ===== statistics -->
	<rect
		x={470}
		y={392}
		width={466}
		height={186}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="these"
		order={1}
		label="These 20 dishes"
		value="average {fmt1(result.mean)}, variance {fmt1(result.variance)}, {result.zeros} with none"
	>
		<Label x={490} y={418} anchor="start" text="These 20 dishes" size={13} weight={600} />
		<Label
			x={490}
			y={440}
			anchor="start"
			text="average {fmt1(result.mean)} · variance {fmt1(
				result.variance
			)} · {result.zeros} with none"
			size={13}
		/>
		<Label
			x={490}
			y={462}
			anchor="start"
			text={ratio > 3
				? `variance ${fmt1(ratio)} × the average: jackpots (largest: ${jackpot})`
				: `variance ≈ average (${fmt1(ratio)} ×): chance alone`}
			size={12}
			color={ratio > 3 ? 'var(--ev-r3)' : undefined}
			weight={600}
		/>
	</Readout>
	<Readout
		id="ld"
		order={2}
		label="Luria & Delbrück 1943"
		value="average 11.3, variance 694, 11 of 20 with none"
	>
		<Label
			x={490}
			y={494}
			anchor="start"
			text="Luria & Delbrück 1943, 20 cultures (experiment 16)"
			size={13}
			weight={600}
		/>
		<Label
			x={490}
			y={516}
			anchor="start"
			text="average 11.3 · variance 694 · 11 of 20 with none"
			size={13}
		/>
		<Label
			x={490}
			y={538}
			anchor="start"
			text="the virus causing it would give variance ≈ average"
			size={12}
			muted
		/>
	</Readout>
	<Readout
		id="model"
		order={4}
		label="Model"
		value="20 million cells per culture, 1 mutation in 33 million divisions; long-run average {fmt1(
			ldMean()
		)}"
	>
		<Label
			x={490}
			y={566}
			anchor="start"
			text="model: each culture doubles 15 times, to 20 million cells"
			size={11}
			muted
		/>
	</Readout>
</g>
