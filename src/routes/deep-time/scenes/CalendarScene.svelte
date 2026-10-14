<script lang="ts">
	/**
	 * Earth's history squeezed into one calendar year (1 January: the Earth forms; midnight at the
	 * end of 31 December: today), drawn as four strips, each a zoom into the end of the one above:
	 * the whole year, its last seven weeks, 31 December, and the last two minutes.
	 *
	 * Phases: `year` (the first two strips in focus, an event picked with the `calEvent` control)
	 * and `midnight` (the last two). A sweep runs along the strips in focus and lights each event
	 * as it passes; with reduced motion the sweep is complete.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import T from './T.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		EARTH_AGE,
		EVENTS,
		LIFE,
		MONTHS,
		YEARS_PER_SECOND,
		ageText,
		calendarText,
		toCalendar
	} from '../deeptime';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(step.hints?.phase === 'midnight' ? 'midnight' : 'year');

	const DAY = 86400;
	const YEAR = 365 * DAY;
	const XA = 40;
	const XB = 920;
	interface Strip {
		id: string;
		title: string;
		/** Calendar seconds at the strip's two ends. */
		from: number;
		to: number;
		y: number;
	}
	const STRIPS: Strip[] = [
		{ id: 'year', title: 'The whole year: 4,567 million years', from: 0, to: YEAR, y: 84 },
		{
			id: 'weeks',
			title: '15 November – 31 December: the last 590 million years',
			from: YEAR - 47 * DAY,
			to: YEAR,
			y: 222
		},
		{
			id: 'day',
			title: '31 December: the last 12.5 million years',
			from: YEAR - DAY,
			to: YEAR,
			y: 360
		},
		{
			id: 'minutes',
			title: '23:58 to midnight: the last 17,000 years',
			from: YEAR - 120,
			to: YEAR,
			y: 498
		}
	];
	const H = 30;
	const xIn = (s: Strip, sec: number) => XA + ((sec - s.from) / (s.to - s.from)) * (XB - XA);

	// the events of each strip and where their labels go: above (−1) or below (+1), and the row
	type Placed = {
		id: string;
		name: string;
		age: number;
		side: number;
		row: number;
		anchor: 'start' | 'middle' | 'end';
	};
	const ev = (id: string) => {
		const e = EVENTS.find((x) => x.id === id);
		if (e) return { id, name: e.name, age: e.age };
		const g = LIFE.find((x) => x.id === id)!;
		return { id, name: g.name, age: g.from };
	};
	const place = (
		id: string,
		side: number,
		row: number,
		anchor: Placed['anchor'] = 'middle'
	): Placed => ({ ...ev(id), side, row, anchor });
	const ON: Record<string, Placed[]> = {
		year: [
			place('earth', 1, 0, 'start'),
			place('zircon', -1, 0, 'start'),
			place('rocks', 1, 1, 'start'),
			place('life', -1, 0),
			place('oxygen', 1, 0),
			place('eukaryotes', -1, 0),
			place('snowball', 1, 0, 'end'),
			place('animals', -1, 0, 'end')
		],
		weeks: [
			place('animals', -1, 0, 'start'),
			place('cambrian', 1, 0, 'start'),
			place('vertebrates', -1, 1, 'start'),
			place('plants', 1, 1),
			place('tetrapods', -1, 0),
			place('permian', 1, 0, 'end'),
			place('dinosaurs', -1, 0),
			place('mammals', 1, 1),
			place('flowers', -1, 1),
			place('kpg', 1, 0, 'end')
		],
		day: [place('hominins', -1, 0), place('homo', 1, 0), place('sapiens', -1, 0, 'end')],
		minutes: [place('farming', -1, 0), place('writing', 1, 0), place('industry', -1, 0, 'end')]
	};

	const months = (() => {
		const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		let d = 0;
		return days.map((n, i) => {
			const m = { i, from: d * DAY, to: (d + n) * DAY };
			d += n;
			return m;
		});
	})();

	const focus = (on: () => boolean) => {
		const tw = new Tween(on() ? 1 : 0.32, { duration: 700, easing: cubicInOut });
		$effect(() => {
			const v = on() ? 1 : 0.32;
			untrack(() => tw.set(v, { duration: reduced ? 0 : 700 }));
		});
		return tw;
	};
	const fTop = focus(() => phase === 'year');
	const fBottom = focus(() => phase === 'midnight');
	const stripOpacity = (s: Strip) =>
		s.id === 'year' || s.id === 'weeks' ? fTop.current : fBottom.current;

	/** The sweep: fraction of each focused strip already "lived", over 16 s per pair of strips. */
	const sweep = (s: Strip) => {
		if (reduced) return 1;
		const inFocus =
			phase === 'year' ? s.id === 'year' || s.id === 'weeks' : s.id === 'day' || s.id === 'minutes';
		if (!inFocus) return 1;
		const first = s.id === 'year' || s.id === 'day';
		return first ? Math.min(1, t / 9) : Math.max(0, Math.min(1, (t - 9) / 9));
	};

	const picked = $derived(String(params.calEvent ?? 'animals'));
	const pickedEvent = $derived(ev(picked));
	const two = (n: number) => String(n).padStart(2, '0');
	const timeOf = (age: number) => {
		const c = toCalendar(age);
		return `${two(c.hour)}:${two(c.minute)}:${two(c.second)}`;
	};
	const labelOf = (s: Strip, e: Placed) => {
		const c = toCalendar(e.age);
		const when =
			s.id === 'minutes'
				? timeOf(e.age)
				: s.id === 'day'
					? timeOf(e.age).slice(0, 5)
					: `${c.day} ${MONTHS[c.month].slice(0, 3)}`;
		return `${e.name} · ${when}`;
	};
	/** The share of each strip in the one above it, for the connectors. */
	const connectors = STRIPS.slice(1).map((s, i) => {
		const up = STRIPS[i];
		return { id: s.id, up, s, xa: xIn(up, s.from), xb: xIn(up, s.to) };
	});
	const lifeSeconds = (80 / YEARS_PER_SECOND).toFixed(2);
