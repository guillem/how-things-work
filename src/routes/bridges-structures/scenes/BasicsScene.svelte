<script lang="ts">
	/**
	 * The first chapter: one steel scaffolding tube (48.3 mm, `TUBE` in the model),
	 * pulled and pushed.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   axial  — side by side, the tube hanging from a beam holding a weight (tension,
	 *            blue) and the tube standing on the ground holding the same weight
	 *            (compression, red). Force arrows at both ends (the load and the
	 *            support's equal and opposite reaction), a tiny exaggerated stretch /
	 *            squash, and a gauge of load ÷ limit. The pushed post is 2 m long, so
	 *            above ~57 kN it buckles (a teaser for the next step).
	 *   buckle — one post of `params.length` metres drawn to scale next to a person,
	 *            and a chart of the largest push it can take against its length:
	 *            Euler's curve capped by crushing.
	 *
	 * The weights are lowered into place during the first ~1.6 s of the axial step
	 * (a pure function of t). The buckled bow grows with a 1 s tween from the moment
	 * the load passes the limit, then holds.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS overrides
	 * SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { Axes, areaPath, clamp, easeOut, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { bucklingLoad, pushLimit, yieldLoad } from '../structure';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- model numbers ------------------------------------------------------------
	const YIELD_KN = yieldLoad() / 1000; // ≈ 113 kN
	const AXIAL_LENGTH = 2; // m, the posts of the first step
	const PUSH_KN_AXIAL = pushLimit(AXIAL_LENGTH) / 1000; // ≈ 57 kN

	const load = $derived(clamp(Number(params.load ?? 40), 0, 100));
	const length = $derived(clamp(Number(params.length ?? 2), 1, 6));
	const limitKn = $derived(pushLimit(length) / 1000);

	// ---- phases -------------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'axial') === 'buckle' ? 'buckle' : 'axial');
	const wAxial = new Tween(1, { duration: 700, easing: cubicInOut });
	const wBuckle = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		untrack(() => {
			const d = reduced ? 0 : 700;
			wAxial.set(p === 'axial' ? 1 : 0, { duration: d });
			wBuckle.set(p === 'buckle' ? 1 : 0, { duration: d });
		});
	});

	// Bow of a buckled post: grows over ~1 s once the load passes the limit, then holds.
	const overAxial = $derived(load > PUSH_KN_AXIAL);
	const overBuckle = $derived(load > limitKn);
	const bowAxial = new Tween(0, { duration: 1000, easing: cubicOut });
	const bowBuckle = new Tween(0, { duration: 1000, easing: cubicOut });
	$effect(() => {
		const on = overAxial;
		untrack(() => bowAxial.set(on ? 1 : 0, { duration: reduced ? 0 : on ? 1000 : 400 }));
	});
	$effect(() => {
		const on = overBuckle;
		untrack(() => bowBuckle.set(on ? 1 : 0, { duration: reduced ? 0 : on ? 1000 : 400 }));
	});

	// ---- helpers ------------------------------------------------------------------
	const mix = (token: string, p: number) =>
		`color-mix(in oklab, var(${token}) ${Math.round(clamp(p, 0, 100))}%, var(--struct-steel))`;
	/** Colour strength from utilisation: 0 → plain steel, 1 → the full colour. */
	const strength = (u: number) => (u <= 0 ? 0 : 20 + 80 * clamp(u));
	const tonnes = (kn: number) => {
		const v = kn / 9.81;
		if (v < 0.05) return '0 tonnes';
		const s = v < 2 ? v.toFixed(1) : String(Math.round(v));
		return `≈ ${s} ${s === '1' || s === '1.0' ? 'tonne' : 'tonnes'}`;
	};
	const kn = (v: number) => `${Math.round(v)} kN`;
	const weightBox = (kN: number, k = 1) => {
		const s = Math.sqrt(clamp(kN / 100));
		return { w: (52 + 44 * s) * k, h: (30 + 34 * s) * k };
	};
	/** A post as a polyline from its foot (x, y0) up `len` px, bowed sideways by `amp`. */
	const postPath = (x: number, y0: number, len: number, amp: number) => {
		let d = '';
		for (let i = 0; i <= 16; i++) {
			const u = i / 16;
			d += `${i ? 'L' : 'M'}${(x + amp * Math.sin(Math.PI * u)).toFixed(1)} ${(y0 - u * len).toFixed(1)}`;
		}
		return d;
	};
	/** How far the top drops when a post of length `len` bows by `amp` (arc length kept). */
	const sinkOf = (len: number, amp: number) => (Math.PI ** 2 * amp * amp) / (4 * len);

	// ---- axial step ------------------------------------------------------------------
	const PPM = 100; // px per metre
	const TUBE_W = 10; // drawn tube width (exaggerated ≈ 2×)
	const LCX = 250; // left set-up (pulled)
	const RCX = 700; // right set-up (pushed)
	const CEIL = 118; // underside of the beam the left tube hangs from
	const GROUND = 480; // ground under the right post
	const TUBE_LEN = AXIAL_LENGTH * PPM;

	// Settle: the right weight is lowered onto the post, the left one let go on its hook;
	// then the load comes on.
	const lower = $derived(easeOut(clamp(t / 1.1)));
	const take = $derived(smoothstep(0.9, 1.7, t));
	const eff = $derived(load * take); // kN carried right now
	const uPull = $derived(eff / YIELD_KN);
	const uPush = $derived(eff / PUSH_KN_AXIAL);
	const stretch = $derived(5 * clamp(uPull)); // exaggerated
	const ampA = $derived(18 * bowAxial.current * take);
	const squash = $derived(5 * clamp(uPush) + sinkOf(TUBE_LEN, ampA));
	const boxA = $derived(weightBox(load));
	const arrowLen = $derived(16 + 50 * clamp(eff / 100));

	const leftBottom = $derived(CEIL + TUBE_LEN + stretch);
	const leftBoxY = $derived(leftBottom + 12 - (1 - lower) * 14);
	const rightTop = $derived(GROUND - TUBE_LEN + squash);
	const rightBoxY = $derived(rightTop - boxA.h - (1 - lower) * 46);

	const pullColor = $derived(mix('--struct-tension', strength(uPull)));
	const pushBuckled = $derived(overAxial && take > 0.5);
	const pushColor = $derived(
		pushBuckled ? 'var(--struct-fail)' : mix('--struct-compression', strength(uPush))
	);

	// ---- buckling step ------------------------------------------------------------
	const S = 62; // px per metre
	const BG = 520; // ground line
	const PX = 300; // post x
	const lenPx = $derived(length * S);
	const ampB = $derived(Math.max(16, 0.1 * lenPx) * bowBuckle.current);
	const topB = $derived(BG - lenPx + sinkOf(lenPx, ampB));
	const boxB = $derived(weightBox(load, 0.85));
	const uB = $derived(load / limitKn);
	const postColorB = $derived(
		overBuckle ? 'var(--struct-fail)' : mix('--struct-compression', strength(uB))
	);

	// Chart: the largest push vs length.
	const CL = 584;
	const CR = 924;
	const CT = 96;
	const CB = 452;
	const KMAX = 125;
	const sx = scale([0, 6], [CL, CR]);
	const sy = scale([0, KMAX], [CB, CT]);
	const curve = Array.from({ length: 119 }, (_, i) => {
		const L = 0.1 + i * 0.05;
		return { L, k: pushLimit(L) / 1000 };
	});
	const curveD = linePath(
		curve,
		(d) => d.L,
		(d) => d.k,
		sx,
		sy
	);
	const failD = areaPath(
		curve,
		(d) => d.L,
		(d) => d.k,
		() => KMAX,
		sx,
		sy
	);
	const G2 = bucklingLoad(2) / 1000;
	const G4 = bucklingLoad(4) / 1000;
	const guideOn = (L: number) => 0.65 + 0.35 * (1 - smoothstep(0.15, 0.6, Math.abs(length - L)));
