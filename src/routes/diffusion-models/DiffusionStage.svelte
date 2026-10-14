<script lang="ts">
	/** Root of the diffusion-models illustration: picks a scene per step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		plane: () => import('./scenes/PlaneScene.svelte'),
		schedule: () => import('./scenes/ScheduleScene.svelte'),
		digit: () => import('./scenes/DigitScene.svelte'),
		network: () => import('./scenes/NetworkScene.svelte'),
		prompt: () => import('./scenes/PromptScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
