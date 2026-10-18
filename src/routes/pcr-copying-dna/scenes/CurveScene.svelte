<script lang="ts">
	/**
	 * The copies against the cycle number, from the model's `amplify`, in four modes
	 * (`step.hints.mode`):
	 *   - `doubling`: one copy, played cycle by cycle (`play` hint names the toggle, `cycle` the
	 *     slider it drives), beside the tube's glow and gauges of the primers and building blocks
	 *     left;
	 *   - `plateau`: 10, 1,000 and 100,000 copies, three tubes, on a plain or a log scale;
	 *   - `threshold`: the chosen starting copies against the detection line, with its Ct, and
	 *     the curves of 1 and 1,000 copies as faint references;
	 *   - `standard`: a tenfold dilution series at the chosen efficiency, and an inset of each Ct
	 *     against the starting copies.
	 * The curves draw themselves at two cycles a second; reduced motion shows them whole (the
	 * doubling run at cycle 30).
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CYCLES, THRESHOLD, amplify, copiesAt, thresholdCycle, type Run } from '../pcr';
	import { count, hinted, powerLabel, tubePath } from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'doubling'));
	const RATE = 2;

	// ---- what is plotted -------------------------------------------------------------------------
	const linear = $derived(hinted(step, params, 'linear', false) === true);
	const efficiency = $derived(Number(hinted(step, params, 'efficiency', 1)) || 1);
	const startPower = $derived(Number(hinted(step, params, 'start', 0)));

	// doubling: the toggle drives the slider
	const playId = $derived(String(step.hints?.play ?? ''));
	const cycleId = $derived(String(step.hints?.cycle ?? ''));
	const playing = $derived(playId !== '' && params[playId] === true);
	const shown = $derived.by(() => {
		if (mode === 'doubling') {
			if (playing) return reduced ? 30 : Math.min(CYCLES, t * RATE);
			return Math.max(0, Math.min(CYCLES, Number(params[cycleId] ?? 30)));
		}
		return reduced ? CYCLES : Math.min(CYCLES, t * RATE);
	});
	const played = $derived(mode === 'doubling' && playing ? Math.floor(shown) : null);
	$effect(() => {
		const v = played;
		const id = cycleId;
		if (v !== null && id) untrack(() => setParam(id, v));
	});

	interface Curve {
		id: string;
		run: Run;
		color: string;
		label: string;
		faint?: boolean;
	}
	const COLORS = ['var(--pcr-primer)', 'var(--pcr-target)', 'var(--pcr-virus)'];
	const SERIES = [1, 2, 3, 4, 5, 6];
	const curves = $derived.by((): Curve[] => {
		if (mode === 'doubling')
			return [{ id: 'one', run: amplify(1), color: 'var(--pcr-target)', label: '1 copy' }];
		if (mode === 'plateau')
			return [1, 3, 5].map((p, i) => ({
				id: `p${p}`,
				run: amplify(10 ** p),
				color: COLORS[i],
				label: (10 ** p).toLocaleString('en-US')
			}));
		if (mode === 'threshold') {
			const refs: Curve[] = [0, 3]
				.filter((p) => p !== startPower)
				.map((p) => ({
					id: `ref${p}`,
					run: amplify(10 ** p),
					color: 'var(--stage-ink-muted)',
					label: (10 ** p).toLocaleString('en-US'),
					faint: true
				}));
			return [
				...refs,
				{
					id: 'chosen',
					run: amplify(10 ** startPower),
					color: 'var(--pcr-target)',
					label: (10 ** startPower).toLocaleString('en-US')
				}
			];
		}
		return SERIES.map((p, i) => ({
			id: `s${p}`,
			run: amplify(10 ** p, CYCLES, efficiency),
			color: i % 2 === 0 ? 'var(--pcr-target)' : 'var(--pcr-primer)',
			label: (10 ** p).toLocaleString('en-US')
		}));
	});

	// ---- the plot --------------------------------------------------------------------------------
	const PX0 = 352;
	const PX1 = 916;
	const PY0 = 500;
	const PY1 = 78;
	const sx = scale([0, CYCLES], [PX0, PX1]);
	const LOG_MAX = 13;
	const LIN_MAX = 7;
	const syLog = scale([0, LOG_MAX], [PY0, PY1]);
	const syLin = scale([0, LIN_MAX], [PY0, PY1]);
	const yOf = (n: number) => (linear ? syLin(n / 1e12) : syLog(Math.log10(Math.max(1, n))));
	const yTicks = $derived(
		linear ? [0, 1, 2, 3, 4, 5, 6, 7] : Array.from({ length: LOG_MAX + 1 }, (_, i) => i)
	);
	const yFormat = $derived((v: number) =>
		linear ? (v % 2 === 0 ? String(v) : '') : powerLabel(v)
	);

	function path(run: Run, upTo: number) {
		let d = '';
		const end = Math.max(0, upTo);
		for (let c = 0; c <= end + 1e-9; c += 0.25) {
			d += `${d ? 'L' : 'M'}${sx(c).toFixed(1)} ${yOf(copiesAt(run, c)).toFixed(1)}`;
		}
		if (end % 0.25 > 1e-9) d += `L${sx(end).toFixed(1)} ${yOf(copiesAt(run, end)).toFixed(1)}`;
		return d;
	}
	const drawn = $derived(
		curves.map((c) => ({
			...c,
			d: path(c.run, shown),
			ct: thresholdCycle(c.run),
			tip: { x: sx(shown), y: yOf(copiesAt(c.run, shown)) }
		}))
	);
	/** Where a plateau curve is labelled: half its final height (plain scale) or 10 million. */
	function halfway(run: Run) {
		const target = linear ? (run.copies.at(-1) ?? 0) / 2 : 1e7;
		const i = run.copies.findIndex((n) => n >= target);
		return i < 0 ? CYCLES : i;
	}
	const refNames = $derived(
		startPower === 0 ? '1,000 copies' : startPower === 3 ? '1 copy' : '1 copy and 1,000 copies'
	);
	/** The threshold cycles of 1 and 1,000 copies, when both are on the plot. */
	const gap = $derived.by(() => {
		if (mode !== 'threshold') return null;
		const ct1 = thresholdCycle(amplify(1));
		const ct1000 = thresholdCycle(amplify(1000));
		return ct1 === null || ct1000 === null ? null : { from: ct1000, width: ct1 - ct1000 };
	});
	const main = $derived(drawn[drawn.length - 1]);
	const mainNow = $derived(copiesAt(main.run, shown));
	const lineY = $derived(yOf(THRESHOLD));
	const crossed = $derived(main.ct !== null && shown >= main.ct);

	// ---- the tube(s) -------------------------------------------------------------------------------
	const glowOf = (n: number) => smoothstep(9.6, 12.4, Math.log10(Math.max(1, n)));
	const tubes = $derived.by(() => {
		if (mode === 'plateau')
			return drawn.map((c, i) => ({
				id: c.id,
				x: 52 + i * 92,
				y: 150,
				w: 56,
				h: 190,
				glow: glowOf(copiesAt(c.run, shown)),
				label: c.label,
				color: c.color
			}));
		if (mode === 'standard') return [];
		return [
			{ id: 'tube', x: 120, y: 96, w: 110, h: 230, glow: glowOf(mainNow), label: '', color: '' }
		];
	});
	const fraction = $derived.by(() => {
		const r = main.run;
		const i = Math.min(r.primers.length - 1, Math.floor(shown));
		return { primers: r.primers[i], blocks: r.nucleotides[i] };
	});

	// ---- the standard curve inset ---------------------------------------------------------------
	const IX0 = 104;
	const IX1 = 290;
	const IY0 = 470;
	const IY1 = 150;
	const isx = scale([0, 7], [IX0, IX1]);
	const INSET_X: Record<number, string> = { 0: '1', 2: '100', 4: '10,000', 6: '1 million' };
	const isy = scale([5, 40], [IY0, IY1]);
	const points = $derived(
		drawn.map((c, i) => ({ id: c.id, p: SERIES[i], ct: c.ct ?? 0, color: c.color }))
	);
	const slope = $derived(
		points.length > 1
			? (points[0].ct - points[points.length - 1].ct) / (points[points.length - 1].p - points[0].p)
			: 0
	);
