<script lang="ts">
	/**
	 * The guessing machine: a book page with a gap, the reader's four choice cards, the machine's
	 * word cards (each with its count), a spinner whose slices are the counts, a story written one
	 * spin at a time, a shelf of books, and a last picture of the toy beside a real chatbot. All
	 * the counts come from the model reading books.json.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { rng } from '#lib/draw/math.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LIBRARY, STOPS, STORY } from '../data';
	import {
		display,
		guess,
		hits,
		learn,
		prose,
		spin,
		STOP,
		tokens,
		write,
		type Card
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'guess'));

	// ---- the machines: one per number of books read (made when first needed) -------------------
	const machines = new Map<number, ReturnType<typeof learn>>();
	function machine(n: number) {
		let m = machines.get(n);
		if (!m) machines.set(n, (m = learn(LIBRARY.slice(0, n))));
		return m;
	}
	const all = machine(LIBRARY.length);

	// ---- time since the last press of this step's button ---------------------------------------
	let t0 = $state(0);
	const presses = $derived(
		Number(
			phase === 'guess'
				? (params.another ?? 0)
				: phase === 'spinner'
					? (params.spin ?? 0)
					: phase === 'write'
						? (params.next ?? 0)
						: phase === 'more'
							? (params.more ?? 0)
							: phase === 'likely'
								? (params.again ?? 0)
								: 0
		)
	);
	$effect(() => {
		void presses;
		void step.id;
		t0 = untrack(() => t);
	});
	const since = $derived(reduced ? 10 : Math.max(0, t - t0));

	// ---- the guessing game --------------------------------------------------------------------
	const stop = $derived(STOPS[presses % STOPS.length]);
	let picked = $state<string | null>(null);
	$effect(() => {
		void stop;
		untrack(() => (picked = null));
	});
	const lastWord = $derived(tokens(stop.before).at(-1) ?? STOP);
	const gameCards = $derived(guess(all, [lastWord]).cards);

	// ---- cards for a chosen word --------------------------------------------------------------
	const chosen = $derived(String(params.word ?? 'little'));
	const chosenGuess = $derived(guess(all, [chosen]));

	/** Up to `k` cards, with the rest gathered into one "other words" card. */
	function top(cards: Card[], k: number): (Card & { other?: number })[] {
		if (cards.length <= k) return cards;
		const rest = cards.slice(k - 1);
		return [
			...cards.slice(0, k - 1),
			{ word: '', count: rest.reduce((s, c) => s + c.count, 0), other: rest.length }
		];
	}

	// ---- the spinner (for "little") -----------------------------------------------------------
	const SPIN_WORD = 'old';
	const spinCards = $derived(top(guess(all, [SPIN_WORD]).cards, 8));
	const spinTotal = $derived(spinCards.reduce((s, c) => s + c.count, 0));
	/** Where each spin so far stopped (0–1 round the wheel); spin k uses seed k. */
	const spins = $derived(Array.from({ length: presses }, (_, k) => rng(1000 + k)()));
	const landed = $derived(spins.map((u) => spin(spinCards, u)));
	const tally = $derived(spinCards.map((_, i) => landed.filter((l) => l === i).length));
	// The wheel turns three times and stops with the chosen slice under the pointer at the top.
	const wheelAngle = $derived.by(() => {
		if (!presses) return 0;
		const u = spins[presses - 1];
		const k = Math.min(1, since / 1.6);
		const ease = 1 - (1 - k) ** 3;
		return (3 + u) * 360 * ease;
	});
	const spinning = $derived(presses > 0 && since < 1.6);

	// ---- writing ------------------------------------------------------------------------------
	const MAX_WORDS = 24;
	const written = $derived.by(() => {
		const n = presses % (MAX_WORDS + 1);
		return write(all, [STOP], n, rng(7), 1).slice(1);
	});
	const writeNext = $derived(top(guess(all, written.length ? written : [STOP]).cards, 6));

	const twoBack = $derived(params.two === true);
	const twoStory = $derived(write(all, [STOP], 32, rng(21), twoBack ? 2 : 1).slice(1));

	// ---- more books ---------------------------------------------------------------------------
	const nBooks = $derived(1 + (presses % LIBRARY.length));
	const shelf = $derived(machine(nBooks));
	const theCards = $derived(guess(shelf, ['the']));
	const score = $derived(hits(shelf, STORY.text));
	const sample = $derived(write(shelf, [STOP], 22, rng(4), 2).slice(1));

	// ---- likely, not true ---------------------------------------------------------------------
	const libraryText = ` ${LIBRARY.flatMap((b) => [STOP, ...tokens(b.text)]).join(' ')} `;
	/** A sentence of at least six words (shorter ones are skipped), spun looking back two words. */
	const sentence = $derived.by(() => {
		const r = rng(300 + presses);
		for (;;) {
			const words = [STOP];
			for (let k = 0; k < 30; k++) {
				const next = write(all, words.slice(-2), 1, r, 2).at(-1) ?? STOP;
				words.push(next);
				if (next === STOP) break;
			}
			if (words.length >= 8) return words.slice(1);
		}
	});
	const copied = $derived(libraryText.includes(` ${STOP} ${sentence.join(' ')} `));

	// ---- drawing helpers ----------------------------------------------------------------------
	function wrap(text: string, max: number): string[] {
		const lines: string[] = [];
		let line = '';
		for (const w of text.split(' ')) {
			if (line && (line + ' ' + w).length > max) {
				lines.push(line);
				line = w;
			} else line = line ? line + ' ' + w : w;
		}
		if (line) lines.push(line);
		return lines;
	}
	const fmt = (n: number) => n.toLocaleString('en-GB');
	const show = (w: string) => (w === STOP ? '(full stop)' : display(w, all.names));
	const story = (ws: string[]) => prose(ws, all.names);
	const CX = 480;

	/** Cards laid out in a row, centred, each `w` wide. */
	function row(n: number, w: number, gap = 14) {
		const width = n * w + (n - 1) * gap;
		return Array.from({ length: n }, (_, i) => CX - width / 2 + i * (w + gap));
	}

	function onKey(e: KeyboardEvent, f: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			f();
		}
	}
	// The written-so-far ticker reveals the newest word over half a second.
	const fresh = $derived(Math.min(1, since / 0.5));
