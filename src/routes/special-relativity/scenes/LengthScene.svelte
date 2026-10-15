<script lang="ts">
	/**
	 * Measuring a moving length. Top row: the platform frame; the 200 m train
	 * (contracted to 200/γ m) runs along the 200 m platform, and at platform time
	 * TM both of its ends are marked on the platform at once. Bottom row: the
	 * train frame; the platform (contracted) slides past the 200 m train and
	 * both of its ends are marked on the train at once, at train time TM.
	 *
	 * The event "the back of the train passes the 0 m end of the platform"
	 * happens at TM in both rows. Light (not drawn) would move at C_PX.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { gamma, measuredLength, num, TRAIN_LENGTH } from '../relativity';
	import { C_PX } from './shared';
	import Train from './Train.svelte';

	let { t, params, reduced }: StageProps = $props();

	const target = $derived(clamp(Number(params.beta ?? 0.6), 0, 0.99));
	const betaT = new Tween(0.6, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const b = target;
		untrack(() => betaT.set(b, { duration: reduced ? 0 : 600 }));
	});
	const beta = $derived(betaT.current);
	const g = $derived(gamma(beta));
	const k = $derived(1 / g);
	const v = $derived(beta * C_PX);
	const measured = $derived(measuredLength(beta));

	// ---- geometry ------------------------------------------------------------------
	const ROWS = [14, 300];
	const PXM = 3; // stage units per metre
	const LEN = TRAIN_LENGTH * PXM; // 600: the train and the platform at rest
	const X0 = 180; // where the back of the train meets the 0 m end at TM
	const TM = 2; // the moment both ends are marked
	const P = 6.5; // loop
	const RAIL = 160;
	const BODY = 80;
	const DECK = RAIL + 2;
	const DIM = 224;

	const tl = $derived(reduced ? 2.5 : t % P);
	const loopFade = $derived(
		reduced ? 1 : smoothstep(0, 0.3, tl) * (1 - smoothstep(P - 0.4, P, tl))
	);
	const marked = $derived(smoothstep(TM, TM + 0.15, tl));
	const glow = $derived(
		reduced ? 0 : smoothstep(TM - 0.01, TM, tl) * (1 - smoothstep(TM, TM + 0.6, tl))
	);

	// Top row: the back of the train at X0 + v (t − TM).
	const trainBack = $derived(X0 + v * (tl - TM));
	// Bottom row: the 0 m end of the platform at X0 − v (t − TM).
	const platBack = $derived(X0 - v * (tl - TM));

	const POSTS = Array.from({ length: 11 }, (_, i) => i); // every 20 m
	/** Tick labels every 40 m, if there is room for them. */
	const labelled = (i: number, spacing: number) =>
		i === 0 || i === 10 || (i % 2 === 0 && spacing * 2 >= 34);
	const metres = (m: number) => `${Math.round(m)} m`;
</script>

