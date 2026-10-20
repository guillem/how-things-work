<script lang="ts">
	/** Root of the heat-pumps-refrigeration illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ph: () => import('./scenes/PhScene.svelte'),
		lift: () => import('./scenes/LiftScene.svelte'),
		bars: () => import('./scenes/BarsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
