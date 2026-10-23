<script lang="ts">
	/**
	 * Three days and nights of the two-process model.
	 *
	 * Left: a face that shows how sleepy you feel (the gap between the tank and the sleep line)
	 * and the tank of sleep pressure, with the clock's sleep line and waking line on it. Right:
	 * the tank's level over three days (06:00 on day 1 to noon on day 4), the two lines, and a
	 * bar of the time in bed and asleep. A cursor sweeps the days in SWEEP seconds (a pure
	 * function of t) and holds the finished picture; under reduced motion the finished picture
	 * is shown at the step's telling moment. In the night step the chart zooms into the first
	 * night and a strip underneath sketches its rounds of light, deep and dreaming sleep.
	 *
	 * Each step runs the plan of its own control only (the others at their defaults), and a
	 * faint dashed copy of the ordinary days stays behind for comparison.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, cycle, linePath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULT_PLAN,
		END,
		START,
		at,
		clockText,
		feeling,
		gap,
		lower,
		nights,
		rounds,
		simulate,
		upper,
		type Plan,
		type Sample
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'tank'));
	const night = $derived(phase === 'night');

	// ---- the plan of this step ----------------------------------------------------------
	const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
	const plan = $derived.by((): Plan => {
		switch (phase) {
			case 'clock':
				return { ...DEFAULT_PLAN, mode: 'free' };
			case 'bedtime':
				return { ...DEFAULT_PLAN, bedtime: num(params.bedtime, 22.5) };
			case 'alarm':
				return { ...DEFAULT_PLAN, wake: num(params.wake, 7) };
			case 'skip':
				return params.skip === true ? { ...DEFAULT_PLAN, skip: 2 } : DEFAULT_PLAN;
			case 'nap': {
				const m = num(params.nap, 0);
				return m > 0 ? { ...DEFAULT_PLAN, napMinutes: m, napAt: 15 } : DEFAULT_PLAN;
			}
			default:
				return DEFAULT_PLAN;
		}
	});
	const series = $derived(simulate(plan));
	const sleeps = $derived(nights(series, plan));
	const base = simulate(DEFAULT_PLAN);
	const baseNights = nights(base, DEFAULT_PLAN);
	const changed = $derived(
		['bedtime', 'alarm', 'skip', 'nap'].includes(phase) &&
			(plan.bedtime !== 22.5 || plan.wake !== 7 || !!plan.skip || !!plan.napMinutes)
	);

	// ---- the window, the cursor ----------------------------------------------------------
	const first = $derived(sleeps[0] ?? baseNights[0]);
	const nightFrom = $derived(first.bed - 0.75);
	const nightTo = $derived(first.wake + 0.75);
	const target = $derived<[number, number]>(night ? [nightFrom, nightTo] : [START, END]);
	const dom0 = new Tween(START, { duration: 800, easing: cubicInOut });
	const dom1 = new Tween(END, { duration: 800, easing: cubicInOut });
	/** Fades: the day chart's extras, the night strip, the sleep and waking lines. */
	const fDay = new Tween(1, { duration: 700, easing: cubicInOut });
	const fNight = new Tween(0, { duration: 700, easing: cubicInOut });
	const fLine = new Tween(0, { duration: 700, easing: cubicInOut });
	const fWake = new Tween(0, { duration: 700, easing: cubicInOut });
	/** Bottom of the chart: lower in the day view, raised to make room for the night strip. */
	const bottom = new Tween(372, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const [a, b] = target;
		const n = night;
		const p = phase;
		untrack(() => {
			dom0.set(a);
			dom1.set(b);
			fDay.set(n ? 0 : 1);
			fNight.set(n ? 1 : 0);
			fLine.set(p === 'tank' ? 0 : 1);
			fWake.set(p === 'clock' || p === 'alarm' ? 1 : p === 'tank' || n ? 0 : 0.35);
			bottom.set(n ? 250 : 372);
		});
	});

	const LEAD = 0.6;
	const SWEEP = 20;
	const SWEEP_NIGHT = 16;
	/** Under reduced motion: the moment each step is about. */
	const still = $derived.by(() => {
		switch (phase) {
			case 'bedtime':
				return 24 + 23;
			case 'skip':
				return 48 + 16;
			case 'nap':
				return 24 + 22.5;
			case 'night':
				return target[1];
			default:
				return 24 + 21;
		}
	});
	const now = $derived(
		reduced
			? still
			: target[0] + clamp((t - LEAD) / (night ? SWEEP_NIGHT : SWEEP)) * (target[1] - target[0])
	);
	const here = $derived(at(series, now));
	const mood = $derived(feeling(here));
	const day = $derived(Math.floor(now / 24) + 1);

	// ---- chart geometry -----------------------------------------------------------------
	const X0 = 330;
	const X1 = 928;
	const TOP = 70;
	const sx = $derived(scale([dom0.current, dom1.current], [X0, X1]));
	const sy = $derived(scale([0, 1], [bottom.current, TOP]));
	const xTicks = $derived.by(() => {
		const a = Math.ceil(dom0.current - 1e-6);
		const b = Math.floor(dom1.current + 1e-6);
		const stepH = night ? 1 : 6;
		const out: number[] = [];
		for (let h = Math.ceil(a / stepH) * stepH; h <= b; h += stepH) out.push(h);
		return out;
	});
	const hourText = (h: number) => {
		const hh = ((h % 24) + 24) % 24;
		return hh === 0 ? 'midnight' : hh === 12 ? 'noon' : `${hh}:00`;
	};

	const inView = (x: Sample) => x.t >= dom0.current - 0.1 && x.t <= dom1.current + 0.1;
	const shown = $derived(thin(series.filter((x) => x.t <= now + 1e-9 && inView(x))));
	const ghost = $derived(changed ? thin(base.filter(inView)) : []);
	const sPath = $derived(
		linePath(
			shown,
			(x) => x.t,
			(x) => x.s,
			sx,
			sy
		)
	);
	const ghostPath = $derived(
		linePath(
			ghost,
			(x) => x.t,
			(x) => x.s,
			sx,
			sy
		)
	);

	/** The clock's lines, sampled every quarter hour over the view. */
	const lineTimes = $derived.by(() => {
		const out: number[] = [];
		for (let h = dom0.current; h <= dom1.current + 1e-6; h += 0.25) out.push(h);
		return out;
	});
	const upPath = $derived(linePath(lineTimes, (h) => h, upper, sx, sy));
	const loPath = $derived(linePath(lineTimes, (h) => h, lower, sx, sy));

	/** Where the tank is over the sleep line while awake: the sleepiness, shaded. */
	const overPaths = $derived.by(() => {
		const out: string[] = [];
		let run: Sample[] = [];
		const flush = () => {
			if (run.length > 1) {
				let d = '';
				run.forEach((x, i) => (d += `${i ? 'L' : 'M'}${sx(x.t).toFixed(1)} ${sy(x.s).toFixed(1)}`));
				for (let i = run.length - 1; i >= 0; i--)
					d += `L${sx(run[i].t).toFixed(1)} ${sy(upper(run[i].t)).toFixed(1)}`;
				out.push(d + 'Z');
			}
			run = [];
		};
		for (const x of shown) {
			if (!x.asleep && x.s > upper(x.t)) run.push(x);
			else flush();
		}
		flush();
		return out;
	});

	/** The bar under the chart: in bed awake, and asleep, up to the cursor. */
	const BAR_Y = 418;
	const BAR_H = 22;
	const bars = $derived.by(() => {
		const out: { kind: 'bed' | 'sleep'; a: number; b: number }[] = [];
		let cur: { kind: 'bed' | 'sleep'; a: number; b: number } | null = null;
		for (const x of series) {
			if (x.t > now) break;
			const kind = x.asleep ? 'sleep' : x.inBed && plan.mode === 'bed' ? 'bed' : null;
			if (kind && cur && cur.kind === kind) cur.b = x.t + 1 / 12;
			else {
				if (cur) out.push(cur);
				cur = kind ? { kind, a: x.t, b: x.t + 1 / 12 } : null;
			}
		}
		if (cur) out.push(cur);
		return out.map((r) => ({ ...r, b: Math.min(r.b, now) }));
	});
	const dayLabels = [
		{ d: 1, t: 15 },
		{ d: 2, t: 36 },
		{ d: 3, t: 60 },
		{ d: 4, t: 79 }
	];

	// ---- the night strip ------------------------------------------------------------------
	const ROW = { awake: 300, dream: 336, light: 372, deep: 414 };
	const night1 = $derived(rounds(series, first));
	const hypno = $derived.by(() => {
		type Seg = { a: number; b: number; y: number; kind: keyof typeof ROW };
		const segs: Seg[] = [];
		segs.push({ a: dom0.current, b: first.onset, y: ROW.awake, kind: 'awake' });
		for (const r of night1) {
			const len = r.to - r.from;
			const light = len - r.deep - r.dream;
			let x = r.from;
			const push = (h: number, kind: keyof typeof ROW) => {
				if (h <= 0.01) return;
				segs.push({ a: x, b: x + h, y: ROW[kind], kind });
				x += h;
			};
			push(light * 0.6, 'light');
			push(r.deep, 'deep');
			push(light * 0.4, 'light');
			push(r.dream, 'dream');
		}
		segs.push({ a: first.wake, b: dom1.current, y: ROW.awake, kind: 'awake' });
		return segs;
	});
	const hypnoPath = $derived.by(() => {
		let d = '';
		hypno.forEach((s, i) => {
			const a = sx(Math.max(s.a, dom0.current)).toFixed(1);
			const b = sx(Math.min(s.b, dom1.current)).toFixed(1);
			d += `${i ? 'L' : 'M'}${a} ${s.y}L${b} ${s.y}`;
		});
		return d;
	});
	const cursorX = $derived(sx(clamp(now, dom0.current, dom1.current)));
	const deepMin = $derived(night1.map((r) => Math.round(r.deep * 60)));

	// ---- the face and the tank --------------------------------------------------------------
	const FACE = { x: 165, y: 132, r: 62 };
	/** How heavy the eyelids are: 0 wide open, 1 shut. */
	const droop = $derived(here.asleep ? 1 : clamp((gap(here) + 0.36) / 0.56));
	const eyeRy = $derived(Math.max(1.2, 10 * (1 - droop)));
	const yawn = $derived(!here.asleep && gap(here) > 0.08);
	const smile = $derived(clamp(-gap(here) / 0.3, -0.2, 1));
	const zs = $derived(
		here.asleep
			? [0, 1, 2].map((k) => {
					const u = reduced ? (k + 0.5) / 3 : cycle(t, 3, k / 3);
					return { k, x: FACE.x + 54 + u * 30, y: FACE.y - 40 - u * 40, o: Math.sin(Math.PI * u) };
				})
			: []
	);

	const TANK = { x: 115, y: 270, w: 100, h: 270 };
	const ty = (v: number) => TANK.y + TANK.h * (1 - clamp(v));
	const upNow = $derived(upper(here.t));
	const loNow = $derived(lower(here.t));
	const pct = (v: number) => `${Math.round(v * 100)} %`;

	// ---- what the step reads out ------------------------------------------------------------
	const fmtDur = (h: number) => {
		const m = Math.round(h * 60);
		return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
	};
	const verdict = $derived.by((): { a: string; b?: string } | null => {
		const n0 = sleeps[0];
		const b0 = baseNights[0];
		switch (phase) {
			case 'tank':
				return {
					a: `At bedtime the tank is ${pct(b0.sAtOnset)} full`,
					b: `when the alarm rings, ${pct(b0.sAtWake)}`
				};
			case 'clock':
				return n0
					? {
							a: `Left alone: asleep at ${clockText(n0.onset)}, awake at ${clockText(n0.wake)}`,
							b: `${fmtDur(n0.wake - n0.onset)} of sleep`
						}
					: null;
			case 'bedtime': {
				const lie = n0.onset - n0.bed;
				return {
					a:
						lie < 0.05
							? `In bed at ${clockText(n0.bed)}: asleep at once`
							: `In bed at ${clockText(n0.bed)}, asleep at ${clockText(n0.onset)}: ${fmtDur(lie)} lying awake`,
					b: `Tank when the alarm rings: ${pct(n0.sAtWake)} (usually ${pct(b0.sAtWake)})`
				};
			}
			case 'alarm':
				return {
					a: `Tank when you get up: ${pct(n0.sAtWake)} (usually ${pct(b0.sAtWake)})`,
					b: n0.natural
						? `You wake by yourself at ${clockText(n0.wake)}, before the alarm`
						: `The alarm rings at ${clockText(n0.wake)}`
				};
			case 'skip': {
				if (!plan.skip) return { a: 'Turn on the all-nighter' };
				return {
					a: `Day 3 at 22:30: tank ${pct(at(series, 70.5).s)} full (usually ${pct(at(base, 70.5).s)})`,
					b: `${feelingText(at(series, 56))} at 8:00, ${feeling(at(series, 64))} at 16:00`
				};
			}
			case 'nap': {
				const n1 = sleeps[1];
				const b1 = baseNights[1];
				if (!plan.napMinutes)
					return { a: `No nap: asleep at ${clockText(b1.onset)} on the night of day 2` };
				return {
					a: `After the nap: asleep at ${clockText(n1.onset)} that night`,
					b: `${fmtDur(n1.onset - b1.onset)} later than without it (${clockText(b1.onset)})`
				};
			}
			case 'night':
				return {
					a: `${night1.length} rounds in ${fmtDur(first.wake - first.onset)} of sleep`,
					b: `deep sleep: ${deepMin[0]} min in the first round, ${deepMin[deepMin.length - 1]} in the last`
				};
			default:
				return { a: 'The clock in this toy never moves.', b: 'A real one is moved by light.' };
		}
	});
	function feelingText(x: Sample) {
		const f = feeling(x);
		return f.charAt(0).toUpperCase() + f.slice(1);
	}
	const moodText = $derived(mood.charAt(0).toUpperCase() + mood.slice(1));
