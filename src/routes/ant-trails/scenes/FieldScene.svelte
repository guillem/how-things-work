<script lang="ts">
	/**
	 * The field: the nest, the sugar and 80 ants, simulated in real time from the start of the step
	 * (or from the last restart), with the scent they lay drawn under them. Some steps start from a
	 * field where a trail has already formed (90 simulated seconds). In "move" the sugar can be
	 * dragged; in "pebble" a button drops a pebble on the trail. With reduced motion the field is
	 * shown after a fixed stretch of simulated time.
	 */
	import { untrack } from 'svelte';
	import { Handle, Label } from '#lib/draw/index.ts';
	import type { Point } from '#lib/draw/math.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CELL,
		COLS,
		dropPebble,
		field,
		FIELD_H,
		FIELD_W,
		NEST,
		pebbleSpot,
		runField,
		scentOf,
		SUGAR_R,
		type Field
	} from '../model';
	import { ANT, GRAIN, SIM_SPEED } from './ant';
	import PlaceLabel from './PlaceLabel.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'line'));
	const scentOn = $derived(
		phase === 'wander' ? false : phase === 'scent' ? params.scent !== false : true
	);
	/** Steps that open on a field where the trail has already formed. */
	const formed = $derived(phase === 'line' || phase === 'move' || phase === 'pebble');
	const pebbles = $derived(phase === 'pebble' ? Number(params.pebble ?? 0) : 0);
	const PRE = 90;

	const FX = 30;
	const FY = 30;

	// ---- the simulation, advanced to the stage's clock -----------------------------------------
	let f: Field = field();
	/** The simulated time the current run started from, and the stage time it started at. */
	let simT = 0;
	let t0 = 0;
	let frame = $state(0);
	let resets = $state(0);
	/** Restarts: a new step, the scent switched, a pebble dropped. */
	$effect(() => {
		void step.id;
		const on = scentOn;
		const pre = formed;
		const drops = pebbles;
		untrack(() => {
			f = field({ scent: on });
			if (pre) runField(f, PRE);
			if (drops > 0) dropPebble(f, pebbleSpot(f));
			simT = f.time;
			t0 = t;
			sugar = { ...f.sugar };
			resets++;
		});
	});
	$effect(() => {
		void resets;
		const target = reduced ? simT + (formed ? 60 : 90) : simT + SIM_SPEED * Math.max(0, t - t0);
		untrack(() => {
			// Catch up, at most ten simulated seconds per frame (all at once for reduced motion).
			const until = Math.min(target, reduced ? Infinity : f.time + 10);
			if (until > f.time) runField(f, until);
			frame++;
		});
	});

	// ---- dragging the sugar --------------------------------------------------------------------
	let sugar = $state({ x: 740, y: 170 });
	const clampX = (x: number) => Math.min(FIELD_W - 40, Math.max(260, x));
	const clampY = (y: number) => Math.min(FIELD_H - 40, Math.max(40, y));
	function moveSugar(x: number, y: number) {
		sugar = { x: clampX(x), y: clampY(y) };
		f.sugar = { ...sugar };
		frame++;
	}
	/** With reduced motion, a moved sugar shows the field a minute later. */
	function settle() {
		if (!reduced) return;
		simT = f.time;
		resets++;
	}
	const reach = $derived(Math.round(Math.hypot(sugar.x - NEST.x, sugar.y - NEST.y)));

	// ---- what is drawn ---------------------------------------------------------------------------
	const ants = $derived.by(() => {
		void frame;
		const out: { x: number; y: number; a: number; c: boolean }[] = [];
		for (let i = 0; i < f.x.length; i++)
			if (f.time >= f.start[i])
				out.push({
					x: FX + f.x[i],
					y: FY + f.y[i],
					a: (f.heading[i] * 180) / Math.PI,
					c: f.carrying[i] === 1
				});
		return out;
	});
	const scentCells = $derived.by(() => {
		void frame;
		const out: { i: number; x: number; y: number; o: number }[] = [];
		for (let i = 0; i < f.scentMap.length; i++) {
			const v = scentOf(f, i);
			if (v > 0.4)
				out.push({
					i,
					x: FX + ((i % COLS) + 0.5) * CELL,
					y: FY + (Math.floor(i / COLS) + 0.5) * CELL,
					o: Math.min(0.85, 0.12 + v / 12)
				});
		}
		return out;
	});
	const home = $derived.by(() => {
		void frame;
		return f.home;
	});
	const pebble = $derived.by(() => {
		void frame;
		return f.pebbles[0];
	});
