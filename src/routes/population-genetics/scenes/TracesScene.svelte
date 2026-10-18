<script lang="ts">
	/**
	 * Wright–Fisher populations as traces of the share of A, generation by generation, in six
	 * modes (`step.hints.mode`); N, s, h, the starting share p0 and the "Run again" counter come
	 * from hints, which name a control or hold a value:
	 *   - `one`: one population, with its newborns' counted genotypes beside the Hardy–Weinberg
	 *     shares of that generation's p;
	 *   - `drift`: a hundred neutral populations, with how many have fixed or lost A;
	 *   - `hetero`: the same populations' heterozygosity 2pq, their average and the 1/2N decay;
	 *   - `selection`: a hundred populations with an advantage s, and the infinite-population
	 *     curve, against Kimura's chance of fixation;
	 *   - `new`: 2,000 new mutations (one copy each), the first hundred drawn as copies on a ×10
	 *     scale, against Kimura and 2s;
	 *   - `dominance`: a hundred populations with a recessive, additive or dominant advantage,
	 *     with the infinite-population curves of all three.
	 * Runs are computed once per setting (seeded by the "Run again" counter). Each line's path is
	 * built once and revealed by a clip that a cursor sweeps across in SWEEP seconds, a pure
	 * function of t; reduced motion shows the whole run.
	 */
	import { Axes, Label, clamp, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		deterministic,
		hardyWeinberg,
		heterozygosity,
		mutationFates,
		newMutationFixes,
		fixationChance,
		runMany,
		runOne,
		type Genotypes
	} from '../model';
	import { GENO, hinted, percent } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'drift'));
	const num = (key: string, fallback: number) => {
		const v = Number(hinted(step, params, key, fallback));
		return Number.isFinite(v) ? v : fallback;
	};
	const N = $derived(Math.max(2, Math.round(num('N', 100))));
	const s = $derived(num('s', 0));
	const h = $derived(num('h', 0.5));
	const p0 = $derived(num('p0', 0.5));
	const again = $derived(num('again', 0));
	const POPS = 100;
	const TRIALS = 2000;
	const MODES = ['one', 'drift', 'hetero', 'selection', 'new', 'dominance'];
	// the single population's first run (N = 200) is one that still has both alleles at the end
	const seed = $derived((mode === 'one' ? 107 : 101 + 1009 * MODES.indexOf(mode)) + 7919 * again);

	const isNew = $derived(mode === 'new');

	// ---- the runs ----------------------------------------------------------------------------
	const one = $derived(
		mode === 'one' ? runOne({ N, p0, s, h: 0.5, generations: 200, seed }) : null
	);
	const fixedGens = $derived(mode === 'one' ? 200 : mode === 'dominance' ? 800 : 400);
	const runs = $derived(
		mode === 'one' || isNew
			? []
			: runMany(
					{
						N,
						p0,
						s: mode === 'drift' || mode === 'hetero' ? 0 : s,
						h,
						generations: fixedGens,
						seed
					},
					POPS
				)
	);
	const fates = $derived(isNew ? mutationFates(N, s, 0.5, TRIALS, seed, POPS) : null);
	const gens = $derived.by(() => {
		if (!fates) return fixedGens;
		const longest = Math.max(40, ...fates.shown.map((l) => l.copies.length - 1));
		return Math.min(6000, niceMax(longest));
	});

	// ---- scales ------------------------------------------------------------------------------
	const PX0 = 380;
	const PX1 = 916;
	const PY0 = 492;
	const PY1 = 92;
	const sx = $derived(scale([0, gens], [PX0, PX1]));
	const LOG0 = Math.log10(0.5);
	const logTop = $derived(Math.log10(2 * N));
	const sy = $derived(
		isNew
			? scale([LOG0, logTop], [PY0, PY1])
			: mode === 'hetero'
				? scale([0, 0.5], [PY0, PY1])
				: scale([0, 1], [PY0, PY1])
	);
	/** y of a value: a share, a heterozygosity, or a number of copies (0 copies on the axis). */
	const yOf = (v: number) => (isNew ? sy(v <= 0 ? LOG0 : Math.log10(v)) : sy(v));
	const yTicks = $derived(
		isNew
			? [LOG0, ...Array.from({ length: Math.floor(logTop) + 1 }, (_, i) => i)]
			: mode === 'hetero'
				? [0, 0.1, 0.2, 0.3, 0.4, 0.5]
				: [0, 0.25, 0.5, 0.75, 1]
	);
	const yFormat = $derived((v: number) =>
		isNew
			? v < 0
				? '0'
				: (10 ** v).toLocaleString('en-US')
			: mode === 'hetero'
				? v.toFixed(1)
				: `${Math.round(v * 100)}%`
	);
	const yTitle = $derived(
		isNew ? 'copies of A (each line ×10)' : mode === 'hetero' ? 'heterozygosity 2pq' : 'share of A'
	);

	// ---- the lines, built once per run --------------------------------------------------------
	interface Line {
		id: number;
		d: string;
		tail: string | null;
		tailColor: string;
		end: number | null;
		fate: 'fixed' | 'lost' | 'drifting';
	}
	function pathOf(values: number[], upTo: number, f: (v: number) => number) {
		const every = Math.max(1, Math.floor(upTo / 450));
		let d = '';
		for (let g = 0; g <= upTo; g++) {
			if (g % every !== 0 && g !== upTo) continue;
			d += `${d ? 'L' : 'M'}${sx(g).toFixed(1)} ${yOf(f(values[g])).toFixed(1)}`;
		}
		return d;
	}
	const lines = $derived.by((): Line[] => {
		if (fates) {
			return fates.shown.map((l, i) => {
				const end = l.copies.length - 1;
				return {
					id: i,
					d: pathOf(l.copies, Math.min(end, gens), (v) => v),
					tail: null,
					tailColor: '',
					end: l.fate === 'drifting' ? null : end,
					fate: l.fate
				};
			});
		}
		const list = one ? [one] : runs;
		return list.map((r, i) => {
			const end = r.fixedAt ?? r.lostAt;
			const upTo = end ?? gens;
			const f = mode === 'hetero' ? heterozygosity : (v: number) => v;
			const yEnd = r.fixedAt !== null ? f(1) : f(0);
			return {
				id: i,
				d: pathOf(r.p, upTo, f),
				tail:
					end !== null && end < gens
						? `M${sx(end).toFixed(1)} ${yOf(yEnd).toFixed(1)}L${PX1} ${yOf(yEnd).toFixed(1)}`
						: null,
				tailColor:
					mode === 'hetero' ? 'var(--stage-ink-muted)' : r.fixedAt !== null ? GENO.AA : GENO.aa,
				end,
				fate: r.fixedAt !== null ? 'fixed' : r.lostAt !== null ? 'lost' : 'drifting'
			};
		});
	});

	// ---- the sweep ---------------------------------------------------------------------------
	const LEAD = 0.5;
	const SWEEP = 12;
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const cursor = $derived(u * gens);
	const g = $derived(Math.floor(cursor));
	const clipW = $derived(Math.max(0, sx(cursor) - PX0 + 3));

	const fixedNow = $derived(
		lines.filter((l) => l.fate === 'fixed' && (l.end ?? Infinity) <= g).length
	);
	const lostNow = $derived(
		lines.filter((l) => l.fate === 'lost' && (l.end ?? Infinity) <= g).length
	);
	const bothNow = $derived(lines.length - fixedNow - lostNow);

	// ---- theory ------------------------------------------------------------------------------
	const det = $derived(
		mode === 'selection' || mode === 'dominance' ? deterministic(p0, s, h, gens) : null
	);
	const detPath = (values: number[]) =>
		values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join('');
	const dominances = $derived(
		mode === 'dominance'
			? [
					{ h: 0, name: 'recessive', at: 0.2, anchor: 'end' as const },
					{ h: 0.5, name: 'additive', at: 0.5, anchor: 'start' as const },
					{ h: 1, name: 'dominant', at: 0.8, anchor: 'end' as const }
				].map((c) => {
					const values = deterministic(p0, s, c.h, gens);
					const cross = values.findIndex((v) => v >= c.at);
					return { ...c, d: detPath(values), cross, chosen: Math.abs(c.h - h) < 1e-9 };
				})
			: []
	);
	const kimura = $derived(
		mode === 'drift'
			? p0
			: mode === 'selection' || mode === 'dominance'
				? fixationChance(N, s, h, p0)
				: 0
	);

	// heterozygosity: the average of the hundred, and the 1/2N decay
	const meanH = $derived(
		mode === 'hetero'
			? Array.from(
					{ length: gens + 1 },
					(_, i) => runs.reduce((a, r) => a + heterozygosity(r.p[i]), 0) / runs.length
				)
			: []
	);
	const H0 = $derived(heterozygosity(p0));
	const theoryH = (i: number) => H0 * (1 - 1 / (2 * N)) ** i;
	const theoryPath = $derived(
		mode === 'hetero'
			? Array.from({ length: 201 }, (_, k) => (k / 200) * gens)
					.map((x, k) => `${k ? 'L' : 'M'}${sx(x).toFixed(1)} ${yOf(theoryH(x)).toFixed(1)}`)
					.join('')
			: ''
	);
	const meanPath = $derived(mode === 'hetero' ? detPath(meanH) : '');

	// one population: its genotypes now
	const genoNow = $derived.by((): Genotypes | null => {
		const gs = one?.genotypes;
		return gs ? gs[Math.min(g, gs.length - 1)] : null;
	});
	const pNow = $derived(one ? one.p[Math.min(g, one.p.length - 1)] : 0);
	const hwNow = $derived(hardyWeinberg(pNow));

	// new mutations
	const uNew = $derived(isNew ? newMutationFixes(N, s, 0.5) : 0);
	const aliveNow = $derived(
		isNew ? lines.filter((l) => l.fate !== 'lost' || (l.end ?? 0) > g).length : 0
	);
	const escape = $derived(isNew && s > 0 ? 1 / s : null);

	const fmt = (v: number) => v.toLocaleString('en-US');

	// ---- the left panel ----------------------------------------------------------------------
	const LX = 32;
	const RX = 330;
	const BASE = 410;
	const BH = 190;
	const KEYS = ['AA', 'Aa', 'aa'] as const;