</script>

<g class="sleepy">
	<!-- the time -->
	<Readout id="time" order={1} label="Time" value="Day {day}, {clockText(now)}">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={17}
			weight={600}
			tabular
			text="Day {day} · {clockText(now)}"
		/>
	</Readout>

	<!-- the face -->
	<g>
		<circle
			cx={FACE.x}
			cy={FACE.y}
			r={FACE.r}
			fill="var(--sl-face)"
			stroke="var(--sl-face-edge)"
			stroke-width="2"
		/>
		{#each [-1, 1] as side (side)}
			{@const ex = FACE.x + side * 22}
			{@const ey = FACE.y - 10}
			{#if here.asleep}
				<path
					d="M{ex - 11} {ey} Q{ex} {ey + 7} {ex + 11} {ey}"
					fill="none"
					stroke="var(--sl-ink)"
					stroke-width="3"
					stroke-linecap="round"
				/>
			{:else}
				<ellipse
					cx={ex}
					cy={ey}
					rx="11"
					ry={eyeRy}
					fill="var(--sl-eye)"
					stroke="var(--sl-ink)"
					stroke-width="2"
				/>
				<circle cx={ex} cy={ey + 1} r={Math.min(5, eyeRy)} fill="var(--sl-ink)" />
				<path
					d="M{ex - 13} {ey - eyeRy - 1} Q{ex} {ey - eyeRy - 6} {ex + 13} {ey - eyeRy - 1}"
					fill="none"
					stroke="var(--sl-ink)"
					stroke-width="2.5"
					stroke-linecap="round"
				/>
			{/if}
		{/each}
		{#if yawn}
			<ellipse cx={FACE.x} cy={FACE.y + 30} rx="11" ry="14" fill="var(--sl-ink)" />
		{:else if here.asleep}
			<path
				d="M{FACE.x - 10} {FACE.y + 30} Q{FACE.x} {FACE.y + 34} {FACE.x + 10} {FACE.y + 30}"
				fill="none"
				stroke="var(--sl-ink)"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		{:else}
			<path
				d="M{FACE.x - 20} {FACE.y + 26} Q{FACE.x} {FACE.y + 26 + 18 * smile} {FACE.x + 20} {FACE.y +
					26}"
				fill="none"
				stroke="var(--sl-ink)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/if}
		{#each zs as z (z.k)}
			<text
				x={z.x}
				y={z.y}
				font-size={18 + 6 * z.k}
				font-weight="700"
				fill="var(--sl-sleep)"
				opacity={z.o}>z</text
			>
		{/each}
	</g>
	<Readout id="mood" order={2} label="You feel" value={mood}>
		<Label x={FACE.x} y={226} size={18} weight={700} text={moodText} />
	</Readout>

	<!-- the tank -->
	<g>
		<rect
			x={TANK.x}
			y={TANK.y}
			width={TANK.w}
			height={TANK.h}
			rx="12"
			fill="var(--sl-tank-bg)"
			stroke="var(--sl-tank-edge)"
			stroke-width="2"
		/>
		<clipPath id="sl-tank-clip">
			<rect x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx="12" />
		</clipPath>
		<g clip-path="url(#sl-tank-clip)">
			<rect
				x={TANK.x}
				y={ty(here.s)}
				width={TANK.w}
				height={TANK.y + TANK.h - ty(here.s)}
				fill="var(--sl-tank)"
			/>
			{#if here.s > upNow && !here.asleep}
				<rect
					x={TANK.x}
					y={ty(here.s)}
					width={TANK.w}
					height={ty(upNow) - ty(here.s)}
					fill="var(--sl-over)"
					opacity={fLine.current}
				/>
			{/if}
		</g>
		<line
			x1={TANK.x - 8}
			x2={TANK.x + TANK.w + 8}
			y1={ty(upNow)}
			y2={ty(upNow)}
			stroke="var(--sl-line)"
			stroke-width="3"
			stroke-dasharray="8 5"
			opacity={fLine.current}
		/>
		<line
			x1={TANK.x - 8}
			x2={TANK.x + TANK.w + 8}
			y1={ty(loNow)}
			y2={ty(loNow)}
			stroke="var(--sl-wake)"
			stroke-width="2.5"
			stroke-dasharray="3 4"
			opacity={fWake.current}
		/>
		<Readout id="tank" order={3} label="Sleep-pressure tank" value="{pct(here.s)} full">
			<Label
				x={TANK.x + TANK.w / 2}
				y={TANK.y + TANK.h + 26}
				size={15}
				weight={600}
				text="tank {pct(here.s)} full"
			/>
		</Readout>
		<Readout id="tank-title">
			{#snippet narrow()}
				<Label x={TANK.x + TANK.w / 2} y={TANK.y - 14} size={24} weight={600} text="the tank" />
			{/snippet}
			<Label x={TANK.x + TANK.w / 2} y={TANK.y - 12} size={13} muted text="sleep pressure" />
		</Readout>
		<Readout id="tank-line">
			<Label
				x={TANK.x - 12}
				y={ty(upNow) + 4}
				anchor="end"
				size={12}
				color="var(--sl-line-ink)"
				opacity={fLine.current}
				text="sleep"
			/>
			<Label
				x={TANK.x - 12}
				y={ty(loNow) + 4}
				anchor="end"
				size={12}
				color="var(--sl-wake-ink)"
				opacity={fWake.current}
				text="wake"
			/>
		</Readout>
	</g>

	<!-- the chart -->
	<Axes
		{sx}
		{sy}
		{xTicks}
		yTicks={[0, 0.5, 1]}
		xFormat={hourText}
		yFormat={(v) => (v === 0 ? 'empty' : v === 1 ? 'full' : 'half')}
	/>
	{#each dayLabels as d (d.d)}
		{@const x = sx(d.t)}
		{#if x > X0 + 20 && x < X1 - 20}
			<Readout id="day-{d.d}">
				{#snippet narrow()}
					<Label {x} y={TOP - 16} size={26} weight={700} opacity={fDay.current} text="Day {d.d}" />
				{/snippet}
				<Label {x} y={TOP - 18} size={14} weight={600} opacity={fDay.current} text="Day {d.d}" />
			</Readout>
		{/if}
	{/each}

	{#if ghostPath}
		<path
			d={ghostPath}
			fill="none"
			stroke="var(--sl-tank)"
			stroke-width="2"
			stroke-dasharray="5 5"
			opacity="0.45"
		/>
	{/if}
	<path
		d={upPath}
		fill="none"
		stroke="var(--sl-line)"
		stroke-width="2.5"
		stroke-dasharray="9 6"
		opacity={fLine.current}
	/>
	<path
		d={loPath}
		fill="none"
		stroke="var(--sl-wake)"
		stroke-width="2"
		stroke-dasharray="3 4"
		opacity={fWake.current}
	/>
	{#each overPaths as d, i (i)}
		<path {d} fill="var(--sl-over)" opacity={0.55 * fLine.current} />
	{/each}
	<path
		d={sPath}
		fill="none"
		stroke="var(--sl-tank-ink)"
		stroke-width="3.5"
		stroke-linejoin="round"
	/>
	<circle
		cx={cursorX}
		cy={sy(here.s)}
		r="6"
		fill="var(--sl-tank-ink)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<line
		x1={cursorX}
		x2={cursorX}
		y1={TOP - 6}
		y2={night ? 430 : BAR_Y + BAR_H + 4}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
		opacity="0.6"
	/>

	<Readout id="chart-keys">
		{#if !night}
			<Label
				x={sx(19.5)}
				y={sy(at(series, 19.5).s) + 24}
				size={13}
				weight={600}
				color="var(--sl-tank-ink)"
				text="the tank"
			/>
			<Label
				x={sx(13)}
				y={sy(upper(13)) - 12}
				size={13}
				weight={600}
				color="var(--sl-line-ink)"
				opacity={fLine.current}
				text="sleep line"
			/>
			<Label
				x={sx(13)}
				y={sy(lower(13)) + 22}
				size={13}
				weight={600}
				color="var(--sl-wake-ink)"
				opacity={fWake.current}
				text="waking line"
			/>
		{/if}
	</Readout>

	<!-- in bed and asleep -->
	<g opacity={fDay.current}>
		<rect x={X0} y={BAR_Y} width={X1 - X0} height={BAR_H} rx="5" fill="var(--sl-bar-bg)" />
		{#each bars as r (r.kind + r.a)}
			<rect
				x={sx(Math.max(r.a, dom0.current))}
				y={BAR_Y}
				width={Math.max(0, sx(Math.min(r.b, dom1.current)) - sx(Math.max(r.a, dom0.current)))}
				height={BAR_H}
				fill={r.kind === 'sleep' ? 'var(--sl-sleep)' : 'var(--sl-bed)'}
			/>
		{/each}
		<Readout id="bar-key">
			<Label x={X0 - 10} y={BAR_Y + 16} anchor="end" size={13} weight={600} text="asleep" />
		</Readout>
		{#if bars.some((r) => r.kind === 'bed')}
			<Readout
				id="bed-key"
				order={5}
				label="Light blue"
				value="in bed, still awake"
				opacity={fDay.current}
			>
				<rect x={X1 - 138} y={BAR_Y + 30} width="16" height="12" rx="3" fill="var(--sl-bed)" />
				<Label x={X1} y={BAR_Y + 41} anchor="end" size={13} text="in bed, still awake" />
			</Readout>
		{/if}
	</g>

	<!-- one night, inside -->
	{#if fNight.current > 0.01}
		<g opacity={fNight.current}>
			<clipPath id="sl-night-clip">
				<rect x={X0 - 4} y={ROW.awake - 20} width={Math.max(0, cursorX - X0 + 4)} height="160" />
			</clipPath>
			{#each Object.entries(ROW) as [k, y] (k)}
				<line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--stage-grid)" stroke-width="1" />
				<Readout id="row-{k}">
					{#snippet narrow()}
						<Label
							x={X0 + 6}
							y={y - 7}
							anchor="start"
							size={24}
							weight={600}
							color={k === 'deep'
								? 'var(--sl-deep-ink)'
								: k === 'dream'
									? 'var(--sl-dream-ink)'
									: undefined}
							text={k === 'awake'
								? 'awake'
								: k === 'dream'
									? 'dreaming'
									: k === 'light'
										? 'light sleep'
										: 'deep sleep'}
						/>
					{/snippet}
					<Label
						x={X0 - 10}
						y={y + 4}
						anchor="end"
						size={13}
						weight={600}
						color={k === 'deep'
							? 'var(--sl-deep-ink)'
							: k === 'dream'
								? 'var(--sl-dream-ink)'
								: undefined}
						text={k === 'awake'
							? 'awake'
							: k === 'dream'
								? 'dreaming'
								: k === 'light'
									? 'light sleep'
									: 'deep sleep'}
					/>
				</Readout>
			{/each}
			<g clip-path="url(#sl-night-clip)">
				{#each hypno as s, i (i)}
					{#if s.kind === 'deep' || s.kind === 'dream'}
						<rect
							x={sx(s.a)}
							y={s.y - 7}
							width={Math.max(2, sx(s.b) - sx(s.a))}
							height="14"
							rx="4"
							fill={s.kind === 'deep' ? 'var(--sl-deep)' : 'var(--sl-dream)'}
						/>
					{/if}
				{/each}
				<path
					d={hypnoPath}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			</g>
			{#each night1 as r, i (i)}
				<line
					x1={sx(r.from)}
					x2={sx(r.from)}
					y1={ROW.awake - 14}
					y2={ROW.deep + 12}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					stroke-dasharray="2 4"
					opacity="0.7"
				/>
				<Readout id="round-{i}">
					<Label
						x={(sx(r.from) + sx(r.to)) / 2}
						y={ROW.deep + 40}
						size={13}
						muted
						text="round {i + 1}"
					/>
				</Readout>
			{/each}
		</g>
	{/if}

	<!-- the step's result -->
	{#if verdict}
		<Readout id="verdict" order={4} label="Result" value={verdict.a} note={verdict.b}>
			<rect
				x={X0}
				y={night ? 480 : 470}
				width={X1 - X0}
				height={verdict.b ? 66 : 42}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={X0 + 16}
				y={(night ? 480 : 470) + 27}
				anchor="start"
				size={16}
				weight={600}
				halo={false}
				text={verdict.a}
			/>
			{#if verdict.b}
				<Label
					x={X0 + 16}
					y={(night ? 480 : 470) + 52}
					anchor="start"
					size={14}
					muted
					halo={false}
					text={verdict.b}
				/>
			{/if}
		</Readout>
	{/if}
</g>
