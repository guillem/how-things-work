<script lang="ts">
	/**
	 * The eigenvalues against speed, 0 to 10 m/s: real parts as dark dots, the imaginary parts of
	 * complex pairs as purple dots, the self-stable band (all real parts negative) shaded. Beside it,
	 * a side view of the bicycle whose parameters are in use, with its steering axis and trail.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BENCHMARK,
		eigenvalues,
		matrices,
		stableBand,
		TWO_MASS_SKATE,
		type Bike
	} from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'equations'));
	const tms = $derived(phase === 'skate' && params.bike !== 'benchmark');
	const bike: Bike = $derived.by(() => {
		if (tms) return TWO_MASS_SKATE;
		if (phase === 'geometry')
			return {
				...BENCHMARK,
				c: Number(params.trail ?? 0.08),
				lambda: (Number(params.tilt ?? 18) * Math.PI) / 180,
				mF: Number(params.mf ?? 3)
			};
		if (phase === 'gyro' && params.notrail === true) return { ...BENCHMARK, c: 0 };
		return BENCHMARK;
	});
	const gyro = $derived(phase !== 'gyro' || params.gyro !== false);
	const m = $derived(matrices(bike, { gyro }));
	const band = $derived(stableBand(m, tms ? 30 : 15));
	const cursor = $derived(phase === 'equations' || phase === 'band');
	const v = $derived(Number(params.speed ?? 5));

	// ---- the plot -----------------------------------------------------------------------------------
	const VMAX = 10;
	const sx = scale([0, VMAX], [80, 600]);
	const sy = scale([-10, 10], [540, 60]);
	const speeds = Array.from({ length: 201 }, (_, i) => (i * VMAX) / 200);
	const dots = $derived(speeds.map((s) => ({ s, ev: eigenvalues(m, s) })));
	/** Points off the plot (the castering mode runs far below it) are left out. */
	const onPlot = (y: number) => y >= -10 && y <= 10;
	const evNow = $derived(eigenvalues(m, v));
	const fmt = (e: { re: number; im: number }) =>
		e.im === 0
			? e.re.toFixed(2)
			: `${e.re.toFixed(2)} ${e.im > 0 ? '+' : '−'} ${Math.abs(e.im).toFixed(2)}i`;
	const bandText = $derived(
		!band
			? 'no self-stable speed up to ' + (tms ? 30 : 15) + ' m/s'
			: band.to === Infinity
				? `self-stable above ${band.from.toFixed(2)} m/s`
				: `self-stable from ${band.from.toFixed(2)} to ${band.to.toFixed(2)} m/s`
	);
	const bandX0 = $derived(band ? sx(Math.min(VMAX, band.from)) : 0);
	const bandX1 = $derived(band ? sx(Math.min(VMAX, band.to)) : 0);

	// ---- side view of the bicycle (x forward to the right, metres → px) -----------------------------
	const SK = 190;
	const GX = 680;
	const GY = 520;
	const P = (x: number, z: number) => ({ x: GX + x * SK, y: GY + z * SK });
	// The steering axis passes through the point the trail puts ahead of the front contact.
	const axisFoot = $derived(P(bike.w + bike.c, 0));
	const axisTop = $derived({
		x: axisFoot.x - 1.15 * SK * Math.sin(bike.lambda),
		y: axisFoot.y - 1.15 * SK * Math.cos(bike.lambda)
	});
	const rearC = $derived(P(0, -bike.rR));
	const frontC = $derived(P(bike.w, -bike.rF));
</script>

