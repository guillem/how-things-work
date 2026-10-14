<script lang="ts">
	/**
	 * The landscape as a surface seen from above and in front: height = loss
	 * (cut off at the landscape's cap). The balls sit on it at their loss, with
	 * their trails; a ball off the map is not drawn here.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import type { Landscape } from '../descent';
	import { LEFT, heightOf, mesh, project } from './shared';
	import Txt from './Txt.svelte';

	interface Trail {
		key: string;
		color: string;
		points: { x: number; y: number }[];
		ball: { x: number; y: number };
	}
	interface Props {
		land: Landscape;
		trails: Trail[];
		showMinima: boolean;
	}
	let { land, trails, showMinima }: Props = $props();

	const grid = $derived(mesh(land));
	const inside = (p: { x: number; y: number }) =>
		p.x >= land.x[0] && p.x <= land.x[1] && p.y >= land.y[0] && p.y <= land.y[1];
	const at = (p: { x: number; y: number }) =>
		project(land, p.x, p.y, heightOf(land, land.f(p.x, p.y)));

	const drawn = $derived(
		trails.map((tr) => {
			let d = '';
			let pen = false;
			for (const p of tr.points) {
				if (!inside(p)) {
					pen = false;
					continue;
				}
				const q = at(p);
				d += `${pen ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
				pen = true;
			}
			const show = inside(tr.ball);
			const b = show ? at(tr.ball) : { x: 0, y: 0 };
			return { key: tr.key, color: tr.color, d, show, b };
		})
	);

	const corner = (x: number, y: number) => project(land, x, y, 0);
	const base = $derived(
		[
			corner(land.x[0], land.y[0]),
			corner(land.x[1], land.y[0]),
			corner(land.x[1], land.y[1]),
			corner(land.x[0], land.y[1])
		]
			.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join('') + 'Z'
	);
	const axisA = $derived(corner((land.x[0] + land.x[1]) / 2, land.y[0]));
	const axisB = $derived(corner(land.x[1], (land.y[0] + land.y[1]) / 2));
</script>

<g style:pointer-events="none">
	<!-- the floor of the picture: the map, flat -->
	<path d={base} fill="none" stroke="var(--stage-line)" stroke-dasharray="3 4" />
	<Readout id="surface-axes">
		<Txt x={axisA.x} y={axisA.y + 26} text="{land.xName} →" anchor="middle" size={12} muted />
		<Txt x={axisB.x + 14} y={axisB.y + 8} text="{land.yName} ↗" size={12} muted />
	</Readout>

	{#each grid.rows as row (row.key)}
		{#each row.patches as p (p.key)}
			<path d={p.d} fill={p.fill} stroke={p.fill} stroke-width="0.6" stroke-linejoin="round" />
		{/each}
		<path d={row.line} fill="none" stroke="var(--gd-mesh)" stroke-width="0.6" opacity="0.4" />
	{/each}

	{#if showMinima}
		{#each land.minima as m, i (i)}
			{@const q = at(m)}
			<path
				d="M{q.x - 5} {q.y - 5}l10 10m0 -10l-10 10"
				stroke="var(--gd-min)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
	{/if}

	{#each drawn as tr (tr.key)}
		<path
			d={tr.d}
			fill="none"
			stroke={tr.color}
			stroke-width="1.6"
			stroke-linejoin="round"
			opacity="0.8"
		/>
		{#if tr.show}
			<circle
				cx={tr.b.x}
				cy={tr.b.y - 7}
				r="8"
				fill={tr.color}
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/if}
	{/each}

	<Readout id="surface-title">
		<Txt
			x={LEFT.x + 4}
			y={LEFT.y + 14}
			text="height = loss (cut off flat at the top)"
			size={12}
			muted
		/>
	</Readout>
</g>
