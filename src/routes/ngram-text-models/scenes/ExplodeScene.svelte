<script lang="ts">
	/**
	 * Possible windows against the windows the training text actually holds, for n = 1 … 10, on
	 * a scale where each grid line is a thousand times the one below. Possible: 65 characters,
	 * so 65 × 65 × … (n times). Seen: distinct windows of the 1,003,854 training letters that have
	 * a letter after them. The bars rise one window size at a time, then hold.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { MAX_N } from '../ngram';
	import { fmt, pct, shakespeare, windowOf, windowsFor, type Shakespeare } from './shared';

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
	const A = $derived(data?.alphabet.size ?? 65);
	const letters = $derived(data?.train.length ?? 0);
	const seen = $derived(data ? windowsFor(data) : []);

	const sx = scale([0.5, MAX_N + 0.5], [130, 900]);
	const sy = scale([0, 19], [520, 60]);
	const NAMES: Record<number, string> = {
		0: '1',
		3: '1,000',
		6: '1 million',
		9: '1 billion',
		12: '10¹²',
		15: '10¹⁵',
		18: '10¹⁸'
	};
	const BW = 28;

	// bars rise one after the other, 0.5 s apart, then hold
	const grow = (i: number) => (reduced ? 1 : smoothstep(0.3 + i * 0.5, 0.8 + i * 0.5, t));

	const bars = $derived(
		Array.from({ length: MAX_N }, (_, i) => {
			const k = i + 1;
			const possible = k * Math.log10(A);
			const s = seen[i] ? Math.log10(seen[i].distinct) : 0;
			return { k, possible, seen: s, g: grow(i) };
		})
	);

	/** 65^n in words: exact up to a trillion, then as "about 1.3 × 10¹⁸". */
	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	function big(k: number) {
		const v = A ** k;
		if (v < 1e12) return fmt(v);
		const e = Math.floor(Math.log10(v));
		const sup = [...String(e)].map((d) => SUP[Number(d)]).join('');
		return `about ${(v / 10 ** e).toFixed(1)} × 10${sup}`;
	}
	const cur = $derived(seen[n - 1]);
	const line1 = $derived(
		`window of ${n}: ${big(n)} possible windows (${A} × … × ${A}, ${n} times)`
	);
	const line2 = $derived(
		cur
			? `${fmt(cur.distinct)} different windows in the training text; ${pct(cur.forced / cur.distinct)} of them always followed by the same letter`
			: ''
	);
</script>

<g>
	{#if !data}
		<Label
			x={480}
			y={300}
			size={14}
			muted
			text={failed ? 'Tiny Shakespeare could not be loaded.' : 'Loading Tiny Shakespeare (1.1 MB)…'}
		/>
	{:else}
		<Axes
			{sx}
			{sy}
			xTicks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
			yTicks={[0, 3, 6, 9, 12, 15, 18]}
			yFormat={(v: number) => NAMES[v] ?? ''}
			xLabel="window (letters)"
		/>
		<!-- the length of the training text -->
		<line
			x1={sx(0.5)}
			x2={sx(MAX_N + 0.5)}
			y1={sy(Math.log10(letters))}
			y2={sy(Math.log10(letters))}
			stroke="var(--ng-copy)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<Readout id="letters" order={4} label="Letters in the training text" value={fmt(letters)}>
			<Label
				anchor="start"
				x={sx(0.5) + 8}
				y={sy(Math.log10(letters)) - 10}
				size={11.5}
				color="var(--ng-copy)"
				weight={600}
				text="{fmt(letters)} letters to learn from"
			/>
		</Readout>
		{#each bars as b (b.k)}
			{@const on = b.k === n}
			{@const x = sx(b.k)}
			<rect
				x={x - BW - 1}
				y={sy(b.possible * b.g)}
				width={BW}
				height={sy(0) - sy(b.possible * b.g)}
				rx="3"
				fill="var(--ng-unseen-bg)"
				stroke="var(--ng-unseen)"
				stroke-width={on ? 2 : 1}
				opacity={on ? 1 : 0.7}
			/>
			<rect
				x={x + 1}
				y={sy(b.seen * b.g)}
				width={BW}
				height={sy(0) - sy(b.seen * b.g)}
				rx="3"
				fill="var(--ng-real)"
				opacity={on ? 1 : 0.6}
			/>
		{/each}
		<!-- key -->
		<Readout id="key-possible" order={1} label="Possible windows" color="var(--ng-unseen)">
			<rect
				x="150"
				y="70"
				width="14"
				height="14"
				rx="3"
				fill="var(--ng-unseen-bg)"
				stroke="var(--ng-unseen)"
			/>
			<Label anchor="start" x={172} y={82} size={12} text="possible windows (65 × 65 × …)" />
		</Readout>
		<Readout id="key-seen" order={2} label="Windows in the training text" color="var(--ng-real)">
			<rect x="150" y="94" width="14" height="14" rx="3" fill="var(--ng-real)" />
			<Label
				anchor="start"
				x={172}
				y={106}
				size={12}
				text="different windows in the training text"
			/>
		</Readout>
		<Readout id="now" order={3} label="This window" value="{line1}; {line2}">
			<Label anchor="start" tabular x={130} y={566} size={13.5} weight={650} text={line1} />
			<Label anchor="start" tabular x={130} y={588} size={12} muted text={line2} />
		</Readout>
	{/if}
</g>
