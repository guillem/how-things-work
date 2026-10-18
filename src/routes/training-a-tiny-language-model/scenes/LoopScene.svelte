<script lang="ts">
	/**
	 * The default model as a stack (characters in at the bottom, 65 probabilities out at the top)
	 * with the weights in each part, counted from the model's own layout, beside the training
	 * step: a forward pass up the stack, the loss, a backward pass down it, an update. A pulse
	 * travels up, then down, as a function of t (one cycle every 8 s); under reduced motion the
	 * four stages are all lit and no pulse is drawn.
	 */
	import { Label, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { layout } from '../tiny-gpt';
	import { configOf, DEFAULT, STEPS, TOKENS, batchOf, HEADS } from '../train';
	import { guesses, passage } from '../runs';
	import { int, pct, visible } from './shared';

	let { t, reduced }: StageProps = $props();

	const config = configOf(65, DEFAULT.width, DEFAULT.context);
	const L = layout(config);
	const sum = (prefix: string) =>
		L.slots.filter((s) => s.name.startsWith(prefix)).reduce((a, s) => a + s.size, 0);
	const emb = L.wte.size + L.wpe.size;
	const blocks = [0, 1].map((l) => ({
		attn: sum(`h${l}.attn`),
		mlp: sum(`h${l}.mlp`),
		all: sum(`h${l}.`)
	}));
	const readout = L.lnfg.size + L.lnfb.size + L.wout.size + L.bout.size;

	// ---- the cycle: forward 0–0.4, loss 0.4–0.5, backward 0.5–0.9, update 0.9–1
	const u = $derived(reduced ? -1 : cycle(t, 8));
	const stage = $derived(u < 0 ? -1 : u < 0.4 ? 0 : u < 0.5 ? 1 : u < 0.9 ? 2 : 3);
	const lit = (i: number) => (stage < 0 || stage === i ? 1 : 0.4);

	// the stack, bottom to top
	const SX = 40;
	const SW = 440;
	const IN_Y = 540;
	const boxes = [
		{ key: 'emb', y: 470, h: 44, title: 'token + position embeddings', w: emb, tone: 'emb' },
		{ key: 'b1', y: 360, h: 84, title: 'block 1', w: blocks[0].all, tone: 'block' },
		{ key: 'b2', y: 250, h: 84, title: 'block 2', w: blocks[1].all, tone: 'block' },
		{ key: 'out', y: 180, h: 44, title: 'layer norm + read-out', w: readout, tone: 'emb' }
	];
	const TOP = 112; // the probabilities
	const LOSS_Y = 64;
	// the pulse: up the stack while forward, down it while backward
	const pulseY = $derived.by(() => {
		if (u < 0) return null;
		if (u < 0.4) return IN_Y - smoothstep(0, 0.4, u) * (IN_Y - LOSS_Y);
		if (u >= 0.5 && u < 0.9) return LOSS_Y + smoothstep(0.5, 0.9, u) * (IN_Y - 20 - LOSS_Y);
		return null;
	});
	const pulseColor = $derived(u < 0.45 ? 'var(--ttlm-forward)' : 'var(--ttlm-backward)');
	const updateFlash = $derived(u >= 0.9 ? 1 - Math.abs((u - 0.95) / 0.05) : 0);

	const window = Array.from(passage).slice(-13, -1);
	// the trained model's four likeliest characters after this window (the last position)
	const last = guesses[guesses.length - 1];
	const probs = last.top[last.top.length - 1];

	const stages = [
		{
			title: '1  Forward',
			lines: [
				`${batchOf(DEFAULT.context)} windows of ${DEFAULT.context} characters go up the stack;`,
				`every position predicts its next character`
			]
		},
		{
			title: '2  Loss',
			lines: [`−ln p of each real next character,`, `averaged over all ${int(TOKENS)}`]
		},
		{
			title: '3  Backward',
			lines: [`the gradient: how the loss changes`, `with each of the ${int(L.total)} weights`]
		},
		{
			title: '4  Update',
			lines: [`AdamW moves every weight a little`, `downhill; repeat ${int(STEPS)} times`]
		}
	];
	const PX = 560;
	const PW = 384;
</script>

<g>
	<!-- the input characters -->
	{#each window as c, i (i)}
		<rect
			x={SX + 40 + i * 30}
			y={IN_Y}
			width="26"
			height="28"
			rx="4"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity={lit(0)}
		/>
		<text
			x={SX + 53 + i * 30}
			y={IN_Y + 19}
			text-anchor="middle"
			font-size="13"
			style:font-family="var(--font-mono)"
			opacity={lit(0)}>{visible(c)}</text
		>
	{/each}
	<Readout id="in">
		<Label
			x={SX + 40 + window.length * 30 + 8}
			y={IN_Y + 19}
			anchor="start"
			size={11}
			muted
			text="… the last {DEFAULT.context} characters"
		/>
	</Readout>

	<!-- the stack -->
	<line
		x1={SX + SW / 2}
		x2={SX + SW / 2}
		y1={IN_Y - 2}
		y2={LOSS_Y + 14}
		stroke="var(--stage-line)"
		stroke-width="2"
	/>
	{#each boxes as b (b.key)}
		<rect
			x={SX}
			y={b.y}
			width={SW}
			height={b.h}
			rx="8"
			fill={b.tone === 'block' ? 'var(--ttlm-block)' : 'var(--surface)'}
			stroke={updateFlash > 0 ? 'var(--ttlm-backward)' : 'var(--border)'}
			stroke-width={1 + 2 * updateFlash}
		/>
		<Label x={SX + 14} y={b.y + 22} anchor="start" size={13} weight={650} text={b.title} />
		<Label
			x={SX + SW - 14}
			y={b.y + 22}
			anchor="end"
			size={12}
			muted
			tabular
			text="{int(b.w)} weights"
		/>
		{#if b.tone === 'block'}
			{@const l = b.key === 'b1' ? 0 : 1}
			<rect
				x={SX + 14}
				y={b.y + 34}
				width={SW / 2 - 21}
				height="38"
				rx="6"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label x={SX + 24} y={b.y + 51} anchor="start" size={12} text="attention ({HEADS} heads)" />
			<Label
				x={SX + 24}
				y={b.y + 66}
				anchor="start"
				size={11}
				muted
				tabular
				text="{int(blocks[l].attn)} weights"
			/>
			<rect
				x={SX + SW / 2 + 7}
				y={b.y + 34}
				width={SW / 2 - 21}
				height="38"
				rx="6"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label x={SX + SW / 2 + 17} y={b.y + 51} anchor="start" size={12} text="MLP (4 × wider)" />
			<Label
				x={SX + SW / 2 + 17}
				y={b.y + 66}
				anchor="start"
				size={11}
				muted
				tabular
				text="{int(blocks[l].mlp)} weights"
			/>
		{/if}
	{/each}
	<!-- the probabilities of the 65 characters: the trained model's top four after this window -->
	{#each probs as [c, p], i (i)}
		<g opacity={lit(1)}>
			<Label x={SX + 30 + i * 66} y={TOP + 44} anchor="start" size={13} mono text={visible(c)} />
			<rect
				x={SX + 46 + i * 66}
				y={TOP + 44 - Math.max(1, p * 44)}
				width="14"
				height={Math.max(1, p * 44)}
				fill="var(--ttlm-bar)"
			/>
			<Label
				x={SX + 64 + i * 66}
				y={TOP + 44}
				anchor="start"
				size={11}
				muted
				tabular
				text={pct(p)}
			/>
		</g>
	{/each}
	<Label x={SX + SW - 14} y={TOP + 44} anchor="end" size={12} muted text="… of 65" />
	<rect
		x={SX + 60}
		y={LOSS_Y - 14}
		width={SW - 120}
		height="28"
		rx="14"
		fill="var(--surface)"
		stroke={stage === 1 ? 'var(--ttlm-train)' : 'var(--border)'}
		stroke-width={stage === 1 ? 2 : 1}
	/>
	<Label
		x={SX + SW / 2}
		y={LOSS_Y + 5}
		size={13}
		weight={650}
		color="var(--ttlm-train)"
		text="loss: average −ln p(next character)"
	/>

	{#if pulseY !== null}
		<circle cx={SX + SW / 2} cy={pulseY} r="7" fill={pulseColor} />
	{/if}

	<!-- the training step -->
	<Readout id="total" order={0} label="Weights" value={int(L.total)}>
		<Label
			x={PX}
			y={64}
			anchor="start"
			size={15}
			weight={650}
			text="One training step, {int(L.total)} weights"
		/>
	</Readout>
	{#each stages as s, i (i)}
		{@const y = 96 + i * 108}
		<g opacity={lit(i)}>
			<rect
				x={PX}
				{y}
				width={PW}
				height="88"
				rx="10"
				fill="var(--surface)"
				stroke={stage === i
					? i < 2
						? 'var(--ttlm-forward)'
						: 'var(--ttlm-backward)'
					: 'var(--border)'}
				stroke-width={stage === i ? 2 : 1}
			/>
			<Readout
				id="stage{i}"
				order={i + 1}
				label={s.title.replace(/^\d\s+/, '')}
				value={s.lines.join(' ')}
			>
				<Label x={PX + 16} y={y + 26} anchor="start" size={14} weight={650} text={s.title} />
				{#each s.lines as line, j (j)}
					<Label x={PX + 16} y={y + 50 + j * 18} anchor="start" size={12} text={line} />
				{/each}
			</Readout>
		</g>
	{/each}
</g>
