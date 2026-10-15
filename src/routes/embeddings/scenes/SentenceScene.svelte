<script lang="ts">
	/**
	 * Two sentences compared by the angle between the averages of their word vectors.
	 *
	 * Phases (`step.hints.phase`):
	 *   compare — two text boxes (`params.s1`, `params.s2`, typed on the stage) with preset
	 *             pairs. Under each box its words as chips: known words in ink, words not in our
	 *             list crossed out. Below, each sentence's average vector as a strip of 100 bars
	 *             and, on the right, the plane of the two averages with the true angle.
	 *   order   — the same drawing for the fixed pairs of `params.order` (same words, different
	 *             order): the two strips are identical and the angle is 0°.
	 * The words light up one by one and the average strips build up as a function of t.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { load, angleDeg, cosine, tokens, type Embeddings } from '../embeddings';
	import WordInput from './WordInput.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	let emb = $state.raw<Embeddings | null>(null);
	$effect(() => {
		load().then((e) => (emb = e));
	});

	const PRESETS: [string, string][] = [
		['shares fell sharply on wall street', 'the stock market dropped'],
		['the team won the match', 'the bank raised interest rates'],
		['heavy rain and strong wind', 'a storm is coming'],
		['a cat sat on the mat', 'a dog slept on the sofa']
	];
	const ORDER: Record<string, [string, string]> = {
		bite: ['the dog bit the man', 'the man bit the dog'],
		film: ['the film was not good, it was bad', 'the film was not bad, it was good']
	};
	const phase = $derived(String(step.hints?.phase ?? 'compare'));
	const fixed = $derived(phase === 'order');
	const s1 = $derived(
		fixed ? (ORDER[String(params.order)] ?? ORDER.bite)[0] : String(params.s1 ?? PRESETS[0][0])
	);
	const s2 = $derived(
		fixed ? (ORDER[String(params.order)] ?? ORDER.bite)[1] : String(params.s2 ?? PRESETS[0][1])
	);

	const D = 100;
	const zero = Array<number>(D).fill(0);
	const sentA = $derived(emb ? emb.sentence(s1) : null);
	const sentB = $derived(emb ? emb.sentence(s2) : null);
	const cos = $derived(sentA?.vector && sentB?.vector ? cosine(sentA.vector, sentB.vector) : null);
	const theta = $derived(
		sentA?.vector && sentB?.vector ? angleDeg(sentA.vector, sentB.vector) : null
	);

	// Average strips, scaled so the larger average fills the row, gliding on change.
	const barsA = new Tween<number[]>(zero, { duration: 600, easing: cubicInOut });
	const barsB = new Tween<number[]>(zero, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const a = sentA?.vector ? Array.from(sentA.vector) : zero;
		untrack(() => barsA.set(a, { duration: reduced ? 0 : 600 }));
	});
	$effect(() => {
		const b = sentB?.vector ? Array.from(sentB.vector) : zero;
		untrack(() => barsB.set(b, { duration: reduced ? 0 : 600 }));
	});
	const vmax = $derived(
		Math.max(0.05, ...barsA.current.map(Math.abs), ...barsB.current.map(Math.abs))
	);

	// ---- layout ---------------------------------------------------------------------------
	const L = 30;
	const W = 580;
	const PL = 650;
	const PR = 944;
	const rowA = { y: 350, h: 40 };
	const rowB = { y: 470, h: 40 };
	const X0 = L;
	const X1 = L + W;
	const bw = W / D;

	interface Chip {
		word: string;
		known: boolean;
		x: number;
		w: number;
		/** The "…" that stands for words past the box's edge (they still count in the average). */
		more?: boolean;
	}
	const MORE_W = 22;
	function chips(text: string): Chip[] {
		if (!emb) return [];
		let x = L;
		const out: Chip[] = [];
		for (const w of tokens(text)) {
			const cw = w.length * 7.4 + 16;
			if (x + cw > L + W) {
				while (out.length && x + MORE_W > L + W) x = out.pop()!.x;
				out.push({ word: '…', known: true, x, w: MORE_W, more: true });
				break;
			}
			out.push({ word: w, known: emb.has(w), x, w: cw });
			x += cw + 6;
		}
		return out;
	}
	const chipsA = $derived(chips(s1));
	const chipsB = $derived(chips(s2));
	/** The words light up one by one at the start of the step (all at once under reduced motion). */
	const lit = (k: number) => (reduced ? 1 : smoothstep(0.2 + k * 0.15, 0.5 + k * 0.15, t));
	const build = $derived(reduced ? 1 : smoothstep(1.2, 2.4, t));

	// The plane of the two averages.
	const C = { x: 770, y: 470 };
	const R = 140;
	const base = -6;
	const tip = (deg: number, r = R) => ({
		x: C.x + r * Math.cos((deg * Math.PI) / 180),
		y: C.y - r * Math.sin((deg * Math.PI) / 180)
	});
	const ta = $derived(tip(base));
	const tb = $derived(tip(base + (theta ?? 0)));
	const arc = $derived.by(() => {
		const r = 42;
		const s = tip(base, r);
		const e = tip(base + (theta ?? 0), r);
		return `M${s.x} ${s.y} A${r} ${r} 0 0 0 ${e.x} ${e.y}`;
	});
	const mid = $derived(tip(base + (theta ?? 0) / 2, 64));

	const fmt = (v: number) => v.toFixed(2).replace(/^-/, '−');
	function buttonKey(e: KeyboardEvent, act: () => void) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	}
	const usePreset = (p: [string, string]) => {
		setParam('s1', p[0]);
		setParam('s2', p[1]);
	};