{#snippet platform(x: number, top: number, kk: number, opacity: number)}
	{@const w = LEN * kk}
	<g {opacity}>
		<rect
			{x}
			y={top + DECK}
			width={w}
			height="20"
			rx="2"
			fill="var(--rel-deck)"
			stroke="var(--rel-plat)"
			stroke-width="1.2"
		/>
		{#each POSTS as i (i)}
			{@const px = x + i * 60 * kk}
			<line
				x1={px}
				x2={px}
				y1={top + DECK}
				y2={top + DECK + (i % 5 === 0 ? 20 : 8)}
				stroke="var(--rel-plat)"
				opacity="0.8"
			/>
			{#if labelled(i, 60 * kk)}
				<Readout id="plat-{top}-{i}">
					<Label
						x={px}
						y={top + DECK + 36}
						text={i === 10 ? '200 m' : String(i * 20)}
						size={11}
						anchor="middle"
						muted
					/>
				</Readout>
			{/if}
		{/each}
	</g>
{/snippet}

{#snippet trainRuler(x: number, top: number, kk: number)}
	{#each POSTS as i (i)}
		{@const px = x + i * 60 * kk}
		<line
			x1={px}
			x2={px}
			y1={top + RAIL - 10 - BODY}
			y2={top + RAIL - 10 - BODY - (i % 5 === 0 ? 10 : 5)}
			stroke="var(--rel-train)"
		/>
		{#if labelled(i, 60 * kk)}
			<Readout id="ruler-{top}-{i}">
				<Label
					x={px}
					y={top + RAIL - BODY - 26}
					text={i === 10 ? '200 m' : String(i * 20)}
					size={11}
					anchor="middle"
					muted
				/>
			</Readout>
		{/if}
	{/each}
{/snippet}

{#snippet dimension(
	a: number,
	b: number,
	top: number,
	text: string,
	sub: string,
	color: string,
	dotY: number
)}
	<g opacity={marked}>
		{#each [a, b] as x (x)}
			<line
				x1={x}
				x2={x}
				y1={top + RAIL - BODY - 10}
				y2={top + DIM + 6}
				stroke={color}
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<circle cx={x} cy={dotY} r={4 + 10 * glow} fill={color} opacity={0.5 + 0.5 * (1 - glow)} />
		{/each}
		<line
			x1={a}
			x2={b}
			y1={top + DIM}
			y2={top + DIM}
			stroke={color}
			stroke-width="2"
			marker-start="url(#arrowhead)"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="dim-{top}"
			>{#snippet narrow()}<Label
					x={(a + b) / 2}
					y={top + DIM + 32}
					{text}
					size={30}
					weight={700}
					anchor="middle"
				/>{/snippet}
			<Label x={(a + b) / 2} y={top + DIM + 20} {text} size={14} weight={650} anchor="middle" />
		</Readout>
		<Readout id="dim-sub-{top}">
			<Label x={(a + b) / 2} y={top + DIM + 36} text={sub} size={11} muted anchor="middle" />
		</Readout>
	</g>
{/snippet}

<g>
	<defs>
		<clipPath id="len-clip"><rect x="16" y="0" width="928" height="600" /></clipPath>
	</defs>
	<g clip-path="url(#len-clip)">
		<!-- ===================== top row: the platform frame ===================== -->
		<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
		<Readout id="row-top" order={1} label="Platform frame" marker={1} at={[40, ROWS[0] + 24]}>
			<Label
				anchor="start"
				x={24}
				y={ROWS[0] + 18}
				text="Platform frame"
				size={15}
				weight={650}
				color="var(--rel-plat)"
			/>
		</Readout>
		<Readout
			id="speed"
			order={3}
			label="Train speed"
			value={beta < 0.005 ? 'at rest' : `${num(beta)} c · γ = ${num(g, 3)}`}
		>
			<Label
				anchor="start"
				x={232}
				y={ROWS[0] + 18}
				size={13}
				muted
				text={beta < 0.005 ? 'train at rest' : `train at ${num(beta)} c · γ = ${num(g, 3)}`}
			/>
		</Readout>
		<Readout
			id="measured-top"
			order={4}
			label="Measured on the platform"
			value="train {metres(measured)} long"
			note="both ends marked at the same platform time"
			color="var(--rel-train)"
		>
			<Label
				x={936}
				y={ROWS[0] + 18}
				anchor="end"
				weight={600}
				text="the platform marks both ends of the train at once:"
			/>
			<Label
				x={936}
				y={ROWS[0] + 35}
				anchor="end"
				weight={650}
				size={14}
				color="var(--rel-train)"
				text="the train is {metres(measured)} long"
			/>
		</Readout>
		<line
			x1="16"
			x2="944"
			y1={ROWS[0] + RAIL}
			y2={ROWS[0] + RAIL}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		{@render platform(X0, ROWS[0], 1, 1)}
		<g opacity={loopFade}>
			<Train
				x={trainBack + (LEN * k) / 2}
				y={ROWS[0] + RAIL}
				length={LEN}
				height={BODY}
				{k}
				cars={3}
				windows={4}
			/>
			{@render trainRuler(trainBack, ROWS[0], k)}
			{@render dimension(
				X0,
				X0 + LEN * k,
				ROWS[0],
				metres(measured),
				'marked at the same platform time',
				'var(--rel-train)',
				ROWS[0] + DECK + 10
			)}
		</g>

		<!-- ===================== bottom row: the train frame ===================== -->
		<Readout id="row-bottom" order={2} label="Train frame" marker={2} at={[40, ROWS[1] + 24]}>
			<Label
				anchor="start"
				x={24}
				y={ROWS[1] + 18}
				text="Train frame"
				size={15}
				weight={650}
				color="var(--rel-train)"
			/>
		</Readout>
		<Readout id="speed-bottom">
			<Label
				anchor="start"
				x={232}
				y={ROWS[1] + 18}
				size={13}
				muted
				text={beta < 0.005 ? 'platform at rest' : `platform at ${num(beta)} c · γ = ${num(g, 3)}`}
			/>
		</Readout>
		<Readout
			id="measured-bottom"
			order={5}
			label="Measured on the train"
			value="platform {metres(measured)} long"
			note="both ends marked at the same train time"
			color="var(--rel-plat)"
		>
			<Label
				x={936}
				y={ROWS[1] + 18}
				anchor="end"
				weight={600}
				text="the train marks both ends of the platform at once:"
			/>
			<Label
				x={936}
				y={ROWS[1] + 35}
				anchor="end"
				weight={650}
				size={14}
				color="var(--rel-plat)"
				text="the platform is {metres(measured)} long"
			/>
		</Readout>
		<line
			x1="16"
			x2="944"
			y1={ROWS[1] + RAIL}
			y2={ROWS[1] + RAIL}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<g opacity={loopFade}>
			{@render platform(platBack, ROWS[1], k, 1)}
		</g>
		<Train x={X0 + LEN / 2} y={ROWS[1] + RAIL} length={LEN} height={BODY} cars={3} windows={4} />
		{@render trainRuler(X0, ROWS[1], 1)}
		<g opacity={loopFade}>
			{@render dimension(
				X0,
				X0 + LEN * k,
				ROWS[1],
				metres(measured),
				'marked at the same train time',
				'var(--rel-plat)',
				ROWS[1] + RAIL - 16
			)}
		</g>
	</g>
</g>