</script>

<g>
	<!-- ====================================================== pulled vs pushed -->
	{#if wAxial.current > 0.01}
		<g opacity={wAxial.current}>
			<!-- titles -->
			{@render txt(LCX, 46, 'Pulled: tension', 17, {
				anchor: 'middle',
				weight: 650,
				color: 'var(--struct-tension)'
			})}
			{@render txt(LCX, 68, 'a steel tube hanging from a beam', 12, {
				anchor: 'middle',
				muted: true
			})}
			{@render txt(RCX, 46, 'Pushed: compression', 17, {
				anchor: 'middle',
				weight: 650,
				color: 'var(--struct-compression)'
			})}
			{@render txt(RCX, 68, 'the same tube standing on the ground', 12, {
				anchor: 'middle',
				muted: true
			})}

			<!-- left: beam overhead -->
			<rect
				x={LCX - 110}
				y={CEIL - 22}
				width="220"
				height="22"
				rx="3"
				fill="var(--struct-steel)"
				opacity="0.55"
				stroke="var(--struct-cable)"
			/>
			<rect x={LCX - 16} y={CEIL - 2} width="32" height="6" rx="1.5" fill="var(--struct-cable)" />
			<g opacity={take}>
				{@render txt(LCX - 18, CEIL + TUBE_LEN / 2 + 4, 'slightly stretched', 11, {
					anchor: 'end',
					muted: true
				})}
			</g>
			<rect
				x={LCX - TUBE_W / 2}
				y={CEIL + 4}
				width={TUBE_W}
				height={leftBottom - CEIL - 4}
				rx="2"
				fill={pullColor}
			/>
			<!-- hook and weight -->
			<path
				d="M{LCX} {leftBottom} L{LCX} {leftBoxY - 2}"
				stroke="var(--struct-cable)"
				stroke-width="2.5"
			/>
			<g opacity={smoothstep(0, 0.5, t)}>
				{@render weight(LCX, leftBoxY, boxA.w, boxA.h)}
			</g>

			<!-- left forces: pointing away from the tube's middle = pulled -->
			<g opacity={take}>
				{@render arrow(LCX + 40, CEIL + 70, CEIL + 70 - arrowLen)}
				{@render txt(LCX + 54, CEIL + 36, 'the beam pulls up', 12, { muted: true })}
				{@render txt(LCX + 54, CEIL + 52, kn(load), 13, { weight: 600 })}
				{@render arrow(LCX + 40, CEIL + TUBE_LEN - 70, CEIL + TUBE_LEN - 70 + arrowLen)}
				{@render txt(LCX + 54, CEIL + TUBE_LEN - 36, 'the weight pulls down', 12, {
					muted: true
				})}
				{@render txt(LCX + 54, CEIL + TUBE_LEN - 20, kn(load), 13, { weight: 600 })}
				{@render txt(LCX + 54, CEIL + TUBE_LEN / 2 + 4, 'equal and opposite', 11, {
					muted: true,
					opacity: 0.85
				})}
			</g>

			<!-- right: ground -->
			<rect x={RCX - 140} y={GROUND} width="280" height="26" rx="3" fill="var(--struct-ground)" />
			<line
				x1={RCX - 140}
				x2={RCX + 140}
				y1={GROUND}
				y2={GROUND}
				stroke="var(--struct-ground-edge)"
				stroke-width="2"
			/>
			{#if !pushBuckled}
				<g opacity={take}>
					{@render txt(RCX - 18, (rightTop + GROUND) / 2 + 4, 'slightly squashed', 11, {
						anchor: 'end',
						muted: true
					})}
				</g>
			{/if}
			{#if pushBuckled}
				<path
					d={postPath(RCX, GROUND, GROUND - rightTop, ampA)}
					fill="none"
					stroke="var(--struct-fail)"
					stroke-width={TUBE_W + 8}
					opacity="0.3"
					stroke-linecap="round"
				/>
			{/if}
			<path
				d={postPath(RCX, GROUND, GROUND - rightTop, ampA)}
				fill="none"
				stroke={pushColor}
				stroke-width={TUBE_W}
			/>
			<rect x={RCX - 16} y={GROUND - 4} width="32" height="5" rx="1.5" fill="var(--struct-cable)" />
			<rect
				x={RCX - 14}
				y={rightTop - 2}
				width="28"
				height="4"
				rx="1.5"
				fill="var(--struct-cable)"
			/>
			{@render weight(RCX, rightBoxY, boxA.w, boxA.h)}

			<!-- right forces: pointing into the tube's middle = pushed -->
			<g opacity={take}>
				{@render arrow(RCX + 40, rightTop, rightTop + arrowLen)}
				{@render txt(RCX + 54, rightTop + 30, 'the weight pushes down', 12, { muted: true })}
				{@render txt(RCX + 54, rightTop + 46, kn(load), 13, { weight: 600 })}
				{@render arrow(RCX + 40, GROUND - 4, GROUND - 4 - arrowLen)}
				{@render txt(RCX + 54, GROUND - 46, 'the ground pushes back up', 12, { muted: true })}
				{@render txt(RCX + 54, GROUND - 30, kn(load), 13, { weight: 600 })}
				{@render txt(RCX + 54, (rightTop + GROUND) / 2 + 4, 'equal and opposite', 11, {
					muted: true,
					opacity: 0.85
				})}
			</g>
			{#if pushBuckled}
				<g opacity={smoothstep(0.2, 0.7, bowAxial.current)}>
					{@render pill(RCX - 26, (rightTop + GROUND) / 2 + 4, 'buckles! (next step)', 'end')}
				</g>
			{/if}

			<!-- gauges: load ÷ limit -->
			{@render gauge(
				LCX,
				540,
				uPull,
				'var(--struct-tension)',
				`limit when pulled: ${kn(YIELD_KN)}`,
				false
			)}
			{@render gauge(
				RCX,
				540,
				uPush,
				'var(--struct-compression)',
				`limit when pushed (a 2 m post): ${kn(PUSH_KN_AXIAL)}`,
				pushBuckled
			)}
		</g>
	{/if}

	<!-- ====================================================== buckling -->
	{#if wBuckle.current > 0.01}
		<g opacity={wBuckle.current}>
			<!-- ground -->
			<rect x="24" y={BG} width="440" height="24" rx="3" fill="var(--struct-ground)" />
			<line x1="24" x2="464" y1={BG} y2={BG} stroke="var(--struct-ground-edge)" stroke-width="2" />

			<!-- metre scale -->
			<line x1="66" x2="66" y1={BG} y2={BG - 6 * S} stroke="var(--stage-line)" />
			{#each [0, 1, 2, 3, 4, 5, 6] as m (m)}
				<line x1="60" x2="66" y1={BG - m * S} y2={BG - m * S} stroke="var(--stage-line)" />
				{#if m > 0}
					{@render txt(56, BG - m * S + 4, `${m} m`, 11, { anchor: 'end', muted: true })}
				{/if}
			{/each}

			<!-- a person for size (1.75 m) -->
			{@render person(150, BG, 1.75 * S)}
			{@render txt(150, BG + 40, 'person, 1.75 m', 11, { anchor: 'middle', muted: true })}

			<!-- the post -->
			{#if overBuckle}
				<path
					d={postPath(PX, BG, BG - topB, ampB)}
					fill="none"
					stroke="var(--struct-fail)"
					stroke-width="16"
					opacity="0.3"
					stroke-linecap="round"
				/>
			{/if}
			<path
				d={postPath(PX, BG, BG - topB, ampB)}
				fill="none"
				stroke={postColorB}
				stroke-width="8"
			/>
			<rect x={PX - 14} y={BG - 4} width="28" height="5" rx="1.5" fill="var(--struct-cable)" />
			<rect x={PX - 12} y={topB - 2} width="24" height="4" rx="1.5" fill="var(--struct-cable)" />
			{@render weight(PX, topB - boxB.h, boxB.w, boxB.h)}

			<!-- length dimension -->
			<g opacity="0.8">
				<line x1="362" x2="362" y1={BG} y2={BG - lenPx} stroke="var(--stage-ink-muted)" />
				<line x1="357" x2="367" y1={BG} y2={BG} stroke="var(--stage-ink-muted)" />
				<line x1="357" x2="367" y1={BG - lenPx} y2={BG - lenPx} stroke="var(--stage-ink-muted)" />
			</g>
			{@render txt(372, BG - lenPx / 2 + 5, `${length.toFixed(1)} m`, 14, { weight: 600 })}
			{#if overBuckle}
				<g opacity={smoothstep(0.2, 0.7, bowBuckle.current)}>
					{@render pill(372, BG - lenPx / 2 + 30, 'buckled', 'start')}
				</g>
			{:else}
				{@render txt(372, BG - lenPx / 2 + 26, `${Math.round(100 * uB)}% of its limit`, 12, {
					muted: true
				})}
			{/if}

			<!-- note: pulled, length does not matter -->
			{@render txt(24, 578, `Pulled, the same tube holds ${kn(YIELD_KN)} at any length.`, 13, {
				color: 'var(--struct-tension)',
				weight: 600
			})}

			<!-- chart -->
			{@render txt(CL - 40, 44, 'The largest push the post can take', 16, { weight: 650 })}
			{@render txt(CL - 40, 64, 'before it is crushed or buckles', 12, { muted: true })}
			<path d={failD} fill="var(--struct-compression)" opacity="0.1" />
			<Axes
				{sx}
				{sy}
				xTicks={[0, 1, 2, 3, 4, 5, 6]}
				yTicks={[0, 25, 50, 75, 100, 125]}
				xLabel="length of the post (m)"
				yLabel="kN"
			/>
			{@render txt(sx(4.2), sy(88), 'fails', 15, {
				anchor: 'middle',
				weight: 650,
				color: 'var(--struct-compression)'
			})}
			{@render txt(sx(0.75), sy(40), 'holds', 13, { anchor: 'middle', muted: true })}

			<!-- 2 m and 4 m: twice as long, a quarter of the load -->
			{#each [{ L: 2, k: G2, label: `2 m: ${kn(G2)}` }, { L: 4, k: G4, label: `4 m: ${kn(G4)} (¼)` }] as g (g.L)}
				<g opacity={guideOn(g.L)}>
					<path
						d="M{sx(g.L)} {CB} L{sx(g.L)} {sy(g.k)} L{CL} {sy(g.k)}"
						fill="none"
						stroke="var(--stage-ink-muted)"
						stroke-dasharray="2 4"
					/>
					<circle cx={sx(g.L)} cy={sy(g.k)} r="3.5" fill="var(--stage-ink-muted)" />
					{@render txt(
						sx(g.L) + (g.L === 4 ? -9 : 9),
						sy(g.k) + (g.L === 4 ? 18 : -9),
						g.label,
						12,
						{ muted: true, anchor: g.L === 4 ? 'end' : 'start' }
					)}
				</g>
			{/each}

			<path d={curveD} fill="none" stroke="var(--struct-compression)" stroke-width="2.5" />
			{@render txt(sx(0.15), sy(YIELD_KN) + 17, `crushed: ${kn(YIELD_KN)}`, 11, {
				color: 'var(--struct-compression)'
			})}

			<!-- current length and load -->
			<line
				x1={sx(length)}
				x2={sx(length)}
				y1={CB}
				y2={CT}
				stroke="var(--stage-ink)"
				opacity="0.45"
				stroke-dasharray="4 3"
			/>
			<line
				x1={CL}
				x2={CR}
				y1={sy(load)}
				y2={sy(load)}
				stroke={overBuckle ? 'var(--struct-fail)' : 'var(--stage-ink)'}
				stroke-width="1.5"
				opacity="0.8"
			/>
			{@render txt(CR, sy(load) - 7, `load ${kn(load)}`, 12, { anchor: 'end', weight: 600 })}
			<circle
				cx={sx(length)}
				cy={sy(limitKn)}
				r="5"
				fill="var(--stage-bg)"
				stroke="var(--struct-compression)"
				stroke-width="2"
			/>
			<circle
				cx={sx(length)}
				cy={sy(load)}
				r="6"
				fill={overBuckle ? 'var(--struct-fail)' : 'var(--stage-ink)'}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>

			<!-- readout -->
			{@render txt(
				CL - 40,
				530,
				`At ${length.toFixed(1)} m it can take ${kn(limitKn)}; the load is ${kn(load)}.`,
				13,
				{ weight: 600 }
			)}
			{@render txt(
				CL - 40,
				550,
				overBuckle ? 'Too much: the post bows out sideways and folds.' : 'It holds.',
				12,
				{ weight: overBuckle ? 600 : 500, muted: !overBuckle }
			)}
		</g>
	{/if}
</g>

{#snippet weight(cx: number, y: number, w: number, h: number)}
	<rect x={cx - w / 2} {y} width={w} height={h} rx="5" fill="var(--struct-cable)" />
	<rect
		x={cx - w / 2 + 4}
		y={y + 4}
		width={w - 8}
		height="3"
		rx="1.5"
		fill="var(--stage-bg)"
		opacity="0.25"
	/>
	<text
		x={cx}
		y={y + h / 2 + 5}
		text-anchor="middle"
		font-weight="650"
		style:font-size="14px"
		style:fill="var(--stage-bg)">{kn(load)}</text
	>
	{@render txt(cx - w / 2 - 10, y + h / 2 + 4, tonnes(load), 12, {
		anchor: 'end',
		muted: true
	})}
{/snippet}

{#snippet arrow(x: number, y1: number, y2: number)}
	{@const dir = Math.sign(y2 - y1) || 1}
	<line x1={x} x2={x} {y1} y2={y2 - dir * 8} stroke="var(--stage-ink)" stroke-width="2.5" />
	<path d="M{x - 6} {y2 - dir * 10} L{x} {y2} L{x + 6} {y2 - dir * 10} Z" fill="var(--stage-ink)" />
{/snippet}

{#snippet gauge(cx: number, y: number, u: number, color: string, label: string, failed: boolean)}
	{@const w = 220}
	{@const x0 = cx - w / 2}
	{@render txt(cx, y, label, 12, { anchor: 'middle', muted: true })}
	<rect x={x0} y={y + 8} width={w} height="9" rx="4.5" fill="var(--stage-line)" opacity="0.35" />
	<rect
		x={x0}
		y={y + 8}
		width={Math.max(0, w * clamp(u))}
		height="9"
		rx="4.5"
		fill={failed ? 'var(--struct-fail)' : color}
	/>
	{@render txt(cx, y + 34, failed ? 'over its limit' : `${Math.round(100 * u)}% of its limit`, 12, {
		anchor: 'middle',
		weight: 600,
		color: undefined
	})}
{/snippet}

{#snippet pill(x: number, y: number, text: string, anchor: 'start' | 'end')}
	{@const w = text.length * 7.2 + 18}
	{@const x0 = anchor === 'end' ? x - w : x}
	<rect
		x={x0}
		y={y - 15}
		width={w}
		height="22"
		rx="11"
		fill="var(--surface)"
		stroke="var(--struct-fail)"
		stroke-width="1.5"
	/>
	<text
		x={x0 + w / 2}
		{y}
		text-anchor="middle"
		font-weight="650"
		style:font-size="13px"
		style:fill="var(--stage-ink)">{text}</text
	>
{/snippet}

{#snippet person(x: number, ground: number, h: number)}
	{@const head = h * 0.065}
	<g fill="var(--stage-ink-muted)" opacity="0.55">
		<circle cx={x} cy={ground - h + head} r={head} />
		<!-- body and legs -->
		<path
			d="M{x - h * 0.11} {ground - h * 0.81}
			   Q{x} {ground - h * 0.85} {x + h * 0.11} {ground - h * 0.81}
			   L{x + h * 0.12} {ground - h * 0.47}
			   L{x + h * 0.075} {ground - h * 0.47}
			   L{x + h * 0.07} {ground}
			   L{x + h * 0.015} {ground}
			   L{x} {ground - h * 0.43}
			   L{x - h * 0.015} {ground}
			   L{x - h * 0.07} {ground}
			   L{x - h * 0.075} {ground - h * 0.47}
			   L{x - h * 0.12} {ground - h * 0.47} Z"
		/>
	</g>
{/snippet}

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}
