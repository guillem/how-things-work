<script lang="ts">
	/**
	 * Hardy–Weinberg in one generation: the parents' genotypes (chosen by `params.parents`: no
	 * heterozygotes, as many as possible, or already at p², 2pq, q²), the gene pool they make
	 * (share p of A, `params.p_hw`), and the children's genotypes, drawn from the pool two copies at
	 * a time, beside the square of the two draws whose areas are p², 2pq and q². Gene copies flow
	 * from the parents into the pool and on to the children; reduced motion leaves them out.
	 */
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { Label, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { alleleShare, hardyWeinberg, type Genotypes } from '../model';
	import { GENO, percent } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const pTarget = $derived(Math.min(0.95, Math.max(0.05, Number(params.p_hw ?? 0.3))));
	const mix = $derived(String(params.parents ?? 'homo'));

	function parentsOf(p: number, kind: string): Genotypes {
		if (kind === 'hw') return hardyWeinberg(p);
		if (kind === 'het') {
			const Aa = 2 * Math.min(p, 1 - p);
			return { AA: Math.max(0, 2 * p - 1), Aa, aa: Math.max(0, 1 - 2 * p) };
		}
		return { AA: p, Aa: 0, aa: 1 - p };
	}
	const parentTarget = $derived(parentsOf(pTarget, mix));
	const tw = { duration: 700, easing: cubicInOut };
	const pShown = Tween.of(() => pTarget, tw);
	const parentShown = Tween.of(
		() => [parentTarget.AA, parentTarget.Aa, parentTarget.aa] as [number, number, number],
		tw
	);
	const p = $derived(pShown.current);
	const parents = $derived({
		AA: parentShown.current[0],
		Aa: parentShown.current[1],
		aa: parentShown.current[2]
	});
	const kids = $derived(hardyWeinberg(p));
	const pParents = $derived(alleleShare(parentTarget));

	// ---- layout ------------------------------------------------------------------------------
	const BASE = 380;
	const H = 240;
	const BW = 50;
	const KEYS = ['AA', 'Aa', 'aa'] as const;
	const parentX = [48, 116, 184];
	const kidX = [528, 596, 664];
	const POOL_X = 348;
	const POOL_W = 64;

	// the square of the two draws
	const SQ_X = 790;
	const SQ_Y = 160;
	const SQ = 140;
	const cells = $derived([
		{ id: 'AA', x: SQ_X, y: SQ_Y, w: SQ * p, h: SQ * p, g: 'AA' as const },
		{ id: 'Aa1', x: SQ_X + SQ * p, y: SQ_Y, w: SQ * (1 - p), h: SQ * p, g: 'Aa' as const },
		{ id: 'Aa2', x: SQ_X, y: SQ_Y + SQ * p, w: SQ * p, h: SQ * (1 - p), g: 'Aa' as const },
		{
			id: 'aa',
			x: SQ_X + SQ * p,
			y: SQ_Y + SQ * p,
			w: SQ * (1 - p),
			h: SQ * (1 - p),
			g: 'aa' as const
		}
	]);

	// ---- gene copies in flight: parents → pool → children ---------------------------------------
	const FLOW = 14;
	const flights = $derived.by(() => {
		if (reduced) return [];
		return Array.from({ length: FLOW }, (_, i) => {
			const u = cycle(t, 2.4, i / FLOW);
			const second = i % 2 === 1;
			const x0 = second ? POOL_X + POOL_W + 8 : 258;
			const x1 = second ? kidX[0] - 14 : POOL_X - 10;
			const y = 230 + (hash(i, 3) - 0.5) * 90;
			// a copy's allele: A with chance p (a fixed draw per dot, so a dot keeps its colour)
			const isA = hash(i + Math.floor(t / 2.4 + i / FLOW) * 31, 7) < p;
			return {
				id: i,
				x: x0 + (x1 - x0) * u,
				y,
				o: smoothstep(0, 0.15, u) * (1 - smoothstep(0.85, 1, u)),
				c: isA ? GENO.AA : GENO.aa
			};
		});
	});
	const nameOf: Record<string, string> = {
		homo: 'parents: no heterozygotes',
		het: 'parents: as many heterozygotes as possible',
		hw: 'parents: already at p², 2pq, q²'
	};
</script>

{#snippet bars(xs: number[], g: Genotypes, title: string, sub: string, id: string)}
	<Readout id="{id}-title">
		<Label x={xs[1] + BW / 2} y={78} text={title} size={15} weight={700} />
		<Label x={xs[1] + BW / 2} y={98} text={sub} size={11} muted />
	</Readout>
	<line x1={xs[0] - 12} x2={xs[2] + BW + 12} y1={BASE} y2={BASE} stroke="var(--stage-line)" />
	{#each KEYS as k, i (k)}
		<rect
			x={xs[i]}
			y={BASE - H * g[k]}
			width={BW}
			height={H * g[k]}
			rx="3"
			fill={GENO[k]}
			opacity="0.85"
		/>
		<Label x={xs[i] + BW / 2} y={BASE + 22} text={k} size={14} weight={700} color={GENO[k]} />
		<Readout
			id="{id}-{k}"
			order={id === 'kids' ? 10 + i : 5 + i}
			label="{title}: {k}"
			value={percent(g[k])}
			color={GENO[k]}
		>
			<Label
				x={xs[i] + BW / 2}
				y={BASE - H * g[k] - 9}
				text={percent(g[k])}
				size={12}
				weight={600}
				tabular
			/>
		</Readout>
	{/each}
{/snippet}

<g>
	{@render bars(parentX, parents, 'Parents', 'genotypes you choose', 'parents')}
	{@render bars(kidX, kids, 'Children', 'after one generation', 'kids')}

	<!-- the gene pool: a share p of A over q of a -->
	<Readout id="pool-title">
		<Label x={POOL_X + POOL_W / 2} y={78} text="Gene pool" size={15} weight={700} />
		<Label x={POOL_X + POOL_W / 2} y={98} text="all 2N copies" size={11} muted />
	</Readout>
	<rect
		x={POOL_X}
		y={BASE - H}
		width={POOL_W}
		height={H * p}
		fill={GENO.AA}
		opacity="0.85"
		rx="3"
	/>
	<rect
		x={POOL_X}
		y={BASE - H + H * p}
		width={POOL_W}
		height={H * (1 - p)}
		fill={GENO.aa}
		opacity="0.85"
		rx="3"
	/>
	<Readout id="pool-p" order={1} label="Share of A, p" value={percent(p)} color={GENO.AA}>
		<Label
			x={POOL_X + POOL_W / 2}
			y={BASE - H + (H * p) / 2 + 5}
			text="A {percent(p)}"
			size={12}
			weight={700}
			color="var(--stage-bg)"
			halo={false}
			opacity={p > 0.12 ? 1 : 0}
		/>
		<Label
			x={POOL_X + POOL_W / 2}
			y={BASE - H + H * p + (H * (1 - p)) / 2 + 5}
			text="a {percent(1 - p)}"
			size={12}
			weight={700}
			color="var(--stage-bg)"
			halo={false}
			opacity={p < 0.88 ? 1 : 0}
		/>
	</Readout>
	<Label x={POOL_X + POOL_W / 2} y={BASE + 22} text="p : q" size={13} muted />

	<!-- arrows between the columns -->
	{#each [{ id: 'in', x0: 252, x1: POOL_X - 8 }, { id: 'out', x0: POOL_X + POOL_W + 8, x1: kidX[0] - 10 }] as a (a.id)}
		<line
			x1={a.x0}
			x2={a.x1}
			y1={300}
			y2={300}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
	{/each}
	<Readout id="arrow-labels">
		<Label x={(252 + POOL_X - 8) / 2} y={322} text="copies" size={11} muted />
		<Label x={(POOL_X + POOL_W + kidX[0]) / 2} y={322} text="two draws" size={11} muted />
	</Readout>
	{#each flights as f (f.id)}
		<circle cx={f.x} cy={f.y} r="5" fill={f.c} opacity={f.o} />
	{/each}

	<!-- the square of two random draws -->
	<Readout id="sq-title">
		<Label x={SQ_X + SQ / 2} y={78} text="Two draws" size={15} weight={700} />
		<Label x={SQ_X + SQ / 2} y={98} text="first copy × second copy" size={11} muted />
	</Readout>
	{#each cells as c (c.id)}
		<rect
			x={c.x}
			y={c.y}
			width={Math.max(0, c.w)}
			height={Math.max(0, c.h)}
			fill={GENO[c.g]}
			opacity="0.8"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}
	<Readout id="sq-labels">
		<Label x={SQ_X + (SQ * p) / 2} y={SQ_Y - 8} text="A" size={13} weight={700} color={GENO.AA} />
		<Label
			x={SQ_X + SQ * p + (SQ * (1 - p)) / 2}
			y={SQ_Y - 8}
			text="a"
			size={13}
			weight={700}
			color={GENO.aa}
		/>
		<Label
			x={SQ_X - 10}
			y={SQ_Y + (SQ * p) / 2 + 5}
			text="A"
			size={13}
			weight={700}
			color={GENO.AA}
			anchor="end"
		/>
		<Label
			x={SQ_X - 10}
			y={SQ_Y + SQ * p + (SQ * (1 - p)) / 2 + 5}
			text="a"
			size={13}
			weight={700}
			color={GENO.aa}
			anchor="end"
		/>
		<Label x={SQ_X + SQ / 2} y={SQ_Y + SQ + 26} text="AA: p × p = p²" size={12} />
		<Label x={SQ_X + SQ / 2} y={SQ_Y + SQ + 46} text="Aa: 2 × p × q = 2pq" size={12} />
		<Label x={SQ_X + SQ / 2} y={SQ_Y + SQ + 66} text="aa: q × q = q²" size={12} />
	</Readout>

	<!-- the verdict: p is passed on unchanged, the genotypes are not -->
	<Readout
		id="verdict"
		order={0}
		label="Share of A"
		value="parents {percent(pParents)} → children {percent(pTarget)}"
	>
		<Label
			x={480}
			y={480}
			text="share of A: {percent(pParents)} in the parents → {percent(pTarget)} in the children"
			size={16}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="verdict-sub">
		<Label
			x={480}
			y={508}
			text="{nameOf[mix] ?? ''} · children at p², 2pq, q² all the same"
			size={12}
			muted
		/>
	</Readout>
</g>