</script>

{#snippet sentence(y: number, text: string, list: Chip[], color: string, id: string, n: number)}
	<Label
		anchor="start"
		tabular
		x={L}
		y={y - 10}
		text="Sentence {n}"
		size={12}
		weight={700}
		{color}
	/>
	{#if fixed}
		<rect x={L} {y} width={W} height="40" rx="10" fill="var(--surface)" stroke="var(--border)" />
		<Label anchor="start" x={L + 12} y={y + 26} {text} size={17} halo={false} />
	{:else}
		<WordInput
			x={L}
			{y}
			w={W}
			value={text}
			label="Sentence {n}"
			maxlength={60}
			size={17}
			oninput={(v: string) => setParam(id, v)}
		/>
	{/if}
	{#each list as c, k (k)}
		<g opacity={0.25 + 0.75 * lit(k)}>
			{#if c.more}
				<Label
					tabular
					x={c.x + c.w / 2}
					y={y + 68.5}
					text={c.word}
					size={14}
					anchor="middle"
					muted
				/>
			{:else}
				<rect
					x={c.x}
					y={y + 52}
					width={c.w}
					height="24"
					rx="12"
					fill={c.known ? color : 'none'}
					fill-opacity={c.known ? 0.16 : 0}
					stroke={c.known ? color : 'var(--stage-line)'}
					stroke-dasharray={c.known ? undefined : '3 3'}
				/>
				<Label
					tabular
					x={c.x + c.w / 2}
					y={y + 68.5}
					text={c.word}
					size={12.5}
					anchor="middle"
					weight={c.known ? 600 : 400}
					muted={!c.known}
					halo={false}
				/>
				{#if !c.known}
					<line
						x1={c.x + 8}
						x2={c.x + c.w - 8}
						y1={y + 64}
						y2={y + 64}
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
					/>
				{/if}
			{/if}
		</g>
	{/each}
{/snippet}

{#snippet strip(vals: number[], row: { y: number; h: number }, color: string)}
	<line x1={X0 - 4} x2={X1 + 2} y1={row.y} y2={row.y} stroke="var(--stage-line)" stroke-width="1" />
	{#each vals as v, i (i)}
		{@const h = clamp(v / vmax, -1, 1) * row.h * build}
		<rect
			x={X0 + i * bw + bw * 0.14}
			y={h >= 0 ? row.y - h : row.y}
			width={bw * 0.72}
			height={Math.max(0.5, Math.abs(h))}
			fill={color}
			opacity="0.9"
		/>
	{/each}
{/snippet}

<g>
	{#if !emb || !sentA || !sentB}
		<Label x={480} y={300} text="Loading word vectors…" size={15} anchor="middle" muted />
	{:else}
		{@render sentence(40, s1, chipsA, 'var(--emb-a)', 's1', 1)}
		{@render sentence(150, s2, chipsB, 'var(--emb-b)', 's2', 2)}
		<Readout id="skipped">
			<Label
				anchor="start"
				tabular
				x={L}
				y={258}
				text="Crossed out: not among our {emb.size.toLocaleString('en-US')} words, so skipped."
				size={11}
				muted
			/>
		</Readout>

		<!-- the averages -->
		<Readout id="avg-title">
			<Label
				anchor="start"
				x={L}
				y={rowA.y - rowA.h - 14}
				text="Average of sentence 1's words"
				size={13}
				weight={600}
				color="var(--emb-a)"
			/>
			<Label
				anchor="start"
				x={L}
				y={rowB.y - rowB.h - 14}
				text="Average of sentence 2's words"
				size={13}
				weight={600}
				color="var(--emb-b)"
			/>
		</Readout>
		{@render strip(barsA.current, rowA, 'var(--emb-a)')}
		{@render strip(barsB.current, rowB, 'var(--emb-b)')}
		<Readout
			id="known-a"
			order={1}
			label="Sentence 1 uses"
			value={sentA.known.join(', ') || 'no known word'}
			color="var(--emb-a)"
		/>
		<Readout
			id="known-b"
			order={2}
			label="Sentence 2 uses"
			value={sentB.known.join(', ') || 'no known word'}
			color="var(--emb-b)"
		/>

		<!-- the angle between the two averages -->
		{#if cos !== null && theta !== null}
			<g opacity={build}>
				<line
					x1={C.x}
					y1={C.y}
					x2={ta.x}
					y2={ta.y}
					stroke="var(--emb-a)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
				/>
				<line
					x1={C.x}
					y1={C.y}
					x2={tb.x}
					y2={tb.y}
					stroke="var(--emb-b)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
					stroke-dasharray={theta < 1 ? '8 6' : undefined}
				/>
				{#if theta >= 1}
					<path d={arc} fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
				{/if}
				<circle cx={C.x} cy={C.y} r="3.5" fill="var(--stage-ink)" />
				<Label
					tabular
					x={ta.x}
					y={ta.y + 24}
					text={theta < 4 ? '1 and 2' : '1'}
					size={13}
					anchor="middle"
					weight={700}
					color="var(--emb-a)"
				/>
				<Label
					x={tb.x + 4}
					y={tb.y - 10}
					text="2"
					size={13}
					anchor="middle"
					weight={700}
					color="var(--emb-b)"
					opacity={theta < 4 ? 0 : 1}
				/>
				<Readout
					id="cos"
					order={3}
					label="Angle between the averages"
					value="θ = {theta.toFixed(0)}°, cos θ = {fmt(cos)}"
				>
					{#if theta >= 6}
						<Label
							anchor="start"
							tabular
							x={mid.x + 4}
							y={mid.y + 4}
							text="θ = {theta.toFixed(0)}°"
							size={13}
							weight={700}
						/>
					{/if}
					<Label
						tabular
						x={C.x + R}
						y={C.y + 66}
						text="cos θ = {fmt(cos)}"
						size={20}
						anchor="end"
						weight={700}
					/>
					<Label
						tabular
						x={C.x + R}
						y={C.y + 88}
						text={theta < 1
							? 'the same direction: identical averages'
							: `an angle of ${theta.toFixed(0)}°`}
						size={12}
						anchor="end"
						muted
					/>
				</Readout>
			</g>
		{:else}
			<Readout id="nocos" order={3} label="Angle" value="needs a known word in each sentence">
				<Label
					x={C.x}
					y={C.y}
					text="Each sentence needs at least"
					size={13}
					anchor="middle"
					color="var(--emb-warn)"
				/>
				<Label
					x={C.x}
					y={C.y + 18}
					text="one word from our list."
					size={13}
					anchor="middle"
					color="var(--emb-warn)"
				/>
			</Readout>
		{/if}

		<!-- panel: presets (compare) or the point (order) -->
		{#if !fixed}
			<Readout id="try">
				<Label anchor="start" x={PL} y={52} text="Try these pairs:" size={12} muted />
			</Readout>
			{#each PRESETS as pr, k (k)}
				{@const on = pr[0] === s1 && pr[1] === s2}
				{@const y = 66 + k * 46}
				<g
					class="emb-chip"
					role="button"
					tabindex="0"
					aria-label="Compare “{pr[0]}” with “{pr[1]}”"
					aria-pressed={on}
					onclick={() => usePreset(pr)}
					onkeydown={(e) => buttonKey(e, () => usePreset(pr))}
				>
					<rect
						x={PL}
						{y}
						width={PR - PL}
						height="40"
						rx="10"
						fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
						fill-opacity={on ? 0.16 : 1}
						stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
					/>
					<Label
						anchor="start"
						tabular
						x={PL + 10}
						y={y + 17}
						text={pr[0]}
						size={11}
						halo={false}
					/>
					<Label
						anchor="start"
						tabular
						x={PL + 10}
						y={y + 32}
						text={pr[1]}
						size={11}
						muted
						halo={false}
					/>
				</g>
			{/each}
		{:else}
			<Readout
				id="same-words"
				order={4}
				label="Same words"
				value="different order, identical average"
			>
				<Label
					anchor="start"
					x={PL}
					y={60}
					text="The same words in a different order:"
					size={13}
					weight={600}
				/>
				<Label
					anchor="start"
					x={PL}
					y={80}
					text="the averages are identical, so the"
					size={12}
					muted
				/>
				<Label anchor="start" x={PL} y={96} text="angle is 0° and cos θ = 1.00." size={12} muted />
			</Readout>
		{/if}
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
