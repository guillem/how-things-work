<script lang="ts">
	/** Root of the embeddings illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		vectors: () => import('./scenes/VectorScene.svelte'),
		map: () => import('./scenes/MapScene.svelte'),
		directions: () => import('./scenes/DirectionScene.svelte'),
		sentences: () => import('./scenes/SentenceScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
