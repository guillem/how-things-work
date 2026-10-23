<script lang="ts">
	/** Root of the sea-breeze illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		coast: () => import('./scenes/CoastScene.svelte'),
		layers: () => import('./scenes/LayersScene.svelte'),
		chart: () => import('./scenes/DayChartScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
