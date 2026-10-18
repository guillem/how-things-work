<script lang="ts">
	/** Root of the Taylor-series illustration: one scene for every step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		series: () => import('./scenes/SeriesScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
