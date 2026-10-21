<script lang="ts">
	/**
	 * Pin-jointed frames on the ground: a square and a triangle the reader builds by joining pins
	 * with sticks, a square with a diagonal, a four-box
	 * tower whose boxes take a diagonal on a click, and a gate on two hinges. Pushes are followed by
	 * the model (every stick keeps its length), so a frame moves only if it can; the readout says
	 * in how many ways it can wobble.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { gate, push, square, tower, triangle, wobbles, type Frame } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'square'));

	// ---- the tower's diagonals, stored as a control-free param "0101" -----------------------------
	const braced = $derived(
		[...String(params.braced ?? '0000').padEnd(4, '0')].slice(0, 4).map((c) => c === '1')
	);
	function toggleBox(k: number) {
		const next = braced.map((b, i) => (i === k ? !b : b));
		setParam('braced', next.map((b) => (b ? '1' : '0')).join(''));
	}

	// ---- building: in the first two steps the reader joins the pins with sticks ------------------
	// Sticks are stored as "01,12" in a control-free param per step; click a pin, then another, to
	// add a stick between them (or take it away again).
	const building = $derived(phase === 'square' || phase === 'triangle');
	const key = $derived(phase === 'triangle' ? 'tristicks' : 'sqsticks');
	const built = $derived(
		String(params[key] ?? '')
			.split(',')
			.filter((p) => p.length === 2)
			.map((p) => [Number(p[0]), Number(p[1])] as [number, number])
	);
	let picked = $state<number | null>(null);
	function pickPin(i: number) {
		if (picked === null) {
			picked = i;
			return;
		}
		const a = Math.min(picked, i);
		const b = Math.max(picked, i);
		picked = null;
		if (a === b) return;
		const has = built.some(([x, y]) => x === a && y === b);
		const next = has ? built.filter(([x, y]) => !(x === a && y === b)) : [...built, [a, b]];
		setParam(key, next.map(([x, y]) => `${x}${y}`).join(',') || '-');
	}

	const frame: Frame = $derived.by(() => {
		if (phase === 'triangle') return { ...triangle(), sticks: built };
		if (phase === 'square') return { ...square(), sticks: built };
		if (phase === 'diagonal') return square(params.diagonal === true);
		if (phase === 'tower' || phase === 'fewest')
			return tower(4, phase === 'fewest' ? [true, true, true, true] : braced);
		if (phase === 'gate') return gate(params.brace === true);
		if (phase === 'strong' || phase === 'next') return square(true);
		return square();
	});
	const ways = $derived(wobbles(frame));
	/** The pins every stick should join: all of them, each to at least two others. */
	const complete = $derived(
		!building ||
			frame.pts.every((_, i) => frame.sticks.filter(([a, b]) => a === i || b === i).length >= 2)
	);

	// ---- the push -----------------------------------------------------------------------------
	// Square and triangle: a push of 0.35 eased in over a second after each press. Diagonal and
	// tower: a steady sway. Gate: its weight pulls the far end down.
	let t0 = $state(0);
	$effect(() => {
		void params.push;
		void step.id;
		t0 = untrack(() => t);
	});
	const local = $derived(reduced ? 2 : t >= t0 ? t - t0 : t);
	const presses = $derived(Number(params.push ?? 0));
	const amount = $derived.by(() => {
		if (phase === 'square' || phase === 'triangle')
			return presses > 0 ? 0.35 * Math.min(1, local) : 0;
		if (phase === 'diagonal' || phase === 'tower')
			return reduced ? 0.3 : 0.3 * Math.sin((2 * Math.PI * local) / 3);
		if (phase === 'gate') return 0.35 * Math.min(1, local / 1.5);
		return 0;
	});
	const topJoint = $derived(frame.pts.length - 1);
	const shown: Frame = $derived.by(() => {
		if (phase === 'why') return leaned(Number(params.another ?? 0));
		if (amount === 0) return frame;
		if (phase === 'gate') return push(frame, 1, amount, { down: true, steps: 60 });
		return push(frame, topJoint, amount, { steps: 60 });
	});
	/** The "why" step: the same four sticks joined at another lean, or the one triangle. */
	function leaned(n: number): Frame {
		const angles = [0, 0.45, -0.4, 0.25];
		const a = angles[n % angles.length];
		return {
			...square(),
			pts: [
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 1 + Math.sin(a), y: Math.cos(a) },
				{ x: Math.sin(a), y: Math.cos(a) }
			]
		};
	}
	const tri = triangle();

	// ---- drawing ------------------------------------------------------------------------------
	const tall = $derived(phase === 'tower' || phase === 'fewest');
	const U = $derived(tall ? 100 : phase === 'gate' ? 170 : 200);
	const OX = $derived(phase === 'why' ? 240 : phase === 'gate' ? 300 : tall ? 430 : 380);
	const GROUND = 500;
	const PX = (x: number) => OX + x * U;
	// The gate hangs a little above the ground on its post.
	const LIFT = $derived(phase === 'gate' ? 0.35 : 0);
	const PY = (y: number) => GROUND - (y + LIFT) * U;
	const isBrace = (f: Frame, k: number) => {
		const [i, j] = f.sticks[k];
		return Math.abs(f.pts[i].x - f.pts[j].x) > 0.5 && Math.abs(f.pts[i].y - f.pts[j].y) > 0.5;
	};
	const moved = $derived(
		Math.hypot(
			shown.pts[topJoint].x - frame.pts[topJoint].x,
			shown.pts[topJoint].y - frame.pts[topJoint].y
		)
	);
