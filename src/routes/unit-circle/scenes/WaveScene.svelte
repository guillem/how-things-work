<script lang="ts">
	/**
	 * From circle to wave: a small unit circle on the left and, on the right, a
	 * graph of its point's height (and sideways position) against the angle —
	 * at the same vertical scale and on the same baseline, so a horizontal
	 * dashed "link" joins the point on the circle to its point on the wave.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   sine     — sin θ traced from 0° to θ over a faint full period
	 *   cosine   — adds cos θ (and the point's sideways position on the circle),
	 *              with an arrow showing it is the sine slid 90° to the left
	 *   periodic — the angle axis widens to −360° … 720° (three turns), the
	 *              360° period is bracketed; negative angles turn clockwise
	 *   time     — the point spins by itself at f turns per second on a circle
	 *              of radius A, and the horizontal axis is time in seconds
	 *
	 * The angle lives in `params.angle` (degrees), shared with the slider; the
	 * handle writes to it. With `params.spin` on, the point turns at 45°/s from
	 * where it was; grabbing the handle, using its keys or moving the slider
	 * turns spin off and leaves the point where it is.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, scale, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { degText, num, radText, reduce, screenAngle, toRad, trigText, unwrap } from '../trig';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------
	// One unit is U stage units on the circle AND on the graph's vertical axis.
	// The circle's centre leaves room for the largest amplitude (1.5) inside the
	// 16 px margin, and the graph starts to the right of it.
	const U = 120;
	const CX = 200;
	const CY = 322;
	const GX0 = 402; // graph left
	const GX1 = 910; // graph right (tick labels centred on it stay inside 944)
	const SPEED = 45; // degrees per second while spinning
	const WINDOW = 10; // seconds of time shown in the oscillation phase

	const phase = $derived(String(step.hints?.phase ?? 'sine'));
	const isTime = $derived(phase === 'time');

	// The angle control of this step (0…360 or −360…720): the angle is shared
	// across steps, so a value set on `periodic` is wrapped into the others (see below).
	const angleControl = $derived.by(() => {
		const c = (step.controls ?? []).find((c) => c.id === 'angle');
		return c && c.type === 'range' ? c : null;
	});
	const range = $derived(
		angleControl ? { lo: angleControl.min, hi: angleControl.max } : { lo: 0, hi: 360 }
	);
	const clampA = (v: number) => Math.max(range.lo, Math.min(range.hi, v));
	/** The same point on the circle, as an angle in [lo, hi): whole turns added or removed. */
	const wrapInto = (v: number, lo: number, hi: number) =>
		lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
	/** An angle inside the step's range, keeping the point where it is on the circle. */
	const fit = (v: number) => (v >= range.lo && v <= range.hi ? v : wrapInto(v, range.lo, range.hi));
	const hasSpin = $derived((step.controls ?? []).some((c) => c.id === 'spin'));
	const spinOn = $derived(Boolean(params.spin) && hasSpin && !isTime);
	const angleVal = $derived(Number(params.angle));

	// ---- spin ----------------------------------------------------------------
	// Sanctioned exception (as in epidemics/CrowdScene): `t` when the current
	// spin started, and the angle it started from. A new spin starts when the
	// step changes, when spin is switched on, or when `t` goes back (a step
	// reset). Plain `let`s, never `$state`, are written here; the displayed
	// angle is otherwise a pure function of t.
	let startedAt = 0;
	let startAngle = 0;
	let startedKey = '';
	let lastT = 0;
	/** The last angle shown while spinning: where the point stops when spin goes off. */
	let lastSpinAngle = 0;
	/** params.angle while the point was spinning (NaN before it ever spun). */
	let angleAtSpin = NaN;
	const spinKey = $derived(`${step.id}:${spinOn}`);

	const theta = $derived.by(() => {
		if (!spinOn || reduced) {
			lastT = t;
			return fit(angleVal);
		}
		if (spinKey !== startedKey || t < lastT) {
			startedAt = t;
			// Coming from another wave step while spinning, carry on from where
			// the point was (the same point, if the ranges differ); otherwise
			// start from the angle control. `startedKey` is cleared whenever spin
			// goes off (see the freeze below), so switching spin back on always
			// starts from the angle control, never from an old spin.
			const carry = startedKey.endsWith(':true') && !startedKey.startsWith(`${step.id}:`);
			startAngle = carry ? fit(lastSpinAngle) : untrack(() => fit(Number(params.angle)));
			startedKey = spinKey;
		}
		lastT = t;
		// Past the end of the range, start again from 0° (the same point): on the
		// wide range the spin stays on positive angles, so the trace never jumps
		// to the clockwise side in the middle of the step.
		const lo = Math.max(0, range.lo);
		const raw = startAngle + SPEED * (t - startedAt);
		const v = raw <= range.hi ? raw : wrapInto(raw, lo, range.hi);
		lastSpinAngle = v;
		angleAtSpin = untrack(() => Number(params.angle));
		return v;
	});

	// When spin is switched off, the point stays where it was: write the angle
	// it was shown at into params.angle. Acts only on an on → off transition
	// (not on mount), and not when something else wrote an angle meanwhile —
	// the handle, its keys or the slider (they also set `skipFreeze`), or a
	// slider moved in the same tick as the toggle: params.angle no longer
	// holds the value it had while spinning, whatever order effects run in.
	let prevSpin: boolean | null = null;
	let skipFreeze = false;
	$effect(() => {
		const on = spinOn;
		untrack(() => {
			const untouched = Number(params.angle) === angleAtSpin;
			if (prevSpin === true && !on && !skipFreeze && untouched && !reduced) {
				setParam('angle', Math.round(fit(lastSpinAngle)));
			}
			// The next spin is a new one: it starts from params.angle.
			if (!on) startedKey = '';
			skipFreeze = false;
			prevSpin = on;
		});
	});

	// An angle beyond this step's range (set on `periodic`, −360…720) is
	// written back as the same point within the range (600° → 240°), so the
	// point does not jump and the slider can show it. `prevAngle` is updated
	// first so that this write is not mistaken for the slider below.
	$effect(() => {
		const { lo, hi } = range;
		if (!angleControl) return;
		untrack(() => {
			const a = Number(params.angle);
			if (a >= lo && a <= hi) return;
			const v = Math.round(wrapInto(a, lo, hi));
			prevAngle = v;
			setParam('angle', v);
		});
	});

	// Moving the angle slider while the point spins stops the spin at the
	// slider's value. While spin is on nothing else writes params.angle (the
	// handle and keys switch spin off first, the freeze above writes only once
	// spin is already off), so any change seen here while spinning came from the
	// slider. The first run only records the value.
	let prevAngle: number | null = null;
	$effect(() => {
		const v = angleVal;
		untrack(() => {
			if (prevAngle !== null && v !== prevAngle && spinOn) stopSpin();
			prevAngle = v;
		});
	});

	function stopSpin() {
		if (params.spin) {
			skipFreeze = true;
			setParam('spin', false);
		}
	}

	// ---- interaction -----------------------------------------------------------
	let dragPrev = 0;
	function setAngle(v: number) {
		setParam('angle', clampA(Math.round(v)));
	}
	function ondragstart() {
		dragPrev = theta; // where the point is now, spinning or not
		stopSpin();
	}
	function onmove(p: Point) {
		// unwrap keeps counting past 360° / below 0° (clamped to the range).
		dragPrev = clampA(unwrap(dragPrev, screenAngle(CX, CY, p.x, p.y)));
		setAngle(dragPrev);
	}
	function onkey(k: number | 'start' | 'end') {
		const from = Math.round(theta);
		stopSpin();
		if (k === 'start') return setAngle(range.lo);
		if (k === 'end') return setAngle(range.hi);
		const v = from + k;
		// On a single turn the keys wrap around; on the wide range they stop at the ends.
		if (range.lo === 0 && range.hi === 360)
			return setAngle(v > 360 ? v - 360 : v < 0 ? v + 360 : v);
		setAngle(v);
	}

	// ---- phase cross-fades -------------------------------------------------------
	const phases = ['sine', 'cosine', 'periodic', 'time'] as const;
	// Start at the deep-linked phase rather than cross-fading into it on mount.
	const initial = untrack(() => phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(p === initial ? 1 : 0, { duration: 700, easing: cubicInOut })])
	) as Record<(typeof phases)[number], Tween<number>>;
	// The angle axis: 0…360 for one turn, −360…720 for three.
	const domLo = new Tween(initial === 'periodic' ? -360 : 0, { duration: 800, easing: cubicInOut });
	const domHi = new Tween(initial === 'periodic' ? 720 : 360, {
		duration: 800,
		easing: cubicInOut
	});
	const amp = new Tween(
		untrack(() => Number(params.amplitude ?? 1)),
		{ duration: 600, easing: cubicInOut }
	);
	const ampParam = $derived(Number(params.amplitude ?? 1));
	$effect(() => {
		const current = phase;
		untrack(() => {
			const d = reduced ? 0 : 700;
			for (const p of phases) weights[p].set(p === current ? 1 : 0, { duration: d });
			if (current !== 'time') {
				const wide = current === 'periodic';
				domLo.set(wide ? -360 : 0, { duration: reduced ? 0 : 800 });
				domHi.set(wide ? 720 : 360, { duration: reduced ? 0 : 800 });
			}
		});
	});
	$effect(() => {
		const a = ampParam;
		untrack(() => amp.set(a, { duration: reduced ? 0 : 600 }));
	});
	const w = $derived({
		sine: weights.sine.current,
		cosine: weights.cosine.current,
		periodic: weights.periodic.current,
		time: weights.time.current
	});
	const wAngle = $derived(1 - w.time); // the angle graph, versus the time graph
	// Faint full-period ghosts; a little stronger on the dark stage to stay visible.
	const ghost = $derived(dark ? 0.42 : 0.3);
	const wCos = $derived(w.cosine + 0.6 * w.periodic); // the cosine, softer in `periodic`

	// ---- the angle graph -----------------------------------------------------------
	const sx = $derived(scale([domLo.current, domHi.current], [GX0, GX1]));
	const yOf = (v: number) => CY - U * v;
	const wide = $derived(domHi.current - domLo.current > 600);

	/** Path of sin or cos (degrees) between a and b, clipped to the visible domain. */
	function wave(fn: 'sin' | 'cos', a: number, b: number) {
		const lo = Math.max(Math.min(a, b), domLo.current);
		const hi = Math.min(Math.max(a, b), domHi.current);
		if (hi - lo < 0.01) return '';
		const n = Math.max(2, Math.ceil((hi - lo) / 4));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const deg = lo + ((hi - lo) * i) / n;
			const r = toRad(deg);
			const v = fn === 'sin' ? Math.sin(r) : Math.cos(r);
			d += `${i ? 'L' : 'M'}${sx(deg).toFixed(1)} ${yOf(v).toFixed(1)}`;
		}
		return d;
	}

	// The traced part runs from 0° to θ (backwards for negative angles). Under
	// reduced motion the whole period (or all three turns) is drawn instead.
	const traceFrom = $derived(reduced ? domLo.current : 0);
	const traceTo = $derived(reduced ? domHi.current : theta);
	const sinGhost = $derived(wave('sin', domLo.current, domHi.current));
	const cosGhost = $derived(wCos > 0.01 ? wave('cos', domLo.current, domHi.current) : '');
	const sinTrace = $derived(wave('sin', traceFrom, traceTo));
	const cosTrace = $derived(wCos > 0.01 ? wave('cos', traceFrom, traceTo) : '');

	const ANGLE_TICKS = [-360, -270, -180, -90, 0, 90, 180, 270, 360, 450, 540, 630, 720];

	// ---- the time graph ------------------------------------------------------------
	const freq = $derived(Number(params.frequency ?? 0.25));
	// Time since the step started; under reduced motion a full window is shown.
	const tt = $derived(reduced ? WINDOW : t);
	const tLo = $derived(Math.max(0, tt - WINDOW));
	const st = $derived(scale([tLo, tLo + WINDOW], [GX0, GX1]));
	const timePath = $derived.by(() => {
		if (w.time < 0.01) return '';
		const n = 400;
		const end = Math.min(tt, tLo + WINDOW);
		let d = '';
		for (let i = 0; i <= n; i++) {
			const s = tLo + ((end - tLo) * i) / n;
			const v = amp.current * Math.sin(2 * Math.PI * freq * s);
			d += `${i ? 'L' : 'M'}${st(s).toFixed(1)} ${yOf(v).toFixed(1)}`;
		}
		return d;
	});
	const timeTicks = $derived.by(() => {
		const out: number[] = [];
		for (let s = Math.ceil(tLo - 1e-9); s <= tLo + WINDOW + 1e-9; s++) out.push(s);
		return out;
	});

	// ---- the point -------------------------------------------------------------------
	// A pure function of t: changing f mid-step redraws the whole curve and
	// moves the point to its new phase. Intended — the graph always shows
	// exactly A·sin(2πft) for the current f, which is what the step's formula says.
	const thetaTime = $derived(360 * freq * tt);
	const shown = $derived(isTime ? thetaTime : theta);
	const rCircle = $derived(U * (wAngle + w.time * amp.current));
	const cos = $derived(Math.cos(toRad(shown)));
	const sin = $derived(Math.sin(toRad(shown)));
	const P = $derived({ x: CX + rCircle * cos, y: CY - rCircle * sin });
	const marker = $derived(
		isTime
			? { x: st(tt), y: yOf(amp.current * Math.sin(2 * Math.PI * freq * tt)) }
			: { x: sx(theta), y: yOf(sin) }
	);
	const markerVisible = $derived(
		isTime || (theta >= domLo.current - 0.5 && theta <= domHi.current + 0.5)
	);

	// The angle drawn on the circle as a slowly widening spiral, so that more
	// than one turn (and clockwise, negative angles) stays readable.
	const spiral = $derived.by(() => {
		if (isTime || Math.abs(theta) < 20) return '';
		const n = Math.max(2, Math.ceil(Math.abs(theta) / 6));
		let d = '';
		for (let i = 0; i <= n; i++) {
			const a = (theta * i) / n;
			const r = 24 + (9 * Math.abs(a)) / 360;
			d += `${i ? 'L' : 'M'}${(CX + r * Math.cos(toRad(a))).toFixed(1)} ${(CY - r * Math.sin(toRad(a))).toFixed(1)}`;
		}
		return d;
	});

	// ---- readouts ----------------------------------------------------------------------
	const thetaR = $derived(Math.round(theta));
	/** "π/6", "0", or "≈ 2.16 rad" when the radians are not a multiple of π. */
	const radLabel = (deg: number) => {
		const r = radText(deg);
		return r.includes('π') || r === '0' ? r : `≈ ${r} rad`;
	};
	const radSpoken = (deg: number) => {
		const r = radText(deg);
		return r.includes('π') || r === '0' ? `${r} radians` : `about ${r} radians`;
	};
	const sameAs = $derived(reduce(thetaR));
	const turns = $derived(Math.floor(thetaR / 360));

	// One cycle lasts 1/f seconds: "4.0 s", or "≈ 6.67 s" when it is not exact.
	const periodText = $derived.by(() => {
		const p = 1 / freq;
		const tenths = Math.round(p * 10);
		return Math.abs(p * 10 - tenths) < 1e-6 ? `${num(p, 1)} s` : `≈ ${num(p, 2)} s`;
	});
	// The latest whole cycle on the time graph, bracketed: one turn of the point.
	const cycle = $derived.by(() => {
		const k = Math.floor(tt * freq + 1e-9) - 1; // the last completed cycle
		const a = k / freq;
		if (k < 0 || a < tLo - 1e-9) return null;
		return { x0: st(a), x1: st(a + 1 / freq) };
	});

	// Vertical extent of the graph (grows with the amplitude in the time phase).
	const ext = $derived(Math.max(1, wAngle + w.time * Math.max(1, amp.current)));
	const bottomY = $derived(CY + U * ext + 22);
	const topY = $derived(CY - U * ext - 8);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="wave-clip">
			<rect x={GX0 - 1} y="0" width={GX1 - GX0 + 2} height="600" />
		</clipPath>
	</defs>

	<!-- ================= the graph frame ================= -->
	<!-- angle ticks and grid -->
	{#if wAngle > 0.01}
		<g opacity={wAngle}>
			{#each ANGLE_TICKS as a (a)}
				{@const x = sx(a)}
				{#if x >= GX0 - 0.5 && x <= GX1 + 0.5}
					{@const labelled = !wide || a % 180 === 0}
					{@const boundary = a % 360 === 0}
					<line
						x1={x}
						x2={x}
						y1={topY}
						y2={bottomY}
						stroke={boundary && w.periodic > 0.01 ? 'var(--stage-line)' : 'var(--stage-grid)'}
						stroke-dasharray={boundary && w.periodic > 0.01 ? '4 5' : undefined}
						opacity={boundary && w.periodic > 0.01 ? 0.4 + 0.6 * w.periodic : 1}
					/>
					<line x1={x} x2={x} y1={bottomY} y2={bottomY + 5} stroke="var(--stage-line)" />
					{#if labelled}
						{@render txt(x, bottomY + 19, `${a}°`.replace('-', '−'), 12, {
							anchor: 'middle',
							muted: true
						})}
						{@render txt(x, bottomY + 35, radText(a), 12, {
							anchor: 'middle',
							muted: true
						})}
					{/if}
				{/if}
			{/each}
			{@render txt(GX1, bottomY + 56, 'angle θ  (degrees, radians) →', 12, {
				anchor: 'end',
				muted: true
			})}
		</g>
	{/if}

	<!-- time ticks and grid -->
	{#if w.time > 0.01}
		<g opacity={w.time}>
			{#each timeTicks as s (s)}
				{@const x = st(s)}
				<line x1={x} x2={x} y1={topY} y2={bottomY} stroke="var(--stage-grid)" />
				<line x1={x} x2={x} y1={bottomY} y2={bottomY + 5} stroke="var(--stage-line)" />
				{@render txt(x, bottomY + 19, `${s} s`, 12, { anchor: 'middle', muted: true })}
			{/each}
			{@render txt(GX1, bottomY + 40, 'time t  (seconds) →', 12, { anchor: 'end', muted: true })}
		</g>
	{/if}

	<!-- value grid, axes -->
	{#each [-1, 1] as v (v)}
		<line x1={GX0} x2={GX1} y1={yOf(v)} y2={yOf(v)} stroke="var(--stage-grid)" />
	{/each}
	<line x1={GX0} x2={GX1} y1={CY} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={GX0} x2={GX1} y1={bottomY} y2={bottomY} stroke="var(--stage-line)" />
	<line x1={GX0} x2={GX0} y1={topY} y2={bottomY} stroke="var(--stage-line)" />

	<!-- ±A in the time phase -->
	{#if w.time > 0.01}
		<g opacity={w.time}>
			{#each [-1, 1] as s (s)}
				<line
					x1={GX0}
					x2={GX1}
					y1={yOf(s * amp.current)}
					y2={yOf(s * amp.current)}
					stroke="var(--trig-sin)"
					stroke-dasharray="3 5"
					opacity="0.55"
				/>
				{@render txt(GX1 + 12, yOf(s * amp.current) + 4, s > 0 ? 'A' : '−A', 12, {
					color: 'var(--trig-sin)',
					weight: 600
				})}
			{/each}
			<!-- one cycle = one turn of the point = 1/f seconds -->
			{#if cycle}
				{@const y = yOf(Math.max(1, amp.current)) - 22}
				{@const cxl = Math.min(GX1 - 80, Math.max(GX0 + 80, (cycle.x0 + cycle.x1) / 2))}
				<path
					d="M{cycle.x0} {y + 7} L{cycle.x0} {y} L{cycle.x1} {y} L{cycle.x1} {y + 7}"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				{@render txt(
					cxl,
					y - 7,
					`one cycle: 1/f ${periodText.startsWith('≈') ? periodText : `= ${periodText}`}`,
					13,
					{ anchor: 'middle', weight: 600 }
				)}
			{/if}
		</g>
	{/if}

	<!-- ================= the circle ================= -->
	<line
		x1={Math.max(16, CX - rCircle - 18)}
		x2={Math.min(CX + rCircle + 18, GX0 - 18)}
		y1={CY}
		y2={CY}
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<line
		x1={CX}
		x2={CX}
		y1={CY - rCircle - 18}
		y2={CY + rCircle + 18}
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#if w.time > 0.01 && Math.abs(amp.current - 1) > 0.02}
		<!-- the unit circle, for comparison -->
		<circle
			cx={CX}
			cy={CY}
			r={U}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 5"
			opacity={0.6 * w.time}
		/>
	{/if}
	<circle
		cx={CX}
		cy={CY}
		r={rCircle}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
		opacity="0.7"
	/>
	{#if w.time > 0.01}
		{@render txt(CX, CY + U * Math.max(1, amp.current) + 40, `radius A = ${num(amp.current)}`, 13, {
			anchor: 'middle',
			muted: true,
			opacity: w.time
		})}
	{/if}

	<!-- the angle, as a spiral that keeps count of the turns -->
	{#if spiral && wAngle > 0.01}
		<path
			d={spiral}
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
			opacity={wAngle}
		/>
	{/if}

	<!-- the drop to the x-axis and the coloured coordinates -->
	<line
		x1={P.x}
		x2={P.x}
		y1={P.y}
		y2={CY}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
		opacity={wCos}
	/>
	<line
		x1={CX}
		x2={P.x}
		y1={CY}
		y2={CY}
		stroke="var(--trig-cos)"
		stroke-width="5"
		stroke-linecap="round"
		opacity={wCos}
	/>
	<line
		x1={P.x}
		x2={P.x}
		y1={CY}
		y2={P.y}
		stroke="var(--trig-sin)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<line
		x1={CX}
		y1={CY}
		x2={P.x}
		y2={P.y}
		stroke="var(--stage-ink)"
		stroke-width="2.2"
		stroke-linecap="round"
	/>
	<circle cx={CX} cy={CY} r="3" fill="var(--stage-ink)" />

	<!-- ================= the waves ================= -->
	<!-- the link: same height on the circle and on the wave -->
	{#if markerVisible}
		<line
			x1={P.x}
			x2={marker.x}
			y1={P.y}
			y2={marker.y}
			stroke="var(--trig-sin)"
			stroke-dasharray="4 5"
			stroke-width="1.3"
			opacity="0.7"
		/>
	{/if}

	<!-- value labels, drawn over the link line so it never hides them -->
	{#each [-1, 1] as v (v)}
		{@render txt(GX0 - 12, yOf(v) + 4, v > 0 ? '1' : '−1', 12, { anchor: 'end', muted: true })}
	{/each}
	{@render txt(GX0 - 12, CY + 4, '0', 12, { anchor: 'end', muted: true })}

	<g clip-path="url(#wave-clip)">
		{#if wAngle > 0.01}
			<g opacity={wAngle}>
				{#if cosGhost}
					<path
						d={cosGhost}
						fill="none"
						stroke="var(--trig-cos)"
						stroke-width="2"
						opacity={ghost * Math.min(1, wCos / 0.6)}
					/>
					<path
						d={cosTrace}
						fill="none"
						stroke="var(--trig-cos)"
						stroke-width="3"
						stroke-linejoin="round"
						opacity={wCos}
					/>
				{/if}
				<path d={sinGhost} fill="none" stroke="var(--trig-sin)" stroke-width="2" opacity={ghost} />
				<path
					d={sinTrace}
					fill="none"
					stroke="var(--trig-sin)"
					stroke-width="3"
					stroke-linejoin="round"
				/>
			</g>
		{/if}
		{#if w.time > 0.01}
			<path
				d={timePath}
				fill="none"
				stroke="var(--trig-sin)"
				stroke-width="3"
				stroke-linejoin="round"
				opacity={w.time}
			/>
		{/if}
	</g>

	<!-- the value bars and markers on the wave -->
	{#if markerVisible}
		{#if wCos > 0.01 && !isTime}
			<line
				x1={marker.x}
				x2={marker.x}
				y1={CY}
				y2={yOf(cos)}
				stroke="var(--trig-cos)"
				stroke-width="3"
				stroke-linecap="round"
				opacity={0.6 * wCos}
			/>
			<circle
				cx={marker.x}
				cy={yOf(cos)}
				r="6"
				fill="var(--trig-cos)"
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={wCos}
			/>
		{/if}
		<line
			x1={marker.x}
			x2={marker.x}
			y1={CY}
			y2={marker.y}
			stroke="var(--trig-sin)"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.6"
		/>
		<circle
			cx={marker.x}
			cy={marker.y}
			r="6"
			fill="var(--trig-sin)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/if}

	<!-- cosine: the same wave slid 90° to the left -->
	{#if w.cosine > 0.01}
		{@const y = yOf(1) - 18}
		<g opacity={w.cosine}>
			<line
				x1={sx(90)}
				x2={sx(90)}
				y1={yOf(1) - 6}
				y2={y - 6}
				stroke="var(--trig-sin)"
				stroke-width="1.2"
			/>
			<line
				x1={sx(0)}
				x2={sx(0)}
				y1={yOf(1) - 6}
				y2={y - 6}
				stroke="var(--trig-cos)"
				stroke-width="1.2"
			/>
			<line
				x1={sx(90) - 3}
				x2={sx(0) + 5}
				y1={y}
				y2={y}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
			/>
			{@render txt(sx(90) + 8, y + 4, '90° = π/2 to the left', 12, { weight: 600 })}
		</g>
	{/if}

	<!-- periodic: one period bracketed -->
	{#if w.periodic > 0.01}
		{@const y = yOf(1) - 20}
		<g opacity={w.periodic}>
			<path
				d="M{sx(0)} {y + 7} L{sx(0)} {y} L{sx(360)} {y} L{sx(360)} {y + 7}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			{@render txt((sx(0) + sx(360)) / 2, y - 7, 'one period: 360° = 2π', 13, {
				anchor: 'middle',
				weight: 600
			})}
		</g>
	{/if}

	<!-- the point -->
	{#if isTime}
		<circle
			cx={P.x}
			cy={P.y}
			r="9"
			fill="var(--explainer-accent)"
			stroke="var(--stage-bg)"
			stroke-width="2.5"
		/>
	{:else}
		<Handle
			x={P.x}
			y={P.y}
			label="Point on the circle"
			value={thetaR}
			min={range.lo}
			max={range.hi}
			valuetext="{degText(thetaR)}, {radSpoken(thetaR)}"
			{onmove}
			{onkey}
			{ondragstart}
		/>
	{/if}

	<!-- ================= readouts ================= -->
	{#if wAngle > 0.01}
		<g opacity={wAngle}>
			{@render txt(32, 58, `θ = ${degText(thetaR)} (${radLabel(thetaR)})`, 22, { weight: 600 })}
			{@render txt(352, 58, `sin θ = ${trigText(thetaR, 'sin')}`, 18, {
				weight: 600,
				color: 'var(--trig-sin)'
			})}
			{#if wCos > 0.01}
				{@render txt(604, 58, `cos θ = ${trigText(thetaR, 'cos')}`, 18, {
					weight: 600,
					color: 'var(--trig-cos)',
					opacity: Math.min(1, wCos / 0.6)
				})}
			{/if}
			{#if w.sine > 0.01}
				{@render txt(32, 86, 'the height of the point, plotted against the angle', 13, {
					muted: true,
					opacity: w.sine
				})}
			{/if}
			{#if w.cosine > 0.01}
				{@render txt(
					32,
					86,
					'cos θ: the sideways position. Same shape, slid left: cos θ = sin(θ + 90°)',
					13,
					{ muted: true, opacity: w.cosine }
				)}
			{/if}
			{#if w.periodic > 0.01}
				{@render txt(
					32,
					86,
					thetaR >= 0 && thetaR <= 360
						? 'past 360° the point goes round again, and the waves repeat'
						: thetaR > 360
							? `${turns} full turn${turns > 1 ? 's' : ''} on: the same point as ${sameAs}°, so sin ${thetaR}° = sin ${sameAs}° and cos ${thetaR}° = cos ${sameAs}°`
							: `clockwise: the same point as ${sameAs}°, so sin(${num(thetaR, 0)}°) = sin ${sameAs}° and cos(${num(thetaR, 0)}°) = cos ${sameAs}°`,
					13,
					{ muted: true, opacity: w.periodic }
				)}
			{/if}
		</g>
	{/if}

	{#if w.time > 0.01}
		<g opacity={w.time}>
			{@render txt(32, 58, 'height = A · sin(2π f t)', 22, { weight: 600 })}
			{@render txt(400, 58, `amplitude A = ${num(ampParam)}`, 16, {
				weight: 600,
				color: 'var(--trig-sin)'
			})}
			{@render txt(400, 84, `frequency f = ${num(freq)} Hz → one cycle every ${periodText}`, 16, {
				weight: 600
			})}
			{@render txt(32, 86, `t = ${num(tt, 1)} s`, 14, { muted: true })}
		</g>
	{/if}
</g>
