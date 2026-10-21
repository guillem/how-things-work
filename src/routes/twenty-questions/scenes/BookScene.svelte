<script lang="ts">
	/**
	 * The thousand-page dictionary (the Webster's Second word list, `data.ts`).
	 *
	 * - `halve`: the reader's word (`params.word`) is looked up by opening the middle of the pages
	 *   still left (`lookUp` in the model), one open after another. The book is the strip of its
	 *   1,000 pages; the part already forgotten goes dark, and the open page shows its first and
	 *   last word and which way the word must be.
	 * - `race`: the same, faster, against a reader who turns the pages one by one from page 1
	 *   (`flips`), on a second strip.
	 * - `shuffled`: with "Shuffle the pages" (`params.shuffle`) the pages lie in a shuffled pile
	 *   (`shuffled(1)`), the strip's colours are mixed up, and the same halving throws away the
	 *   word's page: a flag marks where it really is.
	 *
	 * Everything is a function of the time since the word or the pile last changed.
	 */
	import { untrack } from 'svelte';
	import { clamp, easeInOut, lerp, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { flips, inOrder, lookUp, PAGES, pageOf, shuffled } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'halve'));
	const word = $derived(String(params.word ?? 'kitten'));
	const mixed = $derived(phase === 'shuffled' && params.shuffle === true);
	const IN_ORDER = inOrder();
	const PILE = shuffled(1);
	const order = $derived(mixed ? PILE : IN_ORDER);
	const search = $derived(lookUp(word, order));
	const target = $derived(pageOf(word));
	const targetAt = $derived(order.indexOf(target));
	const pages = $derived(flips(word));

	// Restart the search when the word or the pile changes.
	const key = $derived(`${phase}|${word}|${mixed}`);
	let since = $state(0);
	let lastKey = untrack(() => key);
	$effect(() => {
		const k = key;
		untrack(() => {
			if (k !== lastKey) {
				lastKey = k;
				since = t;
			}
		});
	});
	const local = $derived(reduced ? 999 : Math.max(0, t - since));

	const STEP = $derived(phase === 'race' ? 0.6 : 1.3);
	const T0 = 0.5;
	const n = $derived(search.opens.length);
	/** The open being shown (0-based), and how far into it we are. */
	const k = $derived(clamp(Math.floor((local - T0) / STEP), -1, n - 1));
	const u = $derived(k < 0 ? 0 : clamp((local - T0) / STEP - k));
	const finished = $derived(local - T0 >= n * STEP - 0.2);
	const open = $derived(k >= 0 ? search.opens[k] : null);

	type Range = { lo: number; hi: number };
	const before = (i: number): Range => search.opens[i];
	function after(i: number): Range {
		const next = search.opens[i + 1];
		if (next) return next;
		const o = search.opens[i];
		return search.found ? { lo: o.at, hi: o.at } : { lo: o.at + 0.5, hi: o.at - 0.5 };
	}
	/** The part of the book still searched, sliding from one open's range to the next. */
	const kept = $derived.by(() => {
		if (k < 0) return { lo: 0, hi: 999 };
		const a = before(k);
		const b = after(k);
		const s = easeInOut(clamp((u - 0.45) / 0.4));
		return { lo: lerp(a.lo, b.lo, s), hi: lerp(a.hi, b.hi, s) };
	});
	/** When the word's page was thrown away (the open after which it was outside what was kept). */
	const lostAt = $derived.by(() => {
		if (search.found) return -1;
		for (let i = 0; i < n; i++) {
			const r = after(i);
			if (targetAt < r.lo || targetAt > r.hi) return i;
		}
		return n - 1;
	});

	// ---- the strip ---------------------------------------------------------------------------
	const SX = 40;
	const SW = 880;
	const SY = 300;
	const SH = 46;
	const px = (pos: number) => SX + ((pos + 0.5) * SW) / 1000;
	const BANDS = 100;
	const hue = (page: number) => 200 + (150 * page) / 999;
	const bands = $derived(
		Array.from({ length: BANDS }, (_, b) => `hsl(${hue(order[b * 10]).toFixed(0)} 70% 56%)`)
	);
	/** The first page of each letter, for the labels under a book in order. */
	const LETTERS = (() => {
		const out: { ch: string; pos: number }[] = [];
		let last = '';
		for (let p = 0; p < PAGES.length; p++) {
			const ch = PAGES[p][0][0];
			if (ch !== last && (!out.length || px(p) - px(out[out.length - 1].pos) > 16))
				out.push({ ch, pos: p });
			last = ch;
		}
		return out;
	})();

	// ---- the page-turner ---------------------------------------------------------------------
	const RATE = 60;
	const turned = $derived(Math.min(pages, Math.floor(local * RATE)));
	const RY = 470;

	const verdictText = (v: 'before' | 'after' | 'here') =>
		v === 'here'
			? `“${word}” is on this page!`
			: v === 'before'
				? `“${word}” comes before these words:`
				: `“${word}” comes after these words:`;
	const verdictNote = (v: 'before' | 'after' | 'here') =>
		v === 'here'
			? 'Found it.'
			: v === 'before'
				? 'forget this page and every page after it'
				: 'forget this page and every page before it';
	const opensShown = $derived(k + 1);
	const fmt = (x: number) => x.toLocaleString('en-US');
