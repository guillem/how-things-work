<script lang="ts">
	/**
	 * The Chinchilla parametric law L(N, D) = E + A/N^α + B/D^β, with C = 6ND.
	 *
	 * Views (`step.hints.view`): `isoflop` draws the fitted loss against model size along fixed
	 * compute budgets (IsoFLOP slices, 10¹⁸ to 10²⁶ operations), each with its lowest point, the
	 * frontier through those points and the floor E; `plane` draws the model-size × tokens plane
	 * with iso-loss contours, iso-compute lines (straight, slope −1 on log-log axes) and the
	 * compute-optimal frontier. Focus (`step.hints.focus`): `revised` draws the frontiers of all
	 * three fits; `overtrain` brings the known models forward. The shaded band is the range of
	 * models and tokens Hoffmann et al. fitted.
	 */
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CHINCHILLA_RANGE,
		computeOf,
		FITS,
		isoFlop,
		lossOf,
		MODELS,
		optimum,
		type ParametricFit
	} from '../laws';
	import { budgetOf, fitOf, int, nats, pow10, sci, short } from './shared';

	let { step, params }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'isoflop'));
	const focus = $derived(String(step.hints?.focus ?? ''));
	const fit = $derived(fitOf(params));
	const C = $derived(budgetOf(params));
	const best = $derived(optimum(fit, C));

	const plane = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = view === 'plane' ? 1 : 0;
		untrack(() => plane.set(v));
	});

	const CH = { x: 92, y: 40, w: 520, h: 440 };
	const N_LO = 7;
	const N_HI = 13;
	const sx = scale([N_LO, N_HI], [CH.x, CH.x + CH.w]);
	const xTicks = [7, 8, 9, 10, 11, 12, 13];
	const xFormat = (v: number) => short(10 ** v);

	// ---- IsoFLOP view
	const L_LO = 1.6;
	const L_HI = 4.2;
	const syL = scale([L_LO, L_HI], [CH.y + CH.h, CH.y]);
	const GRID = Array.from({ length: 121 }, (_, i) => N_LO + (i * (N_HI - N_LO)) / 120);
	const BUDGETS = [18, 19, 20, 21, 22, 23, 24, 25, 26];
	const clampL = (l: number) => Math.min(L_HI + 0.5, l);
	function slicePath(f: ParametricFit, c: number) {
		return isoFlop(f, c, GRID)
			.map(
				(p, i) =>
					`${i ? 'L' : 'M'}${sx(Math.log10(p.N)).toFixed(1)},${syL(clampL(p.loss)).toFixed(1)}`
			)
			.join('');
	}
	const slices = $derived(
		BUDGETS.map((lc) => {
			const o = optimum(fit, 10 ** lc);
			return { lc, d: slicePath(fit, 10 ** lc), o };
		})
	);
	const current = $derived(slicePath(fit, C));
	const FRONT = Array.from({ length: 33 }, (_, i) => 18 + i * 0.25);
	const frontierL = $derived(
		FRONT.map((lc, i) => {
			const o = optimum(fit, 10 ** lc);
			return `${i ? 'L' : 'M'}${sx(Math.log10(o.N)).toFixed(1)},${syL(o.loss).toFixed(1)}`;
		}).join('')
	);

	// ---- plane view
	const D_LO = 8;
	const D_HI = 15;
	const syD = scale([D_LO, D_HI], [CH.y + CH.h, CH.y]);
	const yTicksD = [8, 9, 10, 11, 12, 13, 14, 15];
	const LEVELS = [1.9, 2.0, 2.2, 2.5, 3.0];
	/** An iso-loss contour: for each N, the D that brings the fitted loss down to `level`. */
	function contour(f: ParametricFit, level: number) {
		let d = '';
		let pen = false;
		let last: [number, number] | null = null;
		for (let i = 0; i <= 240; i++) {
			const lg = N_LO + (i * (N_HI - N_LO)) / 240;
			const rem = level - f.E - f.A / 10 ** (f.alpha * lg);
			if (rem <= 0) {
				pen = false;
				continue;
			}
			const lD = Math.log10(f.B / rem) / f.beta;
			if (lD > D_HI + 0.3) {
				pen = false;
				continue;
			}
			d += `${pen ? 'L' : 'M'}${sx(lg).toFixed(1)},${syD(Math.max(D_LO - 0.3, lD)).toFixed(1)}`;
			pen = true;
			if (lD >= D_LO && lD <= D_HI) last = [lg, lD];
		}
		return { d, last };
	}
	const contours = $derived(LEVELS.map((l) => ({ level: l, ...contour(fit, l) })));
	const isoLine = (lc: number) => {
		// D = C/(6N): log D = lc − log 6 − log N
		const at = (lg: number) => lc - Math.log10(6) - lg;
		return `M${sx(N_LO)},${syD(at(N_LO))}L${sx(N_HI)},${syD(at(N_HI))}`;
	};
	const frontierOf = (f: ParametricFit) =>
		FRONT.map((lc, i) => {
			const o = optimum(f, 10 ** lc);
			return `${i ? 'L' : 'M'}${sx(Math.log10(o.N)).toFixed(1)},${syD(Math.log10(o.D)).toFixed(1)}`;
		}).join('');
	const FIT_COLOR: Record<string, string> = {
		hoffmann: 'var(--sl-hoffmann)',
		'hoffmann-tex': 'var(--sl-hoffmann-tex)',
		besiroglu: 'var(--sl-besiroglu)'
	};
	const frontiers = $derived(
		FITS.map((f) => ({
			f,
			d: frontierOf(f),
			end: optimum(f, 1e26),
			on: f.id === fit.id
		}))
	);
	const range = {
		x0: sx(Math.log10(CHINCHILLA_RANGE.N[0])),
		x1: sx(Math.log10(CHINCHILLA_RANGE.N[1]))
	};
	const rangeD = {
		y0: syD(Math.log10(CHINCHILLA_RANGE.D[1])),
		y1: syD(Math.log10(CHINCHILLA_RANGE.D[0]))
	};

	const models = $derived(
		MODELS.map((m) => ({
			...m,
			x: sx(Math.log10(m.N)),
			y: syD(Math.log10(m.D)),
			loss: lossOf(fit, m.N, m.D),
			ratio: m.D / m.N
		}))
	);
	const LABEL_AT: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' }> = {
		gpt3: { dx: -8, dy: 16, anchor: 'end' },
		gopher: { dx: 8, dy: 16, anchor: 'start' },
		chinchilla: { dx: 9, dy: 4, anchor: 'start' },
		'llama3-8b': { dx: -9, dy: 4, anchor: 'end' },
		'llama3-70b': { dx: 9, dy: 4, anchor: 'start' }
	};
	const modelsOn = $derived(focus === 'overtrain' ? 1 : 0.55);
	const llama = $derived(models.find((m) => m.id === 'llama3-8b')!);
	const llamaBest = $derived(optimum(fit, computeOf(llama.N, llama.D)));

	const formula = $derived(`L = ${fit.E} + ${fit.A} / N^${fit.alpha} + ${fit.B} / D^${fit.beta}`);
	const formula1 = $derived(`L = ${fit.E} + ${fit.A} / N^${fit.alpha}`);
	const formula2 = $derived(`    + ${fit.B} / D^${fit.beta}`);
	/** The three fits' optima at the current budget, for the legend of the revised step. */
	const compare = $derived(FITS.map((f) => ({ f, o: optimum(f, C) })));
	const bx = $derived(sx(Math.log10(best.N)));
