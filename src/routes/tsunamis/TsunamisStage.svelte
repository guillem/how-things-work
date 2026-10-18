<script lang="ts">
	/** Root of the tsunamis illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ocean: () => import('./scenes/OceanScene.svelte'),
		column: () => import('./scenes/ColumnScene.svelte'),
		gauge: () => import('./scenes/GaugeScene.svelte'),
		records: () => import('./scenes/RecordsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
