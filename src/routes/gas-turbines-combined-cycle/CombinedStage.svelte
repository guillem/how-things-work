<script lang="ts">
	/** Root of the combined-cycle illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		plant: () => import('./scenes/PlantScene.svelte'),
		tq: () => import('./scenes/TqScene.svelte'),
		ratio: () => import('./scenes/RatioScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
