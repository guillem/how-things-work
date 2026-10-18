<script lang="ts">
	/**
	 * One round of speculative decoding, from a real run of the page's models.
	 *
	 * Modes (`step.hints.mode`):
	 *   plain — no draft: the target writes the window one character per pass (the strip fills
	 *           at 3 characters a second, the bars show its p for the character being written).
	 *   round — the round chosen by the Round control: the draft's guesses appear one after
	 *           another, the target's one pass lights up the k + 1 positions, then each guess is
	 *           checked in turn (kept, or turned down and the rest thrown away) and the target's
	 *           character is added. The bars compare p and q at the guess being checked; once the
	 *           round is over they settle on the step's focus (`hints.focus`: the first guess for
	 *           `draft`, a guess the draft overrated but that was kept for `accept`, the rejected
	 *           guess with its leftover for `reject`, the bonus for `bonus`).
	 *
	 * Motion: the round replays on a loop (about 4 s of hold at the end); reduced motion shows the
	 * finished round. Entering a step with `hints.round` moves the Round control there.
	 */
	import { untrack } from 'svelte';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { chars, PROMPT } from '../models';
	import { runOf } from '../results';
	import { draftOf, kOf, seedOf } from '../steps';
	import { residual } from '../speculate';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'round') as 'plain' | 'round');
	const focus = $derived(
		String(step.hints?.focus ?? 'accept') as 'draft' | 'accept' | 'reject' | 'bonus'
	);
	const hintRound = $derived(step.hints?.round as number | undefined);
	const stepId = $derived(step.id);
	$effect(() => {
		void stepId;
		const r = hintRound;
		if (r !== undefined) untrack(() => setParam('round', r));
	});

	const seed = $derived(seedOf(params));
	const k = $derived(mode === 'plain' ? 0 : kOf(params));
	const run = $derived(runOf(mode === 'plain' ? 'small' : draftOf(params), k, seed));
	const nRounds = $derived(run.rounds.length);

	// ---- time --------------------------------------------------------------------------------
	const PLAIN_RATE = 3;
	const PLAIN_HOLD = 4;
	const GUESS_DT = 0.4;
	const CHECK_DT = 1.3;
	const HOLD = 4;

	const roundIdx = $derived.by(() => {
		if (mode === 'plain') {
			if (reduced) return nRounds - 1;
			const u = t % (nRounds / PLAIN_RATE + PLAIN_HOLD);
			return clamp(Math.floor(u * PLAIN_RATE), 0, nRounds - 1);
		}
		return clamp(Math.round(Number(params.round ?? 1)), 1, nRounds) - 1;
	});
	const r = $derived(run.rounds[roundIdx]);
	const kk = $derived(r.drafted.length);
	const nChecked = $derived(r.checked.length);

	// timeline of a round (seconds)
	const tPass = $derived(0.3 + GUESS_DT * kk + 0.2);
	const tCheck = $derived(tPass + 1.1);
	const tExtra = $derived(tCheck + CHECK_DT * nChecked);
	const period = $derived(tExtra + 0.8 + HOLD);
	const u = $derived(mode === 'plain' || reduced ? Infinity : t % period);

	/** Guesses shown so far, checks done so far, and whether the extra character is in. */
	const shownGuesses = $derived(
		u === Infinity ? kk : clamp(Math.floor((u - 0.3) / GUESS_DT) + 1, 0, kk)
	);
	const passOn = $derived(u === Infinity ? 1 : smoothstep(tPass, tPass + 0.5, u));
	const passFlash = $derived(
		u === Infinity
			? 0
			: smoothstep(tPass, tPass + 0.3, u) * (1 - smoothstep(tPass + 0.6, tPass + 1.1, u))
	);
	const checksDone = $derived(
		u === Infinity ? nChecked : clamp(Math.floor((u - tCheck) / CHECK_DT) + 1, 0, nChecked)
	);
	const extraOn = $derived(u === Infinity ? 1 : smoothstep(tExtra, tExtra + 0.4, u));
	const finished = $derived(u === Infinity || u >= tExtra + 0.4);

	// ---- what the bars show --------------------------------------------------------------------
	/** Index of the guess the bars show, or -1 for the bonus distribution. */
	const panel = $derived.by(() => {
		if (mode === 'plain') return -1;
		if (focus === 'draft') return 0;
		if (!finished) {
			if (checksDone === 0) return 0;
			return checksDone - 1;
		}
		if (focus === 'accept') {
			const i = r.checked.findIndex((g) => g.accepted && g.q[g.token] > g.p[g.token]);
			if (i >= 0) return i;
			const j = r.checked.findIndex((g) => g.accepted);
			return j >= 0 ? j : 0;
		}
		if (r.kind === 'bonus') return focus === 'bonus' ? -1 : Math.max(0, nChecked - 1);
		return nChecked - 1;
	});
	const g = $derived(panel >= 0 ? r.checked[panel] : null);
	const p = $derived(g ? g.p : r.from);
	const q = $derived(g ? g.q : null);
	const isRejected = $derived(g !== null && !g.accepted);
	const checkedNow = $derived(g !== null && (finished || panel < checksDone));
	const showLeft = $derived(isRejected && checkedNow && extraOn > 0);
	const left = $derived(isRejected && g ? residual(g.p, g.q) : null);

	/** Characters on the chart: the likeliest under p or q, the guess and the extra always in. */
	const shown = $derived.by(() => {
		const score = (v: number) => Math.max(p[v], q ? q[v] : 0);
		const must: number[] = [];
		if (g) must.push(g.token);
		if ((panel === -1 || isRejected) && !must.includes(r.extra)) must.push(r.extra);
		const idx = Array.from({ length: p.length }, (_, v) => v)
			.filter((v) => score(v) > 0.004 && !must.includes(v))
			.sort((a, b) => score(b) - score(a))
			.slice(0, 10 - must.length);
		return [...idx, ...must].sort((a, b) => p[b] - p[a] || (q ? q[b] - q[a] : 0));
	});

	// ---- text -------------------------------------------------------------------------------
	const show = (v: number) => (chars[v] === '\n' ? '↵' : chars[v] === ' ' ? '·' : chars[v]);
	const quoted = (v: number) =>
		chars[v] === '\n' ? '↵' : chars[v] === ' ' ? 'space' : `“${chars[v]}”`;
	const f2 = (v: number) => (v < 0.0005 && v > 0 ? '<0.001' : v.toFixed(3));
	const promptCodes = Array.from(PROMPT).map((c) => chars.indexOf(c));
	const written = $derived(run.tokens.slice(0, r.start - PROMPT.length));
	const before = $derived([...promptCodes, ...written]);
	const passesSoFar = $derived(roundIdx + (mode === 'plain' || extraOn > 0.5 ? 1 : 0));
	const charsSoFar = $derived(
		written.length + (extraOn > 0.5 ? r.checked.filter((x) => x.accepted).length + 1 : 0)
	);
	const keptN = $derived(r.checked.filter((x) => x.accepted).length);

	// ---- layout -------------------------------------------------------------------------------
	const SX = 24;
	const CW = 12.6;
	const STRIP_Y = 54;
	const COL_X = 168;
	const COL_W = 70;
	const BOX = 46;
	const TABLE_Y = 112;
	const colX = (i: number) => COL_X + i * COL_W;
	const CH_X0 = 90;
	const CH_X1 = 640;
	const CH_Y0 = 520;
	const CH_Y1 = 286;
	const pMax = $derived(Math.max(0.05, ...shown.map((v) => Math.max(p[v], q ? q[v] : 0))));
	const yOf = (v: number) => CH_Y0 - ((CH_Y0 - CH_Y1) * v) / pMax;
	const slot = $derived((CH_X1 - CH_X0) / Math.max(shown.length, 1));
	const slotX = (i: number) => CH_X0 + slot * (i + 0.5);
	const ratio = $derived(g ? Math.min(1, g.p[g.token] / g.q[g.token]) : 1);
	const GAUGE_X = 900;
	const GAUGE_Y0 = 520;
	const GAUGE_H = 180;

	/** State of guess i in the table: pending, kept, rejected or discarded. */
	function state(i: number): 'pending' | 'kept' | 'rejected' | 'discarded' | 'hidden' {
		if (i >= shownGuesses) return 'hidden';
		if (i >= nChecked) return finished || checksDone >= nChecked ? 'discarded' : 'pending';
		if (i >= checksDone) return 'pending';
		return r.checked[i].accepted ? 'kept' : 'rejected';
	}
	const fillOf = {
		pending: 'var(--sd-chip)',
		kept: 'var(--sd-kept)',
		rejected: 'var(--sd-reject)',
		discarded: 'var(--sd-chip)',
		hidden: 'none'
	};
