<script lang="ts">
	/**
	 * A measured structure (left, in one neutral colour) beside AlphaFold's
	 * prediction of it (right, coloured by AlphaFold's per-residue confidence, pLDDT), turning
	 * together at the same scale, already superposed (see `proteins-data.ts`). Below, the whole
	 * sequence as a strip coloured by confidence, with the stretch that was measured marked.
	 *
	 * The protein is `params.protein`, or `step.hints.protein` on steps about one protein.
	 * `step.hints.site` marks lysozyme's two catalytic acids (Glu35 and Asp52 of the mature
	 * enzyme, UniProt positions 53 and 70) in both structures.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { proteinById, runs } from '../folding';
	import { BAND_COLOR, band, distance, type Band } from '../structure';
	import Label from './Text.svelte';
	import { pieces, projector, Turntable } from './view3d.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const id = $derived(String(step.hints?.protein ?? params.protein ?? 'globin'));
	const P = $derived(proteinById(id));
	const site = $derived(Boolean(step.hints?.site) && id === 'lysozyme');
	const SITE = [52, 69]; // indices of UniProt 53 (Glu35) and 70 (Asp52)

	const LX = 245;
	const RX = 715;
	const CY = 285;
	const RADIUS = 195; // px available around each centre

	// One scale for both panels. p53 is fitted whole, floppy ends included (they are the
	// point of its step); the others are fitted to their measured part, so that lysozyme's
	// 18-amino-acid signal peptide (cut off in the cell) may run out of its panel and is
	// clipped there.
	const fit = $derived.by(() => {
		let r = 0;
		for (const [i, v] of P.pred.entries())
			if (id === 'p53' || P.exp[i]) r = Math.max(r, Math.hypot(v[0], v[1], v[2]));
		return RADIUS / (id === 'p53' ? r : 1.15 * r);
	});
	const scaleT = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const s = fit;
		untrack(() => scaleT.set(s, { duration: reduced || scaleT.current === 1 ? 0 : 700 }));
	});
	const S = $derived(scaleT.current);

	const view = new Turntable(0.12, 0.3, -0.3);
	const yaw = $derived(view.yaw(t, reduced));
	const left = $derived(projector(yaw, view.pitch, S, LX, CY));
	const right = $derived(projector(yaw, view.pitch, S, RX, CY));
	const expProj = $derived(P.exp.map((v) => (v ? left(v) : null)));
	const predProj = $derived(P.pred.map((v) => right(v)));
	const expRuns = $derived(runs(P.exp));
	const predRuns = $derived(runs(P.pred));

	// neutral, so that no colour on the left can be mistaken for a confidence band
	const expPieces = $derived(pieces(expProj, expRuns, () => 'var(--pf-trace)', 3));
	const predPieces = $derived(pieces(predProj, predRuns, (i) => BAND_COLOR[band(P.plddt[i])], 3));
	const width = $derived(clamp(S * 0.55, 2.5, 6));
	const zr = $derived(RADIUS / S);
	const depth = (z: number) => clamp(0.5 + z / (2 * zr), 0, 1);

	// ---- readouts -----------------------------------------------------------------------------
	const measured = $derived(P.exp.filter(Boolean).length);
	const share = $derived.by(() => {
		const out: Record<Band, number> = { veryHigh: 0, high: 0, low: 0, veryLow: 0 };
		for (const v of P.plddt) out[band(v)]++;
		return out;
	});
	const BANDS: { id: Band; label: string }[] = [
		{ id: 'veryHigh', label: 'very high (over 90)' },
		{ id: 'high', label: 'confident (70–90)' },
		{ id: 'low', label: 'low (50–70)' },
		{ id: 'veryLow', label: 'very low (under 50)' }
	];
	const pct = (k: number) => `${Math.round((100 * k) / P.plddt.length)}%`;

	// the sequence strip: runs of the same confidence band
	const SX0 = 40;
	const SX1 = 920;
	const SY = 520;
	const strip = $derived.by(() => {
		const n = P.plddt.length;
		const w = (SX1 - SX0) / n;
		const out: { key: string; x: number; w: number; color: string }[] = [];
		let start = 0;
		for (let i = 1; i <= n; i++) {
			if (i === n || band(P.plddt[i]) !== band(P.plddt[start])) {
				out.push({
					key: `${start}`,
					x: SX0 + start * w,
					w: (i - start) * w,
					color: BAND_COLOR[band(P.plddt[start])]
				});
				start = i;
			}
		}
		return out;
	});
	const span = $derived.by(() => {
		const n = P.plddt.length;
		const first = P.exp.findIndex(Boolean);
		const last = P.exp.findLastIndex(Boolean);
		const w = (SX1 - SX0) / n;
		return { x0: SX0 + first * w, x1: SX0 + (last + 1) * w, first: first + 1, last: last + 1 };
	});

	const siteDist = $derived(site ? distance(P.exp[SITE[0]]!, P.exp[SITE[1]]!) : 0);
	const NAMES = ['Glu35', 'Asp52'];
	const method = $derived(P.pdb.method.replace('x-ray diffraction', 'X-ray'));
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- drag / keyboard targets: turning either structure turns both -->
	{#each [LX, RX] as cx, k (cx)}
		<rect
			class="turn"
			x={cx - 225}
			y={70}
			width="450"
			height="420"
			rx="16"
			fill="transparent"
			role="slider"
			tabindex="0"
			aria-label="Turn the {k === 0
				? 'measured'
				: 'predicted'} structure (both turn): drag, or use the arrow keys"
			aria-valuemin={0}
			aria-valuemax={359}
			aria-valuenow={view.degrees(t, reduced)}
			onpointerdown={(e) => view.drag(e)}
			onkeydown={(e) => view.key(e)}
			onpointerenter={() => view.hold(t)}
			onpointerleave={() => view.release(t)}
		/>
	{/each}

	<clipPath id="compare-clip">
		<rect x={RX - 228} y={70} width="456" height="420" rx="16" />
	</clipPath>
	<g style:pointer-events="none">
		{#each expPieces as p (p.key)}
			<path
				d={p.d}
				fill="none"
				stroke={p.color}
				stroke-width={width * (0.75 + 0.5 * depth(p.z))}
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={0.45 + 0.55 * depth(p.z)}
			/>
		{/each}
		<g clip-path="url(#compare-clip)">
			{#each predPieces as p (p.key)}
				<path
					d={p.d}
					fill="none"
					stroke={p.color}
					stroke-width={width * (0.75 + 0.5 * depth(p.z))}
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity={0.45 + 0.55 * depth(p.z)}
				/>
			{/each}
		</g>
		{#if site}
			{#each SITE as i, k (i)}
				{#each [expProj[i], predProj[i]] as q, side (side)}
					{@const o = side === 0 ? expProj[SITE[1 - k]] : predProj[SITE[1 - k]]}
					{#if q && o}
						<!-- each label sits on the far side from its partner, so the two never overlap -->
						{@const dx = q.x - o.x}
						{@const dy = q.y - o.y}
						{@const l = Math.max(1, Math.hypot(dx, dy))}
						<circle
							cx={q.x}
							cy={q.y}
							r="8"
							fill="var(--dp-negative)"
							stroke="var(--stage-ink)"
							stroke-width="2"
						/>
						<Readout id="site-{k}-{side}">
							<Label
								x={q.x + (16 * dx) / l}
								y={q.y + (16 * dy) / l + 5}
								text={NAMES[k]}
								size={13}
								weight={700}
								anchor={dx >= 0 ? 'start' : 'end'}
							/>
						</Readout>
					{/if}
				{/each}
			{/each}
		{/if}
	</g>

	<!-- titles -->
	<Readout
		id="exp"
		order={1}
		label="Measured"
		value="PDB {P.pdb.id}, {method}, {P.pdb.resolution} Å, {measured} amino acids"
	>
		<Label x={LX} y={40} text="Measured: PDB {P.pdb.id}" size={15} weight={600} />
		<Label
			x={LX}
			y={60}
			text="{method} · {P.pdb.resolution} Å · {measured} of {P.sequence.length} amino acids"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="pred" order={2} label="Predicted" value="AlphaFold DB {P.af.id}, from the sequence">
		<Label x={RX} y={40} text="Predicted: AlphaFold" size={15} weight={600} />
		<Label x={RX} y={60} text="{P.af.id} · from the sequence and its relatives’" size={12} muted />
	</Readout>
	<Readout id="rmsd" order={3} label="Difference" value="{P.rmsd.toFixed(2)} Å (Cα RMSD)">
		<Label x={480} y={470} text="difference: {P.rmsd.toFixed(2)} Å" size={14} weight={600} />
		<Label x={480} y={488} text="(Cα RMSD over the {measured} measured)" size={11} muted />
	</Readout>
	{#if site}
		<Readout
			id="sitedist"
			order={4}
			label="Glu35 to Asp52"
			value="{siteDist.toFixed(0)} Å apart in the fold; 17 amino acids apart along the chain"
		>
			<Label
				x={480}
				y={110}
				text="Glu35–Asp52: {siteDist.toFixed(0)} Å apart in the fold,"
				size={12}
			/>
			<Label x={480} y={126} text="17 links (about 65 Å) apart along the chain" size={12} muted />
		</Readout>
	{/if}

	<!-- confidence key: in the strip's legend on wide screens, with shares on phones -->
	<Readout
		id="bands"
		order={5}
		label="AlphaFold’s confidence: very high · confident · low · very low"
		value={BANDS.map((b) => pct(share[b.id])).join(' · ')}
	/>
	<!-- the sequence strip -->
	<Readout id="strip">
		<Label
			x={SX0}
			y={SY - 10}
			text="whole chain, start to end, by AlphaFold’s confidence:"
			size={12}
			anchor="start"
			muted
		/>
		{#each BANDS as b, k (b.id)}
			<rect
				x={SX0 + 330 + k * 140}
				y={SY - 21}
				width="12"
				height="12"
				rx="2"
				fill={BAND_COLOR[b.id]}
			/>
			<Label x={SX0 + 346 + k * 140} y={SY - 11} text={b.label} size={11} anchor="start" />
		{/each}
	</Readout>
	{#each strip as s (s.key)}
		<rect x={s.x} y={SY} width={s.w + 0.4} height="14" fill={s.color} />
	{/each}
	<path
		d="M{span.x0} {SY + 22} v6 H{span.x1} v-6"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout
		id="span"
		order={9}
		label="Measured stretch"
		value="amino acids {span.first}–{span.last}"
	>
		<Label
			x={(span.x0 + span.x1) / 2}
			y={SY + 46}
			text="measured: {span.first}–{span.last}"
			size={12}
		/>
	</Readout>
</g>

<style>
	.turn {
		cursor: grab;
		outline: none;
	}
	.turn:focus-visible {
		stroke: var(--explainer-accent, var(--accent));
		stroke-width: 2;
	}
</style>
