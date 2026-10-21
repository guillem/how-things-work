<script lang="ts">
	/**
	 * A brim-full tank seen from the side, drawn to scale (13 px per cm). Things hang from a spring
	 * balance or are dropped in; the model says how deep each one settles and how much water it
	 * pushes aside, which spills down a spout into a cup on a kitchen scale.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DENSITY,
		apple,
		clayBall,
		clayBowl,
		egg,
		height,
		lowered,
		maxDisplaced,
		settle,
		smallSteelBall,
		steelBall,
		steelPan,
		stone,
		submerged,
		woodBlock,
		type Body,
		type Liquid
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'lower'));

	// ---- the tank, to scale --------------------------------------------------------------------
	const S = 20;
	const TX0 = $derived(phase === 'lower' || phase === 'objects' || phase === 'bowl' ? 50 : 200);
	const TX1 = $derived(TX0 + 28 * S);
	const SY = 300;
	const SB = SY + 12 * S;
	const BX = $derived((TX0 + TX1) / 2);
	const BOTTOM = 12;

	const liquidId = $derived(
		(phase === 'liquids' ? String(params.liquid ?? 'water') : 'water') as Liquid
	);
	const rho = $derived(DENSITY[liquidId]);
	const liquidName = $derived(
		liquidId === 'saltyWater' ? 'salty water' : liquidId === 'oil' ? 'oil' : 'water'
	);

	// ---- time since the last change, for the drops ----------------------------------------------
	let t0 = $state(0);
	$effect(() => {
		void params.thing;
		void params.bowl;
		void params.liquid;
		void step.id;
		t0 = untrack(() => t);
	});
	const local = $derived(reduced ? 99 : t >= t0 ? t - t0 : t);
	const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

	// ---- what is in the tank --------------------------------------------------------------------
	const things: Record<string, Body> = {
		stone,
		apple,
		wood: woodBlock,
		steel: steelBall,
		clay: clayBall
	};
	const nMarbles = $derived(Math.round(Number(params.marbles ?? 0)));

	interface Placed {
		body: Body;
		x: number;
		/** Bottom of the thing under the surface, cm (negative: above it). */
		depth: number;
		floats: boolean;
		settled: boolean;
		/** Water pushed aside so far, g. */
		pushed: number;
		marbles?: number;
	}

	function drop(body: Body, x: number, delay = 0, extra: Partial<Placed> = {}): Placed {
		const rest = settle(body, rho);
		const final = rest.floats ? rest.depth : BOTTOM;
		const start = -0.5;
		const k = ease((local - delay) / 2.2);
		const depth = start + (final - start) * k;
		const pushed =
			!rest.floats && depth >= height(body.shape)
				? rest.displaced
				: Math.min(rho * submerged(body.shape, depth), rest.displaced);
		return { body, x, depth, floats: rest.floats, settled: k >= 1, pushed, ...extra };
	}

	const hanging = $derived(phase === 'lower' || phase === 'objects');
	const placed: Placed[] = $derived.by(() => {
		if (phase === 'lower') {
			const want = Number(params.lower ?? 0) - 3;
			const l = lowered(stone, rho, want);
			return [
				{
					body: stone,
					x: BX,
					depth: want,
					floats: false,
					settled: want >= height(stone.shape),
					pushed: l.spilled
				}
			];
		}
		if (phase === 'objects') {
			const body = things[String(params.thing ?? 'stone')] ?? stone;
			const rest = settle(body, rho);
			const want = -1.5 + 8.5 * ease(local / 3);
			const depth = rest.floats ? Math.min(want, rest.depth) : want;
			const l = lowered(body, rho, want);
			return [
				{
					body,
					x: BX,
					depth,
					floats: rest.floats,
					settled: rest.floats ? want >= rest.depth : want >= height(body.shape),
					pushed: l.spilled
				}
			];
		}
		if (phase === 'heavy') return [drop(steelPan, BX - 100), drop(smallSteelBall, BX + 170, 0.4)];
		if (phase === 'bowl') return [drop(params.bowl === true ? clayBowl() : clayBall, BX)];
		if (phase === 'marbles') {
			const body = clayBowl(nMarbles);
			const rest = settle(body, rho);
			return [
				{
					body,
					x: BX,
					depth: rest.floats ? rest.depth : BOTTOM,
					floats: rest.floats,
					settled: true,
					pushed: rest.displaced,
					marbles: nMarbles
				}
			];
		}
		if (phase === 'liquids')
			return [drop(egg, BX - 180), drop(apple, BX, 0.3), drop(woodBlock, BX + 180, 0.6)];
		// next: the ball and the bowl of the same clay
		return [drop(clayBall, BX - 130), drop(clayBowl(), BX + 120, 0.3)];
	});

	const balanceReading = $derived(
		hanging ? Math.max(0, placed[0].body.mass - placed[0].pushed) : 0
	);
	const showCup = $derived(phase === 'lower' || phase === 'objects' || phase === 'bowl');
	/** Water the thing pushes aside right now, g. */
	const pushedNow = $derived(showCup ? placed[0].pushed : 0);
	// What spilled stays in the cup. Dropped things only ever go deeper, so there the cup holds
	// what is pushed aside now. The stone on its slider can be pulled back up: the cup keeps the
	// most it ever pushed aside since the step began, and the tank's water drops instead. (This
	// depends on the slider only, never on `t`.)
	const pushedByStone = $derived(
		phase === 'lower' ? lowered(stone, rho, Number(params.lower ?? 0) - 3).spilled : 0
	);
	let stoneMost = $state(0);
	let lastStep = '';
	$effect(() => {
		const id = step.id;
		const p = pushedByStone;
		untrack(() => {
			if (id !== lastStep) {
				lastStep = id;
				stoneMost = p;
			} else if (p > stoneMost) stoneMost = p;
		});
	});
	const spilled = $derived(phase === 'lower' ? Math.max(stoneMost, pushedNow) : pushedNow);
	/** How far the surface has dropped below the brim, px (tank floor 28 cm by 20 cm). */
	const sink = $derived(Math.max(0, ((spilled - pushedNow) / (28 * 20)) * S));
	const WY = $derived(SY + sink);
	const spilling = $derived(
		showCup && !reduced && !placed[0].settled && placed[0].depth > 0 && sink < 0.01
	);

	// ---- drawing helpers --------------------------------------------------------------------------
	const bottomY = (p: Placed) => SY + p.depth * S;
	function hullPath(p: Placed): string {
		if (p.body.shape.kind !== 'hull') return '';
		const { w, h, t: th } = p.body.shape;
		const x0 = p.x - (w * S) / 2;
		const x1 = p.x + (w * S) / 2;
		const yb = bottomY(p);
		const yt = yb - h * S;
		const tw = Math.max(5, th * S);
		return `M${x0},${yt} L${x0},${yb} L${x1},${yb} L${x1},${yt} L${x1 - tw},${yt} L${x1 - tw},${yb - tw} L${x0 + tw},${yb - tw} L${x0 + tw},${yt} Z`;
	}
	/** The water, with holes where a floating bowl keeps air inside it below the surface. */
	const waterPath = $derived.by(() => {
		let d = `M${TX0},${WY} L${TX1},${WY} L${TX1},${SB} L${TX0},${SB} Z`;
		for (const p of placed) {
			if (p.body.shape.kind !== 'hull' || !p.floats) continue;
			const { w, t: th } = p.body.shape;
			const tw = Math.max(5, th * S);
			const yFloor = bottomY(p) - tw;
			if (yFloor <= SY) continue;
			const x0 = p.x - (w * S) / 2 + tw;
			const x1 = p.x + (w * S) / 2 - tw;
			d += ` M${x0},${SY} L${x1},${SY} L${x1},${yFloor} L${x0},${yFloor} Z`;
		}
		return d;
	});
	function marbleSpots(p: Placed): { x: number; y: number; row: number }[] {
		if (!p.marbles || p.body.shape.kind !== 'hull') return [];
		const { t: th } = p.body.shape;
		const tw = Math.max(5, th * S);
		const x0 = p.x - (p.body.shape.w * S) / 2 + tw;
		const yFloor = bottomY(p) - tw;
		return Array.from({ length: p.marbles }, (_, k) => {
			const row = Math.floor(k / 5);
			const col = k % 5;
			return { x: x0 + (col + 0.5) * 1.4 * S + row * 3, y: yFloor - 0.7 * S - row * 4, row };
		}).reverse();
	}

	const fmt = (g: number) => `${Math.round(g)} g`;
	const verdict = (p: Placed) => (!p.settled ? 'going in…' : p.floats ? 'floats' : 'sinks');
	const pointerY = $derived(34 + Math.min(1, balanceReading / 350) * 56);
	const cupLevel = $derived(Math.min(104, spilled * 0.5));
	const bowlMass = $derived(clayBowl(nMarbles).mass);
	const bowlMost = $derived(DENSITY.water * maxDisplaced(clayBowl().shape));
	const liquidFill = $derived(
		liquidId === 'oil'
			? 'var(--fs-oil)'
			: liquidId === 'saltyWater'
				? 'var(--fs-salty)'
				: 'var(--fs-water)'
	);
