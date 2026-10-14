<script lang="ts">
	/**
	 * Elastic rebound (Reid 1910): a fault seen from above, with a road painted across it.
	 * The two sides creep past each other, but the fault is locked, so the road bends; then the
	 * fault slips, the road springs straight with an offset, and waves spread from the
	 * epicentre. Beside it, a cut through the ground across the fault: hypocentre and epicentre.
	 *
	 * One cycle lasts 13 s: 0–7 s the strain builds (decades, sped up), 7–7.5 s the slip, 7.5–12 s
	 * the waves, then the road is repainted for the next cycle. Reduced motion shows the moment
	 * after the slip, with the waves on their way.
	 */
	import { Label, cycle, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const PERIOD = 13;
	const LOAD = 7;
	const SLIP = 0.5;
	const u = $derived(reduced ? LOAD + 1.6 : cycle(t, PERIOD) * PERIOD);
	/** Far-field shift of each side, px: grows while loading, held after the slip. */
	const D = 46;
	const load = $derived(Math.min(1, u / LOAD));
	/** How much of the stored bending has been released (0 → 1 during the slip). */
	const slip = $derived(smoothstep(LOAD, LOAD + SLIP, u));
	const repaint = $derived(1 - smoothstep(PERIOD - 0.8, PERIOD - 0.2, u));
	const since = $derived(u - LOAD);

	// ---- top view -----------------------------------------------------------------------
	const MAP = { x: 30, y: 70, w: 500, h: 440 };
	const FY = MAP.y + MAP.h / 2; // the fault, running left–right
	const ROAD_X = MAP.x + MAP.w / 2;
	const W = 70; // px over which the locked fault bends the ground
	/** Shift of the ground at distance `dy` from the fault (positive: north side to the right). */
	const shift = (dy: number) => {
		const far = D * load * Math.sign(dy);
		const bent = far * (1 - Math.exp(-Math.abs(dy) / W));
		return bent + (far - bent) * slip;
	};
	const road = $derived.by(() => {
		const half = (from: number, to: number) => {
			const pts: string[] = [];
			const n = 30;
			for (let i = 0; i <= n; i++) {
				const y = from + ((to - from) * i) / n;
				pts.push(`${i ? 'L' : 'M'}${(ROAD_X + shift(FY - y)).toFixed(1)} ${y.toFixed(1)}`);
			}
			return pts.join('');
		};
		return { north: half(MAP.y + 6, FY - 0.5), south: half(FY + 0.5, MAP.y + MAP.h - 6) };
	});
	const half = (x0: number, from: number, to: number) =>
		Array.from({ length: 13 }, (_, i) => {
			const y = from + ((to - from) * i) / 12;
			return `${i ? 'L' : 'M'}${(x0 + shift(FY - y)).toFixed(1)} ${y.toFixed(1)}`;
		}).join('');
	/** A field boundary parallel to the road, deformed like it (recomputed with `shift`). */
	const gridLine = (x0: number) => half(x0, MAP.y, FY - 0.5) + half(x0, FY + 0.5, MAP.y + MAP.h);
	const strainShown = $derived(load * (1 - slip));
	// The epicentre, on the fault beside the road.
	const EPI = { x: ROAD_X - 120, y: FY };
	const waveR = $derived(since > 0 ? since * 90 : 0);
	const waveO = $derived(since > 0 ? 1 - smoothstep(2.5, 5, since) : 0);

	// ---- the cut across the fault ----------------------------------------------------------
	const SEC = { x: 590, y: 200, w: 340, h: 250 };
	const FX = SEC.x + SEC.w / 2;
	const HYPO = { x: FX, y: SEC.y + 150 };
	const ringR = $derived(since > 0 ? since * 70 : 0);

	const years = $derived(Math.round(load * 150));
	const stage = $derived(
		u < LOAD
			? `Strain builds up: ${years} years`
			: u < LOAD + SLIP + 0.3
				? 'The fault slips: a few seconds'
				: 'Seismic waves spread out'
	);
</script>

<g class="fault-scene">
	<defs>
		<clipPath id="fault-scene-map">
			<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} rx="8" />
		</clipPath>
		<clipPath id="fault-scene-sec">
			<rect x={SEC.x} y={SEC.y} width={SEC.w} height={SEC.h} />
		</clipPath>
	</defs>

	<Readout id="f-title">
		<text x={MAP.x} y={MAP.y - 22} style:font-size="14px" style:font-weight="600"
			>Seen from above</text
		>
	</Readout>
	<Readout id="f-stage" order={1} label="Now" value={stage}>
		<text
			x={MAP.x + MAP.w}
			y={MAP.y - 22}
			text-anchor="end"
			style:font-size="15px"
			style:font-weight="600">{stage}</text
		>
	</Readout>

	<!-- top view: two sides of the fault -->
	<g clip-path="url(#fault-scene-map)">
		<rect x={MAP.x} y={MAP.y} width={MAP.w} height={MAP.h} fill="var(--pt-land)" />
		<!-- fields: a grid that deforms like the road -->
		{#each [-3, -2, -1, 1, 2, 3] as k (k)}
			{@const x0 = ROAD_X + k * 80}
			<path d={gridLine(x0)} stroke="var(--pt-land-edge)" stroke-width="1" fill="none" />
		{/each}
		<!-- the road, repainted straight at the end of each cycle -->
		<g opacity={repaint}>
			<path d={road.north} stroke="var(--stage-ink-muted)" stroke-width="12" fill="none" />
			<path d={road.south} stroke="var(--stage-ink-muted)" stroke-width="12" fill="none" />
			<path
				d={road.north + road.south}
				stroke="var(--stage-bg)"
				stroke-width="1.6"
				stroke-dasharray="8 8"
				fill="none"
			/>
		</g>
		<!-- the fault -->
		<path d="M{MAP.x} {FY}H{MAP.x + MAP.w}" stroke="var(--eq-quake)" stroke-width="2.4" />
		<!-- waves from the epicentre -->
		{#if waveO > 0.01}
			{#each [0, 0.5, 1] as lag (lag)}
				{@const r = Math.max(0, waveR - lag * 70)}
				{#if r > 0}
					<circle
						cx={EPI.x}
						cy={EPI.y}
						{r}
						fill="none"
						stroke="var(--eq-p)"
						stroke-width="2"
						opacity={waveO * (1 - lag * 0.3)}
					/>
				{/if}
			{/each}
		{/if}
	</g>
	<rect
		x={MAP.x}
		y={MAP.y}
		width={MAP.w}
		height={MAP.h}
		rx="8"
		fill="none"
		stroke="var(--border)"
	/>

	<!-- how the sides move -->
	<path
		d="M{MAP.x + 40} {MAP.y + 40}h70"
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<path
		d="M{MAP.x + MAP.w - 40} {MAP.y + MAP.h - 40}h-70"
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="f-plates">
		<Label x={MAP.x + 40} y={MAP.y + 62} text="this side creeps east" anchor="start" size={12} />
		<Label
			x={MAP.x + MAP.w - 40}
			y={MAP.y + MAP.h - 52}
			text="this side creeps west"
			anchor="end"
			size={12}
		/>
	</Readout>
	<Readout
		id="f-fault"
		order={2}
		label="Fault"
		value="locked by friction, then slips"
		color="var(--eq-quake)"
	>
		<Label
			x={MAP.x + MAP.w - 12}
			y={FY - 10}
			text="fault"
			anchor="end"
			color="var(--eq-quake)"
			weight={600}
		/>
	</Readout>
	<Readout
		id="f-strain"
		order={3}
		label="The road"
		value={u < LOAD ? 'bending' : 'straight again, offset across the fault'}
	>
		<Label
			x={ROAD_X - D + 40}
			y={FY + 110}
			text={u < LOAD
				? strainShown > 0.2
					? 'the ground bends'
					: 'a road across the fault'
				: 'sprung back straight, offset'}
			anchor="start"
			size={12}
			pill
		/>
	</Readout>
	{#if since > 0}
		<path
			transform="translate({EPI.x} {EPI.y})"
			d="M0 -9 L2.6 -3 9 -2.8 4 1.4 5.6 8 0 4.4 -5.6 8 -4 1.4 -9 -2.8 -2.6 -3 Z"
			fill="var(--eq-quake)"
			stroke="var(--stage-bg)"
		/>
		<Readout id="f-epi">
			<Label
				x={EPI.x}
				y={EPI.y + 26}
				text="epicentre"
				size={12}
				weight={600}
				opacity={waveO + 0.4}
			/>
		</Readout>
	{/if}

	<!-- the cut across the fault -->
	<Readout id="s-title">
		<text x={SEC.x} y={SEC.y - 48} style:font-size="14px" style:font-weight="600"
			>A cut through the ground</text
		>
	</Readout>
	<g clip-path="url(#fault-scene-sec)">
		<rect x={SEC.x} y={SEC.y} width={SEC.w} height={SEC.h} fill="var(--eq-mantle)" />
		<rect x={SEC.x} y={SEC.y} width={SEC.w} height="10" fill="var(--pt-land)" />
		<path d="M{FX} {SEC.y}L{FX + 6} {SEC.y + SEC.h}" stroke="var(--eq-quake)" stroke-width="2.4" />
		{#if since > 0}
			{#each [0, 0.6] as lag (lag)}
				{@const r = Math.max(0, ringR - lag * 60)}
				{#if r > 0}
					<circle
						cx={HYPO.x}
						cy={HYPO.y}
						{r}
						fill="none"
						stroke="var(--eq-p)"
						stroke-width="2"
						opacity={waveO * (1 - lag * 0.4)}
					/>
				{/if}
			{/each}
		{/if}
	</g>
	<rect x={SEC.x} y={SEC.y} width={SEC.w} height={SEC.h} fill="none" stroke="var(--border)" />
	<path
		d="M{FX} {SEC.y - 4}V{SEC.y - 22}"
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-dasharray="3 3"
	/>
	<path d="M{FX} {SEC.y - 2}l-6 -10h12z" fill="var(--eq-quake)" opacity={since > 0 ? 1 : 0.35} />
	<Readout id="s-epi" order={4} label="Epicentre" value="the point on the surface above">
		<Label x={FX} y={SEC.y - 28} text="epicentre: on the surface, straight above" size={12} />
	</Readout>
	<path
		transform="translate({HYPO.x} {HYPO.y})"
		d="M0 -9 L2.6 -3 9 -2.8 4 1.4 5.6 8 0 4.4 -5.6 8 -4 1.4 -9 -2.8 -2.6 -3 Z"
		fill="var(--eq-quake)"
		stroke="var(--stage-bg)"
		opacity={since > 0 ? 1 : 0.45}
	/>
	<Readout id="s-hypo" order={5} label="Hypocentre" value="where the rupture starts, km down">
		<Label x={HYPO.x + 14} y={HYPO.y + 4} text="hypocentre" anchor="start" size={12} weight={600} />
		<Label
			x={HYPO.x + 14}
			y={HYPO.y + 20}
			text="where the slip starts"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
	<Readout id="s-depth">
		<Label x={SEC.x + 8} y={HYPO.y + 4} text="~10 km" anchor="start" size={11} muted />
		<path
			d="M{SEC.x + 60} {SEC.y + 10}V{HYPO.y - 6}"
			stroke="var(--stage-ink-muted)"
			marker-end="url(#arrowhead)"
		/>
	</Readout>
	<Readout
		id="s-note"
		order={6}
		label="Speed-up"
		value="decades of bending in 7 s; the slip takes seconds"
	>
		<text x={SEC.x} y={SEC.y + SEC.h + 34} class="muted" style:font-size="12px"
			>Drawing sped up: decades of bending take 7 s,</text
		>
		<text x={SEC.x} y={SEC.y + SEC.h + 52} class="muted" style:font-size="12px"
			>the slip itself really takes a few seconds.</text
		>
	</Readout>
</g>
