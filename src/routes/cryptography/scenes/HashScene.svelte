<script lang="ts">
	/**
	 * SHA-256 on text the reader types. The text boxes are HTML inputs in a `foreignObject`;
	 * the explainer's keyboard shortcuts ignore keys typed into an input, so typing never
	 * changes the step. Their values are kept as params (`msg`, `aval1`, `aval2`) so they
	 * survive moving between steps.
	 *
	 * Phases (`step.hints.phase`):
	 * - `digest`: the text, the SHA-256 box, the 64 hex digits and the same 256 bits as a
	 *   16 × 16 grid (rows fill in at the start of the step).
	 * - `avalanche`: two texts (by default one letter apart), their digests, and a grid of the
	 *   bits that differ, with the count against the "half" mark.
	 * - `search`: Eve hashes "try 0", "try 1", … until a digest starts with the same
	 *   `params.digits` hex digits as the text's digest; a running list and counter, and a
	 *   table of the expected cost per digit up to all 64. Loops.
	 *
	 * Everything is computed by the model's SHA-256 (`crypto.ts`). Reduced motion shows the
	 * finished frame.
	 */
	import { untrack } from 'svelte';
	import { clamp, cycle, easeInOut, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		SEARCH_LIMIT,
		bitDistance,
		prefixSearch,
		sha256,
		sha256Hex,
		toBits,
		toHex,
		utf8
	} from '../crypto';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'digest'));
	const DEFAULT = 'Meet me at noon';
	const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
	const msg = $derived(str(params.msg, DEFAULT));
	const aval1 = $derived(str(params.aval1, DEFAULT));
	const aval2 = $derived(str(params.aval2, 'Meet me at moon'));

	const tv = $derived(reduced ? 1e6 : t);

	// ---- digest -----------------------------------------------------------------------------
	const digest = $derived(sha256(msg));
	const hex = $derived(toHex(digest));
	const bits = $derived(toBits(digest));
	const nBytes = $derived(utf8(msg).length);
	const rowOn = (r: number) => clamp((tv - 0.3 - r * 0.08) / 0.15);
	const hexLines = (h: string) =>
		[0, 1, 2, 3].map((i) => h.slice(16 * i, 16 * i + 8) + ' ' + h.slice(16 * i + 8, 16 * i + 16));

	// ---- avalanche ----------------------------------------------------------------------------
	const d1 = $derived(sha256(aval1));
	const d2 = $derived(sha256(aval2));
	const b1 = $derived(toBits(d1));
	const b2 = $derived(toBits(d2));
	const flips = $derived(bitDistance(d1, d2));
	/** Edit distance: the fewest characters inserted, deleted or replaced to turn one into the other. */
	const charDiff = $derived.by(() => {
		const a = [...aval1];
		const b = [...aval2];
		let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
		for (let i = 1; i <= a.length; i++) {
			const row = [i];
			for (let j = 1; j <= b.length; j++)
				row[j] = Math.min(
					prev[j] + 1,
					row[j - 1] + 1,
					prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
				);
			prev = row;
		}
		return prev[b.length];
	});

	// ---- search -------------------------------------------------------------------------------
	const k = $derived(clamp(Math.round(Number(params.digits ?? 3)), 1, 4));
	// The search can take hundreds of milliseconds at 4 digits, so it waits until typing pauses.
	// The first search runs straight away, so the opening frame is complete.
	let searchHex = $state(untrack(() => hex));
	$effect(() => {
		const h = hex;
		if (h === untrack(() => searchHex)) return;
		const id = setTimeout(() => (searchHex = h), 250);
		return () => clearTimeout(id);
	});
	const found = $derived(phase === 'search' ? prefixSearch(searchHex, k) : null);
	const tries = $derived(found?.tries ?? 0);
	const SEARCH = 4.5;
	const period = $derived(SEARCH + 4);
	const su = $derived(reduced ? 1e6 : cycle(t, period) * period);
	const searchU = $derived(clamp((su - 0.5) / SEARCH));
	/** Number of texts tried so far (eases in and out so the hit is readable). */
	const done = $derived(Math.max(1, Math.round(tries * easeInOut(searchU))));
	const hit = $derived(searchU >= 1);
	const recent = $derived(
		Array.from({ length: Math.min(8, done) }, (_, j) => {
			const i = done - 1 - j;
			const h = sha256Hex(`try ${i}`);
			let pre = 0;
			while (pre < k && h[pre] === searchHex[pre]) pre++;
			return { i, h, pre, match: pre === k };
		})
	);
	const fmt = (n: number) => n.toLocaleString('en-US');

	// ---- layout ---------------------------------------------------------------------------------
	const GRID = { x: 616, y: 230, cell: 18 };
	const AGRID = { x: 336, y: 262, cell: 18 };
