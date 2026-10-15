<script lang="ts">
	/** Root of the feedback-control illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		car: () => import('./scenes/CarScene.svelte'),
		drone: () => import('./scenes/DroneScene.svelte'),
		pole: () => import('./scenes/PoleScene.svelte'),
		arm: () => import('./scenes/ArmScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
