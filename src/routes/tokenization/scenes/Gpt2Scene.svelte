<script lang="ts">
	/**
	 * GPT-2's real tokenizer on the reader's text (`language-models/bpe.ts`, GPT-2's 50,000 merges).
	 * Phase "split": the pattern's pieces, coloured by the alternative that matched, and the
	 * tokens of each piece. Phase "ranks": the cut by merges in rank order against the
	 * longest-match cut, and the ladder of merges of one piece, replayed. Phase "common": every
	 * token coloured by its merge's rank.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';
	import type { Piece } from '../../language-models/bpe';
	import type { Gpt2 } from '../gpt2';
	import { DEFAULT_MESSAGE, MAX_MESSAGE, messageOf, SAMPLE } from '../steps';
	import TextBox from './TextBox.svelte';
	import { chipWidth, clip, FILLS, fit, flow, fmt, show, tokenizer } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const PRESETS = [
		{ label: 'strawberry', value: DEFAULT_MESSAGE },
		{ label: 'Hamlet', value: SAMPLE },
		{ label: 'long words', value: 'Tokenization of antidisestablishmentarianism' },
		{ label: 'numbers', value: 'In 2026, π ≈ 3.14159 and 1,000,000 ÷ 7' },
		{ label: 'code', value: 'def add(a, b):\n    return a + b' }
	];

	interface SplitItem {
		pi: number;
		text: string;
		kind: (typeof KINDS)[number];
		x: number;
		y: number;
		w: number;
		toks: { j: number; text: string; w: number; x: number; y: number }[];
	}
	interface Chip {
		key: string;
		text: string;
		w: number;
		gap: boolean;
		same: boolean;
		x: number;
		y: number;
		row: number;
	}

	const phase = $derived(String(step.hints?.phase ?? 'split'));
	const msg = $derived(messageOf(params));

	let g = $state<Gpt2 | null>(null);
	let failed = $state(false);
	$effect(() => {
		tokenizer().then(
			(x) => (g = x),
			() => (failed = true)
		);
	});
	const pieces = $derived<Piece[]>(g ? g.bpe.pieces(msg) : []);
	const tok = (id: number) => (g ? show(g.bpe.text(id)) : '');
	const ids = $derived(pieces.flatMap((p) => p.ids));
	const chars = $derived([...msg].length);

	const X0 = 24;
	const W = 912;
	const TOP = 150;

	// ---- split: the pattern's alternatives
	const KINDS = [
		{ id: 'letters', label: '␣? letters', re: /^ ?\p{L}+$/u },
		{ id: 'digits', label: '␣? digits', re: /^ ?\p{N}+$/u },
		{ id: 'other', label: '␣? other symbols', re: /^ ?[^\p{White_Space}\p{L}\p{N}]+$/u },
		{ id: 'space', label: 'spaces, line breaks', re: /^\p{White_Space}+$/u },
		{ id: 'ending', label: "'s 't 're 've 'm 'll 'd", re: /^'(s|t|re|ve|m|ll|d)$/ }
	] as const;
	const kindOf = (text: string) =>
		KINDS.find((k) => k.id === 'ending' && k.re.test(text)) ??
		KINDS.find((k) => k.re.test(text)) ??
		KINDS[2];
	/**
	 * One chip per piece, and under it the piece's tokens, wrapped inside the piece's width when a
	 * piece is wider than the stage. Pieces flow left to right; each row is as tall as its tallest.
	 */
	const SPLIT_SIZES = [
		{ f: 20, tf: 16, ph: 36, th: 28 },
		{ f: 15, tf: 13, ph: 28, th: 22 },
		{ f: 12, tf: 11, ph: 22, th: 18 },
		{ f: 10, tf: 9, ph: 18, th: 15 }
	];
	const SPLIT_BOTTOM = 500;
	const splitLayout = $derived.by(() => {
		let out = { z: SPLIT_SIZES[0], items: [] as SplitItem[], bottom: TOP };
		for (const z of SPLIT_SIZES) {
			const items: SplitItem[] = [];
			let x = X0;
			let y = TOP;
			let rowH = 0;
			for (const [pi, p] of pieces.entries()) {
				const text = fit(show(p.text), z.f, W - 14);
				const chips = p.ids.map((id, j) => ({
					j,
					text: tok(id),
					w: chipWidth(tok(id), z.tf, z.tf + 4)
				}));
				const natural = chips.reduce((a, c) => a + c.w + 2, -2);
				const w = Math.min(W, Math.max(chipWidth(text, z.f, z.f + 6), natural));
				const lay = flow(chips, 0, w, 2, z.th + 3);
				const rows = lay.length ? lay[lay.length - 1].row + 1 : 1;
				// centre a single row of tokens under the piece
				const shift = rows === 1 ? (w - natural) / 2 : 0;
				const h = z.ph + 6 + rows * (z.th + 3);
				if (x + w > X0 + W && x > X0) {
					x = X0;
					y += rowH + 12;
					rowH = 0;
				}
				items.push({
					pi,
					text,
					kind: kindOf(p.text),
					x,
					y,
					w,
					toks: lay.map((c) => ({ ...c, x: c.x + shift }))
				});
				rowH = Math.max(rowH, h);
				x += w + 8;
			}
			out = { z, items, bottom: y + rowH };
			if (out.bottom <= SPLIT_BOTTOM) break;
		}
		return out;
	});
	const sz = $derived(splitLayout.z);
	/** Pieces that fit above the legend (all of them, unless the text is very long). */
	const splitShown = $derived(
		splitLayout.items.filter(
			(c) =>
				c.y + sz.ph + 6 + (c.toks.length ? c.toks[c.toks.length - 1].y + sz.th : 0) <=
				SPLIT_BOTTOM + 10
		)
	);

	// ---- ranks: rank order against longest match
	const compare = $derived(
		g
			? pieces.map((p, pi) => {
					const lm = g!.longestPiece(p.text);
					return { pi, bpe: p.ids, lm, same: lm.join() === p.ids.join() };
				})
			: []
	);
	const lmCount = $derived(compare.reduce((s, c) => s + c.lm.length, 0));
	const differ = $derived(compare.filter((c) => !c.same).length);
	const RANK_SIZES = [
		{ f: 15, h: 28, lh: 36 },
		{ f: 12, h: 22, lh: 28 },
		{ f: 10, h: 18, lh: 22 }
	];
	const rowChips = (key: 'bpe' | 'lm', z: { f: number; lh: number }) => {
		const items = compare.flatMap((c) =>
			c[key].map((id, j) => ({
				key: `${c.pi}-${j}`,
				text: tok(id),
				w: chipWidth(tok(id), z.f, z.f + 3) + (j === 0 && c.pi > 0 ? 8 : 0),
				gap: j === 0 && c.pi > 0,
				same: c.same
			}))
		);
		return flow(items, X0 + 150, W - 150, 2, z.lh).map((c) => ({
			...c,
			x: c.x + (c.gap && c.x > X0 + 150 ? 8 : 0),
			w: c.w - (c.gap ? 8 : 0)
		}));
	};
	const rowsOf = (r: { row: number }[]) => (r.length ? r[r.length - 1].row + 1 : 1);
	const ranksLayout = $derived.by(() => {
		let pick = { z: RANK_SIZES[0], bpe: [] as Chip[], lm: [] as Chip[] };
		for (const z of RANK_SIZES) {
			pick = { z, bpe: rowChips('bpe', z), lm: rowChips('lm', z) };
			if ((rowsOf(pick.bpe) + rowsOf(pick.lm)) * z.lh <= 220) break;
		}
		return pick;
	});
	const rz = $derived(ranksLayout.z);
	/** At most four lines per rule (a very long text is cut, with a count of what is left out). */
	const MAX_LINES = 4;
	const bpeRow = $derived(ranksLayout.bpe.filter((c) => c.row < MAX_LINES));
	const lmRow = $derived(ranksLayout.lm.filter((c) => c.row < MAX_LINES));
	const bpeCut = $derived(ranksLayout.bpe.length - bpeRow.length);
	const lmCut = $derived(ranksLayout.lm.length - lmRow.length);
	const lmY = $derived(TOP + 22 + rowsOf(bpeRow) * rz.lh);

	/** The ladder: the first piece the two rules cut differently, else the one with most merges. */
	const featured = $derived.by(() => {
		if (!pieces.length) return null;
		const d = compare.find((c) => !c.same);
		if (d) return pieces[d.pi];
		return pieces.reduce((a, p) => (p.merges.length > a.merges.length ? p : a), pieces[0]);
	});
	const LY = $derived(lmY + rowsOf(lmRow) * rz.lh + 58);
	const RH = 30;
	/**
	 * The states of the featured piece, each wrapped to the width (a long piece takes several
	 * lines): the first two, then as many of the last ones as fit, with "…" between.
	 */
	const ladder = $derived.by(() => {
		const p = featured;
		if (!p) return [];
		const all = [
			{ rank: -1, toks: p.bytes },
			...p.merges.map((m) => ({ rank: m.rank, toks: m.tokens }))
		].map((r) => {
			const lay = flow(
				r.toks.map((id, j) => ({ j, text: tok(id), w: chipWidth(tok(id), 15, 18) })),
				X0 + 150,
				W - 150,
				2,
				RH
			);
			return { ...r, lay, h: rowsOf(lay) * RH };
		});
		const room = 590 - LY;
		const total = (rows: { h: number }[]) => rows.reduce((a, r) => a + r.h, 0);
		let rows: ({ rank: number; lay: (typeof all)[number]['lay']; h: number } | null)[] = all;
		if (total(all) > room) {
			const head = all.slice(0, 2);
			const tail: typeof all = [];
			for (let i = all.length - 1; i >= 2; i--) {
				if (total(head) + RH + total(tail) + all[i].h > room) break;
				tail.unshift(all[i]);
			}
			rows = [...head, null, ...tail];
		}
		let y = LY;
		return rows
			.map((r) => {
				const at = y;
				y += r ? r.h : RH;
				return { r, y: at };
			})
			.filter((row) => row.y + (row.r ? row.r.h : RH) <= 596);
	});
	const TICK = 0.9;
	const shown = $derived.by(() => {
		const n = ladder.length;
		if (reduced) return n;
		const period = (n + 4) * TICK;
		return Math.min(n, 1 + Math.floor((t % period) / TICK));
	});

	// ---- common: colour by rank
	const BUCKETS = [
		{ id: 'r0', label: 'a single byte', test: (id: number) => id < 256 },
		{ id: 'r1', label: 'merges 1–1,000', test: (id: number) => id >= 256 && id < 1256 },
		{ id: 'r2', label: '1,001–10,000', test: (id: number) => id >= 1256 && id < 10256 },
		{ id: 'r3', label: '10,001–50,000', test: (id: number) => id >= 10256 }
	] as const;
	const bucketOf = (id: number) => BUCKETS.find((b) => b.test(id)) ?? BUCKETS[3];
	const commonLayout = $derived.by(() => {
		for (const s of [
			{ f: 24, h: 44, lh: 80 },
			{ f: 18, h: 34, lh: 66 },
			{ f: 15, h: 28, lh: 54 },
			{ f: 12, h: 22, lh: 44 },
			{ f: 10, h: 18, lh: 36 }
		]) {
			const lay = flow(
				ids.map((id, i) => {
					const text = tok(id);
					const rank = id >= 256 ? `no. ${fmt(id - 255)}` : 'byte';
					return {
						i,
						id,
						text,
						rank,
						w: Math.max(chipWidth(text, s.f, s.f + 6), rank.length * 6.6 + 8)
					};
				}),
				X0,
				W,
				6,
				s.lh
			);
			const rows = lay.length ? lay[lay.length - 1].row + 1 : 1;
			if (TOP + 10 + rows * s.lh <= 520 || s.f === 10)
				return { s, lay: lay.filter((c) => TOP + c.y + s.lh <= 530), cut: lay.length };
		}
		return { s: { f: 10, h: 18, lh: 36 }, lay: [], cut: 0 };
	});
