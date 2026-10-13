<script lang="ts">
	/**
	 * The machine in perspective (an oblique projection): two magnets, a coil of
	 * wire on a shaft between them, the split-ring commutator at the front end of
	 * the shaft, two brushes and a battery. The coil turns slowly (a pure
	 * function of t, an illustration only). An eye at the front shows the view
	 * the later steps use: straight along the shaft.
	 *
	 * World axes: X to the right (along the field, N → S), Y up, Z along the
	 * shaft, into the picture. Screen = (CX + X + 0.4 Z, CY − Y − 0.27 Z). Drawn
	 * back to front: the left magnet, the field, the coil, the right magnet, then
	 * the commutator, brushes and battery in front.
	 */
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const CX = 545;
	const CY = 285;
	const P = (x: number, y: number, z: number) => ({ x: CX + x + 0.4 * z, y: CY - y - 0.27 * z });
	const pts = (list: [number, number, number][]) =>
		list
			.map(([x, y, z], i) => {
				const p = P(x, y, z);
				return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
			})
			.join(' ') + ' Z';

	/** A box's visible faces (front, top, right) from x0..x1, y0..y1, z0..z1. */
	function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
		return {
			front: pts([
				[x0, y0, z0],
				[x1, y0, z0],
				[x1, y1, z0],
				[x0, y1, z0]
			]),
			top: pts([
				[x0, y1, z0],
				[x1, y1, z0],
				[x1, y1, z1],
				[x0, y1, z1]
			]),
			right: pts([
				[x1, y0, z0],
				[x1, y0, z1],
				[x1, y1, z1],
				[x1, y1, z0]
			])
		};
	}
	const MZ = 100;
	const north = box(-230, -150, -105, 105, -MZ, MZ);
	const south = box(150, 230, -105, 105, -MZ, MZ);

	const H = 95; // half the coil's width
	const L = 115; // half its length along the shaft
	const theta = $derived(Math.PI / 2 + 2 * Math.PI * cycle(reduced ? 5.4 : t, 6));
	const u = $derived({ x: -Math.sin(theta), y: Math.cos(theta) });
	const coil = $derived({
		a0: P(u.x * H, u.y * H, -L),
		a1: P(u.x * H, u.y * H, L),
		b0: P(-u.x * H, -u.y * H, -L),
		b1: P(-u.x * H, -u.y * H, L)
	});

	// The commutator: a short cylinder on the shaft in front of the coil.
	const RCOM = 24;
	const Z0 = -215; // front face
	const Z1 = -180;
	const comFront = P(0, 0, Z0);
	const comBack = P(0, 0, Z1);
	const GAP = 0.18;
	const halves = $derived(
		[
			{ id: 'a', mid: theta + Math.PI / 2, color: 'var(--mg-a)' },
			{ id: 'b', mid: theta - Math.PI / 2, color: 'var(--mg-b)' }
		].map((h) => {
			const p0 = h.mid - Math.PI / 2 + GAP;
			const p1 = h.mid + Math.PI / 2 - GAP;
			const s = P(RCOM * Math.cos(p0), RCOM * Math.sin(p0), Z0);
			const e = P(RCOM * Math.cos(p1), RCOM * Math.sin(p1), Z0);
			return {
				...h,
				d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)} A${RCOM} ${RCOM} 0 0 0 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`
			};
		})
	);
	const brushL = P(-RCOM - 12, 0, -198);
	const brushR = P(RCOM + 12, 0, -198);
	const BAT = P(0, -175, -198);
	const shaft0 = P(0, 0, -250);
	const shaft1 = P(0, 0, 190);
	const eye = P(0, 0, -400);
	const eyeTo = P(0, 0, -290);
	const fieldLines = [-70, 0, 70].flatMap((y) =>
		[-70, 70].map((z) => ({ id: `${y}:${z}`, a: P(-150, y, z), b: P(150, y, z) }))
	);
	const nLabel = P(-190, 0, -MZ);
	const sLabel = P(190, 0, -MZ);
</script>

<g>
	<!-- the north pole's magnet (behind everything) -->
	<path d={north.top} fill="var(--em-north)" opacity="0.75" />
	<path d={north.right} fill="var(--em-north)" opacity="0.6" />
	<path d={north.front} fill="var(--em-north)" />
	<text
		x={nLabel.x}
		y={nLabel.y + 8}
		text-anchor="middle"
		font-weight="800"
		style:font-size="22px"
		style:fill="#fff">N</text
	>

	<!-- the field across the gap, and the shaft -->
	{#each fieldLines as l (l.id)}
		<line
			x1={l.a.x}
			y1={l.a.y}
			x2={l.b.x}
			y2={l.b.y}
			stroke="var(--em-bfield)"
			stroke-width="1.3"
			opacity="0.5"
		/>
		<path
			d="M{(l.a.x + l.b.x) / 2 + 30} {l.a.y} l-9 -4.5 v9 z"
			fill="var(--em-bfield)"
			opacity="0.6"
		/>
	{/each}
	<line
		x1={shaft0.x}
		y1={shaft0.y}
		x2={shaft1.x}
		y2={shaft1.y}
		stroke="var(--stage-ink-muted)"
		stroke-width="7"
		stroke-linecap="round"
	/>

	<!-- the coil: a rectangle of wire turning about the shaft -->
	<path
		d="M{coil.a0.x} {coil.a0.y} L{coil.a1.x} {coil.a1.y} L{coil.b1.x} {coil.b1.y} L{coil.b0.x} {coil
			.b0.y}"
		fill="none"
		stroke="var(--em-copper)"
		stroke-width="4"
		stroke-linejoin="round"
		opacity="0.75"
	/>
	<line
		x1={coil.a0.x}
		y1={coil.a0.y}
		x2={coil.a1.x}
		y2={coil.a1.y}
		stroke="var(--mg-a)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<line
		x1={coil.b0.x}
		y1={coil.b0.y}
		x2={coil.b1.x}
		y2={coil.b1.y}
		stroke="var(--mg-b)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	<!-- the coil's two ends run along the shaft to the commutator -->
	<path
		d="M{coil.a0.x} {coil.a0.y} L{comBack.x} {comBack.y} M{coil.b0.x} {coil.b0
			.y} L{comBack.x} {comBack.y}"
		fill="none"
		stroke="var(--em-copper)"
		stroke-width="3"
	/>

	<!-- the south pole's magnet -->
	<path d={south.top} fill="var(--em-south)" opacity="0.75" />
	<path d={south.right} fill="var(--em-south)" opacity="0.6" />
	<path d={south.front} fill="var(--em-south)" />
	<text
		x={sLabel.x}
		y={sLabel.y + 8}
		text-anchor="middle"
		font-weight="800"
		style:font-size="22px"
		style:fill="#fff">S</text
	>

	<!-- commutator, brushes, leads and battery, in front -->
	<line
		x1={comFront.x}
		y1={comFront.y - RCOM}
		x2={comBack.x}
		y2={comBack.y - RCOM}
		stroke="var(--stage-ink-muted)"
	/>
	<line
		x1={comFront.x}
		y1={comFront.y + RCOM}
		x2={comBack.x}
		y2={comBack.y + RCOM}
		stroke="var(--stage-ink-muted)"
	/>
	<circle cx={comFront.x} cy={comFront.y} r={RCOM} fill="var(--surface)" />
	{#each halves as h (h.id)}
		<path d={h.d} fill="none" stroke={h.color} stroke-width="8" />
	{/each}
	<circle cx={comFront.x} cy={comFront.y} r="4" fill="var(--stage-ink-muted)" />
	<path
		d="M{brushL.x - 14} {brushL.y} H{BAT.x - 60} V{BAT.y} H{BAT.x - 8} M{brushR.x +
			14} {brushR.y} H{BAT.x + 60} V{BAT.y} H{BAT.x + 8}"
		fill="none"
		stroke="var(--em-copper)"
		stroke-width="2"
	/>
	<rect
		x={brushL.x - 14}
		y={brushL.y - 9}
		width="16"
		height="18"
		rx="3"
		fill="var(--protein)"
		stroke="var(--stage-ink-muted)"
	/>
	<rect
		x={brushR.x - 2}
		y={brushR.y - 9}
		width="16"
		height="18"
		rx="3"
		fill="var(--protein)"
		stroke="var(--stage-ink-muted)"
	/>
	<line
		x1={BAT.x - 8}
		x2={BAT.x - 8}
		y1={BAT.y - 18}
		y2={BAT.y + 18}
		stroke="var(--stage-ink)"
		stroke-width="3"
	/>
	<line
		x1={BAT.x + 8}
		x2={BAT.x + 8}
		y1={BAT.y - 10}
		y2={BAT.y + 10}
		stroke="var(--stage-ink)"
		stroke-width="6"
	/>

	<!-- the view used from now on -->
	<line
		x1={eye.x}
		y1={eye.y}
		x2={eyeTo.x}
		y2={eyeTo.y}
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-dasharray="5 4"
	/>
	<path
		d="M{eye.x - 16} {eye.y} Q{eye.x} {eye.y - 12} {eye.x + 16} {eye.y} Q{eye.x} {eye.y +
			12} {eye.x - 16} {eye.y} Z"
		fill="var(--surface)"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
	/>
	<circle cx={eye.x} cy={eye.y} r="4.5" fill="var(--stage-ink)" />

	<!-- labels -->
	<!-- <Readout>: on narrow screens the part names become numbered badges, listed under the stage -->
	<Readout
		id="north"
		order={1}
		label="magnet (north pole)"
		marker={1}
		at={[P(-190, 105, -MZ).x, P(-190, 105, -MZ).y - 19]}
	>
		<Label x={P(-190, 105, -MZ).x} y={P(-190, 105, -MZ).y - 14} text="magnet (north pole)" />
	</Readout>
	<Readout
		id="south"
		order={2}
		label="magnet (south pole)"
		marker={2}
		at={[P(190, 105, MZ).x, P(190, 105, MZ).y - 19]}
	>
		<Label x={P(190, 105, MZ).x} y={P(190, 105, MZ).y - 14} text="magnet (south pole)" />
	</Readout>
	<Readout
		id="coil"
		order={3}
		label="coil: 200 turns of wire; long sides a and b"
		marker={3}
		at={[CX - 60, CY - 155]}
	>
		<Label
			x={CX - 60}
			y={CY - 150}
			pill
			text="coil: 200 turns of wire; long sides a and b"
			color="var(--em-copper)"
			weight={600}
		/>
	</Readout>
	<Readout id="shaft" order={4} label="shaft" marker={4} at={[shaft1.x + 34, shaft1.y]}>
		<Label x={shaft1.x + 12} y={shaft1.y + 4} text="shaft" anchor="start" muted />
	</Readout>
	<Readout
		id="commutator"
		order={5}
		label="split-ring commutator"
		marker={5}
		at={[comFront.x - 56, comFront.y - 33]}
	>
		<Label
			x={comFront.x - 34}
			y={comFront.y - 28}
			text="split-ring commutator"
			pill
			anchor="end"
			weight={600}
		/>
	</Readout>
	<Readout id="brushes" order={6} label="brushes" marker={6} at={[brushR.x + 44, brushR.y]}>
		<Label x={brushR.x + 22} y={brushR.y + 4} text="brushes" anchor="start" />
	</Readout>
	<Readout id="battery" order={7} label="battery" marker={7} at={[BAT.x, BAT.y + 40]}>
		<Label x={BAT.x} y={BAT.y + 36} text="battery" />
	</Readout>
	<Readout
		id="eye"
		order={8}
		label="eye: from the next step on, we look along the shaft from here"
		marker={8}
		at={[eye.x, eye.y + 34]}
	>
		<Label
			x={eye.x}
			y={eye.y + 30}
			text="from the next step on, we look along the shaft from here"
		/>
	</Readout>
</g>
