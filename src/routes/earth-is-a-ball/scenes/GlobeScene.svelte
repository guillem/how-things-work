<script lang="ts">
	/**
	 * The Earth as a ball in space, with no up arrow anywhere. A little figure (far bigger than
	 * scale) stands wherever the reader walks it, feet on the ground; on 'drop' it lets go of a ball,
	 * which falls along the direction of the model's pull, summed over the whole ball of rock, and
	 * takes the model's time to fall. On 'everyone' six people stand round the world at once, each
	 * with their own 'down' towards the middle.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fallTime, pullAt } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'walk'));

	const CX = 350;
	const CY = 306;
	const R = 196;
	const f = (v: number) => v.toFixed(1);
	/** Screen point at `r` from the middle, `deg` degrees clockwise from the top of the picture. */
	const at = (deg: number, r: number) => {
		const a = (deg * Math.PI) / 180;
		return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
	};

	const target = $derived(Number(params.walk ?? 40));
	const angle = new Tween(40, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const a = target;
		untrack(() => angle.set(a, { duration: reduced ? 0 : 700 }));
	});
	const a = $derived(angle.current);

	// Figure, in its own frame: feet at the origin, head up the page (−y). 2 m is HAND px.
	const HEAD = 40;
	const HAND = 52;
	const setWalk = (deg: number) =>
		setParam('walk', (((Math.round(deg / 5) * 5) % 360) + 360) % 360);
	const angleOf = (p: Point) => (Math.atan2(p.x - CX, CY - p.y) * 180) / Math.PI;

	// ---- the dropped ball: falls along the model's pull, in the model's time ------------------------
	const FALL = fallTime(2);
	const PERIOD = 2.6;
	/** The pull's direction on screen (model y is up the page). */
	const pull = $derived.by(() => {
		const p = pullAt(target, 10, 30);
		return { x: p.x / p.g, y: -p.y / p.g };
	});
	const hand = $derived.by(() => {
		// The raised hand, 14 px to the figure's right and HAND px up, in screen coordinates.
		const r = (a * Math.PI) / 180;
		const up = { x: Math.sin(r), y: -Math.cos(r) };
		const right = { x: Math.cos(r), y: Math.sin(r) };
		const feet = at(a, R);
		return { x: feet.x + right.x * 16 + up.x * HAND, y: feet.y + right.y * 16 + up.y * HAND };
	});
	/** How far the ball travels along the pull before it meets the ground. */
	const fallLen = $derived.by(() => {
		const dx = hand.x - CX;
		const dy = hand.y - CY;
		const b = dx * pull.x + dy * pull.y;
		const c = dx * dx + dy * dy - (R + 5) * (R + 5);
		return -b - Math.sqrt(Math.max(0, b * b - c));
	});
	/** 0 in the hand, 1 on the ground: held for a moment, then the free fall, then it rests. */
	const fall = $derived.by(() => {
		if (reduced) return 1;
		const s = (t % PERIOD) - 0.7;
		return s <= 0 ? 0 : Math.min(1, (s / FALL) ** 2);
	});
	const ballFade = $derived(reduced ? 1 : 1 - smoothstep(PERIOD - 0.35, PERIOD - 0.05, t % PERIOD));
	const ball = $derived({
		x: hand.x + pull.x * fallLen * fall,
		y: hand.y + pull.y * fallLen * fall
	});

	const where = $derived.by(() => {
		const d = ((target % 360) + 360) % 360;
		if (d <= 30 || d >= 330) return 'the top of the picture';
		if (d >= 150 && d <= 210) return 'the bottom of the picture';
		if (d > 30 && d < 150) return 'the right side of the picture';
		return 'the left side of the picture';
	});

	const PEOPLE = [0, 60, 120, 180, 240, 300];
	const LAND = [
		'M-120 -110 C -80 -150, -10 -140, 20 -110 C 40 -90, 0 -60, -30 -40 C -70 -20, -110 -50, -120 -110 Z',
		'M60 -40 C 100 -70, 150 -40, 160 0 C 170 40, 130 70, 100 60 C 70 50, 40 0, 60 -40 Z',
		'M-150 40 C -120 20, -80 50, -70 90 C -60 130, -100 150, -130 120 C -155 95, -170 60, -150 40 Z',
		'M10 110 C 40 90, 80 110, 70 140 C 60 165, 20 170, 5 150 C -5 135, -5 120, 10 110 Z'
	];
	const STARS = [
		[40, 60],
		[120, 520],
		[600, 80],
		[660, 540],
		[90, 300],
		[590, 300],
		[200, 40],
		[500, 560]
	];
</script>

