<script lang="ts">
	/**
	 * The crowd: 300 people wandering over a field, coloured by state, with the
	 * counts of each state plotted day by day.
	 *
	 * Views (`step.hints.view`):
	 *   full — crowd + S/I/R chart + "each case now infects" gauge
	 *   case — follows the first case: its meetings, the people it infects and
	 *          a timeline of its infectious period; the chart is smaller
	 *
	 * A whole run is simulated up front whenever its inputs change (a few
	 * milliseconds), and every frame is then a pure function of the simulated
	 * day, which is a function of `t`. The only state kept between frames is
	 * the run itself and the `t` at which it started (a run restarts when a
	 * control changes mid-step; documented exception to the scene guide).
	 */
	import {
		Axes,
		Label,
		clamp,
		linePath,
		niceMax,
		scale,
		smoothstep,
		thin
	} from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { State, type Crowd } from '../model';
	import { FIELD, POPULATION, endDay, runCrowd, settings } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'full'));
	const initial = $derived(Number(step.hints?.initial ?? 3));
	const baseSeed = $derived(Number(step.hints?.seed ?? 1));
	const opts = $derived(settings(step, params));

	// ---- the run ---------------------------------------------------------------
	const crowd = $derived(
		runCrowd({
			r0: opts.r0,
			days: opts.days,
			vaccinated: opts.vaccinated,
			initial,
			seed: baseSeed + 7919 * opts.rerun
		})
	);
	const end = $derived(endDay(crowd));
	const focus = $derived(crowd.infections[0]?.who ?? 0);
	const focusEnd = $derived(crowd.recoveredAt[focus]);

	// `t` when the current run started: a run that is replaced mid-step (a
	// control moved) starts from its first day at the current `t`.
	let startedAt = 0;
	let startedFor: Crowd | null = null;
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (crowd !== startedFor || t < lastT) {
			startedAt = startedFor === null || t < lastT ? 0 : t;
			startedFor = crowd;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});

	/** Playback speed in simulated days per second, so that a run lasts ~20 s. */
	const pace = $derived(clamp(end / 20, 3, 10));
	const slowPace = $derived(Number(step.hints?.pace ?? 1.5));
	const LEAD = 0.8; // seconds before the first day starts, while the scene fades in

	const day = $derived.by(() => {
		if (reduced) return view === 'case' ? Math.min(end, focusEnd + 0.5) : end;
		const s = Math.max(0, tRun - LEAD);
		if (view !== 'case') return Math.min(end + 40, s * pace);
		// Follow the first case slowly, then speed up once it has recovered.
		const slowUntil = focusEnd + 1;
		const slowFor = slowUntil / slowPace;
		return s < slowFor ? s * slowPace : slowUntil + (s - slowFor) * pace;
	});
	const sample = $derived(crowd.history[crowd.sampleAt(day)]);
	const over = $derived(day >= end);

	// ---- the field -------------------------------------------------------------
	const FX = 36;
	const FY = 124;
	const colorOf = ['var(--sir-s)', 'var(--sir-i)', 'var(--sir-r)', 'var(--sir-v)'];
	const people = $derived(
		Array.from({ length: POPULATION }, (_, k) => ({
			k,
			x: FX + crowd.x(k, day),
			y: FY + crowd.y(k, day),
			state: crowd.stateAt(k, day)
		}))
	);

	/** Infections in the last `span` days, for the transmission lines and flashes. */
	function recentInfections(span: number) {
		const out: { who: number; by: number; age: number }[] = [];
		const list = crowd.infections;
		for (let i = list.length - 1; i >= 0; i--) {
			const inf = list[i];
			if (inf.day > day) continue;
			if (inf.day < day - span) break;
			out.push({ who: inf.who, by: inf.by, age: day - inf.day });
		}
		return out;
	}
	const flashes = $derived(recentInfections(1.2));

	// The first case's meetings (case view).
	const focusContacts = $derived(crowd.contacts.filter((c) => c.from === focus));
	const recentMeetings = $derived(
		view === 'case'
			? focusContacts
					.filter((c) => c.day <= day && c.day > day - 0.45)
					.map((c) => ({ ...c, age: day - c.day }))
			: []
	);
	const focusVictims = $derived(
		view === 'case'
			? crowd.infections.filter((i) => i.by === focus && i.day <= day).map((i) => i.who)
			: []
	);
	const meetingsSoFar = $derived(focusContacts.filter((c) => c.day <= day));

	// ---- the chart -------------------------------------------------------------
	const PX0 = 572;
	const PX1 = 916;
	const chartTop = $derived(view === 'case' ? 392 : 150);
	const chartBottom = $derived(view === 'case' ? 528 : 382);
	const xMax = $derived(Math.max(40, niceMax(end * 1.05)));
	const sx = $derived(scale([0, xMax], [PX0, PX1]));
	const sy = $derived(scale([0, POPULATION], [chartBottom, chartTop]));
	const shown = $derived(thin(crowd.history.slice(0, crowd.sampleAt(day) + 1), 360));
	const series = $derived([
		{
			id: 's',
			color: 'var(--sir-s)',
			width: 2,
			d: linePath(
				shown,
				(h) => h.day,
				(h) => h.s,
				sx,
				sy
			)
		},
		{
			id: 'r',
			color: 'var(--sir-r)',
			width: 2,
			d: linePath(
				shown,
				(h) => h.day,
				(h) => h.r,
				sx,
				sy
			)
		},
		{
			id: 'i',
			color: 'var(--sir-i)',
			width: 2.6,
			d: linePath(
				shown,
				(h) => h.day,
				(h) => h.i,
				sx,
				sy
			)
		}
	]);
	const peak = $derived.by(() => {
		let best = crowd.history[0];
		for (const h of crowd.history) if (h.i > best.i) best = h;
		return best;
	});
	const pastPeak = $derived(day > peak.day + 2 && peak.i > initial + 2);

	// ---- readouts --------------------------------------------------------------
	const rNow = $derived((opts.r0 * sample.s) / POPULATION);
	const gaugeMax = $derived(Math.max(4, Math.ceil(opts.r0)));
	const gx = $derived(scale([0, gaugeMax], [PX0, PX1]));
	const infectedTotal = $derived(sample.i + sample.r);
	const fizzled = $derived(over && crowd.counts.r < 0.1 * POPULATION);
	const status = $derived(
		!over
			? pastPeak
				? `Peak: ${peak.i} infectious at once, on day ${Math.round(peak.day)}`
				: `Day ${Math.floor(day)}: ${infectedTotal} caught it so far`
			: fizzled
				? `Died out on day ${Math.round(end)} after ${crowd.counts.r} case${crowd.counts.r === 1 ? '' : 's'}`
				: `Over by day ${Math.round(end)}: ${crowd.counts.r} caught it, ${crowd.counts.s} never did`
	);

	const legend = $derived([
		{ id: 's', label: 'Susceptible', value: sample.s, color: 'var(--sir-s)' },
		{ id: 'i', label: 'Infectious', value: sample.i, color: 'var(--sir-i)' },
		{ id: 'r', label: 'Recovered', value: sample.r, color: 'var(--sir-r)' },
		...(sample.v > 0
			? [{ id: 'v', label: 'Vaccinated', value: sample.v, color: 'var(--sir-v)' }]
			: [])
	]);

	// Case view: the first case's timeline.
	const caseSpan = $derived(Math.max(14, Math.ceil(focusEnd)));
	const cx = $derived(scale([0, caseSpan], [PX0, PX1]));
	const caseDay = $derived(Math.min(day, focusEnd));
	const fade = $derived(smoothstep(0, 0.6, Math.max(0, tRun - 0.1)));
