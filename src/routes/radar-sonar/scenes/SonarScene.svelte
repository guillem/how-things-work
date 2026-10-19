<script lang="ts">
	/**
	 * The same 10 km job in air and in seawater (../model.ts `soundSpeed`, `soundAbsorption`,
	 * `skinDepth`). Top: above the surface a radar and an aircraft 10 km away, below it a ship's
	 * sonar and a submarine 10 km away, each lane with its numbers; the medium control brings
	 * one lane forward. On one slowed clock (the sonar's 13.4 s round trip in 6 s, then a 2 s
	 * pause) the sound pulse crawls out and back, while the radar's echo is home before the first
	 * frame. Under the ship, a radio wave dies within a few metres. Bottom: Thorp's absorption of
	 * sound in seawater against frequency (log-log), with the frequency control's point and its
	 * consequences. Reduced motion: the ping at the submarine, no pulse in flight elsewhere.
	 */
	import { Axes, Label, clamp, cycle, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, skinDepth, soundAbsorption, soundSpeed } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const water = $derived(String(params.medium ?? 'water') === 'water');
	const f = $derived(Number(params.freq ?? 3000));
	const T = $derived(Number(params.temp ?? 10));
	const c = $derived(soundSpeed(T));
	const D = 10_000;
	const delay = $derived((2 * D) / c);
	const alpha = $derived(soundAbsorption(f));

	const X0 = 120;
	const X1 = 700;
	const SURF = 150;
	const AIR = 104;
	const SEA = 232;
	const lx = (r: number) => X0 + (r / D) * (X1 - X0);

	// the slowed clock: 6 s for the sonar's round trip, then 2 s of quiet
	const u = $derived(reduced ? 0.5 : clamp((cycle(t, 8) * 8) / 6));
	const soundAt = $derived(u <= 0.5 ? (u / 0.5) * D : ((1 - u) / 0.5) * D);
	const oSound = $derived(reduced ? 0 : u < 1 ? 1 : 0);
	const elapsed = $derived(u * delay);

	const sx = scale([2, 5], [90, 600]);
	const sy = scale([-3, 2], [550, 340]);
	const curve = Array.from({ length: 61 }, (_, i) => 2 + (i * 3) / 60)
		.map(
			(lf, i) =>
				`${i ? 'L' : 'M'}${sx(lf).toFixed(1)} ${sy(Math.log10(soundAbsorption(10 ** lf))).toFixed(1)}`
		)
		.join(' ');
	const fText = (v: number) => (v >= 1000 ? `${v / 1000} kHz` : `${v} Hz`);
	const lossText = (db: number) =>
		db >= 100 ? Math.round(db).toLocaleString('en-US') : db.toFixed(1);
	const skin = skinDepth(10e3);
</script>

