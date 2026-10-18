<script lang="ts">
	/**
	 * Hovmöller strips of Lorenz 96 (cells across, time down, 6 hours per row): the truth, the
	 * forecast (or, in the cycle, the analysis) and their difference, revealed day by day; beside
	 * them the RMS error against time on a log scale, where doubling is a straight line, with the
	 * climate's spread (the end of a useful forecast) marked.
	 *
	 * Hints: `focus` 'truth' (the truth strip and the circle of cells now) | 'single' (one
	 * forecast) | 'tenfold' (error curves averaged over 30 days for four measurement errors) |
	 * 'cycle' (the forecast–observe–correct cycle against a free forecast). `seed`: the day.
	 * The strips are painted once per run into images; time only moves a clip, and reduced
	 * motion shows all 30 days.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CLIMATE, K, PER_DAY, STEPS_PER_DAY, horizon } from '../model';
	import {
		cachedCycle,
		cachedForecast,
		cachedVerify,
		cssColours,
		errorColour,
		paintRows,
		settings,
		sig,
		valueColour,
		type RGB
	} from '../look';

	let { step, t, reduced, dark, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'single'));
	const s = $derived(settings(step, params));
	const DAYS = 30;
	/** Days revealed per second. */
	const SPEED = 1.5;
	const shown = $derived(reduced ? DAYS : Math.min(DAYS, t * SPEED));
	const shownStep = $derived(Math.min(DAYS * STEPS_PER_DAY, Math.floor(shown * STEPS_PER_DAY)));

	// ---- the runs ----------------------------------------------------------------------------
	const run = $derived.by(() => {
		if (focus === 'cycle') {
			const c = cachedCycle(s.seed, DAYS);
			return { truth: c.truth, fc: c.analysis, err: c.anaErr, free: c.freeErr };
		}
		const f = cachedForecast(s.seed, s.obsErr, 1, 8, DAYS);
		return { truth: f.truth, fc: f.control, err: f.err, free: null };
	});
	const diff = $derived(run.fc.map((row, i) => row.map((v, k) => v - run.truth[i][k])));
	const OPTIONS = [1, 0.3, 0.03, 0.003];
	const curves = $derived(
		focus === 'tenfold'
			? OPTIONS.map((e) => {
					const err = cachedVerify(e, 1, 8, DAYS).err;
					return { e, err, h: horizon(err) };
				})
			: []
	);
	const h = $derived(
		focus === 'tenfold'
			? (curves.find((c) => c.e === s.obsErr)?.h ?? Infinity)
			: focus === 'single'
				? horizon(run.err)
				: Infinity
	);

	// ---- colours and images ------------------------------------------------------------------
	let palette = $state<RGB[] | null>(null);
	$effect(() => {
		void dark;
		palette = cssColours(['--ewf-cold', '--ewf-mid', '--ewf-warm', '--ewf-hot']);
	});
	const value = (v: number): RGB =>
		palette ? valueColour(v, palette[0], palette[1], palette[2]) : [128, 128, 128];
	const truthImg = $derived(palette ? paintRows(run.truth, value) : '');
	const fcImg = $derived(palette && focus !== 'truth' ? paintRows(run.fc, value) : '');
	const diffImg = $derived(
		palette && focus !== 'truth'
			? paintRows(diff, (e) => errorColour(e, palette![1], palette![3]))
			: ''
	);
	const rgb = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

	// ---- geometry ----------------------------------------------------------------------------
	const PX = [70, 280, 490];
	const PW = 180;
	const Y0 = 100;
	const PH = 390;
	const ROW = PH / (DAYS * STEPS_PER_DAY);
	const dayY = (d: number) => Y0 + (d / DAYS) * PH;
	const EX0 = 730;
	const EX1 = 925;
	const sx = scale([-3, 1], [EX0, EX1]);
	const sy = scale([0, DAYS], [Y0, Y0 + PH]);
	const ex = (e: number) => sx(Math.log10(Math.max(1e-3, Math.min(10, e))));
	const errPath = (err: readonly number[], upto: number) => {
		let d = '';
		for (let i = 0; i <= upto && i < err.length; i++)
			d += `${i ? 'L' : 'M'}${ex(err[i]).toFixed(1)} ${sy(i / STEPS_PER_DAY).toFixed(1)}`;
		return d;
	};
	const climX = ex(CLIMATE.sd);
	/** Days for an error to double in this model (Lorenz 96, F = 8, measured: 0.416 units). */
	const DOUBLING = 0.416 / PER_DAY;
	const guide = $derived.by(() => {
		const e0 = run.err[0];
		const d1 = (DOUBLING * Math.log2(10 / e0)) | 0;
		return `M${ex(e0)} ${sy(0)}L${ex(e0 * 2 ** (Math.min(DAYS, d1) / DOUBLING))} ${sy(Math.min(DAYS, d1))}`;
	});

	const titles = $derived(
		focus === 'cycle'
			? ['truth', 'analysis', 'analysis − truth']
			: ['truth', 'forecast', 'forecast − truth']
	);
	const nowY = $derived(dayY(shown));
	const rowNow = $derived(run.truth[shownStep]);

	// the circle of cells (truth focus)
	const CX = 480;
	const CY = 300;
	const R0 = 92;
	const R1 = 150;
	const wedge = (k: number) => {
		const a0 = -Math.PI / 2 - ((k - 0.5) / K) * 2 * Math.PI;
		const a1 = -Math.PI / 2 - ((k + 0.5) / K) * 2 * Math.PI;
		const p = (r: number, a: number) =>
			`${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
		return `M${p(R0, a0)}L${p(R1, a0)}A${R1} ${R1} 0 0 0 ${p(R1, a1)}L${p(R0, a1)}A${R0} ${R0} 0 0 1 ${p(R0, a0)}Z`;
	};
	const cellAt = (k: number, r: number) => {
		const a = -Math.PI / 2 - (k / K) * 2 * Math.PI;
		return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
	};
	const fmtDay = (d: number) => (Number.isFinite(d) ? d.toFixed(1) : `> ${DAYS}`);
	const headline = $derived(
		focus === 'truth'
			? 'Lorenz 96: forty cells, F = 8'
			: focus === 'cycle'
				? 'observe every other cell twice a day (error 1), then correct'
				: focus === 'tenfold'
					? 'error averaged over 30 days’ forecasts'
					: `one forecast from a measurement with error ${s.obsErr}`
	);
</script>

<g>
	<defs>
		<clipPath id="ewf-ring-clip">
			<rect x="0" y={Y0 - ROW / 2} width="960" height={Math.max(0, nowY - Y0 + ROW / 2)} />
		</clipPath>
		<linearGradient id="ewf-ring-value">
			<stop offset="0" stop-color="var(--ewf-cold)" />
			<stop offset="0.5" stop-color="var(--ewf-mid)" />
			<stop offset="1" stop-color="var(--ewf-warm)" />
		</linearGradient>
		<linearGradient id="ewf-ring-err">
			<stop offset="0" stop-color="var(--ewf-mid)" />
			<stop offset="1" stop-color="var(--ewf-hot)" />
		</linearGradient>
	</defs>

	<Readout id="title" order={1} label="Showing" value={headline}>
		<Label x={40} y={36} text={headline} size={15} weight={600} anchor="start" />
	</Readout>
	<Readout id="day" order={2} label="Time" value="day {shown.toFixed(1)}">
		<Label x={925} y={36} text="day {shown.toFixed(1)}" size={14} anchor="end" tabular />
	</Readout>

	<!-- the strips -->
	{#each PX as x, i (i)}
		{#if i === 0 || focus !== 'truth'}
			<Label x={x + PW / 2} y={Y0 - 16} text={titles[i]} size={13} weight={600} />
			<rect
				{x}
				y={Y0}
				width={PW}
				height={PH}
				fill="var(--stage-grid)"
				stroke="var(--stage-line)"
				stroke-width="1"
				opacity="0.5"
			/>
			{@const img = i === 0 ? truthImg : i === 1 ? fcImg : diffImg}
			{#if img}
				<image
					href={img}
					{x}
					y={Y0 - ROW / 2}
					width={PW}
					height={PH + ROW}
					preserveAspectRatio="none"
					clip-path="url(#ewf-ring-clip)"
					style="image-rendering: pixelated"
				/>
			{/if}
			<rect
				{x}
				y={Y0}
				width={PW}
				height={PH}
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1"
			/>
			<Readout id="cells-{i}">
				<Label x={x + 2} y={Y0 + PH + 16} text="cell 1" size={11} muted anchor="start" />
				<Label x={x + PW - 2} y={Y0 + PH + 16} text="40" size={11} muted anchor="end" />
			</Readout>
		{/if}
	{/each}
	{#if focus === 'cycle'}
		{#each Array.from({ length: K / 2 }, (_, j) => 2 * j) as k (k)}
			<path d="M{PX[0] + (k + 0.5) * (PW / K)} {Y0 - 2} l-2.5 -5 l5 0 Z" fill="var(--ewf-obs)" />
		{/each}
	{/if}

	<!-- days down the left -->
	{#each [0, 5, 10, 15, 20, 25, 30] as d (d)}
		<Readout id="d{d}">
			<Label x={PX[0] - 8} y={dayY(d) + 4} text={String(d)} size={11} muted anchor="end" />
		</Readout>
	{/each}
	<Readout id="days-title">
		<Label x={PX[0] - 30} y={Y0 + PH / 2} text="days" size={11} muted rotate={-90} />
	</Readout>

	<!-- now -->
	{#if shown < DAYS}
		<line
			x1={PX[0]}
			x2={focus === 'truth' ? PX[0] + PW : EX1}
			y1={nowY}
			y2={nowY}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			opacity="0.7"
		/>
	{/if}

	<!-- colour keys -->
	<rect x={PX[0]} y={524} width={PW} height={10} rx="2" fill="url(#ewf-ring-value)" />
	<Readout id="key-value">
		<Label x={PX[0]} y={550} text="low" size={11} muted anchor="start" />
		<Label x={PX[0] + PW} y={550} text="high" size={11} muted anchor="end" />
	</Readout>
	{#if focus !== 'truth'}
		<rect x={PX[2]} y={524} width={PW} height={10} rx="2" fill="url(#ewf-ring-err)" />
		<Readout id="key-err">
			<Label x={PX[2]} y={550} text="same" size={11} muted anchor="start" />
			<Label x={PX[2] + PW} y={550} text="far apart" size={11} muted anchor="end" />
		</Readout>
	{/if}

	{#if focus === 'truth'}
		<!-- the circle of cells, now -->
		{#if palette}
			{#each Array.from({ length: K }, (_, k) => k) as k (k)}
				<path d={wedge(k)} fill={rgb(value(rowNow[k]))} stroke="var(--stage-bg)" stroke-width="1" />
			{/each}
		{/if}
		{#each [0, 10, 20, 30] as k (k)}
			{@const p = cellAt(k, R1 + 16)}
			<Label x={p.x} y={p.y + 4} text={String(k + 1)} size={12} muted />
		{/each}
		<Readout id="ring-caption" order={3} label="The ring" value="40 cells round a latitude circle">
			<Label x={CX} y={CY - 4} text="the circle" size={13} weight={600} />
			<Label x={CX} y={CY + 14} text="of latitude, now" size={13} weight={600} />
			<Label x={CX} y={CY + R1 + 50} text="cell 40 sits next to cell 1" size={12} muted />
		</Readout>
	{:else}
		<!-- the error against time -->
		<Axes
			{sx}
			{sy}
			xLabel="error"
			xTicks={[-3, -2, -1, 0, 1]}
			xFormat={(v) => String(10 ** v)}
			yTicks={[]}
		/>
		<Label x={(EX0 + EX1) / 2} y={Y0 - 16} text="size of the error" size={13} weight={600} />
		<line
			x1={climX}
			x2={climX}
			y1={Y0}
			y2={Y0 + PH}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			stroke-dasharray="5 4"
		/>
		<Readout id="clim">
			<Label x={climX - 5} y={Y0 + PH - 10} text="climate 3.6" size={11} anchor="end" />
		</Readout>
		{#if focus === 'single'}
			<path
				d={guide}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="2 4"
			/>
			<path
				d={errPath(run.err, shownStep)}
				fill="none"
				stroke="var(--ewf-hot)"
				stroke-width="2.5"
			/>
			<Readout
				id="err-now"
				order={3}
				label="Error now"
				value="{sig(run.err[shownStep])} (climate 3.6)"
			>
				<Label
					x={EX0}
					y={Y0 + PH + 50}
					text="error now {sig(run.err[shownStep])}"
					size={13}
					anchor="start"
					tabular
				/>
			</Readout>
			<Readout id="guide-key">
				<line
					x1={EX0}
					x2={EX0 + 24}
					y1={Y0 + PH + 68}
					y2={Y0 + PH + 68}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
					stroke-dasharray="2 4"
				/>
				<Label
					x={EX0 + 30}
					y={Y0 + PH + 72}
					text="doubling every 2.1 days"
					size={11}
					muted
					anchor="start"
				/>
			</Readout>
		{:else if focus === 'tenfold'}
			{#each curves as c (c.e)}
				{@const on = c.e === s.obsErr}
				<path
					d={errPath(c.err, shownStep)}
					fill="none"
					stroke={on ? 'var(--ewf-hot)' : 'var(--stage-ink-muted)'}
					stroke-width={on ? 2.5 : 1.4}
					opacity={on ? 1 : 0.7}
				/>
				<Readout id="start-{c.e}">
					<Label
						x={ex(c.e)}
						y={Y0 - 2}
						text={String(c.e)}
						size={11}
						weight={on ? 700 : 500}
						muted={!on}
					/>
				</Readout>
				{#if shown >= c.h}
					<circle
						cx={climX}
						cy={sy(c.h)}
						r="4"
						fill={on ? 'var(--ewf-hot)' : 'var(--stage-ink-muted)'}
					/>
				{/if}
			{/each}
			<Readout
				id="ranges"
				order={3}
				label="Useful range"
				value={curves.map((c) => `${c.e}: ${c.h.toFixed(1)} d`).join(', ')}
			>
				{#each curves as c, i (c.e)}
					<Label
						x={EX0 + (i % 2) * 100}
						y={Y0 + PH + 50 + Math.floor(i / 2) * 22}
						text="{c.e}: {c.h.toFixed(1)} d"
						size={12}
						weight={c.e === s.obsErr ? 700 : 500}
						color={c.e === s.obsErr ? 'var(--ewf-hot)' : undefined}
						muted={c.e !== s.obsErr}
						anchor="start"
						tabular
					/>
				{/each}
			</Readout>
		{:else}
			<line
				x1={ex(1)}
				x2={ex(1)}
				y1={Y0}
				y2={Y0 + PH}
				stroke="var(--ewf-obs)"
				stroke-width="1.2"
				stroke-dasharray="5 4"
			/>
			{#if run.free}
				<path
					d={errPath(run.free, shownStep)}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.6"
					stroke-dasharray="6 4"
				/>
			{/if}
			<path d={errPath(run.err, shownStep)} fill="none" stroke="var(--ewf-hot)" stroke-width="2" />
			<Readout
				id="ana-now"
				order={3}
				label="Analysis error"
				value="{sig(run.err[shownStep])} (observations 1)"
			>
				<Label
					x={EX0}
					y={Y0 + PH + 50}
					text="analysis error {sig(run.err[shownStep])}"
					size={13}
					anchor="start"
					tabular
				/>
			</Readout>
			{#if run.free}
				<Readout id="free-now" order={4} label="Left alone" value={sig(run.free[shownStep])}>
					<Label
						x={EX0}
						y={Y0 + PH + 72}
						text="left alone {sig(run.free[shownStep])}"
						size={13}
						anchor="start"
						muted
						tabular
					/>
				</Readout>
			{/if}
			<Readout id="obs-key">
				<Label x={ex(1) - 5} y={Y0 + 14} text="obs. 1" size={11} anchor="end" />
			</Readout>
		{/if}
	{/if}

	<!-- the useful range -->
	{#if Number.isFinite(h) && shown >= h}
		<line
			x1={PX[0]}
			x2={EX1}
			y1={dayY(h)}
			y2={dayY(h)}
			stroke="var(--ewf-hot)"
			stroke-width="1.5"
			stroke-dasharray="7 4"
		/>
		<Readout id="useful" order={4} label="Useful for" value="{fmtDay(h)} days">
			<Label
				x={PX[1] + PW / 2}
				y={dayY(h) - 8}
				text="useful for {fmtDay(h)} days"
				size={13}
				weight={700}
				color="var(--ewf-hot)"
				pill
			/>
		</Readout>
	{/if}
</g>
