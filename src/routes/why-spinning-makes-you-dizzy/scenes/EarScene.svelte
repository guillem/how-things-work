<script lang="ts">
	/**
	 * A head that shakes "no", nods "yes" or tilts to a shoulder (`params.turn`, left), and the
	 * inner ear of the ear facing us drawn large (right): the three rings at right angles, seen from
	 * the side, round the little chamber they join, with the cochlea in front of it. The rings that
	 * the movement stirs light up and their fluid swings to and fro, against the head's turning
	 * (the canal's flap follows the head's turning speed during quick head movements).
	 *
	 * Geometry: each ring is a circle of 3.2 mm radius (the human canals' radius of curvature,
	 * Curthoys & Oman 1987) in its plane: the flat ring tipped up at the front by 25°, the two
	 * upright rings at 45° to the front, at right angles to each other.
	 */
	import { Label, TAU, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { pitch, project, roll, yaw, type V3, type View } from './view3d';

	let { t, params, reduced }: StageProps = $props();

	type Turn = 'shake' | 'nod' | 'tilt';
	const turn = $derived((params.turn as Turn | undefined) ?? 'shake');

	/** The head's swing, slowed a little: one back-and-forth in 1.6 s. */
	const PERIOD = 1.6;
	const ph = $derived(reduced ? 0.15 : cycle(t, PERIOD));
	const swing = $derived(Math.sin(TAU * ph));
	/** The head's turning speed, which the fluid's swing follows. */
	const speedNow = $derived(Math.cos(TAU * ph));

	// ---- the head ------------------------------------------------------------------------------
	const HV: View = { cx: 196, cy: 270, s: 6.2, elev: 0.12 };
	const HR = 13;
	const turnHead = (p: V3): V3 => {
		if (turn === 'shake') return yaw(p, 0.5 * swing);
		if (turn === 'nod') return pitch(p, 0.32 * swing);
		return roll(p, 0.32 * swing);
	};
	/** Points of the face, in the head's frame (units ≈ cm). */
	const H = (p: V3) => project(HV, turnHead(p));
	const head = $derived(H([0, 0, 0]));
	const eyes = $derived(
		([-1, 1] as const).map((side) => ({ side, ...H([side * 4.4, 2, HR * 0.86]) }))
	);
	const nose = $derived(H([0, -1.5, HR * 1.02]));
	const mouthL = $derived(H([-3.2, -5.6, HR * 0.84]));
	const mouthR = $derived(H([3.2, -5.6, HR * 0.84]));
	const mouthM = $derived(H([0, -6.6, HR * 0.86]));
	const ears = $derived(
		([-1, 1] as const).map((side) => ({ side, ...H([side * HR * 1.0, 0, -0.5]) }))
	);
	const hairC = $derived(H([0, HR * 0.55, -HR * 0.25]));
	const tiltDeg = $derived(turn === 'tilt' ? (0.32 * swing * 180) / Math.PI : 0);

	// The movement, as an arrow over the head.
	const moveLabel = $derived(
		turn === 'shake' ? 'shaking “no”' : turn === 'nod' ? 'nodding “yes”' : 'tilting to a shoulder'
	);

	// ---- the inner ear -------------------------------------------------------------------------
	const EV: View = { cx: 700, cy: 300, s: 30, elev: 0.38 };
	/** Looking at the ear from the side, a little from the front. */
	const SIDE = Math.PI / 2;
	const E = (p: V3) => project(EV, yaw(p, SIDE));
	const RAD = 3.2;
	const norm = (v: V3): V3 => {
		const l = Math.hypot(v[0], v[1], v[2]);
		return [v[0] / l, v[1] / l, v[2] / l];
	};
	const cross = (a: V3, b: V3): V3 => [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0]
	];
	interface Canal {
		id: 'flat' | 'front' | 'back';
		/** In-plane direction from the chamber to the ring's centre. */
		out: V3;
		/** The plane's normal. */
		n: V3;
	}
	const TIP = (25 * Math.PI) / 180;
	const CANALS: Canal[] = [
		{
			id: 'flat',
			out: [0.55, 0, -0.85],
			n: [0, Math.cos(TIP), -Math.sin(TIP)]
		},
		{ id: 'front', out: [0.45, 0.8, 0.45], n: norm([0.707, 0, -0.707]) },
		{ id: 'back', out: [0.65, -0.35, -0.65], n: norm([0.707, 0, 0.707]) }
	];
	/** The direction to the ring's centre, made to lie exactly in its plane. */
	function inPlane(c: Canal): V3 {
		const d = c.out[0] * c.n[0] + c.out[1] * c.n[1] + c.out[2] * c.n[2];
		return norm([c.out[0] - d * c.n[0], c.out[1] - d * c.n[1], c.out[2] - d * c.n[2]]);
	}
	/** The ring's points, from the chamber round and back; `u` is the angle round the ring. */
	function ringPoint(c: Canal, u: number): V3 {
		const o = inPlane(c);
		const e1: V3 = [-o[0], -o[1], -o[2]];
		const e2 = norm(cross(c.n, e1));
		return [
			RAD * o[0] + RAD * (Math.cos(u) * e1[0] + Math.sin(u) * e2[0]),
			RAD * o[1] + RAD * (Math.cos(u) * e1[1] + Math.sin(u) * e2[1]),
			RAD * o[2] + RAD * (Math.cos(u) * e1[2] + Math.sin(u) * e2[2])
		];
	}
	const SEG = 56;
	const canals = CANALS.map((c) => {
		const pts = Array.from({ length: SEG + 1 }, (_, i) => E(ringPoint(c, (i / SEG) * TAU)));
		const d =
			pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
		const o = inPlane(c);
		const centre = E([RAD * o[0], RAD * o[1], RAD * o[2]]);
		const amp = E(ringPoint(c, 0.55));
		// The label sits just beyond the ring's edge: above the front ring, below the back one,
		// right of the flat one.
		const pick = (f: (p: { x: number; y: number }) => number) =>
			pts.reduce((best, p) => (f(p) > f(best) ? p : best));
		const label =
			c.id === 'front'
				? { x: pick((p) => -p.y).x, y: pick((p) => -p.y).y - 16 }
				: c.id === 'back'
					? { x: pick((p) => p.y).x, y: pick((p) => p.y).y + 28 }
					: { x: pick((p) => p.x).x + 14, y: pick((p) => p.x).y + 5 };
		return { ...c, d, centre, amp, label, depth: centre.depth };
	}).sort((a, b) => a.depth - b.depth);
	const chamber = E([0, 0, 0]);
	const snail = E([-0.3, -3.6, 3.4]);

	/** How strongly a movement stirs each ring (the flat ring's tip makes a tilt stir it a little). */
	const STIR: Record<Turn, Record<Canal['id'], number>> = {
		shake: { flat: 1, front: 0, back: 0 },
		nod: { flat: 0, front: 1, back: 1 },
		tilt: { flat: Math.sin(TIP), front: 1, back: 1 }
	};
	const DOTS = 9;
	const dots = $derived(
		canals.flatMap((c) => {
			const k = STIR[turn][c.id];
			return Array.from({ length: DOTS }, (_, i) => {
				const u = 1.1 + (i / (DOTS - 1)) * (TAU - 1.6) - 0.28 * k * speedNow;
				const p = E(ringPoint(c, u));
				return { key: `${c.id}-${i}`, x: p.x, y: p.y, lit: k > 0.5, o: 0.35 + 0.65 * k };
			});
		})
	);

	const stirs = $derived(
		turn === 'shake'
			? 'stirs the flat ring'
			: turn === 'nod'
				? 'stirs the two upright rings'
				: 'stirs the two upright rings'
	);

	// The spiral of the cochlea, drawn flat in front of the chamber.
	const spiral = (() => {
		const pts: string[] = [];
		const n = 60;
		for (let i = 0; i <= n; i++) {
			const th = (i / n) * 2.5 * TAU;
			const r = 46 * Math.exp(-0.17 * th);
			pts.push(
				`${i ? 'L' : 'M'}${(snail.x + r * Math.cos(th + 2.6)).toFixed(1)} ${(snail.y + r * Math.sin(th + 2.6)).toFixed(1)}`
			);
		}
		return pts.join(' ');
	})();

	const zoomFrom = $derived(ears[1]);
