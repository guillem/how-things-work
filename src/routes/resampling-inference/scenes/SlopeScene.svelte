<script lang="ts">
	/**
	 * The bootstrap of a regression slope: body mass against flipper length for one species,
	 * the least-squares line, and the lines fitted to resamples of the penguins (each penguin's
	 * flipper and mass drawn together), with the histogram of their slopes and its 95%
	 * percentile interval below.
	 *
	 * The run: `bootstrapSlopes(x, y, RESAMPLES, seed)`; resample k is `resampleCounts(n, seed,
	 * k)`, drawn over the points (a penguin drawn c times gets a bigger dot, one left out stays
	 * hollow). Resample k counts once k / RATE seconds have passed; every PERIOD seconds the newest
	 * one is drawn. The faint fan shows the latest FAN resamples' lines. The run restarts when the
	 * species, the sample size or the redraw count change.
	 * Reduced motion: every resample counted; resample 0 drawn.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bootstrapSlopes,
		massVsFlipper,
		ols,
		percentileInterval,
		pick,
		resampleCounts,
		sdOf,
		type Species
	} from '../resample';
	import { fmt } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const RESAMPLES = 1000;
	const RATE = 80;
	const PERIOD = 2.2;
	const FAN = 30;
	const BINS = 40;

	const species = $derived(
		(['Adelie', 'Chinstrap', 'Gentoo'].includes(String(params.species))
			? String(params.species)
			: 'Adelie') as Species
	);
	const per = $derived(String(params.perSpecies ?? 'all'));
	const seed = $derived(1 + Number(params.redraw ?? 0));
	const all = $derived(massVsFlipper(species));
	const data = $derived.by(() => {
		const idx = pick(
			all.x.map((_, i) => i),
			per === 'all' ? Infinity : Number(per),
			seed
		);
		return { x: idx.map((i) => all.x[i]), y: idx.map((i) => all.y[i]) };
	});
	const n = $derived(data.x.length);
	const fit = $derived(ols(data.x, data.y));
	const slopes = $derived(bootstrapSlopes(data.x, data.y, RESAMPLES, seed));
	const key = $derived(`${species}|${per}|${seed}`);

	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (key !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = key;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});
	const taken = $derived(Math.min(RESAMPLES, Math.max(1, Math.floor(elapsed * RATE))));
	const sofar = $derived(slopes.subarray(0, taken).filter((v) => !Number.isNaN(v)));
	const bootSe = $derived(sofar.length > 2 ? sdOf(sofar) : NaN);
	/** Resamples with a single flipper length have no slope; then no honest interval either. */
	const undefinedSlopes = $derived(taken - sofar.length);
	const ci = $derived(
		sofar.length >= 40 && undefinedSlopes === 0 ? percentileInterval(sofar) : null
	);

	// ---- geometry: the scatter plot ------------------------------------------------------------------
	const X0 = 96;
	const X1 = 580;
	const Y0 = 40;
	const Y1 = 290;
	/** Axis ranges from every penguin of all three species, so a switch keeps the frame. */
	const sx = scale([170, 235], [X0, X1]);
	const sy = scale([2500, 6500], [Y1, Y0]);
	const lineEnds = (slope: number, intercept: number) => {
		const xa = Math.min(...data.x) - 2;
		const xb = Math.max(...data.x) + 2;
		return {
			x1: sx(xa),
			y1: sy(intercept + slope * xa),
			x2: sx(xb),
			y2: sy(intercept + slope * xb)
		};
	};
	const clipId = 'slope-clip';

	const resampleFit = (k: number) => {
		const c = resampleCounts(n, seed, k);
		return { c, f: ols(data.x, data.y, c) };
	};
	const fan = $derived.by(() => {
		const out: { k: number; e: ReturnType<typeof lineEnds> }[] = [];
		for (let k = Math.max(0, taken - FAN); k < taken; k++) {
			const f = resampleFit(k).f;
			if (Number.isFinite(f.slope)) out.push({ k, e: lineEnds(f.slope, f.intercept) });
		}
		return out;
	});
	const show = $derived.by(() => {
		const cyc = reduced ? 0 : Math.floor(elapsed / PERIOD);
		const u = reduced ? 1 : elapsed - cyc * PERIOD;
		const k = reduced ? 0 : Math.min(taken - 1, Math.floor(cyc * PERIOD * RATE));
		const { c, f } = resampleFit(k);
		const amt = reduced ? 1 : smoothstep(0.1, 0.5, u) * (1 - smoothstep(1.9, 2.2, u));
		return { k, c, f, amt };
	});
	const pts = $derived(data.x.map((x, i) => ({ i, x: sx(x), y: sy(data.y[i]), c: show.c[i] })));
	const rDot = $derived(n > 60 ? 2.6 : 4);

	// ---- the histogram of slopes ------------------------------------------------------------------------
	const H_TOP = 388;
	const H_BOT = 520;
	const D = $derived.by(() => {
		// wide enough for 99% of all the resamples (the rare ones beyond are left out)
		const [q0, q1] = percentileInterval(slopes, 0.99);
		const need = Math.max(4.4 * fit.se, 1.05 * (fit.slope - q0), 1.05 * (q1 - fit.slope), 5);
		return Math.ceil(need / 5) * 5;
	});
	const hx = $derived(scale([fit.slope - D, fit.slope + D], [X0, X1]));
	const binW = $derived((2 * D) / BINS);
	/** The bin of a slope, or −1 beyond the histogram. */
	const binOf = (s: number) => {
		const b = Math.floor((s - fit.slope + D) / binW);
		return b >= 0 && b < BINS ? b : -1;
	};
	const bins = $derived.by(() => {
		const full = new Int32Array(BINS);
		for (const s of slopes) if (binOf(s) >= 0) full[binOf(s)]++;
		const now = new Int32Array(BINS);
		for (const s of sofar) if (binOf(s) >= 0) now[binOf(s)]++;
		return { full, now };
	});
	const unit = $derived(((H_BOT - H_TOP) * 0.85) / Math.max(1, ...bins.full));
	const BIN_IDS = Array.from({ length: BINS }, (_, i) => i);

	const PL = 636;
	const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '…');
