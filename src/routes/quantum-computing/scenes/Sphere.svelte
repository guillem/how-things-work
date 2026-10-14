<script lang="ts">
	/**
	 * A Bloch sphere: outline, equator and the x–z meridian (back halves dashed), the three
	 * axes with their states at the ends, and the state's Bloch vector `v` as an arrow (shorter
	 * than the radius for a qubit entangled with another). Optional: a gate axis through the
	 * centre and the arc the arrow swept.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import type { Vec3 } from '../qubits';
	import T from './T.svelte';
	import { circle, project } from './view';

	interface Props {
		id: string;
		cx: number;
		cy: number;
		R: number;
		v: Vec3;
		color?: string;
		/** Labels at the axis ends: all six states, or only |0⟩ and |1⟩. */
		labels?: 'all' | 'poles';
		axis?: Vec3 | null;
		axisOpacity?: number;
		trace?: string;
		/** Draws the circle of latitude through the arrow's tip (equal odds all round it). */
		latitude?: boolean;
	}
	let {
		id,
		cx,
		cy,
		R,
		v,
		color = 'var(--qc-state)',
		labels = 'all',
		axis = null,
		axisOpacity = 1,
		trace = '',
		latitude = false
	}: Props = $props();

	const eq = $derived(circle(cx, cy, R, [1, 0, 0], [0, 1, 0]));
	const mer = $derived(circle(cx, cy, R, [1, 0, 0], [0, 0, 1]));
	const lat = $derived.by(() => {
		if (!latitude) return null;
		const z = v[2];
		const rr = Math.sqrt(Math.max(0, 1 - z * z));
		if (rr < 0.02) return null;
		return circle(cx, cy, R, [rr, 0, 0], [0, rr, 0], [0, 0, z]);
	});
	const P = (p: Vec3, k = 1) => {
		const s = project([p[0] * k, p[1] * k, p[2] * k]);
		return { x: cx + s.x * R, y: cy + s.y * R, depth: s.depth };
	};
	const AXES: { p: Vec3; text: string; pole: boolean }[] = [
		{ p: [0, 0, 1], text: '|0⟩', pole: true },
		{ p: [0, 0, -1], text: '|1⟩', pole: true },
		{ p: [1, 0, 0], text: '|+⟩', pole: false },
		{ p: [-1, 0, 0], text: '|−⟩', pole: false },
		{ p: [0, 1, 0], text: '|+i⟩', pole: false },
		{ p: [0, -1, 0], text: '|−i⟩', pole: false }
	];
	const len = $derived(Math.hypot(v[0], v[1], v[2]));
	const tip = $derived(P(v));
	const o = $derived(P([0, 0, 0]));
	const ax = $derived(axis ? { a: P(axis, 1.06), b: P(axis, -1.06) } : null);
	const small = $derived(R < 120);
</script>

<g>
	<circle {cx} {cy} r={R} fill="var(--qc-sphere)" stroke="var(--stage-line)" stroke-width="1.5" />
	<path d={eq.back} fill="none" stroke="var(--stage-line)" stroke-dasharray="3 4" opacity="0.6" />
	<path d={eq.front} fill="none" stroke="var(--stage-line)" stroke-width="1.2" />
	<path d={mer.back} fill="none" stroke="var(--stage-grid)" stroke-dasharray="3 4" />
	<path d={mer.front} fill="none" stroke="var(--stage-grid)" stroke-width="1.2" />
	{#if lat}
		<path d={lat.back} fill="none" stroke={color} stroke-dasharray="2 4" opacity="0.4" />
		<path d={lat.front} fill="none" stroke={color} stroke-width="1.2" opacity="0.55" />
	{/if}

	<!-- axes -->
	{#each AXES as a (a.text)}
		{@const e = P(a.p)}
		<line
			x1={o.x}
			y1={o.y}
			x2={e.x}
			y2={e.y}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray={e.depth < -0.05 ? '3 3' : undefined}
			opacity="0.6"
		/>
		{#if labels === 'all' || a.pole}
			{@const l = P(a.p, a.pole ? 1.13 : 1.2)}
			{#if a.pole}
				<T
					x={l.x}
					y={l.y + (a.p[2] > 0 ? -2 : 14)}
					text={a.text}
					size={small ? 12 : 15}
					anchor="middle"
					weight={700}
					color={a.p[2] > 0 ? 'var(--qc-zero)' : 'var(--qc-one)'}
				/>
			{:else}
				<Readout id="{id}-ax-{a.text}">
					<T
						x={l.x}
						y={l.y + (a.pole ? (a.p[2] > 0 ? -2 : 14) : 5)}
						text={a.text}
						size={small ? 12 : 15}
						anchor="middle"
						weight={a.pole ? 700 : 500}
						color={a.pole ? (a.p[2] > 0 ? 'var(--qc-zero)' : 'var(--qc-one)') : undefined}
						muted={!a.pole}
					/>
				</Readout>
			{/if}
		{/if}
	{/each}

	<!-- gate axis -->
	{#if ax && axisOpacity > 0.01}
		<line
			x1={ax.a.x}
			y1={ax.a.y}
			x2={ax.b.x}
			y2={ax.b.y}
			stroke="var(--qc-axis)"
			stroke-width="2"
			stroke-dasharray="7 5"
			opacity={axisOpacity}
		/>
		<circle cx={ax.a.x} cy={ax.a.y} r="4" fill="var(--qc-axis)" opacity={axisOpacity} />
	{/if}
	{#if trace}
		<path
			d={trace}
			fill="none"
			stroke="var(--qc-axis)"
			stroke-width="2"
			opacity={0.7 * axisOpacity}
		/>
	{/if}

	<!-- the state -->
	{#if len > 0.02}
		<line
			x1={o.x}
			y1={o.y}
			x2={tip.x}
			y2={tip.y}
			stroke={color}
			stroke-width={small ? 3 : 4}
			stroke-linecap="round"
			opacity={tip.depth < 0 && len > 0.5 ? 0.6 : 1}
		/>
	{/if}
	<circle cx={o.x} cy={o.y} r={small ? 3 : 4} fill="var(--stage-ink)" />
	{#if len > 0.02}
		<circle
			cx={tip.x}
			cy={tip.y}
			r={small ? 5 : 7}
			fill={color}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={tip.depth < 0 && len > 0.5 ? 0.7 : 1}
		/>
	{/if}
</g>
