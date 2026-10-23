<script lang="ts">
	/**
	 * A child on an office chair (left, drawn in 3D and turned by the model's chair angle), the
	 * ear's flat ring seen from above with its fluid and its flap (middle, in the head's own frame:
	 * the ring stays put on the page while the fluid slips behind it), three readouts (right) and a
	 * chart of the chair's speed and the speed you feel (bottom). Everything is the model's, along
	 * a story of spinning and stopping that each focus sets:
	 *
	 * 'chair' and 'next': spin for 15 s, stop, watch the after-spin; 'start': the push-off;
	 * 'steady': half a minute at a steady speed; 'stop' and 'honest': half a minute of spinning
	 * and the stop; 'long': spin for `params.spinFor` seconds, then stop.
	 *
	 * The story runs at STORY times real time and loops with a short hold at its end. Under reduced
	 * motion the frame is the story's key moment (just after the stop, or the steady spin's end).
	 */
	import { Axes, Label, TAU, clamp, cycle, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		UNFELT,
		chairAngle,
		chairSpeed,
		dirWords,
		feeling,
		flap,
		howMuch,
		speedOf,
		spin,
		turnsWords,
		type Spin
	} from '../model';
	import { project, yaw, type V3, type View } from './view3d';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'chair'));
	const turns = $derived(Number(params.speed ?? 5));
	const w = $derived(speedOf(turns));
	const spinFor = $derived(Number(params.spinFor ?? 10));

	/** Story seconds per second of the step. */
	const STORY = 2;
	/** Story seconds held at the end before the story starts again. */
	const HOLD = 4;
	/** The moment the chair is pushed off. */
	const START = 1;

	interface Story {
		spin: Spin;
		from: number;
		to: number;
		/** The frame shown under reduced motion. */
		key: number;
		stopAt?: number;
	}
	const story: Story = $derived.by(() => {
		if (focus === 'start') return { spin: spin(w, START), from: 0, to: 8, key: 2.2 };
		if (focus === 'steady') return { spin: spin(w, START), from: 0, to: 40, key: 31 };
		if (focus === 'stop' || focus === 'honest') {
			const at = START + 30;
			return { spin: spin(w, START, at), from: 24, to: 60, key: at + 2.5, stopAt: at };
		}
		if (focus === 'long') {
			const at = START + spinFor;
			return { spin: spin(w, START, at), from: 0, to: at + 25, key: at + 1, stopAt: at };
		}
		const at = START + 15;
		return { spin: spin(w, START, at), from: 0, to: 40, key: at + 3, stopAt: at };
	});

	const now = $derived.by(() => {
		if (reduced) return story.key;
		const len = story.to - story.from;
		return story.from + Math.min(len, (t * STORY) % (len + HOLD));
	});
	const chairV = $derived(chairSpeed(story.spin, now));
	const flapV = $derived(flap(story.spin, now));
	const feelV = $derived(feeling(story.spin, now));
	const angle = $derived((chairAngle(story.spin, now) * Math.PI) / 180);
	const stopped = $derived(story.stopAt !== undefined && now >= story.stopAt);

	const clock = $derived.by(() => {
		if (now < START) return 'Ready to push off';
		const sec = (n: number) => `${n} ${n === 1 ? 'second' : 'seconds'}`;
		if (story.stopAt === undefined || now < story.stopAt)
			return `${sec(Math.floor(now - START))} of spinning`;
		return `Stopped ${sec(Math.floor(now - story.stopAt))} ago`;
	});

	// ---- focus ---------------------------------------------------------------------------------
	const ringO = $derived(focus === 'chair' ? 0.35 : 1);

	// ---- the child on the chair ----------------------------------------------------------------
	const VIEW: View = { cx: 178, cy: 412, s: 2.35, elev: 0.26 };
	const P = (p: V3) => project(VIEW, yaw(p, angle));
	const FIXED = (p: V3) => project(VIEW, p);

	interface Part {
		id: string;
		a: V3;
		b: V3;
		w: number;
		color: string;
	}
	const SKIN = 'var(--dz-skin)';
	const SHIRT = 'var(--dz-shirt)';
	const LEGS = 'var(--dz-trousers)';
	const PARTS: Part[] = [
		{ id: 'thighL', a: [-9, 50, 0], b: [-10, 52, 32], w: 9, color: LEGS },
		{ id: 'thighR', a: [9, 50, 0], b: [10, 52, 32], w: 9, color: LEGS },
		{ id: 'shinL', a: [-10, 52, 32], b: [-11, 18, 36], w: 7.5, color: LEGS },
		{ id: 'shinR', a: [10, 52, 32], b: [11, 18, 36], w: 7.5, color: LEGS },
		{ id: 'footL', a: [-11, 15, 34], b: [-11, 14, 44], w: 6, color: 'var(--dz-shoe)' },
		{ id: 'footR', a: [11, 15, 34], b: [11, 14, 44], w: 6, color: 'var(--dz-shoe)' },
		{ id: 'body', a: [0, 54, -3], b: [0, 86, -6], w: 21, color: SHIRT },
		{ id: 'armUL', a: [-15, 86, -5], b: [-19, 66, 6], w: 6, color: SHIRT },
		{ id: 'armUR', a: [15, 86, -5], b: [19, 66, 6], w: 6, color: SHIRT },
		{ id: 'armLL', a: [-19, 66, 6], b: [-12, 56, 26], w: 5, color: SKIN },
		{ id: 'armLR', a: [19, 66, 6], b: [12, 56, 26], w: 5, color: SKIN },
		{ id: 'neck', a: [0, 88, -6], b: [0, 96, -5], w: 6, color: SKIN }
	];
	const HEAD: V3 = [0, 106, -4];
	const HEAD_R = 11.5;

	const parts = $derived(
		PARTS.map((p) => {
			const a = P(p.a);
			const b = P(p.b);
			return { ...p, pa: a, pb: b, depth: (a.depth + b.depth) / 2 };
		}).sort((x, y) => x.depth - y.depth)
	);
	const head = $derived(P(HEAD));
	const headR = VIEW.s * HEAD_R;
	/** The face: where the front of the head points, and how much of it the viewer sees. */
	const face = $derived.by(() => {
		const n = yaw([0, 0, 1], angle);
		const front = n[2];
		return {
			x: head.x + VIEW.s * HEAD_R * 0.42 * n[0],
			y: head.y + VIEW.s * HEAD_R * 0.1 * front,
			rx: headR * (0.55 + 0.25 * Math.abs(front)),
			show: front > -0.25,
			front
		};
	});
	const eyes = $derived(
		([-1, 1] as const).map((side) => {
			const p = P([side * 4.2, HEAD[1] + 1.5, HEAD[2] + HEAD_R * 0.92]);
			return { side, x: p.x, y: p.y, show: p.depth > head.depth + 4 };
		})
	);
	// The chair: the seat and back turn with the child; the column and the star base stay put.
	const back = $derived(
		(
			[
				[-16, 56, -15],
				[16, 56, -15],
				[16, 98, -19],
				[-16, 98, -19]
			] as V3[]
		).map(P)
	);
	const backDepth = $derived(back.reduce((s, p) => s + p.depth, 0) / 4);
	const backPath = $derived(
		`M${back.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} Z`
	);
	const seat = FIXED([0, 46, 0]);
	const SEAT_R = 23 * VIEW.s;
	const SEAT_RY = SEAT_R * Math.sin(VIEW.elev);
	const column = { a: FIXED([0, 44, 0]), b: FIXED([0, 14, 0]) };
	const LEG_N = 5;
	const baseLegs = Array.from({ length: LEG_N }, (_, i) => {
		const a = (i / LEG_N) * TAU + 0.3;
		const end = FIXED([30 * Math.cos(a), 7, 30 * Math.sin(a)]);
		return { i, x: end.x, y: end.y, front: Math.sin(a) > 0 };
	});
	const hub = FIXED([0, 12, 0]);
	/** Parts behind the back rest are drawn before it, the rest after. */
	const behind = $derived(parts.filter((p) => p.depth < backDepth));
	const infront = $derived(parts.filter((p) => p.depth >= backDepth));
	const headBehind = $derived(head.depth < backDepth);

	// ---- arrows: the chair's real turning (round the seat), the feeling (round the head) ---------
	function arc(cy3: number, r3: number, v: number, ref: number) {
		const u = clamp(Math.abs(v) / Math.max(ref, 1));
		if (u < 0.04) return null;
		const half = 1.35 * u;
		const pts: { x: number; y: number }[] = [];
		const n = 24;
		for (let i = 0; i <= n; i++) {
			// Round the front of the ellipse; turning right runs from the viewer's right to left.
			const ph = (v > 0 ? half : -half) - (v > 0 ? 1 : -1) * ((2 * half * i) / n);
			pts.push(FIXED([r3 * Math.sin(ph), cy3, r3 * Math.cos(ph)]));
		}
		return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
	}
	const chairArc = $derived(arc(30, 40, chairV, w));
	const feelArc = $derived(arc(128, 30, feelV, w));
	const feelWidth = $derived(2 + 4 * clamp(Math.abs(feelV) / 360));

	// The room seems to swirl after the stop: the eyes drift with the spin you feel and flick back.
	const swirl = $derived.by(() => {
		if (!stopped || Math.abs(chairV) > 1 || Math.abs(feelV) < UNFELT * w) return 0;
		const amp = 16 * clamp(Math.abs(feelV) / w);
		const ph = reduced ? 0.5 : cycle(t, 0.7);
		return Math.sign(feelV) * amp * (ph - 0.5);
	});

	// ---- the ring, seen from above, in the head's frame -------------------------------------------
	const RC = { x: 490, y: 222 };
	/** Left edge of the readouts. */
	const RX = 706;
	const R = 102;
	const TUBE = 30;
	/** The flap sits in a bulge at the top of the ring. */
	const AMP = -Math.PI / 2;
	/** How far the drawing slips the fluid at the fastest spin, radians (a real slip is tiny). */
	const SLIP = (40 * Math.PI) / 180;
	const slip = $derived(-SLIP * clamp(flapV / 360, -1, 1));
	const GAP = (50 * Math.PI) / 180;
	const DOTS = 13;
	const dots = $derived(
		Array.from({ length: DOTS }, (_, i) => {
			const a = AMP + GAP + (i / (DOTS - 1)) * (TAU - 2 * GAP) + slip;
			return {
				i,
				x: RC.x + R * Math.cos(a),
				y: RC.y + R * Math.sin(a),
				o: 1
			};
		})
	);
	const ringPath = `M${RC.x + R} ${RC.y} A${R} ${R} 0 1 1 ${RC.x - R} ${RC.y} A${R} ${R} 0 1 1 ${RC.x + R} ${RC.y}`;
	/** The flap: from the outer wall (with the hair cells) to the inner wall, bulged by the slip. */
	const flapPath = $derived.by(() => {
		const outer = { x: RC.x, y: RC.y - R - TUBE / 2 - 10 };
		const inner = { x: RC.x, y: RC.y - R + TUBE / 2 };
		// The tangent at the top runs rightwards for a clockwise (rightward) turn.
		const bulge = 26 * (slip / SLIP);
		const mid = (outer.y + inner.y) / 2;
		const c = outer.x + 2 * bulge;
		// A jelly sail: wide at its foot on the hair cells, thin where it meets the far wall.
		return `M${outer.x - 9} ${outer.y} Q${c - 7} ${mid} ${inner.x - 2} ${inner.y} L${inner.x + 2} ${inner.y} Q${c + 7} ${mid} ${outer.x + 9} ${outer.y} Z`;
	});
	const flapOn = $derived(Math.abs(flapV) >= UNFELT * w);
	const earSays = $derived(dirWords(flapV, w));
	// The arrow round the outside: the ring turns with your head.
	const turnArc = (() => {
		const a0 = -0.15;
		const a1 = 0.85;
		const r = R + TUBE / 2 + 16;
		const p = (a: number) =>
			`${(RC.x + r * Math.cos(a)).toFixed(1)} ${(RC.y + r * Math.sin(a)).toFixed(1)}`;
		return `M${p(a0)} A${r} ${r} 0 0 1 ${p(a1)}`;
	})();
	const turnO = $derived(clamp(Math.abs(chairV) / Math.max(w, 1)));

	// ---- readouts ------------------------------------------------------------------------------
	const chairWords = $derived(
		Math.abs(chairV) < 1
			? 'stopped'
			: Math.abs(chairV) < w - 1
				? stopped
					? 'stopping'
					: 'speeding up'
				: `turning right`
	);
	const chairNote = $derived(Math.abs(chairV) < 1 ? 'the room is still' : turnsWords(turns));
	const feelDir = $derived(dirWords(feelV, w));
	const feelNote = $derived(
		feelDir === 'not turning' ? '' : `${howMuch(feelV, w)} the chair ${stopped ? 'spun' : 'turns'}`
	);
	/** On the 'long' step: the feeling just after the stop, whatever the playhead. */
	const afterStop = $derived.by(() => {
		if (story.stopAt === undefined) return 0;
		return feeling(story.spin, story.stopAt + 0.5);
	});

	// ---- the chart -----------------------------------------------------------------------------
	const CH = { x0: 88, x1: 932, y0: 452, y1: 560 };
	const sx = $derived(scale([story.from, story.to], [CH.x0, CH.x1]));
	/** The chart is scaled to the spin, so a slow spin's lines are as easy to read as a fast one's. */
	const YMAX = $derived(1.2 * w);
	const sy = $derived(scale([-YMAX, YMAX], [CH.y1, CH.y0]));
	const samples = $derived.by(() => {
		const n = 220;
		const out: { t: number; c: number; f: number }[] = [];
		for (let i = 0; i <= n; i++) {
			const tt = story.from + ((story.to - story.from) * i) / n;
			out.push({ t: tt, c: chairSpeed(story.spin, tt), f: feeling(story.spin, tt) });
		}
		return out;
	});
	const past = $derived(samples.filter((d) => d.t <= now));
	const chairLine = $derived(
		linePath(
			samples,
			(d) => d.t,
			(d) => d.c,
			sx,
			sy
		)
	);
	const feelLine = $derived(
		linePath(
			samples,
			(d) => d.t,
			(d) => d.f,
			sx,
			sy
		)
	);
	const chairPast = $derived(
		linePath(
			past,
			(d) => d.t,
			(d) => d.c,
			sx,
			sy
		)
	);
	const feelPast = $derived(
		linePath(
			past,
			(d) => d.t,
			(d) => d.f,
			sx,
			sy
		)
	);
	const xTicks = $derived.by(() => {
		const out: number[] = [];
		const len = story.to - story.from;
		const stepS = len > 30 ? 10 : len > 14 ? 5 : 2;
		for (let v = Math.ceil(story.from / stepS) * stepS; v <= story.to; v += stepS) out.push(v);
		return out;
	});
	const yFormat = (v: number) => (v > 0 ? 'right' : v < 0 ? 'left' : '0');
