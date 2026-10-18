<script lang="ts">
	/**
	 * A card with a sample the model wrote, in monospace, broken at its own line breaks and
	 * wrapped at `cols` characters. Characters inside `copy` (a stretch found word for word in
	 * the training text) are drawn bold in the copy colour.
	 */
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		title: string;
		note?: string;
		text: string;
		cols?: number;
		maxLines?: number;
		copy?: { start: number; length: number } | null;
		opacity?: number;
	}
	let {
		x,
		y,
		w,
		h,
		title,
		note = '',
		text,
		cols = 40,
		maxLines = 15,
		copy = null,
		opacity = 1
	}: Props = $props();

	interface Run {
		text: string;
		copied: boolean;
	}
	/** Lines of runs; the sample's leading line breaks are dropped. */
	const lines = $derived.by(() => {
		const chars = Array.from(text);
		let i = 0;
		while (i < chars.length && chars[i] === '\n') i++;
		const out: Run[][] = [[]];
		let col = 0;
		const inCopy = (k: number) => copy !== null && k >= copy.start && k < copy.start + copy.length;
		for (; i < chars.length; i++) {
			const c = chars[i];
			if (c === '\n') {
				out.push([]);
				col = 0;
				continue;
			}
			if (col === cols) {
				out.push([]);
				col = 0;
			}
			const line = out[out.length - 1];
			const copied = inCopy(i);
			const last = line[line.length - 1];
			if (last && last.copied === copied) last.text += c;
			else line.push({ text: c, copied });
			col++;
		}
		return out.slice(0, maxLines);
	});
</script>

<g {opacity}>
	<rect {x} {y} width={w} height={h} rx="10" fill="var(--surface)" stroke="var(--border)" />
	<Label x={x + 16} y={y + 26} anchor="start" size={13} weight={650} text={title} />
	{#if note}
		<Label x={x + 16} y={y + 44} anchor="start" size={11} muted text={note} />
	{/if}
	{#each lines as line, j (j)}
		<text
			x={x + 16}
			y={y + (note ? 70 : 54) + j * 20}
			font-size="12"
			style:font-family="var(--font-mono)"
			xml:space="preserve"
			>{#each line as r, k (k)}<tspan
					style:fill={r.copied ? 'var(--ttlm-copy)' : 'var(--stage-ink)'}
					style:font-weight={r.copied ? 700 : 400}>{r.text}</tspan
				>{/each}</text
		>
	{/each}
</g>
