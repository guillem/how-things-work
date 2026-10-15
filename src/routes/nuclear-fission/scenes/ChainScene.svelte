<script lang="ts">
	/**
	 * The chain reaction: a family tree of fissions on the left, generation by
	 * generation, and on the right either a tally of the tree's neutrons (view
	 * `tree`) or the long run of 1,000 neutrons over 40 generations against the
	 * expected 1,000 × kᵍ (view `k`, with the `k` control).
	 *
	 * The tree's random draws are fixed per neutron (chain.ts), so raising k
	 * only turns some lost neutrons into fissions; TREE_SALT is chosen so that
	 * at k = 1 the chain neither dies nor grows over the five generations
	 * drawn (a single chain at k = 1 usually dies out by chance, which is why a
	 * reactor needs many). The long run uses the page's tested seed. Both are
	 * revealed as pure functions of t; reduced motion shows them complete.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CHAIN_GENERATIONS, CHAIN_N0, CHAIN_SEED, buildTree, type Fate } from '../chain';
	import { chainRun, expectedChain, regime } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'tree'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const k = $derived(offered.has('k') ? Number(params.k ?? 1) : Number(step.hints?.k ?? 1));
	const kView = $derived(view === 'k');

	// ---- the tree ---------------------------------------------------------------
	const TREE_SALT = 16;
	const GENS = 5;
	const PER_COLUMN = 8;
	const GEN_TIME = 1.3; // seconds per generation in the tree
	const LEAD = 0.5;
	const tree = $derived(buildTree(k, GENS, PER_COLUMN, TREE_SALT));

	const TX0 = 64;
	const TX1 = $derived(kView ? 470 : 600);
	const TY0 = 140;
	const TY1 = 520;
	const colX = $derived((g: number) => TX0 + (g * (TX1 - TX0)) / GENS);
	const nodeY = (n: number, i: number) => TY0 + ((i + 0.5) * (TY1 - TY0)) / Math.max(1, n);

	const tau = $derived(reduced ? 99 : t - LEAD);
	/** How far generation g's neutrons have flown (0–1). */
	const flight = (g: number) => clamp((tau - g * GEN_TIME) / GEN_TIME);

	interface DrawnNeutron {
		id: string;
		fate: Fate;
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		u: number;
	}
	const drawn = $derived.by(() => {
		const out: DrawnNeutron[] = [];
		for (let g = 0; g < GENS; g++) {
			const parents = tree.fissions[g];
			const kids = tree.fissions[g + 1];
			const u = flight(g);
			if (u <= 0) continue;
			const lostCount: Record<number, number> = {};
			for (const n of tree.neutrons[g]) {
				const x1 = colX(g);
				const y1 = nodeY(parents.length, n.parent);
				let x2: number;
				let y2: number;
				if (n.fate === 'fission' && n.child >= 0) {
					x2 = colX(g + 1);
					y2 = nodeY(kids.length, n.child);
				} else {
					const j = lostCount[n.parent] ?? 0;
					lostCount[n.parent] = j + 1;
					const span = (TX1 - TX0) / GENS;
					const dir = j % 2 === 0 ? -1 : 1;
					x2 = x1 + span * (n.fate === 'escaped' ? 0.55 : 0.42);
					y2 = y1 + dir * (n.fate === 'escaped' ? 30 : 18) * (1 + Math.floor(j / 2) * 0.6);
				}
				out.push({ id: n.id, fate: n.fate, x1, y1, x2, y2, u });
			}
		}
		return out;
	});
	const fissionsShown = $derived(
		tree.fissions.flatMap((col, g) =>
			col.map((f) => ({
				id: `${g}-${f.i}`,
				x: colX(g),
				y: nodeY(col.length, f.i),
				on: g === 0 ? tau > -LEAD : flight(g - 1) >= 1,
				flash: g === 0 ? clamp((tau + LEAD) / 0.6) : clamp((tau - g * GEN_TIME) / 0.6)
			}))
		)
	);
	const genShown = $derived(reduced ? GENS : clamp(Math.floor(tau / GEN_TIME), 0, GENS));

	const colour: Record<Fate, string> = {
		fission: 'var(--fi-fast)',
		captured: 'var(--fi-captured)',
		escaped: 'var(--fi-escaped)'
	};

	// Tally of what has been drawn so far (tree view).
	const tally = $derived.by(() => {
		const done = drawn.filter((n) => n.u >= 1);
		const fis = done.filter((n) => n.fate === 'fission').length;
		const cap = done.filter((n) => n.fate === 'captured').length;
		const esc = done.filter((n) => n.fate === 'escaped').length;
		let parents = 0;
		for (let g = 0; g < GENS; g++) if (flight(g) >= 1) parents += tree.fissions[g].length;
		return { all: fis + cap + esc, fis, cap, esc, parents };
	});

	// ---- the long run (k view) --------------------------------------------------
	const run = $derived(chainRun(k, CHAIN_N0, CHAIN_GENERATIONS, CHAIN_SEED, 1e5));
	const PLOT_LEAD = 0.6;
	const PER_GEN = 0.28; // seconds per generation on the plot
	const gNow = $derived(
		reduced ? CHAIN_GENERATIONS : clamp((t - PLOT_LEAD) / PER_GEN, 0, CHAIN_GENERATIONS)
	);
	const YMAX = 3000;
	const PX0 = 560;
	const PX1 = 916;
	const PY0 = 150;
	const PY1 = 440;
	const sx = scale([0, CHAIN_GENERATIONS], [PX0, PX1]);
	const sy = scale([0, YMAX], [PY1, PY0]);
	/** The run so far, stopped where it leaves the top of the chart. */
	const simPts = $derived.by(() => {
		const out: { g: number; n: number }[] = [];
		const last = Math.floor(gNow);
		for (let g = 0; g <= last; g++) {
			const n = run[g];
			if (n > YMAX) {
				const prev = run[g - 1];
				out.push({ g: g - 1 + (YMAX - prev) / (n - prev), n: YMAX });
				break;
			}
			out.push({ g, n });
		}
		return out;
	});
	const simPath = $derived(
		linePath(
			simPts,
			(p) => p.g,
			(p) => p.n,
			sx,
			sy
		)
	);
	const expPts = $derived(
		Array.from({ length: CHAIN_GENERATIONS * 2 + 1 }, (_, i) => ({
			g: i / 2,
			n: expectedChain(k, CHAIN_N0, i / 2)
		})).filter((p) => p.n <= YMAX * 1.02)
	);
	const expPath = $derived(
		linePath(
			expPts,
			(p) => p.g,
			(p) => p.n,
			sx,
			sy
		)
	);
	const gInt = $derived(Math.floor(gNow));
	const nNow = $derived(run[gInt]);
	const off = $derived(nNow > YMAX);
	const state = $derived(regime(k, 0.005));
	const stateColour = $derived(
		state === 'subcritical'
			? 'var(--fi-sub)'
			: state === 'critical'
				? 'var(--fi-crit)'
				: 'var(--fi-super)'
	);
	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
	const runIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

