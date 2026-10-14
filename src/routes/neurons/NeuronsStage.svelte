<script lang="ts">
	/** Root of the neurons illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		neuron: () => import('./scenes/NeuronScene.svelte'),
		ions: () => import('./scenes/IonsScene.svelte'),
		spike: () => import('./scenes/SpikeScene.svelte'),
		cable: () => import('./scenes/CableScene.svelte'),
		myelin: () => import('./scenes/MyelinScene.svelte'),
		synapse: () => import('./scenes/SynapseScene.svelte'),
		summation: () => import('./scenes/SummationScene.svelte'),
		circuit: () => import('./scenes/CircuitScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
