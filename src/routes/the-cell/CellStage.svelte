<script lang="ts">
	/** Root of "The cell" illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		zoom: () => import('./scenes/ZoomScene.svelte'),
		sizes: () => import('./scenes/SizesScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