</script>

<g class="ear-scene">
	<!-- ===== the head ===== -->
	<g>
		<path
			d="M{HV.cx - 110} 520 Q {HV.cx - 100} 420 {HV.cx - 40} 400 L {HV.cx + 40} 400 Q {HV.cx +
				100} 420 {HV.cx + 110} 520 Z"
			fill="var(--dz-shirt)"
		/>
		<rect x={HV.cx - 22} y="340" width="44" height="66" fill="var(--dz-skin)" />
		{#each ears.filter((e) => e.depth < head.depth) as e (e.side)}
			<ellipse
				cx={e.x}
				cy={e.y}
				rx="12"
				ry="20"
				fill="var(--dz-skin)"
				stroke="var(--dz-hair)"
				stroke-width="1.5"
			/>
		{/each}
		<g transform="rotate({-tiltDeg} {head.x} {head.y})">
			<circle
				cx={head.x}
				cy={head.y}
				r={HR * HV.s}
				fill="var(--dz-skin)"
				stroke="var(--dz-hair)"
				stroke-width="1.5"
			/>
			<clipPath id="ear-head">
				<circle cx={head.x} cy={head.y} r={HR * HV.s} />
			</clipPath>
			<ellipse
				cx={hairC.x}
				cy={hairC.y - 30}
				rx={HR * HV.s * 1.02}
				ry={HR * HV.s * 0.62}
				fill="var(--dz-hair)"
				clip-path="url(#ear-head)"
			/>
		</g>
		{#each eyes as e (e.side)}
			<circle cx={e.x} cy={e.y} r="6" fill="var(--dz-eye)" />
		{/each}
		<circle cx={nose.x} cy={nose.y} r="5" fill="var(--dz-hair)" opacity="0.35" />
		<path
			d="M{mouthL.x} {mouthL.y} Q {mouthM.x} {mouthM.y + 8} {mouthR.x} {mouthR.y}"
			fill="none"
			stroke="var(--dz-eye)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{#each ears.filter((e) => e.depth >= head.depth) as e (e.side)}
			<ellipse
				cx={e.x}
				cy={e.y}
				rx="12"
				ry="20"
				fill="var(--dz-skin)"
				stroke="var(--dz-hair)"
				stroke-width="1.5"
			/>
		{/each}
		<Readout id="move" order={0} label="Your head" value={moveLabel}>
			<Label x={HV.cx} y={92} text={moveLabel} size={16} weight={700} />
		</Readout>
	</g>

	<!-- the zoom from the ear -->
	<line
		x1={zoomFrom.x + 12}
		y1={zoomFrom.y}
		x2={430}
		y2={250}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="4 4"
	/>
	<circle
		cx={zoomFrom.x}
		cy={zoomFrom.y}
		r="16"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>

	<!-- ===== the inner ear ===== -->
	<g>
		<rect
			x="430"
			y="60"
			width="514"
			height="480"
			rx="14"
			fill="var(--dz-bone)"
			stroke="var(--dz-bone-edge)"
			stroke-width="1.5"
		/>
		<Label x={687} y={88} text="Inside one ear, enlarged about 30 times" size={13} muted />
		<path
			d={spiral}
			fill="none"
			stroke="var(--dz-snail)"
			stroke-width="14"
			stroke-linecap="round"
		/>
		<Label x={snail.x} y={snail.y + 78} text="cochlea, for hearing" size={12} muted />
		{#each canals as c (c.id)}
			{@const k = STIR[turn][c.id]}
			{#if k > 0.5}
				<path
					d={c.d}
					fill="none"
					stroke="var(--dz-lit)"
					stroke-width="26"
					opacity="0.35"
					filter="url(#glow)"
				/>
			{/if}
			<path d={c.d} fill="none" stroke="var(--dz-tube-edge)" stroke-width="18" />
			<path d={c.d} fill="none" stroke="var(--dz-fluid)" stroke-width="14" />
			<circle
				cx={c.amp.x}
				cy={c.amp.y}
				r="13"
				fill="var(--dz-fluid)"
				stroke="var(--dz-tube-edge)"
				stroke-width="2"
			/>
			<circle cx={c.amp.x} cy={c.amp.y} r="5" fill="var(--dz-flap-edge)" />
		{/each}
		<ellipse
			cx={chamber.x}
			cy={chamber.y}
			rx="34"
			ry="26"
			fill="var(--dz-fluid)"
			stroke="var(--dz-tube-edge)"
			stroke-width="2"
		/>
		{#each dots as d (d.key)}
			<circle cx={d.x} cy={d.y} r={d.lit ? 4.5 : 3.5} fill="var(--dz-fluid-dot)" opacity={d.o} />
		{/each}
		{#each canals as c (c.id)}
			<Label
				x={c.label.x}
				y={c.label.y}
				text={c.id === 'flat' ? 'flat ring' : 'upright ring'}
				size={13}
				weight={STIR[turn][c.id] > 0.5 ? 700 : 500}
				anchor={c.label.x > c.centre.x + 40
					? 'start'
					: c.label.x < c.centre.x - 40
						? 'end'
						: 'middle'}
			/>
		{/each}
		<Readout id="stirs" order={1} label={moveLabel} value={stirs}>
			<Label
				x={687}
				y={522}
				text="{moveLabel[0].toUpperCase()}{moveLabel.slice(1)} {stirs}"
				size={15}
				weight={700}
			/>
		</Readout>
	</g>
</g>
