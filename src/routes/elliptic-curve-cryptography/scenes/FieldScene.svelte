<script lang="ts">
	/**
	 * y² = x³ + 7 over F_p: the points as a scatter on the p × p grid.
	 *
	 * Phases (`step.hints.phase`):
	 *   scatter — the points for the chosen p (`params.prime`), the mirror line y = p/2, and the
	 *             count against Hasse's band p + 1 ± 2√p
	 *   add     — on F₉₇, P and Q (`params.pi`, `params.qi`, indices into the sorted points, or
	 *             dragged), the "line" through them (its 97 grid points, swept in from x = 0),
	 *             the third point R and P + Q, its mirror
	 *
	 * The sweep is a function of t; reduced motion shows it complete.
	 */
	import { clamp, Handle, Label, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FIELDS, TOY, add, count, hasse, linePoints, neg, points } from '../ecc';
	import { GRID, TOY_POINTS, gridOf, nearestPoint, pointText, toN } from './grid';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'scatter'));
	const p = $derived(
		phase === 'add' ? 97 : FIELDS.includes(Number(params.prime)) ? Number(params.prime) : 97
	);
	const curve = $derived({ p: BigInt(p), a: 0n, b: 7n });
	const pts = $derived(
		phase === 'add' ? TOY_POINTS : points(curve).map((q) => ({ x: Number(q.x), y: Number(q.y) }))
	);
	const N = $derived(count(curve));
	const band = $derived(hasse(p));
	const g = $derived(gridOf(p));
	const ticks = $derived([0, Math.round((p - 1) / 2), p - 1]);

	// ---- the addition ------------------------------------------------------------------------
	const M = TOY_POINTS.length; // 78
	const idx = (id: string, fallback: number) =>
		clamp(Math.round(Number(params[id] ?? fallback)), 1, M) - 1;
	const iP = $derived(idx('pi', 1));
	const iQ = $derived(idx('qi', 38));
	const P = $derived(TOY_POINTS[iP]);
	const Q = $derived(TOY_POINTS[iQ]);
	const big = (q: { x: number; y: number }) => ({ x: BigInt(q.x), y: BigInt(q.y) });
	const line = $derived(linePoints(TOY, big(P), big(Q)));
	const sumB = $derived(add(TOY, big(P), big(Q)));
	const S = $derived(toN(sumB));
	const R = $derived(toN(neg(TOY, sumB)));
	const lineText = $derived(
		line.slope === null
			? `x = ${P.x} (vertical)`
			: `y ≡ ${line.slope}x + ${line.intercept ?? 0}  (mod 97)`
	);
	// The line's meetings with the curve: P, Q and R counted with multiplicity (a tangent touches
	// twice), and O as the third for a vertical line.
	const lineNote = $derived.by(() => {
		if (S === null) return '97 grid points; meets the curve at P, Q and O';
		const same = (a: { x: number; y: number }, b: { x: number; y: number } | null) =>
			b !== null && a.x === b.x && a.y === b.y;
		if (iP === iQ) return '97 grid points; tangent at P (twice), then R';
		if (same(P, R)) return '97 grid points; tangent at P: R = P';
		if (same(Q, R)) return '97 grid points; tangent at Q: R = Q';
		return '97 grid points; 3 on the curve: P, Q and R';
	});
	const caseText = $derived(
		iP === iQ
			? S === null
				? 'P on the mirror line'
				: 'Q = P: the tangent'
			: S === null
				? 'Q = −P: a vertical line'
				: ''
	);

	const u = $derived({
		sweep: smoothstep(0.2, 1.4, t),
		third: smoothstep(1.4, 1.8, t),
		mirror: smoothstep(1.8, 2.2, t),
		sum: smoothstep(2.0, 2.3, t)
	});
	const onCurve = $derived(new Set(pts.map((q) => q.x * 1000 + q.y)));

	const keyed = (id: string, i: number) => (k: number | 'start' | 'end') =>
		setParam(id, k === 'start' ? 1 : k === 'end' ? M : ((i + k + 10 * M) % M) + 1);

	const at = (q: { x: number; y: number }) => g.at(q.x, q.y);
	const tag = (q: { x: number; y: number }, dx = 12) => {
		const c = at(q);
		const right = c.x < GRID.x0 + GRID.size - 60;
		return {
			x: c.x + (right ? dx : -dx),
			y: clamp(c.y - 9, GRID.y0 + 12, GRID.y0 + GRID.size - 4),
			anchor: right ? ('start' as const) : ('end' as const)
		};
	};

	// Hasse bar geometry (right panel)
	const HB = { x0: 630, x1: 930, y: 300 };
	const hx = $derived(
		(v: number) => HB.x0 + ((v - band.lo) / (band.hi - band.lo)) * (HB.x1 - HB.x0)
	);
</script>

