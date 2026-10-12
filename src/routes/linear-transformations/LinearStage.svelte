<script lang="ts">
	/** Root of the linear-transformations illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		plane: () => import('./scenes/PlaneScene.svelte'),
		transform: () => import('./scenes/TransformScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
