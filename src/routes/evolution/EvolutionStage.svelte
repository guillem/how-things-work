<script lang="ts">
	/** Root of the evolution illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		moths: () => import('./scenes/MothScene.svelte'),
		lines: () => import('./scenes/LinesScene.svelte'),
		plates: () => import('./scenes/PlatesScene.svelte'),
		history: () => import('./scenes/HistoryScene.svelte'),
		plate: () => import('./scenes/PlateScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
