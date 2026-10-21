<script lang="ts">
	/** Root of the forest-fire-spread illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		forest: () => import('./scenes/ForestScene.svelte'),
		chance: () => import('./scenes/ChanceScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
