<script lang="ts">
	/**
	 * A fruit-fly egg (490 µm) with Bicoid made at its head end, shaded by the SDD model's
	 * concentration as it forms, above a chart of the profile (divided by its level at the head
	 * end) against the measured exponential, λ ≈ 100 µm (Gregor et al. 2007), dashed.
	 *
	 * Control `measure` picks D and the half-life: the fit to protein age (Durrieu et al. 2018),
	 * FRAP's D with that half-life, FRAP's D with the half-life that would give λ = 100 µm, or
	 * FCS's D (Abu-Arish et al. 2010). The egg starts empty and the clock stops at 3 h, by which
	 * time the pattern has been read; "Start again" (`restart`) refills it. The tissue lives in a
	 * frame-to-frame memo inside a `$derived`, as in RowScene. Reduced motion: the state at 3 h.
	 */
	import { Axes, Label, clamp, hash, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BICOID_LAMBDA,
		DX,
		EGG_LENGTH,
		SIM_RATE,
		Tissue,
		decayLength,
		steadySDD
	} from '../model';

	let { t, params, reduced }: StageProps = $props();

	const SETS: Record<string, { D: number; halfLife: number; name: string }> = {
		fit: { D: 3.6, halfLife: 26, name: 'fitted to protein age (2018)' },
		frap: { D: 0.3, halfLife: 26, name: 'FRAP’s D (2007), 26 min half-life' },
		'frap-slow': {
			D: 0.3,
			halfLife: (BICOID_LAMBDA ** 2 * Math.LN2) / 0.3 / 60,
			name: 'FRAP’s D (2007), 6.4 h half-life'
		},
		fcs: { D: 7.4, halfLife: 26, name: 'FCS’s D (2010), 26 min half-life' }
	};
	const which = $derived(String(params.measure ?? 'fit'));
	const set = $derived(SETS[which] ?? SETS.fit);
	const p = $derived({ D: set.D, halfLife: set.halfLife, prod: 1, expander: false });
	const restarts = $derived(Number(params.restart ?? 0));
	const L = EGG_LENGTH;
	const END = 3 * 3600;
	const lam = $derived(decayLength(p.D, p.halfLife));

	// ---- the tissue (memo) ----------------------------------------------------------------------
	const key = $derived(`${restarts}|${which}`);
	let memo: { key: string; start: number; last: number; tissue: Tissue | null } = {
		key: '',
		start: 0,
		last: 0,
		tissue: null
	};
	const state = $derived.by(() => {
		if (memo.key !== key || t < memo.last || !memo.tissue) {
			memo = { key, start: t, last: t, tissue: new Tissue(L, p) };
		}
		memo.last = t;
		const simT = reduced ? END : Math.min(END, (t - memo.start) * SIM_RATE);
		const s = memo.tissue!.at(simT, 1e5);
		return { t: s.t, M: Float64Array.from(s.M) };
	});
	const M = $derived(state.M);
	const head = $derived(Math.max(M[0], 1e-9));
	const final = $derived(steadySDD(0, { ...p, L }));

	// ---- the egg ---------------------------------------------------------------------------------
	const CX = 484;
	const CY = 124;
	const RX = 366;
	const RY = 80;
	const ex = (u: number) => CX - RX + u * 2 * RX; // u = fraction of egg length
	/** Gradient stops along the egg's long axis. */
	const stops = $derived(
		Array.from({ length: 26 }, (_, k) => {
			const u = k / 25;
			const i = Math.min(M.length - 1, Math.floor((u * L) / DX));
			return { k, off: u * 100, o: clamp(M[i] / 110) ** 0.6 };
		})
	);
	/** Nuclei near the egg's surface: a fixed scatter inside the ellipse. */
	const nuclei = Array.from({ length: 150 }, (_, i) => {
		const u = 0.03 + 0.94 * hash(i, 3);
		const v = (hash(i, 5) * 2 - 1) * Math.sqrt(1 - (2 * u - 1) ** 2) * 0.86;
		return { i, x: ex(u), y: CY + v * RY };
	}).filter((n) => Math.abs(n.y - CY) > 4);

	// ---- the chart -------------------------------------------------------------------------------
	const X0 = 120;
	const X1 = 860;
	const sx = scale([0, 100], [X0, X1]);
	const sy = scale([0, 1.05], [532, 276]);
	const measured = Array.from({ length: 101 }, (_, k) => ({
		x: k,
		y: Math.exp(-(k / 100) * (L / BICOID_LAMBDA))
	}));
	const model = $derived(
		Array.from({ length: M.length }, (_, i) => ({
			x: (((i + 0.5) * DX) / L) * 100,
			y: M[i] / head
		}))
	);

	const clock = $derived.by(() => {
		const m = Math.floor(state.t / 60);
		return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
	});
	const lamText = $derived(
		`model: λ = √(D·τ) = ${Math.round(lam)} µm, ${Math.round((lam / L) * 100)} % of the egg`
	);
	const finalShare = $derived(Math.round((M[0] / final) * 100));
