<script lang="ts">
	/** Root of the earthquakes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		fault: () => import('./scenes/FaultScene.svelte'),
		waves: () => import('./scenes/WavesScene.svelte'),
		earth: () => import('./scenes/EarthScene.svelte'),
		locate: () => import('./scenes/LocateScene.svelte'),
		magnitude: () => import('./scenes/MagnitudeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
