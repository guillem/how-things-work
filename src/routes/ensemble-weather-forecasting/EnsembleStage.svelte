<script lang="ts">
	/** Root of the ensemble forecasting illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ring: () => import('./scenes/RingScene.svelte'),
		fan: () => import('./scenes/FanScene.svelte'),
		regimes: () => import('./scenes/RegimesScene.svelte'),
		odds: () => import('./scenes/OddsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
