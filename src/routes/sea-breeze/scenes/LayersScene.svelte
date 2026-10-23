<script lang="ts">
	/**
	 * Why the sea stays cool: the ground and the sea cut open under the same sunshine, on one depth
	 * scale from the surface to 10 m down. On land the day's warmth stays in a band about 20 cm
	 * deep (a thin red line at this scale); in the sea, sunlight shines metres down and the waves'
	 * stirring (turning arrows) spreads the same warmth through the top 10 m. The readouts give each
	 * side's swing over the day, from the model.
	 */
	import { Label, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LAND_DEPTH, SEA_DEPTH, extremes } from '../model';

	let { t, reduced }: StageProps = $props();

	const SURFACE = 214;
	/** Pixels per metre of depth. */
	const PX = 34;
	const BOTTOM = SURFACE + SEA_DEPTH * PX;
	const LAND = { x0: 40, x1: 420 };
	const SEA = { x0: 540, x1: 920 };
	const SUN = { x: 480, y: 76 };

	const land = extremes('land');
	const sea = extremes('sea');
	const landSwing = Math.round(land.max - land.min);
	const seaSwing = sea.max - sea.min < 0.5 ? 'less than half a degree' : 'about a degree';

	/** Sun rays to each side, with dashes marching down them. */
	const rays = [
		...[0, 1, 2, 3].map((k) => ({ k, x: LAND.x0 + 70 + k * 90, side: 'land' })),
		...[0, 1, 2, 3].map((k) => ({ k: k + 4, x: SEA.x0 + 70 + k * 90, side: 'sea' }))
	];
	const march = $derived(reduced ? 0 : -t * 40);

	/** The waves' stirring: turning arrows in the water. */
	const swirls = [
		{ i: 0, x: 640, y: 330, r: 42, dir: 1 },
		{ i: 1, x: 810, y: 392, r: 50, dir: -1 },
		{ i: 2, x: 660, y: 470, r: 40, dir: -1 },
		{ i: 3, x: 830, y: 510, r: 30, dir: 1 }
	];
	const turn = $derived(reduced ? 0.6 : t * 0.9);
	function swirl(x: number, y: number, r: number, a0: number) {
		const a1 = a0 + Math.PI * 1.3;
		const p0 = { x: x + r * Math.cos(a0), y: y + r * Math.sin(a0) };
		const p1 = { x: x + r * Math.cos(a1), y: y + r * Math.sin(a1) };
		// Arrowhead at the end, along the tangent.
		const tx = -Math.sin(a1);
		const ty = Math.cos(a1);
		const nx = Math.cos(a1);
		const ny = Math.sin(a1);
		const h = `M${(p1.x + tx * 12).toFixed(1)} ${(p1.y + ty * 12).toFixed(1)} L${(p1.x + nx * 8).toFixed(1)} ${(p1.y + ny * 8).toFixed(1)} L${(p1.x - nx * 8).toFixed(1)} ${(p1.y - ny * 8).toFixed(1)} Z`;
		return {
			arc: `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${r} ${r} 0 1 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`,
			head: h
		};
	}
	const pebbles = Array.from({ length: 30 }, (_, i) => ({
		i,
		x: LAND.x0 + 20 + hash(i, 1) * (LAND.x1 - LAND.x0 - 40),
		y: SURFACE + 40 + hash(i, 2) * (BOTTOM - SURFACE - 60),
		r: 3 + hash(i, 3) * 5
	}));
</script>

