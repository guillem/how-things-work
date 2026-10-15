<script lang="ts">
	/**
	 * A Cessna 172S in steady flight (plane.ts): the four forces drawn from its centre of
	 * gravity, lift across the flight path and weight down to one scale, thrust and drag
	 * along the path to a scale four times larger. The plane is pitched by the climb
	 * angle γ plus the wing's angle of attack. Clouds stream past at a rate set by the true
	 * airspeed and drift up or down with the climb rate (pure functions of t); an altitude
	 * gauge shows the air's density. Phases: lift (lift = weight, thrust set equal to
	 * drag), altitude (true and indicated airspeed), balance (thrust from the slider).
	 * Below the stall speed the wing cannot carry the weight: the lift arrow falls short,
	 * the plane sinks. Reduced motion: t = 2.5 s.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import {
		CL_MAX,
		C172,
		FT,
		KT,
		RHO0,
		WEIGHT,
		calibratedFromTrue,
		density,
		drag,
		dynamicPressure,
		stallSpeed,
		steady
	} from '../plane.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';
	import Title from './Title.svelte';
	import { deg, fmtForce } from './fmt.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'lift'));
	const time = $derived(reduced ? 2.5 : t);
	const speedKt = $derived(Number(params.speed ?? 100));
	const altFt = $derived(Number(params.altitude ?? 0));
	const v = $derived(speedKt * KT);
	const h = $derived(altFt * FT);
	const rho = $derived(density(h));
	const levelDrag = $derived(drag(rho, v).total);
	const thrustN = $derived(phase === 'balance' ? Number(params.thrust ?? 1630) : levelDrag);
	const st = $derived(steady(v, h, thrustN));
	const stalled = $derived(st.stalled);
	// with the wing stalled the lift is what C_L,max gives; the plane sinks
	const liftN = $derived(stalled ? dynamicPressure(rho, v) * C172.area * CL_MAX : st.lift);
	const stallKt = $derived(stallSpeed(h) / KT);
	const indicatedKt = $derived(calibratedFromTrue(v, h) / KT);
	const climbFpm = $derived(stalled ? -1500 : (st.climb / FT) * 60);
	const gammaDeg = $derived(stalled ? -8 : (st.gamma * 180) / Math.PI);
	const alphaDeg = $derived(stalled ? 18 : (st.alpha * 180) / Math.PI);

	// smooth reactions to the controls
	const pitch = new Tween(0, { duration: 700, easing: cubicInOut });
	const path = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = gammaDeg + alphaDeg;
		const g = gammaDeg;
		untrack(() => {
			pitch.set(p);
			path.set(g);
		});
	});

	// ---- forces ------------------------------------------------------------------------
	const CGX = 400;
	const CGY = 300;
	const K = 150 / WEIGHT; // px per newton, lift and weight
	const K4 = 4 * K; // thrust and drag
	const rad = (d: number) => (d * Math.PI) / 180;
	const pathRad = $derived(rad(path.current));
	// along the path (cos, −sin in screen) and across it (−sin, −cos: up)
	const along = $derived([Math.cos(pathRad), -Math.sin(pathRad)]);
	const across = $derived([-Math.sin(pathRad), -Math.cos(pathRad)]);
	const arrows = $derived([
		{
			k: 'lift',
			d: across,
			len: K * liftN,
			color: 'var(--fl-lift)',
			label: stalled ? `lift ${fmtForce(liftN)}, at most` : `lift ${fmtForce(liftN)}`
		},
		{
			k: 'weight',
			d: [0, 1],
			len: K * WEIGHT,
			color: 'var(--fl-weight)',
			label: `weight ${fmtForce(WEIGHT)}`
		},
		{
			k: 'thrust',
			d: along,
			len: K4 * thrustN,
			color: 'var(--fl-thrust)',
			label: `thrust ${fmtForce(thrustN)}`
		},
		{
			k: 'drag',
			d: [-along[0], -along[1]],
			len: K4 * st.drag,
			color: 'var(--fl-drag)',
			label: stalled ? 'drag ?' : `drag ${fmtForce(st.drag)}`
		}
	]);
	const labelPos = (a: { k: string; d: number[]; len: number }) => {
		const x = CGX + a.d[0] * (a.len + 14);
		const y = CGY + a.d[1] * (a.len + 14);
		if (a.k === 'lift') return { x: x + 8, y: y + 2, anchor: 'start' as const };
		if (a.k === 'weight') return { x: x + 8, y: y + 2, anchor: 'start' as const };
		if (a.k === 'thrust') return { x, y: y - 18, anchor: 'start' as const };
		// below the fuselage, clear of the tail
		return { x: CGX - 44, y: CGY + 36, anchor: 'end' as const };
	};

	// ---- moving sky --------------------------------------------------------------------
	const W0 = 16;
	const W1 = 860;
	const SPAN = W1 - W0 + 200;
	const CLOUDS = [
		{ x: 120, y: 90, s: 1 },
		{ x: 420, y: 150, s: 0.7 },
		{ x: 700, y: 70, s: 1.2 },
		{ x: 260, y: 470, s: 0.9 },
		{ x: 620, y: 520, s: 1.1 },
		{ x: 860, y: 330, s: 0.8 }
	];
	const vy = $derived(stalled ? -6 : st.climb); // m/s
	const clouds = $derived(
		CLOUDS.map((c, i) => {
			const x = W0 - 100 + ((((c.x - time * v * 2.5 * c.s) % SPAN) + SPAN) % SPAN);
			const y = 16 + ((((c.y + time * vy * 12) % 600) + 600) % 600);
			return { i, x, y, s: c.s };
		})
	);
	const groundY = $derived(530 + altFt * 0.3);

	// ---- altitude gauge -----------------------------------------------------------------
	const GX = 900;
	const G0 = 540;
	const G1 = 80;
	const gy = (ft: number) => G0 + ((G1 - G0) * ft) / 14000;
	const highSky = $derived(altFt / 14000);
	const deep = (x: number) =>
		x === 0 ? 'level' : `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(0)} ft/min`;
</script>

<defs>
	<clipPath id="plane-clip"><rect x="16" y="16" width="928" height="568" rx="14" /></clipPath>
</defs>
<g clip-path="url(#plane-clip)">
	<rect x="16" y="16" width="928" height="568" fill="var(--fl-sky)" />
	<rect x="16" y="16" width="928" height="568" fill="var(--fl-sky-high)" opacity={highSky} />
	{#if groundY < 584}
		<rect x="16" y={groundY} width="928" height={600 - groundY} fill="var(--fl-ground)" />
	{/if}
	{#each clouds as c (c.i)}
		<g transform="translate({c.x.toFixed(1)} {c.y.toFixed(1)}) scale({c.s})" opacity="0.85">
			<ellipse cx="0" cy="0" rx="46" ry="16" fill="var(--fl-cloud)" />
			<ellipse cx="-16" cy="-10" rx="22" ry="16" fill="var(--fl-cloud)" />
			<ellipse cx="14" cy="-12" rx="26" ry="18" fill="var(--fl-cloud)" />
		</g>
	{/each}
</g>

<!-- the flight path -->
<line
	x1={CGX - 300 * along[0]}
	y1={CGY - 300 * along[1]}
	x2={CGX + 380 * along[0]}
	y2={CGY + 380 * along[1]}
	stroke="var(--stage-ink-muted)"
	stroke-dasharray="5 6"
	opacity="0.7"
/>

<!-- the aeroplane, pointing right, centre of gravity at the origin -->
<g transform="translate({CGX} {CGY}) rotate({(-pitch.current).toFixed(2)})">
	<path
		d="M-150 -14 L-176 -60 L-190 -60 L-186 -12 Z"
		fill="var(--fl-plane)"
		stroke="var(--fl-plane-edge)"
		stroke-width="1.3"
	/>
	<line x1="56" y1="12" x2="66" y2="40" stroke="var(--fl-plane-edge)" stroke-width="3" />
	<line x1="-14" y1="14" x2="-30" y2="40" stroke="var(--fl-plane-edge)" stroke-width="3" />
	<circle cx="66" cy="42" r="9" fill="var(--fl-plane-edge)" />
	<circle cx="-30" cy="42" r="9" fill="var(--fl-plane-edge)" />
	<path
		d="M132 -4 C132 -14 122 -18 104 -20 L58 -24 L34 -44 L-46 -44 L-70 -24 L-150 -16 L-190 -14 L-192 -8 L-150 2 L-60 12 L0 18 L70 16 L112 10 C126 8 132 4 132 -4 Z"
		fill="var(--fl-plane)"
		stroke="var(--fl-plane-edge)"
		stroke-width="1.4"
	/>
	<path
		d="M30 -40 L50 -24 L20 -24 Z M10 -40 L-30 -40 L-34 -24 L4 -24 Z"
		fill="var(--fl-sky-high)"
		opacity="0.9"
	/>
	<!-- the high wing, seen edge on, at its angle of attack on the fuselage -->
	<path d="M60 -46 C40 -54 -20 -54 -70 -47 C-20 -44 40 -43 60 -46 Z" fill="var(--fl-wing)" />
	<line x1="-188" y1="-12" x2="-140" y2="-12" stroke="var(--fl-plane-edge)" stroke-width="3" />
	<ellipse cx="136" cy="-4" rx="4" ry="34" fill="var(--fl-plane-edge)" opacity="0.25" />
	<circle cx="134" cy="-4" r="5" fill="var(--fl-plane-edge)" />
</g>

<!-- forces -->
{#each arrows as a (a.k)}
	{@const lp = labelPos(a)}
	<line
		x1={CGX}
		y1={CGY}
		x2={CGX + a.d[0] * a.len}
		y2={CGY + a.d[1] * a.len}
		stroke={a.color}
		stroke-width="4"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="f-{a.k}">
		<T x={lp.x} y={lp.y} text={a.label} size={13} weight={700} color={a.color} anchor={lp.anchor} />
	</Readout>
{/each}
<circle
	cx={CGX}
	cy={CGY}
	r="5"
	fill="var(--stage-ink)"
	stroke="var(--fl-plane)"
	stroke-width="1.5"
/>

{#if stalled}
	<Readout
		id="stall"
		label="Stall"
		value="too slow: the wing can’t carry the weight"
		color="var(--fl-stall)"
	>
		<rect
			x="300"
			y="520"
			width="360"
			height="40"
			rx="10"
			fill="var(--surface)"
			stroke="var(--fl-stall)"
			stroke-width="2"
		/>
		<T
			x={480}
			y={546}
			text="STALL: below {stallKt.toFixed(0)} kt the wing can’t lift the plane"
			size={13}
			weight={700}
			anchor="middle"
			color="var(--fl-stall)"
		/>
	</Readout>
{/if}

<!-- altitude gauge -->
<Readout id="gauge">
	<line x1={GX} y1={G0} x2={GX} y2={G1} stroke="var(--stage-ink-muted)" stroke-width="2" />
	{#each [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000] as ft (ft)}
		<line x1={GX - 4} y1={gy(ft)} x2={GX + 4} y2={gy(ft)} stroke="var(--stage-ink-muted)" />
		<T
			x={GX - 8}
			y={gy(ft) + 4}
			text={ft === 0 ? '0 ft' : `${ft / 1000}k`}
			size={11}
			anchor="end"
			muted
		/>
	{/each}
	<circle cx={GX} cy={gy(altFt)} r="7" fill="var(--fl-thrust)" />
	<T
		x={GX + 12}
		y={gy(altFt) + 4}
		text="{((rho / RHO0) * 100).toFixed(0)}%"
		size={12}
		weight={650}
	/>
	<T x={GX + 34} y={G1 - 30} text="altitude," size={11.5} anchor="end" muted />
	<T x={GX + 34} y={G1 - 15} text="air density" size={11.5} anchor="end" muted />
</Readout>

<!-- readouts -->
<Card x={28} y={28} w={318} h={phase === 'balance' ? 164 : 140} />
<Title
	x={44}
	y={54}
	text="Cessna 172S, {speedKt} kt at {altFt.toLocaleString('en-GB')} ft"
	size={14}
/>
{#if phase === 'lift'}
	<Row
		id="cl"
		order={1}
		x={44}
		y={82}
		w={286}
		label="Lift coefficient needed"
		value={st.cl.toFixed(2)}
		color={stalled ? 'var(--fl-stall)' : 'var(--fl-lift)'}
	/>
	<Row
		id="max"
		order={2}
		x={44}
		y={106}
		w={286}
		label="Most the wing can give"
		value={CL_MAX.toFixed(2)}
	/>
	<Row
		id="aoa"
		order={3}
		x={44}
		y={130}
		w={286}
		label="Angle of attack"
		value={stalled ? 'beyond the stall' : deg(alphaDeg)}
	/>
{:else if phase === 'altitude'}
	<Row
		id="ias"
		order={1}
		x={44}
		y={82}
		w={286}
		label="Indicated airspeed"
		value="{indicatedKt.toFixed(0)} kt"
		color="var(--fl-thrust)"
	/>
	<Row
		id="rho"
		order={2}
		x={44}
		y={106}
		w={286}
		label="Air density"
		value="{rho.toFixed(3)} kg/m³"
	/>
	<Row
		id="stallv"
		order={3}
		x={44}
		y={130}
		w={286}
		label="Stall, true airspeed"
		value="{stallKt.toFixed(0)} kt"
		color="var(--fl-stall)"
	/>
{:else}
	<Row
		id="thr"
		order={1}
		x={44}
		y={82}
		w={286}
		label="Thrust − drag"
		value={stalled
			? '—'
			: Math.abs(thrustN - st.drag) < 15
				? 'balanced'
				: fmtForce(thrustN - st.drag)}
		color={Math.abs(thrustN - st.drag) < 15 ? 'var(--fl-lift)' : undefined}
	/>
	<Row
		id="need"
		order={2}
		x={44}
		y={106}
		w={286}
		label="Thrust for level flight"
		value={stalled ? '—' : fmtForce(levelDrag)}
	/>
	<Row
		id="climb"
		order={3}
		x={44}
		y={130}
		w={286}
		label="Climb rate"
		value={stalled ? 'falling' : deep(Math.abs(climbFpm) < 5 ? 0 : climbFpm)}
		color={stalled ? 'var(--fl-stall)' : undefined}
	/>
	<Row
		id="aoa2"
		order={4}
		x={44}
		y={154}
		w={286}
		label="Angle of attack · climb angle"
		value={stalled ? '—' : `${deg(alphaDeg)} · ${deg(gammaDeg)}`}
		minor
	/>
{/if}
<Readout id="scale-cap">
	<T
		x={44}
		y={phase === 'balance' ? 182 : 158}
		text={phase === 'lift' || phase === 'altitude'
			? 'thrust set equal to drag · thrust and drag drawn 4× larger'
			: 'thrust and drag drawn 4× larger than lift and weight'}
		size={11.5}
		muted
	/>
</Readout>
<Readout id="angle-cap">
	<T
		x={44}
		y={570}
		text="the plane is drawn pitched by its angle of attack plus its climb angle"
		size={11.5}
		muted
	/>
</Readout>
