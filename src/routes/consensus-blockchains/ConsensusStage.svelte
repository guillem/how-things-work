<script lang="ts">
	/** Root of the consensus and blockchains illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cluster: () => import('./scenes/ClusterScene.svelte'),
		generals: () => import('./scenes/GeneralsScene.svelte'),
		chain: () => import('./scenes/ChainScene.svelte'),
		forks: () => import('./scenes/ForksScene.svelte'),
		summary: () => import('./scenes/SummaryScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
