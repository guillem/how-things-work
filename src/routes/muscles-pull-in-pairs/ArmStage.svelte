<script lang="ts">
	/** Root of the muscles-pull-in-pairs illustration: one scene, the cutaway arm. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		arm: () => import('./scenes/ArmScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
