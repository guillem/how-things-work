<script lang="ts">
	/** Root of the black-holes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		globe: () => import('./scenes/GlobeScene.svelte'),
		rays: () => import('./scenes/RaysScene.svelte'),
		swap: () => import('./scenes/SwapScene.svelte'),
		clock: () => import('./scenes/ClockScene.svelte'),
		lens: () => import('./scenes/LensScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
