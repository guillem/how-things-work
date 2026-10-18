<script lang="ts">
	/** Root of the training illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		predict: () => import('./scenes/PredictScene.svelte'),
		loop: () => import('./scenes/LoopScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
