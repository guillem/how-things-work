<script lang="ts">
	/** Root of the vision and colour illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		eye: () => import('./scenes/EyeScene.svelte'),
		cones: () => import('./scenes/ConesScene.svelte'),
		match: () => import('./scenes/MatchScene.svelte'),
		pipeline: () => import('./scenes/PipelineScene.svelte'),
		afterimage: () => import('./scenes/AfterimageScene.svelte'),
		illusion: () => import('./scenes/IllusionScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