</script>

<g class="calendar-scene">
	{#each connectors as c (c.id)}
		<path
			d="M{c.xa} {c.up.y + H} L{c.xb} {c.up.y + H} L{XB} {c.s.y} L{XA} {c.s.y} Z"
			fill="var(--stage-grid)"
			opacity={0.55 * Math.min(stripOpacity(c.up), stripOpacity(c.s))}
		/>
	{/each}

	{#each STRIPS as s (s.id)}
		{@const o = stripOpacity(s)}
		{@const u = sweep(s)}
		<g opacity={o}>
			<Readout id="title-{s.id}">
				<text x={XA} y={s.y - 38} style:font-size="13px" font-weight="600">{s.title}</text>
			</Readout>
			<rect
				x={XA}
				y={s.y}
				width={XB - XA}
				height={H}
				rx="4"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect
				x={XA}
				y={s.y}
				width={(XB - XA) * u}
				height={H}
				rx="4"
				fill="var(--dt-cursor)"
				opacity="0.12"
			/>
			<!-- divisions: months, days, hours, quarter-minutes -->
			{#if s.id === 'year'}
				{#each months as m (m.i)}
					<path d="M{xIn(s, m.from)} {s.y}v{H}" stroke="var(--stage-grid)" />
					<text
						x={(xIn(s, m.from) + xIn(s, m.to)) / 2}
						y={s.y + 19}
						text-anchor="middle"
						style:font-size="11px"
						class="muted">{MONTHS[m.i].slice(0, 3)}</text
					>
				{/each}
			{:else if s.id === 'weeks'}
				{#each Array.from({ length: 48 }, (_, k) => k) as k (k)}
					{@const sec = s.from + k * DAY}
					<path d="M{xIn(s, sec)} {s.y}v{k === 16 ? H : 6}" stroke="var(--stage-grid)" />
				{/each}
				<text
					x={xIn(s, s.from + 8 * DAY)}
					y={s.y + 20}
					text-anchor="middle"
					style:font-size="11px"
					class="muted">November</text
				>
				<text
					x={xIn(s, s.from + 31 * DAY)}
					y={s.y + 20}
					text-anchor="middle"
					style:font-size="11px"
					class="muted">December</text
				>
			{:else if s.id === 'day'}
				{#each Array.from({ length: 25 }, (_, k) => k) as k (k)}
					<path d="M{xIn(s, s.from + k * 3600)} {s.y}v{k % 6 ? 6 : H}" stroke="var(--stage-grid)" />
					{#if k % 6 === 0 && k < 24}
						<text
							x={xIn(s, s.from + k * 3600) + 4}
							y={s.y + 20}
							style:font-size="10.5px"
							class="muted">{two(k)}:00</text
						>
					{/if}
				{/each}
			{:else}
				{#each Array.from({ length: 9 }, (_, k) => k) as k (k)}
					<path d="M{xIn(s, s.from + k * 15)} {s.y}v{k % 4 ? 6 : H}" stroke="var(--stage-grid)" />
				{/each}
				<text x={xIn(s, s.from) + 4} y={s.y + 20} style:font-size="10.5px" class="muted">23:58</text
				>
				<text x={xIn(s, s.from + 60) + 4} y={s.y + 20} style:font-size="10.5px" class="muted"
					>23:59</text
				>
				<!-- an 80-year life -->
				<rect
					x={xIn(s, YEAR - 80 / YEARS_PER_SECOND)}
					y={s.y + 4}
					width={Math.max(2, xIn(s, YEAR) - xIn(s, YEAR - 80 / YEARS_PER_SECOND))}
					height={H - 8}
					fill="var(--dt-humans)"
				/>
				<Readout
					id="life80"
					order={20}
					label="A human life of 80 years"
					value="{lifeSeconds} s"
					opacity={o}
				>
					<T
						x={XB}
						y={s.y + H + 46}
						text="a whole 80-year life: the last {lifeSeconds} s"
						anchor="end"
						size={11}
						muted
					/>
				</Readout>
			{/if}

			<!-- events -->
			{#each ON[s.id] as e (e.id)}
				{@const x = xIn(s, toCalendar(e.age).t)}
				{@const lit = smoothstep(-0.004, 0.004, u - (x - XA) / (XB - XA))}
				{@const sel = phase === 'year' && e.id === picked}
				{@const ly = e.side < 0 ? s.y - 9 - e.row * 13 : s.y + H + 16 + e.row * 13}
				<path
					d="M{x} {s.y - 2}v{H + 4}"
					stroke={sel ? 'var(--dt-cursor)' : 'var(--stage-ink)'}
					stroke-width={sel ? 3 : 1.6}
					opacity={0.3 + 0.7 * lit}
				/>
				<circle
					cx={x}
					cy={s.y + H / 2}
					r={sel ? 6 : 4}
					fill="var(--dt-cursor)"
					opacity={0.25 + 0.75 * lit}
				/>
				<Readout id="ev-{s.id}-{e.id}">
					<T
						{x}
						y={ly}
						text={labelOf(s, e)}
						size={11}
						weight={sel ? 700 : 500}
						anchor={e.anchor}
						opacity={0.35 + 0.65 * lit}
						color={sel ? 'var(--dt-cursor)' : undefined}
					/>
				</Readout>
			{/each}
		</g>
	{/each}

	<!-- readouts -->
	{#if phase === 'year'}
		<Readout
			id="picked"
			order={1}
			label={pickedEvent.name}
			value="{calendarText(pickedEvent.age, true)} · {ageText(pickedEvent.age)}"
		>
			<text x={XB} y="24" text-anchor="end" style:font-size="15px" font-weight="700"
				>{pickedEvent.name}: {calendarText(pickedEvent.age)}</text
			>
			<text x={XB} y="42" text-anchor="end" style:font-size="11px" class="muted"
				>{ageText(pickedEvent.age)}</text
			>
		</Readout>
	{/if}
	<Readout
		id="scale"
		order={2}
		label="On this calendar"
		value="1 day = 12.5 million years · 1 second = 145 years"
	>
		<text x={XA} y="24" style:font-size="13px" font-weight="600"
			>1 day = {(EARTH_AGE / 365).toFixed(1)} million years · 1 second = {Math.round(
				YEARS_PER_SECOND
			)} years</text
		>
	</Readout>
</g>

<style>
	.muted {
		fill: var(--stage-ink-muted);
	}
</style>