</script>

{#snippet row(id: string, order: number, y: number, name: string, value: string, color?: string)}
	<Readout {id} {order} label={name} {value} {color}>
		<Label x={LX} {y} text={name} size={13} anchor="start" {color} />
		<Label x={RX} {y} text={value} size={14} anchor="end" weight={700} tabular {color} />
	</Readout>
{/snippet}

<g>
	<Axes {sx} {sy} {yTicks} {yFormat} xLabel="generation" />
	<Readout id="ytitle" label={yTitle}>
		<Label anchor="start" x={PX0 - 56} y={PY1 - 18} text={yTitle} size={12} muted />
	</Readout>

	<clipPath id="popgen-traces-clip">
		<rect x={PX0 - 4} y={PY1 - 20} width={clipW + 2} height={PY0 - PY1 + 40} />
	</clipPath>

	<g clip-path="url(#popgen-traces-clip)">
		{#if mode === 'dominance'}
			{#each dominances as c (c.name)}
				<path
					d={c.d}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width={c.chosen ? 2.4 : 1.4}
					stroke-dasharray={c.chosen ? '8 5' : '3 4'}
					opacity={c.chosen ? 0.9 : 0.45}
				/>
			{/each}
		{/if}
		{#each lines as l (l.id)}
			<path
				d={l.d}
				fill="none"
				stroke={mode === 'one' ? 'var(--stage-ink)' : 'var(--popgen-trace)'}
				stroke-width={mode === 'one' ? 2.4 : 1.2}
				opacity={mode === 'one' ? 1 : mode === 'hetero' ? 0.16 : 0.4}
				stroke-linejoin="round"
			/>
			{#if l.tail}
				<path d={l.tail} fill="none" stroke={l.tailColor} stroke-width="2.4" opacity="0.8" />
			{/if}
		{/each}
		{#if det && mode === 'selection'}
			<path
				d={detPath(det)}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2.4"
				stroke-dasharray="8 5"
			/>
		{/if}
		{#if mode === 'hetero'}
			<path
				d={theoryPath}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				stroke-dasharray="8 5"
			/>
			<path d={meanPath} fill="none" stroke="var(--popgen-mean)" stroke-width="3" />
		{/if}
	</g>

	{#if escape !== null && escape < 2 * N}
		<line
			x1={PX0}
			x2={PX1}
			y1={yOf(escape)}
			y2={yOf(escape)}
			stroke="var(--popgen-AA)"
			stroke-width="1.4"
			stroke-dasharray="2 4"
		/>
		<Readout id="escape" label="Dotted line" value="1/s = {fmt(Math.round(escape))} copies">
			<Label
				x={PX1}
				y={yOf(escape) - 8}
				text="1/s = {fmt(Math.round(escape))} copies: past here, rarely lost"
				size={11}
				anchor="end"
				color="var(--popgen-AA)"
			/>
		</Readout>
	{/if}

	{#if mode === 'dominance'}
		{#each dominances as c (c.name)}
			{#if c.cross > 0 && c.cross <= cursor}
				<Readout id="dom-{c.name}">
					<Label
						x={sx(c.cross) + (c.anchor === 'start' ? 8 : -8)}
						y={yOf(c.at) + 4}
						text={c.name}
						size={12}
						weight={c.chosen ? 700 : 500}
						anchor={c.anchor}
						muted={!c.chosen}
					/>
				</Readout>
			{/if}
		{/each}
	{/if}

	{#if !reduced && u < 1}
		<line
			x1={sx(cursor)}
			x2={sx(cursor)}
			y1={PY1}
			y2={PY0}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.6"
		/>
	{/if}

	<!-- ------------------------------------------------------------------ the left panel -->
	<Readout id="gen" order={0} label="Generation" value={fmt(g)}>
		<Label
			x={LX}
			y={112}
			text="generation {fmt(g)}"
			size={17}
			weight={700}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="setting">
		<Label
			x={LX}
			y={136}
			text={isNew
				? `${fmt(TRIALS)} new mutations · N = ${fmt(N)} · up to 6,000 gen.`
				: mode === 'one'
					? `one population · N = ${fmt(N)}`
					: `${POPS} populations · N = ${fmt(N)}`}
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	{#if mode === 'one' && genoNow}
		{@render row('p', 1, 172, 'share of A, p', percent(pNow))}
		{#each KEYS as k, i (k)}
			{@const x = 52 + i * 96}
			{@const counted = genoNow[k] / N}
			<rect
				{x}
				y={BASE - BH * counted}
				width={56}
				height={BH * counted}
				rx="3"
				fill={GENO[k]}
				opacity="0.8"
			/>
			<line
				x1={x - 6}
				x2={x + 62}
				y1={BASE - BH * hwNow[k]}
				y2={BASE - BH * hwNow[k]}
				stroke="var(--stage-ink)"
				stroke-width="2.5"
			/>
			<Label x={x + 28} y={BASE + 20} text={k} size={14} weight={700} color={GENO[k]} />
			<Readout
				id="geno-{k}"
				order={2 + i}
				label="{k}: counted · Hardy–Weinberg"
				value="{percent(counted)} · {percent(hwNow[k])}"
				color={GENO[k]}
			>
				<Label x={x + 28} y={BASE + 38} text={percent(counted)} size={12} weight={600} tabular />
				<Label x={x + 28} y={BASE + 54} text="HW {percent(hwNow[k])}" size={11} muted tabular />
			</Readout>
		{/each}
		<Readout id="geno-key">
			<Label
				x={LX}
				y={196}
				text="bars: newborns counted · ticks: p², 2pq, q²"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	{#if mode === 'drift' || mode === 'selection' || mode === 'dominance'}
		{@render row('fixed', 1, 178, 'A fixed (100%)', String(fixedNow), GENO.AA)}
		{@render row('lost', 2, 204, 'A lost (0%)', String(lostNow), GENO.aa)}
		{@render row('both', 3, 230, 'both still present', String(bothNow))}
		<line x1={LX} x2={RX} y1={252} y2={252} stroke="var(--stage-line)" />
		<Readout
			id="expect"
			order={4}
			label={mode === 'drift' ? 'Neutral: fixed in the end' : 'Kimura: fixed in the end'}
			value="about {Math.round(POPS * kimura)} of {POPS}"
		>
			<Label
				x={LX}
				y={278}
				text={mode === 'drift'
					? 'in the end, A is fixed in about'
					: 'Kimura: in the end, A is fixed in'}
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={LX}
				y={300}
				text="{Math.round(POPS * kimura)} of {POPS}{mode === 'drift'
					? ' (its starting share)'
					: ` (${percent(kimura)})`}"
				size={14}
				weight={700}
				anchor="start"
				tabular
			/>
		</Readout>
		{#if mode !== 'drift'}
			<Readout
				id="ns"
				order={5}
				label="N × s"
				value={(N * s).toLocaleString('en-US', { maximumFractionDigits: 2 })}
			>
				<Label
					x={LX}
					y={330}
					text="N × s = {(N * s).toLocaleString('en-US', { maximumFractionDigits: 2 })}"
					size={13}
					anchor="start"
					tabular
				/>
			</Readout>
		{/if}
		{#if mode === 'dominance' && det}
			{@const pd = det[Math.min(g, det.length - 1)]}
			<Readout
				id="hidden"
				order={6}
				label="Dashed curve now"
				value="A at {percent(pd)}, {percent(1 - pd)} of A copies in Aa"
			>
				<Label
					x={LX}
					y={366}
					text="dashed curve: A at {percent(pd)}"
					size={12}
					anchor="start"
					tabular
				/>
				<Label
					x={LX}
					y={386}
					text="{percent(1 - pd)} of the A copies are in Aa"
					size={12}
					anchor="start"
					tabular
				/>
				<Label
					x={LX}
					y={406}
					text={h === 0
						? 'where a recessive A has no effect'
						: h === 1
							? 'where a dominant A has full effect'
							: 'where A has half its effect'}
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	{/if}

	{#if mode === 'hetero'}
		{@render row(
			'mean',
			1,
			178,
			'average 2pq',
			meanH[Math.min(g, meanH.length - 1)].toFixed(3),
			'var(--popgen-mean)'
		)}
		{@render row('theory', 2, 204, 'expected (−1/2N a gen.)', theoryH(g).toFixed(3))}
		{@render row('none', 3, 230, 'no variation left', `${fixedNow + lostNow} of ${POPS}`)}
		<line x1={LX} x2={RX} y1={252} y2={252} stroke="var(--stage-line)" />
		<Readout
			id="half"
			order={4}
			label="Half the variation gone after"
			value="about {fmt(Math.round(Math.log(2) * 2 * N))} generations"
		>
			<Label
				x={LX}
				y={278}
				text="half the variation is gone after"
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={LX}
				y={300}
				text="about {fmt(Math.round(Math.log(2) * 2 * N))} generations (1.4 N)"
				size={14}
				weight={700}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}

	{#if isNew && fates}
		{@const done = u >= 1}
		{@render row(
			'nfixed',
			1,
			178,
			'fixed',
			done ? `${fmt(fates.fixed)} (${percent(fates.fixed / TRIALS)})` : '…',
			GENO.AA
		)}
		{@render row('nlost', 2, 204, 'lost', done ? fmt(fates.lost) : '…', GENO.aa)}
		{#if fates.drifting > 0}
			{@render row('ndrift', 3, 230, 'drifting at 6,000 gen.', done ? fmt(fates.drifting) : '…')}
		{/if}
		<line x1={LX} x2={RX} y1={252} y2={252} stroke="var(--stage-line)" />
		{@render row('kimura', 4, 278, 'Kimura', percent(uNew))}
		{@render row(
			'rule',
			5,
			304,
			s > 0 ? 'Haldane: 2s' : 'neutral: 1/2N',
			percent(s > 0 ? 2 * s : 1 / (2 * N))
		)}
		<Readout id="alive" order={6} label="Lines still present" value="{aliveNow} of {POPS}">
			<Label
				x={LX}
				y={340}
				text="of the {POPS} lines drawn, {aliveNow} still present"
				size={12}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}

	<!-- ------------------------------------------------------------------ key -->
	{#if mode !== 'one'}
		<Readout
			id="key"
			label={mode === 'hetero'
				? 'Thick: average · dashed: 1/2N per generation'
				: 'Green end: A fixed · orange: A lost'}
		>
			<Label
				x={PX0}
				y={572}
				anchor="start"
				size={11}
				muted
				text={mode === 'hetero'
					? 'faint: each population · thick: their average · dashed: expected, −1/2N of what is left a generation'
					: isNew
						? 'each line: one new mutation, from one copy · top: fixed · bottom: lost'
						: mode === 'drift'
							? 'each line: one population · green: A fixed · orange: A lost'
							: 'each line: one population · dashed: selection alone, no chance'}
			/>
		</Readout>
	{/if}
</g>
