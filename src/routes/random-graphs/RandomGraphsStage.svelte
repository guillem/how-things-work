<script lang="ts">
	/** Root of the random-graphs illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		graph: () => import('./scenes/GraphScene.svelte'),
		explore: () => import('./scenes/ExploreScene.svelte'),
		equation: () => import('./scenes/EquationScene.svelte'),
		sweep: () => import('./scenes/SweepScene.svelte'),
		window: () => import('./scenes/WindowScene.svelte'),
		spread: () => import('./scenes/SpreadScene.svelte'),
		lattice: () => import('./scenes/LatticeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
