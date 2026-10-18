<script lang="ts">
	/**
	 * Odds from an ensemble: for each of the 40 cells, the share of the 51 members in which it
	 * "rains" (a value above 6) on the chosen day, as bars, with drops where it really rained.
	 *
	 * Hints: `focus` 'odds' (below: the chance in your town and the range over all cells against
	 * lead time, sinking to the climate's 17 %) | 'reliability' (below: the reliability diagram
	 * of 100 start days × 40 cells at this lead, for the chosen model). `seed`: the day.
	 * Static apart from the controls; the bars grow in over the first second.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { EVENT, K, STEPS_PER_DAY, chances } from '../model';
	import { MEMBERS, TOWN, cachedForecast, cachedReliability, settings } from '../look';

	let { step, t, reduced, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'odds'));
	const s = $derived(settings(step, params));
	const DAYS = 30;
	const F = $derived(focus === 'reliability' ? s.F : 8);
	const f = $derived(cachedForecast(s.seed, 0.3, MEMBERS, F, DAYS));
	const runs = $derived([f.control, ...f.members]);
	const byDay = $derived(
		Array.from({ length: DAYS }, (_, d) => chances(runs, (d + 1) * STEPS_PER_DAY))
	);
	const ch = $derived(byDay[s.lead - 1]);
	const rained = $derived(
		Array.from({ length: K }, (_, k) => f.truth[s.lead * STEPS_PER_DAY][k] > EVENT)
	);
	const grow = $derived(reduced ? 1 : smoothstep(0, 1, t));
	const rel = $derived(focus === 'reliability' ? cachedReliability(F)[s.lead - 1] : null);

	// ---- the strip ---------------------------------------------------------------------------
	const BX0 = 80;
	const CW = 20;
	const BASE = 250;
	const BH = 150;
	const by = (p: number) => BASE - p * BH;
	const pct = (p: number) => `${Math.round(p * 100)} %`;
	const CLIM = 0.175;
	const town = $derived(ch[TOWN]);
	const high = $derived(Array.from(ch).filter((p) => p >= 0.7).length);
	const highRained = $derived(Array.from(ch).filter((p, k) => p >= 0.7 && rained[k]).length);
	const wet = $derived(rained.filter(Boolean).length);
	const drop = (x: number, y: number) =>
		`M${x} ${y - 9}C${x + 2} ${y - 5} ${x + 6} ${y - 1} ${x + 6} ${y + 2}A6 6 0 0 1 ${x - 6} ${y + 2}C${x - 6} ${y - 1} ${x - 2} ${y - 5} ${x} ${y - 9}Z`;

	// ---- lead-time chart (odds) --------------------------------------------------------------
	const lx = scale([1, DAYS], [110, 560]);
	const ly = scale([0, 1], [556, 366]);
	const townLine = $derived(
		byDay
			.map((c, d) => `${d ? 'L' : 'M'}${lx(d + 1).toFixed(1)} ${ly(c[TOWN]).toFixed(1)}`)
			.join('')
	);
	const band = $derived.by(() => {
		const hi = byDay.map((c) => Math.max(...c));
		const lo = byDay.map((c) => Math.min(...c));
		let d = '';
		hi.forEach((v, i) => (d += `${i ? 'L' : 'M'}${lx(i + 1).toFixed(1)} ${ly(v).toFixed(1)}`));
		for (let i = lo.length - 1; i >= 0; i--)
			d += `L${lx(i + 1).toFixed(1)} ${ly(lo[i]).toFixed(1)}`;
		return d + 'Z';
	});

	// ---- reliability diagram -----------------------------------------------------------------
	const rx = scale([0, 1], [110, 330]);
	const ry = scale([0, 1], [556, 336]);
	const pts = $derived(
		rel
			? rel.bins
					.filter((b) => b.count >= 10)
					.map((b) => ({
						...b,
						r: Math.min(9, 2.5 + Math.sqrt(b.count) / 6)
					}))
			: []
	);
	const total = $derived(rel ? rel.bins.reduce((a, b) => a + b.count, 0) : 0);
	const thousands = (v: number) => v.toLocaleString('en-US');
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Chance of rain"
		value="day {s.lead}{focus === 'reliability' && s.model !== 'perfect' ? `, model F = ${F}` : ''}"
	>
		<Label
			x={40}
			y={36}
			text="chance of rain on day {s.lead}: share of {MEMBERS} members above {EVENT}{focus ===
				'reliability' && s.model !== 'perfect'
				? ` (model F = ${F})`
				: ''}"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- the strip of chances -->
	{#each [0, 0.5, 1] as p (p)}
		<line
			x1={BX0}
			x2={BX0 + K * CW}
			y1={by(p)}
			y2={by(p)}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="p{p}">
			<Label x={BX0 - 8} y={by(p) + 4} text={pct(p)} size={11} muted anchor="end" />
		</Readout>
	{/each}
	{#each Array.from(ch) as p, k (k)}
		<rect
			x={BX0 + k * CW + 2}
			y={by(p * grow)}
			width={CW - 4}
			height={p * grow * BH}
			rx="2"
			fill="var(--ewf-rain)"
			opacity={k === TOWN ? 1 : 0.7}
		/>
		{#if rained[k]}
			<path d={drop(BX0 + (k + 0.5) * CW, BASE + 26)} fill="var(--ewf-rain)" />
		{:else}
			<circle
				cx={BX0 + (k + 0.5) * CW}
				cy={BASE + 26}
				r="2"
				fill="var(--stage-ink-muted)"
				opacity="0.6"
			/>
		{/if}
	{/each}
	<line
		x1={BX0}
		x2={BX0 + K * CW}
		y1={BASE}
		y2={BASE}
		stroke="var(--stage-line)"
		stroke-width="1.2"
	/>
	<line
		x1={BX0}
		x2={BX0 + K * CW}
		y1={by(CLIM)}
		y2={by(CLIM)}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-dasharray="5 4"
	/>
	<Readout id="clim-label">
		<Label x={BX0 + K * CW + 6} y={by(CLIM) + 4} text="climate 17 %" size={11} anchor="start" />
	</Readout>
	<Readout id="drops-key">
		<Label x={BX0 + K * CW + 6} y={BASE + 30} text="rained" size={11} muted anchor="start" />
	</Readout>
	{#each [0, 9, 19, 29, 39] as k (k)}
		<Readout id="c{k}">
			<Label x={BX0 + (k + 0.5) * CW} y={BASE + 56} text={String(k + 1)} size={11} muted />
		</Readout>
	{/each}
	<Readout id="cells">
		<Label x={BX0} y={BASE + 56} text="cell" size={11} muted anchor="end" />
	</Readout>
	<Readout id="town" order={2} label="Your town (cell 21)" value={pct(town)}>
		<Label
			x={BX0 + (TOWN + 0.5) * CW}
			y={by(1) - 22}
			text="your town {pct(town)}"
			size={13}
			weight={700}
		/>
	</Readout>
	<path d="M{BX0 + (TOWN + 0.5) * CW} {by(1) - 4} l-5 -8 l10 0 Z" fill="var(--stage-ink)" />

	{#if focus === 'odds'}
		<!-- chance against lead time -->
		<Axes
			sx={lx}
			sy={ly}
			xLabel="lead time (days)"
			yLabel="chance"
			xTicks={[1, 5, 10, 15, 20, 25, 30]}
			yTicks={[0, 0.5, 1]}
			yFormat={pct}
		/>
		<path d={band} fill="var(--ewf-rain)" opacity="0.18" />
		<line
			x1={lx(1)}
			x2={lx(DAYS)}
			y1={ly(CLIM)}
			y2={ly(CLIM)}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			stroke-dasharray="5 4"
		/>
		<path d={townLine} fill="none" stroke="var(--ewf-rain)" stroke-width="2.4" />
		<line
			x1={lx(s.lead)}
			x2={lx(s.lead)}
			y1={ly(1)}
			y2={ly(0)}
			stroke="var(--stage-ink)"
			stroke-width="1"
			stroke-dasharray="2 3"
		/>
		<circle cx={lx(s.lead)} cy={ly(town)} r="5" fill="var(--ewf-rain)" />
		<Readout id="lead-key">
			<Label
				x={620}
				y={372}
				text="chance against lead time:"
				size={12}
				weight={600}
				anchor="start"
			/>
			<line x1={620} x2={644} y1={390} y2={390} stroke="var(--ewf-rain)" stroke-width="2.4" />
			<Label x={650} y={394} text="your town" size={12} anchor="start" />
			<rect x={736} y={383} width={24} height={14} fill="var(--ewf-rain)" opacity="0.18" />
			<Label x={766} y={394} text="range over the cells" size={12} anchor="start" />
		</Readout>
		<Readout id="wet" order={3} label="Cells where it rained" value="{wet} of 40">
			<Label
				x={620}
				y={420}
				text="it rained in {wet} of the 40 cells"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="high" order={4} label="Cells given ≥ 70 %" value="{high}; rain in {highRained}">
			<Label
				x={620}
				y={444}
				text="{high} cells were given 70 % or more;"
				size={13}
				anchor="start"
				tabular
			/>
			<Label
				x={620}
				y={464}
				text="it rained in {highRained} of them"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="each">
			<Label x={620} y={498} text="each chance is for one cell," size={12} muted anchor="start" />
			<Label x={620} y={516} text="not a share of the circle" size={12} muted anchor="start" />
		</Readout>
	{:else if rel}
		<!-- reliability diagram -->
		<Axes
			sx={rx}
			sy={ry}
			xLabel="forecast chance"
			yLabel="it rained"
			xTicks={[0, 0.5, 1]}
			yTicks={[0, 0.5, 1]}
			xFormat={pct}
			yFormat={pct}
		/>
		<line
			x1={rx(0)}
			y1={ry(0)}
			x2={rx(1)}
			y2={ry(1)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="4 4"
		/>
		{#each pts as b (b.p)}
			<circle
				cx={rx(b.p)}
				cy={ry(b.observed)}
				r={b.r}
				fill="var(--ewf-rain)"
				stroke="var(--stage-bg)"
				stroke-width="1"
			/>
		{/each}
		<Readout id="rel-title">
			<Label
				x={420}
				y={372}
				text="do the odds come true? (day {s.lead})"
				size={12}
				weight={600}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="n"
			order={3}
			label="Forecasts checked"
			value="{thousands(total)} (100 days × 40 cells)"
		>
			<Label
				x={420}
				y={400}
				text="{thousands(total)} forecasts: 100 start days × 40 cells"
				size={13}
				anchor="start"
			/>
		</Readout>
		<Readout
			id="freq"
			order={4}
			label="Forecast chance / it rained"
			value="{pct(rel.meanP)} / {pct(rel.rainFreq)}"
		>
			<Label
				x={420}
				y={426}
				text="average forecast chance {pct(rel.meanP)}"
				size={13}
				anchor="start"
				tabular
			/>
			<Label
				x={420}
				y={448}
				text="it rained in {pct(rel.rainFreq)} of them"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="rel-key">
			<circle cx={426} cy={490} r="5" fill="var(--ewf-rain)" />
			<Label
				x={438}
				y={494}
				text="dot: how often it rained (bigger: more forecasts)"
				size={11}
				muted
				anchor="start"
			/>
			<Label
				x={438}
				y={516}
				text="on the diagonal: the odds come true"
				size={11}
				muted
				anchor="start"
			/>
		</Readout>
	{/if}
</g>
