<script lang="ts">
	/** Root of the gradient-descent illustration: one scene, its panels chosen by the step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		descent: () => import('./scenes/DescentScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
