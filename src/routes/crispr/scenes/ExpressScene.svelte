<script lang="ts">
	/**
	 * Step "express": the array (spacers C, B, A) is transcribed from the
	 * leader into one long RNA (RNA polymerase moving right, the copy growing
	 * behind it); the RNA is cut in the middle of every repeat into crRNAs, one
	 * spacer each with half a repeat on either side; each crRNA moves into its
	 * own Cas9. Plays once over about 12 s, then holds (reduced motion: the end).
	 */
	import { lerp, norm, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import ArrayStrip, { STRIP, spacerX, stripWidth, type StripSpacer } from './ArrayStrip.svelte';
	import Tag from './Tag.svelte';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);
	const prog = $derived(norm(time, 0.6, 12.6));

	const SP: StripSpacer[] = [
		{ key: 'C', label: 'C', color: 'var(--cr-s3)' },
		{ key: 'B', label: 'B', color: 'var(--cr-s2)' },
		{ key: 'A', label: 'A', color: 'var(--cr-s1)' }
	];
	const S = 1.3;
	const X0 = 480 - stripWidth(3, S) / 2;
	const Y_DNA = 130;
	const Y_RNA = 206;
	const firstRepeat = X0 + STRIP.leader * S;
	const end = X0 + stripWidth(3, S);
	const R = STRIP.repeat * S;
	const SPW = STRIP.spacer * S;

	/** RNA polymerase: from the leader to the end of the array. */
	const polX = $derived(lerp(X0 + 20, end + 10, smoothstep(0, 0.35, prog)));
	const fly = $derived(smoothstep(0.5, 0.85, prog));

	const CAS = [240, 480, 720];
	const Y_CAS = 400;
	/** Each crRNA: centre on the RNA, then into its Cas9. */
	const pieces = SP.map((sp, i) => {
		const cx = spacerX(X0, i, S);
		return { ...sp, i, cx, w: SPW + R };
	});
	const pieceAt = (p: (typeof pieces)[number]) => {
		const sep = smoothstep(0.42, 0.5, prog) * 10 * (p.i - 1);
		const x = lerp(p.cx + sep, CAS[p.i], fly);
		const y = lerp(Y_RNA, Y_CAS - 6, fly);
		return { x, y };
	};
	const bob = (i: number) =>
		reduced ? 0 : Math.sin(time * 1.2 + i * 2) * 2 * smoothstep(0.85, 1, prog);
	const phase = $derived(prog < 0.37 ? 0 : prog < 0.5 ? 1 : 2);
	const LINES = [
		'1  The array is transcribed into one long RNA',
		'2  The RNA is cut inside every repeat',
		'3  Each piece, a crRNA, is loaded into a Cas9'
	];
</script>

