<script lang="ts">
	/**
	 * Step `drift`: inside a copper wire, and why the bulb lights at once.
	 *
	 * Top: a magnified cut-away of a wire between the battery's − and +
	 * terminals. Copper ions sit still in a lattice (faint rings); free
	 * electrons dart about at random (thermal motion: a piecewise-linear random
	 * walk between hashed waypoints, a pure function of t) and, on top of that,
	 * the whole crowd drifts slowly from − to + in proportion to `params.amps`.
	 * One electron is ringed and its drift-only (average) position leaves a
	 * dashed trail. Under the wire, two arrows: electron drift (− → +) and
	 * conventional current (+ → −); `params.charges` picks which one is
	 * emphasised. The dots are always electrons and always drift − → +.
	 *
	 * Bottom left: the real drift speed from the model (`driftSpeed`), and a
	 * 10-second race in real time against a snail (~1 mm/s).
	 * Bottom right: the "bicycle chain" — a whole loop (battery, switch, bulb)
	 * packed with charges on a 12 s cycle: open → the switch closes → every
	 * charge starts moving at the same moment and the bulb lights at once,
	 * though each charge moves only a little → open again.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { along, clamp, cycle, hash, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { BULB_R, brightness, driftSpeed } from '../circuit';

	let { t, params, reduced }: StageProps = $props();

	/** Copper; the snail is neutral grey so it never reads as charge. */
	const COPPER = 'var(--circ-copper)';
	const SNAIL = 'var(--stage-ink-muted)';

	const amps = $derived(clamp(Number(params.amps ?? 0.5), 0, 3));
	const mode = $derived(params.charges === 'electrons' ? 'electrons' : 'conventional');
	const on = $derived(amps > 0.001);

	// ---- emphasis (tweened) ---------------------------------------------------------
	const DIM = 0.5;
	const elecEm = new Tween(1, { duration: 700, easing: cubicInOut });
	const convEm = new Tween(1, { duration: 700, easing: cubicInOut });
	const flowing = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const e = mode === 'electrons';
		const f = on ? 1 : 0;
		untrack(() => {
			elecEm.set(e ? 1 : DIM);
			convEm.set(e ? DIM : 1);
			flowing.set(f);
		});
	});

	// ---- the wire ---------------------------------------------------------------------
	const WX0 = 92; // inner copper, left
	const WX1 = 868; // inner copper, right
	const WY0 = 70;
	const WY1 = 230;
	const WRAP0 = WX0 - 24; // electrons wrap round just outside the visible copper
	const WRAP1 = WX1 + 24;
	const PX_PER_A = 12; // on-screen drift, px per second per ampere (not to scale)
	const wrap = (x: number, lo: number, hi: number) => {
		const w = hi - lo;
		return lo + ((((x - lo) % w) + w) % w);
	};

	const ions = Array.from({ length: 19 * 4 }, (_, k) => ({
		k,
		x: 104 + (k % 19) * 42 + (Math.floor(k / 19) % 2) * 0,
		y: 90 + Math.floor(k / 19) * 40
	}));

	const COLS = 22;
	const ROWS = 3;
	const electrons = Array.from({ length: COLS * ROWS }, (_, i) => {
		const c = i % COLS;
		const r = Math.floor(i / COLS);
		return {
			i,
			hx: WRAP0 + ((c + 0.2 + 0.6 * hash(i, 1)) * (WRAP1 - WRAP0)) / COLS,
			hy: WY0 + 12 + ((r + 0.15 + 0.7 * hash(i, 2)) * (WY1 - WY0 - 24)) / ROWS,
			seg: 0.34 + 0.2 * hash(i, 3), // seconds between "collisions"
			ph: hash(i, 4) * 10
		};
	});
	const TAG = COLS + 2; // middle row, near the left: the followed electron

	/** Thermal jiggle: straight darts between random waypoints. */
	function jiggle(i: number, seg: number, ph: number, time: number): Point {
		const u = time / seg + ph;
		const k = Math.floor(u);
		const f = u - k;
		const wp = (n: number) => ({
			x: 15 * (2 * hash(i * 977 + n, 5) - 1),
			y: 13 * (2 * hash(i * 977 + n, 6) - 1)
		});
		const a = wp(k);
		const b = wp(k + 1);
		return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
	}

	// ---- the chain loop (inset) ---------------------------------------------------------
	const LX0 = 556;
	const LX1 = 904;
	const LY0 = 380;
	const LY1 = 556;
	const LR = 22;
	const BAT = { x: LX0, y: 476 };
	const BULB = { x: LX1, y: 468 };
	const SW0 = 700; // switch hinge (top side)
	const SW1 = 760; // switch contact
	const loopPts: Point[] = (() => {
		const pts: Point[] = [];
		const arc = (cx: number, cy: number, a0: number) => {
			for (let s = 0; s <= 6; s++) {
				const a = a0 + (s / 6) * (Math.PI / 2);
				pts.push({ x: cx + LR * Math.cos(a), y: cy + LR * Math.sin(a) });
			}
		};
		// clockwise from the top-left corner: top, right, bottom, left
		arc(LX0 + LR, LY0 + LR, Math.PI);
		arc(LX1 - LR, LY0 + LR, -Math.PI / 2);
		arc(LX1 - LR, LY1 - LR, 0);
		arc(LX0 + LR, LY1 - LR, Math.PI / 2);
		pts.push({ ...pts[0] });
		return pts;
	})();
	const loopD =
		loopPts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
	const loopLen = loopPts
		.slice(1)
		.reduce((s, p, i) => s + Math.hypot(p.x - loopPts[i].x, p.y - loopPts[i].y), 0);
	const NCH = 42;
	const SP = loopLen / NCH;
	const atS = (s: number) => along(loopPts, wrap(s, 0, loopLen) / loopLen);
	const CH_TAG = 26; // starts on the bottom side
	/** Inset speed in px/s: grows with the current but stays small — each charge moves only a little. */
	const chainRate = (a: number) => (a > 0.001 ? 4 + 5 * a : 0);

	const CYCLE = 12;
	/** 0 open … 1 closed: the lever's position over the 12 s cycle. */
	const closedness = (tau: number) => smoothstep(2.6, 3.0, tau) * (1 - smoothstep(10.5, 10.8, tau));
	/** Charges move (and the bulb lights) only once the lever touches the contact. */
	const gateAt = (tau: number) => smoothstep(2.95, 3.05, tau) * (1 - smoothstep(10.5, 10.56, tau));

	const tau = $derived(reduced ? 7 : cycle(t, CYCLE) * CYCLE);
	/** With 0 A there is nothing to show: the switch stays open. */
	const lever = $derived(!on ? 0 : reduced ? 1 : closedness(tau));
	const gate = $derived(reduced ? 1 : gateAt(tau));

	/**
	 * Two clocks that integrate a rate set by a control (the sanctioned
	 * accumulator of the scene guide): the wire's drift, in px, and the chain's
	 * signed travel, in px along the loop. A pure `t × rate` would make every
	 * electron jump when the current slider moves, and the chain jump when the
	 * view switches direction. Guards: dt ≤ 0 (pause, step restart) only
	 * resyncs; long gaps (> 0.5 s) are skipped. Under reduced motion the frozen
	 * `t × rate` is used instead.
	 */
	let driftAcc = 0;
	let chainAcc = 0;
	let lastT = -1;
	const clocks = $derived.by(() => {
		const dt = t - lastT;
		if (lastT >= 0 && dt > 0 && dt < 0.5) {
			driftAcc += dt * PX_PER_A * amps;
			const dir = mode === 'conventional' ? 1 : -1;
			chainAcc += dt * dir * chainRate(amps) * gateAt(cycle(t, CYCLE) * CYCLE);
		}
		lastT = t;
		return { drift: driftAcc, chain: chainAcc };
	});
	const drift = $derived(reduced ? PX_PER_A * amps * t : clocks.drift);
	const chain = $derived(
		reduced ? (mode === 'conventional' ? 1 : -1) * chainRate(amps) * 4 : clocks.chain
	);
	const jt = $derived(reduced ? 2.5 : t);

	const dots = $derived(
		electrons.map((e) => {
			const ax = wrap(e.hx + drift, WRAP0, WRAP1);
			const j = jiggle(e.i, e.seg, e.ph, jt);
			return { i: e.i, ax, ay: e.hy, x: ax + j.x, y: e.hy + j.y };
		})
	);
	const tagged = $derived(dots[TAG]);
	const trailX0 = $derived(Math.max(WX0 + 2, tagged.ax - drift));

	// ---- readouts ------------------------------------------------------------------------
	const vmm = $derived(driftSpeed(amps) * 1000); // mm/s
	const vText = $derived(on ? `≈ ${vmm.toPrecision(2)} mm/s` : '0 mm/s');
	const ampsText = $derived(`${amps.toFixed(2)} A`);

	// race: 10 s of real time, then a 2 s pause
	const RX0 = 80;
	const RX1 = 370;
	const PX_PER_MM = (RX1 - RX0) / 10;
	const elapsed = $derived(reduced ? 10 : Math.min(10, cycle(t, 12) * 12));
	const snailMm = $derived(elapsed * 1);
	const elecMm = $derived(elapsed * vmm);

	// ---- the bulb --------------------------------------------------------------------------
	/** Model brightness for a 12 Ω bulb, with a perceptual floor so a small current still shows. */
	const bulbLevel = $derived(on ? 0.3 + 0.7 * brightness(amps * amps * BULB_R) : 0);
	const glow = $derived(bulbLevel * gate);

	const chainDots = $derived(
		Array.from({ length: NCH }, (_, i) => {
			const p = atS(i * SP + chain);
			let o = 1;
			if (Math.hypot(p.x - BAT.x, p.y - BAT.y) < 18) o = 0;
			if (Math.hypot(p.x - BULB.x, p.y - BULB.y) < 20) o = 0;
			if (p.y < LY0 + 4 && p.x > SW0 - 4 && p.x < SW1 + 4) o = 0;
			return { i, x: p.x, y: p.y, o };
		})
	);
	/** How far the ringed charge has moved since the switch closed (this cycle). */
	const tagRun = $derived(reduced ? chainRate(amps) * 4 : chainRate(amps) * clamp(tau - 3, 0, 7.5));
	/** The ringed charge's path since the switch closed, drawn just outside the loop. */
	const tagTrail = $derived.by(() => {
		const s = CH_TAG * SP + chain;
		const dir = mode === 'conventional' ? 1 : -1;
		const n = 12;
		const off = 13;
		const pts = Array.from({ length: n + 1 }, (_, k) => {
			const p = atS(s - dir * tagRun * (1 - k / n));
			return { x: p.x + off * Math.sin(p.angle), y: p.y - off * Math.cos(p.angle) };
		});
		return pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
	});
	const chargeColor = $derived(
		mode === 'conventional' ? 'var(--circ-charge)' : 'var(--circ-electron)'
	);
	const leverEnd = $derived.by(() => {
		const a = (-28 * (1 - lever) * Math.PI) / 180;
		const len = SW1 - SW0;
		return { x: SW0 + len * Math.cos(a), y: LY0 + len * Math.sin(a) };
	});
	const closedText = $derived(on ? gate : 0);
