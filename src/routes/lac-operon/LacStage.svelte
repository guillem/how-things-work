<script lang="ts">
	/** Root of the lac-operon illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		operon: () => import('./scenes/OperonScene.svelte'),
		balance: () => import('./scenes/BalanceScene.svelte'),
		loop: () => import('./scenes/LoopScene.svelte'),
		culture: () => import('./scenes/CultureScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
