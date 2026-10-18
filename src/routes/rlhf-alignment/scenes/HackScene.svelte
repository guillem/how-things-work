<script lang="ts">
	/**
	 * Over-optimisation: as β falls from 10 to 0.01 the exact optimum moves away from GPT-2 (KL
	 * across). The reward model's expected score (dashed, right axis, relative to GPT-2's) only
	 * rises; the rater's expected score (solid, left axis) rises, peaks and falls when the policy
	 * piles onto answers the reward model over-rates. The marker is the slider's β; the cards on
	 * the right are the policy's most likely answers there.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { expect, kl, overoptimisation, tilt } from '../rlhf';
	import { books, rateMore, restart, rewardsOf } from '../store.svelte';
	import { onPress, presses } from './actions.svelte';
	import { betaOf, fmtBeta, num, pct, promptOf, scoreColor, wrap } from './shared';

	let { params, t, reduced }: StageProps = $props();

	const prompt = $derived(promptOf(params));
	const id = $derived(prompt.id);
	const r = $derived(rewardsOf(id));
	const scores = $derived(prompt.answers.map((a) => a.score));
	const book = $derived(books[id]);

	onPress(
		() => presses(params.rate),
		() => rateMore(id)
	);
	onPress(
		() => presses(params.restart),
		() => restart(id)
	);

	const r0 = $derived(r.reduce((a, b) => a + b, 0) / 64);
	const curve = $derived(overoptimisation(r, scores));
	const base = $derived(scores.reduce((a, b) => a + b, 0) / 64);
	const peak = $derived(curve.reduce((a, b) => (b.gold > a.gold ? b : a)));

	const CH = { x: 90, y: 56, w: 500, h: 420 };
	const sx = scale([0, 4.2], [CH.x, CH.x + CH.w]);
	const gLo = $derived(Math.min(-1, Math.floor(Math.min(...curve.map((c) => c.gold)))));
	const gHi = $derived(Math.max(...scores));
	const sy = $derived(scale([gLo, gHi], [CH.y + CH.h, CH.y]));
	const pHi = $derived(Math.max(1, Math.ceil(Math.max(...curve.map((c) => c.proxy - r0)))));
	const sp = $derived(scale([0, pHi], [CH.y + CH.h, CH.y]));
	const goldPath = $derived(
		linePath(
			curve,
			(c) => c.kl,
			(c) => c.gold,
			sx,
			sy
		)
	);
	const proxyPath = $derived(
		linePath(
			curve,
			(c) => c.kl,
			(c) => c.proxy - r0,
			sx,
			sp
		)
	);

	const beta = $derived(betaOf(params));
	const pi = $derived(tilt(r, beta));
	const now = $derived({ kl: kl(pi), gold: expect(pi, scores), proxy: expect(pi, r) - r0 });
	// a short pulse on the marker, so the frame reads as live; none under reduced motion
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 3));
	const top = $derived(
		pi
			.map((p, i) => ({ p, i }))
			.sort((a, b) => b.p - a.p)
			.slice(0, 3)
	);
	const goldTicks = $derived(Array.from({ length: gHi - gLo + 1 }, (_, k) => gLo + k));
</script>

<g>
	<Axes
		{sx}
		{sy}
		xLabel="KL from GPT-2 (nats)"
		yLabel="rater's average score"
		xTicks={[0, 1, 2, 3, 4]}
		yTicks={goldTicks}
		yFormat={(v: number) => num(v, 0)}
	/>
	<Axes {sx} sy={sp} yRight xTicks={[]} yLabel="reward model" grid={false} />
	<line
		x1={CH.x}
		x2={CH.x + CH.w}
		y1={sy(base)}
		y2={sy(base)}
		stroke="var(--rl-ref)"
		stroke-dasharray="5 4"
	/>
	<Readout id="base">
		<Label
			anchor="start"
			x={CH.x + 8}
			y={sy(base) + 16}
			text="GPT-2: {base.toFixed(2)}"
			size={11}
			muted
		/>
	</Readout>
	<path
		d={proxyPath}
		fill="none"
		stroke="var(--rl-reward)"
		stroke-width="2.5"
		stroke-dasharray="7 4"
	/>
	<path d={goldPath} fill="none" stroke="var(--rl-gold)" stroke-width="3" />
	<circle cx={sx(peak.kl)} cy={sy(peak.gold)} r="4" fill="var(--rl-gold)" />
	<Readout
		id="peak"
		order={3}
		label="Rater's best"
		value="{peak.gold.toFixed(2)} at β ≈ {fmtBeta(peak.beta)}"
	>
		<Label
			x={Math.min(sx(peak.kl), CH.x + CH.w - 10)}
			y={sy(peak.gold) - 12}
			text="peak {peak.gold.toFixed(2)} at β ≈ {fmtBeta(peak.beta)}"
			size={11}
			anchor={sx(peak.kl) > CH.x + CH.w - 120 ? 'end' : 'middle'}
			color="var(--rl-gold)"
		/>
	</Readout>

	<!-- the slider's β -->
	<line
		x1={sx(now.kl)}
		x2={sx(now.kl)}
		y1={CH.y}
		y2={CH.y + CH.h}
		stroke="var(--stage-ink)"
		stroke-opacity="0.35"
	/>
	<circle cx={sx(now.kl)} cy={sp(now.proxy)} r={6 + 2 * pulse} fill="var(--rl-reward)" />
	<circle cx={sx(now.kl)} cy={sy(now.gold)} r={6 + 2 * pulse} fill="var(--rl-gold)" />

	<Label
		anchor="end"
		x={CH.x + CH.w - 12}
		y={CH.y + CH.h - 34}
		text="— rater's score"
		size={12}
		color="var(--rl-gold)"
		weight={600}
	/>
	<Label
		anchor="end"
		x={CH.x + CH.w - 12}
		y={CH.y + CH.h - 14}
		text="- - reward model's score"
		size={12}
		color="var(--rl-reward)"
		weight={600}
	/>

	<g transform="translate(660 64)">
		<Readout id="beta" order={1} label="β" value="{fmtBeta(beta)} · KL {now.kl.toFixed(2)}">
			<Label
				anchor="start"
				x={0}
				y={0}
				text="β = {fmtBeta(beta)} · KL {now.kl.toFixed(2)} nats"
				size={15}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout
			id="now"
			order={2}
			label="Here"
			value="rater {now.gold.toFixed(2)}, reward model +{num(now.proxy, 2)}"
		>
			<Label
				anchor="start"
				x={0}
				y={22}
				text="rater {now.gold.toFixed(2)} · reward model {now.proxy >= 0 ? '+' : ''}{num(
					now.proxy,
					2
				)}"
				size={12}
				tabular
			/>
		</Readout>
		<Label
			anchor="start"
			x={0}
			y={56}
			text="The policy's most likely answers"
			size={13}
			weight={600}
		/>
		{#each top as a, k (a.i)}
			{@const y = 70 + k * 112}
			<rect
				x="0"
				{y}
				width="276"
				height="100"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect x="0" {y} width="6" height="100" rx="3" fill={scoreColor(scores[a.i])} />
			<Readout
				id="top{k}"
				order={4 + k}
				label="Most likely answer"
				value="{prompt.answers[a.i].text} ({pct(a.p)}, rater {num(scores[a.i], 0)})"
				opacity={k === 0 ? 1 : 0}
			>
				{#each wrap(prompt.answers[a.i].text, 36, 3) as line, j (j)}
					<Label anchor="start" x={16} y={y + 22 + j * 19} text={line} size={12} halo={false} />
				{/each}
			</Readout>
			<Label
				anchor="start"
				x={16}
				y={y + 88}
				text={pct(a.p)}
				size={12}
				weight={700}
				halo={false}
				tabular
			/>
			<Label
				x={264}
				y={y + 88}
				text="rater {num(scores[a.i], 0)} · r {num(r[a.i] - r0, 1)}"
				size={11}
				anchor="end"
				color={scoreColor(scores[a.i])}
				halo={false}
				tabular
			/>
		{/each}
		<Readout id="n">
			<Label
				anchor="start"
				x={0}
				y={420}
				text="{book.comparisons.length} comparisons"
				size={11}
				muted
				tabular
			/>
		</Readout>
	</g>
</g>
