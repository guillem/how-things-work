<script lang="ts">
	/**
	 * Palmer's picture of flow-dependent predictability on the Lorenz 63 attractor, seen from
	 * the side (x across, z up): three tight clouds of 40 starts each run forward for the same
	 * 0.8 time units, one barely growing, one stretching, one torn between the two wings. The
	 * clouds were computed once (../model.ts `l63Cloud`); time only picks a frame, and reduced
	 * motion shows the last.
	 */
	import { Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DT63,
		PALMER_MEMBERS,
		PALMER_STARTS,
		PALMER_STEPS,
		cloudSpread,
		l63Cloud,
		l63Orbit
	} from '../model';

	let { t, reduced }: StageProps = $props();

	const sx = scale([-22, 22], [80, 560]);
	const sz = scale([0, 52], [566, 70]);
	const orbit = l63Orbit(2500, 2);
	const orbitPath = orbit
		.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sz(p[2]).toFixed(1)}`)
		.join('');
	const clouds = PALMER_STARTS.map((start, i) =>
		l63Cloud(start, PALMER_MEMBERS, 0.4, PALMER_STEPS, 1, i + 1)
	);
	const spread0 = clouds.map((c) => cloudSpread(c[0]));
	const NAMES = ['A', 'B', 'C'];
	const COLOURS = ['var(--ewf-a)', 'var(--ewf-b)', 'var(--ewf-c)'];
	/** Frames per second of animation: the 80 steps take 10 s. */
	const RATE = 8;
	const frame = $derived(reduced ? PALMER_STEPS : Math.min(PALMER_STEPS, Math.floor(t * RATE)));
	const trails = $derived(
		clouds.map((c) =>
			Array.from({ length: PALMER_MEMBERS }, (_, m) => {
				let d = '';
				for (let f = 0; f <= frame; f++)
					d += `${f ? 'L' : 'M'}${sx(c[f][m][0]).toFixed(1)} ${sz(c[f][m][2]).toFixed(1)}`;
				return d;
			})
		)
	);
	const dots = $derived(
		clouds.map((c) =>
			c[frame]
				.map((p) => {
					const x = sx(p[0]);
					const y = sz(p[2]);
					return `M${(x - 2.6).toFixed(1)} ${y.toFixed(1)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
				})
				.join('')
		)
	);
	const growth = $derived(clouds.map((c, i) => cloudSpread(c[frame]) / spread0[i]));
	const fmt = (g: number) => (g < 10 ? g.toFixed(1) : Math.round(g).toString());
	const LABEL_AT = [
		{ dx: 16, dy: -10 },
		{ dx: 18, dy: 18 },
		{ dx: -18, dy: -12 }
	];
	const NOTES = ['stays tight', 'stretches into a thread', 'torn between the two wings'];
</script>

<g>
	<Readout id="title" order={1} label="Lorenz 1963" value="σ = 10, ρ = 28, β = 8/3">
		<Label
			x={40}
			y={36}
			text="Lorenz 1963 (σ = 10, ρ = 28, β = 8/3), seen from the side"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="time" order={2} label="Time run" value="{(frame * DT63).toFixed(2)} units">
		<Label x={925} y={36} text="time {(frame * DT63).toFixed(2)}" size={14} anchor="end" tabular />
	</Readout>

	<path
		d={orbitPath}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="0.7"
		opacity="0.35"
	/>
	<Readout id="axes">
		<Label x={sx(0)} y={590} text="x" size={12} muted italic />
		<Label x={60} y={sz(26)} text="z" size={12} muted italic />
	</Readout>

	{#each PALMER_STARTS as start, i (i)}
		<g opacity="0.35">
			{#each trails[i] as d, m (m)}
				<path {d} fill="none" stroke={COLOURS[i]} stroke-width="0.8" />
			{/each}
		</g>
		<circle
			cx={sx(start[0])}
			cy={sz(start[2])}
			r="6"
			fill="none"
			stroke={COLOURS[i]}
			stroke-width="1.4"
		/>
		<path d={dots[i]} fill={COLOURS[i]} />
		<Label
			x={sx(start[0]) + LABEL_AT[i].dx}
			y={sz(start[2]) + LABEL_AT[i].dy}
			text={NAMES[i]}
			size={15}
			weight={700}
			color={COLOURS[i]}
		/>
	{/each}

	<!-- the key -->
	<Readout id="key-title">
		<Label
			x={640}
			y={140}
			text="three clouds of 40 starts each"
			size={13}
			weight={600}
			anchor="start"
		/>
		<Label x={640} y={160} text="spread now ÷ spread at the start" size={11} muted anchor="start" />
	</Readout>
	{#each growth as g, i (i)}
		<Readout
			id="growth-{i}"
			order={3 + i}
			label="Cloud {NAMES[i]}, {NOTES[i]}"
			value="spread ×{fmt(g)}"
			color={COLOURS[i]}
		>
			<circle cx={648} cy={200 + i * 56} r="6" fill={COLOURS[i]} />
			<Label
				x={664}
				y={205 + i * 56}
				text="{NAMES[i]}: spread ×{fmt(g)}"
				size={15}
				weight={700}
				color={COLOURS[i]}
				anchor="start"
				tabular
			/>
			<Label x={664} y={224 + i * 56} text={NOTES[i]} size={11} muted anchor="start" />
		</Readout>
	{/each}
	<Readout id="ring-key">
		<circle cx={648} cy={384} r="6" fill="none" stroke="var(--stage-ink)" stroke-width="1.4" />
		<Label x={664} y={388} text="where each cloud started" size={11} muted anchor="start" />
	</Readout>
</g>
