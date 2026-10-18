<script lang="ts">
	/** Root of the kv-cache-inference illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		generate: () => import('./scenes/GenerateScene.svelte'),
		memory: () => import('./scenes/MemoryScene.svelte'),
		roofline: () => import('./scenes/RooflineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
