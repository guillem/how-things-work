<script lang="ts">
	/**
	 * The binding-energy curve: binding energy per nucleon against mass number (log scale), for
	 * the most tightly bound measured nucleus of each A (AME2020). The curve draws itself in,
	 * then two arrows show the ways up it: fusion of light nuclei (steep) and fission of heavy
	 * ones (shallow). Energy "sparks" travel up both arrows on a loop.
	 */
	import { Axes, Label, clamp, cycle, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { curve, nuclides, type NuclideName } from '../binding';

	let { t, reduced }: StageProps = $props();

	const X0 = 110;
	const X1 = 900;
	const Y0 = 96;
	const Y1 = 500;
	const lx = scale([0, Math.log10(270)], [X0, X1]);
	const sx = (a: number) => lx(Math.log10(a));
	const sy = scale([0, 9], [Y1, Y0]);
	// A log axis drawn by <Axes> through a log-valued scale.
	const axisX = scale([0, Math.log10(270)], [X0, X1]);
	const xTicks = [1, 2, 5, 10, 20, 50, 100, 200].map(Math.log10);

	const time = $derived(reduced ? 6 : t);
	const draw = $derived(smoothstep(0.2, 2.0, time));
	const arrows = $derived(smoothstep(1.9, 2.4, time));

	const pts = curve.filter((p) => p[0] >= 2);
	const shown = $derived(pts.slice(0, Math.max(2, Math.round(draw * pts.length))));
	const path = $derived(
		linePath(
			shown,
			(p) => Math.log10(p[0]),
			(p) => p[2] / 1000,
			lx,
			sy
		)
	);

	const be = (n: NuclideName) => nuclides[n].bindingPerNucleon / 1000;
	const marks: {
		id: NuclideName;
		text: string;
		dx: number;
		dy: number;
		anchor: 'start' | 'end' | 'middle';
	}[] = [
		{ id: 'H-2', text: 'deuterium ²H  1.1', dx: 10, dy: 4, anchor: 'start' },
		{ id: 'H-3', text: 'tritium ³H  2.8', dx: 10, dy: 4, anchor: 'start' },
		{ id: 'He-4', text: 'helium-4  7.1', dx: -10, dy: -8, anchor: 'end' },
		{ id: 'Ni-62', text: 'nickel-62  8.79 (the peak)', dx: 0, dy: -16, anchor: 'middle' },
		{ id: 'U-235', text: 'uranium-235  7.6', dx: 8, dy: 24, anchor: 'end' }
	];

	// Fusion arrow: from the D–T midpoint up to helium-4. Fission arrow: from U-235 to the
	// fragments' region (A ≈ 117, half of 235).
	const fusionFrom = { x: sx(2.5) - 30, y: sy((be('H-2') * 2 + be('H-3') * 3) / 5) };
	const fusionTo = { x: sx(4) - 30, y: sy(be('He-4')) + 12 };
	const mid = curve.find((p) => p[0] === 117) ?? curve[0];
	const fissionFrom = { x: sx(235), y: sy(be('U-235')) - 6 };
	const fissionTo = { x: sx(117) + 10, y: sy(mid[2] / 1000) + 4 };

	const spark = (from: { x: number; y: number }, to: { x: number; y: number }, off: number) => {
		const u = cycle(time, 2.2, off);
		return {
			x: from.x + (to.x - from.x) * u,
			y: from.y + (to.y - from.y) * u,
			o: arrows * smoothstep(0, 0.15, u) * (1 - smoothstep(0.8, 1, u))
		};
	};
	const sparks = $derived([
		{ id: 'f1', ...spark(fusionFrom, fusionTo, 0), color: 'var(--nf-fusion)' },
		{ id: 'f2', ...spark(fusionFrom, fusionTo, 0.5), color: 'var(--nf-fusion)' },
		{ id: 's1', ...spark(fissionFrom, fissionTo, 0.25), color: 'var(--nf-dd)' },
		{ id: 's2', ...spark(fissionFrom, fissionTo, 0.75), color: 'var(--nf-dd)' }
	]);
	const markO = (a: number) => clamp((draw * pts.length - pts.findIndex((p) => p[0] >= a)) / 6);
</script>

<g>
	<Axes
		sx={axisX}
		{sy}
		{xTicks}
		xFormat={(v) => String(Math.round(10 ** v))}
		yTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
		xLabel="mass number A (protons + neutrons)"
		yLabel="binding energy per nucleon (MeV)"
	/>
	<path
		d={path}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-linejoin="round"
		opacity="0.85"
	/>
	{#each marks as m (m.id)}
		{@const x = sx(nuclides[m.id].a)}
		{@const y = sy(be(m.id))}
		<g opacity={markO(nuclides[m.id].a)}>
			<circle cx={x} cy={y} r="5" fill="var(--nf-dt)" stroke="var(--stage-bg)" stroke-width="1.5" />
			<Readout
				id={m.id}
				order={10 + nuclides[m.id].a}
				label={m.text.split('  ')[0]}
				value="{m.text.split('  ')[1].split(' ')[0]} MeV"
			>
				<Label x={x + m.dx} y={y + m.dy} text={m.text} anchor={m.anchor} size={12} />
			</Readout>
		</g>
	{/each}

	<g opacity={arrows}>
		<line
			x1={fusionFrom.x}
			y1={fusionFrom.y}
			x2={fusionTo.x}
			y2={fusionTo.y}
			stroke="var(--nf-fusion)"
			stroke-width="4"
			marker-end="url(#arrowhead)"
		/>
		<line
			x1={fissionFrom.x}
			y1={fissionFrom.y}
			x2={fissionTo.x}
			y2={fissionTo.y}
			stroke="var(--nf-dd)"
			stroke-width="4"
			marker-end="url(#arrowhead)"
		/>
		<Readout
			id="fusion"
			order={1}
			label="Fusion"
			value="joins light nuclei: a steep climb"
			color="var(--nf-fusion)"
		>
			<Label
				x={sx(1.08)}
				y={sy(8.35)}
				text="fusion: a steep climb"
				anchor="start"
				color="var(--nf-fusion)"
				weight={600}
			/>
		</Readout>
		<Readout
			id="fission"
			order={2}
			label="Fission"
			value="splits heavy nuclei: a gentle climb"
			color="var(--nf-dd)"
		>
			<Label
				x={sx(150)}
				y={sy(6.75)}
				text="fission: a gentle climb"
				anchor="end"
				color="var(--nf-dd)"
				weight={600}
			/>
		</Readout>
	</g>
	{#each sparks as s (s.id)}
		<circle cx={s.x} cy={s.y} r="6" fill={s.color} opacity={s.o} filter="url(#glow)" />
	{/each}
	<Readout id="up">
		<Label
			x={X1}
			y={Y0 - 40}
			text="moving up the curve releases energy"
			anchor="end"
			muted
			size={12}
			opacity={arrows}
		/>
	</Readout>
</g>
