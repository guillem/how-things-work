<script lang="ts">
	/**
	 * The ray tracer at work. Left: the map with the camera and lamp, and every ray traced for
	 * the picked pixel, flattened onto the floor (eye ray, shadow rays, reflected and refracted
	 * rays). Right: the 192 × 120 picture made by the model's `raytrace` from the same triangles,
	 * camera and shading as the rasteriser. Below: the ray tracer's work counters and the picked
	 * pixel's story.
	 *  - rays: no shadows, no bounces; the picture is revealed row by row as a pure function of t
	 *    (the picture itself is computed once), complete under reduced motion;
	 *  - shadows: shadow rays switchable (`shadows`), no bounces;
	 *  - bounces: shadow rays on, `bounces` sets how many reflections/refractions are followed.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULT_TRACE,
		GLASS_CENTRE,
		OBJECT_NAMES,
		CUBE_CENTRE,
		buildScene,
		lightPos,
		makeCamera,
		normalize,
		projectPoint,
		raytrace,
		traceWorld,
		tracePixel,
		type Segment,
		type TraceOptions,
		type Vec3
	} from '../render';
	import {
		cameraOf,
		cubeTurnOf,
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
	import { Label } from '#lib/draw/index.ts';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'rays'));
	const cam = $derived(cameraOf(params));
	const light = $derived(lightOf(params));
	const turn = $derived(cubeTurnOf(params));
	const scene = $derived(buildScene(turn));
	const world = $derived(traceWorld(scene));
	const camera = $derived(makeCamera(cam, IMG_W, IMG_H));
	const L = $derived(lightPos(light));
	const bounceN = $derived(Number(params.bounces ?? 3));

	const opts = $derived<TraceOptions>({
		...DEFAULT_TRACE,
		shadows: phase === 'rays' ? false : phase === 'shadows' ? params.shadows !== false : true,
		bounces: phase === 'bounces' ? bounceN : 0
	});
	const img = $derived(raytrace(world, camera, L, opts));
	const url = $derived(toDataUrl(img));

	const SCAN = 8;
	const reveal = $derived(phase === 'rays' && !reduced ? Math.min(1, t / SCAN) : 1);

	const rowsDone = $derived(Math.round(reveal * IMG_H));
	const R = { x: 352, y: 16, w: 592, h: 370 };

	// ---- the picked pixel ----------------------------------------------------------------
	const pickKey = $derived(`pick:${phase === 'bounces' ? 'bounces' : 'trace'}`);
	const clampPx = (p: [number, number]): [number, number] => [
		Math.min(IMG_W - 1, Math.max(0, Math.floor(p[0]))),
		Math.min(IMG_H - 1, Math.max(0, Math.floor(p[1])))
	];
	const fallback = $derived.by<[number, number]>(() => {
		if (phase === 'bounces') return clampPx(projectPoint(camera, GLASS_CENTRE).pixel);
		// The floor in the cube's shadow: from the lamp through a point inside the cube, down.
		const d = normalize([
			CUBE_CENTRE[0] - L[0],
			CUBE_CENTRE[1] + 0.2 - L[1],
			CUBE_CENTRE[2] - L[2]
		]);
		const k = -L[1] / d[1];
		const p: Vec3 = [L[0] + d[0] * k, 0, L[2] + d[2] * k];
		const q = projectPoint(camera, p).pixel;
		const onScreen = q[0] >= 0 && q[0] < IMG_W && q[1] >= 0 && q[1] < IMG_H;
		return clampPx(onScreen ? q : projectPoint(camera, CUBE_CENTRE).pixel);
	});
	const pick = $derived(pickOf(params, pickKey, fallback));
	const path = $derived(tracePixel(world, camera, L, pick[0], pick[1], opts));

	/** The picked pixel's story, one line per ray. */
	const story = $derived.by(() => {
		const lines: { text: string; color: string }[] = [];
		const name = (s: Segment) => {
			if (s.escaped) return 'reaches the sky';
			return `hits the ${OBJECT_NAMES[s.obj ?? 0]}`;
		};
		for (const s of path.segments) {
			if (lines.length >= 5) break;
			if (s.kind === 'eye') lines.push({ text: `eye ray ${name(s)}`, color: 'var(--g3-eye)' });
			else if (s.kind === 'reflect')
				lines.push({ text: `reflected ray ${name(s)}`, color: 'var(--g3-reflect)' });
			else if (s.kind === 'refract')
				lines.push({ text: `refracted ray ${name(s)}`, color: 'var(--g3-refract)' });
			else if (s.kind === 'lit')
				lines.push({ text: 'shadow ray reaches the lamp: lit', color: 'var(--g3-lamp)' });
			else lines.push({ text: 'shadow ray blocked: in shadow', color: 'var(--g3-shadow)' });
		}
		const more = path.segments.length - lines.length;
		return { lines, more };
	});
	const s = $derived(img.stats);
	const BX = 16;
	const BY = 352;
	const B2 = 402;
