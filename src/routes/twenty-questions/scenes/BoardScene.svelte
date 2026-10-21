<script lang="ts">
	/**
	 * The animal board: the 99 animals of the UCI Zoo dataset (`BOARD` in the model).
	 *
	 * - `game`: the page's secret animal (`secretAnimal`, a new one for each press of
	 *   `params.animal`). The reader clicks a question (`QUESTIONS`) or an animal ("Is it a …?");
	 *   the page answers for its secret, and every animal that would answer the other way is
	 *   hidden (`ask`). The questions asked are kept in `params.asked`, a comma-separated list of
	 *   question ids, so the game survives a visit to another step.
	 * - `split`: one first question (`params.q`) on the full board: the animals that would answer
	 *   yes in one colour, no in another, and two bars with how many each answer would leave.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, easeOut, lerp, Label, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import {
		ask,
		bestQuestion,
		BOARD,
		isIt,
		QUESTIONS,
		questionById,
		secretAnimal,
		yesCount,
		type Animal,
		type Question
	} from '../model';
	import Button from './Button.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const readouts = useReadouts();
	const narrow = $derived(readouts?.out ?? false);
	const phase = $derived(String(step.hints?.phase ?? 'game'));

	// ---- the game ------------------------------------------------------------------------------
	const presses = $derived(Math.round(Number(params.animal ?? 0)) || 0);
	const secret = $derived(secretAnimal(presses));
	let seen = untrack(() => presses);
	$effect(() => {
		const p = presses;
		untrack(() => {
			if (p === seen) return;
			seen = p;
			setParam('asked', '');
		});
	});

	const asked = $derived(
		String(params.asked ?? '')
			.split(',')
			.map((id) => questionById(id))
			.filter((q): q is Question => q !== null)
	);
	/** What is left after each question: `trail[i]` before question i, the last one now. */
	const trail = $derived.by(() => {
		const out: Animal[][] = [BOARD];
		for (const q of asked) out.push(ask(out[out.length - 1], q, secret));
		return out;
	});
	const left = $derived(trail[trail.length - 1]);
	const leftBefore = $derived(trail[Math.max(0, trail.length - 2)]);
	const leftSet = $derived(new Set(left.map((a) => a.name)));
	const beforeSet = $derived(new Set(leftBefore.map((a) => a.name)));
	const found = $derived(left.length === 1);
	const stuck = $derived(left.length > 1 && bestQuestion(left) === null);
	const last = $derived(asked.length ? asked[asked.length - 1] : null);
	const askedIds = $derived(new Set(asked.map((q) => q.id)));

	function put(q: Question) {
		if (found || askedIds.has(q.id)) return;
		const now = String(params.asked ?? '');
		setParam('asked', now ? `${now},${q.id}` : q.id);
	}

	// The animals a question hides fade out.
	const fade = new Tween(1, { duration: 700, easing: cubicInOut });
	const count = $derived(asked.length);
	let lastCount = untrack(() => count);
	$effect(() => {
		const c = count;
		untrack(() => {
			if (c === lastCount) return;
			lastCount = c;
			if (reduced) {
				fade.set(1, { duration: 0 });
				return;
			}
			void fade.set(0, { duration: 0 }).then(() => fade.set(1));
		});
	});
	const tileOpacity = (a: Animal) =>
		leftSet.has(a.name) ? 1 : beforeSet.has(a.name) ? lerp(1, 0.13, fade.current) : 0.13;

	// ---- the split -----------------------------------------------------------------------------
	const firstQ = $derived(questionById(String(params.q ?? 'penguin')) ?? QUESTIONS[0]);
	const yes = $derived(yesCount(BOARD, firstQ));
	const no = $derived(BOARD.length - yes);
	let since = $state(0);
	let lastQ = untrack(() => firstQ.id);
	$effect(() => {
		const id = firstQ.id;
		untrack(() => {
			if (id !== lastQ) {
				lastQ = id;
				since = t;
			}
		});
	});
	const grow = $derived(reduced ? 1 : easeOut(clamp((t - since - 0.3) / 1.2)));
	const verdict = $derived.by(() => {
		const small = Math.min(yes, no);
		if (small / BOARD.length >= 0.4) return 'About half are gone, whichever the answer.';
		if (small <= 1) return 'Almost surely “no”: it hides one animal.';
		return `Most likely “${no > yes ? 'no' : 'yes'}”, and that still leaves ${Math.max(yes, no)}.`;
	});

	// ---- layout --------------------------------------------------------------------------------
	const COLS = $derived(narrow ? 11 : 9);
	const tile = $derived(
		narrow
			? phase === 'split'
				? { x0: 16, y0: 16, w: 78, h: 56, px: 84, py: 62 }
				: { x0: 16, y0: 16, w: 78, h: 22, px: 84, py: 26 }
			: { x0: 16, y0: 84, w: 66, h: 38, px: 69, py: 43 }
	);
	const tileAt = (i: number) => ({
		x: tile.x0 + (i % COLS) * tile.px,
		y: tile.y0 + Math.floor(i / COLS) * tile.py
	});
	/** On a phone, when few animals are left, they are listed as big buttons instead. */
	const bigNames = $derived(narrow && phase === 'game' && left.length <= 12 && !found);
	const chipAt = (i: number) =>
		narrow
			? { x: 16 + (i % 2) * 472, y: 266 + Math.floor(i / 2) * 33, w: 456, h: 29 }
			: { x: 656, y: 92 + i * 24, w: 288, h: 21 };
	const bob = $derived(reduced ? 0 : 3 * wave(t, 1.8));
	/** Breaks a sentence into lines of at most `width` characters. */
	function wrap(text: string, width: number): string[] {
		const lines: string[] = [];
		for (const w of text.split(' ')) {
			const l = lines.length ? lines[lines.length - 1] : null;
			if (l !== null && l.length + 1 + w.length <= width) lines[lines.length - 1] = `${l} ${w}`;
			else lines.push(w);
		}
		return lines;
	}
	const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