</script>

<g>
	<!-- ---------------------------------------------------------------- the plot -->
	<Axes
		{sx}
		sy={linear ? syLin : syLog}
		{yTicks}
		{yFormat}
		xTicks={[0, 10, 20, 30, 40]}
		xLabel="cycle"
	/>
	<Readout id="yaxis" label={linear ? 'Copies, plain scale' : 'Copies, ×10 per line'}>
		<Label
			anchor="start"
			x={PX0 - 50}
			y={PY1 - 22}
			text={linear ? 'copies (million million)' : 'copies (each line ×10)'}
			size={12}
			muted
		/>
	</Readout>

	{#if mode !== 'doubling' && mode !== 'plateau'}
		<line
			x1={PX0}
			x2={PX1}
			y1={lineY}
			y2={lineY}
			stroke="var(--pcr-line)"
			stroke-width="1.6"
			stroke-dasharray="7 5"
		/>
		<Readout id="line" label="Dashed: the detection line, 10 billion copies">
			<Label
				x={PX1}
				y={lineY - 8}
				text="detection line: 10 billion copies"
				size={12}
				anchor="end"
				color="var(--pcr-line)"
			/>
		</Readout>
	{/if}

	{#each drawn as c (c.id)}
		<path
			d={c.d}
			fill="none"
			stroke={c.color}
			stroke-width={c.faint ? 1.6 : 2.6}
			stroke-dasharray={c.faint ? '5 4' : undefined}
			opacity={c.faint ? 0.8 : 1}
		/>
	{/each}

	{#if mode === 'doubling'}
		<circle
			cx={main.tip.x}
			cy={main.tip.y}
			r="6"
			fill="var(--pcr-target)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<Readout
			id="now"
			order={1}
			label="Cycle {Math.floor(shown)}"
			value="{count(copiesAt(main.run, Math.floor(shown)))} copies"
		>
			<Label
				anchor="start"
				x={PX0}
				y={40}
				text="cycle {Math.floor(shown)} · {count(copiesAt(main.run, Math.floor(shown)))} copies"
				size={17}
				weight={700}
				tabular
			/>
		</Readout>
		{#if shown >= 30}
			<Readout id="billion">
				<circle cx={sx(30)} cy={yOf(copiesAt(main.run, 30))} r="4" fill="var(--pcr-target)" />
				<Label
					x={sx(30) - 10}
					y={yOf(copiesAt(main.run, 30)) - 12}
					text="cycle 30: about a billion"
					size={12}
					anchor="end"
				/>
			</Readout>
		{/if}
	{/if}

	{#if mode === 'plateau'}
		{#each drawn as c, i (c.id)}
			{@const at = halfway(c.run)}
			<Readout
				id="lab-{c.id}"
				order={2 + i}
				label="{c.label} at the start"
				value="{count(copiesAt(c.run, shown))} now"
				color={c.color}
			>
				<Label
					x={sx(at) - 8}
					y={yOf(copiesAt(c.run, at)) + 4}
					text={c.label}
					size={12}
					anchor="end"
					color={c.color}
					weight={600}
				/>
			</Readout>
		{/each}
		<Readout
			id="plateau"
			order={1}
			label="Cycle {Math.floor(shown)}"
			value="the three end at the same height"
		>
			<Label
				anchor="start"
				x={PX0}
				y={40}
				text={shown >= 44
					? 'all three end at the same height: the primers ran out'
					: `cycle ${Math.floor(shown)}`}
				size={16}
				weight={700}
			/>
		</Readout>
	{/if}

	{#if mode === 'threshold' || mode === 'standard'}
		{#each drawn as c (c.id)}
			{#if c.ct !== null && shown >= c.ct && !(mode === 'standard' && c.id !== 's1' && c.id !== 's6')}
				<line
					x1={sx(c.ct)}
					x2={sx(c.ct)}
					y1={lineY}
					y2={PY0}
					stroke={c.faint ? 'var(--stage-ink-muted)' : c.color}
					stroke-width="1.2"
					stroke-dasharray="3 3"
				/>
				<circle
					cx={sx(c.ct)}
					cy={lineY}
					r={c.faint ? 3.5 : 5}
					fill={c.faint ? 'var(--stage-ink-muted)' : c.color}
				/>
			{/if}
		{/each}
	{/if}

	{#if mode === 'threshold'}
		{#each drawn.filter((c) => c.faint) as c (c.id)}
			{#if c.ct !== null && shown >= c.ct}
				<Readout id="ref-{c.id}">
					<Label
						x={sx(c.ct) + 6}
						y={lineY + 34 + (c.id === 'ref0' ? 18 : 0)}
						text="{c.id === 'ref0' ? '1 copy' : '1,000'}: Ct {c.ct.toFixed(1)}"
						size={11}
						muted
						anchor="start"
					/>
				</Readout>
			{/if}
		{/each}
		<!-- one copy against a thousand: about ten cycles apart -->
		{#if gap && shown >= gap.from + gap.width}
			{@const y = PY0 - 34}
			<line
				x1={sx(gap.from)}
				x2={sx(gap.from + gap.width)}
				y1={y}
				y2={y}
				stroke="var(--stage-ink)"
				stroke-width="1.4"
				marker-end="url(#arrowhead)"
				marker-start="url(#arrowhead)"
			/>
			<Readout
				id="gap"
				order={2}
				label="1 copy against 1,000"
				value="{gap.width.toFixed(1)} cycles later"
			>
				<Label
					x={sx(gap.from + gap.width / 2)}
					y={y - 10}
					text="{gap.width.toFixed(1)} cycles"
					size={12}
					weight={600}
				/>
			</Readout>
		{/if}
		<Readout
			id="ct"
			order={1}
			label="Copies at the start · Ct"
			value="{main.label} · {crossed && main.ct !== null ? main.ct.toFixed(1) : '…'}"
		>
			<Label
				anchor="start"
				x={PX0}
				y={40}
				text="{main.label} cop{main.label === '1' ? 'y' : 'ies'} at the start · {crossed &&
				main.ct !== null
					? `crossed the line at cycle ${main.ct.toFixed(1)} (Ct)`
					: `cycle ${Math.floor(shown)}`}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="refkey" label="Faint dashed curves: {refNames}">
			<Label
				anchor="start"
				x={PX0 + 10}
				y={PY1 + 10}
				text="faint: {refNames}, for comparison"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- tubes -->
	{#each tubes as tb (tb.id)}
		{@const outline = tubePath(tb.x, tb.y, tb.w, tb.h)}
		<clipPath id="pcr-curve-clip-{tb.id}"><path d="{outline} Z" /></clipPath>
		<path d="{outline} Z" fill="var(--stage-bg)" />
		<rect
			x={tb.x}
			y={tb.y + tb.h * 0.35}
			width={tb.w}
			height={tb.h * 0.65}
			fill="var(--pcr-liquid)"
			clip-path="url(#pcr-curve-clip-{tb.id})"
		/>
		<rect
			x={tb.x}
			y={tb.y + tb.h * 0.35}
			width={tb.w}
			height={tb.h * 0.65}
			fill="var(--pcr-glow)"
			opacity={0.9 * tb.glow}
			clip-path="url(#pcr-curve-clip-{tb.id})"
			filter={tb.glow > 0.05 ? 'url(#glow)' : undefined}
		/>
		<path d={outline} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" />
		<rect
			x={tb.x - 6}
			y={tb.y - 12}
			width={tb.w + 12}
			height="12"
			rx="4"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		{#if tb.label}
			<Readout id="tl-{tb.id}">
				<Label
					x={tb.x + tb.w / 2}
					y={tb.y + tb.h + 24}
					text={tb.label}
					size={12}
					weight={600}
					color={tb.color}
				/>
			</Readout>
		{/if}
	{/each}
	{#if mode === 'plateau'}
		<Readout id="tubes-cap">
			<Label x={150} y={120} text="copies at the start" size={12} muted />
		</Readout>
	{/if}

	{#if mode === 'doubling'}
		{#each [{ id: 'primers', label: 'primers left', v: fraction.primers, y: 400 }, { id: 'blocks', label: 'building blocks left', v: fraction.blocks, y: 460 }] as g, i (g.id)}
			<rect x={60} y={g.y} width={230} height={14} rx="7" fill="var(--stage-grid)" />
			<rect
				x={60}
				y={g.y}
				width={230 * g.v}
				height={14}
				rx="7"
				fill={g.id === 'primers' ? 'var(--pcr-primer)' : 'var(--pcr-long)'}
			/>
			<Readout id="gauge-{g.id}" order={2 + i} label={g.label} value="{Math.round(100 * g.v)}%">
				<Label anchor="start" x={60} y={g.y - 8} text={g.label} size={12} />
				<Label
					x={290}
					y={g.y - 8}
					text="{Math.round(100 * g.v)}%"
					size={12}
					anchor="end"
					tabular
					weight={600}
				/>
			</Readout>
		{/each}
	{/if}

	{#if mode === 'threshold'}
		<Readout id="glow">
			<Label
				x={175}
				y={366}
				text={crossed ? 'glowing: detected' : 'dark: not yet detected'}
				size={13}
				weight={600}
				color={crossed ? 'var(--pcr-glow)' : undefined}
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- the standard curve -->
	{#if mode === 'standard'}
		<Axes
			sx={isx}
			sy={isy}
			xTicks={[0, 2, 4, 6]}
			yTicks={[10, 20, 30, 40]}
			xFormat={(v: number) => INSET_X[v] ?? ''}
			xLabel="start (×10 per step)"
		/>
		<Readout id="inset-title">
			<Label
				anchor="start"
				x={IX0 - 40}
				y={IY1 - 22}
				text="Ct against the copies at the start"
				size={12}
				weight={600}
			/>
		</Readout>
		<line
			x1={isx(points[0].p)}
			x2={isx(points[points.length - 1].p)}
			y1={isy(points[0].ct)}
			y2={isy(points[points.length - 1].ct)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
		/>
		{#each points as p (p.id)}
			{#if shown >= p.ct}
				<circle
					cx={isx(p.p)}
					cy={isy(p.ct)}
					r="5"
					fill={p.color}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		{/each}
		<Readout
			id="slope"
			order={1}
			label="Each tenfold more at the start"
			value="{slope.toFixed(2)} cycles sooner"
		>
			<Label
				anchor="start"
				x={PX0}
				y={40}
				text="each tenfold more copies: Ct {slope.toFixed(2)} cycles sooner"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="series">
			<Label
				x={sx(points[points.length - 1].ct) - 6}
				y={lineY - 10}
				text="1 million"
				size={11}
				anchor="end"
				color="var(--pcr-primer)"
			/>
			<Label
				x={sx(points[0].ct) + 6}
				y={lineY + 18}
				text="10"
				size={11}
				anchor="start"
				color="var(--pcr-target)"
			/>
		</Readout>
	{/if}
</g>
