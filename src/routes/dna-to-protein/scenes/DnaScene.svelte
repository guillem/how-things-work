<script lang="ts">
	/**
	 * A real stretch of the HBB gene as a flat ladder (`step.hints.phase`):
	 *   letters  — the pairs build up from left to right, then a highlight walks along them,
	 *              naming each pair; a key of the four bases.
	 *   triplets — the top strand grouped into codons from the start codon ATG, the same letters
	 *              read from one letter later below, and the count 4 → 16 → 64 against 20.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { complement } from '../genetics';
	import { HBB_GENE } from '../genes-data';
	import { baseColor } from './shared';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'letters'));
	const tv = $derived(reduced ? 1e6 : t);

	// Six letters before the start codon, then the first eight codons (letters 45–74).
	const FROM = 44;
	const N = 30;
	const START = 6; // index of the A of ATG in the window
	const top = [...HBB_GENE.slice(FROM, FROM + N)];
	const DX = 28;
	const X0 = 480 - ((N - 1) * DX) / 2;
	const xs = top.map((_, i) => X0 + i * DX);

	const focus = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'triplets' ? 1 : 0;
		untrack(() => focus.set(v, { duration: reduced ? 0 : 800 }));
	});
	const f = $derived(focus.current);

	// ladder geometry (moves up a little for the triplets)
	const yTop = $derived(190 - 40 * f);
	const yBot = $derived(yTop + 96);

	const built = $derived(phase === 'letters' ? clamp(tv / 0.07, 0, N) : N);
	const walk = $derived(
		phase === 'letters' && !reduced && tv > 2.6 ? Math.floor((tv - 2.6) / 0.6) % N : -1
	);
	const NAMES: Record<string, string> = {
		A: 'adenine',
		T: 'thymine',
		C: 'cytosine',
		G: 'guanine'
	};
	const codons = Array.from({ length: (N - START) / 3 }, (_, k) => START + k * 3);
	const shifted = Array.from({ length: 8 }, (_, k) => START + 1 + k * 3).filter((i) => i + 3 <= N);
	const counts = [
		{ n: 1, words: 4, ok: false },
		{ n: 2, words: 16, ok: false },
		{ n: 3, words: 64, ok: true }
	];
	const reveal = (k: number) => smoothstep(0.8 + k * 1.1, 1.4 + k * 1.1, tv);
</script>

<g>
	<!-- strand ends and direction -->
	<Readout id="title">
		<Label
			anchor="start"
			x={32}
			y={40}
			text="Human β-globin gene (HBB), letters 45–74: where its instructions begin"
			size={14}
			weight={700}
		/>
	</Readout>
	<line
		x1={X0 - 18}
		x2={X0 + (N - 1) * DX + 18}
		y1={yTop - 22}
		y2={yTop - 22}
		stroke="var(--dp-backbone)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	<line
		x1={X0 - 18}
		x2={X0 + (N - 1) * DX + 18}
		y1={yBot + 22}
		y2={yBot + 22}
		stroke="var(--dp-backbone)"
		stroke-width="3"
		stroke-linecap="round"
		opacity={1 - 0.6 * f}
	/>
	<Label x={X0 - 26} y={yTop - 17} text="5′" size={14} weight={700} anchor="end" />
	<Label anchor="start" x={X0 + (N - 1) * DX + 26} y={yTop - 17} text="3′" size={14} weight={700} />
	<g opacity={1 - 0.6 * f}>
		<Label x={X0 - 26} y={yBot + 27} text="3′" size={14} weight={700} anchor="end" />
		<Label
			anchor="start"
			x={X0 + (N - 1) * DX + 26}
			y={yBot + 27}
			text="5′"
			size={14}
			weight={700}
		/>
	</g>

	{#each top as b, i (i)}
		{@const o = clamp(built - i)}
		{@const p = complement(b)}
		{@const on = walk === i}
		<g opacity={o}>
			<!-- the rung: two half-bars meeting in the middle -->
			<rect
				x={xs[i] - 5}
				y={yTop - 22}
				width="10"
				height={(yBot - yTop + 44) / 2}
				rx="3"
				fill={baseColor(b)}
				opacity={on ? 1 : 0.75}
			/>
			<rect
				x={xs[i] - 5}
				y={(yTop + yBot) / 2}
				width="10"
				height={(yBot - yTop + 44) / 2}
				rx="3"
				fill={baseColor(p)}
				opacity={(on ? 1 : 0.75) * (1 - 0.6 * f)}
			/>
			<circle
				cx={xs[i]}
				cy={yTop}
				r={on ? 13 : 11}
				fill="var(--surface)"
				stroke={baseColor(b)}
				stroke-width="2"
			/>
			<text
				x={xs[i]}
				y={yTop + 5}
				text-anchor="middle"
				style:font-size="14px"
				style:font-weight="700"
				style:font-family="var(--font-mono)">{b}</text
			>
			<g opacity={1 - 0.6 * f}>
				<circle
					cx={xs[i]}
					cy={yBot}
					r={on ? 13 : 11}
					fill="var(--surface)"
					stroke={baseColor(p)}
					stroke-width="2"
				/>
				<text
					x={xs[i]}
					y={yBot + 5}
					text-anchor="middle"
					style:font-size="14px"
					style:font-weight="700"
					style:font-family="var(--font-mono)">{p}</text
				>
			</g>
		</g>
	{/each}

	{#if phase === 'letters'}
		{#if walk >= 0}
			{@const b = top[walk]}
			<Readout
				id="pair"
				order={1}
				label="This pair"
				value="{b}–{complement(b)}"
				note="{NAMES[b]} pairs with {NAMES[complement(b)]}"
			>
				<Label
					tabular
					x={480}
					y={yBot + 76}
					text="{b} ({NAMES[b]}) pairs with {complement(b)} ({NAMES[complement(b)]})"
					size={15}
					weight={600}
					anchor="middle"
				/>
			</Readout>
		{/if}
		<!-- key -->
		{#each [['A', 'T'], ['C', 'G']] as [l, r], k (l)}
			<g transform="translate({300 + k * 210} 430)">
				<rect width="160" height="64" rx="10" fill="var(--surface)" stroke="var(--border)" />
				<circle
					cx="30"
					cy="32"
					r="13"
					fill="var(--surface)"
					stroke={baseColor(l)}
					stroke-width="2.5"
				/>
				<text x="30" y="37" text-anchor="middle" style:font-size="15px" style:font-weight="700"
					>{l}</text
				>
				<line x1="44" x2="116" y1="32" y2="32" stroke="var(--stage-line)" stroke-dasharray="3 4" />
				<circle
					cx="130"
					cy="32"
					r="13"
					fill="var(--surface)"
					stroke={baseColor(r)}
					stroke-width="2.5"
				/>
				<text x="130" y="37" text-anchor="middle" style:font-size="15px" style:font-weight="700"
					>{r}</text
				>
			</g>
		{/each}
		<Readout
			id="rule"
			order={2}
			label="Pairing rule"
			value="A–T, C–G"
			note="each strand fixes the other"
		>
			<Label
				x={480}
				y={548}
				text="A always pairs with T, and C with G: each strand fixes the other"
				size={14}
				anchor="middle"
				muted
			/>
		</Readout>
	{:else}
		<!-- codons from the start codon -->
		{#each codons as c, k (c)}
			{@const o = smoothstep(0.2 + k * 0.15, 0.5 + k * 0.15, tv)}
			<g opacity={o}>
				<path
					d="M{xs[c] - 11} {yTop - 34} v-8 h{2 * DX + 22} v8"
					fill="none"
					stroke={k === 0 ? 'var(--dp-rna)' : 'var(--stage-ink)'}
					stroke-width="2"
				/>
				<Label
					tabular
					x={xs[c + 1]}
					y={yTop - 50}
					text={k === 0 ? 'start' : `codon ${k + 1}`}
					size={11}
					anchor="middle"
					muted={k !== 0}
					color={k === 0 ? 'var(--dp-rna)' : undefined}
				/>
			</g>
		{/each}
		<Label x={xs[1]} y={yTop - 50} text="before the start" size={11} anchor="middle" muted />
		<!-- the same letters, one letter later -->
		<g opacity={smoothstep(1.6, 2.2, tv)}>
			<Readout id="shift-title">
				<Label
					anchor="start"
					x={X0 - 18}
					y={yBot + 58}
					text="The same letters read from one letter later spell other words:"
					size={12}
					muted
				/>
			</Readout>
			{#each shifted as c (c)}
				<g>
					<path
						d="M{xs[c] - 11} {yBot + 68} v8 h{2 * DX + 22} v-8"
						fill="none"
						stroke="var(--stage-ink-muted)"
						stroke-width="1.5"
						stroke-dasharray="4 3"
					/>
					<text
						x={xs[c + 1]}
						y={yBot + 96}
						text-anchor="middle"
						class="muted"
						style:font-size="13px"
						style:font-family="var(--font-mono)">{top.slice(c, c + 3).join('')}</text
					>
				</g>
			{/each}
		</g>

		<!-- 4, 16, 64 -->
		{#each counts as c, k (c.n)}
			{@const o = reveal(k)}
			{@const gx = 110 + k * 250}
			<g opacity={o}>
				<Label
					anchor="start"
					tabular
					x={gx}
					y={398}
					text="{c.n} letter{c.n > 1 ? 's' : ''}: {c.words} words"
					size={15}
					weight={700}
					color={c.ok ? 'var(--dp-rna)' : undefined}
				/>
				{#if c.n === 1}
					{#each ['A', 'C', 'G', 'T'] as b, i (b)}
						<rect x={gx + i * 24} y={414} width="20" height="20" rx="4" fill={baseColor(b)} />
					{/each}
				{:else if c.n === 2}
					{#each Array.from({ length: 16 }, (_, i) => i) as i (i)}
						<rect
							x={gx + (i % 4) * 24}
							y={414 + Math.floor(i / 4) * 24}
							width="20"
							height="20"
							rx="4"
							fill={baseColor('ACGT'[Math.floor(i / 4)])}
							opacity="0.8"
						/>
					{/each}
				{:else}
					{#each Array.from({ length: 64 }, (_, i) => i) as i (i)}
						<rect
							x={gx + (i % 16) * 13 + Math.floor((i % 16) / 4) * 4}
							y={414 + Math.floor(i / 16) * 24}
							width="11"
							height="20"
							rx="2"
							fill={baseColor('ACGT'[Math.floor(i / 16)])}
							opacity="0.8"
						/>
					{/each}
				{/if}
				<Label
					anchor="start"
					tabular
					x={gx}
					y={530}
					text={c.ok ? '≥ 20 amino acids ✓' : '< 20 amino acids'}
					size={13}
					weight={600}
					color={c.ok ? 'var(--dp-rna)' : 'var(--stage-ink-muted)'}
				/>
			</g>
		{/each}
		<Readout
			id="need"
			order={1}
			label="Words needed"
			value="20 amino acids"
			note="1 letter: 4 · 2 letters: 16 · 3 letters: 64"
		>
			<Label
				x={480}
				y={572}
				text="Proteins use 20 amino acids, so the code needs words of three letters: codons"
				size={14}
				anchor="middle"
				weight={600}
			/>
		</Readout>
	{/if}
</g>
