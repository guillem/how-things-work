<script lang="ts">
	/**
	 * One attention operation of GPT-2 small (layer 5, head 4) on the animal sentence, from the
	 * model's real 64-number queries, keys and values. One row per token; the token asking (the
	 * query) is chosen with the `fq` slider or by clicking a token. Phases:
	 *   qkv     the query on top, every token's key and value as bars
	 *   scores  q·k ÷ 8 for each earlier token (later tokens are masked)
	 *   weights softmax of the scores
	 *   mix     each value scaled by its weight, summed into the head's output
	 *   matrix  every token's weights at once: the head's attention pattern
	 * Every number is computed here with `attend` from the shipped q, k and v.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, smoothstep } from '#lib/draw/index.ts';
	import { cosine } from '../attention';
	import { gpt2 } from '../gpt2';
	import { bands, bars, fix, label, num, top } from './shared';
	import TokenChip from './TokenChip.svelte';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const f = gpt2.featured;
	const s = gpt2.sentence(f.sentence);
	const N = s.n;
	const names = s.tokens.map((tk) => label(tk));
	const qi = $derived(Math.max(1, Math.min(N - 1, Math.round(num(params.fq, 9)))));
	const at = $derived(gpt2.featuredStep(qi));
	const best = $derived(top(at.weights, 3));

	const phase = $derived(String(step.hints?.phase ?? 'qkv'));
	const target = (p: string) => ({
		qkv: p === 'qkv' ? 1 : p === 'matrix' ? 0 : 0.45,
		head: p === 'matrix' ? 0 : 1,
		scores: p === 'scores' ? 1 : 0,
		weights: p === 'weights' ? 1 : 0,
		mix: p === 'mix' ? 1 : 0,
		matrix: p === 'matrix' ? 1 : 0
	});
	const o = new Tween(target('qkv'), { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		const r = reduced;
		untrack(() => o.set(target(p), { duration: r ? 0 : 700 }));
	});

	// ---- layout
	const ROW = { y: 100, h: 34 };
	const cy = (i: number) => ROW.y + i * ROW.h + ROW.h / 2;
	const K = { x: 112, bw: 2 };
	const V = { x: 256, bw: 2 };
	const Q = { x: 200, bw: 5, mid: 44 };
	const SC = { zero: 560, unit: 20 };
	const W = { x: 410, w: 270 };
	const MX = { x: 420, bw: 2 };
	const OUT = { x: 650, bw: 4.4, mid: 300 };

	const kBars = f.k.map((k, j) => ({ j, d: bars(k, K.x, cy(j), K.bw, 2.1, 13) }));
	const vBars = f.v.map((v, j) => ({ j, d: bars(v, V.x, cy(j), V.bw, 13, 13) }));
	const qBars = $derived(bars(f.q[qi], Q.x, Q.mid, Q.bw, 9, 26));
	const scaled = $derived(
		at.weights.map((w, j) => ({
			j,
			w,
			d: bars(
				f.v[j].map((x) => x * w),
				MX.x,
				cy(j),
				MX.bw,
				13,
				13
			)
		}))
	);
	const outBars = $derived(bars(at.out, OUT.x, OUT.mid, OUT.bw, 40, 44));
	const lead = $derived(best[0]);
	const leadBars = $derived(bars(f.v[lead.j], OUT.x, OUT.mid + 150, OUT.bw, 40, 44));
	const leadCos = $derived(cosine(at.out, f.v[lead.j]));

	// Particles from the scaled values into the sum, as many as the weight is large.
	const flow = $derived(
		reduced
			? []
			: at.weights.flatMap((w, j) => {
					if (w < 0.01) return [];
					return [0, 0.5].map((off) => {
						const u = cycle(t, 1.8, off + j * 0.07);
						const x0 = MX.x + 64 * MX.bw + 8;
						const y0 = cy(j);
						const x1 = OUT.x - 10;
						const y1 = OUT.mid;
						return {
							key: `${j}-${off}`,
							x: x0 + (x1 - x0) * u,
							y: y0 + (y1 - y0) * u,
							r: 2 + 3 * Math.sqrt(w),
							o: smoothstep(0, 0.12, u) * (1 - smoothstep(0.85, 1, u))
						};
					});
				})
	);

	// ---- the matrix (phase "matrix"): rows aligned with the token rows
	const MAT = { x: 112, cell: 34 };
	const matrix = Array.from({ length: N }, (_, i) => gpt2.featuredStep(i).weights);
	const matCells = bands(
		N,
		N,
		(i, j) => (j <= i ? matrix[i][j] : null),
		MAT.x,
		ROW.y,
		MAT.cell,
		ROW.h,
		10,
		2
	);
	const maskD = Array.from(
		{ length: N },
		(_, i) =>
			`M${MAT.x + (i + 1) * MAT.cell + 1} ${ROW.y + i * ROW.h + 1}h${(N - i - 1) * MAT.cell - 2}v${ROW.h - 2}h${-((N - i - 1) * MAT.cell - 2)}Z`
	).join('');

	const formula = $derived(
		phase === 'qkv'
			? 'q = x W_Q,  k = x W_K,  v = x W_V  (64 numbers each)'
			: phase === 'scores'
				? 'score = q · k ⁄ √64 = q · k ⁄ 8'
				: phase === 'weights'
					? `weight = e^score ⁄ Σ e^score   ·   Σ weights = ${fix(
							at.weights.reduce((a, b) => a + b, 0),
							3
						)}`
					: 'output = Σ weight × v'
	);
	const pick = (i: number) => {
		if (i >= 1) setParam('fq', i);
	};
	const scoreText = (j: number) =>
		phase === 'scores' ? `${fix(at.dots[j], 1)} ⁄ 8 = ${fix(at.scores[j])}` : fix(at.weights[j], 3);
	const sx = (v: number) => SC.zero + Math.max(-7, Math.min(3, v)) * SC.unit;
</script>

<g>
	<!-- the query on top -->
	<g opacity={o.current.head}>
		<Txt x={16} y={30} size={12} muted text="the token asking" />
		<TokenChip x={16} y={36} w={84} h={28} text={names[qi]} selected />
		<Txt
			x={Q.x - 10}
			y={Q.mid + 5}
			anchor="end"
			size={13}
			weight={650}
			color="var(--tf-q)"
			text="query q"
		/>
		<line x1={Q.x} y1={Q.mid} x2={Q.x + 64 * Q.bw} y2={Q.mid} stroke="var(--stage-line)" />
		<path d={qBars} fill="var(--tf-q)" />
		<Readout id="formula" order={9} label="Formula" value={formula}>
			<Txt x={944} y={Q.mid + 5} anchor="end" size={13} weight={600} text={formula} />
		</Readout>
		<Txt
			x={K.x}
			y={ROW.y - 6}
			size={11}
			weight={600}
			color="var(--tf-k)"
			text="key k"
			opacity={o.current.qkv}
		/>
		<Txt
			x={V.x}
			y={ROW.y - 6}
			size={11}
			weight={600}
			color="var(--tf-v)"
			text="value v"
			opacity={o.current.qkv}
		/>
	</g>

	<!-- one row per token -->
	{#each names as nm, j (j)}
		<TokenChip
			x={16}
			y={cy(j) - 13}
			w={84}
			text={nm}
			name="{nm}, number {j}"
			selected={j === qi}
			muted={j > qi && phase !== 'matrix'}
			onselect={j >= 1 ? () => pick(j) : undefined}
		/>
	{/each}
	<g opacity={o.current.qkv}>
		{#each kBars as b (b.j)}
			<g opacity={b.j > qi && phase !== 'qkv' ? 0.3 : 1}>
				<line x1={K.x} y1={cy(b.j)} x2={K.x + 128} y2={cy(b.j)} stroke="var(--stage-line)" />
				<path d={b.d} fill="var(--tf-k)" />
			</g>
		{/each}
		{#each vBars as b (b.j)}
			<g opacity={b.j > qi && phase !== 'qkv' ? 0.3 : 1}>
				<line x1={V.x} y1={cy(b.j)} x2={V.x + 128} y2={cy(b.j)} stroke="var(--stage-line)" />
				<path d={b.d} fill="var(--tf-v)" />
			</g>
		{/each}
	</g>

	<!-- scores and weights -->
	{#if o.current.scores > 0.01 || o.current.weights > 0.01}
		<g opacity={Math.max(o.current.scores, o.current.weights)}>
			<Txt
				x={phase === 'scores' ? SC.zero : W.x}
				y={ROW.y - 6}
				anchor={phase === 'scores' ? 'middle' : 'start'}
				size={11}
				weight={600}
				text={phase === 'scores' ? 'score (0 here)' : 'attention weight'}
			/>
			{#if phase === 'scores'}
				<line
					x1={SC.zero}
					y1={ROW.y}
					x2={SC.zero}
					y2={cy(qi) + 14}
					stroke="var(--stage-ink-muted)"
				/>
			{/if}
			{#each at.weights as w, j (j)}
				{#if phase === 'scores'}
					{@const x0 = Math.min(SC.zero, sx(at.scores[j]))}
					<rect
						x={x0}
						y={cy(j) - 7}
						width={Math.abs(sx(at.scores[j]) - SC.zero)}
						height="14"
						rx="2"
						fill="var(--tf-att)"
						opacity={j === lead.j ? 1 : 0.55}
					/>
				{:else}
					<rect
						x={W.x}
						y={cy(j) - 7}
						width={Math.max(1, w * W.w)}
						height="14"
						rx="2"
						fill="var(--tf-att)"
						opacity={j === lead.j ? 1 : 0.7}
					/>
				{/if}
				<Readout id="w-{j}">
					<Txt
						x={700}
						y={cy(j) + 4}
						size={12}
						text={scoreText(j)}
						weight={j === lead.j ? 650 : 500}
					/>
				</Readout>
			{/each}
			{#if qi < N - 1}
				<Readout id="masked">
					<Txt
						x={W.x}
						y={(cy(qi + 1) + cy(N - 1)) / 2 + 4}
						size={12}
						muted
						italic
						text="masked: later than “{names[qi]}”, so not seen"
					/>
				</Readout>
			{/if}
		</g>
	{/if}

	<!-- the mix -->
	{#if o.current.mix > 0.01}
		<g opacity={o.current.mix}>
			<Txt x={MX.x} y={ROW.y - 6} size={11} weight={600} text="weight × value" />
			{#each scaled as r (r.j)}
				<Readout id="mw-{r.j}">
					<Txt
						x={MX.x - 6}
						y={cy(r.j) + 4}
						anchor="end"
						size={11}
						muted={r.w < 0.05}
						text="{fix(r.w)} ×"
					/>
				</Readout>
				<line x1={MX.x} y1={cy(r.j)} x2={MX.x + 128} y2={cy(r.j)} stroke="var(--stage-line)" />
				<path d={r.d} fill="var(--tf-v)" />
			{/each}
			{#each flow as p (p.key)}
				<circle cx={p.x} cy={p.y} r={p.r} fill="var(--tf-v)" opacity={p.o} />
			{/each}
			<Txt
				x={OUT.x}
				y={OUT.mid - 60}
				size={13}
				weight={650}
				text="output for “{names[qi]}”: the sum"
			/>
			<line
				x1={OUT.x}
				y1={OUT.mid}
				x2={OUT.x + 64 * OUT.bw}
				y2={OUT.mid}
				stroke="var(--stage-line)"
			/>
			<path d={outBars} fill="var(--tf-v)" />
			<Txt
				x={OUT.x}
				y={OUT.mid + 90}
				size={13}
				weight={600}
				text="value of “{names[lead.j]}”, for comparison"
				muted
			/>
			<line
				x1={OUT.x}
				y1={OUT.mid + 150}
				x2={OUT.x + 64 * OUT.bw}
				y2={OUT.mid + 150}
				stroke="var(--stage-line)"
			/>
			<path d={leadBars} fill="var(--tf-v)" opacity="0.55" />
			<Readout
				id="cos"
				order={3}
				label="Output vs value of “{names[lead.j]}”"
				value="cos = {fix(leadCos)}"
			>
				<Txt x={OUT.x} y={OUT.mid + 222} size={13} text="cosine between the two: {fix(leadCos)}" />
			</Readout>
		</g>
	{/if}

	<!-- every token at once -->
	{#if o.current.matrix > 0.01}
		<g opacity={o.current.matrix}>
			{#each names as nm, j (j)}
				<Txt
					x={MAT.x + (j + 0.5) * MAT.cell}
					y={ROW.y - 8}
					anchor="middle"
					size={10}
					muted
					text={nm.length > 5 ? nm.slice(0, 4) + '…' : nm}
				/>
			{/each}
			<rect
				x={MAT.x}
				y={ROW.y}
				width={N * MAT.cell}
				height={N * ROW.h}
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<path d={maskD} fill="var(--tf-mask)" />
			{#each matCells as b (b.key)}
				<path d={b.d} fill="var(--tf-att)" opacity={0.15 + 0.85 * b.level} />
			{/each}
			<rect
				x={MAT.x - 1}
				y={ROW.y + qi * ROW.h}
				width={N * MAT.cell + 2}
				height={ROW.h}
				fill="none"
				stroke="var(--tf-sel)"
				stroke-width="2.5"
			/>
			{#each matrix[qi] as w, j (j)}
				{#if j <= qi && w >= 0.01}
					<Txt
						x={MAT.x + (j + 0.5) * MAT.cell}
						y={cy(qi) + 4}
						anchor="middle"
						size={10}
						weight={650}
						text={fix(w).replace(/^0/, '')}
						color={w > 0.5 ? 'var(--stage-bg)' : undefined}
						halo={w <= 0.5}
					/>
				{/if}
			{/each}
			<Readout
				id="mcap"
				order={4}
				label="Pattern"
				value="row: the token asking; column: the token looked at; each row adds up to 1; grey: masked"
			>
				<Txt x={620} y={140} size={14} weight={650} text="Layer 5, head 4: all 14 rows" />
				<Txt x={620} y={168} size={12} text="row: the token asking" />
				<Txt x={620} y={188} size={12} text="column: the token looked at" />
				<Txt x={620} y={208} size={12} text="each row adds up to 1" />
				<Txt x={620} y={228} size={12} muted text="grey triangle: masked (later tokens)" />
				<Txt x={620} y={268} size={12} text="outlined: the row of “{names[qi]}”" />
				<Txt x={620} y={318} size={12} text="the whole table is one product, Q Kᵀ," />
				<Txt x={620} y={338} size={12} text="computed for all tokens in parallel" />
			</Readout>
		</g>
	{/if}

	<Readout
		id="query"
		order={1}
		label="Token asking"
		value="“{names[qi]}” (no. {qi})"
		color="var(--tf-q)"><g></g></Readout
	>
	<Readout
		id="best"
		order={2}
		label={phase === 'scores' ? 'Highest scores' : 'Largest weights'}
		value={best
			.map((b) => `${names[b.j]} ${phase === 'scores' ? fix(at.scores[b.j]) : fix(b.w)}`)
			.join(' · ')}
		opacity={phase === 'qkv' ? 0 : 1}><g></g></Readout
	>
</g>
