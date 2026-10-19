<script lang="ts">
	/**
	 * Scalar multiplication on y² = x³ + 7 over F₉₇ (79 points), with G = (1, 28).
	 *
	 * Phases (`step.hints.phase`):
	 *   multiply — double-and-add for k = `params.k`: k in binary, then one row per operation,
	 *              revealed one by one (0.8 s each); on the grid an arrow from each running
	 *              result to the next
	 *   dlog     — Eve's search: the target kG ringed, and G, 2G, 3G, … joined in order as she
	 *              tries them (10 a second) until she lands on it; loops after a pause
	 *
	 * Both are functions of t; reduced motion shows the finished calculation and search.
	 */
	import { clamp, cycle, Flow, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TOY, TOY_G, TOY_N, multiply } from '../ecc';
	import { GRID, TOY_MULTIPLES, TOY_POINTS, gridOf, kG, pointText, toN, type NPoint } from './grid';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'multiply'));
	const k = $derived(clamp(Math.round(Number(params.k ?? 53)), 1, TOY_N - 1));
	const g = gridOf(97);
	const at = (q: NPoint) => g.at(q.x, q.y);
	const G = toN(TOY_G) as NPoint;

	// ---- double-and-add -------------------------------------------------------------------------
	const run = $derived(multiply(TOY, BigInt(k), TOY_G));
	const ops = $derived(
		run.ops.map((o) => ({ op: o.op, m: Number(o.multiple), P: toN(o.result) as NPoint }))
	);
	const bits = $derived(k.toString(2));
	const OP_T = 0.8;
	const shownOps = $derived(
		reduced ? ops.length : clamp(Math.floor((t - 0.6) / OP_T) + 1, 0, ops.length)
	);
	/** Arrow from a to b, stopping short of both dots. */
	const arrow = (a: NPoint, b: NPoint) => {
		const A = at(a);
		const B = at(b);
		const d = Math.hypot(B.x - A.x, B.y - A.y) || 1;
		const ux = (B.x - A.x) / d;
		const uy = (B.y - A.y) / d;
		return `M${A.x + ux * 8} ${A.y + uy * 8} L${B.x - ux * 10} ${B.y - uy * 10}`;
	};
	const chain = $derived([G, ...ops.map((o) => o.P)]);

	// ---- Eve's search ---------------------------------------------------------------------------
	const target = $derived(kG(k) as NPoint);
	const RATE = 10;
	const searchEnd = $derived(0.6 + k / RATE);
	const period = $derived(searchEnd + 4);
	const su = $derived(reduced ? 1e6 : cycle(t, period) * period);
	const tried = $derived(clamp(Math.floor((su - 0.6) * RATE) + 1, 0, k));
	const found = $derived(tried >= k);
	const walk = $derived(
		TOY_MULTIPLES.slice(0, tried)
			.map((q, i) => `${i ? 'L' : 'M'}${at(q).x.toFixed(1)} ${at(q).y.toFixed(1)}`)
			.join(' ')
	);

	const rowY = (i: number) => 196 + i * 25;
	const opText = (o: { op: string; m: number; P: NPoint }) =>
		`${o.op === 'double' ? 'double' : 'add G'}  →  ${o.m}G = ${pointText(o.P)}`;
	const fade = $derived(smoothstep(0, 0.4, t));
</script>

