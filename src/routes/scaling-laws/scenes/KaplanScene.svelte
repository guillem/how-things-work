<script lang="ts">
	/**
	 * Kaplan et al. 2020's L(N) = (N_c/N)^0.076 on log-log axes, solid over the model sizes they
	 * trained (768 to 1.5 billion non-embedding parameters) and dashed beyond, next to this page's
	 * sweep (all the text, and 10,000 characters) with the power law fitted to its four smallest
	 * models. The two are in different units (nats per token of WebText2, nats per character of
	 * Tiny Shakespeare), so only their slopes compare.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { KAPLAN, kaplanLossN } from '../laws';
	import { bySize, fitPowerLaw, powerLaw } from '../sweep';
	import { short } from './shared';

	let { reduced, t }: StageProps = $props();

	const CH = { x: 96, y: 40, w: 560, h: 440 };
	const X_LO = 2;
	const X_HI = 10;
	const sx = scale([X_LO, X_HI], [CH.x, CH.x + CH.w]);
	const Y_LO = Math.log10(1.4);
	const Y_HI = Math.log10(9);
	const sy = scale([Y_LO, Y_HI], [CH.y + CH.h, CH.y]);
	const yTicks = [1.5, 2, 3, 4, 6, 8].map(Math.log10);
	const clampY = (v: number) => Math.max(Y_LO, Math.min(Y_HI, Math.log10(v)));

	const kaplan = (a: number, b: number) =>
		Array.from({ length: 41 }, (_, i) => a + ((b - a) * i) / 40).map((lx) => ({
			lx,
			ly: clampY(kaplanLossN(10 ** lx))
		}));
	const k0 = Math.log10(KAPLAN.rangeN[0]);
	const k1 = Math.log10(KAPLAN.rangeN[1]);
	const kIn = linePath(
		kaplan(k0, k1),
		(p) => p.lx,
		(p) => p.ly,
		sx,
		sy
	);
	const kBefore = linePath(
		kaplan(X_LO, k0),
		(p) => p.lx,
		(p) => p.ly,
		sx,
		sy
	);
	const kAfter = linePath(
		kaplan(k1, X_HI),
		(p) => p.lx,
		(p) => p.ly,
		sx,
		sy
	);

	const all = bySize(Infinity);
	const small = bySize(10_000);
	const law = fitPowerLaw(all.slice(0, 4).map((p) => ({ x: p.N, y: p.loss })));
	const toyLine = linePath(
		[X_LO + 0.6, X_HI].map((lx) => ({ lx, ly: clampY(powerLaw(law, 10 ** lx)) })),
		(p) => p.lx,
		(p) => p.ly,
		sx,
		sy
	);
	const toyPath = linePath(
		all,
		(p) => Math.log10(p.N),
		(p) => Math.log10(p.loss),
		sx,
		sy
	);
	const smallPath = linePath(
		small,
		(p) => Math.log10(p.N),
		(p) => Math.log10(p.loss),
		sx,
		sy
	);
	const toyStart = all[0];

	/** Kaplan's line draws itself over the first 2.5 s (complete under reduced motion). */
	const draw = $derived(reduced ? 1 : Math.min(1, t / 2.5));
</script>

