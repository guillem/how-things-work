<script lang="ts">
	/**
	 * RoPE on one query token and one key token (16 dimensions, eight pairs).
	 *
	 * Top: the positions 0–63 with the key token (at `at`) and the query token (`dist` further on);
	 * dragging the key moves both, dragging the query changes the distance. Middle: one dial per
	 * pair, with the query's pair turned by m·θᵢ (orange) and the key's by n·θᵢ (blue), the faint
	 * arrows where they were before turning, and each pair's share of the score as a bar.
	 *
	 * Phases (`step.hints.phase`):
	 *   rotate   — the arrows turn from their original directions (a loop; complete under reduced
	 *              motion), and a card says what is turned and what is not
	 *   relative — a chart of the score against where the pair stands: RoPE (flat) and the same
	 *              vectors with added sinusoids (drifting)
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Handle, Label, smoothstep, type Point } from '#lib/draw/index.ts';
	import { D, frequencies, PAIR, pairShares, rope, TRAIN } from '../position';
	import { atOf, distOf, MAX_DIST } from '../steps';
	import { arc, fix, onDial } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'rotate'));
	const relative = $derived(phase === 'relative');
	const TH = frequencies(D);
	const SQ = Math.sqrt(D);

	const dist = $derived(distOf(params));
	const n = $derived(atOf(params));
	const m = $derived(n + dist);

	/** How far the turn has gone: a loop in the rotate phase, always complete otherwise. */
	const u = $derived.by(() => {
		if (reduced || relative) return 1;
		const c = cycle(t, 9) * 9;
		return smoothstep(1, 3.5, c) * (1 - smoothstep(8.4, 9, c));
	});
	const qr = $derived(rope(PAIR.q, m * u));
	const kr = $derived(rope(PAIR.k, n * u));
	const shares = $derived(pairShares(qr, kr).map((s) => s / SQ));
	const score = $derived(shares.reduce((sum, s) => sum + s, 0));
	const sinScore = $derived(PAIR.sinusoid(m, n));

	// ---- the track of positions
	const TX0 = 64;
	const CELL = 13;
	const TY = 96;
	const tx = (p: number) => TX0 + (p + 0.5) * CELL;
	const cells = Array.from(
		{ length: TRAIN },
		(_, p) => `M${TX0 + p * CELL + 1} ${TY}h${CELL - 2}v10h${-(CELL - 2)}Z`
	).join('');

	function moveKey(p: Point) {
		const v = Math.round((p.x - TX0) / CELL - 0.5);
		setParam('at', Math.max(0, Math.min(TRAIN - 1 - dist, v)));
	}
	function moveQuery(p: Point) {
		const v = Math.round((p.x - TX0) / CELL - 0.5);
		setParam('dist', Math.max(0, Math.min(MAX_DIST, TRAIN - 1 - n, v - n)));
	}
	const keyStep = (s: number | 'start' | 'end') => {
		const v = s === 'start' ? 0 : s === 'end' ? TRAIN - 1 - dist : n + s;
		setParam('at', Math.max(0, Math.min(TRAIN - 1 - dist, v)));
	};
	const queryStep = (s: number | 'start' | 'end') => {
		const hi = Math.min(MAX_DIST, TRAIN - 1 - n);
		const v = s === 'start' ? 0 : s === 'end' ? hi : dist + s;
		setParam('dist', Math.max(0, Math.min(hi, v)));
	};

	// ---- the dials
	const DY = 236;
	const DR = 40;
	const dx = (i: number) => 92 + i * 111;
	const pairLen = (v: readonly number[], i: number) => Math.hypot(v[2 * i], v[2 * i + 1]);
	const MAXLEN = Math.max(...TH.map((_, i) => Math.max(pairLen(PAIR.q, i), pairLen(PAIR.k, i))));
	const ang = (v: readonly number[], i: number) => Math.atan2(v[2 * i + 1], v[2 * i]);
	const tipOf = (v: readonly number[], i: number) =>
		onDial(dx(i), DY, (DR * pairLen(v, i)) / MAXLEN, ang(v, i));
	/** The angle from the key's arrow to the query's, in (−π, π]. */
	const between = (i: number) => {
		let a = ang(qr, i) - ang(kr, i);
		while (a > Math.PI) a -= 2 * Math.PI;
		while (a <= -Math.PI) a += 2 * Math.PI;
		return a;
	};

	const SUP: Record<string, string> = { '1': '¹', '2': '²', '3': '³', '4': '⁴' };
	/** θ with three decimals, or as m×10⁻ᵉ when it is small. */
	const thetaText = (th: number) => {
		if (th >= 0.01) return fix(th, 3);
		const e = Math.floor(Math.log10(th));
		return `${(th / 10 ** e).toFixed(1)}×10⁻${SUP[String(-e)] ?? -e}`;
	};

	// ---- the share bars
	const BY = 372;
	const BMAX = 34;
	const SHARE_MAX = Math.max(...TH.map((_, i) => (pairLen(PAIR.q, i) * pairLen(PAIR.k, i)) / SQ));
	const bh = (s: number) => (s / SHARE_MAX) * BMAX;

	// ---- the chart (relative phase): score against the key's position, at this distance
	const C = { x: 96, y: 460, w: 800, h: 94 };
	let lo = Infinity;
	let hi = -Infinity;
	for (let d = 0; d <= MAX_DIST; d++)
		for (let p = 0; p + d < TRAIN; p++) {
			for (const s of [PAIR.rope(p + d, p), PAIR.sinusoid(p + d, p)]) {
				lo = Math.min(lo, s);
				hi = Math.max(hi, s);
			}
		}
	const YLO = Math.floor(lo * 2) / 2;
	const YHI = Math.ceil(hi * 2) / 2;
	const cx = (p: number) => C.x + (p / (TRAIN - 1)) * C.w;
	const cy = (s: number) => C.y + C.h - ((s - YLO) / (YHI - YLO)) * C.h;
	const line = (f: (p: number) => number, last: number) =>
		Array.from(
			{ length: last + 1 },
			(_, p) => `${p ? 'L' : 'M'}${cx(p).toFixed(1)} ${cy(f(p)).toFixed(1)}`
		).join('');
	const ropeLine = $derived(line((p) => PAIR.rope(p + dist, p), TRAIN - 1 - dist));
	const sinLine = $derived(line((p) => PAIR.sinusoid(p + dist, p), TRAIN - 1 - dist));
	const yTicks = $derived(
		Array.from({ length: Math.round((YHI - YLO) / 0.5) + 1 }, (_, i) => YLO + i * 0.5).filter((v) =>
			Number.isInteger(v)
		)
	);
