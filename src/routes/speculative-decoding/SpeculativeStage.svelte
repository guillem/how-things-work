<script lang="ts">
	/** Root of the speculative-decoding illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		round: () => import('./scenes/RoundScene.svelte'),
		hist: () => import('./scenes/HistogramScene.svelte'),
		speed: () => import('./scenes/SpeedScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
