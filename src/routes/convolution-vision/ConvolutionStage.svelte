<script lang="ts">
	/** Root of the convolution illustration: picks a scene per step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		conv: () => import('./scenes/ConvScene.svelte'),
		layers: () => import('./scenes/LayersScene.svelte'),
		predict: () => import('./scenes/PredictScene.svelte'),
		deeper: () => import('./scenes/DeeperScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
