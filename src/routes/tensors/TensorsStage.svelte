<script lang="ts">
	/** Root of the tensors illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		grow: () => import('./scenes/GrowScene.svelte'),
		image: () => import('./scenes/ImageScene.svelte'),
		matvec: () => import('./scenes/MatVecScene.svelte'),
		frame: () => import('./scenes/FrameScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
