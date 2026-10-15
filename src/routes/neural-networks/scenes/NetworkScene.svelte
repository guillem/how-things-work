<script lang="ts">
	/**
	 * A network trained live. Left: the plane, shaded by the network's answer, with the 200
	 * examples and the 50/50 boundary; under it, the loss after every epoch. Right: the network,
	 * every neuron a small square shaded by its own output over the plane, every weight a line
	 * (blue positive, orange negative, thicker for larger).
	 *
	 * The run is computed from the settings (never from `t`); `t` only says how many epochs of it
	 * are shown, counted from when the settings last changed. Under reduced motion the network
	 * after MAX_EPOCHS is shown.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { activate, predict, runFor, type Net } from '../network';
	import {
		ACT_NAMES,
		MAX_EPOCHS,
		bands,
		createSince,
		dots,
		epochsAt,
		fix,
		fmt,
		neuronGrids,
		outputGrid,
		setup,
		zeroLine
	} from './shared';
	import { Label } from '#lib/draw/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const s = $derived(setup(step, params));
	const run = $derived(runFor(s.spec));
	const since = createSince();
	const tau = $derived(reduced ? Infinity : since(t, s.key));
	const k = $derived(epochsAt(tau));
	const net: Net = $derived(run.at(k));

	// ---- the plane ----------------------------------------------------------------------
	const P = { x: 44, y: 40, size: 344 };
	const px = (x: number) => P.x + ((x + 1) / 2) * P.size;
	const py = (y: number) => P.y + ((1 - y) / 2) * P.size;
	const grid = $derived(outputGrid(net, 50));
	const shading = $derived(bands(grid, P.x, P.y, P.size, 6, 0.5));
	const boundary = $derived(zeroLine(grid, P.x, P.y, P.size));
	const points = $derived(run.data.map((e) => ({ ...e, px: px(e.x), py: py(e.y) })));
	const dotsA = $derived(
		dots(
			points.filter((p) => p.label === 0),
			3.6
		)
	);
	const dotsB = $derived(
		dots(
			points.filter((p) => p.label === 1),
			3.6
		)
	);
	// The examples on the wrong side of the boundary get a ring.
	const wrong = $derived(
		dots(
			points.filter((p) => predict(net, [p.x, p.y]) > 0.5 !== (p.label === 1)),
			6
		)
	);

	// ---- the network diagram --------------------------------------------------------------
	const sizes = $derived(net.sizes);
	const NET = { x0: 470, x1: 902, yMid: 232, h: 360 };
	const maxN = $derived(Math.max(...sizes));
	const gap = $derived(Math.min(64, NET.h / maxN));
	const S = $derived(Math.min(50, gap - 8));
	const colX = $derived.by(() => {
		const n = sizes.length;
		const spacing = Math.min(160, (NET.x1 - NET.x0) / (n - 1));
		const mid = (NET.x0 + NET.x1) / 2;
		return sizes.map((_, l) => mid + (l - (n - 1) / 2) * spacing);
	});
	const nodeY = (l: number, j: number) => NET.yMid + (j - (sizes[l] - 1) / 2) * gap;
	const thumbs = $derived(neuronGrids(net, 10));
	const nodes = $derived(
		sizes.flatMap((m, l) =>
			Array.from({ length: m }, (_, j) => {
				const cx = colX[l];
				const cy = nodeY(l, j);
				return {
					key: `${l}-${j}`,
					l,
					j,
					cx,
					cy,
					bands: bands(thumbs[l][j], cx - S / 2, cy - S / 2, S, 3, 0.85)
				};
			})
		)
	);
	const edges = $derived(
		net.W.flatMap((w, l) => {
			const nIn = sizes[l];
			return Array.from(w, (v, idx) => {
				const i = idx % nIn;
				const j = Math.floor(idx / nIn);
				return {
					key: `${l}-${i}-${j}`,
					x1: colX[l] + S / 2,
					y1: nodeY(l, i),
					x2: colX[l + 1] - S / 2,
					y2: nodeY(l + 1, j),
					color: v >= 0 ? 'var(--nn-pos)' : 'var(--nn-neg)',
					width: Number.isFinite(v) ? 0.6 + 3.4 * Math.min(1, Math.abs(v) / 3) : 0.6,
					w: v
				};
			});
		})
	);
	const heading = (l: number) =>
		l === 0 ? 'inputs' : l === sizes.length - 1 ? 'output' : `hidden ${l}`;

	// ---- readouts ----------------------------------------------------------------------
	const loss = $derived(run.losses[k]);
	const acc = $derived(run.accuracies[k]);
	const solvedAt = $derived.by(() => {
		for (let e = 0; e <= k; e++) if (run.accuracies[e] === 1) return e;
		return -1;
	});
	const right = $derived(Math.round(acc * run.data.length));
	const diverged = $derived(run.divergedAt >= 0 && k >= run.divergedAt);
	// Once the weights are not numbers the network gives no answer, so there is nothing to count.
	const rightText = $derived(
		diverged
			? 'none: the network gives no answer'
			: `${right} of ${run.data.length} (${Math.round(acc * 100)}%)`
	);
	const verdict = $derived.by(() => {
		if (diverged) return 'diverged: the steps were too big and the weights blew up';
		if (solvedAt >= 0) return `first got every point right at epoch ${solvedAt}`;
		if (k === 0) return 'random weights: training starts…';
		if (k >= MAX_EPOCHS) {
			const best = Math.round(100 * Math.max(...run.accuracies));
			return `after ${MAX_EPOCHS} epochs: still ${run.data.length - right} wrong (best ${best}%)`;
		}
		return 'training…';
	});
	const arch = $derived(
		`${sizes.join(' → ')}${sizes.length > 2 ? ` · ${ACT_NAMES[s.spec.act]}` : ''} · η = ${s.spec.lr}`
	);
	const collapsed = $derived(s.spec.act === 'linear' && sizes.length > 2);

	// ---- loss plot -------------------------------------------------------------------------
	const L = { x: 72, y: 448, w: 300, h: 92 };
	const xMax = $derived(
		k >= MAX_EPOCHS ? MAX_EPOCHS : Math.max(20, Math.ceil((k * 1.15) / 10) * 10)
	);
	const yMax = $derived(Math.max(0.8, Math.min(1.6, run.losses[0] * 1.1)));
	const lossPath = $derived.by(() => {
		const n = k + 1;
		const stride = Math.max(1, Math.floor(n / 200));
		let d = '';
		for (let e = 0; e < n; e += stride) {
			const x = L.x + (e / xMax) * L.w;
			const y = L.y + L.h - (Math.min(run.losses[e], yMax) / yMax) * L.h;
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		if ((n - 1) % stride) {
			const y = L.y + L.h - (Math.min(run.losses[k], yMax) / yMax) * L.h;
			d += `L${(L.x + (k / xMax) * L.w).toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});
	const guessY = $derived(L.y + L.h - (Math.LN2 / yMax) * L.h);

	// ---- activation inset (the "without the bend" step) ---------------------------------------
	const C = { x: 776, y: 470, w: 150, h: 84 };
	const curvePath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 60; i++) {
			const z = -3 + (6 * i) / 60;
			const v = Math.max(-2.2, Math.min(2.2, activate(s.spec.act, z)));
			const x = C.x + (i / 60) * C.w;
			const y = C.y + C.h / 2 - (v / 1.6) * (C.h / 2);
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});
</script>

<g>
	<!-- the plane -->
	<rect x={P.x} y={P.y} width={P.size} height={P.size} fill="var(--nn-mid)" />
	{#each shading as b (b.key)}
		<path d={b.d} fill={b.fill} />
	{/each}
	<path d={boundary} fill="none" stroke="var(--nn-edge)" stroke-width="2" stroke-linecap="round" />
	<path d={dotsA} fill="var(--nn-a)" stroke="var(--stage-bg)" stroke-width="1" />
	<path d={dotsB} fill="var(--nn-b)" stroke="var(--stage-bg)" stroke-width="1" />
	<path d={wrong} fill="none" stroke="var(--stage-ink)" stroke-width="1.4" />
	<rect
		x={P.x}
		y={P.y}
		width={P.size}
		height={P.size}
		fill="none"
		stroke="var(--stage-line)"
		rx="2"
	/>
	<Readout id="plane-labels">
		<Label
			anchor="start"
			x={P.x}
			y={P.y - 12}
			text="the network's answer over the plane"
			size={13}
			weight={600}
		/>
		<Label x={P.x + P.size} y={P.y + P.size + 16} text="x₁ →" anchor="end" size={12} muted />
		<text
			class="halo muted"
			transform="translate({P.x - 10} {P.y}) rotate(-90)"
			text-anchor="end"
			style:font-size="12px">x₂ →</text
		>
	</Readout>

	<!-- the network -->
	{#each edges as e (e.key)}
		<line
			x1={e.x1}
			y1={e.y1}
			x2={e.x2}
			y2={e.y2}
			stroke={e.color}
			stroke-width={e.width}
			opacity="0.7"
		/>
	{/each}
	{#each nodes as n (n.key)}
		<g>
			<rect x={n.cx - S / 2} y={n.cy - S / 2} width={S} height={S} fill="var(--nn-mid)" />
			{#each n.bands as b (b.key)}
				<path d={b.d} fill={b.fill} />
			{/each}
			<rect
				x={n.cx - S / 2}
				y={n.cy - S / 2}
				width={S}
				height={S}
				fill="none"
				stroke={n.l === sizes.length - 1 ? 'var(--nn-edge)' : 'var(--stage-line)'}
				stroke-width={n.l === sizes.length - 1 ? 2 : 1}
				rx="2"
			/>
		</g>
	{/each}
	{#if edges.length <= 2}
		<Readout id="single-weights">
			{#each edges as e, i (e.key)}
				<Label
					x={(e.x1 + e.x2) / 2}
					y={(e.y1 + e.y2) / 2 + (i ? 22 : -12)}
					text="w{i ? '₂' : '₁'} = {fix(e.w)}"
					anchor="middle"
					size={12}
					weight={600}
					color={e.color}
				/>
			{/each}
			<Label
				x={colX[1]}
				y={nodeY(1, 0) - S / 2 - 10}
				text="b = {fix(net.b[0][0])}"
				anchor="middle"
				size={12}
				muted
			/>
		</Readout>
	{/if}
	<Readout id="net-labels">
		{#each colX as x, l (l)}
			<Label {x} y={34} text={heading(l)} anchor="middle" size={12} muted />
		{/each}
		<Label x={colX[0] - S / 2 - 8} y={nodeY(0, 0) + 4} text="x₁" anchor="end" size={13} />
		<Label x={colX[0] - S / 2 - 8} y={nodeY(0, 1) + 4} text="x₂" anchor="end" size={13} />
		<Label
			x={colX[colX.length - 1]}
			y={nodeY(sizes.length - 1, 0) + S / 2 + 18}
			text="= the plane"
			anchor="middle"
			size={11}
			muted
		/>
	</Readout>

	<!-- loss after every epoch -->
	<line x1={L.x} x2={L.x + L.w} y1={L.y + L.h} y2={L.y + L.h} stroke="var(--stage-line)" />
	<line x1={L.x} x2={L.x} y1={L.y} y2={L.y + L.h} stroke="var(--stage-line)" />
	<line
		x1={L.x}
		x2={L.x + L.w}
		y1={guessY}
		y2={guessY}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<path
		d={lossPath}
		fill="none"
		stroke="var(--explainer-accent, var(--accent))"
		stroke-width="2.2"
	/>
	<Readout id="loss-axes">
		<Label x={L.x - 6} y={L.y + L.h + 4} text="0" anchor="end" size={11} muted />
		<Label x={L.x - 6} y={guessY + 4} text="0.693" anchor="end" size={11} muted />
		<Label x={L.x + L.w} y={guessY - 5} text="50/50 guess" anchor="end" size={11} muted />
		<Label x={L.x} y={L.y + L.h + 16} text="0" anchor="middle" size={11} muted />
		<Label x={L.x + L.w} y={L.y + L.h + 16} text={String(xMax)} anchor="middle" size={11} muted />
		<Label x={L.x + L.w / 2} y={L.y + L.h + 30} text="epoch →" anchor="middle" size={12} muted />
		<Label anchor="start" x={L.x - 44} y={L.y - 10} text="loss (cross-entropy)" size={12} muted />
	</Readout>

	<!-- readouts -->
	<Readout id="epoch" order={1} label="Epoch" value="{k} · loss {fmt(loss)}">
		<Label
			anchor="start"
			x={448}
			y={472}
			text="epoch {k} · loss {fmt(loss)}"
			size={15}
			weight={600}
		/>
	</Readout>
	<Readout id="right" order={2} label="Right" value={rightText}>
		<Label anchor="start" x={448} y={494} text="right: {rightText}" size={13} />
	</Readout>
	<Readout id="verdict" order={3} label="So far" value={verdict}>
		<Label anchor="start" x={448} y={515} text={verdict} size={13} />
	</Readout>
	<Readout id="arch" order={4} label="Network" value={arch}>
		<Label anchor="start" x={448} y={536} text="network {arch}" size={12} muted />
	</Readout>
	{#if collapsed}
		<Readout id="collapsed" order={5} label="No activation" value="the layers act as one neuron">
			<Label
				anchor="start"
				x={448}
				y={557}
				text="no activation: the layers act as one neuron"
				size={12}
				color="var(--nn-back)"
			/>
		</Readout>
	{/if}

	{#if s.curve}
		<g>
			<line
				x1={C.x}
				x2={C.x + C.w}
				y1={C.y + C.h / 2}
				y2={C.y + C.h / 2}
				stroke="var(--stage-grid)"
			/>
			<line
				x1={C.x + C.w / 2}
				x2={C.x + C.w / 2}
				y1={C.y}
				y2={C.y + C.h}
				stroke="var(--stage-grid)"
			/>
			<clipPath id="nn-curve-clip">
				<rect x={C.x} y={C.y} width={C.w} height={C.h} />
			</clipPath>
			<path
				d={curvePath}
				fill="none"
				stroke="var(--nn-back)"
				stroke-width="2.4"
				clip-path="url(#nn-curve-clip)"
			/>
			<Readout id="curve">
				<Label
					x={C.x + C.w / 2}
					y={C.y - 8}
					text="activation: {ACT_NAMES[s.spec.act]}"
					anchor="middle"
					size={12}
					weight={600}
				/>
				<Label x={C.x + C.w} y={C.y + C.h + 14} text="sum z →" anchor="end" size={11} muted />
			</Readout>
		</g>
	{/if}
</g>
