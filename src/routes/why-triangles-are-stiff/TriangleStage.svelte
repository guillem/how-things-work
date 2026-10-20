<script lang="ts">
	/** Root of the why-triangles-are-stiff illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		frame: () => import('./scenes/FrameScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
