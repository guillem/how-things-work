<script lang="ts">
	/**
	 * An adult's arm seen from the side with the skin made see-through: the upper arm hangs from the
	 * shoulder, the forearm swings up at the elbow. The biceps runs in front from the shoulder blade
	 * to the forearm just past the elbow; the triceps runs behind to the point of the elbow. Every
	 * length and pull comes from the lever model (`../model`): a muscle's belly gets fatter as it
	 * shortens (it keeps its volume), a pulling muscle is coloured and its ends are drawn in by
	 * arrows, a relaxed one is pale. Scene units are centimetres from the elbow's hinge, drawn at
	 * `S` pixels per centimetre.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicIn, cubicInOut } from 'svelte/easing';
	import { Handle, Label, cycle, smooth, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BICEPS_GRIP,
		FULLY_BENT,
		HAND,
		angleOf,
		along,
		bicepsEnds,
		bicepsLength,
		bicepsLever,
		bicepsPull,
		bicepsShortening,
		onForearm,
		tricepsPull,
		tricepsStretch,
		type Point
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'arm'));
	const elbowParam = $derived(Number(params.elbow ?? 60));
	const squeeze = $derived(String(params.squeeze ?? 'biceps'));
	const press = $derived(Number(params.press ?? 10));
	const bagKg = $derived(Number(params.bag ?? 5));
	const relaxed = $derived(params.relax === true);
	const bigger = $derived(params.bigger === true);
	const grip = $derived(phase === 'grip' ? Number(params.grip ?? BICEPS_GRIP) : BICEPS_GRIP);

	// ---- drawing scale -------------------------------------------------------------------------
	/** Pixels per centimetre, and the elbow's hinge on the stage. */
	const S = 8;
	const EX = 340;
	const EY = 292;
	const px = (p: Point) => ({ x: EX + p.x * S, y: EY + p.y * S });
	const f1 = (v: number) => v.toFixed(1);

	// ---- the elbow angle -----------------------------------------------------------------------
	/** Where the arm settles in each step (degrees); the lowering step moves by itself. */
	const target = $derived.by(() => {
		switch (phase) {
			case 'arm':
				return elbowParam;
			case 'squeeze':
				return squeeze === 'biceps' ? 120 : 20;
			default:
				return 90;
		}
	});
	const opts = { duration: 800, easing: cubicInOut };
	const base = new Tween(
		untrack(() => target),
		opts
	);
	let lastPhase = untrack(() => phase);
	$effect(() => {
		const a = target;
		const p = phase;
		untrack(() => {
			// A drag or the slider moves the arm at once; a new step or a new choice eases it there.
			const instant = reduced || (p === 'arm' && lastPhase === 'arm');
			lastPhase = p;
			void base.set(a, instant ? { duration: 0 } : opts);
		});
	});
	/** 1 while the lowering step's lift-and-lower loop drives the arm. */
	const looping = new Tween(
		untrack(() => (phase === 'lower' ? 1 : 0)),
		opts
	);
	$effect(() => {
		const on = phase === 'lower' ? 1 : 0;
		untrack(() => void looping.set(on, reduced ? { duration: 0 } : opts));
	});
	/** 1 once the biceps lets go in the lowering step: the forearm and the bag drop. */
	const dropped = new Tween(
		untrack(() => (relaxed && phase === 'lower' ? 1 : 0)),
		{
			duration: 450,
			easing: cubicIn
		}
	);
	$effect(() => {
		const on = relaxed && phase === 'lower' ? 1 : 0;
		untrack(
			() =>
				void dropped.set(
					on,
					reduced ? { duration: 0 } : on ? { duration: 450, easing: cubicIn } : opts
				)
		);
	});

	// The lowering loop (10 s): hold at the top, lower for 3 s, hold, lift for 3 s. At the
	// reduced-motion frame (2.5 s) the bag is halfway down.
	const TOP = 115;
	const BOTTOM = 50;
	const loop = $derived.by(() => {
		const c = cycle(t, 10) * 10;
		if (c < 1) return { a: TOP, move: 'hold-top' };
		if (c < 4) return { a: TOP + (BOTTOM - TOP) * smoothstep(1, 4, c), move: 'lower' };
		if (c < 5) return { a: BOTTOM, move: 'hold-bottom' };
		if (c < 8) return { a: BOTTOM + (TOP - BOTTOM) * smoothstep(5, 8, c), move: 'lift' };
		return { a: TOP, move: 'hold-top' };
	});
	const angle = $derived.by(() => {
		const a = base.current + (loop.a - base.current) * looping.current;
		return a + (20 - a) * dropped.current;
	});

	// ---- what pulls ------------------------------------------------------------------------------
	const showBag = $derived(['bag', 'lower', 'bigger', 'grip', 'next'].includes(phase));
	const bagOn = $derived(showBag ? bagKg : 0);
	/** Which muscle pulls in this step. */
	const active = $derived.by(() => {
		if (phase === 'squeeze') return squeeze;
		if (phase === 'press') return 'triceps';
		if (phase === 'lower' && relaxed) return 'none';
		return 'biceps';
	});
	const bOn = new Tween(
		untrack(() => (active === 'biceps' ? 1 : 0)),
		{ duration: 500 }
	);
	const tOn = new Tween(
		untrack(() => (active === 'triceps' ? 1 : 0)),
		{ duration: 500 }
	);
	$effect(() => {
		const b = active === 'biceps' ? 1 : 0;
		const tr = active === 'triceps' ? 1 : 0;
		untrack(() => {
			void bOn.set(b, reduced ? { duration: 0 } : undefined);
			void tOn.set(tr, reduced ? { duration: 0 } : undefined);
		});
	});
	const bulk = new Tween(
		untrack(() => (bigger && phase === 'bigger' ? 1 : 0)),
		opts
	);
	$effect(() => {
		const on = bigger && phase === 'bigger' ? 1 : 0;
		untrack(() => void bulk.set(on, reduced ? { duration: 0 } : opts));
	});

	const bPull = $derived(active === 'biceps' ? bicepsPull(angle, bagOn, grip) : 0);
	const tPull = $derived(phase === 'press' ? tricepsPull(press, angle) : 0);

	// ---- geometry --------------------------------------------------------------------------------
	const ends = $derived(bicepsEnds(angle, grip));
	/** Tendon lengths at either end of the biceps, cm: the belly is what is left. */
	const B_TOP_TENDON = 7;
	const B_LOW_TENDON = 3.5;
	const bLen = $derived(bicepsLength(angle, grip));
	const bLen0 = bicepsLength(0) - B_TOP_TENDON - B_LOW_TENDON;
	const biceps = $derived.by(() => {
		const [o, i] = ends;
		const len = bLen;
		const ux = (i.x - o.x) / len;
		const uy = (i.y - o.y) / len;
		// Across the line, away from the bone (forward).
		let nx = uy;
		let ny = -ux;
		if (nx * (o.x + i.x) + ny * (o.y + i.y) < 0) {
			nx = -nx;
			ny = -ny;
		}
		const belly = len - B_TOP_TENDON - B_LOW_TENDON;
		// Same volume: thicker as the belly gets shorter (and much thicker for the big biceps).
		const w = 1.75 * Math.sqrt(bLen0 / belly) * (1 + 0.6 * bulk.current);
		const a = { x: o.x + ux * B_TOP_TENDON, y: o.y + uy * B_TOP_TENDON };
		const b = { x: i.x - ux * B_LOW_TENDON, y: i.y - uy * B_LOW_TENDON };
		const outer: Point[] = [];
		const inner: Point[] = [];
		const n = 14;
		for (let k = 0; k <= n; k++) {
			const s = k / n;
			const bump = Math.sin(Math.PI * s) ** 0.8;
			const cx = a.x + (b.x - a.x) * s;
			const cy = a.y + (b.y - a.y) * s;
			outer.push({ x: cx + nx * w * 1.5 * bump, y: cy + ny * w * 1.5 * bump });
			inner.push({ x: cx - nx * w * 0.35 * bump, y: cy - ny * w * 0.35 * bump });
		}
		return { o, i, a, b, nx, ny, w, outer, inner };
	});
	/** The triceps: from behind the shoulder down the back of the upper arm, then its tendon
	 * wraps round the back of the elbow to the elbow's point. */
	const T_TOP = { x: -1.8, y: -27 };
	const T_WRAP = { x: -2.6, y: -5 };
	const triceps = $derived.by(() => {
		const ol = onForearm(angle, -0.5, -2);
		const stretch = tricepsStretch(angle);
		const belly0 = 17;
		const w = 1.6 * Math.sqrt(belly0 / (belly0 + stretch));
		const outer: Point[] = [];
		const inner: Point[] = [];
		const n = 12;
		const a = { x: T_TOP.x, y: T_TOP.y + 2 };
		const b = T_WRAP;
		for (let k = 0; k <= n; k++) {
			const s = k / n;
			const bump = Math.sin(Math.PI * s) ** 0.8;
			const cx = a.x + (b.x - a.x) * s;
			const cy = a.y + (b.y - a.y) * s;
			outer.push({ x: cx - w * 1.6 * bump, y: cy });
			inner.push({ x: cx + w * 0.3 * bump, y: cy });
		}
		// The tendon bends round the back of the joint once the elbow is bent.
		const ctrl = { x: -2.9, y: Math.min(1.5, 0.4 + 0.012 * angle) };
		return { ol, a, b, ctrl, w, outer, inner };
	});

	const pts = (ps: Point[]) =>
		ps
			.map((p, k) => {
				const q = px(p);
				return `${k ? 'L' : 'M'}${f1(q.x)} ${f1(q.y)}`;
			})
			.join('');
	const bellyPath = (outer: Point[], inner: Point[]) =>
		pts(smooth(outer, 3)) +
		smooth([...inner].reverse(), 3)
			.map((p) => {
				const q = px(p);
				return `L${f1(q.x)} ${f1(q.y)}`;
			})
			.join('') +
		'Z';

	/** A fibre along a muscle's belly, from end to end, bowed out `off` cm at its middle. */
	function fibre(a: Point, b: Point, nx: number, ny: number, off: number) {
		const p = (k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
		const s = px(p(0.12));
		const e = px(p(0.88));
		const c = px({ x: p(0.5).x + nx * off * 1.5, y: p(0.5).y + ny * off * 1.5 });
		return `M${f1(s.x)} ${f1(s.y)}Q${f1(c.x)} ${f1(c.y)} ${f1(e.x)} ${f1(e.y)}`;
	}

	/** The skin: round the shoulder, down the front over the biceps, along the forearm to the
	 * hand and back along the forearm's underside, round the point of the elbow and up the
	 * back over the triceps. */
	const skin = $derived.by(() => {
		const front: Point[] = [{ x: 4.6, y: -31 }];
		for (let k = 2; k <= 12; k += 2) {
			const p = biceps.outer[k];
			const pad = 0.7;
			front.push({ x: Math.max(p.x + biceps.nx * pad, 4.2), y: p.y + biceps.ny * pad });
		}
		const fore = (d: number, s: number) => onForearm(angle, d, s);
		const route: Point[] = [
			{ x: -4, y: -34 },
			{ x: 1, y: -35.5 },
			...front,
			fore(3, 4.6),
			fore(9, 4.2),
			fore(17, 3.4),
			fore(26.5, 2.5),
			fore(26.5, -2.3),
			fore(17, -3.2),
			fore(9, -3.8),
			fore(1.5, -3.8),
			fore(-1.5, -3)
		];
		// Up the back, outside the triceps.
		route.push({ x: -4.3, y: -3 });
		for (let k = 10; k >= 2; k -= 2) {
			const p = triceps.outer[k];
			route.push({ x: Math.min(p.x - 0.7, -4.3), y: p.y });
		}
		route.push({ x: -4.8, y: -30 });
		return pts(smooth(route, 4)) + 'Z';
	});

	const E = px({ x: 0, y: 0 });
	const handP = $derived(px(onForearm(angle, HAND)));
	const u = $derived(along(angle));
	const deg = $derived((Math.atan2(u.y, u.x) * 180) / Math.PI);

	// Bones: the upper arm's, and the forearm's two (drawn side by side).
	const humerus = { a: px({ x: 0, y: -29.5 }), b: px({ x: 0, y: -0.6 }) };
	const ulna = $derived({ a: px(onForearm(angle, -1.2, -1.2)), b: px(onForearm(angle, 25, -0.8)) });
	const radius = $derived({ a: px(onForearm(angle, 0.8, 0.9)), b: px(onForearm(angle, 25, 1)) });

	// ---- pulls shown as arrows at a pulling muscle's ends ------------------------------------------
	/** Arrow length grows with the pull (a squashed scale, so a light and a heavy pull both show). */
	const arrowLen = (kg: number) => (kg <= 0.2 ? 0 : 18 + 16 * Math.log10(1 + kg));
	const pulse = $derived(reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 2 * Math.PI * 0.8));
	const bArrows = $derived.by(() => {
		const len = arrowLen(phase === 'squeeze' ? 8 : bPull) * pulse * bOn.current;
		if (len < 4) return [];
		const i = px(biceps.i);
		const o = px(biceps.o);
		const ux = (o.x - i.x) / Math.hypot(o.x - i.x, o.y - i.y);
		const uy = (o.y - i.y) / Math.hypot(o.x - i.x, o.y - i.y);
		// Drawn just outside the tendon, so they never cover the bone.
		const ox = biceps.nx * 14;
		const oy = biceps.ny * 14;
		return [
			{ id: 'low', x1: i.x + ox, y1: i.y + oy, x2: i.x + ox + ux * len, y2: i.y + oy + uy * len },
			{ id: 'top', x1: o.x + ox, y1: o.y + oy, x2: o.x + ox - ux * len, y2: o.y + oy - uy * len }
		];
	});
	const tArrows = $derived.by(() => {
		const len = arrowLen(phase === 'squeeze' ? 8 : tPull / 4) * pulse * tOn.current;
		if (len < 4) return [];
		const ol = px(triceps.ol);
		const top = px(T_TOP);
		const w = px(T_WRAP);
		const ux = (w.x - ol.x) / Math.hypot(w.x - ol.x, w.y - ol.y);
		const uy = (w.y - ol.y) / Math.hypot(w.x - ol.x, w.y - ol.y);
		return [
			{
				id: 'low',
				x1: ol.x - 16,
				y1: ol.y + 6,
				x2: ol.x - 16 + ux * len,
				y2: ol.y + 6 + uy * len
			},
			{ id: 'top', x1: top.x - 26, y1: top.y, x2: top.x - 26, y2: top.y + len }
		];
	});

	// ---- fibres: a pulling muscle's fibres shimmer inwards -------------------------------------------
	const flow = $derived(reduced ? 0 : t * 14);

	// ---- the bag, the table and the scale -------------------------------------------------------------
	// A dropped bag slips off the fingers and falls out of the picture.
	const bagTop = $derived({ x: handP.x, y: handP.y + 34 + 160 * dropped.current });
	const tableY = EY + 27;

	// ---- dragging the hand (first step) -----------------------------------------------------------
	function moveHand(p: Point) {
		const a = angleOf({ x: (p.x - EX) / S, y: (p.y - EY) / S }, 20, FULLY_BENT);
		setParam('elbow', Math.round(a));
	}
	function keyHand(s: number | 'start' | 'end') {
		const v = s === 'start' ? 20 : s === 'end' ? FULLY_BENT : elbowParam + s;
		setParam('elbow', Math.max(20, Math.min(FULLY_BENT, v)));
	}

	// ---- words ---------------------------------------------------------------------------------------
	const kg = (v: number) => `${Math.round(v)} kg`;
	const shorter = $derived(Math.round(bicepsShortening(0, angle)));
	const longer = $derived(Math.round(tricepsStretch(angle)));
	const moveWord = $derived(loop.move);
	const headline = $derived.by(() => {
		switch (phase) {
			case 'arm':
				return shorter < 1
					? 'arm hanging almost straight'
					: `biceps: ${shorter} cm shorter, and fatter`;
			case 'squeeze':
				return squeeze === 'biceps'
					? 'the biceps pulls: the elbow bends'
					: squeeze === 'triceps'
						? 'the triceps pulls: the arm goes straight'
						: 'neither pulls: the forearm flops down';
			case 'press':
				return `the triceps pulls like a ${kg(tPull)} weight`;
			case 'lower':
				if (relaxed) return 'biceps relaxed: nothing brakes the bag';
				return moveWord === 'lower'
					? 'lowering: the biceps still pulls, and gets longer'
					: moveWord === 'lift'
						? 'lifting: the biceps pulls, and gets shorter'
						: 'holding: the biceps pulls, and stays the same length';
			case 'bigger':
				return `the biceps still pulls like a ${kg(bPull)} weight`;
			case 'grip':
				return `gripping ${grip} cm from the elbow: it pulls like a ${kg(bPull)} weight`;
			case 'next':
				return 'a muscle can only pull: two muscles take turns';
			default:
				return `the biceps pulls like a ${kg(bPull)} weight`;
		}
	});
	const sub = $derived.by(() => {
		switch (phase) {
			case 'arm':
				return `triceps: ${longer} cm longer than with the arm straight`;
			case 'squeeze':
				return squeeze === 'none'
					? 'a relaxed muscle goes soft: it can’t push'
					: 'the other muscle relaxes and gets stretched';
			case 'press':
				return tPull < 0.5
					? 'your hand just rests on the scale'
					: `${Math.round(tPull / press)} times what the scale reads`;
			case 'bag':
				return `${Math.round(bagOn * (HAND / bicepsLever(90)))} kg of it for the ${bagOn} kg bag: ${Math.round(HAND / bicepsLever(90))} times its weight`;
			case 'lower':
				return relaxed
					? 'the bag drops'
					: `pulling like a ${kg(bPull)} weight, ${Math.round(bLen)} cm long`;
			case 'bigger':
				return bigger
					? 'a bigger muscle, gripping the same spot'
					: `an ordinary biceps, gripping ${BICEPS_GRIP} cm from the elbow`;
			case 'grip':
				return `to bend the arm all the way, it shortens ${Math.round(bicepsShortening(20, FULLY_BENT, grip))} cm`;
			default:
				return '';
		}
	});
	const scaleText = $derived(`${press} kg`);
