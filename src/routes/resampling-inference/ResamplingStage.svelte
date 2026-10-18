<script lang="ts">
	/** Root of the resampling-inference illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		shuffle: () => import('./scenes/ShuffleScene.svelte'),
		boot: () => import('./scenes/BootScene.svelte'),
		slope: () => import('./scenes/SlopeScene.svelte'),
		coverage: () => import('./scenes/CoverageScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
