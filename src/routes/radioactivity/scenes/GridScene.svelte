<script lang="ts">
	/**
	 * A sample of unstable nuclei: a grid of squares (intact or decayed) and a
	 * live plot of how many are left, against the expected curve N₀·2^(−t/T½).
	 *
	 * Views (`step.hints.view`):
	 *   random   — the grid, one circled nucleus and its fate, the count only
	 *   halflife — grid + plot with the expected curve, marks at 1–3 half-lives
	 *   quarter  — as halflife, stops at `stopAt` half-lives; a straight
	 *              "steady rate" line shows the misconception
	 *   many     — sample size from the `count` control, plot in % with a ±2σ band
	 *
	 * Each nucleus's lifetime (in half-lives) is drawn once per sample from a
	 * seeded exponential distribution (model.ts); every frame is then a pure
	 * function of the simulated time. "Run again" changes the seed and replays
	 * from zero at the current `t` (the same documented exception as the
	 * epidemics crowd); the half-life slider does not restart, it shows the same
	 * nuclei at the same moment with the new pace — eased over a few hundred
	 * milliseconds rather than snapped.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, linePath, areaPath, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { expected, makeSample, spread, survivors, lastDecay } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'halflife'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const halfLife = $derived(offered.has('halflife') ? Number(params.halflife) : 8);
	const n0 = $derived(offered.has('count') ? Number(params.count) : 1000);
	const rerun = $derived(offered.has('rerun') ? Number(params.rerun ?? 0) : 0);
	const seed = $derived(Number(step.hints?.seed ?? 1) + 7919 * rerun);
	const stopAt = $derived(step.hints?.stopAt === undefined ? Infinity : Number(step.hints.stopAt));
	const sample = $derived(makeSample(n0, seed));

	// The half-life the picture is drawn for: the slider's value, eased.
	const halfT = Tween.of(() => halfLife, { duration: 400, easing: cubicInOut });
	const half = $derived(reduced ? halfLife : halfT.current);

	/** Length of a run, in simulated seconds (the plot's x axis). */
	const END = 60;
	const LEAD = 0.8;

	// `t` when the current sample started: "Run again" replays from zero.
	let startedAt = 0;
	let startedFor = -1;
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (rerun !== startedFor || t < lastT) {
			startedAt = startedFor === -1 || t < lastT ? 0 : t;
			startedFor = rerun;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});

	const stopTime = $derived(Math.min(END, stopAt * half));
	/** Simulated seconds. Reduced motion: a complete frame at 2 (or 3) half-lives. */
	const sec = $derived(
		reduced
			? Math.min(stopTime, (view === 'halflife' ? 3 : view === 'random' ? 1.5 : 2) * half)
			: Math.min(stopTime, Math.max(0, tRun - LEAD))
	);
	const halves = $derived(sec / half);
	const left = $derived(survivors(sample, halves));
	const over = $derived(sec >= stopTime);
	const pct = $derived(view === 'many');

	// ---- the grid --------------------------------------------------------------
	const GX = 36;
	const GY = 104;
	const GW = 480;
	const GH = 300;
	const layout = $derived.by(() => {
		const cols = Math.ceil(Math.sqrt((n0 * GW) / GH));
		const rows = Math.ceil(n0 / cols);
		const pitch = Math.min(GW / cols, GH / rows, 48);
		const x0 = GX + (GW - cols * pitch) / 2;
		const y0 = GY + (GH - rows * pitch) / 2;
		const size = pitch * 0.78;
		const cells = Array.from({ length: n0 }, (_, k) => ({
			x: x0 + (k % cols) * pitch + (pitch - size) / 2,
			y: y0 + Math.floor(k / cols) * pitch + (pitch - size) / 2
		}));
		return { cols, pitch, size, cells };
	});
	const square = (x: number, y: number, s: number) =>
		`M${x.toFixed(1)} ${y.toFixed(1)}h${s.toFixed(1)}v${s.toFixed(1)}h${(-s).toFixed(1)}z`;
	const gridPaths = $derived.by(() => {
		let on = '';
		let off = '';
		let ring = '';
		const { cells, size } = layout;
		const flashFor = reduced ? 0 : 0.6; // simulated seconds a ring stays visible
		for (let k = 0; k < n0; k++) {
			const c = cells[k];
			const lifeSec = sample.life[k] * half;
			if (lifeSec > sec) on += square(c.x, c.y, size);
			else {
				off += square(c.x, c.y, size);
				const age = sec - lifeSec;
				if (age < flashFor) {
					const grow = (size / 2) * (0.9 + 0.9 * (age / flashFor));
					const cx = c.x + size / 2;
					const cy = c.y + size / 2;
					ring += `M${(cx - grow).toFixed(1)} ${cy.toFixed(1)}a${grow.toFixed(1)} ${grow.toFixed(1)} 0 1 0 ${(2 * grow).toFixed(1)} 0a${grow.toFixed(1)} ${grow.toFixed(1)} 0 1 0 ${(-2 * grow).toFixed(1)} 0`;
				}
			}
		}
		return { on, off, ring };
	});

	// The circled nucleus (random view): a fixed place in the grid, so its fate is pure luck.
	const FOCUS = 492;
	const focusCell = $derived(layout.cells[Math.min(FOCUS, n0 - 1)]);
	const focusLife = $derived(sample.life[Math.min(FOCUS, n0 - 1)] * half);
	const focusGone = $derived(focusLife <= sec);

	// ---- the plot --------------------------------------------------------------
	const PX0 = 600;
	const PX1 = 916;
	const PY0 = 128;
	const PY1 = 384;
	const yMax = $derived(pct ? 100 : 1000);
	const toY = (n: number) => (pct ? (100 * n) / n0 : n);
	const sx = scale([0, END], [PX0, PX1]);
	const sy = $derived(scale([0, yMax], [PY1, PY0]));

	/** The sample's count so far, as a staircase. */
	const simPath = $derived.by(() => {
		const s = sample.sorted;
		let d = `M${sx(0).toFixed(1)} ${sy(toY(n0)).toFixed(1)}`;
		let n = n0;
		for (let i = 0; i < s.length; i++) {
			const at = s[i] * half;
			if (at > sec) break;
			const x = sx(at).toFixed(1);
			d += `H${x}V${sy(toY(--n)).toFixed(1)}`;
		}
		return d + `H${sx(sec).toFixed(1)}`;
	});
	const curve = $derived(
		Array.from({ length: 121 }, (_, i) => {
			const at = (i / 120) * END;
			return { at, n: expected(n0, at, half), s: spread(n0, at, half) };
		})
	);
	const expectedPath = $derived(
		linePath(
			curve,
			(c) => c.at,
			(c) => toY(c.n),
			sx,
			sy
		)
	);
	const band = $derived(
		areaPath(
			curve,
			(c) => c.at,
			(c) => toY(Math.max(0, c.n - 2 * c.s)),
			(c) => toY(Math.min(n0, c.n + 2 * c.s)),
			sx,
			sy
		)
	);
	const showExpected = $derived(view !== 'random');

	// Whole half-lives that fit on the axis (at most three): the cards under
	// the grid take them all; the plot's marks are thinned when they would
	// crowd (a short half-life puts them a few pixels apart).
	const cardMarks = $derived(
		[1, 2, 3]
			.filter((k) => k * half <= END && k <= stopAt)
			.map((k) => ({
				k,
				at: k * half,
				exp: expected(n0, k * half, half),
				got: survivors(sample, k),
				reached: sec >= k * half - 1e-9
			}))
	);
	const marks = $derived.by(() => {
		const gap = (36 / (PX1 - PX0)) * END; // seconds spanning 36 px of the axis
		const out: typeof cardMarks = [];
		for (const m of cardMarks) {
			if (out.length && m.at - out[out.length - 1].at < gap) continue;
			out.push(m);
		}
		return out;
	});
	const fractions = ['½', '¼', '⅛'];
	const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
	const showCount = (n: number) =>
		pct ? `${Number(((100 * n) / n0).toFixed(1)).toLocaleString('en-US')}%` : fmt(n);

	// Decays in the last simulated second (random view).
	const lastSecond = $derived(survivors(sample, Math.max(0, sec - 1) / half) - left);

	/** Two lines under the plot: what is happening, and how it compares. */
	const status = $derived.by((): [string, string] => {
		if (view === 'quarter' && over)
			return [
				`Stopped at 2 half-lives: ${fmt(left)} left`,
				`expected ${fmt(expected(n0, 2, 1))}: a quarter, not zero`
			];
		if (left === 0)
			return ['All decayed', `the last one after ${(lastDecay(sample) * half).toFixed(1)} s`];
		const line1 = `${halves.toFixed(1)} half-lives: ${fmt(left)} left${pct ? ` (${showCount(left)})` : ''}`;
		if (!showExpected) return [line1, over ? `after ${END} s` : ''];
		return [line1, `expected ${showCount(expected(n0, sec, half))}`];
	});

	const legend = $derived([
		{ id: 'sim', text: 'this sample', color: 'var(--rad-parent)', width: 2.4, dash: undefined },
		...(showExpected
			? [
					{
						id: 'exp',
						text: `${fmt(n0)} × ½ every half-life`,
						color: 'var(--rad-expected)',
						width: 1.6,
						dash: '6 5'
					}
				]
			: []),
		...(view === 'many'
			? [{ id: 'band', text: '±2 standard deviations', color: '', width: 0, dash: undefined }]
			: []),
		...(view === 'quarter'
			? [
					{
						id: 'steady',
						text: 'a steady rate: none left at 2 half-lives',
						color: 'var(--rad-alpha)',
						width: 1.6,
						dash: '1.5 4'
					}
				]
			: [])
	]);
	const statusY = $derived(438 + legend.length * 22 + 18);

	const fade = $derived(reduced ? 1 : smoothstep(0, 0.6, tRun));
