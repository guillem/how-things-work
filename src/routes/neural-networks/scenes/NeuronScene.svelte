<script lang="ts">
	/**
	 * One neuron with hand-set weights. Left: the plane shaded by the neuron's output σ(z), the
	 * straight line z = 0, the two clusters, and a draggable point (the input being fed in).
	 * Right: the neuron itself, with the point's numbers flowing through it: inputs × weights,
	 * plus the bias, into the sum z, through the sigmoid, out as p.
	 */
	import { Handle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { dataset, sigmoid } from '../network';
	import { bands, cellCoord, dots, fix, fmt } from './shared';
	import Txt from './Txt.svelte';

	let { t, params, setParam, reduced }: StageProps = $props();

	const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
	const w1 = $derived(num(params.w1, 2));
	const w2 = $derived(num(params.w2, 1.5));
	const b = $derived(num(params.b, -0.5));
	const probe = $derived.by((): [number, number] => {
		const raw = typeof params.probe === 'string' ? params.probe.split(',').map(Number) : [];
		return raw.length === 2 && raw.every(Number.isFinite) ? [raw[0], raw[1]] : [0.35, -0.2];
	});

	// ---- the plane ----------------------------------------------------------------------
	const P = { x: 44, y: 40, size: 344 };
	const px = (x: number) => P.x + ((x + 1) / 2) * P.size;
	const py = (y: number) => P.y + ((1 - y) / 2) * P.size;
	const N = 44;
	const grid = $derived(
		Array.from({ length: N }, (_, j) =>
			Array.from(
				{ length: N },
				(_, i) => 2 * sigmoid(w1 * cellCoord(i, N) + w2 * -cellCoord(j, N) + b) - 1
			)
		)
	);
	const shading = $derived(bands(grid, P.x, P.y, P.size, 5, 0.5));
	// The line w₁x₁ + w₂x₂ + b = 0, clipped to the square.
	const line = $derived.by(() => {
		const pts: [number, number][] = [];
		const add = (x: number, y: number) => {
			if (Math.abs(x) <= 1.0001 && Math.abs(y) <= 1.0001) pts.push([x, y]);
		};
		if (Math.abs(w2) > 1e-9) {
			add(-1, (-b + w1) / w2);
			add(1, (-b - w1) / w2);
		}
		if (Math.abs(w1) > 1e-9) {
			add((-b + w2) / w1, -1);
			add((-b - w2) / w1, 1);
		}
		if (pts.length < 2) return null;
		// The two points furthest apart (corners can appear twice).
		let best: [[number, number], [number, number]] = [pts[0], pts[1]];
		let dmax = -1;
		for (const p of pts)
			for (const q of pts) {
				const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
				if (d > dmax) {
					dmax = d;
					best = [p, q];
				}
			}
		return best;
	});
	const data = dataset('clusters');
	const dotsA = dots(
		data.filter((e) => e.label === 0).map((e) => ({ px: px(e.x), py: py(e.y) })),
		3.2
	);
	const dotsB = dots(
		data.filter((e) => e.label === 1).map((e) => ({ px: px(e.x), py: py(e.y) })),
		3.2
	);

	let lastKey = '';
	function move(p: { x: number; y: number }) {
		const x = Math.max(-1, Math.min(1, ((p.x - P.x) / P.size) * 2 - 1));
		const y = Math.max(-1, Math.min(1, 1 - ((p.y - P.y) / P.size) * 2));
		setParam('probe', `${x.toFixed(3)},${y.toFixed(3)}`);
	}
	function key(stepBy: number | 'start' | 'end') {
		const [x, y] = probe;
		const d = typeof stepBy === 'number' ? stepBy * 0.05 : stepBy === 'start' ? -2 : 2;
		const vertical = lastKey === 'ArrowUp' || lastKey === 'ArrowDown';
		const nx = vertical ? x : Math.max(-1, Math.min(1, x + d));
		const ny = vertical ? Math.max(-1, Math.min(1, y + d)) : y;
		setParam('probe', `${nx.toFixed(3)},${ny.toFixed(3)}`);
	}

	// ---- the neuron --------------------------------------------------------------------
	const z = $derived(w1 * probe[0] + w2 * probe[1] + b);
	const p = $derived(sigmoid(z));
	const IN1 = { x: 482, y: 150 };
	const IN2 = { x: 482, y: 320 };
	const SUM = { x: 660, y: 235, r: 30 };
	const SIG = { x: 760, y: 200, w: 96, h: 70 };
	const OUT = { x: 912, y: 235 };
	const BIAS = { x: 660, y: 112 };
	const edges = $derived([
		{ key: 'w1', from: IN1, w: w1 },
		{ key: 'w2', from: IN2, w: w2 }
	]);
	// Sigmoid curve in its box, z from −6 to 6.
	const sx = (zz: number) => SIG.x + ((zz + 6) / 12) * SIG.w;
	const sy = (v: number) => SIG.y + SIG.h - v * SIG.h;
	const sigPath = Array.from({ length: 49 }, (_, i) => {
		const zz = -6 + (12 * i) / 48;
		return `${i ? 'L' : 'M'}${sx(zz).toFixed(1)} ${sy(sigmoid(zz)).toFixed(1)}`;
	}).join('');
	const zc = $derived(Math.max(-6, Math.min(6, z)));

	// Pulses flowing left to right (hidden under reduced motion: the numbers tell the story).
	const u = $derived(reduced ? -1 : (t % 2.4) / 2.4);
	const pulse = (
		a: { x: number; y: number },
		c: { x: number; y: number },
		from: number,
		to: number
	) => {
		if (u < from || u > to) return null;
		const f = (u - from) / (to - from);
		return { x: a.x + (c.x - a.x) * f, y: a.y + (c.y - a.y) * f, o: Math.sin(Math.PI * f) };
	};
	const pulses = $derived(
		[
			pulse({ x: IN1.x + 20, y: IN1.y }, { x: SUM.x - SUM.r, y: SUM.y }, 0, 0.4),
			pulse({ x: IN2.x + 20, y: IN2.y }, { x: SUM.x - SUM.r, y: SUM.y }, 0, 0.4),
			pulse({ x: BIAS.x, y: BIAS.y + 12 }, { x: SUM.x, y: SUM.y - SUM.r }, 0.1, 0.4),
			pulse({ x: SUM.x + SUM.r, y: SUM.y }, { x: SIG.x - 4, y: SUM.y }, 0.4, 0.62),
			pulse({ x: SIG.x + SIG.w + 4, y: SUM.y }, { x: OUT.x - 18, y: OUT.y }, 0.62, 0.85)
		].flatMap((q, i) => (q ? [{ ...q, key: i }] : []))
	);
	const signed = (v: number, d = 2) => (v < 0 ? `− ${fix(-v, d)}` : `+ ${fix(v, d)}`);
	const par = (v: number) => (v < 0 ? `(${fix(v)})` : fix(v));
	const wColor = (w: number) => (w >= 0 ? 'var(--nn-pos)' : 'var(--nn-neg)');
</script>

<g>
	<!-- the plane -->
	<rect x={P.x} y={P.y} width={P.size} height={P.size} fill="var(--nn-mid)" />
	{#each shading as s (s.key)}
		<path d={s.d} fill={s.fill} />
	{/each}
	<path d={dotsA} fill="var(--nn-a)" stroke="var(--stage-bg)" stroke-width="1" opacity="0.75" />
	<path d={dotsB} fill="var(--nn-b)" stroke="var(--stage-bg)" stroke-width="1" opacity="0.75" />
	{#if line}
		<line
			x1={px(line[0][0])}
			y1={py(line[0][1])}
			x2={px(line[1][0])}
			y2={py(line[1][1])}
			stroke="var(--nn-edge)"
			stroke-width="2.2"
		/>
	{/if}
	<rect
		x={P.x}
		y={P.y}
		width={P.size}
		height={P.size}
		fill="none"
		stroke="var(--stage-line)"
		rx="2"
	/>
	<g onkeydowncapture={(e: KeyboardEvent) => (lastKey = e.key)} role="presentation">
		<Handle
			x={px(probe[0])}
			y={py(probe[1])}
			label="Input point (x₁, x₂)"
			value={probe[0]}
			min={-1}
			max={1}
			valuetext="x₁ = {fix(probe[0])}, x₂ = {fix(probe[1])}"
			color="var(--stage-ink)"
			r={7}
			onmove={move}
			onkey={key}
		/>
	</g>
	<Readout id="plane-labels">
		<Txt x={P.x} y={P.y - 12} text="the neuron's answer over the plane" size={13} weight={600} />
		<Txt x={P.x + P.size} y={P.y + P.size + 16} text="x₁ →" anchor="end" size={12} muted />
		<text
			class="halo muted"
			transform="translate({P.x - 10} {P.y}) rotate(-90)"
			text-anchor="end"
			style:font-size="12px">x₂ →</text
		>
	</Readout>
	<Readout
		id="line"
		order={3}
		label="Boundary (z = 0)"
		value="{fix(w1, 1)} x₁ {signed(w2, 1)} x₂ {signed(b, 1)} = 0: a straight line"
	>
		<Txt
			x={P.x}
			y={P.y + P.size + 44}
			text="boundary, where z = 0: {fix(w1, 1)} x₁ {signed(w2, 1)} x₂ {signed(b, 1)} = 0"
			size={13}
			weight={600}
		/>
		<Txt
			x={P.x}
			y={P.y + P.size + 64}
			text="always a straight line: the weights turn it, the bias slides it"
			size={12}
			muted
		/>
	</Readout>

	<!-- the neuron -->
	{#each edges as e (e.key)}
		<line
			x1={e.from.x + 20}
			y1={e.from.y}
			x2={SUM.x - SUM.r}
			y2={SUM.y}
			stroke={wColor(e.w)}
			stroke-width={0.8 + 3 * Math.min(1, Math.abs(e.w) / 3)}
		/>
	{/each}
	<line
		x1={BIAS.x}
		y1={BIAS.y + 12}
		x2={SUM.x}
		y2={SUM.y - SUM.r}
		stroke={wColor(b)}
		stroke-width="1.6"
	/>
	<line
		x1={SUM.x + SUM.r}
		y1={SUM.y}
		x2={SIG.x - 4}
		y2={SUM.y}
		stroke="var(--stage-line)"
		stroke-width="1.6"
	/>
	<line
		x1={SIG.x + SIG.w + 4}
		y1={SUM.y}
		x2={OUT.x - 18}
		y2={OUT.y}
		stroke="var(--stage-line)"
		stroke-width="1.6"
		marker-end="url(#arrowhead)"
	/>
	{#each [IN1, IN2] as n, i (i)}
		<circle cx={n.x} cy={n.y} r="20" fill="var(--surface)" stroke="var(--stage-line)" />
	{/each}
	<circle
		cx={SUM.x}
		cy={SUM.y}
		r={SUM.r}
		fill="var(--surface)"
		stroke="var(--nn-edge)"
		stroke-width="1.6"
	/>
	<rect
		x={SIG.x - 4}
		y={SIG.y - 4}
		width={SIG.w + 8}
		height={SIG.h + 8}
		rx="6"
		fill="var(--surface)"
		stroke="var(--stage-line)"
	/>
	<line x1={SIG.x} x2={SIG.x + SIG.w} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--stage-grid)" />
	<path d={sigPath} fill="none" stroke="var(--nn-back)" stroke-width="2.2" />
	<circle cx={sx(zc)} cy={sy(sigmoid(zc))} r="4.5" fill="var(--stage-ink)" />
	{#each pulses as q (q.key)}
		<circle cx={q.x} cy={q.y} r="4" fill="var(--nn-fwd)" opacity={q.o} />
	{/each}

	<Readout id="in1" order={1} label="Inputs" value="x₁ = {fix(probe[0])}, x₂ = {fix(probe[1])}">
		<Txt x={IN1.x} y={IN1.y + 5} text={fix(probe[0])} anchor="middle" size={13} weight={600} />
		<Txt x={IN2.x} y={IN2.y + 5} text={fix(probe[1])} anchor="middle" size={13} weight={600} />
		<Txt x={IN1.x} y={IN1.y - 28} text="input x₁" anchor="middle" size={12} muted />
		<Txt x={IN2.x} y={IN2.y + 38} text="input x₂" anchor="middle" size={12} muted />
	</Readout>
	<Readout id="weights">
		<Txt
			x={548}
			y={158}
			text="× w₁ = {fix(w1, 1)}"
			anchor="middle"
			size={13}
			color={wColor(w1)}
			weight={600}
		/>
		<Txt
			x={566}
			y={332}
			text="× w₂ = {fix(w2, 1)}"
			anchor="middle"
			size={13}
			color={wColor(w2)}
			weight={600}
		/>
		<Txt
			x={BIAS.x}
			y={BIAS.y}
			text="+ bias b = {fix(b, 1)}"
			anchor="middle"
			size={13}
			color={wColor(b)}
			weight={600}
		/>
		<Txt x={SUM.x} y={SUM.y + 6} text="Σ" anchor="middle" size={18} weight={600} />
		<Txt x={SUM.x} y={SUM.y + SUM.r + 18} text="sum z" anchor="middle" size={12} muted />
		<Txt
			x={SIG.x + SIG.w / 2}
			y={SIG.y + SIG.h + 22}
			text="sigmoid σ"
			anchor="middle"
			size={12}
			muted
		/>
		<Txt x={OUT.x} y={OUT.y - 22} text="output" anchor="middle" size={12} muted />
		<Txt x={OUT.x + 2} y={OUT.y + 5} text={fix(p)} anchor="middle" size={15} weight={600} />
	</Readout>
	<Readout
		id="sum"
		order={2}
		label="Sum and output"
		value="z = {fmt(z)} → σ(z) = {fix(p)}: {Math.round(p * 100)}% blue"
	>
		<Txt
			x={470}
			y={420}
			text="z = {fix(w1, 1)} × {par(probe[0])} {signed(w2, 1)} × {par(probe[1])} {signed(
				b,
				1
			)} = {fix(z)}"
			size={14}
			weight={600}
		/>
		<Txt
			x={470}
			y={446}
			text="output σ(z) = 1 / (1 + e⁻ᶻ) = {fix(p)}: {Math.round(p * 100)}% sure it is blue"
			size={14}
			color={p >= 0.5 ? 'var(--nn-b)' : 'var(--nn-a)'}
			weight={600}
		/>
		<Txt
			x={470}
			y={472}
			text="drag the point on the plane to feed in other inputs"
			size={12}
			muted
		/>
	</Readout>
</g>
