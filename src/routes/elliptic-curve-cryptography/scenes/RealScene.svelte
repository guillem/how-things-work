<script lang="ts">
	/**
	 * y² = x³ + 7 over the real numbers, with draggable points.
	 *
	 * Phases (`step.hints.phase`):
	 *   curve    — P and its mirror twin −P
	 *   chord    — P and Q, the line through them, the third point R and P + Q (its mirror)
	 *   tangent  — the tangent at P, its third point and 2P
	 *   infinity — P and −P, the vertical line through them, and P + (−P) = O
	 *
	 * Points live in `params.py` / `params.qy` (their heights y; every height has exactly one
	 * point), shared with the sliders; the handles snap the pointer to the nearest point of the
	 * curve. The construction draws itself in over the first two seconds of a step (a function of
	 * t); reduced motion (t = 2.5) shows it complete.
	 */
	import { clamp, Handle, Label, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { REAL_ROOT, realAdd, realPoint, type RPoint } from '../ecc';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'curve'));

	// ---- geometry: math window x ∈ [−3, 6.5], y ∈ [−16, 16] -----------------------------
	const BOX = { x0: 40, x1: 600, y0: 28, y1: 572 };
	const X = [-3, 6.5] as const;
	const Y = [-16, 16] as const;
	const sx = (x: number) => BOX.x0 + ((x - X[0]) / (X[1] - X[0])) * (BOX.x1 - BOX.x0);
	const sy = (y: number) => BOX.y1 - ((y - Y[0]) / (Y[1] - Y[0])) * (BOX.y1 - BOX.y0);
	const inView = (p: RPoint) => p.x >= X[0] && p.x <= X[1] && p.y >= Y[0] && p.y <= Y[1];

	const curvePath = (() => {
		const pts: string[] = [];
		for (let i = 0; i <= 240; i++) {
			const y = -20 + (40 * i) / 240;
			const p = realPoint(y);
			pts.push(`${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`);
		}
		return pts.join(' ');
	})();

	// ---- the points -----------------------------------------------------------------------
	const H = 12;
	const height = (id: string, fallback: number) =>
		clamp(Math.round(Number(params[id] ?? fallback) * 10) / 10, -H, H);
	const pY = $derived(height('py', -2.5));
	const qY = $derived(height('qy', 3.5));
	const P = $derived(realPoint(pY));
	const Q = $derived(phase === 'chord' ? realPoint(qY) : phase === 'tangent' ? P : realPoint(-pY));
	const sum = $derived(realAdd(P, Q));
	const twin = $derived(realPoint(-pY));

	// ---- construction, drawn in over time ----------------------------------------------------
	const u = $derived({
		line: smoothstep(0.2, 1.0, t),
		third: smoothstep(1.0, 1.4, t),
		mirror: smoothstep(1.4, 2.0, t),
		sum: smoothstep(1.8, 2.2, t)
	});
	const showLine = $derived(phase !== 'curve');

	/** The drawn line: through P with the sum's slope, or the vertical through P. */
	const line = $derived.by(() => {
		if (sum.kind === 'vertical') return { x1: sx(P.x), y1: BOX.y1, x2: sx(P.x), y2: BOX.y0 };
		const at = (x: number) => P.y + sum.slope * (x - P.x);
		return { x1: sx(X[0]), y1: sy(at(X[0])), x2: sx(X[1]), y2: sy(at(X[1])) };
	});
	// The line grows out from P in both directions.
	const grown = $derived.by(() => {
		const cx = sx(P.x);
		const cy = sy(P.y);
		const f = u.line;
		return {
			x1: cx + (line.x1 - cx) * f,
			y1: cy + (line.y1 - cy) * f,
			x2: cx + (line.x2 - cx) * f,
			y2: cy + (line.y2 - cy) * f
		};
	});

	// ---- dragging -------------------------------------------------------------------------
	function nearestHeight(p: Point) {
		let best = 0;
		let bestD = Infinity;
		for (let y = -H; y <= H + 1e-9; y += 0.05) {
			const c = realPoint(y);
			const d = (sx(c.x) - p.x) ** 2 + (sy(c.y) - p.y) ** 2;
			if (d < bestD) [best, bestD] = [y, d];
		}
		return Math.round(best * 10) / 10;
	}
	const keyed = (id: string, value: number) => (k: number | 'start' | 'end') =>
		setParam(
			id,
			k === 'start' ? -H : k === 'end' ? H : clamp(Math.round((value + k * 0.1) * 10) / 10, -H, H)
		);

	// ---- text -------------------------------------------------------------------------------
	const n1 = (v: number) => (Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)).replace('-', '−');
	const coords = (p: RPoint) => `(${n1(p.x)}, ${n1(p.y)})`;
	const sumName = $derived(
		phase === 'tangent' ? '2P' : phase === 'infinity' ? 'P + (−P)' : 'P + Q'
	);
	const txt = $derived(
		sum.kind === 'vertical'
			? { slope: '', r: '', sum: 'O' }
			: { slope: n1(sum.slope), r: coords(sum.third), sum: coords(sum.sum) }
	);
	const offPicture = $derived(sum.kind !== 'vertical' && !inView(sum.third));
	const caption = $derived.by(() => {
		if (phase === 'curve') return ['every point P has a mirror twin −P', '(only y² appears)'];
		if (sum.kind === 'vertical')
			return phase === 'infinity'
				? ['the vertical line meets the curve', 'only at P and −P']
				: phase === 'tangent'
					? ['the tangent is vertical:', '2P = O']
					: ['Q = −P:', 'the line is vertical'];
		if (phase === 'chord' && sum.kind === 'tangent')
			return ['Q = P:', 'the chord becomes the tangent'];
		return phase === 'tangent'
			? ['the tangent at P meets', 'the curve once more, at R']
			: ['the line through P and Q meets', 'the curve once more, at R'];
	});

	const label = (p: RPoint, text: string, color: string, side: 1 | -1 = 1) => ({
		x: clamp(sx(p.x) + 14 * side, 24, BOX.x1 - 8),
		y: clamp(sy(p.y) - 10, BOX.y0 + 12, BOX.y1 - 6),
		text,
		color,
		anchor: side > 0 ? ('start' as const) : ('end' as const)
	});
