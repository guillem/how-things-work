<script lang="ts">
	/** Root of the central-limit-theorem illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		galton: () => import('./scenes/GaltonScene.svelte'),
		means: () => import('./scenes/MeansScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
