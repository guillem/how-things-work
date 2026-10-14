<script lang="ts">
	/**
	 * GPT-2's tokenizer at work on the reader's text (real BPE, in the browser, see `bpe.ts`).
	 * Phase "tokens": the text as tokens, each with its number. Phase "merges": the merges
	 * replayed in the order GPT-2 learned them (lowest rank first), every piece starting from
	 * single bytes; below, the whole ladder of merges for the longest piece.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import type { Bpe, Piece } from '../bpe';
	import MessageBox from './MessageBox.svelte';
	import { chipWidth, flow, label, message, TOKEN_FILLS, tokenizer } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'tokens'));
	const msg = $derived(message(params));

	let bpe = $state<Bpe | null>(null);
	let failed = $state(false);
	$effect(() => {
		tokenizer().then(
			(b) => (bpe = b),
			() => (failed = true)
		);
	});

	const pieces = $derived<Piece[]>(bpe ? bpe.pieces(msg) : []);
	const ids = $derived(pieces.flatMap((p) => p.ids));
	const chars = $derived([...msg].length);
	const tokText = (id: number) => (bpe ? label(bpe.text(id)) : '');

	// ---- tokens phase: one chip per token
	const X0 = 40;
	const W = 880;
	const Y0 = 196;
	const chips = $derived(
		flow(
			ids.map((id, i) => ({
				id,
				i,
				text: tokText(id),
				w: Math.max(chipWidth(tokText(id), 18), String(id).length * 8 + 12)
			})),
			X0,
			W,
			5,
			ids.length > 50 ? 58 : 72
		)
	);

	// ---- merges phase: every merge of every piece, in rank order
	const TICK = 0.55;
	const events = $derived(
		pieces
			.flatMap((p, pi) => p.merges.map((m, mi) => ({ pi, mi, rank: m.rank })))
			.sort((a, b) => a.rank - b.rank || a.pi - b.pi)
	);
	const period = $derived((events.length + 7) * TICK);
	const applied = $derived(
		reduced
			? events.length
			: Math.max(0, Math.min(events.length, Math.floor((t % period) / TICK) - 1))
	);
	const done = $derived.by(() => {
		const n = pieces.map(() => 0);
		for (let e = 0; e < applied; e++) n[events[e].pi]++;
		return n;
	});
	const latest = $derived(applied > 0 ? events[applied - 1] : null);
	const stateOf = (p: Piece, n: number) => (n === 0 ? p.bytes : p.merges[n - 1].tokens);
	const mchips = $derived.by(() => {
		const items: {
			key: string;
			text: string;
			w: number;
			pi: number;
			hot: boolean;
			gapBefore: boolean;
		}[] = [];
		pieces.forEach((p, pi) => {
			const toks = stateOf(p, done[pi]);
			const made = latest && latest.pi === pi ? p.merges[latest.mi].rank + 256 : -1;
			toks.forEach((id, j) =>
				items.push({
					key: `${pi}-${j}`,
					text: tokText(id),
					w: chipWidth(tokText(id), 15, 20),
					pi,
					hot: id === made,
					gapBefore: j === 0 && pi > 0
				})
			);
		});
		// pieces are separated by a wider gap: fold it into the chip width of the piece's first token
		return flow(
			items.map((c) => ({ ...c, w: c.w + (c.gapBefore ? 10 : 0) })),
			X0,
			W,
			2,
			46
		).map((c) => ({
			...c,
			x: c.x + (c.gapBefore && c.x > X0 ? 10 : 0),
			w: c.w - (c.gapBefore ? 10 : 0)
		}));
	});
	const caption = $derived.by(() => {
		if (!bpe || !latest)
			return `Every piece starts as single bytes: ${pieces.reduce((a, p) => a + p.bytes.length, 0)} tokens`;
		const p = pieces[latest.pi];
		const before = stateOf(p, latest.mi);
		const after = p.merges[latest.mi].tokens;
		// the pair merged: the first place where before and after differ
		let j = 0;
		while (j < after.length && before[j] === after[j]) j++;
		return `merge no. ${(latest.rank + 1).toLocaleString('en-US')} of 50,000: ${tokText(before[j])} + ${tokText(before[j + 1])} → ${tokText(after[j])}`;
	});

	// ---- the ladder of the longest piece (by number of merges)
	const LY = 346;
	const MAX_ROWS = 10;
	const ladder = $derived.by(() => {
		if (!pieces.length) return null;
		let best = pieces[0];
		for (const p of pieces) if (p.merges.length > best.merges.length) best = p;
		if (best.merges.length === 0) return null;
		const pi = pieces.indexOf(best);
		const rows = [
			{ n: 0, rank: -1, toks: best.bytes },
			...best.merges.map((m, i) => ({ n: i + 1, rank: m.rank, toks: m.tokens }))
		];
		const shown =
			rows.length > MAX_ROWS ? [...rows.slice(0, 2), null, ...rows.slice(3 - MAX_ROWS)] : rows;
		return { pi, piece: best, rows: shown };
	});
	const RH = 24;
</script>

<g>
	<MessageBox x={X0} y={22} w={W} value={msg} {setParam} />

	{#if !bpe}
		<Txt
			x={480}
			y={300}
			anchor="middle"
			text={failed ? 'GPT-2’s tokenizer could not be loaded.' : 'Loading GPT-2’s tokenizer…'}
			muted
		/>
	{:else if phase === 'tokens'}
		<Readout
			id="count"
			order={1}
			label="GPT-2 tokens"
			value="{chars} characters → {ids.length} tokens"
		>
			<Txt x={X0} y={160} size={16} weight={650} text="{chars} characters → {ids.length} tokens" />
		</Readout>
		<Readout
			id="ratio"
			order={2}
			label="Characters per token"
			value={ids.length ? (chars / ids.length).toFixed(1) : '–'}
		>
			<Txt
				x={X0 + W}
				y={160}
				anchor="end"
				size={12}
				muted
				text="{ids.length
					? (chars / ids.length).toFixed(1)
					: '–'} characters per token · the number under each token is its id"
			/>
		</Readout>
		{#each chips as c (c.i)}
			<g>
				<rect
					x={c.x}
					y={Y0 + c.y}
					width={c.w}
					height="36"
					rx="7"
					fill={TOKEN_FILLS[c.i % 5]}
					stroke="var(--border)"
					stroke-width="1"
				/>
				<text
					x={c.x + c.w / 2}
					y={Y0 + c.y + 24}
					text-anchor="middle"
					style:font-size="18px"
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{c.text}</text
				>
				<text
					x={c.x + c.w / 2}
					y={Y0 + c.y + 53}
					text-anchor="middle"
					style:font-size="12px"
					style:fill="var(--stage-ink-muted)"
					style:font-variant-numeric="tabular-nums">{c.id}</text
				>
			</g>
		{/each}
	{:else}
		<Readout id="merge" order={1} label="Latest merge" value={caption}>
			<Txt x={X0} y={160} size={15} weight={650} text={caption} />
		</Readout>
		{#each mchips as c (c.key)}
			<g>
				<rect
					x={c.x}
					y={Y0 + c.y - 8}
					width={c.w}
					height="30"
					rx="5"
					fill={c.hot
						? 'color-mix(in oklab, var(--lm-pick) 30%, var(--surface))'
						: TOKEN_FILLS[c.pi % 5]}
					stroke={c.hot ? 'var(--lm-pick)' : 'var(--border)'}
					stroke-width={c.hot ? 2 : 1}
				/>
				<text
					x={c.x + c.w / 2}
					y={Y0 + c.y + 12}
					text-anchor="middle"
					style:font-size="15px"
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{c.text}</text
				>
			</g>
		{/each}
		{#if ladder}
			<Readout id="ladder-title">
				<Txt
					x={X0}
					y={LY - 14}
					size={13}
					weight={650}
					text="All the merges of “{label(ladder.piece.text)}”, in order"
				/>
			</Readout>
			{#each ladder.rows as row, ri (ri)}
				{@const y = LY + ri * RH}
				{#if row}
					{@const now = done[ladder.pi] === row.n}
					{@const lay = flow(
						row.toks.map((id, j) => ({ j, text: tokText(id), w: chipWidth(tokText(id), 12, 16) })),
						X0 + 132,
						W - 132,
						2,
						RH
					)}
					<Readout id="ladder-{ri}">
						<Txt
							x={X0 + 120}
							y={y + 13}
							anchor="end"
							size={11.5}
							muted={!now}
							weight={now ? 650 : 500}
							text={row.rank < 0 ? 'bytes' : `merge ${(row.rank + 1).toLocaleString('en-US')}`}
						/>
					</Readout>
					{#each lay as c (c.j)}
						<rect
							x={c.x}
							{y}
							width={c.w}
							height="19"
							rx="4"
							fill={now
								? 'color-mix(in oklab, var(--lm-pick) 22%, var(--surface))'
								: 'var(--surface)'}
							stroke={now ? 'var(--lm-pick)' : 'var(--border)'}
							stroke-width="1"
						/>
						<text
							x={c.x + c.w / 2}
							y={y + 14}
							text-anchor="middle"
							style:font-size="12px"
							style:font-family="var(--font-mono)"
							style:fill="var(--stage-ink)">{c.text}</text
						>
					{/each}
				{:else}
					<Txt x={X0 + 120} y={y + 13} anchor="end" size={12} muted text="…" />
				{/if}
			{/each}
		{/if}
	{/if}
</g>
