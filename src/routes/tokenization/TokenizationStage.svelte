<script lang="ts">
	/** Root of the tokenization illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		train: () => import('./scenes/TrainScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		gpt2: () => import('./scenes/Gpt2Scene.svelte'),
		numbers: () => import('./scenes/NumbersScene.svelte'),
		languages: () => import('./scenes/LanguagesScene.svelte'),
		letters: () => import('./scenes/LettersScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
