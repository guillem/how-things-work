<script lang="ts">
	/** Root of the three-body illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		map: () => import('./scenes/MapScene.svelte'),
		balance: () => import('./scenes/BalanceScene.svelte'),
		drift: () => import('./scenes/DriftScene.svelte'),
		trojan: () => import('./scenes/TrojanScene.svelte'),
		split: () => import('./scenes/SplitScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
