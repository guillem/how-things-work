<script lang="ts">
	/**
	 * The five MIT-BIH excerpts, eight seconds each, one under another, with the database's
	 * reference labels over the beats. A cursor sweeps across them (every 8 s of t); under reduced
	 * motion it is not drawn.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { RECORDS } from '../records-data';

	let { t, reduced }: StageProps = $props();

	const X0 = 40;
	const X1 = 930;
	const SPAN = 8;
	const ROW = 108;
	const TOP = 30;
	const K = 30;
	const px = (X1 - X0) / SPAN;

	const rows = RECORDS.map((r, i) => {
		const base = TOP + i * ROW + 66;
		let d = '';
		for (let k = 0; k < Math.min(r.mv.length, SPAN * r.fs); k++) {
			const v = Math.max(-1.6, Math.min(1.6, r.mv[k]));
			d += `${k ? 'L' : 'M'}${(X0 + (k / r.fs) * px).toFixed(1)} ${(base - v * K).toFixed(1)}`;
		}
		return {
			...r,
			top: TOP + i * ROW,
			base,
			d,
			beats: r.marks.filter((m) => m.s !== '+').map((m) => ({ x: X0 + m.t * px, s: m.s })),
			rhythms: r.marks.filter((m) => m.s === '+').map((m) => ({ x: X0 + m.t * px, s: m.aux ?? '' }))
		};
	});
	const cursor = $derived(X0 + ((t % SPAN) / SPAN) * (X1 - X0));
</script>

<g>
	{#each Array.from({ length: SPAN * 5 + 1 }, (_, g) => g) as g (g)}
		<line
			x1={X0 + g * (px / 5)}
			x2={X0 + g * (px / 5)}
			y1={TOP + 20}
			y2={TOP + ROW * rows.length - 8}
			stroke="var(--stage-grid)"
			stroke-width={g % 5 === 0 ? 1.2 : 0.6}
		/>
	{/each}
	{#each rows as r, i (r.id)}
		<Readout id="rec-{r.id}" order={i + 1} label={r.title} value="record {r.record}">
			<Label anchor="start" x={X0} y={r.top + 14} text={r.title} size={13} weight={600} />
			<Label
				anchor="end"
				x={X1}
				y={r.top + 14}
				text="MIT-BIH record {r.record}, from {r.start} s"
				size={11}
				muted
			/>
		</Readout>
		<path d={r.d} fill="none" stroke="var(--ecg-real)" stroke-width="1.5" stroke-linejoin="round" />
		<Readout id="marks-{r.id}">
			{#each r.beats as m, j (j)}
				<Label x={m.x} y={r.top + 32} text={m.s} size={10} mono color="var(--ecg-mark-text)" />
			{/each}
			{#each r.rhythms as m, j (j)}
				<Label anchor="start" x={m.x + 2} y={r.base + 36} text={m.s} size={10} mono muted />
			{/each}
		</Readout>
	{/each}
	{#if !reduced}
		<line
			x1={cursor}
			x2={cursor}
			y1={TOP + 20}
			y2={TOP + ROW * rows.length - 8}
			stroke="var(--ecg-mark)"
			stroke-width="1.5"
			opacity="0.7"
		/>
	{/if}
	<Readout id="rec-scale" label="Scale: 1 s between bold grid lines">
		<Label
			anchor="start"
			x={X0}
			y={TOP + ROW * rows.length + 8}
			text="1 s between bold grid lines · labels: N normal, V ventricular premature, R bundle-branch block, ! flutter wave, [ start of flutter"
			size={11}
			muted
		/>
	</Readout>
</g>