</script>

<g>
	<Readout id="title" order={0} label="Query at" value="position {m}, key at {n}, distance {dist}">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={15}
			weight={650}
			text="RoPE: the query at position {m} and the key at position {n}, {dist} apart"
		/>
	</Readout>

	<!-- the track: the query above it, the key below -->
	<path d={cells} fill="var(--stage-grid)" />
	<Label x={TX0 - 8} y={TY + 9} anchor="end" size={11} muted tabular text="0" />
	<Label x={TX0 + TRAIN * CELL + 8} y={TY + 9} anchor="start" size={11} muted tabular text="63" />
	<rect x={tx(n) - CELL / 2 + 1} y={TY} width={CELL - 2} height="10" fill="var(--pe-k)" />
	<rect x={tx(m) - CELL / 2 + 1} y={TY} width={CELL - 2} height="10" fill="var(--pe-q)" />
	<line x1={tx(m)} y1={TY - 6} x2={tx(m)} y2={TY} stroke="var(--pe-q)" stroke-width="2" />
	<line x1={tx(n)} y1={TY + 10} x2={tx(n)} y2={TY + 16} stroke="var(--pe-k)" stroke-width="2" />
	<Handle
		x={tx(m)}
		y={TY - 14}
		r={8}
		color="var(--pe-q)"
		label="Query token (sets the distance)"
		value={dist}
		min={0}
		max={Math.min(MAX_DIST, TRAIN - 1 - n)}
		valuetext="query at position {m}, {dist} after the key"
		onmove={moveQuery}
		onkey={queryStep}
	/>
	<Handle
		x={tx(n)}
		y={TY + 24}
		r={8}
		color="var(--pe-k)"
		label="Key token (moves both)"
		value={n}
		min={0}
		max={TRAIN - 1 - dist}
		valuetext="key at position {n}"
		onmove={moveKey}
		onkey={keyStep}
	/>
	<Readout id="who">
		<Label
			x={Math.min(880, Math.max(80, tx(m)))}
			y={TY - 32}
			size={12}
			weight={600}
			color="var(--pe-q)"
			text="query, m = {m}"
		/>
		<Label
			x={Math.min(880, Math.max(80, tx(n)))}
			y={TY + 52}
			size={12}
			weight={600}
			color="var(--pe-k)"
			text="key, n = {n}"
		/>
	</Readout>

	<!-- the dials -->
	{#each TH as th, i (i)}
		{@const x = dx(i)}
		{@const q0 = tipOf(PAIR.q, i)}
		{@const k0 = tipOf(PAIR.k, i)}
		{@const q1 = tipOf(qr, i)}
		{@const k1 = tipOf(kr, i)}
		{@const ra = (DR * Math.min(pairLen(PAIR.q, i), pairLen(PAIR.k, i))) / MAXLEN}
		<circle cx={x} cy={DY} r={DR} fill="var(--surface)" stroke="var(--border)" stroke-width="1.2" />
		<line
			x1={x}
			y1={DY}
			x2={q0.x}
			y2={q0.y}
			stroke="var(--pe-q)"
			stroke-width="1.2"
			stroke-dasharray="2 2"
			opacity="0.45"
		/>
		<line
			x1={x}
			y1={DY}
			x2={k0.x}
			y2={k0.y}
			stroke="var(--pe-k)"
			stroke-width="1.2"
			stroke-dasharray="2 2"
			opacity="0.45"
		/>
		{#if ra > 6}
			<path
				d={arc(x, DY, ra * 0.55, ang(kr, i), ang(kr, i) + between(i))}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
			/>
		{/if}
		<line
			x1={x}
			y1={DY}
			x2={k1.x}
			y2={k1.y}
			stroke="var(--pe-k)"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<circle cx={k1.x} cy={k1.y} r="3" fill="var(--pe-k)" />
		<line
			x1={x}
			y1={DY}
			x2={q1.x}
			y2={q1.y}
			stroke="var(--pe-q)"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<circle cx={q1.x} cy={q1.y} r="3" fill="var(--pe-q)" />
		<Readout id="pair{i}">
			<Label {x} y={DY - DR - 10} size={12} weight={600} text="pair {i + 1}" />
			<Label {x} y={DY + DR + 18} size={11} muted tabular text="θ = {thetaText(th)}" />
		</Readout>
		<!-- the share bar -->
		<path
			d="M{x - 14} {Math.min(BY, BY - bh(shares[i]))}h28v{Math.max(
				0.5,
				Math.abs(bh(shares[i]))
			)}h-28Z"
			fill={shares[i] >= 0 ? 'var(--pe-v)' : 'var(--pe-changed)'}
			opacity="0.85"
		/>
		<Readout id="share{i}">
			<Label
				{x}
				y={shares[i] >= 0 ? BY + 16 : BY - 6}
				size={11}
				tabular
				muted
				text={fix(shares[i])}
			/>
		</Readout>
	{/each}
	<line x1={40} y1={BY} x2={920} y2={BY} stroke="var(--stage-line)" stroke-width="1" />
	<Readout id="shares">
		<Label
			x={24}
			y={BY - BMAX - 8}
			anchor="start"
			size={11}
			muted
			text="each pair’s share of the score"
		/>
	</Readout>
	<Readout id="score" order={1} label="RoPE score" value={fix(score)} color="var(--pe-rope)">
		<Label
			x={936}
			y={BY + 34}
			anchor="end"
			size={14}
			weight={650}
			tabular
			color="var(--pe-rope)"
			text="{u === 1 ? 'RoPE score' : 'score while turning'} = sum of the shares = {fix(score)}"
		/>
	</Readout>

	{#if relative}
		<!-- score against where the pair stands -->
		<Readout
			id="sin"
			order={2}
			label="With added sinusoids"
			value={fix(sinScore)}
			color="var(--pe-sin)"
		>
			<Label
				x={24}
				y={BY + 34}
				anchor="start"
				size={13}
				tabular
				color="var(--pe-sin)"
				text="same tokens, sinusoids added instead: {fix(sinScore)}"
			/>
		</Readout>
		{#each yTicks as v (v)}
			<line x1={C.x} y1={cy(v)} x2={C.x + C.w} y2={cy(v)} stroke="var(--stage-grid)" />
			<Label x={C.x - 8} y={cy(v) + 4} anchor="end" size={11} muted tabular text={fix(v, 0)} />
		{/each}
		<line x1={C.x} y1={C.y} x2={C.x} y2={C.y + C.h} stroke="var(--stage-line)" />
		{#each [0, 16, 32, 48, 63] as p (p)}
			<Label x={cx(p)} y={C.y + C.h + 16} size={11} muted tabular text={String(p)} />
		{/each}
		<path d={sinLine} fill="none" stroke="var(--pe-sin)" stroke-width="2" stroke-linejoin="round" />
		<path d={ropeLine} fill="none" stroke="var(--pe-rope)" stroke-width="2.5" />
		<circle cx={cx(n)} cy={cy(sinScore)} r="5" fill="var(--pe-sin)" />
		<circle cx={cx(n)} cy={cy(score)} r="5" fill="var(--pe-rope)" />
		<Readout id="chart">
			<Label
				x={C.x}
				y={C.y - 10}
				anchor="start"
				size={12}
				weight={600}
				text="Score at distance {dist}, as the pair moves along (key position →)"
			/>
			<Label
				x={C.x + C.w}
				y={C.y - 10}
				anchor="end"
				size={12}
				color="var(--pe-rope)"
				weight={600}
				text="RoPE"
			/>
			<Label
				x={C.x + C.w - 50}
				y={C.y - 10}
				anchor="end"
				size={12}
				color="var(--pe-sin)"
				weight={600}
				text="added sinusoids"
			/>
		</Readout>
	{:else}
		<!-- what is turned, and what is not -->

		<Readout
			id="card"
			order={2}
			label="Turned"
			value="the query (by m·θᵢ) and the key (by n·θᵢ); not the value, and nothing is added to the embedding"
		>
			<rect
				x={140}
				y={428}
				width={680}
				height={132}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={168}
				y={460}
				anchor="start"
				size={13}
				halo={false}
				color="var(--pe-q)"
				weight={600}
				text="query q = W_q x: each pair turned by m·θᵢ"
			/>
			<Label
				x={168}
				y={486}
				anchor="start"
				size={13}
				halo={false}
				color="var(--pe-k)"
				weight={600}
				text="key k = W_k x: each pair turned by n·θᵢ"
			/>
			<Label
				x={168}
				y={512}
				anchor="start"
				size={13}
				halo={false}
				color="var(--pe-v)"
				weight={600}
				text="value v = W_v x: not turned"
			/>
			<Label
				x={168}
				y={538}
				anchor="start"
				size={13}
				halo={false}
				muted
				text="embedding x: nothing added; the turning happens in every attention layer"
			/>
		</Readout>
	{/if}
</g>
