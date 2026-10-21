<script lang="ts">
	/** Root of the twenty-questions illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		number: () => import('./scenes/NumberScene.svelte'),
		book: () => import('./scenes/BookScene.svelte'),
		board: () => import('./scenes/BoardScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
