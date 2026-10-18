<script lang="ts">
	/**
	 * The three meters side by side against the window, n = 1 … 10, for the machine trained on
	 * all 1,003,854 letters: real words in its writing and the longest copy (each the average of
	 * three samples of 600 characters) and held-out windows never seen. The curves draw in from
	 * left to right, then hold.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { MAX_N } from '../ngram';
	import { measuresFor, pct, shakespeare, unseenFor, windowOf, type Shakespeare } from './shared';

	let { t, params, reduced }: StageProps = $props();

	let data = $state<Shakespeare | null>(null);
	let failed = $state(false);
	$effect(() => {
		shakespeare().then(
			(d) => (data = d),
			() => (failed = true)
		);
	});

	const n = $derived(windowOf(params));
	const SEEDS = [1, 2, 3];
	const avg = $derived.by(() => {
		if (!data) return null;
		const runs = SEEDS.map((s) => measuresFor(data as Shakespeare, '1m', s));
		const mean = (f: (i: number, r: number) => number) =>
			Array.from(
				{ length: MAX_N },
				(_, i) => runs.reduce((s, _r, r) => s + f(i, r), 0) / runs.length
			);
		return {
			real: mean((i, r) => runs[r][i].realWords),
			copy: mean((i, r) => runs[r][i].copy.length),
			unseen: unseenFor(data, '1m').slice(1)
		};
	});
	const copyTop = $derived(avg ? Math.max(80, Math.ceil(Math.max(...avg.copy) / 20) * 20) : 80);

	const W = 250;
	const X0 = [70, 385, 700];
	const Y = { top: 130, bottom: 400 };
	const panels = $derived(
		avg
			? [
					{
						id: 'real',
						title: 'Fluency',
						sub: 'real words in its writing',
						values: avg.real,
						top: 1,
						color: 'var(--ng-real)',
						fmt: (v: number) => pct(v),
						yTicks: [0, 0.5, 1],
						yFormat: (v: number) => `${Math.round(v * 100)}%`,
						verdict: 'more fluent'
					},
					{
						id: 'unseen',
						title: 'Blind spots',
						sub: 'held-out windows never seen',
						values: avg.unseen,
						top: 1,
						color: 'var(--ng-unseen)',
						fmt: (v: number) => pct(v),
						yTicks: [0, 0.5, 1],
						yFormat: (v: number) => `${Math.round(v * 100)}%`,
						verdict: 'more of new text is a blank'
					},
					{
						id: 'copy',
						title: 'Copying',
						sub: 'longest stretch copied (letters)',
						values: avg.copy,
						top: copyTop,
						color: 'var(--ng-copy)',
						fmt: (v: number) => `${Math.round(v)} letters`,
						yTicks: [0, copyTop / 2, copyTop],
						yFormat: (v: number) => String(Math.round(v)),
						verdict: 'more recitation'
					}
				].map((p, i) => ({
					...p,
					sx: scale([1, MAX_N], [X0[i], X0[i] + W]),
					sy: scale([0, p.top], [Y.bottom, Y.top])
				}))
			: []
	);
	// the curves draw in over 3 s
	const reveal = $derived(reduced ? MAX_N : 1 + clamp(t / 3) * (MAX_N - 1));
	const pts = (vs: number[]) => {
		const out: { n: number; v: number }[] = [];
		for (let i = 0; i < vs.length && i + 1 <= reveal; i++) out.push({ n: i + 1, v: vs[i] });
		const k = Math.floor(reveal);
		if (k < vs.length && reveal > k) {
			const f = reveal - k;
			out.push({ n: reveal, v: vs[k - 1] + (vs[k] - vs[k - 1]) * f });
		}
		return out;
	};
</script>

<g>
	{#if !data || !avg}
		<Label
			x={480}
			y={300}
			size={14}
			muted
			text={failed ? 'Tiny Shakespeare could not be loaded.' : 'Loading Tiny Shakespeare (1.1 MB)…'}
		/>
	{:else}
		<Readout
			id="title"
			order={1}
			label="As the window grows"
			value="1 → 10 letters, all 1,003,854 letters of training text"
		>
			<Label
				x={480}
				y={44}
				size={16}
				weight={700}
				text="As the window grows from 1 to 10 letters…"
			/>
		</Readout>
		{#each panels as p (p.id)}
			<Readout
				id={p.id}
				order={2}
				label={p.title}
				value="window of {n}: {p.fmt(p.values[n - 1])}"
				note={p.sub}
				color={p.color}
			>
				<Label x={p.sx(5.5)} y={84} size={14} weight={700} color={p.color} text={p.title} />
				<Label x={p.sx(5.5)} y={104} size={11} muted text={p.sub} />
			</Readout>
			<Axes
				sx={p.sx}
				sy={p.sy}
				xTicks={[1, 4, 7, 10]}
				yTicks={p.yTicks}
				yFormat={p.yFormat}
				xLabel="window"
			/>
			<path
				d={linePath(
					pts(p.values),
					(d) => d.n,
					(d) => d.v,
					p.sx,
					p.sy
				)}
				fill="none"
				stroke={p.color}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			{#if n <= reveal}
				<circle cx={p.sx(n)} cy={p.sy(p.values[n - 1])} r="5.5" fill={p.color} />
				<Readout id="{p.id}-value">
					<Label
						x={p.sx(n)}
						y={p.sy(p.values[n - 1]) + (p.values[n - 1] > p.top * 0.8 ? 22 : -12)}
						size={12}
						weight={650}
						color={p.color}
						text={p.fmt(p.values[n - 1])}
					/>
				</Readout>
			{/if}
			<Readout id="{p.id}-verdict">
				<Label
					x={p.sx(5.5)}
					y={468}
					size={13}
					weight={650}
					text="↑ {p.verdict}"
					opacity={reveal >= MAX_N ? 1 : 0}
				/>
			</Readout>
		{/each}
		<Readout
			id="moral"
			order={3}
			label="So"
			value="counting can’t reach far back; a model that does must generalise"
		>
			<Label
				x={480}
				y={530}
				size={14.5}
				weight={650}
				opacity={reveal >= MAX_N ? 1 : 0}
				text="Counting can’t reach far back: a model that does has to generalise, not count."
			/>
			<Label
				x={480}
				y={556}
				size={12}
				muted
				opacity={reveal >= MAX_N ? 1 : 0}
				text="(real words and longest copy: averages of three samples of 600 letters)"
			/>
		</Readout>
	{/if}
</g>