<g>
	<rect
		x={GRID.x0}
		y={GRID.y0}
		width={GRID.size}
		height={GRID.size}
		fill="var(--surface)"
		stroke="var(--border)"
		rx="4"
	/>
	{#each [0, 48, 96] as v (v)}
		<Readout id="tx{v}">
			<Label x={g.at(v, 0).x} y={GRID.y0 + GRID.size + 18} text={String(v)} size={11} muted />
			<Label x={GRID.x0 - 8} y={g.at(0, v).y + 4} text={String(v)} size={11} anchor="end" muted />
		</Readout>
	{/each}
	<Label
		x={GRID.x0 + GRID.size}
		y={GRID.y0 + GRID.size + 36}
		text="x (mod 97)"
		size={12}
		anchor="end"
		italic
	/>

	{#each TOY_POINTS as q (q.x * 1000 + q.y)}
		{@const c = at(q)}
		<circle cx={c.x} cy={c.y} r={g.r} fill="var(--ecc-curve)" opacity="0.45" />
	{/each}

	{#if phase === 'multiply'}
		{#each ops.slice(0, shownOps) as o, i (i)}
			<Flow
				d={arrow(chain[i], o.P)}
				color={o.op === 'double' ? 'var(--ecc-p)' : 'var(--ecc-q)'}
				width={2}
				arrow
				opacity={0.85}
			/>
		{/each}
		{#each chain.slice(0, shownOps + 1) as q, i (i)}
			{@const c = at(q)}
			{@const last = i === shownOps}
			<circle
				cx={c.x}
				cy={c.y}
				r={last ? 8 : 5.5}
				fill={last ? 'var(--ecc-sum)' : 'var(--ecc-p)'}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/each}
		<Label
			x={at(G).x + 12}
			y={at(G).y - 10}
			text="G"
			weight={700}
			anchor="start"
			color="var(--ecc-p)"
		/>
		{#if shownOps === ops.length && ops.length > 0}
			{@const c = at(chain[ops.length])}
			<Label
				x={c.x + (c.x > 480 ? -14 : 14)}
				y={c.y - 12}
				text="{k}G"
				weight={700}
				anchor={c.x > 480 ? 'end' : 'start'}
				color="var(--ecc-sum)"
			/>
		{/if}

		<!-- the recipe -->
		<Readout id="k" order={0} label="k" value="{k} = {bits} in binary">
			<Label x={610} y={60} text="k = {k}" size={20} weight={700} anchor="start" tabular />
			<Label x={610} y={86} text="in binary: {bits}" size={14} anchor="start" mono />
		</Readout>
		<Readout id="rule">
			<Label
				x={610}
				y={116}
				text="after the first 1: every digit → double;"
				size={12}
				anchor="start"
				muted
			/>
			<Label x={610} y={134} text="a 1 → then add G" size={12} anchor="start" muted />
		</Readout>
		<Label
			x={610}
			y={172}
			text="start: G = {pointText(G)}"
			size={13}
			anchor="start"
			tabular
			color="var(--ecc-p)"
			weight={600}
		/>
		{#each ops as o, i (i)}
			<Label
				x={610}
				y={rowY(i)}
				text={opText(o)}
				size={13}
				anchor="start"
				tabular
				color={o.op === 'double' ? 'var(--ecc-p)' : 'var(--ecc-q)'}
				opacity={i < shownOps ? 1 : 0.3}
			/>
		{/each}
		<Readout
			id="count"
			order={1}
			label="Operations"
			value="{ops.length} instead of {k - 1} additions"
			opacity={shownOps === ops.length ? 1 : 0}
		>
			<Label
				x={610}
				y={rowY(ops.length) + 14}
				text={k === 1
					? 'k = 1: kG is G itself'
					: `${ops.length} operations instead of ${k - 1} additions`}
				size={14}
				weight={700}
				anchor="start"
				opacity={shownOps === ops.length ? 1 : 0}
			/>
		</Readout>
	{:else}
		{#if tried > 0}
			<path
				d={walk}
				fill="none"
				stroke="var(--ecc-eve)"
				stroke-width="1.3"
				opacity="0.55"
				stroke-linejoin="round"
			/>
		{/if}
		{#each TOY_MULTIPLES.slice(0, tried) as q, i (i)}
			{@const c = at(q)}
			<circle cx={c.x} cy={c.y} r="4.5" fill="var(--ecc-eve)" opacity="0.85" />
		{/each}
		{#if tried > 0 && !found}
			{@const c = at(TOY_MULTIPLES[tried - 1])}
			<circle cx={c.x} cy={c.y} r="9" fill="none" stroke="var(--ecc-eve)" stroke-width="2" />
		{/if}
		<circle
			cx={at(target).x}
			cy={at(target).y}
			r="11"
			fill="none"
			stroke="var(--ecc-sum)"
			stroke-width="3"
		/>
		<circle cx={at(target).x} cy={at(target).y} r="6" fill="var(--ecc-sum)" />
		<Label
			x={at(target).x + (at(target).x > 480 ? -16 : 16)}
			y={at(target).y + 5}
			text="Q"
			weight={700}
			size={14}
			anchor={at(target).x > 480 ? 'end' : 'start'}
			color="var(--ecc-sum)"
		/>
		<Label
			x={at(G).x + 12}
			y={at(G).y - 10}
			text="G"
			weight={700}
			anchor="start"
			color="var(--ecc-p)"
		/>

		<Readout
			id="target"
			order={0}
			label="Eve sees"
			value="G = {pointText(G)}, Q = {pointText(target)}"
		>
			<Label
				x={610}
				y={60}
				text="Eve sees G = {pointText(G)}"
				size={14}
				anchor="start"
				tabular
				weight={600}
			/>
			<Label
				x={610}
				y={84}
				text="and Q = {pointText(target)}: Q = ?·G"
				size={14}
				anchor="start"
				tabular
				weight={600}
				color="var(--ecc-sum)"
			/>
		</Readout>
		<Readout
			id="tries"
			order={1}
			label="Eve's tries"
			value={found ? `${k}: k = ${k}` : String(tried)}
		>
			<Label
				x={610}
				y={140}
				text={found
					? `found after ${k} tries: k = ${k}`
					: `trying ${tried}G = ${pointText(TOY_MULTIPLES[Math.max(0, tried - 1)])}`}
				size={15}
				weight={700}
				anchor="start"
				tabular
				color="var(--ecc-eve)"
				opacity={fade}
			/>
		</Readout>
		<Readout id="alice" order={2} label="Alice's work" value="{ops.length} operations">
			<Label
				x={610}
				y={176}
				text="Alice made Q with {ops.length} operations"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="pattern">
			<Label
				x={610}
				y={214}
				text="the line joins G, 2G, 3G, … in order:"
				size={12}
				anchor="start"
				muted
			/>
			<Label x={610} y={232} text="each step lands anywhere" size={12} anchor="start" muted />
		</Readout>
		<Readout
			id="real"
			order={3}
			label="secp256k1"
			value="about 2¹²⁸ steps even for the best attack"
		>
			<Label
				x={610}
				y={420}
				text="on secp256k1: n ≈ 1.16 × 10⁷⁷ points"
				size={13}
				anchor="start"
				weight={600}
			/>
			<Label x={610} y={442} text="Alice: ≈ 383 operations" size={13} anchor="start" />
			<Label
				x={610}
				y={464}
				text="Eve, best known attack: ≈ 2¹²⁸ ≈ 3 × 10³⁸"
				size={13}
				anchor="start"
				color="var(--ecc-eve)"
			/>
		</Readout>
	{/if}
</g>
