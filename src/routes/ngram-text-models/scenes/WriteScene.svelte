<script lang="ts">
	/**
	 * The machine writes from the counts of the reader's text, one letter per beat. Top: the text
	 * written so far. Bottom: the current draw as a spinner laid flat: one slice per letter that
	 * followed the window, as wide as its count, and the random draw that lands in one of them.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { NgramModel, chars } from '../ngram';
	import TextBlock from './TextBlock.svelte';
	import { num, ownText, seedOf, visible, type Kind } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const msg = $derived(ownText(params));
	const n = $derived(Math.max(1, Math.min(4, Math.round(num(params.cn, 2)))));
	const seed = $derived(seedOf(params));
	const model = $derived(new NgramModel(msg));
	const LENGTH = 72;
	const sample = $derived(model.sample(n, LENGTH, seed));
	const cs = $derived(chars(sample.text));
	const N = $derived(sample.draws.length);

	// ---- the clock: one letter per beat, a pause at the end, then again
	const BEAT = 0.4;
	const period = $derived(N * BEAT + 4);
	const tt = $derived(reduced ? period : t % period);
	const cur = $derived(Math.max(0, Math.min(N - 1, Math.floor(tt / BEAT))));
	const u = $derived(reduced || tt >= N * BEAT ? 1 : (tt - cur * BEAT) / BEAT);
	/** Letters on show: the current one appears once the draw has landed. */
	const shown = $derived(u > 0.7 ? cur + 1 : cur);
	const d = $derived(sample.draws[cur]);
	const windowText = $derived(d ? cs.slice(cur - d.window, cur).join('') : '');
	const slices = $derived(d ? model.slices(windowText) : []);
	const picked = $derived(cs[cur] ?? '');
	const offered = $derived(slices.length);

	const kind = (i: number): Kind =>
		i === cur && shown === cur + 1 && !reduced
			? 'hot'
			: i >= cur - (d?.window ?? 0) && i < cur
				? 'window'
				: 'plain';

	// ---- the strip
	const S = { x: 60, y: 350, w: 840, h: 40 };
	const segs = $derived(
		d
			? slices.map((s) => ({
					...s,
					x: S.x + (s.start / d.count) * S.w,
					w: (s.count / d.count) * S.w,
					hit: s.char === picked
				}))
			: []
	);
	const marker = $derived(reduced ? 1 : smoothstep(0.1, 0.55, u));
	const target = $derived(d ? S.x + ((d.offset + 0.5) / d.count) * S.w : S.x);
	const mx = $derived(S.x + (target - S.x) * marker);

	const head = $derived(
		d
			? d.window === 0
				? 'nothing written yet: any letter of the text, by its count'
				: `window “${visible(windowText)}” came up ${d.count} time${d.count === 1 ? '' : 's'} in your text, followed by:`
			: ''
	);
	const result = $derived(
		!d
			? ''
			: offered === 1
				? `only one letter ever followed it: “${visible(picked)}”. No choice.`
				: `${offered} different letters followed it; the draw landed on “${visible(picked)}”`
	);
	const forced = $derived(sample.draws.filter((x) => x.forced).length);
</script>

<g>
	<Readout
		id="setting"
		order={1}
		label="Learned from"
		value="your text, {chars(msg).length} letters, window of {n}"
	>
		<Label
			anchor="start"
			tabular
			x={44}
			y={40}
			size={12}
			muted
			text="learned from your text ({chars(msg).length} letters) · window of {n} · draw no. {seed}"
		/>
	</Readout>
	<Readout id="written" order={2} label="Written so far" value={cs.slice(0, shown).join('')}>
		<rect
			x="24"
			y="56"
			width="912"
			height="180"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<TextBlock
			x={48}
			y={96}
			w={864}
			chars={cs.slice(0, shown)}
			{kind}
			size={20}
			lineH={32}
			maxLines={5}
			tail
			cursor={!reduced && shown < N}
		/>
	</Readout>

	{#if d}
		<Readout id="head" order={3} label="This letter" value="{head} {result}">
			<Label anchor="start" tabular x={S.x} y={290} size={14} weight={650} text={head} />
		</Readout>
		{#each segs as g (g.start)}
			<rect
				x={g.x}
				y={S.y}
				width={Math.max(0.5, g.w - 1.5)}
				height={S.h}
				rx="4"
				fill={g.hit && marker > 0.97 ? 'var(--ng-hot)' : 'var(--ng-slice)'}
				opacity={g.hit && marker > 0.97 ? 0.9 : 0.55}
			/>
			{#if g.w > 26}
				<text
					x={g.x + g.w / 2}
					y={S.y + 17}
					text-anchor="middle"
					font-size="15"
					font-weight="700"
					style:font-family="var(--font-mono)"
					style:white-space="pre"
					style:fill="var(--stage-ink)">{visible(g.char)}</text
				>
				<text
					x={g.x + g.w / 2}
					y={S.y + 33}
					text-anchor="middle"
					font-size="11"
					style:fill="var(--stage-ink)">×{g.count}</text
				>
			{/if}
		{/each}
		<rect x={S.x} y={S.y} width={S.w} height={S.h} rx="4" fill="none" stroke="var(--stage-line)" />
		<g opacity={reduced ? 1 : smoothstep(0.05, 0.15, u)}>
			<path d="M{mx} {S.y - 3} l-8 -13 h16 Z" fill="var(--ng-hot)" />
			<line
				x1={mx}
				y1={S.y - 3}
				x2={mx}
				y2={S.y + S.h + 3}
				stroke="var(--ng-hot)"
				stroke-width="2.5"
			/>
		</g>
		<Readout id="result">
			<Label
				anchor="start"
				tabular
				x={S.x}
				y={S.y + S.h + 34}
				size={13.5}
				weight={600}
				color="var(--ng-hot)"
				opacity={marker > 0.97 ? 1 : 0}
				text={result}
			/>
		</Readout>
		<Readout id="forced" order={4} label="No choice" value="{forced} of {N} letters">
			<Label
				anchor="start"
				tabular
				x={S.x}
				y={480}
				size={12}
				muted
				text="Of the {N} letters it writes, {forced} had only one possible next letter: no choice at all."
			/>
		</Readout>
	{/if}
</g>
