<script lang="ts">
	/**
	 * The spam filter: a pile of marked messages, a word's two counts, the counted words of both
	 * piles, and a new message whose words pull a marker toward "spam" or "not spam" (a tug of
	 * war), with the head start for how rare spam is, a misspelling that doesn't vote, a
	 * "report spam" that teaches it, and the filter fooled both ways. All numbers come from the
	 * model counting messages.json.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MESSAGES, MINE } from '../data';
	import { add, copy, count, judge, vote, type Counts, type Vote } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'pile'));
	const counts = count(MESSAGES);
	const fmt = (n: number) => n.toLocaleString('en-GB');
	const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
	const CX = 480;

	// ---- time since this step's button was last pressed ----------------------------------------
	const presses = $derived(
		Number(
			phase === 'pile'
				? (params.next ?? 0)
				: phase === 'count'
					? (params.count ?? 0)
					: phase === 'report'
						? (params.report ?? 0)
						: 0
		)
	);
	let t0 = $state(0);
	$effect(() => {
		void presses;
		void step.id;
		t0 = untrack(() => t);
	});
	const since = $derived(reduced ? 10 : Math.max(0, t - t0));

	// ---- the pile -----------------------------------------------------------------------------
	/** Messages shown on the pile step, picked by hand to be readable and to mix both kinds. */
	const walk = [9, 34, 46, 64, 114, 19, 48, 183, 91, 13].map((k) => MESSAGES[k]);
	/** One message arrives every 2.5 s until four are shown; each press brings one more. */
	const ARRIVE = 2.5;
	const auto = $derived(reduced ? 4 : Math.min(4, 1 + Math.floor(t / ARRIVE)));
	const shown = $derived(auto + presses);
	const pileTop = $derived(
		Array.from({ length: Math.min(4, shown) }, (_, i) => {
			const n = shown - Math.min(4, shown) + i;
			return { m: walk[n % walk.length], n };
		})
	);
	const newest = $derived(
		reduced ? 1 : clamp01((presses > 0 ? since : t - (auto - 1) * ARRIVE) / 0.5)
	);

	// ---- one word's counts --------------------------------------------------------------------
	const word = $derived(String(params.word ?? 'free'));
	const wv = $derived(vote(counts, word));

	/** "about 1 in 4": how many messages of a pile hold one that contains the word. */
	function share(n: number, of: number): string {
		if (n === 0) return 'none of them';
		const k = of / n;
		const r = k < 10 ? Math.round(k) : k < 30 ? Math.round(k / 5) * 5 : Math.round(k / 10) * 10;
		return r <= 1 ? 'almost all of them' : `about 1 in ${r}`;
	}
	/** Which pile the word is commoner in, in words (the vote compares the two piles). */
	function lean(v: Vote): string {
		if (Math.abs(v.push) < 0.5) return 'about as common in both piles';
		const side = v.push > 0 ? 'spam' : 'ordinary messages';
		return Math.abs(v.push) >= 2 ? `much commoner in ${side}` : `commoner in ${side}`;
	}

	// ---- every word, counted ------------------------------------------------------------------
	const ranked = [...counts.word.keys()]
		.map((w) => vote(counts, w))
		.filter((v) => v.spam + v.ham >= 8);
	const spammiest = [...ranked].sort((a, b) => b.push - a.push).slice(0, 6);
	const homeliest = [...ranked].sort((a, b) => a.push - b.push).slice(0, 6);
	const counted = $derived(presses > 0);
	/** Rows of the counted table appear one after another after the press. */
	const rowIn = (i: number) => clamp01((since - 0.3 - i * 0.3) / 0.4);

	// ---- the vote -----------------------------------------------------------------------------
	const taught: Counts = $derived.by(() => {
		const c = copy(counts);
		const n = phase === 'report' ? presses : 0;
		if (n > 0) add(c, MINE.sneaky, true, n);
		return c;
	});
	const message = $derived.by(() => {
		if (phase === 'vote') return MINE[String(params.message ?? 'spammy') as keyof typeof MINE];
		if (phase === 'rare') return MINE.rare;
		if (phase === 'sneak') return params.misspell === true ? MINE.sneaky : MINE.spammy;
		if (phase === 'report') return MINE.sneaky;
		return MINE.spammy;
	});
	const rarity = $derived(phase === 'rare' ? params.rarity !== false : true);
	const verdict = $derived(judge(phase === 'report' ? taught : counts, message, rarity));
	/** The marker eases from the start to the final score over two seconds (after a press too). */
	const shownScore = $derived.by(() => {
		const s = phase === 'report' && presses > 0 ? since : t;
		const k = reduced ? 1 : clamp01((s - 0.4) / 2);
		const e = k * k * (3 - 2 * k);
		return verdict.start + (verdict.score - verdict.start) * e;
	});
	const done = $derived(reduced || (phase === 'report' && presses > 0 ? since : t) > 2.6);
	const RANGE = 24;
	const BAR_X = 120;
	const BAR_W = 720;
	const BAR_Y = 352;
	const scoreX = (s: number) =>
		BAR_X + BAR_W / 2 + (Math.max(-RANGE, Math.min(RANGE, s)) / RANGE) * (BAR_W / 2);

	/** A word card's last line: how hard it pulls (the arrow shows which way). */
	function pull(v: Vote): string {
		if (v.spam + v.ham === 0) return 'never seen: no vote';
		const p = Math.abs(v.push);
		return p >= 2 ? 'pulls hard' : p >= 0.75 ? 'pulls' : 'pulls a little';
	}
	const votesText = $derived.by(() => {
		const list = (f: (v: Vote) => boolean) =>
			verdict.votes
				.filter(f)
				.map((v) => v.word)
				.join(', ') || 'none';
		const unseen = verdict.votes.filter((v) => v.spam + v.ham === 0);
		return (
			`spam: ${list((v) => v.push > 0)} · not spam: ${list((v) => v.push < 0)}` +
			(unseen.length ? ` · no vote: ${unseen.map((v) => v.word).join(', ')}` : '')
		);
	});

	function chips(votes: Vote[]) {
		const gap = 12;
		const w = Math.min(150, (880 - (votes.length - 1) * gap) / votes.length);
		const total = votes.length * w + (votes.length - 1) * gap;
		return votes.map((v, i) => ({ v, x: CX - total / 2 + i * (w + gap), w }));
	}
	const showVote = $derived(['vote', 'rare', 'sneak', 'report'].includes(phase));

	// ---- fooled both ways ---------------------------------------------------------------------
	const advert = judge(counts, MINE.sneaky);
	const cup = judge(counts, MINE.cup);
