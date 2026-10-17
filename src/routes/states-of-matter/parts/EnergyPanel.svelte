<script lang="ts">
	/**
	 * The Lennard-Jones pair energy U(r) = 4[(1/r)¹² − (1/r)⁶] (units of ε and σ),
	 * with the box's measured average kinetic energy per molecule drawn as a
	 * level above the bottom of the dip: how far up the walls of the dip the
	 * motion can carry a molecule.
	 */
	import { Label, clamp } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Phase } from '../phase';

	interface Props {
		/** Average kinetic energy per molecule, units of ε (k_B·T in 2D). */
		kinetic: number;
		phase: Phase;
	}
	let { kinetic, phase }: Props = $props();

	const X0 = 480;
	const X1 = 900;
	const Y0 = 70;
	const Y1 = 400;
	const R_MIN = 0.9;
	const R_MAX = 2.6;
	const U_MIN = -1.3;
	const U_MAX = 1.3;
	const sx = (r: number) => X0 + ((r - R_MIN) / (R_MAX - R_MIN)) * (X1 - X0);
	const sy = (u: number) =>
		Y1 - ((clamp(u, U_MIN - 0.5, U_MAX + 0.5) - U_MIN) / (U_MAX - U_MIN)) * (Y1 - Y0);
	const lj = (r: number) => 4 * (r ** -12 - r ** -6);
	const RM = 2 ** (1 / 6);

	const curve = Array.from({ length: 121 }, (_, i) => {
		const r = 0.97 + (i / 120) * (R_MAX - 0.97);
		return `${i ? 'L' : 'M'}${sx(r).toFixed(1)} ${sy(lj(r)).toFixed(1)}`;
	}).join(' ');

	const level = $derived(-1 + kinetic);
	/** Where the level crosses the curve on each side (bisection), or the plot edge. */
	const span = $derived.by(() => {
		const solve = (a: number, b: number) => {
			for (let i = 0; i < 50; i++) {
				const m = (a + b) / 2;
				if (lj(m) - level > 0 === lj(a) - level > 0) a = m;
				else b = m;
			}
			return (a + b) / 2;
		};
		const left = solve(0.95, RM);
		const right = level >= 0 ? R_MAX : solve(RM, R_MAX + 5);
		return { left, right: Math.min(right, R_MAX) };
	});

	const verdict: Record<Phase, string> = {
		solid: 'motion well short of the depth: each molecule stays in its dip',
		liquid: 'motion almost half the dip: molecules roll between neighbours',
		gas: 'motion about as large as the dip, or more: they fly apart',
		supercritical: 'motion about as large as the dip: they fly apart'
	};
</script>

<g>
	<line x1={X0} x2={X1} y1={sy(0)} y2={sy(0)} stroke="var(--stage-line)" stroke-width="1.2" />
	<line x1={X0} x2={X0} y1={Y0} y2={Y1} stroke="var(--stage-line)" stroke-width="1.2" />
	<Label x={X0 - 8} y={sy(0) + 4} text="0" size={11} anchor="end" muted />
	<Label x={X0 - 8} y={sy(-1) + 4} text="−ε" size={11} anchor="end" muted />
	<Label x={X0 - 8} y={sy(1) + 4} text="+ε" size={11} anchor="end" muted />
	<Readout id="curve" order={10} label="curve: energy of a pair of molecules, by their distance">
		<Label x={X0} y={Y0 - 14} text="energy of a pair of molecules" size={12} anchor="start" muted />
		<Label x={X1} y={sy(0) + 20} text="distance between them →" size={12} anchor="end" muted />
	</Readout>

	<path d={curve} fill="none" stroke="var(--som-co2)" stroke-width="2.5" />
	<Readout id="repel" order={11} label="repel" marker={1} at={[sx(1.02) + 24, sy(1.2) - 4]}>
		<Label x={sx(1.02)} y={sy(1.2)} text="repel" size={12} anchor="start" weight={600} />
	</Readout>
	<Readout id="attract" order={12} label="attract" marker={2} at={[sx(1.75) + 28, sy(-0.55) - 4]}>
		<Label x={sx(1.75)} y={sy(-0.55)} text="attract" size={12} anchor="start" weight={600} />
	</Readout>

	<!-- depth of the dip -->
	<line
		x1={sx(RM)}
		x2={sx(RM)}
		y1={sy(0)}
		y2={sy(-1)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
		stroke-dasharray="3 3"
	/>
	<Readout id="depth">
		<Label x={sx(RM) + 8} y={sy(-0.25) + 4} text="depth ε" size={11} anchor="start" muted />
	</Readout>

	<!-- the motion's energy, measured in the box -->
	<rect
		x={sx(span.left)}
		y={sy(level)}
		width={Math.max(0, sx(span.right) - sx(span.left))}
		height={Math.max(0, sy(-1) - sy(level))}
		fill="var(--som-trail)"
		opacity="0.18"
	/>
	<line
		x1={sx(span.left)}
		x2={sx(span.right)}
		y1={sy(level)}
		y2={sy(level)}
		stroke="var(--som-trail)"
		stroke-width="2.5"
	/>
	<circle
		cx={sx(RM)}
		cy={sy(-1)}
		r="6"
		fill="var(--som-co2)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<Readout
		id="motion"
		order={4}
		label="Average energy of motion"
		value="{kinetic.toFixed(2)} ε ({Math.round(kinetic * 100)}% of the depth ε)"
		note={verdict[phase]}
		color="var(--som-trail)"
	>
		<Label x={X0} y={Y1 + 40} text="average energy of motion:" size={13} anchor="start" />
		<Label
			x={X0 + 178}
			y={Y1 + 40}
			text="{kinetic.toFixed(2)} ε ({Math.round(kinetic * 100)}% of the depth)"
			size={13}
			weight={700}
			anchor="start"
			color="var(--som-trail)"
		/>
		<Label x={X0} y={Y1 + 66} text={verdict[phase]} size={13} anchor="start" />
	</Readout>
</g>
