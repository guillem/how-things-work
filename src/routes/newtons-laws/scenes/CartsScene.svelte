<script lang="ts">
	/**
	 * Carts on a straight track: the first law (a push, then coasting with or
	 * without friction), the second law (the same with sliders and a v–t graph),
	 * the third law (two carts pushed apart by a spring), and head-on collisions
	 * with momentum or kinetic-energy bars before and after.
	 *
	 * All motion comes from `physics.ts` (`push`, `carts`, `kinetic`); every
	 * phase replays on a calm loop (`period`) and fades out and in at the seam.
	 *
	 * View: with one cart (inertia, push) the camera follows the cart once it
	 * reaches the middle of the stage, so a cart that coasts for ever stays in
	 * view while the metre marks scroll past underneath. The px-per-metre scale
	 * and the tick spacing are chosen per run from the top speed (never from t),
	 * so fast pushes do not strobe. With two carts (pair, collide) the view is
	 * fixed (50 px per metre) and carts that run off the end leave a clipped track.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, niceMax, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { G, carts, kinetic, push } from '../physics';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'inertia'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const num = (id: string, d: number) => (offered.has(id) ? Number(params[id] ?? d) : d);

	// ---- formatting ---------------------------------------------------------------
	const minus = (s: string) => s.replace('-', '−');
	/** Fixed decimals, never "−0.0". */
	function fmt(v: number, d = 1) {
		const r = Number(v.toFixed(d));
		return minus((Object.is(r, -0) ? 0 : r).toFixed(d));
	}
	/** Up to two decimals, trailing zeros dropped (6, 2.5, 0.98). */
	function fmtN(v: number) {
		const r = Number(v.toFixed(2));
		return minus(String(Object.is(r, -0) ? 0 : r));
	}
	/** A speed: two decimals below 1 m/s, one above. */
	const fmtV = (v: number) => fmt(v, Math.abs(v) < 0.995 && Math.abs(v) > 0.005 ? 2 : 1);
	/** Two speeds in one sentence, with the same number of decimals. */
	function fmtV2(a: number, b: number) {
		const small = [a, b].some((v) => Math.abs(v) < 0.995 && Math.abs(v) > 0.005);
		return [fmt(a, small ? 2 : 1), fmt(b, small ? 2 : 1)];
	}
	/** Round half away from zero, after removing floating-point noise. */
	const rnd = (x: number) => {
		const c = Number(x.toFixed(6));
		return Math.sign(c) * Math.round(Math.abs(c));
	};
	/**
	 * Rounds `parts` to `d` decimals so that they add up exactly to `total`
	 * rounded the same way (largest remainder): the readouts a reader adds up
	 * always agree with the total shown.
	 */
	function apportion(parts: number[], total: number, d: number) {
		const f = 10 ** d;
		const N = rnd(total * f);
		const raw = parts.map((p) => p * f);
		const n = raw.map(rnd);
		let diff = N - n.reduce((a, b) => a + b, 0);
		while (diff !== 0) {
			const s = Math.sign(diff);
			let best = 0;
			for (let i = 1; i < n.length; i++)
				if ((raw[i] - n[i]) * s > (raw[best] - n[best]) * s) best = i;
			n[best] += s;
			diff -= s;
		}
		return { parts: n.map((v) => v / f), total: N / f };
	}
	/** A velocity arrow's drawn length: proportional, but never too short to show its direction. */
	const vis = (len: number) => Math.sign(len) * Math.max(Math.abs(len), 14);
	/**
	 * Fades a label (and its arrow) spanning [a, b] in x out over the last
	 * 40 px before the stage edges, so carts leaving the view never show
	 * text cut in half.
	 */
	const edgeFade = (a: number, b: number) =>
		smoothstep(16, 56, Math.min(a, b)) * (1 - smoothstep(904, 944, Math.max(a, b)));

	// ---- shared geometry ------------------------------------------------------------
	const TRACK_Y: Record<string, number> = {
		inertia: 320,
		push: 236,
		pair: 262,
		collide: 250,
		energy: 250
	};
	const trackY = Tween.of(() => TRACK_Y[phase] ?? 300, {
		duration: () => (reduced ? 0 : 800),
		easing: cubicInOut
	});
	const ty = $derived(trackY.current);
	const graphIn = Tween.of(() => (phase === 'push' ? 1 : 0), {
		duration: () => (reduced ? 0 : 700),
		easing: cubicInOut
	});
	const energyMix = Tween.of(() => (phase === 'energy' ? 1 : 0), {
		duration: () => (reduced ? 0 : 800),
		easing: cubicInOut
	});

	const WHEEL = 9;
	const cartW = (m: number) => 76 + 10 * m;
	const cartH = (m: number) => 38 + 5 * m;
	/** Vertical middle of a cart's body. */
	const bodyMid = (m: number) => ty - 13 - cartH(m) / 2;
	const bodyTop = (m: number) => ty - 13 - cartH(m);

	// ---- the loop ---------------------------------------------------------------------
	const PERIOD: Record<string, number> = {
		inertia: 12,
		push: 11,
		pair: 7.5,
		collide: 7.5,
		energy: 7.5
	};
	const period = $derived(PERIOD[phase] ?? 10);
	const tau = $derived(reduced ? t : t % period);
	const life = $derived(
		reduced ? 1 : smoothstep(0, 0.35, tau) * (1 - smoothstep(period - 0.6, period, tau))
	);
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.5, t));

	// ================================================================ one cart (inertia, push)
	const MU = 0.05; // rolling friction when the toggle is on
	const T0 = 0.5; // the hand starts pushing
	const PUSH = 1; // …for one second
	const START = 170; // screen x of the cart's centre at x = 0 m
	const FOLLOW = 480; // the camera follows once the cart gets here

	const single = $derived(phase === 'inertia' || phase === 'push');
	const F = $derived(num('force', 6));
	const mass = $derived(num('mass', 2));
	const mu = $derived(params.friction ? MU : 0);
	const fricMax = $derived(mu * mass * G);
	const run = $derived(push(mass, F, PUSH, mu));
	const moves = $derived(run.a > 0);
	const tp = $derived(tau - T0);
	const xNow = $derived(tp > 0 ? run.x(tp) : 0);
	const vNow = $derived(tp > 0 ? run.v(tp) : 0);
	const pushing = $derived(tp > 0 && tp < PUSH && F > 0);
	const released = $derived(tp >= PUSH);
	const stopped = $derived(released && moves && vNow < 1e-6);

	// Scales chosen per run (from the top speed), so they never change mid-run.
	const S1 = $derived(clamp(320 / Math.max(run.vEnd, 0.01), 8, 80)); // px per metre
	const tickStep = $derived([1, 2, 5, 10, 20, 50].find((s) => s * S1 >= 80) ?? 100);
	const VA1 = $derived(Math.min(28, 160 / Math.max(run.vEnd, 0.01))); // px per m/s
	const FA1 = $derived(Math.min(14, 150 / Math.max(F, fricMax, 0.01))); // px per N
	const cam = $derived(Math.max(0, xNow - (FOLLOW - START) / S1));
	const sxW = (xm: number) => START + (xm - cam) * S1;

	const ticks1 = $derived.by(() => {
		const lo = Math.max(0, Math.ceil((cam - START / S1) / tickStep) * tickStep);
		const hi = cam + (960 - START) / S1;
		const out: number[] = [];
		for (let v = lo; v <= hi; v += tickStep) out.push(v);
		return out;
	});

	// Forces acting right now.
	const pushNow = $derived(pushing ? F : 0);
	const fricNow = $derived(
		mu === 0 ? 0 : pushing && !moves ? F : vNow > 1e-6 ? fricMax : 0 // static friction balances a weak push
	);

	const cx1 = $derived(sxW(xNow));
	const contact = $derived(released ? run.x(PUSH) : xNow);
	const retract = $derived(released ? smoothstep(0, 0.5, tp - PUSH) : 0);
	const handX = $derived(sxW(contact) - cartW(mass) / 2 - 26 * retract);

	// v–t graph (push phase)
	const GT = 10; // seconds on the graph
	const gx = scale([0, GT], [110, 880]);
	const vMax = Tween.of(() => niceMax(Math.max(run.vEnd, 1)), {
		duration: () => (reduced ? 0 : 700),
		easing: cubicInOut
	});
	const gy = $derived(scale([0, vMax.current], [540, 326]));
	const vAt = (tg: number) => (tg <= T0 ? 0 : run.v(tg - T0));
	const tDraw = $derived(reduced ? GT : Math.min(tau, GT));
	const curve = $derived.by(() => {
		let d = '';
		const n = Math.floor(tDraw / 0.05);
		for (let i = 0; i <= n; i++) {
			const tg = i * 0.05;
			d += `${i ? 'L' : 'M'}${gx(tg).toFixed(1)} ${gy(vAt(tg)).toFixed(1)}`;
		}
		return d + `L${gx(tDraw).toFixed(1)} ${gy(vAt(tDraw)).toFixed(1)}`;
	});

	const formula = $derived.by(() => {
		if (F === 0) return `a = F ÷ m = 0 ÷ ${fmtN(mass)} = 0 m/s²`;
		if (mu > 0 && !moves)
			return `a = 0: the push (${fmtN(F)} N) cannot beat friction (${fmt(fricMax, 2)} N)`;
		// Once the hand has let go, the formula is about the push that is over.
		const when = released ? 'While pushed: ' : '';
		if (mu === 0) return `${when}a = F ÷ m = ${fmtN(F)} ÷ ${fmtN(mass)} = ${fmtN(run.a)} m/s²`;
		return `${when}a = (push − friction) ÷ m = (${fmtN(F)} − ${fmt(fricMax, 2)}) ÷ ${fmtN(mass)} = ${fmtN(run.a)} m/s²`;
	});

	const status1 = $derived.by(() => {
		if (F === 0)
			return { big: 'No push, no force', small: 'Nothing happens: the cart stays where it is.' };
		if (!moves)
			return {
				big: 'Friction holds it',
				small: `The push (${fmtN(F)} N) is weaker than friction can resist (${fmt(fricMax, 2)} N): the cart does not move.`
			};
		if (tp <= 0) return { big: 'A hand is about to push…', small: `${fmtN(F)} N for one second.` };
		if (pushing)
			return {
				big: 'Force → the cart speeds up',
				small: `The hand pushes with ${fmtN(F)} N${mu ? `, friction resists with ${fmt(fricMax, 2)} N` : ''}.`
			};
		if (stopped)
			return { big: 'Friction has stopped it', small: 'No motion now, so no friction either.' };
		if (mu > 0)
			return {
				big: 'Friction force → slows down',
				small: `Friction (${fmt(fricMax, 2)} N) pushes backwards: the speed drops by ${fmt(fricMax / mass, 2)} m/s every second.`
			};
		return {
			big: 'No force → constant speed',
			small: `The hand has let go. Nothing pushes or pulls, so the speed stays ${fmtV(run.vEnd)} m/s.`
		};
	});

	// ================================================================ pair (third law)
	const J = 1; // impulse from the spring, N·s
	const TR = 1; // release
	const DP = 0.3; // the spring pushes for 0.3 s
	const FP = J / DP;
	const SP = 50; // px per metre
	const VAP = 30; // px per m/s
	const G0 = 18; // gap with the spring squashed

	const pm1 = $derived(num('m1', 1));
	const pm2 = $derived(num('m2', 1));
	const pl = $derived(push(pm1, FP, DP));
	const pr = $derived(push(pm2, FP, DP));
	const tr = $derived(tau - TR);
	const pxl = $derived(tr > 0 ? -pl.x(tr) : 0);
	const pxr = $derived(tr > 0 ? pr.x(tr) : 0);
	const pvl = $derived(tr > 0 ? -pl.v(tr) : 0);
	const pvr = $derived(tr > 0 ? pr.v(tr) : 0);
	const springing = $derived(tr > 0 && tr < DP);
	const leftFront = $derived(480 - G0 / 2 + pxl * SP);
	const rightRear = $derived(480 + G0 / 2 + pxr * SP);
	const springLen = $derived(G0 + (pl.x(DP) + pr.x(DP)) * SP);
	const springPath = $derived.by(() => {
		const x0 = leftFront;
		const len = Math.min(rightRear - leftFront, springLen);
		const y = ty - 13 - Math.min(cartH(pm1), cartH(pm2)) / 2;
		const n = 8;
		let d = `M${x0} ${y}`;
		for (let i = 1; i < n; i++) d += `L${x0 + (len * i) / n} ${y + (i % 2 ? -7 : 7)}`;
		return d + `L${x0 + len} ${y}`;
	});
	const ratioWords = $derived.by(() => {
		if (pm1 === pm2) return 'Equal masses: equal speeds, in opposite directions.';
		const heavy = pm1 > pm2 ? 'left' : 'right';
		const r = Math.max(pm1, pm2) / Math.min(pm1, pm2);
		const part =
			(
				{
					1.5: 'two thirds',
					2: 'half',
					2.5: 'two fifths',
					3: 'a third',
					4: 'a quarter',
					5: 'a fifth',
					10: 'a tenth'
				} as Record<number, string>
			)[r] ?? null;
		return `The ${heavy} cart has ${fmtN(r)}× the mass, so it moves off at ${part ? `${part} of the speed` : `the speed ÷ ${fmtN(r)}`}.`;
	});

	// ================================================================ collide / energy
	const SC = 50; // px per metre
	const VAC = 22; // px per m/s
	const TPRE = 0.5; // carts sit still for a moment
	const TC = 1.4; // they meet 1.4 s after setting off (crash at 1.9 s)
	const XC = 480; // where they meet

	const cm1 = $derived(num('m1', 1));
	const cu1 = $derived(num('u1', 2));
	const cm2 = $derived(num('m2', 1));
	const cu2 = $derived(num('u2', 0));
	const e = $derived(num('bounce', 1));
	const w1 = $derived(cartW(cm1));
	const w2 = $derived(cartW(cm2));
	const meets = $derived(cu1 - cu2 > 1e-9);
	// Left edges, in px; chosen so that the crash happens at XC after TC seconds.
	const x10 = $derived(meets ? XC - w1 - cu1 * TC * SC : 120);
	const x20 = $derived(meets ? XC - cu2 * TC * SC : 120 + w1 + 140);
	const crash = $derived(
		carts({ m1: cm1, u1: cu1, x1: x10 / SC, m2: cm2, u2: cu2, x2: x20 / SC, e }, w1 / SC)
	);
	const tm = $derived(Math.max(0, tau - TPRE));
	const crashed = $derived(meets && tm >= crash.tc);
	const afterIn = $derived(meets ? smoothstep(crash.tc, crash.tc + 0.3, tm) : 1);
	const cv1 = $derived(meets ? crash.velocity1(tm) : cu1);
	const cv2 = $derived(meets ? crash.velocity2(tm) : cu2);
	const cxa = $derived(crash.x1(tm) * SC + w1 / 2);
	const cxb = $derived(crash.x2(tm) * SC + w2 / 2);
	const fv1 = $derived(meets ? crash.v1 : cu1);
	const fv2 = $derived(meets ? crash.v2 : cu2);
	const bang = $derived(crashed ? 1 - smoothstep(0.15, 0.35, tm - crash.tc) : 0);

	const pB = $derived([cm1 * cu1, cm2 * cu2, cm1 * cu1 + cm2 * cu2]);
	const pA = $derived([cm1 * fv1, cm2 * fv2, cm1 * fv1 + cm2 * fv2]);
	const kB = $derived([kinetic(cm1, cu1), kinetic(cm2, cu2)]);
	const kA = $derived([kinetic(cm1, fv1), kinetic(cm2, fv2)]);
	const keB = $derived(kB[0] + kB[1]);
	const keA = $derived(kA[0] + kA[1]);
	const lost = $derived(Math.max(0, keB - keA));
	// What the bars print: rounded so that the parts add up to the totals shown,
	// the momentum total is the same number before and after, and the kinetic
	// energy after plus the amount lost is exactly the energy before.
	const pShow = $derived.by(() => {
		const before = apportion(pB.slice(0, 2), pB[2], 1);
		const after = apportion(pA.slice(0, 2), pB[2], 1);
		return {
			B: [...before.parts, before.total],
			A: [...after.parts, before.total]
		};
	});
	const kShow = $derived.by(() => {
		const before = apportion(kB, keB, 2);
		const after = apportion(kA, lost < 1e-9 ? keB : keA, 2);
		return {
			B: [...before.parts, before.total],
			A: [...after.parts, after.total],
			lost: Number((before.total - after.total).toFixed(2))
		};
	});
	const pScale = Tween.of(() => niceMax(Math.max(0.5, ...pB.map(Math.abs), ...pA.map(Math.abs))), {
		duration: () => (reduced ? 0 : 700),
		easing: cubicInOut
	});
	const kScale = Tween.of(() => niceMax(Math.max(0.5, keB)), {
		duration: () => (reduced ? 0 : 700),
		easing: cubicInOut
	});

	const outcome = $derived.by(() => {
		if (!meets) {
			if (cu1 === 0 && cu2 === 0) return 'Neither cart moves, so there is no collision.';
			if (cu1 === 0) return 'The left cart is at rest and the right one moves away: no collision.';
			return 'The right cart moves away at least as fast as the left one follows: they never meet.';
		}
		if (!crashed) return `The carts close in at ${fmtV(cu1 - cu2)} m/s…`;
		const still = (v: number) => Math.abs(v) < 1e-6;
		const side = (v: number) => (v < 0 ? 'left' : 'right');
		if (still(fv1 - fv2))
			return still(fv1)
				? 'They stick together and stop dead.'
				: `They stick together and move ${side(fv1)} at ${fmtV(Math.abs(fv1))} m/s.`;
		const [s1, s2] = fmtV2(Math.abs(fv1), Math.abs(fv2));
		if (still(fv1)) return `The left cart stops dead; the right one moves right at ${s2} m/s.`;
		if (fv1 > 0) return `Both carts move on to the right, at ${s1} and ${s2} m/s.`;
		// The left cart ends up moving left: back the way it came, or knocked left from rest.
		const left =
			cu1 > 0
				? `The left cart bounces back at ${s1} m/s`
				: `The left cart is knocked left at ${s1} m/s`;
		if (still(fv2)) return `${left}; the right one stops.`;
		return `${left}; the right one moves ${side(fv2)} at ${s2} m/s.`;
	});

	// bars layout
	const PANELS = [
		{ x0: 64, x1: 444, label: 'Before the crash' },
		{ x0: 516, x1: 896, label: 'After the crash' }
	];
	const ROW = [374, 418, 476];
	const ROWH = [18, 18, 22];
	// The momentum and energy views swap in turn (old out, then new in), so their
	// texts never sit on top of each other half-faded.
	const momView = $derived(1 - smoothstep(0, 0.5, energyMix.current));
	const enView = $derived(smoothstep(0.5, 1, energyMix.current));
	const ROWNAME = $derived([`left cart, ${fmtN(cm1)} kg`, `right cart, ${fmtN(cm2)} kg`, 'total']);
	const PHALF = 130; // px for the momentum scale, either side of zero
	const KLEN = 300; // px for the energy scale
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
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

