<script lang="ts">
	/**
	 * Cruise control. Top: the car on the road seen from the side (the camera follows
	 * it; heights exaggerated), posts every 100 m. Middle: the readout card. Below:
	 * speed against time with the target dashed, and the throttle with its integral
	 * part.
	 *
	 * Modes (`step.hints.mode`, road and start speed in the hints):
	 *   compare  a fixed throttle (faint car and trace) against Åström & Murray's PI
	 *            cruise control; the loop drawn in the sky
	 *   p        P only at `params.carKp`; `focus: 'offset'` marks where it settles
	 *   pi       PI at carKp, carKi; `focus: 'windup'` adds the anti-windup toggle
	 *   zn       P only at `params.znKp` (the Ziegler–Nichols test, zoomed in), or the
	 *            rule's PID with `params.useZn`, the target raised by half a km/h
	 *
	 * Runs (`drive`, 90 s) are precomputed per setting and replayed in real time; a
	 * change restarts them; the 90 s drives play three times faster than real time. After
	 * the end the last frame holds for 3 s and it starts over. Reduced motion: the
	 * complete run.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		KMH,
		at,
		carUltimate,
		drive,
		grade,
		pSettles,
		swings,
		throttleToHold,
		zieglerNichols,
		type Gains,
		type Road
	} from '../control';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import { heightAt, restartClock, seriesPath, type Cell } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'p'));
	const road = $derived(String(step.hints?.road ?? 'flat') as Road);
	const v0kmh = $derived(Number(step.hints?.v0 ?? 90));
	const focus = $derived(String(step.hints?.focus ?? ''));

	/** Page units (% throttle per km/h…) → model units (throttle per m/s…). */
	const toModel = (v: number) => (v / 100) * 3.6;
	const toPage = (v: number) => (v * 100) / 3.6;
	const AM: Gains = { kp: 0.5, ki: 0.1, kd: 0 }; // Feedback Systems §4.1

	const kp = $derived(Number(params.carKp ?? 10));
	const ki = $derived(Number(params.carKi ?? 2));
	const aw = $derived(Boolean(params.antiWindup));
	const zkp = $derived(Number(params.znKp ?? 60));
	const zn = $derived(mode === 'zn' && Boolean(params.useZn));
	const ult = carUltimate();
	const znGains = zieglerNichols(ult.ku, ult.tu);

	const SECONDS = $derived(mode === 'zn' ? 30 : 90);
	const gains = $derived<Gains>(
		mode === 'compare'
			? AM
			: mode === 'zn'
				? zn
					? znGains
					: { kp: toModel(zkp), ki: 0, kd: 0 }
				: { kp: toModel(kp), ki: mode === 'pi' ? toModel(ki) : 0, kd: 0 }
	);
	// the Ziegler–Nichols test starts a little above where P settles, so it swings about it
	const settleP = $derived(mode === 'zn' && !zn ? pSettles(gains.kp, 25) : NaN);
	const run = $derived(
		drive({
			road,
			gains,
			antiWindup: mode === 'pi' && aw,
			v0: mode === 'zn' ? (zn ? 25 : settleP + 0.3 * KMH) : v0kmh * KMH,
			target: zn ? 25 + 0.5 * KMH : 25,
			seconds: SECONDS
		})
	);
	const ghost = $derived(
		mode === 'compare'
			? drive({ road, gains: AM, fixed: throttleToHold(25), v0: v0kmh * KMH, seconds: SECONDS })
			: null
	);

	// ---- clock --------------------------------------------------------------------------------
	const clock = restartClock();
	const since = $derived(clock(`${mode}|${road}|${JSON.stringify(gains)}|${aw}|${v0kmh}`, t));
	// the 90 s drives play 3× faster than real time
	const FAST = $derived(mode === 'zn' ? 1 : 3);
	const tau = $derived(reduced ? SECONDS : (since * FAST) % (SECONDS + 3 * FAST));
	const now = $derived(Math.min(SECONDS, tau));
	const v = $derived(at(run, run.y, now) / KMH);
	const x = $derived(at(run, run.x[0], now));
	const u = $derived(at(run, run.u, now));
	const iPart = $derived(at(run, run.i, now));
	const gx = $derived(ghost ? at(ghost, ghost.x[0], now) : 0);
	const gv = $derived(ghost ? at(ghost, ghost.y, now) / KMH : 0);
	const target = $derived(at(run, run.r, now) / KMH);

	// ---- the road -------------------------------------------------------------------------------
	const R = { x0: 16, x1: 944, top: 16, bottom: 188 };
	const CAR_X = 300;
	const CAR_Y = 140;
	const HX = 0.6; // px per m along the road
	const HY = $derived(road === 'climb' ? 1.2 : 6); // px per m up (exaggerated)
	const sxRoad = (d: number) => CAR_X + (d - x) * HX;
	const syRoad = (h: number, h0: number) => CAR_Y - (h - h0) * HY;
	const h0 = $derived(heightAt(road, x));
	const roadPath = $derived.by(() => {
		let d = '';
		const a = x - (CAR_X - R.x0) / HX;
		const b = x + (R.x1 - CAR_X) / HX;
		for (let s = a, k = 0; s <= b + 10; s += 10, k++)
			d += `${k ? 'L' : 'M'}${sxRoad(s).toFixed(1)} ${syRoad(heightAt(road, s), h0).toFixed(1)}`;
		return d;
	});
	const groundPath = $derived(`${roadPath} L${R.x1 + 10} ${R.bottom} L${R.x0 - 10} ${R.bottom} Z`);
	const posts = $derived.by(() => {
		const a = Math.ceil((x - (CAR_X - R.x0) / HX) / 100) * 100;
		const out: { k: number; px: number; py: number }[] = [];
		for (let s = a; s <= x + (R.x1 - CAR_X) / HX; s += 100)
			out.push({ k: s, px: sxRoad(s), py: syRoad(heightAt(road, s), h0) });
		return out;
	});
	/** On-screen tilt (degrees) of the road at distance d. */
	const tilt = (d: number) => (-Math.atan((grade(road, d) * HY) / HX) * 180) / Math.PI;
	const gradeNow = $derived(grade(road, x));
	const gradeText = $derived(
		Math.abs(gradeNow) < 0.002
			? 'flat'
			: `${gradeNow > 0 ? 'uphill' : 'downhill'} ${Math.abs(gradeNow * 100).toFixed(1)}%`
	);

	// ---- plots ------------------------------------------------------------------------------------
	const P0 = 72;
	const P1 = 928;
	const SP = { top: 296, bottom: 436 };
	const TH = { top: 478, bottom: 560 };
	const yDomain = $derived<[number, number]>(
		mode === 'zn'
			? [88.5, 91.5]
			: mode === 'compare'
				? [78, 96]
				: focus === 'windup'
					? [75, 120]
					: focus === 'offset'
						? [78, 92]
						: [70, 100]
	);
	const sx = $derived(scale([0, SECONDS], [P0, P1]));
	const sy = $derived(scale(yDomain, [SP.bottom, SP.top]));
	const su = scale([0, 1], [TH.bottom, TH.top]);
	const yTicks = $derived(
		mode === 'zn'
			? [89, 90, 91]
			: mode === 'compare'
				? [80, 85, 90, 95]
				: focus === 'windup'
					? [80, 90, 100, 110, 120]
					: focus === 'offset'
						? [80, 85, 90]
						: [70, 80, 90, 100]
	);
	const xTicks = $derived(mode === 'zn' ? [0, 5, 10, 15, 20, 25, 30] : [0, 15, 30, 45, 60, 75, 90]);
	const kmhSeries = (r: typeof run) => r.y.map((s) => s / KMH);
	const speedPath = $derived(
		seriesPath(
			kmhSeries(run),
			run.sample,
			sx,
			sy,
			mode === 'zn' ? 1 : 3,
			yDomain[0] - 2,
			yDomain[1] + 2
		)
	);
	const ghostPath = $derived(
		ghost
			? seriesPath(kmhSeries(ghost), ghost.sample, sx, sy, 3, yDomain[0] - 2, yDomain[1] + 2)
			: ''
	);
	const throttlePath = $derived(seriesPath(run.u, run.sample, sx, su, mode === 'zn' ? 1 : 3));
	const showI = $derived(mode === 'pi' || zn);
	const iPath = $derived(showI ? seriesPath(run.i, run.sample, sx, su, 3, -0.05, 1.12) : '');
	const ghostThrottle = $derived(ghost ? throttleToHold(25) : 0);

	// ---- the step's own marks ------------------------------------------------------------------
	const settle = $derived(mode === 'p' ? pSettles(gains.kp, 25) / KMH : NaN);
	const need = $derived(mode === 'p' ? throttleToHold(settle * KMH) : NaN);
	// Ziegler–Nichols test: how the swing changes from one crest to the next (same side)
	const growth = $derived.by(() => {
		if (mode !== 'zn' || zn) return NaN;
		const ref = settleP;
		const s = swings(run, run.y, ref, 2, Math.max(2, now)).filter((c) => c.a > 0.002 * KMH);
		if (s.length < 3) return NaN;
		const last = s.slice(-3);
		return last[2].a / last[0].a;
	});
	const growthText = $derived(
		!Number.isFinite(growth)
			? '…'
			: growth > 1.03
				? `growing ×${growth.toFixed(2)} a swing`
				: growth < 0.97
					? `dying ×${growth.toFixed(2)} a swing`
					: 'holding steady'
	);
	const windupI = $derived(focus === 'windup' ? Math.max(...run.i) : 0);

	// ---- focus ------------------------------------------------------------------------------------
	const loopOn = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const on = mode === 'compare' ? 1 : 0;
		untrack(() => loopOn.set(on, { duration: reduced ? 0 : 800 }));
	});

	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const cells: Cell[] = $derived.by(() => {
		const out: Cell[] = [
			{
				id: 'speed',
				label: 'speed',
				value: `${v.toFixed(1)} km/h`,
				sub: gradeText,
				color: 'var(--fc-response)'
			},
			{
				id: 'target',
				label: 'target',
				value: `${target.toFixed(1)} km/h`,
				sub: 'set by the driver'
			},
			{
				id: 'throttle',
				label: 'throttle',
				value: pct(u),
				sub: u >= 0.999 ? 'full: at its limit' : u <= 0.001 ? 'shut' : 'of full',
				color: 'var(--fc-out)'
			}
		];
		if (mode === 'compare')
			out.push({
				id: 'ghost',
				label: 'fixed throttle',
				value: `${gv.toFixed(1)} km/h`,
				sub: `stuck at ${pct(ghostThrottle)}`,
				color: 'var(--fc-open)'
			});
		else if (mode === 'p')
			out.push({
				id: 'settle',
				label: 'settles at',
				value: `${settle.toFixed(1)} km/h`,
				sub: `on the flat: ${pct(need)} ÷ Kp`
			});
		else if (mode === 'pi')
			out.push({
				id: 'integral',
				label: 'integral part',
				value: pct(iPart),
				sub: focus === 'windup' ? `largest ${pct(windupI)}` : 'of the throttle',
				color: 'var(--fc-i)'
			});
		else
			out.push(
				zn
					? {
							id: 'zn',
							label: 'Ziegler–Nichols PID',
							value: `Kp ${Math.round(toPage(znGains.kp))}`,
							sub: `Ki ${Math.round(toPage(znGains.ki))} · Kd ${Math.round(toPage(znGains.kd))}`,
							color: 'var(--fc-response)'
						}
					: {
							id: 'swing',
							label: 'the swing',
							value: growthText,
							sub: `Ku ≈ ${Math.round(toPage(ult.ku))}, Tu ≈ ${ult.tu.toFixed(1)} s`
						}
			);
		return out;
	});
