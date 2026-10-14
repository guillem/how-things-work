<script lang="ts">
	/**
	 * The rocket equation, in four phases (step.hints.phase):
	 * - recoil: a rocket in empty space throws gas backwards; the camera follows the rocket, so
	 *   the stars stream past ever faster. The card balances the momentum of the gas and of the
	 *   rocket (equal and opposite at every moment).
	 * - equation: an upright rocket, its height split into propellant and everything else,
	 *   drains its tank while the speed gained ticks up; the card plots Δv = vₑ ln(m₀/m_f)
	 *   against the propellant share.
	 * - tyranny: nested squares, each e times the area of the one inside it: one per exhaust
	 *   speed of Δv, round 1 t that arrives. The card plots the mass ratio (log scale) against Δv.
	 * - budget: the same, for a mission's Δv budget, shown as a stacked bar of its legs.
	 * All numbers come from `rockets.ts` and `space.ts`.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, cycle, hash, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { idealDeltaV, massRatio, saturnV } from '../rockets';
	import { hohmann, marsHohmann, MU_EARTH, R_GEO, R_LEO } from '../space';
	import Card from './Card.svelte';
	import RocketShape from './RocketShape.svelte';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'recoil'));
	const PANEL = { x: 16, y: 16, w: 488, h: 568 };
	const CARD = { x: 520, y: 16, w: 424, h: 568 };
	const CL = CARD.x + 22;
	const CR = CARD.x + CARD.w - 22;
	const tt = $derived(reduced ? 2.5 : t);

	const ve = $derived(
		clamp(Number(phase === 'budget' ? (params.veBudget ?? 4.4) : (params.ve ?? 3)), 1, 4.5)
	);
	const fmt = (v: number, d = 1) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const big = (v: number) =>
		v >= 1e6
			? `${fmt(v / 1e6, 1)} million`
			: v >= 1000
				? Math.round(v).toLocaleString('en-US')
				: v >= 100
					? v.toFixed(0)
					: v >= 10
						? v.toFixed(1)
						: v.toFixed(2);

	const STARS = Array.from({ length: 46 }, (_, i) => ({
		x: hash(i, 1) * PANEL.w,
		y: PANEL.y + 10 + hash(i, 2) * (PANEL.h - 20),
		r: 0.6 + hash(i, 3) * 1.3,
		depth: 0.4 + hash(i, 4) * 0.6
	}));

	// ---- recoil -------------------------------------------------------------------------------
	const M0 = 100; // t
	const MF = 20;
	const BURN = 9; // s on screen
	const PERIOD = 12;
	const Q = (M0 - MF) / BURN; // t per screen-second
	const local = $derived(cycle(tt, PERIOD) * PERIOD);
	const burnT = $derived(Math.min(local, BURN));
	const massNow = $derived(M0 - Q * burnT);
	const speedAt = (s: number) => ve * Math.log(M0 / (M0 - Q * Math.min(s, BURN)));
	const speedNow = $derived(speedAt(local));
	/** Distance travelled (km, in screen seconds × km/s) from the start of the loop. */
	const distAt = (s: number) => {
		const b = Math.min(s, BURN);
		const u = M0 - Q * b;
		const during = ve * (b * Math.log(M0) - (M0 * Math.log(M0) - M0 - u * Math.log(u) + u) / Q);
		return during + (s > BURN ? (s - BURN) * speedAt(BURN) : 0);
	};
	const dist = $derived(distAt(local));
	const NOZZLE = { x: 214, y: 300 };
	const PX_PER_KM = 34; // gas: px per km of separation
	const pellets = $derived.by(() => {
		if (phase !== 'recoil') return [];
		const out: { k: number; x: number; y: number; o: number }[] = [];
		const every = 0.09;
		const first = Math.max(0, Math.floor((local - 3) / every));
		const last = Math.floor(Math.min(local, BURN) / every);
		for (let k = first; k <= last; k++) {
			const te = k * every;
			const age = local - te;
			if (age < 0) continue;
			// Gas moves at (v(te) − vₑ) for ever; the rocket's distance grew by dist(now) − dist(te).
			const sep = ve * age + (dist - distAt(te) - speedAt(te) * age);
			const x = NOZZLE.x - 6 - sep * PX_PER_KM;
			if (x < PANEL.x + 8) continue;
			const spread = (hash(k, 7) - 0.5) * (8 + age * 30);
			const o = smoothstep(PANEL.x + 8, PANEL.x + 60, x) * (1 - smoothstep(1.6, 3, age));
			out.push({ k, x, y: NOZZLE.y + spread, o });
		}
		return out;
	});
	const momentum = $derived(massNow * speedNow); // t·km/s
	const pMax = $derived(MF * 4.5 * Math.log(M0 / MF));

	// ---- equation -----------------------------------------------------------------------------
	const share = $derived(clamp(Number(params.share ?? 80), 0, 95) / 100);
	const ratio = $derived(1 / (1 - share));
	const dvShare = $derived(ve * Math.log(ratio));
	const EQ_BURN = 7;
	const EQ_PERIOD = 10;
	const eqLocal = $derived(reduced ? EQ_BURN : cycle(tt, EQ_PERIOD) * EQ_PERIOD);
	const drained = $derived(clamp(eqLocal / EQ_BURN));
	const eqMass = $derived(1 - share * drained); // of the start mass
	const eqSpeed = $derived(ve * Math.log(1 / eqMass));
	const ROCKET_H = 380;
	const exSx = scale([0, 100], [CL + 34, CR - 6]);
	const exSy = scale([0, 14], [CARD.y + 404, CARD.y + 116]);
	const shareCurve = (v: number) => {
		let d = '';
		for (let i = 0; i <= 60; i++) {
			const s = (i / 60) * 99;
			const dv = Math.min(14, v * Math.log(1 / (1 - s / 100)));
			d += `${i ? 'L' : 'M'}${exSx(s).toFixed(1)} ${exSy(dv).toFixed(1)}`;
		}
		return d;
	};

	// ---- tyranny and budget -------------------------------------------------------------------
	const geo = hohmann(MU_EARTH, R_LEO, R_GEO);
	const mars = marsHohmann();
	const LEO = idealDeltaV(saturnV);
	type Leg = { id: string; label: string; dv: number; color: string };
	const LEGS: Record<string, Leg[]> = {
		leo: [{ id: 'up', label: 'ground to low orbit', dv: LEO, color: 'var(--rk-fuel)' }],
		geo: [
			{ id: 'up', label: 'ground to low orbit', dv: LEO, color: 'var(--rk-fuel)' },
			{ id: 'g1', label: 'raise', dv: geo.dv1, color: 'var(--rk-speed)' },
			{ id: 'g2', label: 'round off', dv: geo.dv2, color: 'var(--rk-drag)' }
		],
		escape: [
			{ id: 'up', label: 'ground to low orbit', dv: LEO, color: 'var(--rk-fuel)' },
			{ id: 'm1', label: 'leave for Mars', dv: mars.burnDepart, color: 'var(--rk-speed)' }
		],
		mars: [
			{ id: 'up', label: 'ground to low orbit', dv: LEO, color: 'var(--rk-fuel)' },
			{ id: 'm1', label: 'leave for Mars', dv: mars.burnDepart, color: 'var(--rk-speed)' },
			{ id: 'm2', label: 'into Mars orbit', dv: mars.burnArrive, color: 'var(--rk-mars)' }
		]
	};
	const mission = $derived(String(params.mission ?? 'mars'));
	const legs = $derived(LEGS[mission] ?? LEGS.mars);
	const missionDv = $derived(legs.reduce((s, l) => s + l.dv, 0) / 1000);
	const target = $derived(
		phase === 'budget' ? missionDv : clamp(Number(params.target ?? 9.4), 1, 15)
	);
	const R = $derived(massRatio(target, ve));
	const turns = $derived(target / ve);

	// Nested squares: the inner one is the 1 t that arrives; each ring is one more exhaust
	// speed of Δv, e times the mass (area) of what it holds. The scale shrinks to fit.
	const SQ = $derived(
		phase === 'budget' ? { x: 40, y: 560, max: 340 } : { x: 40, y: 560, max: 450 }
	);
	const base = $derived(Math.max(0.6, Math.min(64, SQ.max / Math.sqrt(R))));
	const rings = $derived.by(() => {
		const out: { j: number; side: number }[] = [];
		const n = Math.floor(turns + 1e-9);
		for (let j = 0; j <= n; j++) out.push({ j, side: base * Math.exp(j / 2) });
		return out;
	});
	const outer = $derived(Math.min(SQ.max, base * Math.sqrt(R)));
	const outerClipped = $derived(base * Math.sqrt(R) > SQ.max + 0.5);
	const grow = new Tween(1, { duration: 700, easing: cubicInOut });
	const growKey = $derived(`${phase}:${mission}`);
	$effect(() => {
		void growKey;
		untrack(() => {
			if (reduced) grow.set(1, { duration: 0 });
			else {
				grow.set(0, { duration: 0 });
				grow.set(1);
			}
		});
	});
	const ringLabelEvery = $derived(Math.max(1, Math.ceil(rings.length / 6)));

	const lgSx = scale([0, 16], [CL + 40, CR - 6]);
	const lgSy = scale([0, 5], [CARD.y + 404, CARD.y + 116]);
	const LOG_TICKS = [0, 1, 2, 3, 4, 5];
	const logCurve = (v: number) => {
		let d = '';
		let started = false;
		for (let i = 0; i <= 60; i++) {
			const dv = (i / 60) * 16;
			const y = dv / v / Math.LN10;
			if (y > 5) {
				const dvTop = 5 * Math.LN10 * v;
				d += `L${lgSx(dvTop).toFixed(1)} ${lgSy(5).toFixed(1)}`;
				break;
			}
			d += `${started ? 'L' : 'M'}${lgSx(dv).toFixed(1)} ${lgSy(y).toFixed(1)}`;
			started = true;
		}
		return d;
	};
	const markLog = $derived(Math.min(5, Math.log10(R)));
	const budgetBar = $derived.by(() => {
		const total = legs.reduce((s, l) => s + l.dv, 0);
		const sx = scale([0, 16000], [PANEL.x + 24, PANEL.x + PANEL.w - 24]);
		let x = sx(0);
		return legs
			.map((l) => {
				const w = sx(l.dv) - sx(0);
				const seg = { ...l, x, w };
				x += w;
				return seg;
			})
			.map((s) => ({ ...s, total }));
	});