</script>

{#snippet bubble(
	text: string,
	x: number,
	y: number,
	w: number,
	mark: 'spam' | 'ok' | null,
	opacity = 1
)}
	{@const max = Math.floor((w - 40) / 8.6)}
	<g transform="translate({x}, {y})" {opacity}>
		<rect
			width={w}
			height={52}
			rx={16}
			fill="var(--sp-bubble)"
			stroke={mark === 'spam'
				? 'var(--sp-spam)'
				: mark === 'ok'
					? 'var(--sp-ok)'
					: 'var(--sp-edge)'}
			stroke-width={mark ? 2.5 : 1.5}
		/>
		<Label
			x={18}
			y={32}
			text={text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text}
			size={16}
			anchor="start"
			halo={false}
		/>
		{#if mark}
			<rect
				x={w - 100}
				y={-13}
				width={96}
				height={26}
				rx={13}
				fill={mark === 'spam' ? 'var(--sp-spam)' : 'var(--sp-ok)'}
			/>
			<Label
				x={w - 52}
				y={5}
				text={mark === 'spam' ? 'spam' : 'not spam'}
				size={14}
				weight={700}
				color="#fff"
				halo={false}
			/>
		{/if}
	</g>
{/snippet}

{#snippet stacks(y: number, opacity: number)}
	<!-- the pile drawn as two stacks to the same scale: one block per 10 messages -->
	<g {opacity}>
		{#each Array.from({ length: Math.round(counts.ham / 10) }, (_, i) => i) as i (i)}
			<rect
				x={250 + (i % 25) * 18}
				y={y + Math.floor(i / 25) * 15}
				width={14}
				height={11}
				rx={2}
				fill="var(--sp-ok)"
				opacity={0.8}
			/>
		{/each}
		{#each Array.from({ length: Math.round(counts.spam / 10) }, (_, i) => i) as i (i)}
			<rect
				x={250 + i * 18}
				y={y + 62}
				width={14}
				height={11}
				rx={2}
				fill="var(--sp-spam)"
				opacity={0.85}
			/>
		{/each}
		<Label x={234} y={y + 20} text="ordinary" size={15} anchor="end" muted />
		<Label x={234} y={y + 72} text="spam" size={15} anchor="end" muted />
		<Readout id="blocks">
			<Label x={700} y={y + 104} text="each block: 10 messages" size={14} anchor="end" muted />
		</Readout>
	</g>
{/snippet}

<g class="sp">
	{#if phase === 'pile'}
		{#each pileTop as p, i (p.n)}
			{@render bubble(
				p.m.text,
				90,
				44 + i * 78,
				780,
				p.m.spam ? 'spam' : 'ok',
				i === pileTop.length - 1 ? newest : 1
			)}
		{/each}
		<Readout id="pile" order={1} label="The pile" value="{counts.spam} spam, {counts.ham} ordinary">
			<Label
				x={CX}
				y={392}
				text="The pile: {fmt(
					counts.spam + counts.ham
				)} messages, {counts.spam} marked spam, {counts.ham} ordinary"
				size={19}
				weight={600}
			/>
		</Readout>
		{@render stacks(420, 1)}
	{:else if phase === 'word'}
		<rect
			x={CX - 130}
			y={36}
			width={260}
			height={74}
			rx={16}
			fill="var(--sp-bubble)"
			stroke="var(--sp-edge)"
			stroke-width={2}
		/>
		<Label x={CX} y={84} text="“{word}”" size={32} weight={700} halo={false} />
		{@const maxN = Math.max(20, wv.spam, wv.ham)}
		{#each [{ k: 'spam', n: wv.spam, of: counts.spam, x: 260 }, { k: 'ok', n: wv.ham, of: counts.ham, x: 700 }] as side (side.k)}
			{@const col = side.k === 'spam' ? 'var(--sp-spam)' : 'var(--sp-ok)'}
			{@const h = (side.n / maxN) * 230}
			<Label
				x={side.x}
				y={156}
				text={side.k === 'spam' ? 'spam messages' : 'ordinary messages'}
				size={19}
				weight={700}
				color={col}
			/>
			<rect x={side.x - 70} y={440 - h} width={140} height={h} rx={6} fill={col} />
			<line
				x1={side.x - 95}
				y1={440}
				x2={side.x + 95}
				y2={440}
				stroke="var(--sp-edge)"
				stroke-width={2}
			/>
			<Readout
				id={side.k}
				order={side.k === 'spam' ? 1 : 2}
				label={side.k === 'spam' ? 'Spam messages with it' : 'Ordinary messages with it'}
				value="{side.n} of {side.of}"
				note={share(side.n, side.of)}
			>
				<Label x={side.x} y={430 - h} text={String(side.n)} size={30} weight={700} />
				<Label x={side.x} y={470} text="contain it, out of {side.of}" size={16} muted />
				<Label x={side.x} y={494} text={share(side.n, side.of)} size={16} muted />
			</Readout>
		{/each}
		<Readout id="lean" order={3} label="So “{word}” is" value={lean(wv)}>
			<Label
				x={CX}
				y={552}
				text="“{word}” is {lean(wv)}"
				size={20}
				weight={700}
				color={Math.abs(wv.push) < 0.5
					? 'var(--stage-ink)'
					: wv.push > 0
						? 'var(--sp-spam)'
						: 'var(--sp-ok)'}
			/>
		</Readout>
	{:else if phase === 'count'}
		{#if !counted}
			{@render stacks(200, 0.6)}
			<Label x={CX} y={130} text="Press “Count every word”" size={22} weight={600} />
			<Label
				x={CX}
				y={400}
				text="{fmt(counts.spam + counts.ham)} messages to read"
				size={17}
				muted
			/>
		{:else}
			<Readout id="words" order={1} label="Different words counted" value={fmt(counts.word.size)}>
				<Label
					x={CX}
					y={44}
					text="{fmt(counts.word.size)} different words counted"
					size={20}
					weight={600}
					opacity={rowIn(0)}
				/>
			</Readout>
			{#each [{ k: 'spam', x: 120, list: spammiest, title: 'mostly in spam' }, { k: 'ok', x: 540, list: homeliest, title: 'mostly in ordinary messages' }] as col (col.k)}
				{@const c = col.k === 'spam' ? 'var(--sp-spam)' : 'var(--sp-ok)'}
				<Readout
					id={col.k}
					order={col.k === 'spam' ? 2 : 3}
					label={col.k === 'spam' ? 'Mostly in spam' : 'Mostly in ordinary messages'}
					value={col.list.map((v) => v.word).join(', ')}
					opacity={rowIn(0)}
				>
					<g opacity={rowIn(0)}>
						<Label x={col.x + 150} y={96} text={col.title} size={19} weight={700} color={c} />
						<Label x={col.x} y={132} text="word" size={14} muted anchor="start" />
						<Label x={col.x + 200} y={132} text="spam" size={14} muted anchor="end" />
						<Label x={col.x + 300} y={132} text="ordinary" size={14} muted anchor="end" />
					</g>
					{#each col.list as v, i (v.word)}
						<g opacity={rowIn(i + 1)}>
							<Label
								x={col.x}
								y={174 + i * 46}
								text={v.word}
								size={21}
								weight={600}
								anchor="start"
							/>
							<Label
								x={col.x + 200}
								y={174 + i * 46}
								text={String(v.spam)}
								size={20}
								anchor="end"
								tabular
								weight={col.k === 'spam' ? 700 : 400}
								color={col.k === 'spam' ? c : undefined}
								muted={col.k !== 'spam'}
							/>
							<Label
								x={col.x + 300}
								y={174 + i * 46}
								text={String(v.ham)}
								size={20}
								anchor="end"
								tabular
								weight={col.k === 'ok' ? 700 : 400}
								color={col.k === 'ok' ? c : undefined}
								muted={col.k !== 'ok'}
							/>
						</g>
					{/each}
				</Readout>
			{/each}
			<Readout id="note">
				<Label
					x={CX}
					y={480}
					text="(the words found in at least 8 messages that lean most to one side)"
					size={15}
					muted
					opacity={rowIn(7)}
				/>
			</Readout>
		{/if}
	{:else if showVote}
		{@render bubble(message, 150, 30, 660, verdict.spam ? 'spam' : 'ok')}
		{#each chips(verdict.votes) as c (c.v.word)}
			{@const col =
				c.v.push > 0 ? 'var(--sp-spam)' : c.v.push < 0 ? 'var(--sp-ok)' : 'var(--sp-edge)'}
			{@const seen = c.v.spam + c.v.ham > 0}
			{@const len = Math.min(44, Math.abs(c.v.push) * 9)}
			<g transform="translate({c.x}, 112)">
				<rect
					width={c.w}
					height={166}
					rx={12}
					fill="var(--sp-bubble)"
					stroke={col}
					stroke-width={seen ? 2.5 : 1.5}
					stroke-dasharray={seen ? 'none' : '6 5'}
				/>
				<Label x={c.w / 2} y={34} text={c.v.word} size={21} weight={700} halo={false} />
				{#if seen}
					<line
						x1={c.w / 2 - Math.sign(c.v.push) * 6}
						y1={66}
						x2={c.w / 2 + Math.sign(c.v.push) * len}
						y2={66}
						stroke={col}
						stroke-width={7}
						stroke-linecap="round"
					/>
					<path
						d="M {c.w / 2 + Math.sign(c.v.push) * (len + 12)} 66 l {-Math.sign(c.v.push) *
							14} -10 l 0 20 Z"
						fill={col}
					/>
					<Label
						x={c.w / 2}
						y={104}
						text="{c.v.spam} spam"
						size={14}
						halo={false}
						color="var(--sp-spam)"
					/>
					<Label
						x={c.w / 2}
						y={124}
						text="{c.v.ham} ordinary"
						size={14}
						halo={false}
						color="var(--sp-ok)"
					/>
					<Label x={c.w / 2} y={152} text={pull(c.v)} size={14} weight={600} halo={false} />
				{:else}
					<Label x={c.w / 2} y={96} text="never seen" size={14} halo={false} muted />
					<Label x={c.w / 2} y={152} text="no vote" size={14} weight={600} halo={false} muted />
				{/if}
			</g>
		{/each}
		<Readout id="votes" order={2} label="Votes" value={votesText} />
		<!-- the tug of war -->
		<rect
			x={BAR_X}
			y={BAR_Y - 14}
			width={BAR_W / 2}
			height={28}
			rx={14}
			fill="var(--sp-ok)"
			opacity={0.3}
		/>
		<rect
			x={BAR_X + BAR_W / 2}
			y={BAR_Y - 14}
			width={BAR_W / 2}
			height={28}
			rx={14}
			fill="var(--sp-spam)"
			opacity={0.3}
		/>
		<line
			x1={CX}
			y1={BAR_Y - 28}
			x2={CX}
			y2={BAR_Y + 28}
			stroke="var(--stage-ink)"
			stroke-width={2}
			stroke-dasharray="4 4"
		/>
		<Label
			x={BAR_X}
			y={BAR_Y + 48}
			text="not spam: inbox"
			size={17}
			weight={700}
			anchor="start"
			color="var(--sp-ok)"
		/>
		<Label
			x={BAR_X + BAR_W}
			y={BAR_Y + 48}
			text="spam folder"
			size={17}
			weight={700}
			anchor="end"
			color="var(--sp-spam)"
		/>
		{#if verdict.start !== 0}
			<circle
				cx={scoreX(verdict.start)}
				cy={BAR_Y}
				r={7}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width={2}
			/>
			<Readout id="startlabel">
				<Label x={scoreX(verdict.start)} y={BAR_Y - 26} text="start" size={14} muted />
			</Readout>
		{/if}
		<circle cx={scoreX(shownScore)} cy={BAR_Y} r={17} fill="var(--stage-ink)" />
		<Readout
			id="verdict"
			order={1}
			label="Verdict"
			value={verdict.spam ? 'spam folder' : 'inbox'}
			opacity={done ? 1 : 0}
		>
			<Label
				x={CX}
				y={460}
				text={verdict.spam
					? 'The votes send it to the spam folder'
					: 'The votes let it into the inbox'}
				size={23}
				weight={700}
				opacity={done ? 1 : 0}
				color={verdict.spam ? 'var(--sp-spam)' : 'var(--sp-ok)'}
			/>
		</Readout>
		{#if phase === 'rare'}
			<Readout
				id="start"
				order={3}
				label="Start"
				value={rarity ? 'on the not-spam side (spam is rare)' : 'in the middle'}
			>
				<Label
					x={CX}
					y={510}
					text={rarity
						? 'The marker starts on the “not spam” side: only 1 message in 8 is spam'
						: 'The marker starts in the middle, as if spam were as common as anything else'}
					size={17}
					muted
				/>
			</Readout>
		{:else if phase === 'report'}
			<Readout id="reports" order={3} label="Reports" value={String(presses)}>
				<Label
					x={CX}
					y={510}
					text={presses === 0
						? 'Press “Report spam” to put it on the spam pile'
						: `Reported ${presses} time${presses === 1 ? '' : 's'}: “w1n” and “fr33” are now on the spam pile`}
					size={17}
					muted
				/>
			</Readout>
		{:else if phase === 'sneak'}
			<Readout id="sneakcap">
				<Label
					x={CX}
					y={510}
					text={params.misspell === true
						? 'Dashed cards: words the filter has never seen don’t vote'
						: 'Each word pulls the marker; the bigger the arrow, the harder'}
					size={17}
					muted
				/>
			</Readout>
		{/if}
	{:else if phase === 'real'}
		<Label x={CX} y={44} text="Fooled both ways" size={22} weight={700} />
		{@render bubble(MINE.sneaky, 90, 80, 520, advert.spam ? 'spam' : 'ok')}
		<Readout
			id="advert"
			order={1}
			label="An advert, misspelled"
			value={advert.spam ? 'spam folder' : 'inbox'}
		>
			<Label
				x={630}
				y={112}
				text={advert.spam ? '← an advert, caught' : '← an advert, let into the inbox'}
				size={17}
				weight={600}
				anchor="start"
				color="var(--sp-ok)"
			/>
		</Readout>
		{@render bubble(MINE.cup, 90, 160, 520, cup.spam ? 'spam' : 'ok')}
		<Readout
			id="cup"
			order={2}
			label="A friend’s good news"
			value={cup.spam ? 'spam folder' : 'inbox'}
		>
			<Label
				x={630}
				y={192}
				text={cup.spam ? '← a friend, sent to spam' : '← a friend, let in'}
				size={17}
				weight={600}
				anchor="start"
				color="var(--sp-spam)"
			/>
		</Readout>
		<rect
			x={190}
			y={270}
			width={580}
			height={250}
			rx={16}
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width={1.5}
		/>
		<Readout
			id="real"
			order={3}
			label="Real email filters also check"
			value="who sent it, where its links go, how many people got the same message"
		>
			<Label x={CX} y={312} text="Real email filters also check:" size={20} weight={700} />
			{#each ['who sent it', 'where its links go', 'how many people got the same message', 'and much more, with far bigger learning machines'] as line, i (line)}
				<Label x={240} y={360 + i * 42} text="•  {line}" size={18} anchor="start" muted={i === 3} />
			{/each}
		</Readout>
	{/if}
</g>
