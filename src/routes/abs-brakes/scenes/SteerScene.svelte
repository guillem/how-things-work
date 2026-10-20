<script lang="ts">
	/**
	 * Brake and swerve, seen from above at true scale: the driver stamps on the brake and half a
	 * second later changes lanes (an 8° slip angle, out and back) to pass a stopped car about 30 m
	 * ahead. Without ABS the
	 * wheels lock first and the car slides straight on.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { at, brake, type Surface } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const surface = $derived(String(params.surface ?? 'dry') as Surface);
	const abs = $derived(params.abs !== false);
	const STEER = 8;
	const STEER_AT = 0.5;
	const OBSTACLE = 32;
	const LANE = 3.5;
	const run = $derived(
		brake({ surface, pedal: 1, abs, steer: STEER, steerAt: STEER_AT, lane: LANE })
	);

	let t0 = $state(0);
	$effect(() => {
		void run;
		void step.id;
		void params.replay;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	const LEAD = 0.5;

	// Where the car meets the obstacle, if it does: its nose reaches the obstacle's near end while
	// the two overlap sideways (each 1.8 m wide).
	const LENGTH = 4.5;
	const WIDTH = 1.8;
	const hit = $derived(
		run.samples.find((p) => p.x + LENGTH / 2 >= OBSTACLE && Math.abs(p.y) < WIDTH) ?? null
	);
	const end = $derived(hit ? hit.t : run.time);
	const time = $derived(reduced ? end : Math.min(end, Math.max(0, local - LEAD)));
	const now = $derived(at(run, time));
	const over = $derived(time >= end);

	// ---- true-scale view: 14 px per metre ---------------------------------------------------------
	const U = 14;
	const X0 = 60;
	const YC = 380;
	const PX = (x: number) => X0 + x * U;
	const PY = (y: number) => YC - y * U;
	const trail = $derived(run.samples.filter((p) => p.t <= time));
	const trailPath = $derived(
		trail.map((p, i) => `${i ? 'L' : 'M'}${PX(p.x).toFixed(1)} ${PY(p.y).toFixed(1)}`).join(' ')
	);
	const lockedNow = $derived(now.slip > 0.98 && time > 0);
	const steering = $derived(time >= STEER_AT);
	const deg = (r: number) => (r * 180) / Math.PI;
</script>

<g class="ab-steer">
	<!-- the road: two lanes, the car in the right-hand one -->
	<rect
		x={PX(-2)}
		y={PY(LANE * 1.5)}
		width={PX(64) - PX(-2)}
		height={LANE * 2 * U}
		fill="var(--surface-2)"
	/>
	<line
		x1={PX(-2)}
		y1={PY(LANE / 2)}
		x2={PX(64)}
		y2={PY(LANE / 2)}
		stroke="var(--ab-road)"
		stroke-width="2"
		stroke-dasharray="14 12"
	/>
	<line
		x1={PX(-2)}
		y1={PY(LANE * 1.5)}
		x2={PX(64)}
		y2={PY(LANE * 1.5)}
		stroke="var(--ab-road)"
		stroke-width="2"
	/>
	<line
		x1={PX(-2)}
		y1={PY(-LANE / 2)}
		x2={PX(64)}
		y2={PY(-LANE / 2)}
		stroke="var(--ab-road)"
		stroke-width="2"
	/>
	{#each [0, 10, 20, 30, 40, 50, 60] as d (d)}
		<Readout id="ab-m-{d}">
			<Label x={PX(d)} y={PY(-LANE / 2) + 22} text="{d} m" size={11} muted anchor="middle" />
		</Readout>
	{/each}

	<!-- the obstacle: a stopped car -->
	<rect
		x={PX(OBSTACLE)}
		y={PY(WIDTH / 2)}
		width={LENGTH * U}
		height={WIDTH * U}
		rx="5"
		fill="var(--text-muted)"
	/>
	<Label
		x={PX(OBSTACLE + LENGTH / 2)}
		y={PY(WIDTH / 2) - 10}
		text="stopped car"
		anchor="middle"
		size={12}
		muted
	/>

	<!-- the path and the car -->
	<path
		d={trailPath}
		fill="none"
		stroke={abs ? 'var(--ab-band)' : 'var(--ab-lock)'}
		stroke-width="2.5"
		stroke-dasharray="6 4"
	/>
	<g transform="translate({PX(now.x)} {PY(now.y)}) rotate({-deg(now.heading)})">
		<rect
			x={-LENGTH * U * 0.5}
			y={-WIDTH * U * 0.5}
			width={LENGTH * U}
			height={WIDTH * U}
			rx="6"
			fill={`var(--ab-${surface})`}
		/>
		{#each [-1, 1] as side (side)}
			<!-- front wheels turn when the driver steers; rear wheels don't -->
			<rect
				x={LENGTH * U * 0.28 - 7}
				y={side * WIDTH * U * 0.5 - 3}
				width="14"
				height="6"
				rx="2"
				fill={lockedNow ? 'var(--ab-lock)' : 'var(--text)'}
				transform="rotate({steering ? -STEER * 2 : 0} {LENGTH * U * 0.28} {side * WIDTH * U * 0.5})"
			/>
			<rect
				x={-LENGTH * U * 0.28 - 7}
				y={side * WIDTH * U * 0.5 - 3}
				width="14"
				height="6"
				rx="2"
				fill={lockedNow ? 'var(--ab-lock)' : 'var(--text)'}
			/>
		{/each}
	</g>

	<!-- readouts -->
	<Readout id="ab-steer-speed" order={1} label="Speed" value="{(now.v * 3.6).toFixed(0)} km/h">
		<Label
			x={60}
			y={60}
			text="{(now.v * 3.6).toFixed(0)} km/h"
			anchor="start"
			size={18}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="ab-steer-state"
		order={2}
		label="Wheels"
		value={lockedNow
			? 'locked: the steering does nothing'
			: steering
				? 'turning and steering'
				: 'braking'}
	>
		<Label
			x={200}
			y={60}
			text={lockedNow
				? 'wheels locked: steering does nothing'
				: steering
					? 'wheels turning: steering works'
					: 'braking…'}
			anchor="start"
			size={16}
			color={lockedNow ? 'var(--ab-lock)' : undefined}
		/>
	</Readout>
	{#if over}
		<Readout
			id="ab-steer-end"
			order={3}
			label="Result"
			value={hit
				? `hits the stopped car at ${(hit.v * 3.6).toFixed(0)} km/h`
				: `misses it, stops in ${run.distance.toFixed(0)} m`}
		>
			<Label
				x={900}
				y={60}
				text={hit
					? `hits the stopped car at ${(hit.v * 3.6).toFixed(0)} km/h`
					: `swerves past and stops after ${run.distance.toFixed(0)} m`}
				anchor="end"
				size={16}
				weight={700}
				color={hit ? 'var(--ab-lock)' : 'var(--ab-band)'}
			/>
		</Readout>
	{/if}
</g>
