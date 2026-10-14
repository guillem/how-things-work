<script lang="ts">
	/**
	 * One example through a 2-2-1 network, with every number. Hint `phase`: forward (sums and
	 * outputs, pulses flowing right), backward (error signals δ, pulses flowing left), update
	 * (each weight's slope a × δ and its new value, the loss before and after, and a
	 * finite-difference check of one slope). The "Next example" action applies the update and
	 * moves to the next example; the inset shows the network's answer after that many steps.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		STEP_LR,
		applyStep,
		backward,
		cloneNet,
		crossEntropy,
		dataset,
		forward,
		gradient,
		stepThrough
	} from '../network';
	import { bands, dots, fix, outputGrid, zeroLine } from './shared';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'forward'));
	const n = $derived(Math.max(0, Math.floor(Number(params.example) || 0)));
	const state = $derived(stepThrough(n));
	const net = $derived(state.net);
	const ex = $derived(state.example);
	const x = $derived([ex.x, ex.y]);
	const y = $derived(ex.label);
	const fw = $derived(forward(net, x));
	const bw = $derived(backward(net, fw, y));
	const p = $derived(fw.a[2][0]);
	const loss = $derived(crossEntropy(fw.z[1][0], y));
	const after = $derived.by(() => {
		const next = cloneNet(net);
		applyStep(next, gradient(next, [ex]), STEP_LR);
		const f2 = forward(next, x);
		return { net: next, loss: crossEntropy(f2.z[1][0], y) };
	});
	// The weight with the steepest slope for this example, and a finite-difference check of it.
	const check = $derived.by(() => {
		let best = { l: 1, idx: 0, g: 0 };
		bw.gW.forEach((g, l) =>
			g.forEach((v, idx) => {
				if (Math.abs(v) > Math.abs(best.g)) best = { l, idx, g: v };
			})
		);
		const { l, idx } = best;
		const nIn = net.sizes[l];
		const i = idx % nIn;
		const j = Math.floor(idx / nIn);
		const side = (k: number) => (k ? 'bottom' : 'top');
		const name = l === 0 ? `x${i ? '₂' : '₁'} → ${side(j)} hidden` : `${side(i)} hidden → output`;
		const h = 0.001;
		const nudged = cloneNet(net);
		nudged.W[l][idx] += h;
		const f2 = forward(nudged, x);
		return {
			name,
			aIn: fw.a[l][i],
			delta: bw.delta[l][j],
			w: net.W[l][idx],
			next: after.net.W[l][idx],
			slope: best.g,
			change: crossEntropy(f2.z[1][0], y) - loss
		};
	});

	// ---- layout -------------------------------------------------------------------------
	const R = 36;
	const NODES = [
		[
			{ x: 130, y: 190 },
			{ x: 130, y: 370 }
		],
		[
			{ x: 410, y: 190 },
			{ x: 410, y: 370 }
		],
		[{ x: 690, y: 280 }]
	];
	const edges = $derived(
		net.W.flatMap((w, l) =>
			Array.from(w, (v, idx) => {
				const nIn = net.sizes[l];
				const i = idx % nIn;
				const j = Math.floor(idx / nIn);
				const a = NODES[l][i];
				const b = NODES[l + 1][j];
				const len = Math.hypot(b.x - a.x, b.y - a.y);
				const ux = (b.x - a.x) / len;
				const uy = (b.y - a.y) / len;
				const at = l === 0 ? 0.36 : 0.5;
				return {
					key: `${l}-${i}-${j}`,
					l,
					i,
					j,
					x1: a.x + ux * R,
					y1: a.y + uy * R,
					x2: b.x - ux * R,
					y2: b.y - uy * R,
					lx: a.x + (b.x - a.x) * at,
					ly: a.y + (b.y - a.y) * at,
					w: v,
					g: bw.gW[l][idx],
					next: after.net.W[l][idx]
				};
			})
		)
	);
	const wColor = (w: number) => (w >= 0 ? 'var(--nn-pos)' : 'var(--nn-neg)');
	const edgeLabel = (e: (typeof edges)[number]) =>
		phase === 'update' ? `${fix(e.w)} → ${fix(e.next)}` : `w = ${fix(e.w)}`;

	// Pulses: forward runs left to right, backward right to left (none under reduced motion).
	const u = $derived(reduced || phase === 'update' ? -1 : (t % 2.8) / 2.8);
	const pulses = $derived(
		edges.flatMap((e) => {
			const back = phase === 'backward';
			// Forward: layer 0 then layer 1; backward: layer 1 then layer 0.
			const slot = back ? 1 - e.l : e.l;
			const from = 0.05 + slot * 0.45;
			const to = from + 0.4;
			if (u < from || u > to) return [];
			let f = (u - from) / (to - from);
			if (back) f = 1 - f;
			return [
				{
					key: e.key,
					x: e.x1 + (e.x2 - e.x1) * f,
					y: e.y1 + (e.y2 - e.y1) * f,
					o: Math.sin(Math.PI * ((u - from) / (to - from)))
				}
			];
		})
	);

	// ---- inset: the network's answer so far ---------------------------------------------------
	const I = { x: 776, y: 92, size: 160 };
	const insetGrid = $derived(outputGrid(net, 26));
	const insetBands = $derived(bands(insetGrid, I.x, I.y, I.size, 4, 0.5));
	const insetLine = $derived(zeroLine(insetGrid, I.x, I.y, I.size));
	const ipx = (v: number) => I.x + ((v + 1) / 2) * I.size;
	const ipy = (v: number) => I.y + ((1 - v) / 2) * I.size;
	const corners = dataset('xor');
	const insetA = dots(
		corners.filter((e) => e.label === 0).map((e) => ({ px: ipx(e.x), py: ipy(e.y) })),
		1.6
	);
	const insetB = dots(
		corners.filter((e) => e.label === 1).map((e) => ({ px: ipx(e.x), py: ipy(e.y) })),
		1.6
	);

	const par = (v: number, d = 2) => (v < 0 ? `(${fix(v, d)})` : fix(v, d));
	/** A small change, to 3 significant figures, as a decimal (e.g. −0.000191). */
	const sci = (v: number) => {
		if (v === 0) return '0';
		const digits = Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v))));
		return v.toFixed(Math.min(9, digits)).replace('-', '−');
	};
	const colour = (label: number) => (label ? 'blue (y = 1)' : 'orange (y = 0)');
	const LABEL_Y = 480;
