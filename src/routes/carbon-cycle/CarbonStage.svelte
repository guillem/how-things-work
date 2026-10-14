<script lang="ts">
	/** Root of the carbon-cycle illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cycle: () => import('./scenes/CycleScene.svelte'),
		speeds: () => import('./scenes/SpeedsScene.svelte'),
		history: () => import('./scenes/HistoryScene.svelte'),
		run: () => import('./scenes/RunScene.svelte'),
		pulse: () => import('./scenes/PulseScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
