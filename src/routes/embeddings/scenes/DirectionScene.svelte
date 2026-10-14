<script lang="ts">
	/**
	 * Relationships as directions, drawn in flat views that are linear maps of the 100-D space
	 * (so sums and differences of vectors are drawn exactly).
	 *
	 * Phases (`step.hints.phase`):
	 *   pairs    — the pairs of `params.rel` (man → woman, king → queen…) as arrows, in the view
	 *              of `Embeddings.pairAxes`: across = the pairs' average direction. The arrows
	 *              grow one by one; the panel lists each arrow's cosine with that direction.
	 *   analogy  — b − a + c for the reader's three words (`params.an1/an2/an3`, typed on the
	 *              stage). The view is the plane through a, b and c, origin at a: a → c and
	 *              b → landing point are the same arrow, so the parallelogram is exact. The five
	 *              words closest to the landing point (cosine in 100-D) are drawn where their
	 *              shadow on that plane falls. `params.exclude` leaves the inputs out.
	 *   failures — the same drawing for the cases of `params.fail`, with the word one would
	 *              expect and its rank.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { load, cosine, dot, unit, type Embeddings, type Neighbour } from '../embeddings';
	import Txt from './Txt.svelte';
	import WordInput from './WordInput.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	let emb = $state.raw<Embeddings | null>(null);
	$effect(() => {
		load().then((e) => (emb = e));
	});

	const phase = $derived(String(step.hints?.phase ?? 'pairs'));
	const PLOT = { x: 24, y: 24, w: 616, h: 552 };
	const PL = 668;
	const PR = 944;

	// ---- the relationship sets ------------------------------------------------------------
	const SETS: Record<string, { title: string; pairs: [string, string][] }> = {
		gender: {
			title: 'man → woman',
			pairs: [
				['man', 'woman'],
				['king', 'queen'],
				['uncle', 'aunt'],
				['actor', 'actress'],
				['prince', 'princess'],
				['father', 'mother'],
				['nephew', 'niece']
			]
		},
		capital: {
			title: 'country → capital',
			pairs: [
				['france', 'paris'],
				['italy', 'rome'],
				['germany', 'berlin'],
				['japan', 'tokyo'],
				['spain', 'madrid'],
				['russia', 'moscow'],
				['china', 'beijing']
			]
		},
		tense: {
			title: 'verb → past tense',
			pairs: [
				['walk', 'walked'],
				['swim', 'swam'],
				['run', 'ran'],
				['go', 'went']
			]
		},
		compare: {
			title: 'adjective → comparative',
			pairs: [
				['big', 'bigger'],
				['small', 'smaller'],
				['good', 'better'],
				['bad', 'worse']
			]
		}
	};
	const rel = $derived(SETS[String(params.rel ?? 'gender')] ?? SETS.gender);

	// ---- analogy inputs -------------------------------------------------------------------
	const FAILS: Record<string, { w: [string, string, string]; expect: string; note: string[] }> = {
		brother: {
			w: ['brother', 'man', 'woman'],
			expect: 'sister',
			note: ['Family words are packed tightly:', 'daughter, wife and mother all beat sister.']
		},
		bigger: {
			w: ['bigger', 'big', 'small'],
			expect: 'smaller',
			note: ['bigger and larger mean the same,', 'so larger wins narrowly.']
		},
		doctor: {
			w: ['doctor', 'man', 'woman'],
			expect: '',
			note: ['A stereotype in the training text,', 'reproduced by the arithmetic.']
		},
		nurse: {
			w: ['nurse', 'woman', 'man'],
			expect: '',
			note: ['The same stereotype, the other', 'way round.']
		}
	};
	const PRESETS: [string, string, string][] = [
		['king', 'man', 'woman'],
		['paris', 'france', 'italy'],
		['walked', 'walk', 'swim'],
		['tokyo', 'japan', 'germany']
	];
	const fail = $derived(FAILS[String(params.fail ?? 'brother')] ?? FAILS.brother);
	const typed = $derived<[string, string, string]>([
		String(params.an1 ?? 'king'),
		String(params.an2 ?? 'man'),
		String(params.an3 ?? 'woman')
	]);
	const words = $derived<[string, string, string]>(
		phase === 'failures'
			? fail.w
			: (typed.map((w) => w.trim().toLowerCase()) as [string, string, string])
	);
	const excludeInputs = $derived(phase === 'failures' ? true : params.exclude !== false);
	const missing = $derived(emb ? words.filter((w) => !emb!.has(w)) : []);

	// ---- the analogy itself -----------------------------------------------------------------
	interface Pt {
		x: number;
		y: number;
	}
	const analogy = $derived.by(() => {
		if (!emb || phase === 'pairs' || missing.length) return null;
		const [plus, minus, add] = words;
		const r = emb.analogy(minus, plus, add, { k: 5, excludeInputs });
		if (!r) return null;
		const a = emb.vector(minus)!;
		const b = emb.vector(plus)!;
		const c = emb.vector(add)!;
		// The plane through a, b, c: x along c − a, y the part of b − a perpendicular to it.
		const ex = unit(c.map((v, j) => v - a[j]));
		const ba = b.map((v, j) => v - a[j]);
		const k = dot(ba, ex);
		const ey = unit(ba.map((v, j) => v - k * ex[j]));
		const at = (v: ArrayLike<number>): Pt => {
			const d = Array.from(v, (x, j) => x - a[j]);
			return { x: dot(d, ex), y: dot(d, ey) };
		};
		const land = at(r.vector);
		const results = r.results.map((n: Neighbour) => ({ ...n, p: at(emb!.vector(n.word)!) }));
		// The landing point is not a unit vector; its cosine with the top word tells how close.
		let expected: { word: string; rank: number; cos: number } | null = null;
		const want = phase === 'failures' ? fail.expect : '';
		if (want && emb.has(want)) {
			const all = emb.nearest(r.vector, 50, [minus, plus, add]);
			const rank = all.findIndex((n) => n.word === want);
			expected = { word: want, rank: rank + 1, cos: cosine(r.vector, emb.vector(want)!) };
		}
		return {
			a: { x: 0, y: 0 },
			b: at(b),
			c: at(c),
			land,
			results,
			expected,
			names: { plus, minus, add }
		};
	});

	// ---- the pairs view ---------------------------------------------------------------------
	const pairView = $derived.by(() => {
		if (!emb || phase !== 'pairs') return null;
		const axes = emb.pairAxes(rel.pairs);
		if (!axes) return null;
		const at = (w: string): Pt => {
			const v = emb!.vector(w)!;
			return { x: dot(v, axes.x), y: dot(v, axes.y) };
		};
		return rel.pairs.map(([p, q]) => {
			const d = Array.from(emb!.vector(q)!, (v, j) => v - emb!.vector(p)![j]);
			return { from: p, to: q, a: at(p), b: at(q), cos: cosine(d, axes.x) };
		});
	});

	// ---- fitting a set of points into the plot (equal scales) -------------------------------
	function fit(points: Pt[], margin = 70) {
		const xs = points.map((p) => p.x);
		const ys = points.map((p) => p.y);
		const x0 = Math.min(...xs);
		const x1 = Math.max(...xs);
		const y0 = Math.min(...ys);
		const y1 = Math.max(...ys);
		const s = Math.min(
			(PLOT.w - 2 * margin) / Math.max(x1 - x0, 1e-3),
			(PLOT.h - 2 * margin) / Math.max(y1 - y0, 1e-3)
		);
		const cx = (x0 + x1) / 2;
		const cy = (y0 + y1) / 2;
		return (p: Pt): Pt => ({
			x: PLOT.x + PLOT.w / 2 + (p.x - cx) * s,
			y: PLOT.y + PLOT.h / 2 - (p.y - cy) * s
		});
	}
	const toScreen = $derived.by(() => {
		if (pairView)
			return fit(
				pairView.flatMap((p) => [p.a, p.b]),
				80
			);
		if (analogy)
			return fit(
				[analogy.a, analogy.b, analogy.c, analogy.land, ...analogy.results.map((r) => r.p)],
				80
			);
		return (p: Pt) => p;
	});

	// ---- fades on changes (wall-clock tweens; motion inside the step is a function of t) -----
	const show = new Tween(1, { duration: 500, easing: cubicInOut });
	const key = $derived(`${phase}|${String(params.rel)}|${String(params.fail)}`);
	let lastKey = '';
	$effect(() => {
		const k = key;
		untrack(() => {
			if (lastKey && k !== lastKey && !reduced) {
				show.set(0, { duration: 0 });
				show.set(1, { duration: 500 });
			}
			lastKey = k;
		});
	});
	/** The arrows grow one after another at the start of the step. */
	const grow = (k: number) => (reduced ? 1 : smoothstep(0.3 + k * 0.35, 0.9 + k * 0.35, t));
	const landGrow = $derived(reduced ? 1 : smoothstep(1.4, 2.2, t));

	/** Baselines for the pair labels (left of the start, right of the end), nudged apart. */
	const pairLabels = $derived.by(() => {
		if (!pairView) return [];
		const boxes: [number, number, number, number][] = [];
		const place = (x0: number, x1: number, y: number) => {
			for (const dy of [0, 8, -8, 14, -14, 20, -20]) {
				const b: [number, number, number, number] = [x0, y + dy - 11, x1, y + dy + 3];
				if (!boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) {
					boxes.push(b);
					return y + dy;
				}
			}
			return y;
		};
		return pairView.map((pr) => {
			const a = toScreen(pr.a);
			const b = toScreen(pr.b);
			const ya = place(a.x - 8 - pr.from.length * 7.6, a.x - 8, a.y + 4);
			const yb = place(b.x + 8, b.x + 8 + pr.to.length * 7.6, b.y + 4);
			return { ya, yb };
		});
	});

	/** Result dots with labels to their right, nudged down or up (or dropped) to avoid overlaps. */
	const resultLabels = $derived.by(() => {
		if (!analogy) return [];
		const n = analogy.names;
		const boxes: [number, number, number, number][] = [];
		for (const p of [analogy.a, analogy.b, analogy.c]) {
			const q = toScreen(p);
			boxes.push([q.x - 90, q.y - 10, q.x + 70, q.y + 10]);
		}
		const out: {
			word: string;
			rank: number;
			px: number;
			py: number;
			lx: number | null;
			ly: number;
		}[] = [];
		analogy.results.forEach((r, rank) => {
			if (r.word === n.plus || r.word === n.minus || r.word === n.add) return;
			const p = toScreen(r.p);
			const w = (r.word.length + 3) * (rank === 0 ? 8.2 : 7) + 4;
			let placed: [number, number] | null = null;
			for (const dy of [4, 18, -10, 32, -24]) {
				const b: [number, number, number, number] = [
					p.x + 8,
					p.y + dy - 12,
					p.x + 10 + w,
					p.y + dy + 3
				];
				if (!boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) {
					boxes.push(b);
					placed = [p.x + 9, p.y + dy];
					break;
				}
			}
			boxes.push([p.x - 5, p.y - 5, p.x + 5, p.y + 5]);
			out.push({
				word: r.word,
				rank,
				px: p.x,
				py: p.y,
				lx: placed?.[0] ?? null,
				ly: placed?.[1] ?? 0
			});
		});
		return out;
	});

	const fmt = (v: number) => v.toFixed(2).replace(/^-/, '−');
	/** The baseline: mean cosine between the steps of random word pairs (−0.00 shown as 0.00). */
	const randomCos = $derived(emb ? fmt(emb.randomStepCosine()).replace(/^−(0\.00)$/, '$1') : '');
	function arrowEnd(a: Pt, b: Pt, u: number): Pt {
		return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
	}
	function buttonKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}
	const usePreset = (p: [string, string, string]) => {
		setParam('an1', p[0]);
		setParam('an2', p[1]);
		setParam('an3', p[2]);
	};
