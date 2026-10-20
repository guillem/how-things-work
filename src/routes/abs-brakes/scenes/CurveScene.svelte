<script lang="ts">
	/**
	 * Slip and the friction curve: a braking wheel on the road with the road's speed and the rim's
	 * speed, and the Burckhardt friction-slip curves with the current slip marked on them.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { mu, peak, SURFACES, type Surface } from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'slip'));
	const s = $derived(Number(params.slip ?? 0.1));
	const surface = $derived(
		(phase === 'curve' ? String(params.surface ?? 'dry') : 'dry') as Surface
	);
	const m = $derived(mu(s, surface));
	const top = $derived(peak(surface));
	const shown: Surface[] = $derived(phase === 'curve' ? ['dry', 'wet', 'snow'] : ['dry']);
	const colour = (k: Surface) => `var(--ab-${k})`;

	// ---- the wheel ------------------------------------------------------------------------
	const WX = 220;
	const WY = 280;
	const WR = 110;
	const ROAD = WY + WR;
	const V_LEN = 220;
	const rimLen = $derived(V_LEN * (1 - s));

	// ---- the plot ---------------------------------------------------------------------------
	const sx = scale([0, 100], [500, 920]);
	const sy = scale([0, 1.3], [500, 70]);
	const grid = Array.from({ length: 101 }, (_, i) => i / 100);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
</script>

<g class="ab-curve">
	<!-- road and wheel -->
	<line x1="30" y1={ROAD} x2="430" y2={ROAD} stroke="var(--ab-road)" stroke-width="3" />
	<circle cx={WX} cy={WY} r={WR} fill="var(--surface-2)" stroke="var(--text)" stroke-width="10" />
	<circle cx={WX} cy={WY} r={WR * 0.55} fill="none" stroke="var(--text-muted)" stroke-width="3" />
	<circle cx={WX} cy={WY} r="10" fill="var(--text-muted)" />
	<!-- the contact patch -->
	<rect x={WX - 26} y={ROAD - 6} width="52" height="8" rx="2" fill={colour(surface)} />

	<!-- the car moves right at v; the rim at the bottom moves back at omega R relative to the axle,
	     so the patch is dragged at v - omega R relative to the road -->
	<Readout id="ab-v" order={1} label="Car (and axle) speed" value="v = 100 km/h">
		<line
			x1={WX}
			y1={WY - WR - 30}
			x2={WX + V_LEN}
			y2={WY - WR - 30}
			stroke="var(--text)"
			stroke-width="4"
			marker-end="url(#arrowhead)"
		/>
		<Label x={WX} y={WY - WR - 44} text="car: v = 100 km/h" anchor="start" weight={600} />
	</Readout>
	<Readout id="ab-rim" order={2} label="Rim speed ωR" value="{Math.round(100 * (1 - s))} km/h">
		<line
			x1={WX}
			y1={ROAD + 34}
			x2={WX + Math.max(rimLen, 0.5)}
			y2={ROAD + 34}
			stroke="var(--ab-rim)"
			stroke-width="4"
			marker-end={rimLen > 8 ? 'url(#arrowhead)' : undefined}
		/>
		<Label
			x={WX}
			y={ROAD + 60}
			text="rim: ωR = {Math.round(100 * (1 - s))} km/h"
			anchor="start"
			color="var(--ab-rim)"
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="ab-slip" order={3} label="Slip" value="{pct(s)}, μ = {m.toFixed(2)}">
		<Label
			x={WX}
			y={ROAD + 92}
			text="slip {pct(s)} · μ = {m.toFixed(2)}"
			anchor="middle"
			size={18}
			weight={700}
			tabular
		/>
		<Label
			x={WX}
			y={ROAD + 116}
			text={s >= 0.995
				? 'locked: the tyre slides'
				: s < 0.005
					? 'rolling freely: no braking force'
					: `braking force = ${m.toFixed(2)} × the weight on the wheel`}
			anchor="middle"
			muted
		/>
	</Readout>

	<!-- the friction curves -->
	<Axes {sx} {sy} xLabel="slip (%)" yLabel="friction coefficient μ" />
	{#each shown as k (k)}
		<path
			d={linePath(
				grid,
				(g) => g * 100,
				(g) => mu(g, k),
				sx,
				sy
			)}
			fill="none"
			stroke={colour(k)}
			stroke-width={k === surface ? 3.5 : 2}
			opacity={k === surface ? 1 : 0.45}
		/>
		{#if phase === 'curve'}
			<Readout
				id="ab-name-{k}"
				order={10 + shown.indexOf(k)}
				label={SURFACES[k].label}
				value="peak {peak(k).mu.toFixed(2)} at {pct(peak(k).slip)}, locked {mu(1, k).toFixed(2)}"
			>
				<Label
					x={sx(100) - 4}
					y={sy(mu(1, k)) - 10}
					text={SURFACES[k].label.toLowerCase()}
					anchor="end"
					color={colour(k)}
					weight={k === surface ? 700 : 400}
				/>
			</Readout>
		{/if}
	{/each}
	<!-- peak and lock of the chosen surface -->
	<circle
		cx={sx(top.slip * 100)}
		cy={sy(top.mu)}
		r="6"
		fill={colour(surface)}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout
		id="ab-peak"
		order={4}
		label="Peak"
		value="μ = {top.mu.toFixed(2)} at {pct(top.slip)} slip"
	>
		<Label
			x={sx(top.slip * 100) + 10}
			y={sy(top.mu) - 12}
			text="peak {top.mu.toFixed(2)} at {pct(top.slip)}"
			anchor="start"
			weight={600}
		/>
	</Readout>
	<circle cx={sx(100)} cy={sy(mu(1, surface))} r="5" fill="var(--ab-lock)" />
	<!-- the current slip -->
	<line
		x1={sx(s * 100)}
		y1={sy(0)}
		x2={sx(s * 100)}
		y2={sy(m)}
		stroke="var(--text)"
		stroke-dasharray="4 4"
	/>
	<circle cx={sx(s * 100)} cy={sy(m)} r="8" fill="none" stroke="var(--text)" stroke-width="2.5" />
</g>