{#snippet arrow(x1: number, y: number, x2: number, color: string, width = 3)}
	{#if Math.abs(x2 - x1) > 7}
		<line
			{x1}
			x2={x2 - Math.sign(x2 - x1) * 4}
			y1={y}
			y2={y}
			stroke={color}
			stroke-width={width}
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/if}
{/snippet}

{#snippet cart(cx: number, m: number, roll: number)}
	{@const w = cartW(m)}
	{@const h = cartH(m)}
	<rect x={cx - w / 2} y={ty - 13 - h} width={w} height={h} rx="8" fill="var(--mech-cart)" />
	<text
		x={cx}
		y={ty - 13 - h / 2 + 5}
		text-anchor="middle"
		font-weight="600"
		style:font-size="14px"
		style:fill="#fff">{fmtN(m)} kg</text
	>
	{#each [-1, 1] as side (side)}
		{@const wx = cx + side * (w / 2 - 17)}
		<circle
			cx={wx}
			cy={ty - WHEEL}
			r={WHEEL}
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<line
			x1={wx - Math.cos(roll) * (WHEEL - 2)}
			y1={ty - WHEEL - Math.sin(roll) * (WHEEL - 2)}
			x2={wx + Math.cos(roll) * (WHEEL - 2)}
			y2={ty - WHEEL + Math.sin(roll) * (WHEEL - 2)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
	{/each}
{/snippet}

{#snippet hand(hx: number, hy: number, opacity: number)}
	<g {opacity}>
		<rect
			x={hx - 150}
			y={hy - 7}
			width="136"
			height="14"
			rx="7"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<rect
			x={hx - 12}
			y={hy - 22}
			width="9"
			height="12"
			rx="4"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<rect
			x={hx - 18}
			y={hy - 15}
			width="18"
			height="30"
			rx="7"
			fill="var(--surface)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
	</g>
{/snippet}

{#snippet legend(x: number, y: number, items: { c: string; l: string }[])}
	{#each items as item, i (item.l)}
		{@render arrow(x + i * 110, y, x + i * 110 + 26, item.c, 2.5)}
		{@render txt(x + i * 110 + 32, y + 4, item.l, 12, { muted: true })}
	{/each}
{/snippet}

{#snippet bar(x0: number, y: number, len: number, h: number, color: string, opacity = 1)}
	{#if Math.abs(len) > 0.5}
		<rect
			x={Math.min(x0, x0 + len)}
			{y}
			width={Math.abs(len)}
			height={h}
			rx="4"
			fill={color}
			{opacity}
		/>
	{/if}
{/snippet}

<defs>
	<clipPath id="carts-view">
		<rect x="16" y="0" width="928" height="600" />
	</clipPath>
</defs>

<g>
	<!-- the track -->
	<rect x="16" y={ty} width="928" height="7" fill="var(--mech-ground)" />
	<line x1="16" x2="944" y1={ty} y2={ty} stroke="var(--stage-line)" stroke-width="1.5" />

	{#if single}
		<g opacity={fadeIn}>
			<!-- metre marks (they scroll when the view follows the cart) -->
			<g opacity={life}>
				{#each ticks1 as v (v)}
					{@const x = sxW(v)}
					<g opacity={smoothstep(20, 60, x) * (1 - smoothstep(900, 940, x))}>
						<line x1={x} x2={x} y1={ty + 7} y2={ty + 13} stroke="var(--stage-line)" />
						{@render txt(x, ty + 28, `${v} m`, 11, { anchor: 'middle', muted: true })}
					</g>
				{/each}
			</g>

			<!-- cart, hand, arrows -->
			<g opacity={life} clip-path="url(#carts-view)">
				{@render hand(handX, bodyMid(mass), 1 - 0.55 * retract)}
				{@render cart(cx1, mass, (xNow * S1) / WHEEL)}
				{#if vNow > 1e-3}
					{@const y = bodyTop(mass) - 18}
					{@const len = vis(vNow * VA1)}
					{@render arrow(cx1, y, cx1 + len, 'var(--mech-velocity)')}
					{@render txt(cx1 + len / 2, y - 10, `${fmtV(vNow)} m/s`, 13, {
						anchor: 'middle',
						color: 'var(--mech-velocity)',
						weight: 600
					})}
				{/if}
				{#if pushNow > 0}
					{@const x = cx1 + cartW(mass) / 2 + 4}
					{@const y = bodyMid(mass)}
					{@const len = Math.max(pushNow * FA1, 14)}
					{@render arrow(x, y, x + len, 'var(--mech-force)')}
					{@render txt(x + len + 8, y + 4, `push ${fmtN(pushNow)} N`, 13, {
						color: 'var(--mech-force)',
						weight: 600
					})}
				{/if}
				{#if fricNow > 0}
					{@const x = cx1 - cartW(mass) / 2 - 2}
					{@const y = ty - WHEEL}
					{@const len = Math.max(fricNow * FA1, 14)}
					{@render arrow(x, y, x - len, 'var(--mech-force)', 2.5)}
					{@render txt(x - len - 6, y + 4, `friction ${fmt(fricNow, 2)} N`, 12, {
						anchor: 'end',
						color: 'var(--mech-force)',
						weight: 600
					})}
				{/if}
			</g>

			<!-- readouts -->
			{@render txt(944 - 16, 48, `speed ${fmtV(vNow)} m/s`, 16, {
				anchor: 'end',
				weight: 600,
				color: 'var(--mech-velocity)'
			})}
			{@render txt(944 - 16, 70, `distance ${fmt(xNow)} m`, 12, { anchor: 'end', muted: true })}

			{#if phase === 'inertia'}
				{@render legend(32, 44, [
					{ c: 'var(--mech-velocity)', l: 'velocity' },
					{ c: 'var(--mech-force)', l: 'force' }
				])}
				{@render txt(32, 70, mu ? 'Friction on (μ = 0.05)' : 'Friction off', 12, { muted: true })}
				<g opacity={life}>
					{@render txt(480, 418, status1.big, 22, {
						anchor: 'middle',
						weight: 600,
						color: pushing || mu > 0 ? 'var(--mech-force)' : 'var(--mech-velocity)'
					})}
					{@render txt(480, 448, status1.small, 14, { anchor: 'middle', muted: true })}
				</g>
			{:else}
				{@render txt(32, 48, formula, 16, { weight: 600 })}
				<g opacity={life}>
					{@render txt(
						32,
						72,
						`${status1.big}${/[.…]$/.test(status1.big) ? '' : '.'} ${status1.small}`,
						13,
						{ muted: true }
					)}
				</g>
			{/if}

			<!-- v–t graph -->
			{#if graphIn.current > 0.01}
				<g opacity={graphIn.current}>
					<rect
						x={gx(T0)}
						y={gy.range[1]}
						width={gx(T0 + PUSH) - gx(T0)}
						height={gy.range[0] - gy.range[1]}
						fill="var(--mech-force)"
						opacity="0.1"
					/>
					{@render txt((gx(T0) + gx(T0 + PUSH)) / 2, gy.range[1] + 16, 'push', 12, {
						anchor: 'middle',
						color: 'var(--mech-force)',
						weight: 600
					})}
					<Axes sx={gx} sy={gy} xLabel="time (s)" yLabel="speed (m/s)" />
					<g opacity={life}>
						<path
							d={curve}
							fill="none"
							stroke="var(--mech-velocity)"
							stroke-width="2.5"
							stroke-linejoin="round"
						/>
						<circle
							cx={gx(Math.min(tau, GT))}
							cy={gy(vAt(Math.min(tau, GT)))}
							r="4.5"
							fill="var(--mech-velocity)"
						/>
					</g>
				</g>
			{/if}
		</g>
	{:else if phase === 'pair'}
		<g opacity={fadeIn}>
			{#each Array.from({ length: 19 }, (_, i) => i) as v (v)}
				{@const x = 30 + v * SP}
				<line x1={x} x2={x} y1={ty + 7} y2={ty + 13} stroke="var(--stage-line)" />
				{#if v % 2 === 0}
					{@render txt(x, ty + 28, `${v} m`, 11, { anchor: 'middle', muted: true })}
				{/if}
			{/each}

			{@render legend(32, 44, [
				{ c: 'var(--mech-velocity)', l: 'velocity' },
				{ c: 'var(--mech-force)', l: 'force' }
			])}

			<g opacity={life} clip-path="url(#carts-view)">
				<path
					d={springPath}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="2"
					stroke-linejoin="round"
				/>
				{@render cart(leftFront - cartW(pm1) / 2, pm1, (pxl * SP) / WHEEL)}
				{@render cart(rightRear + cartW(pm2) / 2, pm2, (pxr * SP) / WHEEL)}
				{#if tr <= 0}
					{@const y = Math.max(bodyTop(pm1), bodyTop(pm2)) + 4}
					<rect
						x={leftFront - 10}
						{y}
						width={G0 + 20}
						height="5"
						rx="2.5"
						fill="var(--stage-ink-muted)"
					/>
					{@render txt(
						480,
						Math.min(bodyTop(pm1), bodyTop(pm2)) - 14,
						'held together, spring squashed',
						13,
						{ anchor: 'middle', muted: true }
					)}
				{/if}
				{#if springing}
					{@const y = Math.max(bodyTop(pm1), bodyTop(pm2)) - 22}
					{@render arrow(leftFront - 4, y, leftFront - 4 - 70, 'var(--mech-force)')}
					{@render arrow(rightRear + 4, y, rightRear + 4 + 70, 'var(--mech-force)')}
					{@render txt(leftFront - 40, y - 12, `${fmtN(FP)} N`, 13, {
						anchor: 'middle',
						color: 'var(--mech-force)',
						weight: 600
					})}
					{@render txt(rightRear + 40, y - 12, `${fmtN(FP)} N`, 13, {
						anchor: 'middle',
						color: 'var(--mech-force)',
						weight: 600
					})}
				{/if}
				{#each [{ cx: leftFront - cartW(pm1) / 2, m: pm1, v: pvl }, { cx: rightRear + cartW(pm2) / 2, m: pm2, v: pvr }] as c, i (i)}
					{#if Math.abs(c.v) > 1e-3 && !springing}
						{@const y = bodyTop(c.m) - 18}
						{@const len = vis(c.v * VAP)}
						<g
							opacity={edgeFade(
								Math.min(c.cx, c.cx + len / 2 - 30),
								Math.max(c.cx, c.cx + len / 2 + 30)
							)}
						>
							{@render arrow(c.cx, y, c.cx + len, 'var(--mech-velocity)')}
							{@render txt(c.cx + len / 2, y - 10, `${fmtV(Math.abs(c.v))} m/s`, 13, {
								anchor: 'middle',
								color: 'var(--mech-velocity)',
								weight: 600
							})}
						</g>
					{/if}
				{/each}
			</g>

			<!-- words -->
			<g opacity={life}>
				{#if tr <= 0}
					{@render txt(480, 352, 'The catch is about to let go…', 16, {
						anchor: 'middle',
						weight: 600
					})}
				{:else}
					{@render txt(
						480,
						352,
						`Each cart pushed the other equally hard (${fmtN(FP)} N for ${DP} s), in opposite directions`,
						15,
						{ anchor: 'middle', weight: 600, color: 'var(--mech-force)' }
					)}
					{@render txt(480, 378, ratioWords, 14, { anchor: 'middle' })}
				{/if}
			</g>

			<!-- momenta, equal and opposite -->
			{@render txt(
				480,
				424,
				'mass × velocity (kg·m/s); motion to the left counts as negative',
				12,
				{ anchor: 'middle', muted: true }
			)}
			<line x1="480" x2="480" y1="436" y2="566" stroke="var(--stage-line)" />
			{#each [{ l: `left: ${fmtN(pm1)} kg × ${fmtV(pvl)} m/s`, p: pm1 * pvl }, { l: `right: ${fmtN(pm2)} kg × ${fmtV(pvr)} m/s`, p: pm2 * pvr }, { l: 'total', p: pm1 * pvl + pm2 * pvr }] as row, i (i)}
				{@const y = 452 + i * 40}
				{@const len = (row.p / J) * 200}
				{@render txt(row.p < 0 ? 480 + 8 : 480 - 8, y + 13, row.l, 12, {
					anchor: row.p < 0 ? 'start' : 'end',
					muted: true,
					weight: i === 2 ? 600 : 500
				})}
				<g opacity={life}>
					{@render bar(480, y, len, 18, 'var(--mech-momentum)', i === 2 ? 1 : 0.85)}
				</g>
				{@render txt(row.p < 0 ? 480 + len - 8 : 480 + len + 8, y + 14, fmt(row.p), 13, {
					anchor: row.p < 0 ? 'end' : 'start',
					weight: 600,
					color: 'var(--mech-momentum)',
					opacity: life
				})}
			{/each}
		</g>
	{:else}
		<!-- collide / energy -->
		<g opacity={fadeIn}>
			{#each Array.from({ length: 19 }, (_, i) => i) as v (v)}
				{@const x = 30 + v * SC}
				<line x1={x} x2={x} y1={ty + 7} y2={ty + 13} stroke="var(--stage-line)" />
				{#if v % 2 === 0}
					{@render txt(x, ty + 28, `${v} m`, 11, { anchor: 'middle', muted: true })}
				{/if}
			{/each}

			{@render txt(32, 48, outcome, 16, { weight: 600, opacity: life })}
			{@render txt(
				32,
				72,
				`Bounciness ${fmtN(e)}${e === 1 ? ' (perfectly elastic)' : e === 0 ? ' (they stick)' : ''}`,
				12,
				{ muted: true }
			)}
			{@render legend(726, 44, [
				{ c: 'var(--mech-velocity)', l: 'velocity' },
				{ c: 'var(--mech-force)', l: 'force' }
			])}

			<g opacity={life} clip-path="url(#carts-view)">
				{@render cart(cxa, cm1, (cxa - x10 - w1 / 2) / WHEEL)}
				{@render cart(cxb, cm2, (cxb - x20 - w2 / 2) / WHEEL)}
				{#if bang > 0.01}
					{@const y = Math.max(bodyTop(cm1), bodyTop(cm2)) - 22}
					<g opacity={bang}>
						{@render arrow(XC - 4, y, XC - 64, 'var(--mech-force)')}
						{@render arrow(XC + 4, y, XC + 64, 'var(--mech-force)')}
						{@render txt(XC, y - 14, 'equal and opposite forces', 13, {
							anchor: 'middle',
							color: 'var(--mech-force)',
							weight: 600
						})}
					</g>
				{/if}
				{#each [{ cx: cxa, m: cm1, v: cv1 }, { cx: cxb, m: cm2, v: cv2 }] as c, i (i)}
					{@const y = bodyTop(c.m) - 18}
					{#if Math.abs(c.v) > 1e-3 && bang < 0.02}
						{@const len = vis(c.v * VAC)}
						<g
							opacity={edgeFade(
								Math.min(c.cx, c.cx + len / 2 - 30),
								Math.max(c.cx, c.cx + len / 2 + 30)
							)}
						>
							{@render arrow(c.cx, y, c.cx + len, 'var(--mech-velocity)')}
							{@render txt(c.cx + len / 2, y - 10, `${fmtV(Math.abs(c.v))} m/s`, 13, {
								anchor: 'middle',
								color: 'var(--mech-velocity)',
								weight: 600
							})}
						</g>
					{:else if bang < 0.02}
						{@render txt(c.cx, y - 4, 'at rest', 12, {
							anchor: 'middle',
							muted: true,
							opacity: edgeFade(c.cx - 22, c.cx + 22)
						})}
					{/if}
				{/each}
			</g>

			<!-- bars: before and after -->
			{#each PANELS as panel, pi (pi)}
				{@const after = pi === 1}
				{@const show = after ? afterIn * life : 1}
				{@const zero = (panel.x0 + panel.x1) / 2}
				{@const pTot = pB[2]}
				{@const pTotText = fmt(pShow.B[2])}
				{@render txt(panel.x0, 338, after && !meets ? 'Later (no crash)' : panel.label, 14, {
					weight: 600
				})}
				{#if after && meets && !crashed}
					{@render txt((panel.x0 + panel.x1) / 2, 430, 'waiting for the crash…', 13, {
						anchor: 'middle',
						muted: true,
						opacity: life
					})}
				{/if}
				<line
					x1={panel.x0}
					x2={panel.x1}
					y1="455"
					y2="455"
					stroke="var(--stage-grid)"
					stroke-width="1.5"
				/>

				<!-- momentum view -->
				<g opacity={momView}>
					{#if pi === 0}
						{@render txt(panel.x1, 338, 'momentum, kg·m/s', 12, {
							anchor: 'end',
							color: 'var(--mech-momentum)'
						})}
					{/if}
					<line
						x1={zero}
						x2={zero}
						y1="350"
						y2="504"
						stroke="var(--stage-line)"
						opacity={after ? show : 1}
					/>
					{#each [0, 1, 2] as r (r)}
						{@const p = after ? pA[r] : pB[r]}
						{@const shownP = after ? pShow.A[r] : pShow.B[r]}
						{@const len = (p / pScale.current) * PHALF}
						{@render txt(panel.x0, ROW[r] - 6, ROWNAME[r], 11, {
							muted: true,
							weight: r === 2 ? 600 : 500
						})}
						<g opacity={show}>
							{@render bar(zero, ROW[r], len, ROWH[r], 'var(--mech-momentum)', r === 2 ? 1 : 0.8)}
							{@render txt(
								p < 0 ? zero + len - 6 : zero + len + 6,
								ROW[r] + ROWH[r] / 2 + 5,
								fmt(shownP),
								13,
								{
									anchor: p < 0 ? 'end' : 'start',
									weight: 600,
									color: 'var(--mech-momentum)'
								}
							)}
						</g>
					{/each}
				</g>

				<!-- energy view -->
				<g opacity={enView}>
					{#if pi === 0}
						{@render txt(panel.x1, 338, 'kinetic energy, J', 12, {
							anchor: 'end',
							color: 'var(--mech-kinetic)'
						})}
					{/if}
					<line
						x1={panel.x0}
						x2={panel.x0}
						y1="350"
						y2="504"
						stroke="var(--stage-line)"
						opacity={after ? show : 1}
					/>
					{#each [0, 1, 2] as r (r)}
						{@const k = r === 2 ? (after ? keA : keB) : after ? kA[r] : kB[r]}
						{@const len = (k / kScale.current) * KLEN}
						{@const heat = after && r === 2 ? (lost / kScale.current) * KLEN : 0}
						{@const shownK = after ? kShow.A[r] : kShow.B[r]}
						<!-- clear of the axis line at x0 -->
						{@render txt(panel.x0 + 6, ROW[r] - 6, ROWNAME[r], 11, {
							muted: true,
							weight: r === 2 ? 600 : 500
						})}
						<g opacity={show}>
							{@render bar(
								panel.x0,
								ROW[r],
								len,
								ROWH[r],
								'var(--mech-kinetic)',
								r === 2 ? 1 : 0.8
							)}
							{#if heat > 0.5}
								{@render bar(panel.x0 + len + 1, ROW[r], heat, ROWH[r], 'var(--mech-heat)', 0.85)}
							{/if}
							<!-- after a lossy crash: the kinetic energy left, then the part turned to heat -->
							<text
								x={panel.x0 + len + heat + 6}
								y={ROW[r] + ROWH[r] / 2 + 5}
								class="halo"
								font-weight="600"
								style:font-size="13px"
								><tspan style:fill="var(--mech-kinetic)">{fmt(shownK, 2)} J</tspan
								>{#if heat > 0.5}<tspan style:fill="var(--mech-heat)"
										>{` + ${fmt(kShow.lost, 2)} J`}</tspan
									>{/if}</text
							>
						</g>
					{/each}
					{#if after}
						<g opacity={show}>
							{@render txt(
								panel.x0,
								520,
								lost > 0.005
									? `${fmt(kShow.lost, 2)} J of kinetic energy went into denting, heat and sound`
									: meets
										? 'nothing lost: perfectly elastic'
										: 'no crash, so nothing changes',
								12,
								{
									color: lost > 0.005 ? 'var(--mech-heat)' : undefined,
									muted: lost <= 0.005,
									weight: 600
								}
							)}
						</g>
					{/if}
					<!-- total momentum, smaller -->
					{@render txt(panel.x0, 540, 'momentum (total)', 11, { muted: true })}
					<line x1={zero} x2={zero} y1="538" y2="564" stroke="var(--stage-line)" />
					<g opacity={show}>
						{@render bar(zero, 545, (pTot / pScale.current) * 90, 10, 'var(--mech-momentum)')}
						{@render txt(
							zero + (pTot / pScale.current) * 90 + (pTot < 0 ? -6 : 6),
							554,
							`${pTotText} kg·m/s`,
							11,
							{
								anchor: pTot < 0 ? 'end' : 'start',
								weight: 600,
								color: 'var(--mech-momentum)'
							}
						)}
					</g>
				</g>
			{/each}
			<g opacity={afterIn * life * (lost > 0.005 ? momView : 1)}>
				{@render txt(480, 494, '=', 24, {
					anchor: 'middle',
					weight: 600,
					color: energyMix.current > 0.5 ? 'var(--mech-kinetic)' : 'var(--mech-momentum)'
				})}
			</g>
		</g>
	{/if}
</g>
