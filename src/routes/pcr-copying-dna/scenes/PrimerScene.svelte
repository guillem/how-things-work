<script lang="ts">
	/**
	 * The primers choose what is copied. Two real stretches of DNA, both strands letter by letter:
	 * the SARS-CoV-2 N gene around the CDC N1 target and the human RPP30 gene around the CDC
	 * RNase P target. The chosen primer pair (`params.primers`) pairs where its letters match
	 * exactly (`primerSites`): the forward primer under the bottom strand, the reverse primer over
	 * the top strand, and the piece between them is marked as copied. On the other stretch the
	 * scene says how close the nearest match comes. Below, the tube of those primers and its
	 * curve: a template that is present and matched rises; otherwise the tube stays dark.
	 * `params.virus` takes the virus out of the swab. Primers settle and the curve draws with t.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CYCLES,
		THRESHOLD,
		amplify,
		bestMismatch,
		complement,
		copiesAt,
		primerSites,
		reverseComplement,
		thresholdCycle,
		RECIPE
	} from '../pcr';
	import { TARGETS, type Target } from '../sequences-data';
	import { powerLabel, tubePath } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const chosen = $derived(params.primers === 'rp' ? 'rp' : 'n1');
	const virus = $derived(params.virus !== false);
	const pair = $derived(TARGETS.find((x) => x.id === chosen) ?? TARGETS[0]);
	const settle = $derived(reduced ? 1 : smoothstep(0.2, 1.6, t));

	/** Copies of each stretch in the tube at the start: round, illustrative numbers. */
	const START: Record<Target['id'], number> = { n1: 1000, rp: 10000 };

	const startText = $derived(
		virus
			? '1,000 copies of the virus’s piece, 10,000 of the human one'
			: 'no virus, 10,000 copies of the human piece'
	);

	const CW = 8.6;
	const X0 = 52;
	const xAt = (i: number) => X0 + i * CW;

	const blocks = $derived(
		TARGETS.map((target, j) => {
			const sites = primerSites(target.top, pair.forward, pair.reverse);
			const present = target.id === 'rp' || virus;
			return {
				target,
				y: 92 + j * 170,
				sites,
				present,
				fMiss: bestMismatch(target.top, pair.forward),
				rMiss: bestMismatch(target.top, reverseComplement(pair.reverse))
			};
		})
	);

	/** Segments of a strand: the primer sites highlighted. */
	function segments(
		top: string,
		sites: { forward: number; reverse: number },
		fl: number,
		rl: number
	) {
		const marks: { from: number; to: number; on: boolean }[] = [];
		// a plain local set, not reactive state
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const cuts = new Set([0, top.length]);
		if (sites.forward >= 0) {
			cuts.add(sites.forward);
			cuts.add(sites.forward + fl);
		}
		if (sites.reverse >= 0) {
			cuts.add(sites.reverse);
			cuts.add(sites.reverse + rl);
		}
		const sorted = [...cuts].sort((p, q) => p - q);
		for (let i = 0; i + 1 < sorted.length; i++) {
			const from = sorted[i];
			const to = sorted[i + 1];
			const on =
				(sites.forward >= 0 && from >= sites.forward && to <= sites.forward + fl) ||
				(sites.reverse >= 0 && from >= sites.reverse && to <= sites.reverse + rl);
			marks.push({ from, to, on });
		}
		return marks;
	}

	// ---- the tube's curve --------------------------------------------------------------------------
	const copied = $derived(
		blocks.find((b) => b.target.id === chosen && b.present && b.sites.product)
	);
	// the tube's recipe, with the chosen piece's length and its primers' letters
	const run = $derived(
		copied
			? amplify(START[copied.target.id], CYCLES, 1, {
					...RECIPE,
					amplicon: copied.target.ampliconLength,
					primerLetters: pair.forward.length + pair.reverse.length
				})
			: null
	);
	const shown = $derived(reduced ? CYCLES : Math.min(CYCLES, t * 2));
	const ct = $derived(run ? thresholdCycle(run) : null);
	const crossed = $derived(ct !== null && shown >= ct);

	const MX0 = 400;
	const MX1 = 900;
	const MY0 = 560;
	const MY1 = 440;
	const msx = scale([0, CYCLES], [MX0, MX1]);
	const msy = scale([0, 13], [MY0, MY1]);
	const curve = $derived.by(() => {
		if (!run) return `M${MX0} ${MY0} L${msx(shown)} ${MY0}`;
		let d = '';
		for (let c = 0; c <= shown + 1e-9; c += 0.25)
			d += `${d ? 'L' : 'M'}${msx(c).toFixed(1)} ${msy(Math.log10(copiesAt(run, c))).toFixed(1)}`;
		return d;
	});
	const glow = $derived(run ? smoothstep(9.6, 12.4, Math.log10(copiesAt(run, shown))) : 0);
	const TUBE = { x: 120, y: 430, w: 64, h: 130 };
	const outline = tubePath(TUBE.x, TUBE.y, TUBE.w, TUBE.h);
	const result = $derived(
		copied
			? crossed && ct !== null
				? `${copied.target.id === 'n1' ? 'the virus’s piece' : 'the human piece'} is copied: Ct ${ct.toFixed(1)}`
				: 'copying…'
			: 'nothing to copy: the tube stays dark'
	);