</script>

<g>
	<defs>
		<clipPath id="car-road">
			<rect x={R.x0} y={R.top} width={R.x1 - R.x0} height={R.bottom - R.top} rx="12" />
		</clipPath>
		<clipPath id="car-plots">
			<rect
				x={P0}
				y={SP.top - 6}
				width={Math.max(0, sx(now) - P0) + 1}
				height={TH.bottom - SP.top + 12}
			/>
		</clipPath>
	</defs>

	<!-- the road -->
	<rect
		x={R.x0}
		y={R.top}
		width={R.x1 - R.x0}
		height={R.bottom - R.top}
		rx="12"
		fill="var(--sky)"
		opacity="0.35"
	/>
	<g clip-path="url(#car-road)">
		<path d={groundPath} fill="var(--fc-ground)" />
		<path d={roadPath} fill="none" stroke="var(--fc-road)" stroke-width="3" />
		{#each posts as p (p.k)}
			<line
				x1={p.px}
				x2={p.px}
				y1={p.py}
				y2={p.py - 12}
				stroke="var(--fc-road)"
				stroke-width="1.5"
			/>
			{#if p.k % 500 === 0 && Math.abs(p.px - CAR_X) > 50 && !(ghost && Math.abs(p.px - sxRoad(gx)) < 50)}
				<Readout id="post-{p.k}">
					<Label x={p.px} y={p.py - 16} text="{p.k / 1000} km" size={11} anchor="middle" muted />
				</Readout>
			{/if}
		{/each}
		{#if ghost}
			{@const px = sxRoad(gx)}
			<g
				transform="translate({px} {syRoad(heightAt(road, gx), h0)}) rotate({tilt(gx)})"
				opacity="0.45"
			>
				{@render carShape('var(--fc-open)')}
			</g>
		{/if}
		<g transform="translate({CAR_X} {CAR_Y}) rotate({tilt(x)})">
			{@render carShape('var(--fc-car)')}
		</g>
	</g>
	{#if road !== 'flat'}
		<Readout id="exaggerated">
			<Label
				x={R.x1 - 12}
				y={R.bottom - 10}
				text="heights × {Math.round(HY / HX)}"
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
	{/if}

	<!-- the loop, in the sky (first step) -->
	{#if loopOn.current > 0.01}
		<g opacity={loopOn.current}>
			<Readout id="loop">
				{@render loop()}
			</Readout>
		</g>
	{/if}
	{#if ghost}
		<Readout id="ghost-label">
			<Label
				x={sxRoad(gx)}
				y={syRoad(heightAt(road, gx), h0) - 30}
				text="fixed throttle"
				size={11}
				anchor="middle"
				color="var(--fc-open)"
				weight={600}
			/>
		</Readout>
	{/if}

	<Card {cells} x={16} y={204} w={928} h={68} />

	<!-- speed against time -->
	<Plot
		{sx}
		{sy}
		{xTicks}
		{yTicks}
		xFormat={(s) => (s === SECONDS ? `${s} s` : String(s))}
		yFormat={(s: number) => String(s)}
	/>
	<Readout id="speed-title">
		<Label anchor="start" x={P0} y={SP.top - 10} text="speed, km/h" size={12} muted />
	</Readout>
	{#if FAST > 1}
		<Readout id="fast">
			<Label x={P1} y={SP.top - 10} text="time runs 3× faster" size={11} anchor="end" muted />
		</Readout>
	{/if}
	{#if !zn}
		<line
			x1={P0}
			x2={P1}
			y1={sy(90)}
			y2={sy(90)}
			stroke="var(--fc-target)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
	{/if}
	{#if zn}
		<line
			x1={P0}
			x2={P1}
			y1={sy(90.5)}
			y2={sy(90.5)}
			stroke="var(--fc-target)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
	{/if}
	<Readout id="target-label">
		<Label
			x={P1}
			y={sy(zn ? 90.5 : 90) - 6}
			text={zn ? 'new target 90.5' : 'target 90'}
			size={11}
			anchor="end"
			color="var(--fc-target)"
		/>
	</Readout>
	{#if mode === 'p' && settle > yDomain[0]}
		<line
			x1={P0}
			x2={P1}
			y1={sy(settle)}
			y2={sy(settle)}
			stroke="var(--fc-response)"
			stroke-dasharray="2 4"
			opacity="0.8"
		/>
		{#if focus === 'offset'}
			{@const bx = sx(45)}
			<line
				x1={bx}
				x2={bx}
				y1={sy(90) + 2}
				y2={sy(settle) - 2}
				stroke="var(--fc-limit)"
				stroke-width="2.5"
			/>
			<Readout
				id="offset-label"
				label="Error left"
				value="{(90 - settle).toFixed(1)} km/h, for good"
				color="var(--fc-limit)"
				order={10}
			>
				<Label
					anchor="start"
					x={bx + 8}
					y={sy(settle) + 18}
					text="error {(90 - settle).toFixed(1)} km/h, for good"
					size={12}
					weight={600}
					color="var(--fc-limit)"
				/>
			</Readout>
		{/if}
	{/if}
	<g clip-path="url(#car-plots)">
		{#if ghost}
			<path d={ghostPath} fill="none" stroke="var(--fc-open)" stroke-width="2" />
			<line
				x1={P0}
				x2={P1}
				y1={su(ghostThrottle)}
				y2={su(ghostThrottle)}
				stroke="var(--fc-open)"
				stroke-width="2"
			/>
		{/if}
		<path
			d={speedPath}
			fill="none"
			stroke="var(--fc-response)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
		{#if showI}
			<path d={iPath} fill="none" stroke="var(--fc-i)" stroke-width="1.8" stroke-dasharray="5 3" />
		{/if}
		<path
			d={throttlePath}
			fill="none"
			stroke="var(--fc-out)"
			stroke-width="1.8"
			stroke-linejoin="round"
		/>
	</g>
	<circle
		cx={sx(now)}
		cy={sy(Math.max(yDomain[0], Math.min(yDomain[1], v)))}
		r="4.5"
		fill="var(--fc-response)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- throttle against time -->
	<Plot {sx} sy={su} {xTicks} yTicks={[0, 1]} xFormat={() => ''} yFormat={(s) => `${s * 100}%`} />
	<Readout id="throttle-title">
		<Label anchor="start" x={P0} y={TH.top - 8} text="throttle" size={12} muted />
	</Readout>
	{#if showI}
		<Readout id="i-title">
			<Label
				anchor="start"
				x={P0 + 62}
				y={TH.top - 8}
				text="- - its integral part"
				size={12}
				color="var(--fc-i)"
			/>
		</Readout>
		{#if Math.max(...run.i) > 1.12}
			<Readout id="i-off">
				<Label
					x={P1}
					y={TH.top - 8}
					text="integral above 100%: off the top"
					size={11}
					anchor="end"
					color="var(--fc-i)"
				/>
			</Readout>
		{/if}
	{/if}
	{#if ghost}
		<Readout id="ghost-throttle">
			<Label
				x={P1}
				y={su(ghostThrottle) - 6}
				text="fixed throttle"
				size={11}
				anchor="end"
				color="var(--fc-open)"
			/>
		</Readout>
	{/if}
	<Readout
		id="time"
		order={20}
		label="Time"
		value="{Math.floor(now)} s of {SECONDS}"
		note={mode === 'zn' && !zn ? 'zoomed in: 88.5–91.5 km/h' : undefined}
	/>
</g>

{#snippet carShape(color: string)}
	<g transform="translate(0 -3)">
		<path
			d="M-26 -6 L-22 -16 L-10 -24 L10 -24 L20 -16 L28 -13 L28 -4 L-26 -4 Z"
			fill={color}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			stroke-linejoin="round"
		/>
		<path d="M-8 -21 L8 -21 L15 -15 L-17 -15 Z" fill="var(--stage-bg)" opacity="0.75" />
		<circle cx="-15" cy="-4" r="6" fill="var(--fc-body)" />
		<circle cx="17" cy="-4" r="6" fill="var(--fc-body)" />
	</g>
{/snippet}

{#snippet loop()}
	{@const y = 44}
	{@const boxes = [
		{ x: 40, w: 96, text: 'target 90' },
		{ x: 176, w: 112, text: 'controller' },
		{ x: 328, w: 96, text: 'engine' },
		{ x: 464, w: 80, text: 'car' }
	]}
	{#each boxes as b, i (b.text)}
		<rect
			x={b.x}
			y={y - 16}
			width={b.w}
			height={26}
			rx="8"
			fill="var(--surface)"
			stroke={i === 1 ? 'var(--fc-response)' : 'var(--border)'}
			stroke-width={i === 1 ? 2 : 1}
		/>
		<text x={b.x + b.w / 2} y={y + 2} text-anchor="middle" style:font-size="12px" font-weight="600"
			>{b.text}</text
		>
		{#if i < boxes.length - 1}
			<line
				x1={b.x + b.w + 3}
				x2={boxes[i + 1].x - 6}
				y1={y - 3}
				y2={y - 3}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
			/>
		{/if}
	{/each}
	<Label x={144} y={y - 22} text="error" size={11} muted anchor="start" />
	<Label x={292} y={y - 22} text="throttle" size={11} muted anchor="start" />
	<!-- the speed fed back to the controller: the loop -->
	<path
		d="M544 {y - 3} H568 V{y + 26} H232 V{y + 14}"
		fill="none"
		stroke="var(--fc-response)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Label
		x={400}
		y={y + 40}
		text="speed sensor: measured speed fed back"
		size={11}
		anchor="middle"
		color="var(--fc-response)"
		weight={600}
	/>
{/snippet}
