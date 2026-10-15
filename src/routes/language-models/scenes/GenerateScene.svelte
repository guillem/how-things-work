<script lang="ts">
	/**
	 * Text generation, one token per beat, from a run stored by the build script. Top: the text
	 * so far. Bottom: the distribution of the current step. Phase "greedy": GPT-2's own
	 * probabilities (T = 1), the top token taken. Phase "sample": the distribution actually
	 * sampled from (after temperature and top-p), laid end to end on a strip from 0 to 1, the
	 * random number drawn, and the token whose stretch contains it.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { drawIndex, percent } from '../lm';
	import { label, lm, num, str } from './shared';
	import TextCard from './TextCard.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'greedy'));
	const pid = $derived(str(params.rp, 'story'));
	const prompt = $derived(lm.prompt(pid));
	const T = $derived(phase === 'greedy' ? 0 : Number(str(params.rt, '0.7')));
	const topP = $derived(params.rtp === true ? 0.9 : 1);
	const seed = $derived(Math.round(num(params.seed, 1)));
	const run = $derived(lm.run(pid, T, topP, seed));
	const greedy = $derived(run.T === 0);
	const N = $derived(run.steps.length);

	// ---- the clock: one token per beat, a pause at the end, then again
	const BEAT = $derived(greedy ? 1 : 1.5);
	const period = $derived(N * BEAT + 4);
	const tt = $derived(reduced ? N * BEAT : t % period);
	const cur = $derived(Math.min(N - 1, Math.floor(tt / BEAT)));
	const u = $derived(reduced ? 1 : tt >= N * BEAT ? 1 : (tt - cur * BEAT) / BEAT);
	const appended = $derived(u > 0.68 ? cur + 1 : cur);
	const s = $derived(run.steps[cur]);

	// ---- the bars of the current step
	const rows = $derived(s.d.map(([id, p]) => ({ id, p, picked: id === s.pick })));
	const pickedShown = $derived(rows.some((r) => r.picked));
	const ROW = { x: 230, y: 300, h: 30, w: 420 };
	const barIn = $derived(reduced ? 1 : smoothstep(0, 0.25, u));

	// ---- the strip (sampling)
	const STRIP = { x: 60, y: 520, w: 840, h: 26 };
	const segs = $derived.by(() => {
		let c = 0;
		const out = rows.map((r, i) => {
			const seg = { ...r, i, a: c, b: c + r.p };
			c += r.p;
			return seg;
		});
		return { out, end: c };
	});
	const rx = $derived(s.r === null ? 0 : STRIP.x + s.r * STRIP.w);
	const marker = $derived(reduced ? 1 : smoothstep(0.28, 0.6, u));
	const mx = $derived(STRIP.x + (rx - STRIP.x) * marker);
	const hit = $derived(
		s.r === null
			? 0
			: drawIndex(
					s.d.map((x) => x[1]),
					s.r
				)
	);
	const status = $derived(
		greedy
			? `step ${cur + 1} of ${N}: take the most likely token, ${label(lm.token(s.pick))} (${percent(s.pp)})`
			: u < 0.6
				? `step ${cur + 1} of ${N}: draw a random number between 0 and 1 …`
				: `step ${cur + 1} of ${N}: random number ${s.r?.toFixed(3)} → ${label(lm.token(s.pick))} (${percent(s.pp)})`
	);
	const setting = $derived(
		greedy
			? 'greedy decoding (T = 0)'
			: `T = ${run.T}${run.p < 1 ? ', top-p 0.9' : ''}, run ${seed}`
	);
	const fullText = $derived(
		lm.text(prompt.ids.slice(1)) + lm.text(run.steps.slice(0, appended).map((x) => x.pick))
	);
</script>

<g>
	<Readout id="setting" order={1} label="Setting" value={setting}>
		<Label
			anchor="start"
			tabular
			x={44}
			y={42}
			size={12}
			muted
			text="GPT-2 small writes · {setting}"
		/>
	</Readout>
	<Readout id="text" order={2} label="Text so far" value={fullText}>
		<rect
			x="24"
			y="16"
			width="912"
			height="224"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<TextCard
			x={44}
			y={72}
			w={872}
			prompt={prompt.ids.slice(1)}
			gen={run.steps.slice(0, appended).map((x) => x.pick)}
			hot={appended === cur + 1 ? cur : -1}
			maxLines={6}
			size={17}
			lineH={27}
		/>
	</Readout>

	<Readout id="status" order={3} label="This step" value={status}>
		<Label anchor="start" tabular x={44} y={276} size={14} weight={650} text={status} />
	</Readout>

	<!-- the distribution at this step -->
	<Readout id="dist-head">
		<Label
			tabular
			x={ROW.x - 14}
			y={ROW.y - 4}
			anchor="end"
			size={11}
			muted
			text={greedy ? 'GPT-2’s probabilities' : 'sampled from'}
		/>
	</Readout>
	{#each rows as r, i (i)}
		{@const y = ROW.y + i * ROW.h + 8}
		{@const on = r.picked && (greedy || u > 0.6)}
		<Label
			tabular
			x={ROW.x - 14}
			y={y + 14}
			anchor="end"
			size={13}
			weight={on ? 700 : 500}
			color={on ? 'var(--lm-pick)' : undefined}
			mono
			text={label(lm.token(r.id))}
		/>
		<rect
			x={ROW.x}
			{y}
			width={Math.max(0.5, r.p * ROW.w * barIn)}
			height="19"
			rx="3"
			fill={on ? 'var(--lm-pick)' : 'var(--lm-bar)'}
			opacity="0.85"
		/>
		<Label
			anchor="start"
			tabular
			x={ROW.x + r.p * ROW.w * barIn + 8}
			y={y + 14}
			size={12}
			muted={!on}
			color={on ? 'var(--lm-pick)' : undefined}
			text={percent(r.p)}
		/>
	{/each}
	{#if !pickedShown && (greedy || u > 0.6)}
		<Label
			anchor="start"
			tabular
			x={ROW.x}
			y={ROW.y + rows.length * ROW.h + 22}
			size={12.5}
			color="var(--lm-pick)"
			weight={650}
			text="picked a rarer token: {label(lm.token(s.pick))} ({percent(s.pp)})"
		/>
	{/if}

	{#if !greedy}
		<!-- the strip: the distribution laid end to end from 0 to 1 -->
		<Readout id="strip-title">
			<Label
				anchor="start"
				x={STRIP.x}
				y={STRIP.y - 12}
				size={12}
				muted
				text="the same probabilities laid end to end, from 0 to 1, and a random number:"
			/>
		</Readout>
		{#each segs.out as g (g.i)}
			<rect
				x={STRIP.x + g.a * STRIP.w}
				y={STRIP.y}
				width={Math.max(0.5, g.p * STRIP.w - 1)}
				height={STRIP.h}
				fill={g.i === hit && marker > 0.95 ? 'var(--lm-pick)' : 'var(--lm-bar)'}
				opacity={0.35 + 0.5 * (1 - g.i / 6)}
			/>
			{#if g.p * STRIP.w > 46}
				<text
					x={STRIP.x + (g.a + g.p / 2) * STRIP.w}
					y={STRIP.y + 17}
					text-anchor="middle"
					font-size="11.5"
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-bg)"
					style:font-weight="650">{label(lm.token(g.id))}</text
				>
			{/if}
		{/each}
		<rect
			x={STRIP.x + segs.end * STRIP.w}
			y={STRIP.y}
			width={Math.max(0, (1 - segs.end) * STRIP.w)}
			height={STRIP.h}
			fill={hit === -1 && marker > 0.95 ? 'var(--lm-pick)' : 'var(--lm-rest)'}
			opacity="0.35"
		/>
		{#if (1 - segs.end) * STRIP.w > 90}
			<Label
				x={STRIP.x + ((1 + segs.end) / 2) * STRIP.w}
				y={STRIP.y + 17}
				anchor="middle"
				size={11}
				muted
				text="all the other tokens"
			/>
		{/if}
		<rect
			x={STRIP.x}
			y={STRIP.y}
			width={STRIP.w}
			height={STRIP.h}
			fill="none"
			stroke="var(--stage-line)"
		/>
		<Label x={STRIP.x} y={STRIP.y + STRIP.h + 16} anchor="middle" size={11} muted text="0" />
		<Label
			x={STRIP.x + STRIP.w}
			y={STRIP.y + STRIP.h + 16}
			anchor="middle"
			size={11}
			muted
			text="1"
		/>
		<!-- the random number: slides in from 0 to where it fell -->
		<g opacity={smoothstep(0.24, 0.32, reduced ? 1 : u)}>
			<path d="M{mx} {STRIP.y - 2} l-7 -11 h14 Z" fill="var(--lm-pick)" />
			<line
				x1={mx}
				y1={STRIP.y}
				x2={mx}
				y2={STRIP.y + STRIP.h}
				stroke="var(--lm-pick)"
				stroke-width="2.5"
			/>
			<Label
				tabular
				x={mx}
				y={STRIP.y + STRIP.h + 30}
				anchor="middle"
				size={12}
				weight={650}
				color="var(--lm-pick)"
				opacity={marker > 0.98 ? 1 : 0}
				text="r = {s.r?.toFixed(3)}"
			/>
		</g>
	{:else}
		<Readout id="greedy-note">
			<Label
				anchor="start"
				x={ROW.x}
				y={560}
				size={12}
				muted
				text="Greedy decoding needs no dice: the same prompt always gives the same text."
			/>
		</Readout>
	{/if}
</g>
