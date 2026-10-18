<script lang="ts">
	/**
	 * The measured accuracies of the two shipped models on held-out sums (200 per point).
	 * Phase `nines`: 8-digit sums by their longest run of columns adding up to 9, with a carry
	 * coming into the run (solid) or not (dashed). Phase `digits`: sums of two n-digit numbers,
	 * n = 1 … 10, with 9 and 10 digits beyond anything seen in training. Phase `learning`: the
	 * share of 8-digit held-out sums each model writes exactly right, through training. The lines
	 * draw themselves in over the first second and a half.
	 */
	import { Axes, Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TRAINED_DIGITS, WIDTH, type Mode } from '../addition';
	import { NINES_DIGITS } from '../problems';
	import { byDigits, learning, ninesShare, ninesTotal, pct, results } from '../results';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'nines'));
	const grow = $derived(reduced ? 1 : smoothstep(0.2, 1.8, t));

	const X0 = 110;
	const X1 = 640;
	const Y0 = 480;
	const Y1 = 100;
	const sy = scale([0, 1], [Y0, Y1]);
	const yTicks = [0, 0.25, 0.5, 0.75, 1];
	const yFormat = (v: number) => `${Math.round(v * 100)}%`;
	const MODES: { mode: Mode; label: string; color: string }[] = [
		{ mode: 'direct', label: 'direct model', color: 'var(--cot-direct)' },
		{ mode: 'scratchpad', label: 'scratchpad model', color: 'var(--cot-scratch)' }
	];

	type Pt = { x: number; y: number };
	interface Series {
		id: string;
		mode: Mode;
		color: string;
		dashed: boolean;
		pts: Pt[];
	}

	const runs = Array.from({ length: NINES_DIGITS + 1 }, (_, r) => r);
	const sxNines = scale([0, NINES_DIGITS], [X0 + 20, X1 - 20]);
	const sxDigits = scale([1, WIDTH], [X0 + 20, X1 - 20]);
	const lastStep = learning('direct').at(-1)?.step ?? 1;
	const sxLearn = scale([0, lastStep], [X0, X1]);

	const sx = $derived(phase === 'digits' ? sxDigits : phase === 'learning' ? sxLearn : sxNines);

	const series = $derived.by((): Series[] => {
		if (phase === 'digits')
			return MODES.map((m) => ({
				id: m.mode,
				mode: m.mode,
				color: m.color,
				dashed: false,
				pts: byDigits(m.mode).map((y, i) => ({ x: i + 1, y }))
			}));
		if (phase === 'learning')
			return MODES.map((m) => ({
				id: m.mode,
				mode: m.mode,
				color: m.color,
				dashed: false,
				pts: learning(m.mode).map((p) => ({ x: p.step, y: p.share }))
			}));
		return MODES.flatMap((m) => [
			{
				id: `${m.mode}-in`,
				mode: m.mode,
				color: m.color,
				dashed: false,
				pts: runs
					.filter((r) => r >= 1 && r < NINES_DIGITS)
					.map((r) => ({ x: r, y: ninesShare(m.mode, r, true) }))
			},
			{
				id: `${m.mode}-out`,
				mode: m.mode,
				color: m.color,
				dashed: true,
				pts: runs.map((r) => ({ x: r, y: ninesShare(m.mode, r, false) }))
			}
		]);
	});

	/** The first `grow` of a series, by x. */
	function partial(pts: Pt[]): Pt[] {
		if (grow >= 1) return pts;
		const lo = pts[0].x;
		const hi = pts[pts.length - 1].x;
		const cut = lo + grow * (hi - lo);
		const out = pts.filter((p) => p.x <= cut);
		const next = pts.find((p) => p.x > cut);
		const prev = out[out.length - 1];
		if (next && prev && cut > prev.x) {
			const u = (cut - prev.x) / (next.x - prev.x);
			out.push({ x: cut, y: prev.y + u * (next.y - prev.y) });
		}
		return out;
	}

	const xLabel = $derived(
		phase === 'digits'
			? 'digits in each number'
			: phase === 'learning'
				? 'training steps'
				: 'longest run of columns adding up to 9'
	);
	const xTicks = $derived(
		phase === 'digits'
			? Array.from({ length: WIDTH }, (_, i) => i + 1)
			: phase === 'learning'
				? undefined
				: runs
	);
	const title = $derived(
		phase === 'digits'
			? 'Right answers, by length of the numbers'
			: phase === 'learning'
				? '8-digit sums written exactly right, through training'
				: 'Right answers on 8-digit sums, by run of nines'
	);

	const d = results.direct;
	const s = results.scratchpad;
	const show = (v: number) => pct(v);
	const ninesNote = (mode: Mode) =>
		`runs of nines: ${show(ninesTotal(mode))} right; 3 nines, no carry in: ${show(ninesShare(mode, 3, false))}`;
</script>

