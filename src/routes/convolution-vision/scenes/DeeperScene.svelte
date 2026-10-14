<script lang="ts">
	/**
	 * The ladder of features. Left: the chosen digit with the window one unit of each layer sees
	 * (5 × 5, then 14 × 14, then all of it), appearing one after the other (pure function of t;
	 * all three under reduced motion). Right: the rungs our network climbs, each with real
	 * examples (first-layer filters, patches that excite second-layer filters, test digits), and,
	 * dimmed, the rungs that only larger networks trained on photographs reach (as reported by
	 * Zeiler & Fergus 2014; no pictures here, we have none of those networks).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C1, K, SIDE, decodeBytes } from '../cnn';
	import { PARTS, SAMPLES } from '../mnist-cnn';
	import Txt from './Txt.svelte';
	import { WT, greyUrl, inputOf, maxAbs, samplePixels, signedUrl } from './shared';

	let { t, params, reduced, dark }: StageProps = $props();

	const input = $derived(inputOf(params));
	const inUrl = $derived(greyUrl(input.img, SIDE, SIDE, dark));

	/** The window of one unit at each layer, centred on the ink's centre. */
	const PX = 10;
	const D = { x: 40, y: 110 };
	const centre = $derived.by(() => {
		let m = 0;
		let mx = 0;
		let my = 0;
		input.img.forEach((v, i) => {
			m += v;
			mx += v * (i % SIDE);
			my += v * Math.floor(i / SIDE);
		});
		return m > 0 ? { x: Math.round(mx / m), y: Math.round(my / m) } : { x: 14, y: 14 };
	});
	const box = (size: number) => {
		const x0 = Math.max(0, Math.min(SIDE - size, centre.x - Math.floor(size / 2)));
		const y0 = Math.max(0, Math.min(SIDE - size, centre.y - Math.floor(size / 2)));
		return { x: D.x + x0 * PX, y: D.y + y0 * PX, s: size * PX };
	};
	const phase = $derived(reduced ? 10 : t % 12);
	const show = (from: number) => Math.min(1, Math.max(0, (phase - from) / 0.6));
	const windows = $derived([
		{ key: 'l1', size: K, o: show(0.4), label: 'layer 1: 5 × 5' },
		{ key: 'l2', size: 14, o: show(2.6), label: 'layer 2: 14 × 14' },
		{ key: 'out', size: SIDE, o: show(4.8), label: 'output: all 28 × 28' }
	]);

	// ---- examples for the rungs ---------------------------------------------------------------
	const kScale = maxAbs(WT.c1w);
	const k1 = $derived(
		[0, 2, 4].map((c) => signedUrl(WT.c1w, K, K, kScale, dark, c * K * K)).slice(0, C1)
	);
	// second-layer filters 13, 5, 11: the strongest patch of each
	const p2 = $derived(
		[12, 4, 10].map((c) =>
			greyUrl(
				Array.from(decodeBytes(PARTS[c][0].pixels), (v) => v / 255),
				14,
				14,
				dark
			)
		)
	);
	const whole = $derived(
		[3, 6, 9].map((d) => {
			const i = SAMPLES.findIndex((s) => s.label === d);
			return greyUrl(samplePixels(i), SIDE, SIDE, dark);
		})
	);
	const R = { x: 400, w: 520 };
	const rungs = $derived([
		{ key: 'r1', y: 420, title: 'layer 1 · edges', note: 'learnt 5 × 5 filters', imgs: k1 },
		{
			key: 'r2',
			y: 300,
			title: 'layer 2 · parts of digits',
			note: 'what excites filters 13, 5, 11',
			imgs: p2
		},
		{ key: 'r3', y: 180, title: 'output · whole digits', note: 'test digits it reads', imgs: whole }
	]);
</script>

<g>
	<Readout
		id="dp-title"
		order={1}
		label="What one unit sees"
		value="5 × 5 → 14 × 14 → the whole 28 × 28 digit"
	>
		<Txt x={D.x} y={D.y - 24} text="what one unit of each layer sees" size={14} weight={600} />
	</Readout>
	<image href={inUrl} x={D.x} y={D.y} width={SIDE * PX} height={SIDE * PX} class="cv-px" />
	<rect
		x={D.x - 1}
		y={D.y - 1}
		width={SIDE * PX + 2}
		height={SIDE * PX + 2}
		fill="none"
		stroke="var(--border)"
	/>
	{#each windows as w, i (w.key)}
		{@const b = box(w.size)}
		<rect
			x={b.x + i * 1.5}
			y={b.y + i * 1.5}
			width={b.s - i * 3}
			height={b.s - i * 3}
			fill="var(--cv-window)"
			fill-opacity={0.1 * w.o}
			stroke="var(--cv-window)"
			stroke-width={3 - i * 0.5}
			opacity={input.empty ? 0 : w.o}
		/>
		<Readout id="dp-{w.key}">
			<Txt
				x={D.x}
				y={D.y + SIDE * PX + 26 + i * 20}
				text={w.label}
				size={12}
				opacity={0.35 + 0.65 * w.o}
				weight={600}
			/>
		</Readout>
	{/each}

	<!-- the ladder -->
	<Txt
		x={R.x}
		y={86}
		text="larger networks on photographs (Zeiler & Fergus, 2014):"
		size={12}
		weight={600}
		muted
	/>
	<Readout
		id="dp-big"
		order={3}
		label="Larger networks"
		value="edges → corners → textures → object parts → whole objects"
	>
		<Txt
			x={R.x}
			y={108}
			text="edges, colour blobs → corners → textures → parts (dogs' faces) → objects"
			size={12}
			muted
		/>
	</Readout>
	<line
		x1={R.x}
		y1={128}
		x2={R.x + R.w}
		y2={128}
		stroke="var(--stage-line)"
		stroke-dasharray="4 4"
	/>
	<Txt x={R.x} y={152} text="this page's network, two layers deep:" size={12} weight={600} />
	{#each rungs as r (r.key)}
		<rect
			x={R.x}
			y={r.y}
			width={R.w}
			height={96}
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Txt x={R.x + 16} y={r.y + 40} text={r.title} size={14} weight={700} />
		<Txt x={R.x + 16} y={r.y + 62} text={r.note} size={11} muted />
		{#each r.imgs as url, i (i)}
			<image
				href={url}
				x={R.x + 300 + i * 72}
				y={r.y + 12}
				width={72 - 8}
				height={72 - 8}
				class="cv-px"
			/>
			<rect
				x={R.x + 299 + i * 72}
				y={r.y + 11}
				width={66}
				height={66}
				fill="none"
				stroke="var(--border)"
			/>
		{/each}
	{/each}
	<!-- arrows up the ladder -->
	{#each [400, 280] as y (y)}
		<path
			d="M {R.x + R.w / 2 - 120} {y + 18} L {R.x + R.w / 2 - 120} {y - 2}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
	{/each}
	<Readout
		id="dp-ours"
		order={2}
		label="This network"
		value="edges → parts of digits → whole digits"
	>
		<Txt
			x={R.x}
			y={548}
			text="small detectors, stacked: simple features combine into complex ones"
			size={13}
			weight={600}
		/>
	</Readout>
</g>

<style>
	.cv-px {
		image-rendering: pixelated;
	}
</style>