</script>

<g>
	<defs>
		<clipPath id={clipId}>
			<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
		</clipPath>
	</defs>
	<Axes {sx} {sy} xLabel="flipper length (mm)" yLabel="body mass (g)" />

	<g clip-path="url(#{clipId})">
		{#each fan as l (l.k)}
			<line {...l.e} stroke="var(--ri-boot)" stroke-width="1.2" opacity="0.28" />
		{/each}
	</g>
	{#each pts as p (p.i)}
		<circle
			cx={p.x}
			cy={p.y}
			r={p.c > 0 ? rDot + (p.c - 1) * 1.6 * show.amt : rDot}
			fill="var(--ri-a)"
			fill-opacity={p.c > 0 ? 0.25 + 0.6 * show.amt : 0.25 * (1 - show.amt)}
			stroke="var(--ri-a)"
			stroke-width="1"
			stroke-opacity={p.c > 0 ? 0.9 : 0.9 - 0.5 * show.amt}
		/>
	{/each}
	<g clip-path="url(#{clipId})">
		{#if Number.isFinite(show.f.slope)}
			<line
				{...lineEnds(show.f.slope, show.f.intercept)}
				stroke="var(--ri-boot)"
				stroke-width="2.5"
				opacity={show.amt}
			/>
		{/if}
		<line {...lineEnds(fit.slope, fit.intercept)} stroke="var(--stage-ink)" stroke-width="2.5" />
	</g>
	<Readout id="legend">
		<line
			x1={X0 + 14}
			x2={X0 + 40}
			y1={Y0 + 18}
			y2={Y0 + 18}
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
		<Label
			x={X0 + 48}
			y={Y0 + 22}
			anchor="start"
			size={12}
			text="least squares, {n} {species} penguins"
		/>
		<line
			x1={X0 + 14}
			x2={X0 + 40}
			y1={Y0 + 40}
			y2={Y0 + 40}
			stroke="var(--ri-boot)"
			stroke-width="2.5"
		/>
		<Label x={X0 + 48} y={Y0 + 44} anchor="start" size={12} text="fitted to resamples" />
	</Readout>

	<!-- the slopes -->
	<Axes
		sx={hx}
		sy={scale([0, 1], [H_BOT, H_TOP])}
		yTicks={[]}
		xLabel="bootstrap slope (g per mm)"
		grid={false}
	/>
	{#if ci}
		<rect
			x={hx(ci[0])}
			y={H_TOP - 6}
			width={hx(ci[1]) - hx(ci[0])}
			height={H_BOT - H_TOP + 6}
			fill="var(--ri-boot)"
			opacity="0.1"
		/>
	{/if}
	{#each BIN_IDS as b (b)}
		{#if bins.now[b] > 0}
			{@const x = hx(fit.slope - D + b * binW)}
			{@const w = hx(fit.slope - D + (b + 1) * binW) - x}
			<rect
				x={x + 0.5}
				y={H_BOT - bins.now[b] * unit}
				width={Math.max(1, w - 1)}
				height={bins.now[b] * unit}
				rx="1.5"
				fill="var(--ri-boot)"
				opacity="0.8"
			/>
		{/if}
	{/each}
	<line
		x1={hx(fit.slope)}
		x2={hx(fit.slope)}
		y1={H_TOP - 6}
		y2={H_BOT}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-dasharray="4 3"
	/>
	{#if ci}
		{#each [{ id: 'lo', v: ci[0], q: '2.5%' }, { id: 'hi', v: ci[1], q: '97.5%' }] as e (e.id)}
			<line
				x1={hx(e.v)}
				x2={hx(e.v)}
				y1={H_TOP - 14}
				y2={H_BOT}
				stroke="var(--ri-boot)"
				stroke-width="2.5"
			/>
			<Readout id="ci-{e.id}">
				<Label
					x={hx(e.v)}
					y={H_TOP - 20}
					anchor={e.id === 'lo' ? 'end' : 'start'}
					size={12}
					weight={600}
					color="var(--ri-boot)"
					text="{e.q}: {f1(e.v)}"
				/>
			</Readout>
		{/each}
	{/if}

	<!-- panel -->
	<Readout
		id="slope"
		order={1}
		label="Slope"
		value="{f1(fit.slope)} g per mm"
		note="{n} {species} penguins"
	>
		<Label x={PL} y={60} anchor="start" muted text="slope of the line" />
		<Label
			x={PL}
			y={88}
			anchor="start"
			size={24}
			weight={700}
			tabular
			text="{f1(fit.slope)} g per mm"
		/>
		<Label x={PL} y={110} anchor="start" size={12} muted text="{n} {species} penguins" />
	</Readout>
	<Readout id="resamples" order={2} label="Resamples" value="{fmt(taken)} of {fmt(RESAMPLES)}">
		<Label x={PL} y={170} anchor="start" muted text="resamples" />
		<Label
			x={PL}
			y={196}
			anchor="start"
			size={22}
			weight={600}
			tabular
			text="{fmt(taken)} of {fmt(RESAMPLES)}"
		/>
		<Label
			x={PL}
			y={218}
			anchor="start"
			size={12}
			muted
			tabular
			text="this one: {f1(show.f.slope)} g per mm"
		/>
	</Readout>
	<Readout
		id="se"
		order={3}
		label="Standard error"
		value="{f1(bootSe)} g per mm"
		note="textbook formula {f1(fit.se)}"
	>
		<Label x={PL} y={278} anchor="start" muted text="standard error of the slope" />
		<Label
			x={PL}
			y={302}
			anchor="start"
			size={14}
			weight={600}
			tabular
			text="bootstrap spread  {f1(bootSe)}"
		/>
		<Label
			x={PL}
			y={324}
			anchor="start"
			size={12}
			muted
			tabular
			text="textbook formula  {f1(fit.se)}"
		/>
	</Readout>
	<Readout
		id="ci"
		order={4}
		label="95% percentile interval"
		value={ci ? `${f1(ci[0])} to ${f1(ci[1])} g per mm` : '…'}
		color="var(--ri-boot)"
	>
		<Label x={PL} y={388} anchor="start" muted text="95% percentile interval" />
		<Label
			x={PL}
			y={416}
			anchor="start"
			size={22}
			weight={700}
			tabular
			color="var(--ri-boot)"
			text={ci ? `${f1(ci[0])} to ${f1(ci[1])}` : '…'}
		/>
		<Label
			x={PL}
			y={438}
			anchor="start"
			size={12}
			muted
			text={undefinedSlopes > 0
				? `${undefinedSlopes} resamples had one flipper length: no slope`
				: 'g of body mass per mm of flipper'}
		/>
	</Readout>
</g>
