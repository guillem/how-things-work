<script lang="ts">
	/**
	 * A flight from the pad (phase 'saturn': Apollo 11's Saturn V; phase 'design': the reader's
	 * rocket from params.fuel, params.veDesign and params.stages). The flight is `flyBest()` in
	 * the model: a point mass over a round, spinning Earth through the US Standard Atmosphere
	 * 1976. The panel plots height against distance travelled round the Earth (heights
	 * stretched about 11×), the path coloured by stage; the rocket moves along it at 40× real
	 * time, then the result is held and the flight repeats. The card tallies the Δv budget as
	 * the flight goes: what the engines gave, minus gravity, drag and steering losses, plus
	 * the Earth's spin, equals the speed now.
	 *
	 * A new design restarts the flight (the frame-to-frame memo sanctioned by the scene guide,
	 * as in orbits-kepler/scenes/CannonScene.svelte).
	 */
	import { clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		atmosphere,
		circularSpeed,
		designRocket,
		flyBest,
		idealDeltaV,
		RE,
		saturnV,
		type Sample
	} from '../rockets';
	import Card from './Card.svelte';
	import RocketShape from './RocketShape.svelte';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'saturn'));
	const fuel = $derived(clamp(Number(params.fuel ?? 500), 50, 1000));
	const ve = $derived(clamp(Number(params.veDesign ?? 3), 2, 4.5));
	const nStages = $derived(Math.round(clamp(Number(params.stages ?? 1), 1, 3)));
	const vehicle = $derived(
		phase === 'saturn' ? saturnV : designRocket(fuel * 1000, ve * 1000, nStages)
	);
	const flight = $derived(flyBest(vehicle));
	const ideal = $derived(idealDeltaV(vehicle));

	// ---- geometry ---------------------------------------------------------------------------
	const PANEL = { x: 16, y: 16, w: 584, h: 568 };
	const CARD = { x: 616, y: 16, w: 328, h: 568 };
	const CL = CARD.x + 20;
	const CR = CARD.x + CARD.w - 20;
	const GROUND = 532;
	const sx = scale([0, 3000], [PANEL.x + 30, PANEL.x + PANEL.w - 18]);
	const sy = scale([0, 240], [GROUND, PANEL.y + 60]);
	const downrange = (s: Sample) => (RE * Math.atan2(s.x, s.y)) / 1000;
	const ORBIT_H = $derived((vehicle.target ?? 190e3) / 1000);
	const V_ORBIT = $derived(circularSpeed(ORBIT_H * 1000) / 1000);

	// Air: bands shaded by density (US76), thinning upwards.
	const AIR = [0, 5, 10, 15, 20, 30, 40, 60].map((h, i, a) => ({
		h,
		top: a[i + 1] ?? 90,
		o: 0.08 + 0.55 * Math.pow(atmosphere(h * 1000).rho / 1.225, 0.6)
	}));

	// ---- time ---------------------------------------------------------------------------------
	const SPEEDUP = 40;
	const end = $derived(flight.samples[flight.samples.length - 1].t);
	const flyFor = $derived(clamp(end / SPEEDUP, 6, 24));
	const HOLD = 4;
	const key = $derived(`${phase}:${fuel}:${ve}:${nStages}`);
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (memo.key !== key || t < memo.start) memo = { key, start: memo.key ? t : 0 };
		return t - memo.start;
	});
	const local = $derived(reduced ? flyFor + HOLD : since % (flyFor + HOLD));
	const u = $derived(clamp(local / flyFor));
	const tf = $derived(u * end); // flight time now (s)
	const done = $derived(u >= 1);

	/** The state at flight time s, interpolated between samples. */
	const stateAt = (s: number): Sample => {
		const ss = flight.samples;
		let lo = 0;
		let hi = ss.length - 1;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (ss[mid].t <= s) lo = mid;
			else hi = mid;
		}
		const a = ss[lo];
		const b = ss[hi];
		const w = b.t > a.t ? clamp((s - a.t) / (b.t - a.t)) : 0;
		const mix = (p: number, q: number) => p + (q - p) * w;
		return {
			t: s,
			x: mix(a.x, b.x),
			y: mix(a.y, b.y),
			h: mix(a.h, b.h),
			v: mix(a.v, b.v),
			stage: w < 1 ? a.stage : b.stage,
			gravity: mix(a.gravity, b.gravity),
			drag: mix(a.drag, b.drag),
			steering: mix(a.steering, b.steering),
			burned: mix(a.burned, b.burned)
		};
	};
	const now = $derived(stateAt(tf));
	const pt = (s: Sample) => ({ x: sx(downrange(s)), y: sy(Math.max(0, s.h / 1000)) });

	// Path pieces, one per stage, and the coast after cutoff.
	const pieces = $derived.by(() => {
		const out: { stage: number; d: string }[] = [];
		let cur: { stage: number; d: string } | null = null;
		let prev = '';
		for (const s of flight.samples) {
			const p = pt(s);
			const xy = `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
			if (!cur || cur.stage !== s.stage) {
				cur = { stage: s.stage, d: prev ? `M${prev}L${xy}` : `M${xy}` };
				out.push(cur);
			} else cur.d += `L${xy}`;
			prev = xy;
		}
		return out;
	});
	const COLORS = ['var(--rk-fuel)', 'var(--rk-speed)', 'var(--rk-drag)'];
	/** Length of the drawn part of each piece: drawn as the flight goes, via a clip. */
	const head = $derived(pt(now));
	const dir = $derived.by(() => {
		const b = stateAt(Math.min(end, tf + 4));
		const a = stateAt(Math.max(0, tf - 4));
		const pa = pt(a);
		const pb = pt(b);
		const ang = (Math.atan2(pb.x - pa.x, -(pb.y - pa.y)) * 180) / Math.PI;
		return Number.isFinite(ang) && Math.hypot(pb.x - pa.x, pb.y - pa.y) > 0.5 ? ang : 0;
	});
	const stageNow = $derived(now.stage);
	const burning = $derived(stageNow >= 0 && tf < flight.cutoff.t && !done);

	const separations = $derived(
		flight.staging
			.filter((s) => s < flight.cutoff.t - 1)
			.map((s, i) => ({ i, s, p: pt(stateAt(s)) }))
	);

	// Rocket stack drawn on the marker: the stages still attached.
	const stackSegs = $derived.by(() => {
		const st = Math.max(0, stageNow < 0 ? vehicle.stages.length - 1 : stageNow);
		const segs: { h: number; full: number }[] = [];
		for (let i = st; i < vehicle.stages.length; i++) {
			const s = vehicle.stages[i];
			const prop = s.m0 - s.mf;
			const h = 6 + 18 * Math.sqrt(prop / vehicle.stages[0].m0);
			let full = 1;
			if (i === st) {
				const startT = i === 0 ? 0 : (flight.staging[i - 1] ?? 0);
				const burnT = prop / s.mdot;
				full =
					stageNow < 0
						? clamp(1 - (flight.cutoff.t - startT) / burnT)
						: clamp(1 - (tf - startT) / burnT);
			}
			segs.push({ h, full });
		}
		return segs;
	});

	// ---- the Δv tally -------------------------------------------------------------------------
	const tally = $derived.by(() => {
		const k = (v: number) => v / 1000;
		return {
			burned: k(now.burned),
			gravity: k(now.gravity),
			drag: k(now.drag),
			steering: k(now.steering),
			spin: k(flight.spin),
			speed: k(now.v)
		};
	});
	const rows = $derived([
		{ id: 'b', label: 'engines gave', v: tally.burned, sign: '', color: 'var(--rk-fuel)' },
		{ id: 'g', label: '− gravity', v: tally.gravity, sign: '−', color: 'var(--rk-gravity)' },
		{ id: 'd', label: '− air drag', v: tally.drag, sign: '−', color: 'var(--rk-drag)' },
		{ id: 's', label: '− steering', v: tally.steering, sign: '−', color: 'var(--rk-steer)' },
		{ id: 'e', label: "+ Earth's spin", v: tally.spin, sign: '+', color: 'var(--rk-spin)' },
		{ id: 'v', label: '= speed now', v: tally.speed, sign: '', color: 'var(--rk-speed)' }
	]);
	const BAR = { x: CL + 98, w: CARD.w - 40 - 98 - 50 };
	const bx = (v: number) => (v / 10) * BAR.w;

	const fmt = (v: number, d = 1) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const clock = (s: number) =>
		`T+${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	const stageName = $derived(
		stageNow < 0 ? 'engines off' : `${vehicle.stages[stageNow]?.name ?? ''} burning`
	);
	const verdict = $derived(
		flight.outcome === 'orbit'
			? `In orbit, ${Math.round(flight.perigee / 1000)} × ${Math.round(flight.apogee / 1000)} km`
			: `Falls back to Earth`
	);
	const verdictNote = $derived(
		flight.outcome === 'orbit'
			? `${fmt(flight.spare / 1000, 2)} km/s of Δv left in the tanks${phase === 'saturn' ? ', kept for the Moon' : ''}`
			: `top speed ${fmt(flight.cutoff.v / 1000, 1)} of the ${fmt(V_ORBIT, 1)} km/s needed`
	);
	const liftoff = $derived(vehicle.stages[0].m0 / 1000);
</script>

<g>
	<defs>
		<clipPath id="ascent-panel">
			<rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx="14" />
		</clipPath>
		<clipPath id="ascent-drawn">
			<rect x={PANEL.x} y={PANEL.y} width={Math.max(0, head.x - PANEL.x + 1)} height={PANEL.h} />
		</clipPath>
	</defs>
	<rect
		x={PANEL.x}
		y={PANEL.y}
		width={PANEL.w}
		height={PANEL.h}
		rx="14"
		fill="var(--orb-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#ascent-panel)">
		{#each AIR as a (a.h)}
			<rect
				x={PANEL.x}
				y={sy(a.top)}
				width={PANEL.w}
				height={sy(a.h) - sy(a.top)}
				fill="var(--rk-air)"
				opacity={a.o}
			/>
		{/each}
		<rect
			x={PANEL.x}
			y={GROUND}
			width={PANEL.w}
			height={PANEL.y + PANEL.h - GROUND}
			fill="var(--sky-land)"
			opacity="0.45"
		/>
		<line x1={PANEL.x} x2={PANEL.x + PANEL.w} y1={GROUND} y2={GROUND} stroke="var(--stage-line)" />
		<!-- target orbit height -->
		<line
			x1={sx(0)}
			x2={PANEL.x + PANEL.w}
			y1={sy(ORBIT_H)}
			y2={sy(ORBIT_H)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 6"
			opacity="0.6"
		/>
		<!-- grid: heights -->
		{#each [50, 100, 150, 200] as h (h)}
			<line x1={sx(0)} x2={sx(0) - 5} y1={sy(h)} y2={sy(h)} stroke="var(--stage-line)" />
		{/each}
		<!-- the path, revealed up to the rocket -->
		<g clip-path="url(#ascent-drawn)">
			{#each pieces as p, i (i)}
				<path
					d={p.d}
					fill="none"
					stroke={p.stage < 0 ? 'var(--stage-ink-muted)' : COLORS[p.stage % 3]}
					stroke-width={p.stage < 0 ? 1.6 : 2.8}
					stroke-dasharray={p.stage < 0 ? '5 5' : undefined}
					stroke-linecap="round"
				/>
			{/each}
		</g>
		{#if flight.outcome === 'orbit'}
			{@const c = pt(stateAt(flight.cutoff.t))}
			<line
				x1={c.x}
				x2={PANEL.x + PANEL.w}
				y1={c.y}
				y2={c.y}
				stroke="var(--rk-path)"
				stroke-width="2"
				stroke-dasharray="2 5"
				opacity={smoothstep(0, 0.5, local - flyFor)}
			/>
		{/if}
		{#each separations as s (s.i)}
			<circle
				cx={s.p.x}
				cy={s.p.y}
				r="4"
				fill="var(--surface)"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				opacity={tf >= s.s ? 1 : 0}
			/>
		{/each}
		<!-- the rocket -->
		{#if !(flight.outcome === 'falls' && done)}
			<RocketShape
				x={head.x}
				y={head.y}
				angle={dir}
				width={10}
				payload={5}
				segments={stackSegs}
				flame={burning ? 1 : 0}
				flicker={(t * 4.3) % 1}
			/>
		{:else}
			<circle cx={head.x} cy={head.y} r="5" fill="var(--rk-gravity)" opacity="0.9" />
		{/if}
	</g>

	<!-- labels on the panel -->
	<Readout id="axis-labels">
		{#each [50, 100, 150, 200] as h (h)}
			<T x={sx(0) - 8} y={sy(h) + 4} text={String(h)} size={10} muted anchor="end" />
		{/each}
		<T x={sx(0) - 8} y={sy(240) + 4} text="km up" size={10} muted anchor="start" />
		<T
			x={PANEL.x + PANEL.w - 18}
			y={sy(ORBIT_H) - 7}
			text="orbit height {ORBIT_H} km"
			size={11}
			muted
			anchor="end"
		/>
		{#each [1000, 2000, 3000] as d (d)}
			<T
				x={sx(d)}
				y={GROUND + 18}
				text="{d.toLocaleString('en-US')} km"
				size={10}
				muted
				anchor="middle"
			/>
		{/each}
		<T
			x={sx(0)}
			y={GROUND + 36}
			text="distance round the Earth · heights stretched about 11×"
			size={10}
			muted
		/>
		<T x={sx(0) + 20} y={sy(20) + 4} text="the dense air" size={11} muted />
		{#each separations as s (s.i)}
			<T
				x={s.p.x + 8}
				y={s.p.y + 16}
				text="{vehicle.stages[s.i].name} dropped"
				size={11}
				muted
				opacity={tf >= s.s ? 1 : 0}
			/>
		{/each}
	</Readout>

	<!-- ---------------------------------------------------------------- card -->
	<Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />
	<Readout id="title">
		<T
			x={CL}
			y={CARD.y + 32}
			text={phase === 'saturn' ? "Apollo 11's Saturn V" : 'Your rocket'}
			size={16}
			weight={700}
		/>
		<T
			x={CL}
			y={CARD.y + 50}
			text="{Math.round(liftoff).toLocaleString('en-US')} t at liftoff · {vehicle.stages
				.length} stage{vehicle.stages.length > 1 ? 's' : ''} · rocket equation {fmt(
				ideal / 1000,
				1
			)} km/s"
			size={11}
			muted
		/>
	</Readout>
	<Readout id="clock">
		<T x={CL} y={CARD.y + 80} text={clock(tf)} size={14} weight={700} />
		<T x={CR} y={CARD.y + 80} text={stageName} size={12} muted anchor="end" />
	</Readout>
	<Readout id="height" order={2} label="Height" value="{Math.round(now.h / 1000)} km">
		<T x={CL} y={CARD.y + 104} text="Height" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 104}
			text="{Math.round(Math.max(0, now.h) / 1000)} km"
			size={14}
			weight={600}
			anchor="end"
		/>
	</Readout>
	<Readout
		id="speed"
		order={1}
		label="Speed"
		value="{fmt(now.v / 1000, 2)} of {fmt(V_ORBIT, 1)} km/s"
		color="var(--rk-speed)"
	>
		<T x={CL} y={CARD.y + 126} text="Speed (orbit needs {fmt(V_ORBIT, 2)})" size={12} muted />
		<T
			x={CR}
			y={CARD.y + 126}
			text="{fmt(now.v / 1000, 2)} km/s"
			size={14}
			weight={700}
			anchor="end"
			color="var(--rk-speed)"
		/>
	</Readout>

	<line x1={CL} x2={CR} y1={CARD.y + 146} y2={CARD.y + 146} stroke="var(--border)" />
	<Readout id="budget-title">
		<T x={CL} y={CARD.y + 170} text="The Δv budget so far" size={13} weight={700} />
	</Readout>

	{#each rows as r, i (r.id)}
		{@const y = CARD.y + 196 + i * 26}
		<rect
			x={BAR.x}
			y={y - 11}
			width={Math.max(1, bx(Math.min(10.5, r.v)))}
			height="14"
			rx="3"
			fill={r.color}
			opacity={r.id === 'v' || r.id === 'b' ? 0.9 : 0.75}
		/>
		<Readout id="row-{r.id}">
			<T
				x={CL}
				{y}
				text={r.label}
				size={12}
				muted={r.id !== 'v'}
				weight={r.id === 'v' ? 700 : 500}
			/>
			<T x={CR} {y} text={fmt(r.v, 2)} size={12} weight={600} anchor="end" />
		</Readout>
	{/each}
	<line
		x1={BAR.x + bx(V_ORBIT)}
		x2={BAR.x + bx(V_ORBIT)}
		y1={CARD.y + 178}
		y2={CARD.y + 344}
		stroke="var(--stage-ink)"
		stroke-dasharray="3 3"
		opacity="0.6"
	/>
	<Readout id="orbit-line">
		<T x={BAR.x + bx(V_ORBIT)} y={CARD.y + 358} text="orbit" size={10} muted anchor="middle" />
	</Readout>
	<Readout
		id="losses"
		order={3}
		label="Losses"
		value="gravity {fmt(tally.gravity, 2)}, drag {fmt(tally.drag, 2)}, steering {fmt(
			tally.steering,
			2
		)} km/s"
	/>

	<line x1={CL} x2={CR} y1={CARD.y + 374} y2={CARD.y + 374} stroke="var(--border)" />
	<Readout
		id="verdict"
		order={4}
		label="Result"
		value={done ? verdict : 'flying…'}
		note={done ? verdictNote : undefined}
		color={done ? (flight.outcome === 'orbit' ? 'var(--rk-spin)' : 'var(--rk-gravity)') : undefined}
	>
		<T
			x={CL}
			y={CARD.y + 402}
			text={done ? verdict : 'Flying…'}
			size={15}
			weight={700}
			muted={!done}
			color={done
				? flight.outcome === 'orbit'
					? 'var(--rk-spin)'
					: 'var(--rk-gravity)'
				: undefined}
		/>
		<T x={CL} y={CARD.y + 422} text={done ? verdictNote : ''} size={12} muted />
	</Readout>
	<Readout id="notes">
		{#if phase === 'saturn'}
			<T
				x={CL}
				y={CARD.y + 458}
				text="Real flight (NASA report): orbit at 7.79 km/s,"
				size={11}
				muted
			/>
			<T x={CL} y={CARD.y + 474} text="191 km up, T+11:49." size={11} muted />
			<T
				x={CL}
				y={CARD.y + 500}
				text="Rocket equation on its masses: {fmt(ideal / 1000, 2)} km/s;"
				size={11}
				muted
			/>
			<T
				x={CL}
				y={CARD.y + 516}
				text="the first stage gets less at sea level, where"
				size={11}
				muted
			/>
			<T x={CL} y={CARD.y + 532} text="the air pushes back on its exhaust." size={11} muted />
		{:else}
			<T
				x={CL}
				y={CARD.y + 458}
				text="{fmt(fuel, 0)} t of propellant, exhaust {fmt(ve, 1)} km/s"
				size={11}
				muted
			/>
			<T
				x={CL}
				y={CARD.y + 474}
				text="10 t payload; tanks 10% of their propellant"
				size={11}
				muted
			/>
			{#each vehicle.stages as s, i (i)}
				<T
					x={CL}
					y={CARD.y + 500 + i * 16}
					text="stage {i + 1}: {Math.round((s.m0 - s.mf) / 1000).toLocaleString(
						'en-US'
					)} t propellant, Δv {fmt((s.veVac * Math.log(s.m0 / s.mf)) / 1000, 2)} km/s"
					size={11}
					muted
				/>
			{/each}
		{/if}
	</Readout>
</g>
