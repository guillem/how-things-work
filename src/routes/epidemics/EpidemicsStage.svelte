<script lang="ts">
	/** Root of the epidemics illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		crowd: () => import('./scenes/CrowdScene.svelte'),
		tree: () => import('./scenes/TreeScene.svelte'),
		sir: () => import('./scenes/SirScene.svelte'),
		runs: () => import('./scenes/RunsScene.svelte'),
		threshold: () => import('./scenes/ThresholdScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
