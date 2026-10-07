<script lang="ts">
	/** Root of the sorting illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		bars: () => import('./scenes/BarsScene.svelte'),
		race: () => import('./scenes/RaceScene.svelte'),
		growth: () => import('./scenes/GrowthScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
