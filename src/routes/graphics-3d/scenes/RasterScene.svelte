<script lang="ts">
	/**
	 * The rasteriser at work. Left: the map with the camera and the lamp (both draggable).
	 * Right: the 192 × 120 picture made by the model's `rasterise` (projection, edge functions,
	 * z-buffer, Lambert + Phong shading, perspective-correct texture), repainted only when a
	 * control changes. Below the map: the rasteriser's work counters. Below the picture, per
	 * phase:
	 *  - zbuffer: the depth buffer (dark = near); the `zbuffer` toggle switches the depth test off;
	 *  - shading: the picked pixel's normal, lamp and eye directions and its brightness sums
	 *    (`shading` selects none / Lambert / Lambert + Phong);
	 *  - texture: the floor's texture, with the picked pixel's (u, v) on it (`texture`,
	 *    `perspectiveCorrect`);
	 *  - raster: what the picture lacks (no shadows, reflections or transparency).
	 * Controls that belong to another phase are held at their full-pipeline values, so each
	 * step shows only its own effect. Nothing here moves with t.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULT_RASTER,
		FLOOR_TILES,
		ID,
		OBJECT_NAMES,
		AMBIENT,
		buildScene,
		lightPos,
		makeCamera,
		probe,
		projectPoint,
		rasterise,
		traceWorld,
		triangleCount,
		MIRROR_CENTRE,
		MIRROR_R,
		add,
		normalize,
		scale,
		sub,
		type RasterOptions,
		type Vec3,
		type Shading
	} from '../render';
	import {
		cameraOf,
		cubeTurnOf,
		depthImage,
		fmt,
		IMG_H,
		IMG_W,
		lightOf,
		MAP,
		pickOf,
		thousands,
		toDataUrl
	} from './shared';
	import MapView from './MapView.svelte';
	import Picture from './Picture.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'raster'));
	const cam = $derived(cameraOf(params));
	const light = $derived(lightOf(params));
	const turn = $derived(cubeTurnOf(params));
	const scene = $derived(buildScene(turn));
	const camera = $derived(makeCamera(cam, IMG_W, IMG_H));
	const L = $derived(lightPos(light));

	const opts = $derived<RasterOptions>({
		...DEFAULT_RASTER,
		zbuffer: phase === 'zbuffer' ? params.zbuffer !== false : true,
		shading:
			phase === 'shading' ? ((String(params.shading ?? 'phong') as Shading) ?? 'phong') : 'phong',
		texture: phase === 'texture' ? params.texture !== false : true,
		perspectiveCorrect: phase === 'texture' ? params.perspectiveCorrect !== false : true
	});
	// On the last step the picture is built triangle by triangle, in the order they come (a pure
	// function of t in 48 stages, each rendered once), once, then held complete.
	const BUILD = 8;
	const STAGES = 48;
	const stage = $derived(
		phase === 'raster' && !reduced ? Math.min(STAGES, Math.floor((t / BUILD) * STAGES)) : STAGES
	);
	const img = $derived(
		rasterise(scene, camera, L, {
			...opts,
			limit: stage < STAGES ? Math.round((stage / STAGES) * triangleCount(scene)) : undefined
		})
	);
	const url = $derived(toDataUrl(img));
	const depthUrl = $derived(
		phase === 'zbuffer' ? toDataUrl(depthImage(img.depth, IMG_W, IMG_H, 3, 13)) : ''
	);

	const R = { x: 352, y: 16, w: 592, h: 370 };

	// ---- picked pixel (shading and texture) ----------------------------------------------
	const pickKey = $derived(`pick:${phase}`);
	const fallback = $derived.by<[number, number]>(() => {
		const p =
			phase === 'texture'
				? projectPoint(camera, [1.6, 0, 2.3]).pixel
				: projectPoint(camera, highlightPoint()).pixel;
		return [
			Math.min(IMG_W - 1, Math.max(0, Math.floor(p[0]))),
			Math.min(IMG_H - 1, Math.max(0, Math.floor(p[1])))
		];
	});
	/** Where the mirror ball's highlight is: its normal halfway between the lamp and the eye. */
	function highlightPoint(): Vec3 {
		const n = normalize(
			add(normalize(sub(L, MIRROR_CENTRE)), normalize(sub(camera.eye, MIRROR_CENTRE)))
		);
		// A little off the peak, so the numbers are not all round.
		const m = normalize(add(n, [0.08, -0.06, 0]));
		return add(MIRROR_CENTRE, scale(m, MIRROR_R));
	}
	const pick = $derived(pickOf(params, pickKey, fallback));
	const world = $derived(traceWorld(scene));
	const hit = $derived(probe(world, camera, L, pick[0], pick[1]));
	const pickedId = $derived(img.ids[pick[1] * IMG_W + pick[0]]);
	const pixUv = $derived<[number, number]>([
		img.uv[2 * (pick[1] * IMG_W + pick[0])],
		img.uv[2 * (pick[1] * IMG_W + pick[0]) + 1]
	]);

	const s = $derived(img.stats);
	const BX = 16;
	const BY = 352;
	const B2 = 402;
	const shadingName: Record<string, string> = {
		none: 'none: flat colour',
		lambert: 'Lambert',
		phong: 'Lambert + Phong'
	};

	/** Swatch of the floor texture. */
	const TX = 380;
	const TY = 424;
	const TS = 152;
	const tex = $derived.by(() => {
		let d = '';
		const c = TS / FLOOR_TILES;
		for (let j = 0; j < FLOOR_TILES; j++)
			for (let i = 0; i < FLOOR_TILES; i++)
				if ((i + j) % 2 === 0) d += `M${TX + i * c} ${TY + TS - (j + 1) * c}h${c}v${c}h${-c}z`;
		return d;
	});

	// ---- the vectors diagram (shading) ---------------------------------------------------
	const DX = 470;
	const DY = 560;
	const arrow = (deg: number, len: number) => {
		const a = (deg * Math.PI) / 180;
		return { x: DX + len * Math.sin(a), y: DY - len * Math.cos(a) };
	};
