<script lang="ts">
	/**
	 * One stop from 100 km/h, replayed in real time (faster on snow): the car on the road with
	 * where it will stop and where the peak friction would have stopped it, the car's and the
	 * rim's speeds, and the slip (with the brake torque and the ABS band when ABS is on).
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, linePath, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ABS_HIGH, ABS_LOW, at, brake, ideal, peak, T_MAX, type Surface } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const surface = $derived(String(params.surface ?? 'dry') as Surface);
	const pedal = $derived(Number(step.hints?.pedal ?? params.pedal ?? 0.3));
	const abs = $derived(step.hints?.abs === true);
	const run = $derived(brake({ surface, pedal, abs }));
	const locked = $derived(brake({ surface, pedal: 1, abs: false }));
	const V0 = 100 / 3.6;
	const best = $derived(ideal(V0, peak(surface).mu));

	// Replays from the start when the stop changes, the step changes or "Brake again" is pressed.
	let t0 = $state(0);
	$effect(() => {
		void run;
		void step.id;
		void params.replay;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	/** Long stops (snow) are played faster, so that every stop lasts at most 6 s. */
	const rate = $derived(Math.max(1, Math.ceil(run.time / 6)));
	/** Half a second at 100 km/h before the foot lands. */
	const LEAD = 0.5;
	const time = $derived(
		reduced ? run.time : Math.min(run.time, Math.max(0, (local - LEAD) * rate))
	);
	const now = $derived(at(run, time));
	const done = $derived(time >= run.time);
	const drawn = $derived(run.samples.filter((p) => p.t <= time));

	// ---- the road -------------------------------------------------------------------------------
	const roadStep = $derived(Math.max(locked.distance, run.distance) > 150 ? 50 : 10);
	const roadLen = $derived(
		Math.ceil((Math.max(locked.distance, run.distance) * 1.08) / roadStep) * roadStep
	);
	const rx = $derived(scale([0, roadLen], [70, 910]));
	const ROAD_Y = 112;

	// ---- the plots --------------------------------------------------------------------------------
	const tMax = $derived(niceMax(Math.max(locked.time, run.time) * 1.02));
	const sxL = $derived(scale([0, tMax], [80, 450]));
	const sxR = $derived(scale([0, tMax], [550, 920]));
	const syV = scale([0, 110], [520, 210]);
	const syS = scale([0, 100], [520, 210]);
	const kmh = (v: number) => v * 3.6;
	const top = $derived(peak(surface));
	const releasing = $derived(now.releasing);
</script>

