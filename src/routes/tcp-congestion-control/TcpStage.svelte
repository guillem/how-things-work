<script lang="ts">
	/** Root of the TCP congestion-control illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		pipe: () => import('./scenes/PipeScene.svelte'),
		trace: () => import('./scenes/TraceScene.svelte'),
		phase: () => import('./scenes/PhaseScene.svelte'),
		share: () => import('./scenes/ShareScene.svelte'),
		mathis: () => import('./scenes/MathisScene.svelte'),
		collapse: () => import('./scenes/CollapseScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
