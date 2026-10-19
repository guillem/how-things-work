<script lang="ts">
	/**
	 * One pulse and the range-Doppler map of 32 (../model.ts `rangeDoppler`, `detections`):
	 * a car at 3.5 km closing at 25 m/s, a small boat at 7.1 km closing at 12 m/s and a
	 * helicopter at 11 km opening at 45 m/s, in ground clutter and noise. Top: a single pulse's
	 * echo per 200 m range cell, in dB above the noise. Below: the map, range across and radial
	 * speed up (toward the radar) and down, drawn in 6 dB shades of one colour (one path per
	 * shade); the clutter notch (±5 m/s) is shaded. Detections, cells 13 dB over the noise outside
	 * the notch, are ringed and labelled. Everything is shown relative to the current noise level,
	 * so the extra-noise control makes targets sink into the floor. A scan line sweeps the map
	 * (6 s) and is hidden under reduced motion. Hint `detect` adds the threshold and the tally.
	 */
	import { Axes, Label, clamp, cycle, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MAP_CELL, MAP_CELLS, RADAR, detections, rangeDoppler } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const detect = $derived(step.hints?.detect === true);
	const clutter = $derived(params.clutter !== false);
	const extra = $derived(detect ? Number(params.noise ?? 0) : 0);
	const TARGETS = [
		{ r: 3500, rcs: 5, v: 25, name: 'car' },
		{ r: 7100, rcs: 0.5, v: 12, name: 'boat' },
		{ r: 11000, rcs: 3, v: -45, name: 'helicopter' }
	];
	const map = $derived(rangeDoppler(TARGETS, { clutter, extraNoiseDb: extra }));
	const hits = $derived(detections(map, 13 + extra));

	const RMAX = MAP_CELL * MAP_CELLS;
	const sx = scale([0, RMAX], [90, 900]);
	const syP = scale([0, 60], [170, 70]);
	const N = RADAR.pulses;
	const dv = (RADAR.prf * RADAR.lambda) / 2 / N; // m/s per Doppler bin
	const vBot = (-RADAR.prf / 2) * (RADAR.lambda / 2) - dv / 2;
	const vTop = vBot + N * dv;
	const sy = scale([vBot, vTop], [550, 230]);

	const pulsePath = $derived(
		linePath(
			map.pulse.map((p, i) => ({ r: map.ranges[i], p: clamp(p - extra, 0, 60) })),
			(d) => d.r,
			(d) => d.p,
			sx,
			syP
		)
	);

	// heat: one path per 6 dB shade
	const SHADES = 9;
	const heat = $derived.by(() => {
		const paths: string[] = Array.from({ length: SHADES }, () => '');
		const w = sx(MAP_CELL) - sx(0);
		const h = sy(vBot) - sy(vBot + dv);
		map.cells.forEach((row, i) =>
			row.forEach((p, b) => {
				const level = Math.floor((p - extra) / 6);
				if (level < 1) return;
				const k = Math.min(SHADES, level) - 1;
				const x = sx(i * MAP_CELL);
				const y = sy(map.speeds[b] + dv / 2);
				paths[k] +=
					`M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}Z`;
			})
		);
		return paths;
	});

	const scan = $derived(reduced ? -1 : cycle(t, 6) * RMAX);
	const nameOf = (r: number) => TARGETS.find((tg) => Math.abs(tg.r - r) < 400)?.name ?? '?';
	const found = $derived(TARGETS.filter((tg) => hits.some((h) => Math.abs(h.r - tg.r) < 400)));
	const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}`;
</script>

<g>
	<Readout id="title" order={1} label="Range-Doppler" value="32 pulses, range × speed">
		<Label
			x={24}
			y={34}
			text={detect
				? 'raise the noise: targets drop below the threshold one by one'
				: 'one pulse, then 32: range across, speed up and down'}
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- one pulse -->
	<Axes {sx} sy={syP} xTicks={[]} yTicks={[0, 30, 60]} yLabel="one pulse (dB)" />
	<path d={pulsePath} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.2" />
	<Readout id="pl">
		<Label
			x={900}
			y={62}
			text={clutter ? 'one pulse: the ground echoes everywhere' : 'one pulse, no clutter'}
			size={12}
			anchor="end"
			muted
		/>
	</Readout>
	{#each TARGETS as tg (tg.name)}
		<path d="M{sx(tg.r)} {syP(0) + 3} l-4 7 h8 Z" fill="var(--stage-ink-muted)" />
	{/each}

	<!-- the map -->
	<rect
		x={sx(0)}
		y={sy(vTop)}
		width={sx(RMAX) - sx(0)}
		height={sy(vBot) - sy(vTop)}
		fill="var(--surface)"
		opacity="0.6"
	/>
	{#each heat as d, k (k)}
		<path {d} fill="var(--rs-heat)" opacity={(k + 1) / SHADES} />
	{/each}
	<rect
		x={sx(0)}
		y={sy(5)}
		width={sx(RMAX) - sx(0)}
		height={sy(-5) - sy(5)}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
		opacity="0.7"
	/>
	<Readout id="notch">
		<Label
			x={sx(RMAX) - 6}
			y={sy(5) - 6}
			text="clutter notch: ±5 m/s ignored"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={[0, 2500, 5000, 7500, 10000, 12500, 15000]}
		xFormat={(v) => `${v / 1000}`}
		yTicks={[-50, -25, 0, 25, 50]}
		yFormat={(v) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'))}
		xLabel="range (km)"
		yLabel="speed (m/s, + toward)"
		grid={false}
	/>
	{#if scan >= 0}
		<line
			x1={sx(scan)}
			x2={sx(scan)}
			y1={sy(vTop)}
			y2={sy(vBot)}
			stroke="var(--rs-pulse)"
			stroke-width="1.2"
			opacity="0.5"
		/>
	{/if}

	{#each hits as h (h.r * 1000 + h.v)}
		{@const cx = sx(h.r)}
		{@const cy = sy(h.v)}
		<circle {cx} {cy} r="13" fill="none" stroke="var(--rs-hit)" stroke-width="2" />
		<Readout
			id="hit{h.r}"
			order={3}
			label={nameOf(h.r)}
			value="{(h.r / 1000).toFixed(1)} km, {signed(h.v)} m/s"
			color="var(--rs-hit)"
		>
			<Label
				x={cx + (h.r > 11000 ? -18 : 18)}
				y={cy + (h.v > 0 ? -14 : 24)}
				text="{nameOf(h.r)}: {(h.r / 1000).toFixed(1)} km, {signed(h.v)} m/s"
				size={12}
				weight={600}
				anchor={h.r > 11000 ? 'end' : 'start'}
				color="var(--rs-hit)"
			/>
		</Readout>
	{/each}

	{#if detect}
		<Readout
			id="tally"
			order={2}
			label="Targets found"
			value="{found.length} of 3, threshold 13 dB over the noise"
		>
			<Label
				x={936}
				y={34}
				text="found {found.length} of 3 · threshold 13 dB over the noise"
				size={13}
				weight={700}
				anchor="end"
				color={found.length === 3 ? 'var(--rs-a)' : 'var(--rs-hit)'}
				tabular
			/>
		</Readout>
	{/if}
</g>