<g>
	<Readout
		id="dna"
		order={1}
		label="CRISPR array (DNA)"
		value="leader, then three spacers from phages C, B and A"
	>
		<Tag x={X0 - 24} y={Y_DNA + 5} text="DNA" size={13} weight={600} anchor="end" />
	</Readout>
	<ArrayStrip x={X0} y={Y_DNA} spacers={SP} scale={S} text={14} />

	<!-- RNA polymerase and the growing copy -->
	{#if prog < 0.42}
		{@const shown = Math.max(0, polX - firstRepeat)}
		<clipPath id="express-rna-clip">
			<rect x={firstRepeat} y={Y_RNA - 10} width={shown} height={20} />
		</clipPath>
		<g clip-path="url(#express-rna-clip)">
			<rect
				x={firstRepeat}
				y={Y_RNA - 5}
				width={end - firstRepeat}
				height={10}
				rx={4}
				fill="var(--cr-rna)"
				opacity="0.5"
			/>
			{#each pieces as p (p.key)}
				<rect x={p.cx - SPW / 2} y={Y_RNA - 6} width={SPW} height={12} rx={4} fill={p.color} />
			{/each}
		</g>
		<g opacity={1 - smoothstep(0.35, 0.4, prog)}>
			<ellipse
				cx={polX}
				cy={(Y_DNA + Y_RNA) / 2 - 4}
				rx={26}
				ry={34}
				fill="var(--protein)"
				stroke="var(--protein-edge)"
				stroke-width="1.5"
				opacity="0.9"
			/>
			<Readout id="pol" label="RNA polymerase">
				<Tag x={polX} y={Y_DNA - 46} text="RNA polymerase" size={12} muted />
			</Readout>
		</g>
	{/if}

	<!-- cuts in the middle of each repeat -->
	{#if prog >= 0.36 && prog < 0.55}
		{#each [0, 1, 2, 3] as k (k)}
			{@const cx = firstRepeat + R / 2 + k * (SPW + R)}
			<g opacity={smoothstep(0.36, 0.4, prog) * (1 - smoothstep(0.5, 0.55, prog))}>
				<line
					x1={cx - 6}
					y1={Y_RNA - 14}
					x2={cx + 6}
					y2={Y_RNA + 14}
					stroke="var(--cr-cut)"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
				<line
					x1={cx + 6}
					y1={Y_RNA - 14}
					x2={cx - 6}
					y2={Y_RNA + 14}
					stroke="var(--cr-cut)"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
			</g>
		{/each}
	{/if}

	<!-- Cas9 proteins -->
	{#each CAS as cx, i (i)}
		{@const o = 0.35 + 0.65 * smoothstep(0.45, 0.6, prog)}
		<g opacity={o} transform="translate(0 {bob(i)})">
			<path
				d="M{cx - 70} {Y_CAS + 4} C {cx - 76} {Y_CAS - 46}, {cx - 18} {Y_CAS - 62}, {cx +
					6} {Y_CAS - 40} C {cx + 30} {Y_CAS - 64}, {cx + 80} {Y_CAS - 40}, {cx + 70} {Y_CAS +
					6} C {cx + 66} {Y_CAS + 48}, {cx - 64} {Y_CAS + 50}, {cx - 70} {Y_CAS + 4} Z"
				fill="var(--cr-cas9)"
				opacity="0.85"
				stroke="var(--cr-cas9-edge)"
				stroke-width="1.5"
			/>
			<text
				x={cx}
				y={Y_CAS + 34}
				text-anchor="middle"
				style:font-size="13px"
				style:fill="#fff"
				font-weight="600">Cas9</text
			>
		</g>
	{/each}

	<!-- the crRNA pieces, after the cut -->
	{#if prog >= 0.42}
		{#each pieces as p (p.key)}
			{@const q = pieceAt(p)}
			<g transform="translate(0 {bob(p.i)})">
				<rect x={q.x - p.w / 2} y={q.y - 5} width={p.w} height={10} rx={4} fill="var(--cr-rna)" />
				<rect x={q.x - SPW / 2} y={q.y - 6} width={SPW} height={12} rx={4} fill={p.color} />
				<text
					x={q.x}
					y={q.y + 4.5}
					text-anchor="middle"
					style:font-size="11px"
					style:fill="#fff"
					font-weight="700">{p.label}</text
				>
			</g>
		{/each}
	{/if}

	<Readout
		id="rna"
		order={2}
		label="RNA"
		value={phase === 0
			? 'copying the array'
			: phase === 1
				? 'cut inside every repeat'
				: 'three crRNAs, one spacer each'}
	>
		<Tag
			x={X0 - 24}
			y={Y_RNA + 5}
			text="RNA"
			size={13}
			weight={600}
			anchor="end"
			color="var(--cr-rna)"
			opacity={1 - fly}
		/>
	</Readout>
	<Readout
		id="loaded"
		order={3}
		label="Loaded"
		value="each Cas9 carries one crRNA: it will look for DNA spelling that spacer"
		opacity={smoothstep(0.8, 0.9, prog)}
	/>
	<Readout id="phases">
		{#each LINES as line, i (i)}
			<Tag
				x={250}
				y={500 + i * 24}
				text={line}
				size={13}
				anchor="start"
				weight={i === phase ? 600 : 400}
				muted={i !== phase}
				opacity={i === phase ? 1 : 0.7}
			/>
		{/each}
	</Readout>
</g>
