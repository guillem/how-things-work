<script lang="ts">
	/** Root of the learning-from-data illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		fit: () => import('./scenes/FitScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