</script>

<g>
	<TextBox
		id="msg"
		x={24}
		y={16}
		w={912}
		h={58}
		value={msg}
		max={MAX_MESSAGE}
		name="Text for GPT-2’s tokenizer"
		presets={PRESETS}
		{setParam}
	/>

	{#if !g}
		<Label
			x={480}
			y={320}
			anchor="middle"
			muted
			text={failed ? 'GPT-2’s tokenizer could not be loaded.' : 'Loading GPT-2’s tokenizer…'}
		/>
	{:else if phase === 'split'}
		<Readout
			id="split-count"
			order={1}
			label="Pre-split"
			value="{pieces.length} pieces → {ids.length} tokens"
		>
			<Label
				anchor="start"
				x={X0}
				y={TOP - 14}
				size={14}
				weight={650}
				tabular
				text="{chars} characters → {pieces.length} piece{pieces.length === 1
					? ''
					: 's'} → {ids.length} tokens"
			/>
		</Readout>
		{#each splitShown as c (c.pi)}
			<rect
				x={c.x}
				y={c.y}
				width={c.w}
				height={sz.ph}
				rx="6"
				fill="color-mix(in oklab, var(--tk-{c.kind.id}) 18%, var(--surface))"
				stroke="var(--tk-{c.kind.id})"
				stroke-width="1.5"
			/>
			<text
				x={c.x + c.w / 2}
				y={c.y + sz.ph * 0.68}
				text-anchor="middle"
				font-size={sz.f}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
			{#each c.toks as tk (tk.j)}
				{@const ty = c.y + sz.ph + 6 + tk.y}
				<rect
					x={c.x + tk.x}
					y={ty}
					width={tk.w}
					height={sz.th}
					rx="4"
					fill={FILLS[(c.pi + tk.j) % 5]}
					stroke="var(--border)"
				/>
				<text
					x={c.x + tk.x + tk.w / 2}
					y={ty + sz.th * 0.7}
					text-anchor="middle"
					font-size={sz.tf}
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{tk.text}</text
				>
			{/each}
		{/each}
		{#if splitShown.length < splitLayout.items.length}
			<Label
				anchor="start"
				x={X0}
				y={SPLIT_BOTTOM + 4}
				size={12}
				muted
				text="… and {splitLayout.items.length - splitShown.length} more pieces"
			/>
		{/if}
		<!-- the legend and the pattern -->
		{#each KINDS as k, i (k.id)}
			{@const lx = X0 + i * 182}
			<Readout id="kind-{k.id}" label={k.label} color="var(--tk-{k.id})">
				<rect
					x={lx}
					y={524}
					width="14"
					height="14"
					rx="3"
					fill="color-mix(in oklab, var(--tk-{k.id}) 18%, var(--surface))"
					stroke="var(--tk-{k.id})"
					stroke-width="1.5"
				/>
				<Label anchor="start" x={lx + 20} y={536} size={12} text={k.label} />
			</Readout>
		{/each}
		<Readout id="pattern">
			<Label
				anchor="start"
				x={X0}
				y={570}
				size={11.5}
				mono
				muted
				text={"GPT-2's pattern:  's|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+"}
			/>
		</Readout>
	{:else if phase === 'ranks'}
		<Readout
			id="bpe-count"
			order={1}
			label="Merges in rank order (GPT-2)"
			value="{ids.length} tokens"
		>
			<Label anchor="start" x={X0} y={TOP + 17} size={13} weight={650} text="GPT-2: rank order" />
			<Label
				anchor="start"
				x={X0}
				y={TOP + 34}
				size={11}
				muted
				tabular
				text="{ids.length} tokens"
			/>
		</Readout>
		{#each bpeRow as c (c.key)}
			<rect
				x={c.x}
				y={TOP + c.y}
				width={c.w}
				height={rz.h}
				rx="4"
				fill={c.same ? 'var(--surface)' : 'color-mix(in oklab, var(--tk-next) 22%, var(--surface))'}
				stroke={c.same ? 'var(--border)' : 'var(--tk-next)'}
				stroke-width={c.same ? 1 : 1.8}
			/>
			<text
				x={c.x + c.w / 2}
				y={TOP + c.y + rz.h * 0.7}
				text-anchor="middle"
				font-size={rz.f}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
		{/each}
		{#if bpeCut}
			<Label
				x={X0}
				y={TOP + 52}
				anchor="start"
				size={11}
				muted
				tabular
				text="({bpeCut} more not shown)"
			/>
		{/if}
		<Readout
			id="lm-count"
			order={2}
			label="Longest token first (not GPT-2)"
			value="{lmCount} tokens · {differ} piece{differ === 1 ? '' : 's'} cut differently"
		>
			<Label anchor="start" x={X0} y={lmY + 17} size={13} weight={650} muted text="longest first" />
			<Label
				anchor="start"
				x={X0}
				y={lmY + 34}
				size={11}
				muted
				tabular
				text="{lmCount} tokens · not GPT-2"
			/>
		</Readout>
		{#each lmRow as c (c.key)}
			<rect
				x={c.x}
				y={lmY + c.y}
				width={c.w}
				height={rz.h}
				rx="4"
				fill={c.same ? 'var(--surface)' : 'color-mix(in oklab, var(--tk-hot) 18%, var(--surface))'}
				stroke={c.same ? 'var(--border)' : 'var(--tk-hot)'}
				stroke-width={c.same ? 1 : 1.8}
				stroke-dasharray={c.same ? undefined : '4 2'}
			/>
			<text
				x={c.x + c.w / 2}
				y={lmY + c.y + rz.h * 0.7}
				text-anchor="middle"
				font-size={rz.f}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink-muted)">{c.text}</text
			>
		{/each}
		{#if lmCut}
			<Label
				x={X0}
				y={lmY + 52}
				anchor="start"
				size={11}
				muted
				tabular
				text="({lmCut} more not shown)"
			/>
		{/if}
		{#if featured}
			<Readout
				id="ladder-title"
				order={3}
				label="Ladder"
				value={differ
					? `${differ} piece${differ === 1 ? '' : 's'} cut differently; replaying “${clip(show(featured.text), 32)}”`
					: `the two rules agree here; replaying “${clip(show(featured.text), 32)}”`}
			>
				<Label
					anchor="start"
					x={X0}
					y={LY - 16}
					size={13}
					weight={650}
					text="The merges of “{clip(show(featured.text), 32)}”, lowest rank first{differ
						? ''
						: ' (here the two rules agree)'}"
				/>
			</Readout>
			{#each ladder as { r, y }, ri (ri)}
				{#if r}
					{@const on = ri < shown}
					{@const now = ri === shown - 1}
					<g opacity={on ? 1 : 0.15}>
						<Label
							x={X0 + 136}
							y={y + 17}
							anchor="end"
							size={11.5}
							tabular
							muted={!now}
							weight={now ? 650 : 500}
							text={r.rank < 0 ? 'bytes' : `merge no. ${fmt(r.rank + 1)}`}
						/>
						{#each r.lay as c (c.j)}
							<rect
								x={c.x}
								y={y + c.y}
								width={c.w}
								height="25"
								rx="4"
								fill={now
									? 'color-mix(in oklab, var(--tk-next) 22%, var(--surface))'
									: 'var(--surface)'}
								stroke={now ? 'var(--tk-next)' : 'var(--border)'}
							/>
							<text
								x={c.x + c.w / 2}
								y={y + c.y + 17.5}
								text-anchor="middle"
								font-size="15"
								style:font-family="var(--font-mono)"
								style:fill="var(--stage-ink)">{c.text}</text
							>
						{/each}
					</g>
				{:else}
					<Label x={X0 + 136} y={y + 17} anchor="end" size={12} muted text="…" />
				{/if}
			{/each}
		{/if}
	{:else}
		{@const s = commonLayout.s}
		<Readout
			id="common-count"
			order={1}
			label="GPT-2 tokens"
			value="{chars} characters → {ids.length} tokens"
		>
			<Label
				anchor="start"
				x={X0}
				y={TOP - 14}
				size={14}
				weight={650}
				tabular
				text="{chars} characters → {ids.length} tokens · under each, the merge that made it"
			/>
		</Readout>
		{#if commonLayout.lay.length < commonLayout.cut}
			<Label
				anchor="start"
				x={X0}
				y={530}
				size={11}
				muted
				tabular
				text="({commonLayout.cut - commonLayout.lay.length} more tokens not shown)"
			/>
		{/if}
		{#each commonLayout.lay as c (c.i)}
			{@const b = bucketOf(c.id)}
			<rect
				x={c.x}
				y={TOP + c.y}
				width={c.w}
				height={s.h}
				rx="6"
				fill="color-mix(in oklab, var(--tk-{b.id}) 26%, var(--surface))"
				stroke="var(--tk-{b.id})"
				stroke-width="1.5"
			/>
			<text
				x={c.x + c.w / 2}
				y={TOP + c.y + s.h * 0.68}
				text-anchor="middle"
				font-size={s.f}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
			<text
				x={c.x + c.w / 2}
				y={TOP + c.y + s.h + 14}
				text-anchor="middle"
				font-size="11"
				style:fill="var(--stage-ink-muted)"
				style:font-variant-numeric="tabular-nums">{c.rank}</text
			>
		{/each}
		<Readout id="legend-title">
			<Label anchor="start" x={X0} y={552} size={12} muted text="learned:" />
		</Readout>
		{#each BUCKETS as b, i (b.id)}
			{@const lx = X0 + 70 + i * 200}
			<Readout id="bucket-{b.id}" label={b.label} color="var(--tk-{b.id})">
				<rect
					x={lx}
					y={540}
					width="14"
					height="14"
					rx="3"
					fill="color-mix(in oklab, var(--tk-{b.id}) 26%, var(--surface))"
					stroke="var(--tk-{b.id})"
					stroke-width="1.5"
				/>
				<Label anchor="start" x={lx + 20} y={552} size={12} text={b.label} />
			</Readout>
		{/each}
		<Readout id="legend-note">
			<Label
				anchor="start"
				x={X0}
				y={578}
				size={11.5}
				muted
				text="Early merges joined the most frequent pairs of GPT-2’s training text."
			/>
		</Readout>
	{/if}
</g>
