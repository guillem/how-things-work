<script lang="ts">
	/**
	 * The two methods side by side: the rasterised and the ray-traced picture of the same scene,
	 * from the same camera, with the same shading (camera, lamp and bounce limit from the
	 * controls). Under each, what it gets right; below, bars of the work each did, to the same
	 * scale (the rasteriser's pixel tests against the ray tracer's ray–triangle tests). Static.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULT_RASTER,
		DEFAULT_TRACE,
		buildScene,
		lightPos,
		makeCamera,
		rasterise,
		raytrace,
		traceWorld
	} from '../render';
	import { cameraOf, cubeTurnOf, IMG_H, IMG_W, lightOf, thousands, toDataUrl } from './shared';
	import Picture from './Picture.svelte';
	import T from './T.svelte';

	let { params }: StageProps = $props();

	const cam = $derived(cameraOf(params));
	const light = $derived(lightOf(params));
	const scene = $derived(buildScene(cubeTurnOf(params)));
	const camera = $derived(makeCamera(cam, IMG_W, IMG_H));
	const L = $derived(lightPos(light));
	const bounces = $derived(Number(params.bounces ?? 3));

	const ras = $derived(rasterise(scene, camera, L, DEFAULT_RASTER));
	const tr = $derived(raytrace(traceWorld(scene), camera, L, { ...DEFAULT_TRACE, bounces }));
	const rasUrl = $derived(toDataUrl(ras));
	const trUrl = $derived(toDataUrl(tr));

	const PW = 456;
	const PH = (PW * IMG_H) / IMG_W;
	const PY = 44;
	const LX = 16;
	const RX = 960 - 16 - PW;

	const rays = $derived(tr.stats.primary + tr.stats.shadow + tr.stats.secondary);
	const maxWork = $derived(Math.max(ras.stats.pixelTests, tr.stats.triangleTests));
	const BAR0 = 300;
	const BARW = 960 - 16 - BAR0 - 110;
	const bw = (v: number) => Math.max(2, (v / maxWork) * BARW);

	const yes = (ok: boolean, what: string) => `${ok ? '✓' : '✗'} ${what}`;
	const traced = $derived([
		yes(true, 'shadows'),
		yes(bounces >= 1, 'reflections'),
		yes(bounces >= 2, 'light through glass')
	]);
	const BY = 410;
</script>

<g>
	<Readout id="t-ras">
		<T
			x={LX}
			y={PY - 12}
			text="Rasterised: triangles projected and filled"
			size={14}
			weight={700}
		/>
	</Readout>
	<Readout id="t-tr">
		<T
			x={RX}
			y={PY - 12}
			text="Ray-traced: light followed back from the eye"
			size={14}
			weight={700}
		/>
	</Readout>
	<Picture id="g3cmp-ras" x={LX} y={PY} w={PW} h={PH} url={rasUrl} label="Rasterised picture" />
	<Picture id="g3cmp-tr" x={RX} y={PY} w={PW} h={PH} url={trUrl} label="Ray-traced picture" />

	<Readout
		id="ras-gets"
		order={1}
		label="Rasteriser"
		value="✗ shadows · ✗ reflections · ✗ light through glass"
	>
		<T
			x={LX}
			y={PY + PH + 26}
			text="✗ shadows   ✗ reflections   ✗ light through glass"
			size={13}
			muted
		/>
	</Readout>
	<Readout id="tr-gets" order={2} label="Ray tracer" value={traced.join(' · ')}>
		<T x={RX} y={PY + PH + 26} text={traced.join('   ')} size={13} weight={650} />
	</Readout>

	<!-- the work, to one scale -->
	<Readout id="work-title">
		<T
			x={LX}
			y={BY - 22}
			text="Work done for this picture (same scale)"
			size={13}
			weight={650}
			muted
		/>
	</Readout>
	<Readout
		id="w-ras"
		order={3}
		label="Rasteriser: pixel tests"
		value={thousands(ras.stats.pixelTests)}
		color="var(--g3-camera)"
	>
		<T x={LX} y={BY + 15} text="Rasteriser: pixel tests" size={13} />
		<rect
			x={BAR0}
			y={BY}
			width={bw(ras.stats.pixelTests)}
			height="22"
			rx="3"
			fill="var(--g3-camera)"
		/>
		<T
			x={BAR0 + bw(ras.stats.pixelTests) + 8}
			y={BY + 16}
			text={thousands(ras.stats.pixelTests)}
			size={13.5}
			weight={700}
		/>
		<T x={LX} y={BY + 36} text="(654 triangles projected)" size={11.5} muted />
	</Readout>
	<Readout
		id="w-tr"
		order={4}
		label="Ray tracer: ray–triangle tests"
		value={thousands(tr.stats.triangleTests)}
		color="var(--g3-reflect)"
	>
		<T x={LX} y={BY + 75} text="Ray tracer: ray–triangle tests" size={13} />
		<rect
			x={BAR0}
			y={BY + 60}
			width={bw(tr.stats.triangleTests)}
			height="22"
			rx="3"
			fill="var(--g3-reflect)"
		/>
		<T
			x={BAR0 + bw(tr.stats.triangleTests) + 8}
			y={BY + 76}
			text={thousands(tr.stats.triangleTests)}
			size={13.5}
			weight={700}
		/>
		<T
			x={LX}
			y={BY + 96}
			text="({thousands(rays)} rays, bounce limit {bounces})"
			size={11.5}
			muted
		/>
	</Readout>
	<Readout
		id="ratio"
		order={5}
		label="Ray tracer ÷ rasteriser"
		value="× {Math.round(tr.stats.triangleTests / ras.stats.pixelTests)}"
	>
		<T
			x={LX}
			y={BY + 140}
			text="Projecting is fast; tracing light back from the eye is faithful: here it does {Math.round(
				tr.stats.triangleTests / ras.stats.pixelTests
			)} times the work."
			size={14}
			weight={700}
		/>
	</Readout>
</g>
