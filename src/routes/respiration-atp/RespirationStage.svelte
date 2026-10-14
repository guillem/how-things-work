<script lang="ts">
	/** Root of the respiration illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		map: () => import('./scenes/MapScene.svelte'),
		glycolysis: () => import('./scenes/GlycolysisScene.svelte'),
		cycle: () => import('./scenes/CycleScene.svelte'),
		chain: () => import('./scenes/ChainScene.svelte'),
		staircase: () => import('./scenes/StaircaseScene.svelte'),
		synthase: () => import('./scenes/SynthaseScene.svelte'),
		ledger: () => import('./scenes/LedgerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
