<script lang="ts">
	/**
	 * Einstein's train. Lightning strikes both ends of the 200 m train; top row
	 * in the platform frame, bottom row in the train frame, each row running on
	 * its own clocks (the same reading in both rows at any moment of the loop).
	 *
	 * All events come from the model (`lightning`, `toTrain`) in light units,
	 * scaled to stage units: on the platform both strikes are at t = 0 and the
	 * flashes meet at the observer midway between the scorch marks; on the train
	 * the front strike comes βL/c before the back one. Light moves at C_PX in
	 * both rows. The loop starts before the earlier strike (t′ = −βL/2c) and
	 * ends once the flashes have met at the observer in both rows.
	 *
	 * `step.hints.focus` ('platform' | 'train') dims the other row.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { C, gamma, lightning, num, toTrain, TRAIN_LENGTH } from '../relativity';
	import { C_PX } from './shared';
	import T from './T.svelte';
	import Train from './Train.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'platform'));
	const target = $derived(clamp(Number(params.beta ?? 0.6), 0, 0.99));
	const betaT = new Tween(0.6, { duration: 600, easing: cubicInOut });
	const topW = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const b = target;
		const f = focus === 'platform' ? 1 : 0;
		untrack(() => {
			betaT.set(b, { duration: reduced ? 0 : 600 });
			topW.set(f, { duration: reduced ? 0 : 700 });
		});
	});
	const beta = $derived(betaT.current);
	const g = $derived(gamma(beta));
	const k = $derived(1 / g);
	const dimTop = $derived(0.4 + 0.6 * topW.current);
	const dimBottom = $derived(0.4 + 0.6 * (1 - topW.current));

	// ---- scale and events ------------------------------------------------------------
	const L = 360; // the train's rest length (200 m) in stage units
	const S = L / TRAIN_LENGTH; // stage units per metre
	/** A time given as c·t in stage units, in nanoseconds. */
	const ns = (ct: number) => `${num((ct / S / C) * 1e9, 0)} ns`;
	const ev = $derived.by(() => {
		const m = lightning(beta, TRAIN_LENGTH);
		const sc = (e: { ct: number; x: number }) => ({ ct: e.ct * S, x: e.x * S });
		const tr = (e: { ct: number; x: number }) => sc(toTrain(e, beta));
		return {
			h: (L / 2) * k, // half the train's length on the platform
			p: {
				back: sc(m.back),
				front: sc(m.front),
				meet: sc(m.platformMeets),
				pFront: sc(m.passengerFront),
				pBack: sc(m.passengerBack)
			},
			t: {
				back: tr(m.back),
				front: tr(m.front),
				meet: tr(m.platformMeets),
				pFront: tr(m.passengerFront),
				pBack: tr(m.passengerBack)
			}
		};
	});

	// ---- the loop --------------------------------------------------------------------
	const ctStart = $derived(ev.t.front.ct - 70);
	const ctEnd = $derived(Math.max(ev.p.meet.ct, ev.t.pBack.ct) + 90);
	const period = $derived((ctEnd - ctStart) / C_PX + 0.6);
	const tau = $derived(t % period);
	// The reduced-motion frame: after both strikes in both rows, the back flash on its way
	// to the passenger.
	const ct = $derived(
		reduced ? (ev.t.back.ct + ev.t.pBack.ct) / 2 : Math.min(ctStart + C_PX * tau, ctEnd)
	);
	const fade = $derived(
		reduced ? 1 : smoothstep(0, 0.25, tau) * (1 - smoothstep(period - 0.35, period, tau))
	);

	// ---- layout ----------------------------------------------------------------------
	const ROWS = [14, 300];
	const O1 = 360; // top row: the platform observer (x = 0)
	const O2 = 560; // bottom row: the passenger (x′ = 0)
	const RAIL = 196;
	const BODY = 78;
	const ROOF = RAIL - 10 - BODY;
	const LINE = RAIL - 36; // the light runs along this line
	const DECK = RAIL + 4;

	/** Light pulses from a strike at `e`, at time `now`: inward and outward. */
	function pulses(e: { ct: number; x: number }, now: number, inward: number) {
		const s = now - e.ct;
		if (s < 0) return [];
		return [
			{ x: e.x + inward * s, inward: true, key: 'in' },
			{ x: e.x - inward * s, inward: false, key: 'out' }
		];
	}
	const strikeGlow = (e: { ct: number }) => {
		const s = ct - e.ct;
		if (s < 0) return 0;
		return reduced ? 0.25 : 1 - smoothstep(0, 90, s);
	};
	const happened = (e: { ct: number }) => ct >= e.ct;
	const ring = (e: { ct: number }) =>
		ct < e.ct ? 0 : reduced ? 1 : 1 - smoothstep(0, 60, ct - e.ct);

	// Top row positions at platform time ct.
	const top = $derived({
		trainX: beta * ct,
		pass: beta * ct,
		pulses: [
			...pulses(ev.p.back, ct, 1).map((p) => ({ ...p, key: 'b' + p.key })),
			...pulses(ev.p.front, ct, -1).map((p) => ({ ...p, key: 'f' + p.key }))
		]
	});
	// Bottom row positions at train time ct′ (= the same reading ct).
	const bottom = $derived({
		obs: -beta * ct,
		pulses: [
			...pulses(ev.t.back, ct, 1).map((p) => ({ ...p, key: 'b' + p.key })),
			...pulses(ev.t.front, ct, -1).map((p) => ({ ...p, key: 'f' + p.key }))
		]
	});
	/** A mark fixed on the platform at platform position X, in the train frame at time ct′. */
	const onPlatform = (X: number) => X / g - beta * ct;

	const bolt = (x: number, y0: number, y1: number) => {
		const n = 5;
		let d = `M${x + 6} ${y0}`;
		for (let i = 1; i <= n; i++) {
			const y = y0 + ((y1 - y0) * i) / n;
			d += ` L${x + (i % 2 ? -6 : 6) * (i === n ? 0 : 1)} ${y}`;
		}
		return d;
	};
