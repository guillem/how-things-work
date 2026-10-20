<script lang="ts">
	/** Root of the k-means-clustering illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cluster: () => import('./scenes/ClusterScene.svelte'),
		starts: () => import('./scenes/StartsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
