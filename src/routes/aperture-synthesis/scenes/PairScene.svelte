<script lang="ts">
	/**
	 * Two dishes params.baseline metres apart (left, schematic: angles not to scale), their fringes
	 * on a strip of sky with the source(s) on it (top right), and the correlator's output over the
	 * last 10 s (bottom right). As the Earth turns the fringes sweep over the sky at a constant
	 * angular rate (1.2′ a second, sped up), so longer baselines swing faster. step.hints.mode:
	 *   fringe — one source of 1 Jy
	 *   double — two equal sources params.separation arcmin apart, and |V| against baseline
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ARCMIN, LAMBDA, correlator, visibility1D, type Source1D } from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'fringe'));
	const tt = $derived(reduced ? 2.5 : t);

	const b = $derived(Number(params.baseline ?? 200));
	const u = $derived(b / LAMBDA);
	const sepArc = $derived(Number(params.separation ?? 3));
	const sources = $derived<Source1D[]>(
		mode === 'double'
			? [
					{ l: (-sepArc / 2) * ARCMIN, flux: 1 },
					{ l: (sepArc / 2) * ARCMIN, flux: 1 }
				]
			: [{ l: 0, flux: 1 }]
	);
	const RATE = 1.2 * ARCMIN; // drift of the fringes over the sky, rad per second of animation
	const drift = (time: number) => -RATE * time;
	const output = $derived(correlator(sources, u, drift(tt)));
	const V = $derived(visibility1D(sources, u));
	const amp = $derived(Math.hypot(V.re, V.im));
	const spacingArc = $derived(LAMBDA / b / ARCMIN);

	// ---- left: the geometry ----------------------------------------------------------------
	const GX = 250;
	const GROUND = 400;
	const sepPx = $derived(60 + ((b - 50) / 550) * 300);
	const xa = $derived(GX - sepPx / 2);
	const xb = $derived(GX + sepPx / 2);
	const TH = (22 * Math.PI) / 180; // drawn direction to the source, from the vertical
	const dir = { x: -Math.sin(TH), y: -Math.cos(TH) }; // towards the source (up and left)
	const perp = { x: Math.cos(TH), y: -Math.sin(TH) };
	const WAVE = 38; // drawn wavelength, px
	const wavefronts = $derived.by(() => {
		// wavefronts: lines perpendicular to dir, moving along −dir; distance from dish B's focus
		const phase = (tt * 0.9) % 1;
		const out: { x1: number; y1: number; x2: number; y2: number; o: number }[] = [];
		for (let k = 0; k < 7; k++) {
			const d = (k + 1 - phase) * WAVE; // distance from B along dir
			const cx = xb + dir.x * d;
			const cy = GROUND - 30 + dir.y * d;
			const half = 230;
			out.push({
				x1: cx - perp.x * half,
				y1: cy - perp.y * half,
				x2: cx + perp.x * half,
				y2: cy + perp.y * half,
				o: Math.min(1, (7 - k) / 3) * Math.min(1, (k + 1 - phase) / 1)
			});
		}
		return out;
	});
	// extra path: from dish A, along dir, to the wavefront through dish B
	const extra = $derived(sepPx * Math.sin(TH));
	// the wave reaches dish A (nearer the source) first: B's signal travels b sin θ further
	const exA = $derived({ x: xb, y: GROUND - 30 });
	const exB = $derived({ x: xb + dir.x * extra, y: GROUND - 30 + dir.y * extra });

	function dishPath(x: number) {
		const y = GROUND - 30;
		return `M${x - 22} ${y - 14} Q ${x} ${y + 14} ${x + 22} ${y - 14}`;
	}

	// ---- right top: the sky strip ------------------------------------------------------------
	const SX0 = 520;
	const SX1 = 936;
	const SY0 = 80;
	const SY1 = 170;
	const HALF_ARC = 8; // the strip spans ±8′
	const sxArc = (arc: number) => SX0 + ((arc + HALF_ARC) / (2 * HALF_ARC)) * (SX1 - SX0);
	const COLS = 104;
	const stripes = $derived.by(() => {
		const out: { x: number; w: number; v: number }[] = [];
		const w = (SX1 - SX0) / COLS;
		for (let i = 0; i < COLS; i++) {
			const arc = -HALF_ARC + (i + 0.5) * ((2 * HALF_ARC) / COLS);
			// the fringe pattern seen in the sky's frame: cos 2πu(l + drift)
			out.push({
				x: SX0 + i * w,
				w: w + 0.4,
				v: Math.cos(2 * Math.PI * u * (arc * ARCMIN + drift(tt)))
			});
		}
		return out;
	});

	// ---- right bottom: the output over time ----------------------------------------------------
	const WINDOW = 10;
	const tx = scale([-WINDOW, 0], [SX0 + 40, SX1]);
	const ty = scale([-2.2, 2.2], [370, 262]);
	const trace = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 240; i++) {
			const s = -WINDOW + (i / 240) * WINDOW;
			const y = ty(correlator(sources, u, drift(tt + s)));
			d += `${i ? 'L' : 'M'}${tx(s).toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});

	// ---- the visibility curve (double) ---------------------------------------------------------
	const vx = scale([0, 600], [SX0 + 40, SX1]);
	const vy = scale([0, 2], [548, 452]);
	const curve = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 300; i++) {
			const bb = (i / 300) * 600;
			const v = visibility1D(sources, bb / LAMBDA);
			d += `${i ? 'L' : 'M'}${vx(bb).toFixed(1)} ${vy(Math.hypot(v.re, v.im)).toFixed(1)}`;
		}
		return d;
	});
	const nullB = $derived(LAMBDA / (2 * sepArc * ARCMIN));
	const meter = $derived(Math.max(-1, Math.min(1, output / 2)));
</script>

<g>
	<!-- ===== left: two dishes, a wavefront, the correlator ===== -->
	<defs>
		<clipPath id="as-pair-sky">
			<rect x="16" y="40" width="470" height={GROUND - 30 - 40} />
		</clipPath>
	</defs>
	<g clip-path="url(#as-pair-sky)">
		{#each wavefronts as w, i (i)}
			<line
				x1={w.x1}
				y1={w.y1}
				x2={w.x2}
				y2={w.y2}
				stroke="var(--as-wave)"
				stroke-width="1.5"
				opacity={0.25 + 0.55 * w.o}
			/>
		{/each}
	</g>
	<line
		x1={40}
		y1={100}
		x2={40 - dir.x * 56}
		y2={100 - dir.y * 56}
		stroke="var(--as-wave)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="waves">
		<Label x={24} y={88} text="waves from the source" anchor="start" size={12} />
	</Readout>
	<Readout id="schematic">
		<Label x={24} y={56} text="schematic: angles not to scale" anchor="start" size={11} muted />
	</Readout>

	<!-- ground and dishes -->
	<line x1={24} y1={GROUND} x2={476} y2={GROUND} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each [xa, xb] as x, i (i)}
		<line
			x1={x}
			y1={GROUND - 26}
			x2={x}
			y2={GROUND}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<path
			d={dishPath(x)}
			fill="var(--as-dish)"
			fill-opacity="0.25"
			stroke="var(--as-dish)"
			stroke-width="2.5"
		/>
	{/each}
	<!-- the extra path -->
	<line
		x1={exA.x}
		y1={exA.y}
		x2={exB.x}
		y2={exB.y}
		stroke="var(--as-delay)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<Readout id="extra">
		<Label
			x={exB.x + 12}
			y={exB.y - 2}
			text="extra path b sin θ"
			anchor="start"
			size={12}
			color="var(--as-delay-text)"
		/>
	</Readout>
	<!-- baseline -->
	<line
		x1={xa}
		y1={GROUND + 14}
		x2={xb}
		y2={GROUND + 14}
		stroke="var(--stage-ink)"
		stroke-width="1"
	/>
	<line x1={xa} y1={GROUND + 8} x2={xa} y2={GROUND + 20} stroke="var(--stage-ink)" />
	<line x1={xb} y1={GROUND + 8} x2={xb} y2={GROUND + 20} stroke="var(--stage-ink)" />
	<Readout id="b" order={0} label="Distance between the dishes" value="{b} m">
		<Label x={GX} y={GROUND + 32} text="b = {b} m" anchor="middle" size={13} tabular />
	</Readout>

	<!-- correlator -->
	<path
		d="M{xa} {GROUND} V {GROUND + 52} H {GX - 40} M{xb} {GROUND} V {GROUND + 52} H {GX + 40}"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<rect
		x={GX - 40}
		y={GROUND + 36}
		width="80"
		height="34"
		rx="6"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="corr">
		<Label x={GX} y={GROUND + 58} text="× and average" anchor="middle" size={12} />
	</Readout>
	<line
		x1={GX}
		y1={GROUND + 70}
		x2={GX}
		y2={GROUND + 96}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<!-- output meter -->
	<rect
		x={GX - 110}
		y={GROUND + 98}
		width="220"
		height="16"
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<line x1={GX} y1={GROUND + 96} x2={GX} y2={GROUND + 116} stroke="var(--stage-ink-muted)" />
	<rect
		x={meter >= 0 ? GX : GX + meter * 108}
		y={GROUND + 101}
		width={Math.abs(meter) * 108}
		height="10"
		rx="5"
		fill={meter >= 0 ? 'var(--as-pos)' : 'var(--as-neg)'}
	/>
	<Readout id="out" order={3} label="Correlator output" value={output.toFixed(2)}>
		<Label
			x={GX}
			y={GROUND + 136}
			text="output {output >= 0 ? '+' : '−'}{Math.abs(output).toFixed(2)}"
			anchor="middle"
			size={13}
			tabular
		/>
	</Readout>

	<!-- ===== right top: the fringes on the sky ===== -->
	<Readout
		id="t-sky"
		order={20}
		label="The pair’s view of the sky"
		marker={1}
		at={[SX0 + 12, SY0 + 12]}
	>
		<Label
			anchor="start"
			x={SX0}
			y={SY0 - 26}
			text="the pair’s view of the sky: fringes λ/b apart"
			size={14}
			weight={600}
		/>
	</Readout>
	{#each stripes as s, i (i)}
		<rect
			x={s.x}
			y={SY0}
			width={s.w}
			height={SY1 - SY0}
			fill={s.v >= 0 ? 'var(--as-pos)' : 'var(--as-neg)'}
			opacity={0.08 + 0.42 * Math.abs(s.v)}
		/>
	{/each}
	<rect x={SX0} y={SY0} width={SX1 - SX0} height={SY1 - SY0} fill="none" stroke="var(--border)" />
	{#each sources as s, i (i)}
		{@const x = sxArc(s.l / ARCMIN)}
		<circle
			cx={x}
			cy={(SY0 + SY1) / 2}
			r="7"
			fill="var(--as-star)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}
	<!-- fringe spacing bracket -->
	{#if spacingArc < 2 * HALF_ARC}
		<line
			x1={sxArc(-HALF_ARC + 0.5)}
			y1={SY1 + 12}
			x2={sxArc(-HALF_ARC + 0.5 + spacingArc)}
			y2={SY1 + 12}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
	{/if}
	<Readout id="spacing" order={1} label="Fringe spacing λ/b" value="{spacingArc.toFixed(1)}′">
		<Label
			anchor="start"
			x={SX0}
			y={SY1 + 32}
			text="λ/b = 0.21 m / {b} m = {spacingArc.toFixed(1)}′ (the bar) · the strip is 16′ of sky"
			size={12}
			tabular
		/>
	</Readout>

	<!-- ===== right bottom: the output over time ===== -->
	<Readout id="t-out" order={21} label="The output over 10 s" marker={2} at={[SX0 + 12, 272]}>
		<Label
			anchor="start"
			x={SX0}
			y={250}
			text="the output over the last 10 s (sped up)"
			size={13}
			weight={600}
		/>
	</Readout>
	<line x1={tx(-WINDOW)} y1={ty(0)} x2={tx(0)} y2={ty(0)} stroke="var(--stage-grid)" />
	<line
		x1={tx(-WINDOW)}
		y1={ty(amp)}
		x2={tx(0)}
		y2={ty(amp)}
		stroke="var(--as-track)"
		stroke-dasharray="4 4"
		stroke-width="1"
	/>
	<line
		x1={tx(-WINDOW)}
		y1={ty(-amp)}
		x2={tx(0)}
		y2={ty(-amp)}
		stroke="var(--as-track)"
		stroke-dasharray="4 4"
		stroke-width="1"
	/>
	<path d={trace} fill="none" stroke="var(--stage-ink)" stroke-width="2" />
	<Label x={SX0 + 34} y={ty(2) + 4} text="+2" anchor="end" size={11} muted />
	<Label x={SX0 + 34} y={ty(0) + 4} text="0" anchor="end" size={11} muted />
	<Label x={SX0 + 34} y={ty(-2) + 4} text="−2" anchor="end" size={11} muted />
	<Readout id="amp" order={2} label="Fringe height |V|" value="{amp.toFixed(2)} Jy">
		<Label
			anchor="end"
			x={SX1}
			y={ty(amp) - 6}
			text="|V| = {amp.toFixed(2)} Jy"
			size={12}
			color="var(--as-track-text)"
			tabular
		/>
	</Readout>

	{#if mode === 'double'}
		<Readout id="t-vis" order={22} label="|V| for every baseline" marker={3} at={[SX0 + 12, 446]}>
			<Label
				anchor="start"
				x={SX0}
				y={428}
				text="fringe height |V| for every baseline"
				size={13}
				weight={600}
			/>
		</Readout>
		<Axes
			sx={vx}
			sy={vy}
			xLabel="baseline (m)"
			yTicks={[0, 1, 2]}
			xTicks={[0, 100, 200, 300, 400, 500, 600]}
		/>
		<path d={curve} fill="none" stroke="var(--as-track)" stroke-width="2.5" />
		<circle
			cx={vx(b)}
			cy={vy(amp)}
			r="6"
			fill="var(--as-star)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{#if nullB <= 600}
			<path d="M{vx(nullB)} {vy(0) - 2} l -5 -9 h 10 z" fill="var(--as-delay)" stroke="none" />
		{/if}
		<Readout
			id="sep"
			order={4}
			label="First null"
			value="b = λ/(2s) = {Math.round(nullB)} m for s = {sepArc}′"
		>
			<Label
				anchor="start"
				x={SX0}
				y={SY1 + 50}
				text="two 1 Jy sources {sepArc}′ apart · first null (▲) at λ/(2s) = {Math.round(nullB)} m"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}
</g>
