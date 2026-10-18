<script lang="ts">
	/**
	 * How much speculative decoding saves, for each draft and k = 1 … 8, measured on six
	 * generations of the page's models.
	 *
	 * Focus (`step.hints.focus`):
	 *   passes — characters written per target pass: measured (dots) and (1 − α^(k+1)) / (1 − α)
	 *            for the draft's keep rate α (curves); plain decoding is 1.
	 *   cost   — bytes read per character, target and draft together, as a speed-up over plain
	 *            decoding (the ideal, bandwidth-only speed-up): above 1 the guessing pays.
	 *
	 * The selected draft is drawn in full and the others faintly; the selected k is marked.
	 * Motion: the selected draft's curve draws itself in over the first second; reduced motion
	 * shows it whole.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DRAFTS, type DraftId } from '../models';
	import { expectedPerPass, K_MAX, pooledAlpha, speedsOf } from '../results';
	import { draftOf, kOf } from '../steps';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'passes') as 'passes' | 'cost');
	const draft = $derived(draftOf(params));
	const k = $derived(kOf(params));

	const COLORS: Record<DraftId, string> = {
		unigram: 'var(--stage-ink-muted)',
		bigram: 'var(--sd-left)',
		small: 'var(--sd-draft)',
		self: 'var(--sd-target)'
	};
	const all = $derived(
		DRAFTS.map((d) => ({ ...d, rows: speedsOf(d.id), alpha: pooledAlpha(d.id) }))
	);
	const sel = $derived(all.find((d) => d.id === draft) ?? all[2]);
	const row = $derived(sel.rows[k - 1]);
	const grow = $derived(reduced ? 1 : smoothstep(0, 1.2, t));

	const sx = scale([0.6, K_MAX + 0.4], [96, 590]);
	const syPass = scale([0, 10], [520, 110]);
	const sySpeed = scale([0, 2.5], [520, 110]);
	const sy = $derived(focus === 'passes' ? syPass : sySpeed);
	const value = (r: { perPass: number; bytesShare: number }) =>
		focus === 'passes' ? r.perPass : 1 / r.bytesShare;

	function curve(alpha: number, upto: number) {
		const pts: string[] = [];
		const steps = 60;
		for (let i = 0; i <= steps; i++) {
			const kk = 1 + ((upto - 1) * i) / steps;
			pts.push(
				`${i === 0 ? 'M' : 'L'}${sx(kk).toFixed(1)} ${syPass(expectedPerPass(alpha, kk)).toFixed(1)}`
			);
		}
		return pts.join(' ');
	}
	const line = (vals: number[], upto: number) =>
		vals
			.slice(0, Math.max(1, Math.ceil(upto)))
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i + 1).toFixed(1)} ${sy(v).toFixed(1)}`)
			.join(' ');

	const fmt = (v: number, d = 2) => v.toFixed(d);
	/** End labels, nudged apart so that none overlap. */
	const ends = $derived.by(() => {
		const items = all.map((d) => {
			const last = d.rows[K_MAX - 1];
			const y =
				focus === 'passes' ? syPass(expectedPerPass(d.alpha, K_MAX)) : sySpeed(1 / last.bytesShare);
			return { id: d.id, y, text: d.short };
		});
		items.sort((a, b) => a.y - b.y);
		for (let i = 1; i < items.length; i++)
			if (items[i].y - items[i - 1].y < 16) items[i].y = items[i - 1].y + 16;
		return items;
	});
</script>

