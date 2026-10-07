<script lang="ts">
	/** Root of the photosynthesis illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		leaf: () => import('./scenes/LeafScene.svelte'),
		spectrum: () => import('./scenes/SpectrumScene.svelte'),
		membrane: () => import('./scenes/MembraneScene.svelte'),
		zscheme: () => import('./scenes/ZSchemeScene.svelte'),
		calvin: () => import('./scenes/CalvinScene.svelte'),
		summary: () => import('./scenes/SummaryScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
