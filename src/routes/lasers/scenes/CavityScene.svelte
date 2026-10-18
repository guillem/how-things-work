<script lang="ts">
	/**
	 * The four-level rod between two mirrors, in the steady state the rate equations give for the
	 * pump and mirror set. Top: the cavity, with the photons in the mode (a few bouncing packets
	 * below threshold, a solid beam above it) and the beam leaving through the output mirror.
	 * Bottom left: photons in the mode against the pump, on a log scale. Bottom right: output power
	 * and the inversion (relative to threshold) against the pump, or, on the mirror step, the
	 * output against the mirror's reflectivity at the pump set.
	 */
	import { Axes, Label, Photon, clamp, cycle, hash, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		photonLifetime,
		pumpRate,
		steadyState,
		thresholdInversion,
		thresholdPump
	} from '../laser';
	import { curvePath, pow10, sci, watts } from './shared';

	let { step, t, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'cavity'));
	const P = $derived(
		phase === 'mirror' ? Number(params.mirrorPump ?? 5) : Number(params.pump ?? 0.8)
	);
	const R = $derived(phase === 'mirror' ? Number(params.R ?? 0.95) : 0.95);
	const st = $derived(steadyState({ medium: 'four', R }, pumpRate(P)));
	const nth = $derived(thresholdInversion(R));
	const Pth = $derived(thresholdPump(R));
	const tc = $derived(photonLifetime(R));
	const lasing = $derived(P > Pth);

	// ---------------------------------------------------------------- the cavity
	const M1 = 64;
	const M2 = 620;
	const AX = 108;
	const ROD = { x0: 210, x1: 480, y0: 82, y1: 134 };
	/** How full the mode is, 0 (empty) to 1 (10¹² photons), on a log scale. */
	const fill = $derived(clamp(Math.log10(st.q + 1) / 12));
	/** Below threshold: one bouncing packet per photon (up to 8). */
	const packets = $derived(lasing ? 10 : Math.min(8, Math.round(st.q)));
	const bouncing = $derived(
		Array.from({ length: packets }, (_, k) => {
			const span = M2 - M1 - 20;
			const u = cycle(t, 2.4, hash(k, 7));
			const forward = u < 0.5;
			const s = forward ? u * 2 : 2 - u * 2;
			return {
				k,
				x: M1 + 10 + s * span + (forward ? 0 : 0),
				y: AX + (hash(k, 11) - 0.5) * 22,
				angle: forward ? 0 : 180,
				fade: lasing ? 1 : clamp(Math.min(s, 1 - s) / 0.06)
			};
		})
	);
	const outWidth = $derived(lasing ? 3 + 14 * clamp(Math.log10(st.out / 0.01) / 3) : 0);

	// ---------------------------------------------------------------- charts
	const PMAX = 10;
	const sxL = scale([0, PMAX], [100, 420]);
	const syL = scale([-1, 13], [510, 270]);
	const logq = (q: number) => Math.log10(Math.max(q, 0.1));
	const photonCurve = $derived(
		curvePath(
			200,
			0,
			PMAX,
			(p) => logq(steadyState({ medium: 'four', R }, pumpRate(p)).q),
			sxL,
			syL
		)
	);
	const sxR = $derived(
		phase === 'mirror' ? scale([0.7, 1], [560, 870]) : scale([0, PMAX], [560, 870])
	);
	const syR = scale([0, 6], [510, 270]);
	const syInv = scale([0, 1.2], [510, 270]);
	const outCurve = $derived(
		phase === 'mirror'
			? curvePath(
					240,
					0.7,
					0.999,
					(r) => steadyState({ medium: 'four', R: r }, pumpRate(P)).out,
					sxR,
					syR
				)
			: curvePath(
					200,
					0,
					PMAX,
					(p) => steadyState({ medium: 'four', R }, pumpRate(p)).out,
					sxR,
					syR
				)
	);
	/** Output per watt of pump above threshold, from the model itself. */
	const slope = $derived.by(() => {
		const a = steadyState({ medium: 'four', R }, pumpRate(Pth + 1)).out;
		const b = steadyState({ medium: 'four', R }, pumpRate(Pth + 2)).out;
		return b - a;
	});
	const invCurve = $derived(
		curvePath(
			200,
			0,
			PMAX,
			(p) => steadyState({ medium: 'four', R }, pumpRate(p)).dn / thresholdInversion(R),
			sxR,
			syInv
		)
	);
	const best = $derived.by(() => {
		if (phase !== 'mirror') return null;
		let b = { r: 0.7, out: 0 };
		for (let r = 0.7; r <= 0.999; r += 0.001) {
			const o = steadyState({ medium: 'four', R: r }, pumpRate(P)).out;
			if (o > b.out) b = { r, out: o };
		}
		return b;
	});

	const leftOpacity = $derived(phase === 'output' ? 0.5 : 1);
	const rightOpacity = $derived(phase === 'cavity' ? 0.5 : 1);
	const invText = $derived(`${(st.dn / nth).toFixed(st.dn / nth > 0.999 ? 4 : 3)} × Nₜₕ`);