</script>

{#snippet field(x: number, y: number, w: number, value: string, id: string, label: string)}
	<foreignObject {x} {y} width={w} height="46">
		<input
			class="cr-text"
			type="text"
			{value}
			maxlength="80"
			spellcheck="false"
			autocomplete="off"
			aria-label={label}
			data-field={id}
			oninput={(e) => setParam(id, e.currentTarget.value)}
		/>
	</foreignObject>
{/snippet}

{#snippet bitGrid(
	gx: number,
	gy: number,
	cell: number,
	on: (i: number) => boolean,
	color: string,
	row: (r: number) => number
)}
	{#each Array.from({ length: 16 }, (_, r) => r) as r (r)}
		<g opacity={row(r)}>
			{#each Array.from({ length: 16 }, (_, c) => c) as c (c)}
				{@const i = r * 16 + c}
				<rect
					x={gx + c * cell}
					y={gy + r * cell}
					width={cell - 3}
					height={cell - 3}
					rx="2.5"
					fill={on(i) ? color : 'var(--cr-cell)'}
				/>
			{/each}
		</g>
	{/each}
{/snippet}

<g>
	{#if phase === 'digest'}
		<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
		<Readout id="type-any">
			<Label anchor="start" x={40} y={38} text="Type any text" size={13} weight={700} />
		</Readout>
		{@render field(40, 48, 880, msg, 'msg', 'Text to hash')}
		<line
			x1="480"
			x2="480"
			y1="100"
			y2="124"
			stroke="var(--stage-line)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
		<rect
			x="370"
			y="128"
			width="220"
			height="52"
			rx="10"
			fill="var(--cr-alice)"
			fill-opacity="0.12"
			stroke="var(--cr-alice)"
		/>
		<Readout id="sha">
			<Label x={480} y={152} text="SHA-256" size={17} weight={700} anchor="middle" halo={false} />
			<Label
				x={480}
				y={171}
				text="64 rounds of shifts, XORs and additions"
				size={11}
				anchor="middle"
				muted
				halo={false}
			/>
			{#snippet narrow()}
				<Label x={480} y={165} text="SHA-256" size={30} weight={700} anchor="middle" halo={false} />
			{/snippet}
		</Readout>
		<line
			x1="480"
			x2="480"
			y1="182"
			y2="204"
			stroke="var(--stage-line)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>

		<Readout id="digest-title">
			<Label
				anchor="start"
				x={40}
				y={238}
				text="The digest, in hexadecimal"
				size={13}
				weight={700}
			/>
		</Readout>
		{#each hexLines(hex) as line, i (i)}
			<g opacity={rowOn(i * 4 + 3)}>
				<Label
					anchor="start"
					tabular
					x={40}
					y={278 + i * 34}
					text={line}
					size={24}
					weight={600}
					mono
				/>
			</g>
		{/each}
		<Readout id="grid-title">
			<Label
				anchor="start"
				x={GRID.x}
				y={GRID.y - 10}
				text="… and as 256 bits (1 = coloured)"
				size={13}
				weight={700}
			/>
		</Readout>
		{@render bitGrid(GRID.x, GRID.y, GRID.cell, (i) => bits[i] === 1, 'var(--cr-alice)', rowOn)}

		<Readout
			id="in"
			order={1}
			label="In"
			value="{[...msg].length} character{[...msg].length === 1 ? '' : 's'} = {nBytes * 8} bits"
		>
			<rect
				x="40"
				y="430"
				width="520"
				height="114"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				anchor="start"
				tabular
				x={58}
				y={462}
				text="In: {[...msg].length} character{[...msg].length === 1 ? '' : 's'} = {nBytes *
					8} bits (UTF-8)"
				size={14}
				halo={false}
			/>
		</Readout>
		<Readout
			id="out"
			order={2}
			label="Out"
			value="256 bits"
			note="whatever the length; the same text always gives the same digest"
		>
			<Label
				anchor="start"
				x={58}
				y={490}
				text="Out: 256 bits, whatever the length of the text"
				size={14}
				weight={700}
				halo={false}
			/>
			<Label
				anchor="start"
				x={58}
				y={518}
				text="The same text always gives the same digest."
				size={13}
				muted
				halo={false}
			/>
		</Readout>
	{:else if phase === 'avalanche'}
		<Readout id="text-titles">
			<Label anchor="start" x={40} y={38} text="Text 1" size={13} weight={700} />
			<Label anchor="start" x={500} y={38} text="Text 2" size={13} weight={700} />
		</Readout>
		{@render field(40, 48, 420, aval1, 'aval1', 'First text')}
		{@render field(500, 48, 420, aval2, 'aval2', 'Second text')}
		<Readout
			id="apart"
			order={1}
			label="The texts differ by"
			value="{charDiff} character{charDiff === 1 ? '' : 's'}"
			color="var(--cr-key)"
		>
			<Label
				tabular
				x={480}
				y={120}
				text="{charDiff} character{charDiff === 1 ? '' : 's'} apart"
				size={13}
				weight={700}
				anchor="middle"
				color="var(--cr-key)"
			/>
		</Readout>
		{#each hexLines(toHex(d1)) as line, i (i)}
			<Label anchor="start" tabular x={40} y={146 + i * 24} text={line} size={17} mono />
		{/each}
		{#each hexLines(toHex(d2)) as line, i (i)}
			<Label tabular x={920} y={146 + i * 24} text={line} size={17} mono anchor="end" />
		{/each}
		<Readout id="sha-captions">
			<Label anchor="start" x={40} y={252} text="SHA-256 of text 1" size={11} muted />
			<Label x={920} y={252} text="SHA-256 of text 2" size={11} muted anchor="end" />
		</Readout>

		{@render bitGrid(
			AGRID.x,
			AGRID.y,
			AGRID.cell,
			(i) => b1[i] !== b2[i],
			'var(--cr-flip)',
			() => 1
		)}
		<Readout id="grid-caption">
			<Label
				x={AGRID.x + 8 * AGRID.cell}
				y={AGRID.y + 16 * AGRID.cell + 22}
				text="the 256 bit positions: coloured where the digests differ"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>

		<Readout
			id="flips"
			order={2}
			label="Bits that differ"
			value="{flips} of 256 ({Math.round((flips / 256) * 100)}%)"
			note="two unrelated random strings also differ in about half their bits"
			color="var(--cr-flip)"
		>
			<Label anchor="start" x={680} y={300} text="Bits that differ" size={14} weight={700} />
			<Label
				anchor="start"
				tabular
				x={680}
				y={342}
				text="{flips} of 256"
				size={32}
				weight={700}
				color="var(--cr-flip)"
			/>
			<Label
				anchor="start"
				tabular
				x={680}
				y={366}
				text="({Math.round((flips / 256) * 100)}%)"
				size={14}
				muted
			/>
			{#snippet narrow()}
				<Label
					anchor="start"
					tabular
					x={680}
					y={350}
					text="{flips} of 256"
					size={44}
					weight={700}
					color="var(--cr-flip)"
				/>
			{/snippet}
		</Readout>
		<!-- a bar from 0 to 256 with the half mark -->
		<rect x="680" y="386" width="240" height="14" rx="4" fill="var(--cr-cell)" />
		<rect x="680" y="386" width={(240 * flips) / 256} height="14" rx="4" fill="var(--cr-flip)" />
		<line x1="800" x2="800" y1="380" y2="406" stroke="var(--stage-ink)" stroke-width="2" />
		<Readout id="half">
			<Label x={800} y={424} text="half" size={11} anchor="middle" muted />
			<Label anchor="start" x={680} y={460} text="Two unrelated random strings" size={12} muted />
			<Label
				anchor="start"
				x={680}
				y={478}
				text="also differ in about half their bits."
				size={12}
				muted
			/>
		</Readout>

		<Readout
			id="avalanche"
			order={0}
			label="One letter in"
			value="about half the bits out"
			note="Edit either box: if the texts differ, the count stays near 128."
		>
			<Label anchor="start" x={40} y={300} text="One letter in," size={14} weight={700} />
			<Label anchor="start" x={40} y={322} text="about half the" size={14} weight={700} />
			<Label anchor="start" x={40} y={344} text="bits out" size={14} weight={700} />
			<Label anchor="start" x={40} y={380} text="Edit either box:" size={12} muted />
			<Label anchor="start" x={40} y={398} text="if the texts differ," size={12} muted />
			<Label anchor="start" x={40} y={416} text="the count stays" size={12} muted />
			<Label anchor="start" x={40} y={434} text="near 128." size={12} muted />
		</Readout>
	{:else}
		<Readout id="your-text">
			<Label anchor="start" x={40} y={38} text="Your text" size={13} weight={700} />
		</Readout>
		{@render field(40, 48, 880, msg, 'msg', 'Text whose digest Eve tries to match')}
		<Readout
			id="target"
			order={1}
			label="Its digest starts"
			value={hex.slice(0, k)}
			note="Eve hashes texts until one starts with the same {k} hex digit{k === 1 ? '' : 's'}"
			color="var(--cr-key)"
		>
			<Label anchor="start" x={40} y={130} text="Its digest:" size={13} weight={700} />
			<text x="128" y="131" class="halo" font-size="15" style:font-family="var(--font-mono)"
				><tspan style:fill="var(--cr-key)" style:font-weight="700">{hex.slice(0, k)}</tspan><tspan
					>{hex.slice(k)}</tspan
				></text
			>

			<Label
				anchor="start"
				tabular
				x={40}
				y={176}
				text="Eve hashes texts until one starts with the same {k} hex digit{k === 1 ? '' : 's'}"
				size={14}
				weight={700}
			/>
		</Readout>
		{#each recent as r, j (r.i)}
			{@const y = 212 + j * 32}
			{@const top = j === 0}
			{#if r.match && hit}
				<rect
					x="34"
					y={y - 21}
					width="476"
					height="30"
					rx="6"
					fill="var(--cr-key)"
					fill-opacity="0.15"
					stroke="var(--cr-key)"
				/>
			{/if}
			<g opacity={top ? 1 : Math.max(0.25, 1 - j * 0.11)}>
				<Label anchor="start" tabular x={48} {y} text="“try {r.i}”" size={14} mono halo={false} />
				<Label anchor="start" x={200} {y} text="→" size={14} muted halo={false} />
				<text x="230" {y} font-size="14" style:font-family="var(--font-mono)"
					>{#each r.h.slice(0, 16).split('') as ch, ci (ci)}<tspan
							style:fill={ci < r.pre ? 'var(--cr-key)' : undefined}
							style:font-weight={ci < r.pre ? '700' : undefined}>{ch}</tspan
						>{/each}…</text
				>
				{#if r.match && hit}
					<Label
						anchor="start"
						x={470}
						{y}
						text="match"
						size={13}
						weight={700}
						color="var(--cr-key)"
						halo={false}
					/>
				{/if}
			</g>
		{/each}

		<Readout
			id="tried"
			order={2}
			label="Texts tried"
			value={fmt(done)}
			note={!found
				? `not found within ${fmt(SEARCH_LIMIT)} tries`
				: hit
					? `found one; about ${fmt(16 ** k)} expected, luck varies`
					: 'searching…'}
			color={hit ? 'var(--cr-key)' : 'var(--cr-eve)'}
		>
			<rect
				x="560"
				y="160"
				width="360"
				height="400"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				anchor="start"
				x={580}
				y={194}
				text="Texts tried"
				size={14}
				weight={700}
				halo={false}
			/>
			<Label
				anchor="start"
				tabular
				x={580}
				y={232}
				text={fmt(done)}
				size={32}
				weight={700}
				color={hit ? 'var(--cr-key)' : 'var(--cr-eve)'}
				halo={false}
			/>
			<Label
				anchor="start"
				tabular
				x={580}
				y={256}
				text={!found
					? `not found within ${fmt(SEARCH_LIMIT)} tries`
					: hit
						? `found one; about ${fmt(16 ** k)} expected, luck varies`
						: 'searching…'}
				size={13}
				muted
				halo={false}
			/>
		</Readout>
		<Readout
			id="needed"
			order={3}
			label="Tries needed for {k} digit{k === 1 ? '' : 's'}"
			value={k === 1 ? '16' : `16${['', '', '²', '³', '⁴'][k]} = ${fmt(16 ** k)}`}
			note="all 64 digits: 2²⁵⁶ ≈ 10⁷⁷, longer than the universe will last"
		>
			<Label
				anchor="start"
				x={580}
				y={294}
				text="Digits matched → tries needed (on average)"
				size={12}
				weight={700}
				halo={false}
			/>
			{#each [1, 2, 3, 4] as d (d)}
				{@const y = 322 + (d - 1) * 26}
				{#if d === k}
					<rect
						x="572"
						y={y - 18}
						width="336"
						height="25"
						rx="5"
						fill="var(--cr-key)"
						fill-opacity="0.15"
					/>
				{/if}
				<Label
					anchor="start"
					tabular
					x={590}
					{y}
					text="{d} digit{d === 1 ? '' : 's'}"
					size={14}
					halo={false}
				/>
				<Label
					tabular
					x={900}
					{y}
					text={d === 1 ? '16' : `16${['', '', '²', '³', '⁴'][d]} = ${fmt(16 ** d)}`}
					size={14}
					anchor="end"
					halo={false}
				/>
			{/each}
			<Label anchor="start" x={590} y={430} text="⋮" size={14} muted halo={false} />
			<Label
				anchor="start"
				x={590}
				y={460}
				text="all 64 digits"
				size={14}
				weight={700}
				halo={false}
			/>
			<Label
				x={900}
				y={460}
				text="2²⁵⁶ ≈ 10⁷⁷"
				size={14}
				weight={700}
				anchor="end"
				color="var(--cr-bad)"
				halo={false}
			/>
			<Label
				anchor="start"
				x={580}
				y={500}
				text="Each digit matches by luck 1 time in 16."
				size={12}
				muted
				halo={false}
			/>
			<Label
				anchor="start"
				x={580}
				y={520}
				text="Matching all 64 would outlast the universe."
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{/if}
</g>

<style>
	.cr-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 14px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 20px var(--font-mono);
		user-select: text;
		-webkit-user-select: text;
	}
	/* on phones the stage is drawn at ~0.4 scale: larger type keeps the field legible */
	@media (max-width: 640px) {
		.cr-text {
			padding: 0 8px;
			font-size: 34px;
		}
	}
	.cr-text:focus {
		outline: none;
		border-color: var(--cr-alice);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--cr-alice) 30%, transparent);
	}
</style>
