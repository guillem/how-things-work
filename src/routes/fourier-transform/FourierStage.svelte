<script lang="ts">
	/** Root of the Fourier-transform illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sum: () => import('./scenes/SumScene.svelte'),
		phasors: () => import('./scenes/PhasorScene.svelte'),
		spectrum: () => import('./scenes/SpectrumScene.svelte'),
		wind: () => import('./scenes/WindScene.svelte'),
		epicycles: () => import('./scenes/EpicycleScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
