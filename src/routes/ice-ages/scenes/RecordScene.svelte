<script lang="ts">
	/**
	 * The EPICA Dome C temperature record, 800,000 years ago (left) to today
	 * (right).
	 * - record: the curve is read off the core from today backwards, as the
	 *   drill goes down; a cursor (the `look` control, or the pointer) reads a
	 *   point; the glacial depth 21,000 years ago is the default.
	 * - rhythm: the warm peaks of the last 450,000 years are marked with the
	 *   intervals between them, and the last cycle's slow fall and fast rise.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { toSvg } from '#lib/draw/pointer.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TEMPERATURE, valueAt, warmPeaks, type Point } from '../milankovitch';
	import { agoText } from '../steps';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'record'));
	const rhythm = $derived(phase === 'rhythm');

	const X0 = 96;
	const X1 = 900;
	const sx = scale([800, 0], [X0, X1]);
	const sy = scale([-11, 5], [500, 96]);
	const signed = (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

	// the curve is revealed from today backwards over the first ~8 s of the step
	const reveal = $derived(reduced || rhythm ? 800 : 800 * smoothstep(0.3, 8, t));
	const shown = $derived(TEMPERATURE.filter((p) => p.ka <= reveal));
	const path = $derived(
		linePath(
			shown,
			(p) => p.ka,
			(p) => p.v,
			sx,
			sy
		)
	);
	const fill = $derived(
		shown.length > 1
			? `${path}L${sx(shown[shown.length - 1].ka).toFixed(1)} ${sy(0)}L${sx(shown[0].ka).toFixed(1)} ${sy(0)}Z`
			: ''
	);

	// cursor
	const look = $derived(clamp(Number(params.look ?? 21), 0, 800));
	const lookV = $derived(valueAt(TEMPERATURE, look));
	const lookOn = $derived(look <= reveal + 0.5);
	function lookFrom(event: PointerEvent) {
		const p = toSvg(event, event.currentTarget as SVGElement);
		setParam('look', Math.round(clamp(sx.invert(p.x), 0, 800)));
	}
	function onkeydown(e: KeyboardEvent) {
		const k = e.shiftKey ? 10 : 1;
		const map: Record<string, number> = { ArrowLeft: k, ArrowRight: -k, ArrowUp: -k, ArrowDown: k };
		if (e.key in map) setParam('look', clamp(look + map[e.key], 0, 800));
		else if (e.key === 'Home') setParam('look', 800);
		else if (e.key === 'End') setParam('look', 0);
		else return;
		e.preventDefault();
	}

	// rhythm: warm peaks of the last 450,000 years and the last cycle
	const peaksAll = warmPeaks(TEMPERATURE, -2.5, 40);
	const recent = peaksAll.filter((p) => p.ka < 450);
	const gaps = recent.slice(1).map((p, i) => ({ a: recent[i], b: p, kyr: p.ka - recent[i].ka }));
	const meanGap = (recent[recent.length - 1].ka - recent[0].ka) / (recent.length - 1);
	const lastPeak = recent[1];
	// end of the termination: the first point within 1 °C of today after the glacial
	const arrival = [...TEMPERATURE]
		.filter((p) => p.ka > 5 && p.ka < 40)
		.reverse()
		.find((p) => p.v > -1) as Point;
	// its start: the last point still within 1 °C of the glacial's coldest
	const coldest = Math.min(...TEMPERATURE.filter((p) => p.ka > 14 && p.ka < 40).map((p) => p.v));
	const deep = TEMPERATURE.find((p) => p.ka > arrival.ka && p.v < coldest + 1) as Point;
	const YB = sy(-10.5);
	const fall = Math.round(lastPeak.ka - deep.ka);
	const rise = Math.round(deep.ka - arrival.ka);
	const r = $derived(reduced ? 1 : smoothstep(0.4, 2.4, t));
</script>

<g>
	<rect
		x={X0}
		y={sy(5)}
		width={X1 - X0}
		height={sy(-11) - sy(5)}
		fill="var(--ia-cold)"
		opacity="0.35"
	/>
	<Axes
		{sx}
		{sy}
		xTicks={[800, 700, 600, 500, 400, 300, 200, 100, 0]}
		yTicks={[-10, -8, -6, -4, -2, 0, 2, 4]}
		xFormat={(v: number) => (v === 0 ? 'today' : String(v))}
		yFormat={(v: number) => signed(v, 0)}
		xLabel="thousand years ago"
		yLabel="°C, compared with the last 1,000 years"
	/>
	<line
		x1={X0}
		x2={X1}
		y1={sy(0)}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 3"
	/>
	<path d={fill} fill="var(--ia-temp)" opacity="0.12" />
	<path d={path} fill="none" stroke="var(--ia-temp)" stroke-width="1.6" stroke-linejoin="round" />

	<Readout id="title" order={0} label="Antarctic temperature" value="EPICA Dome C ice core">
		<Label
			x={X0}
			y={44}
			text="Antarctic temperature from the EPICA Dome C ice core"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	<Readout id="zero">
		<Label x={sx(560)} y={sy(0) - 8} text="the last 1,000 years" size={11} muted />
	</Readout>

	{#if !rhythm}
		{#if reveal < 800}
			<Readout id="drill">
				<Label
					x={sx(reveal)}
					y={sy(4.4)}
					text="reading the core… {Math.round(reveal)},000 years"
					anchor={reveal > 640 ? 'start' : 'middle'}
					size={12}
					muted
				/>
			</Readout>
		{/if}
		{#if reveal >= 800}
			<Readout id="labels">
				<Label x={sx(129)} y={sy(4.4)} text="interglacial" size={12} weight={600} />
				<Label x={sx(70)} y={sy(-10.4)} text="glacial period" size={12} weight={600} />
			</Readout>
		{/if}
	{/if}

	{#if rhythm}
		<g opacity={r}>
			{#each recent as p (p.ka)}
				<circle cx={sx(p.ka)} cy={sy(p.v)} r="5" fill="var(--ia-sun)" />
			{/each}
			{#each gaps as g (g.a.ka)}
				{@const y = sy(4.6)}
				<line
					x1={sx(g.a.ka) - 4}
					x2={sx(g.b.ka) + 4}
					y1={y}
					y2={y}
					stroke="var(--ia-sun)"
					stroke-width="1.5"
				/>
				<line x1={sx(g.a.ka)} x2={sx(g.a.ka)} y1={y - 5} y2={y + 5} stroke="var(--ia-sun)" />
				<line x1={sx(g.b.ka)} x2={sx(g.b.ka)} y1={y - 5} y2={y + 5} stroke="var(--ia-sun)" />
				<Readout id="gap-{g.a.ka}">
					<Label
						x={(sx(g.a.ka) + sx(g.b.ka)) / 2}
						y={y - 8}
						text="{Math.round(g.kyr)},000 yr"
						size={12}
						weight={600}
						color="var(--ia-sun)"
					/>
				</Readout>
			{/each}
			<Readout
				id="mean"
				order={1}
				label="Warm peaks"
				value="every {Math.round(meanGap)},000 years on average"
				color="var(--ia-sun)"
			>
				<Label
					x={X1}
					y={72}
					text="warm peaks: every {Math.round(meanGap)},000 years on average"
					anchor="end"
					size={13}
					weight={700}
					color="var(--ia-sun)"
				/>
			</Readout>
			<!-- the last cycle: slow fall, fast rise -->
			<path
				d="M{sx(lastPeak.ka)} {YB - 5} V{YB} H{sx(deep.ka)} V{YB - 5}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.3"
			/>
			<path
				d="M{sx(deep.ka) + 2} {sy(deep.v) + 10} L{sx(arrival.ka) + 2} {sy(arrival.v) + 12}"
				stroke="var(--ia-now)"
				stroke-width="2.5"
				fill="none"
				marker-end="url(#arrowhead)"
			/>
			<Readout
				id="fall"
				order={2}
				label="Last glacial"
				value="cooled for {fall},000 years, ended in about {rise},000"
			>
				<Label
					x={sx((lastPeak.ka + deep.ka) / 2)}
					y={YB + 16}
					text="slow cooling: {fall},000 years"
					size={12}
					weight={600}
				/>
				<Label
					x={sx(arrival.ka) - 8}
					y={sy(2.4)}
					text="fast end:"
					anchor="end"
					size={12}
					weight={700}
					color="var(--ia-now)"
				/>
				<Label
					x={sx(arrival.ka) - 8}
					y={sy(2.4) + 16}
					text="{rise},000 years"
					anchor="end"
					size={12}
					weight={700}
					color="var(--ia-now)"
				/>
			</Readout>
			<Readout id="cool">
				<line
					x1={sx(800)}
					x2={sx(430)}
					y1={sy(1.2)}
					y2={sy(1.2)}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 3"
				/>
				<Label
					x={sx(615)}
					y={sy(1.2) - 8}
					text="before ~430,000 years ago: cooler interglacials"
					size={11}
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- cursor -->
	{#if lookOn && !rhythm}
		<line
			x1={sx(look)}
			x2={sx(look)}
			y1={sy(5)}
			y2={sy(-11)}
			stroke="var(--stage-ink)"
			stroke-width="1"
			opacity="0.5"
		/>
		<circle
			cx={sx(look)}
			cy={sy(lookV)}
			r="6"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Readout
			id="look"
			order={3}
			label={agoText(look)}
			value="Antarctica {signed(lookV)} °C"
			color="var(--ia-temp)"
		>
			<Label
				x={clamp(sx(look), X0 + 110, X1 - 110)}
				y={sy(-11) + 52}
				text="{agoText(look)}: {signed(lookV)} °C"
				size={14}
				weight={700}
				pill
			/>
		</Readout>
	{/if}

	<rect
		x={X0}
		y={sy(5)}
		width={X1 - X0}
		height={sy(-11) - sy(5)}
		fill="transparent"
		role="slider"
		tabindex="0"
		aria-label="Point in the record"
		aria-valuemin={0}
		aria-valuemax={800}
		aria-valuenow={look}
		aria-valuetext="{agoText(look)}, {signed(lookV)} degrees"
		style:outline="none"
		style:cursor="crosshair"
		style:touch-action="pan-y"
		onpointermove={lookFrom}
		onpointerdown={lookFrom}
		{onkeydown}
	/>
</g>
