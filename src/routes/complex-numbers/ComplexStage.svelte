<script lang="ts">
	/** Root of the complex-numbers illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		plane: () => import('./scenes/PlaneScene.svelte'),
		product: () => import('./scenes/ProductScene.svelte'),
		euler: () => import('./scenes/EulerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