<g>
	<Readout id="title" order={0} label="Chart" value={title}>
		<Label x={40} y={36} anchor="start" size={15} weight={650} text={title} />
	</Readout>
	<Readout id="sub">
		<Label
			x={40}
			y={56}
			anchor="start"
			size={11}
			muted
			text="200 held-out sums per point, never seen in training; greedy decoding, as on the page"
		/>
	</Readout>

	{#if phase === 'digits'}
		<rect
			x={sxDigits(TRAINED_DIGITS + 0.5)}
			y={Y1}
			width={sxDigits(WIDTH) + 20 - sxDigits(TRAINED_DIGITS + 0.5)}
			height={Y0 - Y1}
			fill="var(--cot-beyond)"
		/>
		<Readout id="beyond">
			<Label
				x={(sxDigits(TRAINED_DIGITS + 0.5) + sxDigits(WIDTH) + 20) / 2}
				y={Y1 + 18}
				size={11}
				muted
				text="beyond training"
			/>
		</Readout>
	{/if}

	<Axes
		{sx}
		{sy}
		{xLabel}
		yLabel={phase === 'learning' ? 'exactly right' : 'right answers'}
		{xTicks}
		{yTicks}
		{yFormat}
	/>

	{#each series as se (se.id)}
		{@const pts = partial(se.pts)}
		<path
			d={linePath(
				pts,
				(p) => p.x,
				(p) => p.y,
				sx,
				sy
			)}
			fill="none"
			stroke={se.color}
			stroke-width="2.5"
			stroke-dasharray={se.dashed ? '6 4' : undefined}
			stroke-linejoin="round"
		/>
		{#if phase !== 'learning'}
			{#each pts.filter((p) => Number.isInteger(p.x)) as p (p.x)}
				<circle
					cx={sx(p.x)}
					cy={sy(p.y)}
					r="4.5"
					fill={se.dashed ? 'var(--stage-bg)' : se.color}
					stroke={se.color}
					stroke-width="2"
				/>
			{/each}
		{/if}
	{/each}

	<!-- legend and the numbers -->
	<g>
		{#each MODES as m, i (m.mode)}
			{@const y = 100 + i * 120}
			<line x1={680} x2={712} y1={y} y2={y} stroke={m.color} stroke-width="2.5" />
			<Label
				x={720}
				y={y + 4}
				anchor="start"
				size={13}
				weight={650}
				color={m.color}
				text={m.label}
			/>
			{#if phase === 'nines'}
				<Readout
					id="n-{m.mode}"
					order={i + 1}
					label={m.label}
					value={ninesNote(m.mode)}
					color={m.color}
				>
					<Label
						x={680}
						y={y + 26}
						anchor="start"
						size={11}
						muted
						text="all 3,200 sums with a run of nines:"
					/>
					<Label
						x={680}
						y={y + 44}
						anchor="start"
						size={13}
						tabular
						text="{show(ninesTotal(m.mode))} right"
					/>
					<Label
						x={680}
						y={y + 66}
						anchor="start"
						size={11}
						muted
						text="3 nines, no carry coming in:"
					/>
					<Label
						x={680}
						y={y + 84}
						anchor="start"
						size={13}
						tabular
						text="{show(ninesShare(m.mode, 3, false))} right"
					/>
				</Readout>
			{:else if phase === 'digits'}
				<Readout
					id="d-{m.mode}"
					order={i + 1}
					label={m.label}
					value="8 digits: {show(byDigits(m.mode)[7])}; 9: {show(byDigits(m.mode)[8])}; 10: {show(
						byDigits(m.mode)[9]
					)}"
					color={m.color}
				>
					<Label
						x={680}
						y={y + 26}
						anchor="start"
						size={11}
						muted
						text="8 digits (trained) · 9 · 10:"
					/>
					<Label
						x={680}
						y={y + 44}
						anchor="start"
						size={13}
						tabular
						text="{show(byDigits(m.mode)[7])} · {show(byDigits(m.mode)[8])} · {show(
							byDigits(m.mode)[9]
						)}"
					/>
				</Readout>
			{:else}
				{@const l = learning(m.mode)}
				<Readout
					id="l-{m.mode}"
					order={i + 1}
					label={m.label}
					value="after 1,000 steps: {show(
						l.find((p) => p.step === 1000)?.share ?? 0
					)}; at the end: {show(l[l.length - 1].share)}"
					color={m.color}
				>
					<Label
						x={680}
						y={y + 26}
						anchor="start"
						size={11}
						muted
						text="exactly right after 1,000 steps · end:"
					/>
					<Label
						x={680}
						y={y + 44}
						anchor="start"
						size={13}
						tabular
						text="{show(l.find((p) => p.step === 1000)?.share ?? 0)} · {show(
							l[l.length - 1].share
						)}"
					/>
				</Readout>
			{/if}
		{/each}
		{#if phase === 'nines'}
			<Readout id="key-lines">
				<line
					x1={680}
					x2={712}
					y1={360}
					y2={360}
					stroke="var(--stage-ink-muted)"
					stroke-width="2"
				/>
				<circle cx={696} cy={360} r="4" fill="var(--stage-ink-muted)" />
				<Label x={720} y={364} anchor="start" size={11} text="a carry comes into the run" />
				<line
					x1={680}
					x2={712}
					y1={384}
					y2={384}
					stroke="var(--stage-ink-muted)"
					stroke-width="2"
					stroke-dasharray="6 4"
				/>
				<circle
					cx={696}
					cy={384}
					r="4"
					fill="var(--stage-bg)"
					stroke="var(--stage-ink-muted)"
					stroke-width="2"
				/>
				<Label x={720} y={388} anchor="start" size={11} text="no carry comes in" />
			</Readout>
		{/if}
		<Readout id="settings">
			<Label
				x={680}
				y={440}
				anchor="start"
				size={11}
				muted
				text="same size: {d.config.layers} block{d.config.layers > 1 ? 's' : ''}, width {d.config
					.width}"
			/>
			<Label
				x={680}
				y={458}
				anchor="start"
				size={11}
				muted
				text="{d.steps.toLocaleString('en-US')} steps of {d.batch} sums each ({s.steps === d.steps
					? 'both'
					: ''})"
			/>
		</Readout>
	</g>
</g>
