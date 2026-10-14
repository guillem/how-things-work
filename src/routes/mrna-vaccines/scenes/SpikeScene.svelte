<script lang="ts">
	/**
	 * Step "prolines": the spike before and after fusion, traced from PDB 6VSB
	 * (the two-proline spike) and 6XRA (the postfusion S2), at the same scale
	 * (12 px per nm), standing on the virus's membrane; an antibody (PDB 1IGT,
	 * from the immune-system page) at the same scale. Right: codons 983–990 of
	 * the virus and of the vaccine, with 986–987 marked.
	 *
	 * With the prolines (default) the spike stays in its before shape and the
	 * antibody grips its head. Without them the spike springs in a loop: the
	 * S1 heads fall away and S2 becomes the long needle (slowed down hugely;
	 * the real change takes a fraction of a second). Reduced motion shows the
	 * sprung spike when the prolines are off.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { codonToAmino } from '../../dna-to-protein/genetics';
	import { SHAPES as IMMUNE } from '../../immune-system/shapes';
	import { SEQUENCE, SHAPES } from '../data';

	let { t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);

	const pro = $derived(params.prolines !== false);
	const proT = Tween.of(() => (pro ? 1 : 0), { duration: 700, easing: cubicInOut });

	const K = 12; // px per nm
	const pre = SHAPES.prefusion;
	const post = SHAPES.postfusion;
	const ab = IMMUNE.antibody;
	const MEM = 520; // membrane y
	const SX = 230; // spike x
	/** Top of the before-shape spike. */
	const top = MEM - (pre.bottom - pre.top) * K;

	/** 0 = before shape, 1 = sprung (after shape); loops while the prolines are off. */
	const sprung = $derived.by(() => {
		if (reduced) return 1 - proT.current;
		const p = cycle(time, 8);
		const s = smoothstep(0.3, 0.5, p) * (1 - smoothstep(0.92, 1, p));
		return s * (1 - proT.current);
	});
	/** The S1 heads drift up and away as the spike springs. */
	const drift = $derived(smoothstep(0, 0.6, sprung));
	const jiggle = $derived(proT.current * Math.sin(time * 6) * 0.8);

	const windowRows = SEQUENCE.windowVirus.map((v, i) => ({
		n: SEQUENCE.windowFrom + i,
		virus: v,
		vaccine: SEQUENCE.windowVaccine[i],
		aaV: codonToAmino(v.replace(/U/g, 'T')),
		aaP: codonToAmino(SEQUENCE.windowVaccine[i].replace(/U/g, 'T'))
	}));
	const QX0 = 600;
	const QW = 42;
</script>

