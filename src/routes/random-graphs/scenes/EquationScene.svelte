<script lang="ts">
	/**
	 * S = 1 − e^(−cS) solved graphically at the average degree `c`. Left: the line y = S and the
	 * curve y = 1 − e^(−cS), with the curve's tangent at 0 (slope c) and their crossings; a cobweb
	 * of the iteration S → 1 − e^(−cS) from S = 1 walks down to the giant's share, one step every
	 * 0.6 s (reduced motion: all steps). Right: the solution S against c (../model.ts `giantShare`)
	 * with the current c marked.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { giantShare } from '../model';
	import { pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const c = $derived(Math.max(0, Math.min(4, Number(params.cb ?? 1.5))));
	const S = $derived(giantShare(c));
	const f = (s: number) => 1 - Math.exp(-c * s);

	// ---- left: the two sides of the equation -------------------------------------------------------
	const lx = scale([0, 1], [90, 470]);
	const ly = scale([0, 1], [500, 120]);
	const SS = Array.from({ length: 101 }, (_, i) => i / 100);
	const curve = $derived(
		linePath(
			SS.map((s) => ({ s, y: f(s) })),
			(d) => d.s,
			(d) => d.y,
			lx,
			ly
		)
	);
	/** The tangent at 0, y = cS, clipped to the plot. */
	const tangentEnd = $derived(Math.min(1, 1 / Math.max(c, 1e-9)));
	const STEPS = 14;
	const cobweb = $derived.by(() => {
		let s = 1;
		const pts: { x: number; y: number }[] = [{ x: s, y: 0 }];
		for (let i = 0; i < STEPS; i++) {
			const y = f(s);
			pts.push({ x: s, y });
			pts.push({ x: y, y });
			s = y;
		}
		return pts;
	});
	const shownSteps = $derived(reduced ? STEPS : Math.min(STEPS, Math.floor(t / 0.6)));
	const cobPath = $derived(
		cobweb
			.slice(0, 1 + 2 * shownSteps)
			.map((p, i) => `${i ? 'L' : 'M'}${lx(p.x).toFixed(1)} ${ly(p.y).toFixed(1)}`)
			.join('')
	);
	const iterate = $derived(cobweb[2 * shownSteps]?.x ?? 1);

	// ---- right: S against c ----------------------------------------------------------------------
	const rx = scale([0, 4], [600, 930]);
	const ry = scale([0, 1], [500, 120]);
	const CS = Array.from({ length: 201 }, (_, i) => i * 0.02);
	const sCurve = linePath(
		CS.map((x) => ({ x, y: giantShare(x) })),
		(d) => d.x,
		(d) => d.y,
		rx,
		ry
	);
	const verdict = $derived(
		c <= 1
			? `c = ${c.toFixed(2)} ≤ 1: the curve stays under the line; only S = 0`
			: `c = ${c.toFixed(2)} > 1: a second crossing at S = ${S.toFixed(3)}`
	);
</script>

<g>
	<Readout id="title" order={1} label="Equation" value="S = 1 − e^(−cS)">
		<Label
			x={24}
			y={34}
			text="S = 1 − e^(−cS), solved by drawing both sides"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="verdict" order={2} label="Solution" value={verdict}>
		<Label x={24} y={58} text={verdict} size={12} anchor="start" muted tabular />
	</Readout>

	<Axes
		sx={lx}
		sy={ly}
		xLabel="S"
		xTicks={[0, 0.25, 0.5, 0.75, 1]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
	/>
	<line x1={lx(0)} y1={ly(0)} x2={lx(1)} y2={ly(1)} stroke="var(--stage-ink)" stroke-width="1.6" />
	<line
		x1={lx(0)}
		y1={ly(0)}
		x2={lx(tangentEnd)}
		y2={ly(Math.min(1, c * tangentEnd))}
		stroke="var(--rg-giant)"
		stroke-width="1.2"
		stroke-dasharray="4 4"
		opacity="0.8"
	/>
	<path d={curve} fill="none" stroke="var(--rg-giant)" stroke-width="2.6" />
	<path d={cobPath} fill="none" stroke="var(--rg-second)" stroke-width="1.3" opacity="0.9" />
	<circle cx={lx(iterate)} cy={ly(iterate)} r="4" fill="var(--rg-second)" />
	<circle cx={lx(0)} cy={ly(0)} r="5" fill="var(--stage-ink)" />
	{#if S > 0}
		<circle
			cx={lx(S)}
			cy={ly(S)}
			r="7"
			fill="var(--rg-giant)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<Label
			x={lx(S) + 12}
			y={ly(S) + 18}
			text="S = {S.toFixed(3)}"
			size={13}
			weight={600}
			anchor="start"
			tabular
		/>
	{/if}
	<Label x={lx(1) - 4} y={ly(1) - 10} text="y = S" size={12} anchor="end" />
	<Label
		x={lx(0.04)}
		y={ly(0.97)}
		text="y = 1 − e^(−cS)"
		size={12}
		anchor="start"
		color="var(--rg-giant)"
		weight={600}
	/>
	<Label x={lx(0.04)} y={ly(0.9)} text="dashed: slope c at 0" size={11} anchor="start" muted />
	<Label
		x={lx(0.04)}
		y={ly(0.84)}
		text="thin: S → 1 − e^(−cS), repeated from S = 1"
		size={11}
		anchor="start"
		muted
	/>

	<Axes
		sx={rx}
		sy={ry}
		xLabel="average degree c"
		xTicks={[0, 1, 2, 3, 4]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
		yFormat={(v) => `${v * 100} %`}
	/>
	<Label x={600} y={104} text="giant’s share S" size={11} anchor="start" muted />
	<path d={sCurve} fill="none" stroke="var(--rg-giant)" stroke-width="2.4" />
	<line
		x1={rx(c)}
		x2={rx(c)}
		y1={ry(0)}
		y2={ry(1)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	<circle
		cx={rx(c)}
		cy={ry(S)}
		r="6"
		fill="var(--rg-giant)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout id="share" order={3} label="Giant’s share" value={pct(S, 1)}>
		<Label x={620} y={140} text="S = {pct(S, 1)}" size={14} weight={600} anchor="start" tabular />
	</Readout>
</g>
