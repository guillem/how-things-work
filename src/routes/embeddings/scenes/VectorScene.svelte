<script lang="ts">
	/**
	 * Two words as strips of 100 bars (their GloVe vectors), and how they are compared.
	 *
	 * Phases (`step.hints.phase`), morphed with a tween:
	 *   numbers — two big strips; a cursor walks along the 100 positions and reads out both
	 *             numbers (a pure function of t).
	 *   angle   — the strips shrink to the left, a third strip shows the 100 products aᵢ·bᵢ, and
	 *             their running total builds up to the dot product, which for these unit vectors
	 *             is cos θ. On the right, the plane the two vectors span, with the true angle.
	 *             A small table compares other pairs.
	 * Words come from `params.a` and `params.b`; the bars tween to a new word.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { clamp, lerp, smoothstep } from '#lib/draw/index.ts';
	import { load, angleDeg, type Embeddings } from '../embeddings';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	let emb = $state.raw<Embeddings | null>(null);
	$effect(() => {
		load().then((e) => (emb = e));
	});

	const D = 100;
	const zero = Array<number>(D).fill(0);
	const wa = $derived(String(params.a ?? 'king'));
	const wb = $derived(String(params.b ?? 'queen'));
	const va = $derived(emb?.vector(wa) ?? null);
	const vb = $derived(emb?.vector(wb) ?? null);

	// The bars glide to a new word.
	const barsA = new Tween<number[]>(zero, { duration: 700, easing: cubicInOut });
	const barsB = new Tween<number[]>(zero, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const a = va ? Array.from(va) : zero;
		untrack(() => barsA.set(a, { duration: reduced ? 0 : 700 }));
	});
	$effect(() => {
		const b = vb ? Array.from(vb) : zero;
		untrack(() => barsB.set(b, { duration: reduced ? 0 : 700 }));
	});

	const anglePhase = $derived(step.hints?.phase === 'angle');
	const ph = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const p = anglePhase ? 1 : 0;
		untrack(() => ph.set(p, { duration: reduced ? 0 : 800 }));
	});
	const p = $derived(ph.current);

	// ---- geometry, between the two phases -----------------------------------------------
	const X0 = $derived(lerp(80, 60, p));
	const X1 = $derived(lerp(900, 590, p));
	const bw = $derived((X1 - X0) / D);
	const rowA = $derived({ y: lerp(160, 118, p), h: lerp(70, 44, p) });
	const rowB = $derived({ y: lerp(360, 250, p), h: lerp(70, 44, p) });
	const rowP = { y: 400, h: 50 };
	const VSCALE = 0.33; // a component of this size fills the row height
	const PSCALE = 0.06; // a product of this size fills the product row

	const cos = $derived(va && vb ? emb!.similarity(wa, wb)! : 0);
	const theta = $derived(va && vb ? angleDeg(va, vb) : 90);
	const products = $derived(barsA.current.map((x, i) => x * barsB.current[i]));

	// numbers phase: a cursor walking along the strips (8 positions a second)
	const cursor = $derived(reduced ? 37 : Math.floor(t * 6) % D);
	// angle phase: the running total of the products builds up over ~5 s
	const built = $derived(reduced ? D : Math.round(clamp((t - 0.8) / 5) * D));
	const partial = $derived(products.slice(0, built).reduce((s, v) => s + v, 0));

	const fmt = (v: number, d = 2) => v.toFixed(d).replace(/^-/, '−');

	// The angle diagram: the plane spanned by the two vectors (exact for any two vectors).
	const C = { x: 690, y: 450 };
	const R = 170;
	const baseAngle = -8; // degrees, the first arrow
	const tip = (deg: number, r = R) => ({
		x: C.x + r * Math.cos((deg * Math.PI) / 180),
		y: C.y - r * Math.sin((deg * Math.PI) / 180)
	});
	const arc = $derived.by(() => {
		const a0 = baseAngle;
		const a1 = baseAngle + theta;
		const r = 46;
		const s = tip(a0, r);
		const e = tip(a1, r);
		return `M${s.x} ${s.y} A${r} ${r} 0 ${theta > 180 ? 1 : 0} 0 ${e.x} ${e.y}`;
	});
	const cx = $derived(X0 + (cursor + 0.5) * bw);
	const tx = $derived(clamp(cx, X0 + 90, X1 - 90));
	const a = $derived(tip(baseAngle));
	const b = $derived(tip(baseAngle + theta));
	const mid = $derived(tip(baseAngle + theta / 2, 70));
	const PAIRS: [string, string][] = [
		['cat', 'dog'],
		['king', 'queen'],
		['good', 'bad'],
		['king', 'banana']
	];
</script>

{#snippet strip(vals: number[], row: { y: number; h: number }, color: string, scale: number)}
	<line x1={X0 - 4} x2={X1 + 2} y1={row.y} y2={row.y} stroke="var(--stage-line)" stroke-width="1" />
	{#each vals as v, i (i)}
		{@const h = clamp(v / scale, -1.15, 1.15) * row.h}
		<rect
			x={X0 + i * bw + bw * 0.14}
			y={h >= 0 ? row.y - h : row.y}
			width={bw * 0.72}
			height={Math.max(0.5, Math.abs(h))}
			fill={color}
			opacity={0.9}
		/>
	{/each}
{/snippet}

<g>
	{#if !emb}
		<Txt x={480} y={300} text="Loading word vectors…" size={15} anchor="middle" muted />
	{:else}
		<!-- word A -->
		<Readout id="word-a" order={1} label="First word" value={wa} color="var(--emb-a)">
			<Txt
				x={X0}
				y={rowA.y - rowA.h - 16}
				text={wa}
				size={lerp(20, 16, p)}
				weight={700}
				color="var(--emb-a)"
			/>
		</Readout>
		{@render strip(barsA.current, rowA, 'var(--emb-a)', VSCALE)}
		<!-- word B -->
		<Readout id="word-b" order={2} label="Second word" value={wb} color="var(--emb-b)">
			<Txt
				x={X0}
				y={rowB.y - rowB.h - 16}
				text={wb}
				size={lerp(20, 16, p)}
				weight={700}
				color="var(--emb-b)"
			/>
		</Readout>
		{@render strip(barsB.current, rowB, 'var(--emb-b)', VSCALE)}

		<!-- numbers phase: axis notes and the walking cursor -->
		{#if p < 0.99}
			<g opacity={1 - p}>
				<Readout id="axis">
					<Txt x={X0} y={rowB.y + rowB.h + 30} text="number 1" size={11} muted />
					<Txt x={X1} y={rowB.y + rowB.h + 30} text="number 100" size={11} anchor="end" muted />
					<Txt
						x={X1}
						y={rowA.y - rowA.h - 16}
						text="bar up: positive · bar down: negative"
						size={11}
						anchor="end"
						muted
					/>
				</Readout>
				<line
					x1={cx}
					x2={cx}
					y1={rowA.y - rowA.h - 4}
					y2={rowB.y + rowB.h + 6}
					stroke="var(--stage-ink)"
					stroke-width="1"
					stroke-dasharray="3 3"
					opacity="0.6"
				/>
				<rect
					x={cx - bw * 0.6}
					y={rowA.y - rowA.h - 4}
					width={bw * 1.2}
					height={rowB.y + rowB.h + 10 - (rowA.y - rowA.h - 4)}
					rx="3"
					fill="var(--stage-ink)"
					opacity="0.06"
				/>
				<Readout
					id="cursor"
					order={3}
					label="Number {cursor + 1}"
					value="{wa} {fmt(barsA.current[cursor], 3)} · {wb} {fmt(barsB.current[cursor], 3)}"
				>
					<rect
						x={tx - 92}
						y={rowB.y + rowB.h + 44}
						width="184"
						height="62"
						rx="10"
						fill="var(--surface)"
						stroke="var(--border)"
					/>
					<Txt
						x={tx}
						y={rowB.y + rowB.h + 65}
						text="number {cursor + 1} of 100"
						size={12}
						anchor="middle"
						muted
						halo={false}
					/>
					<Txt
						x={tx - 8}
						y={rowB.y + rowB.h + 90}
						text="{wa} {fmt(barsA.current[cursor], 3)}"
						size={13}
						anchor="end"
						weight={600}
						color="var(--emb-a)"
						halo={false}
					/>
					<Txt
						x={tx + 8}
						y={rowB.y + rowB.h + 90}
						text="{wb} {fmt(barsB.current[cursor], 3)}"
						size={13}
						weight={600}
						color="var(--emb-b)"
						halo={false}
					/>
				</Readout>
				<Readout id="numbers-note">
					<Txt
						x={480}
						y={560}
						text="No single number means anything; what matters is how the 100 numbers go together."
						size={13}
						anchor="middle"
						muted
					/>
				</Readout>
			</g>
		{/if}

		<!-- angle phase: products, their total, and the angle -->
		{#if p > 0.01}
			<g opacity={p}>
				<Readout id="prod-title">
					<Txt
						x={X0}
						y={rowP.y - rowP.h - 14}
						text="{wa} × {wb}, number by number"
						size={14}
						weight={700}
					/>
				</Readout>
				<line
					x1={X0 - 4}
					x2={X1 + 2}
					y1={rowP.y}
					y2={rowP.y}
					stroke="var(--stage-line)"
					stroke-width="1"
				/>
				{#each products as v, i (i)}
					{@const h = clamp(v / PSCALE, -1.15, 1.15) * rowP.h}
					<rect
						x={X0 + i * bw + bw * 0.14}
						y={h >= 0 ? rowP.y - h : rowP.y}
						width={bw * 0.72}
						height={Math.max(0.5, Math.abs(h))}
						fill={v >= 0 ? 'var(--emb-result)' : 'var(--emb-warn)'}
						opacity={i < built ? 0.9 : 0.25}
					/>
				{/each}
				<Readout id="prod-key">
					<Txt
						x={X1}
						y={rowP.y - rowP.h - 14}
						text="green: same sign · red: opposite"
						size={11}
						anchor="end"
						muted
					/>
				</Readout>
				<Readout
					id="dot"
					order={4}
					label="Dot product (sum of the 100 products)"
					value={fmt(built === D ? cos : partial)}
				>
					<Txt
						x={X0}
						y={rowP.y + rowP.h + 46}
						text="sum of the {built} products = {fmt(built === D ? cos : partial)}"
						size={15}
						weight={600}
					/>
					<Txt
						x={X0}
						y={rowP.y + rowP.h + 68}
						text="Both vectors have length 1, so this sum is cos θ."
						size={12}
						muted
					/>
				</Readout>

				<!-- the plane of the two vectors -->
				<Readout id="plane-title">
					<Txt x={C.x - 60} y={66} text="The plane through both arrows" size={14} weight={700} />
					<Txt
						x={C.x - 60}
						y={84}
						text="(any two vectors lie in one, even in 100-D)"
						size={11}
						muted
					/>
				</Readout>
				<line
					x1={C.x}
					y1={C.y}
					x2={a.x}
					y2={a.y}
					stroke="var(--emb-a)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
					style:color="var(--emb-a)"
				/>
				<line
					x1={C.x}
					y1={C.y}
					x2={b.x}
					y2={b.y}
					stroke="var(--emb-b)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
					style:color="var(--emb-b)"
				/>
				<path d={arc} fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
				<circle cx={C.x} cy={C.y} r="3.5" fill="var(--stage-ink)" />
				<Readout
					id="angle"
					order={5}
					label="Angle between them"
					value="θ = {theta.toFixed(0)}°, cos θ = {fmt(cos)}"
				>
					<Txt x={mid.x + 4} y={mid.y + 4} text="θ = {theta.toFixed(0)}°" size={14} weight={700} />
					<Txt x={a.x + 6} y={a.y + 20} text={wa} size={14} weight={700} color="var(--emb-a)" />
					<Txt
						x={b.x + (theta > 70 ? -6 : 6)}
						y={b.y - 8}
						text={wb}
						size={14}
						weight={700}
						color="var(--emb-b)"
						anchor={theta > 70 ? 'end' : 'start'}
					/>
				</Readout>

				<!-- other pairs -->
				<Readout id="pairs-title">
					<Txt x={C.x - 60} y={124} text="cos θ for other pairs" size={12} muted />
				</Readout>
				{#each PAIRS as [x, y], k (k)}
					{@const c = emb.similarity(x, y) ?? 0}
					{@const yy = 146 + k * 22}
					{@const on = (x === wa && y === wb) || (x === wb && y === wa)}
					<Readout id="pair-{k}">
						<Txt x={C.x - 60} y={yy} text="{x} · {y}" size={12.5} weight={on ? 700 : 500} />
						<rect
							x={C.x + 60}
							y={yy - 10}
							width={120 * clamp(c)}
							height="11"
							rx="3"
							fill="var(--stage-ink)"
							opacity={on ? 0.6 : 0.25}
						/>
						<Txt
							x={C.x + 230}
							y={yy}
							text={fmt(c)}
							size={12.5}
							anchor="end"
							weight={on ? 700 : 500}
						/>
					</Readout>
				{/each}
				{#if smoothstep(0, 1, p) > 0}
					<Readout id="cos-big">
						<Txt
							x={C.x + 150}
							y={C.y + 60}
							text="cos θ = {fmt(cos)}"
							size={18}
							anchor="end"
							weight={700}
						/>
					</Readout>
				{/if}
			</g>
		{/if}
	{/if}
</g>