</script>

<g class="board">
	{#if phase === 'game'}
		<Readout
			id="bd-head"
			order={1}
			label="Animals left"
			value="{left.length} of 99, after {plural(asked.length, 'question')}"
		>
			<Label
				x={16}
				y={34}
				text={found ? 'Found it!' : 'I’m thinking of one of these 99 animals.'}
				size={20}
				weight={700}
				anchor="start"
				halo={false}
			/>
			<Label
				x={944}
				y={34}
				text="Questions: {asked.length} · {left.length} left"
				size={20}
				weight={700}
				anchor="end"
				color="var(--tq-hot)"
				tabular
				halo={false}
			/>
		</Readout>
		{#if last}
			{@const hid = leftBefore.length - left.length}
			<Readout
				id="bd-last"
				order={2}
				label={last.text}
				value="{last.yes(secret) ? 'Yes' : 'No'}: {hid === 0 ? 'hid none' : `hid ${hid}`}"
			>
				<Label
					x={16}
					y={64}
					text="{last.text} {last.yes(secret) ? 'Yes.' : 'No.'} {hid === 0
						? 'That hid none: every animal left answers the same.'
						: `That hid ${hid}.`}"
					size={15}
					weight={600}
					anchor="start"
					color={hid === 0 ? 'var(--tq-bad)' : 'var(--stage-ink)'}
					halo={false}
				/>
			</Readout>
		{/if}
	{:else}
		<Readout id="bd-split-head" order={1} label="First question" value={firstQ.text}>
			<Label
				x={16}
				y={34}
				text="First question: {firstQ.text}"
				size={20}
				weight={700}
				anchor="start"
				halo={false}
			/>
		</Readout>
		<Readout id="bd-key-yes" order={5} label="would answer yes" color="var(--tq-yes)" />
		<Readout id="bd-key-no" order={6} label="would answer no" color="var(--tq-no)" />
		<Readout id="bd-key">
			<rect x={16} y={52} width="16" height="16" rx="4" fill="var(--tq-yes)" />
			<Label x={38} y={65} text="would answer yes" size={14} anchor="start" halo={false} />
			<rect x={170} y={52} width="16" height="16" rx="4" fill="var(--tq-no)" />
			<Label x={192} y={65} text="would answer no" size={14} anchor="start" halo={false} />
		</Readout>
	{/if}

	<!-- the board -->
	{#if bigNames}
		{#each left as a, i (a.name)}
			<Button
				x={16 + (i % 3) * 314}
				y={16 + Math.floor(i / 3) * 60}
				w={300}
				h={52}
				size={24}
				text={a.name}
				label="Is it a {a.name}?"
				onpress={() => put(isIt(a))}
			/>
		{/each}
	{:else}
		{#each BOARD as a, i (a.name)}
			{@const p = tileAt(i)}
			{@const on = phase === 'game' ? leftSet.has(a.name) : true}
			{@const isYes = phase === 'split' && firstQ.yes(a)}
			{@const win = phase === 'game' && found && on}
			<g opacity={phase === 'game' ? tileOpacity(a) : 1}>
				{#if phase === 'game' && on && !found}
					<Button
						x={p.x}
						y={p.y}
						w={tile.w}
						h={tile.h}
						size={narrow ? 0.1 : 11}
						weight={600}
						anchor="middle"
						text={narrow ? '' : a.name}
						label="Is it a {a.name}?"
						onpress={() => put(isIt(a))}
					/>
				{:else}
					<rect
						x={p.x}
						y={win ? p.y - bob : p.y}
						width={tile.w}
						height={tile.h}
						rx="7"
						fill={win
							? 'var(--tq-good)'
							: phase === 'split'
								? isYes
									? 'var(--tq-yes)'
									: 'var(--tq-no)'
								: 'var(--surface)'}
						stroke={win ? 'var(--tq-good)' : 'var(--border)'}
						stroke-width="1"
					/>
					{#if !narrow}
						<text
							x={p.x + tile.w / 2}
							y={(win ? p.y - bob : p.y) + tile.h / 2 + 4}
							text-anchor="middle"
							font-size="11"
							font-weight={win || isYes ? 800 : 500}
							fill={win ? '#ffffff' : 'var(--stage-ink)'}>{a.name}</text
						>
					{/if}
				{/if}
			</g>
		{/each}
	{/if}

	{#if phase === 'game'}
		<!-- the questions -->
		<Readout id="bd-ask-title">
			<Label
				x={656}
				y={80}
				text="Ask a question:"
				size={14}
				weight={700}
				anchor="start"
				muted
				halo={false}
			/>
		</Readout>
		{#each QUESTIONS as q, i (q.id)}
			{@const c = chipAt(i)}
			{@const done = askedIds.has(q.id)}
			<Button
				x={c.x}
				y={c.y}
				w={c.w}
				h={c.h}
				size={narrow ? 18 : 12.5}
				weight={600}
				text={q.text}
				tag={done ? (q.yes(secret) ? 'yes' : 'no') : undefined}
				tagColor={done ? (q.yes(secret) ? 'var(--tq-good)' : 'var(--tq-bad)') : undefined}
				disabled={done || found}
				opacity={done ? 0.6 : found ? 0.45 : 1}
				onpress={() => put(q)}
			/>
		{/each}

		{#if found}
			<Readout
				id="bd-found"
				order={3}
				label="Found"
				value="the {left[0].name}, in {plural(asked.length, 'question')}"
				color="var(--tq-good)"
			>
				<Label
					x={narrow ? 480 : 326}
					y={narrow ? 150 : 586}
					text="It’s the {left[0].name}! Found in {plural(asked.length, 'question')}."
					size={narrow ? 34 : 19}
					weight={800}
					color="var(--tq-good)"
					halo={false}
				/>
			</Readout>
		{:else if stuck}
			<Readout
				id="bd-stuck"
				order={3}
				label="Stuck"
				value="no question tells these {left.length} apart: guess by name"
				color="var(--tq-bad)"
			>
				<Label
					x={326}
					y={586}
					text="No question on the list tells these {left.length} apart: click one to guess."
					size={15}
					weight={700}
					color="var(--tq-bad)"
					halo={false}
				/>
			</Readout>
		{:else if !narrow}
			<Readout id="bd-tip">
				<Label
					x={326}
					y={586}
					text="Click an animal to ask “Is it a …?”"
					size={14}
					muted
					halo={false}
				/>
			</Readout>
		{/if}
	{:else}
		<!-- how the first question splits the board -->
		{@const BX = 656}
		{@const BW = 288}
		<Readout
			id="bd-yes"
			order={2}
			label="If the answer is yes"
			value="{plural(yes, 'animal')} left"
		>
			<Label
				x={BX}
				y={120}
				text="If the answer is yes:"
				size={15}
				weight={600}
				anchor="start"
				halo={false}
			/>
			<rect x={BX} y={132} width={BW} height={40} rx="6" fill="var(--tq-gone)" opacity="0.5" />
			<rect
				x={BX}
				y={132}
				width={Math.max(4, (BW * yes * grow) / 99)}
				height={40}
				rx="6"
				fill="var(--tq-yes)"
			/>
			<Label
				x={BX}
				y={200}
				text="{plural(yes, 'animal')} left"
				size={20}
				weight={800}
				anchor="start"
				halo={false}
			/>
		</Readout>
		<Readout id="bd-no" order={3} label="If the answer is no" value="{plural(no, 'animal')} left">
			<Label
				x={BX}
				y={250}
				text="If the answer is no:"
				size={15}
				weight={600}
				anchor="start"
				halo={false}
			/>
			<rect x={BX} y={262} width={BW} height={40} rx="6" fill="var(--tq-gone)" opacity="0.5" />
			<rect
				x={BX}
				y={262}
				width={Math.max(4, (BW * no * grow) / 99)}
				height={40}
				rx="6"
				fill="var(--tq-no)"
			/>
			<Label
				x={BX}
				y={330}
				text="{plural(no, 'animal')} left"
				size={20}
				weight={800}
				anchor="start"
				halo={false}
			/>
		</Readout>
		<Readout id="bd-verdict" order={4} label="So" value={verdict}>
			{#each wrap(verdict, 30) as line, i (i)}
				<Label
					x={BX}
					y={384 + i * 22}
					text={line}
					size={16}
					weight={700}
					anchor="start"
					halo={false}
				/>
			{/each}
		</Readout>
	{/if}
</g>
