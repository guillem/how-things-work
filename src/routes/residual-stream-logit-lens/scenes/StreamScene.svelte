<script lang="ts">
	/**
	 * The residual stream of the prompt's last word. Left: the tower, the stream as one line from
	 * the embedding to the output, each block's attention and MLP reading a layer-normed copy off it
	 * and adding back at ⊕, with a bar for the length of what each adds and the stream's own length
	 * on the left. Right: the 25 parts (embedding, 12 attention outputs, 12 MLP outputs) projected
	 * on two directions, laid head to tail, so the path ends at the final vector's projection.
	 *
	 * Phase `block`: a pulse runs down the tower (a function of t) and lights one block, in the
	 * tower and in the plane; reduced motion freezes it on block 10. Phase `arrows`: the arrows up
	 * to the `depth` control are drawn in, 1.6 blocks a second (all at once under reduced motion),
	 * the later ones faint; the running vector points from the origin to the current sum.
	 */
	import { Label, cycle, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BLOCKS, lensAt, path, sizes, words } from '../lens';
	import { depthOf } from '../steps';
	import { pct, promptOf, q, rowName } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(step.hints?.phase === 'arrows' ? 'arrows' : 'block');
	const p = $derived(promptOf(params));
	const last = $derived(words(p).length - 1);
	const word = $derived(q(words(p)[last]));
	const pts = $derived(path(p));
	const size = $derived(sizes(p));

	// ---- what is lit
	const PERIOD = 26;
	const pulse = $derived(reduced ? 10 + 0.5 : 1 + cycle(t, PERIOD) * BLOCKS);
	const lit = $derived(phase === 'block' ? Math.floor(pulse) : 0);
	const depth = $derived(depthOf(params));
	/** Blocks drawn so far in the arrows phase (fractional while one is being drawn). */
	const shown = $derived(phase === 'arrows' ? (reduced ? depth : Math.min(depth, t * 1.6)) : 12);
	/** The block the drawing has reached, for the readout. */
	const drawn = $derived(Math.floor(shown + 1e-9));

	// ---- tower geometry
	const SX = 70;
	const Y0 = 86;
	const BH = 36;
	const BOX = { x: 96, w: 76, h: 13 };
	const BAR = { x: 182, max: 120, scale: 2 };
	const by = (b: number) => Y0 + (b - 1) * BH;
	const attnY = (b: number) => by(b) + 9;
	const mlpY = (b: number) => by(b) + 27;
	const OUT_Y = Y0 + BLOCKS * BH + 10;
	const towerOpacity = (b: number) =>
		phase === 'block' ? (b === lit ? 1 : 0.5) : b <= Math.ceil(shown - 1e-9) ? 1 : 0.4;
	const barLen = (v: number) => Math.min(BAR.max, v * BAR.scale);
	/** The stream drawn as a band whose width grows with the logarithm of its length. */
	const streamShape = $derived.by(() => {
		const half = (len: number) => 1 + 1.6 * Math.log10(Math.max(1, len));
		const ys = [66, ...Array.from({ length: BLOCKS }, (_, i) => by(i + 1) + BH), OUT_Y];
		const ls = [size.stream[0], ...size.stream.slice(1), size.stream[BLOCKS]];
		const left = ys.map((y, i) => `${(SX - half(ls[i])).toFixed(1)} ${y}`);
		const right = ys.map((y, i) => `${(SX + half(ls[i])).toFixed(1)} ${y}`).reverse();
		return `M${left.join('L')}L${right.join('L')}Z`;
	});

	// ---- the plane
	const PL = { x0: 352, x1: 940, y0: 76, y1: 500 };
	const view = $derived.by(() => {
		const xs = [0, ...pts.map((v) => v.x)];
		const ys = [0, ...pts.map((v) => v.y)];
		const [xa, xb] = [Math.min(...xs), Math.max(...xs)];
		const [ya, yb] = [Math.min(...ys), Math.max(...ys)];
		const s = Math.min((PL.x1 - PL.x0 - 80) / (xb - xa), (PL.y1 - PL.y0 - 50) / (yb - ya), 8);
		const ox = PL.x0 + 40 - xa * s + (PL.x1 - PL.x0 - 80 - (xb - xa) * s) / 2;
		const oy = PL.y0 + 25 + yb * s + (PL.y1 - PL.y0 - 50 - (yb - ya) * s) / 2;
		return { s, ox, oy, xa, xb, ya, yb };
	});
	const px = (x: number) => view.ox + x * view.s;
	const py = (y: number) => view.oy - y * view.s;

	/** Segment k (1..24) goes from pts[k-1] to pts[k]; its block is ceil(k/2). */
	const segments = $derived(
		pts.slice(1).map((b, i) => {
			const a = pts[i];
			const blk = b.block;
			const u =
				phase === 'arrows' ? clamp((shown - (blk - 1)) * 2 - (b.part === 'attn' ? 0 : 1)) : 1;
			const on = phase === 'block' ? blk === lit : u > 0;
			return {
				k: i,
				part: b.part,
				block: blk,
				x1: px(a.x),
				y1: py(a.y),
				x2: px(a.x + (b.x - a.x) * Math.max(u, 0.0001)),
				y2: py(a.y + (b.y - a.y) * Math.max(u, 0.0001)),
				len: Math.hypot(b.x - a.x, b.y - a.y) * view.s,
				u,
				on
			};
		})
	);
	/** The longest arrow drawn in full, named on the plane. */
	const biggest = $derived(
		segments
			.filter((g) => g.u >= 1)
			.reduce<(typeof segments)[number] | null>((a, b) => (!a || b.len > a.len ? b : a), null)
	);
	/** The running vector's tip: the sum so far. */
	const tip = $derived.by(() => {
		if (phase === 'block') return pts[pts.length - 1];
		const done = segments.filter((s) => s.u > 0);
		const lastSeg = done[done.length - 1];
		if (!lastSeg) return pts[0];
		return { x: (lastSeg.x2 - view.ox) / view.s, y: (view.oy - lastSeg.y2) / view.s };
	});
	const readRow = $derived(phase === 'arrows' ? drawn : BLOCKS);
	const guess = $derived(lensAt(p, readRow, last)[0]);
	const answer = $derived(p.last.answer);
	const runner = $derived(p.last.runnerUp);
	const color = (part: string) => (part === 'attn' ? 'var(--rs-attn)' : 'var(--rs-mlp)');