</script>

<g class="at-field">
	<rect x={FX} y={FY} width={FIELD_W} height={FIELD_H} rx="16" fill="var(--at-ground)" />

	<!-- the scent -->
	{#each scentCells as c (c.i)}
		<circle cx={c.x} cy={c.y} r={CELL * 0.62} fill="var(--at-scent)" opacity={c.o} />
	{/each}

	<!-- nest, sugar, pebble -->
	<circle cx={FX + NEST.x} cy={FY + NEST.y} r={NEST.r + 14} fill="var(--at-nest)" />
	<circle cx={FX + NEST.x} cy={FY + NEST.y} r="9" fill="var(--at-hole)" />
	<PlaceLabel
		id="at-nest-name"
		x={FX + NEST.x}
		y={FY + NEST.y + NEST.r + 40}
		phone={{ x: FX + NEST.x, y: FY + NEST.y + NEST.r + 60 }}
		text="nest"
	/>

	{#if pebble}
		<circle
			cx={FX + pebble.x}
			cy={FY + pebble.y}
			r={pebble.r}
			fill="var(--at-pebble)"
			stroke="var(--at-pebble-edge)"
			stroke-width="2"
		/>
	{/if}

	<!-- the ants -->
	{#each ants as a, i (i)}
		<g transform="translate({a.x} {a.y}) rotate({a.a})">
			<path d={ANT} fill="var(--at-ant)" stroke="var(--at-ant)" stroke-width="1.2" />
			{#if a.c}<rect {...GRAIN} fill="var(--at-sugar)" stroke="var(--at-sugar-edge)" />{/if}
		</g>
	{/each}

	{#if phase === 'move'}
		<Handle
			x={FX + sugar.x}
			y={FY + sugar.y}
			r={16}
			color="var(--at-handle)"
			label="The sugar"
			value={reach}
			min={0}
			max={900}
			valuetext="distance from the nest: {reach}"
			onmove={(p: Point) => moveSugar(p.x - FX, p.y - FY)}
			onkey={(k) => {
				const d = k === 'start' ? -900 : k === 'end' ? 900 : k * 10;
				moveSugar(sugar.x + d, sugar.y);
				settle();
			}}
			ondragend={settle}
		/>
	{/if}

	<!-- the sugar, over its handle in "move" -->
	<g transform="translate({FX + sugar.x} {FY + sugar.y})" pointer-events="none">
		{#if phase !== 'move'}<circle r={SUGAR_R} fill="var(--at-sugar-bed)" />{/if}
		{#each [[-9, -6], [4, -10], [8, 4], [-4, 7], [-12, 5], [12, -3]] as [x, y], i (i)}
			<rect
				x={x - 4}
				y={y - 4}
				width="8"
				height="8"
				rx="1.5"
				fill="var(--at-sugar)"
				stroke="var(--at-sugar-edge)"
			/>
		{/each}
	</g>
	<PlaceLabel
		id="at-sugar-name"
		x={FX + sugar.x}
		y={FY + sugar.y + SUGAR_R + 26}
		phone={{ x: FX + sugar.x, y: FY + sugar.y + SUGAR_R + 44 }}
		text="sugar"
	/>

	<!-- read-outs -->
	<Readout id="at-home" order={1} label="Sugar carried home" value="{home} grains">
		<Label
			x={FX}
			y={FY + FIELD_H + 40}
			text="sugar carried home: {home} grains"
			anchor="start"
			size={16}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout
		id="at-scent"
		order={2}
		label="Scent"
		value={scentOn ? 'ants carrying sugar leave a scent' : 'no scent at all'}
	>
		<g transform="translate({FX + 420} {FY + FIELD_H + 35})">
			<rect x="-6" y="-6" width="12" height="12" rx="4" fill="var(--at-scent)" opacity="0.7" />
			<Label
				x={14}
				y={5}
				text={scentOn ? 'scent left by ants carrying sugar' : 'no scent at all'}
				anchor="start"
				size={14}
				muted
			/>
		</g>
	</Readout>
	{#if phase === 'move'}
		<Readout id="at-drag" order={3} label="Try it" value="drag the sugar somewhere else">
			<Label
				x={FX + FIELD_W}
				y={FY + FIELD_H + 40}
				text="drag the sugar"
				anchor="end"
				size={14}
				weight={600}
				color="var(--at-handle)"
			/>
		</Readout>
	{/if}
</g>
