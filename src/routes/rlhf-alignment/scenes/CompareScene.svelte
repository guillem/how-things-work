<script lang="ts">
	/**
	 * Comparisons and the reward model fitted to them.
	 * - pair: two of GPT-2's answers to click (the better one joins the book of comparisons), the
	 *   Bradley–Terry curve σ(r(A) − r(B)) with the pair's place on it by the current reward model,
	 *   and what the stand-in rater would have said about the reader's last choice.
	 * - fit: every answer as a dot, the rater's true score across and the reward model's up, the
	 *   correlation between them, and the reward model's favourites; the buttons add the rater's
	 *   comparisons, throw them all away, or go back to the first 100.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, hash, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { comparisonLoss, correlation, RATER_SCALE, sigmoid } from '../rlhf';
	import { books, choose, clear, rateMore, restart, rewardsOf, skip } from '../store.svelte';
	import { onPress, presses } from './actions.svelte';
	import { num, pct, promptOf, scoreColor, wrap } from './shared';

	let { step, params, reduced }: StageProps = $props();

	const prompt = $derived(promptOf(params));
	const id = $derived(prompt.id);
	const fit = $derived(step.hints?.mode === 'fit');
	const book = $derived(books[id]);
	const r = $derived(rewardsOf(id));
	const scores = $derived(prompt.answers.map((a) => a.score));

	onPress(
		() => presses(params.rate),
		() => rateMore(id)
	);
	onPress(
		() => presses(params.forget),
		() => clear(id)
	);
	onPress(
		() => presses(params.restart),
		() => restart(id)
	);

	// ---- pair
	const pair = $derived(book.pair);
	const cards = $derived(
		pair.map((i, k) => ({
			i,
			k,
			x: k === 0 ? 24 : 492,
			lines: wrap(prompt.answers[i].text, 54, 5)
		}))
	);
	let last: { win: number; lose: number; id: string } | null = $state(null);
	function pick(i: number) {
		const [a, b] = pair;
		last = { win: i, lose: i === a ? b : a, id };
		choose(id, i);
	}
	function onkey(e: KeyboardEvent, run: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			run();
		}
	}
	const lastNote = $derived.by(() => {
		if (!last || last.id !== id) return null;
		const p = sigmoid(RATER_SCALE * (scores[last.win] - scores[last.lose]));
		return `You preferred #${last.win + 1} to #${last.lose + 1}; the rater would pick it ${pct(p)} of the time.`;
	});

	const BT = { x: 96, y: 392, w: 380, h: 156 };
	const bx = scale([-6, 6], [BT.x, BT.x + BT.w]);
	const by = scale([0, 1], [BT.y + BT.h, BT.y]);
	const sigPath = linePath(
		Array.from({ length: 61 }, (_, i) => -6 + i * 0.2),
		(d) => d,
		(d) => sigmoid(d),
		bx,
		by
	);
	const diff = $derived(Math.max(-6, Math.min(6, r[pair[0]] - r[pair[1]])));
	const diffT = Tween.of(() => diff, { duration: 600, easing: cubicInOut });
	const shownDiff = $derived(reduced ? diff : diffT.current);

	// ---- fit
	const SC = { x: 96, y: 112, w: 500, h: 400 };
	const sMin = $derived(Math.min(...scores));
	const sMax = $derived(Math.max(...scores));
	const sx = $derived(scale([sMin - 0.6, sMax + 0.6], [SC.x, SC.x + SC.w]));
	const rLo = $derived(Math.min(...r));
	const rHi = $derived(Math.max(...r));
	const span = $derived(Math.max(rHi - rLo, 1));
	const yLo = $derived(Math.floor(rLo - 0.1 * span));
	const yHi = $derived(Math.ceil(rHi + 0.1 * span));
	const yLoT = Tween.of(() => yLo, { duration: 700, easing: cubicInOut });
	const yHiT = Tween.of(() => yHi, { duration: 700, easing: cubicInOut });
	const sy = $derived(
		scale(reduced ? [yLo, yHi] : [yLoT.current, yHiT.current], [SC.y + SC.h, SC.y])
	);
	const rT = Tween.of(() => r, { duration: 700, easing: cubicInOut });
	const rShown = $derived(reduced || rT.current.length !== r.length ? r : rT.current);
	const dots = $derived(
		prompt.answers.map((a, i) => ({
			i,
			x: sx(a.score) + (hash(i, 7) - 0.5) * 44,
			y: sy(rShown[i]),
			color: scoreColor(a.score)
		}))
	);
	const corr = $derived(correlation(r, scores));
	const loss = $derived(comparisonLoss(r, book.comparisons));
	const favourites = $derived(
		r
			.map((v, i) => ({ v, i }))
			.sort((a, b) => b.v - a.v)
			.slice(0, 3)
			.map((f) => ({ ...f, a: prompt.answers[f.i], lines: wrap(prompt.answers[f.i].text, 38, 3) }))
	);
	const total = $derived(book.comparisons.length);
	const countText = $derived(
		`${total - book.mine} by the rater${book.mine ? `, ${book.mine} by you` : ''}`
	);
	const xTicks = $derived(Array.from({ length: sMax - sMin + 1 }, (_, k) => sMin + k));
</script>

<g>
	{#if !fit}
		<Label
			anchor="start"
			x={24}
			y={40}
			text="Q: {prompt.question}  Which answer is better?"
			size={15}
			weight={600}
		/>
		{#each cards as c (c.k)}
			<g
				class="card"
				role="button"
				tabindex="0"
				aria-label="Prefer answer #{c.i + 1}: {prompt.answers[c.i].text}"
				transform="translate({c.x} 60)"
				onclick={() => pick(c.i)}
				onkeydown={(e) => onkey(e, () => pick(c.i))}
			>
				<rect class="ring" x="-4" y="-4" width="452" height="232" rx="14" />
				<rect width="444" height="224" rx="10" fill="var(--surface)" stroke="var(--border)" />
				<Label
					anchor="start"
					x={16}
					y={26}
					text="#{c.i + 1}"
					size={12}
					muted
					halo={false}
					tabular
				/>
				<Readout
					id="card{c.k}"
					order={c.k}
					label="{c.k === 0 ? 'Left' : 'Right'} (#{c.i + 1}): tap the card"
					value={prompt.answers[c.i].text}
				>
					{#each c.lines as line, j (j)}
						<Label anchor="start" x={16} y={56 + j * 22} text={line} size={14} halo={false} />
					{/each}
				</Readout>
				<rect x="300" y="182" width="128" height="30" rx="15" fill="var(--rl-policy)" />
				<Label
					x={364}
					y={202}
					text="This one ✓"
					size={13}
					weight={600}
					anchor="middle"
					color="#fff"
					halo={false}
				/>
			</g>
		{/each}
		<g
			class="card"
			role="button"
			tabindex="0"
			aria-label="Skip this pair"
			onclick={() => skip(id)}
			onkeydown={(e) => onkey(e, () => skip(id))}
		>
			<rect class="ring" x="416" y="296" width="128" height="38" rx="19" />
			<rect
				x="420"
				y="300"
				width="120"
				height="30"
				rx="15"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label x={480} y={320} text="Skip pair →" size={13} anchor="middle" halo={false} />
		</g>

		<!-- the Bradley–Terry curve -->
		<Axes
			sx={bx}
			sy={by}
			xLabel="r(left) − r(right)"
			yLabel="P(left preferred)"
			xTicks={[-6, -4, -2, 0, 2, 4, 6]}
			yTicks={[0, 0.5, 1]}
		/>
		<path d={sigPath} fill="none" stroke="var(--rl-reward)" stroke-width="2.5" />
		<line
			x1={bx(shownDiff)}
			x2={bx(shownDiff)}
			y1={BT.y + BT.h}
			y2={by(sigmoid(shownDiff))}
			stroke="var(--rl-reward)"
			stroke-dasharray="3 3"
		/>
		<circle cx={bx(shownDiff)} cy={by(sigmoid(shownDiff))} r="6" fill="var(--rl-reward)" />
		<Readout id="bt">
			<Label
				anchor="start"
				x={BT.x}
				y={BT.y - 40}
				text="P(a ≻ b) = σ(r(a) − r(b))"
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout
			id="pairp"
			order={2}
			label="Reward model on this pair"
			value="{pct(sigmoid(diff))} for the left one"
		>
			<Label
				x={BT.x + BT.w}
				y={BT.y - 40}
				text="reward model: {pct(sigmoid(diff))} for the left one"
				size={12}
				anchor="end"
				color="var(--rl-reward)"
			/>
		</Readout>

		<Readout id="count" order={3} label="Comparisons" value={countText}>
			<Label
				anchor="start"
				x={560}
				y={400}
				text="Comparisons for this question"
				size={13}
				weight={600}
			/>
			<Label anchor="start" x={560} y={422} text={countText} size={13} tabular />
		</Readout>
		{#if lastNote}
			<Readout id="last" order={4} label="Your last choice" value={lastNote}>
				{#each wrap(lastNote, 50, 3) as line, j (j)}
					<Label anchor="start" x={560} y={464 + j * 19} text={line} size={12} muted />
				{/each}
			</Readout>
		{:else}
			<Readout id="hint">
				<Label
					anchor="start"
					x={560}
					y={464}
					text="Click the better answer, or press Tab"
					size={12}
					muted
				/>
				<Label
					anchor="start"
					x={560}
					y={483}
					text="and Enter to choose with the keyboard."
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{:else}
		<!-- the reward model against the rater -->
		<Axes
			{sx}
			{sy}
			xLabel="rater's score"
			yLabel="reward model's r(y)"
			{xTicks}
			xFormat={(v: number) => num(v, 0)}
			yFormat={(v: number) => num(v, 0)}
		/>
		{#each dots as d (d.i)}
			<circle
				cx={d.x}
				cy={d.y}
				r="5.5"
				fill={d.color}
				fill-opacity="0.85"
				stroke="var(--stage-bg)"
				stroke-width="1"
			/>
		{/each}
		<Readout id="corr" order={1} label="Correlation with the rater" value={corr.toFixed(2)}>
			<Label
				anchor="start"
				x={SC.x + 12}
				y={30}
				text="correlation {corr.toFixed(2)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="ncomp" order={2} label="Comparisons" value={countText}>
			<Label
				anchor="start"
				x={SC.x + 12}
				y={52}
				text="{total} comparisons ({countText})"
				size={12}
				muted
				tabular
			/>
		</Readout>
		<Readout id="loss" order={3} label="Logistic loss" value={loss.toFixed(3)}>
			<Label
				anchor="start"
				x={SC.x + 12}
				y={71}
				text="logistic loss {loss.toFixed(3)} (ln 2 = 0.693 is a coin toss)"
				size={12}
				muted
				tabular
			/>
		</Readout>

		<Label
			anchor="start"
			x={640}
			y={64}
			text="The reward model's favourites"
			size={13}
			weight={600}
		/>
		{#each favourites as f, k (f.i)}
			{@const y = 80 + k * 118}
			<rect
				x="640"
				{y}
				width="296"
				height="106"
				rx="8"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect x="640" {y} width="6" height="106" rx="3" fill={scoreColor(f.a.score)} />
			{#each f.lines as line, j (j)}
				<Label anchor="start" x={656} y={y + 22 + j * 19} text={line} size={12} halo={false} />
			{/each}
			<Label
				anchor="start"
				x={656}
				y={y + 94}
				text="r = {num(f.v, 1)}"
				size={11}
				color="var(--rl-reward)"
				halo={false}
				tabular
			/>
			<Label
				x={924}
				y={y + 94}
				text="rater: {num(f.a.score, 0)}"
				size={11}
				weight={700}
				anchor="end"
				color={scoreColor(f.a.score)}
				halo={false}
			/>
		{/each}
		{#if total === 0}
			<Readout
				id="empty"
				order={4}
				label="No comparisons"
				value="every answer gets the same reward"
			>
				<Label
					x={SC.x + SC.w / 2}
					y={SC.y + SC.h / 2 - 40}
					text="No comparisons yet: every answer gets the same reward"
					size={13}
					anchor="middle"
					pill
				/>
			</Readout>
		{/if}
	{/if}
</g>

<style>
	.card {
		cursor: pointer;
		outline: none;
	}
	.ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 2.5;
		opacity: 0;
	}
	.card:focus-visible .ring,
	.card:hover .ring {
		opacity: 1;
	}
</style>
