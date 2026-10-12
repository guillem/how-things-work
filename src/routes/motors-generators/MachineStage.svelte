<script lang="ts">
	/** Root of the motors-and-generators illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		parts: () => import('./scenes/PartsScene.svelte'),
		machine: () => import('./scenes/MachineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
