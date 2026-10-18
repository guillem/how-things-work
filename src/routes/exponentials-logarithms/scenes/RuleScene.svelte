<script lang="ts">
	/**
	 * A working slide rule: the D scale on the body, the C scale on the slide, both from 1 to 10
	 * with every number at a distance proportional to its logarithm, graduated like a 25 cm rule.
	 * The slide's index sits over a (drag the slide), the cursor over b on the slide (drag the
	 * cursor), and the product is read on D under the cursor. Below, the two lengths laid end to
	 * end at half scale.
	 *
	 * Phases: `slide` (always the left index; a product past 10 runs off the end) and `wrap` (the
	 * right index, the slide's 10, is used when a × b passes 10: read the answer and add a zero).
	 */
	import { Handle, Label, clamp, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { position, scaleTicks, slideRule } from '../explog';

	let { step, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'slide'));
	const wrapOn = $derived(phase === 'wrap');

	const X0 = 100;
	const L = 760;
	const SLIDE_TOP = 210;
	const MID = 290; // where the slide meets the lower body: C ticks go up, D ticks go down
	const BODY_BOT = 372;

	/** Each step has its own pair of controls (2 × 3 first, 4 × 5 once the product passes 10). */
	const aId = $derived(wrapOn ? 'a2' : 'a');
	const bId = $derived(wrapOn ? 'b2' : 'b');
	const a = $derived(clamp(Number(params[aId] ?? 2), 1, 10));
	const b = $derived(clamp(Number(params[bId] ?? 3), 1, 10));
	const rule = $derived(slideRule(a, b));
	/** In the first phase the left index is always used, even if the answer runs off the rule. */
	const offEnd = $derived(!wrapOn && rule.wrapped);
	const slide = $derived(offEnd ? position(a) : rule.slide);
	const cursor = $derived(offEnd ? position(a) + position(b) : rule.cursor);
	const slideX = $derived(X0 + L * slide);
	const cursorX = $derived(X0 + L * cursor);
	/** Which index sits over a: the slide's 1, or its 10. */
	const indexX = $derived(X0 + L * position(a));

	const LEN = { major: 24, mid: 15, minor: 8 };
	const ticks = scaleTicks();
	const tickPath = (dir: 1 | -1, minor: boolean) =>
		ticks
			.filter((tk) => (tk.kind === 'minor') === minor)
			.map((tk) => {
				const x = (L * position(tk.x)).toFixed(2);
				return `M${x} 0 L${x} ${dir * LEN[tk.kind]}`;
			})
			.join('');
	const UP = tickPath(-1, false);
	const DOWN = tickPath(1, false);
	const UP_MINOR = tickPath(-1, true);
	const DOWN_MINOR = tickPath(1, true);
	const MAJORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
	const TENTHS = [1.5];

	const fmt2 = (v: number) => v.toFixed(2);
	const readText = (v: number) => String(Number(v.toFixed(4)));

	// the lengths, laid end to end at half scale
	const H = L / 2;
	const BARS = 470;

	const product = $derived(a * b);
	const readingOnD = $derived(rule.wrapped ? rule.reading / 10 : rule.reading);
</script>

