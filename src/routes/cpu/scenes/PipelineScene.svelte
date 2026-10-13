<script lang="ts">
	/**
	 * The same cycle, faster and overlapped. Two timetables of the same six
	 * instructions over 18 clock ticks: one at a time (fetch, decode, execute,
	 * then the next), and pipelined (each part busy on every tick, so a new
	 * instruction finishes every tick once the pipeline is full). A cursor sweeps
	 * the ticks and counts the instructions finished. Below, the clock rate of a
	 * real processor (source in steps.ts).
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const TICKS = 18;
	const ROWS = 6;
	const PHASES = ['fetch', 'decode', 'execute'] as const;
	const LETTER = { fetch: 'F', decode: 'D', execute: 'E' };
	const X0 = 150;
	const CW = 42;
	const RH = 22;
	const PERIOD = TICKS * 0.75 + 3;

	// One tick every 0.75 s, then a pause with everything shown, then again.
	const tick = $derived(
		reduced ? TICKS : Math.min(TICKS, Math.floor(((t % PERIOD) / 0.75) * 1 + 0.0001))
	);

	/** Phase of instruction `i` at tick `c` (both 0-based), or null. */
	const serial = (i: number, c: number) => (Math.floor(c / 3) === i ? PHASES[c % 3] : null);
	const piped = (i: number, c: number) => (c - i >= 0 && c - i < 3 ? PHASES[c - i] : null);
	const doneBy = (f: (i: number, c: number) => string | null, upTo: number) => {
		let n = 0;
		for (let i = 0; i < ROWS; i++) for (let c = 0; c < upTo; c++) if (f(i, c) === 'execute') n++;
		return n;
	};

	const tables = $derived([
		{ id: 'serial', title: 'One instruction at a time', y: 96, f: serial },
		{
			id: 'piped',
			title: 'Pipelined: the next fetch starts while this one decodes',
			y: 314,
			f: piped
		}
	]);

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const cells = Array.from({ length: ROWS * TICKS }, (_, k) => ({
		i: Math.floor(k / TICKS),
		c: k % TICKS
	}));
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g opacity={fadeIn}>
	{#each tables as tb (tb.id)}
		{@const done = doneBy(tb.f, tick)}
		<!-- <Readout>: on narrow screens these are hidden, shortened or listed as HTML under the stage -->
		<Readout id="title-{tb.id}">
			{@render txt(24, tb.y - 30, tb.title, 15, { weight: 600 })}
			{#snippet narrow()}
				{@render txt(24, tb.y - 24, tb.id === 'serial' ? 'One at a time' : 'Pipelined', 26, {
					weight: 600
				})}
			{/snippet}
		</Readout>
		<Readout
			id="done-{tb.id}"
			order={tb.id === 'serial' ? 1 : 2}
			label={tb.id === 'serial' ? 'One at a time' : 'Pipelined'}
			value="{done} of {ROWS} finished"
			note="after {tick} tick{tick === 1 ? '' : 's'}"
		>
			{@render txt(936, tb.y - 30, `${done} of ${ROWS} instructions finished`, 14, {
				anchor: 'end',
				weight: 700
			})}
		</Readout>
		{#each Array.from({ length: TICKS }, (_, c) => c) as c (c)}
			<Readout id="tick-{tb.id}-{c}">
				{@render txt(X0 + c * CW + CW / 2, tb.y - 8, String(c + 1), 10, {
					anchor: 'middle',
					muted: true
				})}
			</Readout>
		{/each}
		{#each Array.from({ length: ROWS }, (_, i) => i) as i (i)}
			<Readout id="row-{tb.id}-{i}">
				{@render txt(X0 - 12, tb.y + i * RH + 16, `instruction ${i + 1}`, 11, {
					anchor: 'end',
					muted: true
				})}
				{#snippet narrow()}
					{@render txt(X0 - 12, tb.y + i * RH + 18, `#${i + 1}`, 18, {
						anchor: 'end',
						muted: true
					})}
				{/snippet}
			</Readout>
		{/each}
		{#each cells as cell (cell.i * 100 + cell.c)}
			{@const ph = tb.f(cell.i, cell.c)}
			{#if ph}
				{@const on = cell.c < tick}
				<rect
					x={X0 + cell.c * CW + 2}
					y={tb.y + cell.i * RH + 2}
					width={CW - 4}
					height={RH - 4}
					rx="4"
					fill={`var(--cpu-${ph})`}
					opacity={on ? 1 : 0.18}
				/>
				{#if on}
					<Readout id="letter">
						<text
							x={X0 + cell.c * CW + CW / 2}
							y={tb.y + cell.i * RH + 16}
							text-anchor="middle"
							font-weight="700"
							style:font-size="11px"
							style:fill="#fff">{LETTER[ph]}</text
						>
						{#snippet narrow()}
							<text
								x={X0 + cell.c * CW + CW / 2}
								y={tb.y + cell.i * RH + 17}
								text-anchor="middle"
								font-weight="700"
								style:font-size="16px"
								style:fill="#fff">{LETTER[ph]}</text
							>
						{/snippet}
					</Readout>
				{/if}
			{/if}
		{/each}
		{#if tick < TICKS}
			<rect
				x={X0 + tick * CW}
				y={tb.y - 2}
				width={CW}
				height={ROWS * RH + 4}
				rx="5"
				fill="none"
				stroke="var(--explainer-accent)"
				stroke-width="2"
			/>
		{/if}
	{/each}
	<Readout id="ticks-axis">
		{@render txt(X0, 252, 'clock ticks →', 11, { muted: true })}
	</Readout>

	<!-- legend -->
	{#each PHASES as ph, i (ph)}
		<rect x={X0 + i * 110} y="462" width="14" height="14" rx="3" fill={`var(--cpu-${ph})`} />
		<Readout
			id="legend-{ph}"
			order={10 + i}
			label={ph[0].toUpperCase() + ph.slice(1)}
			color="var(--cpu-{ph})"
		>
			{@render txt(X0 + 20 + i * 110, 474, ph, 12, { muted: true })}
		</Readout>
	{/each}

	<!-- the real clock rate -->
	<Readout
		id="clock"
		order={3}
		label="Intel Core i9-14900K (2023)"
		value="up to 6 GHz"
		note="6,000,000,000 ticks a second"
	>
		<rect
			x="24"
			y="500"
			width="912"
			height="72"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(
			44,
			528,
			'This page’s processor: 1 to 60 ticks a second, so you can follow it.',
			13,
			{
				muted: true
			}
		)}
		{@render txt(
			44,
			554,
			'Intel Core i9-14900K (2023), fastest cores: up to 6 GHz = 6,000,000,000 ticks a second.',
			14,
			{ weight: 700 }
		)}
	</Readout>
</g>