<g>
	<Readout id="title" order={1} label="Sonar" value="the same 10 km in air and in water">
		<Label
			x={24}
			y={34}
			text="the same 10 km: radio in air, sound in seawater"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- the sea -->
	<rect x="16" y={SURF} width="928" height="140" rx="6" fill="var(--rs-sea)" />
	<line x1="16" x2="944" y1={SURF} y2={SURF} stroke="var(--rs-sea-edge)" stroke-width="1.5" />

	<!-- air lane: radar to an aircraft -->
	<g opacity={water ? 0.45 : 1}>
		<line x1={X0 - 40} x2={X0 - 40} y1={SURF} y2={AIR} stroke="var(--stage-ink)" stroke-width="2" />
		<path
			d="M{X0 - 52} {AIR - 14} Q{X0 - 28} {AIR} {X0 - 52} {AIR + 14}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={AIR}
			y2={AIR}
			stroke="var(--rs-pulse)"
			stroke-width="2"
			opacity="0.8"
		/>
		<path
			d="M{X1 +
				6} {AIR} l18 -4 l10 -10 l4 0 l-4 12 l14 0 l4 -6 l3 0 l-2 8 l2 8 l-3 0 l-4 -6 l-14 0 l4 12 l-4 0 l-10 -10 Z"
			fill="var(--stage-ink-muted)"
		/>
		<Readout
			id="air"
			order={water ? 4 : 2}
			label="Radar in air"
			value="echo from 10 km after 66.7 µs"
			color="var(--rs-pulse)"
		>
			<Label
				x={X0}
				y={AIR - 14}
				text="radio, {Math.round(C / 1000).toLocaleString('en-US')} km/s: echo back after 66.7 µs"
				size={12}
				anchor="start"
				weight={600}
				color="var(--rs-pulse)"
			/>
			<Label
				x={X0}
				y={AIR + 20}
				text="up to 15,000 pulses a second; sound would have gone 10 cm"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	</g>

	<!-- sea lane: sonar to a submarine -->
	<g opacity={water ? 1 : 0.45}>
		<path d="M{X0 - 76} {SURF - 12} h70 l-10 18 h-50 Z" fill="var(--stage-ink-muted)" />
		<circle cx={X0 - 40} cy={SEA - 40} r="5" fill="var(--rs-a)" />
		<line
			x1={X0 - 40}
			x2={X0 - 40}
			y1={SURF + 6}
			y2={SEA - 40}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<line
			x1={X0}
			x2={X1}
			y1={SEA}
			y2={SEA}
			stroke="var(--rs-a)"
			stroke-dasharray="3 5"
			opacity="0.6"
		/>
		<ellipse cx={X1 + 30} cy={SEA} rx="34" ry="9" fill="var(--stage-ink-muted)" />
		<rect x={X1 + 22} y={SEA - 17} width="12" height="10" rx="2" fill="var(--stage-ink-muted)" />
		{#if oSound > 0}
			<path
				d="M{lx(soundAt) + (u <= 0.5 ? -4 : 4)} {SEA - 14} Q{lx(soundAt) +
					(u <= 0.5 ? 10 : -10)} {SEA} {lx(soundAt) + (u <= 0.5 ? -4 : 4)} {SEA + 14}"
				fill="none"
				stroke="var(--rs-a)"
				stroke-width="3.5"
				stroke-linecap="round"
			/>
		{/if}
		<Readout
			id="sea"
			order={water ? 2 : 4}
			label="Sonar in seawater"
			value="{c.toFixed(1)} m/s: echo after {delay.toFixed(1)} s"
			color="var(--rs-a)"
		>
			<Label
				x={X0}
				y={SEA - 16}
				text="sound, {c.toFixed(1)} m/s at {T} °C: echo back after {delay.toFixed(1)} s"
				size={12}
				anchor="start"
				weight={600}
				color="var(--rs-a)"
			/>
			<Label
				x={X0}
				y={SEA + 26}
				text="one ping every {delay.toFixed(0)} s at most{reduced
					? ''
					: ` · ${elapsed.toFixed(1)} s since this one`}"
				size={11}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	</g>
	<!-- radio dies in the water -->
	<g opacity={water ? 0.55 : 1}>
		<path
			d={Array.from(
				{ length: 31 },
				(_, i) =>
					`${i ? 'L' : 'M'}${(X0 - 64 + i).toFixed(1)} ${(SURF + 10 + i * 1.6 + 6 * Math.exp(-i / 8) * Math.sin(i * 1.3)).toFixed(1)}`
			).join(' ')}
			fill="none"
			stroke="var(--rs-pulse)"
			stroke-width="1.6"
		/>
		<Readout
			id="radio"
			order={5}
			label="Radio in seawater"
			value="skin depth {skin.toFixed(1)} m at 10 kHz"
		>
			<Label
				x={24}
				y={SURF + 128}
				text="radio in seawater: skin depth {skin.toFixed(1)} m at 10 kHz, less higher up"
				size={11}
				anchor="start"
				color="var(--rs-pulse)"
			/>
		</Readout>
	</g>

	<!-- absorption against frequency -->
	<Axes
		{sx}
		{sy}
		xTicks={[2, 3, 4, 5]}
		xFormat={(v) => ['100 Hz', '1 kHz', '10 kHz', '100 kHz'][v - 2]}
		yTicks={[-3, -2, -1, 0, 1, 2]}
		yFormat={(v) => String(10 ** v)}
		xLabel="frequency"
		yLabel="absorption (dB/km)"
	/>
	<path d={curve} fill="none" stroke="var(--rs-a)" stroke-width="2.2" />
	<circle cx={sx(Math.log10(f))} cy={sy(Math.log10(alpha))} r="6" fill="var(--rs-a)" />
	<Readout
		id="alpha"
		order={3}
		label="At {fText(f)}"
		value="{alpha < 0.1 ? alpha.toFixed(3) : alpha.toFixed(2)} dB/km"
	>
		<Label
			x={sx(Math.log10(f)) - 12}
			y={sy(Math.log10(alpha)) - 10}
			text="{fText(f)}: {alpha < 0.1 ? alpha.toFixed(3) : alpha.toFixed(2)} dB/km"
			size={12}
			weight={600}
			anchor="end"
			color="var(--rs-a)"
		/>
	</Readout>
	<Readout
		id="facts"
		order={6}
		label="Round trip of 20 km"
		value="{lossText(20 * alpha)} dB absorbed; λ = {(c / f).toFixed(c / f < 1 ? 2 : 1)} m"
	>
		<Label
			x={936}
			y={370}
			text="at {fText(f)}, over the 20 km round trip:"
			size={12}
			anchor="end"
			muted
		/>
		<Label
			x={936}
			y={394}
			text="{lossText(20 * alpha)} dB lost to absorption"
			size={15}
			weight={700}
			anchor="end"
			tabular
		/>
		<Label
			x={936}
			y={430}
			text="wavelength c ÷ f = {(c / f).toFixed(c / f < 1 ? 2 : 1)} m"
			size={12}
			anchor="end"
			tabular
		/>
		<Label
			x={936}
			y={452}
			text="Doppler of 10 m/s: 2v ÷ λ = {Math.round((2 * 10 * f) / c)} Hz"
			size={12}
			anchor="end"
			tabular
		/>
		<Label
			x={936}
			y={488}
			text="low pitch: reach; high pitch: detail"
			size={12}
			anchor="end"
			muted
		/>
	</Readout>
</g>
