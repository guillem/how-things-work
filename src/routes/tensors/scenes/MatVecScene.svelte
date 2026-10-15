<script lang="ts">
	/**
	 * Matrix times vector along the shared axis (step matvec).
	 *
	 * M is 3 × 4 and v has 4 numbers (`params.vlen` = 'match') or 3 ('short'). Row by row (3 s
	 * each, then a 1.5 s rest), copies of v's numbers fly from v onto the row, each pair is
	 * multiplied, and the sum lands in the result. The rows axis is coloured "kept", the columns
	 * axis and v's axis "combined". With a short v the fourth column has no partner and the
	 * product is refused. Under reduced motion the frame shows row 0 worked out and every result.
	 */
	import { clamp, Label, type Point, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { matVec, num, tensor } from '../tensor';

	let { t, params, reduced }: StageProps = $props();

	const M = [
		[1, 2, 0, -1],
		[0, 1, 3, 2],
		[2, -1, 1, 0]
	];
	const V4 = [2, 1, -1, 3];
	const match = $derived(String(params.vlen ?? 'match') !== 'short');
	const v = $derived(match ? V4 : V4.slice(0, 3));
	const out = $derived(match ? Array.from(matVec(tensor([3, 4], M.flat()), V4).data) : null);

	const C = 62;
	const MX = 56;
	const MY = 200;
	const VX = 372;
	const VY = 170;
	const RX = 520;
	const PX = 640;
	const cellM = (r: number, c: number): Point => ({ x: MX + c * C, y: MY + r * C });
	const cellV = (k: number): Point => ({ x: VX, y: VY + k * C });
	const cellR = (r: number): Point => ({ x: RX, y: MY + r * C });

	// ---- the clock: row i is worked on during [3i, 3i + 3) s, then a rest -----------------
	const PERIOD = 3;
	const CYCLE = 3 * PERIOD + 1.5;
	const tc = $derived(t % CYCLE);
	const active = $derived(Math.min(2, Math.floor(tc / PERIOD)));
	const u = $derived(tc >= 3 * PERIOD ? 1 : (tc - active * PERIOD) / PERIOD);
	const fly = $derived(smoothstep(0.05, 0.35, u));
	const multiplied = $derived(smoothstep(0.4, 0.5, u));
	const summed = $derived(smoothstep(0.65, 0.8, u));
	/** Results shown: every row before the active one, and the active one once summed. */
	const doneRows = $derived(reduced ? 3 : tc >= 3 * PERIOD ? 3 : active + (summed > 0.5 ? 1 : 0));
	const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

	const products = $derived(M[active].map((m, k) => (k < v.length ? m * v[k] : null)));
	const fb = (n: number) => (n < 0 ? `(${num(n)})` : num(n));
	const rowText = $derived(
		M[active].map((m, k) => (k < v.length ? `${fb(m)}×${fb(v[k])}` : `${fb(m)}×?`)).join(' + ')
	);
	const resting = $derived(!reduced && tc >= 3 * PERIOD);
</script>

<g>
	<!-- ============ the matrix ============ -->
	<Label anchor="start" x={MX} y={MY - 58} text="M: shape (3, 4)" size={15} weight={700} />
	{#each M as rowVals, r (r)}
		{#each rowVals as m, c (c)}
			{@const p = cellM(r, c)}
			{@const on = r === active && !resting}
			<rect
				x={p.x}
				y={p.y}
				width={C - 4}
				height={C - 4}
				rx="6"
				fill="var(--tn-cell)"
				stroke={on ? 'var(--tn-keep)' : 'var(--stage-line)'}
				stroke-width={on ? 2.5 : 1.2}
				opacity={match || c < 3 ? 1 : 1}
			/>
			<text x={p.x + (C - 4) / 2} y={p.y + 25} text-anchor="middle" font-size="20" font-weight="600"
				>{num(m)}</text
			>
		{/each}
	{/each}
	<!-- the axes of M -->
	<line
		x1={MX}
		y1={MY - 18}
		x2={MX + 4 * C - 4}
		y2={MY - 18}
		stroke="var(--tn-combine)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<Readout id="m-cols">
		<Label
			x={MX + 2 * C}
			y={MY - 28}
			text="axis 1: columns · 4 — combined"
			anchor="middle"
			color="var(--tn-combine)"
			weight={600}
		/>
	</Readout>
	<line
		x1={MX - 16}
		y1={MY}
		x2={MX - 16}
		y2={MY + 3 * C - 4}
		stroke="var(--tn-keep)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<Readout id="m-rows">
		<g transform="rotate(-90 {MX - 26} {MY + 1.5 * C})">
			<Label
				x={MX - 26}
				y={MY + 1.5 * C}
				text="axis 0: rows · 3 — kept"
				anchor="middle"
				color="var(--tn-keep)"
				weight={600}
			/>
		</g>
	</Readout>
	<text x={MX + 4 * C + 22} y={MY + 1.5 * C + 6} text-anchor="middle" font-size="26">×</text>

	<!-- ============ the vector ============ -->
	<Label anchor="start" x={VX - 6} y={VY - 18} text="v: ({v.length},)" size={15} weight={700} />
	{#each v as x, k (k)}
		{@const p = cellV(k)}
		<rect
			x={p.x}
			y={p.y}
			width={C - 4}
			height={C - 4}
			rx="6"
			fill="var(--tn-cell)"
			stroke="var(--tn-combine)"
			stroke-width="1.5"
		/>
		<text x={p.x + (C - 4) / 2} y={p.y + 25} text-anchor="middle" font-size="20" font-weight="600"
			>{num(x)}</text
		>
	{/each}
	<line
		x1={VX + C + 6}
		y1={VY}
		x2={VX + C + 6}
		y2={VY + v.length * C - 4}
		stroke="var(--tn-combine)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<Readout id="v-axis">
		<g transform="rotate(90 {VX + C + 18} {VY + (v.length * C) / 2})">
			<Label
				x={VX + C + 18}
				y={VY + (v.length * C) / 2}
				text="axis 0 · {v.length}"
				anchor="middle"
				color="var(--tn-combine)"
				weight={600}
			/>
		</g>
	</Readout>

	<!-- ============ v's numbers flying onto the active row ============ -->
	{#if !resting}
		{#each v as x, k (k)}
			{@const from = cellV(k)}
			{@const to = cellM(active, k)}
			{@const px = lerp(from.x + 4, to.x + 4, fly)}
			{@const py = lerp(from.y + 34, to.y + 34, fly)}
			<g opacity={reduced ? 1 : smoothstep(0, 0.06, u) * (1 - smoothstep(0.92, 1, u))}>
				<rect
					x={px}
					y={py}
					width={C - 12}
					height="20"
					rx="5"
					fill="var(--tn-combine)"
					opacity="0.9"
				/>
				<text
					x={px + (C - 12) / 2}
					y={py + 15}
					text-anchor="middle"
					font-size="13"
					style:fill="#fff"
					font-weight="700"
					>{multiplied > 0.5 && products[k] !== null
						? `= ${num(products[k] ?? 0)}`
						: `× ${num(x)}`}</text
				>
			</g>
		{/each}
		{#if !match && fly > 0.9}
			{@const p = cellM(active, 3)}
			<g opacity={smoothstep(0.35, 0.45, u)}>
				<rect
					x={p.x + 4}
					y={p.y + 34}
					width={C - 12}
					height="20"
					rx="5"
					fill="none"
					stroke="var(--tn-bad)"
					stroke-width="2"
					stroke-dasharray="4 3"
				/>
				<text
					x={p.x + (C - 4) / 2}
					y={p.y + 49}
					text-anchor="middle"
					font-size="14"
					style:fill="var(--tn-bad)"
					font-weight="800">?</text
				>
			</g>
		{/if}
	{/if}

	<!-- ============ the result ============ -->
	<text x={RX - 32} y={MY + 1.5 * C + 6} text-anchor="middle" font-size="26">=</text>
	{#if match && out}
		<Label
			anchor="start"
			x={RX}
			y={MY - 18}
			text="(3,)"
			size={15}
			weight={700}
			color="var(--tn-keep)"
		/>
		{#each out as y, r (r)}
			{@const p = cellR(r)}
			{@const shown = r < doneRows}
			<rect
				x={p.x}
				y={p.y}
				width={C - 4}
				height={C - 4}
				rx="6"
				fill="var(--tn-cell)"
				stroke="var(--tn-keep)"
				stroke-width={r === active && !resting ? 2.5 : 1.5}
			/>
			{#if shown}
				<text
					x={p.x + (C - 4) / 2}
					y={p.y + 37}
					text-anchor="middle"
					font-size="20"
					font-weight="700">{num(y)}</text
				>
			{/if}
		{/each}
	{:else}
		{#each [0, 1, 2] as r (r)}
			{@const p = cellR(r)}
			<rect
				x={p.x}
				y={p.y}
				width={C - 4}
				height={C - 4}
				rx="6"
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="4 4"
			/>
		{/each}
	{/if}

	<!-- ============ the panel ============ -->
	<Readout
		id="shapes"
		order={1}
		label="Shapes"
		value={match ? '(3, 4) · (4,) → (3,)' : '(3, 4) · (3,): not aligned'}
		note={match
			? 'columns axis summed away, rows axis kept'
			: 'the shared axis must have one length'}
	>
		<text x={PX} y={MY + 3 * C + 72} class="halo" font-size="22" font-weight="700"
			>(<tspan style:fill="var(--tn-keep)">3</tspan>,&nbsp;<tspan style:fill="var(--tn-combine)"
				>4</tspan
			>) · (<tspan style:fill="var(--tn-combine)">{v.length}</tspan>,) {match ? '→ (' : ''}<tspan
				style:fill="var(--tn-keep)">{match ? '3' : ''}</tspan
			>{match ? ',)' : ''}</text
		>
		<Label
			anchor="start"
			x={PX}
			y={MY + 3 * C + 98}
			text={match
				? 'the shared axis (4) is summed away; rows are kept'
				: `4 columns but ${v.length} numbers:`}
			size={13}
			muted
		/>
		{#if !match}
			<Label
				anchor="start"
				x={PX}
				y={MY + 3 * C + 118}
				text="error: shapes (3, 4) and (3,) not aligned"
				size={14}
				weight={700}
				color="var(--tn-bad)"
			/>
		{/if}
	</Readout>
	<Readout
		id="row"
		order={2}
		label="Row {active}"
		value="{rowText}{match && out ? ` = ${num(out[active])}` : ''}"
		opacity={resting ? 0 : 1}
	>
		<g opacity={resting ? 0 : 1}>
			<Label anchor="start" x={PX} y={MY - 18} text="row {active} against v:" size={14} muted />
			{#each M[active] as m, k (k)}
				<Label
					anchor="start"
					x={PX}
					y={MY + 12 + k * 26}
					text="{k ? '+ ' : '   '}{fb(m)} × {k < v.length ? fb(v[k]) : '?'}{multiplied > 0.5 &&
					k < v.length
						? `  = ${num(products[k] ?? 0)}`
						: ''}"
					size={16}
					weight={600}
					color={k < v.length ? undefined : 'var(--tn-bad)'}
				/>
			{/each}
			{#if match && out}
				<Label
					anchor="start"
					x={PX}
					y={MY + 12 + 4 * 26 + 8}
					text="= {num(out[active])}"
					size={20}
					weight={700}
					color="var(--tn-keep)"
					opacity={clamp(summed * 2, 0, 1)}
				/>
			{/if}
		</g>
	</Readout>
</g>
