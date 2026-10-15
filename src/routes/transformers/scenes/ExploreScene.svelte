<script lang="ts">
	/**
	 * The attention explorer. Left: the sentence twice, the token asking on the left and the
	 * tokens it can look at on the right, joined by lines as thick as the weights of the chosen
	 * layer and head; pulses run along them toward the asking token (the values flow that way).
	 * Right: the same token in all 144 heads, each cell a bar chart of its weights (grey bar: the
	 * start token); click a cell to choose that layer and head. Phases:
	 *   explore   sentence, layer, head and token from the controls (point at or tap a token)
	 *   patterns  a named head, preset from `PATTERNS` (pointing still works)
	 *   summary   the last token of the chosen sentence, in its most focused head
	 */
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Label, smoothstep, toSvg } from '#lib/draw/index.ts';
	import { gpt2 } from '../gpt2';
	import { PATTERNS, type PatternId } from '../steps';
	import { fix, label, num, top } from './shared';
	import TokenChip from './TokenChip.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'explore'));
	const preset = $derived(
		PATTERNS[
			(typeof params.pattern === 'string' && params.pattern in PATTERNS
				? params.pattern
				: 'previous') as PatternId
		]
	);

	// Local choices for the patterns and summary steps (reset when the preset changes).
	let local = $state<{ tok: number; layer: number; head: number } | null>(null);
	const presetKey = $derived(
		phase === 'patterns' ? `p:${String(params.pattern)}` : `${phase}:${String(params.sumS)}`
	);
	$effect(() => {
		void presetKey;
		untrack(() => (local = null));
	});

	const s = $derived(
		gpt2.sentence(
			phase === 'patterns'
				? preset.s
				: phase === 'summary'
					? String(params.sumS ?? 'mary')
					: String(params.s ?? 'animal')
		)
	);
	const names = $derived(s.tokens.map((tk) => label(tk)));
	const clampTok = (v: number) => Math.max(1, Math.min(s.n - 1, Math.round(v)));

	// The summary shows the last token in the head where it looks hardest at one earlier token,
	// not counting ⟨start⟩, itself and the token just before it.
	const focused = $derived.by(() => {
		let b = { layer: 0, head: 0, w: -1 };
		for (let l = 0; l < 12; l++)
			for (let h = 0; h < 12; h++) {
				const r = s.row(l, h, s.n - 1);
				const w = Math.max(...r.slice(1, s.n - 2));
				if (w > b.w) b = { layer: l, head: h, w };
			}
		return b;
	});
	const sel = $derived.by(() => {
		if (local) return local;
		if (phase === 'patterns') return { tok: preset.tok, layer: preset.layer, head: preset.head };
		if (phase === 'summary') return { tok: s.n - 1, layer: focused.layer, head: focused.head };
		return {
			tok: clampTok(num(params.tok, 9)),
			layer: Math.max(0, Math.min(11, Math.round(num(params.layer, 5)) - 1)),
			head: Math.max(0, Math.min(11, Math.round(num(params.head, 4)) - 1))
		};
	});
	const tok = $derived(clampTok(sel.tok));
	const row = $derived(s.row(sel.layer, sel.head, tok));
	const best = $derived(top(row, 3));

	function chooseTok(i: number) {
		if (phase === 'explore') setParam('tok', i);
		else local = { ...sel, tok: i };
	}
	function chooseHead(layer: number, head: number) {
		if (phase === 'explore') {
			setParam('layer', layer + 1);
			setParam('head', head + 1);
		} else local = { ...sel, layer, head };
	}

	// ---- left: the two columns
	const COL = { from: 24, to: 300, w: 92, y: 92 };
	const rowH = $derived(Math.min(32, 476 / s.n));
	const cy = (i: number) => COL.y + i * rowH + rowH / 2;
	const X0 = COL.from + COL.w + 4;
	const X1 = COL.to - 4;
	const cubic = (y0: number, y1: number, u: number) => {
		const v = 1 - u;
		const xm = (X0 + X1) / 2;
		return {
			x: v * v * v * X0 + 3 * v * v * u * xm + 3 * v * u * u * xm + u * u * u * X1,
			y: v * v * v * y0 + 3 * v * v * u * y0 + 3 * v * u * u * y1 + u * u * u * y1
		};
	};
	const lines = $derived(
		row.flatMap((w, j) =>
			j <= tok && w >= 0.02
				? [
						{
							j,
							w,
							d: `M${X0} ${cy(tok)} C${(X0 + X1) / 2} ${cy(tok)} ${(X0 + X1) / 2} ${cy(j)} ${X1} ${cy(j)}`
						}
					]
				: []
		)
	);
	// Pulses run from each attended token back to the token asking.
	const pulses = $derived(
		reduced
			? []
			: lines.map((l) => {
					const u = 1 - cycle(t, 1.6, l.j * 0.11);
					const p = cubic(cy(tok), cy(l.j), u);
					return {
						key: l.j,
						...p,
						r: 1.5 + 3 * l.w,
						o: l.w * smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u))
					};
				})
	);

	// ---- right: all 144 heads
	const G = { x: 482, y: 112, c: 38 };
	const grid = $derived.by(() => {
		const cells: { key: number; start: string; rest: string }[] = [];
		const bw = (G.c - 6) / s.n;
		for (let l = 0; l < 12; l++)
			for (let h = 0; h < 12; h++) {
				const r = s.row(l, h, tok);
				const x = G.x + h * G.c + 3;
				const base = G.y + (l + 1) * G.c - 4;
				let rest = '';
				let start = '';
				r.forEach((w, j) => {
					if (j > tok || w < 0.02) return;
					const hh = w * (G.c - 9);
					const seg = `M${(x + j * bw).toFixed(1)} ${(base - hh).toFixed(1)}h${(bw * 0.85).toFixed(2)}v${hh.toFixed(1)}h${(-bw * 0.85).toFixed(2)}Z`;
					if (j === 0) start += seg;
					else rest += seg;
				});
				cells.push({ key: l * 12 + h, start, rest });
			}
		return cells;
	});
	const gridLines = Array.from(
		{ length: 13 },
		(_, k) => `M${G.x} ${G.y + k * G.c}h${12 * G.c}M${G.x + k * G.c} ${G.y}v${12 * G.c}`
	).join('');
	function gridClick(e: MouseEvent) {
		const p = toSvg(e, e.currentTarget as Element);
		const h = Math.floor((p.x - G.x) / G.c);
		const l = Math.floor((p.y - G.y) / G.c);
		if (h >= 0 && h < 12 && l >= 0 && l < 12) chooseHead(l, h);
	}
	const headLabel = $derived(`layer ${sel.layer + 1}, head ${sel.head + 1}`);
	const topText = $derived(
		best
			.filter((b) => b.w >= 0.01)
			.map((b) => `${names[b.j]} ${fix(b.w)}`)
			.join(' · ')
	);
