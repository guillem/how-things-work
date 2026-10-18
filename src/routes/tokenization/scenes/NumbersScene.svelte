<script lang="ts">
	/**
	 * Every number from ␣0 to ␣999 (with the space in front, as in running text) as one square,
	 * coloured by how many GPT-2 tokens it takes; the number picked with the slider is outlined
	 * and cut into its tokens below, next to a few longer examples.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import type { Gpt2 } from '../gpt2';
	import { chipWidth, FILLS, fmt, show, tokenizer } from './shared';

	let { t, params }: StageProps = $props();

	let g = $state<Gpt2 | null>(null);
	let failed = $state(false);
	$effect(() => {
		tokenizer().then(
			(x) => (g = x),
			() => (failed = true)
		);
	});

	const COLS = 50;
	const ROWS = 20;
	const C = 16;
	const GX = 112;
	const GY = 78;
	const counts = $derived(g ? g.numberTokens(COLS * ROWS) : []);
	const ones = $derived(counts.filter((k) => k === 1).length);
	/** Rows drawn so far: the grid fills in row by row over the first two seconds. */
	const drawn = $derived(Math.ceil(ROWS * smoothstep(0.1, 2, t)));
	const cellPath = (want: (k: number) => boolean) => {
		let d = '';
		for (let n = 0; n < Math.min(counts.length, drawn * COLS); n++)
			if (want(counts[n])) {
				const x = GX + (n % COLS) * C;
				const y = GY + Math.floor(n / COLS) * C;
				d += `M${x + 1} ${y + 1}h${C - 2}v${C - 2}h${-(C - 2)}z`;
			}
		return d;
	};
	const onePath = $derived(cellPath((k) => k === 1));
	const twoPath = $derived(cellPath((k) => k > 1));

	const num = $derived(Math.max(0, Math.min(999, Math.round(Number(params.num ?? 778)) || 0)));
	const sel = $derived({ x: GX + (num % COLS) * C, y: GY + Math.floor(num / COLS) * C });
	const split = (s: string) => (g ? g.bpe.encode(s).map((id) => show(g!.bpe.text(id))) : []);
	const picked = $derived(split(' ' + num));

	const EXAMPLES = [' 2025', ' 2026', ' 1234567', ' 3.14159', ' 1,000,000'];
	const examples = $derived(
		EXAMPLES.map((s) => {
			const toks = split(s);
			let x = 640;
			const chips = toks.map((text, j) => {
				const w = chipWidth(text, 13, 16);
				const c = { j, text, x, w };
				x += w + 2;
				return c;
			});
			return { s, chips };
		})
	);
	const BIG = 22;
	const pickedChips = $derived.by(() => {
		let x = 24 + [...`␣${num} →`].length * 12.5 + 10;
		return picked.map((text, j) => {
			const w = chipWidth(text, BIG, 30);
			const c = { j, text, x, w };
			x += w + 6;
			return c;
		});
	});
</script>

<g>
	{#if !g}
		<Label
			x={480}
			y={300}
			anchor="middle"
			muted
			text={failed ? 'GPT-2’s tokenizer could not be loaded.' : 'Loading GPT-2’s tokenizer…'}
		/>
	{:else}
		<Readout id="title">
			<Label
				anchor="start"
				x={24}
				y={34}
				size={15}
				weight={650}
				text="␣0 to ␣999 in GPT-2’s tokens, one square per number"
			/>
		</Readout>
		{#each [0, 10, 20, 30, 40] as c (c)}
			<Readout id="col-{c}">
				<Label
					x={GX + c * C + C / 2}
					y={GY - 8}
					anchor="middle"
					size={11}
					muted
					tabular
					text="+{c}"
				/>
			</Readout>
		{/each}
		{#each Array.from({ length: ROWS / 2 }, (_, i) => i * 2) as r (r)}
			<Readout id="row-{r}">
				<Label
					x={GX - 8}
					y={GY + r * C + 12}
					anchor="end"
					size={11}
					muted
					tabular
					text={String(r * COLS)}
				/>
			</Readout>
		{/each}
		<path d={onePath} fill="var(--tk-one)" />
		<path d={twoPath} fill="var(--tk-two)" />
		<rect
			x={sel.x - 1}
			y={sel.y - 1}
			width={C + 2}
			height={C + 2}
			rx="2"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>

		<!-- the legend -->
		<Readout id="one" order={2} label="One token" value="{ones} of 1,000" color="var(--tk-one)">
			<rect x={GX} y={GY + ROWS * C + 14} width="14" height="14" rx="2" fill="var(--tk-one)" />
			<Label
				anchor="start"
				x={GX + 20}
				y={GY + ROWS * C + 26}
				size={12}
				tabular
				text="one token: {ones} of 1,000 (every one up to ␣361)"
			/>
		</Readout>
		<Readout
			id="two"
			order={3}
			label="Two tokens"
			value="{fmt(counts.length - ones)} of 1,000"
			color="var(--tk-two)"
		>
			<rect
				x={GX + 330}
				y={GY + ROWS * C + 14}
				width="14"
				height="14"
				rx="2"
				fill="var(--tk-two)"
			/>
			<Label
				anchor="start"
				x={GX + 350}
				y={GY + ROWS * C + 26}
				size={12}
				tabular
				text="two tokens: {counts.length - ones} of 1,000"
			/>
		</Readout>

		<!-- the number picked -->
		<Readout
			id="picked"
			order={1}
			label="␣{num}"
			value="{picked.join(' + ')} · {picked.length} token{picked.length === 1 ? '' : 's'}"
		>
			<Label
				anchor="start"
				x={24}
				y={GY + ROWS * C + 92}
				size={20}
				weight={650}
				tabular
				text="␣{num} →"
			/>
			{#each pickedChips as c (c.j)}
				<rect
					x={c.x}
					y={GY + ROWS * C + 68}
					width={c.w}
					height="36"
					rx="6"
					fill={FILLS[c.j % 5]}
					stroke="var(--border)"
				/>
				<text
					x={c.x + c.w / 2}
					y={GY + ROWS * C + 93}
					text-anchor="middle"
					font-size={BIG}
					style:font-family="var(--font-mono)"
					style:fill="var(--stage-ink)">{c.text}</text
				>
			{/each}
			<Label
				anchor="start"
				x={24}
				y={GY + ROWS * C + 128}
				size={12}
				muted
				text="{picked.length} token{picked.length === 1
					? ''
					: 's'} · move the Number slider to pick another"
			/>
		</Readout>

		<!-- longer examples -->
		<Readout id="examples-title">
			<Label
				anchor="start"
				x={520}
				y={GY + ROWS * C + 62}
				size={12}
				weight={650}
				text="Longer numbers"
			/>
		</Readout>
		{#each examples as e, i (e.s)}
			{@const y = GY + ROWS * C + 72 + i * 22}
			<Readout id="ex-{i}" label={show(e.s)} value={e.chips.map((c) => c.text).join(' + ')}>
				<Label x={628} y={y + 14} anchor="end" size={12} mono text={show(e.s)} />
				{#each e.chips as c (c.j)}
					<rect
						x={c.x}
						{y}
						width={c.w}
						height="19"
						rx="4"
						fill={FILLS[c.j % 5]}
						stroke="var(--border)"
					/>
					<text
						x={c.x + c.w / 2}
						y={y + 14}
						text-anchor="middle"
						font-size="13"
						style:font-family="var(--font-mono)"
						style:fill="var(--stage-ink)">{c.text}</text
					>
				{/each}
			</Readout>
		{/each}
	{/if}
</g>
