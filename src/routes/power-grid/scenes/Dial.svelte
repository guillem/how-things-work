<script lang="ts">
	/**
	 * The grid's frequency as a dial: an arc from `min` to `max` Hz with the ±200 mHz
	 * operating band in green, the load-shedding zone (below 49.0 Hz) in red, and a needle.
	 */
	import Txt from './Txt.svelte';
	import { BAND, F0, UFLS_STEPS } from '../grid';

	interface Props {
		cx: number;
		cy: number;
		r: number;
		f: number;
		min?: number;
		max?: number;
		/** Draw the tick labels. */
		labels?: boolean;
	}
	let { cx, cy, r, f, min = 48.5, max = 51.5, labels = true }: Props = $props();

	// the arc spans 240°, from lower left (min) over the top to lower right (max)
	const SPAN = (240 * Math.PI) / 180;
	const angle = (hz: number) => {
		const u = Math.max(0, Math.min(1, (hz - min) / (max - min)));
		return Math.PI / 2 + (2 * Math.PI - SPAN) / 2 + u * SPAN;
	};
	const pt = (hz: number, rr: number) => ({
		x: cx + rr * Math.cos(angle(hz)),
		y: cy + rr * Math.sin(angle(hz))
	});
	const arc = (a: number, b: number, rr: number) => {
		const p = pt(a, rr);
		const q = pt(b, rr);
		const large = angle(b) - angle(a) > Math.PI ? 1 : 0;
		return `M${p.x.toFixed(1)} ${p.y.toFixed(1)} A${rr} ${rr} 0 ${large} 1 ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
	};
	const tickValues = $derived.by(() => {
		const out: number[] = [];
		for (let v = Math.ceil(min * 2) / 2; v <= max + 1e-9; v += 0.5) out.push(Number(v.toFixed(1)));
		return out;
	});
	const tip = $derived(pt(f, r - 14));
	const inBand = $derived(Math.abs(f - F0) <= BAND + 1e-9);
	const shedding = $derived(f <= UFLS_STEPS[0]);
	const needle = $derived(
		inBand ? 'var(--pg-ok)' : shedding ? 'var(--pg-alarm)' : 'var(--pg-warn)'
	);
</script>

<g>
	<path d={arc(min, max, r)} fill="none" stroke="var(--stage-grid)" stroke-width="14" />
	<path
		d={arc(Math.max(min, F0 - BAND), Math.min(max, F0 + BAND), r)}
		fill="none"
		stroke="var(--pg-ok)"
		stroke-width="14"
		opacity="0.75"
	/>
	{#if min < UFLS_STEPS[0]}
		<path
			d={arc(min, UFLS_STEPS[0], r)}
			fill="none"
			stroke="var(--pg-alarm)"
			stroke-width="14"
			opacity="0.55"
		/>
	{/if}
	{#each tickValues as v (v)}
		{@const a = pt(v, r - 9)}
		{@const b = pt(v, r + 9)}
		<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--stage-line)" stroke-width="1" />
		{#if labels && (v * 2) % 2 === 0}
			{@const l = pt(v, r + 22)}
			<text x={l.x} y={l.y + 4} text-anchor="middle" font-size="11" class="muted">{v}</text>
		{/if}
	{/each}
	<line
		x1={cx}
		y1={cy}
		x2={tip.x}
		y2={tip.y}
		stroke={needle}
		stroke-width="4"
		stroke-linecap="round"
	/>
	<circle {cx} {cy} r="7" fill={needle} />
	<Txt x={cx} y={cy + 36} text="{f.toFixed(2)} Hz" size={18} weight={700} />
</g>