<g>
	<Readout
		id="title"
		order={0}
		label={focus === 'passes' ? 'Characters per target pass' : 'Ideal bandwidth-only speed-up'}
		value="draft: {sel.short}, k = {k}"
	>
		<Label
			x={24}
			y={34}
			anchor="start"
			size={14}
			weight={700}
			text={focus === 'passes'
				? 'Characters written per pass of the target, for k guesses per round'
				: 'Bytes read per character, plain decoding ÷ speculative: the ideal bandwidth-only speed-up'}
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={[1, 2, 3, 4, 5, 6, 7, 8]}
		yTicks={focus === 'passes' ? [0, 2, 4, 6, 8, 10] : [0, 0.5, 1, 1.5, 2, 2.5]}
		yFormat={(v) => (focus === 'passes' ? String(v) : `${v}×`)}
		xLabel="k"
		yLabel={focus === 'passes' ? 'characters per pass' : 'speed-up'}
	/>
	<!-- plain decoding -->
	<line
		x1={sx(0.6)}
		x2={sx(K_MAX + 0.4)}
		y1={sy(1)}
		y2={sy(1)}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-dasharray="6 4"
		opacity="0.6"
	/>
	<Readout id="plain">
		<Label
			x={sx(1)}
			y={sy(1) + 16}
			anchor="start"
			size={11}
			muted
			text={focus === 'passes' ? 'plain decoding: 1' : 'plain decoding: 1×, no gain'}
		/>
	</Readout>
	<!-- the selected k -->
	<line
		x1={sx(k)}
		x2={sx(k)}
		y1={sy(0)}
		y2={110}
		stroke="var(--stage-line)"
		stroke-width="1"
		stroke-dasharray="2 3"
	/>

	{#each all as d (d.id)}
		{@const on = d.id === draft}
		<g opacity={on ? 1 : 0.32}>
			{#if focus === 'passes'}
				<path
					d={curve(d.alpha, on ? 1 + (K_MAX - 1) * grow : K_MAX)}
					fill="none"
					stroke={COLORS[d.id]}
					stroke-width={on ? 2.5 : 1.5}
				/>
			{:else}
				<path
					d={line(
						d.rows.map((r) => value(r)),
						on ? K_MAX * grow : K_MAX
					)}
					fill="none"
					stroke={COLORS[d.id]}
					stroke-width={on ? 2.5 : 1.5}
				/>
			{/if}
			{#each d.rows as r (r.k)}
				<circle
					cx={sx(r.k)}
					cy={sy(value(r))}
					r={on && r.k === k ? 6.5 : on ? 4.5 : 3}
					fill={COLORS[d.id]}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/each}
		</g>
	{/each}
	{#each ends as e (e.id)}
		<Readout id="end-{e.id}" order={9} label={e.text} color={COLORS[e.id]}>
			<Label
				x={sx(K_MAX) + 14}
				y={e.y + 4}
				anchor="start"
				size={12}
				weight={e.id === draft ? 700 : 400}
				color={COLORS[e.id]}
				opacity={e.id === draft ? 1 : 0.6}
				text={e.text}
			/>
		</Readout>
	{/each}

	<!-- the selected draft at the selected k -->
	<Readout id="card1"
		><rect
			x={676}
			y={110}
			width={264}
			height={focus === 'passes' ? 152 : 176}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/></Readout
	>
	{#if focus === 'passes'}
		<Readout
			id="a"
			order={1}
			label="Keep rate α"
			value="{fmt(sel.alpha)} ({sel.short})"
			color={COLORS[sel.id]}
		>
			<Label
				x={692}
				y={134}
				anchor="start"
				size={13}
				weight={700}
				halo={false}
				color={COLORS[sel.id]}
				text="{sel.short}, k = {k}"
			/>
			<Label
				x={692}
				y={158}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="keep rate α = {fmt(sel.alpha)}"
			/>
		</Readout>
		<Readout id="m" order={2} label="Measured" value="{fmt(row.perPass)} characters per pass">
			<Label
				x={692}
				y={180}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="measured: {fmt(row.perPass)} per pass"
			/>
		</Readout>
		<Readout
			id="f"
			order={3}
			label="(1 − α^(k+1)) / (1 − α)"
			value={sel.alpha >= 1 ? `${k + 1} (every guess kept)` : fmt(expectedPerPass(sel.alpha, k))}
		>
			<Label
				x={692}
				y={202}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="(1 − α^(k+1)) / (1 − α) = {fmt(expectedPerPass(sel.alpha, k))}"
			/>
			<Label
				x={692}
				y={224}
				anchor="start"
				size={12}
				tabular
				muted
				halo={false}
				text={sel.alpha >= 1
					? 'every guess kept: k + 1'
					: `never above 1/(1 − α) = ${fmt(1 / (1 - sel.alpha))}`}
			/>
			<Label
				x={692}
				y={246}
				anchor="start"
				size={11}
				muted
				halo={false}
				text="curves: the formula; dots: measured"
			/>
		</Readout>
	{:else}
		<Readout
			id="a"
			order={1}
			label="Per pass"
			value="{fmt(row.perPass)} characters ({sel.short}, k = {k})"
			color={COLORS[sel.id]}
		>
			<Label
				x={692}
				y={134}
				anchor="start"
				size={13}
				weight={700}
				halo={false}
				color={COLORS[sel.id]}
				text="{sel.short}, k = {k}"
			/>
			<Label
				x={692}
				y={158}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="{fmt(row.perPass)} characters per pass"
			/>
		</Readout>
		<Readout
			id="b"
			order={2}
			label="Bytes read per character"
			value="{fmt(row.bytesShare)} of plain decoding's: {fmt(
				1 / row.bytesShare
			)}× ideal bandwidth-only speed-up"
		>
			<Label
				x={692}
				y={180}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="bytes per character: {fmt(row.bytesShare)} of plain"
			/>
			<Label
				x={692}
				y={202}
				anchor="start"
				size={12}
				tabular
				halo={false}
				weight={600}
				color={row.bytesShare < 1 ? 'var(--sd-kept)' : 'var(--sd-reject)'}
				text={row.bytesShare < 1
					? `speed-up: ${fmt(1 / row.bytesShare)}× (ideal)`
					: `${fmt(row.bytesShare)}× the bytes: slower`}
			/>
		</Readout>
		<Readout
			id="c"
			order={3}
			label="Arithmetic per character"
			value="{fmt(row.macsShare)}× plain decoding's"
		>
			<Label
				x={692}
				y={230}
				anchor="start"
				size={12}
				tabular
				halo={false}
				text="arithmetic per character: {fmt(row.macsShare)}×"
			/>
			<Label
				x={692}
				y={252}
				anchor="start"
				size={11}
				muted
				halo={false}
				text="(the draft’s steps, and rejected guesses)"
			/>
			<Label
				x={692}
				y={270}
				anchor="start"
				size={11}
				muted
				halo={false}
				text="dots: measured on six generations"
			/>
		</Readout>
	{/if}
</g>