<g>
	<Axes
		{sx}
		{sy}
		xTicks={[2, 3, 4, 5, 6, 7, 8, 9, 10]}
		xFormat={(v) => short(10 ** v)}
		{yTicks}
		yFormat={(v) => String(Math.round(10 ** v * 10) / 10)}
		xLabel="parameters outside the embeddings, N"
		yLabel="loss (nats)"
	/>
	<!-- the range Kaplan et al. trained -->
	<rect
		x={sx(k0)}
		y={CH.y}
		width={sx(k1) - sx(k0)}
		height={CH.h}
		fill="var(--sl-range)"
		opacity="0.5"
	/>
	<Readout id="krange">
		<Label
			x={(sx(k0) + sx(k1)) / 2}
			y={CH.y + 16}
			size={11}
			muted
			text="models Kaplan et al. trained: 768 to 1.5 billion"
		/>
	</Readout>

	<!-- Kaplan's law -->
	<path
		d={kBefore}
		fill="none"
		stroke="var(--sl-kaplan)"
		stroke-width="2"
		stroke-dasharray="5 4"
		opacity="0.7"
	/>
	<path
		d={kAfter}
		fill="none"
		stroke="var(--sl-kaplan)"
		stroke-width="2"
		stroke-dasharray="5 4"
		opacity="0.7"
	/>
	<path
		d={kIn}
		fill="none"
		stroke="var(--sl-kaplan)"
		stroke-width="3"
		pathLength="1"
		stroke-dasharray="1"
		stroke-dashoffset={1 - draw}
	/>
	<Readout
		id="klabel"
		order={1}
		label="Kaplan et al. 2020"
		value="L = (8.8 × 10¹³ / N)^0.076, nats per token of WebText2"
		color="var(--sl-kaplan)"
	>
		<Label
			x={sx(7.3)}
			y={sy(clampY(kaplanLossN(10 ** 7.3))) - 26}
			anchor="start"
			size={12}
			weight={650}
			color="var(--sl-kaplan)"
			text="Kaplan et al. 2020: L = (8.8 × 10¹³ / N)^0.076"
		/>
		<Label
			x={sx(7.3)}
			y={sy(clampY(kaplanLossN(10 ** 7.3))) - 10}
			anchor="start"
			size={11}
			color="var(--sl-kaplan)"
			text="nats per token of WebText2 (dashed: beyond their models)"
		/>
	</Readout>

	<!-- the toy -->
	<path d={toyLine} fill="none" stroke="var(--sl-toy)" stroke-width="1.6" stroke-dasharray="6 4" />
	<path d={smallPath} fill="none" stroke="var(--sl-ramp-2)" stroke-width="1.6" />
	{#each small as p (p.width)}
		<circle cx={sx(Math.log10(p.N))} cy={sy(Math.log10(p.loss))} r="3" fill="var(--sl-ramp-2)" />
	{/each}
	<path d={toyPath} fill="none" stroke="var(--sl-toy)" stroke-width="2.5" />
	{#each all as p (p.width)}
		<circle
			cx={sx(Math.log10(p.N))}
			cy={sy(Math.log10(p.loss))}
			r="4.5"
			fill="var(--sl-toy)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}
	<Readout
		id="toy"
		order={2}
		label="This page's sweep, all the text"
		value="nats per character of Tiny Shakespeare; dashed: L = k·N^−{law.alpha.toFixed(3)}"
		color="var(--sl-toy)"
	>
		<Label
			x={sx(Math.log10(toyStart.N)) - 6}
			y={sy(Math.log10(1.62))}
			anchor="start"
			size={12}
			weight={650}
			color="var(--sl-toy)"
			text="this page's sweep, all the text"
		/>
		<Label
			x={sx(Math.log10(toyStart.N)) - 6}
			y={sy(Math.log10(1.62)) + 16}
			anchor="start"
			size={11}
			color="var(--sl-toy)"
			text="nats per character; dashed: L = k·N^−{law.alpha.toFixed(3)}"
		/>
	</Readout>
	<Readout
		id="small"
		order={3}
		label="Fainter: 10,000 characters of text"
		value="flat: the text, not the model, limits it"
	>
		<Label
			x={sx(Math.log10(small[small.length - 1].N)) + 12}
			y={sy(Math.log10(small[small.length - 1].loss)) - 8}
			anchor="start"
			size={11}
			muted
			text="10,000 characters: flat"
		/>
	</Readout>

	<!-- slopes -->
	<Readout id="card0">
		<rect
			x="676"
			y={CH.y + 250}
			width="268"
			height="104"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="slopes"
		order={0}
		label="Slopes"
		value="Kaplan 0.076 · this toy {law.alpha.toFixed(3)} (different text, units and models)"
	>
		<Label
			x={692}
			y={CH.y + 274}
			anchor="start"
			size={12.5}
			weight={650}
			text="compare the slopes, not the heights"
		/>
		<Label
			x={692}
			y={CH.y + 296}
			anchor="start"
			size={12}
			color="var(--sl-kaplan)"
			tabular
			text="Kaplan et al.: α = 0.076"
		/>
		<Label
			x={692}
			y={CH.y + 316}
			anchor="start"
			size={12}
			color="var(--sl-toy)"
			tabular
			text="this toy, 4 smallest: α = {law.alpha.toFixed(3)}"
		/>
		<Label
			x={692}
			y={CH.y + 338}
			anchor="start"
			size={11}
			muted
			text="different text, tokens and training"
		/>
	</Readout>
</g>
