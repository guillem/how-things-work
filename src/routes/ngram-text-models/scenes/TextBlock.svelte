<script lang="ts">
	/**
	 * A monospace text block, word-wrapped so widths are exact, with characters styled by kind:
	 * runs of the same kind share one `<tspan>` (and one background rectangle for marked runs),
	 * to keep the node count low. With `tail`, the last `maxLines` lines are shown (text that
	 * grows scrolls up); otherwise the first ones.
	 */
	import { wrap, type Kind } from './shared';

	interface Props {
		x: number;
		y: number;
		w: number;
		chars: readonly string[];
		kind?: (i: number) => Kind;
		size?: number;
		lineH?: number;
		maxLines?: number;
		tail?: boolean;
		/** Cursor drawn after the last character. */
		cursor?: boolean;
		/** Start a line or two above the line holding this character, so that it is in view. */
		focus?: number;
	}
	let {
		x,
		y,
		w,
		chars,
		kind = () => 'plain',
		size = 14,
		lineH = 22,
		maxLines = 99,
		tail = false,
		cursor = false,
		focus = -1
	}: Props = $props();

	const cw = $derived(size * 0.602);
	const all = $derived(wrap(chars, Math.max(8, Math.floor(w / cw))));
	const first = $derived.by(() => {
		if (tail) return Math.max(0, all.length - maxLines);
		if (focus < 0) return 0;
		const line = all.findIndex((l) => l.idx.length > 0 && l.idx[l.idx.length - 1] >= focus);
		return line < 0 ? 0 : Math.max(0, Math.min(line - 2, all.length - maxLines));
	});
	const shown = $derived(all.slice(first, first + maxLines));

	const FILL: Record<Kind, string> = {
		plain: 'var(--stage-ink)',
		muted: 'var(--stage-ink-muted)',
		hot: 'var(--ng-hot)',
		copy: 'var(--stage-ink)',
		unseen: 'var(--stage-ink)',
		window: 'var(--stage-ink)',
		next: 'var(--ng-hot)'
	};
	const BG: Partial<Record<Kind, string>> = {
		copy: 'var(--ng-copy-bg)',
		unseen: 'var(--ng-unseen-bg)',
		window: 'var(--ng-window-bg)',
		next: 'var(--ng-next-bg)'
	};

	interface Run {
		kind: Kind;
		col: number;
		text: string;
	}
	const rows = $derived.by(() => {
		let yy = y;
		return shown.map((line, li) => {
			const runs: Run[] = [];
			line.idx.forEach((ci, col) => {
				const k = kind(ci);
				const c = chars[ci];
				const last = runs[runs.length - 1];
				if (last && last.kind === k) last.text += c;
				else runs.push({ kind: k, col, text: c });
			});
			const row = { key: li, y: yy, runs, blank: line.blank, end: line.idx.length };
			yy += line.blank ? lineH * 0.5 : lineH;
			return row;
		});
	});
	const lastRow = $derived(rows.findLast((r) => !r.blank));
</script>

<g style:font-family="var(--font-mono)" font-size={size}>
	{#each rows as r (r.key)}
		{#each r.runs as run (run.col)}
			{@const bg = BG[run.kind]}
			{#if bg}
				<rect
					x={x + run.col * cw - 1}
					y={r.y - size * 0.95}
					width={[...run.text].length * cw + 2}
					height={size * 1.3}
					rx="3"
					fill={bg}
				/>
			{/if}
		{/each}
		<text {x} y={r.y} style:white-space="pre">
			{#each r.runs as run (run.col)}<tspan
					x={x + run.col * cw}
					style:fill={FILL[run.kind]}
					font-weight={run.kind === 'hot' || run.kind === 'next' ? 700 : 500}>{run.text}</tspan
				>{/each}
		</text>
	{/each}
	{#if cursor && lastRow}
		<rect
			x={x + lastRow.end * cw + 1}
			y={lastRow.y - size * 0.85}
			width="2"
			height={size * 1.1}
			fill="var(--ng-hot)"
		/>
	{/if}
</g>
