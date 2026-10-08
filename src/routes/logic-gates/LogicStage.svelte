<script lang="ts">
	/** Root of the logic-gates illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		canvas: () => import('./scenes/CanvasScene.svelte'),
		ripple: () => import('./scenes/RippleScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
