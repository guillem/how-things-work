<script lang="ts">
	/**
	 * A sketch (not a model) of how a text prompt conditions an image diffusion model: the prompt
	 * is split into tokens, a transformer text encoder turns them into one embedding vector each,
	 * and at every denoising step the image network reads them through cross-attention. The
	 * attention lines pulse in turn (pure function of t; still under reduced motion).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { gaussian } from '../ddpm';
	import { imageUrl } from './shared';

	let { t, reduced, dark }: StageProps = $props();

	const TOKENS = ['a', 'red', 'fox', 'in', 'the', 'snow'];
	const TX = (i: number) => 64 + i * 92;
	const bars = TOKENS.map((_, i) => {
		const g = gaussian(40 + i);
		return Array.from({ length: 8 }, () => g());
	});
	const noise = (() => {
		const g = gaussian(9);
		return Float32Array.from({ length: 28 * 28 }, () => g() * 0.9);
	})();
	const half = (() => {
		const g = gaussian(10);
		return Float32Array.from({ length: 28 * 28 }, (_, i) => g() * 0.45 + noise[i] * 0.1);
	})();
	const noiseUrl = $derived(imageUrl(noise, dark));
	const halfUrl = $derived(imageUrl(half, dark));
	const lit = $derived(reduced ? 2 : Math.floor(t / 0.9) % TOKENS.length);
	const NET = { x: 300, y: 330, w: 300, h: 110 };
</script>

<g>
	<Readout
		id="p-note"
		order={1}
		label="Sketch"
		value="how text-to-image models are built; not a model running here"
	>
		<Label
			x={480}
			y={44}
			size={14}
			pill
			text="a sketch of the design, not a model running on this page"
		/>
	</Readout>
	<Readout id="p-prompt" order={2} label="Prompt" value="“a red fox in the snow”">
		<Label
			x={40}
			y={92}
			anchor="start"
			size={14}
			weight={600}
			text="prompt: “a red fox in the snow”"
		/>
	</Readout>
	{#each TOKENS as tok, i (i)}
		<rect
			x={TX(i) - 36}
			y={110}
			width={72}
			height={30}
			rx="6"
			fill="var(--surface)"
			stroke={i === lit ? 'var(--dm-guess)' : 'var(--border)'}
			stroke-width="1.5"
		/>
		<Label x={TX(i)} y={130} size={13} text={tok} />
	{/each}
	<rect
		x={40}
		y={162}
		width={530}
		height={40}
		rx="8"
		fill="var(--surface)"
		stroke="var(--dm-guess)"
		stroke-width="1.5"
	/>
	<Readout
		id="p-enc"
		order={3}
		label="Text encoder"
		value="a transformer: one embedding vector per token"
	>
		<Label x={305} y={187} size={13} weight={600} text="text encoder (a transformer)" />
	</Readout>
	{#each bars as b, i (i)}
		{#each b as v, j (j)}
			<rect
				x={TX(i) - 28 + j * 7}
				y={v >= 0 ? 252 - Math.min(26, v * 12) : 252}
				width="5"
				height={Math.min(26, Math.abs(v) * 12)}
				fill={v >= 0 ? 'var(--dm-lower)' : 'var(--dm-upper)'}
				opacity={i === lit ? 0.95 : 0.55}
			/>
		{/each}
	{/each}
	<Readout id="p-emb">
		<Label x={600} y={256} anchor="start" size={12} muted text="one embedding per token" />
	</Readout>
	<!-- cross-attention lines -->
	{#each TOKENS.keys() as i (i)}
		<path
			d="M {TX(i)} 284 C {TX(i)} 310, {NET.x + 40 + i * 44} 300, {NET.x + 40 + i * 44} {NET.y}"
			fill="none"
			stroke="var(--dm-guess)"
			stroke-width={i === lit ? 2.5 : 1}
			opacity={i === lit ? 0.9 : 0.35}
		/>
	{/each}
	<!-- the denoising loop -->
	<image href={noiseUrl} x={60} y={NET.y - 5} width={120} height={120} class="dm-px" />
	<Label x={120} y={NET.y + 136} size={12} muted text="pure noise" />
	<path
		d="M 190 {NET.y + 55} H {NET.x - 8}"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<rect
		x={NET.x}
		y={NET.y}
		width={NET.w}
		height={NET.h}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	<Readout
		id="p-net"
		order={4}
		label="Image network"
		value="denoises, reading the prompt by cross-attention at every step"
	>
		<Label
			x={NET.x + NET.w / 2}
			y={NET.y + 48}
			size={13}
			weight={600}
			text="image network (U-Net or transformer)"
		/>
		<Label
			x={NET.x + NET.w / 2}
			y={NET.y + 72}
			size={12}
			muted
			text="cross-attention: each region asks the words"
		/>
	</Readout>
	<path
		d="M {NET.x + NET.w + 8} {NET.y + 55} H 682"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<image
		href={halfUrl}
		x={690}
		y={NET.y - 5}
		width={120}
		height={120}
		class="dm-px"
		opacity="0.9"
	/>
	<Label x={750} y={NET.y + 136} size={12} muted text="a little less noise" />
	<path
		d="M 750 {NET.y + 150} C 750 {NET.y + 200}, {NET.x + NET.w / 2} {NET.y + 200}, {NET.x +
			NET.w / 2} {NET.y + NET.h + 8}"
		fill="none"
		stroke="var(--dm-signal)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<Readout
		id="p-loop"
		order={5}
		label="Repeat"
		value="20 to 50 steps (or 1,000), then decode the image"
	>
		<Label
			x={600}
			y={NET.y + 206}
			size={12}
			color="var(--dm-signal)"
			text="repeat: 20–50 steps with a modern sampler"
		/>
	</Readout>
</g>

<style>
	.dm-px {
		image-rendering: pixelated;
	}
</style>