<g>
	<!-- membrane of the virus -->
	<rect
		x={40}
		y={MEM}
		width={420}
		height={14}
		rx="7"
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
	/>
	<Readout id="membrane">
		<Label x={50} y={MEM + 40} text="the virus’s membrane" size={11} anchor="start" muted />
	</Readout>

	<!-- before: S2 then S1, fading out as it springs -->
	<g opacity={1 - smoothstep(0.35, 0.75, sprung)} transform="rotate({jiggle} {SX} {MEM})">
		<g transform="translate({SX} {MEM}) scale({K}) translate(0 {-pre.bottom})">
			{#each pre.groups as g (g.name)}
				{#if g.name === 'S2'}
					<path
						d={g.d}
						fill="var(--mv-s2)"
						stroke="var(--stage-bg)"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
					/>
				{/if}
			{/each}
		</g>
	</g>
	<g
		opacity={1 - smoothstep(0.5, 1, drift)}
		transform="translate({drift * 150} {-drift * 160}) rotate({drift * 50 + jiggle} {SX} {MEM -
			150})"
	>
		<g transform="translate({SX} {MEM}) scale({K}) translate(0 {-pre.bottom})">
			{#each pre.groups as g (g.name)}
				{#if g.name === 'S1'}
					<path
						d={g.d}
						fill="var(--mv-s1)"
						stroke="var(--stage-bg)"
						stroke-width="1"
						vector-effect="non-scaling-stroke"
					/>
				{/if}
			{/each}
		</g>
	</g>

	<!-- after: the S2 needle grows in -->
	<g opacity={smoothstep(0.35, 0.8, sprung)}>
		<g
			transform="translate({SX} {MEM}) scale({K} {K *
				(0.7 + 0.3 * smoothstep(0.3, 1, sprung))}) translate(0 {-post.bottom})"
		>
			{#each post.groups as g (g.name)}
				<path
					d={g.d}
					fill="var(--mv-s2)"
					stroke="var(--stage-bg)"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		</g>
	</g>

	<!-- the antibody on the head, when the spike holds its shape -->
	<g opacity={proT.current * (1 - sprung)}>
		<g
			transform="translate({SX + 10} {top -
				(ab.bottom - 0.5) * K * 0.98 +
				26}) rotate(180) scale({K})"
		>
			{#each ab.groups as g (g.name)}
				<path
					d={g.d}
					fill={g.name === 'heavy' ? 'var(--im-antibody)' : 'var(--im-bcell)'}
					opacity={g.name === 'heavy' ? 0.85 : 0.55}
					stroke="var(--stage-bg)"
					stroke-width="1"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		</g>
	</g>

	<!-- captions -->
	<Readout
		id="shape"
		order={1}
		label="The spike"
		value={pro
			? 'held in its before shape; an antibody grips its head'
			: 'springs into its after shape: the S1 heads fall away, S2 becomes a needle'}
	>
		{#if pro}
			<Label
				x={SX + 110}
				y={MEM - 120}
				text="before shape, held"
				size={14}
				weight={600}
				anchor="start"
			/>
			<Label
				x={SX + 110}
				y={MEM - 100}
				text="S1 heads (orange) ready to grip a cell"
				size={11}
				anchor="start"
				muted
			/>
			<Label x={SX + 110} y={MEM - 84} text="S2 stalk (yellow)" size={11} anchor="start" muted />
			<Label
				x={SX + 110}
				y={top - 60}
				text="antibody (same scale)"
				size={11}
				anchor="start"
				color="var(--im-antibody)"
			/>
			<Label x={SX + 110} y={top - 44} text="blocks the head" size={11} anchor="start" muted />
		{:else}
			<Label
				x={SX + 110}
				y={MEM - 120}
				text={sprung > 0.5 ? 'after shape: a long needle' : 'before shape… springing'}
				size={14}
				weight={600}
				anchor="start"
			/>
			<Label
				x={SX + 110}
				y={MEM - 100}
				text="antibodies against this shape"
				size={11}
				anchor="start"
				muted
			/>
			<Label
				x={SX + 110}
				y={MEM - 84}
				text="mostly fail to block the virus"
				size={11}
				anchor="start"
				muted
			/>
		{/if}
	</Readout>
	<Readout id="scale">
		<line
			x1={60}
			x2={60 + 10 * K}
			y1={70}
			y2={70}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<Label x={60 + 5 * K} y={60} text="10 nm" size={11} muted />
		<Label x={60} y={90} text="traced from PDB 6VSB, 6XRA, 1IGT" size={11} anchor="start" muted />
	</Readout>

	<!-- the codons -->
	<Readout
		id="codons"
		order={2}
		label="Codons 986–987"
		value={pro
			? 'AAA GUU (lysine, valine) in the virus → CCU CCU (proline, proline) in the vaccine'
			: 'AAA GUU: lysine, valine, as in the virus'}
	>
		<Label
			x={QX0 + (8 * QW) / 2}
			y={170}
			text="codons {SEQUENCE.windowFrom}–{SEQUENCE.windowFrom + 7} of the spike"
			size={13}
			weight={600}
		/>
		{#each ['virus', 'vaccine'] as row, j (row)}
			<text
				x={QX0 - 10}
				y={232 + j * 92}
				font-size="13"
				text-anchor="end"
				font-weight={(j === 1) === pro ? 600 : 400}>{row}</text
			>
		{/each}
		{#each windowRows as c, i (c.n)}
			{@const x = QX0 + i * QW + QW / 2}
			{@const hot = c.n === 986 || c.n === 987}
			{#if hot}
				<rect
					x={x - QW / 2 + 2}
					y={196}
					width={QW - 4}
					height={204}
					rx="6"
					fill="var(--mv-spike)"
					opacity="0.12"
				/>
			{/if}
			<text {x} y={204} font-size="10" text-anchor="middle" class="muted">{c.n}</text>
			{#each [{ cod: c.virus, aa: c.aaV, j: 0 }, { cod: c.vaccine, aa: c.aaP, j: 1 }] as r (r.j)}
				<g opacity={(r.j === 1) === pro ? 1 : 0.45}>
					<text
						{x}
						y={232 + r.j * 92}
						font-size="14"
						text-anchor="middle"
						font-family="ui-monospace, monospace"
						font-weight={hot ? 700 : 400}>{r.cod}</text
					>
					<circle
						cx={x}
						cy={262 + r.j * 92}
						r="13"
						fill="var(--surface)"
						stroke={hot ? 'var(--mv-spike)' : 'var(--stage-line)'}
						stroke-width="1.5"
					/>
					<text {x} y={267 + r.j * 92} font-size="13" font-weight="600" text-anchor="middle"
						>{r.aa}</text
					>
				</g>
			{/each}
		{/each}
		<Label
			x={QX0 + 3 * QW}
			y={432}
			text={pro ? 'lysine, valine → proline, proline' : 'lysine, valine: the virus’s own spike'}
			size={13}
			weight={600}
			anchor="start"
			color="var(--mv-spike)"
		/>
		<Label
			x={QX0 + 3 * QW}
			y={452}
			text={pro ? 'stiff prolines jam the hinge' : 'free to spring'}
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
