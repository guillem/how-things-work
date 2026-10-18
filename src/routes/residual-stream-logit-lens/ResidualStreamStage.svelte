<script lang="ts">
	/** Root of the residual-stream illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		stream: () => import('./scenes/StreamScene.svelte'),
		grid: () => import('./scenes/GridScene.svelte'),
		ablate: () => import('./scenes/AblateScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