</script>

<g>
	<!-- left: who looks at whom -->
	<Readout
		id="title"
		order={1}
		label="Token asking"
		value="“{names[tok]}” · {headLabel}"
		color="var(--tf-sel)"
	>
		<Label
			anchor="start"
			tabular
			x={COL.from}
			y={30}
			size={15}
			weight={650}
			text="“{names[tok]}” in {headLabel}"
		/>
	</Readout>
	<Readout id="hint">
		<Label
			anchor="start"
			x={COL.from}
			y={52}
			size={12}
			muted
			text="point at a token on the left · line thickness = weight"
		/>
	</Readout>
	<Readout id="top" order={2} label="Attends to" value={topText}><g></g></Readout>
	<Label anchor="start" x={COL.from} y={COL.y - 8} size={11} weight={600} muted text="asking" />
	<Label anchor="start" x={COL.to} y={COL.y - 8} size={11} weight={600} muted text="looked at" />
	{#each lines as l (l.j)}
		<path
			d={l.d}
			fill="none"
			stroke="var(--tf-att)"
			stroke-width={1 + 10 * l.w}
			stroke-linecap="round"
			opacity={0.25 + 0.75 * l.w}
		/>
	{/each}
	{#each pulses as p (p.key)}
		<circle cx={p.x} cy={p.y} r={p.r} fill="var(--tf-att)" opacity={p.o} />
	{/each}
	{#each names as nm, i (i)}
		<TokenChip
			x={COL.from}
			y={cy(i) - (rowH - 6) / 2}
			w={COL.w}
			h={rowH - 6}
			size={rowH < 30 ? 12 : 13}
			text={nm}
			name="{nm}, number {i}"
			selected={i === tok}
			muted={i === 0}
			onselect={i >= 1 ? () => chooseTok(i) : undefined}
			onhover={i >= 1 ? () => chooseTok(i) : undefined}
		/>
		<TokenChip
			x={COL.to}
			y={cy(i) - (rowH - 6) / 2}
			w={COL.w}
			h={rowH - 6}
			size={rowH < 30 ? 12 : 13}
			text={nm}
			muted={i > tok}
			opacity={i > tok ? 0.45 : 1}
		/>
		{#if i <= tok && row[i] >= 0.01}
			<Readout id="w-{i}">
				<Label
					anchor="start"
					tabular
					x={COL.to + COL.w + 8}
					y={cy(i) + 4}
					size={12}
					weight={i === best[0].j ? 650 : 500}
					text={fix(row[i])}
				/>
			</Readout>
		{/if}
	{/each}

	<!-- right: the same token in all 144 heads -->
	<Readout id="gtitle">
		<Label
			anchor="start"
			tabular
			x={G.x}
			y={30}
			size={15}
			weight={650}
			text="“{names[tok]}” in all 144 heads"
		/>
		<Label
			anchor="start"
			x={G.x}
			y={52}
			size={12}
			muted
			text="each cell: its weights, one bar per token · grey: ⟨start⟩"
		/>
	</Readout>
	<Readout id="gaxes">
		{#each Array.from({ length: 12 }, (_, k) => k) as k (k)}
			<Label
				tabular
				x={G.x + (k + 0.5) * G.c}
				y={G.y - 8}
				anchor="middle"
				size={11}
				muted
				text={String(k + 1)}
			/>
			<Label
				tabular
				x={G.x - 8}
				y={G.y + (k + 0.5) * G.c + 4}
				anchor="end"
				size={11}
				muted
				text={String(k + 1)}
			/>
		{/each}
		<Label
			x={G.x + 6 * G.c}
			y={G.y - 26}
			anchor="middle"
			size={11}
			weight={600}
			muted
			text="head"
		/>
		<Label x={G.x - 4} y={G.y - 26} anchor="end" size={11} weight={600} muted text="layer ↓" />
	</Readout>
	<rect x={G.x} y={G.y} width={12 * G.c} height={12 * G.c} fill="var(--surface)" />
	<path d={gridLines} fill="none" stroke="var(--border)" stroke-width="1" />
	{#each grid as c (c.key)}
		<path d={c.start} fill="var(--tf-start)" opacity="0.7" />
		<path d={c.rest} fill="var(--tf-att)" />
	{/each}
	<rect
		x={G.x + sel.head * G.c}
		y={G.y + sel.layer * G.c}
		width={G.c}
		height={G.c}
		fill="none"
		stroke="var(--tf-sel)"
		stroke-width="2.5"
	/>
	<rect
		class="hit"
		x={G.x}
		y={G.y}
		width={12 * G.c}
		height={12 * G.c}
		fill="transparent"
		role="presentation"
		onclick={gridClick}
	/>
</g>

<style>
	.hit {
		cursor: pointer;
	}
</style>
