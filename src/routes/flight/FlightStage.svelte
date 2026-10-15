<script lang="ts">
	/** Root of the flight illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		flow: () => import('./scenes/FlowScene.svelte'),
		lift: () => import('./scenes/LiftScene.svelte'),
		drag: () => import('./scenes/DragScene.svelte'),
		plane: () => import('./scenes/PlaneScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
