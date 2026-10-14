<script lang="ts">
	/**
	 * The whole network reading one digit. Left: a pad the reader draws on (with the mouse, a pen
	 * or a finger), or the chosen MNIST test digit. Then what the network sees (the 28 × 28
	 * input), the 8 pooled maps of the first layer, the 16 pooled maps of the second, and the ten
	 * probabilities of the softmax.
	 *
	 * The select whose value becomes 'drawn' when the reader starts drawing is `step.hints.select`
	 * ('digit' or 'wrong'). Small dots run along the arrows (pure function of t; none under
	 * reduced motion).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { startDrag, type Point } from '#lib/draw/index.ts';
	import { C1, C2, CLASSES, P1, P2, SIDE, forward } from '../cnn';
	import { SAMPLES } from '../mnist-cnn';
	import Txt from './Txt.svelte';
	import {
		WT,
		beginStroke,
		drawing,
		extendStroke,
		greyUrl,
		inputOf,
		maxAbs,
		samplePixels,
		signedUrl
	} from './shared';

	let { step, t, params, reduced, dark, setParam }: StageProps = $props();

	const select = $derived(String(step.hints?.select ?? 'digit'));
	const input = $derived(inputOf(params, select));
	const drawn = $derived(params[select] === 'drawn');
	const strokes = $derived(drawn ? drawing(params) : []);
	const act = $derived(input.empty ? null : forward(WT, input.img));

	const PAD = { x: 40, y: 84, s: 280 };
	const padUrl = $derived(
		!drawn && input.sample >= 0 ? greyUrl(samplePixels(input.sample), SIDE, SIDE, dark) : null
	);
	const inUrl = $derived(greyUrl(input.img, SIDE, SIDE, dark));
	const maps1 = $derived.by(() => {
		if (!act) return [];
		const sc = maxAbs(act.pool1) || 1;
		return Array.from({ length: C1 }, (_, c) =>
			signedUrl(act.pool1, P1, P1, sc, dark, c * P1 * P1)
		);
	});
	const maps2 = $derived.by(() => {
		if (!act) return [];
		const sc = maxAbs(act.pool2) || 1;
		return Array.from({ length: C2 }, (_, c) =>
			signedUrl(act.pool2, P2, P2, sc, dark, c * P2 * P2)
		);
	});

	const toPad = (p: Point) => ({
		x: Math.max(0, Math.min(1, (p.x - PAD.x) / PAD.s)),
		y: Math.max(0, Math.min(1, (p.y - PAD.y) / PAD.s))
	});
	function down(event: PointerEvent) {
		let first = true;
		startDrag(event, (p) => {
			if (first) {
				first = false;
				beginStroke(params, setParam, toPad(p), !drawn);
				if (!drawn) setParam(select, 'drawn');
			} else extendStroke(setParam, toPad(p));
		});
	}
	const paths = $derived(
		strokes.map((st, i) => ({
			key: i,
			d: st
				.map((p, j) => `${j ? 'L' : 'M'} ${PAD.x + p.x * PAD.s} ${PAD.y + p.y * PAD.s}`)
				.join(' ')
		}))
	);
	// the pen as drawn on the pad: about as wide, relative to the digit, as MNIST's strokes
	const PEN_W = 22;

	// ---- the probabilities ------------------------------------------------------------------
	const BAR = { x: 740, y: 96, h: 30, w: 150 };
	const probs = $derived(act ? act.probs : new Array<number>(CLASSES).fill(0));
	const top = $derived(act ? act.digit : -1);
	const pct = (p: number) =>
		p >= 0.995 ? '> 99%' : p < 0.005 ? '< 1%' : `${Math.round(p * 100)}%`;
	const verdict = $derived.by(() => {
		if (!act) return 'Draw a digit in the box';
		return `It reads ${top}, with probability ${pct(probs[top])}`;
	});
	const truth = $derived.by(() => {
		if (input.sample < 0)
			return params.centre === false && select === 'wrong'
				? 'your drawing, not centred or scaled'
				: 'your drawing, centred and scaled like MNIST';
		const s = SAMPLES[input.sample];
		return `MNIST test digit #${s.index}: a ${s.label}${s.label === top ? ' · right' : ' · wrong'}`;
	});

	// pulses along the arrows
	const ARROWS: [number, number, number, number][] = [
		[328, 224, 362, 160],
		[462, 160, 492, 200],
		[600, 200, 630, 200],
		[700, 200, 730, 240]
	];
	const pulses = $derived(
		reduced || !act
			? []
			: ARROWS.map(([x1, y1, x2, y2], i) => {
					const u = (t / 1.6 + i * 0.25) % 1;
					return { key: i, x: x1 + (x2 - x1) * u, y: y1 + (y2 - y1) * u, o: Math.sin(Math.PI * u) };
				})
	);
</script>

<g>
	<!-- the pad -->
	<Readout id="pd-title" order={1} label="Draw" value="in the box, with the mouse or a finger">
		<Txt x={PAD.x} y={PAD.y - 16} text="draw a digit here" size={14} weight={600} />
	</Readout>
	<rect
		x={PAD.x}
		y={PAD.y}
		width={PAD.s}
		height={PAD.s}
		rx="6"
		fill="var(--cv-pad)"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	{#if padUrl}
		<image
			href={padUrl}
			x={PAD.x + 4}
			y={PAD.y + 4}
			width={PAD.s - 8}
			height={PAD.s - 8}
			class="cv-px"
			opacity="0.9"
		/>
	{/if}
	{#each paths as p (p.key)}
		<path
			d={p.d}
			fill="none"
			stroke="var(--cv-pen)"
			stroke-width={PEN_W}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/each}
	{#if drawn && paths.length === 0}
		<Txt
			x={PAD.x + PAD.s / 2}
			y={PAD.y + PAD.s / 2}
			text="draw here"
			size={14}
			anchor="middle"
			muted
		/>
	{/if}
	<rect
		x={PAD.x}
		y={PAD.y}
		width={PAD.s}
		height={PAD.s}
		fill="transparent"
		class="cv-pad"
		role="img"
		aria-label="Drawing pad: draw a digit with the mouse or a finger"
		data-pad
		onpointerdown={down}
	/>
	<Readout id="pd-hint">
		<Txt
			x={PAD.x}
			y={PAD.y + PAD.s + 22}
			text={drawn ? 'Clear starts again' : 'a test digit: draw over it to start your own'}
			size={11}
			muted
		/>
	</Readout>

	<!-- what the network sees, and its layers -->
	<Txt x={362} y={84} text="the input" size={12} weight={600} />
	<image href={inUrl} x={362} y={96} width={100} height={100} class="cv-px" />
	<rect x={361} y={95} width={102} height={102} fill="none" stroke="var(--border)" />
	<Readout id="pd-sizes">
		<Txt x={362} y={212} text="28 × 28" size={11} muted />
		<Txt x={492} y={84} text="layer 1" size={12} weight={600} />
		<Txt x={492} y={316} text="8 × 14 × 14" size={11} muted />
		<Txt x={630} y={84} text="layer 2" size={12} weight={600} />
		<Txt x={630} y={340} text="16 × 7 × 7" size={11} muted />
	</Readout>
	{#each maps1 as url, c (c)}
		<image
			href={url}
			x={492 + (c % 2) * 54}
			y={96 + Math.floor(c / 2) * 54}
			width={48}
			height={48}
			class="cv-px"
		/>
		<rect
			x={491 + (c % 2) * 54}
			y={95 + Math.floor(c / 2) * 54}
			width={50}
			height={50}
			fill="none"
			stroke="var(--border)"
		/>
	{/each}
	{#each maps2 as url, c (c)}
		<image
			href={url}
			x={630 + (c % 2) * 36}
			y={96 + Math.floor(c / 2) * 29}
			width={26}
			height={26}
			class="cv-px"
		/>
	{/each}
	{#each ARROWS as [x1, y1, x2, y2], i (i)}
		<path
			d="M {x1} {y1} L {x2} {y2}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.3"
			marker-end="url(#arrowhead)"
			opacity="0.7"
		/>
	{/each}
	{#each pulses as p (p.key)}
		<circle cx={p.x} cy={p.y} r="3.5" fill="var(--cv-window)" opacity={p.o} />
	{/each}

	<!-- the probabilities -->
	<Txt x={BAR.x} y={84} text="probabilities (softmax)" size={12} weight={600} />
	{#each probs as p, d (d)}
		{@const y = BAR.y + d * BAR.h}
		<Txt
			x={BAR.x + 8}
			y={y + 18}
			text={String(d)}
			size={15}
			weight={d === top ? 700 : 500}
			anchor="middle"
		/>
		<rect
			x={BAR.x + 22}
			y={y + 5}
			width={BAR.w}
			height={BAR.h - 10}
			rx="3"
			fill="var(--stage-grid)"
		/>
		<rect
			x={BAR.x + 22}
			y={y + 5}
			width={Math.max(p > 0 ? 1.5 : 0, p * BAR.w)}
			height={BAR.h - 10}
			rx="3"
			fill={d === top ? 'var(--cv-window)' : 'var(--stage-ink-muted)'}
		/>
		{#if act}
			<Txt
				x={BAR.x + BAR.w + 28}
				y={y + 18}
				text={pct(p)}
				size={11}
				weight={d === top ? 700 : 500}
				muted={d !== top}
			/>
		{/if}
		{#if input.label === d}
			<Txt x={BAR.x - 6} y={y + 18} text="true" size={10} anchor="end" muted />
		{/if}
	{/each}

	<!-- the verdict -->
	<Readout id="pd-verdict" order={2} label="The network" value={verdict}>
		<Txt x={362} y={440} text={verdict} size={18} weight={700} />
	</Readout>
	<Readout id="pd-truth" order={3} label="Digit" value={truth}>
		<Txt x={362} y={466} text={truth} size={13} muted />
	</Readout>
	{#if act}
		<Readout id="pd-pipe">
			<Txt
				x={362}
				y={500}
				text="784 pixels → 8 edge maps → 16 part maps → 784 numbers → 10 neurons → softmax"
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>

<style>
	.cv-px {
		image-rendering: pixelated;
	}
	.cv-pad {
		cursor: crosshair;
		touch-action: none;
	}
</style>
