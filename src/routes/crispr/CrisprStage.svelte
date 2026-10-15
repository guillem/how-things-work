<script lang="ts">
	/** Root of the CRISPR illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		infection: () => import('./scenes/InfectionScene.svelte'),
		array: () => import('./scenes/ArrayScene.svelte'),
		inherit: () => import('./scenes/InheritScene.svelte'),
		express: () => import('./scenes/ExpressScene.svelte'),
		interfere: () => import('./scenes/InterfereScene.svelte'),
		yogurt: () => import('./scenes/YogurtScene.svelte'),
		population: () => import('./scenes/PopulationScene.svelte'),
		history: () => import('./scenes/HistoryScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
