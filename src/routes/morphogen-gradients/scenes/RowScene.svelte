<script lang="ts">
	/**
	 * A row of cells 500 µm long with a morphogen source at its left end, above the morphogen's
	 * profile (../model.ts `Tissue`: synthesis, diffusion and breakdown, solved live).
	 *
	 * Focus (`step.hints.focus`):
	 * - 'build': the tissue starts empty and the profile rises and settles; cells are shaded by
	 *   concentration; the clock shows the embryo's time;
	 * - 'shape': the settled profile with λ = √(D·τ) marked at λ, 2λ and 3λ, optionally on a
	 *   logarithmic axis (control `log`);
	 * - 'flag': two thresholds (controls t1, t2, or the handles on the chart) paint the cells blue,
	 *   white and red; the boundaries are marked;
	 * - 'noise': each cell reads the concentration with a Gaussian error σ (control `noise`),
	 *   drawn afresh twice a second, and paints itself by its reading; each boundary carries its
	 *   positional error σ/|slope|.
	 *
	 * The tissue lives in a frame-to-frame memo inside a `$derived` (the guide's sanctioned
	 * exception for an integral of a rate that a control changes): slider changes act on the
	 * profile from where it is. Other focuses than 'build' start from the settled profile.
	 * Reduced motion: the settled profile.
	 */
	import { Axes, Handle, Label, clamp, hash, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BICOID,
		DX,
		NUCLEUS_SPACING,
		SIM_FAST,
		SIM_RATE,
		Tissue,
		crossing,
		decayLength,
		positionalError,
		settled,
		steadySDD,
		type TissueParams
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'build'));
	const L = BICOID.length;
	const p: TissueParams = $derived({
		D: Number(params.D ?? BICOID.D),
		halfLife: Number(params.halfLife ?? BICOID.halfLife),
		prod: Number(params.prod ?? 1),
		expander: false
	});
	const restarts = $derived(Number(params.restart ?? 0));
	const lam = $derived(decayLength(p.D, p.halfLife));
	const useLog = $derived(focus === 'shape' && params.log === true);
	const flagged = $derived(focus === 'flag' || focus === 'noise');
	const T1 = $derived(Number(params.t1 ?? 35));
	const T2 = $derived(Number(params.t2 ?? 10));
	const sigma = $derived(focus === 'noise' ? Number(params.noise ?? 2) : 0);

	// ---- the tissue (memo: see the header comment) --------------------------------------------
	const key = $derived(`${restarts}|${focus}`);
	let memo: { key: string; start: number; last: number; tissue: Tissue | null } = {
		key: '',
		start: 0,
		last: 0,
		tissue: null
	};
	const state = $derived.by(() => {
		if (reduced) return { t: 0, M: settled(L, p).M };
		if (memo.key !== key || t < memo.last || !memo.tissue) {
			const tissue = new Tissue(L, p);
			if (focus !== 'build') tissue.load(settled(L, p));
			memo = { key, start: t, last: t, tissue };
		}
		memo.last = t;
		memo.tissue!.set(p);
		const s = memo.tissue!.at((t - memo.start) * (focus === 'build' ? SIM_RATE : SIM_FAST));
		return { t: s.t, M: Float64Array.from(s.M) };
	});
	const M = $derived(state.M);
	const valueAt = (x: number) => {
		const u = x / DX - 0.5;
		if (u <= 0) return M[0];
		if (u >= M.length - 1) return M[M.length - 1];
		const i = Math.floor(u);
		return M[i] + (M[i + 1] - M[i]) * (u - i);
	};

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 120;
	const X1 = 860;
	const ROW_Y = 22;
	const ROW_H = 42;
	const CH_TOP = 182;
	const CH_BOT = 520;
	const sx = scale([0, L], [X0, X1]);

	/** The settled level at the source: it sets the axis, so the axis does not move as it fills. */
	const c0 = $derived(steadySDD(0, { ...p, L }));
	const yStep = $derived(c0 * 1.1 > 400 ? 200 : c0 * 1.1 > 200 ? 100 : 25);
	const yMax = $derived(Math.max(50, Math.ceil((c0 * 1.1) / yStep) * yStep));
	const logTop = $derived(Math.ceil(Math.log10(c0 * 1.5)));
	const logBot = $derived(logTop - 5);
	const sy = $derived(
		useLog ? scale([logBot, logTop], [CH_BOT, CH_TOP]) : scale([0, yMax], [CH_BOT, CH_TOP])
	);
	const yOf = (c: number) => (useLog ? sy(Math.log10(Math.max(c, 10 ** logBot))) : sy(c));
	const cOf = (py: number) => (useLog ? 10 ** sy.invert(py) : sy.invert(py));
	const yTicks = $derived(
		useLog ? Array.from({ length: logTop - logBot + 1 }, (_, i) => logBot + i) : undefined
	);
	const yFormat = $derived(
		useLog
			? (v: number) => (v >= 0 ? String(10 ** v) : (10 ** v).toFixed(-v))
			: (v: number) => v.toLocaleString('en-US')
	);

	const curve = $derived.by(() => {
		let d = `M${sx(0).toFixed(1)} ${yOf(M[0]).toFixed(1)}`;
		for (let i = 0; i < M.length; i++)
			d += `L${sx((i + 0.5) * DX).toFixed(1)} ${yOf(M[i]).toFixed(1)}`;
		return d + `L${sx(L).toFixed(1)} ${yOf(M[M.length - 1]).toFixed(1)}`;
	});
	/** The settled profile for the current settings. */
	const S = $derived(settled(L, p).M);
	/** Still on its way to it (by more than 2 % of the source level somewhere)? */
	const moving = $derived.by(() => {
		for (let i = 0; i < M.length; i += 4) if (Math.abs(M[i] - S[i]) > 0.02 * c0) return true;
		return false;
	});
	/** Where the profile settles (drawn while it builds, or after a slider moved). */
	const target = $derived.by(() => {
		if (focus !== 'build' && !moving) return '';
		let d = '';
		for (let i = 0; i < S.length; i += 2)
			d += `${i ? 'L' : 'M'}${sx((i + 0.5) * DX).toFixed(1)} ${yOf(S[i]).toFixed(1)}`;
		return d;
	});
	const band = $derived.by(() => {
		if (sigma <= 0) return '';
		let up = '';
		let down = '';
		for (let i = 0; i < M.length; i += 2) {
			const x = sx((i + 0.5) * DX).toFixed(1);
			up += `${i === 0 ? 'M' : 'L'}${x} ${yOf(M[i] + sigma).toFixed(1)}`;
			down = `L${x} ${yOf(Math.max(0, M[i] - sigma)).toFixed(1)}` + down;
		}
		return up + down + 'Z';
	});

	// ---- the cells -----------------------------------------------------------------------------
	const NC = Math.floor(L / NUCLEUS_SPACING);
	const CW = (X1 - X0) / NC;
	/** A standard normal number for cell i and reading k (Box–Muller from two hashes). */
	const gauss = (i: number, k: number) =>
		Math.sqrt(-2 * Math.log(1 - hash(i, 7 + k * 2) * 0.999999)) *
		Math.cos(2 * Math.PI * hash(i, 8 + k * 2));
	const reading = $derived(Math.floor(t * 2));
	const fate = (c: number) => (c >= T1 ? 'blue' : c < T2 ? 'red' : 'white');
	const cells = $derived(
		Array.from({ length: NC }, (_, i) => {
			const c = valueAt((i + 0.5) * (L / NC));
			const read = sigma > 0 ? c + sigma * gauss(i, reading) : c;
			return { i, x: X0 + i * CW, c, fate: fate(read) };
		})
	);
	const fill = (f: string) =>
		f === 'blue' ? 'var(--mg-blue)' : f === 'red' ? 'var(--mg-red)' : 'var(--mg-white)';
	const shade = (c: number) => clamp(c / c0) ** 0.6;

	// ---- boundaries and their errors ---------------------------------------------------------
	const pct = (x: number) => `${Math.round((x / L) * 100)} %`;
	const where = (T: number) => {
		const x = crossing(M, T);
		if (x === null) return { x: null, text: 'beyond the far end' };
		if (x === 0) return { x: 0, text: 'at the source (none of that band)' };
		return { x, text: `${Math.round(x)} µm (${pct(x)} of the row)` };
	};
	const b1 = $derived(where(T1));
	const b2 = $derived(where(T2));
	const err = (T: number) => {
		const e = positionalError(M, T, sigma);
		if (e === null) return null;
		return e;
	};
	const e1 = $derived(sigma > 0 ? err(T1) : null);
	const e2 = $derived(sigma > 0 ? err(T2) : null);
	const errText = (e: number | null) =>
		e === null
			? '—'
			: e < NUCLEUS_SPACING
				? `± ${e.toFixed(1)} µm (under one cell)`
				: e > L
					? '± more than the whole row'
					: `± ${Math.round(e)} µm (${(e / NUCLEUS_SPACING).toFixed(1)} cells)`;

	// ---- readouts ------------------------------------------------------------------------------
	const clock = $derived.by(() => {
		const m = Math.floor(state.t / 60);
		return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
	});
	const tau = $derived(p.halfLife / Math.LN2);
	const lamText = $derived(
		`λ = √(D·τ) = √(${p.D.toFixed(1)} µm²/s × ${tau.toFixed(1)} min) = ${Math.round(lam)} µm`
	);
	const sourceLevel = $derived(`level at the source: ${Math.round(M[0])}`);
	const marks = $derived(
		[1, 2, 3]
			.map((n) => ({ n, x: n * lam }))
			.filter((m) => m.x < L * 0.97)
			.filter((m) => m.n === 1 || sx(lam) - sx(0) > 40)
			.map((m) => {
				const u = m.x / DX - 0.5;
				const i = Math.max(0, Math.min(S.length - 2, Math.floor(u)));
				return { ...m, c: S[i] + (S[i + 1] - S[i]) * (u - i) };
			})
	);

	// ---- threshold handles -----------------------------------------------------------------------
	const HX = X1 + 22;
	const moveT = (id: 't1' | 't2') => (pt: Point) => {
		const lo = id === 't1' ? T2 + 1 : 1;
		const hi = id === 't1' ? 90 : Math.min(60, T1 - 1);
		setParam(id, Math.round(clamp(cOf(pt.y), lo, hi)));
	};
	const keyT = (id: 't1' | 't2') => (k: number | 'start' | 'end') => {
		const v = id === 't1' ? T1 : T2;
		const lo = id === 't1' ? T2 + 1 : 1;
		const hi = id === 't1' ? 90 : Math.min(60, T1 - 1);
		setParam(id, k === 'start' ? lo : k === 'end' ? hi : clamp(v + k, lo, hi));
	};
	const thresholds = $derived([
		{ id: 't1' as const, T: T1, b: b1, e: e1, color: 'var(--mg-blue)', name: 'high threshold' },
		{ id: 't2' as const, T: T2, b: b2, e: e2, color: 'var(--mg-red)', name: 'low threshold' }
	]);