</script>

<g>
	{#each blocks as blk (blk.target.id)}
		{@const y = blk.y}
		{@const color = blk.target.id === 'n1' ? 'var(--pcr-virus)' : 'var(--pcr-human)'}
		{@const fl = pair.forward.length}
		{@const rl = pair.reverse.length}
		{@const segs = segments(blk.target.top, blk.sites, fl, rl)}
		{@const bound = blk.sites.product !== null && blk.present}
		<g opacity={blk.present ? 1 : 0.3}>
			<Readout
				id="name-{blk.target.id}"
				order={blk.target.id === 'n1' ? 1 : 2}
				label={blk.target.id === 'n1' ? 'Virus, N gene' : 'Human, RPP30 gene'}
				value={!blk.present
					? 'not in this swab'
					: bound
						? `primers pair: ${blk.target.ampliconLength} letters copied`
						: `no match: the closest stretches differ in ${blk.fMiss} and ${blk.rMiss} letters`}
				color={blk.present && bound ? color : undefined}
			>
				<Label
					anchor="start"
					x={X0}
					y={y - 40}
					text={blk.target.id === 'n1'
						? 'Virus: SARS-CoV-2 N gene'
						: 'Human: RPP30 gene, in every cell of the swab'}
					size={14}
					weight={700}
					{color}
				/>
				<Label
					x={xAt(blk.target.top.length)}
					y={y - 40}
					text={!blk.present
						? 'not in this swab'
						: bound
							? 'both primers pair'
							: `no match: the closest stretches differ in ${blk.fMiss} and ${blk.rMiss} letters`}
					size={12}
					anchor="end"
					weight={600}
					color={bound ? color : undefined}
					muted={!bound}
				/>
			</Readout>
			<!-- strands, letter by letter -->
			{#each [0, 1] as row (row)}
				{#each segs as s (s.from)}
					<text
						x={xAt(s.from)}
						y={y + row * 20}
						textLength={(s.to - s.from) * CW}
						lengthAdjust="spacing"
						font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
						font-size="12"
						fill={s.on && bound ? 'var(--stage-ink)' : row === 0 ? color : 'var(--stage-ink-muted)'}
						font-weight={s.on && bound ? 700 : 400}
					>
						{row === 0
							? blk.target.top.slice(s.from, s.to)
							: complement(blk.target.top.slice(s.from, s.to))}
					</text>
				{/each}
			{/each}
			<Readout id="ends-{blk.target.id}">
				<Label x={X0 - 8} {y} text="5′" size={10} muted anchor="end" halo={false} />
				<Label x={X0 - 8} y={y + 20} text="3′" size={10} muted anchor="end" halo={false} />
			</Readout>

			{#if bound && blk.sites.product}
				{@const p = blk.sites.product}
				{@const lift = (1 - settle) * 26}
				<!-- the reverse primer pairs with the top strand (written 3′←5′ above it) -->
				<text
					x={xAt(blk.sites.reverse)}
					y={y - 20 - lift}
					textLength={rl * CW}
					lengthAdjust="spacing"
					font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
					font-size="12"
					font-weight="700"
					fill="var(--pcr-primer)"
					opacity={0.4 + 0.6 * settle}
					>{complement(blk.target.top.slice(blk.sites.reverse, blk.sites.reverse + rl))}</text
				>
				<Readout id="rev-{blk.target.id}">
					<Label
						x={xAt(blk.sites.reverse) - 6}
						y={y - 20 - lift}
						text="← reverse primer"
						size={11}
						anchor="end"
						color="var(--pcr-primer)"
						weight={600}
						halo={false}
					/>
				</Readout>
				<!-- the forward primer pairs with the bottom strand (written 5′→3′ under it) -->
				<text
					x={xAt(blk.sites.forward)}
					y={y + 40 + lift}
					textLength={fl * CW}
					lengthAdjust="spacing"
					font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
					font-size="12"
					font-weight="700"
					fill="var(--pcr-primer)"
					opacity={0.4 + 0.6 * settle}>{pair.forward}</text
				>
				<Readout id="fwd-{blk.target.id}">
					<Label
						x={xAt(blk.sites.forward + fl) + 6}
						y={y + 40 + lift}
						text="forward primer →"
						size={11}
						anchor="start"
						color="var(--pcr-primer)"
						weight={600}
						halo={false}
					/>
				</Readout>
				<!-- the copied piece -->
				<g opacity={settle}>
					<path
						d="M{xAt(p[0])} {y + 52} v6 H{xAt(p[1])} v-6"
						fill="none"
						stroke={color}
						stroke-width="1.6"
					/>
					<Readout id="piece-{blk.target.id}">
						<Label
							x={(xAt(p[0]) + xAt(p[1])) / 2}
							y={y + 76}
							text="{blk.target.ampliconLength} letters copied"
							size={12}
							weight={600}
							{color}
						/>
					</Readout>
				</g>
			{/if}
		</g>
	{/each}

	<!-- ---------------------------------------------------------------- the tube -->
	<clipPath id="pcr-primer-clip"><path d="{outline} Z" /></clipPath>
	<path d="{outline} Z" fill="var(--stage-bg)" />
	<rect
		x={TUBE.x}
		y={TUBE.y + TUBE.h * 0.3}
		width={TUBE.w}
		height={TUBE.h * 0.7}
		fill="var(--pcr-liquid)"
		clip-path="url(#pcr-primer-clip)"
	/>
	<rect
		x={TUBE.x}
		y={TUBE.y + TUBE.h * 0.3}
		width={TUBE.w}
		height={TUBE.h * 0.7}
		fill="var(--pcr-glow)"
		opacity={0.9 * glow}
		clip-path="url(#pcr-primer-clip)"
		filter={glow > 0.05 ? 'url(#glow)' : undefined}
	/>
	<path d={outline} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" />
	<rect
		x={TUBE.x - 5}
		y={TUBE.y - 10}
		width={TUBE.w + 10}
		height="10"
		rx="4"
		fill="var(--surface)"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<Readout
		id="tube"
		order={3}
		label={chosen === 'n1' ? 'N1 tube' : 'RNase P tube'}
		value={result}
		color={copied && crossed ? 'var(--pcr-glow)' : undefined}
	>
		<Label
			anchor="start"
			x={TUBE.x - 60}
			y={TUBE.y - 18}
			text="{chosen === 'n1' ? 'N1' : 'RNase P'} primers: {result}"
			size={14}
			weight={700}
		/>
	</Readout>
	<Axes
		sx={msx}
		sy={msy}
		yTicks={[0, 6, 12]}
		yFormat={powerLabel}
		xTicks={[0, 10, 20, 30, 40]}
		xLabel="cycle"
	/>
	<line
		x1={MX0}
		x2={MX1}
		y1={msy(Math.log10(THRESHOLD))}
		y2={msy(Math.log10(THRESHOLD))}
		stroke="var(--pcr-line)"
		stroke-width="1.4"
		stroke-dasharray="7 5"
	/>
	<path
		d={curve}
		fill="none"
		stroke={copied
			? chosen === 'n1'
				? 'var(--pcr-virus)'
				: 'var(--pcr-human)'
			: 'var(--stage-ink-muted)'}
		stroke-width="2.4"
	/>
	<Readout id="start" label="Copies at the start (round numbers)" value={startText}>
		<Label x={MX1} y={MY1 - 10} text="at the start: {startText}" size={11} anchor="end" muted />
	</Readout>
</g>
