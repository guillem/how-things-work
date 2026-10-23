<script lang="ts">
	/**
	 * A beach from the side: land on the left, sea on the right, the air above drawn as drifting
	 * specks. The Sun (or the Moon, at night) rides across the sky at the time of day, and the
	 * reader drags it to change the time. Thermometers in the ground and the water show the air over
	 * the land and over the sea; the specks go round the loop of the breeze at the model's speed (in
	 * from the sea along the ground, up over the warmer side, back out high up), and a flag on the
	 * beach stands out with the breeze or hangs limp. Bold arrows show the loop on the wind steps,
	 * and only its rising and sinking legs on the rise step.
	 */
	import { Label, clamp, hash, smoothstep, startDrag } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { airDensity, at, kmh, sunHeight } from '../model';
	import { clock } from '../steps';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'beach'));
	/** The control this step's Sun drives, if any. */
	const control = $derived(
		phase === 'sun'
			? 'morning'
			: phase === 'night'
				? 'night'
				: phase === 'rise' || phase === 'breeze'
					? 'hour'
					: null
	);
	const DEFAULTS: Record<string, number> = { morning: 6, night: 3, hour: 15 };
	const hour = $derived(control ? Number(params[control] ?? DEFAULTS[control]) : 15);
	const m = $derived(at(hour));

	// ---- the layout ----------------------------------------------------------------------------
	const GROUND = 440;
	const SHORE = 500;
	const POLE_X = 452;
	const POLE_TOP = 318;

	// ---- the Sun and the Moon --------------------------------------------------------------------
	const X0 = 60;
	const X1 = 900;
	const sunX = (h: number) => X0 + (h / 24) * (X1 - X0);
	const sunY = (h: number) => GROUND - 20 - (sunHeight(h) / 73) * 310;
	const height = $derived(sunHeight(hour));
	const daylight = $derived(smoothstep(-8, 6, height));
	const up = $derived(height > -1);
	const bodyX = $derived(sunX(hour));
	const bodyY = $derived(up ? sunY(hour) : 140);
	const arc = Array.from({ length: 97 }, (_, i) => i / 4)
		.filter((h) => sunHeight(h) > 0)
		.map((h, i) => `${i === 0 ? 'M' : 'L'}${sunX(h).toFixed(1)} ${sunY(h).toFixed(1)}`)
		.join(' ');
	const stars = Array.from({ length: 26 }, (_, i) => ({
		i,
		x: 30 + hash(i, 1) * 900,
		y: 20 + hash(i, 2) * 250,
		r: 1 + hash(i, 3) * 1.4
	}));

	function setHour(h: number) {
		if (!control) return;
		setParam(control, clamp(Math.round(h * 4) / 4, 0, 24));
	}
	function drag(e: PointerEvent) {
		startDrag(e, (p) => setHour(((p.x - X0) / (X1 - X0)) * 24));
	}
	function key(e: KeyboardEvent) {
		const big = e.shiftKey ? 2 : 0.25;
		const d: Record<string, number> = {
			ArrowRight: big,
			ArrowUp: big,
			ArrowLeft: -big,
			ArrowDown: -big,
			PageUp: 2,
			PageDown: -2
		};
		if (e.key === 'Home') setHour(0);
		else if (e.key === 'End') setHour(24);
		else if (d[e.key] !== undefined) setHour(hour + d[e.key]);
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	// ---- the air going round ---------------------------------------------------------------------
	const CX = 470;
	const CY = 284;
	const A = 400;
	const B = 128;
	/** Turns per second of the loop at the afternoon's full breeze. */
	const FULL = 6.5;
	const rate = $derived(((m.breeze / FULL) * Math.PI * 2) / 16);
	const specks = Array.from({ length: 64 }, (_, i) => ({
		i,
		s: 0.3 + 0.7 * Math.sqrt(hash(i, 11)),
		a0: hash(i, 12) * Math.PI * 2,
		w: 0.6 + hash(i, 13) * 1.2,
		o: hash(i, 14) * 9
	}));
	// The loop's angle is the integral of a rate the reader changes: a small frame-to-frame
	// accumulator (sanctioned in the scene guide), frozen when t does not advance.
	let spin = 0;
	let lastT = 0;
	const angle = $derived.by(() => {
		const dt = t - lastT;
		lastT = t;
		if (!reduced && dt > 0 && dt < 0.5) spin += rate * dt;
		return spin;
	});
	const air = $derived(
		specks.map((p) => {
			const th = p.a0 + angle;
			const jx = reduced ? 0 : Math.sin(t * p.w + p.o) * 5;
			const jy = reduced ? 0 : Math.cos(t * p.w * 0.8 + p.o) * 4;
			return {
				i: p.i,
				x: CX + A * p.s * Math.cos(th) + jx,
				y: CY + B * p.s * Math.sin(th) + jy
			};
		})
	);

	// ---- the breeze ------------------------------------------------------------------------------
	const speed = $derived(kmh(m.breeze));
	const strength = $derived(clamp(Math.abs(m.breeze) / 5));
	const onshore = $derived(m.breeze > 0.3);
	const offshore = $derived(m.breeze < -0.3);
	const still = $derived(!onshore && !offshore);
	const windColor = $derived(onshore ? 'var(--sbz-onshore)' : 'var(--sbz-offshore)');
	const showLoop = $derived(
		phase === 'breeze' || phase === 'night' || phase === 'beach' || phase === 'next'
	);
	const showRise = $derived(phase === 'rise');
	const loopOpacity = $derived(still ? 0 : 0.45 + 0.55 * strength);
	/** The rise step's legs: drawn while the warmer side's air is going up. */
	const riseOpacity = $derived(
		(m.land - m.sea) * m.breeze > 0 ? clamp(Math.abs(m.land - m.sea) / 3) * 0.9 : 0
	);
	/** On the rise step: the land's leg is warm (red) while it rises, cool (blue) while it sinks. */
	const riseColor = (k: number) =>
		(k === 0) === m.breeze > 0 ? 'var(--sbz-hot)' : 'var(--sbz-cool)';
	const surf = $derived(
		`M${SHORE} ${GROUND + 6} ` +
			Array.from({ length: 24 }, (_, k) => {
				const x = SHORE + k * 20 + 10;
				const y = GROUND + 6 + Math.sin(k * 1.3 + (reduced ? 0 : t * 1.5)) * 2.5;
				return `L${x} ${y.toFixed(1)}`;
			}).join(' ') +
			` L960 ${GROUND + 6}`
	);

	/** A bold arrow from (x1, y1) to (x2, y2). */
	function arrow(x1: number, y1: number, x2: number, y2: number) {
		const ang = Math.atan2(y2 - y1, x2 - x1);
		const hx = x2 - Math.cos(ang) * 20;
		const hy = y2 - Math.sin(ang) * 20;
		const nx = -Math.sin(ang) * 12;
		const ny = Math.cos(ang) * 12;
		return {
			line: `M${x1} ${y1} L${hx.toFixed(1)} ${hy.toFixed(1)}`,
			head: `M${x2} ${y2} L${(hx + nx).toFixed(1)} ${(hy + ny).toFixed(1)} L${(hx - nx).toFixed(1)} ${(hy - ny).toFixed(1)} Z`
		};
	}
	/** The loop's four legs, in the breeze's direction: along the ground, up, along the top, down. */
	const legs = $derived.by(() => {
		const d = m.breeze >= 0 ? 1 : -1;
		const low = CY + B * 0.78;
		const high = CY - B * 0.78;
		const left = CX - A * 0.86;
		const right = CX + A * 0.86;
		const bottom =
			d > 0 ? arrow(right - 60, low, left + 70, low) : arrow(left + 70, low, right - 60, low);
		const top =
			d > 0 ? arrow(left + 70, high, right - 60, high) : arrow(right - 60, high, left + 70, high);
		const landLeg =
			d > 0 ? arrow(left, low - 30, left, high + 30) : arrow(left, high + 30, left, low - 30);
		const seaLeg =
			d > 0 ? arrow(right, high + 30, right, low - 30) : arrow(right, low - 30, right, high + 30);
		return { bottom, top, landLeg, seaLeg };
	});

	// ---- the flag ----------------------------------------------------------------------------------
	const flag = $derived.by(() => {
		const dir = m.breeze >= 0 ? -1 : 1;
		const lift = strength * 82;
		const rot = dir * (90 - lift);
		const amp = reduced ? 2 : 2 + 5 * strength;
		const L = 76;
		const Hf = 40;
		const pts: string[] = [];
		const n = 8;
		for (let k = 0; k <= n; k++) {
			const x = (k / n) * L;
			const y = Math.sin(k * 0.9 - t * (3 + 6 * strength)) * amp * (k / n);
			pts.push(`${(dir * x).toFixed(1)} ${y.toFixed(1)}`);
		}
		for (let k = n; k >= 0; k--) {
			const x = (k / n) * L;
			const y = Hf + Math.sin(k * 0.9 - t * (3 + 6 * strength) - 0.4) * amp * (k / n);
			pts.push(`${(dir * x).toFixed(1)} ${y.toFixed(1)}`);
		}
		return { d: `M${pts.join(' L')} Z`, rot };
	});

	// ---- warmth of the ground ------------------------------------------------------------------
	const diff = $derived(m.land - m.sea);
	const warmth = $derived(clamp(diff / 9) * 0.75);
	const chill = $derived(clamp(-diff / 5) * 0.6);
	const lighter = $derived(Math.round(((airDensity(m.sea) - airDensity(m.land)) * 1000) / 5) * 5);

	// ---- the readouts ----------------------------------------------------------------------------
	const when = $derived(clock(hour));
	const headline = $derived.by(() => {
		if (phase === 'sun') return `${when}: the land ${diff >= 0 ? 'warmer' : 'cooler'} than the sea`;
		if (phase === 'rise')
			return diff > 0.5
				? `${when}: the air over the land is pushed up`
				: diff < -0.5
					? `${when}: the air over the sea is pushed up`
					: `${when}: land and sea alike, no push`;
		if (still) return `${when}: no breeze`;
		return `${when}: ${onshore ? 'a sea breeze' : 'a land breeze'}, ${speed} km/h`;
	});
	const sub = $derived.by(() => {
		if (phase === 'sun') return 'the same sunshine falls on both';
		if (phase === 'rise') return 'heavier, cooler air pushes the lighter, warmer air up';
		if (phase === 'next') return 'uneven heating is enough to make a wind';
		if (still) return 'land and sea about as warm as each other';
		return onshore ? 'air slides in from over the sea' : 'air slides out from over the land';
	});
	const landLine2 = $derived(
		phase === 'rise' && Math.abs(lighter) >= 5
			? lighter > 0
				? `a cubic metre: ${lighter} g lighter`
				: `a cubic metre: ${-lighter} g heavier`
			: ''
	);
	/** Rough width of the headline card's text (bold 19 px and 15 px stage font). */
	const cardW = $derived(Math.max(headline.length * 9.9, sub.length * 7.3));
	const focusTemps = $derived(phase === 'sun' || phase === 'rise' || phase === 'night');
</script>

<g class="sbz-coast">
	<defs>
		<linearGradient id="sea-breeze-day" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sky-day-top)" />
			<stop offset="1" stop-color="var(--sbz-sky-day-low)" />
		</linearGradient>
		<linearGradient id="sea-breeze-night" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sky-night-top)" />
			<stop offset="1" stop-color="var(--sbz-sky-night-low)" />
		</linearGradient>
		<linearGradient id="sea-breeze-heat" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-hot)" stop-opacity="1" />
			<stop offset="0.6" stop-color="var(--sbz-hot)" stop-opacity="0" />
		</linearGradient>
		<linearGradient id="sea-breeze-chill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-cool)" stop-opacity="1" />
			<stop offset="0.6" stop-color="var(--sbz-cool)" stop-opacity="0" />
		</linearGradient>
		<linearGradient id="sea-breeze-water" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sea)" />
			<stop offset="1" stop-color="var(--sbz-sea-deep)" />
		</linearGradient>
	</defs>

	<!-- the sky, by day and by night -->
	<rect x="0" y="0" width="960" height={GROUND} fill="url(#sea-breeze-night)" />
	<rect x="0" y="0" width="960" height={GROUND} fill="url(#sea-breeze-day)" opacity={daylight} />
	{#each stars as s (s.i)}
		<circle cx={s.x} cy={s.y} r={s.r} fill="var(--sbz-star)" opacity={(1 - daylight) * 0.8} />
	{/each}

	<!-- the Sun's path across the sky -->
	{#if control}
		<path
			d={arc}
			fill="none"
			stroke="var(--sbz-sun)"
			stroke-width="1.5"
			stroke-dasharray="3 6"
			opacity={0.35 + 0.4 * daylight}
		/>
	{/if}

	<!-- the land, the beach and the sea -->
	<path
		d="M0 {GROUND} L{SHORE - 90} {GROUND} Q{SHORE - 30} {GROUND + 4} {SHORE + 20} {GROUND +
			16} L{SHORE + 20} 600 L0 600 Z"
		fill="var(--sbz-soil)"
	/>
	<rect x="0" y={GROUND} width={SHORE - 90} height="10" fill="var(--sbz-grass)" />
	<path
		d="M{SHORE - 92} {GROUND} Q{SHORE - 30} {GROUND + 4} {SHORE + 20} {GROUND + 16} L{SHORE +
			20} {GROUND + 26} Q{SHORE - 40} {GROUND + 14} {SHORE - 92} {GROUND + 8} Z"
		fill="var(--sbz-sand)"
	/>
	<path
		d="M0 {GROUND} L{SHORE - 90} {GROUND} L{SHORE - 90} 600 L0 600 Z"
		fill="url(#sea-breeze-heat)"
		opacity={warmth}
	/>
	<path
		d="M0 {GROUND} L{SHORE - 90} {GROUND} L{SHORE - 90} 600 L0 600 Z"
		fill="url(#sea-breeze-chill)"
		opacity={chill}
	/>
	<rect
		x={SHORE}
		y={GROUND + 6}
		width={960 - SHORE}
		height={600 - GROUND - 6}
		fill="url(#sea-breeze-water)"
	/>
	<path d={surf} fill="none" stroke="var(--sbz-sky-day-low)" stroke-width="2" opacity="0.7" />

	<!-- the air: specks going round the breeze's loop -->
	<g opacity={phase === 'sun' ? 0.45 : 0.75}>
		{#each air as p (p.i)}
			<circle cx={p.x} cy={p.y} r="3.2" fill="var(--sbz-speck)" />
		{/each}
	</g>

	<!-- the loop of the breeze -->
	{#if showLoop || showRise}
		{@const legsOn = showLoop
			? [legs.bottom, legs.landLeg, legs.top, legs.seaLeg]
			: [legs.landLeg, legs.seaLeg]}
		<g opacity={showLoop ? loopOpacity : riseOpacity}>
			{#each legsOn as a, k (k)}
				<path
					d={a.line}
					fill="none"
					stroke={showRise ? riseColor(k) : windColor}
					stroke-width={k === 0 || showRise ? 9 : 6}
					stroke-linecap="round"
					opacity={k === 0 || showRise ? 1 : 0.6}
				/>
				<path
					d={a.head}
					fill={showRise ? riseColor(k) : windColor}
					opacity={k === 0 || showRise ? 1 : 0.6}
				/>
			{/each}
		</g>
	{/if}

	<!-- the Sun or the Moon -->
	<g opacity={control ? 1 : 0.95}>
		{#if up}
			<g transform="translate({bodyX} {bodyY})">
				{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
					{@const a = (i / 10) * Math.PI * 2 + (reduced ? 0 : t * 0.2)}
					<line
						x1={Math.cos(a) * 30}
						y1={Math.sin(a) * 30}
						x2={Math.cos(a) * 40}
						y2={Math.sin(a) * 40}
						stroke="var(--sbz-sun)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				{/each}
				<circle r="24" fill="var(--sbz-sun)" />
			</g>
		{:else}
			<g transform="translate({bodyX} {bodyY})">
				<circle r="20" fill="var(--sbz-moon)" />
				<circle cx="9" cy="-6" r="17" fill="var(--sbz-sky-night-top)" />
			</g>
		{/if}
	</g>
	{#if control}
		<circle
			class="sbz-drag"
			cx={bodyX}
			cy={bodyY}
			r="46"
			fill="transparent"
			stroke="var(--focus)"
			stroke-width="1.5"
			stroke-dasharray="5 5"
			role="slider"
			tabindex="0"
			aria-label={up ? 'The Sun' : 'The Moon'}
			aria-valuenow={hour}
			aria-valuemin={0}
			aria-valuemax={24}
			aria-valuetext={when}
			onpointerdown={drag}
			onkeydown={key}
		/>
		{#if phase === 'sun' && hour === 6}
			<Readout id="sbz-hint">
				<Label
					x={bodyX}
					y={bodyY - 58}
					text="drag the Sun across the sky"
					anchor="middle"
					size={15}
					weight={600}
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the flag on the beach -->
	<line
		x1={POLE_X}
		y1={GROUND + 4}
		x2={POLE_X}
		y2={POLE_TOP - 6}
		stroke="var(--sbz-pole)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<g transform="translate({POLE_X} {POLE_TOP}) rotate({flag.rot})">
		<path d={flag.d} fill="var(--sbz-flag)" stroke="var(--sbz-pole)" stroke-width="1" />
	</g>

	<!-- thermometers: the air over the land, the air over the sea -->
	{#each [{ id: 'land', x: 60, v: m.land, label: 'air over the land' }, { id: 'sea', x: 640, v: m.sea, label: 'air over the sea' }] as th (th.id)}
		{@const merc = 64 * clamp((th.v - 12) / 22, 0.05, 1)}
		<g opacity={focusTemps || phase === 'beach' ? 1 : 0.85}>
			<rect
				x={th.x - 8}
				y={GROUND + 40}
				width="16"
				height="76"
				rx="8"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
			<rect
				x={th.x - 4}
				y={GROUND + 108 - merc}
				width="8"
				height={merc + 4}
				fill="var(--sbz-hot)"
			/>
			<circle
				cx={th.x}
				cy={GROUND + 120}
				r="12"
				fill="var(--sbz-hot)"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
		</g>
		<Readout
			id="sbz-{th.id}"
			order={th.id === 'land' ? 2 : 3}
			label={th.id === 'land' ? 'Air over the land' : 'Air over the sea'}
			value="{Math.round(th.v)} °C"
		>
			<Label
				x={th.x + 24}
				y={GROUND + 78}
				text="{Math.round(th.v)} °C"
				anchor="start"
				size={30}
				weight={700}
				tabular
				halo={false}
				color="var(--sbz-ground-ink)"
			/>
			<Label
				x={th.x + 24}
				y={GROUND + 104}
				text={th.label}
				anchor="start"
				size={16}
				weight={600}
				halo={false}
				color="var(--sbz-ground-ink)"
			/>
		</Readout>
	{/each}
	{#if landLine2}
		<Readout
			id="sbz-lighter"
			order={4}
			label="A cubic metre of air over the land"
			value={landLine2.replace('a cubic metre: ', '')}
		>
			<Label
				x={84}
				y={GROUND + 130}
				text={landLine2}
				anchor="start"
				size={16}
				weight={600}
				halo={false}
				color="var(--sbz-ground-ink)"
			/>
		</Readout>
	{/if}

	<!-- headline, on a card so it reads over the day and the night sky -->
	<Readout id="sbz-card">
		<rect
			x={944 - cardW - 14}
			y="14"
			width={cardW + 28}
			height="64"
			rx="10"
			fill="var(--surface)"
			opacity="0.85"
		/>
	</Readout>
	<Readout id="sbz-head" order={1} label="Now" value={headline}>
		<Label x={944} y={40} text={headline} anchor="end" size={19} weight={700} />
	</Readout>
	<Readout id="sbz-sub" order={6}>
		<Label x={944} y={66} text={sub} anchor="end" size={15} muted />
	</Readout>
</g>

<style>
	.sbz-coast {
		--sbz-ground-ink: #fff;
	}
	.sbz-drag {
		cursor: ew-resize;
		touch-action: none;
		outline: none;
	}
	.sbz-drag:focus-visible {
		stroke-width: 3;
	}
</style>