</script>

<g class="tr">
	<!-- the ground -->
	<line x1={60} y1={GROUND} x2={900} y2={GROUND} stroke="var(--tr-ground)" stroke-width="4" />
	{#each Array.from({ length: 28 }, (_, i) => i) as i (i)}
		<line
			x1={70 + i * 30}
			y1={GROUND + 4}
			x2={58 + i * 30}
			y2={GROUND + 16}
			stroke="var(--tr-ground)"
			stroke-width="2"
		/>
	{/each}

	<!-- the sticks and pins -->
	{#each shown.sticks as [i, j], k (k)}
		<line
			x1={PX(shown.pts[i].x)}
			y1={PY(shown.pts[i].y)}
			x2={PX(shown.pts[j].x)}
			y2={PY(shown.pts[j].y)}
			stroke={isBrace(frame, k) ? 'var(--tr-brace)' : 'var(--tr-stick)'}
			stroke-width="12"
			stroke-linecap="round"
		/>
	{/each}
	{#each shown.pts as p, i (i)}
		<circle cx={PX(p.x)} cy={PY(p.y)} r={frame.pinned.includes(i) ? 9 : 7} fill="var(--tr-pin)" />
		{#if frame.pinned.includes(i) && phase === 'gate'}
			<rect
				x={PX(p.x) - 26}
				y={PY(p.y) - 10}
				width="16"
				height="20"
				rx="3"
				fill="var(--tr-ground)"
			/>
		{/if}
	{/each}
	{#if phase === 'gate'}
		<rect
			x={PX(0) - 40}
			y={PY(1.3)}
			width="14"
			height={GROUND - PY(1.3) + 4}
			fill="var(--tr-ground)"
		/>
	{/if}

	<!-- the push arrow -->
	{#if (phase === 'square' || phase === 'triangle') && presses > 0}
		<line
			x1={PX(shown.pts[topJoint].x) - 90}
			y1={PY(shown.pts[topJoint].y)}
			x2={PX(shown.pts[topJoint].x) - 14}
			y2={PY(shown.pts[topJoint].y)}
			stroke="var(--tr-push)"
			stroke-width="5"
			marker-end="url(#arrowhead)"
		/>
	{/if}

	<!-- the "why" step: the triangle beside the square -->
	{#if phase === 'why'}
		{#each tri.sticks as [i, j], k (k)}
			<line
				x1={560 + tri.pts[i].x * 200}
				y1={GROUND - tri.pts[i].y * 200}
				x2={560 + tri.pts[j].x * 200}
				y2={GROUND - tri.pts[j].y * 200}
				stroke="var(--tr-stick)"
				stroke-width="12"
				stroke-linecap="round"
			/>
		{/each}
		<Label
			x={340}
			y={GROUND + 44}
			text="four sticks: many shapes"
			anchor="middle"
			size={16}
			weight={600}
		/>
		<Label
			x={660}
			y={GROUND + 44}
			text="three sticks: one shape"
			anchor="middle"
			size={16}
			weight={600}
		/>
	{/if}

	<!-- building: the pins are buttons -->
	{#if building}
		{#each shown.pts as p, i (i)}
			<circle
				class="tr-box"
				cx={PX(p.x)}
				cy={PY(p.y)}
				r="22"
				fill={picked === i ? 'var(--tr-push)' : 'transparent'}
				fill-opacity={picked === i ? 0.3 : 0}
				stroke={picked === i ? 'var(--tr-push)' : 'none'}
				role="button"
				tabindex="0"
				aria-label="Pin {i + 1}{picked === i ? ' (picked: now pick another pin)' : ''}"
				aria-pressed={picked === i}
				onclick={() => pickPin(i)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						pickPin(i);
					}
				}}
			/>
		{/each}
	{/if}

	<!-- clicking the tower's boxes: targets that follow the swaying boxes -->
	{#if phase === 'tower'}
		{#each [0, 1, 2, 3] as k (k)}
			<polygon
				class="tr-box"
				points={[2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2]
					.map((n) => `${PX(shown.pts[n].x)},${PY(shown.pts[n].y)}`)
					.join(' ')}
				fill="transparent"
				role="button"
				tabindex="0"
				aria-label="Box {k + 1}: {braced[k] ? 'take out its diagonal' : 'add a diagonal'}"
				aria-pressed={braced[k]}
				onclick={() => toggleBox(k)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						toggleBox(k);
					}
				}}
			/>
		{/each}
	{/if}

	<!-- readouts -->
	{#if building && !complete}
		<Readout
			id="tr-build"
			order={1}
			label="Build"
			value="click a pin, then another, to join them with a stick"
		>
			<Label
				x={480}
				y={56}
				text="click a pin, then another, to join them with a stick"
				anchor="middle"
				size={18}
				weight={700}
			/>
		</Readout>
	{:else if phase !== 'why'}
		<Readout
			id="tr-ways"
			order={1}
			label="Wobble"
			value={ways === 0
				? 'stiff: no way to wobble'
				: `can wobble in ${ways} way${ways > 1 ? 's' : ''}`}
		>
			<Label
				x={480}
				y={56}
				text={ways === 0
					? 'stiff: it cannot wobble'
					: `wobbly: it can lean ${ways === 1 ? 'one way' : `${ways} ways`}`}
				anchor="middle"
				size={20}
				weight={700}
				color={ways === 0 ? 'var(--tr-brace)' : 'var(--tr-push)'}
			/>
		</Readout>
		<Readout
			id="tr-count"
			order={2}
			label="Count"
			value="{frame.sticks.length} sticks, {frame.pts.length - frame.pinned.length} free corners"
		>
			<Label
				x={480}
				y={84}
				text="{frame.sticks.length} sticks · {frame.pts.length -
					frame.pinned.length} corners free to move"
				anchor="middle"
				size={14}
				muted
				tabular
			/>
		</Readout>
	{/if}
	{#if building && complete && presses > 0}
		<Readout
			id="tr-moved"
			order={3}
			label="Pushed"
			value={moved > 0.05 ? 'it leaned over' : 'it did not move'}
		>
			<Label
				x={480}
				y={110}
				text={moved > 0.05 ? 'pushed: it leaned over' : 'pushed: it did not move'}
				anchor="middle"
				size={14}
				weight={600}
			/>
		</Readout>
	{/if}
</g>

<style>
	.tr-box {
		cursor: pointer;
		outline: none;
	}
	.tr-box:focus-visible {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
