<script lang="ts">
	/**
	 * Where the fusions come from. Against the collision energy of a pair of nuclei: the share
	 * of pairs at each energy (Maxwell–Boltzmann, falling), the chance of tunnelling through
	 * the barrier (rising), and their product with the real D–T cross section: the fusions,
	 * in a narrow peak. Each curve is scaled to its own height. Sparks (one fusion each) pop
	 * up at energies drawn from the fusion curve, so they pile up under the peak.
	 */
	import { Axes, Label, areaPath, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { barrier, fusionPeak, fusionsAt, maxwell, reactivity, tunnelling } from '../model';
	import { kelvinText, plasmaOf } from './settings';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 110;
	const X1 = 880;
	const Y0 = 110;
	const Y1 = 470;
	const E_MAX = 200;
	const sx = scale([0, E_MAX], [X0, X1]);
	const sy = scale([0, 1.08], [Y1, Y0]);
	const N = 200;
	const es = Array.from({ length: N }, (_, i) => 0.5 + (i * (E_MAX - 0.5)) / (N - 1));

	const temp = $derived(plasmaOf(params).t);
	const series = $derived.by(() => {
		const mb = es.map((e) => maxwell(e, temp));
		const tu = es.map((e) => tunnelling(e));
		const fu = es.map((e) => fusionsAt(e, temp));
		const norm = (a: number[]) => {
			const m = Math.max(...a);
			return a.map((v) => v / m);
		};
		const f = norm(fu);
		// Cumulative distribution of the fusions, to place the sparks.
		const cdf: number[] = [];
		let s = 0;
		for (const v of f) cdf.push((s += v));
		return { mb: norm(mb), tu: norm(tu), fu: f, cdf: cdf.map((v) => v / s) };
	});
	const peak = $derived(fusionPeak(temp));
	const rel = $derived(reactivity(temp) / reactivity(10));
	const avg = $derived(1.5 * temp);

	const pts = $derived(
		es.map((e, i) => ({ e, mb: series.mb[i], tu: series.tu[i], fu: series.fu[i] }))
	);
	const mbPath = $derived(
		linePath(
			pts,
			(p) => p.e,
			(p) => p.mb,
			sx,
			sy
		)
	);
	const tuPath = $derived(
		linePath(
			pts,
			(p) => p.e,
			(p) => p.tu,
			sx,
			sy
		)
	);
	const fuArea = $derived(
		areaPath(
			pts,
			(p) => p.e,
			() => 0,
			(p) => p.fu,
			sx,
			sy
		)
	);
	const fuPath = $derived(
		linePath(
			pts,
			(p) => p.e,
			(p) => p.fu,
			sx,
			sy
		)
	);

	const show = $derived(reduced ? 1 : smoothstep(0.2, 1.4, t));
	const time = $derived(reduced ? 6 : t);
	const RATE = 9; // sparks per second
	const LIFE = 1.4;
	const sparks = $derived.by(() => {
		const out: { id: number; x: number; y: number; o: number }[] = [];
		const last = Math.floor(time * RATE);
		for (let i = Math.max(0, last - Math.ceil(LIFE * RATE)); i <= last; i++) {
			const age = time - i / RATE;
			if (age < 0 || age > LIFE) continue;
			const u = hash(i, 3);
			let k = series.cdf.findIndex((c) => c >= u);
			if (k < 0) k = N - 1;
			const e = es[k];
			const y = series.fu[k] * (0.15 + 0.75 * hash(i, 7));
			out.push({
				id: i,
				x: sx(e),
				y: sy(y),
				o: smoothstep(0, 0.15, age) * (1 - smoothstep(0.7, 1, age / LIFE))
			});
		}
		return out;
	});
	const fmt = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1));
	const relText = $derived(
		rel >= 0.1
			? `× ${rel >= 10 ? Math.round(rel) : rel.toFixed(1)}`
			: `÷ ${Math.round(1 / rel).toLocaleString('en-US')}`
	);
</script>

<g>
	<Axes
		{sx}
		{sy}
		xTicks={[0, 25, 50, 75, 100, 125, 150, 175, 200]}
		yTicks={[]}
		xLabel="collision energy of a pair of nuclei (keV)"
	/>
	<g opacity={show}>
		<path d={fuArea} fill="var(--nf-fusion)" opacity="0.22" />
		<path d={mbPath} fill="none" stroke="var(--nf-dd)" stroke-width="2.5" />
		<path d={tuPath} fill="none" stroke="var(--nf-brems)" stroke-width="2.5" />
		<path d={fuPath} fill="none" stroke="var(--nf-fusion)" stroke-width="3" />
	</g>
	{#each sparks as s (s.id)}
		<circle cx={s.x} cy={s.y} r="4" fill="var(--nf-fusion)" opacity={s.o} filter="url(#glow)" />
	{/each}

	<!-- average energy -->
	<line
		x1={sx(avg)}
		x2={sx(avg)}
		y1={Y1}
		y2={Y0 + 10}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout id="avg">
		<Label
			x={sx(avg) + (avg > 150 ? -6 : 6)}
			y={Y1 - 8}
			text="average {fmt(avg)} keV"
			size={11}
			muted
			anchor={avg > 150 ? 'end' : 'start'}
		/>
	</Readout>

	<!-- legend, top left -->
	<Readout id="k-mb" order={10} label="Share of pairs at each energy" color="var(--nf-dd)">
		<g transform="translate({X0 + 10} 72)">
			<line x1="0" x2="22" y1="0" y2="0" stroke="var(--nf-dd)" stroke-width="2.5" />
			<text x="30" y="4" font-size="12">share of pairs with that energy</text>
		</g>
	</Readout>
	<Readout id="k-tu" order={11} label="Chance of tunnelling through" color="var(--nf-brems)">
		<g transform="translate({X0 + 250} 72)">
			<line x1="0" x2="22" y1="0" y2="0" stroke="var(--nf-brems)" stroke-width="2.5" />
			<text x="30" y="4" font-size="12">chance of tunnelling through</text>
		</g>
	</Readout>
	<Readout id="k-fu" order={12} label="Fusions (their product)" color="var(--nf-fusion)">
		<g transform="translate({X0 + 480} 72)">
			<line x1="0" x2="22" y1="0" y2="0" stroke="var(--nf-fusion)" stroke-width="3" />
			<text x="30" y="4" font-size="12">fusions: the product</text>
		</g>
	</Readout>
	<Readout id="scaled">
		<Label
			x={X0 + 10}
			y={96}
			text="each curve scaled to its own height"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<Readout
		id="peak"
		order={1}
		label="Most fusions at"
		value="{fmt(peak)} keV"
		color="var(--nf-fusion)"
	>
		<Label
			x={sx(peak) + 10}
			y={sy(1.02)}
			text="most fusions at {fmt(peak)} keV"
			anchor={peak > 130 ? 'end' : 'start'}
			color="var(--nf-fusion)"
			weight={600}
		/>
	</Readout>
	<Readout id="temp" order={0} label="Temperature" value="{temp} keV · {kelvinText(temp)}">
		<Label
			x={X1}
			y={44}
			text="plasma at {temp} keV · {kelvinText(temp)}"
			anchor="end"
			size={14}
			weight={600}
		/>
	</Readout>
	<Readout id="rate">
		<Label
			x={X1}
			y={96}
			text="fusion rate {relText} compared with 10 keV"
			anchor="end"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="barrier">
		<Label
			x={X0}
			y={Y1 + 34}
			text="the barrier, {Math.round(barrier())} keV, is far off to the right →"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
</g>
