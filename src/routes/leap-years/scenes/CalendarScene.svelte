<script lang="ts">
	/**
	 * Earth's orbit round the Sun with the calendar as a ring of months inside it, coloured by the
	 * season each month is meant to be. The star at the top is the June solstice (the longest day in
	 * the north), a fixed point of the orbit; the ring turns underneath it as the calendar drifts.
	 * On the right, depending on the step: the end of a lap magnified, the solstice's calendar date
	 * year after year under a rule, or the leap-year checks for one year with its February.
	 * Every date comes from the model.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		formatDate,
		leapReason,
		MONTH_SHORT,
		monthLengths,
		solsticeDate,
		solsticeSeries,
		TROPICAL_YEAR,
		weekday,
		type Rule
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'lap'));

	// ---- which rule, and how many years on --------------------------------------------------------
	const rule = $derived<Rule>(
		phase === 'slide'
			? 'none'
			: phase === 'leap'
				? params.julian === true
					? 'julian'
					: 'none'
				: phase === 'thousand'
					? 'julian'
					: phase === 'skip'
						? params.gregorian === true
							? 'gregorian'
							: 'julian'
						: 'gregorian'
	);
	const years = $derived(
		phase === 'slide'
			? Number(params.centuries ?? 100)
			: phase === 'leap'
				? 800
				: phase === 'thousand'
					? Number(params.millennia ?? 1000)
					: phase === 'skip'
						? 2000
						: 0
	);
	const SERIES = {
		none: solsticeSeries(800, 'none'),
		julian: solsticeSeries(2000, 'julian'),
		gregorian: solsticeSeries(2000, 'gregorian')
	};
	/** The solstice's date as a day of an ordinary year (171 = 21 June), unwrapped. */
	const solsticeDay = $derived(SERIES[rule][years] ?? SERIES.gregorian[0]);
	const date = $derived(solsticeDate(years, rule));
	const dateText = $derived(formatDate(date));

	// The ring turns smoothly when a toggle or a step changes the date at the top.
	const ringDay = new Tween(171.3, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const d = solsticeDay;
		untrack(() => ringDay.set(d, { duration: reduced ? 0 : 800 }));
	});

	// ---- the orbit ---------------------------------------------------------------------------------
	const CX = 250;
	const CY = 310;
	const R = 196;
	const R_IN = 108;
	const R_OUT = 156;
	/** Angle (radians, counterclockwise from +x) of the day `d` when day `top` is at the top. */
	const ang = (d: number, top: number) => Math.PI / 2 + (2 * Math.PI * (d - top)) / TROPICAL_YEAR;
	const pt = (r: number, a: number) => ({ x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) });
	const f = (v: number) => v.toFixed(1);

	const COMMON = monthLengths(2001, 'none');
	const STARTS = COMMON.map((_, m) => COMMON.slice(0, m).reduce((a, b) => a + b, 0));
	const SEASON = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer'];
	const seasonOf = (m: number) => (m === 11 ? 'winter' : m >= 8 ? 'autumn' : SEASON[m]);
	const sector = (d0: number, d1: number, top: number) => {
		// Counterclockwise in the maths sense is clockwise-flipped on screen: sweep flag 0.
		const a0 = ang(d0, top);
		const a1 = ang(d1, top);
		const p0 = pt(R_OUT, a0);
		const p1 = pt(R_OUT, a1);
		const q1 = pt(R_IN, a1);
		const q0 = pt(R_IN, a0);
		return `M${f(p0.x)} ${f(p0.y)}A${R_OUT} ${R_OUT} 0 0 0 ${f(p1.x)} ${f(p1.y)}L${f(q1.x)} ${f(q1.y)}A${R_IN} ${R_IN} 0 0 1 ${f(q0.x)} ${f(q0.y)}Z`;
	};
	const ring = $derived(
		COMMON.map((len, m) => {
			const top = ringDay.current;
			const mid = pt((R_IN + R_OUT) / 2, ang(STARTS[m] + len / 2, top));
			return { m, d: sector(STARTS[m], STARTS[m] + len, top), mid, season: seasonOf(m) };
		})
	);

	/** 1 January 2001 00:00 UTC to the 2001 solstice, as on the model's clock. */
	const SOLSTICE_2001 = 171.318;
	// Earth: on the 'lap' step it is where the days slider puts it; on the last step it goes round;
	// elsewhere it sits at the top, on the longest day.
	const earthDay = $derived(
		phase === 'lap'
			? Number(params.days ?? 365)
			: phase === 'short'
				? 365 * Number(params.years4 ?? 4)
				: phase === 'same'
					? SOLSTICE_2001 + (reduced ? 0 : (t * 24) % TROPICAL_YEAR)
					: SOLSTICE_2001
	);
	const earth = $derived(pt(R, ang(earthDay, SOLSTICE_2001)));
	const newYear = pt(R, ang(0, SOLSTICE_2001));
	/** The arc Earth has travelled since New Year on the 'lap' step. */
	const lapArc = $derived.by(() => {
		if (phase !== 'lap') return '';
		const d = Math.min(Number(params.days ?? 365), TROPICAL_YEAR);
		const n = Math.max(2, Math.ceil(d / 3));
		return Array.from({ length: n + 1 }, (_, i) => {
			const p = pt(R, ang((d * i) / n, SOLSTICE_2001));
			return `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`;
		}).join('');
	});
	const star = pt(R + 26, Math.PI / 2);

	// ---- the end of the lap, magnified -------------------------------------------------------------
	const TX0 = 556;
	const TX1 = 916;
	const TY = 330;
	/** Where a full lap ends on the magnified track, and px per day. */
	const FX = 836;
	const PXD = 100;
	const shortBy = TROPICAL_YEAR - 365;
	const lapDays = $derived(Number(params.days ?? 365));
	const lapX = $derived(FX - PXD * (TROPICAL_YEAR - lapDays));
	const onTrack = $derived(lapX >= TX0 + 8);
	const n4 = $derived(Number(params.years4 ?? 4));
	const newYears = $derived(
		Array.from({ length: n4 }, (_, k) => ({ k: k + 1, x: FX - PXD * shortBy * (k + 1) }))
	);
	const SHORT_WORDS = [
		'',
		'a quarter of a day',
		'half a day',
		'three quarters of a day',
		'almost a whole day',
		'a day and a quarter',
		'a day and a half',
		'a day and three quarters',
		'almost two days'
	];
	const shortText = $derived(
		n4 === 0
			? 'Start: New Year'
			: `After ${n4} New Year${n4 === 1 ? '' : 's'}: ${SHORT_WORDS[n4]} short`
	);
	const lapText = $derived(
		lapDays < 365
			? `Day ${lapDays}: Earth is still on its way round`
			: lapDays === 365
				? 'Day 365: the calendar’s year is over'
				: 'Day 366: Earth is past the start of its seasons'
	);
	const lapNote = $derived(
		lapDays === 365
			? 'but Earth still has almost 6 hours to go'
			: lapDays > 365
				? 'by about 18 hours'
				: ''
	);

	// ---- the chart of the longest day's date -------------------------------------------------------
	const charted = $derived(['slide', 'leap', 'thousand', 'skip', 'same'].includes(phase));
	const span = $derived(
		phase === 'slide' || phase === 'leap' ? 800 : phase === 'same' ? 400 : 2000
	);
	const wide = $derived(phase === 'slide' || phase === 'leap');
	const CX0 = 600;
	const CX1 = 916;
	const CY0 = 120;
	const CY1 = 440;
	const sx = $derived(scale([0, span], [CX0, CX1]));
	const sy = $derived(wide ? scale([151, 376], [CY1, CY0]) : scale([150, 176], [CY1, CY0]));
	const yTicks = $derived(
		wide ? [151, 181, 212, 243, 273, 304, 334, 365] : [151, 155, 160, 165, 170, 175]
	);
	const yFormat = $derived((v: number) => {
		const d = v % 365;
		const m = STARTS.findLastIndex((s) => s <= d);
		return wide ? MONTH_SHORT[m] : `${MONTH_SHORT[m]} ${d - STARTS[m] + 1}`;
	});
	const lineOf = (s: number[], n: number) =>
		linePath(
			s.slice(0, n + 1).map((y, k) => ({ k, y })),
			(p) => p.k,
			(p) => p.y,
			sx,
			sy
		);
	const lines = $derived.by(() => {
		if (!charted) return [];
		if (phase === 'slide')
			return [
				{ id: 'all', d: lineOf(SERIES.none, 800), color: 'var(--ly-none)', w: 1.5, o: 0.3 },
				{ id: 'now', d: lineOf(SERIES.none, years), color: 'var(--ly-none)', w: 3, o: 1 }
			];
		if (phase === 'leap')
			return [
				{
					id: 'none',
					d: lineOf(SERIES.none, 800),
					color: 'var(--ly-none)',
					w: rule === 'none' ? 3 : 1.5,
					o: rule === 'none' ? 1 : 0.35
				},
				...(rule === 'julian'
					? [{ id: 'jul', d: lineOf(SERIES.julian, 800), color: 'var(--ly-julian)', w: 2, o: 1 }]
					: [])
			];
		if (phase === 'thousand')
			return [
				{ id: 'all', d: lineOf(SERIES.julian, 2000), color: 'var(--ly-julian)', w: 1, o: 0.3 },
				{ id: 'now', d: lineOf(SERIES.julian, years), color: 'var(--ly-julian)', w: 1.5, o: 1 }
			];
		if (phase === 'skip')
			return [
				{
					id: 'jul',
					d: lineOf(SERIES.julian, 2000),
					color: 'var(--ly-julian)',
					w: 1.5,
					o: rule === 'julian' ? 1 : 0.3
				},
				...(rule === 'gregorian'
					? [
							{
								id: 'greg',
								d: lineOf(SERIES.gregorian, 2000),
								color: 'var(--ly-greg)',
								w: 1.5,
								o: 1
							}
						]
					: [])
			];
		return [
			{ id: 'greg', d: lineOf(SERIES.gregorian, 400), color: 'var(--ly-greg)', w: 1.5, o: 1 }
		];
	});
	const chartTitle = $derived(
		phase === 'same'
			? 'Longest day, real calendar, 2001 to 2401'
			: rule === 'none'
				? 'Longest day with no leap days'
				: rule === 'julian'
					? 'Longest day with a leap day every four years'
					: 'Longest day, skipping most hundreds years'
	);
	const dot = $derived(
		phase === 'slide' || phase === 'thousand' || phase === 'leap' || phase === 'skip'
			? { x: sx(years), y: sy(solsticeDay) }
			: null
	);
	const lineColor = $derived(
		rule === 'none' ? 'var(--ly-none)' : rule === 'julian' ? 'var(--ly-julian)' : 'var(--ly-greg)'
	);
	const yearsText = $derived(
		years === 0 ? 'In 2001' : `After ${years.toLocaleString('en-US')} years`
	);
	const SEASON_WORDS: Record<string, string> = {
		winter: 'in the calendar’s winter',
		spring: 'in the calendar’s spring',
		summer: 'in the calendar’s summer',
		autumn: 'in the calendar’s autumn'
	};
	/** How far the longest day has moved, in whole days, in plain words. */
	const moved = $derived.by(() => {
		const dd = Math.round(solsticeDay - SOLSTICE_2001);
		if (dd === 0) return 'about the same day as in 2001';
		const n = Math.abs(dd);
		return `${n} day${n === 1 ? '' : 's'} ${dd > 0 ? 'later' : 'earlier'} than in 2001`;
	});
	const whenNote = $derived(
		phase === 'slide' || phase === 'leap'
			? `${moved}, ${SEASON_WORDS[seasonOf(date.month)]}`
			: moved
	);

	// ---- is it a leap year? ------------------------------------------------------------------------
	const yr = $derived(Number(params.year ?? 2024));
	const reason = $derived(leapReason(yr));
	const febDays = $derived(reason.leap ? 29 : 28);
	const feb1 = $derived(weekday(yr, 1, 1));
	const cells = $derived(
		Array.from({ length: febDays }, (_, i) => {
			const slot = feb1 + i;
			return { n: i + 1, col: slot % 7, row: Math.floor(slot / 7) };
		})
	);
	const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
	const GX = 620;
	const GY = 300;
	const GW = 40;
	const GH = 30;
