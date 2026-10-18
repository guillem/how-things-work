<script lang="ts">
	/**
	 * Two tissues drawn to scale, 500 µm and `stretch` × 500 µm, each with a source at its left
	 * end and the same two thresholds (params t1, t2), painted blue, white and red, above a chart
	 * of both morphogen profiles (and, with the circuit on, the expander's, dashed, on the right
	 * axis). Markers under the long tissue show where the short tissue's boundaries would fall if
	 * the pattern scaled.
	 *
	 * Focus (`step.hints.focus`): 'plain' (the SDD model alone) or 'expander' (control `expander`
	 * switches Ben-Zvi and Barkai's expansion–repression circuit on or off). Both tissues start
	 * from their settled plain gradient; the circuit runs from the start of the step, at
	 * SCALE_RATE (an hour of embryo time per second). Changing the length starts both again.
	 * Memo as in RowScene. Reduced motion: the plain settled state, or a day of the circuit.
	 */
	import { Axes, Label, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BICOID,
		DX,
		NUCLEUS_SPACING,
		SCALE_RATE,
		Tissue,
		crossing,
		fitLength,
		settled,
		type TissueParams
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'plain'));
	const stretch = $derived(Number(params.stretch ?? 2));
	const on = $derived(focus === 'expander' && params.expander !== false);
	const T1 = $derived(Number(params.t1 ?? 35));
	const T2 = $derived(Number(params.t2 ?? 10));
	const LA = BICOID.length;
	const LB = $derived(Math.round(BICOID.length * stretch));
	const p: TissueParams = $derived({
		D: BICOID.D,
		halfLife: BICOID.halfLife,
		prod: 1,
		expander: on
	});

	// ---- the two tissues (memo) -----------------------------------------------------------------
	const key = $derived(`${LB}|${focus}`);
	let memo: {
		key: string;
		start: number;
		last: number;
		a: Tissue | null;
		b: Tissue | null;
	} = { key: '', start: 0, last: 0, a: null, b: null };
	const state = $derived.by(() => {
		if (reduced) {
			const a = settled(LA, p);
			const b = settled(LB, p);
			return { t: on ? 24 * 3600 : 0, a: { M: a.M, E: a.E }, b: { M: b.M, E: b.E } };
		}
		if (memo.key !== key || t < memo.last || !memo.a || !memo.b) {
			const plain = { ...p, expander: false };
			const a = new Tissue(LA, plain);
			const b = new Tissue(LB, plain);
			a.load(settled(LA, plain));
			b.load(settled(LB, plain));
			memo = { key, start: t, last: t, a, b };
		}
		memo.last = t;
		memo.a!.set(p);
		memo.b!.set(p);
		const simT = (t - memo.start) * SCALE_RATE;
		const sa = memo.a!.at(simT);
		const sb = memo.b!.at(simT);
		return {
			t: sa.t,
			a: { M: Float64Array.from(sa.M), E: Float64Array.from(sa.E) },
			b: { M: Float64Array.from(sb.M), E: Float64Array.from(sb.E) }
		};
	});

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 120;
	const W = 740;
	const k = $derived(W / LB);
	const px = (x: number) => X0 + x * k;
	const ROW_H = 30;
	const rows = $derived([
		{ id: 'a', L: LA, y: 52, s: state.a },
		{ id: 'b', L: LB, y: 150, s: state.b }
	]);

	const bands = (M: Float64Array, L: number) => {
		const b1 = Math.min(L, crossing(M, T1) ?? L);
		const b2 = Math.max(b1, Math.min(L, crossing(M, T2) ?? L));
		return { b1, b2 };
	};
	const pct = (x: number, L: number) => Math.round((x / L) * 100);
	const shareA = $derived(bands(state.a.M, LA));
	const shareB = $derived(bands(state.b.M, LB));
	const cellLines = (L: number, y: number) => {
		let d = '';
		for (let x = NUCLEUS_SPACING; x < L; x += NUCLEUS_SPACING)
			d += `M${px(x).toFixed(1)} ${y + 3}V${y + ROW_H - 3}`;
		return d;
	};

	// ---- chart -----------------------------------------------------------------------------------
	const CH_TOP = 286;
	const CH_BOT = 528;
	const sx = $derived(scale([0, LB], [X0, X0 + W]));
	const sy = scale([0, 110], [CH_BOT, CH_TOP]);
	const eMax = $derived(niceMax(Math.max(1, 0.6 * stretch * 2)));
	const se = $derived(scale([0, eMax], [CH_BOT, CH_TOP]));
	const path = (v: Float64Array, s: (x: number) => number) => {
		let d = '';
		for (let i = 0; i < v.length; i += 2)
			d += `${i ? 'L' : 'M'}${sx((i + 0.5) * DX).toFixed(1)} ${s(v[i]).toFixed(1)}`;
		return d;
	};
	const curves = $derived([
		{ id: 'a', M: path(state.a.M, sy), E: path(state.a.E, se), w: 2, o: 0.65 },
		{ id: 'b', M: path(state.b.M, sy), E: path(state.b.E, se), w: 3, o: 1 }
	]);
	const lamA = $derived(fitLength(state.a.M));
	const lamB = $derived(fitLength(state.b.M));
	const clock = $derived.by(() => {
		const h = state.t / 3600;
		return h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`;
	});
	const shareText = (s: { b1: number; b2: number }, L: number) =>
		`blue ${pct(s.b1, L)} % · white ${pct(s.b2 - s.b1, L)} % · red ${100 - pct(s.b1, L) - pct(s.b2 - s.b1, L)} %`;
</script>

<g>
	{#each rows as r (r.id)}
		{@const s = r.id === 'a' ? shareA : shareB}
		<rect x={px(0) - 26} y={r.y + 5} width="20" height={ROW_H - 10} rx="5" fill="var(--mg-morph)" />
		<rect x={px(0)} y={r.y} width={s.b1 * k} height={ROW_H} fill="var(--mg-blue)" />
		<rect x={px(s.b1)} y={r.y} width={(s.b2 - s.b1) * k} height={ROW_H} fill="var(--mg-white)" />
		<rect x={px(s.b2)} y={r.y} width={(r.L - s.b2) * k} height={ROW_H} fill="var(--mg-red)" />
		<path d={cellLines(r.L, r.y)} stroke="var(--mg-cell-edge)" stroke-width="0.6" opacity="0.5" />
		<rect
			x={px(0)}
			y={r.y}
			width={r.L * k}
			height={ROW_H}
			rx="4"
			fill="none"
			stroke="var(--mg-cell-edge)"
			stroke-width="1.2"
		/>
		<Readout
			id="len-{r.id}"
			order={r.id === 'a' ? 1 : 2}
			label="{r.L} µm tissue"
			value={shareText(s, r.L)}
		>
			<Label x={px(0)} y={r.y - 10} text="{r.L} µm" size={13} weight={600} anchor="start" />
			<Label x={px(r.L)} y={r.y - 10} text={shareText(s, r.L)} size={12} anchor="end" tabular />
		</Readout>
	{/each}

	<!-- where the short tissue's boundaries would fall in the long one, if the pattern scaled -->
	{#each [shareA.b1, shareA.b2] as b, i (i)}
		{@const x = px((b / LA) * LB)}
		<path d="M{x} {150 + ROW_H + 3} l-6 10 h12 Z" fill="var(--stage-ink)" opacity="0.8" />
	{/each}
	<Readout id="scaled-key">
		<Label
			x={px(0)}
			y={150 + ROW_H + 30}
			text="▲ where the boundaries would be if the pattern kept the {LA} µm tissue's proportions"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- chart -->
	<Axes {sx} {sy} xLabel="distance from the source (µm)" yLabel="morphogen" />
	{#if on}
		<Axes {sx} sy={se} yRight xTicks={[]} yLabel="expander" grid={false} />
	{/if}
	{#each [T1, T2] as T, i (i)}
		<line
			x1={X0}
			x2={X0 + W}
			y1={sy(T)}
			y2={sy(T)}
			stroke={i === 0 ? 'var(--mg-blue)' : 'var(--mg-red)'}
			stroke-width="1"
			opacity="0.6"
		/>
	{/each}
	{#each curves as c (c.id)}
		{#if on}
			<path
				d={c.E}
				fill="none"
				stroke="var(--mg-expander)"
				stroke-width={c.w}
				stroke-dasharray="7 5"
				opacity={c.o}
			/>
		{/if}
		<path d={c.M} fill="none" stroke="var(--mg-morph)" stroke-width={c.w} opacity={c.o} />
	{/each}

	<Readout
		id="lam"
		order={3}
		label="Fitted λ"
		value="{Math.round(lamA)} µm and {Math.round(lamB)} µm"
	>
		<Label
			x={X0}
			y={234}
			text="λ: {Math.round(lamA)} µm in the {LA} µm tissue, {Math.round(
				lamB
			)} µm in the {LB} µm one"
			size={13}
			weight={600}
			anchor="start"
			tabular
			color="var(--mg-morph-text)"
		/>
	</Readout>
	{#if focus === 'expander'}
		<Readout id="clock" order={4} label="Circuit" value={on ? `on for ${clock}` : 'off'}>
			<Label
				x={X0}
				y={256}
				text={on ? `expansion–repression on for ${clock}` : 'expansion–repression off'}
				size={12}
				anchor="start"
				tabular
			/>
		</Readout>
		{#if on}
			<Readout id="e-key">
				<Label
					x={X0 + W}
					y={256}
					text="dashed: expander; its production is halved where the morphogen is 2"
					size={11}
					anchor="end"
					color="var(--mg-expander-text)"
				/>
			</Readout>
		{/if}
	{/if}
</g>
