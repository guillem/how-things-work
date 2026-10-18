<script lang="ts">
	/**
	 * The computation each model does, one forward pass per written character, on a shared axis
	 * of passes. Each pass is drawn as a small stack: the character that goes in, the two blocks,
	 * and the character that comes out, which becomes the next pass's input. Both lanes read the
	 * question through attention. The direct model writes 12 characters (12 passes); the
	 * scratchpad model writes 33, and every carry it writes (pink) goes back in at the bottom of
	 * the next pass. Phase `direct` puts the direct model's first digit in focus, `scratch` the
	 * scratchpad's loop, `both` neither.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { columns, WIDTH, type Mode } from '../addition';
	import { transcript } from '../models';
	import { int, sumOf } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'both'));
	const sum = $derived(sumOf(params));
	const a = $derived(sum[0]);
	const b = $derived(sum[1]);
	const direct = $derived(transcript('direct', a, b));
	const scratch = $derived(transcript('scratchpad', a, b));

	const PACE = 0.32;
	const START = 0.6;
	const shown = $derived(reduced ? 99 : Math.max(0, Math.floor((t - START) / PACE) + 1));

	// ---- layout
	const PX = 178; // left edge of pass 1
	const PW = 22.5; // one pass
	const BW = 19;
	const passX = (k: number) => PX + k * PW; // k = 0-based pass
	const LANES: Record<Mode, number> = { direct: 112, scratchpad: 318 };
	// within a lane (from its top y): output box, block 2, block 1, input box
	const OUT = 0;
	const B2 = 26;
	const B1 = 46;
	const IN = 68;
	const H = 18;

	interface Pass {
		k: number;
		input: string;
		output: string;
		carry: boolean;
		ok: boolean;
	}
	function passesOf(mode: Mode): Pass[] {
		const tr = mode === 'direct' ? direct : scratch;
		return tr.written.map((w, k) => ({
			k,
			input: k === 0 ? '=' : tr.written[k - 1].char,
			output: w.char,
			// in the working, odd positions are carries
			carry: mode === 'scratchpad' && k < 2 * WIDTH && k % 2 === 1,
			ok: w.char === tr.right[k]
		}));
	}
	const lanes = $derived([
		{ mode: 'direct' as Mode, passes: passesOf('direct') },
		{ mode: 'scratchpad' as Mode, passes: passesOf('scratchpad') }
	]);
	const firstAnswer: Record<Mode, number> = { direct: 0, scratchpad: 2 * WIDTH + 1 };
	/**
	 * The direct model's answer digits that sit just above a column adding up to 9: their carry is
	 * settled further down (answer position i stands for column WIDTH − i).
	 */
	const far = $derived.by(() => {
		const cols = columns(a, b);
		return new Set(
			Array.from({ length: WIDTH + 1 }, (_, i) => i).filter((i) => {
				const c = WIDTH - i;
				return c > 0 && cols[c - 1].a + cols[c - 1].b === 9;
			})
		);
	});
	const firstFar = $derived(Math.min(...far));

	const focus = (mode: Mode) =>
		phase === 'direct'
			? mode === 'direct'
				? 1
				: 0.4
			: phase === 'scratch'
				? mode === 'scratchpad'
					? 1
					: 0.4
				: 1;
	const pulse = $derived(reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 5));
</script>