</script>

<g>
	<MapView
		box={MAP}
		{cam}
		{light}
		cubeTurn={turn}
		{setParam}
		segments={path.segments}
		showLight={phase !== 'rays'}
	/>
	<Picture
		id="g3trace"
		x={R.x}
		y={R.y}
		w={R.w}
		h={R.h}
		{url}
		label="Ray-traced picture"
		{pick}
		onpick={(p: [number, number]) => setParam(pickKey, `${p[0]},${p[1]}`)}
		{reveal}
	/>

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
		<Label
			anchor="start"
			x={BX + 16}
			y={BY + 26}
			text="The ray tracer's work"
			size={14}
			weight={700}
		/>
	</Readout>
	{#snippet row(y: number, label: string, value: string, color?: string)}
		<Label anchor="start" x={BX + 16} {y} text={label} size={12.5} muted />
		<Label x={BX + 304} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
	{/snippet}
	<Readout id="primary" order={1} label="Rays from the eye" value={thousands(rowsDone * IMG_W)}>
		{@render row(
			BY + 56,
			'Rays from the eye (1 per pixel)',
			thousands(rowsDone * IMG_W),
			'var(--g3-eye)'
		)}
	</Readout>
	<Readout
		id="shadow"
		order={2}
		label="Shadow rays"
		value={thousands(s.shadow)}
		opacity={phase === 'rays' ? 0 : 1}
	>
		{@render row(
			BY + 82,
			'Shadow rays',
			phase === 'rays' ? '–' : thousands(s.shadow),
			'var(--g3-lamp)'
		)}
	</Readout>
	<Readout
		id="secondary"
		order={3}
		label="Reflected and refracted rays"
		value={thousands(s.secondary)}
		opacity={phase === 'bounces' ? 1 : 0}
	>
		{@render row(
			BY + 108,
			'Reflected and refracted rays',
			phase === 'bounces' ? thousands(s.secondary) : '–',
			'var(--g3-reflect)'
		)}
	</Readout>
	<Readout
		id="tests"
		order={4}
		label="Ray–triangle tests"
		value={thousands(s.triangleTests * reveal)}
	>
		{@render row(BY + 134, 'Ray–triangle tests', thousands(Math.round(s.triangleTests * reveal)))}
	</Readout>
	<Readout id="settings">
		<Label
			anchor="start"
			x={BX + 16}
			y={BY + 176}
			text="shadow rays {opts.shadows ? 'on' : 'off'} · bounce limit {opts.bounces}"
			size={12.5}
			weight={650}
		/>
		<Label
			anchor="start"
			x={BX + 16}
			y={BY + 210}
			text="Picture: 192 × 120 = 23,040 pixels"
			size={12}
			muted
		/>
	</Readout>

	<!-- the picked pixel's story -->
	<Readout
		id="story"
		order={5}
		label="Picked pixel"
		value={story.lines
			.slice(0, 3)
			.map((l) => l.text)
			.join('; ') + (story.lines.length + story.more > 3 ? ' …' : '')}
	>
		<Label
			anchor="start"
			x={R.x}
			y={B2 + 16}
			text="The picked pixel (click the picture to pick another)"
			size={13}
			weight={650}
		/>
		{#each story.lines as l, i (i)}
			<line
				x1={R.x}
				y1={B2 + 38 + 24 * i}
				x2={R.x + 22}
				y2={B2 + 38 + 24 * i}
				stroke={l.color}
				stroke-width="3"
				stroke-dasharray={l.text.startsWith('shadow') ? '4 3' : undefined}
			/>
			<Label anchor="start" x={R.x + 32} y={B2 + 43 + 24 * i} text="{i + 1}. {l.text}" size={13} />
		{/each}
		{#if story.more > 0}
			<Label
				anchor="start"
				x={R.x + 32}
				y={B2 + 43 + 24 * story.lines.length}
				text="… and {story.more} more rays"
				size={12.5}
				muted
			/>
		{/if}
	</Readout>
	{#if phase === 'bounces'}
		<Readout id="limit">
			<Label
				x={944}
				y={B2 + 16}
				text="A ray at the limit returns black."
				size={12.5}
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
</g>
