<script lang="ts">
	/** Root of the mRNA-vaccine illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		idea: () => import('./scenes/IdeaScene.svelte'),
		message: () => import('./scenes/MessageScene.svelte'),
		spike: () => import('./scenes/SpikeScene.svelte'),
		journey: () => import('./scenes/JourneyScene.svelte'),
		display: () => import('./scenes/DisplayScene.svelte'),
		chart: () => import('./scenes/ChartScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