<g>
	<Readout id="title" order={0} label="The sum" value="{int(a)} + {int(b)}">
		<Label
			x={40}
			y={34}
			anchor="start"
			size={15}
			weight={650}
			text="One forward pass per character written: {int(a)} + {int(b)}"
		/>
	</Readout>
	<Readout id="key">
		<Label
			x={40}
			y={56}
			anchor="start"
			size={11}
			muted
			text="each pass: the character that goes in (bottom), the model's two blocks, the character that comes out (top)"
		/>
	</Readout>

	{#each lanes as lane (lane.mode)}
		{@const y = LANES[lane.mode]}
		{@const color = lane.mode === 'direct' ? 'var(--cot-direct)' : 'var(--cot-scratch)'}
		<g opacity={focus(lane.mode)}>
			<Label
				x={40}
				y={y - 16}
				anchor="start"
				size={14}
				weight={650}
				{color}
				text={lane.mode === 'direct' ? 'Direct model' : 'Scratchpad model'}
			/>
			<Readout
				id="n-{lane.mode}"
				order={lane.mode === 'direct' ? 1 : 2}
				label={lane.mode === 'direct' ? 'Direct model' : 'Scratchpad model'}
				value="{lane.passes.length} passes; the answer starts at pass {firstAnswer[lane.mode] + 1}"
				{color}
			>
				<Label
					x={PX + 4}
					y={y - 16}
					anchor="start"
					size={12}
					muted
					tabular
					text="{lane.passes.length} passes, the answer starting at pass {firstAnswer[lane.mode] +
						1}"
				/>
			</Readout>
			<!-- the question, read by every pass through attention -->
			<rect
				x={40}
				y={y + B2}
				width={112}
				height={B1 - B2 + 16}
				rx="6"
				fill="var(--cot-question)"
				stroke="var(--border)"
			/>
			<Label x={96} y={y + B2 + 15} size={11} halo={false} text="the question" />
			<Label x={96} y={y + B2 + 30} size={10} muted halo={false} text="22 characters" />
			{#each lane.passes as p (p.k)}
				{@const x = passX(p.k)}
				{@const on = p.k < shown}
				{@const now = p.k === shown - 1}
				{@const hot = lane.mode === 'direct' && phase === 'direct' && far.has(p.k)}
				<g opacity={on ? 1 : 0.18}>
					<!-- attention back to the question (faint) -->
					{#if on && (p.k === 0 || hot)}
						<path
							d="M {x} {y + B1 + 8} Q {(152 + x) / 2} {y + B1 + 34}, 152 {y + B1 + 6}"
							fill="none"
							stroke={color}
							stroke-width="1.2"
							stroke-dasharray="3 3"
						/>
					{/if}
					<rect
						{x}
						y={y + IN}
						width={BW}
						height={H}
						rx="3"
						fill="var(--surface)"
						stroke="var(--border)"
					/>
					<text
						x={x + BW / 2}
						y={y + IN + 13}
						text-anchor="middle"
						font-size="11"
						fill={lane.passes[p.k - 1]?.carry && p.input === '1'
							? 'var(--cot-carry)'
							: 'var(--stage-ink-muted)'}
						font-weight={lane.passes[p.k - 1]?.carry && p.input === '1' ? 700 : 400}
						style:font-family="var(--font-mono)">{p.input}</text
					>
					<rect {x} y={y + B1} width={BW} height={16} rx="3" fill={color} opacity="0.5" />
					<rect {x} y={y + B2} width={BW} height={16} rx="3" fill={color} opacity="0.75" />
					<rect
						{x}
						y={y + OUT}
						width={BW}
						height={H}
						rx="3"
						fill={p.ok ? 'var(--cot-right-bg)' : 'var(--cot-wrong-bg)'}
						stroke={p.ok ? 'var(--cot-right)' : 'var(--cot-wrong)'}
						stroke-width={now ? 2 : 1}
						opacity={now ? pulse : 1}
					/>
					<text
						x={x + BW / 2}
						y={y + OUT + 13}
						text-anchor="middle"
						font-size="11"
						font-weight="650"
						fill={p.carry && p.output === '1' ? 'var(--cot-carry)' : 'var(--stage-ink)'}
						style:font-family="var(--font-mono)">{p.output}</text
					>
					{#if hot}
						<rect
							x={x - 2}
							y={y + OUT - 2}
							width={BW + 4}
							height={IN + H + 4}
							rx="5"
							fill="none"
							stroke="var(--cot-nine)"
							stroke-width="2"
						/>
					{/if}
					<!-- the written character goes back in as the next pass's input -->
					{#if p.k + 1 < lane.passes.length && p.k + 1 < shown}
						<path
							d="M {x + BW} {y + OUT + 9} C {x + BW + 6} {y + OUT + 9}, {x + PW - 4} {y +
								IN +
								9}, {x + PW} {y + IN + 9}"
							fill="none"
							stroke={p.carry && p.output === '1' ? 'var(--cot-carry)' : 'var(--stage-line)'}
							stroke-width={p.carry && p.output === '1' ? 1.6 : 0.8}
						/>
					{/if}
				</g>
			{/each}
			{#if lane.mode === 'scratchpad' || (phase === 'direct' && Number.isFinite(firstFar))}
				{@const k = lane.mode === 'scratchpad' ? firstAnswer.scratchpad : firstFar}
				{@const x = passX(k) + BW / 2}
				{@const tint = lane.mode === 'scratchpad' ? color : 'var(--cot-nine)'}
				<line
					x1={x}
					x2={x}
					y1={y + IN + H + 4}
					y2={y + IN + H + 22}
					stroke={tint}
					stroke-width="1.5"
				/>
				<Label
					x={x - 6}
					y={y + IN + H + 36}
					anchor="start"
					size={11}
					color={tint}
					weight={600}
					text={lane.mode === 'scratchpad'
						? 'the answer starts here'
						: 'outlined: digits above a column adding up to 9'}
				/>
			{/if}
		</g>
	{/each}

	<!-- what the focus is about -->
	<g opacity={phase === 'both' ? 0 : 1}>
		<Readout id="note-card">
			<rect
				x={40}
				y={474}
				width={880}
				height={104}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
		</Readout>
		{#if phase === 'direct'}
			<Readout
				id="note-d"
				order={3}
				label="Direct"
				value="a digit above a run of nines depends on columns further down, settled in one pass"
			>
				<Label
					x={60}
					y={502}
					anchor="start"
					size={13}
					weight={650}
					color="var(--cot-direct)"
					text="A digit above a run of nines depends on columns further down"
				/>
				<Label
					x={60}
					y={526}
					anchor="start"
					size={12}
					text="The direct model settles it inside the one pass that writes it: the same two blocks every character gets,"
				/>
				<Label
					x={60}
					y={546}
					anchor="start"
					size={12}
					text="reading the question through attention. None of the characters it has written so far is about the lower columns."
				/>
			</Readout>
		{:else}
			<Readout
				id="note-s"
				order={3}
				label="Scratchpad"
				value="each pass does one column and reads back the carry it wrote"
			>
				<Label
					x={60}
					y={502}
					anchor="start"
					size={13}
					weight={650}
					color="var(--cot-scratch)"
					text="The scratchpad model spreads the work over 21 passes before the answer"
				/>
				<Label
					x={60}
					y={526}
					anchor="start"
					size={12}
					text="Each pass does one small job: a column's digit, or its carry. A carry it writes comes back in as the next"
				/>
				<Label
					x={60}
					y={546}
					anchor="start"
					size={12}
					text="pass's input (pink), so a carry travels up the columns one pass at a time instead of all at once."
				/>
			</Readout>
		{/if}
	</g>
</g>