</script>

<g>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>
	<defs>
		<clipPath id="rocketeq-panel">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="14" />
		</clipPath>
	</defs>

	<g clip-path="url(#rocketeq-panel)">
		{#each STARS as s, i (i)}
			{@const sx =
				phase === 'recoil'
					? PANEL.x + ((((s.x - dist * 22 * s.depth) % PANEL.w) + PANEL.w) % PANEL.w)
					: PANEL.x + s.x}
			<circle
				cx={sx}
				cy={s.y}
				r={s.r}
				fill="var(--stage-ink-muted)"
				opacity={0.25 + 0.35 * s.depth}
			/>
		{/each}

		{#if phase === 'recoil'}
			{#each pellets as p (p.k)}
				<circle cx={p.x} cy={p.y} r="3.2" fill="var(--rk-gas)" opacity={p.o * 0.85} />
			{/each}
			<RocketShape
				x={NOZZLE.x}
				y={NOZZLE.y}
				angle={90}
				width={46}
				segments={[{ h: 170, full: (massNow - MF) / (M0 - MF) }]}
				payload={30}
				flame={local < BURN ? 1 : 0}
				flicker={cycle(tt, 0.23)}
			/>
		{/if}

		{#if phase === 'equation'}
			{@const tank = ROCKET_H * share}
			{@const rest = ROCKET_H - tank}
			<RocketShape
				x={210}
				y={548}
				width={78}
				segments={tank > 0 ? [{ h: tank, full: 1 - drained }] : []}
				payload={Math.max(10, rest - 30)}
				flame={drained < 1 && share > 0 ? 1 : 0}
				flicker={cycle(tt, 0.23)}
			/>
		{/if}
	</g>

	{#if phase === 'recoil'}
		<Readout id="recoil-caption">
			<T
				x={PANEL.x + 22}
				y={PANEL.y + 34}
				text="Empty space, no air, no ground"
				size={13}
				weight={600}
			/>
			<T
				x={PANEL.x + 22}
				y={PANEL.y + 54}
				text="the view follows the rocket: the stars stream past"
				size={11}
				muted
			/>
			<T
				x={NOZZLE.x - 70}
				y={NOZZLE.y + 60}
				text="gas thrown back"
				size={12}
				muted
				anchor="middle"
			/>
		</Readout>
	{/if}
	{#if phase === 'equation'}
		<Readout id="eq-labels">
			<line
				x1="262"
				x2="262"
				y1={542 - ROCKET_H * share}
				y2="542"
				stroke="var(--rk-fuel)"
				stroke-width="2"
			/>
			<T
				x={272}
				y={546 - (ROCKET_H * share) / 2}
				text="propellant {Math.round(share * 100)}%"
				size={13}
				weight={600}
				color="var(--rk-fuel)"
			/>
			<T
				x={272}
				y={Math.max(80, 548 - ROCKET_H * share - (ROCKET_H * (1 - share)) / 2 + 4)}
				text="everything else {Math.round((1 - share) * 100)}%"
				size={12}
				muted
			/>
			<T
				x={PANEL.x + 22}
				y={PANEL.y + 34}
				text="Burning down, in empty space"
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}

	{#if phase === 'tyranny' || phase === 'budget'}
		{#if phase === 'budget'}
			<Readout id="budget-title">
				<T x={PANEL.x + 24} y={PANEL.y + 32} text="Δv budget" size={14} weight={700} />
				<T
					x={PANEL.x + PANEL.w - 24}
					y={PANEL.y + 32}
					text="{fmt(missionDv, 1)} km/s"
					size={14}
					weight={700}
					anchor="end"
				/>
			</Readout>
			{#each budgetBar as s, i (s.id)}
				<rect
					x={s.x}
					y={PANEL.y + 46}
					width={Math.max(0, s.w - 1.5)}
					height="22"
					rx="4"
					fill={s.color}
					opacity="0.85"
				/>
				<Readout
					id="leg-{s.id}"
					order={10 + i}
					label={s.label}
					value="{fmt(s.dv / 1000, 2)} km/s"
					color={s.color}
				>
					<T x={s.x + 2} y={PANEL.y + 86 + (i % 2) * 30} text={s.label} size={11} muted />
					<T
						x={s.x + 2}
						y={PANEL.y + 100 + (i % 2) * 30}
						text="{fmt(s.dv / 1000, 2)} km/s"
						size={12}
						weight={600}
					/>
				</Readout>
			{/each}
		{/if}
		<!-- nested squares -->
		{#each rings.toReversed() as r (r.j)}
			{@const side = r.side * (0.25 + 0.75 * grow.current)}
			<rect
				x={SQ.x}
				y={SQ.y - side}
				width={side}
				height={side}
				fill={r.j === 0 ? 'var(--rk-payload)' : 'var(--rk-fuel)'}
				opacity={r.j === 0 ? 0.95 : 0.1 + 0.1 * (r.j % 2)}
				stroke={r.j === 0 ? 'none' : 'var(--rk-fuel)'}
				stroke-width="1"
			/>
		{/each}
		<rect
			x={SQ.x}
			y={SQ.y - outer}
			width={outer}
			height={outer}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-dasharray={outerClipped ? '6 4' : undefined}
		/>
		<Readout id="squares-labels">
			{#each rings as r (r.j)}
				{#if r.j > 0 && r.j % ringLabelEvery === 0 && r.side > 30 && r.side < outer - 20}
					<T
						x={SQ.x + r.side + 6}
						y={SQ.y - r.side + 12}
						text="×{big(Math.exp(r.j))}"
						size={11}
						muted
					/>
				{/if}
			{/each}
			<T
				x={SQ.x + Math.max(base, 10) + 8}
				y={SQ.y - 4}
				text={base > 8 ? '1 t arrives' : '1 t arrives (the dot)'}
				size={12}
				weight={600}
				color="var(--rk-payload)"
			/>
			<T
				x={SQ.x + 8}
				y={SQ.y - outer + 20}
				text="{big(R)} t on the pad{outerClipped ? ' (not to scale)' : ''}"
				size={13}
				weight={700}
			/>
			{#if phase === 'tyranny'}
				<T
					x={PANEL.x + 22}
					y={PANEL.y + 34}
					text="Fuel to lift the fuel to lift the fuel…"
					size={13}
					weight={600}
				/>
				<T
					x={PANEL.x + 22}
					y={PANEL.y + 54}
					text="each square out is one more exhaust speed of Δv:"
					size={11}
					muted
				/>
				<T
					x={PANEL.x + 22}
					y={PANEL.y + 70}
					text="e ≈ 2.7 times the mass of everything inside it (areas to scale)"
					size={11}
					muted
				/>
			{/if}
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- card -->
	<Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />

	{#if phase === 'recoil'}
		<Readout id="rc-title">
			<T x={CL} y={CARD.y + 34} text="Momentum stays balanced" size={16} weight={700} />
			<T x={CL} y={CARD.y + 54} text="100 t rocket, 80 t of it propellant" size={11} muted />
		</Readout>
		{@const mid = CARD.x + CARD.w / 2}
		{@const sc = (CARD.w / 2 - 34) / pMax}
		<line x1={mid} x2={mid} y1={CARD.y + 96} y2={CARD.y + 196} stroke="var(--stage-line)" />
		<rect
			x={mid - momentum * sc}
			y={CARD.y + 112}
			width={momentum * sc}
			height="26"
			rx="4"
			fill="var(--rk-gas)"
		/>
		<rect
			x={mid}
			y={CARD.y + 152}
			width={momentum * sc}
			height="26"
			rx="4"
			fill="var(--rk-payload)"
		/>
		<Readout id="rc-bars">
			<T x={mid - 8} y={CARD.y + 106} text="← gas" size={12} anchor="end" muted />
			<T x={mid + 8} y={CARD.y + 196} text="rocket →" size={12} muted />
			<T
				x={mid}
				y={CARD.y + 220}
				text="total momentum: zero"
				size={12}
				anchor="middle"
				weight={600}
			/>
		</Readout>
		<Readout id="rc-ve" order={1} label="Exhaust speed" value="{fmt(ve)} km/s">
			<T x={CL} y={CARD.y + 268} text="Exhaust speed" size={12} muted />
			<T x={CR} y={CARD.y + 268} text="{fmt(ve)} km/s" size={15} weight={700} anchor="end" />
		</Readout>
		<Readout id="rc-used" order={2} label="Propellant thrown out" value="{fmt(M0 - massNow, 0)} t">
			<T x={CL} y={CARD.y + 296} text="Propellant thrown out" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 296}
				text="{fmt(M0 - massNow, 0)} of 80 t"
				size={14}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="rc-speed"
			order={3}
			label="Rocket's speed"
			value="{fmt(speedNow, 2)} km/s"
			color="var(--rk-payload)"
		>
			<T x={CL} y={CARD.y + 324} text="Rocket's speed" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 324}
				text="{fmt(speedNow, 2)} km/s"
				size={15}
				weight={700}
				anchor="end"
				color="var(--rk-payload)"
			/>
		</Readout>
		<Readout id="rc-thrust" order={4} label="Thrust" value="{fmt((Q / 1) * ve, 1)} MN">
			<T x={CL} y={CARD.y + 352} text="Thrust = flow × exhaust speed" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 352}
				text="{fmt(Q, 1)} t/s × {fmt(ve)} km/s = {fmt(Q * ve, 0)} MN"
				size={12}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout id="rc-note">
			<T x={CL} y={CARD.y + 404} text="The rocket pushes on its own exhaust," size={12} />
			<T x={CL} y={CARD.y + 422} text="not on the air or the ground: it works" size={12} />
			<T x={CL} y={CARD.y + 440} text="best of all in empty space." size={12} />
			<T
				x={CL}
				y={CARD.y + 480}
				text="(the flow is sped up for the drawing: 80 t in 9 s)"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	{#if phase === 'equation'}
		<Readout id="eq-title">
			<T x={CL} y={CARD.y + 34} text="Δv = vₑ × ln(m_start / m_end)" size={16} weight={700} />
			<T x={CL} y={CARD.y + 54} text="speed gained against propellant share" size={11} muted />
		</Readout>
		<Axes
			sx={exSx}
			sy={exSy}
			xLabel="propellant, % of start mass"
			yLabel="Δv, km/s"
			xTicks={[0, 25, 50, 75, 100]}
			yTicks={[0, 2, 4, 6, 8, 10, 12, 14]}
		/>
		{#each [{ v: 3, label: '3 km/s' }, { v: 4.4, label: '4.4' }] as c (c.v)}
			{#if Math.abs(c.v - ve) > 0.05}
				<path
					d={shareCurve(c.v)}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{/if}
		{/each}
		<path d={shareCurve(ve)} fill="none" stroke="var(--rk-fuel)" stroke-width="2.5" />
		<line
			x1={exSx(share * 100)}
			x2={exSx(share * 100)}
			y1={exSy(0)}
			y2={exSy(Math.min(14, dvShare))}
			stroke="var(--rk-fuel)"
			stroke-dasharray="3 3"
		/>
		<line
			x1={exSx(0)}
			x2={exSx(share * 100)}
			y1={exSy(Math.min(14, dvShare))}
			y2={exSy(Math.min(14, dvShare))}
			stroke="var(--rk-fuel)"
			stroke-dasharray="3 3"
		/>
		<circle
			cx={exSx(share * 100)}
			cy={exSy(Math.min(14, dvShare))}
			r="5.5"
			fill="var(--rk-fuel)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
		<Readout id="eq-ratio" order={1} label="Mass ratio" value={fmt(ratio, 1)}>
			<T x={CL} y={CARD.y + 466} text="Mass ratio m_start / m_end" size={12} muted />
			<T x={CR} y={CARD.y + 466} text={fmt(ratio, 1)} size={15} weight={700} anchor="end" />
		</Readout>
		<Readout
			id="eq-dv"
			order={2}
			label="Δv when empty"
			value="{fmt(dvShare, 2)} km/s"
			color="var(--rk-fuel)"
		>
			<T x={CL} y={CARD.y + 494} text="Δv when the tank is empty" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 494}
				text="{fmt(dvShare, 2)} km/s"
				size={15}
				weight={700}
				anchor="end"
				color="var(--rk-fuel)"
			/>
		</Readout>
		<Readout id="eq-now" order={3} label="Speed so far" value="{fmt(eqSpeed, 2)} km/s">
			<T x={CL} y={CARD.y + 522} text="Speed gained so far" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 522}
				text="{fmt(eqSpeed, 2)} km/s"
				size={14}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout id="eq-ve">
			<T
				x={CL}
				y={CARD.y + 548}
				text="exhaust speed {fmt(ve)} km/s; dashed: 3 and 4.4 km/s"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	{#if phase === 'tyranny' || phase === 'budget'}
		<Readout id="ty-title">
			<T
				x={CL}
				y={CARD.y + 34}
				text={phase === 'budget'
					? 'Tonnes on the pad per tonne delivered'
					: 'm_start / m_end = e^(Δv / vₑ)'}
				size={16}
				weight={700}
			/>
			<T
				x={CL}
				y={CARD.y + 54}
				text="mass ratio, each grid line ten times the last"
				size={11}
				muted
			/>
		</Readout>
		<Axes
			sx={lgSx}
			sy={lgSy}
			xLabel="Δv, km/s"
			xTicks={[0, 4, 8, 12, 16]}
			yTicks={LOG_TICKS}
			yFormat={(v) => (v < 3 ? String(10 ** v) : v === 3 ? '1,000' : v === 4 ? '10⁴' : '10⁵')}
		/>
		{#each [3, 4.4] as c (c)}
			{#if Math.abs(c - ve) > 0.05}
				<path
					d={logCurve(c)}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
			{/if}
		{/each}
		<path d={logCurve(ve)} fill="none" stroke="var(--rk-fuel)" stroke-width="2.5" />
		<line
			x1={lgSx(target)}
			x2={lgSx(target)}
			y1={lgSy(0)}
			y2={lgSy(markLog)}
			stroke="var(--rk-fuel)"
			stroke-dasharray="3 3"
		/>
		<circle
			cx={lgSx(target)}
			cy={lgSy(markLog)}
			r="5.5"
			fill="var(--rk-fuel)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
		<Readout id="ty-dv" order={1} label="Δv" value="{fmt(target, 1)} km/s">
			<T
				x={CL}
				y={CARD.y + 466}
				text={phase === 'budget' ? 'Mission Δv' : 'Δv to gain'}
				size={12}
				muted
			/>
			<T
				x={CR}
				y={CARD.y + 466}
				text="{fmt(target, 1)} km/s = {fmt(turns, 2)} × vₑ"
				size={14}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout id="ty-ratio" order={2} label="Start ÷ end mass" value={big(R)} color="var(--rk-fuel)">
			<T x={CL} y={CARD.y + 494} text="Start mass ÷ end mass" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 494}
				text={big(R)}
				size={16}
				weight={700}
				anchor="end"
				color="var(--rk-fuel)"
			/>
		</Readout>
		<Readout id="ty-share" order={3} label="Propellant" value="{fmt(100 * (1 - 1 / R), 1)}%">
			<T x={CL} y={CARD.y + 522} text="Share that is propellant" size={12} muted />
			<T
				x={CR}
				y={CARD.y + 522}
				text="{fmt(100 * (1 - 1 / R), 1)}%"
				size={14}
				weight={600}
				anchor="end"
			/>
		</Readout>
		<Readout id="ty-ve">
			<T
				x={CL}
				y={CARD.y + 548}
				text="exhaust speed {fmt(ve)} km/s; dashed: 3 and 4.4 km/s{phase === 'budget'
					? '; ideal tanks'
					: ''}"
				size={11}
				muted
			/>
		</Readout>
	{/if}
</g>