</script>

<g opacity={fade}>
	<!-- header -->
	<text
		x={GX}
		y={52}
		style:font-size="16px"
		font-weight="600"
		style:font-variant-numeric="tabular-nums">{sec.toFixed(1)} s</text
	>
	<text x={GX + 76} y={52} class="muted">half-life {half} s</text>
	<g style:font-variant-numeric="tabular-nums">
		<rect x={GX} y={70} width="11" height="11" rx="2" fill="var(--rad-parent)" />
		<text x={GX + 18} y={80}>Intact</text>
		<text x={GX + 70} y={80} font-weight="600">{fmt(left)}</text>
		<rect x={GX + 130} y={70} width="11" height="11" rx="2" fill="var(--rad-daughter)" />
		<text x={GX + 148} y={80}>Decayed</text>
		<text x={GX + 212} y={80} font-weight="600">{fmt(n0 - left)}</text>
	</g>

	<!-- grid of nuclei -->
	<path d={gridPaths.off} fill="var(--rad-daughter)" />
	<path d={gridPaths.on} fill="var(--rad-parent)" />
	<path d={gridPaths.ring} fill="none" stroke="var(--rad-flash)" stroke-width="1.5" />

	{#if view === 'random'}
		{@const pad = layout.pitch * 0.55}
		<rect
			x={focusCell.x - pad}
			y={focusCell.y - pad}
			width={layout.size + 2 * pad}
			height={layout.size + 2 * pad}
			rx="5"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Label x={focusCell.x + layout.size / 2} y={focusCell.y - pad - 10} text="this one" pill />
		<g style:font-variant-numeric="tabular-nums">
			<text x={GX} y={448} style:font-size="15px" font-weight="600">The circled nucleus</text>
			<text x={GX} y={472}>
				{focusGone
					? `decayed after ${focusLife.toFixed(1)} s — nobody could have said when`
					: `still intact after ${sec.toFixed(1)} s, and no more likely to decay now than at the start`}
			</text>
			<text x={GX} y={512} style:font-size="15px" font-weight="600">Decays in the last second</text>
			<text x={GX} y={536}>
				{lastSecond}
				{lastSecond === 1 ? 'nucleus' : 'nuclei'}: fewer left, so fewer decays
			</text>
		</g>
	{:else}
		<!-- what is left after each half-life -->
		<g style:font-variant-numeric="tabular-nums">
			<text x={GX} y={444} style:font-size="15px" font-weight="600">After each half-life</text>
			{#each cardMarks as m (m.k)}
				{@const x = GX + (m.k - 1) * 164}
				{@const hot = view === 'quarter' && m.k === 2}
				<rect
					{x}
					y={458}
					width="150"
					height="96"
					rx="10"
					fill="var(--surface)"
					stroke={hot ? 'var(--rad-flash)' : 'var(--border)'}
					stroke-width={hot ? 2 : 1}
				/>
				<text x={x + 12} y={480} class="muted"
					>{m.k} half-li{m.k === 1 ? 'fe' : 'ves'} · {fmt(m.at)} s</text
				>
				<text x={x + 12} y={508} style:font-size="20px" font-weight="600">{fractions[m.k - 1]}</text
				>
				<text x={x + 40} y={507}>expected {showCount(m.exp)}</text>
				<text
					x={x + 12}
					y={538}
					style:fill={m.reached ? 'var(--stage-ink)' : 'var(--stage-ink-muted)'}
				>
					{m.reached ? `this sample: ${showCount(m.got)}` : 'this sample: …'}
				</text>
			{/each}
			{#if cardMarks.length === 0}
				<text x={GX} y={480} class="muted">The first half-life ends after the 60 s shown.</text>
			{/if}
		</g>
	{/if}

	<!-- plot -->
	<text x={PX0} y={100} style:font-size="15px" font-weight="600">Nuclei left</text>
	<Axes
		{sx}
		{sy}
		xLabel="seconds"
		yFormat={pct ? (v) => `${v}%` : undefined}
		xTicks={[0, 10, 20, 30, 40, 50, 60]}
	/>
	{#if view === 'many'}
		<path d={band} fill="var(--rad-parent)" opacity="0.16" />
	{/if}
	{#if showExpected}
		{#each marks as m (m.k)}
			<line
				x1={sx(m.at)}
				x2={sx(m.at)}
				y1={sy(toY(m.exp))}
				y2={PY1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
				opacity="0.7"
			/>
			<circle cx={sx(m.at)} cy={sy(toY(m.exp))} r="3.5" fill="var(--rad-expected)" />
		{/each}
		<path
			d={expectedPath}
			fill="none"
			stroke="var(--rad-expected)"
			stroke-width="1.6"
			stroke-dasharray="6 5"
		/>
	{/if}
	{#if view === 'quarter'}
		<!-- the misconception: a steady rate would empty the sample at 2 half-lives -->
		<line
			x1={sx(0)}
			y1={sy(1000)}
			x2={sx(2 * half)}
			y2={sy(0)}
			stroke="var(--rad-alpha)"
			stroke-width="1.6"
			stroke-dasharray="1.5 4"
			stroke-linecap="round"
		/>
	{/if}
	<path
		d={simPath}
		fill="none"
		stroke="var(--rad-parent)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>
	<circle cx={sx(sec)} cy={sy(toY(left))} r="4" fill="var(--rad-parent)" />
	{#if showExpected && !pct}
		{#each marks as m (m.k)}
			<Label x={sx(m.at) + 8} y={sy(toY(m.exp)) - 8} text={showCount(m.exp)} anchor="start" muted />
		{/each}
	{/if}

	<!-- legend: one row per series -->
	<g>
		{#each legend as row, i (row.id)}
			{@const y = 438 + i * 22}
			{#if row.id === 'band'}
				<rect x={PX0} y={y - 5} width="24" height="10" fill="var(--rad-parent)" opacity="0.16" />
			{:else}
				<line
					x1={PX0}
					x2={PX0 + 24}
					y1={y}
					y2={y}
					stroke={row.color}
					stroke-width={row.width}
					stroke-dasharray={row.dash}
					stroke-linecap={row.id === 'steady' ? 'round' : 'butt'}
				/>
			{/if}
			<text x={PX0 + 34} y={y + 4}>{row.text}</text>
		{/each}
	</g>
	<g style:font-variant-numeric="tabular-nums">
		<text x={PX0} y={statusY} font-weight="600">{status[0]}</text>
		<text x={PX0} y={statusY + 20} class="muted">{status[1]}</text>
	</g>
</g>
