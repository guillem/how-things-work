<script lang="ts">
	/**
	 * Elliptic-curve Diffie–Hellman on y² = x³ + 7 over F₉₇ with G = (1, 28): Alice's secret a
	 * and Bob's b (`params.a`, `params.b`), their public points A = aG and B = bG, and the shared
	 * point S = aB = bA = (ab mod 79)G, worked out on both sides.
	 *
	 * The exchange plays out once over the first 3 s (public points, then the shared point); reduced
	 * motion shows it complete.
	 */
	import { clamp, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TOY, TOY_G, TOY_N, equal, multiply } from '../ecc';
	import { GRID, TOY_POINTS, gridOf, kG, pointText, toN, type NPoint } from './grid';

	let { t, params }: StageProps = $props();

	const sec = (id: string, d: number) => clamp(Math.round(Number(params[id] ?? d)), 1, TOY_N - 1);
	const a = $derived(sec('a', 29));
	const b = $derived(sec('b', 64));
	const A = $derived(kG(a) as NPoint);
	const B = $derived(kG(b) as NPoint);
	// Each side's own calculation, done separately by double-and-add on the other's point.
	const big = (q: NPoint) => ({ x: BigInt(q.x), y: BigInt(q.y) });
	const aliceS = $derived(multiply(TOY, BigInt(a), big(B)).result);
	const bobS = $derived(multiply(TOY, BigInt(b), big(A)).result);
	const agree = $derived(equal(aliceS, bobS));
	const S = $derived(toN(aliceS) as NPoint);
	const G = toN(TOY_G) as NPoint;

	const g = gridOf(97);
	const at = (q: NPoint) => g.at(q.x, q.y);
	const u = $derived({
		pub: smoothstep(0.3, 0.9, t),
		send: smoothstep(0.9, 1.6, t),
		shared: smoothstep(1.8, 2.4, t)
	});

	const marks = $derived(
		[
			{ id: 'G', q: G, color: 'var(--ecc-line)', o: 1 },
			{ id: 'A', q: A, color: 'var(--ecc-alice)', o: u.pub },
			{ id: 'B', q: B, color: 'var(--ecc-bob)', o: u.pub },
			{ id: 'S', q: S, color: 'var(--ecc-sum)', o: u.shared }
		].filter((m) => m.q)
	);
	const side = (q: NPoint) => (at(q).x > 470 ? -1 : 1);
</script>

