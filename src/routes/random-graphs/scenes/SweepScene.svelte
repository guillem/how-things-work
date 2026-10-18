<script lang="ts">
	/**
	 * The largest piece's share against the average degree c, averaged over many graphs of each
	 * size n (../model.ts `meanSweep`), with the exact large-n answer S = 1 − e^(−cS) dashed. The
	 * chosen size `n` is traced from c = 0 upward, 0.6 per second (reduced motion: complete); the
	 * other sizes stay faint for comparison.
	 *
	 * Focus (`step.hints.focus`): 'full' (c from 0 to 4), 'knee' (zoom on c from 0.5 to 1.5, with
	 * the share at c = 1 for each size) or 'epidemic' (the exact curve alone, read as the final
	 * size of an epidemic against R₀).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { giantShare, meanSweep } from '../model';
	import { SIZES } from '../steps';
	import { fmt, pct, sizeColor } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'full'));
	const knee = $derived(focus === 'knee');
	const epidemic = $derived(focus === 'epidemic');
	const n = $derived(SIZES.includes(Number(params.n)) ? Number(params.n) : 50);
	const chosen = $derived(SIZES.indexOf(n));

	/** Graphs averaged per size: about 40,000 nodes' worth, at least 10. */
	const graphsFor = (size: number) => Math.max(10, Math.min(400, Math.round(40000 / size)));
	const CS = Array.from({ length: 201 }, (_, i) => i * 0.02);
	const curves = SIZES.map((size) => meanSweep(size, CS, graphsFor(size), 7));

	const X = $derived(knee ? ([0.5, 1.5] as [number, number]) : ([0, 4] as [number, number]));
	const Y = $derived(knee ? ([0, 0.5] as [number, number]) : ([0, 1] as [number, number]));
	const sx = $derived(scale(X, [100, 690]));
	const sy = $derived(scale(Y, [510, 110]));
	const inView = (d: { c: number }) => d.c >= X[0] - 1e-9 && d.c <= X[1] + 1e-9;
	const cNow = $derived(reduced ? X[1] : Math.min(X[1], X[0] + t * (knee ? 0.15 : 0.6)));
	const paths = $derived(
		curves.map((cv, k) =>
			linePath(
				cv.filter((d) => inView(d) && (k !== chosen || d.c <= cNow + 1e-9)),
				(d) => d.c,
				(d) => d.share,
				sx,
				sy
			)
		)
	);
	const theory = $derived(
		linePath(
			CS.filter((c) => inView({ c })).map((c) => ({ c, s: giantShare(c) })),
			(d) => d.c,
			(d) => d.s,
			sx,
			sy
		)
	);
	const atOne = curves.map((cv) => cv[50].share);
	const head = $derived(curves[chosen][Math.min(200, Math.round(cNow / 0.02))]);
	const markers = [
		{ r: 1.5, s: giantShare(1.5) },
		{ r: 2, s: giantShare(2) },
		{ r: 3, s: giantShare(3) }
	];
</script>

