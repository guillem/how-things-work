<script lang="ts">
	/**
	 * H, a phase gate P(φ), H on one qubit, drawn as paths: the circuit on top, and below it
	 * the amplitudes along the four paths from |0⟩ to the two outcomes. At each outcome the
	 * two paths' contributions are added head to tail (complex addition) and the sum's
	 * squared length is the probability. With `peek` (a measurement between the gates) the
	 * paths are told apart, so their probabilities add instead: ½ and ½ whatever φ is.
	 *
	 * Every number comes from the state-vector model: the path amplitudes are the products of
	 * the gates' matrix entries, and the outcome probabilities are those of H P(φ) H |0⟩ (or,
	 * with peek, of measuring after P(φ) and then applying H).
	 *
	 * Animation: pulses run along the paths, one wave every 4 s, their size the amplitude's
	 * length. Reduced motion: no pulses; the diagram is complete without them.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { cycle, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GATES, apply, basis, phaseGate, probabilities } from '../qubits';

	let { t, params, reduced }: StageProps = $props();

	const phiDeg = $derived(Number(params.shift ?? 0));
	const phi = $derived((phiDeg * Math.PI) / 180);
	const peek = $derived(Boolean(params.peek ?? false));
	const peekAmt = Tween.of(() => (peek ? 1 : 0), { duration: 700, easing: cubicInOut });

	// ---- the model ------------------------------------------------------------------------
	const afterP = $derived(apply(apply(basis(1), GATES.H, 0), phaseGate(phi), 0));
	const coherent = $derived(probabilities(apply(afterP, GATES.H, 0)));
	// With a measurement in the middle: 0 or 1 with the middle odds, then H on that state.
	const recorded = $derived.by(() => {
		const mid = probabilities(afterP);
		const from0 = probabilities(apply(basis(1, 0), GATES.H, 0));
		const from1 = probabilities(apply(basis(1, 1), GATES.H, 0));
		return [mid[0] * from0[0] + mid[1] * from1[0], mid[0] * from0[1] + mid[1] * from1[1]];
	});
	const P = $derived(peek ? recorded : Array.from(coherent));

	// Path amplitudes: (middle state m, final state f) → H[f][m] · amplitude of m after P(φ).
	const S2 = Math.SQRT1_2;
	const mid = $derived([
		{ re: S2, im: 0 },
		{ re: S2 * Math.cos(phi), im: S2 * Math.sin(phi) }
	]);
	const H = GATES.H;
	const contrib = (m: number, f: number) => {
		const h = H[f * 2 + m].re; // H is real
		return { re: h * mid[m].re, im: h * mid[m].im };
	};

	// ---- geometry -------------------------------------------------------------------------
	const WIRE_Y = 70;
	const X0 = 120;
	const XM = 420;
	const XF = 700;
	const ROW = [215, 425];
	const DIAL_M = 38;
	const DIAL_F = 62;

	const edges = $derived([
		{ id: 's0', x1: X0, y1: 320, x2: XM, y2: ROW[0], m: -1, f: 0, label: '× 1/√2' },
		{ id: 's1', x1: X0, y1: 320, x2: XM, y2: ROW[1], m: -1, f: 1, label: '× 1/√2' },
		{ id: '00', x1: XM, y1: ROW[0], x2: XF, y2: ROW[0], m: 0, f: 0, label: '× 1/√2' },
		{ id: '01', x1: XM, y1: ROW[0], x2: XF, y2: ROW[1], m: 0, f: 1, label: '× 1/√2' },
		{ id: '10', x1: XM, y1: ROW[1], x2: XF, y2: ROW[0], m: 1, f: 0, label: '× 1/√2' },
		{ id: '11', x1: XM, y1: ROW[1], x2: XF, y2: ROW[1], m: 1, f: 1, label: '× −1/√2' }
	]);
	const pathColor = (m: number) => (m === 1 ? 'var(--qc-one)' : 'var(--qc-zero)');

	// Pulses: one wave every 4 s; the first half crosses the first H, the second half the rest.
	const u = $derived(reduced ? -1 : cycle(t, 4));
	const pulse = (e: (typeof edges)[number]) => {
		if (u < 0) return null;
		const first = e.m === -1;
		const s = first ? u / 0.45 : (u - 0.5) / 0.45;
		if (s < 0 || s > 1) return null;
		const fade = smoothstep(0, 0.1, s) * (1 - smoothstep(0.88, 1, s));
		const r = first ? 7 * S2 : 7 * 0.5;
		return { x: e.x1 + (e.x2 - e.x1) * s, y: e.y1 + (e.y2 - e.y1) * s, r: r + 2, o: fade };
	};

	const pct = (p: number) => `${Math.round(p * 100 + 1e-9)}%`;
	const deg = (v: number) => `${Math.round(v)}°`;
</script>

{#snippet arrow(x: number, y: number, dx: number, dy: number, color: string, w: number, o = 1)}
	{#if Math.hypot(dx, dy) > 0.5}
		<line
			x1={x}
			y1={y}
			x2={x + dx}
			y2={y + dy}
			stroke={color}
			stroke-width={w}
			stroke-linecap="round"
			opacity={o}
		/>
		<circle cx={x + dx} cy={y + dy} r={w * 0.9} fill={color} opacity={o} />
	{/if}
{/snippet}

<g>
	<!-- ============ the circuit ============ -->
	<line
		x1="70"
		x2="676"
		y1={WIRE_Y}
		y2={WIRE_Y}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<Label x={56} y={WIRE_Y + 5} text="|0⟩" size={15} weight={600} anchor="end" />
	{#each [{ x: 270, g: 'H' }, { x: XM, g: 'P(φ)' }, { x: 560, g: 'H' }] as b (b.x)}
		<rect
			x={b.x - (b.g === 'H' ? 20 : 30)}
			y={WIRE_Y - 20}
			width={b.g === 'H' ? 40 : 60}
			height="40"
			rx="5"
			fill="var(--surface)"
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<text x={b.x} y={WIRE_Y + 6} text-anchor="middle" font-weight="700" font-size="16">{b.g}</text>
	{/each}
	<!-- the final measurement -->
	<rect
		x="676"
		y={WIRE_Y - 18}
		width="48"
		height="36"
		rx="5"
		fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<path
		d="M686 {WIRE_Y + 8} A 14 14 0 0 1 714 {WIRE_Y + 8}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<line
		x1="700"
		y1={WIRE_Y + 8}
		x2="710"
		y2={WIRE_Y - 9}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout id="phi" order={1} label="Phase φ on the |1⟩ path" value={deg(phiDeg)}>
		<Label x={XM} y={WIRE_Y + 38} text="φ = {deg(phiDeg)}" size={13} anchor="middle" muted />
	</Readout>
	<!-- the measurement in the middle -->
	<g opacity={peekAmt.current}>
		<rect
			x="466"
			y={WIRE_Y - 18}
			width="48"
			height="36"
			rx="5"
			fill="var(--surface)"
			stroke="var(--qc-click)"
			stroke-width="2"
		/>
		<path
			d="M476 {WIRE_Y + 8} A 14 14 0 0 1 504 {WIRE_Y + 8}"
			fill="none"
			stroke="var(--qc-click)"
			stroke-width="2"
		/>
		<line
			x1="490"
			y1={WIRE_Y + 8}
			x2="500"
			y2={WIRE_Y - 9}
			stroke="var(--qc-click)"
			stroke-width="2"
		/>
		<Readout
			id="peek-l"
			order={2}
			label="Measured in the middle"
			value="yes: 0 or 1 recorded"
			color="var(--qc-click)"
			opacity={peekAmt.current}
		>
			<Label
				x={490}
				y={WIRE_Y - 28}
				text="measured here"
				size={12}
				anchor="middle"
				color="var(--qc-click)"
			/>
		</Readout>
	</g>

	<!-- ============ the paths ============ -->
	{#each edges as e (e.id)}
		{@const c = e.m === -1 ? 'var(--stage-ink-muted)' : pathColor(e.m)}
		<line
			x1={e.x1}
			y1={e.y1}
			x2={e.x2}
			y2={e.y2}
			stroke={c}
			stroke-width="2"
			opacity={e.m === -1 ? 0.6 : 0.7}
		/>
		{@const lx =
			e.x1 + (e.x2 - e.x1) * (e.m === -1 ? 0.5 : e.f === e.m ? 0.5 : e.m === 0 ? 0.3 : 0.3)}
		{@const ly = e.y1 + (e.y2 - e.y1) * (e.m === -1 ? 0.5 : e.f === e.m ? 0.5 : 0.3)}
		<Readout id="edge-{e.id}">
			<Label
				x={lx}
				y={ly + (e.f === e.m || e.m === -1 ? (e.f === 0 ? -10 : 20) : e.m === 0 ? 22 : -12)}
				text={e.label}
				size={12}
				anchor="middle"
				weight={e.id === '11' ? 700 : 500}
				color={e.id === '11' ? 'var(--qc-neg)' : undefined}
				muted={e.id !== '11'}
			/>
		</Readout>
	{/each}

	{#each edges as e (e.id)}
		{@const p = pulse(e)}
		{#if p && p.o > 0.02}
			<circle
				cx={p.x}
				cy={p.y}
				r={p.r}
				fill={e.m === -1 ? 'var(--qc-state)' : pathColor(e.m)}
				opacity={p.o * 0.85}
			/>
		{/if}
	{/each}

	<!-- start -->
	<circle
		cx={X0}
		cy={320}
		r="22"
		fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Label x={X0} y={325} text="|0⟩" size={15} weight={600} anchor="middle" />
	<Readout id="start-l">
		<Label x={X0} y={362} text="amplitude 1" size={12} anchor="middle" muted />
	</Readout>

	<!-- middle: after H and P(φ) -->
	{#each [0, 1] as m (m)}
		{@const a = mid[m]}
		<circle
			cx={XM}
			cy={ROW[m]}
			r={DIAL_M}
			fill="var(--stage-bg)"
			stroke={pathColor(m)}
			stroke-width="1.5"
		/>
		<line x1={XM - DIAL_M} x2={XM + DIAL_M} y1={ROW[m]} y2={ROW[m]} stroke="var(--stage-grid)" />
		{@render arrow(XM, ROW[m], a.re * DIAL_M * 1.3, -a.im * DIAL_M * 1.3, pathColor(m), 3)}
		<Readout id="mid-{m}">
			<Label
				x={XM}
				y={ROW[m] + (m === 0 ? -DIAL_M - 10 : DIAL_M + 22)}
				text={m === 0 ? 'via |0⟩: 1/√2' : `via |1⟩: 1/√2 ∠ ${deg(phiDeg)}`}
				size={13}
				anchor="middle"
				weight={600}
				color={pathColor(m)}
			/>
		</Readout>
	{/each}

	<!-- final: contributions head to tail -->
	{#each [0, 1] as f (f)}
		{@const c0 = contrib(0, f)}
		{@const c1 = contrib(1, f)}
		{@const k = DIAL_F}
		{@const cy = ROW[f]}
		<circle
			cx={XF}
			{cy}
			r={DIAL_F}
			fill="var(--stage-bg)"
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
		<line x1={XF - DIAL_F} x2={XF + DIAL_F} y1={cy} y2={cy} stroke="var(--stage-grid)" />
		<line x1={XF} x2={XF} y1={cy - DIAL_F} y2={cy + DIAL_F} stroke="var(--stage-grid)" />
		<!-- coherent: head to tail, and the sum -->
		<g opacity={1 - peekAmt.current}>
			{@render arrow(
				XF,
				cy,
				(c0.re + c1.re) * k,
				-(c0.im + c1.im) * k,
				'var(--stage-ink)',
				8,
				0.22
			)}
			{@render arrow(XF, cy, c0.re * k, -c0.im * k, pathColor(0), 3)}
			{@render arrow(XF + c0.re * k, cy - c0.im * k, c1.re * k, -c1.im * k, pathColor(1), 3)}
		</g>
		<!-- recorded: the two side by side, not added -->
		<g opacity={peekAmt.current}>
			{@render arrow(XF, cy, c0.re * k, -c0.im * k, pathColor(0), 3)}
			{@render arrow(XF, cy, c1.re * k, -c1.im * k, pathColor(1), 3)}
		</g>
		<circle cx={XF} {cy} r="2.5" fill="var(--stage-ink)" />
		<Label
			x={XF}
			y={cy + (f === 0 ? -DIAL_F - 10 : DIAL_F + 22)}
			text="end at |{f}⟩"
			size={14}
			anchor="middle"
			weight={700}
			color={f === 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
		/>
	{/each}

	<!-- ============ the odds ============ -->
	{#each [0, 1] as f (f)}
		{@const cy = ROW[f]}
		<Readout
			id="p{f}"
			order={3 + f}
			label="P({f})"
			value={pct(P[f])}
			color={f === 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
		>
			<Label
				anchor="start"
				x={790}
				y={cy - 22}
				text="P({f}) = {pct(P[f])}"
				size={16}
				weight={700}
				color={f === 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
			/>
			<rect
				x={790}
				y={cy - 10}
				width="150"
				height="16"
				rx="3"
				fill="var(--stage-grid)"
				opacity="0.6"
			/>
			<rect
				x={790}
				y={cy - 10}
				width={150 * P[f]}
				height="16"
				rx="3"
				fill={f === 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
			/>
			<Label
				anchor="start"
				x={790}
				y={cy + 26}
				text={peek
					? 'probabilities add: ¼ + ¼'
					: f === 0
						? 'arrows add: cos²(φ/2)'
						: 'arrows add: sin²(φ/2)'}
				size={12}
				muted
			/>
		</Readout>
	{/each}

	<Readout
		id="foot"
		order={5}
		label="Rule"
		value={peek
			? 'paths recorded: probabilities add, 50/50 whatever φ'
			: 'paths unrecorded: amplitudes add, then square'}
	>
		<Label
			x={480}
			y={560}
			text={peek
				? 'paths recorded in the middle: their probabilities add, ½ each, whatever φ is'
				: 'coloured: the two paths, added head to tail; grey: their sum, whose squared length is the probability'}
			size={13}
			anchor="middle"
			muted
		/>
	</Readout>
</g>
