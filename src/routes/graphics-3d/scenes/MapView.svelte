<script lang="ts">
	/**
	 * The scene seen from above: the chequered floor, the cube (turned by `cubeTurn`), the mirror
	 * and glass balls, the camera with its wedge of view, and the lamp. The camera and the lamp
	 * are `<Handle>`s: dragging the camera sets its direction and distance (`az`, `dist`),
	 * dragging the lamp its direction and height (`lightAz`, `lightEl`: nearer the middle is
	 * higher). Optional `segments` (rays from the ray tracer) are drawn flattened onto the floor.
	 */
	import { Handle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CUBE_CENTRE,
		CUBE_SIZE,
		FLOOR_HALF,
		GLASS_CENTRE,
		GLASS_R,
		LIGHT_DIST,
		MIRROR_CENTRE,
		MIRROR_R,
		eyeOf,
		lightPos,
		TARGET,
		type CameraSpec,
		type LightSpec,
		type Segment,
		type Vec3
	} from '../render';
	import { cameraFromMap, lightFromMap, toMap, wrap, IMG_H, IMG_W, type MapBox } from './shared';
	import T from './T.svelte';

	interface Props {
		box: MapBox;
		cam: CameraSpec;
		light: LightSpec;
		cubeTurn: number;
		setParam: StageProps['setParam'];
		showLight?: boolean;
		/** Object to draw at full strength (others dimmed), if any. */
		focus?: 'cube' | null;
		segments?: Segment[];
		/** Highest ray depth to draw. */
		maxDepth?: number;
	}
	let {
		box,
		cam,
		light,
		cubeTurn,
		setParam,
		showLight = true,
		focus = null,
		segments = [],
		maxDepth = 99
	}: Props = $props();

	const P = (v: Vec3) => toMap(box, v[0], v[2]);
	const floorA = $derived(toMap(box, -FLOOR_HALF, -FLOOR_HALF));
	const floorW = $derived(2 * FLOOR_HALF * box.scale);

	const cube = $derived.by(() => {
		const c = Math.cos(cubeTurn);
		const s = Math.sin(cubeTurn);
		const h = CUBE_SIZE / 2;
		return (
			[
				[-h, -h],
				[h, -h],
				[h, h],
				[-h, h]
			] as const
		)
			.map(([x, z]) => {
				const p = toMap(box, CUBE_CENTRE[0] + c * x + s * z, CUBE_CENTRE[2] - s * x + c * z);
				return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
			})
			.join(' ');
	});
	const mirror = $derived(P(MIRROR_CENTRE));
	const glass = $derived(P(GLASS_CENTRE));

	const eye = $derived(eyeOf(cam));
	const eyeP = $derived(P(eye));
	const tgt = $derived(P(TARGET));
	/** The camera's horizontal wedge of view. */
	const wedge = $derived.by(() => {
		const half = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (IMG_W / IMG_H));
		const a = Math.atan2(tgt.y - eyeP.y, tgt.x - eyeP.x);
		const L = 2 * box.size;
		const p = (da: number) => ({
			x: eyeP.x + L * Math.cos(a + da),
			y: eyeP.y + L * Math.sin(a + da)
		});
		return { l: p(-half), r: p(half), a: (a * 180) / Math.PI };
	});
	const lamp = $derived(P(lightPos(light)));

	const segColor: Record<Segment['kind'], string> = {
		eye: 'var(--g3-eye)',
		reflect: 'var(--g3-reflect)',
		refract: 'var(--g3-refract)',
		lit: 'var(--g3-lamp)',
		shadow: 'var(--g3-shadow)'
	};
	const shown = $derived(segments.filter((s) => s.depth <= maxDepth).slice(0, 40));

	function moveCam(p: { x: number; y: number }) {
		const c = cameraFromMap(box, p, cam.el);
		setParam('az', c.az);
		setParam('dist', c.dist);
	}
	function keyCam(k: number | 'start' | 'end') {
		if (k === 'start') setParam('az', -180);
		else if (k === 'end') setParam('az', 180);
		else setParam('az', wrap(cam.az + k * 2));
	}
	function moveLamp(p: { x: number; y: number }) {
		const l = lightFromMap(box, p, LIGHT_DIST);
		setParam('lightAz', l.az);
		setParam('lightEl', l.el);
	}
	function keyLamp(k: number | 'start' | 'end') {
		if (k === 'start') setParam('lightAz', -180);
		else if (k === 'end') setParam('lightAz', 180);
		else setParam('lightAz', wrap(light.az + k * 2));
	}
	const dim = (on: boolean) => (focus && !on ? 0.4 : 1);
</script>

