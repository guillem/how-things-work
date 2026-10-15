<script lang="ts">
	/**
	 * What one hidden layer does to the plane. A network with two hidden tanh neurons, trained
	 * on the two moons, moves every point (and a grid) to its two hidden outputs, in three
	 * moves: multiply by the weight matrix W, add the biases b, squash with tanh. In the bent
	 * plane the output neuron's straight line splits the classes; the inset shows that line
	 * drawn back on the original plane, where it is curved.
	 *
	 * The morph is a pure function of t (a 16 s loop); under reduced motion the finished,
	 * bent frame is shown.
	 */
	import { easeInOut, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BEND_EPOCHS, BEND_SPEC, layerStages, runFor } from '../network';
	import { bands, dots, fix, outputGrid, zeroLine } from './shared';

	let { t, reduced }: StageProps = $props();

	const run = runFor(BEND_SPEC);
	const net = run.at(BEND_EPOCHS);
	const W = net.W[0];
	const B = net.b[0];
	const V = net.W[1];
	const C0 = net.b[1][0];

	// ---- the shapes being moved: the examples and a grid -----------------------------------
	type Pt = [number, number];
	const stagesOf = (p: Pt): Pt[] => {
		const s = layerStages(net, 0, p);
		return [p, [s.lin[0], s.lin[1]], [s.shifted[0], s.shifted[1]], [s.out[0], s.out[1]]];
	};
	const examples = run.data.map((e) => ({ label: e.label, st: stagesOf([e.x, e.y]) }));
	const TICKS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
	const lines = TICKS.flatMap((v) =>
		[0, 1].map((dir) => ({
			key: `${dir}:${v}`,
			axis: v === 0,
			pts: Array.from({ length: 25 }, (_, i) => {
				const u = -1 + (2 * i) / 24;
				return stagesOf(dir ? [v, u] : [u, v]);
			})
		}))
	);
	const bbox = [0, 1, 2, 3].map((k) => {
		let x0 = Infinity,
			x1 = -Infinity,
			y0 = Infinity,
			y1 = -Infinity;
		for (const l of lines)
			for (const p of l.pts) {
				x0 = Math.min(x0, p[k][0]);
				x1 = Math.max(x1, p[k][0]);
				y0 = Math.min(y0, p[k][1]);
				y1 = Math.max(y1, p[k][1]);
			}
		return { x0, x1, y0, y1 };
	});

	const PANEL = { x: 44, y: 64, size: 400 };

	// ---- the timeline ---------------------------------------------------------------------
	const PERIOD = 16;
	const MOVES = [
		[2, 4.5],
		[6, 8.5],
		[9.5, 12]
	];
	const tt = $derived(reduced ? 14 : t % PERIOD);
	/** Morph position 0–3: 0 = input plane, 3 = fully bent. */
	const m = $derived(
		MOVES.reduce((acc, [a, b]) => acc + easeInOut(Math.min(1, Math.max(0, (tt - a) / (b - a)))), 0)
	);
	const fadeOut = $derived(reduced ? 1 : 1 - smoothstep(15.2, 15.9, tt));
	const lineOn = $derived(smoothstep(12.2, 13, tt) * fadeOut);
	const k = $derived(Math.min(2, Math.floor(m)));
	const f = $derived(m - k);
	const at = (st: Pt[]): Pt => [
		st[k][0] + (st[k + 1][0] - st[k][0]) * f,
		st[k][1] + (st[k + 1][1] - st[k][1]) * f
	];
	const view = $derived.by(() => {
		const a = bbox[k];
		const b = bbox[k + 1];
		const lerp = (u: number, v: number) => u + (v - u) * f;
		const x0 = lerp(a.x0, b.x0);
		const x1 = lerp(a.x1, b.x1);
		const y0 = lerp(a.y0, b.y0);
		const y1 = lerp(a.y1, b.y1);
		const span = Math.max(x1 - x0, y1 - y0) * 1.08;
		return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale: PANEL.size / span };
	});
	const sx = (x: number) => PANEL.x + PANEL.size / 2 + (x - view.cx) * view.scale;
	const sy = (y: number) => PANEL.y + PANEL.size / 2 - (y - view.cy) * view.scale;

	const gridPaths = $derived(
		lines.map((l) => ({
			key: l.key,
			axis: l.axis,
			d: l.pts
				.map((st, i) => {
					const [x, y] = at(st);
					return `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
				})
				.join('')
		}))
	);
	const pts = $derived(
		examples.map((e) => {
			const [x, y] = at(e.st);
			return { label: e.label, px: sx(x), py: sy(y) };
		})
	);
	const dotsA = $derived(
		dots(
			pts.filter((p) => p.label === 0),
			3.4
		)
	);
	const dotsB = $derived(
		dots(
			pts.filter((p) => p.label === 1),
			3.4
		)
	);
	// The output neuron's line V·h + c = 0, across the bent plane's view.
	const outLine = $derived.by(() => {
		const h = PANEL.size / view.scale / 2;
		const ends: Pt[] = [];
		if (Math.abs(V[1]) > Math.abs(V[0])) {
			for (const x of [view.cx - h, view.cx + h]) ends.push([x, -(V[0] * x + C0) / V[1]]);
		} else {
			for (const y of [view.cy - h, view.cy + h]) ends.push([-(V[1] * y + C0) / V[0], y]);
		}
		return ends;
	});

	// ---- inset: the same boundary on the original plane --------------------------------------
	const I = { x: 724, y: 330, size: 190 };
	const insetGrid = outputGrid(net, 36);
	const insetBands = bands(insetGrid, I.x, I.y, I.size, 4, 0.5);
	const insetLine = zeroLine(insetGrid, I.x, I.y, I.size);
	const insetDotsA = dots(
		run.data
			.filter((e) => e.label === 0)
			.map((e) => ({ px: I.x + ((e.x + 1) / 2) * I.size, py: I.y + ((1 - e.y) / 2) * I.size })),
		2
	);
	const insetDotsB = dots(
		run.data
			.filter((e) => e.label === 1)
			.map((e) => ({ px: I.x + ((e.x + 1) / 2) * I.size, py: I.y + ((1 - e.y) / 2) * I.size })),
		2
	);

	// ---- captions ----------------------------------------------------------------------
	const MOVE_TEXT = [
		{ title: '1 · multiply by W', note: 'a linear transformation: lines stay straight' },
		{ title: '2 · add the biases b', note: 'a shift' },
		{ title: '3 · squash with tanh', note: 'the plane bends into a square, −1 to 1' }
	];
	/** Which move is under way or last done (−1 before the first). */
	const current = $derived(m < 0.02 ? -1 : Math.min(2, Math.ceil(m - 0.02) - 1));
	const caption = $derived(
		m < 0.02
			? 'the input plane: each point at (x₁, x₂)'
			: m > 2.98
				? 'the bent plane: each point at (h₁, h₂), its two hidden outputs'
				: MOVE_TEXT[current].title
	);
</script>

<g>
	<!-- the moving plane -->
	<clipPath id="bend-clip">
		<rect x={PANEL.x} y={PANEL.y} width={PANEL.size} height={PANEL.size} />
	</clipPath>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.size}
		height={PANEL.size}
		fill="var(--surface)"
		stroke="var(--stage-line)"
		rx="3"
	/>
	<g clip-path="url(#bend-clip)" opacity={fadeOut}>
		{#each gridPaths as g (g.key)}
			<path
				d={g.d}
				fill="none"
				stroke={g.axis ? 'var(--stage-ink-muted)' : 'var(--stage-grid)'}
				stroke-width={g.axis ? 1.4 : 1}
			/>
		{/each}
		<path d={dotsA} fill="var(--nn-a)" stroke="var(--surface)" stroke-width="0.8" />
		<path d={dotsB} fill="var(--nn-b)" stroke="var(--surface)" stroke-width="0.8" />
		{#if lineOn > 0.01}
			<line
				x1={sx(outLine[0][0])}
				y1={sy(outLine[0][1])}
				x2={sx(outLine[1][0])}
				y2={sy(outLine[1][1])}
				stroke="var(--nn-edge)"
				stroke-width="2.4"
				stroke-dasharray="7 5"
				opacity={lineOn}
			/>
		{/if}
	</g>
	<Readout id="caption" order={1} label="Now" value={caption}>
		<Label anchor="start" x={PANEL.x} y={PANEL.y - 14} text={caption} size={14} weight={600} />
	</Readout>
	<Readout id="line" order={2} label="Dashed" value="the output neuron's line" opacity={lineOn}>
		<Label
			anchor="start"
			x={PANEL.x + 10}
			y={PANEL.y + PANEL.size - 12}
			text="dashed: the output neuron's straight line"
			size={12}
			opacity={lineOn}
			pill
		/>
	</Readout>

	<!-- the three moves -->
	<Readout id="moves">
		<Label
			anchor="start"
			x={490}
			y={84}
			text="one hidden layer, 2 neurons"
			size={14}
			weight={600}
		/>
		{#each MOVE_TEXT as mv, i (i)}
			{@const on = current === i}
			<g opacity={on ? 1 : current > i || m > 2.98 ? 0.75 : 0.45}>
				<Label
					anchor="start"
					x={490}
					y={118 + 50 * i}
					text={mv.title}
					size={13}
					weight={600}
					color={on ? 'var(--nn-back)' : undefined}
				/>
				<Label anchor="start" x={490} y={136 + 50 * i} text={mv.note} size={12} muted />
			</g>
		{/each}
	</Readout>
	<Readout
		id="weights"
		order={3}
		label="W and b"
		value="W = [{fix(W[0])}, {fix(W[1])}; {fix(W[2])}, {fix(W[3])}], b = ({fix(B[0])}, {fix(B[1])})"
	>
		<Label
			anchor="start"
			x={490}
			y={276}
			text="W = [ {fix(W[0])}  {fix(W[1])} ;  {fix(W[2])}  {fix(W[3])} ]    b = ({fix(B[0])}, {fix(
				B[1]
			)})"
			size={12}
			muted
		/>
	</Readout>

	<!-- inset: the same network's boundary on the original plane -->
	<rect x={I.x} y={I.y} width={I.size} height={I.size} fill="var(--nn-mid)" />
	{#each insetBands as b (b.key)}
		<path d={b.d} fill={b.fill} />
	{/each}
	<path d={insetDotsA} fill="var(--nn-a)" />
	<path d={insetDotsB} fill="var(--nn-b)" />
	<path d={insetLine} fill="none" stroke="var(--nn-edge)" stroke-width="2" stroke-dasharray="6 4" />
	<rect
		x={I.x}
		y={I.y}
		width={I.size}
		height={I.size}
		fill="none"
		stroke="var(--stage-line)"
		rx="2"
	/>
	<Readout id="inset" order={4} label="Back on the input plane" value="the same line, bent">
		<Label
			anchor="start"
			x={I.x}
			y={I.y - 28}
			text="the dashed line, drawn back"
			size={12}
			weight={600}
		/>
		<Label
			anchor="start"
			x={I.x}
			y={I.y - 12}
			text="on the input plane: bent"
			size={12}
			weight={600}
		/>
	</Readout>
</g>
