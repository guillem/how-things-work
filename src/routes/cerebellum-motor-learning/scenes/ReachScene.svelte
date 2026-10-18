<script lang="ts">
	/**
	 * The reader's own reaching experiment. Left: the workspace, a start point and a target on a
	 * ring. Pressing anywhere and sweeping outward moves the cursor from the start in the
	 * direction of the movement, turned by the step's rotation; the reach ends when the cursor
	 * crosses the ring, and the hand's direction is recorded. Keyboard: arrows turn the aim,
	 * Enter or Space reaches. Right: every reach's correction (how far the hand turned against
	 * the rotation), the rotation itself, and the two-rate model doing the same sequence of
	 * reaches, with its forecast for the rest of the step.
	 *
	 * The step decides the cursor (`phaseOf`): baseline, rotated, hidden, or the recovery
	 * protocol. Before the reader has reached on this step a ghost reach loops (hand dashed,
	 * cursor solid); reduced motion shows it whole.
	 */
	import { onDestroy, untrack } from 'svelte';
	import {
		Axes,
		Label,
		clamp,
		cycle,
		scale,
		smoothstep,
		startDrag,
		toSvg
	} from '#lib/draw/index.ts';
	import type { Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { runTwoRate } from '../model';
	import {
		correctionOf,
		errorOf,
		forecast,
		phaseOf,
		READAPT,
		targetOf,
		type Reach
	} from '../experiment';
	import { reaches } from '../reaches.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- the experiment ----------------------------------------------------------
	const stepId = $derived(step.id);
	const list = $derived(reaches.list);
	const phase = $derived(phaseOf(stepId, list));
	const target = $derived(targetOf(list.length));
	const mine = $derived(list.filter((r) => r.step === stepId));
	const last = $derived(list.length > 0 ? list[list.length - 1] : undefined);
	/** The last reach, if it was made on this step (its feedback stays until the next). */
	const shown = $derived(last && last.step === stepId ? last : undefined);

	const revealCount = $derived(Number(params.reveal ?? 0));
	$effect(() => {
		const c = revealCount;
		untrack(() => {
			if (c !== reaches.shown) {
				reaches.shown = c;
				reaches.reveal();
			}
		});
	});
	/**
	 * A reach made without a cursor stays off the chart while its block goes on (the chart would
	 * otherwise be the feedback the block removes), until the reader asks to see it.
	 */
	const concealed = (r: Reach, i: number) =>
		!r.feedback && i >= reaches.revealed && r.step === stepId && !phase.feedback;
	const clearCount = $derived(Number(params.clear ?? 0));
	$effect(() => {
		const c = clearCount;
		untrack(() => {
			if (c !== reaches.cleared) {
				reaches.cleared = c;
				reaches.clear();
			}
		});
	});

	// ---- workspace geometry ---------------------------------------------------------
	const S = { x: 262, y: 486 };
	const R = 280;
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const deg = (r: number) => (r * 180) / Math.PI;
	/** Screen point at math angle `a` (degrees, counter-clockwise from east) and distance `d`. */
	const at = (a: number, d: number): Point => ({
		x: S.x + d * Math.cos(rad(a)),
		y: S.y - d * Math.sin(rad(a))
	});
	const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
	const tgt = $derived(at(target, R));
	const arc = (() => {
		const a = at(32, R);
		const b = at(148, R);
		return `M${a.x} ${a.y} A${R} ${R} 0 0 0 ${b.x} ${b.y}`;
	})();

	// ---- reaching ---------------------------------------------------------------------
	let drag = $state<{ p0: Point; d: Point } | null>(null);
	let stop: (() => void) | null = null;
	let aim = $state(0);
	let focused = $state(false);

	function record(handDir: number) {
		reaches.add({
			step: stepId,
			target,
			hand: Math.round(wrap(handDir - target) * 10) / 10,
			rotation: phase.rotation,
			feedback: phase.feedback
		});
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		const p0 = toSvg(event, event.currentTarget as Element);
		drag = { p0, d: { x: 0, y: 0 } };
		stop = startDrag(
			event,
			(p) => {
				if (!drag) return;
				const d = { x: p.x - drag.p0.x, y: p.y - drag.p0.y };
				if (Math.hypot(d.x, d.y) >= R) {
					record(deg(Math.atan2(-d.y, d.x)));
					drag = null;
					stop?.();
					return;
				}
				drag = { ...drag, d };
			},
			() => {
				drag = null;
				stop = null;
			}
		);
	}
	onDestroy(() => stop?.());

	function onkeydown(event: KeyboardEvent) {
		const big = event.shiftKey ? 10 : 2;
		const turn: Record<string, number> = {
			ArrowLeft: big,
			ArrowUp: big,
			ArrowRight: -big,
			ArrowDown: -big
		};
		if (event.key in turn) {
			aim = clamp(aim + turn[event.key], -60, 60);
		} else if (event.key === 'Enter' || event.key === ' ') {
			record(target + aim);
		} else if (event.key === 'Home') {
			aim = 0;
		} else return;
		event.preventDefault();
	}

	/** The live cursor while dragging. */
	const cursor = $derived.by(() => {
		if (!drag) return null;
		const m = { x: drag.d.x, y: -drag.d.y };
		const len = Math.hypot(m.x, m.y);
		const a = deg(Math.atan2(m.y, m.x)) + phase.rotation;
		return at(a, len);
	});

	/** The last reach's cursor end point, while its feedback is shown. */
	const endpoint = $derived(
		shown && shown.feedback ? at(shown.target + errorOf(shown), R) : undefined
	);
	const lastTarget = $derived(shown ? at(shown.target, R) : undefined);

	// ---- the ghost reach, before the reader has reached here --------------------------
	const ghost = $derived(mine.length === 0 && !drag);
	const ghostU = $derived(reduced ? 1 : smoothstep(0.1, 0.75, cycle(t, 3.2)));
	const ghostFade = $derived(reduced ? 1 : 1 - smoothstep(0.88, 1, cycle(t, 3.2)));
	const ghostHand = $derived(at(target, R * ghostU));
	const ghostCursor = $derived(at(target + phase.rotation, R * ghostU));

	// ---- chart ----------------------------------------------------------------------
	const model = $derived(runTwoRate(list));
	const ahead = $derived(stepId === 'recover' ? Math.max(20, READAPT + 40 - mine.length) : 25);
	const future = $derived(forecast(stepId, list, model[model.length - 1], ahead));
	const futurePhases = $derived.by(() => {
		// The rotation the forecast assumes, trial by trial (the model doing the reaches).
		const out: number[] = [];
		const sim: Reach[] = [...list];
		for (const st of future) {
			const p = phaseOf(stepId, sim);
			out.push(p.rotation);
			sim.push({
				step: stepId,
				target: 90,
				hand: -st.total,
				rotation: p.rotation,
				feedback: p.feedback
			});
		}
		return out;
	});
	const n = $derived(list.length);
	const xMax = $derived(Math.max(40, Math.ceil((n + ahead) / 10) * 10));
	const sx = $derived(scale([0, xMax], [596, 934]));
	/** The vertical range: −35° to 40°, widened to fit every shown correction. */
	const sy = $derived.by(() => {
		let lo = -35;
		let hi = 40;
		list.forEach((r, i) => {
			if (concealed(r, i)) return;
			lo = Math.min(lo, Math.floor((correctionOf(r) - 5) / 15) * 15);
			hi = Math.max(hi, Math.ceil((correctionOf(r) + 5) / 15) * 15);
		});
		return scale([lo, hi], [520, 150]);
	});
	const yTicks = $derived(
		Array.from(
			{ length: Math.floor(sy.domain[1] / 15) - Math.ceil(sy.domain[0] / 15) + 1 },
			(_, k) => (Math.ceil(sy.domain[0] / 15) + k) * 15
		)
	);

	const rotPath = $derived.by(() => {
		const rots = [...list.map((r) => r.rotation), ...futurePhases];
		let d = '';
		rots.forEach((r, i) => {
			d += `${i === 0 ? 'M' : 'L'}${sx(i + 0.5).toFixed(1)} ${sy(r).toFixed(1)} L${sx(i + 1.5).toFixed(1)} ${sy(r).toFixed(1)} `;
		});
		return d;
	});
	const modelPath = $derived(
		model
			.slice(0, n)
			.map((s, i) => `${i === 0 ? 'M' : 'L'}${sx(i + 1).toFixed(1)} ${sy(s.total).toFixed(1)}`)
			.join(' ')
	);
	const futurePath = $derived(
		[model[n], ...future.slice(1)]
			.map((s, i) => `${i === 0 ? 'M' : 'L'}${sx(n + 1 + i).toFixed(1)} ${sy(s.total).toFixed(1)}`)
			.join(' ')
	);

	const fmt = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`;
	const lastNote = $derived.by(() => {
		if (!shown) return '';
		if (!shown.feedback) return `reach ${mine.length} recorded (no cursor)`;
		const e = errorOf(shown);
		if (Math.abs(e) < 6) return 'hit';
		return `missed by ${Math.abs(Math.round(e))}° ${e > 0 ? 'counter-clockwise' : 'clockwise'}`;
	});
	const phaseText = $derived(
		phase.left !== undefined ? `${phase.name} · ${phase.left} to go` : phase.name
	);
</script>

<g>
	<Readout id="phase" order={0} label="This step" value={phaseText}>
		<Label x={24} y={34} anchor="start" size={15} weight={700} text="Reach: {phaseText}" />
	</Readout>

	<!-- ring, start and target -->
	<path d={arc} fill="none" stroke="var(--stage-line)" stroke-width="1.2" stroke-dasharray="3 5" />
	<circle
		cx={S.x}
		cy={S.y}
		r="10"
		fill="var(--surface)"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<circle
		cx={tgt.x}
		cy={tgt.y}
		r="17"
		fill="var(--cb-target)"
		fill-opacity="0.22"
		stroke="var(--cb-target)"
		stroke-width="2"
	/>
	<circle cx={tgt.x} cy={tgt.y} r="5" fill="var(--cb-target)" />

	<!-- the last reach's feedback -->
	{#if shown && endpoint && lastTarget}
		{#if shown.target !== target}
			<circle
				cx={lastTarget.x}
				cy={lastTarget.y}
				r="17"
				fill="none"
				stroke="var(--cb-target)"
				stroke-width="1.5"
				stroke-dasharray="3 3"
				opacity="0.7"
			/>
		{/if}
		<line
			x1={S.x}
			y1={S.y}
			x2={endpoint.x}
			y2={endpoint.y}
			stroke="var(--cb-hand)"
			stroke-width="1.5"
			opacity="0.35"
		/>
		<circle cx={endpoint.x} cy={endpoint.y} r="7" fill="var(--cb-hand)" opacity="0.8" />
	{/if}

	<!-- ghost reach -->
	{#if ghost}
		<g opacity={0.85 * ghostFade}>
			<line
				x1={S.x}
				y1={S.y}
				x2={ghostHand.x}
				y2={ghostHand.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				stroke-dasharray="6 5"
			/>
			{#if phase.feedback}
				<line
					x1={S.x}
					y1={S.y}
					x2={ghostCursor.x}
					y2={ghostCursor.y}
					stroke="var(--cb-hand)"
					stroke-width="2"
					opacity="0.6"
				/>
				<circle cx={ghostCursor.x} cy={ghostCursor.y} r="7" fill="var(--cb-hand)" />
			{/if}
		</g>
		<Readout id="ghost">
			<Label
				x={S.x}
				y={S.y + 40}
				size={12}
				muted
				text={phase.feedback && phase.rotation !== 0
					? 'dashed: your hand · dot: the cursor'
					: phase.feedback
						? 'press and sweep toward the target'
						: 'no cursor: reach straight for the target'}
			/>
		</Readout>
	{/if}

	<!-- live cursor -->
	{#if cursor && phase.feedback}
		<circle cx={cursor.x} cy={cursor.y} r="7" fill="var(--cb-hand)" />
	{/if}

	<!-- keyboard aim -->
	{#if focused}
		{@const a = at(target + aim, R)}
		<line
			x1={S.x}
			y1={S.y}
			x2={a.x}
			y2={a.y}
			stroke="var(--focus)"
			stroke-width="1.5"
			stroke-dasharray="2 4"
		/>
		<Readout id="aim">
			<Label
				x={S.x}
				y={S.y + 62}
				size={12}
				text="aim {fmt(aim)} · keyboard reaches set the hand: they show the task, not your learning"
			/>
		</Readout>
	{/if}

	<Readout
		id="last"
		order={1}
		label="Last reach"
		value={lastNote || 'none yet'}
		opacity={shown ? 1 : 0}
	>
		<Label x={S.x} y={S.y + 40} size={13} weight={600} text={lastNote} opacity={shown ? 1 : 0} />
	</Readout>

	<!-- hit area (pointer hidden while over the workspace) -->
	<rect
		class="workspace"
		x="16"
		y="56"
		width="480"
		height="528"
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Workspace: press and sweep toward the target, or turn your aim with the arrow keys and press Enter"
		aria-valuenow={aim}
		aria-valuemin={-60}
		aria-valuemax={60}
		aria-valuetext="aim {Math.round(aim)} degrees from the target"
		{onpointerdown}
		{onkeydown}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	/>

	<!-- chart -->
	<Axes {sx} {sy} {yTicks} yFormat={(v) => `${v}°`} xLabel="reach" yLabel="correction (°)" />
	<line
		x1={sx(0)}
		x2={sx(xMax)}
		y1={sy(0)}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>
	<path
		d={rotPath}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
		opacity="0.8"
	/>
	<path
		d={futurePath}
		fill="none"
		stroke="var(--cb-model)"
		stroke-width="2"
		stroke-dasharray="3 4"
		opacity="0.75"
	/>
	{#if n > 0}
		<path d={modelPath} fill="none" stroke="var(--cb-model)" stroke-width="2.5" />
	{/if}
	{#each list as r, i (i)}
		{#if concealed(r, i)}
			<line
				x1={sx(i + 1)}
				x2={sx(i + 1)}
				y1={sy.range[0] - 8}
				y2={sy.range[0]}
				stroke="var(--cb-hand)"
				stroke-width="1.5"
			/>
		{:else}
			<circle
				cx={sx(i + 1)}
				cy={sy(correctionOf(r))}
				r="4"
				fill={r.feedback ? 'var(--cb-hand)' : 'var(--stage-bg)'}
				stroke="var(--cb-hand)"
				stroke-width="1.5"
			/>
		{/if}
	{/each}
	{#if list.some(concealed)}
		<Readout
			id="concealed"
			order={5}
			label="No-cursor reaches"
			value="kept off the chart until you press “Show my hidden reaches”"
		>
			<Label
				x={sx(0) + 8}
				y={sy.range[0] - 14}
				anchor="start"
				size={11}
				muted
				text="ticks: reaches without a cursor, kept hidden until you ask"
			/>
		</Readout>
	{/if}
	<Readout
		id="key-hand"
		order={2}
		label="Dots"
		value="your reaches ({n}; hollow: no cursor)"
		color="var(--cb-hand)"
	>
		<circle cx={566} cy={68} r="4" fill="var(--cb-hand)" />
		<Label
			x={576}
			y={72}
			anchor="start"
			size={12}
			color="var(--cb-hand)"
			text="your reaches ({n}) · hollow: no cursor"
		/>
	</Readout>
	<Readout
		id="key-model"
		order={3}
		label="Line"
		value="two-rate model doing your reaches (dashed: its forecast)"
		color="var(--cb-model)"
	>
		<line x1={558} x2={574} y1={88} y2={88} stroke="var(--cb-model)" stroke-width="2.5" />
		<Label
			x={580}
			y={92}
			anchor="start"
			size={12}
			color="var(--cb-model)"
			text="two-rate model doing your reaches (dashed: forecast)"
		/>
	</Readout>
	<Readout id="key-rot" order={4} label="Dashed grey" value="the rotation">
		<line
			x1={558}
			x2={574}
			y1={108}
			y2={108}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
		/>
		<Label
			x={580}
			y={112}
			anchor="start"
			size={12}
			muted
			text="the rotation: a correction here cancels it"
		/>
	</Readout>
</g>

<style>
	.workspace {
		cursor: none;
		touch-action: none;
		outline: none;
	}
	.workspace:focus-visible {
		outline: none;
	}
</style>