<g class="sbz-layers">
	<defs>
		<linearGradient id="sea-breeze-layers-sky" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sky-day-top)" />
			<stop offset="1" stop-color="var(--sbz-sky-day-low)" />
		</linearGradient>
		<linearGradient id="sea-breeze-layers-water" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sea)" />
			<stop offset="1" stop-color="var(--sbz-sea-deep)" />
		</linearGradient>
		<linearGradient id="sea-breeze-layers-shaft" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="var(--sbz-sun)" stop-opacity="0.4" />
			<stop offset="1" stop-color="var(--sbz-sun)" stop-opacity="0" />
		</linearGradient>
	</defs>

	<rect x="0" y="0" width="960" height={SURFACE} fill="url(#sea-breeze-layers-sky)" />

	<!-- the Sun and its rays -->
	{#each rays as r (r.k)}
		<line
			x1={SUN.x}
			y1={SUN.y}
			x2={r.x}
			y2={SURFACE}
			stroke="var(--sbz-sun)"
			stroke-width="3"
			stroke-dasharray="10 12"
			stroke-dashoffset={march}
			opacity="0.85"
		/>
	{/each}
	<g transform="translate({SUN.x} {SUN.y})">
		{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
			{@const a = (i / 10) * Math.PI * 2}
			<line
				x1={Math.cos(a) * 32}
				y1={Math.sin(a) * 32}
				x2={Math.cos(a) * 42}
				y2={Math.sin(a) * 42}
				stroke="var(--sbz-sun)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/each}
		<circle r="26" fill="var(--sbz-sun)" />
	</g>

	<!-- the ground, cut open -->
	<rect
		x={LAND.x0}
		y={SURFACE}
		width={LAND.x1 - LAND.x0}
		height={BOTTOM - SURFACE}
		rx="4"
		fill="var(--sbz-soil)"
	/>
	{#each pebbles as p (p.i)}
		<circle cx={p.x} cy={p.y} r={p.r} fill="var(--sbz-sand)" opacity="0.35" />
	{/each}
	<rect
		x={LAND.x0}
		y={SURFACE}
		width={LAND.x1 - LAND.x0}
		height={LAND_DEPTH * PX}
		fill="var(--sbz-hot)"
	/>
	<rect x={LAND.x0} y={SURFACE - 6} width={LAND.x1 - LAND.x0} height="6" fill="var(--sbz-grass)" />

	<!-- the sea, cut open -->
	<rect
		x={SEA.x0}
		y={SURFACE}
		width={SEA.x1 - SEA.x0}
		height={BOTTOM - SURFACE}
		rx="4"
		fill="url(#sea-breeze-layers-water)"
	/>
	<rect
		x={SEA.x0}
		y={SURFACE}
		width={SEA.x1 - SEA.x0}
		height={BOTTOM - SURFACE}
		rx="4"
		fill="var(--sbz-hot)"
		opacity="0.16"
	/>
	{#each rays.filter((r) => r.side === 'sea') as r (r.k)}
		<rect x={r.x - 7} y={SURFACE} width="14" height="190" fill="url(#sea-breeze-layers-shaft)" />
	{/each}
	{#each swirls as s (s.i)}
		{@const sw = swirl(s.x, s.y, s.r, s.dir * turn + s.i)}
		<g transform={s.dir < 0 ? `translate(${2 * s.x} 0) scale(-1 1)` : undefined}>
			<path d={sw.arc} fill="none" stroke="#fff" stroke-width="3" opacity="0.8" />
			<path d={sw.head} fill="#fff" opacity="0.8" />
		</g>
	{/each}

	<!-- the depth scale between them -->
	{#each [0, 2, 4, 6, 8, 10] as z (z)}
		<line
			x1="466"
			y1={SURFACE + z * PX}
			x2="494"
			y2={SURFACE + z * PX}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<Label x={458} y={SURFACE + z * PX + 5} text="{z} m" anchor="end" size={14} muted tabular />
	{/each}
	<line
		x1="480"
		y1={SURFACE}
		x2="480"
		y2={BOTTOM}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>

	<!-- callouts -->
	<line
		x1="230"
		y1={SURFACE + LAND_DEPTH * PX + 2}
		x2="230"
		y2={SURFACE + 34}
		stroke="#fff"
		stroke-width="1.5"
	/>
	<Readout id="sbz-land-layer" order={2} label="Land" value="the warmth stays in the top 20 cm">
		<Label
			x={230}
			y={SURFACE + 56}
			text="the warmth stays in the top {Math.round(LAND_DEPTH * 100)} cm"
			anchor="middle"
			size={17}
			weight={700}
			halo={false}
			color="#fff"
		/>
	</Readout>
	<Readout id="sbz-sea-layer" order={3} label="Sea" value="waves stir it through the top 10 m">
		<Label
			x={730}
			y={SURFACE + 44}
			text="waves stir it through the top {SEA_DEPTH} m"
			anchor="middle"
			size={17}
			weight={700}
			halo={false}
			color="#fff"
		/>
	</Readout>
	<Readout
		id="sbz-land-swing"
		order={4}
		label="The land’s air"
		value="up {landSwing} degrees from dawn to afternoon"
	>
		<Label
			x={230}
			y={586}
			text="land: up {landSwing} degrees from dawn to afternoon"
			anchor="middle"
			size={16}
			weight={600}
		/>
	</Readout>
	<Readout id="sbz-sea-swing" order={5} label="The sea" value="warms {seaSwing} all day">
		<Label
			x={730}
			y={586}
			text="sea: warms {seaSwing} all day"
			anchor="middle"
			size={16}
			weight={600}
		/>
	</Readout>
	<Readout
		id="sbz-head"
		order={1}
		label="Why"
		value="the same sunshine, spread through very different depths"
	>
		<Label x={944} y={34} text="the same sunshine," anchor="end" size={19} weight={700} />
		<Label x={944} y={58} text="spread very differently" anchor="end" size={19} weight={700} />
	</Readout>
</g>
