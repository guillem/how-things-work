<script lang="ts">
	/**
	 * A moving target and its Doppler shift (../model.ts `radialSpeed`, `slowTime`, `spectrum`).
	 * Left: the radar and a car seen from above, its velocity arrow at the heading control's
	 * angle off the line of sight, and the arrow's radial part along that line; the car drifts
	 * along its heading and back (a 6 s loop). Right: the speeds. Middle row: the echo's phase on
	 * each of 32 pulses, as a pointer per pulse (relative to the first); a highlight walks along
	 * the row. Bottom: the spectrum of those 32 phases (128 bins), peaking at the Doppler
	 * frequency, with the speed it stands for. Reduced motion: the car at its mark, no highlight.
	 */
	import { Axes, Label, clamp, linePath, pingpong, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { RADAR, dopplerShift, radialSpeed, slowTime, spectrum } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const speed = $derived(Number(params.speed ?? 30));
	const heading = $derived(Number(params.heading ?? 0));
	const vr = $derived(radialSpeed(speed, heading));
	const fd = $derived(dopplerShift(vr));
	const N = RADAR.pulses;
	const phases = $derived(slowTime(6000, vr));
	const spec = $derived(spectrum(phases, 128));
	const turn = $derived((((((fd / RADAR.prf) * 360) % 360) + 540) % 360) - 180);

	// plan view: radar at R, car at P; heading 0 = straight at the radar (towards −x)
	const R = { x: 80, y: 210 };
	const P0 = { x: 340, y: 210 };
	const th = $derived((heading * Math.PI) / 180);
	const dir = $derived({ x: -Math.cos(th), y: -Math.sin(th) });
	const drift = $derived(reduced ? 0 : (pingpong(t, 6) - 0.5) * 40 * (speed / 55));
	const P = $derived({ x: P0.x + dir.x * drift, y: P0.y + dir.y * drift });
	const L = $derived(2.4 * speed); // arrow length per m/s
	const tip = $derived({ x: P.x + dir.x * L, y: P.y + dir.y * L });
	const rad = $derived({ x: P.x - L * Math.cos(th), y: P.y });

	// the 32 phase pointers
	const x0 = 72;
	const dx = (888 - 72) / (N - 1);
	const PY = 372;
	const lit = $derived(reduced ? -1 : Math.floor(((t % 4) / 4) * N));
	const PULSES = Array.from({ length: N }, (_, k) => k);
	const rel = (k: number) => phases[k] - phases[0];

	const sx = scale([-4, 4], [90, 900]);
	const sy = scale([0, 1], [552, 430]);
	const freqs = Array.from(
		{ length: 128 },
		(_, b) => (-RADAR.prf / 2 + (b * RADAR.prf) / 128) / 1000
	);
	const specPath = $derived(
		linePath(
			spec.map((p, b) => ({ f: freqs[b], p })),
			(d) => d.f,
			(d) => d.p,
			sx,
			sy
		)
	);
	const fdk = $derived(fd / 1000);
	const f1 = (v: number) => v.toFixed(1).replace('-', '−');
	const f2 = (v: number) => v.toFixed(2).replace('-', '−');
	const f0 = (v: number) => Math.round(v).toFixed(0).replace('-', '−');
</script>

<g>
	<Readout id="title" order={1} label="Doppler" value="speed from the echo's pitch">
		<Label
			x={24}
			y={34}
			text="speed from the echo's pitch: only the part toward the radar counts"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- plan view -->
	<line x1={R.x} x2={620} y1={R.y} y2={R.y} stroke="var(--stage-line)" stroke-dasharray="2 4" />
	<Readout id="los">
		<Label x={620} y={R.y - 8} text="line of sight" size={11} anchor="end" muted />
	</Readout>
	<circle cx={R.x} cy={R.y} r="10" fill="var(--stage-ink)" />
	<Label x={R.x} y={R.y + 30} text="radar" size={12} muted />
	<!-- velocity and its radial part -->
	{#if speed > 0}
		<line
			x1={P.x}
			y1={P.y}
			x2={tip.x}
			y2={tip.y}
			stroke="var(--rs-b)"
			stroke-width="3"
			marker-end="url(#arrowhead)"
		/>
		{#if Math.abs(vr) > 0.5}
			<line
				x1={P.x}
				y1={P.y + 26}
				x2={rad.x}
				y2={P.y + 26}
				stroke="var(--rs-a)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
		{/if}
		<line
			x1={tip.x}
			y1={tip.y}
			x2={rad.x}
			y2={P.y + 26}
			stroke="var(--stage-line)"
			stroke-dasharray="3 3"
		/>
	{/if}
	<rect
		x={P.x - 14}
		y={P.y - 8}
		width="28"
		height="16"
		rx="5"
		fill="var(--rs-b)"
		transform="rotate({heading} {P.x} {P.y})"
	/>
	<Readout
		id="v"
		order={2}
		label="Speed"
		value="{speed} m/s, heading {heading}°"
		color="var(--rs-b)"
	>
		<Label
			x={clamp(tip.x, 120, 600)}
			y={clamp(tip.y - 14, 70, 320)}
			text="v = {speed} m/s"
			size={12}
			weight={600}
			color="var(--rs-b)"
		/>
	</Readout>
	<Readout
		id="vr"
		order={3}
		label="Radial speed"
		value="v cos θ = {f1(vr)} m/s"
		color="var(--rs-a)"
	>
		<Label
			x={P.x + 30}
			y={P.y + 54}
			text="radial: v cos {heading}° = {f1(vr)} m/s"
			size={12}
			weight={600}
			color="var(--rs-a)"
			anchor="start"
		/>
	</Readout>

	<!-- right: the numbers -->
	<g>
		<Readout id="fd" order={4} label="Doppler shift" value="2v ÷ λ = {f2(fd / 1000)} kHz">
			<Label x={936} y={96} text="Doppler shift 2 × v cos θ ÷ λ" size={13} anchor="end" muted />
			<Label
				x={936}
				y={124}
				text="= {f2(fd / 1000)} kHz"
				size={18}
				weight={700}
				anchor="end"
				tabular
			/>
		</Readout>
		<Readout id="carrier">
			<Label x={936} y={150} text="on a 10 GHz carrier (λ = 3 cm)" size={11} anchor="end" muted />
		</Readout>
		<Readout id="turn" order={5} label="Phase turn per pulse" value="{f0(turn)}°">
			<Label
				x={936}
				y={190}
				text="8,000 pulses a second: the echo's phase"
				size={12}
				anchor="end"
				muted
			/>
			<Label
				x={936}
				y={208}
				text="turns {f0(turn)}° from one pulse to the next"
				size={12}
				anchor="end"
				tabular
			/>
		</Readout>
	</g>

	<!-- the phase on each pulse -->
	<Readout id="rowlab">
		<Label
			x={x0 - 12}
			y={PY - 26}
			text="echo phase, pulse by pulse (32 pulses, 4 ms)"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
	{#each PULSES as k (k)}
		{@const cx = x0 + k * dx}
		{@const a = rel(k)}
		<circle
			{cx}
			cy={PY}
			r="10"
			fill="none"
			stroke="var(--stage-line)"
			opacity={k === lit ? 1 : 0.7}
		/>
		<line
			x1={cx}
			y1={PY}
			x2={cx + 9 * Math.cos(a)}
			y2={PY - 9 * Math.sin(a)}
			stroke={k === lit ? 'var(--rs-pulse)' : 'var(--rs-a)'}
			stroke-width={k === lit ? 2.6 : 1.8}
			stroke-linecap="round"
		/>
	{/each}

	<!-- its spectrum -->
	<Axes {sx} {sy} xTicks={[-4, -2, 0, 2, 4]} yTicks={[]} xLabel="Doppler (kHz)" grid={false} />
	<path d={specPath} fill="none" stroke="var(--rs-a)" stroke-width="2" />
	<line
		x1={sx(fdk)}
		x2={sx(fdk)}
		y1={sy(0)}
		y2={sy(1.05)}
		stroke="var(--rs-a)"
		stroke-dasharray="3 3"
	/>
	<Readout id="peak">
		<Label
			x={clamp(sx(fdk) + (fdk > 2 ? -10 : 10), 100, 890)}
			y={sy(1) - 6}
			text="peak at {f2(fdk)} kHz = {f1(vr)} m/s {vr > 0.5 ? 'toward' : vr < -0.5 ? 'away' : ''}"
			size={12}
			weight={600}
			anchor={fdk > 2 ? 'end' : 'start'}
			color="var(--rs-a)"
		/>
	</Readout>
	<Readout id="spec">
		<Label x={90} y={sy(1) - 6} text="spectrum of the 32 phases" size={11} anchor="start" muted />
	</Readout>
</g>
