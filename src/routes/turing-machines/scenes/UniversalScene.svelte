<script lang="ts">
	/**
	 * A universal machine U running the add-one machine M on 1011: one tape
	 * holding M's description (its six rules), M's current state and M's tape.
	 * For each step of M, U's head reads the symbol under M's head, walks to the
	 * description, finds the matching rule, walks back writing the new state,
	 * then writes the symbol and moves M's head marker. M's steps come from the
	 * real run (`run`); U's walk is a sketch of what a universal machine does,
	 * not its rule table (said in the step's notes).
	 *
	 * `thesis`: the same drawing, dimmed, above a row of models that compute
	 * the same functions.
	 *
	 * Everything is a pure function of `t`: one step of M every `P` seconds,
	 * then a pause on the result, on a loop.
	 */
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { INCREMENT, run, symbolAt, tapeText } from '../turing';

	let { step, t, reduced }: StageProps = $props();

	const thesis = $derived(Boolean(step.hints?.thesis));
	const INPUT = '1011';
	const rec = run(INCREMENT, INPUT);
	const total = rec.steps;
	const rules = INCREMENT.states.flatMap((s) =>
		INCREMENT.symbols.flatMap((sym) => {
			const r = INCREMENT.rules[s][sym];
			return r ? [{ state: s, read: sym, rule: r }] : [];
		})
	);

	// ---- time ----------------------------------------------------------------------
	const P = 4.2;
	const HOLD = 4;
	const loop = total * P + HOLD;
	const tt = $derived(reduced ? 2 * P + 0.55 * P : (t % loop) - 0.6);
	const stepIdx = $derived(clamp(Math.floor(tt / P), 0, total));
	const u = $derived(stepIdx >= total ? 1 : clamp(tt / P - stepIdx));
	const done = $derived(tt >= total * P);
	const frame = $derived(rec.frames[stepIdx]);
	const next = $derived(rec.frames[Math.min(total, stepIdx + 1)]);
	const applied = $derived(rec.applied[Math.min(total - 1, stepIdx)]);
	const ruleIdx = $derived(
		rules.findIndex((r) => r.state === applied.state && r.read === applied.read)
	);

	// ---- layout ----------------------------------------------------------------------
	const Y = 132;
	const H = 54;
	const RW = 90;
	const R0 = 24;
	const ruleX = (i: number) => R0 + i * (RW + 4);
	const SX = ruleX(rules.length) + 14;
	const SW = 96;
	const CX0 = SX + SW + 18;
	const CW = 38;
	const CELLS = [-1, 0, 1, 2, 3, 4];
	const cellX = (c: number) => CX0 + (c + 1) * CW + CW / 2;

	// Phases of one step of M, as fractions of P.
	const PH = { read: 0.14, seek: 0.46, found: 0.56, state: 0.72, write: 0.84 };
	const ease = (x: number) => x * x * (3 - 2 * x);
	const lerp = (a: number, b: number, x: number) => a + (b - a) * ease(clamp(x));
	const ruleCX = $derived(ruleX(ruleIdx) + RW / 2);
	const stateCX = SX + SW / 2;
	const headCell = $derived(frame.head);
	/** Where U's head is. */
	const ux = $derived.by(() => {
		if (done) return cellX(rec.final.head);
		const from = cellX(headCell);
		if (u < PH.read) return from;
		if (u < PH.seek) return lerp(from, ruleCX, (u - PH.read) / (PH.seek - PH.read));
		if (u < PH.found) return ruleCX;
		if (u < PH.state) return lerp(ruleCX, stateCX, (u - PH.found) / (PH.state - PH.found));
		if (u < PH.write) return lerp(stateCX, from, (u - PH.state) / (PH.write - PH.state));
		return from;
	});
	const phase = $derived(
		done ? 4 : u < PH.read ? 0 : u < PH.found ? 1 : u < PH.state ? 2 : u < PH.write ? 2 : 3
	);
	// What M's tape and state look like on U's tape right now.
	const mState = $derived(done ? rec.final.state : u > PH.state - 0.04 ? next.state : frame.state);
	const mHead = $derived(
		done
			? rec.final.head
			: u > PH.write + 0.04
				? lerp(frame.head, next.head, (u - PH.write - 0.04) / 0.1)
				: frame.head
	);
	const cellSym = (c: number) => {
		if (done) return symbolAt(rec.final, c, '_');
		if (c === frame.head && u > PH.write) return applied.rule.write;
		return symbolAt(frame, c, '_');
	};
	/** Rules U has passed over while seeking, for a faint flash. */
	const seeking = $derived(!done && u >= PH.read && u < PH.found);
	const carried = $derived.by(() => {
		if (done) return '';
		if (u < PH.read) return '';
		if (u < PH.found) return `looking for: ${frame.state}, reading ${applied.read}`;
		if (u < PH.state) return `new state: ${applied.rule.next}`;
		if (u < PH.write + 0.02) return `write ${applied.rule.write}, move ${applied.rule.move}`;
		return '';
	});

	const PHASES = [
		'Read the symbol under M’s head',
		'Find the rule for M’s state and that symbol in the description',
		'Write M’s new state',
		'Write M’s new symbol and move M’s head'
	];
	const status = $derived(
		done
			? `M has halted: U’s tape now holds ${tapeText(rec.final, '_')}, as M’s would`
			: `Simulating M’s step ${stepIdx + 1} of ${total}`
	);

	const MODELS = [
		{ name: 'Turing machine', who: 'Turing, 1936' },
		{ name: 'λ-calculus', who: 'Church, 1932–36' },
		{ name: 'processor + memory', who: 'stored program' },
		{ name: 'Game of Life', who: 'Conway, 1970' },
		{ name: 'Rule 110', who: 'cellular automaton' }
	];

	const dim = $derived(thesis ? 0.4 : 1);
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fadeIn}>
	<g opacity={dim}>
		<Readout id="u-title" order={1} label="Universal machine U" value={status}>
			<Label
				anchor="start"
				x={24}
				y={42}
				text="Universal machine U, running M = add one on 1011"
				size={18}
				weight={600}
			/>
			<Label
				anchor="start"
				tabular
				x={24}
				y={68}
				text={status}
				size={14}
				color={done ? 'var(--tm-halt)' : undefined}
			/>
		</Readout>

		<!-- region labels -->
		<Readout id="regions">
			<Label
				anchor="start"
				x={R0}
				y={Y - 12}
				text="M’s description: its rule table, written on the tape"
				size={12}
				color="var(--tm-desc)"
				weight={600}
			/>
			<Label
				x={stateCX}
				y={Y - 12}
				text="M’s state"
				size={12}
				anchor="middle"
				weight={600}
				color="var(--tm-head)"
			/>
			<Label x={CX0 + 3 * CW} y={Y - 12} text="M’s tape" size={12} anchor="middle" weight={600} />
		</Readout>

		<!-- the description: one block per rule -->
		{#each rules as r, i (i)}
			{@const on = !done && i === ruleIdx && u >= PH.seek - 0.02 && u < PH.state}
			{@const passing = seeking && Math.abs(ux - (ruleX(i) + RW / 2)) < RW / 2}
			<rect
				x={ruleX(i)}
				y={Y}
				width={RW}
				height={H}
				rx="6"
				fill="var(--tm-desc)"
				fill-opacity={on ? 0.28 : passing ? 0.16 : 0.07}
				stroke="var(--tm-desc)"
				stroke-width={on ? 2.5 : 1}
			/>
			<Label
				tabular
				x={ruleX(i) + RW / 2}
				y={Y + 22}
				text="{r.state}, {r.read}"
				size={12}
				anchor="middle"
				mono
				halo={false}
				weight={on ? 700 : 500}
			/>
			<Label
				tabular
				x={ruleX(i) + RW / 2}
				y={Y + 40}
				text="→ {r.rule.write} {r.rule.move} {r.rule.next}"
				size={11}
				anchor="middle"
				mono
				halo={false}
				weight={on ? 700 : 500}
			/>
		{/each}

		<!-- M's state -->
		<rect
			x={SX}
			y={Y}
			width={SW}
			height={H}
			rx="6"
			fill="var(--tm-head)"
			fill-opacity="0.12"
			stroke="var(--tm-head)"
		/>
		<Label
			tabular
			x={stateCX}
			y={Y + 33}
			text={mState}
			size={15}
			anchor="middle"
			weight={700}
			mono
			halo={false}
			color="var(--tm-head)"
		/>

		<!-- M's tape -->
		{#each CELLS as c (c)}
			<rect
				x={cellX(c) - CW / 2 + 1.5}
				y={Y}
				width={CW - 3}
				height={H}
				rx="5"
				fill="var(--tm-cell)"
				stroke="var(--tm-cell-edge)"
			/>
			{#if cellSym(c) !== '_'}
				<Label
					tabular
					x={cellX(c)}
					y={Y + 35}
					text={cellSym(c)}
					size={20}
					anchor="middle"
					weight={600}
					mono
					halo={false}
				/>
			{/if}
		{/each}
		<!-- M's head: a marker U keeps on its tape -->
		<rect
			x={cellX(0) + mHead * CW - CW / 2}
			y={Y - 3}
			width={CW}
			height={H + 6}
			rx="7"
			fill="none"
			stroke="var(--tm-head)"
			stroke-width="2.5"
			stroke-dasharray="5 3"
		/>

		<!-- U's head, below the tape -->
		<path
			d="M{ux - 10} {Y + H + 22} L{ux + 10} {Y + H + 22} L{ux} {Y + H + 6} Z"
			fill="var(--tm-write)"
		/>
		<Label
			x={ux}
			y={Y + H + 40}
			text="U"
			size={13}
			anchor="middle"
			weight={700}
			color="var(--tm-write)"
		/>
		{#if carried}
			<Readout
				id="carried"
				order={2}
				label="U is carrying"
				value={carried}
				opacity={thesis ? 0 : 1}
			>
				<Label
					tabular
					x={clamp(ux, 120, 840)}
					y={Y + H + 62}
					text={carried}
					size={13}
					anchor="middle"
					weight={600}
					color="var(--tm-write)"
				/>
			</Readout>
		{/if}
	</g>

	{#if !thesis}
		<!-- what U does, phase by phase -->
		<Readout
			id="phase"
			order={3}
			label="U is doing"
			value={phase < 4 ? `${phase + 1}. ${PHASES[phase]}` : 'M has halted'}
		>
			<Label anchor="start" x={24} y={310} text="For every step of M, U:" size={14} weight={600} />
		</Readout>
		{#each PHASES as p, i (i)}
			{@const on = phase === i}
			<Readout id="phase-{i}">
				<circle
					cx={36}
					cy={338 + i * 30}
					r="10"
					fill={on ? 'var(--tm-write)' : 'var(--stage-grid)'}
				/>
				<Label
					tabular
					x={36}
					y={342 + i * 30}
					text={String(i + 1)}
					size={12}
					anchor="middle"
					weight={700}
					halo={false}
					color={on ? 'var(--stage-bg)' : undefined}
				/>
				<Label
					anchor="start"
					tabular
					x={56}
					y={342 + i * 30}
					text={p}
					size={13}
					weight={on ? 700 : 500}
					muted={!on}
				/>
			</Readout>
		{/each}

		<!-- M on its own, for comparison -->
		<Label
			anchor="start"
			x={600}
			y={310}
			text="M on its own, after the same steps:"
			size={14}
			weight={600}
		/>
		{#each CELLS as c (c)}
			{@const f = done ? rec.final : u > PH.write ? next : frame}
			{@const sym = symbolAt(f, c, '_')}
			<rect
				x={600 + (c + 1) * 44}
				y={326}
				width="40"
				height="46"
				rx="5"
				fill="var(--tm-cell)"
				stroke="var(--tm-cell-edge)"
			/>
			{#if sym !== '_'}
				<Label
					tabular
					x={620 + (c + 1) * 44}
					y={357}
					text={sym}
					size={20}
					anchor="middle"
					weight={600}
					mono
					halo={false}
				/>
			{/if}
			{#if c === f.head}
				<rect
					x={598 + (c + 1) * 44}
					y={323}
					width="44"
					height="52"
					rx="7"
					fill="none"
					stroke="var(--tm-head)"
					stroke-width="2.5"
				/>
			{/if}
		{/each}
		<Readout
			id="alone"
			order={8}
			label="M on its own"
			value={tapeText(done ? rec.final : u > PH.write ? next : frame, '_')}
		>
			<Label
				anchor="start"
				tabular
				x={600}
				y={396}
				text="state {done
					? rec.final.state
					: u > PH.write
						? next.state
						: frame.state} · same tape, step for step"
				size={12}
				muted
			/>
		</Readout>
		<Readout id="u-note">
			<Label
				anchor="start"
				x={24}
				y={500}
				text="One fixed machine U; change the description on its tape and it becomes any other machine."
				size={14}
				weight={600}
			/>
			<Label
				anchor="start"
				x={24}
				y={524}
				text="A sketch: a real U marks cells as it goes and takes many of its own steps for each of M’s."
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Label
			x={480}
			y={330}
			text="Each can simulate every other: they compute exactly the same functions"
			size={15}
			weight={600}
			anchor="middle"
		/>
		{#each MODELS as md, i (md.name)}
			{@const x = 24 + i * 186}
			<Readout id="model-{i}">
				<rect
					{x}
					y={360}
					width="170"
					height="74"
					rx="10"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				<Label
					tabular
					x={x + 85}
					y={392}
					text={md.name}
					size={14}
					anchor="middle"
					weight={600}
					halo={false}
				/>
				<Label
					tabular
					x={x + 85}
					y={414}
					text={md.who}
					size={12}
					anchor="middle"
					muted
					halo={false}
				/>
			</Readout>
			{#if i < MODELS.length - 1}
				<Label
					x={x + 178}
					y={403}
					text="⇔"
					size={16}
					anchor="middle"
					color="var(--tm-head)"
					weight={700}
				/>
			{/if}
		{/each}
		<Readout
			id="models"
			order={3}
			label="Equivalent models"
			value={MODELS.map((md) => md.name).join(' ⇔ ')}
		/>
		<Readout
			id="thesis"
			order={4}
			label="Church–Turing thesis"
			value="whatever any step-by-step method can compute, a Turing machine can"
		>
			<Label
				x={480}
				y={488}
				text="Church–Turing thesis: whatever any step-by-step method can compute, a Turing machine can."
				size={14}
				anchor="middle"
				weight={600}
				color="var(--tm-head)"
			/>
			<Label
				x={480}
				y={512}
				text="(with unlimited time and memory; it says nothing about speed)"
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
	{/if}
</g>