<g>
	{#if epidemic}
		<Readout
			id="title"
			order={1}
			label="One curve"
			value="giant share against c = major-outbreak size against R₀"
		>
			<Label
				x={24}
				y={34}
				text="One curve, two readings: S = 1 − e^(−cS) and z = 1 − e^(−R₀z)"
				size={15}
				weight={600}
				anchor="start"
			/>
		</Readout>
		<Axes
			{sx}
			{sy}
			xLabel="average degree c  ·  R₀"
			xTicks={[0, 1, 2, 3, 4]}
			yTicks={[0, 0.25, 0.5, 0.75, 1]}
			yFormat={(v) => `${v * 100} %`}
		/>
		<Label
			x={100}
			y={84}
			text="share in the giant component · share infected in a major outbreak"
			size={11}
			anchor="start"
			muted
		/>
		<path
			d={paths[SIZES.length - 1]}
			fill="none"
			stroke={sizeColor(SIZES.length - 1)}
			stroke-width="5"
			opacity="0.3"
		/>
		<path d={theory} fill="none" stroke="var(--rg-giant)" stroke-width="2.6" />
		{#each markers as mk (mk.r)}
			<circle
				cx={sx(mk.r)}
				cy={sy(mk.s)}
				r="5.5"
				fill="var(--rg-giant)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
			<Label
				x={sx(mk.r) + 8}
				y={sy(mk.s) + 20}
				text="R₀ = {mk.r}: {pct(mk.s)}"
				size={12}
				anchor="start"
				tabular
			/>
		{/each}
		<Label x={sx(1) - 8} y={sy(0.06)} text="R₀ = 1" size={11} anchor="end" muted />
		<rect
			x={730}
			y={130}
			width="200"
			height="186"
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label x={744} y={156} text="Random graph" size={12} weight={600} anchor="start" />
		<Label x={744} y={176} text="node → its c neighbours" size={11} anchor="start" muted />
		<Label x={744} y={194} text="giant: S of all nodes" size={11} anchor="start" muted />
		<Label x={744} y={226} text="Epidemic" size={12} weight={600} anchor="start" />
		<Label x={744} y={246} text="case → the R₀ it infects" size={11} anchor="start" muted />
		<Label x={744} y={264} text="major outbreak: z of the crowd" size={11} anchor="start" muted />
		<Label x={744} y={296} text="both: grow only above 1" size={11} anchor="start" weight={600} />
		<line
			x1={730}
			x2={760}
			y1={350}
			y2={350}
			stroke={sizeColor(SIZES.length - 1)}
			stroke-width="5"
			opacity="0.3"
		/>
		<Label x={766} y={354} text="graphs of 20,000 nodes" size={11} anchor="start" muted />
	{:else}
		<Readout id="title" order={1} label="Sweep" value="{fmt(n)} nodes, c up to {cNow.toFixed(2)}">
			<Label
				x={24}
				y={34}
				text="Largest piece’s share against c · {fmt(n)} nodes"
				size={15}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="avg" order={2} label="Average of" value="{graphsFor(n)} graphs">
			<Label
				x={24}
				y={56}
				text="each curve: the average over many graphs ({graphsFor(n)} for {fmt(n)} nodes)"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
		<Axes
			{sx}
			{sy}
			xLabel="average degree c"
			xTicks={knee ? [0.5, 0.75, 1, 1.25, 1.5] : [0, 1, 2, 3, 4]}
			yTicks={knee ? [0, 0.1, 0.2, 0.3, 0.4, 0.5] : [0, 0.25, 0.5, 0.75, 1]}
			yFormat={(v) => `${Math.round(v * 100)} %`}
		/>
		<Label x={100} y={96} text="largest piece’s share" size={11} anchor="start" muted />
		{#if knee}
			<line
				x1={sx(1)}
				x2={sx(1)}
				y1={sy(0)}
				y2={sy(0.5)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
		{/if}
		<clipPath id="rg-sweep-clip">
			<rect x={100} y={sy(Y[1]) - 4} width={590} height={sy(Y[0]) - sy(Y[1]) + 8} />
		</clipPath>
		<g clip-path="url(#rg-sweep-clip)">
			<path
				d={theory}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.6"
				stroke-dasharray="6 5"
			/>
			{#each paths as d, k (SIZES[k])}
				{#if k !== chosen}
					<path {d} fill="none" stroke={sizeColor(k)} stroke-width="1.6" opacity="0.7" />
				{/if}
			{/each}
			<path
				d={paths[chosen]}
				fill="none"
				stroke={sizeColor(chosen)}
				stroke-width="3"
				stroke-linejoin="round"
			/>
		</g>
		{#if head && inView(head) && head.share <= Y[1]}
			<circle
				cx={sx(head.c)}
				cy={sy(head.share)}
				r="5"
				fill={sizeColor(chosen)}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}

		<!-- legend: sizes, and in the zoom the share at c = 1 -->
		<Label
			x={730}
			y={124}
			text={knee ? 'nodes · share at c = 1' : 'nodes'}
			size={11}
			anchor="start"
			muted
		/>
		{#each SIZES as size, k (size)}
			{@const y = 152 + k * 30}
			<line
				x1={730}
				x2={760}
				y1={y - 4}
				y2={y - 4}
				stroke={sizeColor(k)}
				stroke-width={k === chosen ? 3 : 1.6}
				opacity={k === chosen ? 1 : 0.6}
			/>
			<Label
				x={768}
				{y}
				text={fmt(size)}
				size={12}
				anchor="start"
				weight={k === chosen ? 600 : 400}
				tabular
			/>
			{#if knee}
				<Label
					x={930}
					{y}
					text={pct(atOne[k])}
					size={12}
					anchor="end"
					tabular
					weight={k === chosen ? 600 : 400}
				/>
			{/if}
		{/each}
		<line
			x1={730}
			x2={760}
			y1={152 + 5 * 30 - 4}
			y2={152 + 5 * 30 - 4}
			stroke="var(--stage-ink)"
			stroke-width="1.6"
			stroke-dasharray="6 5"
		/>
		<Label x={768} y={152 + 5 * 30} text="infinitely many" size={12} anchor="start" />
		{#if knee}
			<Readout id="atone" order={3} label="At c = 1" value="{pct(atOne[chosen])} of {fmt(n)} nodes">
				<Label x={730} y={350} text="at c = 1 the largest piece" size={11} anchor="start" muted />
				<Label
					x={730}
					y={368}
					text="shrinks as a share, like n^(−1/3)"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{:else if head}
			<Readout
				id="now"
				order={3}
				label="Largest piece"
				value="{pct(head.share)} at c = {head.c.toFixed(2)}"
			>
				<Label
					x={730}
					y={350}
					text="c = {head.c.toFixed(2)}: {pct(head.share)}"
					size={13}
					weight={600}
					anchor="start"
					tabular
				/>
				<Label
					x={730}
					y={370}
					text="exact large-n: {pct(giantShare(head.c))}"
					size={11}
					anchor="start"
					muted
					tabular
				/>
			</Readout>
		{/if}
	{/if}
</g>
