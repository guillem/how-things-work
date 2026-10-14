<script lang="ts">
	/** Root of the greenhouse-effect illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		planet: () => import('./scenes/PlanetScene.svelte'),
		molecules: () => import('./scenes/MoleculesScene.svelte'),
		layer: () => import('./scenes/LayerScene.svelte'),
		glass: () => import('./scenes/GlassScene.svelte'),
		climate: () => import('./scenes/ClimateScene.svelte'),
		past: () => import('./scenes/PastScene.svelte'),
		futures: () => import('./scenes/FuturesScene.svelte'),
		budget: () => import('./scenes/BudgetScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
