<script lang="ts">
	/**
	 * The noise schedule. Left: √ᾱ_t (the signal left) and √(1 − ᾱ_t) (the noise) against t, and
	 * β_t (×25 to be visible), with a marker at the playhead. Right: one clean point x₀; 40
	 * independent step-by-step noising chains from it, shown where they are at step t, one of
	 * them with its whole path; and the disc the one-go formula predicts: centre √ᾱ_t x₀, radius
	 * 2 √(1 − ᾱ_t) (a 2-D normal falls inside 2 standard deviations 86% of the time).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BETAS, T, alphaBar, gaussian } from '../ddpm';
	import { fmt, paceForward } from './shared';
	import { useScrub } from './scrub.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();
	const scrub = useScrub({
		step: () => step,
		params: () => params,
		t: () => t,
		reduced: () => reduced,
		setParam: (id, v) => setParam(id, v),
		run: 8,
		pace: paceForward
	});
	const tt = $derived(Math.round(scrub.u * T));

	// ---- the curves ----------------------------------------------------------------------------
	const sx = scale([0, T], [80, 520]);
	const sy = scale([0, 1], [500, 80]);
	const ts = Array.from({ length: 201 }, (_, i) => i * 5);
	const signal = linePath(
		ts,
		(s) => s,
		(s) => Math.sqrt(alphaBar(s)),
		sx,
		sy
	);
	const noise = linePath(
		ts,
		(s) => s,
		(s) => Math.sqrt(1 - alphaBar(s)),
		sx,
		sy
	);
	const beta = linePath(
		ts.slice(1),
		(s) => s,
		(s) => 25 * BETAS[s - 1],
		sx,
		sy
	);
	const sig = $derived(Math.sqrt(alphaBar(tt)));
	const noi = $derived(Math.sqrt(1 - alphaBar(tt)));

	// ---- one point, 40 chains -------------------------------------------------------------------
	const X0: [number, number] = [1.2, 0.6];
	const CHAINS = 40;
	const chains = (() => {
		const g = gaussian(5);
		const a = new Float32Array((T + 1) * CHAINS * 2);
		for (let c = 0; c < CHAINS; c++) {
			a[2 * c] = X0[0];
			a[2 * c + 1] = X0[1];
		}
		for (let s = 1; s <= T; s++) {
			const b = 1 - alphaBar(s) / alphaBar(s - 1);
			const k = Math.sqrt(1 - b);
			const e = Math.sqrt(b);
			for (let i = 0; i < CHAINS * 2; i++)
				a[s * CHAINS * 2 + i] = k * a[(s - 1) * CHAINS * 2 + i] + e * g();
		}
		return a;
	})();
	const M = { cx: 740, cy: 290, s: 58, x: 552, y: 80, w: 376, h: 420 };
	const mx = (x: number) => M.cx + x * M.s;
	const my = (y: number) => M.cy - y * M.s;
	const ends = $derived.by(() => {
		let d = '';
		for (let c = 1; c < CHAINS; c++) {
			const o = tt * CHAINS * 2 + 2 * c;
			d += `M${mx(chains[o]).toFixed(1)} ${my(chains[o + 1]).toFixed(1)}h0`;
		}
		return d;
	});
	const path = $derived.by(() => {
		let d = '';
		for (let s = 0; s <= tt; s += 2) {
			const o = s * CHAINS * 2;
			d += `${s ? 'L' : 'M'}${mx(chains[o]).toFixed(1)} ${my(chains[o + 1]).toFixed(1)}`;
		}
		return d;
	});
	const head = $derived({ x: mx(chains[tt * CHAINS * 2]), y: my(chains[tt * CHAINS * 2 + 1]) });
	const disc = $derived({ x: mx(sig * X0[0]), y: my(sig * X0[1]), r: 2 * noi * M.s });
</script>

<g>
	<Axes {sx} {sy} xLabel="noising step t" xTicks={[0, 250, 500, 750, 1000]} yTicks={[0, 0.5, 1]} />
	<path
		d={beta}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="3 4"
	/>
	<path d={noise} fill="none" stroke="var(--dm-noise)" stroke-width="3" />
	<path d={signal} fill="none" stroke="var(--dm-signal)" stroke-width="3" />
	<Readout
		id="k-sig"
		order={3}
		label="Signal left √ᾱₜ"
		value={fmt(sig, 3)}
		color="var(--dm-signal)"
	>
		<Label
			x={sx(80)}
			y={sy(0.97) - 8}
			anchor="start"
			text="signal left √ᾱₜ = {fmt(sig, 3)}"
			color="var(--dm-signal)"
		/>
	</Readout>
	<Readout id="k-noi" order={4} label="Noise √(1 − ᾱₜ)" value={fmt(noi, 3)}>
		<Label
			x={sx(560)}
			y={sy(1) - 14}
			anchor="start"
			text="noise √(1 − ᾱₜ) = {fmt(noi, 3)}"
			color="var(--dm-noise)"
		/>
	</Readout>
	<Readout id="k-beta">
		<Label
			x={sx(1000)}
			y={sy(0.5) - 10}
			anchor="end"
			size={12}
			muted
			text="βₜ × 25 (0.0001 → 0.02)"
		/>
	</Readout>
	<line
		x1={sx(tt)}
		y1={sy(0)}
		x2={sx(tt)}
		y2={sy(1)}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		opacity="0.6"
	/>
	<circle cx={sx(tt)} cy={sy(sig)} r="6" fill="var(--dm-signal)" />
	<circle cx={sx(tt)} cy={sy(noi)} r="6" fill="var(--dm-noise)" />
	<Readout id="k-t" order={1} label="Step" value="t = {tt}">
		<Label x={sx(tt)} y={sy(0) + 50} pill text="t = {tt}" size={13} />
	</Readout>

	<!-- one point -->
	<rect
		x={M.x}
		y={M.y}
		width={M.w}
		height={M.h}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<defs>
		<clipPath id="schedule-clip"><rect x={M.x} y={M.y} width={M.w} height={M.h} rx="10" /></clipPath
		>
	</defs>
	<g clip-path="url(#schedule-clip)">
		<path d="M{M.x} {M.cy}H{M.x + M.w}M{M.cx} {M.y}V{M.y + M.h}" stroke="var(--stage-grid)" />
		<circle
			cx={disc.x}
			cy={disc.y}
			r={disc.r}
			fill="var(--dm-guess)"
			opacity="0.12"
			stroke="var(--dm-guess)"
			stroke-dasharray="4 4"
		/>
		<path d={path} fill="none" stroke="var(--dm-upper)" stroke-width="1.2" opacity="0.7" />
		<path d={ends} stroke="var(--dm-point)" stroke-width="5" stroke-linecap="round" opacity="0.6" />
		<circle cx={head.x} cy={head.y} r="5" fill="var(--dm-upper)" />
		<circle
			cx={mx(X0[0])}
			cy={my(X0[1])}
			r="6"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
	</g>
	<Readout
		id="k-one"
		order={5}
		label="Right panel"
		value="one clean point x₀ (ring), 40 noisings of it at step t, the one-go disc"
	>
		<Label
			x={M.x + 12}
			y={M.y + 24}
			anchor="start"
			size={13}
			weight={600}
			text="40 noisings of one point x₀ (ring)"
		/>
		<Label
			x={M.x + 12}
			y={M.y + M.h - 34}
			anchor="start"
			size={12}
			color="var(--dm-guess)"
			text="disc: √ᾱₜ·x₀ ± 2√(1 − ᾱₜ), in one go"
		/>
		<Label
			x={M.x + 12}
			y={M.y + M.h - 14}
			anchor="start"
			size={12}
			color="var(--dm-upper)"
			text="line: one chain, step by step"
		/>
	</Readout>
</g>
