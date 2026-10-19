<script lang="ts">
	/** Root of the caches illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ladder: () => import('./scenes/LadderScene.svelte'),
		lab: () => import('./scenes/LabScene.svelte'),
		matmul: () => import('./scenes/MatmulScene.svelte'),
		bills: () => import('./scenes/BillsScene.svelte'),
		knee: () => import('./scenes/KneeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
