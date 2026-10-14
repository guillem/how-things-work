<script lang="ts">
	/**
	 * One Turing machine at work: the tape and head at the top, the rule table
	 * below (rows: states, columns: the symbol read), with the rule being
	 * applied highlighted. On the editor step, the table is typed in a textarea
	 * (in a `foreignObject`) and the starting tape in a text box above it; their
	 * key presses are kept from the explainer's shortcuts.
	 *
	 * The run is recorded once (`run`) whenever the table or the tape changes; a
	 * frame shows the machine at position `k` (in steps, from `createPlayback`,
	 * shared with the sorting and CPU explainers). Step ⌊k⌋ + 1 is under way with
	 * progress `u`: first the rule lights up (the symbol has been read), then
	 * the new symbol is written, then the head moves and the state changes.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { createPlayback } from '#lib/explainer/playback.ts';
	import {
		INCREMENT_SOURCE,
		MAX_STEPS,
		PALINDROME_SOURCE,
		parseMachine,
		run,
		symbolAt,
		tapeText,
		type Machine
	} from '../turing';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const BEAVER_SOURCE = `# the two-state busy beaver: 6 steps from a blank tape
A _ -> 1 R B
A 1 -> 1 L B
B _ -> 1 L A
B 1 -> 1 R H`;
	const EXAMPLES: Record<string, { name: string; source: string; tape: string }> = {
		increment: { name: 'Add one', source: INCREMENT_SOURCE, tape: '1011' },
		palindrome: { name: 'Palindrome check', source: PALINDROME_SOURCE, tape: '0110' },
		beaver: { name: 'Two-state busy beaver', source: BEAVER_SOURCE, tape: '' }
	};

	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const edit = $derived(Boolean(step.hints?.edit));
	const intro = $derived(Boolean(step.hints?.intro));
	const program = $derived(String(step.hints?.program ?? 'increment'));
	const playing = $derived(!offered.has('play') || params.play !== false);
	const pace = $derived(intro ? 1.2 : offered.has('pace') ? Number(params.pace) : 2);

	// ---- the machine and its tape --------------------------------------------------
	const example = $derived(String(params.example ?? 'increment'));
	const source = $derived.by(() => {
		if (edit)
			return typeof params.source === 'string'
				? params.source
				: (EXAMPLES[example] ?? EXAMPLES.increment).source;
		return program === 'palindrome' ? PALINDROME_SOURCE : INCREMENT_SOURCE;
	});
	const input = $derived.by(() => {
		if (edit)
			return (
				typeof params.tape === 'string'
					? params.tape
					: (EXAMPLES[example] ?? EXAMPLES.increment).tape
			).replace(/\s/g, '_');
		if (program === 'palindrome') return String(params.palInput ?? '0110');
		return intro ? '1011' : String(params.incInput ?? '1011');
	});
	// Loading an example replaces the editor's text and tape (only when the choice changes);
	// "Reset" puts them back even if the example is the one already chosen.
	let lastExample: string | undefined;
	let lastReload: number | undefined;
	$effect(() => {
		const ex = example;
		const n = Number(params.reload ?? 0);
		untrack(() => {
			if (
				(lastExample !== undefined && ex !== lastExample) ||
				(lastReload !== undefined && n !== lastReload)
			) {
				const e = EXAMPLES[ex] ?? EXAMPLES.increment;
				setParam('source', e.source);
				setParam('tape', e.tape);
			}
			lastExample = ex;
			lastReload = n;
		});
	});

	const parsed = $derived(parseMachine(source));
	const m = $derived<Machine | null>(parsed.ok ? parsed.machine : null);
	const rec = $derived(m ? run(m, input, MAX_STEPS) : null);
	const total = $derived(rec ? rec.steps : 0);
	const title = $derived(
		edit
			? (/^\s*#\s*(.+)$/m.exec(source.split('\n')[0] ?? '')?.[1] ?? 'Your machine')
			: program === 'palindrome'
				? 'Palindrome check'
				: 'Add one'
	);
	const runKey = $derived(`tape|${source}|${input}|${Number(params.rewind ?? 0)}`);

	// ---- playback (as in the sorting and CPU explainers) ------------------------------
	const position = createPlayback(0.5);
	const manual = $derived(params.positionKey === runKey ? Number(params.position ?? 0) : 0);
	let lastK = 0;
	const k = $derived.by(() => {
		const v = reduced
			? playing
				? total
				: clamp(manual, 0, total)
			: position(t, { key: runKey, playing, pace, manual, total });
		if (playing) lastK = v;
		return v;
	});
	let wasPlaying = false;
	$effect(() => {
		const now = playing;
		untrack(() => {
			if (!now && wasPlaying) setPosition(Math.floor(lastK));
			wasPlaying = now;
		});
	});
	function setPosition(v: number) {
		setParam('positionKey', runKey);
		setParam('position', clamp(Math.round(v), 0, total));
	}
	function scrubTo(v: number) {
		lastK = clamp(Math.round(v), 0, total);
		if (playing) setParam('play', false);
		setPosition(v);
	}
	let lastTick: number | undefined;
	$effect(() => {
		const n = Number(params.tick ?? 0);
		untrack(() => {
			if (lastTick !== undefined && n !== lastTick) {
				const base = playing ? Math.floor(lastK) : Math.round(manual);
				scrubTo(base + 1);
			}
			lastTick = n;
		});
	});

	// ---- the frame -----------------------------------------------------------------------
	const index = $derived(Math.min(total, Math.floor(k)));
	const u = $derived(index >= total ? 0 : k - index);
	const blank = '_';
	const frame = $derived(rec?.frames[index]);
	const nextFrame = $derived(rec?.frames[Math.min(total, index + 1)]);
	const applied = $derived(index < total ? rec?.applied[index] : undefined);
	const ease = (x: number) => x * x * (3 - 2 * x);
	// Phases of a step: read (rule lights up), write, move.
	const written = $derived(u > 0.4);
	const moveU = $derived(ease(clamp((u - 0.55) / 0.4)));
	const headPos = $derived(
		frame && nextFrame ? frame.head + (nextFrame.head - frame.head) * moveU : 0
	);
	const stateNow = $derived(frame ? (u > 0.85 && nextFrame ? nextFrame.state : frame.state) : '');
	const done = $derived(index >= total);
	/** The tape as text for the phone panel, the cell under the head in brackets. */
	const tapeShown = $derived.by(() => {
		if (!frame) return '';
		const h = Math.round(headPos);
		let lo = Math.min(h, frame.origin);
		let hi = Math.max(h, frame.origin + frame.cells.length - 1);
		while (lo < h && symbolAt(frame, lo, blank) === blank) lo++;
		while (hi > h && symbolAt(frame, hi, blank) === blank) hi--;
		let out = '';
		for (let i = lo; i <= hi; i++) {
			const c =
				applied && i === frame.head && written ? applied.rule.write : symbolAt(frame, i, blank);
			out += i === h ? `[${c}]` : c;
		}
		return `${out} · state ${stateNow}`;
	});
	/** Steps finished; the one under way counts once it is half done. */
	const taken = $derived(Math.min(total, index + (u > 0.5 ? 1 : 0)));

	// ---- the tape window -------------------------------------------------------------------
	const CW = 46;
	const MAXC = 18;
	const TAPE_Y = 132;
	const CH = 50;
	const extent = $derived.by(() => {
		if (!rec) return { lo: 0, hi: Math.max(0, input.length - 1) };
		let lo = 0;
		let hi = Math.max(0, input.length - 1);
		for (const f of rec.frames) {
			lo = Math.min(lo, f.origin, f.head);
			hi = Math.max(hi, f.origin + f.cells.length - 1, f.head);
		}
		return { lo: lo - 1, hi: hi + 1 };
	});
	const fits = $derived(extent.hi - extent.lo + 1 <= MAXC);
	/** Cell at the centre of the window. */
	const camera = $derived(
		fits
			? (extent.lo + extent.hi) / 2
			: clamp(headPos, extent.lo + MAXC / 2 - 0.5, extent.hi - MAXC / 2 + 0.5)
	);
	const xOf = (cell: number) => 480 + (cell - camera) * CW;
	const cells = $derived.by(() => {
		if (!frame) return [];
		const out: { i: number; sym: string; x: number; fresh: boolean; fade: number }[] = [];
		const from = Math.floor(camera - MAXC / 2) - 1;
		for (let i = from; i <= from + MAXC + 2; i++) {
			let sym = symbolAt(frame, i, blank);
			const fresh = !!applied && i === frame.head && written;
			if (fresh && applied) sym = applied.rule.write;
			const x = xOf(i);
			// Fade the cells at the edges of the window: the tape goes on.
			const fade = clamp(Math.min(x - 16, 944 - x) / 60);
			out.push({ i, sym, x, fresh, fade });
		}
		return out;
	});
	const headX = $derived(xOf(headPos));

	// ---- the rule table -----------------------------------------------------------------------
	const TX = $derived(edit ? 344 : 160);
	const TW = $derived(edit ? 600 : 640);
	const TY = 292;
	const states = $derived(m?.states ?? []);
	const symbols = $derived(m?.symbols ?? []);
	const rowH = $derived(Math.min(34, 216 / Math.max(1, states.length + 1)));
	const stateW = 110;
	const colW = $derived((TW - stateW) / Math.max(1, symbols.length));
	/** States that are reached but have no rules: they halt. */
	const haltStates = $derived.by(() => {
		if (!m) return [];
		const s: string[] = [];
		for (const st of m.states)
			for (const r of Object.values(m.rules[st]))
				if (r && !m.rules[r.next] && !s.includes(r.next)) s.push(r.next);
		return s;
	});
	const active = $derived(applied && !done ? { state: applied.state, read: applied.read } : null);
	const symName = (s: string) => (s === blank ? 'blank' : s);

	// ---- words --------------------------------------------------------------------------------
	const status = $derived.by(() => {
		if (!rec || !frame || !m) return '';
		if (done) {
			if (rec.stop === 'limit')
				return `Stopped by this page after ${MAX_STEPS} steps: it may never halt`;
			const out = tapeText(frame, blank);
			const plural = total === 1 ? '' : 's';
			if (!edit && program === 'increment')
				return `Halted in ${frame.state} after ${total} steps: ${input} + 1 = ${out}`;
			if (!edit && program === 'palindrome')
				return `Halted in ${frame.state} after ${total} steps: ${input} ${frame.state === 'yes' ? 'is' : 'is not'} a palindrome`;
			return `Halted in ${frame.state} after ${total} step${plural} (no rule for reading ${symName(symbolAt(frame, frame.head, blank))}). Tape: ${out || 'blank'}`;
		}
		if (!applied) return '';
		const r = applied.rule;
		if (u === 0)
			return `After ${index} step${index === 1 ? '' : 's'}: in ${frame.state}, reading ${symName(applied.read)}`;
		return `Step ${index + 1}: in ${applied.state} reading ${symName(applied.read)} → write ${symName(r.write)}, move ${r.move}, ${r.next === applied.state ? `stay in ${r.next}` : `go to ${r.next}`}`;
	});
	const statusColor = $derived(
		done && rec
			? rec.stop === 'limit'
				? 'var(--tm-loop)'
				: frame?.state === 'no'
					? 'var(--tm-no)'
					: 'var(--tm-halt)'
			: undefined
	);

	// ---- timeline ---------------------------------------------------------------------------------
	const TL0 = $derived(edit ? 380 : 120);
	const TL1 = $derived(edit ? 900 : 840);
	const TLY = 556;
	const tlx = $derived(TL0 + (TL1 - TL0) * (total ? Math.min(k, total) / total : 0));
	function onmove(p: Point) {
		scrubTo(((p.x - TL0) / (TL1 - TL0)) * total);
	}
	function onkey(s: number | 'start' | 'end') {
		if (s === 'start' || s === 'end') return scrubTo(s === 'start' ? 0 : total);
		const base = playing ? Math.round(lastK) : Math.round(manual);
		scrubTo(base + s);
	}

	// ---- editor ---------------------------------------------------------------------------------------
	const ED = { x: 16, y: 292, w: 308, h: 290 };
	const errors = $derived(parsed.ok ? [] : parsed.errors);

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fadeIn}>
	<!-- header -->
	<Readout id="title" order={1} label={title} value={status} color={statusColor}>
		<Txt x={16 + 8} y={42} text={title} size={18} weight={600} />
		<Txt x={24} y={68} text={status} size={14} color={statusColor} />
	</Readout>
	<Readout id="steps" order={2} label="Steps taken" value={String(taken)}>
		<Txt
			x={936}
			y={42}
			text="steps taken: {taken}"
			size={16}
			weight={600}
			anchor="end"
			color="var(--tm-head)"
		/>
	</Readout>

	<!-- tape -->
	{#if frame}
		{#each cells as c (c.i)}
			<g opacity={c.fade}>
				<rect
					x={c.x - CW / 2 + 2}
					y={TAPE_Y}
					width={CW - 4}
					height={CH}
					rx="6"
					fill={c.fresh ? 'var(--tm-write)' : 'var(--tm-cell)'}
					fill-opacity={c.fresh ? 0.22 : 1}
					stroke={c.fresh ? 'var(--tm-write)' : 'var(--tm-cell-edge)'}
					stroke-width={c.fresh ? 2 : 1}
				/>
				{#if c.sym !== blank}
					<Txt
						x={c.x}
						y={TAPE_Y + CH / 2 + 8}
						text={c.sym}
						size={22}
						weight={600}
						anchor="middle"
						halo={false}
						mono
					/>
				{/if}
			</g>
		{/each}
		<!-- the head: a frame round its cell, an arrow and the state -->
		<rect
			x={headX - CW / 2 - 1}
			y={TAPE_Y - 3}
			width={CW + 2}
			height={CH + 6}
			rx="8"
			fill="none"
			stroke="var(--tm-head)"
			stroke-width="3"
		/>
		<path
			d="M{headX - 9} {TAPE_Y - 22} L{headX + 9} {TAPE_Y - 22} L{headX} {TAPE_Y - 8} Z"
			fill="var(--tm-head)"
		/>
		<Readout
			id="state"
			order={3}
			label="Tape (head in brackets)"
			value={tapeShown}
			color="var(--tm-head)"
		>
			<Txt
				x={clamp(headX, 60, 900)}
				y={TAPE_Y - 30}
				text="state: {stateNow}"
				size={14}
				weight={600}
				anchor="middle"
				color="var(--tm-head)"
			/>
		</Readout>
		<Readout id="tape-note">
			<Txt
				x={480}
				y={TAPE_Y + CH + 24}
				text={edit
					? ''
					: fits
						? 'the tape goes on, blank, in both directions'
						: 'the tape goes on in both directions: the window follows the head'}
				size={11}
				anchor="middle"
				muted
			/>
		</Readout>
	{/if}

	<!-- rule table -->
	{#if m}
		<Txt x={TX} y={TY - 20} text="Rule table: write, move, next state" size={13} weight={600} />
		<rect
			x={TX - 6}
			y={TY - 6}
			width={TW + 12}
			height={rowH * (states.length + 1) + 12}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Txt x={TX + 8} y={TY + rowH * 0.65} text="state" size={12} muted halo={false} />
		{#each symbols as s, j (s)}
			<Txt
				x={TX + stateW + colW * (j + 0.5)}
				y={TY + rowH * 0.65}
				text="reads {s === blank ? '_ (blank)' : s}"
				size={12}
				anchor="middle"
				muted
				halo={false}
			/>
		{/each}
		{#each states as st, i (st)}
			{@const y = TY + rowH * (i + 1)}
			<line x1={TX} x2={TX + TW} y1={y} y2={y} stroke="var(--border)" stroke-width="1" />
			<Txt
				x={TX + 8}
				y={y + rowH * 0.66}
				text={st}
				size={13}
				weight={st === stateNow && !done ? 700 : 500}
				color={st === stateNow && !done ? 'var(--tm-head)' : undefined}
				halo={false}
				mono
			/>
			{#each symbols as s, j (s)}
				{@const r = m.rules[st][s]}
				{@const on = active?.state === st && active.read === s}
				{#if on}
					<rect
						x={TX + stateW + colW * j + 3}
						y={y + 2}
						width={colW - 6}
						height={rowH - 4}
						rx="6"
						fill="var(--tm-rule)"
						opacity="0.22"
					/>
					<rect
						x={TX + stateW + colW * j + 3}
						y={y + 2}
						width={colW - 6}
						height={rowH - 4}
						rx="6"
						fill="none"
						stroke="var(--tm-rule)"
						stroke-width="2"
					/>
				{/if}
				<Txt
					x={TX + stateW + colW * (j + 0.5)}
					y={y + rowH * 0.66}
					text={r ? `${r.write} ${r.move} ${r.next}` : '—  halt'}
					size={13}
					weight={on ? 700 : 500}
					anchor="middle"
					muted={!r}
					halo={false}
					mono
				/>
			{/each}
		{/each}
		<Readout id="halts">
			<Txt
				x={TX + TW}
				y={TY - 20}
				text="{haltStates.length
					? `${haltStates.join(', ')}: no rules, halts`
					: ''}{haltStates.length ? ' · ' : ''}—: no rule, halt"
				size={12}
				anchor="end"
				muted
			/>
		</Readout>
		{#if active && applied}
			<Readout
				id="rule"
				order={4}
				label="Rule"
				value="{applied.state}, reads {symName(applied.read)} → {symName(
					applied.rule.write
				)} {applied.rule.move} {applied.rule.next}"
				color="var(--tm-rule)"
			/>
		{/if}
	{:else if edit}
		<Txt
			x={TX}
			y={TY - 20}
			text="The table has mistakes:"
			size={13}
			weight={600}
			color="var(--tm-no)"
		/>
		{#each errors.slice(0, 6) as err, i (i)}
			<Txt
				x={TX}
				y={TY + 8 + i * 22}
				text="Line {err.line}: {err.message}"
				size={13}
				color="var(--tm-no)"
			/>
		{/each}
		<Readout
			id="errors"
			order={4}
			label="Mistakes"
			value={errors.map((e) => `line ${e.line}: ${e.message}`).join('; ')}
			color="var(--tm-no)"
		/>
	{/if}

	<!-- editor -->
	{#if edit}
		<Txt
			x={ED.x + 2}
			y={TAPE_Y + CH + 34}
			text="Starting tape (_ or a space is a blank):"
			size={12}
			muted
		/>
		<foreignObject x={ED.x} y={TAPE_Y + CH + 42} width={ED.w} height={32}>
			<input
				class="tm-input"
				aria-label="Starting tape"
				spellcheck="false"
				autocomplete="off"
				value={typeof params.tape === 'string'
					? params.tape
					: (EXAMPLES[example] ?? EXAMPLES.increment).tape}
				oninput={(e) => setParam('tape', e.currentTarget.value)}
				onkeydown={(e) => e.stopPropagation()}
			/>
		</foreignObject>
		<Txt x={ED.x + 2} y={ED.y - 20} text="Rules: state symbol -> write move next" size={12} muted />
		<rect
			x={ED.x}
			y={ED.y}
			width={ED.w}
			height={ED.h}
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<foreignObject x={ED.x} y={ED.y} width={ED.w} height={ED.h}>
			<textarea
				class="tm-editor"
				aria-label="Rule table"
				spellcheck="false"
				autocomplete="off"
				wrap="off"
				value={source}
				oninput={(e) => setParam('source', e.currentTarget.value)}
				onkeydown={(e) => e.stopPropagation()}></textarea>
		</foreignObject>
	{/if}

	<!-- timeline -->
	{#if rec}
		<line
			x1={TL0}
			x2={TL1}
			y1={TLY}
			y2={TLY}
			stroke="var(--stage-grid)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={TL0}
			x2={tlx}
			y1={TLY}
			y2={TLY}
			stroke="var(--explainer-accent)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.6"
		/>
		<Readout id="tl">
			<Txt
				x={(TL0 + TL1) / 2}
				y={TLY + 28}
				text="step {Math.round(Math.min(k, total))} of {total}{rec.stop === 'limit'
					? ' (limit)'
					: ''}{playing ? '' : ' · paused: drag or use ← →'}"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
		<Handle
			x={tlx}
			y={TLY}
			r={8}
			label="Machine position"
			value={Math.round(Math.min(k, total))}
			min={0}
			max={total}
			valuetext="{Math.round(Math.min(k, total))} of {total} steps"
			{onmove}
			{onkey}
		/>
	{/if}
</g>

<style>
	.tm-editor,
	.tm-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 6px 8px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 19px;
		color: var(--text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 8px;
		user-select: text;
		-webkit-user-select: text;
	}
	.tm-editor {
		resize: none;
		white-space: pre;
		overflow: auto;
		tab-size: 4;
	}
	.tm-input {
		padding: 3px 8px;
		background: var(--surface);
		border-color: var(--border);
		font-size: 15px;
		letter-spacing: 0.08em;
	}
	@media (max-width: 640px) {
		.tm-editor,
		.tm-input {
			font-size: 16px;
			font-weight: 600;
		}
	}
	.tm-editor:focus,
	.tm-input:focus {
		outline: 2px solid var(--explainer-accent, var(--accent));
		outline-offset: 1px;
	}
</style>
