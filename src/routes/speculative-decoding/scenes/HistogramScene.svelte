<script lang="ts">
	/**
	 * 10,000 first characters written by speculative rounds after “ROMEO:↵Wh”, against the
	 * target's probabilities p (blue marks, with a band of ±2 standard errors of sampling) and the
	 * draft's q (dashed outlines).
	 *
	 * Modes (`step.hints.mode`):
	 *   exact — the histogram of what was written converges on p as the draws grow from 10 to
	 *           10,000; its distance from p is shown beside that of the target drawing alone.
	 *   why   — each bar split into the draws written by a kept guess (green, tending to
	 *           min(p, q)) and those drawn from the leftover (violet, tending to max(0, p − q)).
	 *   wrong — two panels on the same random numbers: the min(1, p/q) rule, and keeping a guess
	 *           only when it is the target's top choice (drawing from p otherwise), which skews.
	 *
	 * Motion: the number of draws grows over 7 s (log scale) and then holds; reduced motion shows
	 * all 10,000.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { chars, DRAFTS } from '../models';
	import { distance, HIST_CONTEXT, histogram, noiseDistance, SAMPLES } from '../results';
	import { draftOf } from '../steps';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'exact') as 'exact' | 'why' | 'wrong');
	const draft = $derived(draftOf(params));
	const draftName = $derived(DRAFTS.find((d) => d.id === draft)?.short ?? draft);
	const seed = $derived(2 + Math.abs(Math.round(Number(params.resample ?? 0))));
	const h = $derived(histogram(draft, 'exact', seed));
	const hw = $derived(mode === 'wrong' ? histogram(draft, 'top-match', seed) : null);

	const GROW = 7;
	const n = $derived(
		reduced ? SAMPLES : Math.round(10 ** (1 + 3 * smoothstep(0, 1, Math.min(1, t / GROW))))
	);

	const context = `“${HIST_CONTEXT.replace('\n', '↵')}”`;
	const show = (v: number) => (chars[v] === '\n' ? '↵' : chars[v] === ' ' ? '·' : chars[v]);
	const pct = (v: number, d = 1) => `${(100 * v).toFixed(d)}%`;
	const fmt = (v: number) => v.toLocaleString('en-US');

	/** Characters on the chart: where p or q is not negligible, likeliest under p first. */
	const shown = $derived.by(() => {
		const { p, q } = h;
		const max = mode === 'wrong' ? 8 : 14;
		return Array.from({ length: p.length }, (_, v) => v)
			.filter((v) => p[v] > 0.002 || q[v] > 0.02)
			.sort((a, b) => p[b] - p[a] || q[b] - q[a])
			.slice(0, max);
	});

	function counts(draws: Uint8Array, kept: Uint8Array | null, upto: number) {
		const all = new Float64Array(chars.length);
		const k = new Float64Array(chars.length);
		for (let i = 0; i < upto; i++) {
			all[draws[i]]++;
			if (kept && kept[i]) k[draws[i]]++;
		}
		return { all, kept: k };
	}
	const c = $derived(counts(h.draws, h.kept, n));
	const cw = $derived(hw ? counts(hw.draws, null, n) : null);
	const dist = $derived(distance(h.draws, n, h.p));
	const noise = $derived(noiseDistance(h.p, n));
	const distWrong = $derived(hw ? distance(hw.draws, n, h.p) : 0);
	const keptShare = $derived(c.kept.reduce((a, b) => a + b, 0) / n);
	const beta = $derived(h.p.reduce((s, pv, v) => s + Math.min(pv, h.q[v]), 0));

	// ---- layout --------------------------------------------------------------------------------
	const Y0 = 500;
	const Y1 = 150;
	const panels = $derived(
		mode === 'wrong'
			? [
					{ id: 'right', x0: 90, x1: 470, title: 'the rule: keep with min(1, p/q)' },
					{ id: 'wrong', x0: 560, x1: 940, title: 'keep only the target’s top choice' }
				]
			: [{ id: 'right', x0: 90, x1: 900, title: '' }]
	);
	/** The axis fits p, q and (for the wrong rule) its final frequencies, so it holds still. */
	const yMax = $derived.by(() => {
		const final = hw ? counts(hw.draws, null, SAMPLES).all.map((x) => x / SAMPLES) : [];
		const m = Math.max(
			...shown.map((v) => Math.max(h.p[v], h.q[v])),
			...shown.map((v) => final[v] ?? 0)
		);
		return m <= 0.3 ? 0.3 : m <= 0.4 ? 0.4 : 0.6;
	});
	const yOf = (v: number) => Y0 - ((Y0 - Y1) * Math.min(v, yMax * 1.05)) / yMax;
	const yTicks = $derived(
		yMax === 0.6 ? [0, 0.2, 0.4, 0.6] : yMax === 0.4 ? [0, 0.1, 0.2, 0.3, 0.4] : [0, 0.1, 0.2, 0.3]
	);
