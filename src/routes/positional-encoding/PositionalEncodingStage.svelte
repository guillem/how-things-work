<script lang="ts">
	/** Root of the positional-encoding illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		shuffle: () => import('./scenes/ShuffleScene.svelte'),
		clocks: () => import('./scenes/ClockScene.svelte'),
		rope: () => import('./scenes/RopeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
