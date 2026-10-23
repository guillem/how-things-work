<script lang="ts">
	/**
	 * A 20-tonne digger from the side, drawn to scale (55 px per metre). Its boom, arm and bucket are
	 * swung by three cylinders whose pins come from `geometry` in the model, so each cylinder's rod
	 * really slides out or in as its joint turns.
	 *
	 * intro: the arm lifts a boulder, up and down by itself. scoop: the reader works the digger
	 * through the model's scoop (each move by one cylinder, which is highlighted, with oil running in
	 * its hose). next: the arm held up, its three parts named.
	 */
	import { Label, clamp, cycle, easeInOut, hash, pingpong, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CYLINDERS,
		SCOOP,
		cylinderLengths,
		cylinderPushKg,
		geometry,
		scoopAt,
		type CylinderName,
		type Point,
		type Pose
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'intro'));
	const tt = $derived(reduced ? 2.5 : t);

	// ---- the scale -----------------------------------------------------------------------------------
	const K = 55;
	const OX = 250;
	const GROUND = 470;
	const X = (x: number) => OX + x * K;
	const Y = (y: number) => GROUND - y * K;
	const P = (p: Point) => `${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`;

	// ---- the pose ------------------------------------------------------------------------------------
	const u = $derived(clamp(Number(params.scoop ?? 0), 0, 100) / 100);
	const sc = $derived(scoopAt(u));
	const pose = $derived.by((): Pose => {
		if (phase === 'scoop') return sc.pose;
		if (phase === 'next') return SCOOP[5].pose;
		// intro: lift a boulder and lower it again, slowly.
		const e = easeInOut(pingpong(tt, 9, 0.12));
		return { boom: 14 + 26 * e, arm: -78, bucket: -125 };
	});
	const g = $derived(geometry(pose));

	/** The cylinder making the move in progress, and whether its rod is going out. */
	const active = $derived.by((): { name: CylinderName; out: boolean } | null => {
		if (phase !== 'scoop' || u <= 0 || u >= 1) return null;
		const m = SCOOP[sc.move];
		if (!m.by) return null;
		const a = cylinderLengths(SCOOP[sc.move - 1].pose)[m.by];
		const b = cylinderLengths(m.pose)[m.by];
		return { name: m.by, out: b > a };
	});
	const doing = $derived(
		u <= 0 ? 'ready to dig' : u >= 1 ? 'dumped: ready for the next scoop' : SCOOP[sc.move].what
	);

	// ---- cylinders: a barrel pinned at one end, a rod sliding out of it ------------------------------
	/** Each barrel is as long as its cylinder's shortest length less a little, so the rod always shows. */
	const barrel = (() => {
		const out = { boom: 9, arm: 9, bucket: 9 } as Record<CylinderName, number>;
		for (let i = 0; i <= 60; i++) {
			const l = cylinderLengths(scoopAt(i / 60).pose);
			for (const c of CYLINDERS) out[c] = Math.min(out[c], l[c]);
		}
		for (const c of CYLINDERS) out[c] *= 0.82;
		return out;
	})();
	const BORE: Record<CylinderName, number> = { boom: 18, arm: 17, bucket: 14 };
	const cyl = $derived(
		CYLINDERS.map((c) => {
			const [a, b] = g.cylinders[c];
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			const f = barrel[c] / len;
			const end = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
			return { c, a, b, end };
		})
	);

	// ---- the boom's outline (bent a little, like a real one) ---------------------------------------
	const boomPath = $derived.by(() => {
		const dx = g.boomTip.x - g.pivot.x;
		const dy = g.boomTip.y - g.pivot.y;
		const L = Math.hypot(dx, dy);
		const nx = -dy / L;
		const ny = dx / L;
		const knee = { x: g.pivot.x + dx * 0.5 + nx * 0.25, y: g.pivot.y + dy * 0.5 + ny * 0.25 };
		return `M${P(g.pivot)} L${P(knee)} L${P(g.boomTip)}`;
	});
	const bucketPath = $derived(
		`M${P(g.armTip)} L${P(g.bucketBack)} Q${P({
			x: g.bucketBack.x + (g.teeth.x - g.armTip.x) * 0.55,
			y: g.bucketBack.y + (g.teeth.y - g.armTip.y) * 0.55
		})} ${P(g.teeth)} Z`
	);
	const bucketMid = $derived({
		x: (g.armTip.x + g.bucketBack.x + g.teeth.x) / 3,
		y: (g.armTip.y + g.bucketBack.y + g.teeth.y) / 3
	});

	// ---- dirt: the hole, the bucket's load, the heap ------------------------------------------------
	const at = (move: number) => (sc.move > move ? 1 : sc.move === move ? sc.within : 0);
	const dug = $derived(phase === 'scoop' ? at(3) : 0);
	const inBucket = $derived(
		phase === 'scoop' ? at(4) * (1 - smoothstep(0.1, 0.7, at(7))) : phase === 'intro' ? 0 : 0
	);
	const heap = $derived(phase === 'scoop' ? smoothstep(0.15, 0.85, at(7)) : 0);
	const dumping = $derived(
		phase === 'scoop' && sc.move === 7 && sc.within > 0.12 && sc.within < 0.9
	);
	const holeLeft = $derived(9.0 - 2.9 * dug);
	const holePath = $derived(
		`M${X(holeLeft)} ${GROUND} Q${X((holeLeft + 9.5) / 2)} ${Y(-1.9 * Math.min(1, dug * 3))} ${X(9.5)} ${GROUND} Z`
	);
	const HEAP_X = 5.0;
	const heapPath = $derived(
		`M${X(HEAP_X - 0.9)} ${GROUND} Q${X(HEAP_X)} ${Y(1.3 * heap)} ${X(HEAP_X + 0.9)} ${GROUND} Z`
	);
	const crumbs = $derived(
		Array.from({ length: 8 }, (_, i) => {
			const c = cycle(tt, 0.9, i / 8);
			const x = HEAP_X + (hash(i, 3) - 0.5) * 0.7;
			return {
				i,
				x: X(x),
				y: Y(2.0 - 2.0 * c * c + 0.2),
				o: smoothstep(0, 0.1, c) * (1 - smoothstep(0.85, 1, c))
			};
		})
	);

	// ---- hoses from the pump to each barrel's far end -------------------------------------------------
	const hoses = $derived(
		cyl.map((k) => {
			const pts: Point[] = [
				{ x: -0.3, y: 2.2 },
				{ x: g.pivot.x, y: g.pivot.y + 0.35 }
			];
			if (k.c !== 'boom') {
				const dx = g.boomTip.x - g.pivot.x;
				const dy = g.boomTip.y - g.pivot.y;
				const L = Math.hypot(dx, dy);
				const s = k.c === 'arm' ? 0.45 : 0.85;
				pts.push({
					x: g.pivot.x + dx * s - (dy / L) * 0.5,
					y: g.pivot.y + dy * s + (dx / L) * 0.5
				});
			}
			pts.push(k.a);
			return { c: k.c, d: `M${pts.map(P).join(' L')}` };
		})
	);

	const strength = Math.round(cylinderPushKg() / 1000);
	const NAMES: Record<CylinderName, string> = { boom: 'boom', arm: 'arm', bucket: 'bucket' };
	const named = $derived(phase === 'scoop' || phase === 'next');
	const label = (a: Point, b: Point, f: number, off: number) => {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const L = Math.hypot(dx, dy);
		return { x: X(a.x + dx * f + (-dy / L) * off), y: Y(a.y + dy * f + (dx / L) * off) };
	};
	const boomLabel = $derived(label(g.pivot, g.boomTip, 0.62, 0.95));
	const armLabel = $derived(label(g.boomTip, g.armTip, 0.5, 0.75));
	const hoseLabel = $derived(label(g.pivot, g.boomTip, 0.3, 1.25));
	const bucketLabel = $derived({
		x: X(Math.max(g.armTip.x, g.teeth.x, g.bucketBack.x)) + 14,
		y: Y(bucketMid.y) + 5
	});
