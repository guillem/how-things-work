<script lang="ts">
	/** Root of the atmosphere illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		balance: () => import('./scenes/BalanceScene.svelte'),
		cells: () => import('./scenes/CellsScene.svelte'),
		coriolis: () => import('./scenes/CoriolisScene.svelte'),
		map: () => import('./scenes/MapScene.svelte'),
		storm: () => import('./scenes/StormScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
