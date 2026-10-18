<script lang="ts">
	/**
	 * One held-out line of the play, read by the page's default model after a chosen number of
	 * training steps: under each character, the surprise −ln p the model had at it before seeing
	 * it (from the characters before it in the line), against the uniform guess's ln 65. The card
	 * shows the chosen position: the model's four likeliest next characters and the probability
	 * of the real one. Phase `predict` puts the card in focus, `average` the mean of the bars
	 * (the line's cross-entropy) and its perplexity.
	 */
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { guesses, passage } from '../runs';
	import { SAMPLE_STEPS } from '../train';
	import { int, nats, num, pct, visible } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'predict'));
	const chars = Array.from(passage);
	const N = chars.length - 1; // positions predicted: 1 … N
	const ckpt = $derived.by(() => {
		const v = num(params.ckpt, 0);
		return SAMPLE_STEPS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
	});
	const g = $derived(guesses.find((x) => x.step === ckpt) ?? guesses[0]);
	const pos = $derived(Math.max(1, Math.min(N, Math.round(num(params.pos, 9)))));
	const surprise = $derived(g.actual.map((p) => -Math.log(p)));
	const mean = $derived(surprise.reduce((a, b) => a + b, 0) / surprise.length);
	const UNIFORM = Math.log(65);

	// bars tween when the checkpoint changes
	const bars = new Tween<number[]>(
		untrack(() => surprise),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const v = surprise;
		const r = reduced;
		untrack(() => bars.set(v, { duration: r ? 0 : 700 }));
	});
	const meanT = Tween.of(() => mean, { duration: 700, easing: cubicInOut });

	// ---- layout
	const BOX = { x: 40, y: 64, w: 25, h: 36 };
	const bx = (i: number) => BOX.x + i * BOX.w;
	const CH = { y0: 318, perNat: 20 };
	const barY = (s: number) => CH.y0 - Math.min(8, s) * CH.perNat;
	const pulse = $derived(reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 3.2));

	const top = $derived(g.top[pos - 1]);
	const actualP = $derived(g.actual[pos - 1]);
	const target = $derived(chars[pos]);
	const inTop = $derived(top.some(([c]) => c === target));
	const before = $derived(chars.slice(0, pos).join('').replace(/\n/g, '↵').slice(-14));
	const CARD = { x: 40, y: 360, w: 880, h: 214 };
	const BAR = { x: 300, w: 440 };
	const focusCard = $derived(phase === 'predict' ? 1 : 0.55);
	const focusMean = $derived(phase === 'average' ? 1 : 0.5);
	const ckptLabel = $derived(
		ckpt === 0 ? 'untrained (random weights)' : `after ${int(ckpt)} steps`
	);

	function choose(i: number) {
		setParam('pos', i);
	}
</script>