</script>

<g>
	<MapView box={MAP} {cam} {light} cubeTurn={turn} {setParam} />
	<Picture
		id="g3raster"
		x={R.x}
		y={R.y}
		w={R.w}
		h={R.h}
		{url}
		label="Rasterised picture"
		pick={phase === 'shading' || phase === 'texture' ? pick : null}
		onpick={phase === 'shading' || phase === 'texture'
			? (p: [number, number]) => setParam(pickKey, `${p[0]},${p[1]}`)
			: undefined}
	/>

	<!-- the rasteriser's work -->
	<rect
		x={BX}
		y={BY}
		width={320}
		height={232}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="work-title">
		<T x={BX + 16} y={BY + 26} text="The rasteriser's work" size={14} weight={700} />
	</Readout>
	{#snippet row(y: number, label: string, value: string, color?: string)}
		<T x={BX + 16} {y} text={label} size={12.5} muted />
		<T x={BX + 304} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
	{/snippet}
	<Readout id="tris" order={1} label="Triangles projected" value={thousands(s.triangles)}>
		{@render row(BY + 56, 'Triangles projected', thousands(s.triangles))}
	</Readout>
	<Readout id="tests" order={2} label="Pixel tests" value={thousands(s.pixelTests)}>
		{@render row(BY + 82, 'Pixel centres tested', thousands(s.pixelTests))}
	</Readout>
	<Readout id="frags" order={3} label="Pixels covered" value={thousands(s.fragments)}>
		{@render row(BY + 108, 'Inside a triangle', thousands(s.fragments))}
	</Readout>
	<Readout
		id="hidden"
		order={4}
		label="Thrown away by the z-buffer"
		value={opts.zbuffer ? thousands(s.hidden) : 'off'}
		opacity={phase === 'zbuffer' || phase === 'raster' ? 1 : 0}
	>
		{@render row(
			BY + 134,
			'Hidden (lost the depth test)',
			opts.zbuffer ? thousands(s.hidden) : 'depth test off'
		)}
	</Readout>
	<Readout
		id="shaded"
		order={5}
		label="Pixels shaded"
		value={thousands(s.shaded)}
		opacity={phase === 'raster' ? 1 : 0}
	>
		{@render row(BY + 160, 'Pixels shaded', thousands(s.shaded))}
	</Readout>
	<Readout id="size">
		<T x={BX + 16} y={BY + 210} text="Picture: 192 × 120 = 23,040 pixels" size={12} muted />
	</Readout>

	<!-- below the picture -->
	{#if phase === 'zbuffer'}
		<Readout id="depth-title" order={6} label="Depth buffer" value="dark = near, light = far">
			<T
				x={R.x}
				y={B2 + 16}
				text="The z-buffer: depth of the nearest surface so far"
				size={13}
				weight={650}
			/>
		</Readout>
		<Picture id="g3depth" x={R.x} y={B2 + 28} w={240} h={150} url={depthUrl} label="Depth buffer" />
		<Readout id="depth-key">
			<T x={R.x + 260} y={B2 + 50} text="dark: near the camera" size={13} />
			<T x={R.x + 260} y={B2 + 74} text="light: far away (white: nothing, the sky)" size={13} />
			<T
				x={R.x + 260}
				y={B2 + 112}
				text={opts.zbuffer
					? 'A piece of triangle is drawn only if it is'
					: 'Depth test off: the last triangle painted'}
				size={13}
				weight={650}
			/>
			<T
				x={R.x + 260}
				y={B2 + 134}
				text={opts.zbuffer ? 'nearer than what the buffer holds.' : 'on a pixel wins, near or far.'}
				size={13}
				weight={650}
			/>
		</Readout>
	{:else if phase === 'shading'}
		<Readout id="obj" order={6} label="Picked pixel shows" value={OBJECT_NAMES[pickedId]}>
			<T
				x={R.x}
				y={B2 + 16}
				text="Picked pixel: the {OBJECT_NAMES[pickedId]}"
				size={13}
				weight={650}
			/>
		</Readout>
		{#if hit && opts.shading !== 'none'}
			<!-- surface, normal, lamp, mirror direction; angles from n are the real ones -->
			<g>
				<line
					x1={DX - 90}
					y1={DY}
					x2={DX + 90}
					y2={DY}
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				{#each [{ p: arrow(0, 80), c: 'var(--stage-ink)', t: 'n' }, { p: arrow(-hit.angle, 80), c: 'var(--g3-lamp)', t: 'l' }, ...(opts.shading === 'phong' ? [{ p: arrow(hit.angle, 80), c: 'var(--g3-reflect)', t: 'r' }] : [])] as v (v.t)}
					<line
						x1={DX}
						y1={DY}
						x2={v.p.x}
						y2={v.p.y}
						stroke={v.c}
						stroke-width="2.5"
						marker-end="url(#arrowhead)"
					/>
					<T
						x={v.p.x + (v.p.x < DX ? -6 : 6)}
						y={v.p.y - 2}
						text={v.t}
						size={14}
						weight={700}
						color={v.c}
						anchor={v.p.x < DX ? 'end' : 'start'}
					/>
				{/each}
			</g>
			<Readout
				id="angle"
				order={7}
				label="Angle between n and the lamp"
				value="{Math.round(hit.angle)}°"
			>
				<T
					x={R.x}
					y={B2 + 40}
					text="n: normal   l: to the lamp{opts.shading === 'phong' ? '   r: l mirrored' : ''}"
					size={12}
					muted
				/>
			</Readout>
			<Readout
				id="lambert"
				order={8}
				label="Lambert n · l"
				value="{fmt(Math.max(0, hit.nl))} (cos {Math.round(hit.angle)}°)"
			>
				<T x={600} y={B2 + 50} text="angle n to l: {Math.round(hit.angle)}°" size={13} />
				<T
					x={600}
					y={B2 + 76}
					text="Lambert: n · l = cos {Math.round(hit.angle)}° = {fmt(Math.max(0, hit.nl))}"
					size={13}
					weight={650}
					color="var(--g3-lamp)"
				/>
				<T x={600} y={B2 + 100} text="+ ambient {AMBIENT}" size={13} muted />
			</Readout>
			{#if opts.shading === 'phong'}
				<Readout id="phong" order={9} label="Phong highlight" value={fmt(hit.highlight)}>
					<T
						x={600}
						y={B2 + 126}
						text="Phong highlight (r · eye)^shine: + {fmt(hit.highlight)}"
						size={13}
						weight={650}
						color="var(--g3-reflect)"
					/>
				</Readout>
			{/if}
		{:else if opts.shading === 'none'}
			<Readout
				id="none"
				order={7}
				label="Shading"
				value="none: every pixel of an object has its flat colour"
			>
				<T
					x={R.x}
					y={B2 + 50}
					text="No shading: each object is a flat patch of its own colour."
					size={13}
				/>
				<T
					x={R.x}
					y={B2 + 74}
					text="Without light and dark, the eye can't see its shape."
					size={13}
					muted
				/>
			</Readout>
		{:else}
			<Readout id="sky" order={7} label="Picked pixel" value="the sky (no surface)">
				<T x={R.x} y={B2 + 50} text="Nothing here but sky. Pick a pixel on an object." size={13} />
			</Readout>
		{/if}
		<Readout id="mode">
			<T
				x={944}
				y={B2 + 172}
				text="shading: {shadingName[opts.shading]}"
				size={12}
				anchor="end"
				muted
			/>
		</Readout>
	{:else if phase === 'texture'}
		<Readout id="tex-title">
			<T x={R.x} y={B2 + 12} text="The floor's texture: 8 × 8 squares" size={13} weight={650} />
		</Readout>
		<rect x={TX} y={TY} width={TS} height={TS} fill="var(--g3-floor)" stroke="var(--border)" />
		<path d={tex} fill="var(--g3-floor-dark)" />
		<T x={TX + TS + 6} y={TY + TS + 4} text="u" size={12} muted />
		<T x={TX - 12} y={TY + 4} text="v" size={12} muted />
		{#if pickedId === ID.floor && hit}
			{@const mk = { x: TX + pixUv[0] * TS, y: TY + TS - pixUv[1] * TS }}
			{@const tr = { x: TX + hit.uv[0] * TS, y: TY + TS - hit.uv[1] * TS }}
			<circle cx={tr.x} cy={tr.y} r="7" fill="none" stroke="var(--g3-refract)" stroke-width="2" />
			<circle cx={mk.x} cy={mk.y} r="4" fill="var(--g3-eye)" />
			<Readout
				id="uv"
				order={6}
				label="Picked pixel's (u, v)"
				value="({fmt(pixUv[0])}, {fmt(pixUv[1])})"
				color="var(--g3-eye)"
			>
				<T
					x={580}
					y={B2 + 48}
					text="picked pixel looks up (u, v) = ({fmt(pixUv[0])}, {fmt(pixUv[1])})"
					size={13}
					weight={650}
					color="var(--g3-eye)"
				/>
			</Readout>
			<Readout
				id="uvtrue"
				order={7}
				label="Where the floor really is"
				value="({fmt(hit.uv[0])}, {fmt(hit.uv[1])})"
				color="var(--g3-refract)"
			>
				<T
					x={580}
					y={B2 + 74}
					text="the floor really seen there: ({fmt(hit.uv[0])}, {fmt(hit.uv[1])})"
					size={13}
					color="var(--g3-refract)"
				/>
			</Readout>
			<Readout id="uvnote">
				<T
					x={580}
					y={B2 + 110}
					text={opts.perspectiveCorrect
						? 'Perspective-correct: they agree.'
						: 'Blended evenly on the screen: they differ.'}
					size={13}
					weight={650}
				/>
				<T x={580} y={B2 + 134} text="Pick other floor pixels, far and near." size={12.5} muted />
			</Readout>
		{:else}
			<Readout id="uvnone" order={6} label="Picked pixel" value="not on the floor">
				<T x={580} y={B2 + 48} text="Pick a pixel on the floor to see its (u, v)." size={13} />
			</Readout>
		{/if}
	{:else}
		<Readout
			id="lack"
			order={6}
			label="What is missing"
			value="shadows, reflections, light through glass"
		>
			<T
				x={R.x}
				y={B2 + 22}
				text="Each triangle was drawn knowing only itself, the camera and the lamp."
				size={13}
				weight={650}
			/>
			<T x={R.x + 16} y={B2 + 52} text="· nothing casts a shadow" size={13} />
			<T
				x={R.x + 16}
				y={B2 + 76}
				text="· the mirror ball reflects nothing: it is plain shiny grey"
				size={13}
			/>
			<T x={R.x + 16} y={B2 + 100} text="· the glass ball is opaque" size={13} />
		</Readout>
	{/if}
</g>
