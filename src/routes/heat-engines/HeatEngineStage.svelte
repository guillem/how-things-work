<script lang="ts">
	/** Root of the heat-engines illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		box: () => import('./scenes/BoxScene.svelte'),
		ledger: () => import('./scenes/LedgerScene.svelte'),
		engine: () => import('./scenes/EngineScene.svelte'),
		carnot: () => import('./scenes/CarnotScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte'),
		real: () => import('./scenes/RealScene.svelte'),
		plant: () => import('./scenes/PlantScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