</script>

{#snippet observer(
	x: number,
	rowTop: number,
	color: string,
	label: string,
	glow: number,
	onDeck: boolean
)}
	{@const y = onDeck ? rowTop + DECK + 9 : rowTop + LINE}
	{#if onDeck}
		<line
			x1={x}
			x2={x}
			y1={rowTop + LINE}
			y2={y}
			stroke={color}
			stroke-dasharray="2 3"
			opacity="0.7"
		/>
	{/if}
	<circle cx={x} cy={y} r={7 + 12 * glow} fill="var(--rel-light)" opacity={0.6 * glow} />
	<circle cx={x} cy={y} r="7" fill={color} stroke="var(--stage-bg)" stroke-width="2" />
	<T {x} y={onDeck ? y + 26 : y + 22} text={label} size={11} anchor="middle" weight={600} />
{/snippet}

{#snippet light(ps: { x: number; inward: boolean; key: string }[], rowTop: number, ox: number)}
	{#each ps as p (p.key)}
		{#if ox + p.x > 20 && ox + p.x < 940}
			<rect
				x={ox + p.x - 7}
				y={rowTop + LINE - 3}
				width="14"
				height="6"
				rx="3"
				fill="var(--rel-light)"
				opacity={p.inward ? 1 : 0.35}
				filter={p.inward ? 'url(#glow)' : undefined}
			/>
		{/if}
	{/each}
{/snippet}

{#snippet strike(x: number, rowTop: number, glow: number, done: boolean)}
	{#if glow > 0.01}
		<path
			d={bolt(x, rowTop + 62, rowTop + ROOF)}
			fill="none"
			stroke="var(--rel-strike)"
			stroke-width="3"
			stroke-linejoin="round"
			opacity={glow}
			filter="url(#glow)"
		/>
	{/if}
	{#if done}
		<circle
			cx={x}
			cy={rowTop + LINE}
			r={7 + 16 * glow}
			fill="var(--rel-strike)"
			fill-opacity={0.5 * glow}
			stroke="var(--rel-strike)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
	{/if}
{/snippet}

{#snippet scorch(x: number, y: number)}
	<path
		d="M{x - 7} {y} l4 -5 l3 4 l4 -6 l3 7"
		fill="none"
		stroke="var(--rel-strike)"
		stroke-width="2.5"
		stroke-linecap="round"
	/>
{/snippet}

<g>
	<defs>
		<clipPath id="ln-clip"><rect x="16" y="0" width="928" height="600" /></clipPath>
	</defs>

	<!-- ===================== top row: the platform frame ===================== -->
	<g opacity={dimTop}>
		<T
			x={24}
			y={ROWS[0] + 18}
			text="Platform frame"
			size={15}
			weight={650}
			color="var(--rel-plat)"
		/>
		<T x={24} y={ROWS[0] + 36} text="platform clocks: t = {ns(ct)}" size={12} muted />
		<T
			x={936}
			y={ROWS[0] + 18}
			anchor="end"
			weight={650}
			text="strikes: back at t = 0, front at t = 0 — the same moment"
		/>
		<T
			x={936}
			y={ROWS[0] + 35}
			anchor="end"
			size={12}
			opacity={happened(ev.p.meet) ? 1 : 0.45}
			text="the flashes meet at the observer at t = {ns(ev.p.meet.ct)}"
		/>
		<T
			x={936}
			y={ROWS[0] + 51}
			anchor="end"
			size={12}
			opacity={happened(ev.p.pFront) ? 1 : 0.45}
			text="the passenger meets the front flash at {ns(ev.p.pFront.ct)}, the back flash at {ns(
				ev.p.pBack.ct
			)}"
		/>
		<line
			x1="16"
			x2="944"
			y1={ROWS[0] + RAIL}
			y2={ROWS[0] + RAIL}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<rect x="16" y={ROWS[0] + DECK} width="928" height="18" rx="2" fill="var(--rel-deck)" />
		<g clip-path="url(#ln-clip)" opacity={fade}>
			{#if happened(ev.p.back)}
				{@render scorch(O1 + ev.p.back.x, ROWS[0] + DECK + 12)}
				{@render scorch(O1 + ev.p.front.x, ROWS[0] + DECK + 12)}
			{/if}
			<Train
				x={O1 + top.trainX}
				y={ROWS[0] + RAIL}
				length={L}
				height={BODY}
				{k}
				cars={2}
				windows={4}
			/>
			{#if happened(ev.p.back)}
				{@render scorch(O1 + ev.p.back.x + beta * ct + 8 * k, ROWS[0] + ROOF + 12)}
				{@render scorch(O1 + ev.p.front.x + beta * ct - 8 * k, ROWS[0] + ROOF + 12)}
			{/if}
			{@render strike(O1 + ev.p.back.x, ROWS[0], strikeGlow(ev.p.back), happened(ev.p.back))}
			{@render strike(O1 + ev.p.front.x, ROWS[0], strikeGlow(ev.p.front), happened(ev.p.front))}
			{@render light(top.pulses, ROWS[0], O1)}
			{@render observer(
				O1 + top.pass,
				ROWS[0],
				'var(--rel-train)',
				'passenger',
				Math.max(ring(ev.p.pFront), ring(ev.p.pBack)),
				false
			)}
		</g>
		{@render observer(O1, ROWS[0], 'var(--rel-plat)', 'observer', ring(ev.p.meet), true)}
	</g>

	<!-- ===================== bottom row: the train frame ===================== -->
	<g opacity={dimBottom}>
		<T x={24} y={ROWS[1] + 18} text="Train frame" size={15} weight={650} color="var(--rel-train)" />
		<T x={24} y={ROWS[1] + 36} text="train clocks: t′ = {ns(ct)}" size={12} muted />
		<T
			x={936}
			y={ROWS[1] + 18}
			anchor="end"
			weight={650}
			text={beta < 0.005
				? 'strikes: both at t′ = 0 — the same moment'
				: `strikes: front at t′ = ${ns(ev.t.front.ct)}, back at t′ = ${ns(ev.t.back.ct)} — front first`}
		/>
		<T
			x={936}
			y={ROWS[1] + 35}
			anchor="end"
			size={12}
			opacity={happened(ev.t.meet) ? 1 : 0.45}
			text="the flashes meet at the observer at t′ = {ns(ev.t.meet.ct)}"
		/>
		<T
			x={936}
			y={ROWS[1] + 51}
			anchor="end"
			size={12}
			opacity={happened(ev.t.pFront) ? 1 : 0.45}
			text="the passenger meets the front flash at {ns(ev.t.pFront.ct)}, the back flash at {ns(
				ev.t.pBack.ct
			)}"
		/>
		<line
			x1="16"
			x2="944"
			y1={ROWS[1] + RAIL}
			y2={ROWS[1] + RAIL}
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<g clip-path="url(#ln-clip)" opacity={fade}>
			<!-- the platform slides left, shortened -->
			<rect
				x={O2 + onPlatform(-L / 2 - 400)}
				y={ROWS[1] + DECK}
				width={(L + 800) * k}
				height="18"
				rx="2"
				fill="var(--rel-deck)"
			/>
			{#if happened(ev.t.back)}
				{@render scorch(O2 + onPlatform(-ev.h), ROWS[1] + DECK + 12)}
			{/if}
			{#if happened(ev.t.front)}
				{@render scorch(O2 + onPlatform(ev.h), ROWS[1] + DECK + 12)}
			{/if}
		</g>
		<Train x={O2} y={ROWS[1] + RAIL} length={L} height={BODY} cars={2} windows={4} />
		<g clip-path="url(#ln-clip)" opacity={fade}>
			{#if happened(ev.t.back)}
				{@render scorch(O2 + ev.t.back.x + 8, ROWS[1] + ROOF + 12)}
			{/if}
			{#if happened(ev.t.front)}
				{@render scorch(O2 + ev.t.front.x - 8, ROWS[1] + ROOF + 12)}
			{/if}
			{@render strike(O2 + ev.t.back.x, ROWS[1], strikeGlow(ev.t.back), happened(ev.t.back))}
			{@render strike(O2 + ev.t.front.x, ROWS[1], strikeGlow(ev.t.front), happened(ev.t.front))}
			{@render light(bottom.pulses, ROWS[1], O2)}
			{@render observer(
				O2 + bottom.obs,
				ROWS[1],
				'var(--rel-plat)',
				'observer',
				ring(ev.t.meet),
				true
			)}
		</g>
		{@render observer(
			O2,
			ROWS[1],
			'var(--rel-train)',
			'passenger',
			Math.max(ring(ev.t.pFront), ring(ev.t.pBack)),
			false
		)}
	</g>
</g>