<g>
	<Readout id="title" order={0} label="Model" value={ckptLabel}>
		<Label
			x={40}
			y={36}
			anchor="start"
			size={15}
			weight={650}
			text="A held-out line, read by the model {ckptLabel}"
		/>
	</Readout>

	<!-- the line, one box per character -->
	{#each chars as c, i (i)}
		{@const sel = i === pos}
		{@const ctx = i < pos}
		<g
			role="button"
			tabindex="-1"
			aria-label="character {i}"
			style:cursor={i > 0 ? 'pointer' : 'default'}
			onclick={() => i > 0 && choose(i)}
			onkeydown={() => {}}
		>
			<rect
				x={bx(i) + 1}
				y={BOX.y}
				width={BOX.w - 2}
				height={BOX.h}
				rx="4"
				fill={sel ? 'var(--ttlm-pick-bg)' : ctx ? 'var(--ttlm-context)' : 'var(--surface)'}
				stroke={sel ? 'var(--ttlm-pick)' : 'var(--border)'}
				stroke-width={sel ? 2 : 1}
				opacity={sel ? pulse * 0.4 + 0.6 : 1}
			/>
			<text
				x={bx(i) + BOX.w / 2}
				y={BOX.y + 24}
				text-anchor="middle"
				font-size="15"
				style:font-family="var(--font-mono)"
				style:fill={c === ' ' || c === '\n' ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}
				>{visible(c)}</text
			>
		</g>
	{/each}
	<Readout id="ctx-key">
		<Label
			x={40}
			y={122}
			anchor="start"
			size={11}
			muted
			text="shaded: what the model has read; outlined: the character it must guess"
		/>
	</Readout>

	<!-- surprise bars under the characters -->
	<g opacity={phase === 'average' ? 1 : 0.85}>
		<line x1={BOX.x} x2={bx(N + 1)} y1={CH.y0} y2={CH.y0} stroke="var(--stage-line)" />
		<line
			x1={BOX.x}
			x2={bx(N + 1)}
			y1={barY(UNIFORM)}
			y2={barY(UNIFORM)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 3"
		/>
		{#each bars.current as s, k (k)}
			{@const i = k + 1}
			<rect
				x={bx(i) + 5}
				y={barY(s)}
				width={BOX.w - 10}
				height={Math.max(0.5, CH.y0 - barY(s))}
				rx="2"
				fill={i === pos ? 'var(--ttlm-pick)' : 'var(--ttlm-val)'}
				opacity={i === pos ? 1 : 0.7}
				style:cursor="pointer"
				onclick={() => choose(i)}
				role="presentation"
			/>
		{/each}
		<g opacity={focusMean}>
			<line
				x1={BOX.x}
				x2={bx(N + 1)}
				y1={barY(meanT.current)}
				y2={barY(meanT.current)}
				stroke="var(--ttlm-train)"
				stroke-width="2.5"
			/>
		</g>
		<Readout id="uniform" order={4} label="Uniform guess" value="ln 65 = {nats(UNIFORM)} nats">
			<Label x={BOX.x - 6} y={barY(UNIFORM) + 4} anchor="end" size={11} muted text="ln 65" />
		</Readout>
		<Readout
			id="mean"
			order={3}
			label="Average surprise on this line"
			value="{nats(mean)} nats · perplexity {Math.exp(mean).toFixed(1)}"
			color="var(--ttlm-train)"
		>
			<Label
				x={bx(N + 1) + 6}
				y={barY(meanT.current) + 4}
				anchor="start"
				size={11}
				weight={650}
				color="var(--ttlm-train)"
				text="mean"
			/>
			<Label
				x={40}
				y={CH.y0 + 22}
				anchor="start"
				size={13}
				weight={phase === 'average' ? 650 : 500}
				tabular
				text="average surprise on this line: {nats(mean)} nats per character · perplexity e^{nats(
					mean
				)} = {Math.exp(mean).toFixed(1)}"
			/>
		</Readout>
		<Readout id="axis">
			<Label x={BOX.x - 6} y={barY(8) + 4} anchor="end" size={10} muted tabular text="8" />
			<Label x={BOX.x - 6} y={CH.y0 + 4} anchor="end" size={10} muted tabular text="0" />
			<Label
				x={BOX.x}
				y={barY(8) - 8}
				anchor="start"
				size={11}
				muted
				text="surprise at each character, −ln p (nats)"
			/>
		</Readout>
	</g>

	<!-- the card for the chosen position -->
	<g opacity={focusCard}>
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout id="after" order={1} label="After" value="“{before}”">
			<Label
				x={CARD.x + 20}
				y={CARD.y + 30}
				anchor="start"
				size={13}
				text="after “{before}” the model's four likeliest next characters:"
			/>
		</Readout>
		{#each top as [c, p], i (i)}
			{@const y = CARD.y + 52 + i * 30}
			{@const hit = c === target}
			<Label
				x={BAR.x - 16}
				y={y + 15}
				anchor="end"
				size={15}
				mono
				weight={hit ? 700 : 500}
				color={hit ? 'var(--ttlm-pick)' : undefined}
				text={visible(c)}
			/>
			<rect
				x={BAR.x}
				y={y + 2}
				width={Math.max(1, p * BAR.w)}
				height="18"
				rx="3"
				fill={hit ? 'var(--ttlm-pick)' : 'var(--ttlm-bar)'}
			/>
			<Label
				x={BAR.x + Math.max(1, p * BAR.w) + 8}
				y={y + 16}
				anchor="start"
				size={12}
				tabular
				text={pct(p)}
			/>
		{/each}
		<Readout
			id="actual"
			order={2}
			label="The real next character"
			value="“{visible(target)}”: p = {pct(actualP)}, surprise {nats(-Math.log(actualP))} nats"
			color="var(--ttlm-pick)"
		>
			<Label
				x={CARD.x + 20}
				y={CARD.y + 196}
				anchor="start"
				size={13}
				weight={650}
				color="var(--ttlm-pick)"
				tabular
				text="the real next character, “{visible(target)}”{inTop
					? ''
					: ' (not in the four)'}: p = {pct(actualP)}, surprise −ln p = {nats(
					-Math.log(actualP)
				)} nats"
			/>
		</Readout>
	</g>
</g>