<g>
	<rect
		x={GRID.x0}
		y={GRID.y0}
		width={GRID.size}
		height={GRID.size}
		fill="var(--surface)"
		stroke="var(--border)"
		rx="4"
	/>
	{#each [0, 48, 96] as v (v)}
		<Readout id="tx{v}">
			<Label x={g.at(v, 0).x} y={GRID.y0 + GRID.size + 18} text={String(v)} size={11} muted />
			<Label x={GRID.x0 - 8} y={g.at(0, v).y + 4} text={String(v)} size={11} anchor="end" muted />
		</Readout>
	{/each}
	<Label
		x={GRID.x0 + GRID.size}
		y={GRID.y0 + GRID.size + 36}
		text="y² ≡ x³ + 7 (mod 97)"
		size={12}
		anchor="end"
		italic
	/>
	{#each TOY_POINTS as q (q.x * 1000 + q.y)}
		{@const c = at(q)}
		<circle cx={c.x} cy={c.y} r={g.r} fill="var(--ecc-curve)" opacity="0.4" />
	{/each}
	{#each marks as m (m.id)}
		{@const c = at(m.q)}
		<g opacity={m.o}>
			<circle cx={c.x} cy={c.y} r="8" fill={m.color} stroke="var(--stage-bg)" stroke-width="2" />
			<Label
				x={c.x + 14 * side(m.q)}
				y={c.y - 10}
				text={m.id}
				weight={700}
				size={14}
				anchor={side(m.q) > 0 ? 'start' : 'end'}
				color={m.color}
			/>
		</g>
	{/each}

	<!-- Alice -->
	<g transform="translate(606 0)">
		<rect
			x="0"
			y="34"
			width="160"
			height="200"
			rx="10"
			fill="var(--surface)"
			stroke="var(--ecc-alice)"
		/>
		<Label x={80} y={58} text="Alice" weight={700} size={15} color="var(--ecc-alice)" />
		<Label x={12} y={86} text="secret a = {a}" anchor="start" tabular weight={600} />
		<Readout
			id="A"
			order={1}
			label="Alice sends A = aG"
			value={pointText(A)}
			color="var(--ecc-alice)"
		>
			<Label x={12} y={112} text="A = {a}G" anchor="start" tabular opacity={u.pub} />
			<Label
				x={12}
				y={130}
				text="= {pointText(A)}"
				anchor="start"
				tabular
				opacity={u.pub}
				color="var(--ecc-alice)"
				weight={600}
			/>
		</Readout>
		<Readout
			id="aS"
			order={3}
			label="Alice: a · B"
			value={pointText(toN(aliceS))}
			color="var(--ecc-sum)"
			opacity={u.shared}
		>
			<Label x={12} y={186} text="{a} · B" anchor="start" tabular opacity={u.shared} />
			<Label
				x={12}
				y={204}
				text="= {pointText(toN(aliceS))}"
				anchor="start"
				tabular
				weight={700}
				color="var(--ecc-sum)"
				opacity={u.shared}
			/>
		</Readout>
	</g>
	<!-- Bob -->
	<g transform="translate(784 0)">
		<rect
			x="0"
			y="34"
			width="160"
			height="200"
			rx="10"
			fill="var(--surface)"
			stroke="var(--ecc-bob)"
		/>
		<Label x={80} y={58} text="Bob" weight={700} size={15} color="var(--ecc-bob)" />
		<Label x={12} y={86} text="secret b = {b}" anchor="start" tabular weight={600} />
		<Readout id="B" order={2} label="Bob sends B = bG" value={pointText(B)} color="var(--ecc-bob)">
			<Label x={12} y={112} text="B = {b}G" anchor="start" tabular opacity={u.pub} />
			<Label
				x={12}
				y={130}
				text="= {pointText(B)}"
				anchor="start"
				tabular
				opacity={u.pub}
				color="var(--ecc-bob)"
				weight={600}
			/>
		</Readout>
		<Readout
			id="bS"
			order={4}
			label="Bob: b · A"
			value={pointText(toN(bobS))}
			color="var(--ecc-sum)"
			opacity={u.shared}
		>
			<Label x={12} y={186} text="{b} · A" anchor="start" tabular opacity={u.shared} />
			<Label
				x={12}
				y={204}
				text="= {pointText(toN(bobS))}"
				anchor="start"
				tabular
				weight={700}
				color="var(--ecc-sum)"
				opacity={u.shared}
			/>
		</Readout>
	</g>
	<!-- the swap of public points -->
	<g opacity={u.send}>
		<path
			d="M716 146 C 750 156, 800 156, 836 164"
			fill="none"
			stroke="var(--ecc-alice)"
			stroke-width="1.6"
			marker-end="url(#arrowhead)"
		/>
		<path
			d="M836 146 C 800 156, 750 156, 716 164"
			fill="none"
			stroke="var(--ecc-bob)"
			stroke-width="1.6"
			marker-end="url(#arrowhead)"
		/>
	</g>

	<Readout
		id="agree"
		order={5}
		label="Shared point"
		value={agree ? `both get ${pointText(S)} ✓` : 'mismatch'}
		opacity={u.shared}
	>
		<Label
			x={775}
			y={270}
			text={agree ? `both: S = ${(a * b) % TOY_N}G = ${pointText(S)} ✓` : 'mismatch'}
			weight={700}
			size={15}
			color="var(--ecc-ok)"
			opacity={u.shared}
		/>
		<Label
			x={775}
			y={292}
			text="because a · (bG) = b · (aG) = (ab)G"
			size={12}
			muted
			opacity={u.shared}
		/>
	</Readout>

	<!-- Eve -->
	<g transform="translate(606 330)">
		<rect
			x="0"
			y="0"
			width="338"
			height="118"
			rx="10"
			fill="var(--surface)"
			stroke="var(--ecc-eve)"
			stroke-dasharray="5 4"
		/>
		<Label x={14} y={26} text="Eve sees" weight={700} anchor="start" color="var(--ecc-eve)" />
		<Readout id="eve" order={6} label="Eve sees" value="G, A, B — and must find a or b">
			<Label
				x={14}
				y={52}
				text="G = {pointText(G)},  A = {pointText(A)},  B = {pointText(B)}"
				anchor="start"
				tabular
				size={12.5}
			/>
			<Label x={14} y={78} text="to get S she must find a or b:" anchor="start" size={12} muted />
			<Label
				x={14}
				y={98}
				text="a discrete logarithm on the curve"
				anchor="start"
				size={12}
				muted
			/>
		</Readout>
	</g>
	<Readout id="compare">
		<Label x={606} y={486} text="on the prime clock: A = gᵃ mod p" anchor="start" size={12} muted />
		<Label x={606} y={506} text="on the curve: A = a·G, a point" anchor="start" size={12} muted />
	</Readout>
</g>
