<script lang="ts">
	/** Root of the cancer illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tissue: () => import('./scenes/TissueScene.svelte'),
		genes: () => import('./scenes/GenesScene.svelte'),
		age: () => import('./scenes/AgeScene.svelte'),
		knudson: () => import('./scenes/KnudsonScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
