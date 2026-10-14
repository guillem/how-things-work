<script lang="ts">
	/** Root of the neural-network illustration: picks a scene per step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		neuron: () => import('./scenes/NeuronScene.svelte'),
		network: () => import('./scenes/NetworkScene.svelte'),
		bend: () => import('./scenes/BendScene.svelte'),
		backprop: () => import('./scenes/BackpropScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