</script>

<g>
	<!-- title and counters -->
	<Readout
		id="title"
		order={0}
		label={mode === 'plain' ? 'Plain decoding' : `Round ${roundIdx + 1} of ${nRounds}`}
		value={mode === 'plain'
			? `${charsSoFar + 1} characters, ${passesSoFar} target passes`
			: `${keptN} of ${kk} guesses kept, ${keptN + 1} characters for 1 pass`}
	>
		<Label
			x={SX}
			y={30}
			anchor="start"
			size={14}
			weight={700}
			text={mode === 'plain'
				? 'Plain decoding: one target pass per character'
				: `Round ${roundIdx + 1} of ${nRounds} · ${kk} guess${kk === 1 ? '' : 'es'} · one target pass`}
		/>
		<Label
			x={936}
			y={30}
			anchor="end"
			size={13}
			tabular
			text={mode === 'plain'
				? `${written.length + 1} characters, ${passesSoFar} passes`
				: `so far: ${charsSoFar} characters in ${passesSoFar} pass${passesSoFar === 1 ? '' : 'es'}`}
		/>
	</Readout>

	<!-- the text so far -->
	<rect
		x={SX - 4}
		y={STRIP_Y - 18}
		width={65 * CW + 8}
		height="26"
		rx="4"
		fill="var(--sd-chip)"
		stroke="var(--border)"
	/>
	{#each before as c, i (i)}
		<text
			x={SX + i * CW + CW / 2}
			y={STRIP_Y}
			text-anchor="middle"
			font-family="ui-monospace, monospace"
			font-size="13"
			fill={i < PROMPT.length ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}>{show(c)}</text
		>
	{/each}
	{#if mode === 'round'}
		{#each r.drafted as c, i (i)}
			{@const s = state(i)}
			{#if s !== 'hidden' && s !== 'discarded' && !(s === 'rejected' && extraOn > 0.5)}
				<text
					x={SX + (before.length + i) * CW + CW / 2}
					y={STRIP_Y}
					text-anchor="middle"
					font-family="ui-monospace, monospace"
					font-size="13"
					font-weight="700"
					fill={s === 'kept'
						? 'var(--sd-kept)'
						: s === 'rejected'
							? 'var(--sd-reject)'
							: 'var(--sd-draft)'}>{show(c)}</text
				>
			{/if}
		{/each}
	{/if}
	{#if extraOn > 0}
		<text
			x={SX + (before.length + (mode === 'plain' ? 0 : keptN)) * CW + CW / 2}
			y={STRIP_Y}
			text-anchor="middle"
			font-family="ui-monospace, monospace"
			font-size="13"
			font-weight="700"
			opacity={extraOn}
			fill="var(--sd-left)">{show(r.extra)}</text
		>
	{/if}

	<!-- the round: last character written, the guesses, the target's character -->
	<Readout id="rowlabels">
		{#if mode === 'round'}
			<Label x={COL_X - 34} y={TABLE_Y + 28} anchor="end" size={12} text="draft’s guesses" />
			<Label
				x={COL_X - 34}
				y={TABLE_Y + 72}
				anchor="end"
				size={11}
				muted
				text="q (draft), p (target)"
			/>
		{/if}
	</Readout>
	<!-- one pass of the target over the last character and the guesses -->
	<rect
		x={colX(0) - 8}
		y={TABLE_Y - 14}
		width={(kk + 1) * COL_W - COL_W + BOX + 16}
		height={BOX + 22}
		rx="8"
		fill="var(--sd-target)"
		opacity={0.08 + 0.1 * passOn + 0.25 * passFlash}
		stroke="var(--sd-target)"
		stroke-opacity={0.3 + 0.5 * passOn}
	/>
	<Readout id="passlabel">
		<Label
			x={colX(0) - 4}
			y={TABLE_Y - 20}
			anchor="start"
			size={11}
			color="var(--sd-target)"
			opacity={0.4 + 0.6 * passOn}
			text="one target pass over {kk + 1} position{kk === 0 ? '' : 's'}"
		/>
	</Readout>
	<rect
		x={colX(0)}
		y={TABLE_Y}
		width={BOX}
		height={BOX}
		rx="6"
		fill="var(--sd-chip)"
		stroke="var(--border)"
	/>
	<text
		x={colX(0) + BOX / 2}
		y={TABLE_Y + 31}
		text-anchor="middle"
		font-family="ui-monospace, monospace"
		font-size="22"
		fill="var(--stage-ink-muted)">{show(before[before.length - 1])}</text
	>
	<Readout id="lastlabel">
		<Label x={colX(0) + BOX / 2} y={TABLE_Y + 66} size={11} muted text="last written" />
	</Readout>

	{#if mode === 'round'}
		{#each r.drafted as c, i (i)}
			{@const s = state(i)}
			{@const x = colX(i + 1)}
			{#if s !== 'hidden'}
				<g opacity={s === 'discarded' ? 0.35 : 1}>
					<rect
						{x}
						y={TABLE_Y}
						width={BOX}
						height={BOX}
						rx="6"
						fill={fillOf[s]}
						fill-opacity={s === 'kept' || s === 'rejected' ? 0.22 : 1}
						stroke={s === 'kept'
							? 'var(--sd-kept)'
							: s === 'rejected'
								? 'var(--sd-reject)'
								: 'var(--sd-draft)'}
						stroke-width={i === panel && !finished ? 2.5 : 1.5}
					/>
					<text
						x={x + BOX / 2}
						y={TABLE_Y + 31}
						text-anchor="middle"
						font-family="ui-monospace, monospace"
						font-size="22"
						font-weight="700"
						fill={s === 'rejected' ? 'var(--sd-reject)' : 'var(--stage-ink)'}>{show(c)}</text
					>
					{#if s === 'rejected' || s === 'discarded'}
						<line
							x1={x + 6}
							x2={x + BOX - 6}
							y1={TABLE_Y + BOX - 6}
							y2={TABLE_Y + 6}
							stroke={s === 'rejected' ? 'var(--sd-reject)' : 'var(--stage-ink-muted)'}
							stroke-width="2"
						/>
					{/if}
					{#if i < nChecked}
						{@const gi = r.checked[i]}
						<Readout id="g{i}">
							<Label
								x={x + BOX / 2}
								y={TABLE_Y + 66}
								size={11}
								color="var(--sd-draft)"
								tabular
								halo={false}
								text="q {f2(gi.q[gi.token])}"
							/>
							<Label
								x={x + BOX / 2}
								y={TABLE_Y + 81}
								size={11}
								color="var(--sd-target)"
								tabular
								halo={false}
								opacity={passOn}
								text="p {f2(gi.p[gi.token])}"
							/>
							{#if s === 'kept' || s === 'rejected'}
								<Label
									x={x + BOX / 2}
									y={TABLE_Y + 97}
									size={11}
									weight={700}
									halo={false}
									color={s === 'kept' ? 'var(--sd-kept)' : 'var(--sd-reject)'}
									text={s === 'kept' ? 'kept' : 'turned down'}
								/>
							{/if}
						</Readout>
					{:else if s === 'discarded'}
						<Readout id="g{i}">
							<Label x={x + BOX / 2} y={TABLE_Y + 66} size={11} muted halo={false} text="dropped" />
						</Readout>
					{/if}
				</g>
			{/if}
		{/each}
	{/if}

	<!-- the character the target adds -->
	{#if extraOn > 0}
		{@const x = colX(kk + 1) + (mode === 'plain' ? 0 : 10)}
		<g opacity={extraOn}>
			<rect
				{x}
				y={TABLE_Y}
				width={BOX}
				height={BOX}
				rx="6"
				fill="var(--sd-left)"
				fill-opacity="0.2"
				stroke="var(--sd-left)"
				stroke-width="2"
			/>
			<text
				x={x + BOX / 2}
				y={TABLE_Y + 31}
				text-anchor="middle"
				font-family="ui-monospace, monospace"
				font-size="22"
				font-weight="700"
				fill="var(--stage-ink)">{show(r.extra)}</text
			>
			<Readout
				id="extra"
				order={2}
				label={mode === 'plain'
					? 'Drawn from p'
					: r.kind === 'bonus'
						? 'Bonus character'
						: 'From the leftover'}
				value="{quoted(r.extra)}, probability {f2(r.from[r.extra])}"
				color="var(--sd-left)"
			>
				<Label
					x={x + BOX / 2}
					y={TABLE_Y + 66}
					size={11}
					weight={600}
					color="var(--sd-left)"
					halo={false}
					text={mode === 'plain'
						? 'drawn from p'
						: r.kind === 'bonus'
							? 'bonus, from p'
							: 'from leftover'}
				/>
				<Label
					x={x + BOX / 2}
					y={TABLE_Y + 81}
					size={11}
					color="var(--sd-left)"
					tabular
					halo={false}
					text={f2(r.from[r.extra])}
				/>
			</Readout>
		</g>
	{/if}

	<!-- p and q at one position -->
	<Readout
		id="charttitle"
		order={1}
		label="Bars"
		value={g
			? `guess ${panel + 1}, ${quoted(g.token)}: q ${f2(g.q[g.token])}, p ${f2(g.p[g.token])}`
			: mode === 'plain'
				? 'the target’s p for this character'
				: 'the target’s p after the last guess'}
	>
		<Label
			x={CH_X0 - 66}
			y={CH_Y1 - 30}
			anchor="start"
			size={13}
			weight={600}
			text={g
				? `Guess ${panel + 1}, ${quoted(g.token)}: the two models’ probabilities at this position`
				: mode === 'plain'
					? 'The target’s probabilities for the character being written'
					: 'The target’s probabilities after the last guess (its pass computed them anyway)'}
		/>
	</Readout>
	<line x1={CH_X0} x2={CH_X1} y1={CH_Y0} y2={CH_Y0} stroke="var(--stage-line)" />
	{#each [0, pMax / 2, pMax] as v (v)}
		<line
			x1={CH_X0}
			x2={CH_X1}
			y1={yOf(v)}
			y2={yOf(v)}
			stroke="var(--stage-grid)"
			stroke-dasharray={v === 0 ? undefined : '3 4'}
		/>
		<Readout id="yt{v}">
			<Label
				x={CH_X0 - 8}
				y={yOf(v) + 4}
				anchor="end"
				size={11}
				muted
				halo={false}
				text={v.toFixed(2)}
			/>
		</Readout>
	{/each}
	{#each shown as v, i (v)}
		{@const cx = slotX(i)}
		{@const isGuess = g !== null && v === g.token}
		{@const isExtra = v === r.extra && extraOn > 0.5 && (panel === -1 || showLeft)}
		{#if q}
			<rect
				x={cx - slot * 0.4}
				y={yOf(q[v])}
				width={slot * 0.8}
				height={CH_Y0 - yOf(q[v])}
				fill="var(--sd-draft)"
				fill-opacity="0.16"
				stroke="var(--sd-draft)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
		{/if}
		<rect
			x={cx - slot * 0.22}
			y={yOf(p[v])}
			width={slot * 0.44}
			height={CH_Y0 - yOf(p[v])}
			fill="var(--sd-target)"
			opacity={mode === 'plain' ? 0.85 : 0.25 + 0.6 * passOn}
		/>
		{#if showLeft && left && q && p[v] > q[v]}
			<!-- the leftover: the part of p above q -->
			<rect
				x={cx - slot * 0.22}
				y={yOf(p[v])}
				width={slot * 0.44}
				height={yOf(q[v]) - yOf(p[v])}
				fill="var(--sd-left)"
				opacity={extraOn}
			/>
		{/if}
		<text
			x={cx}
			y={CH_Y0 + 20}
			text-anchor="middle"
			font-family="ui-monospace, monospace"
			font-size={isGuess || isExtra ? 16 : 14}
			font-weight={isGuess || isExtra ? 700 : 400}
			fill={isGuess
				? isRejected && checkedNow
					? 'var(--sd-reject)'
					: 'var(--sd-draft)'
				: isExtra
					? 'var(--sd-left)'
					: 'var(--stage-ink)'}>{show(v)}</text
		>
		{#if isGuess || isExtra}
			<path
				d="M{cx - 6} {CH_Y0 + 36} L{cx} {CH_Y0 + 29} L{cx + 6} {CH_Y0 + 36}"
				fill="none"
				stroke={isGuess ? 'var(--sd-draft)' : 'var(--sd-left)'}
				stroke-width="2"
			/>
		{/if}
	{/each}
	<Readout
		id="legend"
		order={5}
		label="Key"
		value="filled: p (target) · dashed: q (draft) · violet: leftover"
	>
		<rect x={CH_X0} y={CH_Y0 + 46} width="12" height="12" fill="var(--sd-target)" />
		<Label
			x={CH_X0 + 18}
			y={CH_Y0 + 56}
			anchor="start"
			size={12}
			halo={false}
			text="p, the target"
		/>
		{#if q}
			<rect
				x={CH_X0 + 130}
				y={CH_Y0 + 46}
				width="12"
				height="12"
				fill="var(--sd-draft)"
				fill-opacity="0.16"
				stroke="var(--sd-draft)"
				stroke-dasharray="3 2"
			/>
			<Label
				x={CH_X0 + 148}
				y={CH_Y0 + 56}
				anchor="start"
				size={12}
				halo={false}
				text="q, the draft"
			/>
			<rect x={CH_X0 + 256} y={CH_Y0 + 46} width="12" height="12" fill="var(--sd-left)" />
			<Label
				x={CH_X0 + 274}
				y={CH_Y0 + 56}
				anchor="start"
				size={12}
				halo={false}
				text="leftover, max(0, p − q)"
			/>
		{/if}
	</Readout>

	<!-- the check -->
	{#if g}
		{@const done = checkedNow}
		<Readout id="card1"
			><rect
				x={680}
				y={276}
				width={264}
				height={262}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/></Readout
		>
		<Readout
			id="check"
			order={3}
			label="Check"
			value={`keep with chance min(1, p/q) = ${ratio.toFixed(2)}${done ? `; u = ${g.u.toFixed(2)}: ${g.accepted ? 'kept' : 'turned down'}` : ''}`}
			color={done ? (g.accepted ? 'var(--sd-kept)' : 'var(--sd-reject)') : undefined}
		>
			<Label
				x={696}
				y={302}
				anchor="start"
				size={13}
				weight={700}
				halo={false}
				text="The check of {quoted(g.token)}"
			/>
			<Label
				x={696}
				y={326}
				anchor="start"
				size={12}
				tabular
				halo={false}
				color="var(--sd-draft)"
				text="draft: q = {f2(g.q[g.token])}"
			/>
			<Label
				x={696}
				y={346}
				anchor="start"
				size={12}
				tabular
				halo={false}
				color="var(--sd-target)"
				text="target: p = {f2(g.p[g.token])}"
			/>
			<Label x={696} y={374} anchor="start" size={12} halo={false} text="kept with chance" />
			<Label
				x={696}
				y={392}
				anchor="start"
				size={12}
				tabular
				halo={false}
				weight={600}
				text="min(1, p/q) = {ratio.toFixed(2)}"
			/>
			{#if done}
				<Label
					x={696}
					y={422}
					anchor="start"
					size={12}
					tabular
					halo={false}
					text="random u = {g.u.toFixed(2)}"
				/>
				<Label
					x={696}
					y={446}
					anchor="start"
					size={14}
					weight={700}
					halo={false}
					color={g.accepted ? 'var(--sd-kept)' : 'var(--sd-reject)'}
					text={g.accepted
						? `u < ${ratio.toFixed(2)}: kept`
						: `u ≥ ${ratio.toFixed(2)}: turned down`}
				/>
				{#if !g.accepted && extraOn > 0.5}
					<Label
						x={696}
						y={474}
						anchor="start"
						size={12}
						halo={false}
						color="var(--sd-left)"
						text="drawn instead from the"
					/>
					<Label
						x={696}
						y={492}
						anchor="start"
						size={12}
						halo={false}
						color="var(--sd-left)"
						text="leftover: {quoted(r.extra)} ({f2(r.from[r.extra])})"
					/>
				{/if}
			{/if}
		</Readout>
		<!-- gauge: the green part is the chance of keeping; u lands in it or not -->
		<rect
			x={GAUGE_X}
			y={GAUGE_Y0 - GAUGE_H}
			width="22"
			height={GAUGE_H}
			rx="3"
			fill="var(--sd-reject)"
			fill-opacity="0.25"
		/>
		<rect
			x={GAUGE_X}
			y={GAUGE_Y0 - GAUGE_H * ratio}
			width="22"
			height={GAUGE_H * ratio}
			rx="3"
			fill="var(--sd-kept)"
			fill-opacity="0.6"
		/>
		<Readout id="gauge">
			<Label x={GAUGE_X + 11} y={GAUGE_Y0 + 14} size={10} muted halo={false} text="0" />
			<Label x={GAUGE_X + 11} y={GAUGE_Y0 - GAUGE_H - 6} size={10} muted halo={false} text="1" />
		</Readout>
		{#if done}
			<line
				x1={GAUGE_X - 6}
				x2={GAUGE_X + 28}
				y1={GAUGE_Y0 - GAUGE_H * g.u}
				y2={GAUGE_Y0 - GAUGE_H * g.u}
				stroke="var(--stage-ink)"
				stroke-width="2.5"
			/>
			<Readout id="ulabel">
				<Label
					x={GAUGE_X - 8}
					y={GAUGE_Y0 - GAUGE_H * g.u + 4}
					anchor="end"
					size={11}
					weight={600}
					text="u"
				/>
			</Readout>
		{/if}
	{:else}
		<Readout id="card2"
			><rect
				x={680}
				y={276}
				width={264}
				height={150}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/></Readout
		>
		<Readout
			id="bonuscard"
			order={3}
			label={mode === 'plain' ? 'One pass' : 'All guesses kept'}
			value={mode === 'plain'
				? 'one character drawn from p'
				: `${kk} kept + 1 drawn from p = ${kk + 1} characters`}
		>
			<Label
				x={696}
				y={302}
				anchor="start"
				size={13}
				weight={700}
				halo={false}
				text={mode === 'plain' ? 'One pass, one character' : 'Every guess was kept'}
			/>
			<Label
				x={696}
				y={328}
				anchor="start"
				size={12}
				halo={false}
				text={mode === 'plain' ? 'the target reads the last' : 'the pass already gave p after'}
			/>
			<Label
				x={696}
				y={346}
				anchor="start"
				size={12}
				halo={false}
				text={mode === 'plain'
					? 'character and draws the next'
					: 'the last guess: one more from it'}
			/>
			{#if extraOn > 0.5}
				<Label
					x={696}
					y={378}
					anchor="start"
					size={14}
					weight={700}
					halo={false}
					color="var(--sd-left)"
					text="drew {quoted(r.extra)} ({f2(r.from[r.extra])})"
				/>
				{#if mode === 'round'}
					<Label
						x={696}
						y={402}
						anchor="start"
						size={12}
						halo={false}
						text="{kk + 1} characters for one pass"
					/>
				{/if}
			{/if}
		</Readout>
	{/if}

	<!-- totals of the whole run -->
	{#if mode === 'round'}
		<Readout
			id="total"
			order={4}
			label="Whole text"
			value="{run.tokens.length} characters in {nRounds} passes ({(
				run.tokens.length / nRounds
			).toFixed(1)} per pass)"
		>
			<Label
				x={936}
				y={590}
				anchor="end"
				size={12}
				muted
				tabular
				text="whole text: {run.tokens.length} characters in {nRounds} passes ({(
					run.tokens.length / nRounds
				).toFixed(1)} per pass)"
			/>
		</Readout>
	{/if}
</g>
