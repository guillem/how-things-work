<script lang="ts">
	/** Root of the homeostasis illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		body: () => import('./scenes/BodyScene.svelte'),
		plot: () => import('./scenes/PlotScene.svelte'),
		loops: () => import('./scenes/LoopsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
