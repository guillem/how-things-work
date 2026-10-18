<script lang="ts">
	/** Root of the population-genetics illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		hw: () => import('./scenes/HwScene.svelte'),
		traces: () => import('./scenes/TracesScene.svelte'),
		balance: () => import('./scenes/BalanceScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