</script>

<g>
	<rect
		x={PLOT.x}
		y={PLOT.y}
		width={PLOT.w}
		height={PLOT.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if !emb}
		<Txt
			x={PLOT.x + PLOT.w / 2}
			y={300}
			text="Loading word vectors…"
			size={15}
			anchor="middle"
			muted
		/>
	{:else if pairView}
		<!-- ------------------------------------------------------------ pairs -->
		<g opacity={show.current}>
			<Readout id="view-note">
				<Txt
					x={PLOT.x + 16}
					y={PLOT.y + PLOT.h - 16}
					text="A flat linear view: across = the average direction of the arrows"
					size={11}
					muted
				/>
			</Readout>
			{#each pairView as pr, k (pr.from)}
				{@const a = toScreen(pr.a)}
				{@const b = toScreen(pr.b)}
				{@const u = grow(k)}
				{@const e = arrowEnd(a, b, u)}
				<circle cx={a.x} cy={a.y} r="4" fill="var(--stage-ink)" />
				<Txt x={a.x - 8} y={pairLabels[k].ya} text={pr.from} size={13} anchor="end" weight={600} />
				{#if u > 0.02}
					<line
						x1={a.x}
						y1={a.y}
						x2={e.x}
						y2={e.y}
						stroke="var(--emb-sum)"
						stroke-width="2.5"
						marker-end="url(#arrowhead)"
					/>
				{/if}
				<g opacity={u}>
					<circle cx={b.x} cy={b.y} r="4" fill="var(--emb-sum)" />
					<Txt
						x={b.x + 8}
						y={pairLabels[k].yb}
						text={pr.to}
						size={13}
						weight={600}
						color="var(--emb-sum)"
					/>
				</g>
			{/each}
		</g>
		<!-- panel -->
		<Readout id="pairs-title">
			<Txt x={PL} y={40} text={rel.title} size={16} weight={700} />
			<Txt x={PL} y={60} text="each arrow's cosine with the average" size={11} muted />
			<Txt x={PL} y={74} text="direction, in the full 100-D space" size={11} muted />
		</Readout>
		{#each pairView as pr, k (pr.from)}
			{@const y = 104 + k * 28}
			<Readout
				id="pair-{k}"
				order={k + 1}
				label="{pr.from} → {pr.to}"
				value="cos {fmt(pr.cos)}"
				opacity={k < 4 ? 1 : 0}
			>
				<g opacity={grow(k) * 0.7 + 0.3}>
					<Txt x={PL} {y} text="{pr.from} → {pr.to}" size={13} weight={600} />
					<rect
						x={PL + 160}
						y={y - 10}
						width={80 * clamp(pr.cos)}
						height="11"
						rx="3"
						fill="var(--emb-sum)"
						opacity="0.6"
					/>
					<Txt x={PR} {y} text={fmt(pr.cos)} size={13} anchor="end" />
				</g>
			</Readout>
		{/each}
		<Readout id="random" order={9} label="Two random word steps" value="cos ≈ {randomCos}">
			{@const y = 104 + pairView.length * 28 + 18}
			<line x1={PL} x2={PR} y1={y - 16} y2={y - 16} stroke="var(--stage-line)" />
			<Txt x={PL} y={y + 4} text="for comparison, the steps between" size={12} muted />
			<Txt x={PL} y={y + 20} text="random words: cos ≈ {randomCos}" size={12} muted />
		</Readout>
	{:else if analogy}
		<!-- ------------------------------------------------------------ analogy -->
		{@const A = toScreen(analogy.a)}
		{@const B = toScreen(analogy.b)}
		{@const C = toScreen(analogy.c)}
		{@const L = toScreen(analogy.land)}
		{@const n = analogy.names}
		{@const e1 = arrowEnd(A, C, grow(0))}
		{@const e2 = arrowEnd(B, L, grow(2))}
		<g opacity={show.current}>
			<Readout id="plane-note">
				<Txt
					x={PLOT.x + 16}
					y={PLOT.y + PLOT.h - 16}
					text="The plane through {n.plus}, {n.minus} and {n.add}; other words drawn where their shadow falls"
					size={11}
					muted
				/>
			</Readout>
			<!-- a → c and b → landing: the same step -->
			<line
				x1={A.x}
				y1={A.y}
				x2={B.x}
				y2={B.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<line
				x1={C.x}
				y1={C.y}
				x2={L.x}
				y2={L.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity={landGrow}
			/>
			<line
				x1={A.x}
				y1={A.y}
				x2={e1.x}
				y2={e1.y}
				stroke="var(--emb-sum)"
				stroke-width="2.5"
				marker-end="url(#arrowhead)"
			/>
			{#if grow(2) > 0.02}
				<line
					x1={B.x}
					y1={B.y}
					x2={e2.x}
					y2={e2.y}
					stroke="var(--emb-sum)"
					stroke-width="2.5"
					marker-end="url(#arrowhead)"
				/>
			{/if}
			<Readout id="step-label">
				<Txt
					x={(A.x + C.x) / 2}
					y={(A.y + C.y) / 2 + 20}
					text="− {n.minus} + {n.add}"
					size={12}
					anchor="middle"
					color="var(--emb-sum)"
					weight={600}
				/>
				<Txt
					x={(B.x + L.x) / 2}
					y={(B.y + L.y) / 2 - 10}
					text="the same step"
					size={12}
					anchor="middle"
					color="var(--emb-sum)"
					weight={600}
					opacity={grow(2)}
				/>
			</Readout>
			<!-- results (labels placed so they do not overlap) -->
			{#each resultLabels as r (r.word)}
				<g opacity={landGrow}>
					<circle
						cx={r.px}
						cy={r.py}
						r={r.rank === 0 ? 6 : 4.5}
						fill="var(--emb-result)"
						opacity={r.rank === 0 ? 1 : 0.7}
					/>
					{#if r.lx !== null}
						<Txt
							x={r.lx}
							y={r.ly}
							text="{r.rank + 1}. {r.word}"
							size={r.rank === 0 ? 14 : 12}
							weight={r.rank === 0 ? 700 : 500}
							color={r.rank === 0 ? 'var(--emb-result)' : undefined}
						/>
					{/if}
				</g>
			{/each}
			<!-- the three inputs: a and b labelled on the left, c (always right of a) on the right -->
			{#each [{ q: A, w: n.minus, right: false }, { q: B, w: n.plus, right: false }, { q: C, w: n.add, right: true }] as { q, w, right }, k (k)}
				{@const top = analogy.results[0]?.word === w}
				<circle cx={q.x} cy={q.y} r="5" fill="var(--stage-ink)" />
				<Txt
					x={right ? q.x + 10 : q.x - 10}
					y={q.y + 5}
					text={top ? `1. ${w}` : w}
					size={14}
					anchor={right ? 'start' : 'end'}
					weight={700}
					color={top ? 'var(--emb-warn)' : undefined}
				/>
			{/each}
			<!-- the landing point -->
			<g opacity={landGrow}>
				<circle cx={L.x} cy={L.y} r="9" fill="none" stroke="var(--emb-sum)" stroke-width="2" />
				<circle cx={L.x} cy={L.y} r="2.5" fill="var(--emb-sum)" />
				<Readout id="land">
					<Txt
						x={L.x}
						y={L.y + 26}
						text="{n.plus} − {n.minus} + {n.add}"
						size={12}
						anchor="middle"
						weight={600}
						color="var(--emb-sum)"
					/>
				</Readout>
			</g>
		</g>

		<!-- panel -->
		{#if phase === 'failures'}
			<Txt x={PL} y={40} text="{n.plus} − {n.minus} + {n.add}" size={16} weight={700} />
			{#each fail.note as line, k (k)}
				<Txt x={PL} y={62 + k * 16} text={line} size={11.5} muted />
			{/each}
		{/if}
		{@const y0 = phase === 'analogy' ? 196 : 124}
		<Readout id="res-head">
			<Txt
				x={PL}
				y={y0}
				text="closest words{excludeInputs ? ' (inputs left out)' : ''}"
				size={11}
				muted
			/>
			<Txt x={PR} y={y0} text="cos θ" size={11} anchor="end" muted />
		</Readout>
		{#each analogy.results as r, k (r.word)}
			{@const y = y0 + 26 + k * 28}
			{@const inputs = r.word === n.plus || r.word === n.minus || r.word === n.add}
			<Readout
				id="res-{k}"
				order={k + 1}
				label="{k + 1}. {r.word}"
				value={fmt(r.cos)}
				color={k === 0 ? 'var(--emb-result)' : undefined}
				opacity={k < 4 ? 1 : 0}
			>
				<Txt x={PL} {y} text={String(k + 1)} size={11} muted />
				<Txt
					x={PL + 18}
					{y}
					text={r.word}
					size={14}
					weight={k === 0 ? 700 : 500}
					color={inputs ? 'var(--emb-warn)' : k === 0 ? 'var(--emb-result)' : undefined}
				/>
				<rect
					x={PL + 130}
					y={y - 10}
					width={(PR - PL - 176) * clamp(r.cos)}
					height="11"
					rx="3"
					fill="var(--emb-result)"
					opacity="0.55"
				/>
				<Txt x={PR} {y} text={fmt(r.cos)} size={13} anchor="end" />
			</Readout>
		{/each}
		{@const y1 = y0 + 26 + 5 * 28 + 6}
		{#if !excludeInputs && analogy.results[0] && [n.plus, n.minus, n.add].includes(analogy.results[0].word)}
			<Readout
				id="self"
				order={8}
				label="Closest word"
				value="{analogy.results[0].word}, one of the inputs"
			>
				<Txt
					x={PL}
					y={y1}
					text="The closest word is {analogy.results[0].word} itself:"
					size={12.5}
					weight={600}
					color="var(--emb-warn)"
				/>
				<Txt
					x={PL}
					y={y1 + 18}
					text="the step from {n.minus} to {n.add} is short."
					size={12.5}
					color="var(--emb-warn)"
				/>
			</Readout>
		{:else if analogy.expected}
			<Readout
				id="expected"
				order={8}
				label="Expected: {analogy.expected.word}"
				value={analogy.expected.rank > 0
					? `number ${analogy.expected.rank}, cos ${fmt(analogy.expected.cos)}`
					: `cos ${fmt(analogy.expected.cos)}`}
			>
				<Txt x={PL} y={y1} text="Expected: {analogy.expected.word}" size={13} weight={600} />
				<Txt
					x={PL}
					y={y1 + 18}
					text={analogy.expected.rank > 0
						? `number ${analogy.expected.rank} in the list, cos ${fmt(analogy.expected.cos)}`
						: `cos ${fmt(analogy.expected.cos)}`}
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{:else if phase !== 'pairs'}
		<!-- an unknown word in the inputs -->
		<Txt
			x={PLOT.x + PLOT.w / 2}
			y={300}
			text="“{missing.join('”, “')}” {missing.length > 1
				? 'are'
				: 'is'} not among our {emb.size.toLocaleString('en-US')} words"
			size={15}
			anchor="middle"
			color="var(--emb-warn)"
			weight={600}
		/>
	{/if}

	<!-- the analogy inputs stay mounted while typing (an unknown word must not move them) -->
	{#if emb && phase === 'analogy'}
		<Txt x={PL} y={36} text="Type three words" size={15} weight={700} />
		{#each [0, 1, 2] as k (k)}
			{@const x = PL + k * 98}
			<WordInput
				{x}
				y={48}
				w={80}
				size={15}
				phoneSize={17}
				value={typed[k]}
				label={['First word', 'Word to subtract', 'Word to add'][k]}
				invalid={!emb.has(words[k])}
				maxlength={16}
				oninput={(v: string) => setParam(`an${k + 1}`, v)}
			/>
			{#if k < 2}
				<Txt x={x + 89} y={74} text={k === 0 ? '−' : '+'} size={20} anchor="middle" weight={700} />
			{/if}
		{/each}
		<Readout id="presets-label">
			<Txt x={PL} y={116} text="Try:" size={11} muted />
		</Readout>
		{#each PRESETS as pr, k (k)}
			{@const on = pr.every((w, j) => w === words[j])}
			{@const x = PL + 30 + (k % 2) * 128}
			{@const y = 106 + Math.floor(k / 2) * 30}
			<g
				class="emb-chip"
				role="button"
				tabindex="0"
				aria-label="Use {pr[0]} minus {pr[1]} plus {pr[2]}"
				aria-pressed={on}
				onclick={() => usePreset(pr)}
				onkeydown={(e) => buttonKey(e, () => usePreset(pr))}
			>
				<rect
					{x}
					y={y - 8}
					width="122"
					height="24"
					rx="12"
					fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
					fill-opacity={on ? 0.18 : 1}
					stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
				/>
				<Txt
					x={x + 61}
					y={y + 8}
					text="{pr[0]} − {pr[1]} + {pr[2]}"
					size={pr.join('').length > 15 ? 9.5 : 10.5}
					anchor="middle"
					halo={false}
				/>
			</g>
		{/each}
	{/if}
</g>

<style>
	.emb-chip {
		cursor: pointer;
		outline: none;
	}
	.emb-chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
