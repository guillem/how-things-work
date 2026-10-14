<script lang="ts">
	/** Root of the big-bang illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		grid: () => import('./scenes/GridScene.svelte'),
		stretch: () => import('./scenes/StretchScene.svelte'),
		timeline: () => import('./scenes/TimelineScene.svelte'),
		distance: () => import('./scenes/DistanceScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
