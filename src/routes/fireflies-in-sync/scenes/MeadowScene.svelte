<script lang="ts">
	/**
	 * The meadow: 160 fireflies, simulated in real time from the start of the step (or from the
	 * last restart). Each glows for a moment after it flashes. A bar shows how in step they are; in
	 * some steps one firefly is ringed and its clock drawn beside the meadow. Dragging across the
	 * meadow scrambles the fireflies you pass. With reduced motion the meadow is shown after a
	 * minute of simulated time.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		advance,
		FIELD_H,
		FIELD_W,
		inStep,
		run,
		scramble,
		scrambleSpot,
		swarm,
		type Swarm
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'meadow'));
	const nudge = $derived(Number(step.hints?.nudge ?? params.nudge ?? 0.002));
	const showClock = $derived(phase === 'clock' || phase === 'noleader');
	const followed = $derived(phase === 'noleader' ? (Number(params.other ?? 0) * 37) % 160 : 0);

	// ---- the simulation, advanced to the stage's clock ---------------------------------------------
	let s: Swarm = swarm();
	let simT = 0;
	let t0 = 0;
	let frame = $state(0);
	/** Bumped on every restart, so the advancing effect runs again (needed for reduced motion). */
	let resets = $state(0);
	// Restart on a new step or "Start the meadow again" (with reduced motion, also on a change of
	// the hurrying, since the frozen frame is a fresh minute). The scrambling step starts from a
	// meadow that has already fallen into step.
	$effect(() => {
		void step.id;
		void params.again;
		if (reduced) void nudge;
		untrack(() => {
			s = swarm();
			if (phase === 'scramble') run(s, nudge, 60);
			s.time = 0;
			s.last.fill(-9);
			simT = 0;
			t0 = t;
			resets++;
		});
	});
	// A scramble from the button: a patch of 120 around a spot that moves with each press.
	$effect(() => {
		const n = Number(params.shake ?? 0);
		if (!n) return;
		untrack(() => {
			const spot = scrambleSpot(n);
			scramble(s, spot.x, spot.y, 120, n);
			frame++;
		});
	});
	$effect(() => {
		void resets;
		const target = reduced ? 60 : Math.max(0, t - t0);
		const k = nudge;
		untrack(() => {
			// Catch up, at most ten seconds at a time (all at once for reduced motion's frozen frame).
			const step = Math.min(target - simT, reduced ? Infinity : 10);
			if (step > 0) {
				advance(s, k, step);
				simT += step;
			}
			frame++;
		});
	});
	const flies = $derived.by(() => {
		void frame;
		return Array.from(s.phase, (p, i) => ({
			x: s.x[i],
			y: s.y[i],
			glow: Math.max(0, 1 - (s.time - s.last[i]) / 0.25),
			p
		}));
	});
	const sync = $derived.by(() => {
		void frame;
		return inStep(s);
	});

	// ---- scrambling by dragging -------------------------------------------------------------
	const FX = 30;
	const FY = 30;
	let dragging = false;
	let scrambles = 0;
	function at(e: PointerEvent) {
		const svg = (e.currentTarget as SVGGraphicsElement).ownerSVGElement;
		const ctm = svg?.getScreenCTM();
		if (!ctm) return null;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
		return { x: p.x - FX, y: p.y - FY };
	}
	function down(e: PointerEvent) {
		if (phase !== 'scramble') return;
		dragging = true;
		(e.currentTarget as Element).setPointerCapture?.(e.pointerId);
		move(e);
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const p = at(e);
		if (!p) return;
		scramble(s, p.x, p.y, 60, 1000 + ++scrambles);
		frame++;
	}
	function up() {
		dragging = false;
	}

	// ---- the followed firefly's clock ----------------------------------------------------------
	const CX = 880;
	const CY = 590;
	const hand = $derived(flies[followed]?.p ?? 0);
</script>

<g class="ff-meadow">
	<rect x={FX} y={FY} width={FIELD_W} height={FIELD_H} rx="14" fill="var(--ff-night)" />
	<rect x={FX} y={FY + FIELD_H - 60} width={FIELD_W} height="60" rx="14" fill="var(--ff-grass)" />
	{#each flies as f, i (i)}
		{#if f.glow > 0}
			<circle
				cx={FX + f.x}
				cy={FY + f.y}
				r={4 + 10 * f.glow}
				fill="var(--ff-flash)"
				opacity={0.25 * f.glow}
			/>
		{/if}
		<circle
			cx={FX + f.x}
			cy={FY + f.y}
			r="3.2"
			fill={f.glow > 0 ? 'var(--ff-flash)' : 'var(--ff-rest)'}
		/>
	{/each}
	{#if showClock}
		<circle
			cx={FX + flies[followed].x}
			cy={FY + flies[followed].y}
			r="13"
			fill="none"
			stroke="#ffffff"
			stroke-width="2"
		/>
	{/if}
	<rect
		x={FX}
		y={FY}
		width={FIELD_W}
		height={FIELD_H}
		fill="transparent"
		style:cursor={phase === 'scramble' ? 'crosshair' : 'default'}
		role="presentation"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	/>

	<!-- how in step -->
	<Readout id="ff-sync" order={1} label="In step" value="{Math.round(sync * 100)}%">
		<Label x={FX} y={FY + FIELD_H + 34} text="in step" anchor="start" size={15} weight={600} />
		<rect
			x={FX + 74}
			y={FY + FIELD_H + 20}
			width="400"
			height="18"
			rx="9"
			fill="var(--surface-2)"
		/>
		<rect
			x={FX + 74}
			y={FY + FIELD_H + 20}
			width={400 * sync}
			height="18"
			rx="9"
			fill="var(--ff-meter)"
		/>
		<Label
			x={FX + 486}
			y={FY + FIELD_H + 34}
			text="{Math.round(sync * 100)}%"
			anchor="start"
			size={15}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="ff-nudge"
		order={2}
		label="Hurry"
		value={nudge === 0
			? 'none: each firefly keeps its own time'
			: `hurrying ${Math.round(nudge * 500)} out of 10`}
	>
		<Label
			x={FX + 560}
			y={FY + FIELD_H + 34}
			text={nudge === 0
				? 'no hurrying: each keeps its own time'
				: `hurrying: ${Math.round(nudge * 500)} out of 10`}
			anchor="start"
			size={13}
			muted
		/>
	</Readout>

	<!-- one firefly's clock -->
	{#if showClock}
		<Readout
			id="ff-clock"
			order={3}
			label="The ringed firefly’s clock"
			value="the hand is {Math.round(hand * 12)} o’clock of the way round"
		>
			<circle
				cx={CX}
				cy={CY - 40}
				r="34"
				fill="var(--surface-2)"
				stroke="var(--text)"
				stroke-width="2"
			/>
			<line x1={CX} y1={CY - 74} x2={CX} y2={CY - 66} stroke="var(--text)" stroke-width="3" />
			<line
				x1={CX}
				y1={CY - 40}
				x2={CX + 28 * Math.sin(2 * Math.PI * hand)}
				y2={CY - 40 - 28 * Math.cos(2 * Math.PI * hand)}
				stroke={flies[followed].glow > 0 ? 'var(--ff-meter)' : 'var(--text)'}
				stroke-width="3.5"
				stroke-linecap="round"
			/>
		</Readout>
	{/if}
</g>
