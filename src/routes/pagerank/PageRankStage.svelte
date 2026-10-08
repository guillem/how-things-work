<script lang="ts">
	/** Root of the PageRank illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		votes: () => import('./scenes/VotesScene.svelte'),
		surfer: () => import('./scenes/SurferScene.svelte'),
		iterate: () => import('./scenes/IterateScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