</script>

<g>
	<Readout id="title" order={0} label="Following" value="the vector of the last word, {word}">
		<Label
			x={16}
			y={30}
			anchor="start"
			size={15}
			weight={650}
			text="The last word, {word}: one vector through GPT-2 small’s 12 blocks"
		/>
	</Readout>

	<!-- ================= the tower ================= -->
	<Readout id="len-key">
		<Label
			x={SX - 10}
			y={Y0 - 4}
			anchor="end"
			size={10}
			muted
			tabular
			text="|x| {size.stream[0].toFixed(1)}"
		/>
		<Label x={BAR.x} y={Y0 - 8} anchor="start" size={10.5} muted text="length of what it adds" />
	</Readout>
	<!-- the embedding -->
	<rect
		x={SX - 40}
		y={44}
		width={152}
		height={22}
		rx="5"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label x={SX + 36} y={59} size={11.5} halo={false} text="embedding + position" />
	<!-- the stream itself -->
	<path d={streamShape} fill="var(--rs-stream)" />
	{#if phase === 'block'}
		<circle cx={SX} cy={Y0 + (pulse - 1) * BH} r="6" fill="var(--rs-stream)" opacity="0.9" />
	{/if}
	{#each Array.from({ length: BLOCKS }, (_, i) => i + 1) as b (b)}
		{@const o = towerOpacity(b)}
		<g opacity={o}>
			{#each [{ part: 'attn', y: attnY(b), v: size.attn[b - 1], name: 'attention' }, { part: 'mlp', y: mlpY(b), v: size.mlp[b - 1], name: 'MLP' }] as c (c.part)}
				<!-- read a layer-normed copy, add the output back at ⊕ -->
				<path
					d="M{SX} {c.y - 6}H{BOX.x}"
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					fill="none"
				/>
				<path
					d="M{BOX.x} {c.y + 3}H{SX + 7}"
					stroke={color(c.part)}
					stroke-width="1.5"
					fill="none"
					marker-end="url(#arrowhead)"
				/>
				<rect
					x={BOX.x}
					y={c.y - 7}
					width={BOX.w}
					height={BOX.h}
					rx="3"
					fill={c.part === 'attn' ? 'var(--rs-attn-box)' : 'var(--rs-mlp-box)'}
				/>
				<text
					x={BOX.x + BOX.w / 2}
					y={c.y + 3}
					text-anchor="middle"
					font-size="10"
					font-weight="600"
					fill="#fff">LN → {c.name}</text
				>
				<circle cx={SX} cy={c.y + 3} r="4.5" fill="var(--stage-bg)" stroke={color(c.part)} />
				<text x={SX} y={c.y + 6.5} text-anchor="middle" font-size="9" fill={color(c.part)}>+</text>
				<rect
					x={BAR.x}
					y={c.y - 4}
					width={barLen(c.v)}
					height="8"
					rx="2"
					fill={color(c.part)}
					opacity="0.75"
				/>
				{#if c.v * BAR.scale > BAR.max}
					<Label
						x={BAR.x + BAR.max + 4}
						y={c.y + 4}
						anchor="start"
						size={10}
						tabular
						text={c.v.toFixed(0)}
					/>
				{/if}
			{/each}
			<Label x={SX - 12} y={by(b) + BH / 2 + 4} anchor="end" size={10.5} muted text={String(b)} />
		</g>
	{/each}
	<!-- the output -->
	<rect
		x={SX - 40}
		y={OUT_Y}
		width={240}
		height={22}
		rx="5"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label
		x={SX - 32}
		y={OUT_Y + 15}
		anchor="start"
		size={11.5}
		halo={false}
		text="final LN → unembedding: {q(answer)} {pct(p.next[0][1])}"
	/>
	<Label
		x={SX - 10}
		y={OUT_Y - 4}
		anchor="end"
		size={10}
		muted
		tabular
		text="|x| {size.stream[BLOCKS].toFixed(0)}"
	/>

	<!-- ================= the plane ================= -->
	<line x1={PL.x0} y1={py(0)} x2={PL.x1} y2={py(0)} stroke="var(--stage-grid)" stroke-width="1.2" />
	<line x1={px(0)} y1={PL.y0} x2={px(0)} y2={PL.y1} stroke="var(--stage-grid)" stroke-width="1.2" />
	<Readout id="axis-x" order={3} label="Across" value="towards {q(answer)} (the final answer)">
		<Label
			x={PL.x1 - 4}
			y={py(0) + 18}
			anchor="end"
			size={12}
			weight={600}
			color="var(--rs-answer)"
			text="towards {q(answer)} →"
		/>
	</Readout>
	<Readout id="axis-y" order={4} label="Up" value="towards {q(runner)} (the runner-up)">
		<Label
			x={px(0) + 8}
			y={PL.y0 + 4}
			anchor="start"
			size={12}
			weight={600}
			text="↑ towards {q(runner)}"
		/>
	</Readout>

	<!-- the running vector: origin to the sum so far -->
	<line
		x1={px(0)}
		y1={py(0)}
		x2={px(tip.x)}
		y2={py(tip.y)}
		stroke="var(--rs-stream)"
		stroke-width="3"
		opacity="0.35"
		marker-end="url(#arrowhead)"
	/>
	<!-- faint ghost of the whole path, so the later blocks are visible in context -->
	{#if phase === 'arrows'}
		<polyline
			points={pts.map((v) => `${px(v.x).toFixed(1)},${py(v.y).toFixed(1)}`).join(' ')}
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1"
			stroke-dasharray="3 3"
		/>
	{/if}
	{#each segments as s (s.k)}
		{#if s.u > 0}
			<line
				x1={s.x1}
				y1={s.y1}
				x2={s.x2}
				y2={s.y2}
				stroke={color(s.part)}
				stroke-width={s.on && phase === 'block' ? 3.5 : 2.2}
				opacity={phase === 'block' && !s.on ? 0.45 : 1}
				marker-end={s.len * s.u > 9 ? 'url(#arrowhead)' : undefined}
				stroke-linecap="round"
			/>
		{/if}
	{/each}
	{#if biggest}
		<Readout id="biggest">
			<Label
				x={(biggest.x1 + biggest.x2) / 2 + 6}
				y={(biggest.y1 + biggest.y2) / 2 + 18}
				anchor="start"
				size={11}
				weight={600}
				color={color(biggest.part)}
				text="block {biggest.block} {biggest.part === 'attn' ? 'attention' : 'MLP'}"
			/>
		</Readout>
	{/if}
	<circle cx={px(pts[0].x)} cy={py(pts[0].y)} r="4" fill="var(--stage-ink)" />
	<Readout id="embed-dot">
		<Label
			x={px(pts[0].x) - 8}
			y={py(pts[0].y) + 16}
			anchor="end"
			size={11}
			muted
			text="embedding"
		/>
	</Readout>
	{#if phase === 'block'}
		{@const end = pts[pts.length - 1]}
		<circle cx={px(end.x)} cy={py(end.y)} r="5" fill="var(--rs-stream)" />
		<Readout id="final-dot">
			<Label
				x={px(end.x) - 10}
				y={py(end.y) - 10}
				anchor="end"
				size={11.5}
				weight={600}
				text="after block 12"
			/>
		</Readout>
	{/if}

	<!-- the legend and the readout under the plane -->
	<Readout id="key-attn" label="attention output" color="var(--rs-attn)">
		<rect x={PL.x0} y={524} width="18" height="6" rx="2" fill="var(--rs-attn)" />
		<Label x={PL.x0 + 24} y={531} anchor="start" size={11.5} text="attention output" />
	</Readout>
	<Readout id="key-mlp" label="MLP output" color="var(--rs-mlp)">
		<rect x={PL.x0 + 150} y={524} width="18" height="6" rx="2" fill="var(--rs-mlp)" />
		<Label x={PL.x0 + 174} y={531} anchor="start" size={11.5} text="MLP output" />
	</Readout>
	{#if phase === 'block'}
		{@const b = lit}
		<Readout
			id="lit"
			order={1}
			label="Block {b}"
			value="adds attention ({size.attn[b - 1].toFixed(0)} long) and MLP ({size.mlp[b - 1].toFixed(
				0
			)} long)"
			note="it reads the stream scaled by {size.ln1[b - 1].toFixed(2)}"
		>
			<Label
				x={PL.x0}
				y={560}
				anchor="start"
				size={13}
				weight={600}
				tabular
				text="Block {b} adds its attention output (length {size.attn[b - 1].toFixed(
					1
				)}) and its MLP output ({size.mlp[b - 1].toFixed(1)})"
			/>
			<Label
				x={PL.x0}
				y={580}
				anchor="start"
				size={11.5}
				muted
				tabular
				text="its layer norm reads the stream (length {size.stream[b - 1].toFixed(
					1
				)}) scaled by {size.ln1[b - 1].toFixed(2)}"
			/>
		</Readout>
	{:else}
		<Readout
			id="depth"
			order={1}
			label="After {rowName(drawn)}"
			value="length {size.stream[drawn].toFixed(1)}; the lens reads {q(guess.token)} {pct(guess.p)}"
		>
			<Label
				x={PL.x0}
				y={560}
				anchor="start"
				size={13}
				weight={600}
				tabular
				text="Running vector after {rowName(drawn)}: length {size.stream[drawn].toFixed(1)}"
			/>
			<Label
				x={PL.x0}
				y={580}
				anchor="start"
				size={11.5}
				muted
				tabular
				text="read out now (next chapter), its best guess would be {q(guess.token)} at {pct(
					guess.p
				)}"
			/>
		</Readout>
	{/if}
</g>