</script>

<g>
	<Readout id="title" order={0} label="Next character after" value="{context}, draft: {draftName}">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={14}
			weight={700}
			text="The character written after {context}, speculative rounds with the {draftName} as draft"
		/>
	</Readout>
	<Readout id="n" order={1} label="Draws" value="{fmt(n)} of {fmt(SAMPLES)}">
		<Label x={24} y={60} anchor="start" size={13} tabular text="{fmt(n)} draws" />
	</Readout>

	{#each panels as pn (pn.id)}
		{@const slot = (pn.x1 - pn.x0) / shown.length}
		{@const cc = pn.id === 'wrong' && cw ? cw : c}
		{#if pn.title}
			<Readout id="pt-{pn.id}">
				<Label
					x={(pn.x0 + pn.x1) / 2}
					y={Y1 - 34}
					size={13}
					weight={600}
					color={pn.id === 'wrong' ? 'var(--sd-reject)' : 'var(--sd-kept)'}
					text={pn.title}
				/>
			</Readout>
		{/if}
		{#each yTicks as v (v)}
			<line
				x1={pn.x0}
				x2={pn.x1}
				y1={yOf(v)}
				y2={yOf(v)}
				stroke={v === 0 ? 'var(--stage-line)' : 'var(--stage-grid)'}
				stroke-dasharray={v === 0 ? undefined : '3 4'}
			/>
			<Readout id="yt-{pn.id}-{v}">
				<Label
					x={pn.x0 - 8}
					y={yOf(v) + 4}
					anchor="end"
					size={11}
					muted
					halo={false}
					text={v.toFixed(1)}
				/>
			</Readout>
		{/each}
		{#each shown as v, i (v)}
			{@const cx = pn.x0 + slot * (i + 0.5)}
			{@const pv = h.p[v]}
			{@const qv = h.q[v]}
			{@const freq = cc.all[v] / n}
			{@const keptF = cc.kept[v] / n}
			{@const se = Math.sqrt((pv * (1 - pv)) / n)}
			<!-- the draft's q -->
			<rect
				x={cx - slot * 0.42}
				y={yOf(qv)}
				width={slot * 0.84}
				height={Y0 - yOf(qv)}
				fill="var(--sd-draft)"
				fill-opacity="0.1"
				stroke="var(--sd-draft)"
				stroke-width="1.2"
				stroke-dasharray="4 3"
			/>
			<!-- what was written -->
			{#if mode === 'why'}
				<rect
					x={cx - slot * 0.25}
					y={yOf(keptF)}
					width={slot * 0.5}
					height={Y0 - yOf(keptF)}
					fill="var(--sd-kept)"
					opacity="0.75"
				/>
				<rect
					x={cx - slot * 0.25}
					y={yOf(freq)}
					width={slot * 0.5}
					height={yOf(keptF) - yOf(freq)}
					fill="var(--sd-left)"
					opacity="0.75"
				/>
				<!-- min(p, q): where the kept part tends -->
				<line
					x1={cx - slot * 0.36}
					x2={cx + slot * 0.36}
					y1={yOf(Math.min(pv, qv))}
					y2={yOf(Math.min(pv, qv))}
					stroke="var(--sd-kept)"
					stroke-width="2"
					stroke-dasharray="3 2"
				/>
			{:else}
				<rect
					x={cx - slot * 0.25}
					y={yOf(freq)}
					width={slot * 0.5}
					height={Y0 - yOf(freq)}
					fill={pn.id === 'wrong' ? 'var(--sd-reject)' : 'var(--stage-ink-muted)'}
					opacity="0.6"
				/>
			{/if}
			<!-- the target's p, with ±2 standard errors of sampling -->
			{#if pv > 0.002}
				<rect
					x={cx - slot * 0.36}
					y={yOf(pv + 2 * se)}
					width={slot * 0.72}
					height={Math.max(1, yOf(Math.max(0, pv - 2 * se)) - yOf(pv + 2 * se))}
					fill="var(--sd-target)"
					opacity="0.2"
				/>
				<line
					x1={cx - slot * 0.36}
					x2={cx + slot * 0.36}
					y1={yOf(pv)}
					y2={yOf(pv)}
					stroke="var(--sd-target)"
					stroke-width="3"
				/>
			{/if}
			<text
				x={cx}
				y={Y0 + 20}
				text-anchor="middle"
				font-family="ui-monospace, monospace"
				font-size="14">{show(v)}</text
			>
		{/each}
	{/each}

	<!-- key -->
	<Readout
		id="key"
		order={5}
		label="Key"
		value={mode === 'why'
			? 'green: kept guesses · violet: from the leftover · blue: p · dashed: q'
			: 'grey bars: written · blue: p (band ±2 standard errors) · dashed: q'}
	>
		{@const KY = Y0 + 44}
		<line x1={90} x2={110} y1={KY} y2={KY} stroke="var(--sd-target)" stroke-width="3" />
		<Label x={116} y={KY + 4} anchor="start" size={12} halo={false} text="p, the target" />
		<rect
			x={222}
			y={KY - 6}
			width="14"
			height="12"
			fill="var(--sd-draft)"
			fill-opacity="0.1"
			stroke="var(--sd-draft)"
			stroke-dasharray="3 2"
		/>
		<Label x={242} y={KY + 4} anchor="start" size={12} halo={false} text="q, the draft" />
		{#if mode === 'why'}
			<rect x={340} y={KY - 6} width="12" height="12" fill="var(--sd-kept)" opacity="0.75" />
			<Label
				x={358}
				y={KY + 4}
				anchor="start"
				size={12}
				halo={false}
				text="a kept guess (tends to min(p, q))"
			/>
			<rect x={590} y={KY - 6} width="12" height="12" fill="var(--sd-left)" opacity="0.75" />
			<Label
				x={608}
				y={KY + 4}
				anchor="start"
				size={12}
				halo={false}
				text="from the leftover (tends to max(0, p − q))"
			/>
		{:else}
			<rect x={340} y={KY - 6} width="12" height="12" fill="var(--stage-ink-muted)" opacity="0.6" />
			<Label
				x={358}
				y={KY + 4}
				anchor="start"
				size={12}
				halo={false}
				text="share of the draws written"
			/>
		{/if}
	</Readout>

	<!-- the numbers -->
	{#if mode === 'exact'}
		<Readout
			id="dist"
			order={2}
			label="Distance from p"
			value="{pct(dist)}; sampling noise alone: about {pct(noise)}"
		>
			<Label
				x={936}
				y={60}
				anchor="end"
				size={13}
				tabular
				text="distance from p: {pct(dist)} · sampling noise alone: about {pct(noise)}"
			/>
		</Readout>
	{:else if mode === 'why'}
		<Readout
			id="kept"
			order={2}
			label="Kept guesses"
			value="{pct(keptShare)} of draws (Σ min(p, q) = {beta.toFixed(3)})"
			color="var(--sd-kept)"
		>
			<Label
				x={936}
				y={60}
				anchor="end"
				size={13}
				tabular
				text="kept guesses: {pct(keptShare)} of the draws · Σ min(p, q) = {beta.toFixed(3)}"
			/>
		</Readout>
		<Readout id="sum" order={3} label="Each bar" value="min(p, q) + max(0, p − q) = p">
			<Label
				x={936}
				y={82}
				anchor="end"
				size={12}
				muted
				text="each bar: min(p, q) + max(0, p − q) = p"
			/>
		</Readout>
	{:else}
		<Readout
			id="dist"
			order={2}
			label="Distance from p"
			value="the rule {pct(dist)}; top choice only {pct(distWrong)}"
		>
			<Label
				x={936}
				y={60}
				anchor="end"
				size={13}
				tabular
				text="distance from p: the rule {pct(dist)} · top choice only {pct(distWrong)}"
			/>
		</Readout>
	{/if}
</g>