</script>

<g>
	<!-- the row of cells, and the source -->
	<rect
		x={X0 - 52}
		y={ROW_Y + 4}
		width="44"
		height={ROW_H - 8}
		rx="8"
		fill="var(--mg-morph)"
		opacity="0.9"
	/>
	<Readout id="source-key">
		<Label
			x={X0 - 30}
			y={ROW_Y + ROW_H + 18}
			text="source"
			size={12}
			color="var(--mg-morph-text)"
			weight={600}
		/>
	</Readout>
	{#each cells as cell (cell.i)}
		<rect
			x={cell.x + 0.6}
			y={ROW_Y}
			width={CW - 1.2}
			height={ROW_H}
			rx="3"
			fill={flagged ? fill(cell.fate) : 'var(--mg-cell)'}
			stroke="var(--mg-cell-edge)"
			stroke-width="0.8"
		/>
		{#if !flagged}
			<rect
				x={cell.x + 0.6}
				y={ROW_Y}
				width={CW - 1.2}
				height={ROW_H}
				rx="3"
				fill="var(--mg-morph)"
				opacity={shade(cell.c)}
			/>
		{/if}
		<circle
			cx={cell.x + CW / 2}
			cy={ROW_Y + ROW_H / 2}
			r="2.6"
			fill="var(--mg-nucleus)"
			opacity="0.75"
		/>
	{/each}
	<Readout id="row-key">
		<Label
			x={X0}
			y={ROW_Y + ROW_H + 18}
			text="{NC} cells, {NUCLEUS_SPACING} µm apart"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- readouts between the row and the chart -->
	{#if focus === 'build'}
		<Readout id="clock" order={1} label="Time" value={clock}>
			<Label x={X0} y={124} text="time: {clock}" size={15} weight={600} anchor="start" tabular />
		</Readout>
		<Readout id="source" order={2} label="Source end" value={String(Math.round(M[0]))}>
			<Label x={X0 + 200} y={124} text={sourceLevel} size={13} anchor="start" tabular />
		</Readout>
		<Readout id="lambda" order={3} label="Length scale" value="{Math.round(lam)} µm">
			<Label
				x={X1}
				y={124}
				text="λ = √(D·τ) = {Math.round(lam)} µm"
				size={13}
				anchor="end"
				tabular
				color="var(--mg-morph-text)"
				weight={600}
			/>
		</Readout>
	{:else if focus === 'shape'}
		<Readout id="lambda" order={1} label="Length scale" value="{Math.round(lam)} µm" note={lamText}>
			<Label
				x={X0}
				y={120}
				text={lamText}
				size={14}
				weight={600}
				anchor="start"
				tabular
				color="var(--mg-morph-text)"
			/>
		</Readout>
		<Readout id="source" order={2} label="Source end" value={String(Math.round(M[0]))}>
			<Label x={X1} y={120} text={sourceLevel} size={13} anchor="end" tabular />
		</Readout>
		<Readout id="ratio">
			<Label
				x={X0}
				y={142}
				text="τ = half-life / ln 2 is the mean lifetime; each λ further on, the level falls by a factor e ≈ 2.7"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{:else}
		{#each thresholds as th, k (th.id)}
			<Readout
				id="b-{th.id}"
				order={1 + k}
				label={k === 0 ? 'Blue | white' : 'White | red'}
				value={th.b.text}
				note={sigma > 0 ? `positional error ${errText(th.e)}` : undefined}
			>
				<Label
					x={k === 0 ? X0 : X0 + 380}
					y={118}
					text="{k === 0 ? 'blue | white' : 'white | red'}: {th.b.text}"
					size={13}
					weight={600}
					anchor="start"
					tabular
				/>
				{#if sigma > 0}
					<Label
						x={k === 0 ? X0 : X0 + 380}
						y={140}
						text="positional error {errText(th.e)}"
						size={12}
						anchor="start"
						tabular
						color={th.color}
					/>
				{/if}
			</Readout>
		{/each}
		{#if focus === 'flag'}
			<Readout id="shift">
				<Label
					x={X0}
					y={140}
					text="each doubling of production moves both boundaries by λ·ln 2 = {Math.round(
						lam * Math.LN2
					)} µm"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the chart -->
	<Axes
		{sx}
		{sy}
		xLabel="distance from the source (µm)"
		yLabel={useLog ? 'morphogen (log scale)' : 'morphogen (relative)'}
		{yTicks}
		{yFormat}
	/>
	{#if band}
		<path d={band} fill="var(--mg-morph)" opacity="0.16" />
	{/if}

	{#if focus === 'shape'}
		{#each marks as m (m.n)}
			<line
				x1={sx(m.x)}
				x2={sx(m.x)}
				y1={CH_BOT}
				y2={yOf(m.c)}
				stroke="var(--mg-morph-text)"
				stroke-dasharray="3 4"
				stroke-width="1"
				opacity="0.8"
			/>
			<circle cx={sx(m.x)} cy={yOf(m.c)} r="4" fill="var(--mg-morph-text)" />
			<Readout id="mark-{m.n}">
				<Label
					x={sx(m.x) + 8}
					y={yOf(m.c) - 10}
					text={m.n === 1 ? 'λ: ÷ e' : `${m.n}λ: ÷ e${m.n === 2 ? '²' : '³'}`}
					size={12}
					anchor="start"
					color="var(--mg-morph-text)"
					weight={600}
				/>
			</Readout>
		{/each}
	{/if}

	{#if target}
		<path
			d={target}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		<Readout id="target-key">
			<Label
				x={sx(L * 0.42)}
				y={yOf(steadySDD(L * 0.42, { ...p, L })) - 12}
				text="dashed: where it settles"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
	<path d={curve} fill="none" stroke="var(--mg-morph)" stroke-width="3" stroke-linejoin="round" />

	{#if flagged}
		{#each thresholds as th (th.id)}
			{@const y = yOf(th.T)}
			<line
				x1={X0}
				x2={X1}
				y1={y}
				y2={y}
				stroke={th.color}
				stroke-width="1.5"
				stroke-dasharray="6 4"
			/>
			<Readout id="t-{th.id}">
				<Label
					x={X1 - 4}
					y={th.id === 't1' ? Math.min(y - 8, yOf(T2) - 24) : y - 8}
					text="{th.name}: {th.T}"
					size={12}
					anchor="end"
					color={th.color}
					weight={600}
					tabular
				/>
			</Readout>
			{#if th.b.x !== null && th.b.x > 0}
				<line
					x1={sx(th.b.x)}
					x2={sx(th.b.x)}
					y1={y}
					y2={ROW_Y + ROW_H + 2}
					stroke={th.color}
					stroke-width="1.2"
					opacity="0.7"
				/>
				{#if th.e !== null && sigma > 0}
					{@const xa = Math.max(X0, sx(th.b.x - th.e))}
					{@const xb = Math.min(X1, sx(th.b.x + th.e))}
					<line
						x1={xa}
						x2={xb}
						y1={y}
						y2={y}
						stroke={th.color}
						stroke-width="5"
						opacity="0.55"
						stroke-linecap="round"
					/>
					<line x1={xa} x2={xa} y1={y - 8} y2={y + 8} stroke={th.color} stroke-width="2" />
					<line x1={xb} x2={xb} y1={y - 8} y2={y + 8} stroke={th.color} stroke-width="2" />
				{/if}
				<circle cx={sx(th.b.x)} cy={y} r="4.5" fill={th.color} />
			{/if}
			<Handle
				x={th.id === 't1' ? HX : HX + 26}
				{y}
				label={th.name}
				value={th.T}
				min={1}
				max={90}
				valuetext={String(th.T)}
				color={th.color}
				onmove={moveT(th.id)}
				onkey={keyT(th.id)}
			/>
		{/each}
	{/if}
</g>