</script>

{#snippet cardRow(
	cards: (Card & { other?: number })[],
	y: number,
	w: number,
	highlight: string | null,
	maxCount: number
)}
	{@const xs = row(cards.length, w)}
	{#each cards as c, i (c.word + i)}
		{@const hot = highlight !== null && c.word === highlight}
		<g transform="translate({xs[i]}, {y})">
			<rect
				width={w}
				height={92}
				rx={10}
				fill="var(--nw-card)"
				stroke={hot ? 'var(--nw-hot)' : 'var(--nw-card-edge)'}
				stroke-width={hot ? 3.5 : 1.5}
			/>
			<Label
				x={w / 2}
				y={34}
				text={c.other ? `${fmt(c.other)} more` : show(c.word)}
				size={c.other ? 15 : c.word === STOP ? 14 : 19}
				weight={700}
				muted={!!c.other}
				halo={false}
			/>
			{#if c.other}
				<!-- the rest, gathered: no bar, since it is many small cards -->
				<Label x={w / 2} y={62} text="words" size={14} muted halo={false} />
				<Label
					x={w / 2}
					y={82}
					text="{fmt(c.count)}× in all"
					size={13}
					tabular
					halo={false}
					muted
				/>
			{:else}
				<rect
					x={10}
					y={52}
					width={Math.max(3, (w - 20) * Math.min(1, c.count / maxCount))}
					height={12}
					rx={4}
					fill={hot ? 'var(--nw-hot)' : 'var(--nw-bar)'}
				/>
				<Label x={w / 2} y={82} text="{fmt(c.count)}×" size={14} tabular halo={false} muted />
			{/if}
		</g>
	{/each}
{/snippet}

{#snippet page(lines: string[], y: number, title: string)}
	<rect
		x={90}
		{y}
		width={780}
		height={44 + lines.length * 30}
		rx={12}
		fill="var(--nw-paper)"
		stroke="var(--nw-card-edge)"
	/>
	<Label x={114} y={y + 26} text={title} size={13} anchor="start" muted italic halo={false} />
	{#each lines as l, i (i)}
		<Label x={114} y={y + 56 + i * 30} text={l} size={20} anchor="start" halo={false} />
	{/each}
{/snippet}

<g class="nw">
	{#if phase === 'guess'}
		{@const lines = wrap(stop.before + ' ____', 58)}
		{@render page(lines, 30, 'The Tale of Jemima Puddle-Duck')}
		{@const cy = 120 + lines.length * 30}
		<Label x={CX} y={cy} text="Your guess:" size={15} weight={600} />
		{@const xs = row(4, 150, 18)}
		{#each stop.choices as c, i (c)}
			{@const mine = picked === c}
			{@const right = picked !== null && c === stop.answer}
			<g transform="translate({xs[i]}, {cy + 14})">
				<rect
					width={150}
					height={56}
					rx={10}
					fill={right ? 'var(--nw-right)' : mine ? 'var(--nw-hot-soft)' : 'var(--nw-card)'}
					stroke={mine ? 'var(--nw-hot)' : 'var(--nw-card-edge)'}
					stroke-width={mine ? 3 : 1.5}
					role="button"
					tabindex="0"
					aria-label="Guess {c}"
					aria-pressed={mine}
					style="cursor: pointer"
					onclick={() => (picked = c)}
					onkeydown={(e) => onKey(e, () => (picked = c))}
				/>
				<Label x={75} y={35} text={c} size={20} weight={700} halo={false} />
			</g>
		{/each}
		{#if picked === null}
			<Readout id="pick" label="Pick a card" value="what comes next?">
				<Label x={CX} y={cy + 130} text="Pick a card to see the machine’s guess." size={16} muted />
			</Readout>
		{:else}
			{@const shown = top(gameCards, 6)}
			<Readout
				id="book"
				order={1}
				label="The book says"
				value="{stop.answer}{picked === stop.answer ? ': you got it!' : ''}"
			>
				<Label
					x={CX}
					y={cy + 108}
					text="The book says “{stop.answer}”. {picked === stop.answer
						? 'You got it!'
						: 'You guessed “' + picked + '”.'}"
					size={17}
					weight={600}
				/>
			</Readout>
			<Readout
				id="machine"
				order={2}
				label="Machine’s guess"
				value="{shown[0]?.word ?? 'none'} (after “{lastWord}”)"
			>
				<Label
					x={CX}
					y={cy + 140}
					text="The machine’s cards: what came next after “{lastWord}” in its books"
					size={14}
					muted
				/>
			</Readout>
			{@render cardRow(shown, cy + 156, 112, stop.answer, shown[0]?.count ?? 1)}
		{/if}
	{:else if phase === 'cards'}
		{@const shown = top(chosenGuess.cards, 7)}
		<Label x={CX} y={70} text="What came next after" size={18} muted />
		<rect
			x={CX - 110}
			y={92}
			width={220}
			height={66}
			rx={12}
			fill="var(--nw-hot-soft)"
			stroke="var(--nw-hot)"
			stroke-width={2.5}
		/>
		<Label x={CX} y={136} text={show(chosen)} size={30} weight={700} halo={false} />
		<Readout id="seen" label="“{chosen}” seen" value="{fmt(chosenGuess.total)} times">
			<Label
				x={CX}
				y={200}
				text="Seen {fmt(chosenGuess.total)} times in the books, followed by {fmt(
					chosenGuess.cards.length
				)} different words"
				size={16}
			/>
		</Readout>
		{#each shown as _, i (i)}
			{@const xs = row(shown.length, 112)}
			<path
				d="M {CX} 160 C {CX} 230, {xs[i] + 56} 230, {xs[i] + 56} 290"
				fill="none"
				stroke="var(--nw-card-edge)"
				stroke-width={1.5}
				opacity={0.7}
			/>
		{/each}
		{@render cardRow(shown, 300, 112, null, shown[0]?.count ?? 1)}
		<Label
			x={CX}
			y={460}
			text="Each card: a word that came next, and how many times"
			size={15}
			muted
		/>
	{:else if phase === 'spinner'}
		{@const R = 190}
		{@const WX = 300}
		{@const WY = 320}
		{@const colours = [
			'--nw-s1',
			'--nw-s2',
			'--nw-s3',
			'--nw-s4',
			'--nw-s5',
			'--nw-s6',
			'--nw-s7',
			'--nw-s8'
		]}
		<Label
			x={WX}
			y={40}
			text="After “{SPIN_WORD}”, spin for the next word"
			size={17}
			weight={600}
		/>
		<g transform="translate({WX}, {WY}) rotate({-wheelAngle})">
			{#each spinCards as c, i (i)}
				{@const a0 =
					(spinCards.slice(0, i).reduce((s, d) => s + d.count, 0) / spinTotal) * 2 * Math.PI}
				{@const a1 = a0 + (c.count / spinTotal) * 2 * Math.PI}
				{@const large = a1 - a0 > Math.PI ? 1 : 0}
				{@const mid = (a0 + a1) / 2}
				<path
					d="M 0 0 L {R * Math.sin(a0)} {-R * Math.cos(a0)} A {R} {R} 0 {large} 1 {R *
						Math.sin(a1)} {-R * Math.cos(a1)} Z"
					fill="var({colours[i % colours.length]})"
					stroke="var(--stage-bg)"
					stroke-width={2}
				/>
				{#if a1 - a0 > 0.28}
					<g
						transform="rotate({(mid * 180) / Math.PI}) translate(0, {-R * 0.66}) rotate({(-mid *
							180) /
							Math.PI +
							wheelAngle})"
					>
						<Label x={0} y={5} text={c.other ? 'others' : show(c.word)} size={14} weight={700} />
					</g>
				{/if}
			{/each}
			<circle r={10} fill="var(--stage-ink)" />
		</g>
		<path
			d="M {WX - 14} {WY - R - 30} L {WX + 14} {WY - R - 30} L {WX} {WY - R + 4} Z"
			fill="var(--nw-hot)"
		/>
		{#if presses > 0 && !spinning}
			{@const c = spinCards[landed[presses - 1]]}
			<Readout
				id="landed"
				order={1}
				label="It landed on"
				value={c.other ? 'one of the other words' : show(c.word)}
			>
				<Label
					x={WX}
					y={WY + R + 42}
					text="It landed on “{c.other ? 'one of the others' : show(c.word)}”"
					size={18}
					weight={700}
				/>
			</Readout>
		{:else if presses === 0}
			<Readout id="press" label="Spinner" value="press Spin">
				<Label x={WX} y={WY + R + 42} text="Press Spin" size={17} muted />
			</Readout>
		{/if}
		<!-- the cards and the tally of spins so far -->
		<Label x={790} y={60} text="count" size={14} muted anchor="end" />
		<Label x={850} y={60} text="spins" size={14} muted anchor="end" />
		{#each spinCards as c, i (i)}
			{@const y = 96 + i * 50}
			<rect
				x={600}
				y={y - 22}
				width={18}
				height={18}
				rx={4}
				fill="var({colours[i % colours.length]})"
			/>
			<Label
				x={630}
				y={y - 7}
				text={c.other ? `${c.other} other words` : show(c.word)}
				size={16}
				anchor="start"
				halo={false}
			/>
			<Label
				x={790}
				y={y - 7}
				text="{c.count}×"
				size={15}
				anchor="end"
				muted
				tabular
				halo={false}
			/>
			<Label
				x={850}
				y={y - 7}
				text={String(tally[i])}
				size={16}
				anchor="end"
				weight={700}
				tabular
				halo={false}
			/>
		{/each}
		<Readout id="spins" order={2} label="Spins so far" value={String(presses)}>
			<Label
				x={850}
				y={96 + spinCards.length * 50}
				text="{presses} spins"
				size={14}
				anchor="end"
				muted
			/>
		</Readout>
	{:else if phase === 'write'}
		{@const words = written}
		{@const text = words.length ? story(words) : '…'}
		{@const lines = wrap(text, 56)}
		{@render page(lines, 30, 'Written by the machine, one spin at a time')}
		{@const lastW = words.at(-1)}
		{@const last =
			lastW === undefined || lastW === STOP ? 'the end of a sentence' : `“${show(lastW)}”`}
		{@const y = 120 + lines.length * 30}
		<Readout id="last" label="Looking at" value={last}>
			<Label
				x={CX}
				y={y + 10}
				text="Next, it spins from the cards after {last}"
				size={16}
				weight={600}
			/>
		</Readout>
		{@render cardRow(writeNext, y + 30, 120, null, writeNext[0]?.count ?? 1)}
		{#if words.length}
			<rect
				x={90}
				y={y - 36}
				width={780}
				height={4}
				rx={2}
				fill="var(--nw-hot)"
				opacity={1 - fresh}
			/>
		{/if}
		<Readout
			id="count"
			order={2}
			label="Words written"
			value="{words.filter((w) => w !== STOP).length} of {MAX_WORDS}"
		>
			<Label
				x={870}
				y={575}
				text="{words.length} of {MAX_WORDS} spins"
				size={13}
				anchor="end"
				muted
			/>
		</Readout>
	{:else if phase === 'two'}
		{@const lines = wrap(story(twoStory), 56)}
		{@render page(lines, 40, twoBack ? 'Looking back two words' : 'Looking back one word')}
		{@const y = 150 + lines.length * 30}
		{@const ex = twoBack ? ['she', 'went'] : ['went']}
		{@const exCards = top(guess(all, ex, twoBack ? 2 : 1).cards, 6)}
		<Readout id="looks" label="Its memory" value={twoBack ? 'the last two words' : 'the last word'}>
			<Label
				x={CX}
				{y}
				text="For example, the cards after “{ex.join(' ')}”:"
				size={16}
				weight={600}
			/>
		</Readout>
		{@render cardRow(exCards, y + 20, 112, null, exCards[0]?.count ?? 1)}
	{:else if phase === 'more'}
		<!-- the shelf -->
		{#each LIBRARY as b, i (b.title)}
			{@const read = i < nBooks}
			{@const big = i >= 4}
			<rect
				x={100 + i * 54}
				y={big ? 40 : 66}
				width={44}
				height={big ? 150 : 124}
				rx={4}
				fill={read ? `var(--nw-s${(i % 8) + 1})` : 'var(--nw-card)'}
				stroke="var(--nw-card-edge)"
				opacity={read ? 1 : 0.6}
			/>
			<Label
				x={122 + i * 54}
				y={big ? 118 : 130}
				text={big ? 'Aesop' : b.title.replace('The Tale of ', '').split(' ')[0]}
				size={12}
				weight={600}
				rotate={-90}
				halo={false}
				muted={!read}
			/>
		{/each}
		<line x1={90} y1={192} x2={490} y2={192} stroke="var(--nw-card-edge)" stroke-width={4} />
		<Readout id="books" order={1} label="Books read" value="{nBooks} of {LIBRARY.length}">
			<Label
				x={520}
				y={80}
				text="Books read: {nBooks} of {LIBRARY.length}"
				size={17}
				anchor="start"
				weight={600}
			/>
		</Readout>
		<Readout id="words" order={2} label="Words read" value={fmt(shelf.read)}>
			<Label x={520} y={112} text="Words read: {fmt(shelf.read)}" size={17} anchor="start" />
		</Readout>
		<Readout
			id="right"
			order={3}
			label="Right first guesses"
			value="about 1 word in {Math.round(1 / score)}"
		>
			<Label
				x={520}
				y={150}
				text="First guess right in Jemima’s story:"
				size={15}
				anchor="start"
				muted
			/>
			<Label
				x={520}
				y={178}
				text="about 1 word in {Math.round(1 / score)}"
				size={20}
				anchor="start"
				weight={700}
				color="var(--nw-hot)"
			/>
		</Readout>
		{@const tc = top(theCards.cards, 6)}
		<Label
			x={CX}
			y={240}
			text="Cards after “the”: {fmt(theCards.cards.length)} different words"
			size={15}
			weight={600}
		/>
		{@render cardRow(tc, 256, 112, null, tc[0]?.count ?? 1)}
		{@const lines = wrap(story(sample), 64)}
		{#each lines as l, i (i)}
			<Label
				x={CX}
				y={400 + i * 26}
				text={(i === 0 ? '“' : '') + l + (i === lines.length - 1 ? '…”' : '')}
				size={17}
				italic
			/>
		{/each}
		<Label
			x={CX}
			y={400 + lines.length * 26 + 10}
			text="(a story it writes, looking back two words)"
			size={13}
			muted
		/>
	{:else if phase === 'likely'}
		{@const lines = wrap(story(sentence) + (sentence.at(-1) === STOP ? '' : '…'), 50)}
		{#each lines as l, i (i)}
			<Label x={CX} y={130 + i * 34} text={l} size={22} weight={600} />
		{/each}
		{@const y = 180 + lines.length * 34}
		<Readout
			id="copied"
			label="In its books?"
			value={copied ? 'yes, copied word for word' : 'no, made from pieces'}
		>
			<rect
				x={CX - 280}
				y={y - 30}
				width={560}
				height={50}
				rx={25}
				fill={copied ? 'var(--nw-card)' : 'var(--nw-hot-soft)'}
				stroke={copied ? 'var(--nw-card-edge)' : 'var(--nw-hot)'}
				stroke-width={2}
			/>
			<Label
				x={CX}
				y={y + 2}
				text={copied
					? 'This sentence is in one of its books, word for word'
					: 'This sentence is in none of its books'}
				size={17}
				weight={600}
				halo={false}
			/>
		</Readout>
		<Label
			x={CX}
			y={y + 70}
			text="Every three words in a row came from a book; nobody checked the whole"
			size={15}
			muted
		/>
	{:else if phase === 'real'}
		{@const glow = reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 2)}
		<!-- the toy -->
		<Label x={240} y={70} text="This toy" size={20} weight={700} />
		{#each ['…', 'went', 'into', 'the'] as w, i (i)}
			<rect
				x={70 + i * 88}
				y={110}
				width={80}
				height={44}
				rx={8}
				fill={i >= 2 ? 'var(--nw-hot-soft)' : 'var(--nw-card)'}
				stroke={i >= 2 ? 'var(--nw-hot)' : 'var(--nw-card-edge)'}
				stroke-width={i >= 2 ? 2.5 : 1}
			/>
			<Label x={110 + i * 88} y={138} text={w} size={16} weight={600} halo={false} />
		{/each}
		<Label x={240} y={190} text="looks back one or two words" size={15} />
		<rect
			x={150}
			y={220}
			width={180}
			height={70}
			rx={10}
			fill="var(--nw-card)"
			stroke="var(--nw-card-edge)"
		/>
		<Label x={240} y={262} text="word counts" size={17} weight={600} halo={false} />
		<Label x={240} y={330} text="read about 40,000 words" size={15} muted />
		<!-- a real chatbot -->
		<Label x={700} y={70} text="A real chatbot" size={20} weight={700} />
		{#each Array.from({ length: 64 }, (_, i) => i) as i (i)}
			<rect
				x={520 + (i % 16) * 23}
				y={100 + Math.floor(i / 16) * 16}
				width={19}
				height={11}
				rx={2}
				fill="var(--nw-hot)"
				opacity={0.25 + 0.75 * (i / 63) * glow}
			/>
		{/each}
		<Label x={700} y={190} text="looks back over thousands of words" size={15} />
		<!-- a small neural network -->
		{#each [0, 1, 2] as col (col)}
			{#each [0, 1, 2, 3] as r (r)}
				{#if col < 2}
					{#each [0, 1, 2, 3] as r2 (r2)}
						<line
							x1={640 + col * 60}
							y1={225 + r * 22}
							x2={700 + col * 60}
							y2={225 + r2 * 22}
							stroke="var(--nw-card-edge)"
							stroke-width={1}
						/>
					{/each}
				{/if}
				<circle cx={640 + col * 60} cy={225 + r * 22} r={8} fill="var(--nw-s2)" />
			{/each}
		{/each}
		<Label
			x={700}
			y={330}
			text="a neural network, trained on a huge amount of text"
			size={15}
			muted
		/>
		<Label
			x={CX}
			y={430}
			text="Both write one word at a time, and both pick likely words, not true ones."
			size={18}
			weight={600}
		/>
	{/if}
</g>