<g class="ab-brake">
	<!-- road -->
	<line x1="70" y1={ROAD_Y} x2="910" y2={ROAD_Y} stroke="var(--ab-road)" stroke-width="3" />
	{#each Array.from({ length: Math.floor(roadLen / roadStep) + 1 }, (_, i) => i * roadStep) as d (d)}
		<line x1={rx(d)} y1={ROAD_Y} x2={rx(d)} y2={ROAD_Y + 6} stroke="var(--ab-road)" />
		<Readout id="ab-tick-{d}">
			<Label x={rx(d)} y={ROAD_Y + 20} text="{d} m" size={11} muted anchor="middle" />
		</Readout>
	{/each}
	<!-- best possible -->
	<line
		x1={rx(best)}
		y1={ROAD_Y - 52}
		x2={rx(best)}
		y2={ROAD_Y}
		stroke="var(--ab-band)"
		stroke-dasharray="4 3"
		stroke-width="2"
	/>
	<Readout id="ab-best" order={5} label="Best possible stop" value="{best.toFixed(0)} m">
		<Label
			x={rx(best)}
			y={ROAD_Y - 58}
			text="peak grip: {best.toFixed(0)} m"
			anchor="middle"
			size={12}
			color="var(--ab-band)"
		/>
	</Readout>
	{#if done}
		<line
			x1={rx(run.distance)}
			y1={ROAD_Y - 52}
			x2={rx(run.distance)}
			y2={ROAD_Y}
			stroke="var(--text)"
			stroke-width="2.5"
		/>
	{/if}
	<!-- the car, side view -->
	<g transform="translate({rx(now.x)} {ROAD_Y})">
		<rect x="-34" y="-30" width="40" height="16" rx="5" fill="var(--text-muted)" />
		<rect x="-24" y="-40" width="22" height="12" rx="4" fill="var(--text-muted)" opacity="0.7" />
		<circle cx="-24" cy="-9" r="8" fill="var(--text)" />
		<circle
			cx="-2"
			cy="-9"
			r="8"
			fill={now.slip > 0.98 && time > 0 ? 'var(--ab-lock)' : 'var(--text)'}
		/>
	</g>

	<!-- speed plot -->
	<Axes sx={sxL} sy={syV} xLabel="time (s)" yLabel="speed (km/h)" />
	<path
		d={linePath(
			drawn,
			(p) => p.t,
			(p) => kmh(p.v),
			sxL,
			syV
		)}
		fill="none"
		stroke="var(--text)"
		stroke-width="2.5"
	/>
	<path
		d={linePath(
			drawn,
			(p) => p.t,
			(p) => kmh(p.rim),
			sxL,
			syV
		)}
		fill="none"
		stroke="var(--ab-rim)"
		stroke-width="2"
	/>
	<Readout id="ab-legend" order={6} label="Lines" value="black: the car; purple: the wheel’s rim">
		<Label x={sxL(tMax) - 4} y={222} text="car" anchor="end" weight={600} />
		<Label
			x={sxL(tMax) - 4}
			y={242}
			text="wheel rim (ωR)"
			anchor="end"
			color="var(--ab-rim)"
			weight={600}
		/>
	</Readout>

	<!-- slip plot -->
	<Axes sx={sxR} sy={syS} xLabel="time (s)" yLabel="slip (%)" />
	{#if abs}
		<rect
			x={sxR(0)}
			y={syS(ABS_HIGH * 100)}
			width={sxR(tMax) - sxR(0)}
			height={syS(ABS_LOW * 100) - syS(ABS_HIGH * 100)}
			fill="var(--ab-band)"
			opacity="0.15"
		/>
		<path
			d={linePath(
				drawn,
				(p) => p.t,
				(p) => (100 * p.torque) / T_MAX,
				sxR,
				syS
			)}
			fill="none"
			stroke="var(--text-muted)"
			stroke-width="1.5"
		/>
		<Readout
			id="ab-torque"
			order={7}
			label="Grey line"
			value="brake torque, as a % of a full press"
		>
			<Label x={sxR(tMax) - 4} y={222} text="brake torque (% of full)" anchor="end" muted />
		</Readout>
	{/if}
	<line
		x1={sxR(0)}
		y1={syS(top.slip * 100)}
		x2={sxR(tMax)}
		y2={syS(top.slip * 100)}
		stroke={`var(--ab-${surface})`}
		stroke-dasharray="5 4"
	/>
	<Label
		x={sxR(tMax) - 4}
		y={syS(top.slip * 100) - (abs ? 30 : 6)}
		text="peak grip at {Math.round(top.slip * 100)}%"
		anchor="end"
		size={11}
		color={`var(--ab-${surface})`}
	/>
	<path
		d={linePath(
			drawn,
			(p) => p.t,
			(p) => 100 * p.slip,
			sxR,
			syS
		)}
		fill="none"
		stroke="var(--ab-rim)"
		stroke-width="2.5"
	/>

	<!-- readouts -->
	<Readout id="ab-now" order={1} label="Speed" value="{kmh(now.v).toFixed(0)} km/h">
		<Label
			x={70}
			y={30}
			text="{kmh(now.v).toFixed(0)} km/h"
			anchor="start"
			size={18}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="ab-slipnow"
		order={2}
		label="Slip"
		value={now.slip > 0.98 && time > 0 ? 'locked' : `${Math.round(now.slip * 100)}%`}
	>
		<Label
			x={200}
			y={30}
			text={now.slip > 0.98 && time > 0 ? 'wheel locked' : `slip ${Math.round(now.slip * 100)}%`}
			anchor="start"
			size={16}
			weight={600}
			color={now.slip > 0.98 && time > 0 ? 'var(--ab-lock)' : undefined}
			tabular
		/>
	</Readout>
	{#if abs && !done}
		<Readout id="ab-valve" order={3} label="ABS valve" value={releasing ? 'releasing' : 'applying'}>
			<Label
				x={380}
				y={30}
				text="ABS: {releasing ? 'releasing' : 'applying'}"
				anchor="start"
				size={16}
				color={releasing ? 'var(--ab-band)' : undefined}
			/>
		</Readout>
	{/if}
	<Readout
		id="ab-dist"
		order={4}
		label="Stopping distance"
		value={done
			? `${run.distance.toFixed(0)} m in ${run.time.toFixed(1)} s`
			: `${now.x.toFixed(0)} m so far`}
	>
		<Label
			x={910}
			y={30}
			text={done
				? `stopped in ${run.distance.toFixed(0)} m (${run.time.toFixed(1)} s)`
				: `${now.x.toFixed(0)} m`}
			anchor="end"
			size={16}
			weight={done ? 700 : 400}
			tabular
		/>
	</Readout>
	{#if rate > 1 && !done}
		<Readout id="ab-rate">
			<Label x={910} y={52} text="played {rate}× faster" anchor="end" size={12} muted />
		</Readout>
	{/if}
</g>