</script>

<g class="fs">
	<!-- the water, behind the things in it -->
	<path d={waterPath} fill={liquidFill} fill-rule="evenodd" opacity="0.35" />

	<!-- the things -->
	{#each placed as p, i (i)}
		{@const s = p.body.shape}
		{@const yb = bottomY(p)}
		{#if hanging}
			<line
				x1={BX}
				y1={96}
				x2={p.x}
				y2={yb - height(s) * S}
				stroke="var(--fs-string)"
				stroke-width="2"
				stroke-dasharray={p.floats && p.settled ? '4 4' : 'none'}
			/>
		{/if}
		{#if s.kind === 'box'}
			{#if p.body === stone}
				<path
					d="M{p.x - (s.w * S) / 2 + 8},{yb} L{p.x + (s.w * S) / 2 - 4},{yb} Q{p.x +
						(s.w * S) / 2},{yb} {p.x + (s.w * S) / 2},{yb - 10} L{p.x + (s.w * S) / 2 - 6},{yb -
						s.h * S +
						6} Q{p.x + (s.w * S) / 2 - 10},{yb - s.h * S} {p.x},{yb - s.h * S} L{p.x -
						(s.w * S) / 2 +
						10},{yb - s.h * S + 4} Q{p.x - (s.w * S) / 2},{yb - s.h * S + 8} {p.x -
						(s.w * S) / 2},{yb - 14} Q{p.x - (s.w * S) / 2},{yb} {p.x - (s.w * S) / 2 + 8},{yb} Z"
					fill="var(--fs-stone)"
				/>
			{:else}
				<rect
					x={p.x - (s.w * S) / 2}
					y={yb - s.h * S}
					width={s.w * S}
					height={s.h * S}
					rx="3"
					fill="var(--fs-wood)"
				/>
				{#each [0.3, 0.55, 0.8] as g (g)}
					<line
						x1={p.x - (s.w * S) / 2 + 6}
						y1={yb - s.h * S * g}
						x2={p.x + (s.w * S) / 2 - 6}
						y2={yb - s.h * S * g + 3}
						stroke="var(--fs-grain)"
						stroke-width="1.5"
					/>
				{/each}
			{/if}
		{:else if s.kind === 'spheroid'}
			{@const fill =
				p.body === apple
					? 'var(--fs-apple)'
					: p.body === egg
						? 'var(--fs-egg)'
						: p.body === clayBall
							? 'var(--fs-clay)'
							: 'var(--fs-steel)'}
			<ellipse
				cx={p.x}
				cy={yb - s.b * S}
				rx={s.a * S}
				ry={s.b * S}
				{fill}
				stroke={p.body === egg ? 'var(--fs-grain)' : 'none'}
				stroke-width="2"
			/>
			{#if p.body === apple}
				<path
					d="M{p.x},{yb - 2 * s.b * S + 4} q2,-10 6,-14"
					stroke="var(--fs-wood)"
					stroke-width="3"
					fill="none"
				/>
				<ellipse
					cx={p.x + 14}
					cy={yb - 2 * s.b * S - 6}
					rx="9"
					ry="4"
					fill="var(--fs-leaf)"
					transform="rotate(-20 {p.x + 14} {yb - 2 * s.b * S - 6})"
				/>
			{:else if p.body !== clayBall}
				<ellipse
					cx={p.x - s.a * S * 0.35}
					cy={yb - s.b * S * 1.4}
					rx={s.a * S * 0.22}
					ry={s.b * S * 0.15}
					fill="white"
					opacity="0.45"
				/>
			{/if}
		{:else}
			{#each marbleSpots(p) as m, k (k)}
				<circle
					cx={m.x}
					cy={m.y}
					r={0.7 * S}
					fill="var(--fs-marble)"
					stroke="var(--fs-steel)"
					stroke-width="1"
					opacity={1 - m.row * 0.15}
				/>
			{/each}
			<path d={hullPath(p)} fill={p.body === steelPan ? 'var(--fs-steel)' : 'var(--fs-clay)'} />
			{#if p.body === steelPan}
				<rect
					x={p.x + (s.w * S) / 2 - 2}
					y={yb - s.h * S}
					width="60"
					height="7"
					rx="3"
					fill="var(--fs-steel)"
				/>
			{/if}
		{/if}
	{/each}

	<!-- the water in front, so what is under it looks wet -->
	<path d={waterPath} fill={liquidFill} fill-rule="evenodd" opacity="0.35" />
	<line x1={TX0} y1={WY} x2={TX1} y2={WY} stroke={liquidFill} stroke-width="3" />

	<!-- the tank -->
	<path
		d="M{TX0 - 4},{SY - 6} L{TX0 - 4},{SB + 4} L{TX1 + 4},{SB + 4} L{TX1 + 4},{SY}"
		fill="none"
		stroke="var(--fs-glass)"
		stroke-width="7"
		stroke-linejoin="round"
	/>

	<!-- the spout, the cup and the kitchen scale -->
	{#if showCup}
		<path
			d="M{TX1 + 4},{SY - 2} L{TX1 + 64},{SY + 14}"
			stroke="var(--fs-glass)"
			stroke-width="7"
			stroke-linecap="round"
		/>
		{#if spilling}
			<path
				d="M{TX1 + 64},{SY + 14} Q{TX1 + 78},{SY + 30} {TX1 + 80},{520 - cupLevel}"
				stroke="var(--fs-water)"
				stroke-width="5"
				fill="none"
				opacity="0.8"
			/>
		{/if}
		<rect
			x={TX1 + 46}
			y={520 - cupLevel}
			width="72"
			height={cupLevel}
			fill="var(--fs-water)"
			opacity="0.55"
		/>
		<path
			d="M{TX1 + 42},404 L{TX1 + 46},520 L{TX1 + 118},520 L{TX1 + 122},404"
			fill="none"
			stroke="var(--fs-glass)"
			stroke-width="4"
		/>
		<rect x={TX1 + 22} y={522} width="120" height="22" rx="5" fill="var(--fs-scale)" />
		<Readout id="fs-spill" order={2} label="Water in the cup" value={fmt(spilled)}>
			<Label
				x={TX1 + 82}
				y={568}
				text="in the cup: {fmt(spilled)}"
				size={17}
				weight={700}
				color="var(--fs-ink)"
				tabular
			/>
		</Readout>
	{/if}

	<!-- the spring balance -->
	{#if hanging}
		<line x1={BX - 90} y1={12} x2={BX + 90} y2={12} stroke="var(--fs-glass)" stroke-width="6" />
		<line x1={BX} y1={12} x2={BX} y2={22} stroke="var(--fs-string)" stroke-width="2" />
		<rect
			x={BX - 20}
			y={22}
			width="40"
			height="74"
			rx="8"
			fill="var(--fs-balance)"
			stroke="var(--fs-glass)"
			stroke-width="2"
		/>
		{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
			<line
				x1={BX - 12}
				y1={34 + k * 8}
				x2={BX - 4}
				y2={34 + k * 8}
				stroke="var(--fs-ink)"
				stroke-width="1.5"
				opacity="0.6"
			/>
		{/each}
		<polygon
			points="{BX - 2},{pointerY} {BX + 14},{pointerY - 6} {BX + 14},{pointerY + 6}"
			fill="var(--fs-pointer)"
		/>
		<Readout id="fs-balance" order={1} label="Spring balance" value={fmt(balanceReading)}>
			<Label
				x={BX + 34}
				y={52}
				text="balance: {fmt(balanceReading)}"
				anchor="start"
				size={18}
				weight={700}
				color="var(--fs-ink)"
				tabular
			/>
		</Readout>
	{/if}

	<!-- names and verdicts -->
	{#if hanging}
		<Readout id="fs-verdict" order={3} label={placed[0].body.name} value={verdict(placed[0])}>
			<Label
				x={BX + 34}
				y={80}
				text="{placed[0].body.name}: {phase === 'lower' && !placed[0].settled
					? `weighs ${fmt(placed[0].body.mass)}`
					: verdict(placed[0])}"
				anchor="start"
				size={16}
				weight={600}
				muted
			/>
		</Readout>
	{:else if phase !== 'marbles'}
		{#each placed as p, i (i)}
			<Readout
				id="fs-v{i}"
				order={3 + i}
				label="{p.body.name}{phase === 'marbles' ? ` + ${nMarbles} marbles` : ''}"
				value="{fmt(p.body.mass)}, {verdict(p)}"
			>
				<Label x={p.x} y={130} text={p.body.name} size={17} weight={700} />
				<Label
					x={p.x}
					y={156}
					text="{fmt(p.body.mass)} · {verdict(p)}"
					size={15}
					weight={600}
					color={p.settled ? (p.floats ? 'var(--fs-yes)' : 'var(--fs-no)') : undefined}
					muted={!p.settled}
					tabular
				/>
			</Readout>
		{/each}
	{/if}
	{#if phase === 'marbles'}
		<Readout
			id="fs-load"
			order={1}
			label="Bowl and {nMarbles} marbles"
			value="{fmt(bowlMass)}, {placed[0].floats ? 'floats' : 'sinks'}"
		>
			<Label
				x={BX}
				y={84}
				text="bowl and {nMarbles} marble{nMarbles === 1 ? '' : 's'}: {fmt(bowlMass)} · {placed[0]
					.floats
					? 'floats'
					: 'sinks'}"
				color={placed[0].floats ? 'var(--fs-yes)' : 'var(--fs-no)'}
				size={18}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="fs-most" order={2} label="Most water it can push aside" value={fmt(bowlMost)}>
			<Label
				x={BX}
				y={112}
				text="the most water it can push aside: {fmt(bowlMost)}"
				size={15}
				muted
				tabular
			/>
		</Readout>
	{/if}
	{#if phase === 'liquids'}
		<Readout id="fs-liquid" order={1} label="In the tank" value={liquidName}>
			<Label x={BX} y={96} text="in {liquidName}" size={20} weight={700} />
		</Readout>
	{/if}
	{#if phase === 'bowl'}
		<Readout id="fs-same" order={1} label="Clay" value="the same 98 g lump">
			<Label x={BX} y={96} text="the same lump of clay" size={18} weight={700} muted />
		</Readout>
	{/if}
</g>
