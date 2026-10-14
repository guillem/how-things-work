<script lang="ts">
	/**
	 * Meiosis of the Rr Yy Aa pea cell, one phase per step (hint `phase`):
	 *  0 copy: each chromosome splits into two sister chromatids;
	 *  1 pair: homologues lie side by side and cross over at the reader's
	 *    chosen points (params xo0–xo2, draggable handles);
	 *  2 line-up: the pairs sit on the equator, facing the way the reader chose
	 *    (params flip0–flip2; clicking a pair turns it);
	 *  3 first division: homologues go to opposite cells;
	 *  4 second division: sisters separate into four haploid cells.
	 * Each step animates from the previous phase's picture to its own over the
	 * first ~2 s; the reduced-motion frame (t = 2.5 s) is the finished phase.
	 * The chromatids' colours and letters come from the model (meiosisOfPair,
	 * tetrad) with the reader's crossovers and line-up.
	 */
	import {
		Handle,
		Label,
		clamp,
		cycle,
		lerp,
		rng,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		PEA_CHROMOSOMES,
		PEA_GENES,
		genotype,
		meiosisOfPair,
		originAt,
		tetrad,
		type Chromatid as ChromatidData
	} from '../model';
	import Chromatid from './Chromatid.svelte';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(Number(step.hints?.phase ?? 0));
	const u = $derived(smoothstep(0.2, 2.2, t));
	/** Continuous phase: from the previous phase's picture to this one's. */
	const f = $derived(phase === 0 ? 0 : phase - 1 + u);

	const plant = genotype({ R: 'Rr', Y: 'Yy', A: 'Aa' });
	const xo = $derived(
		[0, 1, 2].map((p) => clamp(Number(params[`xo${p}`] ?? [0.62, 0.75, 0.25][p]), 0.04, 0.96))
	);
	const flips = $derived([0, 1, 2].map((p) => Boolean(params[`flip${p}`] ?? p === 1)));

	const crossed = $derived(
		PEA_CHROMOSOMES.map((k, p) =>
			meiosisOfPair(k, rng(1), { crossovers: [xo[p] * k.length], flipped: flips[p] })
		)
	);
	const plain = PEA_CHROMOSOMES.map((k) =>
		([0, 0, 1, 1] as const).map((o): ChromatidData => [{ to: k.length, origin: o }])
	);
	/** Crossing over shows once the pairs have met, halfway through the pair step. */
	const showCrossed = $derived(f >= 0.6);
	const gametes = $derived(tetrad(crossed));

	// ------------------------------------------------------------------ layout
	const S0 = 160; // px per Morgan while the chromosomes are whole cells' size
	const S2 = 105;
	const S4 = 78;
	const CX = [330, 480, 630];
	const MID = 315;
	const tops2 = (() => {
		let y = 104;
		return PEA_CHROMOSOMES.map((k) => {
			const top = y;
			y += k.length * S2 + 34;
			return top;
		});
	})();
	const GAMETE = [
		{ x: 250, y: 160 },
		{ x: 250, y: 455 },
		{ x: 710, y: 160 },
		{ x: 710, y: 455 }
	];

	interface Place {
		x: number;
		y: number;
		s: number;
	}
	/** Where chromatid `slot` (0, 1: homologue 0's sisters; 2, 3: homologue 1's) of pair p sits in phase k. */
	function place(k: number, p: number, slot: number): Place {
		const L = PEA_CHROMOSOMES[p].length;
		const h = slot < 2 ? 0 : 1;
		const sis = slot % 2;
		if (k <= 0) {
			const sep = phase === 0 ? 7 * u : 7;
			return { x: CX[p] + (h ? 26 : -26) + (sis ? sep : -sep), y: MID - (L * S0) / 2, s: S0 };
		}
		if (k === 1) return { x: CX[p] + [-24, -9, 9, 24][slot], y: MID - (L * S0) / 2, s: S0 };
		// From the line-up on, which side a homologue faces depends on the flip.
		const left = (h === 0) !== flips[p];
		// Order across the bivalent, left to right: the left homologue's sisters, then the right's.
		const col = left ? (sis ? -9 : -24) : sis ? 24 : 9;
		if (k === 2) return { x: 480 + col, y: tops2[p], s: S2 };
		if (k === 3) return { x: (left ? 250 : 710) + (sis ? 8 : -8), y: tops2[p], s: S2 };
		const g = GAMETE[(left ? 0 : 2) + sis];
		return { x: g.x + (p - 1) * 38, y: g.y - (L * S4) / 2, s: S4 };
	}
	function at(p: number, slot: number): Place {
		const a = place(Math.floor(f), p, slot);
		const b = place(Math.ceil(f), p, slot);
		const v = f - Math.floor(f);
		// Chromosomes are never still in a living cell: a gentle drift per homologue.
		const h = slot < 2 ? 0 : 1;
		const jx = 1.6 * Math.sin(t * 0.9 + p * 2.1 + h * 1.3);
		const jy = 2.2 * Math.sin(t * 0.7 + p + h * 2);
		return { x: lerp(a.x, b.x, v) + jx, y: lerp(a.y, b.y, v) + jy, s: lerp(a.s, b.s, v) };
	}

	const rods = $derived(
		PEA_CHROMOSOMES.flatMap((k, p) =>
			[0, 1, 2, 3].map((slot) => {
				const pos = at(p, slot);
				const segs = showCrossed ? crossed[p].chromatids[slot] : plain[p][slot];
				const genes = PEA_GENES.filter((g) => g.chromosome === p).map((g) => ({
					at: g.at,
					letter: plant[g.id][originAt(segs, g.at)]
				}));
				const fadeIn = phase === 0 && slot % 2 === 1 ? smoothstep(0, 0.6, u) : 1;
				return { key: `${p}-${slot}`, p, slot, ...pos, L: k.length, segs, genes, fadeIn };
			})
		)
	);
	/** Centromere links between sisters. */
	const centromeres = $derived(
		PEA_CHROMOSOMES.flatMap((k, p) =>
			[0, 2].map((s0) => {
				const a = rods.find((r) => r.p === p && r.slot === s0)!;
				const b = rods.find((r) => r.p === p && r.slot === s0 + 1)!;
				// Sisters stay joined until the second division pulls them apart.
				const joined = 1 - smoothstep(3.2, 3.6, f);
				return { key: `${p}-${s0}`, a, b, y: a.y + k.centromere * a.s, o: joined };
			})
		)
	);

	// Cells: one large cell, then two, then four.
	const cells = $derived.by(() => {
		if (f <= 2) return [{ key: 'c', cx: 480, cy: 315, rx: 440, ry: 272 }];
		if (f <= 3) {
			const v = f - 2;
			return [0, 1].map((i) => ({
				key: `h${i}`,
				cx: lerp(480, i ? 710 : 250, v),
				cy: 315,
				rx: lerp(440, 215, v),
				ry: 272
			}));
		}
		const v = f - 3;
		return [0, 1, 2, 3].map((i) => ({
			key: `q${i}`,
			cx: i < 2 ? 250 : 710,
			cy: lerp(315, GAMETE[i].y, v),
			rx: lerp(215, 140, v),
			ry: lerp(272, 132, v)
		}));
	});

	const spindle = $derived(
		f > 1.4 && f < 3.4 ? smoothstep(1.4, 1.9, f) * (1 - smoothstep(3, 3.4, f)) : 0
	);

	const captions = [
		'DNA copied: every chromosome is now two sister chromatids',
		'pairs meet and cross over',
		'pairs line up at the equator, each facing either way',
		'division one: the two chromosomes of each pair separate',
		'division two: sister chromatids separate'
	];

	const gameteText = (g: ChromatidData[]) =>
		PEA_GENES.map((gene) => plant[gene.id][originAt(g[gene.chromosome], gene.at)]).join(' ');

	const lineupName = $derived(flips.map((fl) => (fl ? 'father’s' : 'mother’s')));
	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<g>
	{#each cells as c (c.key)}
		<ellipse
			cx={c.cx}
			cy={c.cy}
			rx={c.rx}
			ry={c.ry}
			fill="var(--mi-cell)"
			stroke="var(--mi-cell-edge)"
			stroke-width="1.5"
		/>
	{/each}

	<Readout id="caption" order={1} label="Now" value={captions[phase]}>
		<Label x={480} y={28} text={captions[phase]} size={14} weight={600} />
	</Readout>

	<!-- spindle fibres from the two poles to the centromeres -->
	{#if spindle > 0}
		<g opacity={spindle * 0.5}>
			{#each centromeres as c (c.key)}
				{@const left = (c.a.x + c.b.x) / 2 < 480}
				<line
					x1={left ? 40 : 920}
					y1={315}
					x2={(c.a.x + c.b.x) / 2}
					y2={c.y}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					stroke-dasharray="3 4"
				/>
			{/each}
		</g>
	{/if}

	{#each rods as r (r.key)}
		<Chromatid
			x={r.x}
			y={r.y}
			length={r.L}
			scale={r.s}
			segments={r.segs}
			genes={r.genes}
			width={r.s > 100 ? 13 : 11}
			opacity={r.fadeIn}
		/>
	{/each}
	{#each centromeres as c (c.key)}
		{#if c.o > 0.02}
			<line
				x1={c.a.x}
				x2={c.b.x}
				y1={c.y}
				y2={c.y}
				stroke="var(--stage-ink)"
				stroke-width="5"
				stroke-linecap="round"
				opacity={0.55 * c.o * c.a.fadeIn}
			/>
		{/if}
	{/each}

	<!-- phase 0: what changed -->
	{#if phase === 0}
		<Readout id="count0" order={2} label="Chromosomes" value="6, made of 12 chromatids">
			<Label x={480} y={548} text="6 chromosomes, now 12 chromatids" size={13} muted opacity={u} />
		</Readout>
		<Readout id="cen0">
			<Label
				x={CX[0] - 60}
				y={MID - 40}
				text="centromere"
				size={11}
				muted
				anchor="end"
				opacity={u}
			/>
			<line
				x1={CX[0] - 56}
				x2={CX[0] - 36}
				y1={MID - 44}
				y2={MID - (1.3 * S0) / 2 + 0.5 * S0}
				stroke="var(--stage-ink-muted)"
				opacity={u}
			/>
		</Readout>
	{/if}

	<!-- phase 1: crossover handles -->
	{#if phase === 1}
		{#each PEA_CHROMOSOMES as k, p (k.id)}
			{@const top = MID - (k.length * S0) / 2}
			{@const y = top + xo[p] * k.length * S0}
			{@const c = cycle(t, 1.8, p * 0.3)}
			<g opacity={smoothstep(0.4, 0.9, f)}>
				<!-- the chiasma: the two inner chromatids cross here -->
				<path
					d="M{CX[p] - 9} {y - 12} L{CX[p] + 9} {y + 12} M{CX[p] + 9} {y - 12} L{CX[p] - 9} {y +
						12}"
					stroke="var(--stage-ink)"
					stroke-width="2"
					opacity="0.6"
				/>
				<circle
					cx={CX[p]}
					cy={y}
					r={11 + 9 * c}
					fill="none"
					stroke="var(--explainer-accent, var(--accent))"
					stroke-width="1.5"
					opacity={0.7 * (1 - c)}
				/>
				<Handle
					x={CX[p]}
					{y}
					r={7}
					label="Crossover point on the {['long', 'middle', 'short'][p]} pair"
					value={Math.round(xo[p] * 100)}
					min={4}
					max={96}
					valuetext="{pct(xo[p])} from the top"
					onmove={(pt: Point) =>
						setParam(
							`xo${p}`,
							Math.round(clamp((pt.y - top) / (k.length * S0), 0.04, 0.96) * 100) / 100
						)}
					onkey={(d) =>
						setParam(
							`xo${p}`,
							d === 'start'
								? 0.04
								: d === 'end'
									? 0.96
									: Math.round(clamp(xo[p] - d / 100, 0.04, 0.96) * 100) / 100
						)}
				/>
			</g>
			<Readout
				id="xo{p}"
				order={2 + p}
				label="{['Long', 'Middle', 'Short'][p]} pair"
				value="crossover {pct(xo[p])} from the top"
			>
				<Label
					x={CX[p]}
					y={top + k.length * S0 + 28}
					text={['long pair', 'middle pair', 'short pair'][p]}
					size={12}
					muted
				/>
			</Readout>
		{/each}
		<Readout
			id="rule"
			order={6}
			label="Rule"
			value="genes beyond the crossover (from the centromere) swap chromatids"
		>
			<Label
				x={480}
				y={560}
				text="genes beyond the crossover, seen from the centromere, change chromatid"
				size={12}
				muted
				opacity={smoothstep(0.6, 1, f)}
			/>
		</Readout>
	{/if}

	<!-- phase 2: click a pair to turn it -->
	{#if phase === 2}
		{#each PEA_CHROMOSOMES as k, p (k.id)}
			<g
				role="button"
				tabindex="0"
				aria-label="Turn the {['long', 'middle', 'short'][p]} pair round"
				aria-pressed={flips[p]}
				style:cursor="pointer"
				onclick={() => setParam(`flip${p}`, !flips[p])}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						setParam(`flip${p}`, !flips[p]);
					}
				}}
			>
				<rect
					x={440}
					y={tops2[p] - 10}
					width={80}
					height={k.length * S2 + 20}
					rx="10"
					fill="transparent"
				/>
			</g>
			<Readout
				id="side{p}"
				order={2 + p}
				label="{['Long', 'Middle', 'Short'][p]} pair"
				value="{lineupName[p]} copy on the left"
			>
				<Label
					x={540}
					y={tops2[p] + (k.length * S2) / 2 + 4}
					text="{lineupName[p]} copy on the left"
					size={11}
					muted
					anchor="start"
					opacity={u}
				/>
			</Readout>
		{/each}
		<Readout
			id="ways"
			order={6}
			label="Line-ups"
			value="2 × 2 × 2 = 8 possible; humans: 2²³ ≈ 8.4 million"
		>
			<Label x={160} y={300} text="2 × 2 × 2 = 8" size={16} weight={600} opacity={u} />
			<Label x={160} y={322} text="possible line-ups" size={12} muted opacity={u} />
			<Label x={160} y={350} text="humans: 2²³ ≈ 8.4 million" size={12} muted opacity={u} />
			<Label x={480} y={50} text="click a pair to turn it round" size={11} muted pill opacity={u} />
		</Readout>
	{/if}

	<!-- phase 3: two cells -->
	{#if phase === 3}
		<Readout
			id="halves"
			order={2}
			label="Each cell"
			value="one chromosome of each pair (3), still doubled"
		>
			<Label
				x={480}
				y={50}
				text="each cell: one chromosome of every pair, still two chromatids each"
				size={12}
				muted
				opacity={u}
				pill
			/>
		</Readout>
	{/if}

	<!-- phase 4: four gametes -->
	{#if phase === 4}
		{#each gametes as g, i (i)}
			{@const c = GAMETE[i]}
			<Readout id="g{i}" order={2 + i} label="Cell {i + 1}" value={gameteText(g)} opacity={u}>
				<Label
					x={c.x + (i < 2 ? -150 : 150)}
					y={c.y + 4}
					text={gameteText(g)}
					size={16}
					weight={700}
					anchor={i < 2 ? 'end' : 'start'}
					opacity={u}
				/>
			</Readout>
		{/each}
		<Readout id="note4">
			<Label x={480} y={310} text="4 cells" size={13} weight={600} opacity={u} />
			<Label x={480} y={328} text="one copy of each" size={11} muted opacity={u} />
		</Readout>
	{/if}
</g>
