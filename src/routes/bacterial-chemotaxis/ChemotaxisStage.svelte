<script lang="ts">
	/** Root of the chemotaxis illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		swim: () => import('./scenes/SwimScene.svelte'),
		sense: () => import('./scenes/SenseScene.svelte'),
		trace: () => import('./scenes/TraceScene.svelte'),
		dish: () => import('./scenes/DishScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