</script>

<g>
	<defs>
		<clipPath id="chin-clip">
			<rect x={CH.x} y={CH.y} width={CH.w} height={CH.h} />
		</clipPath>
	</defs>

	<!-- ===================== IsoFLOP slices ===================== -->
	{#if plane.current < 0.999}
		<g opacity={1 - plane.current}>
			<Axes
				{sx}
				sy={syL}
				{xTicks}
				{xFormat}
				yTicks={[1.6, 2, 2.4, 2.8, 3.2, 3.6, 4]}
				yFormat={(v: number) => v.toFixed(1)}
				xLabel="parameters N"
				yLabel="fitted loss (nats per token)"
			/>
			<rect
				x={range.x0}
				y={CH.y}
				width={range.x1 - range.x0}
				height={CH.h}
				fill="var(--sl-range)"
				opacity="0.5"
			/>
			<Readout id="range" order={9}>
				<Label
					x={(range.x0 + range.x1) / 2}
					y={CH.y + 16}
					size={11}
					muted
					text="models Hoffmann et al. trained"
				/>
			</Readout>
			<line
				x1={CH.x}
				x2={CH.x + CH.w}
				y1={syL(fit.E)}
				y2={syL(fit.E)}
				stroke="var(--sl-floor)"
				stroke-width="1.5"
				stroke-dasharray="6 4"
			/>
			<Readout id="floor" order={5} label="Floor E" value="{fit.E} nats per token">
				<Label
					x={CH.x + CH.w - 8}
					y={syL(fit.E) + 16}
					anchor="end"
					size={11}
					color="var(--sl-floor)"
					text="floor E = {fit.E}: the fitted loss approaches it"
				/>
			</Readout>
			<g clip-path="url(#chin-clip)">
				{#each slices as s (s.lc)}
					<path d={s.d} fill="none" stroke="var(--sl-slice)" stroke-width="1.3" />
				{/each}
				<path
					d={frontierL}
					fill="none"
					stroke={FIT_COLOR[fit.id]}
					stroke-width="2"
					stroke-dasharray="5 3"
				/>
				<path d={current} fill="none" stroke="var(--sl-budget)" stroke-width="3" />
				{#each slices as s (s.lc)}
					<circle cx={sx(Math.log10(s.o.N))} cy={syL(s.o.loss)} r="3" fill={FIT_COLOR[fit.id]} />
				{/each}
			</g>
			{#each slices as s (s.lc)}
				{#if syL(s.o.loss) > CH.y + 30}
					<Readout id="lc{s.lc}">
						<Label
							x={sx(Math.log10(s.o.N)) + 7}
							y={syL(s.o.loss) - 7}
							anchor="start"
							size={10.5}
							muted
							text={pow10(s.lc)}
						/>
					</Readout>
				{/if}
			{/each}
			<circle
				cx={bx}
				cy={syL(best.loss)}
				r="6.5"
				fill="var(--sl-budget)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		</g>
	{/if}

	<!-- ===================== the N × D plane ===================== -->
	{#if plane.current > 0.001}
		<g opacity={plane.current}>
			<Axes
				{sx}
				sy={syD}
				{xTicks}
				{xFormat}
				yTicks={yTicksD}
				yFormat={(v) => short(10 ** v)}
				xLabel="parameters N"
				yLabel="training tokens D"
			/>
			<rect
				x={range.x0}
				y={rangeD.y0}
				width={range.x1 - range.x0}
				height={rangeD.y1 - rangeD.y0}
				fill="var(--sl-range)"
				opacity="0.6"
				rx="4"
			/>
			<Readout id="range-p" order={9}>
				<Label
					x={range.x0 + 6}
					y={rangeD.y0 + 16}
					anchor="start"
					size={11}
					muted
					text="fitted here"
				/>
			</Readout>
			<g clip-path="url(#chin-clip)">
				{#each BUDGETS as lc (lc)}
					<path d={isoLine(lc)} stroke="var(--sl-slice)" stroke-width="1" stroke-dasharray="3 4" />
				{/each}
				<path d={isoLine(Math.log10(C))} stroke="var(--sl-budget)" stroke-width="2.5" />
				{#each contours as c (c.level)}
					<path d={c.d} fill="none" stroke="var(--sl-contour)" stroke-width="1.4" />
				{/each}
				{#each frontiers as fr (fr.f.id)}
					{#if fr.on || focus === 'revised'}
						<path
							d={fr.d}
							fill="none"
							stroke={FIT_COLOR[fr.f.id]}
							stroke-width={fr.on ? 3 : 2}
							opacity={fr.on ? 1 : 0.7}
						/>
					{/if}
				{/each}
			</g>
			{#each contours as c (c.level)}
				{#if c.last}
					<Readout id="lvl{c.level}">
						<Label
							x={sx(c.last[0]) - 4}
							y={syD(c.last[1]) - 6}
							anchor="end"
							size={10.5}
							color="var(--sl-contour)"
							text="L = {c.level.toFixed(1)}"
						/>
					</Readout>
				{/if}
			{/each}
			{#each models as m (m.id)}
				<g opacity={modelsOn}>
					<circle
						cx={m.x}
						cy={m.y}
						r="4.5"
						fill="var(--sl-model)"
						stroke="var(--stage-bg)"
						stroke-width="1.5"
					/>
					<Readout id="m-{m.id}">
						<Label
							x={m.x + LABEL_AT[m.id].dx}
							y={m.y + LABEL_AT[m.id].dy}
							anchor={LABEL_AT[m.id].anchor}
							size={11}
							color="var(--sl-model)"
							text={m.name}
						/>
					</Readout>
				</g>
			{/each}
			<circle
				cx={bx}
				cy={syD(Math.log10(best.D))}
				r="6.5"
				fill="var(--sl-budget)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		</g>
	{/if}

	<!-- ===================== read-outs ===================== -->
	<Readout id="card0">
		<rect
			x="640"
			y={CH.y}
			width="304"
			height={focus === 'overtrain' && view === 'plane' ? 316 : focus === 'revised' ? 330 : 250}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout id="fit" order={0} label="Fit" value={fit.name}>
		<Label x={656} y={CH.y + 24} anchor="start" size={13} weight={650} text={fit.name} />
	</Readout>
	<Readout id="formula" order={1} label="Law" value={formula}>
		<Label x={656} y={CH.y + 46} anchor="start" size={11.5} mono text={formula1} />
		<Label x={656} y={CH.y + 62} anchor="start" size={11.5} mono text={formula2} />
	</Readout>
	<Readout id="budget" order={2} label="Budget" value="{sci(C)} operations">
		<Label
			x={656}
			y={CH.y + 94}
			anchor="start"
			size={12}
			tabular
			text="budget C = {sci(C)} operations"
		/>
	</Readout>
	<Readout
		id="best"
		order={3}
		label="Lowest loss for it"
		value="N = {short(best.N)} parameters on D = {short(best.D)} tokens"
		color="var(--sl-budget)"
	>
		<Label
			x={656}
			y={CH.y + 120}
			anchor="start"
			size={13}
			weight={650}
			color="var(--sl-budget)"
			tabular
			text="N = {short(best.N)} parameters"
		/>
		<Label
			x={656}
			y={CH.y + 142}
			anchor="start"
			size={13}
			weight={650}
			color="var(--sl-budget)"
			tabular
			text="D = {short(best.D)} tokens"
		/>
	</Readout>
	<Readout
		id="ratio"
		order={4}
		label="Tokens per parameter"
		value="{best.tokensPerParameter.toFixed(0)} · fitted loss {nats(best.loss)}"
	>
		<Label
			x={656}
			y={CH.y + 168}
			anchor="start"
			size={12}
			tabular
			text="{best.tokensPerParameter.toFixed(0)} tokens per parameter"
		/>
		<Label
			x={656}
			y={CH.y + 190}
			anchor="start"
			size={12}
			tabular
			text="fitted loss {nats(best.loss)} nats per token"
		/>
	</Readout>
	<Readout id="note">
		<Label
			x={656}
			y={CH.y + 218}
			anchor="start"
			size={11}
			muted
			text="C ≈ 6 × N × D floating-point operations"
		/>
		<Label
			x={656}
			y={CH.y + 234}
			anchor="start"
			size={11}
			muted
			text="loss on Hoffmann et al.'s text, its tokens"
		/>
	</Readout>
	{#if view === 'plane' && focus === 'revised'}
		<Readout id="cmp-title">
			<Label
				x={656}
				y={CH.y + 262}
				anchor="start"
				size={11}
				muted
				text="best split at this budget, by fit:"
			/>
		</Readout>
		{#each compare as c, i (c.f.id)}
			<Readout
				id="cmp-{c.f.id}"
				order={6 + i}
				label={c.f.name}
				value="{short(c.o.N)} on {short(c.o.D)}, {c.o.tokensPerParameter.toFixed(
					0
				)} tokens per parameter"
				color={FIT_COLOR[c.f.id]}
			>
				<line
					x1={656}
					x2={676}
					y1={CH.y + 278 + i * 18}
					y2={CH.y + 278 + i * 18}
					stroke={FIT_COLOR[c.f.id]}
					stroke-width="3"
				/>
				<Label
					x={684}
					y={CH.y + 282 + i * 18}
					anchor="start"
					size={11.5}
					weight={c.f.id === fit.id ? 650 : 500}
					tabular
					text="{c.f.id === 'hoffmann'
						? 'printed'
						: c.f.id === 'besiroglu'
							? 'refit'
							: 'unrounded'}: {short(c.o.N)}, {c.o.tokensPerParameter.toFixed(0)} per parameter"
				/>
			</Readout>
		{/each}
	{/if}
	{#if view === 'plane' && focus === 'overtrain'}
		<Readout
			id="llama"
			order={6}
			label="Llama 3 8B (15T tokens)"
			value="{short(llama.ratio)} tokens per parameter · fitted loss {nats(
				llama.loss
			)}; best for its compute: {short(llamaBest.N)} on {short(llamaBest.D)}, {nats(
				llamaBest.loss
			)}"
		>
			<Label
				x={656}
				y={CH.y + 266}
				anchor="start"
				size={12}
				weight={650}
				color="var(--sl-model)"
				text="Llama 3 8B: {int(llama.ratio)} tokens per parameter"
			/>
			<Label
				x={656}
				y={CH.y + 286}
				anchor="start"
				size={11.5}
				tabular
				text="fitted loss {nats(llama.loss)}; same compute at the"
			/>
			<Label
				x={656}
				y={CH.y + 303}
				anchor="start"
				size={11.5}
				tabular
				text="optimum ({short(llamaBest.N)} on {short(llamaBest.D)}): {nats(llamaBest.loss)}"
			/>
		</Readout>
	{/if}
</g>
