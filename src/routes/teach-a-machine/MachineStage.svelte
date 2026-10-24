<script lang="ts">
	/** Root of the teach-a-machine illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		machine: () => import('./scenes/MachineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
