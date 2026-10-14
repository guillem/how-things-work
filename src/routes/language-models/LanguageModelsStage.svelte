<script lang="ts">
	/** Root of the language-model illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tokens: () => import('./scenes/TokenScene.svelte'),
		predict: () => import('./scenes/PredictScene.svelte'),
		training: () => import('./scenes/TrainingScene.svelte'),
		generate: () => import('./scenes/GenerateScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte'),
		choose: () => import('./scenes/ChooseScene.svelte'),
		chat: () => import('./scenes/ChatScene.svelte'),
		loop: () => import('./scenes/LoopScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
