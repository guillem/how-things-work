<script lang="ts">
	/**
	 * The body as a diagram: the blood (a loop of vessel in the middle, with
	 * glucose dots circulating; the number of dots follows the glucose level),
	 * glucose coming in from the gut and the liver and going out to the brain
	 * and to muscle and fat, and the pancreas below, measuring the blood.
	 *
	 * Views (`step.hints.view`):
	 *   fuel — the supply and the demand, steady: glucose arrives from the gut
	 *          and the liver as fast as the brain and muscles use it, and the
	 *          level holds at 90 mg/dL. The pancreas is dimmed.
	 *   loop — a 16-second cycle in two halves. After a meal, glucose rises,
	 *          the β-cells release insulin (blue) to muscle, fat and liver, the
	 *          cells take glucose in and the level comes back. Between meals it
	 *          dips, the α-cells release glucagon (green) to the liver, the
	 *          liver releases glucose and the level comes back. The caption of
	 *          the active half is lit. These curves are drawn by hand to show
	 *          the idea; the model runs on the next steps.
	 *
	 * Reduced motion freezes the loop at t = 2.5 s: glucose up after a meal and
	 * insulin on its way, with both captions readable.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, along, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';

	let { step, t, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'fuel'));
	const loopW = new Tween(
		untrack(() => (view === 'loop' ? 1 : 0)),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const target = view === 'loop' ? 1 : 0;
		const duration = untrack(() => (reduced ? 0 : 800));
		untrack(() => loopW.set(target, { duration }));
	});
	const lw = $derived(loopW.current);

	// ---- the cycle (loop view) -------------------------------------------------------
	const PERIOD = 16;
	const ph = $derived(cycle(t, PERIOD));
	/** Smooth bump over [a, b] of the phase. */
	const bump = (a: number, b: number, x: number) => {
		const m = (a + b) / 2;
		return smoothstep(a, m, x) * (1 - smoothstep(m, b, x));
	};
	// First half: meal → glucose up → insulin; second half: dip → glucagon.
	const mealIn = $derived(bump(0.02, 0.28, ph));
	const insulin = $derived(bump(0.08, 0.42, ph));
	const dip = $derived(bump(0.55, 0.85, ph));
	const glucagon = $derived(bump(0.6, 0.95, ph));
	const glucose = $derived(90 + lw * (60 * bump(0.04, 0.44, ph) - 28 * dip));

	// ---- flows (0–1 strength) ----------------------------------------------------------
	const flows = $derived({
		gut: 0.45 * (1 - lw) + lw * mealIn,
		liverOut: 0.45 * (1 - lw) + lw * (0.2 + 0.8 * glucagon) * (1 - insulin),
		liverIn: lw * insulin,
		brain: 0.5,
		muscle: 0.4 * (1 - lw) + lw * (0.15 + 0.85 * insulin)
	});

	// ---- geometry ------------------------------------------------------------------------
	const CX = 480;
	const CY = 300;
	const RX = 150;
	const RY = 92;
	/** The vessel loop: an ellipse-ish superellipse. */
	const vessel: Point[] = Array.from({ length: 73 }, (_, k) => {
		const a = (k / 72) * Math.PI * 2;
		const c = Math.cos(a);
		const s = Math.sin(a);
		return {
			x: CX + RX * Math.sign(c) * Math.abs(c) ** 0.6,
			y: CY + RY * Math.sign(s) * Math.abs(s) ** 0.6
		};
	});
	const vesselD =
		vessel.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + 'Z';

	const DOTS = 30;
	const shownDots = $derived(Math.max(4, Math.min(DOTS, (glucose - 30) / 4)));
	const blood = $derived(
		Array.from({ length: DOTS }, (_, k) => {
			const p = along(vessel, cycle(t, 12, k / DOTS));
			// Spread the visible dots around the loop: show them in a shuffled order.
			const rank = (k * 7) % DOTS;
			return { k, x: p.x, y: p.y, o: smoothstep(rank - 0.5, rank + 0.5, shownDots) };
		})
	);

	interface Pipe {
		id: string;
		pts: Point[];
		color: string;
		strength: number;
	}
	const pipes: Omit<Pipe, 'strength'>[] = [
		{
			id: 'gut',
			pts: [
				{ x: 218, y: 168 },
				{ x: 290, y: 190 },
				{ x: 352, y: 232 }
			],
			color: 'var(--hm-gut)'
		},
		{
			id: 'liverOut',
			pts: [
				{ x: 222, y: 404 },
				{ x: 290, y: 394 },
				{ x: 350, y: 364 }
			],
			color: 'var(--hm-liver)'
		},
		{
			id: 'liverIn',
			pts: [
				{ x: 354, y: 380 },
				{ x: 296, y: 414 },
				{ x: 228, y: 426 }
			],
			color: 'var(--hm-glucose)'
		},
		{
			id: 'brain',
			pts: [
				{ x: 608, y: 232 },
				{ x: 670, y: 190 },
				{ x: 742, y: 168 }
			],
			color: 'var(--hm-glucose)'
		},
		{
			id: 'muscle',
			pts: [
				{ x: 610, y: 364 },
				{ x: 670, y: 398 },
				{ x: 738, y: 410 }
			],
			color: 'var(--hm-glucose)'
		}
	];
	const pipeDots = $derived(
		pipes.map((p) => {
			const strength = flows[p.id as keyof typeof flows];
			const n = 5;
			const dots = Array.from({ length: n }, (_, k) => {
				const uu = cycle(t, 2.6, k / n);
				const pt = along(p.pts, uu);
				const o =
					smoothstep(0.05, 0.6, strength) * smoothstep(0, 0.12, uu) * (1 - smoothstep(0.85, 1, uu));
				return { k, x: pt.x, y: pt.y, o };
			});
			return {
				...p,
				strength,
				d: p.pts.map((q, k) => `${k ? 'L' : 'M'}${q.x} ${q.y}`).join(' '),
				dots
			};
		})
	);

	// ---- hormones (loop view) -----------------------------------------------------------
	const routes = [
		{
			id: 'ins-muscle',
			pts: [
				{ x: 520, y: 512 },
				{ x: 640, y: 500 },
				{ x: 760, y: 452 }
			],
			color: 'var(--hm-insulin)',
			kind: 'insulin'
		},
		{
			id: 'ins-liver',
			pts: [
				{ x: 440, y: 512 },
				{ x: 320, y: 500 },
				{ x: 214, y: 458 }
			],
			color: 'var(--hm-insulin)',
			kind: 'insulin'
		},
		{
			id: 'gcg-liver',
			pts: [
				{ x: 440, y: 532 },
				{ x: 310, y: 524 },
				{ x: 196, y: 474 }
			],
			color: 'var(--hm-glucagon)',
			kind: 'glucagon'
		}
	];
	const hormoneDots = $derived(
		routes.map((r) => {
			const s = lw * (r.kind === 'insulin' ? insulin : glucagon);
			const n = 4;
			return {
				...r,
				s,
				d: r.pts.map((q, k) => `${k ? 'L' : 'M'}${q.x} ${q.y}`).join(' '),
				dots: Array.from({ length: n }, (_, k) => {
					const uu = cycle(t, 2.2, k / n);
					const pt = along(r.pts, uu);
					return {
						k,
						x: pt.x,
						y: pt.y,
						o: smoothstep(0.1, 0.5, s) * smoothstep(0, 0.12, uu) * (1 - smoothstep(0.85, 1, uu))
					};
				})
			};
		})
	);
	const dimPancreas = $derived(0.4 + 0.6 * lw);
	const capA = $derived(reduced ? 1 : 0.35 + 0.65 * smoothstep(0.05, 0.3, insulin + mealIn));
	const capB = $derived(reduced ? 1 : 0.35 + 0.65 * smoothstep(0.05, 0.3, glucagon + dip));
	const zoneText = $derived(glucose > 100 ? 'above fasting' : glucose < 70 ? 'low' : 'normal');
