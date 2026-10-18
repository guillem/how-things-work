<script lang="ts">
	/**
	 * The policy over GPT-2's 64 answers, one bar each, ordered by the reward model's score (best
	 * on the right) and coloured by the rater's score, on a square-root scale so that GPT-2's 1/64
	 * (the dashed line) stays visible next to a bar that holds everything.
	 * - tilt: the exact KL-regularised optimum π_ref·e^{r/β}, normalised, following the β slider.
	 * - pg: a policy-gradient run (REINFORCE, batches of 16 sampled answers, a fixed seed per
	 *   press of "Run again") from π_ref, played over 12 s; outlines show the exact optimum. Under
	 *   reduced motion the finished run is shown.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { expect, kl, policyGradient, tilt, tv } from '../rlhf';
	import { rewardsOf } from '../store.svelte';
	import { presses } from './actions.svelte';
	import { betaOf, fmtBeta, num, pct, promptOf, scoreColor, wrap } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const prompt = $derived(promptOf(params));
	const pg = $derived(step.hints?.mode === 'pg');
	const r = $derived(rewardsOf(prompt.id));
	const scores = $derived(prompt.answers.map((a) => a.score));
	const beta = $derived(betaOf(params));
	const exact = $derived(tilt(r, beta));
	const order = $derived(
		r
			.map((v, i) => ({ v, i }))
			.sort((a, b) => a.v - b.v)
			.map((o) => o.i)
	);

	// ---- the policy-gradient run
	const ITERS = 600;
	const RUN_SECONDS = 12;
	const seed = $derived(1 + presses(params.rerun));
	const run = $derived(
		pg ? policyGradient(r, beta, { iters: ITERS, batch: 16, lr: 0.5, seed, every: 5 }) : null
	);
	// the step time at which the current run started: each new run (β, question, comparisons or
	// "Run again") plays from its first iteration. t is read untracked, once per new run.
	let startedAt = $state(0);
	$effect(() => {
		if (!run) return;
		untrack(() => (startedAt = t));
	});
	const frame = $derived.by(() => {
		if (!run) return 0;
		const u = reduced ? 1 : Math.min(1, Math.max(0, t - startedAt) / RUN_SECONDS);
		return Math.round(u * (run.pis.length - 1));
	});
	const pgPi = $derived(run ? run.pis[frame] : exact);

	const exactT = Tween.of(() => exact, { duration: 700, easing: cubicInOut });
	const shown = $derived(
		pg ? pgPi : reduced || exactT.current.length !== exact.length ? exact : exactT.current
	);

	const CH = { x: 96, y: 52, w: 830, h: 330 };
	const bw = CH.w / 64;
	const sqrtScale = scale([0, 1], [CH.y + CH.h, CH.y]);
	const yOf = (p: number) => sqrtScale(Math.sqrt(Math.max(0, p)));
	const fakeY = scale([0, 1], [CH.y + CH.h, CH.y]);
	const ticks = [0, 1 / 64, 0.1, 0.25, 0.5, 1];
	const bars = $derived(
		order.map((i, k) => ({
			i,
			x: CH.x + k * bw,
			p: shown[i],
			q: exact[i],
			color: scoreColor(prompt.answers[i].score)
		}))
	);

	const klNow = $derived(kl(shown));
	const proxy = $derived(expect(shown, r) - expect(new Array(64).fill(1 / 64), r));
	const gold = $derived(expect(shown, scores));
	const base = $derived(scores.reduce((a, b) => a + b, 0) / 64);
	const top = $derived(
		shown
			.map((p, i) => ({ p, i }))
			.sort((a, b) => b.p - a.p)
			.slice(0, 2)
	);
	const dist = $derived(tv(shown, exact));
	const iter = $derived(run ? run.iters[frame] : 0);
</script>

<g>
	<Axes
		sx={scale([0, 64], [CH.x, CH.x + CH.w])}
		sy={fakeY}
		xTicks={[]}
		yTicks={ticks.map(Math.sqrt)}
		yFormat={(v) => {
			const p = v * v;
			return p === 0 ? '0' : Math.abs(p - 1 / 64) < 1e-9 ? '1/64' : pct(p);
		}}
		yLabel="probability (√ scale)"
		grid={false}
	/>
	<Label
		x={CH.x + CH.w}
		y={CH.y + CH.h + 22}
		text="the 64 answers, by the reward model's score →"
		size={12}
		muted
		anchor="end"
	/>
	<line
		x1={CH.x}
		x2={CH.x + CH.w}
		y1={yOf(1 / 64)}
		y2={yOf(1 / 64)}
		stroke="var(--rl-ref)"
		stroke-dasharray="5 4"
		stroke-width="1.2"
	/>
	<Readout id="ref" order={5} label="Dashed line" value="GPT-2's 1/64">
		<Label
			anchor="start"
			x={CH.x + 8}
			y={yOf(1 / 64) - 8}
			text="GPT-2: 1/64 each"
			size={11}
			muted
		/>
	</Readout>
	{#each bars as b (b.i)}
		<rect
			x={b.x + 1}
			y={yOf(b.p)}
			width={bw - 2}
			height={CH.y + CH.h - yOf(b.p)}
			fill={b.color}
			fill-opacity="0.9"
		/>
		{#if pg}
			<rect
				x={b.x + 0.5}
				y={yOf(b.q)}
				width={bw - 1}
				height={CH.y + CH.h - yOf(b.q)}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1"
				stroke-dasharray="2 2"
			/>
		{/if}
	{/each}

	<!-- read-outs -->
	<g transform="translate(24 430)">
		<Readout id="beta" order={1} label="β" value={fmtBeta(beta)}>
			<Label anchor="start" x={0} y={0} text="β = {fmtBeta(beta)}" size={16} weight={700} tabular />
		</Readout>
		<Readout id="kl" order={2} label="KL(π ‖ π_ref)" value="{klNow.toFixed(2)} nats">
			<Label
				anchor="start"
				x={0}
				y={26}
				text="KL from GPT-2: {klNow.toFixed(2)} nats (at most 4.16)"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="proxy"
			order={3}
			label="Reward model, vs GPT-2"
			value="{proxy >= 0 ? '+' : ''}{num(proxy, 2)}"
			color="var(--rl-reward)"
		>
			<Label
				anchor="start"
				x={0}
				y={50}
				text="reward model's score: {proxy >= 0 ? '+' : ''}{num(proxy, 2)} over GPT-2"
				size={13}
				color="var(--rl-reward)"
				tabular
			/>
		</Readout>
		<Readout
			id="gold"
			order={4}
			label="Rater's average score"
			value="{gold.toFixed(2)} (GPT-2 {base.toFixed(2)})"
			color="var(--rl-gold)"
		>
			<Label
				anchor="start"
				x={0}
				y={74}
				text="rater's average score: {gold.toFixed(2)} (GPT-2: {base.toFixed(2)})"
				size={13}
				color="var(--rl-gold)"
				tabular
			/>
		</Readout>
		{#if pg}
			<Readout
				id="iter"
				order={6}
				label="Policy gradient"
				value="step {iter} of {ITERS}, {pct(dist)} from the optimum"
				note="total-variation distance"
			>
				<Label
					anchor="start"
					x={0}
					y={104}
					text="policy gradient: step {iter} of {ITERS}"
					size={12}
					color="var(--rl-pg)"
					tabular
				/>
				<Label
					anchor="start"
					x={0}
					y={122}
					text="total-variation distance to the exact optimum: {pct(dist)}"
					size={12}
					color="var(--rl-pg)"
					tabular
				/>
			</Readout>
		{/if}
	</g>

	<Readout id="topk">
		<Label anchor="start" x={460} y={430} text="Most likely answers now" size={13} weight={600} />
		{#each top as a, k (a.i)}
			{@const y = 452 + k * 60}
			<rect x="460" y={y - 4} width="6" height="48" rx="3" fill={scoreColor(scores[a.i])} />
			{#each wrap(prompt.answers[a.i].text, 62, 2) as line, j (j)}
				<Label anchor="start" x={476} y={y + 10 + j * 17} text={line} size={12} halo={false} />
			{/each}
			<Label
				x={936}
				y={y + 44}
				text="{pct(a.p)} · rater {num(scores[a.i], 0)}"
				size={11}
				anchor="end"
				muted
				tabular
			/>
		{/each}
	</Readout>
</g>