</script>

<g class="digger-scene">
	<!-- the ground, the hole and the heap -->
	<rect x="0" y={GROUND} width="960" height={600 - GROUND} fill="var(--hyd-dirt)" opacity="0.55" />
	<line x1="0" x2="960" y1={GROUND} y2={GROUND} stroke="var(--hyd-dirt-dark)" stroke-width="2" />
	{#if dug > 0}
		<path d={holePath} fill="var(--hyd-dirt-dark)" opacity="0.8" />
	{/if}
	{#if heap > 0}
		<path d={heapPath} fill="var(--hyd-dirt)" stroke="var(--hyd-dirt-dark)" stroke-width="1.5" />
	{/if}

	<!-- tracks and body -->
	<rect
		x={X(-2.3)}
		y={Y(0.95)}
		width={4.6 * K}
		height={0.95 * K}
		rx={0.45 * K}
		fill="var(--hyd-track)"
	/>
	{#each [-1.7, -0.6, 0.5, 1.6] as w (w)}
		<circle cx={X(w)} cy={Y(0.47)} r={0.28 * K} fill="var(--stage-bg)" opacity="0.35" />
	{/each}
	<path
		d="M{X(-2.7)} {Y(1.0)} H{X(1.7)} V{Y(2.2)} H{X(-2.7)} Z"
		fill="var(--hyd-paint)"
		stroke="var(--hyd-paint-edge)"
		stroke-width="1.5"
	/>
	<path
		d="M{X(-0.3)} {Y(2.2)} V{Y(3.6)} H{X(0.9)} L{X(1.4)} {Y(2.6)} V{Y(2.2)} Z"
		fill="var(--hyd-paint)"
		stroke="var(--hyd-paint-edge)"
		stroke-width="1.5"
	/>
	<path
		d="M{X(-0.1)} {Y(2.4)} V{Y(3.4)} H{X(0.8)} L{X(1.2)} {Y(2.6)} V{Y(2.4)} Z"
		fill="var(--stage-bg)"
		opacity="0.75"
	/>
	<Readout id="hyd-pump">
		<Label x={X(-1.5)} y={Y(1.6)} text="engine and pump" size={12} />
	</Readout>

	<!-- boom, arm, bucket -->
	<path
		d={boomPath}
		fill="none"
		stroke="var(--hyd-paint-edge)"
		stroke-width="30"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d={boomPath}
		fill="none"
		stroke="var(--hyd-paint)"
		stroke-width="26"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<line
		x1={X(g.armTail.x)}
		y1={Y(g.armTail.y)}
		x2={X(g.armTip.x)}
		y2={Y(g.armTip.y)}
		stroke="var(--hyd-paint-edge)"
		stroke-width="22"
		stroke-linecap="round"
	/>
	<line
		x1={X(g.armTail.x)}
		y1={Y(g.armTail.y)}
		x2={X(g.armTip.x)}
		y2={Y(g.armTip.y)}
		stroke="var(--hyd-paint)"
		stroke-width="18"
		stroke-linecap="round"
	/>
	<path
		d={bucketPath}
		fill="var(--hyd-track)"
		stroke="var(--hyd-paint-edge)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	{#if inBucket > 0}
		<circle
			cx={X(bucketMid.x)}
			cy={Y(bucketMid.y)}
			r={0.42 * K}
			fill="var(--hyd-dirt)"
			stroke="var(--hyd-dirt-dark)"
			opacity={inBucket}
		/>
	{/if}
	{#if phase === 'intro'}
		<path
			d="M{X(bucketMid.x) - 30} {Y(bucketMid.y) + 12} Q{X(bucketMid.x) - 36} {Y(bucketMid.y) -
				24} {X(bucketMid.x) - 4} {Y(bucketMid.y) - 34} Q{X(bucketMid.x) + 34} {Y(bucketMid.y) -
				30} {X(bucketMid.x) + 30} {Y(bucketMid.y) + 8} Z"
			fill="var(--hyd-rock)"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
	{/if}
	<!-- hoses -->
	{#each hoses as h (h.c)}
		<path
			d={h.d}
			fill="none"
			stroke={active?.name === h.c ? 'var(--hyd-oil-dark)' : 'var(--hyd-hose)'}
			stroke-width={active?.name === h.c ? 4 : 2.5}
			stroke-linejoin="round"
			stroke-dasharray={active?.name === h.c ? '8 6' : undefined}
			stroke-dashoffset={active?.name === h.c ? -tt * 30 : 0}
		/>
	{/each}

	{#each [g.pivot, g.boomTip, g.armTip] as pin, i (i)}
		<circle cx={X(pin.x)} cy={Y(pin.y)} r="5" fill="var(--hyd-steel)" stroke="var(--stage-ink)" />
	{/each}

	<!-- falling dirt while the bucket opens -->
	{#if dumping}
		{#each crumbs as c (c.i)}
			<circle cx={c.x} cy={c.y} r="5" fill="var(--hyd-dirt)" opacity={c.o} />
		{/each}
	{/if}

	<!-- the three cylinders -->
	{#each cyl as k (k.c)}
		{@const on = active?.name === k.c}
		<line
			x1={X(k.a.x)}
			y1={Y(k.a.y)}
			x2={X(k.b.x)}
			y2={Y(k.b.y)}
			stroke="var(--hyd-steel-edge)"
			stroke-width="8"
			stroke-linecap="round"
		/>
		<line
			x1={X(k.a.x)}
			y1={Y(k.a.y)}
			x2={X(k.b.x)}
			y2={Y(k.b.y)}
			stroke="var(--hyd-rod)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={X(k.a.x)}
			y1={Y(k.a.y)}
			x2={X(k.end.x)}
			y2={Y(k.end.y)}
			stroke={on ? 'var(--hyd-active)' : 'var(--hyd-steel-edge)'}
			stroke-width={BORE[k.c] + 3}
			stroke-linecap="round"
		/>
		<line
			x1={X(k.a.x)}
			y1={Y(k.a.y)}
			x2={X(k.end.x)}
			y2={Y(k.end.y)}
			stroke={on ? 'var(--hyd-oil)' : 'var(--hyd-steel)'}
			stroke-width={BORE[k.c] - 1}
			stroke-linecap="round"
		/>
		<circle cx={X(k.a.x)} cy={Y(k.a.y)} r="4" fill="var(--hyd-steel)" stroke="var(--stage-ink)" />
		<circle cx={X(k.b.x)} cy={Y(k.b.y)} r="4" fill="var(--hyd-steel)" stroke="var(--stage-ink)" />
	{/each}

	<!-- labels -->
	{#if phase === 'intro'}
		{@const bc = cyl[0]}
		<Readout id="hyd-intro-cyl">
			<Label
				x={X(bc.end.x) + 30}
				y={Y(bc.end.y) + 70}
				text="a cylinder: oil pushes its shiny rod out"
				anchor="start"
				size={15}
				weight={600}
			/>
			<line
				x1={X(bc.end.x) + 26}
				y1={Y(bc.end.y) + 62}
				x2={X((bc.a.x + bc.end.x) / 2) + 8}
				y2={Y((bc.a.y + bc.end.y) / 2) + 6}
				stroke="var(--stage-ink-muted)"
			/>
			<Label x={hoseLabel.x} y={hoseLabel.y} text="hoses full of oil" anchor="end" size={14} />
			<Label
				x={X(bucketMid.x) + 46}
				y={Y(bucketMid.y) - 30}
				text="boulder: 3 tonnes"
				anchor="start"
				size={14}
			/>
		</Readout>
	{/if}
	{#if named}
		<Readout id="hyd-name-boom" order={10} label="Boom" marker={1} at={[boomLabel.x, boomLabel.y]}>
			<Label x={boomLabel.x} y={boomLabel.y} text="boom" size={15} weight={700} />
		</Readout>
		<Readout id="hyd-name-arm" order={11} label="Arm" marker={2} at={[armLabel.x, armLabel.y]}>
			<Label x={armLabel.x} y={armLabel.y} text="arm" size={15} weight={700} />
		</Readout>
		<Readout
			id="hyd-name-bucket"
			order={12}
			label="Bucket"
			marker={3}
			at={[bucketLabel.x, bucketLabel.y]}
		>
			<Label
				x={bucketLabel.x}
				y={bucketLabel.y}
				text="bucket"
				anchor="start"
				size={15}
				weight={700}
			/>
		</Readout>
	{/if}
	{#if phase === 'scoop'}
		<Readout id="hyd-doing" order={1} label="Now" value={doing}>
			<Label x={936} y={44} text="now: {doing}" anchor="end" size={16} weight={700} />
		</Readout>
		{@const cylText = active
			? `the ${NAMES[active.name]} cylinder ${active.out ? 'pushes its rod out' : 'pulls its rod in'}`
			: 'move the slider to work the cylinders'}
		<Readout id="hyd-cyl" order={2} label="Cylinder" value={cylText}>
			<Label
				x={936}
				y={68}
				text={cylText}
				anchor="end"
				size={15}
				color={active ? 'var(--hyd-active)' : undefined}
			/>
		</Readout>
	{/if}
	{#if phase === 'scoop' || phase === 'next'}
		<Readout
			id="hyd-strength"
			order={3}
			label="Each boom cylinder"
			value="pushes like lifting about {strength} tonnes"
		>
			<Label
				x={936}
				y={phase === 'scoop' ? 92 : 44}
				text="each boom cylinder pushes like lifting about {strength} tonnes"
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
</g>
