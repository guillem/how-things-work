<script lang="ts">
	/** Root of the bicycle-stability illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ride: () => import('./scenes/RideScene.svelte'),
		roots: () => import('./scenes/RootsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
