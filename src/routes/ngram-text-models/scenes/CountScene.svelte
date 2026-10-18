<script lang="ts">
	/**
	 * The counting machine at work on the reader's text: a window of `cn` letters slides along
	 * the text, one letter per beat, and the table below counts which letter followed each
	 * window so far. Rows: the most frequent windows of the whole text; a row lights up when the
	 * window passes over it.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';
	import { chars, countTable, tally } from '../ngram';
	import TextBlock from './TextBlock.svelte';
	import TextBox from './TextBox.svelte';
	import { num, ownText, visible, type Kind } from './shared';

	let { t, params, reduced, setParam }: StageProps = $props();

	const msg = $derived(ownText(params));
	const cs = $derived(chars(msg));
	const n = $derived(Math.max(1, Math.min(4, Math.round(num(params.cn, 2)))));
	/** Positions where a window starts and a letter follows it. */
	const positions = $derived(Math.max(0, cs.length - n));

	const table = $derived(countTable(msg, n));
	const MAX_ROWS = 7;
	const top = $derived(
		table
			.slice()
			.sort((a, b) => b.occ.length - a.occ.length || a.first - b.first)
			.slice(0, MAX_ROWS)
	);
	const once = $derived(table.filter((r) => r.occ.length === 1).length);

	// ---- the clock: one position per beat, then a pause, then again
	const BEAT = $derived(Math.min(0.5, 14 / Math.max(1, positions)));
	const period = $derived(positions * BEAT + 4);
	const tt = $derived(reduced ? period : t % period);
	/** Positions counted so far (the window now sits at `done - 1`). */
	const done = $derived(Math.min(positions, Math.floor(tt / BEAT) + 1));
	const finished = $derived(done >= positions);
	const at = $derived(finished ? -1 : done - 1);

	const kind = (i: number): Kind => {
		if (at < 0) return 'plain';
		if (i >= at && i < at + n) return 'window';
		if (i === at + n) return 'next';
		return i < at + n ? 'plain' : 'muted';
	};

	// ---- table layout
	const T = { x: 40, y: 290, rowH: 38, chipX: 160, right: 920 };
	const CW = 13 * 0.602;
	const chipW = (s: string) => s.length * CW + 14;
	const rows = $derived(
		top.map((r, ri) => {
			const seen = r.occ.filter((o) => o.pos < done);
			const order = tally(r, done);
			let x = T.chipX;
			const chips: { key: string; text: string; x: number; w: number; count: number }[] = [];
			let hidden = 0;
			for (const { char, count } of order) {
				const text = `${visible(char)} ×${count}`;
				const w = chipW(text);
				if (x + w > T.right - 70) {
					hidden++;
					continue;
				}
				chips.push({ key: char, text, x, w, count });
				x += w + 8;
			}
			return {
				...r,
				y: T.y + ri * T.rowH,
				seen: seen.length,
				live: at >= 0 && r.occ.some((o) => o.pos === at),
				chips,
				hidden,
				endX: x
			};
		})
	);
	const status = $derived(
		finished
			? `${table.length} different windows of ${n}; ${once} of them came up only once`
			: `window “${visible(cs.slice(at, at + n).join(''))}” → next letter “${visible(cs[at + n] ?? '')}”`
	);
</script>

<g>
	<TextBox x={40} y={18} w={880} value={msg} {setParam} />

	<Readout id="text" order={1} label="Your text" value={msg}>
		<TextBlock x={44} y={152} w={872} chars={cs} {kind} size={16} lineH={26} maxLines={5} />
	</Readout>

	<Readout id="status" order={2} label="Counting" value={status}>
		<Label anchor="start" tabular x={40} y={T.y - 26} size={14} weight={650} text={status} />
	</Readout>

	{#each rows as r (r.window)}
		<g opacity={r.seen > 0 ? 1 : 0.4}>
			{#if r.live}
				<rect
					x={T.x - 8}
					y={r.y - 4}
					width={T.right - T.x + 16}
					height={T.rowH - 6}
					rx="8"
					fill="var(--ng-window-bg)"
				/>
			{/if}
			<rect
				x={T.x}
				y={r.y}
				width={chipW(visible(r.window))}
				height="24"
				rx="6"
				fill="var(--surface)"
				stroke="var(--ng-window)"
				stroke-width="1.5"
			/>
			<text
				x={T.x + 7}
				y={r.y + 17}
				font-size="13"
				style:font-family="var(--font-mono)"
				style:white-space="pre"
				font-weight="650">{visible(r.window)}</text
			>
			<Label
				anchor="start"
				tabular
				x={T.x + chipW(visible(r.window)) + 10}
				y={r.y + 17}
				size={12}
				muted
				text="×{r.seen} →"
				halo={false}
			/>
			{#each r.chips as c (c.key)}
				<g opacity={c.count > 0 ? 1 : 0.25}>
					<rect
						x={c.x}
						y={r.y}
						width={c.w}
						height="24"
						rx="12"
						fill="var(--ng-next-bg)"
						stroke="var(--ng-hot)"
						stroke-opacity="0.5"
					/>
					<text
						x={c.x + 7}
						y={r.y + 17}
						font-size="13"
						style:font-family="var(--font-mono)"
						style:white-space="pre">{c.text}</text
					>
				</g>
			{/each}
			{#if r.hidden > 0}
				<Label
					anchor="start"
					x={r.endX + 4}
					y={r.y + 17}
					size={11}
					muted
					text="+{r.hidden} more"
					halo={false}
				/>
			{/if}
		</g>
	{/each}
	{#if table.length > MAX_ROWS}
		<Readout id="more">
			<Label
				anchor="start"
				x={T.x}
				y={T.y + MAX_ROWS * T.rowH + 8}
				size={11}
				muted
				text="the {MAX_ROWS} windows that came up most often, of {table.length}"
			/>
		</Readout>
	{/if}
</g>
