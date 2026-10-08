<script lang="ts">
	/** Root of the graph-search illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		grid: () => import('./scenes/GridScene.svelte'),
		race: () => import('./scenes/RaceScene.svelte'),
		roads: () => import('./scenes/RoadsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
