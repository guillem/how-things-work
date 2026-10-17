<script lang="ts">
	/**
	 * The propagated action potential: Hodgkin & Huxley's membrane on 8 cm of
	 * squid axon (hh.ts `cable`), stimulated at the left end.
	 *
	 * Top: the axon as a tube coloured by its voltage, with sodium flowing in
	 * where the Na⁺ conductance is high and potassium flowing out where the K⁺
	 * conductance is high. Below: the voltage along the axon at that instant.
	 * The run (a few milliseconds) is played back about 1,000 times slower,
	 * a pure function of t, then held and repeated; it is recomputed when the
	 * diameter or the temperature changes. Under reduced motion the frame
	 * with the spike half way along is shown.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { REST, SQUID_AXON, cable, phi, squidCable, velocity } from '../hh';
	import { replayClock } from './replay';

	let { t, params, reduced }: StageProps = $props();

	const diameter = $derived(Number(params.diameter ?? 476)); // µm
	const T = $derived(Number(params.temp ?? SQUID_AXON.T));
	const LENGTH = 8; // cm

	/** A rough speed (m/s) to size the run: √d and √φ scaling from 18.5 m/s. */
	const guess = $derived(18.5 * Math.sqrt(diameter / 476) * Math.sqrt(phi(T) / phi(SQUID_AXON.T)));
	const run = $derived(
		cable(
			squidCable({
				radius: diameter / 2e4,
				T,
				length: LENGTH,
				dx: 0.05,
				dt: 0.0025,
				tEnd: Math.min(30, 0.8 + (1.2 * LENGTH * 10) / guess),
				every: 0.02
			})
		)
	);
	const speed = $derived(velocity(run));
	const tEnd = $derived(run.t[run.t.length - 1]);

	// ---- playback --------------------------------------------------------------------
	const LEAD = 0.5;
	const PLAY = $derived(clamp(tEnd * 0.9, 5, 12)); // seconds of playback
	const HOLD = 0.3;
	const since = replayClock();
	const elapsed = $derived(since(`${diameter}|${T}`, t));
	/** Time when the spike is half way: shown under reduced motion. */
	const midTime = $derived.by(() => {
		const i = Math.floor(run.x.length / 2);
		const a = run.arrival[i];
		return Number.isFinite(a) ? a : tEnd / 2;
	});
	const ms = $derived.by(() => {
		if (reduced) return midTime;
		const p = elapsed % (LEAD + PLAY + HOLD);
		return clamp((p - LEAD) / PLAY) * tEnd;
	});
	const frame = $derived(
		Math.min(run.t.length - 1, Math.max(0, Math.round((ms / tEnd) * (run.t.length - 1))))
	);
	const V = $derived(run.V[frame]);
	const gNa = $derived(run.gNa[frame]);
	const gK = $derived(run.gK[frame]);
	const slow = $derived(Math.round(PLAY / (tEnd / 1000) / 100) * 100);

	// ---- geometry ----------------------------------------------------------------------
	const X0 = 80;
	const X1 = 912;
	const sx = scale([0, LENGTH], [X0, X1]);
	const TUBE = { y0: 150, y1: 196 };
	const CH = { y0: 300, y1: 520 };
	const syV = scale([-80, 50], [CH.y1, CH.y0]);
	const n = $derived(run.x.length);
	const cellW = $derived((X1 - X0) / n);
	/** Voltage → mix of the resting and the firing colour. */
	const heat = (v: number) => clamp((v - REST) / 90);

	const profile = $derived(
		linePath(
			Array.from({ length: n }, (_, i) => i),
			(i) => run.x[i],
			(i) => V[i],
			sx,
			syV
		)
	);
	/** Every 4th compartment: where Na⁺ flows in and K⁺ flows out. */
	const flows = $derived(
		Array.from({ length: Math.floor(n / 4) }, (_, k) => {
			const i = k * 4 + 2;
			return {
				i,
				x: X0 + (i + 0.5) * cellW,
				na: smoothstep(3, 25, gNa[i]),
				k: smoothstep(3, 15, gK[i])
			};
		})
	);
	const peakAt = $derived.by(() => {
		let best = 0;
		for (let i = 1; i < n; i++) if (V[i] > V[best]) best = i;
		return V[best] > -20 ? best : -1;
	});
	const peakX = $derived(peakAt >= 0 ? run.x[peakAt] : -1);
	const show = $derived(peakAt >= 0 && peakX > 0.6 && peakX < LENGTH - 0.6 ? 1 : 0);
	const fmt = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))} mV`;
	const isSquid = $derived(diameter === 476 && Math.abs(T - SQUID_AXON.T) < 0.05);
</script>

<g class="cable">
	<!-- the axon -->
	<Readout id="title">
		<Label
			x={X0}
			y={78}
			anchor="start"
			size={14}
			weight={600}
			text="squid giant axon, {diameter} µm across, at {T.toFixed(1)} °C"
		/>
		<Label
			x={X0}
			y={98}
			anchor="start"
			size={11}
			muted
			text="stimulated at the left end · the first 8 cm, played back about {slow.toLocaleString(
				'en-US'
			)} times slower"
		/>
	</Readout>
	<rect
		x={X0 - 4}
		y={TUBE.y0 - 4}
		width={X1 - X0 + 8}
		height={TUBE.y1 - TUBE.y0 + 8}
		rx="16"
		fill="var(--nr-axon)"
	/>
	{#each Array.from({ length: n }, (_, i) => i) as i (i)}
		<rect
			x={X0 + i * cellW}
			y={TUBE.y0}
			width={cellW + 0.6}
			height={TUBE.y1 - TUBE.y0}
			fill="var(--nr-fire)"
			opacity={0.08 + 0.92 * heat(V[i])}
		/>
	{/each}
	<rect
		x={X0 - 4}
		y={TUBE.y0 - 4}
		width={X1 - X0 + 8}
		height={TUBE.y1 - TUBE.y0 + 8}
		rx="16"
		fill="none"
		stroke="var(--nr-axon-edge)"
		stroke-width="2"
	/>
	{#each flows as f (f.i)}
		{#if f.na > 0.02}
			<path
				d="M{f.x} {TUBE.y0 - 30} L{f.x} {TUBE.y0 - 8} M{f.x - 5} {TUBE.y0 - 14} L{f.x} {TUBE.y0 -
					7} L{f.x + 5} {TUBE.y0 - 14}"
				fill="none"
				stroke="var(--nr-na)"
				stroke-width="2.4"
				stroke-linecap="round"
				opacity={f.na}
			/>
		{/if}
		{#if f.k > 0.02}
			<path
				d="M{f.x} {TUBE.y1 + 8} L{f.x} {TUBE.y1 + 30} M{f.x - 5} {TUBE.y1 + 24} L{f.x} {TUBE.y1 +
					31} L{f.x + 5} {TUBE.y1 + 24}"
				fill="none"
				stroke="var(--nr-k)"
				stroke-width="2.4"
				stroke-linecap="round"
				opacity={f.k}
			/>
		{/if}
	{/each}
	<!-- current spreading ahead inside the axon -->
	{#if show}
		<path
			d="M{sx(peakX) + 8} {(TUBE.y0 + TUBE.y1) / 2} L{sx(peakX) + 70} {(TUBE.y0 + TUBE.y1) /
				2} M{sx(peakX) + 62} {(TUBE.y0 + TUBE.y1) / 2 - 6} L{sx(peakX) + 71} {(TUBE.y0 + TUBE.y1) /
				2} L{sx(peakX) + 62} {(TUBE.y0 + TUBE.y1) / 2 + 6}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-linecap="round"
		/>
	{/if}
	<Readout id="key-na" order={4} label="Na⁺ flowing in" color="var(--nr-na)">
		<Label x={X1} y={118} anchor="end" size={11} color="var(--nr-na)" text="↓ Na⁺ flows in" />
	</Readout>
	<Readout id="key-k" order={5} label="K⁺ flowing out" color="var(--nr-k)">
		<Label
			x={X1}
			y={TUBE.y1 + 50}
			anchor="end"
			size={11}
			color="var(--nr-k)"
			text="↓ K⁺ flows out"
		/>
	</Readout>
	<Readout id="key-i">
		<Label
			x={X0}
			y={TUBE.y1 + 50}
			anchor="start"
			size={11}
			muted
			text="→ current spreads inside to the next patch"
			opacity={show}
		/>
	</Readout>

	<!-- the voltage along the axon -->
	<Axes
		{sx}
		sy={syV}
		xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
		yTicks={[-80, -60, -40, -20, 0, 20, 40]}
		xLabel="distance along the axon (cm)"
		yFormat={(v) => (v > 0 ? `+${v}` : `${v}`.replace('-', '−'))}
	/>
	<Readout id="ch-title">
		<Label
			x={X0}
			y={CH.y0 - 14}
			anchor="start"
			size={12}
			text="voltage inside along the axon (mV), at {ms.toFixed(2)} ms"
		/>
	</Readout>
	<path d={profile} fill="none" stroke="var(--nr-v)" stroke-width="2.5" stroke-linejoin="round" />
	{#if show}
		<Readout id="behind">
			<Label
				x={sx(Math.max(0.2, peakX - 1))}
				y={syV(-72) - 8}
				anchor="end"
				size={11}
				muted
				text="← refractory behind"
			/>
		</Readout>
		<Readout id="peak">
			<Label
				x={sx(peakX) + 10}
				y={syV(V[peakAt]) + 4}
				anchor="start"
				size={12}
				color="var(--nr-v)"
				text="peak {fmt(V[peakAt])}"
			/>
		</Readout>
	{/if}

	<!-- speed -->
	<Readout id="speed" order={1} label="Speed in the model" value="{speed.toFixed(1)} m/s">
		<Label x={X1} y={70} anchor="end" size={15} weight={700} text="speed: {speed.toFixed(1)} m/s" />
	</Readout>
	<Readout
		id="ref"
		order={3}
		label="Hodgkin & Huxley, same axon"
		value={isSquid ? `calculated ${SQUID_AXON.computed}, measured ${SQUID_AXON.measured} m/s` : ''}
		opacity={isSquid ? 1 : 0}
	>
		<Label
			x={X1}
			y={92}
			anchor="end"
			size={11}
			muted
			opacity={isSquid ? 1 : 0}
			text="Hodgkin & Huxley: calculated {SQUID_AXON.computed}, measured {SQUID_AXON.measured} m/s"
		/>
	</Readout>
</g>
