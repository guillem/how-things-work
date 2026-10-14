<script lang="ts">
	/** Root of the ice-ages illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		record: () => import('./scenes/RecordScene.svelte'),
		orbit: () => import('./scenes/OrbitScene.svelte'),
		timeline: () => import('./scenes/TimelineScene.svelte'),
		spectrum: () => import('./scenes/SpectrumScene.svelte'),
		push: () => import('./scenes/PushScene.svelte'),
		co2: () => import('./scenes/Co2Scene.svelte'),
		future: () => import('./scenes/FutureScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