</script>

<g class="spin-scene">
	<!-- ===== the room and the child on the chair ===== -->
	<g>
		<g transform="translate({swirl} 0)">
			<rect
				x="36"
				y="96"
				width="66"
				height="84"
				rx="4"
				fill="var(--dz-window)"
				stroke="var(--dz-frame)"
				stroke-width="3"
			/>
			<line x1="69" y1="96" x2="69" y2="180" stroke="var(--dz-frame)" stroke-width="2" />
			<line x1="36" y1="138" x2="102" y2="138" stroke="var(--dz-frame)" stroke-width="2" />
			<rect
				x="262"
				y="150"
				width="50"
				height="38"
				rx="3"
				fill="none"
				stroke="var(--dz-frame)"
				stroke-width="2.5"
			/>
			<circle cx="279" cy="165" r="6" fill="var(--dz-frame)" opacity="0.6" />
		</g>
		<line x1="20" y1="402" x2="336" y2="402" stroke="var(--stage-line)" stroke-width="1.5" />

		<!-- base and column, fixed -->
		{#each baseLegs.filter((l) => !l.front) as l (l.i)}
			<line
				x1={hub.x}
				y1={hub.y}
				x2={l.x}
				y2={l.y}
				stroke="var(--dz-chair)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<circle cx={l.x} cy={l.y + 4} r="4.5" fill="var(--dz-chair-edge)" />
		{/each}
		<line
			x1={column.a.x}
			y1={column.a.y}
			x2={column.b.x}
			y2={column.b.y}
			stroke="var(--dz-chair-edge)"
			stroke-width="7"
		/>
		{#each baseLegs.filter((l) => l.front) as l (l.i)}
			<line
				x1={hub.x}
				y1={hub.y}
				x2={l.x}
				y2={l.y}
				stroke="var(--dz-chair)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<circle cx={l.x} cy={l.y + 4} r="4.5" fill="var(--dz-chair-edge)" />
		{/each}

		<!-- the chair's turning, round the seat -->
		{#if chairArc}
			<path
				d={chairArc}
				fill="none"
				stroke="var(--dz-chair-line)"
				stroke-width="3"
				stroke-linecap="round"
				marker-end="url(#arrowhead)"
			/>
		{/if}

		<!-- seat -->
		<ellipse cx={seat.x} cy={seat.y + 4} rx={SEAT_R} ry={SEAT_RY + 2} fill="var(--dz-chair-edge)" />
		<ellipse cx={seat.x} cy={seat.y} rx={SEAT_R} ry={SEAT_RY} fill="var(--dz-chair)" />

		{#each behind as p (p.id)}
			<line
				x1={p.pa.x}
				y1={p.pa.y}
				x2={p.pb.x}
				y2={p.pb.y}
				stroke={p.color}
				stroke-width={p.w * VIEW.s}
				stroke-linecap="round"
			/>
		{/each}
		{#if headBehind}
			{@render headShape()}
		{/if}
		<path
			d={backPath}
			fill="var(--dz-chair)"
			stroke="var(--dz-chair-edge)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		{#each infront as p (p.id)}
			<line
				x1={p.pa.x}
				y1={p.pa.y}
				x2={p.pb.x}
				y2={p.pb.y}
				stroke={p.color}
				stroke-width={p.w * VIEW.s}
				stroke-linecap="round"
			/>
		{/each}
		{#if !headBehind}
			{@render headShape()}
		{/if}

		<!-- the feeling, round the head -->
		{#if feelArc}
			<path
				d={feelArc}
				fill="none"
				stroke="var(--dz-feel)"
				stroke-width={feelWidth}
				stroke-linecap="round"
				marker-end="url(#arrowhead)"
				color="var(--dz-feel)"
			/>
		{/if}

		<Readout id="clock" order={0} label="Time" value={clock}>
			<Label x={178} y={40} text={clock} size={16} weight={700} tabular />
		</Readout>
	</g>

	<!-- ===== the ring ===== -->
	<g opacity={ringO}>
		<Label
			x={RC.x}
			y={RC.y + R + TUBE / 2 + 30}
			text="the flat ring, seen from above"
			size={12}
			muted
		/>
		<path
			d={turnArc}
			fill="none"
			stroke="var(--dz-chair-line)"
			stroke-width="2.5"
			opacity={turnO}
			marker-end="url(#arrowhead)"
		/>
		<Label
			x={RC.x + R + 4}
			y={RC.y + R + 30}
			text="turns with your head"
			size={11}
			muted
			anchor="start"
			opacity={turnO}
		/>
		<path d={ringPath} fill="none" stroke="var(--dz-tube-edge)" stroke-width={TUBE + 4} />
		<path d={ringPath} fill="none" stroke="var(--dz-fluid)" stroke-width={TUBE} />
		<!-- the bulge that holds the flap -->
		<ellipse
			cx={RC.x}
			cy={RC.y - R - 2}
			rx="36"
			ry="30"
			fill="var(--dz-fluid)"
			stroke="var(--dz-tube-edge)"
			stroke-width="2"
		/>
		<rect x={RC.x - 40} y={RC.y - R + 12} width="80" height="12" fill="var(--dz-fluid)" />
		{#each dots as d (d.i)}
			<circle cx={d.x} cy={d.y} r="6" fill="var(--dz-fluid-dot)" opacity={d.o} />
		{/each}
		<!-- hair cells at the flap's foot, and the nerve to the brain -->
		<path
			d="M{RC.x + 6} {RC.y - R - 28} q 30 -16 64 -30"
			fill="none"
			stroke="var(--dz-nerve)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<Label x={RC.x + 74} y={RC.y - R - 64} text="to the brain" size={11} muted anchor="start" />
		{#each [-8, 0, 8] as dx (dx)}
			<line
				x1={RC.x + dx}
				y1={RC.y - R - 26}
				x2={RC.x + dx + 0.3 * 26 * (slip / SLIP)}
				y2={RC.y - R - 14}
				stroke="var(--dz-hair-cell)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
		<ellipse cx={RC.x} cy={RC.y - R - 27} rx="15" ry="4" fill="var(--dz-hair-cell)" />
		<path
			d={flapPath}
			fill="var(--dz-flap)"
			stroke="var(--dz-flap-edge)"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<Label x={RC.x - 44} y={RC.y - R - 36} text="flap" size={14} weight={700} anchor="end" />
		<Label x={RC.x} y={RC.y + 6} text="fluid" size={13} weight={600} />
		{#if focus === 'honest' && stopped && flapOn}
			<Label x={RC.x} y={RC.y + 28} text="still moving" size={12} pill />
		{/if}
	</g>

	<!-- ===== readouts ===== -->
	<g>
		<Readout id="chair" order={1} label="The chair" value={chairWords} note={chairNote}>
			<Label x={RX} y={92} text="The chair" size={12} muted anchor="start" />
			<Label x={RX} y={114} text={chairWords} size={16} weight={700} anchor="start" />
			<Label x={RX} y={134} text={chairNote} size={12} muted anchor="start" />
		</Readout>
		<Readout
			id="ear"
			order={2}
			label="Your ear’s flap says"
			value={earSays}
			opacity={ringO > 0.5 ? 1 : 0}
		>
			{#if ringO > 0.5}
				<Label x={RX} y={180} text="Your ear’s flap says" size={12} muted anchor="start" />
				<Label
					x={RX}
					y={202}
					text={flapOn ? `bent: “${earSays}”` : 'straight: “not turning”'}
					size={16}
					weight={700}
					anchor="start"
				/>
			{/if}
		</Readout>
		<Readout
			id="feel"
			order={3}
			label="You feel"
			value={feelDir}
			note={feelNote}
			color="var(--dz-feel)"
		>
			<Label x={RX} y={252} text="You feel" size={12} muted anchor="start" />
			<Label
				x={RX}
				y={274}
				text={feelDir}
				size={16}
				weight={700}
				anchor="start"
				color="var(--dz-feel-ink)"
			/>
			{#if feelNote}
				<Label x={RX} y={294} text={feelNote} size={12} anchor="start" />
			{/if}
		</Readout>
		{#if focus === 'long'}
			<Readout
				id="after"
				order={4}
				label="Just after the stop"
				value={`${dirWords(afterStop, w)}, ${howMuch(afterStop, w)} the chair spun`}
			>
				<Label x={RX} y={340} text="Just after the stop, you feel" size={12} muted anchor="start" />
				<Label
					x={RX}
					y={362}
					text={dirWords(afterStop, w)}
					size={16}
					weight={700}
					anchor="start"
					color="var(--dz-feel-ink)"
				/>
				<Label
					x={RX}
					y={382}
					text={`${howMuch(afterStop, w)} the chair spun`}
					size={12}
					anchor="start"
				/>
			</Readout>
		{/if}
		{#if focus === 'honest' && stopped}
			<Readout id="honest" order={4} label="Your head" value="still; the fluid is still moving">
				<Label x={RX} y={340} text="Your head is still." size={13} weight={600} anchor="start" />
				<Label
					x={RX}
					y={358}
					text="The fluid is still moving."
					size={13}
					weight={600}
					anchor="start"
				/>
			</Readout>
		{/if}
	</g>

	<!-- ===== the chart ===== -->
	<g>
		<Axes
			{sx}
			{sy}
			{xTicks}
			yTicks={[-YMAX * 0.8, 0, YMAX * 0.8]}
			{yFormat}
			xLabel="seconds"
			grid={false}
		/>
		<line x1={CH.x0} y1={sy(0)} x2={CH.x1} y2={sy(0)} stroke="var(--stage-line)" stroke-width="1" />
		<path d={chairLine} fill="none" stroke="var(--dz-chair-line)" stroke-width="2" opacity="0.25" />
		<path d={feelLine} fill="none" stroke="var(--dz-feel)" stroke-width="2.5" opacity="0.22" />
		<path d={chairPast} fill="none" stroke="var(--dz-chair-line)" stroke-width="2.5" />
		<path d={feelPast} fill="none" stroke="var(--dz-feel)" stroke-width="3" />
		<line
			x1={sx(now)}
			y1={CH.y0 - 4}
			x2={sx(now)}
			y2={CH.y1}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="3 3"
		/>
		<circle cx={sx(now)} cy={sy(chairV)} r="4.5" fill="var(--dz-chair-line)" />
		<circle cx={sx(now)} cy={sy(feelV)} r="5" fill="var(--dz-feel)" />
		<Readout id="legend-chair" label="grey: the chair">
			<line
				x1={CH.x1 - 236}
				y1={CH.y0 - 14}
				x2={CH.x1 - 214}
				y2={CH.y0 - 14}
				stroke="var(--dz-chair-line)"
				stroke-width="2.5"
			/>
			<Label x={CH.x1 - 208} y={CH.y0 - 10} text="the chair" size={12} anchor="start" />
		</Readout>
		<Readout id="legend-feel" label="orange: what you feel" color="var(--dz-feel)">
			<line
				x1={CH.x1 - 130}
				y1={CH.y0 - 14}
				x2={CH.x1 - 108}
				y2={CH.y0 - 14}
				stroke="var(--dz-feel)"
				stroke-width="3"
			/>
			<Label x={CH.x1 - 102} y={CH.y0 - 10} text="what you feel" size={12} anchor="start" />
		</Readout>
	</g>
</g>

{#snippet headShape()}
	<defs>
		<clipPath id="spin-head">
			<circle cx={head.x} cy={head.y} r={headR} />
		</clipPath>
	</defs>
	<circle cx={head.x} cy={head.y} r={headR} fill="var(--dz-hair)" />
	{#if face.show}
		<g clip-path="url(#spin-head)">
			<ellipse cx={face.x} cy={face.y + 4} rx={face.rx} ry={headR * 0.8} fill="var(--dz-skin)" />
		</g>
		{#each eyes.filter((e) => e.show) as e (e.side)}
			<circle cx={e.x} cy={e.y} r="2.6" fill="var(--dz-eye)" />
		{/each}
	{/if}
{/snippet}
