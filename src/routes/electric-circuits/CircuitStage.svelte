<script lang="ts">
	/** Root of the electric-circuits illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		board: () => import('./scenes/BoardScene.svelte'),
		wire: () => import('./scenes/WireScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
