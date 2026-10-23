<script lang="ts">
	/**
	 * Near the Sun, seen from far above: the Sun, Earth's path for scale, and Halley's path round
	 * its closest point, drawn to scale (the comet's head and the Sun far bigger than life). The
	 * comet sits on its path at the chosen date and the reader drags it along. Its gas tail points
	 * along the solar wind as the comet meets it (almost straight away from the Sun); its dust tail
	 * is the model's grains, each released from the nucleus some days ago and pushed by sunlight,
	 * sliding out along the curve that grains of its size released earlier lie on now. On the
	 * grains step the view zooms in on the head.
	 */
	import { Handle, Label, clamp, cycle, hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import {
		BETAS,
		HALLEY,
		antiSun,
		dateOf,
		gasTailDirection,
		grainAt,
		heading,
		iceRate,
		nearestDay,
		stateAt,
		tailToHeading
	} from '../model';
	import { far } from '../steps';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const readouts = useReadouts();
	const phone = $derived(readouts?.out ?? false);

	const phase = $derived(String(step.hints?.phase ?? 'comet'));
	/** The control each dragging step's comet drives, and its default date. */
	const CONTROLS: Record<string, [string, number]> = {
		away: ['dayIn', -70],
		'tail-first': ['dayOut', 60],
		'two-tails': ['day', 30]
	};
	const control = $derived(CONTROLS[phase] as [string, number] | undefined);
	const dragging = $derived(control !== undefined);
	const day = $derived(
		control
			? clamp(Math.round(Number(params[control[0]] ?? control[1])), -120, 120)
			: Number(step.hints?.day ?? 30)
	);
	const zoomTarget = $derived(
		phase === 'grains'
			? clamp(Number(params.zoom ?? 6), 1, 12)
			: phase === 'comet' || phase === 'next'
				? 2.2
				: 1
	);
	const zoom = new Tween(1, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const z = zoomTarget;
		untrack(() => zoom.set(z, reduced ? { duration: 0 } : undefined));
	});

	const s = $derived(stateAt(day));

	// ---- the view: Sun-centred, or zoomed on the comet ------------------------------------------
	const S = 190; // px per au at zoom 1
	const SUN0 = { x: 480, y: 338 };
	const CENTRE = { x: 430, y: 300 };
	/** 0 at zoom 1, 1 once zoomed in: how much the view follows the comet. */
	const follow = $derived(smoothstep(1, 2, zoom.current));
	const k = $derived(S * zoom.current);
	const focus = $derived({ x: s.x * follow, y: s.y * follow });
	const origin = $derived({
		x: lerp(SUN0.x, CENTRE.x, follow),
		y: lerp(SUN0.y, CENTRE.y, follow)
	});
	// Model +x (towards the closest point) is up on the stage; model +y is to the right.
	const X = (p: { x: number; y: number }) => origin.x + (p.y - focus.y) * k;
	const Y = (p: { x: number; y: number }) => origin.y - (p.x - focus.x) * k;
	const sun = $derived({ x: X({ x: 0, y: 0 }), y: Y({ x: 0, y: 0 }) });
	const head = $derived({ x: X(s), y: Y(s) });

	const path = Array.from({ length: 181 }, (_, i) => stateAt(-180 + i * 2));
	const pathD = $derived(
		path.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ')
	);

	// ---- activity --------------------------------------------------------------------------------
	const peak = iceRate(HALLEY.q);
	const rate = $derived(iceRate(s.r) / peak);
	const active = $derived(clamp(Math.log10(Math.max(rate, 1e-9)) / 3 + 1));

	// ---- the gas tail ------------------------------------------------------------------------------
	const gasDir = $derived(gasTailDirection(s));
	/** Drawn length, au: longer while more gas comes off. */
	const gasLen = $derived(1.0 * Math.sqrt(clamp(rate)));
	const gasTip = $derived({
		x: X({ x: s.x + gasDir.x * gasLen, y: s.y + gasDir.y * gasLen }),
		y: Y({ x: s.x + gasDir.x * gasLen, y: s.y + gasDir.y * gasLen })
	});
	/** Sideways unit vector on the stage, for the tail's width. */
	const gasSide = $derived.by(() => {
		const dx = gasTip.x - head.x;
		const dy = gasTip.y - head.y;
		const l = Math.hypot(dx, dy) || 1;
		return { x: -dy / l, y: dx / l };
	});
	const gasShape = $derived.by(() => {
		const w = 4 + 11 * active;
		const L = gasSide;
		return `M${head.x + L.x * 2} ${head.y + L.y * 2} L${gasTip.x + L.x * w} ${gasTip.y + L.y * w} L${
			gasTip.x - L.x * w
		} ${gasTip.y - L.y * w} L${head.x - L.x * 2} ${head.y - L.y * 2} Z`;
	});
	const ions = Array.from({ length: 16 }, (_, i) => ({
		i,
		off: hash(i, 21),
		side: hash(i, 22) - 0.5
	}));
	const ionDots = $derived(
		ions.map((p) => {
			const u = cycle(t, 1.6, p.off);
			return {
				i: p.i,
				x: lerp(head.x, gasTip.x, u) + gasSide.x * p.side * 10 * u,
				y: lerp(head.y, gasTip.y, u) + gasSide.y * p.side * 10 * u,
				o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.7, 1, u))
			};
		})
	);

	// ---- the dust tail -----------------------------------------------------------------------------
	const MAX_AGE = 60;
	/** For each grain size: where grains released 0…40 days ago are now (au), and how much left then. */
	const syndynes = $derived(
		BETAS.map((beta) => ({
			beta,
			pts: Array.from({ length: MAX_AGE + 1 }, (_, age) => {
				const g = age === 0 ? s : grainAt(day - age, beta, day);
				return { x: g.x, y: g.y, w: clamp(iceRate(stateAt(day - age).r) / peak) };
			})
		}))
	);
	const syndyneD = $derived(
		syndynes.map((sd) => ({
			beta: sd.beta,
			d: sd.pts
				.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`)
				.join(' ')
		}))
	);
	/**
	 * The fan between the finest grains' curve and the biggest's, in three bands that fade with
	 * age (older dust is more spread out and fainter).
	 */
	const fan = $derived(
		[0, 20, 40].map((from) => {
			const to = from + 20;
			const fine = syndynes[BETAS.length - 1].pts.slice(from, to + 1);
			const big = syndynes[0].pts.slice(from, to + 1).reverse();
			return {
				from,
				d:
					[...fine, ...big]
						.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`)
						.join(' ') + ' Z',
				o: 0.3 * (1 - from / 60) * clamp(0.3 + syndynes[1].pts[from + 10].w)
			};
		})
	);
	const GRAINS = 26;
	const grainSeeds = BETAS.flatMap((beta, b) =>
		Array.from({ length: GRAINS }, (_, i) => ({
			key: b * 100 + i,
			b,
			beta,
			off: hash(i, 31 + b),
			jx: hash(i, 41 + b) - 0.5,
			jy: hash(i, 51 + b) - 0.5
		}))
	);
	// Each grain slides out along its size's curve as it ages: a grain released a moment ago is
	// at the head, one released 40 days ago at the curve's far end. (The curve itself is where
	// grains of that size released at different times are now; a grain's own path, seen from the
	// comet, runs close to it over the step's few seconds.)
	const grains = $derived(
		grainSeeds.map((g) => {
			const age = cycle(t, 12, g.off) * MAX_AGE;
			const pts = syndynes[g.b].pts;
			const i0 = Math.min(MAX_AGE - 1, Math.floor(age));
			const f = age - i0;
			const p = {
				x: lerp(pts[i0].x, pts[i0 + 1].x, f),
				y: lerp(pts[i0].y, pts[i0 + 1].y, f)
			};
			const w = lerp(pts[i0].w, pts[i0 + 1].w, f);
			const fade = smoothstep(0, 1.5, age) * (1 - smoothstep(MAX_AGE * 0.7, MAX_AGE, age));
			return {
				key: g.key,
				x: X(p) + g.jx * 3,
				y: Y(p) + g.jy * 3,
				r: 1.4 + (1 - g.beta) * 1.6,
				o: fade * clamp(0.25 + w) * smoothstep(0.05, 0.3, active)
			};
		})
	);
	/** Where the dust tail's label goes: near the end of the medium grains' curve. */
	const dustTip = $derived.by(() => {
		const p = syndynes[2].pts[Math.round(MAX_AGE * 0.6)];
		return { x: X(p), y: Y(p) };
	});

	// ---- the solar wind ----------------------------------------------------------------------------
	const showWind = $derived(phase === 'away' || phase === 'two-tails' || phase === 'grains');
	const windSeeds = Array.from({ length: 36 }, (_, i) => ({
		i,
		a: (i / 36) * Math.PI * 2 + hash(i, 61) * 0.15,
		off: hash(i, 62)
	}));
	const windDots = $derived(
		windSeeds.map((w) => {
			const u = cycle(t, 3, w.off);
			const d = 0.15 + u * 2.6;
			const x = sun.x + Math.cos(w.a) * d * k;
			const y = sun.y + Math.sin(w.a) * d * k;
			return { i: w.i, x, y, a: w.a, o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.7, 1, u)) };
		})
	);

	// ---- motion, and where the tail points relative to it ------------------------------------------
	const dir = $derived(heading(s));
	const arrowTip = $derived({ x: head.x + dir.y * 70, y: head.y - dir.x * 70 });
	const showArrow = $derived(phase === 'tail-first' || phase === 'away');
	const toHeading = $derived(tailToHeading(s));
	const coming = $derived(day < 0);
	const tailText = $derived(
		toHeading > 115
			? 'tail streaming out behind it'
			: toHeading < 65
				? 'tail in front: going tail-first'
				: 'tail sticking out sideways'
	);
	const motionText = $derived(
		Math.abs(day) < 2
			? 'swinging round the Sun'
			: coming
				? 'heading in towards the Sun'
				: 'heading away from the Sun'
	);
	const away = $derived(antiSun(s));
	const antiEnd = $derived({ x: sun.x + away.y * 600, y: sun.y - away.x * 600 });

	function move(p: { x: number; y: number }) {
		const wx = focus.x + (origin.y - p.y) / k;
		const wy = focus.y + (p.x - origin.x) / k;
		if (control) setParam(control[0], Math.round(nearestDay(wx, wy, -120, 120)));
	}
	function key(stepBy: number | 'start' | 'end') {
		if (!control) return;
		const id = control[0];
		if (stepBy === 'start') setParam(id, -120);
		else if (stepBy === 'end') setParam(id, 120);
		else setParam(id, clamp(day + stepBy, -120, 120));
	}

	const labelTails = $derived(phase === 'comet' || phase === 'two-tails' || phase === 'next');
	const showGrainsNote = $derived(phase === 'grains');
	/** A scale bar for the zoomed view: 10 million km. */
	const tenMillion = $derived((10e6 / 149.6e6) * k);
