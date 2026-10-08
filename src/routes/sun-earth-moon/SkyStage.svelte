<script lang="ts">
	/** Root of the Sun–Earth–Moon illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		seasons: () => import('./scenes/SeasonsScene.svelte'),
		sunlight: () => import('./scenes/SunlightScene.svelte'),
		moon: () => import('./scenes/MoonScene.svelte'),
		tides: () => import('./scenes/TidesScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