</script>

<g>
	<!-- mirrors -->
	<rect x={M1 - 8} y={AX - 50} width="8" height="100" rx="2" fill="var(--ls-mirror)" />
	<rect
		x={M2}
		y={AX - 50}
		width="8"
		height="100"
		rx="2"
		fill="var(--ls-mirror)"
		opacity={0.55 + 0.45 * R}
	/>
	<Label x={M1 - 4} y={AX + 72} text="mirror 100%" size={12} muted />
	<Readout id="mirror" order={4} label="Output mirror" value="R = {(R * 100).toFixed(1)}%">
		<Label
			x={M2 + 4}
			y={AX + 72}
			text="output mirror R = {(R * 100).toFixed(1)}%"
			size={12}
			weight={phase === 'mirror' ? 600 : 400}
		/>
	</Readout>

	<!-- rod and pump -->
	<rect
		x={ROD.x0}
		y={ROD.y0}
		width={ROD.x1 - ROD.x0}
		height={ROD.y1 - ROD.y0}
		rx="12"
		fill="var(--ls-rod)"
		stroke="var(--ls-rod-edge)"
		stroke-width="1.5"
	/>
	<rect
		x={ROD.x0 + 20}
		y="150"
		width={ROD.x1 - ROD.x0 - 40}
		height="8"
		rx="3"
		fill="var(--ls-pump)"
		opacity={0.25 + 0.75 * clamp(P / PMAX)}
	/>
	{#each [0, 1, 2, 3, 4] as k (k)}
		<line
			x1={ROD.x0 + 45 + k * 45}
			x2={ROD.x0 + 45 + k * 45}
			y1="148"
			y2="138"
			stroke="var(--ls-pump)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
			opacity={0.25 + 0.75 * clamp(P / PMAX)}
		/>
	{/each}
	<Readout id="pump" order={1} label="Pump" value="{P.toFixed(2)} W (threshold {Pth.toFixed(2)} W)">
		<Label
			x={ROD.x0 + 10}
			y={176}
			text="pump {P.toFixed(2)} W · threshold {Pth.toFixed(2)} W"
			size={12}
			anchor="start"
		/>
	</Readout>

	<!-- the light in the mode -->
	{#if lasing}
		<rect
			x={M1}
			y={AX - 2 - 8 * fill}
			width={M2 - M1}
			height={4 + 16 * fill}
			fill="var(--ls-beam)"
			opacity={0.15 + 0.35 * fill}
		/>
	{/if}
	{#each bouncing as p (p.k)}
		<Photon
			x={p.x}
			y={p.y}
			angle={p.angle}
			length={26}
			amplitude={3}
			color="var(--ls-beam)"
			opacity={p.fade}
			phase={t * 2}
		/>
	{/each}
	{#if lasing}
		<rect
			x={M2 + 8}
			y={AX - outWidth / 2}
			width={940 - M2 - 8}
			height={outWidth}
			fill="var(--ls-beam)"
			opacity="0.75"
		/>
	{/if}
	<Readout id="out" order={2} label="Output" value={watts(st.out)}>
		<Label x={940} y={AX - 22} text="output {watts(st.out)}" size={14} weight={600} anchor="end" />
	</Readout>
	<Readout
		id="photons"
		order={3}
		label="Photons in the mode"
		value="{sci(st.q, 3)}; inversion {invText}"
	>
		<Label
			x={940}
			y={AX + 36}
			text="photons in the mode: {sci(st.q, 3)}"
			size={12}
			anchor="end"
			tabular
		/>
		<Label x={940} y={AX + 54} text="inversion: {invText}" size={12} anchor="end" tabular />
	</Readout>
	<Readout id="tc" order={5} label="Photon lifetime" value="τc = {(tc * 1e9).toFixed(1)} ns">
		<Label
			x={M1 + 10}
			y={AX - 56}
			text="photon lifetime τc = {(tc * 1e9).toFixed(1)} ns"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>

	<!-- left: photons in the mode against pump (log) -->
	<g opacity={leftOpacity}>
		<Axes
			sx={sxL}
			sy={syL}
			xLabel="pump (W)"
			yLabel="photons in the mode"
			yTicks={[0, 3, 6, 9, 12]}
			yFormat={(v: number) => pow10(v)}
		/>
		<line
			x1={sxL(Pth)}
			x2={sxL(Pth)}
			y1="270"
			y2="510"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Label x={sxL(Pth) + 6} y={284} text="threshold" size={11} muted anchor="start" />
		<path d={photonCurve} fill="none" stroke="var(--ls-beam)" stroke-width="2.5" />
		<circle
			cx={sxL(P)}
			cy={syL(logq(st.q))}
			r="6"
			fill="var(--ls-beam)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	</g>

	<!-- right: output (and inversion) -->
	<g opacity={rightOpacity}>
		{#if phase === 'mirror'}
			<Axes
				sx={sxR}
				sy={syR}
				xLabel="mirror R"
				yLabel="output (W)"
				xTicks={[0.7, 0.8, 0.9, 1]}
				xFormat={(v: number) => `${Math.round(v * 100)}%`}
			/>
			<path d={outCurve} fill="none" stroke="var(--ls-beam)" stroke-width="2.5" />
			{#if best && best.out > 0}
				<line
					x1={sxR(best.r)}
					x2={sxR(best.r)}
					y1={syR(best.out)}
					y2="510"
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="4 4"
				/>
				<Readout
					id="best"
					order={6}
					label="Best mirror at this pump"
					value="R ≈ {(best.r * 100).toFixed(1)}% ({watts(best.out)})"
				>
					<Label
						x={sxR(best.r)}
						y={syR(best.out) - 14}
						text="best ≈ {(best.r * 100).toFixed(1)}%"
						size={12}
						anchor={best.r > 0.9 ? 'end' : 'middle'}
					/>
				</Readout>
			{/if}
			<circle
				cx={sxR(R)}
				cy={syR(st.out)}
				r="6"
				fill="var(--ls-beam)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{:else}
			<Axes sx={sxR} sy={syR} xLabel="pump (W)" yLabel="output (W)" />
			<Axes
				sx={sxR}
				sy={syInv}
				yRight
				xTicks={[]}
				grid={false}
				yLabel="ΔN / Nₜₕ"
				yTicks={[0, 0.5, 1]}
			/>
			<path
				d={invCurve}
				fill="none"
				stroke="var(--ls-inv)"
				stroke-width="2"
				stroke-dasharray="6 4"
			/>
			<path d={outCurve} fill="none" stroke="var(--ls-beam)" stroke-width="2.5" />
			<Label
				x={sxR(PMAX) - 6}
				y={syInv(1) + 18}
				text="inversion, clamped"
				size={11}
				color="var(--ls-inv)"
				anchor="end"
			/>
			<circle
				cx={sxR(P)}
				cy={syInv(st.dn / nth)}
				r="5"
				fill="var(--stage-bg)"
				stroke="var(--ls-inv)"
				stroke-width="2"
			/>
			<circle
				cx={sxR(P)}
				cy={syR(st.out)}
				r="6"
				fill="var(--ls-beam)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{#if phase === 'output'}
				<Readout
					id="slope"
					order={6}
					label="Slope above threshold"
					value="{(slope * 100).toFixed(0)}% (W out per W of pump)"
				>
					<Label
						x={sxR(6.5)}
						y={syR((6.5 - Pth) * slope) - 28}
						text="slope {(slope * 100).toFixed(0)}%"
						size={12}
						weight={600}
						color="var(--ls-beam)"
						anchor="end"
					/>
				</Readout>
			{/if}
		{/if}
	</g>
</g>