</script>

<g opacity={reduced ? 1 : fade}>
	<!-- header: day and counts -->
	<Label x={FX} y={64} text="Day {Math.floor(day)}" size={16} weight={600} anchor="start" />
	{#each legend as item, i (item.id)}
		{@const lx = FX + i * 112}
		{#if item.id === 'v'}
			<circle
				cx={lx + 5}
				cy={92}
				r={4.5}
				fill="var(--stage-bg)"
				stroke={item.color}
				stroke-width="2"
			/>
		{:else}
			<circle cx={lx + 5} cy={92} r={5} fill={item.color} />
		{/if}
		<text x={lx + 15} y={96} font-size="12">{item.label}</text>
		<text x={lx + 15} y={110} font-size="11" class="muted" style:font-variant-numeric="tabular-nums"
			>{item.value}</text
		>
	{/each}

	<!-- field -->
	<rect
		x={FX - 1}
		y={FY - 1}
		width={FIELD + 2}
		height={FIELD + 2}
		rx="14"
		fill="var(--sir-field)"
		stroke="var(--border)"
	/>
	<clipPath id="crowd-clip">
		<rect x={FX} y={FY} width={FIELD} height={FIELD} rx="13" />
	</clipPath>
	<g clip-path="url(#crowd-clip)">
		<!-- transmission lines: who infected whom, in the last day -->
		{#if view === 'full'}
			{#each flashes as f (f.who)}
				{#if f.by >= 0}
					<line
						x1={people[f.by].x}
						y1={people[f.by].y}
						x2={people[f.who].x}
						y2={people[f.who].y}
						stroke="var(--sir-i)"
						stroke-width="1.4"
						opacity={0.55 * (1 - smoothstep(0.3, 1.2, f.age))}
					/>
				{/if}
			{/each}
		{:else}
			{#each recentMeetings as m (m.day)}
				<line
					x1={people[m.from].x}
					y1={people[m.from].y}
					x2={people[m.to].x}
					y2={people[m.to].y}
					stroke={m.infected ? 'var(--sir-i)' : 'var(--stage-ink-muted)'}
					stroke-width={m.infected ? 2 : 1.2}
					opacity={(m.infected ? 0.9 : 0.6) * (1 - smoothstep(0.15, 0.45, m.age))}
				/>
			{/each}
		{/if}

		{#each people as p (p.k)}
			{#if p.state === State.Vaccinated}
				<circle cx={p.x} cy={p.y} r="4.3" fill="none" stroke="var(--sir-v)" stroke-width="2" />
			{:else}
				<circle cx={p.x} cy={p.y} r="5" fill={colorOf[p.state]} />
			{/if}
		{/each}

		<!-- a ring expands around each newly infected person -->
		{#each flashes as f (f.who)}
			<circle
				cx={people[f.who].x}
				cy={people[f.who].y}
				r={5 + 10 * smoothstep(0, 1.2, f.age)}
				fill="none"
				stroke="var(--sir-i)"
				stroke-width="1.5"
				opacity={0.7 * (1 - smoothstep(0, 1.2, f.age))}
			/>
		{/each}

		{#if view === 'case'}
			{#each focusVictims as v (v)}
				<circle
					cx={people[v].x}
					cy={people[v].y}
					r="9"
					fill="none"
					stroke="var(--sir-i)"
					stroke-width="1.5"
				/>
			{/each}
			<circle
				cx={people[focus].x}
				cy={people[focus].y}
				r="12"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
		{/if}
	</g>

	{#if view === 'case'}
		<Label
			x={clamp(people[focus].x, FX + 50, FX + FIELD - 50)}
			y={people[focus].y > FY + 40 ? people[focus].y - 20 : people[focus].y + 30}
			text="first case"
			size={12}
			pill
		/>
	{/if}

	<!-- right-hand panel -->
	{#if view === 'case'}
		<Label x={PX0} y={142} text="The first case" size={15} weight={600} anchor="start" />
		<text x={PX0} y={166} font-size="12" class="muted">
			{day < focusEnd
				? `Infectious for ${caseDay.toFixed(1)} days so far`
				: `Recovered after ${focusEnd.toFixed(1)} days`}
		</text>
		<g style:font-variant-numeric="tabular-nums">
			<text x={PX0} y={206} font-size="26" font-weight="600">{meetingsSoFar.length}</text>
			<text x={PX0} y={226} font-size="12" class="muted">people met</text>
			<text x={PX0 + 150} y={206} font-size="26" font-weight="600" fill="var(--sir-i)"
				>{focusVictims.length}</text
			>
			<text x={PX0 + 150} y={226} font-size="12" class="muted">infected by them</text>
		</g>
		<!-- timeline of the infectious period: one tick per meeting -->
		<g>
			<line x1={cx(0)} x2={cx(caseSpan)} y1={290} y2={290} stroke="var(--stage-line)" />
			<rect
				x={cx(0)}
				y={284}
				width={Math.max(0, cx(caseDay) - cx(0))}
				height="12"
				rx="6"
				fill="var(--sir-i)"
				opacity="0.18"
			/>
			{#each meetingsSoFar as m (m.day)}
				<line
					x1={cx(m.day - crowd.infectedAt[focus])}
					x2={cx(m.day - crowd.infectedAt[focus])}
					y1={m.infected ? 272 : 282}
					y2={m.infected ? 308 : 298}
					stroke={m.infected ? 'var(--sir-i)' : 'var(--stage-ink-muted)'}
					stroke-width={m.infected ? 2.5 : 1.2}
				/>
			{/each}
			{#if day >= focusEnd}
				<line
					x1={cx(focusEnd)}
					x2={cx(focusEnd)}
					y1={278}
					y2={302}
					stroke="var(--sir-r)"
					stroke-width="3"
				/>
				<Label x={cx(focusEnd)} y={324} text="recovered" size={11} muted />
			{/if}
			{#each [0, 7, 14, 21, 28].filter((d) => d <= caseSpan) as d (d)}
				<text x={cx(d)} y={340} font-size="11" class="muted" text-anchor="middle">{d}</text>
			{/each}
			<text x={PX1} y={356} font-size="11" class="muted" text-anchor="end">days since infected</text
			>
			<text x={PX0} y={264} font-size="11" class="muted"
				>each tick is a meeting; tall red ones passed it on</text
			>
		</g>
	{:else}
		<Label x={PX0} y={112} text="People in each state" size={15} weight={600} anchor="start" />
	{/if}

	<Axes {sx} {sy} xLabel="day" yLabel={view === 'case' ? 'the whole crowd' : 'people'} />
	{#if sample.v > 0}
		<line
			x1={PX0}
			x2={PX1}
			y1={sy(sample.v)}
			y2={sy(sample.v)}
			stroke="var(--sir-v)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
		/>
		<Label
			x={PX1 - 4}
			y={sy(sample.v) - 6}
			text="vaccinated"
			size={11}
			anchor="end"
			color="var(--sir-v)"
		/>
	{/if}
	{#each series as s (s.id)}
		<path d={s.d} fill="none" stroke={s.color} stroke-width={s.width} stroke-linejoin="round" />
	{/each}
	<line
		x1={sx(Math.min(day, xMax))}
		x2={sx(Math.min(day, xMax))}
		y1={chartTop}
		y2={chartBottom}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
		opacity={over ? 0 : 0.6}
	/>
	{#if view === 'full' && pastPeak}
		<circle
			cx={sx(peak.day)}
			cy={sy(peak.i)}
			r="4"
			fill="var(--stage-bg)"
			stroke="var(--sir-i)"
			stroke-width="2"
		/>
		<Label
			x={Math.min(sx(peak.day) + 8, PX1 - 40)}
			y={sy(peak.i) - 8}
			text="peak"
			size={11}
			anchor="start"
			color="var(--sir-i)"
		/>
	{/if}

	{#if view === 'full'}
		<!-- each case now infects: R = R0 × share susceptible -->
		<g>
			<text x={PX0} y={436} font-size="13" font-weight="600">Each case now infects</text>
			<text
				x={PX1}
				y={436}
				font-size="13"
				font-weight="600"
				text-anchor="end"
				fill={rNow > 1 ? 'var(--sir-i)' : 'var(--sir-s)'}
				style:font-variant-numeric="tabular-nums">{rNow.toFixed(1)} people</text
			>
			<rect x={PX0} y={448} width={PX1 - PX0} height="10" rx="5" fill="var(--stage-grid)" />
			<rect
				x={PX0}
				y={448}
				width={Math.max(0, gx(Math.min(rNow, gaugeMax)) - PX0)}
				height="10"
				rx="5"
				fill={rNow > 1 ? 'var(--sir-i)' : 'var(--sir-s)'}
			/>
			<line x1={gx(1)} x2={gx(1)} y1={442} y2={464} stroke="var(--stage-ink)" stroke-width="1.5" />
			<text x={gx(1)} y={478} font-size="11" text-anchor="middle" class="muted">1</text>
			<text x={PX0} y={496} font-size="11" class="muted">
				R₀ {opts.r0.toFixed(1)} × {Math.round((100 * sample.s) / POPULATION)}% still susceptible
			</text>
			<text x={PX1} y={496} font-size="11" class="muted" text-anchor="end">
				{sample.i === 0
					? 'nobody is infectious now'
					: rNow > 1
						? 'above 1: growing'
						: 'below 1: shrinking'}
			</text>
		</g>
		<Label x={PX0} y={540} text={status} size={13} anchor="start" />
	{:else}
		<Label x={PX0} y={568} text={status} size={12} anchor="start" muted />
	{/if}
</g>
