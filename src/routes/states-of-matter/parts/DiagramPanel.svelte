<script lang="ts">
	/**
	 * The real phase diagram of the substance (see ../phase.ts), temperature
	 * (−100 … 400 °C, linear) against pressure (0.001 … 1000 atm, logarithmic),
	 * with the temperature and pressure the reader set as a dot (the box runs at
	 * its own set point in the same state: see ../mapping.ts).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import {
		ATM,
		KELVIN,
		SUBSTANCES,
		boundaries,
		type Phase,
		type Point,
		type Substance
	} from '../phase';
	import { formatAtm, formatCelsius } from '../format';

	interface Props {
		sub: Substance;
		/** Temperature (K) and pressure (Pa) of the dot. */
		T: number;
		P: number;
		phase: Phase;
		/** Panel origin (top-left of the plot area) and size. */
		x0?: number;
		y0?: number;
		w?: number;
		h?: number;
	}
	let { sub, T, P, phase, x0 = 474, y0 = 60, w = 430, h = 340 }: Props = $props();

	const T_MIN = -100 + KELVIN;
	const T_MAX = 400 + KELVIN;
	const LP_MIN = -3;
	const LP_MAX = 3;
	const P_MAX = ATM * 10 ** LP_MAX;

	const sx = (T: number) => x0 + ((T - T_MIN) / (T_MAX - T_MIN)) * w;
	const sy = (P: number) => {
		const lp = Math.log10(P / ATM);
		return (
			y0 + h - ((Math.min(Math.max(lp, LP_MIN - 1), LP_MAX + 1) - LP_MIN) / (LP_MAX - LP_MIN)) * h
		);
	};
	const pt = (p: Point) => `${sx(p.T).toFixed(1)} ${sy(p.P).toFixed(1)}`;
	const line = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join(' ');

	const data = $derived(SUBSTANCES[sub]);
	const lines = $derived(boundaries(sub, T_MIN, T_MAX, P_MAX));

	/** Region outlines, in plot coordinates (clipped to the plot). */
	const regions = $derived.by(() => {
		const { triple, critical } = data;
		const { sublimation, vapour, melting } = lines;
		const meltTop = melting[melting.length - 1] ?? triple;
		const bottom = y0 + h + 40;
		const top = y0 - 40;
		const solid =
			`M${sx(T_MIN) - 40} ${bottom} L${sx(sublimation[0].T)} ${bottom} ` +
			sublimation.map((p) => `L${pt(p)}`).join(' ') +
			' ' +
			melting.map((p) => `L${pt(p)}`).join(' ') +
			` L${sx(meltTop.T)} ${top} L${sx(T_MIN) - 40} ${top} Z`;
		const liquid =
			`M${pt(triple)} ` +
			melting.map((p) => `L${pt(p)}`).join(' ') +
			` L${sx(meltTop.T)} ${top} L${sx(critical.T)} ${top} L${pt(critical)} ` +
			[...vapour]
				.reverse()
				.map((p) => `L${pt(p)}`)
				.join(' ') +
			' Z';
		const supercritical = `M${pt(critical)} L${sx(critical.T)} ${top} L${sx(T_MAX) + 40} ${top} L${sx(T_MAX) + 40} ${sy(critical.P)} Z`;
		return { solid, liquid, supercritical };
	});

	const tTicks = [-100, 0, 100, 200, 300, 400];
	const pTicks = [-3, -2, -1, 0, 1, 2, 3];
	const pLabel = (e: number) => (e < 0 ? `0.${'0'.repeat(-e - 1)}1` : `${10 ** e}`);

	/** Region labels, placed where each region is roomy for the substance. */
	const regionLabels = $derived(
		sub === 'water'
			? [
					{ id: 'solid', T: -55, P: 30, text: 'solid' },
					{ id: 'liquid', T: 150, P: 80, text: 'liquid' },
					{ id: 'gas', T: 250, P: 0.05, text: 'gas' }
				]
			: [
					{ id: 'solid', T: -78, P: 300, text: 'solid' },
					{ id: 'liquid', T: -12, P: 300, text: 'liquid' },
					{ id: 'gas', T: 150, P: 0.05, text: 'gas' },
					{ id: 'super', T: 395, P: 600, text: 'supercritical', end: true }
				]
	);

	const dot = $derived({ x: sx(T), y: sy(P) });
	const phaseName: Record<Phase, string> = {
		solid: 'solid',
		liquid: 'liquid',
		gas: 'gas',
		supercritical: 'supercritical fluid'
	};
	const atm1 = $derived(sy(ATM));
	/** The regions' fills, for their key chips on narrow screens. */
	const REGION_FILL: Record<string, string> = {
		solid: 'var(--som-solid)',
		liquid: 'var(--som-liquid)',
		gas: 'var(--som-gas)',
		super: 'var(--som-super)'
	};
</script>

