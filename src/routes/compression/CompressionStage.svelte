<script lang="ts">
	/** Root of the compression illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		message: () => import('./scenes/MessageScene.svelte'),
		huffman: () => import('./scenes/HuffmanScene.svelte'),
		blocks: () => import('./scenes/BlockScene.svelte'),
		quality: () => import('./scenes/QualityScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
