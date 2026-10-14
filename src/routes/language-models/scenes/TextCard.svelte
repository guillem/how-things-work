<script lang="ts">
	/**
	 * A text written as a prompt (muted) plus generated tokens, word-wrapped in a monospace font
	 * so that widths are exact. Newline tokens break the line (and show as ↵). Generated tokens
	 * are underlined; `hot` marks one of them.
	 */
	import { lm } from './shared';

	interface Props {
		x: number;
		y: number;
		w: number;
		prompt: readonly number[];
		gen: readonly number[];
		/** Greedy continuation drawn after the generated tokens, in grey. */
		ghost?: readonly number[];
		hot?: number;
		size?: number;
		lineH?: number;
		maxLines?: number;
		color?: string;
	}
	let {
		x,
		y,
		w,
		prompt,
		gen,
		ghost = [],
		hot = -1,
		size = 14,
		lineH = 22,
		maxLines = 99,
		color = 'var(--lm-gen)'
	}: Props = $props();

	const cw = $derived(size * 0.602);
	interface Piece {
		key: string;
		text: string;
		x: number;
		line: number;
		kind: 'prompt' | 'gen' | 'ghost';
		n: number;
		i: number;
	}
	const pieces = $derived.by(() => {
		const out: Piece[] = [];
		const perLine = Math.floor(w / cw);
		let col = 0;
		let line = 0;
		let broke = false;
		let nlCol = 0;
		const all = [
			...prompt.map((id) => ({ id, kind: 'prompt' as const })),
			...gen.map((id) => ({ id, kind: 'gen' as const })),
			...ghost.map((id) => ({ id, kind: 'ghost' as const }))
		];
		let gi = -1;
		all.forEach((tk, i) => {
			if (tk.kind === 'gen') gi++;
			const raw = lm.token(tk.id).replace(/\u00a0/g, ' ');
			const parts = raw.split('\n');
			parts.forEach((part, pi) => {
				if (pi > 0) {
					// show the newline itself, then break; a run of newlines breaks only once (↵↵)
					const again = broke;
					out.push({
						key: `${i}-nl${pi}`,
						text: '↵',
						x: again ? nlCol : col,
						line: again ? line - 1 : line,
						kind: tk.kind,
						n: 1,
						i: tk.kind === 'gen' ? gi : -1
					});
					if (again) nlCol++;
					else {
						nlCol = col + 1;
						col = 0;
						line++;
						broke = true;
					}
				}
				if (!part) return;
				broke = false;
				let text = part;
				if (col === 0) text = text.replace(/^ /, '');
				if (col + text.length > perLine && col > 0) {
					col = 0;
					line++;
					text = text.replace(/^ /, '');
				}
				out.push({
					key: `${i}-${pi}`,
					text,
					x: col,
					line,
					kind: tk.kind,
					n: text.length,
					i: tk.kind === 'gen' ? gi : -1
				});
				col += text.length;
			});
		});
		return out.filter((p) => p.line < maxLines);
	});
</script>

<g>
	{#each pieces as p (p.key)}
		{@const px = x + p.x * cw}
		{@const py = y + p.line * lineH}
		{#if p.kind === 'gen'}
			<rect
				x={px}
				y={py + 4}
				width={Math.max(2, p.n * cw - 1)}
				height="3"
				rx="1.5"
				fill={p.i === hot ? 'var(--lm-pick)' : color}
				opacity={p.i === hot ? 1 : 0.55}
			/>
		{/if}
		<text
			x={px}
			y={py}
			xml:space="preserve"
			style:font-family="var(--font-mono)"
			style:font-size="{size}px"
			style:fill={p.kind === 'prompt'
				? 'var(--stage-ink-muted)'
				: p.kind === 'ghost'
					? 'var(--lm-greedy)'
					: p.i === hot
						? 'var(--lm-pick)'
						: 'var(--stage-ink)'}
			style:font-weight={p.i === hot ? 700 : 500}
			style:font-style={p.kind === 'ghost' ? 'italic' : undefined}>{p.text}</text
		>
	{/each}
</g>