</script>

<g>
	<defs>
		<clipPath id="ecc-real-clip">
			<rect x={BOX.x0} y={BOX.y0} width={BOX.x1 - BOX.x0} height={BOX.y1 - BOX.y0} />
		</clipPath>
	</defs>

	<!-- axes and grid -->
	{#each [-2, 0, 2, 4, 6] as x (x)}
		<line x1={sx(x)} x2={sx(x)} y1={BOX.y0} y2={BOX.y1} stroke="var(--stage-grid)" />
		<Readout id="xt{x}">
			<Label
				x={sx(x) + (x === 0 ? -8 : 0)}
				y={sy(0) + 16}
				text={String(x).replace('-', '−')}
				size={11}
				muted
			/>
		</Readout>
	{/each}
	{#each [-15, -10, -5, 5, 10, 15] as y (y)}
		<line x1={BOX.x0} x2={BOX.x1} y1={sy(y)} y2={sy(y)} stroke="var(--stage-grid)" />
		<Readout id="yt{y}">
			<Label
				x={sx(0) - 6}
				y={sy(y) + 4}
				text={String(y).replace('-', '−')}
				size={11}
				anchor="end"
				muted
			/>
		</Readout>
	{/each}
	<line
		x1={BOX.x0}
		x2={BOX.x1}
		y1={sy(0)}
		y2={sy(0)}
		stroke="var(--stage-line)"
		stroke-width="1.2"
	/>
	<line
		x1={sx(0)}
		x2={sx(0)}
		y1={BOX.y0}
		y2={BOX.y1}
		stroke="var(--stage-line)"
		stroke-width="1.2"
	/>
	<Label x={BOX.x1 - 4} y={sy(0) - 8} text="x" size={13} italic anchor="end" />
	<Label x={sx(0) + 10} y={BOX.y0 + 12} text="y" size={13} italic anchor="start" />

	<g clip-path="url(#ecc-real-clip)">
		<path
			d={curvePath}
			fill="none"
			stroke="var(--ecc-curve)"
			stroke-width="3"
			stroke-linecap="round"
		/>

		{#if showLine}
			<line {...grown} stroke="var(--ecc-line)" stroke-width="1.6" opacity={0.85} />
		{/if}

		{#if phase === 'curve'}
			<line
				x1={sx(P.x)}
				x2={sx(P.x)}
				y1={sy(P.y)}
				y2={sy(twin.y)}
				stroke="var(--ecc-p)"
				stroke-width="1.2"
				stroke-dasharray="4 4"
				opacity="0.7"
			/>
		{/if}

		{#if sum.kind !== 'vertical' && phase !== 'curve'}
			{@const R = sum.third}
			{@const S = sum.sum}
			<line
				x1={sx(R.x)}
				x2={sx(R.x)}
				y1={sy(R.y)}
				y2={sy(R.y) + (sy(S.y) - sy(R.y)) * u.mirror}
				stroke="var(--ecc-sum)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				opacity={u.mirror > 0 ? 0.9 : 0}
			/>
			<circle
				cx={sx(R.x)}
				cy={sy(R.y)}
				r="7"
				fill="var(--stage-bg)"
				stroke="var(--ecc-r)"
				stroke-width="2.5"
				opacity={u.third}
			/>
			<circle
				cx={sx(S.x)}
				cy={sy(S.y)}
				r="8"
				fill="var(--ecc-sum)"
				stroke="var(--stage-bg)"
				stroke-width="2"
				opacity={u.sum}
			/>
		{/if}
	</g>

	<!-- the arrow up to O on a vertical line -->
	{#if sum.kind === 'vertical' && phase !== 'curve'}
		<path d="M{sx(P.x)} {BOX.y0 + 22} l-7 12 h14 z" fill="var(--ecc-sum)" opacity={u.sum} />
		<Label
			x={sx(P.x) + (sx(P.x) > 400 ? -14 : 14)}
			y={BOX.y0 + 34}
			text="to O, the point at infinity"
			color="var(--ecc-sum)"
			weight={700}
			anchor={sx(P.x) > 400 ? 'end' : 'start'}
			opacity={u.sum}
		/>
	{/if}

	<!-- labels of R and the sum -->
	{#if sum.kind !== 'vertical' && phase !== 'curve'}
		{#if inView(sum.third)}
			{@const l = label(sum.third, 'R', 'var(--ecc-r)', sum.third.x > 5 ? -1 : 1)}
			<Label {...l} weight={700} opacity={u.third} />
		{/if}
		{#if inView(sum.sum)}
			{@const l = label(sum.sum, sumName, 'var(--ecc-sum)', sum.sum.x > 4.5 ? -1 : 1)}
			<Label {...l} weight={700} opacity={u.sum} />
		{/if}
	{/if}

	<!-- the mirror twin −P (curve and infinity phases) -->
	{#if phase === 'curve' || phase === 'infinity'}
		<circle
			cx={sx(twin.x)}
			cy={sy(twin.y)}
			r="8"
			fill="var(--stage-bg)"
			stroke="var(--ecc-p)"
			stroke-width="2.5"
		/>
		<Label {...label(twin, '−P', 'var(--ecc-p)', -1)} weight={700} />
	{/if}

	<!-- handles -->
	{#if phase === 'chord'}
		<Handle
			x={sx(Q.x)}
			y={sy(Q.y)}
			label="Point Q on the curve"
			value={qY}
			min={-H}
			max={H}
			valuetext="Q = {coords(Q)}"
			color="var(--ecc-q)"
			onmove={(p: Point) => setParam('qy', nearestHeight(p))}
			onkey={keyed('qy', qY)}
		/>
		<Label {...label(Q, 'Q', 'var(--ecc-q)', Q.x > 5 ? -1 : 1)} weight={700} />
	{/if}
	<Handle
		x={sx(P.x)}
		y={sy(P.y)}
		label="Point P on the curve"
		value={pY}
		min={-H}
		max={H}
		valuetext="P = {coords(P)}"
		color="var(--ecc-p)"
		onmove={(p: Point) => setParam('py', nearestHeight(p))}
		onkey={keyed('py', pY)}
	/>
	<Label {...label(P, 'P', 'var(--ecc-p)', P.x > 5 ? -1 : 1)} weight={700} />

	<!-- readouts -->
	<g transform="translate(624 0)">
		<Readout id="eq" order={0} label="Curve" value="y² = x³ + 7 over the reals">
			<Label
				x={0}
				y={52}
				text="y² = x³ + 7"
				size={20}
				weight={700}
				anchor="start"
				color="var(--ecc-curve)"
			/>
			<Label
				x={0}
				y={74}
				text="over the real numbers (for intuition only)"
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
		<Readout id="cap" order={1} label="Rule" value={caption.join(' ')}>
			<Label x={0} y={104} text={caption[0]} size={12.5} anchor="start" weight={600} />
			<Label x={0} y={122} text={caption[1]} size={12.5} anchor="start" weight={600} />
		</Readout>
		<Readout id="p" order={2} label="P" value={coords(P)} color="var(--ecc-p)">
			<Label
				x={0}
				y={152}
				text="P = {coords(P)}"
				size={14}
				anchor="start"
				tabular
				color="var(--ecc-p)"
				weight={600}
			/>
		</Readout>
		{#if phase === 'chord'}
			<Readout id="q" order={3} label="Q" value={coords(Q)} color="var(--ecc-q)">
				<Label
					x={0}
					y={178}
					text="Q = {coords(Q)}"
					size={14}
					anchor="start"
					tabular
					color="var(--ecc-q)"
					weight={600}
				/>
			</Readout>
		{/if}
		{#if phase === 'curve' || phase === 'infinity'}
			<Readout id="twin" order={3} label="−P" value={coords(twin)} color="var(--ecc-p)">
				<Label
					x={0}
					y={178}
					text="−P = {coords(twin)}"
					size={14}
					anchor="start"
					tabular
					color="var(--ecc-p)"
				/>
			</Readout>
		{/if}
		{#if phase !== 'curve'}
			{#if sum.kind === 'vertical'}
				<Readout
					id="sum"
					order={5}
					label={sumName}
					value="O"
					color="var(--ecc-sum)"
					opacity={u.sum}
				>
					<Label
						x={0}
						y={226}
						text="{sumName} = O"
						size={16}
						anchor="start"
						weight={700}
						color="var(--ecc-sum)"
						opacity={u.sum}
					/>
				</Readout>
			{:else}
				<Readout id="slope" order={4} label="slope λ" value={txt.slope} opacity={u.line}>
					<Label
						x={0}
						y={204}
						text="slope λ = {txt.slope}"
						size={13}
						anchor="start"
						tabular
						muted
						opacity={u.line}
					/>
				</Readout>
				<Readout id="r" order={5} label="R" value={txt.r} opacity={u.third}>
					<Label
						x={0}
						y={230}
						text="R = {txt.r}"
						size={14}
						anchor="start"
						tabular
						color="var(--ecc-r)"
						opacity={u.third}
					/>
				</Readout>
				<Readout
					id="sum"
					order={6}
					label={sumName}
					value={txt.sum}
					color="var(--ecc-sum)"
					opacity={u.sum}
				>
					<Label
						x={0}
						y={258}
						text="{sumName} = {txt.sum}"
						size={16}
						anchor="start"
						tabular
						weight={700}
						color="var(--ecc-sum)"
						opacity={u.sum}
					/>
				</Readout>
				{#if offPicture}
					<Readout
						id="off"
						order={7}
						label="Note"
						value="R and the sum lie beyond the picture"
						opacity={u.third}
					>
						<Label
							x={0}
							y={282}
							text="R and {sumName} lie beyond the picture"
							size={12}
							anchor="start"
							muted
							opacity={u.third}
						/>
					</Readout>
				{/if}
			{/if}
		{/if}
		<Readout id="hint">
			<Label
				x={0}
				y={556}
				text={phase === 'chord' ? 'drag P and Q along the curve' : 'drag P along the curve'}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
		{#if phase === 'infinity'}
			<Readout id="root" order={8} label="Order 2" value="(−1.91, 0): 2P = O">
				<Label
					x={0}
					y={318}
					text="at ({n1(REAL_ROOT)}, 0) P is its own twin"
					size={12}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	</g>
</g>
