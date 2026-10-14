<script lang="ts">
	/** Root of the 3D-graphics illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		world: () => import('./scenes/WorldScene.svelte'),
		pixels: () => import('./scenes/PixelScene.svelte'),
		raster: () => import('./scenes/RasterScene.svelte'),
		trace: () => import('./scenes/TraceScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
