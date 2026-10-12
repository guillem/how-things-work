<script lang="ts">
	/**
	 * The coil's connection to the outside, enlarged: a split-ring commutator
	 * seen along the shaft (the same view as the coil), or two slip rings seen
	 * from the side, with their brushes and the two leads, which end at
	 * (x − 80, leadY) and (x + 80, leadY).
	 *
	 * Commutator: half "a" is joined to side a and centred on the direction of
	 * side a from the shaft (θ + 90°); the gaps lie along the coil's normal, so
	 * they reach the brushes (left and right) exactly when the coil stands
	 * across the field. Slip rings: ring a on the left, ring b on the right, each
	 * with a mark where the coil's wire joins it, turning with the coil.
	 */
	interface Props {
		x: number;
		y: number;
		/** Coil angle (rad), as in the model. */
		theta: number;
		kind: 'commutator' | 'slip';
		leadY: number;
		/** Current in the leads (A): positive flows in at the left brush. */
		flow?: number;
		opacity?: number;
	}
	let { x, y, theta, kind, leadY, flow = 0, opacity = 1 }: Props = $props();

	const R = 42;
	const GAP = (10 * Math.PI) / 180;
	const pt = (r: number, phi: number) => ({ x: x + r * Math.cos(phi), y: y - r * Math.sin(phi) });
	/** Arc of radius r from angle p0 to p1 (math angles, anticlockwise). */
	function arc(r: number, p0: number, p1: number) {
		const a = pt(r, p0);
		const b = pt(r, p1);
		const large = p1 - p0 > Math.PI ? 1 : 0;
		return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 ${large} 0 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
	}
	const halves = $derived.by(() => {
		const pa = theta + Math.PI / 2;
		return [
			{ id: 'a', mid: pa, color: 'var(--mg-a)' },
			{ id: 'b', mid: pa + Math.PI, color: 'var(--mg-b)' }
		].map((h) => ({
			...h,
			d: arc(R, h.mid - Math.PI / 2 + GAP, h.mid + Math.PI / 2 - GAP),
			label: pt(R - 22, h.mid)
		}));
	});

	const RING = { dx: 30, ry: 40, rx: 9 };
	/** Where the coil's wire joins each slip ring: on the near face while cos φ < 0. */
	const marks = $derived(
		[
			{ id: 'a', cx: x - RING.dx, phi: theta + Math.PI / 2, color: 'var(--mg-a)' },
			{ id: 'b', cx: x + RING.dx, phi: theta - Math.PI / 2, color: 'var(--mg-b)' }
		].map((m) => ({
			...m,
			y: y - RING.ry * Math.sin(m.phi),
			front: Math.cos(m.phi) < 0
		}))
	);

	const leads = $derived(
		kind === 'commutator'
			? [`M${x - R - 30} ${y} H${x - 80} V${leadY}`, `M${x + R + 30} ${y} H${x + 80} V${leadY}`]
			: [
					`M${x - RING.dx} ${y + RING.ry + 30} V${y + RING.ry + 46} H${x - 80} V${leadY}`,
					`M${x + RING.dx} ${y + RING.ry + 30} V${y + RING.ry + 46} H${x + 80} V${leadY}`
				]
	);
	// Arrows on the leads: up the left lead to its brush, and down the right one, for a positive flow.
	const showFlow = $derived(Math.abs(flow) > 0.02);
	const flowOpacity = $derived(Math.min(1, 0.35 + Math.abs(flow)));
	const chevron = (cx: number, cy: number, down: boolean) =>
		down
			? `M${cx - 6} ${cy - 4} L${cx} ${cy + 3} L${cx + 6} ${cy - 4}`
			: `M${cx - 6} ${cy + 4} L${cx} ${cy - 3} L${cx + 6} ${cy + 4}`;
	const midLead = $derived((kind === 'commutator' ? y : y + RING.ry + 46) / 2 + leadY / 2);
</script>

<g {opacity}>
	{#each leads as d (d)}
		<path {d} fill="none" stroke="var(--em-copper)" stroke-width="2" />
	{/each}
	{#if showFlow}
		<g opacity={flowOpacity}>
			<path
				d={chevron(x - 80, midLead, flow < 0)}
				fill="none"
				stroke="var(--em-current)"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
			<path
				d={chevron(x + 80, midLead, flow > 0)}
				fill="none"
				stroke="var(--em-current)"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		</g>
	{/if}

	{#if kind === 'commutator'}
		<circle cx={x} cy={y} r={R + 8} fill="var(--surface)" stroke="var(--border)" />
		{#each halves as h (h.id)}
			<path d={h.d} fill="none" stroke={h.color} stroke-width="12" stroke-linecap="butt" />
			<text
				x={h.label.x}
				y={h.label.y + 4}
				text-anchor="middle"
				font-weight="700"
				style:font-size="12px"
				style:fill={h.color}>{h.id}</text
			>
		{/each}
		<circle cx={x} cy={y} r="7" fill="var(--stage-ink-muted)" />
		<!-- brushes, pressed against the ring from the left and the right -->
		<rect
			x={x - R - 30}
			y={y - 13}
			width="24"
			height="26"
			rx="3"
			fill="var(--protein)"
			stroke="var(--stage-ink-muted)"
		/>
		<rect
			x={x + R + 6}
			y={y - 13}
			width="24"
			height="26"
			rx="3"
			fill="var(--protein)"
			stroke="var(--stage-ink-muted)"
		/>
	{:else}
		<line
			x1={x - 78}
			x2={x + 62}
			y1={y}
			y2={y}
			stroke="var(--stage-ink-muted)"
			stroke-width="8"
			stroke-linecap="round"
			opacity="0.6"
		/>
		{#each marks as m (m.id)}
			<ellipse
				cx={m.cx}
				cy={y}
				rx={RING.rx}
				ry={RING.ry}
				fill="var(--surface)"
				stroke={m.color}
				stroke-width="6"
			/>
			{#if m.front}
				<circle cx={m.cx - RING.rx * 0.4} cy={m.y} r="4" fill={m.color} />
			{/if}
			<text
				x={m.cx}
				y={y - RING.ry - 10}
				text-anchor="middle"
				font-weight="700"
				style:font-size="12px"
				style:fill={m.color}>{m.id}</text
			>
			<rect
				x={m.cx - 10}
				y={y + RING.ry + 4}
				width="20"
				height="26"
				rx="3"
				fill="var(--protein)"
				stroke="var(--stage-ink-muted)"
			/>
		{/each}
	{/if}
</g>
