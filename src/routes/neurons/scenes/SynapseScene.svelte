<script lang="ts">
	/**
	 * A chemical synapse, schematic and slowed down: the axon terminal at the
	 * top, the 20 nm cleft, and a dendrite of the receiving cell below.
	 *
	 * Each press of "Send a spike" (and once on arrival) plays the relay as a
	 * pure function of the time since the press:
	 *   0.0–0.9 s  the spike arrives down the axon into the terminal
	 *   0.9–1.8 s  ① calcium channels open, Ca²⁺ flows in
	 *   1.8–2.7 s  ② two vesicles fuse and release glutamate
	 *   2.7–3.6 s  ③ glutamate crosses and binds the receptor channels, which open: Na⁺ in
	 *   3.4–6.5 s  ④ the receiving cell's voltage rises: the EPSP chart (the
	 *              illustrative synapse of inputs.ts on HH's membrane) is traced
	 *   6.5–8 s    glutamate is cleared, the receptors close
	 * Under reduced motion the frame at ③ is shown with the finished EPSP.
	 */
	import { Label, clamp, hash, lerp, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { REST, peak } from '../hh';
	import { FIRST, WINDOW, receive } from '../inputs';
	import { replayClock } from './replay';

	let { t, params, reduced }: StageProps = $props();

	const fired = $derived(Number(params.fire ?? 0));
	const since = replayClock();
	const s = $derived(reduced ? 3.3 : since(`fire|${fired}`, t));

	const ARRIVE = 0.9;
	const CA = 1.8;
	const FUSE = 2.7;
	const BIND = 3.4;
	const CLEAR = 6.5;

	// ---- geometry ----------------------------------------------------------------------
	const PRE = { x0: 250, x1: 710, y1: 268 };
	const CLEFT = { y0: 268, y1: 300 };
	const POST = { y0: 300, y1: 430 };
	const prePath = `M${PRE.x0 + 120} 30 L${PRE.x0 + 120} 70 Q${PRE.x0} 90 ${PRE.x0} 180 L${PRE.x0} ${PRE.y1 - 20} Q${PRE.x0} ${PRE.y1} ${PRE.x0 + 30} ${PRE.y1} L${PRE.x1 - 30} ${PRE.y1} Q${PRE.x1} ${PRE.y1} ${PRE.x1} ${PRE.y1 - 20} L${PRE.x1} 180 Q${PRE.x1} 90 ${PRE.x1 - 120} 70 L${PRE.x1 - 120} 30`;
	const caX = [320, 640];
	const recX = [400, 480, 560];
	/** Vesicles: two release (they sit by the membrane), four wait further in. */
	const vesicles = [
		{ id: 'v1', x: 420, y: 238, release: true },
		{ id: 'v2', x: 540, y: 238, release: true },
		{ id: 'v3', x: 360, y: 180, release: false },
		{ id: 'v4', x: 470, y: 170, release: false },
		{ id: 'v5', x: 590, y: 182, release: false },
		{ id: 'v6', x: 530, y: 120, release: false }
	];

	// ---- the relay ----------------------------------------------------------------------
	const spikeIn = $derived(clamp(s / ARRIVE));
	const terminalGlow = $derived(smoothstep(0.6, ARRIVE, s) * (1 - smoothstep(CA, CA + 1.2, s)));
	const caOpen = $derived(
		smoothstep(ARRIVE, ARRIVE + 0.2, s) * (1 - smoothstep(FUSE, FUSE + 0.6, s))
	);
	const caIons = $derived(
		caX.flatMap((x, j) =>
			[0, 1, 2, 3].map((k) => {
				const u = clamp((s - ARRIVE - 0.12 * k) / 0.8);
				return {
					key: `ca${j}${k}`,
					x: x + (hash(k, j) - 0.5) * 30 * u,
					y: CLEFT.y0 + 10 - u * 70,
					o:
						s > ARRIVE + 0.12 * k
							? smoothstep(0, 0.1, u) * (1 - smoothstep(CA + 0.6, CA + 1.2, s))
							: 0
				};
			})
		)
	);
	/** Fusion of the two docked vesicles: 0 docked, 1 flattened into the membrane. */
	const fuse = $derived(smoothstep(CA, FUSE, s));
	/** Glutamate: 16 molecules from each fused vesicle, spreading across the cleft, then cleared. */
	const glu = $derived(
		vesicles
			.filter((v) => v.release)
			.flatMap((v, j) =>
				Array.from({ length: 16 }, (_, k) => {
					const spread = smoothstep(FUSE - 0.3, BIND, s);
					const tx = lerp(-110, 110, hash(k, 40 + j)) + (j === 0 ? 30 : -30);
					const ty = lerp(CLEFT.y0 + 4, CLEFT.y1 - 4, hash(k, 60 + j));
					const jiggle = reduced ? 0 : 2 * Math.sin(t * 7 + k * 3.1);
					return {
						key: `g${j}${k}`,
						x: v.x + tx * spread + jiggle,
						y: lerp(v.y, ty, spread),
						o:
							(s > CA + 0.3 ? smoothstep(CA + 0.3, FUSE, s) : 0) *
							(1 - smoothstep(CLEAR, CLEAR + 1.2, s))
					};
				})
			)
	);
	const recOpen = $derived(
		smoothstep(BIND - 0.3, BIND + 0.1, s) * (1 - smoothstep(CLEAR, CLEAR + 1, s))
	);
	const naIons = $derived(
		recX.flatMap((x, j) =>
			[0, 1, 2].map((k) => {
				const u = ((((s - BIND) * 0.9 + k / 3) % 1) + 1) % 1;
				return {
					key: `na${j}${k}`,
					x,
					y: CLEFT.y0 + u * 110,
					o: recOpen * smoothstep(0, 0.15, u) * (1 - smoothstep(0.8, 1, u))
				};
			})
		)
	);

	// ---- the EPSP --------------------------------------------------------------------
	const epsp = receive({ exc: 1, inh: 0, spread: 0 });
	const rise = peak(epsp).V - REST;
	const EX0 = 250;
	const EX1 = 710;
	const EY = { y0: 470, y1: 556 };
	const ex = scale([0, WINDOW], [EX0, EX1]);
	const ey = scale([REST - 0.5, REST + 3], [EY.y1, EY.y0]);
	/** The chart's clock: the synapse acts at FIRST ms when the receptors open (BIND s). */
	const msNow = $derived(reduced ? WINDOW : clamp(FIRST + (s - BIND) * 8, 0, WINDOW));
	const epspPath = $derived(
		linePath(
			epsp.filter((p) => p.t <= msNow),
			(p) => p.t,
			(p) => p.V,
			ex,
			ey
		)
	);
	const stage = $derived(s < ARRIVE ? 0 : s < CA ? 1 : s < FUSE ? 2 : s < BIND ? 3 : 4);
	const stepO = (k: number) => (stage >= k ? 1 : 0.35);
</script>

<g class="synapse">
	<!-- receiving dendrite -->
	<rect
		x={150}
		y={POST.y0}
		width={660}
		height={POST.y1 - POST.y0}
		rx="40"
		fill="var(--nr-axon)"
		stroke="var(--nr-axon-edge)"
		stroke-width="2"
	/>
	<!-- the terminal -->
	<path d={prePath} fill="var(--nr-axon)" stroke="var(--nr-axon-edge)" stroke-width="2" />
	<path d={prePath} fill="var(--nr-fire)" opacity={0.35 * terminalGlow} />
	{#if spikeIn > 0 && spikeIn < 1}
		<rect
			x={PRE.x0 + 124}
			y={30 + spikeIn * 60}
			width={PRE.x1 - PRE.x0 - 248}
			height="20"
			rx="8"
			fill="var(--nr-fire)"
			opacity={0.85 * (1 - smoothstep(0.8, 1, spikeIn))}
		/>
	{/if}
	<Readout id="pre" order={8}>
		<Label x={PRE.x0 + 110} y={46} anchor="end" size={12} text="axon terminal" />
		<Label x={PRE.x0 + 110} y={62} anchor="end" size={11} muted text="the spike arrives" />
	</Readout>

	<!-- vesicles -->
	{#each vesicles as v (v.id)}
		{@const f = v.release ? fuse : 0}
		<g opacity={1 - f}>
			<circle
				cx={v.x}
				cy={v.y + f * 14}
				r={22 * (1 - 0.5 * f)}
				fill="var(--surface)"
				stroke="var(--nr-axon-edge)"
				stroke-width="1.5"
			/>
			{#each [0, 1, 2, 3, 4] as k (k)}
				<circle
					cx={v.x + 10 * Math.cos(k * 1.26) * (1 - 0.5 * f)}
					cy={v.y + f * 14 + 10 * Math.sin(k * 1.26) * (1 - 0.5 * f)}
					r="3"
					fill="var(--nr-glu)"
				/>
			{/each}
		</g>
	{/each}

	<!-- calcium channels -->
	{#each caX as x (x)}
		<rect x={x - 12} y={PRE.y1 - 10} width="9" height="20" rx="3" fill="var(--nr-ca)" />
		<rect x={x + 3 + 6 * caOpen} y={PRE.y1 - 10} width="9" height="20" rx="3" fill="var(--nr-ca)" />
	{/each}
	{#each caIons as c (c.key)}
		<circle cx={c.x} cy={c.y} r="4" fill="var(--nr-ca)" opacity={c.o} />
	{/each}

	<!-- receptors -->
	{#each recX as x (x)}
		<rect
			x={x - 14 - 5 * recOpen}
			y={POST.y0 - 6}
			width="11"
			height="26"
			rx="3"
			fill="var(--nr-exc)"
		/>
		<rect
			x={x + 3 + 5 * recOpen}
			y={POST.y0 - 6}
			width="11"
			height="26"
			rx="3"
			fill="var(--nr-exc)"
		/>
	{/each}
	{#each glu as g (g.key)}
		<circle cx={g.x} cy={g.y} r="3" fill="var(--nr-glu)" opacity={g.o} />
	{/each}
	{#each naIons as n (n.key)}
		<circle cx={n.x} cy={n.y} r="4" fill="var(--nr-na)" opacity={n.o} />
	{/each}

	<Readout id="cleft">
		<Label x={PRE.x1 + 16} y={CLEFT.y0 + 20} anchor="start" size={11} muted text="cleft ≈ 20 nm" />
	</Readout>
	<Readout id="post">
		<Label
			x={160 + 40}
			y={POST.y1 - 20}
			anchor="start"
			size={12}
			text="dendrite of the receiving cell"
		/>
	</Readout>

	<!-- numbered stages -->
	<Readout id="s1" order={1} label="① Ca²⁺ channels open, calcium flows in" opacity={stepO(1)}>
		<Label
			x={36}
			y={150}
			anchor="start"
			size={12}
			color="var(--nr-ca)"
			opacity={stepO(1)}
			text="① Ca²⁺ flows in"
		/>
	</Readout>
	<Readout id="s2" order={2} label="② vesicles fuse and release glutamate" opacity={stepO(2)}>
		<Label
			x={36}
			y={178}
			anchor="start"
			size={12}
			color="var(--nr-glu)"
			opacity={stepO(2)}
			text="② vesicles release"
		/>
		<Label x={36} y={194} anchor="start" size={11} muted opacity={stepO(2)} text="glutamate" />
	</Readout>
	<Readout
		id="s3"
		order={3}
		label="③ glutamate opens the receptor channels: Na⁺ in"
		opacity={stepO(3)}
	>
		<Label
			x={36}
			y={222}
			anchor="start"
			size={12}
			color="var(--nr-exc)"
			opacity={stepO(3)}
			text="③ receptors open"
		/>
		<Label x={36} y={238} anchor="start" size={11} muted opacity={stepO(3)} text="Na⁺ flows in" />
	</Readout>
	<Readout
		id="s4"
		order={4}
		label="④ the receiving cell's voltage rises"
		value="+{rise.toFixed(1)} mV (an EPSP)"
		opacity={stepO(4)}
	>
		<Label
			x={36}
			y={266}
			anchor="start"
			size={12}
			color="var(--nr-v)"
			opacity={stepO(4)}
			text="④ voltage rises"
		/>
		<Label
			x={36}
			y={282}
			anchor="start"
			size={11}
			muted
			opacity={stepO(4)}
			text="by {rise.toFixed(1)} mV"
		/>
	</Readout>

	<!-- the EPSP chart -->
	<line
		x1={EX0}
		x2={EX1}
		y1={ey(REST)}
		y2={ey(REST)}
		stroke="var(--stage-line)"
		stroke-dasharray="4 4"
	/>
	<line x1={EX0} x2={EX0} y1={EY.y0} y2={EY.y1} stroke="var(--stage-line)" />
	<path d={epspPath} fill="none" stroke="var(--nr-v)" stroke-width="2.5" />
	<Readout id="e-title">
		<Label
			x={EX0}
			y={EY.y0 - 10}
			anchor="start"
			size={12}
			text="receiving cell’s voltage: an EPSP of +{rise.toFixed(1)} mV"
		/>
		<Label
			x={EX1}
			y={ey(REST) + 16}
			anchor="end"
			size={11}
			muted
			text="rest −60 mV · {WINDOW} ms"
		/>
	</Readout>
</g>
