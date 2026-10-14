<script lang="ts">
	/**
	 * A constellation diagram with received symbols: the decision grid (dashed),
	 * the received points as a cloud (one path; wrongly decided ones in red), and
	 * the ideal points on top. Shared by the channel and link scenes.
	 */
	import { boundaries, constellation, type Scheme, type Transmission } from '../radio';
	import { Readout } from '#lib/explainer/index.ts';
	import T from './T.svelte';

	interface Props {
		scheme: Scheme;
		tx: Transmission;
		/** How many of the transmission's symbols to draw. */
		shown: number;
		cx: number;
		cy: number;
		/** Half the side of the square panel, drawing units. */
		half: number;
		/** Data units from the centre to the panel's edge. */
		range?: number;
		/** Unique suffix for the clip path id. */
		uid: string;
		labels?: boolean;
	}
	let { scheme, tx, shown, cx, cy, half, range = 1.5, uid, labels = true }: Props = $props();

	const k = $derived(half / range);
	const X = (v: number) => cx + v * k;
	const Y = (v: number) => cy - v * k;
	const pts = $derived(constellation(scheme));
	const lines = $derived(boundaries(scheme));
	const many = $derived(pts.length > 16);

	const clouds = $derived.by(() => {
		let ok = '';
		let bad = '';
		const n = Math.min(shown, tx.n);
		for (let s = 0; s < n; s++) {
			const seg = `M${X(tx.received[2 * s]).toFixed(1)} ${Y(tx.received[2 * s + 1]).toFixed(1)}h0`;
			if (tx.wrong[s]) bad += seg;
			else ok += seg;
		}
		return { ok, bad };
	});
	const ideal = $derived(pts.map((p) => `M${X(p.i).toFixed(1)} ${Y(p.q).toFixed(1)}h0`).join(''));
</script>

<defs>
	<clipPath id="constellation-clip-{uid}">
		<rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx="10" />
	</clipPath>
</defs>
<rect
	x={cx - half}
	y={cy - half}
	width={half * 2}
	height={half * 2}
	rx="10"
	fill="var(--ws-region)"
	stroke="var(--border)"
/>
<g clip-path="url(#constellation-clip-{uid})">
	<line x1={cx - half} x2={cx + half} y1={cy} y2={cy} stroke="var(--stage-line)" opacity="0.6" />
	<line x1={cx} x2={cx} y1={cy - half} y2={cy + half} stroke="var(--stage-line)" opacity="0.6" />
	{#each lines as b (b)}
		<line
			x1={X(b)}
			x2={X(b)}
			y1={cy - half}
			y2={cy + half}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		{#if scheme !== 'bpsk'}
			<line
				x1={cx - half}
				x2={cx + half}
				y1={Y(b)}
				y2={Y(b)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="4 4"
				opacity="0.7"
			/>
		{/if}
	{/each}
	<path
		d={clouds.ok}
		stroke="var(--ws-cloud)"
		stroke-width={many ? 2.6 : 3.4}
		stroke-linecap="round"
		opacity="0.55"
	/>
	<path d={clouds.bad} stroke="var(--ws-bad)" stroke-width="3.6" stroke-linecap="round" />
	<path
		d={ideal}
		stroke="var(--ws-point)"
		stroke-width={many ? 5 : pts.length > 4 ? 9 : 12}
		stroke-linecap="round"
	/>
</g>
<Readout id="constellation-labels-{uid}">
	{#if labels && pts.length <= 16}
		{#each pts as p (p.bits)}
			<T
				x={X(p.i) + (pts.length > 4 ? 0 : p.i >= 0 ? 14 : -14)}
				y={Y(p.q) + (pts.length > 4 ? 22 : -12)}
				text={p.bits}
				size={pts.length > 4 ? 11 : 13}
				weight={700}
				anchor={pts.length > 4 ? 'middle' : p.i >= 0 ? 'start' : 'end'}
			/>
		{/each}
	{/if}
</Readout>
<T x={cx + half - 8} y={cy - 6} text="I" size={13} weight={700} anchor="end" />
<T x={cx + 8} y={cy - half + 18} text="Q" size={13} weight={700} />