<g>
	<defs>
		<clipPath id="g3map-clip">
			<rect x={box.x} y={box.y} width={box.size} height={box.size} rx="12" />
		</clipPath>
		<pattern
			id="g3map-checker"
			x={floorA.x}
			y={floorA.y}
			width={2 * box.scale}
			height={2 * box.scale}
			patternUnits="userSpaceOnUse"
		>
			<rect width={2 * box.scale} height={2 * box.scale} fill="var(--g3-floor)" />
			<rect width={box.scale} height={box.scale} fill="var(--g3-floor-dark)" />
			<rect
				x={box.scale}
				y={box.scale}
				width={box.scale}
				height={box.scale}
				fill="var(--g3-floor-dark)"
			/>
		</pattern>
	</defs>
	<rect
		x={box.x}
		y={box.y}
		width={box.size}
		height={box.size}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#g3map-clip)">
		<rect
			x={floorA.x}
			y={floorA.y}
			width={floorW}
			height={floorW}
			fill="url(#g3map-checker)"
			stroke="var(--stage-line)"
			opacity={dim(false)}
		/>
		<!-- camera's view -->
		<path
			d="M{eyeP.x} {eyeP.y} L{wedge.l.x} {wedge.l.y} L{wedge.r.x} {wedge.r.y} Z"
			fill="var(--g3-camera)"
			fill-opacity="0.08"
			stroke="var(--g3-camera)"
			stroke-opacity="0.6"
			stroke-dasharray="5 4"
		/>
		<polygon
			points={cube}
			fill="var(--g3-cube)"
			fill-opacity="0.85"
			stroke="var(--stage-ink)"
			stroke-opacity="0.5"
			opacity={dim(focus === 'cube')}
		/>
		<circle
			cx={mirror.x}
			cy={mirror.y}
			r={MIRROR_R * box.scale}
			fill="var(--g3-mirror)"
			stroke="var(--stage-ink)"
			stroke-opacity="0.5"
			opacity={dim(false)}
		/>
		<circle
			cx={glass.x}
			cy={glass.y}
			r={GLASS_R * box.scale}
			fill="var(--g3-glass)"
			fill-opacity="0.55"
			stroke="var(--stage-ink)"
			stroke-opacity="0.5"
			opacity={dim(false)}
		/>
		<!-- rays, flattened onto the floor -->
		{#each shown as s, i (i)}
			{@const a = P(s.from)}
			{@const b = P(s.to)}
			<line
				x1={a.x}
				y1={a.y}
				x2={b.x}
				y2={b.y}
				stroke={segColor[s.kind]}
				stroke-width={s.kind === 'eye' ? 2.5 : 2}
				stroke-dasharray={s.kind === 'lit' || s.kind === 'shadow' ? '4 3' : undefined}
				stroke-linecap="round"
			/>
			{#if s.kind === 'shadow'}
				<path
					d="M{b.x - 4} {b.y - 4} L{b.x + 4} {b.y + 4} M{b.x - 4} {b.y + 4} L{b.x + 4} {b.y - 4}"
					stroke={segColor.shadow}
					stroke-width="2.2"
				/>
			{:else if s.kind !== 'lit' && !s.escaped}
				<circle cx={b.x} cy={b.y} r="2.6" fill={segColor[s.kind]} />
			{/if}
		{/each}
	</g>

	<Readout id="map-title">
		<T x={box.x + 12} y={box.y + 22} text="Seen from above" size={12.5} weight={650} muted />
	</Readout>

	<!-- the camera -->
	<g transform="translate({eyeP.x} {eyeP.y}) rotate({wedge.a})" style:pointer-events="none">
		<rect x="-11" y="-8" width="16" height="16" rx="3" fill="var(--g3-camera)" />
		<path d="M5 -5 L12 -8 L12 8 L5 5 Z" fill="var(--g3-camera)" />
	</g>
	<Handle
		x={eyeP.x}
		y={eyeP.y}
		r={7}
		label="Camera (drag it round the scene)"
		value={Math.round(cam.az)}
		min={-180}
		max={180}
		valuetext="camera at {Math.round(cam.az)} degrees, distance {cam.dist.toFixed(1)}"
		color="var(--g3-camera)"
		onmove={moveCam}
		onkey={keyCam}
	/>

	{#if showLight}
		<g style:pointer-events="none">
			{#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
				<line
					x1={lamp.x + 9 * Math.cos((a * Math.PI) / 180)}
					y1={lamp.y + 9 * Math.sin((a * Math.PI) / 180)}
					x2={lamp.x + 14 * Math.cos((a * Math.PI) / 180)}
					y2={lamp.y + 14 * Math.sin((a * Math.PI) / 180)}
					stroke="var(--g3-lamp)"
					stroke-width="2"
					stroke-linecap="round"
				/>
			{/each}
		</g>
		<Handle
			x={lamp.x}
			y={lamp.y}
			r={7}
			label="Lamp (drag it round; towards the middle raises it)"
			value={Math.round(light.az)}
			min={-180}
			max={180}
			valuetext="lamp at {Math.round(light.az)} degrees, {Math.round(light.el)} degrees high"
			color="var(--g3-lamp)"
			onmove={moveLamp}
			onkey={keyLamp}
		/>
	{/if}
</g>