<g>
	<!-- header -->
	<Readout id="tree-title">
		<text x={TX0 - 24} y={70} style:font-size="16px" font-weight="600">A chain of fissions</text>
		<text x={TX0 - 24} y={90} class="muted"
			>{genShown === 0
				? 'one fission'
				: `${genShown} generation${genShown === 1 ? '' : 's'} on`}</text
		>
	</Readout>
	{#each Array.from({ length: GENS + 1 }, (_, g) => g) as g (g)}
		<Readout id="gen-{g}">
			<text x={colX(g)} y={TY0 - 16} text-anchor="middle" class="muted" style:font-size="11px"
				>{g === 0 ? 'start' : `gen ${g}`}</text
			>
		</Readout>
	{/each}

	<!-- neutrons: lines already flown, and the ones in flight -->
	{#each drawn as n (n.id)}
		{@const ex = n.x1 + (n.x2 - n.x1) * n.u}
		{@const ey = n.y1 + (n.y2 - n.y1) * n.u}
		<line
			x1={n.x1}
			y1={n.y1}
			x2={ex}
			y2={ey}
			stroke={colour[n.fate]}
			stroke-width={n.fate === 'fission' ? 1.8 : 1.3}
			opacity={n.fate === 'fission' ? 0.9 : 0.75}
			stroke-dasharray={n.fate === 'escaped' ? '4 3' : undefined}
			marker-end={n.fate === 'escaped' && n.u >= 1 ? 'url(#arrowhead)' : undefined}
		/>
		{#if n.u < 1}
			<circle cx={ex} cy={ey} r="3.5" fill={colour[n.fate]} />
		{:else if n.fate === 'captured'}
			<circle cx={n.x2} cy={n.y2} r="5" fill="var(--fi-u238)" opacity="0.8" />
		{/if}
	{/each}

	<!-- fissions -->
	{#each fissionsShown as f (f.id)}
		{#if f.on}
			{#if !reduced && f.flash < 1}
				<circle
					cx={f.x}
					cy={f.y}
					r={9 + 14 * f.flash}
					fill="none"
					stroke="var(--fi-flash)"
					stroke-width="2"
					opacity={1 - f.flash}
				/>
			{/if}
			<circle cx={f.x} cy={f.y} r="8" fill="var(--fi-u235)" />
			<circle cx={f.x} cy={f.y} r="3" fill="var(--fi-flash)" />
		{/if}
	{/each}
	{#each tree.hidden as h, g (g)}
		{#if h > 0 && g <= genShown}
			<Readout id="more-{g}">
				<Label x={colX(g)} y={TY1 + 22} text="+{h} more" muted />
			</Readout>
		{/if}
	{/each}

	<!-- key -->
	<Readout id="key-fission" label="splits a nucleus" color="var(--fi-fast)" />
	<Readout id="key-captured" label="captured" color="var(--fi-captured)" />
	<Readout id="key-escaped" label="escapes" color="var(--fi-escaped)" />
	<Readout id="key">
		<g style:font-size="12px">
			<circle cx={TX0 - 16} cy={566} r="7" fill="var(--fi-u235)" />
			<circle cx={TX0 - 16} cy={566} r="2.6" fill="var(--fi-flash)" />
			<text x={TX0 - 4} y={570}>fission</text>
			<line
				x1={TX0 + 52}
				y1={566}
				x2={TX0 + 74}
				y2={566}
				stroke="var(--fi-fast)"
				stroke-width="1.8"
			/>
			<text x={TX0 + 80} y={570}>splits a nucleus</text>
			<circle cx={TX0 + 192} cy={566} r="5" fill="var(--fi-u238)" />
			<text x={TX0 + 202} y={570}>captured</text>
			<line
				x1={TX0 + 266}
				y1={566}
				x2={TX0 + 290}
				y2={566}
				stroke="var(--fi-escaped)"
				stroke-width="1.3"
				stroke-dasharray="4 3"
			/>
			<text x={TX0 + 296} y={570}>escapes</text>
		</g>
	</Readout>

	{#if !kView}
		<!-- tally of the tree -->
		<g style:font-variant-numeric="tabular-nums">
			<Readout id="tally-card"
				><rect
					x={650}
					y={170}
					width={270}
					height={250}
					rx="12"
					fill="var(--surface)"
					stroke="var(--border)"
				/></Readout
			>
			<Readout id="tally-title">
				<text x={670} y={200} font-weight="600">The neutrons so far</text>
			</Readout>
			<Readout id="t-all" order={1} label="Neutrons freed" value={String(tally.all)}>
				<text x={670} y={232}>freed</text>
				<text x={900} y={232} text-anchor="end" font-weight="600">{tally.all}</text>
			</Readout>
			<Readout
				id="t-fis"
				order={2}
				label="Split a nucleus"
				value={String(tally.fis)}
				color="var(--fi-fast)"
			>
				<text x={670} y={262} style:fill="var(--fi-fast)">split a nucleus</text>
				<text x={900} y={262} text-anchor="end" font-weight="600">{tally.fis}</text>
			</Readout>
			<Readout id="t-cap" order={3} label="Captured" value={String(tally.cap)}>
				<text x={670} y={288} class="muted">captured</text>
				<text x={900} y={288} text-anchor="end">{tally.cap}</text>
			</Readout>
			<Readout id="t-esc" order={4} label="Escaped" value={String(tally.esc)}>
				<text x={670} y={314} class="muted">escaped</text>
				<text x={900} y={314} text-anchor="end">{tally.esc}</text>
			</Readout>
			<line x1={670} x2={900} y1={332} y2={332} stroke="var(--border)" />
			<Readout
				id="t-k"
				order={5}
				label="New fissions per fission"
				value={tally.parents
					? `${tally.fis} / ${tally.parents} = ${(tally.fis / tally.parents).toFixed(2)}`
					: '…'}
				note="the chain is set to k = 1 on average"
			>
				<text x={670} y={358}>new fissions per fission</text>
				<text x={900} y={388} text-anchor="end" style:font-size="18px" font-weight="700"
					>{tally.parents
						? `${tally.fis} / ${tally.parents} = ${(tally.fis / tally.parents).toFixed(2)}`
						: '…'}</text
				>
				<text x={670} y={408} class="muted" style:font-size="11px"
					>the chain is set to k = 1 on average</text
				>
			</Readout>
		</g>
	{:else}
		<!-- the long run -->
		<g opacity={runIn}>
			<Readout id="plot-title">
				<text x={PX0} y={102} style:font-size="15px" font-weight="600"
					>1,000 neutrons, 40 generations</text
				>
				<text x={PX0} y={120} class="muted">neutrons in each generation</text>
			</Readout>
			<Axes
				{sx}
				{sy}
				xLabel="generation"
				xTicks={[0, 10, 20, 30, 40]}
				yTicks={[0, 1000, 2000, 3000]}
			/>
			<path
				d={expPath}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
			/>
			<path
				d={simPath}
				fill="none"
				stroke={stateColour}
				stroke-width="2.4"
				stroke-linejoin="round"
			/>
			{#if !off}
				<circle cx={sx(gInt)} cy={sy(nNow)} r="4" fill={stateColour} />
			{:else}
				<Label x={sx(gInt)} y={PY0 - 8} text="off the chart ↑" color="var(--fi-super)" />
			{/if}
			<Readout id="legend" label="dashed: 1,000 × kᵍ, the average">
				<line
					x1={PX0}
					x2={PX0 + 24}
					y1={482}
					y2={482}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="6 5"
				/>
				<text x={PX0 + 32} y={486} class="muted">1,000 × kᵍ, the average</text>
			</Readout>
			<Readout id="state" order={1} label="k = {k.toFixed(2)}" value={state} color={stateColour}>
				<text x={PX0} y={512} style:font-size="18px" font-weight="700" style:fill={stateColour}
					>k = {k.toFixed(2)} · {state}</text
				>
			</Readout>
			<Readout
				id="now"
				order={2}
				label="Generation {gInt}"
				value="{fmt(nNow)} neutrons"
				note="expected {fmt(expectedChain(k, CHAIN_N0, gInt))}"
			>
				<text x={PX0} y={538} style:font-variant-numeric="tabular-nums"
					>generation {gInt}: {fmt(nNow)} neutrons (expected {fmt(
						expectedChain(k, CHAIN_N0, gInt)
					)})</text
				>
			</Readout>
		</g>
	{/if}
</g>
