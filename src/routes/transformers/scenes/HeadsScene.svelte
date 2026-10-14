<script lang="ts">
	/**
	 * Multi-head attention: the 12 attention patterns of one layer of GPT-2 small on the chosen
	 * sentence, side by side. Under each, what the head mostly does, measured from its weights
	 * (previous token, the start token, itself, or a mix). A highlighted row sweeps down all 12 at
	 * once: every head works on every token at the same time.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bands, fix, label, num, sentenceOf } from './shared';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const s = $derived(sentenceOf(params));
	const L = $derived(Math.max(0, Math.min(11, Math.round(num(params.layer, 5)) - 1)));

	const PANEL = { x: 16, y: 92, w: 928 / 6, h: 250, m: 136 };
	const cell = $derived(PANEL.m / s.n);

	/** What a head mostly does on this sentence, from its weights (rows 2..n−1). */
	function describe(m: number[][]) {
		let start = 0;
		let prev = 0;
		let self = 0;
		let c = 0;
		for (let i = 2; i < m.length; i++) {
			start += m[i][0];
			prev += m[i][i - 1];
			self += m[i][i];
			c++;
		}
		start /= c;
		prev /= c;
		self /= c;
		if (prev >= 0.5) return { kind: 'previous token', share: prev, color: 'var(--tf-q)' };
		if (start >= 0.6) return { kind: 'rests on ⟨start⟩', share: start, color: 'var(--tf-start)' };
		// one earlier token that most later rows look at
		let bestJ = 0;
		let bestW = 0;
		for (let j = 1; j < m.length - 1; j++) {
			let w = 0;
			for (let i = j + 1; i < m.length; i++) w += m[i][j];
			w /= m.length - 1 - j;
			if (m.length - 1 - j >= 3 && w > bestW) {
				bestW = w;
				bestJ = j;
			}
		}
		if (bestW >= 0.4)
			return { kind: `looks at “${label(s.tokens[bestJ])}”`, share: bestW, color: 'var(--tf-v)' };
		if (self >= 0.4) return { kind: 'itself', share: self, color: 'var(--tf-k)' };
		return { kind: 'spread out', share: 1 - start, color: 'var(--tf-att)' };
	}

	const heads = $derived(
		Array.from({ length: 12 }, (_, h) => {
			const m = s.matrix(L, h);
			const col = h % 6;
			const row = Math.floor(h / 6);
			const x = PANEL.x + col * PANEL.w + (PANEL.w - PANEL.m) / 2;
			const y = PANEL.y + row * PANEL.h + 22;
			let mask = '';
			for (let i = 0; i < s.n - 1; i++)
				mask += `M${(x + (i + 1) * cell).toFixed(1)} ${(y + i * cell).toFixed(1)}h${((s.n - i - 1) * cell).toFixed(1)}v${cell.toFixed(1)}h${(-(s.n - i - 1) * cell).toFixed(1)}Z`;
			return {
				h,
				x,
				y,
				mask,
				cells: bands(s.n, s.n, (i, j) => (j <= i ? m[i][j] : null), x, y, cell, cell, 8, 0.4),
				d: describe(m)
			};
		})
	);
	const counts = $derived.by(() => {
		const c: Record<string, number> = {};
		for (const h of heads) c[h.d.kind] = (c[h.d.kind] ?? 0) + 1;
		return Object.entries(c)
			.map(([k, v]) => `${v} ${k}`)
			.join(' · ');
	});

	/**
	 * This layer on this sentence, over its 12 heads: the share of attention on ⟨start⟩ (rows
	 * 1..n−1), and how far back the rest lands on average (rows 2..n−1, ⟨start⟩ left out).
	 */
	const layerStats = $derived.by(() => {
		let start = 0;
		let rows = 0;
		let d = 0;
		let w = 0;
		for (let h = 0; h < 12; h++)
			for (let i = 1; i < s.n; i++) {
				const r = s.row(L, h, i);
				start += r[0];
				rows++;
				if (i >= 2)
					for (let j = 1; j <= i; j++) {
						d += r[j] * (i - j);
						w += r[j];
					}
			}
		return { start: start / rows, reach: d / w };
	});

	// A row sweeping down every pattern at once (row 3 under reduced motion).
	const sweep = $derived(reduced ? 3 : Math.floor(t / 0.9) % s.n);
</script>

<g>
	<Readout id="title" order={1} label="Layer {L + 1}" value={counts}>
		<Txt x={16} y={30} size={15} weight={650} text="Layer {L + 1}: its 12 heads on “{s.text}”" />
		<Txt
			x={16}
			y={52}
			size={12}
			muted
			text="each square: one head's weights · row = token asking, top to bottom · column = token looked at · left column = ⟨start⟩"
		/>
	</Readout>
	<Readout
		id="layerstats"
		order={2}
		label="This layer"
		value="{Math.round(layerStats.start * 100)}% of attention on ⟨start⟩; the rest lands {fix(
			layerStats.reach,
			1
		)} tokens back on average"
	>
		<Txt
			x={16}
			y={74}
			size={12}
			weight={600}
			text="this layer: {Math.round(
				layerStats.start * 100
			)}% of all attention on ⟨start⟩ · the rest lands on average {fix(
				layerStats.reach,
				1
			)} tokens back"
		/>
	</Readout>
	{#each heads as hd (hd.h)}
		<Txt x={hd.x} y={hd.y - 8} size={12} weight={650} text="head {hd.h + 1}" />
		<rect
			x={hd.x}
			y={hd.y}
			width={PANEL.m}
			height={PANEL.m}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<path d={hd.mask} fill="var(--tf-mask)" />
		{#each hd.cells as b (b.key)}
			<path d={b.d} fill="var(--tf-att)" opacity={0.15 + 0.85 * b.level} />
		{/each}
		<rect
			x={hd.x - 1}
			y={hd.y + sweep * cell}
			width={(sweep + 1) * cell + 2}
			height={cell}
			fill="none"
			stroke="var(--tf-sel)"
			stroke-width="1.6"
		/>
		<Readout id="d-{hd.h}">
			<Txt
				x={hd.x}
				y={hd.y + PANEL.m + 20}
				size={12}
				weight={600}
				color={hd.d.color}
				text={hd.d.kind}
			/>
			<Txt
				x={hd.x}
				y={hd.y + PANEL.m + 37}
				size={11}
				muted
				text="{Math.round(hd.d.share * 100)}% {hd.d.kind === 'spread out'
					? 'away from ⟨start⟩'
					: hd.d.kind.startsWith('looks')
						? 'from the later tokens'
						: 'of its weight'}"
			/>
		</Readout>
	{/each}
	<Readout id="sweep">
		<Txt
			x={16}
			y={584}
			size={12}
			muted
			text="outlined row: “{label(s.tokens[sweep])}”, in all 12 heads at once"
		/>
	</Readout>
</g>