</script>

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
		tabular?: boolean;
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
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet terminal(cx: number, sign: string, color: string, label: string)}
	<circle {cx} cy="150" r="20" fill={color} fill-opacity="0.14" stroke={color} stroke-width="2" />
	{@render txt(cx, 158, sign, 24, { anchor: 'middle', color, weight: 700 })}
	{@render txt(cx, 192, label, 11, { anchor: 'middle', muted: true })}
{/snippet}

{#snippet snail(x: number, y: number)}
	<g transform="translate({x} {y})">
		<path
			d="M-16 5 Q-18 0 -12 0 L0 0 Q4 0 4 -4 L4 -7 M2 -4 L1 -9 M4 -5 L6 -9"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.6"
			stroke-linecap="round"
		/>
		<path
			d="M-17 5 L4 5 Q6 5 5 2 L3 0"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.6"
		/>
		<circle
			cx="-8"
			cy="-3"
			r="7"
			fill={SNAIL}
			fill-opacity="0.25"
			stroke={SNAIL}
			stroke-width="1.6"
		/>
		<path d="M-8 -3 m-3 0 a3 3 0 1 1 3 3" fill="none" stroke={SNAIL} stroke-width="1.2" />
	</g>
{/snippet}

<g>
	<defs>
		<clipPath id="wire-clip">
			<rect x={WX0} y={WY0} width={WX1 - WX0} height={WY1 - WY0} rx="6" />
		</clipPath>
		<radialGradient id="wire-bulb-glow">
			<stop offset="0" stop-color="var(--circ-glow)" stop-opacity="0.9" />
			<stop offset="0.45" stop-color="var(--circ-glow)" stop-opacity="0.35" />
			<stop offset="1" stop-color="var(--circ-glow)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- ============ title and legend ============ -->
	{@render txt(24, 30, 'Inside a copper wire', 16, { weight: 650 })}
	{@render txt(
		24,
		48,
		'magnified about 10 million times · not to scale: the jiggle is slowed down, the drift sped up',
		11,
		{ muted: true }
	)}
	<g>
		<circle cx="560" cy="26" r="5" fill="var(--circ-electron)" />
		{@render txt(571, 30, 'free electron', 12)}
		<circle
			cx="676"
			cy="26"
			r="7"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.3"
			opacity="0.7"
		/>
		{@render txt(689, 30, 'copper ion (fixed)', 12)}
		<circle cx="814" cy="26" r="5" fill="var(--circ-electron)" />
		<circle cx="814" cy="26" r="9" fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
		{@render txt(828, 30, 'followed electron', 12)}
	</g>

	<!-- ============ the wire ============ -->
	<line x1="70" y1="150" x2={WX0 - 6} y2="150" stroke="var(--circ-wire)" stroke-width="4" />
	<line x1={WX1 + 6} y1="150" x2="890" y2="150" stroke="var(--circ-wire)" stroke-width="4" />
	{@render terminal(50, '−', 'var(--circ-battery)', 'to battery −')}
	{@render terminal(910, '+', 'var(--circ-battery)', 'to battery +')}

	<rect
		x={WX0 - 8}
		y={WY0 - 8}
		width={WX1 - WX0 + 16}
		height={WY1 - WY0 + 16}
		rx="12"
		fill="var(--stage-line)"
		fill-opacity="0.28"
		stroke="var(--stage-line)"
	/>
	<rect
		x={WX0}
		y={WY0}
		width={WX1 - WX0}
		height={WY1 - WY0}
		rx="6"
		style:fill={COPPER}
		fill-opacity="0.12"
		style:stroke={COPPER}
		stroke-opacity="0.45"
	/>
	<g clip-path="url(#wire-clip)">
		{#each ions as ion (ion.k)}
			<circle
				cx={ion.x}
				cy={ion.y}
				r="7"
				fill="var(--stage-ink-muted)"
				fill-opacity="0.08"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				opacity="0.55"
			/>
		{/each}
		<!-- the followed electron's average (drift-only) path -->
		{#if tagged.ax > trailX0 + 1}
			<line
				x1={trailX0}
				y1={tagged.ay}
				x2={tagged.ax}
				y2={tagged.ay}
				stroke="var(--stage-ink)"
				stroke-width="1.6"
				stroke-dasharray="4 4"
				opacity="0.6"
			/>
		{/if}
		<circle cx={tagged.ax} cy={tagged.ay} r="2.5" fill="var(--stage-ink)" opacity="0.7" />
		{#each dots as d (d.i)}
			<circle cx={d.x} cy={d.y} r="5" fill="var(--circ-electron)" />
		{/each}
		<circle
			cx={tagged.x}
			cy={tagged.y}
			r="9"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
		/>
		{#if reduced && on}
			{#each dots as d (d.i)}
				{#if d.i % 3 === 0}
					<line
						x1={d.x + 7}
						y1={d.y}
						x2={d.x + 17}
						y2={d.y}
						stroke="var(--circ-electron)"
						stroke-width="1.6"
						marker-end="url(#arrowhead)"
					/>
				{/if}
			{/each}
		{/if}
	</g>

	<!-- ============ directions ============ -->
	<!-- the view not chosen dims its arrow only: its words stay readable -->
	<g opacity={flowing.current}>
		{@render txt(40, 271, 'electron drift', 13, {
			color: 'var(--circ-electron)',
			weight: 650,
			opacity: 0.6 + 0.4 * elecEm.current
		})}
		{@render txt(136, 271, '− to +', 12, { muted: true })}
		<line
			opacity={elecEm.current}
			x1="250"
			y1="266"
			x2="660"
			y2="266"
			stroke="var(--circ-electron)"
			stroke-width="3"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
		{@render txt(684, 271, 'the way the electrons really move', 12, { muted: true })}
	</g>
	<g opacity={flowing.current}>
		{@render txt(40, 301, 'conventional current', 13, {
			color: 'var(--circ-charge)',
			weight: 650,
			opacity: 0.6 + 0.4 * convEm.current
		})}
		{@render txt(184, 301, '+ to −', 12, { muted: true })}
		<line
			opacity={convEm.current}
			x1="660"
			y1="296"
			x2="250"
			y2="296"
			stroke="var(--circ-charge)"
			stroke-width="3"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
		{@render txt(684, 301, 'the way circuit diagrams draw it', 12, { muted: true })}
	</g>
	<g opacity={1 - flowing.current}>
		{@render txt(480, 287, '0 A: no current — the electrons only jiggle; no net drift', 13, {
			anchor: 'middle',
			muted: true
		})}
	</g>

	<!-- ============ drift speed and the snail race ============ -->
	<rect
		x="16"
		y="322"
		width="436"
		height="262"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(36, 348, 'Drift speed', 12, { muted: true, weight: 600 })}
	{@render txt(36, 382, vText, 24, { weight: 700, color: 'var(--circ-electron)', tabular: true })}
	{@render txt(36, 404, `at ${ampsText}, in a 1 mm² copper wire`, 12, {
		muted: true,
		tabular: true
	})}
	{@render snail(400, 380)}
	{@render txt(432, 404, 'snail ≈ 1 mm/s', 12, { anchor: 'end', muted: true })}
	{@render txt(
		36,
		432,
		on && vmm < 1
			? 'Slower than a snail.'
			: on
				? 'Still only a snail’s pace.'
				: 'No current: no drift at all.',
		13,
		{ weight: 600 }
	)}

	{@render txt(36, 462, 'A race over 10 seconds (real time)', 12, { muted: true, weight: 600 })}
	{@render txt(432, 462, `${elapsed.toFixed(1)} s`, 12, {
		anchor: 'end',
		muted: true,
		tabular: true
	})}
	<!-- lanes -->
	{@render txt(36, 494, 'snail', 11, { muted: true })}
	<rect
		x={RX0}
		y="487"
		width={RX1 - RX0}
		height="4"
		rx="2"
		fill="var(--stage-line)"
		opacity="0.35"
	/>
	<rect x={RX0} y="487" width={snailMm * PX_PER_MM} height="4" rx="2" fill={SNAIL} opacity="0.8" />
	{@render snail(RX0 + snailMm * PX_PER_MM + 2, 482)}
	{@render txt(432, 494, `${snailMm.toFixed(1)} mm`, 12, { anchor: 'end', tabular: true })}

	{@render txt(36, 526, 'e⁻', 12, { color: 'var(--circ-electron)', weight: 650 })}
	<rect
		x={RX0}
		y="519"
		width={RX1 - RX0}
		height="4"
		rx="2"
		fill="var(--stage-line)"
		opacity="0.35"
	/>
	<rect
		x={RX0}
		y="519"
		width={Math.max(0, elecMm * PX_PER_MM)}
		height="4"
		rx="2"
		fill="var(--circ-electron)"
	/>
	<circle cx={RX0 + elecMm * PX_PER_MM} cy="521" r="5" fill="var(--circ-electron)" />
	{@render txt(432, 526, `${elecMm < 0.995 ? elecMm.toFixed(2) : elecMm.toFixed(1)} mm`, 12, {
		anchor: 'end',
		tabular: true
	})}
	<!-- ruler -->
	<line x1={RX0} y1="544" x2={RX1} y2="544" stroke="var(--stage-ink-muted)" stroke-width="1" />
	{#each Array.from({ length: 11 }, (_, k) => k) as k (k)}
		<line
			x1={RX0 + k * PX_PER_MM}
			y1="544"
			x2={RX0 + k * PX_PER_MM}
			y2={k % 5 === 0 ? 552 : 549}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
	{/each}
	{@render txt(RX0, 568, '0', 11, { anchor: 'middle', muted: true })}
	{@render txt(RX0 + 5 * PX_PER_MM, 568, '5', 11, { anchor: 'middle', muted: true })}
	{@render txt(RX1, 568, '10 mm', 11, { anchor: 'middle', muted: true })}

	<!-- ============ the chain loop ============ -->
	<rect
		x="468"
		y="322"
		width="476"
		height="262"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{@render txt(484, 348, 'Why the bulb lights at once', 12, { muted: true, weight: 600 })}

	<path d={loopD} fill="none" stroke="var(--circ-wire)" stroke-width="3" stroke-linejoin="round" />
	<!-- gap under the switch lever -->
	<rect x={SW0 + 3} y={LY0 - 4} width={SW1 - SW0 - 6} height="8" fill="var(--surface)" />

	<!-- charges, like the links of a chain -->
	{#if tagRun > 0.5}
		<path
			d={tagTrail}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-linecap="round"
			opacity="0.6"
		/>
	{/if}
	{#each chainDots as c (c.i)}
		<circle cx={c.x} cy={c.y} r="4.5" fill={chargeColor} opacity={c.o} />
	{/each}
	{#if chainDots[CH_TAG].o > 0}
		<circle
			cx={chainDots[CH_TAG].x}
			cy={chainDots[CH_TAG].y}
			r="8"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- battery, drawn as on the board: + (long plate) on top -->
	<rect
		x={BAT.x - 19}
		y={BAT.y - 15}
		width="38"
		height="30"
		rx="7"
		style:fill="color-mix(in oklab, var(--circ-battery) 14%, var(--surface))"
		stroke="var(--circ-battery)"
		stroke-width="1.5"
	/>
	<line
		x1={BAT.x - 14}
		y1={BAT.y - 7}
		x2={BAT.x + 14}
		y2={BAT.y - 7}
		stroke="var(--circ-battery)"
		stroke-width="2.5"
	/>
	<line
		x1={BAT.x - 7}
		y1={BAT.y + 7}
		x2={BAT.x + 7}
		y2={BAT.y + 7}
		stroke="var(--circ-battery)"
		stroke-width="5"
	/>
	{@render txt(BAT.x - 28, BAT.y - 2, '+', 15, {
		anchor: 'middle',
		weight: 700,
		color: 'var(--circ-battery)'
	})}
	{@render txt(BAT.x - 28, BAT.y + 16, '−', 15, {
		anchor: 'middle',
		weight: 700,
		color: 'var(--circ-battery)'
	})}
	{@render txt(BAT.x + 28, BAT.y + 5, 'battery', 12, { muted: true })}

	<!-- switch, drawn as on the board -->
	<line
		x1={SW0}
		y1={LY0}
		x2={leverEnd.x}
		y2={leverEnd.y}
		stroke="var(--circ-wire)"
		stroke-width="3.5"
		stroke-linecap="round"
	/>
	<circle
		cx={SW0}
		cy={LY0}
		r="4"
		fill="var(--surface)"
		stroke="var(--circ-wire)"
		stroke-width="2"
	/>
	<circle
		cx={SW1}
		cy={LY0}
		r="4"
		fill="var(--surface)"
		stroke="var(--circ-wire)"
		stroke-width="2"
	/>
	{@render txt((SW0 + SW1) / 2, LY0 + 24, 'switch', 12, { anchor: 'middle', muted: true })}

	<!-- bulb, drawn as on the board -->
	<circle cx={BULB.x} cy={BULB.y} r="38" fill="url(#wire-bulb-glow)" opacity={glow} />
	<g transform="translate({BULB.x} {BULB.y}) rotate(90)">
		<circle
			r="16"
			style:fill="color-mix(in oklab, var(--circ-glow) {Math.round(8 + 72 * glow)}%, var(--surface))"
			stroke="var(--circ-wire)"
			stroke-width="1.5"
		/>
		<path
			d="M-16 0 L-7 -1 L-6 -7 M16 0 L7 -1 L6 -7"
			fill="none"
			stroke="var(--circ-wire)"
			stroke-width="1.25"
		/>
		<path
			d="M-6 -7 l2 -4 l2 4 l2 -4 l2 4 l2 -4 l2 4"
			fill="none"
			style:stroke="color-mix(in oklab, var(--circ-glow) {Math.round(100 * Math.sqrt(glow))}%,
			var(--circ-wire))"
			stroke-width={1.4 + 0.8 * glow}
			stroke-linejoin="round"
		/>
	</g>
	{@render txt(BULB.x - 14, BULB.y + 34, 'bulb', 12, { anchor: 'end', muted: true })}

	<!-- what is happening -->
	{#if on}
		<g opacity={1 - closedText}>
			{@render txt(730, 430, 'Switch open: the loop is broken,', 13, {
				anchor: 'middle',
				weight: 600
			})}
			{@render txt(730, 448, 'so nothing moves — but the wire is full of charges', 12, {
				anchor: 'middle',
				muted: true
			})}
		</g>
		<g opacity={closedText}>
			{@render txt(730, 430, 'Closed: every charge starts moving at once,', 13, {
				anchor: 'middle',
				weight: 600
			})}
			{@render txt(730, 448, 'so the bulb lights straight away — like a bike chain', 12, {
				anchor: 'middle',
				muted: true
			})}
		</g>
		<g opacity={smoothstep(0.5, 3, tagRun)}>
			{@render txt(730, 524, '…yet the ringed charge has moved only a little', 12, {
				anchor: 'middle',
				muted: true
			})}
		</g>
	{:else}
		{@render txt(730, 430, 'No current (0 A):', 13, { anchor: 'middle', weight: 600 })}
		{@render txt(730, 448, 'nothing moves, and the bulb stays dark', 12, {
			anchor: 'middle',
			muted: true
		})}
	{/if}
</g>