</script>

<g class="ly">
	<!-- the orbit, the Sun and the calendar ring -->
	<circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
	{#each ring as s (s.m)}
		<path
			d={s.d}
			fill="var(--ly-{s.season})"
			stroke="var(--stage-bg)"
			stroke-width="2"
			opacity={phase === 'lap' || phase === 'short' ? 0.55 : 1}
		/>
		<text
			x={s.mid.x}
			y={s.mid.y + 5}
			text-anchor="middle"
			font-size="14"
			font-weight="600"
			fill="var(--stage-ink)">{MONTH_SHORT[s.m]}</text
		>
	{/each}
	<circle cx={CX} cy={CY} r="40" fill="var(--ly-sun)" />
	<Label
		x={CX}
		y={CY + 5}
		text="Sun"
		anchor="middle"
		size={14}
		weight={600}
		halo={false}
		color="#1c1b19"
	/>

	<!-- the longest day: a fixed point of the orbit -->
	{#if phase !== 'lap' && phase !== 'short'}
		<line
			x1={CX}
			y1={CY - 40}
			x2={star.x}
			y2={star.y}
			stroke="var(--ly-star)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
	{/if}
	<path
		d="M{star.x} {star.y -
			13} l3.8 8.2 9 1 -6.7 6.1 1.9 8.8 -8 -4.6 -8 4.6 1.9 -8.8 -6.7 -6.1 9 -1z"
		fill="var(--ly-star)"
		transform="translate(0 -1)"
	/>
	<Readout
		id="ly-longest"
		order={1}
		label="Longest day"
		value={phase === 'lap' || phase === 'short' ? 'June 21' : dateText}
	>
		<Label
			anchor="start"
			x={star.x + 18}
			y={star.y - 22}
			text={phase === 'lap' || phase === 'short'
				? 'longest day'
				: phase === 'which' || phase === 'same'
					? `longest day: ${dateText}`
					: `longest day: about ${dateText}`}
			size={16}
			weight={700}
			color="var(--ly-star)"
		/>
	</Readout>

	<!-- Earth -->
	{#if phase === 'lap'}
		<path d={lapArc} fill="none" stroke="var(--ly-earth)" stroke-width="3" opacity="0.6" />
		<circle
			cx={newYear.x}
			cy={newYear.y}
			r="16"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<Label anchor="start" x={newYear.x + 22} y={newYear.y + 26} text="New Year" size={13} muted />
	{/if}
	{#if phase === 'short'}
		<circle
			cx={newYear.x}
			cy={newYear.y}
			r="16"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<Label anchor="start" x={newYear.x + 22} y={newYear.y + 26} text="New Year" size={13} muted />
	{/if}
	<circle
		cx={earth.x}
		cy={earth.y}
		r="12"
		fill="var(--ly-earth)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- the right-hand panel -->
	{#if phase === 'lap' || phase === 'short'}
		<line
			x1={newYear.x + 16}
			y1={newYear.y - 4}
			x2={TX0 - 16}
			y2={TY + 40}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
		/>
		<rect
			x={TX0 - 16}
			y={TY - 130}
			width={TX1 - TX0 + 32}
			height="210"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label
			anchor="start"
			x={TX0}
			y={TY - 104}
			text="The end of the year, magnified"
			size={15}
			weight={700}
			halo={false}
		/>
		<line
			x1={TX0}
			y1={TY}
			x2={TX1}
			y2={TY}
			stroke="var(--stage-line)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<!-- day marks, counted back from the end of a full lap -->
		{#each [1, 2] as k (k)}
			<line
				x1={FX - PXD * k}
				y1={TY + 6}
				x2={FX - PXD * k}
				y2={TY + 14}
				stroke="var(--stage-ink-muted)"
			/>
			<Label
				x={FX - PXD * k}
				y={TY + 30}
				text={k === 1 ? '1 day short' : '2 days short'}
				anchor="middle"
				size={12}
				muted
				halo={false}
			/>
		{/each}
		<!-- the finish: back at the same point of the seasons -->
		<line x1={FX} y1={TY - 40} x2={FX} y2={TY + 14} stroke="var(--ly-star)" stroke-width="2.5" />
		<path d="M{FX} {TY - 40} l22 7 -22 7z" fill="var(--ly-star)" />
		<Label
			x={FX}
			y={TY + 30}
			text="seasons complete"
			anchor="middle"
			size={12}
			weight={600}
			color="var(--ly-star)"
			halo={false}
		/>
		{#if phase === 'lap'}
			{#if onTrack}
				<circle
					cx={lapX}
					cy={TY}
					r="12"
					fill="var(--ly-earth)"
					stroke="var(--surface)"
					stroke-width="2"
				/>
			{:else}
				<Label
					anchor="start"
					x={TX0}
					y={TY - 20}
					text="← Earth is still far back"
					size={13}
					muted
					halo={false}
				/>
			{/if}
			<Readout id="ly-lap" order={2} label="Calendar" value={lapText} note={lapNote}>
				<Label
					anchor="start"
					x={TX0}
					y={TY - 76}
					text={lapText}
					size={15}
					weight={600}
					halo={false}
				/>
				{#if lapNote}
					<Label anchor="start" x={TX0} y={TY - 56} text={lapNote} size={13} muted halo={false} />
				{/if}
			</Readout>
		{:else}
			{#each newYears as ny (ny.k)}
				<line
					x1={ny.x}
					y1={TY - 18}
					x2={ny.x}
					y2={TY}
					stroke="var(--ly-earth)"
					stroke-width="1.5"
				/>
				{#if ny.k < n4}
					<Label
						x={ny.x}
						y={TY - 24}
						text={String(ny.k)}
						anchor="middle"
						size={12}
						muted
						halo={false}
					/>
				{/if}
			{/each}
			{@const last = newYears.at(-1)?.x ?? FX}
			<circle
				cx={last}
				cy={TY}
				r="12"
				fill="var(--ly-earth)"
				stroke="var(--surface)"
				stroke-width="2"
			/>
			<Readout id="ly-short" order={2} label="New Years" value={shortText}>
				<Label
					anchor="start"
					x={TX0}
					y={TY - 76}
					text={shortText}
					size={15}
					weight={600}
					halo={false}
				/>
				<Label
					anchor="start"
					x={TX0}
					y={TY - 56}
					text="each tick: where Earth is at one New Year"
					size={13}
					muted
					halo={false}
				/>
			</Readout>
		{/if}
	{:else if charted}
		<Readout id="ly-title">
			<Label
				anchor="start"
				x={CX0 - 40}
				y={CY0 - 58}
				text={chartTitle}
				size={15}
				weight={700}
				color={phase === 'same' ? 'var(--ly-greg)' : lineColor}
			/>
		</Readout>
		<Axes {sx} {sy} xLabel="years after 2001" {yTicks} {yFormat} />
		{#each lines as l (l.id)}
			<path
				d={l.d}
				fill="none"
				stroke={l.color}
				stroke-width={l.w}
				opacity={l.o}
				stroke-linejoin="round"
			/>
		{/each}
		{#if dot}
			<circle
				cx={dot.x}
				cy={dot.y}
				r="6"
				fill={lineColor}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/if}
		{#if phase !== 'same'}
			<Readout id="ly-when" order={2} label={yearsText} value={dateText} note={whenNote}>
				<Label
					anchor="start"
					x={CX0 - 40}
					y={CY0 - 30}
					text={`${yearsText}: ${dateText}`}
					size={14}
					weight={600}
				/>
				<Label anchor="start" x={CX0 - 40} y={CY0 - 12} text={whenNote} size={13} muted />
			</Readout>
		{:else}
			<Readout id="ly-same" order={2} label="Every year" value="June 20, 21 or 22">
				<Label
					anchor="start"
					x={CX0 - 40}
					y={CY0 - 30}
					text="The longest day stays on June 20, 21 or 22"
					size={14}
					weight={600}
				/>
			</Readout>
		{/if}
	{:else if phase === 'which'}
		<Readout
			id="ly-year"
			order={2}
			label={String(yr)}
			value={reason.leap ? 'a leap year' : 'not a leap year'}
		>
			<Label
				anchor="start"
				x={GX - 40}
				y={110}
				text={`${yr}: ${reason.leap ? 'a leap year' : 'not a leap year'}`}
				size={24}
				weight={700}
				color={reason.leap ? 'var(--ly-greg)' : 'var(--ly-none)'}
			/>
		</Readout>
		{#each reason.checks as c, i (i)}
			<Readout id="ly-check-{i}" order={3 + i} label={i === 0 ? 'Check' : 'then'} value={c}>
				<Label anchor="start" x={GX - 40} y={146 + i * 24} text={`${i + 1}. ${c}`} size={14} />
			</Readout>
		{/each}
		<Label
			anchor="start"
			x={GX - 40}
			y={GY - 40}
			text={`February ${yr}: ${febDays} days`}
			size={15}
			weight={700}
		/>
		{#each DAYS as d, i (i)}
			<Label
				x={GX + i * GW + GW / 2}
				y={GY - 12}
				text={d}
				anchor="middle"
				size={12}
				muted
				halo={false}
			/>
		{/each}
		{#each cells as c (c.n)}
			<rect
				x={GX + c.col * GW + 2}
				y={GY + c.row * GH}
				width={GW - 4}
				height={GH - 4}
				rx="4"
				fill={c.n === 29 ? 'var(--ly-greg)' : 'var(--surface)'}
				stroke="var(--border)"
			/>
			<text
				x={GX + c.col * GW + GW / 2}
				y={GY + c.row * GH + 19}
				text-anchor="middle"
				font-size="13"
				font-weight={c.n === 29 ? 700 : 400}
				fill={c.n === 29 ? '#ffffff' : 'var(--stage-ink)'}>{c.n}</text
			>
		{/each}
	{/if}
</g>
