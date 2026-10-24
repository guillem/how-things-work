<script lang="ts">
	/** Root of the light-bulb illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		bulb: () => import('./scenes/BulbScene.svelte'),
		chart: () => import('./scenes/DimmerChartScene.svelte'),
		spectrum: () => import('./scenes/SpectrumScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
