<script lang="ts">
	/** Root of the rlhf-alignment illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		answers: () => import('./scenes/AnswersScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte'),
		policy: () => import('./scenes/PolicyScene.svelte'),
		hack: () => import('./scenes/HackScene.svelte'),
		pipeline: () => import('./scenes/PipelineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
