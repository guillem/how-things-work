<script lang="ts">
	/**
	 * Measuring the speeds (step measure). Left: NGC 3198 as we see it, tilted
	 * at its measured 73°, its bodies coloured by their speed along our line of
	 * sight (v · sin i · cos θ: blue coming towards us, red going away). A radio
	 * "beam" scans along the long axis (pingpong, SCAN s each way). Right: the
	 * measured speeds of both sides (SPARC points, mirrored), the point under the
	 * beam highlighted, and below the 21-cm line shifted by Δλ = λ v / c.
	 */
	import { Axes, Label, pingpong, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GYR_S, KPC_KM, galaxy, speedAt } from '../galaxies';
	import { rng } from '../lensing';

	let { t, reduced }: StageProps = $props();

	const g = galaxy('NGC3198');
	const INC = (g.inclination * Math.PI) / 180;
	const SIN_I = Math.sin(INC);
	const C_KMS = 299792.458;
	const LAMBDA_MM = 211.061; // the hydrogen line, mm
	const MYR_PER_S = 40;
	const SCAN = 9;

	// ---- the tilted disc ---------------------------------------------------------
	const CX = 250;
	const CY = 300;
	const RX = 210;
	const RY = RX * Math.cos(INC);
	const k = RX / g.rLast;
	const vMax = Math.max(...g.points.map((p) => p.v)) * SIN_I;

	const bodies = (() => {
		const rand = rng(73);
		return Array.from({ length: 110 }, (_, i) => {
			const r =
				i < 50
					? 0.5 + -3.14 * Math.log(Math.max(1e-6, rand() * rand()))
					: 4 + rand() * (g.rLast - 5);
			const v = speedAt(g, Math.min(r, g.rLast), 'measured');
			return {
				id: i,
				r: Math.min(r, g.rLast),
				th0: rand() * Math.PI * 2,
				w: ((v / (Math.max(r, 0.3) * KPC_KM)) * GYR_S * MYR_PER_S) / 1000,
				v,
				size: i < 50 ? 1.6 : 2.6
			};
		});
	})();

	const tt = $derived(reduced ? 2.5 : t);
	const u = $derived(pingpong(tt + SCAN * 0.78, 2 * SCAN));
	/** Beam position along the long axis, kpc (negative: approaching side). */
	const xs = $derived(-g.rLast * 0.97 + u * 2 * g.rLast * 0.97);
	const vBeam = $derived((xs >= 0 ? 1 : -1) * speedAt(g, Math.abs(xs), 'measured') * SIN_I);
	const shiftMm = $derived((LAMBDA_MM * vBeam) / C_KMS);

	// ---- the rotation curve, both sides -----------------------------------------
	const PX0 = 560;
	const PX1 = 930;
	const PY0 = 76;
	const PY1 = 336;
	const sx = scale([-50, 50], [PX0, PX1]);
	const sy = scale([-160, 160], [PY1, PY0]);
	const pts = g.points.flatMap((p, i) => [
		{ id: `r${i}`, x: p.r, y: p.v * SIN_I, e: p.e * SIN_I },
		{ id: `a${i}`, x: -p.r, y: -p.v * SIN_I, e: p.e * SIN_I }
	]);
	const near = $derived(
		pts.reduce((a, b) => (Math.abs(b.x - xs) < Math.abs(a.x - xs) ? b : a), pts[0])
	);

	// ---- the 21-cm line ----------------------------------------------------------
	const LX0 = 580;
	const LX1 = 910;
	const LY = 520;
	const lsx = scale([-0.15, 0.15], [LX0, LX1]);
	const line = (dmm: number) => {
		const c = lsx(dmm);
		let d = '';
		for (let i = 0; i <= 160; i++) {
			const x = LX0 + ((LX1 - LX0) * i) / 160;
			const y = LY - 62 * Math.exp(-(((x - c) / 9) ** 2));
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	};
	const losColor = (v: number) => (v >= 0 ? 'var(--dm-recede)' : 'var(--dm-approach)');
</script>

<g>
	<Readout id="title" order={1} label="NGC 3198" value="tilted 73° from face-on, as we see it">
		<Label
			anchor="start"
			x={24}
			y={38}
			text="NGC 3198 as we see it: tilted 73°"
			size={16}
			weight={700}
		/>
		<Label
			anchor="start"
			x={24}
			y={58}
			text="colour: speed towards (blue) or away from us (red)"
			size={12}
			muted
		/>
	</Readout>

	<!-- the disc -->
	<ellipse cx={CX} cy={CY} rx={RX + 8} ry={RY + 8} fill="var(--dm-galaxies)" opacity="0.07" />
	<ellipse
		cx={CX}
		cy={CY}
		rx={RX}
		ry={RY}
		fill="none"
		stroke="var(--stage-line)"
		stroke-dasharray="3 5"
	/>
	{#each bodies as b (b.id)}
		{@const th = b.th0 - b.w * tt}
		{@const vl = b.v * SIN_I * Math.cos(th)}
		<circle
			cx={CX + b.r * k * Math.cos(th)}
			cy={CY + b.r * k * Math.cos(INC) * Math.sin(th)}
			r={b.size}
			fill={losColor(vl)}
			opacity={0.25 + (0.75 * Math.abs(vl)) / vMax}
		/>
	{/each}
	<circle cx={CX} cy={CY} r="6" fill="var(--dm-galaxies)" />
	<!-- radio beam -->
	<rect
		x={CX + xs * k - 7}
		y={CY - RY - 26}
		width="14"
		height={2 * RY + 52}
		rx="7"
		fill={losColor(vBeam)}
		opacity="0.16"
		stroke={losColor(vBeam)}
		stroke-opacity="0.6"
	/>
	<Readout id="sides">
		<Label
			anchor="start"
			x={CX - RX}
			y={CY + RY + 54}
			text="← coming towards us"
			size={12}
			color="var(--dm-approach)"
			weight={650}
		/>
		<Label
			x={CX + RX}
			y={CY + RY + 54}
			text="going away →"
			size={12}
			anchor="end"
			color="var(--dm-recede)"
			weight={650}
		/>
		<Label
			x={CX}
			y={CY - RY - 38}
			text="radio beam: 21-cm hydrogen line"
			size={12}
			anchor="middle"
			muted
		/>
	</Readout>
	<Readout
		id="beam"
		order={2}
		label="Under the beam"
		value="{Math.abs(xs).toFixed(0)} kpc out, {Math.abs(vBeam).toFixed(0)} km/s {vBeam >= 0
			? 'away'
			: 'towards us'}"
		color={losColor(vBeam)}
	>
		<Label
			x={CX}
			y={CY + RY + 84}
			text="beam at {Math.abs(xs).toFixed(0)} kpc: {Math.abs(vBeam).toFixed(0)} km/s {vBeam >= 0
				? 'away from us'
				: 'towards us'}"
			size={13}
			weight={650}
			anchor="middle"
			color={losColor(vBeam)}
		/>
	</Readout>

	<!-- measured curve, both sides -->
	<rect
		x={500}
		y={20}
		width={444}
		height={364}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="p-title">
		<Label
			anchor="start"
			x={516}
			y={44}
			text="Measured speed along our line of sight"
			size={14}
			weight={700}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={[-40, -20, 0, 20, 40]}
		yTicks={[-150, -100, -50, 0, 50, 100, 150]}
		xLabel="distance along the long axis (kpc)"
		yLabel=""
	/>
	<line x1={PX0} x2={PX1} y1={sy(0)} y2={sy(0)} stroke="var(--stage-line)" />
	{#each pts as p (p.id)}
		<line
			x1={sx(p.x)}
			x2={sx(p.x)}
			y1={sy(p.y - p.e)}
			y2={sy(p.y + p.e)}
			stroke="var(--dm-data)"
			opacity="0.35"
		/>
		<circle cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill={losColor(p.y)} />
	{/each}
	<circle
		cx={sx(near.x)}
		cy={sy(near.y)}
		r="7"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<Readout id="p-axes">
		<Label anchor="start" x={PX0 + 8} y={PY0 + 4} text="away (km/s)" size={11} muted />
		<Label x={PX1 - 4} y={PY1 - 8} text="towards" size={11} muted anchor="end" />
	</Readout>

	<!-- the 21-cm line -->
	<rect
		x={500}
		y={398}
		width={444}
		height={186}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="l-title">
		<Label
			anchor="start"
			x={516}
			y={422}
			text="The 21-cm line under the beam"
			size={14}
			weight={700}
		/>
	</Readout>
	<line x1={LX0} x2={LX1} y1={LY} y2={LY} stroke="var(--stage-line)" />
	<line
		x1={lsx(0)}
		x2={lsx(0)}
		y1={LY - 70}
		y2={LY + 4}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
	/>
	<path d={line(shiftMm)} fill="none" stroke={losColor(vBeam)} stroke-width="2.5" />
	<Readout id="l-axes">
		<Label x={lsx(0)} y={LY + 20} text="211.06 mm at rest" size={11} anchor="middle" muted />
		<Label anchor="start" x={LX0} y={LY + 20} text="shorter" size={11} muted />
		<Label x={LX1} y={LY + 20} text="longer" size={11} anchor="end" muted />
	</Readout>
	<Readout
		id="shift"
		order={3}
		label="Line shifted by"
		value="{shiftMm >= 0 ? '+' : '−'}{Math.abs(shiftMm).toFixed(3)} mm"
		color={losColor(vBeam)}
	>
		<Label
			x={928}
			y={560}
			text="shifted {shiftMm >= 0 ? '+' : '−'}{Math.abs(shiftMm).toFixed(3)} mm (Δλ = λ v / c)"
			size={12}
			anchor="end"
			color={losColor(vBeam)}
			weight={650}
		/>
	</Readout>
</g>