{#snippet person(color: string, holding: boolean)}
	<g stroke={color} stroke-width="4" stroke-linecap="round" fill="none">
		<line x1="-6" y1="0" x2="0" y2="-18" />
		<line x1="6" y1="0" x2="0" y2="-18" />
		<line x1="0" y1="-18" x2="0" y2={-HEAD + 9} />
		<line x1="0" y1="-30" x2="-10" y2="-20" />
		{#if holding}
			<line x1="0" y1="-30" x2="14" y2={-HAND + 4} />
		{:else}
			<line x1="0" y1="-30" x2="10" y2="-20" />
		{/if}
		<circle cx="0" cy={-HEAD} r="7" fill={color} />
	</g>
{/snippet}

<g>
	{#each STARS as [x, y], i (i)}
		<circle cx={x} cy={y} r="1.6" fill="var(--stage-ink-muted)" opacity="0.6" />
	{/each}

	<!-- the world -->
	<circle
		cx={CX}
		cy={CY}
		r={R}
		fill="var(--eb-globe-sea)"
		stroke="var(--eb-sea-edge)"
		stroke-width="1.5"
	/>
	<g transform="translate({CX} {CY})">
		{#each LAND as d, i (i)}<path {d} fill="var(--eb-globe-land)" opacity="0.9" />{/each}
	</g>
	<circle cx={CX} cy={CY} r="6" fill="var(--eb-middle)" />
	<Label x={CX} y={CY + 26} text="the middle" size={14} weight={700} anchor="middle" />

	{#if phase === 'everyone'}
		{#each PEOPLE as p (p)}
			{@const feet = at(p, R)}
			{@const tip = at(p, R - 70)}
			<line
				x1={f(feet.x)}
				y1={f(feet.y)}
				x2={f(tip.x)}
				y2={f(tip.y)}
				stroke="var(--eb-down)"
				stroke-width="2.5"
				marker-end="url(#arrowhead)"
				opacity="0.9"
			/>
			<g transform="translate({f(feet.x)} {f(feet.y)}) rotate({p})">
				{@render person('var(--eb-person)', false)}
			</g>
		{/each}
		<Label
			x={f(at(0, R - 95).x)}
			y={f(at(0, R - 95).y)}
			text="everyone’s down"
			size={13}
			weight={600}
			anchor="middle"
			color="var(--eb-down)"
		/>
	{:else}
		{@const feet = at(a, R)}
		{@const tip = at(a, 14)}
		{@const sky = at(a, R + 92)}
		<line
			x1={f(feet.x)}
			y1={f(feet.y)}
			x2={f(tip.x)}
			y2={f(tip.y)}
			stroke="var(--eb-down)"
			stroke-width="2.5"
			stroke-dasharray="7 5"
			marker-end="url(#arrowhead)"
		/>
		{#if phase === 'drop'}
			<line
				x1={f(hand.x)}
				y1={f(hand.y)}
				x2={f(hand.x + pull.x * fallLen)}
				y2={f(hand.y + pull.y * fallLen)}
				stroke="var(--eb-ball)"
				stroke-width="1.5"
				stroke-dasharray="2 4"
				opacity="0.7"
			/>
		{/if}
		<g transform="translate({f(feet.x)} {f(feet.y)}) rotate({f(a)})">
			{@render person('var(--eb-person)', phase === 'drop')}
		</g>
		{#if phase === 'drop'}
			<circle
				cx={f(ball.x)}
				cy={f(ball.y)}
				r="7"
				fill="var(--eb-ball)"
				stroke="var(--eb-ball-edge)"
				stroke-width="1.2"
				opacity={ballFade}
			/>
		{/if}
		<Label x={f(sky.x)} y={f(sky.y + 5)} text="sky" size={13} muted anchor="middle" />
		<Handle
			x={at(a, R + HEAD).x}
			y={at(a, R + HEAD).y}
			r={13}
			color="var(--eb-handle)"
			label="The figure"
			value={target}
			min={0}
			max={360}
			valuetext="{target} degrees round the world"
			onmove={(p: Point) => setWalk(angleOf(p))}
			onkey={(k) => setWalk(k === 'start' ? 0 : k === 'end' ? 180 : target + k * 5)}
		/>
	{/if}

	<!-- right-hand notes -->
	<Readout
		id="eb-where"
		order={1}
		label="Standing at"
		value={phase === 'everyone' ? 'all round the world' : where}
	>
		<Label
			x={640}
			y={150}
			text={phase === 'everyone' ? 'people all round the world' : `standing at ${where}`}
			size={15}
			weight={700}
			anchor="start"
		/>
	</Readout>
	<Readout id="eb-feet" order={2} label="Their feet point" value="towards the middle">
		<g transform="translate(640 186)">
			<line
				x1="0"
				y1="0"
				x2="26"
				y2="0"
				stroke="var(--eb-down)"
				stroke-width="2.5"
				stroke-dasharray="7 5"
			/>
			<Label x={36} y={5} text="feet point towards the middle" size={14} anchor="start" />
		</g>
	</Readout>
	{#if phase === 'drop'}
		<Readout
			id="eb-fall"
			order={3}
			label="The ball"
			value="falls towards the middle: 2 m in {FALL.toFixed(1)} s"
		>
			<g transform="translate(640 220)">
				<circle cx="13" cy="0" r="6" fill="var(--eb-ball)" />
				<Label x={36} y={5} text="the ball falls towards the middle" size={14} anchor="start" />
				<Label
					x={36}
					y={27}
					text="2 m in {FALL.toFixed(1)} seconds"
					size={13}
					anchor="start"
					muted
					tabular
				/>
			</g>
		</Readout>
	{/if}
	{#if phase === 'everyone'}
		<Readout id="eb-nobody" order={3} label="Upside down?" value="nobody: ground below, sky above">
			<Label x={640} y={230} text="nobody is upside down:" size={14} anchor="start" />
			<Label x={640} y={252} text="ground below, sky above" size={14} anchor="start" />
		</Readout>
	{/if}
	{#if phase !== 'everyone'}
		<Readout id="eb-try" order={4} label="Try it" value="drag the figure round the world">
			<Label
				x={640}
				y={470}
				text="drag the figure round the world"
				size={13}
				italic
				muted
				anchor="start"
			/>
		</Readout>
	{/if}
	<Readout id="eb-scale" order={5}>
		<Label
			x={640}
			y={560}
			text="people drawn far bigger than real"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>
</g>