</script>

<g class="mus-arm">
	<!-- table and bathroom scale -->
	{#if phase === 'press'}
		<rect x="440" y={tableY + 14} width="504" height="16" rx="4" fill="var(--mus-table)" />
		<rect x="900" y={tableY + 30} width="18" height={584 - tableY - 30} fill="var(--mus-table)" />
		<rect
			x="490"
			y={tableY - 2}
			width="170"
			height="16"
			rx="5"
			fill="var(--mus-scale)"
			stroke="var(--mus-skin-edge)"
		/>
		<Readout id="mus-scale" order={3} label="Scale" value={scaleText}>
			<rect
				x="690"
				y={tableY - 40}
				width="96"
				height="34"
				rx="6"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={738}
				y={tableY - 17}
				text={scaleText}
				anchor="middle"
				size={18}
				weight={700}
				tabular
			/>
			<line
				x1="690"
				y1={tableY - 14}
				x2="660"
				y2={tableY + 2}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
			/>
		</Readout>
	{/if}

	<!-- the arm: skin, bones, muscles -->
	<path d={skin} fill="var(--mus-skin)" stroke="var(--mus-skin-edge)" stroke-width="2" />
	<!-- the hand, a loose fist -->
	<g transform="translate({handP.x} {handP.y}) rotate({deg})">
		<rect
			x="-74"
			y="-25"
			width="92"
			height="50"
			rx="22"
			fill="var(--mus-skin)"
			stroke="var(--mus-skin-edge)"
			stroke-width="2"
		/>
		<path d="M-14 -16 Q12 -18 12 2" fill="none" stroke="var(--mus-skin-edge)" stroke-width="1.5" />
	</g>

	{#each [{ id: 'h', b: humerus, w: 17 }, { id: 'u', b: ulna, w: 11 }, { id: 'r', b: radius, w: 9 }] as bone (bone.id)}
		<line
			x1={bone.b.a.x}
			y1={bone.b.a.y}
			x2={bone.b.b.x}
			y2={bone.b.b.y}
			stroke="var(--mus-bone-edge)"
			stroke-width={bone.w + 3}
			stroke-linecap="round"
		/>
	{/each}
	<circle cx={humerus.a.x} cy={humerus.a.y + 4} r="18.5" fill="var(--mus-bone-edge)" />
	{#each [{ id: 'h', b: humerus, w: 17 }, { id: 'u', b: ulna, w: 11 }, { id: 'r', b: radius, w: 9 }] as bone (bone.id)}
		<line
			x1={bone.b.a.x}
			y1={bone.b.a.y}
			x2={bone.b.b.x}
			y2={bone.b.b.y}
			stroke="var(--mus-bone)"
			stroke-width={bone.w}
			stroke-linecap="round"
		/>
	{/each}
	<circle cx={humerus.a.x} cy={humerus.a.y + 4} r="17" fill="var(--mus-bone)" />
	<circle cx={E.x} cy={E.y} r="3.5" fill="var(--mus-bone-edge)" />

	<!-- triceps -->
	{#if true}
		{@const ol = px(triceps.ol)}
		{@const w = px(triceps.b)}
		{@const c = px(triceps.ctrl)}
		{@const top = px(T_TOP)}
		<path
			d="M{f1(w.x)} {f1(w.y)} Q{f1(c.x)} {f1(c.y)} {f1(ol.x)} {f1(ol.y)}"
			fill="none"
			stroke="var(--mus-tendon)"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<line
			x1={top.x}
			y1={top.y}
			x2={px(triceps.a).x}
			y2={px(triceps.a).y}
			stroke="var(--mus-tendon)"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<path
			d={bellyPath(triceps.outer, triceps.inner)}
			fill="var(--mus-relaxed)"
			stroke="var(--mus-edge)"
			stroke-width="1.5"
		/>
		<path
			d={bellyPath(triceps.outer, triceps.inner)}
			fill="var(--mus-active)"
			opacity={tOn.current}
		/>
		{#if tOn.current > 0.05}
			{#each [0.2, 0.5, 0.8] as k (k)}
				<path
					d={fibre(triceps.a, triceps.b, -1, 0, (-0.3 + 1.9 * k) * triceps.w)}
					fill="none"
					stroke="var(--mus-fibre)"
					stroke-width="2"
					stroke-dasharray="6 10"
					stroke-dashoffset={flow}
					opacity={tOn.current * 0.8}
				/>
			{/each}
		{/if}
		<circle cx={ol.x} cy={ol.y} r="4" fill="var(--mus-tendon)" />
	{/if}

	<!-- biceps -->
	{#if true}
		{@const o = px(biceps.o)}
		{@const i = px(biceps.i)}
		{@const a = px(biceps.a)}
		{@const b = px(biceps.b)}
		<line
			x1={o.x}
			y1={o.y}
			x2={a.x}
			y2={a.y}
			stroke="var(--mus-tendon)"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<line
			x1={b.x}
			y1={b.y}
			x2={i.x}
			y2={i.y}
			stroke="var(--mus-tendon)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<path
			d={bellyPath(biceps.outer, biceps.inner)}
			fill="var(--mus-relaxed)"
			stroke="var(--mus-edge)"
			stroke-width="1.5"
		/>
		<path
			d={bellyPath(biceps.outer, biceps.inner)}
			fill="var(--mus-active)"
			opacity={bOn.current}
		/>
		{#if bOn.current > 0.05}
			{#each [0.2, 0.5, 0.8] as k (k)}
				<path
					d={fibre(biceps.a, biceps.b, biceps.nx, biceps.ny, (-0.35 + 1.85 * k) * biceps.w)}
					fill="none"
					stroke="var(--mus-fibre)"
					stroke-width="2"
					stroke-dasharray="6 10"
					stroke-dashoffset={flow}
					opacity={bOn.current * 0.8}
				/>
			{/each}
		{/if}
		<circle cx={i.x} cy={i.y} r="4.5" fill="var(--mus-tendon)" />
		{#if phase === 'grip'}
			{@const real = px(onForearm(angle, BICEPS_GRIP, 1.5))}
			<circle
				cx={real.x}
				cy={real.y}
				r="7"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="3 3"
			/>
		{/if}
	{/if}

	<!-- pulls: a pulling muscle draws its two ends together -->
	{#each bArrows as a (a.id)}
		<line
			x1={a.x1}
			y1={a.y1}
			x2={a.x2}
			y2={a.y2}
			stroke="var(--mus-pull)"
			stroke-width="5"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/each}
	{#each tArrows as a (a.id)}
		<line
			x1={a.x1}
			y1={a.y1}
			x2={a.x2}
			y2={a.y2}
			stroke="var(--mus-pull)"
			stroke-width="5"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/each}

	<!-- the bag of shopping -->
	{#if showBag}
		{@const bx = bagTop.x}
		{@const by = bagTop.y}
		{@const bw = 56 + 2.4 * bagOn}
		{@const bh = 50 + 3 * bagOn}
		<g opacity={1 - dropped.current}>
			<path
				d="M{bx - bw * 0.28} {by} Q{bx - bw * 0.2} {handP.y + 6} {bx} {handP.y + 8} Q{bx +
					bw * 0.2} {handP.y + 6} {bx + bw * 0.28} {by}"
				fill="none"
				stroke="var(--mus-bag-edge)"
				stroke-width="3"
			/>
			<circle cx={bx - bw * 0.18} cy={by - 4} r="9" fill="#e8590c" />
			<circle cx={bx + bw * 0.12} cy={by - 6} r="10" fill="#94d82d" />
			<path
				d="M{bx - bw / 2} {by} L{bx + bw / 2} {by} L{bx + bw / 2 - 5} {by + bh} L{bx -
					bw / 2 +
					5} {by + bh} Z"
				fill="var(--mus-bag)"
				stroke="var(--mus-bag-edge)"
				stroke-width="2"
				stroke-linejoin="round"
			/>
			<Label
				x={bx}
				y={by + bh / 2 + 6}
				text="{bagOn} kg"
				anchor="middle"
				size={16}
				weight={700}
				halo={false}
				color="var(--mus-bag-ink)"
				tabular
			/>
		</g>
	{/if}

	<!-- names -->
	{#if true}
		{@const bl = px({
			x: (biceps.a.x + biceps.b.x) / 2 + biceps.nx * (biceps.w * 1.5 + 1.6),
			y: (biceps.a.y + biceps.b.y) / 2 + biceps.ny * (biceps.w * 1.5 + 1.6)
		})}
		{@const tl = px({ x: (triceps.a.x + triceps.b.x) / 2 - triceps.w * 1.6 - 1.4, y: -16 })}
		<Readout id="mus-biceps" order={10} label="Biceps" marker={1} at={[bl.x + 14, bl.y]}>
			<Label x={bl.x} y={bl.y} text="biceps" size={17} weight={700} color="var(--mus-name)" />
		</Readout>
		<Readout id="mus-triceps" order={11} label="Triceps" marker={2} at={[tl.x - 14, tl.y]}>
			<Label
				x={tl.x}
				y={tl.y}
				text="triceps"
				size={17}
				weight={700}
				anchor="end"
				color="var(--mus-name)"
			/>
		</Readout>
		{#if phase === 'arm' || phase === 'squeeze'}
			<Readout id="mus-elbow">
				<Label x={E.x - 46} y={E.y + 6} text="elbow" size={14} muted anchor="end" />
			</Readout>
		{/if}
	{/if}

	<!-- the hand can be dragged on the first step -->
	{#if phase === 'arm'}
		<Handle
			x={handP.x}
			y={handP.y}
			r={12}
			label="Hand"
			value={elbowParam}
			min={20}
			max={FULLY_BENT}
			valuetext="{elbowParam} degrees: {headline}"
			onmove={moveHand}
			onkey={keyHand}
		/>
	{/if}

	<!-- readouts -->
	<Readout id="mus-head" order={1} label="Arm" value={headline}>
		<Label x={936} y={40} text={headline} anchor="end" size={19} weight={700} tabular />
	</Readout>
	{#if sub}
		<Readout id="mus-sub" order={2} label="Compared" value={sub}>
			<Label x={936} y={70} text={sub} anchor="end" size={14} muted tabular />
		</Readout>
	{/if}
</g>
