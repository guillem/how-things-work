<script lang="ts">
	/** Root of the bridges illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		basics: () => import('./scenes/BasicsScene.svelte'),
		bridge: () => import('./scenes/BridgeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