<g class="bk-roots">
	<!-- the self-stable band -->
	{#if band}
		<rect
			x={bandX0}
			y={sy(10)}
			width={Math.max(0, bandX1 - bandX0)}
			height={sy(-10) - sy(10)}
			fill="var(--bk-band)"
			opacity="0.14"
		/>
	{/if}
	<Axes {sx} {sy} xLabel="speed v (m/s)" yLabel="eigenvalue (1/s)" />
	<line
		x1={sx(0)}
		y1={sy(0)}
		x2={sx(VMAX)}
		y2={sy(0)}
		stroke="var(--text-muted)"
		stroke-width="1.5"
	/>
	{#each dots as d (d.s)}
		{#each d.ev as e, i (i)}
			{#if onPlot(e.re)}
				<circle cx={sx(d.s)} cy={sy(e.re)} r="2.2" fill="var(--bk-re)" />
			{/if}
			{#if e.im > 0 && onPlot(e.im)}
				<circle cx={sx(d.s)} cy={sy(e.im)} r="1.6" fill="var(--bk-im)" opacity="0.8" />
			{/if}
		{/each}
	{/each}
	<Readout
		id="bk-key"
		order={5}
		label="Dots"
		value="dark: real parts (growth rate); purple: imaginary part (oscillation, rad/s)"
	>
		<circle cx="100" cy="76" r="3" fill="var(--bk-re)" />
		<Label x={110} y={80} text="real part (growth if above 0)" anchor="start" size={12} />
		<circle cx="100" cy="96" r="3" fill="var(--bk-im)" />
		<Label
			x={110}
			y={100}
			text="imaginary part (oscillation)"
			anchor="start"
			size={12}
			color="var(--bk-im)"
		/>
	</Readout>
	{#if phase === 'band'}
		<Readout
			id="bk-modes"
			order={6}
			label="Modes"
			value="weave below 4.29 m/s, capsize above 6.02 m/s, castering always negative"
		>
			<Label x={sx(2.2)} y={sy(3.4)} text="weave" anchor="middle" weight={600} />
			<Label x={sx(8.6)} y={sy(1.2)} text="capsize" anchor="middle" weight={600} />
			<Label x={sx(5)} y={sy(-8.6)} text="castering ↓" anchor="middle" weight={600} />
		</Readout>
	{/if}

	<!-- the speed cursor -->
	{#if cursor}
		<line
			x1={sx(v)}
			y1={sy(10)}
			x2={sx(v)}
			y2={sy(-10)}
			stroke="var(--text)"
			stroke-dasharray="5 4"
		/>
		<Readout
			id="bk-ev"
			order={2}
			label="Eigenvalues at {v.toFixed(1)} m/s"
			value={evNow.map(fmt).join(', ')}
		>
			<Label x={GX} y={70} text="at {v.toFixed(1)} m/s:" anchor="start" weight={600} />
			{#each evNow as e, i (i)}
				<Label
					x={GX}
					y={94 + i * 20}
					text={fmt(e)}
					anchor="start"
					tabular
					color={e.re > 0 ? 'var(--bk-fall)' : undefined}
				/>
			{/each}
		</Readout>
	{/if}
	<Readout id="bk-band" order={1} label="Band" value={bandText}>
		<Label
			x={sx(5)}
			y={36}
			text={bandText}
			anchor="middle"
			weight={700}
			size={15}
			color={band ? 'var(--bk-band)' : 'var(--bk-fall)'}
		/>
	</Readout>

	<!-- side view -->
	<g opacity="0.95">
		<line x1={GX - 20} y1={GY} x2={GX + 1.3 * SK} y2={GY} stroke="var(--text-muted)" />
		{#if bike.rR > 0}
			<circle
				cx={rearC.x}
				cy={rearC.y}
				r={bike.rR * SK}
				fill="none"
				stroke="var(--text)"
				stroke-width="2"
			/>
			<circle
				cx={frontC.x}
				cy={frontC.y}
				r={bike.rF * SK}
				fill="none"
				stroke="var(--text)"
				stroke-width="2"
			/>
		{:else}
			<!-- skates -->
			<line
				x1={GX - 12}
				y1={GY - 2}
				x2={GX + 12}
				y2={GY - 2}
				stroke="var(--text)"
				stroke-width="4"
			/>
			<line
				x1={P(bike.w, 0).x - 12}
				y1={GY - 2}
				x2={P(bike.w, 0).x + 12}
				y2={GY - 2}
				stroke="var(--text)"
				stroke-width="4"
			/>
		{/if}
		<line
			x1={axisFoot.x}
			y1={axisFoot.y}
			x2={axisTop.x}
			y2={axisTop.y}
			stroke="var(--bk-steer)"
			stroke-width="2.5"
			stroke-dasharray="6 4"
		/>
		<circle
			cx={P(bike.xB, bike.zB).x}
			cy={P(bike.xB, bike.zB).y}
			r={Math.max(5, Math.sqrt(bike.mB) * 2)}
			fill="var(--bk-lean)"
			opacity="0.8"
		/>
		<circle
			cx={P(bike.xH, bike.zH).x}
			cy={P(bike.xH, bike.zH).y}
			r={Math.max(4, Math.sqrt(bike.mH) * 3)}
			fill="var(--bk-steer)"
			opacity="0.9"
		/>
		<Readout
			id="bk-geo"
			order={3}
			label="Geometry"
			value="trail {Math.round(bike.c * 1000)} mm, axis tilt {Math.round(
				(bike.lambda * 180) / Math.PI
			)}°"
		>
			<Label
				x={GX + 0.65 * SK}
				y={GY + 24}
				text="trail {Math.round(bike.c * 1000)} mm · axis {Math.round(
					(bike.lambda * 180) / Math.PI
				)}°"
				anchor="middle"
				size={12}
				tabular
			/>
		</Readout>
		<Readout id="bk-name" order={4} label="Bicycle" value={tms ? 'two-mass-skate' : 'benchmark'}>
			<Label
				x={GX + 0.65 * SK}
				y={GY + 44}
				text={tms
					? 'two-mass-skate (no spin, no trail)'
					: gyro
						? 'benchmark bicycle'
						: 'benchmark, wheels’ spin cancelled'}
				anchor="middle"
				size={12}
				muted
			/>
		</Readout>
	</g>
</g>
