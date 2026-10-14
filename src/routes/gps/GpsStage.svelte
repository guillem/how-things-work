<script lang="ts">
	/** Root of the GPS illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		plane: () => import('./scenes/PlaneScene.svelte'),
		globe: () => import('./scenes/GlobeScene.svelte'),
		sky: () => import('./scenes/SkyScene.svelte'),
		clocks: () => import('./scenes/ClocksScene.svelte'),
		drift: () => import('./scenes/DriftScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