</script>

<g>
	<defs>
		<linearGradient id="embryo-grad" x1="0" x2="1" y1="0" y2="0">
			{#each stops as s (s.k)}
				<stop offset="{s.off}%" stop-color="var(--mg-morph)" stop-opacity={s.o} />
			{/each}
		</linearGradient>
	</defs>

	<!-- the egg -->
	<ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="var(--mg-egg)" />
	<ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="url(#embryo-grad)" />
	{#each nuclei as n (n.i)}
		<circle cx={n.x} cy={n.y} r="2.4" fill="var(--mg-nucleus)" opacity="0.5" />
	{/each}
	<ellipse
		cx={CX}
		cy={CY}
		rx={RX}
		ry={RY}
		fill="none"
		stroke="var(--mg-cell-edge)"
		stroke-width="1.5"
	/>
	<ellipse cx={CX - RX + 16} cy={CY} rx="9" ry="22" fill="var(--mg-morph)" opacity="0.95" />
	<Readout id="mrna-key">
		<Label
			x={CX - RX + 10}
			y={CY - RY - 10}
			text="bicoid mRNA: Bicoid made here"
			size={12}
			anchor="start"
			color="var(--mg-morph-text)"
			weight={600}
		/>
	</Readout>
	<Readout id="ends">
		<Label x={CX - RX} y={CY + RY + 20} text="head end" size={12} anchor="start" muted />
		<Label x={CX + RX} y={CY + RY + 20} text="tail end · egg {L} µm" size={12} anchor="end" muted />
	</Readout>

	<!-- the chart -->
	<Axes {sx} {sy} xLabel="% of egg length" yLabel="÷ level at head end" />
	<path
		d={linePath(
			measured,
			(d) => d.x,
			(d) => d.y,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-dasharray="7 5"
		opacity="0.75"
	/>
	<path
		d={linePath(
			model,
			(d) => d.x,
			(d) => d.y,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--mg-morph)"
		stroke-width="3"
		stroke-linejoin="round"
	/>

	<Readout id="time" order={1} label="Since production began" value={clock}>
		<Label
			x={X1}
			y={298}
			text="since Bicoid production began: {clock}"
			size={14}
			weight={600}
			anchor="end"
			tabular
		/>
	</Readout>
	<Readout
		id="model"
		order={2}
		label="Model"
		value="λ = {Math.round(lam)} µm"
		note={set.name}
		color="var(--mg-morph-text)"
	>
		<Label
			x={X1}
			y={326}
			text={lamText}
			size={13}
			anchor="end"
			tabular
			color="var(--mg-morph-text)"
			weight={600}
		/>
		<Label x={X1} y={346} text={set.name} size={11} anchor="end" muted />
	</Readout>
	<Readout id="measured" order={3} label="Measured" value="λ ≈ {BICOID_LAMBDA} µm (dashed)">
		<Label
			x={X1}
			y={372}
			text="measured: λ ≈ {BICOID_LAMBDA} µm, {Math.round(
				(BICOID_LAMBDA / L) * 100
			)} % of the egg (dashed)"
			size={13}
			anchor="end"
		/>
	</Readout>
	<Readout id="settled" order={4} label="Head end" value="{finalShare} % of its final level">
		<Label
			x={X1}
			y={398}
			text="head end at {finalShare} % of its final level"
			size={12}
			anchor="end"
			tabular
			muted={finalShare >= 95}
			color={finalShare < 95 ? 'var(--mg-red)' : undefined}
		/>
	</Readout>
</g>