</script>

<g class="book">
	<Readout
		id="bk-title"
		order={1}
		label="Looking up"
		value="“{word}”: {opensShown} {opensShown === 1 ? 'open' : 'opens'}"
	>
		<Label
			x={40}
			y={44}
			text="Looking up “{word}”"
			size={24}
			weight={700}
			anchor="start"
			halo={false}
		/>
		<Label
			x={920}
			y={44}
			text="Opens: {opensShown}"
			size={22}
			weight={700}
			anchor="end"
			color="var(--tq-hot)"
			tabular
			halo={false}
		/>
	</Readout>

	<!-- the open book: the page's first and last word, and what that says -->
	{#if open}
		{@const [first, last] = PAGES[open.page]}
		<g opacity={clamp(u / 0.15)}>
			<path
				d="M 200 84 Q 340 70 478 92 L 478 252 Q 340 232 200 246 Z"
				fill="var(--tq-paper)"
				stroke="var(--border)"
				stroke-width="1.5"
			/>
			<path
				d="M 482 92 Q 620 70 760 84 L 760 246 Q 620 232 482 252 Z"
				fill="var(--tq-paper)"
				stroke="var(--border)"
				stroke-width="1.5"
			/>
			<line x1="480" y1="92" x2="480" y2="252" stroke="var(--border)" stroke-width="2" />
			<Readout
				id="bk-page"
				order={2}
				label="Page {open.page + 1}"
				value="{first} … {last}"
				note={mixed ? `number ${open.at + 1} from the top of the pile` : undefined}
			>
				<Label
					x={340}
					y={118}
					text={mixed
						? `page ${open.page + 1} (number ${open.at + 1} in the pile)`
						: `page ${open.page + 1}`}
					size={14}
					muted
					halo={false}
				/>
				<Label x={340} y={160} text={first} size={22} weight={700} halo={false} mono />
				<Label x={340} y={186} text="…" size={18} muted halo={false} />
				<Label x={340} y={218} text={last} size={22} weight={700} halo={false} mono />
			</Readout>
			<Readout
				id="bk-verdict"
				order={3}
				label="So"
				value="{verdictText(open.verdict)} {open.verdict === 'here'
					? ''
					: verdictNote(open.verdict)}"
			>
				<Label
					x={620}
					y={150}
					text={verdictText(open.verdict)}
					size={15}
					weight={700}
					color={open.verdict === 'here' ? 'var(--tq-good)' : 'var(--stage-ink)'}
					halo={false}
				/>
				{#if open.verdict !== 'here'}
					<Label
						x={620}
						y={176}
						text={verdictNote(open.verdict).split(' and ')[0]}
						size={14}
						muted
						halo={false}
					/>
					<Label
						x={620}
						y={196}
						text="and {verdictNote(open.verdict).split(' and ')[1]}"
						size={14}
						muted
						halo={false}
					/>
					<path
						d={open.verdict === 'after'
							? 'M 590 222 h 60 l -10 -7 m 10 7 l -10 7'
							: 'M 650 222 h -60 l 10 -7 m -10 7 l 10 7'}
						fill="none"
						stroke="var(--tq-hot)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{/if}
			</Readout>
		</g>
	{:else}
		<Readout id="bk-closed">
			<rect
				x="300"
				y="100"
				width="360"
				height="140"
				rx="12"
				fill="var(--tq-paper)"
				stroke="var(--border)"
				stroke-width="1.5"
			/>
			<Label
				x={480}
				y={164}
				text={mixed ? 'A shuffled pile of 1,000 pages' : 'A dictionary of 1,000 pages'}
				size={20}
				weight={700}
				halo={false}
			/>
			<Label x={480} y={192} text="Open it in the middle…" size={15} muted halo={false} />
		</Readout>
	{/if}

	<!-- the 1,000 pages -->
	<Readout id="bk-strip-title">
		<Label
			x={SX}
			y={SY - 14}
			text={mixed
				? 'the pile, top to bottom (the colour shows each page’s place in the alphabet)'
				: 'the 1,000 pages, first to last'}
			size={13}
			muted
			anchor="start"
			halo={false}
		/>
	</Readout>
	{#each bands as fill, b (b)}
		<rect x={SX + (b * SW) / BANDS} y={SY} width={SW / BANDS + 0.4} height={SH} {fill} />
	{/each}
	<!-- what is forgotten goes dark -->
	{#if kept.hi >= kept.lo}
		{@const x0 = SX + (kept.lo * SW) / 1000}
		{@const x1 = SX + ((kept.hi + 1) * SW) / 1000}
		<rect
			x={SX}
			y={SY - 1}
			width={Math.max(0, x0 - SX)}
			height={SH + 2}
			fill="var(--stage-bg)"
			opacity="0.82"
		/>
		<rect
			x={x1}
			y={SY - 1}
			width={Math.max(0, SX + SW - x1)}
			height={SH + 2}
			fill="var(--stage-bg)"
			opacity="0.82"
		/>
		<rect
			x={x0}
			y={SY - 3}
			width={Math.max(2, x1 - x0)}
			height={SH + 6}
			rx="3"
			fill="none"
			stroke="var(--tq-hot)"
			stroke-width="2.5"
		/>
	{:else}
		<rect x={SX} y={SY - 1} width={SW} height={SH + 2} fill="var(--stage-bg)" opacity="0.82" />
	{/if}
	<!-- where each open was -->
	{#each search.opens as o, i (i)}
		{#if i <= k}
			<g opacity={i === k ? 1 : 0.55}>
				<line
					x1={px(o.at)}
					y1={SY - 2}
					x2={px(o.at)}
					y2={SY + SH + 2}
					stroke="var(--stage-ink)"
					stroke-width={i === k ? 2.5 : 1.5}
				/>
			</g>
		{/if}
	{/each}
	{#if !mixed}
		<Readout id="bk-letters">
			{#each LETTERS as l (l.ch)}
				<text
					x={px(l.pos)}
					y={SY + SH + 20}
					text-anchor="middle"
					font-size="13"
					font-weight="600"
					fill="var(--stage-ink-muted)">{l.ch}</text
				>
			{/each}
		</Readout>
	{/if}
	{#if phase === 'shuffled'}
		<!-- where the word's page really is -->
		{@const lost = lostAt >= 0 && k >= lostAt && u > 0.6}
		<path
			d="M {px(targetAt)} {SY + SH + 6} l -8 14 h 16 Z"
			fill={lost || (finished && !search.found) ? 'var(--tq-bad)' : 'var(--tq-good)'}
		/>
		<Label
			x={px(targetAt)}
			y={SY + SH + 38}
			text="“{word}” is here"
			size={13}
			weight={700}
			anchor={targetAt > 800 ? 'end' : targetAt < 200 ? 'start' : 'middle'}
			color={lost || (finished && !search.found) ? 'var(--tq-bad)' : 'var(--tq-good)'}
			halo={false}
		/>
	{/if}

	<!-- the result -->
	{#if finished}
		<Readout
			id="bk-result"
			order={4}
			label="Result"
			value={search.found
				? `found on page ${target + 1} after ${n} opens`
				: `not found after ${n} opens`}
			color={search.found ? 'var(--tq-good)' : 'var(--tq-bad)'}
		>
			<Label
				x={480}
				y={phase === 'race' ? 420 : 430}
				text={search.found
					? `Found on page ${fmt(target + 1)} after ${n} opens.`
					: `Not found! Its page was thrown away at open ${lostAt + 1}.`}
				size={20}
				weight={700}
				color={search.found ? 'var(--tq-good)' : 'var(--tq-bad)'}
				halo={false}
			/>
			{#if !search.found}
				<Label
					x={480}
					y={458}
					text="In a shuffled pile, the middle page says nothing about where the word is."
					size={15}
					muted
					halo={false}
				/>
			{/if}
		</Readout>
	{/if}

	{#if phase === 'race'}
		<Readout
			id="bk-turner"
			order={5}
			label="Page by page"
			value="{fmt(turned)} {turned === 1 ? 'page' : 'pages'} looked at"
		>
			<Label
				x={SX}
				y={RY - 14}
				text="Someone turning the pages one by one, from page 1"
				size={13}
				muted
				anchor="start"
				halo={false}
			/>
			<rect x={SX} y={RY} width={SW} height={30} rx="4" fill="var(--tq-gone)" opacity="0.6" />
			<rect x={SX} y={RY} width={(turned * SW) / 1000} height={30} rx="4" fill="var(--tq-turner)" />
			<Label
				x={SX}
				y={RY + 64}
				text="Pages looked at: {fmt(turned)}"
				size={22}
				weight={700}
				anchor="start"
				tabular
				halo={false}
			/>
			{#if turned >= pages}
				<Label
					x={920}
					y={RY + 64}
					text="Found, after {fmt(pages)} pages"
					size={18}
					weight={700}
					anchor="end"
					color="var(--tq-turner)"
					halo={false}
				/>
			{/if}
		</Readout>
	{/if}
</g>