</script>

<g>
	<!-- column headings -->
	<Readout id="headings">
		<Txt x={130} y={110} text="inputs" anchor="middle" size={12} muted />
		<Txt x={410} y={110} text="hidden layer (tanh)" anchor="middle" size={12} muted />
		<Txt x={690} y={110} text="output (sigmoid)" anchor="middle" size={12} muted />
	</Readout>
	<Readout
		id="title"
		order={1}
		label="Example"
		value="#{n + 1}: ({fix(ex.x)}, {fix(ex.y)}), {colour(y)}"
	>
		<Txt
			x={40}
			y={52}
			text="example #{n + 1}: (x₁, x₂) = ({fix(ex.x)}, {fix(ex.y)}), colour {colour(y)}"
			size={15}
			weight={600}
		/>
	</Readout>

	<!-- weights -->
	{#each edges as e (e.key)}
		<line
			x1={e.x1}
			y1={e.y1}
			x2={e.x2}
			y2={e.y2}
			stroke={wColor(e.w)}
			stroke-width={1 + 2.5 * Math.min(1, Math.abs(e.w) / 2)}
			opacity="0.8"
		/>
	{/each}
	{#each pulses as q (q.key)}
		<circle
			cx={q.x}
			cy={q.y}
			r="5"
			fill={phase === 'backward' ? 'var(--nn-back)' : 'var(--nn-fwd)'}
			opacity={q.o}
		/>
	{/each}
	<Readout id="edge-labels">
		{#each edges as e (e.key)}
			<Txt
				x={e.lx}
				y={e.ly + 4}
				text={edgeLabel(e)}
				anchor="middle"
				size={12}
				weight={600}
				color={wColor(phase === 'update' ? e.next : e.w)}
				pill
			/>
		{/each}
	</Readout>

	<!-- neurons -->
	{#each NODES as col, l (l)}
		{#each col as c, j (j)}
			<circle
				cx={c.x}
				cy={c.y}
				r={R}
				fill="var(--surface)"
				stroke={l === 2 ? 'var(--nn-edge)' : 'var(--stage-line)'}
				stroke-width={l === 2 ? 2 : 1.2}
			/>
		{/each}
	{/each}
	<Readout id="node-values">
		{#each [0, 1] as i (i)}
			{@const c = NODES[0][i]}
			<Txt x={c.x - R - 10} y={c.y + 5} text="x{i ? '₂' : '₁'}" anchor="end" size={13} muted />
			<Txt x={c.x} y={c.y + 5} text={fix(x[i])} anchor="middle" size={14} weight={600} />
		{/each}
		{#each [0, 1] as j (j)}
			{@const c = NODES[1][j]}
			{#if phase === 'forward'}
				<Txt x={c.x} y={c.y - 6} text="z {fix(fw.z[0][j])}" anchor="middle" size={12} muted />
				<Txt
					x={c.x}
					y={c.y + 13}
					text="a {fix(fw.a[1][j])}"
					anchor="middle"
					size={14}
					weight={600}
				/>
			{:else}
				<Txt x={c.x} y={c.y - 6} text="a {fix(fw.a[1][j])}" anchor="middle" size={12} muted />
				<Txt
					x={c.x}
					y={c.y + 13}
					text="δ {fix(bw.delta[0][j], 3)}"
					anchor="middle"
					size={14}
					weight={600}
					color="var(--nn-back)"
				/>
			{/if}
			<Txt
				x={c.x}
				y={c.y + R + 18}
				text={phase === 'update'
					? `b ${fix(net.b[0][j])} → ${fix(after.net.b[0][j])}`
					: `bias b = ${fix(net.b[0][j])}`}
				anchor="middle"
				size={11}
				muted
			/>
		{/each}
		{@const o = NODES[2][0]}
		{#if phase === 'forward'}
			<Txt x={o.x} y={o.y - 6} text="z {fix(fw.z[1][0])}" anchor="middle" size={12} muted />
			<Txt x={o.x} y={o.y + 13} text="p {fix(p)}" anchor="middle" size={14} weight={600} />
		{:else}
			<Txt x={o.x} y={o.y - 6} text="p {fix(p)}" anchor="middle" size={12} muted />
			<Txt
				x={o.x}
				y={o.y + 13}
				text="δ {fix(bw.delta[1][0], 3)}"
				anchor="middle"
				size={14}
				weight={600}
				color="var(--nn-back)"
			/>
		{/if}
		<Txt
			x={o.x}
			y={o.y + R + 18}
			text={phase === 'update'
				? `b ${fix(net.b[1][0])} → ${fix(after.net.b[1][0])}`
				: `bias b = ${fix(net.b[1][0])}`}
			anchor="middle"
			size={11}
			muted
		/>
	</Readout>

	<!-- inset -->
	<rect x={I.x} y={I.y} width={I.size} height={I.size} fill="var(--nn-mid)" />
	{#each insetBands as b (b.key)}
		<path d={b.d} fill={b.fill} />
	{/each}
	<path d={insetA} fill="var(--nn-a)" opacity="0.7" />
	<path d={insetB} fill="var(--nn-b)" opacity="0.7" />
	<path d={insetLine} fill="none" stroke="var(--nn-edge)" stroke-width="1.6" />
	<circle
		cx={ipx(ex.x)}
		cy={ipy(ex.y)}
		r="6"
		fill={y ? 'var(--nn-b)' : 'var(--nn-a)'}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<rect
		x={I.x}
		y={I.y}
		width={I.size}
		height={I.size}
		fill="none"
		stroke="var(--stage-line)"
		rx="2"
	/>
	<Readout id="inset" order={5} label="So far" value="{n} examples trained on">
		<Txt x={I.x} y={I.y - 10} text="after {n} example{n === 1 ? '' : 's'}" size={12} weight={600} />
		<Txt x={I.x} y={I.y + I.size + 16} text="ringed: this example" size={11} muted />
	</Readout>

	<!-- the numbers of this phase -->
	{#if phase === 'forward'}
		<Readout id="out" order={2} label="Output" value="p = {fix(p)}: {Math.round(100 * p)}% blue">
			<Txt
				x={40}
				y={LABEL_Y + 20}
				text="output p = σ(z) = {fix(p)}: the network says {Math.round(100 * p)}% blue"
				size={14}
				weight={600}
			/>
		</Readout>
		<Readout id="loss" order={3} label="Loss" value="−ln({fix(y ? p : 1 - p)}) = {fix(loss, 3)}">
			<Txt
				x={40}
				y={LABEL_Y + 44}
				text="the right answer is {colour(y)}: loss = −ln(probability given to it) = −ln({fix(
					y ? p : 1 - p
				)}) = {fix(loss, 3)}"
				size={13}
			/>
		</Readout>
		<Readout id="kept">
			<Txt
				x={40}
				y={LABEL_Y + 68}
				text="z: each neuron's sum · a: its output, tanh(z) · both kept for the backward pass"
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'backward'}
		<Readout
			id="d-out"
			order={2}
			label="Output δ"
			value="p − y = {fix(p)} − {y} = {fix(bw.delta[1][0], 3)}"
		>
			<Txt
				x={40}
				y={LABEL_Y + 20}
				text="output: δ = p − y = {fix(p)} − {y} = {fix(bw.delta[1][0], 3)}"
				size={14}
				weight={600}
				color="var(--nn-back)"
			/>
		</Readout>
		<Readout
			id="d-hidden"
			order={3}
			label="Hidden δ (top)"
			value="{fix(net.W[1][0])} × {fix(bw.delta[1][0], 3)} × (1 − {fix(fw.a[1][0])}²) = {fix(
				bw.delta[0][0],
				3
			)}"
		>
			<Txt
				x={40}
				y={LABEL_Y + 44}
				text="top hidden neuron: δ = w × δ(output) × (1 − a²) = {fix(net.W[1][0])} × {fix(
					bw.delta[1][0],
					3
				)} × (1 − {fix(fw.a[1][0])}²) = {fix(bw.delta[0][0], 3)}"
				size={13}
			/>
		</Readout>
		<Readout id="meaning">
			<Txt
				x={40}
				y={LABEL_Y + 68}
				text="δ = how much the loss would rise per unit of extra sum z · positive: the sum should go down"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Readout
			id="slope"
			order={2}
			label="Weight {check.name}"
			value="slope a × δ = {fix(check.aIn)} × {fix(check.delta, 3)} = {fix(
				check.slope,
				3
			)}, new w = {fix(check.next)}"
		>
			<Txt
				x={40}
				y={LABEL_Y + 20}
				text="weight {check.name}: slope = a × δ = {par(check.aIn)} × {par(check.delta, 3)} = {fix(
					check.slope,
					3
				)};  new w = {fix(check.w)} − {STEP_LR} × {par(check.slope, 3)} = {fix(check.next)}"
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout
			id="check"
			order={3}
			label="Check"
			value="nudge +0.001: loss changes by {sci(check.change)}; slope × 0.001 = {sci(
				check.slope * 0.001
			)}"
		>
			<Txt
				x={40}
				y={LABEL_Y + 44}
				text="check: nudge that weight by +0.001 → the loss changes by {sci(
					check.change
				)}; slope × 0.001 = {sci(check.slope * 0.001)}"
				size={13}
			/>
		</Readout>
		<Readout
			id="after"
			order={4}
			label="Loss on this example"
			value="{fix(loss, 3)} → {fix(after.loss, 3)}"
		>
			<Txt
				x={40}
				y={LABEL_Y + 68}
				text="after every weight steps (η = {STEP_LR}), the loss on this example goes {fix(
					loss,
					3
				)} → {fix(after.loss, 3)}"
				size={13}
				color="var(--nn-fwd)"
				weight={600}
			/>
		</Readout>
	{/if}
	<Readout id="press">
		<Txt
			x={40}
			y={LABEL_Y + 92}
			text="Next example: make this update and go on to the next point"
			size={12}
			muted
		/>
	</Readout>
</g>