<g>
	<!-- grid frame -->
	<rect
		x={GRID.x0}
		y={GRID.y0}
		width={GRID.size}
		height={GRID.size}
		fill="var(--surface)"
		stroke="var(--border)"
		rx="4"
	/>
	{#if p <= 43}
		{#each Array.from({ length: p + 1 }, (_, i) => i) as i (i)}
			<line
				x1={GRID.x0 + i * g.cell}
				x2={GRID.x0 + i * g.cell}
				y1={GRID.y0}
				y2={GRID.y0 + GRID.size}
				stroke="var(--stage-grid)"
			/>
			<line
				y1={GRID.y0 + i * g.cell}
				y2={GRID.y0 + i * g.cell}
				x1={GRID.x0}
				x2={GRID.x0 + GRID.size}
				stroke="var(--stage-grid)"
			/>
		{/each}
	{/if}
	{#each ticks as v (v)}
		<Readout id="tx{v}">
			<Label x={g.at(v, 0).x} y={GRID.y0 + GRID.size + 18} text={String(v)} size={11} muted />
			<Label x={GRID.x0 - 8} y={g.at(0, v).y + 4} text={String(v)} size={11} anchor="end" muted />
		</Readout>
	{/each}
	<Label
		x={GRID.x0 + GRID.size}
		y={GRID.y0 + GRID.size + 36}
		text="x (mod {p})"
		size={12}
		anchor="end"
		italic
	/>
	<Label x={GRID.x0 - 8} y={GRID.y0 - 12} text="y" size={12} anchor="end" italic />

	<!-- mirror line y = p/2 -->
	<line
		x1={GRID.x0}
		x2={GRID.x0 + GRID.size}
		y1={g.at(0, p / 2).y}
		y2={g.at(0, p / 2).y}
		stroke="var(--ecc-curve)"
		stroke-dasharray="5 5"
		opacity="0.55"
	/>

	{#if phase === 'add'}
		<!-- the line's 97 grid points, swept in from x = 0 -->
		{#each line.pts as q, i (i)}
			{@const c = at(q)}
			{@const shown = smoothstep(i / 97 - 0.02, i / 97 + 0.02, u.sweep)}
			{#if shown > 0 && !onCurve.has(q.x * 1000 + q.y)}
				<rect
					x={c.x - 1.6}
					y={c.y - 1.6}
					width="3.2"
					height="3.2"
					fill="var(--ecc-line)"
					opacity={0.8 * shown}
				/>
			{/if}
		{/each}
	{/if}

	<!-- the curve's points -->
	{#each pts as q (q.x * 1000 + q.y)}
		{@const c = at(q)}
		<circle
			cx={c.x}
			cy={c.y}
			r={g.r}
			fill="var(--ecc-curve)"
			opacity={phase === 'add' ? 0.75 : 0.9}
		/>
	{/each}

	{#if phase === 'add'}
		{#if R && S}
			{@const cr = at(R)}
			{@const cs = at(S)}
			<line
				x1={cr.x}
				x2={cr.x}
				y1={cr.y}
				y2={cr.y + (cs.y - cr.y) * u.mirror}
				stroke="var(--ecc-sum)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity={u.mirror > 0 ? 0.9 : 0}
			/>
			<circle
				cx={cr.x}
				cy={cr.y}
				r="7"
				fill="var(--stage-bg)"
				stroke="var(--ecc-r)"
				stroke-width="2.5"
				opacity={u.third}
			/>
			<Label {...tag(R)} text="R" color="var(--ecc-r)" weight={700} opacity={u.third} />
			<circle
				cx={cs.x}
				cy={cs.y}
				r="7.5"
				fill="var(--ecc-sum)"
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={u.sum}
			/>
			<Label {...tag(S)} text="P + Q" color="var(--ecc-sum)" weight={700} opacity={u.sum} />
		{/if}
		<Handle
			x={at(Q).x}
			y={at(Q).y}
			r={7}
			label="Point Q on the curve mod 97"
			value={iQ + 1}
			min={1}
			max={M}
			valuetext="Q = {pointText(Q)}"
			color="var(--ecc-q)"
			onmove={(s: Point) => setParam('qi', nearestPoint(TOY_POINTS, g, s) + 1)}
			onkey={keyed('qi', iQ)}
		/>
		{#if iP !== iQ}
			<Label {...tag(Q, 15)} text="Q" color="var(--ecc-q)" weight={700} />
		{/if}
		<Handle
			x={at(P).x}
			y={at(P).y}
			r={7}
			label="Point P on the curve mod 97"
			value={iP + 1}
			min={1}
			max={M}
			valuetext="P = {pointText(P)}"
			color="var(--ecc-p)"
			onmove={(s: Point) => setParam('pi', nearestPoint(TOY_POINTS, g, s) + 1)}
			onkey={keyed('pi', iP)}
		/>
		<Label {...tag(P, 15)} text={iP === iQ ? 'P = Q' : 'P'} color="var(--ecc-p)" weight={700} />
	{/if}

	<!-- right panel -->
	<Readout id="eq" order={0} label="Curve" value="y² = x³ + 7 (mod {p})">
		<Label
			x={624}
			y={60}
			text="y² ≡ x³ + 7  (mod {p})"
			size={19}
			weight={700}
			anchor="start"
			color="var(--ecc-curve)"
		/>
		<Label
			x={624}
			y={82}
			text="whole numbers 0 … {p - 1}, arithmetic on a {p}-hour clock"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
	{#if phase === 'scatter'}
		<Readout id="count" order={1} label="Points" value="{N - 1} + O = {N}">
			<Label
				x={624}
				y={140}
				text="{N - 1} dots + O = {N} points"
				size={16}
				weight={700}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="mirror" order={2} label="Mirror" value="y and {p} − y are twins">
			<Label
				x={624}
				y={166}
				text="dashed: the mirror line, y ↔ {p} − y"
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
		<Readout
			id="hasse"
			order={3}
			label="Hasse band"
			value="{band.lo.toFixed(1)} … {band.hi.toFixed(1)}"
		>
			<Label x={624} y={262} text="Hasse: p + 1 ± 2√p" size={13} weight={600} anchor="start" />
			<rect
				x={HB.x0}
				y={HB.y - 8}
				width={HB.x1 - HB.x0}
				height="16"
				rx="8"
				fill="var(--ecc-curve)"
				opacity="0.18"
			/>
			<line
				x1={hx(p + 1)}
				x2={hx(p + 1)}
				y1={HB.y - 12}
				y2={HB.y + 12}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 3"
			/>
			<circle cx={hx(N)} cy={HB.y} r="7" fill="var(--ecc-curve)" />
			<Label
				x={HB.x0}
				y={HB.y + 30}
				text={band.lo.toFixed(1)}
				size={11}
				anchor="start"
				muted
				tabular
			/>
			<Label x={hx(p + 1)} y={HB.y + 30} text="p + 1 = {p + 1}" size={11} muted tabular />
			<Label
				x={HB.x1}
				y={HB.y + 30}
				text={band.hi.toFixed(1)}
				size={11}
				anchor="end"
				muted
				tabular
			/>
			<Label
				x={hx(N)}
				y={HB.y - 18}
				text="N = {N}"
				size={12}
				weight={700}
				color="var(--ecc-curve)"
				tabular
			/>
		</Readout>
		<Readout id="nocurve">
			<Label
				x={624}
				y={420}
				text="no curve to see: this is where"
				size={13}
				anchor="start"
				weight={600}
			/>
			<Label x={624} y={440} text="the cryptography lives" size={13} anchor="start" weight={600} />
		</Readout>
	{:else}
		<Readout id="p" order={1} label="P" value={pointText(P)} color="var(--ecc-p)">
			<Label
				x={624}
				y={136}
				text="P = {pointText(P)}"
				size={14}
				weight={600}
				anchor="start"
				tabular
				color="var(--ecc-p)"
			/>
		</Readout>
		<Readout id="q" order={2} label="Q" value={pointText(Q)} color="var(--ecc-q)">
			<Label
				x={624}
				y={160}
				text="Q = {pointText(Q)}"
				size={14}
				weight={600}
				anchor="start"
				tabular
				color="var(--ecc-q)"
			/>
		</Readout>
		<Readout id="line" order={3} label="Line" value={lineText} opacity={u.sweep}>
			<Label
				x={624}
				y={196}
				text="line: {lineText}"
				size={12.5}
				anchor="start"
				tabular
				opacity={u.sweep}
			/>
			<Label x={624} y={216} text={lineNote} size={12} anchor="start" muted opacity={u.sweep} />
		</Readout>
		{#if S === null}
			<Readout id="sum" order={4} label="P + Q" value="O" color="var(--ecc-sum)" opacity={u.sum}>
				<Label
					x={624}
					y={256}
					text="P + Q = O"
					size={16}
					weight={700}
					anchor="start"
					color="var(--ecc-sum)"
					opacity={u.sum}
				/>
			</Readout>
		{:else}
			<Readout id="r" order={4} label="R" value={pointText(R)} opacity={u.third}>
				<Label
					x={624}
					y={252}
					text="R = {pointText(R)}"
					size={14}
					anchor="start"
					tabular
					color="var(--ecc-r)"
					opacity={u.third}
				/>
			</Readout>
			<Readout
				id="sum"
				order={5}
				label="P + Q"
				value={pointText(S)}
				color="var(--ecc-sum)"
				opacity={u.sum}
			>
				<Label
					x={624}
					y={280}
					text="P + Q = {pointText(S)}"
					size={16}
					weight={700}
					anchor="start"
					tabular
					color="var(--ecc-sum)"
					opacity={u.sum}
				/>
			</Readout>
		{/if}
		{#if caseText}
			<Readout id="case" order={6} label="Case" value={caseText}>
				<Label x={624} y={308} text={caseText} size={12} anchor="start" muted />
			</Readout>
		{/if}
		<Readout id="hint">
			<Label x={624} y={540} text="drag P and Q to any dots" size={12} anchor="start" muted />
		</Readout>
	{/if}
</g>