<g>
	<defs>
		<clipPath id="som-diagram-clip">
			<rect x={x0} y={y0} width={w} height={h} />
		</clipPath>
	</defs>
	<rect x={x0} y={y0} width={w} height={h} fill="var(--som-gas)" />
	<g clip-path="url(#som-diagram-clip)">
		<path d={regions.supercritical} fill="var(--som-super)" />
		<path d={regions.liquid} fill="var(--som-liquid)" />
		<path d={regions.solid} fill="var(--som-solid)" />
		{#each tTicks as c (c)}
			<line
				x1={sx(c + KELVIN)}
				x2={sx(c + KELVIN)}
				y1={y0}
				y2={y0 + h}
				stroke="var(--stage-grid)"
				stroke-width="1"
				opacity="0.7"
			/>
		{/each}
		{#each pTicks as e (e)}
			<line
				x1={x0}
				x2={x0 + w}
				y1={sy(ATM * 10 ** e)}
				y2={sy(ATM * 10 ** e)}
				stroke="var(--stage-grid)"
				stroke-width="1"
				opacity="0.7"
			/>
		{/each}
		<!-- 1 atm -->
		<line
			x1={x0}
			x2={x0 + w}
			y1={atm1}
			y2={atm1}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="5 4"
		/>
		<!-- the supercritical region's edges are not phase lines -->
		<path
			d="M{pt(data.critical)} L{sx(data.critical.T)} {y0} M{pt(data.critical)} L{x0 + w} {sy(
				data.critical.P
			)}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="2 4"
			fill="none"
		/>
		<path
			d="{line(lines.sublimation)} {line(lines.vapour)} {line(lines.melting)}"
			fill="none"
			stroke="var(--som-line)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
	</g>
	<rect
		x={x0}
		y={y0}
		width={w}
		height={h}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.2"
	/>

	<!-- <Readout>: on narrow screens the regions are key chips in their colours -->
	{#each regionLabels as r, i (r.id)}
		<Readout id="region-{r.id}" order={10 + i} label={r.text} color={REGION_FILL[r.id]}>
			<Label
				x={sx(r.T + KELVIN)}
				y={sy(r.P * ATM)}
				text={r.text}
				size={13}
				weight={600}
				anchor={r.end ? 'end' : 'middle'}
				muted
			/>
		</Readout>
	{/each}

	<!-- triple and critical points -->
	<circle
		cx={sx(data.triple.T)}
		cy={sy(data.triple.P)}
		r="4"
		fill="var(--stage-bg)"
		stroke="var(--som-line)"
		stroke-width="2"
	/>
	<circle
		cx={sx(data.critical.T)}
		cy={sy(data.critical.P)}
		r="4"
		fill="var(--stage-bg)"
		stroke="var(--som-line)"
		stroke-width="2"
	/>
	<Readout
		id="triple"
		order={14}
		label="triple point"
		marker={1}
		at={[sx(data.triple.T) + 26, sy(data.triple.P) + 22]}
	>
		<Label
			x={sx(data.triple.T) + 8}
			y={sy(data.triple.P) + 16}
			text="triple point"
			size={11}
			anchor="start"
		/>
	</Readout>
	<Readout
		id="critical"
		order={15}
		label="critical point"
		marker={2}
		at={[sx(data.critical.T) + (sub === 'water' ? -26 : 26), sy(data.critical.P) + 22]}
	>
		<Label
			x={sx(data.critical.T) + (sub === 'water' ? -8 : 8)}
			y={sy(data.critical.P) + 16}
			text="critical point"
			size={11}
			anchor={sub === 'water' ? 'end' : 'start'}
		/>
	</Readout>
	<Label x={x0 + w - 6} y={atm1 - 6} text="1 atm" size={11} anchor="end" muted />

	<!-- axes -->
	{#each tTicks as c (c)}
		<Label x={sx(c + KELVIN)} y={y0 + h + 17} text={formatCelsius(c)} size={11} muted />
	{/each}
	{#each pTicks as e (e)}
		<Label x={x0 - 8} y={sy(ATM * 10 ** e) + 4} text={pLabel(e)} size={11} anchor="end" muted />
	{/each}
	<Label x={x0 + w / 2} y={y0 + h + 36} text="temperature" size={12} muted />
	<Label x={x0 - 8} y={y0 - 12} text="pressure (atm)" size={12} anchor="start" muted />

	<!-- the box's state -->
	<line
		x1={x0}
		x2={dot.x}
		y1={dot.y}
		y2={dot.y}
		stroke="var(--som-dot)"
		stroke-width="1"
		stroke-dasharray="3 3"
		opacity="0.8"
	/>
	<line
		x1={dot.x}
		x2={dot.x}
		y1={dot.y}
		y2={y0 + h}
		stroke="var(--som-dot)"
		stroke-width="1"
		stroke-dasharray="3 3"
		opacity="0.8"
	/>
	<circle
		cx={dot.x}
		cy={dot.y}
		r="7"
		fill="var(--som-dot)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<Readout id="phase" order={4} label="State" value={phaseName[phase]} color="var(--som-dot)">
		<Label
			x={x0}
			y={y0 + h + 66}
			text="{data.name} at {formatCelsius(T - KELVIN)} and {formatAtm(P / ATM)}:"
			size={13}
			anchor="start"
		/>
		<Label
			x={x0}
			y={y0 + h + 90}
			text={phaseName[phase]}
			size={18}
			weight={700}
			anchor="start"
			color="var(--som-dot)"
		/>
	</Readout>
</g>
