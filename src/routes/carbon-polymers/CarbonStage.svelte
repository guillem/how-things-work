<script lang="ts">
	/** Root of the carbon-polymers illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		chain3d: () => import('./scenes/ChainScene.svelte'),
		builder: () => import('./scenes/BuilderScene.svelte'),
		lineup: () => import('./scenes/LineupScene.svelte'),
		mirror: () => import('./scenes/MirrorScene.svelte'),
		series: () => import('./scenes/SeriesScene.svelte'),
		polymer: () => import('./scenes/PolymerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