<g>
	<defs>
		<clipPath id="rule-clip">
			<rect x="16" y="0" width="928" height="600" />
		</clipPath>
	</defs>

	<g clip-path="url(#rule-clip)">
		<!-- the body: upper and lower stators -->
		<rect
			x={X0 - 30}
			y={SLIDE_TOP - 34}
			width={L + 60}
			height="34"
			rx="6"
			fill="var(--xl-body)"
			stroke="var(--stage-line)"
		/>
		<rect
			x={X0 - 30}
			y={MID}
			width={L + 60}
			height={BODY_BOT - MID}
			rx="6"
			fill="var(--xl-body)"
			stroke="var(--stage-line)"
		/>
		<!-- the slide -->
		<rect
			x={slideX - 30}
			y={SLIDE_TOP}
			width={L + 60}
			height={MID - SLIDE_TOP}
			rx="3"
			fill="var(--xl-slide)"
			stroke="var(--stage-line)"
		/>
		<path
			d={UP}
			transform="translate({slideX} {MID})"
			stroke="var(--stage-ink)"
			stroke-width="1"
			fill="none"
		/>
		<path
			d={UP_MINOR}
			transform="translate({slideX} {MID})"
			stroke="var(--stage-ink-muted)"
			stroke-width="0.6"
			fill="none"
		/>
		{#each MAJORS as v (v)}
			<Label
				x={slideX + L * position(v)}
				y={MID - 32}
				text={String(v === 10 ? 10 : v)}
				size={13}
				weight={v === 1 || v === 10 ? 700 : 500}
				halo={false}
			/>
		{/each}
		{#each TENTHS as v (v)}
			<Label x={slideX + L * position(v)} y={MID - 22} text="1.5" size={9} muted halo={false} />
		{/each}
		<Label x={slideX - 16} y={MID - 8} text="C" size={12} weight={700} muted halo={false} />

		<!-- the D scale -->
		<path
			d={DOWN}
			transform="translate({X0} {MID})"
			stroke="var(--stage-ink)"
			stroke-width="1"
			fill="none"
		/>
		<path
			d={DOWN_MINOR}
			transform="translate({X0} {MID})"
			stroke="var(--stage-ink-muted)"
			stroke-width="0.6"
			fill="none"
		/>
		{#each MAJORS as v (v)}
			<Label
				x={X0 + L * position(v)}
				y={MID + 44}
				text={String(v)}
				size={13}
				weight={500}
				halo={false}
			/>
		{/each}
		{#each TENTHS as v (v)}
			<Label x={X0 + L * position(v)} y={MID + 32} text="1.5" size={9} muted halo={false} />
		{/each}
		<Label x={X0 - 16} y={MID + 16} text="D" size={12} weight={700} muted halo={false} />

		<!-- the index over a -->
		<line
			x1={indexX}
			x2={indexX}
			y1={SLIDE_TOP + 8}
			y2={MID - 50}
			stroke="var(--xl-a)"
			stroke-width="1.5"
		/>
		<line
			x1={indexX}
			x2={indexX}
			y1={MID - 26}
			y2={MID + 28}
			stroke="var(--xl-a)"
			stroke-width="2.5"
		/>
		<!-- the cursor over b, and the answer under it -->
		<rect
			x={cursorX - 16}
			y={SLIDE_TOP - 46}
			width="32"
			height={BODY_BOT - SLIDE_TOP + 58}
			rx="4"
			fill="var(--xl-b)"
			fill-opacity="0.08"
			stroke="var(--xl-b)"
			stroke-opacity="0.5"
		/>
		<line
			x1={cursorX}
			x2={cursorX}
			y1={SLIDE_TOP - 46}
			y2={BODY_BOT + 12}
			stroke="var(--xl-b)"
			stroke-width="1.5"
		/>
	</g>

	<Handle
		x={indexX}
		y={SLIDE_TOP + 8}
		label="Slide: the first number a"
		value={a}
		min={1}
		max={10}
		valuetext={fmt2(a)}
		color="var(--xl-a)"
		onmove={(p: Point) =>
			setParam(aId, Math.round(clamp(10 ** ((p.x - X0) / L), 1, 10) * 100) / 100)}
		onkey={(s) =>
			setParam(
				aId,
				s === 'start' ? 1 : s === 'end' ? 10 : clamp(Math.round((a + s * 0.01) * 100) / 100, 1, 10)
			)}
	/>
	{#if cursorX < 944}
		<Handle
			x={cursorX}
			y={SLIDE_TOP - 46}
			label="Cursor: the second number b"
			value={b}
			min={1}
			max={10}
			valuetext={fmt2(b)}
			color="var(--xl-b)"
			onmove={(p: Point) =>
				setParam(bId, Math.round(clamp(10 ** ((p.x - X0) / L - slide), 1, 10) * 100) / 100)}
			onkey={(s) =>
				setParam(
					bId,
					s === 'start'
						? 1
						: s === 'end'
							? 10
							: clamp(Math.round((b + s * 0.01) * 100) / 100, 1, 10)
				)}
		/>
	{/if}

	{#if offEnd}
		<path
			d="M{900} {MID - 70} L{936} {MID - 70} M{928} {MID - 76} L{936} {MID - 70} L{928} {MID - 64}"
			stroke="var(--xl-b)"
			stroke-width="2"
			fill="none"
		/>
		<Readout id="off">
			<Label x={896} y={MID - 66} text="off the end" anchor="end" size={12} color="var(--xl-b)" />
		</Readout>
	{/if}

	<!-- the sum: a × b on top -->
	<Readout id="sum" order={1} label="a × b" value="{fmt2(a)} × {fmt2(b)} = {readText(product)}">
		<Label
			x={X0 - 30}
			y={72}
			text="{fmt2(a)} × {fmt2(b)}"
			anchor="start"
			size={24}
			weight={600}
			tabular
			halo={false}
		/>
		<Label
			x={X0 - 30}
			y={100}
			text="exact product: {readText(product)}"
			anchor="start"
			size={13}
			muted
			tabular
			halo={false}
		/>
	</Readout>
	<Readout
		id="reading"
		order={2}
		label="Read on D"
		value={offEnd
			? 'off the end of the rule'
			: rule.wrapped
				? `${readText(readingOnD)}, add a zero: ${readText(rule.reading)}`
				: readText(rule.reading)}
		color="var(--xl-b)"
	>
		<Label
			x={X0 + L + 30}
			y={72}
			text={offEnd
				? 'off the end of the rule'
				: rule.wrapped
					? `reads ${readText(readingOnD)} → ${readText(rule.reading)}`
					: `reads ${readText(rule.reading)}`}
			anchor="end"
			size={20}
			weight={600}
			tabular
			color="var(--xl-b)"
			halo={false}
		/>
		<Label
			x={X0 + L + 30}
			y={100}
			text={offEnd
				? 'use the slide’s other end (next step)'
				: rule.wrapped
					? 'the slide’s 10 is over a: add a zero'
					: `to about ±${readText(rule.precision)}, half a mark`}
			anchor="end"
			size={13}
			muted
			halo={false}
		/>
	</Readout>

	<!-- the lengths, end to end, at half scale -->
	<Readout id="bars-title">
		<Label
			x={X0}
			y={BARS - 24}
			text="the lengths add (half scale): log a + log b = log (a × b)"
			anchor="start"
			size={12}
			muted
			halo={false}
		/>
	</Readout>
	<line
		x1={X0}
		x2={X0 + 2 * H}
		y1={BARS + 34}
		y2={BARS + 34}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{#each [0, 1, 2] as k (k)}
		<line
			x1={X0 + k * H}
			x2={X0 + k * H}
			y1={BARS + 28}
			y2={BARS + 40}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<Readout id="bar-tick-{k}">
			<Label x={X0 + k * H} y={BARS + 56} text={['1', '10', '100'][k]} size={11} muted />
		</Readout>
	{/each}
	<rect
		x={X0}
		y={BARS}
		width={H * position(a)}
		height="22"
		rx="3"
		fill="var(--xl-a)"
		opacity="0.85"
	/>
	<rect
		x={X0 + H * position(a)}
		y={BARS}
		width={H * position(b)}
		height="22"
		rx="3"
		fill="var(--xl-b)"
		opacity="0.85"
	/>
	<line
		x1={X0 + H * (position(a) + position(b))}
		x2={X0 + H * (position(a) + position(b))}
		y1={BARS - 6}
		y2={BARS + 40}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout id="bars-labels">
		{#if position(a) > 0.08}
			<Label
				x={X0 + (H * position(a)) / 2}
				y={BARS + 15}
				text="a"
				size={12}
				weight={700}
				halo={false}
				color="var(--stage-bg)"
			/>
		{/if}
		{#if position(b) > 0.08}
			<Label
				x={X0 + H * (position(a) + position(b) / 2)}
				y={BARS + 15}
				text="b"
				size={12}
				weight={700}
				halo={false}
				color="var(--stage-bg)"
			/>
		{/if}
		<Label
			x={X0 + H * (position(a) + position(b)) + 8}
			y={BARS - 10}
			text="a × b = {readText(product)}"
			anchor="start"
			size={12}
		/>
	</Readout>
</g>
