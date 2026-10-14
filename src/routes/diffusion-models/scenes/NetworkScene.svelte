<script lang="ts">
	/**
	 * The denoising network as a diagram: three inputs (noisy data, the step's sine–cosine code,
	 * the label's embedding), the input layer, residual blocks, the output guess; below, the
	 * training loop. Sizes come from the two trained models. Dots run along the arrows (pure
	 * function of t; none under reduced motion).
	 */
	import Label from './Label.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { paramCount } from '../ddpm';
	import { MOONS } from '../moons-model';
	import { int } from './shared';

	let { t, reduced }: StageProps = $props();

	const DIGITS = { D: 784, H: 512, E: 32, blocks: 3, classes: 10 };
	const nPlane = paramCount(MOONS);
	const nDigit = paramCount(DIGITS);

	const IN = [
		{
			id: 'x',
			y: 120,
			title: 'noisy data xₜ',
			sub: `${MOONS.D} or ${DIGITS.D} numbers`,
			c: 'var(--dm-point)'
		},
		{
			id: 't',
			y: 210,
			title: 'step t',
			sub: `sines, cosines: ${MOONS.E} or ${DIGITS.E}`,
			c: 'var(--dm-noise)'
		},
		{
			id: 'l',
			y: 300,
			title: 'label or “no label”',
			sub: `embedding: ${MOONS.E} or ${DIGITS.E}`,
			c: 'var(--dm-upper)'
		}
	];
	const BOX = { w: 190, h: 56 };
	const L = [
		{ id: 'in', x: 300, title: 'input layer' },
		{ id: 'b1', x: 420, title: 'block 1' },
		{ id: 'b2', x: 520, title: 'block 2' },
		{ id: 'bn', x: 620, title: '…' }
	];
	const OUT = { x: 740, y: 210 };
	const pulse = (u: number) => (reduced ? -1 : (t / 1.8 + u) % 1);
	const dots = $derived(
		IN.map((b, i) => {
			const p = pulse(i * 0.3);
			const x1 = 40 + BOX.w;
			const x2 = 300;
			return {
				id: b.id,
				x: x1 + (x2 - x1) * p,
				y: b.y + (210 - b.y) * p,
				o: p < 0 ? 0 : Math.sin(Math.PI * p)
			};
		})
	);
	const flow = $derived.by(() => {
		const p = pulse(0.5);
		return { x: 360 + (OUT.x - 360) * p, o: p < 0 ? 0 : Math.sin(Math.PI * p) };
	});

	const LOOP = [
		{ x: 40, text: 'real x₀' },
		{ x: 150, text: 'random t, ε' },
		{ x: 285, text: 'xₜ in one go' },
		{ x: 420, text: 'network → x̂₀' },
		{ x: 565, text: 'loss: how far x̂₀ is from x₀' },
		{ x: 800, text: 'backpropagation' }
	];
</script>

<g>
	<Readout id="n-title">
		<Label
			x={40}
			y={60}
			anchor="start"
			size={16}
			weight={650}
			text="The denoiser: (xₜ, t, label) → guess of the clean data x̂₀"
		/>
	</Readout>
	{#each IN as b (b.id)}
		<rect
			x={40}
			y={b.y - BOX.h / 2}
			width={BOX.w}
			height={BOX.h}
			rx="8"
			fill="var(--surface)"
			stroke={b.c}
			stroke-width="1.5"
		/>
		<Label x={52} y={b.y - 4} anchor="start" size={13} weight={600} text={b.title} />
		<Label x={52} y={b.y + 16} anchor="start" size={11} muted text={b.sub} />
		<path
			d="M{40 + BOX.w} {b.y} L 300 210"
			stroke="var(--stage-line)"
			stroke-width="1.5"
			fill="none"
		/>
	{/each}
	{#each dots as d (d.id)}
		<circle cx={d.x} cy={d.y} r="4" fill="var(--dm-guess)" opacity={d.o} />
	{/each}
	<!-- the stack -->
	<path d="M 300 210 H {OUT.x}" stroke="var(--stage-line)" stroke-width="2.5" />
	{#each L as b (b.id)}
		<rect
			x={b.x}
			y={150}
			width={80}
			height={120}
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<Label x={b.x + 40} y={216} size={13} weight={600} text={b.title} />
		{#if b.id !== 'in' && b.id !== 'bn'}
			<path
				d="M {b.x - 10} 140 C {b.x + 10} 118, {b.x + 70} 118, {b.x + 90} 140"
				fill="none"
				stroke="var(--dm-signal)"
				stroke-width="1.5"
			/>
			<Label x={b.x + 40} y={112} size={11} color="var(--dm-signal)" text="+ correction" />
		{/if}
	{/each}
	<circle cx={flow.x} cy={210} r="5" fill="var(--dm-guess)" opacity={flow.o} />
	<rect
		x={OUT.x}
		y={OUT.y - 34}
		width={180}
		height={68}
		rx="8"
		fill="var(--surface)"
		stroke="var(--dm-guess)"
		stroke-width="2"
	/>
	<Label
		x={OUT.x + 12}
		y={OUT.y - 6}
		anchor="start"
		size={13}
		weight={600}
		color="var(--dm-guess)"
		text="guess x̂₀"
	/>
	<Label x={OUT.x + 12} y={OUT.y + 16} anchor="start" size={11} muted text="same size as xₜ" />
	<Readout
		id="n-eps"
		order={3}
		label="Same as guessing the noise"
		value="ε̂ = (xₜ − √ᾱₜ·x̂₀) / √(1 − ᾱₜ)"
	>
		<Label
			x={OUT.x + 90}
			y={OUT.y + 64}
			size={12}
			muted
			text="noise guess ε̂ = (xₜ − √ᾱₜ·x̂₀) / √(1 − ᾱₜ)"
		/>
	</Readout>

	<!-- the two trained models -->
	<Readout
		id="n-plane"
		order={1}
		label="Plane model"
		value="{int(nPlane)} weights · {MOONS.blocks} blocks of {MOONS.H}"
	>
		<Label
			x={300}
			y={312}
			anchor="start"
			size={13}
			text="plane: {int(nPlane)} weights, {MOONS.blocks} blocks of {MOONS.H}"
		/>
	</Readout>
	<Readout
		id="n-digit"
		order={2}
		label="Digit model"
		value="{int(nDigit)} weights · {DIGITS.blocks} blocks of {DIGITS.H}"
	>
		<Label
			x={300}
			y={334}
			anchor="start"
			size={13}
			text="digits: {int(nDigit)} weights, {DIGITS.blocks} blocks of {DIGITS.H}"
		/>
	</Readout>

	<!-- the training loop -->
	<rect
		x={24}
		y={400}
		width={912}
		height={166}
		rx="10"
		fill="none"
		stroke="var(--border)"
		stroke-dasharray="4 4"
	/>
	<Readout
		id="n-loop"
		order={4}
		label="Training, over and over"
		value="real x₀ → random t and ε → xₜ → x̂₀ → loss → backpropagation"
	>
		<Label x={40} y={428} anchor="start" size={13} weight={600} text="training, over and over:" />
		{#each LOOP as s, i (s.x)}
			<Label x={s.x} y={480} anchor="start" size={12} text={s.text} />
			{#if i < LOOP.length - 1}
				<path
					d="M {LOOP[i + 1].x - 26} 476 h 14"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
			{/if}
		{/each}
		<path
			d="M 850 494 C 850 530, 470 530, 470 498"
			fill="none"
			stroke="var(--dm-signal)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
		<Label x={660} y={552} size={11} color="var(--dm-signal)" text="nudge every weight" />
	</Readout>
</g>
