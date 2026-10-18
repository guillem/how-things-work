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
	import { chipWidth, FILLS, flow, fmt, show, tokenizer } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const PRESETS = [
		{ label: 'strawberry', value: DEFAULT_MESSAGE },
		{ label: 'Hamlet', value: SAMPLE },
		{ label: 'long words', value: 'Tokenization of antidisestablishmentarianism' },
		{ label: 'numbers', value: 'In 2026, π ≈ 3.14159 and 1,000,000 ÷ 7' },
		{ label: 'code', value: 'def add(a, b):\n    return a + b' }
	];

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
		{ id: 'other', label: '␣? other symbols', re: /^ ?[^\s\p{L}\p{N}]+$/u },
		{ id: 'space', label: 'spaces, line breaks', re: /^\s+$/u },
		{ id: 'ending', label: "'s 't 're 've 'm 'll 'd", re: /^'(s|t|re|ve|m|ll|d)$/ }
	] as const;
	const kindOf = (text: string) =>
		KINDS.find((k) => k.id === 'ending' && k.re.test(text)) ??
		KINDS.find((k) => k.re.test(text)) ??
		KINDS[2];
	/** One chip per piece, and under it the piece's tokens, both laid out with the same widths. */
	const SPLIT_SIZES = [
		{ f: 20, tf: 16, ph: 36, th: 28, lh: 96 },
		{ f: 15, tf: 13, ph: 28, th: 22, lh: 76 },
		{ f: 12, tf: 11, ph: 22, th: 18, lh: 58 }
	];
	const splitLayout = $derived.by(() => {
		for (const z of SPLIT_SIZES) {
			const items = pieces.map((p, pi) => {
				const text = show(p.text);
				const toks = p.ids.map((id) => ({
					id,
					text: tok(id),
					w: chipWidth(tok(id), z.tf, z.tf + 4)
				}));
				const tw = toks.reduce((s, x) => s + x.w + 2, -2);
				const w = Math.max(chipWidth(text, z.f, z.f + 6), tw);
				return { pi, text, kind: kindOf(p.text), toks, tw, w };
			});
			const lay = flow(items, X0, W, 8, z.lh);
			const rows = lay.length ? lay[lay.length - 1].row + 1 : 1;
			if (TOP + rows * z.lh <= 506 || z === SPLIT_SIZES[2]) return { z, lay };
		}
		return { z: SPLIT_SIZES[2], lay: [] };
	});
	const sz = $derived(splitLayout.z);

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
	const rowChips = (key: 'bpe' | 'lm') => {
		const items = compare.flatMap((c) =>
			c[key].map((id, j) => ({
				key: `${c.pi}-${j}`,
				text: tok(id),
				w: chipWidth(tok(id), 15, 18) + (j === 0 && c.pi > 0 ? 8 : 0),
				gap: j === 0 && c.pi > 0,
				same: c.same
			}))
		);
		return flow(items, X0 + 150, W - 150, 2, 36).map((c) => ({
			...c,
			x: c.x + (c.gap && c.x > X0 + 150 ? 8 : 0),
			w: c.w - (c.gap ? 8 : 0)
		}));
	};
	const bpeRow = $derived(rowChips('bpe'));
	const lmRow = $derived(rowChips('lm'));
	const rowsOf = (r: { row: number }[]) => (r.length ? r[r.length - 1].row + 1 : 1);
	const lmY = $derived(TOP + 22 + rowsOf(bpeRow) * 36);

	/** The ladder: the first piece the two rules cut differently, else the one with most merges. */
	const featured = $derived.by(() => {
		if (!pieces.length) return null;
		const d = compare.find((c) => !c.same);
		if (d) return pieces[d.pi];
		return pieces.reduce((a, p) => (p.merges.length > a.merges.length ? p : a), pieces[0]);
	});
	const LY = $derived(lmY + rowsOf(lmRow) * 36 + 58);
	const RH = 30;
	const ladder = $derived.by(() => {
		const p = featured;
		if (!p) return [];
		const all = [
			{ n: 0, rank: -1, toks: p.bytes },
			...p.merges.map((m, i) => ({ n: i + 1, rank: m.rank, toks: m.tokens }))
		];
		const room = Math.max(3, Math.floor((590 - LY) / RH));
		return all.length > room
			? [...all.slice(0, 2), null, ...all.slice(all.length - (room - 3))]
			: all;
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
			{ f: 12, h: 22, lh: 44 }
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
			if (TOP + 10 + rows * s.lh <= 520 || s.f === 12) return { s, lay };
		}
		return { s: { f: 12, h: 22, lh: 44 }, lay: [] };
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
				text="{chars} characters → {pieces.length} pieces → {ids.length} tokens"
			/>
		</Readout>
		{#each splitLayout.lay as c (c.pi)}
			{@const y = TOP + c.y}
			{@const tw = c.tw}
			<rect
				x={c.x}
				{y}
				width={c.w}
				height={sz.ph}
				rx="6"
				fill="color-mix(in oklab, var(--tk-{c.kind.id}) 18%, var(--surface))"
				stroke="var(--tk-{c.kind.id})"
				stroke-width="1.5"
			/>
			<text
				x={c.x + c.w / 2}
				y={y + sz.ph * 0.68}
				text-anchor="middle"
				font-size={sz.f}
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
			{#each c.toks as tk, j (j)}
				{@const tx = c.x + (c.w - tw) / 2 + c.toks.slice(0, j).reduce((s, x) => s + x.w + 2, 0)}
				<rect
					x={tx}
					y={y + sz.ph + 6}
					width={tk.w}
					height={sz.th}
					rx="4"
					fill={FILLS[(c.pi + j) % 5]}
					stroke="var(--border)"
				/>
				<text
					x={tx + tk.w / 2}
					y={y + sz.ph + 6 + sz.th * 0.7}
					text-anchor="middle"
					font-size={sz.tf}
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{tk.text}</text
				>
			{/each}
		{/each}
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
				height="28"
				rx="4"
				fill={c.same ? 'var(--surface)' : 'color-mix(in oklab, var(--tk-next) 22%, var(--surface))'}
				stroke={c.same ? 'var(--border)' : 'var(--tk-next)'}
				stroke-width={c.same ? 1 : 1.8}
			/>
			<text
				x={c.x + c.w / 2}
				y={TOP + c.y + 19.5}
				text-anchor="middle"
				font-size="15"
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink)">{c.text}</text
			>
		{/each}
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
				height="28"
				rx="4"
				fill={c.same ? 'var(--surface)' : 'color-mix(in oklab, var(--tk-hot) 18%, var(--surface))'}
				stroke={c.same ? 'var(--border)' : 'var(--tk-hot)'}
				stroke-width={c.same ? 1 : 1.8}
				stroke-dasharray={c.same ? undefined : '4 2'}
			/>
			<text
				x={c.x + c.w / 2}
				y={lmY + c.y + 19.5}
				text-anchor="middle"
				font-size="15"
				style:font-family="var(--font-mono)"
				style:fill="var(--stage-ink-muted)">{c.text}</text
			>
		{/each}
		{#if featured}
			<Readout
				id="ladder-title"
				order={3}
				label="Ladder"
				value={differ
					? `${differ} piece${differ === 1 ? '' : 's'} cut differently; replaying “${show(featured.text)}”`
					: `the two rules agree here; replaying “${show(featured.text)}”`}
			>
				<Label
					anchor="start"
					x={X0}
					y={LY - 16}
					size={13}
					weight={650}
					text="The merges of “{show(featured.text)}”, lowest rank first{differ
						? ''
						: ' (here the two rules agree)'}"
				/>
			</Readout>
			{#each ladder as row, ri (ri)}
				{@const y = LY + ri * RH}
				{#if row}
					{@const on = ri < shown}
					{@const now = ri === shown - 1}
					{@const lay = flow(
						row.toks.map((id, j) => ({ j, text: tok(id), w: chipWidth(tok(id), 15, 18) })),
						X0 + 150,
						W - 150,
						2,
						RH
					)}
					<g opacity={on ? 1 : 0.15}>
						<Label
							x={X0 + 136}
							y={y + 14}
							anchor="end"
							size={11.5}
							tabular
							muted={!now}
							weight={now ? 650 : 500}
							text={row.rank < 0 ? 'bytes' : `merge no. ${fmt(row.rank + 1)}`}
						/>
						{#each lay as c (c.j)}
							<rect
								x={c.x}
								{y}
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
								y={y + 17.5}
								text-anchor="middle"
								font-size="15"
								style:font-family="var(--font-mono)"
								style:fill="var(--stage-ink)">{c.text}</text
							>
						{/each}
					</g>
				{:else}
					<Label x={X0 + 136} y={y + 14} anchor="end" size={12} muted text="…" />
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
