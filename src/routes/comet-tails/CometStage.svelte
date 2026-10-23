<script lang="ts">
	/** Root of the comet-tails illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		close: () => import('./scenes/CloseScene.svelte'),
		orbit: () => import('./scenes/OrbitScene.svelte'),
		nucleus: () => import('./scenes/NucleusScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
