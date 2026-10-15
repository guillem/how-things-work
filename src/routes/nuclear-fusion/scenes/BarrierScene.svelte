<script lang="ts">
	/**
	 * The Coulomb barrier between a deuteron and a triton: potential energy against
	 * separation, with a sketched strong-force well inside the touching distance. A nucleus
	 * with the plasma's average energy (3/2 kT, from the temperature control) rolls in along
	 * its energy line, stops where the line meets the hill, and rolls back out.
	 */
	import { Axes, Label, clamp, pingpong, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { barrier, classicalTemperature, coulomb, touching } from '../model';
	import { kelvinText, plasmaOf } from './settings';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 110;
	const X1 = 880;
	const Y0 = 80;
	const Y1 = 470;
	const R_MIN = 1;
	const R_MAX = 1000;
	// Distance on a log scale, so both the touching distance and far turning points fit.
	const lx = scale([0, 3], [X0, X1]);
	const sx = (r: number) => lx(Math.log10(Math.max(R_MIN, r)));
	const sy = scale([-120, 520], [Y1, Y0]);
	const R = touching();
	const B = barrier();
	const WELL = -100; // sketch depth of the strong-force well (keV)

	const hill = (() => {
		let d = `M${sx(R_MIN)} ${sy(WELL)} L${sx(R)} ${sy(WELL)} L${sx(R)} ${sy(B)}`;
		for (let r = R; r <= R_MAX; r *= 1.02)
			d += ` L${sx(r).toFixed(1)} ${sy(coulomb(r)).toFixed(1)}`;
		return d;
	})();

	const temp = $derived(plasmaOf(params).t);
	const energy = $derived(1.5 * temp);
	const turn = $derived(coulomb(1) / energy); // closest approach (fm)
	const ratio = $derived(B / energy);
	const visibleTurn = $derived(Math.min(turn, R_MAX));

	// The nucleus rolls in from the right edge and back (4 s there and back).
	const phase = $derived(reduced ? 0.92 : pingpong(t, 4));
	const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
	const ballR = $derived(R_MAX - (R_MAX - visibleTurn) * ease(clamp(phase)));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.6, t));
	const near = $derived(turn <= R_MAX);
	const fmt = (v: number) => (v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 0 : 1));
</script>

<g>
	<Axes
		sx={lx}
		{sy}
		xTicks={[0, 1, 2, 3]}
		xFormat={(v: number) => String(10 ** v)}
		yTicks={[0, 100, 200, 300, 400, 500]}
		xLabel="distance between the nuclei (femtometres)"
		yLabel="energy (keV)"
	/>
	<!-- the hill -->
	<path
		d="{hill} L{sx(R_MAX)} {sy(-120)} L{sx(R_MIN)} {sy(-120)} Z"
		fill="var(--nf-dd)"
		opacity="0.08"
	/>
	<path d={hill} fill="none" stroke="var(--nf-dd)" stroke-width="2.5" stroke-linejoin="round" />
	<Readout
		id="barrier"
		order={2}
		label="Coulomb barrier"
		value="{fmt(B)} keV at {R.toFixed(1)} fm"
		color="var(--nf-dd)"
	>
		<Label
			x={sx(R) + 12}
			y={sy(B) + 4}
			text="Coulomb barrier: {fmt(B)} keV"
			anchor="start"
			color="var(--nf-dd)"
			weight={600}
		/>
	</Readout>
	<Readout id="well">
		<Label
			x={sx(R) + 10}
			y={sy(WELL) + 4}
			text="strong-force well (sketch)"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
	<Readout id="touch">
		<Label
			x={sx(R) + 10}
			y={sy(-30)}
			text="touching: {R.toFixed(1)} fm"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<!-- the average energy at this temperature -->
	<g opacity={fadeIn}>
		<line
			x1={sx(visibleTurn)}
			x2={sx(R_MAX)}
			y1={sy(energy)}
			y2={sy(energy)}
			stroke="var(--nf-fusion)"
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
		<circle
			cx={sx(ballR)}
			cy={sy(energy) - 9}
			r="9"
			fill="var(--nf-proton)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout
			id="avg"
			order={3}
			label="Average energy, 3/2 kT"
			value="{fmt(energy)} keV: 1/{Math.round(ratio)} of the barrier"
			color="var(--nf-fusion)"
		>
			<Label
				x={X1}
				y={sy(energy) - 26}
				text="average energy {fmt(energy)} keV = 1/{Math.round(ratio)} of the barrier"
				anchor="end"
				color="var(--nf-fusion)"
				weight={600}
			/>
		</Readout>
		<Readout
			id="turn"
			order={4}
			label="Closest approach"
			value={near
				? `${fmt(turn)} fm, ${Math.round(turn / R)} × too far`
				: `${fmt(turn)} fm, off the chart`}
		>
			<Label
				x={X1}
				y={sy(energy) + 22}
				text={near
					? `turns back at ${fmt(turn)} fm: ${Math.round(turn / R)} times too far to touch`
					: `turns back at ${fmt(turn)} fm, off the chart`}
				anchor="end"
				size={12}
				muted
			/>
		</Readout>
	</g>

	<Readout id="temp" order={1} label="Temperature" value="{temp} keV · {kelvinText(temp)}">
		<Label
			x={X1}
			y={Y0 - 30}
			text="plasma at {temp} keV · {kelvinText(temp)}"
			anchor="end"
			size={14}
			weight={600}
		/>
	</Readout>
	<Readout
		id="classical"
		order={5}
		label="To climb it on average"
		value={kelvinText(classicalTemperature())}
	>
		<Label
			x={X1}
			y={sy(B) - 18}
			text="to climb it on average: {kelvinText(classicalTemperature())}"
			anchor="end"
			size={12}
			muted
		/>
	</Readout>
</g>
