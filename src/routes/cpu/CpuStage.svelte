<script lang="ts">
	/** Root of the CPU illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		machine: () => import('./scenes/MachineScene.svelte'),
		pipeline: () => import('./scenes/PipelineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