</script>

<g class="close">
	<defs>
		<clipPath id="ct-close-clip">
			<rect x="16" y="16" width="928" height="568" />
		</clipPath>
		<radialGradient id="ct-close-sun">
			<stop offset="0" stop-color="var(--ct-sun)" stop-opacity="0.8" />
			<stop offset="1" stop-color="var(--ct-sun)" stop-opacity="0" />
		</radialGradient>
		<radialGradient id="ct-close-coma">
			<stop offset="0" stop-color="var(--ct-coma)" stop-opacity="0.95" />
			<stop offset="0.5" stop-color="var(--ct-coma)" stop-opacity="0.35" />
			<stop offset="1" stop-color="var(--ct-coma)" stop-opacity="0" />
		</radialGradient>
		<linearGradient
			id="ct-close-gas"
			gradientUnits="userSpaceOnUse"
			x1={head.x}
			y1={head.y}
			x2={gasTip.x}
			y2={gasTip.y}
		>
			<stop offset="0" stop-color="var(--ct-gas)" stop-opacity="0.9" />
			<stop offset="1" stop-color="var(--ct-gas)" stop-opacity="0" />
		</linearGradient>
	</defs>

	<g clip-path="url(#ct-close-clip)">
		<!-- Earth's path, for scale -->
		<circle
			cx={sun.x}
			cy={sun.y}
			r={k}
			fill="none"
			stroke="var(--ct-planet)"
			stroke-width="1.2"
			stroke-dasharray="4 5"
		/>
		<path d={pathD} fill="none" stroke="var(--ct-orbit)" stroke-width="2" />

		{#if showWind}
			{#each windDots as w (w.i)}
				<line
					x1={w.x}
					y1={w.y}
					x2={w.x + Math.cos(w.a) * 10}
					y2={w.y + Math.sin(w.a) * 10}
					stroke="var(--ct-wind)"
					stroke-width="1.5"
					stroke-linecap="round"
					opacity={w.o * 0.8}
				/>
			{/each}
		{/if}

		{#if phase === 'away'}
			<line
				x1={sun.x}
				y1={sun.y}
				x2={antiEnd.x}
				y2={antiEnd.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="3 6"
			/>
		{/if}

		<!-- the dust tail: a faint fan between the grain sizes' curves, the curves, and the grains -->
		{#each fan as band (band.from)}
			<path
				d={band.d}
				fill="var(--ct-dust)"
				stroke="var(--ct-dust)"
				stroke-width="3"
				stroke-linejoin="round"
				opacity={band.o * smoothstep(0.05, 0.4, active)}
			/>
		{/each}
		{#each syndyneD as sd (sd.beta)}
			<path
				d={sd.d}
				fill="none"
				stroke="var(--ct-dust)"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={0.25 * smoothstep(0.05, 0.4, active)}
			/>
		{/each}
		{#each grains as g (g.key)}
			{#if g.o > 0.02}
				<circle cx={g.x} cy={g.y} r={g.r} fill="var(--ct-dust)" opacity={g.o} />
			{/if}
		{/each}
		<!-- the gas tail -->
		<path d={gasShape} fill="url(#ct-close-gas)" opacity={smoothstep(0.02, 0.3, active)} />
		{#each ionDots as p (p.i)}
			<circle cx={p.x} cy={p.y} r="1.8" fill="var(--ct-gas)" opacity={p.o * active} />
		{/each}
	</g>

	<circle cx={sun.x} cy={sun.y} r="46" fill="url(#ct-close-sun)" />
	<circle cx={sun.x} cy={sun.y} r="18" fill="var(--ct-sun)" />
	{#if sun.x > 40 && sun.x < 920 && sun.y > 40 && sun.y < 520}
		<Label x={sun.x} y={sun.y + 40} text="Sun" size={14} weight={700} />
	{/if}
	{#if follow < 0.5}
		<Readout id="ct-earth-path">
			<Label
				x={sun.x - k * 0.71 - 6}
				y={sun.y + k * 0.71 + 18}
				text="Earth’s path"
				anchor="end"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	{#if showWind && follow < 0.5}
		<Label
			x={sun.x + 120}
			y={sun.y + 120}
			text="solar wind"
			size={13}
			weight={700}
			color="var(--ct-wind-ink)"
		/>
	{/if}
	{#if showArrow}
		<line
			x1={head.x}
			y1={head.y}
			x2={arrowTip.x}
			y2={arrowTip.y}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
	{/if}

	<!-- the head -->
	<circle cx={head.x} cy={head.y} r={10 + 14 * active} fill="url(#ct-close-coma)" />
	{#if dragging}
		<Handle
			x={head.x}
			y={head.y}
			r={phone ? 24 : 7}
			color="var(--ct-head)"
			label="Halley’s comet"
			value={day}
			min={-120}
			max={120}
			valuetext="{dateOf(day)}, {far(s.r)} from the Sun"
			onmove={move}
			onkey={key}
		/>
	{:else}
		<circle cx={head.x} cy={head.y} r="5" fill="var(--ct-head)" />
	{/if}

	{#if labelTails}
		<Label
			x={gasTip.x + gasSide.x * 18}
			y={gasTip.y + gasSide.y * 18}
			text="gas tail"
			size={14}
			weight={700}
			color="var(--ct-gas-ink)"
		/>
		<Label
			x={dustTip.x - gasSide.x * 22}
			y={dustTip.y - gasSide.y * 22}
			text="dust tail"
			size={14}
			weight={700}
			color="var(--ct-dust-ink)"
		/>
	{/if}
	{#if phase === 'comet'}
		<Label x={head.x - 34} y={head.y + 8} text="head" anchor="end" size={14} weight={700} />
	{/if}

	{#if showGrainsNote}
		<g opacity={follow}>
			<line
				x1={40}
				y1={560}
				x2={40 + tenMillion}
				y2={560}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
			/>
			<line x1={40} y1={554} x2={40} y2={566} stroke="var(--stage-ink-muted)" stroke-width="2" />
			<line
				x1={40 + tenMillion}
				y1={554}
				x2={40 + tenMillion}
				y2={566}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
			/>
			<Label x={40} y={546} text="10 million km" anchor="start" size={12} muted />
		</g>
		<Readout id="ct-grain-key">
			<Label
				x={944}
				y={556}
				text="bigger dots: bigger grains, pushed less by sunlight"
				anchor="end"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<Readout id="ct-close-card">
		<rect
			x="20"
			y="20"
			width="350"
			height={showArrow ? 128 : 102}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity="0.92"
		/>
	</Readout>
	<Readout id="ct-close-date" order={1} label="Date" value={dateOf(day)}>
		<Label
			x={36}
			anchor="start"
			y={50}
			text={dateOf(day)}
			size={19}
			weight={700}
			tabular
			halo={false}
		/>
	</Readout>
	<Readout id="ct-close-far" order={2} label="From the Sun" value={far(s.r)}>
		<Label x={36} anchor="start" y={76} text="{far(s.r)} from the Sun" size={14} halo={false} />
	</Readout>
	<Readout id="ct-close-motion" order={3} label="The comet" value={motionText}>
		<Label x={36} anchor="start" y={100} text={motionText} size={14} halo={false} />
	</Readout>
	{#if showArrow}
		<Readout id="ct-close-tail" order={4} label="Its tail" value={tailText}>
			<Label
				x={36}
				anchor="start"
				y={128}
				text={tailText}
				size={14}
				weight={700}
				color="var(--ct-gas-ink)"
				halo={false}
			/>
		</Readout>
	{/if}
	<Readout id="ct-close-note">
		<Label
			x={944}
			y={580}
			text="seen from far above; the Sun and the comet’s head drawn far bigger than life"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
