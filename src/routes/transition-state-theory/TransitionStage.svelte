<script lang="ts">
	/** Root of the transition-state illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		map: () => import('./scenes/MapScene.svelte'),
		rate: () => import('./scenes/RateScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