</script>

<g>
	<!-- the vessel loop -->
	<path d={vesselD} fill="none" stroke="var(--hm-blood-edge)" stroke-width="30" opacity="0.18" />
	<path d={vesselD} fill="none" stroke="var(--hm-blood)" stroke-width="24" />
	{#each blood as b (b.k)}
		<circle cx={b.x} cy={b.y} r="4" fill="var(--hm-glucose)" opacity={b.o} />
	{/each}

	<!-- readout in the middle of the loop -->
	<Label x={CX} y={CY - 18} text="glucose in the blood" size={13} weight={600} />
	<text
		x={CX}
		y={CY + 16}
		text-anchor="middle"
		font-size="28"
		font-weight="600"
		style:fill="var(--hm-glucose)"
		>{Math.round(glucose)}<tspan font-size="14" dx="5" font-weight="500">mg/dL</tspan></text
	>
	<text x={CX} y={CY + 38} text-anchor="middle" font-size="12" class="muted"
		>{(glucose / 18).toFixed(1)} mmol/L · {zoneText}</text
	>

	<!-- glucose pipes -->
	{#each pipeDots as p (p.id)}
		<path
			d={p.d}
			fill="none"
			stroke={p.color}
			stroke-width={2 + 8 * p.strength}
			stroke-linecap="round"
			opacity="0.25"
		/>
		{#each p.dots as d (d.k)}
			<circle cx={d.x} cy={d.y} r="3.4" fill="var(--hm-glucose)" opacity={d.o} />
		{/each}
	{/each}

	<!-- organs -->
	<!-- gut -->
	<g transform="translate(150 150)">
		<rect
			x="-62"
			y="-36"
			width="124"
			height="72"
			rx="30"
			fill="var(--hm-gut)"
			opacity="0.18"
			stroke="var(--hm-gut)"
		/>
		<path
			d="M-40 -8 q10 -16 20 0 t20 0 t20 0 t20 0"
			fill="none"
			stroke="var(--hm-gut)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path
			d="M-40 12 q10 -16 20 0 t20 0 t20 0 t20 0"
			fill="none"
			stroke="var(--hm-gut)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	</g>
	<Label x={150} y={100} text="gut: glucose from food" size={13} weight={600} />

	<!-- liver -->
	<g transform="translate(150 430)">
		<path
			d="M-66 -22 C -40 -46, 40 -44, 64 -26 C 70 -8, 40 26, -6 34 C -40 36, -70 12, -66 -22 Z"
			fill="var(--hm-liver)"
			opacity="0.85"
		/>
	</g>
	<Label x={150} y={494} text="liver: stores and releases glucose" size={13} weight={600} />

	<!-- brain -->
	<g transform="translate(810 160)">
		<ellipse rx="58" ry="40" fill="var(--hm-muscle)" opacity="0.14" stroke="var(--hm-muscle)" />
		<path
			d="M-36 -6 q12 -18 24 0 t24 0 t24 0 M-30 14 q12 -14 24 0 t24 0 t24 0"
			fill="none"
			stroke="var(--hm-muscle)"
			stroke-width="2"
			opacity="0.7"
		/>
	</g>
	<Label x={810} y={222} text="brain: needs glucose all the time" size={13} weight={600} />

	<!-- muscle and fat -->
	<g transform="translate(810 420)">
		<rect x="-60" y="-34" width="120" height="68" rx="16" fill="var(--hm-muscle)" opacity="0.8" />
		{#each [-36, -18, 0, 18, 36] as dx (dx)}
			<line
				x1={dx}
				x2={dx}
				y1="-24"
				y2="24"
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity="0.5"
			/>
		{/each}
	</g>
	<Label x={810} y={480} text="muscle and fat cells" size={13} weight={600} />

	<!-- pancreas and its islet -->
	<g opacity={dimPancreas}>
		<line
			x1={CX}
			x2={CX}
			y1={CY + RY + 14}
			y2={492}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
		/>
		<Label x={CX + 8} y={CY + RY + 44} text="measures glucose" size={11} anchor="start" muted />
		<path
			d="M392 524 C 410 500, 520 494, 580 506 C 600 512, 600 538, 576 542 C 520 548, 420 552, 396 544 C 384 540, 384 532, 392 524 Z"
			fill="var(--hm-pancreas)"
			opacity="0.6"
		/>
		<circle cx={CX} cy={522} r="17" fill="var(--surface)" stroke="var(--border)" />
		<circle cx={CX - 6} cy={517} r={5 + 2 * lw * insulin} fill="var(--hm-insulin)" />
		<circle cx={CX + 7} cy={519} r="4.5" fill="var(--hm-insulin)" />
		<circle cx={CX} cy={530} r={4.5 + 2 * lw * glucagon} fill="var(--hm-glucagon)" />
		<Label
			x={CX}
			y={578}
			text="pancreas: an islet with β-cells (insulin) and α-cells (glucagon)"
			size={12}
			weight={600}
		/>
	</g>

	<!-- hormone routes (loop view) -->
	{#if lw > 0.01}
		{#each hormoneDots as r (r.id)}
			<path
				d={r.d}
				fill="none"
				stroke={r.color}
				stroke-width="2"
				stroke-dasharray="4 5"
				opacity={lw * (0.25 + 0.5 * r.s)}
			/>
			{#each r.dots as d (d.k)}
				<rect
					x={d.x - 3.5}
					y={d.y - 3.5}
					width="7"
					height="7"
					rx="1.5"
					fill={r.color}
					opacity={d.o}
				/>
			{/each}
		{/each}

		<!-- captions: what happens in each half -->
		<g opacity={lw}>
			<rect
				x={250}
				y={18}
				width={460}
				height={64}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<text x={268} y={44} font-size="13" opacity={capA}
				><tspan font-weight="600" style:fill="var(--hm-glucose)">After a meal:</tspan> glucose rises
				→ β-cells release <tspan font-weight="600" style:fill="var(--hm-insulin)">insulin</tspan> → cells
				take glucose in</text
			>
			<text x={268} y={68} font-size="13" opacity={capB}
				><tspan font-weight="600" style:fill="var(--hm-glucose)">Between meals:</tspan> glucose
				falls → α-cells release
				<tspan font-weight="600" style:fill="var(--hm-glucagon)">glucagon</tspan> → liver releases glucose</text
			>
		</g>
	{:else}
		<g opacity={1 - lw}>
			<Label
				x={CX}
				y={44}
				text="Supply (gut, liver) and demand (brain, muscles) balance:"
				size={14}
				weight={600}
			/>
			<Label
				x={CX}
				y={66}
				text="the level stays steady between about 70 and 100 mg/dL after a night's fast"
				size={13}
				muted
			/>
		</g>
	{/if}
</g>
