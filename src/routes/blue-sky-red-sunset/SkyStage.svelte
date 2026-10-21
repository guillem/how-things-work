<script lang="ts">
	/** Root of the blue-sky-red-sunset illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sky: () => import('./scenes/SkyScene.svelte'),
		spectrum: () => import('./scenes/SpectrumScene.svelte'),
		beam: () => import('./scenes/BeamScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
